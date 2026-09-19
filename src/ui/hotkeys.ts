/**
 * The world's keyboard shortcuts, in one place and rebindable.
 *
 * Keys are held as `KeyboardEvent.code`, the physical position, so a binding
 * means the same key on a QWERTZ board as on a QWERTY one and does not move
 * when the layout changes. The numpad digits are folded onto the row above, so
 * a player who reaches for the pad still gets their tool.
 */
export type HotkeyAction =
  | 'toolPath' | 'toolFood' | 'toolToilet' | 'toolRide' | 'toolAlcohol'
  | 'toolSecurityGate' | 'toolCamping' | 'toolBulldoze' | 'toolInspect' | 'toolCoaster'
  | 'cameraLeft' | 'cameraRight' | 'rotateBuild' | 'elevationUp' | 'elevationDown'
  | 'togglePause'

export type HotkeyDefinition = {
  action: HotkeyAction
  label: string
  group: string
  /** What the key does, for the title on the row. */
  hint: string
  code: string
}

export const HOTKEYS: readonly HotkeyDefinition[] = [
  { action: 'toolPath', label: 'Weg', group: 'Werkzeuge', hint: 'Wege bauen', code: 'Digit1' },
  { action: 'toolFood', label: 'Essensstand', group: 'Werkzeuge', hint: 'Essensstand bauen', code: 'Digit2' },
  { action: 'toolToilet', label: 'Toilette', group: 'Werkzeuge', hint: 'Toilette bauen', code: 'Digit3' },
  { action: 'toolRide', label: 'Fahrgeschäft', group: 'Werkzeuge', hint: 'Fahrgeschäft bauen', code: 'Digit4' },
  { action: 'toolAlcohol', label: 'Getränkestand', group: 'Werkzeuge', hint: 'Getränkestand bauen', code: 'Digit5' },
  { action: 'toolSecurityGate', label: 'Sicherheitstor', group: 'Werkzeuge', hint: 'Sicherheitstor bauen', code: 'Digit6' },
  { action: 'toolCamping', label: 'Camping', group: 'Werkzeuge', hint: 'Campingfläche ausweisen', code: 'Digit7' },
  { action: 'toolBulldoze', label: 'Abriss', group: 'Werkzeuge', hint: 'Abrissbirne', code: 'Digit8' },
  { action: 'toolInspect', label: 'Info', group: 'Werkzeuge', hint: 'Gebäude ansehen', code: 'Digit9' },
  { action: 'toolCoaster', label: 'Achterbahn', group: 'Werkzeuge', hint: 'Achterbahn-Baumenü öffnen', code: 'Digit0' },
  { action: 'cameraLeft', label: 'Kamera links', group: 'Kamera & Bau', hint: 'Ansicht gegen den Uhrzeigersinn', code: 'KeyQ' },
  { action: 'cameraRight', label: 'Kamera rechts', group: 'Kamera & Bau', hint: 'Ansicht im Uhrzeigersinn', code: 'KeyE' },
  { action: 'rotateBuild', label: 'Drehen', group: 'Kamera & Bau', hint: 'Bauobjekt oder Wegrichtung drehen', code: 'KeyR' },
  { action: 'elevationUp', label: 'Bauhöhe höher', group: 'Kamera & Bau', hint: 'Eine Stufe nach oben', code: 'PageUp' },
  { action: 'elevationDown', label: 'Bauhöhe tiefer', group: 'Kamera & Bau', hint: 'Eine Stufe nach unten', code: 'PageDown' },
  { action: 'togglePause', label: 'Pause / Weiter', group: 'Spiel', hint: 'Zeit anhalten und weiterlaufen lassen', code: 'Space' },
]

const STORAGE_KEY = 'festival-hotkeys'
const bound = new Map<HotkeyAction, string>(HOTKEYS.map(key => [key.action, key.code]))

/** Keys the game cannot give away: they mean something everywhere else too. */
const RESERVED = new Set(['Escape', 'Tab', 'Enter', 'NumpadEnter', 'Backspace', 'ShiftLeft', 'ShiftRight', 'F5', 'F11', 'F12'])

/** The numpad row counts as the digit row, so either one reaches the same tool. */
export function normalizeCode(code: string): string {
  const numpadDigit = /^Numpad([0-9])$/.exec(code)
  return numpadDigit ? `Digit${numpadDigit[1]}` : code
}

/** What a key is called on the button, rather than what the browser calls it. */
export function hotkeyLabel(code: string): string {
  if (code === 'Space') return 'Leertaste'
  if (code === 'PageUp') return 'Bild ↑'
  if (code === 'PageDown') return 'Bild ↓'
  if (code === 'ArrowUp') return '↑'
  if (code === 'ArrowDown') return '↓'
  if (code === 'ArrowLeft') return '←'
  if (code === 'ArrowRight') return '→'
  const letter = /^Key([A-Z])$/.exec(code)
  if (letter) return letter[1]!
  const digit = /^Digit([0-9])$/.exec(code)
  if (digit) return digit[1]!
  return code
}

export function hotkeyCode(action: HotkeyAction): string {
  return bound.get(action) ?? ''
}

export function hotkeyBindings(): Map<HotkeyAction, string> {
  return new Map(bound)
}

/** Whether a key may be bound at all, and to something other than what has it. */
export function isBindableCode(code: string): boolean {
  return !RESERVED.has(code) && code !== '' && code !== 'Unidentified'
}

/**
 * Gives the key to this action. A key belongs to one action at a time, so
 * whoever held it before is left unbound rather than both firing at once.
 */
export function setHotkey(action: HotkeyAction, code: string): void {
  const wanted = normalizeCode(code)
  for (const [other, held] of bound) {
    if (other !== action && held === wanted) bound.set(other, '')
  }
  bound.set(action, wanted)
  save()
}

export function resetHotkeys(): void {
  for (const key of HOTKEYS) bound.set(key.action, key.code)
  save()
}

/** The action a key press means, or null if the key is not bound to anything. */
export function actionForEvent(event: KeyboardEvent): HotkeyAction | null {
  const code = normalizeCode(event.code)
  if (!code) return null
  for (const [action, held] of bound) {
    if (held && held === code) return action
  }
  return null
}

export function loadHotkeys(): void {
  let stored: unknown
  try {
    stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')
  } catch {
    // Blocked storage or a half-written value: the defaults are fine.
    return
  }
  if (!stored || typeof stored !== 'object') return
  const known = new Set(HOTKEYS.map(key => key.action))
  for (const [action, code] of Object.entries(stored as Record<string, unknown>)) {
    if (!known.has(action as HotkeyAction)) continue
    if (typeof code !== 'string') continue
    bound.set(action as HotkeyAction, normalizeCode(code))
  }
}

function save(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(bound)))
  } catch {
    // The binding still holds for this session, it just does not survive a reload.
  }
}
