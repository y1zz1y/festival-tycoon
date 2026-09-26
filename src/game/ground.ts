import type { Environment } from './environments'
import type { WayType } from './wayTypes'
import { wayInfo } from './wayTypes'
import type { GameSnapshot } from './GameState'
import { getTerrainHeight, isInTerrainWorld } from './terrain'
import { bookFinance, canAfford } from './finance'

export type GroundWork = 'drain' | 'compact' | 'gravel' | 'pave'
/** Paintable looks. `substrate` remaps only types that already had nav/speed costs. */
export const GROUND_COVERS = {
  grass: { name: 'Rasen', material: 'grass', substrate: 'grass' },
  sand: { name: 'Sand', material: 'sand', substrate: 'sand' },
  stone: { name: 'Stein', material: 'stone' },
  field: { name: 'Acker', material: 'field', substrate: 'field' },
  snow: { name: 'Schnee', material: 'snow' },
  rock: { name: 'Felsen', material: 'rock' },
  earth: { name: 'Braune Erde', material: 'earth', substrate: 'clay' },
} as const
export type GroundCover = keyof typeof GROUND_COVERS
export type GroundCell = {
  footway?: WayType
  roadway?: WayType
  drained?: boolean
  compacted?: boolean
  surface?: 'gravel' | 'paved'
  cover?: GroundCover
}
export const GROUND_WORK = {
  drain: { name: 'Entwässern', cost: 35 }, compact: { name: 'Verdichten', cost: 25 },
  gravel: { name: 'Schotterdecke', cost: 45 }, pave: { name: 'Pflastern / Fundament', cost: 90 },
}
export const GROUND_COVER_IDS = Object.keys(GROUND_COVERS) as GroundCover[]
export function isGroundCover(value: unknown): value is GroundCover {
  return typeof value === 'string' && value in GROUND_COVERS
}
export function groundCoverFromTool(tool: string): GroundCover | null {
  if (tool === 'terrainCoverGrass') return 'grass'
  if (tool === 'terrainCoverSand') return 'sand'
  if (tool === 'terrainCoverStone') return 'stone'
  if (tool === 'terrainCoverField') return 'field'
  if (tool === 'terrainCoverSnow') return 'snow'
  if (tool === 'terrainCoverRock') return 'rock'
  if (tool === 'terrainCoverEarth') return 'earth'
  return null
}
export function normalizeGroundCells(ground: Record<string, GroundCell>): Record<string, GroundCell> {
  for (const cell of Object.values(ground)) {
    if (cell.cover !== undefined && !isGroundCover(cell.cover)) delete cell.cover
  }
  return ground
}
export const groundKey = (x: number, z: number) => `${x},${z}`
export function substrate(x: number, z: number, environment: Environment = 'farmland'): 'field' | 'clay' | 'gravel' | 'sand' | 'grass' | 'urban' {
  const region = Math.abs(Math.floor(x / 7) * 13 + Math.floor(z / 9) * 7) % 7
  if (environment === 'desert') return 'sand'
  if (environment === 'urban') return 'urban'
  if (environment === 'grassland') return region === 6 ? 'gravel' : 'grass'
  return region < 2 ? 'clay' : region === 6 ? 'gravel' : 'field'
}
export function groundInfo(s: Readonly<GameSnapshot>, x: number, z: number) {
  const natural = substrate(x, z, s.scenario.environment)
  const stored = s.festival.infrastructure?.ground[groundKey(x, z)]
  const cover = stored?.cover ? GROUND_COVERS[stored.cover] : undefined
  const mapped = cover && 'substrate' in cover ? cover.substrate : undefined
  const type = mapped ?? natural
  const work: GroundCell = { ...(natural === 'urban' ? { drained: true, compacted: true, surface: 'paved' as const } : {}), ...stored }
  const wet = s.festival.wetness / 100 * (type === 'sand' ? .25 : 1) * (work.drained ? 0.25 : s.festival.upgrades.drainage ? 0.5 : 1)
  const softness = type === 'clay' ? 1 : type === 'field' ? .85 : type === 'grass' ? .55 : type === 'sand' ? .4 : .25
  const speed = work.surface === 'paved' ? 1.15 : work.surface === 'gravel' ? 1.02 - wet * 0.1 :
    (work.compacted ? 0.94 : type === 'sand' ? .65 : type === 'grass' ? .9 : .82) * (1 - wet * softness * 0.65)
  return { ...work, type, wet, speed, bearing: work.surface === 'paved' ? 3 : work.compacted || type === 'gravel' ? 2 : 1 }
}
export function prepareGround(s: GameSnapshot, x: number, z: number, kind: GroundWork) {
  const fail = (message: string) => ({ ok: false, message })
  // isInTerrainWorld is what the terrain and the renderer go by; the hand-rolled
  // half-size comparison that used to stand here agreed with it only on maps with an
  // even side length and let one extra row through on odd ones (see Riesig, 265).
  if (!Number.isInteger(x) || !Number.isInteger(z) || !isInTerrainWorld(x, z, s.scenario.worldSize)) return fail('Außerhalb des Geländes')
  if (getTerrainHeight(s.terrain, x, z) < 0) return fail('Zuerst Wasser und Senken mit dem Geländewerkzeug aufarbeiten')
  const offer = GROUND_WORK[kind], info = groundInfo(s, x, z)
  if (!offer) return fail('Unbekannte Bodenarbeit')
  if ((kind === 'drain' && info.drained) || (kind === 'compact' && info.compacted) || (kind === 'gravel' && info.surface) || (kind === 'pave' && info.surface === 'paved')) return fail('Bereits ausgebaut')
  if (kind === 'compact' && info.type === 'clay' && !info.drained) return fail('Lehmboden zuerst entwässern')
  if (kind === 'gravel' && info.bearing < 2) return fail('Zuerst den Untergrund verdichten')
  if (kind === 'pave' && (!info.drained || info.bearing < 2)) return fail('Fundament braucht Entwässerung und tragfähigen Untergrund')
  if (!canAfford(s, offer.cost)) return fail('Nicht genug Geld für die Bodenarbeit')
  bookFinance(s, 'landscaping', -offer.cost)
  const cell = s.festival.infrastructure.ground[groundKey(x, z)] ??= {}
  if (kind === 'drain') cell.drained = true
  if (kind === 'compact') cell.compacted = true
  if (kind === 'gravel' || kind === 'pave') cell.surface = kind === 'pave' ? 'paved' : 'gravel'
  return { ok: true, message: `${offer.name}: Feld ${x}, ${z} ausgebaut` }
}
export function buildingEfficiency(s: Readonly<GameSnapshot>, x: number, z: number): number {
  const g = groundInfo(s, x, z)
  return g.bearing === 3 ? 1.25 : Math.max(.4, g.speed)
}

export function roadGroundLimit(s: Readonly<GameSnapshot>, x: number, z: number): number {
  return wayInfo(s, x, z, 'road').limit
}

export function groundRectangle(s: Readonly<GameSnapshot>, from: { x: number; z: number }, to: { x: number; z: number }) {
  const half = s.scenario.worldSize / 2
  if (![from.x, from.z, to.x, to.z].every(n => Number.isInteger(n) && n >= -half && n < half)) return []
  const cells: Array<{ x: number; z: number }> = []
  for (let z = Math.min(from.z, to.z); z <= Math.max(from.z, to.z); z++)
    for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x++) cells.push({ x, z })
  return cells
}

export function prepareGroundArea(s: GameSnapshot, from: { x: number; z: number }, to: { x: number; z: number }, kind: GroundWork, preview = false) {
  const cells = groundRectangle(s, from, to)
  // A preview must not touch anything the real snapshot shares with it — the books
  // included, since prepareGround books every euro it spends (see bookFinance).
  const target = preview ? { ...s, finance: { loan: s.finance.loan, periods: s.finance.periods.map(period => ({ edition: period.edition, entries: { ...period.entries } })), today: { ...s.finance.today }, previousDay: s.finance.previousDay }, festival: { ...s.festival, infrastructure: { ...s.festival.infrastructure, ground: Object.fromEntries(Object.entries(s.festival.infrastructure.ground).map(([k, v]) => [k, { ...v }])) } } } : s
  const before = target.money
  let changed = 0, reason = 'Ungültige Fläche'
  for (const cell of cells) {
    const result = prepareGround(target, cell.x, cell.z, kind)
    if (result.ok) changed++; else reason = result.message
  }
  const cost = before - target.money, skipped = cells.length - changed
  return { ok: changed > 0, changed, cost, skipped, message: changed ? `${changed} Felder · ${cost} €${skipped ? ` · ${skipped} übersprungen (bereits ausgebaut, ungeeignet oder Budget erschöpft)` : ''}` : reason }
}

export function paintGroundCover(s: GameSnapshot, x: number, z: number, cover: GroundCover) {
  if (!isGroundCover(cover)) return { ok: false, message: 'Unbekannter Untergrund' }
  if (!Number.isInteger(x) || !Number.isInteger(z) || !isInTerrainWorld(x, z, s.scenario.worldSize)) {
    return { ok: false, message: 'Außerhalb des Geländes' }
  }
  const cell = s.festival.infrastructure.ground[groundKey(x, z)] ??= {}
  if (cell.cover === cover) return { ok: false, message: 'Bereits dieser Untergrund' }
  cell.cover = cover
  return { ok: true, message: `${GROUND_COVERS[cover].name}: Feld ${x}, ${z}` }
}

export function paintGroundCoverArea(
  s: GameSnapshot,
  cells: ReadonlyArray<{ x: number; z: number }>,
  cover: GroundCover,
) {
  if (!isGroundCover(cover)) return { ok: false, message: 'Unbekannter Untergrund' }
  let changed = 0
  let reason = 'Außerhalb des Geländes'
  for (const cell of cells) {
    const result = paintGroundCover(s, cell.x, cell.z, cover)
    if (result.ok) changed += 1
    else reason = result.message
  }
  const skipped = cells.length - changed
  return {
    ok: changed > 0,
    changed,
    message: changed
      ? `${GROUND_COVERS[cover].name}: ${changed} Feld${changed === 1 ? '' : 'er'}${skipped ? ` · ${skipped} übersprungen` : ''}`
      : reason,
  }
}
