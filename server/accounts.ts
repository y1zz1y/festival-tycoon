import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
import { closeDatabase, db as sharedDatabase } from './database.ts'

/**
 * Player accounts, kept in the server's SQLite database alongside the saves that
 * belong to them.
 *
 * What is stored is a scrypt hash of the password with its own random salt — never
 * the password. Sessions are random tokens; only their SHA-256 is written down, so a
 * copy of the database does not hand anyone a way in.
 *
 * One thing this cannot fix: the server speaks plain HTTP. On a LAN the password
 * travels readable over the wire, so put TLS in front of it before this is reachable
 * from anywhere but the machine it runs on.
 */
export type PublicAccount = { id: string; name: string; createdAt: number }

const NAME_PATTERN = /^[\p{L}\p{N} _.-]{3,24}$/u
const SESSION_DAYS = 30
const SESSION_COOKIE = 'headliner_session'
const MAX_BODY_BYTES = 8 * 1024
/**
 * Failed sign-ins before a caller is made to wait, and how long the window is. The
 * counter is kept per name *and* origin, so someone hammering a name from another
 * machine cannot lock its owner out of their own.
 */
const MAX_ATTEMPTS = 8
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000
const SCRYPT = { N: 1 << 15, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 }

const SCHEMA = {
  name: 'accounts',
  ddl: `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_key TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
  `,
}
const db = (): DatabaseSync => sharedDatabase(SCHEMA)

const normalizeName = (name: string): string => name.trim().replace(/\s+/g, ' ')
const nameKey = (name: string): string => normalizeName(name).toLocaleLowerCase()
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')
const derive = (password: string, salt: string): string =>
  scryptSync(password, salt, SCRYPT.keylen, SCRYPT).toString('hex')

/** Constant-time comparison, so a wrong password takes as long as a right one. */
function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

const attempts = new Map<string, { count: number; until: number }>()
function tooManyAttempts(key: string): boolean {
  const entry = attempts.get(key)
  return !!entry && entry.until > Date.now() && entry.count >= MAX_ATTEMPTS
}
function noteFailure(key: string): void {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.until <= now) attempts.set(key, { count: 1, until: now + ATTEMPT_WINDOW_MS })
  else entry.count += 1
}

function createSession(userId: string): string {
  const token = randomBytes(32).toString('hex')
  const now = Date.now()
  db()
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), userId, now, now + SESSION_DAYS * 24 * 60 * 60 * 1000)
  db().prepare('DELETE FROM sessions WHERE expires_at < ?').run(now)
  return token
}

function accountOfToken(token: string | null): PublicAccount | null {
  if (!token) return null
  const row = db()
    .prepare(`
      SELECT users.id AS id, users.name AS name, users.created_at AS createdAt, sessions.expires_at AS expiresAt
      FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
    `)
    .get(hashToken(token)) as { id: string; name: string; createdAt: number; expiresAt: number } | undefined
  if (!row) return null
  if (row.expiresAt <= Date.now()) {
    db().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
    return null
  }
  return { id: row.id, name: row.name, createdAt: row.createdAt }
}

/** Opens the accounts tables so other routes can join `users` even without a session cookie. */
export function ensureAccountsSchema(): void {
  db()
}

/** Who is knocking, as far as a local server can tell. */
function originOf(request: IncomingMessage): string {
  const forwarded = request.headers['x-forwarded-for']
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]
  return (first ?? request.socket.remoteAddress ?? 'unknown').trim()
}

/**
 * The account behind a request's session cookie, or null for a guest. This is the
 * one way the rest of the server learns who is calling.
 */
export function accountOfRequest(request: IncomingMessage): PublicAccount | null {
  return accountOfToken(cookieOf(request, SESSION_COOKIE))
}

function cookieOf(request: IncomingMessage, name: string): string | null {
  const header = request.headers.cookie
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

function send(response: ServerResponse, status: number, payload: unknown, cookie?: string): void {
  const headers: Record<string, string | string[]> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  }
  if (cookie) headers['Set-Cookie'] = cookie
  response.writeHead(status, headers)
  response.end(JSON.stringify(payload))
}

const sessionCookie = (token: string): string =>
  `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_DAYS * 24 * 60 * 60}; HttpOnly; SameSite=Lax`
const clearedCookie = (): string => `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`

async function bodyOf(request: IncomingMessage): Promise<{ name?: unknown; password?: unknown }> {
  let body = ''
  for await (const chunk of request) {
    body += String(chunk)
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) throw new Error('Anfrage zu groß')
  }
  return JSON.parse(body || '{}') as { name?: unknown; password?: unknown }
}

function readCredentials(body: { name?: unknown; password?: unknown }): { name: string; password: string } | string {
  const name = typeof body.name === 'string' ? normalizeName(body.name) : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!NAME_PATTERN.test(name)) return 'Name: 3 bis 24 Zeichen, Buchstaben, Ziffern, Leer- und Satzzeichen'
  if (password.length < 8) return 'Passwort: mindestens 8 Zeichen'
  if (password.length > 200) return 'Passwort: höchstens 200 Zeichen'
  return { name, password }
}

export async function handleAccountRequest(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname.replace(/\/+$/, '') || '/'
  if (!pathname.startsWith('/api/account')) return false
  const action = pathname.split('/').filter(Boolean)[2] ?? ''
  try {
    if (request.method === 'GET' && action === 'me') {
      const account = accountOfRequest(request)
      send(response, 200, { ok: !!account, name: account?.name ?? null })
      return true
    }
    if (request.method === 'POST' && action === 'logout') {
      const token = cookieOf(request, SESSION_COOKIE)
      if (token) db().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
      send(response, 200, { ok: true, message: 'Abgemeldet' }, clearedCookie())
      return true
    }
    if (request.method === 'POST' && (action === 'register' || action === 'login')) {
      const credentials = readCredentials(await bodyOf(request))
      if (typeof credentials === 'string') { send(response, 400, { ok: false, message: credentials }); return true }
      const { name, password } = credentials
      const key = nameKey(name)
      if (action === 'register') {
        const taken = db().prepare('SELECT id FROM users WHERE name_key = ?').get(key)
        if (taken) { send(response, 409, { ok: false, message: 'Diesen Namen gibt es schon' }); return true }
        const salt = randomBytes(16).toString('hex')
        const id = randomUUID()
        db()
          .prepare('INSERT INTO users (id, name, name_key, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(id, name, key, derive(password, salt), salt, Date.now())
        send(response, 201, { ok: true, message: `Konto angelegt · angemeldet als ${name}`, name }, sessionCookie(createSession(id)))
        return true
      }
      const throttleKey = `${key}|${originOf(request)}`
      if (tooManyAttempts(throttleKey)) {
        send(response, 429, { ok: false, message: 'Zu viele Fehlversuche · bitte später erneut probieren' })
        return true
      }
      const user = db()
        .prepare('SELECT id, name, password_hash AS passwordHash, salt FROM users WHERE name_key = ?')
        .get(key) as { id: string; name: string; passwordHash: string; salt: string } | undefined
      // The same answer either way: whether the name or the password was wrong is
      // nothing an unauthenticated caller gets to learn.
      if (!user || !sameHash(derive(password, user.salt), user.passwordHash)) {
        noteFailure(throttleKey)
        send(response, 401, { ok: false, message: 'Name oder Passwort stimmt nicht' })
        return true
      }
      attempts.delete(throttleKey)
      send(response, 200, { ok: true, message: `Angemeldet als ${user.name}`, name: user.name }, sessionCookie(createSession(user.id)))
      return true
    }
    send(response, 405, { ok: false, message: 'Methode nicht erlaubt' })
  } catch (error) {
    send(response, 400, { ok: false, message: error instanceof Error ? error.message : 'Anfrage konnte nicht verarbeitet werden' })
  }
  return true
}

/** For tests and tooling: closes the database so the file can be removed. */
export function closeAccountDatabase(): void {
  closeDatabase()
}
