import type { AccessControlSnapshot } from '../accessControl'
import type { AtmosphereSnapshot } from '../atmosphere'
import type { BandActor } from '../bandActors'
import type { BackstageCell, BandSupplySnapshot } from '../bandSupply'
import type { CampingCell, CampInstallation } from '../camping'
import type { Coaster } from '../coasters'
import type { ComplaintSnapshot } from '../complaints'
import type { CrowdingSnapshot } from '../crowding'
import type { DayPlan } from '../dayPlan'
import type { FestivalManagement } from '../festivalManagement'
import type { FireworkEffect } from '../fireworks'
import type { FinanceState } from '../finance'
import type { StageForecourtCell } from '../festivalAreas'
import type { GroundIncident } from '../incidents'
import type { LogisticsSnapshot } from '../logistics'
import type { MedicalCell } from '../medical'
import type { GameCommand } from '../../net/protocol'
import type { PowerSnapshot } from '../power'
import type { ScenarioSettings } from '../scenario'
import type { ScenarioProgress } from '../scenarioGoals'
import type { StaffMember } from '../staff'
import type { TerrainSnapshot } from '../terrain'
import type { Tool } from '../catalog'
import type { WasteDumpCell } from '../waste'
import type { CashEffect, PlacedBuilding, Visitor } from './entities'

export type SimTurn = {
  tick: number
  commands: GameCommand[]
  step: boolean
  hash: number
}

export type GameSnapshot = {
  festival: FestivalManagement
  version: 30
  waterLevel: number
  simTick: number
  rngState: number
  money: number
  entryPrice: number
  campingTicketPrice: number
  parkOpen: boolean
  guests: number
  reputation: number
  day: number
  minute: number
  speed: number
  selectedTool: Tool
  buildElevation: number
  buildRotation: number
  buildings: PlacedBuilding[]
  campingCells: CampingCell[]
  campInstallations: CampInstallation[]
  visitors: Visitor[]
  coasters: Coaster[]
  cashEffects: CashEffect[]
  fireworkEffects: FireworkEffect[]
  crowding: CrowdingSnapshot
  staff: StaffMember[]
  medicalCells: MedicalCell[]
  wasteDumpCells: WasteDumpCell[]
  incidents: GroundIncident[]
  stageForecourtCells: StageForecourtCell[]
  backstageCells: BackstageCell[]
  bandActors: BandActor[]
  bandSupply: BandSupplySnapshot
  attractiveness: AtmosphereSnapshot
  partyMood: AtmosphereSnapshot
  dayPlan: DayPlan
  complaints: ComplaintSnapshot
  logistics: LogisticsSnapshot
  accessControls: AccessControlSnapshot
  scenario: ScenarioSettings
  finance: FinanceState
  scenarioProgress: ScenarioProgress
  terrain: TerrainSnapshot
  power: PowerSnapshot
}

export type ActionResult = {
  ok: boolean
  message: string
  placedId?: string
  slotId?: string
}

export type LocalSaveSlot = {
  id: string
  name: string
  savedAt: number
}
