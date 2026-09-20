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
  TrackEdge,
  TrackGraph,
  TrackNode,
} from '../src/game/attractions/types'
import { GameState } from '../src/game/GameState'
import { defaultStageDesign, stageDetailSize } from '../src/game/stageDesign'
import { applyGameCommand } from '../src/net/commands'
import { packWorld } from '../src/net/codec'
import { WorldUpdates } from '../src/net/worldUpdates'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import type { Visitor } from '../src/game/types/entities'

export function testAttractionFoundation(): void {
  testTrackDeleteAndReconnect()
  testTopologies()
  testConstructionParity()
  testAreaRulesAndWaterLanding()
  testRuntimeFunRewards()
  testDedicatedSystemsKeepTheirAttractions()
  testAttractionCommands()
  testCampingAndForecourtStayLive()
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
  const game = new GameState()
  const started = applyGameCommand(game, {
    type: 'startAttraction',
    definitionId: 'paintball',
    x: 4,
    z: 4,
    rotation: 0,
  })
  assert.equal(started.ok, true)
  assert.ok(started.placedId)
  const attractionId = started.placedId!
  const changed = applyGameCommand(game, {
    type: 'constructAttraction',
    request: {
      kind: 'addAreaCells',
      attractionId,
      cells: [
        { x: 4, z: 4, elevation: 0 },
        { x: 5, z: 4, elevation: 0 },
      ],
    },
  })
  assert.equal(changed.ok, true)
  assert.equal(game.getAttraction(attractionId)?.layout.kind, 'area')
  assert.equal(
    game.getAttraction(attractionId)?.layout.kind === 'area'
      ? game.getAttraction(attractionId)!.layout.cells.length
      : 0,
    2,
  )
  const client = new GameState()
  client.applyNetworkUpdate({
    attractions: structuredClone(game.snapshot.attractions),
  })
  assert.equal(client.snapshot.attractions.length, 1)
  assert.equal(client.snapshot.courses.length, 1, 'network attraction deltas refresh runtime projections')
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
    definitionId: 'paintball',
    x: 8,
    z: -8,
    rotation: 0,
  })
  assert.ok(started.ok)
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

  applyGameCommand(game, {
    type: 'constructAttraction',
    request: {
      kind: 'addAreaCells',
      attractionId: started.placedId!,
      cells: [{ x: 8, z: -8, elevation: 0 }],
    },
  })
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
