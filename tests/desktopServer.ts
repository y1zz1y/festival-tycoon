import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startGameServer } from '../server/app'

/**
 * The desktop app (electron/main.mjs) starts the game server as a function: on a
 * given port, with its own dist folder, falling back to the next port when one is
 * taken, and closing cleanly when the window closes (docs/desktop.md).
 */
export async function testDesktopServer(): Promise<void> {
  const dist = mkdtempSync(join(tmpdir(), 'headliner-dist-'))
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>desktop</title>')
  const first = await startGameServer({ port: 0, host: '127.0.0.1', dist })
  assert.ok(first.port > 0, 'port 0 picks a free port and reports it')
  const page = await fetch(`http://127.0.0.1:${first.port}/some/deep/link`)
  assert.equal(page.status, 200)
  assert.match(await page.text(), /desktop/, 'unknown paths fall back to the given dist index')
  const socket = new WebSocket(`ws://127.0.0.1:${first.port}/ws`)
  await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = reject
  })
  socket.send(JSON.stringify({ t: 'lobbies' }))
  const reply = await new Promise<string>((resolve) => {
    socket.onmessage = (event) => resolve(String(event.data))
  })
  assert.match(reply, /"t":"lobbies"/, 'multiplayer answers on /ws')
  await assert.rejects(
    startGameServer({ port: first.port, host: '127.0.0.1', dist }),
    (error: NodeJS.ErrnoException) => error.code === 'EADDRINUSE',
    'a taken port rejects instead of exiting, so the app can try the next one',
  )
  await first.close()
  await assert.rejects(fetch(`http://127.0.0.1:${first.port}/`), 'close stops the server and its sockets')
  console.log('PASS desktop server: start on a port, dist fallback, multiplayer socket, taken port rejects, clean close')
}
