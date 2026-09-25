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
  assert.equal(blank.version, 34)
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
    createSeededCourse('legacy-slide', 'waterSlide', 10, 2),
    createEmptyCourse('invalid-course', 'mudmasters'),
  ]
  const migrated = migrateSnapshot(legacy)
  assert.ok(migrated)
  assert.equal(migrated.version, 34)
  assert.equal(migrated.campingTicketPrice, 77)
  assert.ok(migrated.attractions.some((attraction) => attraction.definitionId === 'swimArea'))
  assert.ok(migrated.attractions.some((attraction) => attraction.definitionId === 'waterSlide'))
  assert.ok(migrated.courses.some((course) => course.kind === 'waterSlide' && course.id === 'legacy-slide'))
  assert.ok(migrated.migrationReport?.removedAttractionIds.includes('invalid-course'))

  const throughStaticApi = GameState.fromJSON(JSON.stringify(legacy))
  assert.ok(throughStaticApi)
  assert.equal(throughStaticApi.snapshot.version, 34)
  assert.equal(throughStaticApi.snapshot.campingTicketPrice, 77)

  const v31 = structuredClone(blank) as GameSnapshot & { version: number }
  v31.version = 31
  delete (v31.festival as Partial<typeof v31.festival>).demandTuning
  const demandMigrated = migrateSnapshot(v31)
  assert.ok(demandMigrated)
  assert.equal(demandMigrated.version, 34)
  assert.deepEqual(demandMigrated.festival.demandTuning, createTicketDemandTuning())

  const v32 = structuredClone(blank) as GameSnapshot & { version: number }
  v32.version = 32
  const legacyStage = defaultStageDesign()
  delete legacyStage.forecourtDepth
  v32.festival.stageTemplates = [legacyStage]
  const forecourtMigrated = migrateSnapshot(v32)
  assert.ok(forecourtMigrated)
  assert.equal(forecourtMigrated.version, 34)
  assert.equal(
    forecourtMigrated.festival.stageTemplates?.[0]?.forecourtDepth,
    (legacyStage.tileWidth ?? 1) * 2,
  )

  // v34: a v33 scenario keeps its goal marks and gains results, outcome and a due day.
  const v33 = structuredClone(blank) as GameSnapshot & { version: number }
  v33.version = 33
  v33.day = 20
  v33.scenario = { ...v33.scenario, goals: [{ kind: 'guests', target: 300, edition: 2 }] }
  ;(v33 as { scenarioProgress: unknown }).scenarioProgress = { peakGuests: 310, status: ['done'] }
  const scenarioMigrated = migrateSnapshot(v33)
  assert.ok(scenarioMigrated)
  assert.equal(scenarioMigrated.version, 34)
  assert.deepEqual(scenarioMigrated.scenarioProgress.status, ['done'], 'reached goals stay reached')
  assert.equal(scenarioMigrated.scenarioProgress.peakGuests, 310)
  assert.deepEqual(scenarioMigrated.scenarioProgress.outcome, { state: 'running' })
  assert.deepEqual(scenarioMigrated.scenarioProgress.editions, [])
  assert.ok((scenarioMigrated.scenarioProgress.nextEditionDue ?? 0) > 20, 'an old scenario is not stopped on the spot')
}
