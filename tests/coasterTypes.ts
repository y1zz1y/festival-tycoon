import assert from 'node:assert/strict'
import {
  applyConstructionBank,
  applyConstructionKind,
  applyConstructionPitch,
  canAppendTrackPiece,
  canConnectDiscretePiece,
  classifyTrackBank,
  classifyTrackPitch,
  constantPitchPieceKind,
  describeDiscreteConnectionIssue,
  describeTrackAppendIssue,
  discretePieceEnds,
  flatUnbankedConnection,
  isLegalPitchBankPair,
  isTrackBankChoiceCurrentlyEnabled,
  isTrackBankChoiceEnabled,
  isTrackChainLiftEligible,
  isTrackChainLiftVisible,
  isTrackPalettePieceEnabled,
  isTrackPitchChoiceCurrentlyEnabled,
  isTrackPitchChoiceEnabled,
  listTrackBankChoices,
  listTrackPalettePieces,
  listTrackPitchChoices,
  listVisibleTrackBankChoices,
  listVisibleTrackPalettePieces,
  listVisibleTrackPitchChoices,
  resolveNextTrackPiece,
  TRACK_DIRECTION_KINDS,
  TRACK_SPECIAL_KINDS,
  typeAllowsChainLift,
  typeAllowsSteep,
  typeAllowsSteepBank,
  type CoasterWindowState,
  type TrackConnectionState,
} from '../src/game/coasterConnections'
import {
  COASTER_CATALOG,
  COASTER_CATALOG_TYPE_IDS,
  FLOORLESS_IS_TWISTER_VEHICLE,
  HEADLINER_SPECIAL_KINDS,
  NON_COASTER_TRACK_RIDES,
  PLAYABLE_COASTER_TYPE_IDS,
  catalogAllowsTrackPiece,
  coasterVehiclePreview,
  listPlayableCoasterCatalogTypes,
  resolveSupportedTrackPieces,
  type CoasterCatalogTypeId,
  type CoasterInversionAvailability,
  type CoasterSlopeAvailability,
} from '../src/game/coasterTypes'
import {
  COASTER_TYPES,
  TRACK_BANK_ANGLE,
  TRACK_PIECE_KINDS,
  TRACK_PITCHES,
  getCoasterType,
  resolveCoasterTypeId,
  type TrackPieceKind,
} from '../src/game/coasters'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import { GameState } from '../src/game/GameState'

type ExpectedTypeFacts = {
  id: CoasterCatalogTypeId
  playable: boolean
  gentle: boolean
  steep: boolean
  vertical: CoasterSlopeAvailability
  banking: boolean
  slopeCurveBanked: boolean
  inversions: CoasterInversionAvailability
  flatToSteep: boolean
  oneTileTurns: boolean
  chainLift: CoasterSlopeAvailability
  cableLift: boolean
  noLiftHill: boolean
  poweredLaunch: boolean
  reverseInclineShuttle: boolean
  blockSectioned: boolean
  mustAllow: TrackPieceKind[]
  mustForbid: TrackPieceKind[]
  uniqueIncludes: string[]
}

const EXPECTED_TYPE_FACTS: ExpectedTypeFacts[] = [
  {
    id: 'classicSteel',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'none',
    banking: true,
    slopeCurveBanked: true,
    inversions: 'default',
    flatToSteep: true,
    oneTileTurns: true,
    chainLift: 'vanilla',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: false,
    reverseInclineShuttle: false,
    blockSectioned: false,
    mustAllow: TRACK_PIECE_KINDS.filter((kind) => kind !== 'helixLeft' && kind !== 'helixRight'),
    mustForbid: ['helixLeft', 'helixRight'],
    uniqueIncludes: ['verticalLoop', 'halfLoop', 'splash', 'brakes'],
  },
  {
    id: 'wooden',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'none',
    banking: true,
    slopeCurveBanked: true,
    inversions: 'default',
    flatToSteep: true,
    oneTileTurns: false,
    chainLift: 'vanilla',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: false,
    reverseInclineShuttle: true,
    blockSectioned: false,
    mustAllow: ['verticalLoop', 'splash', 'brakes', 'slopeUp'],
    mustForbid: ['halfLoopUp', 'halfLoopDown', 'curveLeft1', 'curveRight1'],
    uniqueIncludes: ['waterSplash', 'reverseInclineShuttle'],
  },
  {
    id: 'looping',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'extra',
    banking: true,
    slopeCurveBanked: true,
    inversions: 'default',
    flatToSteep: true,
    oneTileTurns: true,
    chainLift: 'vanilla',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: true,
    reverseInclineShuttle: false,
    blockSectioned: false,
    mustAllow: ['verticalLoop', 'brakes'],
    mustForbid: ['splash'],
    uniqueIncludes: ['verticalLoop', 'poweredLaunch'],
  },
  {
    id: 'corkscrew',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'none',
    banking: true,
    slopeCurveBanked: true,
    inversions: 'default',
    flatToSteep: true,
    oneTileTurns: true,
    chainLift: 'vanilla',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: false,
    reverseInclineShuttle: false,
    blockSectioned: false,
    mustAllow: ['verticalLoop', 'halfLoopUp', 'halfLoopDown'],
    mustForbid: ['splash'],
    uniqueIncludes: ['corkscrew', 'halfLoop'],
  },
  {
    id: 'hyper',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'none',
    banking: true,
    slopeCurveBanked: true,
    inversions: 'none',
    flatToSteep: true,
    oneTileTurns: false,
    chainLift: 'vanilla',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: false,
    reverseInclineShuttle: false,
    blockSectioned: false,
    mustAllow: ['brakes', 'straight'],
    mustForbid: ['verticalLoop', 'halfLoopUp', 'halfLoopDown', 'splash'],
    uniqueIncludes: ['corkscrewWithoutInversions'],
  },
  {
    id: 'twister',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'vanilla',
    banking: true,
    slopeCurveBanked: true,
    inversions: 'default',
    flatToSteep: true,
    oneTileTurns: false,
    chainLift: 'vanilla',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: false,
    reverseInclineShuttle: false,
    blockSectioned: true,
    mustAllow: ['verticalLoop', 'halfLoopUp', 'brakes', 'helixLeft', 'helixRight'],
    mustForbid: ['splash'],
    uniqueIncludes: ['fullModernInversions', 'blockSectioned'],
  },
  {
    id: 'hyperTwister',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'vanilla',
    banking: true,
    slopeCurveBanked: true,
    inversions: 'none',
    flatToSteep: true,
    oneTileTurns: false,
    chainLift: 'vanilla',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: false,
    reverseInclineShuttle: false,
    blockSectioned: true,
    mustAllow: ['brakes', 'helixLeft'],
    mustForbid: ['verticalLoop', 'halfLoopUp', 'halfLoopDown', 'splash'],
    uniqueIncludes: ['vertical90', 'blockSectioned'],
  },
  {
    id: 'verticalDrop',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'vanilla',
    banking: true,
    slopeCurveBanked: true,
    inversions: 'none',
    flatToSteep: true,
    oneTileTurns: false,
    chainLift: 'vanilla',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: false,
    reverseInclineShuttle: false,
    blockSectioned: false,
    mustAllow: ['slopeUp', 'brakes'],
    mustForbid: ['verticalLoop', 'halfLoopUp', 'splash'],
    uniqueIncludes: ['brakeForDrop', 'steepChain'],
  },
  {
    id: 'giga',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'none',
    banking: true,
    slopeCurveBanked: true,
    inversions: 'extra',
    flatToSteep: true,
    oneTileTurns: false,
    chainLift: 'none',
    cableLift: true,
    noLiftHill: false,
    poweredLaunch: false,
    reverseInclineShuttle: false,
    blockSectioned: false,
    mustAllow: ['brakes', 'straight'],
    mustForbid: ['verticalLoop', 'halfLoopUp', 'splash'],
    uniqueIncludes: ['cableLift'],
  },
  {
    id: 'lsmLaunched',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'none',
    banking: true,
    slopeCurveBanked: true,
    inversions: 'default',
    flatToSteep: true,
    oneTileTurns: false,
    chainLift: 'extra',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: true,
    reverseInclineShuttle: false,
    blockSectioned: false,
    mustAllow: ['verticalLoop', 'halfLoopUp'],
    mustForbid: ['splash'],
    uniqueIncludes: ['booster', 'poweredLaunch'],
  },
  {
    id: 'limLaunched',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'none',
    banking: true,
    slopeCurveBanked: true,
    inversions: 'default',
    flatToSteep: true,
    oneTileTurns: false,
    chainLift: 'none',
    cableLift: false,
    noLiftHill: true,
    poweredLaunch: true,
    reverseInclineShuttle: false,
    blockSectioned: false,
    mustAllow: ['verticalLoop'],
    mustForbid: ['splash'],
    uniqueIncludes: ['noLiftHill', 'poweredLaunch'],
  },
  {
    id: 'inverted',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'none',
    banking: true,
    slopeCurveBanked: true,
    inversions: 'default',
    flatToSteep: true,
    oneTileTurns: false,
    chainLift: 'vanilla',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: false,
    reverseInclineShuttle: false,
    blockSectioned: false,
    mustAllow: ['verticalLoop', 'halfLoopUp', 'helixLeft'],
    mustForbid: ['splash'],
    uniqueIncludes: ['suspended', 'quarterHelix'],
  },
  {
    id: 'compactInverted',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'none',
    banking: true,
    slopeCurveBanked: true,
    inversions: 'default',
    flatToSteep: true,
    oneTileTurns: true,
    chainLift: 'vanilla',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: false,
    reverseInclineShuttle: true,
    blockSectioned: false,
    mustAllow: ['verticalLoop', 'curveLeft1'],
    mustForbid: ['splash'],
    uniqueIncludes: ['reverseInclineShuttle', 'smallerFootprint'],
  },
  {
    id: 'flying',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'none',
    banking: true,
    slopeCurveBanked: true,
    inversions: 'default',
    flatToSteep: true,
    oneTileTurns: false,
    chainLift: 'vanilla',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: false,
    reverseInclineShuttle: false,
    blockSectioned: false,
    mustAllow: ['halfLoopUp', 'brakes'],
    mustForbid: ['splash'],
    uniqueIncludes: ['startsInverted', 'flyToLie', 'twoDrawers'],
  },
  {
    id: 'standUp',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'none',
    banking: true,
    slopeCurveBanked: true,
    inversions: 'default',
    flatToSteep: true,
    oneTileTurns: false,
    chainLift: 'vanilla',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: false,
    reverseInclineShuttle: false,
    blockSectioned: false,
    mustAllow: ['verticalLoop', 'halfLoopUp', 'halfLoopDown'],
    mustForbid: ['splash'],
    uniqueIncludes: ['corkscrew'],
  },
  {
    id: 'junior',
    playable: true,
    gentle: true,
    steep: false,
    vertical: 'none',
    banking: true,
    slopeCurveBanked: false,
    inversions: 'none',
    flatToSteep: false,
    oneTileTurns: false,
    chainLift: 'vanilla',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: false,
    reverseInclineShuttle: false,
    blockSectioned: false,
    mustAllow: ['slopeGentleUp', 'brakes', 'straight'],
    mustForbid: ['slopeUp', 'slopeDown', 'verticalLoop', 'halfLoopUp', 'splash'],
    uniqueIncludes: ['curvedLift', 'lowHeight'],
  },
  {
    id: 'steelWildMouse',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'none',
    banking: false,
    slopeCurveBanked: false,
    inversions: 'none',
    flatToSteep: true,
    oneTileTurns: true,
    chainLift: 'vanilla',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: false,
    reverseInclineShuttle: false,
    blockSectioned: false,
    mustAllow: ['curveLeft1', 'curveRight1', 'brakes'],
    mustForbid: ['bankTransition', 'verticalLoop', 'curveLeft2', 'sBendLeft', 'splash'],
    uniqueIncludes: ['oneTileTurns', 'carsNotTrains', 'noBanking'],
  },
  {
    id: 'woodenWildMouse',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'none',
    banking: false,
    slopeCurveBanked: false,
    inversions: 'none',
    flatToSteep: true,
    oneTileTurns: true,
    chainLift: 'vanilla',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: false,
    reverseInclineShuttle: false,
    blockSectioned: false,
    mustAllow: ['curveLeft1', 'straight'],
    mustForbid: ['brakes', 'bankTransition', 'verticalLoop', 'curveLeft3', 'splash'],
    uniqueIncludes: ['noBrakesGroup', 'circuitOnly'],
  },
  {
    id: 'mineTrain',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'none',
    banking: true,
    slopeCurveBanked: false,
    inversions: 'none',
    flatToSteep: true,
    oneTileTurns: false,
    chainLift: 'vanilla',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: false,
    reverseInclineShuttle: false,
    blockSectioned: false,
    mustAllow: ['bankTransition', 'brakes', 'helixLeft'],
    mustForbid: ['verticalLoop', 'halfLoopUp', 'splash'],
    uniqueIncludes: ['bankingWithoutSlopeCurveBanked'],
  },
  {
    id: 'bobsled',
    playable: true,
    gentle: true,
    steep: false,
    vertical: 'none',
    banking: true,
    slopeCurveBanked: false,
    inversions: 'none',
    flatToSteep: false,
    oneTileTurns: false,
    chainLift: 'vanilla',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: false,
    reverseInclineShuttle: false,
    blockSectioned: false,
    mustAllow: ['slopeGentleUp', 'bankTransition', 'curveLeft2'],
    mustForbid: ['slopeUp', 'verticalLoop', 'curveLeft4', 'splash'],
    uniqueIncludes: ['troughBanking', 'noLargeOrSlopedCurves'],
  },
  {
    id: 'suspendedSwinging',
    playable: true,
    gentle: true,
    steep: true,
    vertical: 'none',
    banking: false,
    slopeCurveBanked: false,
    inversions: 'none',
    flatToSteep: true,
    oneTileTurns: false,
    chainLift: 'vanilla',
    cableLift: false,
    noLiftHill: false,
    poweredLaunch: false,
    reverseInclineShuttle: false,
    blockSectioned: false,
    mustAllow: ['straight', 'brakes', 'slopeUp', 'helixLeft'],
    mustForbid: ['bankTransition', 'verticalLoop', 'splash'],
    uniqueIncludes: ['noRollBanking', 'unbankedHelix', 'swingingCars'],
  },
]

type CurrentAppendCase = {
  name: string
  pitch: number
  bank: number
  kind: TrackPieceKind
  options?: { targetPitch?: number; targetBank?: number }
  typeId?: string
  ok: boolean
}

const CURRENT_APPEND_CASES: CurrentAppendCase[] = [
  { name: 'flat station accepts a loop', pitch: 0, bank: 0, kind: 'verticalLoop', ok: true },
  { name: 'flat station accepts photo / splash / brakes / s-bend', pitch: 0, bank: 0, kind: 'photo', ok: true },
  { name: 'flat station accepts splash', pitch: 0, bank: 0, kind: 'splash', ok: true },
  { name: 'flat station accepts brakes', pitch: 0, bank: 0, kind: 'brakes', ok: true },
  { name: 'flat station accepts s-bend', pitch: 0, bank: 0, kind: 'sBendLeft', ok: true },
  { name: 'gentle slope cannot take a loop', pitch: TRACK_PITCHES.gentleUp, bank: 0, kind: 'verticalLoop', ok: false },
  { name: 'banked end cannot take a loop', pitch: 0, bank: TRACK_BANK_ANGLE, kind: 'verticalLoop', ok: false },
  { name: 'station requires flat unbanked', pitch: TRACK_PITCHES.gentleUp, bank: 0, kind: 'station', ok: false },
  { name: 'flat station can add another station', pitch: 0, bank: 0, kind: 'station', ok: true },
  {
    name: 'current Headliner allows slopeGentleUp from flat',
    pitch: 0,
    bank: 0,
    kind: 'slopeGentleUp',
    ok: true,
  },
  {
    name: 'pitch transition flat to steep is legal',
    pitch: 0,
    bank: 0,
    kind: 'pitchTransition',
    options: { targetPitch: TRACK_PITCHES.steepUp },
    ok: true,
  },
  {
    name: 'cannot jump steep up to steep down',
    pitch: TRACK_PITCHES.steepUp,
    bank: 0,
    kind: 'pitchTransition',
    options: { targetPitch: TRACK_PITCHES.steepDown },
    ok: false,
  },
  {
    name: 'cannot jump gentle down to steep up',
    pitch: TRACK_PITCHES.gentleDown,
    bank: 0,
    kind: 'pitchTransition',
    options: { targetPitch: TRACK_PITCHES.steepUp },
    ok: false,
  },
  {
    name: 'adjacent gentle to steep is legal',
    pitch: TRACK_PITCHES.gentleUp,
    bank: 0,
    kind: 'pitchTransition',
    options: { targetPitch: TRACK_PITCHES.steepUp },
    ok: true,
  },
  {
    name: 'unbanked can bank left via transition',
    pitch: 0,
    bank: 0,
    kind: 'bankTransition',
    options: { targetBank: -TRACK_BANK_ANGLE },
    ok: true,
  },
  {
    name: 'cannot jump left bank to right bank',
    pitch: 0,
    bank: -TRACK_BANK_ANGLE,
    kind: 'bankTransition',
    options: { targetBank: TRACK_BANK_ANGLE },
    ok: false,
  },
  {
    name: 'left bank returns through none',
    pitch: 0,
    bank: -TRACK_BANK_ANGLE,
    kind: 'bankTransition',
    options: { targetBank: 0 },
    ok: true,
  },
  {
    name: 'left-banked end rejects a right curve',
    pitch: 0,
    bank: -TRACK_BANK_ANGLE,
    kind: 'curveRight1',
    ok: false,
  },
  {
    name: 'left-banked end accepts a left curve',
    pitch: 0,
    bank: -TRACK_BANK_ANGLE,
    kind: 'curveLeft1',
    ok: true,
  },
  {
    name: 'inverted end rejects a loop',
    pitch: 0,
    bank: Math.PI,
    kind: 'verticalLoop',
    ok: false,
  },
  {
    name: 'inverted end accepts halfLoopDown',
    pitch: 0,
    bank: Math.PI,
    kind: 'halfLoopDown',
    ok: true,
  },
  {
    name: 'inverted end accepts straight',
    pitch: 0,
    bank: Math.PI,
    kind: 'straight',
    ok: true,
  },
  {
    name: 'unbanked end rejects halfLoopDown',
    pitch: 0,
    bank: 0,
    kind: 'halfLoopDown',
    ok: false,
  },
  {
    name: 'junior catalog forbids loops',
    pitch: 0,
    bank: 0,
    kind: 'verticalLoop',
    typeId: 'junior',
    ok: false,
  },
  {
    name: 'wooden catalog forbids half loops',
    pitch: 0,
    bank: 0,
    kind: 'halfLoopUp',
    typeId: 'wooden',
    ok: false,
  },
  {
    name: 'steel wild mouse forbids banking',
    pitch: 0,
    bank: 0,
    kind: 'bankTransition',
    options: { targetBank: TRACK_BANK_ANGLE },
    typeId: 'steelWildMouse',
    ok: false,
  },
  {
    name: 'wooden wild mouse forbids brakes',
    pitch: 0,
    bank: 0,
    kind: 'brakes',
    typeId: 'woodenWildMouse',
    ok: false,
  },
  {
    name: 'wooden cannot place corkscrew-family half loops',
    pitch: 0,
    bank: 0,
    kind: 'halfLoopUp',
    typeId: 'wooden',
    ok: false,
  },
  {
    name: 'splash is wooden / classicSteel only among playable types',
    pitch: 0,
    bank: 0,
    kind: 'splash',
    typeId: 'looping',
    ok: false,
  },
  {
    name: 'twister helix is legal from flat',
    pitch: 0,
    bank: 0,
    kind: 'helixLeft',
    typeId: 'twister',
    ok: true,
  },
  {
    name: 'classicSteel helix is illegal',
    pitch: 0,
    bank: 0,
    kind: 'helixLeft',
    ok: false,
  },
  {
    name: 'mine train rejects banked sloped curve',
    pitch: TRACK_PITCHES.gentleUp,
    bank: -TRACK_BANK_ANGLE,
    kind: 'curveLeft2',
    typeId: 'mineTrain',
    ok: false,
  },
  {
    name: 'bobsled rejects sloped curve',
    pitch: TRACK_PITCHES.gentleUp,
    bank: 0,
    kind: 'curveLeft2',
    typeId: 'bobsled',
    ok: false,
  },
]

type DiscreteCase = {
  name: string
  start: TrackConnectionState
  kind: TrackPieceKind
  options?: { targetPitch?: number; targetBank?: number }
  typeId?: CoasterCatalogTypeId
  ok: boolean
}

const DISCRETE_CASES: DiscreteCase[] = [
  {
    name: 'flat unbanked loop is legal on classicSteel',
    start: flatUnbankedConnection(),
    kind: 'verticalLoop',
    ok: true,
  },
  {
    name: 'gentle cannot join a loop',
    start: { heading: 0, pitch: 'gentleUp', bank: 'none' },
    kind: 'verticalLoop',
    ok: false,
  },
  {
    name: 'banked cannot join a loop',
    start: { heading: 0, pitch: 'flat', bank: 'left' },
    kind: 'verticalLoop',
    ok: false,
  },
  {
    name: 'constant slopeUp is illegal from flat (need transition)',
    start: flatUnbankedConnection(),
    kind: 'slopeUp',
    ok: false,
  },
  {
    name: 'constant slopeGentleUp is legal only when already gentle',
    start: { heading: 0, pitch: 'gentleUp', bank: 'none' },
    kind: 'slopeGentleUp',
    ok: true,
  },
  {
    name: 'classicSteel may skip flat to steep',
    start: flatUnbankedConnection(),
    kind: 'pitchTransition',
    options: { targetPitch: TRACK_PITCHES.steepUp },
    ok: true,
  },
  {
    name: 'junior cannot skip flat to steep',
    start: flatUnbankedConnection(),
    kind: 'pitchTransition',
    options: { targetPitch: TRACK_PITCHES.steepUp },
    typeId: 'junior',
    ok: false,
  },
  {
    name: 'junior cannot use steep constant pieces',
    start: { heading: 0, pitch: 'steepUp', bank: 'none' },
    kind: 'slopeUp',
    typeId: 'junior',
    ok: false,
  },
  {
    name: 'cannot jump left bank to right',
    start: { heading: 0, pitch: 'flat', bank: 'left' },
    kind: 'bankTransition',
    options: { targetBank: TRACK_BANK_ANGLE },
    ok: false,
  },
  {
    name: 'unbanked to left is a legal bank transition',
    start: flatUnbankedConnection(),
    kind: 'bankTransition',
    options: { targetBank: -TRACK_BANK_ANGLE },
    ok: true,
  },
  {
    name: 'hyper forbids inversion pieces',
    start: flatUnbankedConnection(),
    kind: 'verticalLoop',
    typeId: 'hyper',
    ok: false,
  },
  {
    name: 'wooden forbids 1-tile turns',
    start: flatUnbankedConnection(),
    kind: 'curveLeft1',
    typeId: 'wooden',
    ok: false,
  },
  {
    name: 'steel wild mouse allows 1-tile turns',
    start: flatUnbankedConnection(),
    kind: 'curveLeft1',
    typeId: 'steelWildMouse',
    ok: true,
  },
  {
    name: 'mine train forbids banked sloped curves',
    start: { heading: 0, pitch: 'gentleUp', bank: 'left' },
    kind: 'curveLeft2',
    typeId: 'mineTrain',
    ok: false,
  },
  {
    name: 'mine train forbids banked steep',
    start: { heading: 0, pitch: 'flat', bank: 'left' },
    kind: 'pitchTransition',
    options: { targetPitch: TRACK_PITCHES.steepUp },
    typeId: 'mineTrain',
    ok: false,
  },
  {
    name: 'classicSteel allows banked steep',
    start: { heading: 0, pitch: 'flat', bank: 'left' },
    kind: 'pitchTransition',
    options: { targetPitch: TRACK_PITCHES.steepUp },
    ok: true,
  },
  {
    name: 'halfLoopUp leaves inverted and reversed',
    start: flatUnbankedConnection(1),
    kind: 'halfLoopUp',
    ok: true,
  },
  {
    name: 'halfLoopDown requires inverted',
    start: flatUnbankedConnection(),
    kind: 'halfLoopDown',
    ok: false,
  },
  {
    name: 'twister may place a helix from flat',
    start: flatUnbankedConnection(),
    kind: 'helixLeft',
    typeId: 'twister',
    ok: true,
  },
  {
    name: 'classicSteel cannot place helix',
    start: flatUnbankedConnection(),
    kind: 'helixLeft',
    ok: false,
  },
  {
    name: 'junior cannot place helix',
    start: flatUnbankedConnection(),
    kind: 'helixRight',
    typeId: 'junior',
    ok: false,
  },
  {
    name: 'bobsled forbids sloped curves',
    start: { heading: 0, pitch: 'gentleUp', bank: 'none' },
    kind: 'curveLeft2',
    typeId: 'bobsled',
    ok: false,
  },
]

export function testCoasterTypes(fixture?: (n?: number) => GameState): void {
  assert.deepEqual([...PLAYABLE_COASTER_TYPE_IDS], [...COASTER_CATALOG_TYPE_IDS])
  assert.equal(listPlayableCoasterCatalogTypes().length, COASTER_CATALOG_TYPE_IDS.length)
  assert.equal(listPlayableCoasterCatalogTypes()[0]?.id, 'classicSteel')
  assert.deepEqual(Object.keys(COASTER_TYPES), [...COASTER_CATALOG_TYPE_IDS])
  assert.ok(!COASTER_TYPES.classicSteel.supportedPieces.includes('helixLeft'))
  assert.ok(!COASTER_TYPES.classicSteel.supportedPieces.includes('helixRight'))
  assert.deepEqual(
    [...resolveSupportedTrackPieces('classicSteel')],
    [...COASTER_TYPES.classicSteel.supportedPieces],
  )
  assert.equal(SIMULATION_CONFIG.coasters.classicSteel.carCapacity, 4)
  assert.equal(COASTER_TYPES.classicSteel.carCapacity, 4)
  assert.equal(COASTER_TYPES.classicSteel.physics.worldUnitMeters, 8)
  assert.ok(COASTER_TYPES.classicSteel.physics.chainSpeed >= 6)
  assert.equal(SIMULATION_CONFIG.coasters.trackJoinSmoothing.sigma, 0.28)
  assert.deepEqual(
    [...HEADLINER_SPECIAL_KINDS],
    ['sBendLeft', 'sBendRight', 'verticalLoop', 'halfLoopUp', 'halfLoopDown', 'photo', 'splash', 'brakes', 'helixLeft', 'helixRight'],
  )
  for (const kind of HEADLINER_SPECIAL_KINDS) {
    if (kind === 'helixLeft' || kind === 'helixRight') {
      assert.equal(catalogAllowsTrackPiece('classicSteel', kind), false, `classicSteel must not gain helix`)
      continue
    }
    assert.equal(catalogAllowsTrackPiece('classicSteel', kind), true, `classicSteel must keep ${kind}`)
  }
  assert.equal(FLOORLESS_IS_TWISTER_VEHICLE, true)
  assert.ok(!COASTER_CATALOG_TYPE_IDS.includes('floorless' as CoasterCatalogTypeId))
  assert.deepEqual([...NON_COASTER_TRACK_RIDES], ['goKarts', 'miniRailway'])
  assert.equal(classifyTrackPitch(0), 'flat')
  assert.equal(classifyTrackPitch(TRACK_PITCHES.gentleUp), 'gentleUp')
  assert.equal(classifyTrackPitch(TRACK_PITCHES.steepUp), 'steepUp')
  assert.equal(classifyTrackBank(0), 'none')
  assert.equal(classifyTrackBank(TRACK_BANK_ANGLE), 'right')
  assert.equal(classifyTrackBank(-TRACK_BANK_ANGLE), 'left')
  assert.equal(classifyTrackBank(Math.PI), 'inverted')

  assert.deepEqual(
    EXPECTED_TYPE_FACTS.map((row) => row.id),
    [...COASTER_CATALOG_TYPE_IDS],
    'catalog rows and expected facts must stay in the same order',
  )

  for (const expected of EXPECTED_TYPE_FACTS) {
    const entry = COASTER_CATALOG[expected.id]
    assert.equal(entry.playable, expected.playable, `${expected.id} playable`)
    assert.equal(entry.capabilities.gentle, expected.gentle, `${expected.id} gentle`)
    assert.equal(entry.capabilities.steep, expected.steep, `${expected.id} steep`)
    assert.equal(entry.capabilities.vertical, expected.vertical, `${expected.id} vertical`)
    assert.equal(entry.capabilities.banking, expected.banking, `${expected.id} banking`)
    assert.equal(entry.capabilities.slopeCurveBanked, expected.slopeCurveBanked, `${expected.id} slopeCurveBanked`)
    assert.equal(entry.capabilities.inversions, expected.inversions, `${expected.id} inversions`)
    assert.equal(entry.capabilities.flatToSteep, expected.flatToSteep, `${expected.id} flatToSteep`)
    assert.equal(entry.capabilities.oneTileTurns, expected.oneTileTurns, `${expected.id} oneTileTurns`)
    assert.equal(entry.capabilities.chainLift, expected.chainLift, `${expected.id} chainLift`)
    assert.equal(entry.capabilities.cableLift, expected.cableLift, `${expected.id} cableLift`)
    assert.equal(entry.capabilities.noLiftHill, expected.noLiftHill, `${expected.id} noLiftHill`)
    assert.equal(entry.capabilities.poweredLaunch, expected.poweredLaunch, `${expected.id} poweredLaunch`)
    assert.equal(
      entry.capabilities.reverseInclineShuttle,
      expected.reverseInclineShuttle,
      `${expected.id} reverseInclineShuttle`,
    )
    assert.equal(entry.capabilities.blockSectioned, expected.blockSectioned, `${expected.id} blockSectioned`)
    for (const kind of expected.mustAllow) {
      assert.equal(catalogAllowsTrackPiece(expected.id, kind), true, `${expected.id} must allow ${kind}`)
    }
    for (const kind of expected.mustForbid) {
      assert.equal(catalogAllowsTrackPiece(expected.id, kind), false, `${expected.id} must forbid ${kind}`)
    }
    for (const special of expected.uniqueIncludes) {
      assert.ok(entry.uniqueSpecials.includes(special), `${expected.id} uniqueSpecials missing ${special}`)
    }
    assert.ok(expected.id in COASTER_TYPES, `${expected.id} must be a live COASTER_TYPES key`)
    assert.deepEqual(
      [...COASTER_TYPES[expected.id].supportedPieces],
      [...entry.headlinerPieces],
      `${expected.id} live supportedPieces must match catalog`,
    )
  }

  for (const testCase of CURRENT_APPEND_CASES) {
    const end = { pitch: testCase.pitch, bank: testCase.bank }
    const issue = describeTrackAppendIssue(end, testCase.kind, testCase.options, testCase.typeId)
    assert.equal(
      issue === null,
      testCase.ok,
      `${testCase.name}: expected ${testCase.ok ? 'legal' : 'illegal'} (${issue ?? 'ok'})`,
    )
    assert.equal(canAppendTrackPiece(end, testCase.kind, testCase.options, testCase.typeId), testCase.ok)
  }

  const flat = { pitch: 0, bank: 0 }
  assert.equal(isTrackPalettePieceEnabled('station', null, false), true)
  assert.equal(isTrackPalettePieceEnabled('straight', null, false), false)
  assert.equal(isTrackPalettePieceEnabled('verticalLoop', flat, true), true)
  assert.equal(isTrackPalettePieceEnabled('verticalLoop', { pitch: TRACK_PITCHES.gentleUp, bank: 0 }, true), false)
  assert.equal(isTrackPalettePieceEnabled('curveRight1', { pitch: 0, bank: -TRACK_BANK_ANGLE }, true), false)
  assert.equal(isTrackPalettePieceEnabled('curveLeft1', { pitch: 0, bank: -TRACK_BANK_ANGLE }, true), true)
  assert.equal(isTrackPalettePieceEnabled('halfLoopDown', flat, true), false)
  assert.equal(isTrackPalettePieceEnabled('halfLoopDown', { pitch: 0, bank: Math.PI }, true), true)
  assert.equal(isTrackPitchChoiceEnabled(0, TRACK_PITCHES.steepUp), true)
  assert.equal(isTrackPitchChoiceEnabled(TRACK_PITCHES.gentleDown, TRACK_PITCHES.steepUp), false)
  assert.equal(isTrackBankChoiceEnabled(0, TRACK_BANK_ANGLE), true)
  assert.equal(isTrackBankChoiceEnabled(-TRACK_BANK_ANGLE, TRACK_BANK_ANGLE), false)
  assert.equal(isTrackBankChoiceEnabled(-TRACK_BANK_ANGLE, 0), true)
  assert.equal(isTrackChainLiftEligible('slopeUp', 0, TRACK_PITCHES.steepUp), true)
  assert.equal(isTrackChainLiftEligible('straight', 0, 0), false)
  assert.equal(isTrackChainLiftEligible('pitchTransition', 0, TRACK_PITCHES.gentleDown), false)

  for (const testCase of DISCRETE_CASES) {
    const issue = describeDiscreteConnectionIssue(
      testCase.start,
      testCase.kind,
      testCase.options,
      testCase.typeId ?? 'classicSteel',
    )
    assert.equal(
      issue === null,
      testCase.ok,
      `${testCase.name}: expected ${testCase.ok ? 'legal' : 'illegal'} (${issue ?? 'ok'})`,
    )
    assert.equal(
      canConnectDiscretePiece(testCase.start, testCase.kind, testCase.options, testCase.typeId ?? 'classicSteel'),
      testCase.ok,
    )
  }

  const halfUp = discretePieceEnds(flatUnbankedConnection(0), 'halfLoopUp')
  assert.equal(halfUp?.end.heading, 2)
  assert.equal(halfUp?.end.bank, 'inverted')
  const leftTurn = discretePieceEnds(flatUnbankedConnection(0), 'curveLeft1')
  assert.equal(leftTurn?.end.heading, 1)

  if (!fixture) return
  const game = fixture(0)
  game.addDebugMoney()
  const started = game.startCoaster('classicSteel', 10, -10)
  assert.ok(started.ok && started.id, started.message)
  const id = started.id!
  assert.equal(game.appendCoasterPiece(id, 'verticalLoop', false).ok, true)
  assert.ok(game.undoCoasterPiece(id).ok)
  assert.equal(game.appendCoasterPiece(id, 'slopeGentleUp', true).ok, true, 'live GameState still allows gentle climb from station')
  assert.equal(
    game.appendCoasterPiece(id, 'pitchTransition', false, undefined, { targetPitch: TRACK_PITCHES.steepDown }).ok,
    false,
    'cannot jump gentle up to steep down',
  )
  assert.equal(
    game.appendCoasterPiece(id, 'bankTransition', false, undefined, { targetBank: TRACK_BANK_ANGLE }).ok,
    true,
  )
  assert.equal(game.appendCoasterPiece(id, 'curveLeft1', false).ok, false, 'right bank cannot take a left curve')

  assert.equal(resolveCoasterTypeId('missingType'), 'classicSteel')
  assert.equal(getCoasterType('missingType').id, 'classicSteel')
  assert.equal(typeAllowsSteep('junior'), false)
  assert.equal(typeAllowsSteep('classicSteel'), true)
  assert.equal(typeAllowsChainLift('limLaunched'), false)
  assert.equal(typeAllowsChainLift('classicSteel'), true)
  assert.equal(isTrackChainLiftEligible('slopeUp', 0, TRACK_PITCHES.steepUp, 'limLaunched'), false)
  assert.equal(isTrackPitchChoiceEnabled(0, TRACK_PITCHES.steepUp, 'junior'), false)
  assert.equal(isTrackBankChoiceEnabled(0, TRACK_BANK_ANGLE, 'steelWildMouse'), false)
  assert.equal(isTrackPalettePieceEnabled('helixLeft', flat, true, 'twister'), true)
  assert.equal(isTrackPalettePieceEnabled('helixLeft', flat, true, 'classicSteel'), false)
  assert.equal(isTrackPalettePieceEnabled('splash', flat, true, 'wooden'), true)
  assert.equal(isTrackPalettePieceEnabled('splash', flat, true, 'junior'), false)
  assert.equal(isTrackPalettePieceEnabled('curveLeft1', flat, true, 'wooden'), false)
  assert.equal(catalogAllowsTrackPiece('corkscrew', 'verticalLoop'), true)
  assert.equal(catalogAllowsTrackPiece('corkscrew', 'splash'), false)

  for (const typeId of COASTER_CATALOG_TYPE_IDS) {
    const preview = coasterVehiclePreview(typeId)
    assert.equal(preview.typeId, typeId)
    assert.equal(preview.trainStyle, COASTER_TYPES[typeId].trainStyle, `${typeId} thumbnail uses live train style`)
    assert.equal(preview.trainStyle, COASTER_CATALOG[typeId].trainStyle)
    assert.ok(preview.carColor > 0 || preview.carColor === 0)
  }
  assert.equal(coasterVehiclePreview('wooden').trainStyle, 'wooden')
  assert.equal(coasterVehiclePreview('twister').trainStyle, 'bmSitdown')
  assert.equal(coasterVehiclePreview('inverted').trainStyle, 'invertV')
  assert.equal(coasterVehiclePreview('junior').trainStyle, 'junior')
  assert.equal(coasterVehiclePreview('steelWildMouse').trainStyle, 'mouse')
  assert.equal(coasterVehiclePreview('bobsled').trainStyle, 'bobsled')
  assert.equal(coasterVehiclePreview('limLaunched').trainStyle, 'launched')
  assert.equal(coasterVehiclePreview('giga').trainStyle, 'giga')
  assert.equal(coasterVehiclePreview('flying').trainStyle, 'flying')
  assert.equal(coasterVehiclePreview('suspendedSwinging').trainStyle, 'swinging')
  assert.equal(coasterVehiclePreview('mineTrain').trainStyle, 'mine')

  const woodenPalette = listTrackPalettePieces(
    [...TRACK_DIRECTION_KINDS, ...TRACK_SPECIAL_KINDS],
    flat,
    true,
    'wooden',
  )
  assert.ok(!woodenPalette.some((entry) => entry.kind === 'curveLeft1'), 'wooden palette excludes 1-tile turns')
  assert.ok(!woodenPalette.some((entry) => entry.kind === 'helixLeft'), 'wooden palette excludes helix')
  assert.ok(woodenPalette.some((entry) => entry.kind === 'curveLeft2' && entry.enabled))
  assert.ok(woodenPalette.some((entry) => entry.kind === 'splash' && entry.enabled))
  const juniorPalette = listTrackPalettePieces(
    [...TRACK_DIRECTION_KINDS, ...TRACK_SPECIAL_KINDS],
    flat,
    true,
    'junior',
  )
  assert.ok(!juniorPalette.some((entry) => entry.kind === 'verticalLoop'))
  assert.ok(!juniorPalette.some((entry) => entry.kind === 'helixLeft'))
  assert.ok(!listVisibleTrackPitchChoices(0, 'junior').includes(TRACK_PITCHES.steepUp))
  assert.ok(
    listTrackPitchChoices(0, 'junior').every((entry) => entry.pitch !== TRACK_PITCHES.steepUp),
    'junior hides steep, it is never available',
  )
  assert.deepEqual(listVisibleTrackBankChoices(0, 'steelWildMouse'), [0])
  const mousePalette = listVisibleTrackPalettePieces(TRACK_DIRECTION_KINDS, flat, true, 'steelWildMouse')
  assert.ok(mousePalette.includes('curveLeft1'))
  assert.ok(!mousePalette.includes('curveLeft2'))
  assert.ok(!listVisibleTrackPalettePieces(TRACK_SPECIAL_KINDS, flat, true, 'limLaunched').includes('helixLeft'))
  assert.equal(isTrackChainLiftVisible('limLaunched'), false)
  assert.equal(isTrackChainLiftVisible('classicSteel'), true)
  assert.equal(isTrackChainLiftEligible('straight', 0, 0, 'classicSteel'), false)
  assert.equal(isTrackChainLiftEligible('slopeGentleUp', 0, TRACK_PITCHES.gentleUp, 'classicSteel'), true)
  const mineBankedSlope = { pitch: TRACK_PITCHES.gentleUp, bank: -TRACK_BANK_ANGLE }
  assert.equal(isTrackPalettePieceEnabled('curveLeft2', mineBankedSlope, true, 'mineTrain'), false)
  const mineDirections = listTrackPalettePieces(TRACK_DIRECTION_KINDS, mineBankedSlope, true, 'mineTrain')
  const mineCurve = mineDirections.find((entry) => entry.kind === 'curveLeft2')
  assert.ok(mineCurve, 'mine train still lists banked sloped curves')
  assert.equal(mineCurve?.enabled, false, 'mine train greys banked sloped curves')
  const minePitches = listTrackPitchChoices(0, 'mineTrain', TRACK_BANK_ANGLE)
  assert.ok(
    minePitches.some((entry) => entry.pitch === TRACK_PITCHES.steepUp),
    'mine train still lists steep when the current bank cannot take it',
  )
  assert.equal(isTrackPitchChoiceCurrentlyEnabled(0, TRACK_PITCHES.steepUp, 'mineTrain', TRACK_BANK_ANGLE), false)
  const invertedEnd = { pitch: 0, bank: Math.PI }
  assert.equal(isTrackPalettePieceEnabled('curveLeft2', invertedEnd, true), false)
  const invertedDirections = listTrackPalettePieces(TRACK_DIRECTION_KINDS, invertedEnd, true)
  assert.ok(invertedDirections.some((entry) => entry.kind === 'curveLeft2' && !entry.enabled))
  assert.ok(invertedDirections.some((entry) => entry.kind === 'straight' && entry.enabled))
  const bobsledSlope = { pitch: TRACK_PITCHES.gentleUp, bank: 0 }
  const bobsledDirections = listTrackPalettePieces(TRACK_DIRECTION_KINDS, bobsledSlope, true, 'bobsled')
  assert.ok(
    bobsledDirections.some((entry) => entry.kind.startsWith('curve') && !entry.enabled),
    'bobsled greys sloped curves, does not omit type-supported turns',
  )
  const slopedSpecials = listTrackPalettePieces(TRACK_SPECIAL_KINDS, bobsledSlope, true, 'classicSteel')
  assert.ok(
    slopedSpecials.some((entry) => entry.kind === 'verticalLoop' && !entry.enabled),
    'specials that do not match the current end stay listed but disabled',
  )
  const beforeGhost = {
    typeId: 'bobsled',
    selectedKind: 'straight' as const,
    targetPitch: TRACK_PITCHES.gentleUp,
    targetBank: 0,
    chainLift: false,
  }
  const beforeResolved = resolveNextTrackPiece(beforeGhost, bobsledSlope, true)
  const ignoredKind = applyConstructionKind(beforeGhost, 'curveLeft2', bobsledSlope)
  assert.deepEqual(ignoredKind, beforeGhost, 'disabled kind does not change the construction window')
  assert.equal(
    resolveNextTrackPiece(ignoredKind, bobsledSlope, true).kind,
    beforeResolved.kind,
    'ghost does not change when activating a disabled control',
  )
  assert.equal(isTrackPitchChoiceCurrentlyEnabled(bobsledSlope.pitch, TRACK_PITCHES.steepUp, 'bobsled'), false)
  const oppositeBanks = listTrackBankChoices(-TRACK_BANK_ANGLE, 'classicSteel', 0)
  assert.ok(oppositeBanks.some((entry) => entry.bank === TRACK_BANK_ANGLE && !entry.enabled))
  assert.ok(oppositeBanks.some((entry) => Math.abs(entry.bank) < 0.001 && entry.enabled))
  assert.equal(isTrackBankChoiceCurrentlyEnabled(-TRACK_BANK_ANGLE, TRACK_BANK_ANGLE, 'classicSteel'), false)
  assert.equal(typeAllowsSteepBank('classicSteel'), true)
  assert.equal(typeAllowsSteepBank('mineTrain'), false)
  assert.equal(isLegalPitchBankPair('mineTrain', TRACK_PITCHES.steepUp, TRACK_BANK_ANGLE), false)
  assert.equal(isLegalPitchBankPair('classicSteel', TRACK_PITCHES.steepUp, TRACK_BANK_ANGLE), true)

  const bankedMine: CoasterWindowState = {
    typeId: 'mineTrain',
    selectedKind: 'straight',
    targetPitch: 0,
    targetBank: TRACK_BANK_ANGLE,
    chainLift: false,
  }
  const steepSnap = applyConstructionPitch(bankedMine, TRACK_PITCHES.steepUp)
  assert.equal(steepSnap.targetPitch, TRACK_PITCHES.steepUp)
  assert.equal(steepSnap.targetBank, 0, 'steep while banked on mineTrain snaps bank off')
  const steepMine: CoasterWindowState = {
    typeId: 'mineTrain',
    selectedKind: 'straight',
    targetPitch: TRACK_PITCHES.steepUp,
    targetBank: 0,
    chainLift: false,
  }
  const bankSnap = applyConstructionBank(steepMine, TRACK_BANK_ANGLE)
  assert.equal(bankSnap.targetBank, TRACK_BANK_ANGLE)
  assert.equal(bankSnap.targetPitch, TRACK_PITCHES.gentleUp, 'bank while steep on mineTrain snaps pitch to gentle')

  const flatWindow: CoasterWindowState = {
    typeId: 'classicSteel',
    selectedKind: 'straight',
    targetPitch: 0,
    targetBank: 0,
    chainLift: false,
  }
  assert.equal(resolveNextTrackPiece(flatWindow, flat, true).kind, 'straight')
  const slopedWindow = applyConstructionPitch(flatWindow, TRACK_PITCHES.gentleUp)
  const slopedNext = resolveNextTrackPiece(slopedWindow, flat, true)
  assert.equal(slopedNext.kind, 'pitchTransition', 'ghost kind changes when slope changes without append')
  assert.equal(slopedNext.options.targetPitch, TRACK_PITCHES.gentleUp)
  assert.equal(constantPitchPieceKind(TRACK_PITCHES.gentleUp), 'slopeGentleUp')
  const curveWindow = applyConstructionKind(slopedWindow, 'curveLeft2', flat)
  assert.equal(curveWindow.selectedKind, 'curveLeft2')
  assert.equal(curveWindow.targetPitch, 0, 'selecting a curve snaps pitch back to the open end')
  assert.equal(
    resolveNextTrackPiece(curveWindow, flat, true).kind,
    'curveLeft2',
    'ghost kind changes when direction changes without append',
  )
  const bankWindow = applyConstructionBank(flatWindow, TRACK_BANK_ANGLE)
  assert.equal(resolveNextTrackPiece(bankWindow, flat, true).kind, 'bankTransition')
  const loopWindow = applyConstructionKind(flatWindow, 'verticalLoop', flat)
  assert.equal(resolveNextTrackPiece(loopWindow, flat, true).kind, 'verticalLoop')

  const windowCases: Array<{ window: CoasterWindowState; end: { pitch: number; bank: number } }> = [
    { window: flatWindow, end: flat },
    { window: slopedWindow, end: flat },
    { window: steepSnap, end: { pitch: 0, bank: TRACK_BANK_ANGLE } },
    {
      window: { typeId: 'steelWildMouse', selectedKind: 'curveLeft1', targetPitch: TRACK_PITCHES.steepUp, targetBank: TRACK_BANK_ANGLE, chainLift: true },
      end: flat,
    },
    {
      window: { typeId: 'junior', selectedKind: 'verticalLoop', targetPitch: TRACK_PITCHES.steepUp, targetBank: 0, chainLift: false },
      end: flat,
    },
    {
      window: { typeId: 'wooden', selectedKind: 'helixLeft', targetPitch: 0, targetBank: 0, chainLift: false },
      end: flat,
    },
  ]
  for (const testCase of windowCases) {
    const next = resolveNextTrackPiece(testCase.window, testCase.end, true)
    assert.equal(
      describeTrackAppendIssue(testCase.end, next.kind, next.options, testCase.window.typeId),
      null,
      `resolveNextTrackPiece must not return illegal ${next.kind} for ${testCase.window.typeId}`,
    )
  }

  const woodenRide = game.startCoaster('wooden', -8, -10)
  assert.ok(woodenRide.ok && woodenRide.id, woodenRide.message)
  assert.equal(game.getCoaster(woodenRide.id!)?.typeId, 'wooden')
  assert.equal(game.appendCoasterPiece(woodenRide.id!, 'halfLoopUp', false).ok, false)
  assert.equal(game.appendCoasterPiece(woodenRide.id!, 'splash', false).ok, true)
  assert.equal(game.appendCoasterPiece(woodenRide.id!, 'helixLeft', false).ok, false)

  const juniorRide = game.startCoaster('junior', 0, 8)
  assert.ok(juniorRide.ok && juniorRide.id, juniorRide.message)
  assert.equal(
    game.appendCoasterPiece(juniorRide.id!, 'pitchTransition', false, undefined, { targetPitch: TRACK_PITCHES.steepUp }).ok,
    false,
    'junior cannot skip to steep',
  )
  assert.equal(game.appendCoasterPiece(juniorRide.id!, 'slopeUp', false).ok, false)

  const limRide = game.startCoaster('limLaunched', -12, 8)
  assert.ok(limRide.ok && limRide.id, limRide.message)
  assert.equal(isTrackChainLiftEligible('slopeGentleUp', 0, TRACK_PITCHES.gentleUp, 'limLaunched'), false)
  assert.equal(game.appendCoasterPiece(limRide.id!, 'slopeGentleUp', true).ok, true)
  assert.equal(game.getCoaster(limRide.id!)!.pieces[1]?.chainLift, false, 'LIM must not store a chain lift')

  const twisterRide = game.startCoaster('twister', 8, 8)
  assert.ok(twisterRide.ok && twisterRide.id, twisterRide.message)
  assert.equal(game.appendCoasterPiece(twisterRide.id!, 'helixLeft', false).ok, true)

  const planning = structuredClone(new GameState().snapshot)
  planning.terrain = { heights: {} }
  planning.buildings = []
  planning.festival.planning = true
  planning.parkOpen = false
  planning.speed = 1
  const testRide = new GameState(planning)
  testRide.addDebugMoney()
  const circuit = testRide.startCoaster('classicSteel', 10, -10)
  assert.ok(circuit.ok && circuit.id, circuit.message)
  for (const kind of ['curveRight2', 'straight', 'curveRight2', 'straight', 'curveRight2', 'straight', 'curveRight2'] as const) {
    const placed = testRide.appendCoasterPiece(circuit.id!, kind, false)
    assert.ok(placed.ok, `${kind}: ${placed.message}`)
  }
  const ride = testRide.getCoaster(circuit.id!)!
  assert.equal(ride.closed, true, 'simple rectangle must close')
  const startedTest = testRide.setCoasterOperationMode(circuit.id!, 'test')
  assert.ok(startedTest.ok, startedTest.message)
  assert.equal(ride.operationMode, 'test')
  const distanceBefore = ride.train.distance
  const speedBefore = ride.train.speed
  for (let step = 0; step < 8; step += 1) testRide.tick(0.1)
  assert.equal(testRide.snapshot.festival.planning, true, 'planning stays on during Testfahrt')
  assert.ok(ride.train.state === 'running', `test train should dispatch, got ${ride.train.state}`)
  assert.ok(ride.train.distance > distanceBefore, 'test train must leave the station during planning')
  assert.ok(ride.train.speed > speedBefore, 'test train must pick up station launch speed')

  console.log('PASS coaster type catalog, connection rules and playable type wiring')
}
