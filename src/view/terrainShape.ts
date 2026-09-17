import type { GameSnapshot } from '../game/GameState'
import { getTerrainHeight, getWaterLevel, tileVisualCorner } from '../game/terrain'
import { buildingFootprint } from '../game/stageDesign'
import { isScenery } from '../game/scenery'

/** Flat building pads are presentation constraints; never alter saved terrain/navigation heights. */
export function terrainPads(s: Readonly<GameSnapshot>): Set<string> {
  const pads = new Set<string>()
  const add = (cell: { x: number; z: number }) => pads.add(`${cell.x},${cell.z}`)
  for (const b of s.buildings) if (!isScenery(b.kind)) buildingFootprint(b).forEach(add)
  for (const cells of [s.campingCells, s.medicalCells, s.stageForecourtCells, s.wasteDumpCells,
    s.logistics.roadCells, s.logistics.parkingCells, s.festival.infrastructure.depots]) cells.forEach(add)
  for (const installation of s.campInstallations) add(installation.cell)
  for (const [key, work] of Object.entries(s.festival.infrastructure.ground)) if (work.compacted || work.surface) pads.add(key)
  return pads
}

/** Shared tile corners: stored overrides, otherwise RCT-style max-of-hills / min-of-water. */
export class TerrainShape {
  readonly size: number
  readonly half: number
  readonly heights: Float64Array
  readonly corners: Float64Array
  readonly flat: Uint8Array
  constructor(s: Readonly<GameSnapshot>, pads = terrainPads(s)) {
    this.size = s.scenario.worldSize; this.half = this.size / 2
    this.heights = new Float64Array(this.size * this.size)
    this.corners = new Float64Array(this.size * this.size * 4)
    this.flat = new Uint8Array(this.size * this.size)
    for (let z = -this.half; z < this.half; z++) for (let x = -this.half; x < this.half; x++) {
      const i = this.index(x, z)
      this.heights[i] = getTerrainHeight(s.terrain, x, z)
      this.flat[i] = pads.has(`${x},${z}`) ? 1 : 0
    }
    const isCell = (x: number, z: number) => this.contains(x, z)
    const waterLevel = getWaterLevel(s)
    for (let z = -this.half; z < this.half; z++) for (let x = -this.half; x < this.half; x++) {
      const i = this.index(x, z)
      const h = this.heights[i]!
      if (this.flat[i]) {
        this.corners[i * 4] = h
        this.corners[i * 4 + 1] = h
        this.corners[i * 4 + 2] = h
        this.corners[i * 4 + 3] = h
        continue
      }
      this.corners[i * 4] = tileVisualCorner(s.terrain, x, z, 0, waterLevel, isCell)
      this.corners[i * 4 + 1] = tileVisualCorner(s.terrain, x, z, 1, waterLevel, isCell)
      this.corners[i * 4 + 2] = tileVisualCorner(s.terrain, x, z, 2, waterLevel, isCell)
      this.corners[i * 4 + 3] = tileVisualCorner(s.terrain, x, z, 3, waterLevel, isCell)
    }
  }
  contains(x: number, z: number): boolean { return x >= -this.half && z >= -this.half && x < this.half && z < this.half }
  index(x: number, z: number): number { return (z + this.half) * this.size + x + this.half }
  sample(x: number, z: number): number {
    const cx = Math.floor(x), cz = Math.floor(z)
    if (!this.contains(cx, cz)) return 0
    const i = this.index(cx, cz), h = this.heights[i]!
    if (this.flat[i]) return h
    const u = x - cx, v = z - cz, c = i * 4, a = this.corners
    const nw = a[c]!, sw = a[c + 1]!, se = a[c + 2]!, ne = a[c + 3]!
    if (u <= v) return (1 - v) * nw + (v - u) * sw + u * se
    return (1 - u) * nw + (u - v) * ne + v * se
  }
  actorHeight(x: number, z: number, elevation: number): number {
    const cx = Math.floor(x), cz = Math.floor(z)
    if (!this.contains(cx, cz)) return elevation
    const i = this.index(cx, cz)
    // Paths/buildings and elevated crossings keep their own authoritative surface.
    if (this.flat[i] || Math.abs(elevation - this.heights[i]!) > 1.05) return elevation
    return this.sample(x, z)
  }
}
