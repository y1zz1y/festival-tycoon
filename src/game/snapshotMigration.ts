import { normalizeBandActor } from './bandActors'
import { isAttractionDefinitionId } from './attractions/definitions'
import { migrateLegacyAttractions } from './attractions/migration'
import {
  projectCamping,
  projectCoasters,
  projectCourses,
  projectPartyAreas,
  refreshLegacyAttractionRecords,
} from './attractions/projections'
import type { Attraction } from './attractions/types'
import { emptyBandSupplySnapshot, normalizeBackstageCell } from './bandSupply'
import { createFinanceState } from './finance'
import { normalizeLogisticsSnapshot } from './logistics'
import { normalizePower } from './power'
import { normalizeScenarioSettings } from './scenario'
import { createScenarioProgress } from './scenarioGoals'
import { SIMULATION_CONFIG } from './simulationConfig'
import { normalizeCourses } from './courseAttractions'
import { createBlankSnapshot } from './snapshotBootstrap'
import { migrateStageDesign } from './stageDesign'
import { normalizeTerrain, normalizeWaterLevel } from './terrain'
import { normalizeWasteDumpCell } from './waste'
import type { BackstageCell } from './bandSupply'
import type { BandActor } from './bandActors'
import type { GameSnapshot } from './types/snapshot'
import type { WasteDumpCell } from './waste'
import { normalizeTicketDemandTuning } from './demandTuning'

export function migrateSnapshot(
  input: unknown,
): GameSnapshot | null {
  if (!input || typeof input !== 'object') return null
  const data = input as Partial<GameSnapshot> & { version?: number }
  if (!Array.isArray(data.buildings)) return null

  const scenario = normalizeScenarioSettings(data.scenario)
  const legacy = migrateLegacyAttractions({
    coasters: Array.isArray(data.coasters) ? data.coasters : [],
    courses: normalizeCourses(data.courses),
    campingCells: Array.isArray(data.campingCells) ? data.campingCells : [],
    campInstallations: Array.isArray(data.campInstallations) ? data.campInstallations : [],
    stageForecourtCells: Array.isArray(data.stageForecourtCells) ? data.stageForecourtCells : [],
    buildings: data.buildings,
  })
  const canonicalAttractions = normalizeAttractions(data.attractions)
  const useCanonical = (data.version ?? 0) >= 31 && canonicalAttractions.length > 0
  const attractions = useCanonical ? canonicalAttractions : legacy.attractions
  const projectedCamping = projectCamping(attractions)
  const campingCells = Array.isArray(data.campingCells) ? data.campingCells : projectedCamping.cells
  const campInstallations = Array.isArray(data.campInstallations)
    ? data.campInstallations
    : projectedCamping.installations
  const stageForecourtCells = Array.isArray(data.stageForecourtCells)
    ? data.stageForecourtCells
    : projectPartyAreas(attractions)
  const migrated: GameSnapshot = {
    ...createBlankSnapshot(),
    ...data,
    version: 33,
    festival: {
      ...createBlankSnapshot().festival,
      ...data.festival,
      demandTuning: normalizeTicketDemandTuning(data.festival?.demandTuning),
    },
    waterLevel: normalizeWaterLevel(data.waterLevel),
    terrain: normalizeTerrain(data.terrain),
    buildings: data.buildings.map((building) =>
      building.stageDesign
        ? { ...building, stageDesign: migrateStageDesign(building.stageDesign) }
        : building,
    ),
    campingCells,
    campInstallations,
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
    stageForecourtCells,
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
    attractions,
    migrationReport: {
      removedAttractionIds: useCanonical ? [] : legacy.removedIds,
    },
    coasters: Array.isArray(data.coasters) && data.coasters.length > 0
      ? data.coasters
      : projectCoasters(attractions),
    courses: (() => {
      const saved = normalizeCourses(data.courses)
      return saved.length > 0 ? saved : projectCourses(attractions)
    })(),
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
  refreshLegacyAttractionRecords(migrated)
  return migrated
}

function normalizeAttractions(input: unknown): Attraction[] {
  if (!Array.isArray(input)) return []
  return input.filter((candidate): candidate is Attraction => {
    if (!candidate || typeof candidate !== 'object') return false
    const attraction = candidate as Partial<Attraction>
    return typeof attraction.id === 'string' &&
      typeof attraction.definitionId === 'string' &&
      isAttractionDefinitionId(attraction.definitionId) &&
      Boolean(attraction.layout) &&
      Boolean(attraction.access) &&
      Array.isArray(attraction.queue)
  })
}
