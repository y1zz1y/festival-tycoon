import assert from 'node:assert/strict'
import {
  captureBlueprint,
  describeBlueprint,
  rotateDecorationSlot,
  rotateOffset,
  transformBlueprintItems,
} from '../src/game/blueprints'
import {
  deleteBlueprintLibraryEntry,
  listBlueprintLibrary,
  saveBlueprintLibraryEntry,
} from '../src/game/blueprintLibrary'
import { BLUEPRINT_LIBRARY_KEY, BUILDINGS } from '../src/game/catalog'
import { GameState } from '../src/game/GameState'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'

function emptyPark(): GameState {
  const initial = structuredClone(new GameState().snapshot)
  initial.buildings = []
  initial.logistics.roadCells = []
  initial.money = 50_000
  initial.terrain = { heights: {} }
  return new GameState(initial)
}

export function testBlueprints(): void {
  assert.deepEqual(rotateOffset(1, 0, 1), { dx: 0, dz: -1 })
  assert.equal(rotateDecorationSlot('statue', 0, 1), 2)
  assert.equal(rotateDecorationSlot('hedge', 0, 1), 1)
  assert.equal(rotateDecorationSlot('tree', undefined, 1), undefined)
  assert.equal(rotateDecorationSlot('parasol', 4, 1), 4)

  const game = emptyPark()
  assert.ok(game.place('statue', 8, 2, 0).ok)
  assert.ok(game.place('flowerbed', 9, 2, 1).ok)
  const sourceCount = game.snapshot.buildings.length
  const moneyBeforePreview = game.snapshot.money

  const blueprint = captureBlueprint(
    game.snapshot,
    [
      { x: 8, z: 2 },
      { x: 9, z: 2 },
      { x: 8, z: 3 },
      { x: 9, z: 3 },
    ],
    (x, z) => game.getTerrainHeight(x, z),
  )
  assert.equal(blueprint.width, 2)
  assert.equal(blueprint.depth, 2)
  assert.equal(blueprint.items.length, 2)
  assert.equal(
    blueprint.items.filter((item) => item.type === 'building' && item.kind === 'statue').length,
    1,
  )
  assert.equal(
    blueprint.items.filter((item) => item.type === 'building' && item.kind === 'flowerbed').length,
    1,
  )
  assert.ok(describeBlueprint(blueprint).includes('2×2'))

  const preview = game.previewBlueprint(12, 6, 0, blueprint.items)
  assert.equal(preview.placements.length, 2)
  assert.equal(preview.placements.every((entry) => entry.valid), true)
  assert.equal(game.snapshot.buildings.length, sourceCount, 'preview must not place anything')
  assert.equal(game.snapshot.money, moneyBeforePreview, 'preview must not charge')

  const result = game.stampBlueprint(12, 6, 0, blueprint.items)
  assert.ok(result.ok, result.message)
  const stamped = game.snapshot.buildings.filter((building) => building.x >= 12 && building.z >= 6)
  assert.equal(stamped.length, 2, 'both scenery exist after stamp')
  assert.ok(stamped.some((building) => building.kind === 'statue' && building.decorationSlot === 0))
  assert.ok(stamped.some((building) => building.kind === 'flowerbed' && building.decorationSlot === 1))
  const expectedCharge = Math.ceil(
    (BUILDINGS.statue.cost + BUILDINGS.flowerbed.cost) *
      SIMULATION_CONFIG.economy.blueprintCopyCostFactor,
  )
  assert.equal(game.snapshot.money, moneyBeforePreview - expectedCharge)

  const rotated = transformBlueprintItems(blueprint.items, 1)
  assert.notDeepEqual(
    rotated.map((item) => [item.dx, item.dz]),
    blueprint.items.map((item) => [item.dx, item.dz]),
  )
}

export function testBlueprintParkingCopy(): void {
  const game = emptyPark()
  const designated = game.designateParkingArea([
    { x: 8, z: 2 },
    { x: 9, z: 2 },
  ])
  assert.ok(designated.ok, designated.message)
  const parkingBefore = game.snapshot.logistics.parkingCells.length
  const moneyBefore = game.snapshot.money

  const blueprint = captureBlueprint(
    game.snapshot,
    [
      { x: 8, z: 2 },
      { x: 9, z: 2 },
      { x: 8, z: 3 },
      { x: 9, z: 3 },
    ],
    (x, z) => game.getTerrainHeight(x, z),
  )
  assert.equal(blueprint.items.filter((item) => item.type === 'parking').length, 2)
  assert.ok(describeBlueprint(blueprint).includes('Parkplatz'))

  const preview = game.previewBlueprint(12, 6, 0, blueprint.items)
  assert.equal(preview.placements.length, 2)
  assert.equal(preview.placements.every((entry) => entry.valid), true)
  assert.equal(game.snapshot.logistics.parkingCells.length, parkingBefore, 'preview must not place parking')
  assert.equal(game.snapshot.money, moneyBefore, 'preview must not charge')

  const result = game.stampBlueprint(12, 6, 0, blueprint.items)
  assert.ok(result.ok, result.message)
  assert.ok(
    game.snapshot.logistics.parkingCells.some((cell) => cell.x === 12 && cell.z === 6),
    'stamped parking at origin',
  )
  assert.ok(
    game.snapshot.logistics.parkingCells.some((cell) => cell.x === 13 && cell.z === 6),
    'stamped parking neighbor',
  )
  const expectedCharge = Math.ceil(
    SIMULATION_CONFIG.logistics.parkingDesignationCost * 2 *
      SIMULATION_CONFIG.economy.blueprintCopyCostFactor,
  )
  assert.equal(game.snapshot.money, moneyBefore - expectedCharge)

  const rotated = transformBlueprintItems(blueprint.items, 1)
    .filter((item) => item.type === 'parking')
    .map((item) => [item.dx || 0, item.dz || 0])
  assert.deepEqual(rotated, [
    [0, 0],
    [0, -1],
  ])
}

export async function testBlueprintLibraryRoundtrip(): Promise<void> {
  const previous = globalThis.localStorage
  const map = new Map<string, string>()
  Object.assign(globalThis, {
    localStorage: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value)
      },
      removeItem: (key: string) => {
        map.delete(key)
      },
    },
  })
  try {
    const game = emptyPark()
    assert.ok(game.place('statue', 4, 4, 0).ok)
    assert.ok(game.place('flowerbed', 5, 4, 1).ok)
    const blueprint = captureBlueprint(
      game.snapshot,
      [
        { x: 4, z: 4 },
        { x: 5, z: 4 },
      ],
      (x, z) => game.getTerrainHeight(x, z),
    )
    const saved = await saveBlueprintLibraryEntry('Testbeet', blueprint)
    assert.equal(saved.name, 'Testbeet')
    const listed = await listBlueprintLibrary()
    assert.equal(listed.length, 1)
    assert.equal(listed[0]!.blueprint.items.length, 2)
    assert.ok(map.has(BLUEPRINT_LIBRARY_KEY), 'library uses its own key, not SAVE_KEY')
    const loaded = listed[0]!.blueprint
    const other = emptyPark()
    assert.ok(other.stampBlueprint(10, 8, 0, loaded.items).ok)
    assert.equal(other.snapshot.buildings.filter((building) => building.kind === 'statue').length, 1)
    assert.equal(other.snapshot.buildings.filter((building) => building.kind === 'flowerbed').length, 1)
    await deleteBlueprintLibraryEntry(saved.id)
    assert.equal((await listBlueprintLibrary()).length, 0)
  } finally {
    Object.assign(globalThis, { localStorage: previous })
  }
}
