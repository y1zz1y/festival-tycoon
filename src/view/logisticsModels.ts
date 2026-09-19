import { Group, Mesh, MeshStandardMaterial } from 'three'
import { ModelKit } from './retroBuildings'
import type { BuildingKind } from '../game/catalog'
import type { RoadVehicleKind } from '../game/logistics'

const ink = 0x28363b
const cream = 0xf2dfb5
const timber = 0x936141
const steel = 0x92a6a5
const asphalt = 0x3c4247
const glass = 0x6a8ea0

const facilityMaterial = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.85,
  metalness: 0.05,
})
facilityMaterial.userData.shared = true

const vehicleMaterial = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.55,
  metalness: 0.12,
})
vehicleMaterial.userData.shared = true

export const LOGISTICS_FACILITY_KINDS = [
  'busStop',
  'busDepot',
  'wasteDepot',
  'specialDepot',
  'ambulanceGarage',
  'fireStation',
  'tourBusParking',
] as const satisfies readonly BuildingKind[]

export type LogisticsFacilityKind = (typeof LOGISTICS_FACILITY_KINDS)[number]
export type SupplyStructureKind = 'delivery' | 'supply'

export const VISITOR_CAR_COLORS = [
  0x3479ad, // blau
  0xc45c4a, // rot
  0xe0b84a, // gelb
  0x4f8f5c, // grün
  0xd4a574, // beige
  0x6b5b95, // violett
  0xe8e6e0, // silber
  0x2f3238, // dunkel
  0xd4783a, // orange
  0x4a9aaa, // petrol
  0xb85a7a, // beere
  0x7a9a4a, // oliv
] as const

const facilityGeometries = new Map<string, ReturnType<ModelKit['finish']>>()
const vehicleGeometries = new Map<string, ReturnType<ModelKit['finish']>>()

export function logisticsFacilityFootprint(kind: LogisticsFacilityKind): number {
  if (kind === 'busStop' || kind === 'tourBusParking') return 1
  if (kind === 'busDepot' || kind === 'specialDepot') return 3
  return 2
}

export function visitorCarColor(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return VISITOR_CAR_COLORS[Math.abs(hash) % VISITOR_CAR_COLORS.length]!
}

function meshFrom(
  key: string,
  cache: Map<string, ReturnType<ModelKit['finish']>>,
  build: () => ReturnType<ModelKit['finish']>,
  material: MeshStandardMaterial,
): Group {
  let geometry = cache.get(key)
  if (!geometry) {
    geometry = build()
    geometry.userData.shared = true
    cache.set(key, geometry)
  }
  const group = new Group()
  const mesh = new Mesh(geometry, material)
  mesh.castShadow = mesh.receiveShadow = true
  mesh.userData.retroStatic = true
  group.add(mesh)
  return group
}

function buildBusStop(): ReturnType<ModelKit['finish']> {
  const k = new ModelKit()
  k.box(0, 0.02, 0, 0.9, 0.04, 0.86, asphalt)
  k.box(0, 0.045, 0.08, 0.78, 0.03, 0.34, 0x6a7074)
  for (const x of [-0.32, 0.16]) {
    k.box(x, 0.42, -0.18, 0.045, 0.8, 0.045, ink)
  }
  k.box(-0.08, 0.84, -0.18, 0.72, 0.05, 0.5, 0x356d91)
  k.box(-0.08, 0.82, -0.18, 0.66, 0.03, 0.44, 0x2a5a78)
  k.box(-0.08, 0.48, -0.42, 0.7, 0.55, 0.03, 0x4a7fa0)
  for (const x of [-0.28, -0.08, 0.12]) {
    k.box(x, 0.48, -0.405, 0.015, 0.48, 0.02, steel)
  }
  k.box(-0.08, 0.28, -0.05, 0.62, 0.05, 0.2, 0x356d91)
  k.box(-0.08, 0.2, -0.05, 0.58, 0.08, 0.16, cream)
  k.box(0.36, 0.55, 0.08, 0.05, 1.05, 0.05, ink)
  k.box(0.36, 1.05, 0.08, 0.28, 0.28, 0.04, 0x2f75ad)
  k.box(0.36, 1.05, 0.11, 0.16, 0.06, 0.03, cream)
  k.box(0.36, 0.72, 0.12, 0.18, 0.22, 0.03, 0x24343a)
  k.box(0.36, 0.72, 0.14, 0.14, 0.16, 0.02, cream)
  for (let i = 0; i < 4; i++) k.box(0.36, 0.8 - i * 0.035, 0.155, 0.11, 0.01, 0.008, ink)
  return k.finish()
}

function buildPad(k: ModelKit, size: number, color = asphalt): void {
  k.box(0, 0.05, 0, size - 0.1, 0.1, size - 0.1, color)
}

function buildBusDepot(): ReturnType<ModelKit['finish']> {
  const k = new ModelKit()
  const size = 3
  buildPad(k, size)
  k.box(0, 0.08, 0, size - 0.22, 0.04, size - 0.22, 0x4a5055)
  // Hall body open to +z
  k.box(0, 0.72, -0.15, 2.55, 1.3, 2.2, 0x6a7a86)
  k.box(0, 1.42, -0.1, 2.7, 0.14, 2.4, 0x2c343a)
  k.box(0, 1.52, -0.1, 2.4, 0.08, 2.1, 0x3a454c)
  for (const x of [-1.2, 1.2]) {
    k.box(x, 0.75, 0.95, 0.12, 1.35, 0.12, ink)
  }
  k.box(0, 1.4, 0.95, 2.52, 0.1, 0.12, ink)
  // Bay stripes and door frames
  for (const x of [-0.8, 0, 0.8]) {
    k.box(x, 0.7, 0.98, 0.08, 1.2, 0.06, 0xe0a832)
    k.box(x, 0.12, 0.7, 0.55, 0.03, 1.1, 0xd7b45b)
  }
  // Side office
  k.box(-1.05, 0.55, -1.05, 0.7, 0.95, 0.7, 0x546575)
  k.box(-1.05, 1.1, -1.05, 0.78, 0.1, 0.78, cream)
  k.box(-1.05, 0.7, -0.68, 0.35, 0.28, 0.04, glass)
  k.box(-1.05, 0.42, -0.68, 0.22, 0.35, 0.04, ink)
  // Fuel / service posts
  for (const x of [0.55, 1.05]) {
    k.box(x, 0.35, 1.15, 0.16, 0.55, 0.16, ink)
    k.box(x, 0.68, 1.15, 0.22, 0.08, 0.22, 0xe0a832)
    k.cylinder(x, 0.85, 1.15, 0.04, 0.22, steel)
  }
  // Roof vents
  for (const x of [-0.6, 0.6]) {
    k.box(x, 1.65, -0.4, 0.28, 0.16, 0.4, ink)
  }
  return k.finish()
}

function buildWasteDepot(): ReturnType<ModelKit['finish']> {
  const k = new ModelKit()
  buildPad(k, 2, 0x3a4038)
  k.box(0, 0.08, 0, 1.8, 0.04, 1.8, 0x4a5244)
  k.box(0, 0.58, -0.08, 1.55, 0.95, 1.35, 0x4a5a3a)
  k.box(0, 1.12, -0.05, 1.7, 0.12, 1.5, 0x2f332c)
  k.box(0, 1.22, -0.05, 1.5, 0.08, 1.3, 0x3d4436)
  // Open loading face
  k.box(0, 0.55, 0.62, 1.2, 0.85, 0.06, ink)
  k.box(-0.55, 0.55, 0.55, 0.1, 0.9, 0.2, 0x3d4a2e)
  k.box(0.55, 0.55, 0.55, 0.1, 0.9, 0.2, 0x3d4a2e)
  k.box(0, 1.05, 0.55, 1.2, 0.1, 0.2, 0x2f332c)
  // Dumpsters
  for (const x of [-0.45, 0.45]) {
    k.box(x, 0.28, 0.78, 0.38, 0.4, 0.32, 0x3d4a2e)
    k.box(x, 0.5, 0.78, 0.4, 0.05, 0.34, 0x2a3226)
    k.box(x, 0.35, 0.96, 0.08, 0.12, 0.04, steel)
  }
  // Side crates / sacks
  k.box(0.7, 0.22, -0.55, 0.28, 0.28, 0.28, 0x6a5538)
  k.box(0.7, 0.42, -0.55, 0.24, 0.12, 0.24, 0x8a6a42)
  k.box(-0.7, 0.2, -0.4, 0.22, 0.24, 0.36, 0x4a5a3a)
  // Warning stripe
  for (let i = 0; i < 5; i++) {
    k.box(-0.7 + i * 0.35, 0.1, 0.85, 0.28, 0.03, 0.08, i % 2 ? 0xe0a832 : ink)
  }
  return k.finish()
}

/** A small maintenance yard for the sweepers, built the same way the bus depot reads well:
 * an enclosed hall with a side office, not a scatter of lane paint across open ground. */
function buildSpecialDepot(): ReturnType<ModelKit['finish']> {
  const k = new ModelKit()
  const size = 3
  buildPad(k, size)
  k.box(0, 0.08, 0, size - 0.22, 0.04, size - 0.22, 0x4a5055)
  // Workshop hall, open to +z
  k.box(0, 0.6, -0.35, 2.15, 1.05, 1.7, 0x6a7a86)
  k.box(0, 1.2, -0.3, 2.3, 0.12, 1.9, 0x2c343a)
  k.box(0, 1.28, -0.3, 2.0, 0.06, 1.6, 0x3a454c)
  for (const x of [-0.95, 0.95]) {
    k.box(x, 0.62, 0.5, 0.1, 1.1, 0.1, ink)
  }
  k.box(0, 1.15, 0.5, 1.98, 0.08, 0.1, ink)
  // Bay stripes on the open front
  for (const x of [-0.55, 0, 0.55]) {
    k.box(x, 0.58, 0.53, 0.06, 0.9, 0.05, 0xe0a832)
  }
  // Side office
  k.box(-1.05, 0.42, -1.05, 0.65, 0.68, 0.65, 0x546575)
  k.box(-1.05, 0.78, -1.05, 0.73, 0.08, 0.73, cream)
  k.box(-1.05, 0.5, -0.72, 0.32, 0.24, 0.04, glass)
  k.box(-1.05, 0.28, -0.72, 0.2, 0.3, 0.04, ink)
  // Two clean lane lines out front instead of a dense grid
  k.box(0, 0.09, 1.0, 1.9, 0.02, 0.06, 0xd7b45b)
  k.box(0, 0.09, 1.32, 1.9, 0.02, 0.06, 0xd7b45b)
  // Tool racks against the hall
  for (const x of [0.75, 1.2]) {
    k.box(x, 0.5, -1.15, 0.28, 0.7, 0.12, steel)
    for (let i = 0; i < 3; i++) {
      k.box(x, 0.32 + i * 0.2, -1.06, 0.22, 0.03, 0.04, cream)
    }
  }
  return k.finish()
}

function buildAmbulanceGarage(): ReturnType<ModelKit['finish']> {
  const k = new ModelKit()
  buildPad(k, 2, 0x4a5258)
  k.box(0, 0.08, 0, 1.8, 0.04, 1.8, 0x5a636a)
  k.box(0, 0.65, -0.1, 1.55, 1.15, 1.4, 0x6a7e90)
  k.box(0, 1.28, -0.08, 1.7, 0.12, 1.55, 0xf4f4ee)
  k.box(0, 1.38, -0.08, 1.5, 0.08, 1.35, 0xe0e4e8)
  k.box(-0.7, 0.65, 0.62, 0.12, 1.15, 0.12, ink)
  k.box(0, 0.65, 0.62, 0.08, 1.15, 0.1, ink)
  k.box(0.7, 0.65, 0.62, 0.12, 1.15, 0.12, ink)
  k.box(0, 1.25, 0.62, 1.52, 0.1, 0.12, ink)
  k.box(-0.35, 0.1, 0.45, 0.55, 0.03, 0.9, 0xf4f4ee)
  k.box(0.35, 0.1, 0.45, 0.55, 0.03, 0.9, 0xf4f4ee)
  // Medical cross
  k.box(0, 0.95, -0.82, 0.12, 0.45, 0.04, 0xd73832)
  k.box(0, 0.95, -0.82, 0.45, 0.12, 0.04, 0xd73832)
  k.box(0, 0.95, -0.8, 0.08, 0.35, 0.03, cream)
  k.box(0, 0.95, -0.8, 0.35, 0.08, 0.03, cream)
  // Side window / door
  k.box(0.8, 0.7, 0, 0.04, 0.35, 0.4, glass)
  k.box(-0.8, 0.55, 0.1, 0.04, 0.55, 0.28, ink)
  return k.finish()
}

function buildDeliveryYard(): ReturnType<ModelKit['finish']> {
  const k = new ModelKit()
  k.box(0, 0.06, 0, 0.92, 0.12, 0.92, 0x635544)
  k.box(0, 0.14, 0, 0.84, 0.05, 0.84, 0x7a6a52)
  // Dock platform
  k.box(0, 0.32, 0.18, 0.78, 0.32, 0.55, 0xc9a45f)
  k.box(0, 0.52, 0.18, 0.82, 0.08, 0.6, 0xd5af5c)
  // Canopy
  for (const x of [-0.35, 0.35]) {
    k.box(x, 0.7, -0.05, 0.06, 0.85, 0.06, ink)
  }
  k.box(0, 1.15, -0.02, 0.88, 0.08, 0.7, 0xd5af5c)
  k.box(0, 1.1, 0.34, 0.88, 0.06, 0.05, cream)
  // Open loading mouth
  k.box(0, 0.45, -0.28, 0.55, 0.55, 0.05, 0x283e3a)
  k.box(0.28, 0.28, -0.35, 0.26, 0.28, 0.26, 0xd1a16a)
  k.box(-0.22, 0.22, -0.38, 0.2, 0.2, 0.2, 0xb8894e)
  k.box(-0.22, 0.36, -0.38, 0.16, 0.08, 0.16, 0xcba16e)
  // Ramp stripes
  for (let i = 0; i < 4; i++) {
    k.box(-0.28 + i * 0.18, 0.18, 0.42, 0.12, 0.03, 0.2, i % 2 ? 0xe0a832 : ink)
  }
  return k.finish()
}

function buildSupplyDepot(): ReturnType<ModelKit['finish']> {
  const k = new ModelKit()
  k.box(0, 0.06, 0, 0.92, 0.12, 0.92, 0x635544)
  k.box(0, 0.45, 0.05, 0.78, 0.72, 0.68, 0x678d82)
  k.box(0, 0.88, 0, 0.9, 0.12, 0.82, 0xd5af5c)
  k.box(0, 0.96, 0, 0.78, 0.06, 0.7, cream)
  // Door and shelf peek
  k.box(0, 0.42, -0.32, 0.42, 0.55, 0.04, 0x283e3a)
  k.box(0.28, 0.28, -0.35, 0.24, 0.28, 0.22, 0xd1a16a)
  for (let i = 0; i < 3; i++) {
    k.box(-0.22, 0.35 + i * 0.14, 0.35, 0.28, 0.04, 0.12, timber)
    k.box(-0.22, 0.4 + i * 0.14, 0.35, 0.22, 0.08, 0.08, i % 2 ? 0xc9a45f : 0x4a8a78)
  }
  k.box(0.25, 0.55, 0.36, 0.2, 0.35, 0.08, steel)
  k.box(0.25, 0.72, 0.36, 0.16, 0.05, 0.1, cream)
  // Corner posts
  for (const x of [-0.4, 0.4]) {
    for (const z of [-0.32, 0.32]) {
      k.box(x, 0.5, z, 0.06, 0.8, 0.06, ink)
    }
  }
  return k.finish()
}

function buildVisitorCar(color: number): ReturnType<ModelKit['finish']> {
  const k = new ModelKit()
  const roof = color === 0xe8e6e0 ? 0xd8d6d0 : color
  k.box(0, 0.1, 0, 0.52, 0.06, 0.82, ink)
  k.box(0, 0.22, 0, 0.48, 0.18, 0.78, color)
  k.box(0, 0.38, -0.02, 0.42, 0.18, 0.42, roof)
  // Windows
  k.box(0, 0.4, 0.2, 0.36, 0.12, 0.03, glass)
  k.box(0, 0.4, -0.24, 0.34, 0.12, 0.03, glass)
  for (const x of [-0.215, 0.215]) {
    k.box(x, 0.4, -0.02, 0.02, 0.12, 0.34, glass)
  }
  // Bumpers / lights
  k.box(0, 0.16, 0.4, 0.46, 0.08, 0.05, 0x2a2e32)
  k.box(0, 0.16, -0.4, 0.46, 0.08, 0.05, 0x2a2e32)
  for (const x of [-0.16, 0.16]) {
    k.box(x, 0.18, 0.42, 0.08, 0.05, 0.03, 0xf2e6a8)
    k.box(x, 0.18, -0.42, 0.08, 0.05, 0.03, 0xd73832)
  }
  // Side trim
  k.box(0, 0.2, 0, 0.5, 0.03, 0.76, 0x1c2226)
  // Wheels (boxes stay axis-aligned in ModelKit merges)
  for (const x of [-0.24, 0.24]) {
    for (const z of [-0.24, 0.24]) {
      k.box(x, 0.1, z, 0.06, 0.16, 0.16, 0x1a1c1e)
      k.box(x, 0.1, z, 0.065, 0.07, 0.07, steel)
    }
  }
  // Roof rails / antenna
  k.box(0, 0.49, -0.05, 0.28, 0.02, 0.3, ink)
  k.cylinder(0.12, 0.56, -0.18, 0.012, 0.12, ink)
  return k.finish()
}

function buildFireStation(): ReturnType<ModelKit['finish']> {
  const k = new ModelKit()
  buildPad(k, 2, 0x4a3a38)
  k.box(0, 0.08, 0, 1.8, 0.04, 1.8, 0x6a4a44)
  k.box(0, 0.65, -0.1, 1.55, 1.15, 1.4, 0xc94135)
  k.box(0, 1.28, -0.08, 1.7, 0.12, 1.55, 0xf4f4ee)
  k.box(-0.7, 0.65, 0.62, 0.12, 1.15, 0.12, ink)
  k.box(0, 0.65, 0.62, 0.08, 1.15, 0.1, ink)
  k.box(0.7, 0.65, 0.62, 0.12, 1.15, 0.12, ink)
  k.box(0, 1.25, 0.62, 1.52, 0.1, 0.12, ink)
  k.box(-0.35, 0.1, 0.45, 0.55, 0.03, 0.9, 0xf4e4c8)
  k.box(0.35, 0.1, 0.45, 0.55, 0.03, 0.9, 0xf4e4c8)
  return k.finish()
}

function buildFireTruck(): ReturnType<ModelKit['finish']> {
  const k = new ModelKit()
  k.box(0, 0.1, 0, 0.52, 0.06, 0.88, ink)
  k.box(0, 0.26, 0, 0.5, 0.24, 0.84, 0xc94135)
  k.box(0, 0.46, -0.12, 0.46, 0.22, 0.42, 0xc94135)
  k.box(0, 0.44, 0.28, 0.4, 0.14, 0.22, 0xf4f4ee)
  k.box(0, 0.56, -0.12, 0.18, 0.08, 0.28, 0xe0a832)
  for (const x of [-0.24, 0.24]) {
    for (const z of [-0.26, 0.28]) {
      k.box(x, 0.1, z, 0.06, 0.16, 0.16, 0x1a1c1e)
    }
  }
  return k.finish()
}

function buildAmbulance(): ReturnType<ModelKit['finish']> {
  const k = new ModelKit()
  const body = 0xf4f4ee
  k.box(0, 0.1, 0, 0.52, 0.06, 0.82, ink)
  k.box(0, 0.24, 0, 0.48, 0.22, 0.78, body)
  k.box(0, 0.42, -0.05, 0.44, 0.22, 0.5, body)
  k.box(0, 0.42, 0.28, 0.4, 0.16, 0.18, body)
  k.box(0, 0.42, 0.38, 0.32, 0.12, 0.03, glass)
  k.box(0, 0.32, 0, 0.5, 0.04, 0.7, 0xd73832)
  k.box(0, 0.32, 0, 0.18, 0.04, 0.78, 0xd73832)
  k.box(0, 0.56, -0.05, 0.2, 0.08, 0.12, 0x2878d1)
  for (const x of [-0.24, 0.24]) {
    for (const z of [-0.24, 0.24]) {
      k.box(x, 0.1, z, 0.06, 0.16, 0.16, 0x1a1c1e)
    }
  }
  return k.finish()
}

function buildBus(): ReturnType<ModelKit['finish']> {
  const k = new ModelKit()
  const yellow = 0xe0a832
  k.box(0, 0.12, 0, 0.66, 0.08, 1.4, ink)
  k.box(0, 0.4, 0, 0.62, 0.5, 1.36, yellow)
  k.box(0, 0.72, 0, 0.58, 0.12, 1.32, 0xc99228)
  k.box(0, 0.48, 0.68, 0.5, 0.22, 0.04, glass)
  for (const z of [-0.45, -0.1, 0.25, 0.5]) {
    for (const x of [-0.32, 0.32]) {
      k.box(x, 0.48, z, 0.02, 0.2, 0.22, glass)
    }
  }
  k.box(0.2, 0.35, 0.7, 0.12, 0.35, 0.04, ink)
  for (const z of [-0.48, 0.48]) {
    for (const x of [-0.32, 0.32]) {
      k.box(x, 0.12, z, 0.07, 0.2, 0.2, 0x1a1c1e)
    }
  }
  k.box(0, 0.78, 0.2, 0.2, 0.06, 0.12, 0x2f75ad)
  return k.finish()
}

/** Longer dark coach — not the yellow shuttle `bus`. One merged mesh. */
function buildTourBus(): ReturnType<ModelKit['finish']> {
  const k = new ModelKit()
  const hull = 0x2a3340
  const stripe = 0xc9a45f
  const bay = 0x1a1e24
  k.box(0, 0.12, 0, 0.72, 0.08, 1.72, ink)
  k.box(0, 0.42, 0, 0.68, 0.52, 1.68, hull)
  k.box(0, 0.78, 0, 0.64, 0.14, 1.64, 0x1c242c)
  k.box(0, 0.58, 0, 0.7, 0.05, 1.66, stripe)
  k.box(0, 0.5, 0.84, 0.54, 0.24, 0.04, 0x4a6570)
  for (const z of [-0.62, -0.22, 0.18, 0.52]) {
    for (const x of [-0.35, 0.35]) {
      k.box(x, 0.5, z, 0.02, 0.2, 0.24, 0x4a6570)
    }
  }
  k.box(0.22, 0.36, 0.86, 0.14, 0.38, 0.04, ink)
  for (const z of [-0.55, 0.05, 0.55]) {
    k.box(0, 0.22, z, 0.62, 0.14, 0.28, bay)
  }
  for (const z of [-0.62, 0.62]) {
    for (const x of [-0.34, 0.34]) {
      k.box(x, 0.12, z, 0.08, 0.2, 0.2, 0x1a1c1e)
    }
  }
  k.box(0, 0.86, 0.28, 0.28, 0.06, 0.16, stripe)
  k.box(0, 0.86, -0.36, 0.22, 0.08, 0.28, 0x24303a)
  return k.finish()
}

function buildGarbageTruck(): ReturnType<ModelKit['finish']> {
  const k = new ModelKit()
  const cab = 0x3f6b3a
  const hopper = 0x4a4f45
  k.box(0, 0.1, 0, 0.5, 0.08, 0.95, ink)
  // Cab
  k.box(0, 0.28, 0.28, 0.44, 0.28, 0.38, cab)
  k.box(0, 0.48, 0.26, 0.38, 0.2, 0.28, cab)
  k.box(0, 0.48, 0.42, 0.32, 0.14, 0.03, glass)
  for (const x of [-0.2, 0.2]) k.box(x, 0.48, 0.26, 0.02, 0.14, 0.22, glass)
  // Hopper
  k.box(0, 0.38, -0.22, 0.48, 0.42, 0.62, hopper)
  k.box(0, 0.62, -0.22, 0.42, 0.08, 0.55, 0x2f332c)
  k.box(0, 0.42, -0.55, 0.4, 0.32, 0.08, 0x3a4038)
  // Rear lifter arms
  for (const x of [-0.18, 0.18]) {
    k.box(x, 0.45, -0.62, 0.05, 0.35, 0.05, steel)
    k.box(x, 0.28, -0.7, 0.05, 0.05, 0.16, steel)
  }
  k.box(0, 0.22, -0.72, 0.36, 0.08, 0.1, 0x2a3226)
  // Lights
  for (const x of [-0.14, 0.14]) {
    k.box(x, 0.2, 0.48, 0.07, 0.05, 0.03, 0xf2e6a8)
  }
  k.box(0, 0.68, 0.1, 0.12, 0.05, 0.08, 0xe0a832)
  for (const x of [-0.22, 0.22]) {
    for (const z of [-0.35, 0.05, 0.35]) {
      k.box(x, 0.11, z, 0.055, 0.16, 0.16, 0x1a1c1e)
    }
  }
  return k.finish()
}

function buildDeliveryTruck(): ReturnType<ModelKit['finish']> {
  const k = new ModelKit()
  const box = 0xe1bb62
  const cab = 0x518fa0
  // Nose toward +Z so LogisticsView facing matches travel direction.
  k.box(0, 0.1, 0, 0.5, 0.08, 0.88, ink)
  k.box(0, 0.35, 0.35, 0.42, 0.32, 0.28, cab)
  k.box(0, 0.48, 0.35, 0.38, 0.16, 0.22, cab)
  k.box(0, 0.48, 0.5, 0.3, 0.12, 0.03, glass)
  for (const x of [-0.2, 0.2]) k.box(x, 0.48, 0.35, 0.02, 0.12, 0.18, glass)
  k.box(0, 0.38, -0.08, 0.48, 0.42, 0.55, box)
  k.box(0, 0.62, -0.08, 0.44, 0.06, 0.5, 0xc9a45f)
  k.box(0, 0.4, -0.36, 0.4, 0.28, 0.03, 0xc9a45f)
  k.box(0, 0.52, -0.08, 0.46, 0.05, 0.52, cream)
  for (const x of [-0.2, 0.2]) {
    for (const z of [-0.22, 0.32]) {
      k.box(x, 0.11, z, 0.055, 0.16, 0.16, 0x1a1c1e)
    }
  }
  for (const x of [-0.14, 0.14]) {
    k.box(x, 0.2, 0.5, 0.07, 0.05, 0.03, 0xf2e6a8)
  }
  return k.finish()
}

function buildSweeper(): ReturnType<ModelKit['finish']> {
  const k = new ModelKit()
  k.box(0, 0.1, -0.02, 0.4, 0.08, 0.46, ink)
  k.box(0, 0.28, -0.04, 0.36, 0.26, 0.34, 0xf2f4f0)
  k.box(0, 0.44, -0.04, 0.38, 0.04, 0.36, 0x3cb54a)
  for (const x of [-0.19, 0.19]) k.box(x, 0.3, -0.04, 0.02, 0.16, 0.3, 0x3cb54a)
  k.box(0, 0.33, 0.14, 0.3, 0.16, 0.02, glass)
  k.box(0, 0.32, -0.21, 0.22, 0.1, 0.02, glass)
  k.box(0, 0.13, 0.2, 0.38, 0.06, 0.06, ink)
  k.box(-0.1, 0.52, -0.12, 0.03, 0.14, 0.03, ink)
  k.box(-0.1, 0.57, -0.18, 0.03, 0.03, 0.12, ink)
  for (const [x, z] of [[-0.16, 0.28], [0.16, 0.28], [0, 0.38]] as const) {
    k.box(x, 0.05, z, 0.18, 0.04, 0.18, 0x1c2430)
  }
  for (const x of [-0.16, 0.16]) {
    for (const z of [-0.16, 0.08]) {
      k.box(x, 0.09, z, 0.05, 0.12, 0.12, 0x202326)
    }
  }
  return k.finish()
}

/** Two tiles long (z: -1 to 1), one wide — a coach's own length, not a car's. */
function buildTourBusParking(): ReturnType<ModelKit['finish']> {
  const k = new ModelKit()
  const white = 0xe8e6e0
  // Asphalt bay, the full two-tile length.
  k.box(0, 0.03, 0, 0.94, 0.06, 1.94, asphalt)
  // Painted outline the length and width of a coach, so the bay reads at a glance.
  k.box(-0.4, 0.065, 0, 0.05, 0.02, 1.7, white)
  k.box(0.4, 0.065, 0, 0.05, 0.02, 1.7, white)
  k.box(0, 0.065, -0.85, 0.85, 0.02, 0.05, white)
  k.box(0, 0.065, 0.85, 0.85, 0.02, 0.05, white)
  // A small sign at the near end: post, blue placard, white coach glyph.
  k.box(-0.62, 0.32, -0.78, 0.06, 0.6, 0.06, ink)
  k.box(-0.62, 0.64, -0.78, 0.34, 0.24, 0.03, 0x2f6fdb)
  k.box(-0.62, 0.64, -0.765, 0.22, 0.1, 0.02, white)
  k.box(-0.62, 0.575, -0.765, 0.26, 0.03, 0.02, white)
  return k.finish()
}

export function createLogisticsFacility(kind: LogisticsFacilityKind): Group {
  const builders: Record<LogisticsFacilityKind, () => ReturnType<ModelKit['finish']>> = {
    busStop: buildBusStop,
    busDepot: buildBusDepot,
    wasteDepot: buildWasteDepot,
    specialDepot: buildSpecialDepot,
    ambulanceGarage: buildAmbulanceGarage,
    fireStation: buildFireStation,
    tourBusParking: buildTourBusParking,
  }
  return meshFrom(kind, facilityGeometries, builders[kind], facilityMaterial)
}

export function createSupplyStructure(kind: SupplyStructureKind): Group {
  return meshFrom(
    `supply:${kind}`,
    facilityGeometries,
    kind === 'delivery' ? buildDeliveryYard : buildSupplyDepot,
    facilityMaterial,
  )
}

export function createRoadVehicleModel(
  kind: RoadVehicleKind,
  seed: string = kind,
): Group {
  if (kind === 'visitorCar') {
    const color = visitorCarColor(seed)
    return meshFrom(
      `visitorCar:${color}`,
      vehicleGeometries,
      () => buildVisitorCar(color),
      vehicleMaterial,
    )
  }
  const builders: Record<Exclude<RoadVehicleKind, 'visitorCar'>, () => ReturnType<ModelKit['finish']>> = {
    ambulance: buildAmbulance,
    fireTruck: buildFireTruck,
    bus: buildBus,
    garbageTruck: buildGarbageTruck,
    deliveryTruck: buildDeliveryTruck,
    sweeper: buildSweeper,
    tourBus: buildTourBus,
  }
  return meshFrom(kind, vehicleGeometries, builders[kind], vehicleMaterial)
}

/** Compact menu/thumbnail scale so multi-tile depots fit the 96px orthographic frame. */
export function logisticsThumbnailScale(kind: LogisticsFacilityKind): number {
  const footprint = logisticsFacilityFootprint(kind)
  if (footprint <= 1) return 1
  if (footprint === 2) return 0.48
  return 0.34
}
