import { createWayStructure, indexWayStructures, wayStructurePlan, type WayStructureCell } from './wayStructures'
import { batchRetroBuildings } from './retroBuildings'
import { transportMotionFactor } from './transportMotion'
import { parkingTexture, wayTexture } from './wayTextures'
import type { WayType } from '../game/wayTypes'
import {
  BoxGeometry,
  BufferGeometry,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  DoubleSide,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three'
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
  createRoadVehicleModel,
  logisticsFacilityFootprint,
  type LogisticsFacilityKind,
} from './logisticsModels'
import { createRoadDirectionArrowGeometry } from './roadDirectionArrow'

type FacilityLike = AmbulanceGarage | BusDepot | BusStop | WasteDepot | SpecialDepot
type VehicleLike = RoadVehicle & {
  facing?: number
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

const FLOW_ARROWS = 4
const FLOW_UP = new Vector3(0, 1, 0)
const flowArrowGeometry = createRoadDirectionArrowGeometry('overlay')
const roadArrowGeometry = createRoadDirectionArrowGeometry('paint')
roadArrowGeometry.userData.shared = true
const flowMaterial = new MeshBasicMaterial({
  color: 0xffd56a,
  transparent: true,
  opacity: 0.82,
  depthWrite: false,
  depthTest: false,
  side: DoubleSide,
})
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

type DirectionFlowMark = {
  x: number
  z: number
  y: number
  direction: Direction
}

function addBox(
  parent: Group,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  color: number,
  roughness = 0.8,
): Mesh {
  const mesh = new Mesh(
    new BoxGeometry(...size),
    new MeshStandardMaterial({ color, roughness }),
  )
  mesh.position.set(...position)
  parent.add(mesh)
  return mesh
}

function addSharedMark(
  parent: Group,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
): Mesh {
  const mesh = new Mesh(new BoxGeometry(...size), parkingMarkMaterial)
  mesh.position.set(...position)
  parent.add(mesh)
  return mesh
}

export class LogisticsView {
  private structurePaths: WayStructureCell[] = []
  setStructurePaths(paths: WayStructureCell[]): void { this.structurePaths = paths }
  private structureRoads = new Map<RoadCell, WayStructureCell>()
  private structureIndex = indexWayStructures([])
  readonly group = new Group()
  private readonly staticGroup = new Group()
  private readonly vehicleGroup = new Group()
  private readonly vehicleModels = new Map<string, Group>()
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
  private plannerStamp = ''
  private plannerRoute: Line | null = null
  private readonly plannerMaterial = new LineBasicMaterial({
    color: 0xf4d35e,
    depthTest: false,
  })
  private getGroundY: (x: number, z: number) => number = () => 0
  private roadsByKey = new Map<string, RoadCell[]>()
  private readonly marksGroup = new Group()
  private readonly flowGroup = new Group()
  private flowMarks: DirectionFlowMark[] = []
  private flowArrows: InstancedMesh | null = null
  private flowPhase = 0
  private facingFactor = 0
  private readonly flowMatrix = new Matrix4()
  private readonly flowPosition = new Vector3()
  private readonly flowScale = new Vector3()
  private readonly flowQuaternion = new Quaternion()

  constructor() {
    this.flowGroup.renderOrder = 6
    this.group.add(this.staticGroup, this.vehicleGroup, this.marksGroup, this.flowGroup)
  }

  invalidate(): void {
    this.staticFingerprint = ''
  }

  setInspectedVehicle(id: string | null): void {
    this.inspectedVehicleId = id
    this.inspectStamp = ''
  }

  setPlannerRoute(cells: readonly RoadPosition[] | null): void {
    this.plannerRouteCells = cells ? cells.map((cell) => ({ ...cell })) : []
    this.plannerStamp = ''
    this.refreshPlannerRoute()
  }

  getVehiclePickRoot(): Group {
    return this.vehicleGroup
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
    showDirectionFlow = false,
    showParkingHelpers = false,
  ): void {
    const seconds=this.lastAnimationTime===null?0:Math.min(.25,Math.max(0,(time-this.lastAnimationTime)/1000))
    this.lastAnimationTime=time
    this.movementFactor=paused?0:transportMotionFactor(seconds)
    this.facingFactor=paused?0:1-Math.exp(-seconds/0.32)
    this.getGroundY = getGroundY
    this.roadColor = roadColor
    this.roadSurface = roadSurface
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
    this.flowGroup.visible = showDirectionFlow
    if (showDirectionFlow) {
      this.flowPhase += seconds * 0.42
      this.updateDirectionFlow()
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
    this.rebuildDirectionFlow(logistics)
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
    const asphalt = new Mesh(
      new PlaneGeometry(1, Math.hypot(1, slope)),
      new MeshStandardMaterial({ color: this.roadColor(road.x, road.z), map: wayTexture(this.roadSurface(road.x, road.z) ?? 'roadAsphalt'), roughness: 1 }),
    )
    asphalt.rotation.x = -HALF_PI
    asphalt.receiveShadow = true
    deck.add(asphalt)
    const cell = this.structureRoads.get(road)!
    const structure = createWayStructure(cell, wayStructurePlan(cell, this.structureIndex, this.groundY(road.x, road.z)))
    if (structure) group.add(structure)

    const speed = road.speedLimit
    const zoneColor = speed <= 10 ? 0x35bb66 : speed <= 30 ? 0xf2cf45 : 0xe64b45
    const zone = new Mesh(
      new PlaneGeometry(0.78, slope === 0 ? 0.78 : Math.hypot(0.78, slope)),
      new MeshStandardMaterial({
        color: zoneColor,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
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

  private rebuildDirectionFlow(logistics: Readonly<LogisticsSnapshot>): void {
    this.flowMarks = logistics.roadCells.flatMap((road) => {
      if (road.allowedDirections === null) return []
      const y = this.roadY(road)
      return directionsFromMask(road.allowedDirections).map((direction) => ({
        x: road.x,
        z: road.z,
        y,
        direction,
      }))
    })
    const count = Math.max(1, this.flowMarks.length * FLOW_ARROWS)
    if (this.flowArrows && this.flowArrows.instanceMatrix.count === count) {
      this.updateDirectionFlow()
      return
    }
    this.clearDirectionFlow()
    this.flowArrows = new InstancedMesh(flowArrowGeometry, flowMaterial, count)
    this.flowArrows.frustumCulled = false
    this.flowArrows.renderOrder = 7
    this.flowGroup.add(this.flowArrows)
    this.updateDirectionFlow()
  }

  private clearDirectionFlow(): void {
    this.flowArrows?.removeFromParent()
    this.flowArrows?.dispose()
    this.flowArrows = null
  }

  private updateDirectionFlow(): void {
    if (!this.flowArrows) return
    const offsets: Readonly<Record<Direction, readonly [number, number]>> = {
      0: [0, 1],
      1: [1, 0],
      2: [0, -1],
      3: [-1, 0],
    }
    let index = 0
    this.flowMarks.forEach((mark) => {
      const [offsetX, offsetZ] = offsets[mark.direction]
      this.flowQuaternion.setFromAxisAngle(FLOW_UP, DIRECTION_ANGLE[mark.direction])
      for (let step = 0; step < FLOW_ARROWS; step += 1) {
        const travel = (this.flowPhase + step / FLOW_ARROWS) % 1
        const along = (travel - 0.5) * 0.7
        const edge = Math.min(travel, 1 - travel)
        const appear = 0.72 + 0.28 * Math.min(1, edge / 0.18)
        const size = 0.52 * appear
        this.flowPosition.set(
          mark.x + 0.5 + offsetX * along,
          mark.y + 0.045,
          mark.z + 0.5 + offsetZ * along,
        )
        this.flowScale.set(size, size, size)
        this.flowMatrix.compose(
          this.flowPosition,
          this.flowQuaternion,
          this.flowScale,
        )
        this.flowArrows!.setMatrixAt(index, this.flowMatrix)
        index += 1
      }
    })
    const hidden = this.flowMatrix.makeScale(0, 0, 0)
    while (index < this.flowArrows.count) {
      this.flowArrows.setMatrixAt(index, hidden)
      index += 1
    }
    this.flowArrows.instanceMatrix.needsUpdate = true
    this.flowArrows.count = this.flowMarks.length * FLOW_ARROWS
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
    group.add(asphalt)
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
    addSharedMark(helpers, [0.07, 0.018, 0.5], [-0.17, 0.018, 0])
    addSharedMark(helpers, [0.3, 0.018, 0.07], [-0.02, 0.018, -0.215])
    addSharedMark(helpers, [0.3, 0.018, 0.07], [-0.02, 0.018, 0])
    addSharedMark(helpers, [0.07, 0.018, 0.22], [0.13, 0.018, -0.11])
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
    return group
  }

  private updateVehicles(vehicles: readonly VehicleLike[]): void {
    const activeIds = new Set(vehicles.map((vehicle) => vehicle.id))
    this.vehicleModels.forEach((model, id) => {
      if (activeIds.has(id)) return
      this.vehicleGroup.remove(model)
      this.vehicleModels.delete(id)
    })
    vehicles.forEach((vehicle) => {
      const kind = vehicle.kind
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
      let model = this.vehicleModels.get(vehicle.id)
      if (model && model.userData.vehicleKind !== kind) {
        this.vehicleGroup.remove(model)
        this.vehicleModels.delete(vehicle.id)
        model = undefined
      }
      if (!model) {
        model = createRoadVehicleModel(kind, vehicle.id)
        model.userData.vehicleKind = kind
        model.userData.vehicleId = vehicle.id
        model.traverse((object) => {
          object.userData.vehicleId = vehicle.id
        })
        model.position.set(targetX, targetY, targetZ)
        model.rotation.y = this.vehicleFacing(vehicle, 0, 0)
        this.vehicleModels.set(vehicle.id, model)
        this.vehicleGroup.add(model)
      } else {
        model.userData.vehicleId = vehicle.id
        const facing = this.vehicleFacing(
          vehicle,
          targetX - model.position.x,
          targetZ - model.position.z,
        )
        if (vehicle.state === 'parked') {
          model.position.set(targetX, targetY, targetZ)
          model.rotation.y = facing
        } else {
          model.position.x += (targetX - model.position.x) * this.movementFactor
          model.position.y += (targetY - model.position.y) * this.movementFactor
          model.position.z += (targetZ - model.position.z) * this.movementFactor
          model.rotation.y += Math.atan2(
            Math.sin(facing - model.rotation.y),
            Math.cos(facing - model.rotation.y),
          ) * this.facingFactor
        }
      }
    })
  }

  private refreshPlannerRoute(): void {
    const stamp = this.plannerRouteCells
      .map((cell) => `${cell.x},${cell.z},${cell.elevation ?? ''}`)
      .join('>')
    if (stamp === this.plannerStamp) return
    this.plannerStamp = stamp
    if (this.plannerRoute) {
      this.vehicleGroup.remove(this.plannerRoute)
      this.plannerRoute.geometry.dispose()
      this.plannerRoute = null
    }
    if (this.plannerRouteCells.length < 2) return
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
