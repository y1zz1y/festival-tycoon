/**
 * Overflow store for snapshots that do not fit in localStorage (~5 MB).
 * Quicksave and named slots stay in localStorage when they fit; otherwise
 * IndexedDB holds the JSON. Listing never opens a snapshot, so a heavy world
 * cannot empty the archive.
 */
import { SAVE_KEY, saveSlotDataKey } from './catalog'
import { createBrowserObjectStore, isQuotaError } from './browserPersistence'

const DB_NAME = 'headliner-tycoon-saves'
const DB_VERSION = 1
const STORE = 'snapshots'
const QUICK_IDB_KEY = 'quicksave'
const QUICK_VIA_KEY = `${SAVE_KEY}:via`
const overflowStore = createBrowserObjectStore(
  DB_NAME,
  DB_VERSION,
  STORE,
  'Erweiterter Browser-Speicher ist hier nicht verfügbar',
)

export const readOverflowSnapshot = (key: string): Promise<string | null> =>
  overflowStore.get<string>(key)
    .then((value) => (typeof value === 'string' && value ? value : null))
    .catch(() => null)

export const writeOverflowSnapshot = (key: string, json: string): Promise<void> =>
  overflowStore.put(key, json)

export const deleteOverflowSnapshot = (key: string): Promise<void> =>
  overflowStore.delete(key).catch(() => undefined)

export async function writeQuicksaveJson(json: string): Promise<void> {
  try {
    localStorage.setItem(SAVE_KEY, json)
    try { localStorage.removeItem(QUICK_VIA_KEY) } catch { /* pointer is optional */ }
  } catch (error) {
    if (!isQuotaError(error)) throw error
    await writeOverflowSnapshot(QUICK_IDB_KEY, json)
    try {
      localStorage.removeItem(SAVE_KEY)
      localStorage.setItem(QUICK_VIA_KEY, 'idb')
    } catch { /* IndexedDB already holds the new stand */ }
  }
}

export async function readQuicksaveJson(): Promise<string | null> {
  try {
    if (localStorage.getItem(QUICK_VIA_KEY) === 'idb') {
      return await readOverflowSnapshot(QUICK_IDB_KEY)
    }
  } catch { /* fall through */ }
  try {
    const local = localStorage.getItem(SAVE_KEY)
    if (local) return local
  } catch { /* fall through */ }
  return readOverflowSnapshot(QUICK_IDB_KEY)
}

export async function writeNamedSlotJson(id: string, json: string): Promise<void> {
  const key = saveSlotDataKey(id)
  try {
    localStorage.setItem(key, json)
    await deleteOverflowSnapshot(key)
  } catch (error) {
    if (!isQuotaError(error)) throw error
    await writeOverflowSnapshot(key, json)
    try { localStorage.removeItem(key) } catch { /* overflow copy is enough */ }
  }
}

export async function readNamedSlotJson(id: string): Promise<string | null> {
  const key = saveSlotDataKey(id)
  try {
    const local = localStorage.getItem(key)
    if (local) return local
  } catch { /* fall through */ }
  return readOverflowSnapshot(key)
}

export const deleteNamedSlotJson = (id: string): Promise<void> =>
  deleteOverflowSnapshot(saveSlotDataKey(id))
