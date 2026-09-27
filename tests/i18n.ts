import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_PLAYER_SETTINGS, LANGUAGE_OPTIONS, normalizePlayerSettings } from '../src/app/playerSettings'
import { BANDS } from '../src/game/festivalManagement'
import { AREA_REFERENCE_FORBIDDEN, COMMAND_QUEUED, NOTHING_TO_DEMOLISH } from '../src/game/sentinels'
import {
  codeTag,
  collator,
  de,
  eur,
  escapeHtml,
  formatMoney,
  formatNumber,
  formatPercent,
  formatRange,
  formatSaveTime,
  formatTemperature,
  formatTime,
  getLocale,
  hhmm,
  joinList,
  joinParts,
  kbd,
  keep,
  listOf,
  localeTag,
  localize,
  localizeHit,
  localizeName,
  named,
  nested,
  num,
  numberedName,
  plural,
  setLocale,
  t,
  tc,
  tip,
  verbatim,
  type EnglishCatalog,
} from '../src/i18n'
import { EN } from '../src/i18n/en'
import { detectLocale, normalizeLanguageSetting, PLAYER_SETTINGS_KEY, readLanguageSetting, resolveLocale, type LanguageSetting, type LocaleEnvironment } from '../src/i18n/locale'
import { candidatesFor, execPattern, isTypedKey, parseKey, patternWork, type CompiledPattern, type SlotType } from '../src/i18n/pattern'
import { currentCaches, currentTables, setI18nCaching, setTextRecorder, type TextKind } from '../src/i18n/state'
import { isInMultiplayerRoom, planLanguageChange, switchLanguage, type LanguageSwitchPorts } from '../src/ui/playerSettingsPanel'
import { setUnsavedWarnings, shouldPromptBeforeUnload, suppressBeforeUnloadOnce, trackUnsavedWork } from '../src/ui/unsavedWork'

/**
 * A synthetic catalog that exercises every placeholder type, the ranks, context keys,
 * UI templates and the ordinal name rule. The real catalog (EN) runs through the same
 * generic checks below and grows as the conversion groups land.
 */
const ENGINE_NAMES: Record<string, string> = {
  'Holzachterbahn': 'Wooden coaster',
  'Sanitäter': 'Medic',
  'Haltestelle': 'Bus stop',
  '{0:name} Rutsche': '{0} slide',
}
const ENGINE: EnglishCatalog = {
  text: {
    'Ich warte bei {0:name}.': 'I’m waiting at {0}.',
    'Beschlagnahmt: {0:list}.': 'Confiscated: {0}.',
    'Nicht genug Geld ({0:m})': 'Not enough money ({0})',
    '{0:m} aufgenommen, {1:n} % Zinsen pro Tag': 'Borrowed {0}, {1}% interest per day',
    'Tagesgäste dürfen von {0:time} bis {1:time} bleiben.': 'Day visitors may stay from {0} to {1}.',
    'Spielstand „{0:raw}“ gespeichert': 'Game “{0}” saved',
    'Grund: {0:t}': 'Reason: {0}',
    'Budget erschöpft': 'Budget exhausted',
    'Tag {0:n}': 'Day {0}',
    '{0:n} Besucher sind da': '{0} visitors are here',
    'Ein Besucher ist da': 'One visitor is here',
    'Preis auf {0:m} gesetzt.': 'Price set to {0}.',
    '{0:name} spielen live – gute Stimmung!': '{0} are playing live – great mood!',
    'Von {0:raw} nach {1:name} umgezogen': 'Moved from {0} to {1}',
    'Abbrechen': 'Cancel',
    'Speichern': 'Save',
    'Hoch|quality': 'High',
    'Hoch|slope': 'Up',
    '{0} Besucher': '{0} visitors',
    'Seite {0} von {1}': 'Page {0} of {1}',
    ...ENGINE_NAMES,
  },
  names: ENGINE_NAMES,
}

/** Runs `body` in another locale and always returns to German (the Node default). */
function inLocale(locale: 'en' | 'qps', catalog: EnglishCatalog, body: () => void): void {
  setLocale(locale, catalog)
  try {
    body()
  } finally {
    setLocale('de')
  }
}

const NUMBER_SAMPLES: readonly [string, string][] = [['0', '0'], ['7', '7'], ['-12.500', '-12,500'], ['1.234,5', '1,234.5'], ['12.345.678', '12,345,678']]
const MONEY_SAMPLES: readonly [string, string][] = [['0 €', '€0'], ['2,50 €', '€2.50'], ['1.250 €', '€1,250'], ['-12.500 €', '-€12,500']]
// hhmm pads without wrapping at 24 hours, and a negative minute gives `-1:-5`.
const TIME_SAMPLES: readonly [string, string][] = [['08:05', '08:05'], ['100:00', '100:00'], ['-1:-5', '-1:-5']]
const FREE_SAMPLES = ['Tag 3', 'A, B', 'x · y', 'Nova – Canopy', '12.345', 'Budget erschöpft', 'Holzachterbahn 2', 'Sanitäter 007', 'Pixel Harvest']
const LIST_SAMPLES = ['Zelt, Alkohol', 'Bier']
const SEPARATORS = ['.', ', ', ' · ', '–']

type RoundTrip = { key: string; german: string; english: string }

/** German samples per slot type with their expected English (computed in the English locale). */
function samplesFor(type: SlotType, key: string, nestedSamples: readonly string[]): [string, string][] {
  switch (type) {
    case 'n': return [...NUMBER_SAMPLES]
    case 'm': return [...MONEY_SAMPLES]
    case 'time': return [...TIME_SAMPLES]
    case 'raw':
    case 'name': {
      const own = SEPARATORS.filter((separator) => parseKey(key).literals.some((literal) => literal.includes(separator))).map((separator) => `A${separator}B`)
      return [...FREE_SAMPLES, ...own].map((sample) => [sample, type === 'raw' ? sample : localizeName(sample)])
    }
    case 'list': return LIST_SAMPLES.map((sample) => [sample, sample.split(', ').map(localizeName).join(', ')])
    case 't': return nestedSamples.map((sample) => [sample, localizeHit(sample)!])
  }
}

/** Every typed key rendered with hostile samples, one slot varied at a time. English locale only. */
function roundTripCorpus(catalog: EnglishCatalog): RoundTrip[] {
  const typedKeys = Object.keys(catalog.text).filter(isTypedKey)
  const exactKey = Object.keys(catalog.text).find((key) => !key.includes('{') && !key.includes('|'))
  const nestedSamples: string[] = exactKey ? [exactKey] : []
  const corpus: RoundTrip[] = []
  const render = (key: string, chosen: (index: number) => [string, string]): RoundTrip => {
    const parsed = parseKey(key)
    let german = parsed.literals[0]!
    const english: string[] = []
    parsed.slots.forEach((slot, position) => {
      const [de, en] = chosen(position)
      german += de + parsed.literals[position + 1]!
      english[slot.index] = en
    })
    return { key, german, english: catalog.text[key]!.replace(/\{(\d+)\}/g, (_, index: string) => english[Number(index)]!) }
  }
  // A pattern hit for `t` slots: the first typed key without a `t` slot, with default samples.
  const plainTyped = typedKeys.find((key) => parseKey(key).slots.every((slot) => slot.type !== 't'))
  if (plainTyped) nestedSamples.push(render(plainTyped, (position) => samplesFor(parseKey(plainTyped).slots[position]!.type!, plainTyped, [])[0]!).german)
  for (const key of typedKeys) {
    const slots = parseKey(key).slots
    const perSlot = slots.map((slot) => samplesFor(slot.type!, key, nestedSamples))
    slots.forEach((_, varied) => {
      for (const sample of perSlot[varied]!) {
        corpus.push(render(key, (position) => (position === varied ? sample : perSlot[position]![0]!)))
      }
    })
  }
  return corpus
}

/** A pattern accepts a text when its regex matches and every nested `t` slot hits. */
function accepts(pattern: CompiledPattern, text: string): boolean {
  const match = execPattern(pattern, text)
  if (!match) return false
  return pattern.slots.every((slot, position) => slot.type !== 't' || localizeHit(match[position + 1]!) !== undefined)
}

function checkCatalogEngine(label: string, catalog: EnglishCatalog): void {
  inLocale('en', catalog, () => {
    const corpus = roundTripCorpus(catalog)
    // 4. Round trip: German with hostile samples comes back as the English value.
    for (const { key, german, english } of corpus) {
      assert.equal(localize(german), english, `${label}: round trip of ${JSON.stringify(key)} for ${JSON.stringify(german)}`)
    }
    // 5. Rank safety: no key tried before the right one accepts the sample.
    const index = currentTables().patterns
    for (const { key, german } of corpus) {
      const own = index.all.find((pattern) => pattern.key === key)!
      for (const candidate of candidatesFor(index, german)) {
        if (candidate.rank >= own.rank) break
        assert.equal(accepts(candidate, german), false, `${label}: ${JSON.stringify(candidate.key)} outranks ${JSON.stringify(key)} on ${JSON.stringify(german)}`)
      }
    }
    // 6. Idempotence: English output and English exact values stay as they are.
    for (const { english } of corpus) {
      assert.equal(localize(english), english, `${label}: localize is idempotent on ${JSON.stringify(english)}`)
      assert.equal(localizeName(english), english, `${label}: localizeName is idempotent on ${JSON.stringify(english)}`)
    }
    for (const [key, value] of Object.entries(catalog.text)) {
      if (key.includes('{')) continue
      assert.equal(localize(value), value, `${label}: exact value ${JSON.stringify(value)} is stable`)
      if (key in catalog.names || !key.includes('|')) assert.equal(localizeName(value), value, `${label}: name value ${JSON.stringify(value)} is stable`)
    }
    // 8. Work bound: cold lookups stay cheap; cached and uncached results agree.
    setI18nCaching(false)
    const cold: string[] = []
    let total = 0
    let worst = 0
    for (const { german } of corpus) {
      patternWork.execs = 0
      cold.push(localize(german))
      total += patternWork.execs
      worst = Math.max(worst, patternWork.execs)
    }
    setI18nCaching(true)
    if (corpus.length) {
      assert.ok(total / corpus.length <= 8, `${label}: ${(total / corpus.length).toFixed(2)} regex executions per cold lookup`)
      assert.ok(worst <= 40, `${label}: worst cold lookup ran ${worst} regexes`)
    }
    assert.deepEqual(corpus.map(({ german }) => localize(german)), cold, `${label}: cached results equal uncached ones`)
    assert.deepEqual(corpus.map(({ german }) => localize(german)), cold, `${label}: warm results equal uncached ones`)
  })
}

export function testI18n(): void {
  // 1. Node runs German; nothing survives a locale change.
  assert.equal(getLocale(), 'de')
  assert.equal(detectLocale(), 'de', 'no window/document: German, even though Node has a navigator')
  assert.equal(localeTag(), 'de-DE')
  assert.equal(readFileSync('src/i18n/index.ts', 'utf8').includes("from './en"), false, 'the runtime never imports the English catalog')

  // Markers: exactly what the untagged code produced.
  assert.equal(de('Befehl eingeplant'), 'Befehl eingeplant')
  assert.equal(de`Ich warte bei ${named('Holzachterbahn 2')}.`, 'Ich warte bei Holzachterbahn 2.')
  assert.equal(de`${eur(1250)} für ${num(12)} Felder, bis ${hhmm(485)}: ${verbatim('Tag 3')}, ${listOf(['Zelt', 'Bier'])}, ${nested('Budget erschöpft')}`,
    '1.250 € für 12 Felder, bis 08:05: Tag 3, Zelt, Bier, Budget erschöpft')
  assert.equal(numberedName('Sanitäter', 3), 'Sanitäter 3')
  assert.equal(keep('Rock am Ring'), 'Rock am Ring')
  assert.equal(plural(1, 'ein Gast', 'Gäste'), 'ein Gast')
  assert.equal(plural(0, 'ein Gast', 'Gäste'), 'Gäste', 'zero uses the other form')

  // 2. Formatters: German equals the formats the game always showed.
  const legacyMoney = (value: number): string => `${Math.floor(value).toLocaleString('de-DE')} €`
  for (const value of [0, 7, 999, 1000, 1234.7, -500, -12500.2, 250000]) assert.equal(formatMoney(value), legacyMoney(value), `German money ${value}`)
  assert.equal(formatMoney(2.5, 2), '2,50 €')
  assert.equal(formatNumber(1234), '1.234')
  assert.equal(formatNumber(0.4), '0,4')
  assert.equal(formatNumber(-12500), '-12.500')
  assert.equal(formatNumber(5, 2), '5,00')
  assert.equal(formatPercent(88), '88 %')
  assert.equal(formatTemperature(23), '23 °C')
  assert.equal(formatTime(485), '08:05')
  assert.equal(formatRange(8, 22), '8–22')
  assert.equal(joinParts('Bühne', false, null, 'Schutz angeordnet'), 'Bühne · Schutz angeordnet')
  assert.equal(joinList(['Zelt', 'Alkohol']), 'Zelt, Alkohol')
  const savedAt = Date.UTC(2026, 8, 27, 14, 5)
  assert.equal(formatSaveTime(savedAt), new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(savedAt))
  assert.equal(num(1234), '1.234')
  assert.equal(num(0.4), '0,4')
  assert.equal(num(-12500), '-12.500')
  assert.equal(num(1234.5, 1), '1.234,5')
  assert.equal(eur(1250), '1.250 €')
  assert.equal(eur(2.5), '2,50 €')
  assert.equal(eur(-12500), '-12.500 €')
  assert.equal(hhmm(485), '08:05')
  assert.equal(hhmm(1500), '25:00', 'the clock does not wrap at 24 hours')
  assert.equal(hhmm(6000), '100:00')
  assert.equal(hhmm(-5), '-1:-5')
  assert.equal(escapeHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;')
  assert.equal(kbd('R'), '<kbd>R</kbd>')
  assert.equal(codeTag('public/<x>'), '<code>public/&lt;x&gt;</code>')
  assert.equal(tip('A "B"'), 'title="A &quot;B&quot;" aria-label="A &quot;B&quot;"')
  inLocale('en', ENGINE, () => {
    assert.equal(localeTag(), 'en-GB')
    assert.equal(formatNumber(1234), '1,234')
    assert.equal(formatNumber(0.4), '0.4')
    assert.equal(formatMoney(1234.7), '€1,234', 'whole euros are floored in English too')
    assert.equal(formatMoney(-500), '-€500')
    assert.equal(formatMoney(0), '€0')
    assert.equal(formatMoney(2.5, 2), '€2.50')
    assert.equal(formatPercent(88), '88%')
    assert.equal(formatSaveTime(savedAt), new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'short' }).format(savedAt))
    assert.equal(num(1234), '1.234', 'the markers stay German in every locale')
    assert.equal(eur(2.5), '2,50 €')
    assert.ok(collator().compare('Äpfel', 'Zelt') < 0, 'the collator sorts umlauts with their base letter')
  })

  // 3. t, tc and plural.
  const visitors = (count: number): string => t`${count} Besucher`
  assert.equal(t('Abbrechen'), 'Abbrechen')
  assert.equal(visitors(1234), '1.234 Besucher')
  assert.equal(tc('quality', 'Hoch'), 'Hoch')
  inLocale('en', ENGINE, () => {
    assert.equal(t('Abbrechen'), 'Cancel')
    assert.equal(visitors(1234), '1,234 visitors', 'tagged lookup formats numbers in English')
    assert.equal(t`Seite ${2} von ${'drei'}`, 'Page 2 of drei', 'strings are inserted verbatim')
    assert.equal(t('Unbekannter Text'), 'Unbekannter Text', 'a miss falls back to German')
    assert.equal(t`${1234} Unbekannte`, '1.234 Unbekannte', 'a template miss falls back to the German result')
    assert.equal(tc('quality', 'Hoch'), 'High')
    assert.equal(tc('slope', 'Hoch'), 'Up')
    assert.equal(tc('size', 'Speichern'), 'Speichern', 'context keys never fall back to the plain key')
    assert.equal(plural(1, t('Abbrechen'), t('Speichern')), 'Cancel', 'plural only picks one of two complete texts')
  })
  assert.equal(visitors(3), '3 Besucher', 'the template cache does not survive setLocale')
  inLocale('en', ENGINE, () => assert.equal(visitors(3), '3 visitors'))

  // localize: exact, context, patterns, nested and misses.
  assert.equal(localize('Budget erschöpft'), 'Budget erschöpft', 'German is the identity')
  inLocale('en', ENGINE, () => {
    assert.equal(localize(''), '')
    assert.equal(localize('Budget erschöpft'), 'Budget exhausted')
    assert.equal(localize('Hoch', 'slope'), 'Up')
    assert.equal(localize('Ich warte bei Holzachterbahn 2.'), 'I’m waiting at Wooden coaster 2.')
    assert.equal(localize('Ich warte bei Pixel Harvest.'), 'I’m waiting at Pixel Harvest.')
    assert.equal(localize('Nicht genug Geld (1.250 €)'), 'Not enough money (€1,250)')
    assert.equal(localize('12.000 € aufgenommen, 0,4 % Zinsen pro Tag'), 'Borrowed €12,000, 0.4% interest per day')
    assert.equal(localize('Grund: Budget erschöpft'), 'Reason: Budget exhausted')
    assert.equal(localize('Grund: Tag 3'), 'Reason: Day 3')
    assert.equal(localizeHit('Grund: etwas Neues'), undefined, 'a nested t slot has to hit')
    assert.equal(localize('Grund: etwas Neues'), 'Grund: etwas Neues')
    assert.equal(localize('Pixel Harvest'), 'Pixel Harvest', 'unknown text comes back unchanged')
    assert.equal(localizeHit('Pixel Harvest'), undefined)
    assert.equal(localize('Spielstand „Tag 3“ gespeichert'), 'Game “Tag 3” saved', 'raw slots are never translated')
    assert.equal(localize(`Tagesgäste dürfen von ${hhmm(6000)} bis ${hhmm(-5)} bleiben.`), 'Day visitors may stay from 100:00 to -1:-5.', 'every clock hhmm writes')
  })

  // qps: hits and misses are marked, and marked text is left alone.
  inLocale('qps', ENGINE, () => {
    assert.equal(t('Abbrechen'), '⟦Cancel⟧')
    assert.equal(t('Unbekannt'), '⟦Unbekannt⟧')
    assert.equal(localize('Budget erschöpft'), '⟦Budget exhausted⟧')
    assert.equal(localize('Pixel Harvest'), '⟪Pixel Harvest⟫')
    assert.equal(localize('⟦Cancel⟧'), '⟦Cancel⟧')
    assert.equal(localizeName('Sanitäter 3'), '⟦Medic 3⟧')
    assert.equal(localize(localize('Pixel Harvest')), '⟪Pixel Harvest⟫', 'a miss that passes two sinks is marked once')
    assert.equal(localizeName(localize('Pixel Harvest')), '⟪Pixel Harvest⟫')
  })

  // 7. localizeName.
  inLocale('en', ENGINE, () => {
    assert.equal(localizeName('Holzachterbahn'), 'Wooden coaster')
    assert.equal(localizeName('Sanitäter 3'), 'Medic 3')
    assert.equal(localizeName('Sanitäter 007'), 'Medic 007', 'leading zeros are kept')
    assert.equal(localizeName('Mudmasters Rutsche 3'), 'Mudmasters slide 3', 'name templates, then the ordinal rule')
    assert.equal(localizeName('Tag 3'), 'Tag 3', 'only registered bases take the ordinal rule')
    assert.equal(localizeName('Anna 12'), 'Anna 12')
    for (const band of BANDS.slice(0, 5)) assert.equal(localizeName(band.name), band.name, 'band names stay as they are')
  })

  // 1. Nothing computed for one catalog survives setLocale, not even within English.
  const crateCount = (count: number): string => t`${count} Kisten`
  const catalogA: EnglishCatalog = { text: { 'Kiste {0:n} geliefert': 'Crate {0} delivered', 'Hallo': 'Hello', '{0} Kisten': '{0} crates' }, names: {} }
  const catalogB: EnglishCatalog = { text: { 'Kiste {0:n} geliefert': 'Box {0} shipped', 'Hallo': 'Hi', '{0} Kisten': '{0} boxes' }, names: {} }
  inLocale('en', catalogA, () => {
    assert.equal(localize('Kiste 3 geliefert'), 'Crate 3 delivered')
    assert.equal(localize('Kiste 4 geliefert'), 'Crate 4 delivered', 'a skeleton hint exists now')
    assert.equal(t('Hallo'), 'Hello')
    assert.equal(crateCount(3), '3 crates')
    assert.ok(currentCaches().results.entries > 0 && currentCaches().hints.entries > 0, 'results and hints were cached')
    setLocale('en', catalogB)
    assert.equal(currentCaches().results.entries + currentCaches().hints.entries, 0, 'setLocale starts with empty caches')
    assert.equal(localize('Kiste 3 geliefert'), 'Box 3 shipped', 'no cached result from the other catalog')
    assert.equal(localize('Kiste 5 geliefert'), 'Box 5 shipped', 'no skeleton hint from the other catalog')
    assert.equal(t('Hallo'), 'Hi')
    assert.equal(crateCount(3), '3 boxes', 'tagged templates read the new catalog')
  })
  assert.equal(localize('Kiste 3 geliefert'), 'Kiste 3 geliefert')
  assert.equal(crateCount(3), '3 Kisten')

  // Lookups are reported to a recorder (tests/i18nCoverage.ts): misses with their German,
  // hits with their English.
  const recorded: [TextKind, string, boolean][] = []
  setTextRecorder((kind, text, found) => recorded.push([kind, text, found]))
  try {
    inLocale('en', ENGINE, () => {
      const shown = [
        t('Unbekannt'),
        t`${3} Unbekannte`,
        tc('size', 'Speichern'),
        localize('Unbekannter Text'),
        localizeName('Pixel Harvest'),
        t('Abbrechen'),
        localize('Budget erschöpft'),
      ]
      assert.deepEqual(shown, ['Unbekannt', '3 Unbekannte', 'Speichern', 'Unbekannter Text', 'Pixel Harvest', 'Cancel', 'Budget exhausted'])
    })
  } finally {
    setTextRecorder(null)
  }
  assert.deepEqual(recorded, [
    ['t', 'Unbekannt', false], ['t', '{0} Unbekannte', false], ['t', 'Speichern|size', false], ['localize', 'Unbekannter Text', false],
    ['name', 'Pixel Harvest', false], ['t', 'Cancel', true], ['localize', 'Budget exhausted', true],
  ])

  // 4–6, 8 on the synthetic catalog and on the real one.
  checkCatalogEngine('engine', ENGINE)
  checkCatalogEngine('EN', EN)
  inLocale('en', ENGINE, () => {
    // With the skeleton hint, texts that differ only in digits cost one regex each.
    setI18nCaching(true)
    localize(`Nicht genug Geld (${eur(1000)})`)
    for (let value = 1001; value < 1200; value++) {
      patternWork.execs = 0
      assert.equal(localize(`Nicht genug Geld (${eur(value)})`), `Not enough money (€${formatNumber(value)})`)
      assert.ok(patternWork.execs <= 2, `hinted lookup ran ${patternWork.execs} regexes`)
    }
  })

  // The real catalog: every name base is also a text key, sentinels are translated.
  for (const [key, value] of Object.entries(EN.names)) assert.equal(EN.text[key], value, `names merge into text: ${key}`)
  inLocale('en', EN, () => {
    for (const sentinel of [COMMAND_QUEUED, NOTHING_TO_DEMOLISH, AREA_REFERENCE_FORBIDDEN]) {
      assert.notEqual(localize(sentinel), sentinel, `sentinel ${sentinel} is translated`)
    }
  })

  // 9. Settings.
  assert.equal(DEFAULT_PLAYER_SETTINGS.language, 'auto')
  assert.deepEqual(LANGUAGE_OPTIONS.map((option) => option.value), ['auto', 'de', 'en'], 'the pseudo-locale is dev-only')
  assert.equal(resolveLocale('de', ['en-US']), 'de')
  assert.equal(resolveLocale('en', ['de-DE']), 'en')
  assert.equal(resolveLocale('auto', ['de-AT']), 'de')
  assert.equal(resolveLocale('auto', ['fr', 'en-US']), 'en')
  assert.equal(resolveLocale('auto', ['fr']), 'en', 'no German or English preference: English')
  assert.equal(resolveLocale('auto', []), 'en')
  assert.equal(resolveLocale(undefined, ['de']), 'de')
  assert.equal(resolveLocale('qps', ['de']), 'de', 'the pseudo-locale needs a dev build')
  assert.equal(normalizeLanguageSetting('klingon'), 'auto')
  assert.equal(normalizeLanguageSetting('qps'), 'auto')
  assert.equal(normalizePlayerSettings({ language: 'en' }).language, 'en')
  assert.equal(normalizePlayerSettings({ language: 42 }).language, 'auto')
  const stored = new Map<string, string>([[PLAYER_SETTINGS_KEY, JSON.stringify({ language: 'en' })]])
  assert.equal(readLanguageSetting({ getItem: (key) => stored.get(key) ?? null }), 'en')
  stored.set(PLAYER_SETTINGS_KEY, '{broken')
  assert.equal(readLanguageSetting({ getItem: (key) => stored.get(key) ?? null }), 'auto')
  assert.equal(readLanguageSetting(null), 'auto')

  // index.html repeats detectLocale inline for the boot caption; both agree on every case.
  checkInlineResolver()

  // Language switch: deferred in a room, confirmed with unsaved work, else a plain reload.
  assert.equal(planLanguageChange({ inRoom: true, unsavedWork: true }), 'defer')
  assert.equal(planLanguageChange({ inRoom: false, unsavedWork: true }), 'confirm')
  assert.equal(planLanguageChange({ inRoom: false, unsavedWork: false }), 'reload')
  assert.equal(isInMultiplayerRoom({ mode: 'solo', connected: false }), false)
  assert.equal(isInMultiplayerRoom({ mode: 'host', connected: true }), true)
  assert.equal(isInMultiplayerRoom({ mode: 'client', connected: false }), true, 'a guest dialling back is still in the room')
  assert.equal(isInMultiplayerRoom({ mode: 'host', connected: false }), true, 'so is a host dialling back')
  let revision = 0
  trackUnsavedWork({ editRevision: () => revision, running: () => true })
  revision = 1
  setUnsavedWarnings(true)
  assert.equal(shouldPromptBeforeUnload(), true)
  suppressBeforeUnloadOnce()
  assert.equal(shouldPromptBeforeUnload(), false, 'a confirmed reload does not ask twice')
  assert.equal(shouldPromptBeforeUnload(), true, 'only once')
  trackUnsavedWork({ editRevision: () => 0, running: () => false })
  assert.equal(getLocale(), 'de', 'every English block returned to German')
}

/**
 * The inline script of index.html against detectLocale: same stored settings (also
 * broken or unreadable ones), same browser languages (also a navigator that throws).
 */
function checkInlineResolver(): void {
  const html = readFileSync('index.html', 'utf8')
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]!).find((body) => body.includes(PLAYER_SETTINGS_KEY))
  assert.ok(script, 'index.html carries the inline locale resolver')
  const inline = new Function('localStorage', 'navigator', 'document', script) as (storage: unknown, navigator: unknown, document: unknown) => void
  const storages: [string, Pick<Storage, 'getItem'> | null][] = [
    ['nothing stored', { getItem: () => null }],
    ...['de', 'en', 'auto', 'qps', 'klingon'].map((language): [string, Pick<Storage, 'getItem'>] => [language, { getItem: () => JSON.stringify({ language }) }]),
    ['a number', { getItem: () => JSON.stringify({ language: 42 }) }],
    ['broken JSON', { getItem: () => '{broken' }],
    ['a JSON string', { getItem: () => '"en"' }],
    ['a JSON array', { getItem: () => '[]' }],
    ['getItem throws', { getItem: () => { throw new Error('blocked') } }],
    ['no storage', null],
  ]
  const throwing = { get languages(): readonly string[] { throw new Error('no navigator') } }
  const navigators: [string, LocaleEnvironment['navigator']][] = [
    ['de-AT', { languages: ['de-AT'] }],
    ['fr, en-US', { languages: ['fr', 'en-US'] }],
    ['fr', { languages: ['fr'] }],
    ['none', { languages: [] }],
    ['undefined', {}],
    ['throws', throwing],
  ]
  for (const [storageCase, storage] of storages) {
    for (const [navigatorCase, navigator] of navigators) {
      const document = { documentElement: { lang: '' } }
      inline(storage, navigator, document)
      const expected = detectLocale({ storage, navigator }) === 'en' ? 'en' : 'de'
      assert.equal(document.documentElement.lang, expected, `inline resolver = detectLocale for ${storageCase} / ${navigatorCase}`)
    }
  }
}

/** A fake page for the language switch: what it stored, asked, suppressed and reloaded. */
function switchHarness(options: { inRoom?: boolean; unsavedWork?: boolean; differs?: boolean; confirm?: boolean; storeWorks?: boolean }) {
  const calls: string[] = []
  let stored: LanguageSetting = 'auto'
  const ports: LanguageSwitchPorts = {
    store: (next) => {
      calls.push(`store ${next}`)
      if (options.storeWorks === false) return false
      stored = next
      return true
    },
    inRoom: () => options.inRoom ?? false,
    unsavedWork: () => options.unsavedWork ?? false,
    differsFromPage: () => options.differs ?? true,
    confirm: async () => {
      calls.push('confirm')
      return options.confirm ?? true
    },
    suppressUnloadPrompt: () => calls.push('suppress'),
    reload: () => calls.push('reload'),
  }
  return { ports, calls, stored: () => stored }
}

/** §8: the order confirm → write → check → suppress → reload, and every way out of it. */
export async function testLanguageSwitch(): Promise<void> {
  const plain = switchHarness({})
  assert.equal(await switchLanguage('en', plain.ports), 'reloading')
  assert.deepEqual(plain.calls, ['store en', 'suppress', 'reload'], 'no unsaved work: write, then reload')

  const unsaved = switchHarness({ unsavedWork: true })
  assert.equal(await switchLanguage('en', unsaved.ports), 'reloading')
  assert.deepEqual(unsaved.calls, ['confirm', 'store en', 'suppress', 'reload'], 'unsaved work: confirm first')

  const cancelled = switchHarness({ unsavedWork: true, confirm: false })
  assert.equal(await switchLanguage('en', cancelled.ports), 'cancelled')
  assert.deepEqual(cancelled.calls, ['confirm'], 'a cancelled switch writes nothing')
  assert.equal(cancelled.stored(), 'auto')

  const refused = switchHarness({ unsavedWork: true, storeWorks: false })
  assert.equal(await switchLanguage('en', refused.ports), 'failed')
  assert.deepEqual(refused.calls, ['confirm', 'store en'], 'a refused write never reloads')

  for (const status of [{ mode: 'client', connected: false }, { mode: 'host', connected: true }] as const) {
    const room = switchHarness({ inRoom: isInMultiplayerRoom(status), unsavedWork: true })
    assert.equal(await switchLanguage('en', room.ports), 'saved', `${status.mode} (connected ${status.connected}) only saves`)
    assert.deepEqual(room.calls, ['store en'], 'in a room: no confirm, no reload')
  }

  const same = switchHarness({ differs: false, unsavedWork: true })
  assert.equal(await switchLanguage('de', same.ports), 'saved', 'a setting that loads this locale anyway only saves')
  assert.deepEqual(same.calls, ['store de'])
}
