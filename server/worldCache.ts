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

/** A plain JSON object — not null, not an array, not a string or number. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Applies one delta's visitor part to an id-keyed map. Removals first, then the
 * patches in wire order: a known visitor is updated in place (and keeps its
 * position), an unknown one is appended. A full sync is not a merge — it
 * replaces the whole list.
 *
 * The server runs this on whatever a host sent, before anyone checked it. A
 * patch that is not an object with a string id and object changes is skipped,
 * and an entry that is no object is replaced instead of merged into: one bad
 * message must never throw out of here and take the whole server down. What a
 * real host sends is never affected.
 */
export function mergeVisitorPatches<V extends WireVisitor>(
  byId: Map<string, V>,
  patches: ReadonlyArray<VisitorPatch<V>>,
  removed: readonly string[],
): void {
  for (const id of removed) byId.delete(id)
  for (const patch of patches) {
    if (!isRecord(patch) || typeof patch.id !== 'string' || !isRecord(patch.changes)) continue
    const existing = byId.get(patch.id)
    if (isRecord(existing)) Object.assign(existing, patch.changes)
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
  /** Size of the copy when it was last measured: the full sync's length, or a re-measure. */
  bytes: number
  /**
   * Delta bytes applied since that measurement. A delta can grow the copy by at
   * most its own length, so `bytes + unmeasured` bounds the real size from above
   * without serialising anything.
   */
  unmeasured: number
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
  return { fields, visitors: byId, updatedAt: now, bytes, unmeasured: 0 }
}

/**
 * Applies a delta the way a guest does: top-level fields are replaced whole,
 * visitors are merged field by field. The limit holds for the copy as a whole,
 * not just per message: deltas that keep adding visitors or swapping in bigger
 * fields would otherwise grow it without bound. Every delta adds its length to
 * an upper bound; only once that bound passes the limit is the copy measured
 * for real (one `JSON.stringify`, every few seconds on a big park), and dropped
 * if it really is too big. Returns null when the room keeps no copy any more.
 */
export function applyDeltaToCache(
  cache: WorldCache,
  delta: CachedDelta,
  bytes: number,
  now: number,
  limit = MAX_CACHED_WORLD_BYTES,
): WorldCache | null {
  if (bytes > limit || !isRecord(delta)) return null
  if (isRecord(delta.world)) {
    const { visitors: _ignored, ...fields } = delta.world
    Object.assign(cache.fields, fields)
  }
  mergeVisitorPatches(
    cache.visitors,
    Array.isArray(delta.visitors) ? delta.visitors : [],
    Array.isArray(delta.removed) ? delta.removed : [],
  )
  cache.updatedAt = now
  cache.unmeasured += bytes
  if (cache.bytes + cache.unmeasured <= limit) return cache
  cache.bytes = JSON.stringify(cachedWorld(cache)).length
  cache.unmeasured = 0
  return cache.bytes > limit ? null : cache
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
