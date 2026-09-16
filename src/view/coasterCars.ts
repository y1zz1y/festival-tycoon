import { Group, Mesh, MeshStandardMaterial } from 'three'
import type { CoasterTrainStyleId } from '../game/coasters'
import { ModelKit } from './retroBuildings'

const ink = 0x1c2428
const steel = 0x8a9698
const bar = 0xd8dde0
const seat = 0x2a3036
const carMaterial = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.42,
  metalness: 0.18,
})
carMaterial.userData.shared = true

const geometryByKey = new Map<string, ReturnType<ModelKit['finish']>>()

export const COASTER_CAR_SEATS = [
  { x: -0.08, y: 0.04, z: -0.1 },
  { x: 0.08, y: 0.04, z: -0.1 },
  { x: -0.08, y: 0.04, z: 0.08 },
  { x: 0.08, y: 0.04, z: 0.08 },
] as const

export type CoasterCarColors = {
  body: number
  accent?: number
}

function seatsForStyle(style: CoasterTrainStyleId): readonly { x: number; y: number; z: number }[] {
  if (style === 'mouse' || style === 'junior' || style === 'bobsled') {
    return [
      { x: -0.07, y: 0.04, z: 0 },
      { x: 0.07, y: 0.04, z: 0 },
    ]
  }
  if (style === 'invertV' || style === 'flying' || style === 'swinging') {
    return [
      { x: -0.08, y: -0.18, z: -0.08 },
      { x: 0.08, y: -0.18, z: -0.08 },
      { x: -0.08, y: -0.18, z: 0.08 },
      { x: 0.08, y: -0.18, z: 0.08 },
    ]
  }
  if (style === 'standUp') {
    return [
      { x: -0.08, y: 0.1, z: -0.08 },
      { x: 0.08, y: 0.1, z: -0.08 },
      { x: -0.08, y: 0.1, z: 0.08 },
      { x: 0.08, y: 0.1, z: 0.08 },
    ]
  }
  return COASTER_CAR_SEATS
}

export function getCoasterCarSeats(style: CoasterTrainStyleId = 'sitDownSteel'): readonly { x: number; y: number; z: number }[] {
  return seatsForStyle(style)
}

function buildSitDownSteel(kit: ModelKit, carColor: number, accent: number): void {
  kit.box(0, -0.05, 0, 0.38, 0.05, 0.64, ink)
  kit.box(0, -0.06, -0.2, 0.34, 0.04, 0.14, 0x2a3036)
  kit.box(0, -0.06, 0.2, 0.34, 0.04, 0.14, 0x2a3036)
  for (const x of [-0.2, 0.2]) {
    for (const z of [-0.2, 0.2]) kit.box(x, -0.07, z, 0.04, 0.1, 0.1, 0x111418)
  }
  kit.box(0, 0.01, -0.02, 0.32, 0.03, 0.44, carColor)
  kit.box(-0.16, 0.05, -0.02, 0.04, 0.06, 0.42, carColor)
  kit.box(0.16, 0.05, -0.02, 0.04, 0.06, 0.42, carColor)
  kit.box(-0.165, 0.07, -0.02, 0.02, 0.03, 0.4, accent)
  kit.box(0.165, 0.07, -0.02, 0.02, 0.03, 0.4, accent)
  kit.box(0, 0.1, -0.25, 0.34, 0.16, 0.05, carColor)
  kit.box(0, 0.06, 0.22, 0.3, 0.1, 0.1, carColor)
  kit.box(0, 0.05, 0.3, 0.2, 0.07, 0.08, carColor)
  kit.box(0, 0.04, 0.36, 0.1, 0.04, 0.05, ink)
  kit.box(0, 0.13, 0.2, 0.26, 0.02, 0.02, steel)
  for (const z of [-0.1, 0.08]) {
    kit.box(-0.08, 0.04, z, 0.12, 0.04, 0.1, seat)
    kit.box(0.08, 0.04, z, 0.12, 0.04, 0.1, seat)
    kit.box(-0.08, 0.14, z - 0.04, 0.12, 0.16, 0.035, seat)
    kit.box(0.08, 0.14, z - 0.04, 0.12, 0.16, 0.035, seat)
    kit.box(-0.08, 0.23, z - 0.04, 0.08, 0.04, 0.03, 0x3a4248)
    kit.box(0.08, 0.23, z - 0.04, 0.08, 0.04, 0.03, 0x3a4248)
    kit.box(0, 0.12, z + 0.06, 0.26, 0.016, 0.016, bar)
    kit.box(-0.1, 0.08, z + 0.06, 0.016, 0.08, 0.016, steel)
    kit.box(0.1, 0.08, z + 0.06, 0.016, 0.08, 0.016, steel)
  }
}

function buildWooden(kit: ModelKit, carColor: number, accent: number): void {
  kit.box(0, -0.04, 0, 0.4, 0.07, 0.7, 0x4a2f18)
  kit.box(0, 0.02, 0, 0.34, 0.05, 0.58, carColor)
  kit.box(0, 0.12, -0.28, 0.36, 0.18, 0.08, 0x6b4423)
  kit.box(0, 0.1, 0.28, 0.3, 0.12, 0.1, 0x6b4423)
  kit.box(0, 0.16, 0, 0.02, 0.02, 0.62, accent)
  for (const z of [-0.12, 0.1]) {
    kit.box(-0.08, 0.05, z, 0.13, 0.04, 0.12, 0x3b2a18)
    kit.box(0.08, 0.05, z, 0.13, 0.04, 0.12, 0x3b2a18)
    kit.box(-0.08, 0.16, z - 0.03, 0.12, 0.14, 0.04, 0x3b2a18)
    kit.box(0.08, 0.16, z - 0.03, 0.12, 0.14, 0.04, 0x3b2a18)
  }
}

function buildBmSitdown(kit: ModelKit, carColor: number, accent: number): void {
  kit.box(0, -0.03, 0, 0.42, 0.04, 0.7, ink)
  kit.box(0, 0.02, 0, 0.36, 0.04, 0.58, carColor)
  kit.box(0, 0.08, -0.28, 0.38, 0.12, 0.08, carColor)
  kit.box(0, 0.07, 0.28, 0.28, 0.08, 0.1, carColor)
  kit.box(0, 0.1, 0, 0.34, 0.02, 0.5, accent)
  for (const z of [-0.1, 0.1]) {
    kit.box(-0.09, 0.05, z, 0.13, 0.035, 0.12, seat)
    kit.box(0.09, 0.05, z, 0.13, 0.035, 0.12, seat)
    kit.box(-0.09, 0.12, z - 0.03, 0.12, 0.1, 0.03, seat)
    kit.box(0.09, 0.12, z - 0.03, 0.12, 0.1, 0.03, seat)
    kit.box(0, 0.14, z + 0.05, 0.3, 0.012, 0.012, bar)
  }
}

function buildInvertV(kit: ModelKit, carColor: number, accent: number): void {
  kit.box(0, 0.08, 0, 0.16, 0.08, 0.62, ink)
  kit.box(-0.12, 0.02, 0, 0.08, 0.06, 0.58, carColor)
  kit.box(0.12, 0.02, 0, 0.08, 0.06, 0.58, carColor)
  kit.box(0, 0.14, 0, 0.1, 0.04, 0.56, accent)
  for (const z of [-0.1, 0.1]) {
    kit.box(-0.08, -0.1, z, 0.1, 0.12, 0.1, seat)
    kit.box(0.08, -0.1, z, 0.1, 0.12, 0.1, seat)
    kit.box(-0.08, -0.2, z, 0.08, 0.04, 0.08, 0x1a1f24)
    kit.box(0.08, -0.2, z, 0.08, 0.04, 0.08, 0x1a1f24)
  }
}

function buildFlying(kit: ModelKit, carColor: number, accent: number): void {
  kit.box(0, 0.06, 0, 0.14, 0.06, 0.7, ink)
  kit.box(0, -0.02, 0, 0.36, 0.04, 0.64, carColor)
  kit.box(0, 0.02, 0, 0.3, 0.02, 0.6, accent)
  for (const z of [-0.12, 0.12]) {
    kit.box(-0.1, -0.08, z, 0.14, 0.03, 0.16, seat)
    kit.box(0.1, -0.08, z, 0.14, 0.03, 0.16, seat)
    kit.box(-0.1, -0.04, z + 0.06, 0.12, 0.04, 0.03, steel)
    kit.box(0.1, -0.04, z + 0.06, 0.12, 0.04, 0.03, steel)
  }
}

function buildStandUp(kit: ModelKit, carColor: number, accent: number): void {
  kit.box(0, -0.02, 0, 0.36, 0.05, 0.6, ink)
  kit.box(0, 0.06, 0, 0.3, 0.04, 0.5, carColor)
  kit.box(0, 0.22, 0, 0.28, 0.22, 0.08, carColor)
  kit.box(0, 0.28, 0, 0.22, 0.04, 0.06, accent)
  for (const z of [-0.1, 0.1]) {
    kit.box(-0.08, 0.12, z, 0.08, 0.16, 0.06, seat)
    kit.box(0.08, 0.12, z, 0.08, 0.16, 0.06, seat)
    kit.box(-0.08, 0.26, z, 0.06, 0.08, 0.05, 0x3a4248)
    kit.box(0.08, 0.26, z, 0.06, 0.08, 0.05, 0x3a4248)
  }
}

function buildJunior(kit: ModelKit, carColor: number, accent: number): void {
  kit.box(0, -0.03, 0, 0.3, 0.05, 0.46, ink)
  kit.cylinder(0, 0.04, 0, 0.16, 0.08, carColor, 0.16, 8)
  kit.box(0, 0.1, -0.16, 0.26, 0.1, 0.06, accent)
  kit.box(-0.07, 0.05, 0, 0.1, 0.04, 0.16, seat)
  kit.box(0.07, 0.05, 0, 0.1, 0.04, 0.16, seat)
}

function buildMouse(kit: ModelKit, carColor: number, accent: number): void {
  kit.box(0, -0.03, 0, 0.26, 0.05, 0.36, ink)
  kit.box(0, 0.03, 0, 0.22, 0.05, 0.28, carColor)
  kit.box(0, 0.09, -0.12, 0.22, 0.1, 0.06, accent)
  kit.box(-0.06, 0.05, 0.02, 0.09, 0.04, 0.12, seat)
  kit.box(0.06, 0.05, 0.02, 0.09, 0.04, 0.12, seat)
}

function buildBobsled(kit: ModelKit, carColor: number, accent: number): void {
  kit.box(0, 0.02, 0, 0.28, 0.12, 0.7, carColor)
  kit.box(0, 0.1, 0, 0.24, 0.04, 0.62, accent)
  kit.box(0, 0.08, -0.3, 0.26, 0.1, 0.08, carColor)
  kit.box(0, 0.08, 0.3, 0.22, 0.08, 0.08, carColor)
  kit.box(-0.06, 0.04, 0, 0.08, 0.04, 0.2, seat)
  kit.box(0.06, 0.04, 0, 0.08, 0.04, 0.2, seat)
}

function buildMine(kit: ModelKit, carColor: number, accent: number): void {
  kit.box(0, -0.04, 0, 0.4, 0.08, 0.66, 0x3f2a14)
  kit.box(0, 0.04, 0, 0.34, 0.08, 0.54, carColor)
  kit.box(0, 0.12, -0.24, 0.36, 0.12, 0.08, 0x5b3a1a)
  kit.box(0, 0.1, 0.24, 0.3, 0.08, 0.1, 0x5b3a1a)
  kit.box(0, 0.14, 0, 0.02, 0.02, 0.5, accent)
  for (const z of [-0.08, 0.1]) {
    kit.box(-0.08, 0.06, z, 0.12, 0.04, 0.1, 0x2a1a0c)
    kit.box(0.08, 0.06, z, 0.12, 0.04, 0.1, 0x2a1a0c)
  }
}

function buildSwinging(kit: ModelKit, carColor: number, accent: number): void {
  kit.box(0, 0.16, 0, 0.12, 0.04, 0.5, steel)
  kit.box(-0.1, 0.04, 0, 0.03, 0.22, 0.03, steel)
  kit.box(0.1, 0.04, 0, 0.03, 0.22, 0.03, steel)
  kit.box(0, -0.1, 0, 0.32, 0.1, 0.42, carColor)
  kit.box(0, -0.02, 0, 0.28, 0.04, 0.36, accent)
  for (const z of [-0.08, 0.08]) {
    kit.box(-0.08, -0.12, z, 0.1, 0.04, 0.1, seat)
    kit.box(0.08, -0.12, z, 0.1, 0.04, 0.1, seat)
  }
}

function buildLaunched(kit: ModelKit, carColor: number, accent: number): void {
  kit.box(0, -0.03, 0, 0.36, 0.05, 0.72, ink)
  kit.box(0, 0.03, 0, 0.3, 0.05, 0.58, carColor)
  kit.box(0, 0.06, 0.32, 0.18, 0.08, 0.16, carColor)
  kit.box(0, 0.08, 0.4, 0.1, 0.05, 0.08, accent)
  kit.box(0, 0.1, -0.28, 0.32, 0.12, 0.06, carColor)
  for (const z of [-0.1, 0.1]) {
    kit.box(-0.08, 0.05, z, 0.12, 0.04, 0.1, seat)
    kit.box(0.08, 0.05, z, 0.12, 0.04, 0.1, seat)
    kit.box(0, 0.12, z + 0.05, 0.24, 0.012, 0.012, bar)
  }
}

function buildGiga(kit: ModelKit, carColor: number, accent: number): void {
  kit.box(0, -0.04, 0, 0.4, 0.05, 0.76, ink)
  kit.box(0, 0.02, 0, 0.34, 0.05, 0.62, carColor)
  kit.box(0, 0.1, -0.3, 0.36, 0.14, 0.08, carColor)
  kit.box(0, 0.08, 0.32, 0.24, 0.08, 0.12, accent)
  for (const z of [-0.12, 0.1]) {
    kit.box(-0.09, 0.05, z, 0.13, 0.04, 0.12, seat)
    kit.box(0.09, 0.05, z, 0.13, 0.04, 0.12, seat)
    kit.box(-0.09, 0.16, z - 0.04, 0.12, 0.14, 0.03, seat)
    kit.box(0.09, 0.16, z - 0.04, 0.12, 0.14, 0.03, seat)
  }
}

function buildCarGeometry(style: CoasterTrainStyleId, carColor: number, accent: number) {
  const kit = new ModelKit()
  if (style === 'wooden') buildWooden(kit, carColor, accent)
  else if (style === 'bmSitdown') buildBmSitdown(kit, carColor, accent)
  else if (style === 'invertV') buildInvertV(kit, carColor, accent)
  else if (style === 'flying') buildFlying(kit, carColor, accent)
  else if (style === 'standUp') buildStandUp(kit, carColor, accent)
  else if (style === 'junior') buildJunior(kit, carColor, accent)
  else if (style === 'mouse') buildMouse(kit, carColor, accent)
  else if (style === 'bobsled') buildBobsled(kit, carColor, accent)
  else if (style === 'mine') buildMine(kit, carColor, accent)
  else if (style === 'swinging') buildSwinging(kit, carColor, accent)
  else if (style === 'launched') buildLaunched(kit, carColor, accent)
  else if (style === 'giga') buildGiga(kit, carColor, accent)
  else buildSitDownSteel(kit, carColor, accent)
  const geometry = kit.finish()
  geometry.userData.shared = true
  return geometry
}

export function createCoasterCar(
  carColor: number,
  style: CoasterTrainStyleId = 'sitDownSteel',
  accentColor = 0xe8c45a,
): Group {
  const key = `${style}:${carColor}:${accentColor}`
  let geometry = geometryByKey.get(key)
  if (!geometry) {
    geometry = buildCarGeometry(style, carColor, accentColor)
    geometryByKey.set(key, geometry)
  }
  const group = new Group()
  const body = new Mesh(geometry, carMaterial)
  body.castShadow = false
  group.add(body)
  return group
}
