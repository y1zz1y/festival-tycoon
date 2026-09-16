import type { Cell } from './GameState'
import type { BandArrivalMode } from './bandSupply'
import {
  arrivalModeForBand,
  bandArriveMinute,
  bandLeaveMinute,
  isBandOnSiteMinute,
  todayBandDemand,
  type BandSupplyComponent,
} from './bandSupply'
import { bandCostumeId, bandRoles, type BandRole } from './bandLooks'
import { BANDS } from './festivalManagement'
import type { Booking } from './festivalManagement'
import type { RoadPosition, RoadVehicle } from './logistics'

export type BandActorState = 'arriving' | 'idle' | 'performing' | 'leaving'

export type BandActor = {
  id: string
  bandId: string
  stageId: string
  componentId: string
  arrivalMode: BandArrivalMode
  x: number
  y: number
  z: number
  cellX: number
  cellZ: number
  cellElevation: number
  facing: number
  route: Cell[]
  state: BandActorState
  vehicleId: string | null
  parkingId: string | null
  wanderMinutes: number
  memberIndex: number
  role: BandRole
  costumeId: string
}

export function normalizeBandActor(value: unknown): BandActor | null {
  if (typeof value !== 'object' || value === null) return null
  const source = value as Record<string, unknown>
  if (typeof source.id !== 'string' || typeof source.bandId !== 'string') return null
  const route = Array.isArray(source.route)
    ? source.route
        .filter(
          (cell): cell is Cell =>
            typeof cell === 'object' &&
            cell !== null &&
            Number.isFinite((cell as Cell).x) &&
            Number.isFinite((cell as Cell).z),
        )
        .map((cell) => ({
          x: Number(cell.x),
          z: Number(cell.z),
          elevation: Number.isFinite(cell.elevation) ? Number(cell.elevation) : 0,
        }))
    : []
  return {
    id: source.id,
    bandId: source.bandId,
    stageId: typeof source.stageId === 'string' ? source.stageId : '',
    componentId: typeof source.componentId === 'string' ? source.componentId : '',
    arrivalMode: source.arrivalMode === 'tourBus' ? 'tourBus' : 'staffGate',
    x: Number(source.x) || 0,
    y: Number(source.y) || 0,
    z: Number(source.z) || 0,
    cellX: Number(source.cellX) || 0,
    cellZ: Number(source.cellZ) || 0,
    cellElevation: Number(source.cellElevation) || 0,
    facing: Number(source.facing) || 0,
    route,
    state:
      source.state === 'arriving' ||
      source.state === 'performing' ||
      source.state === 'leaving'
        ? source.state
        : 'idle',
    vehicleId: typeof source.vehicleId === 'string' ? source.vehicleId : null,
    parkingId: typeof source.parkingId === 'string' ? source.parkingId : null,
    wanderMinutes: Number(source.wanderMinutes) || 0,
    memberIndex: Number.isFinite(Number(source.memberIndex)) ? Number(source.memberIndex) : 0,
    role: isBandRole(source.role) ? source.role : bandRoles(source.bandId)[0] ?? 'singer',
    costumeId: typeof source.costumeId === 'string' ? source.costumeId : bandCostumeId(source.bandId),
  }
}

function isBandRole(value: unknown): value is BandRole {
  return (
    value === 'singer' ||
    value === 'guitar' ||
    value === 'drums' ||
    value === 'keys' ||
    value === 'brass' ||
    value === 'dj'
  )
}

export function createBandActor(
  id: string,
  bandId: string,
  stageId: string,
  componentId: string,
  arrivalMode: BandArrivalMode,
  spawn: Cell,
  memberIndex = 0,
  role: BandRole = bandRoles(bandId)[memberIndex] ?? 'singer',
): BandActor {
  return {
    id,
    bandId,
    stageId,
    componentId,
    arrivalMode,
    x: spawn.x + 0.5,
    y: spawn.elevation,
    z: spawn.z + 0.5,
    cellX: spawn.x,
    cellZ: spawn.z,
    cellElevation: spawn.elevation,
    facing: 0,
    route: [],
    state: 'arriving',
    vehicleId: null,
    parkingId: null,
    wanderMinutes: 0,
    memberIndex,
    role,
    costumeId: bandCostumeId(bandId),
  }
}

export function createTourBusVehicle(
  id: string,
  position: RoadPosition,
  parkingId: string,
  actorIds: string[],
): RoadVehicle {
  return {
    id,
    kind: 'tourBus',
    position: { ...position },
    cell: { ...position },
    route: [],
    state: 'driving',
    speed: 0,
    passengerIds: [...actorIds],
    groupId: null,
    parkingCell: null,
    target: { kind: 'tourBusParking', buildingId: parkingId },
    facing: 0,
    waitMinutes: 0,
    lineId: null,
    nextStopIndex: 0,
    resumeState: null,
    cargo: 0,
    reservedParkingId: parkingId,
  }
}

export type PlannedBandPresence = {
  bandId: string
  stageId: string
  componentId: string
  arrivalMode: BandArrivalMode
  parkingId: string | null
  leaveMinute: number
}

export function planBandPresence(options: {
  enabled: boolean
  day: number
  minute: number
  bookings: readonly Booking[]
  components: readonly BandSupplyComponent[]
  usableParkingIdsByComponent: ReadonlyMap<string, string[]>
}): PlannedBandPresence[] {
  if (!options.enabled) return []
  const planned: PlannedBandPresence[] = []
  const reserved = new Set<string>()
  for (const component of options.components) {
    if (!component.active) continue
    const demand = todayBandDemand(
      { day: options.day, festival: { bookings: options.bookings } },
      component.stageIds,
    )
    const slots = options.usableParkingIdsByComponent.get(component.id) ?? []
    let slotIndex = 0
    for (const item of demand) {
      if (!isBandOnSiteMinute(options.bookings, item.bandId, options.day, options.minute)) {
        continue
      }
      const booking = options.bookings.find(
        (entry) =>
          entry.bandId === item.bandId &&
          entry.day === options.day &&
          component.stageIds.includes(entry.stageId),
      )
      if (!booking) continue
      const band = BANDS.find((entry) => entry.id === item.bandId)
      let parkingId: string | null = null
      if (item.wantsBus) {
        while (slotIndex < slots.length && reserved.has(slots[slotIndex]!)) slotIndex += 1
        if (slotIndex < slots.length) {
          parkingId = slots[slotIndex]!
          reserved.add(parkingId)
          slotIndex += 1
        }
      }
      planned.push({
        bandId: item.bandId,
        stageId: booking.stageId,
        componentId: component.id,
        arrivalMode: arrivalModeForBand(band?.draw ?? item.draw, parkingId !== null),
        parkingId,
        leaveMinute: bandLeaveMinute(options.bookings, item.bandId, options.day),
      })
    }
  }
  return planned
}

export function placeActorOnCell(actor: BandActor, cell: Cell): void {
  actor.cellX = cell.x
  actor.cellZ = cell.z
  actor.cellElevation = cell.elevation
  actor.x = cell.x + 0.5
  actor.y = cell.elevation
  actor.z = cell.z + 0.5
  actor.route = []
}

export function stepBandActor(actor: BandActor, minutes: number, speed = 1.15): boolean {
  if (actor.vehicleId || actor.route.length === 0) return false
  const remaining = minutes * speed
  let travel = remaining
  while (travel > 0 && actor.route.length > 0) {
    const next = actor.route[0]!
    const dx = next.x + 0.5 - actor.x
    const dz = next.z + 0.5 - actor.z
    const distance = Math.hypot(dx, dz)
    if (distance <= travel) {
      placeActorOnCell(actor, next)
      actor.route.shift()
      travel -= Math.max(distance, 0.0001)
      continue
    }
    actor.x += (dx / distance) * travel
    actor.z += (dz / distance) * travel
    actor.facing = Math.atan2(dx, dz)
    travel = 0
  }
  actor.wanderMinutes = Math.max(0, actor.wanderMinutes - minutes)
  return true
}

export function bandActorShouldPerform(
  actor: BandActor,
  bookings: readonly Booking[],
  day: number,
  minute: number,
): boolean {
  return bookings.some(
    (booking) =>
      booking.bandId === actor.bandId &&
      booking.stageId === actor.stageId &&
      booking.day === day &&
      minute >= booking.start &&
      minute < booking.start + booking.duration,
  )
}

export function idleWanderReady(actor: BandActor): boolean {
  return (
    !actor.vehicleId &&
    actor.route.length === 0 &&
    actor.state === 'idle' &&
    actor.wanderMinutes <= 0
  )
}

export function nextWanderDelay(simTick: number, actorId: string): number {
  const seed = [...actorId].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return 2 + ((simTick + seed) % 5)
}

export { bandArriveMinute, bandLeaveMinute, isBandOnSiteMinute }
