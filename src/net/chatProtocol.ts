/**
 * Ephemeral multiplayer chat and map pings.
 * Not a GameCommand and not part of the snapshot — the server relays them.
 *
 * Sanitize helpers live in server/chatProtocol.ts so Docker (server + dist)
 * can import them at runtime; this module re-exports them for the client.
 */

import type { ChatPing } from '../../server/chatProtocol'

export {
  CHAT_PING_COORD_LIMIT,
  CHAT_TEXT_LIMIT,
  cleanChatPing,
  cleanChatText,
  isSendableChat,
  type ChatPing,
} from '../../server/chatProtocol'

export const CHAT_PING_TTL_MS = 10_000

export type ChatMessage = {
  id: string
  from: string
  name: string
  text: string
  ping?: ChatPing
}

/**
 * Screen-edge arrow: clamp a projected point to the inset rectangle and return
 * the rotation (radians) pointing toward the off-screen target.
 */
export function edgeArrowPlacement(
  screenX: number,
  screenY: number,
  width: number,
  height: number,
  margin = 28,
): { x: number; y: number; angle: number } {
  const cx = width / 2
  const cy = height / 2
  let dx = screenX - cx
  let dy = screenY - cy
  if (dx === 0 && dy === 0) dy = -1
  const maxX = Math.max(1, width / 2 - margin)
  const maxY = Math.max(1, height / 2 - margin)
  const scale = Math.min(maxX / Math.abs(dx), maxY / Math.abs(dy))
  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
    angle: Math.atan2(dy, dx),
  }
}

/** Whether a projected NDC point lies inside the visible canvas (with a small inset). */
export function isProjectedOnScreen(
  ndcX: number,
  ndcY: number,
  ndcZ: number,
  inset = 0.92,
): boolean {
  if (ndcZ > 1) return false
  return Math.abs(ndcX) <= inset && Math.abs(ndcY) <= inset
}
