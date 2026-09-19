import { normalizeStaffGateDirection, staffGateBlocksVisitor } from './accessControl'
import { isPedestrianBarrierKind, pedestrianBarrierOccupancy } from './scenery'
import { isWallDoor } from './decorationWalls'
import { createPathScratch, findWeightedPath } from './pathfinding'
import { SIMULATION_CONFIG } from './simulationConfig'
import { directionBit, oppositeDirection, type Direction, type RoadCell } from './logistics'
import { WAY_LEVEL_MATCH } from './wayElevation'
import type { BuildingKind } from './catalog'
import type { Cell, PlacedBuilding } from './types/entities'

export const PEDESTRIAN_NAV_FLAGS = {
  path: 1,
  road: 2,
  camping: 4,
  medical: 8,
  forecourt: 16,
  parking: 32,
  water: 64,
  ground: 128,
  solid: 256,
  paved: 512,
  backstage: 1024,
} as const

const SOLID_KINDS = new Set<BuildingKind>([
  'food', 'toilet', 'ride', 'alcohol', 'tree', 'hedge', 'stage',
  'directionalSpeaker', 'omniSpeaker', 'ambulanceGarage', 'busDepot',
  'wasteDepot', 'specialDepot', 'generator', 'backupGenerator', 'foh',
  'delayTower', 'videoWall', 'laserShow', 'fireworkBattery', 'tourBusParking',
  'bandFridge', 'backstageToilet',
])

export function isPedestrianSolidKind(kind: BuildingKind): boolean {
  return SOLID_KINDS.has(kind)
}

const OFFSETS = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const

type NavLink = { node: NavNode; toPath?: PlacedBuilding }
type NavNode = {
  cell: Cell
  packed: number
  flags: number
  cost: number
  fenceMask: number
  roadBlocked: number
  path?: PlacedBuilding
  links: NavLink[]
}

export type PedestrianNeighborOptions = {
  allowQueue?: boolean
  allowCamping?: boolean
  allowMedical?: boolean
  allowFestival?: boolean
  ignoreDirectionalRestrictions?: boolean
  allowGrass?: boolean
  allowStaff?: boolean
  allowBackstage?: boolean
}

export type PedestrianPathOptions = {
  revalidate?: boolean
  allowQueue?: boolean
  allowCamping?: boolean
  allowMedical?: boolean
  ignoreDirectionalRestrictions?: boolean
  allowFestival?: boolean
  maxVisited?: number
  allowStaff?: boolean
  allowBackstage?: boolean
}

export type PedestrianNavigationContext = {
  worldRevision(): number
  simTick(): number
  accessSignalRevision(): number
  worldSize(): number
  terrainStorageSize(): number
  buildings(): readonly PlacedBuilding[]
  roadCells(): readonly RoadCell[]
  parkingCount(): number
  campingCount(): number
  medicalCount(): number
  forecourtCount(): number
  prepareGraph(): void
  packCell(cell: Cell): number
  packXZ(x: number, z: number): number
  directionIndex(dx: number, dz: number): number
  getTerrainHeight(x: number, z: number): number
  getPathAt(x: number, z: number, elevation?: number): PlacedBuilding | undefined
  getRoadAt(x: number, z: number): RoadCell | undefined
  getBuildingsAt(x: number, z: number): readonly PlacedBuilding[]
  isCampingAt(x: number, z: number): boolean
  isMedicalAt(x: number, z: number): boolean
  isForecourtAt(x: number, z: number): boolean
  hasParkingAt(x: number, z: number): boolean
  isBackstageAt(x: number, z: number): boolean
  isWaterAt(x: number, z: number): boolean
  isSolidAt(x: number, z: number, elevation: number): boolean
  surfaceCost(cell: Cell): number
  walkEdgeHeights(cell: Cell, path: PlacedBuilding | undefined, direction: number): [number, number]
  edgesMeet(left: [number, number], right: [number, number]): boolean
  canTraversePath(
    from: PlacedBuilding | undefined,
    to: PlacedBuilding,
    fromX: number,
    fromZ: number,
    allowQueue: boolean,
    ignoreDirectionalRestrictions: boolean,
    fromElevation: number,
  ): boolean
  searchNeighbors(cell: Cell, options: PedestrianNeighborOptions): readonly Cell[]
  isClosedPathEdge(x: number, z: number, direction: Direction): boolean
  crowdingCost(packed: number): number
}

export class PedestrianNavigation {
  private readonly context: PedestrianNavigationContext
  private readonly scratch = createPathScratch<Cell>()
  private readonly neighborScratch: Cell[] = []
  private readonly neighborSeen = new Set<number>()
  private readonly cache = new Map<string, { path: readonly Cell[] | null; expires: number }>()
  private readonly nodes = new Map<number, NavNode>()
  private navKey = ''
  private congestionCosts = new Map<number, number>()

  constructor(context: PedestrianNavigationContext) {
    this.context = context
  }

  clear(): void {
    this.nodes.clear()
    this.navKey = ''
    this.cache.clear()
  }

  clearPathCache(): void {
    this.cache.clear()
  }

  pathCacheView(): ReadonlyMap<string, { path: readonly Cell[] | null; expires: number }> {
    return this.cache
  }

  rebuildNow(): void {
    this.rebuild()
  }

  hasNode(cell: Cell): boolean {
    return this.nodes.has(this.context.packCell(cell))
  }

  flagsAt(cell: Cell): number {
    return this.nodes.get(this.context.packCell(cell))?.flags ?? 0
  }

  costAt(cell: Cell): number | undefined {
    return this.nodes.get(this.context.packCell(cell))?.cost
  }

  setCongestionCosts(costs: Map<number, number>): void {
    const changed =
      costs.size !== this.congestionCosts.size ||
      [...costs].some(([key, value]) => this.congestionCosts.get(key) !== value)
    if (!changed) return
    this.congestionCosts = costs
    this.cache.clear()
  }

  ensure(revalidate: boolean): void {
    if (revalidate) {
      const key = `${this.context.worldRevision()}:${this.graphKey()}`
      if (key === this.navKey && this.nodes.size > 0) return
      this.navKey = key
      this.rebuild()
      return
    }
    if (this.nodes.size === 0) this.rebuild()
  }

  findPath(start: Cell, goals: readonly Cell[], options: PedestrianPathOptions = {}): Cell[] | null {
    if (goals.length === 0) return null
    this.ensure(options.revalidate ?? false)
    const allowQueue = options.allowQueue ?? false
    const startOnCamping = this.context.isCampingAt(start.x, start.z)
    const startOnMedical = this.context.isMedicalAt(start.x, start.z)
    const startOnFestival = this.context.isForecourtAt(start.x, start.z)
    const startOnBackstage =
      this.context.isBackstageAt(start.x, start.z) &&
      !this.context.getPathAt(start.x, start.z, start.elevation)
    const campingAllowed = Boolean(options.allowCamping || startOnCamping)
    const medicalAllowed = Boolean(options.allowMedical || startOnMedical)
    const festivalAllowed = Boolean(options.allowFestival || startOnFestival)
    const backstageAllowed = Boolean(options.allowBackstage || options.allowStaff || startOnBackstage)
    const cacheKey = this.pathCacheKey(start, goals, {
      allowQueue,
      allowCamping: campingAllowed,
      allowMedical: medicalAllowed,
      allowFestival: festivalAllowed,
      ignoreDirectionalRestrictions: options.ignoreDirectionalRestrictions ?? false,
    })
    const accessCacheKey =
      `${cacheKey}:${options.allowStaff ? 'staff' : 'guest'}:${backstageAllowed ? 'back' : 'noback'}`
    const cached = this.cache.get(accessCacheKey)
    if (cached && cached.expires > this.context.simTick()) return clonePath(cached.path)
    if (cached) this.cache.delete(accessCacheKey)
    const goalKeys = new Set(goals.map((cell) => this.context.packCell(cell)))
    const canEnterGoal = (campingAccess: boolean) =>
      goalKeys.has(this.context.packCell(start)) ||
      goals.some((goal) => {
        const node = this.nodes.get(this.context.packCell(goal))
        if (!node || (node.flags & PEDESTRIAN_NAV_FLAGS.solid) !== 0) return false
        if (
          node.path?.staffOnly &&
          !options.allowStaff &&
          normalizeStaffGateDirection(node.path.staffGateDirection) === undefined
        ) return false
        if ((node.flags & PEDESTRIAN_NAV_FLAGS.water) !== 0 &&
            (node.flags & PEDESTRIAN_NAV_FLAGS.path) === 0 && options.allowStaff) return false
        if (!campingAccess && (node.flags & PEDESTRIAN_NAV_FLAGS.camping) !== 0) return false
        if (!medicalAllowed && (node.flags & PEDESTRIAN_NAV_FLAGS.medical) !== 0) return false
        if (!festivalAllowed && (node.flags & PEDESTRIAN_NAV_FLAGS.forecourt) !== 0 &&
            (node.flags & PEDESTRIAN_NAV_FLAGS.path) === 0) return false
        if (!backstageAllowed && (node.flags & PEDESTRIAN_NAV_FLAGS.backstage) !== 0 &&
            (node.flags & PEDESTRIAN_NAV_FLAGS.path) === 0) return false
        return true
      })
    const movementCost = (_from: Cell, to: Cell): number => {
      const key = this.context.packCell(to)
      const surface = this.nodes.get(key)?.cost ?? this.context.surfaceCost(to)
      return surface * (1 + (this.congestionCosts.get(key) ?? 0)) +
        Math.min(1, this.context.crowdingCost(key) / 100) *
          SIMULATION_CONFIG.pathfinding.crowdingCostWeight
    }
    const heuristic = goals.length === 1
      ? (cell: Cell) => Math.abs(goals[0]!.x - cell.x) + Math.abs(goals[0]!.z - cell.z)
      : (cell: Cell) => {
          let minimum = Number.POSITIVE_INFINITY
          for (const goal of goals) {
            minimum = Math.min(minimum, Math.abs(goal.x - cell.x) + Math.abs(goal.z - cell.z))
          }
          return minimum
        }
    let nearestGoal = Number.POSITIVE_INFINITY
    for (const goal of goals) {
      nearestGoal = Math.min(nearestGoal, Math.abs(goal.x - start.x) + Math.abs(goal.z - start.z))
    }
    const search = (allowGrass: boolean, campingAccess: boolean, maxCost?: number) =>
      findWeightedPath({
        start,
        key: (cell) => this.context.packCell(cell),
        isGoal: (cell) => goalKeys.has(this.context.packCell(cell)),
        neighbors: (cell) => this.context.searchNeighbors(cell, {
          allowQueue,
          allowCamping: campingAccess,
          allowMedical: medicalAllowed,
          allowFestival: festivalAllowed,
          ignoreDirectionalRestrictions: options.ignoreDirectionalRestrictions,
          allowGrass,
          allowStaff: options.allowStaff,
          allowBackstage: backstageAllowed,
        }),
        movementCost,
        maxVisited: options.maxVisited,
        heuristic,
        maxCost,
      }, this.scratch)
    let result = canEnterGoal(campingAllowed) ? search(false, campingAllowed) : null
    if (options.maxVisited === undefined && !result && !campingAllowed) {
      result = canEnterGoal(true) ? search(false, true) : null
    }
    if (options.maxVisited === undefined && !result && canEnterGoal(true)) {
      result = search(
        true,
        true,
        nearestGoal * SIMULATION_CONFIG.pathfinding.grassCostMultiplier * 1.6 + 24,
      )
    }
    if (this.cache.size >= SIMULATION_CONFIG.pathfinding.pathCacheLimit) {
      this.cache.delete(this.cache.keys().next().value!)
    }
    if (options.maxVisited === undefined || result) {
      this.cache.set(accessCacheKey, {
        path: result ? result.map((cell) => ({ ...cell })) : null,
        expires: this.context.simTick() +
          SIMULATION_CONFIG.pathfinding.pathCacheLifetimeTicks +
          (this.context.packCell(start) % SIMULATION_CONFIG.pathfinding.pathCacheLifetimeTicks),
      })
    }
    return clonePath(result)
  }

  neighbors(cell: Cell, options: PedestrianNeighborOptions = {}): Cell[] {
    const node = this.node(cell)
    const neighbors = this.neighborScratch
    neighbors.length = 0
    if (!node) return neighbors
    const allowQueue = options.allowQueue ?? false
    const allowCamping = Boolean(options.allowCamping)
    const allowMedical = Boolean(options.allowMedical)
    const allowFestival = Boolean(options.allowFestival)
    const allowBackstage = Boolean(options.allowBackstage || options.allowStaff)
    const allowGrass = options.allowGrass ?? true
    const ignoreDirectional = options.ignoreDirectionalRestrictions ?? false
    const campingHere = (node.flags & PEDESTRIAN_NAV_FLAGS.camping) !== 0
    this.neighborSeen.clear()
    for (const link of node.links) {
      const dest = link.node
      if (!options.allowStaff) {
        const travel = this.context.directionIndex(dest.cell.x - node.cell.x, dest.cell.z - node.cell.z)
        if (travel >= 0 && staffGateBlocksVisitor(node.path, dest.path, travel as Direction)) continue
      }
      if ((dest.flags & PEDESTRIAN_NAV_FLAGS.solid) !== 0) continue
      if ((dest.flags & PEDESTRIAN_NAV_FLAGS.parking) !== 0 &&
          (dest.flags & PEDESTRIAN_NAV_FLAGS.path) === 0) continue
      if ((dest.flags & PEDESTRIAN_NAV_FLAGS.water) !== 0 &&
          (dest.flags & PEDESTRIAN_NAV_FLAGS.path) === 0 && options.allowStaff) continue
      if (!allowCamping && (dest.flags & PEDESTRIAN_NAV_FLAGS.camping) !== 0) continue
      if (!allowMedical && (dest.flags & PEDESTRIAN_NAV_FLAGS.medical) !== 0) continue
      if (!allowFestival && (dest.flags & PEDESTRIAN_NAV_FLAGS.forecourt) !== 0 &&
          (dest.flags & PEDESTRIAN_NAV_FLAGS.path) === 0) continue
      if (!allowBackstage && (dest.flags & PEDESTRIAN_NAV_FLAGS.backstage) !== 0 &&
          (dest.flags & PEDESTRIAN_NAV_FLAGS.path) === 0) continue
      if (!allowGrass && (dest.flags & PEDESTRIAN_NAV_FLAGS.paved) === 0) continue
      if (campingHere && Math.abs(dest.cell.elevation - node.cell.elevation) >= 0.01) continue
      const toPath = link.toPath ?? dest.path
      if (toPath) {
        if (!this.context.canTraversePath(
          node.path, toPath, node.cell.x, node.cell.z, allowQueue,
          ignoreDirectional, node.cell.elevation,
        )) continue
      } else if (node.path?.pathType === 'queue') {
        const leave = this.context.directionIndex(dest.cell.x - node.cell.x, dest.cell.z - node.cell.z)
        if (node.path.queueEntryDirection !== (leave + 2) % 4) continue
      }
      const direction = this.context.directionIndex(dest.cell.x - node.cell.x, dest.cell.z - node.cell.z)
      if (!ignoreDirectional && this.context.isClosedPathEdge(
        node.cell.x, node.cell.z, direction as Direction,
      )) continue
      if (this.isCachedEdgeBlocked(node, dest) || this.neighborSeen.has(dest.packed)) continue
      this.neighborSeen.add(dest.packed)
      neighbors.push(dest.cell)
    }
    return neighbors
  }

  private node(cell: Cell): NavNode | undefined {
    this.ensure(false)
    return this.nodes.get(this.context.packCell(cell))
  }

  private graphKey(): string {
    let structure = 0
    for (const building of this.context.buildings()) {
      if (
        building.kind !== 'path' &&
        !isPedestrianBarrierKind(building.kind) &&
        !isWallDoor(building.kind) &&
        !SOLID_KINDS.has(building.kind)
      ) continue
      structure = (structure + this.context.packXZ(building.x, building.z) +
        building.rotation + (building.decorationSlot ?? 8) +
        Math.round(building.elevation * 8) +
        (building.pathType === 'queue' ? 5 : 1) + (building.pathSlope ?? 0) * 11) | 0
    }
    for (const road of this.context.roadCells()) {
      structure = (structure + road.x * 13 + road.z * 17 + road.blockedEdges +
        Math.round((road.elevation ?? 0) * 2) +
        Math.round((road.roadSlope ?? 0) * 2) * 7 + (road.roadSlopeDirection ?? 0)) | 0
    }
    return [
      this.context.buildings().length,
      this.context.roadCells().length,
      this.context.parkingCount(),
      this.context.campingCount(),
      this.context.medicalCount(),
      this.context.forecourtCount(),
      this.context.worldSize(),
      this.context.terrainStorageSize(),
      structure,
    ].join(':')
  }

  private rebuild(): void {
    this.context.prepareGraph()
    this.nodes.clear()
    this.cache.clear()
    const half = this.context.worldSize() / 2
    const addNode = (x: number, z: number, elevation: number): void => {
      const packed = this.context.packCell({ x, z, elevation })
      if (this.nodes.has(packed)) return
      const path = this.context.getPathAt(x, z, elevation)
      const height = this.context.getTerrainHeight(x, z)
      const ground = Math.abs(elevation - height) < WAY_LEVEL_MATCH
      const road = ground ? this.context.getRoadAt(x, z) : undefined
      let flags = 0
      if (path) flags |= PEDESTRIAN_NAV_FLAGS.path
      if (road) flags |= PEDESTRIAN_NAV_FLAGS.road
      if (this.context.isCampingAt(x, z)) flags |= PEDESTRIAN_NAV_FLAGS.camping
      if (this.context.isMedicalAt(x, z)) flags |= PEDESTRIAN_NAV_FLAGS.medical
      if (this.context.isForecourtAt(x, z)) flags |= PEDESTRIAN_NAV_FLAGS.forecourt
      if (this.context.hasParkingAt(x, z)) flags |= PEDESTRIAN_NAV_FLAGS.parking
      if (this.context.isBackstageAt(x, z)) flags |= PEDESTRIAN_NAV_FLAGS.backstage
      if (this.context.isWaterAt(x, z) && !path) flags |= PEDESTRIAN_NAV_FLAGS.water
      if (ground) flags |= PEDESTRIAN_NAV_FLAGS.ground
      if (this.context.isSolidAt(x, z, elevation)) flags |= PEDESTRIAN_NAV_FLAGS.solid
      if (flags & (
        PEDESTRIAN_NAV_FLAGS.path | PEDESTRIAN_NAV_FLAGS.road |
        PEDESTRIAN_NAV_FLAGS.camping | PEDESTRIAN_NAV_FLAGS.medical |
        PEDESTRIAN_NAV_FLAGS.forecourt | PEDESTRIAN_NAV_FLAGS.parking |
        PEDESTRIAN_NAV_FLAGS.backstage
      )) flags |= PEDESTRIAN_NAV_FLAGS.paved
      let fenceMask = 0
      for (const building of this.context.getBuildingsAt(x, z)) {
        if (Math.abs(building.elevation - elevation) >= WAY_LEVEL_MATCH) continue
        const occupancy = pedestrianBarrierOccupancy(building)
        if (occupancy === undefined || occupancy === 'solid') continue
        fenceMask |= directionBit(occupancy)
      }
      this.nodes.set(packed, {
        cell: { x, z, elevation }, packed, flags,
        cost: this.context.surfaceCost({ x, z, elevation }),
        fenceMask, roadBlocked: road?.blockedEdges ?? 0, path, links: [],
      })
    }
    for (let z = -half; z < half; z += 1) {
      for (let x = -half; x < half; x += 1) addNode(x, z, this.context.getTerrainHeight(x, z))
    }
    for (const building of this.context.buildings()) {
      if (building.kind === 'path') addNode(building.x, building.z, building.elevation)
    }
    for (const node of this.nodes.values()) {
      for (const [dx, dz] of OFFSETS) {
        const nx = node.cell.x + dx
        const nz = node.cell.z + dz
        const direction = this.context.directionIndex(dx, dz)
        for (const building of this.context.getBuildingsAt(nx, nz)) {
          if (building.kind !== 'path') continue
          const dest = this.nodes.get(this.context.packCell({
            x: building.x, z: building.z, elevation: building.elevation,
          }))
          if (dest && this.edgesConnect(node, dest, direction)) {
            node.links.push({ node: dest, toPath: building })
          }
        }
        if ((node.flags & PEDESTRIAN_NAV_FLAGS.ground) === 0) continue
        const elevation = this.context.getTerrainHeight(nx, nz)
        const dest = this.nodes.get(this.context.packCell({ x: nx, z: nz, elevation }))
        if (dest && this.edgesConnect(node, dest, direction)) node.links.push({ node: dest })
      }
    }
  }

  private edgesConnect(from: NavNode, to: NavNode, direction: number): boolean {
    if (direction < 0) return false
    return this.context.edgesMeet(
      this.context.walkEdgeHeights(from.cell, from.path, direction),
      this.context.walkEdgeHeights(to.cell, to.path, (direction + 2) % 4),
    )
  }

  private isCachedEdgeBlocked(from: NavNode, to: NavNode): boolean {
    const direction = this.context.directionIndex(to.cell.x - from.cell.x, to.cell.z - from.cell.z)
    if (direction < 0) return false
    const bit = directionBit(direction as Direction)
    const opposite = directionBit(oppositeDirection(direction as Direction))
    if ((from.flags & PEDESTRIAN_NAV_FLAGS.ground) !== 0 && (from.roadBlocked & bit) !== 0) return true
    if ((to.flags & PEDESTRIAN_NAV_FLAGS.ground) !== 0 && (to.roadBlocked & opposite) !== 0) return true
    return (from.fenceMask & bit) !== 0 || (to.fenceMask & opposite) !== 0
  }

  private pathCacheKey(
    start: Cell,
    goals: readonly Cell[],
    flags: {
      allowQueue: boolean
      allowCamping: boolean
      allowMedical: boolean
      allowFestival: boolean
      ignoreDirectionalRestrictions: boolean
    },
  ): string {
    const packedGoals = goals.map((cell) => this.context.packCell(cell)).sort((a, b) => a - b)
    const bits = (flags.allowQueue ? 1 : 0) | (flags.allowCamping ? 2 : 0) |
      (flags.allowMedical ? 4 : 0) | (flags.allowFestival ? 8 : 0) |
      (flags.ignoreDirectionalRestrictions ? 16 : 0)
    return `${this.context.packCell(start)}:${packedGoals.join(',')}:${bits}:${this.context.accessSignalRevision()}`
  }
}

function clonePath(path: readonly Cell[] | null): Cell[] | null {
  return path ? path.map((cell) => ({ ...cell })) : null
}
