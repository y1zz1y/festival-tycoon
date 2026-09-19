import type { GameState } from '../game/GameState'
import { WorldUpdates } from './worldUpdates'
import { packWorld } from './codec'
import { multiplayerSocketUrl } from './lobbies'
import type {
  ClientMessage,
  GameCommand,
  NetPlayer,
  ServerMessage,
} from './protocol'

export type MultiplayerStatus = {
  mode: 'solo' | 'host' | 'client'
  code: string
  joinUrl: string
  playerId: string
  players: NetPlayer[]
  connected: boolean
  message: string
}

const EMPTY_STATUS: MultiplayerStatus = {
  mode: 'solo',
  code: '',
  joinUrl: '',
  playerId: '',
  players: [],
  connected: false,
  message: '',
}

export class MultiplayerSession {
  status: MultiplayerStatus = { ...EMPTY_STATUS }
  onStatus: (status: MultiplayerStatus) => void = () => {}
  onToast: (message: string, isError?: boolean) => void = () => {}
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
    this.bindGame()
    if (this.status.mode !== 'host') return
    // A save loaded into a running room takes the room's code, not the other
    // way round: the code cannot change mid-session, and saving again should
    // keep the one the other players already have.
    this.stampCode()
    this.pushSync()
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
    this.connect({
      t: 'host',
      name: this.playerName,
      code: this.game.snapshot.multiplayerCode || undefined,
      public: listed,
    })
  }

  join(code: string, name: string): void {
    this.playerName = name.trim() || 'Gast'
    this.connect({
      t: 'join',
      code: code.trim().toUpperCase(),
      name: this.playerName,
    })
  }

  disconnect(): void {
    // Saying so is what ends a room. A socket that merely dropped is a hiccup,
    // and the session dials back instead of giving the game up.
    this.leaving = true
    this.send({ t: 'leave' })
    this.cancelReconnect()
    this.hello = null
    this.unbindGame()
    this.socket?.close()
    this.socket = null
    this.game.networkMode = 'solo'
    this.status = { ...EMPTY_STATUS, message: 'Getrennt' }
    this.onStatus(this.status)
    this.leaving = false
  }

  tick(deltaSeconds: number): void {
    if (this.status.mode === 'client') {
      if (this.needsResync || Date.now() - this.lastWorldAt > 5000) this.requestResync()
      return
    }
    if (this.status.mode !== 'host' || this.status.players.length < 2) return
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
    if (this.socket!.bufferedAmount > 512 * 1024) {
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
    this.bindGame()
    this.stampCode()
    this.pushSync()
    this.onStatus(this.status)
  }

  private handleMessage(message: ServerMessage): void {
    if (message.t === 'hosted') {
      this.becomeHost({
        mode: 'host',
        code: message.code,
        joinUrl: message.joinUrl,
        playerId: message.playerId,
        players: message.players,
        connected: true,
        message: `Raum ${message.code} läuft`,
      })
      return
    }
    if (message.t === 'joined') {
      this.cancelReconnect()
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
            : `Verbunden mit ${message.code}`,
      }
      this.bindGame()
      if (message.role === 'host') this.pushSync()
      this.onStatus(this.status)
      return
    }
    if (message.t === 'players') {
      const previousCount = this.status.players.length
      this.status = {
        ...this.status,
        players: message.players,
        // A guest whose host dropped out keeps its world and waits; saying so
        // beats a silent room where nothing can be built any more.
        message: message.hostAway && this.status.mode === 'client'
          ? 'Host ist weg – warte auf Rückkehr'
          : this.status.message,
      }
      if (this.status.mode === 'host' && message.players.length > previousCount) {
        this.pushSync()
      }
      this.onStatus(this.status)
      return
    }
    if (message.t === 'command' && this.status.mode === 'host') {
      this.game.schedulePublicCommand({
        ...message.cmd,
        originPlayerId: message.from,
      })
      return
    }
    if (message.t === 'resync' && this.status.mode === 'host') {
      this.pushSync()
      return
    }
    if (message.t === 'turn' && this.status.mode === 'client') {
      this.game.receiveTurn(message)
      return
    }
    if (message.t === 'sync' && this.status.mode === 'client') {
      this.game.applyNetworkWorld(message.world)
      this.hasWorld = true
      this.needsResync = false
      this.lastWorldAt = Date.now()
      return
    }
    if (message.t === 'state' && this.status.mode === 'client' && this.hasWorld) {
      this.game.applyNetworkUpdate(message.world, message.visitors, message.removed)
      this.lastWorldAt = Date.now()
      return
    }
    if (message.t === 'commandResult' && this.status.mode === 'client') {
      const pending = this.pendingCommands.delete(message.commandId)
      const optimistic = this.game.resolveOptimisticCommand(message.commandId)
      if (!pending && !optimistic) return
      if (!message.result.ok) {
        this.onToast(message.result.message, true)
        if (optimistic) this.requestResync()
      } else if (!optimistic) {
        this.onToast(message.result.message)
      }
      return
    }
    if (message.t === 'result') {
      this.onToast(message.message, !message.ok)
      return
    }
    if (message.t === 'error') {
      // The room we tried to resume into is gone. Open a fresh one rather than
      // knocking on a door that is not there any more.
      if (!this.status.connected && this.hello?.t === 'host') {
        this.status = { ...EMPTY_STATUS, message: 'Raum neu öffnen …' }
        this.open(this.hello)
        return
      }
      this.onToast(message.message, true)
      return
    }
    if (message.t === 'closed') {
      this.onToast(message.message, true)
      this.disconnect()
    }
  }
}
