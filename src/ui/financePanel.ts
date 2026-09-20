import {
  FINANCE_CATEGORIES,
  FINANCE_CATEGORY_NAMES,
  financeEntriesTotal,
  financePeriodTotal,
  type FinanceCategory,
  type FinanceEntries,
  type FinancePeriod,
} from '../game/finance'
import type { FinanceBreakdown, FinanceCategoryBreakdown } from '../game/financeBreakdown'
import { escapeHtml } from './format'

export function formatLedgerEuro(value: number): string {
  return `${value < 0 ? '−' : ''}${Math.abs(Math.round(value)).toLocaleString('de-DE')} €`
}

/** Same line the ledger of every tycoon game draws: a signed figure, red when it leaves. */
export function ledgerCellHtml(value: number | undefined, extra = ''): string {
  return value === undefined || Math.round(value) === 0
    ? `<td class="finance-empty ${extra}"></td>`
    : `<td class="${value < 0 ? 'finance-out' : 'finance-in'} ${extra}">${value > 0 ? '+' : '−'}${Math.abs(Math.round(value)).toLocaleString('de-DE')} €</td>`
}

export function breakdownItemLabel(item: { label: string; count: number }): string {
  return item.count > 1 ? `${item.label} × ${item.count}` : item.label
}

function breakdownListHtml(detail: FinanceCategoryBreakdown): string {
  const groups = detail.sections
    .map((section) => {
      const rows = section.items
        .map((item) => (
          `<li><span>${escapeHtml(breakdownItemLabel(item))}</span>`
          + `<span class="${item.amount < 0 ? 'finance-out' : 'finance-in'}">${formatLedgerEuro(item.amount)}</span></li>`
        ))
        .join('')
      return `<div class="finance-breakdown-group"><h4>${escapeHtml(section.label)}</h4><ul class="finance-breakdown-list">${rows}</ul></div>`
    })
    .join('')
  return `<p class="finance-breakdown-hint">${escapeHtml(detail.hint)}</p>${groups}`
}

function categoryRowHtml(
  category: FinanceCategory,
  periods: FinancePeriod[],
  forecast: FinanceEntries,
  breakdown: FinanceBreakdown,
  expanded: ReadonlySet<FinanceCategory>,
): string {
  const detail = breakdown[category]
  const canExpand = Boolean(detail)
  const isOpen = Boolean(canExpand && expanded.has(category))
  const label = canExpand
    ? `<button type="button" class="finance-row-toggle" aria-expanded="${isOpen}" aria-controls="finance-breakdown-${category}">`
      + `<span class="finance-chevron" aria-hidden="true"></span>${FINANCE_CATEGORY_NAMES[category]}</button>`
    : FINANCE_CATEGORY_NAMES[category]
  const rowClass = canExpand ? 'finance-row-expandable' : ''
  const toggle = canExpand ? ` data-finance-toggle="${category}"` : ''
  const cells = periods.map((period) => ledgerCellHtml(period.entries[category])).join('')
    + ledgerCellHtml(forecast[category], 'finance-forecast')
  const row = `<tr class="${rowClass}"${toggle}><th scope="row">${label}</th>${cells}</tr>`
  if (!detail) return row
  const colSpan = periods.length + 2
  return `${row}<tr id="finance-breakdown-${category}" class="finance-breakdown"${isOpen ? '' : ' hidden'}>`
    + `<td colspan="${colSpan}">${breakdownListHtml(detail)}</td></tr>`
}

export function renderFinanceLedger(input: {
  periods: FinancePeriod[]
  forecast: FinanceEntries
  breakdown: FinanceBreakdown
  expanded: ReadonlySet<FinanceCategory>
}): string {
  const periods = input.periods.length
    ? input.periods
    : [{ edition: 1, entries: {} }]
  const head = `<thead><tr><th scope="col">Ausgaben / Einnahmen</th>${
    periods.map((period) => `<th scope="col">${period.edition}. Ausgabe</th>`).join('')
  }<th scope="col" class="finance-forecast">Prognose morgen</th></tr></thead>`
  const body = `<tbody>${
    FINANCE_CATEGORIES.map((category) => categoryRowHtml(
      category,
      periods,
      input.forecast,
      input.breakdown,
      input.expanded,
    )).join('')
  }</tbody>`
  const foot = `<tfoot><tr><th scope="row">Saldo</th>${
    periods.map((period) => ledgerCellHtml(financePeriodTotal(period))).join('')
  }${ledgerCellHtml(financeEntriesTotal(input.forecast), 'finance-forecast')}</tr></tfoot>`
  return `${head}${body}${foot}`
}

export function toggleFinanceCategory(
  expanded: Set<FinanceCategory>,
  category: string,
): boolean {
  if (!FINANCE_CATEGORIES.includes(category as FinanceCategory)) return false
  const key = category as FinanceCategory
  if (expanded.has(key)) expanded.delete(key)
  else expanded.add(key)
  return true
}

export function applyFinanceBreakdownToggle(
  table: HTMLElement,
  expanded: ReadonlySet<FinanceCategory>,
  category: FinanceCategory,
): void {
  const row = table.querySelector(`[data-finance-toggle="${category}"]`)
  const button = row?.querySelector('.finance-row-toggle')
  const detail = table.querySelector<HTMLElement>(`#finance-breakdown-${category}`)
  const open = expanded.has(category)
  button?.setAttribute('aria-expanded', String(open))
  if (detail) detail.hidden = !open
}
