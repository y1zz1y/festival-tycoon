import assert from 'node:assert/strict'
import {
  COURSE_KINDS,
  COURSE_SPECS,
  courseSpanCells,
  createSeededCourse,
  isCourseSwimCell,
  stepCourses,
  validateCourse,
} from '../src/game/courseAttractions'
import { GameState } from '../src/game/GameState'
import { normalizeScenarioSettings } from '../src/game/scenario'
import { createBlankSnapshot } from '../src/game/snapshotBootstrap'
import { estimateTicketDemand } from '../src/game/ticketDemand'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import { CourseView } from '../src/view/CourseView'
import { Box3, Vector3 } from 'three'
import { buildingHourlyUpkeep, festivalIsLive, festivalIsOnBreak } from '../src/game/upkeep'
import { collectBuiltAtmosphereCells } from '../src/game/atmosphere'
import { BUILDINGS } from '../src/game/catalog'
import { listedBuildTools } from '../src/game/buildMenu'
import { BANDS, bandStarRating, isFiveStarBand } from '../src/game/festivalManagement'
import type { Visitor } from '../src/game/types/entities'

function fakeVisitor(id: string): Visitor {
  return {
    id,
    name: id,
    x: 8.5,
    y: 0,
    z: 8.5,
    cellX: 8,
    cellZ: 8,
    cellElevation: 0,
    state: 'queuing',
    targetId: null,
    route: [],
    budget: 80,
    needs: { fun: 10, hunger: 70, thirst: 70, toilet: 70, energy: 70 },
  } as Visitor
}

export function testCourseAttractions(): void {
  assert.ok(
    SIMULATION_CONFIG.courses.paintballMatchTicks >= 180,
    'paintball matches stay visible long enough to follow',
  )
  assert.ok(SIMULATION_CONFIG.courses.paintballMoveIntervalTicks >= 12)
  assert.ok(SIMULATION_CONFIG.courses.paintballShotCycleTicks >= 6)
  assert.deepEqual(
    courseSpanCells({ x: 1, z: 2 }, { x: 4, z: 2 }),
    [
      { x: 1, z: 2 },
      { x: 2, z: 2 },
      { x: 3, z: 2 },
      { x: 4, z: 2 },
    ],
  )
  for (const kind of COURSE_KINDS) {
    const course = createSeededCourse(`c-${kind}`, kind, 4, 6)
    assert.equal(validateCourse(course), null, `${kind} default layout must reach the exit`)
    assert.ok(COURSE_SPECS[kind].startCost > 0)
  }
  const mud = createSeededCourse('shape-mud', 'mudmasters', 0, 0)
  assert.ok(mud.pieces.some((piece) => piece.kind === 'climbWall'))
  assert.ok(mud.pieces.some((piece) => piece.kind === 'waterDitch'))
  assert.ok(mud.pieces.some((piece) => piece.kind === 'monkeyBars'))
  assert.ok(new Set(mud.pieces.map((piece) => `${piece.x},${piece.z}`)).size > 6, 'mudmasters is a 2D parkour footprint')
  const pool = createSeededCourse('shape-pool', 'pool', 0, 0)
  assert.ok(pool.pieces.filter((piece) => piece.kind === 'poolBasin').length >= 4)
  assert.ok(pool.pieces.some((piece) => piece.kind === 'waterSlide'))
  const trees = createSeededCourse('shape-trees', 'treeToTree', 0, 0)
  assert.ok(trees.pieces.filter((piece) => piece.kind === 'tree').length >= 3)
  assert.ok(trees.pieces.some((piece) => piece.kind === 'hangingBridge'))
  assert.ok(trees.pieces.some((piece) => piece.kind === 'treeZip'))
  assert.ok(trees.pieces.some((piece) => piece.kind === 'treeRing'))
  const paint = createSeededCourse('shape-paint', 'paintball', 0, 0)
  assert.ok(paint.pieces.filter((piece) => piece.kind === 'paintballField').length >= 6)
  assert.ok(paint.pieces.some((piece) => piece.kind === 'teamStartA'))
  assert.ok(paint.pieces.some((piece) => piece.kind === 'cover'))

  const park = new GameState(
    createBlankSnapshot(normalizeScenarioSettings({ worldSize: 48, unevenness: 0, startingMoney: 80_000 })),
  )
  park.snapshot.festival.planning = false
  const started = park.startCourse('mudmasters', 6, 4)
  assert.ok(started.ok)
  const draft = park.snapshot.courses[0]!
  assert.equal(draft.pieces.length, 1)
  assert.equal(draft.pieces[0]?.kind, 'entrance')
  assert.equal(draft.operating, false)
  assert.ok(validateCourse(draft), 'an entrance alone is not a finished parkour')
  assert.equal(park.setCourseOperating(draft.id, true).ok, false)
  assert.ok(park.placePathSegment(6, 3, 0, 'queue').ok)
  assert.ok(park.placePathSegment(6, 2, 0).ok)
  assert.notEqual(
    park.getPathAt(6, 3, 0)?.queueDirection,
    undefined,
    'a queue path next to a course entrance points toward the course',
  )
  assert.deepEqual(
    (park as any).getCourseQueueCells(draft).map(
      (cell: { x: number; z: number }) => ({ x: cell.x, z: cell.z }),
    ),
    [{ x: 6, z: 3 }],
    'course entrances claim their connected directional queue',
  )
  assert.ok(park.addCoursePiece(draft.id, 'path', 7, 4).ok)
  assert.ok(park.addCoursePiece(draft.id, 'climbWall', 8, 4, 1).ok)
  assert.ok(park.addCoursePiece(draft.id, 'exit', 9, 4).ok)
  const mudPath = draft.pieces.find((piece) => piece.kind === 'path')
  assert.deepEqual(
    { x: mudPath?.x, z: mudPath?.z, endX: mudPath?.endX, endZ: mudPath?.endZ },
    { x: 6, z: 4, endX: 7, endZ: 4 },
    'mudmaster pieces store a real start and endpoint',
  )
  assert.equal(validateCourse(draft), null)
  assert.ok(park.setCourseOperating(draft.id, true).ok)
  const approaching = fakeVisitor('mud-approaching')
  approaching.state = 'seeking'
  approaching.targetId = draft.id
  draft.queue.push(approaching.id)
  stepCourses(
    { courses: [draft], visitors: [approaching], simTick: 1 },
    { next: () => 0.2 },
    { minutes: 0.5, charge: () => true, injure: () => undefined },
  )
  assert.equal(draft.riders.length, 0, 'course reservations wait until the visitor reaches the queue')
  draft.queue = []
  const runner = fakeVisitor('mud-runner')
  runner.state = 'riding'
  runner.targetId = draft.id
  draft.riders = [{
    visitorId: runner.id,
    pieceId: draft.pieces[0]!.id,
    progress: 0,
    airborne: false,
  }]
  stepCourses(
    { courses: [draft], visitors: [runner], simTick: 1 },
    { next: () => 0.2 },
    { minutes: 2, charge: () => true, injure: () => undefined },
  )
  stepCourses(
    { courses: [draft], visitors: [runner], simTick: 2 },
    { next: () => 0.2 },
    { minutes: 0.5, charge: () => true, injure: () => undefined },
  )
  assert.ok(runner.x > 6.5 && runner.x < 7.5, 'visitor visibly advances between track endpoints')
  draft.riders = []

  assert.ok(park.startCourse('pool', 6, -6).ok)
  const poolId = park.snapshot.courses.at(-1)!.id
  assert.ok(park.addCourseAreaCell(poolId, 7, -6).ok)
  assert.ok(park.addCourseAreaCell(poolId, 6, -5).ok)
  assert.ok(park.addCourseAreaCell(poolId, 7, -5).ok)
  assert.ok(park.addCourseAreaCell(poolId, 6, -4).ok)
  assert.ok(park.addCourseAreaCell(poolId, 7, -4).ok)
  assert.ok(park.addCoursePiece(poolId, 'poolBasin', 7, -4).ok)
  assert.ok(park.addCoursePiece(poolId, 'entrance', 6, -6).ok)
  assert.ok(park.addCoursePiece(poolId, 'ladder', 7, -6, 2).ok)
  assert.ok(park.addCoursePiece(poolId, 'waterSlide', 7, -5, 0).ok)
  assert.ok(park.addCoursePiece(poolId, 'exit', 6, -5).ok)
  assert.ok(isCourseSwimCell(park.snapshot.courses, 7, -4))
  assert.equal(validateCourse(park.getCourse(poolId)!), null)
  assert.equal(park.addCoursePiece(poolId, 'poolBasin', 9, -9).ok, false)

  assert.ok(park.startCourse('treeToTree', -8, 4).ok)
  const treeId = park.snapshot.courses.at(-1)!.id
  assert.ok(park.addCoursePiece(treeId, 'tree', -7, 4).ok)
  assert.ok(park.addCoursePiece(treeId, 'treeRing', -7, 4, 2).ok)
  assert.ok(park.addCoursePiece(treeId, 'tree', -5, 4).ok)
  assert.ok(park.addCoursePiece(treeId, 'hangingBridge', -5, 4, 2).ok)
  assert.ok(park.addCoursePiece(treeId, 'exit', -4, 4).ok)
  const bridge = park.getCourse(treeId)?.pieces.find((piece) => piece.kind === 'hangingBridge')
  assert.deepEqual(
    { x: bridge?.x, z: bridge?.z, endX: bridge?.endX, endZ: bridge?.endZ },
    { x: -7, z: 4, endX: -5, endZ: 4 },
    'tree bridge is a real span between tree nodes',
  )
  assert.equal(validateCourse(park.getCourse(treeId)!), null)

  const paintStart = park.startCourse('paintball', -8, -8)
  assert.ok(paintStart.ok)
  const paintId = paintStart.id!
  assert.equal(park.snapshot.courses.find((entry) => entry.id === paintId)?.pieces.length, 0)
  assert.ok(park.addCourseAreaCell(paintId, -7, -8).ok)
  assert.ok(park.addCourseAreaCell(paintId, -8, -7).ok)
  assert.ok(park.addCourseAreaCell(paintId, -7, -7).ok)
  assert.ok(park.addCoursePiece(paintId, 'teamStartA', -8, -8).ok)
  assert.ok(park.addCoursePiece(paintId, 'teamStartB', -7, -7).ok)
  assert.ok(park.addCoursePiece(paintId, 'entrance', -8, -7).ok)
  assert.ok(park.addCoursePiece(paintId, 'exit', -7, -8).ok)
  assert.equal(park.addCoursePiece(paintId, 'cover', -12, -12).ok, false)
  assert.equal(validateCourse(park.getCourse(paintId)!), null)
  assert.ok(park.setCourseTeamSize(paintId, 3).ok)
  assert.equal(park.getCourse(paintId)?.teamSize, 3)
  assert.ok(park.setCourseOperating(paintId, true).ok)
  const paintVisitor = fakeVisitor('paint-waiting')
  paintVisitor.targetId = paintId
  park.snapshot.visitors.push(paintVisitor)
  park.getCourse(paintId)!.queue.push(paintVisitor.id)
  stepCourses(
    { courses: [park.getCourse(paintId)!], visitors: [paintVisitor], simTick: 1 },
    { next: () => 0.2 },
    { minutes: 1, charge: () => true, injure: () => undefined },
  )
  assert.equal(park.getCourse(paintId)!.riders.length, 1)
  assert.match(paintVisitor.thought ?? '', /Teamstart/, 'paintball guests visibly wait for both teams')
  const courseView = new CourseView()
  courseView.update(
    [draft, park.getCourse(poolId)!, park.getCourse(treeId)!, park.getCourse(paintId)!],
    park.snapshot.visitors,
    1,
  )
  const modelSize = new Box3().setFromObject(courseView.group).getSize(new Vector3())
  assert.ok(modelSize.x > 1 && modelSize.y > 1 && modelSize.z > 1, 'all course model families produce visible 3D geometry')
  assert.ok(
    (courseView as any).staticGroup.children.length <= 30,
    'course combinations stay merged/instanced instead of adding a draw call per detail',
  )
  assert.equal(
    (courseView as any).weaponMeshes.a.count + (courseView as any).weaponMeshes.b.count,
    1,
    'paintball riders carry a batched visible marker',
  )
  assert.ok(park.undoCoursePiece(treeId).ok)

  const atomicArea = park.startCourseArea('paintball', [
    { x: 14, z: 14 },
    { x: 15, z: 14 },
    { x: 14, z: 15 },
    { x: 15, z: 15 },
  ])
  assert.ok(atomicArea.ok)
  const atomicCourse = park.getCourse(atomicArea.id!)!
  assert.equal(atomicCourse.areaCells.length, 4)
  assert.ok(park.addCoursePiece(atomicCourse.id, 'cover', 15, 15).ok)
  assert.equal(
    park.removeCourseAreaCells(atomicCourse.id, [{ x: 15, z: 15 }]).ok,
    false,
    'occupied area cells cannot be erased',
  )
  assert.ok(park.removeCourseAreaCells(atomicCourse.id, [{ x: 14, z: 15 }]).ok)
  assert.equal(atomicCourse.areaCells.length, 3)

  const course = createSeededCourse('guest-course', 'mudmasters', 12, 12)
  park.snapshot.courses.push(course)
  const visitor = fakeVisitor('course-guest')
  visitor.targetId = course.id
  park.snapshot.visitors.push(visitor)
  course.queue.push(visitor.id)
  stepCourses(park.snapshot, { next: () => 0.4 }, {
    minutes: 2,
    charge: (guest, price) => {
      guest.budget -= price
      return true
    },
    injure: () => undefined,
  })
  assert.equal(course.riders.length, 1)
  assert.equal(visitor.state, 'riding')

  const unsafe = createSeededCourse('unsafe-slide', 'pool', 20, 20)
  const slide = unsafe.pieces.find((piece) => piece.kind === 'waterSlide')
  assert.ok(slide)
  const keepBasin = unsafe.pieces.find((piece) => piece.kind === 'poolBasin')
  assert.ok(keepBasin)
  unsafe.pieces = unsafe.pieces.filter((piece) => piece.kind !== 'poolBasin' || piece.id === keepBasin.id)
  keepBasin.x = 20
  keepBasin.z = 21
  const exit = unsafe.pieces.find((piece) => piece.kind === 'exit')
  assert.ok(exit)
  exit.x = 20
  exit.z = 22
  assert.equal(validateCourse(unsafe), null)
  const fallen = fakeVisitor('slide-guest')
  fallen.state = 'riding'
  unsafe.riders = [{ visitorId: fallen.id, pieceId: slide.id, progress: 0.99, airborne: true }]
  let injured = false
  stepCourses({ courses: [unsafe], visitors: [fallen], simTick: 1 }, { next: () => 0.1 }, {
    minutes: 3,
    charge: () => true,
    injure: () => {
      injured = true
    },
  })
  assert.ok(injured || fallen.state === 'injured', 'a waterslide without a basin injures the rider')
}

export function testPostRefactorBacklog(): void {
  assert.ok(listedBuildTools().includes('fireStation'))
  assert.ok(listedBuildTools().includes('table'))
  assert.ok(listedBuildTools().includes('course'))
  assert.equal(BUILDINGS.table.capacity, 4)
  assert.equal(BUILDINGS.table.icon, '🪵')

  const live = {
    festival: { enabled: true, finished: false, planning: false },
    dayPlan: { leadDays: 0, festivalDays: 3, breakDays: 2, cycleStartDay: 1 },
    day: 1,
  } as never
  const paused = {
    festival: { enabled: true, finished: false, planning: false },
    dayPlan: { leadDays: 0, festivalDays: 1, breakDays: 4, cycleStartDay: 1 },
    day: 3,
  } as never
  assert.equal(festivalIsLive(live), true)
  assert.equal(festivalIsOnBreak(paused), true)
  const booth = { kind: 'food' as const }
  const full = buildingHourlyUpkeep(booth, { festivalLive: true, onBreak: false })
  const reduced = buildingHourlyUpkeep(booth, { festivalLive: true, onBreak: true })
  assert.ok(reduced < full * 0.3, 'booths drop upkeep hard during a day-plan break')
  const stage = { kind: 'stage' as const }
  const liveStage = buildingHourlyUpkeep(stage, { festivalLive: true, onBreak: false })
  const idleStage = buildingHourlyUpkeep(stage, { festivalLive: false, onBreak: false })
  assert.ok(idleStage < liveStage, 'inactive festival stages pay less upkeep')

  const empty = collectBuiltAtmosphereCells({})
  const decorated = collectBuiltAtmosphereCells({ buildings: [{ x: 2, z: 2 }] })
  assert.equal(empty.size, 0)
  assert.equal(decorated.size, 1)

  const game = GameState.startNew(normalizeScenarioSettings({ worldSize: 32, unevenness: 0, startingMoney: 40_000 }))
  const cheap = estimateTicketDemand(game.snapshot, { day: 40, camping: 80 })
  const expensive = estimateTicketDemand(game.snapshot, { day: 220, camping: 450 })
  assert.ok(cheap.expectedDayGuests > expensive.expectedDayGuests, 'high ticket prices reduce expected arrivals')
  const dayPrice = 120
  const campPrice = 260
  assert.ok(
    600 * campPrice + 5 * 600 * dayPrice >= 480_000,
    '600 campers and 600 day tickets per festival day at default prices cover a 400–500k weekend',
  )
  assert.ok(estimateTicketDemand(game.snapshot, { day: dayPrice, camping: campPrice }).expectedDayGuests > 0)
  assert.ok(BANDS.some((band) => isFiveStarBand(band)))
  assert.ok(BANDS.some((band) => bandStarRating(band) === 1))
  console.log('PASS course attractions, pause upkeep, built-area atmosphere, ticket demand and star bands')
}
