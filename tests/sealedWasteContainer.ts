import assert from 'node:assert/strict'
import { AtmosphereSystem } from '../src/game/atmosphere'
import { GameState, type GameSnapshot } from '../src/game/GameState'
import { BUILDINGS } from '../src/game/catalog'
import { createStaffMember } from '../src/game/staff'
import { StaffSimulation } from '../src/game/staffSimulation'
import { DeterministicRng } from '../src/game/rng'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import {
  acceptWasteAtSealedContainer,
  isSealedWasteContainer,
  sealedContainerAllowsManualHaul,
  sealedContainerCapacity,
  sealedContainerHasRoom,
  sealedContainerId,
  type SealedWasteContainerInfo,
} from '../src/game/waste'

function nearestPath(start: { x: number; z: number }, goals: Array<{ x: number; z: number; elevation: number }>) {
  const nearest = goals
    .slice()
    .sort(
      (left, right) =>
        Math.abs(left.x - start.x) +
        Math.abs(left.z - start.z) -
        (Math.abs(right.x - start.x) + Math.abs(right.z - start.z)),
    )[0]
  return nearest ? [{ ...nearest }] : null
}

export function testSealedWasteContainer(fixture: (count?: number) => GameState): void {
  assert.equal(SIMULATION_CONFIG.waste.sealedContainerCapacity, 80)
  assert.equal(sealedContainerCapacity(), 80)
  assert.equal(BUILDINGS.sealedWasteContainer.capacity, 80)
  assert.ok(isSealedWasteContainer('sealedWasteContainer'))
  assert.equal(isSealedWasteContainer('wasteBin'), false)
  assert.ok(
    SIMULATION_CONFIG.waste.sealedContainerStoredBeautyPerBag >
      SIMULATION_CONFIG.waste.dumpStoredBeautyPerBag,
    'sealed bags must hurt attractiveness less than open dump bags',
  )

  const game = fixture(0)
  game.addDebugMoney()
  const placed = game.place('sealedWasteContainer', 4, -16)
  assert.ok(placed.ok, placed.message)
  const building = game.snapshot.buildings.find((item) => item.kind === 'sealedWasteContainer')!
  assert.equal(building.wasteFill, 0)
  assert.equal(acceptWasteAtSealedContainer(building, 80), 80)
  assert.equal(building.wasteFill, 80)
  assert.equal(acceptWasteAtSealedContainer(building, 5), 0, 'capacity 80 cannot overflow')
  assert.equal(sealedContainerHasRoom({ stored: 80 }), false)

  const staff = new StaffSimulation()
  const dump = { x: 8, z: 0, elevation: 0, stored: 0 }
  const nearContainer: SealedWasteContainerInfo = {
    id: 'sealed-near',
    x: 1,
    z: 0,
    elevation: 0,
    stored: 0,
    onRoad: false,
    truckReachable: false,
  }
  const farDump = { x: 10, z: 0, elevation: 0, stored: 0 }
  const cleaner = createStaffMember('sealed-prefer', 'cleaner', { x: 0, z: 0, elevation: 0 })
  cleaner.carryingWaste = 4
  cleaner.wasteFromBin = true
  const preferContext: any = {
    staff: [cleaner],
    visitors: [],
    incidents: [],
    medicalCells: [],
    wasteDumps: [farDump],
    wasteBins: [],
    sealedContainers: [nearContainer],
    securityGates: [],
    rng: new DeterministicRng(1),
    findPath: (start: any, goals: any[]) => nearestPath(start, goals),
    pathNeighbors: () => [],
    reserveBed: () => null,
    removeIncident: () => {},
    depositWaste: (_x: number, _z: number, n: number) => {
      farDump.stored += n
      return n
    },
    fillSealedContainer: (id: string, n: number) => {
      if (id !== nearContainer.id) return 0
      const added = Math.min(n, 80 - nearContainer.stored)
      nearContainer.stored += added
      return added
    },
    emptySealedContainer: () => 0,
    emptyBin: () => 0,
    fillBin: () => 0,
  }
  assert.equal((staff as any).sendCleanerToDump(cleaner, preferContext), true)
  assert.equal(cleaner.targetId, `deposit-sealed:${nearContainer.id}`, 'cleaner prefers the nearer sealed container')
  cleaner.route = []
  ;(staff as any).finishArrival(cleaner, preferContext)
  assert.equal(nearContainer.stored, 4)
  assert.equal(cleaner.carryingWaste, 0)
  assert.equal(farDump.stored, 0)

  const skipFull = createStaffMember('skip-full', 'cleaner', { x: 0, z: 0, elevation: 0 })
  skipFull.carryingWaste = 3
  skipFull.wasteFromBin = true
  const fullContainer: SealedWasteContainerInfo = {
    ...nearContainer,
    id: 'sealed-full',
    stored: 80,
  }
  const skipContext = {
    ...preferContext,
    staff: [skipFull],
    wasteDumps: [dump],
    sealedContainers: [fullContainer],
    depositWaste: (_x: number, _z: number, n: number) => {
      dump.stored += n
      return n
    },
  }
  assert.equal((staff as any).sendCleanerToDump(skipFull, skipContext), true)
  assert.ok(String(skipFull.targetId).startsWith('dump:'), 'a full container is skipped for the dump')
  skipFull.route = []
  ;(staff as any).finishArrival(skipFull, skipContext)
  assert.equal(dump.stored, 3)
  assert.equal(fullContainer.stored, 80)

  const bags = 40
  const dumpAtmosphere = new AtmosphereSystem().calculate(
    [],
    [],
    [],
    [],
    [{ x: 0, z: 0, elevation: 0, stored: bags }],
  )
  const sealedAtmosphere = new AtmosphereSystem().calculate(
    [
      {
        id: 'sealed-attr',
        kind: 'sealedWasteContainer',
        x: 0,
        z: 0,
        elevation: 0,
        rotation: 0,
        wasteFill: bags,
      },
    ],
    [],
    [],
    [],
  )
  const dumpBeauty = dumpAtmosphere.attractivenessValues.get('0,0,0') ?? 0
  const sealedBeauty = sealedAtmosphere.attractivenessValues.get('0,0,0') ?? 0
  assert.ok(dumpBeauty < 0 && sealedBeauty < 0, 'both waste piles reduce attractiveness')
  assert.ok(
    sealedBeauty > dumpBeauty,
    'sealed container penalty must be weaker than an open dump with the same bag count',
  )

  const idle = createStaffMember('idle-haul', 'cleaner', { x: 0, z: 0, elevation: 0 })
  const haulContainer: SealedWasteContainerInfo = {
    id: 'haul-box',
    x: 2,
    z: 0,
    elevation: 0,
    stored: 10,
    onRoad: false,
    truckReachable: false,
  }
  const haulDump = { x: 6, z: 0, elevation: 0, stored: 0 }
  const haulContext: any = {
    staff: [idle],
    visitors: [],
    incidents: [],
    medicalCells: [],
    wasteDumps: [haulDump],
    wasteBins: [],
    sealedContainers: [haulContainer],
    securityGates: [],
    rng: new DeterministicRng(2),
    findPath: (start: any, goals: any[]) => nearestPath(start, goals),
    pathNeighbors: () => [],
    reserveBed: () => null,
    removeIncident: () => {},
    depositWaste: (_x: number, _z: number, n: number) => {
      haulDump.stored += n
      return n
    },
    emptySealedContainer: (id: string, n: number) => {
      if (id !== haulContainer.id) return 0
      const taken = Math.min(n, haulContainer.stored)
      haulContainer.stored -= taken
      return taken
    },
    fillSealedContainer: () => 0,
    emptyBin: () => 0,
    fillBin: () => 0,
  }
  assert.equal(
    sealedContainerAllowsManualHaul(haulContainer),
    true,
    'an off-road box with no truck coming must allow a manual haul',
  )
  staff.update(haulContext, 0.1)
  assert.equal(idle.targetId, sealedContainerId(haulContainer.id), 'idle cleaner hauls an off-road container')
  idle.route = []
  ;(staff as any).finishArrival(idle, haulContext)
  assert.equal(idle.state, 'working')
  idle.workMinutes = 0
  ;(staff as any).finishWork(idle, haulContext)
  assert.equal(haulContainer.stored, 0)
  assert.equal(idle.carryingWaste, 10)
  assert.equal(idle.wasteFromSealedContainer, true)
  assert.ok(String(idle.targetId).startsWith('dump:'), 'hauled bags go to the dump, not another container')
  idle.route = []
  ;(staff as any).finishArrival(idle, haulContext)
  assert.equal(haulDump.stored, 10)
  assert.equal(idle.carryingWaste, 0)

  const busy = createStaffMember('busy-cleaner', 'cleaner', { x: 0, z: 0, elevation: 0 })
  const urgentBin = { id: 'urgent-bin', x: 1, z: 0, elevation: 0, stored: SIMULATION_CONFIG.waste.binCapacity }
  staff.update(
    {
      ...haulContext,
      staff: [busy],
      wasteBins: [urgentBin],
      sealedContainers: [{ ...haulContainer, stored: 10 }],
    },
    0.1,
  )
  assert.equal(busy.targetId, urgentBin.id, 'idle haul must not steal full-bin work')

  const roadsideIdle = createStaffMember('roadside-idle', 'cleaner', { x: 0, z: 0, elevation: 0 })
  const reachableBox: SealedWasteContainerInfo = {
    id: 'road-box',
    x: 2,
    z: 0,
    elevation: 0,
    stored: 10,
    onRoad: true,
    truckReachable: true,
    truckEnRoute: false,
  }
  assert.equal(
    sealedContainerAllowsManualHaul(reachableBox),
    true,
    'a roadside box still needs a manual haul when no truck is coming',
  )
  staff.update(
    {
      ...haulContext,
      staff: [roadsideIdle],
      sealedContainers: [reachableBox],
      wasteBins: [],
      emptySealedContainer: (id: string, n: number) => (id === reachableBox.id ? n : 0),
    },
    0.1,
  )
  assert.equal(
    roadsideIdle.targetId,
    sealedContainerId(reachableBox.id),
    'truckReachable alone must not starve the idle haul',
  )

  const skipEnRoute = createStaffMember('skip-en-route', 'cleaner', { x: 0, z: 0, elevation: 0 })
  const claimedBox: SealedWasteContainerInfo = { ...reachableBox, id: 'claimed-box', truckEnRoute: true }
  assert.equal(sealedContainerAllowsManualHaul(claimedBox), false)
  staff.update(
    {
      ...haulContext,
      staff: [skipEnRoute],
      sealedContainers: [claimedBox],
      wasteBins: [],
    },
    0.1,
  )
  assert.equal(skipEnRoute.targetId, null, 'a truck already en route may skip the manual haul')

  const roadside = fixture(0)
  roadside.addDebugMoney()
  const roadState = roadside.snapshot as GameSnapshot
  const edge = -roadState.scenario.worldSize / 2
  for (let z = edge; z <= -16; z += 1) {
    if (!roadState.logistics.roadCells.some((cell) => cell.x === 0 && cell.z === z)) {
      assert.ok(roadside.designateRoad([{ x: 0, z }]).ok)
    }
  }
  assert.ok(roadside.place('wasteDepot', -2, -18).ok)
  assert.ok(roadside.buyGarbageTruck(roadState.logistics.wasteDepots[0]!.id).ok)
  const truck = roadState.logistics.roadVehicles.find((vehicle) => vehicle.kind === 'garbageTruck')!
  assert.ok(roadside.place('sealedWasteContainer', 0, -17).ok)
  const onRoad = roadState.buildings.find((item) => item.kind === 'sealedWasteContainer')!
  onRoad.wasteFill = 12
  assert.ok(roadside.isSealedWasteContainerOnRoad(onRoad))
  truck.state = 'idle'
  truck.cargo = 0
  truck.cell = { x: 0, z: -17 }
  truck.position = { x: 0, z: -17 }
  truck.route = []
  ;(roadside as any).dispatchGarbageTruck(truck)
  assert.equal(truck.target?.kind, 'sealedWasteContainer')
  if (truck.target?.kind === 'sealedWasteContainer') {
    assert.equal(truck.target.buildingId, onRoad.id)
  }
  truck.state = 'responding'
  truck.route = []
  ;(roadside as any).finishGarbageTruckLeg(truck)
  assert.equal(onRoad.wasteFill, 0, 'a roadside sealed container is emptied by the garbage truck')
  assert.equal(truck.cargo, 12)

  const grass = fixture(0)
  grass.addDebugMoney()
  const grassState = grass.snapshot as GameSnapshot
  for (let z = -grassState.scenario.worldSize / 2; z <= -16; z += 1) {
    if (!grassState.logistics.roadCells.some((cell) => cell.x === 0 && cell.z === z)) {
      assert.ok(grass.designateRoad([{ x: 0, z }]).ok)
    }
  }
  assert.ok(grass.place('wasteDepot', -2, -18).ok)
  assert.ok(grass.buyGarbageTruck(grassState.logistics.wasteDepots[0]!.id).ok)
  const grassTruck = grassState.logistics.roadVehicles.find((vehicle) => vehicle.kind === 'garbageTruck')!
  assert.ok(grass.place('sealedWasteContainer', 4, -16).ok)
  const offRoad = grassState.buildings.find((item) => item.kind === 'sealedWasteContainer')!
  offRoad.wasteFill = 15
  assert.equal(grass.isSealedWasteContainerOnRoad(offRoad), false)
  grassState.wasteDumpCells.push({ x: 1, z: -16, elevation: 0, stored: 0 })
  grassTruck.state = 'idle'
  grassTruck.cargo = 0
  grassTruck.cell = { x: 0, z: -17 }
  grassTruck.position = { x: 0, z: -17 }
  grassTruck.route = []
  grassTruck.target = null
  ;(grass as any).dispatchGarbageTruck(grassTruck)
  assert.notEqual(
    grassTruck.target?.kind,
    'sealedWasteContainer',
    'an off-road sealed container is not truck-emptied',
  )
  grassTruck.target = {
    kind: 'sealedWasteContainer',
    buildingId: offRoad.id,
    x: offRoad.x,
    z: offRoad.z,
  }
  grassTruck.state = 'responding'
  ;(grass as any).finishGarbageTruckLeg(grassTruck)
  assert.equal(offRoad.wasteFill, 15, 'finish must refuse to empty a container that is not on a road')

  const loaded = GameState.fromJSON(JSON.stringify(roadState))!
  const restored = loaded.snapshot.buildings.find((item) => item.kind === 'sealedWasteContainer')
  assert.ok(restored)
  assert.equal(restored.wasteFill, 0)

  const live = fixture(0)
  live.addDebugMoney()
  live.snapshot.parkOpen = false
  live.snapshot.visitors = []
  live.snapshot.incidents = []
  assert.ok(live.designateWasteDump([{ x: 5, z: -16 }]).ok)
  assert.ok(live.place('sealedWasteContainer', 6, -16).ok)
  const liveBox = live.snapshot.buildings.find((item) => item.kind === 'sealedWasteContainer')!
  liveBox.wasteFill = 18
  assert.equal(live.isSealedWasteContainerOnRoad(liveBox), false)
  assert.ok(live.hireStaff('cleaner').ok)
  const liveCleaner = live.snapshot.staff.find((member) => member.role === 'cleaner')!
  assert.ok(live.placeStaffAt(liveCleaner.id, 4, -16).ok)
  const liveDump = live.snapshot.wasteDumpCells.find((cell) => cell.x === 5 && cell.z === -16)!
  const startFill = liveBox.wasteFill ?? 0
  live.snapshot.speed = 3
  let tookBags = false
  let delivered = false
  for (let step = 0; step < 240; step += 1) {
    live.tick(0.1)
    live.snapshot.incidents = []
    if ((liveBox.wasteFill ?? 0) < startFill) tookBags = true
    if (liveDump.stored > 0) delivered = true
    if (tookBags && delivered) break
  }
  assert.ok(tookBags, 'an idle cleaner must take bags from a filled off-road container')
  assert.ok(delivered, 'hauled bags must be delivered to the dump')
  assert.ok(liveDump.stored > 0)
  assert.ok((liveBox.wasteFill ?? 0) < startFill)

  const binFirst = fixture(0)
  binFirst.addDebugMoney()
  binFirst.snapshot.parkOpen = false
  binFirst.snapshot.visitors = []
  binFirst.snapshot.incidents = []
  assert.ok(binFirst.designateWasteDump([{ x: 5, z: -16 }]).ok)
  assert.ok(binFirst.place('sealedWasteContainer', 6, -16).ok)
  const waitBox = binFirst.snapshot.buildings.find((item) => item.kind === 'sealedWasteContainer')!
  waitBox.wasteFill = 18
  assert.ok(binFirst.place('wasteBin', 4, -15).ok)
  const fullBin = binFirst.snapshot.buildings.find((item) => item.kind === 'wasteBin')!
  fullBin.wasteFill = SIMULATION_CONFIG.waste.binCapacity
  assert.ok(binFirst.hireStaff('cleaner').ok)
  const binCleaner = binFirst.snapshot.staff.find((member) => member.role === 'cleaner')!
  assert.ok(binFirst.placeStaffAt(binCleaner.id, 4, -16).ok)
  binFirst.snapshot.speed = 1
  for (let step = 0; step < 8; step += 1) {
    binFirst.tick(0.1)
    if (binCleaner.targetId) break
  }
  assert.equal(binCleaner.targetId, fullBin.id, 'a full bin nearby is emptied before the sealed haul')
  assert.equal(waitBox.wasteFill, 18)

  console.log('PASS sealed waste containers: capacity, cleaner preference, attractiveness, truck vs haul')
}
