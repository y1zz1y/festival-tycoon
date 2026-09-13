import { transportMotionFactor } from './transportMotion'
import { wayTexture } from './wayTextures'
import type { WayType } from '../game/wayTypes'
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
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
import type { Object3D } from 'three'
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
  RoadVehicle,
} from '../game/logistics'
import { disposeObject3D } from './disposeObject3D'
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

const boxGeometries = new Map<string, BoxGeometry>()
const cylinderGeometries = new Map<string, CylinderGeometry>()
const materials = new Map<string, MeshStandardMaterial>()

function sharedBoxGeometry(
  size: readonly [number, number, number],
): BoxGeometry {
  const key = size.join('x')
  const existing = boxGeometries.get(key)
  if (existing) return existing
  const geometry = new BoxGeometry(...size)
  boxGeometries.set(key, geometry)
  return geometry
}

function sharedCylinderGeometry(radius: number, height: number): CylinderGeometry {
  const key = `${radius}:${height}`
  const existing = cylinderGeometries.get(key)
  if (existing) return existing
  const geometry = new CylinderGeometry(radius, radius, height, 8)
  cylinderGeometries.set(key, geometry)
  return geometry
}

function sharedMaterial(color: number, roughness = 0.8): MeshStandardMaterial {
  const key = `${color}:${roughness}`
  const existing = materials.get(key)
  if (existing) return existing
  const material = new MeshStandardMaterial({ color, roughness })
  materials.set(key, material)
  return material
}

const FLOW_ARROWS = 5
const FLOW_UP = new Vector3(0, 1, 0)
const flowArrowGeometry = createRoadDirectionArrowGeometry()
const roadArrowGeometry = createRoadDirectionArrowGeometry()
const flowMaterial = new MeshBasicMaterial({
  color: 0xffe27a,
  transparent: true,
  opacity: 0.92,
  depthWrite: false,
  depthTest: false,
  side: DoubleSide,
})
const roadArrowMaterial = new MeshStandardMaterial({
  color: 0xf4f0de,
  roughness: 0.82,
  metalness: 0,
  side: DoubleSide,
})

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

function addSharedBox(
  parent: Group,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  color: number,
  roughness = 0.8,
): Mesh {
  const mesh = new Mesh(
    sharedBoxGeometry(size),
    sharedMaterial(color, roughness),
  )
  mesh.position.set(...position)
  parent.add(mesh)
  return mesh
}

function addSharedCylinder(
  parent: Group,
  radius: number,
  height: number,
  position: readonly [number, number, number],
  color: number,
  roughness = 0.8,
  rotation?: readonly [number, number, number],
): Mesh {
  const mesh = new Mesh(
    sharedCylinderGeometry(radius, height),
    sharedMaterial(color, roughness),
  )
  mesh.position.set(...position)
  if (rotation) mesh.rotation.set(...rotation)
  parent.add(mesh)
  return mesh
}

function markShadows(root: Object3D): void {
  root.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })
}

export class LogisticsView {
  readonly group = new Group()
  private readonly staticGroup = new Group()
  private readonly vehicleGroup = new Group()
  private readonly vehicleModels = new Map<string, Group>()
  private readonly parkingTiles = new Map<string, Mesh>()
  private roadSurface: (x: number, z: number) => WayType | undefined = () => undefined
  private roadColor: (x: number, z: number) => number = () => 0x50555a
  private lastAnimationTime: number | null = null
  private movementFactor = 0
  private staticFingerprint = ''
  private inspectedVehicleId: string | null = null
  private inspectStamp = ''
  private inspectRoute: Line | null = null
  private getGroundY: (x: number, z: number) => number = () => 0
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
    this.group.add(this.staticGroup, this.vehicleGroup, this.flowGroup)
  }

  invalidate(): void {
    this.staticFingerprint = ''
  }

  setInspectedVehicle(id: string | null): void {
    this.inspectedVehicleId = id
    this.inspectStamp = ''
  }

  getVehiclePickRoot(): Group {
    return this.vehicleGroup
  }

  update(
    logistics: Readonly<LogisticsSnapshot>,
    getGroundY: (x: number, z: number) => number = () => 0,
    roadColor: (x: number, z: number) => number = () => 0x50555a,
    roadSurface: (x: number, z: number) => WayType | undefined = () => undefined,
    paused = false,
    time = performance.now(),
    showDirectionFlow = false,
  ): void {
    const seconds=this.lastAnimationTime===null?0:Math.min(.25,Math.max(0,(time-this.lastAnimationTime)/1000))
    this.lastAnimationTime=time
    this.movementFactor=paused?0:transportMotionFactor(seconds)
    this.facingFactor=paused?0:1-Math.exp(-seconds/0.32)
    this.getGroundY = getGroundY
    this.roadColor = roadColor
    this.roadSurface = roadSurface
    const heightPart = [
      ...logistics.roadCells.map((cell) => getGroundY(cell.x, cell.z)),
      ...logistics.parkingCells.map((cell) => getGroundY(cell.x, cell.z)),
      ...logistics.ambulanceGarages.map((cell) => getGroundY(cell.x, cell.z)),
      ...logistics.busDepots.map((cell) => getGroundY(cell.x, cell.z)),
      ...logistics.wasteDepots.map((cell) => getGroundY(cell.x, cell.z)),
      ...(logistics.specialDepots ?? []).map((cell) => getGroundY(cell.x, cell.z)),
      ...logistics.busStops.map((cell) => getGroundY(cell.x, cell.z)),
    ].join(',')
    const fingerprint = `${structureFingerprint(logistics)}#${heightPart}#${logistics.roadCells.map(c => roadColor(c.x, c.z)).join()}`
    if (fingerprint !== this.staticFingerprint) {
      this.staticFingerprint = fingerprint
      this.rebuildStatic(logistics)
    }
    this.updateParkingOccupancy(logistics.parkingCells)
    this.updateVehicles(logistics.roadVehicles)
    this.updateInspectRoute(logistics.roadVehicles)
    this.flowGroup.visible = showDirectionFlow
    if (showDirectionFlow) {
      this.flowPhase += seconds * 0.42
      this.updateDirectionFlow()
    }
  }

  private groundY(x: number, z: number): number {
    return this.getGroundY(x, z)
  }

  private rebuildStatic(logistics: Readonly<LogisticsSnapshot>): void {
    this.parkingTiles.clear()
    this.staticGroup.children.slice().forEach((child) => {
      this.staticGroup.remove(child)
      disposeObject3D(child)
    })
    const roadKeys = new Set(
      logistics.roadCells.map((road) => `${road.x}:${road.z}`),
    )
    logistics.roadCells.forEach((road) => {
      this.staticGroup.add(this.createRoad(road, roadKeys))
    })
    logistics.parkingCells.forEach((space) => {
      this.staticGroup.add(this.createParkingSpace(space))
    })
    logistics.ambulanceGarages.forEach((garage) => {
      this.staticGroup.add(this.createFacility(garage, 'garage'))
    })
    logistics.busDepots.forEach((depot) => {
      this.staticGroup.add(this.createFacility(depot, 'depot'))
    })
    logistics.wasteDepots.forEach((depot) => {
      this.staticGroup.add(this.createFacility(depot, 'waste'))
    })
    ;(logistics.specialDepots ?? []).forEach((depot) => {
      this.staticGroup.add(this.createFacility(depot, 'special'))
    })
    logistics.busStops.forEach((stop) => {
      this.staticGroup.add(this.createBusStop(stop))
    })
    this.rebuildDirectionFlow(logistics)
  }

  private createRoad(road: RoadCell, roadKeys: ReadonlySet<string>): Group {
    const group = new Group()
    group.position.set(road.x + 0.5, this.groundY(road.x, road.z) + 0.012, road.z + 0.5)
    const asphalt = new Mesh(
      new PlaneGeometry(0.94, 0.94),
      new MeshStandardMaterial({ color: this.roadColor(road.x, road.z), map: wayTexture(this.roadSurface(road.x, road.z)), roughness: 1 }),
    )
    asphalt.rotation.x = -HALF_PI
    asphalt.receiveShadow = true
    group.add(asphalt)

    const offsets: Readonly<Record<Direction, readonly [number, number]>> = {
      0: [0, 1],
      1: [1, 0],
      2: [0, -1],
      3: [-1, 0],
    }
    const connections = ([0, 1, 2, 3] as const).filter((direction) => {
      const [offsetX, offsetZ] = offsets[direction]
      return roadKeys.has(`${road.x + offsetX}:${road.z + offsetZ}`)
    })
    connections.forEach((direction) => {
      const connector = new Mesh(
        new PlaneGeometry(0.36, 0.13),
        new MeshStandardMaterial({ color: 0x72777b, roughness: 1 }),
      )
      connector.rotation.x = -HALF_PI
      connector.rotation.z = -DIRECTION_ANGLE[direction]
      connector.position.y = 0.004
      connector.position.z = 0.405
      connector.position.applyAxisAngle(
        { x: 0, y: 1, z: 0 },
        DIRECTION_ANGLE[direction],
      )
      group.add(connector)
    })

    const speed = road.speedLimit
    const zoneColor = speed <= 10 ? 0x35bb66 : speed <= 30 ? 0xf2cf45 : 0xe64b45
    const zone = new Mesh(
      new PlaneGeometry(0.78, 0.78),
      new MeshStandardMaterial({
        color: zoneColor,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    )
    zone.rotation.x = -HALF_PI
    zone.position.y = 0.008
    group.add(zone)

    if (road.crosswalk) {
      for (let index = -3; index <= 3; index += 1) {
        addBox(group, [0.08, 0.012, 0.68], [index * 0.115, 0.026, 0], 0xf7f7ef)
      }
    }

    (road.allowedDirections === null
      ? []
      : directionsFromMask(road.allowedDirections)
    ).forEach((direction) => {
      const arrow = new Mesh(roadArrowGeometry, roadArrowMaterial)
      arrow.rotation.y = DIRECTION_ANGLE[direction]
      arrow.position.y = 0.018
      arrow.scale.setScalar(0.72)
      group.add(arrow)
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
      const y = this.groundY(road.x, road.z)
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
        const along = (travel - 0.5) * 0.82
        const edge = Math.min(travel, 1 - travel)
        const appear = Math.min(1, edge / 0.14)
        const size = 0.78 * appear
        this.flowPosition.set(
          mark.x + 0.5 + offsetX * along,
          mark.y + 0.08,
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
      const tile = this.parkingTiles.get(`${space.x}:${space.z}`)
      if (!tile) return
      const material = tile.material as MeshStandardMaterial
      material.color.set(space.occupiedBy ? 0xd4884d : 0x4c9b63)
    })
  }

  private createParkingSpace(space: ParkingCell): Group {
    const group = new Group()
    const occupied = Boolean(space.occupiedBy)
    group.position.set(space.x + 0.5, this.groundY(space.x, space.z) + 0.016, space.z + 0.5)
    const tile = new Mesh(
      new PlaneGeometry(0.86, 0.86),
      new MeshStandardMaterial({
        color: occupied ? 0xd4884d : 0x4c9b63,
        roughness: 0.95,
      }),
    )
    tile.rotation.x = -HALF_PI
    this.parkingTiles.set(`${space.x}:${space.z}`, tile)
    group.add(tile)
    addBox(group, [0.07, 0.018, 0.5], [-0.17, 0.018, 0], 0xf4f4ec)
    addBox(group, [0.3, 0.018, 0.07], [-0.02, 0.018, -0.215], 0xf4f4ec)
    addBox(group, [0.3, 0.018, 0.07], [-0.02, 0.018, 0], 0xf4f4ec)
    addBox(group, [0.07, 0.018, 0.22], [0.13, 0.018, -0.11], 0xf4f4ec)
    return group
  }

  private createFacility(
    facility: FacilityLike,
    kind: 'garage' | 'depot' | 'waste' | 'special',
  ): Group {
    const group = new Group()
    const size = kind === 'depot' || kind === 'special' ? 3 : 2
    const color =
      kind === 'garage'
        ? 0x52718c
        : kind === 'waste'
          ? 0x4a5a3a
          : kind === 'special'
            ? 0x5a6a72
            : 0x9b7445
    group.position.set(
      facility.x + size / 2,
      this.groundY(facility.x, facility.z),
      facility.z + size / 2,
    )
    addBox(group, [size - 0.12, 0.13, size - 0.12], [0, 0.065, 0], 0x3c4247)
    if (kind === 'special') {
      addBox(group, [size - 0.18, 0.08, size - 0.18], [0, 0.08, 0], 0x4d555b)
      addBox(group, [0.9, 0.62, 0.72], [0, 0.42, -size / 2 + 0.46], color)
      addBox(group, [1.02, 0.1, 0.84], [0, 0.78, -size / 2 + 0.46], 0x2c3236)
      ;[-0.9, -0.3, 0.3, 0.9].forEach((offset) => {
        addBox(group, [0.42, 0.03, 0.72], [offset, 0.09, 0.28], 0xd7b45b)
        addBox(group, [0.04, 0.05, 0.72], [offset - 0.2, 0.1, 0.28], 0xf0d27a)
        addBox(group, [0.04, 0.05, 0.72], [offset + 0.2, 0.1, 0.28], 0xf0d27a)
      })
      markShadows(group)
      return group
    }
    addBox(group, [size - 0.3, 0.78, size - 0.4], [0, 0.52, 0.1], color)
    addBox(group, [size - 0.55, 0.58, 0.04], [0, 0.4, size / 2 - 0.185], 0x30373c)
    const roof = addBox(group, [size, 0.14, size], [0, 0.98, 0], 0x252a2e)
    roof.castShadow = true
    if (kind === 'depot') {
      ;[-0.65, 0, 0.65].forEach((offset) => {
        addBox(group, [0.08, 0.58, 0.06], [offset, 0.4, size / 2 - 0.145], 0xd7b45b)
      })
    }
    if (kind === 'waste') {
      ;[-0.28, 0.28].forEach((offset) => {
        addBox(group, [0.22, 0.28, 0.22], [offset, 0.28, size / 2 - 0.22], 0x3d4a2e)
      })
    }
    markShadows(group)
    return group
  }

  private createBusStop(stop: FacilityLike): Group {
    const group = new Group()
    group.position.set(stop.x + 0.5, this.groundY(stop.x, stop.z), stop.z + 0.5)
    addBox(group, [0.72, 0.045, 0.3], [0, 0.025, 0], 0x92989b)
    addBox(group, [0.58, 0.04, 0.18], [-0.08, 0.25, 0], 0x356d91)
    ;[-0.3, 0.14].forEach((offset) => {
      addBox(group, [0.035, 0.48, 0.035], [offset, 0.25, 0], 0x41484c)
    })
    addBox(group, [0.035, 0.74, 0.035], [0.34, 0.37, 0], 0x41484c)
    addBox(group, [0.22, 0.22, 0.035], [0.34, 0.66, 0], 0x2f75ad)
    addBox(group, [0.13, 0.045, 0.045], [0.34, 0.66, 0.025], 0xf3f5ef)
    markShadows(group)
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
      const targetY = this.groundY(vehicle.position.x, vehicle.position.z)
      const targetZ = vehicle.position.z + 0.5
      let model = this.vehicleModels.get(vehicle.id)
      if (model && model.userData.vehicleKind !== kind) {
        this.vehicleGroup.remove(model)
        this.vehicleModels.delete(vehicle.id)
        model = undefined
      }
      if (!model) {
        model = this.createVehicle(kind)
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

  private updateInspectRoute(vehicles: readonly VehicleLike[]): void {
    const vehicle = this.inspectedVehicleId
      ? vehicles.find((candidate) => candidate.id === this.inspectedVehicleId)
      : undefined
    if (!vehicle) {
      this.clearInspectRoute()
      return
    }
    const cells: Array<{ x: number; z: number }> = [
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
      .map((cell) => `${cell.x},${cell.z}`)
      .join('>')}`
    if (stamp === this.inspectStamp) return
    this.inspectStamp = stamp
    this.clearInspectRoute()
    if (cells.length < 2) return
    const points = cells.map(
      (cell) =>
        new Vector3(
          cell.x + 0.5,
          this.groundY(cell.x, cell.z) + 0.28,
          cell.z + 0.5,
        ),
    )
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

  private createVehicle(kind: string): Group {
    if (kind === 'ambulance') return this.createCar(0xf4f4ee, true)
    if (kind === 'bus') return this.createBus()
    if (kind === 'garbageTruck') return this.createGarbageTruck()
    if (kind === 'deliveryTruck') return this.createDeliveryTruck()
    if (kind === 'sweeper') return this.createSweeper()
    return this.createCar(0x3479ad, false)
  }

  private createSweeper(): Group {
    const group = new Group()
    addSharedBox(group, [0.4, 0.08, 0.46], [0, 0.12, -0.02], 0x1a1c1e, 0.85)
    addSharedBox(group, [0.36, 0.26, 0.34], [0, 0.29, -0.04], 0xf2f4f0, 0.45)
    addSharedBox(group, [0.38, 0.035, 0.36], [0, 0.438, -0.04], 0x3cb54a, 0.5)
    addSharedBox(group, [0.02, 0.16, 0.3], [-0.19, 0.3, -0.04], 0x3cb54a, 0.5)
    addSharedBox(group, [0.02, 0.16, 0.3], [0.19, 0.3, -0.04], 0x3cb54a, 0.5)
    addSharedBox(group, [0.3, 0.16, 0.018], [0, 0.33, 0.14], 0x6a8ea0, 0.25)
    addSharedBox(group, [0.22, 0.1, 0.018], [0, 0.32, -0.21], 0x6a8ea0, 0.3)
    addSharedBox(group, [0.38, 0.06, 0.06], [0, 0.13, 0.2], 0x141618, 0.8)
    addSharedBox(group, [0.04, 0.04, 0.04], [0.08, 0.48, 0.04], 0xf0b020, 0.35)
    addSharedBox(group, [0.03, 0.04, 0.02], [-0.23, 0.36, 0.08], 0x202326, 0.7)
    addSharedBox(group, [0.03, 0.04, 0.02], [0.23, 0.36, 0.08], 0x202326, 0.7)
    addSharedCylinder(group, 0.018, 0.14, [-0.1, 0.52, -0.12], 0x2a2c2e, 0.7)
    addSharedCylinder(
      group,
      0.018,
      0.1,
      [-0.1, 0.57, -0.18],
      0x2a2c2e,
      0.7,
      [HALF_PI, 0, 0],
    )
    ;[
      [-0.16, 0.28],
      [0.16, 0.28],
      [0, 0.38],
    ].forEach(([x, z]) => {
      addSharedCylinder(group, 0.1, 0.03, [x, 0.05, z], 0x1c2430, 1)
      addSharedCylinder(group, 0.028, 0.05, [x, 0.08, z], 0x2a3038, 0.75)
    })
    ;[-0.16, 0.16].forEach((x) => {
      ;[-0.16, 0.08].forEach((z) => {
        addSharedCylinder(
          group,
          0.07,
          0.045,
          [x, 0.09, z],
          0x202326,
          1,
          [0, 0, HALF_PI],
        )
      })
    })
    return group
  }

  private createDeliveryTruck(): Group {
    const group = new Group()
    addSharedBox(group, [0.46, 0.36, 0.52], [0, 0.32, 0.08], 0xe1bb62, 0.55)
    addSharedBox(group, [0.4, 0.28, 0.26], [0, 0.3, -0.32], 0x518fa0, 0.45)
    addSharedBox(group, [0.3, 0.12, 0.02], [0, 0.34, -0.44], 0x86b4c7, 0.3)
    ;[-0.2, 0.2].forEach((x) => {
      ;[-0.3, 0.22].forEach((z) => {
        const wheel = new Mesh(
          sharedCylinderGeometry(0.09, 0.055),
          sharedMaterial(0x202326, 1),
        )
        wheel.rotation.z = HALF_PI
        wheel.position.set(x, 0.12, z)
        group.add(wheel)
      })
    })
    return group
  }

  private createGarbageTruck(): Group {
    const group = new Group()
    addSharedBox(group, [0.42, 0.2, 0.36], [0, 0.22, 0.28], 0x3f6b3a, 0.55)
    addSharedBox(group, [0.34, 0.16, 0.18], [0, 0.38, 0.3], 0x3f6b3a, 0.5)
    addSharedBox(group, [0.28, 0.1, 0.02], [0, 0.4, 0.4], 0x86b4c7, 0.3)
    addSharedBox(group, [0.46, 0.34, 0.58], [0, 0.3, -0.18], 0x4a4f45, 0.7)
    addSharedBox(group, [0.4, 0.08, 0.5], [0, 0.5, -0.18], 0x2f332c, 0.8)
    ;[-0.22, 0.22].forEach((x) => {
      ;[-0.32, 0.08, 0.32].forEach((z) => {
        const wheel = new Mesh(
          sharedCylinderGeometry(0.09, 0.055),
          sharedMaterial(0x202326, 1),
        )
        wheel.rotation.z = HALF_PI
        wheel.position.set(x, 0.12, z)
        group.add(wheel)
      })
    })
    return group
  }

  private createCar(color: number, ambulance: boolean): Group {
    const group = new Group()
    addSharedBox(group, [0.48, 0.18, 0.78], [0, 0.19, 0], color, 0.55)
    addSharedBox(group, [0.4, 0.19, 0.4], [0, 0.36, -0.03], ambulance ? 0xf4f4ee : color, 0.5)
    addSharedBox(group, [0.34, 0.13, 0.025], [0, 0.37, 0.18], 0x86b4c7, 0.3)
    ;[-0.25, 0.25].forEach((x) => {
      ;[-0.24, 0.24].forEach((z) => {
        const wheel = new Mesh(
          sharedCylinderGeometry(0.09, 0.055),
          sharedMaterial(0x202326, 1),
        )
        wheel.rotation.z = HALF_PI
        wheel.position.set(x, 0.12, z)
        group.add(wheel)
      })
    })
    if (ambulance) {
      addSharedBox(group, [0.13, 0.03, 0.5], [0, 0.3, 0], 0xd73832)
      addSharedBox(group, [0.4, 0.03, 0.13], [0, 0.3, 0], 0xd73832)
      addSharedBox(group, [0.2, 0.07, 0.09], [0, 0.5, -0.04], 0x2878d1)
    }
    return group
  }

  private createBus(): Group {
    const group = new Group()
    addSharedBox(group, [0.62, 0.46, 1.38], [0, 0.34, 0], 0xe0a832, 0.65)
    addSharedBox(group, [0.5, 0.19, 0.025], [0, 0.43, 0.7], 0x729fb2, 0.3)
    ;[-0.45, -0.1, 0.25, 0.52].forEach((z) => {
      ;[-0.316, 0.316].forEach((x) => {
        addSharedBox(group, [0.025, 0.18, 0.22], [x, 0.45, z], 0x729fb2, 0.3)
      })
    })
    ;[-0.45, 0.45].forEach((z) => {
      ;[-0.32, 0.32].forEach((x) => {
        const wheel = new Mesh(
          sharedCylinderGeometry(0.11, 0.07),
          sharedMaterial(0x202326),
        )
        wheel.rotation.z = HALF_PI
        wheel.position.set(x, 0.14, z)
        group.add(wheel)
      })
    })
    return group
  }
}
