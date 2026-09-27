import assert from 'node:assert/strict'
import { GameState } from '../src/game/GameState'
import type { GameSnapshot, Visitor } from '../src/game/GameState'
import { earnedAchievements } from '../src/game/achievements'
import { audioWorldFromSnapshot } from '../src/game/audio'
import { difficultyProfile } from '../src/game/difficulty'
import { showIssue, updateFestival } from '../src/game/festivalManagement'
import { emptyProgress, recordScenarioResult } from '../src/game/progress'
import { DEFAULT_SCENARIO, normalizeScenarioSettings } from '../src/game/scenario'
import { SCENARIO_PRESETS } from '../src/game/scenarioPresets'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import { rollSponsorOffers, settleSponsors } from '../src/game/sponsors'
import { planStorms, stormAt, stormExposure } from '../src/game/storm'
import { createTickerWatchState, observeTickerEvents } from '../src/game/ticker'
import { TUTORIAL_PRESET_ID, TUTORIAL_PATH_FIELDS, tutorialSteps } from '../src/game/tutorial'

/**
 * Phase 5 extras: storms, sponsors, difficulty, the first-steps checklist and the
 * achievements they feed. Each is a pure rule on the snapshot plus a thin hook, so
 * each is pinned here without running a whole festival.
 */
export function testFestivalExtras(fixture: (count?: number) => GameState): void {
  testStorms(fixture)
  testSponsors(fixture)
  testDifficulty()
  testTutorial()
  testAchievements(fixture)
  console.log('PASS festival extras: storms, sponsors, difficulty, first steps and achievements')
}

function startedFestival(fixture: (count?: number) => GameState, guests = 3): GameState {
  const game = fixture(guests)
  game.addDebugMoney()
  const s = game.snapshot as GameSnapshot
  s.dayPlan.leadDays = 1
  s.dayPlan.festivalDays = 3
  game.manageFestival({ type: 'ground', x: 6, z: -20, kind: 'drain' })
  game.manageFestival({ type: 'ground', x: 6, z: -20, kind: 'compact' })
  assert.ok(game.place('stage', 6, -20).ok)
  game.designateStageForecourt([{ x: 5, z: -20 }])
  assert.ok(game.manageFestival({ type: 'start' }).ok)
  return game
}

function testStorms(fixture: (count?: number) => GameState): void {
  // Planning is a pure function of the seed: same seed, same storms; more chance, more storms.
  assert.deepEqual(planStorms(4242, 10, 30), planStorms(4242, 10, 30))
  const calm = planStorms(4242, 10, 60, 0.5).length
  const wild = planStorms(4242, 10, 60, 2).length
  assert.ok(wild > calm, 'a higher storm factor brings more storms')
  for (const storm of planStorms(7, 1, 60, 3)) {
    assert.ok(storm.start >= SIMULATION_CONFIG.storm.earliestHour * 60 && storm.end > storm.start && storm.end <= 1440)
  }

  const game = startedFestival(fixture)
  const s = game.snapshot as GameSnapshot
  const f = s.festival
  assert.ok(Array.isArray(f.storms), 'starting an edition plans its storms')
  const stage = s.buildings.find((building) => building.kind === 'stage')!
  s.power.poweredBuildingIds.push(stage.id)
  const day = f.startDay + 1
  f.storms = [{ day, start: 960, end: 1020 }]
  const booked = game.manageFestival({ type: 'book', bandId: 'meadow', stageId: stage.id, day, start: 840, duration: 90 })
  assert.ok(booked.ok, booked.message)
  f.weather = 'sun'
  s.day = day
  s.minute = 850
  assert.equal(stormAt(f, day, 850).phase, 'none')
  assert.equal(showIssue(s, f.bookings[0]!), null)
  s.minute = 910
  assert.equal(stormAt(f, day, 910).phase, 'warning', 'announced an hour ahead')
  assert.equal(showIssue(s, f.bookings[0]!), null, 'the show goes on during the warning')
  const watch = createTickerWatchState()
  assert.ok(observeTickerEvents(s, watch).some((item) => item.kind === 'storm' && item.title === 'Unwetterwarnung'))
  assert.ok(game.manageFestival({ type: 'shelter' }).ok)
  assert.equal(game.manageFestival({ type: 'shelter' }).ok, false, 'shelter is ordered once')
  assert.match(showIssue(s, f.bookings[0]!) ?? '', /Schutz angeordnet/, 'ordering shelter stops the shows at once')
  s.minute = 970
  assert.equal(stormAt(f, day, 970).phase, 'active')
  assert.match(showIssue(s, f.bookings[0]!) ?? '', /Unwetter/)
  assert.ok(observeTickerEvents(s, watch).some((item) => item.kind === 'storm' && item.title === 'Gewitter'))
  assert.equal(audioWorldFromSnapshot(s).stormActive, true)
  assert.deepEqual(audioWorldFromSnapshot(s).performingStages, [], 'the stages fall silent')

  // Exposure: a camper in the tent is safe, a guest in the open is not, shelter helps.
  assert.equal(stormExposure({ state: 'camping', campingPhase: 'resting' }, false), 0)
  assert.equal(stormExposure({ state: 'exploring', campingPhase: 'none' }, false), 1)
  assert.ok(stormExposure({ state: 'exploring', campingPhase: 'none' }, true) < 0.5)
  const guest = s.visitors[0] as Visitor
  Object.assign(guest, { state: 'exploring', campingPhase: 'none' })
  guest.needs.energy = 80
  f.lastUpdate = s.day * 1440 + 960
  updateFestival(s)
  assert.equal(f.weather, 'rain', 'a raging storm rains')
  assert.ok(guest.needs.energy < 80, 'guests in the open wear down')
  assert.equal(f.stormLive, true)

  // Lightning: without the Sturmsicherung a tall structure catches fire.
  const internal = game as unknown as { updateStormHazards: () => void; lastStormMinute: number }
  s.minute = 960 + SIMULATION_CONFIG.storm.lightningAfterMinutes[0]!
  internal.lastStormMinute = s.day * 1440 + s.minute - 1
  internal.updateStormHazards()
  assert.ok(s.incidents.some((incident) => incident.kind === 'fire'), 'lightning without Sturmsicherung starts a fire')

  // The storm passes: counted as weathered, the shelter order is lifted.
  f.stormInjuries = 0
  s.minute = 1030
  f.lastUpdate = s.day * 1440 + 1025
  updateFestival(s)
  assert.equal(f.stormLive, false)
  assert.deepEqual(f.stormStats, { weathered: 1, calm: 1 })
  assert.equal(f.shelterOrder, false)
  assert.equal(showIssue(s, f.bookings[0]!), null, 'shows resume after the storm')
  const saved = GameState.fromJSON(JSON.stringify(s))!
  assert.deepEqual(saved.snapshot.festival.storms, f.storms, 'storms survive a save')
}

function testSponsors(fixture: (count?: number) => GameState): void {
  assert.deepEqual(rollSponsorOffers('seed', 2), rollSponsorOffers('seed', 2), 'offers are deterministic')
  const offers = rollSponsorOffers('seed', 2)
  assert.equal(offers.length, SIMULATION_CONFIG.sponsors.offers)
  assert.equal(new Set(offers.map((offer) => offer.sponsor)).size, offers.length, 'no brand twice')
  assert.equal(new Set(offers.map((offer) => offer.condition)).size, offers.length, 'no condition twice')

  const game = fixture(0)
  const s = game.snapshot as GameSnapshot
  const f = s.festival
  assert.ok((f.sponsorOffers ?? []).length > 0, 'a new game has offers for its first edition')
  const [first, second, third] = f.sponsorOffers!
  const money = s.money
  assert.ok(game.manageFestival({ type: 'sponsor', id: first!.id }).ok)
  assert.equal(s.money - money, first!.advance, 'signing pays the advance')
  assert.equal(s.finance.periods.at(-1)!.entries.sponsors, first!.advance, 'booked as Sponsoren')
  assert.equal(game.manageFestival({ type: 'sponsor', id: first!.id }).ok, false, 'an offer is signed once')
  assert.ok(game.manageFestival({ type: 'sponsor', id: second!.id }).ok)
  assert.equal(game.manageFestival({ type: 'sponsor', id: third!.id }).ok, false, 'at most two per edition')

  // Settlement: a met condition pays the bonus, a missed one takes the advance back.
  f.sponsors = [
    { ...first!, condition: 'admissions', target: 100, status: 'signed' },
    { ...second!, condition: 'banners', target: 5, status: 'signed' },
  ]
  const before = s.money
  const result = settleSponsors(s, { admissions: 150, satisfaction: 70, banners: 1, headliner: false })
  assert.deepEqual(result, { fulfilled: 1, failed: 1 })
  assert.equal(s.money - before, first!.bonus - second!.advance)
  assert.equal(f.sponsorsFulfilled, 1)
  assert.deepEqual(f.sponsors.map((contract) => contract.status), ['fulfilled', 'failed'])
}

function testDifficulty(): void {
  assert.equal(normalizeScenarioSettings({ ...DEFAULT_SCENARIO, difficulty: 'hard' }).difficulty, 'hard')
  assert.equal('difficulty' in normalizeScenarioSettings({ ...DEFAULT_SCENARIO, difficulty: 'normal' }), false, 'normal is left out')
  assert.equal('difficulty' in normalizeScenarioSettings({ ...DEFAULT_SCENARIO, difficulty: 'impossible' as never }), false)
  const easy = GameState.startNew({ ...DEFAULT_SCENARIO, startingMoney: 20_000, difficulty: 'easy' })
  const hard = GameState.startNew({ ...DEFAULT_SCENARIO, startingMoney: 20_000, difficulty: 'hard' })
  const normal = GameState.startNew({ ...DEFAULT_SCENARIO, startingMoney: 20_000 })
  assert.equal(normal.snapshot.money, 20_000)
  assert.equal(easy.snapshot.money, 20_000 * difficultyProfile({ difficulty: 'easy' }).money)
  assert.equal(hard.snapshot.money, 20_000 * difficultyProfile({ difficulty: 'hard' }).money)
  assert.deepEqual(easy.snapshot.terrain, hard.snapshot.terrain, 'the site does not change with the difficulty')
  assert.ok(difficultyProfile({ difficulty: 'hard' }).runningCosts > 1 && difficultyProfile({ difficulty: 'easy' }).needDecay < 1)
}

function testTutorial(): void {
  const preset = SCENARIO_PRESETS.find((entry) => entry.id === TUTORIAL_PRESET_ID)!
  assert.equal(preset.settings.goals.length, 0, 'the first steps have no goals and no deadline')
  const game = GameState.startNew(normalizeScenarioSettings({ ...preset.settings, preset: preset.id }))
  const s = game.snapshot as GameSnapshot
  game.addDebugMoney()
  assert.deepEqual(tutorialSteps(s).map((step) => step.done), [false, false, false, false, false])
  // The checklist highlights the next control along each step's target path.
  assert.deepEqual(tutorialSteps(s).map((step) => step.target), [
    { kind: 'build', category: 'paths', group: 'main', tool: 'path' },
    { kind: 'build', category: 'attractions', group: 'festival', tool: 'stage' },
    { kind: 'build', category: 'attractions', group: 'stalls', tool: 'food' },
    { kind: 'festival', tab: 'lineup' },
    { kind: 'festival', tab: 'overview', action: 'start' },
  ])
  const entrance = s.buildings.find((building) => building.id === 'entrance-path')!
  for (let i = 1; i <= TUTORIAL_PATH_FIELDS; i++) assert.ok(game.placePathSegment(entrance.x, entrance.z + i, 0).ok, `path ${i}`)
  assert.equal(tutorialSteps(s)[0]!.done, true, 'a path out of the entrance ticks the first step')
  const pathEnd = entrance.z + TUTORIAL_PATH_FIELDS
  assert.ok(game.place('food', entrance.x + 1, pathEnd).ok)
  assert.equal(tutorialSteps(s)[2]!.target?.kind === 'build' && tutorialSteps(s)[2]!.target.tool, 'toilet', 'with a food stall the toilet is next')
  assert.ok(game.place('toilet', entrance.x - 1, pathEnd).ok)
  assert.equal(tutorialSteps(s)[2]!.done, true)
  s.festival.bookings.push({ id: 'b', bandId: 'meadow', stageId: 'x', day: s.day + 1, start: 840, duration: 60, fee: 0 })
  assert.equal(tutorialSteps(s)[3]!.done, true)
  s.festival.edition = 1
  assert.equal(tutorialSteps(s)[4]!.done, true, 'starting the festival ticks the last step')
}

function testAchievements(fixture: (count?: number) => GameState): void {
  const game = fixture(0)
  const s = game.snapshot as GameSnapshot
  assert.deepEqual(earnedAchievements(s, emptyProgress()), [], 'a fresh game has earned nothing')
  s.scenarioProgress.editions.push({ edition: 1, endDay: 5, admissions: 1200, satisfaction: 88, reputation: 60, profit: 30_000 })
  s.festival.sponsorsFulfilled = 1
  s.festival.stormStats = { weathered: 1, calm: 1 }
  const earned = earnedAchievements(s, emptyProgress())
  for (const id of ['firstEdition', 'crowd1000', 'happyCrowd', 'bigProfit', 'sponsor', 'storm']) assert.ok(earned.includes(id), id)
  let records = emptyProgress()
  for (const preset of SCENARIO_PRESETS.filter((entry) => entry.settings.goals.length > 0)) {
    records = recordScenarioResult(records, preset.id, { won: true, score: 80, stars: 4 }, 1)
  }
  const all = earnedAchievements(s, records)
  assert.ok(all.includes('allPresets') && all.includes('firstWin'), 'winning every scenario that can be won')
}
