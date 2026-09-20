import assert from 'node:assert/strict'
import {
  COURSE_KINDS,
  COURSE_SPECS,
  appendCoursePiece,
  courseEditorMode,
  courseGhostSpan,
  courseNextBuildTarget,
  courseSpanCells,
  courseTrackEnd,
  courseUsesDirectionArrows,
  createEmptyCourse,
  createSeededCourse,
  describeCourseAppendIssue,
  formatCourseInspect,
  isCourseReadyToOperate,
  isCourseSwimCell,
  listCourseDirectionChoices,
  stepCourses,
  validateCourse,
  type CoursePiece,
} from '../src/game/courseAttractions'
import { migrateCourse } from '../src/game/attractions/migration'
import { GameState } from '../src/game/GameState'
import { applyGameCommand } from '../src/net/commands'
import { packWorld } from '../src/net/codec'
import { WorldUpdates } from '../src/net/worldUpdates'
import { handleInspectCell } from '../src/input/cellToolHandlers'
import { normalizeScenarioSettings } from '../src/game/scenario'
import { createBlankSnapshot } from '../src/game/snapshotBootstrap'
import { estimateTicketDemand } from '../src/game/ticketDemand'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import { CourseView } from '../src/view/CourseView'
import {
  BASIN_NEIGHBOR,
  basinNeighborMask,
  basinOuterEdges,
  collectCourseBasinCells,
  greedyBasinRects,
  indexBasinCells,
} from '../src/view/courseBasinMesh'
import { Box3, Vector3 } from 'three'
import { buildingHourlyUpkeep, festivalIsLive, festivalIsOnBreak } from '../src/game/upkeep'
import { collectBuiltAtmosphereCells } from '../src/game/atmosphere'
import { BUILDINGS } from '../src/game/catalog'
import { listedBuildTools } from '../src/game/buildMenu'
import { BANDS, bandStarRating, isFiveStarBand } from '../src/game/festivalManagement'
import { defaultStageDesign } from '../src/game/stageDesign'
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
    assert.equal(isCourseReadyToOperate(course), true, `${kind} seed is inspectable`)
    const inspect = formatCourseInspect(course, true)
    assert.equal(inspect.typeLabel, COURSE_SPECS[kind].name)
    assert.equal(inspect.lines.find((line) => line.label === 'Betrieb')?.value, 'Geöffnet')
    assert.match(inspect.status, /geöffnet/i)
    course.operating = false
    const closedInspect = formatCourseInspect(course, true)
    assert.equal(closedInspect.lines.find((line) => line.label === 'Betrieb')?.value, 'Geschlossen')
    assert.match(closedInspect.status, /geschlossen/i)
    course.operating = true
    const scheduled = formatCourseInspect(course, false)
    assert.match(scheduled.status, /Tagesplan/)
  }
  const unfinished = createEmptyCourse('draft-inspect', 'mudmasters')
  assert.equal(isCourseReadyToOperate(unfinished), false)
  assert.match(formatCourseInspect(unfinished, true).status, /Eingang/)
  const mud = createSeededCourse('shape-mud', 'mudmasters', 0, 0)
  assert.ok(mud.pieces.some((piece) => piece.kind === 'climbWall'))
  assert.ok(mud.pieces.some((piece) => piece.kind === 'waterDitch'))
  assert.ok(mud.pieces.some((piece) => piece.kind === 'monkeyBars'))
  assert.ok(new Set(mud.pieces.map((piece) => `${piece.x},${piece.z}`)).size > 6, 'mudmasters is a 2D parkour footprint')
  const pool = createSeededCourse('shape-pool', 'pool', 0, 0)
  assert.ok(pool.pieces.filter((piece) => piece.kind === 'poolBasin').length >= 4)
  assert.equal(pool.pieces.some((piece) => piece.kind === 'waterSlide'), false)
  const waterPark = createSeededCourse('shape-slide', 'waterSlide', 8, 0)
  assert.equal(waterPark.pieces[0]?.kind, 'ladder')
  assert.ok(waterPark.pieces.some((piece) => piece.kind === 'waterSlide'))
  assert.ok(waterPark.pieces.some((piece) => piece.kind === 'poolBasin'))
  assert.equal(waterPark.pieces.at(-1)?.kind === 'ladder', false)
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
  assert.ok(park.addCoursePiece(poolId, 'path', 7, -6).ok)
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
  assert.ok(
    (courseView as { basinWaterMesh: { count: number } }).basinWaterMesh.count >= 1,
    'pool basins share one instanced water surface',
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
  assert.equal(visitor.needs.fun, 10, 'legacy course admission grants no fun before completion')

  for (const kind of ['mudmasters', 'pool', 'treeToTree'] as const) {
    const completedCourse = createSeededCourse(`completed-${kind}`, kind, 24, 24)
    const completedVisitor = fakeVisitor(`completed-${kind}`)
    completedVisitor.state = 'riding'
    completedVisitor.targetId = completedCourse.id
    const exitPiece = completedCourse.pieces.find((piece) => piece.kind === 'exit')!
    completedCourse.riders = [{
      visitorId: completedVisitor.id,
      pieceId: exitPiece.id,
      progress: 0.99,
      airborne: false,
    }]
    stepCourses(
      { courses: [completedCourse], visitors: [completedVisitor], simTick: 2 },
      { next: () => 0.2 },
      { minutes: 0.1, charge: () => true, injure: () => undefined },
    )
    assert.equal(
      completedVisitor.needs.fun,
      10 + SIMULATION_CONFIG.courses.funGain,
      `${kind} awards fun only at the completed exit`,
    )
  }

  const completedPaintball = createSeededCourse('completed-paintball', 'paintball', 28, 28)
  completedPaintball.teamSize = 1
  completedPaintball.match = { remainingTicks: 1, scoreA: 0, scoreB: 0 }
  const paintA = fakeVisitor('paint-a')
  const paintB = fakeVisitor('paint-b')
  paintA.state = 'riding'
  paintB.state = 'riding'
  completedPaintball.riders = [
    { visitorId: paintA.id, pieceId: '', progress: 0, airborne: false, team: 'a' },
    { visitorId: paintB.id, pieceId: '', progress: 0, airborne: false, team: 'b' },
  ]
  stepCourses(
    { courses: [completedPaintball], visitors: [paintA, paintB], simTick: 3 },
    { next: () => 0.2 },
    { minutes: 0.1, charge: () => true, injure: () => undefined },
  )
  assert.equal(paintA.needs.fun, 10 + SIMULATION_CONFIG.courses.funGain)
  assert.equal(paintB.needs.fun, 10 + SIMULATION_CONFIG.courses.funGain)

  const unsafe = createSeededCourse('unsafe-slide', 'waterSlide', 20, 20)
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

  testCourseEditorFollowsTheTrackEditor()
  testWaterSlideIsItsOwnTrack()
  testConnectedBasinMesh()
  testCourseMultiplayerRoundtrip()
}

/**
 * The course editors build like the coaster editor: a piece is appended at the
 * open end in the selected direction, the ghost shows that span before the click,
 * undo peels the last piece off, and the canonical attraction record follows the
 * edit so a save keeps the course.
 */
function testCourseEditorFollowsTheTrackEditor(): void {
  const park = new GameState(
    createBlankSnapshot(normalizeScenarioSettings({ worldSize: 48, unevenness: 0, startingMoney: 120_000 })),
  )
  const started = park.startCourse('mudmasters', 4, 0)
  assert.ok(started.ok && started.id, started.message)
  const courseId = started.id!
  const course = park.getCourse(courseId)!
  assert.equal(course.pieces.length, 1, 'a fresh parkour only owns its entrance')
  assert.deepEqual(courseTrackEnd(course), { x: 4, z: 0, elevation: 0 })

  assert.deepEqual(courseNextBuildTarget(course, 'path', 1, 0), { x: 5, z: 0, elevation: 0 })
  assert.deepEqual(courseNextBuildTarget(course, 'path', 3, 0), { x: 3, z: 0, elevation: 0 })
  assert.deepEqual(courseNextBuildTarget(course, 'climbWall', 0, 1), { x: 4, z: 1, elevation: 1 })
  const ghost = courseGhostSpan(course, 'path', 1, 0)
  assert.deepEqual(
    ghost?.cells,
    [{ x: 4, z: 0 }, { x: 5, z: 0 }],
    'the ghost spans from the open end to the next field',
  )
  assert.equal(ghost?.valid, true)

  const forward = courseNextBuildTarget(course, 'path', 1, 0)!
  assert.ok(park.addCoursePiece(courseId, 'path', forward.x, forward.z, forward.elevation).ok)
  assert.deepEqual(courseTrackEnd(course), { x: 5, z: 0, elevation: 0 })
  const climb = courseNextBuildTarget(course, 'climbWall', 1, 1)!
  assert.ok(park.addCoursePiece(courseId, 'climbWall', climb.x, climb.z, climb.elevation).ok)
  assert.deepEqual(courseTrackEnd(course), { x: 6, z: 0, elevation: 1 }, 'elevation follows the build height')
  assert.equal(course.pieces.length, 3)

  assert.ok(park.undoCoursePiece(courseId).ok)
  assert.equal(course.pieces.length, 2, 'undo removes the last piece only')
  assert.deepEqual(courseTrackEnd(course), { x: 5, z: 0, elevation: 0 })

  // Area courses keep their own rule: the ghost already reports a span that
  // leaves the pool, so the preview turns red before the click is refused.
  const poolStart = park.startCourseArea('pool', [
    { x: 12, z: 0 },
    { x: 13, z: 0 },
  ])
  assert.ok(poolStart.ok && poolStart.id, poolStart.message)
  const pool = park.getCourse(poolStart.id!)!
  assert.ok(park.addCoursePiece(pool.id, 'entrance', 12, 0).ok)
  assert.equal(courseGhostSpan(pool, 'ladder', 1, 0)?.valid, true)
  assert.equal(
    courseGhostSpan(pool, 'ladder', 3, 0)?.valid,
    false,
    'a span leaving the pool area is not a valid ghost',
  )

  const record = park.getAttraction(courseId)
  assert.equal(record?.runtime.kind, 'course', 'the canonical record follows the course editor')
  const reloaded = new GameState(structuredClone(park.snapshot))
  assert.equal(reloaded.getCourse(courseId)?.pieces.length, 2, 'a save keeps the edited course')
  assert.equal(reloaded.getCourse(pool.id)?.areaCells.length, 2)

  assert.ok(park.removeCourse(pool.id).ok)
  assert.equal(park.getAttraction(pool.id), undefined, 'demolish drops the canonical record too')
}

function testWaterSlideIsItsOwnTrack(): void {
  const park = new GameState(
    createBlankSnapshot(normalizeScenarioSettings({ worldSize: 48, unevenness: 0, startingMoney: 80_000 })),
  )
  const started = park.startCourse('waterSlide', 2, 2)
  assert.ok(started.ok && started.id, started.message)
  const course = park.getCourse(started.id!)!
  assert.equal(course.kind, 'waterSlide')
  assert.equal(course.pieces[0]?.kind, 'ladder')
  assert.ok(park.getCourseAt(2, 2))
  assert.ok(park.getAttraction(course.id), 'the first ladder already writes the canonical record')
  assert.equal(migrateCourse(course).some((entry) => entry.id === course.id), true)
  assert.equal(courseEditorMode('waterSlide'), 'directionArrows')

  assert.equal(describeCourseAppendIssue(course, 'ladder', 3, 2), 'Setze die nächste Leiter auf die bestehende, um höher zu kommen.')
  assert.equal(describeCourseAppendIssue(course, 'ladder', 2, 2), null)
  assert.ok(park.addCoursePiece(course.id, 'ladder', 2, 2).ok)
  assert.equal(course.pieces.filter((piece) => piece.kind === 'ladder').length, 2)
  assert.ok((course.pieces.at(-1)?.elevation ?? 0) > (course.pieces[0]?.elevation ?? 0))

  const slide = courseNextBuildTarget(course, 'waterSlide', 1, 1)!
  assert.ok(park.addCoursePiece(course.id, 'waterSlide', slide.x, slide.z, slide.elevation).ok)
  assert.match(
    describeCourseAppendIssue(course, 'ladder', 2, 2) ?? '',
    /Start/,
    'ladders are refused after the slide starts',
  )
  const basin = courseNextBuildTarget(course, 'poolBasin', 1, 0)!
  assert.ok(park.addCoursePiece(course.id, 'poolBasin', basin.x, basin.z, 0).ok)
  const exit = courseNextBuildTarget(course, 'exit', 1, 0)!
  assert.ok(park.addCoursePiece(course.id, 'exit', exit.x, exit.z, 0).ok)
  assert.equal(validateCourse(course), null)
  assert.ok(isCourseSwimCell(park.snapshot.courses, basin.x, basin.z))
  assert.ok(park.setCourseOperating(course.id, true).ok)

  const view = new CourseView()
  view.update([course], [], 1)
  const water = (view as { basinWaterMesh: { count: number } }).basinWaterMesh
  assert.ok(water.count >= 1, 'the runout basin uses the shared water instance batch')
}

function basinPieces(
  id: string,
  cells: readonly { x: number; z: number; elevation?: number }[],
): { pieces: CoursePiece[] } {
  return {
    pieces: cells.map((cell, index) => ({
      kind: 'poolBasin' as const,
      id: `${id}-${index}`,
      x: cell.x,
      z: cell.z,
      elevation: cell.elevation ?? 0,
      rotation: 0,
    })),
  }
}

function testConnectedBasinMesh(): void {
  const isolated = { x: 4, z: 7, elevation: 0 }
  assert.equal(basinNeighborMask(isolated, indexBasinCells([isolated])), 0)
  assert.deepEqual(basinOuterEdges(0), ['posX', 'negX', 'posZ', 'negZ'])

  const pair = [
    { x: 2, z: 3, elevation: 0 },
    { x: 3, z: 3, elevation: 0 },
  ]
  const pairIndex = indexBasinCells(pair)
  assert.equal(basinNeighborMask(pair[0]!, pairIndex), BASIN_NEIGHBOR.posX)
  assert.equal(basinNeighborMask(pair[1]!, pairIndex), BASIN_NEIGHBOR.negX)
  assert.deepEqual(basinOuterEdges(BASIN_NEIGHBOR.posX), ['negX', 'posZ', 'negZ'])
  assert.deepEqual(greedyBasinRects(pair), [{ x: 2, z: 3, w: 2, d: 1, elevation: 0 }])

  const square = [
    { x: 0, z: 0, elevation: 0 },
    { x: 1, z: 0, elevation: 0 },
    { x: 0, z: 1, elevation: 0 },
    { x: 1, z: 1, elevation: 0 },
  ]
  assert.deepEqual(greedyBasinRects(square), [{ x: 0, z: 0, w: 2, d: 2, elevation: 0 }])
  const corner = { x: 0, z: 0, elevation: 0 }
  assert.equal(
    basinNeighborMask(corner, indexBasinCells(square)),
    BASIN_NEIGHBOR.posX | BASIN_NEIGHBOR.posZ,
  )

  const stacked = [
    { x: 5, z: 5, elevation: 0 },
    { x: 6, z: 5, elevation: 1 },
  ]
  const stackedIndex = indexBasinCells(stacked)
  assert.equal(basinNeighborMask(stacked[0]!, stackedIndex), 0)
  assert.deepEqual(greedyBasinRects(stacked), [
    { x: 5, z: 5, w: 1, d: 1, elevation: 0 },
    { x: 6, z: 5, w: 1, d: 1, elevation: 1 },
  ])

  const elbow = [
    { x: 1, z: 1, elevation: 0 },
    { x: 2, z: 1, elevation: 0 },
    { x: 3, z: 1, elevation: 0 },
    { x: 1, z: 2, elevation: 0 },
    { x: 2, z: 2, elevation: 0 },
  ]
  assert.deepEqual(greedyBasinRects(elbow), [
    { x: 1, z: 1, w: 3, d: 1, elevation: 0 },
    { x: 1, z: 2, w: 2, d: 1, elevation: 0 },
  ])

  const pool = basinPieces('pool-a', square)
  const slide = basinPieces('slide-b', [
    { x: 8, z: 0 },
    { x: 9, z: 0 },
  ])
  const touchingOther = [
    { x: 2, z: 0, elevation: 0 },
    { x: 3, z: 0, elevation: 0 },
  ]
  assert.equal(collectCourseBasinCells(pool).length, 4)
  assert.equal(greedyBasinRects(collectCourseBasinCells(pool)).length, 1)
  assert.equal(greedyBasinRects(collectCourseBasinCells(slide)).length, 1)
  assert.equal(
    basinNeighborMask(touchingOther[0]!, indexBasinCells(touchingOther)),
    BASIN_NEIGHBOR.posX,
  )
  assert.equal(
    basinNeighborMask(touchingOther[0]!, indexBasinCells(square)) & BASIN_NEIGHBOR.negX,
    BASIN_NEIGHBOR.negX,
    'a mixed index would join a foreign neighbor',
  )
  assert.equal(
    greedyBasinRects(collectCourseBasinCells(pool)).length +
      greedyBasinRects(touchingOther).length,
    2,
    'each attraction keeps its own water rectangle even when tiles touch',
  )

  const view = new CourseView()
  view.update(
    [
      { ...createEmptyCourse('pool-a', 'pool'), pieces: pool.pieces },
      { ...createEmptyCourse('slide-b', 'waterSlide'), pieces: slide.pieces },
    ],
    [],
    1,
  )
  const water = (view as { basinWaterMesh: { count: number } }).basinWaterMesh
  assert.equal(water.count, 2, 'each attraction keeps one greedy water rectangle')
  assert.ok(
    (view as { staticGroup: { children: unknown[] } }).staticGroup.children.length <= 8,
    'connected rims stay in the merged static mesh',
  )
}

function inspectStub() {
  const calls: string[] = []
  return {
    calls,
    actions: {
      openSweeper: (id: string) => calls.push(`sweeper:${id}`),
      openVehicle: (id: string) => calls.push(`vehicle:${id}`),
      openCoasterBuilder: (id: string) => calls.push(`coasterBuilder:${id}`),
      openCoaster: (id: string) => calls.push(`coaster:${id}`),
      openAccess: (id: string) => calls.push(`access:${id}`),
      openRide: (id: string) => calls.push(`ride:${id}`),
      openBuilding: (id: string) => calls.push(`building:${id}`),
      openDepot: (id: string) => calls.push(`depot:${id}`),
      openWasteDump: (x: number, z: number) => calls.push(`waste:${x}:${z}`),
      openBackstage: (x: number, z: number) => calls.push(`backstage:${x}:${z}`),
      openCourseBuilder: (id: string) => calls.push(`courseBuilder:${id}`),
      openCourse: (id: string) => calls.push(`course:${id}`),
      toast: (message: string) => calls.push(`toast:${message}`),
    },
  }
}

function testCourseMultiplayerRoundtrip(): void {
  const host = new GameState(
    createBlankSnapshot(normalizeScenarioSettings({ worldSize: 48, unevenness: 0, startingMoney: 120_000 })),
  )
  const courseResult = applyGameCommand(host, { type: 'startCourse', kind: 'mudmasters', x: 6, z: 4 })
  assert.equal(courseResult.ok, true, courseResult.message)
  const courseId = host.getCourseAt(6, 4)?.id
  assert.ok(courseId)
  assert.ok(host.getAttraction(courseId), 'host occupancy and attraction stay paired after place')

  const coasterResult = applyGameCommand(host, { type: 'startCoaster', typeId: 'classicSteel', x: -8, z: 4 })
  assert.equal(coasterResult.ok, true, coasterResult.message)
  const coasterId = host.getCoasterAt(-8, 4)?.id
  assert.ok(coasterId)

  const slideResult = applyGameCommand(host, { type: 'startCourse', kind: 'waterSlide', x: 10, z: 6 })
  assert.equal(slideResult.ok, true, slideResult.message)

  const updates = new WorldUpdates()
  const full = JSON.parse(updates.encode(packWorld(host.snapshot), true)) as {
    world: Parameters<GameState['applyNetworkWorld']>[0]
  }
  const guest = new GameState()
  guest.setTool('inspect')
  guest.applyNetworkWorld(full.world)
  assert.ok(guest.getCourseAt(6, 4), 'full sync keeps the course pickable')
  assert.ok(guest.getAttraction(courseId))
  assert.ok(guest.getCoasterAt(-8, 4))
  assert.ok(guest.getCourseAt(10, 6))

  const inspect = inspectStub()
  assert.equal(handleInspectCell(guest, { x: 6, z: 4, localX: 0.5, localZ: 0.5 }, inspect.actions), true)
  assert.ok(inspect.calls[0]?.startsWith('courseBuilder:'), inspect.calls.join(','))

  const staleAttractions = host.snapshot.attractions.filter((attraction) => attraction.id !== courseId)
  guest.applyNetworkUpdate({ attractions: structuredClone(staleAttractions) })
  assert.ok(guest.getCourseAt(6, 4), 'a stale attractions delta must not wipe the live course')
  assert.ok(guest.getCourse(courseId))
  assert.ok(guest.getAttraction(courseId), 'refreshLegacy writes the live course back onto attractions')
  assert.equal(guest.startCourse('mudmasters', 6, 4).ok, false, 'the host tile stays occupied')

  const delta = JSON.parse(updates.encode(packWorld(host.snapshot))) as {
    world: Parameters<GameState['applyNetworkUpdate']>[0]
    visitors: Parameters<GameState['applyNetworkUpdate']>[1]
    removed: string[]
  }
  guest.applyNetworkUpdate(delta.world, delta.visitors, delta.removed)
  assert.ok(guest.getCourseAt(6, 4))
  assert.ok(guest.getCoasterAt(-8, 4))
  assert.ok(guest.getCourseAt(10, 6))
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
  const idleBooth = buildingHourlyUpkeep(booth, { festivalLive: false, onBreak: false })
  assert.ok(reduced < full * 0.1, 'booths drop upkeep hard during a day-plan break')
  assert.ok(idleBooth < full * 0.1, 'booths sit at idle upkeep when the festival is not live')
  const stage = { kind: 'stage' as const }
  const liveStage = buildingHourlyUpkeep(stage, { festivalLive: true, onBreak: false })
  const idleStage = buildingHourlyUpkeep(stage, { festivalLive: false, onBreak: false })
  assert.ok(idleStage < liveStage * 0.1, 'inactive festival stages pay idle upkeep')
  const equippedDesign = defaultStageDesign()
  equippedDesign.parts.push({
    id: 'upkeep-truss',
    kind: 'truss',
    brand: 'premium',
    x: 0,
    y: 0,
    z: 0,
    rotation: 0,
    attachedTo: null,
    color: '#ffffff',
  })
  const equippedStage = { kind: 'stage' as const, stageDesign: equippedDesign }
  const equippedLive = buildingHourlyUpkeep(equippedStage, { festivalLive: true, onBreak: false })
  const equippedIdle = buildingHourlyUpkeep(equippedStage, { festivalLive: false, onBreak: false })
  assert.ok(equippedLive > liveStage, 'stage equipment adds technical upkeep while live')
  assert.equal(equippedIdle, idleStage, 'inactive festival stages pay no technical upkeep')

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

  assert.equal(courseEditorMode('mudmasters'), 'directionArrows')
  assert.equal(courseEditorMode('treeToTree'), 'directionArrows')
  assert.equal(courseEditorMode('pool'), 'directionArrows')
  assert.equal(courseEditorMode('waterSlide'), 'directionArrows')
  assert.equal(courseEditorMode('paintball'), 'palette')
  assert.equal(COURSE_SPECS.mudmasters.editorMode, 'directionArrows')
  assert.equal(courseUsesDirectionArrows('paintball'), false)
  const arrowCourse = createEmptyCourse('arrow-course', 'mudmasters')
  assert.deepEqual(listCourseDirectionChoices(arrowCourse, 'path'), [])
  assert.notEqual(appendCoursePiece(arrowCourse, 'entrance', 4, 4, 0), 'string')
  const openArrows = listCourseDirectionChoices(arrowCourse, 'path')
  assert.equal(openArrows.length, 4)
  assert.ok(openArrows.every((choice) => choice.enabled), 'an isolated entrance can grow in every neighbor heading')
  const before = arrowCourse.pieces.length
  assert.equal(describeCourseAppendIssue(arrowCourse, 'path', 5, 4), null)
  assert.equal(arrowCourse.pieces.length, before, 'direction checks must not mutate the course')
  assert.notEqual(appendCoursePiece(arrowCourse, 'path', 5, 4, 1), 'string')
  const continued = listCourseDirectionChoices(arrowCourse, 'path')
  const backward = continued.find((choice) => choice.heading === 3)
  assert.equal(backward?.x, 4)
  assert.equal(backward?.z, 4)
  assert.equal(backward?.enabled, false, 'the already-built heading stays disabled')
  assert.ok(
    continued.filter((choice) => choice.enabled).length === 3,
    'only unbuilt neighbor headings stay clickable',
  )
  const trees = createEmptyCourse('tree-arrows', 'treeToTree')
  assert.notEqual(appendCoursePiece(trees, 'entrance', 0, 0, 0), 'string')
  assert.deepEqual(
    listCourseDirectionChoices(trees, 'tree'),
    [],
    'free-placed trees are not path-led neighbor arrows',
  )

  console.log('PASS course attractions, pause upkeep, built-area atmosphere, ticket demand and star bands')
}
