import assert from 'node:assert/strict'
import { GameState, type GameSnapshot } from '../src/game/GameState'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import {
  applyFamilyFestivalBedtime,
  circadianEnergyDecayMultiplier,
  isMinuteInSleepWindow,
  remapLegacySleepRhythm,
  sampleFestivalSleepRhythm,
  sleepRhythmFromVisitorId,
} from '../src/game/visitorSleep'

export function testVisitorSleep(fixture: (count?: number) => GameState): void {
  const schedule = SIMULATION_CONFIG.camping.sleepSchedule
  const minutesPerDay = SIMULATION_CONFIG.time.minutesPerDay

  const early = sampleFestivalSleepRhythm(0, 0, schedule, minutesPerDay)
  const late = sampleFestivalSleepRhythm(1, 1, schedule, minutesPerDay)
  assert.ok(
    early.bedtime >= schedule.bedtimeMinimum &&
      early.bedtime < schedule.bedtimeMinimum + 1,
    'earliest chronotype goes to sleep around 03:00',
  )
  assert.ok(
    late.bedtime >= 6 * 60 - 1 && late.bedtime <= 6 * 60,
    'latest chronotype goes to sleep around 06:00',
  )
  const earlySleep =
    (early.wakeTime - early.bedtime + minutesPerDay) % minutesPerDay
  const lateSleep =
    (late.wakeTime - late.bedtime + minutesPerDay) % minutesPerDay
  assert.ok(earlySleep >= 5 * 60 && earlySleep <= 5 * 60 + 1)
  assert.ok(lateSleep >= 9 * 60 - 1 && lateSleep <= 9 * 60)
  assert.ok(early.bedtime < late.bedtime, 'chronotypes stay staggered')
  assert.ok(
    late.wakeTime > early.wakeTime,
    'late sleepers wake later in the day',
  )

  assert.equal(isMinuteInSleepWindow(22 * 60, 3 * 60, 11 * 60), false)
  assert.equal(isMinuteInSleepWindow(4 * 60, 3 * 60, 11 * 60), true)
  assert.equal(isMinuteInSleepWindow(10 * 60, 3 * 60, 11 * 60), true)
  assert.equal(isMinuteInSleepWindow(16 * 60, 3 * 60, 11 * 60), false)
  assert.equal(
    isMinuteInSleepWindow(1 * 60, 3 * 60, 11 * 60),
    false,
    'the small hours before 03:00 stay a party window',
  )
  assert.equal(
    isMinuteInSleepWindow(23 * 60, 22 * 60, 8 * 60),
    true,
    'wrapped civilian windows still work after midnight',
  )

  const hashed = sleepRhythmFromVisitorId('guest-a', schedule, minutesPerDay)
  assert.deepEqual(
    sleepRhythmFromVisitorId('guest-a', schedule, minutesPerDay),
    hashed,
  )
  assert.notDeepEqual(
    sleepRhythmFromVisitorId('guest-b', schedule, minutesPerDay),
    hashed,
  )

  const family = { preferredBedtime: 4 * 60 }
  applyFamilyFestivalBedtime(family, schedule, minutesPerDay)
  assert.equal(family.preferredBedtime, 4 * 60 - 150)

  const remapped = remapLegacySleepRhythm(
    { id: 'old', preferredBedtime: 21 * 60, preferredWakeTime: 6 * 60 },
    schedule,
    minutesPerDay,
  )
  assert.equal(remapped.bedtime, 3 * 60)
  assert.equal(remapped.wakeTime, 11 * 60)
  assert.deepEqual(
    remapLegacySleepRhythm(
      { id: 'old', preferredBedtime: remapped.bedtime, preferredWakeTime: remapped.wakeTime },
      schedule,
      minutesPerDay,
    ),
    remapped,
    'legacy remap is idempotent',
  )
  const familyLegacy = remapLegacySleepRhythm(
    {
      id: 'family',
      audience: 'family',
      preferredBedtime: 21,
      preferredWakeTime: 7 * 60,
    },
    schedule,
    minutesPerDay,
  )
  assert.equal(familyLegacy.bedtime, 3 * 60)
  assert.equal(familyLegacy.wakeTime, 12 * 60)

  const bedtime = 4 * 60
  const wakeTime = 12 * 60
  assert.equal(
    circadianEnergyDecayMultiplier(20 * 60, bedtime, wakeTime, schedule),
    schedule.peakEnergyDecayMultiplier,
  )
  assert.equal(
    circadianEnergyDecayMultiplier(14 * 60, bedtime, wakeTime, schedule),
    1,
  )
  assert.equal(
    circadianEnergyDecayMultiplier(5 * 60, bedtime, wakeTime, schedule),
    schedule.afterBedtimeEnergyDecayMultiplier,
  )
  assert.ok(
    schedule.peakEnergyDecayMultiplier < 1,
    'evening/night energy lasts longer than a civilian afternoon',
  )
  assert.ok(
    schedule.afterBedtimeEnergyDecayMultiplier > 1,
    'staying up past personal bedtime drains faster',
  )

  const loaded = new GameState({
    ...fixture(0).snapshot,
    visitors: [
      {
        ...fixture(1).snapshot.visitors[0]!,
        preferredBedtime: 22 * 60,
        preferredWakeTime: 7 * 60,
      },
    ],
  })
  const restored = loaded.snapshot.visitors[0]!
  assert.equal(restored.preferredBedtime, 4 * 60)
  assert.equal(restored.preferredWakeTime, 12 * 60)

  const night = prepareCamper(fixture)
  night.snapshot.minute = 22 * 60
  const nightOwl = night.snapshot.visitors[0]!
  nightOwl.preferredBedtime = 4 * 60
  nightOwl.preferredWakeTime = 12 * 60
  nightOwl.needs.energy = 50
  ;(night as any).chooseNextVisitorAction(nightOwl)
  assert.equal(
    nightOwl.campingPhase,
    'ready',
    'campers stay out late instead of collapsing at 22:00',
  )
  assert.notEqual(nightOwl.state, 'leaving')
  assert.equal(nightOwl.thought.includes('Schlafenszeit'), false)

  const morning = prepareCamper(fixture)
  morning.snapshot.minute = 4 * 60
  const sleeper = morning.snapshot.visitors[0]!
  sleeper.preferredBedtime = 3 * 60
  sleeper.preferredWakeTime = 11 * 60
  sleeper.needs.energy = 50
  ;(morning as any).chooseNextVisitorAction(sleeper)
  assert.equal(sleeper.campingPhase, 'returning')
  assert.ok(sleeper.thought.includes('Schlafenszeit'))

  const dayGuest = fixture(1)
  dayGuest.snapshot.minute = 5 * 60
  dayGuest.snapshot.dayPlan.leadDays = 0
  const wanderer = dayGuest.snapshot.visitors[0]!
  wanderer.ticketType = 'camping'
  wanderer.campsite = null
  wanderer.campingPhase = 'none'
  wanderer.state = 'exploring'
  wanderer.route = []
  wanderer.targetId = null
  wanderer.concertId = null
  wanderer.motivation = 80
  wanderer.preferredBedtime = 4 * 60
  wanderer.preferredWakeTime = 12 * 60
  wanderer.needs = { hunger: 90, toilet: 90, fun: 90, energy: 20 }
  wanderer.alcoholDesire = 0
  ;(dayGuest as any).visitorsAwaitingDecision.delete(wanderer.id)
  ;(dayGuest as any).chooseNextVisitorAction(wanderer)
  assert.equal(wanderer.state, 'leaving')
  assert.ok(wanderer.thought.includes('Schlaf'))

  const rest = prepareCamper(fixture)
  rest.snapshot.minute = 8 * 60
  const napping = rest.snapshot.visitors[0]!
  napping.state = 'camping'
  napping.campingPhase = 'resting'
  napping.route = []
  napping.preferredBedtime = 3 * 60
  napping.preferredWakeTime = 11 * 60
  napping.needs.energy = 90
  ;(rest as any).updateVisitors(30)
  assert.equal(
    napping.campingPhase,
    'resting',
    'high energy does not wake a camper during their morning sleep window',
  )

  const energyGame = fixture(1)
  const tired = energyGame.snapshot.visitors[0]!
  tired.preferredBedtime = 4 * 60
  tired.preferredWakeTime = 12 * 60
  tired.alcoholLevel = 0
  energyGame.snapshot.minute = 20 * 60
  tired.needs.energy = 100
  ;(energyGame as any).decayNeeds(tired, 60)
  const peakLoss = 100 - tired.needs.energy
  energyGame.snapshot.minute = 14 * 60
  tired.needs.energy = 100
  ;(energyGame as any).decayNeeds(tired, 60)
  const afternoonLoss = 100 - tired.needs.energy
  energyGame.snapshot.minute = 5 * 60
  tired.needs.energy = 100
  ;(energyGame as any).decayNeeds(tired, 60)
  const crashLoss = 100 - tired.needs.energy
  assert.ok(peakLoss < afternoonLoss, 'night-time energy lasts longer')
  assert.ok(afternoonLoss < crashLoss, 'morning crash after bedtime is faster')
}

function prepareCamper(fixture: (count?: number) => GameState): GameState {
  const game = fixture(0)
  const snapshot = game.snapshot as GameSnapshot
  snapshot.parkOpen = true
  snapshot.dayPlan.leadDays = 0
  game.designateCampingArea([
    { x: 5, z: -23 },
    { x: 5, z: -22 },
  ])
  const camper = (game as any).spawnVisitorMember(
    'camping',
    'sleep-test',
    'pedestrian',
    false,
  )
  assert.ok(camper?.campsite)
  Object.assign(camper, {
    state: 'exploring',
    campingPhase: 'ready',
    route: [],
    targetId: null,
    concertId: null,
    motivation: 80,
    alcoholDesire: 0,
    needs: { hunger: 90, toilet: 90, fun: 90, energy: 50 },
  })
  ;(game as any).visitorsAwaitingDecision.delete(camper.id)
  return game
}
