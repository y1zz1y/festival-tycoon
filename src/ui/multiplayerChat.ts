import { escapeHtml } from './format'
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
  /** True when Escape closed compose. Enter while compose is open is left to the form. */
  handleKeydown: (event: KeyboardEvent) => boolean
  openCompose: () => void
  isComposeOpen: () => boolean
  isDisplayEnabled: () => boolean
  setDisplayEnabled: (enabled: boolean) => void
  updateOverlay: () => void
  clear: () => void
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

/**
 * Bottom-left multiplayer chat log, compose bar, and map-ping overlay.
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
      openCompose: noop,
      isComposeOpen: () => false,
      isDisplayEnabled: () => true,
      setDisplayEnabled: noop,
      updateOverlay: noop,
      clear: noop,
    }
  }

  const root = document.createElement('div')
  root.id = 'mp-chat'
  root.className = 'mp-chat'
  root.hidden = true
  root.innerHTML = `
    <div class="mp-chat-log" aria-live="polite" aria-relevant="additions"></div>
    <form class="mp-chat-compose" hidden>
      <button type="button" class="mp-chat-ping" aria-pressed="false" title="Karten-Ping mitsenden">📍</button>
      <input class="mp-chat-input" type="text" maxlength="${CHAT_TEXT_LIMIT}" autocomplete="off" spellcheck="true" placeholder="Nachricht… (Enter senden)" aria-label="Chat-Nachricht" />
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

  let connected = false
  let displayEnabled = readDisplayPref()
  let composeOpen = false
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

  const syncVisibility = (): void => {
    root.hidden = !connected
    log.hidden = !displayEnabled
    root.classList.toggle('mp-chat-display-off', !displayEnabled)
    root.classList.toggle('mp-chat-quiet', Boolean(connected && !displayEnabled && !composeOpen))
    compose.hidden = !composeOpen
  }

  const setPingArmed = (armed: boolean): void => {
    pingArmed = armed
    pingButton.setAttribute('aria-pressed', String(armed))
    pingButton.classList.toggle('active', armed)
  }

  const openCompose = (): void => {
    if (!connected) return
    composeOpen = true
    syncVisibility()
    input.focus()
    input.select()
  }

  const closeCompose = (): void => {
    composeOpen = false
    setPingArmed(false)
    input.blur()
    syncVisibility()
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

  const appendLog = (message: ChatMessage): void => {
    if (!displayEnabled) return
    const row = document.createElement('div')
    row.className = 'mp-chat-row'
    if (message.ping) {
      const jump = document.createElement('button')
      jump.type = 'button'
      jump.className = 'mp-chat-jump'
      jump.title = 'Zum Ping springen'
      jump.setAttribute('aria-label', 'Zum Ping springen')
      jump.textContent = '📍'
      jump.addEventListener('click', () => {
        options.view.focusWorld(message.ping!.x, message.ping!.z)
      })
      row.append(jump)
    } else {
      const spacer = document.createElement('span')
      spacer.className = 'mp-chat-jump-spacer'
      spacer.setAttribute('aria-hidden', 'true')
      row.append(spacer)
    }
    const body = document.createElement('div')
    body.className = 'mp-chat-body'
    const name = document.createElement('strong')
    name.textContent = message.name
    const text = document.createElement('span')
    text.textContent = message.text || (message.ping ? 'Ping' : '')
    body.append(name, text)
    row.append(body)
    log.append(row)
    while (log.childElementCount > MAX_LOG_ENTRIES) log.firstElementChild?.remove()
    log.scrollTop = log.scrollHeight
  }

  const submit = (): void => {
    if (!connected) return
    const text = input.value
    const ping = pingArmed ? options.view.getPingWorldPoint() : undefined
    if (!options.sendChat(text, ping)) return
    input.value = ''
    setPingArmed(false)
  }

  pingButton.addEventListener('click', () => {
    setPingArmed(!pingArmed)
    input.focus()
  })
  compose.addEventListener('submit', (event) => {
    event.preventDefault()
    submit()
  })

  return {
    setConnected: (next) => {
      connected = next
      if (!next) {
        closeCompose()
        clearPings()
        log.replaceChildren()
      }
      syncVisibility()
    },
    receive: (message) => {
      appendLog(message)
      addPing(message)
    },
    handleKeydown: (event) => {
      if (!connected) return false
      if (event.key === 'Escape' && composeOpen) {
        event.preventDefault()
        closeCompose()
        return true
      }
      return false
    },
    openCompose,
    isComposeOpen: () => composeOpen,
    isDisplayEnabled: () => displayEnabled,
    setDisplayEnabled: (enabled) => {
      displayEnabled = enabled
      writeDisplayPref(enabled)
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
    clear: () => {
      clearPings()
      log.replaceChildren()
      closeCompose()
    },
  }
}
