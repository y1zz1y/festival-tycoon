/**
 * Road markings from the derived lane layout (src/game/roadLanes.ts). Pure data: every
 * mark is given in tile-local coordinates (origin at the tile centre, world-oriented),
 * and src/view/wayStructures.ts merges it into the tile's cached structure geometry.
 * Computed on the static rebuild only, never per frame.
 */
import type { Direction, RoadCell } from '../game/logistics'
import type { LaneAxis, LaneRole, RoadLaneLayout } from '../game/roadLanes'
import type { WayType } from '../game/wayTypes'

/** Painted lines on asphalt, a lighter joint between road plates, nothing on gravel or dirt. */
export type WayPaint = 'line' | 'joint' | 'none'

/** A flat painted strip from (x0,z0) to (x1,z1), `width` across. */
export type WayStrip = readonly [x0: number, z0: number, x1: number, z1: number, width: number]

export type WayMarks = {
  paint: WayPaint
  strips: WayStrip[]
  /** Kerb pieces of a rounded corner, [x0,z0,x1,z1]. */
  kerbs: (readonly [number, number, number, number])[]
  /** Grass wedge polygons inside a rounded corner, [[x,z], ...]. */
  grass: (readonly (readonly [number, number])[])[]
  /** World sides whose straight kerb the rounded corner replaces (bit per direction). */
  hideKerbs: number
}

const CENTRE_WIDTH = 0.05
const EDGE_WIDTH = 0.03
const EDGE_INSET = 0.08
const DOUBLE_GAP = 0.045
const DASH = 0.2
const ARC_STEPS = 8
const KERB_STEPS = 12

export function wayPaintFor(surface: WayType | undefined): WayPaint {
  if (!surface || surface === 'roadAsphalt') return 'line'
  return surface === 'roadPlates' ? 'joint' : 'none'
}

/** Axis the traffic runs along, for zebra stripes across the lanes; null where it is free. */
export function roadTrafficAxis(layout: RoadLaneLayout, cell: RoadCell): LaneAxis | null {
  const role = layout.roleOf(cell)
  if (!role) return null
  if (role.kind === 'lane' || role.kind === 'single') return role.axis
  if (role.kind === 'entry') return 'z'
  return null
}

/** Lane arrow for the build helpers: the derived driving direction, when it is fixed. */
export function laneArrowDirection(layout: RoadLaneLayout, cell: RoadCell): Direction | null {
  if (cell.allowedDirections !== null) return null
  const role = layout.roleOf(cell)
  if (role?.kind === 'lane') return role.direction
  if (role?.kind === 'entry' && !role.open) return role.direction
  return null
}

export function roadWayMarks(layout: RoadLaneLayout, cell: RoadCell, paint: WayPaint): WayMarks | undefined {
  const role = layout.roleOf(cell)
  if (!role) return undefined
  const marks: WayMarks = { paint, strips: [], kerbs: [], grass: [], hideKerbs: 0 }
  if (role.kind === 'lane') laneMarks(layout, cell, role, marks)
  // An open stub or player one-ways on it: vehicles cross freely, so no lines.
  else if (role.kind === 'entry' && !role.open && !stubHasOneWays(layout, cell)) entryMarks(cell, marks)
  else if (role.kind === 'knot') cornerMarks(cell, role, marks)
  if (paint === 'none') marks.strips = []
  if (!marks.strips.length && !marks.kerbs.length && !marks.grass.length) return undefined
  return marks
}

/** A strip lying on (offset 0) or just inside a tile side, between t0 and t1 along it. */
function sideStrip(side: Direction, offset: number, t0: number, t1: number, width: number): WayStrip {
  const edge = 0.5 - offset
  if (side === 0) return [t0, edge, t1, edge, width]
  if (side === 2) return [t0, -edge, t1, -edge, width]
  if (side === 1) return [edge, t0, edge, t1, width]
  return [-edge, t0, -edge, t1, width]
}

function laneMarks(
  layout: RoadLaneLayout,
  cell: RoadCell,
  role: Extract<LaneRole, { kind: 'lane' }>,
  marks: WayMarks,
): void {
  // A zebra crossing carries no lines of its own.
  if (cell.crosswalk) return
  const outer = ((role.partner + 2) % 4) as Direction
  if (marks.paint === 'line') marks.strips.push(sideStrip(outer, EDGE_INSET, -0.5, 0.5, EDGE_WIDTH))
  // One tile of the pair draws the shared centre line: the +Z/+X-bound one.
  if (role.direction !== 0 && role.direction !== 1) return
  const ahead = role.axis === 'z' ? [0, 2] : [1, 3]
  const solid = marks.paint === 'joint' || ahead.some((direction) =>
    layout.linksOf(cell, direction as Direction).some((next) => layout.roleOf(next)?.kind !== 'lane'))
  marks.strips.push(solid
    ? sideStrip(role.partner, 0, -0.5, 0.5, CENTRE_WIDTH)
    : sideStrip(role.partner, 0, -DASH, DASH, CENTRE_WIDTH))
}

/** The stub line runs on the tile's west edge; one-ways on either side free the crossing. */
function stubHasOneWays(layout: RoadLaneLayout, cell: RoadCell): boolean {
  return cell.allowedDirections !== null ||
    layout.linksOf(cell, 3).some((west) => west.allowedDirections !== null)
}

/** Entry stub: double solid line between x −1 and 0, dashed dividers between same-way lanes. */
function entryMarks(cell: RoadCell, marks: WayMarks): void {
  if (cell.x === 0) {
    marks.strips.push(sideStrip(3, DOUBLE_GAP, -0.5, 0.5, EDGE_WIDTH), sideStrip(3, -DOUBLE_GAP, -0.5, 0.5, EDGE_WIDTH))
  } else if (cell.x !== -3) {
    marks.strips.push(sideStrip(3, 0, -DASH, DASH, EDGE_WIDTH))
  }
}

/**
 * Corner block (2×2 knot with two perpendicular exits): the centre line bends as a
 * quarter circle of radius 1 around the inner corner, the outer kerb as one of radius
 * 2 with a grass wedge in the outer corner.
 */
function cornerMarks(cell: RoadCell, role: Extract<LaneRole, { kind: 'knot' }>, marks: WayMarks): void {
  const { block, exitMask } = role
  if (role.tiles.length !== 4 || block.maxX - block.minX !== 1 || block.maxZ - block.minZ !== 1) return
  if (role.exits !== 2 || exitMask === 0b0101 || exitMask === 0b1010) return
  if ((cell.roadSlope ?? 0) !== 0) return
  const innerX = exitMask & 0b0010 ? block.maxX + 1 : block.minX
  const innerZ = exitMask & 0b0001 ? block.maxZ + 1 : block.minZ
  const sx = innerX === block.minX ? 1 : -1
  const sz = innerZ === block.minZ ? 1 : -1
  const ox = cell.x + 0.5, oz = cell.z + 0.5
  const point = (radius: number, angle: number): [number, number] =>
    [round(innerX + sx * radius * Math.cos(angle) - ox), round(innerZ + sz * radius * Math.sin(angle) - oz)]
  const inside = (x: number, z: number) => Math.abs(x) <= 0.5 && Math.abs(z) <= 0.5
  const innerTileX = innerX === block.minX ? block.minX : block.maxX
  const innerTileZ = innerZ === block.minZ ? block.minZ : block.maxZ
  if (cell.x === innerTileX && cell.z === innerTileZ) {
    for (let step = 0; step < ARC_STEPS; step += 1) {
      const [x0, z0] = point(1, (step / ARC_STEPS) * Math.PI / 2)
      const [x1, z1] = point(1, ((step + 1) / ARC_STEPS) * Math.PI / 2)
      if (marks.paint !== 'none') marks.strips.push([x0, z0, x1, z1, CENTRE_WIDTH])
    }
    return
  }
  const outerCorner: [number, number] = [round(innerX + 2 * sx - ox), round(innerZ + 2 * sz - oz)]
  const arc: [number, number][] = []
  for (let step = 0; step <= KERB_STEPS; step += 1) arc.push(point(2, (step / KERB_STEPS) * Math.PI / 2))
  for (let step = 0; step < KERB_STEPS; step += 1) {
    const [x0, z0] = arc[step]!, [x1, z1] = arc[step + 1]!
    if (inside((x0 + x1) / 2, (z0 + z1) / 2)) marks.kerbs.push([x0, z0, x1, z1])
  }
  const wedge = clipToTile([outerCorner, ...arc])
  if (wedge.length >= 3) marks.grass.push(wedge)
  // The outer boundary lies towards (sx, sz): its straight kerbs give way to the curve.
  if (cell.x !== innerTileX) marks.hideKerbs |= 1 << (sx > 0 ? 1 : 3)
  if (cell.z !== innerTileZ) marks.hideKerbs |= 1 << (sz > 0 ? 0 : 2)
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** Sutherland–Hodgman against the tile square [-0.5, 0.5]². */
function clipToTile(polygon: readonly (readonly [number, number])[]): [number, number][] {
  let points = polygon.map(([x, z]) => [x, z] as [number, number])
  const planes: [axis: 0 | 1, limit: number, keepBelow: boolean][] = [[0, 0.5, true], [0, -0.5, false], [1, 0.5, true], [1, -0.5, false]]
  for (const [axis, limit, keepBelow] of planes) {
    const kept: [number, number][] = []
    const inside = (p: [number, number]) => (keepBelow ? p[axis] <= limit + 1e-9 : p[axis] >= limit - 1e-9)
    for (let i = 0; i < points.length; i += 1) {
      const current = points[i]!, previous = points[(i + points.length - 1) % points.length]!
      if (inside(current)) {
        if (!inside(previous)) kept.push(intersect(previous, current, axis, limit))
        kept.push(current)
      } else if (inside(previous)) {
        kept.push(intersect(previous, current, axis, limit))
      }
    }
    points = kept
    if (!points.length) break
  }
  return points.map(([x, z]) => [round(x), round(z)])
}

function intersect(a: [number, number], b: [number, number], axis: 0 | 1, limit: number): [number, number] {
  const t = (limit - a[axis]) / (b[axis] - a[axis])
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}
