import { hashStringSeed } from './rng'
import { SIMULATION_CONFIG } from './simulationConfig'
import type { FestivalManagement } from './festivalManagement'
import type { Visitor } from './types/entities'

/**
 * Storms (Unwetter): planned when an edition starts, for its festival days, from the
 * festival seed alone, so every client and every reload sees the same storms and no
 * random number is drawn from the simulation's stream. A storm is announced
 * `warningMinutes` ahead, pauses the shows while it lasts, wears down and endangers
 * guests out in the open and, without the Sturmsicherung, can set a tall structure on
 * fire. The player can order shelter: shows stop at once, exposure drops sharply.
 */
export type StormPlan = { day: number; start: number; end: number }
export type StormPhase = 'none' | 'warning' | 'active'

const CONFIG = SIMULATION_CONFIG.storm

export function planStorms(seed: number, firstDay: number, days: number, chanceFactor = 1): StormPlan[] {
  const storms: StormPlan[] = []
  for (let day = firstDay; day < firstDay + days; day++) {
    const roll = hashStringSeed(`${seed}:storm:${day}`)
    if ((roll % 1000) / 1000 >= CONFIG.chancePerDay * chanceFactor) continue
    const start = (CONFIG.earliestHour + (Math.floor(roll / 1000) % (CONFIG.latestHour - CONFIG.earliestHour + 1))) * 60
    const duration = CONFIG.minimumMinutes + (Math.floor(roll / 97) % 4) * CONFIG.durationStepMinutes
    storms.push({ day, start, end: start + duration })
  }
  return storms
}

/** The storm that matters now: the one raging, or the next one inside its warning time. */
export function stormAt(
  festival: Partial<Pick<FestivalManagement, 'storms' | 'enabled' | 'finished'>>,
  day: number,
  minute: number,
): { phase: StormPhase; storm?: StormPlan } {
  if (!festival.enabled || festival.finished) return { phase: 'none' }
  const now = day * 1440 + minute
  for (const storm of festival.storms ?? []) {
    const start = storm.day * 1440 + storm.start
    const end = storm.day * 1440 + storm.end
    if (now >= start && now < end) return { phase: 'active', storm }
    if (now >= start - CONFIG.warningMinutes && now < start) return { phase: 'warning', storm }
  }
  return { phase: 'none' }
}

/** How much of a storm reaches this guest: none in a tent, in a vehicle or on the way out. */
export function stormExposure(visitor: Pick<Visitor, 'state' | 'campingPhase'>, shelterOrdered: boolean): number {
  if (visitor.state === 'camping' && visitor.campingPhase === 'resting') return 0
  if (['leaving', 'exiting', 'riding', 'bus-riding', 'vehicle-arrival', 'medical', 'medical-transport', 'injured', 'sleeping'].includes(visitor.state)) return 0
  return shelterOrdered ? 1 - CONFIG.shelterOrderProtection : 1
}

/** When lightning strikes during a storm, in minutes after its start. */
export function lightningMinutes(storm: StormPlan): number[] {
  return CONFIG.lightningAfterMinutes.filter((after) => storm.start + after < storm.end)
}

export function clockText(minute: number): string {
  return `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}
