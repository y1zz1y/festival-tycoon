import { BufferGeometry, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { ModelKit } from './retroBuildings'
import { canTraverseWayElevation, WAY_CARDINALS } from '../game/wayElevation'
import type { WayMarks, WayStrip } from './roadMarkings'

export type WayStructureCell = { x: number; z: number; elevation: number; slope: number; direction: number; road: boolean; marks?: WayMarks }
export function indexWayStructures(cells: readonly WayStructureCell[]): Map<string, WayStructureCell[]> {
  const index = new Map<string, WayStructureCell[]>()
  for (const cell of cells) { const key = `${cell.x},${cell.z}`; const list = index.get(key) ?? []; list.push(cell); index.set(key, list) }
  return index
}
export function wayStructurePlan(
  cell: WayStructureCell,
  index: Map<string, WayStructureCell[]>,
  ground: number,
  extras?: { landAt?: (x: number, z: number) => number; solidTop?: number },
) {
  const direction = cell.slope ? cell.direction : 0
  const connected = WAY_CARDINALS.map((d, side) => (index.get(`${cell.x + d.x},${cell.z + d.z}`) ?? []).some(other =>
    other.road === cell.road && canTraverseWayElevation(cell.elevation, cell.slope, cell.direction, other.elevation, other.slope, other.direction, side)))
  const hidden = cell.marks?.hideKerbs ?? 0
  const edges = [0, 1, 2, 3].filter(local => !connected[(local + direction) % 4] && !(hidden & (1 << ((local + direction) % 4))))
  const raised = Math.max(cell.elevation, cell.elevation - cell.slope) - ground > .2
  const supports: { x: number; z: number; bottom: number; top: number }[] = []
  const layers = index.get(`${cell.x},${cell.z}`) ?? []
  if (raised) for (const x of [-.41, .41]) for (const z of [-.32, .32]) {
    const top = -cell.slope / 2 + z * cell.slope - .065
    const land = extras?.landAt?.(x, z) ?? ground
    const filled = Math.max(land, extras?.solidTop ?? land)
    const bottom = filled - cell.elevation
    // Leave lower routes clear: the span is carried by the neighboring bridge cells.
    const obstructed = layers.some(other => other !== cell &&
      Math.min(other.elevation, other.elevation - other.slope) < cell.elevation + top &&
      Math.max(other.elevation, other.elevation - other.slope) >= filled - .1)
    if (top - bottom > .15 && !obstructed) supports.push({ x, z, bottom, top })
  }
  return { edges, raised, supports, marks: localMarks(cell.marks, direction) }
}

/** Marks come world-oriented; a ramp tile is drawn turned by its slope direction. */
function localMarks(marks: WayMarks | undefined, direction: number) {
  if (!marks) return undefined
  const turn = (x: number, z: number): [number, number] => {
    // Inverse of the tile's rotation by `direction` quarter turns about Y.
    let lx = x, lz = z
    for (let n = 0; n < direction; n += 1) [lx, lz] = [-lz, lx]
    return [Math.round(lx * 1000) / 1000 || 0, Math.round(lz * 1000) / 1000 || 0]
  }
  const strips = marks.strips.map(([x0, z0, x1, z1, width]): WayStrip => [...turn(x0, z0), ...turn(x1, z1), width])
  return {
    paint: marks.paint,
    strips,
    kerbs: marks.kerbs.map(([x0, z0, x1, z1]) => [...turn(x0, z0), ...turn(x1, z1)]),
    grass: marks.grass.map((polygon) => polygon.map(([x, z]) => turn(x, z))),
  }
}
const geometries = new Map<string, BufferGeometry>()
const material = new MeshStandardMaterial({ vertexColors: true, roughness: .8 })
material.userData.shared = true
const PAINT = { line: 0xeee9d7, joint: 0x9aa19e, none: 0 } as const
const KERB = 0xa6aaa4
const GRASS = 0x6b8f4a

const METAL = 0x63747a
const CAP = 0xc4c8bc

/** Kerb along an open side; a raised deck adds posts and rails. */
function addEdge(k: ModelKit, side: number, road: boolean, raised: boolean, y: (z: number) => number): void {
  const a = side === 0 ? [-.49, .49] : side === 1 ? [.49, .49] : side === 2 ? [.49, -.49] : [-.49, -.49]
  const b = side === 0 ? [.49, .49] : side === 1 ? [.49, -.49] : side === 2 ? [-.49, -.49] : [-.49, .49]
  k.beam([a[0]!, y(a[1]!) + .015, a[1]!], [b[0]!, y(b[1]!) + .015, b[1]!], .035, road ? KERB : 0xc4b9a3)
  if (!raised) return
  for (const t of [.08, .5, .92]) {
    const x = a[0]! + (b[0]! - a[0]!) * t, z = a[1]! + (b[1]! - a[1]!) * t
    k.box(x, y(z) + .18, z, .028, .36, .028, METAL)
  }
  for (const h of road ? [.22, .28] : [.19, .37]) k.beam([a[0]!, y(a[1]!) + h, a[1]!], [b[0]!, y(b[1]!) + h, b[1]!], road ? .045 : .025, CAP)
}

/** Paint strips lie flat on the deck (tilted with a ramp); kerbs and grass of a rounded corner. */
function addMarks(k: ModelKit, marks: NonNullable<ReturnType<typeof wayStructurePlan>['marks']>, y: (z: number) => number): void {
  const paint = PAINT[marks.paint]
  for (const [x0, z0, x1, z1, width] of marks.strips) {
    const a = new Vector3(x0, y(z0) + .01, z0), b = new Vector3(x1, y(z1) + .01, z1)
    const along = b.clone().sub(a)
    k.box((x0 + x1) / 2, (a.y + b.y) / 2, (z0 + z1) / 2, width, .006, along.length(), paint,
      new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), along.normalize()))
  }
  for (const [x0, z0, x1, z1] of marks.kerbs) k.beam([x0, y(z0) + .015, z0], [x1, y(z1) + .015, z1], .035, KERB)
  for (const polygon of marks.grass) k.ground(polygon, .005, GRASS)
}

/** One shared merged mesh for edge finish, upright rails, slope-aware slender supports and road markings. */
export function createWayStructure(cell: WayStructureCell, plan: ReturnType<typeof wayStructurePlan>): Mesh | null {
  if (!plan.edges.length && !plan.supports.length && !plan.marks) return null
  const key = JSON.stringify([cell.road, cell.slope, plan])
  let geometry = geometries.get(key)
  if (!geometry) {
    const k = new ModelKit()
    if (plan.raised) k.box(0, -cell.slope / 2 - .035, 0, 1, .07, Math.hypot(1, cell.slope), 0x637075,
      new Quaternion().setFromAxisAngle(new Vector3(1,0,0), -Math.atan(cell.slope)))
    const y = (z: number) => -cell.slope / 2 + z * cell.slope
    if (plan.marks) addMarks(k, plan.marks, y)
    for (const side of plan.edges) addEdge(k, side, cell.road, plan.raised, y)
    for (const support of plan.supports) {
      k.box(support.x, (support.bottom + support.top) / 2, support.z, .045, support.top - support.bottom, .045, METAL)
      k.box(support.x, support.top - .018, support.z, .13, .036, .1, METAL)
    }
    geometry = k.finish(); geometries.set(key, geometry)
  }
  const mesh = new Mesh(geometry, material)
  mesh.userData.retroStatic = true
  mesh.castShadow = mesh.receiveShadow = true
  return mesh
}
