import {
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three'
import type { FireworkEffect } from '../game/fireworks'
import { disposeObject3D } from './disposeObject3D'

const rocketGeometry = new CylinderGeometry(0.025, 0.025, 0.18, 6)
const trailGeometry = new CylinderGeometry(0.012, 0.035, 0.75, 6)
const particleGeometry = new SphereGeometry(0.038, 5, 4)
for (const geometry of [rocketGeometry, trailGeometry, particleGeometry]) {
  geometry.userData.shared = true
}
const rocketMaterial = new MeshBasicMaterial({ color: 0xffe7a3 })
rocketMaterial.userData.shared = true
const trailMaterial = new MeshBasicMaterial({
  color: 0xffb44d,
  transparent: true,
  opacity: 0.62,
  depthWrite: false,
})
trailMaterial.userData.shared = true

type FireworkModel = {
  group: Group
  rocket: Mesh
  trail: Mesh
  burst: InstancedMesh
  burstMaterial: MeshBasicMaterial
  directions: Vector3[]
}

export class FireworksView {
  readonly group = new Group()
  private models = new Map<string, FireworkModel>()
  private readonly pose = new Object3D()

  update(effects: readonly FireworkEffect[]): void {
    const activeIds = new Set(effects.map((effect) => effect.id))
    this.models.forEach((model, id) => {
      if (activeIds.has(id)) return
      this.group.remove(model.group)
      disposeObject3D(model.group)
      this.models.delete(id)
    })

    effects.forEach((effect) => {
      let model = this.models.get(effect.id)
      if (!model) {
        model = this.createModel(effect.color)
        this.models.set(effect.id, model)
        this.group.add(model.group)
      }
      const burstTime = effect.age - 0.45
      model.rocket.visible = burstTime < 0
      model.trail.visible = burstTime < 0
      model.burst.visible = burstTime >= 0
      model.group.position.set(
        effect.x,
        effect.y + Math.min(effect.age, 0.45) * 4.2,
        effect.z,
      )
      if (burstTime < 0) {
        model.trail.position.y = -Math.min(0.42, effect.age * 1.2)
        model.trail.scale.y = Math.max(0.15, Math.min(1, effect.age * 3))
        return
      }
      model.directions.forEach((direction, index) => {
        const distance = burstTime * (index % 3 === 0 ? 1.65 : 1.35)
        this.pose.position.set(
          direction.x * distance,
          direction.y * distance - burstTime * burstTime * 0.75,
          direction.z * distance,
        )
        const streak = Math.max(0.35, 1 - burstTime * 0.24)
        this.pose.scale.setScalar(streak)
        this.pose.updateMatrix()
        model.burst.setMatrixAt(index, this.pose.matrix)
      })
      model.burst.instanceMatrix.needsUpdate = true
      model.burstMaterial.opacity = Math.max(0, 1 - burstTime / 1.95)
    })
  }

  private createModel(color: number): FireworkModel {
    const group = new Group()
    const rocket = new Mesh(rocketGeometry, rocketMaterial)
    const trail = new Mesh(trailGeometry, trailMaterial)
    trail.position.y = -0.3
    const directions = Array.from({ length: 24 }, (_, index) => {
      const angle = (index / 24) * Math.PI * 2
      const vertical = ((index % 7) - 3) * 0.17
      return new Vector3(
        Math.cos(angle),
        0.62 + vertical,
        Math.sin(angle),
      ).normalize()
    })
    const burstMaterial = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    })
    const burst = new InstancedMesh(
      particleGeometry,
      burstMaterial,
      directions.length,
    )
    burst.instanceMatrix.setUsage(DynamicDrawUsage)
    burst.frustumCulled = false
    burst.visible = false
    group.add(rocket, trail, burst)
    return { group, rocket, trail, burst, burstMaterial, directions }
  }
}
