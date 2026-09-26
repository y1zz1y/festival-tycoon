import { normalizeTicketDemandTuning, type TicketDemandTuning } from './demandTuning'
import { createFinanceState } from './finance'
import { weekendGoals } from './festivalManagement'
import {
  isAuthoringScenario,
  normalizeScenarioSettings,
  type ScenarioSettings,
} from './scenario'
import type { ScenarioPreset } from './scenarioPresets'
import { normalizeGroundCells } from './ground'
import { createInitialSnapshot, createBlankSnapshot } from './snapshotBootstrap'
import { migrateSnapshot } from './snapshotMigration'
import type { GameSnapshot } from './types/snapshot'

/** Drop-in JSON lives in `public/scenarios/` (dev) or `dist/scenarios/` (build). */
export const SCENARIO_FILE_KIND = 'headliner-scenario' as const
export const SCENARIO_FILE_FORMAT = 1 as const

export type ScenarioTickets = { day: number; camping: number }

/**
 * A prepared scenario on disk: the same preset fields the title screen already
 * lists, plus optional ticket mix, demand tuning and a baked park layout.
 */
export type ScenarioFile = ScenarioPreset & {
  kind: typeof SCENARIO_FILE_KIND
  format: typeof SCENARIO_FILE_FORMAT
  tickets?: ScenarioTickets
  demandTuning?: TicketDemandTuning
  /** Park layout. Missing means generate terrain like a built-in preset. */
  world?: Partial<GameSnapshot>
}

export type ScenarioExportMeta = {
  id?: string
  name: string
  detail: string
  startingMoney: number
  startingLoan: number
  carArrivalShare: number
  partyAffinity: number
  beautyAffinity: number
  aggressiveShare: number
  goals?: ScenarioSettings['goals']
  tickets?: ScenarioTickets
  demandTuning?: TicketDemandTuning
}

const WORLD_KEYS = [
  'terrain',
  'waterLevel',
  'buildings',
  'attractions',
  'coasters',
  'courses',
  'campingCells',
  'campInstallations',
  'medicalCells',
  'wasteDumpCells',
  'stageForecourtCells',
  'backstageCells',
  'logistics',
  'accessControls',
  'power',
  'dayPlan',
  'staff',
] as const satisfies readonly (keyof GameSnapshot)[]

export function scenarioFileSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || 'szenario'
}

function normalizeTickets(source: unknown): ScenarioTickets | undefined {
  if (!source || typeof source !== 'object') return undefined
  const value = source as Partial<ScenarioTickets>
  const day = Math.round(Number(value.day))
  const camping = Math.round(Number(value.camping))
  if (![day, camping].every(Number.isFinite)) return undefined
  return { day: Math.max(0, Math.min(20_000, day)), camping: Math.max(0, Math.min(20_000, camping)) }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

/** Accepts a drop-in file or a plain preset object from the same folder. */
export function parseScenarioFile(raw: unknown): ScenarioFile | null {
  const source = asRecord(raw)
  if (!source) return null
  const name = typeof source.name === 'string' ? source.name.trim().slice(0, 80) : ''
  const detail = typeof source.detail === 'string' ? source.detail.trim().slice(0, 800) : ''
  if (!name || !detail) return null
  const settings = normalizeScenarioSettings({
    ...(asRecord(source.settings) as Partial<ScenarioSettings> | null),
    title: name,
    detail,
    authoring: false,
  })
  delete settings.authoring
  const id = typeof source.id === 'string' && source.id.trim() ? scenarioFileSlug(source.id) : scenarioFileSlug(name)
  const tickets = normalizeTickets(source.tickets)
  const demandTuning = source.demandTuning
    ? normalizeTicketDemandTuning(source.demandTuning as TicketDemandTuning)
    : undefined
  const world = asRecord(source.world) as Partial<GameSnapshot> | undefined
  return {
    kind: SCENARIO_FILE_KIND,
    format: SCENARIO_FILE_FORMAT,
    id,
    name,
    detail,
    settings,
    ...(tickets ? { tickets } : {}),
    ...(demandTuning ? { demandTuning } : {}),
    ...(world ? { world } : {}),
  }
}

export function scenarioFileToPreset(file: ScenarioFile): ScenarioPreset {
  return { id: file.id, name: file.name, detail: file.detail, settings: file.settings }
}

export function captureScenarioWorld(snapshot: GameSnapshot): Partial<GameSnapshot> {
  const world: Partial<GameSnapshot> = { version: snapshot.version }
  for (const key of WORLD_KEYS) {
    const value = snapshot[key]
    if (value !== undefined) (world as Record<string, unknown>)[key] = structuredClone(value)
  }
  const ground = snapshot.festival.infrastructure?.ground
  if (ground && Object.keys(ground).length > 0) {
    world.festival = {
      infrastructure: { ground: structuredClone(ground) },
    } as GameSnapshot['festival']
  }
  return world
}

export function exportScenarioFile(snapshot: GameSnapshot, meta: ScenarioExportMeta): ScenarioFile {
  const settings = normalizeScenarioSettings({
    ...snapshot.scenario,
    startingMoney: meta.startingMoney,
    startingLoan: meta.startingLoan,
    carArrivalShare: meta.carArrivalShare,
    partyAffinity: meta.partyAffinity,
    beautyAffinity: meta.beautyAffinity,
    aggressiveShare: meta.aggressiveShare,
    goals: meta.goals ?? snapshot.scenario.goals,
    title: meta.name,
    detail: meta.detail,
    preset: scenarioFileSlug(meta.id ?? meta.name),
    authoring: false,
  })
  delete settings.authoring
  const tickets = normalizeTickets(meta.tickets ?? snapshot.festival.tickets)
  const demandTuning = normalizeTicketDemandTuning(meta.demandTuning ?? snapshot.festival.demandTuning)
  return {
    kind: SCENARIO_FILE_KIND,
    format: SCENARIO_FILE_FORMAT,
    id: settings.preset ?? scenarioFileSlug(meta.name),
    name: meta.name.trim().slice(0, 80) || 'Szenario',
    detail: meta.detail.trim().slice(0, 800) || 'Ein selbst gebautes Szenario.',
    settings,
    ...(tickets ? { tickets } : {}),
    demandTuning,
    world: captureScenarioWorld(snapshot),
  }
}

export function serializeScenarioFile(file: ScenarioFile): string {
  return `${JSON.stringify(file, null, 2)}\n`
}

function applyPlayableStart(snapshot: GameSnapshot, file: ScenarioFile): GameSnapshot {
  const settings = normalizeScenarioSettings({
    ...file.settings,
    preset: file.id,
    title: file.name,
    detail: file.detail,
    authoring: false,
  })
  delete settings.authoring
  snapshot.scenario = settings
  snapshot.money = settings.startingMoney
  snapshot.finance = createFinanceState(settings.startingLoan)
  snapshot.parkOpen = false
  snapshot.festival.planning = true
  snapshot.festival.goals = weekendGoals(1, settings.festivalGoals)
  if (file.demandTuning) snapshot.festival.demandTuning = normalizeTicketDemandTuning(file.demandTuning)
  if (file.tickets) {
    snapshot.festival.tickets = {
      day: file.tickets.day,
      camping: file.tickets.camping,
      usedDay: {},
      usedCamping: 0,
    }
  }
  snapshot.visitors = []
  snapshot.cashEffects = []
  snapshot.fireworkEffects = []
  snapshot.incidents = []
  snapshot.guests = 0
  snapshot.speed = 1
  snapshot.selectedTool = 'inspect'
  return snapshot
}

/** Start a playable game from a drop-in file. Authoring is always stripped. */
export function createSnapshotFromScenarioFile(file: ScenarioFile): GameSnapshot {
  const settings = normalizeScenarioSettings({
    ...file.settings,
    preset: file.id,
    title: file.name,
    detail: file.detail,
    authoring: false,
  })
  delete settings.authoring
  if (!file.world) return applyPlayableStart(createInitialSnapshot(settings), file)
  const importedGround = file.world.festival?.infrastructure?.ground
  const worldRest = { ...file.world }
  delete worldRest.festival
  const merged = migrateSnapshot({
    ...createBlankSnapshot(settings),
    ...worldRest,
    scenario: settings,
  })
  const snapshot = applyPlayableStart(merged ?? createInitialSnapshot(settings), file)
  if (importedGround) {
    snapshot.festival.infrastructure.ground = {
      ...snapshot.festival.infrastructure.ground,
      ...structuredClone(importedGround),
    }
    normalizeGroundCells(snapshot.festival.infrastructure.ground)
  }
  return snapshot
}

export function createAuthoringSettings(partial?: Partial<ScenarioSettings>): ScenarioSettings {
  return normalizeScenarioSettings({ ...partial, authoring: true })
}

export function authoringSession(snapshot: GameSnapshot): boolean {
  return isAuthoringScenario(snapshot.scenario)
}
