import assert from 'node:assert/strict'
import { Mesh, type Group } from 'three'
import { GameState } from '../src/game/GameState'
import type { GameSnapshot, Visitor } from '../src/game/GameState'
import { BUILD_CATEGORIES } from '../src/game/buildMenu'
import { BUILDINGS } from '../src/game/catalog'
import { FLAT_RIDE_TYPES, rideProfile } from '../src/game/flatRides'
import { buildingFootprint } from '../src/game/stageDesign'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import { enableMultiplayerCommands } from '../src/net/bind'
import type { GameCommand } from '../src/net/protocol'
import { animateFlatRide, createFlatRideModel, freefallHeight } from '../src/view/flatRideModels'

function prepareGround(game: GameState, x0: number, z0: number, width: number, depth: number): void {
  for (let x = x0 - 1; x < x0 + width + 1; x++) {
    for (let z = z0 - 1; z < z0 + depth + 1; z++) {
      for (const kind of ['drain', 'compact', 'pave'] as const) game.manageFestival({ type: 'ground', x, z, kind })
    }
  }
}

/**
 * C2 flat rides: chain swing, freefall tower, Ferris wheel, bumper cars and swinging
 * ship are ride types of the `ride` building. Each is in the build menu, covers its
 * footprint, costs its own price, takes gates beside any of its fields, runs guests for
 * its own time with its own fun and nausea, survives a save, is sent as one multiplayer
 * command and has an animated house-style model.
 */
export function testFlatRides(fixture: (count?: number) => GameState): void {
  const menu = BUILD_CATEGORIES.flatMap((category) => category.groups).flatMap((group) => group.items)
  for (const type of FLAT_RIDE_TYPES) {
    assert.ok(menu.some((item) => item.tool === 'ride' && item.rideType === type), `${type} is in the build menu`)
  }

  for (const type of FLAT_RIDE_TYPES) {
    const game = fixture(1)
    const s = game.snapshot as GameSnapshot
    game.addDebugMoney()
    const profile = rideProfile({ rideType: type })
    const cells = buildingFootprint({ kind: 'ride', x: 8, z: 0, rotation: s.buildRotation, rideType: type })
    const width = Math.max(...cells.map((cell) => cell.x)) - 7
    const depth = Math.max(...cells.map((cell) => cell.z)) + 1
    assert.equal(game.canPlaceRide(type, 8, 0).ok, false, `${type} needs a paved foundation on every field`)
    prepareGround(game, 8, 0, width, depth)
    const money = s.money
    const built = game.placeRide(type, 8, 0)
    assert.ok(built.ok, `${type}: ${built.message}`)
    const ride = s.buildings.at(-1)!
    assert.equal(ride.rideType, type)
    assert.equal(ride.price, profile.defaultPrice)
    assert.equal(money - s.money, profile.cost, `${type} costs its own price`)
    for (const cell of cells) {
      assert.equal(game.getAt(cell.x, cell.z)?.id, ride.id, `${type} covers ${cell.x},${cell.z}`)
      assert.equal(game.canPlace('food', cell.x, cell.z).ok, false, 'nothing else fits on a ride field')
    }
    assert.equal(game.parkValue() >= profile.cost, true)

    // Gates go beside any field, never on one; the far side of a wide ride is fine too.
    const farX = 8 + width
    assert.equal(game.canPlaceRideAccess(ride.id, 'entrance', 8, 0).ok, false, 'not on the ride')
    assert.ok(game.setRideAccess(ride.id, 'entrance', 7, 0).ok)
    assert.ok(game.setRideAccess(ride.id, 'exit', farX, 0).ok, `${type}: exit beside the far field`)
    game.placePathSegment(6, 0, 0, 'queue')
    game.placePathSegment(farX + 1, 0, 0)
    for (let x = 5; x <= farX + 1; x++) game.placePathSegment(x, -1, 0)
    game.placePathSegment(5, 0, 0)
    assert.equal(game.getRideAccessIssue(ride), null, `${type}: ${game.getRideAccessIssue(ride)}`)

    // A guest rides for this type's time and gets this type's fun.
    s.dayPlan.offers.rides.fill(true)
    ;(game as unknown as { poweredBuildingIds: Set<string> }).poweredBuildingIds.add(ride.id)
    const guest = s.visitors[0] as Visitor
    Object.assign(guest, { x: 6.5, y: 0, z: .5, cellX: 6, cellZ: 0, cellElevation: 0, route: [], targetId: ride.id, budget: 200, alcoholLevel: 0 })
    guest.needs.fun = 10
    ;(game as unknown as { startFacilityInteraction: (visitor: Visitor, target: typeof ride) => void }).startFacilityInteraction(guest, ride)
    assert.equal(guest.state, 'using')
    assert.equal(guest.interactionRemaining, profile.minutes)
    game.finishInteraction(guest)
    assert.equal(guest.state, 'exiting')
    assert.ok(guest.needs.fun >= 10 + profile.funGain - 1, `${type} fun gain`)
    assert.equal(guest.thought, profile.thought)

    const restored = GameState.fromJSON(JSON.stringify(s))!
    const saved = restored.snapshot.buildings.find((building) => building.id === ride.id)!
    assert.equal(saved.rideType, type, `${type} survives a save`)
    assert.equal(restored.getAt(cells.at(-1)!.x, cells.at(-1)!.z)?.id, ride.id, 'and still covers its footprint')
  }

  // Unknown ride types from a newer save load as carousels instead of breaking the game.
  const legacy = fixture(1)
  legacy.addDebugMoney()
  prepareGround(legacy, 8, 0, 1, 1)
  assert.ok(legacy.place('ride', 8, 0).ok)
  const legacyState = JSON.parse(JSON.stringify(legacy.snapshot)) as GameSnapshot
  ;(legacyState.buildings.at(-1)! as { rideType?: string }).rideType = 'loopingStarship'
  const reloaded = GameState.fromJSON(JSON.stringify(legacyState))!
  assert.equal(reloaded.snapshot.buildings.at(-1)!.rideType, undefined)
  assert.equal(rideProfile(reloaded.snapshot.buildings.at(-1)!).name, BUILDINGS.ride.name)

  // One optimistic multiplayer command per placement.
  const client = fixture(1)
  client.addDebugMoney()
  prepareGround(client, 8, 0, 3, 3)
  const sent: GameCommand[] = []
  client.networkMode = 'client'
  enableMultiplayerCommands(client)
  client.commandOutbox = (command) => { sent.push(command) }
  assert.ok(client.placeRide('chainSwing', 8, 0).ok, 'placed optimistically on the client')
  const placed = sent.filter((command) => command.type === 'placeRide')
  assert.equal(placed.length, 1, 'one command per placement')
  assert.deepEqual({ ...placed[0], clientCommandId: undefined, context: undefined }, { type: 'placeRide', rideType: 'chainSwing', x: 8, z: 0, clientCommandId: undefined, context: undefined })
  const host = fixture(1)
  host.addDebugMoney()
  prepareGround(host, 8, 0, 3, 3)
  host.schedulePublicCommand(sent.find((command) => command.type === 'placeRide')!)
  host.tick(.1)
  assert.equal(host.snapshot.buildings.at(-1)!.rideType, 'chainSwing', 'the host builds the same ride')

  // Models: every type builds, moves only with riders, and shares its part geometry.
  for (const type of FLAT_RIDE_TYPES) {
    const first = createFlatRideModel(type) as Group
    const second = createFlatRideModel(type) as Group
    const meshes = (group: Group) => { const list: Mesh[] = []; group.traverse((o) => { if (o instanceof Mesh) list.push(o) }); return list }
    assert.ok(meshes(first).length >= 2 && meshes(first).length <= 12, `${type}: a handful of parts`)
    assert.ok(meshes(first).every((mesh, i) => mesh.geometry === meshes(second)[i]!.geometry), `${type}: parts share geometry`)
    const pose = () => meshes(first).map((mesh) => mesh.matrixWorld.elements.map((n) => n.toFixed(3)).join()).join('|')
    first.updateMatrixWorld(true)
    animateFlatRide(first, 3.3, false)
    first.updateMatrixWorld(true)
    const idle = pose()
    animateFlatRide(first, 7.9, false)
    first.updateMatrixWorld(true)
    assert.equal(pose(), idle, `${type} stands still without riders`)
    animateFlatRide(first, 7.9, true)
    first.updateMatrixWorld(true)
    const moving = pose()
    animateFlatRide(first, 8.35, true)
    first.updateMatrixWorld(true)
    assert.notEqual(pose(), moving, `${type} moves while ridden`)
  }
  assert.ok(freefallHeight(.6) > freefallHeight(.1) && freefallHeight(.8) < freefallHeight(.6), 'climb, hold, drop')
  assert.ok(SIMULATION_CONFIG.rides.freefall.nausea > SIMULATION_CONFIG.rides.ferrisWheel.nausea)

  console.log('PASS flat rides: menu, footprints, prices, gates, ride time and fun, saves, multiplayer, animated models')
}
