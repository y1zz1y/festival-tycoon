import assert from 'node:assert/strict'
import { GameState } from '../src/game/GameState'
import {
  BUILD_ELEVATION_STEP,
  placementGroundCell,
  placementPreviewHeights,
  showsPlacementGroundMarker,
  snapBuildElevation,
  stepBuildElevation,
} from '../src/game/placementPreview'

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

export function testPlacementPreview(): void {
  assert.equal(BUILD_ELEVATION_STEP, 0.5)
  assert.equal(snapBuildElevation(0), 0)
  assert.equal(snapBuildElevation(0.24), 0)
  assert.equal(snapBuildElevation(0.25), 0.5)
  assert.equal(snapBuildElevation(0.6), 0.5)
  assert.equal(snapBuildElevation(0.76), 1)
  assert.equal(snapBuildElevation(1), 1)
  assert.equal(snapBuildElevation(2.4), 2.5)
  assert.equal(snapBuildElevation(9), 6)
  assert.equal(snapBuildElevation(-1), 0)
  assert.equal(snapBuildElevation(Number.NaN), 0)

  assert.equal(stepBuildElevation(0, 1), 0.5)
  assert.equal(stepBuildElevation(0.5, 1), 1)
  assert.equal(stepBuildElevation(1, -1), 0.5)
  assert.equal(stepBuildElevation(0.5, -1), 0)
  assert.equal(stepBuildElevation(6, 1), 6)
  assert.equal(stepBuildElevation(0, -1), 0)
  assert.equal(stepBuildElevation(1.2, 0), 1)

  const game = blankGame()
  game.setTool('food')
  game.adjustBuildElevation(1)
  assert.equal(game.snapshot.buildElevation, 0.5)
  game.adjustBuildElevation(1)
  assert.equal(game.snapshot.buildElevation, 1)
  game.setBuildElevation(0.6)
  assert.equal(game.snapshot.buildElevation, 0.5)
  game.setBuildElevation(2.4)
  assert.equal(game.snapshot.buildElevation, 2.5)

  const placed = game.place('food', 8, -4)
  assert.ok(placed.ok, placed.message)
  const stall = game.snapshot.buildings.find((item) => item.kind === 'food' && item.x === 8)
  assert.equal(stall?.elevation, 2.5, 'placed buildings keep the half-step height')

  const raised = placementPreviewHeights(3, 1.5)
  assert.equal(raised.groundY, 3)
  assert.equal(raised.placementY, 4.5)

  const marker = placementGroundCell({ x: 8, z: -4 }, 3)
  assert.deepEqual(marker, { x: 8, z: -4, y: 3 })
  assert.notEqual(marker?.y, raised.placementY, 'floor marker stays on the Bodenkachel')
  assert.equal(placementGroundCell(null, 3), null)

  assert.equal(showsPlacementGroundMarker('food'), true)
  assert.equal(showsPlacementGroundMarker('path'), true)
  assert.equal(showsPlacementGroundMarker('road'), true)
  assert.equal(showsPlacementGroundMarker('statue'), true)
  assert.equal(showsPlacementGroundMarker('coaster'), true)
  assert.equal(showsPlacementGroundMarker('bulldoze'), true)
  assert.equal(showsPlacementGroundMarker('inspect'), false)
  assert.equal(showsPlacementGroundMarker('food', true), false)
  assert.equal(showsPlacementGroundMarker(null), false)
}
