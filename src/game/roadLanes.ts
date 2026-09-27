/**
 * Two-lane roads derived from the road layout (docs/logistics.md, "Fahrspuren").
 *
 * Nothing here is stored: every role follows from which road tiles touch. Two parallel
 * road tiles form a two-lane road, each tile one lane with right-hand traffic; 2×2
 * blocks where roads meet are knots with free movement, wider areas are plazas,
 * one-tile-wide roads stay bidirectional, and the map entry stub has three inbound and
 * three outbound lanes. Pure and deterministic; it runs when the road graph is rebuilt
 * (every road edit), never per tick.
 */
import type { Direction, RoadCell } from './logistics'
import { canTraverseWayElevation, packWayElevation } from './wayElevation'

export type LaneAxis = 'x' | 'z'

/** Knot extent in tiles, inclusive. */
export type LaneBlock = { minX: number; minZ: number; maxX: number; maxZ: number }

type RoleMasks = {
  /** Directions a vehicle may leave the tile in (bit per direction). */
  leave: number
  /** Directions a vehicle may move in while entering the tile. */
  enter: number
}

export type LaneRole = RoleMasks & (
  | {
      /** One lane of a two-lane road. `end` = dead end: turning into the partner is allowed. */
      kind: 'lane'
      direction: Direction
      axis: LaneAxis
      end: boolean
      /** Side of the tile where the partner lane lies (the centre line). */
      partner: Direction
    }
  | {
      /** Junction box or corner block: one-way circulation inside a 2×2, free otherwise. */
      kind: 'knot'
      exits: number
      /** Bit per side of the knot that has a road leaving it. */
      exitMask: number
      block: LaneBlock
      /** Layer keys of every tile of this knot (shared array). */
      tiles: readonly string[]
    }
  | { kind: 'plaza' }
  | { kind: 'single'; axis: LaneAxis }
  | {
      /** Map entry stub. `open`: the stub is not joined by lanes on both sides, so it keeps free movement. */
      kind: 'entry'
      direction: Direction
      open: boolean
    }
)

export type RoadLaneLayout = {
  readonly worldSize: number
  roleOf(cell: RoadCell): LaneRole | undefined
  /** Road tiles physically joined to `cell` in `direction`, ignoring one-way bits. */
  linksOf(cell: RoadCell, direction: Direction): readonly RoadCell[]
}

const OFFSETS: readonly (readonly [number, number])[] = [[0, 1], [1, 0], [0, -1], [-1, 0]]
const ALL = 15
const FREE: RoleMasks = { leave: ALL, enter: ALL }
/** x range of the map entry stub; inbound lanes are x < 0, outbound x ≥ 0. */
export const ENTRY_MIN_X = -3
export const ENTRY_MAX_X = 2

const bit = (direction: number): number => 1 << direction
const opposite = (direction: number): Direction => ((direction + 2) % 4) as Direction
const layerKey = (cell: RoadCell): string =>
  `${cell.x}:${cell.z}:${packWayElevation(cell.elevation ?? 0)}`

export function isEntryStubPosition(x: number, z: number, worldSize: number): boolean {
  return z === -worldSize / 2 && x >= ENTRY_MIN_X && x <= ENTRY_MAX_X
}

/** Leaving `cell` in `direction`; explicit player one-way bits win over the derived rule. */
export function canLeaveRoadCell(layout: RoadLaneLayout, cell: RoadCell, direction: Direction): boolean {
  if (cell.allowedDirections !== null) return (cell.allowedDirections & bit(direction)) !== 0
  return ((layout.roleOf(cell)?.leave ?? ALL) & bit(direction)) !== 0
}

/** Entering `cell` while moving in `direction`. */
export function canEnterRoadCell(layout: RoadLaneLayout, cell: RoadCell, direction: Direction): boolean {
  if (cell.allowedDirections !== null) {
    // A one-way pointing back at us, which does not let us carry on, is closed.
    return !(
      (cell.allowedDirections & bit(opposite(direction))) !== 0 &&
      (cell.allowedDirections & bit(direction)) === 0
    )
  }
  return ((layout.roleOf(cell)?.enter ?? ALL) & bit(direction)) !== 0
}

/** Facing a lane the wrong way (old saves, a reversal): the vehicle turns around. */
export function isWrongWayOnRoadCell(layout: RoadLaneLayout, cell: RoadCell, facing: Direction): boolean {
  if (cell.allowedDirections !== null) {
    return !canLeaveRoadCell(layout, cell, facing) && canLeaveRoadCell(layout, cell, opposite(facing))
  }
  const role = layout.roleOf(cell)
  return role?.kind === 'lane' && facing === opposite(role.direction)
}

/** A vehicle arriving from off the map may appear here (edge row, moving into the map). */
export function canSpawnOnRoadCell(layout: RoadLaneLayout, cell: RoadCell): boolean {
  if (cell.z !== -layout.worldSize / 2) return false
  // Explicit player one-ways win on the stub too: whatever may leave into the map.
  if (cell.allowedDirections !== null) return canLeaveRoadCell(layout, cell, 0)
  const role = layout.roleOf(cell)
  if (role?.kind === 'entry') return role.direction === 0
  // Anywhere else on the edge row, as long as the vehicle does not face against the traffic.
  return !isWrongWayOnRoadCell(layout, cell, 0)
}

/** A vehicle may leave the map from here (edge row, moving off the map). */
export function canExitFromRoadCell(layout: RoadLaneLayout, cell: RoadCell): boolean {
  if (cell.z !== -layout.worldSize / 2) return false
  if (cell.allowedDirections !== null) return canLeaveRoadCell(layout, cell, 2)
  const role = layout.roleOf(cell)
  if (role?.kind === 'entry') return role.direction === 2
  return canLeaveRoadCell(layout, cell, 2)
}

/** "Rechts vor links" applies here: knots, plazas and single tiles where three roads meet. */
export function isPriorityJunction(layout: RoadLaneLayout, cell: RoadCell): boolean {
  const role = layout.roleOf(cell)
  if (!role) return false
  if (role.kind === 'knot' || role.kind === 'plaza') return true
  if (role.kind !== 'single') return false
  let roads = 0
  for (let direction = 0; direction < 4; direction += 1) {
    if (layout.linksOf(cell, direction as Direction).length > 0) roads += 1
  }
  return roads >= 3
}

type Entry = { cell: RoadCell; role: LaneRole; links: RoadCell[][] }

/** Physical road topology by cell index: links, first link per direction, straight runs. */
type Topology = {
  cells: readonly RoadCell[]
  links: RoadCell[][][]
  indexOf: Map<RoadCell, number>
  /** First linked tile per direction (index i*4+d), −1 for none. */
  first: Int32Array
  runs: Int32Array
}

const wx = (t: Topology, i: number) => 1 + t.runs[i * 4 + 1]! + t.runs[i * 4 + 3]!
const wz = (t: Topology, i: number) => 1 + t.runs[i * 4]! + t.runs[i * 4 + 2]!
const has = (t: Topology, i: number, d: number) => t.first[i * 4 + d]! >= 0

function buildTopology(
  cells: readonly RoadCell[],
  index: ReadonlyMap<string, readonly RoadCell[]>,
  half: number,
): Topology {
  const count = cells.length
  const indexOf = new Map<RoadCell, number>()
  cells.forEach((cell, i) => indexOf.set(cell, i))
  const links: RoadCell[][][] = cells.map((cell) => physicalLinks(cell, index, half))
  const first = new Int32Array(count * 4).fill(-1)
  for (let i = 0; i < count; i += 1) {
    for (let d = 0; d < 4; d += 1) {
      const neighbor = links[i]![d]![0]
      const at = neighbor ? indexOf.get(neighbor) : undefined
      if (at !== undefined) first[i * 4 + d] = at
    }
  }
  return { cells, links, indexOf, first, runs: runLengths(first, count) }
}

/**
 * A lane of a two-lane road, or null when the pair does not line up (a narrowing, a
 * bulge or a stub beside the road): that tile becomes a small free knot.
 */
function laneRole(t: Topology, i: number, isStub: (i: number) => boolean): LaneRole | null {
  const alongZ = wx(t, i) === 2
  const partnerSide = alongZ ? (has(t, i, 1) ? 1 : 3) : (has(t, i, 0) ? 0 : 2)
  const partner = t.first[i * 4 + partnerSide]!
  const ahead = alongZ ? [0, 2] : [1, 3]
  if (partner < 0 || isStub(partner)) return null
  const partnerIsLane = alongZ
    ? wx(t, partner) === 2 && wz(t, partner) > 2
    : wz(t, partner) === 2 && wx(t, partner) > 2
  if (!partnerIsLane || ahead.some((d) => has(t, i, d) !== has(t, partner, d))) return null
  // Right-hand traffic: the driver's right of direction d is (d + 3) % 4.
  const direction: Direction = alongZ
    ? (partnerSide === 1 ? 0 : 2)
    : (partnerSide === 0 ? 3 : 1)
  const end = ahead.some((d) => !has(t, i, d))
  const leave = bit(direction) | (end ? bit(partnerSide) : 0)
  const enter = bit(direction) | (end ? bit(opposite(partnerSide)) : 0)
  return { kind: 'lane', direction, axis: alongZ ? 'z' : 'x', end, partner: partnerSide as Direction, leave, enter }
}

/**
 * Tiles long in both directions: small groups (at most 2×2) are knots where a two-lane
 * road is involved, and stay single roads where only one-lane roads bend or meet;
 * larger groups are plazas.
 */
function classifyWideAreas(
  t: Topology,
  knotSeeds: Uint8Array,
  knotTiles: Uint8Array,
  twoWide: Uint8Array,
  roles: (LaneRole | null)[],
): void {
  for (const component of components(knotSeeds, t.first, t.cells.length)) {
    const block = blockOf(component, t.cells)
    const small = block.maxX - block.minX <= 1 && block.maxZ - block.minZ <= 1
    const involvesTwoLane = component.length > 1 || component.some((i) =>
      [0, 1, 2, 3].some((d) => {
        const next = t.first[i * 4 + d]!
        return next >= 0 && twoWide[next] === 1
      }))
    for (const i of component) {
      if (!small) roles[i] = { ...FREE, kind: 'plaza' }
      else if (involvesTwoLane) knotTiles[i] = 1
      else roles[i] = { ...FREE, kind: 'single', axis: wz(t, i) >= wx(t, i) ? 'z' : 'x' }
    }
  }
}

/** Every connected group of knot tiles shares one role: its extent, exits and tiles. */
function assignKnots(t: Topology, knotTiles: Uint8Array, roles: (LaneRole | null)[]): void {
  for (const component of components(knotTiles, t.first, t.cells.length)) {
    const block = blockOf(component, t.cells)
    const members = new Set(component)
    let exitMask = 0
    for (const i of component) {
      for (let d = 0; d < 4; d += 1) {
        if (t.links[i]![d]!.some((neighbor) => !members.has(t.indexOf.get(neighbor) ?? -1))) exitMask |= bit(d)
      }
    }
    const tiles = component.map((i) => layerKey(t.cells[i]!))
    const exits = [0, 1, 2, 3].filter((d) => (exitMask & bit(d)) !== 0).length
    const square = component.length === 4 && block.maxX - block.minX === 1 && block.maxZ - block.minZ === 1
    for (const i of component) {
      const leave = square ? circulation(t.cells[i]!, block) : ALL
      roles[i] = { leave, enter: ALL, kind: 'knot', exits, exitMask, block, tiles }
    }
  }
}

/**
 * Inside a 2×2 knot traffic circulates one way, the way every lane enters it
 * (north on the west column, east on the north row, south on the east column,
 * west on the south row), and leaves outward from any tile. No two vehicles can
 * meet head-on inside, and with one tile kept free (box rule) the circle moves.
 */
function circulation(cell: RoadCell, block: LaneBlock): number {
  const west = cell.x === block.minX
  const south = cell.z === block.minZ
  const onward = west ? (south ? 0 : 1) : (south ? 3 : 2)
  const outward = bit(west ? 3 : 1) | bit(south ? 2 : 0)
  return bit(onward) | outward
}

export function classifyRoadLanes(
  cells: readonly RoadCell[],
  worldSize: number,
  byXZ?: ReadonlyMap<string, readonly RoadCell[]>,
): RoadLaneLayout {
  const index = byXZ ?? groupByXZ(cells)
  const count = cells.length
  const t = buildTopology(cells, index, worldSize / 2)
  const stub = stubCells(index, worldSize)
  const isStub = (i: number) => stub.has(cells[i]!)
  const roles: (LaneRole | null)[] = new Array(count).fill(null)
  const knotSeeds = new Uint8Array(count)
  const knotTiles = new Uint8Array(count)
  /** Tiles of a two-wide road (a lane, or a lane candidate that did not pair up). */
  const twoWide = new Uint8Array(count)
  for (let i = 0; i < count; i += 1) {
    // The stub gets its own role below and never joins a knot or a lane pair.
    if (isStub(i)) continue
    const x = wx(t, i), z = wz(t, i)
    if (Math.min(x, z) === 1) roles[i] = { ...FREE, kind: 'single', axis: z >= x ? 'z' : 'x' }
    else if (x > 2 && z > 2) knotSeeds[i] = 1
    else if (x === 2 && z === 2) roles[i] = { ...FREE, kind: 'plaza' }
    else {
      // Exactly two wide across, longer along the road.
      twoWide[i] = 1
      roles[i] = laneRole(t, i, isStub)
      if (!roles[i]) knotTiles[i] = 1
    }
  }
  classifyWideAreas(t, knotSeeds, knotTiles, twoWide, roles)
  assignKnots(t, knotTiles, roles)

  const entries = new Map<string, Entry>()
  const byCell = new Map<RoadCell, Entry>()
  for (let i = 0; i < count; i += 1) {
    const entry: Entry = { cell: cells[i]!, role: roles[i] ?? { ...FREE, kind: 'plaza' }, links: t.links[i]! }
    entries.set(layerKey(cells[i]!), entry)
    byCell.set(cells[i]!, entry)
  }
  // The graph asks with the very cell objects; other callers may pass copies.
  const find = (cell: RoadCell) => byCell.get(cell) ?? entries.get(layerKey(cell))
  const layout: RoadLaneLayout = {
    worldSize,
    roleOf: (cell) => find(cell)?.role,
    linksOf: (cell, direction) => find(cell)?.links[direction] ?? [],
  }
  assignEntryStub(layout, [...stub].map((cell) => byCell.get(cell)!))
  return layout
}

/** Lowest road layer of each map entry stub tile (z = −worldSize/2, x −3..2). */
function stubCells(index: ReadonlyMap<string, readonly RoadCell[]>, worldSize: number): Set<RoadCell> {
  const edge = -worldSize / 2
  const stub = new Set<RoadCell>()
  for (let x = ENTRY_MIN_X; x <= ENTRY_MAX_X; x += 1) {
    const layers = index.get(`${x}:${edge}`) ?? []
    const lowest = layers.reduce<RoadCell | undefined>(
      (best, cell) => (!best || (cell.elevation ?? 0) < (best.elevation ?? 0) ? cell : best),
      undefined,
    )
    if (lowest) stub.add(lowest)
  }
  return stub
}

/**
 * Whether the road entering the map from the inbound half reaches, inland and
 * without using the stub row, a road that leads back out through the outbound half.
 */
function stubHalvesJoined(layout: RoadLaneLayout, stub: readonly Entry[]): boolean {
  const onStub = new Set(stub.map((entry) => entry.cell))
  const inland = (entry: Entry) => entry.links[0]!.filter((next) => !onStub.has(next))
  const feeds = new Set(stub.filter((entry) => entry.cell.x >= 0)
    .flatMap((entry) => inland(entry).filter((next) => canLeaveRoadCell(layout, next, 2))))
  if (feeds.size === 0) return false
  const queue = stub.filter((entry) => entry.cell.x < 0)
    .flatMap((entry) => inland(entry).filter((next) => canEnterRoadCell(layout, next, 0)))
  const seen = new Set(queue)
  while (queue.length) {
    const cell = queue.pop()!
    if (feeds.has(cell)) return true
    for (const direction of [0, 1, 2, 3] as const) {
      if (!canLeaveRoadCell(layout, cell, direction)) continue
      for (const next of layout.linksOf(cell, direction)) {
        if (onStub.has(next) || seen.has(next) || !canEnterRoadCell(layout, next, direction)) continue
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return false
}

/**
 * Three inbound lanes (x −3..−1, into the map) and three outbound ones (x 0..2).
 * The stub row is a turning point: vehicles move sideways between all six tiles
 * (and to edge roads at x −4 / x 3) and on into any road that lets them in; the
 * lanes next to it keep their own direction. Arrivals appear only on the inbound
 * half and vehicles leave the map only from the outbound half. `open` (no double
 * line) when the halves are not joined inland.
 */
function assignEntryStub(layout: RoadLaneLayout, stub: readonly Entry[]): void {
  const open = !stubHalvesJoined(layout, stub)
  for (const entry of stub) {
    entry.role = { ...FREE, kind: 'entry', direction: entry.cell.x < 0 ? 0 : 2, open }
  }
}

function groupByXZ(cells: readonly RoadCell[]): Map<string, RoadCell[]> {
  const index = new Map<string, RoadCell[]>()
  for (const cell of cells) {
    const key = `${cell.x}:${cell.z}`
    const layers = index.get(key)
    if (layers) layers.push(cell)
    else index.set(key, [cell])
  }
  return index
}

/** Same rules as the road graph, minus one-way bits: in the world, no separator, heights fit. */
function physicalLinks(
  cell: RoadCell,
  index: ReadonlyMap<string, readonly RoadCell[]>,
  half: number,
): RoadCell[][] {
  return OFFSETS.map(([dx, dz], direction) => {
    if ((cell.blockedEdges & bit(direction)) !== 0) return []
    const x = cell.x + dx, z = cell.z + dz
    if (x < -half || x >= half || z < -half || z >= half) return []
    return (index.get(`${x}:${z}`) ?? []).filter((neighbor) =>
      (neighbor.blockedEdges & bit(opposite(direction))) === 0 &&
      canTraverseWayElevation(
        cell.elevation ?? 0, cell.roadSlope ?? 0, cell.roadSlopeDirection,
        neighbor.elevation ?? 0, neighbor.roadSlope ?? 0, neighbor.roadSlopeDirection,
        direction,
      ))
  })
}

/** Tiles in a straight line from each tile per direction (index i*4+d). */
function runLengths(first: Int32Array, count: number): Int32Array {
  const runs = new Int32Array(count * 4).fill(-1)
  const chain: number[] = []
  for (let d = 0; d < 4; d += 1) {
    for (let start = 0; start < count; start += 1) {
      if (runs[start * 4 + d]! >= 0) continue
      chain.length = 0
      let at = start
      // A straight line never revisits a tile, so this ends at the last road tile.
      while (at >= 0 && runs[at * 4 + d]! < 0 && chain.length <= count) {
        chain.push(at)
        at = first[at * 4 + d]!
      }
      let length = at >= 0 && runs[at * 4 + d]! >= 0 ? runs[at * 4 + d]! + 1 : 0
      for (let k = chain.length - 1; k >= 0; k -= 1) {
        runs[chain[k]! * 4 + d] = length
        length += 1
      }
    }
  }
  return runs
}

function components(member: Uint8Array, first: Int32Array, count: number): number[][] {
  const seen = new Uint8Array(count)
  const result: number[][] = []
  for (let start = 0; start < count; start += 1) {
    if (!member[start] || seen[start]) continue
    const component: number[] = []
    const queue = [start]
    seen[start] = 1
    while (queue.length) {
      const at = queue.pop()!
      component.push(at)
      for (let d = 0; d < 4; d += 1) {
        const next = first[at * 4 + d]!
        if (next >= 0 && member[next] && !seen[next]) {
          seen[next] = 1
          queue.push(next)
        }
      }
    }
    result.push(component.sort((a, b) => a - b))
  }
  return result
}

function blockOf(component: readonly number[], cells: readonly RoadCell[]): LaneBlock {
  const block = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity }
  for (const i of component) {
    const cell = cells[i]!
    block.minX = Math.min(block.minX, cell.x)
    block.maxX = Math.max(block.maxX, cell.x)
    block.minZ = Math.min(block.minZ, cell.z)
    block.maxZ = Math.max(block.maxZ, cell.z)
  }
  return block
}
