import { WALL_KINDS, WALL_SHAPES, wallSpec, ROOF_KINDS, roofSpec, THEMED_BIN_KINDS, binSpec } from './decorationWalls'
import { SIMULATION_CONFIG } from './simulationConfig'
import type { GhostRenderMode } from './placementPreview'
import { de, named } from '../i18n/marker'

export const BUILDING_KINDS = [
  ...WALL_KINDS, ...ROOF_KINDS, ...THEMED_BIN_KINDS,
  'path',
  'food',
  'toilet',
  'waterPoint',
  'shower',
  'ride',
  'alcohol',
  'mascot',
  'shirt',
  'securityGate',
  'tree',
  'hedge',
  'shrub',
  'flowerbed',
  'planter',
  'rock',
  'statue',
  'banner',
  'bunting', 'stringLights', 'hayBale', 'parasol', 'picnicTable', 'festivalSign',
  'totem', 'flagPole', 'lanternPole', 'kegStack', 'inflatable', 'prayerFlags', 'fireBowl',
  'picketFence', 'ropeFence', 'streamers',
  'trafficCone', 'crateStack', 'oilDrum', 'pinwheel', 'windSock',
  'hangingBasket', 'cactusPot', 'gnome', 'windChimes', 'chalkboard',
  'loungeChair', 'beanBag', 'tikiTorch', 'decoSpeaker', 'boombox', 'photoFrame',
  'discoBall', 'inflatableCactus', 'giantMushroom', 'crystalTotem', 'welcomeArch',
  'desertPalm', 'dustLantern', 'playaTotem', 'tumbleweed',
  'forestFern', 'mossLog', 'foxfireLamp', 'woodlandIdol',
  'neonPlant', 'neonArch', 'uvSpeaker', 'glowTape',
  'scrapPlanter', 'palletBench', 'workLamp', 'chainFence', 'trackCurb',
  'palmTree', 'tikiStool', 'tikiMask', 'coconutPile',
  'altarTable', 'spiritLantern', 'runeStone', 'occultBanner',
  'circusStool', 'carnivalBulbs', 'miniBigTop', 'popcornCart',
  'alpineFir', 'beerGardenTable', 'beerLantern', 'maypole',
  'icePine', 'iceBench', 'auroraLamp', 'iceSculpture', 'snowman', 'iceFence',
  'copperPlanter', 'gearBench', 'gasLamp', 'pipeTotem', 'gearStack', 'pipeRail',
  'fence',
  'bench',
  'table',
  'lighting',
  'lightBalloon',
  'stage',
  'directionalSpeaker',
  'omniSpeaker',
  'ambulanceGarage',
  'fireStation',
  'busStop',
  'busDepot',
  'wasteDepot',
  'specialDepot',
  'wasteBin',
  'sealedWasteContainer',
  'generator',
  'backupGenerator',
  'foh',
  'delayTower',
  'videoWall',
  'laserShow',
  'fireworkBattery',
  'tourBusParking',
  'bandFridge',
  'backstageCouch2',
  'backstageCouch3',
  'backstageToilet',
] as const

export type BuildingKind = (typeof BUILDING_KINDS)[number]
export type Tool =
  | BuildingKind
  | 'camping'
  | 'medicalArea'
  | 'wasteDump'
  | 'stageForecourt'
  | 'backstageArea'
  | 'road'
  | 'parkingArea'
  | 'roadDirection'
  | 'roadDirectionClear'
  | 'trafficLight'
  | 'pathBarrier'
  | 'roadSeparator'
  | 'roadSpeed10'
  | 'roadSpeed30'
  | 'roadSpeed50'
  | 'crosswalk'
  | 'deliveryYard'
  | 'supplyDepot'
  | 'staffGate'
  | 'coaster'
  | 'course'
  | 'terrainRaise'
  | 'terrainLower'
  | 'terrainFlatten'
  | 'terrainRaiseCorner'
  | 'terrainLowerCorner'
  | 'terrainWater'
  | 'terrainSmooth'
  | 'terrainCoverGrass'
  | 'terrainCoverSand'
  | 'terrainCoverStone'
  | 'terrainCoverField'
  | 'terrainCoverSnow'
  | 'terrainCoverRock'
  | 'terrainCoverEarth'
  | 'terrainCoverSalt'
  | 'terrainCoverAsphalt'
  | 'powerCable'
  | 'bulldoze'
  | 'copy'
  | 'inspect'

/** Straßen window and overlays: occupancy/P helpers stay here, not in the default camera. */
export const ROAD_BUILD_TOOLS = [
  'road',
  'parkingArea',
  'roadDirection',
  'roadDirectionClear',
  'trafficLight',
  'pathBarrier',
  'roadSeparator',
  'crosswalk',
  'roadSpeed10',
  'roadSpeed30',
  'roadSpeed50',
] as const satisfies readonly Tool[]

export function isRoadBuildTool(tool: string | undefined): boolean {
  return (ROAD_BUILD_TOOLS as readonly string[]).includes(tool ?? '')
}

export const TERRAIN_EDIT_TOOLS = [
  'terrainRaise',
  'terrainLower',
  'terrainSmooth',
] as const satisfies readonly Tool[]

export function isTerrainEditTool(tool: string | undefined): boolean {
  return (TERRAIN_EDIT_TOOLS as readonly string[]).includes(tool ?? '')
}

export const TERRAIN_COVER_TOOLS = [
  'terrainCoverGrass',
  'terrainCoverSand',
  'terrainCoverStone',
  'terrainCoverField',
  'terrainCoverSnow',
  'terrainCoverRock',
  'terrainCoverEarth',
  'terrainCoverSalt',
  'terrainCoverAsphalt',
] as const satisfies readonly Tool[]

export function isTerrainCoverTool(tool: string | undefined): boolean {
  return (TERRAIN_COVER_TOOLS as readonly string[]).includes(tool ?? '')
}

export function isCopyTool(tool: string | undefined): boolean {
  return tool === 'copy'
}

export type BuildingDefinition = {
  kind: BuildingKind
  name: string
  cost: number
  upkeep: number
  capacity: number
  appeal: number
  height: number
  defaultPrice: number
  color: number
  icon: string
}

/** Style label plus shape, one complete canonical template per shape (docs/i18n.md). */
const WALL_NAMES: Record<(typeof WALL_SHAPES)[number], (label: string) => string> = {
  Full: label => de`${named(label)} · Wand`,
  Half: label => de`${named(label)} · Halbwand`,
  Window: label => de`${named(label)} · Fensterwand`,
  Door: label => de`${named(label)} · Türbogen`,
  SlopeLeft: label => de`${named(label)} · Dachkeil links hoch`,
  SlopeRight: label => de`${named(label)} · Dachkeil rechts hoch`,
  RoofEnd: label => de`${named(label)} · Dachabschluss hoch`,
}

export const BUILDINGS: Record<BuildingKind, BuildingDefinition> = {
  ...Object.fromEntries(ROOF_KINDS.map(kind => {
    const spec = roofSpec(kind)!
    return [kind, { kind, name: spec.slope ? de`${named(spec.label)} · Schrägdach` : de`${named(spec.label)} · Flachdach`, ...SIMULATION_CONFIG.economy.decorationWalls, height: spec.height, color: spec.color, icon: '⌂' }]
  })) as Record<typeof ROOF_KINDS[number], BuildingDefinition>,
  ...Object.fromEntries(THEMED_BIN_KINDS.map(kind => {
    const spec = binSpec(kind)!
    return [kind, { kind, name: de`${named(spec.label)} · Mülleimer`, ...SIMULATION_CONFIG.economy.buildings.wasteBin, height: .5, color: spec.color, icon: '♻' }]
  })) as Record<typeof THEMED_BIN_KINDS[number], BuildingDefinition>,
  ...Object.fromEntries(WALL_KINDS.map(kind => {
    const spec = wallSpec(kind)!
    return [kind, { kind, name: WALL_NAMES[spec.shape](spec.label), ...SIMULATION_CONFIG.economy.decorationWalls, height: spec.height, color: spec.color, icon: '▥' }]
  })) as Record<typeof WALL_KINDS[number], BuildingDefinition>,
  path: {
    kind: 'path',
    name: de('Weg'),
    ...SIMULATION_CONFIG.economy.buildings.path,
    height: 0.12,
    color: 0xc9b48a,
    icon: '▦',
  },
  food: {
    kind: 'food',
    name: de('Imbiss'),
    ...SIMULATION_CONFIG.economy.buildings.food,
    height: 0.95,
    color: 0xf6a623,
    icon: '🍔',
  },
  toilet: {
    kind: 'toilet',
    name: de('Toilette'),
    ...SIMULATION_CONFIG.economy.buildings.toilet,
    height: 0.95,
    color: 0x55a7dc,
    icon: 'WC',
  },
  waterPoint: {
    kind: 'waterPoint',
    name: de('Trinkwasserstelle'),
    ...SIMULATION_CONFIG.economy.buildings.waterPoint,
    height: 0.9,
    color: 0x3f9bd6,
    icon: '🚰',
  },
  shower: {
    kind: 'shower',
    name: de('Duschen'),
    ...SIMULATION_CONFIG.economy.buildings.shower,
    height: 1.2,
    color: 0x6cc4d8,
    icon: '🚿',
  },
  ride: {
    kind: 'ride',
    name: de('Karussell'),
    ...SIMULATION_CONFIG.economy.buildings.ride,
    height: 1.5,
    color: 0xd64f8f,
    icon: '🎠',
  },
  alcohol: {
    kind: 'alcohol',
    name: de('Getränkestand'),
    ...SIMULATION_CONFIG.economy.buildings.alcohol,
    height: 1.05,
    color: 0x8f5fc7,
    icon: '🍺',
  },
  mascot: {
    kind: 'mascot',
    name: de('Maskottchen-Stand'),
    ...SIMULATION_CONFIG.economy.buildings.mascot,
    height: 1.05,
    color: 0xe8a07a,
    icon: '🧸',
  },
  shirt: {
    kind: 'shirt',
    name: de('T-Shirt-Stand'),
    ...SIMULATION_CONFIG.economy.buildings.shirt,
    height: 1.05,
    color: 0x2f6fdb,
    icon: '👕',
  },
  securityGate: {
    kind: 'securityGate',
    name: de('Festival-Einlass'),
    ...SIMULATION_CONFIG.economy.buildings.securityGate,
    height: 1.35,
    color: 0x344e72,
    icon: '🎟️',
  },
  tree: {
    kind: 'tree',
    name: de('Baum'),
    ...SIMULATION_CONFIG.economy.buildings.tree,
    height: 1.8,
    color: 0x4d8b46,
    icon: '🌳',
  },
  hedge: {
    kind: 'hedge',
    name: de('Hecke'),
    ...SIMULATION_CONFIG.economy.buildings.hedge,
    height: 0.55,
    color: 0x3f7b42,
    icon: '🌿',
  },
  fence: {
    kind: 'fence',
    name: de('Bauzaun'),
    ...SIMULATION_CONFIG.economy.buildings.fence,
    height: 1.15,
    color: 0xe67a22,
    icon: '🚧',
  },
  bench: {
    kind: 'bench',
    name: de('Parkbank'),
    ...SIMULATION_CONFIG.economy.buildings.bench,
    height: 0.55,
    color: 0x98643c,
    icon: '🪑',
  },
  table: {
    kind: 'table',
    name: de('Tisch'),
    ...SIMULATION_CONFIG.economy.buildings.table,
    height: 0.72,
    color: 0xb07a48,
    icon: '🪵',
  },
  lighting: {
    kind: 'lighting',
    name: de('Beleuchtung'),
    ...SIMULATION_CONFIG.economy.buildings.lighting,
    height: 1.75,
    color: 0xf0c75e,
    icon: '💡',
  },
  lightBalloon: {
    kind: 'lightBalloon',
    name: de('Tageslichtballon'),
    ...SIMULATION_CONFIG.economy.buildings.lightBalloon,
    height: 3.1,
    color: 0xf4f7ff,
    icon: '⚪',
  },
  stage: {
    kind: 'stage',
    name: de('Festivalbühne'),
    ...SIMULATION_CONFIG.economy.buildings.stage,
    height: 2.2,
    color: 0x583b72,
    icon: '🎤',
  },
  directionalSpeaker: {
    kind: 'directionalSpeaker',
    name: de('Gerichteter Lautsprecher'),
    ...SIMULATION_CONFIG.economy.buildings.directionalSpeaker,
    height: 1.5,
    color: 0x292b32,
    icon: '🔊',
  },
  omniSpeaker: {
    kind: 'omniSpeaker',
    name: de('Omnidirektionaler Lautsprecher'),
    ...SIMULATION_CONFIG.economy.buildings.omniSpeaker,
    height: 1.35,
    color: 0x383a43,
    icon: '📢',
  },
  ambulanceGarage: {
    kind: 'ambulanceGarage',
    name: de('Krankenwagengarage'),
    ...SIMULATION_CONFIG.economy.buildings.ambulanceGarage,
    height: 1.7,
    color: 0xe8ecef,
    icon: '🚑',
  },
  fireStation: {
    kind: 'fireStation',
    name: de('Feuerwache'),
    ...SIMULATION_CONFIG.economy.buildings.fireStation,
    height: 1.7,
    color: 0xc94135,
    icon: '🚒',
  },
  busStop: {
    kind: 'busStop',
    name: de('Bushaltestelle'),
    ...SIMULATION_CONFIG.economy.buildings.busStop,
    height: 1.2,
    color: 0x4e83b8,
    icon: '🚏',
  },
  busDepot: {
    kind: 'busDepot',
    name: de('Busdepot'),
    ...SIMULATION_CONFIG.economy.buildings.busDepot,
    height: 1.8,
    color: 0x546575,
    icon: '🚌',
  },
  wasteDepot: {
    kind: 'wasteDepot',
    name: de('Mülldepot'),
    ...SIMULATION_CONFIG.economy.buildings.wasteDepot,
    height: 1.65,
    color: 0x4a5a3a,
    icon: '🚛',
  },
  specialDepot: {
    kind: 'specialDepot',
    name: de('Betriebshof'),
    ...SIMULATION_CONFIG.economy.buildings.specialDepot,
    height: 1.7,
    color: 0x5a6a72,
    icon: '🧹',
  },
  wasteBin: {
    kind: 'wasteBin',
    name: de('Mülleimer'),
    ...SIMULATION_CONFIG.economy.buildings.wasteBin,
    height: 0.75,
    color: 0x3f4a3a,
    icon: '🗑️',
  },
  sealedWasteContainer: {
    kind: 'sealedWasteContainer',
    name: de('Müllcontainer'),
    ...SIMULATION_CONFIG.economy.buildings.sealedWasteContainer,
    height: 1.15,
    color: 0x3a4a38,
    icon: '🛢️',
  },
  generator: {
    kind: 'generator',
    name: de('Stromgenerator'),
    ...SIMULATION_CONFIG.economy.buildings.generator,
    height: 1.45,
    color: 0xd4a017,
    icon: '⚡',
  },
  backupGenerator: {
    kind: 'backupGenerator',
    name: de('Notstromaggregat'),
    ...SIMULATION_CONFIG.economy.buildings.backupGenerator,
    height: 1.2,
    color: 0xb8860b,
    icon: '🔋',
  },
  foh: {
    kind: 'foh',
    name: de('FOH-Pult'),
    ...SIMULATION_CONFIG.economy.buildings.foh,
    height: 1.35,
    color: 0x2c333a,
    icon: '🎛️',
  },
  delayTower: {
    kind: 'delayTower',
    name: de('Delay-Tower'),
    ...SIMULATION_CONFIG.economy.buildings.delayTower,
    height: 2.4,
    color: 0x1f2430,
    icon: '🗼',
  },
  videoWall: {
    kind: 'videoWall',
    name: de('LED-Wand'),
    ...SIMULATION_CONFIG.economy.buildings.videoWall,
    height: 2.1,
    color: 0x1a4d8f,
    icon: '📺',
  },
  laserShow: {
    kind: 'laserShow',
    name: de('Lasershow'),
    ...SIMULATION_CONFIG.economy.buildings.laserShow,
    height: 1.8,
    color: 0x2ee6a6,
    icon: '✳️',
  },
  tourBusParking: {
    kind: 'tourBusParking',
    name: de('Parkplatz für den Tourbus'),
    ...SIMULATION_CONFIG.economy.buildings.tourBusParking,
    height: 0.28,
    color: 0x3c4247,
    icon: '🚌',
  },
  bandFridge: {
    kind: 'bandFridge',
    name: de('Bandkühlschrank'),
    ...SIMULATION_CONFIG.economy.buildings.bandFridge,
    height: 0.95,
    color: 0xd7dbd4,
    icon: '🧊',
  },
  backstageCouch2: {
    kind: 'backstageCouch2',
    name: de('Backstage-Couch (2er)'),
    ...SIMULATION_CONFIG.economy.buildings.backstageCouch2,
    height: 0.72,
    color: 0x8c4a55,
    icon: '🛋️',
  },
  backstageCouch3: {
    kind: 'backstageCouch3',
    name: de('Backstage-Couch (3er)'),
    ...SIMULATION_CONFIG.economy.buildings.backstageCouch3,
    height: 0.72,
    color: 0x8c4a55,
    icon: '🛋️',
  },
  backstageToilet: {
    kind: 'backstageToilet',
    name: de('Backstage-Klo'),
    ...SIMULATION_CONFIG.economy.buildings.backstageToilet,
    height: 1.18,
    color: 0xd6ab4a,
    icon: '🚽',
  },
  fireworkBattery: {
    kind: 'fireworkBattery',
    name: de('Feuerwerkbatterie'),
    ...SIMULATION_CONFIG.economy.buildings.fireworkBattery,
    height: 0.85,
    color: 0xc23b4b,
    icon: '🎆',
  },
  shrub: { kind: 'shrub', name: de('Blütenstrauch'), cost: 25, upkeep: 1, capacity: 0, appeal: 3, defaultPrice: 0, height: .5, color: 0x659458, icon: '🌺' },
  flowerbed: { kind: 'flowerbed', name: de('Blumenbeet'), cost: 30, upkeep: 2, capacity: 0, appeal: 4, defaultPrice: 0, height: .22, color: 0xd981a0, icon: '🌷' },
  planter: { kind: 'planter', name: de('Pflanzkübel'), cost: 45, upkeep: 1, capacity: 0, appeal: 4, defaultPrice: 0, height: .65, color: 0xbb7956, icon: '🪴' },
  rock: { kind: 'rock', name: de('Zierfelsen'), cost: 35, upkeep: 0, capacity: 0, appeal: 2, defaultPrice: 0, height: .45, color: 0x8e9998, icon: '🪨' },
  statue: { kind: 'statue', name: de('Musikskulptur'), cost: 120, upkeep: 1, capacity: 0, appeal: 8, defaultPrice: 0, height: 1.2, color: 0xc0a468, icon: '🎵' },
  banner: { kind: 'banner', name: de('Festivalbanner'), cost: 40, upkeep: 1, capacity: 0, appeal: 3, defaultPrice: 0, height: 1.3, color: 0xc95670, icon: '🚩' },
  bunting: { kind: 'bunting', name: de('Wimpelkette'), cost: 35, upkeep: 1, capacity: 0, appeal: 5, defaultPrice: 0, height: 1.35, color: 0xe4b754, icon: '🎏' },
  stringLights: { kind: 'stringLights', name: de('Lichterkette'), cost: 65, upkeep: 2, capacity: 0, appeal: 7, defaultPrice: 0, height: 1.45, color: 0xffd58a, icon: '💡' },
  hayBale: { kind: 'hayBale', name: de('Strohballen'), cost: 20, upkeep: 0, capacity: 0, appeal: 2, defaultPrice: 0, height: .45, color: 0xd9b35e, icon: '🌾' },
  parasol: { kind: 'parasol', name: de('Festival-Sonnenschirm'), cost: 60, upkeep: 1, capacity: 0, appeal: 5, defaultPrice: 0, height: 1.15, color: 0xd75b79, icon: '⛱️' },
  picnicTable: { kind: 'picnicTable', name: de('Picknickgarnitur'), cost: 75, upkeep: 1, capacity: 0, appeal: 5, defaultPrice: 0, height: .6, color: 0xb28053, icon: '🪑' },
  festivalSign: { kind: 'festivalSign', name: de('Festival-Wegweiser'), cost: 30, upkeep: 0, capacity: 0, appeal: 3, defaultPrice: 0, height: 1.2, color: 0x569c91, icon: '🪧' },
  totem: { kind: 'totem', name: de('Festival-Totem'), cost: 95, upkeep: 1, capacity: 0, appeal: 7, defaultPrice: 0, height: 1.55, color: 0xd97a3a, icon: '🗿' },
  flagPole: { kind: 'flagPole', name: de('Fahnenmast'), cost: 55, upkeep: 1, capacity: 0, appeal: 5, defaultPrice: 0, height: 1.7, color: 0xc43d55, icon: '🚩' },
  lanternPole: { kind: 'lanternPole', name: de('Lampion'), cost: 50, upkeep: 1, capacity: 0, appeal: 6, defaultPrice: 0, height: 1.35, color: 0xf2b35a, icon: '🏮' },
  kegStack: { kind: 'kegStack', name: de('Bierfässer'), cost: 40, upkeep: 0, capacity: 0, appeal: 3, defaultPrice: 0, height: .7, color: 0x8a6a3a, icon: '🍺' },
  inflatable: { kind: 'inflatable', name: de('Luftfigur'), cost: 80, upkeep: 2, capacity: 0, appeal: 7, defaultPrice: 0, height: 1.25, color: 0xe86a8a, icon: '🦩' },
  prayerFlags: { kind: 'prayerFlags', name: de('Gebetsfahnen'), cost: 40, upkeep: 1, capacity: 0, appeal: 6, defaultPrice: 0, height: 1.3, color: 0xe4b754, icon: '🎐' },
  fireBowl: { kind: 'fireBowl', name: de('Feuerschale'), cost: 70, upkeep: 2, capacity: 0, appeal: 5, defaultPrice: 0, height: .55, color: 0xd4652a, icon: '🔥' },
  picketFence: { kind: 'picketFence', name: de('Lattenzaun'), cost: 22, upkeep: 0, capacity: 0, appeal: 2, defaultPrice: 0, height: .75, color: 0xe8d8b0, icon: '🏡' },
  ropeFence: { kind: 'ropeFence', name: de('Absperrseil'), cost: 20, upkeep: 0, capacity: 0, appeal: 1, defaultPrice: 0, height: .7, color: 0xc9a15b, icon: '🪢' },
  streamers: { kind: 'streamers', name: de('Luftschlangen'), cost: 18, upkeep: 1, capacity: 0, appeal: 2, defaultPrice: 0, height: 1.25, color: 0xe86a8a, icon: '🎀' },
  trafficCone: { kind: 'trafficCone', name: de('Leitkegel'), cost: 8, upkeep: 0, capacity: 0, appeal: 1, defaultPrice: 0, height: .45, color: 0xe67a22, icon: '🚧' },
  crateStack: { kind: 'crateStack', name: de('Kistenstapel'), cost: 15, upkeep: 0, capacity: 0, appeal: 1, defaultPrice: 0, height: .55, color: 0xb28053, icon: '📦' },
  oilDrum: { kind: 'oilDrum', name: de('Ölfass'), cost: 18, upkeep: 0, capacity: 0, appeal: 1, defaultPrice: 0, height: .6, color: 0x4a6a72, icon: '🛢️' },
  pinwheel: { kind: 'pinwheel', name: de('Windrad'), cost: 12, upkeep: 0, capacity: 0, appeal: 2, defaultPrice: 0, height: .85, color: 0x5da397, icon: '🌀' },
  windSock: { kind: 'windSock', name: de('Windsack'), cost: 16, upkeep: 0, capacity: 0, appeal: 2, defaultPrice: 0, height: 1.15, color: 0xe4b754, icon: '🎐' },
  hangingBasket: { kind: 'hangingBasket', name: de('Blumenampel'), cost: 40, upkeep: 1, capacity: 0, appeal: 4, defaultPrice: 0, height: 1.05, color: 0xd981a0, icon: '💐' },
  cactusPot: { kind: 'cactusPot', name: de('Kaktus'), cost: 28, upkeep: 1, capacity: 0, appeal: 3, defaultPrice: 0, height: .7, color: 0x4f9a62, icon: '🌵' },
  gnome: { kind: 'gnome', name: de('Gartenzwerg'), cost: 45, upkeep: 0, capacity: 0, appeal: 4, defaultPrice: 0, height: .7, color: 0xc43d55, icon: '🧙' },
  windChimes: { kind: 'windChimes', name: de('Windspiel'), cost: 38, upkeep: 0, capacity: 0, appeal: 4, defaultPrice: 0, height: 1.15, color: 0xc0a468, icon: '🔔' },
  chalkboard: { kind: 'chalkboard', name: de('Kreidetafel'), cost: 25, upkeep: 0, capacity: 0, appeal: 2, defaultPrice: 0, height: 1.05, color: 0x3d4a3a, icon: '🖍️' },
  loungeChair: { kind: 'loungeChair', name: de('Liegestuhl'), cost: 50, upkeep: 1, capacity: 0, appeal: 4, defaultPrice: 0, height: .45, color: 0xd75b79, icon: '⛱️' },
  beanBag: { kind: 'beanBag', name: de('Sitzsack'), cost: 35, upkeep: 0, capacity: 0, appeal: 3, defaultPrice: 0, height: .4, color: 0x5da397, icon: '🛋️' },
  tikiTorch: { kind: 'tikiTorch', name: de('Fackel'), cost: 48, upkeep: 1, capacity: 0, appeal: 5, defaultPrice: 0, height: 1.25, color: 0xd4652a, icon: '🕯️' },
  decoSpeaker: { kind: 'decoSpeaker', name: de('Deko-Box'), cost: 55, upkeep: 1, capacity: 0, appeal: 3, defaultPrice: 0, height: .75, color: 0x292b32, icon: '🔈' },
  boombox: { kind: 'boombox', name: de('Boombox'), cost: 70, upkeep: 1, capacity: 0, appeal: 4, defaultPrice: 0, height: .4, color: 0x383a43, icon: '📻' },
  photoFrame: { kind: 'photoFrame', name: de('Selfie-Rahmen'), cost: 85, upkeep: 1, capacity: 0, appeal: 6, defaultPrice: 0, height: 1.35, color: 0xe4b754, icon: '🖼️' },
  discoBall: { kind: 'discoBall', name: de('Diskokugel'), cost: 95, upkeep: 2, capacity: 0, appeal: 7, defaultPrice: 0, height: 1.45, color: 0xc8d4ee, icon: '🪩' },
  inflatableCactus: { kind: 'inflatableCactus', name: de('Luftkaktus'), cost: 75, upkeep: 2, capacity: 0, appeal: 6, defaultPrice: 0, height: 1.2, color: 0x4f9a62, icon: '🎈' },
  giantMushroom: { kind: 'giantMushroom', name: de('Riesenpilz'), cost: 110, upkeep: 1, capacity: 0, appeal: 8, defaultPrice: 0, height: 1.15, color: 0xce5677, icon: '🍄' },
  crystalTotem: { kind: 'crystalTotem', name: de('Kristallstele'), cost: 130, upkeep: 1, capacity: 0, appeal: 8, defaultPrice: 0, height: 1.5, color: 0x7ec8c4, icon: '💎' },
  welcomeArch: { kind: 'welcomeArch', name: de('Willkommensbogen'), cost: 160, upkeep: 2, capacity: 0, appeal: 10, defaultPrice: 0, height: 1.7, color: 0xc95670, icon: '⛩' },
  desertPalm: { kind: 'desertPalm', name: de('Wüstenpalme'), cost: 48, upkeep: 1, capacity: 0, appeal: 4, defaultPrice: 0, height: 1.55, color: 0x4f9a62, icon: '🌴' },
  dustLantern: { kind: 'dustLantern', name: de('Staublaterne'), cost: 42, upkeep: 1, capacity: 0, appeal: 4, defaultPrice: 0, height: 1.2, color: 0xc4a46a, icon: '🪔' },
  playaTotem: { kind: 'playaTotem', name: de('Playa-Stele'), cost: 115, upkeep: 1, capacity: 0, appeal: 8, defaultPrice: 0, height: 1.5, color: 0xb86b3a, icon: '🗿' },
  tumbleweed: { kind: 'tumbleweed', name: de('Steppenrolle'), cost: 16, upkeep: 0, capacity: 0, appeal: 2, defaultPrice: 0, height: .45, color: 0xc4a46a, icon: '🌾' },
  forestFern: { kind: 'forestFern', name: de('Farn'), cost: 28, upkeep: 1, capacity: 0, appeal: 4, defaultPrice: 0, height: .7, color: 0x3d6b3a, icon: '🌿' },
  mossLog: { kind: 'mossLog', name: de('Moosstamm'), cost: 32, upkeep: 0, capacity: 0, appeal: 3, defaultPrice: 0, height: .4, color: 0x5a4634, icon: '🪵' },
  foxfireLamp: { kind: 'foxfireLamp', name: de('Irrlicht'), cost: 58, upkeep: 1, capacity: 0, appeal: 6, defaultPrice: 0, height: 1.15, color: 0x7ec8c4, icon: '✨' },
  woodlandIdol: { kind: 'woodlandIdol', name: de('Waldidol'), cost: 105, upkeep: 1, capacity: 0, appeal: 8, defaultPrice: 0, height: 1.4, color: 0x6a5340, icon: '🪵' },
  neonPlant: { kind: 'neonPlant', name: de('UV-Pflanze'), cost: 38, upkeep: 1, capacity: 0, appeal: 4, defaultPrice: 0, height: .75, color: 0xff2d95, icon: '🪴' },
  neonArch: { kind: 'neonArch', name: de('Neonbogen'), cost: 150, upkeep: 2, capacity: 0, appeal: 9, defaultPrice: 0, height: 1.65, color: 0x2ee6ff, icon: '🌈' },
  uvSpeaker: { kind: 'uvSpeaker', name: de('UV-Box'), cost: 62, upkeep: 1, capacity: 0, appeal: 4, defaultPrice: 0, height: .7, color: 0xff2d95, icon: '🔊' },
  glowTape: { kind: 'glowTape', name: de('Leuchtband'), cost: 24, upkeep: 1, capacity: 0, appeal: 3, defaultPrice: 0, height: .7, color: 0x2ee6ff, icon: '➖' },
  scrapPlanter: { kind: 'scrapPlanter', name: de('Schrottkübel'), cost: 26, upkeep: 1, capacity: 0, appeal: 3, defaultPrice: 0, height: .7, color: 0x6a6e72, icon: '🪴' },
  palletBench: { kind: 'palletBench', name: de('Palettenbank'), cost: 36, upkeep: 0, capacity: 0, appeal: 3, defaultPrice: 0, height: .45, color: 0xb28053, icon: '🪑' },
  workLamp: { kind: 'workLamp', name: de('Baustrahler'), cost: 44, upkeep: 1, capacity: 0, appeal: 3, defaultPrice: 0, height: 1.1, color: 0xe4b754, icon: '🔦' },
  chainFence: { kind: 'chainFence', name: de('Absperrkette'), cost: 20, upkeep: 0, capacity: 0, appeal: 1, defaultPrice: 0, height: .7, color: 0x92a6a5, icon: '⛓️' },
  trackCurb: { kind: 'trackCurb', name: de('Streckenbegrenzung'), cost: 22, upkeep: 0, capacity: 0, appeal: 2, defaultPrice: 0, height: .35, color: 0xc43d55, icon: '🏁' },
  palmTree: { kind: 'palmTree', name: de('Palme'), cost: 52, upkeep: 1, capacity: 0, appeal: 5, defaultPrice: 0, height: 1.7, color: 0x4d8b46, icon: '🌴' },
  tikiStool: { kind: 'tikiStool', name: de('Tiki-Hocker'), cost: 28, upkeep: 0, capacity: 0, appeal: 3, defaultPrice: 0, height: .5, color: 0x936141, icon: '🪑' },
  tikiMask: { kind: 'tikiMask', name: de('Tiki-Maske'), cost: 88, upkeep: 1, capacity: 0, appeal: 7, defaultPrice: 0, height: 1.25, color: 0xd97a3a, icon: '🎭' },
  coconutPile: { kind: 'coconutPile', name: de('Kokosstapel'), cost: 18, upkeep: 0, capacity: 0, appeal: 2, defaultPrice: 0, height: .4, color: 0x6e5530, icon: '🥥' },
  altarTable: { kind: 'altarTable', name: de('Altar'), cost: 70, upkeep: 1, capacity: 0, appeal: 5, defaultPrice: 0, height: .55, color: 0x5a4634, icon: '🕯️' },
  spiritLantern: { kind: 'spiritLantern', name: de('Geisterlaterne'), cost: 55, upkeep: 1, capacity: 0, appeal: 6, defaultPrice: 0, height: 1.3, color: 0x6b3d8a, icon: '🏮' },
  runeStone: { kind: 'runeStone', name: de('Runenstein'), cost: 95, upkeep: 0, capacity: 0, appeal: 7, defaultPrice: 0, height: 1.15, color: 0x657774, icon: '🪨' },
  occultBanner: { kind: 'occultBanner', name: de('Runenbanner'), cost: 38, upkeep: 1, capacity: 0, appeal: 4, defaultPrice: 0, height: 1.3, color: 0x6b3d8a, icon: '🚩' },
  circusStool: { kind: 'circusStool', name: de('Zirkushocker'), cost: 30, upkeep: 0, capacity: 0, appeal: 3, defaultPrice: 0, height: .5, color: 0xc43d55, icon: '🪑' },
  carnivalBulbs: { kind: 'carnivalBulbs', name: de('Jahrmarktlichter'), cost: 60, upkeep: 2, capacity: 0, appeal: 6, defaultPrice: 0, height: 1.35, color: 0xe4b754, icon: '💡' },
  miniBigTop: { kind: 'miniBigTop', name: de('Mini-Zelt'), cost: 120, upkeep: 2, capacity: 0, appeal: 8, defaultPrice: 0, height: 1.2, color: 0xc43d55, icon: '🎪' },
  popcornCart: { kind: 'popcornCart', name: de('Popcornwagen'), cost: 75, upkeep: 1, capacity: 0, appeal: 5, defaultPrice: 0, height: .85, color: 0xe4b754, icon: '🍿' },
  alpineFir: { kind: 'alpineFir', name: de('Alpentanne'), cost: 50, upkeep: 1, capacity: 0, appeal: 5, defaultPrice: 0, height: 1.65, color: 0x345c40, icon: '🌲' },
  beerGardenTable: { kind: 'beerGardenTable', name: de('Biertisch'), cost: 80, upkeep: 1, capacity: 0, appeal: 5, defaultPrice: 0, height: .6, color: 0xb28053, icon: '🍺' },
  beerLantern: { kind: 'beerLantern', name: de('Biergartenlaterne'), cost: 48, upkeep: 1, capacity: 0, appeal: 5, defaultPrice: 0, height: 1.25, color: 0xe4b754, icon: '🏮' },
  maypole: { kind: 'maypole', name: de('Maibaum'), cost: 140, upkeep: 1, capacity: 0, appeal: 9, defaultPrice: 0, height: 1.75, color: 0x4d8b46, icon: '🎀' },
  icePine: { kind: 'icePine', name: de('Eistanne'), cost: 55, upkeep: 1, capacity: 0, appeal: 5, defaultPrice: 0, height: 1.65, color: 0xc8e8f4, icon: '🌲' },
  iceBench: { kind: 'iceBench', name: de('Eisbank'), cost: 40, upkeep: 0, capacity: 0, appeal: 4, defaultPrice: 0, height: .45, color: 0xc8e8f4, icon: '🧊' },
  auroraLamp: { kind: 'auroraLamp', name: de('Polarlicht'), cost: 88, upkeep: 2, capacity: 0, appeal: 7, defaultPrice: 0, height: 1.4, color: 0x5ee0b0, icon: '🌌' },
  iceSculpture: { kind: 'iceSculpture', name: de('Eisskulptur'), cost: 125, upkeep: 1, capacity: 0, appeal: 9, defaultPrice: 0, height: 1.45, color: 0xc8e8f4, icon: '🧊' },
  snowman: { kind: 'snowman', name: de('Schneemann'), cost: 45, upkeep: 0, capacity: 0, appeal: 5, defaultPrice: 0, height: .95, color: 0xf4f7ff, icon: '⛄' },
  iceFence: { kind: 'iceFence', name: de('Eiszapfenzaun'), cost: 24, upkeep: 0, capacity: 0, appeal: 3, defaultPrice: 0, height: .8, color: 0xc8e8f4, icon: '❄️' },
  copperPlanter: { kind: 'copperPlanter', name: de('Kupferkübel'), cost: 42, upkeep: 1, capacity: 0, appeal: 4, defaultPrice: 0, height: .7, color: 0xb87333, icon: '🪴' },
  gearBench: { kind: 'gearBench', name: de('Zahnradbank'), cost: 70, upkeep: 1, capacity: 0, appeal: 4, defaultPrice: 0, height: .5, color: 0xc4a15a, icon: '🪑' },
  gasLamp: { kind: 'gasLamp', name: de('Gaslaterne'), cost: 72, upkeep: 1, capacity: 0, appeal: 6, defaultPrice: 0, height: 1.45, color: 0xc4a15a, icon: '🕯️' },
  pipeTotem: { kind: 'pipeTotem', name: de('Rohrturm'), cost: 135, upkeep: 1, capacity: 0, appeal: 8, defaultPrice: 0, height: 1.55, color: 0xb87333, icon: '🗼' },
  gearStack: { kind: 'gearStack', name: de('Zahnräder'), cost: 38, upkeep: 0, capacity: 0, appeal: 3, defaultPrice: 0, height: .55, color: 0xc4a15a, icon: '⚙️' },
  pipeRail: { kind: 'pipeRail', name: de('Rohrgitter'), cost: 26, upkeep: 0, capacity: 0, appeal: 2, defaultPrice: 0, height: .75, color: 0x3a3530, icon: '🛤️' },
}

/** Catalog-owned default; scenery and specialist tools refine this in the preview contract. */
export const BUILDING_GHOST_MODES: Record<BuildingKind, GhostRenderMode> =
  Object.fromEntries(
    BUILDING_KINDS.map((kind) => [
      kind,
      kind === 'path' ? 'path' : kind === 'stage' ? 'footprint' : 'model',
    ]),
  ) as Record<BuildingKind, GhostRenderMode>

export const STARTING_MONEY = SIMULATION_CONFIG.economy.startingMoney
export const WORLD_SIZE = 48
export const SAVE_KEY = 'festival-simulator-save-v1'
export const SAVE_SLOTS_KEY = 'festival-simulator-save-slots-v1'
export const BLUEPRINT_LIBRARY_KEY = 'festival-simulator-blueprints-v1'
export const saveSlotDataKey = (id: string): string => `${SAVE_SLOTS_KEY}:${id}`
