let element: HTMLDivElement | null = null
let hideTimer: number | undefined

function ensureElement(): HTMLDivElement {
  if (element) return element
  element = document.createElement('div')
  element.className = 'load-overlay'
  element.hidden = true
  element.setAttribute('role', 'status')
  element.setAttribute('aria-live', 'polite')
  element.innerHTML = '<div class="load-overlay-ring"></div><div class="load-overlay-caption"></div>'
  document.body.appendChild(element)
  return element
}

function showLoadingOverlay(caption: string): void {
  const el = ensureElement()
  el.querySelector('.load-overlay-caption')!.textContent = caption
  window.clearTimeout(hideTimer)
  el.hidden = false
  el.classList.remove('load-overlay-hide')
}

function hideLoadingOverlay(): void {
  if (!element) return
  element.classList.add('load-overlay-hide')
  hideTimer = window.setTimeout(() => {
    if (element) element.hidden = true
  }, 250)
}

/**
 * Shows the overlay, waits for it to actually paint (a bare requestAnimationFrame fires
 * before that paint, so this chains two), then runs the — usually synchronous and
 * momentarily blocking — load itself, and hides the overlay again once it's done.
 */
export function loadWithOverlay(caption: string, run: () => void): void {
  showLoadingOverlay(caption)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try {
      run()
    } finally {
      hideLoadingOverlay()
    }
  }))
}
