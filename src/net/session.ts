import type { GameState } from '../game/GameState'
import type { GameSnapshot } from '../game/types/snapshot'
import { WorldUpdates } from './worldUpdates'
import { packWorld } from './codec'
import { multiplayerSocketUrl } from './lobbies'
import type {
  ChatPing,
  ClientMessage,
  GameCommand,
  NetPlayer,
  ServerMessage,
} from './protocol'
import type { ChatMessage } from './chatProtocol'
import { cleanChatPing, cleanChatText, isSendableChat } from './chatProtocol'
import {
  droppedActionsNotice,
  gameFromNetworkWorld,
  HOST_AWAY_BUILD_MESSAGE,
  hostAwayNotice,
  promotedNotice,
} from './takeover'

export type MultiplayerStatus = {
  mode: 'solo' | 'host' | 'client'
  code: string
  joinUrl: string
  playerId: string
  players: NetPlayer[]
  connected: boolean
  message: string
  /** Seen from a guest: the host's seat is empty right now. */
  hostAway: boolean
  /** Local clock time the server plans to hand the room to a guest; 0 when none is planned. */
  takeoverAt: number
}

/** Who holds a room that was taken over while this player was away. */
export type DemotedInfo = { code: string; hostName: string }

type ServerOf<T extends ServerMessage['t']> = Extract<ServerMessage, { t: T }>

const EMPTY_STATUS: MultiplayerStatus = {
  mode: 'solo',
  code: '',
  joinUrl: '',
  playerId: '',
  players: [],
  connected: false,
  message: '',
  hostAway: false,
  takeoverAt: 0,
}

function takeoverDeadline(inMs: number | undefined, away: boolean): number {
  return away && typeof inMs === 'number' ? Date.now() + inMs : 0
}

export class MultiplayerSession {
  status: MultiplayerStatus = { ...EMPTY_STATUS }
  onStatus: (status: MultiplayerStatus) => void = () => {}
  onToast: (message: string, isError?: boolean) => void = () => {}
  onChat: (message: ChatMessage) => void = () => {}
  /**
   * The server handed this guest the room. `next` is the world rebuilt like a
   * loaded save; binding it (which ends in `attach`) makes it the running host.
   */
  onPromoted: (next: GameState) => void = (next) => this.attach(next)
  /** The room ended; a guest carries its park on alone, rebuilt like a loaded save. */
  onContinueSolo: (next: GameState) => void = (next) => this.attach(next)
  /**
   * This player came back as host to a room a guest had taken over meanwhile.
   * `backup` is the world it ran while it was gone, before the room's replaces it.
   */
  onDemoted: (backup: GameSnapshot, info: DemotedInfo) => void = () => {}
  private socket: WebSocket | null = null
  private game: GameState
  private updates = new WorldUpdates()
  private updateSeconds = 0
  private hasWorld = false
  private pendingCommands = new Set<string>()
  private commandSequence = 0
  private lastWorldAt = Date.now()
  private lastResyncAt = 0
  private syncRequested = false
  private needsResync = false
  /** The hello of the session we are in, so a dropped socket can dial back. */
  private hello: ClientMessage | null = null
  private playerName = ''
  /** Whether this room puts itself on the public list; kept for reconnects. */
  private listed = false
  private reconnectTimer = 0
  private reconnectAttempt = 0
  /** True only while the player themselves is ending the session. */
  private leaving = false
  /** How a handed-over world becomes a game; a seam for the tests. */
  private buildWorld = gameFromNetworkWorld
  /** Set while a promoted guest builds its world: commands wait here, nothing is sent. */
  private promotionQueue: GameCommand[] | null = null
  /** The world this player inherited by takeover, and the room it came from. */
  private inherited: { game: GameState; code: string } | null = null

  constructor(game: GameState) {
    this.game = game
    // Coming back to the tab is the moment to find out whether the connection
    // survived being away. Waiting out the backoff first would leave the player
    // looking at a dead world for up to fifteen seconds.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) return
        this.retryNow()
      })
    }
  }

  /**
   * True while the running world is one this player inherited by takeover. It
   * is somebody else's park: no scenario progress or achievements, and saves go
   * to a slot of their own instead of over the player's quicksave.
   */
  get inheritedHost(): boolean {
    return this.inherited !== null && this.inherited.game === this.game
  }

  /** The room code the inherited world came from; empty when there is none. */
  get inheritedCode(): string {
    return this.inheritedHost ? this.inherited!.code : ''
  }

  /**
   * The guest a host handing over would most likely pass the room to: the
   * longest-seated one. The server has the last word and prefers this one.
   */
  takeoverCandidate(): NetPlayer | undefined {
    if (this.status.mode !== 'host') return undefined
    return this.status.players.find((player) => player.role === 'client' && player.id !== this.status.playerId)
  }

  /**
   * Dials back at once instead of on the next scheduled attempt. Does nothing
   * when there is no session, or when one is already up.
   */
  retryNow(): void {
    if (!this.hello || this.leaving || this.canSend()) return
    this.cancelReconnect()
    this.reconnectAttempt = 0
    this.scheduleReconnect(0)
  }

  attach(game: GameState): void {
    this.unbindGame()
    this.game = game
    const queued = this.promotionQueue ?? []
    this.promotionQueue = null
    this.bindGame()
    if (this.status.mode !== 'host') return
    // A save loaded into a running room takes the room's code, not the other
    // way round: the code cannot change mid-session, and saving again should
    // keep the one the other players already have. A promoted guest's world is
    // stamped the same way.
    this.stampCode()
    this.pushSync()
    // Commands that reached a promoted guest while it was still building.
    for (const command of queued) this.game.schedulePublicCommand(command)
  }

  private stampCode(): void {
    if (this.status.mode === 'host' && this.status.code) this.game.rememberMultiplayerCode(this.status.code)
  }

  get socketUrl(): string {
    return multiplayerSocketUrl()
  }

  /**
   * Opens the room. The code the world last hosted under comes along, so the
   * same save keeps the same code and an invite handed out earlier still works.
   * The server has the last word: if that code is taken right now it answers
   * with another one, and the world is stamped with whatever came back.
   */
  host(name: string, listed = false): void {
    this.playerName = name.trim() || 'Host'
    this.listed = listed
    this.inherited = null
    this.connect({
      t: 'host',
      name: this.playerName,
      code: this.game.snapshot.multiplayerCode || undefined,
      public: listed,
    })
  }

  join(code: string, name: string): void {
    this.playerName = name.trim() || 'Gast'
    this.inherited = null
    this.connect({
      t: 'join',
      code: code.trim().toUpperCase(),
      name: this.playerName,
    })
  }

  disconnect(): void {
    // Saying so is what ends a room. A socket that merely dropped is a hiccup,
    // and the session dials back instead of giving the game up.
    this.leave({ t: 'leave' })
  }

  /**
   * Leaves as host but lets the room live on: the newest world goes out first,
   * so the server's copy is exact, then the server promotes a guest (preferably
   * `to`) at once. This player keeps playing the world alone, as after leaving.
   */
  handOver(to?: string): void {
    if (this.status.mode !== 'host' || this.promotionQueue || !this.canSend()) {
      this.disconnect()
      return
    }
    this.socket!.send(this.updates.encode(packWorld(this.game.snapshot), true))
    this.leave({ t: 'leave', handOver: true, ...(to ? { to } : {}) })
  }

  private leave(message: ClientMessage): void {
    this.leaving = true
    this.send(message)
    this.cancelReconnect()
    this.hello = null
    this.promotionQueue = null
    this.unbindGame()
    this.socket?.close()
    this.socket = null
    this.game.networkMode = 'solo'
    this.status = { ...EMPTY_STATUS, message: 'Getrennt' }
    this.onStatus(this.status)
    this.leaving = false
  }

  /**
   * Sends an ephemeral chat line and optional map ping. Empty text is allowed
   * when a ping is attached. No-ops when offline or when neither text nor ping
   * is present.
   */
  sendChat(text: string, ping?: ChatPing): boolean {
    if (this.status.mode === 'solo' || !this.canSend()) return false
    const cleaned = cleanChatText(text)
    const cleanedPing = cleanChatPing(ping)
    if (!isSendableChat(cleaned, cleanedPing)) return false
    this.send({
      t: 'chat',
      text: cleaned,
      ...(cleanedPing ? { ping: cleanedPing } : {}),
    })
    return true
  }

  tick(deltaSeconds: number): void {
    if (this.status.mode === 'client') {
      // A host that is away sends nothing; that silence is expected, not a stall.
      const stale = !this.status.hostAway && Date.now() - this.lastWorldAt > 5000
      if (this.needsResync || stale) this.requestResync()
      return
    }
    if (this.status.mode !== 'host' || this.promotionQueue || this.status.players.length < 2) return
    this.updateSeconds += deltaSeconds
    if (this.updateSeconds < 0.2 || !this.canSend()) return
    // Do not queue stale snapshots on a slow uplink. Keep the delta baseline intact.
    if (this.socket!.bufferedAmount > 512 * 1024) return
    if (this.syncRequested) { this.pushSync(); return }
    this.updateSeconds = 0
    this.socket!.send(this.updates.encode(packWorld(this.game.snapshot)))
  }

  private bindGame(): void {
    this.game.networkMode = this.status.mode
    this.game.networkPause = this.pauseReason()
    this.game.commandOutbox =
      this.status.mode === 'client' ? (command) => this.sendCommand(command) : null
    if (this.status.mode === 'client') this.game.prepareClientLockstep()
    this.game.onTurnCommit = null
    this.game.onFestivalResult = this.status.mode === 'host' ? result => {
      this.onToast(result.message, !result.ok)
      this.send({ t: 'result', ...result })
    } : null
    this.game.onCommandResult = this.status.mode === 'host' ? (command, result) => {
      const commandId = command.clientCommandId
      const to = command.originPlayerId
      if (commandId && to) this.send({ t: 'commandResult', to, commandId, result })
    } : null
    this.game.onDesync =
      this.status.mode === 'client'
        ? (expected, actual) => {
            this.onToast(`Desync ${expected}≠${actual} – gleiche Welt neu`, true)
            this.requestResync()
          }
        : null
  }

  private unbindGame(): void {
    this.game.onFestivalResult = null
    this.game.onCommandResult = null
    this.game.commandOutbox = null
    this.game.onTurnCommit = null
    this.game.onDesync = null
    this.game.networkMode = 'solo'
    this.game.networkPause = null
  }

  /** A guest cannot build while nobody is there to confirm it. */
  private pauseReason(): string | null {
    return this.status.mode === 'client' && this.status.hostAway ? HOST_AWAY_BUILD_MESSAGE : null
  }

  private connect(hello: ClientMessage): void {
    this.cancelReconnect()
    this.hello = hello
    this.open(hello)
  }

  private open(hello: ClientMessage): void {
    this.disconnectQuiet()
    const socket = new WebSocket(this.socketUrl)
    this.socket = socket
    socket.addEventListener('open', () => {
      socket.send(JSON.stringify(hello))
    })
    socket.addEventListener('message', (event) => {
      if (this.socket !== socket) return
      try {
        this.handleMessage(JSON.parse(String(event.data)) as ServerMessage)
      } catch {
        this.onToast('Ungültiger Weltabgleich – fordere neuen Zustand an', true)
        this.requestResync()
      }
    })
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return
      this.unbindGame()
      if (this.leaving || !this.hello) {
        this.status = { ...EMPTY_STATUS, message: 'Verbindung beendet' }
        this.onStatus(this.status)
        return
      }
      // The game keeps its world and its mode in the status line; only the
      // connection flag drops, so the UI can say what is going on.
      this.status = { ...this.status, connected: false, message: 'Verbindung unterbrochen – neu verbinden …' }
      this.onStatus(this.status)
      this.scheduleReconnect()
    })
    socket.addEventListener('error', () => {
      if (this.reconnectAttempt === 0) this.onToast('Mehrspieler-Server nicht erreichbar', true)
    })
  }

  /**
   * Dials back for as long as it takes, slowing down to every fifteen seconds so
   * a server that is down is not hammered. Hosting has no attempt limit: the
   * room is still on the server waiting for its host.
   */
  private scheduleReconnect(immediate = -1): void {
    if (this.reconnectTimer || !this.hello) return
    const delay = immediate >= 0 ? immediate : Math.min(15000, 1000 * 2 ** Math.min(4, this.reconnectAttempt))
    this.reconnectAttempt += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = 0
      if (!this.hello) return
      // Back into the room that is still standing, by code and seat. The
      // original hello stays put, so a room that really is gone can be opened
      // from scratch on the next try.
      this.open(this.status.code && this.status.playerId
        ? { t: 'resume', code: this.status.code, playerId: this.status.playerId, name: this.playerName }
        : this.hello.t === 'host'
          ? { ...this.hello, public: this.listed }
          : this.hello)
    }, delay) as unknown as number
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = 0
    this.reconnectAttempt = 0
  }

  private disconnectQuiet(): void {
    this.unbindGame()
    const socket = this.socket
    this.socket = null
    socket?.close()
    this.hasWorld = false
    this.updateSeconds = 0
    this.updates.reset()
    this.pendingCommands.clear()
    this.needsResync = false
    this.syncRequested = false
    this.lastWorldAt = Date.now()
    this.lastResyncAt = 0
  }

  private sendCommand(command: GameCommand): void {
    command.clientCommandId ??= `${this.status.playerId}-${++this.commandSequence}`
    this.pendingCommands.add(command.clientCommandId)
    this.send({ t: 'command', cmd: command })
  }

  /**
   * Forgets every command still waiting for an answer from a host that is gone.
   * They are not sent again — a loan would be booked twice — and no longer
   * replayed onto later worlds; the next full world shows what really happened.
   */
  private dropUnconfirmedCommands(): number {
    const ids = new Set(this.pendingCommands)
    for (const id of this.game.discardOptimisticCommands()) ids.add(id)
    this.pendingCommands.clear()
    return ids.size
  }

  private requestResync(): void {
    if (this.status.mode !== 'client' || !this.canSend()) return
    this.needsResync = true
    const now = Date.now()
    if (now - this.lastResyncAt < 5000) return
    this.lastResyncAt = now
    this.send({ t: 'resync' })
  }

  private pushSync(): void {
    if (this.status.mode !== 'host' || !this.canSend()) return
    if (this.promotionQueue || this.socket!.bufferedAmount > 512 * 1024) {
      this.syncRequested = true
      return
    }
    this.syncRequested = false
    this.socket!.send(this.updates.encode(packWorld(this.game.snapshot), true))
    this.updateSeconds = 0
  }

  private canSend(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }

  private send(message: ClientMessage | ServerMessage): void {
    if (this.canSend()) this.socket?.send(JSON.stringify(message))
  }

  private becomeHost(status: MultiplayerStatus): void {
    this.cancelReconnect()
    this.status = status
    // Still building a promoted world: attach binds and syncs it once it stands.
    if (!this.promotionQueue) {
      this.bindGame()
      this.stampCode()
      this.pushSync()
    }
    this.onStatus(this.status)
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.t) {
      case 'hosted':
        this.becomeHost({
          mode: 'host',
          code: message.code,
          joinUrl: message.joinUrl,
          playerId: message.playerId,
          players: message.players,
          connected: true,
          message: `Raum ${message.code} läuft`,
          hostAway: false,
          takeoverAt: 0,
        })
        return
      case 'joined':
        this.handleJoined(message)
        return
      case 'players':
        this.handlePlayers(message)
        return
      case 'promoted':
        this.handlePromoted(message)
        return
      case 'hostChanged':
        this.handleHostChanged(message)
        return
      case 'commandResult':
        this.handleCommandResult(message)
        return
      case 'result':
        this.onToast(message.message, !message.ok)
        return
      case 'chat':
        this.onChat({ id: message.id, from: message.from, name: message.name, text: message.text, ping: message.ping })
        return
      case 'error':
        this.handleError(message)
        return
      case 'closed':
        this.handleClosed(message)
        return
      default:
        this.handleWorldMessage(message)
    }
  }

  private handleWorldMessage(message: ServerMessage): void {
    if (this.status.mode === 'host') {
      if (message.t === 'command') this.receiveCommand({ ...message.cmd, originPlayerId: message.from })
      else if (message.t === 'resync') this.pushSync()
      return
    }
    if (this.status.mode !== 'client') return
    if (message.t === 'turn') {
      this.game.receiveTurn(message)
    } else if (message.t === 'sync') {
      this.game.applyNetworkWorld(message.world)
      this.hasWorld = true
      this.needsResync = false
      this.lastWorldAt = Date.now()
    } else if (message.t === 'state' && this.hasWorld) {
      this.game.applyNetworkUpdate(message.world, message.visitors, message.removed)
      this.lastWorldAt = Date.now()
    }
  }

  private receiveCommand(command: GameCommand): void {
    if (this.promotionQueue) this.promotionQueue.push(command)
    else this.game.schedulePublicCommand(command)
  }

  private handleJoined(message: ServerOf<'joined'>): void {
    this.cancelReconnect()
    if (message.demoted) {
      // Our room went to a guest while we were gone. What we ran offline is
      // handed out as a backup before the room's world replaces it, and from
      // now on this session is a guest of that room.
      this.inherited = null
      this.hello = { t: 'join', code: message.code, name: this.playerName }
      this.onDemoted(structuredClone(this.game.snapshot) as GameSnapshot, {
        code: message.code,
        hostName: message.hostName ?? '',
      })
    }
    const hostAway = message.role === 'client' && message.hostAway === true
    const takeoverAt = takeoverDeadline(message.takeoverInMs, hostAway)
    this.status = {
      mode: message.role,
      code: message.code,
      joinUrl: '',
      playerId: message.playerId,
      players: message.players,
      connected: true,
      message:
        message.role === 'host'
          ? `Raum ${message.code} läuft`
          : hostAway ? hostAwayNotice(takeoverAt, Date.now()) : `Verbunden mit ${message.code}`,
      hostAway,
      takeoverAt,
    }
    this.bindGame()
    if (message.role === 'host') this.pushSync()
    this.onStatus(this.status)
  }

  private handlePlayers(message: ServerOf<'players'>): void {
    const previousCount = this.status.players.length
    const wasAway = this.status.hostAway
    const hostAway = this.status.mode === 'client' && message.hostAway === true
    this.status = {
      ...this.status,
      players: message.players,
      hostAway,
      takeoverAt: takeoverDeadline(message.takeoverInMs, hostAway),
    }
    if (this.status.mode === 'host' && message.players.length > previousCount) this.pushSync()
    if (this.status.mode === 'client') this.onHostPresence(wasAway, hostAway)
    this.onStatus(this.status)
  }

  /** A guest learns that the host's seat emptied, or was taken again. */
  private onHostPresence(wasAway: boolean, away: boolean): void {
    this.game.networkPause = this.pauseReason()
    if (away) {
      // A guest whose host dropped out keeps its world and waits; saying so
      // beats a silent room where nothing can be built any more.
      this.status.message = hostAwayNotice(this.status.takeoverAt, Date.now())
      if (wasAway) return
      // Whatever was still on its way to that host will never be answered.
      const dropped = this.dropUnconfirmedCommands()
      if (dropped === 0) return
      this.onToast(droppedActionsNotice(dropped), true)
      // The server answers from its own copy, which takes the ghosts away now.
      this.requestResync()
      return
    }
    if (!wasAway) return
    this.status.message = `Verbunden mit ${this.status.code}`
    // Its full world is on the way; the long quiet before it is no stall to report.
    this.lastWorldAt = Date.now()
    this.onToast('Der Host ist zurück – das Spiel läuft weiter.')
  }

  /**
   * The server chose this guest to carry the room on. The world is rebuilt the
   * way a save is loaded, commands from the others wait until it stands, and
   * `onPromoted` binds it — which ends in `attach`, the stamp and a full sync.
   */
  private handlePromoted(message: ServerOf<'promoted'>): void {
    this.cancelReconnect()
    const dropped = this.dropUnconfirmedCommands()
    const next = this.buildWorld(message.world, this.game, message.code)
    if (!next) {
      // Nothing to carry on with. The server puts the room back and asks the next guest.
      this.send({ t: 'takeoverFailed' })
      this.onToast('Übernahme fehlgeschlagen – der Spielstand ließ sich nicht aufbauen', true)
      return
    }
    this.updates.reset()
    this.updateSeconds = 0
    this.syncRequested = false
    // Should the room vanish (a restarted server), this world opens it again.
    this.hello = { t: 'host', name: this.playerName, code: message.code, public: message.public }
    this.listed = message.public
    this.inherited = { game: next, code: message.code }
    this.promotionQueue = []
    this.status = {
      mode: 'host',
      code: message.code,
      joinUrl: message.joinUrl,
      playerId: message.playerId,
      players: message.players,
      connected: true,
      message: `Raum ${message.code} läuft`,
      hostAway: false,
      takeoverAt: 0,
    }
    this.onToast(promotedNotice(message.code, message.worldAgeMs, dropped))
    this.onStatus(this.status)
    this.onPromoted(next)
  }

  private handleHostChanged(message: ServerOf<'hostChanged'>): void {
    if (this.status.mode !== 'client') return
    const dropped = this.dropUnconfirmedCommands()
    const notice = `${message.hostName} ist jetzt Host. Das Spiel läuft weiter.`
    this.status = { ...this.status, players: message.players, hostAway: false, takeoverAt: 0, message: notice }
    this.game.networkPause = this.pauseReason()
    // The new host starts with a full world; the quiet while it builds it is no stall.
    this.lastWorldAt = Date.now()
    this.onToast(dropped > 0 ? `${notice} ${droppedActionsNotice(dropped)}` : notice, dropped > 0)
    this.onStatus(this.status)
  }

  private handleCommandResult(message: ServerOf<'commandResult'>): void {
    if (this.status.mode !== 'client') return
    const pending = this.pendingCommands.delete(message.commandId)
    const optimistic = this.game.resolveOptimisticCommand(message.commandId)
    if (!pending && !optimistic) return
    if (!message.result.ok) {
      this.onToast(message.result.message, true)
      if (optimistic) this.requestResync()
    } else if (!optimistic) {
      this.onToast(message.result.message)
    }
  }

  private handleError(message: ServerOf<'error'>): void {
    // The room we tried to resume into is gone. Open a fresh one rather than
    // knocking on a door that is not there any more.
    if (!this.status.connected && this.hello?.t === 'host') {
      this.status = { ...EMPTY_STATUS, message: 'Raum neu öffnen …' }
      this.open(this.hello)
      return
    }
    this.onToast(message.message, true)
  }

  /**
   * The room is over. A guest keeps the park it was looking at, rebuilt the way
   * a save is loaded: its mirror never ran a tick of its own.
   */
  private handleClosed(message: ServerOf<'closed'>): void {
    const next = this.status.mode === 'client' && this.hasWorld ? this.buildWorld(undefined, this.game) : null
    this.onToast(next ? `${message.message} – du spielst allein weiter.` : message.message, true)
    this.disconnect()
    if (next) this.onContinueSolo(next)
  }
}
