// i18n: client-text
/**
 * Display text for traffic lights and path barriers: schedule-time labels and the
 * area preview lines of the access panel. Only UI code and tests import this module,
 * so it translates with `t` (docs/i18n.md, docs/logistics.md).
 */
import { joinParts, plural, t } from '../i18n'
import type {
  AccessAreaStats,
  AccessControlKind,
  AccessScheduleTime,
  PathSensorKind,
  TrafficSensorKind,
} from './accessControl'

/** Built at import time; the English catalog is installed before the UI loads (src/boot.ts). */
export const ACCESS_SCHEDULE_TIME_LABELS: Record<AccessScheduleTime, string> = {
  hourlySlots: t('Slots je Stunde'),
  hours: t('Tageszeit'),
  dayPlan: t('Nach Zeitplan'),
}

const parkingLine = (stats: AccessAreaStats): string =>
  t`${stats.freeParking} freie / ${stats.occupiedParking} belegte Parkplätze`

const carsLine = (stats: AccessAreaStats): string =>
  plural(
    stats.carsOnRoad,
    t`${stats.carsOnRoad} Auto auf Straßen im Gebiet`,
    t`${stats.carsOnRoad} Autos auf Straßen im Gebiet`,
  )

const campingLine = (stats: AccessAreaStats): string =>
  t`${stats.freeCamping} freie / ${stats.occupiedCamping} belegte Campingflächen`

const peopleLine = (stats: AccessAreaStats): string =>
  plural(
    stats.people,
    t`${stats.people} Person im Gebiet`,
    t`${stats.people} Personen im Gebiet`,
  )

export function previewLabel(
  kind: AccessControlKind,
  sensorKind: TrafficSensorKind | PathSensorKind,
  stats: AccessAreaStats,
): string {
  if (kind === 'trafficLight') {
    if (sensorKind === 'freeParking' || sensorKind === 'noFreeParking') {
      return parkingLine(stats)
    }
    return carsLine(stats)
  }
  if (sensorKind === 'freeCamping' || sensorKind === 'occupiedCamping') {
    return campingLine(stats)
  }
  return peopleLine(stats)
}

export function areaPreviewText(
  kind: AccessControlKind,
  stats: AccessAreaStats,
): string {
  if (kind === 'trafficLight') return joinParts(parkingLine(stats), carsLine(stats))
  return joinParts(campingLine(stats), peopleLine(stats))
}
