import { WebSocketServer, type WebSocket } from 'ws'
import type { IncomingMessage } from 'node:http'
import { networkInterfaces } from 'node:os'
import type { ClientMessage, NetLobby, NetPlayer, ServerMessage } from '../src/net/protocol.ts'
import { cleanChatPing, cleanChatText, isSendableChat } from './chatProtocol.ts'
import {
  applyDeltaToCache,
  cacheFromSync,
  cachedWorld,
  MAX_CACHED_WORLD_BYTES,
  type CachedDelta,
  type WorldCache,
} from './worldCache.ts'

type RoomClient = {
  id: string
  name: string
  role: 'host' | 'client'
  socket: WebSocket
  /** Order of arrival. When the host is gone for good, the longest-seated guest is asked first. */
  joinOrder: number
  /** Was handed a full world (relayed or from the cache), so it could carry the room on. */
  hasWorld: boolean
  /** Could not build the world it was handed once; not asked again. */
  failedTakeover: boolean
  /** When the server last answered a resync from its own copy, so it cannot be made to spin. */
  servedAt: number
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
  /** Counts takeovers in this room. */
  epoch: number
  /** Runs out when a guest takes the room over; null while nobody waits for that. */
  takeoverTimer: ReturnType<typeof setTimeout> | null
  takeoverAt: number | null
  /** The newest world the host sent while guests were in the room. */
  cache: WorldCache | null
  /** A promoted guest has not sent its first world yet. */
  awaitingSync: boolean
  /** Who held the room before the last takeover, put back if that takeover fails. */
  previousHost: { id: string; name: string } | null
  /** Seats that lost the room to a takeover; coming back, they are guests and told so. */
  formerHosts: Set<string>
  /** How the server names itself in invite links, for a promoted guest. */
  joinHost: () => string
}

/** One socket and the seat it sits on, if any. */
type Connection = {
  socket: WebSocket
  joined: { room: Room; id: string } | null
  joinHost: () => string
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

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') return fallback
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

/**
 * Host takeover. A host that drops out without saying so gets this long to come
 * back — a reload plus loading the park, and longer than the client's first
 * reconnect attempts — before a guest carries the room on with the world the
 * server kept. Short enough that nobody stares at a frozen park for long.
 */
const HOST_TAKEOVER_SECONDS = envNumber('HOST_TAKEOVER_SECONDS', 20)
/** A room keeps no world above this size; the chosen guest then builds on its own mirror. */
const CACHE_LIMIT = envNumber('MAX_CACHED_WORLD_BYTES', MAX_CACHED_WORLD_BYTES)
/** A resync answered from the server's copy is a whole world; once per few seconds is plenty. */
const CACHE_SERVE_INTERVAL_MS = 4000
const HOST_AWAY_MESSAGE = 'Host ist weg – Bauen pausiert'
const HOST_RELAYED = new Set<string>(['state', 'world', 'sim', 'result', 'apply', 'turn', 'sync'])
let takeoverDelayMs = HOST_TAKEOVER_SECONDS * 1000
let joinSequence = 0

/** Trimmed, length-capped, and never empty, whatever arrived on the wire. */
function cleanName(name: unknown, fallback: string): string {
  if (typeof name !== 'string') return fallback
  // Control characters would break the line the name is printed on.
  const clean = name.replace(/\p{Cc}/gu, ' ').trim().slice(0, NAME_LIMIT).trim()
  return clean || fallback
}

function roomCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

function newPlayerId(): string {
  return `player-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
}

function seat(socket: WebSocket, name: string, role: RoomClient['role'], id = newPlayerId()): RoomClient {
  joinSequence += 1
  return { id, name, role, socket, joinOrder: joinSequence, hasWorld: role === 'host', failedTakeover: false, servedAt: 0 }
}

function sendText(socket: WebSocket, text: string): void {
  if (socket.readyState === socket.OPEN) socket.send(text)
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message))
}

function isOpen(client: RoomClient): boolean {
  return client.socket.readyState === client.socket.OPEN
}

function playersOf(room: Room): NetPlayer[] {
  return [...room.clients.values()].map((client) => ({
    id: client.id,
    name: client.name,
    role: client.role,
  }))
}

function guestsOf(room: Room): RoomClient[] {
  return [...room.clients.values()].filter((client) => client.id !== room.hostId)
}

function takeoverCountdown(room: Room): { takeoverInMs?: number } {
  return room.takeoverAt === null ? {} : { takeoverInMs: Math.max(0, room.takeoverAt - Date.now()) }
}

/** Who is in the room and whether the host's seat is empty — always said, both ways. */
function playersMessage(room: Room): ServerMessage {
  return {
    t: 'players',
    players: playersOf(room),
    hostAway: room.hostAwaySince !== null,
    ...takeoverCountdown(room),
  }
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

/** One encoding for every seat: a world is megabytes, and it used to be written once per guest. */
function broadcastText(room: Room, text: string, except?: string): void {
  room.clients.forEach((client) => {
    if (client.id === except) return
    sendText(client.socket, text)
  })
}

function broadcast(room: Room, message: ServerMessage, except?: string): void {
  broadcastText(room, JSON.stringify(message), except)
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

function clearTakeover(room: Room): void {
  if (room.takeoverTimer) clearTimeout(room.takeoverTimer)
  room.takeoverTimer = null
  room.takeoverAt = null
}

function closeRoom(room: Room, message: string): void {
  clearTakeover(room)
  room.cache = null
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
    clearTakeover(room)
    room.cache = null
    rooms.delete(room.code)
    dropped.push(room.code)
  }
  return dropped
}

/** Somebody could carry the room on: the server kept its world, or a guest was handed one. */
function canTakeOver(room: Room): boolean {
  return room.cache !== null || guestsOf(room).some((client) => client.hasWorld && !client.failedTakeover)
}

/**
 * Starts the countdown after which a guest takes over a room whose host is gone.
 * It runs from when the host left, so a guest walking in later does not restart it.
 */
function scheduleTakeover(room: Room, delayMs?: number): void {
  if (room.hostAwaySince === null || room.takeoverTimer || !canTakeOver(room)) return
  const delay = delayMs ?? Math.max(0, room.hostAwaySince + takeoverDelayMs - Date.now())
  room.takeoverAt = Date.now() + delay
  const timer = setTimeout(() => {
    room.takeoverTimer = null
    room.takeoverAt = null
    if (rooms.get(room.code) !== room) return
    if (!electHost(room)) broadcast(room, playersMessage(room))
  }, delay)
  // A countdown alone must never keep the process (or a test run) alive.
  timer.unref?.()
  room.takeoverTimer = timer
}

/** The guest to hand the room to: one that has the world, the longest-seated first. */
function takeoverCandidate(room: Room, preferred?: string): RoomClient | undefined {
  const eligible = guestsOf(room).filter((client) =>
    isOpen(client) && !client.failedTakeover && (client.hasWorld || room.cache !== null))
  return eligible.find((client) => client.id === preferred) ??
    eligible.sort((a, b) => Number(b.hasWorld) - Number(a.hasWorld) || a.joinOrder - b.joinOrder)[0]
}

/**
 * Hands a room whose host is gone to a guest. The chosen one gets the server's
 * world (`promoted`) and builds it the way a save is loaded; everyone else is
 * told who holds the room now (`hostChanged`). The server decides alone, so there
 * is never a second authority. False when nobody can take the room.
 */
function electHost(room: Room, preferred?: string): boolean {
  clearTakeover(room)
  if (room.hostAwaySince === null) return false
  const heir = takeoverCandidate(room, preferred)
  if (!heir) return false
  room.previousHost = { id: room.hostId, name: room.hostName }
  room.formerHosts.add(room.hostId)
  room.hostId = heir.id
  room.hostName = heir.name
  room.hostAwaySince = null
  room.awaitingSync = true
  room.epoch += 1
  heir.role = 'host'
  const players = playersOf(room)
  send(heir.socket, {
    t: 'promoted',
    code: room.code,
    playerId: heir.id,
    joinUrl: room.joinHost(),
    players,
    epoch: room.epoch,
    public: room.public,
    ...(room.cache ? { world: cachedWorld(room.cache), worldAgeMs: Math.max(0, Date.now() - room.cache.updatedAt) } : {}),
  })
  broadcast(room, { t: 'hostChanged', hostId: heir.id, hostName: heir.name, players, epoch: room.epoch }, heir.id)
  return true
}

/** The host's seat emptied without a word: wait for it, and start the takeover countdown. */
function hostGone(room: Room): void {
  // A guest promoted a moment ago that drops before its first world never held
  // the room; the next one is asked at once instead of after another wait.
  const neverSynced = room.awaitingSync
  room.awaitingSync = false
  room.hostAwaySince = Date.now()
  scheduleTakeover(room, neverSynced ? 0 : undefined)
  broadcast(room, playersMessage(room))
}

function hostReturned(room: Room): void {
  clearTakeover(room)
  room.hostAwaySince = null
  room.awaitingSync = false
}

function guestLeft(room: Room): void {
  // A host alone in its room stops sending, so what the server holds would only
  // grow stale — and nobody is left who could carry it on anyway.
  if (room.hostAwaySince === null && guestsOf(room).length === 0) room.cache = null
  if (room.clients.size === 0) clearTakeover(room)
  broadcast(room, playersMessage(room))
}

/** A guest in a room without host gets the server's world: to look at, and to carry on. */
function serveCachedWorld(room: Room, client: RoomClient): void {
  if (room.hostAwaySince === null || !room.cache) return
  const now = Date.now()
  if (now - client.servedAt < CACHE_SERVE_INTERVAL_MS) return
  client.servedAt = now
  client.hasWorld = true
  send(client.socket, { t: 'sync', world: cachedWorld(room.cache) })
}

function sendHosted(connection: Connection, room: Room): void {
  send(connection.socket, {
    t: 'hosted',
    code: room.code,
    playerId: room.hostId,
    joinUrl: connection.joinHost(),
    players: playersOf(room),
  })
}

/**
 * The room this save opened last time is still standing but has no host in it —
 * a reloaded page, a closed laptop. That is this save coming back, so it takes
 * its own room over instead of being handed a new code, and the guests still
 * sitting in it keep playing.
 */
function reclaimRoom(connection: Connection, room: Room, message: Extract<ClientMessage, { t: 'host' }>): void {
  const host = seat(connection.socket, cleanName(message.name, 'Host'), 'host')
  room.clients.delete(room.hostId)
  room.hostId = host.id
  room.hostName = host.name
  room.public = message.public === true
  hostReturned(room)
  room.clients.set(host.id, host)
  connection.joined = { room, id: host.id }
  sendHosted(connection, room)
  broadcast(room, playersMessage(room), host.id)
}

function openRoom(connection: Connection, message: Extract<ClientMessage, { t: 'host' }>): void {
  const code = codeFor(message.code)
  const host = seat(connection.socket, cleanName(message.name, 'Host'), 'host')
  const room: Room = {
    code,
    hostId: host.id,
    hostName: host.name,
    clients: new Map([[host.id, host]]),
    hostAwaySince: null,
    public: message.public === true,
    epoch: 0,
    takeoverTimer: null,
    takeoverAt: null,
    cache: null,
    awaitingSync: false,
    previousHost: null,
    formerHosts: new Set(),
    joinHost: connection.joinHost,
  }
  rooms.set(code, room)
  connection.joined = { room, id: host.id }
  sendHosted(connection, room)
}

function handleHost(connection: Connection, message: Extract<ClientMessage, { t: 'host' }>): void {
  if (connection.joined) return
  // A public server should not be turned into a room factory. Rooms that
  // nobody came back to are swept first, so a full map is really full.
  if (rooms.size >= ROOM_LIMIT) {
    sweepAbandonedRooms()
    if (rooms.size >= ROOM_LIMIT) {
      send(connection.socket, { t: 'error', message: 'Der Server ist gerade voll. Bitte später noch einmal.' })
      return
    }
  }
  const returning = rooms.get(roomCode(message.code))
  if (returning && returning.hostAwaySince !== null) reclaimRoom(connection, returning, message)
  else openRoom(connection, message)
}

function seatGuest(connection: Connection, room: Room, name: string, demoted: boolean): void {
  const guest = seat(connection.socket, name, 'client')
  room.clients.set(guest.id, guest)
  connection.joined = { room, id: guest.id }
  // Somebody arriving in a room without host may be the one to carry it on.
  if (room.hostAwaySince !== null && room.cache) scheduleTakeover(room)
  send(connection.socket, {
    t: 'joined',
    code: room.code,
    playerId: guest.id,
    role: 'client',
    players: playersOf(room),
    hostAway: room.hostAwaySince !== null,
    ...takeoverCountdown(room),
    ...(demoted ? { demoted: true, hostName: room.hostName } : {}),
  })
  broadcast(room, playersMessage(room), guest.id)
  serveCachedWorld(room, guest)
}

function handleJoin(connection: Connection, message: Extract<ClientMessage, { t: 'join' }>): void {
  if (connection.joined) return
  const room = rooms.get(roomCode(message.code))
  if (!room) {
    send(connection.socket, { t: 'error', message: 'Kein Spiel mit diesem Code' })
    return
  }
  seatGuest(connection, room, cleanName(message.name, 'Gast'), false)
}

function resumeHost(connection: Connection, room: Room, message: Extract<ClientMessage, { t: 'resume' }>): void {
  room.clients.get(room.hostId)?.socket.close()
  room.hostName = cleanName(message.name, room.hostName)
  hostReturned(room)
  room.clients.set(room.hostId, seat(connection.socket, room.hostName, 'host', room.hostId))
  connection.joined = { room, id: room.hostId }
  sendHosted(connection, room)
  broadcast(room, playersMessage(room), room.hostId)
}

/**
 * Coming back after a dropped connection. A host reclaims its own seat and the
 * room carries on where it was; anyone else is simply let in again — including
 * a host whose room was taken over meanwhile, who is told so.
 */
function handleResume(connection: Connection, message: Extract<ClientMessage, { t: 'resume' }>): void {
  if (connection.joined) return
  const room = rooms.get(roomCode(message.code))
  if (!room) {
    send(connection.socket, { t: 'error', message: 'Kein Spiel mit diesem Code' })
    return
  }
  if (message.playerId === room.hostId) resumeHost(connection, room, message)
  else seatGuest(connection, room, cleanName(message.name, 'Gast'), room.formerHosts.has(message.playerId))
}

/** The host leaves on purpose but lets the room live on: a guest takes over right away. */
function handOver(room: Room, hostId: string, preferred?: string): void {
  room.clients.delete(hostId)
  room.awaitingSync = false
  room.hostAwaySince = Date.now()
  if (!electHost(room, preferred)) closeRoom(room, 'Der Host hat das Spiel beendet')
}

/** The one way a room ends on purpose. Everything else is treated as a connection that may still come back. */
function handleLeave(connection: Connection, message: Extract<ClientMessage, { t: 'leave' }>): void {
  const { room, id } = connection.joined!
  connection.joined = null
  if (id !== room.hostId) {
    room.clients.delete(id)
    guestLeft(room)
  } else if (message.handOver === true && guestsOf(room).length > 0) {
    handOver(room, id, typeof message.to === 'string' ? message.to : undefined)
  } else {
    closeRoom(room, 'Der Host hat das Spiel beendet')
  }
  connection.socket.close()
}

/** A promoted guest could not build the world: put the room back and ask the next one. */
function handleTakeoverFailed(room: Room, id: string): void {
  if (id !== room.hostId || !room.awaitingSync) return
  const failed = room.clients.get(id)
  if (failed) {
    failed.role = 'client'
    failed.failedTakeover = true
  }
  if (room.previousHost) {
    room.formerHosts.delete(room.previousHost.id)
    room.hostId = room.previousHost.id
    room.hostName = room.previousHost.name
  }
  room.awaitingSync = false
  room.hostAwaySince = Date.now()
  if (!electHost(room)) broadcast(room, playersMessage(room))
}

function handleResync(room: Room, id: string): void {
  const host = room.clients.get(room.hostId)
  if (host) {
    send(host.socket, { t: 'resync' })
    return
  }
  const client = room.clients.get(id)
  if (client) serveCachedWorld(room, client)
}

function forwardCommand(
  room: Room,
  fromId: string,
  socket: WebSocket,
  message: Extract<ClientMessage, { t: 'command' }>,
): void {
  const host = room.clients.get(room.hostId)
  if (!host) {
    // Answered per command, so the guest drops exactly this one instead of
    // replaying it onto every world it is sent later.
    const commandId = message.cmd?.clientCommandId
    if (typeof commandId === 'string') {
      send(socket, { t: 'commandResult', commandId, result: { ok: false, message: HOST_AWAY_MESSAGE } })
    } else {
      send(socket, { t: 'error', message: 'Host ist nicht verbunden' })
    }
    return
  }
  if (fromId === room.hostId) return
  send(host.socket, { t: 'command', cmd: message.cmd, from: fromId })
}

/**
 * What the host sends goes to every other seat as the very text it arrived as.
 * A full world and every delta after it also update the server's copy, so the
 * room can outlive its host.
 */
function relayFromHost(room: Room, text: string, message: ClientMessage): void {
  if (message.t === 'sync') {
    room.awaitingSync = false
    const guests = guestsOf(room).filter(isOpen)
    guests.forEach((guest) => { guest.hasWorld = true })
    room.cache = guests.length > 0 ? cacheFromSync(message.world, text.length, Date.now(), CACHE_LIMIT) : null
  } else if (message.t === 'state' && room.cache) {
    room.cache = applyDeltaToCache(room.cache, message as unknown as CachedDelta, text.length, Date.now(), CACHE_LIMIT)
  }
  broadcastText(room, text, room.hostId)
}

function handleRoomMessage(connection: Connection, text: string, message: ClientMessage): void {
  const { room, id } = connection.joined!
  switch (message.t) {
    case 'leave':
      handleLeave(connection, message)
      return
    case 'resync':
      handleResync(room, id)
      return
    case 'command':
      forwardCommand(room, id, connection.socket, message)
      return
    // Chat and map pings are UI events, not simulation commands.
    case 'chat':
      relayChat(room, id, message)
      return
    case 'takeoverFailed':
      handleTakeoverFailed(room, id)
      return
    case 'commandResult': {
      if (id !== room.hostId) return
      const target = room.clients.get(message.to)
      if (target) send(target.socket, { t: 'commandResult', commandId: message.commandId, result: message.result })
      return
    }
    default:
      if (id === room.hostId && HOST_RELAYED.has(message.t)) relayFromHost(room, text, message)
  }
}

function handleText(connection: Connection, text: string): void {
  let message: ClientMessage
  try {
    message = JSON.parse(text) as ClientMessage
  } catch {
    send(connection.socket, { t: 'error', message: 'Ungültige Nachricht' })
    return
  }
  if (!message || typeof message !== 'object' || typeof message.t !== 'string') {
    send(connection.socket, { t: 'error', message: 'Ungültige Nachricht' })
    return
  }
  switch (message.t) {
    case 'host':
      handleHost(connection, message)
      return
    case 'join':
      handleJoin(connection, message)
      return
    case 'resume':
      handleResume(connection, message)
      return
    // Anyone may read the list, including a player still on the title screen
    // who has not joined anything yet.
    case 'lobbies':
      send(connection.socket, { t: 'lobbies', lobbies: publicLobbies() })
      return
  }
  if (!connection.joined) {
    send(connection.socket, { t: 'error', message: 'Zuerst einem Spiel beitreten' })
    return
  }
  handleRoomMessage(connection, text, message)
}

function handleClose(connection: Connection): void {
  if (!connection.joined) return
  const { room, id } = connection.joined
  connection.joined = null
  // A socket that was already replaced by a reconnect must not tear down the
  // seat the new one is sitting in.
  if (room.clients.get(id)?.socket !== connection.socket) return
  room.clients.delete(id)
  // The room stays. The host is expected back, and the guests keep their seats
  // meanwhile — until a guest takes the room over.
  if (id === room.hostId) hostGone(room)
  else guestLeft(room)
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
export const roomsForTest = {
  rooms,
  sweepAbandonedRooms,
  ABANDONED_MINUTES,
  HOST_TAKEOVER_SECONDS,
  electHost,
  takeoverCandidate,
  cachedWorld: (room: Room) => (room.cache ? cachedWorld(room.cache) : null),
  takeoverDelayMs: () => takeoverDelayMs,
  setTakeoverDelay: (ms: number) => { takeoverDelayMs = ms },
}

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
    const connection: Connection = { socket, joined: null, joinHost: getJoinHost }
    socket.on('message', (raw) => handleText(connection, String(raw)))
    socket.on('close', () => handleClose(connection))
    void request
  })
}
