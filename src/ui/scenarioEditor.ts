import type { GameState } from '../game/GameState'
import { normalizeTicketDemandTuning } from '../game/demandTuning'
import {
  exportScenarioFile,
  serializeScenarioFile,
  type ScenarioExportMeta,
  type ScenarioFile,
} from '../game/scenarioFile'
import { formatMoney } from './format'
import { de, t } from '../i18n'

/**
 * Canonical defaults of an exported scenario. They stay German in every language: the
 * export id is derived from the name (`scenarioFileSlug`), and the file is shared content.
 */
const DEFAULT_SCENARIO_NAME = de('Szenario')
const DEFAULT_SCENARIO_DETAIL = de('Ein selbst gebautes Szenario.')

function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function publishScenario(file: ScenarioFile): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch('/api/scenarios', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: serializeScenarioFile(file),
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      // The server's refusal is canonical German; the toast sink translates it.
      return { ok: false, message: payload?.error || t('Szenario-Ordner nicht beschreibbar — Datei wurde heruntergeladen.') }
    }
    const filename = `${file.id}.json`
    return { ok: true, message: t`Gespeichert als ${filename} im Szenarien-Ordner` }
  } catch {
    return { ok: false, message: t('Kein Server — Datei wurde heruntergeladen. Lege sie in public/scenarios/.') }
  }
}

export function createScenarioEditorController(options: {
  panel: HTMLElement
  getGame: () => GameState
  showToast: (message: string, isError?: boolean) => void
}): {
  isOpen: () => boolean
  setOpen: (open: boolean) => void
  fillFromGame: () => void
} {
  const { panel, getGame, showToast } = options
  const nameInput = panel.querySelector<HTMLInputElement>('#editor-name')!
  const detailInput = panel.querySelector<HTMLTextAreaElement>('#editor-detail')!
  const moneyInput = panel.querySelector<HTMLInputElement>('#editor-money')!
  const loanInput = panel.querySelector<HTMLInputElement>('#editor-loan')!
  const carInput = panel.querySelector<HTMLInputElement>('#editor-car-share')!
  const partyInput = panel.querySelector<HTMLInputElement>('#editor-party')!
  const beautyInput = panel.querySelector<HTMLInputElement>('#editor-beauty')!
  const aggressionInput = panel.querySelector<HTMLInputElement>('#editor-aggression')!
  const ticketDayInput = panel.querySelector<HTMLInputElement>('#editor-ticket-day')!
  const ticketCampingInput = panel.querySelector<HTMLInputElement>('#editor-ticket-camping')!
  const demandDayInput = panel.querySelector<HTMLInputElement>('#editor-demand-day')!
  const demandCampingInput = panel.querySelector<HTMLInputElement>('#editor-demand-camping')!
  const moneyValue = panel.querySelector<HTMLElement>('#editor-money-value')!
  const loanValue = panel.querySelector<HTMLElement>('#editor-loan-value')!
  const carValue = panel.querySelector<HTMLElement>('#editor-car-value')!
  const partyValue = panel.querySelector<HTMLElement>('#editor-party-value')!
  const beautyValue = panel.querySelector<HTMLElement>('#editor-beauty-value')!
  const aggressionValue = panel.querySelector<HTMLElement>('#editor-aggression-value')!

  function readMeta(): ScenarioExportMeta {
    const snapshot = getGame().snapshot
    const demand = normalizeTicketDemandTuning({
      ...snapshot.festival.demandTuning,
      attendance: {
        ...snapshot.festival.demandTuning.attendance,
        dayBaseGuests: Number(demandDayInput.value),
        campingBaseGuests: Number(demandCampingInput.value),
      },
    })
    return {
      name: nameInput.value.trim() || DEFAULT_SCENARIO_NAME,
      detail: detailInput.value.trim() || DEFAULT_SCENARIO_DETAIL,
      startingMoney: Number(moneyInput.value),
      startingLoan: Number(loanInput.value),
      carArrivalShare: Number(carInput.value) / 100,
      partyAffinity: Number(partyInput.value) / 100,
      beautyAffinity: Number(beautyInput.value) / 100,
      aggressiveShare: Number(aggressionInput.value) / 100,
      tickets: { day: Number(ticketDayInput.value), camping: Number(ticketCampingInput.value) },
      demandTuning: demand,
    }
  }

  function updateLabels(): void {
    moneyValue.textContent = formatMoney(Number(moneyInput.value))
    loanValue.textContent = formatMoney(Number(loanInput.value))
    carValue.textContent = `${carInput.value}%`
    partyValue.textContent = `${partyInput.value}%`
    beautyValue.textContent = `${beautyInput.value}%`
    aggressionValue.textContent = `${aggressionInput.value}%`
  }

  function fillFromGame(): void {
    const snapshot = getGame().snapshot
    const settings = snapshot.scenario
    // A field holding the canonical default stays empty, so no German default shows up
    // as typed text; exporting an empty field writes the default back.
    const name = settings.title ?? settings.preset ?? ''
    const detail = settings.detail ?? ''
    nameInput.value = name === DEFAULT_SCENARIO_NAME ? '' : name
    detailInput.value = detail === DEFAULT_SCENARIO_DETAIL ? '' : detail
    moneyInput.value = String(settings.startingMoney)
    loanInput.value = String(settings.startingLoan)
    carInput.value = String(Math.round(settings.carArrivalShare * 100))
    partyInput.value = String(Math.round(settings.partyAffinity * 100))
    beautyInput.value = String(Math.round(settings.beautyAffinity * 100))
    aggressionInput.value = String(Math.round(settings.aggressiveShare * 100))
    ticketDayInput.value = String(snapshot.festival.tickets?.day ?? 150)
    ticketCampingInput.value = String(snapshot.festival.tickets?.camping ?? 0)
    demandDayInput.value = String(snapshot.festival.demandTuning.attendance.dayBaseGuests)
    demandCampingInput.value = String(snapshot.festival.demandTuning.attendance.campingBaseGuests)
    updateLabels()
  }

  function setOpen(open: boolean): void {
    panel.hidden = !open
    if (open) fillFromGame()
  }

  for (const input of [moneyInput, loanInput, carInput, partyInput, beautyInput, aggressionInput]) {
    input.addEventListener('input', updateLabels)
  }

  panel.querySelector('#editor-export')!.addEventListener('click', () => {
    const file = exportScenarioFile(getGame().snapshot, readMeta())
    downloadJson(`${file.id}.json`, serializeScenarioFile(file))
    void publishScenario(file).then((result) => showToast(result.message, !result.ok))
  })

  return { isOpen: () => !panel.hidden, setOpen, fillFromGame }
}

export function editorMoneyLabel(authoring: boolean, money: number): string {
  return authoring ? t('unbegrenzt') : formatMoney(money)
}
