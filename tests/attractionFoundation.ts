import assert from 'node:assert/strict'
import { addAreaCells, areaComponents, canPlaceAreaReference } from '../src/game/attractions/areaLayout'
import {
  resolveAttractionConstruction,
  validateAttractionCompletion,
} from '../src/game/attractions/construction'
import { createAttraction } from '../src/game/attractions/factory'
import { stepAttractions } from '../src/game/attractions/runtime'
import {
  addTrackEdge,
  emptyTrackGraph,
  orderTrackFromStart,
  removeTrackEdge,
  trackComponents,
  validateTrackGraph,
} from '../src/game/attractions/trackGraph'
import type {
  Attraction,
  TrackEdge,
  TrackGraph,
  TrackNode,
} from '../src/game/attractions/types'
import {
  CANONICAL_ATTRACTION_ID_PREFIX,
  crowdRiderIds,
  isCanonicalAttractionRecord,
  isLegacyAttractionId,
  isOrphanProjectionRecord,
  legacyAttractionIds,
  liveOwnerIds,
} from '../src/game/attractions/dualModel'
import {
  migrateCamping,
  migrateCoaster,
  migrateCourse,
  migratePartyAreas,
} from '../src/game/attractions/migration'
import {
  legacyAttractionSignature,
  projectCoasters,
  projectCourses,
  refreshLegacyAttractionRecords,
} from '../src/game/attractions/projections'
import { GameState, type GameSnapshot } from '../src/game/GameState'
import { courseNextBuildTarget, createEmptyCourse, createSeededCourse } from '../src/game/courseAttractions'
import { normalizeScenarioSettings } from '../src/game/scenario'
import { createBlankSnapshot } from '../src/game/snapshotBootstrap'
import { defaultStageDesign, stageDetailSize } from '../src/game/stageDesign'
import { applyGameCommand } from '../src/net/commands'
import { packWorld } from '../src/net/codec'
import { WorldUpdates } from '../src/net/worldUpdates'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import type { Visitor } from '../src/game/types/entities'
import type { ActionResult } from '../src/game/types/snapshot'

export function testAttractionFoundation(): void {
  testTrackDeleteAndReconnect()
  testTopologies()
  testConstructionParity()
  testAreaRulesAndWaterLanding()
  testRuntimeFunRewards()
  testDedicatedSystemsKeepTheirAttractions()
  testAttractionCommands()
  testCampingAndForecourtStayLive()
  testDualModel()
}

function testRuntimeFunRewards(): void {
  const queued = runtimeVisitor('queued')
  queued.state = 'queuing'
  queued.route = [{ x: 1, z: 0, elevation: 0 }]
  const mud = createAttraction('mud-fun', 'course:mudmasters', 0, 0, 0, 0)!
  if (mud.layout.kind !== 'track' || mud.runtime.kind !== 'course') throw new Error('mud runtime expected')
  mud.operationMode = 'open'
  mud.layout.graph = linearGraph()
  mud.queue.push(queued.id)

  const runner = runtimeVisitor('runner')
  runner.state = 'riding'
  mud.runtime.riders.push({
    visitorId: runner.id,
    pieceId: mud.layout.graph.edges.at(-1)!.id,
    progress: 0.99,
    airborne: false,
  })

  const slider = runtimeVisitor('slider')
  slider.state = 'riding'
  const waterSlide = createAttraction('slide-fun', 'waterSlide', 0, 0, 0, 0)!
  if (waterSlide.layout.kind !== 'track' || waterSlide.runtime.kind !== 'course') {
    throw new Error('water slide runtime expected')
  }
  waterSlide.operationMode = 'open'
  waterSlide.layout.graph = linearGraph()
  waterSlide.runtime.riders.push({
    visitorId: slider.id,
    pieceId: waterSlide.layout.graph.edges.at(-1)!.id,
    progress: 0.99,
    airborne: false,
  })

  const swimmer = runtimeVisitor('swimmer')
  swimmer.state = 'riding'
  const pool = createAttraction('pool-fun', 'swimArea', 0, 0, 0, 0)!
  if (pool.layout.kind !== 'area' || pool.runtime.kind !== 'course') throw new Error('pool runtime expected')
  pool.operationMode = 'open'
  pool.layout.cells = [{ x: 0, z: 0, elevation: 0 }]
  pool.runtime.riders.push({ visitorId: swimmer.id, pieceId: '', progress: 0.99, airborne: false })

  const fighter = runtimeVisitor('fighter')
  fighter.state = 'riding'
  const paintball = createAttraction('paint-fun', 'paintball', 0, 0, 0, 0)!
  if (paintball.layout.kind !== 'area' || paintball.runtime.kind !== 'course') throw new Error('paintball runtime expected')
  paintball.operationMode = 'open'
  paintball.layout.cells = [{ x: 0, z: 0, elevation: 0 }]
  paintball.runtime.riders.push({ visitorId: fighter.id, pieceId: '', progress: 0, airborne: false, team: 'a' })
  paintball.runtime.match = { remainingTicks: 1, scoreA: 0, scoreB: 0 }

  const carouselGuest = runtimeVisitor('carousel-guest')
  carouselGuest.state = 'riding'
  const carousel = createAttraction('carousel-fun', 'carousel', 0, 0, 0, 0)!
  if (carousel.runtime.kind !== 'scriptedRide') throw new Error('scripted runtime expected')
  carousel.operationMode = 'open'
  carousel.runtime.occupantIds = [carouselGuest.id]
  carousel.runtime.remainingMinutes = 1.19

  const visitors = [queued, runner, slider, swimmer, fighter, carouselGuest]
  stepAttractions([mud, waterSlide, pool, paintball, carousel], {
    visitors,
    simTick: 1,
    minutes: 0.1,
    charge: () => true,
    injure: () => undefined,
    isWater: () => true,
  })

  assert.equal(queued.needs.fun, 10, 'waiting in an attraction queue grants no fun')
  for (const visitor of [runner, slider, swimmer, fighter]) {
    assert.equal(visitor.needs.fun, 10 + SIMULATION_CONFIG.courses.funGain)
  }
  assert.equal(carouselGuest.needs.fun, 10 + SIMULATION_CONFIG.needs.ride.funGain)
}

/**
 * Coasters run on `CoasterSimulation` and courses on `stepCourses`. The shared
 * runtime must leave those alone, otherwise the same guest boards twice.
 */
function testDedicatedSystemsKeepTheirAttractions(): void {
  const guest = runtimeVisitor('legacy-guest')
  guest.state = 'queuing'
  const coaster = createAttraction('coaster-legacy', 'coaster:classicSteel', 0, 0, 0, 0)!
  if (coaster.runtime.kind !== 'coaster') throw new Error('coaster runtime expected')
  coaster.operationMode = 'open'
  coaster.queue.push(guest.id)
  guest.targetId = coaster.id

  stepAttractions([coaster], {
    visitors: [guest],
    simTick: 1,
    minutes: 0.1,
    charge: () => true,
    injure: () => undefined,
    isWater: () => false,
    legacyIds: new Set([coaster.id]),
  })
  assert.equal(coaster.queue.length, 1, 'a coaster driven by CoasterSimulation is not admitted here')
  assert.equal(coaster.runtime.train.passengerIds.length, 0)
  assert.equal(guest.state, 'queuing')
}

function testAttractionCommands(): void {
  const game = flatPark()
  // Paintball is a course: its live row belongs to the course editor, so the
  // canonical command refuses it instead of creating a record-only course.
  const refused = applyGameCommand(game, {
    type: 'startAttraction',
    definitionId: 'paintball',
    x: 4,
    z: 4,
    rotation: 0,
  })
  assert.equal(refused.ok, false, 'projection kinds are built in their own editors')
  assert.equal(game.snapshot.courses.length, 0)
  const started = applyGameCommand(game, {
    type: 'startAttraction',
    definitionId: 'bungee',
    x: 4,
    z: 4,
    rotation: 0,
  })
  assert.equal(started.ok, true, started.message)
  assert.ok(started.placedId)
  const attractionId = started.placedId!
  const changed = applyGameCommand(game, {
    type: 'constructAttraction',
    request: {
      kind: 'addScriptedSegment',
      attractionId,
      segmentKind: 'towerSegment',
    },
  })
  assert.equal(changed.ok, true, changed.message)
  const tower = game.getAttraction(attractionId)
  assert.equal(tower?.layout.kind, 'scripted')
  assert.equal(tower?.layout.kind === 'scripted' ? tower.layout.segments.length : 0, 2)
  const paintball = game.startCourseArea('paintball', [{ x: 8, z: 4 }, { x: 9, z: 4 }])
  assert.ok(paintball.ok && paintball.id, paintball.message)
  const client = new GameState()
  client.applyNetworkUpdate({
    attractions: structuredClone(game.snapshot.attractions),
  })
  assert.equal(client.snapshot.attractions.length, game.snapshot.attractions.length)
  assert.deepEqual(
    client.snapshot.courses.map((course) => course.id),
    [paintball.id],
    'an attractions-only delta adopts the missing course, never a canonical record',
  )
}

function testTrackDeleteAndReconnect(): void {
  let graph = emptyTrackGraph()
  const a = node('a', 0)
  const b = node('b', 1)
  const c = node('c', 2)
  const d = node('d', 3)
  graph = addTrackEdge(graph, edge('ab', a, b), a, b)
  graph = addTrackEdge(graph, edge('bc', b, c), b, c)
  graph = addTrackEdge(graph, edge('cd', c, d), c, d)
  graph.terminalNodeId = d.id
  const split = removeTrackEdge(graph, 'bc')
  assert.equal(trackComponents(split).length, 2, 'middle deletion keeps both track components')
  const reconnected = addTrackEdge(split, edge('bc-new', b, c), b, c)
  assert.equal(trackComponents(reconnected).length, 1)
  assert.deepEqual(orderTrackFromStart(reconnected).edgeIds, ['ab', 'bc-new', 'cd'])
  assert.equal(orderTrackFromStart(reconnected).complete, true)
}

function testTopologies(): void {
  const startEnd = linearGraph()
  assert.deepEqual(validateTrackGraph(startEnd, 'startEnd'), [])
  assert.deepEqual(validateTrackGraph(startEnd, 'shuttle'), [])
  assert.ok(validateTrackGraph(startEnd, 'closedLoop').some((issue) => issue.code === 'not-closed'))

  const closed = structuredClone(startEnd)
  const start = closed.nodes.find((candidate) => candidate.id === closed.startNodeId)!
  const end = closed.nodes.find((candidate) => candidate.id === closed.terminalNodeId)!
  closed.edges.push(edge('return', end, start))
  closed.terminalNodeId = start.id
  assert.deepEqual(validateTrackGraph(closed, 'closedLoop'), [])
  assert.deepEqual(validateTrackGraph(startEnd, 'openExit'), [])
}

function testConstructionParity(): void {
  const attraction = createAttraction('mud', 'course:mudmasters', 0, 0, 0, 1)!
  const from = node('from', 0)
  const to = node('to', 1)
  const request = {
    kind: 'addTrackEdge' as const,
    attractionId: attraction.id,
    edge: edge('path-1', from, to),
    from,
    to,
  }
  const preview = resolveAttractionConstruction(attraction, request)
  const authoritative = resolveAttractionConstruction(attraction, request)
  assert.deepEqual(preview, authoritative, 'preview and command use the same pure resolver')
}

function testAreaRulesAndWaterLanding(): void {
  const paintball = createAttraction('paint', 'paintball', 0, 0, 0, 0)!
  assert.equal(paintball.layout.kind, 'area')
  if (paintball.layout.kind !== 'area') return
  paintball.layout = addAreaCells(paintball.layout, [
    { x: 0, z: 0, elevation: 0 },
    { x: 1, z: 0, elevation: 0 },
    { x: 1, z: 1, elevation: 0 },
  ])
  assert.equal(areaComponents(paintball.layout.cells).length, 1)
  assert.equal(canPlaceAreaReference(paintball, {
    id: 'cover',
    kind: 'cover',
    x: 1,
    z: 0,
    elevation: 0,
    rotation: 0,
  }).ok, true)
  assert.equal(canPlaceAreaReference(paintball, {
    id: 'tree',
    kind: 'tree',
    x: 1,
    z: 0,
    elevation: 0,
    rotation: 0,
  }).ok, false)

  const water = createAttraction('water', 'swimArea', 0, 0, 0, 0)!
  if (water.layout.kind !== 'area') throw new Error('water area expected')
  water.layout.cells = [{ x: 2, z: 0, elevation: 0 }]
  water.access.entrance = { x: 2, z: 0, elevation: 0 }
  water.access.exit = { x: 2, z: 0, elevation: 0 }
  const slide = createAttraction('slide', 'waterSlide', 0, 0, 0, 1)!
  if (slide.layout.kind !== 'track') throw new Error('slide track expected')
  const a = node('slide-a', 0)
  const b = node('slide-b', 2)
  slide.layout.graph = addTrackEdge(slide.layout.graph, {
    ...edge('slide-edge', a, b),
    kind: 'waterSlide',
  }, a, b)
  slide.layout.graph.terminalNodeId = b.id
  slide.access.entrance = { x: 0, z: 0, elevation: 0 }
  assert.equal(validateAttractionCompletion(slide, [water, slide]).ok, true)
}

function linearGraph(): TrackGraph {
  let graph = emptyTrackGraph()
  const a = node('a', 0)
  const b = node('b', 1)
  const c = node('c', 2)
  graph = addTrackEdge(graph, edge('ab', a, b), a, b)
  graph = addTrackEdge(graph, edge('bc', b, c), b, c)
  graph.terminalNodeId = c.id
  return graph
}

function runtimeVisitor(id: string): Visitor {
  return {
    id,
    name: id,
    x: 0.5,
    y: 0,
    z: 0.5,
    cellX: 0,
    cellZ: 0,
    cellElevation: 0,
    state: 'exploring',
    targetId: null,
    route: [],
    needs: { fun: 10, hunger: 70, thirst: 70, toilet: 70, energy: 70 },
  } as Visitor
}

function node(id: string, x: number): TrackNode {
  return {
    id,
    anchor: { x, z: 0, elevation: 0, heading: 0, pitch: 0, bank: 0 },
  }
}

function edge(id: string, from: TrackNode, to: TrackNode): TrackEdge {
  return {
    id,
    kind: 'path',
    fromNodeId: from.id,
    toNodeId: to.id,
    points: [
      { x: from.anchor.x, z: from.anchor.z, elevation: from.anchor.elevation },
      { x: to.anchor.x, z: to.anchor.z, elevation: to.anchor.elevation },
    ],
    cost: 10,
  }
}

function testCampingAndForecourtStayLive(): void {
  const game = new GameState()
  game.addDebugMoney()
  const campCells = [{ x: 4, z: -10 }, { x: 5, z: -10 }]
  assert.ok(applyGameCommand(game, { type: 'designateCampingArea', cells: campCells }).ok)
  assert.ok(game.getCampingCellAt(4, -10))
  assert.equal(game.canPlace('food', 4, -10).ok, false, 'food stays off a camping overlay')
  assert.match(game.canPlace('food', 4, -10).message, /Zeltbereich/)
  assert.equal(game.canPlace('path', 4, -10).ok, false, 'paths stay off a camping overlay')
  assert.equal(game.canPlace('totem', 4, -10).ok, false, 'scenery stays off a camping overlay')
  assert.equal(game.canPlace('fence', 4, -10).ok, true, 'construction fence remains the camping exception')
  assert.ok(
    game.snapshot.attractions.some((attraction) => attraction.definitionId === 'camping'),
    'designate writes the camping overlay back onto attractions',
  )

  const started = applyGameCommand(game, {
    type: 'startAttraction',
    definitionId: 'bungee',
    x: 8,
    z: -8,
    rotation: 0,
  })
  assert.ok(started.ok, started.message)
  assert.ok(game.getCampingCellAt(4, -10), 'attraction commands must not drop designated camping')
  assert.equal(game.canPlace('food', 4, -10).ok, false)

  const reloaded = GameState.fromJSON(JSON.stringify(game.snapshot))!
  assert.ok(reloaded.getCampingCellAt(4, -10), 'save/load keeps camping when attractions exist')
  assert.equal(reloaded.canPlace('food', 4, -10).ok, false)
  assert.ok(reloaded.snapshot.attractions.some((attraction) => attraction.definitionId === 'camping'))

  const client = new GameState()
  client.applyNetworkUpdate({ campingCells: structuredClone(game.snapshot.campingCells) })
  assert.ok(client.getCampingCellAt(4, -10))
  client.applyNetworkUpdate({ attractions: structuredClone(game.snapshot.attractions) })
  assert.ok(client.getCampingCellAt(4, -10), 'MP attraction deltas must not wipe camping cells')
  assert.equal(client.canPlace('totem', 4, -10).ok, false)

  const guest = new GameState()
  const sync = JSON.parse(new WorldUpdates().encode(packWorld(game.snapshot), true)) as {
    world: Parameters<GameState['applyNetworkUpdate']>[0]
  }
  guest.applyNetworkUpdate(sync.world)
  assert.ok(guest.getCampingCellAt(5, -10), 'full MP sync carries camping cells')

  const stageDesign = defaultStageDesign()
  Object.assign(
    stageDesign,
    { tileWidth: 3, tileDepth: 3, forecourtDepth: 4 },
    stageDetailSize(3, 3, stageDesign.tileHeight),
  )
  assert.ok(game.manageFestival({ type: 'stageDesign', design: stageDesign, selectForBuild: true }).ok)
  for (let x = 6; x < 9; x++) {
    for (let z = -20; z < -12; z++) {
      game.manageFestival({ type: 'ground', x, z, kind: 'drain' })
      game.manageFestival({ type: 'ground', x, z, kind: 'compact' })
    }
  }
  assert.ok(game.place('stage', 6, -20).ok)
  const stage = game.snapshot.buildings.find((building) => building.kind === 'stage')!
  const owned = game.snapshot.stageForecourtCells.filter((cell) => cell.stageId === stage.id)
  assert.ok(owned.length > 0, 'placing a stage still paints its apron')
  const apron = owned[0]!
  assert.equal(game.canPlace('food', apron.x, apron.z).ok, false, 'food stays off the stage apron')
  assert.match(game.canPlace('food', apron.x, apron.z).message, /Bühnenvorplatz/)
  assert.equal(game.canPlace('path', apron.x, apron.z).ok, false)
  assert.equal(game.canPlace('totem', apron.x, apron.z).ok, false)
  assert.equal(game.canPlace('fence', apron.x, apron.z).ok, true, 'construction fence remains the apron exception')
  assert.equal(game.canPlace('delayTower', apron.x, apron.z).ok, true, 'delay towers may stand in the crowd')

  const preview = game.previewPlacement({ type: 'tool', tool: 'stageForecourt', x: 3, z: -14 })
  assert.equal(preview.ok, true, 'forecourt preview uses the designate dry-run')
  assert.match(preview.message, /Bühnenvorplatz/)
  assert.ok(
    applyGameCommand(game, { type: 'designateStageForecourt', cells: [{ x: 3, z: -14 }] }).ok,
  )
  assert.ok(game.getStageForecourtCellAt(3, -14))
  assert.equal(game.canPlace('food', 3, -14).ok, false)
  assert.equal(
    game.previewPlacement({ type: 'tool', tool: 'stageForecourt', x: 3, z: -14 }).ok,
    false,
  )

  assert.ok(applyGameCommand(game, {
    type: 'constructAttraction',
    request: {
      kind: 'addScriptedSegment',
      attractionId: started.placedId!,
      segmentKind: 'towerSegment',
    },
  }).ok)
  assert.equal(
    game.snapshot.stageForecourtCells.filter((cell) => cell.stageId === stage.id).length,
    owned.length,
    'attraction edits must not drop the stage apron',
  )
  assert.ok(game.getStageForecourtCellAt(3, -14), 'manual forecourt survives attraction edits')
  assert.equal(game.canPlace('food', apron.x, apron.z).ok, false)

  const afterEdit = GameState.fromJSON(JSON.stringify(game.snapshot))!
  assert.equal(
    afterEdit.snapshot.stageForecourtCells.filter((cell) => cell.stageId === stage.id).length,
    owned.length,
    'load keeps the rebuilt stage apron',
  )
  assert.ok(afterEdit.getStageForecourtCellAt(3, -14), 'load keeps a manual forecourt designation')
  assert.equal(afterEdit.canPlace('food', 3, -14).ok, false)

  const forecourtGuest = new GameState()
  forecourtGuest.applyNetworkUpdate({
    attractions: structuredClone(game.snapshot.attractions),
    stageForecourtCells: structuredClone(game.snapshot.stageForecourtCells),
    buildings: structuredClone(game.snapshot.buildings),
  })
  assert.ok(forecourtGuest.getStageForecourtCellAt(3, -14), 'MP sync carries manual forecourt cells')
  assert.equal(forecourtGuest.canPlace('food', apron.x, apron.z).ok, false)
}

// ---------------------------------------------------------------------------
// Attraction dual model (docs/attractions.md, "Doppelmodell"): coasters and
// courses are the edited and ticked truth, `attractions` records with the same
// id are a derived projection. These tests freeze that contract.
// ---------------------------------------------------------------------------

function testDualModel(): void {
  testSignatureDetectsEveryEditClass()
  testCoasterEditsKeepTheDualModel()
  testSignatureSurvivesLargeParks()
  testCourseEditsKeepTheDualModel()
  testCourseIdsNeverCollide()
  testProjectionRecordsNeverOutliveTheirOwner()
  testNothingIsSimulatedTwice()
  testLegacyGuestsRideOnce()
  testCrowdRidersIgnoreProjectionRecords()
  testQueueClaimsFollowTheLiveEntrance()
  testSharedQueueKeepsItsClaimOrder()
  testSaveRoundTripKeepsTheDualModel()
  testVersionOneParkKeepsTheDualModel()
  testCollidingIdsAreRepairedOnLoad()
  testMultiplayerKeepsLiveRows()
  testCanonicalCommandsRefuseLegacyIds()
  testNewCanonicalKindsAreNoOrphans()
  testProjectionLossesArePinned()
}

const RECTANGLE_CIRCUIT = [
  'curveRight2',
  'straight',
  'curveRight2',
  'straight',
  'curveRight2',
  'straight',
  'curveRight2',
] as const

function flatPark(): GameState {
  const game = new GameState(
    createBlankSnapshot(normalizeScenarioSettings({ worldSize: 48, unevenness: 0, startingMoney: 500_000 })),
  )
  game.addDebugMoney()
  return game
}

function structuralJson(record: Attraction | null | undefined): string | undefined {
  if (!record) return undefined
  const { definitionId, name, layout, access, operationMode, price } = record
  return JSON.stringify({ definitionId, name, layout, access, operationMode, price })
}

/**
 * The frozen contract: unique ids; every coaster and course that projects has
 * exactly one record equal to its projection (and none when it does not); no
 * coaster/course record without its live owner; no migrated ride record without
 * its building; camping/party records equal to the live overlays.
 */
function assertDualModel(game: GameState, label: string, options: { overlays?: boolean } = {}): void {
  const state = game.snapshot
  const liveIds = [...state.coasters.map((coaster) => coaster.id), ...state.courses.map((course) => course.id)]
  assert.equal(new Set(liveIds).size, liveIds.length, `${label}: coaster and course ids are unique`)
  const recordIds = state.attractions.map((record) => record.id)
  assert.equal(new Set(recordIds).size, recordIds.length, `${label}: record ids are unique`)
  const byId = new Map(state.attractions.map((record) => [record.id, record]))
  for (const coaster of state.coasters) {
    assert.equal(
      structuralJson(byId.get(coaster.id)),
      structuralJson(migrateCoaster(coaster)),
      `${label}: record of coaster ${coaster.id} follows its live row`,
    )
  }
  for (const course of state.courses) {
    assert.equal(
      structuralJson(byId.get(course.id)),
      structuralJson(migrateCourse(course).find((entry) => entry.id === course.id)),
      `${label}: record of course ${course.id} follows its live row`,
    )
  }
  const legacyIds = legacyAttractionIds(state)
  const rides = new Set(state.buildings.filter((building) => building.kind === 'ride').map((building) => building.id))
  for (const record of state.attractions) {
    if (record.runtime.kind === 'coaster' || record.runtime.kind === 'course') {
      assert.ok(isLegacyAttractionId(record.id, legacyIds), `${label}: ${record.id} keeps its live owner`)
    }
    if (record.runtime.kind === 'scriptedRide' && !record.id.startsWith(CANONICAL_ATTRACTION_ID_PREFIX)) {
      assert.ok(rides.has(record.id), `${label}: ride record ${record.id} keeps its building`)
    }
    if (record.definitionId !== 'camping' && record.definitionId !== 'partyArea') {
      assert.equal(
        isCanonicalAttractionRecord(record),
        !isLegacyAttractionId(record.id, legacyIds),
        `${label}: shape check and legacy-id rule agree on ${record.id}`,
      )
    }
  }
  if (options.overlays === false) return
  assert.equal(
    JSON.stringify(state.attractions.filter((record) => record.definitionId === 'camping')),
    JSON.stringify(migrateCamping(state.campingCells, state.campInstallations) ?? []),
    `${label}: camping record equals the live overlay`,
  )
  assert.equal(
    JSON.stringify(state.attractions.filter((record) => record.definitionId === 'partyArea')),
    JSON.stringify(migratePartyAreas(state.stageForecourtCells)),
    `${label}: party records equal the live forecourt`,
  )
}

function stepper(game: GameState, label: string): (name: string, result?: ActionResult | void) => void {
  return (name, result) => {
    if (result) assert.ok(result.ok, `${label} ${name}: ${result.message}`)
    assertDualModel(game, `${label} ${name}`)
  }
}

/**
 * Start, append, undo, delete, close the loop, set and move the entrance, set
 * the exit, open → test, price and dispatch, checking the contract after every
 * command. Entrance move and open → test were invisible to the old signature.
 */
function buildCircuitCoaster(game: GameState, label: string): string {
  const step = stepper(game, label)
  const started = game.startCoaster('classicSteel', 10, -10)
  step('start', started)
  const id = started.id!
  step('append curve', game.appendCoasterPiece(id, 'curveRight2', false))
  step('append straight', game.appendCoasterPiece(id, 'straight', false))
  step('append second curve', game.appendCoasterPiece(id, 'curveRight2', false))
  step('undo', game.undoCoasterPiece(id))
  step('delete', game.deleteCoasterPiece(id, 2))
  for (const kind of RECTANGLE_CIRCUIT.slice(1)) step(`close with ${kind}`, game.appendCoasterPiece(id, kind, false))
  assert.equal(game.getCoaster(id)!.closed, true, `${label}: the rectangle closes`)
  step('entrance', game.setCoasterAccess(id, 'entrance', 11, -10))
  step('move entrance', game.setCoasterAccess(id, 'entrance', 10, -11))
  const entrance = game.getAttraction(id)?.access.entrance
  assert.deepEqual([entrance?.x, entrance?.z], [10, -11], `${label}: a moved entrance reaches the record`)
  step('exit', game.setCoasterAccess(id, 'exit', 9, -10))
  step('open', game.setCoasterOperationMode(id, 'open'))
  step('test', game.setCoasterOperationMode(id, 'test'))
  assert.equal(game.getAttraction(id)?.operationMode, 'test', `${label}: open → test reaches the record`)
  game.updateCoasterPrice(id, 7.5)
  step('price')
  game.updateCoasterSettings(id, 'timed', 2)
  step('dispatch')
  return id
}

function testCoasterEditsKeepTheDualModel(): void {
  const game = flatPark()
  const id = buildCircuitCoaster(game, 'coaster')
  const tick = game.snapshot.simTick
  for (let step = 0; step < 30; step += 1) game.tick(0.1)
  assert.ok(game.snapshot.simTick > tick, 'the test run actually ticks')
  // Ticks never refresh records; their structural fields must still match.
  assertDualModel(game, 'coaster after ticks', { overlays: false })
  assert.ok(game.bulldoze(10, -10).ok, 'bulldozing the station removes the coaster')
  assert.equal(game.getCoaster(id), undefined)
  assert.equal(game.getAttraction(id), undefined, 'bulldozing the station drops the record')
  assertDualModel(game, 'coaster bulldozed')
}

/**
 * The old float `*31` signature turned into ±Infinity after ~205 steps, so a
 * park with a few hundred camping cells never refreshed a record again.
 */
function testSignatureSurvivesLargeParks(): void {
  const game = flatPark()
  const cells: Array<{ x: number; z: number }> = []
  for (let x = -22; x < -2; x += 1) for (let z = 4; z < 20; z += 1) cells.push({ x, z })
  assert.ok(applyGameCommand(game, { type: 'designateCampingArea', cells }).ok)
  assert.ok(game.snapshot.campingCells.length >= 300, 'the park carries at least 300 camping cells')
  assertDualModel(game, 'large park camping')
  buildCircuitCoaster(game, 'large park coaster')
  assert.ok(Number.isFinite(legacyAttractionSignature(game.snapshot)))
}

function testSignatureDetectsEveryEditClass(): void {
  const game = flatPark()
  const coasterId = game.startCoaster('classicSteel', 10, -10).id!
  assert.ok(game.appendCoasterPiece(coasterId, 'curveRight2', false).ok)
  assert.ok(game.setCoasterAccess(coasterId, 'entrance', 11, -10).ok)
  assert.ok(game.setCoasterAccess(coasterId, 'exit', 10, -11).ok)
  const mud = game.startCourse('mudmasters', 4, 6).id!
  const next = courseNextBuildTarget(game.getCourse(mud)!, 'path', 1, 0)!
  assert.ok(game.addCoursePiece(mud, 'path', next.x, next.z, next.elevation).ok)
  assert.ok(game.startCourseArea('pool', [{ x: 12, z: 6 }, { x: 13, z: 6 }]).ok)
  const base = structuredClone(game.snapshot) as GameSnapshot
  base.coasters[0]!.operationMode = 'open'
  base.campingCells = Array.from({ length: 1000 }, (_, index) => ({
    x: index % 40 - 20,
    z: 5 + Math.floor(index / 40),
    elevation: 0,
  }))
  base.campInstallations = [{
    id: 'tent-1',
    kind: 'tent',
    cell: { x: 1, z: 5, elevation: 0 },
    ownerId: 'guest-1',
    contributorIds: ['guest-1'],
  }]
  base.stageForecourtCells = Array.from({ length: 1000 }, (_, index) => ({
    x: index % 40 - 20,
    z: -5 - Math.floor(index / 40),
    elevation: 0,
    stageId: index < 500 ? 'stage-a' : 'stage-b',
  }))
  const signature = legacyAttractionSignature(base)
  assert.ok(Number.isInteger(signature) && signature >= 0 && signature <= 0xffffffff, 'a finite 32-bit hash')
  assert.equal(legacyAttractionSignature(structuredClone(base)), signature, 'the signature is deterministic')
  const edits: Array<[string, (state: GameSnapshot) => void]> = [
    ['coaster count', (state) => { state.coasters.pop() }],
    ['coaster piece id', (state) => { state.coasters[0]!.pieces[1]!.id = 'renamed-piece' }],
    ['coaster piece kind', (state) => { state.coasters[0]!.pieces[1]!.kind = 'straight' }],
    ['coaster piece position', (state) => { state.coasters[0]!.pieces[1]!.end.x += 1 }],
    ['coaster piece elevation', (state) => { state.coasters[0]!.pieces[1]!.start.elevation += 0.5 }],
    ['entrance move', (state) => { state.coasters[0]!.entrance!.x += 1 }],
    ['exit move', (state) => { state.coasters[0]!.exit!.z -= 1 }],
    ['open → test', (state) => { state.coasters[0]!.operationMode = 'test' }],
    ['coaster price', (state) => { state.coasters[0]!.ticketPrice += 0.5 }],
    ['coaster name', (state) => { state.coasters[0]!.name += ' II' }],
    ['coaster type', (state) => { state.coasters[0]!.typeId = 'wooden' }],
    ['dispatch', (state) => { state.coasters[0]!.settings.dispatchIntervalMinutes += 1 }],
    ['course count', (state) => { state.courses.pop() }],
    ['course piece id', (state) => { state.courses[0]!.pieces[0]!.id = 'renamed-course-piece' }],
    ['course piece kind', (state) => { state.courses[0]!.pieces[1]!.kind = 'climbWall' }],
    ['course piece position', (state) => { state.courses[0]!.pieces[1]!.x += 1 }],
    ['course area cell', (state) => { state.courses[1]!.areaCells[0]!.x -= 1 }],
    ['course operating', (state) => { state.courses[0]!.operating = !state.courses[0]!.operating }],
    ['course price', (state) => { state.courses[0]!.price += 1 }],
    ['course team size', (state) => { state.courses[1]!.teamSize = 3 }],
    ['course name', (state) => { state.courses[0]!.name += ' II' }],
    ['camping cell', (state) => { state.campingCells[999]!.z += 1 }],
    ['camping installation position', (state) => { state.campInstallations[0]!.cell.x += 1 }],
    ['camping installation id', (state) => { state.campInstallations[0]!.id = 'tent-2' }],
    ['forecourt cell', (state) => { state.stageForecourtCells[999]!.x += 1 }],
    ['forecourt stage', (state) => { state.stageForecourtCells[10]!.stageId = 'stage-b' }],
  ]
  for (const [name, edit] of edits) {
    const copy = structuredClone(base)
    edit(copy)
    const changed = legacyAttractionSignature(copy)
    assert.ok(Number.isFinite(changed), `${name}: the signature stays finite`)
    assert.notEqual(changed, signature, `${name} changes the signature`)
  }
}

function testCourseEditsKeepTheDualModel(): void {
  const game = flatPark()
  const step = stepper(game, 'course')
  const started = game.startCourse('mudmasters', 4, 6)
  step('start', started)
  const mud = started.id!
  for (let index = 0; index < 2; index += 1) {
    const next = courseNextBuildTarget(game.getCourse(mud)!, 'path', 1, 0)!
    step(`path ${index + 1}`, game.addCoursePiece(mud, 'path', next.x, next.z, next.elevation))
  }
  step('undo', game.undoCoursePiece(mud))
  const pool = game.startCourseArea('pool', [{ x: 12, z: 6 }, { x: 13, z: 6 }])
  step('pool', pool)
  step('pool cells', game.addCourseAreaCells(pool.id!, [{ x: 14, z: 6 }, { x: 12, z: 7 }]))
  step('pool cell removed', game.removeCourseAreaCells(pool.id!, [{ x: 14, z: 6 }]))
  step('pool entrance', game.addCoursePiece(pool.id!, 'entrance', 12, 6))
  const paintball = game.startCourseArea('paintball', [
    { x: 4, z: 12 },
    { x: 5, z: 12 },
    { x: 4, z: 13 },
    { x: 5, z: 13 },
  ])
  step('paintball', paintball)
  step('team size', game.setCourseTeamSize(paintball.id!, 3))
  step('closed', game.setCourseOperating(mud, false))
  step('price', game.setCoursePrice(mud, 9))
  step('camping', applyGameCommand(game, { type: 'designateCampingArea', cells: [{ x: -6, z: 8 }, { x: -5, z: 8 }] }))
  step('forecourt', applyGameCommand(game, { type: 'designateStageForecourt', cells: [{ x: 3, z: -14 }] }))
  step('remove paintball', game.removeCourse(paintball.id!))
  assert.equal(game.getAttraction(paintball.id!), undefined, 'removeCourse drops the record')
}

/** Ids used to be `course-${simTick}-${courses.length + 1}` and repeated while paused. */
function testCourseIdsNeverCollide(): void {
  const game = flatPark()
  const a = game.startCourse('mudmasters', 2, 2).id!
  const b = game.startCourse('mudmasters', 2, 8).id!
  assert.ok(game.removeCourse(a).ok)
  const c = game.startCourse('mudmasters', 2, 14).id!
  assert.equal(new Set([a, b, c]).size, 3, 'start A, B, remove A, start C gives three ids')
  assert.ok(game.removeCourse(b).ok)
  assert.ok(game.getCourse(c), 'removing B leaves C alone')
  assertDualModel(game, 'course ids')

  const reloaded = GameState.fromJSON(JSON.stringify(game.snapshot))!
  const d = reloaded.startCourse('mudmasters', 8, 14).id!
  const coaster = reloaded.startCoaster('classicSteel', -10, -10).id!
  assert.equal(new Set([c, d, coaster]).size, 3, 'a reload never hands out a taken id')
  assertDualModel(reloaded, 'course ids after reload')

  // Course ids derive from the synced state, not from a per-process counter:
  // an optimistic client names the course like the host, so the follow-up
  // piece commands it sends find the host's course.
  const guest = new GameState()
  guest.applyNetworkWorld(JSON.parse(new WorldUpdates().encode(packWorld(game.snapshot), true)).world)
  const hostCourse = game.startCourse('mudmasters', 14, 14).id!
  const guestCourse = guest.startCourse('mudmasters', 14, 14).id
  assert.equal(guestCourse, hostCourse, 'host and optimistic client derive the same course id')
}

function placeRideBuilding(game: GameState, x: number, z: number): string {
  for (const kind of ['drain', 'compact', 'pave'] as const) game.manageFestival({ type: 'ground', x, z, kind })
  const placed = game.place('ride', x, z)
  assert.ok(placed.ok, placed.message)
  return game.snapshot.buildings.at(-1)!.id
}

/** Loads the park through the v30 path, which migrates `ride` buildings to scripted records. */
function loadAsV30(game: GameState): GameState {
  const legacy = JSON.parse(JSON.stringify(game.snapshot)) as GameSnapshot & { version: number }
  legacy.version = 30
  legacy.attractions = []
  return GameState.fromJSON(JSON.stringify(legacy))!
}

function testProjectionRecordsNeverOutliveTheirOwner(): void {
  const game = flatPark()
  const mud = game.startCourse('mudmasters', 2, 2).id!
  assert.ok(game.getAttraction(mud))
  assert.ok(game.undoCoursePiece(mud).ok)
  assert.equal(game.getCourse(mud), undefined)
  assert.equal(game.getAttraction(mud), undefined, 'undo to empty drops the record')
  assertDualModel(game, 'undo to empty')

  const rideId = placeRideBuilding(game, 16, 10)
  const migrated = loadAsV30(game)
  assert.equal(migrated.getAttraction(rideId)?.definitionId, 'carousel', 'v30 loads migrate ride buildings')
  assertDualModel(migrated, 'v30 ride')
  const withoutBuilding = JSON.parse(JSON.stringify(migrated.snapshot)) as GameSnapshot
  withoutBuilding.buildings = withoutBuilding.buildings.filter((building) => building.id !== rideId)
  const repaired = GameState.fromJSON(JSON.stringify(withoutBuilding))!
  assert.equal(repaired.getAttraction(rideId), undefined, 'a ride record without its building is dropped on load')
  assertDualModel(repaired, 'ride record repaired')
  assert.ok(migrated.bulldoze(16, 10, rideId).ok)
  assert.equal(migrated.getAttraction(rideId), undefined, 'bulldozing the ride drops its migrated record')
  assertDualModel(migrated, 'ride bulldozed')

  const legacyPool = createSeededCourse('legacy-pool', 'pool', -12, -12)
  legacyPool.pieces.push({ id: 'legacy-pool-ws', kind: 'waterSlide', x: -12, z: -8, elevation: 2, rotation: 0 })
  const withPool = JSON.parse(JSON.stringify(game.snapshot)) as GameSnapshot
  withPool.courses = [legacyPool]
  const pools = GameState.fromJSON(JSON.stringify(withPool))!
  assert.ok(pools.getCourse('legacy-pool-slide-1'), 'a legacy pool slide becomes its own course')
  assertDualModel(pools, 'pool with slide')
  assert.ok(pools.removeCourse('legacy-pool').ok)
  assert.equal(pools.getAttraction('legacy-pool'), undefined)
  assert.ok(pools.getAttraction('legacy-pool-slide-1'), 'the live slide course keeps its record')
  assertDualModel(pools, 'pool removed')

  const host = flatPark()
  const course = host.startCourse('mudmasters', 2, 2).id!
  const guest = new GameState()
  guest.networkMode = 'client'
  const full = JSON.parse(new WorldUpdates().encode(packWorld(host.snapshot), true)) as {
    world: Parameters<GameState['applyNetworkWorld']>[0]
  }
  guest.applyNetworkWorld(full.world)
  assert.ok(guest.getAttraction(course))
  assert.ok(guest.removeCourse(course).ok)
  assert.equal(guest.getAttraction(course), undefined, 'an optimistic client remove drops the record too')
}

/**
 * One legacy-id rule for every reader. The GameState's own set must keep
 * `stepAttractions` off every coaster, course, ride and pool-slide record.
 */
function testNothingIsSimulatedTwice(): void {
  const game = flatPark()
  const coasterId = buildCircuitCoaster(game, 'double simulation')
  const courseId = game.startCourse('mudmasters', 4, 6).id!
  const rideId = placeRideBuilding(game, 16, 10)
  const bungee = game.startAttraction('bungee', -16, 16, 0)
  assert.ok(bungee.ok && bungee.placedId, bungee.message)
  const ids = legacyAttractionIds(game.snapshot)
  for (const id of [coasterId, courseId, rideId, `${courseId}-slide-2`]) {
    assert.ok(isLegacyAttractionId(id, ids), `${id} belongs to a dedicated system`)
  }
  assert.equal(isLegacyAttractionId(`${courseId}-slide-x`, ids), false, 'only numbered slides belong to a pool')
  assert.equal(isLegacyAttractionId(bungee.placedId!, ids), false, 'canonical records are not legacy')

  const world = structuredClone(game.snapshot) as GameSnapshot
  world.attractions.push({ ...structuredClone(world.attractions.find((record) => record.id === courseId)!), id: `${courseId}-slide-2` })
  const visitors = world.attractions.map((record) => {
    record.operationMode = 'open'
    const guest = runtimeVisitor(`guest-for-${record.id}`)
    guest.state = 'queuing'
    guest.targetId = record.id
    record.queue = [guest.id]
    return guest
  })
  stepAttractions(world.attractions, {
    legacyIds: legacyAttractionIds(world),
    visitors,
    simTick: 1,
    minutes: 0.1,
    charge: () => true,
    injure: () => undefined,
    isWater: () => false,
  })
  const riding = visitors.filter((guest) => guest.state === 'riding').map((guest) => guest.targetId)
  assert.deepEqual(riding, [bungee.placedId], 'only the canonical record admits guests')

  for (let step = 0; step < 20; step += 1) {
    game.tick(0.1)
    const legacyIds = legacyAttractionIds(game.snapshot)
    for (const record of game.snapshot.attractions) {
      if (record.runtime.kind !== 'coaster' && record.runtime.kind !== 'course') continue
      assert.ok(isLegacyAttractionId(record.id, legacyIds), `tick ${step}: ${record.id} stays with its live system`)
    }
  }
}

/** A park in its festival phase at noon, so the `rides` offer is active. */
function festivalPark(): GameState {
  const initial = createBlankSnapshot(normalizeScenarioSettings({ worldSize: 48, unevenness: 0, startingMoney: 500_000 }))
  initial.festival.planning = false
  initial.parkOpen = true
  initial.dayPlan.leadDays = 0
  initial.minute = 12 * 60
  initial.scenario.carArrivalShare = 0
  const game = new GameState(initial)
  game.addDebugMoney()
  return game
}

/** A generated guest placed on a cell and bound to `targetId` in the given state. */
function spawnGuest(
  game: GameState,
  cell: { x: number; z: number },
  targetId: string,
  state: Visitor['state'],
): Visitor {
  // Day guests only arrive at festival times; open them for this one spawn.
  const snapshot = game.snapshot
  const clock = { leadDays: snapshot.dayPlan.leadDays, minute: snapshot.minute, parkOpen: snapshot.parkOpen }
  snapshot.dayPlan.leadDays = 0
  snapshot.minute = 12 * 60
  snapshot.parkOpen = true
  const guest = game.spawnVisitorMember('day', `dual-model-${targetId}-${snapshot.visitors.length}`, 'pedestrian', false)
  snapshot.dayPlan.leadDays = clock.leadDays
  snapshot.minute = clock.minute
  snapshot.parkOpen = clock.parkOpen
  assert.ok(guest, 'the park spawns a guest')
  Object.assign(guest, {
    x: cell.x + 0.5,
    y: 0,
    z: cell.z + 0.5,
    cellX: cell.x,
    cellZ: cell.z,
    cellElevation: 0,
    state,
    targetId,
    route: [],
    budget: 500,
  })
  guest.needs.fun = 10
  return guest
}

/**
 * Tick level: a guest queued on an open closed-loop coaster and one queued on
 * a course each pay once and finish their ride through the dedicated system.
 * The stale runtime copies in their records (a queue entry, a rider on the
 * track) are exactly what `stepAttractions` would admit from and advance if it
 * ran a legacy record; they must stay untouched.
 */
function testLegacyGuestsRideOnce(): void {
  const game = festivalPark()
  assert.ok(game.isOfferCurrentlyActive('rides'), 'rides are open at noon on a festival day')
  const coasterId = game.startCoaster('classicSteel', 10, -10).id!
  for (const kind of RECTANGLE_CIRCUIT) assert.ok(game.appendCoasterPiece(coasterId, kind, false).ok)
  assert.ok(game.setCoasterAccess(coasterId, 'entrance', 10, -11).ok)
  assert.ok(game.setCoasterAccess(coasterId, 'exit', 9, -10).ok)
  assert.ok(game.placePathSegment(10, -12, 0, 'queue').ok)
  assert.ok(game.setCoasterOperationMode(coasterId, 'open').ok)
  game.updateCoasterSettings(coasterId, 'timed', 0.5)
  const course = createSeededCourse('course-seeded', 'mudmasters', 20, 10)
  game.snapshot.courses.push(course)
  assert.ok(game.setCoursePrice(course.id, 4).ok)
  const coaster = game.getCoaster(coasterId)!
  const rider = spawnGuest(game, { x: 10, z: -12 }, coasterId, 'queuing')
  const walker = spawnGuest(game, { x: 20, z: 10 }, course.id, 'queuing')
  coaster.queue.push(rider.id)
  course.queue.push(walker.id)

  const coasterRecord = game.getAttraction(coasterId)!
  const courseRecord = game.getAttraction(course.id)!
  if (courseRecord.runtime.kind !== 'course' || courseRecord.layout.kind !== 'track') {
    throw new Error('mudmasters projects to a track course record')
  }
  coasterRecord.queue = [rider.id]
  courseRecord.queue = [walker.id]
  courseRecord.runtime.riders = [{
    visitorId: walker.id,
    pieceId: courseRecord.layout.graph.edges[0]!.id,
    progress: 0.9,
    airborne: false,
  }]
  const staleCopies = JSON.stringify([coasterRecord.queue, courseRecord.queue, courseRecord.runtime.riders])

  const charges: Array<{ visitorId: string; amount: number; x: number; z: number }> = []
  const host = game as unknown as {
    chargeVisitor: (visitor: Visitor, amount: number, position: { x: number; y: number; z: number }) => boolean
  }
  const charge = host.chargeVisitor.bind(game)
  host.chargeVisitor = (visitor, amount, position) => {
    charges.push({ visitorId: visitor.id, amount, x: position.x, z: position.z })
    return charge(visitor, amount, position)
  }
  for (let step = 0; step < 200; step += 1) game.tick(0.1)

  const paid = (guest: Visitor) => charges.filter((entry) => entry.visitorId === guest.id)
  assert.deepEqual(
    paid(rider),
    [{ visitorId: rider.id, amount: coaster.ticketPrice, x: 10.5, z: -10.5 }],
    'the coaster guest pays once, at the entrance, through CoasterSimulation',
  )
  assert.deepEqual(paid(walker).map((entry) => entry.amount), [4], 'the course guest pays once through stepCourses')
  for (const guest of [rider, walker]) {
    assert.ok(guest.state !== 'queuing' && guest.state !== 'riding', `${guest.id} finished the ride (${guest.state})`)
  }
  assert.ok(rider.needs.fun > 10, 'the finished coaster ride grants fun')
  assert.equal(
    JSON.stringify([coasterRecord.queue, courseRecord.queue, courseRecord.runtime.riders]),
    staleCopies,
    'stepAttractions never admits from or advances a legacy record',
  )
}

/** The `WorldView` rider set reads live course riders and canonical records only. */
function testCrowdRidersIgnoreProjectionRecords(): void {
  const game = flatPark()
  const courseId = game.startCourse('mudmasters', 4, 6).id!
  const bungee = game.startAttraction('bungee', -16, 16, 0).placedId!
  const course = game.getCourse(courseId)!
  course.riders = [{ visitorId: 'walker', pieceId: course.pieces[0]!.id, progress: 0, airborne: false }]
  const courseRecord = game.getAttraction(courseId)!
  const bungeeRecord = game.getAttraction(bungee)!
  if (courseRecord.runtime.kind !== 'course' || bungeeRecord.runtime.kind !== 'scriptedRide') {
    throw new Error('course and scripted records expected')
  }
  courseRecord.runtime.riders = [{ visitorId: 'finished', pieceId: '', progress: 0, airborne: false }]
  bungeeRecord.runtime.occupantIds = ['jumper']
  const riders = crowdRiderIds(game.snapshot, legacyAttractionIds(game.snapshot))
  assert.deepEqual([...riders].sort(), ['jumper', 'walker'], 'a stale projection rider stays hidden')
}

/** `recalculateQueueDirections` runs before `emit`; a lagging record must not claim queues. */
function testQueueClaimsFollowTheLiveEntrance(): void {
  const game = flatPark()
  const started = game.startCoaster('classicSteel', 10, -10)
  const id = started.id!
  for (const kind of RECTANGLE_CIRCUIT) assert.ok(game.appendCoasterPiece(id, kind, false).ok)
  assert.ok(game.setCoasterAccess(id, 'entrance', 11, -10).ok)
  assert.ok(game.placePathSegment(12, -10, 0, 'queue').ok)
  assert.notEqual(game.getPathAt(12, -10)?.queueDirection, undefined, 'the queue points at the entrance')
  assert.ok(game.setCoasterAccess(id, 'entrance', 10, -11).ok)
  assert.equal(
    game.getPathAt(12, -10)?.queueDirection,
    undefined,
    'a queue next to the old entrance is released instead of claimed by the stale record',
  )
  assertDualModel(game, 'entrance moved')
}

/**
 * Records claim queues first and in their creation order, as before the
 * freeze: a queue tile between an older course entrance and a newer coaster
 * entrance keeps pointing at the course, also after a reload of an old save.
 */
function testSharedQueueKeepsItsClaimOrder(): void {
  const courseOnly = flatPark()
  assert.ok(courseOnly.startCourse('mudmasters', 13, -10).ok)
  assert.ok(courseOnly.placePathSegment(12, -10, 0, 'queue').ok)
  const towardCourse = courseOnly.getPathAt(12, -10)?.queueDirection
  assert.notEqual(towardCourse, undefined, 'the course entrance claims the tile')

  const game = flatPark()
  const courseId = game.startCourse('mudmasters', 13, -10).id!
  const coasterId = game.startCoaster('classicSteel', 10, -10).id!
  for (const kind of RECTANGLE_CIRCUIT) assert.ok(game.appendCoasterPiece(coasterId, kind, false).ok)
  assert.ok(game.setCoasterAccess(coasterId, 'entrance', 11, -10).ok)
  assert.ok(game.placePathSegment(12, -10, 0, 'queue').ok)
  const order = game.snapshot.attractions.map((record) => record.id)
  assert.ok(order.indexOf(courseId) < order.indexOf(coasterId), 'the older course record comes first')
  assert.equal(game.getPathAt(12, -10)?.queueDirection, towardCourse, 'the older course keeps the shared queue tile')
  const reloaded = GameState.fromJSON(JSON.stringify(game.snapshot))!
  assert.equal(reloaded.getPathAt(12, -10)?.queueDirection, towardCourse, 'a reload keeps the claim order')
}

function testSaveRoundTripKeepsTheDualModel(): void {
  const game = flatPark()
  const coasterId = buildCircuitCoaster(game, 'save')
  const second = game.startCoaster('wooden', -10, 10).id!
  const courseId = game.startCourse('mudmasters', 4, 6).id!
  assert.ok(game.startCourseArea('pool', [{ x: 12, z: 6 }, { x: 13, z: 6 }]).ok)
  assert.ok(applyGameCommand(game, { type: 'designateCampingArea', cells: [{ x: -6, z: 8 }, { x: -5, z: 8 }] }).ok)
  assert.ok(applyGameCommand(game, { type: 'designateStageForecourt', cells: [{ x: 3, z: -14 }] }).ok)
  const bungee = game.startAttraction('bungee', -16, 16, 0).placedId!

  const first = GameState.fromJSON(JSON.stringify(game.snapshot))!
  assertDualModel(first, 'first load')
  const again = GameState.fromJSON(JSON.stringify(first.snapshot))!
  assertDualModel(again, 'second load')
  for (const key of ['coasters', 'courses', 'attractions'] as const) {
    assert.equal(JSON.stringify(again.snapshot[key]), JSON.stringify(first.snapshot[key]), `a second round trip keeps ${key}`)
  }
  assert.ok(first.getCoaster(coasterId) && first.getAttraction(bungee))

  // Up to 0.2.11 `stepAttractions` served orphans, so guests could queue for
  // or ride one; dropping the orphan on load must release them.
  const orphanRider = spawnGuest(game, { x: 0, z: 0 }, second, 'riding')
  const orphanQueuer = spawnGuest(game, { x: 1, z: 0 }, second, 'queuing')
  const rideRider = spawnGuest(game, { x: 2, z: 0 }, 'building-gone-7', 'riding')
  const control = spawnGuest(game, { x: 3, z: 0 }, coasterId, 'queuing')
  game.getCoaster(coasterId)!.queue.push(control.id)
  const mixed = JSON.parse(JSON.stringify(game.snapshot)) as GameSnapshot
  mixed.coasters = mixed.coasters.filter((coaster) => coaster.id !== second)
  mixed.attractions = mixed.attractions.filter((record) => record.id !== courseId)
  // A ride record the v30 loader migrated, whose `ride` building is gone.
  const rideRecord = structuredClone(mixed.attractions.find((record) => record.id === bungee)!)
  if (rideRecord.runtime.kind === 'scriptedRide') rideRecord.runtime.occupantIds = [rideRider.id]
  mixed.attractions.push({ ...rideRecord, id: 'building-gone-7' })
  // The old canonical path left empty pools behind: a live row without cells
  // plus a stale `swimArea` record (seen in the performance fixture).
  const poolRecord = mixed.attractions.find((record) => record.definitionId === 'swimArea')!
  mixed.courses.push(createEmptyCourse('attraction-0-999', 'pool'))
  mixed.attractions.push({ ...structuredClone(poolRecord), id: 'attraction-0-999' })
  const repaired = GameState.fromJSON(JSON.stringify(mixed))!
  assert.equal(repaired.getAttraction('building-gone-7'), undefined, 'an orphaned ride record is dropped on load')
  for (const guest of [orphanRider, orphanQueuer, rideRider]) {
    const loaded = repaired.getVisitor(guest.id)!
    assert.deepEqual(
      [loaded.state, loaded.targetId, loaded.route.length],
      ['exploring', null, 0],
      `${guest.id} bound to a dropped orphan is released`,
    )
  }
  const kept = repaired.getVisitor(control.id)!
  assert.deepEqual([kept.state, kept.targetId], ['queuing', coasterId], 'a guest of a live coaster keeps its queue')
  assert.equal(repaired.getAttraction(second), undefined, 'an orphaned coaster record is dropped on load')
  assert.ok(repaired.getAttraction(courseId), 'a live course without a record gets one')
  assert.ok(repaired.getCourse('attraction-0-999'), 'the empty pool stays a live row')
  assert.equal(repaired.getAttraction('attraction-0-999'), undefined, 'a row that does not project loses its stale record')
  assert.ok(repaired.getAttraction(bungee), 'canonical records survive the repair')
  assertDualModel(repaired, 'mixed save repaired')
  for (let step = 0; step < 10; step += 1) repaired.tick(0.1)
  assert.equal(repaired.getAttraction(second), undefined, 'the orphan never comes back')
  assertDualModel(repaired, 'mixed save after ticks', { overlays: false })

  const legacy = JSON.parse(JSON.stringify(game.snapshot)) as GameSnapshot & { version: number }
  legacy.version = 30
  legacy.attractions = []
  legacy.courses.push(createEmptyCourse('invalid-course', 'mudmasters'))
  const migrated = GameState.fromJSON(JSON.stringify(legacy))!
  assertDualModel(migrated, 'v30 load')
  assert.ok(migrated.snapshot.migrationReport?.removedAttractionIds.includes('invalid-course'))
  assert.ok(migrated.getCourse('invalid-course'), 'removedAttractionIds reports; the live row stays')
  assert.equal(migrated.getAttraction('invalid-course'), undefined, 'a row that does not project has no record')
}

/**
 * A version-1 park (no `attractions`, `entryPrice` instead of
 * `campingTicketPrice`) with all six live families: coaster, course, pool with
 * a water slide piece, `ride` building, camping and stage forecourt.
 */
function testVersionOneParkKeepsTheDualModel(): void {
  const game = flatPark()
  const coasterId = buildCircuitCoaster(game, 'v1 park')
  const courseId = game.startCourse('mudmasters', 4, 6).id!
  const rideId = placeRideBuilding(game, 16, 10)
  assert.ok(applyGameCommand(game, { type: 'designateCampingArea', cells: [{ x: -6, z: 8 }, { x: -5, z: 8 }] }).ok)
  assert.ok(applyGameCommand(game, { type: 'designateStageForecourt', cells: [{ x: 3, z: -14 }] }).ok)
  const pool = createSeededCourse('legacy-pool', 'pool', -12, -12)
  pool.pieces.push({ id: 'legacy-pool-ws', kind: 'waterSlide', x: -12, z: -8, elevation: 2, rotation: 0 })
  const v1 = JSON.parse(JSON.stringify(game.snapshot)) as Partial<GameSnapshot> & {
    version?: number
    entryPrice?: number
  }
  v1.version = 1
  delete v1.attractions
  delete v1.migrationReport
  delete v1.campingTicketPrice
  v1.entryPrice = 12
  v1.courses = [...(v1.courses ?? []), pool]

  const loaded = GameState.fromJSON(JSON.stringify(v1))!
  assert.equal(loaded.snapshot.campingTicketPrice, 12, 'the v1 entry price becomes the camping ticket price')
  assertDualModel(loaded, 'v1 park')
  const definition = (id: string) => loaded.getAttraction(id)?.definitionId
  assert.equal(definition(coasterId), 'coaster:classicSteel')
  assert.equal(definition(courseId), 'course:mudmasters')
  assert.equal(definition('legacy-pool'), 'swimArea')
  assert.ok(loaded.getCourse('legacy-pool-slide-1'), 'the pool slide becomes its own course')
  assert.equal(definition('legacy-pool-slide-1'), 'waterSlide')
  assert.equal(definition(rideId), 'carousel', 'the ride building gets its migrated record')
  assert.ok(loaded.snapshot.buildings.some((building) => building.id === rideId), 'and stays a live building')
  assert.equal(loaded.snapshot.attractions.filter((record) => record.definitionId === 'camping').length, 1)
  assert.equal(loaded.snapshot.attractions.filter((record) => record.definitionId === 'partyArea').length, 1)

  const again = GameState.fromJSON(JSON.stringify(loaded.snapshot))!
  assertDualModel(again, 'v1 park second load')
  for (const key of ['coasters', 'courses', 'attractions'] as const) {
    assert.equal(JSON.stringify(again.snapshot[key]), JSON.stringify(loaded.snapshot[key]), `the v1 park keeps ${key} on a second round trip`)
  }
  for (let step = 0; step < 10; step += 1) again.tick(0.1)
  assertDualModel(again, 'v1 park after ticks', { overlays: false })
}

/**
 * 0.2.11 could hand one course id out twice while paused. A save with such a
 * pair (and a coaster pair, for good measure) gets unique ids on load; the
 * guests in the renamed row's queue follow it.
 */
function testCollidingIdsAreRepairedOnLoad(): void {
  const game = flatPark()
  const coasterA = buildCircuitCoaster(game, 'colliding ids')
  const coasterB = game.startCoaster('wooden', -10, 10).id!
  const courseA = game.startCourse('mudmasters', 2, 2).id!
  const courseB = game.startCourse('mudmasters', 2, 8).id!
  const queuedB = spawnGuest(game, { x: 2, z: 8 }, courseB, 'queuing')
  game.getCourse(courseB)!.queue.push(queuedB.id)
  const walker = spawnGuest(game, { x: 2, z: 9 }, courseB, 'seeking')
  const boardingB = spawnGuest(game, { x: -10, z: 11 }, coasterB, 'queuing')
  game.getCoaster(coasterB)!.queue.push(boardingB.id)

  const save = JSON.parse(JSON.stringify(game.snapshot)) as GameSnapshot
  save.courses.find((course) => course.id === courseB)!.id = courseA
  save.coasters.find((coaster) => coaster.id === coasterB)!.id = coasterA
  save.attractions = save.attractions.filter((record) => record.id !== courseB && record.id !== coasterB)
  for (const visitor of save.visitors) {
    if (visitor.targetId === courseB) visitor.targetId = courseA
    if (visitor.targetId === coasterB) visitor.targetId = coasterA
  }
  const loaded = GameState.fromJSON(JSON.stringify(save))!
  assert.deepEqual(loaded.snapshot.courses.map((course) => course.id), [courseA, `${courseA}-2`])
  assert.deepEqual(loaded.snapshot.coasters.map((coaster) => coaster.id), [coasterA, `${coasterA}-2`])
  assertDualModel(loaded, 'colliding ids repaired')
  assert.equal(loaded.getVisitor(queuedB.id)?.targetId, `${courseA}-2`, 'a queued guest follows the renamed course')
  assert.equal(loaded.getVisitor(boardingB.id)?.targetId, `${coasterA}-2`, 'a queued guest follows the renamed coaster')
  assert.equal(loaded.getVisitor(walker.id)?.targetId, courseA, 'a guest only walking there stays with the first row')
  assert.ok(loaded.removeCourse(courseA).ok)
  assert.deepEqual(loaded.snapshot.courses.map((course) => course.id), [`${courseA}-2`], 'removing one course keeps the other')
  assertDualModel(loaded, 'colliding ids after remove')
}

type WorldDelta = {
  world: Parameters<GameState['applyNetworkUpdate']>[0]
  visitors: Parameters<GameState['applyNetworkUpdate']>[1]
  removed: string[]
}

function assertClientMatchesHost(host: GameState, guest: GameState, label: string): void {
  assert.equal(JSON.stringify(guest.snapshot.coasters), JSON.stringify(host.snapshot.coasters), `${label}: coasters match`)
  assert.equal(JSON.stringify(guest.snapshot.courses), JSON.stringify(host.snapshot.courses), `${label}: courses match`)
  const hostRecords = new Map(host.snapshot.attractions.map((record) => [record.id, record]))
  assert.equal(guest.snapshot.attractions.length, hostRecords.size, `${label}: record count matches`)
  for (const record of guest.snapshot.attractions) {
    assert.equal(structuralJson(record), structuralJson(hostRecords.get(record.id)), `${label}: record ${record.id} matches`)
  }
}

function testMultiplayerKeepsLiveRows(): void {
  const host = flatPark()
  const coasterId = buildCircuitCoaster(host, 'mp host')
  const courseId = host.startCourse('mudmasters', 4, 6).id!
  const updates = new WorldUpdates()
  const guest = new GameState()
  guest.networkMode = 'client'
  const full = JSON.parse(updates.encode(packWorld(host.snapshot), true)) as {
    world: Parameters<GameState['applyNetworkWorld']>[0]
  }
  guest.applyNetworkWorld(full.world)
  assertClientMatchesHost(host, guest, 'full sync')
  const sync = (label: string): void => {
    const delta = JSON.parse(updates.encode(packWorld(host.snapshot))) as WorldDelta
    guest.applyNetworkUpdate(delta.world, delta.visitors, delta.removed)
    assertClientMatchesHost(host, guest, label)
  }
  host.updateCoasterPrice(coasterId, 12)
  sync('coaster price')
  assert.ok(host.setCoasterAccess(coasterId, 'entrance', 11, -10).ok)
  sync('entrance move')
  assert.ok(host.setCoasterOperationMode(coasterId, 'open').ok)
  assert.ok(host.setCoasterOperationMode(coasterId, 'test').ok)
  sync('test mode')
  assert.ok(host.setCoursePrice(courseId, 11).ok)
  sync('course price')

  const liveCoaster = guest.getCoaster(coasterId)!
  const liveCourse = guest.getCourse(courseId)!
  const liveJson = JSON.stringify([liveCoaster, liveCourse])
  const doctored = structuredClone(host.snapshot.attractions) as Attraction[]
  for (const record of doctored) {
    if (record.id === coasterId || record.id === courseId) record.price = 1
  }
  guest.applyNetworkUpdate({ attractions: doctored })
  assert.equal(guest.getCoaster(coasterId), liveCoaster, 'an attractions-only delta keeps the live coaster object')
  assert.equal(guest.getCourse(courseId), liveCourse, 'an attractions-only delta keeps the live course object')
  assert.equal(JSON.stringify([liveCoaster, liveCourse]), liveJson, 'and never edits it')
  assert.equal(guest.getAttraction(coasterId)?.price, liveCoaster.ticketPrice, 'the record is derived from the live row again')

  const paintball = host.startCourseArea('paintball', [{ x: 4, z: 12 }, { x: 5, z: 12 }]).id!
  guest.applyNetworkUpdate({ attractions: structuredClone(host.snapshot.attractions) })
  assert.ok(guest.getCourse(paintball), 'an attractions-only delta adopts a missing course id')
  assert.equal(guest.getCoaster(coasterId), liveCoaster)
  sync('after adoption')
}

function testCanonicalCommandsRefuseLegacyIds(): void {
  const game = flatPark()
  const coasterId = buildCircuitCoaster(game, 'canonical guard')
  const courseId = game.startCourse('mudmasters', 4, 6).id!
  assert.ok(applyGameCommand(game, { type: 'designateCampingArea', cells: [{ x: -6, z: 8 }] }).ok)
  const liveBefore = JSON.stringify([game.snapshot.coasters, game.snapshot.courses])
  const coaster = game.getCoaster(coasterId)
  const course = game.getCourse(courseId)
  for (const id of [coasterId, courseId, 'camping-area']) {
    const results = [
      game.setAttractionPrice(id, 1),
      game.setAttractionOperation(id, 'closed'),
      game.configureAttraction(id, { teamSize: 2, dispatchMode: 'full-only' }),
      game.constructAttraction({ kind: 'setEntrance', attractionId: id, point: { x: 0, z: 0, elevation: 0 } }),
      game.removeAttraction(id),
    ]
    for (const result of results) assert.equal(result.ok, false, `canonical commands refuse ${id}: ${result.message}`)
  }
  assert.equal(game.getCoaster(coasterId), coaster, 'the coaster object is untouched')
  assert.equal(game.getCourse(courseId), course, 'the course object is untouched')
  assert.equal(JSON.stringify([game.snapshot.coasters, game.snapshot.courses]), liveBefore)

  const coasters = game.snapshot.coasters.length
  for (const definitionId of ['coaster:classicSteel', 'course:mudmasters', 'paintball', 'swimArea', 'waterSlide', 'camping', 'partyArea']) {
    assert.equal(game.startAttraction(definitionId, 0, 12, 0).ok, false, `${definitionId} is built in its own editor`)
  }
  assert.equal(game.snapshot.coasters.length, coasters, 'no zero-piece coaster appears')

  const bungee = game.startAttraction('bungee', -16, 16, 0).placedId!
  const canonical = [
    game.constructAttraction({ kind: 'addScriptedSegment', attractionId: bungee, segmentKind: 'towerSegment' }),
    game.setAttractionPrice(bungee, 4),
    game.configureAttraction(bungee, { dispatchMode: 'timed' }),
    game.removeAttraction(bungee),
  ]
  for (const result of canonical) assert.ok(result.ok, result.message)
  assert.equal(game.getCoaster(coasterId), coaster, 'canonical commands keep every coaster object')
  assert.equal(game.getCourse(courseId), course, 'canonical commands keep every course object')
  assert.equal(JSON.stringify([game.snapshot.coasters, game.snapshot.courses]), liveBefore)
  assertDualModel(game, 'after canonical commands')
}

/**
 * The extension rule in docs/attractions.md: a genuinely new attraction kind
 * lives only in the canonical model, with its own `runtime.kind` and a
 * `startAttraction` id. Refresh, load and a signature-changing edit must keep
 * it; the same record without a `startAttraction` id is an orphan.
 */
function testNewCanonicalKindsAreNoOrphans(): void {
  const game = flatPark()
  const bungee = game.startAttraction('bungee', -16, 16, 0).placedId!
  const future = {
    ...structuredClone(game.getAttraction(bungee)!),
    id: `${CANONICAL_ATTRACTION_ID_PREFIX}0-777`,
    runtime: { kind: 'flume', riders: [] },
  } as unknown as Attraction
  const owners = liveOwnerIds(game.snapshot)
  assert.ok(isCanonicalAttractionRecord(future), 'a startAttraction id of a new kind is canonical')
  assert.equal(isOrphanProjectionRecord(future, owners), false, 'a canonical record of a new kind is no orphan')
  assert.equal(
    isOrphanProjectionRecord({ ...future, id: 'building-0-777' }, owners),
    true,
    'without a startAttraction id and without an owner it is one',
  )
  game.snapshot.attractions.push(future)
  refreshLegacyAttractionRecords(game.snapshot)
  assert.ok(game.getAttraction(future.id), 'the refresh keeps the new kind')
  assert.ok(game.startCourse('mudmasters', 4, 6).ok)
  assert.ok(game.getAttraction(future.id), 'a signature-changing edit keeps the new kind')
  assertDualModel(game, 'new canonical kind')
  const reloaded = GameState.fromJSON(JSON.stringify(game.snapshot))!
  assert.ok(reloaded.getAttraction(future.id), 'a reload keeps the new kind')
  assert.ok(reloaded.getAttraction(bungee))
}

/**
 * Why the reverse projection is limited to loading v31 saves and adopting
 * missing MP ids: it drops point pitch/bank and renames course gate pieces.
 */
function testProjectionLossesArePinned(): void {
  const game = flatPark()
  const coasterId = game.startCoaster('classicSteel', -10, -10).id!
  assert.ok(game.appendCoasterPiece(coasterId, 'slopeGentleUp', true).ok)
  const coaster = game.getCoaster(coasterId)!
  assert.ok(coaster.pieces[1]!.points.some((point) => (point.pitch ?? 0) !== 0), 'live points carry pitch')
  const projected = projectCoasters([migrateCoaster(coaster)!])[0]!
  assert.ok(
    projected.pieces[1]!.points.every((point) => point.pitch === undefined && point.bank === undefined),
    'the reverse projection drops point pitch/bank',
  )
  const courseId = game.startCourse('mudmasters', 4, 6).id!
  const course = game.getCourse(courseId)!
  const liveEntrance = course.pieces.find((piece) => piece.kind === 'entrance')!.id
  const projectedEntrance = projectCourses(migrateCourse(course))[0]!.pieces.find((piece) => piece.kind === 'entrance')!.id
  assert.equal(projectedEntrance, `${courseId}-entrance`)
  assert.notEqual(projectedEntrance, liveEntrance, 'the reverse projection renames the entrance piece')
}
