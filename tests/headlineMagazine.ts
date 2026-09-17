import assert from 'node:assert/strict'
import { GameState } from '../src/game/GameState'
import type { GameSnapshot } from '../src/game/GameState'
import { festivalTime, updateFestival } from '../src/game/festivalManagement'
import { buildHeadlineMagazine } from '../src/game/headlineMagazine'

function startWeekend(fixture: (count?: number) => GameState, guests = 8): GameState {
  const game = fixture(guests)
  game.addDebugMoney()
  const s = game.snapshot as GameSnapshot
  s.dayPlan.leadDays = 1
  s.dayPlan.festivalDays = 2
  game.manageFestival({ type: 'ground', x: 6, z: -20, kind: 'drain' })
  game.manageFestival({ type: 'ground', x: 6, z: -20, kind: 'compact' })
  assert.ok(game.place('stage', 6, -20).ok)
  assert.ok(game.manageFestival({ type: 'start' }).ok)
  return game
}

function finishWeekend(s: GameSnapshot): void {
  s.day = s.festival.startDay + s.dayPlan.leadDays + s.dayPlan.festivalDays
  s.minute = 1
  s.festival.lastUpdate = festivalTime(s) - 2
  updateFestival(s)
}

export function testHeadlineMagazine(fixture: (count?: number) => GameState): void {
  const running = startWeekend(fixture)
  const mid = running.snapshot as GameSnapshot
  mid.day = mid.festival.startDay + mid.dayPlan.leadDays
  mid.minute = 600
  mid.festival.lastUpdate = festivalTime(mid) - 2
  updateFestival(mid)
  assert.equal(mid.festival.finished, false)
  assert.equal(buildHeadlineMagazine(mid), null, 'magazine stays closed mid-weekend')

  finishWeekend(mid)
  assert.equal(mid.festival.finished, true)
  const first = buildHeadlineMagazine(mid)
  assert.ok(first, 'festival end produces a magazine model')
  assert.ok(first.pros.length >= 1 && first.cons.length >= 1, 'at least one pro and one con')
  assert.ok(first.pros.length >= 3 && first.pros.length <= 6)
  assert.ok(first.cons.length >= 3 && first.cons.length <= 6)
  assert.equal(first.masthead, 'HEADLINE')
  assert.match(first.dateLine, /Tag /)
  assert.deepEqual(buildHeadlineMagazine(mid), first, 'same snapshot yields the same copy')
  assert.deepEqual(buildHeadlineMagazine(structuredClone(mid)), first, 'cloned snapshot stays deterministic')

  const flop = structuredClone(mid) as GameSnapshot
  flop.festival.admissions = 8
  flop.festival.goals = { guests: 150, satisfaction: 65, profit: 0 }
  flop.festival.reports = flop.festival.reports.map((report, index) => ({
    ...report,
    satisfaction: 28,
    concerts: index === 0 ? 0 : 10,
    stockouts: 20,
    weatherImpact: 200,
    balance: -400,
  }))
  flop.festival.reputation = { music: 20, atmosphere: 22, comfort: 18, organization: 16 }
  flop.incidents = [
    { id: 'litter-1', kind: 'litter', x: 1, z: 1, elevation: 0, severity: 1, ageMinutes: 4 },
    { id: 'litter-2', kind: 'litter', x: 2, z: 1, elevation: 0, severity: 1, ageMinutes: 4 },
    { id: 'vomit-1', kind: 'vomit', x: 3, z: 1, elevation: 0, severity: 1, ageMinutes: 3 },
    { id: 'fire-1', kind: 'fire', x: 4, z: 1, elevation: 0, severity: 1, ageMinutes: 1 },
  ]
  flop.wasteDumpCells = [{ x: 0, z: 0, elevation: 0, stored: 170 }]
  flop.festival.bookings = []
  const flopMag = buildHeadlineMagazine(flop)!
  assert.equal(flopMag.verdict, 'flop')
  assert.ok(flopMag.cons.some((item) => item.id === 'empty-park' || item.id === 'trash' || item.id === 'no-lineup'))
  assert.notDeepEqual(flopMag, first)

  const cult = structuredClone(mid) as GameSnapshot
  const stage = cult.buildings.find((building) => building.kind === 'stage')!
  cult.festival.admissions = 220
  cult.festival.goals = { guests: 150, satisfaction: 65, profit: 0 }
  cult.festival.reputation = { music: 82, atmosphere: 80, comfort: 76, organization: 78 }
  cult.festival.bookings = [{
    id: 'headline-slot',
    bandId: 'aurora',
    stageId: stage.id,
    day: cult.festival.startDay + cult.dayPlan.leadDays,
    start: 840,
    duration: 90,
    fee: 2800,
  }]
  cult.festival.reports = [{
    day: cult.festival.startDay + cult.dayPlan.leadDays,
    balance: 900,
    guests: 220,
    satisfaction: 90,
    concerts: 1200,
    stockouts: 0,
    weatherImpact: 8,
    reputation: { ...cult.festival.reputation },
  }]
  cult.bandSupply = {
    ...cult.bandSupply,
    showQualityByStageId: { [stage.id]: 1.12 },
  }
  cult.backstageCells = [{ x: 7, z: -20, elevation: 0 }]
  cult.attractiveness = { ...cult.attractiveness, average: 52 }
  cult.partyMood = { ...cult.partyMood, average: 64 }
  cult.power.poweredBuildingIds = [...new Set([...cult.power.poweredBuildingIds, stage.id])]
  const cultMag = buildHeadlineMagazine(cult)!
  assert.equal(cultMag.verdict, 'cult')
  assert.ok(cultMag.pros.some((item) => item.id === 'headliner'))
  assert.ok(cultMag.stars >= 4)
  assert.deepEqual(buildHeadlineMagazine(cult), cultMag)

  assert.ok(running.manageFestival({ type: 'start' }).ok)
  assert.equal(running.snapshot.festival.finished, false)
  assert.equal(buildHeadlineMagazine(running.snapshot), null, 'next edition hides the previous magazine')
}
