/**
 * Ephemeral multiplayer chat and map pings.
 * Not a GameCommand and not part of the snapshot — the server relays them.
 */

export const CHAT_TEXT_LIMIT = 200
export const CHAT_PING_TTL_MS = 10_000
/** Soft world bound so a broken client cannot place markers at infinity. */
export const CHAT_PING_COORD_LIMIT = 512

export type ChatPing = { x: number; z: number }

export type ChatMessage = {
  id: string
  from: string
  name: string
  text: string
  ping?: ChatPing
}

/** Trimmed, control-stripped, length-capped chat body. Empty string is allowed (ping-only). */
export function cleanChatText(text: unknown): string {
  if (typeof text !== 'string') return ''
  return text.replace(/\p{Cc}/gu, ' ').trim().slice(0, CHAT_TEXT_LIMIT)
}

export function cleanChatPing(ping: unknown): ChatPing | undefined {
  if (!ping || typeof ping !== 'object') return undefined
  const data = ping as { x?: unknown; z?: unknown }
  const x = Number(data.x)
  const z = Number(data.z)
  if (!Number.isFinite(x) || !Number.isFinite(z)) return undefined
  const clampedX = Math.max(-CHAT_PING_COORD_LIMIT, Math.min(CHAT_PING_COORD_LIMIT, x))
  const clampedZ = Math.max(-CHAT_PING_COORD_LIMIT, Math.min(CHAT_PING_COORD_LIMIT, z))
  return { x: clampedX, z: clampedZ }
}

/** True when a client chat payload is worth broadcasting. */
export function isSendableChat(text: string, ping?: ChatPing): boolean {
  return text.length > 0 || ping !== undefined
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
