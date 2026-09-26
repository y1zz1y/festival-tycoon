import { currentAccount } from '../accounts'
import { earnedAchievements } from '../game/achievements'
import {
  readLocalProgress,
  recordScenarioResult,
  syncProgress,
  unlockAchievements,
  writeLocalProgress,
  type ProgressRecords,
} from '../game/progress'
import { isAuthoringScenario } from '../game/scenario'
import { scenarioScore, scenarioStars } from '../game/scenarioGoals'
import type { GameSnapshot } from '../game/types/snapshot'

export type ProgressTracker = {
  records(): ProgressRecords
  /** A scenario was just decided: keep the win and the grade under its preset id. */
  recordDecided(snapshot: Readonly<GameSnapshot>): void
  /** Unlocks whatever the running game has earned by now. Cheap; call now and then. */
  checkAchievements(snapshot: Readonly<GameSnapshot>): void
  /** Merges with the account (if signed in) and keeps the result. */
  sync(): Promise<void>
}

/**
 * Keeps cross-game progress (A8) and achievements for this browser and account.
 * Only the host or a solo game records: a guest in someone else's room sees their
 * festival but does not earn it, and neither does a guest who inherited that
 * park by a host takeover. Games helped by debug money never count.
 */
export function mountProgressTracker(options: {
  isClient(): boolean
  /** True while the running park came to this player by a multiplayer takeover. */
  isInheritedWorld?(): boolean
  showToast(message: string): void
  onChange(): void
}): ProgressTracker {
  let records = readLocalProgress()
  const keep = (next: ProgressRecords): void => {
    records = next
    writeLocalProgress(records)
    options.onChange()
  }
  const counts = (snapshot: Readonly<GameSnapshot>): boolean =>
    !options.isClient() && !options.isInheritedWorld?.() &&
    !snapshot.debugAssisted && !isAuthoringScenario(snapshot.scenario)
  const sync = async (): Promise<void> => {
    if (!currentAccount()) return
    const result = await syncProgress(records)
    if (result.synced) keep(result.records)
  }
  const checkAchievements = (snapshot: Readonly<GameSnapshot>): void => {
    if (!counts(snapshot)) return
    const result = unlockAchievements(records, earnedAchievements(snapshot, records), Date.now())
    if (result.unlocked.length === 0) return
    keep(result.records)
    for (const achievement of result.unlocked) options.showToast(`${achievement.icon} Erfolg: ${achievement.name}`)
    void sync()
  }
  return {
    records: () => records,
    recordDecided: (snapshot) => {
      const id = snapshot.scenario.preset
      if (!counts(snapshot) || !id) return
      const outcome = snapshot.scenarioProgress.outcome.state
      if (outcome === 'running') return
      const score = scenarioScore(snapshot.scenarioProgress)
      keep(recordScenarioResult(records, id, { won: outcome === 'won', score, stars: scenarioStars(score) }, Date.now()))
      checkAchievements(snapshot)
      void sync()
    },
    checkAchievements,
    sync,
  }
}
