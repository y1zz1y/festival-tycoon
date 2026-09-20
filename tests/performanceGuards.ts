import assert from 'node:assert/strict'
import { Group, InstancedMesh, Mesh, Vector3, OrthographicCamera } from 'three'
import { GameState } from '../src/game/GameState'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import { createRetroBuilding, batchRetroBuildings, DETAILED_BUILDINGS } from '../src/view/retroBuildings'
import { DAYLIGHT_LIGHT_COLOR, DAYLIGHT_LIGHT_DISTANCE, FESTIVAL_LIGHT_BUDGET, FestivalLightsView } from '../src/view/FestivalLightsView'
import { lightViewOf } from '../src/view/lightSelection'
import { createAttractionAccess } from '../src/view/attractionAccess'
import { createCoasterCar } from '../src/view/coasterCars'
import {
  createLogisticsFacility,
  createRoadVehicleModel,
  createSupplyStructure,
  LOGISTICS_FACILITY_KINDS,
  VISITOR_CAR_COLORS,
  visitorCarColor,
} from '../src/view/logisticsModels'
import { createPorterModel } from '../src/view/carrierModels'
import { disposeObject3D } from '../src/view/disposeObject3D'

function testRoadExitCache(fixture: (count?: number) => GameState): void {
  const traffic = fixture(0), roads = traffic as any
  const edge = -roads.getWorldSize() / 2
  traffic.snapshot.logistics.roadCells = Array.from({ length: 4 }, (_, i) => ({
    x: 0, z: edge + i, elevation: 0, allowedDirections: null,
    blockedEdges: 0, speedLimit: 30 as const, crosswalk: false,
  }))
  roads.invalidateRoadGraph()
  let exitSearches = 0
  const searchExit = roads.searchReachableRoadExit.bind(roads)
  roads.searchReachableRoadExit = (...args: any[]) => { exitSearches++; return searchExit(...args) }
  const start = { x: 0, z: edge + 3, elevation: 0 }
  const exitRoute = roads.findReachableRoadExit(start, 2)
  assert.ok(exitRoute?.route.length, 'the shared exit query finds the map edge')
  exitRoute.route[0].x = 999
  exitRoute.route.length = 0
  for (let i = 0; i < 200; i++) {
    assert.equal(roads.findReachableRoadExit(start, 2).route[0].x, 0, 'callers own their route copies')
  }
  assert.equal(exitSearches, 1, 'identical departure queries share one search')
  assert.equal(roads.findReachableRoadExit(start, 2, new Set([`0:${edge + 1}`])), null,
    'live occupancy bypasses the static exit cache')
  assert.ok(roads.findReachableRoadExit(start, 2), 'a blocked detour does not poison static reachability')
  assert.ok(traffic.setRoadDirection(0, edge + 1, 0).ok)
  const beforeBlocked = exitSearches
  for (let i = 0; i < 200; i++) assert.equal(roads.findReachableRoadExit(start, 2), null)
  assert.equal(exitSearches - beforeBlocked, 1, 'unreachable exits are not searched again each tick')
  assert.ok(traffic.setRoadDirection(0, edge + 1, 2).ok)
  assert.ok(roads.findReachableRoadExit(start, 2), 'arrow edits immediately invalidate failed exit searches')
  roads.findReachableRoadExit(start, 0)
  roads.findReachableRoadExit(start, 0, undefined, true)
  assert.equal(exitSearches, beforeBlocked + 4, 'heading and U-turn policy have distinct cache entries')
}

export function testPerformanceGuards(fixture: (count?: number) => GameState): void {
  testRoadExitCache(fixture)
  testLocalParkingClaims(fixture)
  const game = fixture(100), internal = game as any
  const visitor = game.snapshot.visitors[0]!
  const camp = internal.camping
  const installations = Array.from({ length: 335 }, (_, i) => ({ id: `gathering-${i}`, cell: { x: i, z: 0, elevation: 0 }, kind: 'chairs', ownerId: '', contributorIds: ['owner'] }))
  game.snapshot.campInstallations = installations as any
  const occupied = game.snapshot.visitors[1]!
  occupied.state = 'socializing'; occupied.campActivityTarget = { x: 0, z: 0, elevation: 0 }; occupied.campActivitySlot = 0
  let pathCalls = 0, offeredGoals: any[] = []
  const oldFind = internal.findPath
  internal.findPath = (_start: any, goals: any[]) => { pathCalls++; offeredGoals = goals; return [goals.at(-1)] }
  const destination = camp.findRouteToGathering(visitor)
  assert.equal(pathCalls, 1, '335 camp gathering candidates require only one search')
  assert.equal(offeredGoals.length, 334, 'occupied seats are excluded before routing')
  assert.equal(destination.target.x, 334, 'a reachable destination outside the nearest few stays available')
  internal.findPath = oldFind

  internal.processingSimulationStep = true
  internal.decisionBudget = SIMULATION_CONFIG.pathfinding.decisionsPerTick
  internal.decidedThisTick.clear()
  internal.visitorsAwaitingDecision.clear()
  // Exhausted visitors produce real departure routes; no artificial slow timers.
  game.snapshot.visitors.forEach(v => { v.state = 'exploring'; v.route = []; v.targetId = null; v.needs.energy = 0; v.pendingWaste = 0 })
  for (const v of game.snapshot.visitors) internal.decideNextAction(v)
  assert.equal(internal.decidedThisTick.size, SIMULATION_CONFIG.pathfinding.decisionsPerTick)
  assert.equal(internal.visitorsAwaitingDecision.size, 100 - SIMULATION_CONFIG.pathfinding.decisionsPerTick)
  for (let i = 0; i < 7; i++) {
    internal.decisionBudget = SIMULATION_CONFIG.pathfinding.decisionsPerTick; internal.decidedThisTick.clear()
    internal.flushVisitorDecisions(SIMULATION_CONFIG.pathfinding.decisionsPerTick)
  }
  assert.equal(internal.visitorsAwaitingDecision.size, 0, 'deferred decisions eventually drain')
  internal.processingSimulationStep = false

  const closing = fixture(100), departure = closing as any
  const budget = SIMULATION_CONFIG.pathfinding.decisionsPerTick
  departure.visitorsAwaitingDecision.clear()
  departure.processingSimulationStep = true
  departure.decisionBudget = budget
  departure.decidedThisTick.clear()
  let departures = 0
  const beginDeparture = departure.camping.beginDeparture.bind(departure.camping)
  departure.camping.beginDeparture = (...args: any[]) => { departures++; return beginDeparture(...args) }
  departure.findPath = (_start: any, goals: any[]) => [goals[0]]
  closing.snapshot.visitors.forEach(v => {
    Object.assign(v, { state: 'exploring', campsite: null, campingPhase: 'none', cellX: 2, cellZ: -20, pendingWaste: 0, arrivalGroupId: null, route: [], targetId: null })
    departure.beginVisitorDeparture(v)
  })
  assert.equal(departures, budget, 'mass departures share the destination budget')
  assert.ok(closing.snapshot.visitors.every(v => v.state === 'leaving'), 'urgent departure states change immediately even with no routing budget')
  assert.equal(departure.pendingVisitorRouting.size, 100-budget)
  for (let i=0;i<Math.ceil(100/budget);i++) {
    departure.decisionBudget = budget; departure.decidedThisTick.clear()
    departure.flushVisitorDecisions(budget)
  }
  assert.equal(departures, 100, 'all queued departures drain fairly')
  assert.equal(departure.pendingVisitorRouting.size, 0)
  assert.ok(closing.snapshot.visitors.every(v => v.route.length > 0))
  departure.processingSimulationStep = false
  closing.setParkOpen(false)
  assert.equal(departures,100,'manual closure does not route the entire crowd outside the tick budget')
  assert.equal(departure.pendingVisitorRouting.size,100)
  departure.pendingVisitorRouting.clear(); departure.visitorsAwaitingDecision.clear()
  departure.processingSimulationStep = true
  const wasteGuest = closing.snapshot.visitors[0]!
  closing.snapshot.buildings.push({ id:'budget-bin', kind:'wasteBin', x:5, z:-20, elevation:0, rotation:0, price:0, wasteFill:0 })
  Object.assign(wasteGuest, { state:'exploring', route:[], targetId:null })
  departure.decisionBudget = 0
  departure.giveWaste(wasteGuest, 1)
  assert.equal(wasteGuest.pendingWaste, 1, 'deferral does not lose generated waste')
  assert.equal(wasteGuest.route.length, 0, 'direct waste callbacks cannot exceed the routing budget')
  assert.equal(departure.pendingVisitorRouting.get(wasteGuest.id), 'waste')
  departure.decisionBudget = budget; departure.decidedThisTick.clear()
  departure.flushVisitorDecisions(budget)
  assert.equal(wasteGuest.targetId, 'budget-bin')
  assert.ok(wasteGuest.route.length > 0)
  const remainingBudget = departure.decisionBudget
  departure.beginVisitorDeparture(wasteGuest)
  assert.equal(departure.decisionBudget, remainingBudget, 'ongoing waste disposal is not replanned by every closing check')

  const packing = fixture(1), packingInternal = packing as any
  const camper = packing.snapshot.visitors[0]!, entrance = packingInternal.getEntrance()
  Object.assign(camper, { state:'exploring', ticketType:'camping', campsite:{x:3,z:0,elevation:0}, campingPhase:'ready',
    cellX:entrance.x, cellZ:entrance.z, cellElevation:entrance.elevation, route:[], targetId:null, pendingWaste:0 })
  packing.snapshot.parkOpen = false
  packingInternal.processingSimulationStep = true
  packingInternal.decisionBudget = 0
  packingInternal.beginVisitorDeparture(camper)
  packingInternal.updateVisitors(0.1)
  assert.equal(packing.snapshot.visitors.length, 1, 'a camper at the exit cannot disappear while their packing route is deferred')
  const restoredPacking = GameState.fromJSON(JSON.stringify(packing.snapshot))!, restoredInternal = restoredPacking as any
  restoredInternal.findPath = (_start: any, goals: any[]) => [goals[0]]
  restoredInternal.ensureExitRoute(restoredPacking.snapshot.visitors[0])
  assert.equal(restoredPacking.snapshot.visitors[0]!.campingPhase, 'packing', 'loading reconstructs a deferred packing trip even at the entrance')

  const paths = fixture(0), navigation = paths as any
  const start = { x: 2, z: -20, elevation: 0 }, goal = { x: 4, z: -20, elevation: 0 }
  assert.ok(navigation.findPath(start, [goal]))
  const cached = [...navigation.pedestrianPathCache.values()][0]
  navigation.updateCrowdingAndMotivation(2)
  assert.ok([...navigation.pedestrianPathCache.values()].includes(cached), 'crowd updates do not flush every route together')
  paths.snapshot.simTick += 90
  navigation.findPath(start, [goal])
  assert.ok(![...navigation.pedestrianPathCache.values()].includes(cached), 'costs get reconsidered after bounded cache lifetime')
  const beforeRebuild = [...navigation.pedestrianPathCache.values()][0]
  paths.placePathSegment(5, -20, 0)
  navigation.findPath(start, [goal])
  assert.ok(![...navigation.pedestrianPathCache.values()].includes(beforeRebuild), 'new construction invalidates old routes immediately')
  paths.snapshot.buildings.find(b => b.kind === 'path' && b.x === goal.x && b.z === goal.z)!.staffOnly = true
  paths.worldRevision++
  let expandedNeighbors = 0
  const originalNeighbors = navigation.getPedestrianNeighbors
  navigation.getPedestrianNeighbors = (...args: any[]) => { expandedNeighbors++; return originalNeighbors.apply(navigation,args) }
  assert.equal(navigation.findPath(start,[goal]),null)
  assert.equal(expandedNeighbors,0,'a forbidden target needs no graph traversal')
  assert.ok(navigation.findPath(start,[goal],false,false,false,false,false,undefined,true),'staff retain access to staff-only targets')
  assert.ok(expandedNeighbors>0)

  const source = new Group()
  for (const kind of DETAILED_BUILDINGS) {
    const a = createRetroBuilding(kind)!, b = createRetroBuilding(kind)!
    a.userData.buildingId = `${kind}-a`
    b.userData.buildingId = `${kind}-b`
    b.position.set(3, 2, -1); b.rotation.y = Math.PI / 2
    source.add(a, b)
    const mesh = a.children[0] as Mesh
    assert.equal(a.children.length, 1, `${kind}: static details must be merged`)
    assert.ok(mesh.geometry.getAttribute('color'))
    assert.ok(mesh.geometry.getAttribute('position').count < 5000, `${kind}: geometry budget`)
    mesh.geometry.computeBoundingBox()
    const bounds = mesh.geometry.boundingBox!
    assert.ok(
      [bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z]
        .every(Number.isFinite),
      `${kind}: finite model bounds`,
    )
    assert.equal(mesh.geometry, (b.children[0] as Mesh).geometry, 'instances share geometry')
  }
  const batches = batchRetroBuildings(source)
  assert.equal(batches.children.length, DETAILED_BUILDINGS.length, 'one draw per asset kind, not per detail')
  for (const child of batches.children) {
    const batch = child as InstancedMesh
    assert.equal(batch.count, 2)
    assert.equal((batch.userData.buildingIds as string[]).length, 2, 'batch keeps picking IDs')
    assert.ok(batch.boundingSphere!.containsPoint(new Vector3(3, 2, -1)))
  }
  const lightGame = fixture(1), lightSnapshot = lightGame.snapshot
  const accessModels = new Group()
  for (const theme of ['carousel', 'bungee', 'coaster'] as const) for (const kind of ['entrance', 'exit'] as const) {
    const a = createAttractionAccess(kind, theme), b = createAttractionAccess(kind, theme)
    const mesh = a.children[0] as Mesh
    assert.equal(a.children.length, 1, 'access details are merged into one mesh')
    assert.equal(mesh.geometry, (b.children[0] as Mesh).geometry, 'gates reuse geometry')
    assert.ok(mesh.geometry.getAttribute('position').count < 5000, 'access geometry stays bounded')
    mesh.geometry.computeBoundingBox()
    assert.ok(mesh.geometry.boundingBox!.min.x >= -.5 && mesh.geometry.boundingBox!.max.x <= .5, 'gate stays inside its tile')
    const preview = createAttractionAccess(kind, theme, true)
    assert.notEqual((preview.children[0] as Mesh).material, mesh.material, 'preview tint cannot recolor built gates')
    let sharedDisposed = false
    mesh.geometry.addEventListener('dispose', () => { sharedDisposed = true })
    disposeObject3D(preview)
    assert.equal(sharedDisposed, false, 'replacing previews preserves cached geometry')
    accessModels.add(a, b)
  }
  assert.equal(batchRetroBuildings(accessModels).children.length, 6, 'gate draw calls depend on theme, not gate count')
  const carA = createCoasterCar(0x2876c7)
  const carB = createCoasterCar(0x2876c7)
  const carMesh = carA.children[0] as Mesh
  assert.equal(carA.children.length, 1, 'coaster cars merge into one mesh')
  assert.equal(carMesh.geometry, (carB.children[0] as Mesh).geometry, 'coaster cars reuse geometry')
  assert.ok(carMesh.geometry.getAttribute('position').count < 1200, 'car geometry stays bounded')
  let carGeometryDisposed = false
  carMesh.geometry.addEventListener('dispose', () => { carGeometryDisposed = true })
  disposeObject3D(carB)
  assert.equal(carGeometryDisposed, false, 'disposing one car keeps the shared body')

  for (const kind of LOGISTICS_FACILITY_KINDS) {
    const a = createLogisticsFacility(kind)
    const b = createLogisticsFacility(kind)
    const mesh = a.children[0] as Mesh
    assert.equal(a.children.length, 1, `${kind}: logistics facility details must be merged`)
    assert.ok(mesh.geometry.getAttribute('color'))
    assert.ok(mesh.geometry.getAttribute('position').count < 5000, `${kind}: facility geometry budget`)
    assert.equal(mesh.geometry, (b.children[0] as Mesh).geometry, `${kind}: facilities share geometry`)
  }
  for (const kind of ['delivery', 'supply'] as const) {
    const a = createSupplyStructure(kind)
    const b = createSupplyStructure(kind)
    assert.equal(a.children.length, 1, `${kind}: supply structure merges`)
    assert.equal((a.children[0] as Mesh).geometry, (b.children[0] as Mesh).geometry)
  }
  const visitorA = createRoadVehicleModel('visitorCar', 'car-a')
  const visitorB = createRoadVehicleModel('visitorCar', 'car-a')
  const visitorC = createRoadVehicleModel('visitorCar', 'car-other-hue')
  assert.equal(visitorA.children.length, 1, 'visitor cars merge into one mesh')
  assert.equal((visitorA.children[0] as Mesh).geometry, (visitorB.children[0] as Mesh).geometry)
  assert.ok(
    VISITOR_CAR_COLORS.includes(visitorCarColor('car-a') as typeof VISITOR_CAR_COLORS[number]),
  )
  assert.equal(visitorCarColor('car-a'), visitorCarColor('car-a'), 'car paint is stable for an id')
  for (const kind of ['garbageTruck', 'deliveryTruck', 'bus', 'ambulance', 'sweeper', 'tourBus'] as const) {
    const a = createRoadVehicleModel(kind)
    const b = createRoadVehicleModel(kind)
    const mesh = a.children[0] as Mesh
    assert.equal(a.children.length, 1, `${kind}: vehicle details merge`)
    assert.equal(mesh.geometry, (b.children[0] as Mesh).geometry, `${kind}: vehicles share geometry`)
    assert.ok(mesh.geometry.getAttribute('position').count < 2000, `${kind}: vehicle geometry budget`)
  }
  const porterA = createPorterModel('carrier-guard-a')
  const porterB = createPorterModel('carrier-guard-b')
  const porterMeshes = porterA.children.filter((child) => child instanceof Mesh) as Mesh[]
  assert.ok(porterMeshes.length <= 2, 'porter cart and extras stay merged')
  const porterCart = porterMeshes[0]!
  assert.equal(porterCart.geometry, (porterB.children.find((child) => child instanceof Mesh) as Mesh).geometry, 'porters share cart geometry')
  assert.ok(porterCart.geometry.getAttribute('position').count < 900, 'porter cart stays bounded')
  void visitorC
  lightSnapshot.minute = 23 * 60
  lightSnapshot.power.poweredBuildingIds = ['unpowered-food-light', 'unpowered-lamp-light']
  lightSnapshot.dayPlan.offers.food[23] = true
  lightSnapshot.dayPlan.offers.lights[23] = true
  for (let index = 0; index < 12; index++) {
    lightSnapshot.buildings.push({
      id: `string-light-${index}`,
      kind: 'stringLights',
      x: index,
      z: 0,
      elevation: 0,
      rotation: 0,
      decorationSlot: 0,
      price: 0,
    })
  }
  lightSnapshot.buildings.push({
    id: 'unpowered-food-light',
    kind: 'food',
    x: 15,
    z: 0,
    elevation: 0,
    rotation: 0,
    price: 10,
  }, {
    id: 'unpowered-lamp-light',
    kind: 'lighting',
    x: 17,
    z: 0,
    elevation: 0,
    rotation: 0,
    price: 0,
  })
  Object.assign(lightSnapshot.visitors[0]!, {
    campsite: { x: 16, z: 0, elevation: 0 },
    campingPhase: 'resting',
  })
  const festivalLights = new FestivalLightsView()
  festivalLights.update(lightSnapshot)
  assert.equal((festivalLights as any).bulbs.count, 15, 'all active light sources remain visible')
  assert.equal((festivalLights as any).glows.count, 15, 'every source retains its own light pool')
  assert.equal((festivalLights as any).pool.length, FESTIVAL_LIGHT_BUDGET, 'real-time lights have a fixed shader budget')
  const originalLights = [...(festivalLights as any).pool]
  lightSnapshot.minute = 12 * 60
  lightSnapshot.dayPlan.offers.food[12] = false
  lightSnapshot.dayPlan.offers.lights[12] = false
  festivalLights.update(lightSnapshot)
  assert.equal((festivalLights as any).bulbs.count, 1, 'scheduled sources switch off while a sleeping tent may stay lit')
  assert.equal((festivalLights as any).glows.count, 1)
  assert.deepEqual((festivalLights as any).pool, originalLights, 'turning lights off does not rebuild the GPU shader variant')
  lightSnapshot.visitors[0]!.campingPhase = 'none'
  festivalLights.update(lightSnapshot)
  assert.equal((festivalLights as any).bulbs.count, 0)
  assert.ok(originalLights.every(light => light.intensity === 0 && light.parent === festivalLights.group), 'zero-source scenes keep the same inactive lights attached')
  lightSnapshot.minute = 23 * 60
  for (let index = 0; index < 500; index++) lightSnapshot.buildings.push({ id: `many-lights-${index}`, kind: 'stringLights', x: index % 40, z: Math.floor(index / 40), elevation: 0, rotation: 0, price: 0 })
  festivalLights.update(lightSnapshot)
  assert.equal((festivalLights as any).bulbs.count, 514)
  assert.equal((festivalLights as any).glows.count, 514)
  assert.deepEqual((festivalLights as any).pool, originalLights, 'adding hundreds of lights cannot increase shader light count')
  // The real lights go to what the camera can see: a view over the far corner of the
  // field serves only sources inside it, nearest its middle first.
  const corner = new OrthographicCamera(-4, 4, 4, -4, 0.1, 100)
  corner.position.set(39, 20, 11); corner.lookAt(39, 0, 11); corner.updateMatrixWorld()
  festivalLights.setView(lightViewOf(corner, new Vector3(39, 0, 11)))
  const lit = originalLights.filter(light => light.intensity > 0)
  assert.equal(lit.length, FESTIVAL_LIGHT_BUDGET, 'every real light is in use where there is plenty to light')
  assert.ok(lit.every(light => Math.abs(light.position.x - 39) <= 4 && Math.abs(light.position.z - 11) <= 4), 'and every one of them lights a source inside the view')
  // Zooming brings other lamps on screen without moving the point the camera looks
  // at, so the selection has to follow the zoom as well as the vantage point.
  const sentinel = originalLights[0]!
  sentinel.intensity = -1
  festivalLights.setView(lightViewOf(corner, new Vector3(39, 0, 11)))
  assert.equal(sentinel.intensity, -1, 'an unchanged view does not redo the work')
  const zoomedOut = new OrthographicCamera(-30, 30, 30, -30, 0.1, 100)
  zoomedOut.position.set(39, 20, 11); zoomedOut.lookAt(39, 0, 11); zoomedOut.updateMatrixWorld()
  festivalLights.setView(lightViewOf(zoomedOut, new Vector3(39, 0, 11)))
  assert.notEqual(sentinel.intensity, -1, 'zooming re-serves the lights even from the same spot')
  assert.equal(
    originalLights.filter(light => light.intensity > 0).length,
    FESTIVAL_LIGHT_BUDGET,
    'and the whole pool stays in use',
  )
  // The point of following the zoom: a view with far more lamps on it than there
  // are lights must still light all of them. Handing the lights to the ones
  // nearest the middle of the screen lit a clump in the centre and left two
  // thirds of the park dark, so neighbours share a light instead.
  {
    const view = lightViewOf(zoomedOut, new Vector3(39, 0, 11))
    const sources: Array<{ position: Vector3 }> = (festivalLights as any).sources
    const onScreen = sources.filter(source => view.frustum.containsPoint(source.position))
    const shining = originalLights.filter(light => light.intensity > 0)
    assert.ok(onScreen.length > FESTIVAL_LIGHT_BUDGET * 2, 'the zoomed-out view really is crowded')
    const dark = onScreen.filter(source => !shining.some(light =>
      Math.hypot(light.position.x - source.position.x, light.position.z - source.position.z) <= light.distance))
    assert.deepEqual(dark, [], 'every lamp on screen stands in the reach of some light')
  }
  const balloonLights = new FestivalLightsView()
  lightSnapshot.buildings = [{
    id: 'moon-balloon',
    kind: 'lightBalloon',
    x: 4,
    z: 6,
    elevation: 0,
    rotation: 0,
    price: 0,
  }]
  lightSnapshot.power.poweredBuildingIds = ['moon-balloon']
  lightSnapshot.minute = 23 * 60
  lightSnapshot.dayPlan.offers.lights[23] = true
  lightSnapshot.visitors[0]!.campingPhase = 'none'
  balloonLights.update(lightSnapshot)
  balloonLights.setView((() => { const at = new Vector3(4.5, 0, 6.5); const above = new OrthographicCamera(-30, 30, 30, -30, 0.1, 100); above.position.set(at.x, 20, at.z); above.lookAt(at); above.updateMatrixWorld(); return lightViewOf(above, at) })())
  const balloonPool = (balloonLights as any).pool as { color: { getHex(): number }; distance: number; intensity: number; parent: unknown }[]
  assert.equal(balloonPool.length, FESTIVAL_LIGHT_BUDGET, 'daylight balloons reuse the same shader light budget')
  assert.ok(balloonPool.some(light => light.color.getHex() === DAYLIGHT_LIGHT_COLOR && light.distance === DAYLIGHT_LIGHT_DISTANCE && light.intensity > 0), 'balloons use white light with a wider radius')
  assert.ok(balloonPool.filter(light => light.intensity === 0).length === FESTIVAL_LIGHT_BUDGET - 1, 'unused pool slots stay attached and dark')
  assert.ok(balloonPool.every(light => light.parent === balloonLights.group), 'balloon lighting never adds extra PointLights')
  console.log('PASS deterministic decision budget, camp route bound, cache refresh and detailed asset batching')
}

function testLocalParkingClaims(fixture: (count?: number) => GameState): void {
  const game = fixture(0), internal = game as any
  const logistics = game.snapshot.logistics
  logistics.roadCells = [{ x: 0, z: -18, elevation: 0, allowedDirections: null,
    blockedEdges: 0, speedLimit: 30, crosswalk: false }]
  internal.invalidateRoadGraph()
  logistics.parkingCells = Array.from({ length: 400 }, (_, i) => ({
    x: 5 + i % 15, z: -15 + Math.floor(i / 15), occupiedBy: null,
  }))
  logistics.parkingCells.push({ x: 1, z: -18, occupiedBy: null }, { x: -1, z: -18, occupiedBy: null })
  const car = (id: string) => ({ id, kind: 'visitorCar', state: 'driving',
    cell: { x: 0, z: -18 }, position: { x: 0, z: -18 }, parkingCell: null, route: [] })
  let approachChecks = 0
  const approaches = internal.getOpenParkingApproachRoads.bind(internal)
  internal.getOpenParkingApproachRoads = (...args: any[]) => { approachChecks++; return approaches(...args) }
  const first = car('first'), second = car('second')
  assert.ok(internal.claimAdjacentFreeParking(first))
  assert.deepEqual(first.parkingCell, { x: -1, z: -18 }, 'nearby bays preserve coordinate priority')
  assert.ok(approachChecks <= 4, 'hundreds of distant bays never trigger approach checks')
  assert.ok(internal.claimAdjacentFreeParking(second))
  assert.deepEqual(second.parkingCell, { x: 1, z: -18 }, 'reservations update the indexed objects immediately')
  assert.equal(internal.claimAdjacentFreeParking(car('third')), false)
  logistics.parkingCells.push({ x: 0, z: -17, occupiedBy: null })
  assert.ok(internal.claimAdjacentFreeParking(car('new-bay')), 'new bays invalidate the index')
  logistics.parkingCells = []
  assert.equal(internal.claimAdjacentFreeParking(car('removed')), false, 'removed bays leave no stale candidates')
  logistics.parkingCells = [{ x: 257, z: -18, occupiedBy: null }]
  assert.equal(internal.getAdjacentParkingCells({ x: 0, z: -18 }).length, 0,
    'packed-coordinate collisions must not produce distant candidates')
}
