import { SIMULATION_CONFIG } from './simulationConfig'
import { collectSeatedPassengerIds } from './logistics'
import {
  isParkWasteDumpOverFull,
  parkWasteDumpFill,
  type WasteDumpCell,
} from './waste'
import type { ScenarioGoal } from './scenario'
import { goalName, insolvencyDaysLeft, type GoalStatus, type ScenarioProgress } from './scenarioGoals'

export type TickerKind =
  | 'fire'
  | 'panic'
  | 'dumpFull'
  | 'medical'
  | 'goalDone'
  | 'goalFailed'
  | 'goalDeadline'
  | 'insolvency'
  | 'editionDue'

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
  /**
   * What the message is about: the injured guests, the fires. A message is
   * only worth showing while its subject is still a problem, and once none of
   * them is, it goes. Panic and full dumps have no ids — they are conditions of
   * the whole park, and end when the condition does.
   */
  subjects?: readonly string[]
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
  scenario?: { goals: readonly ScenarioGoal[] }
  scenarioProgress?: Pick<ScenarioProgress, 'status' | 'insolventDays' | 'dueReminderDay'>
  festival?: { edition: number; enabled: boolean; finished: boolean }
}

export type TickerWatchState = {
  knownFireIds: Set<string>
  lastFireRemindClock: number
  panicActive: boolean
  lastPanicWarnClock: number
  dumpOver: boolean
  lastDumpWarnClock: number
  knownInjuredIds: Set<string>
  /**
   * The scenario as last seen. Null until the first look, which only takes note:
   * a goal reached before a save was loaded is no news.
   */
  scenario: {
    status: GoalStatus[]
    runningEdition: number
    insolventDays: number
    dueReminderDay: number | null
  } | null
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
    scenario: null,
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
  subjects?: readonly string[],
): TickerItem {
  return {
    // Two goals can be decided in the same tick, so the first subject is part of the id.
    id: `${kind}:${source.simTick}:${position?.x ?? 'x'}:${position?.z ?? 'z'}:${subjects?.[0] ?? ''}`,
    kind,
    severity,
    title,
    message,
    simTick: source.simTick,
    day: source.day,
    minute: source.minute,
    position,
    subjects,
  }
}

/** Who still needs an ambulance: injured, and not already in one. */
function injuredIds(source: TickerSource): Set<string> {
  const seated = collectSeatedPassengerIds(source.logistics?.roadVehicles)
  return new Set(
    source.visitors
      .filter((visitor) => visitor.state === 'injured' && !seated.has(visitor.id))
      .map((visitor) => visitor.id),
  )
}

/**
 * Drops the messages whose reason has gone: the injured carried off or back on
 * their feet, the crowd calmed, the fire out, the dump emptied. They used to
 * stay in the list for the rest of the festival, so the panel filled up with
 * problems that had long been dealt with and there was no telling which ones
 * still needed anybody.
 */
export function pruneResolvedTicker(
  history: readonly TickerItem[],
  source: TickerSource,
): TickerItem[] {
  const injured = injuredIds(source)
  const fires = new Set(
    source.incidents.filter((incident) => incident.kind === 'fire').map((incident) => incident.id),
  )
  const panicking = source.visitors.some(
    (visitor) => visitor.isPanicking || visitor.state === 'panicking',
  )
  const dumpOver = isParkWasteDumpOverFull(source.wasteDumpCells)
  const stillOpen = (item: TickerItem): boolean => {
    // A message from before subjects were recorded falls back to the condition
    // of its kind, which is the best that can be said about it.
    const anySubject = (live: Set<string>): boolean =>
      item.subjects ? item.subjects.some((id) => live.has(id)) : live.size > 0
    if (item.kind === 'medical') return anySubject(injured)
    if (item.kind === 'fire') return anySubject(fires)
    if (item.kind === 'panic') return panicking
    if (item.kind === 'insolvency') return (source.scenarioProgress?.insolventDays ?? 0) > 0
    // Goals and due days are news, not conditions: they stay until the list is full.
    if (item.kind === 'dumpFull') return dumpOver
    return true
  }
  return history.filter(stillOpen)
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
        newFires.map((fire) => fire.id),
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
        fires.map((fire) => fire.id),
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

  const stillHurt = injuredIds(source)
  const injured = source.visitors.filter((visitor) => stillHurt.has(visitor.id))
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
        newInjured.map((visitor) => visitor.id),
      ),
    )
  }
  watch.knownInjuredIds = new Set(injured.map((visitor) => visitor.id))

  items.push(...observeScenarioEvents(source, watch))
  return items
}

/**
 * Goals reached or missed, the last edition before a deadline, insolvency and an
 * overdue edition. All of it is read off the snapshot the host sends, so every
 * player gets the same messages.
 */
function observeScenarioEvents(source: TickerSource, watch: TickerWatchState): TickerItem[] {
  const goals = source.scenario?.goals ?? []
  const progress = source.scenarioProgress
  const festival = source.festival
  if (!progress || !festival) return []
  const runningEdition = festival.enabled && !festival.finished ? festival.edition : 0
  const now = {
    status: [...progress.status],
    runningEdition,
    insolventDays: progress.insolventDays,
    dueReminderDay: progress.dueReminderDay,
  }
  const before = watch.scenario
  watch.scenario = now
  if (!before) return []
  const items: TickerItem[] = []
  goals.forEach((goal, index) => {
    if (before.status[index] === now.status[index]) return
    if (now.status[index] === 'done') {
      items.push(tickerItem('goalDone', source, 'Ziel erreicht', goalName(goal), undefined, 'info', [`goal:${index}`]))
    } else if (now.status[index] === 'failed') {
      items.push(tickerItem('goalFailed', source, 'Ziel verpasst', `${goalName(goal)} bis zur ${goal.edition}. Ausgabe`, undefined, 'alert', [`goal:${index}`]))
    }
  })
  if (runningEdition > 0 && runningEdition !== before.runningEdition) {
    const last = goals.filter((goal, index) => goal.edition === runningEdition && now.status[index] === 'open')
    if (last.length > 0) {
      items.push(tickerItem('goalDeadline', source, 'Letzte Ausgabe für ein Ziel', `Ausgabe ${runningEdition} entscheidet: ${last.map(goalName).join(' · ')}`, undefined, 'warning'))
    }
  }
  if (now.insolventDays > before.insolventDays) {
    const left = insolvencyDaysLeft(now)
    const scenario = goals.length > 0
    if (now.insolventDays === 1) {
      items.push(tickerItem('insolvency', source, 'Zahlungsunfähig', scenario
        ? `Das Konto ist im Minus und der Kreditrahmen deckt es nicht. Noch ${left} Tage, dann ist das Szenario verloren.`
        : 'Das Konto ist im Minus und der Kreditrahmen deckt es nicht. Im freien Spiel geht es weiter, aber die Kosten laufen.', undefined, 'warning'))
    } else if (scenario && left === 1) {
      items.push(tickerItem('insolvency', source, 'Letzter Tag vor der Pleite', 'Bis morgen muss das Konto gedeckt sein, sonst ist das Szenario verloren.', undefined, 'alert'))
    }
  }
  if (now.dueReminderDay !== null && now.dueReminderDay !== before.dueReminderDay) {
    items.push(tickerItem('editionDue', source, 'Stichtag erreicht', 'Die nächste Ausgabe ist fällig. Die Planung ist geöffnet und die Zeit angehalten.', undefined, 'warning'))
  }
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

const TICKER_ICONS: Record<TickerKind, string> = {
  fire: '🔥',
  panic: '😱',
  dumpFull: '🗑️',
  medical: '🚑',
  goalDone: '🏆',
  goalFailed: '⛔',
  goalDeadline: '⏳',
  insolvency: '💸',
  editionDue: '📅',
}

export function tickerKindIcon(kind: TickerKind): string {
  return TICKER_ICONS[kind]
}

export function pickTickerDisplay(items: readonly TickerItem[]): TickerItem | null {
  if (items.length === 0) return null
  const rank = (severity: TickerSeverity) =>
    severity === 'alert' ? 2 : severity === 'warning' ? 1 : 0
  return items.reduce((best, item) =>
    rank(item.severity) >= rank(best.severity) ? item : best,
  )
}
