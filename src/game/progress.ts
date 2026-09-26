import {
  ACHIEVEMENTS,
  ACHIEVEMENT_IDS,
  emptyProgress,
  mergeProgress,
  normalizeProgress,
  type AchievementDefinition,
  type ProgressRecords,
  type ScenarioRecord,
} from '../../server/progressProtocol'

export {
  ACHIEVEMENTS,
  ACHIEVEMENT_IDS,
  emptyProgress,
  mergeProgress,
  normalizeProgress,
  type AchievementDefinition,
  type ProgressRecords,
  type ScenarioRecord,
}

/**
 * Progress across games in this browser: won scenarios, best grades, achievements.
 * Kept under `festival-progress` in localStorage, never in a save, and synced
 * best-of with the account (`/api/progress`) when someone is signed in.
 */
export const PROGRESS_KEY = 'festival-progress'

export function readLocalProgress(storage: Pick<Storage, 'getItem'> | null = globalThis.localStorage ?? null): ProgressRecords {
  try {
    const stored = storage?.getItem(PROGRESS_KEY)
    return normalizeProgress(stored ? JSON.parse(stored) : null)
  } catch {
    return emptyProgress()
  }
}

export function writeLocalProgress(records: ProgressRecords, storage: Pick<Storage, 'setItem'> | null = globalThis.localStorage ?? null): void {
  try {
    storage?.setItem(PROGRESS_KEY, JSON.stringify(records))
  } catch { /* private mode: progress lasts until the page closes */ }
}

/** A decided scenario: keeps the better grade, marks a win and when it first happened. */
export function recordScenarioResult(
  records: ProgressRecords,
  scenarioId: string,
  result: { won: boolean; score: number; stars: number },
  now: number,
): ProgressRecords {
  return mergeProgress(records, normalizeProgress({
    scenarios: { [scenarioId]: { won: result.won, bestScore: result.score, bestStars: result.stars, firstWonAt: result.won ? now : undefined } },
  }))
}

/** Unlocks achievements that are not unlocked yet and says which ones are new. */
export function unlockAchievements(
  records: ProgressRecords,
  ids: readonly string[],
  now: number,
): { records: ProgressRecords; unlocked: AchievementDefinition[] } {
  const fresh = ids.filter((id) => ACHIEVEMENT_IDS.includes(id) && records.achievements[id] === undefined)
  if (fresh.length === 0) return { records, unlocked: [] }
  const achievements = { ...records.achievements }
  for (const id of fresh) achievements[id] = now
  return {
    records: { ...records, achievements },
    unlocked: ACHIEVEMENTS.filter((achievement) => fresh.includes(achievement.id)),
  }
}

/**
 * Sends this browser's records to the account and keeps the merged answer. Without
 * an account (401) or a server, the local records simply stay as they are.
 */
export async function syncProgress(
  local: ProgressRecords,
  fetchImpl: typeof fetch = fetch,
): Promise<{ records: ProgressRecords; synced: boolean }> {
  try {
    const response = await fetchImpl('/api/progress', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: local }),
    })
    if (!response.ok) return { records: local, synced: false }
    const body = await response.json() as { records?: unknown }
    return { records: mergeProgress(local, normalizeProgress(body.records)), synced: true }
  } catch {
    return { records: local, synced: false }
  }
}
