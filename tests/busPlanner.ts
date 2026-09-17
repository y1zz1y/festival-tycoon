import assert from 'node:assert/strict'
import { GameState, type GameSnapshot } from '../src/game/GameState'
import {
  applyBusPlannerDrag,
  busLineLoopLength,
  plannerListsShareNoStop,
  previewBusLineMarkers,
  splitBusPlannerStops,
} from '../src/game/busPlanner'

export function testBusPlanner(fixture: (count?: number) => GameState): void {
  const all = ['a', 'b', 'c', 'd']
  const lists = splitBusPlannerStops(all, ['c', 'a', 'c', 'missing'])
  assert.deepEqual(lists.active, ['c', 'a'])
  assert.deepEqual(lists.available, ['b', 'd'])
  assert.equal(plannerListsShareNoStop(lists), true, 'a stop never appears in both columns')

  const activated = applyBusPlannerDrag(all, lists.active, {
    source: 'available',
    stopId: 'b',
    target: 'active',
    at: 1,
  })
  assert.deepEqual(activated.active, ['c', 'b', 'a'])
  assert.deepEqual(activated.available, ['d'])
  assert.equal(plannerListsShareNoStop(activated), true)

  const reordered = applyBusPlannerDrag(all, activated.active, {
    source: 'active',
    stopId: 'a',
    target: 'active',
    at: 0,
  })
  assert.deepEqual(reordered.active, ['a', 'c', 'b'])
  assert.deepEqual(reordered.available, ['d'])

  const dropped = applyBusPlannerDrag(all, reordered.active, {
    source: 'active',
    stopId: 'c',
    target: 'available',
  })
  assert.deepEqual(dropped.active, ['a', 'b'])
  assert.deepEqual(dropped.available, ['c', 'd'])
  assert.equal(plannerListsShareNoStop(dropped), true)

  const game = fixture(0)
  const state = game.snapshot as GameSnapshot
  game.addDebugMoney()
  const edge = -state.scenario.worldSize / 2
  for (let z = edge; z <= -12; z += 1) {
    if (!state.logistics.roadCells.some((cell) => cell.x === 0 && cell.z === z)) {
      assert.ok(game.designateRoad([{ x: 0, z }]).ok)
    }
    assert.ok(game.placePathSegment(1, z, 0).ok)
  }
  assert.ok(game.place('busDepot', -3, -18).ok)
  assert.ok(game.place('busStop', 1, -18).ok)
  assert.ok(game.place('busStop', 1, -16).ok)
  assert.ok(game.place('busStop', 1, -14).ok)
  assert.ok(game.place('busStop', 1, -12).ok)
  const stops = state.logistics.busStops
  const byZ = (z: number) => stops.find((stop) => stop.x === 1 && stop.z === z)
  const first = byZ(-18)
  const second = byZ(-16)
  const third = byZ(-14)
  const fourth = byZ(-12)
  assert.ok(first && second && third && fourth)
  const shuffled = [first.id, third.id, second.id, fourth.id]
  const columns = splitBusPlannerStops(
    stops.map((stop) => stop.id),
    shuffled,
  )
  assert.equal(plannerListsShareNoStop(columns), true)
  assert.equal(
    columns.available.some((id) => shuffled.includes(id)),
    false,
    'active stops leave the available pool',
  )
  const markers = previewBusLineMarkers(stops, shuffled)
  assert.deepEqual(
    markers.map((marker) => marker.stopId),
    shuffled,
  )
  assert.deepEqual(
    markers.map((marker) => marker.index),
    [1, 2, 3, 4],
    'overlay numbers follow the driving order',
  )
  const preview = game.previewBusLineMarkers(shuffled, 'line-open')
  assert.deepEqual(preview.map((marker) => marker.index), [1, 2, 3, 4])
  assert.ok(preview.every((marker) => marker.lineId === 'line-open'))

  const depot = state.logistics.busDepots[0]!
  const sorted = game.sortBusLineStops(shuffled, depot.id)
  const again = game.sortBusLineStops(shuffled, depot.id)
  assert.deepEqual(sorted, again, 'auto-sort is deterministic')
  assert.deepEqual([...sorted].sort(), [...shuffled].sort(), 'auto-sort keeps the same stops')
  const sortedLength = busLineLoopLength({
    roadCells: state.logistics.roadCells,
    stops,
    stopIds: sorted,
    worldSize: state.scenario.worldSize,
  })
  const shuffledLength = busLineLoopLength({
    roadCells: state.logistics.roadCells,
    stops,
    stopIds: shuffled,
    worldSize: state.scenario.worldSize,
  })
  assert.ok(
    sortedLength <= shuffledLength,
    `auto-sort must shorten or equal the shuffled loop (${sortedLength} <= ${shuffledLength})`,
  )
  const sortedMarkers = game.previewBusLineMarkers(sorted)
  assert.deepEqual(
    sortedMarkers.map((marker) => marker.stopId),
    sorted,
    'numbered overlay matches the sorted sequence',
  )
}
