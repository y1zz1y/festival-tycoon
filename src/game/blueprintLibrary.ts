/**
 * Personal build library. Lives in the browser (localStorage + IndexedDB),
 * never in git and never in a park snapshot / SAVE_KEY slot.
 */
import { BLUEPRINT_LIBRARY_KEY } from './catalog'
import {
  normalizeBlueprint,
  type Blueprint,
  type BlueprintLibraryEntry,
} from './blueprints'
import { isQuotaError } from './saveText'
const DB_NAME = 'headliner-tycoon-blueprints'
const DB_VERSION = 1
const STORE = 'library'
const IDB_LIST_KEY = 'index'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB nicht verfügbar'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB nicht verfügbar'))
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
  })
}

function idbRequest<T>(run: (store: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const request = run(tx.objectStore(STORE))
        request.onerror = () => reject(request.error ?? new Error('IndexedDB-Zugriff fehlgeschlagen'))
        request.onsuccess = () => resolve(request.result)
        tx.oncomplete = () => db.close()
        tx.onabort = () => {
          db.close()
          reject(tx.error ?? new Error('IndexedDB-Transaktion abgebrochen'))
        }
      }),
  )
}

function normalizeEntry(raw: unknown): BlueprintLibraryEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Partial<BlueprintLibraryEntry>
  const blueprint = normalizeBlueprint(data.blueprint)
  if (!blueprint || !data.id || !data.name) return null
  return {
    id: String(data.id),
    name: String(data.name).trim().replace(/\s+/g, ' ').slice(0, 40) || 'Ohne Namen',
    createdAt: Number(data.createdAt) || 0,
    blueprint,
  }
}

function readLocalList(): BlueprintLibraryEntry[] {
  try {
    const raw = localStorage.getItem(BLUEPRINT_LIBRARY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeEntry).filter((entry): entry is BlueprintLibraryEntry => Boolean(entry))
  } catch {
    return []
  }
}

function writeLocalList(entries: BlueprintLibraryEntry[]): void {
  localStorage.setItem(BLUEPRINT_LIBRARY_KEY, JSON.stringify(entries))
}

export function listBlueprintLibrarySync(): BlueprintLibraryEntry[] {
  return readLocalList().sort((a, b) => b.createdAt - a.createdAt)
}

export async function listBlueprintLibrary(): Promise<BlueprintLibraryEntry[]> {
  const local = listBlueprintLibrarySync()
  try {
    const stored = await idbRequest<BlueprintLibraryEntry[] | undefined>((store) => store.get(IDB_LIST_KEY), 'readonly')
    if (!Array.isArray(stored) || stored.length === 0) return local
    const merged = new Map<string, BlueprintLibraryEntry>()
    for (const entry of [...stored, ...local].map(normalizeEntry)) {
      if (entry) merged.set(entry.id, entry)
    }
    return [...merged.values()].sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return local
  }
}

export async function saveBlueprintLibraryEntry(
  name: string,
  blueprint: Blueprint,
  id = `bp-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
): Promise<BlueprintLibraryEntry> {
  const entry: BlueprintLibraryEntry = {
    id,
    name: name.trim().replace(/\s+/g, ' ').slice(0, 40) || 'Ohne Namen',
    createdAt: Date.now(),
    blueprint: normalizeBlueprint(blueprint) ?? { version: 1, width: 0, depth: 0, items: [] },
  }
  const current = await listBlueprintLibrary()
  const next = [entry, ...current.filter((item) => item.id !== entry.id)]
  try {
    writeLocalList(next)
  } catch (error) {
    if (!isQuotaError(error)) throw error
  }
  try {
    await idbRequest((store) => store.put(next, IDB_LIST_KEY), 'readwrite')
  } catch {
    /* localStorage is enough when IDB is missing */
  }
  return entry
}

export async function deleteBlueprintLibraryEntry(id: string): Promise<void> {
  const next = (await listBlueprintLibrary()).filter((entry) => entry.id !== id)
  try {
    writeLocalList(next)
  } catch {
    /* still try IDB */
  }
  try {
    await idbRequest((store) => store.put(next, IDB_LIST_KEY), 'readwrite')
  } catch {
    /* ignore */
  }
}

export async function loadBlueprintLibraryEntry(id: string): Promise<BlueprintLibraryEntry | null> {
  return (await listBlueprintLibrary()).find((entry) => entry.id === id) ?? null
}
