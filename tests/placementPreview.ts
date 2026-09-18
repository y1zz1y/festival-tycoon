import { draggedBuildElevation, buildElevationAbove } from '../src/game/placementPreview'
import assert from 'node:assert/strict'
import { GameState } from '../src/game/GameState'
import { BUILDING_KINDS } from '../src/game/catalog'
import { ROOF_KINDS } from '../src/game/decorationWalls'
import type { PlacementPreviewRequest } from '../src/game/placementPreview'
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

function assertReadOnlyPreview(game: GameState, request: PlacementPreviewRequest): ReturnType<GameState['previewPlacement']> {
  const before = JSON.stringify(game.snapshot)
  const result = game.previewPlacement(request)
  assert.equal(JSON.stringify(game.snapshot), before, 'placement preview must not mutate the snapshot')
  return result
}

function assertBuildingPreviewMatches(
  game: GameState,
  kind: (typeof BUILDING_KINDS)[number],
  x: number,
  z: number,
  decorationSlot?: number,
): void {
  const expected = game.canPlace(kind, x, z, decorationSlot)
  const preview = assertReadOnlyPreview(game, {
    type: 'building',
    kind,
    x,
    z,
    decorationSlot,
  })
  assert.equal(preview.ok, expected.ok, `${kind}: preview validity`)
  assert.equal(preview.message, expected.message, `${kind}: preview message`)
}

export function testPlacementPreview(): void {
  assert.equal(draggedBuildElevation(1, 400, 399), 1)
  assert.equal(draggedBuildElevation(1, 400, 353), 1)
  assert.equal(draggedBuildElevation(1, 400, 352), 1.5)
  assert.equal(draggedBuildElevation(1, 400, 448), .5)
  assert.equal(draggedBuildElevation(1, 400, 400), 1)
  assert.equal(buildElevationAbove(1.45, .5), 1)
  assert.equal(buildElevationAbove(1.5, .5), 1)

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

  const matrix = blankGame()
  for (const kind of BUILDING_KINDS) {
    assertBuildingPreviewMatches(matrix, kind, 12, 12)
  }

  const scenery = blankGame()
  assertBuildingPreviewMatches(scenery, 'statue', 2, 2, 0)
  assert.ok(scenery.place('statue', 2, 2, 0).ok)
  assertBuildingPreviewMatches(scenery, 'statue', 2, 2, 0)
  assertBuildingPreviewMatches(scenery, 'statue', 2, 2, 1)
  assertBuildingPreviewMatches(scenery, 'hedge', 3, 2, 0)

  const bus = blankGame()
  bus.setBuildElevation(0)
  assert.ok(bus.placePathSegment(0, 0, 0).ok)
  assert.ok(bus.placeRoadSegment(1, 0, 0).ok)
  assertBuildingPreviewMatches(bus, 'busStop', 0, 0)
  assertBuildingPreviewMatches(bus, 'busStop', 4, 4)

  const backstage = blankGame()
  assert.ok(backstage.designateBackstageArea([{ x: 0, z: 0 }]).ok)
  assert.ok(backstage.placeRoadSegment(1, 0, 0).ok)
  assertBuildingPreviewMatches(backstage, 'tourBusParking', 0, 0)
  assertBuildingPreviewMatches(backstage, 'tourBusParking', 4, 4)

  const medical = blankGame()
  assert.ok(medical.designateMedicalArea([{ x: 0, z: 0 }]).ok)
  assertBuildingPreviewMatches(medical, ROOF_KINDS[0], 0, 0, 4)
  assertBuildingPreviewMatches(medical, 'food', 0, 0)

  const roadDepot = blankGame()
  assert.ok(roadDepot.placeRoadSegment(2, 0, 0).ok)
  assertBuildingPreviewMatches(roadDepot, 'ambulanceGarage', 0, 0)
  assertBuildingPreviewMatches(roadDepot, 'wasteDepot', 0, 0)

  const pathDepot = blankGame()
  assert.ok(pathDepot.placePathSegment(3, 0, 0).ok)
  assertBuildingPreviewMatches(pathDepot, 'specialDepot', 0, 0)
  assertBuildingPreviewMatches(pathDepot, 'busDepot', 0, 0)

  const blueprint = blankGame()
  const blueprintRequest: PlacementPreviewRequest = {
    type: 'blueprint',
    originX: 5,
    originZ: 5,
    rotation: 0,
    items: [
      {
        type: 'building',
        kind: 'food',
        dx: 0,
        dz: 0,
        rotation: 0,
        elevationOffset: 0,
      },
    ],
  }
  const blueprintPreview = assertReadOnlyPreview(blueprint, blueprintRequest)
  const directBlueprint = blueprint.previewBlueprint(5, 5, 0, blueprintRequest.items)
  assert.equal(blueprintPreview.ok, directBlueprint.ok)
  assert.equal(blueprintPreview.message, directBlueprint.message)

  const rideAccessGame = blankGame()
  rideAccessGame.snapshot.buildings.push({
    id: 'ride-preview',
    kind: 'ride',
    x: 0,
    z: 0,
    rotation: 0,
    elevation: 0,
    price: 0,
  })
  const accessPreview = assertReadOnlyPreview(rideAccessGame, {
    type: 'rideAccess',
    buildingId: 'ride-preview',
    accessType: 'entrance',
    x: 1,
    z: 0,
  })
  const accessExpected = rideAccessGame.canPlaceRideAccess('ride-preview', 'entrance', 1, 0)
  assert.equal(accessPreview.ok, accessExpected.ok)
  assert.equal(accessPreview.message, accessExpected.message)

  const area = blankGame()
  for (const request of [
    { type: 'tool', tool: 'medicalArea', x: 7, z: 7 },
    { type: 'tool', tool: 'wasteDump', x: 8, z: 7 },
    { type: 'tool', tool: 'backstageArea', x: 9, z: 7, enabled: true },
  ] as const satisfies readonly PlacementPreviewRequest[]) {
    assertReadOnlyPreview(area, request)
  }
}
