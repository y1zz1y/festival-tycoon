import { createAccessControlSnapshot } from './accessControl'
import { emptyBandSupplySnapshot } from './bandSupply'
import { createComplaintSnapshot } from './complaints'
import { createDefaultDayPlan } from './dayPlan'
import { createFestivalManagement } from './festivalManagement'
import { createFinanceState } from './finance'
import { createDefaultLogisticsSnapshot } from './logistics'
import { DeterministicRng, hashStringSeed } from './rng'
import {
  createDefaultScenarioSettings,
  createScenarioEntrance,
  createScenarioRoadEntry,
  normalizeScenarioSettings,
} from './scenario'
import { createScenarioProgress } from './scenarioGoals'
import { SIMULATION_CONFIG } from './simulationConfig'
import { createEmptyTerrain, DEFAULT_WATER_LEVEL, generateTerrain, scatterWildTrees } from './terrain'
import { createEmptyPower } from './power'
import type { ScenarioSettings } from './scenario'
import type { GameSnapshot } from './types/snapshot'

export const ENTRANCE_PATH_ID = 'entrance-path'

export function createBlankSnapshot(
  scenario: ScenarioSettings = createDefaultScenarioSettings(),
): GameSnapshot {
  const settings = normalizeScenarioSettings(scenario)
  const entrance = createScenarioEntrance(settings.worldSize)
  return {
    festival: createFestivalManagement(),
    version: 31,
    waterLevel: DEFAULT_WATER_LEVEL,
    simTick: 0,
    rngState: hashStringSeed(
      `festival-${settings.worldSize}-${settings.startingMoney}`,
    ),
    money: settings.startingMoney,
    finance: createFinanceState(settings.startingLoan),
    scenarioProgress: createScenarioProgress(settings.goals),
    entryPrice: SIMULATION_CONFIG.economy.defaultEntryPrice,
    campingTicketPrice: SIMULATION_CONFIG.economy.defaultCampingTicketPrice,
    parkOpen: true,
    guests: 0,
    reputation: SIMULATION_CONFIG.economy.startingReputation,
    day: 1,
    minute: SIMULATION_CONFIG.time.startMinute,
    speed: 1,
    selectedTool: 'inspect',
    buildElevation: 0,
    buildRotation: 0,
    buildings: [
      {
        id: ENTRANCE_PATH_ID,
        kind: 'path',
        x: entrance.x,
        z: entrance.z,
        rotation: 0,
        elevation: 0,
        pathType: 'normal',
        pathSlope: 0,
        pathSlopeDirection: 0,
        price: 0,
      },
    ],
    campingCells: [],
    campInstallations: [],
    visitors: [],
    attractions: [],
    coasters: [],
    courses: [],
    cashEffects: [],
    fireworkEffects: [],
    crowding: { average: 0, maximum: 0, cells: [] },
    staff: [],
    medicalCells: [],
    wasteDumpCells: [],
    incidents: [],
    stageForecourtCells: [],
    backstageCells: [],
    bandActors: [],
    bandSupply: emptyBandSupplySnapshot(),
    attractiveness: { average: 0, maximum: 0, minimum: 0, cells: [] },
    partyMood: { average: 0, maximum: 0, minimum: 0, cells: [] },
    dayPlan: createDefaultDayPlan(),
    complaints: createComplaintSnapshot(),
    logistics: createDefaultLogisticsSnapshot(),
    accessControls: createAccessControlSnapshot(),
    scenario: settings,
    terrain: createEmptyTerrain(),
    power: createEmptyPower(),
  }
}

export function createInitialSnapshot(
  scenario: ScenarioSettings = createDefaultScenarioSettings(),
): GameSnapshot {
  const snapshot = createBlankSnapshot(scenario)
  snapshot.parkOpen = false
  snapshot.festival.planning = true
  snapshot.festival.tickets = { day: 150, camping: 0, usedDay: {}, usedCamping: 0 }
  const entrance = createScenarioEntrance(snapshot.scenario.worldSize)
  const rng = new DeterministicRng(snapshot.rngState)
  snapshot.terrain = generateTerrain(
    snapshot.scenario.worldSize,
    rng,
    snapshot.scenario.unevenness,
    snapshot.scenario.environment,
  )
  snapshot.buildings.push(
    ...scatterWildTrees(
      snapshot.terrain,
      snapshot.scenario.worldSize,
      [entrance, createScenarioRoadEntry(snapshot.scenario.worldSize)],
      rng,
      snapshot.scenario.environment,
    ),
  )
  snapshot.rngState = rng.getState()
  return snapshot
}
