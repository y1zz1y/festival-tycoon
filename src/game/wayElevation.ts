/** Shared height rules for footpath and road ramps. */

export const WAY_ELEVATION_STEP = 0.5
export const MAX_PATH_ELEVATION = 6
/** Cars may climb this far above local terrain (two half-steps on flat ground). */
export const MAX_ROAD_RAISE = 1
export const WAY_ELEVATION_EPSILON = 1e-3
/** Match integer terrain without treating a 0.5 ramp as ground level. */
export const WAY_LEVEL_MATCH = 0.2

export function snapWayElevation(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value / WAY_ELEVATION_STEP) * WAY_ELEVATION_STEP
}

export function packWayElevation(elevation: number): number {
  return Math.round(snapWayElevation(elevation) / WAY_ELEVATION_STEP)
}

export function elevationsMatch(a: number, b: number, epsilon = WAY_ELEVATION_EPSILON): boolean {
  return Math.abs(a - b) <= epsilon
}

/** True when a path deck and a car-road deck share the same grade (crossing, not a bridge). */
export function wayOverlapsRoadGrade(
  pathElevation: number,
  pathSlope: number,
  roadElevation: number,
): boolean {
  const start = pathElevation - pathSlope
  const lo = Math.min(pathElevation, start)
  const hi = Math.max(pathElevation, start)
  return lo - WAY_LEVEL_MATCH <= roadElevation && roadElevation <= hi + WAY_LEVEL_MATCH
}

export function waySurfaceY(endElevation: number, slope = 0): number {
  return endElevation - slope / 2
}

export function canTraverseWayElevation(
  fromElevation: number,
  fromSlope: number,
  fromSlopeDirection: number | undefined,
  toElevation: number,
  toSlope: number,
  toSlopeDirection: number | undefined,
  direction: number,
): boolean {
  const elevationDelta = toElevation - fromElevation
  if (Math.abs(elevationDelta) <= WAY_ELEVATION_EPSILON) return true
  const enters =
    Math.abs(toSlope - elevationDelta) <= WAY_ELEVATION_EPSILON &&
    toSlopeDirection === direction
  const leaves =
    Math.abs(fromSlope + elevationDelta) <= WAY_ELEVATION_EPSILON &&
    fromSlopeDirection === (direction + 2) % 4
  return Boolean(enters || leaves)
}

export function maxRoadElevation(terrainHeight: number): number {
  return terrainHeight + MAX_ROAD_RAISE
}

export const WAY_CARDINALS = [
  { x: 0, z: 1 },
  { x: 1, z: 0 },
  { x: 0, z: -1 },
  { x: -1, z: 0 },
] as const

export type WayElevationAnchor = { x: number; z: number; elevation: number }

export type LockedOriginRampStep = {
  x: number
  z: number
  elevation: number
  slope: number
  direction: number
}

/** Keep the first Shift origin; later hover/click candidates must not rebase it. */
export function lockShiftElevationOrigin<T>(
  locked: T | null,
  candidate: T | null,
): T | null {
  return locked ?? candidate
}

/** Dominant cardinal from origin toward the pointer (diagonal drags snap to the longer axis). */
export function cardinalToward(
  from: { x: number; z: number },
  to: { x: number; z: number },
): number | null {
  const dx = to.x - from.x
  const dz = to.z - from.z
  if (dx === 0 && dz === 0) return null
  if (Math.abs(dx) >= Math.abs(dz) && dx !== 0) return dx > 0 ? 1 : 3
  return dz > 0 ? 0 : 2
}

/**
 * Ramp cells from a fixed origin toward the hover cell. The origin is copied
 * unchanged and is never included in `steps`.
 */
export function planLockedOriginRamp(
  origin: WayElevationAnchor,
  target: { x: number; z: number },
  slope: number,
): {
  origin: WayElevationAnchor
  direction: number | null
  steps: LockedOriginRampStep[]
} {
  const locked: WayElevationAnchor = {
    x: origin.x,
    z: origin.z,
    elevation: snapWayElevation(origin.elevation),
  }
  const steppedSlope = Math.max(
    -WAY_ELEVATION_STEP,
    Math.min(WAY_ELEVATION_STEP, snapWayElevation(slope)),
  )
  const direction = cardinalToward(locked, target)
  if (direction == null) {
    return { origin: locked, direction: null, steps: [] }
  }
  const offset = WAY_CARDINALS[direction]
  if (!offset) {
    return { origin: locked, direction: null, steps: [] }
  }
  const axisSteps =
    direction === 1 || direction === 3
      ? Math.abs(target.x - locked.x)
      : Math.abs(target.z - locked.z)
  const steps: LockedOriginRampStep[] = []
  for (let i = 1; i <= axisSteps; i += 1) {
    steps.push({
      x: locked.x + offset.x * i,
      z: locked.z + offset.z * i,
      elevation: snapWayElevation(locked.elevation + steppedSlope * i),
      slope: steppedSlope,
      direction,
    })
  }
  return { origin: locked, direction, steps }
}
