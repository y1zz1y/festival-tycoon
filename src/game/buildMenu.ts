// i18n: client-text
import { FLAT_RIDE_TYPES, rideProfile, type FlatRideType } from './flatRides'
import { BUILDING_KINDS, BUILDINGS } from './catalog'
import type { BuildingKind, Tool } from './catalog'
import { TRACK_PIECES, type CoasterTypeId } from './coasters'
import { COURSE_KINDS, COURSE_SPECS, type CourseKind } from './courseAttractions'
import { listPlayableCoasterCatalogTypes } from './coasterTypes'
import {
  DECORATION_CATEGORY_IDS,
  DECORATION_CATEGORY_LABELS,
  decorationKindsInCategory,
} from './decoration'
import { SIMULATION_CONFIG } from './simulationConfig'
import { formatMoney, formatNumber, joinParts, localize, t, tc } from '../i18n'

export const BUILD_CATEGORY_IDS = [
  'bulldoze',
  'terrain',
  'copy',
  'decoration',
  'paths',
  'attractions',
  'roads',
  'logistics',
] as const

export type BuildCategoryId = (typeof BUILD_CATEGORY_IDS)[number]
export type BuildDock = 'left' | 'right'
export type BuildExtra =
  | 'terrain'
  | 'copy'
  | 'decoration'
  | 'paths'
  | 'attractions'
  | 'roads'
  | 'logistics'

export type BuildMenuItem = {
  tool: Tool
  name: string
  icon: string
  detail: string
  previewKind?: BuildingKind
  previewSupply?: 'delivery' | 'supply'
  bungee?: boolean
  /** A flat ride (src/game/flatRides.ts) built with the `ride` tool. */
  rideType?: FlatRideType
  coasterTypeId?: CoasterTypeId
  courseKind?: CourseKind
}

export type BuildSubgroup = {
  id: string
  label: string
  items: BuildMenuItem[]
}

export type BuildCategory = {
  id: BuildCategoryId
  label: string
  icon: string
  dock: BuildDock
  extra?: BuildExtra
  groups: BuildSubgroup[]
}

/**
 * Menu text is built when it is read, in the viewer's language: `name`, `detail` and
 * the labels are getters (docs/i18n.md), so the menu stays one static table.
 */
type MenuText = () => string

export function buildingMenuItem(kind: BuildingKind, detail?: MenuText): BuildMenuItem {
  const building = BUILDINGS[kind]
  return {
    tool: kind,
    get name() { return localize(building.name) },
    icon: building.icon,
    get detail() { return detail ? detail() : formatMoney(building.cost) },
    previewKind: kind,
  }
}

function toolItem(
  tool: Tool,
  name: MenuText,
  icon: string,
  detail: MenuText,
  extra?: Pick<BuildMenuItem, 'bungee' | 'rideType' | 'previewKind' | 'previewSupply' | 'coasterTypeId' | 'courseKind'>,
): BuildMenuItem {
  return { tool, get name() { return name() }, icon, get detail() { return detail() }, ...extra }
}

/** A building's price followed by further facts, joined with ` · `. */
function costWith(kind: BuildingKind, ...facts: MenuText[]): MenuText {
  return () => joinParts(formatMoney(BUILDINGS[kind].cost), ...facts.map((fact) => fact()))
}

const COURSE_DETAILS: Record<CourseKind, MenuText> = {
  mudmasters: () => t('Hindernisparcours'),
  pool: () => t('Becken mit Wasser'),
  treeToTree: () => t('Bäume und Seilbahnen'),
  waterSlide: () => t('Leitern, Rutsche, Auslauf'),
  paintball: () => t('Spielfeld mit Teams'),
}

/** Fallback label only — catalog tiles render `coasterVehiclePreview` thumbnails. */
const COASTER_TYPE_ICONS: Record<CoasterTypeId, string> = {
  classicSteel: 'sitDownSteel',
  wooden: 'wooden',
  looping: 'sitDownSteel',
  corkscrew: 'sitDownSteel',
  hyper: 'sitDownSteel',
  twister: 'bmSitdown',
  hyperTwister: 'bmSitdown',
  verticalDrop: 'giga',
  giga: 'giga',
  lsmLaunched: 'launched',
  limLaunched: 'launched',
  inverted: 'invertV',
  compactInverted: 'invertV',
  flying: 'flying',
  standUp: 'standUp',
  junior: 'junior',
  steelWildMouse: 'mouse',
  woodenWildMouse: 'mouse',
  mineTrain: 'mine',
  bobsled: 'bobsled',
  suspendedSwinging: 'swinging',
}

export function coasterCatalogIcon(typeId: CoasterTypeId): string {
  return COASTER_TYPE_ICONS[typeId]
}

function coasterTypeItems(): BuildMenuItem[] {
  return listPlayableCoasterCatalogTypes().map((entry) =>
    toolItem('coaster', () => localize(entry.name), COASTER_TYPE_ICONS[entry.id], () => t`ab ${formatMoney(TRACK_PIECES.station.cost)}`, {
      coasterTypeId: entry.id,
    }),
  )
}

export const BUILD_CATEGORIES: readonly BuildCategory[] = [
  {
    id: 'bulldoze',
    get label() { return t('Abriss') },
    icon: '💣',
    dock: 'left',
    groups: [
      {
        id: 'main',
        get label() { return t('Abriss') },
        items: [toolItem('bulldoze', () => t('Abriss'), '💣', () => t('Gebäude und Wege'))],
      },
    ],
  },
  {
    id: 'terrain',
    get label() { return tc('terrain', 'Gelände') },
    icon: '🚜',
    dock: 'left',
    extra: 'terrain',
    groups: [
      {
        id: 'shape',
        get label() { return t('Form') },
        items: [
          toolItem('terrainRaise', () => t('Anheben'), '🔼', () => `+${formatNumber(0.5)}`),
          toolItem('terrainLower', () => t('Absenken'), '🔽', () => `−${formatNumber(0.5)}`),
          toolItem('terrainSmooth', () => t('Glätten'), '〰️', () => t('Einebnen')),
        ],
      },
      {
        id: 'cover',
        get label() { return t('Untergrund') },
        items: [
          toolItem('terrainCoverGrass', () => t('Rasen'), '🌿', () => t('Wiese')),
          toolItem('terrainCoverSand', () => t('Sand'), '🏜️', () => t('Düne')),
          toolItem('terrainCoverStone', () => t('Stein'), '🪨', () => t('Platte')),
          toolItem('terrainCoverField', () => t('Acker'), '🌾', () => t('Furchen')),
          toolItem('terrainCoverSnow', () => t('Schnee'), '❄️', () => t('Weiß')),
          toolItem('terrainCoverRock', () => t('Felsen'), '⛰️', () => t('Fels')),
          toolItem('terrainCoverEarth', () => t('Braune Erde'), '🟤', () => t('Erde')),
          toolItem('terrainCoverSalt', () => t('Salzpfanne'), '⬜', () => t('Playa')),
          toolItem('terrainCoverAsphalt', () => t('Asphalt'), '🏁', () => t('Piste')),
        ],
      },
    ],
  },
  {
    id: 'copy',
    get label() { return t('Kopieren') },
    icon: '⧉',
    dock: 'left',
    extra: 'copy',
    groups: [
      {
        id: 'main',
        get label() { return t('Kopieren') },
        items: [toolItem('copy', () => t('Bereich kopieren'), '⧉', () => t('Rechteck aufziehen'))],
      },
    ],
  },
  {
    id: 'decoration',
    get label() { return t('Dekoration') },
    icon: '🪑',
    dock: 'left',
    extra: 'decoration',
    groups: DECORATION_CATEGORY_IDS.map((id) => ({
      id,
      get label() { return localize(DECORATION_CATEGORY_LABELS[id]) },
      items: decorationKindsInCategory(id).map((kind) => buildingMenuItem(kind)),
    })),
  },
  {
    id: 'paths',
    get label() { return t('Wege') },
    icon: '🛤️',
    dock: 'left',
    extra: 'paths',
    groups: [
      {
        id: 'main',
        get label() { return t('Wege') },
        items: [buildingMenuItem('path', () => t('Linie ziehen'))],
      },
    ],
  },
  {
    id: 'attractions',
    get label() { return t('Attraktionen') },
    icon: '🎡',
    dock: 'left',
    extra: 'attractions',
    groups: [
      {
        id: 'rides',
        get label() { return t('Fahrgeschäfte') },
        items: [
          buildingMenuItem('ride'),
          toolItem('ride', () => t('Bungee-Turm'), '🪂', () => t`${formatMoney(1200)} + ${formatMoney(25)}/Meter`, {
            bungee: true,
          }),
          ...FLAT_RIDE_TYPES.map((rideType) => {
            const profile = rideProfile({ rideType })
            return toolItem('ride', () => localize(profile.name), profile.icon, () => formatMoney(profile.cost), { rideType })
          }),
        ],
      },
      {
        id: 'coasters',
        get label() { return t('Achterbahn') },
        items: coasterTypeItems(),
      },
      {
        id: 'courses',
        get label() { return t('Kurse') },
        items: COURSE_KINDS.map((kind) =>
          toolItem(
            'course',
            () => localize(COURSE_SPECS[kind].name),
            COURSE_SPECS[kind].icon,
            () => joinParts(formatMoney(COURSE_SPECS[kind].startCost), COURSE_DETAILS[kind]()),
            { courseKind: kind },
          ),
        ),
      },
      {
        id: 'stalls',
        get label() { return t('Stände') },
        items: [
          buildingMenuItem('food'),
          buildingMenuItem('toilet'),
          buildingMenuItem('waterPoint'),
          buildingMenuItem('shower'),
          buildingMenuItem('alcohol'),
          buildingMenuItem('mascot'),
          buildingMenuItem('shirt'),
          buildingMenuItem('securityGate'),
        ],
      },
      {
        id: 'camping',
        get label() { return t('Camping') },
        items: [toolItem('camping', () => t('Zeltbereich'), '⛺', () => t('Gelände ausweisen'))],
      },
      {
        id: 'festival',
        get label() { return t('Festival') },
        items: [
          buildingMenuItem('stage'),
          buildingMenuItem('directionalSpeaker'),
          buildingMenuItem('omniSpeaker'),
          buildingMenuItem('foh'),
          buildingMenuItem('delayTower'),
          buildingMenuItem('videoWall'),
          buildingMenuItem('laserShow'),
          buildingMenuItem('fireworkBattery'),
        ],
      },
    ],
  },
  {
    id: 'roads',
    get label() { return t('Straßen') },
    icon: '🛣️',
    dock: 'left',
    extra: 'roads',
    groups: [
      {
        id: 'main',
        get label() { return t('Straße') },
        items: [
          toolItem('road', () => t('Straße'), '▰', () => t('Linie ziehen')),
          toolItem('parkingArea', () => t('Parkplatz'), '🅿', () => t('Fläche ziehen')),
          toolItem('roadDirection', () => t('Fahrtrichtung'), '➜', () => t('Pfeil setzen')),
          toolItem('roadDirectionClear', () => t('Fahrtrichtung entfernen'), '⇄', () => t('Wieder beide Richtungen')),
          toolItem('trafficLight', () => t('Ampel'), '🚦', () => joinParts(formatMoney(120), t('eine Richtung'))),
          toolItem('pathBarrier', () => t('Personentor'), '🚧', () => joinParts(formatMoney(70), t('eine Richtung'))),
          toolItem('roadSeparator', () => t('Trennlinie'), '⛔', () => t('Kante sperren')),
          toolItem('crosswalk', () => t('Zebrastreifen'), '▥', () => t('Überweg')),
          toolItem('roadSpeed10', () => t`Tempo ${10}`, '10', () => t('Fahrbahn')),
          toolItem('roadSpeed30', () => t`Tempo ${30}`, '30', () => t('Fahrbahn')),
          toolItem('roadSpeed50', () => t`Tempo ${50}`, '50', () => t('Fahrbahn')),
        ],
      },
    ],
  },
  {
    id: 'logistics',
    get label() { return t('Logistik') },
    icon: '🚚',
    dock: 'left',
    extra: 'logistics',
    groups: [
      {
        id: 'freight',
        get label() { return t('Waren') },
        items: [
          toolItem('deliveryYard', () => t('Anlieferungsplatz'), '📦', () => joinParts(formatMoney(400), t('an der Straße')), {
            previewSupply: 'delivery',
          }),
          toolItem('supplyDepot', () => t('Depot'), '🏪', () => joinParts(formatMoney(400), t('am Fußweg')), {
            previewSupply: 'supply',
          }),
          toolItem('staffGate', () => t('Personaltor'), '🛂', () => joinParts(formatMoney(80), t('Personal und Saugroboter'))),
        ],
      },
      {
        id: 'bus',
        get label() { return t('Bus') },
        items: [buildingMenuItem('busStop'), buildingMenuItem('busDepot')],
      },
      {
        id: 'band',
        get label() { return t('Bandversorgung') },
        items: [
          toolItem(
            'backstageArea',
            () => t('Backstage ausweisen'),
            '🎤',
            () => joinParts(t`${formatMoney(SIMULATION_CONFIG.bandSupply.backstageDesignationCost)} je Feld`, t('begehbar und bebaubar')),
          ),
          buildingMenuItem('tourBusParking', costWith('tourBusParking', () => t('nur Backstage'))),
          buildingMenuItem('bandFridge', costWith('bandFridge', () => t('Pause zwischen den Auftritten'))),
          buildingMenuItem('backstageCouch2', costWith('backstageCouch2', () => t`${2} Felder`, () => t`${2} Sitzplätze`)),
          buildingMenuItem('backstageCouch3', costWith('backstageCouch3', () => t`${3} Felder`, () => t`${3} Sitzplätze`)),
          buildingMenuItem('backstageToilet', costWith('backstageToilet', () => t('braucht Trinkwasser'))),
        ],
      },
      {
        id: 'waste',
        get label() { return t('Müll') },
        items: [
          toolItem('wasteDump', () => t('Müllablage'), '🗑️', () => t('sehr unattraktiv')),
          buildingMenuItem(
            'sealedWasteContainer',
            costWith('sealedWasteContainer', () => t`${80} Beutel`, () => t('braucht Straßenanschluss')),
          ),
          buildingMenuItem(
            'wasteDepot',
            costWith('wasteDepot', () => t('Müllwagen starten und laden hier ab'), () => t('braucht Straßenanschluss')),
          ),
          buildingMenuItem('specialDepot'),
        ],
      },
      {
        id: 'medical',
        get label() { return t('Krankenhaus') },
        items: [
          buildingMenuItem('ambulanceGarage'),
          buildingMenuItem('fireStation'),
          toolItem('medicalArea', () => t('Krankenbereich'), '🏥', () => t`${3} Liegen je Feld`),
        ],
      },
      {
        id: 'power',
        get label() { return t('Strom') },
        items: [
          toolItem('powerCable', () => t('Stromkabel'), '🔌', () => t`${formatMoney(18)} je Feld`),
          buildingMenuItem('generator'),
          buildingMenuItem('backupGenerator'),
        ],
      },
    ],
  },
]

export const CATALOG_BUILD_CATEGORIES: readonly BuildCategoryId[] = [
  'decoration',
  'attractions',
  'logistics',
]

export function isCatalogBuildCategory(id: BuildCategoryId): boolean {
  return CATALOG_BUILD_CATEGORIES.includes(id)
}

export function buildCategoryById(id: BuildCategoryId): BuildCategory {
  return BUILD_CATEGORIES.find((category) => category.id === id)!
}

export function listedBuildTools(): Tool[] {
  const tools: Tool[] = []
  for (const category of BUILD_CATEGORIES) {
    for (const group of category.groups) {
      for (const item of group.items) {
        if (!tools.includes(item.tool)) tools.push(item.tool)
      }
    }
  }
  return tools
}

export function categoryForTool(tool: Tool, bungee = false): BuildCategoryId | null {
  if (tool === 'inspect') return null
  for (const category of BUILD_CATEGORIES) {
    for (const group of category.groups) {
      if (group.items.some((item) => item.tool === tool && Boolean(item.bungee) === bungee)) {
        return category.id
      }
    }
  }
  for (const category of BUILD_CATEGORIES) {
    for (const group of category.groups) {
      if (group.items.some((item) => item.tool === tool)) return category.id
    }
  }
  return null
}

export function subgroupForTool(
  tool: Tool,
  bungee = false,
): { category: BuildCategoryId; group: string } | null {
  for (const category of BUILD_CATEGORIES) {
    for (const group of category.groups) {
      if (group.items.some((item) => item.tool === tool && Boolean(item.bungee) === bungee)) {
        return { category: category.id, group: group.id }
      }
    }
  }
  for (const category of BUILD_CATEGORIES) {
    for (const group of category.groups) {
      if (group.items.some((item) => item.tool === tool)) {
        return { category: category.id, group: group.id }
      }
    }
  }
  return null
}

export function placeableTools(): Tool[] {
  const extras: Exclude<Tool, BuildingKind | 'inspect'>[] = [
    'camping',
    'medicalArea',
    'wasteDump',
    'backstageArea',
    'road',
    'parkingArea',
    'roadDirection',
    'roadDirectionClear',
    'trafficLight',
    'pathBarrier',
    'roadSeparator',
    'roadSpeed10',
    'roadSpeed30',
    'roadSpeed50',
    'crosswalk',
    'deliveryYard',
    'supplyDepot',
    'staffGate',
    'coaster',
    'course',
    'terrainRaise',
    'terrainLower',
    'terrainSmooth',
    'terrainCoverGrass',
    'terrainCoverSand',
    'terrainCoverStone',
    'terrainCoverField',
    'terrainCoverSnow',
    'terrainCoverRock',
    'terrainCoverEarth',
    'terrainCoverSalt',
    'terrainCoverAsphalt',
    'powerCable',
    'bulldoze',
    'copy',
  ]
  return [...BUILDING_KINDS, ...extras]
}

export function unusedBuildingKinds(): BuildingKind[] {
  const listed = new Set<BuildingKind>()
  for (const category of BUILD_CATEGORIES) {
    for (const group of category.groups) {
      for (const item of group.items) {
        if (item.previewKind) listed.add(item.previewKind)
        if ((BUILDING_KINDS as readonly string[]).includes(item.tool)) {
          listed.add(item.tool as BuildingKind)
        }
      }
    }
  }
  return BUILDING_KINDS.filter((kind) => !listed.has(kind))
}
