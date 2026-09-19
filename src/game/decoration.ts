import { WALL_KINDS, wallSpec, ROOF_KINDS, roofSpec, THEMED_BIN_KINDS, binSpec } from './decorationWalls'
import type { BuildingKind } from './catalog'

/**
 * Festival deco themes. Grounded in real festival aesthetics, plus two
 * playable specials. Theme is a catalog filter only — placed buildings stay
 * ordinary `BuildingKind`s (no snapshot theme field).
 */
export const DECORATION_THEME_IDS = [
  'klassik',
  'wueste',
  'wald',
  'neon',
  'industrie',
  'tropen',
  'mystik',
  'zirkus',
  'alpin',
  'arktis',
  'steampunk',
] as const

export type DecorationThemeId = (typeof DECORATION_THEME_IDS)[number]

export const DECORATION_CATEGORY_IDS = [
  'plants',
  'furniture',
  'lights',
  'festival',
  'props',
  'fence',
  'walls',
  'roofs',
] as const

export type DecorationCategoryId = (typeof DECORATION_CATEGORY_IDS)[number]

export type DecorationTheme = {
  id: DecorationThemeId
  label: string
  icon: string
  /** One-line why this theme exists (docs + tests). */
  rationale: string
}

export const DECORATION_THEMES: readonly DecorationTheme[] = [
  {
    id: 'klassik',
    label: 'Klassik',
    icon: '🎸',
    rationale: 'Woodstock-/Folk-Open-Air: Holz, Fahnen, Wegweiser — neutrales Festivalgelände.',
  },
  {
    id: 'wueste',
    label: 'Wüste',
    icon: '🌵',
    rationale: 'Burning-Man-/Wüstenfestivals: Playa, Staub, Kakteen und Skulpturen.',
  },
  {
    id: 'wald',
    label: 'Wald',
    icon: '🌲',
    rationale: 'Wald-Raves (Boom, Ozora): Farne, Pilze, Moos und Waldidole.',
  },
  {
    id: 'neon',
    label: 'Neon',
    icon: '🪩',
    rationale: 'Rave/UV-Nacht: Leuchtfarben, Diskokugel, LED-Bänder.',
  },
  {
    id: 'industrie',
    label: 'Industrie',
    icon: '🛢️',
    rationale: 'Warehouse-Techno: Paletten, Fässer, Ketten, Baustrahler.',
  },
  {
    id: 'tropen',
    label: 'Tropen',
    icon: '🌴',
    rationale: 'Strand- und Karibik-Festivals: Palmen, Tiki, Liegestühle.',
  },
  {
    id: 'mystik',
    label: 'Mystik',
    icon: '🔮',
    rationale: 'Spirituelle/okkulte Open-Airs: Kristalle, Runen, Gebetsfahnen, Feuer.',
  },
  {
    id: 'zirkus',
    label: 'Zirkus',
    icon: '🎪',
    rationale: 'Jahrmarkt- und Circus-Fields: Wimpel, Mini-Zelt, Popcorn, Lichter.',
  },
  {
    id: 'alpin',
    label: 'Alpin',
    icon: '🏔️',
    rationale: 'Alpen-/Oktoberfest-Ästhetik: Tannen, Biertische, Maibaum, Lattenzaun.',
  },
  {
    id: 'arktis',
    label: 'Arktis',
    icon: '❄️',
    rationale: 'Spezial: Eis, Polarlicht und Schnee — klar von Holz/Neon getrennt.',
  },
  {
    id: 'steampunk',
    label: 'Steampunk',
    icon: '🔧',
    rationale: 'Spezial: Messing, Zahnräder, Rohre und Gaslicht — viktorianische Industrie-Fantasie.',
  },
]

export const DECORATION_CATEGORY_LABELS: Record<DecorationCategoryId, string> = {
  plants: 'Pflanzen',
  furniture: 'Möbel',
  lights: 'Licht',
  festival: 'Fest',
  props: 'Kulisse',
  fence: 'Zaun',
  walls: 'Wände',
  roofs: 'Dächer',
}

export const DEFAULT_DECORATION_THEME: DecorationThemeId = 'klassik'

/** Full-tile catalog pieces that stay in Klassik and are not scenery slots. */
export const FULL_TILE_DECORATION_KINDS = ['bench', 'table', 'fence', 'lighting', 'lightBalloon'] as const

type DecorationEntry = {
  kind: BuildingKind
  theme: DecorationThemeId
  category: DecorationCategoryId
}

const DECORATION_ENTRIES: readonly DecorationEntry[] = [
  { kind: 'wasteBin', theme: 'klassik', category: 'furniture' },
  ...THEMED_BIN_KINDS.map(kind => ({ kind, theme: binSpec(kind)!.theme, category: 'furniture' as const })),
  ...ROOF_KINDS.map(kind => ({ kind, theme: roofSpec(kind)!.theme, category: 'roofs' as const })),
  ...WALL_KINDS.map(kind => ({ kind, theme: wallSpec(kind)!.theme, category: 'walls' as const })),
  { kind: 'tree', theme: 'klassik', category: 'plants' },
  { kind: 'hedge', theme: 'klassik', category: 'plants' },
  { kind: 'shrub', theme: 'klassik', category: 'plants' },
  { kind: 'flowerbed', theme: 'klassik', category: 'plants' },
  { kind: 'planter', theme: 'klassik', category: 'plants' },
  { kind: 'bench', theme: 'klassik', category: 'furniture' },
  { kind: 'table', theme: 'klassik', category: 'furniture' },
  { kind: 'picnicTable', theme: 'klassik', category: 'furniture' },
  { kind: 'lighting', theme: 'klassik', category: 'lights' },
  { kind: 'lightBalloon', theme: 'klassik', category: 'lights' },
  { kind: 'lanternPole', theme: 'klassik', category: 'lights' },
  { kind: 'statue', theme: 'klassik', category: 'festival' },
  { kind: 'banner', theme: 'klassik', category: 'festival' },
  { kind: 'festivalSign', theme: 'klassik', category: 'festival' },
  { kind: 'totem', theme: 'klassik', category: 'festival' },
  { kind: 'flagPole', theme: 'klassik', category: 'festival' },
  { kind: 'welcomeArch', theme: 'klassik', category: 'festival' },
  { kind: 'rock', theme: 'klassik', category: 'festival' },
  { kind: 'chalkboard', theme: 'klassik', category: 'props' },
  { kind: 'photoFrame', theme: 'klassik', category: 'props' },
  { kind: 'decoSpeaker', theme: 'klassik', category: 'props' },
  { kind: 'fence', theme: 'klassik', category: 'fence' },
  { kind: 'ropeFence', theme: 'klassik', category: 'fence' },

  { kind: 'cactusPot', theme: 'wueste', category: 'plants' },
  { kind: 'desertPalm', theme: 'wueste', category: 'plants' },
  { kind: 'dustLantern', theme: 'wueste', category: 'lights' },
  { kind: 'inflatableCactus', theme: 'wueste', category: 'festival' },
  { kind: 'playaTotem', theme: 'wueste', category: 'festival' },
  { kind: 'windSock', theme: 'wueste', category: 'props' },
  { kind: 'tumbleweed', theme: 'wueste', category: 'props' },

  { kind: 'hangingBasket', theme: 'wald', category: 'plants' },
  { kind: 'forestFern', theme: 'wald', category: 'plants' },
  { kind: 'mossLog', theme: 'wald', category: 'furniture' },
  { kind: 'foxfireLamp', theme: 'wald', category: 'lights' },
  { kind: 'giantMushroom', theme: 'wald', category: 'festival' },
  { kind: 'woodlandIdol', theme: 'wald', category: 'festival' },
  { kind: 'windChimes', theme: 'wald', category: 'props' },

  { kind: 'neonPlant', theme: 'neon', category: 'plants' },
  { kind: 'beanBag', theme: 'neon', category: 'furniture' },
  { kind: 'stringLights', theme: 'neon', category: 'lights' },
  { kind: 'discoBall', theme: 'neon', category: 'lights' },
  { kind: 'neonArch', theme: 'neon', category: 'festival' },
  { kind: 'boombox', theme: 'neon', category: 'props' },
  { kind: 'uvSpeaker', theme: 'neon', category: 'props' },
  { kind: 'glowTape', theme: 'neon', category: 'fence' },

  { kind: 'scrapPlanter', theme: 'industrie', category: 'plants' },
  { kind: 'palletBench', theme: 'industrie', category: 'furniture' },
  { kind: 'workLamp', theme: 'industrie', category: 'lights' },
  { kind: 'trafficCone', theme: 'industrie', category: 'props' },
  { kind: 'crateStack', theme: 'industrie', category: 'props' },
  { kind: 'oilDrum', theme: 'industrie', category: 'props' },
  { kind: 'chainFence', theme: 'industrie', category: 'fence' },

  { kind: 'palmTree', theme: 'tropen', category: 'plants' },
  { kind: 'parasol', theme: 'tropen', category: 'furniture' },
  { kind: 'loungeChair', theme: 'tropen', category: 'furniture' },
  { kind: 'tikiStool', theme: 'tropen', category: 'furniture' },
  { kind: 'tikiTorch', theme: 'tropen', category: 'lights' },
  { kind: 'inflatable', theme: 'tropen', category: 'festival' },
  { kind: 'tikiMask', theme: 'tropen', category: 'festival' },
  { kind: 'coconutPile', theme: 'tropen', category: 'props' },

  { kind: 'altarTable', theme: 'mystik', category: 'furniture' },
  { kind: 'spiritLantern', theme: 'mystik', category: 'lights' },
  { kind: 'prayerFlags', theme: 'mystik', category: 'festival' },
  { kind: 'fireBowl', theme: 'mystik', category: 'festival' },
  { kind: 'crystalTotem', theme: 'mystik', category: 'festival' },
  { kind: 'runeStone', theme: 'mystik', category: 'festival' },
  { kind: 'occultBanner', theme: 'mystik', category: 'fence' },

  { kind: 'circusStool', theme: 'zirkus', category: 'furniture' },
  { kind: 'carnivalBulbs', theme: 'zirkus', category: 'lights' },
  { kind: 'bunting', theme: 'zirkus', category: 'festival' },
  { kind: 'streamers', theme: 'zirkus', category: 'festival' },
  { kind: 'pinwheel', theme: 'zirkus', category: 'festival' },
  { kind: 'miniBigTop', theme: 'zirkus', category: 'festival' },
  { kind: 'popcornCart', theme: 'zirkus', category: 'props' },

  { kind: 'alpineFir', theme: 'alpin', category: 'plants' },
  { kind: 'hayBale', theme: 'alpin', category: 'furniture' },
  { kind: 'beerGardenTable', theme: 'alpin', category: 'furniture' },
  { kind: 'beerLantern', theme: 'alpin', category: 'lights' },
  { kind: 'kegStack', theme: 'alpin', category: 'festival' },
  { kind: 'maypole', theme: 'alpin', category: 'festival' },
  { kind: 'gnome', theme: 'alpin', category: 'props' },
  { kind: 'picketFence', theme: 'alpin', category: 'fence' },

  { kind: 'icePine', theme: 'arktis', category: 'plants' },
  { kind: 'iceBench', theme: 'arktis', category: 'furniture' },
  { kind: 'auroraLamp', theme: 'arktis', category: 'lights' },
  { kind: 'iceSculpture', theme: 'arktis', category: 'festival' },
  { kind: 'snowman', theme: 'arktis', category: 'props' },
  { kind: 'iceFence', theme: 'arktis', category: 'fence' },

  { kind: 'copperPlanter', theme: 'steampunk', category: 'plants' },
  { kind: 'gearBench', theme: 'steampunk', category: 'furniture' },
  { kind: 'gasLamp', theme: 'steampunk', category: 'lights' },
  { kind: 'pipeTotem', theme: 'steampunk', category: 'festival' },
  { kind: 'gearStack', theme: 'steampunk', category: 'props' },
  { kind: 'pipeRail', theme: 'steampunk', category: 'fence' },
]

const THEME_BY_KIND = new Map<BuildingKind, DecorationThemeId>(
  DECORATION_ENTRIES.map((entry) => [entry.kind, entry.theme]),
)
const CATEGORY_BY_KIND = new Map<BuildingKind, DecorationCategoryId>(
  DECORATION_ENTRIES.map((entry) => [entry.kind, entry.category]),
)

export const THEMED_DECORATION_KINDS = [
  'desertPalm',
  'dustLantern',
  'playaTotem',
  'tumbleweed',
  'forestFern',
  'mossLog',
  'foxfireLamp',
  'woodlandIdol',
  'neonPlant',
  'neonArch',
  'uvSpeaker',
  'glowTape',
  'scrapPlanter',
  'palletBench',
  'workLamp',
  'chainFence',
  'palmTree',
  'tikiStool',
  'tikiMask',
  'coconutPile',
  'altarTable',
  'spiritLantern',
  'runeStone',
  'occultBanner',
  'circusStool',
  'carnivalBulbs',
  'miniBigTop',
  'popcornCart',
  'alpineFir',
  'beerGardenTable',
  'beerLantern',
  'maypole',
  'icePine',
  'iceBench',
  'auroraLamp',
  'iceSculpture',
  'snowman',
  'iceFence',
  'copperPlanter',
  'gearBench',
  'gasLamp',
  'pipeTotem',
  'gearStack',
  'pipeRail',
] as const satisfies readonly BuildingKind[]

export type ThemedDecorationKind = (typeof THEMED_DECORATION_KINDS)[number]

export function isDecorationThemeId(value: string): value is DecorationThemeId {
  return (DECORATION_THEME_IDS as readonly string[]).includes(value)
}

export function decorationThemeById(id: DecorationThemeId): DecorationTheme {
  return DECORATION_THEMES.find((theme) => theme.id === id)!
}

export function decorationThemeOf(kind: string): DecorationThemeId | undefined {
  return THEME_BY_KIND.get(kind as BuildingKind)
}

export function decorationCategoryOf(kind: string): DecorationCategoryId | undefined {
  return CATEGORY_BY_KIND.get(kind as BuildingKind)
}

export function isDecorationCatalogKind(kind: string): boolean {
  return THEME_BY_KIND.has(kind as BuildingKind)
}

export function decorationKindsInCategory(category: DecorationCategoryId): BuildingKind[] {
  return DECORATION_ENTRIES.filter((entry) => entry.category === category).map((entry) => entry.kind)
}

export function filterDecorationKinds(
  theme: DecorationThemeId,
  category: DecorationCategoryId,
): BuildingKind[] {
  return DECORATION_ENTRIES.filter((entry) => entry.theme === theme && entry.category === category).map(
    (entry) => entry.kind,
  )
}

export function decorationKindsForTheme(theme: DecorationThemeId): BuildingKind[] {
  return DECORATION_ENTRIES.filter((entry) => entry.theme === theme).map((entry) => entry.kind)
}

export function decorationCatalogKinds(): BuildingKind[] {
  return DECORATION_ENTRIES.map((entry) => entry.kind)
}
