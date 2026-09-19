import { mkdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The one SQLite file the server keeps: accounts, their sessions and their saved
 * games, side by side in `data/`. One connection is shared by every module that
 * needs it, and each of them brings its own tables along.
 */

/**
 * Where the database lives. Read when it is first opened, not when this module
 * loads, so a test can point HEADLINER_DATA_DIR at a directory of its own.
 */
const dataDirectory = (): string =>
  process.env.HEADLINER_DATA_DIR
    ? resolve(process.env.HEADLINER_DATA_DIR)
    : resolve(fileURLToPath(new URL('../data', import.meta.url)))

/**
 * Whether the database can be opened where it is pointed, as a message or null.
 * Called at boot so an unwritable directory is said once, plainly, instead of
 * surfacing as a failed request much later.
 */
export function storageProblem(): string | null {
  const directory = dataDirectory()
  try {
    mkdirSync(directory, { recursive: true })
    return null
  } catch (error) {
    return `${directory}: ${(error as Error).message}`
  }
}

export type Schema = { name: string; ddl: string }

let database: DatabaseSync | null = null
const applied = new Set<string>()

/**
 * The shared connection, with the caller's tables in place. The schema statements
 * are all `IF NOT EXISTS` and run once per open connection, so asking for the
 * database is enough — there is no separate setup step to forget.
 */
export function db(schema: Schema): DatabaseSync {
  if (!database) {
    const directory = dataDirectory()
    mkdirSync(directory, { recursive: true })
    database = new DatabaseSync(resolve(directory, 'accounts.db'))
    database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
    applied.clear()
  }
  if (!applied.has(schema.name)) {
    database.exec(schema.ddl)
    applied.add(schema.name)
  }
  return database
}

/** For tests and tooling: closes the database so the file can be removed. */
export function closeDatabase(): void {
  database?.close()
  database = null
  applied.clear()
}
