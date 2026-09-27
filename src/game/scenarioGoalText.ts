// i18n: client-text
import type { EditionGoal, EditionGoalKind, ScenarioGoal } from './scenario'
import { editionRun, type GoalContext, type ScenarioProgress } from './scenarioGoals'
import { formatMoney, formatNumber, formatPercent, joinParts, t } from '../i18n'

/**
 * Goal names and progress lines for the scenario panels, the title screen and the
 * ticker. Display only: every client builds them in its own language from the
 * snapshot (docs/i18n.md), so authoritative code never imports this module.
 */
type GoalTextHost = {
  money: number
  finance: { loan: number }
  scenarioProgress: Pick<ScenarioProgress, 'peakGuests' | 'editions'>
}

/** Whole euros, rounded as the goal texts always were (formatMoney alone floors). */
const euro = (value: number): string => formatMoney(Math.round(value))

function formatEditionValue(kind: EditionGoalKind, value: number): string {
  if (kind === 'satisfaction') return formatPercent(Math.round(value))
  if (kind === 'profit') return euro(value)
  return formatNumber(Math.round(value))
}

/** Edition goals, one full template per goal kind and per streak or single edition. */
function editionGoalName(goal: EditionGoal): string {
  const streak = goal.streak
  if (goal.kind === 'admissions') {
    const count = Math.round(goal.target)
    return streak ? t`${count} Anreisen in ${streak} Ausgaben hintereinander` : t`${count} Anreisen in einer Ausgabe`
  }
  if (goal.kind === 'satisfaction') {
    return streak ? t`${goal.target} % Zufriedenheit in ${streak} Ausgaben hintereinander` : t`${goal.target} % Zufriedenheit in einer Ausgabe`
  }
  if (goal.kind === 'reputation') {
    return streak ? t`Ruf von ${goal.target} in ${streak} Ausgaben hintereinander` : t`Ruf von ${goal.target} in einer Ausgabe`
  }
  const profit = euro(goal.target)
  return streak ? t`${profit} Gewinn in ${streak} Ausgaben hintereinander` : t`${profit} Gewinn in einer Ausgabe`
}

export function goalName(goal: ScenarioGoal): string {
  if (goal.kind === 'guests') return t`${Math.round(goal.target)} Besucher gleichzeitig`
  if (goal.kind === 'money') return t`${euro(goal.target)} Guthaben`
  if (goal.kind === 'parkValue') return t`${euro(goal.target)} Festivalwert`
  if (goal.kind === 'loanFree') return t('Darlehen vollständig getilgt')
  return editionGoalName(goal)
}

/** The goal together with the edition it has to be reached by. */
export function goalWithDeadline(goal: ScenarioGoal): string {
  return t`${goalName(goal)} bis zur ${String(goal.edition)}. Ausgabe`
}

export function goalProgressText(goal: ScenarioGoal, s: GoalTextHost, context: GoalContext = {}): string {
  if (goal.kind === 'guests') return t`${formatNumber(Math.round(s.scenarioProgress.peakGuests))} erreicht`
  if (goal.kind === 'money') return t`${euro(s.money)} vorhanden`
  if (goal.kind === 'parkValue') return t`${euro(context.parkValue ?? 0)} erreicht`
  if (goal.kind === 'loanFree') return s.finance.loan > 0 ? t`noch ${euro(s.finance.loan)} offen` : t('getilgt')
  const editions = s.scenarioProgress.editions
  const latest = editions.at(-1)
  if (!latest) return t('noch keine Ausgabe beendet')
  const last = t`zuletzt ${formatEditionValue(goal.kind, latest[goal.kind])}`
  return goal.streak
    ? joinParts(last, t`${Math.min(goal.streak, editionRun(goal, editions))} von ${goal.streak} in Folge`)
    : last
}
