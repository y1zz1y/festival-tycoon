import { ENVIRONMENTS } from './environments'
import type { Environment } from './environments'
import { STARTING_MONEY, WORLD_SIZE } from './catalog'
import { SIMULATION_CONFIG } from './simulationConfig'
import type { RngSource } from './rng'

export const SCENARIO_WORLD_SIZES = [32, 48, 64, 80, 265] as const
export type ScenarioWorldSize = (typeof SCENARIO_WORLD_SIZES)[number]

/**
 * What a scenario asks of the player. Deadlines count in festival editions — the
 * festival is this game's year — and a goal counts as missed once the edition
 * after its deadline has begun.
 *
 * Two families. The park goals (`guests`, `money`, `parkValue`, `loanFree`) look at
 * the park as it stands and are checked every day. The edition goals are measured
 * on one finished edition at a time and checked when it ends; `streak` asks for
 * that many editions in a row. `guests` is the peak crowd on site, kept for old
 * saves: one full minute is enough for it, so new scenarios ask for `admissions`.
 */
export const PARK_GOAL_KINDS = ['guests', 'money', 'parkValue'] as const
export const EDITION_GOAL_KINDS = ['admissions', 'satisfaction', 'reputation', 'profit'] as const
export type ParkGoalKind = (typeof PARK_GOAL_KINDS)[number]
export type EditionGoalKind = (typeof EDITION_GOAL_KINDS)[number]
export type ScenarioGoalKind = ParkGoalKind | EditionGoalKind | 'loanFree'

/** One member per kind, so that checking `goal.kind` narrows to exactly that goal. */
export type ParkGoal = { [K in ParkGoalKind]: { kind: K; target: number; edition: number } }[ParkGoalKind]
export type EditionGoal = {
  [K in EditionGoalKind]: { kind: K; target: number; edition: number; streak?: number }
}[EditionGoalKind]
export type ScenarioGoal = ParkGoal | EditionGoal | { kind: 'loanFree'; edition: number }

export function isEditionGoalKind(kind: string): kind is EditionGoalKind {
  return (EDITION_GOAL_KINDS as readonly string[]).includes(kind)
}

/** What a festival weekend asks of itself; see `weekendGoals` in festivalManagement.ts. */
export type WeekendGoals = { guests: number; satisfaction: number; profit: number }

export type ScenarioSettings = {
  environment: Environment
  unevenness: number
  carArrivalShare: number
  partyAffinity: number
  beautyAffinity: number
  aggressiveShare: number
  startingMoney: number
  worldSize: ScenarioWorldSize
  /** The prepared scenario this came from, or undefined for a blank map. */
  preset?: string
  /** Debt the park starts with — a prepared scenario can hand you a site and the loan that paid for it. */
  startingLoan: number
  goals: ScenarioGoal[]
  /**
   * Days from the start by which the first edition is due. Only a scenario with
   * goals has a due day; when it passes with no edition running, the game pauses
   * and opens the planning. Falls back to `SIMULATION_CONFIG.scenario.firstEditionDays`.
   */
  firstEditionDays?: number
  /** The first weekend's own targets; later editions grow from them. */
  festivalGoals?: WeekendGoals
}

export const DEFAULT_SCENARIO: ScenarioSettings = {
  environment: 'farmland',
  unevenness: .5,
  carArrivalShare: SIMULATION_CONFIG.logistics.carArrivalShare,
  partyAffinity: 0.55,
  beautyAffinity: 0.55,
  aggressiveShare: SIMULATION_CONFIG.visitors.aggressiveProbability,
  startingMoney: STARTING_MONEY,
  worldSize: WORLD_SIZE as ScenarioWorldSize,
  startingLoan: 0,
  goals: [],
}

export function createDefaultScenarioSettings(): ScenarioSettings {
  return { ...DEFAULT_SCENARIO, goals: [] }
}

/** Percentages cannot be asked for above 100. */
const PERCENT_GOAL_KINDS = new Set<string>(['satisfaction', 'reputation'])

/** Drops anything a hand-edited save or an old version could carry in the goal list. */
function normalizeGoals(source: unknown): ScenarioGoal[] {
  if (!Array.isArray(source)) return []
  const goals: ScenarioGoal[] = []
  for (const entry of source.slice(0, 4)) {
    const goal = (entry ?? {}) as { kind?: string; target?: unknown; edition?: unknown; streak?: unknown }
    const edition = Math.round(Number(goal.edition))
    if (!Number.isFinite(edition) || edition < 1 || edition > 20) continue
    if (goal.kind === 'loanFree') {
      goals.push({ kind: 'loanFree', edition })
      continue
    }
    const raw = Math.round(Number(goal.target))
    if (!Number.isFinite(raw) || raw <= 0) continue
    const target = PERCENT_GOAL_KINDS.has(goal.kind ?? '') ? Math.min(100, raw) : raw
    if ((PARK_GOAL_KINDS as readonly string[]).includes(goal.kind ?? '')) {
      goals.push({ kind: goal.kind as ParkGoalKind, target, edition })
    } else if (isEditionGoalKind(goal.kind ?? '')) {
      const streak = Math.round(Number(goal.streak))
      // A streak longer than the deadline could never be met.
      const kept = Number.isFinite(streak) && streak > 1 ? Math.min(streak, edition, 5) : 0
      goals.push({ kind: goal.kind as EditionGoalKind, target, edition, ...(kept > 1 ? { streak: kept } : {}) })
    }
  }
  return goals
}

function normalizeWeekendGoals(source: unknown): WeekendGoals | undefined {
  if (!source || typeof source !== 'object') return undefined
  const value = source as Partial<WeekendGoals>
  const guests = Math.round(Number(value.guests))
  const satisfaction = Math.round(Number(value.satisfaction))
  const profit = Math.round(Number(value.profit))
  if (![guests, satisfaction, profit].every(Number.isFinite)) return undefined
  return {
    guests: Math.max(10, guests),
    satisfaction: Math.max(0, Math.min(100, satisfaction)),
    profit,
  }
}

export function createScenarioEntrance(worldSize: number): {
  x: number
  z: number
  elevation: number
} {
  return { x: 3, z: -worldSize / 2, elevation: 0 }
}

export function createScenarioRoadEntry(worldSize: number): {
  x: number
  z: number
} {
  return { x: 0, z: -worldSize / 2 }
}

function clampRatio(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

export function normalizeScenarioSettings(
  source?: Partial<ScenarioSettings> | null,
): ScenarioSettings {
  const worldSize = SCENARIO_WORLD_SIZES.includes(
    source?.worldSize as ScenarioWorldSize,
  )
    ? (source?.worldSize as ScenarioWorldSize)
    : DEFAULT_SCENARIO.worldSize
  const startingMoney = Math.round(
    Number.isFinite(source?.startingMoney)
      ? Math.min(500_000, Math.max(5_000, Number(source?.startingMoney)))
      : DEFAULT_SCENARIO.startingMoney,
  )
  return {
    environment: source?.environment && Object.hasOwn(ENVIRONMENTS, source.environment) ? source.environment : DEFAULT_SCENARIO.environment,
    unevenness: clampRatio(source?.unevenness ?? DEFAULT_SCENARIO.unevenness, DEFAULT_SCENARIO.unevenness),
    carArrivalShare: clampRatio(
      source?.carArrivalShare ?? DEFAULT_SCENARIO.carArrivalShare,
      DEFAULT_SCENARIO.carArrivalShare,
    ),
    partyAffinity: clampRatio(
      source?.partyAffinity ?? DEFAULT_SCENARIO.partyAffinity,
      DEFAULT_SCENARIO.partyAffinity,
    ),
    beautyAffinity: clampRatio(
      source?.beautyAffinity ?? DEFAULT_SCENARIO.beautyAffinity,
      DEFAULT_SCENARIO.beautyAffinity,
    ),
    aggressiveShare: clampRatio(
      source?.aggressiveShare ?? DEFAULT_SCENARIO.aggressiveShare,
      DEFAULT_SCENARIO.aggressiveShare,
    ),
    startingMoney,
    worldSize,
    // Left out entirely rather than set to undefined: a blank map's settings have to
    // survive a JSON round trip through the network unchanged, key for key.
    ...(typeof source?.preset === 'string' && source.preset ? { preset: source.preset } : {}),
    startingLoan: Number.isFinite(source?.startingLoan)
      ? Math.max(0, Math.round(Number(source?.startingLoan)))
      : DEFAULT_SCENARIO.startingLoan,
    goals: normalizeGoals(source?.goals),
    // Optional fields are left out when unset, for the same JSON round trip as `preset`.
    ...(Number.isFinite(source?.firstEditionDays)
      ? { firstEditionDays: Math.max(1, Math.min(60, Math.round(Number(source?.firstEditionDays)))) }
      : {}),
    ...(normalizeWeekendGoals(source?.festivalGoals)
      ? { festivalGoals: normalizeWeekendGoals(source?.festivalGoals) }
      : {}),
  }
}

export function sampleBiasedPreference(
  tendency: number,
  rng: RngSource,
): number {
  const spread = 0.28
  return Math.min(
    1,
    Math.max(0.05, tendency + (rng.next() - 0.5) * 2 * spread),
  )
}
