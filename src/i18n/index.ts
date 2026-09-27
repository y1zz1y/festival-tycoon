/**
 * Public text-layer runtime (docs/i18n.md).
 *
 * - `t` / `tc`: the UI's own text, looked up by its German source.
 * - `localize`: game text (German, from the simulation, the host or the server) shown
 *   in the viewer's language at display time; exact keys first, then typed patterns.
 * - `localizeName`: entity names, including numbered defaults such as "Sanitäter 3".
 *
 * German is the identity everywhere, and Node tests always run German. Nothing here
 * imports the English catalog; src/boot.ts loads it for English players only.
 */
import { formatMoney, formatNumber } from './format'
import { num } from './marker'
import {
  candidatesFor,
  execPattern,
  fillValue,
  parseGermanNumber,
  skeletonOf,
  type CompiledPattern,
  type SlotType,
} from './pattern'
import { currentCaches, currentTables, currentTextRecorder, getLocale, type TextKind } from './state'

export type { Locale, LanguageSetting } from './locale'
export type { EnglishCatalog } from './state'
export { collator, getLocale, localeTag, setLocale } from './state'
export * from './marker'
export * from './format'
export * from './html'

const wrapHit = (text: string): string => (getLocale() === 'qps' ? `⟦${text}⟧` : text)
const wrapMiss = (text: string): string => (getLocale() === 'qps' ? `⟪${text}⟫` : text)
/** Text a qps sink already marked, as a hit or as a miss; a second sink leaves it alone. */
const isWrapped = (text: string): boolean =>
  (text.startsWith('⟦') && text.endsWith('⟧')) || (text.startsWith('⟪') && text.endsWith('⟫'))

/**
 * Text that fell back to German. Dev builds collect the UI's own keys (`t`, `tc`) in
 * `globalThis.__i18nMisses`; the coverage test installs a recorder for every kind.
 */
function recordMiss(kind: TextKind, key: string): void {
  currentTextRecorder()?.(kind, key, false)
  if (kind !== 't' || !import.meta.env?.DEV) return
  const holder = globalThis as { __i18nMisses?: Set<string> }
  ;(holder.__i18nMisses ??= new Set()).add(key)
}

/** A translation found: tells the coverage recorder (if any) and marks it in qps. */
function hit(kind: TextKind, english: string): string {
  currentTextRecorder()?.(kind, english, true)
  return wrapHit(english)
}

/** The German result of a tagged `t`: numbers in German notation in every locale (a miss shows it as is). */
function germanTemplate(strings: TemplateStringsArray, values: readonly (string | number)[]): string {
  let out = strings[0]!
  for (let index = 0; index < values.length; index++) {
    const value = values[index]!
    out += (typeof value === 'number' ? num(value) : value) + strings[index + 1]!
  }
  return out
}

function templateKey(strings: TemplateStringsArray): string {
  const caches = currentCaches()
  let key = caches.templateKeys.get(strings)
  if (key === undefined) {
    key = strings[0]!
    for (let index = 1; index < strings.length; index++) key += `{${index - 1}}${strings[index]!}`
    caches.templateKeys.set(strings, key)
  }
  return key
}

/** The UI's own text: `t('Abbrechen')`, `` t`${n} Besucher` ``. German is the key. */
export function t(key: string): string
export function t(strings: TemplateStringsArray, ...values: (string | number)[]): string
export function t(first: string | TemplateStringsArray, ...values: (string | number)[]): string {
  if (typeof first === 'string') {
    if (getLocale() === 'de') return first
    const english = currentTables().exact.get(first)
    if (english !== undefined) return hit('t', english)
    recordMiss('t', first)
    return wrapHit(first)
  }
  if (getLocale() === 'de') return germanTemplate(first, values)
  const key = templateKey(first)
  const tables = currentTables()
  const english = values.length === 0 ? tables.exact.get(key) : tables.templates.get(key)
  if (english === undefined) {
    recordMiss('t', key)
    return wrapHit(germanTemplate(first, values))
  }
  return hit('t', fillValue(english, values.map((value) => (typeof value === 'number' ? formatNumber(value) : value))))
}

/** Homonyms in the UI: `tc('quality', 'Hoch')`; the catalog key is `Hoch|quality`. */
export function tc(context: string, text: string): string {
  if (getLocale() === 'de') return text
  const key = `${text}|${context}`
  const english = currentTables().exact.get(key)
  if (english !== undefined) return hit('t', english)
  recordMiss('t', key)
  return wrapHit(text)
}

function formatSlot(type: SlotType | null, captured: string): string | undefined {
  switch (type) {
    case 'n': {
      const parsed = parseGermanNumber(captured)
      return parsed.pureDigits ? captured : formatNumber(parsed.value, parsed.fractionDigits)
    }
    case 'm': {
      const parsed = parseGermanNumber(captured)
      return formatMoney(parsed.value, parsed.fractionDigits)
    }
    case 'name':
      return englishName(captured)
    case 'list':
      return captured.split(', ').map(englishName).join(', ')
    case 't':
      return lookup(captured) ?? undefined
    default:
      return captured
  }
}

/** Formats every group by its type; a `t` group that misses rejects the candidate. */
function tryPattern(pattern: CompiledPattern, text: string): string | null {
  const match = execPattern(pattern, text)
  if (!match) return null
  const values: string[] = []
  for (let position = 0; position < pattern.slots.length; position++) {
    const slot = pattern.slots[position]!
    const formatted = formatSlot(slot.type, match[position + 1]!)
    if (formatted === undefined) return null
    values[slot.index] = formatted
  }
  return fillValue(pattern.value, values)
}

function matchPatterns(text: string): string | null {
  const caches = currentCaches()
  const skeleton = caches.enabled ? skeletonOf(text) : null
  const candidates = candidatesFor(currentTables().patterns, text)
  const hint = skeleton === null ? undefined : caches.hints.get(skeleton)
  if (hint) {
    // Texts that share a skeleton differ only in digit values, so a higher-ranked
    // candidate can only decide differently if its match depends on digit values.
    for (const candidate of candidates) {
      if (candidate.rank >= hint.rank) break
      if (!candidate.digitSensitive) continue
      const result = tryPattern(candidate, text)
      if (result !== null) return result
    }
    const result = tryPattern(hint, text)
    if (result !== null) return result
  }
  for (const candidate of candidates) {
    const result = tryPattern(candidate, text)
    if (result === null) continue
    if (skeleton !== null) caches.hints.set(skeleton, candidate)
    return result
  }
  return null
}

/** English for canonical German text, or null when the catalog does not know it. */
function lookup(text: string, context?: string): string | null {
  if (text === '') return text
  const tables = currentTables()
  if (context !== undefined) {
    const contextual = tables.exact.get(`${text}|${context}`)
    if (contextual !== undefined) return contextual
  }
  const exact = tables.exact.get(text)
  if (exact !== undefined) return exact
  const caches = currentCaches()
  if (caches.enabled) {
    const cached = caches.results.get(text)
    if (cached !== undefined) return cached
  }
  const result = matchPatterns(text)
  if (caches.enabled) caches.results.set(text, result)
  return result
}

/**
 * Game text in the viewer's language: thoughts, statuses, command results, server
 * messages. Unknown text (band names, user text, newer hosts) comes back unchanged.
 * Idempotent, so display sinks may call it on text that is already English.
 */
export function localize(text: string, context?: string): string {
  const locale = getLocale()
  if (locale === 'de' || text === '') return text
  if (locale === 'qps' && isWrapped(text)) return text
  const english = lookup(text, context)
  if (english !== null) return hit('localize', english)
  recordMiss('localize', text)
  return wrapMiss(text)
}

/** Like `localize`, but undefined on a miss (coverage tests and nested `t` slots). */
export function localizeHit(text: string): string | undefined {
  if (getLocale() === 'de') return text
  return lookup(text) ?? undefined
}

function englishNameOrNull(text: string): string | null {
  const tables = currentTables()
  const exact = tables.exact.get(text)
  if (exact !== undefined) return exact
  const numbered = /^(.*\S) (\d+)$/.exec(text)
  if (numbered) {
    const base = tables.names.get(numbered[1]!) ?? matchNamePatterns(numbered[1]!)
    if (base !== null) return `${base} ${numbered[2]}`
  }
  return matchNamePatterns(text)
}

/** Name templates through the same bucket index as sentence patterns, in rank order. */
function matchNamePatterns(text: string): string | null {
  for (const pattern of candidatesFor(currentTables().namePatterns, text)) {
    const result = tryPattern(pattern, text)
    if (result !== null) return result
  }
  return null
}

function englishName(text: string): string {
  return englishNameOrNull(text) ?? text
}

/**
 * Entity names: catalog labels ("Holzachterbahn"), numbered defaults ("Sanitäter 3" →
 * "Medic 3", only for bases registered in a `names` export) and name templates. Band
 * names, first names and names the player typed come back unchanged.
 */
export function localizeName(text: string): string {
  const locale = getLocale()
  if (locale === 'de') return text
  if (locale === 'qps' && isWrapped(text)) return text
  const english = englishNameOrNull(text)
  if (english !== null) return hit('name', english)
  recordMiss('name', text)
  return wrapMiss(text)
}
