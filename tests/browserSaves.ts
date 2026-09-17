import assert from 'node:assert/strict'
import { SAVE_KEY, SAVE_SLOTS_KEY } from '../src/game/catalog'
import { GameState } from '../src/game/GameState'
import { listServerSaves, saveServerSave } from '../src/game/serverSaves'
import { serializeSnapshot } from '../src/game/saveText'

type MemoryStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

function memoryStorage(quotaBytes = Number.POSITIVE_INFINITY): { map: Map<string, string>; storage: MemoryStorage } {
  const map = new Map<string, string>()
  return {
    map,
    storage: {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => {
        const extra = value.length - (map.get(key)?.length ?? 0)
        let used = 0
        for (const item of map.values()) used += item.length
        if (used + extra > quotaBytes) {
          const error = new Error('QuotaExceededError')
          error.name = 'QuotaExceededError'
          throw error
        }
        map.set(key, value)
      },
      removeItem: (key) => { map.delete(key) },
    },
  }
}

function withStorage<T>(storage: MemoryStorage, run: () => T): T {
  const previous = globalThis.localStorage
  Object.assign(globalThis, { localStorage: storage })
  try { return run() }
  finally { Object.assign(globalThis, { localStorage: previous }) }
}

export function testBrowserSaves(fixture: (count?: number) => GameState): void {
  const { storage } = memoryStorage()
  withStorage(storage, () => {
    const game = fixture(4)
    assert.ok(game.snapshot.visitors.length >= 4)
    assert.ok(game.snapshot.buildings.length >= 2)
    const visitors = game.snapshot.visitors.length
    const buildings = game.snapshot.buildings.length
    const staff = game.snapshot.staff.length

    assert.equal(game.save().ok, true, 'quicksave writes the full snapshot')
    const quick = GameState.load()!
    assert.equal(quick.snapshot.visitors.length, visitors)
    assert.equal(quick.snapshot.buildings.length, buildings)
    assert.equal(quick.snapshot.staff.length, staff)

    assert.equal(game.saveSlot('Samstag mit Gästen').ok, true)
    const slots = GameState.listSaveSlots()
    assert.equal(slots.length, 1)
    assert.equal(slots[0]!.name, 'Samstag mit Gästen')
    const loaded = GameState.loadSlot(slots[0]!.id)!
    assert.equal(loaded.snapshot.visitors.length, visitors, 'named slot keeps every visitor')
    assert.equal(loaded.snapshot.buildings.length, buildings, 'named slot keeps every building')
    assert.equal(loaded.snapshot.staff.length, staff)

    const quickAgain = GameState.load()!
    assert.equal(quickAgain.snapshot.visitors.length, visitors, 'quicksave still works after a named slot')
  })

  const { storage: listing } = memoryStorage()
  withStorage(listing, () => {
    listing.setItem(SAVE_SLOTS_KEY, JSON.stringify([
      { id: 'legacy-ok', name: 'Alt und gültig', savedAt: 2, snapshot: serializeSnapshot(fixture(1).snapshot) },
      { id: 'broken-meta', name: 'Kaputter Snapshot', savedAt: 1, snapshot: '{not-json' },
    ]))
    const listed = GameState.listSaveSlots()
    assert.deepEqual(listed.map((slot) => slot.id).sort(), ['broken-meta', 'legacy-ok'], 'listing does not construct GameState, so a broken snapshot stays visible')
    assert.ok(GameState.loadSlot('legacy-ok'))
    assert.equal(GameState.loadSlot('broken-meta'), null)
  })

  const { storage: quota } = memoryStorage(32)
  withStorage(quota, () => {
    quota.setItem(SAVE_KEY, 'tiny')
    const result = fixture(2).save()
    assert.equal(result.ok, false)
    assert.match(result.message, /voll|nicht verfügbar|fehlgeschlagen/i)
    assert.equal(quota.getItem(SAVE_KEY), 'tiny', 'a failed quicksave must not wipe the previous stand')
  })
}

export async function testServerSaveClient(): Promise<void> {
  const previous = globalThis.fetch
  try {
    globalThis.fetch = (async () => new Response('<!doctype html><title>Vite</title>', { status: 200 })) as typeof fetch
    await assert.rejects(listServerSaves(), /keine JSON-Antwort/)

    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    await assert.rejects(listServerSaves(), /Kein Kontakt zum Spielserver/)

    globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'Dafür musst du angemeldet sein' }), { status: 401 })) as typeof fetch
    await assert.rejects(saveServerSave('Test', '{"buildings":[],"visitors":[]}'), /anmelden/)

    globalThis.fetch = (async () => new Response(JSON.stringify({ account: null }), { status: 200 })) as typeof fetch
    assert.deepEqual(await listServerSaves(), { account: null, own: [], shared: [] }, 'a partial list payload does not crash')
  } finally {
    globalThis.fetch = previous
  }
}
