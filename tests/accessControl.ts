import assert from 'node:assert/strict'
import { GameState, type GameSnapshot } from '../src/game/GameState'
import { createRoadGraph, findRoadRoute, type RoadCell } from '../src/game/logistics'
import {
  areaPreviewText,
  createTrafficLight,
  currentAccessSlot,
  evaluateAccessSignal,
  GATE_EDGE_OFFSET,
  gateEdgeWorldPosition,
  minutesUntilAccessScheduleOpen,
  normalizeAccessControls,
  normalizeStaffGateDirection,
  previewLabel,
  toggleAreaCells,
  usesGateEdgePlacement,
} from '../src/game/accessControl'
import { createDefaultDayPlan, type DayPlan } from '../src/game/dayPlan'

function useFestivalCycle(plan: DayPlan): void {
  plan.leadDays = 1
  plan.festivalDays = 3
  plan.breakDays = 2
  plan.cycleStartDay = 1
}

function usesStep(
  route: Array<{ x: number; z: number }> | null,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): boolean {
  if (!route) return false
  return route.some((cell, index) => {
    const previous = index === 0 ? { x: fromX, z: fromZ } : route[index - 1]!
    return (
      previous.x === fromX &&
      previous.z === fromZ &&
      cell.x === toX &&
      cell.z === toZ
    )
  })
}

function visitorCar(
  id: string,
  x: number,
  z: number,
  route: Array<{ x: number; z: number }> = [],
) {
  return {
    id,
    kind: 'visitorCar' as const,
    position: { x, z },
    cell: { x, z },
    route,
    state: 'driving' as const,
    speed: 10,
    passengerIds: [],
    groupId: null,
    parkingCell: null,
    target: { kind: 'cruise' as const },
    facing: 0,
    waitMinutes: 0,
    resumeState: null,
    lineId: null,
    nextStopIndex: 0,
    cargo: 0,
  }
}

export function testAccessControl(fixture: (count?: number) => GameState): void {
  assert.deepEqual(
    gateEdgeWorldPosition(3, -20, 1, 0),
    { x: 3.5, y: 1, z: -19.5 + GATE_EDGE_OFFSET },
    'direction 0 sits on the +Z tile rim',
  )
  assert.deepEqual(
    gateEdgeWorldPosition(3, -20, 1, 1),
    { x: 3.5 + GATE_EDGE_OFFSET, y: 1, z: -19.5 },
    'direction 1 sits on the +X tile rim',
  )
  assert.deepEqual(
    gateEdgeWorldPosition(3, -20, 1, 2),
    { x: 3.5, y: 1, z: -19.5 - GATE_EDGE_OFFSET },
    'direction 2 sits on the -Z tile rim',
  )
  assert.deepEqual(
    gateEdgeWorldPosition(3, -20, 1, 3),
    { x: 3.5 - GATE_EDGE_OFFSET, y: 1, z: -19.5 },
    'direction 3 sits on the -X tile rim',
  )
  assert.ok(usesGateEdgePlacement('pathBarrier'))
  assert.ok(usesGateEdgePlacement('staffGate'))
  assert.ok(!usesGateEdgePlacement('securityGate'))
  assert.equal(normalizeStaffGateDirection(2), 2)
  assert.equal(normalizeStaffGateDirection(undefined), undefined)
  assert.equal(normalizeStaffGateDirection(4), undefined)

  const junction: RoadCell[] = [
    { x: 0, z: 0, allowedDirections: null, blockedEdges: 0, speedLimit: 30, crosswalk: false },
    { x: 1, z: 0, allowedDirections: 8, blockedEdges: 0, speedLimit: 30, crosswalk: false },
    { x: 0, z: 1, allowedDirections: 1, blockedEdges: 0, speedLimit: 30, crosswalk: false },
  ]
  assert.equal(findRoadRoute({ roadCells: junction, start: junction[0]!, target: junction[1]! }), null,
    'an undirected junction cannot enter an incoming one-way branch backwards, even as its goal')
  assert.ok(findRoadRoute({ roadCells: junction, start: junction[1]!, target: junction[2]! }))
  assert.ok(!createRoadGraph(junction).neighbors.get('0:0:0')?.some(cell => cell.x === 1))
  const lights = fixture(0)
  const lightState = lights.snapshot as GameSnapshot
  lights.addDebugMoney()
  assert.equal(lights.placeTrafficLight(5, -20, 0).ok, false, 'lights need a road')
  assert.ok(lights.designateRoad([{ x: 5, z: -20 }]).ok)
  const placed = lights.placeTrafficLight(5, -20, 0)
  assert.ok(placed.ok && placed.placedId)
  assert.equal(lightState.accessControls.trafficLights.length, 1)
  assert.equal(lights.placeTrafficLight(5, -20, 0).ok, false, 'one light per direction')

  const barriers = fixture(0)
  const barrierState = barriers.snapshot as GameSnapshot
  barriers.addDebugMoney()
  assert.ok(barriers.placePathSegment(6, -18, 0).ok)
  const barrier = barriers.placePathBarrier(6, -18, 0, 1)
  assert.ok(barrier.ok && barrier.placedId)
  assert.equal(barrierState.accessControls.pathBarriers.length, 1)

  const schedule = fixture(0)
  const scheduleState = schedule.snapshot as GameSnapshot
  schedule.addDebugMoney()
  for (let z = -20; z <= -16; z += 1) {
    if (!scheduleState.logistics.roadCells.some((cell) => cell.x === 0 && cell.z === z)) {
      assert.ok(schedule.designateRoad([{ x: 0, z }]).ok)
    }
  }
  const light = schedule.placeTrafficLight(0, -18, 0)
  assert.ok(light.ok && light.placedId)
  assert.ok(
    schedule.configureAccessControl(light.placedId, {
      mode: 'schedule',
      openSlots: [false, false, false, false, false, false],
    }).ok,
  )
  assert.equal(schedule.getAccessControl(light.placedId)?.signal, 'closed')
  const stopped = visitorCar('red-car', 0, -18, [{ x: 0, z: -17 }])
  scheduleState.logistics.roadVehicles.push(stopped)
  for (let n = 0; n < 4; n += 1) (schedule as any).updateLogistics(1)
  assert.equal(stopped.cell?.z, -18, 'cars already on a red light stay put')
  assert.equal(stopped.route[0]?.z, -17)
  scheduleState.logistics.roadVehicles = scheduleState.logistics.roadVehicles.filter(
    (vehicle) => vehicle.id !== 'red-car',
  )
  const approaching = visitorCar('hold-car', 0, -19, [
    { x: 0, z: -18 },
    { x: 0, z: -17 },
  ])
  scheduleState.logistics.roadVehicles.push(approaching)
  for (let n = 0; n < 4; n += 1) (schedule as any).updateLogistics(1)
  assert.equal(approaching.cell?.z, -19, 'cars stop on the cell before a red light')
  assert.equal(approaching.route[0]?.z, -18)

  const parkingSensor = fixture(0)
  const parkingState = parkingSensor.snapshot as GameSnapshot
  parkingSensor.addDebugMoney()
  assert.ok(parkingSensor.designateRoad([{ x: 0, z: -16 }]).ok)
  assert.ok(parkingSensor.designateParkingArea([{ x: 1, z: -16 }]).ok)
  const sensorLight = parkingSensor.placeTrafficLight(0, -16, 0)
  assert.ok(sensorLight.ok && sensorLight.placedId)
  assert.ok(
    parkingSensor.toggleAccessControlArea(
      sensorLight.placedId,
      { x: 1, z: -16 },
      { x: 1, z: -16 },
    ).ok,
  )
  assert.ok(
    parkingSensor.configureAccessControl(sensorLight.placedId, {
      mode: 'sensor',
      polarity: 'closed',
      sensorKind: 'noFreeParking',
    }).ok,
  )
  parkingState.logistics.parkingCells[0]!.occupiedBy = 'parked'
  parkingSensor.configureAccessControl(sensorLight.placedId, { sensorKind: 'noFreeParking' })
  assert.equal(parkingSensor.getAccessControl(sensorLight.placedId)?.signal, 'closed')
  parkingState.logistics.parkingCells[0]!.occupiedBy = null
  parkingSensor.configureAccessControl(sensorLight.placedId, { sensorKind: 'noFreeParking' })
  assert.equal(parkingSensor.getAccessControl(sensorLight.placedId)?.signal, 'open')
  const parkingStats = parkingSensor.accessAreaPreview(sensorLight.placedId)!
  assert.equal(parkingStats.freeParking, 1)
  assert.match(
    previewLabel('trafficLight', 'noFreeParking', parkingStats),
    /1 freie/,
  )

  const reroute = fixture(0)
  const rerouteState = reroute.snapshot as GameSnapshot
  reroute.addDebugMoney()
  for (let z = -20; z <= -16; z += 1) {
    if (!rerouteState.logistics.roadCells.some((cell) => cell.x === 0 && cell.z === z)) {
      assert.ok(reroute.designateRoad([{ x: 0, z }]).ok)
    }
  }
  assert.ok(reroute.designateParkingArea([{ x: 1, z: -19 }, { x: 1, z: -16 }]).ok)
  const longRed = reroute.placeTrafficLight(0, -19, 1)
  assert.ok(longRed.ok && longRed.placedId)
  assert.ok(
    reroute.configureAccessControl(longRed.placedId, {
      mode: 'schedule',
      openSlots: [false, false, false, false, false, false],
    }).ok,
  )
  const inbound = visitorCar('search-car', 0, -20)
  inbound.groupId = 'search-group'
  inbound.state = 'waiting'
  inbound.route = []
  inbound.target = null
  rerouteState.logistics.arrivalGroups.push({
    id: 'search-group',
    memberIds: [],
    vehicleId: inbound.id,
    mode: 'car',
    state: 'approaching',
    arrivedMinute: 0,
    parkingWaitMinutes: 0,
    entryFeesPaid: true,
  })
  rerouteState.logistics.roadVehicles.push(inbound)
  ;(reroute as any).assignVisitorCarParking(
    inbound,
    1,
    new Set(),
    new Set(),
    new Set(),
    true,
  )
  assert.equal(inbound.parkingCell, null, 'cars do not reserve a bay from afar')
  assert.ok(
    rerouteState.logistics.parkingCells.every((cell) => cell.occupiedBy === null),
    'distant bays stay free until a car pulls in',
  )
  assert.ok(inbound.state === 'driving' && inbound.route.length > 0)
  assert.ok(
    !usesStep(inbound.route, 0, -19, 1, -19),
    'if another approach exists they do not turn into the red bay',
  )

  const lockedPark = fixture(0)
  const lockedState = lockedPark.snapshot as GameSnapshot
  lockedPark.addDebugMoney()
  for (let z = -20; z <= -16; z += 1) {
    if (!lockedState.logistics.roadCells.some((cell) => cell.x === 0 && cell.z === z)) {
      assert.ok(lockedPark.designateRoad([{ x: 0, z }]).ok)
    }
  }
  assert.ok(lockedPark.designateParkingArea([{ x: 1, z: -20 }, { x: 1, z: -16 }]).ok)
  const lockedLight = lockedPark.placeTrafficLight(0, -18, 0)
  assert.ok(lockedLight.ok && lockedLight.placedId)
  assert.ok(lockedPark.configureAccessControl(lockedLight.placedId, { mode: 'locked' }).ok)
  const seeker = visitorCar('locked-search', 0, -20)
  seeker.groupId = 'locked-group'
  seeker.state = 'waiting'
  seeker.route = []
  seeker.target = null
  lockedState.logistics.arrivalGroups.push({
    id: 'locked-group',
    memberIds: [],
    vehicleId: seeker.id,
    mode: 'car',
    state: 'approaching',
    arrivedMinute: 0,
    parkingWaitMinutes: 0,
    entryFeesPaid: true,
  })
  lockedState.logistics.roadVehicles.push(seeker)
  ;(lockedPark as any).assignVisitorCarParking(
    seeker,
    1,
    new Set(),
    new Set(),
    new Set(),
    true,
  )
  assert.deepEqual(
    seeker.parkingCell,
    { x: 1, z: -20 },
    'the first free bay beside the car is taken immediately',
  )

  const rerouteLocked = visitorCar('locked-reroute', 0, -20, [
    { x: 0, z: -19 },
    { x: 0, z: -18 },
    { x: 0, z: -17 },
    { x: 0, z: -16 },
  ])
  rerouteLocked.groupId = 'locked-group'
  rerouteLocked.parkingCell = { x: 1, z: -16 }
  rerouteLocked.target = { kind: 'parking', parkingCell: { x: 1, z: -16 } }
  lockedState.logistics.roadVehicles.push(rerouteLocked)
  for (let n = 0; n < 3; n += 1) (lockedPark as any).updateLogistics(1)
  assert.notEqual(
    rerouteLocked.parkingCell?.z,
    -16,
    'a far reserved bay is dropped while searching',
  )
  assert.notEqual(rerouteLocked.cell?.z, -18, 'they do not roll onto the red light to wait')

  const separator = fixture(0)
  const separatorState = separator.snapshot as GameSnapshot
  separator.addDebugMoney()
  assert.ok(separator.designateRoad([{ x: 0, z: -16 }]).ok)
  assert.ok(separator.designateParkingArea([{ x: 1, z: -16 }, { x: -1, z: -16 }]).ok)
  assert.ok(separator.toggleRoadSeparator(0, -16, 3).ok)
  const beside = visitorCar('separator-car', 0, -16)
  beside.groupId = 'separator-group'
  beside.state = 'waiting'
  beside.route = []
  beside.target = null
  separatorState.logistics.arrivalGroups.push({
    id: 'separator-group',
    memberIds: [],
    vehicleId: beside.id,
    mode: 'car',
    state: 'approaching',
    arrivedMinute: 0,
    parkingWaitMinutes: 0,
    entryFeesPaid: true,
  })
  separatorState.logistics.roadVehicles.push(beside)
  ;(separator as any).assignVisitorCarParking(
    beside,
    1,
    new Set(),
    new Set(),
    new Set(),
    true,
  )
  assert.deepEqual(
    beside.parkingCell,
    { x: 1, z: -16 },
    'a side barrier blocks pull-in across that road edge',
  )
  assert.equal(
    separatorState.logistics.parkingCells.find((cell) => cell.x === -1)?.occupiedBy,
    null,
    'the bay behind the separator stays free',
  )

  const oneWayPark = fixture(0)
  const oneWayParkState = oneWayPark.snapshot as GameSnapshot
  oneWayPark.addDebugMoney()
  for (let z = -20; z <= -16; z += 1) {
    if (!oneWayParkState.logistics.roadCells.some((cell) => cell.x === 0 && cell.z === z)) {
      assert.ok(oneWayPark.designateRoad([{ x: 0, z }]).ok)
    }
    assert.ok(oneWayPark.setRoadDirection(0, z, 0).ok)
  }
  assert.ok(oneWayPark.designateParkingArea([{ x: 1, z: -18 }, { x: 1, z: -16 }]).ok)
  const passer = visitorCar('oneway-passer', 0, -20, [
    { x: 0, z: -19 },
    { x: 0, z: -18 },
    { x: 0, z: -17 },
    { x: 0, z: -16 },
  ])
  passer.groupId = 'oneway-park-group'
  passer.state = 'driving'
  passer.facing = 0
  oneWayParkState.logistics.arrivalGroups.push({
    id: 'oneway-park-group',
    memberIds: [],
    vehicleId: passer.id,
    mode: 'car',
    state: 'approaching',
    arrivedMinute: 0,
    parkingWaitMinutes: 0,
    entryFeesPaid: true,
  })
  oneWayParkState.logistics.roadVehicles.push(passer)
  for (let n = 0; n < 8; n += 1) (oneWayPark as any).updateLogistics(2)
  assert.deepEqual(
    passer.parkingCell,
    { x: 1, z: -18 },
    'a car on a one-way takes the first free bay beside it',
  )
  assert.ok(
    passer.state === 'parking' || passer.state === 'parked',
    'it pulls into that bay instead of driving past',
  )

  const service = fixture(0)
  const serviceState = service.snapshot as GameSnapshot
  service.addDebugMoney()
  for (let z = -20; z <= -16; z += 1) {
    for (const x of [0, 1]) {
      if (!serviceState.logistics.roadCells.some((cell) => cell.x === x && cell.z === z)) {
        assert.ok(service.designateRoad([{ x, z }]).ok)
      }
    }
  }
  serviceState.festival.infrastructure.depots.push({
    id: 'detour-depot',
    x: 2,
    z: -16,
    stock: { food: 0, drinks: 0, water: 0, goods: 0 },
    minimum: { food: 0, drinks: 0, water: 0, goods: 0 },
  })
  const lockedService = service.placeTrafficLight(0, -18, 0)
  assert.ok(lockedService.ok && lockedService.placedId)
  assert.ok(service.configureAccessControl(lockedService.placedId, { mode: 'locked' }).ok)
  const van = {
    id: 'detour-van',
    kind: 'deliveryTruck' as const,
    position: { x: 0, z: -19 },
    cell: { x: 0, z: -19 },
    route: [
      { x: 0, z: -18 },
      { x: 0, z: -17 },
      { x: 0, z: -16 },
      { x: 1, z: -16 },
    ],
    state: 'driving' as const,
    speed: 10,
    passengerIds: [],
    groupId: null,
    parkingCell: null,
    target: { kind: 'depot' as const, depotId: 'detour-depot' },
    facing: 0,
    waitMinutes: 0,
    resumeState: null,
    lineId: null,
    nextStopIndex: 0,
    cargo: 0,
    deliveryId: 'detour-freight',
  }
  serviceState.festival.infrastructure.trucks.push({
    id: 'detour-freight',
    deliveryId: 'detour-order',
    depotId: 'detour-depot',
    x: 0,
    z: -19,
    path: van.route.map((cell) => ({ ...cell })),
    phase: 'inbound',
    progress: 0,
    stuck: 0,
    testedCell: '',
    cargo: 4,
    kind: 'food',
  })
  serviceState.logistics.roadVehicles.push(van)
  ;(service as any).updateLogistics(1)
  assert.notEqual(van.cell?.z, -18, 'delivery trucks stop before a locked light')
  assert.ok(!usesStep(van.route, 0, -19, 0, -18), 'they take another road if one stays red')
  assert.ok(
    van.route.some((cell) => cell.x === 1),
    'the detour uses the open parallel street',
  )

  serviceState.logistics.roadVehicles = serviceState.logistics.roadVehicles.filter(
    (vehicle) => vehicle.id !== van.id,
  )
  serviceState.wasteDumpCells.push({ x: 2, z: -16, elevation: 0, stored: 8 })
  const hauler = {
    id: 'detour-garbage',
    kind: 'garbageTruck' as const,
    position: { x: 0, z: -19 },
    cell: { x: 0, z: -19 },
    route: [
      { x: 0, z: -18 },
      { x: 0, z: -17 },
      { x: 0, z: -16 },
      { x: 1, z: -16 },
    ],
    state: 'responding' as const,
    speed: 10,
    passengerIds: [],
    groupId: null,
    parkingCell: null,
    target: { kind: 'wasteDump' as const, x: 2, z: -16 },
    facing: 0,
    waitMinutes: 0,
    resumeState: null,
    lineId: null,
    nextStopIndex: 0,
    cargo: 0,
  }
  serviceState.logistics.roadVehicles.push(hauler)
  ;(service as any).updateLogistics(1)
  assert.notEqual(hauler.cell?.z, -18, 'garbage trucks stop before a locked light')
  assert.ok(!usesStep(hauler.route, 0, -19, 0, -18), 'they share the same red-light detour')
  assert.ok(
    hauler.route.some((cell) => cell.x === 1),
    'the garbage truck uses the open parallel street',
  )

  const paths = fixture(0)
  const pathState = paths.snapshot as GameSnapshot
  paths.addDebugMoney()
  const closed = paths.placePathBarrier(3, -20, 0, 1)
  assert.ok(closed.ok && closed.placedId)
  assert.ok(
    paths.configureAccessControl(closed.placedId, {
      mode: 'schedule',
      openSlots: [false, false, false, false, false, false],
    }).ok,
  )
  const detour = (paths as any).findPath(
    { x: 2, z: -20, elevation: 0 },
    [{ x: 4, z: -20, elevation: 0 }],
  ) as Array<{ x: number; z: number }> | null
  assert.ok(detour, 'guests can walk around a closed barrier')
  assert.ok(
    !usesStep(detour, 3, -20, 4, -20),
    'a closed path barrier blocks that direction',
  )
  assert.ok(
    paths.configureAccessControl(closed.placedId, {
      openSlots: [true, true, true, true, true, true],
    }).ok,
  )
  const openRoute = (paths as any).findPath(
    { x: 2, z: -20, elevation: 0 },
    [{ x: 4, z: -20, elevation: 0 }],
  ) as Array<{ x: number; z: number }> | null
  assert.ok(openRoute, 'an open barrier lets guests through')
  assert.ok(
    usesStep(openRoute, 3, -20, 4, -20) || openRoute.length < detour.length,
    'the short path reopens when the barrier lifts',
  )
  assert.ok(
    paths.configureAccessControl(closed.placedId, {
      mode: 'always',
      passage: 'oneWay',
    }).ok,
  )
  const oneWayForward = (paths as any).findPath(
    { x: 2, z: -20, elevation: 0 },
    [{ x: 4, z: -20, elevation: 0 }],
  ) as Array<{ x: number; z: number }> | null
  const oneWayBack = (paths as any).findPath(
    { x: 4, z: -20, elevation: 0 },
    [{ x: 2, z: -20, elevation: 0 }],
  ) as Array<{ x: number; z: number }> | null
  assert.ok(oneWayForward, 'always-open one-way still allows the set direction')
  assert.ok(
    usesStep(oneWayForward, 3, -20, 4, -20) || (oneWayForward?.length ?? 99) < (detour?.length ?? 99),
    'forward stays the short path',
  )
  assert.ok(
    !usesStep(oneWayBack, 4, -20, 3, -20),
    'one-way blocks the return through the gate',
  )
  assert.ok(
    paths.configureAccessControl(closed.placedId, { passage: 'both' }).ok,
  )
  const bothBack = (paths as any).findPath(
    { x: 4, z: -20, elevation: 0 },
    [{ x: 2, z: -20, elevation: 0 }],
  ) as Array<{ x: number; z: number }> | null
  assert.ok(bothBack, 'both directions stay open when the gate is unlocked')
  assert.ok(
    usesStep(bothBack, 4, -20, 3, -20) || (bothBack?.length ?? 99) <= (oneWayBack?.length ?? 99),
    'the return can use the gate again',
  )
  assert.ok(
    paths.configureAccessControl(closed.placedId, {
      mode: 'locked',
      passage: 'oneWay',
      openInEmergency: true,
    }).ok,
  )
  assert.equal(paths.getAccessControl(closed.placedId)?.signal, 'closed')
  assert.ok(
    !usesStep(
      (paths as any).findPath(
        { x: 2, z: -20, elevation: 0 },
        [{ x: 4, z: -20, elevation: 0 }],
      ),
      3,
      -20,
      4,
      -20,
    ),
    'a locked gate blocks the set direction',
  )
  const evacuee = pathState.visitors[0]
  if (evacuee) {
    evacuee.isPanicking = true
    evacuee.state = 'panicking'
  } else {
    pathState.incidents.push({
      id: 'test-fire',
      kind: 'fire',
      x: 0,
      z: 0,
      elevation: 0,
      severity: 1,
      ageMinutes: 0,
    })
  }
  paths.configureAccessControl(closed.placedId, { mode: 'locked' })
  assert.equal(paths.getAccessControl(closed.placedId)?.signal, 'open')
  assert.ok(paths.isAccessEmergency())
  const flee = (paths as any).findPath(
    { x: 4, z: -20, elevation: 0 },
    [{ x: 2, z: -20, elevation: 0 }],
  ) as Array<{ x: number; z: number }> | null
  assert.ok(
    usesStep(flee, 4, -20, 3, -20),
    'emergency opens a locked one-way gate both ways',
  )
  assert.ok(
    paths.configureAccessControl(closed.placedId, { openInEmergency: false }).ok,
  )
  assert.equal(
    paths.getAccessControl(closed.placedId)?.signal,
    'closed',
    'a gate can stay locked during an emergency',
  )

  const people = fixture(2)
  const peopleState = people.snapshot as GameSnapshot
  people.addDebugMoney()
  assert.ok(people.placePathSegment(7, -18, 0).ok)
  const peopleGate = people.placePathBarrier(7, -18, 0, 0)
  assert.ok(peopleGate.ok && peopleGate.placedId)
  peopleState.visitors[0]!.cellX = 8
  peopleState.visitors[0]!.cellZ = -18
  peopleState.visitors[1]!.cellX = 0
  peopleState.visitors[1]!.cellZ = 0
  assert.ok(
    people.toggleAccessControlArea(peopleGate.placedId, { x: 8, z: -18 }, { x: 8, z: -18 }).ok,
  )
  assert.ok(
    people.configureAccessControl(peopleGate.placedId, {
      mode: 'sensor',
      polarity: 'closed',
      sensorKind: 'peopleAbove',
      sensorThreshold: 0,
    }).ok,
  )
  assert.equal(people.getAccessControl(peopleGate.placedId)?.signal, 'closed')
  const peopleStats = people.accessAreaPreview(peopleGate.placedId)!
  assert.equal(peopleStats.people, 1)
  assert.equal(previewLabel('pathBarrier', 'peopleAbove', peopleStats), '1 Personen im Gebiet')

  const camping = fixture(1)
  const campingState = camping.snapshot as GameSnapshot
  camping.addDebugMoney()
  assert.ok(camping.designateCampingArea([{ x: 8, z: -12 }, { x: 9, z: -12 }]).ok)
  campingState.visitors[0]!.campsite = { x: 8, z: -12, elevation: 0 }
  assert.ok(camping.placePathSegment(8, -11, 0).ok)
  const campGate = camping.placePathBarrier(8, -11, 0, 2)
  assert.ok(campGate.ok && campGate.placedId)
  assert.ok(
    camping.toggleAccessControlArea(campGate.placedId, { x: 8, z: -12 }, { x: 9, z: -12 }).ok,
  )
  const campStats = camping.accessAreaPreview(campGate.placedId)!
  assert.equal(campStats.occupiedCamping, 1)
  assert.equal(campStats.freeCamping, 1)
  assert.match(areaPreviewText('pathBarrier', campStats), /1 freie \/ 1 belegte/)

  const area = toggleAreaCells([], { x: 1, z: 1 }, { x: 2, z: 2 })
  assert.equal(area.length, 4, 'drag includes every corner')
  const removed = toggleAreaCells(area, { x: 1, z: 1 }, { x: 2, z: 2 })
  assert.equal(removed.length, 0, 'a second drag over the same rectangle removes it')
  const grown = toggleAreaCells(area, { x: 2, z: 2 }, { x: 3, z: 2 })
  assert.equal(grown.length, 5)

  const loaded = new GameState(structuredClone(lightState))
  assert.equal(loaded.snapshot.version, 29)
  assert.equal(loaded.snapshot.accessControls.trafficLights.length, 1)
  assert.equal(loaded.snapshot.accessControls.trafficLights[0]!.x, 5)
  assert.equal(currentAccessSlot(12 * 60), 0)
  assert.equal(currentAccessSlot(12 * 60 + 25), 2)

  const legacy = normalizeAccessControls({
    trafficLights: [
      {
        id: 'legacy-light',
        x: 1,
        z: 2,
        direction: 0,
        mode: 'schedule',
        openSlots: [true, false, false, false, false, false],
      },
    ],
  })
  const legacyLight = legacy.trafficLights[0]!
  assert.equal(legacyLight.scheduleTime, 'hourlySlots')
  assert.deepEqual(legacyLight.schedulePhases, ['lead', 'festival', 'break'])
  assert.equal(legacyLight.scheduleOffer, 'rides')
  assert.equal(
    evaluateAccessSignal(legacyLight, 12 * 60, emptyAccessStats()),
    'open',
    'old saves keep the repeating hourly slots',
  )
  assert.equal(
    evaluateAccessSignal(legacyLight, 12 * 60 + 12, emptyAccessStats()),
    'closed',
  )

  const hours = fixture(0)
  const hoursState = hours.snapshot as GameSnapshot
  useFestivalCycle(hoursState.dayPlan)
  hours.addDebugMoney()
  const hourCell = { x: 9, z: -20 }
  if (!hoursState.logistics.roadCells.some((cell) => cell.x === hourCell.x && cell.z === hourCell.z)) {
    assert.ok(hours.designateRoad([hourCell]).ok)
  }
  const hourLight = hours.placeTrafficLight(hourCell.x, hourCell.z, 0)
  assert.ok(hourLight.ok && hourLight.placedId)
  hoursState.minute = 9 * 60
  hoursState.day = 1
  assert.ok(
    hours.configureAccessControl(hourLight.placedId, {
      mode: 'schedule',
      scheduleTime: 'hours',
      scheduleHours: Array.from({ length: 24 }, (_, hour) => hour >= 10 && hour < 18),
      schedulePhases: ['lead', 'festival', 'break'],
    }).ok,
  )
  assert.equal(hours.getAccessControl(hourLight.placedId)?.signal, 'closed')
  hoursState.minute = 10 * 60
  hours.configureAccessControl(hourLight.placedId, { scheduleTime: 'hours' })
  assert.equal(hours.getAccessControl(hourLight.placedId)?.signal, 'open')

  hoursState.day = 1
  hoursState.minute = 12 * 60
  assert.ok(
    hours.configureAccessControl(hourLight.placedId, {
      schedulePhases: ['festival'],
    }).ok,
  )
  assert.equal(
    hours.getAccessControl(hourLight.placedId)?.signal,
    'closed',
    'Vorbereitung ignores a festival-only time window',
  )
  hoursState.day = 2
  hours.configureAccessControl(hourLight.placedId, { scheduleTime: 'hours' })
  assert.equal(
    hours.getAccessControl(hourLight.placedId)?.signal,
    'open',
    'same clock hour opens on a festival day',
  )

  const follow = fixture(0)
  const followState = follow.snapshot as GameSnapshot
  useFestivalCycle(followState.dayPlan)
  follow.addDebugMoney()
  const gateCell = { x: 10, z: -18 }
  if (!follow.getPathAt(gateCell.x, gateCell.z)) {
    assert.ok(follow.placePathSegment(gateCell.x, gateCell.z, 0).ok)
  }
  const followGate = follow.placePathBarrier(gateCell.x, gateCell.z, 0, 1)
  assert.ok(followGate.ok && followGate.placedId)
  followState.day = 1
  followState.minute = 12 * 60
  assert.ok(
    follow.configureAccessControl(followGate.placedId, {
      mode: 'schedule',
      scheduleTime: 'dayPlan',
      scheduleOffer: 'rides',
      schedulePhases: ['lead', 'festival', 'break'],
    }).ok,
  )
  assert.equal(
    follow.getAccessControl(followGate.placedId)?.signal,
    'closed',
    'rides stay closed during Vorbereitung',
  )
  followState.day = 2
  follow.configureAccessControl(followGate.placedId, { scheduleOffer: 'rides' })
  assert.equal(
    follow.getAccessControl(followGate.placedId)?.signal,
    'open',
    'the gate follows open ride hours on a festival day',
  )
  followState.minute = 9 * 60
  follow.configureAccessControl(followGate.placedId, { scheduleOffer: 'rides' })
  assert.equal(
    follow.getAccessControl(followGate.placedId)?.signal,
    'closed',
    'the gate follows closed ride hours',
  )
  followState.minute = 12 * 60
  followState.day = 5
  follow.configureAccessControl(followGate.placedId, { scheduleOffer: 'rides' })
  assert.equal(
    follow.getAccessControl(followGate.placedId)?.signal,
    'closed',
    'rides stay closed during Pause',
  )
  followState.day = 2
  assert.ok(
    follow.configureAccessControl(followGate.placedId, {
      scheduleOffer: 'toilets',
    }).ok,
  )
  assert.equal(follow.getAccessControl(followGate.placedId)?.signal, 'open')
  followState.day = 5
  follow.configureAccessControl(followGate.placedId, { scheduleOffer: 'toilets' })
  assert.equal(
    follow.getAccessControl(followGate.placedId)?.signal,
    'open',
    'toilets stay open during Pause',
  )

  const probe = createTrafficLight('probe', 0, 0, 0)
  probe.scheduleTime = 'hours'
  probe.scheduleHours = Array.from({ length: 24 }, (_, hour) => hour === 11)
  probe.schedulePhases = ['festival']
  const dayPlan = createDefaultDayPlan()
  assert.equal(
    minutesUntilAccessScheduleOpen(probe, 10 * 60, { day: 1, dayPlan }),
    25 * 60,
    'waits until the next festival day and the selected hour',
  )
}

function emptyAccessStats() {
  return {
    freeParking: 0,
    occupiedParking: 0,
    carsOnRoad: 0,
    freeCamping: 0,
    occupiedCamping: 0,
    people: 0,
  }
}
