/**
 * Development aid for the pseudo-locale (docs/i18n.md). In `qps` every text that went
 * through the layer carries a mark — ⟦hit⟧ or ⟪miss⟫ — so German on screen without one
 * skipped `t`/`localize`. This watches the page and reports such text once each, in the
 * console and in `globalThis.__i18nLeaks` (text → where it was seen).
 *
 * src/boot.ts loads it only in dev builds with the `qps` setting; production builds drop
 * the import. Canvas text (`fillText`) is invisible to it; the checker covers that sink.
 */

const MARK = /[⟦⟪]/
/** German on sight: umlauts, ß, German quotes or a common function word. */
const GERMAN = /[äöüÄÖÜß„]|(?:^|[^\p{L}])(?:der|die|das|den|dem|und|oder|nicht|ist|sind|ein|eine|einen|kein|keine|mit|für|auf|zum|zur|bei|vom|von|ich|wir|noch|schon|hier|wird|werden|kann|muss|nur|auch|alle|jetzt|bitte)(?=$|[^\p{L}])/iu
const TEXT_ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt']
const SKIPPED = 'script, style, textarea, [contenteditable]'
const SETTLE_MS = 250

function describe(element: Element): string {
  const id = element.id ? `#${element.id}` : ''
  const classes = [...element.classList].slice(0, 2).map((name) => `.${name}`).join('')
  return `${element.tagName.toLowerCase()}${id}${classes}`
}

/** Starts watching `root`; returns a function that stops it. */
export function watchTextLeaks(root: HTMLElement = document.body): () => void {
  const holder = globalThis as { __i18nLeaks?: Map<string, string> }
  const leaks = (holder.__i18nLeaks ??= new Map())
  const report = (raw: string | null, where: string): void => {
    const text = raw?.replace(/\s+/g, ' ').trim() ?? ''
    if (text.length < 2 || MARK.test(text) || !GERMAN.test(text) || leaks.has(text)) return
    leaks.set(text, where)
    console.warn(`[i18n] German text without a qps mark in ${where}: ${text}`)
  }
  const scanElement = (element: Element): void => {
    if (element.closest(SKIPPED)) return
    for (const name of TEXT_ATTRIBUTES) {
      const value = element.getAttribute(name)
      if (value) report(value, `${describe(element)}[${name}]`)
    }
  }
  const scan = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement
      if (parent && !parent.closest(SKIPPED)) report(node.textContent, describe(parent))
      return
    }
    if (!(node instanceof Element)) return
    scanElement(node)
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
    for (let current = walker.nextNode(); current; current = walker.nextNode()) {
      if (current instanceof Element) scanElement(current)
      else if (current.parentElement && !current.parentElement.closest(SKIPPED)) report(current.textContent, describe(current.parentElement))
    }
  }

  // Panels re-render often; collect what changed and scan once the page settles.
  const pending = new Set<Node>([root])
  let timer = 0
  const flush = (): void => {
    timer = 0
    for (const node of pending) if (node.isConnected) scan(node)
    pending.clear()
  }
  const schedule = (): void => {
    if (!timer) timer = window.setTimeout(flush, SETTLE_MS)
  }
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach((node) => pending.add(node))
      else pending.add(record.target)
    }
    schedule()
  })
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: TEXT_ATTRIBUTES })
  schedule()
  return () => {
    observer.disconnect()
    window.clearTimeout(timer)
  }
}
