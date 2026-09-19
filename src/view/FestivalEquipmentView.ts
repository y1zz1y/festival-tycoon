import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
} from 'three'
import type { GameSnapshot } from '../game/GameState'

const screenGeometry = new BoxGeometry(1, 1, 1)
screenGeometry.userData.shared = true
const screenMaterial = new MeshBasicMaterial({
  color: 0xffffff,
  vertexColors: true,
  toneMapped: false,
})
screenMaterial.userData.shared = true
const SCREEN_COLORS = [0x2d8fc0, 0x7650c5, 0xd34b8d, 0x2bb8a6]

export class FestivalEquipmentView {
  readonly group = new Group()
  private screens: InstancedMesh
  private capacity = 1
  private readonly pose = new Object3D()
  private readonly color = new Color()

  constructor() {
    this.screens = this.createScreens(this.capacity)
    this.group.add(this.screens)
  }

  update(snapshot: Readonly<GameSnapshot>, performing: boolean): void {
    const walls = snapshot.buildings.filter((building) => building.kind === 'videoWall')
    this.ensureCapacity(walls.length)
    const powered = new Set(snapshot.power.poweredBuildingIds)
    this.screens.count = walls.length
    this.screens.userData.buildingIds = walls.map((wall) => wall.id)
    walls.forEach((wall, index) => {
      const yaw = wall.rotation * Math.PI / 2
      this.pose.position.set(
        wall.x + 0.5 + Math.sin(yaw) * 0.102,
        wall.elevation + 1.08,
        wall.z + 0.5 + Math.cos(yaw) * 0.102,
      )
      this.pose.rotation.set(0, yaw, 0)
      this.pose.scale.set(0.77, 1.4, 0.012)
      this.pose.updateMatrix()
      this.screens.setMatrixAt(index, this.pose.matrix)
      const active = performing && powered.has(wall.id)
      const paletteIndex = Math.floor(snapshot.simTick / 12 + index * 1.7) % SCREEN_COLORS.length
      this.color.set(active ? SCREEN_COLORS[paletteIndex]! : 0x24313a)
      this.screens.setColorAt(index, this.color)
    })
    this.screens.instanceMatrix.needsUpdate = true
    if (this.screens.instanceColor) this.screens.instanceColor.needsUpdate = true
  }

  private ensureCapacity(required: number): void {
    if (required <= this.capacity) return
    let next = this.capacity
    while (next < required) next *= 2
    this.group.remove(this.screens)
    this.screens.dispose()
    this.capacity = next
    this.screens = this.createScreens(next)
    this.group.add(this.screens)
  }

  private createScreens(capacity: number): InstancedMesh {
    const screens = new InstancedMesh(screenGeometry, screenMaterial, capacity)
    screens.count = 0
    screens.instanceMatrix.setUsage(DynamicDrawUsage)
    screens.castShadow = false
    screens.receiveShadow = false
    return screens
  }
}
