// i18n: client-text
/**
 * Display lines for road vehicles: activity, destination and load in the inspect
 * panel, the fleet table and the staff details. Only UI code and tests import this
 * module, so it translates with `t` (docs/i18n.md, docs/logistics.md). The simulation
 * never reads these strings.
 */
import { formatNumber, formatPercent, t } from '../i18n'
import {
  isVehicleReversing,
  roadVehicleCarriesPeople,
  roadVehicleWasteCapacity,
  type RoadVehicle,
} from './logistics'

export function describeRoadVehicleActivity(vehicle: RoadVehicle): string {
  if ((vehicle.stuckMinutes ?? 0) > 0) return t('Steckt im Schlamm fest')
  if (vehicle.kind === 'visitorCar' && vehicle.waitMinutes > 0 &&
    (vehicle.state === 'parked' || (vehicle.state === 'returning' && vehicle.route.length === 0))) {
    return t('Keine Ausfahrtroute – Straßenpfeile und Verbindungen prüfen')
  }
  if (isVehicleReversing(vehicle)) return t('Setzt zurück')
  const queued =
    vehicle.route.length > 0 &&
    vehicle.waitMinutes > 0 &&
    (vehicle.state === 'driving' ||
      vehicle.state === 'responding' ||
      vehicle.state === 'returning' ||
      vehicle.state === 'parking')
  if (queued) return t('Wartet, bis die Fahrbahn oder Ampel frei ist')
  switch (vehicle.state) {
    case 'parked':
      return t('Steht auf dem Parkplatz')
    case 'parking':
      return t('Rangiert auf den Parkplatz')
    case 'waiting':
      return vehicle.resumeState
        ? t('Wartet nach einem Zwischenfall')
        : vehicle.parkingCell || vehicle.target?.kind === 'parking'
          ? t('Wartet auf die Zufahrt zum Parkplatz')
          : t('Wartet auf der Straße')
    case 'driving':
      if (vehicle.kind === 'deliveryTruck') return t('Fährt zur Anlieferung')
      if (vehicle.target?.kind === 'parking') return t('Fährt zum Parkplatz')
      if (vehicle.target?.kind === 'hold') return t('Sucht einen freien Parkplatz')
      if (vehicle.target?.kind === 'cruise') {
        return t('Fährt auf der Straße und sucht einen Parkplatz')
      }
      if (vehicle.target?.kind === 'busStop') return t('Fährt zur nächsten Haltestelle')
      if (vehicle.target?.kind === 'wasteDump') return t('Fährt zur Müllkippe')
      if (vehicle.target?.kind === 'sealedWasteContainer') return t('Fährt zum Müllcontainer')
      if (vehicle.target?.kind === 'depot') return t('Fährt zum Betriebshof')
      if (vehicle.target?.kind === 'garage') return t('Fährt zur Garage')
      if (vehicle.target?.kind === 'cell') return t('Fährt zum Ziel')
      return t('Unterwegs')
    case 'responding':
      return t('Fährt zum Einsatz')
    case 'returning':
      if (vehicle.pendingSale && vehicle.kind === 'ambulance') {
        return t('Fährt zur Garage und wird verkauft')
      }
      return vehicle.kind === 'visitorCar' || vehicle.kind === 'deliveryTruck'
        ? t('Fährt vom Gelände ab')
        : t('Fährt zurück')
    case 'at-stop':
      return t('Hält an der Haltestelle')
    case 'idle':
      return t('Wartet auf den nächsten Auftrag')
  }
}

export type RoadVehicleInspectStat = {
  label: string
  value: string
}

export function formatRoadVehicleInspectLoad(
  vehicle: Pick<RoadVehicle, 'kind' | 'passengerIds' | 'cargo'>,
  expectedPassengers?: number,
): RoadVehicleInspectStat[] {
  const stats: RoadVehicleInspectStat[] = []
  if (roadVehicleCarriesPeople(vehicle.kind)) {
    const seated = vehicle.passengerIds.length
    stats.push({
      label: t('Insassen'),
      value:
        expectedPassengers && expectedPassengers > 0
          ? `${formatNumber(seated)} / ${formatNumber(expectedPassengers)}`
          : formatNumber(seated),
    })
  }
  const wasteCapacity = roadVehicleWasteCapacity(vehicle.kind)
  if (wasteCapacity !== null) {
    const percent =
      wasteCapacity <= 0
        ? 0
        : Math.min(100, Math.round((vehicle.cargo / wasteCapacity) * 100))
    stats.push({
      label: t('Müll'),
      value: `${formatNumber(vehicle.cargo)} / ${formatNumber(wasteCapacity)} (${formatPercent(percent)})`,
    })
    return stats
  }
  if (vehicle.kind === 'deliveryTruck') {
    stats.push({ label: t('Ladung'), value: formatNumber(vehicle.cargo) })
  }
  return stats
}

/** Coordinates are not quantities: they go in as strings, without digit grouping. */
export function describeRoadVehicleDestination(vehicle: RoadVehicle): string | null {
  if (vehicle.parkingCell && vehicle.state !== 'parked') {
    return t`Parkplatz ${String(vehicle.parkingCell.x)}, ${String(vehicle.parkingCell.z)}`
  }
  if (vehicle.target?.kind === 'busStop') return t('Nächste Bushaltestelle')
  if (vehicle.target?.kind === 'tourBusParking') return t('Tourbus-Parkplatz')
  if (vehicle.target?.kind === 'sealedWasteContainer') return t('Müllcontainer')
  if (vehicle.target?.kind === 'wasteDump') return t('Müllablage')
  if (vehicle.kind === 'deliveryTruck' && vehicle.target?.kind === 'depot') {
    return t('Anlieferungsplatz')
  }
  if (vehicle.target?.kind === 'cell') {
    return t`Feld ${String(vehicle.target.x)}, ${String(vehicle.target.z)}`
  }
  const last = vehicle.route.at(-1)
  return last ? t`Feld ${String(last.x)}, ${String(last.z)}` : null
}
