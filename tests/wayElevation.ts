import assert from 'node:assert/strict'
import { GameState } from '../src/game/GameState'
import type { GameSnapshot, PlacedBuilding } from '../src/game/GameState'
import { findRoadRoute } from '../src/game/logistics'
import {
  MAX_PATH_ELEVATION,
  MAX_ROAD_RAISE,
  WAY_ELEVATION_STEP,
  lockShiftElevationOrigin,
  planLockedOriginRamp,
} from '../src/game/wayElevation'

function blankGame(): GameState {
  const initial = structuredClone(new GameState().snapshot)
  initial.terrain = { heights: {} }
  initial.buildings = []
  initial.festival.planning = false
  initial.parkOpen = true
  const game = new GameState(initial)
  game.addDebugMoney()
  return game
}

export function testWayElevation(): void {
  assert.equal(WAY_ELEVATION_STEP, 0.5)
  assert.equal(MAX_ROAD_RAISE, 1)
  assert.equal(MAX_PATH_ELEVATION, 6)

  const paths = blankGame()
  assert.ok(paths.placePathSegment(4, -8, 0).ok, 'flat footpath')
  assert.ok(paths.placePathSegment(4, -7, 0.5, 'normal', 0, 0.5).ok, 'half-step footpath ramp')
  assert.ok(paths.placePathSegment(4, -6, 1, 'normal', 0, 0.5).ok, 'second half-step')
  assert.ok(paths.placePathSegment(4, -5, 1.5, 'normal', 0, 0.5).ok, 'footpaths may exceed the car cap')
  const walk = (paths as unknown as { findPath: Function }).findPath(
    { x: 4, z: -8, elevation: 0 },
    [{ x: 4, z: -5, elevation: 1.5 }],
  )
  assert.ok(walk && walk.length >= 3, 'pedestrians walk half-step ramps')
  const highPath = paths.snapshot.buildings.find((building) => building.x === 4 && building.z === -5)
  assert.equal(highPath?.elevation, 1.5)
  assert.equal(highPath?.pathSlope, 0.5)

  const stacked = blankGame()
  assert.ok(stacked.placePathSegment(6, -4, 0.5).ok)
  assert.ok(stacked.placePathSegment(6, -4, 1).ok, '0.5 and 1.0 on one cell stay distinct')
  const atHalf = stacked.getPathAt(6, -4, 0.5)
  const atFull = stacked.getPathAt(6, -4, 1)
  assert.ok(atHalf && atFull && atHalf.id !== atFull.id, 'packCell distinguishes half-steps')

  const roads = blankGame()
  assert.ok(roads.placeRoadSegment(0, -10, 0).ok, 'flat road')
  assert.ok(roads.placeRoadSegment(0, -9, 0.5, 0.5, 0).ok, 'half-step road ramp')
  assert.ok(roads.placeRoadSegment(0, -8, 1, 0.5, 0).ok, 'road at one height unit')
  const tooHigh = roads.placeRoadSegment(0, -7, 1.5, 0.5, 0)
  assert.equal(tooHigh.ok, false, 'cars cannot climb above 1.0 above terrain')
  const climb = findRoadRoute({
    roadCells: roads.snapshot.logistics.roadCells,
    start: { x: 0, z: -10 },
    target: { x: 0, z: -8 },
  })
  assert.ok(climb && climb.length >= 2, 'cars drive two half-steps')
  const topRoad = roads.getRoadCellAt(0, -8)
  assert.equal(topRoad?.elevation, 1)
  assert.equal(topRoad?.roadSlope, 0.5)

  const both = blankGame()
  assert.ok(both.placePathSegment(2, -12, 0).ok)
  assert.ok(both.placePathSegment(2, -11, 0.5, 'normal', 0, 0.5).ok)
  assert.ok(both.placeRoadSegment(3, -12, 0).ok)
  assert.ok(both.placeRoadSegment(3, -11, 0.5, 0.5, 0).ok)
  assert.ok(both.getPathAt(2, -11, 0.5)?.pathSlope === 0.5)
  assert.ok(both.getRoadCellAt(3, -11)?.roadSlope === 0.5)

  const legacy = blankGame()
  assert.ok(legacy.placePathSegment(8, -6, 0).ok)
  assert.ok(legacy.placePathSegment(8, -5, 1, 'normal', 0, 1).ok, 'legacy full-unit ramp still places')
  const raw = structuredClone(legacy.snapshot) as GameSnapshot
  for (const road of raw.logistics.roadCells) {
    delete road.elevation
    delete road.roadSlope
    delete road.roadSlopeDirection
  }
  const steep = raw.buildings.find((building) => building.x === 8 && building.z === -5) as PlacedBuilding
  steep.elevation = 1
  steep.pathSlope = 1
  const loaded = new GameState(raw)
  const restoredPath = loaded.snapshot.buildings.find((building) => building.x === 8 && building.z === -5)
  assert.equal(restoredPath?.elevation, 1, 'old height 1 stays 1.0 world units')
  assert.equal(restoredPath?.pathSlope, 1, 'old full-unit slope is kept')
  for (const road of loaded.snapshot.logistics.roadCells) {
    assert.equal(road.elevation, loaded.getTerrainHeight(road.x, road.z), 'old roads sit on terrain')
    assert.equal(road.roadSlope ?? 0, 0)
  }
  const legacyWalk = (loaded as unknown as { findPath: Function }).findPath(
    { x: 8, z: -6, elevation: 0 },
    [{ x: 8, z: -5, elevation: 1 }],
  )
  assert.ok(legacyWalk && legacyWalk.length >= 1, 'legacy full-unit ramps stay walkable')

  const origin = { x: 4, z: -8, elevation: 0 }
  const firstHover = { x: 4, z: -7 }
  const first = planLockedOriginRamp(origin, firstHover, 0.5)
  assert.deepEqual(first.origin, origin, 'planner copies origin without moving it')
  assert.equal(first.direction, 0)
  assert.equal(first.steps.length, 1)
  assert.equal(first.steps[0]?.x, 4)
  assert.equal(first.steps[0]?.z, -7)
  assert.equal(first.steps[0]?.elevation, 0.5)
  assert.ok(
    first.steps.every((step) => step.x !== origin.x || step.z !== origin.z),
    'origin tile is not a paint target',
  )

  const dragged = planLockedOriginRamp(first.origin, { x: 4, z: -6 }, 0.5)
  assert.deepEqual(dragged.origin, origin, 'origin stays put while Shift-drag aims at further neighbors')
  assert.equal(dragged.steps.length, 2)
  assert.equal(dragged.steps[1]?.elevation, 1)
  assert.equal(dragged.steps[1]?.z, -6)

  const locked = lockShiftElevationOrigin(origin, { x: 5, z: -8, elevation: 2 })
  assert.deepEqual(locked, origin, 'later hover must not rebase the Shift origin')
  assert.equal(lockShiftElevationOrigin(null, origin), origin)

  const painted = blankGame()
  assert.ok(painted.placePathSegment(origin.x, origin.z, origin.elevation).ok)
  for (const step of dragged.steps) {
    assert.ok(
      painted.placePathSegment(step.x, step.z, step.elevation, 'normal', step.direction, step.slope).ok,
    )
  }
  const start = painted.getPathAt(origin.x, origin.z, origin.elevation)
  assert.equal(start?.x, origin.x)
  assert.equal(start?.z, origin.z)
  assert.equal(start?.elevation, 0, 'painted neighbors leave the origin height unchanged')
  assert.equal(start?.pathSlope ?? 0, 0, 'origin slope stays flat')
  assert.equal(painted.getPathAt(4, -7, 0.5)?.pathSlope, 0.5)
  assert.equal(painted.getPathAt(4, -6, 1)?.elevation, 1)

  const roadPaint = blankGame()
  assert.ok(roadPaint.placeRoadSegment(0, -10, 0).ok)
  const roadPlan = planLockedOriginRamp({ x: 0, z: -10, elevation: 0 }, { x: 0, z: -8 }, 0.5)
  assert.deepEqual(roadPlan.origin, { x: 0, z: -10, elevation: 0 })
  for (const step of roadPlan.steps) {
    assert.ok(roadPaint.placeRoadSegment(step.x, step.z, step.elevation, step.slope, step.direction).ok)
  }
  assert.equal(roadPaint.getRoadCellAt(0, -10)?.elevation, 0, 'road origin stays at its start height')
  assert.equal(roadPaint.getRoadCellAt(0, -10)?.roadSlope ?? 0, 0)
  assert.equal(roadPaint.getRoadCellAt(0, -8)?.elevation, 1)

  const overlap = blankGame()
  assert.ok(overlap.placeRoadSegment(5, -10, 0).ok)
  assert.ok(overlap.placeRoadSegment(6, -10, 0).ok)
  assert.ok(overlap.placeRoadSegment(7, -10, 0).ok)
  const pathOnRoad = overlap.placePathSegment(6, -10, 0)
  assert.ok(pathOnRoad.ok, 'a footpath may share a car-road cell')
  assert.ok(overlap.getRoadCellAt(5, -10), 'unpainted west neighbor stays')
  assert.ok(overlap.getRoadCellAt(6, -10), 'the painted auto-road is not deleted')
  assert.ok(overlap.getRoadCellAt(7, -10), 'unpainted east neighbor stays')
  assert.ok(overlap.getPathAt(6, -10, 0), 'crossing path is stored on the road cell')
  assert.equal(overlap.getRoadCellAt(6, -10)?.crosswalk, true, 'same-grade path marks a crossing')
  assert.equal(
    overlap.snapshot.logistics.roadCells.filter((cell) => cell.z === -10 && cell.x >= 5 && cell.x <= 7).length,
    3,
  )
  const across = findRoadRoute({
    roadCells: overlap.snapshot.logistics.roadCells,
    start: { x: 5, z: -10 },
    target: { x: 7, z: -10 },
  })
  assert.ok(across && across.length >= 2, 'cars still drive through the crossing')

  const raised = blankGame()
  assert.ok(raised.placeRoadSegment(2, -8, 0).ok)
  assert.ok(raised.placeRoadSegment(2, -7, 0.5, 0.5, 0).ok)
  assert.ok(raised.placeRoadSegment(2, -6, 1, 0.5, 0).ok)
  assert.ok(raised.placePathSegment(2, -6, 1).ok, 'path at the raised road grade stays a crossing')
  assert.ok(raised.getRoadCellAt(2, -6), 'raised auto-road remains under the path')
  assert.ok(raised.getRoadCellAt(2, -7) && raised.getRoadCellAt(2, -8), 'ramp neighbors stay')

  const overpass = blankGame()
  assert.ok(overpass.placeRoadSegment(3, -6, 0).ok)
  assert.ok(overpass.placePathSegment(3, -6, 1).ok, 'one step above is a bridge, not a delete')
  assert.ok(overpass.getRoadCellAt(3, -6), 'overpass keeps the car road')
  assert.equal(overpass.getRoadCellAt(3, -6)?.crosswalk, false, 'a bridge does not paint a zebra')

  const queueBlocked = blankGame()
  assert.ok(queueBlocked.placeRoadSegment(4, -6, 0).ok)
  assert.equal(queueBlocked.placePathSegment(4, -6, 0, 'queue').ok, false, 'queues cannot occupy a car road')
  assert.ok(queueBlocked.getRoadCellAt(4, -6), 'refused queue leaves the road')

  const paintOne = blankGame()
  assert.ok(paintOne.placeRoadSegment(8, -12, 0).ok)
  assert.ok(paintOne.placeRoadSegment(9, -12, 0).ok)
  assert.ok(paintOne.placeRoadSegment(10, -12, 0).ok)
  assert.ok(paintOne.placeRoadSegment(9, -12, 0, 0, 0, 'roadDirt').ok)
  assert.ok(paintOne.getRoadCellAt(8, -12) && paintOne.getRoadCellAt(10, -12), 'repaint does not wipe neighbors')
  assert.equal(paintOne.getRoadCellAt(9, -12)?.speedLimit, 10)
  assert.equal(
    paintOne.snapshot.logistics.roadCells.filter((cell) => cell.z === -12 && cell.x >= 8 && cell.x <= 10).length,
    3,
  )

  const parking = blankGame()
  assert.ok(parking.placeRoadSegment(1, -4, 0).ok)
  assert.ok(parking.designateParkingArea([{ x: 2, z: -4 }]).ok)
  assert.ok(parking.placePathSegment(1, -4, 0).ok)
  assert.ok(parking.getRoadCellAt(1, -4), 'path on road does not remove the road')
  assert.ok(
    parking.snapshot.logistics.parkingCells.some((cell) => cell.x === 2 && cell.z === -4),
    'adjacent parking is not collateral-deleted',
  )

  const area = blankGame()
  assert.ok(area.placeRoadSegment(0, -5, 0).ok)
  assert.ok(
    area.manageFestival({
      type: 'wayArea',
      from: { x: 0, z: -5 },
      to: { x: 0, z: -5 },
      kind: 'footDirt',
    }).ok,
  )
  assert.ok(area.getRoadCellAt(0, -5), 'way-area footpath keeps the auto-road')
  assert.ok(area.getPathAt(0, -5, 0))

  const stack = blankGame()
  assert.ok(stack.placeRoadSegment(5, -14, 0).ok)
  assert.ok(stack.placeRoadSegment(6, -14, 0).ok)
  assert.ok(stack.placeRoadSegment(7, -14, 0).ok)
  const bridge = stack.placeRoadSegment(6, -14, 1)
  assert.ok(bridge.ok, 'a road half-step or more above another road stacks')
  const lower = stack.getRoadCellAt(6, -14, 0)
  const upper = stack.getRoadCellAt(6, -14, 1)
  assert.ok(lower && upper && lower !== upper, 'both road layers stay on the same tile')
  assert.equal(lower.elevation, 0)
  assert.equal(upper.elevation, 1)
  assert.ok(stack.getRoadCellAt(5, -14, 0) && stack.getRoadCellAt(7, -14, 0), 'neighbors of the lower road stay')
  assert.equal(
    stack.snapshot.logistics.roadCells.filter((cell) => cell.z === -14 && cell.x >= 5 && cell.x <= 7).length,
    4,
    'stack adds a layer instead of replacing the tile',
  )
  const lowerRoute = findRoadRoute({
    roadCells: stack.snapshot.logistics.roadCells,
    start: { x: 5, z: -14, elevation: 0 },
    target: { x: 7, z: -14, elevation: 0 },
  })
  assert.ok(lowerRoute && lowerRoute.length >= 2, 'cars still use the lower road under the bridge')
  assert.ok(
    lowerRoute.some((cell) => cell.x === 6 && cell.z === -14 && (cell.elevation ?? 0) === 0),
    'the lower route stays on the ground layer',
  )
  const sameGrade = stack.placeRoadSegment(6, -14, 0, 0, 0, 'roadDirt')
  assert.ok(sameGrade.ok)
  assert.ok(stack.getRoadCellAt(6, -14, 0) && stack.getRoadCellAt(6, -14, 1), 'same-grade paint does not eat the bridge')
  assert.equal(stack.getRoadCellAt(6, -14, 0)?.speedLimit, 10)

  console.log('PASS half-step path/road ramps, car height cap, legacy elevation and locked Shift origin')
}
