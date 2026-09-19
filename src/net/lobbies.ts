import type { NetLobby, ServerMessage } from './protocol'

/** Where the multiplayer server sits, from where the page was served. */
export function multiplayerSocketUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${location.host}/ws`
}

/**
 * The open rooms, read without joining anything. The title screen needs the list
 * before there is a session at all, so this opens a socket of its own, asks, and
 * hangs up again — the server answers `lobbies` to anyone, joined or not.
 *
 * A server that is not there, or does not answer, gives an empty list rather
 * than an error: the screen still has the code field to fall back on.
 */
export function fetchLobbies(timeoutMs = 4000): Promise<NetLobby[]> {
  return new Promise((resolve) => {
    let socket: WebSocket
    try {
      socket = new WebSocket(multiplayerSocketUrl())
    } catch {
      resolve([])
      return
    }
    let settled = false
    const finish = (lobbies: NetLobby[]): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { socket.close() } catch { /* already gone */ }
      resolve(lobbies)
    }
    const timer = setTimeout(() => finish([]), timeoutMs)
    socket.addEventListener('open', () => socket.send(JSON.stringify({ t: 'lobbies' })))
    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(String(event.data)) as ServerMessage
        if (message.t === 'lobbies') finish(message.lobbies)
      } catch {
        finish([])
      }
    })
    socket.addEventListener('error', () => finish([]))
    socket.addEventListener('close', () => finish([]))
  })
}
