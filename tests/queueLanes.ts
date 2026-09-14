import assert from 'node:assert/strict'
import {
  attractionQueueStandOffset,
  isStallQueueKind,
  queueStandOffset,
  queueTravelLane,
  stallQueueLaneFromLocal,
  stallQueueStandOffset,
  stallQueueTileOffset,
} from '../src/game/queueLanes'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'

export function testQueueLanes(): void {
  assert.equal(isStallQueueKind('food'), true)
  assert.equal(isStallQueueKind('alcohol'), true)
  assert.equal(isStallQueueKind('toilet'), true)
  assert.equal(isStallQueueKind('mascot'), true)
  assert.equal(isStallQueueKind('shirt'), true)
  assert.equal(isStallQueueKind('ride'), false)
  assert.equal(isStallQueueKind('path'), false)

  const towardPositiveZ = { x: 0, z: 1 }
  for (let slot = 0; slot < SIMULATION_CONFIG.coasters.queueSlotsPerCell; slot++) {
    const wait = stallQueueStandOffset(slot, towardPositiveZ, true)
    assert.ok(wait.x < -0.02, 'inbound stands stay on the left half when facing the stall')
    assert.ok(Math.abs(wait.x) <= 0.42 && Math.abs(wait.z) <= 0.42, 'stall stands stay on the tile')
    const full = attractionQueueStandOffset(slot, towardPositiveZ, true)
    assert.ok(Math.abs(full.x) <= 0.42 && Math.abs(full.z) <= 0.42)
  }
  const unpacked = stallQueueStandOffset(0, towardPositiveZ, false)
  assert.ok(unpacked.x < 0, 'even unpacked stall waiters keep to the inbound half')
  assert.deepEqual(queueStandOffset(0, towardPositiveZ, true, false), attractionQueueStandOffset(0, towardPositiveZ, true))
  assert.deepEqual(queueStandOffset(0, towardPositiveZ, true, true), stallQueueStandOffset(0, towardPositiveZ, true))

  const inboundTile = stallQueueTileOffset(0, 'inbound')
  const outboundTile = stallQueueTileOffset(0, 'outbound')
  assert.ok(inboundTile.x < 0.5, 'inbound tile offset is the left half looking along +Z')
  assert.ok(outboundTile.x > 0.5, 'outbound tile offset is the right half looking along +Z')
  assert.equal(stallQueueLaneFromLocal(0, inboundTile.x, inboundTile.z), 'inbound')
  assert.equal(stallQueueLaneFromLocal(0, outboundTile.x, outboundTile.z), 'outbound')

  assert.equal(queueTravelLane(2, 2, 2), 'inbound', 'walking with the queue direction is the wait lane')
  assert.equal(queueTravelLane(2, 2, 0), 'outbound', 'walking against the queue direction is the return lane')

  console.log('PASS stall queue lanes: half-width inbound wait / outbound return')
}
