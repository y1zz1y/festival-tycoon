import { SIMULATION_CONFIG } from './simulationConfig'
import { de } from '../i18n/marker'

/**
 * Leicht / Normal / Schwer, chosen when a game starts and kept in its scenario
 * settings (omitted when normal). One profile of factors from
 * `SIMULATION_CONFIG.difficulty`; each choke point multiplies by its factor, so
 * "normal" is the game exactly as before. Construction prices are not scaled: every
 * price the player reads stays the price they pay.
 */
export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export const DIFFICULTY_NAMES: Record<Difficulty, string> = { easy: de('Leicht'), normal: de('Normal'), hard: de('Schwer') }

export type DifficultyProfile = (typeof SIMULATION_CONFIG.difficulty)[Difficulty]

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (DIFFICULTIES as readonly string[]).includes(value)
}

export function difficultyOf(settings?: { difficulty?: Difficulty } | null): Difficulty {
  return isDifficulty(settings?.difficulty) ? settings.difficulty : 'normal'
}

export function difficultyProfile(settings?: { difficulty?: Difficulty } | null): DifficultyProfile {
  return SIMULATION_CONFIG.difficulty[difficultyOf(settings)]
}
