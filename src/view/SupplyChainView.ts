import { transportMotionFactor } from './transportMotion'
import { Box3, Group, Line, BufferGeometry, LineBasicMaterial, Matrix4, MeshStandardMaterial, Color, Quaternion, Vector3, type Object3D } from 'three'
import { TerrainShape } from './terrainShape'
import { createTerrainSurface } from './terrainSurface'
import type { GameSnapshot } from '../game/GameState'
import { groundInfo } from '../game/ground'
import { getTerrainHeight } from '../game/terrain'
import { disposeChildren, disposeObject3D } from './disposeObject3D'
import { CARRIER_PANTS, CARRIER_SHIRT } from './carrierModels'
import { createRoadVehicleModel, createSupplyStructure } from './logisticsModels'
import { batchRetroBuildings, createRetroBuilding, ModelKit } from './retroBuildings'
import { staffGateWorldPosition, staffGateYaw } from '../game/supplyChain'
import { buildingSize } from '../game/stageDesign'
import { CrewInstances, crewFigurePose, type CrewArms, type CrewLook } from './crewInstances'
import { InstanceBatch, placementMatrix } from './instanceBatch'
import { houseVariant } from './materials'
import { personSeed, personStyle } from './pixelPeople'

/**
 * How high the fill bars float above what they belong to, measured from the
 * model rather than guessed. A fixed height had them hanging inside the taller
 * ones — the delivery yard swallowed its own bars, and so did the toilets.
 * Measuring means a model that grows takes its bars up with it.
 */
const BAR_CLEARANCE = .18
const modelTops = new Map<string, number>()
function modelTop(key: string, build: () => Object3D | null, fallback: number): number {
  const known = modelTops.get(key)
  if (known !== undefined) return known
  const model = build()
  // Built once only to be measured; the scene gets its own copy elsewhere.
  const top = model ? new Box3().setFromObject(model).max.y : fallback
  if (model) disposeObject3D(model)
  modelTops.set(key, top)
  return top
}

/** Fill bars and staff gates: vertex colours times instance colour, matte. */
const fixtureMaterial = houseVariant(1, 0)
/** A white unit box; every bar frame and fill is one scaled instance of it. */
const barGeometry = (() => { const kit = new ModelKit(); kit.box(0, 0, 0, 1, 1, 1, 0xffffff); return kit.finish() })()
/** Two gold posts and the dark sign bar of a staff entrance, merged. */
const gateGeometry = (() => {
  const kit = new ModelKit()
  kit.box(-.4, .45, 0, .08, .9, .08, 0xe2c35c)
  kit.box(.4, .45, 0, .08, .9, .08, 0xe2c35c)
  kit.box(0, .7, 0, .8, .16, .06, 0x334e5a)
  return kit.finish()
})()
const BAR_FRAME = new Color(0x292d29)
const BAR_EMPTY = new Color(0xe86e53)
const BAR_LOW = new Color(0xe4b557)
const BAR_FULL = new Color(0x70c481)
/** Porters push with both arms forward; the pose never changes. */
const CARRIER_ARMS: CrewArms = { leftX: .58, leftZ: .12, rightX: .58, rightZ: -.12 }
const ONE = new Vector3(1, 1, 1)
const BAR_PART = new Matrix4()
/** Cart and crate stack sit ahead of the porter, who walks behind them. */
const CART_OFFSET = new Matrix4().makeTranslation(0, 0, .16)
const carrierShirt = new Color(CARRIER_SHIRT)
const carrierPants = new Color(CARRIER_PANTS)

type CarrierBuild = { look: CrewLook; width: number; height: number }
function carrierBuild(id: string): CarrierBuild {
  const appearance = personStyle(personSeed(id))
  return {
    look: { female: appearance.female, variant: appearance.variant, shirt: carrierShirt, skin: new Color(appearance.skin), pants: carrierPants },
    width: appearance.width,
    height: appearance.height,
  }
}

/**
 * One moving thing of the supply chain: a porter with cart (`carrier-…` routes), a
 * helper on foot (`push-…`, other routes) or a delivery truck not mirrored by a
 * road vehicle. The figures are drawn by the shared crew batches; this record keeps
 * what they need between frames.
 */
type ActorRecord = {
  kind: 'porter' | 'figure' | 'truck'
  /** Where it is drawn: eased towards `target` every frame. */
  position: Vector3
  yaw: number
  target: Vector3
  facing: number
  moving: boolean
  loaded: boolean
  stuck: boolean
  walkPhase: number
  /** The figure (for a truck: its driver, who shows only when it is stuck). */
  build: CarrierBuild
  /** Clickable as staff: porters only, as before. */
  pickId: string | undefined
  truck?: Group
}

/** A fill display over a stand or depot: where it floats and its bars (ratio 0…1, height). */
type StockRecord = { position: Vector3; bars: Array<{ ratio: number; y: number }> }

export class SupplyChainView {
  group = new Group()
  private ground = new Group()
  private structures = new Group()
  private lines = new Group()
  private trucks = new Group()
  private actors = new Map<string, ActorRecord>()
  private lastAnimationTime: number | null = null
  /** The clock the walk cycle runs on; it stands still while the game is paused. */
  private walkTime = 0
  private groundStamp = ''
  private groundShape: TerrainShape | undefined
  private depotStamp = ''
  private lineStamp = ''
  private gates = new Group()
  private gateStamp = ''
  private readonly gateBatch = new InstanceBatch(this.gates, gateGeometry, fixtureMaterial, { colors: true, name: 'staffGates' })
  private stockModels = new Map<string, StockRecord>()
  /** The fill plates, together, so they can be switched off as one. */
  private stock = new Group()
  private readonly stockBatch = new InstanceBatch(this.stock, barGeometry, fixtureMaterial, { colors: true, name: 'stockBars' })
  private readonly barFacing = new Quaternion()
  private readonly crew: CrewInstances
  private readonly ownsCrew: boolean
  private readonly rig = new Matrix4()
  private readonly pose = new Matrix4()
  private readonly part = new Matrix4()

  /** `crew` is the instanced pool shared with the staff; without one the view keeps its own. */
  constructor(crew?: CrewInstances) {
    this.crew = crew ?? new CrewInstances()
    this.ownsCrew = !crew
    this.group.add(this.ground, this.structures, this.lines, this.gates, this.stock, this.trucks)
    if (this.ownsCrew) this.group.add(this.crew.group)
  }

  getCarrierPosition(id: string): Vector3 | undefined { return this.actors.get(id)?.position }

  update(s: Readonly<GameSnapshot>, planning: boolean, shape?: TerrainShape) {
    this.ground.visible = planning
    this.updateGates(s)
    this.updateStock(s)
    this.updateGround(s, planning, shape)
    this.updateStructures(s)
    this.updateLines(s, planning)
    this.updateActors(s)
  }

  private updateGates(s: Readonly<GameSnapshot>): void {
    const gatePaths = s.buildings.filter(b => b.kind === 'path' && b.staffOnly)
    const gateStamp = gatePaths.map(b => `${b.id}:${b.x}:${b.z}:${b.elevation}:${b.staffGateDirection ?? 'legacy'}:${b.rotation}`).join('|')
    if (gateStamp === this.gateStamp) return
    this.gateStamp = gateStamp
    this.gateBatch.begin()
    for (const p of gatePaths) {
      const pos = staffGateWorldPosition(p)
      this.gateBatch.add(placementMatrix(this.part, pos.x, pos.y, pos.z, staffGateYaw(p)))
    }
    this.gateBatch.finish()
  }

  private stockRecord(id: string, bars: number): StockRecord {
    let record = this.stockModels.get(id)
    if (!record) {
      record = { position: new Vector3(), bars: Array.from({ length: bars }, (_, index) => ({ ratio: 0, y: bars > 1 ? (1 - index) * .12 : 0 })) }
      this.stockModels.set(id, record)
    }
    return record
  }

  private updateStock(s: Readonly<GameSnapshot>): void {
    const i = s.festival.infrastructure
    const stockIds = new Set<string>()
    for (const b of s.buildings) {
      const kind = b.kind === 'food' ? 'food' : b.kind === 'alcohol' ? 'drinks' : b.kind === 'toilet' || b.kind === 'waterPoint' || b.kind === 'shower' ? 'water' : b.kind === 'mascot' || b.kind === 'shirt' ? 'goods' : null
      if (!kind) continue
      stockIds.add(b.id)
      const record = this.stockRecord(b.id, 1)
      // Over the middle of whatever it belongs to, not its front edge: the plate turns
      // with the camera, and a pivot off to one side swings it away from its own stand.
      const footprint = buildingSize(b)
      const standTop = modelTop(`stand:${b.kind}`, () => createRetroBuilding(b.kind), .92)
      record.position.set(b.x + footprint.width / 2, b.elevation + standTop + BAR_CLEARANCE, b.z + footprint.depth / 2)
      record.bars[0]!.ratio = Math.min(1, (i.shops[b.id]?.[kind] ?? 0) / 40)
    }
    const supplies = ['food', 'drinks', 'water', 'goods'] as const
    for (const depot of i.depots) {
      stockIds.add(depot.id)
      const record = this.stockRecord(depot.id, supplies.length)
      // Four bars stack downwards from the origin, so the lowest of them is what
      // has to clear the roof.
      const role = depot.role === 'delivery' ? 'delivery' : 'supply'
      const depotTop = modelTop(`depot:${role}`, () => createSupplyStructure(role), 1.0)
      record.position.set(depot.x + .5, getTerrainHeight(s.terrain, depot.x, depot.z) + depotTop + BAR_CLEARANCE + .24, depot.z + .5)
      supplies.forEach((kind, index) => {
        const capacity = Math.max(depot.minimum[kind], 200)
        record.bars[index]!.ratio = Math.min(1, depot.stock[kind] / capacity)
      })
    }
    for (const id of this.stockModels.keys()) if (!stockIds.has(id)) this.stockModels.delete(id)
    this.paintBars()
  }

  /** Every bar as a dark frame and a coloured fill, turned to `barFacing`. */
  private paintBars(): void {
    const batch = this.stockBatch, base = this.rig, part = this.part
    batch.begin()
    for (const record of this.stockModels.values()) {
      base.compose(record.position, this.barFacing, ONE)
      for (const bar of record.bars) {
        batch.add(part.multiplyMatrices(base, BAR_PART.makeScale(.68, .09, .05).setPosition(0, bar.y, 0)), undefined, BAR_FRAME)
        const color = bar.ratio <= 0 ? BAR_EMPTY : bar.ratio < .25 ? BAR_LOW : BAR_FULL
        const length = Math.max(.025, bar.ratio)
        batch.add(part.multiplyMatrices(base, BAR_PART.makeScale(.64 * length, .065, .065).setPosition(-(1 - bar.ratio) * .32, bar.y, .01)), undefined, color)
      }
    }
    batch.finish()
  }

  private updateGround(s: Readonly<GameSnapshot>, planning: boolean, shape?: TerrainShape): void {
    const i = s.festival.infrastructure
    const stamp = `${planning}:${s.scenario.environment}:${s.scenario.worldSize}:${JSON.stringify(i.ground)}:${JSON.stringify(s.terrain.heights)}`
    if (stamp === this.groundStamp && this.groundShape === shape) return
    this.groundShape = shape
    this.groundStamp = stamp; disposeChildren(this.ground)
    if (!planning) return
    const size = s.scenario.worldSize
    const mesh = createTerrainSurface(s, new MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: .25, roughness: 1, depthWrite: false }), shape)
    const colors = mesh.geometry.getAttribute('color'), tint = new Color()
    let index = 0
    for (let z = -size / 2; z < size / 2; z++) for (let x = -size / 2; x < size / 2; x++) {
      const ground = groundInfo(s, x, z)
      const color = ground.surface === 'paved' ? 0xaebbb7 : ground.surface === 'gravel' ? 0x9e9a85 : ground.compacted ? 0x93835a : ground.drained ? 0x559a98 : ground.type === 'clay' ? 0xb57a59 : ground.type === 'gravel' ? 0xa3a280 : ground.type === 'sand' ? 0xd4bd83 : ground.type === 'grass' ? 0x79a85f : 0x828343
      tint.setHex(color)
      for (let corner = 0; corner < 5; corner++) colors.setXYZ(index++, tint.r, tint.g, tint.b)
    }
    mesh.position.y = .012; this.ground.add(mesh)
  }

  private updateStructures(s: Readonly<GameSnapshot>): void {
    const i = s.festival.infrastructure
    const depots = i.depots.map(d => `${d.id}:${d.role}:${d.x}:${d.z}:${getTerrainHeight(s.terrain, d.x, d.z)}`).join('|')
    if (depots === this.depotStamp) return
    this.depotStamp = depots; disposeChildren(this.structures)
    for (const d of i.depots) {
      const model = createSupplyStructure(d.role === 'delivery' ? 'delivery' : 'supply')
      model.position.set(d.x + .5, getTerrainHeight(s.terrain, d.x, d.z), d.z + .5)
      this.structures.add(model)
    }
    // Like the logistics buildings: one instance per depot of the same kind.
    this.structures.add(batchRetroBuildings(this.structures))
  }

  private updateLines(s: Readonly<GameSnapshot>, planning: boolean): void {
    const i = s.festival.infrastructure
    this.lines.visible = planning
    const lineStamp = planning ? JSON.stringify(i.routes.map(r => [r.id, r.position, r.path])) : ''
    if (!planning || lineStamp === this.lineStamp) return
    this.lineStamp = lineStamp; disposeChildren(this.lines)
    for (const r of i.routes) {
      const points = [r.position, ...r.path].map(p => new Vector3(p.x + .5, p.elevation + .18, p.z + .5))
      if (points.length > 1) this.lines.add(new Line(new BufferGeometry().setFromPoints(points), new LineBasicMaterial({ color: r.kind === 'waste' ? 0xf1a060 : 0x79f6dd, depthTest: false })))
    }
  }

  private createActor(id: string, truck: boolean, x: number, y: number, z: number): ActorRecord {
    const kind = truck ? 'truck' : id.startsWith('carrier-') ? 'porter' : 'figure'
    const record: ActorRecord = {
      kind,
      position: new Vector3(x + .5, y, z + .5),
      yaw: 0,
      target: new Vector3(x + .5, y, z + .5),
      facing: 0,
      moving: false,
      loaded: false,
      stuck: false,
      walkPhase: kind === 'porter' ? personSeed(id) % 1000 : 0,
      build: carrierBuild(truck ? `${id}-driver` : id),
      pickId: kind === 'porter' ? id : undefined,
    }
    if (truck) {
      record.truck = new Group()
      record.truck.add(createRoadVehicleModel('deliveryTruck', id))
      record.truck.position.copy(record.position)
      this.trucks.add(record.truck)
    }
    return record
  }

  private updateActors(s: Readonly<GameSnapshot>): void {
    const i = s.festival.infrastructure
    const active = new Set<string>()
    const actor = (id: string, truck: boolean, x: number, y: number, z: number, loaded: boolean, stuck: boolean) => {
      active.add(id)
      let record = this.actors.get(id)
      if (!record) {
        record = this.createActor(id, truck, x, y, z)
        this.actors.set(id, record)
      }
      const target = record.target
      const dx = x + .5 - target.x, dz = z + .5 - target.z
      if (Math.abs(dx) + Math.abs(dz) > .001) record.facing = Math.atan2(dx, dz)
      target.set(x + .5, y, z + .5)
      record.loaded = loaded && !truck
      record.stuck = stuck
    }
    const deliveryIds = new Set(
      s.logistics.roadVehicles
        .filter((vehicle) => vehicle.kind === 'deliveryTruck')
        .flatMap((vehicle) => [vehicle.id, vehicle.deliveryId ?? '']),
    )
    for (const t of i.trucks) {
      if (deliveryIds.has(t.id)) continue
      actor(t.id, true, t.x, getTerrainHeight(s.terrain, t.x, t.z), t.z, t.cargo > 0, t.stuck > 0)
    }
    for (const r of i.routes) actor(r.id, false, r.position.x, r.position.elevation, r.position.z, r.cargo > 0, false)
    for (const v of s.logistics.roadVehicles) if ((v.stuckMinutes ?? 0) > 0 && v.cell) {
      actor(`push-${v.id}`, false, v.cell.x, getTerrainHeight(s.terrain, v.cell.x, v.cell.z), v.cell.z, false, true)
    }
    for (const [id, record] of this.actors) {
      if (active.has(id)) continue
      if (record.truck) { this.trucks.remove(record.truck); disposeObject3D(record.truck) }
      this.actors.delete(id)
    }
  }

  /**
   * The fill bars are flat plates: seen from behind they are a dark edge, from the
   * side nothing at all. Turning them with the camera is the whole point of them —
   * a stand's stock has to be readable from wherever the player happens to look.
   * Runs every frame, including while the game is paused, since the camera turns then too;
   * the instances are only rewritten when the camera has actually turned.
   */
  faceCamera(orientation: Quaternion): void {
    if (!this.stock.visible || this.barFacing.equals(orientation)) return
    this.barFacing.copy(orientation)
    this.paintBars()
  }

  /** Whether the fill plates are drawn at all; the player decides in the settings. */
  setStockVisible(visible: boolean): void {
    this.stock.visible = visible
  }

  /**
   * Eases every carrier towards its target and writes it into the crew batches. The
   * batches are refilled every frame, so a paused game still draws its carriers —
   * just without moving them or swinging their legs.
   */
  animate(paused: boolean, time = performance.now(), terrainHeight?: (x: number, z: number, y: number) => number): void {
    const seconds = this.lastAnimationTime === null ? 0 : Math.min(.25, Math.max(0, (time - this.lastAnimationTime) / 1000))
    this.lastAnimationTime = time
    if (!paused) this.walkTime = time
    const factor = transportMotionFactor(seconds)
    if (this.ownsCrew) this.crew.begin()
    for (const record of this.actors.values()) {
      if (!paused) this.ease(record, factor, terrainHeight)
      this.draw(record)
    }
    if (this.ownsCrew) this.crew.finish()
  }

  private ease(record: ActorRecord, factor: number, terrainHeight?: (x: number, z: number, y: number) => number): void {
    const { position, target } = record
    // Loading a different world or relocating an actor is not a drive across the map.
    if (position.distanceToSquared(target) > 25) position.copy(target)
    else position.lerp(target, factor)
    if (terrainHeight) position.y = terrainHeight(position.x, position.z, position.y)
    const angle = record.facing - record.yaw
    record.yaw += Math.atan2(Math.sin(angle), Math.cos(angle)) * factor
    record.moving = position.distanceToSquared(target) > 4e-4
  }

  private draw(record: ActorRecord): void {
    const { position, build } = record
    const rig = placementMatrix(this.rig, position.x, position.y, position.z, record.yaw)
    const swing = record.moving ? Math.sin(this.walkTime * 0.009 + record.walkPhase) * .55 : 0
    if (record.truck) {
      record.truck.position.copy(position)
      record.truck.rotation.y = record.yaw
      if (!record.stuck) return
      // The driver gets out to push when the truck is stuck.
      const driver = crewFigurePose(this.pose, rig, .36, .4, build.width, build.height)
      this.crew.figure(driver, build.look, undefined, swing, CARRIER_ARMS)
      this.crew.extra('carrierKit', driver, undefined)
      return
    }
    const porter = record.kind === 'porter'
    const figure = crewFigurePose(this.pose, rig, 0, porter ? -.12 : 0, build.width, build.height)
    this.crew.figure(figure, build.look, record.pickId, swing, CARRIER_ARMS)
    this.crew.extra('carrierKit', figure, record.pickId)
    if (!porter) return
    const cart = this.part.multiplyMatrices(rig, CART_OFFSET)
    this.crew.extra('cart', cart, record.pickId)
    if (record.loaded) this.crew.extra('load', cart, record.pickId)
  }
}
