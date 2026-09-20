import assert from 'node:assert/strict'
import { FEMALE_VISITOR_NAMES, GameState, MALE_VISITOR_NAMES } from '../src/game/GameState'
import type { GameSnapshot } from '../src/game/GameState'
import { activeBookings, assignAudience, audienceMix, festivalTime, forecast, weatherAt, temperatureAt, TEMPERATURE_RANGE, showIssue, updateFestival, watchableBookings } from '../src/game/festivalManagement'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import { visitorLooksFemale } from '../src/game/rng'
import { CONCERT_TOPLESS_CROWD_THOUGHT, CONCERT_TOPLESS_THOUGHT, groupVisitorsByThought } from '../src/game/visitorThoughts'
import { visitorIsFemale } from '../src/view/pixelPeople'
import { WorldUpdates } from '../src/net/worldUpdates'
import { packWorld } from '../src/net/codec'

export function testFestival(fixture: (count?: number) => GameState): void {
  const create = (guests = 0) => {
    const game = fixture(guests)
    game.addDebugMoney()
    ;(game.snapshot as GameSnapshot).dayPlan.leadDays = 1
    ;(game.snapshot as GameSnapshot).dayPlan.festivalDays = 2
    game.manageFestival({ type: 'ground', x: 6, z: -20, kind: 'drain' })
    game.manageFestival({ type: 'ground', x: 6, z: -20, kind: 'compact' })
    assert.ok(game.place('stage', 6, -20).ok)
    game.designateStageForecourt([{ x: 5, z: -20 }])
    assert.ok(game.manageFestival({ type: 'start' }).ok)
    return game
  }
  // The sandbox stage must provide meaningful fun even without booked-show bonuses.
  const danceGame = fixture(1), sandboxDancer = danceGame.snapshot.visitors[0]!
  ;(danceGame as any).visitorsAwaitingDecision.clear()
  ;(danceGame.snapshot as GameSnapshot).parkOpen = true
  sandboxDancer.state = 'partying'; sandboxDancer.route = []; sandboxDancer.interactionRemaining = 90
  sandboxDancer.localPartyMood = 80; sandboxDancer.partyPreference = 1; sandboxDancer.alcoholLevel = 0
  sandboxDancer.needs = { ...sandboxDancer.needs, fun: 20, energy: 90, hunger: 90, toilet: 90 }
  sandboxDancer.pendingWaste = 0
  ;(danceGame as any).updateVisitors(10)
  assert.equal(sandboxDancer.isDancing, true)
  assert.ok(sandboxDancer.needs.fun >= 30, 'ten minutes dancing gives a visible net fun gain without a booked concert')
  sandboxDancer.needs.fun = 99
  ;(danceGame as any).updateVisitors(2)
  assert.equal(sandboxDancer.needs.fun, 100, 'dance fun stays capped at 100')

  const floorDance = create(1)
  const floorGuest = floorDance.snapshot.visitors[0]!
  ;(floorDance as any).visitorsAwaitingDecision.clear()
  floorGuest.state = 'partying'
  floorGuest.route = []
  floorGuest.interactionRemaining = 90
  floorGuest.localPartyMood = 12
  floorGuest.partyPreference = 0.2
  floorGuest.cellX = 5
  floorGuest.cellZ = -20
  floorGuest.cellElevation = 0
  floorGuest.alcoholLevel = 0
  floorGuest.needs = { ...floorGuest.needs, fun: 20, energy: 90, hunger: 90, toilet: 90 }
  floorGuest.pendingWaste = 0
  ;(floorDance as any).updateVisitors(1)
  assert.equal(floorGuest.isDancing, true, 'stage floors invite dancing even with modest party taste')

  const game = create(20), s = game.snapshot as GameSnapshot, f = s.festival
  const stage = s.buildings.find(b => b.kind === 'stage')!
  const book = { type: 'book' as const, bandId: 'meadow', stageId: stage.id, day: f.startDay + 1, start: 840, duration: 90 }
  const before = s.money
  assert.ok(game.manageFestival(book).ok)
  assert.equal(s.money, before - 450)
  assert.equal(game.manageFestival(book).ok, false)
  assert.equal(game.manageFestival({ ...book, bandId: 'brass', start: 930 }).ok, false, '30 minute changeover required')
  assert.equal(game.manageFestival({ ...book, bandId: 'aurora', start: 1000 }).ok, false, 'headliner requires earned reputation')
  assert.equal(game.manageFestival({ ...book, day: f.startDay + 3 }).ok, false)
  const mix = audienceMix(f)
  assert.ok(mix.music > mix.family)
  assignAudience(s.visitors[0]!, f)
  assert.ok(s.visitors[0]!.audience)
  const clone = new GameState(s)
  assert.deepEqual(clone.snapshot.festival, f, 'save/load preserves bookings, finances and weather seed')
  const legacy = structuredClone(s) as any; delete legacy.festival
  assert.equal(new GameState(legacy).snapshot.festival.enabled, false)

  s.day = book.day; s.minute = 840; s.power.poweredBuildingIds.push(stage.id); f.weather = 'sun'
  assert.equal(activeBookings(s).length, 1)
  assert.equal(showIssue(s, f.bookings[0]!), null)
  f.weather = 'wind'; assert.ok(showIssue(s, f.bookings[0]!))
  assert.ok(game.manageFestival({ type: 'upgrade', kind: 'rigging' }).ok)
  assert.equal(showIssue(s, f.bookings[0]!), null)
  const campers = s.visitors.filter(v => v.ticketType === 'day')
  for (const visitor of campers) {
    visitor.route = []; visitor.targetId = null; visitor.state = 'exploring'
    visitor.cellX = 4; visitor.cellZ = -20; visitor.x = 4.5; visitor.z = -19.5
    ;(game as any).tryVisitConcert(visitor)
  }
  const reserved = s.visitors.filter(v => v.concertId)
  assert.equal(reserved.length, 9, 'one forecourt tile reserves no more than nine guests')
  assert.equal(new Set(reserved.map(v => v.activitySlot)).size, 9)

  const ring = create(24), rs = ring.snapshot as GameSnapshot
  const ringStage = rs.buildings.find(b => b.kind === 'stage')!
  assert.ok(ring.manageFestival({ type: 'book', bandId: 'meadow', stageId: ringStage.id, day: rs.festival.startDay + 1, start: 840, duration: 90 }).ok)
  assert.ok(ring.designateStageForecourt([
    { x: 5, z: -21 }, { x: 5, z: -19 }, { x: 6, z: -19 }, { x: 6, z: -21 },
    { x: 7, z: -20 }, { x: 7, z: -19 }, { x: 7, z: -21 },
  ]).ok)
  rs.day = book.day
  rs.minute = 840
  rs.power.poweredBuildingIds.push(ringStage.id)
  rs.festival.weather = 'sun'
  for (const visitor of rs.visitors) {
    visitor.route = []
    visitor.targetId = null
    visitor.state = 'exploring'
    visitor.musicTaste = 'indie'
    visitor.audience = 'music'
    visitor.cellX = 4
    visitor.cellZ = -20
    visitor.x = 4.5
    visitor.z = -19.5
    ;(ring as any).tryVisitConcert(visitor)
  }
  const ringGuests = rs.visitors.filter(v => v.concertId)
  const ringTiles = new Map<string, number>()
  for (const visitor of ringGuests) {
    const key = `${visitor.activityTarget!.x},${visitor.activityTarget!.z}`
    ringTiles.set(key, (ringTiles.get(key) ?? 0) + 1)
  }
  assert.ok(ringGuests.length >= 12, 'a ring of dance-floor tiles seats more than one packed tile')
  const ringFront = ringGuests.filter(v => v.activityTarget!.z === -19)
  assert.ok(ringFront.length >= 12, 'fans pack the first apron row instead of the nearest side tile')
  assert.ok(ringTiles.size >= 2, 'they spread along that front row instead of stacking one tile')
  assert.ok(
    Math.max(...[...ringTiles.entries()].filter(([key]) => key.endsWith(',-19')).map(([, count]) => count)) <= 9,
    'a front-row tile still respects the nine-guest cap',
  )

  const frontBias = create(20), fb = frontBias.snapshot as GameSnapshot
  const frontStage = fb.buildings.find(b => b.kind === 'stage')!
  assert.ok(frontBias.manageFestival({ type: 'book', bandId: 'meadow', stageId: frontStage.id, day: fb.festival.startDay + 1, start: 840, duration: 90 }).ok)
  assert.ok(frontBias.designateStageForecourt([
    { x: 6, z: -19 }, { x: 6, z: -18 }, { x: 6, z: -17 },
  ]).ok)
  fb.day = book.day
  fb.minute = 840
  fb.power.poweredBuildingIds.push(frontStage.id)
  fb.festival.weather = 'sun'
  for (const visitor of fb.visitors) {
    visitor.route = []
    visitor.targetId = null
    visitor.state = 'exploring'
    visitor.musicTaste = 'indie'
    visitor.audience = 'music'
    visitor.cellX = 4
    visitor.cellZ = -20
    visitor.x = 4.5
    visitor.z = -19.5
    ;(frontBias as any).tryVisitConcert(visitor)
  }
  const frontSeated = fb.visitors.filter(v => v.concertId)
  const tileCount = (x: number, z: number) => frontSeated.filter(v => v.activityTarget!.x === x && v.activityTarget!.z === z).length
  assert.ok(frontSeated.length >= 18, 'a deep apron seats almost the whole test crowd')
  assert.equal(tileCount(6, -19), 9, 'the first apron row fills before later rows')
  assert.equal(tileCount(6, -18), 9, 'the second row is the fallback once the front is full')
  assert.ok(tileCount(6, -17) >= 2, 'further rows take the overflow after that')
  assert.equal(tileCount(5, -20), 0, 'the nearest side tile stays empty while apron rows still have room')

  assert.equal(game.manageFestival({ type: 'cancel', id: f.bookings[0]!.id }).ok, false, 'no refund after show starts')

  assert.equal(forecast(f, 5, 12), forecast(new GameState(s).snapshot.festival, 5, 12))

  // Temperatures: seeded like the weather, never outside the range the site has, and
  // both ends of it actually happen over a season of festivals.
  let coldest = Infinity, warmest = -Infinity
  for (let seed = 0; seed < 40; seed++) {
    const sky = { ...f, seed }
    for (let day = 1; day <= 6; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const weather = weatherAt(sky, day, hour)
        const celsius = temperatureAt(sky, day, hour, weather)
        assert.ok(Number.isInteger(celsius), 'a temperature is a whole number of degrees')
        assert.ok(celsius >= TEMPERATURE_RANGE.min && celsius <= TEMPERATURE_RANGE.max, `${celsius} °C stays between ${TEMPERATURE_RANGE.min} and ${TEMPERATURE_RANGE.max}`)
        assert.equal(celsius, temperatureAt({ ...f, seed }, day, hour, weather), 'the same hour always reads the same')
        coldest = Math.min(coldest, celsius); warmest = Math.max(warmest, celsius)
      }
    }
  }
  assert.equal(coldest, TEMPERATURE_RANGE.min, 'the cold end is reached')
  assert.equal(warmest, TEMPERATURE_RANGE.max, 'and so is the warm one')
  const midday = temperatureAt(f, 3, 15, 'sun'), night = temperatureAt(f, 3, 3, 'sun')
  assert.ok(midday > night, 'afternoons are warmer than the small hours')
  assert.ok(temperatureAt(f, 3, 15, 'heat') > temperatureAt(f, 3, 15, 'rain'), 'and heat is warmer than rain')

  const weather = create(1), ws = weather.snapshot as GameSnapshot
  for (let seed = 0; ; seed++) { ws.festival.seed = seed; if (weatherAt(ws.festival, ws.day, 12) === 'rain') break }
  ws.minute = 721; ws.festival.lastUpdate = festivalTime(ws) - 10
  updateFestival(ws); assert.ok(ws.festival.wetness > 0)
  const walker = ws.visitors[0]!; walker.cellX = 10; walker.cellZ = 0
  const wetSpeed = (weather as any).visitorTravelSpeed(walker)
  ws.festival.upgrades.drainage = true
  assert.ok((weather as any).visitorTravelSpeed(walker) > wetSpeed)

  const shop = create(1), shopState = shop.snapshot as GameSnapshot
  assert.ok(shop.place('food', 8, -20).ok)
  const food = shopState.buildings.find(b => b.kind === 'food')!, customer = shopState.visitors[0]!
  assert.ok(shop.placePathSegment(8, -19, 0).ok)
  customer.cellX = 8; customer.cellZ = -19; customer.cellElevation = 0
  customer.targetId = food.id; customer.budget = 100; shopState.festival.supplies.food = 0
  const wallet = customer.budget
  ;(shop as any).finishInteraction(customer)
  assert.equal(customer.budget, wallet, 'empty stock must not charge the customer')
  customer.targetId = food.id; shopState.festival.infrastructure.shops[food.id] = { food: 2, drinks: 0, water: 0, goods: 0 }
  customer.cellZ = -21
  ;(shop as any).finishInteraction(customer)
  assert.equal(customer.budget, wallet, 'a saved customer behind the shop cannot purchase')
  assert.equal(shopState.festival.infrastructure.shops[food.id]!.food, 2)
  customer.targetId = food.id; customer.cellZ = -19
  ;(shop as any).finishInteraction(customer)
  assert.equal(shopState.festival.infrastructure.shops[food.id]!.food, 1)
  assert.equal(customer.budget, wallet - food.price)

  const saved = new Map<string, string>()
  const oldStorage = globalThis.localStorage
  Object.assign(globalThis, { localStorage: {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => { saved.set(key, value) },
    removeItem: (key: string) => { saved.delete(key) },
  } })
  try {
    shop.save()
    assert.deepEqual(GameState.load()!.snapshot.festival, shopState.festival, 'public save/load retains the complete new mode')
    assert.equal(shop.saveSlot('Samstagabend').ok, true)
    assert.equal(shop.saveSlot('Nachtversion').ok, true)
    const slots = GameState.listSaveSlots()
    assert.equal(slots.length, 2)
    const loadedSlot = GameState.loadSlot(slots[0]!.id)!.snapshot
    assert.equal(loadedSlot.money, shopState.money, 'named save slots load full snapshots')
    assert.equal(loadedSlot.visitors.length, shopState.visitors.length)
    assert.equal(loadedSlot.buildings.length, shopState.buildings.length)
    assert.equal(shop.saveSlot('Aktualisierter Samstag', slots.find(slot => slot.name === 'Samstagabend')!.id).ok, true)
    assert.equal(GameState.listSaveSlots().length, 2, 'overwriting a slot does not create a duplicate')
    assert.equal(GameState.deleteSaveSlot(slots.find(slot => slot.name === 'Nachtversion')!.id).ok, true)
    assert.equal(GameState.listSaveSlots().length, 1)
  } finally {
    Object.assign(globalThis, { localStorage: oldStorage })
  }

  for (let day = f.startDay + 1; day <= f.startDay + 3; day++) {
    s.day = day; s.minute = 1; f.lastUpdate = festivalTime(s) - 2
    updateFestival(s)
  }
  assert.equal(f.reports.length, 3)
  assert.equal(f.finished, true)
  assert.equal(s.speed, 1)
  const reputation = { ...f.reputation }
  assert.ok(game.manageFestival({ type: 'start' }).ok)
  assert.equal(f.edition, 2)
  assert.deepEqual(f.reputation, reputation)

  const client = new GameState(), updates = new WorldUpdates()
  client.networkMode = 'client'
  client.applyNetworkWorld(JSON.parse(updates.encode(packWorld(s), true)).world)
  game.manageFestival({ type: 'upgrade', kind: 'water' })
  const delta = JSON.parse(updates.encode(packWorld(s)))
  client.applyNetworkUpdate(delta.world, delta.visitors, delta.removed)
  assert.deepEqual(client.snapshot.festival, f)
  const weekend = create()
  weekend.setSpeed(3)
  for (let tick = 0; tick < 5000 && !weekend.snapshot.festival.finished; tick++) weekend.tick(0.1)
  assert.equal(weekend.snapshot.festival.finished, true, 'complete weekend must reach its result through normal simulation ticks')
  assert.equal(weekend.snapshot.festival.reports.length, 3)
  assert.equal(weekend.snapshot.speed, 3)
  const completedTick = weekend.executedLogicTicks
  weekend.tick(0.1)
  assert.ok(weekend.executedLogicTicks > completedTick, 'post-festival cleanup continues ticking')
  let visitorUpdates = 0, staffUpdates = 0
  const updateVisitors = (weekend as any).updateVisitors.bind(weekend)
  const updateStaff = (weekend as any).updateStaff.bind(weekend)
  ;(weekend as any).updateVisitors = (minutes: number) => { visitorUpdates++; updateVisitors(minutes) }
  ;(weekend as any).updateStaff = (minutes: number) => { staffUpdates++; updateStaff(minutes) }
  for (let n = 0; n < 20; n++) weekend.tick(0.1)
  assert.ok(visitorUpdates > 0 && staffUpdates > 0, 'departures and staff keep updating after the festival ends')
  weekend.setSpeed(0)
  const pausedTick = weekend.executedLogicTicks
  weekend.tick(0.1)
  assert.equal(weekend.executedLogicTicks, pausedTick, 'manual pause remains respected')

  const show = create(4), ss = show.snapshot as GameSnapshot
  const showStage = ss.buildings.find(b => b.kind === 'stage')!
  assert.ok(show.manageFestival({ type: 'book', bandId: 'meadow', stageId: showStage.id, day: ss.festival.startDay + 1, start: 840, duration: 90 }).ok)
  ss.day = ss.festival.startDay + 1
  ss.minute = 810
  ss.parkOpen = true
  ss.power.poweredBuildingIds.push(showStage.id)
  ss.festival.weather = 'sun'
  ss.festival.upgrades.rigging = true
  assert.equal(activeBookings(ss).length, 0, 'the set has not started yet')
  assert.equal(watchableBookings(ss).length, 1, 'guests can walk in during the last half hour')
  const earlyGuest = ss.visitors[0]!
  earlyGuest.audience = 'music'
  earlyGuest.musicTaste = 'indie'
  earlyGuest.state = 'exploring'
  earlyGuest.route = []
  earlyGuest.cellX = 4
  earlyGuest.cellZ = -20
  earlyGuest.cellElevation = 0
  earlyGuest.x = 4.5
  earlyGuest.z = -19.5
  earlyGuest.needs = { ...earlyGuest.needs, energy: 8, fun: 40, hunger: 90, toilet: 90 }
  earlyGuest.pendingWaste = 0
  earlyGuest.consumptionCooldown = 999
  assert.equal((show as any).tryVisitConcert(earlyGuest), true)
  assert.equal(earlyGuest.concertId, ss.festival.bookings[0]!.id)
  assert.match(earlyGuest.thought, /schon/)
  earlyGuest.route = []
  earlyGuest.state = 'partying'
  earlyGuest.localPartyMood = 0
  earlyGuest.pendingWaste = 0
  earlyGuest.inventory = []
  earlyGuest.interactionRemaining = 1
  earlyGuest.pendingWaste = 0
  // This fixture directly stages attendance; discard the pre-start decision requests.
  ;(show as any).visitorsAwaitingDecision.clear()
  ;(show as any).updateVisitors(1)
  assert.equal(earlyGuest.state, 'partying')
  assert.equal(earlyGuest.concertId, ss.festival.bookings[0]!.id)
  ss.minute = 850
  earlyGuest.needs.energy = 4
  ;(show as any).updateVisitors(1)
  assert.equal(earlyGuest.state, 'partying', 'low energy does not end a booked show')
  assert.equal(earlyGuest.concertId, ss.festival.bookings[0]!.id)
  ss.minute = 930
  ;(show as any).updateVisitors(1)
  assert.equal(earlyGuest.concertId, null, 'guests leave after the last song')

  const maleId = Array.from({ length: 80 }, (_, index) => `concert-fan-${index}`).find((id) => !visitorLooksFemale(id))
  assert.ok(maleId)
  assert.equal(visitorIsFemale(maleId), false)
  const dancer = ss.visitors[1]!
  const neighbor = ss.visitors[2]!
  dancer.id = maleId
  dancer.audience = 'music'
  dancer.musicTaste = 'indie'
  dancer.state = 'partying'
  dancer.route = []
  dancer.concertId = ss.festival.bookings[0]!.id
  dancer.cellX = 5
  dancer.cellZ = -20
  dancer.x = 5.5
  dancer.z = -19.5
  dancer.needs = { ...dancer.needs, fun: 20, energy: 80, hunger: 90, toilet: 90 }
  dancer.pendingWaste = 0
  dancer.consumptionCooldown = 999
  neighbor.state = 'partying'
  neighbor.route = []
  neighbor.concertId = ss.festival.bookings[0]!.id
  neighbor.cellX = 5
  neighbor.cellZ = -20
  neighbor.x = 5.4
  neighbor.z = -19.6
  neighbor.needs = { ...neighbor.needs, fun: 20, energy: 80, hunger: 90, toilet: 90 }
  neighbor.pendingWaste = 0
  neighbor.consumptionCooldown = 999
  ss.minute = 850
  ss.parkOpen = true
  const neighborFun = neighbor.needs.fun
  const originalNext = (show as any).rng.next
  ;(show as any).rng.next = () => 0
  ;(show as any).updateConcertTopless(dancer, 1, { booking: ss.festival.bookings[0]! })
  ;(show as any).updateConcertTopless(neighbor, 1, { booking: ss.festival.bookings[0]! })
  ;(show as any).rng.next = originalNext
  assert.ok(dancer.toplessMinutes > 0, 'a rare event can select an individual guest')
  assert.equal(neighbor.toplessMinutes, 0, 'even a successful random draw cannot start a second event')
  ;(show as any).updateVisitors(1)
  assert.equal(dancer.thought, CONCERT_TOPLESS_THOUGHT)
  assert.ok(neighbor.needs.fun > neighborFun, 'nearby guests enjoy the topless cheer')
  assert.equal(neighbor.thought, CONCERT_TOPLESS_CROWD_THOUGHT)
  ss.festival.lastUpdate = festivalTime(ss) - 1
  updateFestival(ss)
  assert.equal(dancer.thought, CONCERT_TOPLESS_THOUGHT, 'live-set flavor text does not hide going topless')
  const thoughtGroups = groupVisitorsByThought([dancer, neighbor, { ...neighbor, id: 'extra', thought: neighbor.thought }])
  assert.equal(thoughtGroups.length, 2)
  assert.equal(thoughtGroups.find(group => group.thought === CONCERT_TOPLESS_CROWD_THOUGHT)?.count, 2)

  const lust = create(3), lustState = lust.snapshot as GameSnapshot
  const lustStage = lustState.buildings.find(b => b.kind === 'stage')!
  assert.ok(lust.manageFestival({ type: 'book', bandId: 'meadow', stageId: lustStage.id, day: lustState.festival.startDay + 1, start: 840, duration: 90 }).ok)
  lustState.day = lustState.festival.startDay + 1
  lustState.parkOpen = true
  lustState.power.poweredBuildingIds.push(lustStage.id)
  lustState.festival.weather = 'sun'
  lustState.festival.upgrades.rigging = true
  const stageFan = (visitor: typeof lustState.visitors[number], concertId: string | null, motivation: number) => {
    visitor.audience = 'music'
    visitor.musicTaste = 'indie'
    visitor.state = 'partying'
    visitor.route = []
    visitor.concertId = concertId
    visitor.cellX = 5
    visitor.cellZ = -20
    visitor.cellElevation = 0
    visitor.x = 5.5
    visitor.z = -19.5
    visitor.motivation = motivation
    visitor.needs = { ...visitor.needs, fun: 50, energy: 80, hunger: 90, toilet: 90 }
    visitor.pendingWaste = 0
    visitor.consumptionCooldown = 999
    visitor.localPartyMood = 40
    visitor.interactionRemaining = 90
    visitor.inventory = []
  }
  const liveFan = lustState.visitors[0]!
  const waitingFan = lustState.visitors[1]!
  const idleDancer = lustState.visitors[2]!
  stageFan(liveFan, lustState.festival.bookings[0]!.id, 35)
  stageFan(waitingFan, lustState.festival.bookings[0]!.id, 35)
  stageFan(idleDancer, null, 35)
  idleDancer.localPartyMood = 80
  idleDancer.partyPreference = 1
  lustState.minute = 850
  ;(lust as any).visitorsAwaitingDecision.clear()
  ;(lust as any).updateVisitors(10)
  assert.equal(
    liveFan.motivation,
    Math.min(
      100,
      35 +
        10 *
          SIMULATION_CONFIG.atmosphere.concertMotivationPerMinute *
          lust.showQualityForStage(lustStage.id),
    ),
    'watching a live booked set restores Festivallust',
  )
  assert.equal(idleDancer.motivation, 35, 'partying on a dark or idle floor does not restore Festivallust')
  lustState.minute = 810
  waitingFan.motivation = 35
  waitingFan.concertId = lustState.festival.bookings[0]!.id
  waitingFan.state = 'partying'
  waitingFan.route = []
  waitingFan.pendingWaste = 0
  ;(lust as any).visitorsAwaitingDecision.clear()
  ;(lust as any).updateVisitors(10)
  assert.equal(waitingFan.motivation, 35, 'waiting before the first song does not restore Festivallust')
  const passer = lustState.visitors[0]!
  passer.state = 'exploring'
  passer.route = []
  passer.concertId = null
  passer.motivation = 35
  passer.pendingWaste = 0
  passer.consumptionCooldown = 999
  passer.musicTaste = 'dance'
  ;(lust as any).visitorsAwaitingDecision.clear()
  ;(lust as any).updateVisitors(10)
  assert.equal(passer.motivation, 35, 'a guest who is not at the concert does not gain Festivallust')

  const priced = fixture(0)
  priced.updateEntryPrice(18)
  priced.updateCampingTicketPrice(42)
  priced.snapshot.campingCells = [
    { x: 7, z: -20, elevation: 0 },
    { x: 8, z: -20, elevation: 0 },
  ]
  priced.snapshot.dayPlan.campingCapacityBufferPercent = 0
  const beforeMoney = priced.snapshot.money
  const dayGuest = (priced as any).spawnVisitorMember('day', 'price-day', 'pedestrian', false)
  const campGuest = (priced as any).spawnVisitorMember('camping', 'price-camp', 'pedestrian', false)
  assert.ok(dayGuest)
  assert.ok(campGuest)
  assert.equal(dayGuest.entryFeePaid, 18)
  assert.equal(campGuest.entryFeePaid, 42)
  assert.equal(priced.snapshot.money, beforeMoney + 60)
  const reloaded = GameState.fromJSON(JSON.stringify(priced.snapshot))!
  assert.equal(reloaded.snapshot.entryPrice, 18)
  assert.equal(reloaded.snapshot.campingTicketPrice, 42)
  const legacyPrices = fixture(0)
  delete (legacyPrices.snapshot as { campingTicketPrice?: number }).campingTicketPrice
  const migrated = GameState.fromJSON(JSON.stringify(legacyPrices.snapshot))!
  assert.equal(migrated.snapshot.campingTicketPrice, migrated.snapshot.entryPrice)

  const named = create(16)
  for (const visitor of named.snapshot.visitors) {
    const given = visitor.name.split(' ')[0]!
    if (visitorLooksFemale(visitor.id)) {
      assert.ok(FEMALE_VISITOR_NAMES.includes(given), `${visitor.name} must be a female given name`)
    } else {
      assert.ok(MALE_VISITOR_NAMES.includes(given), `${visitor.name} must be a male given name`)
    }
  }

  console.log('PASS festival booking rules, audience demand, concert capacity, live-show Festivallust, weather, stock, deliveries, saves, reports, next edition and network deltas')
}
