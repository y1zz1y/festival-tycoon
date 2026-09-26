import { Group, Matrix4, type BufferGeometry, type Color, type InstancedMesh, type Material, type Raycaster } from 'three'
import { carrierCartGeometry, carrierKitMaterial, carrierLoadGeometry, carrierUniformGeometry } from './carrierModels'
import { InstanceBatch, placementMatrix } from './instanceBatch'
import { houseVariant, shared } from './materials'
import { instanceOwnerId } from './picking'
import { composeLimb, createNudeAnatomy, createPersonDetails, createPersonGeometry, PERSON_VARIANTS } from './pixelPeople'
import { ModelKit } from './retroBuildings'

/** How one crew member looks: the parts come from the visitor figure, the colours from the job. */
export type CrewLook = {
  female: boolean
  variant: number
  shirt: Color
  skin: Color
  pants: Color
}

/** Arm angles (rotation about x and z) for the left and the right arm. */
export type CrewArms = { leftX: number; leftZ: number; rightX: number; rightZ: number }

/** What a crew member can carry besides the figure itself. */
export type CrewExtra = 'hatCylinder' | 'hatCone' | 'broom' | 'wasteBag' | 'carrierKit' | 'cart' | 'load'

/**
 * Tinted parts: white vertex colours times the instance colour, so one material
 * serves every uniform, skin tone and pair of trousers. Matte like the old figures.
 */
const tintedMaterial = houseVariant(0.9, 0)
/** Parts that keep their baked colours: hair, broom, waste bag. No instance colour. */
const plainMaterial = houseVariant(0.9, 0)
/**
 * The carrier kit's own look for the batches; a separate object from the one the
 * single-mesh porters (previews, trucks) use, so neither switches shader programs.
 */
const kitMaterial = shared(carrierKitMaterial().clone())

const extraGeometries = new Map<string, BufferGeometry>()
function extraGeometry(key: string, build: (kit: ModelKit) => void): BufferGeometry {
  const cached = extraGeometries.get(key)
  if (cached) return cached
  const kit = new ModelKit()
  build(kit)
  const geometry = kit.finish()
  extraGeometries.set(key, geometry)
  return geometry
}

/** A staff cap, white so the instance colour paints it; sits on the head. */
function crewHatGeometry(kind: 'hatCylinder' | 'hatCone'): BufferGeometry {
  return extraGeometry(kind, (kit) => {
    if (kind === 'hatCone') kit.cylinder(0, 0.72, 0, 0.13, 0.15, 0xffffff, 0, 8)
    else kit.cylinder(0, 0.72, 0, 0.1, 0.08, 0xffffff, 0.12, 10)
  })
}

/** Handle and brush in one piece; it pivots at the cleaner's side, see `CrewInstances.broom`. */
function crewBroomGeometry(): BufferGeometry {
  return extraGeometry('broom', (kit) => {
    kit.cylinder(0, 0.36, 0, 0.012, 0.65, 0x936239, 0.012, 6)
    kit.box(0, 0.04, 0, 0.22, 0.06, 0.08, 0xe1c062)
  })
}

/** The sack a cleaner carries to the dump, already at the hip. */
function crewWasteBagGeometry(): BufferGeometry {
  return extraGeometry('wasteBag', (kit) => kit.box(-0.14, 0.28, 0.04, 0.1, 0.12, 0.08, 0x6b5a32))
}

const offset = new Matrix4()
/** A figure standing at `offset` inside a vehicle or porter rig, scaled to its build. */
export function crewFigurePose(out: Matrix4, rig: Matrix4, offsetX: number, offsetZ: number, width: number, height: number): Matrix4 {
  placementMatrix(offset, offsetX, 0, offsetZ, 0, width, height)
  return out.multiplyMatrices(rig, offset)
}

/**
 * Every staff member and every carrier on the map, drawn by a fixed set of
 * instanced batches: torso (male/female), bust, head, both legs, both arms, the 16
 * hair variants, two hats, broom, waste bag and the carrier's vest, cart and load.
 * The number of draw calls does not depend on how many people there are. Views
 * write their people between `begin()` and `finish()` every frame; the batches keep
 * `userData.staffIds`, so picking stays per person.
 */
export class CrewInstances {
  readonly group = new Group()
  private readonly body: InstanceBatch
  private readonly femaleBody: InstanceBatch
  private readonly bust: InstanceBatch
  private readonly head: InstanceBatch
  private readonly leg: InstanceBatch
  private readonly arm: InstanceBatch
  private readonly details: InstanceBatch[]
  private readonly extras: Record<CrewExtra, InstanceBatch>
  private readonly batches: InstanceBatch[]
  private readonly matrix = new Matrix4()

  constructor() {
    this.group.name = 'crew'
    const tinted = (geometry: BufferGeometry) =>
      new InstanceBatch(this.group, geometry, tintedMaterial, { colors: true, idKey: 'staffIds' })
    const plain = (geometry: BufferGeometry, material: Material = plainMaterial) =>
      new InstanceBatch(this.group, geometry, material, { idKey: 'staffIds' })
    this.body = tinted(createPersonGeometry('body'))
    this.femaleBody = tinted(createPersonGeometry('femaleBody'))
    this.bust = tinted(createNudeAnatomy('bust'))
    this.head = tinted(createPersonGeometry('head'))
    this.leg = tinted(createPersonGeometry('leg'))
    this.arm = tinted(createPersonGeometry('arm'))
    this.details = Array.from({ length: PERSON_VARIANTS }, (_, variant) => plain(createPersonDetails(variant, false)))
    this.extras = {
      hatCylinder: tinted(crewHatGeometry('hatCylinder')),
      hatCone: tinted(crewHatGeometry('hatCone')),
      broom: plain(crewBroomGeometry()),
      wasteBag: plain(crewWasteBagGeometry()),
      carrierKit: plain(carrierUniformGeometry(), kitMaterial),
      cart: plain(carrierCartGeometry(), kitMaterial),
      load: plain(carrierLoadGeometry(), kitMaterial),
    }
    this.batches = [this.body, this.femaleBody, this.bust, this.head, this.leg, this.arm, ...this.details, ...Object.values(this.extras)]
  }

  begin(): void {
    for (const batch of this.batches) batch.begin()
  }

  finish(): void {
    for (const batch of this.batches) batch.finish()
  }

  /**
   * One figure. `pose` holds position, heading and build; the legs swing by
   * ±`legSwing`, the arms take the given angles. `id` makes it clickable.
   */
  figure(pose: Matrix4, look: CrewLook, id: string | undefined, legSwing: number, arms: CrewArms): void {
    const matrix = this.matrix
    composeLimb(matrix, pose, 0, 0.39, 0)
    ;(look.female ? this.femaleBody : this.body).add(matrix, id, look.shirt)
    if (look.female) this.bust.add(matrix, id, look.shirt)
    this.head.add(composeLimb(matrix, pose, 0, 0.605, 0), id, look.skin)
    this.leg.add(composeLimb(matrix, pose, -0.044, 0.275, 0, legSwing), id, look.pants)
    this.leg.add(composeLimb(matrix, pose, 0.044, 0.275, 0, -legSwing), id, look.pants)
    const shoulder = look.female ? 0.11 : 0.128
    this.arm.add(composeLimb(matrix, pose, -shoulder, 0.485, 0, arms.leftX, 0, arms.leftZ), id, look.skin)
    this.arm.add(composeLimb(matrix, pose, shoulder, 0.485, 0, arms.rightX, 0, arms.rightZ), id, look.skin)
    this.details[look.variant % PERSON_VARIANTS]!.add(pose, id)
  }

  /** Something carried or worn, already placed by `matrix`; hats take `color`. */
  extra(kind: CrewExtra, matrix: Matrix4, id: string | undefined, color?: Color): void {
    this.extras[kind].add(matrix, id, color)
  }

  /** A broom held at the right hand, tilted by `angle` about the forward axis. */
  broom(pose: Matrix4, angle: number, id: string | undefined): void {
    this.extras.broom.add(composeLimb(this.matrix, pose, 0.16, 0, 0.06, 0, 0, angle), id)
  }

  /** Whose figure the ray hits first; people without an id are not clickable. */
  pick(raycaster: Raycaster): string | undefined {
    const hits = raycaster.intersectObjects(this.meshes(), false)
    for (const hit of hits) {
      const id = instanceOwnerId(hit.object.userData, 'staffIds', hit.instanceId)
      if (id) return id
    }
    return undefined
  }

  meshes(): InstancedMesh[] {
    return this.batches.map((batch) => batch.mesh)
  }

  /** How many instances a part has this frame; for tests and diagnostics. */
  countOf(part: 'body' | 'femaleBody' | 'bust' | 'head' | 'leg' | 'arm' | CrewExtra): number {
    const batch = part in this.extras ? this.extras[part as CrewExtra] : this[part as 'body']
    return batch.count
  }
}
