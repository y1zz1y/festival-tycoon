/**
 * Current-cost line items for the finance ledger. The books only store
 * category totals; this derives the stand / ride / wage / loan pieces from
 * the same sources the hourly running costs already use, without changing
 * how the simulation books money.
 */
import { BUILDINGS, type BuildingKind } from './catalog'
import { COURSE_SPECS, courseHourlyUpkeep } from './courseAttractions'
import {
  CARRIER_WAGE_PER_MINUTE,
  LOAN,
  loanInterest,
  type FinanceCategory,
} from './finance'
import { BANDS } from './festivalManagement'
import { SIMULATION_CONFIG } from './simulationConfig'
import { STAFF_DEFINITIONS, STAFF_ROLES } from './staff'
import type { PlacedBuilding } from './types/entities'
import type { GameSnapshot } from './types/snapshot'
import {
  buildingHourlyUpkeep,
  coasterHourlyUpkeep,
  festivalIsLive,
  festivalIsOnBreak,
  garbageTruckCount,
  venueUpkeepIdle,
} from './upkeep'

const BOOTH_KINDS = new Set<BuildingKind>(['food', 'alcohol', 'shirt', 'mascot', 'toilet'])

export const FINANCE_BREAKDOWN_SECTION_NAMES = {
  stands: 'Stände',
  attractions: 'Attraktionen',
  stages: 'Bühnen',
  other: 'Sonstiges',
  wages: 'Löhne',
  carriers: 'Träger',
  loan: 'Darlehen',
  bookings: 'Buchungen',
} as const

export type FinanceBreakdownSectionId = keyof typeof FINANCE_BREAKDOWN_SECTION_NAMES

export type FinanceBreakdownItem = {
  id: string
  label: string
  count: number
  amount: number
}

export type FinanceBreakdownSection = {
  id: FinanceBreakdownSectionId
  label: string
  items: FinanceBreakdownItem[]
}

export type FinanceCategoryBreakdown = {
  category: FinanceCategory
  hint: string
  sections: FinanceBreakdownSection[]
  total: number
}

export type FinanceBreakdown = Partial<Record<FinanceCategory, FinanceCategoryBreakdown>>

const RUNNING_HINT =
  'Aktuelle Tageskosten — entspricht der Spalte Prognose morgen.'
const BANDS_HINT = 'Gebuchte Gagen, bereits bei der Buchung gezahlt.'

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function dailyFromHourly(hourly: number): number {
  return roundMoney(-hourly * 24)
}

function addHourlyItem(
  items: Map<string, { label: string; count: number; hourly: number }>,
  id: string,
  label: string,
  hourly: number,
): void {
  if (hourly <= 0) return
  const existing = items.get(id)
  if (existing) {
    existing.count += 1
    existing.hourly += hourly
    return
  }
  items.set(id, { label, count: 1, hourly })
}

function sectionFromHourly(
  id: FinanceBreakdownSectionId,
  items: Map<string, { label: string; count: number; hourly: number }>,
): FinanceBreakdownSection | undefined {
  if (items.size === 0) return undefined
  return {
    id,
    label: FINANCE_BREAKDOWN_SECTION_NAMES[id],
    items: [...items.entries()].map(([itemId, item]) => ({
      id: itemId,
      label: item.label,
      count: item.count,
      amount: dailyFromHourly(item.hourly),
    })),
  }
}

function buildingLabel(building: Pick<PlacedBuilding, 'kind' | 'rideType' | 'stageDesign'>): string {
  if (building.kind === 'stage') return building.stageDesign?.name || BUILDINGS.stage.name
  if (building.rideType === 'bungee') return 'Bungee-Turm'
  return BUILDINGS[building.kind].name
}

function upkeepSectionId(
  building: Pick<PlacedBuilding, 'kind' | 'rideType'>,
): FinanceBreakdownSectionId {
  if (building.kind === 'stage') return 'stages'
  if (BOOTH_KINDS.has(building.kind)) return 'stands'
  if (building.kind === 'ride' || building.rideType === 'bungee') return 'attractions'
  return 'other'
}

function buildingItemId(building: PlacedBuilding, hourly: number): string {
  if (building.kind === 'stage') return `stage:${building.id}`
  if (building.rideType === 'bungee') return `bungee:${hourly}`
  return `${building.kind}:${hourly}`
}

function collectUpkeep(state: GameSnapshot): FinanceCategoryBreakdown | undefined {
  const festivalLive = festivalIsLive(state)
  const onBreak = festivalIsOnBreak(state)
  const idle = venueUpkeepIdle({ festivalLive, onBreak })
  const buckets: Record<FinanceBreakdownSectionId, Map<string, { label: string; count: number; hourly: number }>> = {
    stands: new Map(),
    attractions: new Map(),
    stages: new Map(),
    other: new Map(),
    wages: new Map(),
    carriers: new Map(),
    loan: new Map(),
    bookings: new Map(),
  }
  let hourlyTotal = 0

  for (const building of state.buildings) {
    const hourly = buildingHourlyUpkeep(building, { festivalLive, onBreak })
    hourlyTotal += hourly
    addHourlyItem(
      buckets[upkeepSectionId(building)],
      buildingItemId(building, hourly),
      buildingLabel(building),
      hourly,
    )
  }
  for (const coaster of state.coasters ?? []) {
    const hourly = coasterHourlyUpkeep(coaster.pieces?.length ?? 0, idle)
    hourlyTotal += hourly
    addHourlyItem(buckets.attractions, `coaster:${coaster.id}`, coaster.name, hourly)
  }
  for (const course of state.courses ?? []) {
    const hourly = courseHourlyUpkeep(course, idle)
    hourlyTotal += hourly
    addHourlyItem(
      buckets.attractions,
      `course:${course.id}`,
      course.name || COURSE_SPECS[course.kind].name,
      hourly,
    )
  }
  const truckRate = SIMULATION_CONFIG.logistics.garbageTruckUpkeepPerHour
  for (let n = 0; n < garbageTruckCount(state); n++) {
    hourlyTotal += truckRate
    addHourlyItem(buckets.other, 'garbageTruck', 'Müllwagen', truckRate)
  }
  if (state.power?.backupActive) {
    const hourly = SIMULATION_CONFIG.power.backupFuelPerHour
    hourlyTotal += hourly
    addHourlyItem(buckets.other, 'backupFuel', 'Notstromaggregat (Brennstoff)', hourly)
  }

  const sections = (['stands', 'attractions', 'stages', 'other'] as const)
    .map((id) => sectionFromHourly(id, buckets[id]))
    .filter((section): section is FinanceBreakdownSection => Boolean(section))
  if (sections.length === 0) return undefined
  return {
    category: 'upkeep',
    hint: RUNNING_HINT,
    sections,
    total: dailyFromHourly(hourlyTotal),
  }
}

function collectStaff(state: GameSnapshot): FinanceCategoryBreakdown | undefined {
  const wages = new Map<string, { label: string; count: number; hourly: number }>()
  let hourlyTotal = 0
  const counts: Partial<Record<(typeof STAFF_ROLES)[number], number>> = {}
  for (const member of state.staff ?? []) {
    counts[member.role] = (counts[member.role] ?? 0) + 1
  }
  for (const role of STAFF_ROLES) {
    const count = counts[role] ?? 0
    if (!count) continue
    const hourly = STAFF_DEFINITIONS[role].hourlyWage * count
    hourlyTotal += hourly
    wages.set(role, { label: STAFF_DEFINITIONS[role].name, count, hourly })
  }
  const carriers = state.festival?.infrastructure?.routes.length ?? 0
  const carrierHourly = carriers * CARRIER_WAGE_PER_MINUTE * 60
  hourlyTotal += carrierHourly
  const sections = [
    sectionFromHourly('wages', wages),
    carriers > 0
      ? {
          id: 'carriers' as const,
          label: FINANCE_BREAKDOWN_SECTION_NAMES.carriers,
          items: [{
            id: 'carriers',
            label: 'Träger',
            count: carriers,
            amount: dailyFromHourly(carrierHourly),
          }],
        }
      : undefined,
  ].filter((section): section is FinanceBreakdownSection => Boolean(section))
  if (sections.length === 0) return undefined
  return {
    category: 'staff',
    hint: RUNNING_HINT,
    sections,
    total: dailyFromHourly(hourlyTotal),
  }
}

function collectInterest(state: GameSnapshot): FinanceCategoryBreakdown | undefined {
  const loan = state.finance?.loan ?? 0
  if (loan <= 0) return undefined
  const daily = -loanInterest(loan, 1)
  return {
    category: 'interest',
    hint: RUNNING_HINT,
    sections: [{
      id: 'loan',
      label: FINANCE_BREAKDOWN_SECTION_NAMES.loan,
      items: [{
        id: 'loan',
        label: `Offenes Darlehen · ${(LOAN.interestPerDay * 100).toFixed(1)} % / Tag`,
        count: 1,
        amount: daily,
      }],
    }],
    total: daily,
  }
}

function collectBands(state: GameSnapshot): FinanceCategoryBreakdown | undefined {
  const bookings = state.festival?.bookings ?? []
  if (bookings.length === 0) return undefined
  const items: FinanceBreakdownItem[] = bookings.map((booking) => ({
    id: booking.id,
    label: BANDS.find((band) => band.id === booking.bandId)?.name ?? booking.bandId,
    count: 1,
    amount: roundMoney(-booking.fee),
  }))
  return {
    category: 'bands',
    hint: BANDS_HINT,
    sections: [{
      id: 'bookings',
      label: FINANCE_BREAKDOWN_SECTION_NAMES.bookings,
      items,
    }],
    total: roundMoney(items.reduce((sum, item) => sum + item.amount, 0)),
  }
}

/** Line items for expandable ledger rows. Empty categories are omitted. */
export function financeCostBreakdown(state: GameSnapshot): FinanceBreakdown {
  const breakdown: FinanceBreakdown = {}
  const upkeep = collectUpkeep(state)
  const staff = collectStaff(state)
  const interest = collectInterest(state)
  const bands = collectBands(state)
  if (upkeep) breakdown.upkeep = upkeep
  if (staff) breakdown.staff = staff
  if (interest) breakdown.interest = interest
  if (bands) breakdown.bands = bands
  return breakdown
}
