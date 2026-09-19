import type { NetLobby, ServerMessage } from './protocol'

/** Where the multiplayer server sits, from where the page was served. */
export function multiplayerSocketUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${location.host}/ws`
}

const LOOPBACK = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|::1|0\.0\.0\.0)$/i

/**
 * The link to hand to the other players.
 *
 * The address the host's own browser used is the one to share: over the
 * internet that is the public name and scheme the server really answers on,
 * behind a reverse proxy it is the proxy's, and on a LAN it is the machine's
 * address — none of which the server can work out for itself from behind a
 * proxy. The exception is a host playing on the very machine that serves the
 * game: "localhost" means nothing to anyone else, so the server's own
 * suggestion (PUBLIC_HOST, or its address on the network) is used instead.
 */
export function inviteLink(code: string, serverHint: string, origin = location.origin): string {
  let base = origin
  try {
    if (LOOPBACK.test(new URL(origin).hostname) && serverHint) {
      base = /^https?:\/\//i.test(serverHint) ? serverHint : `http://${serverHint}`
    }
  } catch {
    // A page from a file:// URL or anything else without a proper origin.
    if (serverHint) base = /^https?:\/\//i.test(serverHint) ? serverHint : `http://${serverHint}`
  }
  return `${base.replace(/\/+$/, '')}/?join=${encodeURIComponent(code)}`
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
