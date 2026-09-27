import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Box3, InstancedMesh, Line, Matrix4, Mesh, Object3D, Raycaster, Vector3, type BufferGeometry } from 'three'
import { GameState } from '../src/game/GameState'
import { gateEdgeWorldPosition, type AccessControlSnapshot, type PathBarrier, type TrafficLight } from '../src/game/accessControl'
import type { RoadVehicle } from '../src/game/logistics'
import { createStaffMember, STAFF_ROLES, type StaffMember } from '../src/game/staff'
import { getTerrainHeight } from '../src/game/terrain'
import { AccessControlView } from '../src/view/AccessControlView'
import { ArrivalGateView } from '../src/view/ArrivalGateView'
import { createPorterModel } from '../src/view/carrierModels'
import { CrewInstances } from '../src/view/crewInstances'
import { ForecourtView } from '../src/view/ForecourtView'
import { createRoadVehicleModel } from '../src/view/logisticsModels'
import { LogisticsView } from '../src/view/LogisticsView'
import { accessIdFromObject, instanceOwnerId } from '../src/view/picking'
import { createPersonGeometry } from '../src/view/pixelPeople'
import { StaffView } from '../src/view/StaffView'
import { SupplyChainView } from '../src/view/SupplyChainView'

type Fixture = (count?: number) => GameState

function instancedIn(root: Object3D): InstancedMesh[] {
  const found: InstancedMesh[] = []
  root.traverse((object) => { if (object instanceof InstancedMesh) found.push(object) })
  return found
}

function plainMeshesIn(root: Object3D): Mesh[] {
  const found: Mesh[] = []
  root.traverse((object) => { if (object instanceof Mesh && !(object instanceof InstancedMesh)) found.push(object) })
  return found
}

/** Objects that issue a draw call: shown meshes, and instanced meshes with instances. */
function drawCount(root: Object3D): number {
  let draws = 0
  const walk = (object: Object3D, shown: boolean): void => {
    const visible = shown && object.visible
    if (object instanceof InstancedMesh) { if (visible && object.count > 0) draws++ }
    else if ((object instanceof Mesh || object instanceof Line) && visible) draws++
    for (const child of object.children) walk(child, visible)
  }
  walk(root, true)
  return draws
}

/** World-space bounds of every instance of every batch below `root`. */
function instanceBounds(root: Object3D, filter: (id: string | undefined) => boolean = () => true): Box3 {
  const bounds = new Box3(), part = new Box3(), matrix = new Matrix4()
  for (const mesh of instancedIn(root)) {
    const geometry = mesh.geometry as BufferGeometry
    geometry.computeBoundingBox()
    const ids = (mesh.userData.staffIds ?? mesh.userData.vehicleIds ?? []) as Array<string | undefined>
    for (let index = 0; index < mesh.count; index++) {
      if (!filter(ids[index])) continue
      mesh.getMatrixAt(index, matrix)
      bounds.union(part.copy(geometry.boundingBox!).applyMatrix4(matrix))
    }
  }
  return bounds
}

function assertBoxesClose(actual: Box3, expected: Box3, message: string): void {
  for (const key of ['min', 'max'] as const) for (const axis of ['x', 'y', 'z'] as const) {
    assert.ok(Math.abs(actual[key][axis] - expected[key][axis]) < 1e-4, `${message}: ${key}.${axis} ${actual[key][axis]} vs ${expected[key][axis]}`)
  }
}

function downRay(x: number, z: number): Raycaster {
  return new Raycaster(new Vector3(x, 10, z), new Vector3(0, -1, 0))
}

function staffCrew(count: number): StaffMember[] {
  return Array.from({ length: count }, (_, index) => {
    const member = createStaffMember(`staff-${index}`, STAFF_ROLES[index % STAFF_ROLES.length]!, { x: index % 40, z: Math.floor(index / 40), elevation: 0 })
    member.route = index % 3 === 0 ? [{ x: 0, z: 0, elevation: 0 }] : []
    member.state = index % 2 ? 'working' : 'patrolling'
    member.carryingWaste = index % 8 === 0 ? 3 : 0
    return member
  })
}

function addCarriers(game: GameState, count: number): void {
  const routes = game.snapshot.festival.infrastructure.routes
  for (let index = 0; index < count; index++) {
    routes.push({ id: `carrier-crew-${index}`, depotId: 'test', targetId: '', kind: 'food', minimum: 40, waypoints: [], position: { x: index % 30, z: -10 - Math.floor(index / 30), elevation: 0 }, path: [], phase: 'idle', cargo: index % 2 ? 5 : 0, progress: 0, status: '' } as never)
  }
}

function crewCensus(fixture: Fixture, staffCount: number, carrierCount: number) {
  const crew = new CrewInstances()
  const staffView = new StaffView(crew), supply = new SupplyChainView(crew)
  const game = fixture(0)
  addCarriers(game, carrierCount)
  const staff = staffCrew(staffCount)
  supply.update(game.snapshot, false)
  crew.begin()
  staffView.update(staff, 1, 0, undefined, 0)
  supply.animate(false, 0)
  crew.finish()
  return { crew, staffView, supply, staff, game }
}

function testCrewPool(fixture: Fixture): void {
  const small = crewCensus(fixture, 34, 26)
  const large = crewCensus(fixture, 500, 200)
  const batches = instancedIn(small.crew.group).length
  assert.equal(instancedIn(large.crew.group).length, batches, 'the crew draws with the same batches for 34 or 500 people')
  assert.ok(batches <= 29, `crew batches stay bounded (${batches})`)
  assert.equal(plainMeshesIn(large.crew.group).length, 0, 'no mesh per person')
  assert.equal(plainMeshesIn(large.staffView.group).length, 0, 'the staff view holds no meshes of its own')
  const materials = (crew: CrewInstances) => new Set(crew.meshes().map((mesh) => mesh.material)).size
  assert.equal(materials(large.crew), materials(small.crew), 'the material count does not grow with the crew')
  assert.ok(materials(large.crew) <= 3)
  const { crew, staff } = large
  const people = staff.length + 200
  assert.equal(crew.countOf('body') + crew.countOf('femaleBody'), people, 'one torso per person')
  assert.equal(crew.countOf('leg'), people * 2)
  assert.equal(crew.countOf('arm'), people * 2)
  assert.equal(crew.countOf('head'), people)
  assert.equal(crew.countOf('hatCylinder') + crew.countOf('hatCone'), staff.length, 'every staff member wears a hat')
  assert.equal(crew.countOf('hatCone'), staff.filter((member) => member.role === 'firefighter').length)
  assert.equal(crew.countOf('broom'), staff.filter((member) => member.role === 'cleaner').length)
  assert.equal(crew.countOf('wasteBag'), staff.filter((member) => member.role === 'cleaner' && member.carryingWaste > 0).length, 'the bag shows only while carrying waste')
  assert.equal(crew.countOf('carrierKit'), 200)
  assert.equal(crew.countOf('cart'), 200)
  assert.equal(crew.countOf('load'), 100, 'the crates show only with cargo')
  const known = new Set([...staff.map((member) => member.id), ...large.game.snapshot.festival.infrastructure.routes.map((route) => route.id)])
  for (const mesh of crew.meshes()) {
    const ids = mesh.userData.staffIds as Array<string | undefined>
    assert.equal(ids.length, mesh.count)
    assert.ok(ids.every((id) => id !== undefined && known.has(id)), 'every instance names its person')
  }
  crew.group.updateMatrixWorld(true)
  const target = staff[7]!
  assert.equal(crew.pick(downRay(target.x, target.z)), target.id, 'a click on a staff member picks them')
  assert.equal(crew.pick(downRay(0.5, -9.5)), 'carrier-crew-0', 'a click on a porter picks the porter')
  testCrewVisibilityAndAnimation(fixture)
  testInstancedPorterMatchesModel(fixture)
}

function testCrewVisibilityAndAnimation(fixture: Fixture): void {
  const { crew, staffView, supply, staff } = crewCensus(fixture, 20, 4)
  staffView.setVisible(false)
  crew.begin()
  staffView.update(staff, 1, 0, undefined, 16)
  supply.animate(false, 16)
  crew.finish()
  assert.equal(crew.countOf('head'), 4, 'the logistics view hides staff but keeps the porters')
  assert.equal(crew.countOf('hatCylinder') + crew.countOf('hatCone'), 0)
  assert.ok(crew.meshes().every((mesh) => mesh.visible === mesh.count > 0), 'empty batches are hidden, filled ones shown')
  // A standalone view keeps its own pool and fills it itself.
  const own = new StaffView()
  const walker = staffCrew(1)[0]!
  walker.route = [{ x: 3, z: 0, elevation: 0 }]
  own.update([walker], 1, 0, undefined, 0)
  const legs = instancedIn(own.group).find((mesh) => mesh.geometry === createPersonGeometry('leg'))!
  const first = new Matrix4(), later = new Matrix4()
  legs.getMatrixAt(0, first)
  own.update([walker], 1, 0, undefined, 180)
  legs.getMatrixAt(0, later)
  assert.ok(!first.equals(later), 'walking staff swing their legs')
  // Turning is time-based: two 30 Hz frames turn as far as four 60 Hz frames.
  const turn = (frames: number, step: number): number => {
    const view = new StaffView(), member = staffCrew(1)[0]!
    view.update([member], 1, 0, undefined, 0)
    member.facing = Math.PI / 2
    for (let frame = 1; frame <= frames; frame++) view.update([member], 1, 0, undefined, frame * step)
    return (view as any).records.get(member.id).yaw
  }
  assert.ok(Math.abs(turn(4, 1000 / 60) - turn(2, 1000 / 30)) < 1e-9, 'staff turn at the same pace at any frame rate')
}

function testInstancedPorterMatchesModel(fixture: Fixture): void {
  const game = fixture(0)
  addCarriers(game, 1)
  const route = game.snapshot.festival.infrastructure.routes.at(-1)!
  route.cargo = 3
  const view = new SupplyChainView()
  view.update(game.snapshot, false)
  view.animate(false, 0)
  view.group.updateMatrixWorld(true)
  const model = createPorterModel(route.id)
  model.position.set(route.position.x + .5, route.position.elevation, route.position.z + .5)
  model.getObjectByName('load')!.visible = true
  model.updateMatrixWorld(true)
  assertBoxesClose(instanceBounds(view.group, (id) => id === route.id), new Box3().setFromObject(model), 'the instanced porter stands where the single-mesh porter stood')
}

type TestVehicle = RoadVehicle
function vehicle(id: string, kind: RoadVehicle['kind'], x: number, z: number, extra: Partial<RoadVehicle> = {}): TestVehicle {
  return { id, kind, position: { x, z, elevation: 0 }, cell: { x, z, elevation: 0 }, route: [], state: 'driving', speed: 1, passengerIds: [], groupId: null, parkingCell: null, target: null, facing: 0, waitMinutes: 0, lineId: null, nextStopIndex: 0, resumeState: null, cargo: 0, ...extra }
}

function vehicleFleet(count: number): TestVehicle[] {
  const kinds = ['visitorCar', 'visitorCar', 'visitorCar', 'sweeper', 'garbageTruck', 'deliveryTruck', 'bus', 'ambulance', 'fireTruck', 'tourBus'] as const
  return Array.from({ length: count }, (_, index) => vehicle(`vehicle-${index}`, kinds[index % kinds.length]!, index % 50, Math.floor(index / 50), {
    state: index % 4 === 0 ? 'parked' : 'driving',
    housed: index % 10 === 7,
  }))
}

function vehicleInstances(view: LogisticsView): Map<string, number> {
  const perVehicle = new Map<string, number>()
  for (const mesh of instancedIn(view.getVehiclePickRoot())) {
    const ids = mesh.userData.vehicleIds as Array<string | undefined>
    for (let index = 0; index < mesh.count; index++) perVehicle.set(ids[index]!, (perVehicle.get(ids[index]!) ?? 0) + 1)
  }
  return perVehicle
}

function testVehicleBatches(fixture: Fixture): void {
  const batchCounts: number[] = []
  for (const count of [204, 1000]) {
    const logistics = structuredClone(fixture(0).snapshot.logistics)
    logistics.roadVehicles = vehicleFleet(count)
    const view = new LogisticsView()
    view.update(logistics, () => 0, undefined, undefined, false, 0)
    const batches = instancedIn(view.getVehiclePickRoot())
    batchCounts.push(batches.length)
    assert.ok(batches.length <= 10, `vehicles draw in at most 10 batches (${batches.length})`)
    assert.equal(plainMeshesIn(view.getVehiclePickRoot()).length, 0, 'no mesh per vehicle')
    const perVehicle = vehicleInstances(view)
    for (const item of logistics.roadVehicles) {
      const parts = perVehicle.get(item.id) ?? 0
      if (item.housed) assert.equal(parts, 0, 'a housed vehicle is not drawn, so it cannot catch clicks')
      else assert.equal(parts, item.kind === 'visitorCar' ? 2 : 1, `${item.kind}: paint and details, or one model`)
    }
  }
  assert.equal(batchCounts[0], batchCounts[1], 'the vehicle batch count does not depend on the fleet size')
  testVehicleMotionAndPicking(fixture)
}

function testVehicleMotionAndPicking(fixture: Fixture): void {
  const logistics = structuredClone(fixture(0).snapshot.logistics)
  const car = vehicle('car-motion', 'visitorCar', 4, 4), parked = vehicle('car-parked', 'visitorCar', 8, 4, { state: 'parked' })
  logistics.roadVehicles = [car, parked]
  const view = new LogisticsView()
  view.update(logistics, () => 0, undefined, undefined, false, 0)
  const poses = (view as any).vehiclePoses as Map<string, { x: number; z: number }>
  car.position = { x: 5, z: 4, elevation: 0 }
  parked.position = { x: 9, z: 4, elevation: 0 }
  view.update(logistics, () => 0, undefined, undefined, false, 100, false, false)
  assert.ok(poses.get(car.id)!.x > 4.5 && poses.get(car.id)!.x < 5.5, 'a driving car eases between cells')
  assert.equal(poses.get(parked.id)!.x, 9.5, 'a parked car snaps into its bay')
  view.getVehiclePickRoot().updateMatrixWorld(true)
  const hit = downRay(poses.get(car.id)!.x, 4.5).intersectObject(view.getVehiclePickRoot(), true)[0]
  assert.equal(instanceOwnerId(hit?.object.userData, 'vehicleIds', hit?.instanceId), car.id, 'a click on a car picks it by instance')
  // The instanced car sits exactly where its single-mesh model would.
  const model = createRoadVehicleModel('visitorCar', parked.id)
  model.position.set(9.5, 0, 4.5)
  model.rotation.y = (view as any).vehiclePoses.get(parked.id).yaw
  model.updateMatrixWorld(true)
  const bounds = new Box3()
  const matrix = new Matrix4(), part = new Box3()
  for (const mesh of instancedIn(view.getVehiclePickRoot())) {
    const ids = mesh.userData.vehicleIds as Array<string | undefined>
    mesh.geometry.computeBoundingBox()
    for (let index = 0; index < mesh.count; index++) if (ids[index] === parked.id) {
      mesh.getMatrixAt(index, matrix)
      bounds.union(part.copy(mesh.geometry.boundingBox!).applyMatrix4(matrix))
    }
  }
  assertBoxesClose(bounds, new Box3().setFromObject(model), 'paint shell and details cover the whole car')
}

function accessControls(lights: number, gates: number): AccessControlSnapshot {
  const base = { mode: 'auto', openSlots: [], polarity: 'normal', sensorThreshold: 0, area: [], scheduleTime: 'always', scheduleHours: [], scheduleOffer: 'food', schedulePhases: [] }
  return {
    trafficLights: Array.from({ length: lights }, (_, index) => ({ ...base, id: `light-${index}`, kind: 'trafficLight', sensorKind: 'carsBelow', x: index * 2, z: 0, direction: index % 4, signal: index % 2 ? 'open' : 'closed' }) as unknown as TrafficLight),
    pathBarriers: Array.from({ length: gates }, (_, index) => ({ ...base, id: `gate-${index}`, kind: 'pathBarrier', sensorKind: 'peopleBelow', x: index * 2, z: 6, elevation: 0, direction: index % 4, signal: 'closed', passage: index % 2 ? 'twoWay' : 'oneWay', openInEmergency: false }) as unknown as PathBarrier),
  }
}

function testAccessBatches(): void {
  const view = new AccessControlView()
  const controls = accessControls(3, 4)
  view.update(controls, () => 0)
  const batches = instancedIn(view.group)
  assert.ok(batches.length <= 6, `access objects draw in at most six batches (${batches.length})`)
  assert.equal(plainMeshesIn(view.group).length, 0)
  assert.ok(drawCount(view.group) <= 6)
  const byName = (name: string) => batches.find((mesh) => mesh.name === name)!
  const open = byName('accessLampsOpen'), closed = byName('accessLampsClosed'), leaves = byName('accessGateLeaves'), bodies = byName('accessLightBodies')
  assert.equal(open.count + closed.count, 7, 'a lamp for every light and gate')
  assert.equal(leaves.count, 8, 'two leaves per gate')
  assert.equal(byName('accessArrows').count, 2, 'arrows on one-way gates only')
  const layoutVersion = bodies.instanceMatrix.version, openBefore = open.count
  controls.pathBarriers[0]!.signal = 'open'
  view.update(controls, () => 0)
  const after = instancedIn(view.group)
  assert.ok(after.length === batches.length && after.every((mesh, index) => mesh === batches[index]), 'a signal flip keeps every batch object')
  assert.equal(open.count, openBefore + 1, 'the lamp moves to the green batch')
  assert.equal(bodies.instanceMatrix.version, layoutVersion, 'and the layout is not rewritten')
  view.update(controls, () => 0.5)
  const matrix = new Matrix4()
  bodies.getMatrixAt(0, matrix)
  assert.ok(Math.abs(new Vector3().setFromMatrixPosition(matrix).y - 0.5) < 1e-9, 'raising the ground lifts the traffic light')
  view.group.updateMatrixWorld(true)
  const gate = controls.pathBarriers[1]!
  const edge = gateEdgeWorldPosition(gate.x, gate.z, 0.5, gate.direction)
  const hit = downRay(edge.x, edge.z).intersectObject(view.getPickRoot(), true)[0]
  assert.ok(hit, 'the gate is hit')
  assert.equal(accessIdFromObject(hit.object, hit.instanceId), gate.id, 'instanced access objects pick by instance')
}

/**
 * The five views on the versioned festivalmittel save, counted without a browser:
 * visible meshes plus instanced meshes that hold instances. Before the batching this
 * was 1,008 objects (335 staff, 335 supply chain, 204 vehicles, 81 forecourt, 53 access).
 */
function testFixtureCensus(): void {
  const file = JSON.parse(readFileSync('tests/fixtures/performance/festivalmittel.json', 'utf8'))
  const game = GameState.fromJSON(typeof file.snapshot === 'string' ? file.snapshot : JSON.stringify(file.snapshot ?? file))!
  const snapshot = game.snapshot
  const ground = (x: number, z: number) => getTerrainHeight(snapshot.terrain, x, z)
  const crew = new CrewInstances()
  const staff = new StaffView(crew), supply = new SupplyChainView(crew)
  const logistics = new LogisticsView(), forecourt = new ForecourtView(), access = new AccessControlView()
  for (let frame = 0; frame < 3; frame++) {
    crew.begin()
    staff.update(snapshot.staff, 1, snapshot.simTick, undefined, frame * 16)
    supply.update(snapshot, false)
    supply.animate(false, frame * 16)
    crew.finish()
    logistics.update(snapshot.logistics, ground, undefined, undefined, false, frame * 16, false, frame === 0)
    forecourt.update(snapshot, snapshot.stageForecourtCells)
    access.update(snapshot.accessControls ?? { trafficLights: [], pathBarriers: [] }, ground)
  }
  const census = {
    crew: drawCount(crew.group),
    supplyChain: drawCount(supply.group),
    vehicles: drawCount(logistics.getVehiclePickRoot()),
    forecourt: drawCount(forecourt.group),
    access: drawCount(access.group),
  }
  const total = Object.values(census).reduce((sum, value) => sum + value, 0)
  assert.ok(census.crew <= 29 && census.supplyChain <= 5 && census.vehicles <= 10 && census.forecourt <= 1 && census.access <= 6, `festivalmittel census ${JSON.stringify(census)}`)
  assert.ok(total <= 50, `festivalmittel draws ${total} objects for staff, carriers, vehicles, forecourt and access (was 1,008)`)
  // Staff, every carrier route, plus push helpers and drivers of stuck trucks.
  const people = snapshot.staff.length + snapshot.festival.infrastructure.routes.length
  const heads = crew.countOf('head')
  assert.ok(heads >= people && heads <= snapshot.staff.length + (supply as any).actors.size, `every staff member and carrier is drawn (${heads})`)
  const shown = snapshot.logistics.roadVehicles.filter((item) => !item.housed).length
  assert.equal(vehicleInstances(logistics).size, shown, 'every vehicle outside its depot is drawn')
  console.log(`PASS festivalmittel render census ${JSON.stringify({ ...census, total })} (before: 1008)`)
}

/** Road decks bake their textures on a canvas; Node has none, so a stand-in draws nothing. */
function withCanvasStub(run: () => void): void {
  const previousDocument = globalThis.document
  const context = new Proxy({}, { get: () => () => {} })
  ;(globalThis as any).document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) }
  try {
    run()
  } finally {
    ;(globalThis as any).document = previousDocument
  }
}

/** The arrival gate is one mesh over the entrance field, facing into the grounds, pickable as that field. */
function testArrivalGate(fixture: Fixture): void {
  const game = fixture(0)
  const snapshot = game.snapshot
  const view = new ArrivalGateView()
  view.update(snapshot)
  const meshes: Mesh[] = []
  view.group.traverse((object) => { if (object instanceof Mesh) meshes.push(object) })
  assert.equal(meshes.length, 1, 'one merged mesh, one draw call')
  assert.equal(view.group.visible, true)
  const entrance = snapshot.buildings.find((building) => building.id === 'entrance-path')!
  const gate = meshes[0]!
  assert.equal(gate.userData.buildingId, 'entrance-path', 'a click on the gate opens the arrival field')
  assert.deepEqual([gate.position.x, gate.position.z], [entrance.x + 0.5, entrance.z + 0.5])
  // The entrance sits on the north edge, so the gate faces +z into the grounds.
  assert.equal(gate.rotation.y, 0)
  const geometry = gate.geometry
  view.update(snapshot)
  assert.equal(meshes[0]!.geometry, geometry, 'an unchanged entrance keeps its geometry')
}

export function testRenderBatching(fixture: Fixture): void {
  withCanvasStub(() => {
    testCrewPool(fixture)
    testArrivalGate(fixture)
    testVehicleBatches(fixture)
    testAccessBatches()
    testFixtureCensus()
  })
  console.log('PASS render batching: crew pool, vehicles, forecourt and access objects draw in bounded instanced batches')
}
