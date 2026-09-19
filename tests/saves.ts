import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handleAccountRequest } from '../server/accounts'
import { handleSaveRequest } from '../server/saveSlots'
import { closeDatabase } from '../server/database'
import { request, reply, type Reply } from './serverApi'

/**
 * Saves belong to accounts. What this pins down is the part that is easy to get
 * wrong: a public save is readable by everyone and writable by no one but its owner,
 * so picking one up and saving it makes a copy instead of changing the original.
 */
export async function testSaves(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'headliner-saves-'))
  process.env.HEADLINER_DATA_DIR = directory

  const call = async (method: string, url: string, body?: unknown, cookie?: string): Promise<Reply> => {
    const sink = reply()
    const handled = await handleSaveRequest(request(method, url, body, cookie), sink.response)
    assert.equal(handled, true, `${method} ${url} is a save route`)
    return sink.read()
  }
  const signUp = async (name: string): Promise<string> => {
    const sink = reply()
    await handleAccountRequest(request('POST', '/api/account/register', { name, password: 'wetterfest-2026' }), sink.response)
    const created = sink.read()
    assert.equal(created.status, 201, `${name} could be registered`)
    return (created.cookie ?? '').split(';')[0]!
  }
  const world = (marker: string) => JSON.stringify({ money: 1000, marker })
  /** A save that looks like a real snapshot where it matters: it says where the festival stood. */
  const standing = (edition: number, day: number, minute: number) => JSON.stringify({ money: 1, festival: { edition }, day, minute })

  try {
    // Listing must work before anyone has signed in. The public join onto users
    // used to fail with "no such table: users" and empty the archive UI.
    assert.deepEqual((await call('GET', '/api/saves')).body, { account: null, own: [], shared: [] })

    const ada = await signUp('Ada Lovelace')
    const grace = await signUp('Grace Hopper')

    // Without an account there is nothing to read and nowhere to write.
    assert.deepEqual((await call('GET', '/api/saves')).body, { account: null, own: [], shared: [] })
    assert.equal((await call('POST', '/api/saves', { name: 'Ohne Konto', snapshot: world('guest') })).status, 401)

    const created = await call('POST', '/api/saves', { name: '  Regen   Samstag ', snapshot: world('ada-1') }, ada)
    assert.equal(created.status, 201)
    assert.equal(created.body.name, 'Regen Samstag', 'the name is tidied up')
    assert.equal(created.body.owner, 'Ada Lovelace')
    assert.equal(created.body.public, false, 'a new save is private')
    const id = created.body.id as string

    // A private save belongs to one archive only.
    const adaList = await call('GET', '/api/saves', undefined, ada)
    assert.equal(adaList.body.account, 'Ada Lovelace')
    assert.equal(adaList.body.own.length, 1)
    assert.deepEqual((await call('GET', '/api/saves', undefined, grace)).body, { account: 'Grace Hopper', own: [], shared: [] })
    assert.equal((await call('GET', `/api/saves/${id}`, undefined, grace)).status, 404, 'a private save is invisible to everyone else')
    assert.equal((await call('GET', `/api/saves/${id}`, undefined, ada)).body.snapshot, world('ada-1'))

    // Sharing puts it in the public list, with the name behind it.
    assert.equal((await call('PATCH', `/api/saves/${id}`, { public: true }, ada)).body.public, true)
    const forGrace = await call('GET', '/api/saves', undefined, grace)
    assert.equal(forGrace.body.own.length, 0)
    assert.deepEqual(forGrace.body.shared.map((slot: any) => [slot.name, slot.owner, slot.public]), [['Regen Samstag', 'Ada Lovelace', true]])
    assert.deepEqual((await call('GET', '/api/saves')).body.shared.length, 1, 'guests see the public list too')
    assert.equal((await call('GET', `/api/saves/${id}`, undefined, grace)).body.snapshot, world('ada-1'), 'and can open it')
    assert.equal((await call('GET', '/api/saves', undefined, ada)).body.shared.length, 0, 'your own share is not listed to you twice')

    // But it stays Ada's: nobody else may write to it, by any route.
    for (const attempt of [
      call('PUT', `/api/saves/${id}`, { name: 'Gekapert', snapshot: world('grace-overwrite') }, grace),
      call('PATCH', `/api/saves/${id}`, { public: false }, grace),
      call('DELETE', `/api/saves/${id}`, undefined, grace),
    ]) {
      assert.equal((await attempt).status, 404, 'a public save is readable, never writable')
    }
    assert.equal((await call('GET', `/api/saves/${id}`, undefined, ada)).body.snapshot, world('ada-1'), 'the original is untouched')

    // Picking up a public festival and saving it makes a copy of one's own.
    const copy = await call('POST', '/api/saves', { name: 'Regen Samstag', snapshot: world('grace-copy') }, grace)
    assert.equal(copy.status, 201)
    assert.equal(copy.body.owner, 'Grace Hopper')
    assert.notEqual(copy.body.id, id)
    assert.equal((await call('GET', '/api/saves', undefined, grace)).body.own.length, 1)
    assert.equal((await call('GET', '/api/saves', undefined, ada)).body.own.length, 1, "Ada's archive did not grow")
    assert.equal((await call('GET', `/api/saves/${id}`, undefined, ada)).body.snapshot, world('ada-1'))

    // The owner can overwrite, un-share and delete.
    assert.equal((await call('PUT', `/api/saves/${id}`, { name: 'Sonntag', snapshot: world('ada-2') }, ada)).body.name, 'Sonntag')
    assert.equal((await call('GET', `/api/saves/${id}`, undefined, ada)).body.snapshot, world('ada-2'))
    assert.equal((await call('PATCH', `/api/saves/${id}`, { public: false }, ada)).body.public, false)
    assert.equal((await call('GET', '/api/saves', undefined, grace)).body.shared.length, 0, 'taking the share back hides it again')
    assert.equal((await call('DELETE', `/api/saves/${id}`, undefined, ada)).status, 200)
    assert.equal((await call('GET', '/api/saves', undefined, ada)).body.own.length, 0)

    // Every save carries where the festival stood, read off the snapshot as it is written.
    const stood = await call('POST', '/api/saves', { name: 'Samstagabend', snapshot: standing(2, 3, 14 * 60 + 30) }, grace)
    assert.equal(stood.status, 201)
    assert.deepEqual([stood.body.edition, stood.body.day, stood.body.minute], [2, 3, 870], 'edition, day and minute are kept')
    const listed = (await call('GET', '/api/saves', undefined, grace)).body.own.find((slot: any) => slot.id === stood.body.id)
    assert.deepEqual([listed.edition, listed.day, listed.minute], [2, 3, 870], 'and listed with the save')
    const moved = await call('PUT', `/api/saves/${stood.body.id}`, { name: 'Samstagabend', snapshot: standing(3, 1, 5) }, grace)
    assert.deepEqual([moved.body.edition, moved.body.day, moved.body.minute], [3, 1, 5], 'overwriting moves them along')
    assert.equal((await call('GET', '/api/saves', undefined, grace)).body.own.find((slot: any) => slot.id === copy.body.id).edition, undefined, 'a save without the numbers simply has none')

    // Nonsense is refused before it reaches the database.
    assert.equal((await call('POST', '/api/saves', { name: '', snapshot: world('ada-3') }, ada)).status, 400)
    assert.equal((await call('POST', '/api/saves', { name: 'Kaputt', snapshot: 'kein json' }, ada)).status, 400)
    assert.equal((await call('PATCH', `/api/saves/${copy.body.id}`, { public: 'ja' }, grace)).status, 400)
    assert.equal((await call('GET', '/api/saves/nicht-vorhanden', undefined, ada)).status, 404)
    assert.equal(await handleSaveRequest(request('GET', '/api/account/me'), reply().response), false, 'other routes are left alone')
  } finally {
    closeDatabase()
    delete process.env.HEADLINER_DATA_DIR
    rmSync(directory, { recursive: true, force: true })
  }
}
