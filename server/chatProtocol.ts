/**
 * Shared multiplayer chat sanitize helpers.
 * Lives under server/ so the production image (server + dist only) can load it
 * at runtime via `node --experimental-strip-types`. Client code re-exports
 * from src/net/chatProtocol.ts. Types in src/net/protocol.ts stay type-only.
 */

export const CHAT_TEXT_LIMIT = 200
/** Soft world bound so a broken client cannot place markers at infinity. */
export const CHAT_PING_COORD_LIMIT = 512

export type ChatPing = { x: number; z: number }

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
