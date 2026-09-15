import assert from 'node:assert/strict'
import { GameState, type GameSnapshot } from '../src/game/GameState'
import { normalizeScenarioSettings } from '../src/game/scenario'
import { SCENARIO_PRESETS, scenarioPreset } from '../src/game/scenarioPresets'
import { bookFinance, financeEdition, financePeriodTotal, loanInterest, loanLimit, rollFinanceDay, LOAN } from '../src/game/finance'
import { goalName, updateScenarioProgress } from '../src/game/scenarioGoals'

export function testFinance(): void {
  // Every euro that moves is booked, and the columns are festival editions.
  const game = GameState.startNew(normalizeScenarioSettings({ worldSize: 32, unevenness: 0, startingMoney: 50_000 }))
  const s = game.snapshot as GameSnapshot
  assert.deepEqual(s.finance, { loan: 0, periods: [], today: {}, previousDay: {} }, 'a fresh park owes nothing and has booked nothing')
  assert.equal(financeEdition(s), 1, 'everything before the first festival belongs to the first edition')

  const before = s.money
  assert.ok(game.place('food', 4, 4).ok)
  assert.equal(s.finance.periods.length, 1, 'the first booking opens the first column')
  assert.equal(s.finance.periods[0]!.edition, 1)
  const built = s.finance.periods[0]!.entries.construction ?? 0
  assert.ok(built < 0, 'building is money leaving')
  assert.equal(Math.round(s.money), Math.round(before + built), 'the books and the cash box agree')

  // Income lands in its own row rather than in the same pot as construction.
  bookFinance(s, 'tickets', 120)
  assert.equal(s.finance.periods[0]!.entries.tickets, 120)
  assert.equal(Math.round(financePeriodTotal(s.finance.periods[0]!)), Math.round(built + 120))

  // A new edition starts a new column instead of overwriting the old one.
  s.festival.edition = 1
  s.festival.enabled = true
  s.festival.finished = true
  assert.equal(financeEdition(s), 2, 'once an edition is over, spending prepares the next')
  bookFinance(s, 'bands', -500)
  assert.equal(s.finance.periods.length, 2)
  assert.equal(s.finance.periods[1]!.edition, 2)
  assert.equal(s.finance.periods[1]!.entries.bands, -500)
  assert.equal(s.finance.periods[0]!.entries.tickets, 120, 'the previous column stays as it was')

  // Borrowing and repaying move money between cash and debt — never through the table.
  const bank = GameState.startNew(normalizeScenarioSettings({ worldSize: 32, unevenness: 0, startingMoney: 10_000 }))
  const b = bank.snapshot as GameSnapshot
  const limit = bank.financeOverview().loanLimit
  assert.equal(limit, loanLimit(bank.parkValue()))
  assert.equal(bank.manageLoan({ type: 'borrow', amount: limit + LOAN.step }).ok, false, 'the bank has a ceiling')
  assert.ok(bank.manageLoan({ type: 'borrow', amount: 5_000 }).ok)
  assert.equal(b.finance.loan, 5_000)
  assert.equal(b.money, 15_000, 'the loan is paid out in cash')
  assert.equal(b.finance.periods.length, 0, 'a loan is not income and is not booked')

  // Interest is charged while the day runs, and it is booked.
  const dailyInterest = loanInterest(b.finance.loan, 1)
  assert.ok(dailyInterest > 0)
  const moneyBeforeInterest = b.money
  // The clock only runs once the festival has been started — while planning, time (and
  // with it every cost) stands still. A tick is also clamped to a few simulation steps,
  // so an hour of park time takes a run of them; the economy settles up once an hour.
  b.festival.planning = false
  for (let n = 0; n < 700; n++) bank.tick(0.1)
  assert.ok(b.money < moneyBeforeInterest, 'interest and running costs leave the cash box')
  assert.ok((b.finance.periods[0]?.entries.interest ?? 0) < 0, 'interest is a row of its own')

  assert.equal(bank.manageLoan({ type: 'repay', amount: 2_000 }).ok, true)
  assert.equal(b.finance.loan, 3_000)
  assert.equal(bank.manageLoan({ type: 'repay', amount: 999_999 }).ok, true, 'repaying more than is owed pays off the rest')
  assert.equal(b.finance.loan, 0)
  assert.equal(bank.manageLoan({ type: 'repay', amount: 100 }).ok, false, 'with nothing owed there is nothing to repay')

  // The forecast: running costs calculated, visitor income carried over from the last full day.
  const forecastGame = GameState.startNew(normalizeScenarioSettings({ worldSize: 32, unevenness: 0, startingMoney: 80_000 }))
  const f = forecastGame.snapshot as GameSnapshot
  const bare = forecastGame.financeForecast()
  assert.ok((bare.upkeep ?? 0) < 0, 'what already stands on the site costs upkeep tomorrow')
  assert.equal(bare.tickets, undefined, 'without a day of takings there is nothing to carry over')
  assert.ok(forecastGame.place('food', 4, 4).ok)
  const withStand = forecastGame.financeForecast()
  assert.ok((withStand.upkeep ?? 0) < (bare.upkeep ?? 0), 'one more stand is one more day of upkeep')
  assert.equal(withStand.construction, undefined, 'what was built today is not predicted for tomorrow')
  assert.ok(forecastGame.manageLoan({ type: 'borrow', amount: 10_000 }).ok)
  assert.equal(
    Math.round((forecastGame.financeForecast().interest ?? 0) * 100) / 100,
    -loanInterest(10_000, 1),
    'tomorrow costs exactly one day of interest',
  )
  // Yesterday's takings are what tomorrow is expected to bring.
  bookFinance(f, 'tickets', 400)
  bookFinance(f, 'sales', 90)
  rollFinanceDay(f.finance)
  assert.equal(forecastGame.financeForecast().tickets, 400)
  assert.equal(forecastGame.financeForecast().sales, 90)
  assert.deepEqual(f.finance.today, {}, 'the new day starts with an empty page')
  bookFinance(f, 'tickets', 10)
  assert.equal(forecastGame.financeForecast().tickets, 400, 'the forecast keeps to the last full day')

  // Prepared scenarios carry their own site, debt and goals.
  assert.equal(SCENARIO_PRESETS.length, 4)
  for (const preset of SCENARIO_PRESETS) {
    const settings = normalizeScenarioSettings({ ...preset.settings, preset: preset.id })
    assert.equal(settings.preset, preset.id)
    assert.deepEqual(settings.goals, preset.settings.goals, `${preset.id} keeps its goals`)
    const started = GameState.startNew(settings).snapshot as GameSnapshot
    assert.equal(started.scenario.worldSize, preset.settings.worldSize)
    assert.equal(started.scenario.environment, preset.settings.environment)
    assert.equal(started.finance.loan, preset.settings.startingLoan, `${preset.id} starts with its debt`)
    assert.equal(started.scenarioProgress.status.length, preset.settings.goals.length)
    assert.ok(preset.settings.goals.every((goal) => goalName(goal).length > 0))
  }
  assert.equal(scenarioPreset('woodstock')?.name, 'Woodstock')
  assert.equal(scenarioPreset('does-not-exist'), undefined)
  assert.deepEqual(normalizeScenarioSettings({ goals: [{ kind: 'guests', target: -5, edition: 2 }] as never }).goals, [], 'nonsense goals are dropped')

  // Goals: reached stays reached, and a missed deadline is recorded once the next edition begins.
  const quest = GameState.startNew(normalizeScenarioSettings({
    worldSize: 32,
    unevenness: 0,
    startingLoan: 4_000,
    goals: [
      { kind: 'guests', target: 3, edition: 2 },
      { kind: 'loanFree', edition: 1 },
    ],
  }))
  const q = quest.snapshot as GameSnapshot
  assert.deepEqual(q.scenarioProgress.status, ['open', 'open'])
  q.guests = 5
  updateScenarioProgress(q, financeEdition(q))
  assert.equal(q.scenarioProgress.status[0], 'done', 'the peak crowd counts, not the crowd right now')
  q.guests = 0
  updateScenarioProgress(q, financeEdition(q))
  assert.equal(q.scenarioProgress.status[0], 'done', 'a reached goal cannot be lost again')
  updateScenarioProgress(q, 2)
  assert.equal(q.scenarioProgress.status[1], 'failed', 'the loan goal is missed once the second edition has begun')
  assert.equal(quest.financeOverview().companyValue, Math.round(quest.parkValue() + q.money - q.finance.loan))
}
