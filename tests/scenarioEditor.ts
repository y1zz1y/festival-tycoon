import assert from 'node:assert/strict'
import { GameState } from '../src/game/GameState'
import { BUILDINGS } from '../src/game/catalog'
import {
  listedScenarioFiles,
  listedScenarioPresets,
  mergeScenarioCatalog,
  registerFileScenarios,
  scenarioFileEntry,
  scenarioListRows,
} from '../src/game/scenarioCatalog'
import {
  createAuthoringSettings,
  createSnapshotFromScenarioFile,
  exportScenarioFile,
  parseScenarioFile,
  serializeScenarioFile,
  type ScenarioFile,
} from '../src/game/scenarioFile'
import { createBlankSnapshot } from '../src/game/snapshotBootstrap'
import { normalizeScenarioSettings } from '../src/game/scenario'
import { SCENARIO_PRESETS } from '../src/game/scenarioPresets'

function sampleFile(): ScenarioFile {
  const parsed = parseScenarioFile({
    id: 'flutlichtwiese',
    name: 'Flutlichtwiese',
    detail: 'Ein nasser Acker mit geliehenem Geld und vielen Autos.',
    settings: {
      environment: 'farmland',
      worldSize: 32,
      startingMoney: 22_000,
      startingLoan: 12_000,
      carArrivalShare: 0.8,
      partyAffinity: 0.4,
      beautyAffinity: 0.3,
      aggressiveShare: 0.2,
      unevenness: 0,
    },
    tickets: { day: 80, camping: 20 },
    demandTuning: { attendance: { dayBaseGuests: 400, campingBaseGuests: 90 } },
  })
  assert.ok(parsed)
  return parsed
}

export function testScenarioEditor(): void {
  const file = sampleFile()
  const listed = mergeScenarioCatalog([file, { name: 'Ohne Text' }, file])
  assert.equal(listed.length, 1)
  assert.equal(listed[0]?.detail, 'Ein nasser Acker mit geliehenem Geld und vielen Autos.')
  const rows = scenarioListRows(listedScenarioPresets())
  assert.ok(rows.some((row) => row.id === 'flutlichtwiese' && row.detail.includes('nasser Acker')))
  assert.equal(scenarioFileEntry('flutlichtwiese')?.name, 'Flutlichtwiese')
  assert.equal(listedScenarioFiles()[0]?.id, 'flutlichtwiese')
  assert.equal(SCENARIO_PRESETS.length, 8, 'built-in presets stay in the catalog')

  const started = GameState.startFromScenarioFile(file)
  const play = started.snapshot
  assert.equal(play.money, 22_000)
  assert.equal(play.finance.loan, 12_000)
  assert.equal(play.scenario.startingMoney, 22_000)
  assert.equal(play.scenario.startingLoan, 12_000)
  assert.equal(play.scenario.title, 'Flutlichtwiese')
  assert.equal(play.scenario.detail, file.detail)
  assert.equal(play.scenario.preset, 'flutlichtwiese')
  assert.equal(play.scenario.authoring, undefined)
  assert.equal(play.festival.tickets?.day, 80)
  assert.equal(play.festival.tickets?.camping, 20)
  assert.equal(play.festival.demandTuning.attendance.dayBaseGuests, 400)
  assert.equal(play.festival.demandTuning.attendance.campingBaseGuests, 90)

  const editor = new GameState(createBlankSnapshot(createAuthoringSettings({
    worldSize: 32,
    unevenness: 0,
    startingMoney: 5_000,
  })))
  assert.equal(editor.snapshot.scenario.authoring, true)
  editor.snapshot.money = 0
  const cost = BUILDINGS.statue.cost
  assert.ok(cost > 0)
  const placed = editor.place('statue', 2, 2, 0)
  assert.ok(placed.ok, placed.message)
  assert.equal(editor.snapshot.money, 0, 'authoring does not charge construction')
  assert.ok(editor.snapshot.buildings.some((building) => building.kind === 'statue'))

  const broke = new GameState(createBlankSnapshot(normalizeScenarioSettings({ worldSize: 32, unevenness: 0, startingMoney: 5_000 })))
  broke.snapshot.money = 0
  const refused = broke.place('statue', 2, 2, 0)
  assert.equal(refused.ok, false, 'a normal game still needs money')

  editor.paintGroundCover(4, 5, 'salt')
  const exported = exportScenarioFile(editor.snapshot, {
    name: 'Exportwiese',
    detail: 'Aus dem Editor, mit Statue.',
    startingMoney: 18_000,
    startingLoan: 7_500,
    carArrivalShare: 0.25,
    partyAffinity: 0.6,
    beautyAffinity: 0.7,
    aggressiveShare: 0.1,
    tickets: { day: 40, camping: 15 },
  })
  const roundTrip = parseScenarioFile(JSON.parse(serializeScenarioFile(exported)))
  assert.ok(roundTrip)
  assert.equal(roundTrip.name, 'Exportwiese')
  assert.equal(roundTrip.detail, 'Aus dem Editor, mit Statue.')
  assert.ok(roundTrip.world?.buildings?.some((building) => building.kind === 'statue'))
  assert.equal(roundTrip.world?.festival?.infrastructure?.ground['4,5']?.cover, 'salt')
  const fromExport = GameState.startFromScenarioFile(roundTrip)
  assert.equal(fromExport.snapshot.money, 18_000)
  assert.equal(fromExport.snapshot.finance.loan, 7_500)
  assert.equal(fromExport.snapshot.scenario.authoring, undefined)
  assert.ok(fromExport.snapshot.buildings.some((building) => building.kind === 'statue'))
  assert.equal(fromExport.snapshot.festival.infrastructure.ground['4,5']?.cover, 'salt')
  assert.equal(createSnapshotFromScenarioFile(roundTrip).festival.tickets?.day, 40)

  registerFileScenarios([])
}
