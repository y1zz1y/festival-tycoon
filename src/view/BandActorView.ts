import { Group } from 'three'
import { createBandMemberModel } from './bandMemberMesh'
import { disposeObject3D } from './disposeObject3D'
import type { BandActor } from '../game/bandActors'
import type { BandRole } from '../game/bandLooks'

type Pose = { x: number; y: number; z: number }

export class BandActorView {
  readonly group = new Group()
  private models = new Map<string, Group>()
  private prevPos = new Map<string, Pose>()
  private currPos = new Map<string, Pose>()
  private interpolatedTick = -1

  invalidate(): void {
    this.prevPos.clear()
    this.currPos.clear()
    this.interpolatedTick = -1
  }

  update(
    actors: readonly BandActor[],
    renderAlpha = 1,
    simTick = 0,
    terrainHeight?: (x: number, z: number, y: number) => number,
  ): void {
    if (simTick !== this.interpolatedTick) {
      this.prevPos = this.currPos
      this.currPos = new Map(
        actors.map((actor) => [actor.id, { x: actor.x, y: actor.y, z: actor.z }]),
      )
      this.interpolatedTick = simTick
    }
    const ids = new Set(actors.map((actor) => actor.id))
    this.models.forEach((model, id) => {
      if (ids.has(id)) return
      this.group.remove(model)
      disposeObject3D(model)
      this.models.delete(id)
    })
    actors.forEach((actor) => {
      const hidden = Boolean(actor.vehicleId) || actor.state === 'performing'
      let model = this.models.get(actor.id)
      if (hidden) {
        if (model) model.visible = false
        return
      }
      if (!model || model.userData.costumeId !== actor.costumeId) {
        if (model) {
          this.group.remove(model)
          disposeObject3D(model)
        }
        model = this.createModel(actor)
        this.models.set(actor.id, model)
        this.group.add(model)
      }
      model.visible = true
      const moving = actor.route.length > 0
      const phase = Number(actor.id.replace(/\D/g, '').slice(-3)) * 0.37 + actor.facing
      const pose = this.interpolatedPose(actor, renderAlpha)
      model.position.set(
        pose.x,
        (terrainHeight?.(pose.x, pose.z, pose.y) ?? pose.y) + 0.04,
        pose.z,
      )
      model.rotation.y +=
        Math.atan2(
          Math.sin(actor.facing - model.rotation.y),
          Math.cos(actor.facing - model.rotation.y),
        ) * 0.22
      const arms = model.userData.arms as Group[] | undefined
      arms?.forEach((arm, index) => {
        arm.rotation.x = moving ? Math.sin(phase + index) * 0.55 * (index ? 1 : -1) : 0
      })
    })
  }

  private createModel(actor: BandActor): Group {
    const role = (actor.role ?? 'singer') as BandRole
    const model = createBandMemberModel(actor.bandId, role, actor.memberIndex ?? 0)
    model.scale.setScalar(0.82)
    return model
  }

  private interpolatedPose(actor: BandActor, renderAlpha: number): Pose {
    const current = this.currPos.get(actor.id) ?? { x: actor.x, y: actor.y, z: actor.z }
    const previous = this.prevPos.get(actor.id)
    if (!previous || Math.hypot(current.x - previous.x, current.z - previous.z) > 2.5) {
      return current
    }
    return {
      x: previous.x + (current.x - previous.x) * renderAlpha,
      y: previous.y + (current.y - previous.y) * renderAlpha,
      z: previous.z + (current.z - previous.z) * renderAlpha,
    }
  }
}
