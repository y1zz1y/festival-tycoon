import { SIMULATION_CONFIG } from './simulationConfig'

export const TRACK_PIECE_KINDS = [
  'station',
  'straight',
  'slopeGentleUp',
  'slopeUp',
  'slopeGentleDown',
  'slopeDown',
  'pitchTransition',
  'bankTransition',
  'curveLeft1',
  'curveRight1',
  'curveLeft2',
  'curveRight2',
  'curveLeft3',
  'curveRight3',
  'curveLeft4',
  'curveRight4',
  'sBendLeft', 'sBendRight', 'verticalLoop', 'halfLoopUp', 'halfLoopDown', 'photo', 'splash', 'brakes',
  'helixLeft', 'helixRight',
] as const

export type TrackPieceKind = (typeof TRACK_PIECE_KINDS)[number]
export const COASTER_TYPE_IDS = [
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
export type CoasterTypeId = (typeof COASTER_TYPE_IDS)[number]
export type DispatchMode = 'full-or-timed' | 'full-only' | 'timed'
export type CoasterOperationMode = 'closed' | 'open' | 'test'

export type TrackAnchor = {
  x: number
  z: number
  elevation: number
  heading: number
  pitch: number
  bank: number
}

export type TrackPoint = {
  frameHeading?: number
  x: number
  y: number
  z: number
  pitch?: number
  bank?: number
}

export type TrackPiece = {
  id: string
  kind: TrackPieceKind
  start: TrackAnchor
  end: TrackAnchor
  points: TrackPoint[]
  chainLift: boolean
  transition?: 'pitch' | 'bank'
}

export type CoasterTrain = {
  photoPieces?: string[]
  state: 'boarding' | 'running' | 'unloading'
  cars: number
  passengers: number
  passengerIds: string[]
  capacity: number
  waitMinutes: number
  boardingProgress: number
  progress: number
  distance: number
  /** Physical velocity in metres per second. */
  speed: number
  x: number
  y: number
  z: number
}

export type CoasterTelemetrySample = {
  distance: number
  speedKmh: number
  verticalG: number
  lateralG: number
  longitudinalG: number
}

export type CoasterTelemetry = {
  samples: CoasterTelemetrySample[]
  durationSeconds: number
  airtimeSeconds: number
  maxSpeedKmh: number
  minVerticalG: number
  maxVerticalG: number
  maxAbsLateralG: number
  maxAbsLongitudinalG: number
  completedRuns: number
  measuring: boolean
  cumulativeDistanceMeters: number
}

export function createCoasterTelemetry(completedRuns = 0): CoasterTelemetry {
  return {
    samples: [],
    durationSeconds: 0,
    airtimeSeconds: 0,
    maxSpeedKmh: 0,
    minVerticalG: Number.POSITIVE_INFINITY,
    maxVerticalG: Number.NEGATIVE_INFINITY,
    maxAbsLateralG: 0,
    maxAbsLongitudinalG: 0,
    completedRuns,
    measuring: false,
    cumulativeDistanceMeters: 0,
  }
}

export type Coaster = {
  id: string
  typeId: CoasterTypeId
  name: string
  pieces: TrackPiece[]
  entrance: TrackPoint | null
  exit: TrackPoint | null
  settings: {
    dispatchMode: DispatchMode
    dispatchIntervalMinutes: number
  }
  operationMode: CoasterOperationMode
  ticketPrice: number
  train: CoasterTrain
  telemetry: CoasterTelemetry
  queue: string[]
  closed: boolean
}

export type TrackPieceDefinition = {
  kind: TrackPieceKind
  name: string
  cost: number
  radius?: number
  turn?: -1 | 1
  targetPitch?: number
  chainAllowed?: boolean
  station?: boolean
  special?: boolean
}

export type TrackBuildOptions = {
  targetPitch?: number
  targetBank?: number
}

export const TRACK_PITCHES = {
  steepDown: -Math.PI / 4,
  gentleDown: -Math.atan(0.5),
  flat: 0,
  gentleUp: Math.atan(0.5),
  steepUp: Math.PI / 4,
} as const

export const TRACK_BANK_ANGLE = (35 * Math.PI) / 180

const PITCH_LEVELS = [
  TRACK_PITCHES.steepDown,
  TRACK_PITCHES.gentleDown,
  TRACK_PITCHES.flat,
  TRACK_PITCHES.gentleUp,
  TRACK_PITCHES.steepUp,
] as const

export function trackPitchLevelIndex(pitch: number): number {
  return PITCH_LEVELS.findIndex((level) => Math.abs(level - pitch) < 0.001)
}

export function isFlatTrackPitch(pitch: number): boolean {
  return Math.abs(pitch) < 0.001
}

export function isSteepTrackPitch(pitch: number): boolean {
  return Math.abs(Math.abs(pitch) - TRACK_PITCHES.steepUp) < 0.001
}

/** Large 4-tile clothoid only when skipping the gentle step: flat ↔ steep. */
export function usesWidePitchTransition(from: number, to: number): boolean {
  return (
    (isFlatTrackPitch(from) && isSteepTrackPitch(to)) ||
    (isSteepTrackPitch(from) && isFlatTrackPitch(to))
  )
}

export function canTransitionTrackPitch(from: number, to: number): boolean {
  if (Math.abs(from - to) < 0.001) return true
  const startLevel = trackPitchLevelIndex(from)
  const targetLevel = trackPitchLevelIndex(to)
  if (startLevel < 0 || targetLevel < 0) {
    return Math.abs(from - to) <= Math.atan(0.5) + 0.001
  }
  const span = Math.abs(startLevel - targetLevel)
  return span <= 1 || usesWidePitchTransition(from, to)
}

function snapTrackRise(value: number): number {
  return Math.round(value * 2) / 2
}

export type CoasterLiftStyle = 'chain' | 'cable' | 'powered' | 'curved' | 'none'

export type CoasterTrackStyleId =
  | 'steelLattice'
  | 'wooden'
  | 'boxSpine'
  | 'invertedBox'
  | 'flyingSpine'
  | 'juniorTubular'
  | 'wildMouse'
  | 'woodenMouse'
  | 'bobsledTrough'
  | 'suspendedSpine'
  | 'gigaLattice'
  | 'launchedSteel'

export type CoasterTrainStyleId =
  | 'sitDownSteel'
  | 'wooden'
  | 'bmSitdown'
  | 'invertV'
  | 'flying'
  | 'standUp'
  | 'junior'
  | 'mouse'
  | 'bobsled'
  | 'mine'
  | 'swinging'
  | 'launched'
  | 'giga'

export type CoasterTypeDefinition = {
  id: CoasterTypeId
  name: string
  color: number
  railColor: number
  carColor: number
  accentColor: number
  carCapacity: number
  defaultTicketPrice: number
  liftStyle: CoasterLiftStyle
  trackStyle: CoasterTrackStyleId
  trainStyle: CoasterTrainStyleId
  physics: {
    worldUnitMeters: number
    carMassKg: number
    passengerMassKg: number
    rollingResistance: number
    dragArea: number
    stationLaunchSpeed: number
    stationDriveSpeed: number
    chainSpeed: number
    carSpacing: number
  }
  supportedPieces: TrackPieceKind[]
}

export const TRACK_PIECES: Record<TrackPieceKind, TrackPieceDefinition> = {
  sBendLeft: { kind: 'sBendLeft', name: 'S-Kurve links', cost: 240, special: true },
  sBendRight: { kind: 'sBendRight', name: 'S-Kurve rechts', cost: 240, special: true },
  verticalLoop: { kind: 'verticalLoop', name: 'Vertikaler Looping', cost: 900, special: true },
  halfLoopUp: { kind: 'halfLoopUp', name: 'Halber Looping aufwärts', cost: 550, special: true },
  halfLoopDown: { kind: 'halfLoopDown', name: 'Halber Looping abwärts', cost: 550, special: true },
  photo: { kind: 'photo', name: 'Fotostation', cost: 280, special: true },
  splash: { kind: 'splash', name: 'Wassersplash', cost: 450, special: true },
  brakes: { kind: 'brakes', name: 'Bremsstrecke', cost: 150, special: true },
  helixLeft: { kind: 'helixLeft', name: 'Helix links', cost: SIMULATION_CONFIG.coasters.trackPieceCosts.helixLeft, special: true },
  helixRight: { kind: 'helixRight', name: 'Helix rechts', cost: SIMULATION_CONFIG.coasters.trackPieceCosts.helixRight, special: true },
  station: { kind: 'station', name: 'Stationsplattform', cost: SIMULATION_CONFIG.coasters.trackPieceCosts.station, station: true },
  straight: { kind: 'straight', name: 'Gerade', cost: SIMULATION_CONFIG.coasters.trackPieceCosts.straight },
  slopeGentleUp: {
    kind: 'slopeGentleUp',
    name: 'Sanfte Steigung',
    cost: SIMULATION_CONFIG.coasters.trackPieceCosts.slopeGentleUp,
    targetPitch: TRACK_PITCHES.gentleUp,
    chainAllowed: true,
  },
  slopeUp: {
    kind: 'slopeUp',
    name: 'Steile Steigung',
    cost: SIMULATION_CONFIG.coasters.trackPieceCosts.slopeUp,
    targetPitch: TRACK_PITCHES.steepUp,
    chainAllowed: true,
  },
  slopeGentleDown: {
    kind: 'slopeGentleDown',
    name: 'Sanftes Gefälle',
    cost: SIMULATION_CONFIG.coasters.trackPieceCosts.slopeGentleDown,
    targetPitch: TRACK_PITCHES.gentleDown,
  },
  slopeDown: {
    kind: 'slopeDown',
    name: 'Steiles Gefälle',
    cost: SIMULATION_CONFIG.coasters.trackPieceCosts.slopeDown,
    targetPitch: TRACK_PITCHES.steepDown,
  },
  pitchTransition: {
    kind: 'pitchTransition',
    name: 'Höhenübergang',
    cost: SIMULATION_CONFIG.coasters.trackPieceCosts.pitchTransition,
    chainAllowed: true,
  },
  bankTransition: {
    kind: 'bankTransition',
    name: 'Neigungsübergang',
    cost: SIMULATION_CONFIG.coasters.trackPieceCosts.bankTransition,
  },
  curveLeft1: { kind: 'curveLeft1', name: 'Kurve links 1×1', cost: SIMULATION_CONFIG.coasters.trackPieceCosts.curveLeft1, radius: 1, turn: -1 },
  curveRight1: {
    kind: 'curveRight1',
    name: 'Kurve rechts 1×1',
    cost: SIMULATION_CONFIG.coasters.trackPieceCosts.curveRight1,
    radius: 1,
    turn: 1,
  },
  curveLeft2: { kind: 'curveLeft2', name: 'Kurve links 2×2', cost: SIMULATION_CONFIG.coasters.trackPieceCosts.curveLeft2, radius: 2, turn: -1 },
  curveRight2: {
    kind: 'curveRight2',
    name: 'Kurve rechts 2×2',
    cost: SIMULATION_CONFIG.coasters.trackPieceCosts.curveRight2,
    radius: 2,
    turn: 1,
  },
  curveLeft3: { kind: 'curveLeft3', name: 'Kurve links 3×3', cost: SIMULATION_CONFIG.coasters.trackPieceCosts.curveLeft3, radius: 3, turn: -1 },
  curveRight3: {
    kind: 'curveRight3',
    name: 'Kurve rechts 3×3',
    cost: SIMULATION_CONFIG.coasters.trackPieceCosts.curveRight3,
    radius: 3,
    turn: 1,
  },
  curveLeft4: { kind: 'curveLeft4', name: 'Kurve links 4×4', cost: SIMULATION_CONFIG.coasters.trackPieceCosts.curveLeft4, radius: 4, turn: -1 },
  curveRight4: {
    kind: 'curveRight4',
    name: 'Kurve rechts 4×4',
    cost: SIMULATION_CONFIG.coasters.trackPieceCosts.curveRight4,
    radius: 4,
    turn: 1,
  },
}

const DEFAULT_COASTER_STATS = SIMULATION_CONFIG.coasters.classicSteel

function withoutPieces(
  pieces: readonly TrackPieceKind[],
  excluded: readonly TrackPieceKind[],
): TrackPieceKind[] {
  const skip = new Set(excluded)
  return pieces.filter((kind) => !skip.has(kind))
}

const NO_INVERSIONS = ['verticalLoop', 'halfLoopUp', 'halfLoopDown'] as const
const NO_BANKING = ['bankTransition'] as const
const NO_STEEP = ['slopeUp', 'slopeDown'] as const
const NO_HELIX = ['helixLeft', 'helixRight'] as const
const NO_ONE_TILE_TURNS = ['curveLeft1', 'curveRight1'] as const
const ONLY_ONE_TILE_TURNS = [
  'curveLeft2',
  'curveRight2',
  'curveLeft3',
  'curveRight3',
  'curveLeft4',
  'curveRight4',
] as const
const NO_LARGE_CURVES = ['curveLeft3', 'curveRight3', 'curveLeft4', 'curveRight4'] as const

function defineCoasterType(
  id: CoasterTypeId,
  name: string,
  colors: { color: number; railColor: number; carColor: number; accentColor: number },
  extras: {
    supportedPieces: TrackPieceKind[]
    liftStyle: CoasterLiftStyle
    trackStyle: CoasterTrackStyleId
    trainStyle: CoasterTrainStyleId
    carCapacity?: number
    defaultTicketPrice?: number
    physics?: Partial<CoasterTypeDefinition['physics']>
  },
): CoasterTypeDefinition {
  return {
    id,
    name,
    color: colors.color,
    railColor: colors.railColor,
    carColor: colors.carColor,
    accentColor: colors.accentColor,
    carCapacity: extras.carCapacity ?? DEFAULT_COASTER_STATS.carCapacity,
    defaultTicketPrice: extras.defaultTicketPrice ?? DEFAULT_COASTER_STATS.defaultTicketPrice,
    liftStyle: extras.liftStyle,
    trackStyle: extras.trackStyle,
    trainStyle: extras.trainStyle,
    physics: { ...DEFAULT_COASTER_STATS.physics, ...extras.physics },
    supportedPieces: extras.supportedPieces,
  }
}

export const COASTER_TYPES: Record<CoasterTypeId, CoasterTypeDefinition> = {
  classicSteel: defineCoasterType(
    'classicSteel',
    'Klassische Stahlachterbahn',
    { color: 0xd53945, railColor: 0xf2d35c, carColor: 0x2876c7, accentColor: 0xe8c45a },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, NO_HELIX),
      liftStyle: 'chain',
      trackStyle: 'steelLattice',
      trainStyle: 'sitDownSteel',
    },
  ),
  wooden: defineCoasterType(
    'wooden',
    'Holzachterbahn',
    { color: 0x8b5a2b, railColor: 0xd4a574, carColor: 0xc45c26, accentColor: 0xf0d090 },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, ['halfLoopUp', 'halfLoopDown', ...NO_ONE_TILE_TURNS, ...NO_HELIX]),
      liftStyle: 'chain',
      trackStyle: 'wooden',
      trainStyle: 'wooden',
    },
  ),
  looping: defineCoasterType(
    'looping',
    'Looping-Stahlachterbahn',
    { color: 0x2f6fed, railColor: 0xf4f0e6, carColor: 0x1d4ed8, accentColor: 0xfbbf24 },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, ['splash', ...NO_HELIX]),
      liftStyle: 'chain',
      trackStyle: 'steelLattice',
      trainStyle: 'sitDownSteel',
    },
  ),
  corkscrew: defineCoasterType(
    'corkscrew',
    'Corkscrew',
    { color: 0x0f766e, railColor: 0x99f6e4, carColor: 0x115e59, accentColor: 0xf59e0b },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, ['splash', ...NO_HELIX]),
      liftStyle: 'chain',
      trackStyle: 'steelLattice',
      trainStyle: 'sitDownSteel',
    },
  ),
  hyper: defineCoasterType(
    'hyper',
    'Hyperachterbahn',
    { color: 0x1e3a5f, railColor: 0xe2e8f0, carColor: 0x0ea5e9, accentColor: 0xf97316 },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, [...NO_INVERSIONS, 'splash', ...NO_HELIX]),
      liftStyle: 'chain',
      trackStyle: 'gigaLattice',
      trainStyle: 'sitDownSteel',
      physics: { dragArea: 0.49, carMassKg: 520 },
    },
  ),
  twister: defineCoasterType(
    'twister',
    'Twister (B&M)',
    { color: 0x4c1d95, railColor: 0xc4b5fd, carColor: 0x6d28d9, accentColor: 0xfde68a },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, ['splash']),
      liftStyle: 'chain',
      trackStyle: 'boxSpine',
      trainStyle: 'bmSitdown',
    },
  ),
  hyperTwister: defineCoasterType(
    'hyperTwister',
    'Hyper-Twister',
    { color: 0x1e1b4b, railColor: 0xa5b4fc, carColor: 0x4338ca, accentColor: 0xfda4af },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, [...NO_INVERSIONS, 'splash']),
      liftStyle: 'chain',
      trackStyle: 'boxSpine',
      trainStyle: 'bmSitdown',
    },
  ),
  verticalDrop: defineCoasterType(
    'verticalDrop',
    'Vertical Drop',
    { color: 0x3f3f46, railColor: 0xfafafa, carColor: 0x18181b, accentColor: 0xef4444 },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, [...NO_INVERSIONS, 'splash', ...NO_HELIX]),
      liftStyle: 'chain',
      trackStyle: 'gigaLattice',
      trainStyle: 'giga',
    },
  ),
  giga: defineCoasterType(
    'giga',
    'Giga-Coaster',
    { color: 0x0c4a6e, railColor: 0xe0f2fe, carColor: 0x0369a1, accentColor: 0xfbbf24 },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, [...NO_INVERSIONS, 'splash', ...NO_HELIX]),
      liftStyle: 'cable',
      trackStyle: 'gigaLattice',
      trainStyle: 'giga',
      physics: { dragArea: 0.45, carMassKg: 560, chainSpeed: 11.5 },
    },
  ),
  lsmLaunched: defineCoasterType(
    'lsmLaunched',
    'LSM-Abschussachterbahn',
    { color: 0x7c2d12, railColor: 0xfed7aa, carColor: 0xea580c, accentColor: 0x1e293b },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, ['splash', ...NO_HELIX]),
      liftStyle: 'powered',
      trackStyle: 'launchedSteel',
      trainStyle: 'launched',
      physics: { stationLaunchSpeed: 28.8 },
    },
  ),
  limLaunched: defineCoasterType(
    'limLaunched',
    'LIM-Abschussachterbahn',
    { color: 0x14532d, railColor: 0xbbf7d0, carColor: 0x16a34a, accentColor: 0x0f172a },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, ['splash', ...NO_HELIX]),
      liftStyle: 'none',
      trackStyle: 'launchedSteel',
      trainStyle: 'launched',
      physics: { stationLaunchSpeed: 32 },
    },
  ),
  inverted: defineCoasterType(
    'inverted',
    'Inverted',
    { color: 0x1f2937, railColor: 0x94a3b8, carColor: 0x334155, accentColor: 0xf43f5e },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, ['splash']),
      liftStyle: 'chain',
      trackStyle: 'invertedBox',
      trainStyle: 'invertV',
    },
  ),
  compactInverted: defineCoasterType(
    'compactInverted',
    'Kompakte Inverted',
    { color: 0x111827, railColor: 0xcbd5e1, carColor: 0x1e293b, accentColor: 0x22d3ee },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, ['splash']),
      liftStyle: 'chain',
      trackStyle: 'invertedBox',
      trainStyle: 'invertV',
    },
  ),
  flying: defineCoasterType(
    'flying',
    'Flying Coaster',
    { color: 0x312e81, railColor: 0xc7d2fe, carColor: 0x4f46e5, accentColor: 0xf472b6 },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, ['splash']),
      liftStyle: 'chain',
      trackStyle: 'flyingSpine',
      trainStyle: 'flying',
    },
  ),
  standUp: defineCoasterType(
    'standUp',
    'Stehende Achterbahn',
    { color: 0x7f1d1d, railColor: 0xfecaca, carColor: 0xb91c1c, accentColor: 0xfacc15 },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, ['splash', ...NO_HELIX]),
      liftStyle: 'chain',
      trackStyle: 'steelLattice',
      trainStyle: 'standUp',
    },
  ),
  junior: defineCoasterType(
    'junior',
    'Juniorachterbahn',
    { color: 0x166534, railColor: 0x86efac, carColor: 0x22c55e, accentColor: 0xfde047 },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, [...NO_INVERSIONS, ...NO_STEEP, 'splash', ...NO_HELIX]),
      liftStyle: 'curved',
      trackStyle: 'juniorTubular',
      trainStyle: 'junior',
      carCapacity: 2,
      defaultTicketPrice: 12,
    },
  ),
  steelWildMouse: defineCoasterType(
    'steelWildMouse',
    'Wilde Maus (Stahl)',
    { color: 0xa16207, railColor: 0xfde68a, carColor: 0xf59e0b, accentColor: 0x1f2937 },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, [
        ...NO_INVERSIONS,
        ...NO_BANKING,
        ...ONLY_ONE_TILE_TURNS,
        'splash',
        'sBendLeft',
        'sBendRight',
        ...NO_HELIX,
      ]),
      liftStyle: 'chain',
      trackStyle: 'wildMouse',
      trainStyle: 'mouse',
      carCapacity: 2,
      physics: { carSpacing: 0.42, carMassKg: 220, dragArea: 0.28 },
    },
  ),
  woodenWildMouse: defineCoasterType(
    'woodenWildMouse',
    'Wilde Maus (Holz)',
    { color: 0x78350f, railColor: 0xfbbf24, carColor: 0xb45309, accentColor: 0x44403c },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, [
        ...NO_INVERSIONS,
        ...NO_BANKING,
        ...ONLY_ONE_TILE_TURNS,
        'splash',
        'brakes',
        'sBendLeft',
        'sBendRight',
        ...NO_HELIX,
      ]),
      liftStyle: 'chain',
      trackStyle: 'woodenMouse',
      trainStyle: 'mouse',
      carCapacity: 2,
      physics: { carSpacing: 0.42, carMassKg: 200, dragArea: 0.30 },
    },
  ),
  mineTrain: defineCoasterType(
    'mineTrain',
    'Minenachterbahn',
    { color: 0x5b3a1a, railColor: 0xc4a574, carColor: 0x7c2d12, accentColor: 0xd6d3d1 },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, [...NO_INVERSIONS, 'splash']),
      liftStyle: 'chain',
      trackStyle: 'wooden',
      trainStyle: 'mine',
    },
  ),
  bobsled: defineCoasterType(
    'bobsled',
    'Bobbahn',
    { color: 0x1e3a8a, railColor: 0x93c5fd, carColor: 0x1d4ed8, accentColor: 0xf8fafc },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, [
        ...NO_INVERSIONS,
        ...NO_STEEP,
        ...NO_LARGE_CURVES,
        'splash',
        ...NO_HELIX,
      ]),
      liftStyle: 'chain',
      trackStyle: 'bobsledTrough',
      trainStyle: 'bobsled',
      carCapacity: 2,
    },
  ),
  suspendedSwinging: defineCoasterType(
    'suspendedSwinging',
    'Hängende Schaukelachterbahn',
    { color: 0x365314, railColor: 0xa3e635, carColor: 0x3f6212, accentColor: 0xfef08a },
    {
      supportedPieces: withoutPieces(TRACK_PIECE_KINDS, [...NO_INVERSIONS, ...NO_BANKING, 'splash']),
      liftStyle: 'chain',
      trackStyle: 'suspendedSpine',
      trainStyle: 'swinging',
    },
  ),
}

export function isCoasterTypeId(value: string | undefined | null): value is CoasterTypeId {
  return Boolean(value && value in COASTER_TYPES)
}

export function resolveCoasterTypeId(value: string | undefined | null): CoasterTypeId {
  return isCoasterTypeId(value) ? value : 'classicSteel'
}

export function getCoasterType(typeId: string | undefined | null): CoasterTypeDefinition {
  return COASTER_TYPES[resolveCoasterTypeId(typeId)]
}

const HEADINGS = [
  { x: 0, z: 1 },
  { x: 1, z: 0 },
  { x: 0, z: -1 },
  { x: -1, z: 0 },
]

export function createTrackPiece(
  id: string,
  kind: TrackPieceKind,
  start: TrackAnchor,
  chainLift: boolean,
  options: TrackBuildOptions = {},
): TrackPiece {
  const definition = TRACK_PIECES[kind]
  const forward = HEADINGS[start.heading] ?? HEADINGS[0]!
  const normalizedStart: TrackAnchor = {
    ...start,
    pitch: start.pitch ?? 0,
    bank: start.bank ?? 0,
  }
  if (definition.special) return createSpecialTrack(id, kind, normalizedStart)
  const targetPitch =
    kind === 'pitchTransition'
      ? options.targetPitch ?? normalizedStart.pitch
      : definition.targetPitch ?? normalizedStart.pitch
  const targetBank =
    kind === 'bankTransition'
      ? options.targetBank ?? normalizedStart.bank
      : normalizedStart.bank
  const transition =
    kind === 'pitchTransition' ? 'pitch' : kind === 'bankTransition' ? 'bank' : undefined

  if (definition.radius && definition.turn) {
    const side =
      definition.turn === 1
        ? { x: -forward.z, z: forward.x }
        : { x: forward.z, z: -forward.x }
    const radius = definition.radius
    const end: TrackAnchor = {
      x: start.x + forward.x * radius + side.x * radius,
      z: start.z + forward.z * radius + side.z * radius,
      elevation: normalizedStart.elevation,
      heading: (start.heading - definition.turn + 4) % 4,
      pitch: normalizedStart.pitch,
      bank: normalizedStart.bank,
    }
    const control = {
      x: start.x + forward.x * radius,
      z: start.z + forward.z * radius,
    }
    const points: TrackPoint[] = []
    const samples = Math.max(12, radius * 10)
    let elevation = normalizedStart.elevation
    let previousX = normalizedStart.x
    let previousZ = normalizedStart.z
    for (let index = 0; index <= samples; index += 1) {
      const t = index / samples
      const inverse = 1 - t
      const x =
        inverse * inverse * normalizedStart.x +
        2 * inverse * t * control.x +
        t * t * end.x
      const z =
        inverse * inverse * normalizedStart.z +
        2 * inverse * t * control.z +
        t * t * end.z
      if (index > 0) {
        elevation += Math.hypot(x - previousX, z - previousZ) * Math.tan(normalizedStart.pitch)
      }
      points.push({
        x,
        y: elevation,
        z,
        pitch: normalizedStart.pitch,
        bank: normalizedStart.bank,
      })
      previousX = x
      previousZ = z
    }
    end.elevation = normalizedStart.elevation + Math.round(elevation - normalizedStart.elevation)
    const correction = end.elevation - elevation
    points.forEach((point, index) => { point.y += correction * smoothStep(index / samples) })
    return {
      id,
      kind,
      start: normalizedStart,
      end,
      points,
      chainLift: false,
    }
  }

  const length =
    transition === 'pitch' && usesWidePitchTransition(normalizedStart.pitch, targetPitch)
      ? 4
      : 1
  const rise = snapTrackRise(
    length *
      (transition === 'pitch'
        ? (Math.tan(normalizedStart.pitch) + Math.tan(targetPitch)) / 2
        : Math.tan(targetPitch)),
  )
  const samples = 16
  const points: TrackPoint[] = []
  let elevation = normalizedStart.elevation
  let previousT = 0
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples
    const eased = transition ? smoothStep(t) : t
    const pitch =
      transition === 'pitch'
        ? lerp(normalizedStart.pitch, targetPitch, eased)
        : targetPitch
    const bank =
      transition === 'bank'
        ? lerp(normalizedStart.bank, targetBank, eased)
        : targetBank
    if (index > 0) {
      const middleT = (previousT + t) / 2
      const middleEased = transition ? smoothStep(middleT) : middleT
      const middlePitch =
        transition === 'pitch'
          ? lerp(normalizedStart.pitch, targetPitch, middleEased)
          : targetPitch
      elevation += (t - previousT) * Math.tan(middlePitch)
    }
    // 1-tile pitch changes stay linear so they climb immediately instead of
    // sagging into the ground. Wide flat↔steep clothoids keep the hermite.
    const startSlope = length * Math.tan(transition === 'pitch' ? normalizedStart.pitch : targetPitch)
    const endSlope = length * Math.tan(targetPitch)
    const hermiteY =
      (t * t * t - 2 * t * t + t) * startSlope +
      (-2 * t * t * t + 3 * t * t) * rise +
      (t * t * t - t * t) * endSlope
    const linearY = t * rise
    const rawY = transition === 'pitch' && length === 1 ? linearY : hermiteY
    const offsetY = rise >= 0 ? Math.max(linearY * 0.35, rawY) : Math.min(linearY * 0.35, rawY)
    points.push({
      x: normalizedStart.x + forward.x * t * length,
      y: normalizedStart.elevation + offsetY,
      z: normalizedStart.z + forward.z * t * length,
      pitch,
      bank,
    })
    previousT = t
  }
  const end: TrackAnchor = {
    x: normalizedStart.x + forward.x * length,
    z: normalizedStart.z + forward.z * length,
    elevation: normalizedStart.elevation + rise,
    heading: normalizedStart.heading,
    pitch: targetPitch,
    bank: targetBank,
  }
  const lastPoint = points.at(-1)
  if (lastPoint) lastPoint.y = end.elevation
  return {
    id,
    kind,
    start: normalizedStart,
    end,
    points,
    chainLift: Boolean(chainLift && definition.chainAllowed),
    transition,
  }
}

function createHelixTrack(id: string, kind: 'helixLeft' | 'helixRight', start: TrackAnchor): TrackPiece {
  const forward = HEADINGS[start.heading] ?? HEADINGS[0]!
  const turn: -1 | 1 = kind === 'helixLeft' ? -1 : 1
  const side = turn === 1 ? { x: -forward.z, z: forward.x } : { x: forward.z, z: -forward.x }
  const radius = 1.5
  const rise = 1
  const samples = 48
  const center = {
    x: start.x + forward.x * radius + side.x * radius,
    z: start.z + forward.z * radius + side.z * radius,
  }
  const fromX = start.x - center.x
  const fromZ = start.z - center.z
  const points: TrackPoint[] = []
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples
    const angle = turn * t * Math.PI * 2
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    points.push({
      x: center.x + fromX * cosine - fromZ * sine,
      y: start.elevation + t * rise,
      z: center.z + fromX * sine + fromZ * cosine,
      pitch: Math.atan(rise / (2 * Math.PI * radius)),
      bank: 0,
    })
  }
  const last = points.at(-1)!
  last.x = start.x
  last.y = start.elevation + rise
  last.z = start.z
  last.pitch = 0
  return {
    id,
    kind,
    start: { ...start },
    end: {
      x: start.x,
      z: start.z,
      elevation: start.elevation + rise,
      heading: start.heading,
      pitch: 0,
      bank: 0,
    },
    points,
    chainLift: false,
  }
}

function createSpecialTrack(id: string, kind: TrackPieceKind, start: TrackAnchor): TrackPiece {
  if (kind === 'helixLeft' || kind === 'helixRight') return createHelixTrack(id, kind, start)
  const forward = HEADINGS[start.heading]!, side = { x: forward.z, z: -forward.x }
  const points: TrackPoint[] = [], looping = kind === 'verticalLoop' || kind === 'halfLoopUp' || kind === 'halfLoopDown'
  const samples = looping ? 64 : 32
  let endHeading = start.heading, endBank = start.bank
  for (let i = 0; i <= samples; i++) {
    const t = i / samples, ease = smoothStep(t)
    let along = (kind === 'splash' ? 4 : kind === 'photo' || kind === 'brakes' ? 2 : 4) * t, lateral = 0, height = 0, pitch = 0, bank = start.bank
    if (kind === 'sBendLeft' || kind === 'sBendRight') lateral = (kind === 'sBendLeft' ? 2 : -2) * ease
    if (looping) {
      const theta = t * (kind === 'verticalLoop' ? Math.PI * 2 : Math.PI), radius = 2
      const down = kind === 'halfLoopDown'
      along = radius * Math.sin(theta) + 2 * ease
      height = (down ? -1 : 1) * radius * (1 - Math.cos(theta))
      pitch = (down ? -1 : 1) * theta
      bank = down ? Math.PI : 0
      if (kind !== 'verticalLoop') { endHeading = (start.heading + 2) % 4; endBank = down ? 0 : Math.PI }
    }
    points.push({ x: start.x + forward.x * along + side.x * lateral, y: start.elevation + height, z: start.z + forward.z * along + side.z * lateral, pitch, bank, ...(looping ? { frameHeading: start.heading } : {}) })
  }
  const last = points.at(-1)!
  // Remove trigonometric residue from construction anchors.
  last.x = Math.round(last.x); last.y = Math.round(last.y); last.z = Math.round(last.z)
  return { id, kind, start: { ...start }, end: { x: last.x, z: last.z, elevation: last.y, heading: endHeading, pitch: 0, bank: endBank }, points, chainLift: false }
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value)
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount
}

export function trackAnchorsAlign(
  left: Pick<TrackAnchor, 'x' | 'z' | 'elevation' | 'heading' | 'pitch' | 'bank'>,
  right: Pick<TrackAnchor, 'x' | 'z' | 'elevation' | 'heading' | 'pitch' | 'bank'>,
): boolean {
  const heading = (value: number) => ((Math.round(value) % 4) + 4) % 4
  return (
    Math.abs(left.x - right.x) < 0.35 &&
    Math.abs(left.z - right.z) < 0.35 &&
    Math.abs(left.elevation - right.elevation) < 0.2 &&
    heading(left.heading) === heading(right.heading) &&
    Math.abs(left.pitch - right.pitch) < 0.035 &&
    Math.abs(left.bank - right.bank) < 0.035
  )
}

export function isCoasterCircuitClosed(coaster: Coaster): boolean {
  if (coaster.pieces.length < 4) return false
  const first = coaster.pieces[0]
  const last = coaster.pieces.at(-1)
  if (!first || !last || !trackAnchorsAlign(last.end, first.start)) return false
  return coaster.pieces.every((piece, index) => {
    if (index === 0) return true
    const previous = coaster.pieces[index - 1]
    return Boolean(previous && trackAnchorsAlign(previous.end, piece.start))
  })
}

export function snapTrackPieceToAnchor(
  piece: TrackPiece,
  target: TrackAnchor,
): void {
  piece.end = { ...target }
  const last = piece.points.at(-1)
  if (!last) return
  last.x = target.x
  last.y = target.elevation
  last.z = target.z
  last.pitch = target.pitch
  last.bank = target.bank
}

export function migrateTrackPiece(piece: TrackPiece): TrackPiece {
  const first = piece.points[0]
  const second = piece.points[1]
  const beforeLast = piece.points.at(-2)
  const last = piece.points.at(-1)
  const inferPitch = (from?: TrackPoint, to?: TrackPoint): number => {
    if (!from || !to) return 0
    return Math.atan2(to.y - from.y, Math.hypot(to.x - from.x, to.z - from.z))
  }
  piece.start.pitch ??= inferPitch(first, second)
  piece.start.bank ??= 0
  piece.end.pitch ??= inferPitch(beforeLast, last)
  piece.end.bank ??= 0
  piece.points.forEach((point, index) => {
    const amount = piece.points.length <= 1 ? 0 : index / (piece.points.length - 1)
    point.pitch ??= lerp(piece.start.pitch, piece.end.pitch, amount)
    point.bank ??= lerp(piece.start.bank, piece.end.bank, amount)
  })
  return piece
}

export function getCoasterTrackPoints(coaster: Coaster): TrackPoint[] {
  return coaster.pieces.flatMap((piece, index) =>
    index === 0 ? piece.points : piece.points.slice(1),
  )
}

function copyTrackPoint(point: TrackPoint): TrackPoint {
  return { ...point }
}

function pointsAreFinite(points: readonly TrackPoint[]): boolean {
  return points.every(
    (point) =>
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      Number.isFinite(point.z) &&
      (point.pitch === undefined || Number.isFinite(point.pitch)) &&
      (point.bank === undefined || Number.isFinite(point.bank)),
  )
}

function hypot2(
  left: Pick<TrackPoint, 'x' | 'z'>,
  right: Pick<TrackPoint, 'x' | 'z'>,
): number {
  return Math.hypot(left.x - right.x, left.z - right.z)
}

/** Distance from the polyline midpoint to the axis-aligned 90° corner. Higher = rounder. */
export function trackCornerClearance(points: readonly TrackPoint[]): number {
  if (points.length < 3) return 0
  const start = points[0]!
  const end = points.at(-1)!
  const first = { x: start.x, z: end.z }
  const second = { x: end.x, z: start.z }
  const mid = points[Math.floor(points.length / 2)]!
  const corner = hypot2(mid, first) <= hypot2(mid, second) ? first : second
  return hypot2(mid, corner)
}

/** Max relative |distance-to-center − radius| on interior samples. 0 = circular in plan. */
export function trackCurveRadiusError(
  points: readonly TrackPoint[],
  center: Pick<TrackPoint, 'x' | 'z'>,
  radius: number,
): number {
  if (points.length < 3 || radius <= 1e-6) return 0
  let worst = 0
  for (const point of points.slice(1, -1)) {
    worst = Math.max(worst, Math.abs(hypot2(point, center) - radius))
  }
  return worst / radius
}

function isPlanCurveKind(kind: TrackPieceKind): boolean {
  const definition = TRACK_PIECES[kind]
  return Boolean(definition.radius && definition.turn) || kind === 'sBendLeft' || kind === 'sBendRight' || kind === 'helixLeft' || kind === 'helixRight'
}

function isLoopKind(kind: TrackPieceKind): boolean {
  return kind === 'verticalLoop' || kind === 'halfLoopUp' || kind === 'halfLoopDown'
}

function interpolateTrackPoints(points: readonly TrackPoint[], t: number): TrackPoint {
  if (points.length === 0) return { x: 0, y: 0, z: 0 }
  if (points.length === 1) return copyTrackPoint(points[0]!)
  const scaled = Math.max(0, Math.min(1, t)) * (points.length - 1)
  const index = Math.min(points.length - 2, Math.floor(scaled))
  const amount = scaled - index
  const start = points[index]!
  const end = points[index + 1]!
  return {
    ...start,
    x: lerp(start.x, end.x, amount),
    y: lerp(start.y, end.y, amount),
    z: lerp(start.z, end.z, amount),
    pitch: lerp(start.pitch ?? 0, end.pitch ?? 0, amount),
    bank: lerp(start.bank ?? 0, end.bank ?? 0, amount),
  }
}

function resampleCurvePieceCircular(piece: TrackPiece): TrackPoint[] {
  const definition = TRACK_PIECES[piece.kind]
  const radius = definition.radius
  const turn = definition.turn
  if (!radius || !turn || piece.points.length < 3) {
    return piece.points.map(copyTrackPoint)
  }
  const start = piece.start
  const forward = HEADINGS[start.heading] ?? HEADINGS[0]!
  const side =
    turn === 1
      ? { x: -forward.z, z: forward.x }
      : { x: forward.z, z: -forward.x }
  const centerX = start.x + side.x * radius
  const centerZ = start.z + side.z * radius
  const fromX = start.x - centerX
  const fromZ = start.z - centerZ
  const samples = Math.max(piece.points.length - 1, Math.round(radius * 16), 20)
  const points: TrackPoint[] = []
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples
    const angle = turn * t * Math.PI / 2
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    const source = interpolateTrackPoints(piece.points, t)
    points.push({
      ...source,
      x: centerX + fromX * cosine - fromZ * sine,
      z: centerZ + fromX * sine + fromZ * cosine,
    })
  }
  const first = piece.points[0]
  const last = piece.points.at(-1)
  if (first) Object.assign(points[0]!, { x: first.x, y: first.y, z: first.z })
  if (last) Object.assign(points.at(-1)!, { x: last.x, y: last.y, z: last.z })
  return points
}

function resampleInferredQuarterCircle(points: readonly TrackPoint[]): TrackPoint[] {
  if (points.length < 4) return points.map(copyTrackPoint)
  const start = points[0]!
  const end = points.at(-1)!
  const dx = end.x - start.x
  const dz = end.z - start.z
  if (Math.abs(dx) < 0.55 || Math.abs(dz) < 0.55) return points.map(copyTrackPoint)
  if (Math.abs(Math.abs(dx) - Math.abs(dz)) > 0.2) return points.map(copyTrackPoint)
  const first = { x: start.x, z: end.z }
  const second = { x: end.x, z: start.z }
  const mid = points[Math.floor(points.length / 2)]!
  // Bezier hugs the inner corner; the tangent-continuous circle is centered on the other one.
  const center = hypot2(mid, first) <= hypot2(mid, second) ? second : first
  const radius = (Math.abs(dx) + Math.abs(dz)) / 2
  const startAngle = Math.atan2(start.z - center.z, start.x - center.x)
  const endAngle = Math.atan2(end.z - center.z, end.x - center.x)
  let sweep = endAngle - startAngle
  while (sweep > Math.PI) sweep -= Math.PI * 2
  while (sweep < -Math.PI) sweep += Math.PI * 2
  if (Math.abs(Math.abs(sweep) - Math.PI / 2) > 0.2) return points.map(copyTrackPoint)
  const samples = Math.max(points.length - 1, Math.round(radius * 16), 20)
  const out: TrackPoint[] = []
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples
    const angle = startAngle + sweep * t
    const source = interpolateTrackPoints(points, t)
    out.push({
      ...source,
      x: center.x + Math.cos(angle) * radius,
      z: center.z + Math.sin(angle) * radius,
    })
  }
  Object.assign(out[0]!, { x: start.x, y: start.y, z: start.z })
  Object.assign(out.at(-1)!, { x: end.x, y: end.y, z: end.z })
  return out
}

function hypot3(left: TrackPoint, right: TrackPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)
}

function gaussianSmoothTrackPoints(
  points: TrackPoint[],
  sigma: number,
  pinEnds: boolean,
  lockPlan?: readonly boolean[],
): TrackPoint[] {
  if (points.length < 3 || sigma <= 0) return points.map(copyTrackPoint)
  const radius = sigma * 3
  const out: TrackPoint[] = []
  for (let index = 0; index < points.length; index += 1) {
    if (pinEnds && (index === 0 || index === points.length - 1)) {
      out.push(copyTrackPoint(points[index]!))
      continue
    }
    let weightSum = 0
    let planWeight = 0
    let x = 0
    let y = 0
    let z = 0
    let pitch = 0
    let bank = 0
    let distance = 0
    const accumulate = (look: number, weight: number) => {
      const point = points[look]!
      weightSum += weight
      y += point.y * weight
      pitch += (point.pitch ?? 0) * weight
      bank += (point.bank ?? 0) * weight
      if (!lockPlan?.[look]) {
        planWeight += weight
        x += point.x * weight
        z += point.z * weight
      }
    }
    for (let look = index; look >= 0; look -= 1) {
      if (look < index) distance += hypot3(points[look]!, points[look + 1]!)
      if (distance > radius) break
      accumulate(look, Math.exp(-0.5 * (distance / sigma) ** 2))
    }
    distance = 0
    for (let look = index + 1; look < points.length; look += 1) {
      distance += hypot3(points[look - 1]!, points[look]!)
      if (distance > radius) break
      accumulate(look, Math.exp(-0.5 * (distance / sigma) ** 2))
    }
    if (weightSum < 1e-12 || !Number.isFinite(y / weightSum)) {
      out.push(copyTrackPoint(points[index]!))
      continue
    }
    const source = points[index]!
    const keepPlan = lockPlan?.[index] || planWeight < 1e-12
    out.push({
      ...source,
      x: keepPlan ? source.x : x / planWeight,
      y: y / weightSum,
      z: keepPlan ? source.z : z / planWeight,
      pitch: pitch / weightSum,
      bank: bank / weightSum,
    })
  }
  return out
}

const JOIN_FILLET_ANGLE = (18 * Math.PI) / 180
const JOIN_FILLET_FRACTION = 0.36
const JOIN_FILLET_SAMPLES = 4

function insertJoinFillet(left: TrackPoint[], right: TrackPoint[]): void {
  const prev = left.at(-2)
  const join = left.at(-1)
  const next = right[1]
  if (!prev || !join || !next) return
  const incoming = { x: join.x - prev.x, y: join.y - prev.y, z: join.z - prev.z }
  const outgoing = { x: next.x - join.x, y: next.y - join.y, z: next.z - join.z }
  const inLength = Math.hypot(incoming.x, incoming.y, incoming.z)
  const outLength = Math.hypot(outgoing.x, outgoing.y, outgoing.z)
  if (inLength < 1e-5 || outLength < 1e-5) return
  const alignment =
    (incoming.x * outgoing.x + incoming.y * outgoing.y + incoming.z * outgoing.z) /
    (inLength * outLength)
  const turn = Math.acos(Math.min(1, Math.max(-1, alignment)))
  if (turn < JOIN_FILLET_ANGLE) return
  const planIn = Math.hypot(incoming.x, incoming.z)
  const planOut = Math.hypot(outgoing.x, outgoing.z)
  if (planIn > 1e-5 && planOut > 1e-5) {
    const planDot = (incoming.x * outgoing.x + incoming.z * outgoing.z) / (planIn * planOut)
    const planTurn = Math.acos(Math.min(1, Math.max(-1, planDot)))
    if (planTurn > JOIN_FILLET_ANGLE) return
  }
  const radius = Math.min(0.24, JOIN_FILLET_FRACTION * inLength, JOIN_FILLET_FRACTION * outLength)
  const start: TrackPoint = {
    ...join,
    x: join.x - incoming.x * (radius / inLength),
    y: join.y - incoming.y * (radius / inLength),
    z: join.z - incoming.z * (radius / inLength),
  }
  const end: TrackPoint = {
    ...join,
    x: join.x + outgoing.x * (radius / outLength),
    y: join.y + outgoing.y * (radius / outLength),
    z: join.z + outgoing.z * (radius / outLength),
  }
  const control = {
    x: join.x * 0.32 + (start.x + end.x) * 0.34,
    y: join.y * 0.32 + (start.y + end.y) * 0.34,
    z: join.z * 0.32 + (start.z + end.z) * 0.34,
  }
  const samples: TrackPoint[] = []
  for (let index = 0; index <= JOIN_FILLET_SAMPLES; index += 1) {
    const t = index / JOIN_FILLET_SAMPLES
    const inverse = 1 - t
    samples.push({
      ...join,
      x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
      y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
      z: inverse * inverse * start.z + 2 * inverse * t * control.z + t * t * end.z,
      pitch: lerp(start.pitch ?? 0, end.pitch ?? 0, t),
      bank: lerp(start.bank ?? 0, end.bank ?? 0, t),
    })
  }
  if (!pointsAreFinite(samples)) return
  left.pop()
  left.push(...samples)
  right[0] = { ...samples.at(-1)! }
}

function smoothCoasterTrackPieces(coaster: Coaster): TrackPoint[][] {
  const pieces = coaster.pieces
  if (pieces.length === 0) return []
  const closed = Boolean(coaster.closed)
  const prepared = pieces.map((piece) =>
    TRACK_PIECES[piece.kind].radius ? resampleCurvePieceCircular(piece) : piece.points.map(copyTrackPoint),
  )
  const sigma = SIMULATION_CONFIG.coasters.trackJoinSmoothing.sigma
  const ghostCount = 6
  const smoothed = prepared.map((points, index) => {
    const kind = pieces[index]!.kind
    if (isLoopKind(kind)) return points
    const previous = prepared[(index - 1 + prepared.length) % prepared.length]!
    const following = prepared[(index + 1) % prepared.length]!
    const usePrevious = closed || index > 0
    const useFollowing = closed || index < prepared.length - 1
    const prefix = usePrevious ? previous.slice(-ghostCount) : []
    const suffix = useFollowing ? following.slice(0, ghostCount) : []
    const prevKind = pieces[(index - 1 + pieces.length) % pieces.length]!.kind
    const nextKind = pieces[(index + 1) % pieces.length]!.kind
    const lockOwnPlan = isPlanCurveKind(kind)
    const lockPrevGhosts = usePrevious && isPlanCurveKind(prevKind)
    const lockNextGhosts = useFollowing && isPlanCurveKind(nextKind)
    const lockPlan =
      lockOwnPlan || lockPrevGhosts || lockNextGhosts
        ? [
            ...prefix.map(() => lockPrevGhosts || lockOwnPlan),
            ...points.map(() => lockOwnPlan),
            ...suffix.map(() => lockNextGhosts || lockOwnPlan),
          ]
        : undefined
    const blurred = gaussianSmoothTrackPoints(
      [...prefix, ...points, ...suffix],
      sigma,
      !usePrevious || !useFollowing,
      lockPlan,
    )
    const slice = blurred.slice(prefix.length, prefix.length + points.length)
    return pointsAreFinite(slice) ? slice : points
  })

  const firstStored = pieces[0]?.points[0]
  if (firstStored && smoothed[0]?.[0]) {
    Object.assign(smoothed[0][0], { x: firstStored.x, y: firstStored.y, z: firstStored.z })
  }
  const lastSmoothed = smoothed.at(-1)?.at(-1)
  if (lastSmoothed) {
    const pin = closed ? firstStored : pieces.at(-1)?.points.at(-1)
    if (pin) Object.assign(lastSmoothed, { x: pin.x, y: pin.y, z: pin.z })
  }

  const weldCount = closed ? smoothed.length : Math.max(0, smoothed.length - 1)
  for (let index = 0; index < weldCount; index += 1) {
    const nextIndex = (index + 1) % smoothed.length
    const left = smoothed[index]
    const right = smoothed[nextIndex]
    if (!left?.length || !right?.length) continue
    const leftTip = left.at(-1)!
    const rightTip = right[0]!
    const welded = {
      ...leftTip,
      x: (leftTip.x + rightTip.x) / 2,
      y: (leftTip.y + rightTip.y) / 2,
      z: (leftTip.z + rightTip.z) / 2,
      pitch: ((leftTip.pitch ?? 0) + (rightTip.pitch ?? 0)) / 2,
      bank: ((leftTip.bank ?? 0) + (rightTip.bank ?? 0)) / 2,
    }
    Object.assign(leftTip, welded)
    Object.assign(rightTip, welded)
    const leftKind = pieces[index]?.kind
    const rightKind = pieces[nextIndex]?.kind
    if (!leftKind || !rightKind) continue
    if (leftKind === 'station' || rightKind === 'station') continue
    if (isPlanCurveKind(leftKind) || isPlanCurveKind(rightKind) || isLoopKind(leftKind) || isLoopKind(rightKind)) {
      continue
    }
    insertJoinFillet(left, right)
  }
  return smoothed
}

/** Preview / selection path for a lone piece. Does not write snapshot points. */
export function smoothTrackDisplayPoints(points: readonly TrackPoint[]): TrackPoint[] {
  const prepared = resampleInferredQuarterCircle(points)
  const planChanged = prepared.some((point, index) => {
    const source = interpolateTrackPoints(
      points,
      prepared.length <= 1 ? 0 : index / (prepared.length - 1),
    )
    return Math.hypot(point.x - source.x, point.z - source.z) > 0.02
  })
  if (planChanged) return prepared
  const smoothed = gaussianSmoothTrackPoints(
    prepared,
    SIMULATION_CONFIG.coasters.trackJoinSmoothing.sigma,
    true,
  )
  return pointsAreFinite(smoothed) ? smoothed : prepared
}

export function getSmoothedCoasterPiecePoints(coaster: Coaster): TrackPoint[][] {
  return cachedTrack(coaster).smoothedPieces
}

/** Incoming vs outgoing unit-tangent dot at a derived join. 1 = colinear. */
export function trackJoinTangentDot(coaster: Coaster, afterPieceIndex: number): number {
  const pieces = getSmoothedCoasterPiecePoints(coaster)
  const left = pieces[afterPieceIndex]
  const right = pieces[afterPieceIndex + 1] ?? (coaster.closed ? pieces[0] : undefined)
  if (!left || left.length < 2 || !right || right.length < 2) return 1
  const incoming = normalize({
    x: left[left.length - 1]!.x - left[left.length - 2]!.x,
    y: left[left.length - 1]!.y - left[left.length - 2]!.y,
    z: left[left.length - 1]!.z - left[left.length - 2]!.z,
  })
  const outgoing = normalize({
    x: right[1]!.x - right[0]!.x,
    y: right[1]!.y - right[0]!.y,
    z: right[1]!.z - right[0]!.z,
  })
  return incoming.x * outgoing.x + incoming.y * outgoing.y + incoming.z * outgoing.z
}

export type TrackSample = {
  pieceKind: TrackPieceKind
  pieceId: string
  point: TrackPoint
  tangent: TrackPoint
  right: TrackPoint
  up: TrackPoint
  pitch: number
  bank: number
  chainLift: boolean
  stationDrive: boolean
  totalLength: number
}

export function computeTrackFrame(
  tangent: TrackPoint,
  bank: number,
  pitch = 0,
  frameHeading?: number,
): { right: TrackPoint; up: TrackPoint } {
  const forward = normalize(tangent)
  let baseRight = normalize({ x: forward.z, y: 0, z: -forward.x })
  if (Math.hypot(baseRight.x, baseRight.y, baseRight.z) < 0.001) {
    baseRight = { x: 1, y: 0, z: 0 }
  }
  if (frameHeading !== undefined) {
    const reference = HEADINGS[frameHeading] ?? HEADINGS[0]!
    baseRight = { x: reference.z, y: 0, z: -reference.x }
  } else if (Math.cos(pitch) < 0) baseRight = { x: -baseRight.x, y: -baseRight.y, z: -baseRight.z }
  const baseUp = normalize(cross(forward, baseRight))
  const cosine = Math.cos(bank)
  const sine = Math.sin(bank)
  const right = normalize({
    x: baseRight.x * cosine + baseUp.x * sine,
    y: baseRight.y * cosine + baseUp.y * sine,
    z: baseRight.z * cosine + baseUp.z * sine,
  })
  return { right, up: normalize(cross(forward, right)) }
}

function normalize(vector: TrackPoint): TrackPoint {
  const length = Math.hypot(vector.x, vector.y, vector.z)
  if (length < 0.000001) return { x: 0, y: 0, z: 0 }
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length }
}

function cross(left: TrackPoint, right: TrackPoint): TrackPoint {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  }
}

function trackSignature(coaster: Coaster): string {
  return `${coaster.closed ? 'C' : 'O'}|${coaster.pieces.map((piece) => `${piece.id}:${piece.chainLift}:${piece.points.length}`).join('|')}`
}

function buildSegments(coaster: Coaster) {
  const smoothedPieces = smoothCoasterTrackPieces(coaster)
  const segments = coaster.pieces
    .flatMap((piece, pieceIndex) => {
      const points = smoothedPieces[pieceIndex] ?? piece.points
      return points.slice(0, -1).map((start, index) => {
        const end = points[index + 1]!
        const dx = end.x - start.x
        const dy = end.y - start.y
        const dz = end.z - start.z
        return {
          pieceKind: piece.kind,
          pieceId: piece.id,
          start,
          end,
          length: Math.hypot(dx, dy, dz),
          chainLift: piece.chainLift,
          stationDrive: piece.kind === 'station',
          startBank: start.bank ?? piece.start.bank,
          endBank: end.bank ?? piece.end.bank,
          startPitch: start.pitch ?? piece.start.pitch,
          endPitch: end.pitch ?? piece.end.pitch,
        }
      })
    })
    .filter((segment) => segment.length > 0.0001)
  const totalLength = segments.reduce((total, segment) => total + segment.length, 0)
  let accumulated = 0
  const ends = segments.map(s => accumulated += s.length)
  return { segments, totalLength, ends, smoothedPieces, signature: trackSignature(coaster) }
}

const trackCache = new WeakMap<Coaster, ReturnType<typeof buildSegments>>()

function cachedTrack(coaster: Coaster): ReturnType<typeof buildSegments> {
  const signature = trackSignature(coaster)
  let cached = trackCache.get(coaster)
  if (!cached || cached.signature !== signature) {
    cached = buildSegments(coaster)
    trackCache.set(coaster, cached)
  }
  return cached
}

export function sampleCoasterTrack(coaster: Coaster, distance: number): TrackSample | null {
  const { segments, totalLength, ends } = cachedTrack(coaster)
  if (segments.length === 0 || totalLength <= 0) return null

  let remaining = coaster.closed
    ? ((distance % totalLength) + totalLength) % totalLength
    : Math.max(0, Math.min(totalLength, distance))
  let low = 0, high = ends.length - 1
  while (low < high) { const mid = (low + high) >>> 1; if (ends[mid]! < remaining) low = mid + 1; else high = mid }
  remaining -= low > 0 ? ends[low - 1]! : 0
  for (const segment of [segments[low]!]) {
    if (remaining <= segment.length + 1e-7) {
      const t = Math.max(0, Math.min(1, remaining / segment.length))
      const tangent = {
        x: (segment.end.x - segment.start.x) / segment.length,
        y: (segment.end.y - segment.start.y) / segment.length,
        z: (segment.end.z - segment.start.z) / segment.length,
      }
      const bank = lerp(segment.startBank, segment.endBank, t)
      const frame = computeTrackFrame(tangent, bank, lerp(segment.startPitch, segment.endPitch, t), segment.start.frameHeading)
      return {
        pieceKind: segment.pieceKind,
        pieceId: segment.pieceId,
        point: {
          x: segment.start.x + (segment.end.x - segment.start.x) * t,
          y: segment.start.y + (segment.end.y - segment.start.y) * t,
          z: segment.start.z + (segment.end.z - segment.start.z) * t,
        },
        tangent,
        right: frame.right,
        up: frame.up,
        pitch: lerp(segment.startPitch, segment.endPitch, t),
        bank,
        chainLift: segment.chainLift,
        stationDrive: segment.stationDrive,
        totalLength,
      }
    }
    remaining -= segment.length
  }

  const last = segments.at(-1)!
  const tangent = {
    x: (last.end.x - last.start.x) / last.length,
    y: (last.end.y - last.start.y) / last.length,
    z: (last.end.z - last.start.z) / last.length,
  }
  const frame = computeTrackFrame(tangent, last.endBank, last.endPitch, last.end.frameHeading)
  return {
    pieceKind: last.pieceKind,
    pieceId: last.pieceId,
    point: { ...last.end },
    tangent,
    right: frame.right,
    up: frame.up,
    pitch: last.endPitch,
    bank: last.endBank,
    chainLift: last.chainLift,
    stationDrive: last.stationDrive,
    totalLength,
  }
}
