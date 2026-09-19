import type { GameSnapshot } from './GameState'
import { isWasteBin } from './decorationWalls'

export function isPathSeat(kind: string | undefined): boolean {
  return kind === 'bench' || kind === 'table'
}

/** Find an outside path or road edge at the actual placement layer, keeping benches and bins apart. */
export function pathFurnitureRotation(
  snapshot: Readonly<GameSnapshot>,
  x: number,
  z: number,
  elevation: number,
  preferredRotation?: number,
): number | null {
  const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const
  const rotations = preferredRotation === undefined
    ? [0, 1, 2, 3]
    : [preferredRotation, ...[0, 1, 2, 3].filter(rotation => rotation !== preferredRotation)]
  for (const rotation of rotations) {
    const [dx, dz] = directions[rotation]!
    if (snapshot.buildings.some(b => b.x === x && b.z === z && Math.abs(b.elevation - elevation) < .1 &&
      (b.kind === 'bench' || b.kind === 'table' || isWasteBin(b.kind)) && b.rotation === rotation)) continue
    if (snapshot.buildings.some(b => b.x === x + dx && b.z === z + dz && Math.abs(b.elevation - elevation) < .1)) continue
    if (snapshot.logistics.roadCells.some(road => road.x === x + dx && road.z === z + dz && Math.abs((road.elevation ?? elevation) - elevation) < .1)) continue
    if ([...snapshot.campingCells, ...snapshot.medicalCells, ...snapshot.stageForecourtCells].some(c => c.x === x + dx && c.z === z + dz)) continue
    return rotation
  }
  return null
}
