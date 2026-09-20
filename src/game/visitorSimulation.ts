import { collectSeatedPassengerIds } from './logistics'
import type { Visitor } from './types/entities'
import type { GameSnapshot } from './types/snapshot'

export type VisitorRoutingKind = 'departure' | 'exit' | 'waste'

export type VisitorSimulationContext = {
  state: GameSnapshot
  getVisitor: (id: string) => Visitor | undefined
  isProcessingStep: () => boolean
  takeDecision: (visitorId: string) => boolean
  beginDeparture: (visitor: Visitor) => void
  ensureExitRoute: (visitor: Visitor) => void
  routeWaste: (visitor: Visitor) => void
  chooseNextAction: (visitor: Visitor) => void
  updateVisitors: (minutes: number) => void
  updateFanIntrusion: (minutes: number) => void
  updateBandActors: (minutes: number) => void
  updateFacilityQueues: (minutes: number) => void
  updateVisitorFireworks: (minutes: number) => void
  updateCoasters: () => void
}

/**
 * Owns visitor decision fairness and the ordered visitor-facing tick phase.
 * The shared tick budget itself stays in the facade because band actors spend it too.
 */
export class VisitorSimulation {
  private readonly awaitingDecision = new Set<string>()
  private readonly pendingRouting = new Map<string, VisitorRoutingKind>()
  private activeDecisionId: string | null = null
  private readonly context: VisitorSimulationContext

  constructor(context: VisitorSimulationContext) {
    this.context = context
  }

  /** Mutable compatibility seam for diagnostics that stage queue state directly. */
  get decisionQueue(): Set<string> {
    return this.awaitingDecision
  }

  /** Mutable compatibility seam for deterministic routing-budget regression tests. */
  get routingQueue(): Map<string, VisitorRoutingKind> {
    return this.pendingRouting
  }

  runTickPhase(clockMinutes: number, movementMinutes = clockMinutes): void {
    this.context.updateVisitors(clockMinutes)
    this.context.updateFanIntrusion(clockMinutes)
    this.context.updateBandActors(movementMinutes)
    this.context.updateFacilityQueues(movementMinutes)
    this.context.updateVisitorFireworks(clockMinutes)
    this.context.updateCoasters()
  }

  isAwaiting(visitorId: string): boolean {
    return this.awaitingDecision.has(visitorId)
  }

  clearAwaiting(visitorId: string): void {
    this.awaitingDecision.delete(visitorId)
  }

  hasPendingRouting(visitorId: string): boolean {
    return this.pendingRouting.has(visitorId)
  }

  pendingRoutingKind(visitorId: string): VisitorRoutingKind | undefined {
    return this.pendingRouting.get(visitorId)
  }

  deferRouting(visitorId: string, kind: VisitorRoutingKind): void {
    const existing = this.pendingRouting.get(visitorId)
    if (!existing || kind === 'departure') this.pendingRouting.set(visitorId, kind)
    this.awaitingDecision.add(visitorId)
  }

  queueDecision(visitor: Visitor): void {
    if (visitor.state !== 'camping') this.awaitingDecision.add(visitor.id)
  }

  runRouting(visitor: Visitor, kind: VisitorRoutingKind, action: () => void): boolean {
    if (!this.context.isProcessingStep() || this.activeDecisionId === visitor.id) {
      action()
      return true
    }
    if (this.pendingRouting.has(visitor.id) || !this.context.takeDecision(visitor.id)) {
      this.deferRouting(visitor.id, kind)
      return false
    }
    this.runAsActive(visitor.id, action)
    return true
  }

  decideNext(visitor: Visitor): void {
    if (this.context.isProcessingStep() && !this.context.takeDecision(visitor.id)) {
      this.queueDecision(visitor)
      return
    }
    this.awaitingDecision.delete(visitor.id)
    this.runAsActive(visitor.id, () => this.context.chooseNextAction(visitor))
  }

  flushDecisions(limit = 2): void {
    const seated = collectSeatedPassengerIds(this.context.state.logistics.roadVehicles)
    let handled = 0
    while (handled < limit && this.awaitingDecision.size > 0) {
      const visitorId = this.awaitingDecision.values().next().value
      if (!visitorId) break
      this.awaitingDecision.delete(visitorId)
      handled += 1
      const visitor = this.context.getVisitor(visitorId)
      const routing = this.pendingRouting.get(visitorId)
      this.pendingRouting.delete(visitorId)
      if (visitor && routing) {
        if (routing === 'departure') this.context.beginDeparture(visitor)
        else if (routing === 'exit') this.context.ensureExitRoute(visitor)
        else this.context.routeWaste(visitor)
        if (this.pendingRouting.has(visitorId)) this.awaitingDecision.add(visitorId)
        continue
      }
      if (
        !visitor ||
        visitor.state === 'camping' ||
        visitor.state === 'vehicle-arrival' ||
        visitor.state === 'bus-riding' ||
        visitor.state === 'riding' ||
        visitor.state === 'leaving' ||
        seated.has(visitor.id) ||
        visitor.route.length > 0 ||
        visitor.targetId
      ) {
        continue
      }
      this.decideNext(visitor)
    }
  }

  private runAsActive(visitorId: string, action: () => void): void {
    const previous = this.activeDecisionId
    this.activeDecisionId = visitorId
    try {
      action()
    } finally {
      this.activeDecisionId = previous
    }
  }
}
