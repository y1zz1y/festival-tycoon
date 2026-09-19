import assert from 'node:assert/strict'
import { GameState, type GameSnapshot } from '../src/game/GameState'
import {
  createBlankSnapshot,
  createInitialSnapshot,
  ENTRANCE_PATH_ID,
} from '../src/game/snapshotBootstrap'
import { migrateSnapshot } from '../src/game/snapshotMigration'
import { createEmptyCourse, createSeededCourse } from '../src/game/courseAttractions'
import { createTicketDemandTuning } from '../src/game/demandTuning'
import { defaultStageDesign } from '../src/game/stageDesign'

export function testSnapshotModules(): void {
  const blank = createBlankSnapshot()
  assert.equal(blank.version, 33)
  assert.equal(blank.buildings[0]?.id, ENTRANCE_PATH_ID)
  assert.equal(blank.parkOpen, true)

  const first = createInitialSnapshot()
  const second = createInitialSnapshot()
  assert.equal(first.parkOpen, false)
  assert.equal(first.festival.planning, true)
  assert.deepEqual(first, second, 'new-world bootstrap remains deterministic')

  assert.equal(migrateSnapshot(null), null)
  assert.equal(migrateSnapshot({}), null)
  const legacy = structuredClone(blank) as Partial<GameSnapshot> & { version?: number }
  legacy.version = 1
  delete legacy.campingTicketPrice
  legacy.entryPrice = 77
  legacy.courses = [
    createSeededCourse('legacy-pool', 'pool', 2, 2),
    createEmptyCourse('invalid-course', 'mudmasters'),
  ]
  const migrated = migrateSnapshot(legacy)
  assert.ok(migrated)
  assert.equal(migrated.version, 33)
  assert.equal(migrated.campingTicketPrice, 77)
  assert.ok(migrated.attractions.some((attraction) => attraction.definitionId === 'swimArea'))
  assert.ok(migrated.attractions.some((attraction) => attraction.definitionId === 'waterSlide'))
  assert.ok(migrated.migrationReport?.removedAttractionIds.includes('invalid-course'))

  const throughStaticApi = GameState.fromJSON(JSON.stringify(legacy))
  assert.ok(throughStaticApi)
  assert.equal(throughStaticApi.snapshot.version, 33)
  assert.equal(throughStaticApi.snapshot.campingTicketPrice, 77)

  const v31 = structuredClone(blank) as GameSnapshot & { version: number }
  v31.version = 31
  delete (v31.festival as Partial<typeof v31.festival>).demandTuning
  const demandMigrated = migrateSnapshot(v31)
  assert.ok(demandMigrated)
  assert.equal(demandMigrated.version, 33)
  assert.deepEqual(demandMigrated.festival.demandTuning, createTicketDemandTuning())

  const v32 = structuredClone(blank) as GameSnapshot & { version: number }
  v32.version = 32
  const legacyStage = defaultStageDesign()
  delete legacyStage.forecourtDepth
  v32.festival.stageTemplates = [legacyStage]
  const forecourtMigrated = migrateSnapshot(v32)
  assert.ok(forecourtMigrated)
  assert.equal(forecourtMigrated.version, 33)
  assert.equal(
    forecourtMigrated.festival.stageTemplates?.[0]?.forecourtDepth,
    (legacyStage.tileWidth ?? 1) * 2,
  )
}
