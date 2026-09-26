import assert from 'node:assert/strict'
import { GameState } from '../src/game/GameState'
import type { GameSnapshot, Visitor } from '../src/game/GameState'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import { perGuestSupply } from '../src/game/shopGoods'
import { initialThirstAndHygiene, isCamper, moodNeedValues } from '../src/game/visitorNeeds'

const DECISIONS = SIMULATION_CONFIG.visitors.decisions
const stock = (water: number, drinks = 0) => ({ food: 0, drinks, water, goods: 0 })

/**
 * Thirst and hygiene (C3): thirst rises faster in heat and is quenched at a water point
 * or with a soft drink at the drink stand; hygiene drops for campers only and a shower
 * restores it. Water points and showers use one unit of water per guest.
 */
export function testVisitorNeeds(fixture: (count?: number) => GameState): void {
  const first = initialThirstAndHygiene('visitor-7')
  assert.deepEqual(initialThirstAndHygiene('visitor-7'), first, 'start values come from the id, not the random sequence')
  assert.ok(first.thirst >= 70 && first.thirst <= 95)
  assert.ok(first.hygiene >= 90 && first.hygiene <= 100)
  assert.equal(perGuestSupply('waterPoint'), 'water')
  assert.equal(perGuestSupply('shower'), 'water')
  assert.equal(perGuestSupply('toilet'), null, 'toilets keep working without water')

  const game = fixture(2)
  const s = game.snapshot as GameSnapshot
  game.addDebugMoney()
  const [guest, camper] = s.visitors as [Visitor, Visitor]
  guest.ticketType = 'day'
  guest.campingPhase = 'none'
  camper.ticketType = 'camping'
  camper.campingPhase = 'ready'
  assert.equal(isCamper(guest), false)
  assert.equal(isCamper(camper), true)
  assert.equal(moodNeedValues(guest).length, 5, 'a day guest is not judged on hygiene')
  assert.equal(moodNeedValues(camper).length, 6, 'a camper is')

  // Decay: heat speeds thirst up; only the camper gets less fresh.
  s.festival.weather = 'sun'
  Object.assign(guest.needs, { thirst: 90, hygiene: 90 })
  Object.assign(camper.needs, { thirst: 90, hygiene: 90 })
  game.decayNeeds(guest, 60)
  game.decayNeeds(camper, 60)
  const sunnyThirst = 90 - guest.needs.thirst
  assert.equal(guest.needs.hygiene, 90, 'day guests do not get less fresh')
  assert.ok(camper.needs.hygiene < 90, 'campers do')
  s.festival.weather = 'heat'
  guest.needs.thirst = 90
  game.decayNeeds(guest, 60)
  const hotThirst = 90 - guest.needs.thirst
  assert.ok(hotThirst > sunnyThirst * 2, 'heat makes guests thirsty much faster')

  // A thirsty guest goes to the water point first; it pours one unit of water.
  assert.ok(game.place('waterPoint', 5, -20).ok)
  assert.ok(game.placePathSegment(5, -19, 0).ok)
  assert.ok(game.placePathSegment(4, -19, 0).ok)
  const water = s.buildings.find((building) => building.kind === 'waterPoint')!
  assert.equal(game.findReachableFacility(guest, 'waterPoint'), null, 'a dry water point is not a destination')
  s.festival.infrastructure.shops[water.id] = stock(5)
  Object.assign(guest, { state: 'exploring', route: [], targetId: null, cellX: 4, cellZ: -19, cellElevation: 0, x: 4.5, z: -18.5, alcoholDesire: 0 })
  Object.assign(guest.needs, { thirst: DECISIONS.seekDrinkBelow - 20, toilet: 100, hunger: 100, fun: 100, energy: 100 })
  assert.ok(game.findReachableFacility(guest, 'waterPoint'), 'a stocked water point is reachable')
  ;(game as unknown as { visitorsAwaitingDecision: Set<string> }).visitorsAwaitingDecision.delete(guest.id)
  game.decideNextAction(guest)
  assert.equal(guest.targetId, water.id, 'thirst sends the guest to the water point')
  assert.equal(guest.thought, 'Ich habe Durst.')
  Object.assign(guest, { state: 'using', cellX: 5, cellZ: -19 })
  game.finishInteraction(guest)
  assert.equal(guest.needs.thirst, 100)
  assert.equal(s.festival.infrastructure.shops[water.id]!.water, 4, 'one unit of water per guest')

  // Without alcohol on their mind a thirsty guest buys a soft drink at a share of the price.
  assert.ok(game.place('alcohol', 7, -20).ok)
  assert.ok(game.placePathSegment(7, -19, 0).ok)
  const stand = s.buildings.find((building) => building.kind === 'alcohol')!
  s.festival.infrastructure.shops[stand.id] = stock(0, 5)
  Object.assign(guest, { state: 'using', targetId: stand.id, cellX: 7, cellZ: -19, budget: 100, alcoholDesire: 0, inventory: [] })
  guest.needs.thirst = DECISIONS.seekDrinkBelow - 10
  const before = guest.budget
  game.finishInteraction(guest)
  assert.equal(guest.needs.thirst, 100, 'the soft drink is drunk on the spot')
  assert.equal(before - guest.budget, Math.ceil(stand.price * SIMULATION_CONFIG.needs.drink.softDrinkPriceShare))
  assert.equal(guest.inventory.some((item) => item.kind === 'alcohol'), false, 'no beer for the thirsty sober guest')
  assert.equal(s.festival.infrastructure.shops[stand.id]!.drinks, 4, 'soft drinks come out of the drinks stock')

  // An unwashed camper looks for the shower; a shower restores hygiene for one unit of water.
  assert.ok(game.place('shower', 5, -22).ok)
  assert.ok(game.placePathSegment(5, -21, 0).ok)
  const shower = s.buildings.find((building) => building.kind === 'shower')!
  s.festival.infrastructure.shops[shower.id] = stock(3)
  Object.assign(camper, { state: 'exploring', route: [], targetId: null, cellX: 5, cellZ: -21, cellElevation: 0, x: 5.5, z: -20.5, alcoholDesire: 0, budget: 100 })
  Object.assign(camper.needs, { thirst: 100, toilet: 100, hunger: 100, fun: 100, energy: 100, hygiene: DECISIONS.seekShowerBelow - 20 })
  ;(game as unknown as { visitorsAwaitingDecision: Set<string> }).visitorsAwaitingDecision.delete(camper.id)
  game.decideNextAction(camper)
  assert.equal(camper.targetId, shower.id, 'an unwashed camper heads for the shower')
  Object.assign(camper, { state: 'using' })
  game.finishInteraction(camper)
  assert.equal(camper.needs.hygiene, SIMULATION_CONFIG.needs.shower.hygiene)
  assert.equal(s.festival.infrastructure.shops[shower.id]!.water, 2)

  // Old saves without the two needs load with defaults.
  const legacy = JSON.parse(JSON.stringify(s)) as GameSnapshot
  for (const visitor of legacy.visitors) {
    delete (visitor.needs as Partial<Visitor['needs']>).thirst
    delete (visitor.needs as Partial<Visitor['needs']>).hygiene
  }
  const restored = GameState.fromJSON(JSON.stringify(legacy))!
  assert.ok(restored.snapshot.visitors.every((visitor) => visitor.needs.thirst === 80 && visitor.needs.hygiene === 100))

  console.log('PASS thirst and hygiene: heat, water points, soft drinks, showers for campers, legacy saves')
}
