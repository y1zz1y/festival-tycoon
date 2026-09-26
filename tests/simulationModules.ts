import assert from 'node:assert/strict'
import {
  resumeVehicleAfterIncident,
  roadRouteIsConnected,
  updateLogisticsSimulation,
  vehicleDirection,
} from '../src/game/logisticsSimulation'
import { RoadVehicleSimulation } from '../src/game/roadVehicleSimulation'
import type { RoadVehicle } from '../src/game/logistics'
import { createBlankSnapshot } from '../src/game/snapshotBootstrap'
import { VisitorSimulation } from '../src/game/visitorSimulation'
import { VisitorBehaviorService } from '../src/game/visitorBehavior'
import { VisitorCrowdingSimulation } from '../src/game/visitorCrowdingSimulation'
import { VisitorSpawning } from '../src/game/visitorSpawning'
import { CoasterSimulation } from '../src/game/coasterSimulation'
import { PlacementService } from '../src/game/placementService'
import {
  normalizeSnapshotForRuntime,
  repairSnapshotEntities,
} from '../src/game/snapshotRepair'
import type { Visitor } from '../src/game/types/entities'
import { GameState } from '../src/game/GameState'
import { normalizeScenarioSettings } from '../src/game/scenario'
import { SimulationProfiler } from '../src/game/simulationProfiler'

function vehicle(id: string): RoadVehicle {
  return {
    id,
    kind: 'visitorCar',
    position: { x: 0, z: 0 },
    cell: { x: 0, z: 0 },
    route: [{ x: 0, z: 1 }],
    state: 'waiting',
    speed: 0,
    passengerIds: [],
    groupId: 'group',
    parkingCell: null,
    target: { kind: 'cell', x: 0, z: 1 },
    facing: 0,
    waitMinutes: 1,
    lineId: null,
    nextStopIndex: 0,
    resumeState: 'returning',
    cargo: 0,
  }
}

export function testSimulationModules(): void {
  for (const method of [
    'processLogisticsVehicles',
    'dispatchIdleAmbulances',
    'dispatchBus',
    'dispatchGarbageTruck',
    'syncFreightToVehicles',
    'finishDeliveryTruckLeg',
    'restoreMissingGarbageTrucks',
  ] as const) {
    assert.equal(
      typeof RoadVehicleSimulation.prototype[method],
      'function',
      `road vehicle service owns ${method}`,
    )
  }
  assert.equal(typeof VisitorCrowdingSimulation.prototype.update, 'function')
  assert.equal(typeof VisitorSpawning.prototype.update, 'function')
  assert.equal(typeof VisitorSpawning.prototype.spawnMember, 'function')
  assert.equal(typeof CoasterSimulation.prototype.update, 'function')
  assert.equal(typeof CoasterSimulation.prototype.integratePhysics, 'function')
  assert.equal(typeof PlacementService.prototype.placePathSegment, 'function')
  assert.equal(typeof PlacementService.prototype.placeRoadSegment, 'function')
  assert.equal(typeof PlacementService.prototype.bulldozeAt, 'function')
  assert.equal(typeof normalizeSnapshotForRuntime, 'function')
  assert.equal(typeof repairSnapshotEntities, 'function')
  for (const method of [
    'updateVisitors',
    'walkVisitors',
    'chooseNextVisitorAction',
    'finishInteraction',
    'decayNeeds',
  ] as const) {
    assert.equal(
      typeof VisitorBehaviorService.prototype[method],
      'function',
      `visitor behavior service owns ${method}`,
    )
  }

  const state = createBlankSnapshot()
  const car = vehicle('car')
  state.logistics.roadVehicles.push(car)
  state.logistics.arrivalGroups.push({
    id: 'group',
    memberIds: [],
    vehicleId: car.id,
    mode: 'car',
    state: 'leaving',
    arrivedMinute: null,
    parkingWaitMinutes: 0,
    entryFeesPaid: true,
  })
  const phases: string[] = []
  updateLogisticsSimulation({
    state,
    roadPositionKey: (position) => `${position.x}:${position.z}:${position.elevation ?? 0}`,
    isRoadPosition: () => true,
    isVisitorSeated: () => false,
    evaluateAccessSignals: () => phases.push('access'),
    syncFreightToVehicles: () => phases.push('freight-in'),
    restoreMissingGarbageTrucks: () => phases.push('restore'),
    resetPerTickCaches: () => phases.push('reset'),
    processVehicles: (_minutes, tick) => {
      phases.push('vehicles')
      assert.equal(tick.occupied.get('0:0:0'), car.id)
      tick.removedVehicles.add(car.id)
      tick.removedGroups.add('group')
    },
    leaveVisitorCampBehind: () => undefined,
    normalizeCarManifest: () => undefined,
    visitorsRemoved: () => undefined,
    syncVehiclesToFreight: () => phases.push('freight-out'),
  }, 0.1)
  assert.deepEqual(phases, [
    'access', 'freight-in', 'restore', 'reset', 'vehicles', 'freight-out',
  ])
  assert.equal(state.logistics.roadVehicles.length, 0)
  assert.equal(state.logistics.arrivalGroups.length, 0)

  const resumed = vehicle('resumed')
  assert.equal(resumeVehicleAfterIncident(resumed), true)
  assert.equal(resumed.state, 'returning')
  assert.equal(resumed.resumeState, null)
  assert.equal(vehicleDirection(resumed), 0)
  assert.equal(
    roadRouteIsConnected(
      { x: 0, z: 0 },
      [{ x: 0, z: 1 }, { x: 1, z: 1 }],
    ),
    true,
  )
  assert.equal(
    roadRouteIsConnected({ x: 0, z: 0 }, [{ x: 1, z: 1 }]),
    false,
  )

  const visitorState = createBlankSnapshot()
  const guest = {
    id: 'guest',
    state: 'exploring',
    route: [],
    targetId: null,
  } as Visitor
  visitorState.visitors.push(guest)
  const visitorPhases: string[] = []
  let decisions = 0
  let processing = true
  const visitors = new VisitorSimulation({
    state: visitorState,
    getVisitor: (id) => visitorState.visitors.find((visitor) => visitor.id === id),
    isProcessingStep: () => processing,
    takeDecision: () => {
      decisions += 1
      return decisions > 1
    },
    beginDeparture: () => visitorPhases.push('departure'),
    ensureExitRoute: () => visitorPhases.push('exit'),
    routeWaste: () => visitorPhases.push('waste'),
    chooseNextAction: () => visitorPhases.push('decision'),
    updateVisitors: () => visitorPhases.push('visitors'),
    updateFanIntrusion: () => visitorPhases.push('fans'),
    updateBandActors: () => visitorPhases.push('bands'),
    updateFacilityQueues: () => visitorPhases.push('queues'),
    updateVisitorFireworks: () => visitorPhases.push('fireworks'),
    updateCoasters: () => visitorPhases.push('coasters'),
  })
  visitors.runTickPhase(1)
  assert.deepEqual(visitorPhases, [
    'visitors', 'fans', 'bands', 'queues', 'fireworks', 'coasters',
  ])
  assert.equal(visitors.runRouting(guest, 'departure', () => visitorPhases.push('direct')), false)
  assert.equal(visitors.pendingRoutingKind(guest.id), 'departure')
  visitors.flushDecisions(1)
  assert.equal(visitorPhases.at(-1), 'departure')
  assert.equal(visitors.isAwaiting(guest.id), false)
  processing = false
  assert.equal(visitors.runRouting(guest, 'exit', () => visitorPhases.push('direct')), true)
  assert.equal(visitorPhases.at(-1), 'direct')

  const measured: string[] = []
  const profiled = new VisitorSimulation({
    state: visitorState,
    getVisitor: (id) => visitorState.visitors.find((visitor) => visitor.id === id),
    isProcessingStep: () => true,
    takeDecision: () => true,
    beginDeparture: () => undefined,
    ensureExitRoute: () => undefined,
    routeWaste: () => undefined,
    chooseNextAction: () => undefined,
    updateVisitors: () => undefined,
    updateFanIntrusion: () => undefined,
    updateBandActors: () => undefined,
    updateFacilityQueues: () => undefined,
    updateVisitorFireworks: () => undefined,
    updateCoasters: () => undefined,
    measurePhase: (id, work) => {
      measured.push(id)
      return work()
    },
  })
  profiled.runTickPhase(1)
  assert.deepEqual(measured, [
    'visitors', 'concert', 'concert', 'queues', 'concert', 'attractions',
  ])

  let clock = 0
  const profiler = new SimulationProfiler(() => clock)
  assert.equal(profiler.consume(), null)
  profiler.measure('staff', () => {
    clock += 4
  })
  assert.equal(profiler.consume(), null, 'disabled profiler never records timings')
  profiler.enabled = true
  profiler.measure('staff', () => {
    clock += 4
  })
  profiler.measureInclusive('pathfinding', () => {
    clock += 2
  })
  const sample = profiler.consume()
  assert.deepEqual(sample, { exclusive: { staff: 4 }, inclusive: { pathfinding: 2 } })
  assert.deepEqual(profiler.consume(), { exclusive: {}, inclusive: {} })
  profiler.enabled = false
  assert.equal(profiler.consume(), null)

  const park = GameState.startNew(normalizeScenarioSettings({
    worldSize: 32,
    unevenness: 0,
    startingMoney: 50_000,
  }))
  park.snapshot.festival.planning = false
  park.setSpeed(1)
  assert.equal(park.consumeSimulationPhaseTimings(), null)
  park.setSimulationPhaseProfiling(true)
  park.tick(0.1)
  const tickTimings = park.consumeSimulationPhaseTimings()
  assert.ok(tickTimings)
  for (const id of ['nav', 'walk', 'festival', 'logistics', 'staff', 'visitors']) {
    assert.equal(typeof tickTimings.exclusive[id], 'number', `tick records exclusive ${id}`)
  }
  park.setSimulationPhaseProfiling(false)
  assert.equal(park.consumeSimulationPhaseTimings(), null)

  assert.equal(park.debugPathGraph().edges.length, 0, 'path graph stays empty while the flag is off')
  park.setPathGraphDebugEnabled(true)
  assert.ok(park.placePathSegment(4, 4, 0).ok)
  assert.ok(park.placePathSegment(5, 4, 0).ok)
  const graph = park.debugPathGraph()
  assert.ok(graph.revision.length > 0)
  assert.ok(
    graph.edges.some((edge) =>
      (edge.from.x === 4 && edge.to.x === 5 && edge.from.z === 4 && edge.to.z === 4) ||
      (edge.from.x === 5 && edge.to.x === 4 && edge.from.z === 4 && edge.to.z === 4),
    ),
    'adjacent path tiles form a debug graph edge',
  )
  park.setPathGraphDebugEnabled(false)
  assert.equal(park.debugPathGraph().edges.length, 0)
}
