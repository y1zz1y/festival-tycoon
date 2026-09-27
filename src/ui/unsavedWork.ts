/**
 * Keeps track of whether the running game holds work the player has not saved, so
 * closing the tab, loading another save or walking back to the title screen can ask
 * first instead of quietly throwing the session away.
 */
import { plural, t } from '../i18n'

export const WARN_AFTER_MS = 5 * 60 * 1000

let warningsOn = true
/** Set right before a reload the game itself asked for and the player already confirmed. */
let skipNextUnloadPrompt = false
let editRevisionOf: () => number = () => 0
let gameIsRunning: () => boolean = () => false
/** A joined guest holds no save of their own; the host owns the world. */
let isGuest: () => boolean = () => false
let clock: () => number = () => Date.now()
let savedRevision = 0
let savedAt = clock()

export function trackUnsavedWork(sources: {
  /** The game's own count of player-made changes. */
  editRevision: () => number
  /** False while only the title screen is up and there is nothing to lose. */
  running: () => boolean
  /** True for a multiplayer guest: their optimistic builds are not theirs to save. */
  guest?: () => boolean
  /** Overridable so the rule can be tested without waiting five real minutes. */
  now?: () => number
}): void {
  editRevisionOf = sources.editRevision
  gameIsRunning = sources.running
  isGuest = sources.guest ?? (() => false)
  clock = sources.now ?? (() => Date.now())
  markWorkSaved()
}

/** Called after a save, and whenever a fresh game takes over: nothing is pending now. */
export function markWorkSaved(): void {
  savedRevision = editRevisionOf()
  savedAt = clock()
}

/** Changes since the last save, or a session that has simply been running unsaved for a while. */
export function hasUnsavedWork(): boolean {
  if (!gameIsRunning() || isGuest()) return false
  if (editRevisionOf() !== savedRevision) return true
  return clock() - savedAt > WARN_AFTER_MS
}

export function minutesSinceSave(): number {
  return Math.floor((clock() - savedAt) / 60000)
}

/** Whether the player wants to be asked at all; off means every route goes straight through. */
export function setUnsavedWarnings(enabled: boolean): void {
  warningsOn = enabled
}

export function unsavedWarningsEnabled(): boolean {
  return warningsOn
}

/** Asks before something would discard the session; true means go ahead. */
export function confirmDiscardingWork(action: string): boolean {
  if (!warningsOn || !hasUnsavedWork()) return true
  const since = minutesSinceSave()
  const lost = t('Nicht gespeicherte Änderungen gehen dabei verloren.')
  const age = since >= 1
    ? plural(since, t`Zuletzt gespeichert vor ${since} Minute.`, t`Zuletzt gespeichert vor ${since} Minuten.`)
    : ''
  const warning = age ? `${lost} ${age}` : lost
  return window.confirm(`${action}\n\n${warning}`)
}

/**
 * The next unload is one the game started after its own confirmation (the language
 * switch reloads the page), so the browser's "leave site?" dialog must not ask again.
 */
export function suppressBeforeUnloadOnce(): void {
  skipNextUnloadPrompt = true
}

/** Whether the guard would prompt now; consumes a pending suppression. */
export function shouldPromptBeforeUnload(): boolean {
  if (skipNextUnloadPrompt) {
    skipNextUnloadPrompt = false
    return false
  }
  return warningsOn && hasUnsavedWork()
}

/** The browser's own "leave site?" prompt, for closing or reloading the tab. */
export function installUnsavedWorkGuard(): void {
  window.addEventListener('beforeunload', (event) => {
    if (!shouldPromptBeforeUnload()) return
    // Browsers show their own wording; setting returnValue is what asks at all.
    event.preventDefault()
    event.returnValue = ''
  })
}
