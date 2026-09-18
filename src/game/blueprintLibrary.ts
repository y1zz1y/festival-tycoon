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
import { createBrowserObjectStore, isQuotaError } from './browserPersistence'
const DB_NAME = 'headliner-tycoon-blueprints'
const DB_VERSION = 1
const STORE = 'library'
const IDB_LIST_KEY = 'index'
const libraryStore = createBrowserObjectStore(DB_NAME, DB_VERSION, STORE)

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
    const stored = await libraryStore.get<BlueprintLibraryEntry[]>(IDB_LIST_KEY)
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
    await libraryStore.put(IDB_LIST_KEY, next)
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
    await libraryStore.put(IDB_LIST_KEY, next)
  } catch {
    /* ignore */
  }
}

export async function loadBlueprintLibraryEntry(id: string): Promise<BlueprintLibraryEntry | null> {
  return (await listBlueprintLibrary()).find((entry) => entry.id === id) ?? null
}
