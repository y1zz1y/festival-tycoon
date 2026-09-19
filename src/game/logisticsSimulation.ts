import { collectSeatedPassengerIds, cellKey, type Direction, type RoadPosition, type RoadVehicle } from './logistics'
import type { Visitor } from './types/entities'
import type { GameSnapshot } from './types/snapshot'

export type LogisticsTickState = {
  occupied: Map<string, string>
  removedVehicles: Set<string>
  removedGroups: Set<string>
  removedVisitors: Set<string>
  vehiclesById: Map<string, RoadVehicle>
  pedestriansByCell: Map<string, Visitor[]>
  busWaitersByCell: Map<string, Visitor[]>
  seatedPassengers: Set<string>
}

export type LogisticsSimulationContext = {
  state: GameSnapshot
  roadPositionKey(position: RoadPosition): string
  isRoadPosition(position: RoadPosition): boolean
  isVisitorSeated(visitor: Visitor, seated: ReadonlySet<string>): boolean
  evaluateAccessSignals(): void
  syncFreightToVehicles(): void
  restoreMissingGarbageTrucks(): void
  resetPerTickCaches(): void
  processVehicles(minutes: number, tick: LogisticsTickState): void
  leaveVisitorCampBehind(visitor: Visitor): void
  normalizeCarManifest(group: GameSnapshot['logistics']['arrivalGroups'][number]): void
  visitorsRemoved(): void
  syncVehiclesToFreight(): void
}

/**
 * Authoritative logistics phase. The order mirrors the historical GameState
 * implementation: access/freight repair, indexes, vehicle progression, removals,
 * then freight projection.
 */
export function updateLogisticsSimulation(
  context: LogisticsSimulationContext,
  minutes: number,
): void {
  context.evaluateAccessSignals()
  context.syncFreightToVehicles()
  context.restoreMissingGarbageTrucks()
  context.resetPerTickCaches()
  const tick = buildLogisticsTickState(context)
  context.processVehicles(minutes, tick)
  finalizeLogisticsTick(context, tick)
  context.syncVehiclesToFreight()
}

export function buildLogisticsTickState(
  context: Pick<
    LogisticsSimulationContext,
    'state' | 'roadPositionKey' | 'isRoadPosition' | 'isVisitorSeated'
  >,
): LogisticsTickState {
  const logistics = context.state.logistics
  const occupied = new Map<string, string>()
  for (const vehicle of logistics.roadVehicles) {
    if (vehicle.housed) continue
    if (vehicle.cell && vehicle.state !== 'parked' && vehicle.kind !== 'sweeper') {
      occupied.set(context.roadPositionKey(vehicle.cell), vehicle.id)
      if (
        vehicle.kind === 'visitorCar' &&
        vehicle.state === 'returning' &&
        vehicle.route[0] &&
        !context.isRoadPosition(vehicle.cell)
      ) {
        occupied.set(context.roadPositionKey(vehicle.route[0]), vehicle.id)
      }
    }
  }
  const vehicleIds = new Set(logistics.roadVehicles.map((vehicle) => vehicle.id))
  const vehiclesById = new Map(logistics.roadVehicles.map((vehicle) => [vehicle.id, vehicle]))
  const pedestriansByCell = new Map<string, Visitor[]>()
  const busWaitersByCell = new Map<string, Visitor[]>()
  const seatedPassengers = collectSeatedPassengerIds(logistics.roadVehicles)
  for (const visitor of context.state.visitors) {
    if (visitor.state === 'bus-waiting') {
      appendByCell(busWaitersByCell, visitor)
    }
    if (
      context.isVisitorSeated(visitor, seatedPassengers) ||
      visitor.state === 'riding' ||
      visitor.state === 'medical'
    ) continue
    appendByCell(pedestriansByCell, visitor)
  }
  for (const parking of logistics.parkingCells) {
    if (parking.occupiedBy && !vehicleIds.has(parking.occupiedBy)) parking.occupiedBy = null
  }
  return {
    occupied,
    removedVehicles: new Set(),
    removedGroups: new Set(),
    removedVisitors: new Set(),
    vehiclesById,
    pedestriansByCell,
    busWaitersByCell,
    seatedPassengers,
  }
}

function appendByCell(index: Map<string, Visitor[]>, visitor: Visitor): void {
  const key = cellKey(visitor.cellX, visitor.cellZ)
  const list = index.get(key)
  if (list) list.push(visitor)
  else index.set(key, [visitor])
}

function finalizeLogisticsTick(
  context: LogisticsSimulationContext,
  tick: LogisticsTickState,
): void {
  const { state } = context
  if (tick.removedVisitors.size > 0) {
    for (const visitor of state.visitors) {
      if (tick.removedVisitors.has(visitor.id)) context.leaveVisitorCampBehind(visitor)
    }
    state.visitors = state.visitors.filter((visitor) => !tick.removedVisitors.has(visitor.id))
    state.guests = state.visitors.length
    for (const group of state.logistics.arrivalGroups) context.normalizeCarManifest(group)
    context.visitorsRemoved()
  }
  state.logistics.roadVehicles = state.logistics.roadVehicles.filter(
    (vehicle) => !tick.removedVehicles.has(vehicle.id),
  )
  state.logistics.arrivalGroups = state.logistics.arrivalGroups.filter(
    (group) => !tick.removedGroups.has(group.id),
  )
}

export function vehicleDirection(vehicle: Pick<RoadVehicle, 'facing'>): Direction {
  return ((Math.round(vehicle.facing / (Math.PI / 2)) % 4 + 4) % 4) as Direction
}

export function resumeVehicleAfterIncident(vehicle: RoadVehicle): boolean {
  if (vehicle.state !== 'waiting' || vehicle.route.length === 0) return false
  vehicle.state =
    vehicle.resumeState === 'returning' ||
    vehicle.resumeState === 'responding' ||
    vehicle.resumeState === 'parking'
      ? vehicle.resumeState
      : vehicle.target?.kind === 'parking'
        ? 'driving'
        : vehicle.resumeState ?? 'driving'
  vehicle.resumeState = null
  vehicle.waitMinutes = 0
  return true
}

export function roadRouteIsConnected(
  start: RoadPosition,
  route: readonly RoadPosition[],
): boolean {
  let previous = start
  for (const cell of route) {
    if (Math.abs(cell.x - previous.x) + Math.abs(cell.z - previous.z) !== 1) return false
    previous = cell
  }
  return route.length > 0
}

export function isSideTurn(
  vehicle: Pick<RoadVehicle, 'cell' | 'facing'>,
  next: RoadPosition,
): boolean {
  const here = vehicle.cell
  if (!here) return false
  const dx = next.x - here.x
  const dz = next.z - here.z
  const move = dz === 1 ? 0 : dx === 1 ? 1 : dz === -1 ? 2 : dx === -1 ? 3 : null
  if (move === null) return false
  const facing = vehicleDirection(vehicle)
  return move !== facing && move !== (facing + 2) % 4
}
