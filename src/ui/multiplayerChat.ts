import { escapeHtml } from './format'
import { makeDraggable, makeResizable } from '../dragPanel'
import {
  CHAT_PING_TTL_MS,
  CHAT_TEXT_LIMIT,
  edgeArrowPlacement,
  type ChatMessage,
  type ChatPing,
} from '../net/chatProtocol'
import { getTerrainHeight } from '../game/terrain'
import type { GameSnapshot } from '../game/GameState'

export const CHAT_DISPLAY_KEY = 'festival-mp-chat-display'
const MAX_LOG_ENTRIES = 80
/** Nick colour buckets; the palette itself lives in style.css (.mp-chat-nick-0…7). */
const NICK_COLOURS = 8

export type ChatViewBridge = {
  getPingWorldPoint: () => { x: number; z: number }
  projectWorldToCanvas: (
    x: number,
    y: number,
    z: number,
  ) => {
    x: number
    y: number
    onScreen: boolean
  } | null
  focusWorld: (x: number, z: number) => void
  getSnapshot: () => Readonly<GameSnapshot> | null
}

type ActivePing = {
  id: string
  x: number
  z: number
  name: string
  expiresAt: number
  marker: HTMLElement
  arrow: HTMLElement
}

export type MultiplayerChatController = {
  setConnected: (connected: boolean) => void
  receive: (message: ChatMessage) => void
  /** True when the event belonged to the chat (Escape leaving the input). */
  handleKeydown: (event: KeyboardEvent) => boolean
  /** Shows the window and focuses the input. False when chat is off or offline. */
  open: () => boolean
  setDisplayEnabled: (enabled: boolean) => void
  updateOverlay: () => void
}

function readDisplayPref(): boolean {
  try {
    return window.localStorage.getItem(CHAT_DISPLAY_KEY) !== 'off'
  } catch {
    return true
  }
}

function writeDisplayPref(enabled: boolean): void {
  try {
    window.localStorage.setItem(CHAT_DISPLAY_KEY, enabled ? 'on' : 'off')
  } catch {
    /* session-only then */
  }
}

/** Stable per-name colour bucket, so a speaker keeps one colour all evening. */
function nickColourIndex(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return Math.abs(hash) % NICK_COLOURS
}

/** IRC-style wall-clock stamp. Chat is presentation only, never simulation time. */
function clockStamp(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/**
 * Bottom-left multiplayer chat window: a draggable panel with an IRC-style log
 * and a compose bar, plus the map-ping overlay. The window exists only while a
 * multiplayer session is connected and "Chat anzeigen" is on; closing it is
 * temporary - the next incoming message brings it back.
 * Chat is ephemeral UI; the session sends/receives over the wire.
 */
export function mountMultiplayerChat(options: {
  sendChat: (text: string, ping?: ChatPing) => boolean
  view: ChatViewBridge
}): MultiplayerChatController {
  const shell = document.querySelector<HTMLElement>('.game-shell')
  if (!shell) {
    const noop = (): void => undefined
    return {
      setConnected: noop,
      receive: noop,
      handleKeydown: () => false,
      open: () => false,
      setDisplayEnabled: noop,
      updateOverlay: noop,
    }
  }

  const root = document.createElement('aside')
  root.id = 'mp-chat'
  root.className = 'mp-chat panel'
  root.hidden = true
  root.innerHTML = `
    <div class="panel-header">
      <span class="panel-drag-line" aria-hidden="true"></span>
      <h2 class="panel-header-title">Chat</h2>
      <span class="panel-drag-line" aria-hidden="true"></span>
      <button type="button" class="panel-close-button mp-chat-close" aria-label="Chat schließen">×</button>
    </div>
    <div class="mp-chat-log" role="log" aria-live="polite" aria-relevant="additions"></div>
    <form class="mp-chat-compose">
      <button type="button" class="mp-chat-ping" aria-pressed="false" title="Karten-Ping mitsenden">📍</button>
      <input class="mp-chat-input" type="text" maxlength="${CHAT_TEXT_LIMIT}" autocomplete="off" spellcheck="true" placeholder="Nachricht …" aria-label="Chat-Nachricht" />
      <button type="submit" class="mp-chat-send">Senden</button>
    </form>
  `

  const overlay = document.createElement('div')
  overlay.id = 'mp-ping-overlay'
  overlay.className = 'mp-ping-overlay'
  overlay.setAttribute('aria-hidden', 'true')

  shell.append(root, overlay)

  const log = root.querySelector<HTMLElement>('.mp-chat-log')!
  const compose = root.querySelector<HTMLFormElement>('.mp-chat-compose')!
  const input = root.querySelector<HTMLInputElement>('.mp-chat-input')!
  const pingButton = root.querySelector<HTMLButtonElement>('.mp-chat-ping')!
  const closeButton = root.querySelector<HTMLButtonElement>('.mp-chat-close')!

  let connected = false
  let displayEnabled = readDisplayPref()
  // The close button puts the window away for now, not for good: it stays down
  // until the player reopens it with Enter or somebody says something.
  let userClosed = false
  let pingArmed = false
  const pings = new Map<string, ActivePing>()

  const removePing = (id: string): void => {
    const entry = pings.get(id)
    if (!entry) return
    entry.marker.remove()
    entry.arrow.remove()
    pings.delete(id)
  }

  const clearPings = (): void => {
    for (const id of [...pings.keys()]) removePing(id)
  }

  const isAvailable = (): boolean => connected && displayEnabled

  const syncVisibility = (): void => {
    const visible = isAvailable() && !userClosed
    root.hidden = !visible
    if (visible) log.scrollTop = log.scrollHeight
  }

  const setPingArmed = (armed: boolean): void => {
    pingArmed = armed
    pingButton.setAttribute('aria-pressed', String(armed))
    pingButton.classList.toggle('active', armed)
  }

  const addPing = (message: ChatMessage): void => {
    if (!message.ping) return
    const marker = document.createElement('div')
    marker.className = 'mp-ping-marker'
    marker.title = message.name
    marker.innerHTML = `<span class="mp-ping-pulse"></span><span class="mp-ping-label">${escapeHtml(message.name)}</span>`
    const arrow = document.createElement('div')
    arrow.className = 'mp-ping-arrow'
    arrow.hidden = true
    arrow.textContent = '➤'
    overlay.append(marker, arrow)
    pings.set(message.id, {
      id: message.id,
      x: message.ping.x,
      z: message.ping.z,
      name: message.name,
      expiresAt: performance.now() + CHAT_PING_TTL_MS,
      marker,
      arrow,
    })
  }

  const makeJumpButton = (ping: ChatPing): HTMLButtonElement => {
    const jump = document.createElement('button')
    jump.type = 'button'
    jump.className = 'mp-chat-jump'
    jump.title = 'Zum Ping springen'
    jump.setAttribute('aria-label', 'Zum Ping springen')
    jump.textContent = '📍'
    jump.addEventListener('click', () => options.view.focusWorld(ping.x, ping.z))
    return jump
  }

  /**
   * One line per message in IRC layout: `[HH:MM] <Name> Text`, wrapped under a
   * hanging indent. A bare ping carries no text, so it reads as an IRC action
   * line (`* Name markiert ...`) rather than an empty message.
   */
  const appendLog = (message: ChatMessage): void => {
    const row = document.createElement('div')
    row.className = 'mp-chat-row'

    const time = document.createElement('span')
    time.className = 'mp-chat-time'
    time.textContent = `[${clockStamp()}]`
    row.append(time)

    const nick = document.createElement('span')
    nick.className = `mp-chat-nick mp-chat-nick-${nickColourIndex(message.name)}`
    const text = document.createElement('span')
    text.className = 'mp-chat-text'
    if (message.text) {
      nick.textContent = `<${message.name}>`
      text.textContent = message.text
    } else {
      row.classList.add('mp-chat-row-action')
      nick.textContent = `* ${message.name}`
      text.textContent = 'markiert einen Punkt auf der Karte'
    }
    row.append(nick, text)
    if (message.ping) row.append(makeJumpButton(message.ping))

    // Reading back through the log should not be yanked away by the next line;
    // only a log already parked at the bottom follows along.
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 24
    log.append(row)
    while (log.childElementCount > MAX_LOG_ENTRIES) log.firstElementChild?.remove()
    if (atBottom) log.scrollTop = log.scrollHeight
  }

  const submit = (): void => {
    if (!connected) return
    const text = input.value
    const ping = pingArmed ? options.view.getPingWorldPoint() : undefined
    if (!options.sendChat(text, ping)) return
    input.value = ''
    setPingArmed(false)
  }

  const open = (): boolean => {
    if (!isAvailable()) return false
    userClosed = false
    syncVisibility()
    input.focus()
    input.select()
    return true
  }

  closeButton.addEventListener('click', () => {
    userClosed = true
    setPingArmed(false)
    input.blur()
    syncVisibility()
  })
  pingButton.addEventListener('click', () => {
    setPingArmed(!pingArmed)
    input.focus()
  })
  compose.addEventListener('submit', (event) => {
    event.preventDefault()
    submit()
  })
  // Enter sends, the way it does in a chat client. Spelled out rather than left to
  // the form's implicit submission, which a browser only grants under conditions
  // this window should not depend on.
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    submit()
  })

  makeDraggable(root.querySelector<HTMLElement>('.panel-header')!, root)
  makeResizable(root)

  return {
    setConnected: (next) => {
      connected = next
      if (!next) {
        setPingArmed(false)
        input.blur()
        clearPings()
        log.replaceChildren()
        userClosed = false
      }
      syncVisibility()
    },
    receive: (message) => {
      appendLog(message)
      addPing(message)
      // A message arriving while the window is closed brings it back, but does
      // not steal the keyboard from whatever the player is building.
      if (userClosed && isAvailable()) {
        userClosed = false
        syncVisibility()
      }
    },
    handleKeydown: (event) => {
      if (event.key !== 'Escape' || document.activeElement !== input) return false
      event.preventDefault()
      setPingArmed(false)
      input.blur()
      return true
    },
    open,
    setDisplayEnabled: (enabled) => {
      displayEnabled = enabled
      writeDisplayPref(enabled)
      // Switching chat back on is a request to see it, so a closed window reopens.
      if (enabled) userClosed = false
      else input.blur()
      syncVisibility()
    },
    updateOverlay: () => {
      const now = performance.now()
      for (const [id, entry] of [...pings]) {
        if (now >= entry.expiresAt) {
          removePing(id)
          continue
        }
        const snapshot = options.view.getSnapshot()
        const groundY = snapshot
          ? getTerrainHeight(snapshot.terrain, Math.floor(entry.x), Math.floor(entry.z)) + 0.6
          : 0.6
        const projected = options.view.projectWorldToCanvas(entry.x, groundY, entry.z)
        if (!projected) {
          entry.marker.hidden = true
          entry.arrow.hidden = true
          continue
        }
        if (projected.onScreen) {
          entry.marker.hidden = false
          entry.arrow.hidden = true
          entry.marker.style.transform =
            `translate(${projected.x}px, ${projected.y}px) translate(-50%, -100%)`
        } else {
          entry.marker.hidden = true
          entry.arrow.hidden = false
          const width = overlay.clientWidth || window.innerWidth
          const heightPx = overlay.clientHeight || window.innerHeight
          const edge = edgeArrowPlacement(projected.x, projected.y, width, heightPx)
          entry.arrow.style.transform =
            `translate(${edge.x}px, ${edge.y}px) translate(-50%, -50%) rotate(${edge.angle}rad)`
        }
      }
    },
  }
}
