import { WebSocketServer, type WebSocket } from 'ws'
import type { IncomingMessage } from 'node:http'
import { networkInterfaces } from 'node:os'
import type { ClientMessage, NetLobby, NetPlayer, ServerMessage } from '../src/net/protocol.ts'
import { cleanChatPing, cleanChatText, isSendableChat } from '../src/net/chatProtocol.ts'

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
  /** Listed for anyone to join. A private room is only reachable by its code. */
  public: boolean
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

/**
 * Limits that only matter once the server is somewhere anyone can reach it.
 * A name is a stranger's text that ends up in other players' windows, and a
 * room is state the server keeps for free, so neither is unbounded.
 */
const NAME_LIMIT = 24
const ROOM_LIMIT = Number(process.env.MAX_ROOMS || 200)

/** Trimmed, length-capped, and never empty, whatever arrived on the wire. */
function cleanName(name: unknown, fallback: string): string {
  if (typeof name !== 'string') return fallback
  // Control characters would break the line the name is printed on.
  const clean = name.replace(/\p{Cc}/gu, ' ').trim().slice(0, NAME_LIMIT).trim()
  return clean || fallback
}

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

/** The rooms that put themselves on the list, newest rooms last. */
function publicLobbies(): NetLobby[] {
  return [...rooms.values()]
    .filter((room) => room.public)
    .map((room) => ({
      code: room.code,
      host: room.hostName,
      players: room.clients.size,
      hostAway: room.hostAwaySince !== null,
    }))
}

function broadcast(room: Room, message: ServerMessage, except?: string): void {
  room.clients.forEach((client) => {
    if (client.id === except) return
    send(client.socket, message)
  })
}

/** Sanitize and relay ephemeral chat / map pings to every seat in the room. */
function relayChat(
  room: Room,
  clientId: string,
  message: Extract<ClientMessage, { t: 'chat' }>,
): void {
  const client = room.clients.get(clientId)
  if (!client) return
  const text = cleanChatText(message.text)
  const ping = cleanChatPing(message.ping)
  if (!isSendableChat(text, ping)) return
  broadcast(room, {
    t: 'chat',
    id: `chat-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    from: client.id,
    name: client.name,
    text,
    ...(ping ? { ping } : {}),
  })
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function createCode(): string {
  let code = ''
  for (let index = 0; index < 4; index += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return rooms.has(code) ? createCode() : code
}

/**
 * The code a save has hosted under before, if it is still to be had. Keeping it
 * means an invite someone was given a week ago still works, instead of every
 * session handing out a fresh one. A code that is taken right now — by another
 * copy of the same save, or by chance — falls back to a new one.
 */
function codeFor(wanted: string | undefined): string {
  if (typeof wanted !== 'string') return createCode()
  const code = wanted.trim().toUpperCase()
  if (code.length !== 4) return createCode()
  if ([...code].some(letter => !CODE_ALPHABET.includes(letter))) return createCode()
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
        // A public server should not be turned into a room factory. Rooms that
        // nobody came back to are swept first, so a full map is really full.
        if (rooms.size >= ROOM_LIMIT) {
          sweepAbandonedRooms()
          if (rooms.size >= ROOM_LIMIT) {
            send(socket, { t: 'error', message: 'Der Server ist gerade voll. Bitte später noch einmal.' })
            return
          }
        }
        // The room this save opened last time is still standing but has no host
        // in it — a reloaded page, a closed laptop. That is this save coming
        // back, so it takes its own room over instead of being handed a new
        // code, and the guests still sitting in it keep playing.
        const returning = message.code ? rooms.get(message.code.trim().toUpperCase()) : undefined
        if (returning && returning.hostAwaySince !== null) {
          const id = `player-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
          returning.clients.delete(returning.hostId)
          returning.hostId = id
          returning.hostName = cleanName(message.name, 'Host')
          returning.hostAwaySince = null
          returning.public = message.public === true
          returning.clients.set(id, { id, name: returning.hostName, role: 'host', socket })
          joined = { room: returning, id }
          send(socket, {
            t: 'hosted',
            code: returning.code,
            playerId: id,
            joinUrl: getJoinHost(),
            players: playersOf(returning),
          })
          broadcast(returning, { t: 'players', players: playersOf(returning) }, id)
          return
        }
        const code = codeFor(message.code)
        const id = `player-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
        const room: Room = {
          code,
          hostId: id,
          hostName: cleanName(message.name, 'Host'),
          clients: new Map(),
          hostAwaySince: null,
          public: message.public === true,
        }
        const client: RoomClient = {
          id,
          name: cleanName(message.name, 'Host'),
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
          joinUrl: getJoinHost(),
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
          name: cleanName(message.name, 'Gast'),
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
          room.hostName = cleanName(message.name, room.hostName)
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
            joinUrl: getJoinHost(),
            players: playersOf(room),
          })
          broadcast(room, { t: 'players', players: playersOf(room) }, room.hostId)
          return
        }
        const id = `player-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
        room.clients.set(id, { id, name: cleanName(message.name, 'Gast'), role: 'client', socket })
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

      // Anyone may read the list, including a player still on the title screen
      // who has not joined anything yet.
      if (message.t === 'lobbies') {
        send(socket, { t: 'lobbies', lobbies: publicLobbies() })
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

      // Chat and map pings are UI events, not simulation commands.
      if (message.t === 'chat') {
        relayChat(joined.room, joined.id, message)
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
