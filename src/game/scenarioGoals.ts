import type { ScenarioGoal } from './scenario'

/**
 * Whether the park is on its way to what the scenario asked for. Deadlines count in
 * festival editions (see finance.ts): a goal is missed once the edition after its
 * deadline has begun, and once reached it stays reached — a goal cannot be lost
 * again by spending the money afterwards.
 */
export type GoalStatus = 'open' | 'done' | 'failed'
export type ScenarioProgress = {
  /** The most guests ever on the site at once: what a visitor goal is measured against. */
  peakGuests: number
  status: GoalStatus[]
}

type GoalHost = {
  money: number
  guests: number
  finance: { loan: number }
  scenario: { goals: ScenarioGoal[] }
  scenarioProgress: ScenarioProgress
  festival: { enabled: boolean; finished: boolean; edition: number }
}

export function createScenarioProgress(goals: readonly ScenarioGoal[] = []): ScenarioProgress {
  return { peakGuests: 0, status: goals.map(() => 'open') }
}

export function goalReached(goal: ScenarioGoal, s: GoalHost): boolean {
  if (goal.kind === 'guests') return s.scenarioProgress.peakGuests >= goal.target
  if (goal.kind === 'money') return s.money >= goal.target
  return s.finance.loan <= 0
}

export function goalName(goal: ScenarioGoal): string {
  if (goal.kind === 'guests') return `${goal.target.toLocaleString('de-DE')} Besucher gleichzeitig`
  if (goal.kind === 'money') return `${goal.target.toLocaleString('de-DE')} € Guthaben`
  return 'Darlehen vollständig getilgt'
}

export function goalProgressText(goal: ScenarioGoal, s: GoalHost): string {
  if (goal.kind === 'guests') return `${s.scenarioProgress.peakGuests.toLocaleString('de-DE')} erreicht`
  if (goal.kind === 'money') return `${Math.round(s.money).toLocaleString('de-DE')} € vorhanden`
  return s.finance.loan > 0 ? `noch ${Math.round(s.finance.loan).toLocaleString('de-DE')} € offen` : 'getilgt'
}

/**
 * Runs once a day. Reaching a goal is recorded for good; missing its deadline is
 * recorded once the following edition has started, so the last festival of the
 * deadline still counts in full.
 */
export function updateScenarioProgress(s: GoalHost, currentEdition: number): void {
  const progress = s.scenarioProgress
  progress.peakGuests = Math.max(progress.peakGuests, s.guests)
  const goals = s.scenario.goals
  if (progress.status.length !== goals.length) progress.status = goals.map((_, index) => progress.status[index] ?? 'open')
  goals.forEach((goal, index) => {
    if (progress.status[index] !== 'open') return
    if (goalReached(goal, s)) progress.status[index] = 'done'
    else if (currentEdition > goal.edition) progress.status[index] = 'failed'
  })
}

export function scenarioSummary(s: GoalHost): { open: number; done: number; failed: number } {
  const status = s.scenarioProgress.status
  return {
    open: status.filter((entry) => entry === 'open').length,
    done: status.filter((entry) => entry === 'done').length,
    failed: status.filter((entry) => entry === 'failed').length,
  }
}
