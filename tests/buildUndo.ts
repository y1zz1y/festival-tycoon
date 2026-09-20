import assert from 'node:assert/strict'
import { captureBlueprint } from '../src/game/blueprints'
import { BUILDINGS } from '../src/game/catalog'
import { GameState } from '../src/game/GameState'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'

function emptyPark(): GameState {
  const initial = structuredClone(new GameState().snapshot)
  initial.buildings = []
  initial.logistics.roadCells = []
  initial.logistics.parkingCells = []
  initial.money = 50_000
  initial.terrain = { heights: {} }
  return new GameState(initial)
}

export function testBuildUndo(): void {
  const empty = emptyPark()
  assert.equal(empty.canUndoLastBuild(), false)
  assert.equal(empty.undoLastBuild().ok, false)

  const placed = emptyPark()
  const moneyBeforePlace = placed.snapshot.money
  assert.ok(placed.place('statue', 6, 4, 0).ok)
  assert.equal(placed.canUndoLastBuild(), true)
  const undoPlace = placed.undoLastBuild()
  assert.ok(undoPlace.ok, undoPlace.message)
  assert.equal(placed.snapshot.buildings.some((building) => building.kind === 'statue'), false)
  assert.equal(placed.snapshot.money, moneyBeforePlace)
  assert.equal(placed.canUndoLastBuild(), false)

  const parking = emptyPark()
  const moneyBeforeParking = parking.snapshot.money
  assert.ok(parking.designateParkingArea([{ x: 5, z: 5 }, { x: 6, z: 5 }]).ok)
  assert.equal(parking.snapshot.logistics.parkingCells.length, 2)
  const undoParking = parking.undoLastBuild()
  assert.ok(undoParking.ok, undoParking.message)
  assert.equal(parking.snapshot.logistics.parkingCells.length, 0)
  assert.equal(parking.snapshot.money, moneyBeforeParking)

  const stamp = emptyPark()
  assert.ok(stamp.place('statue', 8, 2, 0).ok)
  assert.ok(stamp.designateParkingArea([{ x: 9, z: 2 }]).ok)
  const blueprint = captureBlueprint(
    stamp.snapshot,
    [
      { x: 8, z: 2 },
      { x: 9, z: 2 },
    ],
    (x, z) => stamp.getTerrainHeight(x, z),
  )
  const target = emptyPark()
  const moneyBeforeStamp = target.snapshot.money
  assert.ok(target.stampBlueprint(12, 6, 0, blueprint.items).ok)
  assert.ok(target.snapshot.buildings.some((building) => building.kind === 'statue' && building.x === 12))
  assert.ok(target.snapshot.logistics.parkingCells.some((cell) => cell.x === 13 && cell.z === 6))
  const undoStamp = target.undoLastBuild()
  assert.ok(undoStamp.ok, undoStamp.message)
  assert.equal(target.snapshot.buildings.some((building) => building.kind === 'statue'), false)
  assert.equal(target.snapshot.logistics.parkingCells.length, 0)
  assert.equal(target.snapshot.money, moneyBeforeStamp)

  const path = emptyPark()
  const moneyBeforePath = path.snapshot.money
  assert.ok(path.placePathSegment(4, 4, 0).ok)
  assert.ok(path.snapshot.buildings.some((building) => building.kind === 'path' && building.x === 4 && building.z === 4))
  const undoPath = path.undoLastBuild()
  assert.ok(undoPath.ok, undoPath.message)
  assert.equal(
    path.snapshot.buildings.some((building) => building.kind === 'path' && building.x === 4 && building.z === 4),
    false,
  )
  assert.equal(path.snapshot.money, moneyBeforePath)

  const stacked = emptyPark()
  const extras = () => stacked.snapshot.buildings.filter((building) => building.id !== 'entrance-path')
  assert.ok(stacked.place('statue', 3, 3, 0).ok)
  assert.ok(stacked.place('flowerbed', 4, 3, 1).ok)
  assert.ok(stacked.undoLastBuild().ok)
  assert.equal(extras().filter((building) => building.kind === 'flowerbed').length, 0)
  assert.equal(extras().filter((building) => building.kind === 'statue').length, 1)
  assert.ok(stacked.undoLastBuild().ok)
  assert.equal(extras().length, 0)
  assert.ok(BUILDINGS.statue.cost > 0)
  assert.ok(SIMULATION_CONFIG.logistics.parkingDesignationCost > 0)
}
