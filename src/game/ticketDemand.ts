import { BANDS, bandPriceWillingness, bandVisitorDraw } from './festivalManagement'
import { SIMULATION_CONFIG } from './simulationConfig'
import {
  normalizeTicketDemandTuning,
  type TicketDemandTuning,
} from './demandTuning'
import type { GameSnapshot } from './types/snapshot'

export type TicketWillingness = {
  day: number
  camping: number
}

export type TicketDemandEstimate = {
  willingness: TicketWillingness
  expectedDayGuests: number
  expectedCampers: number
  expectedDayRevenue: number
  expectedCampingRevenue: number
  dayColor: string
  campingColor: string
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function complaintPressure(state: Pick<GameSnapshot, 'complaints'>): number {
  const current = Object.values(state.complaints.currentSession ?? {}).reduce((sum, n) => sum + n, 0)
  const previous = Object.values(state.complaints.previousSession ?? {}).reduce((sum, n) => sum + n, 0)
  return Math.min(1, (current * 0.55 + previous * 0.9) / 80)
}

function festivalHistory(state: Pick<GameSnapshot, 'festival'>): number {
  const reports = state.festival.reports ?? []
  if (reports.length === 0) return 0.5
  const recent = reports.slice(-3)
  const satisfaction = recent.reduce((sum, report) => sum + report.satisfaction, 0) / recent.length
  return clamp01(satisfaction / 100)
}

function festivalSize(state: Pick<GameSnapshot, 'buildings' | 'campingCells'>): number {
  const stages = state.buildings.filter((building) => building.kind === 'stage').length
  const camping = state.campingCells.length
  return clamp01(stages / 6 + camping / 80)
}

function lineupPull(state: Pick<GameSnapshot, 'festival'>): { draw: number; willingness: number } {
  const bookings = state.festival.bookings
  if (bookings.length === 0) return { draw: 0.2, willingness: 0.25 }
  let draw = 0
  let willingness = 0
  for (const booking of bookings) {
    const band = BANDS.find((entry) => entry.id === booking.bandId)
    if (!band) continue
    draw += bandVisitorDraw(band)
    willingness += bandPriceWillingness(band)
  }
  return {
    draw: clamp01(draw / 280),
    willingness: clamp01(willingness / bookings.length),
  }
}

function attractionPull(state: Pick<GameSnapshot, 'buildings' | 'coasters'>): number {
  const rides = state.buildings.filter((building) => building.kind === 'ride').length
  const coasters = state.coasters?.length ?? 0
  return clamp01(rides * 0.08 + coasters * 0.18)
}

export function willingnessColor(value: number): string {
  if (value >= 0.66) return '#3dba6b'
  if (value >= 0.4) return '#d4b43a'
  return '#d4543a'
}

export function purchaseWillingness(
  state: Pick<
    GameSnapshot,
    'attractiveness' | 'complaints' | 'festival' | 'buildings' | 'campingCells' | 'coasters'
  >,
): TicketWillingness {
  const tuning = normalizeTicketDemandTuning(state.festival.demandTuning)
  const beauty = clamp01(((state.attractiveness.average ?? 0) + 40) / 80)
  const complaints = complaintPressure(state)
  const history = festivalHistory(state)
  const size = festivalSize(state)
  const lineup = lineupPull(state)
  const rides = attractionPull(state)
  const dayWeights = tuning.willingness.day
  const campingWeights = tuning.willingness.camping
  const day = clamp01(
    dayWeights.base +
      beauty * dayWeights.beauty +
      history * dayWeights.history +
      size * dayWeights.size +
      lineup.draw * dayWeights.lineupDraw +
      lineup.willingness * dayWeights.lineupPrice +
      rides * dayWeights.attractions +
      complaints * dayWeights.complaints,
  )
  const camping = clamp01(
    campingWeights.base +
      beauty * campingWeights.beauty +
      history * campingWeights.history +
      size * campingWeights.size +
      lineup.draw * campingWeights.lineupDraw +
      lineup.willingness * campingWeights.lineupPrice +
      rides * campingWeights.attractions +
      complaints * campingWeights.complaints,
  )
  return { day, camping }
}

export function priceAcceptance(
  price: number,
  fairPrice: number,
  tuning: TicketDemandTuning = normalizeTicketDemandTuning(),
): number {
  if (fairPrice <= 0) return price <= 0 ? 1 : 0
  const ratio = price / fairPrice
  const acceptance = tuning.priceAcceptance
  if (ratio <= acceptance.fullUntilRatio) return 1
  if (ratio >= acceptance.floorFromRatio) return acceptance.minimum
  const progress =
    (ratio - acceptance.fullUntilRatio) /
    (acceptance.floorFromRatio - acceptance.fullUntilRatio)
  return clamp01(1 - progress * (1 - acceptance.minimum))
}

export function fairTicketPrices(
  willingness: TicketWillingness,
  tuning: TicketDemandTuning = normalizeTicketDemandTuning(),
): { day: number; camping: number } {
  const baseDay = SIMULATION_CONFIG.economy.defaultEntryPrice
  const baseCamp = SIMULATION_CONFIG.economy.defaultCampingTicketPrice
  return {
    day: Math.max(1, Math.round(baseDay * (
      tuning.fairPrice.dayBaseFactor +
      willingness.day * tuning.fairPrice.dayWillingnessFactor
    ))),
    camping: Math.max(2, Math.round(baseCamp * (
      tuning.fairPrice.campingBaseFactor +
      willingness.camping * tuning.fairPrice.campingWillingnessFactor
    ))),
  }
}

export function estimateTicketDemand(
  state: GameSnapshot,
  prices?: { day?: number; camping?: number },
): TicketDemandEstimate {
  const dayPrice = prices?.day ?? state.entryPrice
  const campPrice = prices?.camping ?? state.campingTicketPrice
  const tuning = normalizeTicketDemandTuning(state.festival.demandTuning)
  const willingness = purchaseWillingness(state)
  const fair = fairTicketPrices(willingness, tuning)
  const dayAccept = priceAcceptance(dayPrice, fair.day, tuning) * willingness.day
  const campAccept = priceAcceptance(campPrice, fair.camping, tuning) * willingness.camping
  const lineup = lineupPull(state)
  const baseDay =
    tuning.attendance.dayBaseGuests +
    lineup.draw * tuning.attendance.dayLineupGuests +
    festivalSize(state) * tuning.attendance.daySizeGuests
  const campCapacity = Math.max(0, state.campingCells.length)
  const expectedDayGuests = Math.round(Math.max(0, baseDay * (
    tuning.attendance.dayBaseShare +
    dayAccept * tuning.attendance.dayAcceptanceShare
  )))
  const expectedCampers = Math.round(Math.min(
    campCapacity,
    tuning.attendance.campingBaseGuests +
      campCapacity * campAccept * tuning.attendance.campingAcceptanceShare,
  ))
  return {
    willingness,
    expectedDayGuests,
    expectedCampers,
    expectedDayRevenue: expectedDayGuests * dayPrice,
    expectedCampingRevenue: expectedCampers * campPrice,
    dayColor: willingnessColor(dayAccept),
    campingColor: willingnessColor(campAccept),
  }
}

export function arrivalPriceMultiplier(state: GameSnapshot, ticket: 'day' | 'camping'): number {
  const estimate = estimateTicketDemand(state)
  const tuning = normalizeTicketDemandTuning(state.festival.demandTuning)
  const fair = fairTicketPrices(estimate.willingness, tuning)
  const accept =
    ticket === 'day'
      ? priceAcceptance(state.entryPrice, fair.day, tuning) *
        estimate.willingness.day
      : priceAcceptance(state.campingTicketPrice, fair.camping, tuning) *
        estimate.willingness.camping
  return Math.max(
    tuning.arrivals.minimum,
    Math.min(
      tuning.arrivals.maximum,
      tuning.arrivals.base + accept * tuning.arrivals.acceptanceFactor,
    ),
  )
}
