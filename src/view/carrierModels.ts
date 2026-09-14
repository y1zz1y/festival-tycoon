import { Group, Mesh, MeshStandardMaterial } from 'three'
import { ModelKit } from './retroBuildings'
import {
  createNudeAnatomy,
  createPersonDetails,
  createPersonGeometry,
  personSeed,
  personStyle,
} from './pixelPeople'

/** Teal work shirt (old box-porter hue) under a yellow vest. */
export const CARRIER_SHIRT = 0x2f8a7c
export const CARRIER_PANTS = 0x2c3844
const vis = 0xf2d23c
const visDeep = 0xd4a82c
const silver = 0xe4eaf0
const navy = 0x243240
const steel = 0x7a888c
const ink = 0x252a2e
const timber = 0x8d6a42
const crate = 0xc9a06c
const crateLid = 0xb8894e
/** Teal strap: leftover from the old box-porter so veterans still read "Waren". */
const strap = 0x37b7a3

const kitCache = new Map<string, ReturnType<ModelKit['finish']>>()
const kitMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.08 })
kitMaterial.userData.shared = true
const shirtMaterial = new MeshStandardMaterial({ color: CARRIER_SHIRT, vertexColors: true, roughness: 0.85 })
shirtMaterial.userData.shared = true
const pantsMaterial = new MeshStandardMaterial({ color: CARRIER_PANTS, vertexColors: true, roughness: 0.9 })
pantsMaterial.userData.shared = true
const detailMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92 })
detailMaterial.userData.shared = true

function kitGeometry(key: string, build: () => ReturnType<ModelKit['finish']>) {
  const cached = kitCache.get(key)
  if (cached) return cached
  const geometry = build()
  geometry.userData.shared = true
  kitCache.set(key, geometry)
  return geometry
}

export function carrierUniformGeometry() {
  return kitGeometry('uniform', () => {
    const k = new ModelKit()
    k.box(0, 0.418, 0.078, 0.176, 0.176, 0.042, vis)
    k.box(0, 0.418, -0.066, 0.176, 0.176, 0.032, vis)
    for (const x of [-0.094, 0.094]) k.box(x, 0.418, 0.006, 0.034, 0.176, 0.128, vis)
    for (const y of [0.468, 0.382]) {
      k.box(0, y, 0.084, 0.17, 0.016, 0.012, silver)
      k.box(0, y, -0.08, 0.17, 0.016, 0.012, silver)
    }
    for (const x of [-0.09, 0.09]) {
      k.box(x, 0.468, 0.002, 0.012, 0.016, 0.12, silver)
      k.box(x, 0.382, 0.002, 0.012, 0.016, 0.12, silver)
    }
    for (const x of [-0.044, 0.044]) k.box(x, 0.356, 0.08, 0.052, 0.038, 0.02, visDeep)
    k.box(0, 0.42, 0.084, 0.012, 0.15, 0.008, navy)
    k.box(0, 0.508, 0.002, 0.15, 0.016, 0.11, navy)
    k.box(0, 0.708, -0.006, 0.128, 0.038, 0.118, navy)
    k.box(0, 0.69, 0.07, 0.122, 0.014, 0.052, vis)
    k.box(0, 0.724, -0.004, 0.086, 0.012, 0.08, visDeep)
    return k.finish()
  })
}

export function carrierCartGeometry() {
  return kitGeometry('cart', () => {
    const k = new ModelKit()
    k.box(0, 0.112, 0.02, 0.3, 0.028, 0.36, timber)
    for (const x of [-0.148, 0.148]) k.box(x, 0.138, 0.02, 0.018, 0.036, 0.36, steel)
    k.box(0, 0.138, 0.192, 0.3, 0.036, 0.018, steel)
    k.box(0, 0.138, -0.152, 0.3, 0.036, 0.018, steel)
    k.box(0, 0.072, 0.01, 0.26, 0.018, 0.28, 0x4a4038)
    for (const x of [-0.152, 0.152]) {
      k.box(x, 0.055, 0.08, 0.032, 0.11, 0.11, ink)
      k.box(x, 0.055, 0.08, 0.04, 0.038, 0.038, steel)
    }
    for (const x of [-0.11, 0.11]) k.box(x, 0.03, -0.14, 0.03, 0.04, 0.04, ink)
    for (const x of [-0.1, 0.1]) k.box(x, 0.28, -0.22, 0.016, 0.32, 0.016, steel)
    k.box(0, 0.438, -0.268, 0.216, 0.016, 0.016, steel)
    k.box(0, 0.4, -0.268, 0.016, 0.07, 0.016, 0x3a4448)
    for (const x of [-0.142, 0.142]) k.box(x, 0.128, 0.02, 0.012, 0.02, 0.12, strap)
    return k.finish()
  })
}

export function carrierLoadGeometry() {
  return kitGeometry('load', () => {
    const k = new ModelKit()
    k.box(0, 0.22, 0.04, 0.21, 0.15, 0.2, crate)
    k.box(0, 0.298, 0.04, 0.2, 0.016, 0.188, crateLid)
    k.box(0, 0.22, 0.04, 0.22, 0.028, 0.03, strap)
    k.box(0.04, 0.368, -0.02, 0.16, 0.12, 0.16, crateLid)
    k.box(0.04, 0.43, -0.02, 0.15, 0.012, 0.15, 0xa67a42)
    k.box(0.04, 0.368, -0.02, 0.03, 0.12, 0.168, strap)
    k.box(-0.07, 0.232, 0.12, 0.06, 0.04, 0.012, navy)
    return k.finish()
  })
}

export function carrierKitMaterial() {
  return kitMaterial
}

export function createCarrierFigure(id: string): Group {
  const appearance = personStyle(personSeed(id))
  const group = new Group()
  const skin = new MeshStandardMaterial({ color: appearance.skin, vertexColors: true, roughness: 0.9 })
  const shoulder = appearance.female ? 0.11 : 0.128
  const body = new Mesh(createPersonGeometry(appearance.female ? 'femaleBody' : 'body'), shirtMaterial)
  const head = new Mesh(createPersonGeometry('head'), skin)
  const leftLeg = new Mesh(createPersonGeometry('leg'), pantsMaterial)
  const rightLeg = leftLeg.clone()
  const leftArm = new Mesh(createPersonGeometry('arm'), skin)
  const rightArm = leftArm.clone()
  body.position.y = 0.39
  head.position.y = 0.605
  leftLeg.position.set(-0.044, 0.275, 0)
  rightLeg.position.set(0.044, 0.275, 0)
  leftArm.position.set(-shoulder, 0.485, 0)
  rightArm.position.set(shoulder, 0.485, 0)
  leftLeg.userData.walkLimb = 1
  rightLeg.userData.walkLimb = -1
  leftArm.rotation.set(0.58, 0, 0.12)
  rightArm.rotation.set(0.58, 0, -0.12)
  const hair = new Mesh(createPersonDetails(appearance.variant, false), detailMaterial)
  const uniform = new Mesh(carrierUniformGeometry(), kitMaterial)
  group.add(leftLeg, rightLeg, body, head, leftArm, rightArm, hair, uniform)
  if (appearance.female) {
    const bust = new Mesh(createNudeAnatomy('bust'), shirtMaterial)
    bust.position.y = 0.39
    group.add(bust)
  }
  group.scale.set(appearance.width, appearance.height, appearance.width)
  group.userData.walkPhase = personSeed(id) % 1000
  group.traverse((object) => {
    if (object instanceof Mesh) object.castShadow = false
  })
  return group
}

export function createPorterModel(id: string): Group {
  const group = new Group()
  const person = createCarrierFigure(id)
  person.name = 'porter'
  person.position.set(0, 0, -0.12)
  const cart = new Mesh(carrierCartGeometry(), kitMaterial)
  cart.position.set(0, 0, 0.16)
  const load = new Group()
  load.name = 'load'
  const crates = new Mesh(carrierLoadGeometry(), kitMaterial)
  crates.position.set(0, 0, 0.16)
  load.add(crates)
  const driver = new Group()
  driver.name = 'driver'
  driver.visible = false
  group.add(person, cart, load, driver)
  group.userData.walkPhase = personSeed(id) % 1000
  return group
}

export function createCarrierDriver(id: string): Group {
  const driver = createCarrierFigure(`${id}-driver`)
  driver.name = 'driver'
  driver.position.set(0.36, 0, 0.4)
  return driver
}
