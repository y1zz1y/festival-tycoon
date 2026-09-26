import assert from 'node:assert/strict'
import { GameState } from '../src/game/GameState'
import {
  GROUND_COVERS,
  GROUND_COVER_IDS,
  groundCoverFromTool,
  groundInfo,
  isGroundCover,
  normalizeGroundCells,
} from '../src/game/ground'
import { migrateSnapshot } from '../src/game/snapshotMigration'
import { createBlankSnapshot } from '../src/game/snapshotBootstrap'
import { applyGameCommand } from '../src/net/commands'
import { encodeSaveText, decodeSaveText } from '../src/game/saveText'
import { terrainMaterialAt } from '../src/view/terrainSurface'
import { TERRAIN_COVER_TOOLS } from '../src/game/catalog'
import {
  COVER_WEATHERING,
  majorityOverlayCover,
  majorityPaintedCover,
  overlayCoverAt,
  paintedCoverAt,
  weatheringRgb,
} from '../src/game/groundCoverLook'

export function testGroundCover(fixture: (count?: number) => GameState): void {
  assert.deepEqual(
    [...GROUND_COVER_IDS],
    ['grass', 'sand', 'stone', 'field', 'snow', 'rock', 'earth', 'salt', 'asphalt'],
  )
  assert.deepEqual([...TERRAIN_COVER_TOOLS], [
    'terrainCoverGrass',
    'terrainCoverSand',
    'terrainCoverStone',
    'terrainCoverField',
    'terrainCoverSnow',
    'terrainCoverRock',
    'terrainCoverEarth',
    'terrainCoverSalt',
    'terrainCoverAsphalt',
  ])
  assert.equal(groundCoverFromTool('terrainCoverGrass'), 'grass')
  assert.equal(groundCoverFromTool('terrainRaise'), null)
  assert.equal(isGroundCover('snow'), true)
  assert.equal(isGroundCover('lava'), false)

  const game = fixture(0)
  game.snapshot.scenario.environment = 'grassland'
  const painted = game.paintGroundCover(4, 4, 'sand')
  assert.ok(painted.ok, painted.message)
  assert.equal(game.snapshot.festival.infrastructure.ground['4,4']?.cover, 'sand')
  assert.equal(groundInfo(game.snapshot, 4, 4).type, 'sand', 'sand already had nav costs')
  assert.equal(terrainMaterialAt(game.snapshot, 4, 4), 'sand')

  const same = game.paintGroundCover(4, 4, 'sand')
  assert.equal(same.ok, false, 'repainting the same cover is a no-op')

  const snow = game.paintGroundCover(5, 4, 'snow')
  assert.ok(snow.ok, snow.message)
  const snowType = groundInfo(game.snapshot, 5, 4).type
  assert.notEqual(snowType, 'sand')
  assert.equal(terrainMaterialAt(game.snapshot, 5, 4), 'snow')
  assert.equal(
    snowType,
    groundInfo({ ...game.snapshot, festival: { ...game.snapshot.festival, infrastructure: { ...game.snapshot.festival.infrastructure, ground: {} } } }, 5, 4).type,
    'snow is visual-only and keeps the natural substrate',
  )

  const earth = game.paintGroundCover(6, 4, 'earth')
  assert.ok(earth.ok)
  assert.equal(groundInfo(game.snapshot, 6, 4).type, 'clay', 'brown earth reuses clay costs')
  assert.equal(terrainMaterialAt(game.snapshot, 6, 4), 'earth')

  const salt = game.paintGroundCover(3, 5, 'salt')
  assert.ok(salt.ok)
  assert.equal(groundInfo(game.snapshot, 3, 5).type, 'sand', 'playa reuses sand costs')
  assert.equal(terrainMaterialAt(game.snapshot, 3, 5), 'salt')
  const tarmac = game.paintGroundCover(3, 6, 'asphalt')
  assert.ok(tarmac.ok)
  assert.equal(terrainMaterialAt(game.snapshot, 3, 6), 'asphalt')
  assert.equal(
    groundInfo(game.snapshot, 3, 6).type,
    groundInfo({ ...game.snapshot, festival: { ...game.snapshot.festival, infrastructure: { ...game.snapshot.festival.infrastructure, ground: {} } } }, 3, 6).type,
    'asphalt is visual-only and keeps the natural substrate',
  )

  const area = game.paintGroundCoverArea([{ x: 7, z: 4 }, { x: 8, z: 4 }, { x: 7, z: 4 }], 'stone')
  assert.ok(area.ok)
  assert.equal(game.snapshot.festival.infrastructure.ground['7,4']?.cover, 'stone')
  assert.equal(game.snapshot.festival.infrastructure.ground['8,4']?.cover, 'stone')
  assert.equal(terrainMaterialAt(game.snapshot, 7, 4), 'stone')

  const outside = game.paintGroundCover(400, 400, 'grass')
  assert.equal(outside.ok, false)

  game.snapshot.festival.infrastructure.ground['9,4'] = { cover: 'rock', compacted: true }
  const beforeRaise = game.snapshot.festival.infrastructure.ground['9,4']!.cover
  const raised = game.editTerrain(9, 4, 'raise')
  assert.ok(raised.ok)
  assert.equal(game.snapshot.festival.infrastructure.ground['9,4']?.cover, beforeRaise, 'height edits keep painted cover')
  assert.equal(game.snapshot.festival.infrastructure.ground['9,4']?.compacted, undefined, 'height edits still wipe ground works')

  const encoded = encodeSaveText(JSON.stringify(game.snapshot))
  const reloaded = GameState.fromJSON(decodeSaveText(encoded))
  assert.ok(reloaded)
  assert.equal(reloaded.snapshot.festival.infrastructure.ground['4,4']?.cover, 'sand')
  assert.equal(reloaded.snapshot.festival.infrastructure.ground['5,4']?.cover, 'snow')
  assert.equal(terrainMaterialAt(reloaded.snapshot, 5, 4), 'snow')

  const blank = createBlankSnapshot()
  const legacy = structuredClone(blank) as typeof blank & { version?: number }
  legacy.version = 33
  legacy.festival.infrastructure.ground = {
    '1,1': { cover: 'grass' },
    '2,2': { cover: 'not-a-cover' as never, compacted: true },
    '3,3': { drained: true },
  }
  const migrated = migrateSnapshot(legacy)
  assert.ok(migrated)
  assert.equal(migrated.festival.infrastructure.ground['1,1']?.cover, 'grass')
  assert.equal(migrated.festival.infrastructure.ground['2,2']?.cover, undefined)
  assert.equal(migrated.festival.infrastructure.ground['2,2']?.compacted, true)
  assert.equal(migrated.festival.infrastructure.ground['3,3']?.drained, true)
  assert.ok(!('cover' in (migrated.festival.infrastructure.ground['3,3'] ?? {})))

  const dirty = { '0,0': { cover: 'bogus' as never, surface: 'paved' as const } }
  normalizeGroundCells(dirty)
  assert.equal(dirty['0,0']?.cover, undefined)
  assert.equal(dirty['0,0']?.surface, 'paved')

  const host = fixture(0)
  const viaCommand = applyGameCommand(host, { type: 'paintGroundCover', x: 2, z: 3, cover: 'field' })
  assert.ok(viaCommand.ok, viaCommand.message)
  assert.equal(host.snapshot.festival.infrastructure.ground['2,3']?.cover, 'field')
  const viaArea = applyGameCommand(host, {
    type: 'paintGroundCoverArea',
    cells: [{ x: 2, z: 4 }, { x: 3, z: 4 }],
    cover: 'rock',
  })
  assert.ok(viaArea.ok)
  assert.equal(host.snapshot.festival.infrastructure.ground['2,4']?.cover, 'rock')
  assert.equal(terrainMaterialAt(host.snapshot, 2, 4), 'rock')
  assert.equal(GROUND_COVERS.field.material, 'field')

  const look = fixture(0)
  look.snapshot.scenario.environment = 'desert'
  assert.equal(paintedCoverAt(look.snapshot, 1, 1), undefined, 'legacy cells have no painted cover')
  assert.equal(overlayCoverAt(look.snapshot, 1, 1), 'sand', 'desert overlay uses the environment substrate')
  look.snapshot.scenario.environment = 'grassland'
  assert.equal(overlayCoverAt(look.snapshot, 2, 2), 'grass')
  look.paintGroundCover(2, 2, 'snow')
  assert.equal(paintedCoverAt(look.snapshot, 2, 2), 'snow')
  assert.equal(overlayCoverAt(look.snapshot, 2, 2), 'snow', 'painted cover wins over the substrate')
  look.paintGroundCover(3, 2, 'sand')
  look.paintGroundCover(4, 2, 'sand')
  assert.equal(
    majorityPaintedCover(look.snapshot, [{ x: 2, z: 2 }, { x: 3, z: 2 }, { x: 4, z: 2 }, { x: 5, z: 2 }]),
    'sand',
    'footprint majority ignores unpainted tiles',
  )
  assert.equal(majorityPaintedCover(look.snapshot, [{ x: 8, z: 8 }]), undefined)
  assert.equal(
    majorityOverlayCover(look.snapshot, [{ x: 2, z: 2 }, { x: 3, z: 2 }]),
    'sand',
  )
  const bare = weatheringRgb('grass')
  assert.deepEqual(bare, { r: 1, g: 1, b: 1 }, 'grass does not film objects')
  const snowFilm = weatheringRgb('snow')
  assert.ok(snowFilm.r > 0.85 && snowFilm.g > 0.85 && snowFilm.b > 0.85, 'snow dust is a light wash')
  assert.ok(COVER_WEATHERING.sand.mix > 0 && COVER_WEATHERING.salt.mix > 0 && COVER_WEATHERING.earth.mix > 0)
  assert.ok(COVER_WEATHERING.asphalt.mix > 0 && COVER_WEATHERING.asphalt.mix < COVER_WEATHERING.snow.mix)
  console.log('PASS ground covers: paint, area, save roundtrip, migration, commands and overlay lookup')
}
