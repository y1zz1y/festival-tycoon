import type { Environment } from './environments'
import type { GroundCell, GroundCover } from './ground'
import { groundKey, isGroundCover, normalizeGroundCells } from './ground'
import type { BuildingKind } from './catalog'
import type { PlacedBuilding } from './types/entities'
import {
  SCENARIO_FILE_FORMAT,
  SCENARIO_FILE_KIND,
  type ScenarioFile,
} from './scenarioFile'
import {
  DEFAULT_SCENARIO,
  SCENARIO_WORLD_SIZES,
  type ScenarioWorldSize,
} from './scenario'
import { ENTRANCE_PATH_ID } from './snapshotBootstrap'
import { snapTerrainHeight } from './terrain'
import { de, keep } from '../i18n/marker'

export type TerrainBBox = { south: number; west: number; north: number; east: number }

export type TerrainImportDraft = {
  worldSize: ScenarioWorldSize
  environment: Environment
  unevenness: number
  waterLevel: number
  heights: Record<string, number>
  ground: Record<string, GroundCell>
  buildings: PlacedBuilding[]
}

export type TerrainSketchId = 'burning-man' | 'rock-am-ring'

export const TERRAIN_SKETCH_PRESETS: Record<
  TerrainSketchId,
  { bbox: TerrainBBox; name: string; detail: string; environment: Environment }
> = {
  'burning-man': {
    bbox: { south: 40.764, west: -119.236, north: 40.807, east: -119.176 },
    name: keep('Burning Man · Black Rock City'),
    detail:
      de('Salzpfanne mit Hufeisenstadt und innerer Playastrecke. Das Tor öffnet nach Süden zum Eingang; The Man steht in der Mitte, der Tempel nördlich davon. Wüste, flach, viel Platz für Camps.'),
    environment: 'desert',
  },
  'rock-am-ring': {
    bbox: { south: 50.323, west: 6.916, north: 50.359, east: 6.98 },
    name: keep('Rock am Ring · Nürburgring'),
    detail:
      de('Hügelland mit Nordschleifen-Schleife und GP-Oval im Süden. Das Festivalgelände liegt in der Infield-Wiese am Eingang; Asphalt und Streckenbegrenzung tragen die Form der Rennstrecke.'),
    environment: 'grassland',
  },
}

export type OsmWayClass = { cover?: GroundCover; water?: boolean }

/** Legal OSM tags only — never scrape Google Maps / Earth tiles. */
export function classifyOsmTags(tags: Record<string, string>): OsmWayClass {
  const highway = tags.highway ?? ''
  const landuse = tags.landuse ?? ''
  const natural = tags.natural ?? ''
  const leisure = tags.leisure ?? ''
  const sport = tags.sport ?? ''
  const surface = tags.surface ?? ''
  const waterway = tags.waterway ?? ''
  if (
    natural === 'water' ||
    waterway === 'riverbank' ||
    waterway === 'dock' ||
    landuse === 'reservoir' ||
    landuse === 'basin' ||
    tags.water != null
  ) {
    return { water: true }
  }
  if (
    highway === 'raceway' ||
    (leisure === 'track' && (sport === 'motor' || sport === 'karting')) ||
    highway === 'motorway' ||
    highway === 'trunk' ||
    surface === 'asphalt' ||
    surface === 'concrete'
  ) {
    return { cover: 'asphalt' }
  }
  if (natural === 'sand' || natural === 'beach' || natural === 'dune' || surface === 'sand') {
    return { cover: 'sand' }
  }
  if (natural === 'salt' || landuse === 'salt_pond' || surface === 'salt') return { cover: 'salt' }
  if (natural === 'bare_rock' || natural === 'scree' || natural === 'cliff' || landuse === 'quarry') {
    return { cover: 'rock' }
  }
  if (landuse === 'farmland' || landuse === 'orchard' || landuse === 'vineyard') return { cover: 'field' }
  if (landuse === 'brownfield' || landuse === 'construction' || surface === 'dirt' || surface === 'earth') {
    return { cover: 'earth' }
  }
  if (natural === 'glacier' || landuse === 'snow') return { cover: 'snow' }
  if (
    landuse === 'residential' ||
    landuse === 'industrial' ||
    landuse === 'commercial' ||
    landuse === 'retail' ||
    surface === 'paving_stones' ||
    surface === 'sett'
  ) {
    return { cover: 'stone' }
  }
  if (
    landuse === 'grass' ||
    landuse === 'meadow' ||
    landuse === 'recreation_ground' ||
    natural === 'grassland' ||
    leisure === 'park'
  ) {
    return { cover: 'grass' }
  }
  if (natural === 'desert') return { cover: 'sand' }
  if (highway === 'primary' || highway === 'secondary' || highway === 'tertiary' || highway === 'residential') {
    return { cover: 'asphalt' }
  }
  if (highway === 'path' || highway === 'footway' || highway === 'track' || highway === 'cycleway') {
    return { cover: 'earth' }
  }
  return {}
}

export function lonLatToCell(
  lon: number,
  lat: number,
  bbox: TerrainBBox,
  worldSize: number,
): { x: number; z: number } {
  const half = worldSize / 2
  const u = (lon - bbox.west) / Math.max(1e-9, bbox.east - bbox.west)
  const v = (lat - bbox.south) / Math.max(1e-9, bbox.north - bbox.south)
  return {
    x: Math.floor(-half + u * worldSize),
    z: Math.floor(-half + v * worldSize),
  }
}

export function paintCover(ground: Record<string, GroundCell>, x: number, z: number, cover: GroundCover): void {
  if (!isGroundCover(cover)) return
  const cell = (ground[groundKey(x, z)] ??= {})
  cell.cover = cover
}

function inWorld(x: number, z: number, worldSize: number): boolean {
  const half = worldSize / 2
  return x >= -half && x < half && z >= -half && z < half
}

export function paintDisk(
  ground: Record<string, GroundCell>,
  worldSize: number,
  cx: number,
  cz: number,
  radius: number,
  cover: GroundCover,
): void {
  const r2 = radius * radius
  for (let z = Math.floor(cz - radius); z <= Math.ceil(cz + radius); z++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      if (!inWorld(x, z, worldSize)) continue
      if ((x - cx) * (x - cx) + (z - cz) * (z - cz) <= r2) paintCover(ground, x, z, cover)
    }
  }
}

export function paintRing(
  ground: Record<string, GroundCell>,
  worldSize: number,
  cx: number,
  cz: number,
  inner: number,
  outer: number,
  cover: GroundCover,
  include?: (x: number, z: number) => boolean,
): void {
  const outer2 = outer * outer
  const inner2 = inner * inner
  for (let z = Math.floor(cz - outer); z <= Math.ceil(cz + outer); z++) {
    for (let x = Math.floor(cx - outer); x <= Math.ceil(cx + outer); x++) {
      if (!inWorld(x, z, worldSize)) continue
      const d2 = (x - cx) * (x - cx) + (z - cz) * (z - cz)
      if (d2 > outer2 || d2 < inner2) continue
      if (include && !include(x, z)) continue
      paintCover(ground, x, z, cover)
    }
  }
}

export function paintPolyline(
  ground: Record<string, GroundCell>,
  worldSize: number,
  points: ReadonlyArray<{ x: number; z: number }>,
  width: number,
  cover: GroundCover,
): void {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) * 2))
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      paintDisk(ground, worldSize, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, width, cover)
    }
  }
}

export function rasterizeCells(
  nodes: ReadonlyArray<{ lon: number; lat: number }>,
  bbox: TerrainBBox,
  worldSize: number,
  width: number,
): Array<{ x: number; z: number }> {
  const cells = new Map<string, { x: number; z: number }>()
  const projected = nodes.map((node) => lonLatToCell(node.lon, node.lat, bbox, worldSize))
  for (let i = 0; i < projected.length - 1; i++) {
    const a = projected[i]!, b = projected[i + 1]!
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) * 2))
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const cx = a.x + (b.x - a.x) * t
      const cz = a.z + (b.z - a.z) * t
      for (let z = Math.round(cz - width); z <= Math.round(cz + width); z++) {
        for (let x = Math.round(cx - width); x <= Math.round(cx + width); x++) {
          if (!inWorld(x, z, worldSize)) continue
          if (Math.hypot(x - cx, z - cz) > width + 0.35) continue
          cells.set(groundKey(x, z), { x, z })
        }
      }
    }
  }
  return [...cells.values()]
}

function entranceBuilding(worldSize: number): PlacedBuilding {
  return {
    id: ENTRANCE_PATH_ID,
    kind: 'path',
    x: 3,
    z: -worldSize / 2,
    rotation: 0,
    elevation: 0,
    pathType: 'normal',
    pathSlope: 0,
    pathSlopeDirection: 0,
    price: 0,
  }
}

function sceneryAt(
  id: string,
  kind: BuildingKind,
  x: number,
  z: number,
  rotation = 0,
  decorationSlot?: number,
): PlacedBuilding {
  return { id, kind, x, z, rotation, elevation: 0, price: 0, ...(decorationSlot !== undefined ? { decorationSlot } : {}) }
}

function emptyDraft(worldSize: ScenarioWorldSize, environment: Environment, unevenness: number): TerrainImportDraft {
  return {
    worldSize,
    environment,
    unevenness,
    waterLevel: -0.5,
    heights: {},
    ground: {},
    buildings: [entranceBuilding(worldSize)],
  }
}

/** Gate toward −Z (map entrance). City occupies the remaining 240°. */
export function blackRockCitySector(x: number, z: number, cx = 0, cz = 2): boolean {
  return Math.abs(Math.atan2(x - cx, -(z - cz))) >= Math.PI / 3
}

export function sketchBurningMan(worldSize: ScenarioWorldSize = 64): TerrainImportDraft {
  const draft = emptyDraft(worldSize, 'desert', 0)
  const { ground, buildings } = draft
  const half = worldSize / 2
  for (let z = -half; z < half; z++) {
    for (let x = -half; x < half; x++) paintCover(ground, x, z, 'salt')
  }
  const cx = 0, cz = 2
  paintRing(ground, worldSize, cx, cz, 8, 9.4, 'asphalt')
  for (const radius of [12, 15, 18, 21]) {
    paintRing(ground, worldSize, cx, cz, radius - 0.35, radius + 0.55, 'asphalt', (x, z) =>
      blackRockCitySector(x, z, cx, cz),
    )
  }
  for (let deg = 70; deg <= 290; deg += 15) {
    const a = (deg * Math.PI) / 180
    const inner = 11.2
    const outer = 22
    paintPolyline(
      ground,
      worldSize,
      [
        { x: cx + Math.sin(a) * inner, z: cz - Math.cos(a) * inner },
        { x: cx + Math.sin(a) * outer, z: cz - Math.cos(a) * outer },
      ],
      0.45,
      'asphalt',
    )
  }
  paintRing(ground, worldSize, cx, cz, 25.2, 26.2, 'stone', (x, z) => blackRockCitySector(x, z, cx, cz) || z > cz)
  buildings.push(
    sceneryAt('the-man', 'playaTotem', cx, cz, 0, 4),
    sceneryAt('the-temple', 'playaTotem', cx, cz + 12, 2, 4),
    sceneryAt('gate-lantern-a', 'dustLantern', 2, -18, 0),
    sceneryAt('gate-lantern-b', 'dustLantern', 4, -18, 0),
  )
  return draft
}

export function sketchRockAmRing(worldSize: ScenarioWorldSize = 64): TerrainImportDraft {
  const draft = emptyDraft(worldSize, 'grassland', 0.35)
  const { ground, heights, buildings } = draft
  const nordschleife: Array<{ x: number; z: number }> = [
    { x: 6, z: -8 }, { x: 10, z: 0 }, { x: 16, z: 8 }, { x: 12, z: 18 },
    { x: 0, z: 22 }, { x: -12, z: 18 }, { x: -18, z: 8 }, { x: -16, z: -2 },
    { x: -8, z: 4 }, { x: -4, z: 12 }, { x: 4, z: 14 }, { x: 14, z: 4 },
    { x: 8, z: -6 }, { x: 6, z: -8 },
  ]
  const gpOval: Array<{ x: number; z: number }> = [
    { x: -8, z: -18 }, { x: 4, z: -20 }, { x: 8, z: -14 }, { x: 2, z: -10 },
    { x: -10, z: -12 }, { x: -8, z: -18 },
  ]
  paintPolyline(ground, worldSize, nordschleife, 1.05, 'asphalt')
  paintPolyline(ground, worldSize, gpOval, 1.15, 'asphalt')
  paintDisk(ground, worldSize, -2, -16, 5.5, 'grass')
  for (let z = 6; z < 24; z++) {
    for (let x = -10; x < 14; x++) {
      if (!inWorld(x, z, worldSize)) continue
      const rise = Math.min(2, 0.5 + Math.floor((z - 6) / 6) * 0.5)
      if (ground[groundKey(x, z)]?.cover === 'asphalt') continue
      heights[groundKey(x, z)] = snapTerrainHeight(rise)
      if ((x + z) % 7 === 0) paintCover(ground, x, z, 'rock')
    }
  }
  const curbSpots = [
    { x: 10, z: 0, r: 1 }, { x: 12, z: 18, r: 0 }, { x: -18, z: 8, r: 3 },
    { x: -8, z: 4, r: 2 }, { x: 8, z: -14, r: 0 }, { x: -10, z: -12, r: 1 },
    { x: 16, z: 8, r: 3 }, { x: 0, z: 22, r: 2 },
  ]
  curbSpots.forEach((spot, index) => {
    buildings.push(sceneryAt(`curb-${index}`, 'trackCurb', spot.x, spot.z, spot.r, spot.r))
  })
  buildings.push(sceneryAt('paddock-cone', 'trafficCone', -4, -15, 0))
  return draft
}

export function sketchTerrain(id: TerrainSketchId, worldSize: ScenarioWorldSize = 64): TerrainImportDraft {
  return id === 'burning-man' ? sketchBurningMan(worldSize) : sketchRockAmRing(worldSize)
}

export function applyOsmFeatures(
  draft: TerrainImportDraft,
  features: ReadonlyArray<{ tags: Record<string, string>; nodes: Array<{ lon: number; lat: number }> }>,
  bbox: TerrainBBox,
): void {
  const { ground, heights, worldSize } = draft
  for (const feature of features) {
    const classified = classifyOsmTags(feature.tags)
    const width = classified.water ? 1.2 : classified.cover === 'asphalt' ? 0.85 : 1.4
    const cells = rasterizeCells(feature.nodes, bbox, worldSize, width)
    for (const cell of cells) {
      if (classified.water) {
        heights[groundKey(cell.x, cell.z)] = snapTerrainHeight(-1)
        continue
      }
      if (classified.cover) paintCover(ground, cell.x, cell.z, classified.cover)
    }
  }
}

export function applyElevationGrid(
  draft: TerrainImportDraft,
  samples: ReadonlyArray<{ lon: number; lat: number; elevation: number }>,
  bbox: TerrainBBox,
): void {
  if (samples.length === 0) return
  const finite = samples.filter((sample) => Number.isFinite(sample.elevation))
  if (finite.length === 0) return
  const min = Math.min(...finite.map((sample) => sample.elevation))
  const max = Math.max(...finite.map((sample) => sample.elevation))
  const span = Math.max(8, max - min)
  const half = draft.worldSize / 2
  for (let z = -half; z < half; z++) {
    for (let x = -half; x < half; x++) {
      const u = (x + half + 0.5) / draft.worldSize
      const v = (z + half + 0.5) / draft.worldSize
      const lon = bbox.west + u * (bbox.east - bbox.west)
      const lat = bbox.south + v * (bbox.north - bbox.south)
      let nearest = finite[0]!, best = Infinity
      for (const sample of finite) {
        const d = (sample.lon - lon) ** 2 + (sample.lat - lat) ** 2
        if (d < best) { best = d; nearest = sample }
      }
      const lifted = snapTerrainHeight(((nearest.elevation - min) / span) * 3)
      if (lifted !== 0 && draft.heights[groundKey(x, z)] === undefined) {
        draft.heights[groundKey(x, z)] = lifted
      }
    }
  }
}

export function clampWorldSize(value: number): ScenarioWorldSize {
  return SCENARIO_WORLD_SIZES.includes(value as ScenarioWorldSize)
    ? (value as ScenarioWorldSize)
    : 64
}

export function draftToScenarioFile(
  draft: TerrainImportDraft,
  meta: { id: string; name: string; detail: string },
): ScenarioFile {
  normalizeGroundCells(draft.ground)
  return {
    kind: SCENARIO_FILE_KIND,
    format: SCENARIO_FILE_FORMAT,
    id: meta.id,
    name: meta.name,
    detail: meta.detail,
    settings: {
      ...DEFAULT_SCENARIO,
      environment: draft.environment,
      unevenness: draft.unevenness,
      worldSize: draft.worldSize,
      startingMoney: draft.environment === 'desert' ? 18_000 : 16_000,
      startingLoan: 0,
      partyAffinity: 0.75,
      beautyAffinity: draft.environment === 'desert' ? 0.4 : 0.45,
      carArrivalShare: draft.environment === 'desert' ? 0.55 : 0.9,
      goals: [{ kind: 'admissions', target: 700, edition: 3 }],
      title: meta.name,
      detail: meta.detail,
      preset: meta.id,
    },
    tickets: { day: 120, camping: 40 },
    world: {
      version: 34,
      waterLevel: draft.waterLevel,
      terrain: { heights: draft.heights },
      buildings: draft.buildings,
      festival: { infrastructure: { ground: draft.ground } },
    } as ScenarioFile['world'],
  }
}

export function importedGroundOf(world: ScenarioFile['world']): Record<string, GroundCell> | undefined {
  return world?.festival?.infrastructure?.ground
}
