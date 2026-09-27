import type { Environment } from './environments'
import type { WayType } from './wayTypes'
import { wayInfo } from './wayTypes'
import type { GameSnapshot } from './GameState'
import { getTerrainHeight, isInTerrainWorld } from './terrain'
import { bookFinance, canAfford } from './finance'
import { de, named, num, eur, plural } from '../i18n/marker'

export type GroundWork = 'drain' | 'compact' | 'gravel' | 'pave'
/** Paintable looks. `substrate` remaps only types that already had nav/speed costs. */
export const GROUND_COVERS = {
  grass: { name: de('Rasen'), material: 'grass', substrate: 'grass' },
  sand: { name: de('Sand'), material: 'sand', substrate: 'sand' },
  stone: { name: de('Stein'), material: 'stone' },
  field: { name: de('Acker'), material: 'field', substrate: 'field' },
  snow: { name: de('Schnee'), material: 'snow' },
  rock: { name: de('Felsen'), material: 'rock' },
  earth: { name: de('Braune Erde'), material: 'earth', substrate: 'clay' },
  salt: { name: de('Salzpfanne'), material: 'salt', substrate: 'sand' },
  asphalt: { name: de('Asphalt'), material: 'asphalt' },
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
  drain: { name: de('Entwässern'), cost: 35 }, compact: { name: de('Verdichten'), cost: 25 },
  gravel: { name: de('Schotterdecke'), cost: 45 }, pave: { name: de('Pflastern / Fundament'), cost: 90 },
}
/** One sentence per cover: a leading name slot would leave the key without a literal edge (I18N-B9). */
const COVER_PAINTED: Record<GroundCover, (x: number, z: number) => string> = {
  grass: (x, z) => de`Rasen: Feld ${num(x)}, ${num(z)}`,
  sand: (x, z) => de`Sand: Feld ${num(x)}, ${num(z)}`,
  stone: (x, z) => de`Stein: Feld ${num(x)}, ${num(z)}`,
  field: (x, z) => de`Acker: Feld ${num(x)}, ${num(z)}`,
  snow: (x, z) => de`Schnee: Feld ${num(x)}, ${num(z)}`,
  rock: (x, z) => de`Felsen: Feld ${num(x)}, ${num(z)}`,
  earth: (x, z) => de`Braune Erde: Feld ${num(x)}, ${num(z)}`,
  salt: (x, z) => de`Salzpfanne: Feld ${num(x)}, ${num(z)}`,
  asphalt: (x, z) => de`Asphalt: Feld ${num(x)}, ${num(z)}`,
}
export const GROUND_COVER_IDS = Object.keys(GROUND_COVERS) as GroundCover[]
export function isGroundCover(value: unknown): value is GroundCover {
  return typeof value === 'string' && value in GROUND_COVERS
}
const COVER_FROM_TOOL: Record<string, GroundCover> = {
  terrainCoverGrass: 'grass',
  terrainCoverSand: 'sand',
  terrainCoverStone: 'stone',
  terrainCoverField: 'field',
  terrainCoverSnow: 'snow',
  terrainCoverRock: 'rock',
  terrainCoverEarth: 'earth',
  terrainCoverSalt: 'salt',
  terrainCoverAsphalt: 'asphalt',
}
export function groundCoverFromTool(tool: string): GroundCover | null {
  return COVER_FROM_TOOL[tool] ?? null
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
  if (!Number.isInteger(x) || !Number.isInteger(z) || !isInTerrainWorld(x, z, s.scenario.worldSize)) return fail(de('Außerhalb des Geländes'))
  if (getTerrainHeight(s.terrain, x, z) < 0) return fail(de('Zuerst Wasser und Senken mit dem Geländewerkzeug aufarbeiten'))
  const offer = GROUND_WORK[kind], info = groundInfo(s, x, z)
  if (!offer) return fail(de('Unbekannte Bodenarbeit'))
  if ((kind === 'drain' && info.drained) || (kind === 'compact' && info.compacted) || (kind === 'gravel' && info.surface) || (kind === 'pave' && info.surface === 'paved')) return fail(de('Bereits ausgebaut'))
  if (kind === 'compact' && info.type === 'clay' && !info.drained) return fail(de('Lehmboden zuerst entwässern'))
  if (kind === 'gravel' && info.bearing < 2) return fail(de('Zuerst den Untergrund verdichten'))
  if (kind === 'pave' && (!info.drained || info.bearing < 2)) return fail(de('Fundament braucht Entwässerung und tragfähigen Untergrund'))
  if (!canAfford(s, offer.cost)) return fail(de('Nicht genug Geld für die Bodenarbeit'))
  bookFinance(s, 'landscaping', -offer.cost)
  const cell = s.festival.infrastructure.ground[groundKey(x, z)] ??= {}
  if (kind === 'drain') cell.drained = true
  if (kind === 'compact') cell.compacted = true
  if (kind === 'gravel' || kind === 'pave') cell.surface = kind === 'pave' ? 'paved' : 'gravel'
  return { ok: true, message: de`${named(offer.name)}: Feld ${num(x)}, ${num(z)} ausgebaut` }
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
  let changed = 0, reason: string = de('Ungültige Fläche')
  for (const cell of cells) {
    const result = prepareGround(target, cell.x, cell.z, kind)
    if (result.ok) changed++; else reason = result.message
  }
  const cost = before - target.money, skipped = cells.length - changed
  return { ok: changed > 0, changed, cost, skipped, message: changed ? groundAreaMessage(changed, cost, skipped) : reason }
}

/** One template per variant (docs/i18n.md): the trailing amount needs a literal after it (I18N-B9). */
function groundAreaMessage(changed: number, cost: number, skipped: number): string {
  return skipped
    ? plural(changed, de`${num(changed)} Feld · ${eur(cost)} Kosten · ${num(skipped)} übersprungen (bereits ausgebaut, ungeeignet oder Budget erschöpft)`, de`${num(changed)} Felder · ${eur(cost)} Kosten · ${num(skipped)} übersprungen (bereits ausgebaut, ungeeignet oder Budget erschöpft)`)
    : plural(changed, de`${num(changed)} Feld · ${eur(cost)} Kosten`, de`${num(changed)} Felder · ${eur(cost)} Kosten`)
}

export function paintGroundCover(s: GameSnapshot, x: number, z: number, cover: GroundCover) {
  if (!isGroundCover(cover)) return { ok: false, message: de('Unbekannter Untergrund') }
  if (!Number.isInteger(x) || !Number.isInteger(z) || !isInTerrainWorld(x, z, s.scenario.worldSize)) {
    return { ok: false, message: de('Außerhalb des Geländes') }
  }
  const cell = s.festival.infrastructure.ground[groundKey(x, z)] ??= {}
  if (cell.cover === cover) return { ok: false, message: de('Bereits dieser Untergrund') }
  cell.cover = cover
  return { ok: true, message: COVER_PAINTED[cover](x, z) }
}

export function paintGroundCoverArea(
  s: GameSnapshot,
  cells: ReadonlyArray<{ x: number; z: number }>,
  cover: GroundCover,
) {
  if (!isGroundCover(cover)) return { ok: false, message: de('Unbekannter Untergrund') }
  let changed = 0
  let reason: string = de('Außerhalb des Geländes')
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
      ? coverAreaMessage(GROUND_COVERS[cover].name, changed, skipped)
      : reason,
  }
}

function coverAreaMessage(name: string, changed: number, skipped: number): string {
  return skipped
    ? plural(changed, de`${named(name)}: ${num(changed)} Feld · ${num(skipped)} übersprungen`, de`${named(name)}: ${num(changed)} Felder · ${num(skipped)} übersprungen`)
    : plural(changed, de`${named(name)}: ${num(changed)} Feld`, de`${named(name)}: ${num(changed)} Felder`)
}
