import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
import { db as sharedDatabase } from './database.ts'
import { accountOfRequest, ensureAccountsSchema } from './accounts.ts'

/**
 * Saved games, one row each, in the same database the accounts live in.
 *
 * Every save belongs to the account that wrote it. A save can additionally be made
 * public, which lets anyone open it — but only open it: writing always goes to the
 * caller's own rows, so someone who picks up a public festival and saves it ends up
 * with a copy of their own instead of overwriting the original.
 */
export type ServerSaveSlot = {
  id: string
  name: string
  savedAt: number
  public: boolean
  /** The account the save belongs to, shown in the public list. */
  owner: string
  /** Where the festival stood when it was saved; absent on rows from before this was kept. */
  edition?: number
  day?: number
  minute?: number
}
type SaveRow = { id: string; name: string; savedAt: number; isPublic: number; owner: string; userId: string; edition: number | null; day: number | null; minute: number | null }
/** The three numbers that say where a save stands, read off the snapshot as it is written. */
type SaveProgress = { edition: number | null; day: number | null; minute: number | null }

const MAX_SAVE_BYTES = 24 * 1024 * 1024
const SLOTS_PER_USER = 20
const SIGN_IN_REQUIRED = 'Dafür musst du angemeldet sein'

const SCHEMA = {
  name: 'saves',
  ddl: `
    CREATE TABLE IF NOT EXISTS saves (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      saved_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS saves_user ON saves(user_id, saved_at);
    CREATE INDEX IF NOT EXISTS saves_public ON saves(is_public, saved_at);
  `,
}
/** Columns added after the table first shipped; `CREATE TABLE IF NOT EXISTS` leaves an old table as it was. */
const LATER_COLUMNS = ['edition INTEGER', 'day INTEGER', 'minute INTEGER']
const upgraded = new WeakSet<DatabaseSync>()
const db = (): DatabaseSync => {
  const database = sharedDatabase(SCHEMA)
  if (!upgraded.has(database)) {
    const present = new Set((database.prepare('PRAGMA table_info(saves)').all() as { name: string }[]).map((column) => column.name))
    for (const column of LATER_COLUMNS) {
      if (!present.has(column.split(' ')[0]!)) database.exec(`ALTER TABLE saves ADD COLUMN ${column}`)
    }
    upgraded.add(database)
  }
  return database
}

/** Everything about a save except the snapshot itself, which is far too big to list. */
const SELECT_SLOT = `
  SELECT saves.id AS id, saves.name AS name, saves.saved_at AS savedAt,
         saves.is_public AS isPublic, saves.user_id AS userId, users.name AS owner,
         saves.edition AS edition, saves.day AS day, saves.minute AS minute
  FROM saves JOIN users ON users.id = saves.user_id
`

const publicSlot = (row: SaveRow): ServerSaveSlot => ({
  id: row.id, name: row.name, savedAt: row.savedAt, public: row.isPublic === 1, owner: row.owner,
  ...(row.edition === null ? {} : { edition: row.edition }),
  ...(row.day === null ? {} : { day: row.day }),
  ...(row.minute === null ? {} : { minute: row.minute }),
})

function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 40) : ''
}

function readSnapshot(value: unknown): { snapshot: string; progress: SaveProgress } {
  if (typeof value !== 'string' || !value) throw new Error('Name und Spielstand sind erforderlich')
  if (Buffer.byteLength(value, 'utf8') > MAX_SAVE_BYTES) throw new Error('Spielstand ist zu groß')
  let parsed: { festival?: { edition?: unknown }; day?: unknown; minute?: unknown }
  try { parsed = JSON.parse(value) } catch { throw new Error('Spielstand ist ungültig') }
  const number = (candidate: unknown): number | null => typeof candidate === 'number' && Number.isFinite(candidate) ? Math.floor(candidate) : null
  return {
    snapshot: value,
    progress: { edition: number(parsed?.festival?.edition), day: number(parsed?.day), minute: number(parsed?.minute) },
  }
}

/** The saves of one account, newest first. */
function ownSlots(userId: string): ServerSaveSlot[] {
  return (db().prepare(`${SELECT_SLOT} WHERE saves.user_id = ? ORDER BY saves.saved_at DESC`).all(userId) as SaveRow[])
    .map(publicSlot)
}

/**
 * Everything other people have shared. Your own public saves stay out of it — they
 * already stand in your own list, marked as shared.
 */
function sharedSlots(userId: string | null): ServerSaveSlot[] {
  const rows = userId
    ? db().prepare(`${SELECT_SLOT} WHERE saves.is_public = 1 AND saves.user_id <> ? ORDER BY saves.saved_at DESC`).all(userId)
    : db().prepare(`${SELECT_SLOT} WHERE saves.is_public = 1 ORDER BY saves.saved_at DESC`).all()
  return (rows as SaveRow[]).map(publicSlot)
}

const slotRow = (id: string): SaveRow | undefined =>
  db().prepare(`${SELECT_SLOT} WHERE saves.id = ?`).get(id) as SaveRow | undefined

async function bodyOf(request: IncomingMessage): Promise<unknown> {
  let body = ''
  for await (const chunk of request) {
    body += String(chunk)
    if (Buffer.byteLength(body, 'utf8') > MAX_SAVE_BYTES + 1024 * 64) throw new Error('Anfrage zu groß')
  }
  return JSON.parse(body || '{}')
}

function send(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(payload))
}

/**
 * JSON API for saved games. Opening a public save needs nothing; everything else
 * needs an account, because every row has an owner.
 */
export async function handleSaveRequest(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname.replace(/\/+$/, '') || '/'
  if (!pathname.startsWith('/api/saves')) return false
  const parts = pathname.split('/').filter(Boolean)
  const id = parts[2]
  ensureAccountsSchema()
  const account = accountOfRequest(request)
  /** The caller's own id, or an end to the request: rows without an owner cannot exist. */
  const mine = (): string => {
    if (!account) throw new Error(SIGN_IN_REQUIRED)
    return account.id
  }
  try {
    if (request.method === 'GET' && parts.length === 2) {
      send(response, 200, {
        account: account?.name ?? null,
        own: account ? ownSlots(account.id) : [],
        shared: sharedSlots(account?.id ?? null),
      })
      return true
    }
    if (request.method === 'GET' && id) {
      const row = slotRow(id)
      if (!row || (row.isPublic !== 1 && row.userId !== account?.id)) { send(response, 404, { error: 'Nicht gefunden' }); return true }
      const stored = db().prepare('SELECT snapshot FROM saves WHERE id = ?').get(id) as { snapshot: string }
      send(response, 200, { ...publicSlot(row), snapshot: stored.snapshot })
      return true
    }
    if (request.method === 'POST' && parts.length === 2) {
      const userId = mine()
      const body = await bodyOf(request) as { name?: unknown; snapshot?: unknown; public?: unknown }
      const name = cleanName(body.name)
      if (!name) { send(response, 400, { error: 'Name und Spielstand sind erforderlich' }); return true }
      const { snapshot, progress } = readSnapshot(body.snapshot)
      const { n } = db().prepare('SELECT COUNT(*) AS n FROM saves WHERE user_id = ?').get(userId) as { n: number }
      if (n >= SLOTS_PER_USER) { send(response, 409, { error: `Maximal ${SLOTS_PER_USER} Spielstände je Konto` }); return true }
      const slotId = randomUUID()
      db()
        .prepare('INSERT INTO saves (id, user_id, name, snapshot, is_public, saved_at, edition, day, minute) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(slotId, userId, name, snapshot, body.public === true ? 1 : 0, Date.now(), progress.edition, progress.day, progress.minute)
      send(response, 201, publicSlot(slotRow(slotId)!))
      return true
    }
    // Writing only ever touches your own rows. A public save someone else made is
    // readable and nothing more, so loading one and saving leaves the original alone
    // and puts a copy in the loader's own archive.
    if ((request.method === 'PUT' || request.method === 'PATCH') && id) {
      const userId = mine()
      const row = slotRow(id)
      if (!row || row.userId !== userId) { send(response, 404, { error: 'Nicht gefunden' }); return true }
      const body = await bodyOf(request) as { name?: unknown; snapshot?: unknown; public?: unknown }
      if (request.method === 'PATCH') {
        if (typeof body.public !== 'boolean') { send(response, 400, { error: 'Sichtbarkeit fehlt' }); return true }
        db().prepare('UPDATE saves SET is_public = ? WHERE id = ?').run(body.public ? 1 : 0, id)
        send(response, 200, publicSlot(slotRow(id)!))
        return true
      }
      const name = cleanName(body.name)
      if (!name) { send(response, 400, { error: 'Name und Spielstand sind erforderlich' }); return true }
      const { snapshot, progress } = readSnapshot(body.snapshot)
      db().prepare('UPDATE saves SET name = ?, snapshot = ?, saved_at = ?, edition = ?, day = ?, minute = ? WHERE id = ?')
        .run(name, snapshot, Date.now(), progress.edition, progress.day, progress.minute, id)
      send(response, 200, publicSlot(slotRow(id)!))
      return true
    }
    if (request.method === 'DELETE' && id) {
      const userId = mine()
      const row = slotRow(id)
      if (!row || row.userId !== userId) { send(response, 404, { error: 'Nicht gefunden' }); return true }
      db().prepare('DELETE FROM saves WHERE id = ?').run(id)
      send(response, 200, { ok: true })
      return true
    }
    send(response, 405, { error: 'Methode nicht erlaubt' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Spielstand konnte nicht verarbeitet werden'
    send(response, message === SIGN_IN_REQUIRED ? 401 : 400, { error: message })
  }
  return true
}
