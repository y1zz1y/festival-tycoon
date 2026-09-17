import { occupiesBuildingCell } from './stageDesign'
import { isScenery } from './scenery'
import { isFacade, roofSpec, wallSpec } from './decorationWalls'

export const SUPPORT_MIN_GAP = 0.15

export type SupportSpan = {
  bottom: number
  top: number
}

export type SupportSolidSource = {
  id: string
  kind: string
  x: number
  z: number
  elevation: number
  rotation?: number
  decorationSlot?: number
  pathType?: string
  stageDesign?: { width: number; depth: number; name?: string }
}

/** Gap under an object. Land (including lake bed) is never treated as water-solid. */
export function supportGap(
  objectY: number,
  landY: number,
  solids: readonly SupportSpan[] = [],
): SupportSpan | null {
  let bottom = landY
  for (const solid of solids) {
    if (solid.top + 1e-6 >= objectY && solid.bottom < objectY + 1e-6) return null
    if (solid.top > bottom && solid.bottom < objectY) bottom = Math.max(bottom, solid.top)
  }
  if (objectY - bottom < SUPPORT_MIN_GAP) return null
  return { bottom, top: objectY }
}

export function supportSolidHeight(kind: string): number {
  const wall = wallSpec(kind)
  if (wall) return wall.height
  if (roofSpec(kind)) return 0.5
  if (kind === 'path') return 0.16
  if (kind === 'fence') return 0.7
  if (isScenery(kind)) return 0.55
  return 0.95
}

export function tileSupportSolids(
  buildings: readonly SupportSolidSource[],
  x: number,
  z: number,
  excludeId?: string,
  roads: ReadonlyArray<{ x: number; z: number; elevation?: number }> = [],
): SupportSpan[] {
  const spans: SupportSpan[] = []
  for (const building of buildings) {
    if (building.id === excludeId) continue
    if (
      !occupiesBuildingCell(
        building as Parameters<typeof occupiesBuildingCell>[0],
        x,
        z,
      )
    ) continue
    const height = supportSolidHeight(building.kind)
    if (building.kind === 'path') {
      spans.push({
        bottom: building.elevation - 0.08,
        top: building.elevation + height,
      })
      continue
    }
    spans.push({
      bottom: building.elevation,
      top: building.elevation + height,
    })
  }
  for (const road of roads) {
    if (road.x !== x || road.z !== z) continue
    const elevation = road.elevation ?? 0
    spans.push({ bottom: elevation - 0.08, top: elevation + 0.16 })
  }
  return spans
}

export function countSupportPosts(
  objectY: number,
  landSamples: readonly number[],
  solids: readonly SupportSpan[] = [],
): number {
  return landSamples.reduce(
    (count, landY) => count + (supportGap(objectY, landY, solids) ? 1 : 0),
    0,
  )
}

export function isSupportlessKind(kind: string): boolean {
  return isFacade(kind) || kind === 'path'
}
