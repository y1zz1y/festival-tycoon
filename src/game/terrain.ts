import { ENVIRONMENTS } from './environments'
import type { Environment } from './environments'
import { BUILDINGS } from './catalog'
import { SIMULATION_CONFIG } from './simulationConfig'
import type { RngSource } from './rng'

export type TerrainTree = {
  id: string
  kind: 'tree'
  x: number
  z: number
  rotation: number
  elevation: number
  price: number
}

export const TERRAIN_MIN = SIMULATION_CONFIG.terrain.minHeight
export const TERRAIN_MAX = SIMULATION_CONFIG.terrain.maxHeight
export const TERRAIN_HEIGHT_STEP = SIMULATION_CONFIG.terrain.heightStep
export const TERRAIN_SLOPE_MAX = SIMULATION_CONFIG.terrain.maxSlope
export const DEFAULT_WATER_LEVEL = SIMULATION_CONFIG.terrain.waterHeight
export const WATER_HEIGHT = DEFAULT_WATER_LEVEL
export const MUD_HEIGHT = SIMULATION_CONFIG.terrain.mudHeight

export function snapTerrainHeight(height: number): number {
  const snapped = Math.round(height * 2) / 2
  return Math.max(TERRAIN_MIN, Math.min(TERRAIN_MAX, snapped))
}

export type TerrainSnapshot = {
  heights: Record<string, number>
  corners?: Record<string, number>
}

export type TerrainEditMode =
  | 'raise'
  | 'lower'
  | 'flatten'
  | 'raiseCorner'
  | 'lowerCorner'
  | 'water'
  | 'smooth'

export function terrainToolMode(tool: string): TerrainEditMode | null {
  if (tool === 'terrainRaise') return 'raise'
  if (tool === 'terrainLower') return 'lower'
  if (tool === 'terrainFlatten') return 'flatten'
  if (tool === 'terrainRaiseCorner') return 'raiseCorner'
  if (tool === 'terrainLowerCorner') return 'lowerCorner'
  if (tool === 'terrainWater') return 'water'
  if (tool === 'terrainSmooth') return 'smooth'
  return null
}

export type TerrainChange = {
  x: number
  z: number
  from: number
  to: number
}

export type TerrainCornerChange = {
  x: number
  z: number
  from: number
  to: number
}

export const TILE_CORNER_OFFSETS = [
  { x: 0, z: 0 },
  { x: 0, z: 1 },
  { x: 1, z: 1 },
  { x: 1, z: 0 },
] as const

const NEIGHBORS = [
  { x: 0, z: 1 },
  { x: 1, z: 0 },
  { x: 0, z: -1 },
  { x: -1, z: 0 },
] as const

const VERTEX_NEIGHBORS = NEIGHBORS

export function createEmptyTerrain(): TerrainSnapshot {
  return { heights: {} }
}

export function terrainCellKey(x: number, z: number): string {
  return `${x},${z}`
}

export function normalizeWaterLevel(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const snapped = Math.round(value * 2) / 2
    return Math.max(TERRAIN_MIN, Math.min(0, snapped))
  }
  return DEFAULT_WATER_LEVEL
}

export function getWaterLevel(source?: { waterLevel?: number } | null): number {
  return normalizeWaterLevel(source?.waterLevel)
}

export function normalizeTerrain(
  source?: Partial<TerrainSnapshot> | null,
): TerrainSnapshot {
  const heights: Record<string, number> = {}
  if (source?.heights && typeof source.heights === 'object') {
    for (const [key, value] of Object.entries(source.heights)) {
      if (!Number.isFinite(value)) continue
      const height = snapTerrainHeight(value)
      if (height === 0) continue
      heights[key] = height
    }
  }
  const corners: Record<string, number> = {}
  if (source?.corners && typeof source.corners === 'object') {
    for (const [key, value] of Object.entries(source.corners)) {
      if (!Number.isFinite(value)) continue
      const height = snapTerrainHeight(value)
      if (height === 0) continue
      corners[key] = height
    }
  }
  return Object.keys(corners).length > 0 ? { heights, corners } : { heights }
}

export function getTerrainHeight(
  terrain: TerrainSnapshot | undefined,
  x: number,
  z: number,
): number {
  return terrain?.heights[terrainCellKey(x, z)] ?? 0
}

export function setTerrainHeight(
  terrain: TerrainSnapshot,
  x: number,
  z: number,
  height: number,
): void {
  const clamped = snapTerrainHeight(height)
  const key = terrainCellKey(x, z)
  if (clamped === 0) delete terrain.heights[key]
  else terrain.heights[key] = clamped
}

export function derivedCornerHeight(
  terrain: TerrainSnapshot | undefined,
  vx: number,
  vz: number,
  isCell: (x: number, z: number) => boolean = () => true,
): number {
  let max = 0
  let min = 0
  let count = 0
  let wet = false
  for (const dx of [-1, 0]) {
    for (const dz of [-1, 0]) {
      const x = vx + dx
      const z = vz + dz
      if (!isCell(x, z)) continue
      const height = getTerrainHeight(terrain, x, z)
      if (count === 0) {
        max = height
        min = height
      } else {
        if (height > max) max = height
        if (height < min) min = height
      }
      if (height < 0) wet = true
      count += 1
    }
  }
  if (count === 0) return 0
  return wet ? min : max
}

export function getCornerHeight(
  terrain: TerrainSnapshot | undefined,
  vx: number,
  vz: number,
  isCell: (x: number, z: number) => boolean = () => true,
): number {
  const stored = terrain?.corners?.[terrainCellKey(vx, vz)]
  if (typeof stored === 'number' && Number.isFinite(stored)) return stored
  return derivedCornerHeight(terrain, vx, vz, isCell)
}

export function setCornerHeight(
  terrain: TerrainSnapshot,
  vx: number,
  vz: number,
  height: number,
): void {
  const clamped = snapTerrainHeight(height)
  if (!terrain.corners) terrain.corners = {}
  const key = terrainCellKey(vx, vz)
  if (clamped === 0) delete terrain.corners[key]
  else terrain.corners[key] = clamped
  if (Object.keys(terrain.corners).length === 0) delete terrain.corners
}

export function terrainCornerIndex(localX = 0.5, localZ = 0.5): number {
  const east = localX >= 0.5
  const south = localZ >= 0.5
  if (!east && !south) return 0
  if (!east && south) return 1
  if (east && south) return 2
  return 3
}

/** Per-tile visual corner: rise at most 0.5 toward higher land, drop at most 0.5 into water. */
export function tileVisualCorner(
  terrain: TerrainSnapshot | undefined,
  x: number,
  z: number,
  cornerIndex: number,
  waterLevel: number = DEFAULT_WATER_LEVEL,
  isCell: (cellX: number, cellZ: number) => boolean = () => true,
): number {
  const height = getTerrainHeight(terrain, x, z)
  const offset = TILE_CORNER_OFFSETS[((cornerIndex % 4) + 4) % 4]
  if (!offset) return height
  const stored = terrain?.corners?.[terrainCellKey(x + offset.x, z + offset.z)]
  if (typeof stored === 'number' && Number.isFinite(stored)) {
    return snapTerrainHeight(
      Math.max(height - TERRAIN_SLOPE_MAX, Math.min(height + TERRAIN_SLOPE_MAX, stored)),
    )
  }
  let corner = height
  const neighbors = [
    { x: x + (offset.x === 0 ? -1 : 1), z },
    { x, z: z + (offset.z === 0 ? -1 : 1) },
    { x: x + (offset.x === 0 ? -1 : 1), z: z + (offset.z === 0 ? -1 : 1) },
  ]
  for (const neighbor of neighbors) {
    if (!isCell(neighbor.x, neighbor.z)) continue
    const neighborHeight = getTerrainHeight(terrain, neighbor.x, neighbor.z)
    if (neighborHeight > height) {
      corner = Math.max(
        corner,
        height + Math.min(TERRAIN_SLOPE_MAX, neighborHeight - height),
      )
    }
    if (height >= waterLevel && neighborHeight < waterLevel) {
      corner = Math.min(
        corner,
        height - Math.min(TERRAIN_SLOPE_MAX, height - waterLevel),
      )
    }
  }
  return snapTerrainHeight(corner)
}

/** Two visual corners of the edge facing `direction` (0=+z, 1=+x, 2=-z, 3=-x). */
export function terrainWalkEdgeHeights(
  terrain: TerrainSnapshot | undefined,
  x: number,
  z: number,
  direction: number,
  waterLevel: number = DEFAULT_WATER_LEVEL,
  isCell: (cellX: number, cellZ: number) => boolean = () => true,
): [number, number] {
  const corner = (index: number): number =>
    tileVisualCorner(terrain, x, z, index, waterLevel, isCell)
  switch (((direction % 4) + 4) % 4) {
    case 0:
      return [corner(1), corner(2)]
    case 1:
      return [corner(3), corner(2)]
    case 2:
      return [corner(0), corner(3)]
    default:
      return [corner(0), corner(1)]
  }
}

/** Authoritative walk height on land: the same two-triangle surface as the mesh. */
export function sampleTerrainSurface(
  terrain: TerrainSnapshot | undefined,
  x: number,
  z: number,
  waterLevel: number = DEFAULT_WATER_LEVEL,
  isCell: (cellX: number, cellZ: number) => boolean = () => true,
): number {
  const cx = Math.floor(x)
  const cz = Math.floor(z)
  if (!isCell(cx, cz)) return getTerrainHeight(terrain, cx, cz)
  const u = x - cx
  const v = z - cz
  const nw = tileVisualCorner(terrain, cx, cz, 0, waterLevel, isCell)
  const sw = tileVisualCorner(terrain, cx, cz, 1, waterLevel, isCell)
  const se = tileVisualCorner(terrain, cx, cz, 2, waterLevel, isCell)
  const ne = tileVisualCorner(terrain, cx, cz, 3, waterLevel, isCell)
  if (u <= v) return (1 - v) * nw + (v - u) * sw + u * se
  return (1 - u) * nw + (u - v) * ne + v * se
}

export function tileShowsWater(
  terrain: TerrainSnapshot | undefined,
  x: number,
  z: number,
  waterLevel: number = DEFAULT_WATER_LEVEL,
  isCell: (cellX: number, cellZ: number) => boolean = () => true,
): boolean {
  if (isWaterHeight(getTerrainHeight(terrain, x, z), waterLevel)) return true
  for (let corner = 0; corner < 4; corner += 1) {
    if (tileVisualCorner(terrain, x, z, corner, waterLevel, isCell) <= waterLevel) {
      return true
    }
  }
  return false
}

export function isWaterHeight(
  height: number,
  waterLevel: number = DEFAULT_WATER_LEVEL,
): boolean {
  return height < waterLevel
}

export function isSwimmableHeight(
  height: number,
  waterLevel: number = DEFAULT_WATER_LEVEL,
  minDepth: number = SIMULATION_CONFIG.terrain.minSwimDepth,
): boolean {
  return waterLevel - height >= minDepth
}

export function isMudHeight(height: number): boolean {
  return height === MUD_HEIGHT && !isWaterHeight(height)
}

export function terrainFingerprint(terrain: TerrainSnapshot | undefined): string {
  if (!terrain) return ''
  const cells = Object.entries(terrain.heights)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, height]) => `${key}:${height}`)
    .join('|')
  const corners = Object.entries(terrain.corners ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, height]) => `${key}:${height}`)
    .join('|')
  return corners ? `${cells}#${corners}` : cells
}

export function isInTerrainWorld(
  x: number,
  z: number,
  worldSize: number,
): boolean {
  const half = worldSize / 2
  return x >= -half && x < half && z >= -half && z < half
}

function isInTerrainVertex(x: number, z: number, worldSize: number): boolean {
  const half = worldSize / 2
  return x >= -half && x <= half && z >= -half && z <= half
}

function applyPendingHeight(
  terrain: TerrainSnapshot,
  pending: Map<string, number>,
  x: number,
  z: number,
): number {
  return pending.get(terrainCellKey(x, z)) ?? getTerrainHeight(terrain, x, z)
}

function applyPendingCorner(
  terrain: TerrainSnapshot,
  pending: Map<string, number>,
  vx: number,
  vz: number,
  worldSize: number,
): number {
  return (
    pending.get(terrainCellKey(vx, vz)) ??
    getCornerHeight(terrain, vx, vz, (x, z) => isInTerrainWorld(x, z, worldSize))
  )
}

function collectCellChanges(
  terrain: TerrainSnapshot,
  pending: Map<string, number>,
): TerrainChange[] {
  const changes: TerrainChange[] = []
  pending.forEach((to, key) => {
    const [cellX, cellZ] = key.split(',').map(Number)
    if (!Number.isFinite(cellX) || !Number.isFinite(cellZ)) return
    const from = getTerrainHeight(terrain, cellX, cellZ)
    if (from === to) return
    changes.push({ x: cellX, z: cellZ, from, to })
  })
  return changes
}

function floodCellHeights(
  terrain: TerrainSnapshot,
  worldSize: number,
  startX: number,
  startZ: number,
  desired: number,
  isProtected: (cellX: number, cellZ: number) => boolean,
): Map<string, number> {
  const pending = new Map<string, number>()
  const queue: Array<{ x: number; z: number; target: number }> = [
    { x: startX, z: startZ, target: desired },
  ]
  while (queue.length > 0) {
    const next = queue.shift()
    if (!next || !isInTerrainWorld(next.x, next.z, worldSize)) continue
    const from = applyPendingHeight(terrain, pending, next.x, next.z)
    const target = Math.max(TERRAIN_MIN, Math.min(TERRAIN_MAX, next.target))
    if (target === from) continue
    if (isProtected(next.x, next.z)) continue
    pending.set(terrainCellKey(next.x, next.z), target)
    for (const offset of NEIGHBORS) {
      const neighborX = next.x + offset.x
      const neighborZ = next.z + offset.z
      if (!isInTerrainWorld(neighborX, neighborZ, worldSize)) continue
      const neighborHeight = applyPendingHeight(
        terrain,
        pending,
        neighborX,
        neighborZ,
      )
      if (neighborHeight < target - 1) {
        queue.push({ x: neighborX, z: neighborZ, target: target - 1 })
      } else if (neighborHeight > target + 1) {
        queue.push({ x: neighborX, z: neighborZ, target: target + 1 })
      }
    }
  }
  return pending
}

function planExactCellEdit(
  terrain: TerrainSnapshot,
  x: number,
  z: number,
  desired: number,
  current: number,
  isProtected: (cellX: number, cellZ: number) => boolean,
  unchangedMessage: string,
): { ok: false; message: string } | { ok: true; changes: TerrainChange[] } {
  if (desired < TERRAIN_MIN) {
    return { ok: false, message: 'Tiefer geht das Gelände nicht' }
  }
  if (desired > TERRAIN_MAX) {
    return { ok: false, message: 'Höher geht das Gelände nicht' }
  }
  if (desired === current) {
    return { ok: false, message: unchangedMessage }
  }
  if (isProtected(x, z)) {
    return {
      ok: false,
      message: 'Unter bebauten Flächen kann das Gelände nicht verändert werden',
    }
  }
  const pending = new Map<string, number>()
  pending.set(terrainCellKey(x, z), desired)
  const changes = collectCellChanges(terrain, pending)
  if (changes.length === 0) {
    return { ok: false, message: 'Das Gelände ändert sich hier nicht' }
  }
  return { ok: true, changes }
}

function planCellEdit(
  terrain: TerrainSnapshot,
  worldSize: number,
  x: number,
  z: number,
  desired: number,
  current: number,
  isProtected: (cellX: number, cellZ: number) => boolean,
  unchangedMessage: string,
): { ok: false; message: string } | { ok: true; changes: TerrainChange[] } {
  if (desired < TERRAIN_MIN) {
    return { ok: false, message: 'Tiefer geht das Gelände nicht' }
  }
  if (desired > TERRAIN_MAX) {
    return { ok: false, message: 'Höher geht das Gelände nicht' }
  }
  if (desired === current) {
    return { ok: false, message: unchangedMessage }
  }
  if (isProtected(x, z)) {
    return {
      ok: false,
      message: 'Unter bebauten Flächen kann das Gelände nicht verändert werden',
    }
  }
  const pending = floodCellHeights(terrain, worldSize, x, z, desired, isProtected)
  const startHeight = pending.get(terrainCellKey(x, z))
  if (startHeight === undefined || startHeight === current) {
    return {
      ok: false,
      message: 'Nachbarfelder blockieren diese Höhenänderung',
    }
  }
  const changes = collectCellChanges(terrain, pending)
  if (changes.length === 0) {
    return { ok: false, message: 'Das Gelände ändert sich hier nicht' }
  }
  return { ok: true, changes }
}

function planCornerEdit(
  terrain: TerrainSnapshot,
  worldSize: number,
  x: number,
  z: number,
  mode: 'raiseCorner' | 'lowerCorner',
  isProtected: (cellX: number, cellZ: number) => boolean,
  corner: number,
):
  | { ok: false; message: string }
  | { ok: true; changes: TerrainChange[]; cornerChanges: TerrainCornerChange[] } {
  if (!isInTerrainWorld(x, z, worldSize)) {
    return { ok: false, message: 'Außerhalb des Geländes' }
  }
  const offset = TILE_CORNER_OFFSETS[((corner % 4) + 4) % 4]
  if (!offset) return { ok: false, message: 'Diese Ecke gibt es nicht' }
  const vx = x + offset.x
  const vz = z + offset.z
  if (!isInTerrainVertex(vx, vz, worldSize)) {
    return { ok: false, message: 'Außerhalb des Geländes' }
  }
  if (isProtected(x, z)) {
    return {
      ok: false,
      message: 'Unter bebauten Flächen kann das Gelände nicht verändert werden',
    }
  }
  const current = applyPendingCorner(terrain, new Map(), vx, vz, worldSize)
  const desired = snapTerrainHeight(
    current + (mode === 'raiseCorner' ? TERRAIN_HEIGHT_STEP : -TERRAIN_HEIGHT_STEP),
  )
  if (desired < TERRAIN_MIN) {
    return { ok: false, message: 'Tiefer geht das Gelände nicht' }
  }
  if (desired > TERRAIN_MAX) {
    return { ok: false, message: 'Höher geht das Gelände nicht' }
  }
  const vertexProtected = (px: number, pz: number) => {
    for (const dx of [-1, 0]) {
      for (const dz of [-1, 0]) {
        const cx = px + dx
        const cz = pz + dz
        if (isInTerrainWorld(cx, cz, worldSize) && isProtected(cx, cz)) return true
      }
    }
    return false
  }
  if (vertexProtected(vx, vz)) {
    return {
      ok: false,
      message: 'Unter bebauten Flächen kann das Gelände nicht verändert werden',
    }
  }

  const pending = new Map<string, number>()
  const queue: Array<{ x: number; z: number; target: number }> = [
    { x: vx, z: vz, target: desired },
  ]
  while (queue.length > 0) {
    const next = queue.shift()
    if (!next || !isInTerrainVertex(next.x, next.z, worldSize)) continue
    if (vertexProtected(next.x, next.z)) continue
    const from = applyPendingCorner(terrain, pending, next.x, next.z, worldSize)
    const target = Math.max(TERRAIN_MIN, Math.min(TERRAIN_MAX, next.target))
    if (target === from) continue
    pending.set(terrainCellKey(next.x, next.z), target)
    for (const offsetN of VERTEX_NEIGHBORS) {
      const nx = next.x + offsetN.x
      const nz = next.z + offsetN.z
      if (!isInTerrainVertex(nx, nz, worldSize)) continue
      const neighbor = applyPendingCorner(terrain, pending, nx, nz, worldSize)
      if (neighbor < target - TERRAIN_HEIGHT_STEP) {
        queue.push({ x: nx, z: nz, target: target - TERRAIN_HEIGHT_STEP })
      } else if (neighbor > target + TERRAIN_HEIGHT_STEP) {
        queue.push({ x: nx, z: nz, target: target + TERRAIN_HEIGHT_STEP })
      }
    }
  }

  if ((pending.get(terrainCellKey(vx, vz)) ?? current) === current) {
    return { ok: false, message: 'Das Gelände ändert sich hier nicht' }
  }

  const preview = new Map(pending)
  const cellPending = new Map<string, number>()
  const touched = new Set<string>()
  preview.forEach((_, key) => {
    const [px, pz] = key.split(',').map(Number)
    if (!Number.isFinite(px) || !Number.isFinite(pz)) return
    for (const dx of [-1, 0]) {
      for (const dz of [-1, 0]) {
        const cx = px + dx
        const cz = pz + dz
        if (!isInTerrainWorld(cx, cz, worldSize) || isProtected(cx, cz)) continue
        touched.add(terrainCellKey(cx, cz))
      }
    }
  })
  touched.forEach((key) => {
    const [cx, cz] = key.split(',').map(Number)
    if (!Number.isFinite(cx) || !Number.isFinite(cz)) return
    let minimum = Number.POSITIVE_INFINITY
    for (const corner of TILE_CORNER_OFFSETS) {
      const height = applyPendingCorner(
        terrain,
        preview,
        cx + corner.x,
        cz + corner.z,
        worldSize,
      )
      if (height < minimum) minimum = height
    }
    if (!Number.isFinite(minimum)) return
    const next = snapTerrainHeight(minimum)
    if (next !== getTerrainHeight(terrain, cx, cz)) cellPending.set(key, next)
  })

  const cornerChanges: TerrainCornerChange[] = []
  pending.forEach((to, key) => {
    const [px, pz] = key.split(',').map(Number)
    if (!Number.isFinite(px) || !Number.isFinite(pz)) return
    const from = getCornerHeight(terrain, px, pz, (cx, cz) =>
      isInTerrainWorld(cx, cz, worldSize),
    )
    if (from === to) return
    cornerChanges.push({ x: px, z: pz, from, to })
  })
  const changes = collectCellChanges(terrain, cellPending)
  if (cornerChanges.length === 0 && changes.length === 0) {
    return { ok: false, message: 'Das Gelände ändert sich hier nicht' }
  }
  return { ok: true, changes, cornerChanges }
}

function terrainEditTarget(
  current: number,
  mode: TerrainEditMode,
  originHeight?: number,
): number {
  if (mode === 'raise') return snapTerrainHeight(current + TERRAIN_HEIGHT_STEP)
  if (mode === 'lower') return snapTerrainHeight(current - TERRAIN_HEIGHT_STEP)
  if (mode === 'smooth') return snapTerrainHeight(originHeight ?? current)
  if (mode === 'flatten') return 0
  if (mode === 'water') return Math.min(-1, current - 1)
  return current
}

function unchangedTerrainMessage(mode: TerrainEditMode): string {
  if (mode === 'flatten') return 'Dieses Feld ist bereits eben'
  if (mode === 'water') return 'Hier ist schon tiefes Wasser'
  if (mode === 'smooth') return 'Diese Fläche ist bereits geglättet'
  return 'Das Gelände ändert sich hier nicht'
}

export function planTerrainEdit(
  terrain: TerrainSnapshot,
  worldSize: number,
  x: number,
  z: number,
  mode: TerrainEditMode,
  isProtected: (cellX: number, cellZ: number) => boolean,
  corner = 0,
  originHeight?: number,
):
  | { ok: false; message: string }
  | { ok: true; changes: TerrainChange[]; cornerChanges?: TerrainCornerChange[] } {
  if (!isInTerrainWorld(x, z, worldSize)) {
    return { ok: false, message: 'Außerhalb des Geländes' }
  }
  if (mode === 'raiseCorner' || mode === 'lowerCorner') {
    return planCornerEdit(terrain, worldSize, x, z, mode, isProtected, corner)
  }
  const current = getTerrainHeight(terrain, x, z)
  const desired = terrainEditTarget(current, mode, originHeight)
  const unchanged = unchangedTerrainMessage(mode)
  if (mode === 'raise' || mode === 'lower' || mode === 'smooth') {
    return planExactCellEdit(terrain, x, z, desired, current, isProtected, unchanged)
  }
  return planCellEdit(
    terrain,
    worldSize,
    x,
    z,
    desired,
    current,
    isProtected,
    unchanged,
  )
}

export function planTerrainAreaEdit(
  terrain: TerrainSnapshot,
  worldSize: number,
  cells: ReadonlyArray<{ x: number; z: number }>,
  mode: TerrainEditMode,
  isProtected: (cellX: number, cellZ: number) => boolean,
  originHeight?: number,
):
  | { ok: false; message: string }
  | { ok: true; changes: TerrainChange[]; cornerChanges?: TerrainCornerChange[] } {
  if (mode === 'raiseCorner' || mode === 'lowerCorner') {
    const first = cells[0]
    if (!first) return { ok: false, message: 'Keine Fläche gewählt' }
    return planTerrainEdit(terrain, worldSize, first.x, first.z, mode, isProtected)
  }
  const pending = new Map<string, number>()
  let seen = false
  for (const cell of cells) {
    if (!isInTerrainWorld(cell.x, cell.z, worldSize)) continue
    seen = true
    if (isProtected(cell.x, cell.z)) continue
    const current = getTerrainHeight(terrain, cell.x, cell.z)
    const desired = terrainEditTarget(current, mode, originHeight)
    if (desired === current) continue
    if (desired < TERRAIN_MIN || desired > TERRAIN_MAX) continue
    pending.set(terrainCellKey(cell.x, cell.z), desired)
  }
  if (!seen) return { ok: false, message: 'Außerhalb des Geländes' }
  const changes = collectCellChanges(terrain, pending)
  if (changes.length === 0) {
    return { ok: false, message: unchangedTerrainMessage(mode) }
  }
  return { ok: true, changes }
}

export function applyTerrainChanges(
  terrain: TerrainSnapshot,
  changes: readonly TerrainChange[],
  corners?: readonly TerrainCornerChange[],
): void {
  changes.forEach((change) => {
    setTerrainHeight(terrain, change.x, change.z, change.to)
  })
  corners?.forEach((change) => {
    setCornerHeight(terrain, change.x, change.z, change.to)
  })
}

function randomInt(rng: RngSource, min: number, max: number): number {
  return min + rng.nextInt(max - min + 1)
}

export function generateTerrain(
  worldSize: number,
  rng: RngSource,
  unevenness = 0.5,
  environment: Environment = 'farmland',
): TerrainSnapshot {
  const terrain = createEmptyTerrain()
  if (unevenness <= 0) return terrain
  const half = worldSize / 2
  const blobCount = 5 + Math.floor(worldSize / 14)
  const keepDry = environment === 'desert' || environment === 'urban'
  for (let index = 0; index < blobCount; index += 1) {
    const centerX = randomInt(rng, -half + 4, half - 5)
    const centerZ = randomInt(rng, -half + 6, half - 5)
    const peaks = keepDry ? [1, 2, 2, 3, 3, 4] : [-3, -2, -2, -1, 1, 2, 2, 3, 4]
    const peak = peaks[randomInt(rng, 0, peaks.length - 1)] ?? 2
    const radius = randomInt(rng, 2, 6)
    for (let z = centerZ - radius; z <= centerZ + radius; z += 1) {
      for (let x = centerX - radius; x <= centerX + radius; x += 1) {
        if (!isInTerrainWorld(x, z, worldSize)) continue
        const distance = Math.max(Math.abs(x - centerX), Math.abs(z - centerZ))
        if (distance > radius) continue
        const stepped =
          peak > 0 ? Math.max(0, peak - distance) : Math.min(0, peak + distance)
        const height = Math.round(
          stepped * Math.min(1, Math.max(0, unevenness * 1.4)),
        )
        if (height === 0) continue
        const existing = getTerrainHeight(terrain, x, z)
        setTerrainHeight(
          terrain,
          x,
          z,
          peak > 0 ? Math.max(existing, height) : Math.min(existing, height),
        )
      }
    }
  }
  enforceSlope(terrain, worldSize)
  flattenEntrance(terrain, worldSize)
  return terrain
}

function enforceSlope(terrain: TerrainSnapshot, worldSize: number): void {
  const half = worldSize / 2
  let changed = true
  let guard = 0
  while (changed && guard < worldSize * 8) {
    changed = false
    guard += 1
    for (let z = -half; z < half; z += 1) {
      for (let x = -half; x < half; x += 1) {
        const height = getTerrainHeight(terrain, x, z)
        for (const offset of NEIGHBORS) {
          const neighborX = x + offset.x
          const neighborZ = z + offset.z
          if (!isInTerrainWorld(neighborX, neighborZ, worldSize)) continue
          const neighbor = getTerrainHeight(terrain, neighborX, neighborZ)
          if (height > neighbor + 1) {
            setTerrainHeight(terrain, neighborX, neighborZ, height - 1)
            changed = true
          } else if (neighbor > height + 1) {
            setTerrainHeight(terrain, x, z, neighbor - 1)
            changed = true
          }
        }
      }
    }
  }
}

function flattenEntrance(terrain: TerrainSnapshot, worldSize: number): void {
  const half = worldSize / 2
  const minZ = -half
  for (let z = minZ; z <= minZ + 2; z += 1) {
    for (let x = -4; x <= 4; x += 1) {
      if (isInTerrainWorld(x, z, worldSize)) {
        setTerrainHeight(terrain, x, z, 0)
      }
    }
  }
  enforceSlope(terrain, worldSize)
  for (let x = -4; x <= 4; x += 1) {
    setTerrainHeight(terrain, x, minZ, 0)
    if (isInTerrainWorld(x, minZ + 1, worldSize)) {
      setTerrainHeight(terrain, x, minZ + 1, 0)
    }
  }
}

export function scatterWildTrees(
  terrain: TerrainSnapshot,
  worldSize: number,
  reserved: ReadonlyArray<{ x: number; z: number }>,
  rng: RngSource,
  environment: Environment = 'farmland',
): TerrainTree[] {
  const reservedKeys = new Set(reserved.map((cell) => terrainCellKey(cell.x, cell.z)))
  const half = worldSize / 2
  const trees: TerrainTree[] = []
  const density = SIMULATION_CONFIG.terrain.treeDensity * ENVIRONMENTS[environment].trees
  for (let z = -half; z < half; z += 1) {
    for (let x = -half; x < half; x += 1) {
      if (reservedKeys.has(terrainCellKey(x, z))) continue
      const height = getTerrainHeight(terrain, x, z)
      if (height < 0) continue
      if (z <= -half + 2 && x >= -4 && x <= 4) continue
      if (rng.next() > density) continue
      trees.push({
        id: `wild-tree-${x}-${z}`,
        kind: 'tree',
        x,
        z,
        rotation: rng.nextInt(4),
        elevation: height,
        price: BUILDINGS.tree.defaultPrice,
      })
    }
  }
  return trees
}

export function describeTerrainHeight(
  height: number,
  waterLevel: number = DEFAULT_WATER_LEVEL,
): string {
  if (isWaterHeight(height, waterLevel)) return 'Wasser'
  if (isMudHeight(height)) return 'Schlamm'
  if (height > 0) return `Hügel Ebene ${height}`
  return 'Ebenes Gelände'
}
