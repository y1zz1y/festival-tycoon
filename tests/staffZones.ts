import assert from 'node:assert/strict'
import { GameState } from '../src/game/GameState'
import { applyGameCommand } from '../src/net/commands'
import {
  setAssignedWorkZones,
  staffZonePaintStroke,
  zoneKey,
  zonePaintActive,
} from '../src/game/staffZones'

function paintStroke(
  game: GameState,
  staffId: string,
  cells: Array<{ x: number; z: number }>,
  zones: string[] | undefined,
): void {
  const stroke = staffZonePaintStroke(zones, cells)
  for (const key of stroke.keys) {
    const result = applyGameCommand(game, { type: 'setStaffZone', staffId, key, active: stroke.active })
    assert.ok(result.ok, result.message)
  }
}

export function testStaffZonePaint(fixture: (count?: number) => GameState): void {
  assert.equal(zoneKey(0, 0), zoneKey(2, 2))
  assert.notEqual(zoneKey(0, 0), zoneKey(3, 0))
  assert.equal(zonePaintActive([], zoneKey(0, 0)), true)
  assert.equal(zonePaintActive([zoneKey(0, 0)], zoneKey(0, 0)), false)
  assert.equal(zonePaintActive([zoneKey(0, 0)], zoneKey(3, 0)), true)

  const jitter = staffZonePaintStroke(undefined, [
    { x: 0, z: 0 },
    { x: 1, z: 0 },
    { x: 2, z: 1 },
    { x: 3, z: 0 },
  ])
  assert.equal(jitter.active, true, 'first empty 3×3 locks the stroke to assign')
  assert.deepEqual(jitter.keys, [zoneKey(0, 0), zoneKey(3, 0)], 'jitter inside one 3×3 is one paint step')

  const first = setAssignedWorkZones(undefined, zoneKey(0, 0), true)
  assert.ok(first.ok && first.changed)
  const again = setAssignedWorkZones(first.next, zoneKey(0, 0), true)
  assert.ok(again.ok && !again.changed, 'set ON is idempotent and does not flicker')
  const off = setAssignedWorkZones(again.next, zoneKey(0, 0), false)
  assert.ok(off.ok && off.changed)
  const offAgain = setAssignedWorkZones(off.next, zoneKey(0, 0), false)
  assert.ok(offAgain.ok && !offAgain.changed, 'set OFF is idempotent')

  const game = fixture(0)
  game.addDebugMoney()
  assert.ok(game.hireStaff('cleaner').ok)
  const cleaner = game.snapshot.staff.find((member) => member.role === 'cleaner')!
  assert.equal(cleaner.workZones, undefined)

  paintStroke(game, cleaner.id, [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 3, z: 0 }], cleaner.workZones)
  assert.deepEqual(
    cleaner.workZones,
    [zoneKey(0, 0), zoneKey(3, 0)],
    'dragging across two 3×3s assigns both',
  )

  const deactivate = staffZonePaintStroke(cleaner.workZones, [
    { x: 1, z: 1 },
    { x: 4, z: 1 },
  ])
  assert.equal(deactivate.active, false, 'pressing an assigned 3×3 locks the stroke to remove')
  paintStroke(game, cleaner.id, [{ x: 1, z: 1 }, { x: 4, z: 1 }], cleaner.workZones)
  assert.deepEqual(cleaner.workZones, [], 'starting on an active cell deactivates along the drag')

  assert.ok(applyGameCommand(game, { type: 'setStaffZone', staffId: cleaner.id, key: zoneKey(0, 0), active: true }).ok)
  assert.ok(applyGameCommand(game, { type: 'setStaffZone', staffId: cleaner.id, key: zoneKey(0, 0), active: true }).ok)
  assert.deepEqual(cleaner.workZones, [zoneKey(0, 0)], 'repeating the locked mode does not toggle off')

  assert.ok(game.place('specialDepot', 5, -22).ok)
  assert.ok(game.buySweeper(game.snapshot.logistics.specialDepots[0]!.id).ok)
  const bot = game.snapshot.logistics.roadVehicles.find((vehicle) => vehicle.kind === 'sweeper')!
  paintStroke(game, bot.id, [{ x: 0, z: 0 }, { x: 3, z: 0 }], bot.workZones)
  assert.deepEqual(bot.workZones, [zoneKey(0, 0), zoneKey(3, 0)], 'sweeper zones use the same 3×3 drag paint')
  paintStroke(game, bot.id, [{ x: 0, z: 0 }, { x: 3, z: 0 }], bot.workZones)
  assert.deepEqual(bot.workZones, [], 'sweeper drag starting on an active cell clears both 3×3s')
}
