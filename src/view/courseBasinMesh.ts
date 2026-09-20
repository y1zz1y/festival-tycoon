import type { ModelKit } from './retroBuildings'

export type BasinCell = {
  x: number
  z: number
  elevation: number
}

export type BasinRect = {
  x: number
  z: number
  w: number
  d: number
  elevation: number
}

/** Orthogonal neighbor bits: set when another basin of the same attraction shares that edge. */
export const BASIN_NEIGHBOR = {
  posX: 1,
  negX: 2,
  posZ: 4,
  negZ: 8,
} as const

export type BasinEdge = keyof typeof BASIN_NEIGHBOR

const RIM_OFFSET = 0.45
const RIM_THICKNESS = 0.055
const RIM_HEIGHT = 0.26
const RIM_Y = 0.16
const RIM_LENGTH = 1
const RIM_COLOR = 0xf0ede6

export function basinKey(cell: BasinCell): string {
  return `${cell.x}:${cell.z}:${cell.elevation}`
}

export function indexBasinCells(cells: readonly BasinCell[]): Set<string> {
  return new Set(cells.map(basinKey))
}

export function basinNeighborMask(cell: BasinCell, index: Set<string>): number {
  let mask = 0
  if (index.has(basinKey({ x: cell.x + 1, z: cell.z, elevation: cell.elevation }))) {
    mask |= BASIN_NEIGHBOR.posX
  }
  if (index.has(basinKey({ x: cell.x - 1, z: cell.z, elevation: cell.elevation }))) {
    mask |= BASIN_NEIGHBOR.negX
  }
  if (index.has(basinKey({ x: cell.x, z: cell.z + 1, elevation: cell.elevation }))) {
    mask |= BASIN_NEIGHBOR.posZ
  }
  if (index.has(basinKey({ x: cell.x, z: cell.z - 1, elevation: cell.elevation }))) {
    mask |= BASIN_NEIGHBOR.negZ
  }
  return mask
}

export function basinOuterEdges(mask: number): BasinEdge[] {
  return (Object.keys(BASIN_NEIGHBOR) as BasinEdge[]).filter(
    (edge) => (mask & BASIN_NEIGHBOR[edge]) === 0,
  )
}

export function collectCourseBasinCells(course: {
  pieces: readonly {
    kind: string
    x: number
    z: number
    elevation: number
    endX?: number
    endZ?: number
    endElevation?: number
  }[]
}): BasinCell[] {
  const cells: BasinCell[] = []
  const seen = new Set<string>()
  for (const piece of course.pieces) {
    if (piece.kind !== 'poolBasin') continue
    const cell = {
      x: piece.endX ?? piece.x,
      z: piece.endZ ?? piece.z,
      elevation: piece.endElevation ?? piece.elevation,
    }
    const key = basinKey(cell)
    if (seen.has(key)) continue
    seen.add(key)
    cells.push(cell)
  }
  return cells
}

/** Merge same-elevation orthogonal basins into rectangles for a seamless water plane. */
export function greedyBasinRects(cells: readonly BasinCell[]): BasinRect[] {
  const byElevation = new Map<number, BasinCell[]>()
  for (const cell of cells) {
    const group = byElevation.get(cell.elevation)
    if (group) group.push(cell)
    else byElevation.set(cell.elevation, [cell])
  }
  const rects: BasinRect[] = []
  for (const [elevation, group] of byElevation) {
    rects.push(...greedyRectsAtElevation(group, elevation))
  }
  return rects
}

export function addBasinRims(kit: ModelKit, cells: readonly BasinCell[]): number {
  const index = indexBasinCells(cells)
  let count = 0
  for (const cell of cells) {
    const mask = basinNeighborMask(cell, index)
    const x = cell.x + 0.5
    const z = cell.z + 0.5
    const y = cell.elevation + RIM_Y
    if ((mask & BASIN_NEIGHBOR.posX) === 0) {
      kit.box(x + RIM_OFFSET, y, z, RIM_THICKNESS, RIM_HEIGHT, RIM_LENGTH, RIM_COLOR)
      count += 1
    }
    if ((mask & BASIN_NEIGHBOR.negX) === 0) {
      kit.box(x - RIM_OFFSET, y, z, RIM_THICKNESS, RIM_HEIGHT, RIM_LENGTH, RIM_COLOR)
      count += 1
    }
    if ((mask & BASIN_NEIGHBOR.posZ) === 0) {
      kit.box(x, y, z + RIM_OFFSET, RIM_LENGTH, RIM_HEIGHT, RIM_THICKNESS, RIM_COLOR)
      count += 1
    }
    if ((mask & BASIN_NEIGHBOR.negZ) === 0) {
      kit.box(x, y, z - RIM_OFFSET, RIM_LENGTH, RIM_HEIGHT, RIM_THICKNESS, RIM_COLOR)
      count += 1
    }
  }
  return count
}

function greedyRectsAtElevation(cells: readonly BasinCell[], elevation: number): BasinRect[] {
  const occupied = new Set(cells.map((cell) => `${cell.x}:${cell.z}`))
  const used = new Set<string>()
  const ordered = [...cells].sort((a, b) => a.z - b.z || a.x - b.x)
  const rects: BasinRect[] = []
  for (const start of ordered) {
    const startKey = `${start.x}:${start.z}`
    if (used.has(startKey)) continue
    let width = 1
    while (
      occupied.has(`${start.x + width}:${start.z}`) &&
      !used.has(`${start.x + width}:${start.z}`)
    ) {
      width += 1
    }
    let depth = 1
    grow: for (;;) {
      for (let dx = 0; dx < width; dx += 1) {
        const key = `${start.x + dx}:${start.z + depth}`
        if (!occupied.has(key) || used.has(key)) break grow
      }
      depth += 1
    }
    for (let dz = 0; dz < depth; dz += 1) {
      for (let dx = 0; dx < width; dx += 1) {
        used.add(`${start.x + dx}:${start.z + dz}`)
      }
    }
    rects.push({ x: start.x, z: start.z, w: width, d: depth, elevation })
  }
  return rects
}
