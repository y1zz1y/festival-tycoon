/**
 * The player's effect density as a share: how many firework sparks, laser beams and
 * sound rings are drawn. Purely visual, a device setting; the simulation never reads it.
 */
let share = 1

export function setEffectShare(value: number): void {
  share = Math.min(1, Math.max(0.1, value))
}

export function effectShare(): number {
  return share
}

/** How many of `total` items to draw at the current density, at least `minimum`. */
export function effectCount(total: number, minimum = 1): number {
  return Math.min(total, Math.max(minimum, Math.round(total * share)))
}
