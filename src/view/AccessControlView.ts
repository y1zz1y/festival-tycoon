import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three'
import {
  gateEdgeWorldPosition,
  type AccessControlSnapshot,
  type PathBarrier,
} from '../game/accessControl'
import { DIRECTION_OFFSETS, type Direction } from '../game/logistics'
import { disposeObject3D } from './disposeObject3D'
import { createRoadDirectionArrowGeometry } from './roadDirectionArrow'

const poleGeometry = new CylinderGeometry(0.035, 0.04, 0.72, 6)
const lampGeometry = new SphereGeometry(0.07, 8, 6)
const housingGeometry = new BoxGeometry(0.12, 0.22, 0.1)
const gatePostGeometry = new BoxGeometry(0.08, 0.82, 0.08)
const gateLeafGeometry = new BoxGeometry(0.37, 0.54, 0.03)
const gateSlatGeometry = new BoxGeometry(0.34, 0.04, 0.018)
const gateLintelGeometry = new BoxGeometry(0.94, 0.07, 0.08)
const gateArrowGeometry = createRoadDirectionArrowGeometry('overlay')
poleGeometry.userData.shared = true
lampGeometry.userData.shared = true
housingGeometry.userData.shared = true
gatePostGeometry.userData.shared = true
gateLeafGeometry.userData.shared = true
gateSlatGeometry.userData.shared = true
gateLintelGeometry.userData.shared = true
gateArrowGeometry.userData.shared = true

const materials = {
  pole: new MeshStandardMaterial({ color: 0x3d4148, roughness: 0.7 }),
  housing: new MeshStandardMaterial({ color: 0x22262c, roughness: 0.55 }),
  open: new MeshStandardMaterial({ color: 0x3ad46a, roughness: 0.35, emissive: 0x145c28, emissiveIntensity: 0.55 }),
  closed: new MeshStandardMaterial({ color: 0xe24b4b, roughness: 0.35, emissive: 0x6a1212, emissiveIntensity: 0.55 }),
  post: new MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.62 }),
  leaf: new MeshStandardMaterial({ color: 0x8b6840, roughness: 0.78 }),
  slat: new MeshStandardMaterial({ color: 0x6f5234, roughness: 0.72 }),
  arrow: new MeshBasicMaterial({ color: 0xf4f0de, depthTest: false }),
}
Object.values(materials).forEach((material) => {
  material.userData.shared = true
})

const ANGLES = [0, Math.PI / 2, Math.PI, -Math.PI / 2] as const
const OPEN_SWING = Math.PI * 0.78

export class AccessControlView {
  readonly group = new Group()
  private fingerprint = ''

  invalidate(): void {
    this.fingerprint = ''
  }

  getPickRoot(): Group {
    return this.group
  }

  update(
    controls: AccessControlSnapshot,
    groundY: (x: number, z: number) => number,
  ): void {
    const stamp = [
      ...controls.trafficLights.map(
        (light) =>
          `${light.id}:${light.x}:${light.z}:${light.direction}:${light.signal}`,
      ),
      ...controls.pathBarriers.map(
        (barrier) =>
          `${barrier.id}:${barrier.x}:${barrier.z}:${barrier.elevation}:${barrier.direction}:${barrier.signal}:${barrier.passage ?? 'oneWay'}`,
      ),
    ].join('|')
    if (stamp === this.fingerprint) return
    this.fingerprint = stamp
    this.group.children.slice().forEach((child) => {
      this.group.remove(child)
      disposeObject3D(child)
    })
    controls.trafficLights.forEach((light) => {
      const forward = DIRECTION_OFFSETS[light.direction]
      const right = DIRECTION_OFFSETS[((light.direction + 1) % 4) as Direction]
      const root = new Group()
      root.userData.accessId = light.id
      root.position.set(
        light.x + 0.5 + right.x * 0.4 - forward.x * 0.14,
        groundY(light.x, light.z),
        light.z + 0.5 + right.z * 0.4 - forward.z * 0.14,
      )
      root.rotation.y = ANGLES[light.direction] + Math.PI
      const pole = new Mesh(poleGeometry, materials.pole)
      pole.position.y = 0.36
      const housing = new Mesh(housingGeometry, materials.housing)
      housing.position.set(0, 0.7, 0.04)
      const lamp = new Mesh(
        lampGeometry,
        light.signal === 'open' ? materials.open : materials.closed,
      )
      lamp.position.set(0, 0.7, 0.1)
      root.add(pole, housing, lamp)
      this.group.add(root)
    })
    controls.pathBarriers.forEach((barrier) => {
      this.group.add(this.createGate(barrier, groundY))
    })
  }

  private createGate(
    barrier: PathBarrier,
    groundY: (x: number, z: number) => number,
  ): Group {
    const open = barrier.signal === 'open'
    const root = new Group()
    root.userData.accessId = barrier.id
    const edge = gateEdgeWorldPosition(
      barrier.x,
      barrier.z,
      barrier.elevation || groundY(barrier.x, barrier.z),
      barrier.direction,
    )
    root.position.set(edge.x, edge.y, edge.z)
    root.rotation.y = ANGLES[barrier.direction]
    const leftPost = new Mesh(gatePostGeometry, materials.post)
    leftPost.position.set(-0.43, 0.41, 0)
    const rightPost = new Mesh(gatePostGeometry, materials.post)
    rightPost.position.set(0.43, 0.41, 0)
    const lintel = new Mesh(gateLintelGeometry, materials.post)
    lintel.position.set(0, 0.8, 0)
    const lamp = new Mesh(
      lampGeometry,
      open ? materials.open : materials.closed,
    )
    lamp.position.set(0, 0.9, 0.02)
    lamp.scale.setScalar(0.65)
    root.add(leftPost, rightPost, lintel, lamp)
    root.add(this.createGateLeaf(-1, open), this.createGateLeaf(1, open))
    if ((barrier.passage ?? 'oneWay') === 'oneWay') {
      const arrow = new Mesh(gateArrowGeometry, materials.arrow)
      arrow.position.set(0, 0.81, 0.06)
      arrow.scale.setScalar(0.28)
      root.add(arrow)
    }
    return root
  }

  private createGateLeaf(side: -1 | 1, open: boolean): Group {
    const hinge = new Group()
    hinge.position.set(side * 0.39, 0, 0)
    hinge.rotation.y = open ? -side * OPEN_SWING : 0
    const panel = new Mesh(gateLeafGeometry, materials.leaf)
    panel.position.set(-side * 0.185, 0.36, 0)
    const high = new Mesh(gateSlatGeometry, materials.slat)
    high.position.set(-side * 0.185, 0.52, 0.012)
    const low = new Mesh(gateSlatGeometry, materials.slat)
    low.position.set(-side * 0.185, 0.2, 0.012)
    hinge.add(panel, high, low)
    return hinge
  }
}
