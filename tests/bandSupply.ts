import assert from 'node:assert/strict'
import { Group } from 'three'
import { GameState } from '../src/game/GameState'
import type { GameSnapshot } from '../src/game/GameState'
import { applyGameCommand } from '../src/net/commands'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import { bandLeaveMinute } from '../src/game/bandSupply'
import { bandCostumeId, bandRoles } from '../src/game/bandLooks'
import { updateStageBand } from '../src/view/stageBand'

const CONFIG = SIMULATION_CONFIG.bandSupply

function prepare(fixture: (count?: number) => GameState, guests = 1): GameState {
  const game = fixture(guests)
  game.addDebugMoney()
  game.manageFestival({ type: 'ground', x: 6, z: -20, kind: 'drain' })
  game.manageFestival({ type: 'ground', x: 6, z: -20, kind: 'compact' })
  game.manageFestival({ type: 'ground', x: 10, z: -20, kind: 'drain' })
  game.manageFestival({ type: 'ground', x: 10, z: -20, kind: 'compact' })
  assert.ok(game.place('stage', 6, -20).ok)
  assert.ok(game.manageFestival({ type: 'start' }).ok)
  return game
}

function paintBackstage(
  game: GameState,
  cells: Array<{ x: number; z: number }>,
): void {
  const result = applyGameCommand(game, {
    type: 'designateBackstageArea',
    cells,
    enabled: true,
  })
  assert.ok(result.ok, result.message)
}

function connectRoad(game: GameState, x: number, toZ: number): void {
  const edge = -game.snapshot.scenario.worldSize / 2
  for (let z = edge; z <= toZ; z++) {
    if (game.snapshot.logistics.roadCells.some((cell) => cell.x === x && cell.z === z)) {
      continue
    }
    const result = game.designateRoad([{ x, z }])
    assert.ok(result.ok, `${x},${z}: ${result.message}`)
  }
}

function bookOnStage(
  game: GameState,
  stageId: string,
  bands: Array<{ bandId: string; start: number }>,
): void {
  const snapshot = game.snapshot as GameSnapshot
  snapshot.festival.bookings = bands.map((item, index) => ({
    id: `band-supply-book-${index}`,
    bandId: item.bandId,
    stageId,
    day: snapshot.day,
    start: item.start,
    duration: 60,
    fee: 0,
  }))
}

export function testBandSupply(fixture: (count?: number) => GameState): void {
  const bare = prepare(fixture, 0)
  const bareStage = bare.snapshot.buildings.find((building) => building.kind === 'stage')!
  bookOnStage(bare, bareStage.id, [{ bandId: 'lantern', start: 840 }])
  const bareStats = bare.getBandSupplyForStage(bareStage.id)!
  assert.ok(bareStats.bareStage, 'a stage without backstage stays a bare stage')
  assert.equal(bareStats.attractiveness, CONFIG.bareStageAttractiveness)
  const bareSatisfaction = bareStats.satisfaction
  const bareQuality = bare.showQualityForStage(bareStage.id)
  assert.ok(bareQuality < CONFIG.maxShowQuality)

  paintBackstage(bare, [
    { x: 5, z: -20 },
    { x: 4, z: -20 },
    { x: 3, z: -20 },
    { x: 2, z: -20 },
    { x: 1, z: -20 },
    { x: 1, z: -19 },
    { x: 1, z: -18 },
  ])
  connectRoad(bare, 0, -18)
  assert.ok(bare.place('tourBusParking', 1, -20).ok, 'parking is accepted on designated backstage next to a road')
  assert.ok(bare.place('statue', 5, -20).ok, 'scenery remains placeable on backstage')
  assert.ok(bare.place('food', 6, -16).ok)
  assert.ok(bare.place('alcohol', 7, -16).ok)
  const supplied = bare.getBandSupplyForStage(bareStage.id)!
  assert.equal(supplied.bareStage, false)
  assert.ok(
    supplied.satisfaction > bareSatisfaction,
    'supplied backstage raises Bandzufriedenheit versus the same bare stage',
  )
  assert.ok(
    supplied.showQuality > bareQuality,
    'supplied backstage raises showQuality versus the same bare stage',
  )
  assert.ok(supplied.foodCount >= 1 && supplied.drinkCount >= 1)
  assert.ok(supplied.decoScore > 0)

  const shared = prepare(fixture, 0)
  const first = shared.snapshot.buildings.find((building) => building.kind === 'stage')!
  assert.ok(shared.place('stage', 10, -20).ok)
  const second = shared.snapshot.buildings.find(
    (building) => building.kind === 'stage' && building.id !== first.id,
  )!
  paintBackstage(shared, [
    { x: 7, z: -20 },
    { x: 8, z: -20 },
    { x: 9, z: -20 },
  ])
  const beforeA = shared.getBandSupplyForStage(first.id)!
  const beforeB = shared.getBandSupplyForStage(second.id)!
  assert.equal(beforeA.componentId, beforeB.componentId, 'connected stages share one component')
  assert.equal(beforeA.showQuality, beforeB.showQuality)
  assert.deepEqual(beforeA, beforeB, 'connected stages share one stats object')
  const decoBefore = beforeA.decoScore
  assert.ok(shared.place('statue', 8, -20).ok)
  const afterA = shared.getBandSupplyForStage(first.id)!
  const afterB = shared.getBandSupplyForStage(second.id)!
  assert.equal(afterA.decoScore, afterB.decoScore)
  assert.equal(afterA.showQuality, afterB.showQuality)
  assert.ok(afterA.decoScore > decoBefore, 'one deco raise is shared, not stacked per stage')
  assert.equal(afterA.decoScore, afterB.decoScore)

  const parking = prepare(fixture, 0)
  const parkingStage = parking.snapshot.buildings.find((building) => building.kind === 'stage')!
  bookOnStage(parking, parkingStage.id, [
    { bandId: 'lantern', start: 720 },
    { bandId: 'sugar', start: 820 },
    { bandId: 'velvet', start: 920 },
  ])
  paintBackstage(parking, [
    { x: 5, z: -20 },
    { x: 4, z: -20 },
    { x: 3, z: -20 },
    { x: 2, z: -20 },
    { x: 1, z: -20 },
    { x: 1, z: -19 },
    { x: 1, z: -18 },
  ])
  connectRoad(parking, 0, -18)
  assert.ok(parking.place('tourBusParking', 1, -20).ok)
  assert.ok(parking.place('tourBusParking', 1, -19).ok)
  const twoOfThree = parking.getBandSupplyForStage(parkingStage.id)!
  assert.equal(twoOfThree.busDemand, 3)
  assert.equal(twoOfThree.usableSlots, 2)
  assert.ok(
    twoOfThree.parkingTerm < CONFIG.parkingFullAttractivenessBonus,
    '2 usable slots for 3 bus-bands do not reach the full parking bonus',
  )
  assert.equal(twoOfThree.parkingSufficient, false)
  assert.ok(parking.place('tourBusParking', 1, -18).ok)
  const threeOfThree = parking.getBandSupplyForStage(parkingStage.id)!
  assert.equal(threeOfThree.usableSlots, 3)
  assert.equal(threeOfThree.parkingTerm, CONFIG.parkingFullAttractivenessBonus)
  assert.equal(threeOfThree.parkingSufficient, true)

  const fans = prepare(fixture, 1)
  const fanStage = fans.snapshot.buildings.find((building) => building.kind === 'stage')!
  paintBackstage(fans, [
    { x: 5, z: -20 },
    { x: 4, z: -20 },
  ])
  assert.ok(fans.place('statue', 5, -20).ok)
  const emptyAttractiveness = fans.getBandSupplyForStage(fanStage.id)!.attractiveness
  assert.ok(emptyAttractiveness > 0, 'deco gives Attraktivität room to fall')
  const guest = fans.snapshot.visitors[0]!
  guest.backstageIntrusion = true
  guest.cellX = 5
  guest.cellZ = -20
  guest.x = 5.5
  guest.z = -19.5
  const leaked = fans.getBandSupplyForStage(fanStage.id)!
  assert.ok(leaked.fansOnActiveTiles >= 1)
  assert.ok(
    leaked.attractiveness < emptyAttractiveness,
    'a fan on active backstage lowers Attraktivität',
  )
  assert.equal(leaked.fanPenalty, CONFIG.fanAttractivenessPenaltyPerFan)

  const clock = prepare(fixture, 0)
  const clockStage = clock.snapshot.buildings.find((building) => building.kind === 'stage')!
  bookOnStage(clock, clockStage.id, [{ bandId: 'lantern', start: 840 }])
  paintBackstage(clock, [
    { x: 5, z: -20 },
    { x: 4, z: -20 },
    { x: 3, z: -20 },
    { x: 2, z: -20 },
    { x: 1, z: -20 },
  ])
  connectRoad(clock, 0, -20)
  assert.ok(clock.place('tourBusParking', 1, -20).ok)
  clock.snapshot.minute = CONFIG.busArriveHour * 60 - 1
  clock.syncBandSupply()
  assert.equal(clock.snapshot.bandActors.length, 0, 'bus-arrival bands are not on site before 08:00')
  clock.snapshot.minute = CONFIG.busArriveHour * 60
  clock.syncBandSupply()
  const arrived = clock.snapshot.bandActors.find((actor) => actor.bandId === 'lantern')
  assert.ok(arrived, 'a bus-arrival band is present after busArriveHour')
  assert.equal(arrived!.arrivalMode, 'tourBus')
  assert.equal(arrived!.costumeId, bandCostumeId('lantern'))
  assert.equal(
    clock.snapshot.bandActors.filter((actor) => actor.bandId === 'lantern').length,
    bandRoles('lantern').length,
    'the booked act arrives as its full lineup',
  )
  assert.ok(
    clock.snapshot.logistics.roadVehicles.some((vehicle) => vehicle.kind === 'tourBus'),
    'the tour bus spawns for a slotted bus-arrival band',
  )
  const pad = clock.snapshot.buildings.find((building) => building.kind === 'tourBusParking')!
  const backstageKeys = new Set(
    clock.snapshot.backstageCells.map((cell) => `${cell.x},${cell.z}`),
  )
  for (let i = 0; i < 200; i++) {
    const bus = clock.snapshot.logistics.roadVehicles.find((vehicle) => vehicle.kind === 'tourBus')
    const parkedOnPad =
      bus?.state === 'parked' &&
      Math.abs(bus.position.x - pad.x) <= 0 &&
      Math.abs(bus.position.z - pad.z) <= 0
    if (parkedOnPad) break
    clock.tick(0.1)
  }
  const parked = clock.snapshot.logistics.roadVehicles.find((vehicle) => vehicle.kind === 'tourBus')
  assert.ok(parked, 'the tour bus stays after arrival instead of despawning')
  assert.equal(parked!.state, 'parked')
  assert.equal(parked!.position.x, pad.x)
  assert.equal(parked!.position.z, pad.z)
  assert.ok(
    clock.snapshot.bandActors.some(
      (actor) =>
        actor.bandId === 'lantern' &&
        !actor.vehicleId &&
        actor.state === 'idle' &&
        backstageKeys.has(`${actor.cellX},${actor.cellZ}`),
    ),
    'idle band members occupy the active backstage after they leave the bus',
  )
  const stageLook = new Group()
  updateStageBand(stageLook, 'lantern', 0, true)
  assert.equal(
    stageLook.userData.band.userData.costumeId,
    arrived!.costumeId,
    'backstage actors and stage performers share the same costume id for the band',
  )
  const leave = bandLeaveMinute(
    clock.snapshot.festival.bookings,
    'lantern',
    clock.snapshot.day,
  )
  clock.snapshot.minute = leave
  clock.syncBandSupply()
  assert.ok(
    clock.snapshot.bandActors.some((actor) => actor.bandId === 'lantern'),
    'the band stays visible while the evening bus departs',
  )
  assert.ok(
    clock.snapshot.logistics.roadVehicles.some((vehicle) => vehicle.kind === 'tourBus'),
  )
  for (let i = 0; i < 200; i++) {
    if (
      !clock.snapshot.bandActors.some((actor) => actor.bandId === 'lantern') &&
      !clock.snapshot.logistics.roadVehicles.some((vehicle) => vehicle.kind === 'tourBus')
    ) {
      break
    }
    clock.tick(0.1)
  }
  assert.equal(
    clock.snapshot.bandActors.some((actor) => actor.bandId === 'lantern'),
    false,
    'the band is gone after evening leave',
  )
  assert.equal(
    clock.snapshot.logistics.roadVehicles.some((vehicle) => vehicle.kind === 'tourBus'),
    false,
  )

  const placement = prepare(fixture, 0)
  connectRoad(placement, 0, -20)
  assert.equal(
    placement.place('tourBusParking', 1, -20).ok,
    false,
    'tourBusParking is rejected off backstage',
  )
  assert.equal(
    placement.place('tourBusParking', 4, -16).ok,
    false,
    'tourBusParking is rejected on ordinary grass',
  )
  const painted = placement.designateBackstageArea([
    { x: 1, z: -20 },
    { x: 5, z: -20 },
    { x: 6, z: -19 },
  ])
  assert.ok(painted.ok, painted.message)
  assert.ok(placement.getBackstageCellAt(5, -20), 'adjacent tiles next to the stage stay designated')
  assert.ok(placement.getBackstageCellAt(1, -20))
  assert.ok(
    placement.place('tourBusParking', 1, -20).ok,
    'tourBusParking is accepted on designated backstage next to a road',
  )
  assert.ok(placement.place('tree', 5, -20).ok, 'ordinary scenery can sit on backstage')
  assert.ok(
    placement.place('food', 6, -19).ok,
    'ordinary buildings remain placeable on designated backstage',
  )
  assert.ok(
    placement.getBackstageCellAt(6, -19),
    'placing a building must not erase the backstage overlay',
  )

  const orphan = prepare(fixture, 0)
  const orphanStage = orphan.snapshot.buildings.find((building) => building.kind === 'stage')!
  const disconnectedCells = [
    { x: 18, z: 8 },
    { x: 19, z: 8 },
    { x: 20, z: 8 },
  ]
  const markedOrphan = orphan.designateBackstageArea(disconnectedCells)
  assert.ok(markedOrphan.ok, 'disconnected tiles stay markable even without a stage link')
  assert.ok(orphan.getBackstageCellAt(18, 8))
  assert.ok(orphan.designateRoad([{ x: 17, z: 8 }]).ok)
  assert.ok(orphan.place('statue', 20, 8).ok)
  assert.ok(orphan.place('tourBusParking', 18, 8).ok, 'supply buildings may sit on inactive backstage')
  orphan.getBandSupplyForStage(orphanStage.id)
  const inactive = orphan.snapshot.bandSupply.components.find(
    (component) => !component.active && component.designatedTiles >= 3,
  )
  assert.ok(inactive, 'tiles with no 4-neighbour path to a stage stay inactive')
  assert.equal(inactive!.activeTiles, 0)
  assert.equal(inactive!.decoScore, 0)
  assert.equal(inactive!.parkingTerm, 0)
  const stillBare = orphan.getBandSupplyForStage(orphanStage.id)!
  assert.ok(stillBare.bareStage, 'a disconnected region does not supply the stage')
  assert.equal(stillBare.showQuality, bareQuality)

  const junior = prepare(fixture, 0)
  const juniorStage = junior.snapshot.buildings.find((building) => building.kind === 'stage')!
  assert.ok(junior.placePathSegment(3, -18, 0).ok)
  assert.ok(
    junior.manageFestival({ type: 'staffGate', x: 3, z: -18, elevation: 0 }).ok,
    'Personaleingang sits on a path',
  )
  const gate = junior.snapshot.buildings.find((building) => building.kind === 'path' && building.staffOnly)
  assert.ok(gate)
  paintBackstage(junior, [
    { x: 5, z: -20 },
    { x: 4, z: -20 },
    { x: 3, z: -20 },
    { x: 2, z: -20 },
    { x: 1, z: -20 },
  ])
  connectRoad(junior, 0, -20)
  assert.ok(junior.place('tourBusParking', 1, -20).ok)
  bookOnStage(junior, juniorStage.id, [{ bandId: 'meadow', start: 840 }])
  junior.snapshot.minute = CONFIG.busArriveHour * 60
  junior.syncBandSupply()
  const meadow = junior.snapshot.bandActors.find((actor) => actor.bandId === 'meadow')
  assert.ok(meadow, 'a junior band arrives on the booking day')
  assert.equal(meadow!.arrivalMode, 'staffGate')
  assert.equal(meadow!.costumeId, bandCostumeId('meadow'))
  assert.notEqual(bandCostumeId('meadow'), bandCostumeId('lantern'))
  assert.equal(meadow!.cellX, gate!.x)
  assert.equal(meadow!.cellZ, gate!.z)
  assert.equal(
    junior.snapshot.logistics.roadVehicles.some((vehicle) => vehicle.kind === 'tourBus'),
    false,
    'draw < 30 uses the Personaleingang, not a tour bus',
  )

  const unslotted = prepare(fixture, 0)
  const unslottedStage = unslotted.snapshot.buildings.find((building) => building.kind === 'stage')!
  assert.ok(unslotted.placePathSegment(3, -18, 0).ok)
  assert.ok(unslotted.manageFestival({ type: 'staffGate', x: 3, z: -18, elevation: 0 }).ok)
  const unslottedGate = unslotted.snapshot.buildings.find(
    (building) => building.kind === 'path' && building.staffOnly,
  )!
  paintBackstage(unslotted, [{ x: 5, z: -20 }])
  bookOnStage(unslotted, unslottedStage.id, [{ bandId: 'lantern', start: 840 }])
  unslotted.snapshot.minute = CONFIG.busArriveHour * 60
  unslotted.syncBandSupply()
  const lantern = unslotted.snapshot.bandActors.find((actor) => actor.bandId === 'lantern')
  assert.ok(lantern)
  assert.equal(lantern!.arrivalMode, 'staffGate', 'a bus-band without a usable slot uses the staff entrance')
  assert.equal(lantern!.cellX, unslottedGate.x)
  assert.equal(lantern!.cellZ, unslottedGate.z)
  assert.equal(
    unslotted.snapshot.logistics.roadVehicles.some((vehicle) => vehicle.kind === 'tourBus'),
    false,
  )
}
