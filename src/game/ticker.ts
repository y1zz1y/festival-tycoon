import { SIMULATION_CONFIG } from './simulationConfig'
import { collectSeatedPassengerIds } from './logistics'
import {
  isParkWasteDumpOverFull,
  parkWasteDumpFill,
  type WasteDumpCell,
} from './waste'

export type TickerKind = 'fire' | 'panic' | 'dumpFull' | 'medical'

export type TickerSeverity = 'info' | 'warning' | 'alert'

export type TickerItem = {
  id: string
  kind: TickerKind
  severity: TickerSeverity
  title: string
  message: string
  simTick: number
  day: number
  minute: number
  position?: { x: number; z: number }
}

export type TickerSource = {
  simTick: number
  day: number
  minute: number
  incidents: readonly { id: string; kind: string; x: number; z: number }[]
  visitors: readonly {
    id: string
    x: number
    z: number
    isPanicking?: boolean
    state: string
  }[]
  logistics?: {
    roadVehicles?: readonly { passengerIds?: readonly string[] }[]
  }
  wasteDumpCells: readonly WasteDumpCell[]
}

export type TickerWatchState = {
  knownFireIds: Set<string>
  lastFireRemindClock: number
  panicActive: boolean
  lastPanicWarnClock: number
  dumpOver: boolean
  lastDumpWarnClock: number
  knownInjuredIds: Set<string>
}

export function createTickerWatchState(): TickerWatchState {
  return {
    knownFireIds: new Set(),
    lastFireRemindClock: Number.NEGATIVE_INFINITY,
    panicActive: false,
    lastPanicWarnClock: Number.NEGATIVE_INFINITY,
    dumpOver: false,
    lastDumpWarnClock: Number.NEGATIVE_INFINITY,
    knownInjuredIds: new Set(),
  }
}

export function tickerSimClock(source: { day: number; minute: number }): number {
  return source.day * SIMULATION_CONFIG.time.minutesPerDay + source.minute
}

function tickerItem(
  kind: TickerKind,
  source: TickerSource,
  title: string,
  message: string,
  position: { x: number; z: number } | undefined,
  severity: TickerSeverity,
): TickerItem {
  return {
    id: `${kind}:${source.simTick}:${position?.x ?? 'x'}:${position?.z ?? 'z'}`,
    kind,
    severity,
    title,
    message,
    simTick: source.simTick,
    day: source.day,
    minute: source.minute,
    position,
  }
}

function cellCenter(cell: { x: number; z: number }): { x: number; z: number } {
  return { x: cell.x + 0.5, z: cell.z + 0.5 }
}

function fullestDump(
  dumps: readonly WasteDumpCell[],
): WasteDumpCell | undefined {
  return dumps.reduce<WasteDumpCell | undefined>((best, dump) => {
    if (!best || dump.stored > best.stored) return dump
    return best
  }, undefined)
}

/**
 * Derive ticker events from the current snapshot. Watch state is UI-only;
 * the same incidents/dumps/panic on every client produce the same items.
 */
export function observeTickerEvents(
  source: TickerSource,
  watch: TickerWatchState,
): TickerItem[] {
  const items: TickerItem[] = []
  const clock = tickerSimClock(source)
  const repeat = SIMULATION_CONFIG.ticker.incidentRepeatMinutes

  const fires = source.incidents.filter((incident) => incident.kind === 'fire')
  const fireIds = new Set(fires.map((fire) => fire.id))
  const newFires = fires.filter((fire) => !watch.knownFireIds.has(fire.id))
  const fireFocus = fires[0] ?? newFires[0]
  if (newFires.length > 0) {
    const latest = newFires[newFires.length - 1]!
    items.push(
      tickerItem(
        'fire',
        source,
        newFires.length === 1 ? 'Feuer' : `${newFires.length} Brände`,
        newFires.length === 1
          ? 'Es brennt auf dem Gelände.'
          : `Es brennt an ${newFires.length} Stellen.`,
        cellCenter(latest),
        'alert',
      ),
    )
    watch.lastFireRemindClock = clock
  } else if (fires.length > 0 && clock - watch.lastFireRemindClock >= repeat) {
    items.push(
      tickerItem(
        'fire',
        source,
        'Feuer',
        fires.length === 1
          ? 'Ein Brand dauert noch an.'
          : `${fires.length} Brände dauern noch an.`,
        fireFocus ? cellCenter(fireFocus) : undefined,
        'alert',
      ),
    )
    watch.lastFireRemindClock = clock
  }
  watch.knownFireIds = fireIds
  if (fires.length === 0) watch.lastFireRemindClock = Number.NEGATIVE_INFINITY

  const panicking = source.visitors.filter(
    (visitor) => visitor.isPanicking || visitor.state === 'panicking',
  )
  const panicNow = panicking.length > 0
  const panicPos = panicking[0]
    ? { x: panicking[0].x, z: panicking[0].z }
    : undefined
  if (panicNow && !watch.panicActive) {
    items.push(
      tickerItem(
        'panic',
        source,
        panicking.length >= 2 ? 'Massenpanik' : 'Panik',
        panicking.length >= 2
          ? `${panicking.length} Gäste fliehen aus dem Gedränge.`
          : 'Ein Gast flieht aus dem Gedränge.',
        panicPos,
        'alert',
      ),
    )
    watch.lastPanicWarnClock = clock
  } else if (panicNow && clock - watch.lastPanicWarnClock >= repeat) {
    items.push(
      tickerItem(
        'panic',
        source,
        panicking.length >= 2 ? 'Massenpanik' : 'Panik',
        `${panicking.length} Gäste sind noch in Panik.`,
        panicPos,
        'alert',
      ),
    )
    watch.lastPanicWarnClock = clock
  }
  watch.panicActive = panicNow
  if (!panicNow) watch.lastPanicWarnClock = Number.NEGATIVE_INFINITY

  const fill = parkWasteDumpFill(source.wasteDumpCells)
  const dumpOver = isParkWasteDumpOverFull(source.wasteDumpCells)
  const dumpPos = fullestDump(source.wasteDumpCells)
  const dumpCenter = dumpPos ? cellCenter(dumpPos) : undefined
  const dumpRepeat = SIMULATION_CONFIG.ticker.dumpFullRepeatMinutes
  if (dumpOver && fill && !watch.dumpOver) {
    items.push(
      tickerItem(
        'dumpFull',
        source,
        'Müllablagen voll',
        `Alle Müllflächen sind zu ${fill.percent} % belegt.`,
        dumpCenter,
        'warning',
      ),
    )
    watch.lastDumpWarnClock = clock
  } else if (dumpOver && fill && clock - watch.lastDumpWarnClock >= dumpRepeat) {
    items.push(
      tickerItem(
        'dumpFull',
        source,
        'Müllablagen voll',
        `Die Müllflächen bleiben zu ${fill.percent} % belegt.`,
        dumpCenter,
        'warning',
      ),
    )
    watch.lastDumpWarnClock = clock
  }
  watch.dumpOver = dumpOver
  if (!dumpOver) watch.lastDumpWarnClock = Number.NEGATIVE_INFINITY

  const seated = collectSeatedPassengerIds(source.logistics?.roadVehicles)
  const injured = source.visitors.filter(
    (visitor) =>
      visitor.state === 'injured' && !seated.has(visitor.id),
  )
  const newInjured = injured.filter(
    (visitor) => !watch.knownInjuredIds.has(visitor.id),
  )
  if (newInjured.length > 0) {
    const latest = newInjured[newInjured.length - 1]!
    items.push(
      tickerItem(
        'medical',
        source,
        newInjured.length === 1 ? 'Verletzte Person' : 'Verletzte',
        newInjured.length === 1
          ? 'Jemand braucht medizinische Hilfe.'
          : `${newInjured.length} Personen brauchen medizinische Hilfe.`,
        { x: latest.x, z: latest.z },
        'warning',
      ),
    )
  }
  watch.knownInjuredIds = new Set(injured.map((visitor) => visitor.id))

  return items
}

export function appendTickerHistory(
  history: readonly TickerItem[],
  incoming: readonly TickerItem[],
  limit = SIMULATION_CONFIG.ticker.historyLimit,
): TickerItem[] {
  if (incoming.length === 0) return [...history]
  return [...incoming, ...history].slice(0, limit)
}

export function formatTickerClock(item: Pick<TickerItem, 'day' | 'minute'>): string {
  const hour = Math.floor(item.minute / 60)
  const minute = Math.floor(item.minute % 60)
  return `Tag ${item.day} · ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function tickerKindIcon(kind: TickerKind): string {
  if (kind === 'fire') return '🔥'
  if (kind === 'panic') return '😱'
  if (kind === 'dumpFull') return '🗑️'
  return '🚑'
}

export function pickTickerDisplay(items: readonly TickerItem[]): TickerItem | null {
  if (items.length === 0) return null
  const rank = (severity: TickerSeverity) =>
    severity === 'alert' ? 2 : severity === 'warning' ? 1 : 0
  return items.reduce((best, item) =>
    rank(item.severity) >= rank(best.severity) ? item : best,
  )
}
