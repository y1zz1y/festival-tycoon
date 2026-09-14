import { isStallFacilityKind } from './shopGoods'
import { SIMULATION_CONFIG } from './simulationConfig'

export type QueueLane = 'inbound' | 'outbound'

export const QUEUE_CARDINALS = [
  { x: 0, z: 1 },
  { x: 1, z: 0 },
  { x: 0, z: -1 },
  { x: -1, z: 0 },
] as const

export function isStallQueueKind(kind: string): boolean {
  return isStallFacilityKind(kind)
}

export function queueDirectionVector(direction = 0): { x: number; z: number } {
  return QUEUE_CARDINALS[((Math.round(direction) % 4) + 4) % 4]!
}

/** Left when looking along the queue direction (toward the stall). */
export function queueLeft(direction: { x: number; z: number }): { x: number; z: number } {
  return { x: -direction.z, z: direction.x }
}

export function stallQueueLaneOffset(
  direction: { x: number; z: number },
  lane: QueueLane,
): { x: number; z: number } {
  const left = queueLeft(direction)
  const sign = lane === 'inbound' ? 1 : -1
  const offset = SIMULATION_CONFIG.queues.stallLaneOffset * sign
  return { x: left.x * offset, z: left.z * offset }
}

export function attractionQueueStandOffset(
  index: number,
  direction: { x: number; z: number },
  packed: boolean,
): { x: number; z: number } {
  if (!packed) return { x: 0, z: 0 }
  const config = SIMULATION_CONFIG.coasters
  const slot = index % config.queueSlotsPerCell
  const columns = config.queueSlotColumns
  const rows = Math.ceil(config.queueSlotsPerCell / columns)
  const col = slot % columns
  const row = Math.floor(slot / columns)
  const side = queueLeft(direction)
  const sideShift = (col - (columns - 1) / 2) * config.queueSlotOffset
  const alongShift = (row - (rows - 1) / 2) * config.queueSlotOffset
  return {
    x: side.x * sideShift + direction.x * alongShift,
    z: side.z * sideShift + direction.z * alongShift,
  }
}

export function stallQueueStandOffset(
  index: number,
  direction: { x: number; z: number },
  packed: boolean,
): { x: number; z: number } {
  const lane = stallQueueLaneOffset(direction, 'inbound')
  if (!packed) return lane
  const slots = SIMULATION_CONFIG.coasters.queueSlotsPerCell
  const columns = SIMULATION_CONFIG.queues.inboundSlotColumns
  const slotOffset = SIMULATION_CONFIG.queues.inboundSlotOffset
  const slot = index % slots
  const rows = Math.ceil(slots / columns)
  const col = slot % columns
  const row = Math.floor(slot / columns)
  const side = queueLeft(direction)
  const sideShift = (col - (columns - 1) / 2) * slotOffset
  const alongShift = (row - (rows - 1) / 2) * slotOffset
  return {
    x: lane.x + side.x * sideShift + direction.x * alongShift,
    z: lane.z + side.z * sideShift + direction.z * alongShift,
  }
}

export function queueStandOffset(
  index: number,
  direction: { x: number; z: number },
  packed: boolean,
  split = false,
): { x: number; z: number } {
  return split
    ? stallQueueStandOffset(index, direction, packed)
    : attractionQueueStandOffset(index, direction, packed)
}

export function stallQueueTileOffset(
  queueDirection: number,
  lane: QueueLane,
  along = 0.5,
): { x: number; z: number } {
  const dir = queueDirectionVector(queueDirection)
  const laneOff = stallQueueLaneOffset(dir, lane)
  const alongShift = (along - 0.5) * SIMULATION_CONFIG.queues.alongJitter
  return {
    x: 0.5 + laneOff.x + dir.x * alongShift,
    z: 0.5 + laneOff.z + dir.z * alongShift,
  }
}

export function stallQueueLaneFromLocal(
  queueDirection: number,
  localX: number,
  localZ: number,
): QueueLane {
  const left = queueLeft(queueDirectionVector(queueDirection))
  return (localX - 0.5) * left.x + (localZ - 0.5) * left.z >= 0 ? 'inbound' : 'outbound'
}

export function queueTravelLane(
  fromQueueDirection: number | undefined,
  toQueueDirection: number | undefined,
  moveDirection: number,
): QueueLane {
  if (fromQueueDirection === moveDirection || toQueueDirection === moveDirection) {
    return 'inbound'
  }
  return 'outbound'
}
