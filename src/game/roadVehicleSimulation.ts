import { installationIsClaimed } from './camping'
import { bookFinance } from './finance'
import { groundInfo, groundKey, roadGroundLimit } from './ground'
import { createPathScratch, findWeightedPath } from './pathfinding'
import { hashStringSeed } from './rng'
import { SIMULATION_CONFIG } from './simulationConfig'
import { isInAnyZone } from './staffZones'
import { stepUsesClosedEdge } from './accessControl'
import { wayInfo } from './wayTypes'
import { emptySealedContainerStored, isSealedWasteContainer, wasteDumpRemaining, acceptWasteAtDump } from './waste'
import { elevationsMatch } from './wayElevation'
import { cellKey as roadCellKey, collectEligibleBusWaiters, collectSeatedPassengerIds, DIRECTION_OFFSETS, DIRECTIONS, directionFromDelta, findRoadRoute, isPlayerOwnedFleetVehicle, isRoadDirectionAllowed, isVehicleReversing, oppositeDirection, roadLayerElevation, roadLayerKey, toRoadPosition } from './logistics'
import type { ArrivalGroup, Direction, FindRoadRouteOptions, ParkingCell, RoadCell, RoadGraph, RoadPosition, RoadVehicle } from './logistics'
import type { Cell, PlacedBuilding, Visitor } from './types/entities'
import type { PedestrianNeighborOptions } from './pedestrianNavigation'
import type { ActionResult, GameSnapshot } from './types/snapshot'
import { isSideTurn as isLogisticsSideTurn, resumeVehicleAfterIncident as resumeLogisticsVehicleAfterIncident, roadRouteIsConnected as logisticsRoadRouteIsConnected, vehicleDirection, type LogisticsTickState } from './logisticsSimulation'
import type { WasteDumpCell } from './waste'

export type RoadVehicleSimulationContext = {
  state: GameSnapshot
  closedTrafficEdges(): ReadonlySet<string>
  closedAllDayTrafficEdges(): ReadonlySet<string>
  lastNavRevision(): number
  worldRevision(): number
  nextRandom(): number
  pedestrianCostAt(cell: Cell): number | undefined
  decideNextAction(visitor: Visitor): void
  beginVehiclePullIn(vehicle: RoadVehicle): void
  canParkedCarDepart(vehicle: RoadVehicle, group: ArrivalGroup): boolean
  completeVisitorCarArrival(vehicle: RoadVehicle): void
  createRoadVehicle(id: string, kind: RoadVehicle['kind'], position: RoadPosition): RoadVehicle
  dispatchTourBuses(): void
  emit(): void
  ensurePedestrianNav(revalidate: boolean): void
  findAvailableRoadEntry(): RoadPosition | null
  findPath(start: Cell, goals: Cell[], allowQueue?: boolean, allowCamping?: boolean, allowMedical?: boolean, ignoreDirectionalRestrictions?: boolean, allowFestival?: boolean, maxVisited?: number, allowStaff?: boolean, allowBackstage?: boolean): Cell[] | null
  finishTourBusLeg(vehicle: RoadVehicle, removedVehicles: Set<string>): void
  finishVehicleParking(vehicle: RoadVehicle): void
  getAdjacentParkingCells(position: RoadPosition): ParkingCell[]
  getAdjacentRoadPositions(position: RoadPosition): RoadPosition[]
  getDirectionIndex(dx: number, dz: number): number
  getLogisticsBuildingAccess(building: RoadPosition, size: number): RoadPosition | null
  getLogisticsPathAccess(building: RoadPosition, size: number): Cell | null
  getOpenParkingApproachRoads(parking: RoadPosition): RoadPosition[]
  getParkingApproachRoads(parking: RoadPosition): RoadPosition[]
  getPathAt(x: number, z: number, elevation?: number): PlacedBuilding | undefined
  getPedestrianNeighbors(cell: Cell, options: PedestrianNeighborOptions): Cell[]
  getPedestrianSurfaceCost(cell: Cell): number
  getRoadCellAt(x: number, z: number, elevation?: number): RoadCell | undefined
  getRoadCellsAt(x: number, z: number): RoadCell[]
  getRoadEntry(): RoadPosition
  getRoadGraph(): RoadGraph
  getSweeperAccessCells(cell: { x: number; z: number; elevation?: number }): Cell[]
  getTerrainHeight(x: number, z: number): number
  getVisitor(id: string): Visitor | undefined
  getWorldSize(): number
  hasArrivalPassengersStillSeated(vehicle: RoadVehicle, group: ArrivalGroup): boolean
  isIllegalParkingPullIn(vehicle: RoadVehicle, here: RoadPosition, next: RoadPosition): boolean
  isMudTerrain(x: number, z: number): boolean
  isSealedWasteContainerOnRoad(building: { x: number; z: number; elevation: number }): boolean
  isSweeperDriveCell(x: number, z: number, elevation?: number): boolean
  isVehicleAtParkingAccess(vehicle: RoadVehicle): boolean
  isVehicleOnItsParkingCell(vehicle: RoadVehicle): boolean
  isVisitorSeatedInVehicle(visitor: Visitor, seated?: ReadonlySet<string>): boolean
  listFreeRoadEntries(excludeVehicleId?: string, requireRoute?: boolean): RoadPosition[]
  nextId(prefix: string): string
  normalizeCarManifest(group: ArrivalGroup): void
  packCell(cell: Cell): number
  recordComplaint(visitor: Visitor, topic: 'traffic-accident' | 'no-parking' | 'bus-full'): void
  refundEntryFee(visitor: Visitor): void
  roadPositionKey(position: RoadPosition): string
  searchReachableRoadExit(start: RoadPosition, initialDirection: Direction, blockedCells?: ReadonlySet<string>, allowUTurn?: boolean): { position: RoadPosition; route: RoadCell[] } | null
}


export class RoadVehicleSimulation {
  private claimedTentCellsCache: Set<string> | null = null
  private visitorsOnCellsThisTick: Set<string> | null = null
  private readonly roadExitRoutes = new WeakMap<RoadGraph, Map<string, { position: RoadPosition; route: RoadCell[] } | null>>()
  private readonly sweeperPathScratch = createPathScratch<Cell>()

  private readonly context: RoadVehicleSimulationContext

  constructor(context: RoadVehicleSimulationContext) { this.context = context }

  resetPerTickCaches(): void {
    this.claimedTentCellsCache = null
    this.visitorsOnCellsThisTick = null
  }

  processLogisticsVehicles(
    minutes: number,
    tick: LogisticsTickState,
  ): void {
    const logistics = this.context.state.logistics
    const {
      occupied,
      removedVehicles,
      removedGroups,
      removedVisitors,
      vehiclesById,
      pedestriansByCell,
      busWaitersByCell,
      seatedPassengers,
    } = tick
    let parkingSearches = 0
    this.visitorsOnCellsThisTick = new Set(pedestriansByCell.keys())
    logistics.roadVehicles.forEach((vehicle) => {
      if (
        vehicle.kind === 'visitorCar' &&
        vehicle.state === 'parked'
      ) {
        const group = logistics.arrivalGroups.find(
          (candidate) => candidate.id === vehicle.groupId,
        )
        if (!group) {
          if (vehicle.parkingCell) {
            const parking = logistics.parkingCells.find(
              (cell) =>
                cell.x === vehicle.parkingCell?.x &&
                cell.z === vehicle.parkingCell?.z,
            )
            if (parking) parking.occupiedBy = null
          }
          removedVehicles.add(vehicle.id)
          return
        }
        this.context.normalizeCarManifest(group)
        if (this.context.hasArrivalPassengersStillSeated(vehicle, group)) {
          this.context.finishVehicleParking(vehicle)
        }
        if (this.context.canParkedCarDepart(vehicle, group)) {
          const departure = this.startParkedCarDeparture(vehicle, group, occupied)
          vehicle.waitMinutes = departure === 'no-route'
            ? Math.min(vehicle.waitMinutes + minutes, 2)
            : 0
          if (departure === 'started' && vehicle.route[0]) {
            occupied.set(this.context.roadPositionKey(vehicle.route[0]), vehicle.id)
          }
        } else {
          vehicle.waitMinutes = 0
        }
      }
      if (
        vehicle.cell &&
        !vehicle.housed &&
        vehicle.state !== 'parked' &&
        vehicle.kind !== 'sweeper'
      ) {
        occupied.set(
          this.context.roadPositionKey(vehicle.cell),
          vehicle.id,
        )
      }
    })

    this.dispatchIdleAmbulances()
    this.returnIdleAmbulancesToGarage()
    this.dispatchIdleFireTrucks()
    this.returnIdleFireTrucks()
    this.context.dispatchTourBuses()
    logistics.roadVehicles.forEach((vehicle) => {
      if (removedVehicles.has(vehicle.id)) return
      if (vehicle.kind === 'bus') {
        this.updateBusAtStop(vehicle, minutes, busWaitersByCell)
        if (vehicle.state === 'idle') this.dispatchBus(vehicle)
      }
      if (vehicle.kind === 'fireTruck') {
        if (this.isFireTruckAtHome(vehicle) && vehicle.state === 'idle') return
        if (vehicle.state === 'responding' && vehicle.route.length === 0) {
          const fire = this.context.state.incidents.find(
            (incident) =>
              incident.kind === 'fire' &&
              incident.x === (vehicle.cell?.x ?? vehicle.position.x) &&
              incident.z === (vehicle.cell?.z ?? vehicle.position.z),
          )
          if (!fire) this.sendFireTruckHome(vehicle)
          return
        }
      }
      if (vehicle.kind === 'garbageTruck') {
        if (vehicle.state === 'idle') {
          this.dispatchGarbageTruck(vehicle)
          if (vehicle.state === 'idle' && !this.isGarbageTruckAtHome(vehicle)) {
            this.continueGarbageTruck(vehicle)
          }
        }
        if (vehicle.state === 'waiting') {
          if (this.isAccidentVictimBlockingVehicle(vehicle)) return
          if (
            this.isOffMapRoadExit(vehicle.cell ?? vehicle.position) &&
            vehicle.cargo <= 0
          ) {
            vehicle.waitMinutes += minutes
            if (vehicle.waitMinutes < SIMULATION_CONFIG.waste.truckUnloadMinutes) {
              return
            }
            if (this.reenterGarbageTruck(vehicle)) return
            if (
              vehicle.waitMinutes >=
              SIMULATION_CONFIG.waste.truckUnloadMinutes +
                SIMULATION_CONFIG.logistics.vehicleUnstickMinutes
            ) {
              this.returnGarbageTruckToDepot(vehicle)
            }
            return
          }
          if (this.resumeVehicleAfterIncident(vehicle)) {
            // continue into movement below
          } else {
            vehicle.waitMinutes -= minutes
            if (vehicle.waitMinutes <= 0) {
              this.continueGarbageTruck(vehicle)
            }
            return
          }
        }
      }
      if (vehicle.kind === 'sweeper') {
        this.updateSweeper(vehicle, minutes)
        return
      }
      if (vehicle.state === 'waiting' && this.isAccidentVictimBlockingVehicle(vehicle)) {
        return
      }
      if (
        vehicle.kind !== 'visitorCar' &&
        vehicle.state === 'waiting' &&
        this.resumeVehicleAfterIncident(vehicle)
      ) {
        // continue into movement below
      }
      if (vehicle.kind === 'visitorCar' && vehicle.state === 'waiting') {
        if (this.resumeVehicleAfterIncident(vehicle)) {
          // continue into movement or parking pull-in
        } else if (vehicle.parkingCell && vehicle.target?.kind === 'parking') {
          vehicle.state = 'parking'
          vehicle.resumeState = null
          vehicle.waitMinutes = 0
        } else {
          const canSearch = parkingSearches < 2
          this.assignVisitorCarParking(
            vehicle,
            minutes,
            removedVisitors,
            removedGroups,
            removedVehicles,
            canSearch,
          )
          if (canSearch) parkingSearches += 1
          if (vehicle.state === 'waiting') return
        }
      }
      if (this.claimAdjacentFreeParking(vehicle)) {
        // pull into the first free bay beside this cell
      }

      if (
        vehicle.state !== 'driving' &&
        vehicle.state !== 'responding' &&
        vehicle.state !== 'returning' &&
        vehicle.state !== 'parking'
      ) {
        return
      }
      const mudSlowdown = vehicle.cell && this.context.isMudTerrain(vehicle.cell.x, vehicle.cell.z)
        ? SIMULATION_CONFIG.terrain.mudMoveMultiplier
        : 1
      if ((vehicle.stuckMinutes ?? 0) > 0) { vehicle.stuckMinutes = Math.max(0, vehicle.stuckMinutes! - minutes); return }
      const ground = vehicle.cell ? groundInfo(this.context.state, vehicle.cell.x, vehicle.cell.z) : null
      const groundCell = vehicle.cell ? groundKey(vehicle.cell.x, vehicle.cell.z) : ''
      if (vehicle.testedGroundCell !== groundCell) {
        vehicle.testedGroundCell = groundCell
        if (ground && ground.wet > .5 && hashStringSeed(`${vehicle.id}:${groundCell}`) % 100 < ground.wet * wayInfo(this.context.state, vehicle.cell!.x, vehicle.cell!.z, 'road').stuck * 100) { vehicle.stuckMinutes = 8; return }
      }
      vehicle.speed += minutes * mudSlowdown * (vehicle.cell ? wayInfo(this.context.state, vehicle.cell.x, vehicle.cell.z, 'road').speed : 1)
      const currentRoad = vehicle.cell
        ? this.context.getRoadCellAt(vehicle.cell.x, vehicle.cell.z, vehicle.cell.elevation)
        : undefined
      if (currentRoad?.allowedDirections != null) {
        const facing = this.getVehicleDirection(vehicle)
        if (!isRoadDirectionAllowed(currentRoad, facing) &&
            isRoadDirectionAllowed(currentRoad, oppositeDirection(facing))) {
          vehicle.facing = oppositeDirection(facing) * Math.PI / 2
          this.rebuildVehicleRouteFromHere(vehicle)
        }
      }
      const interval =
        SIMULATION_CONFIG.logistics.vehicleMoveIntervalMinutes *
        (30 / Math.min(currentRoad?.speedLimit ?? 30, vehicle.cell ? roadGroundLimit(this.context.state, vehicle.cell.x, vehicle.cell.z) : 30))
      const next = vehicle.route[0]
      if (!next) {
        if (vehicle.kind === 'visitorCar' && vehicle.state === 'returning' &&
          !this.isVisitorCarExit(vehicle.cell ?? vehicle.position)) {
          this.rebuildVehicleRouteFromHere(vehicle)
          if (vehicle.route.length === 0) vehicle.waitMinutes += minutes
          return
        }
        if (vehicle.kind === 'tourBus') {
          this.context.finishTourBusLeg(vehicle, removedVehicles)
        } else if (vehicle.kind === 'ambulance') {
          this.finishAmbulanceLeg(vehicle)
        } else if (vehicle.kind === 'fireTruck') {
          if (vehicle.state === 'returning') this.sendFireTruckHome(vehicle)
          else vehicle.state = 'responding'
        } else if (vehicle.kind === 'garbageTruck') {
          this.finishGarbageTruckLeg(vehicle)
        } else if (vehicle.kind === 'deliveryTruck') {
          this.finishDeliveryTruckLeg(vehicle, removedVehicles)
        } else if (
          vehicle.kind === 'bus' &&
          vehicle.target?.kind === 'busStop'
        ) {
          vehicle.state = 'at-stop'
          vehicle.waitMinutes = 0
        } else if (
          vehicle.state === 'returning' &&
          !isPlayerOwnedFleetVehicle(vehicle)
        ) {
          vehicle.passengerIds.forEach((visitorId) => {
            removedVisitors.add(visitorId)
          })
          removedVehicles.add(vehicle.id)
          if (vehicle.groupId) removedGroups.add(vehicle.groupId)
        } else if (vehicle.kind === 'visitorCar') {
          this.context.completeVisitorCarArrival(vehicle)
        } else {
          vehicle.state = 'idle'
        }
        return
      }
      const nextKey = this.context.roadPositionKey(next)
      const here = vehicle.cell ?? vehicle.position
      if (!this.isLegalRoadStep(here, next)) {
        vehicle.route = []
        this.rebuildVehicleRouteFromHere(vehicle)
        return
      }
      if (this.context.isIllegalParkingPullIn(vehicle, here, next)) {
        this.releaseVisitorCarParking(vehicle)
        vehicle.route = []
        vehicle.state = 'waiting'
        vehicle.waitMinutes = 0
        return
      }
      if (stepUsesClosedEdge(here.x, here.z, next.x, next.z, this.context.closedTrafficEdges())) {
        if (this.rerouteAwayFromRedLight(vehicle, next)) return
        vehicle.waitMinutes += minutes
        return
      }
      const truckBlocks = this.context.state.festival.infrastructure.trucks.some(
        (truck) =>
          !this.context.state.logistics.roadVehicles.some(
            (candidate) =>
              candidate.kind === 'deliveryTruck' &&
              (candidate.deliveryId === truck.id || candidate.id === truck.id),
          ) &&
          truck.x === next.x &&
          truck.z === next.z &&
          this.context.roadPositionKey(truck) === nextKey,
      )
      const blocker = occupied.get(nextKey)
      if (truckBlocks || (blocker && blocker !== vehicle.id)) {
        if (this.maybeReplanHeadOn(vehicle, occupied, vehiclesById)) return
        if (this.replanOffMapDelivery(vehicle, occupied)) return
        if (this.replanBlockedReverse(vehicle, occupied)) return
        if (this.replanBlockedTurn(vehicle, occupied)) return
        vehicle.waitMinutes += minutes
        if (
          vehicle.waitMinutes >=
          SIMULATION_CONFIG.logistics.vehicleUnstickMinutes
        ) {
          this.unstickVehicle(vehicle, occupied, removedVehicles, removedGroups, removedVisitors)
        }
        return
      }
      if (
        vehicle.waitMinutes < 2 &&
        this.mustYieldToVehicleFromRight(
          vehicle,
          next,
          occupied,
          vehiclesById,
        )
      ) {
        vehicle.waitMinutes += minutes
        return
      }
      const road = this.context.getRoadCellAt(next.x, next.z, next.elevation)
      const pedestrians = (pedestriansByCell.get(roadCellKey(next.x, next.z)) ?? []).filter(
        (visitor) =>
          elevationsMatch(visitor.cellElevation,
            road ? roadLayerElevation(road) : this.context.getTerrainHeight(next.x, next.z)),
      )
      if (
        pedestrians.length > 0 &&
        vehicle.kind !== 'ambulance'
      ) {
        const blockingInjured = pedestrians.some(
          (visitor) =>
            visitor.state === 'injured' ||
            visitor.state === 'medical-transport',
        )
        const brakingChance = road?.crosswalk
          ? 1
          : SIMULATION_CONFIG.logistics.brakingChanceBySpeed[
              road?.speedLimit ?? 30
            ]
        if (blockingInjured) {
          vehicle.waitMinutes += minutes
          if (
            vehicle.waitMinutes >=
            SIMULATION_CONFIG.logistics.vehicleUnstickMinutes
          ) {
            this.unstickVehicle(vehicle, occupied, removedVehicles, removedGroups, removedVisitors)
          }
          return
        }
        if (
          vehicle.waitMinutes <
            SIMULATION_CONFIG.logistics.vehicleUnstickMinutes &&
          this.context.nextRandom() < brakingChance
        ) {
          vehicle.waitMinutes += minutes
          return
        }
        if (
          vehicle.waitMinutes <
            SIMULATION_CONFIG.logistics.vehicleUnstickMinutes
        ) {
          const victim = pedestrians[0]!
          if (this.context.isVisitorSeatedInVehicle(victim, seatedPassengers)) {
            return
          }
          victim.needs.energy = 0
          victim.state = 'injured'
          victim.route = []
          victim.streakingMinutes = 0
          victim.toplessMinutes = 0
          victim.injuryVehicleId = vehicle.id
          victim.thought = 'Ich wurde von einem Fahrzeug angefahren!'
          this.context.recordComplaint(victim, 'traffic-accident')
          vehicle.resumeState = vehicle.state
          vehicle.state = 'waiting'
          vehicle.speed = 0
          return
        }
      }
      if (vehicle.speed < interval) return
      vehicle.speed %= interval
      const reversing = isVehicleReversing(vehicle)
      if (vehicle.cell) {
        occupied.delete(this.context.roadPositionKey(vehicle.cell))
      }
      vehicle.cell = { ...next }
      if (!reversing) {
        vehicle.facing = Math.atan2(
          next.x - vehicle.position.x,
          next.z - vehicle.position.z,
        )
      }
      vehicle.position = { ...next }
      if (road?.allowedDirections != null) {
        const facing = this.getVehicleDirection(vehicle)
        if (!isRoadDirectionAllowed(road, facing) && isRoadDirectionAllowed(road, oppositeDirection(facing))) {
          vehicle.facing = oppositeDirection(facing) * Math.PI / 2
        }
      }
      vehicle.passengerIds.forEach((visitorId) => {
        const passenger = this.context.getVisitor(visitorId)
        if (!passenger) return
        passenger.x = next.x + 0.5
        passenger.z = next.z + 0.5
        passenger.cellX = next.x
        passenger.cellZ = next.z
        passenger.cellElevation = next.elevation ?? this.context.getTerrainHeight(next.x, next.z)
        passenger.y = passenger.cellElevation
      })
      vehicle.route.shift()
      vehicle.waitMinutes = 0
      occupied.set(nextKey, vehicle.id)
      if (this.claimAdjacentFreeParking(vehicle)) {
        return
      }
      if (vehicle.route.length === 0 && vehicle.kind === 'visitorCar') {
        if (vehicle.state === 'returning') {
          if (!this.isVisitorCarExit(vehicle.cell ?? vehicle.position)) return
          vehicle.passengerIds.forEach((visitorId) => {
            removedVisitors.add(visitorId)
          })
          removedVehicles.add(vehicle.id)
          if (vehicle.groupId) removedGroups.add(vehicle.groupId)
        } else {
          this.context.completeVisitorCarArrival(vehicle)
        }
      }
    })

  }

  mustYieldToVehicleFromRight(
    vehicle: RoadVehicle,
    target: RoadPosition,
    occupied: ReadonlyMap<string, string>,
    vehiclesById: ReadonlyMap<string, RoadVehicle>,
  ): boolean {
    if (!vehicle.cell) return false
    const neighbors = this.context.getAdjacentRoadPositions(target)
    if (neighbors.length < 3) return false
    const direction = this.context.getDirectionIndex(
      target.x - vehicle.cell.x,
      target.z - vehicle.cell.z,
    ) as Direction
    const rightSide = (direction + 3) % 4
    const offset = [
      { x: 0, z: 1 },
      { x: 1, z: 0 },
      { x: 0, z: -1 },
      { x: -1, z: 0 },
    ][rightSide]!
    return this.context.getRoadCellsAt(target.x + offset.x, target.z + offset.z).some((road) => {
      const candidateId = occupied.get(this.context.roadPositionKey(road))
      const candidate = candidateId ? vehiclesById.get(candidateId) : undefined
      const next = candidate?.route[0]
      return Boolean(candidate && candidate.id !== vehicle.id && next &&
        this.context.roadPositionKey(next) === this.context.roadPositionKey(target) &&
        this.isLegalRoadStep(road, target))
    })
  }

  getVehicleDirection(vehicle: RoadVehicle): Direction {
    return vehicleDirection(vehicle)
  }

  isAccidentVictimBlockingVehicle(vehicle: RoadVehicle): boolean {
    const here = vehicle.cell ?? vehicle.position
    const next = vehicle.route[0]
    const seated = collectSeatedPassengerIds(this.context.state.logistics.roadVehicles)
    return this.context.state.visitors.some((visitor) => {
      if (
        visitor.state !== 'injured' ||
        visitor.injuryVehicleId !== vehicle.id ||
        this.context.isVisitorSeatedInVehicle(visitor, seated)
      ) {
        return false
      }
      if (visitor.cellX === here.x && visitor.cellZ === here.z) return true
      return Boolean(next && visitor.cellX === next.x && visitor.cellZ === next.z)
    })
  }

  resumeVehicleAfterIncident(vehicle: RoadVehicle): boolean {
    return resumeLogisticsVehicleAfterIncident(vehicle)
  }

  assignVisitorCarParking(
    vehicle: RoadVehicle,
    minutes: number,
    removedVisitors: Set<string>,
    removedGroups: Set<string>,
    removedVehicles: Set<string>,
    canSearch: boolean,
  ): void {
    const group = this.context.state.logistics.arrivalGroups.find(
      (candidate) => candidate.id === vehicle.groupId,
    )
    if (!group) {
      removedVehicles.add(vehicle.id)
      return
    }
    if (!canSearch) {
      if (this.isVisitorCarOnIngress(vehicle) && vehicle.route.length === 0) {
        this.sendVisitorCarCirculating(vehicle)
      }
      return
    }
    if (group.state === 'waiting-for-parking') {
      group.parkingWaitMinutes += minutes
      vehicle.waitMinutes += minutes
      if (
        group.parkingWaitMinutes >=
        SIMULATION_CONFIG.logistics.parkingSearchTimeoutMinutes
      ) {
        group.memberIds.forEach((visitorId) => {
          const visitor = this.context.getVisitor(visitorId)
          if (!visitor) return
          this.context.refundEntryFee(visitor)
          this.context.recordComplaint(visitor, 'no-parking')
          removedVisitors.add(visitor.id)
        })
        removedGroups.add(group.id)
        removedVehicles.add(vehicle.id)
        return
      }
      if (
        vehicle.waitMinutes <
        SIMULATION_CONFIG.logistics.parkingRetryMinutes
      ) {
        return
      }
      vehicle.waitMinutes = 0
    }
    if (this.claimAdjacentFreeParking(vehicle)) {
      group.state = 'approaching'
      return
    }
    const freeBays = this.context.state.logistics.parkingCells.some(
      (cell) => cell.occupiedBy === null,
    )
    if (!freeBays) {
      group.state = 'waiting-for-parking'
      group.memberIds.forEach((visitorId) => {
        const visitor = this.context.getVisitor(visitorId)
        if (visitor) {
          visitor.motivation = Math.max(
            0,
            visitor.motivation - minutes * 0.018,
          )
          visitor.thought = this.isVisitorCarHoldingNearParking(vehicle)
            ? 'Wir warten vor dem Parkplatz, bis einer frei wird.'
            : 'Wir fahren erstmal weiter und suchen einen freien Parkplatz.'
        }
      })
    }
    const plan =
      this.findRouteTowardParking(vehicle) ??
      this.findVisitorCarCirculation(vehicle)
    if (plan) {
      this.applyVisitorCarSearchRoute(vehicle, plan)
      if (freeBays) group.state = 'approaching'
      return
    }
    group.state = 'waiting-for-parking'
    vehicle.waitMinutes = 0
    if (
      this.isVisitorCarOnIngress(vehicle) ||
      !this.isVisitorCarHoldingNearParking(vehicle)
    ) {
      this.sendVisitorCarCirculating(vehicle)
    }
  }

  dispatchIncomingVisitorCar(vehicle: RoadVehicle): void {
    const unused = new Set<string>()
    this.assignVisitorCarParking(vehicle, 0, unused, unused, unused, true)
    if (vehicle.state === 'waiting' && vehicle.route.length === 0) {
      this.sendVisitorCarCirculating(vehicle)
    }
  }

  isVisitorCarOnIngress(vehicle: RoadVehicle): boolean {
    const cell = vehicle.cell ?? vehicle.position
    return cell.z === -this.context.getWorldSize() / 2 && cell.x >= -3 && cell.x <= 2
  }

  isVisitorCarHoldingNearParking(vehicle: RoadVehicle): boolean {
    const cell = vehicle.cell ?? vehicle.position
    return this.context.state.logistics.parkingCells.some((parking) =>
      this.context.getParkingApproachRoads(parking).some(
        (approach) => this.context.roadPositionKey(approach) === this.context.roadPositionKey(cell),
      ),
    )
  }

  releaseVisitorCarParking(vehicle: RoadVehicle): void {
    if (!vehicle.parkingCell) return
    const parking = this.context.state.logistics.parkingCells.find(
      (cell) =>
        cell.x === vehicle.parkingCell?.x &&
        cell.z === vehicle.parkingCell?.z &&
        cell.occupiedBy === vehicle.id,
    )
    if (parking) parking.occupiedBy = null
    vehicle.parkingCell = null
    if (vehicle.target?.kind === 'parking') vehicle.target = null
  }

  isVisitorCarSeekingParking(vehicle: RoadVehicle): boolean {
    return (
      vehicle.kind === 'visitorCar' &&
      vehicle.state !== 'returning' &&
      vehicle.state !== 'parked' &&
      vehicle.state !== 'parking' &&
      !vehicle.parkingCell
    )
  }

  forgetDistantParkingReservation(vehicle: RoadVehicle): void {
    if (!vehicle.parkingCell) return
    if (vehicle.state === 'parking' || vehicle.state === 'parked') return
    if (
      this.context.isVehicleOnItsParkingCell(vehicle) ||
      this.context.isVehicleAtParkingAccess(vehicle)
    ) {
      return
    }
    this.releaseVisitorCarParking(vehicle)
  }

  claimAdjacentFreeParking(vehicle: RoadVehicle): boolean {
    if (vehicle.kind !== 'visitorCar' || vehicle.state === 'returning') return false
    if (vehicle.state === 'parked' || vehicle.state === 'parking') return false
    this.forgetDistantParkingReservation(vehicle)
    if (vehicle.parkingCell) return false
    const here = vehicle.cell ?? vehicle.position
    const bay = this.context.getAdjacentParkingCells(here)
      .filter(
        (cell) =>
          cell.occupiedBy === null &&
          this.context.getOpenParkingApproachRoads(cell).some(
            (access) => this.context.roadPositionKey(access) === this.context.roadPositionKey(here),
          ),
      )
      .sort((left, right) => left.x - right.x || left.z - right.z)[0]
    if (!bay) return false
    bay.occupiedBy = vehicle.id
    vehicle.parkingCell = { x: bay.x, z: bay.z }
    this.context.beginVehiclePullIn(vehicle)
    return true
  }

  applyVisitorCarSearchRoute(
    vehicle: RoadVehicle,
    plan: { route: RoadPosition[]; target: NonNullable<RoadVehicle['target']> },
  ): void {
    this.forgetDistantParkingReservation(vehicle)
    vehicle.route = plan.route.map(toRoadPosition)
    vehicle.target = plan.target
    vehicle.state = plan.route.length > 0 ? 'driving' : 'waiting'
    vehicle.waitMinutes = 0
  }

  routePreferringOpenLights(
    options: FindRoadRouteOptions,
  ): RoadCell[] | null {
    return (
      findRoadRoute({
        ...options,
        blockedEdges: this.context.closedTrafficEdges(),
      }) ??
      findRoadRoute({
        ...options,
        blockedEdges: this.context.closedAllDayTrafficEdges(),
      })
    )
  }

  findRouteTowardParking(
    vehicle: RoadVehicle,
    blockedCells?: ReadonlySet<string>,
  ): { route: RoadPosition[]; target: NonNullable<RoadVehicle['target']> } | null {
    const start = vehicle.cell ?? vehicle.position
    const freeApproaches: RoadPosition[] = []
    const allApproaches: RoadPosition[] = []
    const seenFree = new Set<string>()
    const seenAll = new Set<string>()
    const nearbyParking = new Map<string, RoadPosition>()
    for (const parking of this.context.state.logistics.parkingCells) {
      for (const approach of this.context.getParkingApproachRoads(parking)) {
        const key = roadCellKey(approach.x, approach.z)
        if (approach.x === start.x && approach.z === start.z) continue
        if (!seenAll.has(key)) {
          seenAll.add(key)
          allApproaches.push(approach)
        }
        if (!nearbyParking.has(key)) nearbyParking.set(key, { x: parking.x, z: parking.z })
      }
      if (parking.occupiedBy !== null) continue
      for (const approach of this.context.getOpenParkingApproachRoads(parking)) {
        const key = roadCellKey(approach.x, approach.z)
        if (approach.x === start.x && approach.z === start.z) continue
        if (!seenFree.has(key)) {
          seenFree.add(key)
          freeApproaches.push(approach)
        }
      }
    }
    const tryTargets = (targets: RoadPosition[]): RoadCell[] | null => {
      if (!targets.length) return null
      return this.routePreferringOpenLights({
        roadCells: this.context.state.logistics.roadCells,
        graph: this.context.getRoadGraph(),
        start,
        targets,
        initialDirection: this.getVehicleDirection(vehicle),
        blockedCells,
        allowUTurn: false,
      })
    }
    const route = tryTargets(freeApproaches) ?? tryTargets(allApproaches)
    if (!route?.length) return null
    const last = route.at(-1)!
    const parking = nearbyParking.get(roadCellKey(last.x, last.z))
    return {
      route: route.map(toRoadPosition),
      target: parking
        ? { kind: 'hold', parkingCell: { ...parking } }
        : { kind: 'cruise' },
    }
  }

  rerouteAwayFromRedLight(
    vehicle: RoadVehicle,
    blockedNext: RoadPosition,
  ): boolean {
    if (vehicle.kind === 'sweeper') return false
    const waited =
      vehicle.waitMinutes >=
      SIMULATION_CONFIG.logistics.accessRerouteMinutes
    const allowUTurn =
      waited &&
      (vehicle.kind === 'deliveryTruck' || vehicle.kind === 'garbageTruck')
    if (this.isVisitorCarSeekingParking(vehicle)) {
      const plan =
        this.findRouteTowardParking(vehicle) ??
        this.findVisitorCarCirculation(vehicle)
      if (!plan?.route.length) return false
      if (!this.adoptOpenLightDetour(vehicle, plan.route, blockedNext, allowUTurn)) {
        return false
      }
      vehicle.target = plan.target
      return true
    }
    const targets = this.collectVehicleRouteTargets(vehicle)
    if (!targets.length) return false
    const here = vehicle.cell ?? vehicle.position
    const route = this.routePreferringOpenLights({
      roadCells: this.context.state.logistics.roadCells,
      graph: this.context.getRoadGraph(),
      start: here,
      targets,
      initialDirection: this.getVehicleDirection(vehicle),
      allowUTurn,
    })
    if (!route?.length) return false
    return this.adoptOpenLightDetour(vehicle, route, blockedNext, allowUTurn)
  }

  adoptOpenLightDetour(
    vehicle: RoadVehicle,
    route: readonly RoadPosition[],
    blockedNext: RoadPosition,
    allowUTurn: boolean,
  ): boolean {
    const first = route[0]
    if (!first) return false
    if (first.x === blockedNext.x && first.z === blockedNext.z) return false
    const here = vehicle.cell ?? vehicle.position
    if (
      stepUsesClosedEdge(
        here.x,
        here.z,
        first.x,
        first.z,
        this.context.closedTrafficEdges(),
      )
    ) {
      return false
    }
    const facing = this.getVehicleDirection(vehicle)
    const step = directionFromDelta(first.x - here.x, first.z - here.z)
    if (step === oppositeDirection(facing) && !allowUTurn) return false
    if (step !== null) vehicle.facing = step * (Math.PI / 2)
    vehicle.route = route.map(toRoadPosition)
    vehicle.waitMinutes = 0
    if (vehicle.state === 'waiting') {
      vehicle.state = vehicle.resumeState ?? 'driving'
      vehicle.resumeState = null
    }
    const truck = this.getDeliveryFreight(vehicle)
    if (truck) {
      truck.path = vehicle.route.map(toRoadPosition)
    }
    return true
  }

  sendVisitorCarCirculating(
    vehicle: RoadVehicle,
    blockedCells?: ReadonlySet<string>,
  ): boolean {
    const plan = this.findVisitorCarCirculation(vehicle, blockedCells)
    if (plan) {
      vehicle.route = plan.route
      vehicle.target = plan.target
      vehicle.state = plan.route.length > 0 ? 'driving' : 'waiting'
      vehicle.waitMinutes = 0
      return plan.route.length > 0 || vehicle.state === 'waiting'
    }
    return this.nudgeVehicleAlongRoad(vehicle, blockedCells)
  }

  findVisitorCarCirculation(
    vehicle: RoadVehicle,
    blockedCells?: ReadonlySet<string>,
  ): { route: RoadPosition[]; target: NonNullable<RoadVehicle['target']> } | null {
    const start = vehicle.cell ?? vehicle.position
    const edgeZ = -this.context.getWorldSize() / 2
    const taken = new Set(
      this.context.state.logistics.roadVehicles
        .filter(
          (other) =>
            other.id !== vehicle.id &&
            other.cell &&
            other.state !== 'parked',
        )
        .map((other) => this.context.roadPositionKey(other.cell!)),
    )
    blockedCells?.forEach((key) => taken.add(key))
    const holdFor = new Map<string, { x: number; z: number }>()
    const holds: RoadPosition[] = []
    for (const parking of this.context.state.logistics.parkingCells) {
      for (const approach of this.context.getParkingApproachRoads(parking)) {
        const key = roadCellKey(approach.x, approach.z)
        if (approach.x === start.x && approach.z === start.z) continue
        if (taken.has(this.context.roadPositionKey(approach)) || taken.has(key) || holdFor.has(key)) continue
        holdFor.set(key, { x: parking.x, z: parking.z })
        holds.push(approach)
      }
    }
    holds.sort(
      (left, right) =>
        Math.abs(left.x - start.x) +
        Math.abs(left.z - start.z) -
        (Math.abs(right.x - start.x) + Math.abs(right.z - start.z)),
    )
    const holdTargets = holds.slice(0, 8)
    if (holdTargets.length) {
      const route = findRoadRoute({
        roadCells: this.context.state.logistics.roadCells,
        graph: this.context.getRoadGraph(),
        start,
        targets: holdTargets,
        initialDirection: this.getVehicleDirection(vehicle),
        blockedCells,
        allowUTurn: false,
      })
      if (route && route.length) {
        const last = route.at(-1)!
        const parking = holdFor.get(roadCellKey(last.x, last.z))
        return {
          route: route.map(toRoadPosition),
          target: parking
            ? { kind: 'hold', parkingCell: { ...parking } }
            : { kind: 'cruise' },
        }
      }
    }
    const inland = this.context.state.logistics.roadCells
      .filter((cell) => {
        if (cell.x === start.x && cell.z === start.z) return false
        const distance = Math.abs(cell.x - start.x) + Math.abs(cell.z - start.z)
        return cell.z >= edgeZ + 2 && distance >= 3 && !taken.has(this.context.roadPositionKey(cell)) && !taken.has(roadCellKey(cell.x, cell.z))
      })
      .sort(
        (left, right) =>
          right.z - left.z ||
          Math.abs(left.x - start.x) +
            Math.abs(left.z - start.z) -
            (Math.abs(right.x - start.x) + Math.abs(right.z - start.z)),
      )
      .slice(0, 8)
    const cruiseTargets = inland.length
      ? inland
      : this.context.state.logistics.roadCells
          .filter(
            (cell) =>
              !(cell.x === start.x && cell.z === start.z) && cell.z > edgeZ,
          )
          .slice(0, 8)
    if (!cruiseTargets.length) return null
    const cruise = findRoadRoute({
      roadCells: this.context.state.logistics.roadCells,
      graph: this.context.getRoadGraph(),
      start,
      targets: cruiseTargets,
      initialDirection: this.getVehicleDirection(vehicle),
      blockedCells,
      allowUTurn: false,
    })
    if (!cruise?.length) return null
    return {
      route: cruise.map(toRoadPosition),
      target: { kind: 'cruise' },
    }
  }

  nudgeVehicleAlongRoad(
    vehicle: RoadVehicle,
    blockedCells?: ReadonlySet<string>,
  ): boolean {
    const start = vehicle.cell
    if (!start) return false
    const here = this.context.getRoadCellAt(start.x, start.z, start.elevation)
    if (!here) return false
    const facing = this.getVehicleDirection(vehicle)
    const order: Direction[] = [
      facing,
      ((facing + 1) % 4) as Direction,
      ((facing + 3) % 4) as Direction,
    ]
    const neighbors = this.context.getRoadGraph().neighbors.get(this.context.roadPositionKey(here)) ?? []
    const next = order.flatMap((direction) => neighbors.filter((cell) =>
      directionFromDelta(cell.x - start.x, cell.z - start.z) === direction,
    )).find((cell) => !blockedCells?.has(this.context.roadPositionKey(cell)) &&
      !blockedCells?.has(roadCellKey(cell.x, cell.z)))
    if (!next) return false
    vehicle.route = [toRoadPosition(next)]
    if (vehicle.state === 'waiting') vehicle.state = 'driving'
    if (vehicle.kind === 'visitorCar' && !vehicle.target) vehicle.target = { kind: 'cruise' }
    vehicle.waitMinutes = 0
    return true
  }

  unstickVehicle(
    vehicle: RoadVehicle,
    occupied: ReadonlyMap<string, string>,
    removedVehicles: Set<string>,
    removedGroups: Set<string>,
    removedVisitors: Set<string>,
  ): void {
    const blockedCells = this.collectRouteBlockedCells(vehicle, occupied)
    if (vehicle.state === 'returning') {
      if (
        this.isQueueTail(vehicle, occupied) &&
        this.reverseQueueTail(vehicle, occupied, blockedCells)
      ) {
        return
      }
      if (
        vehicle.waitMinutes >=
        SIMULATION_CONFIG.logistics.vehicleAbandonMinutes
      ) {
        if (isPlayerOwnedFleetVehicle(vehicle) ||
          (vehicle.kind === 'visitorCar' && vehicle.passengerIds.length > 0)) {
          if (!this.isQueueTail(vehicle, occupied)) vehicle.waitMinutes = 0
          return
        }
        vehicle.passengerIds.forEach((visitorId) => {
          removedVisitors.add(visitorId)
        })
        removedVehicles.add(vehicle.id)
        if (vehicle.groupId) removedGroups.add(vehicle.groupId)
        return
      }
      if (!this.isQueueTail(vehicle, occupied)) vehicle.waitMinutes = 0
      return
    }
    if (!this.isQueueTail(vehicle, occupied)) {
      vehicle.waitMinutes = 0
      return
    }
    if (this.reverseQueueTail(vehicle, occupied, blockedCells)) return
    vehicle.waitMinutes = 0
  }

  collectRouteBlockedCells(
    vehicle: RoadVehicle,
    occupied: ReadonlyMap<string, string>,
    keepOpen: readonly RoadPosition[] = [],
  ): Set<string> {
    const blocked = new Set(
      [...occupied.entries()]
        .filter(([, id]) => id !== vehicle.id)
        .map(([key]) => key),
    )
    this.context.state.festival.infrastructure.trucks.forEach((truck) => {
      if (this.context.state.logistics.roadVehicles.some((other) => other.kind === 'deliveryTruck' &&
        (other.deliveryId === truck.id || other.id === truck.id))) return
      blocked.add(this.context.roadPositionKey(truck))
    })
    if (vehicle.cell) blocked.delete(this.context.roadPositionKey(vehicle.cell))
    keepOpen.forEach((cell) => blocked.delete(this.context.roadPositionKey(cell)))
    return blocked
  }

  isSideTurn(vehicle: RoadVehicle, next: RoadPosition): boolean {
    return isLogisticsSideTurn(vehicle, next)
  }

  adoptVehicleRoute(
    vehicle: RoadVehicle,
    route: readonly RoadPosition[],
    blockedNext: RoadPosition,
  ): boolean {
    const here = vehicle.cell
    const first = route[0]
    if (!here || !first) return false
    if (first.x === blockedNext.x && first.z === blockedNext.z) return false
    const firstDir = directionFromDelta(first.x - here.x, first.z - here.z)
    if (firstDir === oppositeDirection(this.getVehicleDirection(vehicle))) {
      return false
    }
    vehicle.route = route.map(toRoadPosition)
    if (vehicle.state === 'waiting') vehicle.state = 'driving'
    vehicle.waitMinutes = 0
    return true
  }

  isHeadOnBlocker(vehicle: RoadVehicle, blocker: RoadVehicle): boolean {
    const here = vehicle.cell
    const theirNext = blocker.route[0]
    if (!here || !theirNext) return false
    return (
      theirNext.x === here.x &&
      theirNext.z === here.z &&
      this.context.roadPositionKey(theirNext) === this.context.roadPositionKey(here)
    )
  }

  maybeReplanHeadOn(
    vehicle: RoadVehicle,
    occupied: ReadonlyMap<string, string>,
    vehiclesById: ReadonlyMap<string, RoadVehicle>,
  ): boolean {
    const next = vehicle.route[0]
    const here = vehicle.cell
    if (!next || !here) return false
    const blockerId = occupied.get(this.context.roadPositionKey(next))
    if (!blockerId || blockerId === vehicle.id) {
      vehicle.headOnReplanTick = undefined
      return false
    }
    const blocker = vehiclesById.get(blockerId)
    if (!blocker || !this.isHeadOnBlocker(vehicle, blocker)) {
      vehicle.headOnReplanTick = undefined
      return false
    }
    if (vehicle.headOnReplanTick == null) {
      const min = SIMULATION_CONFIG.logistics.headOnReplanDelayTicksMin
      const max = SIMULATION_CONFIG.logistics.headOnReplanDelayTicksMax
      const span = Math.max(0, max - min)
      vehicle.headOnReplanTick = min + Math.floor(this.context.nextRandom() * (span + 1))
      return false
    }
    vehicle.headOnReplanTick -= 1
    if (vehicle.headOnReplanTick > 0) return false
    vehicle.headOnReplanTick = undefined
    return this.replanHeadOnConflict(vehicle, occupied)
  }

  replanHeadOnConflict(
    vehicle: RoadVehicle,
    occupied: ReadonlyMap<string, string>,
  ): boolean {
    const here = vehicle.cell
    const next = vehicle.route[0]
    if (!here || !next) return false
    const blocked = this.collectRouteBlockedCells(vehicle, occupied)
    if (vehicle.kind === 'visitorCar' && vehicle.state !== 'returning') {
      const plan =
        this.findRouteTowardParking(vehicle, blocked) ??
        this.findVisitorCarCirculation(vehicle, blocked)
      if (plan && this.adoptVehicleRoute(vehicle, plan.route, next)) {
        vehicle.target = plan.target
        return true
      }
    }
    const targets = this.collectVehicleRouteTargets(vehicle)
    const destination = vehicle.route.at(-1)
    const searchTargets = [
      ...targets,
      ...(destination &&
      !targets.some((cell) => cell.x === destination.x && cell.z === destination.z)
        ? [destination]
        : []),
    ]
    if (searchTargets.length) {
      const rebuilt = findRoadRoute({
        roadCells: this.context.state.logistics.roadCells,
        graph: this.context.getRoadGraph(),
        start: here,
        targets: searchTargets,
        initialDirection: this.getVehicleDirection(vehicle),
        blockedCells: blocked,
        allowUTurn: true,
      })
      if (
        rebuilt &&
        this.adoptVehicleRoute(vehicle, rebuilt.map(toRoadPosition), next)
      ) {
        return true
      }
    }
    return false
  }

  replanBlockedTurn(
    vehicle: RoadVehicle,
    occupied: ReadonlyMap<string, string>,
  ): boolean {
    const here = vehicle.cell
    const next = vehicle.route[0]
    if (!here || !next || !this.isSideTurn(vehicle, next)) return false
    const destination = vehicle.route.at(-1)
    const keepOpen =
      destination &&
      (destination.x !== next.x || destination.z !== next.z)
        ? [destination]
        : []
    const blocked = this.collectRouteBlockedCells(vehicle, occupied, keepOpen)
    if (vehicle.kind === 'visitorCar' && vehicle.state !== 'returning') {
      if (vehicle.state !== 'parking') {
        const plan =
          this.findRouteTowardParking(vehicle, blocked) ??
          this.findVisitorCarCirculation(vehicle, blocked)
        if (plan && this.adoptVehicleRoute(vehicle, plan.route, next)) {
          vehicle.target = plan.target
          return true
        }
      }
    }
    if (vehicle.state === 'returning') {
      const exit = this.findReachableRoadExit(
        here,
        this.getVehicleDirection(vehicle),
        blocked,
        false,
      )
      if (exit && this.adoptVehicleRoute(vehicle, exit.route, next)) return true
    }
    const targets = this.collectVehicleRouteTargets(vehicle)
    const searchTargets = [
      ...targets,
      ...(destination &&
      this.context.getRoadCellAt(destination.x, destination.z) &&
      !targets.some(
        (cell) => cell.x === destination.x && cell.z === destination.z,
      )
        ? [destination]
        : []),
    ]
    if (searchTargets.length) {
      const rebuilt = findRoadRoute({
        roadCells: this.context.state.logistics.roadCells,
        graph: this.context.getRoadGraph(),
        start: here,
        targets: searchTargets,
        initialDirection: this.getVehicleDirection(vehicle),
        blockedCells: blocked,
        allowUTurn: false,
      })
      if (
        rebuilt &&
        this.adoptVehicleRoute(
          vehicle,
          rebuilt.map(toRoadPosition),
          next,
        )
      ) {
        return true
      }
    }
    if (vehicle.kind === 'visitorCar' && vehicle.state !== 'returning') {
      const plan = this.findVisitorCarCirculation(vehicle, blocked)
      if (plan && this.adoptVehicleRoute(vehicle, plan.route, next)) {
        vehicle.target = plan.target
        return true
      }
    }
    return false
  }

  realignVehiclesOnRoad(
    x: number,
    z: number,
    facing: Direction | null,
    elevation: number,
  ): void {
    this.context.state.logistics.roadVehicles.forEach((vehicle) => {
      if (vehicle.state === 'parked') return
      const here = vehicle.cell ?? vehicle.position
      const onTile =
        this.context.roadPositionKey(here) === roadLayerKey(x, z, elevation)
      if (!onTile) return
      if (facing !== null) vehicle.facing = facing * (Math.PI / 2)
      this.rebuildVehicleRouteFromHere(vehicle)
    })
    this.context.state.festival.infrastructure.trucks.forEach((truck) => {
      if (truck.x !== x || truck.z !== z) return
      const vehicle = this.context.state.logistics.roadVehicles.find((candidate) =>
        candidate.kind === 'deliveryTruck' && (candidate.deliveryId === truck.id || candidate.id === truck.id))
      if (this.context.roadPositionKey(vehicle?.cell ?? vehicle?.position ?? truck) !== roadLayerKey(x, z, elevation)) return
      this.rebuildFreightTruckPath(truck)
    })
  }

  collectMapExitTargets(): RoadPosition[] {
    const edgeZ = -this.context.getWorldSize() / 2
    return this.context.state.logistics.roadCells.filter(
      (road) =>
        road.z === edgeZ &&
        road.x >= -3 &&
        road.x <= 2 &&
        isRoadDirectionAllowed(road, 2),
    )
  }

  collectRoadOrAccessTargets(position: RoadPosition): RoadPosition[] {
    if (this.context.getRoadCellAt(position.x, position.z)) {
      return [{ x: position.x, z: position.z }]
    }
    return this.context.getAdjacentRoadPositions(position)
  }

  collectGarbageTruckTargets(vehicle: RoadVehicle): RoadPosition[] {
    const target = vehicle.target
    if (vehicle.cargo > 0) return this.collectMapExitTargets()
    if (target?.kind === 'wasteDump') {
      return this.collectRoadOrAccessTargets({ x: target.x, z: target.z })
    }
    if (target?.kind === 'sealedWasteContainer') {
      return this.sealedContainerPullUpRoads(target)
    }
    if (target?.kind === 'depot') {
      const depot = this.context.state.logistics.wasteDepots.find(
        (candidate) => candidate.id === target.depotId,
      )
      const access = depot ? this.context.getLogisticsBuildingAccess(depot, 2) : null
      return access ? [access] : []
    }
    if (target?.kind === 'cell') {
      if (this.isRoadExitCell(target) || this.isOffMapRoadExit(target)) {
        return this.collectMapExitTargets()
      }
      return this.collectRoadOrAccessTargets(target)
    }
    const last = vehicle.route.at(-1)
    return last ? this.collectRoadOrAccessTargets(last) : []
  }

  collectVehicleRouteTargets(vehicle: RoadVehicle): RoadPosition[] {
    if (vehicle.kind === 'deliveryTruck') {
      return this.collectDeliveryTruckTargets(vehicle)
    }
    if (vehicle.kind === 'garbageTruck') {
      return this.collectGarbageTruckTargets(vehicle)
    }
    if (vehicle.kind === 'visitorCar' && vehicle.state === 'returning') {
      return this.collectMapExitTargets()
    }
    const target = vehicle.target
    if (!target) {
      const last = vehicle.route.at(-1)
      return last ? this.collectRoadOrAccessTargets(last) : []
    }
    if (target.kind === 'wasteDump') {
      return this.collectRoadOrAccessTargets({ x: target.x, z: target.z })
    }
    if (target.kind === 'sealedWasteContainer') {
      return this.sealedContainerPullUpRoads(target)
    }
    if (target.kind === 'cell') {
      if (this.isRoadExitCell(target) || this.isOffMapRoadExit(target)) {
        return this.collectMapExitTargets()
      }
      return this.collectRoadOrAccessTargets(target)
    }
    if (target.kind === 'parking' || target.kind === 'hold') {
      const parking = target.parkingCell ?? vehicle.parkingCell
      return parking ? this.context.getParkingApproachRoads(parking) : []
    }
    if (target.kind === 'cruise') {
      const last = vehicle.route.at(-1)
      return last ? [last] : []
    }
    if (target.kind === 'busStop') {
      const stop = this.context.state.logistics.busStops.find(
        (candidate) => candidate.id === target.stopId,
      )
      return stop ? [stop.roadCell] : []
    }
    if (target.kind === 'garage') {
      const garage = this.context.state.logistics.ambulanceGarages.find(
        (candidate) => candidate.id === target.garageId,
      )
      const access = garage
        ? this.context.getLogisticsBuildingAccess(garage, 2)
        : null
      return access ? [access] : []
    }
    if (target.kind === 'depot') {
      const depot =
        this.context.state.logistics.wasteDepots.find(
          (candidate) => candidate.id === target.depotId,
        ) ??
        this.context.state.logistics.busDepots.find(
          (candidate) => candidate.id === target.depotId,
        )
      const access = depot
        ? this.context.getLogisticsBuildingAccess(depot, 2)
        : null
      return access ? [access] : []
    }
    if (target.kind === 'tourBusParking') {
      const parking = this.context.state.buildings.find(
        (building) => building.id === target.buildingId,
      )
      if (!parking) return []
      if (vehicle.state === 'parking') {
        return [{ x: parking.x, z: parking.z, elevation: parking.elevation }]
      }
      return this.context.getAdjacentRoadPositions(parking)
    }
    return []
  }

  rebuildVehicleRouteFromHere(vehicle: RoadVehicle): void {
    if (
      vehicle.state === 'idle' ||
      vehicle.state === 'parked' ||
      vehicle.state === 'at-stop'
    ) {
      return
    }
    const start = vehicle.cell ?? vehicle.position
    const occupied = new Map(
      this.context.state.logistics.roadVehicles
        .filter(
          (other) =>
            other.id !== vehicle.id &&
            other.cell &&
            other.state !== 'parked',
        )
        .map((other) => [
          this.context.roadPositionKey(other.cell!),
          other.id,
        ]),
    )
    const blocked = this.collectRouteBlockedCells(vehicle, occupied)
    const facing = this.getVehicleDirection(vehicle)
    const applyRoute = (route: readonly RoadPosition[]): boolean => {
      if (!route.length) return false
      const first = route[0]!
      const step = directionFromDelta(first.x - start.x, first.z - start.z)
      if (step === oppositeDirection(facing)) {
        if (
          vehicle.kind !== 'deliveryTruck' &&
          vehicle.kind !== 'garbageTruck'
        ) {
          return false
        }
        vehicle.facing = step * (Math.PI / 2)
      }
      vehicle.route = route.map(toRoadPosition)
      vehicle.waitMinutes = 0
      if (vehicle.state === 'waiting') {
        vehicle.state = vehicle.resumeState ?? 'driving'
        vehicle.resumeState = null
      }
      return true
    }
    if (vehicle.kind === 'visitorCar' && vehicle.state === 'returning') {
      const exit =
        this.findReachableRoadExit(start, facing, blocked, false) ??
        this.findReachableRoadExit(start, facing, undefined, false)
      if (exit && applyRoute(exit.route)) return
    }
    if (vehicle.kind === 'visitorCar' && vehicle.state !== 'returning') {
      if (vehicle.state === 'parking' && vehicle.parkingCell) {
        if (this.context.isVehicleAtParkingAccess(vehicle)) {
          this.context.beginVehiclePullIn(vehicle)
          return
        }
        const accesses = this.context.getParkingApproachRoads(vehicle.parkingCell)
        const reserved = accesses.length
          ? this.routePreferringOpenLights({
              roadCells: this.context.state.logistics.roadCells,
              graph: this.context.getRoadGraph(),
              start,
              targets: accesses,
              initialDirection: facing,
              blockedCells: blocked,
              allowUTurn: false,
            })
          : null
        if (reserved && applyRoute(reserved)) return
        this.releaseVisitorCarParking(vehicle)
      }
      const plan =
        this.findRouteTowardParking(vehicle, blocked) ??
        this.findVisitorCarCirculation(vehicle, blocked)
      if (plan && applyRoute(plan.route)) {
        vehicle.target = plan.target
        return
      }
    }
    const targets = this.collectVehicleRouteTargets(vehicle)
    if (targets.length) {
      const rebuilt =
        this.routePreferringOpenLights({
          roadCells: this.context.state.logistics.roadCells,
          graph: this.context.getRoadGraph(),
          start,
          targets,
          initialDirection: facing,
          blockedCells: blocked,
          allowUTurn: false,
        }) ??
        findRoadRoute({
          roadCells: this.context.state.logistics.roadCells,
          graph: this.context.getRoadGraph(),
          start,
          targets,
          initialDirection: facing,
          allowUTurn: false,
        }) ??
        findRoadRoute({
          roadCells: this.context.state.logistics.roadCells,
          graph: this.context.getRoadGraph(),
          start,
          targets,
          allowUTurn: false,
        })
      if (rebuilt && applyRoute(rebuilt)) return
    }
    if (vehicle.kind === 'visitorCar' && vehicle.state !== 'returning') {
      if (this.sendVisitorCarCirculating(vehicle, blocked)) return
    }
    const next = vehicle.route[0]
    if (!next) return
    const step = directionFromDelta(next.x - start.x, next.z - start.z)
    const here = this.context.getRoadCellAt(start.x, start.z, start.elevation)
    if (
      step !== null &&
      here &&
      !isRoadDirectionAllowed(here, step)
    ) {
      vehicle.route = []
    }
  }

  rebuildFreightTruckPath(truck: {
    id?: string
    x: number
    z: number
    path: Array<{ x: number; z: number }>
    phase: 'inbound' | 'return'
    depotId: string
  }): void {
    const northZ = -this.context.getWorldSize() / 2
    const edges = this.context.state.logistics.roadCells.filter(
      (road) => road.z === northZ,
    )
    const depot = this.context.state.festival.infrastructure.depots.find(
      (candidate) => candidate.id === truck.depotId,
    )
    const targets =
      truck.phase === 'return'
        ? edges
        : depot
          ? this.context.getAdjacentRoadPositions(depot)
          : []
    if (!targets.length) return
    const blocked = this.collectRouteBlockedCells(
      {
        id: `freight:${truck.x}:${truck.z}`,
        cell: { x: truck.x, z: truck.z },
      } as RoadVehicle,
      new Map(
        this.context.state.logistics.roadVehicles
          .filter((vehicle) => vehicle.cell && vehicle.state !== 'parked')
          .map((vehicle) => [
            this.context.roadPositionKey(vehicle.cell!),
            vehicle.id,
          ]),
      ),
      targets,
    )
    const vehicle = this.context.state.logistics.roadVehicles.find(
      (candidate) =>
        candidate.kind === 'deliveryTruck' &&
        (candidate.deliveryId === truck.id || candidate.id === truck.id),
    )
    if (vehicle) {
      const rebuilt = this.findServiceVehicleRoute(vehicle, targets, blocked)
      if (rebuilt?.length) {
        this.adoptServiceRoute(vehicle, rebuilt)
        if (vehicle.state === 'waiting') {
          vehicle.state = vehicle.resumeState ?? 'driving'
          vehicle.resumeState = null
        }
        truck.path = rebuilt.map(toRoadPosition)
      }
      return
    }
    const route =
      findRoadRoute({
        roadCells: this.context.state.logistics.roadCells,
        graph: this.context.getRoadGraph(),
        start: truck,
        targets,
        blockedCells: blocked,
        allowUTurn: false,
      }) ??
      findRoadRoute({
        roadCells: this.context.state.logistics.roadCells,
        graph: this.context.getRoadGraph(),
        start: truck,
        targets,
        allowUTurn: false,
      })
    if (route?.length) {
      truck.path = route.map(toRoadPosition)
    }
  }

  cellBehindVehicle(vehicle: RoadVehicle): RoadPosition | null {
    const here = vehicle.cell
    if (!here) return null
    const back = oppositeDirection(this.getVehicleDirection(vehicle))
    const road = (this.context.getRoadGraph().neighbors.get(this.context.roadPositionKey(here)) ?? []).find(
      (cell) => directionFromDelta(cell.x - here.x, cell.z - here.z) === back,
    )
    return road ? toRoadPosition(road) : null
  }

  isQueueTail(
    vehicle: RoadVehicle,
    occupied: ReadonlyMap<string, string>,
  ): boolean {
    const here = vehicle.cell
    const next = vehicle.route[0]
    if (!here || !next) return false
    const blocker = occupied.get(this.context.roadPositionKey(next))
    if (!blocker || blocker === vehicle.id) return false
    const behind = this.cellBehindVehicle(vehicle)
    return !this.context.state.logistics.roadVehicles.some((other) => {
      if (other.id === vehicle.id || other.state === 'parked') return false
      if (other.route[0] && this.context.roadPositionKey(other.route[0]) === this.context.roadPositionKey(here)) {
        return true
      }
      return Boolean(
        behind && other.cell && this.context.roadPositionKey(other.cell) === this.context.roadPositionKey(behind),
      )
    })
  }

  reverseQueueTail(
    vehicle: RoadVehicle,
    occupied: ReadonlyMap<string, string>,
    blockedCells: ReadonlySet<string>,
  ): boolean {
    const here = vehicle.cell
    if (!here) return false
    const behind = this.cellBehindVehicle(vehicle)
    if (!behind || !this.context.getRoadCellAt(behind.x, behind.z)) return false
    if (!this.isLegalRoadStep(here, behind)) return false
    if (occupied.has(this.context.roadPositionKey(behind))) return false
    const searchBlocked = new Set(blockedCells)
    searchBlocked.add(this.context.roadPositionKey(here))
    const fromBehind = {
      ...vehicle,
      cell: behind,
      position: behind,
    }
    let continuation: RoadPosition[] = []
    if (vehicle.kind === 'visitorCar' && vehicle.state !== 'returning') {
      if (vehicle.state !== 'parking') {
        const plan =
          this.findRouteTowardParking(fromBehind, searchBlocked) ??
          this.findVisitorCarCirculation(fromBehind, searchBlocked)
        if (plan?.route.length) {
          continuation = plan.route
          vehicle.target = plan.target
        }
      }
    }
    if (!continuation.length && vehicle.state === 'returning') {
      const exit = this.findReachableRoadExit(
        behind,
        this.getVehicleDirection(vehicle),
        searchBlocked,
        false,
      )
      if (exit?.route.length) {
        continuation = exit.route.map(toRoadPosition)
      }
    }
    if (!continuation.length) {
      const destination = vehicle.route.at(-1)
      if (destination) {
        const rebuilt = findRoadRoute({
          roadCells: this.context.state.logistics.roadCells,
          graph: this.context.getRoadGraph(),
          start: behind,
          targets: [destination],
          initialDirection: this.getVehicleDirection(vehicle),
          blockedCells: searchBlocked,
          allowUTurn: false,
        })
        if (rebuilt?.length) {
          continuation = rebuilt.map(toRoadPosition)
        }
      }
    }
    if (
      !continuation.length &&
      vehicle.kind === 'visitorCar' &&
      vehicle.state !== 'returning'
    ) {
      const plan = this.findVisitorCarCirculation(fromBehind, searchBlocked)
      if (plan?.route.length) {
        continuation = plan.route
        vehicle.target = plan.target
      }
    }
    const planned = [toRoadPosition(behind), ...continuation]
    vehicle.route = this.roadRouteIsConnected(here, planned)
      ? planned
      : [toRoadPosition(behind)]
    if (vehicle.state === 'waiting') vehicle.state = 'driving'
    vehicle.waitMinutes = 0
    return true
  }

  roadRouteIsConnected(
    start: RoadPosition,
    route: readonly RoadPosition[],
  ): boolean {
    return logisticsRoadRouteIsConnected(start, route)
  }

  isLegalRoadStep(from: RoadPosition, to: RoadPosition): boolean {
    const road = this.context.getRoadCellAt(from.x, from.z, from.elevation)
    const next = this.context.getRoadCellAt(to.x, to.z, to.elevation)
    // Parking and off-map access have their own checks.
    if (!road || !next) return true
    const fromKey = roadLayerKey(from.x, from.z, roadLayerElevation(road))
    return (this.context.getRoadGraph().neighbors.get(fromKey) ?? []).some(
      (neighbor) =>
        neighbor.x === to.x &&
        neighbor.z === to.z &&
        (to.elevation === undefined ||
          elevationsMatch(roadLayerElevation(neighbor), to.elevation)),
    )
  }

  replanBlockedReverse(
    vehicle: RoadVehicle,
    occupied: ReadonlyMap<string, string>,
  ): boolean {
    if (!isVehicleReversing(vehicle)) return false
    const here = vehicle.cell
    const next = vehicle.route[0]
    if (!here || !next) return false
    const blocker = occupied.get(this.context.roadPositionKey(next))
    if (!blocker || blocker === vehicle.id) return false
    const targets = this.collectVehicleRouteTargets(vehicle)
    if (!targets.length) {
      vehicle.route = []
      vehicle.waitMinutes = 0
      return true
    }
    const facing = this.getVehicleDirection(vehicle)
    const blocked = this.collectRouteBlockedCells(vehicle, occupied)
    const forward =
      findRoadRoute({
        roadCells: this.context.state.logistics.roadCells,
        graph: this.context.getRoadGraph(),
        start: here,
        targets,
        initialDirection: facing,
        blockedCells: blocked,
        allowUTurn: false,
      }) ??
      findRoadRoute({
        roadCells: this.context.state.logistics.roadCells,
        graph: this.context.getRoadGraph(),
        start: here,
        targets,
        initialDirection: facing,
        allowUTurn: false,
      })
    if (!forward?.length) return false
    vehicle.route = forward.map(toRoadPosition)
    vehicle.waitMinutes = 0
    return true
  }

  parkingApproachStarts(parking: RoadPosition): RoadPosition[] {
    return this.context.getParkingApproachRoads(parking).map((approach) => {
      const road = this.context.getRoadCellAt(approach.x, approach.z)
      return road ? toRoadPosition(road) : approach
    })
  }

  startParkedCarDeparture(
    vehicle: RoadVehicle,
    group: ArrivalGroup,
    occupied: ReadonlyMap<string, string>,
  ): 'started' | 'blocked' | 'no-route' {
    if (!vehicle.parkingCell) return 'no-route'
    const approaches = this.parkingApproachStarts(vehicle.parkingCell)
    const free = approaches.filter(
      (cell) => !occupied.has(this.context.roadPositionKey(cell)),
    )
    const departure =
      this.findDepartureFromAccesses(vehicle, free, true) ??
      this.findDepartureFromAccesses(vehicle, approaches, true)
    if (!departure) return 'no-route'
    const { access, exit, initialDirection } = departure
    if (occupied.has(this.context.roadPositionKey(access))) return 'blocked'
    const parking = this.context.state.logistics.parkingCells.find(
      (cell) =>
        cell.x === vehicle.parkingCell?.x &&
        cell.z === vehicle.parkingCell?.z,
    )
    if (parking) parking.occupiedBy = null
    const parkedAt = { ...vehicle.parkingCell }
    vehicle.cell = parkedAt
    vehicle.position = parkedAt
    // Cars are parked nose-in. Keep the nose toward the bay while the first
    // route step backs onto the adjacent road, then turn along the exit route.
    vehicle.facing = oppositeDirection(initialDirection) * (Math.PI / 2)
    vehicle.parkingCell = null
    vehicle.route = [
      { ...access },
      ...exit.route.map((cell) => toRoadPosition(cell)),
    ]
    vehicle.state = 'returning'
    vehicle.waitMinutes = 0
    group.state = 'leaving'
    return 'started'
  }

  findDepartureFromAccesses(
    vehicle: RoadVehicle,
    accesses: readonly RoadPosition[],
    allowUTurn: boolean,
  ): {
    access: RoadPosition
    exit: { position: RoadPosition; route: RoadCell[] }
    initialDirection: Direction
  } | null {
    for (const access of accesses) {
      const initialDirection = this.context.getDirectionIndex(
        access.x - vehicle.parkingCell!.x,
        access.z - vehicle.parkingCell!.z,
      ) as Direction
      const exit = this.findReachableRoadExit(
        access,
        initialDirection,
        undefined,
        allowUTurn,
      )
      if (exit) return { access, exit, initialDirection }
    }
    return null
  }

  findReachableRoadExit(
    start: RoadPosition,
    initialDirection: Direction,
    blockedCells?: ReadonlySet<string>,
    allowUTurn = false,
  ): { position: RoadPosition; route: RoadCell[] } | null {
    // Occupancy-dependent detours must always use the current blocking cells.
    if (blockedCells?.size) {
      return this.context.searchReachableRoadExit(start, initialDirection, blockedCells, allowUTurn)
    }
    const graph = this.context.getRoadGraph()
    const road = this.context.getRoadCellAt(start.x, start.z, start.elevation)
    if (!road) return null
    let cache = this.roadExitRoutes.get(graph)
    if (!cache) {
      cache = new Map()
      this.roadExitRoutes.set(graph, cache)
    }
    const key = `${roadLayerKey(road.x, road.z, roadLayerElevation(road))}:${initialDirection}:${Number(allowUTurn)}`
    if (!cache.has(key)) {
      cache.set(key, this.context.searchReachableRoadExit(start, initialDirection, undefined, allowUTurn))
    }
    const result = cache.get(key)
    return result ? {
      position: { ...result.position },
      route: result.route.map((cell) => ({ ...cell })),
    } : null
  }

  searchReachableRoadExit(
    start: RoadPosition,
    initialDirection: Direction,
    blockedCells?: ReadonlySet<string>,
    allowUTurn = false,
  ): { position: RoadPosition; route: RoadCell[] } | null {
    const search = (targets: RoadPosition[]) => {
      if (targets.length === 0) return null
      return findRoadRoute({
        roadCells: this.context.state.logistics.roadCells,
        graph: this.context.getRoadGraph(),
        start,
        targets,
        initialDirection,
        blockedCells,
        allowUTurn,
      })
    }
    const exits = this.collectMapExitTargets()
    const route =
      search(exits) ??
      search(
        this.context.state.logistics.roadCells.filter(
          (road) =>
            road.z === -this.context.getWorldSize() / 2 &&
            isRoadDirectionAllowed(road, 2),
        ),
      )
    if (!route) return null
    const last = route.at(-1) ?? start
    return {
      position: { x: last.x, z: last.z },
      route,
    }
  }

  dispatchGarbageTruck(vehicle: RoadVehicle): void {
    if (!vehicle.cell) return
    const claimed = new Set(
      this.context.state.logistics.roadVehicles
        .filter(
          (candidate) =>
            candidate.kind === 'garbageTruck' &&
            candidate.id !== vehicle.id &&
            candidate.state !== 'idle',
        )
        .map((candidate) => {
          if (candidate.target?.kind === 'wasteDump') {
            return `${candidate.target.x}:${candidate.target.z}`
          }
          if (candidate.target?.kind === 'sealedWasteContainer') {
            return `sealed:${candidate.target.buildingId}`
          }
          return ''
        }),
    )
    const dumps = this.context.state.wasteDumpCells.filter(
      (cell) =>
        cell.stored > 0 && !claimed.has(`${cell.x}:${cell.z}`),
    )
    const containers = this.context.state.buildings.filter(
      (building) =>
        isSealedWasteContainer(building.kind) &&
        (building.wasteFill ?? 0) > 0 &&
        this.context.isSealedWasteContainerOnRoad(building) &&
        !claimed.has(`sealed:${building.id}`),
    )
    const totalStored =
      dumps.reduce((sum, cell) => sum + cell.stored, 0) +
      containers.reduce((sum, building) => sum + (building.wasteFill ?? 0), 0)
    if (totalStored < SIMULATION_CONFIG.waste.truckDispatchThreshold) return
    this.unhouseServiceVehicle(vehicle)
    if (!vehicle.cell) return
    const containerAccesses = this.getSealedContainerRoadAccesses(containers)
    const dumpAccesses = this.getWasteDumpRoadAccesses(dumps)
    // A dump pad beside the depot (or the truck's current cell) used to win
    // `alreadyThere` and keep the wagon vacuuming dumps forever. Filled
    // roadside boxes must be their own trip.
    const accesses: Array<{
      road: RoadPosition
      dump?: { x: number; z: number; stored: number }
      container?: { id: string; x: number; z: number; stored: number }
    }> = containerAccesses.length > 0 ? containerAccesses : dumpAccesses
    if (accesses.length === 0) return
    const here = vehicle.cell
    const sittingOn = here
      ? containers.find(
          (building) => building.x === here.x && building.z === here.z,
        )
      : undefined
    if (sittingOn) {
      this.assignGarbageTruckAccessTarget(vehicle, {
        container: { id: sittingOn.id, x: sittingOn.x, z: sittingOn.z },
      })
      vehicle.route = []
      vehicle.state = 'responding'
      this.finishGarbageTruckLeg(vehicle)
      return
    }
    const alreadyThere = this.pickGarbageTruckAccess(accesses, here)
    if (alreadyThere) {
      this.assignGarbageTruckAccessTarget(vehicle, alreadyThere)
      vehicle.route = []
      vehicle.state = 'responding'
      this.finishGarbageTruckLeg(vehicle)
      return
    }
    const route = this.findGarbageTruckRoute(
      vehicle,
      accesses.map((access) => access.road),
    )
    if (!route) return
    const last = route.at(-1) ?? vehicle.cell
    const access = this.pickGarbageTruckAccess(accesses, last) ?? accesses[0]
    if (!access) return
    this.assignGarbageTruckAccessTarget(vehicle, access)
    vehicle.route = route.map(toRoadPosition)
    vehicle.state = 'responding'
  }

  pickGarbageTruckAccess(
    accesses: readonly {
      road: RoadPosition
      dump?: { x: number; z: number }
      container?: { id: string; x: number; z: number }
    }[],
    at: RoadPosition | null | undefined,
  ) {
    if (!at) return undefined
    const matching = accesses.filter(
      (access) => access.road.x === at.x && access.road.z === at.z,
    )
    return matching.find((access) => access.container) ?? matching[0]
  }

  assignGarbageTruckAccessTarget(
    vehicle: RoadVehicle,
    access: {
      dump?: { x: number; z: number }
      container?: { id: string; x: number; z: number }
    },
  ): void {
    if (access.container) {
      vehicle.target = {
        kind: 'sealedWasteContainer',
        buildingId: access.container.id,
        x: access.container.x,
        z: access.container.z,
      }
      return
    }
    if (access.dump) {
      vehicle.target = { kind: 'wasteDump', x: access.dump.x, z: access.dump.z }
    }
  }

  getWasteDumpRoadAccesses(
    dumps: readonly { x: number; z: number; stored: number }[],
  ): Array<{ dump: { x: number; z: number; stored: number }; road: RoadPosition }> {
    const dumpArea =
      dumps.length > 0
        ? this.context.state.wasteDumpCells
        : []
    const seeds = dumps.length > 0 ? dumpArea : dumps
    const seen = new Set<string>()
    const accesses: Array<{
      dump: { x: number; z: number; stored: number }
      road: RoadPosition
    }> = []
    seeds.forEach((dump) => {
      this.context.getAdjacentRoadPositions(dump).forEach((road) => {
        const key = `${road.x}:${road.z}`
        if (seen.has(key)) return
        seen.add(key)
        accesses.push({ dump, road })
      })
    })
    return accesses.sort((left, right) => right.dump.stored - left.dump.stored)
  }

  getSealedContainerRoadAccesses(
    containers: readonly PlacedBuilding[],
  ): Array<{
    container: { id: string; x: number; z: number; stored: number }
    road: RoadPosition
  }> {
    const seen = new Set<string>()
    const accesses: Array<{
      container: { id: string; x: number; z: number; stored: number }
      road: RoadPosition
    }> = []
    containers.forEach((container) => {
      this.sealedContainerPullUpRoads(container).forEach((road) => {
        const cell = this.context.getRoadCellAt(road.x, road.z, road.elevation)
        if (!cell) return
        const key = roadLayerKey(
          cell.x,
          cell.z,
          cell.elevation ?? this.context.getTerrainHeight(cell.x, cell.z),
        )
        if (seen.has(key)) return
        seen.add(key)
        accesses.push({
          container: {
            id: container.id,
            x: container.x,
            z: container.z,
            stored: container.wasteFill ?? 0,
          },
          road: toRoadPosition(cell),
        })
      })
    })
    return accesses.sort((left, right) => right.container.stored - left.container.stored)
  }

  sealedContainerPullUpRoads(container: {
    x: number
    z: number
    elevation?: number
  }): RoadPosition[] {
    if (!this.context.getRoadCellAt(container.x, container.z, container.elevation)) {
      return []
    }
    const adjacent = this.context.getAdjacentRoadPositions(container)
    if (adjacent.length > 0) return adjacent
    const here = this.context.getRoadCellAt(container.x, container.z, container.elevation)
    return here ? [toRoadPosition(here)] : []
  }

  sealedContainerRoadIsReachable(
    container: { x: number; z: number; elevation?: number },
    reachable: ReadonlySet<string>,
  ): boolean {
    return this.sealedContainerPullUpRoads(container).some((road) => {
      const cell = this.context.getRoadCellAt(road.x, road.z, road.elevation)
      if (!cell) return false
      return reachable.has(
        roadLayerKey(
          cell.x,
          cell.z,
          cell.elevation ?? this.context.getTerrainHeight(cell.x, cell.z),
        ),
      )
    })
  }

  garbageTruckCanServiceSealedContainer(
    here: RoadPosition,
    building: { x: number; z: number; elevation: number; kind?: string },
  ): boolean {
    if (building.kind !== undefined && !isSealedWasteContainer(building.kind)) {
      return false
    }
    if (!this.context.isSealedWasteContainerOnRoad(building)) return false
    return Math.abs(building.x - here.x) + Math.abs(building.z - here.z) <= 1
  }

  getDeliveryFreight(vehicle: RoadVehicle) {
    return this.context.state.festival.infrastructure.trucks.find(
      (truck) =>
        truck.id === vehicle.deliveryId || truck.id === vehicle.id,
    )
  }

  collectDeliveryTruckTargets(vehicle: RoadVehicle): RoadPosition[] {
    const truck = this.getDeliveryFreight(vehicle)
    const northZ = -this.context.getWorldSize() / 2
    const edges = this.context.state.logistics.roadCells.filter(
      (road) => road.z === northZ,
    )
    if (vehicle.state === 'returning' || truck?.phase === 'return') {
      return edges
    }
    const depot = this.context.state.festival.infrastructure.depots.find(
      (candidate) => candidate.id === truck?.depotId,
    )
    return depot ? this.context.getAdjacentRoadPositions(depot) : []
  }

  findServiceVehicleRoute(
    vehicle: RoadVehicle,
    targets: readonly RoadPosition[],
    blockedCells?: ReadonlySet<string>,
  ): RoadPosition[] | null {
    if (targets.length === 0) return null
    const northZ = -this.context.getWorldSize() / 2
    let start = vehicle.cell ?? vehicle.position
    const prefix: RoadPosition[] = []
    if (start.z < northZ) {
      prefix.push({ x: start.x, z: northZ })
      start = { x: start.x, z: northZ }
    }
    if (!this.context.getRoadCellAt(start.x, start.z)) return null
    const facing = this.getVehicleDirection(vehicle)
    const hereRoad = this.context.getRoadCellAt(start.x, start.z)
    const exits = hereRoad
      ? DIRECTIONS.filter((direction) =>
          isRoadDirectionAllowed(hereRoad, direction),
        )
      : []
    const graph = this.context.getRoadGraph()
    const search = (
      blocked?: ReadonlySet<string>,
      direction?: Direction,
    ) =>
      this.routePreferringOpenLights({
        roadCells: this.context.state.logistics.roadCells,
        graph,
        start,
        targets,
        blockedCells: blocked,
        initialDirection: direction,
        allowUTurn: false,
      })
    for (const direction of [facing, ...exits, undefined]) {
      const route = search(blockedCells, direction) ?? search(undefined, direction)
      if (!route?.length) continue
      if (direction !== undefined && direction !== facing) {
        vehicle.facing = direction * (Math.PI / 2)
      }
      return [
        ...prefix,
        ...route.map(toRoadPosition),
      ]
    }
    return null
  }

  adoptServiceRoute(
    vehicle: RoadVehicle,
    route: RoadPosition[],
  ): void {
    vehicle.route = route
    const here = vehicle.cell ?? vehicle.position
    const first = route[0]
    const step = first
      ? directionFromDelta(first.x - here.x, first.z - here.z)
      : null
    if (step !== null) vehicle.facing = step * (Math.PI / 2)
    vehicle.waitMinutes = 0
  }

  deliverySpawnFacing(truck: {
    x: number
    z: number
    path: Array<{ x: number; z: number }>
    phase: 'inbound' | 'return'
  }): number {
    const inbound = truck.phase === 'return' ? 2 : 0
    const next = truck.path[0]
    const step = next
      ? directionFromDelta(next.x - truck.x, next.z - truck.z)
      : null
    if (step === inbound || step === oppositeDirection(inbound as Direction)) {
      return step * (Math.PI / 2)
    }
    return inbound * (Math.PI / 2)
  }

  syncFreightToVehicles(): void {
    const trucks = this.context.state.festival.infrastructure.trucks
    const vehicles = this.context.state.logistics.roadVehicles
    const byId = new Map<string, RoadVehicle>()
    for (const vehicle of vehicles) {
      if (vehicle.kind !== 'deliveryTruck') continue
      byId.set(vehicle.id, vehicle)
      if (vehicle.deliveryId) byId.set(vehicle.deliveryId, vehicle)
    }
    const keep = new Set<string>()
    for (const truck of trucks) {
      let vehicle = byId.get(truck.id)
      if (!vehicle) {
        vehicle = this.context.createRoadVehicle(truck.id, 'deliveryTruck', {
          x: truck.x,
          z: truck.z,
        })
        vehicle.deliveryId = truck.id
        vehicle.route = truck.path.map(toRoadPosition)
        vehicle.cargo = truck.cargo
        vehicle.stuckMinutes = truck.stuck
        vehicle.testedGroundCell = truck.testedCell
        vehicle.state = truck.phase === 'return' ? 'returning' : 'driving'
        vehicle.target =
          truck.phase === 'return'
            ? {
                kind: 'cell',
                x: truck.path.at(-1)?.x ?? truck.x,
                z: truck.path.at(-1)?.z ?? truck.z,
              }
            : { kind: 'depot', depotId: truck.depotId }
        vehicle.facing = this.deliverySpawnFacing(truck)
        vehicles.push(vehicle)
      }
      keep.add(vehicle.id)
    }
    this.context.state.logistics.roadVehicles = vehicles.filter(
      (vehicle) =>
        vehicle.kind !== 'deliveryTruck' || keep.has(vehicle.id),
    )
  }

  syncVehiclesToFreight(): void {
    for (const vehicle of this.context.state.logistics.roadVehicles) {
      if (vehicle.kind !== 'deliveryTruck') continue
      const truck = this.getDeliveryFreight(vehicle)
      if (!truck) continue
      const here = vehicle.cell ?? vehicle.position
      truck.x = here.x
      truck.z = here.z
      truck.path = vehicle.route.map(toRoadPosition)
      truck.phase = vehicle.state === 'returning' ? 'return' : 'inbound'
      truck.cargo = vehicle.cargo
      truck.stuck = vehicle.stuckMinutes ?? 0
      truck.testedCell = vehicle.testedGroundCell ?? ''
      truck.progress = 0
    }
  }

  finishDeliveryTruckLeg(
    vehicle: RoadVehicle,
    removedVehicles: Set<string>,
  ): void {
    const truck = this.getDeliveryFreight(vehicle)
    if (!truck) {
      removedVehicles.add(vehicle.id)
      return
    }
    const here = vehicle.cell ?? vehicle.position
    truck.x = here.x
    truck.z = here.z
    const northZ = -this.context.getWorldSize() / 2
    const edges = this.context.state.logistics.roadCells.filter(
      (road) => road.z === northZ,
    )
    const depot = this.context.state.festival.infrastructure.depots.find(
      (candidate) => candidate.id === truck.depotId,
    )
    const atBay = Boolean(
      depot &&
        this.context.getAdjacentRoadPositions(depot).some(
          (cell) => cell.x === here.x && cell.z === here.z,
        ),
    )
    const atEdge = edges.some((edge) => edge.x === here.x && edge.z === here.z)
    const leaveMap = () => {
      this.context.state.festival.infrastructure.trucks =
        this.context.state.festival.infrastructure.trucks.filter(
          (candidate) => candidate.id !== truck.id,
        )
      removedVehicles.add(vehicle.id)
    }
    if (vehicle.state === 'returning' || truck.phase === 'return') {
      if (atEdge || here.z < northZ) {
        leaveMap()
        return
      }
      const route = this.findServiceVehicleRoute(vehicle, edges)
      vehicle.state = 'returning'
      truck.phase = 'return'
      if (route?.length) {
        this.adoptServiceRoute(vehicle, route)
        vehicle.target = { kind: 'cell', ...(route.at(-1) ?? here) }
        truck.path = route
      } else if (atEdge) {
        leaveMap()
      }
      return
    }
    if (depot && atBay) {
      depot.stock[truck.kind] += truck.cargo
      truck.cargo = 0
      vehicle.cargo = 0
      this.context.state.festival.deliveries = this.context.state.festival.deliveries.filter(
        (delivery) => delivery.id !== truck.deliveryId,
      )
      truck.deliveryId = null
      truck.phase = 'return'
      this.context.state.festival.infrastructure.status =
        'Ware im Depot entladen – Träger verteilen sie an die Stände'
      vehicle.state = 'returning'
      const route = this.findServiceVehicleRoute(vehicle, edges)
      if (route?.length) {
        this.adoptServiceRoute(vehicle, route)
        vehicle.target = { kind: 'cell', ...(route.at(-1) ?? here) }
        truck.path = route
      }
      return
    }
    const bays = depot ? this.context.getAdjacentRoadPositions(depot) : []
    const route = this.findServiceVehicleRoute(vehicle, bays)
    if (route?.length) {
      this.adoptServiceRoute(vehicle, route)
      vehicle.state = 'driving'
      vehicle.target = { kind: 'depot', depotId: truck.depotId }
      truck.path = route
    }
  }

  replanOffMapDelivery(
    vehicle: RoadVehicle,
    occupied: ReadonlyMap<string, string>,
  ): boolean {
    if (vehicle.kind !== 'deliveryTruck') return false
    const northZ = -this.context.getWorldSize() / 2
    const here = vehicle.cell ?? vehicle.position
    if (here.z >= northZ) return false
    const edges = this.context.state.logistics.roadCells.filter(
      (road) => road.z === northZ,
    )
    const targets = this.collectDeliveryTruckTargets(vehicle)
    if (!targets.length) return false
    for (const edge of edges) {
      if (occupied.has(this.context.roadPositionKey(edge))) continue
      const rest = findRoadRoute({
        roadCells: this.context.state.logistics.roadCells,
        graph: this.context.getRoadGraph(),
        start: edge,
        targets,
        initialDirection: 0,
        allowUTurn: false,
        blockedCells: this.collectRouteBlockedCells(vehicle, occupied, targets),
      })
      if (!rest) continue
      vehicle.cell = { x: edge.x, z: northZ - 1 }
      vehicle.position = { ...vehicle.cell }
      vehicle.facing = 0
      vehicle.route = [
        { x: edge.x, z: edge.z },
        ...rest.map(toRoadPosition),
      ]
      vehicle.waitMinutes = 0
      const truck = this.getDeliveryFreight(vehicle)
      if (truck) {
        truck.x = vehicle.cell.x
        truck.z = vehicle.cell.z
        truck.path = vehicle.route.map(toRoadPosition)
      }
      return true
    }
    return false
  }

  findGarbageTruckRoute(
    vehicle: RoadVehicle,
    targets: readonly RoadPosition[],
    blockedCells?: ReadonlySet<string>,
  ): RoadPosition[] | null {
    return this.findServiceVehicleRoute(vehicle, targets, blockedCells)
  }

  emptySealedContainersForGarbageTruck(
    vehicle: RoadVehicle,
    room: number,
  ): number {
    if (room <= 0) return 0
    let remaining = room
    let takenTotal = 0
    const emptied = new Set<string>()
    const take = (building: PlacedBuilding | undefined) => {
      if (!building || remaining <= 0 || emptied.has(building.id)) return
      if (!isSealedWasteContainer(building.kind)) return
      if (!this.context.isSealedWasteContainerOnRoad(building)) return
      const taken = emptySealedContainerStored(building, remaining)
      if (taken <= 0) return
      vehicle.cargo += taken
      remaining -= taken
      takenTotal += taken
      emptied.add(building.id)
    }
    if (vehicle.target?.kind === 'sealedWasteContainer') {
      const target = vehicle.target
      take(
        this.context.state.buildings.find(
          (candidate) =>
            isSealedWasteContainer(candidate.kind) &&
            candidate.id === target.buildingId,
        ) ??
          this.context.state.buildings.find(
            (candidate) =>
              isSealedWasteContainer(candidate.kind) &&
              candidate.x === target.x &&
              candidate.z === target.z,
          ),
      )
    }
    const here = vehicle.cell ?? vehicle.position
    for (const building of this.context.state.buildings) {
      if (!this.garbageTruckCanServiceSealedContainer(here, building)) continue
      take(building)
    }
    return takenTotal
  }

  finishGarbageTruckLeg(vehicle: RoadVehicle): void {
    if (vehicle.state === 'responding') {
      let room = Math.max(
        0,
        SIMULATION_CONFIG.logistics.garbageTruckCapacity - vehicle.cargo,
      )
      room -= this.emptySealedContainersForGarbageTruck(vehicle, room)
      const dumps = this.context.state.wasteDumpCells
        .filter((cell) => cell.stored > 0)
        .sort((left, right) => {
          const truck = vehicle.cell ?? vehicle.position
          return (
            Math.abs(left.x - truck.x) +
            Math.abs(left.z - truck.z) -
            (Math.abs(right.x - truck.x) + Math.abs(right.z - truck.z))
          )
        })
      dumps.forEach((dump) => {
        if (room <= 0) return
        const taken = Math.min(dump.stored, room)
        dump.stored -= taken
        vehicle.cargo += taken
        room -= taken
      })
      vehicle.state = 'waiting'
      vehicle.waitMinutes = SIMULATION_CONFIG.waste.truckLoadMinutes
      vehicle.resumeState = 'returning'
      return
    }
    if (vehicle.state === 'returning' && vehicle.cargo > 0) {
      if (!this.isOffMapRoadExit(vehicle.cell ?? vehicle.position)) {
        const offMap = this.getOffMapRoadExit(vehicle.cell ?? vehicle.position)
        vehicle.route = [offMap]
        vehicle.target = { kind: 'cell', ...offMap }
        vehicle.facing = Math.PI
        return
      }
      vehicle.cargo = 0
      vehicle.state = 'waiting'
      vehicle.waitMinutes = 0
      vehicle.resumeState = 'returning'
      return
    }
    if (this.isOffMapRoadExit(vehicle.cell ?? vehicle.position)) {
      if (!this.reenterGarbageTruck(vehicle)) {
        this.holdGarbageTruckOffMap(vehicle)
      }
      return
    }
    const depot = this.context.state.logistics.wasteDepots.find((candidate) =>
      candidate.truckIds.includes(vehicle.id),
    )
    const access = depot ? this.context.getLogisticsBuildingAccess(depot, 2) : null
    const here = vehicle.cell ?? vehicle.position
    if (depot && access && access.x === here.x && access.z === here.z) {
      this.houseServiceVehicle(vehicle, depot)
      vehicle.target = { kind: 'depot', depotId: depot.id }
      return
    }
    vehicle.state = 'idle'
    vehicle.target = null
    vehicle.route = []
    vehicle.resumeState = null
  }

  continueGarbageTruck(vehicle: RoadVehicle): void {
    if (!vehicle.cell) {
      vehicle.state = 'idle'
      return
    }
    if (vehicle.cargo > 0) {
      if (
        this.isRoadExitCell(vehicle.cell) ||
        this.isOffMapRoadExit(vehicle.cell)
      ) {
        const offMap = this.getOffMapRoadExit(vehicle.cell)
        vehicle.route = this.isOffMapRoadExit(vehicle.cell) ? [] : [offMap]
        vehicle.target = { kind: 'cell', ...offMap }
        vehicle.state = 'returning'
        vehicle.resumeState = null
        vehicle.facing = Math.PI
        if (vehicle.route.length === 0) this.finishGarbageTruckLeg(vehicle)
        return
      }
      const exit = this.findReachableRoadExit(
        vehicle.cell,
        this.getVehicleDirection(vehicle),
        undefined,
        true,
      )
      if (!exit) {
        vehicle.state = 'idle'
        return
      }
      const offMap = this.getOffMapRoadExit(exit.position)
      vehicle.route = [
        ...exit.route.map(toRoadPosition),
        offMap,
      ]
      vehicle.target = { kind: 'cell', ...offMap }
      vehicle.state = 'returning'
      vehicle.resumeState = null
      return
    }
    if (this.isOffMapRoadExit(vehicle.cell)) {
      if (!this.reenterGarbageTruck(vehicle)) {
        this.holdGarbageTruckOffMap(vehicle)
      }
      return
    }
    const depot = this.context.state.logistics.wasteDepots.find((candidate) =>
      candidate.truckIds.includes(vehicle.id),
    )
    const access = depot ? this.context.getLogisticsBuildingAccess(depot, 2) : null
    if (!depot || !access) {
      vehicle.state = 'idle'
      return
    }
    if (access.x === vehicle.cell.x && access.z === vehicle.cell.z) {
      this.houseServiceVehicle(vehicle, depot)
      vehicle.target = { kind: 'depot', depotId: depot.id }
      return
    }
    const route = this.findGarbageTruckRoute(vehicle, [access])
    if (!route?.length) {
      if (this.isRoadExitCell(vehicle.cell) || this.isOffMapRoadExit(vehicle.cell)) {
        this.holdGarbageTruckOffMap(vehicle)
        return
      }
      vehicle.state = 'idle'
      return
    }
    vehicle.route = route
    vehicle.target = { kind: 'depot', depotId: depot.id }
    vehicle.state = 'returning'
    vehicle.resumeState = null
  }

  restoreMissingGarbageTrucks(): void {
    const existing = new Set(
      this.context.state.logistics.roadVehicles.map((vehicle) => vehicle.id),
    )
    for (const depot of this.context.state.logistics.wasteDepots) {
      for (const id of depot.truckIds) {
        if (existing.has(id)) continue
        const home = this.context.getLogisticsBuildingAccess(depot, 2)
          ? { x: depot.x, z: depot.z }
          : this.context.findAvailableRoadEntry() ?? this.context.getRoadEntry()
        this.context.state.logistics.roadVehicles.push(
          this.context.createRoadVehicle(id, 'garbageTruck', home),
        )
        existing.add(id)
      }
    }
  }

  returnGarbageTruckToDepot(vehicle: RoadVehicle): void {
    const depot = this.context.state.logistics.wasteDepots.find((candidate) =>
      candidate.truckIds.includes(vehicle.id),
    )
    const access = depot ? this.context.getLogisticsBuildingAccess(depot, 2) : null
    const here = access ?? this.context.findAvailableRoadEntry() ?? this.context.getRoadEntry()
    vehicle.cell = { ...here }
    vehicle.position = { ...here }
    vehicle.facing = 0
    vehicle.cargo = 0
    vehicle.route = []
    vehicle.waitMinutes = 0
    vehicle.resumeState = null
    vehicle.target = depot ? { kind: 'depot', depotId: depot.id } : null
    if (depot) this.houseServiceVehicle(vehicle, depot)
    else vehicle.state = 'idle'
  }

  isGarbageTruckAtHome(vehicle: RoadVehicle): boolean {
    const here = vehicle.cell ?? vehicle.position
    if (this.isOffMapRoadExit(here)) return false
    const depot = this.context.state.logistics.wasteDepots.find((candidate) =>
      candidate.truckIds.includes(vehicle.id),
    )
    if (!depot) return false
    const inBay =
      here.x >= depot.x &&
      here.x < depot.x + 2 &&
      here.z >= depot.z &&
      here.z < depot.z + 2
    if (vehicle.housed && inBay) return true
    const access = this.context.getLogisticsBuildingAccess(depot, 2)
    return Boolean(access && access.x === here.x && access.z === here.z)
  }

  holdGarbageTruckOffMap(vehicle: RoadVehicle): void {
    const offMap = this.getOffMapRoadExit(vehicle.cell ?? vehicle.position)
    vehicle.cell = { ...offMap }
    vehicle.position = { ...offMap }
    vehicle.facing = Math.PI
    vehicle.route = []
    vehicle.target = { kind: 'cell', ...offMap }
    vehicle.state = 'waiting'
    vehicle.resumeState = 'returning'
  }

  reenterGarbageTruck(vehicle: RoadVehicle): boolean {
    const depot = this.context.state.logistics.wasteDepots.find((candidate) =>
      candidate.truckIds.includes(vehicle.id),
    )
    const access = depot ? this.context.getLogisticsBuildingAccess(depot, 2) : null
    const entries = this.context.listFreeRoadEntries(vehicle.id, false)
    if (entries.length === 0) {
      this.holdGarbageTruckOffMap(vehicle)
      return false
    }
    for (const entry of entries) {
      vehicle.cell = { ...entry }
      vehicle.position = { ...entry }
      vehicle.facing = 0
      vehicle.cargo = 0
      if (!depot || !access) {
        vehicle.target = null
        vehicle.route = []
        vehicle.waitMinutes = 0
        vehicle.state = 'idle'
        vehicle.resumeState = null
        return true
      }
      if (access.x === entry.x && access.z === entry.z) {
        vehicle.target = { kind: 'depot', depotId: depot.id }
        vehicle.route = []
        vehicle.waitMinutes = 0
        vehicle.state = 'idle'
        vehicle.resumeState = null
        return true
      }
      const route = this.findGarbageTruckRoute(vehicle, [access])
      if (!route?.length) continue
      vehicle.target = { kind: 'depot', depotId: depot.id }
      vehicle.route = route
      vehicle.waitMinutes = 0
      vehicle.state = 'returning'
      vehicle.resumeState = null
      return true
    }
    this.holdGarbageTruckOffMap(vehicle)
    return false
  }

  claimedTentCellKeys(): Set<string> {
    if (this.claimedTentCellsCache) return this.claimedTentCellsCache
    const living = new Set(this.context.state.visitors.map((visitor) => visitor.id))
    const keys = new Set<string>()
    this.context.state.campInstallations.forEach((installation) => {
      if (installation.kind !== 'tent') return
      if (!installationIsClaimed(installation, living)) return
      keys.add(roadCellKey(installation.cell.x, installation.cell.z))
    })
    this.claimedTentCellsCache = keys
    return keys
  }

  updateSweeper(vehicle: RoadVehicle, minutes: number): void {
    if (vehicle.state === 'waiting') {
      vehicle.waitMinutes -= minutes
      if (vehicle.waitMinutes <= 0) this.continueSweeper(vehicle)
      return
    }
    if (vehicle.state === 'idle') this.dispatchSweeper(vehicle)
    if (!vehicle.route.length) {
      if (vehicle.state !== 'idle') this.finishSweeperLeg(vehicle)
      return
    }
    const path = vehicle.cell
      ? this.context.getPathAt(
          vehicle.cell.x,
          vehicle.cell.z,
          this.context.getTerrainHeight(vehicle.cell.x, vehicle.cell.z),
        ) ?? this.context.getPathAt(vehicle.cell.x, vehicle.cell.z)
      : undefined
    const mudSlowdown =
      vehicle.cell && this.context.isMudTerrain(vehicle.cell.x, vehicle.cell.z)
        ? SIMULATION_CONFIG.terrain.mudMoveMultiplier
        : 1
    const footSpeed = vehicle.cell
      ? wayInfo(
          this.context.state,
          vehicle.cell.x,
          vehicle.cell.z,
          'foot',
          path?.wayType,
        ).speed
      : 1
    vehicle.speed += minutes * mudSlowdown * Math.min(1, footSpeed)
    const interval = SIMULATION_CONFIG.logistics.sweeperMoveIntervalMinutes
    if (vehicle.speed < interval) return
    vehicle.speed %= interval
    const next = vehicle.route[0]
    if (!next) {
      this.finishSweeperLeg(vehicle)
      return
    }
    if (this.claimedTentCellKeys().has(roadCellKey(next.x, next.z))) {
      vehicle.route = []
      vehicle.state = 'idle'
      this.dispatchSweeper(vehicle)
      return
    }
    if (
      this.visitorsOnCellsThisTick?.has(roadCellKey(next.x, next.z)) &&
      vehicle.cargo < SIMULATION_CONFIG.logistics.sweeperCapacity
    ) {
      vehicle.speed = 0
      return
    }
    if (!this.context.isSweeperDriveCell(next.x, next.z)) {
      vehicle.route = []
      return
    }
    vehicle.facing = Math.atan2(
      next.x - (vehicle.cell?.x ?? vehicle.position.x),
      next.z - (vehicle.cell?.z ?? vehicle.position.z),
    )
    vehicle.cell = { x: next.x, z: next.z }
    vehicle.position = { x: next.x, z: next.z }
    vehicle.route.shift()
    vehicle.waitMinutes = 0
    this.sweepAround(vehicle)
    if (vehicle.cargo >= SIMULATION_CONFIG.logistics.sweeperCapacity) {
      vehicle.route = []
      this.sendSweeperToDump(vehicle)
    }
  }

  sweeperCell(vehicle: RoadVehicle): Cell {
    const x = vehicle.cell?.x ?? vehicle.position.x
    const z = vehicle.cell?.z ?? vehicle.position.z
    const path =
      this.context.getPathAt(x, z, this.context.getTerrainHeight(x, z)) ?? this.context.getPathAt(x, z)
    return {
      x,
      z,
      elevation: path?.elevation ?? this.context.getTerrainHeight(x, z),
    }
  }

  findSweeperRoute(
    vehicle: RoadVehicle,
    goals: readonly Cell[],
  ): RoadPosition[] | null {
    const start = this.sweeperCell(vehicle)
    const usable = goals.filter(
      (goal) => !this.claimedTentCellKeys().has(roadCellKey(goal.x, goal.z)),
    )
    if (usable.length === 0) return null
    this.context.ensurePedestrianNav(this.context.lastNavRevision() !== this.context.worldRevision())
    const goalKeys = new Set(usable.map((goal) => this.context.packCell(goal)))
    const path = findWeightedPath(
      {
        start,
        key: (cell) => this.context.packCell(cell),
        isGoal: (cell) => goalKeys.has(this.context.packCell(cell)),
        maxVisited: 4000,
        neighbors: (cell) =>
          this.context.getPedestrianNeighbors(cell, {
            allowQueue: false,
            allowCamping: true,
            allowMedical: true,
            allowFestival: true,
            allowGrass: false,
            // Same staff-only access as walking staff so robots can use Personaleingang.
            allowStaff: true,
          }).filter((next) => this.context.isSweeperDriveCell(next.x, next.z, next.elevation)),
        movementCost: (_from, to) =>
          this.context.pedestrianCostAt(to) ??
          this.context.getPedestrianSurfaceCost(to),
        heuristic: (cell) => {
          let nearest = Number.POSITIVE_INFINITY
          for (const goal of usable) {
            const distance =
              Math.abs(goal.x - cell.x) + Math.abs(goal.z - cell.z)
            if (distance < nearest) nearest = distance
          }
          return nearest
        },
      },
      this.sweeperPathScratch,
    )
    if (!path?.length) return null
    return path.map(toRoadPosition)
  }

  dispatchSweeper(vehicle: RoadVehicle): void {
    if (!vehicle.cell) return
    if (vehicle.cargo >= SIMULATION_CONFIG.logistics.sweeperCapacity) {
      this.sendSweeperToDump(vehicle)
      return
    }
    const accesses = this.getSweeperDirtAccesses(vehicle.workZones)
    if (accesses.length === 0) {
      if (vehicle.cargo > 0) {
        this.sendSweeperToDump(vehicle)
        return
      }
      this.sendSweeperToDepot(vehicle)
      return
    }
    const here = accesses.find(
      (access) =>
        access.path.x === vehicle.cell?.x && access.path.z === vehicle.cell?.z,
    )
    if (here) {
      vehicle.target = { kind: 'cell', x: here.dirt.x, z: here.dirt.z }
      vehicle.route = []
      vehicle.state = 'responding'
      return
    }
    const route = this.findSweeperRoute(
      vehicle,
      accesses.map((access) => access.path),
    )
    if (!route?.length) return
    const last = route.at(-1) ?? vehicle.cell
    const dirt =
      accesses.find(
        (access) => access.path.x === last.x && access.path.z === last.z,
      )?.dirt ?? accesses[0]?.dirt
    if (!dirt) return
    vehicle.target = { kind: 'cell', x: dirt.x, z: dirt.z }
    vehicle.route = route
    vehicle.state = 'responding'
  }

  getSweeperDirtAccesses(zones?: string[]): Array<{
    dirt: { x: number; z: number }
    path: Cell
  }> {
    const blocked = this.claimedTentCellKeys()
    const accesses: Array<{ dirt: { x: number; z: number }; path: Cell }> = []
    const seen = new Set<string>()
    this.context.state.incidents.forEach((incident) => {
      if (incident.kind !== 'litter' && incident.kind !== 'vomit') return
      if (incident.severity <= 0) return
      if (!isInAnyZone(zones, incident.x, incident.z)) return
      if (blocked.has(roadCellKey(incident.x, incident.z))) return
      const paths: Cell[] = []
      this.context.getSweeperAccessCells(incident).forEach((path) => {
        if (!blocked.has(roadCellKey(path.x, path.z))) paths.push(path)
      })
      paths.forEach((path) => {
        const key = `${path.x}:${path.z}:${incident.x}:${incident.z}`
        if (seen.has(key)) return
        seen.add(key)
        accesses.push({ dirt: { x: incident.x, z: incident.z }, path })
      })
    })
    return accesses
  }

  finishSweeperLeg(vehicle: RoadVehicle): void {
    if (vehicle.state === 'responding') {
      if (vehicle.cell && vehicle.target?.kind === 'cell') {
        vehicle.facing = Math.atan2(
          vehicle.target.x - vehicle.cell.x,
          vehicle.target.z - vehicle.cell.z,
        )
      }
      this.sweepAround(vehicle)
      if (vehicle.cargo >= SIMULATION_CONFIG.logistics.sweeperCapacity) {
        this.sendSweeperToDump(vehicle)
        return
      }
      const remaining = this.getSweeperDirtAccesses(vehicle.workZones).filter(
        (access) =>
          access.path.x !== vehicle.cell?.x || access.path.z !== vehicle.cell?.z,
      )
      if (remaining.length > 0) {
        const route = this.findSweeperRoute(
          vehicle,
          remaining.map((access) => access.path),
        )
        if (route?.length) {
          const last = route.at(-1) ?? vehicle.cell
          const dirt = last
            ? remaining.find(
                (access) =>
                  access.path.x === last.x && access.path.z === last.z,
              )?.dirt
            : undefined
          if (dirt) {
            vehicle.target = { kind: 'cell', x: dirt.x, z: dirt.z }
            vehicle.route = route
            vehicle.state = 'responding'
            return
          }
        }
      }
      if (vehicle.cargo > 0) {
        this.sendSweeperToDump(vehicle)
        return
      }
      this.sendSweeperToDepot(vehicle)
      return
    }
    if (vehicle.state === 'returning' && vehicle.cargo > 0) {
      this.depositSweeperCargo(vehicle)
      vehicle.state = 'waiting'
      vehicle.waitMinutes = SIMULATION_CONFIG.waste.truckUnloadMinutes
      vehicle.resumeState = 'idle'
      return
    }
    if (vehicle.target?.kind === 'depot') {
      vehicle.state = 'idle'
      vehicle.route = []
      vehicle.resumeState = null
      return
    }
    vehicle.state = 'idle'
    vehicle.target = null
    vehicle.route = []
    vehicle.resumeState = null
  }

  continueSweeper(vehicle: RoadVehicle): void {
    if (!vehicle.cell) {
      vehicle.state = 'idle'
      return
    }
    if (vehicle.cargo > 0) {
      this.sendSweeperToDump(vehicle)
      return
    }
    if (this.getSweeperDirtAccesses(vehicle.workZones).length > 0) {
      vehicle.state = 'idle'
      this.dispatchSweeper(vehicle)
      return
    }
    this.sendSweeperToDepot(vehicle)
  }

  sendSweeperToDump(vehicle: RoadVehicle): void {
    if (!vehicle.cell) return
    const accesses = this.getWasteDumpPathAccesses(true)
    if (accesses.length === 0) {
      vehicle.state = 'idle'
      vehicle.route = []
      return
    }
    const here = accesses.find(
      (access) =>
        access.path.x === vehicle.cell?.x && access.path.z === vehicle.cell?.z,
    )
    if (here) {
      vehicle.target = { kind: 'wasteDump', x: here.dump.x, z: here.dump.z }
      vehicle.route = []
      vehicle.state = 'returning'
      return
    }
    const route = this.findSweeperRoute(
      vehicle,
      accesses.map((access) => access.path),
    )
    if (!route?.length) {
      vehicle.state = 'idle'
      return
    }
    const last = route.at(-1) ?? vehicle.cell
    const dump =
      accesses.find(
        (access) => access.path.x === last.x && access.path.z === last.z,
      )?.dump ?? accesses[0]?.dump
    if (!dump) return
    vehicle.target = { kind: 'wasteDump', x: dump.x, z: dump.z }
    vehicle.route = route
    vehicle.state = 'returning'
    vehicle.resumeState = null
  }

  getWasteDumpPathAccesses(requireRoom = false): Array<{
    dump: WasteDumpCell
    path: Cell
  }> {
    const seen = new Set<string>()
    const accesses: Array<{ dump: WasteDumpCell; path: Cell }> = []
    this.context.state.wasteDumpCells.forEach((dump) => {
      if (requireRoom && wasteDumpRemaining(dump) <= 0) return
      this.context.getSweeperAccessCells(dump).forEach((path) => {
        const key = `${path.x}:${path.z}:${path.elevation}`
        if (seen.has(key)) return
        seen.add(key)
        accesses.push({ dump, path })
      })
    })
    return accesses
  }

  sendSweeperToDepot(vehicle: RoadVehicle): void {
    if (!vehicle.cell) {
      vehicle.state = 'idle'
      return
    }
    const depot = this.context.state.logistics.specialDepots.find((candidate) =>
      candidate.vehicleIds.includes(vehicle.id),
    )
    const access = depot ? this.context.getLogisticsPathAccess(depot, 3) : null
    if (!depot || !access) {
      vehicle.state = 'idle'
      vehicle.target = null
      vehicle.route = []
      return
    }
    if (access.x === vehicle.cell.x && access.z === vehicle.cell.z) {
      vehicle.state = 'idle'
      vehicle.target = { kind: 'depot', depotId: depot.id }
      vehicle.route = []
      vehicle.resumeState = null
      return
    }
    const route = this.findSweeperRoute(vehicle, [access])
    if (!route?.length) {
      vehicle.state = 'idle'
      return
    }
    vehicle.route = route
    vehicle.target = { kind: 'depot', depotId: depot.id }
    vehicle.state = 'returning'
    vehicle.resumeState = null
  }

  depositSweeperCargo(vehicle: RoadVehicle): void {
    if (vehicle.cargo <= 0) return
    const truck = vehicle.cell ?? vehicle.position
    const dump = [...this.context.state.wasteDumpCells]
      .filter((cell) => wasteDumpRemaining(cell) > 0)
      .sort((left, right) => {
        return (
          Math.abs(left.x - truck.x) +
          Math.abs(left.z - truck.z) -
          (Math.abs(right.x - truck.x) + Math.abs(right.z - truck.z))
        )
      })[0]
    if (!dump) return
    vehicle.cargo -= acceptWasteAtDump(dump, vehicle.cargo)
  }

  sweepAround(vehicle: RoadVehicle): void {
    if (!vehicle.cell) return
    const blocked = this.claimedTentCellKeys()
    const direction = this.getVehicleDirection(vehicle)
    const forward = DIRECTION_OFFSETS[direction]
    const right = DIRECTION_OFFSETS[(((direction + 1) % 4) as Direction)]
    const width = SIMULATION_CONFIG.logistics.sweeperCleanWidth
    const depth = SIMULATION_CONFIG.logistics.sweeperCleanDepth
    const half = Math.floor(width / 2)
    const cells = new Set<string>()
    for (let step = 0; step <= depth; step += 1) {
      for (let lateral = -half; lateral <= half; lateral += 1) {
        const x = vehicle.cell.x + forward.x * step + right.x * lateral
        const z = vehicle.cell.z + forward.z * step + right.z * lateral
        if (blocked.has(roadCellKey(x, z))) continue
        cells.add(roadCellKey(x, z))
      }
    }
    const room = () =>
      Math.max(0, SIMULATION_CONFIG.logistics.sweeperCapacity - vehicle.cargo)
    this.context.state.incidents.forEach((incident) => {
      if (incident.kind !== 'litter' && incident.kind !== 'vomit') return
      if (!isInAnyZone(vehicle.workZones, incident.x, incident.z)) return
      if (!cells.has(roadCellKey(incident.x, incident.z))) return
      const taken = Math.min(incident.severity, room())
      if (taken <= 0) return
      incident.severity -= taken
      vehicle.cargo += taken
    })
    this.context.state.incidents = this.context.state.incidents.filter(
      (incident) =>
        (incident.kind !== 'litter' && incident.kind !== 'vomit') ||
        incident.severity > 0,
    )
  }

  getWorldSouthEdge(): number {
    return -this.context.getWorldSize() / 2
  }

  isRoadExitCell(position: RoadPosition): boolean {
    return (
      position.z === this.getWorldSouthEdge() &&
      position.x >= -3 &&
      position.x <= 2
    )
  }

  isVisitorCarExit(position: RoadPosition): boolean {
    if (this.isOffMapRoadExit(position)) return true
    if (position.z !== this.getWorldSouthEdge()) return false
    const road = this.context.getRoadCellAt(position.x, position.z, position.elevation)
    return Boolean(road && isRoadDirectionAllowed(road, 2))
  }

  isOffMapRoadExit(position: RoadPosition): boolean {
    return position.z < this.getWorldSouthEdge()
  }

  getOffMapRoadExit(position: RoadPosition): RoadPosition {
    return {
      x: Math.max(-3, Math.min(2, position.x)),
      z: this.getWorldSouthEdge() - 1,
    }
  }

  dispatchIdleAmbulances(): void {
    const idle: RoadVehicle[] = []
    const claimed = new Set<string>()
    const seated = collectSeatedPassengerIds(this.context.state.logistics.roadVehicles)
    for (const vehicle of this.context.state.logistics.roadVehicles) {
      if (vehicle.kind !== 'ambulance') continue
      for (const passengerId of vehicle.passengerIds) claimed.add(passengerId)
      if (vehicle.pendingSale) continue
      if (vehicle.state === 'idle' && vehicle.cell) idle.push(vehicle)
    }
    if (idle.length === 0) return
    for (const visitor of this.context.state.visitors) {
      if (visitor.rescueVehicleId) claimed.add(visitor.id)
    }
    const victims = this.context.state.visitors.filter(
      (visitor) =>
        visitor.state === 'injured' &&
        !claimed.has(visitor.id) &&
        !this.context.isVisitorSeatedInVehicle(visitor, seated),
    )
    if (victims.length === 0) return
    const pairs: Array<{
      vehicle: RoadVehicle
      victim: Visitor
      distance: number
    }> = []
    for (const vehicle of idle) {
      const cell = vehicle.cell
      if (!cell) continue
      for (const victim of victims) {
        pairs.push({
          vehicle,
          victim,
          distance:
            Math.abs(victim.cellX - cell.x) + Math.abs(victim.cellZ - cell.z),
        })
      }
    }
    pairs.sort(
      (left, right) =>
        left.distance - right.distance ||
        left.vehicle.id.localeCompare(right.vehicle.id) ||
        left.victim.id.localeCompare(right.victim.id),
    )
    const usedVehicles = new Set<string>()
    const usedVictims = new Set<string>()
    for (const pair of pairs) {
      if (usedVehicles.has(pair.vehicle.id) || usedVictims.has(pair.victim.id)) {
        continue
      }
      if (this.sendAmbulanceToVictim(pair.vehicle, pair.victim)) {
        usedVehicles.add(pair.vehicle.id)
        usedVictims.add(pair.victim.id)
      }
    }
  }

  sendAmbulanceToVictim(vehicle: RoadVehicle, victim: Visitor): boolean {
    this.unhouseServiceVehicle(vehicle)
    if (!vehicle.cell) return false
    const target = { x: victim.cellX, z: victim.cellZ }
    const route = this.routePreferringOpenLights({
      roadCells: this.context.state.logistics.roadCells,
      graph: this.context.getRoadGraph(),
      start: vehicle.cell,
      target,
      initialDirection: this.getVehicleDirection(vehicle),
    })
    if (!route) return false
    vehicle.target = { kind: 'cell', ...target }
    victim.rescueVehicleId = vehicle.id
    vehicle.route = route.map(toRoadPosition)
    vehicle.state = 'responding'
    return true
  }

  finishAmbulanceLeg(vehicle: RoadVehicle): void {
    if (vehicle.state === 'responding' && vehicle.cell) {
      const seated = collectSeatedPassengerIds(this.context.state.logistics.roadVehicles)
      const victims = this.context.state.visitors
        .filter(
          (visitor) =>
            visitor.state === 'injured' &&
            visitor.cellX === vehicle.cell?.x &&
            visitor.cellZ === vehicle.cell?.z &&
            !this.context.isVisitorSeatedInVehicle(visitor, seated),
        )
        .slice(0, SIMULATION_CONFIG.logistics.ambulanceCapacity)
      victims.forEach((visitor) => {
        visitor.state = 'medical-transport'
        visitor.injuryVehicleId = null
        visitor.rescueVehicleId = null
        vehicle.passengerIds.push(visitor.id)
      })
      const garage = this.context.state.logistics.ambulanceGarages.find((candidate) =>
        candidate.bays.includes(vehicle.id),
      )
      const access = garage
        ? this.context.getLogisticsBuildingAccess(garage, 2)
        : null
      if (!access || vehicle.passengerIds.length === 0) {
        vehicle.state = 'idle'
        vehicle.target = null
        if (vehicle.pendingSale || vehicle.passengerIds.length === 0) {
          this.sendAmbulanceHome(vehicle)
        }
        return
      }
      const route = this.routePreferringOpenLights({
        roadCells: this.context.state.logistics.roadCells,
        graph: this.context.getRoadGraph(),
        start: vehicle.cell,
        target: access,
        initialDirection: this.getVehicleDirection(vehicle),
        allowUTurn: true,
      })
      if (!route) {
        vehicle.state = 'idle'
        return
      }
      vehicle.route = route.map(toRoadPosition)
      vehicle.state = 'returning'
      vehicle.target = garage
        ? { kind: 'garage', garageId: garage.id }
        : null
      return
    }
    if (vehicle.state === 'returning') {
      vehicle.passengerIds.forEach((visitorId) => {
        const visitor = this.context.getVisitor(visitorId)
        if (!visitor || !vehicle.cell) return
        visitor.state = 'sleeping'
        visitor.x = vehicle.cell.x + visitor.tileOffsetX
        visitor.z = vehicle.cell.z + visitor.tileOffsetZ
        visitor.cellX = vehicle.cell.x
        visitor.cellZ = vehicle.cell.z
        visitor.thought =
          'Der Krankenwagen hat mich an der Garage an die Sanitäter übergeben.'
      })
      vehicle.passengerIds = []
      vehicle.target = null
      if (vehicle.pendingSale) {
        this.completeAmbulanceSale(vehicle)
        return
      }
      const garage = this.context.state.logistics.ambulanceGarages.find((candidate) =>
        candidate.bays.includes(vehicle.id),
      )
      if (garage) this.houseServiceVehicle(vehicle, garage)
      else vehicle.state = 'idle'
    }
  }

  returnIdleAmbulancesToGarage(): void {
    const idle = this.context.state.logistics.roadVehicles.filter(
      (vehicle) =>
        vehicle.kind === 'ambulance' &&
        vehicle.state === 'idle' &&
        vehicle.passengerIds.length === 0,
    )
    for (const vehicle of idle) {
      if (this.isAmbulanceAtHome(vehicle)) {
        if (vehicle.pendingSale) this.completeAmbulanceSale(vehicle)
        continue
      }
      this.sendAmbulanceHome(vehicle)
    }
  }

  isAmbulanceAtHome(vehicle: RoadVehicle): boolean {
    const here = vehicle.cell ?? vehicle.position
    const garage = this.context.state.logistics.ambulanceGarages.find((candidate) =>
      candidate.bays.includes(vehicle.id),
    )
    if (!garage) return false
    const inBay =
      here.x >= garage.x &&
      here.x < garage.x + 2 &&
      here.z >= garage.z &&
      here.z < garage.z + 2
    if (vehicle.housed && inBay) return true
    const access = this.context.getLogisticsBuildingAccess(garage, 2)
    return Boolean(access && access.x === here.x && access.z === here.z)
  }

  sendAmbulanceHome(vehicle: RoadVehicle): void {
    const garage = this.context.state.logistics.ambulanceGarages.find((candidate) =>
      candidate.bays.includes(vehicle.id),
    )
    const access = garage ? this.context.getLogisticsBuildingAccess(garage, 2) : null
    const start = vehicle.cell ?? vehicle.position
    if (!garage || !access) {
      vehicle.state = 'idle'
      vehicle.route = []
      return
    }
    if (access.x === start.x && access.z === start.z) {
      this.houseServiceVehicle(vehicle, garage)
      vehicle.target = { kind: 'garage', garageId: garage.id }
      if (vehicle.pendingSale) this.completeAmbulanceSale(vehicle)
      return
    }
    const route = this.routePreferringOpenLights({
      roadCells: this.context.state.logistics.roadCells,
      graph: this.context.getRoadGraph(),
      start,
      target: access,
      initialDirection: this.getVehicleDirection(vehicle),
      allowUTurn: true,
    })
    if (!route) {
      vehicle.state = 'idle'
      vehicle.route = []
      vehicle.target = { kind: 'garage', garageId: garage.id }
      return
    }
    vehicle.housed = false
    vehicle.route = route.map(toRoadPosition)
    vehicle.state = 'returning'
    vehicle.target = { kind: 'garage', garageId: garage.id }
    vehicle.resumeState = null
    vehicle.waitMinutes = 0
  }

  requestAmbulanceSale(vehicleId: string): ActionResult {
    const vehicle = this.context.state.logistics.roadVehicles.find(
      (candidate) => candidate.id === vehicleId && candidate.kind === 'ambulance',
    )
    if (!vehicle) {
      for (const garage of this.context.state.logistics.ambulanceGarages) {
        garage.bays = [
          garage.bays[0] === vehicleId ? null : garage.bays[0],
          garage.bays[1] === vehicleId ? null : garage.bays[1],
        ]
      }
      this.context.emit()
      return { ok: false, message: 'Der Krankenwagen war nicht mehr vorhanden und wurde bereinigt' }
    }
    vehicle.pendingSale = true
    if (vehicle.passengerIds.length === 0 && vehicle.state === 'responding') {
      this.cancelAmbulanceAssignment(vehicle)
    }
    if (
      this.isAmbulanceAtHome(vehicle) &&
      vehicle.passengerIds.length === 0 &&
      (vehicle.state === 'idle' || vehicle.state === 'waiting' || vehicle.route.length === 0)
    ) {
      this.completeAmbulanceSale(vehicle)
      this.context.emit()
      return { ok: true, message: 'Krankenwagen verkauft' }
    }
    if (vehicle.passengerIds.length === 0 && vehicle.state !== 'returning') {
      this.sendAmbulanceHome(vehicle)
    } else if (vehicle.passengerIds.length > 0 && vehicle.state !== 'returning' && vehicle.cell) {
      this.sendAmbulanceHome(vehicle)
    }
    this.context.emit()
    return {
      ok: true,
      message: 'Krankenwagen fährt zur Garage und wird dann verkauft',
    }
  }

  cancelAmbulanceAssignment(vehicle: RoadVehicle): void {
    for (const visitor of this.context.state.visitors) {
      if (visitor.rescueVehicleId === vehicle.id) visitor.rescueVehicleId = null
    }
    vehicle.route = []
    vehicle.target = null
    vehicle.state = 'idle'
    vehicle.waitMinutes = 0
  }

  completeAmbulanceSale(vehicle: RoadVehicle): void {
    const position = vehicle.cell ?? vehicle.position
    vehicle.passengerIds.forEach((visitorId) => {
      const visitor = this.context.getVisitor(visitorId)
      if (!visitor) return
      visitor.x = position.x + visitor.tileOffsetX
      visitor.z = position.z + visitor.tileOffsetZ
      visitor.cellX = position.x
      visitor.cellZ = position.z
      visitor.rescueVehicleId = null
      visitor.injuryVehicleId = null
      visitor.state = 'sleeping'
      visitor.thought = 'Der Krankenwagen wurde an der Garage übergeben.'
    })
    for (const visitor of this.context.state.visitors) {
      if (visitor.rescueVehicleId === vehicle.id) visitor.rescueVehicleId = null
    }
    for (const garage of this.context.state.logistics.ambulanceGarages) {
      garage.bays = [
        garage.bays[0] === vehicle.id ? null : garage.bays[0],
        garage.bays[1] === vehicle.id ? null : garage.bays[1],
      ]
    }
    this.context.state.logistics.roadVehicles =
      this.context.state.logistics.roadVehicles.filter((candidate) => candidate.id !== vehicle.id)
    const refund = Math.floor(
      SIMULATION_CONFIG.logistics.ambulanceCost *
        SIMULATION_CONFIG.logistics.busResaleFraction,
    )
    bookFinance(this.context.state, 'construction', refund)
    this.context.state.cashEffects.push({
      id: this.context.nextId('ambulance-sale'),
      amount: refund,
      x: position.x + 0.5,
      y: 1.4,
      z: position.z + 0.5,
      age: 0,
    })
  }

  dispatchBus(vehicle: RoadVehicle): void {
    const line = this.context.state.logistics.busLines.find(
      (candidate) => candidate.id === vehicle.lineId && candidate.active,
    )
    if (!line || !vehicle.cell || line.stopIds.length < 2) return
    const absoluteMinute = this.context.state.day * 1440 + this.context.state.minute
    if (
      line.lastDepartureMinute !== null &&
      absoluteMinute - line.lastDepartureMinute < line.headway
    ) {
      return
    }
    vehicle.nextStopIndex = 0
    if (this.routeBusToStop(vehicle, line, 0)) {
      line.lastDepartureMinute = absoluteMinute
    }
  }

  updateBusAtStop(
    vehicle: RoadVehicle,
    minutes: number,
    busWaitersByCell: Map<string, Visitor[]>,
  ): void {
    if (vehicle.kind !== 'bus' || vehicle.state !== 'at-stop') return
    const line = this.context.state.logistics.busLines.find(
      (candidate) => candidate.id === vehicle.lineId,
    )
    const stopId =
      vehicle.target?.kind === 'busStop'
        ? vehicle.target.stopId
        : null
    const stop =
      stopId
        ? this.context.state.logistics.busStops.find(
            (candidate) => candidate.id === stopId,
          )
        : undefined
    if (!line || !stop) {
      vehicle.state = 'idle'
      return
    }
    vehicle.passengerIds = vehicle.passengerIds.filter((visitorId) => {
      const visitor = this.context.getVisitor(visitorId)
      return Boolean(visitor && visitor.state === 'bus-riding')
    })
    const disembarkingIds = new Set(
      vehicle.passengerIds.filter((visitorId) => {
        const visitor = this.context.getVisitor(visitorId)
        return (
          !visitor?.busDestinationStopId ||
          visitor.busDestinationStopId === stop.id
        )
      }),
    )
    disembarkingIds.forEach((visitorId) => {
      const visitor = this.context.getVisitor(visitorId)
      if (!visitor) return
      visitor.x = stop.x + visitor.tileOffsetX
      visitor.z = stop.z + visitor.tileOffsetZ
      visitor.cellX = stop.x
      visitor.cellZ = stop.z
      visitor.cellElevation = 0
      visitor.busLineId = null
      visitor.busWaitMinutes = 0
      const destination = visitor.busDestination
      const resumeState = visitor.busResumeState
      const resumeTargetId = visitor.busResumeTargetId
      visitor.busDestination = null
      visitor.busDestinationStopId = null
      visitor.busResumeState = null
      visitor.busResumeTargetId = null
      const route = destination
        ? this.context.findPath(
            { x: stop.x, z: stop.z, elevation: 0 },
            [destination],
          )
        : null
      if (destination && route) {
        visitor.state = resumeState ?? 'exploring'
        visitor.targetId = resumeTargetId
        visitor.route = route
        visitor.thought = 'Nach der Busfahrt gehe ich den Rest des Weges zu Fuß.'
      } else {
        visitor.state = resumeState ?? 'exploring'
        visitor.targetId = resumeTargetId
        visitor.route = []
      }
    })
    vehicle.passengerIds = vehicle.passengerIds.filter(
      (visitorId) => !disembarkingIds.has(visitorId),
    )
    disembarkingIds.forEach((visitorId) => {
      const visitor = this.context.getVisitor(visitorId)
      if (!visitor || visitor.route.length > 0) return
      this.context.decideNextAction(visitor)
    })
    const radius = SIMULATION_CONFIG.logistics.busBoardingRadiusTiles
    const waiting = collectEligibleBusWaiters(
      busWaitersByCell,
      line.id,
      stop,
      radius,
      roadCellKey,
    )
    const freeSeats = Math.max(
      0,
      SIMULATION_CONFIG.logistics.busCapacity - vehicle.passengerIds.length,
    )
    const boardsThisTick = Math.min(
      freeSeats,
      SIMULATION_CONFIG.logistics.busBoardsPerTick,
      waiting.length,
    )
    for (let index = 0; index < boardsThisTick; index += 1) {
      const visitor = waiting[index]!
      visitor.state = 'bus-riding'
      visitor.route = []
      if (!vehicle.passengerIds.includes(visitor.id)) {
        vehicle.passengerIds.push(visitor.id)
      }
    }
    const leftover = waiting.length - boardsThisTick
    const remainingSeats = freeSeats - boardsThisTick
    vehicle.waitMinutes += minutes
    if (vehicle.waitMinutes < SIMULATION_CONFIG.logistics.busStopDwellMinutes) {
      return
    }
    if (remainingSeats > 0 && leftover > 0) {
      return
    }
    if (remainingSeats === 0 && leftover > 0) {
      waiting.slice(boardsThisTick).forEach((visitor) => {
        this.context.recordComplaint(visitor, 'bus-full')
        visitor.emotion = 'angry'
      })
    }
    const nextIndex = (vehicle.nextStopIndex + 1) % line.stopIds.length
    this.routeBusToStop(vehicle, line, nextIndex)
  }

  routeBusToStop(
    vehicle: RoadVehicle,
    line: { stopIds: string[] },
    stopIndex: number,
  ): boolean {
    const stop = this.context.state.logistics.busStops.find(
      (candidate) => candidate.id === line.stopIds[stopIndex],
    )
    if (!stop || !vehicle.cell) return false
    const route = this.routePreferringOpenLights({
      roadCells: this.context.state.logistics.roadCells,
      graph: this.context.getRoadGraph(),
      start: vehicle.cell,
      target: stop.roadCell,
      initialDirection: this.getVehicleDirection(vehicle),
    })
    if (!route) return false
    vehicle.nextStopIndex = stopIndex
    vehicle.target = { kind: 'busStop', stopId: stop.id }
    vehicle.route = route.map(toRoadPosition)
    vehicle.state = route.length > 0 ? 'driving' : 'at-stop'
    vehicle.waitMinutes = 0
    return true
  }

  houseServiceVehicle(
    vehicle: RoadVehicle,
    home: { x: number; z: number; elevation?: number },
  ): void {
    vehicle.housed = true
    vehicle.state = 'idle'
    vehicle.route = []
    vehicle.cell = { x: home.x, z: home.z, elevation: home.elevation }
    vehicle.position = { ...vehicle.cell }
    vehicle.waitMinutes = 0
  }

  isServiceVehicleInBay(vehicle: RoadVehicle): boolean {
    const here = vehicle.cell ?? vehicle.position
    if (vehicle.kind === 'ambulance') {
      const garage = this.context.state.logistics.ambulanceGarages.find((candidate) =>
        candidate.bays.includes(vehicle.id),
      )
      return Boolean(
        garage &&
          here.x >= garage.x &&
          here.x < garage.x + 2 &&
          here.z >= garage.z &&
          here.z < garage.z + 2,
      )
    }
    if (vehicle.kind === 'fireTruck') {
      const station = this.context.state.logistics.fireStations.find((candidate) =>
        candidate.bays.includes(vehicle.id),
      )
      return Boolean(
        station &&
          here.x >= station.x &&
          here.x < station.x + 2 &&
          here.z >= station.z &&
          here.z < station.z + 2,
      )
    }
    if (vehicle.kind === 'garbageTruck') {
      const depot = this.context.state.logistics.wasteDepots.find((candidate) =>
        candidate.truckIds.includes(vehicle.id),
      )
      return Boolean(
        depot &&
          here.x >= depot.x &&
          here.x < depot.x + 2 &&
          here.z >= depot.z &&
          here.z < depot.z + 2,
      )
    }
    return false
  }

  unhouseServiceVehicle(vehicle: RoadVehicle): void {
    if (!vehicle.housed) return
    const pullOut = this.isServiceVehicleInBay(vehicle)
    vehicle.housed = false
    if (!pullOut) return
    const access =
      vehicle.kind === 'ambulance'
        ? this.ambulanceHomeAccess(vehicle)
        : vehicle.kind === 'fireTruck'
          ? this.fireTruckHomeAccess(vehicle)
          : vehicle.kind === 'garbageTruck'
            ? this.garbageHomeAccess(vehicle)
            : null
    if (access) {
      vehicle.cell = { ...access }
      vehicle.position = { ...access }
    }
  }

  ambulanceHomeAccess(vehicle: RoadVehicle): RoadPosition | null {
    const garage = this.context.state.logistics.ambulanceGarages.find((candidate) =>
      candidate.bays.includes(vehicle.id),
    )
    return garage ? this.context.getLogisticsBuildingAccess(garage, 2) : null
  }

  fireTruckHomeAccess(vehicle: RoadVehicle): RoadPosition | null {
    const station = this.context.state.logistics.fireStations.find((candidate) =>
      candidate.bays.includes(vehicle.id),
    )
    return station ? this.context.getLogisticsBuildingAccess(station, 2) : null
  }

  garbageHomeAccess(vehicle: RoadVehicle): RoadPosition | null {
    const depot = this.context.state.logistics.wasteDepots.find((candidate) =>
      candidate.truckIds.includes(vehicle.id),
    )
    return depot ? this.context.getLogisticsBuildingAccess(depot, 2) : null
  }

  dispatchIdleFireTrucks(): void {
    const idle = this.context.state.logistics.roadVehicles.filter(
      (vehicle) => vehicle.kind === 'fireTruck' && vehicle.state === 'idle',
    )
    if (idle.length === 0) return
    const claimed = new Set(
      this.context.state.logistics.roadVehicles
        .filter((vehicle) => vehicle.kind === 'fireTruck' && vehicle.target?.kind === 'cell')
        .map((vehicle) => `${vehicle.target && vehicle.target.kind === 'cell' ? `${vehicle.target.x}:${vehicle.target.z}` : ''}`),
    )
    const fires = this.context.state.incidents
      .filter((incident) => incident.kind === 'fire' && !claimed.has(`${incident.x}:${incident.z}`))
      .sort((left, right) => left.id.localeCompare(right.id))
    for (const vehicle of idle) {
      const fire = fires.find((incident) => !claimed.has(`${incident.x}:${incident.z}`))
      if (!fire) break
      if (this.sendFireTruckToFire(vehicle, fire)) claimed.add(`${fire.x}:${fire.z}`)
    }
  }

  sendFireTruckToFire(
    vehicle: RoadVehicle,
    fire: { x: number; z: number },
  ): boolean {
    this.unhouseServiceVehicle(vehicle)
    if (!vehicle.cell) return false
    const route = this.routePreferringOpenLights({
      roadCells: this.context.state.logistics.roadCells,
      graph: this.context.getRoadGraph(),
      start: vehicle.cell,
      target: fire,
      initialDirection: this.getVehicleDirection(vehicle),
      allowUTurn: true,
    })
    if (!route) return false
    vehicle.target = { kind: 'cell', ...fire }
    vehicle.route = route.map(toRoadPosition)
    vehicle.state = 'responding'
    return true
  }

  returnIdleFireTrucks(): void {
    for (const vehicle of this.context.state.logistics.roadVehicles) {
      if (vehicle.kind !== 'fireTruck' || vehicle.state !== 'idle') continue
      if (this.isFireTruckAtHome(vehicle)) continue
      this.sendFireTruckHome(vehicle)
    }
  }

  isFireTruckAtHome(vehicle: RoadVehicle): boolean {
    const here = vehicle.cell ?? vehicle.position
    const station = this.context.state.logistics.fireStations.find((candidate) =>
      candidate.bays.includes(vehicle.id),
    )
    if (!station) return false
    const inBay =
      here.x >= station.x &&
      here.x < station.x + 2 &&
      here.z >= station.z &&
      here.z < station.z + 2
    if (vehicle.housed && inBay) return true
    const access = this.fireTruckHomeAccess(vehicle)
    return Boolean(access && access.x === here.x && access.z === here.z)
  }

  sendFireTruckHome(vehicle: RoadVehicle): void {
    const station = this.context.state.logistics.fireStations.find((candidate) =>
      candidate.bays.includes(vehicle.id),
    )
    const access = this.fireTruckHomeAccess(vehicle)
    const start = vehicle.cell ?? vehicle.position
    if (!station || !access) {
      vehicle.state = 'idle'
      vehicle.route = []
      return
    }
    if (access.x === start.x && access.z === start.z) {
      this.houseServiceVehicle(vehicle, station)
      vehicle.target = { kind: 'fireStation', stationId: station.id }
      return
    }
    const route = this.routePreferringOpenLights({
      roadCells: this.context.state.logistics.roadCells,
      graph: this.context.getRoadGraph(),
      start,
      target: access,
      initialDirection: this.getVehicleDirection(vehicle),
      allowUTurn: true,
    })
    if (!route) {
      vehicle.state = 'idle'
      return
    }
    vehicle.housed = false
    vehicle.route = route.map(toRoadPosition)
    vehicle.state = 'returning'
    vehicle.target = { kind: 'fireStation', stationId: station.id }
    vehicle.waitMinutes = 0
  }
}
