import { WALL_KINDS, wallSpec, ROOF_KINDS, roofSpec } from './decorationWalls'
import { decorationKindsInCategory } from './decoration'
import type { BuildingKind } from './catalog'

export const SCENERY_KINDS = [
  ...WALL_KINDS, ...ROOF_KINDS,
  'tree', 'hedge', 'shrub', 'flowerbed', 'planter', 'rock', 'statue', 'banner', 'bunting', 'stringLights',
  'hayBale', 'parasol', 'picnicTable', 'festivalSign', 'totem', 'flagPole', 'lanternPole', 'kegStack',
  'inflatable', 'prayerFlags', 'fireBowl',
  'picketFence', 'ropeFence', 'streamers',
  'trafficCone', 'crateStack', 'oilDrum', 'pinwheel', 'windSock',
  'hangingBasket', 'cactusPot', 'gnome', 'windChimes', 'chalkboard',
  'loungeChair', 'beanBag', 'tikiTorch', 'decoSpeaker', 'boombox', 'photoFrame',
  'discoBall', 'inflatableCactus', 'giantMushroom', 'crystalTotem', 'welcomeArch',
  'desertPalm', 'dustLantern', 'playaTotem', 'tumbleweed',
  'forestFern', 'mossLog', 'foxfireLamp', 'woodlandIdol',
  'neonPlant', 'neonArch', 'uvSpeaker', 'glowTape',
  'scrapPlanter', 'palletBench', 'workLamp', 'chainFence',
  'palmTree', 'tikiStool', 'tikiMask', 'coconutPile',
  'altarTable', 'spiritLantern', 'runeStone', 'occultBanner',
  'circusStool', 'carnivalBulbs', 'miniBigTop', 'popcornCart',
  'alpineFir', 'beerGardenTable', 'beerLantern', 'maypole',
  'icePine', 'iceBench', 'auroraLamp', 'iceSculpture', 'snowman', 'iceFence',
  'copperPlanter', 'gearBench', 'gasLamp', 'pipeTotem', 'gearStack', 'pipeRail',
] as const
export function isScenery(kind: string): boolean { return (SCENERY_KINDS as readonly string[]).includes(kind) }
const EDGE_SCENERY_KINDS = [
  ...WALL_KINDS,
  'hedge', 'banner', 'bunting', 'stringLights', 'prayerFlags', 'picketFence', 'ropeFence', 'streamers',
  'glowTape', 'chainFence', 'occultBanner', 'carnivalBulbs', 'iceFence', 'pipeRail',
] as const
export function isEdgeScenery(kind: string): boolean { return (EDGE_SCENERY_KINDS as readonly string[]).includes(kind) }

const PEDESTRIAN_BARRIER_KINDS = new Set<string>([
  'hedge',
  ...decorationKindsInCategory('fence'),
  ...WALL_KINDS.filter((kind) => wallSpec(kind)?.shape !== 'Door'),
])

/** Hedges, Zaun-category pieces and wall segments (not doors) block pedestrians. */
export function isPedestrianBarrierKind(kind: string): boolean {
  return PEDESTRIAN_BARRIER_KINDS.has(kind)
}

/**
 * How a barrier occupies the pedestrian grid.
 * `solid` = whole tile (legacy missing slot or explicit full-tile slot 4).
 * 0–3 = that tile edge only (RCT-like). Classic `fence` uses rotation.
 */
export function pedestrianBarrierOccupancy(item: {
  kind: string
  rotation: number
  decorationSlot?: number
}): 'solid' | 0 | 1 | 2 | 3 | undefined {
  if (!isPedestrianBarrierKind(item.kind)) return undefined
  if (item.kind === 'fence') return (item.rotation & 3) as 0 | 1 | 2 | 3
  if (item.decorationSlot === undefined || item.decorationSlot === 4) return 'solid'
  if (isEdgeScenery(item.kind) && item.decorationSlot >= 0 && item.decorationSlot <= 3) {
    return item.decorationSlot as 0 | 1 | 2 | 3
  }
  return 'solid'
}
export const LARGE_SCENERY_KINDS = [...ROOF_KINDS, 'desertPalm', 'palmTree', 'alpineFir', 'icePine', 'neonArch', 'miniBigTop', 'beerGardenTable', 'altarTable', 'mossLog', 'palletBench', 'iceBench', 'gearBench', 'iceSculpture', 'woodlandIdol', 'playaTotem', 'maypole', 'giantMushroom', 'crystalTotem', 'inflatableCactus', 'parasol', 'loungeChair', 'inflatable', 'popcornCart', 'picnicTable'] as const
export function isLargeScenery(kind: string): boolean { return (LARGE_SCENERY_KINDS as readonly string[]).includes(kind) }
export type SceneryObject = { kind: BuildingKind; rotation: number; decorationSlot?: number }

/** Slots are absolute map positions. Rotation changes orientation, not save coordinates. */
export function scenerySlot(kind: string, localX = .25, localZ = .25, rotation = 0): number | undefined {
  if (!isScenery(kind)) return undefined
  if (isLargeScenery(kind)) return 4
  if (!isEdgeScenery(kind)) return (localX >= .5 ? 1 : 0) + (localZ >= .5 ? 2 : 0)
  const x = localX - .5, z = localZ - .5
  const side = Math.abs(x) > Math.abs(z) ? x > 0 ? 1 : 3 : z > 0 ? 0 : 2
  return (side + rotation) % 4
}

export function sceneryTransform(item: SceneryObject): { x: number; z: number; rotation: number; sx: number; sy: number; sz: number } {
  const slot = item.decorationSlot
  if (slot === undefined || slot === 4 || !isScenery(item.kind)) return { x: .5, z: .5, rotation: item.rotation, sx: 1, sy: 1, sz: 1 }
  if (isEdgeScenery(item.kind)) {
    const angle = slot * Math.PI / 2
    if (wallSpec(item.kind)) return { x: .5 + Math.sin(angle) * .5, z: .5 + Math.cos(angle) * .5, rotation: slot, sx: 1, sy: 1, sz: 1 }
    return { x: .5 + Math.sin(angle) * .39, z: .5 + Math.cos(angle) * .39, rotation: slot, sx: 1, sy: 1, sz: .55 }
  }
  return { x: slot % 2 ? .75 : .25, z: slot >= 2 ? .75 : .25, rotation: item.rotation, sx: .46, sy: item.kind === 'tree' ? .8 : 1, sz: .46 }
}

export function sceneryOverlaps(a: SceneryObject, b: SceneryObject): boolean {
  // Roofs can meet wall tops; their own volumes still collide with other roofs/objects.
  if (roofSpec(a.kind) && wallSpec(b.kind) || roofSpec(b.kind) && wallSpec(a.kind)) return false
  // Facades occupy the tile boundary and may dress an existing building.
  if (wallSpec(a.kind) && !isScenery(b.kind) || wallSpec(b.kind) && !isScenery(a.kind)) return false
  const smallA = isScenery(a.kind) && a.decorationSlot !== undefined && a.decorationSlot !== 4
  const smallB = isScenery(b.kind) && b.decorationSlot !== undefined && b.decorationSlot !== 4
  if (!smallA && !smallB) return true
  if (a.kind === 'path' && smallB && isEdgeScenery(b.kind) || b.kind === 'path' && smallA && isEdgeScenery(a.kind)) return false
  if (!smallA || !smallB) return true
  if (isEdgeScenery(a.kind) && isEdgeScenery(b.kind)) return a.decorationSlot === b.decorationSlot
  if (!isEdgeScenery(a.kind) && !isEdgeScenery(b.kind)) return a.decorationSlot === b.decorationSlot
  const edge = isEdgeScenery(a.kind) ? a : b, point = edge === a ? b : a
  const p = sceneryTransform(point)
  return edge.decorationSlot === 0 ? p.z > .5 : edge.decorationSlot === 1 ? p.x > .5 : edge.decorationSlot === 2 ? p.z < .5 : p.x < .5
}
