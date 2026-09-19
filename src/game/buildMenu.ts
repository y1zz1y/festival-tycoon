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

export function buildingMenuItem(kind: BuildingKind, detail?: string): BuildMenuItem {
  const building = BUILDINGS[kind]
  return {
    tool: kind,
    name: building.name,
    icon: building.icon,
    detail: detail ?? `${Math.floor(building.cost).toLocaleString('de-DE')} €`,
    previewKind: kind,
  }
}

function toolItem(
  tool: Tool,
  name: string,
  icon: string,
  detail: string,
  extra?: Pick<BuildMenuItem, 'bungee' | 'previewKind' | 'previewSupply' | 'coasterTypeId' | 'courseKind'>,
): BuildMenuItem {
  return { tool, name, icon, detail, ...extra }
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
  const stationCost = `${Math.floor(TRACK_PIECES.station.cost).toLocaleString('de-DE')} €`
  return listPlayableCoasterCatalogTypes().map((entry) =>
    toolItem('coaster', entry.name, COASTER_TYPE_ICONS[entry.id], `ab ${stationCost}`, {
      coasterTypeId: entry.id,
    }),
  )
}

export const BUILD_CATEGORIES: readonly BuildCategory[] = [
  {
    id: 'bulldoze',
    label: 'Abriss',
    icon: '💣',
    dock: 'left',
    groups: [
      {
        id: 'main',
        label: 'Abriss',
        items: [toolItem('bulldoze', 'Abriss', '💣', 'Gebäude und Wege')],
      },
    ],
  },
  {
    id: 'terrain',
    label: 'Gelände',
    icon: '🚜',
    dock: 'left',
    extra: 'terrain',
    groups: [
      {
        id: 'shape',
        label: 'Form',
        items: [
          toolItem('terrainRaise', 'Anheben', '🔼', '+0,5'),
          toolItem('terrainLower', 'Absenken', '🔽', '−0,5'),
          toolItem('terrainSmooth', 'Glätten', '〰️', 'Einebnen'),
        ],
      },
    ],
  },
  {
    id: 'copy',
    label: 'Kopieren',
    icon: '⧉',
    dock: 'left',
    extra: 'copy',
    groups: [
      {
        id: 'main',
        label: 'Kopieren',
        items: [toolItem('copy', 'Bereich kopieren', '⧉', 'Rechteck aufziehen')],
      },
    ],
  },
  {
    id: 'decoration',
    label: 'Dekoration',
    icon: '🪑',
    dock: 'left',
    extra: 'decoration',
    groups: DECORATION_CATEGORY_IDS.map((id) => ({
      id,
      label: DECORATION_CATEGORY_LABELS[id],
      items: decorationKindsInCategory(id).map((kind) => buildingMenuItem(kind)),
    })),
  },
  {
    id: 'paths',
    label: 'Wege',
    icon: '🛤️',
    dock: 'left',
    extra: 'paths',
    groups: [
      {
        id: 'main',
        label: 'Wege',
        items: [buildingMenuItem('path', 'Linie ziehen')],
      },
    ],
  },
  {
    id: 'attractions',
    label: 'Attraktionen',
    icon: '🎡',
    dock: 'left',
    extra: 'attractions',
    groups: [
      {
        id: 'rides',
        label: 'Fahrgeschäfte',
        items: [
          buildingMenuItem('ride'),
          toolItem('ride', 'Bungee-Turm', '🪂', '1.200 € + 25 €/Meter', {
            bungee: true,
          }),
        ],
      },
      {
        id: 'coasters',
        label: 'Achterbahn',
        items: coasterTypeItems(),
      },
      {
        id: 'courses',
        label: 'Kurse',
        items: COURSE_KINDS.map((kind) =>
          toolItem(
            'course',
            COURSE_SPECS[kind].name,
            COURSE_SPECS[kind].icon,
            `${COURSE_SPECS[kind].startCost.toLocaleString('de-DE')} € · ${
              kind === 'mudmasters'
                ? 'Hindernisparcours'
                : kind === 'pool'
                  ? 'Becken und Rutschen'
                  : kind === 'treeToTree'
                    ? 'Bäume und Seilbahnen'
                    : 'Spielfeld mit Teams'
            }`,
            { courseKind: kind },
          ),
        ),
      },
      {
        id: 'stalls',
        label: 'Stände',
        items: [
          buildingMenuItem('food'),
          buildingMenuItem('toilet'),
          buildingMenuItem('alcohol'),
          buildingMenuItem('mascot'),
          buildingMenuItem('shirt'),
          buildingMenuItem('securityGate'),
        ],
      },
      {
        id: 'camping',
        label: 'Camping',
        items: [toolItem('camping', 'Zeltbereich', '⛺', 'Gelände ausweisen')],
      },
      {
        id: 'festival',
        label: 'Festival',
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
    label: 'Straßen',
    icon: '🛣️',
    dock: 'left',
    extra: 'roads',
    groups: [
      {
        id: 'main',
        label: 'Straße',
        items: [
          toolItem('road', 'Straße', '▰', 'Linie ziehen'),
          toolItem('parkingArea', 'Parkplatz', '🅿', 'Fläche ziehen'),
          toolItem('roadDirection', 'Fahrtrichtung', '➜', 'Pfeil setzen'),
          toolItem('roadDirectionClear', 'Fahrtrichtung entfernen', '⇄', 'Wieder beide Richtungen'),
          toolItem('trafficLight', 'Ampel', '🚦', '120 € · eine Richtung'),
          toolItem('pathBarrier', 'Personentor', '🚧', '70 € · eine Richtung'),
          toolItem('roadSeparator', 'Trennlinie', '⛔', 'Kante sperren'),
          toolItem('crosswalk', 'Zebrastreifen', '▥', 'Überweg'),
          toolItem('roadSpeed10', 'Tempo 10', '10', 'Fahrbahn'),
          toolItem('roadSpeed30', 'Tempo 30', '30', 'Fahrbahn'),
          toolItem('roadSpeed50', 'Tempo 50', '50', 'Fahrbahn'),
        ],
      },
    ],
  },
  {
    id: 'logistics',
    label: 'Logistik',
    icon: '🚚',
    dock: 'left',
    extra: 'logistics',
    groups: [
      {
        id: 'freight',
        label: 'Waren',
        items: [
          toolItem('deliveryYard', 'Anlieferungsplatz', '📦', '400 € · an der Straße', {
            previewSupply: 'delivery',
          }),
          toolItem('supplyDepot', 'Depot', '🏪', '400 € · am Fußweg', {
            previewSupply: 'supply',
          }),
          toolItem('staffGate', 'Personaltor', '🛂', '80 € · Personal und Saugroboter'),
        ],
      },
      {
        id: 'bus',
        label: 'Bus',
        items: [buildingMenuItem('busStop'), buildingMenuItem('busDepot')],
      },
      {
        id: 'band',
        label: 'Bandversorgung',
        items: [
          toolItem(
            'backstageArea',
            'Backstage ausweisen',
            '🎤',
            `${SIMULATION_CONFIG.bandSupply.backstageDesignationCost} € je Feld · begehbar und bebaubar`,
          ),
          buildingMenuItem(
            'tourBusParking',
            `${Math.floor(BUILDINGS.tourBusParking.cost).toLocaleString('de-DE')} € · nur Backstage`,
          ),
        ],
      },
      {
        id: 'waste',
        label: 'Müll',
        items: [
          toolItem('wasteDump', 'Müllablage', '🗑️', 'sehr unattraktiv'),
          buildingMenuItem(
            'sealedWasteContainer',
            `${Math.floor(BUILDINGS.sealedWasteContainer.cost).toLocaleString('de-DE')} € · 80 Beutel · braucht Straßenanschluss`,
          ),
          buildingMenuItem(
            'wasteDepot',
            `${Math.floor(BUILDINGS.wasteDepot.cost).toLocaleString('de-DE')} € · Müllwagen starten und laden hier ab · braucht Straßenanschluss`,
          ),
          buildingMenuItem('specialDepot'),
        ],
      },
      {
        id: 'medical',
        label: 'Krankenhaus',
        items: [
          buildingMenuItem('ambulanceGarage'),
          buildingMenuItem('fireStation'),
          toolItem('medicalArea', 'Krankenbereich', '🏥', '3 Liegen je Feld'),
        ],
      },
      {
        id: 'power',
        label: 'Strom',
        items: [
          toolItem('powerCable', 'Stromkabel', '🔌', '18 € je Feld'),
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
