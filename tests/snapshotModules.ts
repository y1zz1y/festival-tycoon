import assert from 'node:assert/strict'
import { GameState, type GameSnapshot } from '../src/game/GameState'
import {
  createBlankSnapshot,
  createInitialSnapshot,
  ENTRANCE_PATH_ID,
} from '../src/game/snapshotBootstrap'
import { migrateSnapshot } from '../src/game/snapshotMigration'

export function testSnapshotModules(): void {
  const blank = createBlankSnapshot()
  assert.equal(blank.version, 30)
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
  const migrated = migrateSnapshot(legacy)
  assert.ok(migrated)
  assert.equal(migrated.version, 30)
  assert.equal(migrated.campingTicketPrice, 77)

  const throughStaticApi = GameState.fromJSON(JSON.stringify(legacy))
  assert.ok(throughStaticApi)
  assert.equal(throughStaticApi.snapshot.version, 30)
  assert.equal(throughStaticApi.snapshot.campingTicketPrice, 77)
}
