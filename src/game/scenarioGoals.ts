import type { EditionGoal, EditionGoalKind, ScenarioGoal } from './scenario'
import { SIMULATION_CONFIG } from './simulationConfig'

/**
 * Whether the park is on its way to what the scenario asked for. Deadlines count in
 * festival editions (see finance.ts): a goal is missed once the edition after its
 * deadline has begun, and once reached it stays reached — a goal cannot be lost
 * again by spending the money afterwards.
 *
 * A scenario with goals ends: won once every goal is reached, lost once one is
 * missed or the park stays insolvent too long. Without goals it is free play and
 * never ends; insolvency there only warns.
 */
export type GoalStatus = 'open' | 'done' | 'failed'

/** What one finished edition achieved. Edition goals and the end screen read this. */
export type EditionResult = {
  edition: number
  /** The day the edition ended on. */
  endDay: number
  admissions: number
  /** Mean satisfaction of its festival days, in percent. */
  satisfaction: number
  /** Mean of the four reputation values when it ended. */
  reputation: number
  /** The edition's finance column, preparation included, in euro. */
  profit: number
}

export type ScenarioOutcomeState = 'running' | 'won' | 'lost'
export type ScenarioOutcomeReason = 'goals' | 'deadline' | 'insolvent'
export type ScenarioOutcome = {
  state: ScenarioOutcomeState
  reason?: ScenarioOutcomeReason
  day?: number
}

export type ScenarioProgress = {
  /** The most guests ever on the site at once: what a `guests` goal is measured against. */
  peakGuests: number
  status: GoalStatus[]
  editions: EditionResult[]
  /** Final once it leaves `running`: a won scenario keeps being won while play goes on. */
  outcome: ScenarioOutcome
  /** Day checks in a row that found the park insolvent. */
  insolventDays: number
  /** The day the next edition is due; null without goals. */
  nextEditionDue: number | null
  /**
   * The last day the game paused and opened the planning because an edition was
   * overdue. Every client opens its planning window when this changes.
   */
  dueReminderDay: number | null
}

type GoalHost = {
  day: number
  money: number
  guests: number
  finance: { loan: number }
  scenario: { goals: ScenarioGoal[]; firstEditionDays?: number }
  scenarioProgress: ScenarioProgress
  festival: { enabled: boolean; finished: boolean; edition: number; planning?: boolean }
}

/** Values the pure goal checks cannot work out from the snapshot fields they see. */
export type GoalContext = { parkValue?: number }

const euro = (value: number): string => `${Math.round(value).toLocaleString('de-DE')} €`
const count = (value: number): string => Math.round(value).toLocaleString('de-DE')

export function hasScenarioGoals(s: { scenario: { goals: readonly ScenarioGoal[] } }): boolean {
  return s.scenario.goals.length > 0
}

/** The day the first edition is due, counted from the day the scenario started. */
export function firstEditionDue(
  scenario: { goals: readonly ScenarioGoal[]; firstEditionDays?: number },
  startDay: number,
): number | null {
  if (scenario.goals.length === 0) return null
  return startDay + (scenario.firstEditionDays ?? SIMULATION_CONFIG.scenario.firstEditionDays)
}

export function createScenarioProgress(
  goals: readonly ScenarioGoal[] = [],
  nextEditionDue: number | null = null,
): ScenarioProgress {
  return {
    peakGuests: 0,
    status: goals.map(() => 'open'),
    editions: [],
    outcome: { state: 'running' },
    insolventDays: 0,
    nextEditionDue,
    dueReminderDay: null,
  }
}

const finiteOr = <T>(value: unknown, fallback: T): number | T =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

function normalizeEditionResult(raw: unknown): EditionResult | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<EditionResult>
  const edition = finiteOr(value.edition, NaN)
  if (!Number.isInteger(edition) || edition < 1) return null
  return {
    edition,
    endDay: finiteOr(value.endDay, 0),
    admissions: finiteOr(value.admissions, 0),
    satisfaction: finiteOr(value.satisfaction, 0),
    reputation: finiteOr(value.reputation, 0),
    profit: finiteOr(value.profit, 0),
  }
}

function normalizeOutcome(raw: unknown): ScenarioOutcome {
  const value = (raw ?? {}) as Partial<ScenarioOutcome>
  if (value.state !== 'won' && value.state !== 'lost') return { state: 'running' }
  const reason = value.reason === 'goals' || value.reason === 'deadline' || value.reason === 'insolvent'
    ? value.reason
    : value.state === 'won' ? 'goals' : 'deadline'
  const day = finiteOr(value.day, null)
  return { state: value.state, reason, ...(day === null ? {} : { day }) }
}

/**
 * Fills in what an older save's progress does not carry yet and drops what does
 * not belong. Runs on load and after every repair, so it has to leave already
 * normalized progress exactly as it is. An old save with goals gets its first due
 * day counted from the day it is loaded, so nobody is stopped on the spot.
 */
export function normalizeScenarioProgress(
  raw: unknown,
  host: { day: number; scenario: { goals: readonly ScenarioGoal[]; firstEditionDays?: number } },
): ScenarioProgress {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<ScenarioProgress>
  const goals = host.scenario.goals
  const status = goals.map((_, index): GoalStatus => {
    const entry = Array.isArray(source.status) ? source.status[index] : undefined
    return entry === 'done' || entry === 'failed' ? entry : 'open'
  })
  const editions = (Array.isArray(source.editions) ? source.editions : [])
    .map(normalizeEditionResult)
    .filter((entry): entry is EditionResult => entry !== null)
    .sort((left, right) => left.edition - right.edition)
  const nextEditionDue = 'nextEditionDue' in source
    ? finiteOr(source.nextEditionDue, null)
    : firstEditionDue(host.scenario, host.day)
  return {
    peakGuests: Math.max(0, finiteOr(source.peakGuests, 0)),
    status,
    editions,
    outcome: normalizeOutcome(source.outcome),
    insolventDays: Math.max(0, Math.floor(finiteOr(source.insolventDays, 0))),
    nextEditionDue: goals.length > 0 ? nextEditionDue : null,
    dueReminderDay: finiteOr(source.dueReminderDay, null),
  }
}

function editionValue(kind: EditionGoalKind, result: EditionResult): number {
  return result[kind]
}

function formatEditionValue(kind: EditionGoalKind, value: number): string {
  if (kind === 'satisfaction') return `${Math.round(value)} %`
  if (kind === 'profit') return euro(value)
  return count(value)
}

/** The run of editions in a row, ending with the latest, that met the target. */
function editionRun(goal: EditionGoal, editions: readonly EditionResult[]): number {
  let run = 0
  let expected: number | null = null
  for (let index = editions.length - 1; index >= 0; index--) {
    const result = editions[index]!
    if (expected !== null && result.edition !== expected) break
    if (editionValue(goal.kind, result) < goal.target) break
    run += 1
    expected = result.edition - 1
  }
  return run
}

/**
 * An edition goal is met once `streak` editions in a row, none after the deadline,
 * all reached the target. Without a streak one edition is enough.
 */
function editionGoalMet(goal: EditionGoal, editions: readonly EditionResult[]): boolean {
  const eligible = editions.filter((result) => result.edition <= goal.edition)
  const streak = goal.streak ?? 1
  for (let end = streak - 1; end < eligible.length; end++) {
    if (editionRun(goal, eligible.slice(0, end + 1)) >= streak) return true
  }
  return false
}

export function goalReached(goal: ScenarioGoal, s: GoalHost, context: GoalContext = {}): boolean {
  if (goal.kind === 'guests') return s.scenarioProgress.peakGuests >= goal.target
  if (goal.kind === 'money') return s.money >= goal.target
  if (goal.kind === 'parkValue') return (context.parkValue ?? 0) >= goal.target
  if (goal.kind === 'loanFree') return s.finance.loan <= 0
  return editionGoalMet(goal, s.scenarioProgress.editions)
}

export function goalName(goal: ScenarioGoal): string {
  if (goal.kind === 'guests') return `${count(goal.target)} Besucher gleichzeitig`
  if (goal.kind === 'money') return `${euro(goal.target)} Guthaben`
  if (goal.kind === 'parkValue') return `${euro(goal.target)} Festivalwert`
  if (goal.kind === 'loanFree') return 'Darlehen vollständig getilgt'
  const within = goal.streak ? ` in ${goal.streak} Ausgaben hintereinander` : ' in einer Ausgabe'
  if (goal.kind === 'admissions') return `${count(goal.target)} Anreisen${within}`
  if (goal.kind === 'satisfaction') return `${goal.target} % Zufriedenheit${within}`
  if (goal.kind === 'reputation') return `Ruf von ${goal.target}${within}`
  return `${euro(goal.target)} Gewinn${within}`
}

export function goalProgressText(goal: ScenarioGoal, s: GoalHost, context: GoalContext = {}): string {
  if (goal.kind === 'guests') return `${count(s.scenarioProgress.peakGuests)} erreicht`
  if (goal.kind === 'money') return `${euro(s.money)} vorhanden`
  if (goal.kind === 'parkValue') return `${euro(context.parkValue ?? 0)} erreicht`
  if (goal.kind === 'loanFree') return s.finance.loan > 0 ? `noch ${euro(s.finance.loan)} offen` : 'getilgt'
  const editions = s.scenarioProgress.editions
  const latest = editions.at(-1)
  if (!latest) return 'noch keine Ausgabe beendet'
  const last = `zuletzt ${formatEditionValue(goal.kind, editionValue(goal.kind, latest))}`
  return goal.streak ? `${last} · ${Math.min(goal.streak, editionRun(goal, editions))} von ${goal.streak} in Folge` : last
}

/** Marks goals reached or missed. Reached is for good; missed once the deadline edition is over. */
function updateGoalStatuses(s: GoalHost, currentEdition: number, context: GoalContext): void {
  const progress = s.scenarioProgress
  const goals = s.scenario.goals
  if (progress.status.length !== goals.length) progress.status = goals.map((_, index) => progress.status[index] ?? 'open')
  goals.forEach((goal, index) => {
    if (progress.status[index] !== 'open') return
    if (goalReached(goal, s, context)) progress.status[index] = 'done'
    else if (currentEdition > goal.edition) progress.status[index] = 'failed'
  })
}

/**
 * Decides the scenario once its goals allow it: every goal reached wins, one missed
 * loses. The outcome is final; after a win the park simply plays on.
 * Returns whether the outcome changed just now.
 */
export function resolveScenarioOutcome(s: GoalHost): boolean {
  const progress = s.scenarioProgress
  if (progress.outcome.state !== 'running' || !hasScenarioGoals(s)) return false
  if (progress.status.some((status) => status === 'failed')) {
    progress.outcome = { state: 'lost', reason: 'deadline', day: s.day }
    return true
  }
  if (progress.status.every((status) => status === 'done')) {
    progress.outcome = { state: 'won', reason: 'goals', day: s.day }
    return true
  }
  return false
}

/**
 * Runs once a day. Reaching a goal is recorded for good; missing its deadline is
 * recorded once the following edition has started, so the last festival of the
 * deadline still counts in full. Returns whether the scenario was just decided.
 */
export function updateScenarioProgress(s: GoalHost, currentEdition: number, context: GoalContext = {}): boolean {
  const progress = s.scenarioProgress
  progress.peakGuests = Math.max(progress.peakGuests, s.guests)
  updateGoalStatuses(s, currentEdition, context)
  return resolveScenarioOutcome(s)
}

/**
 * Runs the moment an edition ends. Keeps its result, judges the edition goals on
 * it straight away (so the deciding edition ends the scenario at once rather than
 * a day later) and sets when the next edition is due: after the break the day
 * plan asks for. Returns whether the scenario was just decided.
 */
export function recordEditionResult(
  s: GoalHost,
  result: EditionResult,
  breakDays: number,
  currentEdition: number,
  context: GoalContext = {},
): boolean {
  const progress = s.scenarioProgress
  progress.editions = [...progress.editions.filter((entry) => entry.edition !== result.edition), result]
    .sort((left, right) => left.edition - right.edition)
  if (hasScenarioGoals(s)) progress.nextEditionDue = result.endDay + Math.max(1, Math.floor(breakDays))
  updateGoalStatuses(s, currentEdition, context)
  return resolveScenarioOutcome(s)
}

/** Below zero, with not enough credit left to cover it. */
export function isInsolvent(s: { money: number; finance: { loan: number } }, creditLimit: number): boolean {
  return s.money < 0 && creditLimit - s.finance.loan < -s.money
}

/** Days of grace left before an insolvent scenario is lost; 0 when it already is. */
export function insolvencyDaysLeft(progress: Pick<ScenarioProgress, 'insolventDays'>): number {
  if (progress.insolventDays <= 0) return SIMULATION_CONFIG.scenario.insolvencyGraceDays + 1
  return Math.max(0, SIMULATION_CONFIG.scenario.insolvencyGraceDays + 1 - progress.insolventDays)
}

/**
 * Runs once a day. Counts the insolvent days in a row; any solvent day starts the
 * count again. A scenario with goals is lost once the grace is used up. Free play
 * keeps counting, which is what its warnings read. Returns whether the scenario
 * was just decided.
 */
export function updateInsolvency(s: GoalHost, creditLimit: number): boolean {
  const progress = s.scenarioProgress
  progress.insolventDays = isInsolvent(s, creditLimit) ? progress.insolventDays + 1 : 0
  if (progress.outcome.state !== 'running' || !hasScenarioGoals(s)) return false
  if (insolvencyDaysLeft(progress) > 0) return false
  progress.outcome = { state: 'lost', reason: 'insolvent', day: s.day }
  return true
}

/**
 * Whether the next edition is overdue: a scenario still being played, past its due
 * day, with no edition running and none being planned. Planning stops the clock,
 * so while it is open this cannot come true again.
 */
export function isEditionOverdue(s: GoalHost): boolean {
  const progress = s.scenarioProgress
  if (progress.outcome.state !== 'running' || progress.nextEditionDue === null) return false
  const f = s.festival
  if (f.planning || (f.enabled && !f.finished)) return false
  return s.day >= progress.nextEditionDue
}

export function scenarioSummary(s: Pick<GoalHost, 'scenarioProgress'>): { open: number; done: number; failed: number } {
  const status = s.scenarioProgress.status
  return {
    open: status.filter((entry) => entry === 'open').length,
    done: status.filter((entry) => entry === 'done').length,
    failed: status.filter((entry) => entry === 'failed').length,
  }
}

/**
 * The overall mark, 0–100: half from the goals reached, a quarter each from the
 * mean satisfaction and mean reputation of the editions played.
 */
export function scenarioScore(progress: Pick<ScenarioProgress, 'status' | 'editions'>): number {
  const goals = progress.status.length
  const goalShare = goals ? progress.status.filter((entry) => entry === 'done').length / goals : 0
  const editions = progress.editions
  const mean = (pick: (result: EditionResult) => number): number =>
    editions.length ? editions.reduce((sum, result) => sum + pick(result), 0) / editions.length : 0
  const score = goalShare * 50 + mean((result) => result.satisfaction) * .25 + mean((result) => result.reputation) * .25
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function scenarioStars(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score / 20)))
}

