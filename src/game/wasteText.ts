// i18n: client-text
/**
 * Inspect and hover lines for waste dumps and sealed containers (docs/incidents.md).
 * Display only: the entity panel and the context help call these on the viewer's
 * client, so they use `t` and the format helpers instead of canonical German.
 */
import { formatNumber, formatPercent, joinParts, plural, t } from '../i18n'
import { SIMULATION_CONFIG } from './simulationConfig'
import type { WasteDumpAreaStats } from './waste'

type InspectLines = {
  status: string
  lines: Array<{ label: string; value: string }>
}

function fillLines(stored: number, capacity: number, remaining: number, percent: number): InspectLines['lines'] {
  return [
    { label: t('Gelagert'), value: `${formatNumber(stored)} / ${formatNumber(capacity)}` },
    { label: t('Frei'), value: formatNumber(remaining) },
    { label: t('Auslastung'), value: formatPercent(percent) },
  ]
}

export function formatWasteDumpAreaInspect(stats: WasteDumpAreaStats): InspectLines {
  return {
    status: joinParts(
      t('Zusammenhängende Fläche'),
      plural(stats.cells, t`${stats.cells} Feld`, t`${stats.cells} Felder`),
    ),
    lines: fillLines(stats.stored, stats.capacity, stats.remaining, stats.percent),
  }
}

export function formatWasteDumpAreaHover(stats: WasteDumpAreaStats): string {
  return joinParts(
    t('Müllablage'),
    t`${stats.stored}/${stats.capacity} gelagert`,
    t`${stats.remaining} frei`,
  )
}

function sealedContainerCollection(onRoad: boolean, truckReachable: boolean): string {
  if (onRoad && truckReachable) return joinParts(t('Müllwagen kann entleeren'), t('sonst trägt die Reinigung'))
  if (onRoad) return joinParts(t('Straße ohne Zufahrt'), t('Reinigung trägt zur Ablage'))
  return joinParts(t('Nicht an der Straße'), t('Reinigung trägt zur Ablage'))
}

export function formatSealedContainerInspect(container: {
  stored: number
  capacity?: number
  onRoad: boolean
  truckReachable: boolean
}): InspectLines {
  const capacity = container.capacity ?? SIMULATION_CONFIG.waste.sealedContainerCapacity
  const remaining = Math.max(0, capacity - container.stored)
  const percent =
    capacity <= 0 ? 0 : Math.min(100, Math.round((container.stored / capacity) * 100))
  const truck = sealedContainerCollection(container.onRoad, container.truckReachable)
  return {
    status: truck,
    lines: [...fillLines(container.stored, capacity, remaining, percent), { label: t('Abfuhr'), value: truck }],
  }
}
