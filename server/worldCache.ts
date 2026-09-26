/**
 * The last authoritative world of a room, kept by the server so a guest can
 * carry the room on when its host is gone for good (host takeover).
 *
 * Pure functions only, and nothing but `import type` from `src/`: this file is
 * loaded at runtime by the Docker image (server + dist, no src), and the client
 * re-exports `mergeVisitorPatches` from `src/net/worldUpdates.ts`, so the merge
 * a guest runs in `GameState.applyNetworkUpdate` and the one the server runs
 * here are the same code — the visitor order decides the host's RNG draws.
 */
import type { WorldSnapshot } from '../src/net/protocol.ts'

/** Above this, a room keeps no world; the chosen guest then falls back to its own mirror. */
export const MAX_CACHED_WORLD_BYTES = 48 * 1024 * 1024

type WireVisitor = { id: string }
type VisitorPatch<V> = { id: string; changes: Partial<V> }

/**
 * Applies one delta's visitor part to an id-keyed map. Removals first, then the
 * patches in wire order: a known visitor is updated in place (and keeps its
 * position), an unknown one is appended. A full sync is not a merge — it
 * replaces the whole list.
 */
export function mergeVisitorPatches<V extends WireVisitor>(
  byId: Map<string, V>,
  patches: ReadonlyArray<VisitorPatch<V>>,
  removed: readonly string[],
): void {
  for (const id of removed) byId.delete(id)
  for (const patch of patches) {
    const existing = byId.get(patch.id)
    if (existing) Object.assign(existing, patch.changes)
    else byId.set(patch.id, patch.changes as V)
  }
}

export type WorldCache = {
  /** Every top-level world field except `visitors`, exactly as the host last sent it. */
  fields: Record<string, unknown>
  /** Visitors in wire order; the map keeps the order a guest's array has. */
  visitors: Map<string, WireVisitor>
  /** Server clock of the last full sync or delta, for the age a takeover reports. */
  updatedAt: number
  /** Length of the last full sync on the wire; the size check is made against it. */
  bytes: number
}

/** The shape a relayed `state` message has on the server side. */
export type CachedDelta = {
  world?: Record<string, unknown>
  visitors?: ReadonlyArray<VisitorPatch<WireVisitor>>
  removed?: readonly string[]
}

/**
 * A full sync replaces whatever was cached. Returns null when the world is too
 * big to keep (or not a world at all), so the room simply has no cache.
 */
export function cacheFromSync(
  world: unknown,
  bytes: number,
  now: number,
  limit = MAX_CACHED_WORLD_BYTES,
): WorldCache | null {
  if (bytes > limit || !world || typeof world !== 'object') return null
  const { visitors, ...fields } = world as Record<string, unknown>
  if (!Array.isArray(visitors)) return null
  const byId = new Map<string, WireVisitor>()
  for (const visitor of visitors as WireVisitor[]) {
    if (visitor && typeof visitor.id === 'string') byId.set(visitor.id, visitor)
  }
  return { fields, visitors: byId, updatedAt: now, bytes }
}

/**
 * Applies a delta the way a guest does: top-level fields are replaced whole,
 * visitors are merged field by field. A delta that alone exceeds the limit
 * drops the cache instead of letting it grow without bound.
 */
export function applyDeltaToCache(
  cache: WorldCache,
  delta: CachedDelta,
  bytes: number,
  now: number,
  limit = MAX_CACHED_WORLD_BYTES,
): WorldCache | null {
  if (bytes > limit) return null
  if (delta.world && typeof delta.world === 'object') {
    const { visitors: _ignored, ...fields } = delta.world
    Object.assign(cache.fields, fields)
  }
  mergeVisitorPatches(
    cache.visitors,
    Array.isArray(delta.visitors) ? delta.visitors : [],
    Array.isArray(delta.removed) ? delta.removed : [],
  )
  cache.updatedAt = now
  return cache
}

/** The cached world as a full sync would carry it. */
export function cachedWorld(cache: WorldCache): WorldSnapshot {
  return { ...cache.fields, visitors: [...cache.visitors.values()] } as unknown as WorldSnapshot
}

/** The simulation tick the cached world stands at. */
export function cachedSimTick(cache: WorldCache): number {
  const tick = cache.fields.simTick
  return typeof tick === 'number' ? tick : 0
}
