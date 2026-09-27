/**
 * The world's keyboard shortcuts, in one place and rebindable.
 *
 * Keys are held as `KeyboardEvent.code`, the physical position, so a binding
 * means the same key on a QWERTZ board as on a QWERTY one and does not move
 * when the layout changes. The numpad digits are folded onto the row above, so
 * a player who reaches for the pad still gets their tool.
 */
import { t } from '../i18n'

export type HotkeyAction =
  | 'toolPath' | 'toolFood' | 'toolToilet' | 'toolRide' | 'toolAlcohol'
  | 'toolSecurityGate' | 'toolCamping' | 'toolBulldoze' | 'toolInspect' | 'toolCoaster'
  | 'cameraLeft' | 'cameraRight' | 'rotateBuild' | 'elevationUp' | 'elevationDown'
  | 'togglePause'

/** Stable id of the heading a key is listed under; compare this, never the shown label. */
type HotkeyGroup = 'tools' | 'camera' | 'game'

export type HotkeyDefinition = {
  readonly action: HotkeyAction
  readonly groupId: HotkeyGroup
  /** Shown texts are getters: they translate when read, not when this module loads. */
  readonly label: string
  readonly group: string
  /** What the key does, for the title on the row. */
  readonly hint: string
  readonly code: string
}

const GROUP_LABELS: Record<HotkeyGroup, () => string> = {
  tools: () => t('Werkzeuge'),
  camera: () => t('Kamera & Bau'),
  game: () => t('Spiel'),
}

function hotkey(
  action: HotkeyAction,
  groupId: HotkeyGroup,
  code: string,
  label: () => string,
  hint: () => string,
): HotkeyDefinition {
  return {
    action,
    groupId,
    code,
    get label() { return label() },
    get group() { return GROUP_LABELS[groupId]() },
    get hint() { return hint() },
  }
}

export const HOTKEYS: readonly HotkeyDefinition[] = [
  hotkey('toolPath', 'tools', 'Digit1', () => t('Weg'), () => t('Wege bauen')),
  hotkey('toolFood', 'tools', 'Digit2', () => t('Essensstand'), () => t('Essensstand bauen')),
  hotkey('toolToilet', 'tools', 'Digit3', () => t('Toilette'), () => t('Toilette bauen')),
  hotkey('toolRide', 'tools', 'Digit4', () => t('Fahrgeschäft'), () => t('Fahrgeschäft bauen')),
  hotkey('toolAlcohol', 'tools', 'Digit5', () => t('Getränkestand'), () => t('Getränkestand bauen')),
  hotkey('toolSecurityGate', 'tools', 'Digit6', () => t('Sicherheitstor'), () => t('Sicherheitstor bauen')),
  hotkey('toolCamping', 'tools', 'Digit7', () => t('Camping'), () => t('Campingfläche ausweisen')),
  hotkey('toolBulldoze', 'tools', 'Digit8', () => t('Abriss'), () => t('Abrissbirne')),
  hotkey('toolInspect', 'tools', 'Digit9', () => t('Info'), () => t('Gebäude ansehen')),
  hotkey('toolCoaster', 'tools', 'Digit0', () => t('Achterbahn'), () => t('Achterbahn-Baumenü öffnen')),
  hotkey('cameraLeft', 'camera', 'KeyQ', () => t('Kamera links'), () => t('Ansicht gegen den Uhrzeigersinn')),
  hotkey('cameraRight', 'camera', 'KeyE', () => t('Kamera rechts'), () => t('Ansicht im Uhrzeigersinn')),
  hotkey('rotateBuild', 'camera', 'KeyR', () => t('Drehen'), () => t('Bauobjekt oder Wegrichtung drehen')),
  hotkey('elevationUp', 'camera', 'PageUp', () => t('Bauhöhe höher'), () => t('Eine Stufe nach oben')),
  hotkey('elevationDown', 'camera', 'PageDown', () => t('Bauhöhe tiefer'), () => t('Eine Stufe nach unten')),
  hotkey('togglePause', 'game', 'Space', () => t('Pause / Weiter'), () => t('Zeit anhalten und weiterlaufen lassen')),
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
  if (code === 'Space') return t('Leertaste')
  if (code === 'PageUp') return t('Bild ↑')
  if (code === 'PageDown') return t('Bild ↓')
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
