import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { WebSocket, WebSocketServer } from 'ws'
import { GameState } from '../src/game/GameState'
import type { GameSnapshot } from '../src/game/types/snapshot'
import { packWorld } from '../src/net/codec'
import { mergeVisitorPatches, WorldUpdates } from '../src/net/worldUpdates'
import { MultiplayerSession, type DemotedInfo, type MultiplayerStatus } from '../src/net/session'
import { enableMultiplayerCommands } from '../src/net/bind'
import type { GameCommand } from '../src/net/protocol'
import {
  demotedBackupName,
  demotedNotice,
  droppedActionsNotice,
  gameFromNetworkWorld,
  hostAwayNotice,
  promotedNotice,
  takeoverSaveName,
} from '../src/net/takeover'
import { mountProgressTracker } from '../src/ui/progressTracker'
import { attachMultiplayer, roomsForTest } from '../server/rooms'
import { applyDeltaToCache, cachedSimTick, cachedWorld, cacheFromSync } from '../server/worldCache'

type Fixture = (count?: number) => GameState
type AsWire = (game: GameState) => unknown

const wire = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
  }
}

function withStorage<T>(run: () => T): T {
  const previous = globalThis.localStorage
  Object.assign(globalThis, { localStorage: memoryStorage() })
  try { return run() } finally { Object.assign(globalThis, { localStorage: previous }) }
}

/**
 * The server's copy of a room merges full syncs and deltas exactly like a guest:
 * same fields, same visitor order (the order decides the host's RNG draws), and
 * a world over the size limit is not kept at all.
 */
export function testWorldCache(fixture: Fixture, asWire: AsWire): void {
  const byId = new Map([['a', { id: 'a', x: 0 }], ['b', { id: 'b', x: 0 }], ['c', { id: 'c', x: 0 }]])
  mergeVisitorPatches(byId, [{ id: 'd', changes: { id: 'd', x: 4 } }, { id: 'a', changes: { x: 1 } }], ['b'])
  assert.deepEqual([...byId.keys()], ['a', 'c', 'd'], 'removals first, known visitors keep their place, new ones go last')
  assert.equal(byId.get('a')!.x, 1)

  const host = fixture(12)
  const client = new GameState()
  client.networkMode = 'client'
  const updates = new WorldUpdates()
  const full = updates.encode(packWorld(host.snapshot), true)
  const sync = JSON.parse(full)
  const cache = cacheFromSync(sync.world, full.length, 0)
  assert.ok(cache)
  client.applyNetworkWorld(sync.world)
  for (let i = 0; i < 30; i++) {
    host.tick(0.1)
    if (i === 5) (host as any).spawnVisitorMember('day', 'late-group', 'pedestrian', false)
    if (i === 10) (host.snapshot.visitors as unknown[]).splice(0, 1)
    const text = updates.encode(packWorld(host.snapshot))
    const delta = JSON.parse(text)
    assert.equal(applyDeltaToCache(cache, delta, text.length, i), cache)
    client.applyNetworkUpdate(delta.world, delta.visitors, delta.removed)
  }
  assert.deepEqual(wire(cachedWorld(cache)), asWire(host), 'the server copy is the world the host sent')
  assert.deepEqual(
    cachedWorld(cache).visitors.map((visitor) => visitor.id),
    client.snapshot.visitors.map((visitor) => visitor.id),
    'and its visitors stand in the order a guest has them',
  )
  assert.equal(cachedSimTick(cache), host.snapshot.simTick)
  assert.equal(cache.updatedAt, 29)
  assert.equal(cacheFromSync(sync.world, 100, 0, 50), null, 'a world over the limit is not kept')
  assert.equal(applyDeltaToCache(cache, { world: {} }, 100, 0, 50), null, 'nor one that a delta pushes over it')
  assert.equal(cacheFromSync({ visitors: 'no' }, 10, 0), null, 'nor something that is no world')
}

/**
 * A promoted guest builds its world the way a save is loaded: RNG from the
 * snapshot, its own tool kept, the room code stamped. The guest's mirror alone
 * never had its RNG moved by deltas.
 */
export function testTakeoverWorld(fixture: Fixture): void {
  const host = fixture(8)
  for (let i = 0; i < 20; i++) host.tick(0.1)
  const world = wire(packWorld(host.snapshot)) as ReturnType<typeof packWorld>
  const local = new GameState()
  local.setTool('path')
  local.adjustBuildElevation(1)
  const next = gameFromNetworkWorld(world, local, 'AB12')
  assert.ok(next)
  assert.notEqual(next, local, 'a new game, never the mirror switched in place')
  assert.equal(next.snapshot.simTick, host.snapshot.simTick)
  assert.equal(next.snapshot.rngState, host.snapshot.rngState)
  assert.equal(next.rng.getState(), host.snapshot.rngState, 'the RNG continues where the host left off')
  assert.equal(next.snapshot.selectedTool, 'inspect', 'the tool resets as after any load')
  assert.equal(next.snapshot.buildElevation, local.snapshot.buildElevation, 'the build height is the player’s own')
  assert.equal(next.snapshot.multiplayerCode, 'AB12', 'and the world carries the room code it now hosts')
  assert.equal(next.snapshot.visitors.length, host.snapshot.visitors.length)
  const before = next.snapshot.simTick
  for (let i = 0; i < 5; i++) next.tick(0.1)
  assert.equal(next.snapshot.simTick, before + 5, 'the inherited world simulates')

  local.rememberMultiplayerCode('OWN1')
  const alone = gameFromNetworkWorld(undefined, local)
  assert.ok(alone)
  assert.equal(alone.snapshot.multiplayerCode, 'OWN1', 'carrying on alone keeps the player’s own code')
  assert.equal(alone.rng.getState(), local.snapshot.rngState)

  // Hosting away is announced, and building then is refused instead of shown.
  const guest = new GameState(host.snapshot)
  enableMultiplayerCommands(guest)
  guest.networkMode = 'client'
  const sent: GameCommand[] = []
  guest.commandOutbox = (command) => sent.push(command)
  guest.networkPause = 'Host ist weg – Bauen pausiert'
  const refused = guest.place('path', -8, 0)
  assert.equal(refused.ok, false)
  assert.equal(refused.message, 'Host ist weg – Bauen pausiert')
  assert.equal(sent.length, 0, 'nothing goes out')
  assert.ok(!guest.snapshot.buildings.some((building) => building.x === -8 && building.z === 0), 'and no ghost appears')
  guest.networkPause = null
  assert.ok(guest.place('path', -8, 0).ok)
  assert.equal(guest.discardOptimisticCommands().length, 1)
  assert.equal(guest.discardOptimisticCommands().length, 0)
}

/** The server picks alone: open seats that have the world, the longest-seated first. */
export function testTakeoverElection(): void {
  const socket = (open = true) => ({ readyState: open ? 1 : 3, OPEN: 1, send: () => {}, close: () => {} })
  const guest = (id: string, joinOrder: number, hasWorld: boolean, open = true, failedTakeover = false) =>
    [id, { id, name: id, role: 'client', socket: socket(open), joinOrder, hasWorld, failedTakeover, servedAt: 0 }] as const
  const room = {
    hostId: 'gone',
    cache: null as unknown,
    clients: new Map<string, unknown>([
      guest('fresh', 1, false),
      guest('late', 4, true),
      guest('early', 2, true),
      guest('closed', 0, true, false),
      guest('failed', 0, true, true, true),
    ]),
  } as any
  const pick = (preferred?: string) => roomsForTest.takeoverCandidate(room, preferred)?.id
  assert.equal(pick(), 'early', 'with the world, open, never failed, seated longest')
  assert.equal(pick('late'), 'late', 'the host handing over may name the heir')
  assert.equal(pick('fresh'), 'early', 'but not one without the world when the server keeps none')
  room.cache = {}
  assert.equal(pick('fresh'), 'fresh', 'with the server copy anyone open can take it')
  assert.equal(pick(), 'early', 'still preferring a guest that already has the world')
  room.clients = new Map([guest('closed', 0, true, false)])
  assert.equal(pick(), undefined, 'nobody reachable, nobody chosen')
}

/** The texts a player reads, the slot names, and who earns progress. */
export function testTakeoverNotices(fixture: Fixture): void {
  const now = 1_000_000
  assert.equal(hostAwayNotice(now + 14_100, now), 'Host ist weg – Übernahme in 15 s')
  assert.equal(hostAwayNotice(now - 1, now), 'Host ist weg – Übernahme läuft …')
  assert.equal(hostAwayNotice(0, now), 'Der Host ist weg und niemand hat den Spielstand – warte auf Rückkehr.')
  assert.equal(droppedActionsNotice(1), '1 unbestätigte Aktion verworfen – bitte prüfen.')
  assert.equal(droppedActionsNotice(3), '3 unbestätigte Aktionen verworfen – bitte prüfen.')
  assert.match(promotedNotice('AB12', 5000, 2), /^Du bist jetzt Host von Raum AB12\. .* Stand von vor 5 s übernommen\. 2 unbestätigte/)
  assert.doesNotMatch(promotedNotice('AB12', 800, 0), /Stand von vor/)
  assert.equal(takeoverSaveName('AB12'), 'Übernommen AB12')
  assert.equal(demotedBackupName('AB12'), 'Vor Host-Wechsel AB12')
  assert.match(demotedNotice('Anna', 'AB12'), /Anna übernommen\. Du spielst als Gast weiter\. .*„Vor Host-Wechsel AB12“ gesichert/)
  assert.match(demotedNotice('', 'AB12', 'voll'), /ein Gast übernommen.*fehlgeschlagen: voll/)

  withStorage(() => {
    // The backup of a demoted host is a local slot of any snapshot, not only the running game.
    const world = fixture(2)
    for (let i = 0; i < 3; i++) world.tick(0.1)
    const saved = GameState.saveSnapshotSlot(world.snapshot, demotedBackupName('AB12'))
    assert.ok(saved.ok && saved.slotId)
    const again = GameState.saveSnapshotSlot(world.snapshot, demotedBackupName('AB12'), saved.slotId)
    assert.equal(again.slotId, saved.slotId, 'a second backup replaces the first')
    assert.equal(GameState.listSaveSlots().length, 1)
    assert.equal(GameState.loadSlot(saved.slotId!)?.snapshot.simTick, world.snapshot.simTick)

    // An inherited park earns nothing, exactly like a guest's view of one.
    let inherited = true
    const tracker = mountProgressTracker({ isClient: () => false, isInheritedWorld: () => inherited, showToast: () => {}, onChange: () => {} })
    const decided = structuredClone(world.snapshot) as GameSnapshot
    decided.scenario.preset = 'takeover-test'
    decided.scenarioProgress.outcome.state = 'won'
    tracker.recordDecided(decided)
    assert.equal(tracker.records().scenarios['takeover-test'], undefined, 'no win for somebody else’s park')
    inherited = false
    tracker.recordDecided(decided)
    assert.equal(tracker.records().scenarios['takeover-test']?.won, true, 'the own park still counts')
  })
}

async function until(condition: () => boolean, ms = 3000): Promise<void> {
  const deadline = performance.now() + ms
  while (!condition()) {
    assert.ok(performance.now() < deadline, 'WebSocket operation timed out')
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Host ticks by hand, then flushes the last delta so every guest can catch up. */
function hostTicks(game: GameState, session: MultiplayerSession, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    game.tick(0.1)
    session.tick(0.1)
  }
  session.tick(0.2)
}

function hasPathAt(game: GameState, x: number, z: number): boolean {
  return game.snapshot.buildings.some((building) => building.kind === 'path' && building.x === x && building.z === z)
}

/** Takes the next game a promoted session builds, the way main.ts binds it. */
function promotedGame(session: MultiplayerSession): { game: GameState | null } {
  const holder: { game: GameState | null } = { game: null }
  session.onPromoted = (next) => {
    holder.game = next
    enableMultiplayerCommands(next)
    session.attach(next)
  }
  return holder
}

/**
 * Real sockets: a host that leaves for good hands the room to a guest, the old
 * host comes back as a guest with a backup, a host back within the grace period
 * keeps its room, nobody without the world is promoted, a hand-over is
 * immediate, unanswered commands are dropped instead of replayed, and a chosen
 * guest that fails is replaced by the next one.
 */
export async function testHostTakeover(fixture: Fixture, asWire: AsWire): Promise<void> {
  const wss = new WebSocketServer({ port: 0 })
  await new Promise<void>((resolve) => wss.on('listening', resolve))
  const port = (wss.address() as { port: number }).port
  attachMultiplayer(wss, () => `127.0.0.1:${port}`)
  const previousLocation = (globalThis as { location?: unknown }).location
  const previousDelay = roomsForTest.takeoverDelayMs()
  Object.assign(globalThis, { WebSocket, location: { protocol: 'http:', host: `127.0.0.1:${port}` } })
  const sessions: MultiplayerSession[] = []
  const seat = (game: GameState): MultiplayerSession => {
    enableMultiplayerCommands(game)
    const session = new MultiplayerSession(game)
    sessions.push(session)
    return session
  }
  const lobbies = async (): Promise<Array<{ code: string; host: string }>> => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`)
    await new Promise<void>((resolve) => socket.on('open', () => resolve()))
    const answer = new Promise<string>((resolve) => socket.on('message', (raw) => resolve(String(raw))))
    socket.send(JSON.stringify({ t: 'lobbies' }))
    const list = JSON.parse(await answer).lobbies
    socket.close()
    return list
  }
  try {
    assert.equal(roomsForTest.HOST_TAKEOVER_SECONDS, 20, 'guests wait 20 s by default, longer than a reconnect')

    // 1 + 5: the host is gone for good; the longest-seated guest carries on with the server's world.
    roomsForTest.setTakeoverDelay(0)
    const host = fixture(20), anna = new GameState(), ben = new GameState()
    const hs = seat(host), as = seat(anna), bs = seat(ben)
    const annaHost = promotedGame(as)
    hs.host('Alte Chefin', true)
    await until(() => hs.status.connected)
    const code = hs.status.code
    as.join(code, 'Anna')
    await until(() => as.status.connected && anna.snapshot.visitors.length === 20)
    bs.join(code, 'Ben')
    await until(() => bs.status.connected && ben.snapshot.visitors.length === 20)
    hostTicks(host, hs, 8)
    await until(() => anna.snapshot.simTick === host.snapshot.simTick && ben.snapshot.simTick === host.snapshot.simTick)
    const room = roomsForTest.rooms.get(code)!
    assert.deepEqual(wire(roomsForTest.cachedWorld(room)), asWire(host), 'the server keeps the host’s last world')
    const lastTick = host.snapshot.simTick
    const lastRng = host.snapshot.rngState
    const oldStatus = { ...hs.status }
    ;(hs as any).hello = null
    ;(hs as any).socket.close()
    await until(() => annaHost.game !== null && as.status.mode === 'host')
    const heir = annaHost.game!
    assert.equal(room.hostId, as.status.playerId)
    assert.equal(room.hostName, 'Anna')
    assert.equal(room.epoch, 1)
    assert.equal((await lobbies()).find((lobby) => lobby.code === code)?.host, 'Anna', 'the lobby names the new host')
    assert.equal(heir.snapshot.simTick, lastTick, 'the takeover continues from the last tick the guests saw')
    assert.equal(heir.rng.getState(), lastRng, 'with the host’s RNG')
    assert.equal(heir.snapshot.multiplayerCode, code, 'stamped with the room code')
    assert.equal(heir.networkMode, 'host')
    assert.equal(as.inheritedHost, true, 'an inherited park: no progress, its own save slot')
    assert.equal(as.inheritedCode, code)
    await until(() => bs.status.players.some((player) => player.role === 'host' && player.name === 'Anna'))
    assert.equal(bs.status.mode, 'client')
    assert.equal(bs.status.hostAway, false)
    hostTicks(heir, as, 6)
    await until(() => ben.snapshot.simTick === heir.snapshot.simTick)
    ben.updateEntryPrice(40)
    await until(() => heir.snapshot.entryPrice === 40)
    hostTicks(heir, as, 2)
    await until(() => ben.snapshot.simTick === heir.snapshot.simTick && ben.snapshot.entryPrice === 40)
    assert.deepEqual(wire(packWorld(ben.snapshot)), asWire(heir), 'the other guest now mirrors the new host')
    console.log('PASS a host gone for good hands the room to the longest-seated guest with the server’s world')

    // 2: the old host comes back after all — as a guest, with its offline world kept as a backup.
    for (let i = 0; i < 5; i++) host.tick(0.1)
    const offlineTick = host.snapshot.simTick
    assert.ok(offlineTick > lastTick, 'the old host ran on alone while it was gone')
    const demotions: Array<{ backup: GameSnapshot; info: DemotedInfo }> = []
    hs.onDemoted = (backup, info) => demotions.push({ backup, info })
    ;(hs as any).status = { ...oldStatus, connected: false }
    ;(hs as any).hello = { t: 'host', name: 'Alte Chefin', code, public: true }
    hs.retryNow()
    await until(() => hs.status.connected && hs.status.mode === 'client')
    assert.equal(demotions.length, 1)
    assert.equal(demotions[0]!.backup.simTick, offlineTick, 'the backup is what it ran offline')
    assert.deepEqual(demotions[0]!.info, { code, hostName: 'Anna' })
    assert.equal((hs as any).hello.t, 'join', 'from now on it dials back in as a guest')
    assert.equal(host.networkMode, 'client')
    hostTicks(heir, as, 3)
    await until(() => host.snapshot.simTick === heir.snapshot.simTick && ben.snapshot.simTick === heir.snapshot.simTick)
    assert.deepEqual(wire(packWorld(host.snapshot)), asWire(heir), 'and it mirrors the room’s world, not its own')
    console.log('PASS the old host returns as a guest and keeps its offline world as a backup')

    // 3: back within the grace period, nothing is handed over; the return is said explicitly.
    roomsForTest.setTakeoverDelay(60_000)
    const keeper = fixture(4), waiter = new GameState()
    const ks = seat(keeper), ws = seat(waiter)
    ks.host('Kommt wieder')
    await until(() => ks.status.connected)
    const keptCode = ks.status.code
    ws.join(keptCode, 'Wartet')
    await until(() => ws.status.connected && waiter.snapshot.visitors.length === 4)
    const seen: MultiplayerStatus[] = []
    ws.onStatus = (status) => seen.push({ ...status })
    ;(ks as any).socket.close()
    await until(() => ws.status.hostAway)
    const keptRoom = roomsForTest.rooms.get(keptCode)!
    assert.ok(keptRoom.takeoverTimer !== null, 'the countdown runs')
    assert.ok(ws.status.takeoverAt > Date.now() + 50_000, 'and the guest knows how long it has')
    const refused = waiter.place('path', -8, 0)
    assert.deepEqual([refused.ok, refused.message], [false, 'Host ist weg – Bauen pausiert'])
    assert.ok(!hasPathAt(waiter, -8, 0), 'no ghost while nobody can confirm it')
    await until(() => ks.status.connected && !ws.status.hostAway)
    assert.equal(ks.status.mode, 'host')
    assert.equal(keptRoom.hostId, ks.status.playerId)
    assert.equal(keptRoom.epoch, 0, 'no takeover')
    assert.equal(keptRoom.takeoverTimer, null, 'and the countdown is gone')
    assert.equal(seen.at(-1)?.hostAway, false, 'the return is announced as such')
    assert.equal(waiter.networkPause, null)
    assert.ok(waiter.place('path', -8, 0).ok, 'building works again')
    console.log('PASS a host back within the grace period keeps its room; guests may not build meanwhile')

    // 4: without anybody holding the world, nobody is promoted.
    roomsForTest.setTakeoverDelay(0)
    const lonely = fixture(0), stranger = new GameState()
    const ls = seat(lonely), ss = seat(stranger)
    ls.host('Allein')
    await until(() => ls.status.connected)
    const lonelyCode = ls.status.code
    ;(ls as any).hello = null
    ;(ls as any).socket.close()
    await until(() => (roomsForTest.rooms.get(lonelyCode)?.hostAwaySince ?? null) !== null)
    ss.join(lonelyCode, 'Zu spät')
    await until(() => ss.status.connected)
    await sleep(40)
    const lonelyRoom = roomsForTest.rooms.get(lonelyCode)!
    assert.equal(ss.status.mode, 'client')
    assert.equal(lonelyRoom.epoch, 0)
    assert.equal(lonelyRoom.cache, null, 'a host alone sends nothing worth keeping')
    assert.equal(lonelyRoom.takeoverTimer, null)
    assert.equal(ss.status.hostAway, true)
    assert.equal(ss.status.takeoverAt, 0)
    assert.match(ss.status.message, /niemand hat den Spielstand/)
    console.log('PASS nobody without the world is promoted')

    // 6 + 7: a hand-over is immediate; a command the old host never answered is dropped, not replayed.
    roomsForTest.setTakeoverDelay(60_000)
    const giver = fixture(6), taker = new GameState(), builder = new GameState()
    const gs = seat(giver), ts = seat(taker), bus = seat(builder)
    const takerHost = promotedGame(ts)
    gs.host('Übergibt')
    await until(() => gs.status.connected)
    const giveCode = gs.status.code
    ts.join(giveCode, 'Erbin')
    await until(() => ts.status.connected && taker.snapshot.visitors.length === 6)
    bus.join(giveCode, 'Baut')
    await until(() => bus.status.connected && builder.snapshot.visitors.length === 6)
    const swallowed: GameCommand[] = []
    giver.schedulePublicCommand = (command: GameCommand) => { swallowed.push(command) }
    const builderToasts: string[] = []
    bus.onToast = (message) => builderToasts.push(message)
    assert.equal(gs.takeoverCandidate()?.name, 'Erbin', 'the dialog offers the longest-seated guest')
    assert.ok(builder.place('path', -8, 0).ok, 'shown at once, as always')
    await until(() => swallowed.length === 1)
    gs.handOver(ts.status.playerId)
    await until(() => ts.status.mode === 'host' && takerHost.game !== null)
    const giveRoom = roomsForTest.rooms.get(giveCode)!
    assert.equal(giveRoom.epoch, 1, 'handed over at once, not after the grace period')
    assert.equal(giveRoom.hostName, 'Erbin')
    assert.equal(gs.status.mode, 'solo', 'the old host plays on alone')
    await until(() => builderToasts.some((message) => message.includes('1 unbestätigte Aktion verworfen')))
    assert.equal((bus as any).pendingCommands.size, 0)
    hostTicks(takerHost.game!, ts, 3)
    await until(() => builder.snapshot.simTick === takerHost.game!.snapshot.simTick)
    assert.equal(hasPathAt(takerHost.game!, -8, 0), false)
    assert.equal(hasPathAt(builder, -8, 0), false, 'the unconfirmed build is gone, not replayed onto the new world')
    console.log('PASS a hand-over promotes at once and unanswered builds are dropped, not replayed')

    // The existing ghost: a host that dies silently. Guests drop what is in flight
    // and the server answers their resync from its own copy.
    const silent = fixture(4), hopeful = new GameState()
    const sis = seat(silent), hos = seat(hopeful)
    sis.host('Stumm')
    await until(() => sis.status.connected)
    hos.join(sis.status.code, 'Hofft')
    await until(() => hos.status.connected && hopeful.snapshot.visitors.length === 4)
    const lost: GameCommand[] = []
    silent.schedulePublicCommand = (command: GameCommand) => { lost.push(command) }
    const hopefulToasts: string[] = []
    hos.onToast = (message) => hopefulToasts.push(message)
    assert.ok(hopeful.place('path', -8, 0).ok)
    await until(() => lost.length === 1)
    ;(sis as any).hello = null
    ;(sis as any).socket.close()
    await until(() => hos.status.hostAway)
    assert.ok(hopefulToasts.includes('1 unbestätigte Aktion verworfen – bitte prüfen.'))
    await until(() => !hasPathAt(hopeful, -8, 0))
    assert.equal(hopeful.discardOptimisticCommands().length, 0, 'nothing left to replay')
    ;(hos as any).sendCommand({ type: 'updateEntryPrice', price: 12 })
    await until(() => (hos as any).pendingCommands.size === 0)
    assert.ok(hopefulToasts.includes('Host ist weg – Bauen pausiert'), 'a command without host is answered per command')
    console.log('PASS a silently dead host no longer leaves ghost builds behind')

    // 8: the chosen guest drops before its first world, the next cannot build it; the third takes over.
    roomsForTest.setTakeoverDelay(0)
    const origin = fixture(4), first = new GameState(), second = new GameState(), third = new GameState()
    const os = seat(origin), fs = seat(first), sec = seat(second), th = seat(third)
    os.host('Ursprung')
    await until(() => os.status.connected)
    const chainCode = os.status.code
    for (const [session, game, name] of [[fs, first, 'Erste'], [sec, second, 'Zweite'], [th, third, 'Dritte']] as const) {
      session.join(chainCode, name)
      await until(() => session.status.connected && game.snapshot.visitors.length === 4)
    }
    fs.onPromoted = () => {}
    ;(sec as any).buildWorld = () => null
    const thirdHost = promotedGame(th)
    const chainRoom = roomsForTest.rooms.get(chainCode)!
    ;(os as any).hello = null
    ;(os as any).socket.close()
    await until(() => fs.status.mode === 'host' && chainRoom.hostId === fs.status.playerId)
    ;(fs as any).hello = null
    ;(fs as any).socket.close()
    await until(() => th.status.mode === 'host' && thirdHost.game !== null)
    assert.equal(chainRoom.epoch, 3)
    assert.equal(chainRoom.hostId, th.status.playerId)
    assert.equal(sec.status.mode, 'client', 'the one that could not build stays a guest')
    assert.equal(sec.status.connected, true)
    assert.equal(chainRoom.clients.get(sec.status.playerId)?.role, 'client')
    hostTicks(thirdHost.game!, th, 3)
    await until(() => second.snapshot.simTick === thirdHost.game!.snapshot.simTick)
    console.log('PASS a chosen guest that drops or fails before its first world is replaced by the next')

    // A room that ends: the guest carries on alone with the park rebuilt like a save.
    const ender = fixture(4), stays = new GameState()
    const es = seat(ender), st = seat(stays)
    let solo: GameState | null = null
    st.onContinueSolo = (next) => {
      solo = next
      st.attach(next)
    }
    es.host('Macht Schluss')
    await until(() => es.status.connected)
    st.join(es.status.code, 'Bleibt')
    await until(() => st.status.connected && stays.snapshot.visitors.length === 4)
    hostTicks(ender, es, 6)
    await until(() => stays.snapshot.simTick === ender.snapshot.simTick)
    es.disconnect()
    await until(() => solo !== null)
    const alone = solo as unknown as GameState
    assert.notEqual(alone, stays)
    assert.equal(alone.networkMode, 'solo')
    assert.equal(alone.rng.getState(), ender.snapshot.rngState, 'the rebuilt park draws where the host left off')
    const soloTick = alone.snapshot.simTick
    alone.tick(0.1)
    assert.equal(alone.snapshot.simTick, soloTick + 1)
    console.log('PASS a guest whose room ends carries on alone with a rebuilt park')
  } finally {
    sessions.forEach((session) => session.disconnect())
    roomsForTest.setTakeoverDelay(previousDelay)
    wss.clients.forEach((socket) => socket.terminate())
    await new Promise<void>((resolve) => wss.close(() => resolve()))
    Object.assign(globalThis, { location: previousLocation })
  }
}
