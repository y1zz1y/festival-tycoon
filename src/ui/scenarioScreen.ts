import { difficultyOf, isDifficulty } from '../game/difficulty'
import { ENVIRONMENTS, type Environment } from '../game/environments'
import type { GameState } from '../game/GameState'
import { SCENARIO_WORLD_SIZES, normalizeScenarioSettings, type ScenarioSettings } from '../game/scenario'
import { goalWithDeadline } from '../game/scenarioGoalText'
import { scenarioSummary as goalTally } from '../game/scenarioGoals'
import { SCENARIO_PRESETS, scenarioPreset, type ScenarioPreset } from '../game/scenarioPresets'
import { formatMoney, formatPercent, joinParts, localize, t, tc } from '../i18n'

/**
 * Name or briefing of a preset as shown. Built-in presets are canonical German and are
 * translated; a scenario from a file is shared content and stays as written.
 */
export function presetText(preset: ScenarioPreset, text: string): string {
  return SCENARIO_PRESETS.includes(preset) ? localize(text) : text
}

/** The running scenario's name as the player sees it. */
export function scenarioDisplayName(settings: Pick<ScenarioSettings, 'authoring' | 'preset' | 'title'>): string {
  if (settings.authoring) return t('Szenario-Editor')
  const preset = scenarioPreset(settings.preset)
  if (preset) return presetText(preset, preset.name)
  return settings.title ?? t('Freies Spiel')
}

function unevennessWord(percent: number): string {
  if (percent === 0) return t('Flach')
  if (percent <= 30) return t('Sanft gewellt')
  return percent <= 65 ? t('Hügelig') : t('Stark hügelig')
}

export function createScenarioFormController(getGame: () => GameState) {
  const scenarioCarShare = document.querySelector<HTMLInputElement>('#scenario-car-share')!
  const scenarioParty = document.querySelector<HTMLInputElement>('#scenario-party')!
  const scenarioBeauty = document.querySelector<HTMLInputElement>('#scenario-beauty')!
  const scenarioAggression = document.querySelector<HTMLInputElement>('#scenario-aggression')!
  const scenarioMoney = document.querySelector<HTMLInputElement>('#scenario-money')!
  const scenarioEnvironment = document.querySelector<HTMLSelectElement>('#scenario-environment')!
  const scenarioUnevenness = document.querySelector<HTMLInputElement>('#scenario-unevenness')!
  const scenarioGroundDetails = document.querySelector<HTMLElement>('#scenario-ground-details')!
  const scenarioUnevennessValue = document.querySelector<HTMLElement>('#scenario-unevenness-value')!
  const scenarioWorldSize = document.querySelector<HTMLSelectElement>('#scenario-world-size')!
  const scenarioSummary = document.querySelector<HTMLElement>('#scenario-summary')!
  const scenarioCarValue = document.querySelector<HTMLElement>('#scenario-car-value')!
  const scenarioPartyValue = document.querySelector<HTMLElement>('#scenario-party-value')!
  const scenarioBeautyValue = document.querySelector<HTMLElement>('#scenario-beauty-value')!
  const scenarioAggressionValue = document.querySelector<HTMLElement>('#scenario-aggression-value')!
  const scenarioMoneyValue = document.querySelector<HTMLElement>('#scenario-money-value')!
  const goalRows = [...document.querySelectorAll<HTMLElement>('[data-goal-row]')]

  /** The goals free play asks of itself; empty rows and nonsense are dropped by the normalizer. */
  function readGoals(): unknown[] {
    return goalRows.flatMap((row) => {
      const kind = row.querySelector<HTMLSelectElement>('[data-goal-kind]')!.value
      if (!kind) return []
      const edition = Number(row.querySelector<HTMLInputElement>('[data-goal-edition]')!.value)
      const target = Number(row.querySelector<HTMLInputElement>('[data-goal-target]')!.value)
      return [kind === 'loanFree' ? { kind, edition } : { kind, target, edition }]
    })
  }

  function fillGoals(goals: ScenarioSettings['goals']): void {
    goalRows.forEach((row, index) => {
      const goal = goals[index]
      row.querySelector<HTMLSelectElement>('[data-goal-kind]')!.value = goal && goal.kind !== 'guests' ? goal.kind : ''
      row.querySelector<HTMLInputElement>('[data-goal-target]')!.value = goal && 'target' in goal ? String(goal.target) : ''
      row.querySelector<HTMLInputElement>('[data-goal-edition]')!.value = String(goal?.edition ?? 3)
    })
  }

  const scenarioDifficulty = document.querySelector<HTMLSelectElement>('#scenario-difficulty')
  function read(): ScenarioSettings {
    const worldSize = Number(scenarioWorldSize.value)
    return normalizeScenarioSettings({
      environment: scenarioEnvironment.value as Environment,
      unevenness: Number(scenarioUnevenness.value) / 100,
      carArrivalShare: Number(scenarioCarShare.value) / 100,
      partyAffinity: Number(scenarioParty.value) / 100,
      beautyAffinity: Number(scenarioBeauty.value) / 100,
      aggressiveShare: Number(scenarioAggression.value) / 100,
      startingMoney: Number(scenarioMoney.value),
      worldSize: SCENARIO_WORLD_SIZES.includes(
        worldSize as (typeof SCENARIO_WORLD_SIZES)[number],
      )
        ? (worldSize as (typeof SCENARIO_WORLD_SIZES)[number])
        : 48,
      goals: readGoals() as ScenarioSettings['goals'],
      difficulty: isDifficulty(scenarioDifficulty?.value) ? scenarioDifficulty.value : 'normal',
    })
  }
  
  function fill(settings: ScenarioSettings): void {
    scenarioEnvironment.value = settings.environment
    scenarioUnevenness.value = String(Math.round(settings.unevenness * 100))
    scenarioCarShare.value = String(Math.round(settings.carArrivalShare * 100))
    scenarioParty.value = String(Math.round(settings.partyAffinity * 100))
    scenarioBeauty.value = String(Math.round(settings.beautyAffinity * 100))
    scenarioAggression.value = String(Math.round(settings.aggressiveShare * 100))
    scenarioMoney.value = String(settings.startingMoney)
    scenarioWorldSize.value = String(settings.worldSize)
    if (scenarioDifficulty) scenarioDifficulty.value = difficultyOf(settings)
    fillGoals(settings.goals)
    updateLabels()
  }
  
  /**
   * What the running festival was started on. Read-only by design: the ground, the crowd
   * and the starting capital are decided once, at the start, and the park is played with
   * what it was given — so the settings window reports them instead of offering them.
   */
  function updateSummary(): void {
    const settings = getGame().snapshot.scenario
    const goals = settings.goals
    const rows: [string, string][] = [
      [t('Szenario'), scenarioDisplayName(settings)],
      [t('Umgebung'), localize(ENVIRONMENTS[settings.environment].name)],
      [t('Kartengröße'), `${settings.worldSize}×${settings.worldSize}`],
      [t('Unebenheit'), formatPercent(Math.round(settings.unevenness * 100))],
      [t('Autobesucher'), formatPercent(Math.round(settings.carArrivalShare * 100))],
      [t('Party-Affinität'), formatPercent(Math.round(settings.partyAffinity * 100))],
      [t('Schönheits-Affinität'), formatPercent(Math.round(settings.beautyAffinity * 100))],
      [t('Gewaltbereitschaft'), formatPercent(Math.round(settings.aggressiveShare * 100))],
      [t('Startkapital'), formatMoney(settings.startingMoney)],
    ]
    if (settings.startingLoan > 0) rows.push([t('Startdarlehen'), formatMoney(settings.startingLoan)])
    if (goals.length) {
      const progress = getGame().snapshot.scenarioProgress
      const outcome = progress.outcome.state
      rows.push([t('Ziele'), joinParts(...goals.map(goalWithDeadline))])
      rows.push([tc('status', 'Stand'), outcome === 'won' ? t('Geschafft') : outcome === 'lost' ? t('Gescheitert') : t`${goalTally(getGame().snapshot).done} von ${goals.length} Zielen erreicht`])
      if (outcome === 'running' && progress.nextEditionDue !== null) rows.push([t('Nächste Ausgabe'), t`fällig ab Tag ${progress.nextEditionDue}`])
    }
    scenarioSummary.innerHTML = rows
      .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
      .join('')
  }
  
  function updateLabels(): void {
    scenarioGroundDetails.textContent = localize(ENVIRONMENTS[scenarioEnvironment.value as Environment].detail)
    const unevenness = Number(scenarioUnevenness.value)
    scenarioUnevennessValue.textContent = joinParts(formatPercent(unevenness), unevennessWord(unevenness))
    scenarioCarValue.textContent = `${scenarioCarShare.value}%`
    scenarioPartyValue.textContent = `${scenarioParty.value}%`
    scenarioBeautyValue.textContent = `${scenarioBeauty.value}%`
    scenarioAggressionValue.textContent = `${scenarioAggression.value}%`
    scenarioMoneyValue.textContent = formatMoney(Number(scenarioMoney.value))
  }
  
  
  return { read, fill, updateSummary, updateLabels }
}
