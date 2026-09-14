import assert from 'node:assert/strict'
import { BUILDING_KINDS } from '../src/game/catalog'
import type { Tool } from '../src/game/catalog'
import { GameState } from '../src/game/GameState'
import {
  BUILD_CATEGORIES,
  CATALOG_BUILD_CATEGORIES,
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
        const key = item.bungee ? `${item.tool}:bungee` : item.tool
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
  assert.equal(
    BUILD_CATEGORIES.find((category) => category.id === 'roads')?.dock,
    'right',
  )
  for (const category of BUILD_CATEGORIES) {
    if (category.id !== 'roads') assert.equal(category.dock, 'left')
  }

  const game = new GameState()
  game.setTool('food')
  game.adjustBuildElevation(1)
  game.adjustBuildElevation(1)
  assert.equal(game.snapshot.buildElevation, 2)
  game.setTool('food')
  assert.equal(game.snapshot.buildElevation, 2, 'gleiche Auswahl behält die Bauhöhe')
  game.setTool('toilet')
  assert.equal(game.snapshot.buildElevation, 0, 'neues Werkzeug setzt die Bauhöhe zurück')
  game.setBuildElevation(4)
  assert.equal(game.snapshot.buildElevation, 4)
  game.setBuildElevation(9)
  assert.equal(game.snapshot.buildElevation, 6)
  game.setBuildElevation(-2)
  assert.equal(game.snapshot.buildElevation, 0)
}
