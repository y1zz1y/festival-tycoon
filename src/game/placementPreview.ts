import { MAX_PATH_ELEVATION, WAY_ELEVATION_STEP, snapWayElevation } from './wayElevation'

/** Buildings, scenery and coaster start height share the way half-step. */
export const BUILD_ELEVATION_STEP = WAY_ELEVATION_STEP

/** Absolute displacement avoids event-rate dependent accumulation and stale cursor jumps. */
export function draggedBuildElevation(startHeight: number, startY: number, currentY: number): number {
  return snapBuildElevation(startHeight + Math.trunc((startY - currentY) / 48) * BUILD_ELEVATION_STEP)
}

export function buildElevationAbove(top: number, terrain: number): number {
  return snapBuildElevation(Math.ceil((top - terrain - 1e-6) / BUILD_ELEVATION_STEP) * BUILD_ELEVATION_STEP)
}

export type PlacementGroundCell = {
  x: number
  z: number
  y: number
}

/** Clamp and snap placement height to 0.5 (0–6). Integer-only UI used to `Math.round`. */
export function snapBuildElevation(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(MAX_PATH_ELEVATION, snapWayElevation(value)))
}

export function stepBuildElevation(current: number, delta: number): number {
  if (!Number.isFinite(delta) || delta === 0) return snapBuildElevation(current)
  return snapBuildElevation(current + Math.sign(delta) * BUILD_ELEVATION_STEP)
}

/**
 * Bodenkachel under the cursor. `y` is terrain only — never raised by
 * `buildElevation`, so the floor marker stays on the ground when the ghost is up.
 */
export function placementGroundCell(
  cell: { x: number; z: number } | null | undefined,
  terrainHeight: number,
): PlacementGroundCell | null {
  if (!cell) return null
  const y = Number.isFinite(terrainHeight) ? terrainHeight : 0
  return { x: cell.x, z: cell.z, y }
}

export function placementPreviewHeights(
  terrainHeight: number,
  buildElevation: number,
): { groundY: number; placementY: number } {
  const groundY = Number.isFinite(terrainHeight) ? terrainHeight : 0
  return {
    groundY,
    placementY: groundY + snapBuildElevation(buildElevation),
  }
}

/** Inspect and walk mode skip the floor outline; demolish still shows it. */
export function showsPlacementGroundMarker(
  tool?: string | null,
  walkMode = false,
): boolean {
  if (walkMode || tool == null || tool === 'inspect') return false
  return true
}
