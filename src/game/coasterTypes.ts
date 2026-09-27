import { de, keep } from '../i18n/marker'
import {
  COASTER_TYPES,
  TRACK_PIECE_KINDS,
  getCoasterType,
  type CoasterLiftStyle,
  type CoasterTrackStyleId,
  type CoasterTrainStyleId,
  type CoasterTypeId,
  type TrackPieceKind,
} from './coasters'
import {
  resolveTrackEditorMode,
  type TrackEditorMode,
} from './trackEditorMode'

export type { TrackEditorMode } from './trackEditorMode'

/**
 * Live coaster-type catalog for the track editor.
 *
 * Every row is playable via `COASTER_TYPES`. OpenRCT2 extras (cheats / modern
 * RTDs) stay marked `extra`, not vanilla. Corkscrew / barrel / zero-G /
 * diagonal kinds are catalogued but not yet placeable Headliner pieces.
 */
export const COASTER_CATALOG_TYPE_IDS = [
  'classicSteel',
  'wooden',
  'looping',
  'corkscrew',
  'hyper',
  'twister',
  'hyperTwister',
  'verticalDrop',
  'giga',
  'lsmLaunched',
  'limLaunched',
  'inverted',
  'compactInverted',
  'flying',
  'standUp',
  'junior',
  'steelWildMouse',
  'woodenWildMouse',
  'mineTrain',
  'bobsled',
  'suspendedSwinging',
] as const

export type CoasterCatalogTypeId = (typeof COASTER_CATALOG_TYPE_IDS)[number]

/** RCT2 / OpenRCT2 availability buckets — not a list of 300 piece IDs. */
export const COASTER_TRACK_GROUPS = [
  'straight',
  'stationEnd',
  'liftHill',
  'liftHillSteep',
  'slope',
  'slopeSteepUp',
  'slopeSteepDown',
  'slopeVertical',
  'slopeCurve',
  'slopeCurveBanked',
  'sBend',
  'curveVerySmall',
  'curveSmall',
  'curveLarge',
  'verticalLoop',
  'halfLoop',
  'corkscrew',
  'twist',
  'barrelRoll',
  'zeroGRoll',
  'helix',
  'brakes',
  'blockBrakes',
  'booster',
  'onridePhoto',
  'waterSplash',
  'diag',
] as const

export type CoasterTrackGroup = (typeof COASTER_TRACK_GROUPS)[number]

/** Families that exist as Headliner `TrackPieceKind`s today. */
export type HeadlinerSpecialKind = Extract<
  TrackPieceKind,
  | 'sBendLeft'
  | 'sBendRight'
  | 'verticalLoop'
  | 'halfLoopUp'
  | 'halfLoopDown'
  | 'photo'
  | 'splash'
  | 'brakes'
  | 'helixLeft'
  | 'helixRight'
>

export const HEADLINER_SPECIAL_KINDS: readonly HeadlinerSpecialKind[] = [
  'sBendLeft',
  'sBendRight',
  'verticalLoop',
  'halfLoopUp',
  'halfLoopDown',
  'photo',
  'splash',
  'brakes',
  'helixLeft',
  'helixRight',
]

/** Placeable today. Catalog may still mention corkscrew / barrel / zero-G / diagonal as not-yet-placeable. */
export const PLACEABLE_HEADLINER_SPECIALS: readonly HeadlinerSpecialKind[] = HEADLINER_SPECIAL_KINDS

export const NOT_YET_PLACEABLE_SPECIALS = ['corkscrew', 'barrelRoll', 'zeroGRoll', 'twist', 'diag'] as const

export type CoasterSlopeAvailability = 'none' | 'vanilla' | 'extra'
export type CoasterInversionAvailability = 'none' | 'default' | 'extra'

export type CoasterCatalogCapabilities = {
  /** ~25° / Headliner gentle (`atan(0.5)`). */
  gentle: boolean
  /** RCT2 60° target. Headliner steep is currently 45° — see `docs/coaster.md`. */
  steep: boolean
  vertical: CoasterSlopeAvailability
  banking: boolean
  /** Mine train: banking allowed, but not banked sloped curves. */
  slopeCurveBanked: boolean
  inversions: CoasterInversionAvailability
  /** Flat → steep / 60° in one long-base piece. */
  flatToSteep: boolean
  oneTileTurns: boolean
  chainLift: CoasterSlopeAvailability
  cableLift: boolean
  poweredLift: boolean
  curvedLift: boolean
  noLiftHill: boolean
  circuit: boolean
  blockSectioned: boolean
  poweredLaunch: boolean
  reverseInclineShuttle: boolean
}

export type CoasterCatalogEntry = {
  id: CoasterCatalogTypeId
  name: string
  /** Live `COASTER_TYPES` key. All catalog rows are playable. */
  playable: boolean
  capabilities: CoasterCatalogCapabilities
  /** Headliner kinds this type may place. */
  headlinerPieces: readonly TrackPieceKind[]
  trackGroups: readonly CoasterTrackGroup[]
  uniqueSpecials: readonly string[]
  liftStyle: CoasterLiftStyle
  trackStyle: CoasterTrackStyleId
  trainStyle: CoasterTrainStyleId
  notes: string
  /**
   * Construction chrome. Omitted rows use the RCT2 palette + large build button.
   * Path-led rides set `directionArrows`.
   */
  editorMode?: TrackEditorMode
}

const ALL_HEADLINER_PIECES: readonly TrackPieceKind[] = TRACK_PIECE_KINDS

function withoutPieces(
  pieces: readonly TrackPieceKind[],
  excluded: readonly TrackPieceKind[],
): TrackPieceKind[] {
  const skip = new Set(excluded)
  return pieces.filter((kind) => !skip.has(kind))
}

const NO_INVERSIONS = ['verticalLoop', 'halfLoopUp', 'halfLoopDown'] as const satisfies readonly TrackPieceKind[]
const NO_BANKING = ['bankTransition'] as const satisfies readonly TrackPieceKind[]
const NO_STEEP = ['slopeUp', 'slopeDown'] as const satisfies readonly TrackPieceKind[]
const NO_HELIX = ['helixLeft', 'helixRight'] as const satisfies readonly TrackPieceKind[]
const NO_LARGE_CURVES = ['curveLeft3', 'curveRight3', 'curveLeft4', 'curveRight4'] as const
const NO_ONE_TILE_TURNS = ['curveLeft1', 'curveRight1'] as const
const ONLY_ONE_TILE_TURNS = [
  'curveLeft2',
  'curveRight2',
  'curveLeft3',
  'curveRight3',
  'curveLeft4',
  'curveRight4',
] as const

function vanillaCaps(
  overrides: Partial<CoasterCatalogCapabilities>,
): CoasterCatalogCapabilities {
  return {
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
    poweredLift: false,
    curvedLift: false,
    noLiftHill: false,
    circuit: true,
    blockSectioned: false,
    poweredLaunch: false,
    reverseInclineShuttle: false,
    ...overrides,
  }
}

export const COASTER_CATALOG: Record<CoasterCatalogTypeId, CoasterCatalogEntry> = {
  classicSteel: {
    id: 'classicSteel',
    name: de('Klassische Stahlachterbahn'),
    playable: true,
    capabilities: vanillaCaps({
      inversions: 'default',
      oneTileTurns: true,
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, NO_HELIX),
    trackGroups: [
      'straight',
      'stationEnd',
      'liftHill',
      'slope',
      'slopeSteepUp',
      'slopeSteepDown',
      'slopeCurve',
      'sBend',
      'curveVerySmall',
      'curveSmall',
      'curveLarge',
      'verticalLoop',
      'halfLoop',
      'brakes',
      'onridePhoto',
      'waterSplash',
    ],
    uniqueSpecials: ['verticalLoop', 'halfLoop', 'sBend', 'photo', 'splash', 'brakes', 'chainFlag'],
    liftStyle: 'chain',
    trackStyle: 'steelLattice',
    trainStyle: 'sitDownSteel',
    notes: // i18n-ignore developer note, never displayed
      'Default / save-fallback type. Parametric family kinds plus discrete connection state. Steep is labelled Steil and stays 45° so existing classicSteel saves keep their rise-per-tile. One train; cars = station tiles × carCapacity. Helix is not in this type’s groups.',
  },
  wooden: {
    id: 'wooden',
    name: de('Holzachterbahn'),
    playable: true,
    capabilities: vanillaCaps({
      inversions: 'default',
      reverseInclineShuttle: true,
      oneTileTurns: false,
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, ['halfLoopUp', 'halfLoopDown', ...NO_ONE_TILE_TURNS, ...NO_HELIX]),
    trackGroups: [
      'straight',
      'stationEnd',
      'liftHill',
      'liftHillSteep',
      'slope',
      'slopeSteepUp',
      'slopeSteepDown',
      'slopeCurve',
      'slopeCurveBanked',
      'sBend',
      'curveSmall',
      'curveLarge',
      'verticalLoop',
      'brakes',
      'onridePhoto',
      'waterSplash',
    ],
    uniqueSpecials: ['verticalLoop', 'waterSplash', 'reverseInclineShuttle'],
    liftStyle: 'chain',
    trackStyle: 'wooden',
    trainStyle: 'wooden',
    notes: 'Vanilla: 25/60, banking, loop, water splash, reverse-incline shuttle. No 90°, no corkscrew by default.', // i18n-ignore developer note, never displayed
  },
  looping: {
    id: 'looping',
    name: de('Looping-Stahlachterbahn'),
    playable: true,
    capabilities: vanillaCaps({
      vertical: 'extra',
      inversions: 'default',
      poweredLaunch: true,
      oneTileTurns: true,
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, ['splash', ...NO_HELIX]),
    trackGroups: [
      'straight',
      'stationEnd',
      'liftHill',
      'liftHillSteep',
      'slope',
      'slopeSteepUp',
      'slopeSteepDown',
      'slopeVertical',
      'slopeCurve',
      'slopeCurveBanked',
      'sBend',
      'curveVerySmall',
      'curveSmall',
      'curveLarge',
      'verticalLoop',
      'brakes',
      'onridePhoto',
    ],
    uniqueSpecials: ['verticalLoop', 'poweredLaunch'],
    liftStyle: 'chain',
    trackStyle: 'steelLattice',
    trainStyle: 'sitDownSteel',
    notes: 'Vertical loop by default. Powered launch. 90° is an OpenRCT2 extra, not vanilla.', // i18n-ignore developer note, never displayed
  },
  corkscrew: {
    id: 'corkscrew',
    name: keep('Corkscrew'),
    playable: true,
    capabilities: vanillaCaps({
      inversions: 'default',
      oneTileTurns: true,
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, ['splash', ...NO_HELIX]),
    trackGroups: [
      'straight',
      'stationEnd',
      'liftHill',
      'slope',
      'slopeSteepUp',
      'slopeSteepDown',
      'slopeCurve',
      'slopeCurveBanked',
      'sBend',
      'curveVerySmall',
      'curveSmall',
      'curveLarge',
      'verticalLoop',
      'halfLoop',
      'corkscrew',
      'brakes',
      'onridePhoto',
    ],
    uniqueSpecials: ['verticalLoop', 'halfLoop', 'corkscrew'],
    liftStyle: 'chain',
    trackStyle: 'steelLattice',
    trainStyle: 'sitDownSteel',
    notes: 'Loop, half-loop, corkscrew. Corkscrew family is catalogued but not yet placeable.', // i18n-ignore developer note, never displayed
  },
  hyper: {
    id: 'hyper',
    name: de('Hyperachterbahn'),
    playable: true,
    capabilities: vanillaCaps({
      inversions: 'none',
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, [...NO_INVERSIONS, 'splash', ...NO_HELIX]),
    trackGroups: [
      'straight',
      'stationEnd',
      'liftHill',
      'liftHillSteep',
      'slope',
      'slopeSteepUp',
      'slopeSteepDown',
      'slopeCurve',
      'slopeCurveBanked',
      'sBend',
      'curveSmall',
      'curveLarge',
      'corkscrew',
      'brakes',
      'onridePhoto',
    ],
    uniqueSpecials: ['corkscrewWithoutInversions', 'tallerClearance'],
    liftStyle: 'chain',
    trackStyle: 'gigaLattice',
    trainStyle: 'sitDownSteel',
    notes: 'Corkscrew-style layout without inversion pieces. Taller supports / drop than looping steel.', // i18n-ignore developer note, never displayed
  },
  twister: {
    id: 'twister',
    name: keep('Twister (B&M)'),
    playable: true,
    capabilities: vanillaCaps({
      vertical: 'vanilla',
      inversions: 'default',
      blockSectioned: true,
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, ['splash']),
    trackGroups: [
      'straight',
      'stationEnd',
      'liftHill',
      'liftHillSteep',
      'slope',
      'slopeSteepUp',
      'slopeSteepDown',
      'slopeVertical',
      'slopeCurve',
      'slopeCurveBanked',
      'sBend',
      'curveVerySmall',
      'curveSmall',
      'curveLarge',
      'verticalLoop',
      'halfLoop',
      'corkscrew',
      'twist',
      'barrelRoll',
      'zeroGRoll',
      'helix',
      'brakes',
      'blockBrakes',
      'onridePhoto',
    ],
    uniqueSpecials: ['fullModernInversions', 'vertical90', 'blockSectioned'],
    liftStyle: 'chain',
    trackStyle: 'boxSpine',
    trainStyle: 'bmSitdown',
    notes: // i18n-ignore developer note, never displayed
      'Full modern inversions, vanilla 90°, circuit + block-sectioned only, no launch. Floorless is this vehicle, not a separate ride type. Helix is placeable.',
  },
  hyperTwister: {
    id: 'hyperTwister',
    name: de('Hyper-Twister'),
    playable: true,
    capabilities: vanillaCaps({
      vertical: 'vanilla',
      inversions: 'none',
      blockSectioned: true,
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, [...NO_INVERSIONS, 'splash']),
    trackGroups: [
      'straight',
      'stationEnd',
      'liftHill',
      'liftHillSteep',
      'slope',
      'slopeSteepUp',
      'slopeSteepDown',
      'slopeVertical',
      'slopeCurve',
      'slopeCurveBanked',
      'sBend',
      'curveSmall',
      'curveLarge',
      'helix',
      'brakes',
      'blockBrakes',
      'onridePhoto',
    ],
    uniqueSpecials: ['vertical90', 'blockSectioned'],
    liftStyle: 'chain',
    trackStyle: 'boxSpine',
    trainStyle: 'bmSitdown',
    notes: 'Twister without inversion pieces. Circuit + block only. Helix is placeable.', // i18n-ignore developer note, never displayed
  },
  verticalDrop: {
    id: 'verticalDrop',
    name: keep('Vertical Drop'),
    playable: true,
    capabilities: vanillaCaps({
      vertical: 'vanilla',
      inversions: 'none',
      chainLift: 'vanilla',
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, [...NO_INVERSIONS, 'splash', ...NO_HELIX]),
    trackGroups: [
      'straight',
      'stationEnd',
      'liftHill',
      'liftHillSteep',
      'slope',
      'slopeSteepUp',
      'slopeSteepDown',
      'slopeVertical',
      'slopeCurve',
      'brakes',
      'onridePhoto',
    ],
    uniqueSpecials: ['brakeForDrop', 'steepChain', 'boxedSupports'],
    liftStyle: 'chain',
    trackStyle: 'gigaLattice',
    trainStyle: 'giga',
    notes: 'Brake-for-drop, steep chain, boxed supports. No default inversions.', // i18n-ignore developer note, never displayed
  },
  giga: {
    id: 'giga',
    name: de('Giga-Coaster'),
    playable: true,
    capabilities: vanillaCaps({
      inversions: 'extra',
      cableLift: true,
      chainLift: 'none',
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, [...NO_INVERSIONS, 'splash', ...NO_HELIX]),
    trackGroups: [
      'straight',
      'stationEnd',
      'slope',
      'slopeSteepUp',
      'slopeSteepDown',
      'slopeCurve',
      'slopeCurveBanked',
      'sBend',
      'curveSmall',
      'curveLarge',
      'brakes',
      'onridePhoto',
    ],
    uniqueSpecials: ['cableLift'],
    liftStyle: 'cable',
    trackStyle: 'gigaLattice',
    trainStyle: 'giga',
    notes: 'Cable lift. Inversions are an OpenRCT2 extra only — do not enable them as vanilla.', // i18n-ignore developer note, never displayed
  },
  lsmLaunched: {
    id: 'lsmLaunched',
    name: de('LSM-Abschussachterbahn'),
    playable: true,
    capabilities: vanillaCaps({
      inversions: 'default',
      chainLift: 'extra',
      poweredLaunch: true,
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, ['splash', ...NO_HELIX]),
    trackGroups: [
      'straight',
      'stationEnd',
      'slope',
      'slopeSteepUp',
      'slopeSteepDown',
      'slopeCurve',
      'slopeCurveBanked',
      'sBend',
      'curveVerySmall',
      'curveSmall',
      'curveLarge',
      'verticalLoop',
      'halfLoop',
      'corkscrew',
      'brakes',
      'booster',
      'onridePhoto',
    ],
    uniqueSpecials: ['booster', 'poweredLaunch'],
    liftStyle: 'powered',
    trackStyle: 'launchedSteel',
    trainStyle: 'launched',
    notes: 'Boosters, inversions on. Chain lift is an extra, not the default launch style.', // i18n-ignore developer note, never displayed
  },
  limLaunched: {
    id: 'limLaunched',
    name: de('LIM-Abschussachterbahn'),
    playable: true,
    capabilities: vanillaCaps({
      inversions: 'default',
      chainLift: 'none',
      noLiftHill: true,
      poweredLaunch: true,
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, ['splash', ...NO_HELIX]),
    trackGroups: [
      'straight',
      'stationEnd',
      'slope',
      'slopeSteepUp',
      'slopeSteepDown',
      'slopeCurve',
      'sBend',
      'curveSmall',
      'curveLarge',
      'verticalLoop',
      'halfLoop',
      'brakes',
      'booster',
      'onridePhoto',
    ],
    uniqueSpecials: ['noLiftHill', 'poweredLaunch', 'booster'],
    liftStyle: 'none',
    trackStyle: 'launchedSteel',
    trainStyle: 'launched',
    notes: 'No lift hill. Launch only.', // i18n-ignore developer note, never displayed
  },
  inverted: {
    id: 'inverted',
    name: keep('Inverted'),
    playable: true,
    capabilities: vanillaCaps({
      inversions: 'default',
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, ['splash']),
    trackGroups: [
      'straight',
      'stationEnd',
      'liftHill',
      'slope',
      'slopeSteepUp',
      'slopeSteepDown',
      'slopeCurve',
      'sBend',
      'curveSmall',
      'curveLarge',
      'verticalLoop',
      'halfLoop',
      'corkscrew',
      'helix',
      'brakes',
      'onridePhoto',
    ],
    uniqueSpecials: ['suspended', 'quarterHelix', 'diveLoop'],
    liftStyle: 'chain',
    trackStyle: 'invertedBox',
    trainStyle: 'invertV',
    notes: 'Suspended trains, quarter helices, dive. Helix is placeable; corkscrew remains catalog-only.', // i18n-ignore developer note, never displayed
  },
  compactInverted: {
    id: 'compactInverted',
    name: de('Kompakte Inverted'),
    playable: true,
    capabilities: vanillaCaps({
      inversions: 'default',
      reverseInclineShuttle: true,
      oneTileTurns: true,
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, ['splash']),
    trackGroups: [
      'straight',
      'stationEnd',
      'liftHill',
      'slope',
      'slopeSteepUp',
      'slopeSteepDown',
      'slopeCurve',
      'sBend',
      'curveVerySmall',
      'curveSmall',
      'verticalLoop',
      'halfLoop',
      'corkscrew',
      'helix',
      'brakes',
      'onridePhoto',
    ],
    uniqueSpecials: ['smallerFootprint', 'reverseInclineShuttle'],
    liftStyle: 'chain',
    trackStyle: 'invertedBox',
    trainStyle: 'invertV',
    notes: 'Smaller inverted with reverse-incline shuttle. Helix is placeable.', // i18n-ignore developer note, never displayed
  },
  flying: {
    id: 'flying',
    name: keep('Flying Coaster'),
    playable: true,
    capabilities: vanillaCaps({
      inversions: 'default',
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, ['splash']),
    trackGroups: [
      'straight',
      'stationEnd',
      'liftHill',
      'slope',
      'slopeSteepUp',
      'slopeSteepDown',
      'slopeCurve',
      'sBend',
      'curveSmall',
      'curveLarge',
      'halfLoop',
      'corkscrew',
      'helix',
      'brakes',
      'onridePhoto',
    ],
    uniqueSpecials: ['startsInverted', 'flyToLie', 'twoDrawers'],
    liftStyle: 'chain',
    trackStyle: 'flyingSpine',
    trainStyle: 'flying',
    notes: 'Starts inverted in RCT2. Headliner still starts from a flat station; fly↔lie drawers are not ported. Helix is placeable.', // i18n-ignore developer note, never displayed
  },
  standUp: {
    id: 'standUp',
    name: de('Stehende Achterbahn'),
    playable: true,
    capabilities: vanillaCaps({
      inversions: 'default',
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, ['splash', ...NO_HELIX]),
    trackGroups: [
      'straight',
      'stationEnd',
      'liftHill',
      'slope',
      'slopeSteepUp',
      'slopeSteepDown',
      'slopeCurve',
      'sBend',
      'curveSmall',
      'curveLarge',
      'verticalLoop',
      'halfLoop',
      'corkscrew',
      'brakes',
      'onridePhoto',
    ],
    uniqueSpecials: ['verticalLoop', 'halfLoop', 'corkscrew'],
    liftStyle: 'chain',
    trackStyle: 'steelLattice',
    trainStyle: 'standUp',
    notes: 'Loop / half-loop / corkscrew. No default 90°. Corkscrew kind is not yet placeable.', // i18n-ignore developer note, never displayed
  },
  junior: {
    id: 'junior',
    name: de('Juniorachterbahn'),
    playable: true,
    capabilities: vanillaCaps({
      steep: false,
      banking: true,
      slopeCurveBanked: false,
      inversions: 'none',
      flatToSteep: false,
      chainLift: 'vanilla',
      curvedLift: true,
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, [...NO_INVERSIONS, ...NO_STEEP, 'splash', ...NO_HELIX]),
    trackGroups: ['straight', 'stationEnd', 'liftHill', 'slope', 'sBend', 'curveSmall', 'curveLarge', 'brakes', 'onridePhoto'],
    uniqueSpecials: ['curvedLift', 'lowHeight'],
    liftStyle: 'curved',
    trackStyle: 'juniorTubular',
    trainStyle: 'junior',
    notes: '25° only, no inversions, curved lift, low height limit.', // i18n-ignore developer note, never displayed
  },
  steelWildMouse: {
    id: 'steelWildMouse',
    name: de('Wilde Maus (Stahl)'),
    playable: true,
    capabilities: vanillaCaps({
      banking: false,
      slopeCurveBanked: false,
      inversions: 'none',
      oneTileTurns: true,
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, [
      ...NO_INVERSIONS,
      ...NO_BANKING,
      ...ONLY_ONE_TILE_TURNS,
      'splash',
      'sBendLeft',
      'sBendRight',
      ...NO_HELIX,
    ]),
    trackGroups: [
      'straight',
      'stationEnd',
      'liftHill',
      'slope',
      'slopeSteepUp',
      'slopeSteepDown',
      'curveVerySmall',
      'brakes',
      'onridePhoto',
    ],
    uniqueSpecials: ['oneTileTurns', 'carsNotTrains', 'noBanking'],
    liftStyle: 'chain',
    trackStyle: 'wildMouse',
    trainStyle: 'mouse',
    notes: 'No banking. 1-tile turns. Individual cars, not trains.', // i18n-ignore developer note, never displayed
  },
  woodenWildMouse: {
    id: 'woodenWildMouse',
    name: de('Wilde Maus (Holz)'),
    playable: true,
    capabilities: vanillaCaps({
      banking: false,
      slopeCurveBanked: false,
      inversions: 'none',
      oneTileTurns: true,
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, [
      ...NO_INVERSIONS,
      ...NO_BANKING,
      ...ONLY_ONE_TILE_TURNS,
      'splash',
      'brakes',
      'sBendLeft',
      'sBendRight',
      ...NO_HELIX,
    ]),
    trackGroups: ['straight', 'stationEnd', 'liftHill', 'slope', 'slopeSteepUp', 'slopeSteepDown', 'curveVerySmall', 'onridePhoto'],
    uniqueSpecials: ['oneTileTurns', 'noBrakesGroup', 'circuitOnly'],
    liftStyle: 'chain',
    trackStyle: 'woodenMouse',
    trainStyle: 'mouse',
    notes: 'No brakes track group. Circuit only. No banking.', // i18n-ignore developer note, never displayed
  },
  mineTrain: {
    id: 'mineTrain',
    name: de('Minenachterbahn'),
    playable: true,
    capabilities: vanillaCaps({
      inversions: 'none',
      slopeCurveBanked: false,
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, [...NO_INVERSIONS, 'splash']),
    trackGroups: [
      'straight',
      'stationEnd',
      'liftHill',
      'slope',
      'slopeSteepUp',
      'slopeSteepDown',
      'slopeCurve',
      'sBend',
      'curveSmall',
      'curveLarge',
      'helix',
      'brakes',
      'onridePhoto',
    ],
    uniqueSpecials: ['bankingWithoutSlopeCurveBanked'],
    liftStyle: 'chain',
    trackStyle: 'wooden',
    trainStyle: 'mine',
    notes: 'Banking allowed, but no slopeCurveBanked group. No inversions. Helix is placeable.', // i18n-ignore developer note, never displayed
  },
  bobsled: {
    id: 'bobsled',
    name: de('Bobbahn'),
    playable: true,
    capabilities: vanillaCaps({
      steep: false,
      inversions: 'none',
      flatToSteep: false,
      slopeCurveBanked: false,
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, [
      ...NO_INVERSIONS,
      ...NO_STEEP,
      ...NO_LARGE_CURVES,
      'splash',
      ...NO_HELIX,
    ]),
    trackGroups: ['straight', 'stationEnd', 'liftHill', 'slope', 'sBend', 'curveSmall', 'brakes', 'onridePhoto'],
    uniqueSpecials: ['troughBanking', 'noLargeOrSlopedCurves'],
    liftStyle: 'chain',
    trackStyle: 'bobsledTrough',
    trainStyle: 'bobsled',
    notes: '25° only. Trough-style banking. No large or sloped curves.', // i18n-ignore developer note, never displayed
  },
  suspendedSwinging: {
    id: 'suspendedSwinging',
    name: de('Hängende Schaukelachterbahn'),
    playable: true,
    capabilities: vanillaCaps({
      banking: false,
      slopeCurveBanked: false,
      inversions: 'none',
    }),
    headlinerPieces: withoutPieces(ALL_HEADLINER_PIECES, [...NO_INVERSIONS, ...NO_BANKING, 'splash']),
    trackGroups: [
      'straight',
      'stationEnd',
      'liftHill',
      'slope',
      'slopeSteepUp',
      'slopeSteepDown',
      'slopeCurve',
      'sBend',
      'curveSmall',
      'curveLarge',
      'helix',
      'brakes',
      'onridePhoto',
    ],
    uniqueSpecials: ['noRollBanking', 'unbankedHelix', 'swingingCars'],
    liftStyle: 'chain',
    trackStyle: 'suspendedSpine',
    trainStyle: 'swinging',
    notes: 'No roll banking. Unbanked helix. Swinging cars. Vehicle flags also forbid banked track.', // i18n-ignore developer note, never displayed
  },
}

export const PLAYABLE_COASTER_TYPE_IDS: readonly CoasterTypeId[] = Object.keys(COASTER_TYPES) as CoasterTypeId[]

export function isCoasterCatalogTypeId(value: string): value is CoasterCatalogTypeId {
  return (COASTER_CATALOG_TYPE_IDS as readonly string[]).includes(value)
}

export function getCoasterCatalogEntry(typeId: CoasterCatalogTypeId): CoasterCatalogEntry {
  return COASTER_CATALOG[typeId]
}

export function resolveCoasterEditorMode(typeId: string): TrackEditorMode {
  if (!isCoasterCatalogTypeId(typeId)) return 'palette'
  return resolveTrackEditorMode(COASTER_CATALOG[typeId].editorMode)
}

export function listPlayableCoasterCatalogTypes(): CoasterCatalogEntry[] {
  return COASTER_CATALOG_TYPE_IDS.map((id) => COASTER_CATALOG[id]).filter((entry) => entry.playable)
}

export type CoasterVehiclePreview = {
  typeId: CoasterTypeId
  trainStyle: CoasterTrainStyleId
  carColor: number
  accentColor: number
}

/** Catalog tile / thumbnail spec: the in-world train family for this type. */
export function coasterVehiclePreview(typeId: string): CoasterVehiclePreview {
  const type = getCoasterType(typeId)
  return {
    typeId: type.id,
    trainStyle: type.trainStyle,
    carColor: type.carColor,
    accentColor: type.accentColor,
  }
}

export function resolveSupportedTrackPieces(typeId: string): readonly TrackPieceKind[] {
  if (typeId in COASTER_TYPES) {
    return COASTER_TYPES[typeId as CoasterTypeId].supportedPieces
  }
  if (isCoasterCatalogTypeId(typeId)) {
    return COASTER_CATALOG[typeId].headlinerPieces
  }
  return []
}

export function catalogAllowsTrackPiece(typeId: string, kind: TrackPieceKind): boolean {
  return resolveSupportedTrackPieces(typeId).includes(kind)
}

/** Floorless is a Twister vehicle, not its own ride-type row. */
export const FLOORLESS_IS_TWISTER_VEHICLE = true

/** Shared TrackElemType with tiny groups — not Headliner coaster types. */
export const NON_COASTER_TRACK_RIDES = ['goKarts', 'miniRailway'] as const
