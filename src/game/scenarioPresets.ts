import { DEFAULT_SCENARIO, type ScenarioSettings } from './scenario'
import { de, keep } from '../i18n/marker'

/**
 * Prepared scenarios: instead of an empty map, a site with a character of its own —
 * its size, its ground, the money and debt it starts with, and what it wants from
 * you. Everything here goes through normalizeScenarioSettings before it is used,
 * so these are plain descriptions, not trusted input.
 *
 * Names and briefings are canonical German (`de`) and go into the snapshot as the
 * scenario title; the UI shows them with `localize`. Real festivals keep their name,
 * the pun names get an English adaptation in the catalog (docs/i18n.md).
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
  // First steps (A9): no goals, no deadline; a checklist (src/game/tutorial.ts) leads
  // through the first build instead.
  preset(
    'einstieg',
    de('Erste Schritte'),
    de('Ein kleines, flaches Feld und genug Geld für den Anfang. Eine Checkliste führt durch den ersten Aufbau: Weg, Bühne mit Strom, Imbiss und Toilette, Band buchen, Festival starten.'),
    {
      environment: 'farmland',
      unevenness: .05,
      worldSize: 32,
      startingMoney: 30_000,
      startingLoan: 0,
      partyAffinity: .6,
      beautyAffinity: .4,
      carArrivalShare: .2,
      goals: [],
    },
  ),
  preset(
    'woodstock',
    keep('Woodstock'),
    de('Eine Milchviehweide, drei Tage Regen und mehr Leute als geplant. Viel Platz, weicher Lehmboden und wenig Geld — der Boden will entwässert und verdichtet werden, bevor irgendetwas Schweres darauf steht.'),
    {
      environment: 'farmland',
      unevenness: .3,
      worldSize: 64,
      startingMoney: 8_000,
      startingLoan: 0,
      partyAffinity: .7,
      beautyAffinity: .35,
      carArrivalShare: .35,
      goals: [{ kind: 'admissions', target: 600, edition: 3 }],
    },
  ),
  preset(
    'tomorrowland',
    keep('Tomorrowland'),
    de('Ein Park, der zur Bühne wird: großes Gelände, hohe Ansprüche ans Auge — und eine Bank, die den Aufbau vorfinanziert hat. Das Darlehen läuft, die Zinsen auch.'),
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
        { kind: 'admissions', target: 900, edition: 3 },
      ],
    },
  ),
  preset(
    'rock-am-ring',
    keep('Rock am Ring'),
    de('Hügelland rund um eine Rennstrecke. Kaum ein Feld ist eben, dafür kommen fast alle mit dem Auto — Zufahrt, Parkplatz und Geländearbeit entscheiden hier alles.'),
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
      goals: [{ kind: 'admissions', target: 700, edition: 2 }],
    },
  ),
  preset(
    'hurricane',
    keep('Hurricane'),
    de('Flaches Land kurz vor der Küste: schnell aufgebaut, schnell aufgeweicht. Ein kleines Gelände, ein kleiner Kredit und die Ansage, am Ende trotzdem im Plus zu stehen.'),
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
  // The four below borrow a real festival's character, not its name: the name is a
  // cheerful mangling, the goals are the ones the first four leave unused.
  preset(
    'wackelstein',
    de('Wackelstein Open Air'),
    de('Ein Dorf, eine Kuhweide und sehr viel Metal. Regnet es, wird der Acker zu Schlamm und der Schlamm zur Legende. Hier zählt nicht die Menge, sondern der Ruf unter den Kuttenträgern.'),
    {
      environment: 'farmland',
      unevenness: .2,
      worldSize: 64,
      startingMoney: 12_000,
      startingLoan: 0,
      partyAffinity: .55,
      beautyAffinity: .25,
      carArrivalShare: .6,
      aggressiveShare: .3,
      goals: [
        { kind: 'reputation', target: 60, edition: 3 },
        { kind: 'admissions', target: 500, edition: 3 },
      ],
    },
  ),
  preset(
    'kutschella',
    de('Kutschella'),
    de('Wüste, Palmen, Sonnenbrillen. Das Publikum will Kunst, Aussicht und Schatten, die Geldgeber wollen Gewinn — nicht einmal, sondern zwei Ausgaben hintereinander.'),
    {
      environment: 'desert',
      unevenness: .25,
      worldSize: 64,
      startingMoney: 30_000,
      startingLoan: 20_000,
      partyAffinity: .7,
      beautyAffinity: .9,
      carArrivalShare: .8,
      goals: [{ kind: 'profit', target: 12_000, edition: 4, streak: 2 }],
    },
  ),
  preset(
    'glastonbauer',
    de('Glastonbauer'),
    de('Ein Bauernhof, so groß, dass man sich darauf verläuft, und Gäste, die bleiben wollen. Wer hier glücklich macht, darf wiederkommen: Zufriedenheit zählt, zwei Ausgaben in Folge.'),
    {
      environment: 'farmland',
      unevenness: .55,
      worldSize: 80,
      startingMoney: 25_000,
      startingLoan: 0,
      partyAffinity: .6,
      beautyAffinity: .7,
      carArrivalShare: .3,
      goals: [
        { kind: 'satisfaction', target: 75, edition: 4, streak: 2 },
        { kind: 'admissions', target: 800, edition: 4 },
      ],
    },
  ),
  preset(
    'verschmelzung',
    de('Verschmelzung'),
    de('Ein stillgelegter Flugplatz, Beton bis zum Horizont und eine Crew mit großen Plänen. Kein Baum, kein Schatten, dafür fester Boden. Am Ende soll das Gelände etwas wert sein — und schuldenfrei.'),
    {
      environment: 'urban',
      unevenness: .05,
      worldSize: 64,
      startingMoney: 20_000,
      startingLoan: 15_000,
      partyAffinity: .9,
      beautyAffinity: .6,
      carArrivalShare: .25,
      goals: [
        { kind: 'parkValue', target: 120_000, edition: 4 },
        { kind: 'loanFree', edition: 4 },
      ],
    },
  ),
]

let extraPresets: ScenarioPreset[] = []

/** Drop-in files register here so existing `scenarioPreset` lookups find them. */
export function setExtraScenarioPresets(presets: ScenarioPreset[]): void {
  extraPresets = presets
}

export function scenarioPreset(id: string | undefined): ScenarioPreset | undefined {
  return id
    ? SCENARIO_PRESETS.find((entry) => entry.id === id) ?? extraPresets.find((entry) => entry.id === id)
    : undefined
}
