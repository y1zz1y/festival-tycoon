/**
 * Progress across games: which scenarios were won with what grade, and which
 * achievements are unlocked. Kept in the browser and, for a signed-in player, on the
 * server; both sides merge best-of, so syncing in any order never loses anything.
 *
 * Pure and dependency-free apart from the text marker next to it: the server imports
 * it at runtime (Docker ships only `server/` and `dist/`), the client re-exports it
 * from src/game/progress.ts. Names and details are canonical German (`de`); the UI
 * localizes them for display.
 */
import { de } from './i18nMarker.ts'

export type ScenarioRecord = {
  won: boolean
  /** Best end-screen score 0–100 (`scenarioScore`), won or not. */
  bestScore: number
  /** Best end-screen stars 0–5 (`scenarioStars`). */
  bestStars: number
  /** When it was first won (ms since epoch), absent until then. */
  firstWonAt?: number
}

export type ProgressRecords = {
  scenarios: Record<string, ScenarioRecord>
  /** Achievement id → when it was unlocked (ms since epoch). */
  achievements: Record<string, number>
}

export type AchievementDefinition = { id: string; name: string; detail: string; icon: string }

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: 'firstEdition', name: de('Die erste Ausgabe'), detail: de('Eine Festivalausgabe zu Ende gebracht.'), icon: '🎪' },
  { id: 'firstWin', name: de('Erster Sieg'), detail: de('Ein Szenario gewonnen.'), icon: '🏆' },
  { id: 'allPresets', name: de('Tourneeprofi'), detail: de('Alle eingebauten Szenarien gewonnen.'), icon: '🗺️' },
  { id: 'hardWin', name: de('Harter Hund'), detail: de('Ein Szenario auf „Schwer“ gewonnen.'), icon: '💪' },
  { id: 'headliner', name: de('Große Namen'), detail: de('Einen Headliner auf die Bühne geholt.'), icon: '⭐' },
  { id: 'allGenres', name: de('Querbeet'), detail: de('Alle acht Genres in einer Ausgabe gebucht.'), icon: '🎶' },
  { id: 'crowd1000', name: de('Ausverkauft'), detail: de('1.000 Anreisen in einer Ausgabe.'), icon: '🎟️' },
  { id: 'happyCrowd', name: de('Wolke sieben'), detail: de('Eine Ausgabe mit mindestens 85 % Zufriedenheit.'), icon: '😊' },
  { id: 'bigProfit', name: de('Goldgrube'), detail: de('25.000 € Gewinn in einer Ausgabe.'), icon: '💰' },
  { id: 'rides', name: de('Rummelplatz'), detail: de('Fünf verschiedene Fahrgeschäfte auf einem Gelände.'), icon: '🎡' },
  { id: 'sponsor', name: de('Werbepartner'), detail: de('Einen Sponsorvertrag erfüllt.'), icon: '🤝' },
  { id: 'storm', name: de('Sturmfest'), detail: de('Ein Unwetter ohne Verletzte überstanden.'), icon: '⛈️' },
]

export const ACHIEVEMENT_IDS: readonly string[] = ACHIEVEMENTS.map((achievement) => achievement.id)

const SCENARIO_ID = /^[a-z0-9-]{1,48}$/
const MAX_SCENARIOS = 200

export function emptyProgress(): ProgressRecords {
  return { scenarios: {}, achievements: {} }
}

function finiteBetween(value: unknown, minimum: number, maximum: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : minimum
}

function timestamp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : undefined
}

/** Whatever arrives (storage, network), a valid record set comes back; unknown bits are dropped. */
export function normalizeProgress(raw: unknown): ProgressRecords {
  const result = emptyProgress()
  if (!raw || typeof raw !== 'object') return result
  const source = raw as { scenarios?: unknown; achievements?: unknown }
  if (source.scenarios && typeof source.scenarios === 'object') {
    for (const [id, value] of Object.entries(source.scenarios as Record<string, unknown>).slice(0, MAX_SCENARIOS)) {
      if (!SCENARIO_ID.test(id) || !value || typeof value !== 'object') continue
      const record = value as Partial<Record<keyof ScenarioRecord, unknown>>
      const firstWonAt = timestamp(record.firstWonAt)
      result.scenarios[id] = {
        won: record.won === true,
        bestScore: Math.round(finiteBetween(record.bestScore, 0, 100)),
        bestStars: Math.round(finiteBetween(record.bestStars, 0, 5)),
        ...(record.won === true && firstWonAt ? { firstWonAt } : {}),
      }
    }
  }
  if (source.achievements && typeof source.achievements === 'object') {
    for (const [id, value] of Object.entries(source.achievements as Record<string, unknown>)) {
      const at = timestamp(value)
      if (ACHIEVEMENT_IDS.includes(id) && at) result.achievements[id] = at
    }
  }
  return result
}

/** Best of both: won stays won, the higher grade wins, the earliest date is kept. */
export function mergeProgress(left: ProgressRecords, right: ProgressRecords): ProgressRecords {
  const merged = emptyProgress()
  for (const id of new Set([...Object.keys(left.scenarios), ...Object.keys(right.scenarios)])) {
    const a = left.scenarios[id]
    const b = right.scenarios[id]
    const won = Boolean(a?.won || b?.won)
    const dates = [a?.firstWonAt, b?.firstWonAt].filter((value): value is number => value !== undefined)
    merged.scenarios[id] = {
      won,
      bestScore: Math.max(a?.bestScore ?? 0, b?.bestScore ?? 0),
      bestStars: Math.max(a?.bestStars ?? 0, b?.bestStars ?? 0),
      ...(won && dates.length ? { firstWonAt: Math.min(...dates) } : {}),
    }
  }
  for (const id of new Set([...Object.keys(left.achievements), ...Object.keys(right.achievements)])) {
    const dates = [left.achievements[id], right.achievements[id]].filter((value): value is number => value !== undefined)
    merged.achievements[id] = Math.min(...dates)
  }
  return merged
}
