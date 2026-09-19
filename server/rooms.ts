import { WebSocketServer, type WebSocket } from 'ws'
import type { IncomingMessage } from 'node:http'
import { networkInterfaces } from 'node:os'
import type { ClientMessage, NetPlayer, ServerMessage } from '../src/net/protocol.ts'

type RoomClient = {
  id: string
  name: string
  role: 'host' | 'client'
  socket: WebSocket
}

type Room = {
  code: string
  hostId: string
  hostName: string
  clients: Map<string, RoomClient>
  /** When the host's socket went away, so an abandoned room can be swept later. */
  hostAwaySince: number | null
}

const rooms = new Map<string, Room>()

/**
 * Hosting has no time limit. A room lives until its host says it is over, and a
 * host that loses its connection keeps the room and reconnects into it — the
 * session used to die on the first hiccup, because the room was deleted the
 * moment the socket closed and nothing ever dialled back.
 *
 * Two timers keep that honest rather than open-ended:
 * - Without traffic nothing keeps a socket warm. A host waiting alone in a room
 *   sends nothing at all, so routers and proxies drop the connection as idle.
 *   The server pings every round and hangs up on a socket that stops answering,
 *   which both holds the line open and notices a genuinely dead one quickly.
 * - A room whose host has been gone a long time and that nobody is sitting in
 *   any more is swept, so a closed laptop does not keep a code forever. As long
 *   as anyone is still connected, the room stays.
 */
const PING_SECONDS = 25
const ABANDONED_MINUTES = 30

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message))
  }
}

function playersOf(room: Room): NetPlayer[] {
  return [...room.clients.values()].map((client) => ({
    id: client.id,
    name: client.name,
    role: client.role,
  }))
}

function broadcast(room: Room, message: ServerMessage, except?: string): void {
  room.clients.forEach((client) => {
    if (client.id === except) return
    send(client.socket, message)
  })
}

function createCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let index = 0; index < 4; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return rooms.has(code) ? createCode() : code
}

function closeRoom(room: Room, message: string): void {
  broadcast(room, { t: 'closed', message })
  room.clients.forEach((client) => client.socket.close())
  rooms.delete(room.code)
}

/** Rooms nobody sits in whose host has not come back for half an hour. */
function sweepAbandonedRooms(now = Date.now()): string[] {
  const dropped: string[] = []
  for (const room of [...rooms.values()]) {
    if (room.hostAwaySince === null || room.clients.size > 0) continue
    if (now - room.hostAwaySince < ABANDONED_MINUTES * 60_000) continue
    rooms.delete(room.code)
    dropped.push(room.code)
  }
  return dropped
}

/**
 * Pings every socket and hangs up on the ones that did not answer the last
 * round. Browsers reply to a ping themselves, so this needs nothing from the
 * client; it is what stops an idle host connection from being dropped.
 */
function startKeepAlive(wss: WebSocketServer): void {
  const answered = new WeakSet<WebSocket>()
  wss.on('connection', (socket: WebSocket) => {
    answered.add(socket)
    socket.on('pong', () => answered.add(socket))
  })
  const timer = setInterval(() => {
    wss.clients.forEach((socket) => {
      if (!answered.has(socket)) {
        socket.terminate()
        return
      }
      answered.delete(socket)
      socket.ping()
    })
    sweepAbandonedRooms()
  }, PING_SECONDS * 1000)
  timer.unref?.()
}

/** Exposed for the tests; the room map is module state. */
export const roomsForTest = { rooms, sweepAbandonedRooms, ABANDONED_MINUTES }

export function localJoinHost(port: number): string {
  const nets = networkInterfaces()
  for (const list of Object.values(nets)) {
    for (const item of list ?? []) {
      if (item.family === 'IPv4' && !item.internal) {
        return `${item.address}:${port}`
      }
    }
  }
  return `localhost:${port}`
}

export function attachMultiplayer(
  wss: WebSocketServer,
  getJoinHost: () => string,
): void {
  startKeepAlive(wss)
  wss.on('connection', (socket: WebSocket, request: IncomingMessage) => {
    let joined: { room: Room; id: string } | null = null

    socket.on('message', (raw) => {
      let message: ClientMessage
      try {
        message = JSON.parse(String(raw)) as ClientMessage
      } catch {
        send(socket, { t: 'error', message: 'Ungültige Nachricht' })
        return
      }
      if (!message || typeof message !== 'object' || typeof message.t !== 'string') {
        send(socket, { t: 'error', message: 'Ungültige Nachricht' })
        return
      }

      if (message.t === 'host') {
        if (joined) return
        const code = createCode()
        const id = `player-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
        const room: Room = {
          code,
          hostId: id,
          hostName: message.name || 'Host',
          clients: new Map(),
          hostAwaySince: null,
        }
        const client: RoomClient = {
          id,
          name: message.name || 'Host',
          role: 'host',
          socket,
        }
        room.clients.set(id, client)
        rooms.set(code, room)
        joined = { room, id }
        send(socket, {
          t: 'hosted',
          code,
          playerId: id,
          joinUrl: `${getJoinHost()}  ·  Code ${code}`,
          players: playersOf(room),
        })
        return
      }

      if (message.t === 'join') {
        if (joined) return
        const room = rooms.get(message.code.trim().toUpperCase())
        if (!room) {
          send(socket, { t: 'error', message: 'Kein Spiel mit diesem Code' })
          return
        }
        const id = `player-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
        const client: RoomClient = {
          id,
          name: message.name || 'Gast',
          role: 'client',
          socket,
        }
        room.clients.set(id, client)
        joined = { room, id }
        send(socket, {
          t: 'joined',
          code: room.code,
          playerId: id,
          role: 'client',
          players: playersOf(room),
        })
        broadcast(room, { t: 'players', players: playersOf(room), hostAway: room.hostAwaySince !== null }, id)
        return
      }

      // Coming back after a dropped connection. A host reclaims its own seat and
      // the room carries on where it was; anyone else is simply let in again.
      if (message.t === 'resume') {
        if (joined) return
        const room = rooms.get(message.code.trim().toUpperCase())
        if (!room) {
          send(socket, { t: 'error', message: 'Kein Spiel mit diesem Code' })
          return
        }
        if (message.playerId === room.hostId) {
          room.clients.get(room.hostId)?.socket.close()
          room.hostName = message.name || room.hostName
          room.hostAwaySince = null
          room.clients.set(room.hostId, {
            id: room.hostId,
            name: room.hostName,
            role: 'host',
            socket,
          })
          joined = { room, id: room.hostId }
          send(socket, {
            t: 'hosted',
            code: room.code,
            playerId: room.hostId,
            joinUrl: `${getJoinHost()}  ·  Code ${room.code}`,
            players: playersOf(room),
          })
          broadcast(room, { t: 'players', players: playersOf(room) }, room.hostId)
          return
        }
        const id = `player-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
        room.clients.set(id, { id, name: message.name || 'Gast', role: 'client', socket })
        joined = { room, id }
        send(socket, {
          t: 'joined',
          code: room.code,
          playerId: id,
          role: 'client',
          players: playersOf(room),
        })
        broadcast(room, { t: 'players', players: playersOf(room) }, id)
        return
      }

      if (!joined) {
        send(socket, { t: 'error', message: 'Zuerst einem Spiel beitreten' })
        return
      }

      // The one way a room ends on purpose. Everything else is treated as a
      // connection that may still come back.
      if (message.t === 'leave') {
        if (joined.id === joined.room.hostId) closeRoom(joined.room, 'Der Host hat das Spiel beendet')
        else {
          joined.room.clients.delete(joined.id)
          broadcast(joined.room, { t: 'players', players: playersOf(joined.room) })
        }
        joined = null
        socket.close()
        return
      }

      if (message.t === 'resync') {
        const host = joined.room.clients.get(joined.room.hostId)
        if (host) send(host.socket, { t: 'resync' })
        return
      }

      if (message.t === 'command') {
        const host = joined.room.clients.get(joined.room.hostId)
        if (!host) {
          send(socket, { t: 'error', message: 'Host ist nicht verbunden' })
          return
        }
        if (joined.id === joined.room.hostId) return
        send(host.socket, { t: 'command', cmd: message.cmd, from: joined.id })
        return
      }

      if (message.t === 'commandResult' && joined.id === joined.room.hostId) {
        const target = joined.room.clients.get(message.to)
        if (target) send(target.socket, {
          t: 'commandResult',
          commandId: message.commandId,
          result: message.result,
        })
        return
      }

      if (
        joined.id === joined.room.hostId &&
        (message.t === 'state' || message.t === 'world' ||
          message.t === 'sim' ||
          message.t === 'result' ||
          message.t === 'apply' ||
          message.t === 'turn' ||
          message.t === 'sync')
      ) {
        broadcast(joined.room, message, joined.id)
      }
    })

    socket.on('close', () => {
      if (!joined) return
      const { room, id } = joined
      joined = null
      // A socket that was already replaced by a reconnect must not tear down the
      // seat the new one is sitting in.
      if (room.clients.get(id)?.socket !== socket) return
      room.clients.delete(id)
      if (id === room.hostId) {
        // The room stays. The host is expected back, and the guests keep their
        // seats meanwhile — they just cannot build until it is.
        room.hostAwaySince = Date.now()
        broadcast(room, { t: 'players', players: playersOf(room), hostAway: true })
        return
      }
      broadcast(room, { t: 'players', players: playersOf(room), hostAway: room.hostAwaySince !== null })
    })

    void request
  })
}
