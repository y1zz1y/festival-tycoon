/**
 * Pattern side of the text layer: parsing catalog keys, compiling typed keys to anchored
 * regexes and indexing them in prefix/suffix buckets. Pure — no locale state, no DOM.
 * scripts/check-i18n.mjs imports this file too (C8 bucket size, B9 index rule), so the
 * checker and the runtime can never disagree about buckets.
 *
 * Node loads this file directly (type stripping, `node --experimental-strip-types`), so it
 * MUST stay import-free and use erasable TypeScript only: no imports (an extensionless
 * one would break the checker), no enums, namespaces or parameter properties.
 */

export type SlotType = 'n' | 'm' | 'time' | 'raw' | 'name' | 'list' | 't'
export const SLOT_TYPES: readonly SlotType[] = ['n', 'm', 'time', 'raw', 'name', 'list', 't']
/** Types whose regex only accepts numbers or clocks; they rank a key higher. */
export const RESTRICTIVE_TYPES: ReadonlySet<SlotType> = new Set<SlotType>(['n', 'm', 'time'])

export type KeySlot = { index: number; type: SlotType | null }
export type ParsedKey = {
  /** Literal text around the placeholders; always `slots.length + 1` entries. */
  literals: string[]
  slots: KeySlot[]
}

export type BucketKind = 'p6' | 's6' | 'p3' | 's3'
export type Bucket = { kind: BucketKind; text: string }

export type CompiledPattern = {
  key: string
  /** English value with bare `{i}` placeholders. */
  value: string
  re: RegExp
  slots: KeySlot[]
  letters: number
  restrictive: number
  bucket: Bucket
  /** Literal digits or a `t` slot: the match can depend on digit values, not just positions. */
  digitSensitive: boolean
  /** Position in the global rank order; lower ranks are tried first. */
  rank: number
}

export type PatternIndex = {
  buckets: Record<BucketKind, Map<string, CompiledPattern[]>>
  all: CompiledPattern[]
}

/** Test-only work counter: every regex execution against a text. */
export const patternWork = { execs: 0 }

const PLACEHOLDER = /\{(\d+)(?::([a-z]+))?\}/g
const LETTER = /\p{L}/gu

export function parseKey(key: string): ParsedKey {
  const literals: string[] = []
  const slots: KeySlot[] = []
  let last = 0
  for (const match of key.matchAll(PLACEHOLDER)) {
    literals.push(key.slice(last, match.index))
    const type = match[2] as SlotType | undefined
    slots.push({ index: Number(match[1]), type: type && SLOT_TYPES.includes(type) ? type : null })
    last = match.index + match[0].length
  }
  literals.push(key.slice(last))
  return { literals, slots }
}

export function hasPlaceholder(key: string): boolean {
  return /\{\d+(?::[a-z]+)?\}/.test(key)
}

/** Typed keys come only from `de` templates; only they become patterns. */
export function isTypedKey(key: string): boolean {
  return /\{\d+:[a-z]+\}/.test(key)
}

export function letterCount(text: string): number {
  return text.match(LETTER)?.length ?? 0
}

/**
 * The one bucket a key lives in: its literal prefix (6 chars) when that is long enough,
 * else its literal suffix (6), else prefix (3), else suffix (3). A trailing money slot
 * contributes no literal characters. Null means the key cannot be indexed (I18N-B9).
 */
export function bucketOf(parsed: ParsedKey): Bucket | null {
  const prefix = parsed.literals[0] ?? ''
  const suffix = parsed.literals[parsed.literals.length - 1] ?? ''
  if (prefix.length >= 6) return { kind: 'p6', text: prefix.slice(0, 6) }
  if (suffix.length >= 6) return { kind: 's6', text: suffix.slice(-6) }
  if (prefix.length >= 3) return { kind: 'p3', text: prefix.slice(0, 3) }
  if (suffix.length >= 3) return { kind: 's3', text: suffix.slice(-3) }
  return null
}

/** The bucket strings a text is looked up under, one per bucket kind. */
export function bucketKeysOf(text: string): Record<BucketKind, string> {
  return { p6: text.slice(0, 6), s6: text.slice(-6), p3: text.slice(0, 3), s3: text.slice(-3) }
}

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** German number as the `num` wrapper writes it: `7`, `-12.500`, `1.234,5`, `007`. */
export const GERMAN_NUMBER = '[-−]?(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d+)?'

const SLOT_REGEX: Record<SlotType, string> = {
  n: `(${GERMAN_NUMBER})`,
  m: `(${GERMAN_NUMBER}) €`,
  // Everything hhmm can write: two-digit padding without a wrap at 24 hours (`100:00`),
  // and a negative minute gives `-1:-5`.
  time: '((?:\\d{2,}|-\\d+):(?:\\d{2}|-\\d{1,2}))',
  raw: '(.+?)',
  name: '(.+?)',
  list: '(.+?)',
  t: '(.+?)',
}

/** Compiles a typed key; untyped slots (never produced by `de`) count as `raw`. */
export function compilePattern(key: string, value: string): CompiledPattern | null {
  const parsed = parseKey(key)
  const bucket = bucketOf(parsed)
  if (!bucket || parsed.slots.length === 0) return null
  let source = '^' + escapeRegex(parsed.literals[0]!)
  parsed.slots.forEach((slot, position) => {
    source += SLOT_REGEX[slot.type ?? 'raw'] + escapeRegex(parsed.literals[position + 1]!)
  })
  const literalText = parsed.literals.join('')
  return {
    key,
    value,
    re: new RegExp(source + '$', 's'),
    slots: parsed.slots,
    letters: letterCount(literalText),
    restrictive: parsed.slots.filter((slot) => slot.type && RESTRICTIVE_TYPES.has(slot.type)).length,
    bucket,
    digitSensitive: /\d/.test(literalText) || parsed.slots.some((slot) => slot.type === 't'),
    rank: 0,
  }
}

/** More literal letters first, then more restrictive slots, then the key (deterministic). */
export function compareRank(a: CompiledPattern, b: CompiledPattern): number {
  if (a.letters !== b.letters) return b.letters - a.letters
  if (a.restrictive !== b.restrictive) return b.restrictive - a.restrictive
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
}

export function buildPatternIndex(patterns: CompiledPattern[]): PatternIndex {
  const all = [...patterns].sort(compareRank)
  all.forEach((pattern, rank) => { pattern.rank = rank })
  const buckets: PatternIndex['buckets'] = { p6: new Map(), s6: new Map(), p3: new Map(), s3: new Map() }
  for (const pattern of all) {
    const list = buckets[pattern.bucket.kind].get(pattern.bucket.text)
    if (list) list.push(pattern)
    else buckets[pattern.bucket.kind].set(pattern.bucket.text, [pattern])
  }
  return { buckets, all }
}

/** Every pattern that can match `text`, in rank order. Complete: a match shares its key's bucket. */
export function candidatesFor(index: PatternIndex, text: string): CompiledPattern[] {
  const keys = bucketKeysOf(text)
  const found: CompiledPattern[] = []
  for (const kind of ['p6', 's6', 'p3', 's3'] as const) {
    const list = index.buckets[kind].get(keys[kind])
    if (list) found.push(...list)
  }
  return found.length > 1 ? found.sort((a, b) => a.rank - b.rank) : found
}

/** The largest bucket; the checker caps it (I18N-C8) so a cold lookup stays bounded. */
export function largestBucket(index: PatternIndex): { kind: BucketKind; text: string; size: number } | null {
  let best: { kind: BucketKind; text: string; size: number } | null = null
  for (const kind of ['p6', 's6', 'p3', 's3'] as const) {
    for (const [text, list] of index.buckets[kind]) {
      if (!best || list.length > best.size) best = { kind, text, size: list.length }
    }
  }
  return best
}

export function execPattern(pattern: CompiledPattern, text: string): RegExpExecArray | null {
  patternWork.execs++
  return pattern.re.exec(text)
}

/** Parses a German-notation number; `pureDigits` marks runs such as `007` that stay verbatim. */
export function parseGermanNumber(text: string): { value: number; fractionDigits: number; pureDigits: boolean } {
  const negative = /^[-−]/.test(text)
  const body = negative ? text.slice(1) : text
  const [whole = '', fraction = ''] = body.split(',')
  const value = Number(`${whole.replace(/\./g, '')}${fraction ? `.${fraction}` : ''}`)
  return { value: negative ? -value : value, fractionDigits: fraction.length, pureDigits: /^\d+$/.test(text) }
}

/** Substitutes bare `{i}` placeholders of an English value. */
export function fillValue(value: string, values: readonly (string | undefined)[]): string {
  return value.replace(/\{(\d+)\}/g, (whole, index: string) => values[Number(index)] ?? whole)
}

/**
 * The digit skeleton of a text for the positive match hint. Digits become U+0001, which
 * never appears in game text, so two texts share a skeleton only when they differ in
 * digit values alone. Null when the text already holds that character.
 */
export function skeletonOf(text: string): string | null {
  return text.includes('\u0001') ? null : text.replace(/\d/g, '\u0001')
}
