import type { GameState } from '../game/GameState'
import {
  createTicketDemandTuning,
  normalizeTicketDemandTuning,
  type TicketDemandTuning,
} from '../game/demandTuning'
import {
  estimateTicketDemand,
  fairTicketPrices,
  priceAcceptance,
} from '../game/ticketDemand'
import { formatMoney, formatNumber, formatPercent, joinParts, t } from '../i18n'

type Field = readonly [path: string, label: string, step?: number]
type Group = readonly [title: string, fields: readonly Field[]]

const willingnessFields = (prefix: string): Field[] => [
  [`${prefix}.base`, t('Grundwert')],
  [`${prefix}.beauty`, t('Schönheit')],
  [`${prefix}.history`, t('Festivalhistorie')],
  [`${prefix}.size`, t('Festivalgröße')],
  [`${prefix}.lineupDraw`, t('Line-up-Zugkraft')],
  [`${prefix}.lineupPrice`, t('Line-up-Preiswert')],
  [`${prefix}.attractions`, t('Attraktionen')],
  [`${prefix}.complaints`, t('Beschwerden')],
]

const GROUPS: readonly Group[] = [
  [joinParts(t('Zahlungsbereitschaft'), t('Tag')), willingnessFields('willingness.day')],
  [joinParts(t('Zahlungsbereitschaft'), t('Camping')), willingnessFields('willingness.camping')],
  [t('Faire Preise'), [
    ['fairPrice.dayBaseFactor', joinParts(t('Tag'), t('Basisfaktor'))],
    ['fairPrice.dayWillingnessFactor', joinParts(t('Tag'), t('Bereitschaftsfaktor'))],
    ['fairPrice.campingBaseFactor', joinParts(t('Camping'), t('Basisfaktor'))],
    ['fairPrice.campingWillingnessFactor', joinParts(t('Camping'), t('Bereitschaftsfaktor'))],
  ]],
  [t('Preisakzeptanz'), [
    ['priceAcceptance.fullUntilRatio', t('Volle Akzeptanz bis Preis/Fair')],
    ['priceAcceptance.floorFromRatio', t('Minimum ab Preis/Fair')],
    ['priceAcceptance.minimum', t('Minimale Akzeptanz')],
  ]],
  [t('Teilnahme'), [
    ['attendance.dayBaseGuests', joinParts(t('Tag'), t('Basisgäste')), 1],
    ['attendance.dayLineupGuests', joinParts(t('Tag'), t('Gäste durch Line-up')), 1],
    ['attendance.daySizeGuests', joinParts(t('Tag'), t('Gäste durch Größe')), 1],
    ['attendance.dayBaseShare', joinParts(t('Tag'), t('Basisanteil'))],
    ['attendance.dayAcceptanceShare', joinParts(t('Tag'), t('Akzeptanzanteil'))],
    ['attendance.campingBaseGuests', joinParts(t('Camping'), t('Basisgäste')), 1],
    ['attendance.campingAcceptanceShare', joinParts(t('Camping'), t('Akzeptanzanteil'))],
  ]],
  [t('Anreise'), [
    ['arrivals.minimum', t('Minimum')],
    ['arrivals.base', t('Basis')],
    ['arrivals.acceptanceFactor', t('Akzeptanzfaktor')],
    ['arrivals.maximum', t('Maximum')],
  ]],
]

/** A 0–1 share as a percentage with one decimal. */
const percent = (share: number): string => formatPercent(Math.round(share * 1000) / 10)

const readPath = (root: TicketDemandTuning, path: string): number =>
  path.split('.').reduce<unknown>(
    (value, key) => (value as Record<string, unknown>)[key],
    root,
  ) as number

const writePath = (root: TicketDemandTuning, path: string, value: number): void => {
  const keys = path.split('.')
  let target = root as unknown as Record<string, unknown>
  keys.slice(0, -1).forEach((key) => {
    target = target[key] as Record<string, unknown>
  })
  target[keys.at(-1)!] = value
}

export function setupDemandDebugUI(options: {
  panel: HTMLElement
  getGame: () => GameState
  showToast: (message: string, error?: boolean) => void
}): { open: () => void; close: () => void; refresh: () => void } {
  const { panel, getGame, showToast } = options
  const form = panel.querySelector<HTMLFormElement>('#demand-debug-form')!
  const fields = panel.querySelector<HTMLElement>('#demand-debug-fields')!
  const results = panel.querySelector<HTMLElement>('#demand-debug-results')!
  let draft = createTicketDemandTuning()

  fields.innerHTML = GROUPS.map(([title, entries]) => `
    <fieldset>
      <legend>${title}</legend>
      ${entries.map(([path, label, step = 0.01]) => `
        <label><span>${label}</span><input name="${path}" type="number" step="${step}" required></label>
      `).join('')}
    </fieldset>
  `).join('')

  const syncInputs = (): void => {
    GROUPS.flatMap((group) => group[1]).forEach(([path]) => {
      const input = form.elements.namedItem(path) as HTMLInputElement
      input.value = String(readPath(draft, path))
    })
  }

  const readDraft = (): TicketDemandTuning => {
    const next = structuredClone(draft)
    GROUPS.flatMap((group) => group[1]).forEach(([path]) => {
      const input = form.elements.namedItem(path) as HTMLInputElement
      writePath(next, path, Number(input.value))
    })
    return normalizeTicketDemandTuning(next)
  }

  const refresh = (): void => {
    draft = readDraft()
    const snapshot = getGame().snapshot
    const evaluated = {
      ...snapshot,
      festival: { ...snapshot.festival, demandTuning: draft },
    }
    const estimate = estimateTicketDemand(evaluated)
    const fair = fairTicketPrices(estimate.willingness, draft)
    const dayAcceptance =
      priceAcceptance(snapshot.entryPrice, fair.day, draft) * estimate.willingness.day
    const campingAcceptance =
      priceAcceptance(snapshot.campingTicketPrice, fair.camping, draft) *
      estimate.willingness.camping
    results.innerHTML = `
      <div><dt>${t('Zahlungsbereitschaft')}</dt><dd>${joinParts(t`Tag ${percent(estimate.willingness.day)}`, t`Camping ${percent(estimate.willingness.camping)}`)}</dd></div>
      <div><dt>${t('Faire Preise')}</dt><dd>${joinParts(formatMoney(fair.day), formatMoney(fair.camping))}</dd></div>
      <div><dt>${t('Gesamtakzeptanz')}</dt><dd>${joinParts(t`Tag ${percent(dayAcceptance)}`, t`Camping ${percent(campingAcceptance)}`)}</dd></div>
      <div><dt>${t('Erwartete Teilnehmer')}</dt><dd>${joinParts(t`${formatNumber(estimate.expectedDayGuests)} Tag`, t`${formatNumber(estimate.expectedCampers)} Camping`)}</dd></div>
      <div><dt>${t('Erwarteter Erlös')}</dt><dd>${formatMoney(estimate.expectedDayRevenue + estimate.expectedCampingRevenue)}</dd></div>
    `
  }

  const open = (): void => {
    draft = normalizeTicketDemandTuning(getGame().snapshot.festival.demandTuning)
    syncInputs()
    refresh()
    panel.hidden = false
  }
  const close = (): void => { panel.hidden = true }

  form.addEventListener('input', refresh)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    draft = readDraft()
    getGame().updateDemandTuning(draft)
    syncInputs()
    refresh()
    showToast(t('Nachfrage-Tuning übernommen'))
  })
  panel.querySelector('#reset-demand-debug')!.addEventListener('click', () => {
    draft = createTicketDemandTuning()
    syncInputs()
    refresh()
  })
  panel.querySelector('#close-demand-debug')!.addEventListener('click', close)
  return { open, close, refresh }
}
