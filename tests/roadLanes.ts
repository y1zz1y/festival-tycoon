import assert from 'node:assert/strict'
import { InstancedMesh, Matrix4, Mesh, Vector3, type Object3D } from 'three'
import { GameState } from '../src/game/GameState'
import type { AccessControlSnapshot, TrafficLight } from '../src/game/accessControl'
import { createRoadGraph, findRoadRoute, roadLayerKey, type RoadCell, type RoadGraph, type RoadPosition, type RoadVehicle } from '../src/game/logistics'
import {
  canEnterRoadCell,
  canExitFromRoadCell,
  canLeaveRoadCell,
  canSpawnOnRoadCell,
  classifyRoadLanes,
  isPriorityJunction,
  type LaneRole,
  type RoadLaneLayout,
} from '../src/game/roadLanes'
import type { GameSnapshot } from '../src/game/types/snapshot'
import { AccessControlView } from '../src/view/AccessControlView'
import { LogisticsView } from '../src/view/LogisticsView'
import { roadTrafficAxis, roadWayMarks } from '../src/view/roadMarkings'
import { createWayStructure, indexWayStructures, wayStructurePlan, type WayStructureCell } from '../src/view/wayStructures'

type Fixture = (count?: number) => GameState

const WORLD = 64

function road(x: number, z: number, extra: Partial<RoadCell> = {}): RoadCell {
  return { x, z, allowedDirections: null, blockedEdges: 0, speedLimit: 30, crosswalk: false, elevation: 0, ...extra }
}

function strip(xs: readonly number[], z0: number, z1: number, extra: Partial<RoadCell> = {}): RoadCell[] {
  const cells: RoadCell[] = []
  for (const x of xs) for (let z = z0; z <= z1; z += 1) cells.push(road(x, z, extra))
  return cells
}

function stripX(zs: readonly number[], x0: number, x1: number): RoadCell[] {
  const cells: RoadCell[] = []
  for (const z of zs) for (let x = x0; x <= x1; x += 1) cells.push(road(x, z))
  return cells
}

/** Unique cells: later layouts may overlap a block already listed. */
function layout(...parts: RoadCell[][]): RoadCell[] {
  const seen = new Map<string, RoadCell>()
  for (const cell of parts.flat()) seen.set(`${cell.x}:${cell.z}:${cell.elevation ?? 0}`, cell)
  return [...seen.values()]
}

function at(cells: readonly RoadCell[], x: number, z: number, elevation = 0): RoadCell {
  const cell = cells.find((candidate) => candidate.x === x && candidate.z === z && (candidate.elevation ?? 0) === elevation)
  assert.ok(cell, `road ${x},${z}`)
  return cell
}

function roleAt(lanes: RoadLaneLayout, cells: readonly RoadCell[], x: number, z: number, elevation = 0): LaneRole {
  const role = lanes.roleOf(at(cells, x, z, elevation))
  assert.ok(role, `role ${x},${z}`)
  return role
}

function laneOf(role: LaneRole): Extract<LaneRole, { kind: 'lane' }> {
  assert.equal(role.kind, 'lane')
  return role as Extract<LaneRole, { kind: 'lane' }>
}

function neighborsOf(graph: RoadGraph, x: number, z: number): string[] {
  return (graph.neighbors.get(roadLayerKey(x, z, 0)) ?? []).map((cell) => `${cell.x},${cell.z}`).sort()
}

function assertLegalRoute(graph: RoadGraph, start: RoadPosition, route: readonly RoadPosition[], label: string): void {
  let previous = start
  for (const step of route) {
    assert.ok(neighborsOf(graph, previous.x, previous.z).includes(`${step.x},${step.z}`), `${label}: ${previous.x},${previous.z} → ${step.x},${step.z} follows the lanes`)
    previous = step
  }
}

export function testRoadLanes(fixture: Fixture): void {
  testClassification()
  testEntryStub()
  testLaneMovement()
  testLanePriority(fixture)
  testLaneSpawnAndExit(fixture)
  testLoadedTwoLaneSave(fixture)
  testLaneParking(fixture)
  testStubTurningPoint()
  testSeparateStubRoads()
  testMirroredStubOneWays(fixture)
  testBayBesideKnot(fixture)
  testLaneMarkings()
  testTrafficLightSide()
}

function testClassification(): void {
  const straight = strip([0, 1], 0, 5)
  let lanes = classifyRoadLanes(straight, WORLD)
  const west = laneOf(roleAt(lanes, straight, 0, 2)), east = laneOf(roleAt(lanes, straight, 1, 2))
  assert.equal(west.direction, 0, 'on a road along Z the −X tile carries +Z (right-hand traffic)')
  assert.equal(east.direction, 2, 'the +X tile carries −Z')
  assert.equal(west.axis, 'z')
  assert.equal(west.partner, 1)
  assert.equal(west.end, false)
  assert.ok(laneOf(roleAt(lanes, straight, 0, 0)).end && laneOf(roleAt(lanes, straight, 1, 5)).end, 'both ends of a dead-end two-lane road are turning points')

  const alongX = stripX([0, 1], 0, 5)
  lanes = classifyRoadLanes(alongX, WORLD)
  assert.equal(laneOf(roleAt(lanes, alongX, 2, 1)).direction, 1, 'on a road along X the +Z tile carries +X')
  assert.equal(laneOf(roleAt(lanes, alongX, 2, 0)).direction, 3, 'the −Z tile carries −X')

  const corner = layout(strip([0, 1], 0, 5), stripX([4, 5], 0, 8))
  lanes = classifyRoadLanes(corner, WORLD)
  const cornerKnot = roleAt(lanes, corner, 0, 5)
  assert.equal(cornerKnot.kind, 'knot', 'a corner block is a knot')
  assert.ok(cornerKnot.kind === 'knot' && cornerKnot.exits === 2 && cornerKnot.exitMask === 0b0110 && cornerKnot.tiles.length === 4)
  for (const [x, z] of [[1, 4], [0, 4], [1, 5]] as const) {
    const role = roleAt(lanes, corner, x, z)
    assert.ok(role.kind === 'knot' && role.tiles === cornerKnot.tiles, 'the four corner tiles share one knot')
  }
  assert.equal(laneOf(roleAt(lanes, corner, 0, 2)).direction, 0)
  assert.equal(laneOf(roleAt(lanes, corner, 4, 5)).direction, 1)

  const tee = layout(strip([0, 1], -5, 5), stripX([0, 1], 2, 8))
  lanes = classifyRoadLanes(tee, WORLD)
  const teeKnot = roleAt(lanes, tee, 1, 1)
  assert.ok(teeKnot.kind === 'knot' && teeKnot.exits === 3 && teeKnot.tiles.length === 4, 'a T junction is a 2×2 knot with three exits')

  const crossing = layout(strip([0, 1], -5, 6), stripX([0, 1], -5, 6))
  lanes = classifyRoadLanes(crossing, WORLD)
  const crossKnot = roleAt(lanes, crossing, 0, 0)
  assert.ok(crossKnot.kind === 'knot' && crossKnot.exits === 4 && crossKnot.tiles.length === 4, 'a crossing is a 2×2 knot with four exits')
  assert.equal(laneOf(roleAt(lanes, crossing, -3, 1)).direction, 1)

  const square = layout(strip([0, 1, 2, 3], 0, 3))
  lanes = classifyRoadLanes(square, WORLD)
  assert.ok(square.every((cell) => lanes.roleOf(cell)?.kind === 'plaza'), 'a 4×4 area is a plaza')
  const block = strip([0, 1], 0, 1)
  lanes = classifyRoadLanes(block, WORLD)
  assert.ok(block.every((cell) => lanes.roleOf(cell)?.kind === 'plaza'), 'an isolated 2×2 is a plaza')

  const single = strip([0], 0, 5)
  lanes = classifyRoadLanes(single, WORLD)
  assert.ok(single.every((cell) => lanes.roleOf(cell)?.kind === 'single'), 'a one-tile road stays single')
  // Bends and junctions of one-lane roads stay single roads (no knot, no box rule).
  const bend = layout(strip([0], 0, 5), stripX([5], 0, 6))
  lanes = classifyRoadLanes(bend, WORLD)
  assert.ok(bend.every((cell) => lanes.roleOf(cell)?.kind === 'single'), 'a bend of a one-lane road stays single')
  assert.ok(!isPriorityJunction(lanes, at(bend, 0, 5)), 'a bend is no junction')
  const singleTee = layout(strip([0], 0, 8), stripX([4], 0, 5))
  lanes = classifyRoadLanes(singleTee, WORLD)
  assert.equal(roleAt(lanes, singleTee, 0, 4).kind, 'single', 'one-lane roads meeting stay single')
  assert.ok(isPriorityJunction(lanes, at(singleTee, 0, 4)), 'three one-lane roads meeting yield to the right')

  const joining = layout(strip([0, 1], 0, 8), stripX([4], 2, 6))
  lanes = classifyRoadLanes(joining, WORLD)
  const joinKnot = roleAt(lanes, joining, 1, 4)
  assert.ok(joinKnot.kind === 'knot' && joinKnot.tiles.length === 2, 'a single road joining the side makes a 1×2 knot')
  assert.equal((roleAt(lanes, joining, 0, 4) as { tiles?: unknown }).tiles, joinKnot.kind === 'knot' ? joinKnot.tiles : null)
  assert.equal(roleAt(lanes, joining, 3, 4).kind, 'single')
  assert.equal(roleAt(lanes, joining, 0, 3).kind, 'lane')

  const narrowing = layout(strip([0, 1], 3, 8), strip([0], 0, 2))
  lanes = classifyRoadLanes(narrowing, WORLD)
  assert.equal(roleAt(lanes, narrowing, 0, 3).kind, 'knot', 'where two lanes narrow to one the last row is a free knot')
  assert.equal(roleAt(lanes, narrowing, 1, 3).kind, 'knot')
  assert.equal(roleAt(lanes, narrowing, 0, 5).kind, 'lane')
  const narrowGraph = createRoadGraph(narrowing, WORLD)
  const down = findRoadRoute({ roadCells: narrowing, graph: narrowGraph, start: { x: 1, z: 7 }, target: { x: 0, z: 0 } })
  assert.ok(down, 'southbound traffic gets from the two-lane road onto the single road')
  assertLegalRoute(narrowGraph, { x: 1, z: 7 }, down, 'narrowing')

  const separated = strip([0, 1], 0, 5).map((cell) => ({ ...cell, blockedEdges: cell.x === 0 ? 1 << 1 : 1 << 3 }))
  lanes = classifyRoadLanes(separated, WORLD)
  assert.ok(separated.every((cell) => lanes.roleOf(cell)?.kind === 'single'), 'a separator makes two single roads')

  // A bridge along X at height 1 over a two-lane road along Z: layers do not mix.
  const stacked = layout(strip([0, 1], 0, 6), stripX([3], -3, 4).map((cell) => ({ ...cell, elevation: 1 })))
  lanes = classifyRoadLanes(stacked, WORLD)
  assert.equal(laneOf(roleAt(lanes, stacked, 0, 3)).direction, 0, 'the lane under the bridge stays a lane')
  const deck = roleAt(lanes, stacked, 0, 3, 1)
  assert.ok(deck.kind === 'single' && deck.axis === 'x', 'the bridge deck above it is a single road along X')
}

function reachesAll(graph: RoadGraph, from: readonly RoadCell[], to: readonly RoadCell[]): string[] {
  const key = (cell: RoadCell) => roadLayerKey(cell.x, cell.z, cell.elevation ?? 0)
  const missing: string[] = []
  for (const start of from) {
    const seen = new Set([key(start)])
    const queue = [start]
    while (queue.length) {
      const cell = queue.pop()!
      for (const next of graph.neighbors.get(key(cell)) ?? []) {
        if (!seen.has(key(next))) {
          seen.add(key(next))
          queue.push(next)
        }
      }
    }
    for (const goal of to) if (!seen.has(key(goal))) missing.push(`${start.x},${start.z}→${goal.x},${goal.z}`)
  }
  return missing
}

function testEntryStub(): void {
  const edge = -WORLD / 2
  const stub = stripX([edge], -3, 2)
  const strict = layout(stub, strip([-1, 0], edge + 1, edge + 8))
  let lanes = classifyRoadLanes(strict, WORLD)
  for (let x = -3; x <= 2; x += 1) {
    const role = roleAt(lanes, strict, x, edge)
    assert.ok(role.kind === 'entry' && role.direction === (x < 0 ? 0 : 2) && !role.open, `entry lane ${x}: 3 inbound, 3 outbound`)
  }
  assert.deepEqual(strict.filter((cell) => canSpawnOnRoadCell(lanes, cell)).map((cell) => cell.x).sort((a, b) => a - b), [-3, -2, -1], 'spawns only on the inbound lanes')
  assert.deepEqual(strict.filter((cell) => canExitFromRoadCell(lanes, cell)).map((cell) => cell.x).sort((a, b) => a - b), [0, 1, 2], 'exits only via the outbound lanes')
  assert.equal(laneOf(roleAt(lanes, strict, -1, edge + 3)).direction, 0, 'the road continues the inbound side')
  const graph = createRoadGraph(strict, WORLD)
  // The stub row is a turning point: an outbound car crosses to the inbound half.
  assert.ok(canLeaveRoadCell(lanes, at(strict, 0, edge), 3) && canEnterRoadCell(lanes, at(strict, -1, edge), 3), 'outbound crosses to inbound on the stub')
  const back = findRoadRoute({ roadCells: strict, graph, start: { x: 0, z: edge + 3 }, target: { x: -1, z: edge + 2 }, initialDirection: 2 })
  assert.ok(back, 'a car on the outbound lane turns on the stub and drives back inland')
  assertLegalRoute(graph, { x: 0, z: edge + 3 }, back, 'stub turn')
  assert.ok(back.some((cell) => cell.z === edge), 'the turn uses the stub row')
  const inland = strict.filter((cell) => cell.z > edge)
  assert.deepEqual(reachesAll(graph, inland, strict), [], 'every inland tile reaches every tile, both halves')
  assert.deepEqual(reachesAll(graph, stub, inland), [], 'the whole road is reachable from the stub')
  const tee = layout(stub, strip([-1, 0], edge + 1, edge + 8), stripX([edge + 7, edge + 8], -6, 6))
  assert.deepEqual(reachesAll(createRoadGraph(tee, WORLD), tee, tee), [], 'with a T at the far end every tile reaches every tile')
  const withEdgeRoad = layout(stub, strip([-1, 0], edge + 1, edge + 6), stripX([edge], 3, 8), strip([8], edge + 1, edge + 5))
  assert.deepEqual(reachesAll(createRoadGraph(withEdgeRoad, WORLD), withEdgeRoad, withEdgeRoad), [], 'edge roads at x 3 join the stub both ways')

  // An old save joined the stub by a single road at x 0: the halves are not joined inland.
  const legacy = layout(stub, strip([0], edge + 1, edge + 8))
  lanes = classifyRoadLanes(legacy, WORLD)
  const role = roleAt(lanes, legacy, -1, edge)
  assert.ok(role.kind === 'entry' && role.open, 'a stub whose halves are not joined inland stays open')
  const legacyGraph = createRoadGraph(legacy, WORLD)
  assert.ok(findRoadRoute({ roadCells: legacy, graph: legacyGraph, start: { x: -1, z: edge }, target: { x: 0, z: edge + 6 } }), 'cars from the inbound lanes still reach the old road')
  const separate = layout(stub, strip([-3], edge + 1, edge + 6), strip([2], edge + 1, edge + 6))
  lanes = classifyRoadLanes(separate, WORLD)
  assert.ok(roleAt(lanes, separate, 0, edge).kind === 'entry' && (roleAt(lanes, separate, 0, edge) as { open: boolean }).open, 'two separate roads at x −3 and x 2 keep the stub open')
  // Explicit one-ways on the stub decide arrivals and exits, as before lanes existed.
  const mirrored = strict.map((cell) => cell.z === edge ? { ...cell, allowedDirections: cell.x >= 0 ? 1 : 4 } : cell)
  lanes = classifyRoadLanes(mirrored, WORLD)
  assert.deepEqual(mirrored.filter((cell) => canSpawnOnRoadCell(lanes, cell)).map((cell) => cell.x).sort((a, b) => a - b), [0, 1, 2], 'explicit one-ways north open arrivals on x 0..2')
  assert.deepEqual(mirrored.filter((cell) => canExitFromRoadCell(lanes, cell)).map((cell) => cell.x).sort((a, b) => a - b), [-3, -2, -1], 'explicit one-ways south open exits on x −3..−1')
}

function testLaneMovement(): void {
  const straight = strip([0, 1], 0, 5)
  const graph = createRoadGraph(straight, WORLD)
  assert.deepEqual(neighborsOf(graph, 0, 2), ['0,3'], 'a lane is left only in its direction, never across the centre')
  assert.deepEqual(neighborsOf(graph, 1, 2), ['1,1'])
  assert.deepEqual(neighborsOf(graph, 0, 5), ['1,5'], 'at a dead end the lane turns into its partner')
  assert.deepEqual(neighborsOf(graph, 1, 0), ['0,0'])
  const around = findRoadRoute({ roadCells: straight, graph, start: { x: 0, z: 1 }, target: { x: 1, z: 1 }, initialDirection: 0 })
  assert.ok(around, 'the opposite lane is reached by turning at the dead end')
  assertLegalRoute(graph, { x: 0, z: 1 }, around, 'dead end')
  assert.ok(around.some((cell) => cell.x === 1 && cell.z === 5), 'the U-turn happens at the end')

  const crossing = layout(strip([0, 1], -5, 6), stripX([0, 1], -5, 6))
  const crossGraph = createRoadGraph(crossing, WORLD)
  // A 2×2 knot circulates one way (north, east, south, west along its tiles), so no
  // two vehicles meet head-on inside; every tile may be left outward.
  assert.deepEqual(neighborsOf(crossGraph, 0, 0), ['-1,0', '0,1'], 'SW: on north, or out west')
  assert.deepEqual(neighborsOf(crossGraph, 0, 1), ['0,2', '1,1'], 'NW: on east, or out north')
  assert.deepEqual(neighborsOf(crossGraph, 1, 1), ['1,0', '2,1'], 'NE: on south, or out east')
  assert.deepEqual(neighborsOf(crossGraph, 1, 0), ['0,0', '1,-1'], 'SE: on west, or out south')
  for (const [from, to] of [[[0, -3], [2, 1]], [[0, -3], [-3, 0]], [[0, -3], [0, 4]], [[3, 1], [0, -3]], [[-3, 1], [1, -3]]] as const) {
    const route = findRoadRoute({ roadCells: crossing, graph: crossGraph, start: { x: from[0], z: from[1] }, target: { x: to[0], z: to[1] } })
    assert.ok(route, `through the crossing ${from} → ${to}`)
    assertLegalRoute(crossGraph, { x: from[0], z: from[1] }, route, 'crossing')
  }
  const turn = findRoadRoute({ roadCells: crossing, graph: crossGraph, start: { x: 0, z: -3 }, target: { x: 1, z: -3 }, initialDirection: 0 })
  assert.ok(turn, 'a U-turn works through the knot')
  assertLegalRoute(crossGraph, { x: 0, z: -3 }, turn, 'knot U-turn')
  assert.ok(turn.length <= 9, `the knot U-turn goes once round the 2×2 (${turn.length})`)

  // Explicit one-way bits win over the derived lane.
  const oneWay = strip([0, 1], 0, 5).map((cell) => cell.x === 0 ? { ...cell, allowedDirections: 1 << 2 } : cell)
  const oneWayGraph = createRoadGraph(oneWay, WORLD)
  assert.deepEqual(neighborsOf(oneWayGraph, 0, 3), ['0,2'], 'a player one-way overrides the lane direction')
  assert.ok(canLeaveRoadCell(oneWayGraph.lanes, at(oneWay, 0, 3), 2) && !canLeaveRoadCell(oneWayGraph.lanes, at(oneWay, 0, 3), 0))

  const tee = layout(strip([0], 0, 8), stripX([4], 0, 5))
  const teeLanes = classifyRoadLanes(tee, WORLD)
  assert.ok(isPriorityJunction(teeLanes, at(tee, 0, 4)), 'three roads meeting yield to the right')
  assert.ok(!isPriorityJunction(teeLanes, at(tee, 0, 2)), 'a plain single road does not')
  const crossLanes = crossGraph.lanes
  assert.ok(isPriorityJunction(crossLanes, at(crossing, 0, 0)), 'knots yield to the right')
  assert.ok(!isPriorityJunction(crossLanes, at(crossing, 0, -3)), 'plain lanes never do')
}

function vehicle(id: string, position: RoadPosition, extra: Partial<RoadVehicle> = {}): RoadVehicle {
  return {
    id, kind: 'visitorCar', position: { ...position }, cell: { ...position }, route: [], state: 'driving', speed: 10,
    passengerIds: [], groupId: null, parkingCell: null, target: { kind: 'cruise' }, facing: 0, waitMinutes: 0,
    resumeState: null, lineId: null, nextStopIndex: 0, cargo: 0, ...extra,
  }
}

function buildTwoLaneFromStub(game: GameState, length: number): number {
  const state = game.snapshot as GameSnapshot
  const edge = -state.scenario.worldSize / 2
  game.addDebugMoney()
  for (let z = edge + 1; z <= edge + length; z += 1) {
    for (const x of [-1, 0]) {
      if (!state.logistics.roadCells.some((cell) => cell.x === x && cell.z === z)) assert.ok(game.designateRoad([{ x, z }]).ok, `road ${x},${z}`)
    }
  }
  return edge
}

function testLanePriority(fixture: Fixture): void {
  const game = fixture(0)
  const state = game.snapshot as GameSnapshot
  game.addDebugMoney()
  const cells = layout(strip([-12, -11], -12, -1), stripX([-7, -6], -18, -5))
  for (const cell of cells) assert.ok(game.designateRoad([{ x: cell.x, z: cell.z }]).ok)
  const north = vehicle('north', { x: -12, z: -7 }, { route: [{ x: -12, z: -6 }, { x: -12, z: -5 }], facing: 0 })
  const east = vehicle('east', { x: -13, z: -6 }, { route: [{ x: -12, z: -6 }, { x: -11, z: -6 }], facing: Math.PI / 2 })
  state.logistics.roadVehicles.push(north, east)
  const sim = (game as any).roadVehicleSimulation
  const occupied = new Map([[roadLayerKey(-12, -7, 0), north.id], [roadLayerKey(-13, -6, 0), east.id]])
  const byId = new Map([[north.id, north], [east.id, east]])
  assert.ok(sim.mustYieldToVehicleFromRight(north, { x: -12, z: -6 }, occupied, byId), 'inside the knot a car yields to the one from its right')
  const lane = vehicle('lane', { x: -12, z: -10 }, { route: [{ x: -12, z: -9 }] })
  assert.ok(!sim.mustYieldToVehicleFromRight(lane, { x: -12, z: -9 }, new Map([[roadLayerKey(-12, -10, 0), lane.id]]), new Map([[lane.id, lane]])), 'no yielding on a plain lane')
  // Do not block the box: with three of four knot tiles taken, nobody else drives in.
  const waiting = vehicle('waiting', { x: -11, z: -5 }, { route: [{ x: -11, z: -6 }], facing: Math.PI })
  const twoTaken = new Map([[roadLayerKey(-12, -7, 0), 'a'], [roadLayerKey(-12, -6, 0), 'b']])
  assert.ok(!sim.mustWaitOutsideFullKnot(waiting, waiting.cell, { x: -11, z: -6 }, twoTaken), 'a knot with room is entered')
  const threeTaken = new Map([...twoTaken, [roadLayerKey(-11, -7, 0), 'c']])
  assert.ok(sim.mustWaitOutsideFullKnot(waiting, waiting.cell, { x: -11, z: -6 }, threeTaken), 'a knot whose last free tile it would take is not entered')
  const inside = vehicle('inside', { x: -11, z: -7 }, { route: [{ x: -11, z: -6 }] })
  assert.ok(!sim.mustWaitOutsideFullKnot(inside, inside.cell, { x: -11, z: -6 }, new Map([...threeTaken, [roadLayerKey(-11, -7, 0), inside.id]])), 'cars already in the knot keep moving')
}

function testLaneSpawnAndExit(fixture: Fixture): void {
  const game = fixture(0)
  const edge = buildTwoLaneFromStub(game, 8)
  const entries = (game as any).listFreeRoadEntries() as RoadPosition[]
  assert.ok(entries.length > 0 && entries.every((entry) => entry.x < 0 && entry.z === edge), 'visitor cars appear on inbound entry lanes only')
  assert.equal(entries[0]!.x, -1, 'the inbound lane in line with the road comes first')
  const exits = (game as any).roadVehicleSimulation.collectMapExitTargets() as RoadPosition[]
  assert.ok(exits.length === 3 && exits.every((exit) => exit.x >= 0), 'cars leave through the outbound lanes only')
  const sim = (game as any).roadVehicleSimulation
  assert.deepEqual(sim.getOffMapRoadExit({ x: 1, z: edge }), { x: 1, z: edge - 1 }, 'vehicles leave the map straight out of their tile')
  assert.ok(sim.isRoadExitCell({ x: 1, z: edge }) && !sim.isRoadExitCell({ x: -2, z: edge }), 'only outbound stub tiles are exit cells')
  assert.ok(sim.isVisitorCarOnIngress({ cell: { x: -2, z: edge }, position: { x: -2, z: edge } }) && !sim.isVisitorCarOnIngress({ cell: { x: 1, z: edge }, position: { x: 1, z: edge } }), 'ingress means the inbound half')
  const trucks = sim.collectDeliveryTruckTargets({ ...vehicle('truck', { x: 0, z: edge + 3 }), kind: 'deliveryTruck', state: 'returning' }) as RoadPosition[]
  assert.ok(trucks.length > 0 && trucks.every((cell) => cell.x >= 0), 'leaving delivery trucks head for tiles that lead off the map')
}

function testLoadedTwoLaneSave(fixture: Fixture): void {
  const game = fixture(0)
  const edge = buildTwoLaneFromStub(game, 10)
  const state = game.snapshot as GameSnapshot
  // Written before lanes existed: both cars face against their lane.
  state.logistics.roadVehicles.push(
    vehicle('wrong-south', { x: 0, z: edge + 5 }, { state: 'returning', target: null, facing: 0, route: [{ x: 0, z: edge + 6 }, { x: 0, z: edge + 7 }] }),
    vehicle('wrong-north', { x: -1, z: edge + 4 }, { state: 'returning', target: null, facing: Math.PI, route: [{ x: -1, z: edge + 3 }, { x: -1, z: edge + 2 }] }),
  )
  const loaded = GameState.fromJSON(JSON.stringify(game.snapshot))!
  const loadedState = loaded.snapshot as GameSnapshot
  const graph = (loaded as any).getRoadGraph() as RoadGraph
  const last = new Map<string, RoadPosition>()
  const moved = new Set<string>()
  for (let tick = 0; tick < 400 && loadedState.logistics.roadVehicles.some((car) => car.id.startsWith('wrong-')); tick += 1) {
    ;(loaded as any).updateLogistics(1)
    for (const car of loadedState.logistics.roadVehicles) {
      if (!car.id.startsWith('wrong-') || !car.cell) continue
      const before = last.get(car.id)
      if (before && (before.x !== car.cell.x || before.z !== car.cell.z)) {
        moved.add(car.id)
        assert.ok(neighborsOf(graph, before.x, before.z).includes(`${car.cell.x},${car.cell.z}`), `${car.id} ${before.x},${before.z} → ${car.cell.x},${car.cell.z} stays on its lanes`)
      }
      last.set(car.id, { ...car.cell })
    }
  }
  assert.ok(moved.has('wrong-south') && moved.has('wrong-north'), 'cars from an old save turn around and keep moving')
  assert.ok(!loadedState.logistics.roadVehicles.some((car) => car.id.startsWith('wrong-')), 'and leave the map through the outbound lanes')
}

function testLaneParking(fixture: Fixture): void {
  const game = fixture(0)
  const edge = buildTwoLaneFromStub(game, 10)
  const state = game.snapshot as GameSnapshot
  // Only a bay beside the southbound lane (x 0): the northbound car must not cut across.
  assert.ok(game.designateParkingArea([{ x: 1, z: edge + 5 }]).ok)
  state.logistics.arrivalGroups.push({ id: 'lane-group', memberIds: [], vehicleId: 'lane-car', mode: 'car', state: 'approaching', arrivedMinute: 0, parkingWaitMinutes: 0, entryFeesPaid: true })
  const car = vehicle('lane-car', { x: -1, z: edge + 3 }, { groupId: 'lane-group', state: 'waiting', route: [], target: null })
  state.logistics.roadVehicles.push(car)
  const graph = (game as any).getRoadGraph() as RoadGraph
  const visited: RoadPosition[] = [{ ...car.cell! }]
  for (let tick = 0; tick < 120 && car.state !== 'parked'; tick += 1) {
    ;(game as any).updateLogistics(1)
    const last = visited.at(-1)!
    if (car.cell && (car.cell.x !== last.x || car.cell.z !== last.z)) visited.push({ ...car.cell })
  }
  assert.ok(car.state === 'parked' || car.state === 'parking', `the car reaches the bay (${car.state})`)
  const onRoad = visited.filter((cell) => cell.x !== 1)
  for (let index = 1; index < onRoad.length; index += 1) {
    const from = onRoad[index - 1]!, to = onRoad[index]!
    assert.ok(neighborsOf(graph, from.x, from.z).includes(`${to.x},${to.z}`), `parking drive ${from.x},${from.z} → ${to.x},${to.z} follows the lanes`)
  }
  assert.ok(visited.some((cell) => cell.x === 0 && cell.z === edge + 10), 'the far-side bay is reached by turning at the end of the road, not across the centre line')
  // Leaving a bay beside the northbound lane: back out, then drive on in lane direction.
  const departure = game.findReachableRoadExit({ x: -1, z: edge + 5 }, 1, undefined, true)
  assert.ok(departure, 'a car leaving the bay finds the exit')
  assert.deepEqual({ x: departure.route[0]!.x, z: departure.route[0]!.z }, { x: -1, z: edge + 6 }, 'it drives on north with its lane')
  assert.ok(departure.route.some((cell) => cell.x === 0), 'and comes back on the southbound lane')
}

function placeAmbulanceBeside(game: GameState, x: number, z: number): { garage: { id: string; x: number; z: number }; ambulance: RoadVehicle } {
  const state = game.snapshot as GameSnapshot
  assert.ok((game as any).place('ambulanceGarage', x, z).ok, 'garage beside the first segment')
  const garage = state.logistics.ambulanceGarages.at(-1)!
  assert.ok((game as any).buyAmbulance(garage.id).ok)
  const ambulance = state.logistics.roadVehicles.find((item) => item.kind === 'ambulance')!
  return { garage, ambulance }
}

/** A park without the fixture's footpaths, so buildings fit beside the entry road. */
function bareGame(): GameState {
  const initial = structuredClone(new GameState().snapshot) as GameSnapshot
  initial.terrain = { heights: {} }
  initial.buildings = []
  initial.festival.planning = false
  initial.scenario.carArrivalShare = 0
  const game = new GameState(initial)
  game.addDebugMoney()
  game.addDebugMoney()
  return game
}

function testStubTurningPoint(): void {
  for (const side of [-3, 1]) {
    const game = bareGame()
    const edge = buildTwoLaneFromStub(game, 16)
    const { garage, ambulance } = placeAmbulanceBeside(game, side, edge + 5)
    const access = (game as any).getLogisticsBuildingAccess(garage, 2) as RoadPosition
    assert.ok(access && access.z > edge, 'the garage opens onto the first lane segment')
    Object.assign(ambulance, { cell: { x: 0, z: edge + 12 }, position: { x: 0, z: edge + 12 }, state: 'idle', route: [], target: null, housed: false, facing: Math.PI })
    for (let tick = 0; tick < 600 && !ambulance.housed; tick += 1) (game as any).updateLogistics(0.1)
    assert.ok(ambulance.housed, `an idle ambulance south of the garage (${side < 0 ? 'west' : 'east'} side) turns on the stub and gets home`)
    const north = (game as any).roadVehicleSimulation.findServiceVehicleRoute({ ...ambulance, cell: { ...access }, position: { ...access }, facing: 0 }, [{ x: -1, z: edge + 14 }, { x: 0, z: edge + 14 }])
    assert.ok(north, 'from the garage it reaches the north end')
  }
}

function testSeparateStubRoads(): void {
  const game = bareGame()
  const state = game.snapshot as GameSnapshot
  const edge = -state.scenario.worldSize / 2
  for (let z = edge + 1; z <= edge + 12; z += 1) for (const x of [-3, 2]) assert.ok(game.designateRoad([{ x, z }]).ok)
  for (const x of [-3, 2]) {
    const exit = game.findReachableRoadExit({ x, z: edge + 6 }, 0, undefined, true)
    assert.ok(exit && exit.route.at(-1)!.x >= 0, `the road at x ${x} still leads off the map`)
  }
  const entries = (game as any).listFreeRoadEntries() as RoadPosition[]
  assert.ok(entries.length > 0, 'arrivals still appear')
  const graph = (game as any).getRoadGraph() as RoadGraph
  const reach = findRoadRoute({ roadCells: state.logistics.roadCells, graph, start: entries[0]!, target: { x: 2, z: edge + 8 } })
  assert.ok(reach, 'and reach the road at x 2')
}

function testMirroredStubOneWays(fixture: Fixture): void {
  const game = fixture(0)
  const edge = buildTwoLaneFromStub(game, 8)
  const state = game.snapshot as GameSnapshot
  for (const cell of state.logistics.roadCells) {
    if (cell.z > edge + 8) continue
    cell.allowedDirections = cell.z === edge + 8 ? (cell.x >= 0 ? 1 << 3 : 1 << 2) : (cell.x >= 0 ? 1 : 4)
  }
  const loaded = GameState.fromJSON(JSON.stringify(game.snapshot))!
  const entries = (loaded as any).listFreeRoadEntries() as RoadPosition[]
  assert.deepEqual(entries.map((entry) => entry.x).sort((a, b) => a - b), [0, 1, 2], 'player one-ways north on x 0..2 take the arrivals')
  const exits = (loaded as any).roadVehicleSimulation.collectMapExitTargets() as RoadPosition[]
  assert.deepEqual(exits.map((exit) => exit.x).sort((a, b) => a - b), [-3, -2, -1], 'player one-ways south on x −3..−1 take the exits')
  const exit = loaded.findReachableRoadExit({ x: -1, z: edge + 4 }, 2, undefined, true)
  assert.ok(exit, 'a car on the southbound one-way leaves the map')
}

function testBayBesideKnot(fixture: Fixture): void {
  const game = fixture(0)
  const state = game.snapshot as GameSnapshot
  game.addDebugMoney()
  // A T: the two-lane road from the entry meets a two-lane road leading west; knot x −1..0, z −7..−6.
  const edge = -state.scenario.worldSize / 2
  const cells = layout(strip([-1, 0], edge + 1, -1), stripX([-7, -6], -8, 0))
  for (const cell of cells) {
    if (!state.logistics.roadCells.some((road) => road.x === cell.x && road.z === cell.z)) assert.ok(game.designateRoad([{ x: cell.x, z: cell.z }]).ok)
  }
  const parkingCell = { x: 1, z: -6 }
  assert.ok(game.designateParkingArea([parkingCell]).ok, 'bay east of the knot')
  // Three knot tiles held by standing vehicles; the fourth is reserved by a car that
  // already started backing out of the bay beside the knot.
  const blockers = [vehicle('b1', { x: -1, z: -7 }), vehicle('b2', { x: -1, z: -6 }), vehicle('b3', { x: 0, z: -7 })]
  for (const blocker of blockers) Object.assign(blocker, { kind: 'ambulance', state: 'idle', route: [], target: null })
  state.logistics.arrivalGroups.push({ id: 'bay-group', memberIds: [], vehicleId: 'bay-car', mode: 'car', state: 'leaving', arrivedMinute: 0, parkingWaitMinutes: 0, entryFeesPaid: true })
  const leaving = vehicle('bay-car', parkingCell, { groupId: 'bay-group', state: 'returning', target: null, facing: Math.PI / 2, route: [{ x: 0, z: -6, elevation: 0 }, { x: 0, z: -7, elevation: 0 }] })
  state.logistics.roadVehicles.push(...blockers, leaving)
  for (let tick = 0; tick < 200 && leaving.state !== 'parked'; tick += 1) (game as any).updateLogistics(0.1)
  assert.equal(leaving.state, 'parked', 'blocked by a full knot, the car parks again instead of waiting forever')
  assert.equal(state.logistics.parkingCells.find((cell) => cell.x === parkingCell.x && cell.z === parkingCell.z)!.occupiedBy, leaving.id, 'it keeps its bay')
  assert.ok(blockers.every((blocker) => blocker.cell && blocker.cell.z >= -7), 'the vehicles in the knot were never blocked by its reservation')
  state.logistics.roadVehicles = state.logistics.roadVehicles.filter((item) => !blockers.includes(item))
  const graph = (game as any).getRoadGraph() as RoadGraph
  const onRoad: RoadPosition[] = []
  for (let tick = 0; tick < 600 && state.logistics.roadVehicles.includes(leaving); tick += 1) {
    ;(game as any).updateLogistics(0.5)
    const cell = leaving.cell
    if (cell && (game as any).getRoadCellAt(cell.x, cell.z) && (onRoad.at(-1)?.x !== cell.x || onRoad.at(-1)?.z !== cell.z)) onRoad.push({ ...cell })
  }
  assert.ok(onRoad.length > 2, 'once the knot clears it backs out into the knot and drives off')
  for (let index = 1; index < onRoad.length; index += 1) {
    const from = onRoad[index - 1]!, to = onRoad[index]!
    assert.ok(neighborsOf(graph, from.x, from.z).includes(`${to.x},${to.z}`), `departure ${from.x},${from.z} → ${to.x},${to.z} follows the lanes`)
  }
}

function instanced(root: Object3D): InstancedMesh[] {
  const found: InstancedMesh[] = []
  root.traverse((object) => { if (object instanceof InstancedMesh) found.push(object) })
  return found
}

/** Road decks bake their textures on a canvas; Node has none, so a stand-in draws nothing. */
function withCanvasStub(run: () => void): void {
  const previous = globalThis.document
  const context = new Proxy({}, { get: () => () => {} })
  ;(globalThis as any).document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) }
  try {
    run()
  } finally {
    ;(globalThis as any).document = previous
  }
}

function testLaneMarkings(): void {
  const straight = layout(strip([0, 1], 0, 9), stripX([10, 11], 0, 9))
  const lanes = classifyRoadLanes(straight, WORLD)
  const centre = roadWayMarks(lanes, at(straight, 0, 4), 'line')
  assert.ok(centre?.strips.some(([x0, , x1]) => x0 === 0.5 && x1 === 0.5), 'the +Z lane draws the centre line on the shared edge')
  const dash = centre!.strips.find(([x0, , x1]) => x0 === 0.5 && x1 === 0.5)!
  assert.ok(Math.abs(dash[3] - dash[1]) < 1, 'dashed on the straight')
  const solid = roadWayMarks(lanes, at(straight, 0, 9), 'line')!.strips.find(([x0, , x1]) => x0 === 0.5 && x1 === 0.5)!
  assert.equal(Math.abs(solid[3] - solid[1]), 1, 'solid right before the knot')
  assert.ok(!roadWayMarks(lanes, at(straight, 1, 4), 'line')?.strips.some(([x0, , x1]) => x0 === -0.5 && x1 === -0.5), 'the partner lane does not draw it twice')
  assert.equal(roadWayMarks(lanes, at(straight, 0, 4), 'none'), undefined, 'no paint on gravel or dirt')
  assert.equal(roadWayMarks(classifyRoadLanes(strip([0], 0, 5), WORLD), road(0, 2), 'line'), undefined, 'single roads have no centre line')

  const corner = layout(strip([0, 1], 0, 5), stripX([4, 5], 0, 8))
  const cornerLanes = classifyRoadLanes(corner, WORLD)
  const inner = roadWayMarks(cornerLanes, at(corner, 1, 4), 'line')!
  assert.equal(inner.strips.length, 8, 'the inner corner tile carries the quarter-circle centre line')
  const outer = roadWayMarks(cornerLanes, at(corner, 0, 5), 'line')!
  assert.ok(outer.kerbs.length > 0 && outer.grass.length === 1, 'the outer corner tile has a rounded kerb and a grass wedge')
  assert.equal(outer.hideKerbs, (1 << 3) | (1 << 0), 'its straight kerbs give way to the curve')
  const cells: WayStructureCell[] = corner.map((cell) => ({ x: cell.x, z: cell.z, elevation: 0, slope: 0, direction: 0, road: true, marks: roadWayMarks(cornerLanes, cell, 'line') }))
  const index = indexWayStructures(cells)
  const outerCell = cells.find((cell) => cell.x === 0 && cell.z === 5)!
  const plan = wayStructurePlan(outerCell, index, 0)
  assert.deepEqual(plan.edges, [], 'no straight kerb on the rounded corner')
  const piece = createWayStructure(outerCell, plan)!
  // A second, identical corner elsewhere shares the geometry; the inner tile does not.
  const far = layout(strip([20, 21], 0, 5), stripX([4, 5], 20, 28))
  const farLanes = classifyRoadLanes(far, WORLD)
  const farCells: WayStructureCell[] = far.map((cell) => ({ x: cell.x, z: cell.z, elevation: 0, slope: 0, direction: 0, road: true, marks: roadWayMarks(farLanes, cell, 'line') }))
  const farOuter = farCells.find((cell) => cell.x === 20 && cell.z === 5)!
  assert.equal(createWayStructure(farOuter, wayStructurePlan(farOuter, indexWayStructures(farCells), 0))!.geometry, piece.geometry, 'identical corner pieces on other tiles share their cached geometry')
  const innerCell = cells.find((cell) => cell.x === 1 && cell.z === 4)!
  assert.notEqual(createWayStructure(innerCell, wayStructurePlan(innerCell, index, 0))!.geometry, piece.geometry, 'a different piece has its own geometry')

  // The whole network: one structure material, a bounded number of batches.
  const view = new LogisticsView()
  // Inside the default world (LogisticsView has not been told another size).
  const cellsForView = [...straight.map((cell) => ({ ...cell })), road(-15, 0, { crosswalk: true }), ...stripX([-21, -20], -12, -4)]
  cellsForView.find((cell) => cell.x === -8 && cell.z === -20)!.crosswalk = true
  withCanvasStub(() => view.update({ roadCells: cellsForView, parkingCells: [], arrivalGroups: [], roadVehicles: [], ambulanceGarages: [], fireStations: [], busStops: [], busDepots: [], busLines: [], wasteDepots: [], specialDepots: [] }, () => 0))
  const batches = instanced(view.getStaticPickRoot())
  const structureMaterials = new Set(batches.filter((mesh) => (mesh.geometry.getAttribute('color') !== undefined)).map((mesh) => mesh.material))
  assert.equal(structureMaterials.size, 1, 'kerbs, lines and corners share the one way-structure material')
  assert.ok(batches.length <= 24, `road markings stay in few batches (${batches.length})`)
  let loose = 0
  view.getStaticPickRoot().traverse((object) => { if (object instanceof Mesh && !(object instanceof InstancedMesh) && object.visible && object.userData.retroStatic) loose += 1 })
  assert.equal(loose, 0, 'no marking stays a mesh of its own')
  assert.equal(roadTrafficAxis(classifyRoadLanes(cellsForView, WORLD), cellsForView.find((cell) => cell.x === -8 && cell.z === -20)!), 'x')
  // Zebra stripes run with the traffic: long along X on a road along X, along Z on a road along Z.
  const zebraBoxes = (roadCells: RoadCell[]) => {
    const zebraView = new LogisticsView()
    withCanvasStub(() => zebraView.update({ roadCells, parkingCells: [], arrivalGroups: [], roadVehicles: [], ambulanceGarages: [], fireStations: [], busStops: [], busDepots: [], busLines: [], wasteDepots: [], specialDepots: [] }, () => 0))
    return instanced(zebraView.getStaticPickRoot())
      .map((mesh) => (mesh.geometry as any).parameters as { width: number; height: number; depth: number } | undefined)
      .filter((size) => size?.height === 0.012)
  }
  const alongX = stripX([-20, -19], -12, -4).map((cell) => cell.x === -8 && cell.z === -20 ? { ...cell, crosswalk: true } : cell)
  assert.deepEqual(zebraBoxes(alongX).map((size) => [size!.width, size!.depth]), [[0.68, 0.08]], 'road along X: stripes long in X')
  const alongZ = strip([-20, -19], -12, -4).map((cell) => cell.x === -20 && cell.z === -8 ? { ...cell, crosswalk: true } : cell)
  assert.deepEqual(zebraBoxes(alongZ).map((size) => [size!.width, size!.depth]), [[0.08, 0.68]], 'road along Z: stripes long in Z')
  // No double line on an open stub or where the player set one-ways on it.
  const edge = -WORLD / 2
  const stubRow = stripX([edge], -3, 2)
  const openStub = layout(stubRow, strip([0], edge + 1, edge + 6))
  assert.equal(roadWayMarks(classifyRoadLanes(openStub, WORLD), at(openStub, 0, edge), 'line'), undefined, 'an open stub has no double line')
  const strictStub = layout(stubRow, strip([-1, 0], edge + 1, edge + 6))
  assert.ok(roadWayMarks(classifyRoadLanes(strictStub, WORLD), at(strictStub, 0, edge), 'line')?.strips.length === 2, 'a joined stub has the double line')
  const oneWayStub = strictStub.map((cell) => cell.z === edge ? { ...cell, allowedDirections: 1 } : cell)
  assert.equal(roadWayMarks(classifyRoadLanes(oneWayStub, WORLD), at(oneWayStub, 0, edge), 'line'), undefined, 'player one-ways on the stub remove the line')
}

function testTrafficLightSide(): void {
  const base = { mode: 'auto', openSlots: [], polarity: 'normal', sensorThreshold: 0, area: [], scheduleTime: 'always', scheduleHours: [], scheduleOffer: 'food', schedulePhases: [] }
  const controls: AccessControlSnapshot = {
    trafficLights: [0, 1, 2, 3].map((direction) => ({ ...base, id: `side-${direction}`, kind: 'trafficLight', sensorKind: 'carsBelow', x: direction * 3, z: 0, direction, signal: 'open' }) as unknown as TrafficLight),
    pathBarriers: [],
  }
  const view = new AccessControlView()
  view.update(controls, () => 0)
  const bodies = instanced(view.group).find((mesh) => mesh.name === 'accessLightBodies')!
  const matrix = new Matrix4(), position = new Vector3()
  const right = [[-1, 0], [0, 1], [1, 0], [0, -1]] as const
  controls.trafficLights.forEach((light, index) => {
    bodies.getMatrixAt(index, matrix)
    position.setFromMatrixPosition(matrix)
    const [rx, rz] = right[light.direction]!
    const side = (position.x - (light.x + 0.5)) * rx + (position.z - (light.z + 0.5)) * rz
    assert.ok(side > 0.3, `the light for direction ${light.direction} stands on the driver's right`)
    // Its stop line lies across the lane at the edge where traffic enters the light's tile.
    bodies.geometry.computeBoundingBox()
    const positions = bodies.geometry.getAttribute('position')
    const line = new Vector3(), vertex = new Vector3()
    let count = 0
    for (let n = 0; n < positions.count; n += 1) {
      vertex.fromBufferAttribute(positions, n)
      if (vertex.y > 0.015 && vertex.y < 0.03) {
        line.add(vertex.applyMatrix4(matrix))
        count += 1
      }
    }
    line.divideScalar(count)
    const [fx, fz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][light.direction]!
    const ahead = (line.x - (light.x + 0.5)) * fx! + (line.z - (light.z + 0.5)) * fz!
    const across = (line.x - (light.x + 0.5)) * rx + (line.z - (light.z + 0.5)) * rz
    assert.ok(ahead < -0.4 && ahead > -0.5, `stop line for direction ${light.direction} at the entry edge (${ahead.toFixed(2)})`)
    assert.ok(Math.abs(across) < 0.05, 'centred across the lane')
  })
}
