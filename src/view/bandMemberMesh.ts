import {
  BoxGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import {
  bandLook,
  memberShirtColor,
  type BandAccessory,
  type BandRole,
} from '../game/bandLooks'

const bodyMaterial = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.9,
  flatShading: true,
})
bodyMaterial.userData.shared = true

const armGeometry = new BoxGeometry(0.1, 0.32, 0.1)
armGeometry.userData.shared = true
const stickGeometry = new BoxGeometry(0.025, 0.3, 0.025)
stickGeometry.userData.shared = true

const tintedMaterials = new Map<number, MeshStandardMaterial>()
function tintedMaterial(color: number): MeshStandardMaterial {
  let material = tintedMaterials.get(color)
  if (!material) {
    material = new MeshStandardMaterial({
      color,
      roughness: 0.9,
      flatShading: true,
    })
    material.userData.shared = true
    tintedMaterials.set(color, material)
  }
  return material
}

const bodyCache = new Map<string, ReturnType<typeof mergeGeometries>>()

function hexColor(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`
}

function accessoryBoxes(
  accessory: BandAccessory,
  hair: string,
  accent: string,
): Array<[number, number, number, number, number, number, string]> {
  if (accessory === 'hat') {
    return [
      [0, 1.055, -0.015, 0.28, 0.08, 0.25, hair],
      [0, 1.1, -0.02, 0.2, 0.1, 0.2, accent],
    ]
  }
  if (accessory === 'cap') {
    return [
      [0, 1.055, -0.015, 0.28, 0.08, 0.25, accent],
      [0, 1.04, 0.12, 0.18, 0.04, 0.1, accent],
    ]
  }
  if (accessory === 'fedora') {
    return [
      [0, 1.05, -0.01, 0.34, 0.04, 0.3, hair],
      [0, 1.1, -0.02, 0.2, 0.1, 0.2, accent],
    ]
  }
  if (accessory === 'headphones') {
    return [
      [0, 1.055, -0.015, 0.28, 0.08, 0.25, hair],
      [-0.145, 0.925, 0, 0.05, 0.13, 0.14, '#1b222c'],
      [0.145, 0.925, 0, 0.05, 0.13, 0.14, '#1b222c'],
      [0, 1.035, 0, 0.31, 0.05, 0.07, '#1b222c'],
    ]
  }
  if (accessory === 'bandana') {
    return [
      [0, 1.04, 0.02, 0.28, 0.06, 0.26, accent],
      [0.12, 0.98, -0.02, 0.08, 0.12, 0.04, accent],
    ]
  }
  if (accessory === 'spikes') {
    return [
      [0, 1.055, -0.015, 0.28, 0.08, 0.25, hair],
      [-0.08, 1.14, 0, 0.04, 0.1, 0.04, accent],
      [0.08, 1.14, 0, 0.04, 0.1, 0.04, accent],
      [0, 1.16, -0.02, 0.04, 0.12, 0.04, accent],
    ]
  }
  return [[0, 1.055, -0.015, 0.28, 0.08, 0.25, hair]]
}

function buildBodyGeometry(
  role: BandRole,
  bandId: string,
  memberIndex: number,
): ReturnType<typeof mergeGeometries> {
  const look = bandLook(bandId)
  const shirt = hexColor(memberShirtColor(bandId, memberIndex))
  const accent = hexColor(look.accent)
  const pants = hexColor(look.pants)
  const hair = hexColor(look.hair)
  const skin = hexColor(look.skin)
  const guitar = bandId === 'campfire' ? hexColor(look.accent) : '#df6b50'
  const scale = look.silhouette === 'wide' ? 1.08 : look.silhouette === 'slim' ? 0.92 : 1
  const buckets = new Map<string, BoxGeometry[]>()
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
  ) => {
    const geometry = new BoxGeometry(w * scale, h, d * scale)
    geometry.translate(x, y, z)
    const list = buckets.get(color) ?? []
    list.push(geometry)
    buckets.set(color, list)
  }
  box(0, 0.55, 0, 0.22, 0.38, 0.14, shirt)
  box(0, 0.88, 0, 0.18, 0.22, 0.16, skin)
  for (const part of accessoryBoxes(look.accessory, hair, accent)) {
    box(...part)
  }
  for (const side of [-1, 1] as const) {
    box(side * 0.09, 0.18, 0, 0.12, 0.36, 0.14, pants)
    box(side * 0.09, 0.035, 0.045, 0.14, 0.07, 0.24, '#151b24')
    box(side * 0.06, 0.94, 0.124, 0.03, 0.03, 0.02, '#202733')
  }
  if (role === 'guitar') {
    box(0.03, 0.43, 0.19, 0.35, 0.3, 0.12, guitar)
    box(0.2, 0.65, 0.2, 0.09, 0.5, 0.07, '#b49c72')
    for (const x of [0.18, 0.2, 0.22]) box(x, 0.65, 0.24, 0.007, 0.47, 0.006, '#e4e3dc')
  }
  if (role === 'singer') {
    box(0.12, 0.43, 0.24, 0.025, 0.86, 0.025, '#89929e')
    box(0.12, 0.87, 0.24, 0.1, 0.065, 0.065, '#17202c')
    box(0.12, 0.02, 0.24, 0.24, 0.035, 0.18, pants)
  }
  if (role === 'keys') {
    box(0, 0.53, 0.3, 0.72, 0.13, 0.28, '#263348')
    for (let n = 0; n < 12; n++) {
      box((n - 5.5) * 0.052, 0.6, 0.33, 0.046, 0.025, 0.2, n % 3 ? '#eee9de' : '#202735')
    }
    for (const x of [-0.28, 0.28]) box(x, 0.25, 0.3, 0.04, 0.5, 0.04, '#737f89')
  }
  if (role === 'brass') {
    box(0.15, 0.68, 0.24, 0.09, 0.08, 0.45, accent)
    box(0.15, 0.68, 0.49, 0.22, 0.22, 0.12, '#f2cf67')
    box(0.15, 0.68, 0.56, 0.15, 0.15, 0.02, '#534623')
  }
  if (role === 'drums') {
    box(0, 0.23, 0.44, 0.48, 0.44, 0.3, hexColor(look.accent))
    box(0, 0.23, 0.601, 0.4, 0.36, 0.025, '#e5dbcb')
    for (const x of [-0.3, 0.3]) {
      box(x, 0.5, 0.34, 0.24, 0.15, 0.24, shirt)
      box(x, 0.59, 0.34, 0.25, 0.03, 0.25, '#e6ddd0')
      box(x * 1.45, 0.79, 0.22, 0.38, 0.025, 0.3, accent)
      box(x * 1.45, 0.4, 0.22, 0.025, 0.8, 0.025, '#839099')
    }
  }
  const body: BoxGeometry[] = []
  for (const [color, geometries] of buckets) {
    const tint = new Color(color)
    for (const geometry of geometries) {
      const values: number[] = []
      for (let n = 0; n < geometry.getAttribute('position').count; n++) {
        values.push(tint.r, tint.g, tint.b)
      }
      geometry.setAttribute('color', new Float32BufferAttribute(values, 3))
      body.push(geometry)
    }
  }
  const merged = mergeGeometries(body)!
  merged.userData.shared = true
  body.forEach((geometry) => geometry.dispose())
  return merged
}

export function createBandMemberModel(
  bandId: string,
  role: BandRole,
  memberIndex: number,
): Group {
  const look = bandLook(bandId)
  const cacheKey = `${look.costumeId}:${role}:${memberIndex}`
  let geometry = bodyCache.get(cacheKey)
  if (!geometry) {
    geometry = buildBodyGeometry(role, bandId, memberIndex)
    bodyCache.set(cacheKey, geometry)
  }
  const root = new Group()
  const body = new Mesh(geometry, bodyMaterial)
  body.userData.shared = true
  root.add(body)
  const shirt = memberShirtColor(bandId, memberIndex)
  const arms: Group[] = []
  for (const side of [-1, 1] as const) {
    const arm = new Group()
    arm.position.set(side * 0.22, 0.73, 0)
    const limb = new Mesh(armGeometry, tintedMaterial(shirt))
    limb.userData.shared = true
    limb.position.y = -0.14
    arm.add(limb)
    if (role === 'drums') {
      const stick = new Mesh(stickGeometry, tintedMaterial(0xdccb9b))
      stick.userData.shared = true
      stick.position.set(0, -0.3, 0.05)
      arm.add(stick)
    }
    root.add(arm)
    arms.push(arm)
  }
  root.userData.arms = arms
  root.userData.role = role
  root.userData.index = memberIndex
  root.userData.costumeId = look.costumeId
  root.userData.bandId = bandId
  return root
}
