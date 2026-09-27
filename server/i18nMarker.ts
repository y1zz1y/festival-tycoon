/**
 * Marker for canonical German text (C10 text layer, docs/i18n.md).
 *
 * Authoritative code — the simulation in src/game, src/net and the server — never
 * translates. It writes German through these markers so the text can be extracted into
 * the catalog and, on an English client, matched back at display time. Every function
 * returns exactly what the unmarked code produced before, and none of them reads the
 * viewer's language.
 *
 * Dependency-free on purpose: the Docker image ships only server/ and dist/, so the
 * server imports this file directly and src re-exports it (src/i18n/marker.ts).
 */

declare const slotBrand: unique symbol
/** Only the wrappers below produce a Slot; a `de` placeholder accepts nothing else (tsc enforces it). */
export type Slot = string & { readonly [slotBrand]: true }

/** Canonical German text. The plain form returns its argument (the literal type is kept for `as const` tables). */
export function de<const T extends string>(text: T): T
/** Tagged form: returns exactly what the untagged template literal would (cooked parts + slots). */
export function de(strings: TemplateStringsArray, ...slots: Slot[]): string
export function de(first: string | TemplateStringsArray, ...slots: Slot[]): string {
  if (typeof first === 'string') return first
  let out = first[0]!
  for (let index = 0; index < slots.length; index++) out += slots[index]! + first[index + 1]!
  return out
}

/** Homonym escape for game text: returns `text`; the catalog key is `${text}|${context}`. */
export function dc<const T extends string>(context: string, text: T): T {
  void context
  return text
}

const integerFormats = new Map<number | undefined, Intl.NumberFormat>()

function germanFormat(fractionDigits: number | undefined): Intl.NumberFormat {
  let format = integerFormats.get(fractionDigits)
  if (!format) {
    format = new Intl.NumberFormat('de-DE', fractionDigits === undefined
      ? { maximumFractionDigits: 2 }
      : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
    integerFormats.set(fractionDigits, format)
  }
  return format
}

/**
 * A quantity in German notation (`1.234`, `0,4`, `-12.500`). With `fractionDigits`
 * exactly that many decimals; without, integers get none and fractions up to two.
 */
export function num(value: number, fractionDigits?: number): Slot {
  if (Number.isInteger(value) && Math.abs(value) < 1000 && !fractionDigits) return String(value) as Slot
  return germanFormat(fractionDigits).format(value) as Slot
}

/** Money: `1.250 €`, `2,50 €`, `-12.500 €` (plain space, not Intl's currency style). */
export function eur(value: number): Slot {
  return `${num(value, Number.isInteger(value) ? 0 : 2)} €` as Slot
}

const pad2 = (value: number): string => String(value).padStart(2, '0')

/** Clock from a minute of the day: `08:05`. Does not wrap at 24 hours. */
export function hhmm(minuteOfDay: number): Slot {
  return `${pad2(Math.floor(minuteOfDay / 60))}:${pad2(Math.floor(minuteOfDay % 60))}` as Slot
}

/** User content and proper nouns: shown as they are, never translated. */
export function verbatim(text: string): Slot {
  return text as Slot
}

/** An entity name that may be a game default ("Holzachterbahn 2"); localized with localizeName. */
export function named(text: string): Slot {
  return text as Slot
}

/** Items joined with `, ` (items must not contain `, `); each item is localized as a name. */
export function listOf(items: readonly string[]): Slot {
  return items.join(', ') as Slot
}

/** A complete canonical sentence produced by another `de` (a reason, an issue). */
export function nested(text: string): Slot {
  return text as Slot
}

/** Integer counts only; German and English both: count === 1 → one, else other. */
export function plural(count: number, one: string, other: string): string {
  return count === 1 ? one : other
}

/** Default entity names `${base} ${index}`; localizeName reverses it for registered bases. */
export function numberedName(base: string, index: number | string): string {
  return `${base} ${index}`
}

/** Proper nouns, endonyms and ids that look like prose: identity; the checker skips the subtree. */
export function keep<T>(value: T): T {
  return value
}
