import { Group, Mesh, Quaternion, Vector3, type BufferGeometry, type Object3D } from 'three'
import type { FlatRideType } from '../game/flatRides'
import { HOUSE_MATERIAL } from './materials'
import { ModelKit } from './retroBuildings'

/**
 * Flat ride models in the house style: vertex-coloured ModelKit geometry and the shared
 * house material. Each ride is a static base plus a few moving parts; a part's geometry
 * is built once per ride type and shared by every placed ride, so a ride costs a handful
 * of draw calls however many stand. Local x runs along the footprint's width, z along
 * its depth, both centred on the footprint (WorldView places the model at its middle).
 *
 * Motion comes from `animateFlatRide(model, minutes, running)`: `minutes` is simulated
 * festival time (interpolated by WorldView), so a paused game stands still and the ride
 * only moves while someone is on it.
 */

const geometries = new Map<string, BufferGeometry>()

function shared(key: string, build: (k: ModelKit) => void): BufferGeometry {
  let geometry = geometries.get(key)
  if (!geometry) {
    const kit = new ModelKit()
    build(kit)
    geometry = kit.finish()
    geometry.userData.shared = true
    geometries.set(key, geometry)
  }
  return geometry
}

function mesh(key: string, build: (k: ModelKit) => void): Mesh {
  const part = new Mesh(shared(key, build), HOUSE_MATERIAL)
  part.castShadow = true
  part.receiveShadow = true
  return part
}

const STEEL = 0x8e999e
const DARK = 0x3a4046
const WHITE = 0xf2f0e8
const RED = 0xd8433b
const YELLOW = 0xf2c14e
const BLUE = 0x2f6fdb
const TEAL = 0x2fa8a0
const SEAT_COLORS = [RED, YELLOW, BLUE, TEAL, 0xd64f8f, 0x7b5cd6, 0xf28c28, 0x5aa84f]

type Rig = { parts: Object3D[] }

// ---------------------------------------------------------------- chain swing (3x3)
function chainSwing(root: Group): Rig {
  root.add(mesh('chainSwing:base', (k) => {
    k.cylinder(0, .06, 0, 1.38, .12, 0xb8a98a, 1.38, 16)
    k.cylinder(0, .14, 0, 1.2, .05, 0xd9ccae, 1.2, 16)
    k.cylinder(0, 1.2, 0, .13, 2.2, STEEL, .1, 8)
    for (const [x, z] of [[1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3]] as const) k.box(x, .3, z, .12, .3, .12, DARK)
  }))
  const rotor = new Group()
  rotor.position.y = 2.2
  rotor.add(mesh('chainSwing:canopy', (k) => {
    k.cylinder(0, .12, 0, 1.25, .34, WHITE, .2, 16)
    k.cylinder(0, -.08, 0, 1.28, .1, RED, 1.28, 16)
    k.cylinder(0, .36, 0, .1, .2, YELLOW, .02, 8)
  }))
  const seats: Object3D[] = []
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const arm = new Group()
    arm.position.set(Math.cos(angle) * 1.05, -.12, Math.sin(angle) * 1.05)
    arm.rotation.y = -angle
    const color = SEAT_COLORS[i % SEAT_COLORS.length]!
    const hang = mesh(`chainSwing:seat:${color}`, (k) => {
      for (const z of [-.07, .07]) k.box(0, -.45, z, .015, .9, .015, 0x5c5c5c)
      k.box(0, -.93, 0, .16, .05, .18, color)
      k.box(-.07, -.85, 0, .03, .16, .18, color)
    })
    arm.add(hang)
    rotor.add(arm)
    seats.push(hang)
  }
  root.add(rotor)
  return { parts: [rotor, ...seats] }
}

function animateChainSwing(rig: Rig, minutes: number, running: boolean): void {
  const [rotor, ...seats] = rig.parts
  if (running) rotor!.rotation.y = -minutes * Math.PI * 2 * .45
  for (const seat of seats) seat.rotation.z = running ? .55 : 0
}

// ---------------------------------------------------------------- freefall tower (2x2)
function freefall(root: Group): Rig {
  root.add(mesh('freefall:tower', (k) => {
    k.box(0, .06, 0, 1.9, .12, 1.9, 0x9a9d99)
    k.box(0, .14, 0, 1.5, .04, 1.5, 0xb9c2c6)
    for (const x of [-.18, .18]) for (const z of [-.18, .18]) k.box(x, 2.25, z, .08, 4.3, .08, STEEL)
    for (let y = .6; y < 4.3; y += .5) {
      k.box(0, y, .18, .44, .04, .04, STEEL)
      k.box(0, y, -.18, .44, .04, .04, STEEL)
      k.box(.18, y, 0, .04, .04, .44, STEEL)
      k.box(-.18, y, 0, .04, .04, .44, STEEL)
    }
    k.box(0, 4.45, 0, .6, .12, .6, RED)
    k.cylinder(0, 4.62, 0, .06, .24, WHITE, .02, 6)
    for (const [x, z] of [[.8, .8], [-.8, .8], [.8, -.8], [-.8, -.8]] as const) k.box(x, .35, z, .08, .5, .08, YELLOW)
  }))
  const car = new Group()
  car.add(mesh('freefall:car', (k) => {
    k.box(0, 0, 0, .62, .12, .62, DARK)
    for (const [x, z, color] of [[.42, 0, RED], [-.42, 0, BLUE], [0, .42, YELLOW], [0, -.42, TEAL]] as const) {
      k.box(x, .06, z, x === 0 ? .44 : .2, .1, x === 0 ? .2 : .44, color)
      k.box(x * 1.12, .2, z * 1.12, x === 0 ? .44 : .04, .24, x === 0 ? .04 : .44, color)
    }
  }))
  root.add(car)
  return { parts: [car] }
}

/** Freefall cycle (fraction of 4 minutes): slow climb, a hold at the top, the drop, the rest. */
export function freefallHeight(phase: number): number {
  const bottom = .5
  const top = 3.9
  if (phase < .55) return bottom + (top - bottom) * (phase / .55)
  if (phase < .65) return top
  if (phase < .72) {
    const t = (phase - .65) / .07
    return top - (top - bottom) * t * t
  }
  return bottom
}

function animateFreefall(rig: Rig, minutes: number, running: boolean): void {
  const phase = running ? (((minutes / 4) % 1) + 1) % 1 : .99
  rig.parts[0]!.position.y = freefallHeight(phase)
}

// ---------------------------------------------------------------- Ferris wheel (3x1)
const WHEEL_RADIUS = 1.32
const Z_AXIS = new Vector3(0, 0, 1)
const WHEEL_AXLE = 1.62

function ferrisWheel(root: Group): Rig {
  root.add(mesh('ferrisWheel:frame', (k) => {
    k.box(0, .05, 0, 2.9, .1, .9, 0x9a9d99)
    for (const z of [-.34, .34]) {
      for (const side of [-1, 1]) aFrameLeg(k, side, z)
      k.box(0, WHEEL_AXLE, z, .16, .16, .06, DARK)
    }
    k.box(0, WHEEL_AXLE, 0, .08, .08, .78, STEEL)
    k.box(.9, .45, .38, .5, .8, .06, 0xd9ccae)
    k.box(.9, .7, .41, .44, .18, .02, RED)
  }))
  const wheel = new Group()
  wheel.position.y = WHEEL_AXLE
  wheel.add(mesh('ferrisWheel:wheel', (k) => {
    // Rim and spokes are rotated boxes, so they read as solid rings and rods.
    const segments = 20
    const segment = (2 * Math.PI * WHEEL_RADIUS) / segments + .02
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      const turn = new Quaternion().setFromAxisAngle(Z_AXIS, angle + Math.PI / 2)
      const x = Math.cos(angle) * WHEEL_RADIUS
      const y = Math.sin(angle) * WHEEL_RADIUS
      for (const z of [-.2, .2]) k.box(x, y, z, segment, .07, .05, i % 2 ? WHITE : RED, turn)
      if (i % 2 === 0) k.box(x, y, 0, .04, .04, .4, STEEL)
    }
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const turn = new Quaternion().setFromAxisAngle(Z_AXIS, angle)
      for (const z of [-.2, .2]) k.box(Math.cos(angle) * WHEEL_RADIUS / 2, Math.sin(angle) * WHEEL_RADIUS / 2, z, WHEEL_RADIUS, .04, .04, STEEL, turn)
    }
    k.box(0, 0, 0, .2, .2, .5, DARK)
  }))
  const gondolas: Object3D[] = []
  for (let i = 0; i < 8; i++) {
    const color = SEAT_COLORS[i % SEAT_COLORS.length]!
    const gondola = mesh(`ferrisWheel:gondola:${color}`, (k) => {
      k.box(0, -.08, 0, .02, .16, .02, 0x5c5c5c)
      k.box(0, -.26, 0, .3, .2, .3, color)
      k.box(0, -.14, 0, .34, .04, .34, WHITE)
    })
    wheel.add(gondola)
    gondolas.push(gondola)
  }
  root.add(wheel)
  return { parts: [wheel, ...gondolas] }
}

/** One slanted A-frame leg from the ground to the axle, as a stack of short boxes. */
function aFrameLeg(k: ModelKit, side: number, z: number): void {
  const steps = 9
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    k.box(side * (1.05 * (1 - t) + .05), .1 + t * (WHEEL_AXLE - .1), z, .09, .2, .07, STEEL)
  }
}

function animateFerrisWheel(rig: Rig, minutes: number, running: boolean): void {
  const [wheel, ...gondolas] = rig.parts
  if (running) wheel!.rotation.z = minutes * Math.PI * 2 * .07
  gondolas.forEach((gondola, i) => {
    const angle = (i / gondolas.length) * Math.PI * 2
    gondola.position.set(Math.cos(angle) * WHEEL_RADIUS, Math.sin(angle) * WHEEL_RADIUS, 0)
    // Gondolas hang straight down whatever the wheel does.
    gondola.rotation.z = -wheel!.rotation.z
  })
}

// ---------------------------------------------------------------- bumper cars (3x2)
function bumperCars(root: Group): Rig {
  root.add(mesh('bumperCars:hall', (k) => {
    k.box(0, .04, 0, 2.96, .08, 1.96, 0x4a4f55)
    k.box(0, .09, 0, 2.7, .02, 1.7, 0x6b7178)
    for (const x of [-1.38, 1.38]) k.box(x, .16, 0, .08, .14, 1.84, YELLOW)
    for (const z of [-.88, .88]) k.box(0, .16, z, 2.84, .14, .08, YELLOW)
    for (const x of [-1.4, 1.4]) for (const z of [-.9, .9]) k.box(x, .75, z, .08, 1.3, .08, STEEL)
    k.box(0, 1.42, 0, 3, .08, 2, 0x2c3136)
    for (const x of [-1.46, 1.46]) k.box(x, 1.5, 0, .04, .16, 2, RED)
    for (const z of [-.96, .96]) k.box(0, 1.5, z, 3, .16, .04, RED)
    for (let x = -1.2; x <= 1.21; x += .4) k.box(x, 1.37, 0, .02, .02, 1.8, 0x7e858c)
  }))
  const cars: Object3D[] = []
  for (let i = 0; i < 6; i++) {
    const color = SEAT_COLORS[i]!
    const car = mesh(`bumperCars:car:${color}`, (k) => {
      k.box(0, .16, 0, .34, .1, .24, color)
      k.box(0, .12, 0, .4, .06, .3, DARK)
      k.box(-.06, .25, 0, .08, .1, .2, color)
      k.box(.1, .6, 0, .015, .8, .015, 0x5c5c5c)
    })
    root.add(car)
    cars.push(car)
  }
  return { parts: cars }
}

function animateBumperCars(rig: Rig, minutes: number, running: boolean): void {
  rig.parts.forEach((car, i) => {
    if (!running) {
      car.position.set(-1.05 + i * .42, 0, .6)
      car.rotation.y = Math.PI / 2
      return
    }
    // Each car drives its own Lissajous loop inside the rink, facing where it goes.
    const t = minutes * (1.1 + i * .13) + i * 1.7
    const x = Math.sin(t * 1.3 + i) * 1.05
    const z = Math.sin(t * 2.1 + i * .7) * .6
    const dx = Math.cos(t * 1.3 + i) * 1.3 * 1.05
    const dz = Math.cos(t * 2.1 + i * .7) * 2.1 * .6
    car.position.set(x, 0, z)
    car.rotation.y = Math.atan2(-dz, dx)
  })
}

// ---------------------------------------------------------------- swinging ship (3x1)
const SHIP_PIVOT = 2.3

function swingShip(root: Group): Rig {
  root.add(mesh('swingShip:frame', (k) => {
    k.box(0, .05, 0, 2.9, .1, .9, 0x9a9d99)
    for (const z of [-.4, .4]) {
      for (const side of [-1, 1]) {
        const steps = 11
        for (let i = 0; i <= steps; i++) {
          const t = i / steps
          k.box(side * 1.1 * (1 - t), .1 + t * (SHIP_PIVOT - .1), z, .1, .22, .08, STEEL)
        }
      }
      k.box(0, SHIP_PIVOT, z, .18, .18, .06, DARK)
    }
    k.box(0, SHIP_PIVOT, 0, .08, .08, .84, STEEL)
  }))
  const ship = new Group()
  ship.position.y = SHIP_PIVOT
  ship.add(mesh('swingShip:ship', (k) => {
    for (const z of [-.26, .26]) k.box(0, -.8, z, .06, 1.6, .04, STEEL)
    k.box(0, -1.72, 0, 1.5, .22, .42, 0x8a5a36)
    k.box(0, -1.84, 0, 1.2, .14, .34, 0x6d4529)
    for (const x of [-.8, .8]) k.box(x, -1.6, 0, .18, .3, .4, 0x8a5a36)
    k.box(0, -1.58, 0, 1.3, .04, .36, 0xc9a26b)
    for (let x = -.5; x <= .51; x += .25) k.box(x, -1.52, 0, .05, .1, .34, RED)
    k.box(.82, -1.36, 0, .04, .3, .04, WHITE)
    k.box(.9, -1.28, 0, .14, .1, .02, RED)
  }))
  root.add(ship)
  return { parts: [ship] }
}

function animateSwingShip(rig: Rig, minutes: number, running: boolean): void {
  rig.parts[0]!.rotation.z = running ? Math.sin(minutes * Math.PI * 2 * .9) * 1.05 : 0
}

// ---------------------------------------------------------------- public
const BUILDERS: Record<FlatRideType, (root: Group) => Rig> = {
  chainSwing,
  freefall,
  ferrisWheel,
  bumperCars,
  swingShip,
}

const ANIMATORS: Record<FlatRideType, (rig: Rig, minutes: number, running: boolean) => void> = {
  chainSwing: animateChainSwing,
  freefall: animateFreefall,
  ferrisWheel: animateFerrisWheel,
  bumperCars: animateBumperCars,
  swingShip: animateSwingShip,
}

export function createFlatRideModel(type: FlatRideType): Group {
  const root = new Group()
  const rig = BUILDERS[type](root)
  root.userData.flatRide = { type, rig }
  ANIMATORS[type](rig, 0, false)
  return root
}

/** Moves a flat ride's parts: `minutes` is simulated time, `running` whether anyone rides. */
export function animateFlatRide(model: Object3D, minutes: number, running: boolean): void {
  const data = model.userData.flatRide as { type: FlatRideType; rig: Rig } | undefined
  if (data) ANIMATORS[data.type](data.rig, minutes, running)
}
