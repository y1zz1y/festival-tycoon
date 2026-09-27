import { Color, Group, Matrix4 } from 'three'
import { personSeed, personStyle } from './pixelPeople'
import { STAFF_DEFINITIONS } from '../game/staff'
import type { StaffMember, StaffRole } from '../game/staff'
import { CrewInstances, type CrewArms, type CrewLook } from './crewInstances'
import { placementMatrix } from './instanceBatch'

type StaffPose = { x: number; y: number; z: number }

/** What a staff member looks like and where they turn; the figure itself is instanced. */
type StaffRecord = {
  role: StaffRole
  look: CrewLook
  hat: 'hatCylinder' | 'hatCone'
  hatColor: Color
  /** Desynchronises the walk cycle: the last digits of the id, as before. */
  phaseOffset: number
  width: number
  height: number
  yaw: number
}

const STAFF_PANTS = new Color(0x3c4c55)
/** The share of the remaining turn made per 60-Hz frame; scaled to the real frame time. */
const YAW_EASING_PER_FRAME = 0.22

export class StaffView {
  readonly group = new Group()
  private readonly records = new Map<string, StaffRecord>()
  private prevPos = new Map<string, StaffPose>()
  private currPos = new Map<string, StaffPose>()
  private interpolatedTick = -1
  private lastTime: number | null = null
  private visible = true
  private readonly crew: CrewInstances
  private readonly ownsCrew: boolean
  private readonly pose = new Matrix4()
  private readonly arms: CrewArms = { leftX: 0, leftZ: 0, rightX: 0, rightZ: 0 }

  /**
   * `crew` is the instanced pool shared with the carriers; WorldView opens and closes
   * it around both views. Without one the view keeps a pool of its own (tests).
   */
  constructor(crew?: CrewInstances) {
    this.crew = crew ?? new CrewInstances()
    this.ownsCrew = !crew
    if (this.ownsCrew) this.group.add(this.crew.group)
  }

  invalidate(): void {
    this.prevPos.clear()
    this.currPos.clear()
    this.interpolatedTick = -1
  }

  /** Staff stay out of the logistics view; they are simply not written into the pool. */
  setVisible(visible: boolean): void {
    this.visible = visible
  }

  update(
    staff: readonly StaffMember[],
    renderAlpha = 1,
    simTick = 0,
    terrainHeight?: (x: number, z: number, y: number) => number,
    time = performance.now(),
  ): void {
    if (simTick !== this.interpolatedTick) {
      this.prevPos = this.currPos
      this.currPos = new Map(
        staff.map((member) => [
          member.id,
          { x: member.x, y: member.y, z: member.z },
        ]),
      )
      this.interpolatedTick = simTick
    }
    const seconds = this.lastTime === null ? 0 : Math.min(0.25, Math.max(0, (time - this.lastTime) / 1000))
    this.lastTime = time
    const turn = 1 - Math.pow(1 - YAW_EASING_PER_FRAME, seconds * 60)
    this.forgetDeparted(staff)
    if (this.ownsCrew) this.crew.begin()
    for (const member of staff) {
      const record = this.recordOf(member)
      record.yaw += Math.atan2(Math.sin(member.facing - record.yaw), Math.cos(member.facing - record.yaw)) * turn
      if (this.visible) this.draw(member, record, renderAlpha, time, terrainHeight)
    }
    if (this.ownsCrew) this.crew.finish()
  }

  private forgetDeparted(staff: readonly StaffMember[]): void {
    if (this.records.size === 0) return
    const ids = new Set(staff.map((member) => member.id))
    for (const id of this.records.keys()) if (!ids.has(id)) this.records.delete(id)
  }

  private recordOf(member: StaffMember): StaffRecord {
    const known = this.records.get(member.id)
    if (known && known.role === member.role) return known
    const definition = STAFF_DEFINITIONS[member.role]
    const appearance = personStyle(personSeed(member.id))
    const record: StaffRecord = {
      role: member.role,
      look: {
        female: appearance.female,
        variant: appearance.variant,
        shirt: new Color(definition.color),
        skin: new Color(appearance.skin),
        pants: STAFF_PANTS,
      },
      hat: member.role === 'firefighter' ? 'hatCone' : 'hatCylinder',
      hatColor: new Color(definition.hatColor),
      phaseOffset: Number(member.id.replace(/\D/g, '').slice(-3)),
      width: appearance.width,
      height: appearance.height,
      // A new face looks where it is going instead of spinning in from north.
      yaw: known?.yaw ?? member.facing,
    }
    this.records.set(member.id, record)
    return record
  }

  private draw(
    member: StaffMember,
    record: StaffRecord,
    renderAlpha: number,
    time: number,
    terrainHeight?: (x: number, z: number, y: number) => number,
  ): void {
    const position = this.interpolatedPose(member, renderAlpha)
    const y = (terrainHeight?.(position.x, position.z, position.y) ?? position.y) + 0.04
    const pose = placementMatrix(this.pose, position.x, y, position.z, record.yaw, record.width, record.height)
    const phase = time * 0.009 + record.phaseOffset
    const swing = member.route.length > 0 ? Math.sin(phase) * 0.65 : 0
    this.arms.leftX = -swing
    this.arms.rightX = swing
    this.crew.figure(pose, record.look, member.id, swing, this.arms)
    this.crew.extra(record.hat, pose, member.id, record.hatColor)
    if (member.role !== 'cleaner') return
    this.crew.broom(pose, member.state === 'working' ? Math.sin(phase * 1.7) * 0.35 : -0.16, member.id)
    if (member.carryingWaste > 0) this.crew.extra('wasteBag', pose, member.id)
  }

  private interpolatedPose(
    member: StaffMember,
    renderAlpha: number,
  ): StaffPose {
    const current = this.currPos.get(member.id) ?? {
      x: member.x,
      y: member.y,
      z: member.z,
    }
    const previous = this.prevPos.get(member.id)
    if (
      !previous ||
      Math.hypot(current.x - previous.x, current.z - previous.z) > 2.5
    ) {
      return current
    }
    return {
      x: previous.x + (current.x - previous.x) * renderAlpha,
      y: previous.y + (current.y - previous.y) * renderAlpha,
      z: previous.z + (current.z - previous.z) * renderAlpha,
    }
  }
}
