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
import { findQuickSlot, type SaveSlotView } from '../src/ui/saveArchive'
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
  testHostileDeltas()
  testCacheGrowth()
}

/** Whatever a host sends is merged without throwing: one bad message must not end every room on the server. */
function testHostileDeltas(): void {
  const hostile = new Map<string, unknown>([['a', { id: 'a', x: 0 }]])
  const junk = [null, 5, 'x', { id: 7, changes: {} }, { id: 'a', changes: 'boom' }, { id: 'b', changes: 'boom' }, { id: 'c' }]
  assert.doesNotThrow(() => mergeVisitorPatches(hostile as any, junk as any, []))
  assert.deepEqual([...hostile.entries()], [['a', { id: 'a', x: 0 }]], 'patches that are no patches are skipped')
  hostile.set('s', 'text')
  mergeVisitorPatches(hostile as any, [{ id: 's', changes: { id: 's', x: 2 } }], [])
  assert.deepEqual(hostile.get('s'), { id: 's', x: 2 }, 'an entry that is no object is replaced, not merged into')
  const cache = cacheFromSync({ simTick: 1, visitors: [{ id: 'a', x: 0 }] }, 60, 0)!
  const delta = { world: [1, 2], visitors: [null, { id: 'a', changes: 'boom' }, { id: 'a', changes: { x: 3 } }], removed: [7] }
  assert.equal(applyDeltaToCache(cache, delta as any, 80, 1), cache, 'a hostile delta does not cost the copy')
  assert.deepEqual(wire(cachedWorld(cache)), { simTick: 1, visitors: [{ id: 'a', x: 3 }] }, 'and only its valid parts land')
  assert.equal(applyDeltaToCache(cache, null as any, 10, 2), null, 'something that is no delta drops it')
}

/** The size limit holds for the copy as a whole, not just for each message. */
function testCacheGrowth(): void {
  const limit = 20_000
  let grown = cacheFromSync({ simTick: 1, visitors: [] }, 40, 0, limit)
  let deltas = 0
  while (grown && deltas < 100) {
    const visitors = Array.from({ length: 50 }, (_, i) => ({ id: `v${deltas}-${i}`, changes: { id: `v${deltas}-${i}`, pad: 'x'.repeat(40) } }))
    const text = JSON.stringify({ t: 'state', world: {}, visitors, removed: [] })
    assert.ok(text.length < limit, 'every single delta fits')
    grown = applyDeltaToCache(grown, JSON.parse(text), text.length, deltas, limit)
    deltas += 1
  }
  assert.equal(grown, null, 'deltas that keep adding visitors cannot grow the copy past the limit')
  assert.ok(deltas > 3 && deltas < 12, `dropped once it really is too big (${deltas} deltas)`)

  let steady = cacheFromSync({ simTick: 0, big: 'y'.repeat(5000), visitors: [] }, 5040, 0, limit)
  for (let i = 1; i <= 50 && steady; i++) {
    const text = JSON.stringify({ t: 'state', world: { simTick: i, big: 'z'.repeat(5000) }, visitors: [], removed: [] })
    steady = applyDeltaToCache(steady, JSON.parse(text), text.length, i, limit)
  }
  assert.ok(steady, 'deltas that replace what was there never drop it')
  assert.ok(steady.bytes < 6000, 'the re-measured size is the real one')
  assert.equal(cachedSimTick(steady), 50)
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

  // An outdated tab may not even understand `promoted`: the host's build goes first.
  const onBuild = (id: string, joinOrder: number, hasWorld: boolean, version: string) =>
    [id, { ...guest(id, joinOrder, hasWorld)[1], version }] as const
  room.hostVersion = '0.2.12'
  room.clients = new Map([onBuild('outdated', 1, true, '0.2.11'), onBuild('current', 5, false, '0.2.12')])
  assert.equal(pick(), 'current', 'same build first, even without the world and seated later')
  room.clients.delete('current')
  assert.equal(pick(), 'outdated', 'another build only when nobody else can')
  room.hostVersion = ''
  room.clients = new Map([onBuild('outdated', 1, true, '0.2.11'), onBuild('current', 5, false, '0.2.12')])
  assert.equal(pick(), 'outdated', 'a host that named no build prefers nobody')
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

  // Quick-save, autosave and quick-load share one slot; an inherited park never touches the player's own.
  const slot = (name: string, id: string): SaveSlotView =>
    ({ id, name, savedAt: 0, public: false, owner: '', source: 'browser' })
  const own = [slot('Schnellspeichern', 'quick'), slot(takeoverSaveName('AB12'), 'taken'), slot('Autospeichern', 'legacy')]
  const ownNames = ['Schnellspeichern', 'Autospeichern']
  assert.equal(findQuickSlot(own, null, ownNames)?.id, 'quick')
  assert.equal(findQuickSlot(own, takeoverSaveName('AB12'), ownNames)?.id, 'taken', 'the inherited park saves and loads its own slot')
  assert.equal(findQuickSlot(own, takeoverSaveName('ZZ99'), ownNames), undefined, 'and never falls back to the player’s quicksave')
  assert.equal(findQuickSlot([slot('Autospeichern', 'legacy')], null, ownNames)?.id, 'legacy', 'an older game’s autosave becomes the quicksave')

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

/** A session for `game`, bound the way main.ts binds one, and kept for the cleanup. */
function seatSession(sessions: MultiplayerSession[], game: GameState): MultiplayerSession {
  enableMultiplayerCommands(game)
  const session = new MultiplayerSession(game)
  sessions.push(session)
  return session
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
  const seat = (game: GameState): MultiplayerSession => seatSession(sessions, game)
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
    assert.equal(bs.status.hostName, 'Anna', 'the status names the new host')
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
    assert.equal(ws.status.hostName, 'Kommt wieder', 'the host is named while its seat is empty')
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

type RawClient = { socket: WebSocket; inbox: any[]; send(message: unknown): void }

/** A bare socket, for what the game client would never send by itself. */
async function rawClient(port: number): Promise<RawClient> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`)
  const inbox: any[] = []
  socket.on('message', (raw) => inbox.push(JSON.parse(String(raw))))
  await new Promise<void>((resolve) => socket.on('open', () => resolve()))
  return { socket, inbox, send: (message) => socket.send(JSON.stringify(message)) }
}

const received = (client: RawClient, type: string): any => client.inbox.find((message) => message.t === type)

/**
 * Review fixes, on real sockets: a hostile host delta neither crashes the server
 * nor spoils its copy, a host back alone drops the stale copy, a promoted guest
 * that never sends its world is given up on (and the old host can still resume),
 * a command sent before its guest heard of a takeover is refused instead of run
 * by the new host, and an inherited park stays inherited when it is hosted again
 * or loaded back from its takeover slot.
 */
export async function testTakeoverHardening(fixture: Fixture, asWire: AsWire): Promise<void> {
  const wss = new WebSocketServer({ port: 0 })
  await new Promise<void>((resolve) => wss.on('listening', resolve))
  const port = (wss.address() as { port: number }).port
  attachMultiplayer(wss, () => `127.0.0.1:${port}`)
  const previousLocation = (globalThis as { location?: unknown }).location
  const previousDelay = roomsForTest.takeoverDelayMs()
  const previousTimeout = roomsForTest.promotionTimeoutMs()
  Object.assign(globalThis, { WebSocket, location: { protocol: 'http:', host: `127.0.0.1:${port}` } })
  const sessions: MultiplayerSession[] = []
  const raws: RawClient[] = []
  const seat = (game: GameState): MultiplayerSession => seatSession(sessions, game)
  const raw = async (): Promise<RawClient> => {
    const client = await rawClient(port)
    raws.push(client)
    return client
  }
  try {
    assert.equal(roomsForTest.promotionTimeoutMs(), 30_000, 'a promoted guest has 30 s for its first world by default')

    // A hostile host: junk in its deltas costs nothing but the junk.
    roomsForTest.setTakeoverDelay(60_000)
    const evil = await raw()
    evil.send({ t: 'host', name: 'Böse' })
    await until(() => received(evil, 'hosted'))
    const evilCode = received(evil, 'hosted').code
    const victim = await raw()
    victim.send({ t: 'join', code: evilCode, name: 'Opfer' })
    await until(() => received(victim, 'joined'))
    evil.send({ t: 'sync', world: { simTick: 1, visitors: [{ id: 'a', x: 0 }] } })
    evil.send({ t: 'state', world: {}, visitors: [null], removed: [] })
    evil.send({ t: 'state', world: 'x', visitors: [{ id: 'a', changes: 'boom' }, { id: 'a', changes: { x: 2 } }], removed: null })
    evil.send({ t: 'state', world: { simTick: 2 }, visitors: [], removed: [] })
    await until(() => victim.inbox.filter((message) => message.t === 'state').length === 3)
    const evilRoom = roomsForTest.rooms.get(evilCode)!
    assert.deepEqual(wire(roomsForTest.cachedWorld(evilRoom)), { simTick: 2, visitors: [{ id: 'a', x: 2 }] })
    console.log('PASS a hostile host delta neither crashes the server nor spoils its copy')

    // A host back alone drops the copy it would otherwise let grow stale.
    const back = await raw()
    back.send({ t: 'host', name: 'Allein zurück' })
    await until(() => received(back, 'hosted'))
    const { code: backCode, playerId: backId } = received(back, 'hosted')
    const passer = await raw()
    passer.send({ t: 'join', code: backCode, name: 'Geht wieder' })
    await until(() => received(passer, 'joined'))
    back.send({ t: 'sync', world: { simTick: 1, visitors: [] } })
    await until(() => received(passer, 'sync'))
    const backRoom = roomsForTest.rooms.get(backCode)!
    assert.ok(backRoom.cache, 'with a guest the server keeps a copy')
    back.socket.close()
    await until(() => backRoom.hostAwaySince !== null)
    passer.socket.close()
    await until(() => backRoom.clients.size === 0)
    assert.ok(backRoom.cache, 'kept while the host is away: a late guest may still carry the room on')
    const returned = await raw()
    returned.send({ t: 'resume', code: backCode, playerId: backId, name: 'Allein zurück' })
    await until(() => received(returned, 'hosted'))
    assert.equal(backRoom.cache, null, 'back alone, the host sends nothing, so the old copy goes')
    roomsForTest.setTakeoverDelay(0)
    returned.socket.close()
    await until(() => backRoom.hostAwaySince !== null)
    const stranger = new GameState()
    const st = seat(stranger)
    st.join(backCode, 'Fremd')
    await until(() => st.status.connected)
    await sleep(40)
    assert.equal(st.status.mode, 'client', 'a stranger is not handed the stale park')
    assert.equal(backRoom.epoch, 0)
    assert.match(st.status.message, /niemand hat den Spielstand/)
    console.log('PASS a host back alone drops its stale copy, so a later stranger is not promoted with it')

    // A promoted guest that never sends its world is given up on; the old host keeps its claim.
    roomsForTest.setPromotionTimeout(150)
    const owner = fixture(4), stalled = new GameState()
    const os = seat(owner), zs = seat(stalled)
    os.host('Kommt zurück')
    await until(() => os.status.connected)
    const stallCode = os.status.code
    zs.join(stallCode, 'Hängt')
    await until(() => zs.status.connected && stalled.snapshot.visitors.length === 4)
    // Builds the world but never binds it, like an outdated tab: no first world ever comes.
    zs.onPromoted = () => {}
    const stallToasts: string[] = []
    zs.onToast = (message) => stallToasts.push(message)
    const demotions: DemotedInfo[] = []
    os.onDemoted = (_backup, info) => demotions.push(info)
    const stallRoom = roomsForTest.rooms.get(stallCode)!
    const ownerStatus = { ...os.status }
    ;(os as any).hello = null
    ;(os as any).socket.close()
    await until(() => zs.status.mode === 'host')
    assert.equal(stallRoom.epoch, 1)
    await until(() => zs.status.mode === 'client' && zs.status.hostAway)
    assert.ok(stallToasts.includes('Übernahme abgebrochen – du spielst als Gast weiter.'))
    assert.equal(stallRoom.hostId, ownerStatus.playerId, 'the room is put back to its old host')
    assert.equal(stallRoom.clients.get(zs.status.playerId)?.failedTakeover, true, 'and the silent seat is not asked again')
    assert.equal(stallRoom.promotionTimer, null)
    assert.equal(zs.inheritedHost, false)
    ;(os as any).status = { ...ownerStatus, connected: false }
    ;(os as any).hello = { t: 'host', name: 'Kommt zurück', code: stallCode }
    os.retryNow()
    await until(() => os.status.connected && os.status.mode === 'host' && !zs.status.hostAway)
    assert.equal(demotions.length, 0, 'the old host takes its own seat back, not a guest seat')
    hostTicks(owner, os, 4)
    await until(() => stalled.snapshot.simTick === owner.snapshot.simTick)
    assert.deepEqual(wire(packWorld(stalled.snapshot)), asWire(owner), 'the silent seat mirrors the old host again')
    roomsForTest.setPromotionTimeout(previousTimeout)
    console.log('PASS a promoted guest that never sends its world is given up on; the old host can still resume')

    // A command sent before its guest heard of the takeover is refused, not run by the new host.
    roomsForTest.setTakeoverDelay(60_000)
    const giver = fixture(4), heirWorld = new GameState()
    const gv = seat(giver), hr = seat(heirWorld)
    const heir = promotedGame(hr)
    gv.host('Gibt ab')
    await until(() => gv.status.connected)
    const epochCode = gv.status.code
    hr.join(epochCode, 'Erbt')
    await until(() => hr.status.connected && heirWorld.snapshot.visitors.length === 4)
    const late = await raw()
    late.send({ t: 'join', code: epochCode, name: 'Spät' })
    await until(() => received(late, 'joined'))
    assert.equal(received(late, 'joined').epoch, 0, 'a guest learns the count of takeovers on joining')
    gv.handOver(hr.status.playerId)
    await until(() => heir.game !== null && received(late, 'hostChanged'))
    assert.equal(received(late, 'hostChanged').epoch, 1)
    const heard: GameCommand[] = []
    const run = heir.game!.schedulePublicCommand.bind(heir.game!)
    heir.game!.schedulePublicCommand = (command: GameCommand) => { heard.push(command); run(command) }
    const result = (id: string): any => late.inbox.find((message) => message.t === 'commandResult' && message.commandId === id)
    late.send({ t: 'command', cmd: { type: 'updateEntryPrice', price: 33, clientCommandId: 'late-1' }, epoch: 0 })
    await until(() => result('late-1'))
    assert.deepEqual(result('late-1').result, { ok: false, message: 'Host hat gewechselt – Aktion verworfen' })
    late.send({ t: 'command', cmd: { type: 'updateEntryPrice', price: 34, clientCommandId: 'late-2' }, epoch: 1 })
    await until(() => result('late-2'))
    assert.equal(result('late-2').result.ok, true, 'a command that knows the new host goes through')
    assert.deepEqual(heard.map((command) => command.clientCommandId), ['late-2'], 'the stale one never reached it')
    assert.equal(heir.game!.snapshot.entryPrice, 34)
    console.log('PASS a command sent before its guest heard of the takeover is refused instead of run twice')

    // An inherited park stays somebody else's: loaded back from its slot, left, and hosted again.
    assert.equal(hr.inheritedHost, true)
    const reloaded = new GameState(structuredClone(heir.game!.snapshot) as GameSnapshot)
    hr.markInherited(reloaded)
    hr.attach(reloaded)
    assert.equal(hr.inheritedHost, true, 'a save of it loaded back is still inherited')
    assert.equal(hr.inheritedCode, epochCode)
    hr.disconnect()
    assert.equal(hr.inheritedHost, true, 'and so it is after leaving the room')
    hr.host('Erbt weiter')
    await until(() => hr.status.connected && hr.status.mode === 'host')
    assert.equal(hr.inheritedHost, true, 'and after hosting it again: no progress, its own save slot')
    hr.attach(new GameState())
    assert.equal(hr.inheritedHost, false, 'a different world is the player’s own')
    console.log('PASS an inherited park stays inherited when it is loaded back or hosted again')
  } finally {
    sessions.forEach((session) => session.disconnect())
    raws.forEach((client) => client.socket.close())
    roomsForTest.setTakeoverDelay(previousDelay)
    roomsForTest.setPromotionTimeout(previousTimeout)
    wss.clients.forEach((socket) => socket.terminate())
    await new Promise<void>((resolve) => wss.close(() => resolve()))
    Object.assign(globalThis, { location: previousLocation })
  }
}
