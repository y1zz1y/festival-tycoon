import assert from 'node:assert/strict'
import { GameState } from '../src/game/GameState'
import { enableMultiplayerCommands } from '../src/net/bind'
import type { GameCommand } from '../src/net/protocol'
import { handleInspectCell } from '../src/input/cellToolHandlers'
import { applyDirectCellTool } from '../src/input/toolRouter'
import { createBlankSnapshot } from '../src/game/snapshotBootstrap'
import { normalizeScenarioSettings } from '../src/game/scenario'
import { connectedPathLine, rectangleCells } from '../src/input/pathToolController'
import { contextHelpText } from '../src/ui/contextHelp'
import { catalogTileHtml } from '../src/ui/buildCatalog'
import {
  removableCoastersAtCells,
  rideDemolishPrompt,
  wouldBulldozeRemoveCoaster,
} from '../src/ui/confirmDialog'
import {
  courseDirectionChoicesForPanel,
  orderedCourseLineTargets,
} from '../src/ui/courseBuilderPanel'
import { DifferentialUpdates, listFingerprint } from '../src/ui/differentialUpdates'
import { appendCoursePiece, createEmptyCourse, createSeededCourse } from '../src/game/courseAttractions'
import { trackEditorUsesDirectionArrows } from '../src/game/trackEditorMode'
import {
  areaSelection,
  createAreaDesignationHandler,
  normalizeRectangle,
} from '../src/ui/areaDesignation'
import {
  COMMAND_METADATA,
  GAME_COMMAND_TYPES,
  isOptimisticCommand,
} from '../src/net/commandRegistry'
import {
  composeSaveArchive,
  findSaveSlot,
  offlineSaveArchive,
  saveArchiveHtml,
  saveStorageNote,
  type SaveSlotView,
} from '../src/ui/saveArchive'
import {
  escapeHtml,
  formatMoney,
  formatSaveTime,
  formatTime,
} from '../src/ui/format'

export function testUiModules(): void {
  assert.equal(escapeHtml(`<Festival & "Fans">`), '&lt;Festival &amp; &quot;Fans&quot;&gt;')
  assert.equal(formatMoney(1234.9), '1.234 €')
  assert.equal(formatTime(8 * 60 + 5), '08:05')
  assert.match(formatSaveTime(0), /\d/)

  assert.deepEqual(normalizeRectangle({ x: 4, z: 2 }, { x: -1, z: 8 }), {
    minX: -1,
    maxX: 4,
    minZ: 2,
    maxZ: 8,
  })
  assert.equal(areaSelection({ x: 4, z: 2 }, { x: -1, z: 8 }).from.x, 4, 'area normalization preserves the drag anchor')
  const areaPhases: string[] = []
  const areaHandler = createAreaDesignationHandler({
    preview: ({ rectangle }) => areaPhases.push(`preview:${rectangle.minX}`),
    execute: ({ rectangle }) => areaPhases.push(`execute:${rectangle.maxX}`),
  })
  areaHandler({ x: 3, z: 0 }, { x: 1, z: 1 }, true)
  areaHandler({ x: 3, z: 0 }, { x: 1, z: 1 }, false)
  assert.deepEqual(areaPhases, ['preview:1', 'execute:3'])

  assert.equal(GAME_COMMAND_TYPES.length, Object.keys(COMMAND_METADATA).length)
  assert.equal(isOptimisticCommand({ type: 'place', kind: 'food', x: 0, z: 0 }), true)
  assert.equal(isOptimisticCommand({ type: 'setSpeed', speed: 2 }), false)
  assert.equal(isOptimisticCommand({ type: 'festival', action: { type: 'groundArea', from: { x: 0, z: 0 }, to: { x: 1, z: 1 }, kind: 'compact' } }), true)

  const updates = new DifferentialUpdates()
  let calls = 0
  assert.equal(updates.run('panel', 'same', () => calls++), true)
  assert.equal(updates.run('panel', 'same', () => calls++), false)
  assert.equal(updates.run('panel', listFingerprint(['changed', 1]), () => calls++), true)
  updates.invalidate('panel')
  assert.equal(updates.run('panel', listFingerprint(['changed', 1]), () => calls++), true)
  assert.equal(calls, 3)

  assert.deepEqual(rectangleCells({ x: 2, z: 1 }, { x: 0, z: 2 }), [
    { x: 0, z: 1 }, { x: 0, z: 2 }, { x: 1, z: 1 },
    { x: 1, z: 2 }, { x: 2, z: 1 }, { x: 2, z: 2 },
  ])
  assert.deepEqual(connectedPathLine({ x: 0, z: 0 }, { x: 2, z: 2 }), [
    { x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 },
    { x: 2, z: 1 }, { x: 2, z: 2 },
  ])
  const course = createEmptyCourse('line-course', 'mudmasters')
  assert.notEqual(appendCoursePiece(course, 'entrance', 2, 2, 0), 'string')
  assert.deepEqual(
    orderedCourseLineTargets(course, [{ x: 2, z: 2 }, { x: 3, z: 2 }, { x: 4, z: 2 }]),
    [{ x: 3, z: 2 }, { x: 4, z: 2 }],
  )
  assert.deepEqual(
    orderedCourseLineTargets(course, [{ x: 4, z: 2 }, { x: 3, z: 2 }, { x: 2, z: 2 }]),
    [{ x: 3, z: 2 }, { x: 4, z: 2 }],
    'dragging toward the current endpoint still produces one ordered route',
  )
  assert.match(
    String(orderedCourseLineTargets(course, [{ x: 7, z: 7 }, { x: 8, z: 7 }])),
    /Streckenende/,
  )
  assert.equal(trackEditorUsesDirectionArrows('directionArrows'), true)
  assert.equal(trackEditorUsesDirectionArrows('palette'), false)
  assert.notEqual(appendCoursePiece(course, 'path', 3, 2, 1), 'string')
  const mudArrows = courseDirectionChoicesForPanel({
    kind: 'mudmasters',
    course,
    selectedKind: 'path',
    elevation: 0,
    buildRotation: 1,
    cameraQuarter: 0,
  })
  assert.equal(mudArrows.filter((choice) => choice.enabled).length, 3)
  assert.equal(
    mudArrows.find((choice) => choice.heading === 3)?.enabled,
    false,
    'course arrow chrome greys the already-built heading',
  )
  assert.deepEqual(
    courseDirectionChoicesForPanel({
      kind: 'paintball',
      course: createEmptyCourse('paint-ui', 'paintball'),
      selectedKind: 'cover',
      elevation: 0,
      buildRotation: 0,
      cameraQuarter: 0,
    }),
    [],
    'area-only paintball keeps palette chrome, not neighbor arrows',
  )

  const local: SaveSlotView[] = [{
    id: 'local',
    name: '<Local>',
    savedAt: 20,
    public: false,
    owner: '',
    source: 'browser',
  }]
  const archive = composeSaveArchive(local, {
    account: 'Marvin',
    own: [{ id: 'server', name: 'Server', savedAt: 30, public: false, owner: 'Marvin' }],
    shared: [{ id: 'shared', name: 'Shared', savedAt: 10, public: true, owner: '<Guest>' }],
  })
  assert.deepEqual(archive.own.map((slot) => slot.id), ['server', 'local'])
  assert.equal(findSaveSlot(archive, 'shared')?.owner, '<Guest>')
  assert.match(saveStorageNote(archive), /Marvin/)
  const html = saveArchiveHtml(archive, String)
  assert.match(html, /&lt;Local&gt;/)
  assert.match(html, /&lt;Guest&gt;/)
  assert.equal(html.includes('<Local>'), false)
  assert.match(saveStorageNote(offlineSaveArchive(local, new Error('offline'))), /offline/)

  const game = new GameState()
  game.setTool('path')
  enableMultiplayerCommands(game)
  game.networkMode = 'client'
  const sent: GameCommand[] = []
  game.commandOutbox = (command) => sent.push(command)
  const routed = applyDirectCellTool(
    game,
    { x: -4, z: 0, localX: 0.5, localZ: 0.5 },
    {
      pathConstructionType: 'normal',
      pathDirection: 0,
      footType: 'footDirt',
      roadType: 'roadAsphalt',
      backstageEraseMode: false,
      bungeeBuildMode: false,
      bungeeHeight: 20,
    },
  )
  assert.equal(routed.handled, true)
  assert.equal(routed.result?.ok, true)
  assert.equal(sent.length, 1, 'extracted tool routing still uses the multiplayer gate')

  game.setTool('camping')
  assert.match(contextHelpText({
    game,
    hoveredCell: { x: 0, z: 0 },
    placementPreview: { valid: false, message: 'Autoritative Vorschau' },
    modes: {
      coaster: { active: false, coasterId: null, startCandidate: null, accessMode: null },
      course: { active: false },
      path: { open: false, constructing: false, demolishing: false, road: false, anchor: null, constructionType: 'normal' },
      rideAccess: null,
      backstageEraseMode: false,
      copyClipboard: null,
    },
  }), /Autoritative Vorschau/)

  const tile = catalogTileHtml(
    { tool: 'food', name: '<Food>', icon: 'F', detail: '20 €', previewKind: 'food' },
    true,
    game.snapshot,
    (value) => `${value} €`,
  )
  assert.match(tile, /data-preview-kind="food"/)
  assert.match(tile, /&lt;Food&gt;/)

  const named = rideDemolishPrompt('coaster', 'Twister')
  assert.equal(named.title, 'Achterbahn abreißen?')
  assert.match(named.message, /„Twister“/)
  assert.match(named.message, /Station/)
  assert.equal(named.confirmLabel, 'Abreißen')
  const unnamed = rideDemolishPrompt('coaster')
  assert.match(unnamed.message, /diese Achterbahn/)
  const courses = rideDemolishPrompt('course', ['Mudmasters', 'Pool'])
  assert.equal(courses.title, '2 Kurse abreißen?')
  assert.match(courses.message, /„Mudmasters“.+„Pool“/)
  assert.match(courses.message, /gesamte Kurs/)

  const park = new GameState()
  const started = park.startCoaster('classicSteel', 10, -10)
  assert.ok(started.ok && started.id)
  const ride = park.getCoaster(started.id!)!
  assert.equal(wouldBulldozeRemoveCoaster(park, { x: 10, z: -10 })?.id, ride.id)
  assert.equal(wouldBulldozeRemoveCoaster(park, { x: 10, z: -10, buildingId: 'other' }), undefined)
  assert.equal(wouldBulldozeRemoveCoaster(park, { x: 0, z: 0 }), undefined)
  assert.deepEqual(removableCoastersAtCells(park, [{ x: 10, z: -10 }, { x: 11, z: -10 }]).map((entry) => entry.id), [ride.id])

  const inspectPark = new GameState(
    createBlankSnapshot(normalizeScenarioSettings({ worldSize: 48, unevenness: 0, startingMoney: 80_000 })),
  )
  inspectPark.setTool('inspect')
  const inspectCalls: string[] = []
  const inspectActions = {
    openSweeper: (id: string) => inspectCalls.push(`sweeper:${id}`),
    openVehicle: (id: string) => inspectCalls.push(`vehicle:${id}`),
    openCoasterBuilder: (id: string) => inspectCalls.push(`coasterBuilder:${id}`),
    openCoaster: (id: string) => inspectCalls.push(`coaster:${id}`),
    openAccess: (id: string) => inspectCalls.push(`access:${id}`),
    openRide: (id: string) => inspectCalls.push(`ride:${id}`),
    openBuilding: (id: string) => inspectCalls.push(`building:${id}`),
    openDepot: (id: string) => inspectCalls.push(`depot:${id}`),
    openWasteDump: (x: number, z: number) => inspectCalls.push(`waste:${x}:${z}`),
    openBackstage: (x: number, z: number) => inspectCalls.push(`backstage:${x}:${z}`),
    openCourseBuilder: (id: string) => inspectCalls.push(`courseBuilder:${id}`),
    openCourse: (id: string) => inspectCalls.push(`course:${id}`),
    toast: (message: string) => inspectCalls.push(`toast:${message}`),
  }
  const draftCourse = inspectPark.startCourse('mudmasters', 12, 12)
  assert.ok(draftCourse.ok && draftCourse.id)
  inspectCalls.length = 0
  assert.equal(handleInspectCell(inspectPark, { x: 12, z: 12, localX: 0.5, localZ: 0.5 }, inspectActions), true)
  assert.deepEqual(inspectCalls, [`courseBuilder:${draftCourse.id}`, `toast:${inspectPark.getCourse(draftCourse.id!)!.name} wird weitergebaut`])
  const inspectOrigins = {
    mudmasters: { x: 22, z: -4 },
    treeToTree: { x: 30, z: -4 },
    paintball: { x: 22, z: -12 },
    pool: { x: 30, z: -12 },
  } as const
  for (const kind of ['mudmasters', 'treeToTree', 'paintball', 'pool'] as const) {
    const origin = inspectOrigins[kind]
    const seeded = createSeededCourse(`inspect-${kind}`, kind, origin.x, origin.z)
    ;(inspectPark.snapshot.courses as Array<typeof seeded>).push(seeded)
    inspectCalls.length = 0
    const cell = seeded.pieces.find((piece) => piece.kind === 'entrance') ?? seeded.pieces[0]!
    assert.equal(handleInspectCell(inspectPark, { x: cell.x, z: cell.z, localX: 0.5, localZ: 0.5 }, inspectActions), true)
    assert.deepEqual(inspectCalls, [`course:${seeded.id}`], `${kind} inspect opens the info panel, not the builder`)
  }
}
