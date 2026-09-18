import { assignAudience, BANDS } from './festivalManagement'
import { getFestivalCycleStatus, isDayVisitorAdmissionOpen } from './dayPlan'
import { addItem, createFestivalInventory, getItemQuantity } from './inventory'
import type { ArrivalGroup, RoadPosition, RoadVehicle } from './logistics'
import { visitorLooksFemale, hashStringSeed, type DeterministicRng } from './rng'
import { sampleBiasedPreference, type ScenarioSettings } from './scenario'
import { SIMULATION_CONFIG } from './simulationConfig'
import type { Cell, Visitor } from './types/entities'
import type { GameSnapshot } from './types/snapshot'

export const FEMALE_VISITOR_NAMES = [
  'Mia', 'Emma', 'Lea', 'Lina', 'Sofia', 'Mila', 'Nina', 'Marie',
  'Hannah', 'Clara', 'Ida', 'Greta', 'Lara', 'Pia', 'Anna', 'Luisa',
]
export const MALE_VISITOR_NAMES = [
  'Noah', 'Finn', 'Ben', 'Elias', 'Jonas', 'Paul', 'Leon', 'Max',
  'Theo', 'Otto', 'Jan', 'Felix', 'Luis', 'Oskar', 'Karl', 'Tim',
]

export function visitorGivenName(id: string, salt = 0): string {
  const names = visitorLooksFemale(id) ? FEMALE_VISITOR_NAMES : MALE_VISITOR_NAMES
  return names[(hashStringSeed(id) + salt) % names.length]!
}

export type VisitorSpawningContext = {
  state: GameSnapshot
  rng: DeterministicRng
  getScenario: () => ScenarioSettings
  getEntrance: () => Cell
  getRoadEntry: () => RoadPosition
  findAvailableRoadEntry: () => RoadPosition | null
  nextId: (prefix: string) => string
  idCounter: () => number
  getBookableCampingCapacity: () => number
  createPreferredSleepRhythm: () => {
    preferredBedtime: number
    preferredWakeTime: number
  }
  samplePoisson: (lambda: number) => number
  ticketPriceFor: (ticketType: 'day' | 'camping') => number
  chargeVisitor: (
    visitor: Visitor,
    amount: number,
    position: { x: number; y: number; z: number },
    category: 'camping' | 'tickets',
  ) => boolean
  queueVisitorDecision: (visitor: Visitor) => void
  assignCampsite: (visitor: Visitor) => boolean
  dispatchIncomingVisitorCar: (vehicle: RoadVehicle) => void
  visitorsChanged: () => void
}

export class VisitorSpawning {
  private elapsedMinutes = 0
  private readonly context: VisitorSpawningContext

  constructor(context: VisitorSpawningContext) {
    this.context = context
  }

  update(minutes: number): void {
    this.elapsedMinutes += minutes
    const interval = SIMULATION_CONFIG.visitors.spawnIntervalMinutes
    while (this.elapsedMinutes >= interval) {
      this.elapsedMinutes -= interval
      this.spawnInterval()
    }
  }

  private spawnInterval(): void {
    const { state } = this.context
    const hour = Math.floor(state.minute / 60) % 24
    const baseArrivals =
      (SIMULATION_CONFIG.visitors.arrivalsPerIntervalByHour[hour] ?? 0) *
      (state.festival.enabled
        ? 0.7 +
          Math.min(
            2,
            state.festival.bookings
              .filter((booking) => booking.day === state.day)
              .reduce(
                (sum, booking) =>
                  sum + (BANDS.find((band) => band.id === booking.bandId)?.draw ?? 0),
                0,
              ) /
              100,
          ) +
          Object.values(state.festival.reputation).reduce((a, b) => a + b, 0) / 800
        : 1)
    const phase = getFestivalCycleStatus(state.dayPlan, state.day)
    const tuning = SIMULATION_CONFIG.visitors.festivalArrivals
    if (phase.phase === 'lead') {
      const campers = this.context.samplePoisson(
        baseArrivals * tuning.leadDayCamperMultiplier,
      )
      for (let index = 0; index < campers; index += 1) this.trySpawn('camping')
    } else if (phase.phase === 'festival') {
      const dayGuests = this.context.samplePoisson(
        baseArrivals * tuning.festivalDayGuestMultiplier,
      )
      for (let index = 0; index < dayGuests; index += 1) this.trySpawn('day')
      const camperMultiplier = phase.firstFestivalDay
        ? tuning.firstFestivalDayCamperMultiplier
        : tuning.laterFestivalDayCamperMultiplier
      const campers = this.context.samplePoisson(baseArrivals * camperMultiplier)
      for (let index = 0; index < campers; index += 1) this.trySpawn('camping')
    }
  }

  trySpawn(forcedTicketType?: 'day' | 'camping'): void {
    const { context } = this
    if (!context.state.parkOpen) return
    const mode = context.rng.next() < context.getScenario().carArrivalShare
      ? 'car'
      : 'pedestrian'
    const roadEntry =
      mode === 'car' ? context.findAvailableRoadEntry() : context.getRoadEntry()
    if (mode === 'car' && !roadEntry) return
    const requestedSize = mode === 'car' ? this.sampleArrivalGroupSize() : 1
    const groupId = context.nextId('arrival')
    const members: Visitor[] = []
    for (let index = 0; index < requestedSize; index += 1) {
      const visitor = this.spawnMember(forcedTicketType, groupId, mode, mode === 'car')
      if (visitor) members.push(visitor)
    }
    if (members.length === 0) return
    const group: ArrivalGroup = {
      id: groupId,
      memberIds: members.map((visitor) => visitor.id),
      vehicleId: null,
      mode,
      state: mode === 'car' ? 'approaching' : 'arrived',
      arrivedMinute: context.state.day * 1440 + context.state.minute,
      parkingWaitMinutes: 0,
      entryFeesPaid: members.every((visitor) => visitor.entryFeePaid > 0),
    }
    context.state.logistics.arrivalGroups.push(group)
    if (mode !== 'car') return
    const vehicleEntry = roadEntry ?? context.getRoadEntry()
    const vehicle: RoadVehicle = {
      id: context.nextId('car'),
      kind: 'visitorCar',
      position: { ...vehicleEntry },
      cell: { ...vehicleEntry },
      route: [],
      state: 'waiting',
      speed: 0,
      passengerIds: [...group.memberIds],
      groupId,
      parkingCell: null,
      target: null,
      facing: 0,
      waitMinutes: 0,
      resumeState: null,
      lineId: null,
      nextStopIndex: 0,
      cargo: 0,
    }
    group.vehicleId = vehicle.id
    context.state.logistics.roadVehicles.push(vehicle)
    context.dispatchIncomingVisitorCar(vehicle)
    members.forEach((visitor) => {
      visitor.thought = vehicle.parkingCell
        ? 'Wir suchen mit dem Auto einen Parkplatz.'
        : 'Kein freier Parkplatz – wir fahren erstmal weiter.'
    })
  }

  spawnMember(
    forcedTicketType: 'day' | 'camping' | undefined,
    groupId: string,
    arrivalMode: 'car' | 'pedestrian',
    deferArrival: boolean,
  ): Visitor | null {
    const { context } = this
    const { state, rng } = context
    if (!state.parkOpen) return null
    let inventory = createFestivalInventory(rng)
    if (forcedTicketType === 'camping' && getItemQuantity(inventory, 'tent') === 0) {
      addItem(inventory, 'tent')
    } else if (forcedTicketType === 'day') {
      inventory = inventory.filter(
        (item) =>
          item.kind !== 'tent' &&
          item.kind !== 'chairs' &&
          item.kind !== 'pavilion' &&
          item.kind !== 'musicBox',
      )
    }
    const ticketType =
      forcedTicketType ??
      (getItemQuantity(inventory, 'tent') > 0 ? 'camping' : 'day')
    const tickets = state.festival.enabled ? state.festival.tickets : undefined
    if (
      tickets &&
      (ticketType === 'camping'
        ? tickets.usedCamping >= tickets.camping
        : (tickets.usedDay[state.day] ?? 0) >= tickets.day)
    ) {
      return null
    }
    if (
      ticketType === 'camping' &&
      state.visitors.filter((visitor) => visitor.ticketType === 'camping').length >=
        context.getBookableCampingCapacity()
    ) {
      return null
    }
    if (
      ticketType === 'day' &&
      (getFestivalCycleStatus(state.dayPlan, state.day).phase !== 'festival' ||
        !isDayVisitorAdmissionOpen(state.dayPlan, state.minute))
    ) {
      return null
    }
    const id = context.nextId('visitor')
    const entrance = context.getEntrance()
    const tileOffsetX =
      SIMULATION_CONFIG.visitors.tileOffsetMinimum +
      rng.next() * SIMULATION_CONFIG.visitors.tileOffsetRandomRange
    const tileOffsetZ =
      SIMULATION_CONFIG.visitors.tileOffsetMinimum +
      rng.next() * SIMULATION_CONFIG.visitors.tileOffsetRandomRange
    const initialNeeds = SIMULATION_CONFIG.visitors.initialNeeds
    const visitor: Visitor = {
      id,
      name: `${visitorGivenName(id, state.day)} ${context.idCounter()}`,
      x: entrance.x + tileOffsetX,
      y: entrance.elevation,
      z: entrance.z + tileOffsetZ,
      cellX: entrance.x,
      cellZ: entrance.z,
      cellElevation: entrance.elevation,
      color: Math.floor(rng.next() * 0xffffff),
      state: 'entering',
      thought: 'Ich bin gespannt auf den Park!',
      needs: {
        hunger: initialNeeds.hungerMinimum + rng.next() * initialNeeds.hungerRandomRange,
        toilet: initialNeeds.toiletMinimum + rng.next() * initialNeeds.toiletRandomRange,
        fun: initialNeeds.funMinimum + rng.next() * initialNeeds.funRandomRange,
        energy: initialNeeds.energyMinimum + rng.next() * initialNeeds.energyRandomRange,
      },
      route: [],
      targetId: null,
      interactionRemaining: 0,
      walkSpeed:
        SIMULATION_CONFIG.visitors.walkSpeedMinimum +
        rng.next() * SIMULATION_CONFIG.visitors.walkSpeedRandomRange,
      movementBoostMinutes: 0,
      avoidedCoasterId: null,
      avoidanceMinutes: 0,
      facing: 0,
      emotion: 'neutral',
      emotionMinutes: 0,
      budget: SIMULATION_CONFIG.visitors.budget,
      alcoholLevel: 0,
      alcoholDisposition:
        rng.next() < context.getScenario().aggressiveShare ? 'aggressive' : 'calm',
      alcoholDesire:
        SIMULATION_CONFIG.visitors.alcoholDesireMinimum +
        rng.next() * SIMULATION_CONFIG.visitors.alcoholDesireRandomRange,
      campsite: null,
      campingPhase: 'none',
      hasHandcart: ticketType === 'camping',
      inventory,
      motivation: 100,
      crowding: 0,
      crowdStress: 0,
      isPanicking: false,
      panicRecoverMinutes: 0,
      tileOffsetX,
      tileOffsetZ,
      campActivityTarget: null,
      campActivity: 'standing',
      campActivityKind: null,
      campActivitySlot: 0,
      campActivityCapacity: 1,
      nausea: 0,
      nauseaCooldown: 0,
      medicalCell: null,
      medicalSlot: null,
      securityGateId: null,
      securityResumeState: null,
      beautyPreference: sampleBiasedPreference(context.getScenario().beautyAffinity, rng),
      partyPreference: sampleBiasedPreference(context.getScenario().partyAffinity, rng),
      localAttractiveness: 0,
      localPartyMood: 0,
      activityTarget: null,
      activitySlot: 0,
      activityCapacity: 1,
      isDancing: false,
      ...context.createPreferredSleepRhythm(),
      ticketType,
      consumptionCooldown: 0,
      isConversing: false,
      campingWaitMinutes: 0,
      campingWaitRetryMinutes: 0,
      entryFeePaid: 0,
      complaintsFiled: [],
      arrivalGroupId: groupId,
      arrivalMode,
      injuryVehicleId: null,
      rescueVehicleId: null,
      busWaitMinutes: 0,
      busLineId: null,
      busDestination: null,
      busDestinationStopId: null,
      busResumeState: null,
      busResumeTargetId: null,
      walkingToCampDistance: 0,
      pendingWaste: 0,
      streakingMinutes: 0,
      streakingCooldownMinutes: 0,
      toplessMinutes: 0,
      bungeeNude: false,
      ownedMascot: false,
      heldMascot: false,
      pathSeed: hashStringSeed(id),
      wanderNonce: 0,
    }
    if (state.festival.enabled) assignAudience(visitor, state.festival)
    const admissionPrice = context.ticketPriceFor(ticketType)
    const paidEntry = context.chargeVisitor(
      visitor,
      admissionPrice,
      {
        x: (arrivalMode === 'car' ? context.getRoadEntry().x : entrance.x) + 0.5,
        y: 0.85,
        z: (arrivalMode === 'car' ? context.getRoadEntry().z : entrance.z) + 0.5,
      },
      ticketType === 'camping' ? 'camping' : 'tickets',
    )
    if (paidEntry) visitor.entryFeePaid = admissionPrice
    state.visitors.push(visitor)
    if (tickets) {
      if (ticketType === 'camping') tickets.usedCamping += 1
      else tickets.usedDay[state.day] = (tickets.usedDay[state.day] ?? 0) + 1
    }
    if (state.festival.enabled) {
      state.festival.admissions += 1
      state.festival.metrics.guests += 1
    }
    context.visitorsChanged()
    state.guests = state.visitors.length
    if (deferArrival) {
      const roadEntry = context.getRoadEntry()
      visitor.state = 'vehicle-arrival'
      visitor.x = roadEntry.x + tileOffsetX
      visitor.z = roadEntry.z + tileOffsetZ
      visitor.cellX = roadEntry.x
      visitor.cellZ = roadEntry.z
      return visitor
    }
    if (getItemQuantity(visitor.inventory, 'tent') === 0) {
      visitor.hasHandcart = false
      context.queueVisitorDecision(visitor)
    } else if (!context.assignCampsite(visitor)) {
      visitor.state = 'camp-waiting'
      visitor.route = []
      visitor.campingWaitMinutes = 0
      visitor.campingWaitRetryMinutes =
        SIMULATION_CONFIG.camping.unplacedRetryIntervalMinutes
      visitor.emotion = 'sad'
      visitor.thought =
        'Alle Campingflächen wirken belegt. Ich warte auf einen freien Platz.'
    }
    return visitor
  }

  sampleArrivalGroupSize(): number {
    let roll = this.context.rng.next()
    const weights = SIMULATION_CONFIG.logistics.groupSizeWeights
    for (let index = 0; index < weights.length; index += 1) {
      roll -= weights[index] ?? 0
      if (roll <= 0) return index + 1
    }
    return 1
  }
}
