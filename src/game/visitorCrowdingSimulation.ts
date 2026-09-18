import { CrowdingSystem } from './crowding'
import { collectSeatedPassengerIds } from './logistics'
import { SIMULATION_CONFIG } from './simulationConfig'
import type { Cell, Visitor } from './types/entities'
import type { GameSnapshot } from './types/snapshot'
import {
  denseClusterSize,
  neighborhoodPeople,
  panicSpreadChance,
  spontaneousPanicChance,
} from './visitorBubbles'

export type VisitorCrowdingContext = {
  state: GameSnapshot
  nextRandom: () => number
  cellKey: (x: number, z: number, elevation: number) => string
  packCell: (cell: Cell) => number
  isVisitorSeated: (visitor: Visitor, seated: ReadonlySet<string>) => boolean
  hasStageForecourt: (x: number, z: number) => boolean
  clearVisitorActivity: (visitor: Visitor) => void
  removeVisitorFromCoasterQueues: (visitorId: string) => void
  isAtParkExit: (visitor: Visitor) => boolean
  getPedestrianNeighbors: (cell: Cell) => Iterable<Cell>
  getPathAt: (x: number, z: number, elevation?: number) => unknown
  findPathToEntrance: (start: Cell) => Cell[] | null
  recordComplaint: (visitor: Visitor, topic: 'overcrowding' | 'dirty-grounds') => void
  beginVisitorDeparture: (visitor: Visitor) => void
}

export class VisitorCrowdingSimulation {
  private readonly crowding = new CrowdingSystem()
  private readonly costs = new Map<string, number>()
  private readonly packedCosts = new Map<number, number>()
  private readonly context: VisitorCrowdingContext

  constructor(context: VisitorCrowdingContext) {
    this.context = context
  }

  costAt(key: string): number {
    return this.costs.get(key) ?? 0
  }

  costAtPacked(packed: number): number {
    return this.packedCosts.get(packed) ?? 0
  }

  costMap(): Map<string, number> {
    return this.costs
  }

  update(minutes: number): void {
    const { context } = this
    const config = SIMULATION_CONFIG.crowding
    const danceFloorKeys = new Set(
      context.state.stageForecourtCells.map(
        (cell) => `${cell.x}:${cell.z}:${cell.elevation}`,
      ),
    )
    const seated = collectSeatedPassengerIds(context.state.logistics.roadVehicles)
    const result = this.crowding.calculate(
      context.state.visitors.filter(
        (visitor) => !context.isVisitorSeated(visitor, seated),
      ),
      danceFloorKeys,
    )
    context.state.crowding = result.snapshot
    this.costs.clear()
    this.packedCosts.clear()
    result.snapshot.cells.forEach((cell) => {
      this.costs.set(context.cellKey(cell.x, cell.z, cell.elevation), cell.value)
      this.packedCosts.set(context.packCell(cell), cell.value)
    })
    const vomitCells = new Set(
      context.state.incidents
        .filter((incident) => incident.kind === 'vomit')
        .map((incident) => context.cellKey(incident.x, incident.z, incident.elevation)),
    )
    const peopleByCell = new Map<string, number>()
    const panicByCell = new Map<string, number>()
    for (const visitor of context.state.visitors) {
      if (context.isVisitorSeated(visitor, seated)) continue
      const key = context.cellKey(visitor.cellX, visitor.cellZ, visitor.cellElevation)
      peopleByCell.set(key, (peopleByCell.get(key) ?? 0) + 1)
      if (visitor.isPanicking || visitor.state === 'panicking') {
        panicByCell.set(key, (panicByCell.get(key) ?? 0) + 1)
      }
    }
    context.state.visitors.forEach((visitor) => {
      if (context.isVisitorSeated(visitor, seated)) {
        visitor.crowding = 0
        return
      }
      visitor.crowding = result.visitorValues.get(visitor.id) ?? 0
      if (visitor.state === 'medical' || visitor.state === 'medical-transport') {
        visitor.motivation = Math.min(
          100,
          visitor.motivation + minutes * config.medicalMotivationRecoveryPerMinute,
        )
        return
      }
      this.updatePanicStress(visitor, minutes, this.countTouching(visitor, peopleByCell))
      const crowdingPressure = Math.max(
        0,
        (visitor.crowding - config.pressureStart) / config.pressureRange,
      )
      const hungerPressure = Math.max(
        0,
        (config.lowNeedThreshold - visitor.needs.hunger) / config.lowNeedThreshold,
      )
      const toiletPressure = Math.max(
        0,
        (config.lowNeedThreshold - visitor.needs.toilet) / config.lowNeedThreshold,
      )
      const energyPressure =
        visitor.campsite || visitor.state === 'sleeping'
          ? 0
          : Math.max(
              0,
              (config.lowEnergyThreshold - visitor.needs.energy) /
                config.lowEnergyThreshold,
            )
      const litterPressure = vomitCells.has(
        context.cellKey(visitor.cellX, visitor.cellZ, visitor.cellElevation),
      )
        ? config.vomitPressure
        : 0
      const atmosphere = SIMULATION_CONFIG.atmosphere
      const beautyDeficit =
        Math.max(0, atmosphere.preferenceDeficitThreshold - visitor.localAttractiveness) /
        atmosphere.preferenceDeficitThreshold
      const partyDeficit =
        Math.max(0, atmosphere.preferenceDeficitThreshold - visitor.localPartyMood) /
        atmosphere.preferenceDeficitThreshold
      const atmospherePressure =
        ((beautyDeficit * visitor.beautyPreference +
          partyDeficit * visitor.partyPreference) *
          atmosphere.preferenceMotivationLossPerMinute) /
        config.motivationLossPerMinute
      const forecourtOvercrowding =
        context.hasStageForecourt(visitor.cellX, visitor.cellZ) &&
        visitor.crowding >= atmosphere.danceFloorOvercrowdingStart
          ? atmosphere.overcrowdingMotivationLossPerMinute /
            config.motivationLossPerMinute
          : 0
      if (beautyDeficit + partyDeficit > 0.7) {
        visitor.needs.fun = Math.max(
          0,
          visitor.needs.fun - minutes * atmosphere.preferenceFunLossPerMinute,
        )
      }
      const badConditions = Math.min(
        config.maximumBadConditions,
        crowdingPressure +
          hungerPressure * config.hungerPressureWeight +
          toiletPressure * config.toiletPressureWeight +
          energyPressure * config.energyPressureWeight +
          litterPressure +
          atmospherePressure +
          forecourtOvercrowding,
      )
      const needsFulfilled =
        visitor.needs.hunger >= config.fulfilledNeedThreshold &&
        visitor.needs.toilet >= config.fulfilledNeedThreshold &&
        visitor.needs.fun >= config.fulfilledNeedThreshold &&
        visitor.needs.energy >= config.fulfilledEnergyThreshold
      const recoveryPerMinute =
        (badConditions === 0 ? config.motivationRecoveryPerMinute : 0) +
        (needsFulfilled ? config.fulfilledNeedsRecoveryPerMinute : 0)
      visitor.motivation = Math.min(
        100,
        Math.max(
          0,
          visitor.motivation +
            minutes *
              (recoveryPerMinute - config.motivationLossPerMinute * badConditions),
        ),
      )
      if (
        visitor.motivation === 0 &&
        !visitor.isPanicking &&
        visitor.state !== 'riding' &&
        visitor.state !== 'sleeping' &&
        visitor.state !== 'leaving' &&
        visitor.state !== 'vehicle-arrival' &&
        visitor.state !== 'bus-riding' &&
        visitor.campingPhase !== 'packing'
      ) {
        visitor.emotion = 'sad'
        visitor.emotionMinutes = 60
        visitor.thought = 'Unter diesen Bedingungen habe ich keine Lust mehr.'
        if (visitor.crowding >= 70) context.recordComplaint(visitor, 'overcrowding')
        if (litterPressure > 0 || visitor.localAttractiveness < -20) {
          context.recordComplaint(visitor, 'dirty-grounds')
        }
        context.beginVisitorDeparture(visitor)
      }
    })
    this.resolvePanic(minutes, peopleByCell, panicByCell)
  }

  ensurePanicFleeRoute(visitor: Visitor): void {
    const { context } = this
    if (context.isAtParkExit(visitor)) {
      visitor.route = []
      return
    }
    if (visitor.route.length > 0) return
    const current =
      this.costs.get(context.cellKey(visitor.cellX, visitor.cellZ, visitor.cellElevation)) ??
      visitor.crowding
    const quieter = [...context.getPedestrianNeighbors({
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    })]
      .map((cell) => ({
        ...cell,
        path: context.getPathAt(cell.x, cell.z, cell.elevation),
        crowding: this.costs.get(context.cellKey(cell.x, cell.z, cell.elevation)) ?? 0,
      }))
      .filter((cell) => cell.crowding < current - 2)
      .sort(
        (left, right) =>
          left.crowding - right.crowding ||
          Number(Boolean(left.path)) - Number(Boolean(right.path)),
      )
    if (quieter[0]) {
      visitor.route = [{
        x: quieter[0].x,
        z: quieter[0].z,
        elevation: quieter[0].elevation,
      }]
      return
    }
    visitor.route =
      context.findPathToEntrance({
        x: visitor.cellX,
        z: visitor.cellZ,
        elevation: visitor.cellElevation,
      }) ?? []
  }

  private canEnterPanic(visitor: Visitor): boolean {
    return (
      !visitor.isPanicking &&
      visitor.state !== 'riding' &&
      visitor.state !== 'sleeping' &&
      visitor.state !== 'leaving' &&
      visitor.state !== 'vehicle-arrival' &&
      visitor.state !== 'bus-riding' &&
      visitor.state !== 'medical' &&
      visitor.state !== 'medical-transport' &&
      visitor.state !== 'injured' &&
      visitor.campingPhase !== 'packing' &&
      visitor.campingPhase !== 'resting'
    )
  }

  private updatePanicStress(visitor: Visitor, minutes: number, nearbyPeople: number): void {
    const crowd = SIMULATION_CONFIG.crowding
    if (visitor.crowding >= crowd.denseThreshold) {
      const intensity = Math.min(
        1,
        (visitor.crowding - crowd.denseThreshold) /
          Math.max(1, 100 - crowd.denseThreshold),
      )
      visitor.crowdStress = Math.min(
        100,
        visitor.crowdStress +
          minutes *
            crowd.stressGainPerMinute *
            (0.4 + intensity * 0.6) *
            (1 + Math.min(crowd.panicNearbyCap, nearbyPeople) / 80),
      )
      return
    }
    if (visitor.crowding <= crowd.calmThreshold) {
      visitor.crowdStress = Math.max(
        0,
        visitor.crowdStress - minutes * crowd.stressDecayPerMinute,
      )
    }
  }

  private countTouching(
    visitor: Pick<Visitor, 'cellX' | 'cellZ' | 'cellElevation'>,
    counts: Map<string, number>,
  ): number {
    const { cellX: x, cellZ: z, cellElevation: elevation } = visitor
    const key = this.context.cellKey
    return (
      (counts.get(key(x, z, elevation)) ?? 0) +
      (counts.get(key(x + 1, z, elevation)) ?? 0) +
      (counts.get(key(x - 1, z, elevation)) ?? 0) +
      (counts.get(key(x, z + 1, elevation)) ?? 0) +
      (counts.get(key(x, z - 1, elevation)) ?? 0)
    )
  }

  private markPanicCell(visitor: Visitor, panicByCell: Map<string, number>): void {
    const key = this.context.cellKey(visitor.cellX, visitor.cellZ, visitor.cellElevation)
    panicByCell.set(key, (panicByCell.get(key) ?? 0) + 1)
  }

  private resolvePanic(
    minutes: number,
    peopleByCell: Map<string, number>,
    panicByCell: Map<string, number>,
  ): void {
    const { context } = this
    const crowd = SIMULATION_CONFIG.crowding
    const crowdingAt = (x: number, z: number, elevation: number) =>
      this.costs.get(context.cellKey(x, z, elevation)) ?? 0
    const peopleAt = (x: number, z: number, elevation: number) =>
      peopleByCell.get(context.cellKey(x, z, elevation)) ?? 0
    context.state.visitors.forEach((visitor) => {
      if (!this.canEnterPanic(visitor) || visitor.crowding < crowd.denseThreshold) return
      const denseCells = denseClusterSize(visitor, crowdingAt, crowd.denseThreshold)
      const clusterPeople = neighborhoodPeople(visitor, peopleAt)
      const nearby = this.countTouching(visitor, peopleByCell)
      const chance =
        spontaneousPanicChance(
          visitor.crowding,
          visitor.crowdStress,
          nearby,
          denseCells,
          clusterPeople,
        ) * minutes
      if (context.nextRandom() < chance) {
        this.beginPanic(visitor)
        this.markPanicCell(visitor, panicByCell)
      }
    })
    context.state.visitors.forEach((visitor) => {
      if (!this.canEnterPanic(visitor) || visitor.crowding < crowd.denseThreshold) return
      const denseCells = denseClusterSize(visitor, crowdingAt, crowd.denseThreshold)
      const nearbyPanic = this.countTouching(visitor, panicByCell)
      if (
        context.nextRandom() <
        panicSpreadChance(visitor.crowding, nearbyPanic, denseCells) * minutes
      ) {
        this.beginPanic(visitor)
        this.markPanicCell(visitor, panicByCell)
      }
    })
    context.state.visitors.forEach((visitor) => {
      if (!visitor.isPanicking) return
      const alcohol = visitor.alcoholLevel
      visitor.needs.hunger = Math.max(
        0,
        visitor.needs.hunger - minutes * crowd.panicNeedLossPerMinute,
      )
      visitor.needs.toilet = Math.max(
        0,
        visitor.needs.toilet - minutes * crowd.panicNeedLossPerMinute,
      )
      visitor.needs.fun = Math.max(
        0,
        visitor.needs.fun - minutes * crowd.panicNeedLossPerMinute,
      )
      visitor.needs.energy = Math.max(
        0,
        visitor.needs.energy - minutes * crowd.panicNeedLossPerMinute,
      )
      visitor.alcoholLevel = alcohol
      visitor.motivation = Math.max(
        0,
        visitor.motivation - minutes * crowd.panicMotivationLossPerMinute,
      )
      visitor.emotion = 'angry'
      visitor.emotionMinutes = Math.max(visitor.emotionMinutes, 8)
      if (visitor.crowding <= crowd.calmThreshold) {
        visitor.panicRecoverMinutes += minutes
        if (visitor.panicRecoverMinutes >= crowd.panicRecoverMinutes) {
          this.endPanic(visitor)
        }
        return
      }
      visitor.panicRecoverMinutes = 0
      this.ensurePanicFleeRoute(visitor)
      if (visitor.motivation === 0 && visitor.crowding >= crowd.denseThreshold) {
        context.recordComplaint(visitor, 'overcrowding')
        context.beginVisitorDeparture(visitor)
      }
    })
  }

  private beginPanic(visitor: Visitor): void {
    this.context.clearVisitorActivity(visitor)
    this.context.removeVisitorFromCoasterQueues(visitor.id)
    visitor.isPanicking = true
    visitor.panicRecoverMinutes = 0
    visitor.crowdStress = Math.max(visitor.crowdStress, 70)
    visitor.isConversing = false
    visitor.state = 'panicking'
    visitor.targetId = null
    visitor.concertId = null
    visitor.emotion = 'angry'
    visitor.emotionMinutes = 20
    visitor.thought = 'Massenpanik! Ich muss hier raus!'
    this.ensurePanicFleeRoute(visitor)
  }

  private endPanic(visitor: Visitor): void {
    visitor.isPanicking = false
    visitor.panicRecoverMinutes = 0
    visitor.crowdStress = Math.min(visitor.crowdStress, 24)
    visitor.motivation = Math.min(100, Math.max(visitor.motivation, 32))
    visitor.state = 'exploring'
    visitor.targetId = null
    visitor.route = []
    visitor.emotion = 'happy'
    visitor.emotionMinutes = 10
    visitor.thought = 'Das Gedränge lässt nach. Kurz durchatmen, dann geht es weiter.'
  }
}
