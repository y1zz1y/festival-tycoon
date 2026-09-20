import assert from 'node:assert/strict'
import {
  CHAT_PING_COORD_LIMIT,
  CHAT_PING_TTL_MS,
  CHAT_TEXT_LIMIT,
  cleanChatPing,
  cleanChatText,
  edgeArrowPlacement,
  isProjectedOnScreen,
  isSendableChat,
} from '../src/net/chatProtocol'

export function testMultiplayerChat(): void {
  assert.equal(cleanChatText('  Hallo  '), 'Hallo')
  assert.equal(cleanChatText('a'.repeat(CHAT_TEXT_LIMIT + 20)).length, CHAT_TEXT_LIMIT)
  assert.equal(cleanChatText('hi\u0000there'), 'hi there')
  assert.equal(cleanChatText(null), '')

  assert.deepEqual(cleanChatPing({ x: 3.5, z: -2 }), { x: 3.5, z: -2 })
  assert.equal(cleanChatPing({ x: Number.NaN, z: 1 }), undefined)
  assert.deepEqual(cleanChatPing({ x: CHAT_PING_COORD_LIMIT + 50, z: -CHAT_PING_COORD_LIMIT - 1 }), {
    x: CHAT_PING_COORD_LIMIT,
    z: -CHAT_PING_COORD_LIMIT,
  })

  assert.equal(isSendableChat('', undefined), false)
  assert.equal(isSendableChat('', { x: 1, z: 2 }), true)
  assert.equal(isSendableChat('hi', undefined), true)

  assert.equal(CHAT_PING_TTL_MS, 10_000)

  assert.equal(isProjectedOnScreen(0, 0, 0.5), true)
  assert.equal(isProjectedOnScreen(0.95, 0, 0.5), false)
  assert.equal(isProjectedOnScreen(0, 0, 1.1), false)

  const edge = edgeArrowPlacement(2000, 500, 800, 600, 28)
  assert.ok(edge.x >= 28 && edge.x <= 800 - 28)
  assert.ok(edge.y >= 28 && edge.y <= 600 - 28)
  assert.ok(Number.isFinite(edge.angle))

  console.log('PASS multiplayer chat sanitize, ping TTL and edge-arrow math')
}
