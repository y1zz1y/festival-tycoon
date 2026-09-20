import assert from 'node:assert/strict'
import { GameState } from '../src/game/GameState'
import { getFestivalCycleStatus } from '../src/game/dayPlan'
import {
  calendarMinutesPerRealSecond,
  movementMinutesPerRealSecond,
  SIMULATION_CONFIG,
} from '../src/game/simulationConfig'

const HISTORICAL_DAY_SECONDS = 10 * 60

function clockGame(): GameState {
  const initial = structuredClone(new GameState().snapshot)
  initial.terrain = { heights: {} }
  initial.buildings = []
  initial.festival.planning = false
  initial.parkOpen = true
  initial.dayPlan.leadDays = 1
  initial.dayPlan.festivalDays = 2
  initial.dayPlan.breakDays = 2
  initial.minute = 12 * 60
  initial.day = 10
  initial.scenario.carArrivalShare = 0
  return new GameState(initial)
}

function placeWalker(game: GameState) {
  game.snapshot.day =
    game.snapshot.dayPlan.cycleStartDay + game.snapshot.dayPlan.leadDays
  game.snapshot.parkOpen = true
  for (let z = 0; z <= 8; z += 1) game.placePathSegment(3, z, 0)
  const visitor = (game as any).spawnVisitorMember(
    'day',
    'clock-walk',
    'pedestrian',
    false,
  )
  assert.ok(visitor, 'walker must spawn')
  visitor.x = 3.5
  visitor.z = 0.5
  visitor.cellX = 3
  visitor.cellZ = 0
  visitor.cellElevation = 0
  visitor.route = [1, 2, 3, 4, 5, 6, 7, 8].map((z) => ({
    x: 3,
    z,
    elevation: 0,
  }))
  visitor.state = 'exploring'
  visitor.walkSpeed = 0.4
  visitor.emotion = 'neutral'
  visitor.alcoholLevel = 0
  visitor.crowding = 0
  visitor.isPanicking = false
  visitor.streakingMinutes = 0
  visitor.movementBoostMinutes = 0
  return visitor
}

export function testSimulationTime(): void {
  const { time } = SIMULATION_CONFIG
  const calendarPerTick = time.tickSeconds * calendarMinutesPerRealSecond(1)
  const movementPerTick = time.tickSeconds * movementMinutesPerRealSecond(1)
  const historicalMovementPerTick =
    time.tickSeconds * (time.minutesPerDay / HISTORICAL_DAY_SECONDS)

  assert.equal(time.tickSeconds, 0.1, 'fixed 100 ms ticks stay')
  assert.deepEqual([...time.speedMultipliers], [0, 1, 3, 8])
  assert.equal(time.normalDayDurationSeconds, 20 * 60)
  assert.equal(time.movementDayDurationSeconds, HISTORICAL_DAY_SECONDS)
  assert.ok(Math.abs(calendarPerTick - 0.12) < 1e-12)
  assert.ok(
    Math.abs(1 / calendarPerTick - 25 / 3) < 1e-12,
    'a game minute takes 8.333 ticks at 1×',
  )
  assert.equal(movementPerTick, historicalMovementPerTick)
  assert.ok(
    Math.abs(movementPerTick - 0.24) < 1e-12,
    'movement minutes per tick stay at the old 10-minute day',
  )
  assert.equal(
    time.normalDayDurationSeconds / time.movementDayDurationSeconds,
    2,
    'calendar is half as fast as movement',
  )

  const clock = clockGame()
  clock.setSpeed(1)
  const startMinute = clock.snapshot.minute
  const startDay = clock.snapshot.day
  for (let step = 0; step < 10; step += 1) clock.tick(0.1)
  assert.equal(clock.executedLogicTicks, 10)
  assert.ok(
    Math.abs(clock.snapshot.minute - startMinute - 1.2) < 1e-9,
    'ten 1× ticks advance 1.2 calendar minutes',
  )
  assert.equal(clock.snapshot.day, startDay)

  const walked = clockGame()
  const walker = placeWalker(walked)
  const walkedFrom = { x: walker.x, z: walker.z }
  ;(walked as any).walkVisitors(historicalMovementPerTick)
  const reference = Math.hypot(walker.x - walkedFrom.x, walker.z - walkedFrom.z)

  const live = clockGame()
  live.setSpeed(1)
  const liveWalker = placeWalker(live)
  const liveFrom = { x: liveWalker.x, z: liveWalker.z }
  live.tick(0.1)
  const travelled = Math.hypot(liveWalker.x - liveFrom.x, liveWalker.z - liveFrom.z)
  assert.ok(reference > 0.05, 'a walker actually moves')
  assert.ok(
    Math.abs(reference - travelled) < 1e-6,
    'one tick walks the same distance as the historical 0.24 movement minutes',
  )

  const noon = clockGame()
  const plan = noon.snapshot.dayPlan
  assert.equal(getFestivalCycleStatus(plan, plan.cycleStartDay).phase, 'lead')
  assert.equal(getFestivalCycleStatus(plan, plan.cycleStartDay + 1).phase, 'festival')
  assert.equal(getFestivalCycleStatus(plan, plan.cycleStartDay + 2).phase, 'festival')
  assert.equal(getFestivalCycleStatus(plan, plan.cycleStartDay + 3).phase, 'break')
  const slotMinutes = 90
  assert.ok(
    Math.abs(slotMinutes / calendarPerTick - 750) < 1e-9,
    'a 90-minute set is 750 ticks at 1×',
  )
  assert.ok(
    Math.abs(slotMinutes / historicalMovementPerTick - 375) < 1e-9,
    'the same set used to be 375 ticks',
  )
}
