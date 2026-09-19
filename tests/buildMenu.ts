import assert from 'node:assert/strict'
import { BUILDING_KINDS } from '../src/game/catalog'
import type { Tool } from '../src/game/catalog'
import { COASTER_TYPES } from '../src/game/coasters'
import { COASTER_CATALOG_TYPE_IDS, coasterVehiclePreview } from '../src/game/coasterTypes'
import { GameState } from '../src/game/GameState'
import {
  BUILD_CATEGORIES,
  CATALOG_BUILD_CATEGORIES,
  coasterCatalogIcon,
  isCatalogBuildCategory,
  listedBuildTools,
  placeableTools,
  subgroupForTool,
  unusedBuildingKinds,
} from '../src/game/buildMenu'

export function testBuildMenu(): void {
  const listed = listedBuildTools()
  const expected = placeableTools()
  const missing = expected.filter((tool) => !listed.includes(tool))
  const unexpected = listed.filter((tool) => !expected.includes(tool))
  assert.deepEqual(missing, [], `Baumenü fehlt: ${missing.join(', ')}`)
  assert.deepEqual(unexpected, [], `Baumenü hat Extra-Tools: ${unexpected.join(', ')}`)

  const seen = new Set<string>()
  for (const category of BUILD_CATEGORIES) {
    assert.ok(category.groups.length > 0, `${category.id} hat keine Gruppe`)
    for (const group of category.groups) {
      assert.ok(group.items.length > 0, `${category.id}/${group.id} ist leer`)
      for (const item of group.items) {
        const key = item.bungee
          ? `${item.tool}:bungee`
          : item.coasterTypeId
            ? `${item.tool}:${item.coasterTypeId}`
            : item.courseKind
              ? `${item.tool}:${item.courseKind}`
              : item.tool
        assert.equal(seen.has(key), false, `Doppelter Menüeintrag ${key}`)
        seen.add(key)
      }
    }
  }

  assert.deepEqual(unusedBuildingKinds(), [], 'Gebäude ohne Menüeintrag')
  for (const kind of BUILDING_KINDS) {
    assert.ok(listed.includes(kind as Tool), `${kind} fehlt im Baumenü`)
  }

  assert.deepEqual([...CATALOG_BUILD_CATEGORIES], ['decoration', 'attractions', 'logistics'])
  assert.equal(isCatalogBuildCategory('decoration'), true)
  assert.equal(isCatalogBuildCategory('attractions'), true)
  assert.equal(isCatalogBuildCategory('logistics'), true)
  assert.equal(isCatalogBuildCategory('roads'), false)
  assert.deepEqual(
    subgroupForTool('camping'),
    { category: 'attractions', group: 'camping' },
  )
  assert.deepEqual(
    subgroupForTool('ambulanceGarage'),
    { category: 'logistics', group: 'medical' },
  )
  assert.deepEqual(
    subgroupForTool('medicalArea'),
    { category: 'logistics', group: 'medical' },
  )
  assert.deepEqual(
    subgroupForTool('backstageArea'),
    { category: 'logistics', group: 'band' },
  )
  assert.deepEqual(
    subgroupForTool('tourBusParking'),
    { category: 'logistics', group: 'band' },
  )
  assert.equal(
    BUILD_CATEGORIES.find((category) => category.id === 'roads')?.dock,
    'left',
  )
  for (const category of BUILD_CATEGORIES) {
    if (category.id !== 'roads') assert.equal(category.dock, 'left')
  }

  const coasterGroup = BUILD_CATEGORIES.find((category) => category.id === 'attractions')?.groups.find(
    (group) => group.id === 'coasters',
  )
  assert.ok(coasterGroup, 'Attraktionen brauchen einen Achterbahn-Reiter')
  assert.equal(coasterGroup!.items.some((item) => item.tool === 'coaster' && !item.coasterTypeId), false)
  assert.ok(coasterGroup!.items.length >= 8, 'Achterbahn-Reiter listet Typen direkt')
  assert.ok(coasterGroup!.items.every((item) => item.tool === 'coaster' && item.coasterTypeId))
  assert.equal(coasterGroup!.items.length, COASTER_CATALOG_TYPE_IDS.length)
  for (const item of coasterGroup!.items) {
    const typeId = item.coasterTypeId!
    const preview = coasterVehiclePreview(typeId)
    assert.equal(item.icon, preview.trainStyle, `${typeId} catalog tile is keyed by train style`)
    assert.equal(coasterCatalogIcon(typeId), COASTER_TYPES[typeId].trainStyle)
    assert.equal(item.icon.includes('🎢'), false)
  }

  const game = new GameState()
  game.setTool('food')
  game.adjustBuildElevation(1)
  game.adjustBuildElevation(1)
  assert.equal(game.snapshot.buildElevation, 1)
  game.setTool('food')
  assert.equal(game.snapshot.buildElevation, 1, 'gleiche Auswahl behält die Bauhöhe')
  game.setTool('toilet')
  assert.equal(game.snapshot.buildElevation, 0, 'neues Werkzeug setzt die Bauhöhe zurück')
  game.setBuildElevation(4)
  assert.equal(game.snapshot.buildElevation, 4)
  game.setBuildElevation(9)
  assert.equal(game.snapshot.buildElevation, 6)
  game.setBuildElevation(-2)
  assert.equal(game.snapshot.buildElevation, 0)
  game.setBuildElevation(0.6)
  assert.equal(game.snapshot.buildElevation, 0.5)
}
