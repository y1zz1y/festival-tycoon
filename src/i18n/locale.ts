/**
 * Which language this page load shows. A leaf module: src/boot.ts reads it before any
 * other game code is loaded, and index.html repeats the same resolution inline for the
 * boot caption. The choice is a device setting inside `festival-player-settings`; it is
 * never saved with a game and never sent to other players.
 */

/** 'qps' is the pseudo-locale for finding text that skipped the layer; dev builds only. */
export type Locale = 'de' | 'en' | 'qps'
export type LanguageSetting = 'auto' | 'de' | 'en' | 'qps'

/** localStorage key of the device settings (src/app/playerSettings.ts re-exports it). */
export const PLAYER_SETTINGS_KEY = 'festival-player-settings'

/** True in `vite dev`; undefined in Node tests and production builds. */
export function isDevBuild(): boolean {
  return Boolean(import.meta.env?.DEV)
}

/** Every value the setting accepts in this build. */
export function languageSettings(): readonly LanguageSetting[] {
  return isDevBuild() ? ['auto', 'de', 'en', 'qps'] : ['auto', 'de', 'en']
}

/** Unknown or retired values fall back to 'auto'. */
export function normalizeLanguageSetting(value: unknown): LanguageSetting {
  return languageSettings().includes(value as LanguageSetting) ? value as LanguageSetting : 'auto'
}

/**
 * The stored setting, read without touching the rest of the settings code. Anything
 * unreadable — no storage, blocked storage (reading `localStorage` itself can throw),
 * broken JSON — counts as 'auto'.
 */
export function readLanguageSetting(storage?: Pick<Storage, 'getItem'> | null): LanguageSetting {
  try {
    const source = storage === undefined ? globalThis.localStorage ?? null : storage
    const stored = source?.getItem(PLAYER_SETTINGS_KEY)
    const parsed: unknown = stored ? JSON.parse(stored) : null
    return normalizeLanguageSetting(parsed && typeof parsed === 'object' ? (parsed as { language?: unknown }).language : undefined)
  } catch {
    return 'auto'
  }
}

/**
 * 'de' and 'en' are taken as they are. 'auto' picks the first browser language whose
 * primary subtag is de or en, and English when none is. The browser languages are only
 * read for 'auto' (pass a function to read them lazily).
 */
export function resolveLocale(setting: LanguageSetting | undefined, languages: readonly string[] | (() => readonly string[])): Locale {
  if (setting === 'de' || setting === 'en') return setting
  if (setting === 'qps' && isDevBuild()) return 'qps'
  for (const language of typeof languages === 'function' ? languages() : languages) {
    const primary = language.toLowerCase().split('-')[0]
    if (primary === 'de' || primary === 'en') return primary
  }
  return 'en'
}

/** What detectLocale reads. Tests pass their own; index.html repeats the same steps inline. */
export type LocaleEnvironment = {
  storage?: Pick<Storage, 'getItem'> | null
  navigator: { readonly languages?: readonly string[] }
}

/**
 * The locale of this page load. Outside a browser (Node tests, server) it is always
 * German — Node has a `navigator` global, so the check looks for window and document.
 * A browser whose navigator fails gets German too.
 */
export function detectLocale(environment?: LocaleEnvironment): Locale {
  if (!environment && (typeof window === 'undefined' || typeof document === 'undefined')) return 'de'
  try {
    const source = environment ?? { navigator }
    return resolveLocale(readLanguageSetting(source.storage), () => source.navigator.languages ?? [])
  } catch {
    return 'de'
  }
}
