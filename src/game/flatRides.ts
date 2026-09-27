import { de } from '../i18n/marker'
import { BUILDINGS } from './catalog'
import { SIMULATION_CONFIG } from './simulationConfig'

/**
 * Flat rides are ride types of the one `ride` building, like the bungee tower: they
 * share its gates, queues, day-plan offer, power, audio and saves, and differ in
 * footprint (src/game/stageDesign.ts `buildingSize`), numbers (`SIMULATION_CONFIG.rides`),
 * model and name. A ride without `rideType` is the carousel.
 */
export const FLAT_RIDE_TYPES = ['chainSwing', 'freefall', 'ferrisWheel', 'bumperCars', 'swingShip'] as const
export type FlatRideType = (typeof FLAT_RIDE_TYPES)[number]
export type RideType = 'bungee' | FlatRideType

export const FLAT_RIDES: Record<FlatRideType, { name: string; icon: string; thought: string }> = {
  chainSwing: { name: de('Kettenkarussell'), icon: '🌀', thought: de('Das Kettenkarussell hat mich richtig durchgeschwungen!') },
  freefall: { name: de('Freefall-Turm'), icon: '🗼', thought: de('Freier Fall – mein Magen ist noch oben!') },
  ferrisWheel: { name: de('Riesenrad'), icon: '🎡', thought: de('Vom Riesenrad aus sieht man das ganze Festival!') },
  bumperCars: { name: de('Autoscooter'), icon: '🚗', thought: de('Autoscooter! Ich habe alle gerammt.') },
  swingShip: { name: de('Schiffschaukel'), icon: '⛵', thought: de('Die Schiffschaukel war wild!') },
}

export function isFlatRideType(value: unknown): value is FlatRideType {
  return typeof value === 'string' && (FLAT_RIDE_TYPES as readonly string[]).includes(value)
}

export type RideProfile = {
  name: string
  icon: string
  cost: number
  upkeep: number
  capacity: number
  /** Minutes one ride takes for a guest. */
  minutes: number
  funGain: number
  energyCost: number
  /** Ride intensity for incidents.addRideNausea. */
  nausea: number
  defaultPrice: number
  thought: string
}

/** Everything a ride's type decides, for the carousel, the bungee tower and each flat ride. */
export function rideProfile(ride: { rideType?: RideType; bungeeHeight?: number }): RideProfile {
  const base = BUILDINGS.ride
  const carousel: RideProfile = {
    name: base.name,
    icon: base.icon,
    cost: base.cost,
    upkeep: base.upkeep,
    capacity: base.capacity,
    minutes: SIMULATION_CONFIG.needs.interactionMinutes.ride,
    funGain: SIMULATION_CONFIG.needs.ride.funGain,
    energyCost: SIMULATION_CONFIG.needs.ride.energyCost,
    nausea: SIMULATION_CONFIG.nausea.carouselIntensity,
    defaultPrice: base.defaultPrice,
    thought: de('Das Karussell war großartig!'),
  }
  if (ride.rideType === 'bungee') {
    return {
      ...carousel,
      name: de('Bungee-Turm'),
      icon: '🪂',
      cost: base.cost + (ride.bungeeHeight ?? 20) * 25,
      capacity: 1,
      thought: de('Was für ein Bungeesprung!'),
    }
  }
  if (!isFlatRideType(ride.rideType)) return carousel
  const config = SIMULATION_CONFIG.rides[ride.rideType]
  const info = FLAT_RIDES[ride.rideType]
  return {
    name: info.name,
    icon: info.icon,
    cost: config.cost,
    upkeep: config.upkeep,
    capacity: config.capacity,
    minutes: config.minutes,
    funGain: config.funGain,
    energyCost: config.energyCost,
    nausea: config.nausea,
    defaultPrice: config.defaultPrice,
    thought: info.thought,
  }
}
