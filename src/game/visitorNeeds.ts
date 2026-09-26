import { hashStringSeed } from './rng'
import { SIMULATION_CONFIG } from './simulationConfig'
import type { Visitor, VisitorNeeds } from './types/entities'

/**
 * Thirst and hygiene, the two needs added after hunger, toilet, fun and energy.
 * Hygiene only matters for campers: a day guest showers at home, so their hygiene
 * neither drops nor counts toward mood and satisfaction.
 */
export function isCamper(visitor: Pick<Visitor, 'ticketType' | 'campingPhase'>): boolean {
  return visitor.ticketType === 'camping' && visitor.campingPhase !== 'none'
}

/** The needs that make up a visitor's mood: hygiene only for campers. */
export function moodNeedValues(visitor: Pick<Visitor, 'needs' | 'ticketType' | 'campingPhase'>): number[] {
  const needs = visitor.needs
  const values = [needs.hunger, needs.toilet, needs.fun, needs.energy, needs.thirst ?? 100]
  if (isCamper(visitor)) values.push(needs.hygiene ?? 100)
  return values
}

export function moodNeedAverage(visitor: Pick<Visitor, 'needs' | 'ticketType' | 'campingPhase'>): number {
  const values = moodNeedValues(visitor)
  return values.reduce((total, value) => total + value, 0) / values.length
}

/** Start values without a random draw: spawning keeps its random sequence unchanged. */
export function initialThirstAndHygiene(id: string): Pick<VisitorNeeds, 'thirst' | 'hygiene'> {
  const config = SIMULATION_CONFIG.visitors.initialNeeds
  const seed = hashStringSeed(`${id}:needs`)
  return {
    thirst: config.thirstMinimum + ((seed % 1000) / 1000) * config.thirstRandomRange,
    hygiene: config.hygieneMinimum + ((Math.floor(seed / 1000) % 1000) / 1000) * config.hygieneRandomRange,
  }
}

/** Old saves and remote visitors: fill the two needs if they are missing. */
export function ensureThirstAndHygiene(needs: Partial<VisitorNeeds>): void {
  needs.thirst ??= 80
  needs.hygiene ??= 100
}
