/**
 * The locale of this page load and the tables compiled from the English catalog.
 * Set once by src/boot.ts before the game loads (and by tests); everything else only
 * reads it. Changing the locale drops every cache, so nothing computed for one
 * language survives into the other.
 */
import type { Locale } from './locale'
import {
  buildPatternIndex,
  compilePattern,
  hasPlaceholder,
  isTypedKey,
  type CompiledPattern,
  type PatternIndex,
} from './pattern'

/** English catalog: all areas merged (src/i18n/en/index.ts). */
export type EnglishCatalog = {
  /** Every key of every area (`text` and `names` exports). */
  text: Record<string, string>
  /** Entity default-name vocabulary: ordinal bases and name templates. */
  names: Record<string, string>
}

export type Tables = {
  /** Placeholder-free keys, including `text|context` keys. */
  exact: Map<string, string>
  /** UI `t` templates with bare `{i}` placeholders. */
  templates: Map<string, string>
  /** Typed `de` keys, bucketed. */
  patterns: PatternIndex
  /** Placeholder-free name bases for the ordinal rule. */
  names: Map<string, string>
  /** Typed keys of the `names` exports, in rank order. */
  namePatterns: PatternIndex
}

const GENERATION_SIZE = 2048

/** Two generations of 2,048 entries: a hit in `old` moves to `young`; a full `young` becomes `old`. */
export class TwoGenerationCache<T extends NonNullable<unknown> | null> {
  private young = new Map<string, T>()
  private old = new Map<string, T>()
  private readonly size: number
  constructor(size = GENERATION_SIZE) {
    this.size = size
  }
  /** Undefined means not cached; a cached null is a remembered miss. */
  get(key: string): T | undefined {
    const fresh = this.young.get(key)
    if (fresh !== undefined) return fresh
    const aged = this.old.get(key)
    if (aged === undefined) return undefined
    this.old.delete(key)
    this.set(key, aged)
    return aged
  }
  set(key: string, value: T): void {
    this.young.set(key, value)
    if (this.young.size >= this.size) {
      this.old = this.young
      this.young = new Map()
    }
  }
  get entries(): number {
    return this.young.size + this.old.size
  }
}

export type Caches = {
  /** `localize` results; null marks a miss. */
  results: TwoGenerationCache<string | null>
  /** Digit skeleton → the pattern that matched it last (positive hints only). */
  hints: TwoGenerationCache<CompiledPattern>
  /** Catalog key per tagged `t` call site. */
  templateKeys: WeakMap<TemplateStringsArray, string>
  enabled: boolean
}

const EMPTY_CATALOG: EnglishCatalog = { text: {}, names: {} }
const compiled = new WeakMap<EnglishCatalog, Tables>()

function compileTables(catalog: EnglishCatalog): Tables {
  const exact = new Map<string, string>()
  const templates = new Map<string, string>()
  const patterns: CompiledPattern[] = []
  for (const [key, value] of Object.entries(catalog.text)) {
    if (!hasPlaceholder(key)) exact.set(key, value)
    else if (!isTypedKey(key)) templates.set(key, value)
    else {
      const pattern = compilePattern(key, value)
      if (pattern) patterns.push(pattern)
    }
  }
  const names = new Map<string, string>()
  const namePatterns: CompiledPattern[] = []
  for (const [key, value] of Object.entries(catalog.names)) {
    if (!hasPlaceholder(key)) names.set(key, value)
    else {
      const pattern = compilePattern(key, value)
      if (pattern) namePatterns.push(pattern)
    }
  }
  return { exact, templates, patterns: buildPatternIndex(patterns), names, namePatterns: buildPatternIndex(namePatterns) }
}

function freshCaches(enabled: boolean): Caches {
  return { results: new TwoGenerationCache(), hints: new TwoGenerationCache(), templateKeys: new WeakMap(), enabled }
}

let locale: Locale = 'de'
let tables: Tables = compileTables(EMPTY_CATALOG)
let caches: Caches = freshCaches(true)
let collatorCache: Intl.Collator | null = null

/**
 * Installs the locale for this page load. Called by src/boot.ts before `main` is
 * imported, and by tests (I18N-A6). German needs no catalog.
 */
export function setLocale(next: Locale, catalog?: EnglishCatalog): void {
  locale = next
  const source = next === 'de' ? EMPTY_CATALOG : catalog ?? EMPTY_CATALOG
  let table = compiled.get(source)
  if (!table) {
    table = compileTables(source)
    compiled.set(source, table)
  }
  tables = table
  caches = freshCaches(caches.enabled)
  collatorCache = null
}

export function getLocale(): Locale {
  return locale
}

/** BCP 47 tag for Intl formatting; the pseudo-locale formats like English. */
export function localeTag(): 'de-DE' | 'en-GB' {
  return locale === 'de' ? 'de-DE' : 'en-GB'
}

/** Sorting in the viewer's language (cached per locale). */
export function collator(): Intl.Collator {
  collatorCache ??= new Intl.Collator(localeTag())
  return collatorCache
}

export function currentTables(): Tables {
  return tables
}

export function currentCaches(): Caches {
  return caches
}

/** Which lookup ran: a UI key (`t`/`tc`), game text (`localize`) or a name (`localizeName`). */
export type TextKind = 't' | 'localize' | 'name'
/** A hit reports the English result; a miss reports the German key or text shown instead. */
export type TextRecorder = (kind: TextKind, text: string, hit: boolean) => void

let textRecorder: TextRecorder | null = null

/** Test hook (tests/i18nCoverage.ts): sees every lookup while installed; null removes it. */
export function setTextRecorder(recorder: TextRecorder | null): void {
  textRecorder = recorder
}

export function currentTextRecorder(): TextRecorder | null {
  return textRecorder
}

/** Tests compare cold, uncached lookups with cached ones; also resets every cache. */
export function setI18nCaching(enabled: boolean): void {
  caches = freshCaches(enabled)
}
