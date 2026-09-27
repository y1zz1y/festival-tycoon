import type { SimulationPhaseTimings } from '../game/simulationProfiler'
import { joinParts, t } from '../i18n'

/**
 * Vorübergehende Ersatzfassung: Marvins Commit verweist auf dieses Modul, hat es
 * aber nicht mitgeschickt. Ausgabe nach tests/uiModules.ts; sobald seine Datei
 * kommt, gilt seine. Diagnosezahlen behalten in jeder Sprache ihren Dezimalpunkt
 * (toFixed, als String an t übergeben).
 */
export type PerformanceHudSample = {
  versionLabel: string
  fps: number
  tps: number
  simMs: number
  viewMs: number
  renderMs: number
  phases?: SimulationPhaseTimings | null
}

/** Import-time t is safe in UI modules: src/boot.ts installs the catalog before main loads. */
const PHASE_LABELS: Record<string, string> = {
  visitors: t('Besucher'),
  staff: t('Personal'),
  logistics: t('Logistik'),
  pathfinding: t('Wegsuche'),
  nav: t('Navigation'),
  walk: t('Laufen'),
  festival: t('Festival'),
  supply: t('Versorgung'),
  spawn: t('Anreise'),
  camps: t('Camps'),
  atmosphere: t('Atmosphäre'),
  crowding: t('Gedränge'),
  economy: t('Wirtschaft'),
  attractions: t('Attraktionen'),
  concert: t('Konzert'),
  queues: t('Warteschlangen'),
}

function pairs(items: readonly string[]): string[] {
  const lines: string[] = []
  for (let index = 0; index < items.length; index += 2) lines.push(joinParts(...items.slice(index, index + 2)))
  return lines
}

/** Tick-Phasen nach Zeit, zwei je Zeile; inklusive Phasen (Wegsuche) danach. */
export function formatSimulationPhaseLines(phases: SimulationPhaseTimings, simMs: number): string[] {
  const exclusive = Object.entries(phases.exclusive)
    .sort((left, right) => right[1] - left[1])
    .map(([id, ms]) => `${PHASE_LABELS[id] ?? id} ${ms.toFixed(2)} (${Math.round(simMs > 0 ? ms / simMs * 100 : 0)}%)`)
  const inclusive = Object.entries(phases.inclusive)
    .sort((left, right) => right[1] - left[1])
    .map(([id, ms]) => `${PHASE_LABELS[id] ?? id} ${t`${ms.toFixed(2)} inkl.`}`)
  return [...pairs(exclusive), ...pairs(inclusive)]
}

export function formatPerformanceHud(sample: PerformanceHudSample): string {
  const lines = [
    sample.versionLabel,
    joinParts(`FPS ${Math.round(sample.fps)}`, `TPS ${sample.tps.toFixed(1)}`),
    joinParts(`Sim ${sample.simMs.toFixed(1)}`, t`Szene ${sample.viewMs.toFixed(1)}`, t`Render ${sample.renderMs.toFixed(1)} ms`),
  ]
  if (sample.phases) lines.push(...formatSimulationPhaseLines(sample.phases, sample.simMs))
  return lines.join('\n')
}
