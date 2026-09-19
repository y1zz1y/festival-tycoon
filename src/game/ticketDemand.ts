import { BANDS, bandPriceWillingness, bandVisitorDraw } from './festivalManagement'
import { SIMULATION_CONFIG } from './simulationConfig'
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
  const beauty = clamp01(((state.attractiveness.average ?? 0) + 40) / 80)
  const complaints = complaintPressure(state)
  const history = festivalHistory(state)
  const size = festivalSize(state)
  const lineup = lineupPull(state)
  const rides = attractionPull(state)
  const day = clamp01(
    0.18 +
      beauty * 0.16 +
      history * 0.1 +
      size * 0.1 +
      lineup.draw * 0.22 +
      lineup.willingness * 0.28 +
      rides * 0.14 -
      complaints * 0.22,
  )
  const camping = clamp01(
    0.12 +
      beauty * 0.28 +
      history * 0.24 +
      size * 0.16 +
      lineup.draw * 0.12 +
      lineup.willingness * 0.1 +
      rides * 0.06 -
      complaints * 0.28,
  )
  return { day, camping }
}

export function priceAcceptance(price: number, fairPrice: number): number {
  if (fairPrice <= 0) return price <= 0 ? 1 : 0
  const ratio = price / fairPrice
  if (ratio <= 0.7) return 1
  if (ratio >= 2.2) return 0.05
  return clamp01(1 - (ratio - 0.7) / 1.5)
}

export function fairTicketPrices(willingness: TicketWillingness): { day: number; camping: number } {
  const baseDay = SIMULATION_CONFIG.economy.defaultEntryPrice
  const baseCamp = SIMULATION_CONFIG.economy.defaultCampingTicketPrice
  return {
    day: Math.max(1, Math.round(baseDay * (0.55 + willingness.day * 1.8))),
    camping: Math.max(2, Math.round(baseCamp * (0.6 + willingness.camping * 1.6))),
  }
}

export function estimateTicketDemand(
  state: GameSnapshot,
  prices?: { day?: number; camping?: number },
): TicketDemandEstimate {
  const dayPrice = prices?.day ?? state.entryPrice
  const campPrice = prices?.camping ?? state.campingTicketPrice
  const willingness = purchaseWillingness(state)
  const fair = fairTicketPrices(willingness)
  const dayAccept = priceAcceptance(dayPrice, fair.day) * willingness.day
  const campAccept = priceAcceptance(campPrice, fair.camping) * willingness.camping
  const lineup = lineupPull(state)
  const baseDay = 80 + lineup.draw * 420 + festivalSize(state) * 180
  const campCapacity = Math.max(0, state.campingCells.length)
  const expectedDayGuests = Math.round(baseDay * (0.25 + dayAccept * 1.15))
  const expectedCampers = Math.round(Math.min(campCapacity, 12 + campCapacity * campAccept))
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
  const accept =
    ticket === 'day'
      ? priceAcceptance(state.entryPrice, fairTicketPrices(estimate.willingness).day) *
        estimate.willingness.day
      : priceAcceptance(state.campingTicketPrice, fairTicketPrices(estimate.willingness).camping) *
        estimate.willingness.camping
  return Math.max(0.2, Math.min(1.15, 0.25 + accept * 0.9))
}
