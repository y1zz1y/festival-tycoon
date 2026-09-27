/**
 * Numbers, money, clocks and dates in the viewer's language. German output is exactly
 * what the game showed before the text layer (hand-built `1.234 €` with a plain space);
 * English follows en-GB (`€1,234`, `0.4`, `88%`). src/ui/format.ts delegates here.
 */
import { hhmm, num } from './marker'
import { getLocale, localeTag } from './state'

const englishNumbers = new Map<number | undefined, Intl.NumberFormat>()
const englishMoney = new Map<number, Intl.NumberFormat>()
const dateFormats = new Map<string, Intl.DateTimeFormat>()

function englishNumber(fractionDigits: number | undefined): Intl.NumberFormat {
  let format = englishNumbers.get(fractionDigits)
  if (!format) {
    format = new Intl.NumberFormat('en-GB', fractionDigits === undefined
      ? { maximumFractionDigits: 2 }
      : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
    englishNumbers.set(fractionDigits, format)
  }
  return format
}

/** `1.234` / `0,4` in German, `1,234` / `0.4` in English. Without digits: integers none, fractions up to two. */
export function formatNumber(value: number, fractionDigits?: number): string {
  if (getLocale() === 'de') return num(value, fractionDigits)
  if (Number.isInteger(value) && Math.abs(value) < 1000 && !fractionDigits) return String(value)
  return englishNumber(fractionDigits).format(value)
}

/** `1.234 €` / `€1,234`, `-€500`, `€2.50`. Whole euros are floored, as the game always did. */
export function formatMoney(value: number, fractionDigits = 0): string {
  const amount = fractionDigits === 0 ? Math.floor(value) : value
  if (getLocale() === 'de') return `${num(amount, fractionDigits)} €`
  let format = englishMoney.get(fractionDigits)
  if (!format) {
    format = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
    englishMoney.set(fractionDigits, format)
  }
  return format.format(amount)
}

/** A value already in percent: `88 %` / `88%`. */
export function formatPercent(value: number): string {
  return getLocale() === 'de' ? `${formatNumber(value)} %` : `${formatNumber(value)}%`
}

export function formatTemperature(celsius: number): string {
  return `${formatNumber(celsius)} °C`
}

/** 24-hour clock from a minute of the day, `08:05` in both languages. */
export function formatTime(minute: number): string {
  return hhmm(minute)
}

/** Short date and time of a save in the viewer's convention. */
export function formatSaveTime(value: number): string {
  const tag = localeTag()
  let format = dateFormats.get(tag)
  if (!format) {
    format = new Intl.DateTimeFormat(tag, { dateStyle: 'short', timeStyle: 'short' })
    dateFormats.set(tag, format)
  }
  return format.format(value)
}

/** Joins the truthy parts with ` · ` — separators and optional suffixes stay outside catalog keys. */
export function joinParts(...parts: ReadonlyArray<string | false | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' · ')
}

export function joinList(items: readonly string[]): string {
  return items.join(', ')
}

export function formatRange(from: string | number, to: string | number): string {
  return `${from}–${to}`
}
