import { WORLD_SIZE } from './catalog'
import { findWeightedPath } from './pathfinding'

export type Direction = 0 | 1 | 2 | 3
export type SpeedLimit = 10 | 30 | 50

export type RoadPosition = {
  x: number
  z: number
}

export type RoadCell = RoadPosition & {
  allowedDirections: number | null
  blockedEdges: number
  speedLimit: SpeedLimit
  crosswalk: boolean
}

export type ParkingCell = RoadPosition & {
  occupiedBy: string | null
}

export type ArrivalMode = 'car' | 'pedestrian'
export type ArrivalGroupState =
  | 'approaching'
  | 'waiting-for-parking'
  | 'arrived'
  | 'leaving'
  | 'departed'

export type ArrivalGroup = {
  id: string
  memberIds: string[]
  vehicleId: string | null
  mode: ArrivalMode
  state: ArrivalGroupState
  arrivedMinute: number | null
  parkingWaitMinutes: number
  entryFeesPaid: boolean
}

export type RoadVehicleKind = 'visitorCar' | 'ambulance' | 'bus' | 'garbageTruck' | 'sweeper' | 'deliveryTruck'
export type RoadVehicleState =
  | 'idle'
  | 'driving'
  | 'waiting'
  | 'parking'
  | 'parked'
  | 'responding'
  | 'at-stop'
  | 'returning'

export type RoadVehicleTarget =
  | (RoadPosition & { kind: 'cell' })
  | { kind: 'parking'; parkingCell: RoadPosition }
  | { kind: 'hold'; parkingCell?: RoadPosition }
  | { kind: 'cruise' }
  | { kind: 'busStop'; stopId: string }
  | { kind: 'garage'; garageId: string }
  | { kind: 'depot'; depotId: string }
  | { kind: 'wasteDump'; x: number; z: number }

export type RoadVehicle = {
  stuckMinutes?: number
  testedGroundCell?: string
  id: string
  kind: RoadVehicleKind
  position: RoadPosition
  cell: RoadPosition | null
  route: RoadPosition[]
  state: RoadVehicleState
  speed: number
  passengerIds: string[]
  groupId: string | null
  parkingCell: RoadPosition | null
  target: RoadVehicleTarget | null
  facing: number
  waitMinutes: number
  lineId: string | null
  nextStopIndex: number
  resumeState: RoadVehicleState | null
  cargo: number
  deliveryId?: string | null
  parkingSearchCursor?: number
}

export const ROAD_VEHICLE_KIND_LABELS: Record<
  RoadVehicleKind,
  { icon: string; name: string }
> = {
  visitorCar: { icon: '🚗', name: 'Besucherauto' },
  ambulance: { icon: '🚑', name: 'Krankenwagen' },
  bus: { icon: '🚌', name: 'Bus' },
  garbageTruck: { icon: '🚛', name: 'Müllfahrzeug' },
  sweeper: { icon: '🧹', name: 'Saugreiniger' },
  deliveryTruck: { icon: '🚚', name: 'Lieferfahrzeug' },
}

export function isPlayerOwnedFleetVehicle(vehicle: Pick<RoadVehicle, 'kind'>): boolean {
  return (
    vehicle.kind === 'ambulance' ||
    vehicle.kind === 'bus' ||
    vehicle.kind === 'garbageTruck' ||
    vehicle.kind === 'sweeper'
  )
}

export function vehicleFacingDirection(facing: number): Direction {
  return ((Math.round(facing / (Math.PI / 2)) % 4 + 4) % 4) as Direction
}

export function isVehicleReversing(vehicle: RoadVehicle): boolean {
  const next = vehicle.route[0]
  const here = vehicle.cell ?? vehicle.position
  if (!next) return false
  const move = directionFromDelta(next.x - here.x, next.z - here.z)
  return (
    move !== null &&
    move === oppositeDirection(vehicleFacingDirection(vehicle.facing))
  )
}

export function describeRoadVehicleActivity(vehicle: RoadVehicle): string {
  if ((vehicle.stuckMinutes ?? 0) > 0) return 'Steckt im Schlamm fest'
  if (isVehicleReversing(vehicle)) return 'Setzt zurück'
  const queued =
    vehicle.route.length > 0 &&
    vehicle.waitMinutes > 0 &&
    (vehicle.state === 'driving' ||
      vehicle.state === 'responding' ||
      vehicle.state === 'returning' ||
      vehicle.state === 'parking')
  if (queued) return 'Wartet, bis die Fahrbahn oder Ampel frei ist'
  switch (vehicle.state) {
    case 'parked':
      return 'Steht auf dem Parkplatz'
    case 'parking':
      return 'Rangiert auf den Parkplatz'
    case 'waiting':
      return vehicle.resumeState
        ? 'Wartet nach einem Zwischenfall'
        : vehicle.parkingCell || vehicle.target?.kind === 'parking'
          ? 'Wartet auf die Zufahrt zum Parkplatz'
          : 'Wartet auf der Straße'
    case 'driving':
      if (vehicle.kind === 'deliveryTruck') return 'Fährt zur Anlieferung'
      if (vehicle.target?.kind === 'parking') return 'Fährt zum Parkplatz'
      if (vehicle.target?.kind === 'hold') return 'Sucht einen freien Parkplatz'
      if (vehicle.target?.kind === 'cruise') {
        return 'Fährt auf der Straße und sucht einen Parkplatz'
      }
      if (vehicle.target?.kind === 'busStop') return 'Fährt zur nächsten Haltestelle'
      if (vehicle.target?.kind === 'wasteDump') return 'Fährt zur Müllkippe'
      if (vehicle.target?.kind === 'depot') return 'Fährt zum Betriebshof'
      if (vehicle.target?.kind === 'garage') return 'Fährt zur Garage'
      if (vehicle.target?.kind === 'cell') return 'Fährt zum Ziel'
      return 'Unterwegs'
    case 'responding':
      return 'Fährt zum Einsatz'
    case 'returning':
      return vehicle.kind === 'visitorCar' || vehicle.kind === 'deliveryTruck'
        ? 'Fährt vom Gelände ab'
        : 'Fährt zurück'
    case 'at-stop':
      return 'Hält an der Haltestelle'
    case 'idle':
      return 'Wartet auf den nächsten Auftrag'
  }
}

export function describeRoadVehicleDestination(vehicle: RoadVehicle): string | null {
  if (vehicle.parkingCell && vehicle.state !== 'parked') {
    return `Parkplatz ${vehicle.parkingCell.x}, ${vehicle.parkingCell.z}`
  }
  if (vehicle.target?.kind === 'busStop') return 'Nächste Bushaltestelle'
  if (vehicle.kind === 'deliveryTruck' && vehicle.target?.kind === 'depot') {
    return 'Anlieferungsplatz'
  }
  if (vehicle.target?.kind === 'cell') {
    return `Feld ${vehicle.target.x}, ${vehicle.target.z}`
  }
  const last = vehicle.route.at(-1)
  return last ? `Feld ${last.x}, ${last.z}` : null
}

export type AmbulanceGarage = RoadPosition & {
  id: string
  bays: [string | null, string | null]
}

export type BusStop = RoadPosition & {
  id: string
  name: string
  roadCell: RoadPosition
}

export type BusDepot = RoadPosition & {
  id: string
  busIds: string[]
}

export type WasteDepot = RoadPosition & {
  id: string
  truckIds: string[]
}

export type SpecialDepot = RoadPosition & {
  id: string
  vehicleIds: string[]
}

export type BusLine = {
  id: string
  name: string
  depotId: string
  stopIds: string[]
  busIds: string[]
  headway: number
  active: boolean
  lastDepartureMinute: number | null
}

export type LogisticsSnapshot = {
  roadCells: RoadCell[]
  parkingCells: ParkingCell[]
  arrivalGroups: ArrivalGroup[]
  roadVehicles: RoadVehicle[]
  ambulanceGarages: AmbulanceGarage[]
  busStops: BusStop[]
  busDepots: BusDepot[]
  busLines: BusLine[]
  wasteDepots: WasteDepot[]
  specialDepots: SpecialDepot[]
}

export type RoadGraph = {
  cells: readonly RoadCell[]
  byKey: ReadonlyMap<string, RoadCell>
  neighbors: ReadonlyMap<string, readonly RoadCell[]>
}

export type FindRoadRouteOptions = {
  roadCells: readonly RoadCell[]
  start: RoadPosition
  target?: RoadPosition
  targets?: readonly RoadPosition[]
  blockedCells?: ReadonlySet<string>
  blockedEdges?: ReadonlySet<string>
  worldSize?: number
  initialDirection?: Direction
  allowUTurn?: boolean
  graph?: RoadGraph
}

export const DIRECTIONS: readonly Direction[] = [0, 1, 2, 3]

export const DIRECTION_OFFSETS: Readonly<
  Record<Direction, Readonly<RoadPosition>>
> = {
  0: { x: 0, z: 1 },
  1: { x: 1, z: 0 },
  2: { x: 0, z: -1 },
  3: { x: -1, z: 0 },
}

const ARRIVAL_MODES: readonly ArrivalMode[] = ['car', 'pedestrian']
const ARRIVAL_STATES: readonly ArrivalGroupState[] = [
  'approaching',
  'waiting-for-parking',
  'arrived',
  'leaving',
  'departed',
]
const VEHICLE_KINDS: readonly RoadVehicleKind[] = [
  'visitorCar',
  'ambulance',
  'bus',
  'garbageTruck',
  'sweeper',
  'deliveryTruck',
]
const VEHICLE_STATES: readonly RoadVehicleState[] = [
  'idle',
  'driving',
  'waiting',
  'parking',
  'parked',
  'responding',
  'at-stop',
  'returning',
]
const SPEED_LIMITS: readonly SpeedLimit[] = [10, 30, 50]

export function createDefaultLogisticsSnapshot(): LogisticsSnapshot {
  return {
    roadCells: [],
    parkingCells: [],
    arrivalGroups: [],
    roadVehicles: [],
    ambulanceGarages: [],
    busStops: [],
    busDepots: [],
    busLines: [],
    wasteDepots: [],
    specialDepots: [],
  }
}

export function cellKey(x: number, z: number): string {
  return `${x}:${z}`
}

export function edgeKey(x: number, z: number, direction: Direction): string {
  const offset = DIRECTION_OFFSETS[direction]
  const otherX = x + offset.x
  const otherZ = z + offset.z
  const first = cellKey(x, z)
  const second = cellKey(otherX, otherZ)
  return first < second ? `${first}|${second}` : `${second}|${first}`
}

export function directionBit(direction: Direction): number {
  return 1 << direction
}

export function oppositeDirection(direction: Direction): Direction {
  return ((direction + 2) % 4) as Direction
}

export function directionFromDelta(
  deltaX: number,
  deltaZ: number,
): Direction | null {
  if (deltaX === 0 && deltaZ === 1) return 0
  if (deltaX === 1 && deltaZ === 0) return 1
  if (deltaX === 0 && deltaZ === -1) return 2
  if (deltaX === -1 && deltaZ === 0) return 3
  return null
}

export function moveInDirection(
  position: RoadPosition,
  direction: Direction,
): RoadPosition {
  const offset = DIRECTION_OFFSETS[direction]
  return { x: position.x + offset.x, z: position.z + offset.z }
}

export function isRoadDirectionAllowed(
  cell: RoadCell,
  direction: Direction,
): boolean {
  const bit = directionBit(direction)
  return (
    cell.allowedDirections === null ||
    (cell.allowedDirections & bit) !== 0
  )
}

export function createRoadGraph(
  roadCells: readonly RoadCell[],
  worldSize = WORLD_SIZE,
): RoadGraph {
  const byKey = new Map(
    roadCells.map((roadCell) => [cellKey(roadCell.x, roadCell.z), roadCell]),
  )
  const neighbors = new Map<string, RoadCell[]>()
  for (const cell of roadCells) {
    neighbors.set(
      cellKey(cell.x, cell.z),
      collectRoadNeighbors(cell, byKey, worldSize),
    )
  }
  return { cells: roadCells, byKey, neighbors }
}

export function getRoadNeighbors(
  cell: RoadCell,
  roadCells: readonly RoadCell[],
  worldSize = WORLD_SIZE,
): RoadCell[] {
  return collectRoadNeighbors(
    cell,
    new Map(roadCells.map((roadCell) => [cellKey(roadCell.x, roadCell.z), roadCell])),
    worldSize,
  )
}

function collectRoadNeighbors(
  cell: RoadCell,
  roadsByKey: ReadonlyMap<string, RoadCell>,
  worldSize: number,
): RoadCell[] {
  const half = worldSize / 2
  return DIRECTIONS.flatMap((direction) => {
    if (
      !isRoadDirectionAllowed(cell, direction) ||
      (cell.blockedEdges & directionBit(direction)) !== 0
    ) {
      return []
    }
    const position = moveInDirection(cell, direction)
    if (
      position.x < -half ||
      position.x >= half ||
      position.z < -half ||
      position.z >= half
    ) {
      return []
    }
    const neighbor = roadsByKey.get(cellKey(position.x, position.z))
    if (
      !neighbor ||
      (neighbor.blockedEdges &
        directionBit(oppositeDirection(direction))) !==
        0
    ) {
      return []
    }
    return [neighbor]
  })
}

export function findRoadRoute(
  options: FindRoadRouteOptions,
): RoadCell[] | null {
  const graph =
    options.graph ??
    createRoadGraph(options.roadCells, options.worldSize ?? WORLD_SIZE)
  const start = graph.byKey.get(cellKey(options.start.x, options.start.z))
  const targets = [
    ...(options.targets ?? []),
    ...(options.target ? [options.target] : []),
  ]
  const targetKeys = new Set(
    targets
      .map((target) => cellKey(target.x, target.z))
      .filter((key) => graph.byKey.has(key)),
  )
  if (!start || targetKeys.size === 0) return null

  type RouteNode = {
    cell: RoadCell
    direction: Direction | null
  }
  const path = findWeightedPath<RouteNode>({
    start: {
      cell: start,
      direction: options.initialDirection ?? null,
    },
    key: (node) =>
      `${cellKey(node.cell.x, node.cell.z)}:${node.direction ?? 'start'}`,
    isGoal: (node) => targetKeys.has(cellKey(node.cell.x, node.cell.z)),
    neighbors: (node) => {
      const adjacent =
        graph.neighbors.get(cellKey(node.cell.x, node.cell.z)) ?? []
      return adjacent.flatMap((neighbor) => {
        const direction = directionFromDelta(
          neighbor.x - node.cell.x,
          neighbor.z - node.cell.z,
        )
        if (
          direction === null ||
          (!options.allowUTurn &&
            node.direction !== null &&
            direction === oppositeDirection(node.direction)) ||
          options.blockedCells?.has(cellKey(neighbor.x, neighbor.z)) ||
          options.blockedEdges?.has(
            `${node.cell.x}:${node.cell.z}:${direction}`,
          )
        ) {
          return []
        }
        return [{ cell: neighbor, direction }]
      })
    },
    movementCost: (from, to) =>
      60 / Math.min(from.cell.speedLimit, to.cell.speedLimit),
    heuristic: (node) => {
      let nearest = Number.POSITIVE_INFINITY
      for (const target of targets) {
        const distance =
          Math.abs(target.x - node.cell.x) + Math.abs(target.z - node.cell.z)
        if (distance < nearest) nearest = distance
      }
      return nearest * (60 / 50)
    },
  })
  return path?.map((node) => node.cell) ?? null
}

export function normalizeLogisticsSnapshot(value: unknown): LogisticsSnapshot {
  const source = asRecord(value)
  return {
    roadCells: asArray(source?.roadCells)
      .map(normalizeRoadCell)
      .filter(isDefined),
    parkingCells: asArray(source?.parkingCells)
      .map(normalizeParkingCell)
      .filter(isDefined),
    arrivalGroups: asArray(source?.arrivalGroups)
      .map(normalizeArrivalGroup)
      .filter(isDefined),
    roadVehicles: asArray(source?.roadVehicles)
      .map(normalizeRoadVehicle)
      .filter(isDefined),
    ambulanceGarages: asArray(source?.ambulanceGarages)
      .map(normalizeAmbulanceGarage)
      .filter(isDefined),
    busStops: asArray(source?.busStops)
      .map(normalizeBusStop)
      .filter(isDefined),
    busDepots: asArray(source?.busDepots)
      .map(normalizeBusDepot)
      .filter(isDefined),
    busLines: asArray(source?.busLines)
      .map(normalizeBusLine)
      .filter(isDefined),
    wasteDepots: asArray(source?.wasteDepots)
      .map(normalizeWasteDepot)
      .filter(isDefined),
    specialDepots: asArray(source?.specialDepots)
      .map(normalizeSpecialDepot)
      .filter(isDefined),
  }
}

function normalizeRoadCell(value: unknown): RoadCell | null {
  const source = asRecord(value)
  const position = normalizePosition(source)
  if (!source || !position) return null
  const allowedDirections =
    source.allowedDirections === null
      ? null
      : source.allowedDirections === undefined
        ? null
        : normalizeMask(source.allowedDirections, 15)
  return {
    ...position,
    allowedDirections,
    blockedEdges: normalizeMask(source.blockedEdges, 0),
    speedLimit: memberOf(source.speedLimit, SPEED_LIMITS) ?? 30,
    crosswalk: source.crosswalk === true,
  }
}

function normalizeParkingCell(value: unknown): ParkingCell | null {
  const source = asRecord(value)
  const position = normalizePosition(source)
  if (!source || !position) return null
  return {
    ...position,
    occupiedBy: typeof source.occupiedBy === 'string' ? source.occupiedBy : null,
  }
}

function normalizeArrivalGroup(value: unknown): ArrivalGroup | null {
  const source = asRecord(value)
  if (!source || typeof source.id !== 'string') return null
  return {
    id: source.id,
    memberIds: stringArray(source.memberIds),
    vehicleId: nullableString(source.vehicleId),
    mode: memberOf(source.mode, ARRIVAL_MODES) ?? 'pedestrian',
    state: memberOf(source.state, ARRIVAL_STATES) ?? 'approaching',
    arrivedMinute: nullableFiniteNumber(source.arrivedMinute),
    parkingWaitMinutes: nonNegativeNumber(source.parkingWaitMinutes),
    entryFeesPaid: source.entryFeesPaid === true,
  }
}

function normalizeRoadVehicle(value: unknown): RoadVehicle | null {
  const source = asRecord(value)
  if (!source || typeof source.id !== 'string') return null
  const position = normalizePosition(source.position) ?? normalizePosition(source)
  if (!position) return null
  return {
    id: source.id,
    stuckMinutes: nonNegativeNumber(source.stuckMinutes),
    testedGroundCell: typeof source.testedGroundCell === 'string' ? source.testedGroundCell : '',
    kind: memberOf(source.kind, VEHICLE_KINDS) ?? 'visitorCar',
    position,
    cell: normalizePosition(source.cell),
    route: asArray(source.route).map(normalizePosition).filter(isDefined),
    state: memberOf(source.state, VEHICLE_STATES) ?? 'idle',
    speed: nonNegativeNumber(source.speed),
    passengerIds: stringArray(source.passengerIds),
    groupId: nullableString(source.groupId),
    parkingCell: normalizePosition(source.parkingCell),
    target: normalizeVehicleTarget(source.target),
    facing: finiteNumber(source.facing),
    waitMinutes: nonNegativeNumber(source.waitMinutes),
    lineId: nullableString(source.lineId),
    nextStopIndex: Math.floor(nonNegativeNumber(source.nextStopIndex)),
    resumeState: memberOf(source.resumeState, VEHICLE_STATES) ?? null,
    cargo: nonNegativeNumber(source.cargo),
    deliveryId: nullableString(source.deliveryId),
    parkingSearchCursor: Math.floor(nonNegativeNumber(source.parkingSearchCursor)),
  }
}

function normalizeAmbulanceGarage(value: unknown): AmbulanceGarage | null {
  const source = asRecord(value)
  const position = normalizePosition(source)
  if (!source || !position || typeof source.id !== 'string') return null
  const bays = asArray(source.bays)
  return {
    ...position,
    id: source.id,
    bays: [
      nullableString(bays[0]),
      nullableString(bays[1]),
    ],
  }
}

function normalizeBusStop(value: unknown): BusStop | null {
  const source = asRecord(value)
  const position = normalizePosition(source)
  if (!source || !position || typeof source.id !== 'string') return null
  return {
    ...position,
    id: source.id,
    name: typeof source.name === 'string' ? source.name : source.id,
    roadCell: normalizePosition(source.roadCell) ?? { ...position },
  }
}

function normalizeBusDepot(value: unknown): BusDepot | null {
  const source = asRecord(value)
  const position = normalizePosition(source)
  if (!source || !position || typeof source.id !== 'string') return null
  return { ...position, id: source.id, busIds: stringArray(source.busIds) }
}

function normalizeWasteDepot(value: unknown): WasteDepot | null {
  const source = asRecord(value)
  const position = normalizePosition(source)
  if (!source || !position || typeof source.id !== 'string') return null
  return { ...position, id: source.id, truckIds: stringArray(source.truckIds) }
}

function normalizeSpecialDepot(value: unknown): SpecialDepot | null {
  const source = asRecord(value)
  const position = normalizePosition(source)
  if (!source || !position || typeof source.id !== 'string') return null
  return { ...position, id: source.id, vehicleIds: stringArray(source.vehicleIds) }
}

function normalizeBusLine(value: unknown): BusLine | null {
  const source = asRecord(value)
  if (!source || typeof source.id !== 'string') return null
  return {
    id: source.id,
    name: typeof source.name === 'string' ? source.name : source.id,
    depotId: typeof source.depotId === 'string' ? source.depotId : '',
    stopIds: stringArray(source.stopIds),
    busIds: stringArray(source.busIds),
    headway: Math.max(1, nonNegativeNumber(source.headway, 15)),
    active: source.active === true,
    lastDepartureMinute: nullableFiniteNumber(source.lastDepartureMinute),
  }
}

function normalizeVehicleTarget(value: unknown): RoadVehicleTarget | null {
  const source = asRecord(value)
  if (!source || typeof source.kind !== 'string') return null
  if (source.kind === 'cell') {
    const position = normalizePosition(source)
    return position ? { kind: 'cell', ...position } : null
  }
  if (source.kind === 'parking') {
    const parkingCell = normalizePosition(source.parkingCell)
    return parkingCell ? { kind: 'parking', parkingCell } : null
  }
  if (source.kind === 'hold') {
    const parkingCell = normalizePosition(source.parkingCell)
    return parkingCell ? { kind: 'hold', parkingCell } : { kind: 'hold' }
  }
  if (source.kind === 'cruise') return { kind: 'cruise' }
  if (source.kind === 'busStop' && typeof source.stopId === 'string') {
    return { kind: 'busStop', stopId: source.stopId }
  }
  if (source.kind === 'garage' && typeof source.garageId === 'string') {
    return { kind: 'garage', garageId: source.garageId }
  }
  if (source.kind === 'depot' && typeof source.depotId === 'string') {
    return { kind: 'depot', depotId: source.depotId }
  }
  if (source.kind === 'wasteDump') {
    const position = normalizePosition(source)
    return position ? { kind: 'wasteDump', ...position } : null
  }
  return null
}

function normalizePosition(value: unknown): RoadPosition | null {
  const source = asRecord(value)
  if (
    !source ||
    !Number.isFinite(source.x) ||
    !Number.isFinite(source.z)
  ) {
    return null
  }
  return { x: Number(source.x), z: Number(source.z) }
}

function normalizeMask(value: unknown, fallback: number): number {
  return Number.isFinite(value)
    ? Math.max(0, Math.trunc(Number(value))) & 15
    : fallback
}

function nullableFiniteNumber(value: unknown): number | null {
  return Number.isFinite(value) ? Number(value) : null
}

function nonNegativeNumber(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : fallback
}

function finiteNumber(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function stringArray(value: unknown): string[] {
  return asArray(value).filter((entry): entry is string => typeof entry === 'string')
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null
}

function memberOf<T>(
  value: unknown,
  values: readonly T[],
): T | undefined {
  return values.find((candidate) => candidate === value)
}

function isDefined<T>(value: T | null): value is T {
  return value !== null
}
