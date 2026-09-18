import { ENVIRONMENTS, type Environment } from '../game/environments'
import type { GameState } from '../game/GameState'
import { SCENARIO_WORLD_SIZES, normalizeScenarioSettings, type ScenarioSettings } from '../game/scenario'
import { goalName } from '../game/scenarioGoals'
import { scenarioPreset } from '../game/scenarioPresets'

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
    updateLabels()
  }
  
  /**
   * What the running festival was started on. Read-only by design: the ground, the crowd
   * and the starting capital are decided once, at the start, and the park is played with
   * what it was given — so the settings window reports them instead of offering them.
   */
  function updateSummary(): void {
    const settings = getGame().snapshot.scenario
    const preset = scenarioPreset(settings.preset)
    const goals = settings.goals
    const rows: [string, string][] = [
      ['Szenario', preset?.name ?? 'Freies Spiel'],
      ['Umgebung', ENVIRONMENTS[settings.environment].name],
      ['Kartengröße', `${settings.worldSize}×${settings.worldSize}`],
      ['Unebenheit', `${Math.round(settings.unevenness * 100)} %`],
      ['Autobesucher', `${Math.round(settings.carArrivalShare * 100)} %`],
      ['Party-Affinität', `${Math.round(settings.partyAffinity * 100)} %`],
      ['Schönheits-Affinität', `${Math.round(settings.beautyAffinity * 100)} %`],
      ['Gewaltbereitschaft', `${Math.round(settings.aggressiveShare * 100)} %`],
      ['Startkapital', `${settings.startingMoney.toLocaleString('de-DE')} €`],
    ]
    if (settings.startingLoan > 0) rows.push(['Startdarlehen', `${settings.startingLoan.toLocaleString('de-DE')} €`])
    if (goals.length) rows.push(['Ziele', goals.map((goal) => `${goalName(goal)} bis zur ${goal.edition}. Ausgabe`).join(' · ')])
    scenarioSummary.innerHTML = rows
      .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
      .join('')
  }
  
  function updateLabels(): void {
    scenarioGroundDetails.textContent = ENVIRONMENTS[scenarioEnvironment.value as Environment].detail
    scenarioUnevennessValue.textContent = `${scenarioUnevenness.value} % · ${Number(scenarioUnevenness.value) === 0 ? 'Flach' : Number(scenarioUnevenness.value) <= 30 ? 'Sanft gewellt' : Number(scenarioUnevenness.value) <= 65 ? 'Hügelig' : 'Stark hügelig'}`
    scenarioCarValue.textContent = `${scenarioCarShare.value}%`
    scenarioPartyValue.textContent = `${scenarioParty.value}%`
    scenarioBeautyValue.textContent = `${scenarioBeauty.value}%`
    scenarioAggressionValue.textContent = `${scenarioAggression.value}%`
    scenarioMoneyValue.textContent = `${Number(scenarioMoney.value).toLocaleString('de-DE')} €`
  }
  
  
  return { read, fill, updateSummary, updateLabels }
}
