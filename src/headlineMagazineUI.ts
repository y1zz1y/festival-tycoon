import type { GameSnapshot } from './game/GameState'
import { buildHeadlineMagazine, type HeadlineMagazine } from './game/headlineMagazine'
import { isLoadingOverlayVisible } from './ui/loadingOverlay'
import './headlineMagazine.css'

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!))

const stars = (count: number) => `${'★'.repeat(count)}${'☆'.repeat(Math.max(0, 5 - count))}`

function magazineMarkup(mag: HeadlineMagazine): string {
  const column = (items: HeadlineMagazine['pros']) => items.map((item) =>
    `<article><h3>${escape(item.headline)}</h3><p>${escape(item.body)}</p></article>`).join('')
  return `<header class="headline-magazine-masthead">
      <p class="headline-magazine-kicker">${escape(mag.kicker)}</p>
      <h1 id="headline-magazine-title">${escape(mag.masthead)}</h1>
      <p class="headline-magazine-issue">${escape(mag.issueLine)}</p>
      <p class="headline-magazine-date">${escape(mag.dateLine)}</p>
    </header>
    <section class="headline-magazine-hero">
      <figure class="headline-magazine-cover">
        <span class="headline-magazine-stamp">${escape(mag.coverStamp)}</span>
        <figcaption>${escape(mag.heroCaption)}</figcaption>
      </figure>
      <div class="headline-magazine-scorebox">
        <p class="headline-magazine-stars" aria-label="${mag.stars} von 5 Sternen">${stars(mag.stars)}</p>
        <p class="headline-magazine-note">${mag.score}<small>Punkte · ${escape(mag.verdictLine)}</small></p>
        <blockquote class="headline-magazine-quote">${escape(mag.pullQuote)}</blockquote>
        <p class="headline-magazine-lede">${escape(mag.lede)}</p>
        <p class="headline-magazine-verdict">Pro ${mag.pros.length} · Kontra ${mag.cons.length}</p>
      </div>
    </section>
    <div class="headline-magazine-columns">
      <section class="headline-magazine-col headline-magazine-pro"><h2>Pro</h2>${column(mag.pros)}</section>
      <section class="headline-magazine-col headline-magazine-con"><h2>Kontra</h2>${column(mag.cons)}</section>
    </div>
    <footer class="headline-magazine-footer">
      <span>HEADLINE · Ausgabe ${String(mag.edition).padStart(2, '0')}</span>
      <button type="button" data-magazine-close>Weiter / Schließen</button>
    </footer>`
}

export function mountHeadlineMagazine(root: ParentNode = document.body) {
  const overlay = document.createElement('div')
  overlay.id = 'headline-magazine'
  overlay.className = 'headline-magazine'
  overlay.hidden = true
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-labelledby', 'headline-magazine-title')
  const spread = document.createElement('article')
  spread.className = 'headline-magazine-spread'
  overlay.append(spread)
  root.append(overlay)

  let dismissedKey = ''
  let currentKey = ''
  let lastMarkup = ''

  const hide = () => { overlay.hidden = true }
  const paint = (mag: HeadlineMagazine) => {
    const html = magazineMarkup(mag)
    if (html === lastMarkup) return
    spread.innerHTML = html
    lastMarkup = html
  }
  const close = () => {
    if (currentKey) dismissedKey = currentKey
    hide()
  }
  const open = () => {
    if (!currentKey) return
    overlay.hidden = false
    spread.querySelector<HTMLButtonElement>('[data-magazine-close]')?.focus()
  }

  overlay.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-magazine-close]')
    if (button) close()
  })
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || overlay.hidden) return
    event.stopPropagation()
    event.preventDefault()
    close()
  }, true)

  // Loading a finished weekend would otherwise throw the magazine up while the
  // save is still being read, shining through the loading overlay. Wait for the
  // spinner to go before opening it.
  let waitingForLoad = false
  const openWhenLoaded = () => {
    if (!isLoadingOverlayVisible()) {
      waitingForLoad = false
      open()
      return
    }
    if (waitingForLoad) return
    waitingForLoad = true
    const poll = window.setInterval(() => {
      if (isLoadingOverlayVisible()) return
      window.clearInterval(poll)
      waitingForLoad = false
      if (currentKey && currentKey !== dismissedKey) open()
    }, 100)
  }

  const update = (s: Readonly<GameSnapshot>) => {
    const mag = buildHeadlineMagazine(s)
    if (!mag) {
      currentKey = ''
      lastMarkup = ''
      hide()
      return
    }
    currentKey = mag.weekendKey
    paint(mag)
    if (currentKey !== dismissedKey) openWhenLoaded()
  }

  return { update, open, close, isOpen: () => !overlay.hidden }
}
