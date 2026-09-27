// i18n: client-text
/**
 * Display text for the backstage inspector and hover (docs/band-supply.md). Only UI code
 * imports this module, so it translates with `t` directly; band names stay as they are,
 * stage names go through localizeName (defaults such as „Bühne“ or „Umbau / Pause“).
 */
import { formatNumber, formatRange, joinList, joinParts, localizeName, plural, t } from '../i18n'
import type { BandSupplyStats } from './bandSupply'

export function clockLabel(minute: number): string {
  const hours = Math.floor(minute / 60) % 24
  const minutes = Math.floor(minute % 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function parkingValue(stats: BandSupplyStats): string {
  if (!stats.parkingNeeded) return t('nicht nötig')
  return joinParts(`${formatNumber(stats.usableSlots)} / ${formatNumber(stats.busDemand)}`, stats.parkingSufficient ? t('reicht') : t('nicht max.'))
}

function backstageStatus(stats: BandSupplyStats): string {
  if (!stats.active) return joinParts(t('Inaktiv'), t('keine Verbindung zur Bühne'))
  if (stats.bareStage) return joinParts(t('Aktiv'), t('nur Bühne (schwach versorgt)'))
  return joinParts(t('Aktiv'), plural(stats.activeTiles, t`${stats.activeTiles} Feld`, t`${stats.activeTiles} Felder`))
}

function connectionValue(stats: BandSupplyStats): string {
  if (!stats.active) return t('Getrennt — zählt nicht')
  return stats.bareStage ? t('Nur Bühne') : t('Verbunden')
}

function stagesValue(stats: BandSupplyStats): string {
  if (stats.stages.length === 0) return t('keine')
  return joinList(stats.stages.map((stage) => stage.bandName
    ? joinParts(localizeName(stage.name), localizeName(stage.bandName))
    : localizeName(stage.name)))
}

function todayValue(stats: BandSupplyStats): string {
  if (stats.bookings.length === 0) return t('keine Auftritte')
  return joinList(stats.bookings.map((booking) =>
    `${booking.bandName} ${formatRange(clockLabel(booking.start), clockLabel(booking.start + booking.duration))}`))
}

function arrivalValue(stats: BandSupplyStats): string {
  if (stats.bookings.length === 0) return '—'
  return joinList([...new Map(stats.bookings.map((booking) => [booking.bandId, booking])).values()]
    .map((booking) => `${booking.bandName}: ${booking.mode === 'tourBus' ? t('Tourbus') : t('Personaleingang')}`))
}

const outOf100 = (value: number): string => `${formatNumber(Math.round(value))} / 100`

export function formatBackstageInspect(stats: BandSupplyStats): {
  status: string
  lines: Array<{ label: string; value: string }>
} {
  return {
    status: backstageStatus(stats),
    lines: [
      { label: t('Status'), value: connectionValue(stats) },
      { label: t('Felder'), value: t`${stats.activeTiles} aktiv / ${stats.designatedTiles} ausgewiesen` },
      { label: t('Bühnen'), value: stagesValue(stats) },
      { label: t('Heute'), value: todayValue(stats) },
      { label: t('Ankunft'), value: arrivalValue(stats) },
      { label: t('Tourbus-Parkplätze'), value: parkingValue(stats) },
      { label: t('Attraktivität'), value: outOf100(stats.attractiveness) },
      {
        label: t('Davon Deko / Parkplätze / Möbel / Fans'),
        value: `${formatNumber(Math.round(stats.decoScore))} / ${formatNumber(Math.round(stats.parkingTerm))} / ${formatNumber(Math.round(stats.furnitureTerm))} / −${formatNumber(Math.round(stats.fanPenalty))}`,
      },
      {
        label: t('Couchplätze / Kühlschränke / Klo mit Wasser'),
        value: `${formatNumber(stats.couchSeats)} / ${formatNumber(stats.fridgeCount)} / ${formatNumber(stats.suppliedToilets)}`,
      },
      { label: t('Verpflegung'), value: outOf100(stats.catering) },
      {
        label: t('Imbiss / Getränke / Bandkühlschrank'),
        value: `${formatNumber(stats.foodCount)} / ${formatNumber(stats.drinkCount)} / ${formatNumber(Math.round(stats.dedicatedCatering))}`,
      },
      { label: t('Bandzufriedenheit / Drauf'), value: outOf100(stats.satisfaction) },
      { label: t('Nur Bühne'), value: stats.bareStage ? t('ja — schwächerer Auftritt') : t('nein') },
      { label: t('Show-Qualität'), value: `× ${formatNumber(stats.showQuality, 2)}` },
      { label: t('Fans auf dem Backstage'), value: formatNumber(stats.fansOnActiveTiles) },
      { label: t('Security'), value: t('Basis-Leck; in v1 keine Reduktion durch Security oder Zäune') },
    ],
  }
}

export function formatBackstageHover(stats: BandSupplyStats): string {
  if (!stats.active) return joinParts(t('Backstage'), t('getrennt von der Bühne'))
  return joinParts(t('Backstage'), t`Drauf ${Math.round(stats.satisfaction)}`, t`Show ×${formatNumber(stats.showQuality, 2)}`)
}
