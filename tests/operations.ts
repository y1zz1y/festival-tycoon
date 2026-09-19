import assert from 'node:assert/strict'
import { GameState, type GameSnapshot } from '../src/game/GameState'
import { applyGameCommand } from '../src/net/commands'
import { createScenarioEntrance } from '../src/game/scenario'
import { emptyStock, orderGoods, staffGateWorldPosition, staffGateYaw } from '../src/game/supplyChain'
import { GATE_EDGE_OFFSET, gateEdgeWorldPosition } from '../src/game/accessControl'
import { updateDepotCarriers } from '../src/game/depotCarriers'
import { createStaffMember } from '../src/game/staff'
import { StaffSimulation } from '../src/game/staffSimulation'
import { DeterministicRng } from '../src/game/rng'
import { cleanerCarryFactor } from '../src/game/festivalManagement'
import { zoneKey } from '../src/game/staffZones'
import {
  abandonVisitorCamp,
  decayUnclaimedInstallations,
  isCollectibleCamp,
} from '../src/game/camping'
import {
  denseClusterSize,
  neighborhoodPeople,
  panicSpreadChance,
  spontaneousPanicChance,
  visitorBubbleKind,
} from '../src/game/visitorBubbles'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import {
  cellKey as roadCellKey,
  chooseParkingDisembarkPath,
  collectEligibleBusWaiters,
  collectSeatedPassengerIds,
  compareBusBoardPriority,
  describeRoadVehicleActivity,
  describeRoadVehicleDestination,
  formatRoadVehicleInspectLoad,
  isVehicleReversing,
  isVisitorReadyToBoardBus,
} from '../src/game/logistics'
import { CrowdingSystem } from '../src/game/crowding'

export function testOperations(fixture:(count?:number)=>GameState):void {
  const planning=new GameState(), plan=planning.snapshot as GameSnapshot
  assert.equal(plan.parkOpen,false)
  const minute=plan.minute
  for(let n=0;n<20;n++) planning.tick(.1)
  assert.equal(plan.minute,minute,'festival clock stays still while planning')
  assert.equal(planning.setParkOpen(true).ok,false)
  plan.dayPlan.leadDays=2;plan.dayPlan.festivalDays=4
  assert.ok(planning.manageFestival({type:'start'}).ok)
  assert.equal(plan.dayPlan.leadDays,2);assert.equal(plan.dayPlan.festivalDays,4)
  planning.tick(.1);assert.ok(plan.minute>minute)

  const shopping=fixture(1), ss=shopping.snapshot as GameSnapshot
  assert.ok(shopping.place('food',5,-20).ok)
  const shop=ss.buildings.find(b=>b.kind==='food')!, buyer=ss.visitors[0]!
  ss.festival.infrastructure.shops[shop.id]={food:3,drinks:0,water:0,goods:0}
  assert.ok(shopping.placePathSegment(5, -19, 0).ok)
  assert.ok(shopping.placePathSegment(4, -19, 0).ok)
  buyer.targetId=shop.id;buyer.budget=100;buyer.state='using';buyer.cellX=5;buyer.cellZ=-19;buyer.cellElevation=0
  ;(shopping as any).finishInteraction(buyer)
  assert.ok(buyer.route.length>0,'buyer walks away before eating')
  assert.equal(buyer.state,'exploring');assert.equal(buyer.targetId,null)
  assert.equal(ss.festival.infrastructure.shops[shop.id]!.food,2)
  assert.ok(shopping.place('food',6,-20).ok)
  assert.ok(shopping.place('alcohol',7,-20).ok)
  shopping.updateBuildingPrice(shop.id, 17, true)
  assert.ok(
    ss.buildings.filter(b=>b.kind==='food').every(b=>b.price===17),
    'one price can be applied to all shops of the same type',
  )
  assert.notEqual(
    ss.buildings.find(b=>b.kind==='alcohol')!.price,
    17,
    'bulk price does not affect other shop types',
  )
  shopping.addDebugMoney()
  assert.ok(shopping.placePathSegment(5,-19,0,'queue').ok)
  const shopQueue=ss.buildings.find(b=>b.kind==='path'&&b.x===5&&b.z===-19)!
  assert.equal(shopQueue.queueDirection,2,'a queue path at a stand points toward its service counter')
  Object.assign(buyer,{targetId:shop.id,state:'seeking',route:[],cellX:5,cellZ:-19,cellElevation:0,x:5.5,z:-18.5})
  ;(shopping as any).visitorsAwaitingDecision.delete(buyer.id)
  ;(shopping as any).arriveOrDecide(buyer)
  assert.equal(buyer.state,'queuing','stand visitors use connected physical queue paths')
  assert.equal(SIMULATION_CONFIG.coasters.queueSlotsPerCell, 6, 'queue tiles hold six guests')
  assert.ok(SIMULATION_CONFIG.coasters.queueMovementPerMinute>=2,'queues rush forward when someone enters')
  for (let slot = 0; slot < 6; slot++) {
    const stand = (shopping as any).queueStandOffset(slot, { x: 0, z: 1 }, true)
    assert.ok(Math.abs(stand.x) <= 0.42 && Math.abs(stand.z) <= 0.42, 'six stand points stay on the tile')
    const stallStand = (shopping as any).queueStandOffset(slot, { x: 0, z: 1 }, true, true)
    assert.ok(stallStand.x < 0, 'stall wait stands use the inbound half')
    assert.ok(Math.abs(stallStand.x) <= 0.42 && Math.abs(stallStand.z) <= 0.42)
  }
  assert.equal(shopQueue.queueSplit, true, 'a queue attached to a stand is marked as split lanes')
  const legacySnapshot = JSON.parse(JSON.stringify(ss)) as GameSnapshot
  for (const building of legacySnapshot.buildings) delete building.queueSplit
  const restoredStallQueue = GameState.fromJSON(JSON.stringify(legacySnapshot))!
  assert.equal(
    restoredStallQueue.snapshot.buildings.find((building) => building.id === shopQueue.id)?.queueSplit,
    true,
    'old undivided stall queues normalize to split lanes without a rebuild',
  )

  const queueFlow = fixture(3)
  queueFlow.addDebugMoney()
  const queueFlowState = queueFlow.snapshot as GameSnapshot
  assert.ok(queueFlow.place('food', 8, -20).ok)
  const queueFlowShop = queueFlowState.buildings.find(b => b.kind === 'food')!
  ;(queueFlow as any).poweredBuildingIds.add(queueFlowShop.id)
  queueFlowState.dayPlan.offers.food.fill(true)
  queueFlowState.festival.infrastructure.shops[queueFlowShop.id] = {
    food: 20,
    drinks: 0,
    water: 0,
    goods: 0,
  }
  assert.ok(queueFlow.placePathSegment(8, -19, 0, 'queue').ok)
  assert.ok(queueFlow.placePathSegment(8, -18, 0, 'queue').ok)
  const [reserved, arrivedFirst, arrivedSecond] = queueFlowState.visitors
  Object.assign(reserved!, {
    targetId: queueFlowShop.id,
    state: 'seeking',
    route: [{ x: 8, z: -18, elevation: 0 }],
  })
  for (const visitor of [arrivedFirst!, arrivedSecond!]) {
    Object.assign(visitor, {
      targetId: queueFlowShop.id,
      state: 'queuing',
      route: [],
      cellX: 8,
      cellZ: -18,
      cellElevation: 0,
      x: 8.5,
      y: 0,
      z: -17.5,
    })
  }
  ;(queueFlow as any).facilityQueues.set(queueFlowShop.id, [
    reserved!.id,
    arrivedFirst!.id,
    arrivedSecond!.id,
  ])
  ;(queueFlow as any).updateFacilityQueues(0.1)
  assert.deepEqual(
    (queueFlow as any).facilityQueues.get(queueFlowShop.id),
    [arrivedFirst!.id, arrivedSecond!.id, reserved!.id],
    'guests already at a queue stand ahead of earlier reservations that are still walking',
  )
  assert.ok(
    arrivedFirst!.z < -17.5 && arrivedSecond!.z < -17.5,
    'arrived guests advance continuously instead of waiting for a distant reservation',
  )

  const sideShop = fixture(1)
  sideShop.addDebugMoney()
  const sideState = sideShop.snapshot as GameSnapshot
  assert.ok(sideShop.place('food', 5, -20).ok)
  const sideStand = sideState.buildings.find((building) => building.kind === 'food')!
  ;(sideShop as any).poweredBuildingIds.add(sideStand.id)
  sideState.dayPlan.offers.food.fill(true)
  assert.equal(sideStand.rotation, 0, 'the default counter faces +Z')
  const sideAccesses = (sideShop as any).getFacilityAccessCells(sideStand) as Array<{
    x: number
    z: number
  }>
  assert.ok(
    !sideAccesses.some((cell) => cell.x === 4 && cell.z === -20),
    'customers cannot buy from the side',
  )
  assert.equal(
    sideAccesses.some((cell) => cell.x === 5 && cell.z === -19),
    false,
    'the empty facing tile is not required for service',
  )
  sideState.festival.infrastructure.shops[sideStand.id] = { food: 5, drinks: 0, water: 0, goods: 0 }
  const guest = sideState.visitors[0]!
  Object.assign(guest, {
    cellX: 4,
    cellZ: -20,
    cellElevation: 0,
    x: 4.5,
    z: -19.5,
    needs: { ...guest.needs, hunger: 10 },
  })
  const reached = (sideShop as any).findReachableFacility(guest, 'food')
  assert.equal(reached, null, 'customers need a connected front counter')
  sideState.festival.infrastructure.depots.push({
    id: 'side-pad',
    x: 1,
    z: -20,
    role: 'delivery',
    distribution: 'shops',
    stock: { food: 80, drinks: 0, water: 0, goods: 0 },
    minimum: { food: 80, drinks: 0, water: 0, goods: 0 },
  })
  assert.ok(
    sideShop.manageFestival({
      type: 'depotSettings',
      depotId: 'side-pad',
      distribution: 'shops',
      workers: 1,
    }).ok,
  )
  const sideWalk = (start: unknown, goals: unknown) =>
    (sideShop as any).findPath(start, goals, false, false, false, false, true, undefined, true)
  for (let n = 0; n < 200; n += 1) {
    updateDepotCarriers(sideState, 1, sideWalk, (from, to) =>
      (sideShop as any).canCarrierStep(from, to),
    )
  }
  assert.ok(
    (sideState.festival.infrastructure.shops[sideStand.id]?.food ?? 0) > 5,
    'carriers restock a stall from a side path',
  )
  assert.ok(sideShop.placePathSegment(4, -20, 0, 'queue').ok)
  const sideQueue = sideState.buildings.find(
    (building) => building.kind === 'path' && building.x === 4 && building.z === -20,
  )!
  assert.equal(sideQueue.queueDirection, undefined, 'a side queue does not connect to the counter')
  assert.deepEqual((sideShop as any).getBuildingQueueCells(sideStand), [])
  assert.ok(sideShop.placePathSegment(4, -20, 0, 'normal').ok)
  assert.ok(sideShop.placePathSegment(4, -19, 0).ok)
  assert.ok(sideShop.placePathSegment(5, -19, 0).ok)
  assert.deepEqual((sideShop as any).getFacilityAccessCells(sideStand), [{ x: 5, z: -19, elevation: 0 }])
  assert.ok((sideShop as any).findReachableFacility(guest, 'food'))
  sideState.festival.infrastructure.shops[sideStand.id]!.food = 0
  assert.equal((sideShop as any).findReachableFacility(guest, 'food'), null,
    'an empty nearby shop is excluded from destination selection')
  assert.ok(sideShop.place('food', 6, -20).ok)
  const alternate = sideState.buildings.find(building => building.kind === 'food' && building.x === 6)!
  assert.ok(sideShop.placePathSegment(6, -19, 0).ok)
  ;(sideShop as any).poweredBuildingIds.add(alternate.id)
  sideState.festival.infrastructure.shops[alternate.id] = { food: 5, drinks: 0, water: 0, goods: 0 }
  assert.equal((sideShop as any).findReachableFacility(guest, 'food')?.building.id, alternate.id,
    'guests route to the nearby stocked alternative instead of revisiting the empty counter')

  const rearStock=fixture(0)
  rearStock.addDebugMoney()
  const rear=rearStock.snapshot as GameSnapshot
  assert.ok(rearStock.place('food',7,-18).ok)
  const rearStand=rear.buildings.find(building=>building.kind==='food')!
  assert.ok(rearStock.placePathSegment(5,-19,0).ok)
  assert.ok(rearStock.placePathSegment(6,-19,0).ok)
  assert.ok(rearStock.placePathSegment(7,-19,0).ok)
  rear.festival.infrastructure.depots.push({
    id:'rear-pad',x:1,z:-20,role:'delivery',distribution:'shops',
    stock:{food:80,drinks:0,water:0,goods:0},minimum:{food:80,drinks:0,water:0,goods:0},
  })
  assert.ok(rearStock.manageFestival({type:'depotSettings',depotId:'rear-pad',distribution:'shops',workers:1}).ok)
  const rearWalk=(start:any,goals:any)=>(rearStock as any).findPath(start,goals,false,false,false,false,true,undefined,true)
  for (let n=0;n<200;n+=1) updateDepotCarriers(rear,1,rearWalk,(from,to)=>(rearStock as any).canCarrierStep(from,to))
  assert.ok(
    (rear.festival.infrastructure.shops[rearStand.id]?.food??0)>0,
    'carriers restock a stall from the back when only that side has a path',
  )

  const snake = fixture(1), snakeState = snake.snapshot as GameSnapshot
  snake.addDebugMoney()
  assert.ok(snake.place('food', 8, -20).ok)
  const snakeShop = snakeState.buildings.find(b => b.kind === 'food')!
  ;(snake as any).poweredBuildingIds.add(snakeShop.id)
  snakeState.festival.infrastructure.shops[snakeShop.id] = { food: 2, drinks: 0, water: 0, goods: 0 }
  assert.ok(snake.placePathSegment(8, -19, 0, 'queue').ok)
  assert.ok(snake.placePathSegment(8, -18, 0, 'queue').ok)
  assert.ok(snake.placePathSegment(9, -18, 0, 'queue').ok)
  assert.ok(snake.placePathSegment(9, -19, 0, 'queue').ok)
  assert.ok(snake.placePathSegment(10, -19, 0).ok)
  const snakeCells = (snake as any).getBuildingQueueCells(snakeShop) as Array<{ x: number; z: number }>
  assert.deepEqual(
    snakeCells.map(cell => [cell.x, cell.z]),
    [[8, -19], [8, -18], [9, -18], [9, -19]],
    'a snaking queue follows build order instead of cutting across adjacent tiles',
  )
  const shortcut = (snake as any).findPath({ x: 9, z: -19, elevation: 0 }, [{ x: 8, z: -19, elevation: 0 }], true)
  assert.ok(shortcut && shortcut.length >= 3, 'queue pathfinding cannot skip along a side-by-side snake')
  assert.ok(
    shortcut.some((cell: { x: number; z: number }) => cell.x === 8 && cell.z === -18),
    'the only way forward is the built chain',
  )
  const diner = snakeState.visitors[0]!
  Object.assign(diner, {
    targetId: snakeShop.id,
    state: 'using',
    budget: 100,
    cellX: 8,
    cellZ: -19,
    cellElevation: 0,
    x: 8.5,
    z: -18.5,
    route: [],
  })
  ;(snake as any).finishInteraction(diner)
  assert.deepEqual(
    diner.route.map((cell: { x: number; z: number }) => [cell.x, cell.z]),
    [[8, -18], [9, -18], [9, -19], [10, -19]],
    'after buying food guests walk the queue back to the entrance',
  )
  assert.match(diner.thought, /Schlange zurück/)
  assert.ok(
    diner.tileOffsetX < 0.5,
    'after service guests use the outbound (right) half when looking toward the stall',
  )
  const waiterOnInbound = {
    ...diner,
    id: 'lane-in',
    state: 'queuing' as const,
    cellX: 8,
    cellZ: -18,
    cellElevation: 0,
    x: 8.5 + 0.22,
    z: -17.5,
  }
  const leaverOnOutbound = {
    ...diner,
    id: 'lane-out',
    state: 'exploring' as const,
    cellX: 8,
    cellZ: -18,
    cellElevation: 0,
    x: 8.5 - 0.22,
    z: -17.5,
  }
  const inboundKey = (snake as any).visitorOccupancyKey(waiterOnInbound)
  const outboundKey = (snake as any).visitorOccupancyKey(leaverOnOutbound)
  assert.notEqual(
    inboundKey,
    outboundKey,
    'inbound waiters and outbound leavers do not share stall-queue occupancy',
  )
  diner.crowding = 80
  diner.walkSpeed = 1
  diner.emotion = 'neutral'
  diner.alcoholLevel = 0
  diner.movementBoostMinutes = 0
  diner.streakingMinutes = 0
  const returnSpeed = (snake as any).visitorTravelSpeed(diner) as number
  ;(snake as any).stallQueueReturnIds.delete(diner.id)
  const crowdedSpeed = (snake as any).visitorTravelSpeed(diner) as number
  ;(snake as any).stallQueueReturnIds.add(diner.id)
  assert.ok(
    returnSpeed > crowdedSpeed * 1.4,
    'the stall return lane keeps normal walking speed despite queue crowding',
  )
  Object.assign(diner, { x: 8.5, z: -18.5, cellX: 8, cellZ: -19, cellElevation: 0, y: 0 })
  ;(snake as any).moveVisitor(diner, 20, false)
  assert.equal((snake as any).stallQueueReturnIds.has(diner.id), false)
  assert.ok(
    diner.route.length > 0 ||
      diner.state === 'seeking' ||
      diner.state === 'using' ||
      diner.state === 'socializing' ||
      diner.state === 'relaxing' ||
      diner.state === 'bench-resting' ||
      diner.state === 'leaving',
    'after leaving the return lane guests immediately pick their next destination',
  )

  snakeState.festival.infrastructure.shops[snakeShop.id] = { food: 0, drinks: 0, water: 0, goods: 0 }
  const waiter = snakeState.visitors[0]!
  Object.assign(waiter, {
    targetId: snakeShop.id,
    state: 'queuing',
    thought: 'Ich stehe an.',
    interactionRemaining: 0,
    cellX: 8,
    cellZ: -18,
    cellElevation: 0,
    x: 8.5,
    z: -17.5,
    route: [],
  })
  ;(snake as any).facilityQueues.set(snakeShop.id, [waiter.id])
  ;(snake as any).updateFacilityQueues(0.1)
  assert.equal(waiter.state, 'queuing', 'an empty stand makes guests wait briefly')
  assert.ok(waiter.interactionRemaining < 0)
  for (let i = 0; i < 15 && waiter.state === 'queuing'; i++) {
    waiter.thought = 'Ein anderer Gedanke darf die Wartezeit nicht verlängern.'
    ;(snake as any).updateFacilityQueues(0.1)
  }
  assert.equal(waiter.state, 'exploring')
  assert.match(waiter.thought, /Ausverkauft/)
  assert.deepEqual(
    waiter.route.map((cell: { x: number; z: number }) => [cell.x, cell.z]),
    [[9, -18], [9, -19], [10, -19]],
    'they leave an empty stand by walking the queue backwards',
  )
  Object.assign(waiter, {
    targetId: snakeShop.id,
    state: 'queuing',
    cellX: 8,
    cellZ: -18,
    cellElevation: 0,
    x: 8.5,
    z: -17.5,
    route: [],
  })
  const midQueueNeighbors = (
    (snake as any).getPedestrianNeighbors(
      { x: 8, z: -18, elevation: 0 },
      { allowQueue: false, allowGrass: true },
    ) as Array<{ x: number; z: number }>
  ).map((cell) => [cell.x, cell.z])
  assert.deepEqual(
    midQueueNeighbors,
    [[9, -18]],
    'from mid-queue the only way out is backwards',
  )
  ;(snake as any).beginVisitorDeparture(waiter)
  assert.ok(waiter.route.length > 0, 'a guest who wants to leave can walk out of the queue')
  assert.deepEqual(
    [waiter.route[0]!.x, waiter.route[0]!.z],
    [9, -18],
    'leaving a queue starts by walking it backwards, not sideways',
  )

  const gates=fixture(0), from={x:2,z:-20,elevation:0}, gate={x:3,z:-20,elevation:0}
  const northOfGate={x:3,z:-19,elevation:0}
  const alongGate={x:4,z:-20,elevation:0}
  assert.ok((gates as any).findPath(from,[gate]))
  assert.ok(gates.manageFestival({type:'staffGate',...gate}).ok)
  assert.ok((gates as any).findPath(from,[gate]),'guests can walk onto a directed staff-gate tile from an open edge')
  assert.ok((gates as any).findPath(from,[alongGate]),'guests can walk the rest of the tile and other edges')
  assert.ok((gates as any).findPath(from,[gate],false,false,false,false,false,undefined,true),'staff can enter the same gate')
  const guestFromGate=((gates as any).getPedestrianNeighbors(gate,{}) as Array<{x:number;z:number}>)
    .map(cell=>[cell.x,cell.z])
  assert.ok(!guestFromGate.some(([x,z])=>x===3&&z===-19),'visitors cannot cross the painted staff-gate edge')
  assert.ok(guestFromGate.some(([x,z])=>x===2&&z===-20),'the ungated sides of the staff-gate tile stay walkable')
  const staffFromGate=((gates as any).getPedestrianNeighbors(gate,{allowStaff:true}) as Array<{x:number;z:number}>)
    .map(cell=>[cell.x,cell.z])
  assert.ok(staffFromGate.some(([x,z])=>x===3&&z===-19),'staff can pass the painted staff-gate edge')
  assert.ok((gates as any).findPath(northOfGate,[gate]),'guests may leave through the staff gate the other way')
  assert.equal((gates as any).isPedestrianSolidAt(gate.x,gate.z,0),false,'a staff gate does not lock the whole cell')
  const defaultStaffPath=gates.snapshot.buildings.find(b=>b.kind==='path'&&b.x===3&&b.z===-20)!
  assert.equal(defaultStaffPath.staffGateDirection,0,'new staff gates snap to the build-rotation edge')
  assert.deepEqual(
    staffGateWorldPosition(defaultStaffPath),
    gateEdgeWorldPosition(3,-20,0,0),
    'staff gate mesh sits on the outgoing rim like a Personentor',
  )
  assert.equal(staffGateYaw(defaultStaffPath),0)
  const edgeGates=fixture(0)
  assert.ok(edgeGates.manageFestival({type:'staffGate',x:3,z:-20,elevation:0,direction:2}).ok)
  const westStaffPath=edgeGates.snapshot.buildings.find(b=>b.kind==='path'&&b.x===3&&b.z===-20)!
  assert.equal(westStaffPath.staffGateDirection,2)
  assert.deepEqual(staffGateWorldPosition(westStaffPath),gateEdgeWorldPosition(3,-20,0,2))
  assert.equal(staffGateYaw(westStaffPath),Math.PI)
  assert.equal(staffGateWorldPosition(westStaffPath).z,-19.5-GATE_EDGE_OFFSET)
  assert.ok((edgeGates as any).findPath(from,[gate]),'edge-snapped staff gates do not lock the whole tile')
  const southOfWest={x:3,z:-21,elevation:0}
  const guestFromWestGate=((edgeGates as any).getPedestrianNeighbors(gate,{}) as Array<{x:number;z:number}>)
    .map(cell=>[cell.x,cell.z])
  assert.ok(!guestFromWestGate.some(([x,z])=>x===3&&z===-21),'direction 2 blocks only the painted -Z edge')
  assert.ok((edgeGates as any).findPath(southOfWest,[gate]),'guests may still step onto the tile from the open side')
  assert.ok((edgeGates as any).findPath(gate,[southOfWest],false,false,false,false,false,undefined,true),'staff can cross a rotated staff gate')
  assert.ok(!edgeGates.manageFestival({type:'staffGate',x:10,z:-20,elevation:0,direction:1}).ok,'staff gates need a path')
  assert.ok(edgeGates.manageFestival({type:'staffGate',x:3,z:-20,elevation:0,direction:1}).ok)
  assert.equal(westStaffPath.staffOnly,false)
  assert.equal(westStaffPath.staffGateDirection,undefined)
  const legacyGates=fixture(0)
  const legacyPath=legacyGates.snapshot.buildings.find(b=>b.kind==='path'&&b.x===3&&b.z===-20)!
  legacyPath.staffOnly=true
  const reloadedLegacy=new GameState(structuredClone(legacyGates.snapshot))
  const loadedLegacy=reloadedLegacy.snapshot.buildings.find(b=>b.kind==='path'&&b.x===3&&b.z===-20)!
  assert.equal(loadedLegacy.staffOnly,true)
  assert.equal(loadedLegacy.staffGateDirection,undefined,'old centered staff gates keep their save position')
  assert.deepEqual(staffGateWorldPosition(loadedLegacy),{x:3.5,y:0,z:-19.5})
  assert.equal(staffGateYaw({rotation:1}),Math.PI/2)
  assert.equal((reloadedLegacy as any).findPath(from,[gate]),null,'legacy staff-only tiles keep blocking guests')
  const botGates=fixture(0)
  botGates.addDebugMoney()
  for (const x of [2,3,4]) {
    assert.ok(botGates.manageFestival({type:'staffGate',x,z:-20,elevation:0}).ok)
  }
  const southOfGate={x:3,z:-21,elevation:0}
  const staffSide={x:3,z:-19,elevation:0}
  const staffGateCell={x:3,z:-20,elevation:0}
  assert.ok(
    (botGates as any).findPath(southOfGate,[staffGateCell]),
    'guests can enter a directed Personaleingang tile from an open edge',
  )
  const guestAround=(botGates as any).findPath(southOfGate,[staffSide]) as Array<{x:number;z:number}> | null
  if (guestAround) {
    const steps=[[southOfGate.x,southOfGate.z],...guestAround.map(cell=>[cell.x,cell.z])]
    for (let index=1;index<steps.length;index+=1) {
      const [fromX,fromZ]=steps[index-1]!
      const [toX,toZ]=steps[index]!
      assert.ok(
        !(fromZ===-20 && toZ===-19 && toX===fromX && fromX>=2 && fromX<=4),
        'guest detours must not cross a painted staff-gate edge',
      )
    }
  }
  const guestNeighbors=((botGates as any).getPedestrianNeighbors(southOfGate,{}) as Array<{x:number;z:number}>)
    .map(cell=>[cell.x,cell.z])
  assert.ok(guestNeighbors.some(([x,z])=>x===3&&z===-20),'guest neighbors include the staff-gate tile from the open side')
  const blockedNeighbors=((botGates as any).getPedestrianNeighbors(staffGateCell,{}) as Array<{x:number;z:number}>)
    .map(cell=>[cell.x,cell.z])
  assert.ok(!blockedNeighbors.some(([x,z])=>x===3&&z===-19),'guests still cannot leave through the painted edge')
  const staffNeighbors=((botGates as any).getPedestrianNeighbors(southOfGate,{allowStaff:true}) as Array<{x:number;z:number}>)
    .map(cell=>[cell.x,cell.z])
  assert.ok(staffNeighbors.some(([x,z])=>x===3&&z===-20),'staff neighbors still include the staff gate')
  const gateSweeper={
    id:'gate-sweeper',kind:'sweeper' as const,position:{x:3,z:-21},cell:{x:3,z:-21},
    route:[],state:'idle' as const,speed:0,passengerIds:[],groupId:null,parkingCell:null,
    target:null,facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  const throughGate=(botGates as any).findSweeperRoute(gateSweeper,[northOfGate]) as Array<{x:number;z:number}> | null
  assert.ok(throughGate,'sweepers can route through Personaleingang')
  assert.ok(
    throughGate.some(cell=>cell.x===3&&cell.z===-20),
    'the sweeper route crosses the staff-only tile instead of giving up',
  )
  botGates.snapshot.incidents.push({
    id:'staff-side-litter',kind:'litter',x:3,z:-19,elevation:0,severity:2,ageMinutes:0,
  })
  botGates.snapshot.logistics.roadVehicles.push(gateSweeper)
  for (let n=0;n<40;n+=1) (botGates as any).updateLogistics(2)
  assert.ok(
    gateSweeper.cell && gateSweeper.cell.z>=-20,
    'the sweeper drives through the staff gate',
  )
  assert.equal(
    botGates.snapshot.incidents.some(incident=>incident.id==='staff-side-litter' && incident.severity>0),
    false,
    'the sweeper cleans dirt beyond the Personaleingang',
  )
  gates.addDebugMoney()
  assert.ok(gates.place('securityGate',4,-20).ok)
  const admission=gates.snapshot.buildings.find(b=>b.kind==='securityGate')!
  assert.ok(gates.updateSecurityGate(admission.id,{flowShare:.35}).ok)
  assert.equal(admission.securityConfig?.flowShare,.35,'festival entrances store their visitor-flow share')

  const game=fixture(0), s=game.snapshot as GameSnapshot, i=s.festival.infrastructure
  game.addDebugMoney()
  const source={id:'receiving',x:1,z:-20,role:'delivery' as const,distribution:'relay' as const,stock:{food:200,drinks:0,water:0,goods:0},minimum:emptyStock()}
  const depot={id:'store',x:1,z:-16,role:'storage' as const,distribution:'shops' as const,stock:emptyStock(),minimum:{food:80,drinks:0,water:0,goods:0}}
  i.depots.push(source,depot)
  assert.ok(game.place('food',5,-16).ok)
  const stand=s.buildings.find(b=>b.kind==='food')!
  assert.ok(game.manageFestival({type:'depotSettings',depotId:depot.id,distribution:'shops',workers:2}).ok)
  const blockedCopy = new GameState(structuredClone(s)), blockedState=blockedCopy.snapshot as GameSnapshot
  blockedState.festival.infrastructure.depots[0]!.role='storage'
  blockedState.festival.infrastructure.depots[0]!.distribution='shops'
  for(let n=0;n<30;n++) updateDepotCarriers(blockedState,1,(a,b)=>(blockedCopy as any).findPath(a,b),()=>true)
  assert.equal(blockedState.festival.infrastructure.depots[1]!.stock.food,0,'shops-only depot never serves as another depot source')
  blockedState.festival.infrastructure.depots[0]!.distribution='relay'
  for(let n=0;n<180;n++) updateDepotCarriers(blockedState,1,(a,b)=>(blockedCopy as any).findPath(a,b),()=>true)
  assert.ok(blockedState.festival.infrastructure.depots[1]!.stock.food>0,'relay depot allows physical replenishment')
  const walk=(a:any,b:any)=>(game as any).findPath(a,b,false,false,false,false,false,undefined,true)
  const update=()=>updateDepotCarriers(s,1,walk,()=>true)
  update()
  assert.equal(source.stock.food,200,'dispatch reserves goods but does not take them before pickup')
  assert.ok(i.routes.every(r=>r.cargo===0))
  for(let n=0;n<180;n++) {
    update()
    const total=i.depots.reduce((sum,d)=>sum+d.stock.food,0)+Object.values(i.shops).reduce((sum,p)=>sum+p.food,0)+i.routes.reduce((sum,r)=>sum+(r.kind==='food'?r.cargo:0),0)
    assert.equal(total,200,'physical automatic transports conserve every unit')
  }
  assert.equal(i.shops[stand.id]?.food,40,'workers automatically supply a stand')
  assert.equal(depot.stock.food,80,'workers restore depot minimum without over-delivery')
  assert.equal(source.stock.food,80)
  const bounce=fixture(0), bounceState=bounce.snapshot as GameSnapshot, bounceInfra=bounceState.festival.infrastructure
  bounce.addDebugMoney()
  const padA={id:'pad-a',x:1,z:-20,role:'delivery' as const,distribution:'shops' as const,stock:{food:200,drinks:0,water:0,goods:0},minimum:{food:200,drinks:0,water:0,goods:0}}
  const padB={id:'pad-b',x:5,z:-20,role:'delivery' as const,distribution:'shops' as const,stock:emptyStock(),minimum:{food:200,drinks:0,water:0,goods:0}}
  bounceInfra.depots.push(padA,padB)
  assert.ok(bounce.place('food',5,-16).ok)
  const bounceStand=bounceState.buildings.find(b=>b.kind==='food')!
  assert.ok(bounce.manageFestival({type:'depotSettings',depotId:padA.id,distribution:'shops',workers:1}).ok)
  assert.ok(bounce.manageFestival({type:'depotSettings',depotId:padB.id,distribution:'shops',workers:1}).ok)
  const bounceWalk=(a:any,goals:any)=>(bounce as any).findPath(a,goals,false,false,false,false,false,undefined,true)
  for(let n=0;n<180;n++) updateDepotCarriers(bounceState,1,bounceWalk,()=>true)
  assert.equal(padB.stock.food,0,'delivery pads do not shuttle goods between receiving bays')
  assert.equal(bounceInfra.shops[bounceStand.id]?.food,40,'delivery workers take surplus to shops')

  assert.ok(orderGoods(s,'food',50,0,depot.id).ok)
  assert.equal(s.festival.deliveries.at(-1)?.depotId,source.id,'trucks deliver to the designated receiving point')
  const clone=GameState.fromJSON(JSON.stringify(s))!
  assert.deepEqual(clone.snapshot.festival.infrastructure,i,'worker jobs and stock survive save/load')

  const cleaner=createStaffMember('cleaner-1','cleaner',{x:0,z:0,elevation:0})
  const staff=new StaffSimulation(), bin={id:'bin-1',x:1,z:0,elevation:0,stored:0}, dump={x:2,z:0,elevation:0,stored:0}
  const context:any={staff:[cleaner],visitors:[],incidents:[],medicalCells:[],wasteDumps:[dump],wasteBins:[bin],securityGates:[],rng:new DeterministicRng(1),findPath:(_a:any,goals:any[])=>goals.map(p=>({...p})),pathNeighbors:()=>[],reserveBed:()=>null,removeIncident:()=>{},depositWaste:(_x:number,_z:number,n:number)=>{dump.stored+=n;return n},emptyBin:(_id:string,n:number)=>{const amount=Math.min(n,bin.stored);bin.stored-=amount;return amount},fillBin:(_id:string,n:number)=>{bin.stored+=n;return n}}
  cleaner.carryingWaste=4;cleaner.wasteFromBin=false
  ;(staff as any).sendCleanerToDump(cleaner,context)
  assert.equal(cleaner.targetId,'deposit-bin:bin-1','collected litter goes to nearest reachable bin')
  cleaner.route=[];(staff as any).finishArrival(cleaner,context)
  assert.equal(bin.stored,4);assert.equal(cleaner.carryingWaste,0)
  cleaner.targetId=bin.id;cleaner.state='working'
  ;(staff as any).finishWork(cleaner,context)
  assert.equal(bin.stored,0);assert.equal(cleaner.carryingWaste,4);assert.equal(cleaner.wasteFromBin,true)
  cleaner.route=[];(staff as any).finishArrival(cleaner,context)
  assert.equal(dump.stored,4,'bin contents are transported to waste disposal without disappearing')
  for (const workZones of [undefined, [], [zoneKey(1,0), zoneKey(3,0)]]) {
    const worker=createStaffMember('free-cleaner','cleaner',{x:0,z:0,elevation:0})
    worker.workZones=workZones
    const blocked={id:'blocked-bin',x:1,z:0,elevation:0,stored:SIMULATION_CONFIG.waste.binCapacity}
    const reachable={id:'reachable-bin',x:3,z:0,elevation:0,stored:SIMULATION_CONFIG.waste.binCapacity}
    staff.update({...context,staff:[worker],wasteBins:[blocked,reachable],
      findPath:(_a:any,goals:any[])=>goals[0].x===1?null:goals},.1)
    assert.equal(worker.targetId,reachable.id,'workers find reachable work with no zones, empty zones, or explicit zones')
  }
  const stranded=createStaffMember('patroller','cleaner',{x:0,z:0,elevation:0})
  staff.update({...context,staff:[stranded],wasteBins:[{...bin,stored:5}],
    findPath:()=>null,pathNeighbors:()=>[{x:0,z:1,elevation:0}]},.1)
  assert.equal(stranded.targetId,null)
  assert.equal(stranded.route.length,1,'unreachable work does not prevent patrol')
  const restricted=createStaffMember('restricted','cleaner',{x:0,z:0,elevation:0})
  restricted.workZones=[zoneKey(9,9)]
  staff.update({...context,staff:[restricted],wasteBins:[{...bin,stored:5}]},.1)
  assert.equal(restricted.targetId,null,'assigned zones still restrict work')
  const picker=createStaffMember('priority-cleaner','cleaner',{x:0,z:0,elevation:0})
  const nearly={id:'near-bin',x:1,z:0,elevation:0,stored:4}
  const overflowing={id:'full-bin',x:8,z:0,elevation:0,stored:SIMULATION_CONFIG.waste.binCapacity}
  staff.update({
    ...context,
    staff:[picker],
    wasteBins:[nearly,overflowing],
    incidents:[{id:'nearby-litter',kind:'litter',x:0,z:1,elevation:0,severity:1,ageMinutes:0}],
  },.1)
  assert.equal(picker.targetId,overflowing.id,'full bins are emptied before nearer half-full bins or litter')
  const idle=createStaffMember('idle-cleaner','cleaner',{x:0,z:0,elevation:0})
  idle.workZones=[zoneKey(1,0)]
  const halfFull={id:'half-bin',x:1,z:0,elevation:0,stored:Math.ceil(SIMULATION_CONFIG.waste.binCapacity/2)}
  staff.update({...context,staff:[idle],wasteBins:[halfFull],incidents:[]},.1)
  assert.equal(idle.targetId,halfFull.id,'idle cleaners empty half-full bins inside their zone')
  const crumb=createStaffMember('crumb-cleaner','cleaner',{x:0,z:0,elevation:0})
  const belowIdle={id:'crumb-bin',x:1,z:0,elevation:0,stored:SIMULATION_CONFIG.waste.cleanerIdleEmptyFill-1}
  staff.update({...context,staff:[crumb],wasteBins:[belowIdle],incidents:[]},.1)
  assert.equal(crumb.targetId,null,'bins below the idle empty fill stay untouched even when idle')
  const litterFirst=createStaffMember('litter-first','cleaner',{x:0,z:0,elevation:0})
  const barely={id:'barely-bin',x:1,z:0,elevation:0,stored:SIMULATION_CONFIG.waste.cleanerIdleEmptyFill}
  staff.update({
    ...context,
    staff:[litterFirst],
    wasteBins:[barely],
    incidents:[{id:'ground-litter',kind:'litter',x:0,z:1,elevation:0,severity:1,ageMinutes:0}],
  },.1)
  assert.equal(litterFirst.targetId,'ground-litter','litter stays ahead of a barely used bin')
  const hauled=createStaffMember('bin-hauler','cleaner',{x:0,z:0,elevation:0})
  const fullBin={id:'haul-bin',x:1,z:0,elevation:0,stored:SIMULATION_CONFIG.waste.binCapacity}
  const haulDump={x:2,z:0,elevation:0,stored:0}
  const haulContext={
    ...context,
    staff:[hauled],
    wasteBins:[fullBin],
    wasteDumps:[haulDump],
    emptyBin:(_id:string,n:number)=>{const amount=Math.min(n,fullBin.stored);fullBin.stored-=amount;return amount},
    depositWaste:(_x:number,_z:number,n:number)=>{haulDump.stored+=n;return n},
  }
  hauled.targetId=fullBin.id
  hauled.state='working'
  ;(staff as any).finishWork(hauled,haulContext)
  assert.equal(fullBin.stored,0,'a cleaner empties the whole bin in one lift')
  assert.equal(hauled.carryingWaste,SIMULATION_CONFIG.waste.binCapacity)
  assert.equal(hauled.wasteFromBin,true)
  assert.ok(String(hauled.targetId).startsWith('dump:'),'the full bin goes to the dump, not back into another bin')
  hauled.route=[]
  ;(staff as any).finishArrival(hauled,haulContext)
  assert.equal(haulDump.stored,SIMULATION_CONFIG.waste.binCapacity)
  assert.equal(hauled.carryingWaste,0)
  const dropper=createStaffMember('dropper','cleaner',{x:0,z:0,elevation:0})
  const roomy={id:'roomy-bin',x:1,z:0,elevation:0,stored:2}
  const street=[{id:'street-litter',kind:'litter' as const,x:0,z:1,elevation:0,severity:1,ageMinutes:0}]
  dropper.targetId='street-litter'
  dropper.state='working'
  ;(staff as any).finishWork(dropper,{
    ...context,
    staff:[dropper],
    wasteBins:[roomy],
    incidents:street,
    removeIncident:(id:string)=>{const i=street.findIndex(item=>item.id===id);if(i>=0)street.splice(i,1)},
    fillBin:(_id:string,n:number)=>{const added=Math.min(n,SIMULATION_CONFIG.waste.binCapacity-roomy.stored);roomy.stored+=added;return added},
  })
  assert.equal(dropper.targetId,'deposit-bin:roomy-bin','litter is dropped into a bin that still has room')
  s.staff.push(cleaner)
  assert.ok(game.manageFestival({type:'staffArea',staffId:cleaner.id,from:{x:2,z:-20},to:{x:4,z:-16}}).ok)
  assert.deepEqual(cleaner.workArea,{minX:2,maxX:4,minZ:-20,maxZ:-16})
  assert.ok(game.manageFestival({type:'staffArea',staffId:cleaner.id,from:null,to:null}).ok)
  assert.equal(cleaner.workArea,null)

  const patientAt = (id: string, cellX: number, cellZ: number, extra: Record<string, unknown> = {}) => ({
    id,
    state: 'injured',
    x: cellX + 0.5,
    y: 0,
    z: cellZ + 0.5,
    cellX,
    cellZ,
    cellElevation: 0,
    route: [],
    medicalCell: null,
    medicalSlot: null,
    thought: '',
    nausea: 0,
    injuryVehicleId: null,
    rescueVehicleId: null,
    ...extra,
  })
  const medicContext = {
    ...context,
    findPath: (_start: { x: number; z: number }, goals: Array<{ x: number; z: number }>) =>
      goals.map((goal) => ({ ...goal, elevation: 0 })),
  }
  const nearMedic = createStaffMember('medic-near', 'medic', { x: 1, z: 0, elevation: 0 })
  const farMedic = createStaffMember('medic-far', 'medic', { x: 20, z: 0, elevation: 0 })
  const busyMedic = createStaffMember('medic-busy', 'medic', { x: 0, z: 0, elevation: 0 })
  busyMedic.state = 'carrying'
  busyMedic.targetId = 'other-patient'
  busyMedic.route = [{ x: 0, z: 4, elevation: 0 }]
  const injury = patientAt('injured-guest', 2, 0)
  staff.update({
    ...medicContext,
    staff: [farMedic, busyMedic, nearMedic],
    visitors: [injury, patientAt('other-patient', 0, 4, { state: 'medical-transport' })],
  }, 0.1)
  assert.equal(nearMedic.targetId, 'injured-guest', 'the nearest idle medic takes the injury')
  assert.equal(nearMedic.state, 'responding')
  assert.equal(farMedic.targetId, null, 'a farther idle medic stays free')
  assert.equal(busyMedic.targetId, 'other-patient', 'a medic already carrying is not reassigned')
  const blockedNear = createStaffMember('medic-blocked', 'medic', { x: 1, z: 0, elevation: 0 })
  const reachableFar = createStaffMember('medic-reachable', 'medic', { x: 12, z: 0, elevation: 0 })
  staff.update({
    ...medicContext,
    staff: [reachableFar, blockedNear],
    visitors: [patientAt('fenced-guest', 2, 0)],
    findPath: (start: { x: number }, goals: Array<{ x: number; z: number }>) =>
      start.x === 1 ? null : goals.map((goal) => ({ ...goal, elevation: 0 })),
  }, 0.1)
  assert.equal(reachableFar.targetId, 'fenced-guest', 'an unreachable closer medic is skipped for a free reachable one')
  assert.equal(blockedNear.targetId, null)
  const chooser = createStaffMember('medic-chooser', 'medic', { x: 0, z: 0, elevation: 0 })
  staff.update({
    ...medicContext,
    staff: [chooser],
    visitors: [patientAt('far-injury', 18, 0), patientAt('near-injury', 3, 0)],
  }, 0.1)
  assert.equal(chooser.targetId, 'near-injury', 'a free medic picks the nearest unclaimed patient, not the first in list')
  const cabinMedic = createStaffMember('medic-cabin', 'medic', { x: 1, z: 0, elevation: 0 })
  staff.update({
    ...medicContext,
    staff: [cabinMedic],
    seatedPassengerIds: new Set(['car-passenger']),
    visitors: [patientAt('car-passenger', 2, 0)],
  }, 0.1)
  assert.equal(cabinMedic.targetId, null, 'a medic does not target someone still seated in a vehicle')

  const exitGame=fixture(1), leaver=exitGame.snapshot.visitors[0]!, door=createScenarioEntrance(exitGame.snapshot.scenario.worldSize)
  leaver.state='leaving'
  leaver.route=[{x:door.x,z:door.z,elevation:2}]
  leaver.targetId=null
  leaver.arrivalGroupId=null
  leaver.cellX=door.x
  leaver.cellZ=door.z
  leaver.cellElevation=2
  leaver.x=door.x+0.5
  leaver.y=2
  leaver.z=door.z+0.5
  for(let n=0;n<8;n++) exitGame.tick(0.25)
  assert.equal(exitGame.snapshot.visitors.length,0,'guests on the exit path leave the park')

  assert.equal(spontaneousPanicChance(90, 80, 20, 1, 20), 0, 'one packed cell cannot start a mass panic')
  assert.equal(spontaneousPanicChance(90, 80, 20, 3, 20), 0, 'a thin crush still does not ignite')
  assert.equal(spontaneousPanicChance(90, 80, 20, 5, 8), 0, 'too few people in the cluster')
  assert.equal(spontaneousPanicChance(90, 20, 20, 5, 20), 0, 'panic needs prolonged crush stress')
  assert.ok(spontaneousPanicChance(90, 80, 20, 5, 20) > 0 && spontaneousPanicChance(90, 80, 20, 5, 20) < 0.0001, 'a wide packed crush can ignite, but still rarely')
  assert.equal(panicSpreadChance(80, 1, 1), 0, 'panic does not jump out of a single cell')
  assert.ok(panicSpreadChance(80, 1, 4) < 0.04, 'panic spread stays a rare chain reaction')
  const crowdingAt = (x: number, z: number) => (Math.abs(x) <= 1 && Math.abs(z) <= 1 ? 80 : 10)
  assert.equal(
    denseClusterSize({ cellX: 0, cellZ: 0, cellElevation: 0 }, (x, z, elevation) => elevation === 0 ? crowdingAt(x, z) : 0, 64),
    9,
  )
  assert.equal(
    neighborhoodPeople({ cellX: 0, cellZ: 0, cellElevation: 0 }, (x, z) => x === 0 && z === 0 ? 6 : 2),
    22,
  )
  const festiveCrowdVisitor = {
    state: 'exploring',
    emotion: 'sad',
    needs: { hunger: 90, toilet: 90, fun: 96, energy: 90 },
    isDancing: false,
    isConversing: false,
    crowding: 90,
    crowdStress: 30,
    isPanicking: false,
    localPartyMood: 92,
  }
  assert.equal(
    visitorBubbleKind(festiveCrowdVisitor),
    'happy',
    'happy festival guests do not look unhappy from brief crowding',
  )
  assert.equal(
    visitorBubbleKind({
      ...festiveCrowdVisitor,
      crowdStress: SIMULATION_CONFIG.crowding.crushStress,
    }),
    'crushed',
    'sustained critical crowding still overrides festival mood',
  )
  const packedDancers = Array.from({ length: 9 }, (_, index) => ({
    id: `dancer-${index}`,
    cellX: 0,
    cellZ: 0,
    cellElevation: 0,
    state: 'partying',
  }))
  const crowding = new CrowdingSystem()
  const packed = crowding.calculate(packedDancers)
  const danceFloor = crowding.calculate(packedDancers, new Set(['0:0:0']))
  assert.ok(packed.visitorValues.get('dancer-0')! > 50, 'nine people on one path tile feel packed')
  assert.ok(
    danceFloor.visitorValues.get('dancer-0')! < packed.visitorValues.get('dancer-0')! * 0.55,
    'the same cluster feels lighter on a dance floor',
  )
  const panicGame = fixture(1)
  const panicVisitor = panicGame.snapshot.visitors[0]!
  assert.ok(panicGame.place('path', 0, 0).ok)
  Object.assign(panicVisitor, {
    cellX: 0,
    cellZ: 0,
    cellElevation: 0,
    x: 0.5,
    y: 0,
    z: 0.5,
    crowding: 100,
    crowdStress: 100,
    isPanicking: true,
    state: 'panicking',
    route: [],
  })
  ;(panicGame as any).crowdingCosts = new Map([['0,0,0', 100]])
  ;(panicGame as any).ensurePanicFleeRoute(panicVisitor)
  assert.equal(panicVisitor.route.length, 1, 'panicking guests flee to an adjacent open cell')
  assert.equal(
    panicGame.snapshot.buildings.some(
      building =>
        building.kind === 'path' &&
        building.x === panicVisitor.route[0]!.x &&
        building.z === panicVisitor.route[0]!.z,
    ),
    false,
    'panic escape may leave the footpath',
  )

  const leftover = abandonVisitorCamp(
    { id: 'gone', campsite: { x: 4, z: -8, elevation: 0 }, campingPhase: 'ready' },
    [{ id: 'chairs-1', cell: { x: 5, z: -8, elevation: 0 }, kind: 'chairs', ownerId: 'gone', contributorIds: ['gone'], decay: 0 }],
    () => 'tent-1',
  )
  assert.equal(leftover.filter((item) => item.kind === 'tent').length, 1, 'unpacked tents stay behind')
  const living = new Set(['other'])
  assert.ok(leftover.every((item) => isCollectibleCamp(item, living)), 'left-behind camp gear is immediately collectible')
  const worn = decayUnclaimedInstallations(leftover, living, 80)
  assert.ok(worn.every((item) => (item.decay ?? 0) > 20))
  const claimed = decayUnclaimedInstallations(
    [{ id: 'used', cell: { x: 6, z: -8, elevation: 0 }, kind: 'chairs', ownerId: 'gone', contributorIds: ['gone'], decay: 0 }],
    new Set(['gone']),
    80,
  )
  assert.ok(claimed.every((item) => (item.decay ?? 0) === 0), 'claimed camp gear does not decay')

  const campGame = fixture(0)
  const campState = campGame.snapshot as GameSnapshot
  campState.campingCells.push({ x: 3, z: -18, elevation: 0 })
  campState.campInstallations.push({
    id: 'old-tent',
    cell: { x: 3, z: -18, elevation: 0 },
    kind: 'tent',
    ownerId: '',
    contributorIds: [],
    decay: 40,
  })
  campState.staff.push(createStaffMember('camp-cleaner', 'cleaner', { x: 3, z: -20, elevation: 0 }))
  for (let n = 0; n < 80; n++) campGame.tick(0.25)
  assert.equal(
    campState.campInstallations.some((item) => item.id === 'old-tent'),
    false,
    'cleaners remove abandoned tents',
  )

  const scavenger = createStaffMember('scavenger', 'cleaner', { x: 0, z: 0, elevation: 0 })
  const litter = [
    { id: 'l1', kind: 'litter' as const, x: 1, z: 0, elevation: 0, severity: 1, ageMinutes: 0 },
    { id: 'l2', kind: 'litter' as const, x: 2, z: 0, elevation: 0, severity: 1, ageMinutes: 0 },
    { id: 'l3', kind: 'litter' as const, x: 3, z: 0, elevation: 0, severity: 1, ageMinutes: 0 },
  ]
  const haul = {
    ...context,
    staff: [scavenger],
    wasteBins: [{ ...bin, stored: SIMULATION_CONFIG.waste.binCapacity }],
    incidents: litter,
    findPath: (_a: any, goals: any[]) => goals.map((point) => ({ ...point })),
    removeIncident: (id: string) => {
      const index = litter.findIndex((item) => item.id === id)
      if (index >= 0) litter.splice(index, 1)
    },
  }
  scavenger.targetId = 'l1'
  scavenger.state = 'working'
  ;(staff as any).finishWork(scavenger, haul)
  assert.equal(scavenger.carryingWaste, 1)
  assert.equal(scavenger.targetId, 'l2', 'cleaners keep collecting until they hold three items')
  scavenger.route = []
  ;(staff as any).finishArrival(scavenger, haul)
  scavenger.workMinutes = 0
  ;(staff as any).finishWork(scavenger, haul)
  assert.equal(scavenger.carryingWaste, 2)
  assert.equal(scavenger.targetId, 'l3')
  scavenger.route = []
  ;(staff as any).finishArrival(scavenger, haul)
  scavenger.workMinutes = 0
  ;(staff as any).finishWork(scavenger, haul)
  assert.equal(scavenger.carryingWaste, 3)
  assert.ok(
    scavenger.targetId === 'deposit-bin:bin-1' || scavenger.targetId?.startsWith('dump:'),
    'a full armful goes to disposal',
  )

  const cars=fixture(0), carState=cars.snapshot as GameSnapshot
  cars.addDebugMoney()
  const edgeZ=-carState.scenario.worldSize/2
  for (let z=edgeZ+1; z<=-16; z+=1) {
    if (!carState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(cars.designateRoad([{x:0,z}]).ok, `road 0,${z}`)
    }
  }
  assert.ok(cars.designateParkingArea([{x:1,z:-16}]).ok)
  carState.logistics.parkingCells[0]!.occupiedBy='parked-car'
  const inbound={
    id:'inbound-car',kind:'visitorCar' as const,position:{x:0,z:edgeZ},cell:{x:0,z:edgeZ},
    route:[],state:'waiting' as const,speed:0,passengerIds:[],groupId:'inbound-group',
    parkingCell:null,target:null,facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  carState.logistics.arrivalGroups.push({
    id:'inbound-group',memberIds:[],vehicleId:inbound.id,mode:'car',state:'approaching',
    arrivedMinute:0,parkingWaitMinutes:0,entryFeesPaid:true,
  })
  carState.logistics.roadVehicles.push(inbound)
  ;(cars as any).assignVisitorCarParking(inbound,1,new Set(),new Set(),new Set(),true)
  assert.ok(inbound.state==='driving' && inbound.route.length>0,'cars without a free bay leave the entrance')
  assert.notEqual(inbound.route.at(-1)?.z,edgeZ,'they drive inland or wait in front of parking')
  for (let n=0;n<40 && inbound.cell?.z===edgeZ; n+=1) (cars as any).updateLogistics(1)
  assert.notEqual(inbound.cell?.z,edgeZ,'incoming cars do not stay parked on the entry lane')
  assert.ok(
    inbound.state==='driving' || cars['isVisitorCarHoldingNearParking'](inbound),
    'without a bay they circulate or queue in front of parking',
  )

  const jammed=fixture(0), jammedState=jammed.snapshot as GameSnapshot
  jammed.addDebugMoney()
  const jammedEdge=-jammedState.scenario.worldSize/2
  for (let z=jammedEdge+1; z<=-16; z+=1) {
    if (!jammedState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(jammed.designateRoad([{x:0,z}]).ok)
    }
  }
  assert.ok(jammed.designateRoad([{x:1,z:-18}]).ok)
  const mover={
    id:'blocked-car',kind:'visitorCar' as const,position:{x:0,z:-19},cell:{x:0,z:-19},
    route:[{x:0,z:-18},{x:0,z:-17}],state:'driving' as const,speed:10,passengerIds:[],groupId:null,
    parkingCell:null,target:{kind:'cruise' as const},facing:0,waitMinutes:6,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  const stopper={
    id:'stopper-car',kind:'visitorCar' as const,position:{x:0,z:-18},cell:{x:0,z:-18},
    route:[],state:'waiting' as const,speed:0,passengerIds:[],groupId:null,
    parkingCell:null,target:null,facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  jammedState.logistics.roadVehicles.push(mover,stopper)
  ;(jammed as any).updateLogistics(1)
  assert.equal(mover.route[0]?.x,0)
  assert.equal(mover.route[0]?.z,-20,'the last car in a jam reverses after waiting')
  assert.equal(mover.facing,0,'it keeps facing forward while reversing')
  assert.equal(mover.cell?.z,-19)
  ;(jammed as any).updateLogistics(1)
  assert.equal(mover.cell?.z,-20,'it actually backs up one cell')
  assert.equal(mover.facing,0,'the nose still points along the lane')

  const queue=fixture(0), queueState=queue.snapshot as GameSnapshot
  queue.addDebugMoney()
  const queueEdge=-queueState.scenario.worldSize/2
  for (let z=queueEdge+1; z<=-16; z+=1) {
    if (!queueState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(queue.designateRoad([{x:0,z}]).ok)
    }
  }
  const tail={
    id:'tail-car',kind:'visitorCar' as const,position:{x:0,z:-19},cell:{x:0,z:-19},
    route:[{x:0,z:-18},{x:0,z:-17}],state:'driving' as const,speed:10,passengerIds:[],groupId:null,
    parkingCell:null,target:{kind:'cruise' as const},facing:0,waitMinutes:6,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  const middle={
    id:'middle-car',kind:'visitorCar' as const,position:{x:0,z:-18},cell:{x:0,z:-18},
    route:[{x:0,z:-17}],state:'driving' as const,speed:10,passengerIds:[],groupId:null,
    parkingCell:null,target:{kind:'cruise' as const},facing:0,waitMinutes:6,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  const front={
    id:'front-car',kind:'visitorCar' as const,position:{x:0,z:-17},cell:{x:0,z:-17},
    route:[],state:'waiting' as const,speed:0,passengerIds:[],groupId:null,
    parkingCell:null,target:null,facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  queueState.logistics.roadVehicles.push(front,middle,tail)
  ;(queue as any).updateLogistics(1)
  assert.equal(middle.route[0]?.z,-17,'cars in the middle of a jam stay put')
  assert.equal(middle.cell?.z,-18)
  assert.equal(middle.facing,0)
  assert.equal(tail.route[0]?.z,-20,'only the last car reverses')
  assert.equal(tail.facing,0)

  const detour=fixture(0), detourState=detour.snapshot as GameSnapshot
  detour.addDebugMoney()
  const detourEdge=-detourState.scenario.worldSize/2
  for (let z=detourEdge+1; z<=-16; z+=1) {
    if (!detourState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(detour.designateRoad([{x:0,z}]).ok)
    }
  }
  for (const cell of [{x:1,z:-18},{x:1,z:-17},{x:1,z:-16}]) {
    assert.ok(detour.designateRoad([cell]).ok)
  }
  detourState.festival.infrastructure.trucks.push({
    id:'bay-truck',deliveryId:null,depotId:'depot',x:1,z:-18,path:[],phase:'inbound',
    progress:0,stuck:0,testedCell:'',cargo:0,kind:'food',
  })
  const turning={
    id:'turning-car',kind:'visitorCar' as const,position:{x:0,z:-18},cell:{x:0,z:-18},
    route:[{x:1,z:-18},{x:1,z:-17},{x:1,z:-16}],state:'driving' as const,speed:10,passengerIds:[],groupId:null,
    parkingCell:null,target:{kind:'cruise' as const},facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  detourState.logistics.roadVehicles.push(turning)
  ;(detour as any).updateLogistics(0.1)
  assert.equal(turning.cell?.z,-18,'a standing car stays on the starting road')
  assert.equal(turning.facing,0)
  assert.ok(
    turning.route[0] && (turning.route[0].x!==1 || turning.route[0].z!==-18),
    'a delivery truck on the turn makes it take the other direction',
  )
  assert.equal(turning.route[0]?.x,0)
  assert.equal(turning.route[0]?.z,-17)

  const heading=fixture(0), headingState=heading.snapshot as GameSnapshot
  heading.addDebugMoney()
  const headingEdge=-headingState.scenario.worldSize/2
  for (let z=headingEdge+1; z<=-16; z+=1) {
    if (!headingState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(heading.designateRoad([{x:0,z}]).ok)
    }
  }
  const turned={
    id:'heading-car',kind:'visitorCar' as const,position:{x:0,z:-18},cell:{x:0,z:-18},
    route:[{x:0,z:-17},{x:0,z:-16}],state:'driving' as const,speed:10,passengerIds:[],groupId:null,
    parkingCell:null,target:{kind:'cruise' as const},facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  headingState.logistics.roadVehicles.push(turned)
  assert.ok(heading.setRoadDirection(0,-18,2).ok)
  assert.ok(Math.abs(turned.facing-Math.PI)<1e-6,'cars on the tile turn into the new lane direction')
  assert.equal(turned.route[0]?.z,-19,'they replan instead of driving against the new one-way')

  const reverseBlock=fixture(0), reverseBlockState=reverseBlock.snapshot as GameSnapshot
  reverseBlock.addDebugMoney()
  const reverseBlockEdge=-reverseBlockState.scenario.worldSize/2
  for (let z=reverseBlockEdge+1; z<=-16; z+=1) {
    if (!reverseBlockState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(reverseBlock.designateRoad([{x:0,z}]).ok)
    }
  }
  const reverseTail={
    id:'reverse-tail',kind:'visitorCar' as const,position:{x:0,z:-19},cell:{x:0,z:-19},
    route:[{x:0,z:-20},{x:0,z:-16}],state:'driving' as const,speed:10,passengerIds:[],groupId:null,
    parkingCell:null,target:{kind:'cell' as const,x:0,z:-16},facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  const reverseWall={
    id:'reverse-wall',kind:'visitorCar' as const,position:{x:0,z:-20},cell:{x:0,z:-20},
    route:[],state:'waiting' as const,speed:0,passengerIds:[],groupId:null,
    parkingCell:null,target:null,facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  reverseBlockState.logistics.roadVehicles.push(reverseTail, reverseWall)
  ;(reverseBlock as any).updateLogistics(0.1)
  assert.equal(reverseTail.route[0]?.z,-18,'a blocked reverse is discarded for the normal driving direction')
  assert.equal(reverseTail.facing,0)
  assert.ok(
    reverseTail.route.every((cell, index, route) => {
      const previous = index === 0 ? reverseTail.cell! : route[index - 1]!
      return Math.abs(cell.x - previous.x) + Math.abs(cell.z - previous.z) === 1
    }),
    'replanned routes stay on adjacent road cells',
  )

  const service=fixture(0), serviceState=service.snapshot as GameSnapshot
  service.addDebugMoney()
  const serviceEdge=-serviceState.scenario.worldSize/2
  for (let z=serviceEdge+1; z<=-16; z+=1) {
    if (!serviceState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(service.designateRoad([{x:0,z}]).ok)
    }
  }
  for (const cell of [{x:1,z:-18}]) assert.ok(service.designateRoad([cell]).ok)
  serviceState.festival.infrastructure.depots.push({
    id:'service-depot',x:1,z:-17,stock:{food:0,drinks:0,water:0,goods:0},minimum:{food:0,drinks:0,water:0,goods:0},
  })
  const van={
    id:'service-van',kind:'deliveryTruck' as const,position:{x:0,z:-18},cell:{x:0,z:-18},
    route:[],state:'returning' as const,speed:0,passengerIds:[],groupId:null,
    parkingCell:null,target:{kind:'cell' as const,x:0,z:serviceEdge},facing:Math.PI/2,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
    deliveryId:'service-freight',
  }
  serviceState.festival.infrastructure.trucks.push({
    id:'service-freight',deliveryId:null,depotId:'service-depot',x:0,z:-18,path:[],
    phase:'return',progress:0,stuck:0,testedCell:'',cargo:0,kind:'food',
  })
  serviceState.logistics.roadVehicles.push(van)
  ;(service as any).updateLogistics(1)
  assert.ok(van.route.length > 0, 'an unloaded delivery truck plans a connected exit')
  assert.ok(Math.abs(van.facing - Math.PI / 2) > 0.2, 'it turns away from the depot to leave')
  assert.ok(service.setRoadDirection(0,-18,2).ok)
  assert.ok(Math.abs(van.facing-Math.PI)<1e-6,'delivery trucks follow a newly set lane arrow')
  assert.equal(van.route[0]?.z,-19)

  const garbage={
    id:'service-garbage',kind:'garbageTruck' as const,position:{x:0,z:-17},cell:{x:0,z:-17},
    route:[{x:0,z:-16}],state:'driving' as const,speed:10,passengerIds:[],groupId:null,
    parkingCell:null,target:{kind:'cell' as const,x:0,z:serviceEdge},facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  serviceState.logistics.roadVehicles.push(garbage)
  assert.ok(service.setRoadDirection(0,-17,2).ok)
  assert.ok(Math.abs(garbage.facing-Math.PI)<1e-6,'garbage trucks follow the same lane arrows')
  assert.equal(garbage.route[0]?.z,-18)

  const crash=fixture(0), crashState=crash.snapshot as GameSnapshot
  crash.addDebugMoney()
  const crashEdge=-crashState.scenario.worldSize/2
  for (let z=crashEdge+1; z<=-16; z+=1) {
    if (!crashState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(crash.designateRoad([{x:0,z}]).ok)
    }
  }
  const victim=(crash as any).spawnVisitorMember('day','crash-group','pedestrian',false)
  assert.ok(victim)
  Object.assign(victim,{state:'injured',injuryVehicleId:'crash-car',cellX:0,cellZ:-18,x:0.5,z:-17.5,route:[]})
  const crashed={
    id:'crash-car',kind:'visitorCar' as const,position:{x:0,z:-19},cell:{x:0,z:-19},
    route:[{x:0,z:-18},{x:0,z:-17}],state:'waiting' as const,speed:0,passengerIds:[],groupId:'crash-group',
    parkingCell:null,target:{kind:'cruise' as const},facing:0,waitMinutes:0,resumeState:'driving' as const,lineId:null,nextStopIndex:0,cargo:0,
  }
  crashState.logistics.arrivalGroups.push({
    id:'crash-group',memberIds:[],vehicleId:crashed.id,mode:'car',state:'approaching',
    arrivedMinute:0,parkingWaitMinutes:0,entryFeesPaid:true,
  })
  crashState.logistics.roadVehicles.push(crashed)
  ;(crash as any).updateLogistics(0.2)
  assert.equal(crashed.state,'waiting','the car waits while the injured guest is still on the road')
  victim.cellX=4
  victim.cellZ=-14
  victim.x=4.5
  victim.z=-13.5
  ;(crash as any).updateLogistics(0.2)
  assert.equal(crashed.state,'driving','once the guest is off the road the car continues')
  assert.equal(crashed.route[0]?.z,-18,'it uses the route it already had')

  const ambulanceDispatch=fixture(0), ambulanceState=ambulanceDispatch.snapshot as GameSnapshot
  ambulanceDispatch.addDebugMoney()
  const ambulanceEdge=-ambulanceState.scenario.worldSize/2
  for (let z=ambulanceEdge+1; z<=-16; z+=1) {
    if (!ambulanceState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(ambulanceDispatch.designateRoad([{x:0,z}]).ok)
    }
  }
  const ambulanceVictim=(ambulanceDispatch as any).spawnVisitorMember('day','ambulance-group','pedestrian',false)
  assert.ok(ambulanceVictim)
  Object.assign(ambulanceVictim,{state:'injured',cellX:0,cellZ:-16,x:0.5,z:-15.5,route:[],rescueVehicleId:null})
  const idleAmbulance = (id: string, z: number) => ({
    id,
    kind: 'ambulance' as const,
    position: { x: 0, z },
    cell: { x: 0, z },
    route: [],
    state: 'idle' as const,
    speed: 0,
    passengerIds: [],
    groupId: null,
    parkingCell: null,
    target: null,
    facing: 0,
    waitMinutes: 0,
    resumeState: null,
    lineId: null,
    nextStopIndex: 0,
    cargo: 0,
  })
  const farAmbulance=idleAmbulance('amb-far', ambulanceEdge+1)
  const nearAmbulance=idleAmbulance('amb-near', -17)
  const busyAmbulance=idleAmbulance('amb-busy', -20)
  busyAmbulance.state='responding'
  busyAmbulance.route=[{x:0,z:-19}]
  busyAmbulance.passengerIds=['other-casualty']
  ambulanceState.logistics.roadVehicles.push(farAmbulance, busyAmbulance, nearAmbulance)
  ;(ambulanceDispatch as any).updateLogistics(0.1)
  assert.equal(nearAmbulance.state,'responding','the nearest idle ambulance is dispatched')
  assert.equal(ambulanceVictim.rescueVehicleId,'amb-near')
  assert.equal(farAmbulance.state,'idle','a farther idle ambulance stays in the garage')
  assert.equal(busyAmbulance.passengerIds[0],'other-casualty','an occupied ambulance is not stolen')

  const ambulanceHome=fixture(0), ambulanceHomeState=ambulanceHome.snapshot as GameSnapshot
  ambulanceHome.addDebugMoney()
  const ambulanceHomeEdge=-ambulanceHomeState.scenario.worldSize/2
  for (let z=ambulanceHomeEdge; z<=-16; z+=1) {
    if (!ambulanceHomeState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(ambulanceHome.designateRoad([{x:0,z}]).ok)
    }
  }
  assert.ok(ambulanceHome.place('ambulanceGarage',-2,-18).ok)
  const garage=ambulanceHomeState.logistics.ambulanceGarages[0]!
  assert.ok(ambulanceHome.buyAmbulance(garage.id).ok)
  const rtw=ambulanceHomeState.logistics.roadVehicles.find(vehicle=>vehicle.kind==='ambulance')
  assert.ok(rtw)
  const garageAccess={...rtw.cell!}
  rtw.cell={x:0,z:-16}
  rtw.position={x:0,z:-16}
  rtw.state='idle'
  rtw.route=[]
  rtw.target=null
  ;(ambulanceHome as any).updateLogistics(0.1)
  assert.equal(rtw.state,'returning','an idle ambulance on the road drives back to its garage')
  assert.equal(rtw.target?.kind,'garage')
  assert.ok(rtw.route.length>0,'the return uses a road route')
  assert.equal(rtw.route.at(-1)?.x,garageAccess.x)
  assert.equal(rtw.route.at(-1)?.z,garageAccess.z)
  rtw.cell={...garageAccess}
  rtw.position={...garageAccess}
  rtw.route=[]
  rtw.state='idle'
  rtw.target={kind:'garage',garageId:garage.id}
  const soldHome=ambulanceHome.sellAmbulance(garage.id)
  assert.ok(soldHome.ok,soldHome.message)
  assert.equal(
    ambulanceHomeState.logistics.roadVehicles.some(vehicle=>vehicle.kind==='ambulance'),
    false,
    'selling an idle ambulance at the garage deletes it immediately',
  )
  assert.ok(ambulanceHome.buyAmbulance(garage.id).ok)
  const awayRtw=ambulanceHomeState.logistics.roadVehicles.find(vehicle=>vehicle.kind==='ambulance')!
  awayRtw.cell={x:0,z:-16}
  awayRtw.position={x:0,z:-16}
  awayRtw.state='idle'
  awayRtw.route=[]
  const soldRtwAway=applyGameCommand(ambulanceHome,{type:'sellAmbulance',garageId:garage.id})
  assert.ok(soldRtwAway.ok,soldRtwAway.message)
  assert.equal(awayRtw.pendingSale,true,'a sale on the road waits until the garage')
  assert.equal(awayRtw.state,'returning')
  awayRtw.cell={...garageAccess}
  awayRtw.position={...garageAccess}
  awayRtw.route=[]
  awayRtw.state='idle'
  ;(ambulanceHome as any).updateLogistics(0.1)
  assert.equal(
    ambulanceHomeState.logistics.roadVehicles.some(vehicle=>vehicle.id===awayRtw.id),
    false,
    'the pending sale completes once the ambulance is back at the garage',
  )

  const busPlanner=fixture(0), busState=busPlanner.snapshot as GameSnapshot
  busPlanner.addDebugMoney()
  const busEdge=-busState.scenario.worldSize/2
  for (let z=busEdge; z<=-14; z+=1) {
    if (!busState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(busPlanner.designateRoad([{x:0,z}]).ok)
    }
    assert.ok(busPlanner.placePathSegment(1,z,0).ok)
  }
  assert.ok(busPlanner.place('busDepot',-3,-18).ok)
  assert.ok(busPlanner.place('busStop',1,-16).ok)
  assert.ok(busPlanner.place('busStop',1,-14).ok)
  const busDepot=busState.logistics.busDepots[0]!
  const firstStop=busState.logistics.busStops.find(stop=>stop.x===1 && stop.z===-16)
  const secondStop=busState.logistics.busStops.find(stop=>stop.x===1 && stop.z===-14)
  assert.ok(firstStop && secondStop)
  assert.ok(busPlanner.buyBus(busDepot.id).ok)
  const created=busPlanner.createBusLine('Shuttle',busDepot.id,[secondStop.id,firstStop.id],1,2)
  assert.ok(created.ok,created.message)
  const line=busState.logistics.busLines[0]!
  assert.deepEqual(line.stopIds,[secondStop.id,firstStop.id],'added stops keep the chosen order')
  const added=applyGameCommand(busPlanner,{type:'addBusToLine',lineId:line.id})
  assert.ok(added.ok,added.message)
  assert.equal(line.busIds.length,2,'a later bus joins the existing line')
  const buses=busState.logistics.roadVehicles.filter(vehicle=>vehicle.kind==='bus')
  assert.equal(buses.length,2)
  assert.ok(buses.every(bus=>bus.lineId===line.id))
  line.lastDepartureMinute=null
  ;(busPlanner as any).updateLogistics(0.1)
  const firstBus=buses.find(bus=>bus.state==='driving' || bus.state==='at-stop')
  assert.ok(firstBus,'the first free bus starts the ordered route')
  assert.equal(firstBus!.nextStopIndex,0)
  assert.equal(firstBus!.target && 'stopId' in firstBus!.target ? firstBus!.target.stopId : null,secondStop.id)
  line.lastDepartureMinute=null
  ;(busPlanner as any).updateLogistics(0.1)
  assert.ok(
    buses.every(bus=>bus.nextStopIndex===0 && bus.target && 'stopId' in bus.target && bus.target.stopId===secondStop.id),
    'both buses follow the same stop order',
  )
  const reordered=applyGameCommand(busPlanner,{
    type:'setBusLineStops',
    lineId:line.id,
    stopIds:[firstStop.id,secondStop.id],
  })
  assert.ok(reordered.ok,reordered.message)
  assert.deepEqual(line.stopIds,[firstStop.id,secondStop.id])
  const overlay=busPlanner.previewBusLineRoute(line.stopIds)
  const overlayKeys=overlay.map(cell=>`${cell.x}:${cell.z}`)
  const firstVisit=overlayKeys.indexOf(`${firstStop.roadCell.x}:${firstStop.roadCell.z}`)
  const secondVisit=overlayKeys.indexOf(`${secondStop.roadCell.x}:${secondStop.roadCell.z}`)
  assert.ok(firstVisit>=0 && secondVisit>firstVisit,'the live route visits stops in the sorted order')

  assert.equal(SIMULATION_CONFIG.logistics.busCapacity, 40)
  assert.equal(SIMULATION_CONFIG.logistics.busStopDwellMinutes, 2)
  assert.equal(SIMULATION_CONFIG.logistics.busBoardingRadiusTiles, 4)
  assert.equal(SIMULATION_CONFIG.logistics.busBoardsPerTick, 40)
  const lateWaiter={
    id:'late-board',
    state:'bus-waiting',
    busLineId:line.id,
    busWaitMinutes:36,
    cellX:secondStop.x,
    cellZ:secondStop.z,
    route:[] as const,
    targetId:secondStop.id,
  }
  const neighborWaiter={
    ...lateWaiter,
    id:'neighbor-board',
    busWaitMinutes:12,
    cellX:secondStop.x+1,
    cellZ:secondStop.z,
  }
  const queueWaiter={
    ...lateWaiter,
    id:'queue-board',
    busWaitMinutes:20,
    cellX:secondStop.x,
    cellZ:secondStop.z+3,
  }
  const oppositeWaiter={
    ...lateWaiter,
    id:'opposite-board',
    busWaitMinutes:18,
    cellX:secondStop.roadCell.x-1,
    cellZ:secondStop.roadCell.z,
  }
  const walkingWaiter={
    ...lateWaiter,
    id:'walking-board',
    busWaitMinutes:9,
    cellX:secondStop.x,
    cellZ:secondStop.z+2,
    route:[{x:secondStop.x,z:secondStop.z,elevation:0}],
  }
  const farWaiter={
    ...lateWaiter,
    id:'far-skip',
    busWaitMinutes:50,
    cellX:secondStop.x,
    cellZ:secondStop.z+6,
  }
  const passerby={
    ...neighborWaiter,
    id:'passerby',
    targetId:'other-stop',
    route:[{x:secondStop.x+2,z:secondStop.z,elevation:0}],
  }
  assert.ok(isVisitorReadyToBoardBus(lateWaiter, line.id, secondStop))
  assert.ok(isVisitorReadyToBoardBus(neighborWaiter, line.id, secondStop), 'arrived neighbors may board')
  assert.ok(isVisitorReadyToBoardBus(queueWaiter, line.id, secondStop), 'queue cells in boarding radius may board')
  assert.ok(isVisitorReadyToBoardBus(oppositeWaiter, line.id, secondStop), 'the opposite sidewalk may board')
  assert.ok(isVisitorReadyToBoardBus(walkingWaiter, line.id, secondStop), 'approaching waiters in radius may board')
  assert.ok(!isVisitorReadyToBoardBus(farWaiter, line.id, secondStop), 'waiters beyond the boarding radius stay off')
  assert.ok(!isVisitorReadyToBoardBus(passerby, line.id, secondStop), 'neighbors walking elsewhere do not board')
  assert.ok(compareBusBoardPriority(lateWaiter, neighborWaiter) < 0, 'longest wait boards first')
  const indexed=collectEligibleBusWaiters(
    new Map([
      [roadCellKey(queueWaiter.cellX, queueWaiter.cellZ), [queueWaiter]],
      [roadCellKey(oppositeWaiter.cellX, oppositeWaiter.cellZ), [oppositeWaiter]],
      [roadCellKey(farWaiter.cellX, farWaiter.cellZ), [farWaiter]],
      [roadCellKey(passerby.cellX, passerby.cellZ), [passerby]],
    ]),
    line.id,
    secondStop,
  )
  assert.deepEqual(indexed.map((waiter)=>waiter.id), ['queue-board', 'opposite-board'])
  const longWaitGuest=(busPlanner as any).spawnVisitorMember('day', 'bus-long-wait', 'pedestrian', false)
  const midDwellGuest=(busPlanner as any).spawnVisitorMember('day', 'bus-mid-dwell', 'pedestrian', false)
  assert.ok(longWaitGuest && midDwellGuest)
  Object.assign(longWaitGuest, {
    state:'bus-waiting',
    busLineId:line.id,
    busWaitMinutes:40,
    busDestinationStopId:firstStop.id,
    cellX:secondStop.x,
    cellZ:secondStop.z,
    x:secondStop.x+0.4,
    z:secondStop.z+0.4,
    cellElevation:0,
    route:[],
    targetId:secondStop.id,
  })
  Object.assign(midDwellGuest, {
    state:'bus-waiting',
    busLineId:line.id,
    busWaitMinutes:8,
    busDestinationStopId:firstStop.id,
    cellX:secondStop.x+1,
    cellZ:secondStop.z,
    x:secondStop.x+1.4,
    z:secondStop.z+0.4,
    cellElevation:0,
    route:[],
    targetId:secondStop.id,
  })
  const boardingBus=buses[0]!
  boardingBus.state='at-stop'
  boardingBus.waitMinutes=1
  boardingBus.passengerIds=['ghost-stale', longWaitGuest.id]
  boardingBus.lineId=line.id
  boardingBus.target={kind:'busStop', stopId:secondStop.id}
  boardingBus.nextStopIndex=line.stopIds.indexOf(secondStop.id)
  boardingBus.cell={...secondStop.roadCell}
  boardingBus.position={...secondStop.roadCell}
  boardingBus.route=[]
  ;(busPlanner as any).updateLogistics(0.1)
  assert.equal(longWaitGuest.state,'bus-riding','a long-waiting guest boards an empty bus')
  assert.equal(midDwellGuest.state,'bus-riding','boarding continues after the first dwell tick')
  assert.ok(boardingBus.passengerIds.includes(longWaitGuest.id))
  assert.ok(boardingBus.passengerIds.includes(midDwellGuest.id))
  assert.ok(!boardingBus.passengerIds.includes('ghost-stale'), 'stale passenger ids do not fill the bus')
  assert.ok(boardingBus.passengerIds.length <= SIMULATION_CONFIG.logistics.busCapacity)
  assert.ok(
    boardingBus.waitMinutes < SIMULATION_CONFIG.logistics.busStopDwellMinutes,
    'the bus stays at the stop for busStopDwellMinutes',
  )

  const queueGuests=Array.from({length:10}, (_, index)=>{
    const guest=(busPlanner as any).spawnVisitorMember('day', `bus-queue-${index}`, 'pedestrian', false)
    assert.ok(guest, `queue guest ${index} spawned`)
    const spots=[
      {x:secondStop.x,z:secondStop.z,route:[] as {x:number;z:number;elevation:number}[]},
      {x:secondStop.x+1,z:secondStop.z,route:[]},
      {x:secondStop.x,z:secondStop.z+1,route:[]},
      {x:secondStop.x,z:secondStop.z+2,route:[]},
      {x:secondStop.x,z:secondStop.z+3,route:[{x:secondStop.x,z:secondStop.z,elevation:0}]},
      {x:secondStop.roadCell.x-1,z:secondStop.roadCell.z,route:[]},
      {x:secondStop.roadCell.x,z:secondStop.roadCell.z+1,route:[]},
      {x:secondStop.x-1,z:secondStop.z,route:[]},
      {x:secondStop.x+1,z:secondStop.z+1,route:[]},
      {x:secondStop.x,z:secondStop.z-1,route:[]},
    ]
    const spot=spots[index]!
    Object.assign(guest, {
      state:'bus-waiting',
      busLineId:line.id,
      busWaitMinutes:4+index,
      busDestinationStopId:firstStop.id,
      cellX:spot.x,
      cellZ:spot.z,
      x:spot.x+0.4,
      z:spot.z+0.4,
      cellElevation:0,
      route:spot.route,
      targetId:secondStop.id,
    })
    return guest
  })
  boardingBus.state='at-stop'
  boardingBus.waitMinutes=0
  boardingBus.passengerIds=[]
  boardingBus.cell={...secondStop.roadCell}
  boardingBus.position={...secondStop.roadCell}
  boardingBus.route=[]
  boardingBus.target={kind:'busStop', stopId:secondStop.id}
  ;(busPlanner as any).updateLogistics(0.1)
  const boarded=queueGuests.filter((guest)=>guest.state==='bus-riding')
  assert.equal(boarded.length, 10, 'an empty 40-seat bus boards the nearby queue in one tick')
  assert.ok(queueGuests.every((guest)=>boardingBus.passengerIds.includes(guest.id)))
  assert.ok(
    boardingBus.waitMinutes < SIMULATION_CONFIG.logistics.busStopDwellMinutes,
    'min dwell still applies after a full nearby queue boards',
  )
  ;(busPlanner as any).updateLogistics(SIMULATION_CONFIG.logistics.busStopDwellMinutes)
  assert.ok(queueGuests.every((guest)=>guest.state==='bus-riding'), 'boarded guests stay on until the next stop')
  assert.equal(boardingBus.passengerIds.length, 10)

  const against=fixture(0), againstState=against.snapshot as GameSnapshot
  against.addDebugMoney()
  const againstEdge=-againstState.scenario.worldSize/2
  for (let z=againstEdge+1; z<=-16; z+=1) {
    if (!againstState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(against.designateRoad([{x:0,z}]).ok)
    }
  }
  againstState.logistics.roadCells.forEach((cell) => {
    if (cell.x===0) cell.allowedDirections=1
  })
  ;(against as any).invalidateRoadGraph()
  const oneway={
    id:'oneway-car',kind:'visitorCar' as const,position:{x:0,z:-19},cell:{x:0,z:-19},
    route:[{x:0,z:-18},{x:0,z:-17}],state:'driving' as const,speed:10,passengerIds:[],groupId:null,
    parkingCell:null,target:{kind:'cruise' as const},facing:0,waitMinutes:6,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  const jam={
    id:'jam-car',kind:'visitorCar' as const,position:{x:0,z:-18},cell:{x:0,z:-18},
    route:[{x:0,z:-17}],state:'driving' as const,speed:0,passengerIds:[],groupId:null,
    parkingCell:null,target:{kind:'cruise' as const},facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  againstState.logistics.roadVehicles.push(oneway,jam)
  ;(against as any).updateLogistics(1)
  assert.equal(oneway.route[0]?.z,-18,'a blocked car never reverses against a one-way arrow')
  assert.equal(oneway.facing,0,'it does not flip and drive against the lane')
  ;(against as any).updateLogistics(1)
  assert.ok(oneway.cell!.z >= -19, 'the car waits or advances legally when traffic clears')
  assert.equal(oneway.facing,0)

  const resume=fixture(0), resumeState=resume.snapshot as GameSnapshot
  resume.addDebugMoney()
  const resumeEdge=-resumeState.scenario.worldSize/2
  for (let z=resumeEdge+1; z<=-16; z+=1) {
    if (!resumeState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(resume.designateRoad([{x:0,z}]).ok)
    }
  }
  const queued={
    id:'queued-car',kind:'visitorCar' as const,position:{x:0,z:-19},cell:{x:0,z:-19},
    route:[{x:0,z:-18},{x:0,z:-17}],state:'driving' as const,speed:10,passengerIds:[],groupId:null,
    parkingCell:null,target:{kind:'cruise' as const},facing:0,waitMinutes:0.4,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  const blockerCar={
    id:'brief-blocker',kind:'visitorCar' as const,position:{x:0,z:-18},cell:{x:0,z:-18},
    route:[],state:'waiting' as const,speed:0,passengerIds:[],groupId:null,
    parkingCell:null,target:null,facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  resumeState.logistics.roadVehicles.push(queued,blockerCar)
  ;(resume as any).updateLogistics(0.1)
  assert.equal(queued.cell?.z,-19,'a car keeps its place while the next cell is occupied')
  assert.ok(queued.speed>=10,'waiting for another car does not dump the accumulated speed')
  resumeState.logistics.roadVehicles = resumeState.logistics.roadVehicles.filter(vehicle=>vehicle.id!==blockerCar.id)
  ;(resume as any).updateLogistics(0.1)
  assert.equal(queued.cell?.z,-18,'after the other car leaves it continues immediately')
  assert.equal(describeRoadVehicleActivity({
    ...queued, state:'driving', waitMinutes:0.4, route:[{x:0,z:-17}], stuckMinutes:0,
  }),'Wartet, bis die Fahrbahn oder Ampel frei ist')
  assert.equal(describeRoadVehicleActivity({
    ...queued, cell:{x:0,z:-19}, facing:0, route:[{x:0,z:-20}], waitMinutes:0, stuckMinutes:0,
  }),'Setzt zurück')
  assert.equal(
    describeRoadVehicleDestination({
      ...queued, parkingCell:{x:1,z:-16}, state:'driving',
    }),
    'Parkplatz 1, -16',
  )

  const arrival=fixture(0), arrivalState=arrival.snapshot as GameSnapshot
  arrival.addDebugMoney()
  const arrivalEdge=-arrivalState.scenario.worldSize/2
  for (let z=arrivalEdge+1; z<=-16; z+=1) {
    if (!arrivalState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(arrival.designateRoad([{x:0,z}]).ok)
    }
  }
  assert.ok(arrival.designateParkingArea([{x:1,z:-16}]).ok)
  const rider=(arrival as any).spawnVisitorMember('day','car-group','car',true)
  assert.ok(rider)
  rider.state='vehicle-arrival'
  const bay=arrivalState.logistics.parkingCells[0]!
  bay.occupiedBy='arriving-car'
  const arriving={
    id:'arriving-car',kind:'visitorCar' as const,position:{x:0,z:-16},cell:{x:0,z:-16},
    route:[],state:'driving' as const,speed:10,passengerIds:[rider.id],groupId:'car-group',
    parkingCell:{x:1,z:-16},target:{kind:'parking' as const,parkingCell:{x:1,z:-16}},facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  arrivalState.logistics.arrivalGroups.push({
    id:'car-group',memberIds:[rider.id],vehicleId:arriving.id,mode:'car',state:'approaching',
    arrivedMinute:0,parkingWaitMinutes:0,entryFeesPaid:true,
  })
  arrivalState.logistics.roadVehicles.push(arriving)
  ;(arrival as any).completeVisitorCarArrival(arriving)
  assert.equal(arriving.state,'parking','the car pulls into the bay before anyone gets out')
  assert.equal(rider.state,'vehicle-arrival','passengers stay seated at the access road')
  assert.deepEqual(arriving.route,[{x:1,z:-16}])
  for (let n=0;n<8 && arriving.state!=='parked'; n+=1) (arrival as any).updateLogistics(1)
  assert.equal(arriving.state,'parked')
  assert.equal(arriving.position.x,1)
  assert.equal(arriving.position.z,-16)
  assert.notEqual(rider.state,'vehicle-arrival','guests leave only after the car is in the bay')
  assert.deepEqual(arriving.passengerIds, [], 'the parked car unloads every arrival passenger')
  assert.equal(rider.cellX, 2, 'guests step onto the bordering footpath, not the stall')
  assert.equal(rider.cellZ, -16)
  assert.notEqual(rider.cellX, 1)
  assert.notEqual(rider.cellX, 0, 'they do not appear on the approach road when a path borders the bay')
  for (let n = 0; n < 20; n += 1) arrival.tick(0.1)
  assert.equal(arriving.state, 'parked', 'the car stays parked after guests step out')
  assert.deepEqual(arriving.passengerIds, [], 'they do not climb back into the car from the sidewalk')
  assert.notEqual(rider.state, 'vehicle-arrival', 'after parking they stay on foot')
  assert.ok(
    rider.cellX !== arriving.position.x || rider.cellZ !== arriving.position.z,
    'they remain on the path, not in the stall',
  )
  const sidewalk = { x: rider.cellX, z: rider.cellZ, elevation: rider.cellElevation }
  const sidewalkNeighbors = (arrival as any).getPedestrianNeighbors(sidewalk)
  assert.ok(
    !sidewalkNeighbors.some((cell: { x: number; z: number }) => cell.x === 1 && cell.z === -16),
    'the parking stall is not a pedestrian step from the sidewalk',
  )
  assert.ok(arrival.place('food', 5, -20).ok)
  assert.ok(arrival.placePathSegment(5, -19, 0).ok)
  assert.ok(arrival.placePathSegment(4, -19, 0).ok)
  const snack = arrivalState.buildings.find((building) => building.kind === 'food')!
  arrivalState.festival.infrastructure.shops[snack.id] = {
    food: 8, drinks: 0, water: 0, goods: 0,
  }
  Object.assign(rider.needs, { hunger: 2, toilet: 80, fun: 80, energy: 80 })
  rider.motivation = 100
  rider.state = 'entering'
  rider.targetId = null
  ;(arrival as any).placeVisitorOnDisembarkCell(rider, {
    x: 2, z: -16, elevation: 0,
  })
  ;(arrival as any).decideNextAction(rider)
  ;(arrival as any).keepDisembarkRouteOnFoot(rider)
  assert.ok(rider.route.length > 0, 'after getting out they receive a pedestrian route')
  assert.ok(
    rider.route.every((cell: { x: number; z: number }) => !(cell.x === 1 && cell.z === -16)),
    'the first route does not go through the parking bay',
  )
  const distToSnack = () => Math.abs(rider.cellX - 5) + Math.abs(rider.cellZ + 19)
  const startDist = distToSnack()
  let bounced = 0
  let previous = `${rider.cellX}:${rider.cellZ}`
  for (let n = 0; n < 40; n += 1) {
    arrival.tick(0.1)
    const here = `${rider.cellX}:${rider.cellZ}`
    assert.notEqual(here, '1:-16', 'they never step onto the stall after leaving the car')
    if (
      (previous === '2:-16' && here === '1:-16') ||
      (previous === '1:-16' && here === '2:-16')
    ) {
      bounced += 1
    }
    previous = here
  }
  assert.equal(bounced, 0, 'they do not oscillate between sidewalk and stall')
  assert.ok(
    distToSnack() < startDist || rider.cellX !== 2 || rider.cellZ !== -16,
    'they walk away toward a real destination instead of spinning on the exit tile',
  )

  assert.deepEqual(
    chooseParkingDisembarkPath(
      { x: 1, z: -16 },
      [
        { x: 0, z: -16, elevation: 0, onRoad: true },
        { x: 2, z: -16, elevation: 0, onRoad: false },
        { x: 1, z: -15, elevation: 0, onRoad: false },
      ],
      [{ x: 0, z: -16 }],
    ),
    { x: 2, z: -16, elevation: 0, onRoad: false },
    'among several paths prefer the sidewalk opposite the road',
  )
  assert.equal(
    chooseParkingDisembarkPath({ x: 1, z: -16 }, [], [{ x: 0, z: -16 }]),
    null,
    'no bordering path leaves the road fallback to GameState',
  )

  const isolated=fixture(0), isolatedState=isolated.snapshot as GameSnapshot
  isolated.addDebugMoney()
  const isolatedEdge=-isolatedState.scenario.worldSize/2
  for (let z=isolatedEdge+1; z<=-16; z+=1) {
    if (!isolatedState.logistics.roadCells.some(cell=>cell.x===-1 && cell.z===z)) {
      assert.ok(isolated.designateRoad([{x:-1,z}]).ok)
    }
  }
  assert.ok(isolated.designateParkingArea([{x:-2,z:-16}]).ok)
  const noPathRider=(isolated as any).spawnVisitorMember('day','no-path-group','car',true)
  assert.ok(noPathRider)
  noPathRider.state='vehicle-arrival'
  const isolatedBay=isolatedState.logistics.parkingCells.find(cell=>cell.x===-2 && cell.z===-16)
  assert.ok(isolatedBay, 'isolated stall is designated away from the default path column')
  isolatedBay.occupiedBy='isolated-car'
  const isolatedCar={
    id:'isolated-car',kind:'visitorCar' as const,position:{x:-1,z:-16},cell:{x:-1,z:-16},
    route:[],state:'driving' as const,speed:10,passengerIds:[noPathRider.id],groupId:'no-path-group',
    parkingCell:{x:-2,z:-16},target:{kind:'parking' as const,parkingCell:{x:-2,z:-16}},facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  isolatedState.logistics.arrivalGroups.push({
    id:'no-path-group',memberIds:[noPathRider.id],vehicleId:isolatedCar.id,mode:'car',state:'approaching',
    arrivedMinute:0,parkingWaitMinutes:0,entryFeesPaid:true,
  })
  isolatedState.logistics.roadVehicles.push(isolatedCar)
  ;(isolated as any).completeVisitorCarArrival(isolatedCar)
  for (let n=0;n<8 && isolatedCar.state!=='parked'; n+=1) (isolated as any).updateLogistics(1)
  assert.equal(isolatedCar.state,'parked')
  assert.equal(noPathRider.cellX, -1, 'without a bordering path guests still leave onto the approach road')
  assert.equal(noPathRider.cellZ, -16)
  assert.notEqual(noPathRider.cellX, -2, 'they do not stay in the parking stall')

  const crossing=fixture(0), crossingState=crossing.snapshot as GameSnapshot
  crossing.addDebugMoney()
  const crossingEdge=-crossingState.scenario.worldSize/2
  for (let z=crossingEdge+1; z<=-16; z+=1) {
    if (!crossingState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(crossing.designateRoad([{x:0,z}]).ok)
    }
  }
  assert.ok(crossing.designateParkingArea([{x:1,z:-16}]).ok)
  assert.ok(crossing.placePathSegment(0, -16, 0).ok, 'zebra on the approach road')
  const zebraRider=(crossing as any).spawnVisitorMember('day','zebra-group','car',true)
  assert.ok(zebraRider)
  zebraRider.state='vehicle-arrival'
  crossingState.logistics.parkingCells[0]!.occupiedBy='zebra-car'
  const zebraCar={
    id:'zebra-car',kind:'visitorCar' as const,position:{x:0,z:-16},cell:{x:0,z:-16},
    route:[],state:'driving' as const,speed:10,passengerIds:[zebraRider.id],groupId:'zebra-group',
    parkingCell:{x:1,z:-16},target:{kind:'parking' as const,parkingCell:{x:1,z:-16}},facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  crossingState.logistics.arrivalGroups.push({
    id:'zebra-group',memberIds:[zebraRider.id],vehicleId:zebraCar.id,mode:'car',state:'approaching',
    arrivedMinute:0,parkingWaitMinutes:0,entryFeesPaid:true,
  })
  crossingState.logistics.roadVehicles.push(zebraCar)
  ;(crossing as any).completeVisitorCarArrival(zebraCar)
  for (let n=0;n<8 && zebraCar.state!=='parked'; n+=1) (crossing as any).updateLogistics(1)
  assert.equal(zebraCar.state,'parked')
  assert.equal(zebraRider.cellX, 2, 'a sidewalk beats a zebra on the approach road')
  assert.equal(zebraRider.cellZ, -16)
  for (let n = 0; n < 20; n += 1) crossing.tick(0.1)
  assert.notEqual(
    `${zebraRider.cellX}:${zebraRider.cellZ}`,
    '1:-16',
    'a zebra next to the bay does not pull them back onto the stall',
  )
  assert.notEqual(zebraRider.state, 'vehicle-arrival')

  const depart=fixture(0), departState=depart.snapshot as GameSnapshot
  depart.addDebugMoney()
  const departEdge=-departState.scenario.worldSize/2
  for (let z=departEdge+1; z<=-16; z+=1) {
    if (!departState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(depart.designateRoad([{x:0,z}]).ok)
    }
  }
  assert.ok(depart.designateParkingArea([{x:1,z:-16}]).ok)
  const firstLeaver=(depart as any).spawnVisitorMember('day','depart-group','car',true)
  const secondLeaver=(depart as any).spawnVisitorMember('day','depart-group','car',true)
  assert.ok(firstLeaver && secondLeaver)
  departState.logistics.parkingCells[0]!.occupiedBy='depart-car'
  const departCar={
    id:'depart-car',kind:'visitorCar' as const,position:{x:1,z:-16},cell:null,
    route:[],state:'parked' as const,speed:10,passengerIds:[] as string[],groupId:'depart-group',
    parkingCell:{x:1,z:-16},target:{kind:'parking' as const,parkingCell:{x:1,z:-16}},facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  departState.logistics.arrivalGroups.push({
    id:'depart-group',memberIds:[firstLeaver.id,secondLeaver.id],vehicleId:departCar.id,mode:'car',state:'arrived',
    arrivedMinute:0,parkingWaitMinutes:0,entryFeesPaid:true,
  })
  departState.logistics.roadVehicles.push(departCar)
  Object.assign(firstLeaver, {
    state:'leaving', targetId:departCar.id, cellX:2, cellZ:-16, cellElevation:0,
    x:2.5, z:-15.5, route:[],
  })
  Object.assign(secondLeaver, {
    state:'leaving', targetId:departCar.id, cellX:2, cellZ:-20, cellElevation:0,
    x:2.5, z:-19.5, route:[],
  })
  assert.ok(
    (depart as any).isVisitorAtParkedCarDoor(firstLeaver, departCar),
    'leavers can board from the sidewalk next to the stall',
  )
  assert.ok((depart as any).tryBoardDepartureCar(firstLeaver), 'the first leaver sits down from the Gehweg')
  assert.deepEqual(departCar.passengerIds, [firstLeaver.id])
  assert.equal(firstLeaver.state, 'leaving', 'departure waiters stay leaving, not a leftover arrival')
  assert.ok(
    (depart as any).isVisitorSeatedInVehicle(
      firstLeaver,
      collectSeatedPassengerIds(departState.logistics.roadVehicles),
    ),
    'the first leaver is seated until the rest of the group arrives',
  )
  for (let n = 0; n < 8; n += 1) (depart as any).updateLogistics(1)
  ;(depart as any).walkVisitors(0.2)
  assert.equal(departCar.state, 'parked', 'the car waits for the rest of the group')
  assert.deepEqual(departCar.passengerIds, [firstLeaver.id], 'the first leaver is not unloaded while waiting')
  assert.equal(firstLeaver.state, 'leaving')
  Object.assign(secondLeaver, {
    cellX:2, cellZ:-16, cellElevation:0, x:2.5, z:-15.5, route:[],
    state:'leaving', targetId:departCar.id,
  })
  assert.ok((depart as any).tryBoardDepartureCar(secondLeaver), 'the second member also boards from the sidewalk')
  assert.ok(departCar.passengerIds.includes(firstLeaver.id))
  assert.ok(departCar.passengerIds.includes(secondLeaver.id))
  for (let n = 0; n < 8 && departCar.state === 'parked'; n += 1) {
    (depart as any).updateLogistics(1)
  }
  assert.notEqual(departCar.state, 'parked', 'once the group is seated the car drives off')

  assert.equal(SIMULATION_CONFIG.logistics.visitorCarCapacity, 6)

  const boardOriginals = (
    game: GameState,
    size: number,
    groupId: string,
    carId: string,
    blockedExit = false,
  ) => {
    const state = game.snapshot as GameSnapshot
    game.addDebugMoney()
    const edge = -state.scenario.worldSize / 2
    for (let z = edge + 1; z <= -16; z += 1) {
      if (!state.logistics.roadCells.some((cell) => cell.x === 0 && cell.z === z)) {
        assert.ok(game.designateRoad([{ x: 0, z }]).ok)
      }
    }
    assert.ok(game.designateParkingArea([{ x: 1, z: -16 }]).ok)
    const riders = Array.from({ length: size }, () =>
      (game as any).spawnVisitorMember('day', groupId, 'car', true),
    )
    assert.ok(riders.every(Boolean))
    state.logistics.parkingCells[0]!.occupiedBy = carId
    const car = {
      id: carId,
      kind: 'visitorCar' as const,
      position: { x: 1, z: -16 },
      cell: null,
      route: [],
      state: 'parked' as const,
      speed: 10,
      passengerIds: [] as string[],
      groupId,
      parkingCell: { x: 1, z: -16 },
      target: { kind: 'parking' as const, parkingCell: { x: 1, z: -16 } },
      facing: 0,
      waitMinutes: 0,
      resumeState: null,
      lineId: null,
      nextStopIndex: 0,
      cargo: 0,
    }
    const group = {
      id: groupId,
      memberIds: riders.map((rider: { id: string }) => rider.id),
      vehicleId: car.id,
      mode: 'car' as const,
      state: 'arrived',
      arrivedMinute: 0,
      parkingWaitMinutes: 0,
      entryFeesPaid: true,
    }
    state.logistics.arrivalGroups.push(group)
    state.logistics.roadVehicles.push(car)
    for (const rider of riders) {
      Object.assign(rider, {
        state: 'leaving',
        targetId: car.id,
        cellX: 2,
        cellZ: -16,
        cellElevation: 0,
        x: 2.5,
        z: -15.5,
        route: [],
      })
      assert.ok(
        (game as any).tryBoardDepartureCar(rider),
        `every original passenger of a ${size}-person car can reboard`,
      )
      assert.notEqual(rider.state, 'exploring')
    }
    assert.equal(car.passengerIds.length, size)
    assert.ok(riders.every((rider: { id: string }) => car.passengerIds.includes(rider.id)))
    assert.deepEqual(
      formatRoadVehicleInspectLoad(car, group.memberIds.length),
      [{ label: 'Insassen', value: `${size} / ${size}` }],
    )
    car.speed = 0
    assert.equal(describeRoadVehicleActivity(car), 'Steht auf dem Parkplatz')
    if (blockedExit) {
      assert.ok(game.setRoadDirection(0, -17, 0).ok)
      ;(game as any).updateLogistics(0.01)
      assert.equal(car.state, 'parked', 'a wrong-way arrow blocks departure even with a complete manifest')
      assert.equal(car.passengerIds.length, size, 'a missing exit never discards the seated passengers')
      assert.equal(
        describeRoadVehicleActivity(car),
        'Keine Ausfahrtroute – Straßenpfeile und Verbindungen prüfen',
        'the car explains why a complete group cannot leave',
      )
      const restored = GameState.fromJSON(JSON.stringify(game.snapshot))!
      assert.equal(
        describeRoadVehicleActivity(restored.snapshot.logistics.roadVehicles.find(v => v.id === carId)!),
        describeRoadVehicleActivity(car),
        'the blocked-departure status survives save loading',
      )
      const passengerId = car.passengerIds.pop()!
      ;(game as any).updateLogistics(0.01)
      assert.equal(describeRoadVehicleActivity(car), 'Steht auf dem Parkplatz', 'waiting for a passenger clears an outdated exit warning')
      car.passengerIds.push(passengerId)
      assert.ok(game.setRoadDirection(0, -17, 2).ok)
      const blocker = { ...car, id: 'departure-blocker', kind: 'bus' as const,
        state: 'at-stop' as const, cell: { x: 0, z: -16 }, position: { x: 0, z: -16 },
        passengerIds: [], groupId: null, parkingCell: null, target: null }
      state.logistics.roadVehicles.push(blocker)
      ;(game as any).updateLogistics(SIMULATION_CONFIG.logistics.vehicleAbandonMinutes + 1)
      assert.equal(car.state, 'parked', 'an occupied access keeps the car in its bay even when listed after it')
      assert.equal(car.passengerIds.length, size, 'waiting to unpark does not abandon the passengers')
      assert.equal(describeRoadVehicleActivity(car), 'Steht auf dem Parkplatz', 'traffic does not masquerade as a missing exit route')
      state.logistics.roadVehicles = state.logistics.roadVehicles.filter(v=>v.id!==blocker.id)
    }
    ;(game as any).updateLogistics(0.01)
    assert.equal(car.state, 'returning', `a ${size}/${size} car starts its departure`)
    assert.equal(car.waitMinutes, 0, 'a corrected exit clears the blocked-departure status')
    assert.deepEqual(
      car.cell,
      car.position,
      'the car begins the maneuver in its parking bay',
    )
    assert.ok(
      isVehicleReversing(car),
      'a nose-in car reverses onto the adjacent road before driving away',
    )
    for (let n = 0; n < 8 && car.state === 'parked'; n += 1) {
      ;(game as any).updateLogistics(1)
    }
    assert.notEqual(car.state, 'parked', `a ${size}-person original group departs together`)
    return { game, state, riders, car, group }
  }

  const threeOriginals = boardOriginals(
    fixture(0),
    3,
    'three-group',
    'three-car',
    true,
  )
  const jammedCar = threeOriginals.car
  const trafficBlocker = { ...jammedCar, id: 'return-blocker', kind: 'bus' as const,
    state: 'at-stop' as const, cell: { ...jammedCar.route[0]! }, position: { ...jammedCar.route[0]! },
    route: [], passengerIds: [], groupId: null, parkingCell: null, target: null }
  threeOriginals.state.logistics.roadVehicles.push(trafficBlocker)
  jammedCar.waitMinutes = SIMULATION_CONFIG.logistics.vehicleAbandonMinutes + 1
  ;(threeOriginals.game as any).updateLogistics(0.01)
  assert.ok(threeOriginals.state.logistics.roadVehicles.includes(jammedCar), 'a traffic timeout cannot delete an occupied departing car')
  assert.equal(jammedCar.passengerIds.length, 3)
  threeOriginals.state.logistics.roadVehicles = threeOriginals.state.logistics.roadVehicles.filter(v=>v.id!==trafficBlocker.id)
  for (
    let n = 0;
    n < 240 &&
    threeOriginals.state.logistics.roadVehicles.some(
      (vehicle) => vehicle.id === threeOriginals.car.id,
    );
    n += 1
  ) {
    threeOriginals.game.tick(0.1)
  }
  assert.ok(
    !threeOriginals.state.logistics.roadVehicles.some(
      (vehicle) => vehicle.id === threeOriginals.car.id,
    ),
    'a 3/3 car reverses from an adjacent bay and leaves the map',
  )
  boardOriginals(fixture(0), 5, 'five-group', 'five-car')
  boardOriginals(fixture(0), 6, 'six-group', 'six-car')

  const emptyPark=fixture(0), emptyState=emptyPark.snapshot as GameSnapshot
  emptyPark.addDebugMoney()
  const emptyEdge=-emptyState.scenario.worldSize/2
  for (let z=emptyEdge+1; z<=-16; z+=1) {
    if (!emptyState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(emptyPark.designateRoad([{x:0,z}]).ok)
    }
  }
  assert.ok(emptyPark.designateParkingArea([{x:1,z:-16},{x:-1,z:-16}]).ok)
  const seatedA=(emptyPark as any).spawnVisitorMember('day','stale-group','car',true)
  const seatedB=(emptyPark as any).spawnVisitorMember('day','stale-group','car',true)
  const otherCarRider=(emptyPark as any).spawnVisitorMember('day','other-group','car',true)
  assert.ok(seatedA && seatedB && otherCarRider)
  emptyState.logistics.parkingCells.find(cell=>cell.x===1 && cell.z===-16)!.occupiedBy='stale-car'
  emptyState.logistics.parkingCells.find(cell=>cell.x===-1 && cell.z===-16)!.occupiedBy='other-car'
  const staleCar={
    id:'stale-car',kind:'visitorCar' as const,position:{x:1,z:-16},cell:null,
    route:[],state:'parked' as const,speed:10,passengerIds:[seatedA.id,seatedB.id],groupId:'stale-group',
    parkingCell:{x:1,z:-16},target:{kind:'parking' as const,parkingCell:{x:1,z:-16}},facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  const otherParkedCar={
    id:'other-car',kind:'visitorCar' as const,position:{x:-1,z:-16},cell:null,
    route:[],state:'parked' as const,speed:10,passengerIds:[otherCarRider.id],groupId:'other-group',
    parkingCell:{x:-1,z:-16},target:{kind:'parking' as const,parkingCell:{x:-1,z:-16}},facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  const staleGroup={
    id:'stale-group',memberIds:[seatedA.id,seatedB.id,'ghost-departed',otherCarRider.id],vehicleId:staleCar.id,mode:'car' as const,state:'arrived',
    arrivedMinute:0,parkingWaitMinutes:0,entryFeesPaid:true,
  }
  emptyState.logistics.arrivalGroups.push(staleGroup, {
    id:'other-group',memberIds:[otherCarRider.id],vehicleId:otherParkedCar.id,mode:'car',state:'arrived',
    arrivedMinute:0,parkingWaitMinutes:0,entryFeesPaid:true,
  })
  emptyState.logistics.roadVehicles.push(staleCar, otherParkedCar)
  Object.assign(seatedA, {
    state:'leaving', targetId:staleCar.id, cellX:1, cellZ:-16, cellElevation:0,
    x:1.5, z:-15.5, route:[],
  })
  Object.assign(seatedB, {
    state:'leaving', targetId:staleCar.id, cellX:1, cellZ:-16, cellElevation:0,
    x:1.5, z:-15.5, route:[],
  })
  Object.assign(otherCarRider, {
    state:'leaving', targetId:staleCar.id, cellX:-1, cellZ:-16, cellElevation:0,
    x:-0.5, z:-15.5, route:[],
  })
  assert.equal(
    emptyState.visitors.filter((visitor) =>
      !staleCar.passengerIds.includes(visitor.id) &&
      !otherParkedCar.passengerIds.includes(visitor.id),
    ).length,
    0,
    'the park has no on-foot visitors',
  )
  assert.ok(
    (emptyPark as any).canParkedCarDepart(staleCar, staleGroup),
    'stale unrelated claims and ghost IDs do not block the original passengers',
  )
  assert.deepEqual(staleGroup.memberIds, [seatedA.id, seatedB.id])
  for (let n = 0; n < 8 && staleCar.state === 'parked'; n += 1) {
    (emptyPark as any).updateLogistics(1)
  }
  assert.notEqual(staleCar.state, 'parked', 'park empty and everyone seated: the car starts leaving')
  assert.ok(
    staleCar.passengerIds.includes(seatedA.id) && staleCar.passengerIds.includes(seatedB.id),
    'a failed or delayed exit does not dump seated guests onto the path',
  )
  for (let n = 0; n < 8 && otherParkedCar.state === 'parked'; n += 1) {
    (emptyPark as any).updateLogistics(1)
  }
  assert.notEqual(otherParkedCar.state, 'parked', 'the other seated car also leaves')
  for (let n = 0; n < 240 && emptyState.logistics.roadVehicles.some((vehicle) => vehicle.id === 'stale-car'); n += 1) {
    emptyPark.tick(0.1)
  }
  assert.ok(
    !emptyState.logistics.roadVehicles.some((vehicle) => vehicle.id === 'stale-car'),
    'the loaded car leaves the map instead of sitting parked forever',
  )
  assert.equal(
    (emptyPark as any).tryBoardDepartureCar(otherCarRider),
    false,
    'a guest from another car cannot take this car home',
  )

  const hurtGame=fixture(0), hurtState=hurtGame.snapshot as GameSnapshot
  hurtGame.addDebugMoney()
  const hurtEdge=-hurtState.scenario.worldSize/2
  for (let z=hurtEdge+1; z<=-16; z+=1) {
    if (!hurtState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(hurtGame.designateRoad([{x:0,z}]).ok)
    }
  }
  assert.ok(hurtGame.designateParkingArea([{x:1,z:-16}]).ok)
  const healthy=(hurtGame as any).spawnVisitorMember('day','hurt-group','car',true)
  const hurt=(hurtGame as any).spawnVisitorMember('day','hurt-group','car',true)
  assert.ok(healthy && hurt)
  hurtState.logistics.parkingCells[0]!.occupiedBy='hurt-car'
  const hurtCar={
    id:'hurt-car',kind:'visitorCar' as const,position:{x:1,z:-16},cell:null,
    route:[],state:'parked' as const,speed:10,passengerIds:[] as string[],groupId:'hurt-group',
    parkingCell:{x:1,z:-16},target:{kind:'parking' as const,parkingCell:{x:1,z:-16}},facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  const hurtGroup={
    id:'hurt-group',memberIds:[healthy.id,hurt.id],vehicleId:hurtCar.id,mode:'car' as const,state:'arrived',
    arrivedMinute:0,parkingWaitMinutes:0,entryFeesPaid:true,
  }
  hurtState.logistics.arrivalGroups.push(hurtGroup)
  hurtState.logistics.roadVehicles.push(hurtCar)
  Object.assign(healthy, {
    state:'leaving', targetId:hurtCar.id, cellX:2, cellZ:-16, cellElevation:0,
    x:2.5, z:-15.5, route:[],
  })
  Object.assign(hurt, {
    state:'injured', targetId:hurtCar.id, cellX:2, cellZ:-17, cellElevation:0,
    x:2.5, z:-16.5, route:[],
  })
  assert.ok((hurtGame as any).tryBoardDepartureCar(healthy))
  assert.equal((hurtGame as any).canParkedCarDepart(hurtCar, hurtGroup), false, 'the car waits for an injured original passenger')
  for (let n = 0; n < 6; n += 1) (hurtGame as any).updateLogistics(1)
  assert.equal(hurtCar.state, 'parked')
  Object.assign(hurt, {
    state:'leaving', targetId:hurtCar.id, cellX:2, cellZ:-16, cellElevation:0,
    x:2.5, z:-15.5, route:[],
  })
  assert.ok((hurtGame as any).tryBoardDepartureCar(hurt), 'after recovery they reboard their own car')
  for (let n = 0; n < 8 && hurtCar.state === 'parked'; n += 1) {
    (hurtGame as any).updateLogistics(1)
  }
  assert.notEqual(hurtCar.state, 'parked', 'the car leaves once the recovered original is seated')

  const cabin=fixture(0), cabinState=cabin.snapshot as GameSnapshot
  cabin.addDebugMoney()
  const cabinEdge=-cabinState.scenario.worldSize/2
  for (let z=cabinEdge+1; z<=-16; z+=1) {
    if (!cabinState.logistics.roadCells.some(cell=>cell.x===0 && cell.z===z)) {
      assert.ok(cabin.designateRoad([{x:0,z}]).ok)
    }
  }
  const riderInCar=(cabin as any).spawnVisitorMember('day','cabin-group','car',true)
  assert.ok(riderInCar)
  Object.assign(riderInCar,{
    state:'entering',
    cellX:0,
    cellZ:-17,
    x:0.5,
    z:-16.5,
    route:[{x:1,z:-16,elevation:0}],
  })
  const cabinCar={
    id:'cabin-car',kind:'visitorCar' as const,position:{x:0,z:-19},cell:{x:0,z:-19},
    route:[{x:0,z:-18}],state:'driving' as const,speed:0,passengerIds:[riderInCar.id],groupId:'cabin-group',
    parkingCell:{x:1,z:-16},target:{kind:'parking' as const,parkingCell:{x:1,z:-16}},facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  cabinState.logistics.arrivalGroups.push({
    id:'cabin-group',memberIds:[riderInCar.id],vehicleId:cabinCar.id,mode:'car',state:'approaching',
    arrivedMinute:0,parkingWaitMinutes:0,entryFeesPaid:true,
  })
  const oncoming={
    id:'oncoming-car',kind:'visitorCar' as const,position:{x:0,z:-18},cell:{x:0,z:-18},
    route:[{x:0,z:-17}],state:'driving' as const,speed:10,passengerIds:[],groupId:null,
    parkingCell:null,target:{kind:'cruise' as const},facing:0,waitMinutes:5.9,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  cabinState.logistics.roadVehicles.push(cabinCar, oncoming)
  assert.deepEqual([...collectSeatedPassengerIds(cabinState.logistics.roadVehicles)], [riderInCar.id])
  const rng = (cabin as any).rng
  const previousNext = rng.next.bind(rng)
  rng.next = () => 0.99
  ;(cabin as any).walkVisitors(0.2)
  const seatedKey = (cabin as any).visitorOccupancyKey(riderInCar)
  assert.equal((cabin as any).movementOccupancy.get(seatedKey) ?? 0, 0, 'a seated passenger does not occupy the road as a pedestrian')
  ;(cabin as any).updateLogistics(0.2)
  rng.next = previousNext
  assert.notEqual(riderInCar.state, 'injured', 'a passenger still in a moving car cannot be injured on the road')
  assert.equal(riderInCar.injuryVehicleId, null)
  assert.equal(oncoming.resumeState, null, 'an incoming car does not start an incident against a seated passenger')
  assert.equal(oncoming.cell?.z, -17, 'the incoming car is not held by a seated passenger on the road')

  riderInCar.state = 'injured'
  riderInCar.injuryVehicleId = 'oncoming-car'
  oncoming.state = 'driving'
  oncoming.resumeState = null
  oncoming.waitMinutes = 0
  oncoming.speed = 10
  oncoming.cell = { x: 0, z: -18 }
  oncoming.position = { x: 0, z: -18 }
  oncoming.route = [{ x: 0, z: -17 }]
  cabinCar.state = 'parked'
  cabinCar.cell = null
  cabinCar.position = { x: 1, z: -16 }
  ;(cabin as any).updateLogistics(0.2)
  assert.equal(oncoming.cell?.z, -17, 'an injured passenger still listed in a parked car does not hold traffic')
  assert.equal(oncoming.resumeState, null)

  cabinCar.passengerIds = []
  riderInCar.state = 'entering'
  riderInCar.injuryVehicleId = null
  riderInCar.route = []
  oncoming.state = 'driving'
  oncoming.waitMinutes = 5.9
  oncoming.speed = 10
  oncoming.cell = { x: 0, z: -18 }
  oncoming.position = { x: 0, z: -18 }
  oncoming.route = [{ x: 0, z: -17 }]
  rng.next = () => 0.99
  ;(cabin as any).walkVisitors(0.2)
  assert.ok(((cabin as any).movementOccupancy.get(seatedKey) ?? 0) > 0, 'after leaving the car they occupy the path as pedestrians')
  ;(cabin as any).updateLogistics(0.2)
  rng.next = previousNext
  assert.equal(riderInCar.state, 'injured', 'once they have disembarked they can be injured on the road')

  const debugCars = fixture(0)
  debugCars.addDebugMoney()
  const debugState = debugCars.snapshot as GameSnapshot
  const debugEdge = -debugState.scenario.worldSize / 2
  for (let z = debugEdge + 1; z <= -16; z += 1) {
    if (!debugState.logistics.roadCells.some((cell) => cell.x === 0 && cell.z === z)) {
      assert.ok(debugCars.designateRoad([{ x: 0, z }]).ok)
    }
  }
  assert.ok(debugCars.designateParkingArea([{ x: 1, z: -16 }]).ok)
  const seatedRider = (debugCars as any).spawnVisitorMember(
    'day',
    'debug-car-group',
    'car',
    true,
  )
  const walker = (debugCars as any).spawnVisitorMember(
    'day',
    'debug-walk-group',
    'car',
    false,
  )
  assert.ok(seatedRider && walker)
  seatedRider.state = 'vehicle-arrival'
  walker.arrivalMode = 'car'
  walker.arrivalGroupId = 'debug-walk-group'
  walker.state = 'exploring'
  const debugBay = debugState.logistics.parkingCells[0]!
  debugBay.occupiedBy = 'debug-parked-car'
  const parkedDebugCar = {
    id: 'debug-parked-car',
    kind: 'visitorCar' as const,
    position: { x: 1, z: -16 },
    cell: null,
    route: [],
    state: 'parked' as const,
    speed: 0,
    passengerIds: [seatedRider.id],
    groupId: 'debug-car-group',
    parkingCell: { x: 1, z: -16 },
    target: { kind: 'parking' as const, parkingCell: { x: 1, z: -16 } },
    facing: 0,
    waitMinutes: 0,
    resumeState: null,
    lineId: null,
    nextStopIndex: 0,
    cargo: 0,
  }
  const drivingDebugCar = {
    id: 'debug-driving-car',
    kind: 'visitorCar' as const,
    position: { x: 0, z: -18 },
    cell: { x: 0, z: -18 },
    route: [{ x: 0, z: -17 }],
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
  debugState.logistics.arrivalGroups.push(
    {
      id: 'debug-car-group',
      memberIds: [seatedRider.id],
      vehicleId: parkedDebugCar.id,
      mode: 'car',
      state: 'arrived',
      arrivedMinute: 0,
      parkingWaitMinutes: 0,
      entryFeesPaid: true,
    },
    {
      id: 'debug-walk-group',
      memberIds: [walker.id],
      vehicleId: null,
      mode: 'car',
      state: 'arrived',
      arrivedMinute: 0,
      parkingWaitMinutes: 0,
      entryFeesPaid: true,
    },
  )
  debugState.logistics.roadVehicles.push(parkedDebugCar, drivingDebugCar)
  const debugRemoved = debugCars.removeVisitorCarsForDebug()
  assert.ok(debugRemoved.ok, debugRemoved.message)
  assert.equal(
    debugState.logistics.roadVehicles.some((vehicle) => vehicle.kind === 'visitorCar'),
    false,
    'debug remove deletes every visitor car',
  )
  assert.equal(debugBay.occupiedBy, null, 'debug remove frees parking occupancy')
  assert.equal(
    debugState.logistics.arrivalGroups.some((group) => group.mode === 'car'),
    false,
  )
  assert.deepEqual(
    [...collectSeatedPassengerIds(debugState.logistics.roadVehicles)],
    [],
    'no passenger stays listed on a vehicle',
  )
  assert.notEqual(seatedRider.state, 'vehicle-arrival', 'seated guests are put on foot')
  assert.notEqual(seatedRider.cellX, 1, 'they leave the stall instead of standing in the bay')
  assert.equal(seatedRider.arrivalMode, 'pedestrian')
  assert.equal(walker.arrivalMode, 'pedestrian')
  debugState.scenario.carArrivalShare = 0
  for (let n = 0; n < 8; n += 1) debugCars.tick(0.1)
  assert.equal(
    debugState.logistics.roadVehicles.some((vehicle) => vehicle.kind === 'visitorCar'),
    false,
    'removed cars do not come back on the next ticks',
  )
  assert.equal(debugBay.occupiedBy, null)

  // Dirt lies on ground that people use, and nowhere else: tear up the path and the
  // rubbish on it goes with it, and a piece seeded on bare ground does not survive a tick.
  const dirtGame=fixture(0)
  const dirt=dirtGame.snapshot as GameSnapshot
  dirt.incidents.push({id:'on-path',kind:'litter',x:3,z:-10,elevation:0,severity:3,ageMinutes:0})
  dirt.incidents.push({id:'on-bare-ground',kind:'litter',x:20,z:-10,elevation:0,severity:3,ageMinutes:0})
  dirtGame.tick(0.1)
  assert.ok(dirt.incidents.some(incident=>incident.id==='on-path'),'rubbish on a footpath stays')
  assert.equal(
    dirt.incidents.some(incident=>incident.id==='on-bare-ground'),
    false,
    'rubbish on bare ground is not a place it can lie',
  )
  assert.ok(dirtGame.bulldozeArea([{x:3,z:-10}]).ok)
  assert.equal(
    dirt.incidents.some(incident=>incident.id==='on-path'),
    false,
    'tearing up the path takes the rubbish with it',
  )

  // A cleaner fills the cart before walking anywhere: small piles are collected one
  // after the other, and the load only leaves once it is full.
  const cartHaulGame=fixture(0)
  cartHaulGame.addDebugMoney()
  const cartHaul=cartHaulGame.snapshot as GameSnapshot
  assert.ok(cartHaulGame.hireStaff('cleaner').ok)
  const hauler=cartHaul.staff.find(member=>member.role==='cleaner')!
  assert.ok(cartHaulGame.designateWasteDump([{x:5,z:-14}]).ok)
  for (let n=0;n<6;n+=1) {
    cartHaul.incidents.push({id:`haul-litter-${n}`,kind:'litter',x:2+(n%3),z:-20+n,elevation:0,severity:2,ageMinutes:0})
  }
  let sawPartialHaul=false
  for (let n=0;n<2400;n+=1) {
    cartHaulGame.tick(0.25)
    // 'carrying' is the walk to a bin or the dump; before the cart is full it must not happen.
    if (hauler.state==='carrying' && hauler.carryingWaste>0 && hauler.carryingWaste<SIMULATION_CONFIG.waste.cleanerMaxCarry && cartHaul.incidents.some(incident=>incident.kind==='litter'||incident.kind==='vomit')) {
      sawPartialHaul=true
      break
    }
  }
  assert.equal(sawPartialHaul,false,'a cleaner never sets off with a half-empty cart while litter is left')
  assert.equal(
    cartHaul.incidents.some(incident=>incident.id.startsWith('haul-litter-')),
    false,
    'and the piles are collected all the same',
  )

  // Bigger carts: each paid step doubles what a cleaner hauls, and the last one is final.
  const cartGame=fixture(0)
  cartGame.addDebugMoney()
  const cart=cartGame.snapshot as GameSnapshot
  const cartBase=cart.money
  assert.equal(cleanerCarryFactor(cart.festival),1,'a crew starts with plain carts')
  assert.ok(cartGame.manageFestival({type:'upgradeStep',kind:'cleanerCarry'}).ok)
  assert.equal(cleanerCarryFactor(cart.festival),2,'the first step doubles the load')
  assert.equal(cartBase-cart.money,1000,'and costs 1.000 €')
  assert.ok(cartGame.manageFestival({type:'upgradeStep',kind:'cleanerCarry'}).ok)
  assert.equal(cleanerCarryFactor(cart.festival),4)
  assert.ok(cartGame.manageFestival({type:'upgradeStep',kind:'cleanerCarry'}).ok)
  assert.equal(cleanerCarryFactor(cart.festival),8)
  assert.equal(cartBase-cart.money,7000,'1.000 € + 1.000 € + 5.000 € for the three steps')
  assert.equal(
    cartGame.manageFestival({type:'upgradeStep',kind:'cleanerCarry'}).ok,
    false,
    'there is no fourth step to buy',
  )
  const carried=(game:GameState)=>{
    const s=game.snapshot as GameSnapshot
    const cleaner=s.staff.find(member=>member.role==='cleaner')!
    for (const x of [2,3,4]) s.incidents.push({id:`cart-litter-${x}`,kind:'litter',x,z:-12,elevation:0,severity:40,ageMinutes:0})
    for (let n=0;n<600;n+=1) game.tick(0.25)
    return cleaner.carryingWaste
  }
  const plainGame=fixture(0)
  plainGame.addDebugMoney()
  assert.ok(plainGame.hireStaff('cleaner').ok)
  const bigGame=fixture(0)
  bigGame.addDebugMoney()
  assert.ok(bigGame.hireStaff('cleaner').ok)
  bigGame.manageFestival({type:'upgradeStep',kind:'cleanerCarry'})
  assert.ok(
    carried(bigGame) > carried(plainGame),
    'with the bigger cart a cleaner walks around with more waste on board',
  )

  const sweepGame=fixture(0)
  sweepGame.addDebugMoney()
  const sweep=sweepGame.snapshot as GameSnapshot
  const owner=(sweepGame as any).spawnVisitorMember('day','tent-owner','pedestrian',false)
  assert.ok(owner)
  owner.state='sleeping'
  owner.pendingWaste=0
  owner.cellX=18
  owner.cellZ=8
  owner.x=18.5
  owner.z=8.5
  owner.route=[]
  const onFootpath=(x:number,z:number)=>sweep.buildings.some(building=>building.kind==='path'&&building.x===x&&building.z===z)
  const yard=sweepGame.place('specialDepot',5,-22)
  assert.ok(yard.ok, yard.message)
  const special=sweep.logistics.specialDepots[0]!
  const bought=sweepGame.buySweeper(special.id)
  assert.ok(bought.ok, bought.message)
  const sweeper=sweep.logistics.roadVehicles.find(vehicle=>vehicle.kind==='sweeper')
  assert.ok(sweeper)
  assert.ok(sweeper.cell && onFootpath(sweeper.cell.x,sweeper.cell.z),'the sweeper starts on a footpath')
  assert.ok(sweepGame.place('wasteBin',5,-18).ok)
  const leftBin=sweep.buildings.find(building=>building.kind==='wasteBin')!
  leftBin.wasteFill=7
  assert.ok(sweepGame.designateWasteDump([{x:5,z:-14}]).ok)
  // One cell of path beside the main strip: rubbish only ever lies on ground that can
  // hold it, and the sweeper has to reach this piece from next door rather than drive onto it.
  assert.ok(sweepGame.place('path',1,-16).ok)
  sweep.incidents.push({
    id:'path-litter',kind:'litter',x:1,z:-16,elevation:0,severity:4,ageMinutes:0,
  })
  for (const x of [2,3,4]) {
    sweep.campInstallations.push({
      id:`path-tent-${x}`,
      cell:{x,z:-17,elevation:0},
      kind:'tent',
      ownerId:owner.id,
      contributorIds:[],
    })
  }
  for (let n=0;n<80;n+=1) sweepGame.tick(0.25)
  assert.ok(sweeper.cell && onFootpath(sweeper.cell.x,sweeper.cell.z),'the sweeper stays on footpaths')
  assert.ok(
    !sweep.logistics.roadCells.some(cell=>cell.x===sweeper.cell?.x && cell.z===sweeper.cell?.z),
    'the sweeper does not drive on roads',
  )
  assert.ok(
    !sweeper.cell || sweeper.cell.z!==-17,
    'the sweeper does not drive through claimed tents',
  )
  assert.ok(
    sweep.incidents.some(incident=>incident.id==='path-litter' && incident.severity>0),
    'dirt behind a claimed tent stays',
  )
  assert.ok(leftBin.wasteFill>0,'the sweeper does not empty bins')
  sweep.campInstallations.forEach((item) => {
    if (!item.id.startsWith('path-tent-')) return
    item.ownerId=''
    item.contributorIds=[]
  })
  const binBeforeSweep=leftBin.wasteFill??0
  for (let n=0;n<200;n+=1) sweepGame.tick(0.25)
  assert.ok(sweeper.cell && onFootpath(sweeper.cell.x,sweeper.cell.z),'after cleaning it is still on a path')
  assert.equal(
    sweep.incidents.some(incident=>incident.id==='path-litter' && incident.severity>0),
    false,
    'after the tent is abandoned the sweeper cleans the area beside the path',
  )
  assert.ok(
    (leftBin.wasteFill??0)>=binBeforeSweep,
    'bins stay untouched while the sweeper works',
  )
  sweeper.cargo=SIMULATION_CONFIG.logistics.sweeperCapacity
  sweeper.state='idle'
  sweeper.route=[]
  for (let n=0;n<400;n+=1) sweepGame.tick(0.25)
  assert.ok(
    sweep.wasteDumpCells.some(cell=>cell.stored>=SIMULATION_CONFIG.logistics.sweeperCapacity),
    'a full sweeper unloads onto the waste dump',
  )

  const blockGame=fixture(0)
  blockGame.addDebugMoney()
  const block=blockGame.snapshot as GameSnapshot
  assert.ok(blockGame.place('specialDepot',5,-22).ok)
  assert.ok(blockGame.buySweeper(block.logistics.specialDepots[0]!.id).ok)
  const machine=block.logistics.roadVehicles.find(vehicle=>vehicle.kind==='sweeper')!
  machine.cell={x:3,z:-20}
  machine.position={x:3,z:-20}
  machine.route=[{x:3,z:-19},{x:3,z:-18}]
  machine.state='responding'
  machine.speed=0
  machine.cargo=0
  const blocker=(blockGame as any).spawnVisitorMember('day','sweeper-block','pedestrian',false)
  assert.ok(blocker)
  blocker.cellX=3
  blocker.cellZ=-19
  blocker.cellElevation=0
  blocker.x=3.5
  blocker.z=-19.5
  blocker.route=[]
  blocker.state='relaxing'
  for (let n=0;n<4;n+=1) (blockGame as any).updateLogistics(2)
  assert.equal(machine.cell?.z,-20,'the sweeper waits instead of driving through visitors')
  blocker.cellZ=-14
  blocker.z=-13.5
  block.staff.push(createStaffMember('path-staff','cleaner',{x:3,z:-19,elevation:0}))
  ;(blockGame as any).updateLogistics(2)
  assert.equal(machine.cell?.z,-19,'staff on the path does not block the sweeper')

  const noiseGame=fixture(0)
  noiseGame.addDebugMoney()
  assert.ok(noiseGame.place('tree',6,-18).ok)
  ;(noiseGame as any).updateAtmosphere()
  const quiet=noiseGame.snapshot.attractiveness.cells.find(cell=>cell.x===6 && cell.z===-18)
  assert.ok(quiet)
  noiseGame.snapshot.logistics.roadVehicles.push({
    id:'noise-sweeper',kind:'sweeper',position:{x:6,z:-18},cell:{x:6,z:-18},
    route:[{x:6,z:-17}],state:'responding',speed:0,passengerIds:[],groupId:null,
    parkingCell:null,target:{kind:'cell',x:6,z:-17},facing:0,waitMinutes:0,resumeState:null,
    lineId:null,nextStopIndex:0,cargo:0,
  })
  ;(noiseGame as any).updateAtmosphere()
  const noisy=noiseGame.snapshot.attractiveness.cells.find(cell=>cell.x===6 && cell.z===-18)
  assert.ok(noisy)
  assert.ok(noisy.value<quiet.value,'a moving sweeper lowers nearby attractiveness')
  noiseGame.snapshot.logistics.roadVehicles[0]!.state='idle'
  noiseGame.snapshot.logistics.roadVehicles[0]!.route=[]
  ;(noiseGame as any).updateAtmosphere()
  const parked=noiseGame.snapshot.attractiveness.cells.find(cell=>cell.x===6 && cell.z===-18)
  assert.ok(parked)
  assert.ok(Math.abs(parked.value-quiet.value)<0.01,'an idle sweeper does not make driving noise')

  const plaza=fixture(0)
  plaza.addDebugMoney()
  assert.ok(plaza.designateStageForecourt([{x:5,z:-18},{x:6,z:-18},{x:7,z:-18}]).ok)
  plaza.snapshot.incidents.push({
    id:'dance-litter',kind:'litter',x:7,z:-18,elevation:0,severity:2,ageMinutes:0,
  })
  const guestWalk=(plaza as any).findPath({x:4,z:-18,elevation:0},[{x:7,z:-18,elevation:0}])
  assert.equal(guestWalk,null,'guests do not cut across the dance floor')
  const cleanerWalk=(plaza as any).findPath(
    {x:4,z:-18,elevation:0},[{x:7,z:-18,elevation:0}],false,true,true,false,true,undefined,true,
  )
  assert.ok(cleanerWalk,'cleaners can walk onto the festival forecourt')
  assert.ok(cleanerWalk.some((cell:{x:number})=>cell.x>=5),'the cleaner route uses the dance floor')
  const plazaSweeper={
    id:'plaza-sweeper',kind:'sweeper' as const,position:{x:4,z:-18},cell:{x:4,z:-18},
    route:[],state:'idle' as const,speed:0,passengerIds:[],groupId:null,parkingCell:null,
    target:null,facing:0,waitMinutes:0,resumeState:null,lineId:null,nextStopIndex:0,cargo:0,
  }
  const plazaAccesses=(plaza as any).getSweeperDirtAccesses() as Array<{path:{x:number;z:number}}>
  assert.ok(
    plazaAccesses.some(access=>access.path.x>=5 && access.path.z===-18),
    'the sweeper treats the dance floor as a driving surface',
  )
  const plazaRoute=(plaza as any).findSweeperRoute(plazaSweeper,plazaAccesses.map(access=>access.path))
  assert.ok(plazaRoute,'the sweeper can route onto the festival forecourt')
  assert.ok(plazaRoute.some((cell:{x:number})=>cell.x>=5),'the sweeper drives across the dance floor')
  plaza.snapshot.logistics.roadVehicles.push(plazaSweeper)
  for (let n=0;n<40;n+=1) (plaza as any).updateLogistics(2)
  assert.ok(
    plazaSweeper.cell && plazaSweeper.cell.x>=5,
    'the sweeper drives onto the dance floor instead of stopping at the path edge',
  )
  assert.equal(
    plaza.snapshot.incidents.some(incident=>incident.id==='dance-litter' && incident.severity>0),
    false,
    'the sweeper cleans litter on the dance floor',
  )

  const zoneGame=fixture(0)
  zoneGame.addDebugMoney()
  assert.ok(zoneGame.place('specialDepot',5,-22).ok)
  assert.ok(zoneGame.buySweeper(zoneGame.snapshot.logistics.specialDepots[0]!.id).ok)
  const bot=zoneGame.snapshot.logistics.roadVehicles.find(vehicle=>vehicle.kind==='sweeper')!
  assert.equal(bot.workZones,undefined,'new sweepers have no zone assignment')
  const sweeperZone=zoneKey(1,-16)
  assert.ok(applyGameCommand(zoneGame,{type:'toggleStaffZone',staffId:bot.id,key:sweeperZone}).ok)
  assert.deepEqual(bot.workZones,[sweeperZone],'sweepers reuse staff zone assignment')
  zoneGame.snapshot.incidents.push(
    {id:'zone-litter',kind:'litter',x:1,z:-16,elevation:0,severity:3,ageMinutes:0},
    {id:'far-litter',kind:'litter',x:3,z:6,elevation:0,severity:3,ageMinutes:0},
  )
  const inZone=(zoneGame as any).getSweeperDirtAccesses(bot.workZones) as Array<{dirt:{x:number;z:number}}>
  assert.ok(inZone.some(access=>access.dirt.x===1 && access.dirt.z===-16),'assigned sweepers still see dirt in their zones')
  assert.ok(!inZone.some(access=>access.dirt.x===3 && access.dirt.z===6),'assigned sweepers ignore dirt outside their zones')
  const worldwide=(zoneGame as any).getSweeperDirtAccesses() as Array<{dirt:{x:number;z:number}}>
  assert.ok(worldwide.some(access=>access.dirt.x===3 && access.dirt.z===6),'unfiltered dirt search still sees the whole map')
  bot.cell={x:3,z:6}
  bot.position={x:3,z:6}
  ;(zoneGame as any).sweepAround(bot)
  assert.ok(
    zoneGame.snapshot.incidents.some(incident=>incident.id==='far-litter' && incident.severity>0),
    'sweepers do not clean outside assigned zones while driving through',
  )
  const restored=GameState.fromJSON(JSON.stringify(zoneGame.snapshot))!
  const savedBot=restored.snapshot.logistics.roadVehicles.find(vehicle=>vehicle.id===bot.id)!
  assert.deepEqual(savedBot.workZones,[sweeperZone],'sweeper zones survive save/load')
  const legacyVehicle={...savedBot}
  delete legacyVehicle.workZones
  const legacy=GameState.fromJSON(JSON.stringify({
    ...restored.snapshot,
    logistics:{...restored.snapshot.logistics,roadVehicles:[legacyVehicle]},
  }))!
  assert.equal(
    legacy.snapshot.logistics.roadVehicles.find(vehicle=>vehicle.id===bot.id)?.workZones,
    undefined,
    'old saves without sweeper zones stay unassigned',
  )
  bot.state='idle'
  bot.cargo=0
  bot.route=[]
  assert.ok(applyGameCommand(zoneGame,{type:'fireStaffMember',staffId:bot.id}).ok)
  assert.equal(
    zoneGame.snapshot.logistics.roadVehicles.some(vehicle=>vehicle.id===bot.id),
    false,
    'staff fire sells an idle empty sweeper',
  )

  const plazaShop=fixture(0)
  plazaShop.addDebugMoney()
  const plazaState=plazaShop.snapshot as GameSnapshot
  assert.ok(plazaShop.designateStageForecourt([{x:5,z:-16},{x:6,z:-16}]).ok)
  assert.ok(plazaShop.place('food',7,-16).ok)
  const remoteStand=plazaState.buildings.find(building=>building.kind==='food')!
  plazaState.festival.infrastructure.depots.push({
    id:'plaza-pad',x:1,z:-20,role:'delivery',distribution:'shops',
    stock:{food:80,drinks:0,water:0,goods:0},minimum:{food:80,drinks:0,water:0,goods:0},
  })
  assert.ok(plazaShop.manageFestival({type:'depotSettings',depotId:'plaza-pad',distribution:'shops',workers:1}).ok)
  const plazaWalk=(start:any,goals:any)=>(plazaShop as any).findPath(start,goals,false,false,false,false,true,undefined,true)
  for (let n=0;n<200;n+=1) updateDepotCarriers(plazaState,1,plazaWalk,(from,to)=>(plazaShop as any).canCarrierStep(from,to))
  assert.ok(
    (plazaState.festival.infrastructure.shops[remoteStand.id]?.food??0)>0,
    'delivery workers take goods across the dance floor to a stall without a path edge',
  )

  const wasteFleet = () => {
    const game = fixture(0)
    game.addDebugMoney()
    const state = game.snapshot as GameSnapshot
    const edge = -state.scenario.worldSize / 2
    for (let z = edge; z <= -16; z += 1) {
      if (!state.logistics.roadCells.some((cell) => cell.x === 0 && cell.z === z)) {
        assert.ok(game.designateRoad([{ x: 0, z }]).ok)
      }
    }
    const placed = game.place('wasteDepot', -2, -18)
    assert.ok(placed.ok, placed.message)
    const depot = state.logistics.wasteDepots[0]!
    const bought = game.buyGarbageTruck(depot.id)
    assert.ok(bought.ok, bought.message)
    const truck = state.logistics.roadVehicles.find((vehicle) => vehicle.kind === 'garbageTruck')
    assert.ok(truck)
    return { game, state, edge, depot, truck }
  }
  const parkedCar = (id: string, x: number, z: number) => ({
    id,
    kind: 'visitorCar' as const,
    position: { x, z },
    cell: { x, z },
    route: [],
    state: 'waiting' as const,
    speed: 0,
    passengerIds: [],
    groupId: null,
    parkingCell: null,
    target: null,
    facing: 0,
    waitMinutes: 0,
    resumeState: null,
    lineId: null,
    nextStopIndex: 0,
    cargo: 0,
  })

  const stuckReturn = wasteFleet()
  stuckReturn.truck.state = 'returning'
  stuckReturn.truck.cargo = 0
  stuckReturn.truck.cell = { x: 0, z: -18 }
  stuckReturn.truck.position = { x: 0, z: -18 }
  stuckReturn.truck.route = [{ x: 0, z: -17 }]
  stuckReturn.truck.waitMinutes = SIMULATION_CONFIG.logistics.vehicleAbandonMinutes
  stuckReturn.state.logistics.roadVehicles.push(parkedCar('jam-blocker', 0, -17))
  ;(stuckReturn.game as any).updateLogistics(1)
  assert.ok(
    stuckReturn.state.logistics.roadVehicles.some((vehicle) => vehicle.id === stuckReturn.truck.id),
    'a garbage truck stuck on the way back is not deleted',
  )
  assert.ok(stuckReturn.depot.truckIds.includes(stuckReturn.truck.id))

  const ghost = wasteFleet()
  ghost.state.logistics.roadVehicles = ghost.state.logistics.roadVehicles.filter(
    (vehicle) => vehicle.id !== ghost.truck.id,
  )
  const soldGhost = ghost.game.sellGarbageTruck(ghost.depot.id)
  assert.ok(soldGhost.ok, soldGhost.message)
  assert.equal(ghost.depot.truckIds.length, 0)
  assert.equal(
    ghost.state.logistics.roadVehicles.some((vehicle) => vehicle.id === ghost.truck.id),
    false,
  )

  const respawned = wasteFleet()
  respawned.state.logistics.roadVehicles = respawned.state.logistics.roadVehicles.filter(
    (vehicle) => vehicle.id !== respawned.truck.id,
  )
  ;(respawned.game as any).updateLogistics(0.1)
  const back = respawned.state.logistics.roadVehicles.find(
    (vehicle) => vehicle.id === respawned.truck.id,
  )
  assert.ok(back, 'a missing garbage truck respawns at the depot')
  assert.equal(back.kind, 'garbageTruck')
  back.state = 'idle'
  back.cargo = 0
  assert.ok(respawned.game.sellGarbageTruck(respawned.depot.id).ok)

  const offMap = wasteFleet()
  offMap.truck.cell = { x: 0, z: offMap.edge - 1 }
  offMap.truck.position = { x: 0, z: offMap.edge - 1 }
  offMap.truck.state = 'waiting'
  offMap.truck.cargo = 0
  offMap.truck.route = []
  offMap.truck.waitMinutes =
    SIMULATION_CONFIG.waste.truckUnloadMinutes +
    SIMULATION_CONFIG.logistics.vehicleUnstickMinutes
  offMap.truck.resumeState = 'returning'
  offMap.state.logistics.roadCells
    .filter((cell) => cell.z === offMap.edge)
    .forEach((cell) => {
      offMap.state.logistics.roadVehicles.push(
        parkedCar(`entry-block-${cell.x}`, cell.x, cell.z),
      )
    })
  ;(offMap.game as any).updateLogistics(1)
  assert.ok(
    offMap.truck.cell && offMap.truck.cell.z >= offMap.edge,
    'a garbage truck blocked off the map returns to the depot',
  )
  assert.ok(
    offMap.state.logistics.roadVehicles.some((vehicle) => vehicle.id === offMap.truck.id),
  )
  offMap.truck.state = 'idle'
  offMap.truck.cargo = 0
  assert.ok(offMap.game.sellGarbageTruck(offMap.depot.id).ok)

  const reenterWhenFree = wasteFleet()
  reenterWhenFree.truck.cell = { x: 0, z: reenterWhenFree.edge - 1 }
  reenterWhenFree.truck.position = { x: 0, z: reenterWhenFree.edge - 1 }
  reenterWhenFree.truck.state = 'waiting'
  reenterWhenFree.truck.cargo = 0
  reenterWhenFree.truck.route = []
  reenterWhenFree.truck.waitMinutes = SIMULATION_CONFIG.waste.truckUnloadMinutes
  reenterWhenFree.truck.resumeState = 'returning'
  reenterWhenFree.truck.facing = Math.PI
  reenterWhenFree.state.logistics.roadCells
    .filter((cell) => cell.z === reenterWhenFree.edge && cell.x >= -3 && cell.x <= 2)
    .forEach((cell) => {
      reenterWhenFree.state.logistics.roadVehicles.push(
        parkedCar(`gate-${cell.x}`, cell.x, cell.z),
      )
    })
  ;(reenterWhenFree.game as any).updateLogistics(1)
  assert.ok(
    reenterWhenFree.truck.cell && reenterWhenFree.truck.cell.z < reenterWhenFree.edge,
    'a garbage truck stays off the map while every entry is occupied',
  )
  reenterWhenFree.state.logistics.roadVehicles =
    reenterWhenFree.state.logistics.roadVehicles.filter(
      (vehicle) => vehicle.kind !== 'visitorCar',
    )
  ;(reenterWhenFree.game as any).updateLogistics(1)
  assert.ok(
    reenterWhenFree.truck.cell && reenterWhenFree.truck.cell.z >= reenterWhenFree.edge,
    'a garbage truck re-enters when an entry cell becomes free',
  )
  assert.ok(
    reenterWhenFree.truck.state === 'returning' ||
      reenterWhenFree.truck.state === 'idle',
    'the re-entering truck heads home or is already at the depot',
  )
  if (reenterWhenFree.truck.state === 'idle') {
    const home = (reenterWhenFree.game as any).getLogisticsBuildingAccess(
      reenterWhenFree.depot,
      2,
    )
    assert.ok(home)
    assert.equal(reenterWhenFree.truck.cell.x, home.x)
    assert.equal(reenterWhenFree.truck.cell.z, home.z)
  }

  const idleAtExit = wasteFleet()
  idleAtExit.truck.cell = { x: -3, z: idleAtExit.edge }
  idleAtExit.truck.position = { x: -3, z: idleAtExit.edge }
  idleAtExit.truck.state = 'idle'
  idleAtExit.truck.cargo = 0
  idleAtExit.truck.route = []
  idleAtExit.truck.facing = 0
  ;(idleAtExit.game as any).updateLogistics(1)
  assert.ok(
    idleAtExit.truck.state === 'returning' && idleAtExit.truck.route.length > 0,
    'an idle garbage truck stranded on the ingress drives back to the depot',
  )

  const leaving = wasteFleet()
  leaving.truck.cell = { x: 0, z: leaving.edge - 1 }
  leaving.truck.position = { x: 0, z: leaving.edge - 1 }
  leaving.truck.state = 'waiting'
  leaving.truck.cargo = 0
  leaving.truck.route = []
  const soldAway = leaving.game.sellGarbageTruck(leaving.depot.id)
  assert.ok(soldAway.ok, soldAway.message)
  assert.equal(leaving.depot.truckIds.length, 0)

  const occupancyTile = (label: string) => {
    const game = new GameState()
    game.addDebugMoney()
    return { game, label, x: 8, z: -16 }
  }

  const parkingDemolish = occupancyTile('parking')
  assert.ok(parkingDemolish.game.designateParkingArea([{ x: parkingDemolish.x, z: parkingDemolish.z }]).ok)
  assert.ok(
    parkingDemolish.game.snapshot.logistics.parkingCells.some(
      (cell) => cell.x === parkingDemolish.x && cell.z === parkingDemolish.z,
    ),
  )
  const parkingRemoved = parkingDemolish.game.bulldoze(parkingDemolish.x, parkingDemolish.z)
  assert.ok(parkingRemoved.ok, parkingRemoved.message)
  assert.equal(
    parkingDemolish.game.snapshot.logistics.parkingCells.some(
      (cell) => cell.x === parkingDemolish.x && cell.z === parkingDemolish.z,
    ),
    false,
  )
  assert.ok(parkingDemolish.game.canPlace('food', parkingDemolish.x, parkingDemolish.z).ok)
  assert.ok(parkingDemolish.game.place('food', parkingDemolish.x, parkingDemolish.z).ok)

  const bedDemolish = occupancyTile('bed')
  assert.ok(bedDemolish.game.designateMedicalArea([{ x: bedDemolish.x, z: bedDemolish.z }]).ok)
  assert.ok(bedDemolish.game.getMedicalCellAt(bedDemolish.x, bedDemolish.z))
  const bedRemoved = bedDemolish.game.bulldoze(bedDemolish.x, bedDemolish.z)
  assert.ok(bedRemoved.ok, bedRemoved.message)
  assert.equal(bedDemolish.game.getMedicalCellAt(bedDemolish.x, bedDemolish.z), undefined)
  assert.ok(bedDemolish.game.canPlace('food', bedDemolish.x, bedDemolish.z).ok)
  assert.ok(bedDemolish.game.place('food', bedDemolish.x, bedDemolish.z).ok)

  const leftoverParking = occupancyTile('leftover-parking')
  assert.ok(leftoverParking.game.designateParkingArea([{ x: leftoverParking.x, z: leftoverParking.z }]).ok)
  leftoverParking.game.snapshot.logistics.parkingCells[0]!.occupiedBy = 'missing-car'
  const leftoverParkingCleared = leftoverParking.game.bulldoze(
    leftoverParking.x,
    leftoverParking.z,
    'stale-building',
  )
  assert.ok(leftoverParkingCleared.ok, leftoverParkingCleared.message)
  assert.equal(leftoverParking.game.snapshot.logistics.parkingCells.length, 0)
  assert.ok(leftoverParking.game.canPlace('food', leftoverParking.x, leftoverParking.z).ok)

  const leftoverBed = occupancyTile('leftover-bed')
  assert.ok(leftoverBed.game.designateMedicalArea([{ x: leftoverBed.x, z: leftoverBed.z }]).ok)
  leftoverBed.game.snapshot.medicalCells[0]!.occupants[0] = 'missing-patient'
  const leftoverBlocked = leftoverBed.game.place('food', leftoverBed.x, leftoverBed.z)
  assert.equal(leftoverBlocked.ok, false, leftoverBlocked.message)
  assert.ok(leftoverBed.game.getMedicalCellAt(leftoverBed.x, leftoverBed.z), 'solid buildings must not eat vacant leftover beds')

  const roofOverBed = occupancyTile('roof-over-bed')
  assert.ok(roofOverBed.game.designateMedicalArea([{ x: roofOverBed.x, z: roofOverBed.z }]).ok)
  const roofAllowed = roofOverBed.game.canPlace('roofAdobeFlat', roofOverBed.x, roofOverBed.z)
  assert.ok(roofAllowed.ok, roofAllowed.message)
  assert.ok(roofOverBed.game.place('roofAdobeFlat', roofOverBed.x, roofOverBed.z).ok)
  assert.ok(roofOverBed.game.getMedicalCellAt(roofOverBed.x, roofOverBed.z), 'a roof must leave the medical cell in place')
  assert.ok(
    roofOverBed.game.snapshot.buildings.some(
      (building) =>
        building.kind === 'roofAdobeFlat' &&
        building.x === roofOverBed.x &&
        building.z === roofOverBed.z,
    ),
  )
  const adjacentFood = roofOverBed.game.place('food', roofOverBed.x + 2, roofOverBed.z)
  assert.ok(adjacentFood.ok, adjacentFood.message)
  assert.ok(roofOverBed.game.getMedicalCellAt(roofOverBed.x, roofOverBed.z))
  const solidOnBed = roofOverBed.game.canPlace('food', roofOverBed.x, roofOverBed.z)
  assert.equal(solidOnBed.ok, false, 'a solid building on the medical tile must refuse instead of replacing the spot')
  assert.equal(roofOverBed.game.place('food', roofOverBed.x, roofOverBed.z).ok, false)
  assert.ok(roofOverBed.game.getMedicalCellAt(roofOverBed.x, roofOverBed.z))
  const medicalRoute = (roofOverBed.game as any).findPath(
    { x: roofOverBed.x + 1, z: roofOverBed.z, elevation: 0 },
    [{ x: roofOverBed.x, z: roofOverBed.z, elevation: 0 }],
    false,
    false,
    true,
  )
  assert.ok(medicalRoute && medicalRoute.length > 0, 'guests still path onto a roofed medical cell')

  const medicalUnderRoof = occupancyTile('medical-under-roof')
  assert.ok(medicalUnderRoof.game.place('roofAdobeFlat', medicalUnderRoof.x, medicalUnderRoof.z).ok)
  assert.ok(
    medicalUnderRoof.game.designateMedicalArea([{ x: medicalUnderRoof.x, z: medicalUnderRoof.z }]).ok,
    'a roof must not occupy the medical ground layer',
  )
  assert.ok(medicalUnderRoof.game.getMedicalCellAt(medicalUnderRoof.x, medicalUnderRoof.z))

  const ghostSave = structuredClone(new GameState().snapshot) as GameSnapshot
  ghostSave.logistics.parkingCells = [{ x: 9, z: -16, occupiedBy: 'gone-car' }]
  ghostSave.medicalCells = [{ x: 10, z: -16, elevation: 0, occupants: ['gone-patient', null, null] }]
  const repaired = new GameState(ghostSave)
  repaired.addDebugMoney()
  assert.equal(repaired.snapshot.logistics.parkingCells[0]!.occupiedBy, null)
  assert.ok(repaired.snapshot.medicalCells[0]!.occupants.every((occupant) => occupant === null))
  assert.ok(repaired.bulldoze(9, -16).ok)
  assert.equal(repaired.canPlace('food', 10, -16).ok, false)
  assert.equal(repaired.place('food', 10, -16).ok, false)
  assert.equal(repaired.snapshot.logistics.parkingCells.length, 0)
  assert.equal(repaired.snapshot.medicalCells.length, 1)
  assert.ok(repaired.bulldoze(10, -16).ok)
  assert.equal(repaired.snapshot.medicalCells.length, 0)
  assert.ok(repaired.place('food', 10, -16).ok)

  const wasteGuest = (game: GameState, z: number) => {
    const guest = game.snapshot.visitors[0]!
    Object.assign(guest, {
      state: 'exploring',
      route: [],
      targetId: null,
      cellX: 3,
      cellZ: z,
      cellElevation: 0,
      x: 3.5,
      z: z + 0.5,
      pendingWaste: 0,
    })
    return guest
  }
  const packedBinGame = fixture(1)
  packedBinGame.addDebugMoney()
  const packedGuest = wasteGuest(packedBinGame, -20)
  assert.ok(packedBinGame.place('wasteBin', 3, -20).ok)
  const packedBin = packedBinGame.snapshot.buildings.find((building) => building.kind === 'wasteBin')!
  packedBin.wasteFill = SIMULATION_CONFIG.waste.binCapacity
  const litterBefore = packedBinGame.snapshot.incidents.filter((incident) => incident.kind === 'litter').length
  ;(packedBinGame as any).giveWaste(packedGuest, 1)
  assert.equal(packedGuest.pendingWaste, 0, 'a full nearby bin makes guests drop litter immediately')
  assert.ok(
    packedBinGame.snapshot.incidents.some(
      (incident) =>
        incident.kind === 'litter' &&
        incident.x === packedGuest.cellX &&
        incident.z === packedGuest.cellZ,
    ),
    'dropped waste becomes ground litter on the current cell',
  )
  assert.ok(
    packedBinGame.snapshot.incidents.filter((incident) => incident.kind === 'litter').length > litterBefore,
  )
  assert.notEqual(packedGuest.state, 'seeking', 'they do not keep seeking a full bin')
  assert.equal(packedGuest.targetId, null)
  for (let i = 0; i < 8; i++) packedBinGame.tick(0.1)
  assert.equal(packedGuest.pendingWaste, 0)
  assert.ok(
    packedGuest.route.length > 0 ||
      packedGuest.state === 'relaxing' ||
      packedGuest.state === 'partying' ||
      packedGuest.state === 'bench-resting' ||
      packedGuest.state === 'seeking',
    'after dropping they take another action instead of standing idle',
  )
  if (packedGuest.state === 'seeking') {
    assert.notEqual(packedGuest.targetId, packedBin.id, 'they do not wait at the full bin')
    assert.ok(packedGuest.route.length > 0, 'a later seek has a real route')
  }

  const emptyBinGame = fixture(1)
  emptyBinGame.addDebugMoney()
  const emptyGuest = wasteGuest(emptyBinGame, -18)
  assert.ok(emptyBinGame.place('wasteBin', 3, -16).ok)
  const emptyBin = emptyBinGame.snapshot.buildings.find((building) => building.kind === 'wasteBin')!
  emptyBin.wasteFill = 0
  const emptyLitter = emptyBinGame.snapshot.incidents.filter((incident) => incident.kind === 'litter').length
  ;(emptyBinGame as any).giveWaste(emptyGuest, 1)
  assert.equal(emptyGuest.pendingWaste, 1, 'guests keep waste while walking to a bin with space')
  assert.equal(emptyGuest.targetId, emptyBin.id)
  assert.ok(emptyGuest.route.length > 0, 'they route to the empty bin')
  assert.equal(
    emptyBinGame.snapshot.incidents.filter((incident) => incident.kind === 'litter').length,
    emptyLitter,
    'an empty nearby bin is used instead of dropping litter',
  )
  for (let i = 0; i < 40; i++) emptyBinGame.tick(0.1)
  assert.equal(emptyGuest.pendingWaste, 0)
  assert.ok((emptyBin.wasteFill ?? 0) >= 1, 'the empty bin receives the waste')
  assert.equal(
    emptyBinGame.snapshot.incidents.filter((incident) => incident.kind === 'litter').length,
    emptyLitter,
    'using a bin with space does not spawn litter',
  )

  const huntGame = fixture(1)
  huntGame.addDebugMoney()
  const huntGuest = wasteGuest(huntGame, -20)
  assert.ok(huntGame.place('wasteBin', 3, -20).ok)
  assert.ok(huntGame.place('wasteBin', 3, -14).ok)
  const nearFull = huntGame.snapshot.buildings.find(
    (building) => building.kind === 'wasteBin' && building.z === -20,
  )!
  const farEmpty = huntGame.snapshot.buildings.find(
    (building) => building.kind === 'wasteBin' && building.z === -14,
  )!
  nearFull.wasteFill = SIMULATION_CONFIG.waste.binCapacity
  farEmpty.wasteFill = 0
  ;(huntGame as any).giveWaste(huntGuest, 1)
  assert.equal(huntGuest.pendingWaste, 0, 'a full local bin is not skipped to hunt a farther one')
  assert.notEqual(huntGuest.targetId, farEmpty.id)
  assert.equal(farEmpty.wasteFill, 0)
  assert.ok(
    huntGame.snapshot.incidents.some(
      (incident) => incident.kind === 'litter' && incident.x === 3 && incident.z === -20,
    ),
  )

  console.log('PASS planned festival start, stand clearance, staff gates, automatic depot delivery, stock conservation and cleaning chain')
}
