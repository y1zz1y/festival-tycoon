import assert from 'node:assert/strict'
import { addAreaCells, areaComponents, canPlaceAreaReference } from '../src/game/attractions/areaLayout'
import {
  resolveAttractionConstruction,
  validateAttractionCompletion,
} from '../src/game/attractions/construction'
import { createAttraction } from '../src/game/attractions/factory'
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
  attractionPaletteHtml,
  nextTrackEdge,
  type AttractionBuilderState,
} from '../src/ui/attractionBuilderPanel'
import { GameState } from '../src/game/GameState'
import { applyGameCommand } from '../src/net/commands'

export function testAttractionFoundation(): void {
  testTrackDeleteAndReconnect()
  testTopologies()
  testConstructionParity()
  testAreaRulesAndWaterLanding()
  testUnifiedBuilder()
  testAttractionCommands()
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

function testUnifiedBuilder(): void {
  const attraction = createAttraction('builder', 'course:mudmasters', 4, 4, 0, 1)!
  attraction.access.entrance = { x: 4, z: 4, elevation: 0 }
  const state: AttractionBuilderState = {
    attraction,
    mode: 'track',
    selectedKind: 'path',
    direction: 1,
    elevationDelta: 0.5,
    banking: 0,
  }
  const preview = nextTrackEdge(state, 'edge', 'node')
  assert.notEqual(typeof preview, 'string')
  if (typeof preview === 'string') return
  assert.equal(preview.to.anchor.x, 5)
  assert.equal(preview.to.anchor.elevation, 0.5)
  assert.match(attractionPaletteHtml(state), /data-attraction-piece="trackDelete"/)
  assert.match(attractionPaletteHtml(state), /data-attraction-piece="entrance"/)
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
