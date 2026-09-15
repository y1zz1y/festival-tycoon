import { makeDraggable, makeResizable } from './dragPanel'
import type { GameSnapshot } from './game/GameState'
import {
  appendTickerHistory,
  createTickerWatchState,
  formatTickerClock,
  observeTickerEvents,
  pickTickerDisplay,
  tickerKindIcon,
  type TickerItem,
  type TickerWatchState,
} from './game/ticker'

const DISPLAY_MS = 10000

export function mountTickerUI(options: {
  focusWorld: (x: number, z: number) => void
}): {
  update: (snapshot: GameSnapshot) => void
  reset: () => void
} {
  const toggle = document.querySelector<HTMLButtonElement>('#toggle-ticker')
  const shell = document.querySelector<HTMLElement>('.game-shell')
  if (!toggle || !shell) {
    return { update: () => undefined, reset: () => undefined }
  }

  const bar = document.createElement('div')
  bar.id = 'ticker-bar'
  bar.className = 'ticker-bar'
  bar.hidden = true
  bar.setAttribute('role', 'status')
  bar.setAttribute('aria-live', 'polite')
  bar.innerHTML = `
    <span class="ticker-icon" aria-hidden="true"></span>
    <div class="ticker-copy">
      <strong class="ticker-title"></strong>
      <span class="ticker-message"></span>
    </div>
    <button type="button" class="ticker-jump" hidden>Hin</button>
    <button type="button" class="ticker-dismiss" aria-label="Meldung ausblenden">×</button>
  `

  const panel = document.createElement('aside')
  panel.id = 'ticker-panel'
  panel.className = 'ticker-panel panel'
  panel.setAttribute('aria-label', 'Meldungen')
  panel.innerHTML = `
    <div class="panel-header">
      <span class="panel-drag-line" aria-hidden="true"></span>
      <h2 class="panel-header-title">Meldungen</h2>
      <span class="panel-drag-line" aria-hidden="true"></span>
      <button id="close-ticker" class="panel-close-button" aria-label="Meldungen schließen">×</button>
    </div>
    <p class="ticker-history-summary">Noch keine Vorfälle oder Ereignisse.</p>
    <div class="ticker-history-list"></div>
  `

  shell.append(bar, panel)
  makeDraggable(panel.querySelector<HTMLElement>('.panel-header')!, panel)
  makeResizable(panel)

  const icon = bar.querySelector<HTMLElement>('.ticker-icon')!
  const title = bar.querySelector<HTMLElement>('.ticker-title')!
  const message = bar.querySelector<HTMLElement>('.ticker-message')!
  const jump = bar.querySelector<HTMLButtonElement>('.ticker-jump')!
  const dismiss = bar.querySelector<HTMLButtonElement>('.ticker-dismiss')!
  const summary = panel.querySelector<HTMLElement>('.ticker-history-summary')!
  const list = panel.querySelector<HTMLElement>('.ticker-history-list')!
  const close = panel.querySelector<HTMLButtonElement>('#close-ticker')!

  let watch: TickerWatchState = createTickerWatchState()
  let history: TickerItem[] = []
  let current: TickerItem | null = null
  let hideTimer = 0

  const setPanelOpen = (open: boolean): void => {
    panel.classList.toggle('visible', open)
    toggle.setAttribute('aria-expanded', String(open))
    if (open) renderHistory()
  }

  const renderHistory = (): void => {
    if (history.length === 0) {
      summary.textContent = 'Noch keine Vorfälle oder Ereignisse.'
      list.replaceChildren()
      return
    }
    summary.textContent = `${history.length} letzte Meldung${history.length === 1 ? '' : 'en'}`
    list.replaceChildren(
      ...history.map((item) => {
        const row = document.createElement('div')
        row.className = `ticker-history-item ticker-${item.severity}`
        const text = document.createElement('div')
        const heading = document.createElement('strong')
        heading.textContent = `${tickerKindIcon(item.kind)} ${item.title}`
        const body = document.createElement('span')
        body.textContent = item.message
        const clock = document.createElement('small')
        clock.textContent = formatTickerClock(item)
        text.append(heading, body, clock)
        row.append(text)
        if (item.position) {
          const go = document.createElement('button')
          go.type = 'button'
          go.textContent = 'Hin'
          go.title = 'Zum Ort springen'
          go.addEventListener('click', () => {
            options.focusWorld(item.position!.x, item.position!.z)
          })
          row.append(go)
        }
        return row
      }),
    )
  }

  const hideBar = (): void => {
    window.clearTimeout(hideTimer)
    hideTimer = 0
    bar.hidden = true
    current = null
  }

  const showItem = (item: TickerItem): void => {
    current = item
    icon.textContent = tickerKindIcon(item.kind)
    title.textContent = item.title
    message.textContent = item.message
    bar.className = `ticker-bar ticker-${item.severity}`
    bar.hidden = false
    if (item.position) {
      jump.hidden = false
      jump.title = 'Zum Ort springen'
    } else {
      jump.hidden = true
    }
    window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(hideBar, DISPLAY_MS)
  }

  jump.addEventListener('click', () => {
    if (!current?.position) return
    options.focusWorld(current.position.x, current.position.z)
  })
  dismiss.addEventListener('click', hideBar)
  toggle.addEventListener('click', () => {
    setPanelOpen(!panel.classList.contains('visible'))
  })
  close.addEventListener('click', () => setPanelOpen(false))

  const syncToggle = (): void => {
    const count = history.length
    toggle.title = count > 0 ? `Meldungen (${count})` : 'Meldungen'
    toggle.setAttribute('aria-label', toggle.title)
    toggle.classList.toggle('has-ticker', count > 0)
  }

  return {
    update: (snapshot) => {
      const incoming = observeTickerEvents(snapshot, watch)
      if (incoming.length === 0) return
      history = appendTickerHistory(history, incoming)
      const shown = pickTickerDisplay(incoming)
      if (shown) showItem(shown)
      syncToggle()
      if (panel.classList.contains('visible')) renderHistory()
    },
    reset: () => {
      watch = createTickerWatchState()
      history = []
      hideBar()
      syncToggle()
      renderHistory()
    },
  }
}
