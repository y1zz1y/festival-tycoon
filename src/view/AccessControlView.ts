import {
  Group,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three'
import {
  gateEdgeWorldPosition,
  type AccessControlSnapshot,
} from '../game/accessControl'
import { DIRECTION_OFFSETS, type Direction } from '../game/logistics'
import { createRoadDirectionArrowGeometry } from './roadDirectionArrow'
import { InstanceBatch, placementMatrix } from './instanceBatch'
import { houseVariant, shared } from './materials'
import { composeLimb } from './pixelPeople'
import { ModelKit } from './retroBuildings'

/** Pole and signal housing of a traffic light, merged; the lamp is separate. */
function lightBodyGeometry(): BufferGeometry {
  const kit = new ModelKit()
  kit.cylinder(0, 0.36, 0, 0.04, 0.72, 0x3d4148, 0.035, 6)
  kit.box(0, 0.7, 0.04, 0.12, 0.22, 0.1, 0x22262c)
  return kit.finish()
}

/** The two posts and the lintel of a pedestrian gate. */
function gateFrameGeometry(): BufferGeometry {
  const kit = new ModelKit()
  for (const x of [-0.43, 0.43]) kit.box(x, 0.41, 0, 0.08, 0.82, 0.08, 0x3a3f46)
  kit.box(0, 0.8, 0, 0.94, 0.07, 0.08, 0x3a3f46)
  return kit.finish()
}

/** One gate leaf, panel and two slats, centred on the panel; it swings about its hinge. */
function gateLeafGeometry(): BufferGeometry {
  const kit = new ModelKit()
  kit.box(0, 0.36, 0, 0.37, 0.54, 0.03, 0x8b6840)
  for (const y of [0.52, 0.2]) kit.box(0, y, 0.012, 0.34, 0.04, 0.018, 0x6f5234)
  return kit.finish()
}

const lampGeometry = new SphereGeometry(0.07, 8, 6)
const gateArrowGeometry = createRoadDirectionArrowGeometry('overlay')
lampGeometry.userData.shared = true
gateArrowGeometry.userData.shared = true

const materials = {
  open: new MeshStandardMaterial({ color: 0x3ad46a, roughness: 0.35, emissive: 0x145c28, emissiveIntensity: 0.55 }),
  closed: new MeshStandardMaterial({ color: 0xe24b4b, roughness: 0.35, emissive: 0x6a1212, emissiveIntensity: 0.55 }),
  arrow: new MeshBasicMaterial({ color: 0xf4f0de, depthTest: false }),
  /** The house look for the merged bodies; its own object, used only by these batches. */
  body: houseVariant(0.85, 0.05),
}
Object.values(materials).forEach((material) => shared(material))

const ANGLES = [0, Math.PI / 2, Math.PI, -Math.PI / 2] as const
const OPEN_SWING = Math.PI * 0.78

/**
 * Traffic lights and pedestrian gates in six instanced batches however many there
 * are: light bodies, gate frames, gate leaves, green lamps, red lamps and the
 * one-way arrows. Moving, adding or removing one (or the ground under it) rewrites
 * the layout; a signal change only moves lamps between the green and red batch and
 * swings the leaves. Every batch keeps `userData.accessIds` for picking.
 */
export class AccessControlView {
  readonly group = new Group()
  private layoutStamp = ''
  private signalStamp = ''
  private lightRoots: Matrix4[] = []
  private gateRoots: Matrix4[] = []
  private readonly matrix = new Matrix4()
  private readonly local = new Matrix4()
  private readonly lightBodies = this.batch(lightBodyGeometry(), materials.body, 'accessLightBodies')
  private readonly gateFrames = this.batch(gateFrameGeometry(), materials.body, 'accessGateFrames')
  private readonly gateLeaves = this.batch(gateLeafGeometry(), materials.body, 'accessGateLeaves')
  private readonly openLamps = this.batch(lampGeometry, materials.open, 'accessLampsOpen')
  private readonly closedLamps = this.batch(lampGeometry, materials.closed, 'accessLampsClosed')
  private readonly arrows = this.batch(gateArrowGeometry, materials.arrow, 'accessArrows')

  invalidate(): void {
    this.layoutStamp = ''
    this.signalStamp = ''
  }

  getPickRoot(): Group {
    return this.group
  }

  update(
    controls: AccessControlSnapshot,
    groundY: (x: number, z: number) => number,
  ): void {
    const layoutStamp = [
      ...controls.trafficLights.map(
        (light) =>
          `${light.id}:${light.x}:${light.z}:${light.direction}:${groundY(light.x, light.z)}`,
      ),
      ...controls.pathBarriers.map(
        (barrier) =>
          `${barrier.id}:${barrier.x}:${barrier.z}:${barrier.elevation}:${barrier.direction}:${barrier.passage ?? 'oneWay'}:${barrier.elevation ? '' : groundY(barrier.x, barrier.z)}`,
      ),
    ].join('|')
    if (layoutStamp !== this.layoutStamp) {
      this.layoutStamp = layoutStamp
      this.signalStamp = ''
      this.buildLayout(controls, groundY)
    }
    const signalStamp = [
      ...controls.trafficLights.map((light) => light.signal),
      ...controls.pathBarriers.map((barrier) => barrier.signal),
    ].join(',')
    if (signalStamp === this.signalStamp) return
    this.signalStamp = signalStamp
    this.paintSignals(controls)
  }

  private batch(geometry: BufferGeometry, material: Material, name: string): InstanceBatch {
    return new InstanceBatch(this.group, geometry, material, { idKey: 'accessIds', name })
  }

  private buildLayout(controls: AccessControlSnapshot, groundY: (x: number, z: number) => number): void {
    this.lightRoots = controls.trafficLights.map((light) => {
      const forward = DIRECTION_OFFSETS[light.direction]
      const right = DIRECTION_OFFSETS[((light.direction + 1) % 4) as Direction]
      return placementMatrix(
        new Matrix4(),
        light.x + 0.5 + right.x * 0.4 - forward.x * 0.14,
        groundY(light.x, light.z),
        light.z + 0.5 + right.z * 0.4 - forward.z * 0.14,
        ANGLES[light.direction] + Math.PI,
      )
    })
    this.gateRoots = controls.pathBarriers.map((barrier) => {
      const edge = gateEdgeWorldPosition(
        barrier.x,
        barrier.z,
        barrier.elevation || groundY(barrier.x, barrier.z),
        barrier.direction,
      )
      return placementMatrix(new Matrix4(), edge.x, edge.y, edge.z, ANGLES[barrier.direction])
    })
    this.lightBodies.begin()
    controls.trafficLights.forEach((light, index) => this.lightBodies.add(this.lightRoots[index]!, light.id))
    this.lightBodies.finish()
    this.gateFrames.begin()
    this.arrows.begin()
    controls.pathBarriers.forEach((barrier, index) => {
      const root = this.gateRoots[index]!
      this.gateFrames.add(root, barrier.id)
      if ((barrier.passage ?? 'oneWay') !== 'oneWay') return
      this.local.makeScale(0.28, 0.28, 0.28).setPosition(0, 0.81, 0.06)
      this.arrows.add(this.matrix.multiplyMatrices(root, this.local), barrier.id)
    })
    this.gateFrames.finish()
    this.arrows.finish()
  }

  private paintSignals(controls: AccessControlSnapshot): void {
    for (const batch of [this.openLamps, this.closedLamps, this.gateLeaves]) batch.begin()
    controls.trafficLights.forEach((light, index) => {
      const lamps = light.signal === 'open' ? this.openLamps : this.closedLamps
      lamps.add(composeLimb(this.matrix, this.lightRoots[index]!, 0, 0.7, 0.1), light.id)
    })
    controls.pathBarriers.forEach((barrier, index) => {
      const root = this.gateRoots[index]!
      const open = barrier.signal === 'open'
      this.local.makeScale(0.65, 0.65, 0.65).setPosition(0, 0.9, 0.02)
      ;(open ? this.openLamps : this.closedLamps).add(this.matrix.multiplyMatrices(root, this.local), barrier.id)
      for (const side of [-1, 1] as const) {
        composeLimb(this.matrix, root, side * 0.39, 0, 0, 0, open ? -side * OPEN_SWING : 0, 0)
        this.gateLeaves.add(this.matrix.multiply(this.local.makeTranslation(-side * 0.185, 0, 0)), barrier.id)
      }
    })
    for (const batch of [this.openLamps, this.closedLamps, this.gateLeaves]) batch.finish()
  }
}
