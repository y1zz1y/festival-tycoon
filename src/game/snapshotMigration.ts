import { normalizeBandActor } from './bandActors'
import { emptyBandSupplySnapshot, normalizeBackstageCell } from './bandSupply'
import { createFinanceState } from './finance'
import { normalizeLogisticsSnapshot } from './logistics'
import { normalizePower } from './power'
import { normalizeScenarioSettings } from './scenario'
import { createScenarioProgress } from './scenarioGoals'
import { SIMULATION_CONFIG } from './simulationConfig'
import { createBlankSnapshot } from './snapshotBootstrap'
import { migrateStageDesign } from './stageDesign'
import { normalizeTerrain, normalizeWaterLevel } from './terrain'
import { normalizeWasteDumpCell } from './waste'
import type { BackstageCell } from './bandSupply'
import type { BandActor } from './bandActors'
import type { GameSnapshot } from './types/snapshot'
import type { WasteDumpCell } from './waste'

export function migrateSnapshot(
  input: unknown,
): GameSnapshot | null {
  if (!input || typeof input !== 'object') return null
  const data = input as Partial<GameSnapshot> & { version?: number }
  if (!Array.isArray(data.buildings)) return null

  const scenario = normalizeScenarioSettings(data.scenario)
  const migrated: GameSnapshot = {
    ...createBlankSnapshot(),
    ...data,
    version: 30,
    waterLevel: normalizeWaterLevel(data.waterLevel),
    terrain: normalizeTerrain(data.terrain),
    buildings: data.buildings.map((building) =>
      building.stageDesign
        ? { ...building, stageDesign: migrateStageDesign(building.stageDesign) }
        : building,
    ),
    campingCells: Array.isArray(data.campingCells) ? data.campingCells : [],
    campInstallations: Array.isArray(data.campInstallations)
      ? data.campInstallations
      : [],
    staff: Array.isArray(data.staff) ? data.staff : [],
    medicalCells: Array.isArray(data.medicalCells) ? data.medicalCells : [],
    wasteDumpCells: Array.isArray(data.wasteDumpCells)
      ? data.wasteDumpCells
          .map(normalizeWasteDumpCell)
          .filter((cell): cell is WasteDumpCell => cell !== null)
      : [],
    incidents: Array.isArray(data.incidents) ? data.incidents : [],
    logistics: normalizeLogisticsSnapshot(data.logistics),
    scenario,
    finance:
      data.finance && Array.isArray(data.finance.periods)
        ? {
            loan: Math.max(0, Number(data.finance.loan) || 0),
            periods: data.finance.periods,
            today: data.finance.today ?? {},
            previousDay: data.finance.previousDay ?? {},
          }
        : createFinanceState(),
    scenarioProgress:
      data.scenarioProgress && Array.isArray(data.scenarioProgress.status)
        ? data.scenarioProgress
        : createScenarioProgress(scenario.goals),
    stageForecourtCells: Array.isArray(data.stageForecourtCells)
      ? data.stageForecourtCells
      : [],
    backstageCells: Array.isArray(data.backstageCells)
      ? data.backstageCells
          .map(normalizeBackstageCell)
          .filter((cell): cell is BackstageCell => cell !== null)
      : [],
    bandActors: Array.isArray(data.bandActors)
      ? data.bandActors
          .map(normalizeBandActor)
          .filter((actor): actor is BandActor => actor !== null)
      : [],
    bandSupply: emptyBandSupplySnapshot(),
    visitors: Array.isArray(data.visitors) ? data.visitors : [],
    coasters: Array.isArray(data.coasters) ? data.coasters : [],
    power: normalizePower(data.power),
    campingTicketPrice:
      data.campingTicketPrice ??
      data.entryPrice ??
      SIMULATION_CONFIG.economy.defaultCampingTicketPrice,
  }
  if (migrated.festival.stageTemplates) {
    migrated.festival.stageTemplates =
      migrated.festival.stageTemplates.map(migrateStageDesign)
  }
  return migrated
}
