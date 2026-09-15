import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleAccountRequest, closeAccountDatabase } from '../server/accounts'

type Reply = { status: number; body: { ok?: boolean; message?: string; name?: string | null }; cookie: string | null }

/** A request the handler can read: a body stream plus the headers it looks at. */
function request(method: string, url: string, body?: unknown, cookie?: string): IncomingMessage {
  const stream = Readable.from(body === undefined ? [] : [JSON.stringify(body)]) as unknown as IncomingMessage
  stream.method = method
  stream.url = url
  stream.headers = cookie ? { cookie } : {}
  Object.defineProperty(stream, 'socket', { value: { remoteAddress: '127.0.0.1' }, configurable: true })
  return stream
}

function reply(): { response: ServerResponse; read(): Reply } {
  let status = 0
  let cookie: string | null = null
  let payload = ''
  const response = {
    writeHead(code: number, headers: Record<string, string>) {
      status = code
      cookie = (headers['Set-Cookie'] as string | undefined) ?? null
      return response
    },
    end(chunk?: string) {
      payload = chunk ?? ''
      return response
    },
  } as unknown as ServerResponse
  return { response, read: () => ({ status, cookie, body: JSON.parse(payload || '{}') }) }
}

export async function testAccounts(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'headliner-accounts-'))
  // Set before the first request, which is when the database is opened: the account
  // server then works in this throwaway directory instead of the real data folder.
  process.env.HEADLINER_DATA_DIR = directory

  const call = async (method: string, url: string, body?: unknown, cookie?: string): Promise<Reply> => {
    const sink = reply()
    const handled = await handleAccountRequest(request(method, url, body, cookie), sink.response)
    assert.equal(handled, true, `${method} ${url} is an account route`)
    return sink.read()
  }

  try {
    assert.equal(await handleAccountRequest(request('GET', '/api/saves'), reply().response), false, 'other routes are left alone')

    // Registration hands out a session, and the session cookie is not readable by scripts.
    const created = await call('POST', '/api/account/register', { name: 'Ada Lovelace', password: 'wetterfest-2026' })
    assert.equal(created.status, 201)
    assert.equal(created.body.name, 'Ada Lovelace')
    assert.match(created.cookie ?? '', /^headliner_session=[a-f0-9]{64};/)
    assert.match(created.cookie ?? '', /HttpOnly/)
    assert.match(created.cookie ?? '', /SameSite=Lax/)
    const cookie = (created.cookie ?? '').split(';')[0]!

    // The password is nowhere in the database — only a hash of it.
    closeAccountDatabase()
    const raw = readFileSync(join(directory, 'accounts.db'))
    assert.equal(raw.includes(Buffer.from('wetterfest-2026')), false, 'the password itself is never written down')
    assert.equal(raw.includes(Buffer.from('Ada Lovelace')), true, 'the name is')

    // The session says who it belongs to; a made-up one says nothing.
    assert.deepEqual((await call('GET', '/api/account/me', undefined, cookie)).body, { ok: true, name: 'Ada Lovelace' })
    assert.deepEqual((await call('GET', '/api/account/me', undefined, 'headliner_session=00ff')).body, { ok: false, name: null })
    assert.deepEqual((await call('GET', '/api/account/me')).body, { ok: false, name: null })

    // Names are taken once, whatever the spelling.
    const duplicate = await call('POST', '/api/account/register', { name: '  ada   lovelace ', password: 'anderes-passwort' })
    assert.equal(duplicate.status, 409)

    // Wrong password and unknown name are answered the same way.
    const wrongPassword = await call('POST', '/api/account/login', { name: 'Ada Lovelace', password: 'wetterfest-2025' })
    const unknownName = await call('POST', '/api/account/login', { name: 'Niemand', password: 'wetterfest-2026' })
    assert.equal(wrongPassword.status, 401)
    assert.equal(wrongPassword.body.message, unknownName.body.message, 'a stranger learns nothing about which half was wrong')
    assert.equal(wrongPassword.cookie, null, 'a failed sign-in hands out no session')

    // Too short, too long, nonsense: rejected before anything is looked up.
    assert.equal((await call('POST', '/api/account/register', { name: 'ab', password: 'wetterfest-2026' })).status, 400)
    assert.equal((await call('POST', '/api/account/register', { name: 'Gültig', password: 'kurz' })).status, 400)
    assert.equal((await call('POST', '/api/account/register', { name: 'Zeichen<>', password: 'wetterfest-2026' })).status, 400)

    // Signing in again works and issues a fresh session.
    const signedIn = await call('POST', '/api/account/login', { name: 'ADA LOVELACE', password: 'wetterfest-2026' })
    assert.equal(signedIn.status, 200)
    assert.notEqual(signedIn.cookie, created.cookie, 'every sign-in gets its own token')
    const second = (signedIn.cookie ?? '').split(';')[0]!

    // Signing out ends that session and only that one.
    const out = await call('POST', '/api/account/logout', undefined, second)
    assert.match(out.cookie ?? '', /Max-Age=0/)
    assert.deepEqual((await call('GET', '/api/account/me', undefined, second)).body, { ok: false, name: null })
    assert.deepEqual((await call('GET', '/api/account/me', undefined, cookie)).body, { ok: true, name: 'Ada Lovelace' }, 'the other session keeps running')

    // Guessing is slowed down after a handful of tries.
    for (let attempt = 0; attempt < 8; attempt++) {
      await call('POST', '/api/account/login', { name: 'Ada Lovelace', password: `falsch-${attempt}` })
    }
    assert.equal((await call('POST', '/api/account/login', { name: 'Ada Lovelace', password: 'wetterfest-2026' })).status, 429)
  } finally {
    closeAccountDatabase()
    delete process.env.HEADLINER_DATA_DIR
    rmSync(directory, { recursive: true, force: true })
  }
}
