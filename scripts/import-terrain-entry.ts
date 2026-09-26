/**
 * Bundled by scripts/import-terrain.mjs. Legal OSM + public DEM only.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  applyElevationGrid,
  applyOsmFeatures,
  clampWorldSize,
  draftToScenarioFile,
  sketchTerrain,
  TERRAIN_SKETCH_PRESETS,
  type TerrainSketchId,
} from '../src/game/terrainImport'
import { serializeScenarioFile } from '../src/game/scenarioFile'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const USER_AGENT = 'HeadlinerTycoon/0.2.8 (terrain-import; OSM+Open-Topo-Data; no Google tiles)'
const OVERPASS = 'https://overpass-api.de/api/interpreter'
const OPENTOPO = 'https://api.opentopodata.org/v1/srtm30m'

function argValue(argv: string[], name: string, fallback = ''): string {
  const index = argv.indexOf(name)
  return index >= 0 && argv[index + 1] ? argv[index + 1]! : fallback
}

function parseBBox(text: string) {
  const parts = text.split(',').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  const [south, west, north, east] = parts
  return { south: south!, west: west!, north: north!, east: east! }
}

function slugOf(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'terrain'
}

function isSketchId(value: string): value is TerrainSketchId {
  return value === 'burning-man' || value === 'rock-am-ring'
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { 'User-Agent': USER_AGENT, ...(init?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`${url} → ${response.status}`)
  return response.json() as Promise<Record<string, unknown>>
}

function overpassQuery(bbox: { south: number; west: number; north: number; east: number }): string {
  const s = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`
  return `[out:json][timeout:40];(
  way["natural"="water"](${s});
  way["waterway"="riverbank"](${s});
  way["landuse"~"grass|meadow|farmland|forest|residential|industrial|commercial|reservoir|salt_pond"](${s});
  way["natural"~"sand|beach|bare_rock|wood|grassland|desert"](${s});
  way["highway"](${s});
  way["leisure"="track"](${s});
  way["sport"="motor"](${s});
);(._;>;);out body;`
}

function osmWays(payload: Record<string, unknown>) {
  const elements = Array.isArray(payload.elements) ? payload.elements : []
  const nodes = new Map<number, { lon: number; lat: number }>()
  for (const el of elements) {
    const row = el as { type?: string; id?: number; lon?: number; lat?: number }
    if (row.type === 'node' && Number.isFinite(row.lon) && Number.isFinite(row.lat)) {
      nodes.set(row.id!, { lon: row.lon!, lat: row.lat! })
    }
  }
  const ways: Array<{ tags: Record<string, string>; nodes: Array<{ lon: number; lat: number }> }> = []
  for (const el of elements) {
    const row = el as { type?: string; nodes?: number[]; tags?: Record<string, string> }
    if (row.type !== 'way' || !row.nodes) continue
    const pts = row.nodes.map((id) => nodes.get(id)).filter((node): node is { lon: number; lat: number } => Boolean(node))
    if (pts.length < 2) continue
    ways.push({ tags: row.tags ?? {}, nodes: pts })
  }
  return ways
}

async function fetchElevation(bbox: { south: number; west: number; north: number; east: number }, step = 8) {
  const locations: Array<{ lon: number; lat: number }> = []
  for (let j = 0; j <= step; j++) {
    for (let i = 0; i <= step; i++) {
      locations.push({
        lat: bbox.south + (j / step) * (bbox.north - bbox.south),
        lon: bbox.west + (i / step) * (bbox.east - bbox.west),
      })
    }
  }
  const samples: Array<{ lon: number; lat: number; elevation: number }> = []
  for (let i = 0; i < locations.length; i += 90) {
    const chunk = locations.slice(i, i + 90)
    const q = chunk.map((p) => `${p.lat},${p.lon}`).join('|')
    const data = await fetchJson(`${OPENTOPO}?locations=${q}`)
    const results = Array.isArray(data.results) ? data.results : []
    for (const row of results) {
      const item = row as { elevation?: number; location?: { lat: number; lng: number } }
      if (Number.isFinite(item.elevation) && item.location) {
        samples.push({ lon: item.location.lng, lat: item.location.lat, elevation: item.elevation! })
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1100))
  }
  return samples
}

export async function runTerrainImportCli(argv = process.argv.slice(2)): Promise<string> {
  const sketch = argValue(argv, '--sketch')
  const preset = argValue(argv, '--preset')
  const named = sketch || preset
  const known = isSketchId(named) ? TERRAIN_SKETCH_PRESETS[named] : null
  const bbox = parseBBox(argValue(argv, '--bbox')) ?? known?.bbox
  const worldSize = clampWorldSize(Number(argValue(argv, '--size', '64')))
  const name = argValue(argv, '--name', known?.name ?? 'Importiertes Gelände')
  const detail = argValue(argv, '--detail', known?.detail ?? 'Gelände aus OpenStreetMap und optionaler öffentlicher Höhendaten.')
  const id = slugOf(argValue(argv, '--id', named || name))
  const out = path.resolve(root, argValue(argv, '--out', `public/scenarios/${id}.json`))
  const wantElevation = argv.includes('--elevation')
  const live = argv.includes('--osm') || Boolean(preset) || Boolean(argValue(argv, '--bbox'))

  let draft = isSketchId(named) ? sketchTerrain(named, worldSize) : sketchTerrain('rock-am-ring', worldSize)
  if (!isSketchId(named)) {
    draft.worldSize = worldSize
    draft.ground = {}
    draft.heights = {}
    draft.environment = 'grassland'
  }

  if (live && bbox) {
    if (!sketch) {
      draft.ground = {}
      draft.heights = {}
      if (known) draft.environment = known.environment
    }
    const payload = await fetchJson(OVERPASS, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: overpassQuery(bbox),
    })
    applyOsmFeatures(draft, osmWays(payload), bbox)
    if (wantElevation) applyElevationGrid(draft, await fetchElevation(bbox), bbox)
  }

  const file = draftToScenarioFile(draft, { id, name, detail })
  await mkdir(path.dirname(out), { recursive: true })
  await writeFile(out, serializeScenarioFile(file), 'utf8')
  console.log(`Wrote ${out} (${Object.keys(draft.ground).length} cover cells, ${Object.keys(draft.heights).length} heights)`)
  return out
}

await runTerrainImportCli()
