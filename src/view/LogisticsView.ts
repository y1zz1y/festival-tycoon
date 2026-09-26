import { createWayStructure, indexWayStructures, wayStructurePlan, type WayStructureCell } from './wayStructures'
import { batchRetroBuildings } from './retroBuildings'
import { transportMotionFactor } from './transportMotion'
import { parkingTexture, wayTexture } from './wayTextures'
import type { WayType } from '../game/wayTypes'
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Group,
  Line,
  Matrix4,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  DoubleSide,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three'
import type { BusPlannerStopMarker } from '../game/busPlanner'
import { waySurfaceY } from '../game/wayElevation'
import type {
  AmbulanceGarage,
  BusDepot,
  BusStop,
  WasteDepot,
  SpecialDepot,
  Direction,
  LogisticsSnapshot,
  ParkingCell,
  RoadCell,
  RoadPosition,
  RoadVehicle,
} from '../game/logistics'
import { resolveRoadLayer } from '../game/logistics'
import { disposeObject3D } from './disposeObject3D'
import {
  createLogisticsFacility,
  logisticsFacilityFootprint,
  roadVehicleBatchGeometries,
  roadVehicleBatchMaterial,
  roadVehicleParts,
  type LogisticsFacilityKind,
  type RoadVehiclePart,
} from './logisticsModels'
import { createRoadDirectionArrowGeometry } from './roadDirectionArrow'
import { InstanceBatch, placementMatrix } from './instanceBatch'

type FacilityLike = AmbulanceGarage | BusDepot | BusStop | WasteDepot | SpecialDepot
type VehicleLike = RoadVehicle & {
  facing?: number
}

/** Where a vehicle is drawn: eased towards the snapshot, as the old per-vehicle model was. */
type VehiclePose = {
  kind: RoadVehicle['kind']
  x: number
  y: number
  z: number
  yaw: number
  parts: readonly RoadVehiclePart[]
}

const HALF_PI = Math.PI / 2
const DIRECTION_ANGLE: Readonly<Record<Direction, number>> = {
  0: 0,
  1: HALF_PI,
  2: Math.PI,
  3: -HALF_PI,
}

function directionsFromMask(mask: number | null): Direction[] {
  if (mask === null) return [0, 1, 2, 3]
  return ([0, 1, 2, 3] as const).filter((direction) => (mask & (1 << direction)) !== 0)
}

function structureFingerprint(logistics: Readonly<LogisticsSnapshot>): string {
  const roadPart = logistics.roadCells.map((road) => {
    return [
      road.x,
      road.z,
      road.allowedDirections ?? 'all',
      road.blockedEdges,
      road.speedLimit,
      Number(road.crosswalk),
      road.elevation ?? '',
      road.roadSlope ?? 0,
      road.roadSlopeDirection ?? 0,
    ].join(':')
  }).join('|')
  const itemPart = (
    prefix: string,
    items: readonly (ParkingCell | FacilityLike)[],
  ): string => items.map((item) => {
    return [
      prefix,
      'id' in item ? item.id : '',
      item.x,
      item.z,
    ].join(':')
  }).join('|')
  return [
    roadPart,
    itemPart('p', logistics.parkingCells),
    itemPart('g', logistics.ambulanceGarages),
    itemPart('d', logistics.busDepots),
    itemPart('w', logistics.wasteDepots),
    itemPart('y', logistics.specialDepots ?? []),
    itemPart('s', logistics.busStops),
  ].join('#')
}

const roadArrowGeometry = createRoadDirectionArrowGeometry('paint')
roadArrowGeometry.userData.shared = true
const roadArrowMaterial = new MeshBasicMaterial({
  color: 0xf4f0de,
  depthTest: false,
  depthWrite: false,
  side: DoubleSide,
})
roadArrowMaterial.userData.shared = true

const PARKING_ASPHALT = 0x555960
const parkingAsphaltGeometry = new PlaneGeometry(0.94, 0.94)
parkingAsphaltGeometry.userData.shared = true
const parkingHelperGeometry = new PlaneGeometry(0.82, 0.82)
parkingHelperGeometry.userData.shared = true
let parkingAsphaltMaterial: MeshStandardMaterial | null = null
function getParkingAsphaltMaterial(): MeshStandardMaterial {
  if (parkingAsphaltMaterial) return parkingAsphaltMaterial
  parkingAsphaltMaterial = new MeshStandardMaterial({
    color: PARKING_ASPHALT,
    map: parkingTexture(),
    roughness: 1,
  })
  parkingAsphaltMaterial.userData.shared = true
  return parkingAsphaltMaterial
}
const parkingMarkMaterial = new MeshStandardMaterial({ color: 0xf4f4ec, roughness: 0.85 })
parkingMarkMaterial.userData.shared = true
/** The "P" painted on every space, all the time — faint, so it reads as a parking lot at a
 * glance without competing with the free/occupied overlay drawn on top of it. */
const parkingLetterMaterial = new MeshStandardMaterial({
  color: 0xf4f4ec,
  transparent: true,
  opacity: 0.3,
  depthWrite: false,
  roughness: 0.85,
})
parkingLetterMaterial.userData.shared = true
const parkingFreeMaterial = new MeshStandardMaterial({
  color: 0x4c9b63,
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
})
parkingFreeMaterial.userData.shared = true
const parkingOccupiedMaterial = new MeshStandardMaterial({
  color: 0xd4884d,
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
})
parkingOccupiedMaterial.userData.shared = true

type ParkingHelper = { group: Group; free: Mesh; occupied: Mesh }

/**
 * Everything static on a road or a parking space shares its box and its material with
 * every other piece of the same size and colour, and is marked static, so
 * batchRetroBuildings turns a whole network into a few instanced batches instead of
 * a mesh, a geometry and a material per crosswalk stripe, barrier foot or road tile.
 */
const sharedBoxes = new Map<string, BoxGeometry>()
function sharedBox(size: readonly [number, number, number]): BoxGeometry {
  const key = size.map((value) => value.toFixed(4)).join(':')
  const cached = sharedBoxes.get(key)
  if (cached) return cached
  const geometry = new BoxGeometry(...size)
  geometry.userData.shared = true
  sharedBoxes.set(key, geometry)
  return geometry
}
const sharedPlanes = new Map<string, PlaneGeometry>()
function sharedPlane(width: number, length: number): PlaneGeometry {
  const key = `${width.toFixed(4)}:${length.toFixed(4)}`
  const cached = sharedPlanes.get(key)
  if (cached) return cached
  const geometry = new PlaneGeometry(width, length)
  geometry.userData.shared = true
  sharedPlanes.set(key, geometry)
  return geometry
}
const sharedMaterials = new Map<string, MeshStandardMaterial>()
function sharedMaterial(key: string, create: () => MeshStandardMaterial): MeshStandardMaterial {
  const cached = sharedMaterials.get(key)
  if (cached) return cached
  const material = create()
  material.userData.shared = true
  sharedMaterials.set(key, material)
  return material
}

function addBox(
  parent: Group,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  color: number,
  roughness = 0.8,
): Mesh {
  const mesh = new Mesh(
    sharedBox(size),
    sharedMaterial(`box:${color}:${roughness}`, () => new MeshStandardMaterial({ color, roughness })),
  )
  mesh.position.set(...position)
  mesh.userData.retroStatic = true
  parent.add(mesh)
  return mesh
}

function addSharedMark(
  parent: Group,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  material: MeshStandardMaterial = parkingMarkMaterial,
  batched = false,
): Mesh {
  const mesh = new Mesh(sharedBox(size), material)
  mesh.position.set(...position)
  mesh.userData.retroStatic = batched
  parent.add(mesh)
  return mesh
}
/** The four strokes of a "P": a stem and a bowl closed on its right. Shared by the always-on
 * paint and the free/occupied helper overlay, so both read as the same letter in the same spot. */
function addParkingLetter(parent: Group, y: number, material: MeshStandardMaterial, batched = false): void {
  addSharedMark(parent, [0.07, 0.018, 0.5], [-0.17, y, 0], material, batched)
  addSharedMark(parent, [0.3, 0.018, 0.07], [-0.02, y, -0.215], material, batched)
  addSharedMark(parent, [0.3, 0.018, 0.07], [-0.02, y, 0], material, batched)
  addSharedMark(parent, [0.07, 0.018, 0.22], [0.13, y, -0.11], material, batched)
}

export class LogisticsView {
  private structurePaths: WayStructureCell[] = []
  setStructurePaths(paths: WayStructureCell[]): void { this.structurePaths = paths }
  private structureRoads = new Map<RoadCell, WayStructureCell>()
  private structureIndex = indexWayStructures([])
  readonly group = new Group()
  private readonly staticGroup = new Group()
  private readonly vehicleGroup = new Group()
  /** The vehicle batches only (picking, shader warm-up); routes and numbers stay beside them. */
  private readonly vehicleBatchGroup = new Group()
  private readonly vehiclePoses = new Map<string, VehiclePose>()
  private readonly vehicleBatches = new Map<BufferGeometry, InstanceBatch>()
  private readonly vehicleMatrix = new Matrix4()
  private readonly parkingHelpers = new Map<string, ParkingHelper>()
  private showParkingHelpers = false
  private roadSurface: (x: number, z: number) => WayType | undefined = () => undefined
  private roadColor: (x: number, z: number) => number = () => 0x50555a
  private lastAnimationTime: number | null = null
  private movementFactor = 0
  private staticFingerprint = ''
  private inspectedVehicleId: string | null = null
  private inspectStamp = ''
  private inspectRoute: Line | null = null
  private plannerRouteCells: RoadPosition[] = []
  private plannerMarkers: BusPlannerStopMarker[] = []
  private plannerStamp = ''
  private plannerRoute: Line | null = null
  private plannerNumbers: Mesh | null = null
  private plannerNumberTexture: CanvasTexture | null = null
  private plannerNumberMaterial: MeshBasicMaterial | null = null
  private readonly plannerMaterial = new LineBasicMaterial({
    color: 0xf4d35e,
    depthTest: false,
  })
  private getGroundY: (x: number, z: number) => number = () => 0
  private roadsByKey = new Map<string, RoadCell[]>()
  private readonly marksGroup = new Group()
  private facingFactor = 0

  constructor() {
    this.group.add(this.staticGroup, this.vehicleGroup, this.marksGroup)
    this.vehicleBatchGroup.name = 'vehicles'
    this.vehicleGroup.add(this.vehicleBatchGroup)
    // Up front and empty: the load-time shader compile covers them, and an empty
    // batch costs no draw call.
    for (const geometry of roadVehicleBatchGeometries()) this.vehicleBatch(geometry)
  }

  /** One batch per vehicle geometry (by identity): all cars of every colour share two. */
  private vehicleBatch(geometry: BufferGeometry): InstanceBatch {
    let batch = this.vehicleBatches.get(geometry)
    if (!batch) {
      batch = new InstanceBatch(this.vehicleBatchGroup, geometry, roadVehicleBatchMaterial(), {
        colors: true,
        idKey: 'vehicleIds',
        castShadow: true,
        receiveShadow: true,
      })
      this.vehicleBatches.set(geometry, batch)
    }
    return batch
  }

  invalidate(): void {
    this.staticFingerprint = ''
  }

  setInspectedVehicle(id: string | null): void {
    this.inspectedVehicleId = id
    this.inspectStamp = ''
  }

  setPlannerRoute(
    cells: readonly RoadPosition[] | null,
    markers?: readonly BusPlannerStopMarker[] | null,
  ): void {
    this.plannerRouteCells = cells ? cells.map((cell) => ({ ...cell })) : []
    this.plannerMarkers = markers ? markers.map((marker) => ({ ...marker })) : []
    this.plannerStamp = ''
    this.refreshPlannerRoute()
  }

  getVehiclePickRoot(): Group {
    return this.vehicleBatchGroup
  }

  getStaticPickRoot(): Group {
    return this.staticGroup
  }

  update(
    logistics: Readonly<LogisticsSnapshot>,
    getGroundY: (x: number, z: number) => number = () => 0,
    roadColor: (x: number, z: number) => number = () => 0x50555a,
    roadSurface: (x: number, z: number) => WayType | undefined = () => undefined,
    paused = false,
    time = performance.now(),
    showParkingHelpers = false,
    /**
     * Whether roads, parking, facilities, terrain or road colours may have changed
     * since the last call (WorldView passes its `dataChanged`). Only then are the
     * road index and the static fingerprint rebuilt: doing that every frame cost
     * about 0.85 ms per frame on festivalmittel.
     */
    structureChanged = true,
  ): void {
    const seconds=this.lastAnimationTime===null?0:Math.min(.25,Math.max(0,(time-this.lastAnimationTime)/1000))
    this.lastAnimationTime=time
    this.movementFactor=paused?0:transportMotionFactor(seconds)
    this.facingFactor=paused?0:1-Math.exp(-seconds/0.32)
    this.getGroundY = getGroundY
    this.roadColor = roadColor
    this.roadSurface = roadSurface
    if (structureChanged || this.staticFingerprint === '') this.refreshStructure(logistics, getGroundY, roadColor)
    if (this.showParkingHelpers !== showParkingHelpers) {
      this.showParkingHelpers = showParkingHelpers
      this.staticGroup.traverse(o => { if (o.userData.roadHelper) o.visible = showParkingHelpers })
      this.parkingHelpers.forEach((helper) => {
        helper.group.visible = showParkingHelpers
      })
    }
    this.updateParkingOccupancy(logistics.parkingCells)
    this.updateVehicles(logistics.roadVehicles)
    this.updateInspectRoute(logistics.roadVehicles)
    this.refreshPlannerRoute()
  }

  /** The road index for vehicle heights, and a static rebuild if anything static changed. */
  private refreshStructure(
    logistics: Readonly<LogisticsSnapshot>,
    getGroundY: (x: number, z: number) => number,
    roadColor: (x: number, z: number) => number,
  ): void {
    this.roadsByKey = new Map()
    for (const cell of logistics.roadCells) {
      const key = `${cell.x}:${cell.z}`
      const layers = this.roadsByKey.get(key)
      if (layers) layers.push(cell)
      else this.roadsByKey.set(key, [cell])
    }
    const heightPart = [
      ...logistics.roadCells.map((cell) => `${getGroundY(cell.x, cell.z)}:${cell.elevation ?? ''}:${cell.roadSlope ?? 0}`),
      ...logistics.parkingCells.map((cell) => getGroundY(cell.x, cell.z)),
      ...logistics.ambulanceGarages.map((cell) => getGroundY(cell.x, cell.z)),
      ...logistics.busDepots.map((cell) => getGroundY(cell.x, cell.z)),
      ...logistics.wasteDepots.map((cell) => getGroundY(cell.x, cell.z)),
      ...(logistics.specialDepots ?? []).map((cell) => getGroundY(cell.x, cell.z)),
      ...logistics.busStops.map((cell) => getGroundY(cell.x, cell.z)),
    ].join(',')
    const fingerprint = `${JSON.stringify(this.structurePaths)}#${structureFingerprint(logistics)}#${heightPart}#${logistics.roadCells.map(c => roadColor(c.x, c.z)).join()}`
    if (fingerprint !== this.staticFingerprint) {
      this.staticFingerprint = fingerprint
      this.rebuildStatic(logistics)
    }
  }

  private groundY(x: number, z: number): number {
    return this.getGroundY(x, z)
  }

  private roadY(road: Pick<RoadCell, 'x' | 'z' | 'elevation' | 'roadSlope'>): number {
    const elevation = road.elevation ?? this.groundY(road.x, road.z)
    return waySurfaceY(elevation, road.roadSlope ?? 0)
  }

  private roadAt(x: number, z: number, elevation?: number): RoadCell | undefined {
    return resolveRoadLayer(
      this.roadsByKey.get(`${Math.round(x)}:${Math.round(z)}`) ?? [],
      elevation,
    )
  }

  private rebuildStatic(logistics: Readonly<LogisticsSnapshot>): void {
    this.parkingHelpers.clear()
    this.staticGroup.children.slice().forEach((child) => {
      this.staticGroup.remove(child)
      disposeObject3D(child)
    })
    this.marksGroup.children.slice().forEach((child) => {
      this.marksGroup.remove(child)
      disposeObject3D(child)
    })
    this.structureRoads = new Map(logistics.roadCells.map(r => [r, {x:r.x, z:r.z, elevation:r.elevation ?? this.groundY(r.x,r.z), slope:r.roadSlope ?? 0, direction:r.roadSlopeDirection ?? 0, road:true, marked:!this.roadSurface(r.x,r.z) || this.roadSurface(r.x,r.z)==='roadAsphalt'}]))
    this.structureIndex = indexWayStructures([...this.structureRoads.values(), ...this.structurePaths])
    logistics.roadCells.forEach((road) => {
      this.staticGroup.add(this.createRoad(road))
    })
    logistics.parkingCells.forEach((space) => {
      this.staticGroup.add(this.createParkingSpace(space))
    })
    logistics.ambulanceGarages.forEach((garage) => {
      this.staticGroup.add(this.placeFacility(garage, 'ambulanceGarage'))
    })
    ;(logistics.fireStations ?? []).forEach((station) => {
      this.staticGroup.add(this.placeFacility(station, 'fireStation'))
    })
    logistics.busDepots.forEach((depot) => {
      this.staticGroup.add(this.placeFacility(depot, 'busDepot'))
    })
    logistics.wasteDepots.forEach((depot) => {
      this.staticGroup.add(this.placeFacility(depot, 'wasteDepot'))
    })
    ;(logistics.specialDepots ?? []).forEach((depot) => {
      this.staticGroup.add(this.placeFacility(depot, 'specialDepot'))
    })
    logistics.busStops.forEach((stop) => {
      this.staticGroup.add(this.placeFacility(stop, 'busStop'))
    })
    this.staticGroup.add(batchRetroBuildings(this.staticGroup))
    this.marksGroup.add(batchRetroBuildings(this.marksGroup))
  }

  private createRoad(road: RoadCell): Group {
    const group = new Group()
    const slope = road.roadSlope ?? 0
    const elevation = road.elevation ?? this.groundY(road.x, road.z)
    group.position.set(road.x + 0.5, elevation + 0.012, road.z + 0.5)
    const deck = new Group()
    if (slope !== 0) {
      deck.position.set(0, -slope / 2, 0)
      deck.quaternion.setFromUnitVectors(
        new Vector3(0, 0, 1),
        new Vector3(0, slope, 1).normalize(),
      )
      group.rotation.y = DIRECTION_ANGLE[(road.roadSlopeDirection ?? 0) as Direction]
    }
    group.add(deck)
    const color = this.roadColor(road.x, road.z)
    const surface = this.roadSurface(road.x, road.z) ?? 'roadAsphalt'
    const asphalt = new Mesh(
      sharedPlane(1, Math.hypot(1, slope)),
      sharedMaterial(`road:${surface}:${color}`, () => new MeshStandardMaterial({ color, map: wayTexture(surface), roughness: 1 })),
    )
    asphalt.rotation.x = -HALF_PI
    asphalt.receiveShadow = true
    asphalt.userData.retroStatic = true
    asphalt.userData.flatSurface = true
    deck.add(asphalt)
    const cell = this.structureRoads.get(road)!
    const structure = createWayStructure(cell, wayStructurePlan(cell, this.structureIndex, this.groundY(road.x, road.z)))
    if (structure) group.add(structure)

    const speed = road.speedLimit
    const zoneColor = speed <= 10 ? 0x35bb66 : speed <= 30 ? 0xf2cf45 : 0xe64b45
    // The speed tint is a build helper, switched on and off with the road tools, so it
    // stays a mesh of its own; its material and shape are shared all the same.
    const zone = new Mesh(
      sharedPlane(0.78, slope === 0 ? 0.78 : Math.hypot(0.78, slope)),
      sharedMaterial(`zone:${zoneColor}`, () => new MeshStandardMaterial({
        color: zoneColor,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      })),
    )
    zone.rotation.x = -HALF_PI
    zone.position.y = 0.008
    zone.visible = this.showParkingHelpers
    zone.userData.roadHelper = true
    deck.add(zone)

    if (road.crosswalk) {
      for (let index = -3; index <= 3; index += 1) {
        addBox(deck, [0.08, 0.012, 0.68], [index * 0.115, 0.026, 0], 0xf7f7ef)
      }
    }

    (road.allowedDirections === null
      ? []
      : directionsFromMask(road.allowedDirections)
    ).forEach((direction) => {
      const arrow = new Mesh(roadArrowGeometry, roadArrowMaterial)
      arrow.userData.retroStatic = true
      arrow.rotation.y = DIRECTION_ANGLE[direction]
      arrow.position.set(road.x + 0.5, this.roadY(road) + 0.018, road.z + 0.5)
      arrow.scale.setScalar(0.72)
      this.marksGroup.add(arrow)
    })

    directionsFromMask(road.blockedEdges).forEach((direction) => {
      const barrier = addBox(group, [0.58, 0.075, 0.055], [0, 0.075, 0.39], 0xd63832)
      barrier.rotation.y = DIRECTION_ANGLE[direction]
      barrier.position.set(0, 0.075, 0.39)
      barrier.position.applyAxisAngle(
        { x: 0, y: 1, z: 0 },
        DIRECTION_ANGLE[direction],
      )
      for (let offset = -0.2; offset <= 0.2; offset += 0.4) {
        const foot = addBox(group, [0.045, 0.14, 0.045], [offset, 0.07, 0.39], 0x24272a)
        foot.position.applyAxisAngle(
          { x: 0, y: 1, z: 0 },
          DIRECTION_ANGLE[direction],
        )
      }
    })
    return group
  }

  private updateParkingOccupancy(spaces: readonly ParkingCell[]): void {
    spaces.forEach((space) => {
      const helper = this.parkingHelpers.get(`${space.x}:${space.z}`)
      if (!helper) return
      const occupied = Boolean(space.occupiedBy)
      helper.free.visible = !occupied
      helper.occupied.visible = occupied
    })
  }

  private createParkingSpace(space: ParkingCell): Group {
    const group = new Group()
    const occupied = Boolean(space.occupiedBy)
    group.position.set(space.x + 0.5, this.groundY(space.x, space.z) + 0.012, space.z + 0.5)
    const asphalt = new Mesh(parkingAsphaltGeometry, getParkingAsphaltMaterial())
    asphalt.rotation.x = -HALF_PI
    asphalt.receiveShadow = true
    asphalt.userData.retroStatic = true
    asphalt.userData.flatSurface = true
    group.add(asphalt)
    addParkingLetter(group, 0.006, parkingLetterMaterial, true)
    const helpers = new Group()
    helpers.visible = this.showParkingHelpers
    const free = new Mesh(parkingHelperGeometry, parkingFreeMaterial)
    free.rotation.x = -HALF_PI
    free.position.y = 0.004
    free.visible = !occupied
    const busy = new Mesh(parkingHelperGeometry, parkingOccupiedMaterial)
    busy.rotation.x = -HALF_PI
    busy.position.y = 0.004
    busy.visible = occupied
    helpers.add(free, busy)
    addParkingLetter(helpers, 0.018, parkingMarkMaterial)
    group.add(helpers)
    this.parkingHelpers.set(`${space.x}:${space.z}`, { group: helpers, free, occupied: busy })
    return group
  }

  private placeFacility(facility: FacilityLike, kind: LogisticsFacilityKind): Group {
    const size = logisticsFacilityFootprint(kind)
    const group = createLogisticsFacility(kind)
    group.userData.buildingId = facility.id
    group.traverse((object) => {
      object.userData.buildingId = facility.id
    })
    group.position.set(
      facility.x + size / 2,
      this.groundY(facility.x, facility.z),
      facility.z + size / 2,
    )
    // Waste-depot routing and visuals share the same road-facing direction.
    const gateDirection =
      kind === 'wasteDepot'
        ? ('rotation' in facility ? facility.rotation : undefined) ??
          ('gateDirection' in facility ? facility.gateDirection : undefined)
        : undefined
    if (gateDirection !== undefined) group.rotation.y = DIRECTION_ANGLE[gateDirection]
    return group
  }

  /**
   * Eases every vehicle and refills the vehicle batches. A housed vehicle (in its
   * depot or garage) keeps its pose but is not drawn, so it cannot catch clicks either.
   */
  private updateVehicles(vehicles: readonly VehicleLike[]): void {
    if (this.vehiclePoses.size > vehicles.length || vehicles.some((vehicle) => !this.vehiclePoses.has(vehicle.id))) {
      const activeIds = new Set(vehicles.map((vehicle) => vehicle.id))
      for (const id of this.vehiclePoses.keys()) if (!activeIds.has(id)) this.vehiclePoses.delete(id)
    }
    for (const batch of this.vehicleBatches.values()) batch.begin()
    for (const vehicle of vehicles) {
      if (vehicle.housed) continue
      const pose = this.vehiclePose(vehicle)
      const matrix = placementMatrix(this.vehicleMatrix, pose.x, pose.y, pose.z, pose.yaw)
      for (const part of pose.parts) this.vehicleBatch(part.geometry).add(matrix, vehicle.id, part.paint ?? undefined)
    }
    for (const batch of this.vehicleBatches.values()) batch.finish()
  }

  private vehiclePose(vehicle: VehicleLike): VehiclePose {
    const targetX = vehicle.position.x + 0.5
    const targetZ = vehicle.position.z + 0.5
    const parked = vehicle.state === 'parked'
    const road = parked
      ? undefined
      : this.roadAt(
          vehicle.position.x,
          vehicle.position.z,
          vehicle.position.elevation ?? vehicle.cell?.elevation,
        )
    const targetY = road ? this.roadY(road) : this.groundY(vehicle.position.x, vehicle.position.z)
    let pose = this.vehiclePoses.get(vehicle.id)
    if (!pose || pose.kind !== vehicle.kind) {
      pose = {
        kind: vehicle.kind,
        x: targetX,
        y: targetY,
        z: targetZ,
        yaw: this.vehicleFacing(vehicle, 0, 0),
        parts: roadVehicleParts(vehicle.kind, vehicle.id),
      }
      this.vehiclePoses.set(vehicle.id, pose)
      return pose
    }
    const facing = this.vehicleFacing(vehicle, targetX - pose.x, targetZ - pose.z)
    if (parked) {
      pose.x = targetX
      pose.y = targetY
      pose.z = targetZ
      pose.yaw = facing
    } else {
      pose.x += (targetX - pose.x) * this.movementFactor
      pose.y += (targetY - pose.y) * this.movementFactor
      pose.z += (targetZ - pose.z) * this.movementFactor
      pose.yaw += Math.atan2(Math.sin(facing - pose.yaw), Math.cos(facing - pose.yaw)) * this.facingFactor
    }
    return pose
  }

  private refreshPlannerRoute(): void {
    const stamp = [
      this.plannerRouteCells
        .map((cell) => `${cell.x},${cell.z},${cell.elevation ?? ''}`)
        .join('>'),
      this.plannerMarkers
        .map((marker) => `${marker.stopId}:${marker.index}:${marker.x},${marker.z},${marker.lineId ?? ''}`)
        .join('|'),
    ].join('#')
    if (stamp === this.plannerStamp) return
    this.plannerStamp = stamp
    if (this.plannerRoute) {
      this.vehicleGroup.remove(this.plannerRoute)
      this.plannerRoute.geometry.dispose()
      this.plannerRoute = null
    }
    this.clearPlannerNumbers()
    if (this.plannerRouteCells.length >= 2) {
      const points = this.plannerRouteCells.map((cell) => {
        const road = this.roadAt(cell.x, cell.z, cell.elevation)
        return new Vector3(
          cell.x + 0.5,
          (road ? this.roadY(road) : this.groundY(cell.x, cell.z)) + 0.32,
          cell.z + 0.5,
        )
      })
      const line = new Line(
        new BufferGeometry().setFromPoints(points),
        this.plannerMaterial,
      )
      line.userData.plannerRoute = true
      line.renderOrder = 7
      this.plannerRoute = line
      this.vehicleGroup.add(line)
    }
    this.refreshPlannerNumbers()
  }

  private plannerNumberAtlas(): CanvasTexture | null {
    if (this.plannerNumberTexture) return this.plannerNumberTexture
    if (typeof document === 'undefined') return null
    const cols = 8
    const rows = 8
    const cell = 64
    const canvas = document.createElement('canvas')
    canvas.width = cols * cell
    canvas.height = rows * cell
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    for (let number = 1; number <= cols * rows; number += 1) {
      const index = number - 1
      const col = index % cols
      const row = Math.floor(index / cols)
      const cx = col * cell + cell / 2
      const cy = row * cell + cell / 2
      ctx.beginPath()
      ctx.arc(cx, cy, cell * 0.42, 0, Math.PI * 2)
      ctx.fillStyle = '#14241c'
      ctx.fill()
      ctx.lineWidth = 4
      ctx.strokeStyle = '#f4d35e'
      ctx.stroke()
      ctx.fillStyle = '#f4d35e'
      ctx.font = `bold ${number >= 10 ? 26 : 32}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(number), cx, cy + 1)
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.needsUpdate = true
    this.plannerNumberTexture = texture
    return texture
  }

  private plannerNumberMat(): MeshBasicMaterial | null {
    if (this.plannerNumberMaterial) return this.plannerNumberMaterial
    const atlas = this.plannerNumberAtlas()
    if (!atlas) return null
    this.plannerNumberMaterial = new MeshBasicMaterial({
      map: atlas,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    return this.plannerNumberMaterial
  }

  private refreshPlannerNumbers(): void {
    if (this.plannerMarkers.length === 0) return
    const material = this.plannerNumberMat()
    if (!material) return
    const size = 0.92
    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    this.plannerMarkers.forEach((marker, index) => {
      const digit = Math.max(1, Math.min(64, marker.index)) - 1
      const col = digit % 8
      const row = Math.floor(digit / 8)
      const u0 = col / 8
      const u1 = (col + 1) / 8
      const v0 = 1 - (row + 1) / 8
      const v1 = 1 - row / 8
      const cx = marker.x + 0.5
      const cz = marker.z + 0.5
      const road = this.roadAt(marker.x, marker.z, marker.elevation)
      const cy = (road ? this.roadY(road) : this.groundY(marker.x, marker.z)) + 0.58
      const base = index * 4
      positions.push(
        cx - size / 2, cy, cz - size / 2,
        cx + size / 2, cy, cz - size / 2,
        cx + size / 2, cy, cz + size / 2,
        cx - size / 2, cy, cz + size / 2,
      )
      uvs.push(u0, v0, u1, v0, u1, v1, u0, v1)
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    })
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    const mesh = new Mesh(geometry, material)
    mesh.userData.plannerNumbers = true
    mesh.renderOrder = 8
    mesh.frustumCulled = false
    this.plannerNumbers = mesh
    this.vehicleGroup.add(mesh)
  }

  private clearPlannerNumbers(): void {
    if (!this.plannerNumbers) return
    this.vehicleGroup.remove(this.plannerNumbers)
    this.plannerNumbers.geometry.dispose()
    this.plannerNumbers = null
  }

  private updateInspectRoute(vehicles: readonly VehicleLike[]): void {
    const vehicle = this.inspectedVehicleId
      ? vehicles.find((candidate) => candidate.id === this.inspectedVehicleId)
      : undefined
    if (!vehicle) {
      this.clearInspectRoute()
      return
    }
    const cells: RoadPosition[] = [
      vehicle.position,
      ...vehicle.route,
    ]
    if (
      vehicle.parkingCell &&
      vehicle.state !== 'parked' &&
      (cells.at(-1)?.x !== vehicle.parkingCell.x ||
        cells.at(-1)?.z !== vehicle.parkingCell.z)
    ) {
      cells.push(vehicle.parkingCell)
    }
    const stamp = `${vehicle.id}:${vehicle.state}:${cells
      .map((cell) => `${cell.x},${cell.z},${cell.elevation ?? ''}`)
      .join('>')}`
    if (stamp === this.inspectStamp) return
    this.inspectStamp = stamp
    this.clearInspectRoute()
    if (cells.length < 2) return
    const points = cells.map((cell) => {
      const road = this.roadAt(cell.x, cell.z, cell.elevation)
      return new Vector3(
          cell.x + 0.5,
          (road ? this.roadY(road) : this.groundY(cell.x, cell.z)) + 0.28,
          cell.z + 0.5,
        )
    })
    const line = new Line(
      new BufferGeometry().setFromPoints(points),
      new LineBasicMaterial({
        color: 0xf4d35e,
        depthTest: false,
      }),
    )
    line.userData.inspectRoute = true
    this.inspectRoute = line
    this.vehicleGroup.add(line)
  }

  private clearInspectRoute(): void {
    if (!this.inspectRoute) {
      this.inspectStamp = ''
      return
    }
    this.vehicleGroup.remove(this.inspectRoute)
    this.inspectRoute.geometry.dispose()
    const material = this.inspectRoute.material
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose())
    else material.dispose()
    this.inspectRoute = null
    this.inspectStamp = ''
  }

  private vehicleFacing(
    vehicle: VehicleLike,
    deltaX: number,
    deltaZ: number,
  ): number {
    if (typeof vehicle.facing === 'number') return vehicle.facing
    if (Math.abs(deltaX) + Math.abs(deltaZ) > 0.001) {
      return Math.atan2(deltaX, deltaZ)
    }
    const next = vehicle.route[0]
    return next
      ? Math.atan2(
          next.x - vehicle.position.x,
          next.z - vehicle.position.z,
        )
      : 0
  }
}
