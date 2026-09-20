import { BUILDINGS, type BuildingKind } from './catalog'
import { courseHourlyUpkeep } from './courseAttractions'
import { getFestivalCycleStatus } from './dayPlan'
import { stageStats } from './stageDesign'
import { SIMULATION_CONFIG } from './simulationConfig'
import type { PlacedBuilding } from './types/entities'
import type { GameSnapshot } from './types/snapshot'

const BOOTH_KINDS = new Set<BuildingKind>(['food', 'alcohol', 'shirt', 'mascot', 'toilet'])
const ATTRACTION_KINDS = new Set<BuildingKind>(['ride'])

export function festivalIsLive(state: Pick<GameSnapshot, 'festival' | 'dayPlan' | 'day'>): boolean {
  if (!state.festival.enabled || state.festival.finished || state.festival.planning) return false
  return getFestivalCycleStatus(state.dayPlan, state.day).phase === 'festival'
}

export function festivalIsOnBreak(state: Pick<GameSnapshot, 'dayPlan' | 'day'>): boolean {
  return getFestivalCycleStatus(state.dayPlan, state.day).phase === 'break'
}

/** Venues sit idle unless a started festival is in its live phase. */
export function venueUpkeepIdle(options: { festivalLive: boolean; onBreak: boolean }): boolean {
  return !options.festivalLive || options.onBreak
}

export function buildingHourlyUpkeep(
  building: Pick<PlacedBuilding, 'kind' | 'stageDesign' | 'rideType'>,
  options: { festivalLive: boolean; onBreak: boolean },
): number {
  const base = BUILDINGS[building.kind].upkeep
  const tech = building.stageDesign ? stageStats(building.stageDesign).upkeep : 0
  const idle = venueUpkeepIdle(options)
  if (building.kind === 'stage') {
    if (idle) {
      return base * SIMULATION_CONFIG.economy.inactiveFestivalStageMultiplier
    }
    return base + tech
  }
  if (idle && (BOOTH_KINDS.has(building.kind) || ATTRACTION_KINDS.has(building.kind))) {
    return (base + tech) * SIMULATION_CONFIG.economy.pauseUpkeepMultiplier
  }
  return base + tech
}

export function coasterHourlyUpkeep(
  pieces: number,
  idle: boolean,
): number {
  const full = Math.max(0, pieces) * SIMULATION_CONFIG.economy.coasterUpkeepPerPiece
  return idle ? full * SIMULATION_CONFIG.economy.pauseUpkeepMultiplier : full
}

export function snapshotHourlyBuildingUpkeep(state: GameSnapshot): number {
  const festivalLive = festivalIsLive(state)
  const onBreak = festivalIsOnBreak(state)
  const idle = venueUpkeepIdle({ festivalLive, onBreak })
  const buildings = state.buildings.reduce(
    (total, building) => total + buildingHourlyUpkeep(building, { festivalLive, onBreak }),
    0,
  )
  const coasters = (state.coasters ?? []).reduce(
    (total, coaster) => total + coasterHourlyUpkeep(coaster.pieces?.length ?? 0, idle),
    0,
  )
  const courses = (state.courses ?? []).reduce(
    (total, course) => total + courseHourlyUpkeep(course, idle),
    0,
  )
  return buildings + coasters + courses + garbageTruckHourlyUpkeep(state)
}

/** Every truck on the payroll costs the same whether it is out on a round or parked. */
export function garbageTruckHourlyUpkeep(state: Pick<GameSnapshot, 'logistics'>): number {
  return (
    garbageTruckCount(state) * SIMULATION_CONFIG.logistics.garbageTruckUpkeepPerHour
  )
}

export function garbageTruckCount(state: Pick<GameSnapshot, 'logistics'>): number {
  return (state.logistics?.roadVehicles ?? []).filter(
    (vehicle) => vehicle.kind === 'garbageTruck',
  ).length
}
