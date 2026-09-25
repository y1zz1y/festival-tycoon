import assert from 'node:assert/strict'
import { GameState, type GameSnapshot } from '../src/game/GameState'
import { normalizeScenarioSettings } from '../src/game/scenario'
import { SCENARIO_PRESETS } from '../src/game/scenarioPresets'
import { weekendGoals } from '../src/game/festivalManagement'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import { createTickerWatchState, observeTickerEvents, pruneResolvedTicker, type TickerSource } from '../src/game/ticker'
import {
  createScenarioProgress,
  goalName,
  goalProgressText,
  insolvencyDaysLeft,
  isEditionOverdue,
  normalizeScenarioProgress,
  recordEditionResult,
  scenarioScore,
  scenarioStars,
  updateInsolvency,
  updateScenarioProgress,
  type EditionResult,
} from '../src/game/scenarioGoals'

const result = (edition: number, values: Partial<EditionResult> = {}): EditionResult => ({
  edition,
  endDay: edition * 6,
  admissions: 0,
  satisfaction: 50,
  reputation: 50,
  profit: 0,
  ...values,
})

const startScenario = (goals: unknown[], extra: Record<string, unknown> = {}): { game: GameState; s: GameSnapshot } => {
  const game = GameState.startNew(normalizeScenarioSettings({ worldSize: 32, unevenness: 0, goals: goals as never, ...extra }))
  return { game, s: game.snapshot as GameSnapshot }
}

export function testScenarioOutcome(): void {
  // Goal lists: new kinds survive, nonsense goes, percentages stop at 100, a streak
  // never outlasts its deadline.
  const goals = normalizeScenarioSettings({
    goals: [
      { kind: 'admissions', target: 600, edition: 3 },
      { kind: 'satisfaction', target: 140, edition: 2, streak: 2 },
      { kind: 'profit', target: 5_000, edition: 1, streak: 4 },
      { kind: 'nonsense', target: 5, edition: 1 },
    ] as never,
  }).goals
  assert.deepEqual(goals, [
    { kind: 'admissions', target: 600, edition: 3 },
    { kind: 'satisfaction', target: 100, edition: 2, streak: 2 },
    { kind: 'profit', target: 5_000, edition: 1 },
  ])
  assert.ok(goals.every((goal) => goalName(goal).length > 0))
  assert.equal(goalName({ kind: 'admissions', target: 600, edition: 3, streak: 2 }), '600 Anreisen in 2 Ausgaben hintereinander')
  const blank = normalizeScenarioSettings({})
  assert.deepEqual(JSON.parse(JSON.stringify(blank)), blank, 'free play settings survive the network untouched')
  assert.equal('firstEditionDays' in blank || 'festivalGoals' in blank, false, 'unset options are left out, not undefined')

  // Every prepared scenario is playable now, and none asks for the peak crowd any more.
  assert.ok(SCENARIO_PRESETS.every((preset) => !preset.price), 'no preset is locked behind a price')
  assert.ok(SCENARIO_PRESETS.every((preset) => preset.settings.goals.every((goal) => goal.kind !== 'guests')))

  // An old save's progress gets everything it lacks, and normalizing twice changes nothing.
  const host = { day: 12, scenario: { goals: [{ kind: 'money' as const, target: 10, edition: 2 }] } }
  const legacy = normalizeScenarioProgress({ peakGuests: 40, status: ['done'] }, host)
  assert.deepEqual(legacy, {
    peakGuests: 40,
    status: ['done'],
    editions: [],
    outcome: { state: 'running' },
    insolventDays: 0,
    nextEditionDue: 12 + SIMULATION_CONFIG.scenario.firstEditionDays,
    dueReminderDay: null,
  })
  assert.deepEqual(normalizeScenarioProgress(legacy, host), legacy)
  assert.equal(normalizeScenarioProgress(undefined, { day: 3, scenario: { goals: [] } }).nextEditionDue, null, 'free play has no due day')

  // Edition goals are judged on finished editions; a streak needs them in a row.
  const streak = startScenario([{ kind: 'admissions', target: 100, edition: 4, streak: 2 }]).s
  recordEditionResult(streak, result(1, { admissions: 150 }), 2, 2)
  assert.equal(streak.scenarioProgress.status[0], 'open', 'one good edition is not yet a streak of two')
  assert.equal(goalProgressText(streak.scenario.goals[0]!, streak), 'zuletzt 150 · 1 von 2 in Folge')
  recordEditionResult(streak, result(2, { admissions: 90 }), 2, 3)
  recordEditionResult(streak, result(3, { admissions: 120 }), 2, 4)
  assert.equal(streak.scenarioProgress.status[0], 'open', 'a weak edition in between breaks the streak')
  const won = recordEditionResult(streak, result(4, { admissions: 130 }), 2, 5)
  assert.equal(streak.scenarioProgress.status[0], 'done')
  assert.equal(won, true, 'the deciding edition ends the scenario the moment it ends')
  assert.deepEqual(streak.scenarioProgress.outcome, { state: 'won', reason: 'goals', day: streak.day })
  assert.equal(streak.scenarioProgress.nextEditionDue, 4 * 6 + 2, 'the next edition is due when the planned break is over')

  // A missed deadline loses, and the outcome stays as it was decided.
  const missed = startScenario([{ kind: 'profit', target: 1_000, edition: 1 }]).s
  const lost = recordEditionResult(missed, result(1, { profit: -500 }), 2, 2)
  assert.equal(lost, true)
  assert.equal(missed.scenarioProgress.status[0], 'failed')
  assert.equal(missed.scenarioProgress.outcome.state, 'lost')
  recordEditionResult(missed, result(2, { profit: 9_000 }), 2, 3)
  assert.equal(missed.scenarioProgress.outcome.state, 'lost', 'a lost scenario is not won back afterwards')
  assert.equal(updateScenarioProgress(missed, 3), false)

  // Park goals still check every day; the peak crowd counts for the legacy guests goal.
  const park = startScenario([{ kind: 'parkValue', target: 1, edition: 2 }])
  assert.equal(updateScenarioProgress(park.s, 1, { parkValue: 0 }), false)
  assert.equal(updateScenarioProgress(park.s, 1, { parkValue: 5 }), true)
  assert.equal(park.s.scenarioProgress.outcome.state, 'won')

  // Insolvency: below zero with no credit to cover it. A scenario with goals is lost
  // once the grace is used up; free play only keeps count.
  const grace = SIMULATION_CONFIG.scenario.insolvencyGraceDays
  const broke = startScenario([{ kind: 'money', target: 1_000_000, edition: 5 }]).s
  broke.money = -5_000
  broke.finance.loan = 20_000
  for (let day = 1; day <= grace; day++) assert.equal(updateInsolvency(broke, 20_000), false, `day ${day} is within the grace`)
  assert.equal(insolvencyDaysLeft(broke.scenarioProgress), 1)
  assert.equal(updateInsolvency(broke, 20_000), true)
  assert.deepEqual(broke.scenarioProgress.outcome, { state: 'lost', reason: 'insolvent', day: broke.day })
  const credit = startScenario([{ kind: 'money', target: 1_000_000, edition: 5 }]).s
  credit.money = -5_000
  updateInsolvency(credit, 20_000)
  assert.equal(credit.scenarioProgress.insolventDays, 0, 'credit left to borrow is not insolvency')
  credit.finance.loan = 20_000
  updateInsolvency(credit, 20_000)
  credit.money = 100
  updateInsolvency(credit, 20_000)
  assert.equal(credit.scenarioProgress.insolventDays, 0, 'one solvent day starts the count again')
  const sandbox = startScenario([]).s
  sandbox.money = -5_000
  sandbox.finance.loan = 20_000
  for (let day = 0; day < grace + 3; day++) updateInsolvency(sandbox, 20_000)
  assert.equal(sandbox.scenarioProgress.outcome.state, 'running', 'free play never ends over money')
  assert.equal(sandbox.scenarioProgress.insolventDays, grace + 3, 'but it keeps count for the warning')

  // The due day: a scenario starts in planning, so nothing is overdue until the clock
  // runs without an edition. Then the day check pauses and opens the planning again.
  const due = startScenario([{ kind: 'admissions', target: 100, edition: 2 }])
  const dueDay = 1 + SIMULATION_CONFIG.scenario.firstEditionDays
  assert.equal(due.s.scenarioProgress.nextEditionDue, dueDay)
  assert.equal(due.s.festival.planning, true)
  assert.ok(due.game.manageFestival({ type: 'sandbox' }).ok)
  due.s.day = dueDay - 1
  assert.equal(isEditionOverdue(due.s), false)
  due.s.day = dueDay
  assert.equal(isEditionOverdue(due.s), true)
  ;(due.game as unknown as { updateScenarioDay(): void }).updateScenarioDay()
  assert.equal(due.s.festival.planning, true, 'the planning of the next edition is open')
  assert.equal(due.s.speed, 0, 'and the game is paused')
  assert.equal(due.s.scenarioProgress.dueReminderDay, dueDay)
  assert.equal(due.s.festival.goals.guests, weekendGoals(1).guests, 'the planned weekend is the first one')
  assert.equal(isEditionOverdue(due.s), false, 'planning stops the clock, so it cannot fire twice')
  const free = startScenario([])
  free.game.manageFestival({ type: 'sandbox' })
  free.s.day = 400
  assert.equal(isEditionOverdue(free.s), false, 'free play is never overdue')

  // Weekend goals grow with every edition, and prepare sets the next one's.
  assert.deepEqual(weekendGoals(1), SIMULATION_CONFIG.scenario.weekendGoals)
  const third = weekendGoals(3)
  assert.ok(third.guests > weekendGoals(2).guests && weekendGoals(2).guests > weekendGoals(1).guests)
  assert.ok(third.satisfaction > weekendGoals(1).satisfaction && third.satisfaction <= SIMULATION_CONFIG.scenario.weekendGoalGrowth.satisfactionCap)
  assert.ok(third.profit > weekendGoals(1).profit)
  assert.equal(weekendGoals(40).satisfaction, SIMULATION_CONFIG.scenario.weekendGoalGrowth.satisfactionCap)
  const own = startScenario([], { festivalGoals: { guests: 400, satisfaction: 70, profit: 1_000 } }).s
  assert.equal(own.festival.goals.guests, 400, "a scenario's own weekend targets start the series")

  // Through real ticks: the edition ends, its result is kept, the missed deadline
  // decides the scenario and the game pauses for the end screen.
  const run = startScenario([{ kind: 'admissions', target: 50_000, edition: 1 }])
  run.s.dayPlan.leadDays = 0
  run.s.dayPlan.festivalDays = 1
  assert.ok(run.game.manageFestival({ type: 'start' }).ok)
  run.game.setSpeed(3)
  for (let tick = 0; tick < 5000 && !run.s.festival.finished; tick++) run.game.tick(0.1)
  assert.equal(run.s.festival.finished, true)
  assert.equal(run.s.scenarioProgress.editions.length, 1)
  assert.equal(run.s.scenarioProgress.editions[0]!.edition, 1)
  assert.equal(run.s.scenarioProgress.outcome.state, 'lost')
  assert.equal(run.s.speed, 0, 'a decided scenario pauses the game')

  // The ticker: the first look only takes note, then every change is one message.
  const watch = createTickerWatchState()
  const source: TickerSource & Required<Pick<TickerSource, 'scenarioProgress' | 'festival'>> = {
    simTick: 1,
    day: 3,
    minute: 0,
    incidents: [],
    visitors: [],
    wasteDumpCells: [],
    scenario: { goals: [{ kind: 'money', target: 10, edition: 1 }, { kind: 'admissions', target: 500, edition: 2 }, { kind: 'loanFree', edition: 3 }] },
    scenarioProgress: { status: ['done', 'open', 'open'], insolventDays: 0, dueReminderDay: null },
    festival: { edition: 0, enabled: false, finished: false },
  }
  assert.deepEqual(observeTickerEvents(source, watch), [], 'a goal reached before loading is no news')
  source.scenarioProgress = { ...source.scenarioProgress, status: ['done', 'done', 'failed'] }
  source.simTick = 2
  const decided = observeTickerEvents(source, watch)
  assert.deepEqual(decided.map((item) => item.kind), ['goalDone', 'goalFailed'])
  assert.notEqual(decided[0]!.id, decided[1]!.id, 'two goals decided in one tick keep apart')
  source.scenarioProgress = { ...source.scenarioProgress, status: ['done', 'open', 'open'] }
  observeTickerEvents(source, watch)
  source.festival = { edition: 2, enabled: true, finished: false }
  assert.deepEqual(observeTickerEvents(source, watch).map((item) => item.kind), ['goalDeadline'], 'the last edition before a deadline is announced')
  assert.deepEqual(observeTickerEvents(source, watch), [], 'once')
  source.scenarioProgress = { ...source.scenarioProgress, insolventDays: 1 }
  const warned = observeTickerEvents(source, watch)
  assert.deepEqual(warned.map((item) => [item.kind, item.severity]), [['insolvency', 'warning']])
  source.scenarioProgress = { ...source.scenarioProgress, insolventDays: SIMULATION_CONFIG.scenario.insolvencyGraceDays }
  assert.deepEqual(observeTickerEvents(source, watch).map((item) => [item.kind, item.severity]), [['insolvency', 'alert']], 'the last day is an alert')
  source.scenarioProgress = { ...source.scenarioProgress, insolventDays: 0 }
  assert.deepEqual(pruneResolvedTicker(warned, source), [], 'the warning goes once the money is back')
  source.scenarioProgress = { ...source.scenarioProgress, dueReminderDay: 9 }
  assert.deepEqual(observeTickerEvents(source, watch).map((item) => item.kind), ['editionDue'])
  assert.equal(pruneResolvedTicker(decided, source).length, 2, 'goal news stays in the list')

  // The mark: half goals, a quarter each satisfaction and reputation.
  const progress = createScenarioProgress([{ kind: 'loanFree', edition: 1 }, { kind: 'loanFree', edition: 1 }])
  progress.status = ['done', 'failed']
  progress.editions = [result(1, { satisfaction: 80, reputation: 60 })]
  assert.equal(scenarioScore(progress), 25 + 20 + 15)
  assert.equal(scenarioStars(60), 3)
  assert.equal(scenarioStars(0), 1)
}
