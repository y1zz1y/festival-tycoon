import { Group, Mesh, MeshStandardMaterial } from 'three'
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

const geometryByColor = new Map<number, ReturnType<ModelKit['finish']>>()

export const COASTER_CAR_SEATS = [
  { x: -0.08, y: 0.04, z: -0.1 },
  { x: 0.08, y: 0.04, z: -0.1 },
  { x: -0.08, y: 0.04, z: 0.08 },
  { x: 0.08, y: 0.04, z: 0.08 },
] as const

function buildCarGeometry(carColor: number) {
  const kit = new ModelKit()
  kit.box(0, -0.05, 0, 0.38, 0.05, 0.64, ink)
  kit.box(0, -0.06, -0.2, 0.34, 0.04, 0.14, 0x2a3036)
  kit.box(0, -0.06, 0.2, 0.34, 0.04, 0.14, 0x2a3036)
  for (const x of [-0.2, 0.2]) {
    for (const z of [-0.2, 0.2]) {
      kit.box(x, -0.07, z, 0.04, 0.1, 0.1, 0x111418)
    }
  }
  kit.box(0, 0.01, -0.02, 0.32, 0.03, 0.44, carColor)
  kit.box(-0.16, 0.05, -0.02, 0.04, 0.06, 0.42, carColor)
  kit.box(0.16, 0.05, -0.02, 0.04, 0.06, 0.42, carColor)
  kit.box(-0.165, 0.07, -0.02, 0.02, 0.03, 0.4, 0xe8c45a)
  kit.box(0.165, 0.07, -0.02, 0.02, 0.03, 0.4, 0xe8c45a)
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
  const geometry = kit.finish()
  geometry.userData.shared = true
  return geometry
}

export function createCoasterCar(carColor: number): Group {
  let geometry = geometryByColor.get(carColor)
  if (!geometry) {
    geometry = buildCarGeometry(carColor)
    geometryByColor.set(carColor, geometry)
  }
  const group = new Group()
  const body = new Mesh(geometry, carMaterial)
  body.castShadow = false
  group.add(body)
  return group
}
