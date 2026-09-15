import { DEFAULT_SCENARIO, type ScenarioSettings } from './scenario'

/**
 * Prepared scenarios: instead of an empty map, a site with a character of its own —
 * its size, its ground, the money and debt it starts with, and what it wants from
 * you. Everything here goes through normalizeScenarioSettings before it is used,
 * so these are plain descriptions, not trusted input.
 */
export type ScenarioPreset = {
  id: string
  name: string
  detail: string
  /** Set on a scenario that is not part of the base game: the title screen shows the price and refuses to start it. */
  price?: string
  settings: ScenarioSettings
}

const preset = (
  id: string,
  name: string,
  detail: string,
  settings: Partial<ScenarioSettings>,
  price?: string,
): ScenarioPreset => ({ id, name, detail, price, settings: { ...DEFAULT_SCENARIO, ...settings } })

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  preset(
    'woodstock',
    'Woodstock',
    'Eine Milchviehweide, drei Tage Regen und mehr Leute als geplant. Viel Platz, weicher Lehmboden und wenig Geld — der Boden will entwässert und verdichtet werden, bevor irgendetwas Schweres darauf steht.',
    {
      environment: 'farmland',
      unevenness: .3,
      worldSize: 64,
      startingMoney: 8_000,
      startingLoan: 0,
      partyAffinity: .7,
      beautyAffinity: .35,
      carArrivalShare: .35,
      goals: [{ kind: 'guests', target: 600, edition: 3 }],
    },
  ),
  preset(
    'tomorrowland',
    'Tomorrowland',
    'Ein Park, der zur Bühne wird: großes Gelände, hohe Ansprüche ans Auge — und eine Bank, die den Aufbau vorfinanziert hat. Das Darlehen läuft, die Zinsen auch.',
    {
      environment: 'grassland',
      unevenness: .45,
      worldSize: 80,
      startingMoney: 40_000,
      startingLoan: 30_000,
      partyAffinity: .85,
      beautyAffinity: .8,
      goals: [
        { kind: 'loanFree', edition: 3 },
        { kind: 'guests', target: 900, edition: 3 },
      ],
    },
    '0,99 €',
  ),
  preset(
    'rock-am-ring',
    'Rock am Ring',
    'Hügelland rund um eine Rennstrecke. Kaum ein Feld ist eben, dafür kommen fast alle mit dem Auto — Zufahrt, Parkplatz und Geländearbeit entscheiden hier alles.',
    {
      environment: 'grassland',
      unevenness: .9,
      worldSize: 64,
      startingMoney: 15_000,
      startingLoan: 0,
      partyAffinity: .75,
      beautyAffinity: .45,
      carArrivalShare: .9,
      aggressiveShare: .35,
      goals: [{ kind: 'guests', target: 700, edition: 2 }],
    },
  ),
  preset(
    'hurricane',
    'Hurricane',
    'Flaches Land kurz vor der Küste: schnell aufgebaut, schnell aufgeweicht. Ein kleines Gelände, ein kleiner Kredit und die Ansage, am Ende trotzdem im Plus zu stehen.',
    {
      environment: 'farmland',
      unevenness: .12,
      worldSize: 48,
      startingMoney: 10_000,
      startingLoan: 10_000,
      partyAffinity: .6,
      beautyAffinity: .5,
      goals: [{ kind: 'money', target: 25_000, edition: 3 }],
    },
  ),
]

export function scenarioPreset(id: string | undefined): ScenarioPreset | undefined {
  return id ? SCENARIO_PRESETS.find((entry) => entry.id === id) : undefined
}
