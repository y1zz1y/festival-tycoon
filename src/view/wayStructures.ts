import { BufferGeometry, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { ModelKit } from './retroBuildings'
import { canTraverseWayElevation, WAY_CARDINALS } from '../game/wayElevation'

export type WayStructureCell = { x: number; z: number; elevation: number; slope: number; direction: number; road: boolean; marked?: boolean }
export function indexWayStructures(cells: readonly WayStructureCell[]): Map<string, WayStructureCell[]> {
  const index = new Map<string, WayStructureCell[]>()
  for (const cell of cells) { const key = `${cell.x},${cell.z}`; const list = index.get(key) ?? []; list.push(cell); index.set(key, list) }
  return index
}
export function wayStructurePlan(cell: WayStructureCell, index: Map<string, WayStructureCell[]>, ground: number) {
  const direction = cell.slope ? cell.direction : 0
  const connected = WAY_CARDINALS.map((d, side) => (index.get(`${cell.x + d.x},${cell.z + d.z}`) ?? []).some(other =>
    other.road === cell.road && canTraverseWayElevation(cell.elevation, cell.slope, cell.direction, other.elevation, other.slope, other.direction, side)))
  const edges = [0, 1, 2, 3].filter(local => !connected[(local + direction) % 4])
  const raised = Math.max(cell.elevation, cell.elevation - cell.slope) - ground > .2
  const supports: { x: number; z: number; bottom: number; top: number }[] = []
  const layers = index.get(`${cell.x},${cell.z}`) ?? []
  if (raised) for (const x of [-.41, .41]) for (const z of [-.32, .32]) {
    const top = -cell.slope / 2 + z * cell.slope - .065
    const bottom = ground - cell.elevation
    // Leave lower routes clear: the span is carried by the neighboring bridge cells.
    const obstructed = layers.some(other => other !== cell &&
      Math.min(other.elevation, other.elevation - other.slope) < cell.elevation + top &&
      Math.max(other.elevation, other.elevation - other.slope) >= ground - .1)
    if (top - bottom > .15 && !obstructed) supports.push({ x, z, bottom, top })
  }
  return { edges, raised, supports }
}
const geometries = new Map<string, BufferGeometry>()
const material = new MeshStandardMaterial({ vertexColors: true, roughness: .8 })
material.userData.shared = true

/** One shared merged mesh for edge finish, upright rails and slope-aware slender supports. */
export function createWayStructure(cell: WayStructureCell, plan: ReturnType<typeof wayStructurePlan>): Mesh | null {
  if (!plan.edges.length && !plan.supports.length) return null
  const key = JSON.stringify([cell.road, cell.marked, cell.slope, plan])
  let geometry = geometries.get(key)
  if (!geometry) {
    const k = new ModelKit(), metal = 0x63747a, cap = 0xc4c8bc
    if (plan.raised) k.box(0, -cell.slope / 2 - .035, 0, 1, .07, Math.hypot(1, cell.slope), 0x637075,
      new Quaternion().setFromAxisAngle(new Vector3(1,0,0), -Math.atan(cell.slope)))
    const y = (z: number) => -cell.slope / 2 + z * cell.slope
    if (cell.marked && plan.edges.length === 2 && Math.abs(plan.edges[0]! - plan.edges[1]!) === 2) {
      const alongZ = plan.edges[0]! % 2 === 1
      for (const t of [-.3, .15]) {
        const a: [number,number,number] = alongZ ? [0,y(t)+.012,t] : [t,y(0)+.012,0]
        const b: [number,number,number] = alongZ ? [0,y(t+.2)+.012,t+.2] : [t+.2,y(0)+.012,0]
        k.beam(a,b,.018,0xeee9d7)
      }
    }
    for (const side of plan.edges) {
      const a = side === 0 ? [-.49, .49] : side === 1 ? [.49, .49] : side === 2 ? [.49, -.49] : [-.49, -.49]
      const b = side === 0 ? [.49, .49] : side === 1 ? [.49, -.49] : side === 2 ? [-.49, -.49] : [-.49, .49]
      k.beam([a[0]!, y(a[1]!) + .015, a[1]!], [b[0]!, y(b[1]!) + .015, b[1]!], .035, cell.road ? 0xa6aaa4 : 0xc4b9a3)
      if (!plan.raised) continue
      for (const t of [.08, .5, .92]) {
        const x = a[0]! + (b[0]! - a[0]!) * t, z = a[1]! + (b[1]! - a[1]!) * t
        k.box(x, y(z) + .18, z, .028, .36, .028, metal)
      }
      for (const h of cell.road ? [.22, .28] : [.19, .37]) k.beam([a[0]!, y(a[1]!) + h, a[1]!], [b[0]!, y(b[1]!) + h, b[1]!], cell.road ? .045 : .025, cap)
    }
    for (const support of plan.supports) {
      k.box(support.x, (support.bottom + support.top) / 2, support.z, .045, support.top - support.bottom, .045, metal)
      k.box(support.x, support.top - .018, support.z, .13, .036, .1, metal)
    }
    geometry = k.finish(); geometries.set(key, geometry)
  }
  const mesh = new Mesh(geometry, material)
  mesh.userData.retroStatic = true
  mesh.castShadow = mesh.receiveShadow = true
  return mesh
}
