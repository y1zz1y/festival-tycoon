import { findRoadRoute, createRoadGraph, type BusStop, type RoadCell, type RoadGraph, type RoadPosition } from './logistics'
import { WORLD_SIZE } from './catalog'

const UNREACHABLE_HOP = 10_000

export type BusPlannerColumn = 'available' | 'active'

export type BusPlannerDrag = {
  source: BusPlannerColumn
  stopId: string
  target: BusPlannerColumn
  /** Insertion index in the current active list (before the move). */
  at?: number
}

export type BusPlannerLists = {
  available: string[]
  active: string[]
}

export type BusPlannerStopMarker = {
  stopId: string
  index: number
  x: number
  z: number
  elevation?: number
  lineId?: string
}

export function splitBusPlannerStops(
  allStopIds: readonly string[],
  activeIds: readonly string[],
): BusPlannerLists {
  const known = new Set(allStopIds)
  const active: string[] = []
  const seen = new Set<string>()
  for (const id of activeIds) {
    if (!known.has(id) || seen.has(id)) continue
    seen.add(id)
    active.push(id)
  }
  return {
    available: allStopIds.filter((id) => !seen.has(id)),
    active,
  }
}

export function plannerListsShareNoStop(lists: BusPlannerLists): boolean {
  const seen = new Set<string>()
  for (const id of [...lists.available, ...lists.active]) {
    if (seen.has(id)) return false
    seen.add(id)
  }
  return true
}

export function moveActiveStop(
  activeIds: readonly string[],
  from: number,
  at: number,
): string[] {
  if (from < 0 || from >= activeIds.length) return [...activeIds]
  let insert = at
  if (insert < 0) insert = 0
  if (insert > activeIds.length) insert = activeIds.length
  if (from === insert || from + 1 === insert) return [...activeIds]
  const next = [...activeIds]
  const [item] = next.splice(from, 1)
  if (!item) return [...activeIds]
  next.splice(from < insert ? insert - 1 : insert, 0, item)
  return next
}

export function applyBusPlannerDrag(
  allStopIds: readonly string[],
  activeIds: readonly string[],
  drag: BusPlannerDrag,
): BusPlannerLists {
  const lists = splitBusPlannerStops(allStopIds, activeIds)
  const { stopId, source, target } = drag
  if (source === 'available' && target === 'available') return lists
  if (source === 'available' && target === 'active') {
    if (!lists.available.includes(stopId)) return lists
    const active = lists.active.slice()
    const at = drag.at ?? active.length
    active.splice(Math.max(0, Math.min(at, active.length)), 0, stopId)
    return splitBusPlannerStops(allStopIds, active)
  }
  if (source === 'active' && target === 'available') {
    return splitBusPlannerStops(
      allStopIds,
      lists.active.filter((id) => id !== stopId),
    )
  }
  const from = lists.active.indexOf(stopId)
  if (from < 0) return lists
  return splitBusPlannerStops(
    allStopIds,
    moveActiveStop(lists.active, from, drag.at ?? lists.active.length),
  )
}

export function previewBusLineMarkers(
  stops: readonly BusStop[],
  stopIds: readonly string[],
  lineId?: string,
): BusPlannerStopMarker[] {
  const markers: BusPlannerStopMarker[] = []
  const seen = new Set<string>()
  for (const stopId of stopIds) {
    if (seen.has(stopId)) continue
    const stop = stops.find((candidate) => candidate.id === stopId)
    if (!stop) continue
    seen.add(stopId)
    markers.push({
      stopId,
      index: markers.length + 1,
      x: stop.x,
      z: stop.z,
      elevation: stop.elevation,
      lineId,
    })
  }
  return markers
}

function hopKey(fromId: string, toId: string): string {
  return `${fromId}>${toId}`
}

function hopLength(
  from: RoadPosition,
  to: RoadPosition,
  options: {
    roadCells: readonly RoadCell[]
    graph: RoadGraph
    worldSize: number
  },
): number {
  if (
    from.x === to.x &&
    from.z === to.z &&
    (from.elevation ?? 0) === (to.elevation ?? 0)
  ) {
    return 0
  }
  const route = findRoadRoute({
    roadCells: options.roadCells,
    graph: options.graph,
    start: from,
    target: to,
    worldSize: options.worldSize,
  })
  if (route && route.length > 0) return route.length
  return UNREACHABLE_HOP + Math.abs(from.x - to.x) + Math.abs(from.z - to.z)
}

function orderedStops(
  stops: readonly BusStop[],
  stopIds: readonly string[],
): BusStop[] {
  const seen = new Set<string>()
  const ordered: BusStop[] = []
  for (const stopId of stopIds) {
    if (seen.has(stopId)) continue
    const stop = stops.find((candidate) => candidate.id === stopId)
    if (!stop) continue
    seen.add(stopId)
    ordered.push(stop)
  }
  return ordered
}

export function busLineLoopLength(
  options: {
    roadCells: readonly RoadCell[]
    stops: readonly BusStop[]
    stopIds: readonly string[]
    graph?: RoadGraph
    worldSize?: number
  },
): number {
  const worldSize = options.worldSize ?? WORLD_SIZE
  const graph = options.graph ?? createRoadGraph(options.roadCells, worldSize)
  const ordered = orderedStops(options.stops, options.stopIds)
  if (ordered.length < 2) return 0
  const hops = { roadCells: options.roadCells, graph, worldSize }
  let total = 0
  for (let index = 0; index < ordered.length; index += 1) {
    const from = ordered[index]!
    const to = ordered[(index + 1) % ordered.length]!
    total += hopLength(from.roadCell, to.roadCell, hops)
  }
  return total
}

function cycleLength(ids: readonly string[], distance: (from: string, to: string) => number): number {
  if (ids.length < 2) return 0
  let total = 0
  for (let index = 0; index < ids.length; index += 1) {
    total += distance(ids[index]!, ids[(index + 1) % ids.length]!)
  }
  return total
}

function nearestNeighborTour(
  ids: readonly string[],
  startId: string,
  distance: (from: string, to: string) => number,
): string[] {
  const remaining = ids.filter((id) => id !== startId).sort((left, right) => left.localeCompare(right))
  const tour = [startId]
  while (remaining.length > 0) {
    const current = tour[tour.length - 1]!
    let bestIndex = 0
    let bestDistance = Number.POSITIVE_INFINITY
    let bestId = remaining[0]!
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index]!
      const hop = distance(current, candidate)
      if (hop < bestDistance || (hop === bestDistance && candidate.localeCompare(bestId) < 0)) {
        bestDistance = hop
        bestId = candidate
        bestIndex = index
      }
    }
    tour.push(remaining.splice(bestIndex, 1)[0]!)
  }
  return tour
}

function twoOptTour(
  ids: readonly string[],
  distance: (from: string, to: string) => number,
): string[] {
  const tour = [...ids]
  if (tour.length < 4) return tour
  let improved = true
  while (improved) {
    improved = false
    const currentLength = cycleLength(tour, distance)
    for (let left = 1; left < tour.length - 1; left += 1) {
      for (let right = left + 1; right < tour.length; right += 1) {
        const next = [
          ...tour.slice(0, left),
          ...tour.slice(left, right + 1).reverse(),
          ...tour.slice(right + 1),
        ]
        const nextLength = cycleLength(next, distance)
        if (nextLength + 1e-9 < currentLength) {
          tour.splice(0, tour.length, ...next)
          improved = true
          break
        }
      }
      if (improved) break
    }
  }
  return tour
}

export function sortBusLineStops(options: {
  roadCells: readonly RoadCell[]
  stops: readonly BusStop[]
  stopIds: readonly string[]
  graph?: RoadGraph
  worldSize?: number
  depotAccess?: RoadPosition
}): string[] {
  const ordered = orderedStops(options.stops, options.stopIds)
  if (ordered.length < 2) return ordered.map((stop) => stop.id)
  const worldSize = options.worldSize ?? WORLD_SIZE
  const graph = options.graph ?? createRoadGraph(options.roadCells, worldSize)
  const hops = { roadCells: options.roadCells, graph, worldSize }
  const hopCache = new Map<string, number>()
  const distance = (fromId: string, toId: string): number => {
    const key = hopKey(fromId, toId)
    const cached = hopCache.get(key)
    if (cached !== undefined) return cached
    const from = ordered.find((stop) => stop.id === fromId)
    const to = ordered.find((stop) => stop.id === toId)
    const length =
      from && to ? hopLength(from.roadCell, to.roadCell, hops) : UNREACHABLE_HOP
    hopCache.set(key, length)
    return length
  }
  let start = ordered[0]!
  if (options.depotAccess) {
    let bestDistance = Number.POSITIVE_INFINITY
    for (const stop of ordered) {
      const length = hopLength(options.depotAccess, stop.roadCell, hops)
      if (
        length < bestDistance ||
        (length === bestDistance && stop.id.localeCompare(start.id) < 0)
      ) {
        bestDistance = length
        start = stop
      }
    }
  }
  const ids = ordered.map((stop) => stop.id)
  const seeded = nearestNeighborTour(ids, start.id, distance)
  return twoOptTour(seeded, distance)
}
