/**
 * The park's books. Every euro that moves is booked through `bookFinance`, which
 * writes it into the current column of the finance table as well as onto the
 * balance, so the overview can always say where the money went.
 *
 * A column is one festival edition: this game has no calendar months, its year is
 * the festival. Everything spent while an edition is being prepared and run lands
 * in that edition's column, which is also the unit the scenario goals count in.
 */
export const FINANCE_CATEGORIES = [
  'tickets',
  'camping',
  'rides',
  'sales',
  'stock',
  'construction',
  'landscaping',
  'upkeep',
  'staff',
  'bands',
  'interest',
] as const
export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number]

export const FINANCE_CATEGORY_NAMES: Record<FinanceCategory, string> = {
  tickets: 'Tagestickets',
  camping: 'Campingtickets',
  rides: 'Fahrgeschäfte',
  sales: 'Essen & Getränke',
  stock: 'Wareneinkauf',
  construction: 'Bau & Anschaffung',
  landscaping: 'Gelände',
  upkeep: 'Betriebskosten',
  staff: 'Personal',
  bands: 'Gagen',
  interest: 'Kreditzinsen',
}

export type FinanceEntries = Partial<Record<FinanceCategory, number>>
export type FinancePeriod = { edition: number; entries: FinanceEntries }
export type FinanceState = {
  loan: number
  periods: FinancePeriod[]
  /** Booked since midnight, and the last full day — what the forecast column extrapolates from. */
  today: FinanceEntries
  previousDay: FinanceEntries
}

/** What one carrier with a handcart costs per minute on the move (see depotCarriers/supplyChain, which book it as they walk). */
export const CARRIER_WAGE_PER_MINUTE = .04

/** How many editions the table keeps. Older columns fall off the left the way they do in every tycoon ledger. */
export const FINANCE_PERIOD_LIMIT = 8

export const LOAN = {
  /** Ceiling on what the bank hands out, before the park has proven anything. */
  baseLimit: 20_000,
  /** …plus this much for every euro of park value, so a grown park can borrow more. */
  limitPerParkValue: 1.5,
  hardLimit: 250_000,
  step: 1_000,
  /** Charged on the outstanding sum once a day, booked as `interest`. 0.4 % a day is roughly a quarter of the sum over a festival year. */
  interestPerDay: 0.004,
} as const

/** Just enough of the snapshot for the books; spelled out here so this module stays free of a cycle back to GameState. */
type FinanceHost = {
  money: number
  finance: FinanceState
  festival: { enabled: boolean; finished: boolean; edition: number }
}

export function createFinanceState(loan = 0): FinanceState {
  return { loan, periods: [], today: {}, previousDay: {} }
}

/**
 * Categories that recur on their own: the park keeps paying them tomorrow whether
 * anyone decides anything or not, which is what makes a forecast possible at all.
 * Building a ride or booking a band is a decision, not a prediction, so those rows
 * stay out of the forecast.
 */
export const FINANCE_FIXED_CATEGORIES: FinanceCategory[] = ['upkeep', 'staff', 'interest']
export const FINANCE_RECURRING_CATEGORIES: FinanceCategory[] = ['tickets', 'camping', 'rides', 'sales', 'stock']

/** Closes the day's page: yesterday becomes the basis for the forecast, today starts empty. */
export function rollFinanceDay(finance: FinanceState): void {
  finance.previousDay = finance.today
  finance.today = {}
}

/**
 * The edition the books are currently writing into: the one being run while a
 * festival is on, otherwise the next one — everything spent between two festivals
 * is spent preparing the next, so that is where it belongs.
 */
export function financeEdition(s: FinanceHost): number {
  const f = s.festival
  return Math.max(1, f.enabled && !f.finished ? f.edition : f.edition + 1)
}

export function bookFinance(s: FinanceHost, category: FinanceCategory, amount: number): void {
  s.money += amount
  if (!amount || !Number.isFinite(amount)) return
  const finance = (s.finance ??= createFinanceState())
  const edition = financeEdition(s)
  let period = finance.periods.at(-1)
  if (!period || period.edition !== edition) {
    period = { edition, entries: {} }
    finance.periods.push(period)
    if (finance.periods.length > FINANCE_PERIOD_LIMIT) finance.periods.shift()
  }
  // Cents, not floating-point dust: wages and interest are fractions of a cent per tick.
  period.entries[category] = Math.round(((period.entries[category] ?? 0) + amount) * 100) / 100
  finance.today ??= {}
  finance.today[category] = Math.round(((finance.today[category] ?? 0) + amount) * 100) / 100
}

export function financeEntriesTotal(entries: FinanceEntries): number {
  return FINANCE_CATEGORIES.reduce((total, category) => total + (entries[category] ?? 0), 0)
}

export function financePeriodTotal(period: FinancePeriod): number {
  return financeEntriesTotal(period.entries)
}

/**
 * What tomorrow is expected to cost and bring in. The running costs are calculated
 * exactly — they follow from what stands on the site, who is employed and what is
 * owed. Everything the visitors decide is carried over from the last full day, or,
 * before a full day has passed, from what today has brought so far.
 */
export function financeForecast(finance: FinanceState, fixed: FinanceEntries): FinanceEntries {
  const basis = financeEntriesTotal(finance.previousDay ?? {}) !== 0 ? finance.previousDay : finance.today
  const forecast: FinanceEntries = {}
  for (const category of FINANCE_RECURRING_CATEGORIES) {
    const value = basis?.[category]
    if (value) forecast[category] = Math.round(value * 100) / 100
  }
  for (const category of FINANCE_FIXED_CATEGORIES) {
    const value = fixed[category]
    if (value) forecast[category] = Math.round(value * 100) / 100
  }
  return forecast
}

/** What the bank is willing to lend in total, given what the park is worth. */
export function loanLimit(parkValue: number): number {
  return Math.min(
    LOAN.hardLimit,
    Math.round((LOAN.baseLimit + Math.max(0, parkValue) * LOAN.limitPerParkValue) / LOAN.step) * LOAN.step,
  )
}

/** A day's interest on the outstanding loan, rounded to cents. */
export function loanInterest(loan: number, days: number): number {
  return Math.round(Math.max(0, loan) * LOAN.interestPerDay * days * 100) / 100
}
