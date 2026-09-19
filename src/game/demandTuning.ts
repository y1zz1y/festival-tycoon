import { SIMULATION_CONFIG } from './simulationConfig'

export type WillingnessWeights = {
  base: number
  beauty: number
  history: number
  size: number
  lineupDraw: number
  lineupPrice: number
  attractions: number
  complaints: number
}

export type TicketDemandTuning = {
  willingness: {
    day: WillingnessWeights
    camping: WillingnessWeights
  }
  fairPrice: {
    dayBaseFactor: number
    dayWillingnessFactor: number
    campingBaseFactor: number
    campingWillingnessFactor: number
  }
  priceAcceptance: {
    fullUntilRatio: number
    floorFromRatio: number
    minimum: number
  }
  attendance: {
    dayBaseGuests: number
    dayLineupGuests: number
    daySizeGuests: number
    dayBaseShare: number
    dayAcceptanceShare: number
    campingBaseGuests: number
    campingAcceptanceShare: number
  }
  arrivals: {
    minimum: number
    base: number
    acceptanceFactor: number
    maximum: number
  }
}

export function createTicketDemandTuning(): TicketDemandTuning {
  return structuredClone(SIMULATION_CONFIG.ticketDemand)
}

const finite = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback
}

export function normalizeTicketDemandTuning(
  value?: Partial<TicketDemandTuning> | null,
): TicketDemandTuning {
  const defaults = SIMULATION_CONFIG.ticketDemand
  const weights = (
    source: Partial<WillingnessWeights> | undefined,
    fallback: WillingnessWeights,
  ): WillingnessWeights => ({
    base: finite(source?.base, fallback.base, -2, 2),
    beauty: finite(source?.beauty, fallback.beauty, -3, 3),
    history: finite(source?.history, fallback.history, -3, 3),
    size: finite(source?.size, fallback.size, -3, 3),
    lineupDraw: finite(source?.lineupDraw, fallback.lineupDraw, -3, 3),
    lineupPrice: finite(source?.lineupPrice, fallback.lineupPrice, -3, 3),
    attractions: finite(source?.attractions, fallback.attractions, -3, 3),
    complaints: finite(source?.complaints, fallback.complaints, -3, 3),
  })
  const fullUntilRatio = finite(
    value?.priceAcceptance?.fullUntilRatio,
    defaults.priceAcceptance.fullUntilRatio,
    0,
    10,
  )
  const floorFromRatio = Math.max(
    fullUntilRatio + 0.01,
    finite(
      value?.priceAcceptance?.floorFromRatio,
      defaults.priceAcceptance.floorFromRatio,
      0.01,
      10,
    ),
  )
  const minimum = finite(
    value?.priceAcceptance?.minimum,
    defaults.priceAcceptance.minimum,
    0,
    1,
  )
  const arrivalMinimum = finite(value?.arrivals?.minimum, defaults.arrivals.minimum, 0, 10)
  const arrivalMaximum = Math.max(
    arrivalMinimum,
    finite(value?.arrivals?.maximum, defaults.arrivals.maximum, 0, 10),
  )
  return {
    willingness: {
      day: weights(value?.willingness?.day, defaults.willingness.day),
      camping: weights(value?.willingness?.camping, defaults.willingness.camping),
    },
    fairPrice: {
      dayBaseFactor: finite(value?.fairPrice?.dayBaseFactor, defaults.fairPrice.dayBaseFactor, 0, 10),
      dayWillingnessFactor: finite(value?.fairPrice?.dayWillingnessFactor, defaults.fairPrice.dayWillingnessFactor, 0, 10),
      campingBaseFactor: finite(value?.fairPrice?.campingBaseFactor, defaults.fairPrice.campingBaseFactor, 0, 10),
      campingWillingnessFactor: finite(value?.fairPrice?.campingWillingnessFactor, defaults.fairPrice.campingWillingnessFactor, 0, 10),
    },
    priceAcceptance: { fullUntilRatio, floorFromRatio, minimum },
    attendance: {
      dayBaseGuests: finite(value?.attendance?.dayBaseGuests, defaults.attendance.dayBaseGuests, 0, 100_000),
      dayLineupGuests: finite(value?.attendance?.dayLineupGuests, defaults.attendance.dayLineupGuests, -100_000, 100_000),
      daySizeGuests: finite(value?.attendance?.daySizeGuests, defaults.attendance.daySizeGuests, -100_000, 100_000),
      dayBaseShare: finite(value?.attendance?.dayBaseShare, defaults.attendance.dayBaseShare, 0, 10),
      dayAcceptanceShare: finite(value?.attendance?.dayAcceptanceShare, defaults.attendance.dayAcceptanceShare, 0, 10),
      campingBaseGuests: finite(value?.attendance?.campingBaseGuests, defaults.attendance.campingBaseGuests, 0, 100_000),
      campingAcceptanceShare: finite(value?.attendance?.campingAcceptanceShare, defaults.attendance.campingAcceptanceShare, 0, 10),
    },
    arrivals: {
      minimum: arrivalMinimum,
      base: finite(value?.arrivals?.base, defaults.arrivals.base, 0, 10),
      acceptanceFactor: finite(value?.arrivals?.acceptanceFactor, defaults.arrivals.acceptanceFactor, 0, 10),
      maximum: arrivalMaximum,
    },
  }
}
