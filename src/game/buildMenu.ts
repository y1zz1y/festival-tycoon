import { BUILDING_KINDS, BUILDINGS } from './catalog'
import type { BuildingKind, Tool } from './catalog'

export const BUILD_CATEGORY_IDS = [
  'bulldoze',
  'terrain',
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

function buildingItem(kind: BuildingKind, detail?: string): BuildMenuItem {
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
  extra?: Pick<BuildMenuItem, 'bungee' | 'previewKind' | 'previewSupply'>,
): BuildMenuItem {
  return { tool, name, icon, detail, ...extra }
}

export const BUILD_CATEGORIES: readonly BuildCategory[] = [
  {
    id: 'bulldoze',
    label: 'Abriss',
    icon: '🚜',
    dock: 'left',
    groups: [
      {
        id: 'main',
        label: 'Abriss',
        items: [toolItem('bulldoze', 'Abriss', '🚜', 'Gebäude und Wege')],
      },
    ],
  },
  {
    id: 'terrain',
    label: 'Gelände',
    icon: '⛰',
    dock: 'left',
    extra: 'terrain',
    groups: [
      {
        id: 'shape',
        label: 'Form',
        items: [
          toolItem('terrainRaise', 'Erhöhen', '▲', '8 € je Feld'),
          toolItem('terrainLower', 'Senken', '▼', '8 € je Feld'),
          toolItem('terrainFlatten', 'Einebnen', '▬', 'auf Ebene 0'),
        ],
      },
    ],
  },
  {
    id: 'decoration',
    label: 'Dekoration',
    icon: '🌳',
    dock: 'left',
    extra: 'decoration',
    groups: [
      {
        id: 'plants',
        label: 'Pflanzen',
        items: [
          buildingItem('tree'),
          buildingItem('hedge'),
          buildingItem('shrub'),
          buildingItem('flowerbed'),
          buildingItem('planter'),
        ],
      },
      {
        id: 'furniture',
        label: 'Möbel',
        items: [
          buildingItem('bench'),
          buildingItem('picnicTable'),
          buildingItem('parasol'),
          buildingItem('hayBale'),
        ],
      },
      {
        id: 'lights',
        label: 'Licht',
        items: [
          buildingItem('lighting'),
          buildingItem('lightBalloon'),
          buildingItem('stringLights'),
          buildingItem('lanternPole'),
        ],
      },
      {
        id: 'festival',
        label: 'Fest',
        items: [
          buildingItem('statue'),
          buildingItem('banner'),
          buildingItem('bunting'),
          buildingItem('festivalSign'),
          buildingItem('totem'),
          buildingItem('flagPole'),
          buildingItem('kegStack'),
          buildingItem('inflatable'),
          buildingItem('prayerFlags'),
          buildingItem('fireBowl'),
          buildingItem('rock'),
        ],
      },
      {
        id: 'fence',
        label: 'Zaun',
        items: [buildingItem('fence')],
      },
    ],
  },
  {
    id: 'paths',
    label: 'Wege',
    icon: '▦',
    dock: 'left',
    extra: 'paths',
    groups: [
      {
        id: 'main',
        label: 'Wege',
        items: [buildingItem('path', 'Linie ziehen')],
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
          buildingItem('ride'),
          toolItem('coaster', 'Achterbahn', '🎢', 'ab 450 €'),
          toolItem('ride', 'Bungee-Turm', '🪂', '1.200 € + 25 €/Meter', {
            bungee: true,
            previewKind: 'ride',
          }),
        ],
      },
      {
        id: 'stalls',
        label: 'Stände',
        items: [
          buildingItem('food'),
          buildingItem('toilet'),
          buildingItem('alcohol'),
          buildingItem('securityGate'),
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
          buildingItem('stage'),
          buildingItem('directionalSpeaker'),
          buildingItem('omniSpeaker'),
          toolItem('powerCable', 'Stromkabel', '🔌', '18 € je Feld'),
          buildingItem('generator'),
          buildingItem('backupGenerator'),
          buildingItem('foh'),
          buildingItem('delayTower'),
          buildingItem('videoWall'),
          buildingItem('laserShow'),
          buildingItem('fireworkBattery'),
        ],
      },
    ],
  },
  {
    id: 'roads',
    label: 'Autostraßen',
    icon: '🛣️',
    dock: 'right',
    extra: 'roads',
    groups: [
      {
        id: 'main',
        label: 'Straße',
        items: [
          toolItem('road', 'Straße', '▰', 'Linie ziehen'),
          toolItem('parkingArea', 'Parkplatz', '🅿', 'Fläche ziehen'),
          toolItem('roadDirection', 'Fahrtrichtung', '➜', 'Pfeil setzen'),
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
          toolItem('staffGate', 'Personaltor', '🛂', '80 € · nur Personal'),
        ],
      },
      {
        id: 'bus',
        label: 'Bus',
        items: [buildingItem('busStop'), buildingItem('busDepot')],
      },
      {
        id: 'waste',
        label: 'Müll',
        items: [
          buildingItem('wasteBin'),
          toolItem('wasteDump', 'Müllablage', '🗑️', 'sehr unattraktiv'),
          buildingItem('wasteDepot'),
          buildingItem('specialDepot'),
        ],
      },
      {
        id: 'medical',
        label: 'Krankenhaus',
        items: [
          buildingItem('ambulanceGarage'),
          toolItem('medicalArea', 'Krankenbereich', '🏥', '3 Liegen je Feld'),
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
    'road',
    'parkingArea',
    'roadDirection',
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
    'terrainRaise',
    'terrainLower',
    'terrainFlatten',
    'powerCable',
    'bulldoze',
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
