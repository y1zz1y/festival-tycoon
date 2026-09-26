import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GameState } from '../src/game/GameState'
import {
  applyOsmFeatures,
  blackRockCitySector,
  classifyOsmTags,
  draftToScenarioFile,
  importedGroundOf,
  lonLatToCell,
  sketchBurningMan,
  sketchRockAmRing,
  TERRAIN_SKETCH_PRESETS,
} from '../src/game/terrainImport'
import { createSnapshotFromScenarioFile, parseScenarioFile } from '../src/game/scenarioFile'
import { GROUND_COVERS } from '../src/game/ground'
import { terrainMaterialAt } from '../src/view/terrainSurface'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'scenarios')

function loadScenario(name: string) {
  const parsed = parseScenarioFile(JSON.parse(readFileSync(join(fixtures, name), 'utf8')))
  assert.ok(parsed, name)
  return parsed
}

export function testTerrainImport(): void {
  assert.equal(classifyOsmTags({ highway: 'raceway' }).cover, 'asphalt')
  assert.equal(classifyOsmTags({ leisure: 'track', sport: 'motor' }).cover, 'asphalt')
  assert.equal(classifyOsmTags({ natural: 'sand' }).cover, 'sand')
  assert.equal(classifyOsmTags({ landuse: 'salt_pond' }).cover, 'salt')
  assert.equal(classifyOsmTags({ natural: 'water' }).water, true)
  assert.equal(classifyOsmTags({ landuse: 'farmland' }).cover, 'field')
  assert.ok(GROUND_COVERS.salt)
  assert.ok(GROUND_COVERS.asphalt)

  const cell = lonLatToCell(6.947, 50.335, TERRAIN_SKETCH_PRESETS['rock-am-ring'].bbox, 64)
  assert.ok(cell.x >= -32 && cell.x < 32)
  assert.ok(cell.z >= -32 && cell.z < 32)

  const brc = sketchBurningMan(64)
  const salt = Object.values(brc.ground).filter((entry) => entry.cover === 'salt').length
  const asphalt = Object.entries(brc.ground).filter(([, entry]) => entry.cover === 'asphalt')
  assert.ok(salt > 2000, 'playa fills the map')
  assert.ok(asphalt.length > 80, 'horseshoe streets plus playa track')
  assert.ok(asphalt.some(([key]) => {
    const [x, z] = key.split(',').map(Number)
    return Math.hypot(x, z - 2) < 10
  }), 'inner playa track')
  const cityOrTrack = asphalt.filter(([key]) => {
    const [x, z] = key.split(',').map(Number)
    return blackRockCitySector(x, z) || Math.hypot(x, z - 2) < 11
  })
  assert.ok(cityOrTrack.length / asphalt.length > 0.85, 'streets stay in the horseshoe or on the inner track')
  assert.ok(brc.buildings.some((building) => building.id === 'the-man' && building.kind === 'playaTotem'))

  const rar = sketchRockAmRing(64)
  const track = Object.values(rar.ground).filter((entry) => entry.cover === 'asphalt').length
  assert.ok(track > 80, 'nordschleife + GP oval')
  assert.ok(Object.keys(rar.heights).length > 20, 'hills north of the GP')
  assert.ok(rar.buildings.some((building) => building.kind === 'trackCurb'))

  const osmDraft = sketchRockAmRing(32)
  osmDraft.ground = {}
  osmDraft.heights = {}
  applyOsmFeatures(
    osmDraft,
    [{
      tags: { highway: 'raceway' },
      nodes: [
        { lon: 6.92, lat: 50.33 },
        { lon: 6.96, lat: 50.33 },
        { lon: 6.96, lat: 50.35 },
      ],
    }],
    TERRAIN_SKETCH_PRESETS['rock-am-ring'].bbox,
  )
  assert.ok(Object.values(osmDraft.ground).some((entry) => entry.cover === 'asphalt'))

  const file = draftToScenarioFile(brc, {
    id: 'burning-man-test',
    name: TERRAIN_SKETCH_PRESETS['burning-man'].name,
    detail: TERRAIN_SKETCH_PRESETS['burning-man'].detail,
  })
  const started = createSnapshotFromScenarioFile(file)
  assert.equal(started.festival.infrastructure.ground['0,2']?.cover, 'salt')
  assert.equal(terrainMaterialAt(started, 0, 2), 'salt')
  assert.ok(started.buildings.some((building) => building.kind === 'playaTotem'))

  const burning = loadScenario('burning-man.json')
  const ring = loadScenario('rock-am-ring-strecke.json')
  assert.ok(importedGroundOf(burning.world))
  assert.ok(importedGroundOf(ring.world))
  const burnGame = GameState.startFromScenarioFile(burning)
  const ringGame = GameState.startFromScenarioFile(ring)
  assert.equal(terrainMaterialAt(burnGame.snapshot, 0, 2), 'salt')
  assert.ok(
    Object.values(ringGame.snapshot.festival.infrastructure.ground).some((cell) => cell.cover === 'asphalt'),
  )
  console.log('PASS terrain import: OSM mapping, sketches, scenario files')
}
