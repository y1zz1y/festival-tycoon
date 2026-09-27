import { de } from '../i18n/marker'
import { STAFF_DEFINITIONS } from './staff'
import type { StaffMember } from './staff'
import type { GroundIncident } from './incidents'
import type { MedicalCell } from './medical'
import type { SealedWasteContainerInfo, WasteBinInfo, WasteDumpCell } from './waste'
import {
  parseDepositSealedContainerId,
  parseSealedContainerId,
  parseWasteDumpId,
  sealedContainerAllowsManualHaul,
  sealedContainerHasRoom,
  sealedContainerId,
  wasteDropGoals,
} from './waste'
import { SIMULATION_CONFIG } from './simulationConfig'
import { hashStringSeed, type RngSource } from './rng'
import { isInAnyZone, zoneCellRange } from './staffZones'
import { buildingFootprint, type StageDesign } from './stageDesign'
import { CARDINAL_OFFSETS } from './shopAccess'

type Cell = { x: number; z: number; elevation: number }
type Patient = {
  id: string
  state: string
  x: number
  y: number
  z: number
  cellX: number
  cellZ: number
  cellElevation: number
  route: Cell[]
  medicalCell: Cell | null
  medicalSlot: number | null
  thought: string
  nausea: number
  injuryVehicleId?: string | null
  rescueVehicleId?: string | null
}

type StaffBuildingRef = {
  id: string
  x: number
  z: number
  rotation: number
  kind?: string
  elevation?: number
  stageDesign?: StageDesign
  rideType?: string
}

type BuildingFootprintIndex = {
  footprintsTouching(fire: Cell): ReadonlyArray<readonly Cell[]>
}

type StaffContext = {
  staff: StaffMember[]
  visitors: Patient[]
  seatedPassengerIds?: ReadonlySet<string>
  incidents: GroundIncident[]
  medicalCells: MedicalCell[]
  wasteDumps: WasteDumpCell[]
  wasteBins: WasteBinInfo[]
  sealedContainers?: SealedWasteContainerInfo[]
  /** Built once per staff pass so fire approach can expand to a footprint. */
  buildings?: readonly StaffBuildingRef[]
  securityGates: Array<{ id: string; x: number; z: number; elevation: number }>
  findPath: (start: Cell, goals: Cell[], allowGround?: boolean) => Cell[] | null
  /** Where a step can go from here; without grass unless it is asked for. */
  pathNeighbors: (cell: Cell, allowGrass?: boolean) => Cell[]
  hasPath?: (cell: Cell) => boolean
  /** Whether a cell is part of the road network, so a patrol can leave it to the traffic. */
  isRoadAt?: (x: number, z: number) => boolean
  rng: RngSource
  reserveBed: (
    visitorId: string,
    preferredCell?: MedicalCell,
  ) => { cell: MedicalCell; slot: number } | null
  removeIncident: (id: string) => void
  depositWaste: (x: number, z: number, amount: number) => number
  emptyBin: (id: string, amount: number) => number
  fillBin?: (id: string, amount: number) => number
  fillSealedContainer?: (id: string, amount: number) => number
  emptySealedContainer?: (id: string, amount: number) => number
  abandonedCamps?: Array<{ id: string; x: number; z: number; elevation: number }>
  removeAbandonedCamp?: (id: string) => boolean
  /** What a cleaner's cart holds, bigger once the festival has paid for bigger ones. */
  cleanerCarry?: { capacity: number }
  /** How much faster than on foot the crew moves — 1 until the festival buys them wheels. */
  speedFactor?: number
  /** Authoritative sim tick; idle patrol/search cadence, never a wall clock. */
  simTick?: number
  /** Optional override for tests; default is `staff.jobDecisionsPerTick`. */
  takeDecision?: () => boolean
}
const carryCapacity = (context: StaffContext): number =>
  context.cleanerCarry?.capacity ?? SIMULATION_CONFIG.waste.cleanerMaxCarry
/**
 * A cleaner carries a full load away, not a half one: until the cart is full they
 * keep picking things up, and only a cart with no more work left to do is taken away
 * before it is full.
 */
const cartIsFull = (member: StaffMember, context: StaffContext): boolean =>
  member.carryingWaste >= carryCapacity(context)

/** Same 4-neighbour set sealed-haul already uses to stand beside a closed tile. */
function staffCardinalNeighbors(cell: Cell): Cell[] {
  return CARDINAL_OFFSETS.map(([dx, dz]) => ({
    x: cell.x + dx,
    z: cell.z + dz,
    elevation: cell.elevation,
  }))
}

function cellKey(cell: { x: number; z: number }): string {
  return `${cell.x}:${cell.z}`
}

function indexStaffBuildings(
  buildings: readonly StaffBuildingRef[] | undefined,
): BuildingFootprintIndex | undefined {
  if (!buildings?.length) return undefined
  const cellToIds = new Map<string, string[]>()
  const footprints = new Map<string, Cell[]>()
  for (const building of buildings) {
    const elevation = building.elevation ?? 0
    const cells = buildingFootprint(building).map((cell) => ({
      x: cell.x,
      z: cell.z,
      elevation,
    }))
    footprints.set(building.id, cells)
    for (const cell of cells) {
      const key = cellKey(cell)
      const list = cellToIds.get(key)
      if (list) list.push(building.id)
      else cellToIds.set(key, [building.id])
    }
  }
  return {
    footprintsTouching(fire: Cell) {
      const ids = new Set<string>()
      for (const key of [cellKey(fire), ...staffCardinalNeighbors(fire).map(cellKey)]) {
        for (const id of cellToIds.get(key) ?? []) ids.add(id)
      }
      return [...ids].map((id) => footprints.get(id)!).filter(Boolean)
    },
  }
}

function sameStaffTile(
  left: { x: number; z: number },
  right: { x: number; z: number },
): boolean {
  return left.x === right.x && left.z === right.z
}

function staffManhattan(
  left: { x: number; z: number },
  right: { x: number; z: number },
): number {
  return Math.abs(left.x - right.x) + Math.abs(left.z - right.z)
}

/**
 * Fire tile plus stand-off cells: 4-neighbours, or the whole footprint if it
 * touches a building. Outdoor and stage-forecourt fires use the same set —
 * the fire tile need not be a path; a cardinal neighbour is enough.
 */
export function fireApproachGoals(
  fire: Cell,
  built?: BuildingFootprintIndex,
): Cell[] {
  const goals = [fire, ...staffCardinalNeighbors(fire)]
  const extra = built?.footprintsTouching(fire)
  if (!extra?.length) return goals
  const seen = new Set(goals.map((cell) => `${cell.x}:${cell.z}:${cell.elevation}`))
  for (const footprint of extra) {
    for (const cell of footprint) {
      for (const neighbor of staffCardinalNeighbors({
        x: cell.x,
        z: cell.z,
        elevation: fire.elevation,
      })) {
        const key = `${neighbor.x}:${neighbor.z}:${neighbor.elevation}`
        if (seen.has(key)) continue
        seen.add(key)
        goals.push(neighbor)
      }
    }
  }
  return goals
}

/** True when the crew already stands on the fire tile or a stand-off neighbour. */
export function isOnFireApproach(
  from: { x: number; z: number },
  fire: Cell,
  built?: BuildingFootprintIndex,
): boolean {
  return fireApproachGoals(fire, built).some((goal) => sameStaffTile(from, goal))
}

type StaffPassIndex = {
  fires: GroundIncident[]
  waste: GroundIncident[]
  bins: WasteBinInfo[]
  camps: Array<{ id: string; x: number; z: number; elevation: number }>
  sealedHauls: SealedWasteContainerInfo[]
  hasFire: boolean
  hasCleanerWork: boolean
  hasMedicWork: boolean
}

function zoneCenterCell(key: string, elevation: number): Cell {
  const area = zoneCellRange(key)
  return {
    x: Math.floor((area.minX + area.maxX) / 2),
    z: Math.floor((area.minZ + area.maxZ) / 2),
    elevation,
  }
}

function inMemberZones<T>(
  items: readonly T[],
  zones: string[] | undefined,
  at: (item: T) => { x: number; z: number },
): T[] {
  if (!zones?.length) return [...items]
  return items.filter((item) => isInAnyZone(zones, at(item).x, at(item).z))
}

export class StaffSimulation {
  private readonly nextIdlePatrolTick = new Map<string, number>()
  private readonly nextJobSearchTick = new Map<string, number>()
  private readonly assignedThisPass = new Set<string>()
  private takeDecision: () => boolean = () => true

  update(context: StaffContext, minutes: number): void {
    this.pruneRuntimeMaps(context.staff)
    this.assignedThisPass.clear()
    const takeDecision = this.createTickBudget(context)
    this.takeDecision = takeDecision
    const index = this.buildPassIndex(context)
    const built = index.hasFire ? indexStaffBuildings(context.buildings) : undefined
    this.assignSecurity(context)
    const claimed = new Set(
      context.staff.map((member) => member.targetId).filter((id): id is string => Boolean(id)),
    )
    context.staff.forEach((member) => {
      const incident = context.incidents.find(
        (candidate) => candidate.id === member.targetId,
      )
      if (incident) claimed.add(this.incidentFieldKey(incident))
    })
    if (index.hasMedicWork) this.assignNearestFreeMedics(context, claimed, takeDecision)
    const seekRank = (role: StaffMember['role']) =>
      role === 'firefighter' ? 0 : role === 'medic' ? 1 : role === 'cleaner' ? 2 : 3
    context.staff
      .map((member, order) => ({ member, order }))
      .sort((left, right) => seekRank(left.member.role) - seekRank(right.member.role) || left.order - right.order)
      .forEach(({ member }) => {
        this.advanceMember(member, context, minutes, claimed, built, index, takeDecision)
      })
  }

  private createTickBudget(context: StaffContext): () => boolean {
    if (context.takeDecision) return context.takeDecision
    let remaining = SIMULATION_CONFIG.staff.jobDecisionsPerTick
    return () => {
      if (remaining <= 0) return false
      remaining -= 1
      return true
    }
  }

  private pruneRuntimeMaps(staff: readonly StaffMember[]): void {
    const live = new Set(staff.map((member) => member.id))
    for (const id of this.nextIdlePatrolTick.keys()) {
      if (!live.has(id)) this.nextIdlePatrolTick.delete(id)
    }
    for (const id of this.nextJobSearchTick.keys()) {
      if (!live.has(id)) this.nextJobSearchTick.delete(id)
    }
  }

  private buildPassIndex(context: StaffContext): StaffPassIndex {
    const idleEmptyFill = SIMULATION_CONFIG.waste.cleanerIdleEmptyFill
    const fires = context.incidents.filter((incident) => incident.kind === 'fire')
    const waste = context.incidents.filter(
      (incident) => incident.kind === 'litter' || incident.kind === 'vomit',
    )
    const bins = context.wasteBins.filter((bin) => bin.stored >= idleEmptyFill)
    const camps = context.abandonedCamps ?? []
    const sealedHauls = (context.sealedContainers ?? []).filter((container) =>
      sealedContainerAllowsManualHaul(container),
    )
    const claimed = new Set(
      context.staff.map((member) => member.targetId).filter((id): id is string => Boolean(id)),
    )
    const patients = context.visitors.filter((visitor) =>
      this.visitorNeedsMedic(visitor, claimed, context.seatedPassengerIds),
    )
    return {
      fires,
      waste,
      bins,
      camps,
      sealedHauls,
      hasFire: fires.length > 0,
      hasCleanerWork:
        waste.length > 0 || bins.length > 0 || camps.length > 0 || sealedHauls.length > 0,
      hasMedicWork: patients.length > 0,
    }
  }

  private advanceMember(
    member: StaffMember,
    context: StaffContext,
    minutes: number,
    claimed: Set<string>,
    built: BuildingFootprintIndex | undefined,
    index: StaffPassIndex,
    takeDecision: () => boolean,
  ): void {
    if (member.role === 'security' && member.assignedBuildingId) return
    if (member.state === 'working' && !member.targetId) {
      member.state = member.carryingWaste > 0 ? 'carrying' : 'patrolling'
      member.workMinutes = 0
    }
    if (member.state === 'working') {
      member.workMinutes -= minutes
      if (member.workMinutes <= 0 && member.targetId) {
        this.finishWork(member, context)
      }
      return
    }
    if (
      member.role === 'cleaner' &&
      member.state === 'carrying' &&
      !cartIsFull(member, context) &&
      index.waste.length > 0
    ) {
      member.targetId = null
      member.route = []
      member.state = 'patrolling'
    }
    if (member.route.length > 0) {
      this.move(member, minutes * this.staffSpeed(member) * (context.speedFactor ?? 1))
      if (member.role === 'medic' && member.state === 'carrying') {
        const patient = context.visitors.find((visitor) => visitor.id === member.targetId)
        if (patient) {
          patient.x = member.x
          patient.y = member.y + 0.12
          patient.z = member.z
          patient.cellX = member.cellX
          patient.cellZ = member.cellZ
          patient.cellElevation = member.cellElevation
        }
      }
      if (member.route.length > 0) return
    }
    if (member.targetId) {
      if (this.assignedThisPass.has(member.id)) return
      this.finishArrival(member, context)
      return
    }
    if (member.role === 'cleaner' && cartIsFull(member, context)) {
      if (this.sendCleanerToDump(member, context, takeDecision)) return
      member.state = 'carrying'
      this.holdOrPatrol(member, context, takeDecision, true)
      return
    }
    if (!this.roleHasOpenWork(member, index)) {
      if (
        member.role === 'cleaner' &&
        member.carryingWaste > 0 &&
        index.waste.length === 0 &&
        this.sendCleanerToDump(member, context, takeDecision)
      ) {
        return
      }
      this.holdOrPatrol(member, context, takeDecision, false)
      return
    }
    const tick = context.simTick ?? 0
    const retryAt = this.nextJobSearchTick.get(member.id)
    if (retryAt !== undefined && tick < retryAt) {
      this.holdOrPatrol(member, context, takeDecision, false)
      return
    }
    const workContext = this.sliceWorkContext(member, context)
    if (!this.sliceHasWork(member, workContext)) {
      this.holdOrPatrol(member, context, takeDecision, false)
      return
    }
    const assigned = this.tryAssignJob(member, workContext, context, claimed, built, takeDecision)
    if (assigned === 'assigned') return
    if (assigned === 'blocked') {
      this.nextJobSearchTick.set(member.id, tick + SIMULATION_CONFIG.staff.idleSearchRetryTicks)
    }
    if (
      member.role === 'cleaner' &&
      member.carryingWaste > 0 &&
      workContext.incidents.every(
        (incident) => incident.kind !== 'litter' && incident.kind !== 'vomit',
      ) &&
      this.sendCleanerToDump(member, context, takeDecision)
    ) {
      return
    }
    this.holdOrPatrol(member, context, takeDecision, true)
  }

  private roleHasOpenWork(member: StaffMember, index: StaffPassIndex): boolean {
    if (member.role === 'firefighter') return index.hasFire
    if (member.role === 'cleaner') return index.hasCleanerWork
    if (member.role === 'medic') return index.hasMedicWork
    return false
  }

  private sliceHasWork(member: StaffMember, workContext: StaffContext): boolean {
    if (member.role === 'firefighter') {
      return workContext.incidents.some((incident) => incident.kind === 'fire')
    }
    if (member.role === 'medic') {
      return workContext.visitors.some((visitor) =>
        this.visitorNeedsMedic(visitor, new Set(), workContext.seatedPassengerIds),
      )
    }
    if (member.role !== 'cleaner') return false
    const idleEmptyFill = SIMULATION_CONFIG.waste.cleanerIdleEmptyFill
    return (
      workContext.incidents.some(
        (incident) => incident.kind === 'litter' || incident.kind === 'vomit',
      ) ||
      workContext.wasteBins.some((bin) => bin.stored >= idleEmptyFill) ||
      (workContext.abandonedCamps?.length ?? 0) > 0 ||
      (workContext.sealedContainers ?? []).some((container) =>
        sealedContainerAllowsManualHaul(container),
      )
    )
  }

  private sliceWorkContext(member: StaffMember, context: StaffContext): StaffContext {
    const zones = member.workZones
    if (!zones?.length) return context
    return {
      ...context,
      visitors: inMemberZones(context.visitors, zones, (visitor) => ({
        x: visitor.cellX,
        z: visitor.cellZ,
      })),
      incidents: inMemberZones(context.incidents, zones, (incident) => incident),
      wasteBins: inMemberZones(context.wasteBins, zones, (bin) => bin),
      sealedContainers: inMemberZones(context.sealedContainers ?? [], zones, (container) => container),
      abandonedCamps: inMemberZones(context.abandonedCamps ?? [], zones, (camp) => camp),
    }
  }

  private tryAssignJob(
    member: StaffMember,
    workContext: StaffContext,
    context: StaffContext,
    claimed: Set<string>,
    built: BuildingFootprintIndex | undefined,
    takeDecision: () => boolean,
  ): 'assigned' | 'none' | 'blocked' | 'budget' {
    const excluded = new Set(claimed)
    const maxAttempts = SIMULATION_CONFIG.staff.maxJobPathAttempts
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const target = this.findTarget(member, workContext, excluded)
      if (!target) return attempt === 0 ? 'none' : 'blocked'
      const arrived = this.alreadyAtStaffTarget(member, target, built)
      if (!arrived && !takeDecision()) return 'budget'
      const route = arrived ? [] : this.routeToStaffTarget(member, target, context, built)
      if (!route) {
        excluded.add(target.id)
        continue
      }
      member.targetId = target.id
      member.state = 'responding'
      member.route = route
      this.assignedThisPass.add(member.id)
      claimed.add(target.id)
      if (member.role === 'cleaner' || member.role === 'firefighter') {
        claimed.add(
          `${target.kind ?? (member.role === 'cleaner' ? 'vomit' : 'fire')}:${target.cell.x}:${target.cell.z}:${target.cell.elevation}`,
        )
      }
      this.nextJobSearchTick.delete(member.id)
      return 'assigned'
    }
    return 'blocked'
  }

  private assignSecurity(context: StaffContext): void {
    const security = context.staff.filter((member) => member.role === 'security')
    const assigned = new Set<string>()
    security.forEach((member) => {
      const zones = member.workZones
      const gate = context.securityGates.find(g => !assigned.has(g.id) && isInAnyZone(zones, g.x, g.z))
      if (gate) assigned.add(gate.id)
      member.assignedBuildingId = gate?.id ?? null
      if (!gate) {
        if (member.state === 'stationed') member.state = 'patrolling'
        return
      }
      member.state = 'stationed'
      member.route = []
      member.targetId = null
      member.x = gate.x + 0.5
      member.y = gate.elevation
      member.z = gate.z + 0.5
      member.cellX = gate.x
      member.cellZ = gate.z
      member.cellElevation = gate.elevation
    })
  }

  private assignNearestFreeMedics(
    context: StaffContext,
    claimed: Set<string>,
    takeDecision: () => boolean = () => true,
  ): void {
    const medics = context.staff.filter((member) => this.medicIsFree(member))
    if (medics.length === 0) return
    const patients = context.visitors.filter((visitor) =>
      this.visitorNeedsMedic(visitor, claimed, context.seatedPassengerIds),
    )
    if (patients.length === 0) return
    const pairs: Array<{ medic: StaffMember; patient: Patient; distance: number }> = []
    for (const medic of medics) {
      for (const patient of patients) {
        if (!isInAnyZone(medic.workZones, patient.cellX, patient.cellZ)) continue
        pairs.push({
          medic,
          patient,
          distance: this.patientDistance(medic, patient),
        })
      }
    }
    pairs.sort(
      (left, right) =>
        left.distance - right.distance ||
        left.medic.id.localeCompare(right.medic.id) ||
        left.patient.id.localeCompare(right.patient.id),
    )
    const usedMedics = new Set<string>()
    const usedPatients = new Set<string>()
    for (const pair of pairs) {
      if (usedMedics.has(pair.medic.id) || usedPatients.has(pair.patient.id)) continue
      const here = this.staffCell(pair.medic)
      const patientCell = {
        x: pair.patient.cellX,
        z: pair.patient.cellZ,
        elevation: pair.patient.cellElevation,
      }
      const beside = staffManhattan(here, patientCell) <= 1
      if (!beside && !takeDecision()) break
      const route = beside
        ? []
        : context.findPath(here, [patientCell], true)
      if (!route) continue
      pair.medic.targetId = pair.patient.id
      pair.medic.state = 'responding'
      pair.medic.route = route
      this.assignedThisPass.add(pair.medic.id)
      claimed.add(pair.patient.id)
      usedMedics.add(pair.medic.id)
      usedPatients.add(pair.patient.id)
    }
  }

  private medicIsFree(member: StaffMember): boolean {
    return (
      member.role === 'medic' &&
      !member.targetId &&
      member.state !== 'carrying' &&
      member.state !== 'working' &&
      member.state !== 'responding'
    )
  }

  private visitorNeedsMedic(
    visitor: Patient,
    claimed: Set<string>,
    seated?: ReadonlySet<string>,
  ): boolean {
    if (
      seated?.has(visitor.id) ||
      visitor.state === 'vehicle-arrival' ||
      visitor.state === 'bus-riding'
    ) {
      return false
    }
    return (
      (visitor.state === 'sleeping' ||
        visitor.state === 'injured' ||
        visitor.state === 'vomiting' ||
        visitor.nausea >= SIMULATION_CONFIG.staff.medicNauseaThreshold) &&
      !visitor.rescueVehicleId &&
      !visitor.medicalCell &&
      !claimed.has(visitor.id)
    )
  }

  private nearestMedicPatient(
    member: StaffMember,
    context: StaffContext,
    claimed: Set<string>,
  ): Patient | null {
    return context.visitors
      .filter((visitor) =>
        this.visitorNeedsMedic(visitor, claimed, context.seatedPassengerIds),
      )
      .sort(
        (left, right) =>
          this.patientDistance(member, left) - this.patientDistance(member, right) ||
          left.id.localeCompare(right.id),
      )[0] ?? null
  }

  private patientDistance(member: StaffMember, patient: Patient): number {
    return Math.abs(patient.cellX - member.cellX) + Math.abs(patient.cellZ - member.cellZ)
  }

  private findTarget(
    member: StaffMember,
    context: StaffContext,
    claimed: Set<string>,
  ): { id: string; cell: Cell; allowMedical?: boolean; kind?: string } | null {
    if (member.role === 'medic') {
      const patient = this.nearestMedicPatient(member, context, claimed)
      return patient
        ? {
            id: patient.id,
            cell: { x: patient.cellX, z: patient.cellZ, elevation: patient.cellElevation },
            allowMedical: true,
            kind: 'patient',
          }
        : null
    }
    if (member.role === 'cleaner') {
      if (member.carryingWaste >= carryCapacity(context)) {
        return null
      }
      const binCapacity = SIMULATION_CONFIG.waste.binCapacity
      const idleEmptyFill = SIMULATION_CONFIG.waste.cleanerIdleEmptyFill
      const binDistance = (bin: { x: number; z: number }) =>
        Math.abs(bin.x - member.cellX) + Math.abs(bin.z - member.cellZ)
      // Priority: full/overflowing bins, then litter/vomit/abandoned camps, then
      // idle emptying of bins at/above cleanerIdleEmptyFill. Sweepers never empty bins.
      const bin = context.wasteBins
        .filter(
          (candidate) =>
            candidate.stored >= idleEmptyFill &&
            !claimed.has(candidate.id) &&
            member.carryingWaste + candidate.stored <=
              carryCapacity(context),
        )
        .sort((left, right) => {
          const leftFull = left.stored >= binCapacity
          const rightFull = right.stored >= binCapacity
          if (leftFull !== rightFull) return leftFull ? -1 : 1
          return binDistance(left) - binDistance(right) || right.stored - left.stored
        })[0]
      const incident = context.incidents
        .filter(
          (candidate) =>
            (candidate.kind === 'litter' || candidate.kind === 'vomit') &&
            !claimed.has(candidate.id) &&
            !claimed.has(this.incidentFieldKey(candidate)),
        )
        .sort(
          (left, right) =>
            this.incidentDistance(left, member) - this.incidentDistance(right, member),
        )[0]
      const leftover = (context.abandonedCamps ?? [])
        .filter((candidate) => !claimed.has(candidate.id))
        .sort(
          (left, right) =>
            Math.abs(left.x - member.cellX) + Math.abs(left.z - member.cellZ) -
            (Math.abs(right.x - member.cellX) + Math.abs(right.z - member.cellZ)),
        )[0]
      const jobs = [
        incident
          ? {
              id: incident.id,
              distance: this.incidentDistance(incident, member),
              cell: { x: incident.x, z: incident.z, elevation: incident.elevation },
              kind: incident.kind,
              priority: 1,
            }
          : null,
        leftover
          ? {
              id: leftover.id,
              distance:
                Math.abs(leftover.x - member.cellX) + Math.abs(leftover.z - member.cellZ),
              cell: { x: leftover.x, z: leftover.z, elevation: leftover.elevation },
              kind: 'camp',
              priority: 1,
            }
          : null,
      ]
        .filter((job): job is NonNullable<typeof job> => Boolean(job))
        .sort((left, right) => left.distance - right.distance)
      const job = jobs[0]
      const localTiles = SIMULATION_CONFIG.staff.cleanerLocalWorkTiles
      const longTravel = SIMULATION_CONFIG.staff.cleanerLongTravelTiles
      const pick = (
        candidate: { id: string; cell: { x: number; z: number; elevation: number }; kind: string } | null,
      ) =>
        candidate
          ? { id: candidate.id, cell: candidate.cell, allowMedical: true, kind: candidate.kind }
          : null
      const binJob = bin
        ? {
            id: bin.id,
            cell: { x: bin.x, z: bin.z, elevation: bin.elevation },
            kind: 'bin',
            distance: binDistance(bin),
            priority: bin.stored >= binCapacity ? 0 : 2,
          }
        : null
      const ranked = [binJob, job]
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((left, right) => left.priority - right.priority || left.distance - right.distance)
      const best = ranked[0]
      if (best) {
        const nearby = ranked.find((entry) => entry.distance <= localTiles)
        if (best.distance > longTravel && nearby && nearby.id !== best.id) {
          return pick(nearby)
        }
        return pick(best)
      }
      // Lowest priority after bags, litter/vomit/camps and idle bin emptying:
      // haul sealed containers that are not currently being emptied by a truck.
      const haul = this.findIdleSealedHaul(member, context, claimed)
      return haul
        ? {
            id: sealedContainerId(haul.id),
            cell: { x: haul.x, z: haul.z, elevation: haul.elevation },
            allowMedical: true,
            kind: 'sealed-haul',
          }
        : null
    }
    if (member.role !== 'firefighter') return null
    const incident = context.incidents
      .filter(
        (candidate) =>
          candidate.kind === 'fire' &&
          !claimed.has(candidate.id) &&
          !claimed.has(this.incidentFieldKey(candidate)),
      )
      .sort(
        (left, right) =>
          this.incidentDistance(left, member) - this.incidentDistance(right, member),
      )[0]
    return incident
      ? {
          id: incident.id,
          cell: { x: incident.x, z: incident.z, elevation: incident.elevation },
          allowMedical: true,
          kind: 'fire',
        }
      : null
  }

  private finishArrival(member: StaffMember, context: StaffContext): void {
    if (member.role === 'medic') {
      const patient = context.visitors.find((visitor) => visitor.id === member.targetId)
      if (!patient) return this.reset(member)
      if (member.state === 'responding') {
        const freeBeds = context.medicalCells.filter((cell) =>
          cell.occupants.some((occupant) => occupant === null),
        )
        if (freeBeds.length === 0) return this.reset(member)
        const route = context.findPath(this.staffCell(member), freeBeds, true)
        if (!route) return this.reset(member)
        const last = route.at(-1)
        const nearest = {
          cell:
            (last &&
              freeBeds.find(
                (cell) =>
                  cell.x === last.x &&
                  cell.z === last.z &&
                  Math.abs(cell.elevation - last.elevation) < 0.01,
              )) ||
            freeBeds[0]!,
          route,
        }
        const bed = context.reserveBed(patient.id, nearest.cell)
        if (!bed) return this.reset(member)
        member.medicalCell = bed.cell
        member.medicalSlot = bed.slot
        member.state = 'carrying'
        patient.state = 'medical-transport'
        patient.injuryVehicleId = null
        patient.route = []
        patient.thought = de('Ein Sanitäter bringt mich zur Krankenstation.')
        member.route = nearest.route
        return
      }
      if (member.state === 'carrying' && member.medicalCell && member.medicalSlot != null) {
        patient.state = 'medical'
        patient.medicalCell = { ...member.medicalCell }
        patient.medicalSlot = member.medicalSlot
        patient.x = member.medicalCell.x + 0.5
        patient.y = member.medicalCell.elevation
        patient.z = member.medicalCell.z + 0.5
        patient.thought = de('Hier werde ich medizinisch versorgt.')
        return this.reset(member)
      }
    }
    if (member.role === 'cleaner' && member.targetId) {
      if (member.targetId.startsWith('deposit-bin:')) {
        const id = member.targetId.slice('deposit-bin:'.length)
        const deposited = context.fillBin?.(id, member.carryingWaste) ?? 0
        member.carryingWaste -= deposited
        member.targetId = null
        member.state = member.carryingWaste > 0 ? 'carrying' : 'patrolling'
        return
      }
      const depositSealed = parseDepositSealedContainerId(member.targetId)
      if (depositSealed) {
        const deposited =
          context.fillSealedContainer?.(depositSealed, member.carryingWaste) ?? 0
        member.carryingWaste -= deposited
        member.wasteFromSealedContainer = false
        if (member.carryingWaste <= 0) {
          this.reset(member)
          return
        }
        member.targetId = null
        member.state = 'carrying'
        return
      }
      const dump = parseWasteDumpId(member.targetId)
      if (dump) {
        const deposited = context.depositWaste(
          dump.x,
          dump.z,
          member.carryingWaste,
        )
        member.carryingWaste = Math.max(0, member.carryingWaste - deposited)
        if (member.carryingWaste <= 0) {
          this.reset(member)
          return
        }
        member.targetId = null
        member.state = 'carrying'
        return
      }
      const haulSealed = parseSealedContainerId(member.targetId)
      if (haulSealed) {
        member.state = 'working'
        member.workMinutes = SIMULATION_CONFIG.staff.cleanerBinWorkMinutes
        return
      }
      const bin = context.wasteBins.find((candidate) => candidate.id === member.targetId)
      if (bin) {
        member.state = 'working'
        member.workMinutes = SIMULATION_CONFIG.staff.cleanerBinWorkMinutes
        return
      }
      const leftover = this.abandonedCampId(member.targetId)
        ? context.abandonedCamps?.find((candidate) => candidate.id === member.targetId)
        : undefined
      const incident = context.incidents.find(
        (candidate) => candidate.id === member.targetId,
      )
      member.state = 'working'
      member.workMinutes =
        leftover || incident?.kind === 'litter'
          ? SIMULATION_CONFIG.staff.cleanerLitterWorkMinutes
          : SIMULATION_CONFIG.staff.cleanerWorkMinutes
      return
    }
    member.state = 'working'
    member.workMinutes =
      member.role === 'firefighter'
        ? SIMULATION_CONFIG.staff.firefighterWorkMinutes
        : SIMULATION_CONFIG.staff.cleanerWorkMinutes
  }

  private finishWork(member: StaffMember, context: StaffContext): void {
    const incident = context.incidents.find(
      (candidate) => candidate.id === member.targetId,
    )
    const haulSealed = member.targetId
      ? parseSealedContainerId(member.targetId)
      : null
    if (member.role === 'cleaner' && haulSealed) {
      const room = Math.max(
        0,
        carryCapacity(context) - member.carryingWaste,
      )
      const emptied = context.emptySealedContainer?.(haulSealed, room) ?? 0
      member.carryingWaste += emptied
      member.wasteFromBin = true
      member.wasteFromSealedContainer = true
      member.targetId = null
      if (member.carryingWaste > 0) return this.afterCleanerPickup(member, context)
      this.reset(member)
      return
    }
    if (
      member.role === 'cleaner' &&
      member.targetId &&
      context.wasteBins.some((candidate) => candidate.id === member.targetId)
    ) {
      const targetBin = context.wasteBins.find(
        (candidate) => candidate.id === member.targetId,
      )
      const room = Math.max(0, carryCapacity(context) - member.carryingWaste)
      const emptied = context.emptyBin(
        member.targetId,
        Math.min(room, targetBin?.stored ?? SIMULATION_CONFIG.waste.binCapacity),
      )
      member.carryingWaste += emptied
      member.wasteFromBin = true
      member.targetId = null
      if (member.carryingWaste > 0) return this.afterCleanerPickup(member, context)
      this.reset(member)
      return
    }
    if (member.role === 'cleaner' && this.abandonedCampId(member.targetId)) {
      const leftoverId = this.abandonedCampId(member.targetId)
      const room = Math.max(
        0,
        carryCapacity(context) - member.carryingWaste,
      )
      if (leftoverId && room > 0 && context.removeAbandonedCamp?.(leftoverId)) {
        member.carryingWaste += 1
        member.wasteFromBin = false
      }
      return this.afterCleanerPickup(member, context)
    }
    if (member.role === 'cleaner' && incident?.kind === 'litter') {
      const room = Math.max(
        0,
        carryCapacity(context) - member.carryingWaste,
      )
      const taken = Math.min(incident.severity, room)
      member.carryingWaste += taken
      member.wasteFromBin = false
      incident.severity -= taken
      if (incident.severity <= 0) {
        context.removeIncident(incident.id)
      }
      return this.afterCleanerPickup(member, context)
    }
    if (member.targetId) context.removeIncident(member.targetId)
    member.targetId = null
    member.state = 'patrolling'
  }

  private abandonedCampId(targetId: string | null): string | null {
    if (!targetId?.startsWith('camp:')) return null
    return targetId.slice('camp:'.length)
  }

  private afterCleanerPickup(member: StaffMember, context: StaffContext): void {
    member.targetId = null
    if (member.carryingWaste <= 0) {
      this.reset(member)
      return
    }
    const binsHaveRoom = context.wasteBins.some(
      (bin) => bin.stored < SIMULATION_CONFIG.waste.binCapacity,
    )
    if (cartIsFull(member, context) && binsHaveRoom && !member.wasteFromBin && this.sendCleanerToDump(member, context, this.takeDecision)) {
      return
    }
    if (!cartIsFull(member, context)) {
      const claimed = new Set(
        context.staff.map((worker) => worker.targetId).filter((id): id is string => Boolean(id)),
      )
      if (this.tryAssignJob(member, context, context, claimed, undefined, this.takeDecision) === 'assigned') return
      if (
        context.incidents.some(
          (incident) => incident.kind === 'litter' || incident.kind === 'vomit',
        )
      ) {
        this.holdOrPatrol(member, context, this.takeDecision, true)
        return
      }
    }
    if (!this.sendCleanerToDump(member, context, this.takeDecision)) {
      member.state = 'carrying'
    }
  }

  private sendCleanerToDump(
    member: StaffMember,
    context: StaffContext,
    takeDecision: () => boolean = () => true,
  ): boolean {
    if (!takeDecision()) return false
    if (!member.wasteFromBin && !member.wasteFromSealedContainer && context.fillBin) {
      const bins = context.wasteBins.filter(bin => bin.stored < SIMULATION_CONFIG.waste.binCapacity)
      if (bins.length > 0) {
        const route = context.findPath(
          this.staffCell(member),
          bins.map((bin) => ({ x: bin.x, z: bin.z, elevation: bin.elevation })),
          true,
        )
        if (route?.length) {
          const last = route.at(-1)!
          const bin =
            bins.find((candidate) => candidate.x === last.x && candidate.z === last.z) ??
            bins[0]!
          member.targetId = `deposit-bin:${bin.id}`
          member.route = route
          member.state = 'carrying'
          return true
        }
      }
    }
    const containers = member.wasteFromSealedContainer
      ? []
      : (context.sealedContainers ?? []).filter((container) =>
          sealedContainerHasRoom(container),
        )
    const goals = wasteDropGoals(context.wasteDumps, containers)
    if (goals.length === 0) return false
    const route = context.findPath(
      this.staffCell(member),
      goals.map((goal) => ({ x: goal.x, z: goal.z, elevation: goal.elevation })),
      true,
    )
    if (!route?.length) return false
    const last = route.at(-1)!
    const dest =
      goals.find((goal) => goal.x === last.x && goal.z === last.z) ??
      this.nearestDropGoal(this.staffCell(member), goals)
    if (!dest) return false
    member.targetId = dest.id
    member.state = 'carrying'
    member.route = route
    return true
  }

  private nearestDropGoal(
    from: { x: number; z: number },
    goals: ReturnType<typeof wasteDropGoals>,
  ) {
    return (
      goals
        .slice()
        .sort(
          (left, right) =>
            Math.abs(left.x - from.x) +
            Math.abs(left.z - from.z) -
            (Math.abs(right.x - from.x) + Math.abs(right.z - from.z)),
        )[0] ?? null
    )
  }

  private findIdleSealedHaul(
    member: StaffMember,
    context: StaffContext,
    claimed: Set<string>,
  ): SealedWasteContainerInfo | null {
    if (member.carryingWaste >= carryCapacity(context)) return null
    const haulDistance = (container: SealedWasteContainerInfo) =>
      Math.abs(container.x - member.cellX) + Math.abs(container.z - member.cellZ)
    return (
      (context.sealedContainers ?? [])
        .filter(
          (container) =>
            sealedContainerAllowsManualHaul(container) &&
            !claimed.has(sealedContainerId(container.id)) &&
            !claimed.has(container.id),
        )
        .sort((left, right) => haulDistance(left) - haulDistance(right) || right.stored - left.stored)[0] ??
      null
    )
  }

  private holdOrPatrol(
    member: StaffMember,
    context: StaffContext,
    _takeDecision: () => boolean,
    stepNow: boolean,
  ): void {
    if (member.route.length > 0) return
    const zones = member.workZones
    const here = this.staffCell(member)
    const tick = context.simTick ?? 0
    if (zones?.length && !isInAnyZone(zones, here.x, here.z)) {
      const next = this.stepTowardZone(member, context)
      if (next) member.route = [next]
      this.markIdle(member)
      return
    }
    if (!stepNow) {
      const due = this.nextIdlePatrolTick.get(member.id)
      if (due === undefined) {
        this.nextIdlePatrolTick.set(
          member.id,
          tick + 1 + (hashStringSeed(member.id) % SIMULATION_CONFIG.staff.idlePatrolTicks),
        )
        this.markIdle(member)
        return
      }
      if (tick < due) {
        this.markIdle(member)
        return
      }
    }
    this.nextIdlePatrolTick.set(member.id, tick + SIMULATION_CONFIG.staff.idlePatrolTicks)
    this.stepLocalPatrol(member, context)
  }

  private markIdle(member: StaffMember): void {
    if (member.role !== 'cleaner' || member.carryingWaste <= 0) {
      member.state = 'patrolling'
    }
  }

  private stepTowardZone(member: StaffMember, context: StaffContext): Cell | undefined {
    const zones = member.workZones
    if (!zones?.length) return undefined
    const here = this.staffCell(member)
    const anchors = zones.map((key) => zoneCenterCell(key, here.elevation))
    const distance = (cell: Cell) =>
      Math.min(...anchors.map((anchor) => Math.abs(anchor.x - cell.x) + Math.abs(anchor.z - cell.z)))
    const hereDistance = distance(here)
    const closer = (cell: Cell) => distance(cell) < hereDistance
    let candidates = context.pathNeighbors(here, false).filter(closer)
    const onPath = context.hasPath?.(here) ?? false
    if (onPath && context.hasPath) {
      candidates = candidates.filter((cell) => context.hasPath!(cell))
    } else if (context.isRoadAt) {
      const offRoad = candidates.filter((cell) => !context.isRoadAt!(cell.x, cell.z))
      if (offRoad.length) candidates = offRoad
    }
    if (!candidates.length && !onPath) {
      candidates = context.pathNeighbors(here, true).filter(closer)
    }
    return context.rng.pick(candidates)
  }

  private stepLocalPatrol(member: StaffMember, context: StaffContext): void {
    const zones = member.workZones
    const here = this.staffCell(member)
    // On patrol the crew keeps to paths and the areas laid out for people. Only someone
    // set down on open grass, with no path next to them, may cross grass to reach one.
    let neighbors = context.pathNeighbors(here, false).filter((cell) => isInAnyZone(zones, cell.x, cell.z))
    const onPath = context.hasPath?.(here) ?? false
    if (onPath && context.hasPath) neighbors = neighbors.filter((cell) => context.hasPath!(cell))
    else if (context.isRoadAt) {
      const offRoad = neighbors.filter((cell) => !context.isRoadAt!(cell.x, cell.z))
      if (offRoad.length) neighbors = offRoad
    }
    if (!neighbors.length && !onPath) {
      neighbors = context.pathNeighbors(here, true).filter((cell) => isInAnyZone(zones, cell.x, cell.z))
    }
    const next = context.rng.pick(neighbors)
    if (next) member.route = [next]
    this.markIdle(member)
  }

  private staffSpeed(member: StaffMember): number {
    const base = STAFF_DEFINITIONS[member.role].speed
    if (member.role === 'cleaner' && member.carryingWaste > 0) {
      return base * SIMULATION_CONFIG.waste.cleanerCarrySpeedMultiplier
    }
    return base
  }

  private incidentDistance(incident: GroundIncident, member: StaffMember): number {
    return (
      Math.abs(incident.x - member.cellX) + Math.abs(incident.z - member.cellZ)
    )
  }

  private move(member: StaffMember, distance: number): void {
    while (distance > 0 && member.route.length > 0) {
      const next = member.route[0]!
      const targetX = next.x + 0.5
      const targetZ = next.z + 0.5
      const dx = targetX - member.x
      const dz = targetZ - member.z
      const remaining = Math.hypot(dx, dz)
      member.facing = Math.atan2(dx, dz)
      if (remaining <= distance) {
        member.x = targetX
        member.y = next.elevation
        member.z = targetZ
        member.cellX = next.x
        member.cellZ = next.z
        member.cellElevation = next.elevation
        member.route.shift()
        distance -= remaining
      } else {
        member.x += (dx / remaining) * distance
        member.z += (dz / remaining) * distance
        member.y += (next.elevation - member.y) * (distance / remaining)
        distance = 0
      }
    }
  }

  private staffCell(member: StaffMember): Cell {
    return { x: member.cellX, z: member.cellZ, elevation: member.cellElevation }
  }

  private alreadyAtStaffTarget(
    member: StaffMember,
    target: { cell: Cell; kind?: string },
    built?: BuildingFootprintIndex,
  ): boolean {
    const start = this.staffCell(member)
    if (target.kind === 'fire') return isOnFireApproach(start, target.cell, built)
    if (target.kind === 'patient' || member.role === 'medic') {
      return staffManhattan(start, target.cell) <= 1
    }
    return sameStaffTile(start, target.cell)
  }

  private routeToStaffTarget(
    member: StaffMember,
    target: { cell: Cell; allowMedical?: boolean; kind?: string },
    context: StaffContext,
    built?: BuildingFootprintIndex,
  ): Cell[] | null {
    const start = this.staffCell(member)
    if (this.alreadyAtStaffTarget(member, target, built)) return []
    if (target.kind === 'fire') {
      return context.findPath(
        start,
        fireApproachGoals(target.cell, built),
        target.allowMedical,
      )
    }
    const direct = context.findPath(start, [target.cell], target.allowMedical)
    if (direct) return direct
    // Sealed containers can sit off-path; if the box tile itself is closed,
    // stand on a neighbour instead of dropping the haul (do not change occupancy).
    if (target.kind !== 'sealed-haul') return null
    return context.findPath(start, staffCardinalNeighbors(target.cell), target.allowMedical)
  }

  private incidentFieldKey(incident: GroundIncident): string {
    return `${incident.kind}:${incident.x}:${incident.z}:${incident.elevation}`
  }

  private reset(member: StaffMember): void {
    member.state = 'patrolling'
    member.targetId = null
    member.route = []
    member.medicalCell = null
    member.medicalSlot = null
    if (member.role !== 'cleaner') member.carryingWaste = 0
    if (member.role === 'cleaner' && member.carryingWaste <= 0) {
      member.carryingWaste = 0
      member.wasteFromSealedContainer = false
    }
  }
}
