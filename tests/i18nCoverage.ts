import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BUILD_CATEGORIES } from '../src/game/buildMenu'
import { COASTER_TYPES } from '../src/game/coasters'
import { COURSE_SPECS } from '../src/game/courseAttractions'
import { BANDS, festivalTime, updateFestival } from '../src/game/festivalManagement'
import { BAND_NAMES, GameState, type GameSnapshot } from '../src/game/GameState'
import { buildHeadlineMagazine, type HeadlineMagazine } from '../src/game/headlineMagazine'
import type { ScenarioGoal } from '../src/game/scenario'
import { goalName, goalProgressText } from '../src/game/scenarioGoalText'
import { SCENARIO_PRESETS } from '../src/game/scenarioPresets'
import { COMPONENT_BRANDS, TRUSS_BRANDS } from '../src/game/stageDesign'
import { createTickerWatchState, observeTickerEvents, type TickerWatchState } from '../src/game/ticker'
import { FEMALE_VISITOR_NAMES, MALE_VISITOR_NAMES } from '../src/game/visitorSpawning'
import { letterCount } from '../src/i18n/pattern'
import { formatPercent, localizeHit, localizeName, setLocale, t } from '../src/i18n'
import { EN } from '../src/i18n/en'
import { setTextRecorder } from '../src/i18n/state'
import { applyGameCommand } from '../src/net/commands'
import type { GameCommand, GameCommandAction } from '../src/net/protocol'
import { catalogTileHtml } from '../src/ui/buildCatalog'
import { contextHelpText } from '../src/ui/contextHelp'
import { formatMoney } from '../src/ui/format'
import { composeSaveArchive, saveArchiveHtml } from '../src/ui/saveArchive'
import { briefingMarkup } from '../src/ui/titleScreen'

/**
 * English coverage (docs/i18n.md): how many German texts the game can put in front of
 * an English player that the catalog does not translate yet. Each conversion group
 * lowers the budget to its new count; it never rises, and the end state is 0.
 */
export const MISS_BUDGET = 0

const GERMAN_MARKERS = /[äöüÄÖÜß„]|(^|[^\p{L}])(der|die|das|den|dem|und|oder|nicht|ist|sind|ein|eine|einen|kein|keine|mit|für|auf|zum|zur|bei|vom|von|ich|wir|noch|schon|hier|wird|werden|kann|muss|nur|auch|alle|jetzt|bitte)(?=$|[^\p{L}])/iu

/**
 * game: canonical German from the simulation (judged with localizeHit); name: entity names;
 * client: display text built on the client, produced in both languages; key: a `t`/`tc`
 * key the English run missed; markup: text segments of HTML builders.
 */
type Kind = 'game' | 'name' | 'client' | 'key' | 'markup'
type Collected = { kind: Kind; text: string; english?: string }

/** What the English run looked up: every miss, and the English of every hit. */
type Lookups = { misses: Collected[]; hits: Set<string> }

function newLookups(): Lookups {
  return { misses: [], hits: new Set() }
}

/** Runs `produce` with the text recorder installed; misses keep their kind. */
function recording<T>(lookups: Lookups, produce: () => T): T {
  setTextRecorder((kind, text, hit) => {
    if (hit) lookups.hits.add(text)
    else lookups.misses.push({ kind: kind === 't' ? 'key' : kind === 'localize' ? 'game' : 'name', text })
  })
  try {
    return produce()
  } finally {
    setTextRecorder(null)
  }
}

/**
 * The text with its numbers, money and percentages blanked, so `50.000 € Guthaben` and
 * `€50,000 Guthaben` compare equal: locale-aware formatters must not make an untranslated
 * template look translated.
 */
function numberShape(text: string): string {
  return text.replace(/[-−]?€?\d[\d.,]*(?:\s?[€%])?/g, '#')
}

function loadFixture(): GameState {
  const raw = readFileSync('tests/fixtures/performance/festivalmittel.json', 'utf8')
  const parsed = JSON.parse(raw) as { snapshot?: unknown }
  const snapshot = typeof parsed.snapshot === 'string' ? parsed.snapshot : parsed.snapshot ? JSON.stringify(parsed.snapshot) : raw
  const game = GameState.fromJSON(snapshot)
  assert.ok(game, 'festivalmittel loads')
  return game
}

/** Stored prose: every `thought` and every prose-like `status`, anywhere in the snapshot. */
function collectStoredText(value: unknown, out: Collected[], key = ''): void {
  if (typeof value === 'string') {
    if ((key === 'thought' || key === 'status') && letterCount(value) >= 2 && (/\s/.test(value) || /^\p{Lu}/u.test(value) || /\P{ASCII}/u.test(value))) {
      out.push({ kind: 'game', text: value })
    }
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStoredText(item, out, key)
    return
  }
  if (value && typeof value === 'object') {
    for (const [child, item] of Object.entries(value)) collectStoredText(item, out, child)
  }
}

function collectNames(s: GameSnapshot, out: Collected[]): void {
  const push = (name: unknown): void => { if (typeof name === 'string' && name) out.push({ kind: 'name', text: name }) }
  for (const member of s.staff) push(member.name)
  for (const coaster of s.coasters) push(coaster.name)
  for (const course of s.courses) push(course.name)
  for (const attraction of s.attractions) push(attraction.name)
  for (const stop of s.logistics.busStops) push(stop.name)
  for (const line of s.logistics.busLines) push(line.name)
  for (const component of s.bandSupply.components) {
    for (const stage of component.stages) {
      push(stage.name)
      push(stage.bandName)
    }
  }
}

/**
 * Proper nouns and player content never count as misses. A group that wraps another
 * proper-noun table in keep() (course brands, English coaster types, real festivals)
 * adds that table here.
 */
function properNouns(s: GameSnapshot): Set<string> {
  const nouns = new Set<string>([...FEMALE_VISITOR_NAMES, ...MALE_VISITOR_NAMES, ...BANDS.map((band) => band.name)])
  for (const name of BAND_NAMES) nouns.add(name)
  for (const tiers of [...Object.values(COMPONENT_BRANDS), TRUSS_BRANDS]) {
    for (const brand of Object.values(tiers)) if (brand) nouns.add(brand.name)
  }
  for (const booking of s.festival.bookings) {
    const band = BANDS.find((candidate) => candidate.id === booking.bandId)
    if (band) nouns.add(band.name)
  }
  for (const component of s.bandSupply.components) for (const booking of component.bookings) nouns.add(booking.bandName)
  // Stage designs and templates carry names the player typed.
  for (const template of s.festival.stageTemplates ?? []) nouns.add(template.name)
  for (const building of s.buildings) if (building.stageDesign?.name) nouns.add(building.stageDesign.name)
  for (const visitor of s.visitors) nouns.add(visitor.name)
  const festival = s.festival as { sponsors?: { sponsor: string }[]; sponsorOffers?: { sponsor: string }[] }
  for (const contract of [...festival.sponsors ?? [], ...festival.sponsorOffers ?? []]) nouns.add(contract.sponsor)
  // Course brands and English coaster type names are kept as they are.
  for (const kind of ['mudmasters', 'treeToTree', 'paintball'] as const) nouns.add(COURSE_SPECS[kind].name)
  for (const type of ['corkscrew', 'twister', 'verticalDrop', 'inverted', 'flying'] as const) nouns.add(COASTER_TYPES[type].name)
  // Real festivals the scenario presets are named after (scenarioPresets.ts, keep()).
  for (const festivalName of ['Woodstock', 'Tomorrowland', 'Rock am Ring', 'Hurricane']) nouns.add(festivalName)
  // Save names the player typed in the save-archive sample below; user content stays verbatim.
  nouns.add('Server')
  nouns.add('Shared')
  nouns.delete('Meine Traumbühne')
  return nouns
}

/** Runs a producer in German and in English; the English run sees the catalog and is recorded. */
function inBothLanguages<T>(produce: () => T): { de: T; en: T; lookups: Lookups } {
  setLocale('de')
  const de = produce()
  const lookups = newLookups()
  setLocale('en', EN)
  try {
    return { de, en: recording(lookups, produce), lookups }
  } finally {
    setLocale('de')
  }
}

/**
 * Client text in both languages. A text counts as translated when the English run found
 * it as a whole, or when it differs from the German beyond number formatting; every key
 * the English run missed counts on its own.
 */
function pairTexts(de: readonly string[], en: readonly string[], lookups: Lookups, out: Collected[]): void {
  assert.equal(de.length, en.length, 'both languages produce the same number of texts')
  de.forEach((text, index) => {
    const english = en[index]!
    if (!lookups.hits.has(english)) out.push({ kind: 'client', text, english })
  })
  out.push(...lookups.misses)
}

const magazineTexts = (magazine: HeadlineMagazine | null): string[] => magazine
  ? [magazine.issueLine, magazine.dateLine, magazine.verdictLine, magazine.lede, magazine.pullQuote, magazine.heroCaption, magazine.coverStamp,
      ...[...magazine.pros, ...magazine.cons].flatMap((blurb) => [blurb.headline, blurb.body])]
  : []

function finishedWeekends(fixture: (count?: number) => GameState): GameSnapshot[] {
  const game = fixture(8)
  game.addDebugMoney()
  const s = game.snapshot as GameSnapshot
  s.dayPlan.leadDays = 1
  s.dayPlan.festivalDays = 2
  game.manageFestival({ type: 'ground', x: 6, z: -20, kind: 'drain' })
  game.manageFestival({ type: 'ground', x: 6, z: -20, kind: 'compact' })
  game.place('stage', 6, -20)
  game.manageFestival({ type: 'start' })
  s.day = s.festival.startDay + s.dayPlan.leadDays + s.dayPlan.festivalDays
  s.minute = 1
  s.festival.lastUpdate = festivalTime(s) - 2
  updateFestival(s)
  const flop = structuredClone(s)
  flop.festival.admissions = 8
  flop.festival.reports = flop.festival.reports.map((report) => ({ ...report, satisfaction: 28, stockouts: 20, weatherImpact: 200, balance: -400 }))
  flop.festival.reputation = { music: 20, atmosphere: 22, comfort: 18, organization: 16 }
  const cult = structuredClone(s)
  cult.festival.admissions = 220
  cult.festival.reputation = { music: 82, atmosphere: 80, comfort: 76, organization: 78 }
  cult.festival.reports = [{ day: cult.festival.startDay + 1, balance: 900, guests: 220, satisfaction: 90, concerts: 1200, stockouts: 0, weatherImpact: 8, reputation: { ...cult.festival.reputation } }]
  return [s, flop, cult]
}

type SweepContext = {
  s: GameSnapshot
  free: { x: number; z: number }
  path: { x: number; z: number; elevation: number }
  road: { x: number; z: number }
  staffId: string
  coasterId: string
  courseId: string
  attractionId: string
  foodId: string
  depotId: string
  wasteDepotId: string
  specialDepotId: string
}
type Sweep = (context: SweepContext) => readonly object[]
const MISSING = 'i18n-missing'
const FAR = 9999

/**
 * One valid and one invalid payload per GameCommand kind (the Record makes a missing
 * kind a type error). Commands that take things away run last, in this order.
 */
const SWEEP: Record<GameCommandAction['type'], Sweep> = {
  startAttraction: ({ free }) => [{ definitionId: 'swimArea', x: free.x, z: free.z, rotation: 0 }, { definitionId: MISSING, x: FAR, z: FAR, rotation: 0 }],
  constructAttraction: ({ attractionId }) => [{ request: { kind: 'selectOpenNode', attractionId, nodeId: MISSING } }, { request: { kind: 'removeTrackEdge', attractionId: MISSING, edgeId: MISSING } }],
  setAttractionOperation: ({ attractionId }) => [{ attractionId, mode: 'test' }, { attractionId: MISSING, mode: 'open' }],
  setAttractionPrice: ({ attractionId }) => [{ attractionId, price: 6 }, { attractionId: MISSING, price: -5 }],
  configureAttraction: ({ attractionId }) => [{ attractionId, teamSize: 2, dispatchMode: 'timed', dispatchIntervalMinutes: 5 }, { attractionId: MISSING }],
  setRideAccess: ({ foodId, free }) => [{ buildingId: foodId, accessType: 'entrance', x: free.x, z: free.z }, { buildingId: MISSING, accessType: 'exit', x: FAR, z: FAR }],
  placeBungee: ({ free }) => [{ x: free.x, z: free.z, height: 30 }, { x: FAR, z: FAR, height: 900 }],
  placeRide: ({ free }) => [{ rideType: 'chainSwing', x: free.x, z: free.z }, { rideType: 'chainSwing', x: FAR, z: FAR }],
  setBungeeHeight: () => [{ id: MISSING, height: 40 }, { id: MISSING, height: 1 }],
  festival: ({ depotId, s }) => [
    { action: { type: 'prepare' } }, { action: { type: 'shelter' } }, { action: { type: 'sponsor', id: MISSING } },
    { action: { type: 'order', kind: 'food', quantity: 20, delay: 0 } }, { action: { type: 'order', kind: 'food', quantity: 999999, delay: 0, depotId: MISSING } },
    { action: { type: 'upgrade', kind: 'drainage' } }, { action: { type: 'upgradeStep', kind: 'staffSpeed' } },
    { action: { type: 'tickets', day: 10, camping: 5 } }, { action: { type: 'autoLineup', duration: 90 } },
    { action: { type: 'book', bandId: BANDS[0]!.id, stageId: MISSING, day: s.day, start: 600, duration: 60 } },
    { action: { type: 'cancel', id: MISSING } }, { action: { type: 'stageTemplate', name: null } },
    { action: { type: 'minimum', depotId, kind: 'food', quantity: 40 } }, { action: { type: 'removeRoute', id: MISSING } },
    { action: { type: 'depotSettings', depotId: MISSING, distribution: 'shops', workers: 2 } },
    { action: { type: 'wayArea', from: { x: FAR, z: FAR }, to: { x: FAR, z: FAR }, kind: 'footPaved' } },
    { action: { type: 'start' } },
  ],
  loan: () => [{ action: { type: 'borrow', amount: 5000 } }, { action: { type: 'repay', amount: 99999999 } }],
  place: ({ free }) => [{ kind: 'bench', x: free.x, z: free.z }, { kind: 'stage', x: FAR, z: FAR }],
  stampBlueprint: ({ free }) => [{ originX: free.x, originZ: free.z, rotation: 0, items: [{ kind: 'bench', dx: 0, dz: 0 }] }, { originX: FAR, originZ: FAR, rotation: 0, items: [] }],
  placePath: ({ free }) => [{ x: free.x, z: free.z, elevation: 0, pathType: 'normal', queueDirection: 0, slope: 0 }, { x: FAR, z: FAR, elevation: 0, pathType: 'queue', queueDirection: 0, slope: 0 }],
  placeRoad: ({ free }) => [{ x: free.x + 1, z: free.z, elevation: 0, slope: 0, slopeDirection: 0 }, { x: FAR, z: FAR, elevation: 0, slope: 0, slopeDirection: 0 }],
  undoRoad: ({ free }) => [{ x: free.x + 1, z: free.z }, { x: FAR, z: FAR }],
  undoPath: ({ free }) => [{ x: free.x, z: free.z, elevation: 0 }, { x: FAR, z: FAR, elevation: 0 }],
  bulldozeArea: ({ free }) => [{ cells: [{ x: free.x, z: free.z }] }, { cells: [{ x: FAR, z: FAR }] }],
  editTerrain: ({ free }) => [{ x: free.x, z: free.z, mode: 'raise' }, { x: FAR, z: FAR, mode: 'lower' }],
  editTerrainArea: ({ free }) => [{ cells: [{ x: free.x, z: free.z }], mode: 'flatten', originHeight: 0 }, { cells: [{ x: FAR, z: FAR }], mode: 'flatten' }],
  paintGroundCover: ({ free }) => [{ x: free.x, z: free.z, cover: 'sand' }, { x: FAR, z: FAR, cover: 'sand' }],
  paintGroundCoverArea: ({ free }) => [{ cells: [{ x: free.x, z: free.z }], cover: 'grass' }, { cells: [{ x: FAR, z: FAR }], cover: 'grass' }],
  designateRoad: ({ free }) => [{ cells: [{ x: free.x, z: free.z + 1 }] }, { cells: [{ x: FAR, z: FAR }] }],
  designateParking: ({ free }) => [{ cells: [{ x: free.x, z: free.z + 2 }] }, { cells: [{ x: FAR, z: FAR }] }],
  designateCampingCell: ({ free }) => [{ x: free.x, z: free.z, enabled: true }, { x: FAR, z: FAR, enabled: true }],
  designateCampingArea: ({ free }) => [{ cells: [{ x: free.x, z: free.z }] }, { cells: [{ x: FAR, z: FAR }] }],
  designateMedicalArea: ({ free }) => [{ cells: [{ x: free.x, z: free.z }] }, { cells: [{ x: FAR, z: FAR }] }],
  designateWasteDump: ({ free }) => [{ cells: [{ x: free.x, z: free.z }] }, { cells: [{ x: FAR, z: FAR }] }],
  designateStageForecourt: ({ free }) => [{ cells: [{ x: free.x, z: free.z }] }, { cells: [{ x: FAR, z: FAR }] }],
  designateBackstageArea: ({ free }) => [{ cells: [{ x: free.x, z: free.z }], enabled: true }, { cells: [{ x: FAR, z: FAR }], enabled: false }],
  designatePowerCable: ({ free }) => [{ x: free.x, z: free.z, enabled: true }, { x: FAR, z: FAR, enabled: true }],
  designatePowerCableArea: ({ free }) => [{ cells: [{ x: free.x, z: free.z }] }, { cells: [{ x: FAR, z: FAR }] }],
  setRoadDirection: ({ road }) => [{ x: road.x, z: road.z, direction: 1 }, { x: FAR, z: FAR, direction: 0 }],
  clearRoadDirection: ({ road }) => [{ x: road.x, z: road.z }, { x: FAR, z: FAR }],
  placeTrafficLight: ({ road }) => [{ x: road.x, z: road.z, direction: 0 }, { x: FAR, z: FAR, direction: 0 }],
  placePathBarrier: ({ path }) => [{ x: path.x, z: path.z, elevation: path.elevation, direction: 0 }, { x: FAR, z: FAR, elevation: 0, direction: 0 }],
  configureAccessControl: () => [{ id: MISSING, mode: 'always' }, { id: MISSING, mode: 'locked', sensorThreshold: -1 }],
  toggleAccessControlArea: () => [{ id: MISSING, from: { x: 0, z: 0 }, to: { x: 1, z: 1 } }, { id: MISSING, from: { x: FAR, z: FAR }, to: { x: FAR, z: FAR } }],
  clearAccessControlArea: () => [{ id: MISSING }, { id: '' }],
  toggleRoadSeparator: ({ road }) => [{ x: road.x, z: road.z, direction: 0 }, { x: FAR, z: FAR, direction: 0 }],
  toggleCrosswalk: ({ road }) => [{ x: road.x, z: road.z }, { x: FAR, z: FAR }],
  setRoadSpeed: ({ road }) => [{ x: road.x, z: road.z, speedLimit: 30 }, { x: FAR, z: FAR, speedLimit: 10 }],
  setPathFlow: ({ path }) => [{ x: path.x, z: path.z, elevation: path.elevation, direction: 1 }, { x: FAR, z: FAR, elevation: 0, direction: null }],
  setParkOpen: () => [{ open: true }, { open: false }],
  undoLastBuild: () => [{}, {}],
  setSpeed: () => [{ speed: 1 }, { speed: 99 }],
  hireStaff: () => [{ role: 'cleaner' }, { role: 'juggler' }],
  toggleStaffZone: ({ staffId }) => [{ staffId, key: '0,0' }, { staffId: MISSING, key: '0,0' }],
  setStaffZone: ({ staffId }) => [{ staffId, key: '0,0', active: false }, { staffId: MISSING, key: '0,0', active: true }],
  buyAmbulance: () => [{ garageId: MISSING }, { garageId: '' }],
  buyFireTruck: () => [{ stationId: MISSING }, { stationId: '' }],
  startCourse: ({ free }) => [{ kind: 'mudmasters', x: free.x, z: free.z }, { kind: 'pool', x: FAR, z: FAR }],
  startCourseArea: ({ free }) => [{ kind: 'pool', cells: [{ x: free.x, z: free.z }] }, { kind: 'pool', cells: [] }],
  addCourseAreaCell: ({ courseId, free }) => [{ courseId, x: free.x, z: free.z }, { courseId: MISSING, x: FAR, z: FAR }],
  addCourseAreaCells: ({ courseId, free }) => [{ courseId, cells: [{ x: free.x, z: free.z }] }, { courseId: MISSING, cells: [] }],
  removeCourseAreaCells: ({ courseId, free }) => [{ courseId, cells: [{ x: free.x, z: free.z }] }, { courseId: MISSING, cells: [] }],
  addCoursePiece: ({ courseId, free }) => [{ courseId, kind: 'path', x: free.x, z: free.z }, { courseId: MISSING, kind: 'path', x: FAR, z: FAR }],
  undoCoursePiece: ({ courseId }) => [{ courseId }, { courseId: MISSING }],
  setCourseOperating: ({ courseId }) => [{ courseId, operating: true }, { courseId: MISSING, operating: true }],
  setCoursePrice: ({ courseId }) => [{ courseId, price: 8 }, { courseId: MISSING, price: -1 }],
  setCourseTeamSize: ({ courseId }) => [{ courseId, teamSize: 2 }, { courseId: MISSING, teamSize: 99 }],
  sellAmbulance: () => [{ garageId: MISSING }, { garageId: '' }],
  sellAmbulanceVehicle: () => [{ vehicleId: MISSING }, { vehicleId: '' }],
  buyBus: () => [{ depotId: MISSING }, { depotId: '' }],
  sellBus: () => [{ depotId: MISSING }, { depotId: '' }],
  buyGarbageTruck: ({ wasteDepotId }) => [{ depotId: wasteDepotId }, { depotId: MISSING }],
  sellGarbageTruck: ({ wasteDepotId }) => [{ depotId: wasteDepotId }, { depotId: MISSING }],
  buySweeper: ({ specialDepotId }) => [{ depotId: specialDepotId }, { depotId: MISSING }],
  sellSweeper: ({ specialDepotId }) => [{ depotId: specialDepotId }, { depotId: MISSING }],
  createBusLine: () => [{ name: 'Festival-Shuttle', depotId: MISSING, stopIds: [], busCount: 1, headway: 20 }, { name: '', depotId: '', stopIds: [MISSING], busCount: 0, headway: 0 }],
  addBusToLine: () => [{ lineId: MISSING }, { lineId: '' }],
  setBusLineStops: () => [{ lineId: MISSING, stopIds: [] }, { lineId: '', stopIds: [MISSING] }],
  deleteBusLine: () => [{ lineId: MISSING }, { lineId: '' }],
  startCoaster: ({ free }) => [{ typeId: 'classicSteel', x: free.x, z: free.z }, { typeId: 'classicSteel', x: FAR, z: FAR }],
  appendCoasterPiece: ({ coasterId }) => [{ coasterId, kind: 'straight', chainLift: false, options: {} }, { coasterId: MISSING, kind: 'straight', chainLift: false, options: {} }],
  undoCoasterPiece: () => [{ coasterId: MISSING }, { coasterId: '' }],
  deleteCoasterPiece: ({ coasterId }) => [{ coasterId, pieceIndex: 9999 }, { coasterId: MISSING, pieceIndex: 0 }],
  setCoasterAccess: ({ coasterId, free }) => [{ coasterId, accessType: 'entrance', x: free.x, z: free.z }, { coasterId: MISSING, accessType: 'exit', x: FAR, z: FAR }],
  updateCoasterSettings: ({ coasterId }) => [{ coasterId, dispatchMode: 'timed', intervalMinutes: 5 }, { coasterId: MISSING, dispatchMode: 'timed', intervalMinutes: -1 }],
  updateCoasterPrice: ({ coasterId }) => [{ coasterId, price: 7 }, { coasterId: MISSING, price: 7 }],
  setCoasterOperationMode: ({ coasterId }) => [{ coasterId, mode: 'test' }, { coasterId: MISSING, mode: 'open' }],
  recallCoasterTrain: ({ coasterId }) => [{ coasterId }, { coasterId: MISSING }],
  updateBuildingPrice: ({ foodId }) => [{ buildingId: foodId, price: 4, allOfKind: true }, { buildingId: MISSING, price: 4 }],
  configureShirtStall: ({ foodId }) => [{ buildingId: foodId, style: 'tank' }, { buildingId: MISSING, color: 0xff0000 }],
  updateEntryPrice: () => [{ price: 30 }, { price: -30 }],
  updateCampingTicketPrice: () => [{ price: 20 }, { price: -20 }],
  updateDemandTuning: ({ s }) => [{ tuning: s.festival.demandTuning }, { tuning: {} }],
  updateSecurityGate: () => [{ id: MISSING, config: {} }, { id: '', config: {} }],
  setDayPlanHour: () => [{ offer: 'food', hour: 12, active: true }, { offer: 'food', hour: 99, active: true }],
  updateDayVisitorWindow: () => [{ entryHour: 9, exitHour: 22 }, { entryHour: 22, exitHour: 9 }],
  updateCampingCapacityBuffer: () => [{ percent: 10 }, { percent: -10 }],
  updateFestivalCycle: () => [{ leadDays: 1, festivalDays: 2, breakDays: 1 }, { leadDays: -1, festivalDays: 0, breakDays: 0 }],
  addDebugMoney: () => [{}, {}],
  clearWasteForDebug: () => [{}, {}],
  placeSceneryLine: ({ free }) => [{ kind: 'planter', cells: [{ x: free.x, z: free.z }], slot: 0 }, { kind: 'planter', cells: [{ x: FAR, z: FAR }], slot: 9 }],
  removeVisitorCars: () => [{}, {}],
  // Destructive ones last.
  bulldoze: ({ free }) => [{ x: free.x, z: free.z }, { x: FAR, z: FAR, buildingId: MISSING }],
  fireStaff: () => [{ role: 'security' }, { role: 'juggler' }],
  fireStaffMember: ({ staffId }) => [{ staffId }, { staffId: MISSING }],
  removeAttraction: ({ attractionId }) => [{ attractionId: MISSING }, { attractionId }],
  removeCourse: ({ courseId }) => [{ courseId: MISSING }, { courseId }],
  removeCoaster: ({ coasterId }) => [{ coasterId: MISSING }, { coasterId }],
}

function sweepContext(game: GameState): SweepContext {
  const s = game.snapshot as GameSnapshot
  const occupied = new Set(s.buildings.map((building) => `${building.x},${building.z}`))
  for (const cell of s.logistics.roadCells) occupied.add(`${cell.x},${cell.z}`)
  let free = { x: 0, z: 0 }
  search: for (let radius = 0; radius < 24; radius++) {
    for (let x = -radius; x <= radius; x++) {
      for (const z of [-radius, radius]) {
        if (!occupied.has(`${x},${z}`) && !occupied.has(`${x + 1},${z}`) && !occupied.has(`${x},${z + 1}`) && !occupied.has(`${x},${z + 2}`)) {
          free = { x, z }
          break search
        }
      }
    }
  }
  const path = s.buildings.find((building) => building.kind === 'path')!
  const road = s.logistics.roadCells[0]!
  return {
    s,
    free,
    path: { x: path.x, z: path.z, elevation: path.elevation ?? 0 },
    road: { x: road.x, z: road.z },
    staffId: s.staff[0]!.id,
    coasterId: s.coasters[0]!.id,
    courseId: s.courses[0]!.id,
    attractionId: s.attractions[0]!.id,
    foodId: s.buildings.find((building) => building.kind === 'food')!.id,
    depotId: s.festival.infrastructure.depots[0]!.id,
    wasteDepotId: s.logistics.wasteDepots[0]!.id,
    specialDepotId: s.logistics.specialDepots[0]!.id,
  }
}

function sweepCommands(game: GameState, out: Collected[]): number {
  const context = sweepContext(game)
  let applied = 0
  for (const [type, payloads] of Object.entries(SWEEP) as [GameCommandAction['type'], Sweep][]) {
    for (const payload of payloads(context)) {
      try {
        const result = applyGameCommand(game, { type, ...payload } as GameCommand)
        applied++
        if (result?.message) out.push({ kind: 'game', text: result.message })
      } catch {
        // An invalid payload may throw before it produces a message; that is not text.
      }
    }
  }
  return applied
}

/** Text segments of markup, without tags and entities. */
function markupSegments(html: string): string[] {
  return html.replace(/<[^>]*>/g, '\n').replace(/&[#\w]+;/g, ' ').split('\n').map((part) => part.trim()).filter((part) => letterCount(part) >= 2)
}

function collectMarkup(game: GameState, out: Collected[]): void {
  const s = game.snapshot as GameSnapshot
  const { en, lookups } = inBothLanguages(() => {
    const html: string[] = []
    for (const category of BUILD_CATEGORIES) {
      for (const group of category.groups) for (const item of group.items) html.push(catalogTileHtml(item, true, s, formatMoney), catalogTileHtml(item, false, s, formatMoney))
    }
    const archive = composeSaveArchive([{ id: 'local', name: 'Schnellspeichern', savedAt: 20, public: false, owner: '', source: 'browser' }], {
      account: 'Marvin',
      own: [{ id: 'server', name: 'Server', savedAt: 30, public: false, owner: 'Marvin' }],
      shared: [{ id: 'shared', name: 'Shared', savedAt: 10, public: true, owner: 'Gast' }],
    })
    html.push(saveArchiveHtml(archive, String))
    for (const tool of ['camping', 'path', 'stage', 'food', 'bulldoze', 'inspect'] as const) {
      game.setTool(tool)
      html.push(contextHelpText({
        game,
        hoveredCell: { x: 0, z: 0 },
        placementPreview: null,
        modes: {
          coaster: { active: false, coasterId: null, startCandidate: null, accessMode: null },
          course: { active: false },
          path: { open: false, constructing: false, demolishing: false, road: false, anchor: null, constructionType: 'normal' },
          rideAccess: null,
          backstageEraseMode: false,
          copyClipboard: null,
        },
      } as Parameters<typeof contextHelpText>[0]))
    }
    for (const preset of SCENARIO_PRESETS) html.push(briefingMarkup(preset))
    return html
  })
  for (const html of en) for (const segment of markupSegments(html)) out.push({ kind: 'markup', text: segment })
  out.push(...lookups.misses)
}

/** The judge itself: locale-aware money and percent must not pass an untranslated template off as English. */
function checkJudge(): void {
  // The probe key must stay out of every catalog area ("{0} Guthaben" is a real goal name).
  const probe = inBothLanguages(() => [t`${formatMoney(50000)} Probeguthaben`, `${formatPercent(80)} Zufriedenheit`])
  assert.deepEqual(probe.en, ['€50,000 Probeguthaben', '80% Zufriedenheit'], 'the probe formats in English')
  const judged: Collected[] = []
  pairTexts(probe.de, probe.en, probe.lookups, judged)
  assert.ok(judged.some((entry) => entry.kind === 'key' && entry.text === '{0} Probeguthaben'), 'a t template the catalog lacks is a miss')
  const bare = judged.find((entry) => entry.kind === 'client' && entry.text === '80 % Zufriedenheit')
  assert.ok(bare && numberShape(bare.english!) === numberShape(bare.text), 'number formatting alone is no translation')
}

export function testI18nCoverage(fixture: (count?: number) => GameState): void {
  setLocale('de')
  checkJudge()
  const collected: Collected[] = []
  const game = loadFixture()
  const s = game.snapshot as GameSnapshot
  const nouns = properNouns(s)

  // Stored text and ticker items while the festival runs; the ticker runs in both languages.
  // Two watch states see the same snapshots, so both languages report the same items.
  const watches: Record<'de' | 'en', TickerWatchState> = { de: createTickerWatchState(), en: createTickerWatchState() }
  const ticker = { de: [] as string[], en: [] as string[] }
  const tickerLookups = newLookups()
  for (let tick = 0; tick < 120; tick++) {
    game.tick(0.1)
    for (const locale of ['de', 'en'] as const) {
      setLocale(locale, EN)
      const observe = (): void => { for (const item of observeTickerEvents(game.snapshot, watches[locale])) ticker[locale].push(item.title, item.message) }
      if (locale === 'en') recording(tickerLookups, observe)
      else observe()
    }
    setLocale('de')
  }
  pairTexts(ticker.de, ticker.en, tickerLookups, collected)
  collectStoredText(game.snapshot, collected)
  collectNames(s, collected)

  // Every GameCommand kind, valid and invalid.
  assert.ok(sweepCommands(game, collected) >= Object.keys(SWEEP).length, 'the sweep reaches every command kind')
  collectStoredText(game.snapshot, collected)

  // Client-side display text: magazine verdicts, build menu, goals.
  const weekends = finishedWeekends(fixture)
  const magazines = inBothLanguages(() => weekends.flatMap((weekend) => magazineTexts(buildHeadlineMagazine(weekend))))
  pairTexts(magazines.de, magazines.en, magazines.lookups, collected)
  const goals: ScenarioGoal[] = [
    ...SCENARIO_PRESETS.flatMap((preset) => preset.settings.goals),
    { kind: 'guests', target: 1500, edition: 2 },
    { kind: 'money', target: 50000, edition: 2 },
    { kind: 'parkValue', target: 250000, edition: 3 },
    { kind: 'loanFree', edition: 2 },
    { kind: 'admissions', target: 1200, edition: 3, streak: 2 },
    { kind: 'satisfaction', target: 80, edition: 2 },
    { kind: 'reputation', target: 70, edition: 2 },
    { kind: 'profit', target: 10000, edition: 2 },
  ]
  const goalTexts = inBothLanguages(() => goals.flatMap((goal) => [goalName(goal), goalProgressText(goal, s)]))
  pairTexts(goalTexts.de, goalTexts.en, goalTexts.lookups, collected)
  const menu = inBothLanguages(() => BUILD_CATEGORIES.flatMap((category) => [category.label, ...category.groups.flatMap((group) => [group.label, ...group.items.flatMap((item) => [item.name, item.detail])])]))
  pairTexts(menu.de, menu.en, menu.lookups, collected)
  collectMarkup(game, collected)

  // Misses, judged in English.
  const misses = new Set<string>()
  setLocale('en', EN)
  try {
    for (const { kind, text, english } of collected) {
      const trimmed = text.trim()
      if (letterCount(trimmed) < 2 || nouns.has(trimmed)) continue
      const missed = kind === 'game'
        ? localizeHit(trimmed) === undefined
        : kind === 'name'
          ? localizeName(trimmed) === trimmed && localizeHit(trimmed) === undefined
          : kind === 'client'
            ? numberShape(english!) === numberShape(text) && localizeHit(trimmed) === undefined
            : kind === 'key'
              ? true
              : GERMAN_MARKERS.test(trimmed) && ![...nouns].some((noun) => trimmed === noun)
      if (missed) misses.add(trimmed)
    }
  } finally {
    setLocale('de')
  }
  const list = [...misses].sort()
  // I18N_COVERAGE_DUMP=1 npm test lists every miss (PowerShell: $env:I18N_COVERAGE_DUMP='1').
  if (process.env.I18N_COVERAGE_DUMP) console.log(`i18n coverage misses:\n${list.join('\n')}`)
  assert.ok(list.length <= MISS_BUDGET, `English coverage: ${list.length} untranslated texts, budget ${MISS_BUDGET}. Translate these (docs/i18n.md):\n${list.slice(0, 200).join('\n')}`)
  if (list.length < MISS_BUDGET) console.log(`i18n coverage: ${list.length} misses, below the budget of ${MISS_BUDGET} — lower MISS_BUDGET in tests/i18nCoverage.ts`)
  console.log(`PASS English coverage: ${list.length} of ${new Set(collected.map((entry) => entry.text)).size} collected texts still German (budget ${MISS_BUDGET})`)
}
