/**
 * The interface size. Every window, bar and menu of `.game-shell` is scaled with CSS
 * `zoom: var(--ui-scale)`; the 3D canvas and the world-anchored ping overlay are not.
 * Inside a zoomed element, `left: 100px` lands at 100 × scale on screen, so code that
 * places a window from a screen measurement (`getBoundingClientRect`, `clientX`)
 * divides by the scale with `toUiPx` first.
 */
let scale = 1

export function setUiScale(value: number): void {
  scale = value
  document.documentElement.style.setProperty('--ui-scale', String(value))
}

export function uiScale(): number {
  return scale
}

/** A screen distance in the CSS pixels of a zoomed interface element. */
export function toUiPx(screenPx: number): number {
  return screenPx / scale
}
