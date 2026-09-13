import assert from 'node:assert/strict'
import { GameState, type GameSnapshot } from '../src/game/GameState'
import { createScenarioEntrance } from '../src/game/scenario'
import { emptyStock, orderGoods } from '../src/game/supplyChain'
import { updateDepotCarriers } from '../src/game/depotCarriers'
import { createStaffMember } from '../src/game/staff'
import { StaffSimulation } from '../src/game/staffSimulation'
import { DeterministicRng } from '../src/game/rng'
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
  describeRoadVehicleActivity,
  describeRoadVehicleDestination,
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
  ss.festival.infrastructure.shops[shop.id]={food:3,drinks:0,water:0}
  buyer.targetId=shop.id;buyer.budget=100;buyer.state='using';buyer.cellX=4;buyer.cellZ=-20;buyer.cellElevation=0
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
  }

  const gates=fixture(0), from={x:2,z:-20,elevation:0}, gate={x:3,z:-20,elevation:0}
  assert.ok((gates as any).findPath(from,[gate]))
  assert.ok(gates.manageFestival({type:'staffGate',...gate}).ok)
  assert.equal((gates as any).findPath(from,[gate]),null,'guests cannot enter staff gates, including cached routes')
  assert.ok((gates as any).findPath(from,[gate],false,false,false,false,false,undefined,true),'staff can enter the same gate')
  gates.addDebugMoney()
  assert.ok(gates.place('securityGate',4,-20).ok)
  const admission=gates.snapshot.buildings.find(b=>b.kind==='securityGate')!
  assert.ok(gates.updateSecurityGate(admission.id,{flowShare:.35}).ok)
  assert.equal(admission.securityConfig?.flowShare,.35,'festival entrances store their visitor-flow share')

  const game=fixture(0), s=game.snapshot as GameSnapshot, i=s.festival.infrastructure
  game.addDebugMoney()
  const source={id:'receiving',x:1,z:-20,role:'delivery' as const,distribution:'relay' as const,stock:{food:200,drinks:0,water:0},minimum:emptyStock()}
  const depot={id:'store',x:1,z:-16,role:'storage' as const,distribution:'shops' as const,stock:emptyStock(),minimum:{food:80,drinks:0,water:0}}
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
  const padA={id:'pad-a',x:1,z:-20,role:'delivery' as const,distribution:'shops' as const,stock:{food:200,drinks:0,water:0},minimum:{food:200,drinks:0,water:0}}
  const padB={id:'pad-b',x:5,z:-20,role:'delivery' as const,distribution:'shops' as const,stock:emptyStock(),minimum:{food:200,drinks:0,water:0}}
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
    id:'service-depot',x:1,z:-17,stock:{food:0,drinks:0,water:0},minimum:{food:0,drinks:0,water:0},
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
  assert.equal(oneway.route[0]?.z,-20,'on a one-way it still reverses instead of turning around')
  assert.equal(oneway.facing,0,'it does not flip and drive against the lane')
  ;(against as any).updateLogistics(1)
  assert.equal(oneway.cell?.z,-20)
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
  }),'Wartet, bis die Fahrbahn frei ist')
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
  for (let n=0;n<160;n+=1) sweepGame.tick(0.25)
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

  const plazaShop=fixture(0)
  plazaShop.addDebugMoney()
  const plazaState=plazaShop.snapshot as GameSnapshot
  assert.ok(plazaShop.designateStageForecourt([{x:5,z:-16},{x:6,z:-16}]).ok)
  assert.ok(plazaShop.place('food',7,-16).ok)
  const remoteStand=plazaState.buildings.find(building=>building.kind==='food')!
  plazaState.festival.infrastructure.depots.push({
    id:'plaza-pad',x:1,z:-20,role:'delivery',distribution:'shops',
    stock:{food:80,drinks:0,water:0},minimum:{food:80,drinks:0,water:0},
  })
  assert.ok(plazaShop.manageFestival({type:'depotSettings',depotId:'plaza-pad',distribution:'shops',workers:1}).ok)
  const plazaWalk=(start:any,goals:any)=>(plazaShop as any).findPath(start,goals,false,false,false,false,true,undefined,true)
  for (let n=0;n<200;n+=1) updateDepotCarriers(plazaState,1,plazaWalk,(from,to)=>(plazaShop as any).canCarrierStep(from,to))
  assert.ok(
    (plazaState.festival.infrastructure.shops[remoteStand.id]?.food??0)>0,
    'delivery workers take goods across the dance floor to a stall without a path edge',
  )

  console.log('PASS planned festival start, stand clearance, staff gates, automatic depot delivery, stock conservation and cleaning chain')
}
