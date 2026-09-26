import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
import { db as sharedDatabase } from './database.ts'
import { accountOfRequest, ensureAccountsSchema } from './accounts.ts'
import { bodyOf, send } from './saveSlots.ts'
import { emptyProgress, mergeProgress, normalizeProgress, type ProgressRecords } from './progressProtocol.ts'

/**
 * Progress for a signed-in player: one JSON row per account with won scenarios,
 * best grades and achievements. `PUT` merges best-of with what is stored and answers
 * the merged set, so a browser that played offline catches up in one request and
 * two browsers never overwrite each other.
 */
const SCHEMA = {
  name: 'progress',
  ddl: `
    CREATE TABLE IF NOT EXISTS progress (
      user_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `,
}
const MAX_PROGRESS_BYTES = 64 * 1024
const db = (): DatabaseSync => sharedDatabase(SCHEMA)

function storedProgress(userId: string): ProgressRecords {
  const row = db().prepare('SELECT data FROM progress WHERE user_id = ?').get(userId) as { data: string } | undefined
  if (!row) return emptyProgress()
  try {
    return normalizeProgress(JSON.parse(row.data))
  } catch {
    return emptyProgress()
  }
}

export async function handleProgressRequest(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname.replace(/\/+$/, '') || '/'
  if (pathname !== '/api/progress') return false
  ensureAccountsSchema()
  const account = accountOfRequest(request)
  if (!account) {
    send(response, 401, { error: 'Dafür musst du angemeldet sein' })
    return true
  }
  try {
    if (request.method === 'GET') {
      send(response, 200, { records: storedProgress(account.id) })
      return true
    }
    if (request.method === 'PUT') {
      const body = await bodyOf(request, MAX_PROGRESS_BYTES) as { records?: unknown }
      const merged = mergeProgress(storedProgress(account.id), normalizeProgress(body.records))
      db()
        .prepare('INSERT INTO progress (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
        .run(account.id, JSON.stringify(merged), Date.now())
      send(response, 200, { records: merged })
      return true
    }
    send(response, 405, { error: 'Methode nicht erlaubt' })
  } catch (error) {
    send(response, 400, { error: error instanceof Error ? error.message : 'Fortschritt konnte nicht verarbeitet werden' })
  }
  return true
}
