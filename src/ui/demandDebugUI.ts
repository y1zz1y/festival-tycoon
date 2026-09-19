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

type Field = readonly [path: string, label: string, step?: number]
type Group = readonly [title: string, fields: readonly Field[]]

const willingnessFields = (prefix: string): Field[] => [
  [`${prefix}.base`, 'Grundwert'],
  [`${prefix}.beauty`, 'Schönheit'],
  [`${prefix}.history`, 'Festivalhistorie'],
  [`${prefix}.size`, 'Festivalgröße'],
  [`${prefix}.lineupDraw`, 'Line-up-Zugkraft'],
  [`${prefix}.lineupPrice`, 'Line-up-Preiswert'],
  [`${prefix}.attractions`, 'Attraktionen'],
  [`${prefix}.complaints`, 'Beschwerden'],
]

const GROUPS: readonly Group[] = [
  ['Zahlungsbereitschaft · Tag', willingnessFields('willingness.day')],
  ['Zahlungsbereitschaft · Camping', willingnessFields('willingness.camping')],
  ['Faire Preise', [
    ['fairPrice.dayBaseFactor', 'Tag · Basisfaktor'],
    ['fairPrice.dayWillingnessFactor', 'Tag · Bereitschaftsfaktor'],
    ['fairPrice.campingBaseFactor', 'Camping · Basisfaktor'],
    ['fairPrice.campingWillingnessFactor', 'Camping · Bereitschaftsfaktor'],
  ]],
  ['Preisakzeptanz', [
    ['priceAcceptance.fullUntilRatio', 'Volle Akzeptanz bis Preis/Fair'],
    ['priceAcceptance.floorFromRatio', 'Minimum ab Preis/Fair'],
    ['priceAcceptance.minimum', 'Minimale Akzeptanz'],
  ]],
  ['Teilnahme', [
    ['attendance.dayBaseGuests', 'Tag · Basisgäste', 1],
    ['attendance.dayLineupGuests', 'Tag · Gäste durch Line-up', 1],
    ['attendance.daySizeGuests', 'Tag · Gäste durch Größe', 1],
    ['attendance.dayBaseShare', 'Tag · Basisanteil'],
    ['attendance.dayAcceptanceShare', 'Tag · Akzeptanzanteil'],
    ['attendance.campingBaseGuests', 'Camping · Basisgäste', 1],
    ['attendance.campingAcceptanceShare', 'Camping · Akzeptanzanteil'],
  ]],
  ['Anreise', [
    ['arrivals.minimum', 'Minimum'],
    ['arrivals.base', 'Basis'],
    ['arrivals.acceptanceFactor', 'Akzeptanzfaktor'],
    ['arrivals.maximum', 'Maximum'],
  ]],
]

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
      <div><dt>Zahlungsbereitschaft</dt><dd>Tag ${(estimate.willingness.day * 100).toFixed(1)} % · Camping ${(estimate.willingness.camping * 100).toFixed(1)} %</dd></div>
      <div><dt>Faire Preise</dt><dd>${fair.day.toLocaleString('de-DE')} € · ${fair.camping.toLocaleString('de-DE')} €</dd></div>
      <div><dt>Gesamtakzeptanz</dt><dd>Tag ${(dayAcceptance * 100).toFixed(1)} % · Camping ${(campingAcceptance * 100).toFixed(1)} %</dd></div>
      <div><dt>Erwartete Teilnehmer</dt><dd>${estimate.expectedDayGuests.toLocaleString('de-DE')} Tag · ${estimate.expectedCampers.toLocaleString('de-DE')} Camping</dd></div>
      <div><dt>Erwarteter Erlös</dt><dd>${(estimate.expectedDayRevenue + estimate.expectedCampingRevenue).toLocaleString('de-DE')} €</dd></div>
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
    showToast('Nachfrage-Tuning übernommen')
  })
  panel.querySelector('#reset-demand-debug')!.addEventListener('click', () => {
    draft = createTicketDemandTuning()
    syncInputs()
    refresh()
  })
  panel.querySelector('#close-demand-debug')!.addEventListener('click', close)
  return { open, close, refresh }
}
