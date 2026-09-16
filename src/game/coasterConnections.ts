import {
  TRACK_BANK_ANGLE,
  TRACK_PIECES,
  TRACK_PITCHES,
  canTransitionTrackPitch,
  type TrackAnchor,
  type TrackBuildOptions,
  type TrackPieceKind,
} from './coasters'
import {
  catalogAllowsTrackPiece,
  getCoasterCatalogEntry,
  isCoasterCatalogTypeId,
  type CoasterCatalogTypeId,
} from './coasterTypes'

export const TRACK_PITCH_LEVELS = [
  'steepDown',
  'gentleDown',
  'flat',
  'gentleUp',
  'steepUp',
] as const

export type TrackPitchLevel = (typeof TRACK_PITCH_LEVELS)[number]

export const TRACK_BANK_LEVELS = ['left', 'none', 'right', 'inverted'] as const

export type TrackBankLevel = (typeof TRACK_BANK_LEVELS)[number]

export type TrackConnectionState = {
  heading: number
  pitch: TrackPitchLevel
  bank: TrackBankLevel
}

const PITCH_VALUES: Record<TrackPitchLevel, number> = {
  steepDown: TRACK_PITCHES.steepDown,
  gentleDown: TRACK_PITCHES.gentleDown,
  flat: TRACK_PITCHES.flat,
  gentleUp: TRACK_PITCHES.gentleUp,
  steepUp: TRACK_PITCHES.steepUp,
}

export function classifyTrackPitch(pitch: number): TrackPitchLevel | null {
  for (const level of TRACK_PITCH_LEVELS) {
    if (Math.abs(PITCH_VALUES[level] - pitch) < 0.001) return level
  }
  return null
}

export function classifyTrackBank(bank: number): TrackBankLevel | null {
  if (Math.abs(bank) < 0.001) return 'none'
  if (Math.abs(bank - Math.PI) < 0.05 || Math.abs(bank + Math.PI) < 0.05) return 'inverted'
  if (Math.abs(bank - TRACK_BANK_ANGLE) < 0.001) return 'right'
  if (Math.abs(bank + TRACK_BANK_ANGLE) < 0.001) return 'left'
  return null
}

export function connectionStateFromAnchor(end: Pick<TrackAnchor, 'heading' | 'pitch' | 'bank'>): TrackConnectionState | null {
  const pitch = classifyTrackPitch(end.pitch)
  const bank = classifyTrackBank(end.bank)
  if (!pitch || !bank) return null
  return { heading: ((Math.round(end.heading) % 4) + 4) % 4, pitch, bank }
}

export function isInvertedTrackBank(bank: number): boolean {
  return Math.abs(bank) > 2
}

function isNearlyFlat(pitch: number): boolean {
  return Math.abs(pitch) < 0.001
}

function isNearlyUnbanked(bank: number): boolean {
  return Math.abs(bank) < 0.001
}

function specialNeedsInvertedEntry(kind: TrackPieceKind): boolean {
  return kind === 'halfLoopDown'
}

function specialEntryBank(kind: TrackPieceKind): number {
  return specialNeedsInvertedEntry(kind) ? Math.PI : 0
}

/**
 * Current Headliner append gate. Used by `GameState.appendCoasterPiece`.
 * Messages stay German to match the live construction UI.
 */
function isGentleFromFlatException(end: Pick<TrackAnchor, 'pitch' | 'bank'>, kind: TrackPieceKind): boolean {
  return (kind === 'slopeGentleUp' || kind === 'slopeGentleDown') && isNearlyFlat(end.pitch) && isNearlyUnbanked(end.bank)
}

export function describeTrackAppendIssue(
  end: Pick<TrackAnchor, 'pitch' | 'bank'>,
  kind: TrackPieceKind,
  options: TrackBuildOptions = {},
  typeId = 'classicSteel',
): string | null {
  if (!catalogAllowsTrackPiece(typeId, kind)) {
    return 'Dieser Achterbahntyp unterstützt das Element nicht'
  }
  const definition = TRACK_PIECES[kind]
  const catalogId = isCoasterCatalogTypeId(typeId) ? typeId : 'classicSteel'
  const start = connectionStateFromAnchor({ heading: 0, pitch: end.pitch, bank: end.bank })
  if (start && !isGentleFromFlatException(end, kind)) {
    const discrete = describeDiscreteConnectionIssue(start, kind, options, catalogId)
    if (discrete) {
      if (discrete === 'begin slope mismatch') {
        return 'Diese Neigung muss zuerst übergeleitet werden'
      }
      if (discrete === 'begin bank mismatch') {
        return 'Die Seitenneigung muss zuerst ausgeleitet werden'
      }
      if (discrete === 'cannot skip slope states') {
        return 'Diese Neigung kann nicht in einem Stück überführt werden'
      }
      if (discrete === 'bank must pass through none') {
        return 'Die Seitenneigung muss zuerst neutral ausgeleitet werden'
      }
      if (discrete === 'type does not allow this slope') {
        return 'Dieser Achterbahntyp unterstützt diese Neigung nicht'
      }
      if (discrete === 'type does not allow this bank' || discrete === 'type does not allow banking') {
        return 'Dieser Achterbahntyp unterstützt keine Seitenneigung'
      }
      if (discrete === 'type does not allow inversions') {
        return 'Dieser Achterbahntyp unterstützt keine Inversionen'
      }
      if (discrete === 'type does not allow 1-tile turns') {
        return 'Dieser Achterbahntyp unterstützt keine 1-Feld-Kurven'
      }
      if (discrete === 'type does not allow banked sloped curves') {
        return 'Dieser Achterbahntyp erlaubt keine geneigten Kurven mit Seitenneigung'
      }
      if (discrete === 'type does not allow sloped curves') {
        return 'Dieser Achterbahntyp erlaubt keine Kurven in der Steigung'
      }
      if (discrete === 'type does not allow banked steep') {
        return 'Dieser Achterbahntyp erlaubt keine steile Strecke mit Seitenneigung'
      }
      if (discrete === 'type does not allow helix') {
        return 'Dieser Achterbahntyp unterstützt keine Helix'
      }
      if (discrete === 'type does not allow water splash') {
        return 'Dieser Achterbahntyp unterstützt keinen Wassersplash'
      }
      if (discrete === 'type does not enable this piece') {
        return 'Dieser Achterbahntyp unterstützt das Element nicht'
      }
    }
  }
  if (
    kind === 'pitchTransition' &&
    !canTransitionTrackPitch(end.pitch, options.targetPitch ?? end.pitch)
  ) {
    return 'Diese Neigung kann nicht in einem Stück überführt werden'
  }
  if (kind === 'pitchTransition' && isCoasterCatalogTypeId(typeId)) {
    const target = classifyTrackPitch(options.targetPitch ?? end.pitch)
    if (target && catalogBlocksPitch(typeId, target)) {
      return 'Dieser Achterbahntyp unterstützt diese Neigung nicht'
    }
  }
  if (
    kind === 'bankTransition' &&
    Math.abs((options.targetBank ?? end.bank) - end.bank) > TRACK_BANK_ANGLE + 0.001
  ) {
    return 'Die Seitenneigung muss zuerst neutral ausgeleitet werden'
  }
  if (kind === 'station' && (!isNearlyFlat(end.pitch) || !isNearlyUnbanked(end.bank))) {
    return 'Vor einer Station müssen Steigung und Seitenneigung ausgeleitet werden'
  }
  if (
    definition.special &&
    (!isNearlyFlat(end.pitch) || Math.abs(end.bank - specialEntryBank(kind)) > 0.001)
  ) {
    return specialNeedsInvertedEntry(kind)
      ? 'Dieses Element benötigt einen waagerechten Anschluss auf dem Kopf'
      : 'Dieses Element benötigt einen waagerechten, ungekippten Anschluss'
  }
  if (isInvertedTrackBank(end.bank) && kind !== 'straight' && kind !== 'halfLoopDown') {
    return 'Kopfüber: Gerade oder halben Looping abwärts verwenden'
  }
  if (definition.turn && !isNearlyUnbanked(end.bank) && Math.sign(end.bank) !== definition.turn) {
    return 'Die Seitenneigung zeigt für diese Kurve in die falsche Richtung'
  }
  return null
}

export function canAppendTrackPiece(
  end: Pick<TrackAnchor, 'pitch' | 'bank'>,
  kind: TrackPieceKind,
  options: TrackBuildOptions = {},
  typeId = 'classicSteel',
): boolean {
  return describeTrackAppendIssue(end, kind, options, typeId) === null
}

function paletteAppendOptions(
  kind: TrackPieceKind,
  end: Pick<TrackAnchor, 'pitch' | 'bank'>,
): TrackBuildOptions {
  if (kind === 'pitchTransition') return { targetPitch: end.pitch, targetBank: end.bank }
  if (kind === 'bankTransition') return { targetPitch: end.pitch, targetBank: end.bank }
  return { targetPitch: end.pitch, targetBank: end.bank }
}

/**
 * Direction / special / station buttons in the construction window.
 * Type-unsupported kinds stay hidden. Currently illegal kinds stay listed
 * with `enabled: false` (greyed, not clickable).
 */
export function isTrackPalettePieceTypeSupported(kind: TrackPieceKind, typeId = 'classicSteel'): boolean {
  return catalogAllowsTrackPiece(typeId, kind)
}

export function isTrackPalettePieceEnabled(
  kind: TrackPieceKind,
  end: Pick<TrackAnchor, 'pitch' | 'bank'> | null,
  hasCoaster: boolean,
  typeId = 'classicSteel',
): boolean {
  if (!catalogAllowsTrackPiece(typeId, kind)) return false
  if (!hasCoaster) return kind === 'station'
  if (!end) return false
  return describeTrackAppendIssue(end, kind, paletteAppendOptions(kind, end), typeId) === null
}

export function isTrackPitchChoiceTypeSupported(typeId: string, pitch: number): boolean {
  const target = classifyTrackPitch(pitch)
  if (target && isCoasterCatalogTypeId(typeId) && catalogBlocksPitch(typeId, target)) return false
  return true
}

export function isTrackPitchChoiceEnabled(
  endPitch: number,
  targetPitch: number,
  typeId = 'classicSteel',
): boolean {
  if (!isTrackPitchChoiceTypeSupported(typeId, targetPitch)) return false
  if (!canTransitionTrackPitch(endPitch, targetPitch)) return false
  return true
}

export function isTrackBankChoiceTypeSupported(typeId: string, bank: number): boolean {
  return isNearlyUnbanked(bank) || typeAllowsBanking(typeId)
}

export function isTrackBankChoiceEnabled(
  endBank: number,
  targetBank: number,
  typeId = 'classicSteel',
): boolean {
  if (!isTrackBankChoiceTypeSupported(typeId, targetBank)) return false
  if (isNearlyUnbanked(endBank) || isNearlyUnbanked(targetBank)) return true
  return Math.sign(endBank) === Math.sign(targetBank)
}

export function typeAllowsChainLift(typeId = 'classicSteel'): boolean {
  if (!isCoasterCatalogTypeId(typeId)) return typeId === 'classicSteel'
  const caps = getCoasterCatalogEntry(typeId).capabilities
  return !caps.noLiftHill && caps.chainLift === 'vanilla'
}

export function typeAllowsSteep(typeId = 'classicSteel'): boolean {
  return !isCoasterCatalogTypeId(typeId) || getCoasterCatalogEntry(typeId).capabilities.steep
}

export function typeAllowsBanking(typeId = 'classicSteel'): boolean {
  return !isCoasterCatalogTypeId(typeId) || getCoasterCatalogEntry(typeId).capabilities.banking
}

export function typeAllowsGentle(typeId = 'classicSteel'): boolean {
  return !isCoasterCatalogTypeId(typeId) || getCoasterCatalogEntry(typeId).capabilities.gentle
}

/** Banked steep (45°) only when the type declares steep + banking + slopeCurveBanked. */
export function typeAllowsSteepBank(typeId = 'classicSteel'): boolean {
  if (!isCoasterCatalogTypeId(typeId)) return typeId === 'classicSteel'
  const caps = getCoasterCatalogEntry(typeId).capabilities
  return caps.steep && caps.banking && caps.slopeCurveBanked
}

export function isTrackChainLiftEligible(
  kind: TrackPieceKind,
  endPitch: number,
  targetPitch: number,
  typeId = 'classicSteel',
): boolean {
  if (!typeAllowsChainLift(typeId)) return false
  const definition = TRACK_PIECES[kind]
  if (!definition.chainAllowed) return false
  if (kind === 'pitchTransition' && Math.max(targetPitch, endPitch) <= 0) return false
  return true
}

/** Type can ever show the chain control. Current-end ineligibility greys it; LIM / no-lift types hide it. */
export function isTrackChainLiftVisible(typeId: string): boolean {
  return typeAllowsChainLift(typeId)
}

export type DiscretePieceEnds = {
  begin: TrackConnectionState
  end: TrackConnectionState
}

function rotateHeading(heading: number, turn: -1 | 1): number {
  return (heading - turn + 4) % 4
}

function levelState(
  heading: number,
  pitch: TrackPitchLevel,
  bank: TrackBankLevel,
): TrackConnectionState {
  return { heading, pitch, bank }
}

/**
 * Declared begin/end for a Headliner kind under the *target* discrete machine.
 * Constant slope pieces do not double as transitions.
 */
export function discretePieceEnds(
  start: TrackConnectionState,
  kind: TrackPieceKind,
  options: TrackBuildOptions = {},
): DiscretePieceEnds | null {
  const targetPitch = classifyTrackPitch(options.targetPitch ?? PITCH_VALUES[start.pitch])
  const targetBank =
    options.targetBank === undefined
      ? start.bank
      : classifyTrackBank(options.targetBank)
  if (options.targetBank !== undefined && !targetBank) return null
  if (kind === 'pitchTransition') {
    if (!targetPitch) return null
    return {
      begin: start,
      end: levelState(start.heading, targetPitch, start.bank),
    }
  }
  if (kind === 'bankTransition') {
    if (!targetBank) return null
    return {
      begin: start,
      end: levelState(start.heading, start.pitch, targetBank),
    }
  }
  if (kind === 'station' || kind === 'photo' || kind === 'splash' || kind === 'brakes' || kind === 'helixLeft' || kind === 'helixRight') {
    return {
      begin: levelState(start.heading, 'flat', 'none'),
      end: levelState(start.heading, 'flat', 'none'),
    }
  }
  if (kind === 'sBendLeft' || kind === 'sBendRight') {
    return {
      begin: levelState(start.heading, 'flat', 'none'),
      end: levelState(start.heading, 'flat', 'none'),
    }
  }
  if (kind === 'verticalLoop') {
    return {
      begin: levelState(start.heading, 'flat', 'none'),
      end: levelState(start.heading, 'flat', 'none'),
    }
  }
  if (kind === 'halfLoopUp') {
    return {
      begin: levelState(start.heading, 'flat', 'none'),
      end: levelState((start.heading + 2) % 4, 'flat', 'inverted'),
    }
  }
  if (kind === 'halfLoopDown') {
    return {
      begin: levelState(start.heading, 'flat', 'inverted'),
      end: levelState((start.heading + 2) % 4, 'flat', 'none'),
    }
  }
  const definition = TRACK_PIECES[kind]
  if (definition.turn) {
    return {
      begin: start,
      end: {
        heading: rotateHeading(start.heading, definition.turn),
        pitch: start.pitch,
        bank: start.bank,
      },
    }
  }
  if (definition.targetPitch !== undefined) {
    const pitch = classifyTrackPitch(definition.targetPitch)
    if (!pitch) return null
    return {
      begin: levelState(start.heading, pitch, start.bank),
      end: levelState(start.heading, pitch, start.bank),
    }
  }
  return { begin: start, end: start }
}

function pitchRank(level: TrackPitchLevel): number {
  return TRACK_PITCH_LEVELS.indexOf(level)
}

function canStepPitch(
  from: TrackPitchLevel,
  to: TrackPitchLevel,
  typeId: CoasterCatalogTypeId,
): boolean {
  if (from === to) return true
  const span = Math.abs(pitchRank(from) - pitchRank(to))
  if (span <= 1) return true
  const flatToSteep =
    (from === 'flat' && to === 'steepUp') ||
    (from === 'flat' && to === 'steepDown') ||
    (from === 'steepUp' && to === 'flat') ||
    (from === 'steepDown' && to === 'flat')
  return flatToSteep && getCoasterCatalogEntry(typeId).capabilities.flatToSteep
}

function canStepBank(from: TrackBankLevel, to: TrackBankLevel): boolean {
  if (from === to) return true
  if (from === 'inverted' || to === 'inverted') return false
  if (from !== 'none' && to !== 'none') return false
  return from === 'none' || to === 'none'
}

function catalogBlocksPitch(typeId: CoasterCatalogTypeId, pitch: TrackPitchLevel): boolean {
  const caps = getCoasterCatalogEntry(typeId).capabilities
  if ((pitch === 'steepUp' || pitch === 'steepDown') && !caps.steep) return true
  if ((pitch === 'gentleUp' || pitch === 'gentleDown') && !caps.gentle) return true
  return false
}

function catalogBlocksBank(typeId: CoasterCatalogTypeId, bank: TrackBankLevel): boolean {
  const caps = getCoasterCatalogEntry(typeId).capabilities
  if (bank === 'inverted') return caps.inversions === 'none'
  if (bank !== 'none' && !caps.banking) return true
  return false
}

/**
 * Target RCT2-style gate for future editor work. Not the live `appendCoasterPiece`
 * check — Headliner still allows `slopeGentleUp` directly from a flat station.
 */
export function describeDiscreteConnectionIssue(
  start: TrackConnectionState,
  kind: TrackPieceKind,
  options: TrackBuildOptions = {},
  typeId: CoasterCatalogTypeId = 'classicSteel',
): string | null {
  if (!isCoasterCatalogTypeId(typeId) || !catalogAllowsTrackPiece(typeId, kind)) {
    return 'type does not enable this piece'
  }
  const ends = discretePieceEnds(start, kind, options)
  if (!ends) return 'piece has no discrete begin/end'
  if (ends.begin.heading !== start.heading) return 'begin heading mismatch'
  if (ends.begin.pitch !== start.pitch) return 'begin slope mismatch'
  if (ends.begin.bank !== start.bank) return 'begin bank mismatch'
  if (catalogBlocksPitch(typeId, ends.end.pitch) || catalogBlocksPitch(typeId, start.pitch)) {
    return 'type does not allow this slope'
  }
  if (catalogBlocksBank(typeId, ends.end.bank) || catalogBlocksBank(typeId, start.bank)) {
    return 'type does not allow this bank'
  }
  if (kind === 'pitchTransition' && !canStepPitch(start.pitch, ends.end.pitch, typeId)) {
    return 'cannot skip slope states'
  }
  if (kind === 'bankTransition' && !canStepBank(start.bank, ends.end.bank)) {
    return 'bank must pass through none'
  }
  const caps = getCoasterCatalogEntry(typeId).capabilities
  if ((kind === 'verticalLoop' || kind === 'halfLoopUp' || kind === 'halfLoopDown') && caps.inversions === 'none') {
    return 'type does not allow inversions'
  }
  if ((kind === 'helixLeft' || kind === 'helixRight') && !catalogAllowsTrackPiece(typeId, kind)) {
    return 'type does not allow helix'
  }
  if (kind === 'splash' && !catalogAllowsTrackPiece(typeId, 'splash')) {
    return 'type does not allow water splash'
  }
  if ((kind === 'curveLeft1' || kind === 'curveRight1') && !caps.oneTileTurns) {
    return 'type does not allow 1-tile turns'
  }
  if (kind === 'bankTransition' && ends.end.bank !== 'none' && !caps.banking) {
    return 'type does not allow banking'
  }
  if (!caps.slopeCurveBanked && TRACK_PIECES[kind].turn && start.pitch !== 'flat' && start.bank !== 'none') {
    return 'type does not allow banked sloped curves'
  }
  if (
    TRACK_PIECES[kind].turn &&
    start.pitch !== 'flat' &&
    getCoasterCatalogEntry(typeId).uniqueSpecials.includes('noLargeOrSlopedCurves')
  ) {
    return 'type does not allow sloped curves'
  }
  const steepAtStart = start.pitch === 'steepUp' || start.pitch === 'steepDown'
  const steepAtEnd = ends.end.pitch === 'steepUp' || ends.end.pitch === 'steepDown'
  const bankedAtStart = start.bank !== 'none' && start.bank !== 'inverted'
  const bankedAtEnd = ends.end.bank !== 'none' && ends.end.bank !== 'inverted'
  if ((steepAtStart || steepAtEnd) && (bankedAtStart || bankedAtEnd) && !typeAllowsSteepBank(typeId)) {
    return 'type does not allow banked steep'
  }
  return null
}

export function canConnectDiscretePiece(
  start: TrackConnectionState,
  kind: TrackPieceKind,
  options: TrackBuildOptions = {},
  typeId: CoasterCatalogTypeId = 'classicSteel',
): boolean {
  return describeDiscreteConnectionIssue(start, kind, options, typeId) === null
}

export function flatUnbankedConnection(heading = 0): TrackConnectionState {
  return { heading, pitch: 'flat', bank: 'none' }
}

export const TRACK_PITCH_CHOICES = [
  TRACK_PITCHES.steepDown,
  TRACK_PITCHES.gentleDown,
  TRACK_PITCHES.flat,
  TRACK_PITCHES.gentleUp,
  TRACK_PITCHES.steepUp,
] as const

export const TRACK_BANK_CHOICES = [-TRACK_BANK_ANGLE, 0, TRACK_BANK_ANGLE] as const

export const TRACK_DIRECTION_KINDS: readonly TrackPieceKind[] = [
  'curveLeft4',
  'curveLeft3',
  'curveLeft2',
  'curveLeft1',
  'straight',
  'curveRight1',
  'curveRight2',
  'curveRight3',
  'curveRight4',
]

export const TRACK_SPECIAL_KINDS: readonly TrackPieceKind[] = [
  'station',
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

export type CoasterWindowState = {
  typeId: string
  selectedKind: TrackPieceKind
  targetPitch: number
  targetBank: number
  chainLift: boolean
}

export type ResolvedTrackBuild = {
  kind: TrackPieceKind
  options: TrackBuildOptions
  chainLift: boolean
}

export function constantPitchPieceKind(pitch: number): TrackPieceKind {
  if (Math.abs(pitch - TRACK_PITCHES.steepUp) < 0.001) return 'slopeUp'
  if (Math.abs(pitch - TRACK_PITCHES.gentleUp) < 0.001) return 'slopeGentleUp'
  if (Math.abs(pitch - TRACK_PITCHES.steepDown) < 0.001) return 'slopeDown'
  if (Math.abs(pitch - TRACK_PITCHES.gentleDown) < 0.001) return 'slopeGentleDown'
  return 'straight'
}

export function isLegalPitchBankPair(typeId: string, pitch: number, bank: number): boolean {
  if (isNearlyUnbanked(bank)) return true
  if (!typeAllowsBanking(typeId)) return false
  const level = classifyTrackPitch(pitch)
  if (level === 'steepUp' || level === 'steepDown') return typeAllowsSteepBank(typeId)
  return true
}

function clampPitchToType(typeId: string, pitch: number): number {
  const level = classifyTrackPitch(pitch)
  if ((level === 'steepUp' || level === 'steepDown') && !typeAllowsSteep(typeId)) {
    return level === 'steepUp' ? TRACK_PITCHES.gentleUp : TRACK_PITCHES.gentleDown
  }
  if ((level === 'gentleUp' || level === 'gentleDown') && !typeAllowsGentle(typeId)) {
    return TRACK_PITCHES.flat
  }
  return pitch
}

function clampBankToType(typeId: string, bank: number): number {
  if (!isNearlyUnbanked(bank) && !typeAllowsBanking(typeId)) return 0
  return bank
}

export function snapConstructionAxes(
  typeId: string,
  targetPitch: number,
  targetBank: number,
  changed: 'pitch' | 'bank' | 'kind',
): { targetPitch: number; targetBank: number } {
  let pitch = clampPitchToType(typeId, targetPitch)
  let bank = clampBankToType(typeId, targetBank)
  if (isLegalPitchBankPair(typeId, pitch, bank)) return { targetPitch: pitch, targetBank: bank }
  if (changed === 'pitch') {
    bank = 0
  } else if (changed === 'bank') {
    const level = classifyTrackPitch(pitch)
    if (level === 'steepUp') pitch = TRACK_PITCHES.gentleUp
    else if (level === 'steepDown') pitch = TRACK_PITCHES.gentleDown
    if (!isLegalPitchBankPair(typeId, pitch, bank)) bank = 0
  } else {
    bank = 0
  }
  return { targetPitch: pitch, targetBank: bank }
}

function snapSelectedKind(window: CoasterWindowState): TrackPieceKind {
  const definition = TRACK_PIECES[window.selectedKind]
  if (window.selectedKind === 'halfLoopDown') {
    if (Math.abs(window.targetPitch) > 0.001 || classifyTrackBank(window.targetBank) !== 'inverted') {
      return 'straight'
    }
    return window.selectedKind
  }
  if ((definition.special || definition.station) && (Math.abs(window.targetPitch) > 0.001 || !isNearlyUnbanked(window.targetBank))) {
    return 'straight'
  }
  if (!catalogAllowsTrackPiece(window.typeId, window.selectedKind)) return 'straight'
  return window.selectedKind
}

export function applyConstructionPitch(
  window: CoasterWindowState,
  targetPitch: number,
): CoasterWindowState {
  const axes = snapConstructionAxes(window.typeId, targetPitch, window.targetBank, 'pitch')
  const next = { ...window, targetPitch: axes.targetPitch, targetBank: axes.targetBank }
  return { ...next, selectedKind: snapSelectedKind(next) }
}

export function applyConstructionBank(
  window: CoasterWindowState,
  targetBank: number,
): CoasterWindowState {
  const axes = snapConstructionAxes(window.typeId, window.targetPitch, targetBank, 'bank')
  const next = { ...window, targetPitch: axes.targetPitch, targetBank: axes.targetBank }
  return { ...next, selectedKind: snapSelectedKind(next) }
}

function isDirectionOrSpecialKind(kind: TrackPieceKind): boolean {
  const definition = TRACK_PIECES[kind]
  return Boolean(
    definition.turn ||
      definition.special ||
      definition.station ||
      kind === 'straight' ||
      kind === 'slopeGentleUp' ||
      kind === 'slopeUp' ||
      kind === 'slopeGentleDown' ||
      kind === 'slopeDown',
  )
}

export function applyConstructionKind(
  window: CoasterWindowState,
  kind: TrackPieceKind,
  openEnd?: Pick<TrackAnchor, 'pitch' | 'bank'> | null,
): CoasterWindowState {
  if (!isTrackPalettePieceTypeSupported(kind, window.typeId)) return window
  if (openEnd !== undefined && !isTrackPalettePieceEnabled(kind, openEnd, openEnd !== null, window.typeId)) {
    return window
  }
  let targetPitch = window.targetPitch
  let targetBank = window.targetBank
  if (openEnd && isDirectionOrSpecialKind(kind)) {
    const atEnd = canAppendTrackPiece(
      openEnd,
      kind,
      { targetPitch: openEnd.pitch, targetBank: openEnd.bank },
      window.typeId,
    )
    if (atEnd) {
      targetPitch = openEnd.pitch
      targetBank = openEnd.bank
    }
  }
  const next = { ...window, selectedKind: kind, targetPitch, targetBank }
  const axes = snapConstructionAxes(next.typeId, next.targetPitch, next.targetBank, 'kind')
  const snapped = { ...next, targetPitch: axes.targetPitch, targetBank: axes.targetBank }
  return { ...snapped, selectedKind: snapSelectedKind(snapped) }
}

export function resolveNextTrackPiece(
  window: CoasterWindowState,
  openEnd: Pick<TrackAnchor, 'pitch' | 'bank'> | null,
  hasCoaster: boolean,
): ResolvedTrackBuild {
  if (!hasCoaster) {
    return { kind: 'station', options: {}, chainLift: false }
  }
  const end = openEnd ?? { pitch: 0, bank: 0 }
  const axes = snapConstructionAxes(window.typeId, window.targetPitch, window.targetBank, 'kind')
  const selectedKind = snapSelectedKind({ ...window, ...axes })
  const typeId = window.typeId

  const tryPiece = (
    kind: TrackPieceKind,
    options: TrackBuildOptions,
    wantChain: boolean,
  ): ResolvedTrackBuild | null => {
    if (!canAppendTrackPiece(end, kind, options, typeId)) return null
    return {
      kind,
      options,
      chainLift:
        wantChain &&
        isTrackChainLiftEligible(kind, end.pitch, options.targetPitch ?? end.pitch, typeId),
    }
  }

  const pitchDiffers = Math.abs(end.pitch - axes.targetPitch) > 0.001
  const bankDiffers = Math.abs(end.bank - axes.targetBank) > 0.001
  const selected = TRACK_PIECES[selectedKind]

  if ((selected.special || selected.station) && !pitchDiffers && !bankDiffers) {
    const special = tryPiece(selectedKind, {}, false)
    if (special) return special
  }

  if (pitchDiffers) {
    const transition = tryPiece(
      'pitchTransition',
      { targetPitch: axes.targetPitch, targetBank: end.bank },
      window.chainLift,
    )
    if (transition) return transition
  }
  if (bankDiffers) {
    const transition = tryPiece(
      'bankTransition',
      { targetPitch: end.pitch, targetBank: axes.targetBank },
      false,
    )
    if (transition) return transition
  }

  let kind = selectedKind
  if (
    kind === 'pitchTransition' ||
    kind === 'bankTransition' ||
    kind === 'straight' ||
    kind === 'slopeGentleUp' ||
    kind === 'slopeUp' ||
    kind === 'slopeGentleDown' ||
    kind === 'slopeDown'
  ) {
    kind = constantPitchPieceKind(end.pitch)
  }
  const piece = tryPiece(
    kind,
    { targetPitch: axes.targetPitch, targetBank: axes.targetBank },
    window.chainLift,
  )
  if (piece) return piece

  const fallback = constantPitchPieceKind(end.pitch)
  return (
    tryPiece(fallback, { targetPitch: end.pitch, targetBank: end.bank }, window.chainLift) ?? {
      kind: fallback,
      options: { targetPitch: end.pitch, targetBank: end.bank },
      chainLift: false,
    }
  )
}

export type TrackPalettePieceEntry = {
  kind: TrackPieceKind
  enabled: boolean
}

export type TrackPalettePitchEntry = {
  pitch: number
  enabled: boolean
}

export type TrackPaletteBankEntry = {
  bank: number
  enabled: boolean
}

/** Type-supported kinds. Currently illegal entries stay listed with `enabled: false`. */
export function listTrackPalettePieces(
  kinds: readonly TrackPieceKind[],
  end: Pick<TrackAnchor, 'pitch' | 'bank'> | null,
  hasCoaster: boolean,
  typeId = 'classicSteel',
): TrackPalettePieceEntry[] {
  return kinds
    .filter((kind) => isTrackPalettePieceTypeSupported(kind, typeId))
    .map((kind) => ({
      kind,
      enabled: isTrackPalettePieceEnabled(kind, end, hasCoaster, typeId),
    }))
}

export function listVisibleTrackPalettePieces(
  kinds: readonly TrackPieceKind[],
  end: Pick<TrackAnchor, 'pitch' | 'bank'> | null,
  hasCoaster: boolean,
  typeId = 'classicSteel',
): TrackPieceKind[] {
  return listTrackPalettePieces(kinds, end, hasCoaster, typeId).map((entry) => entry.kind)
}

function resolvedAppliesPitch(
  typeId: string,
  end: Pick<TrackAnchor, 'pitch' | 'bank'>,
  targetPitch: number,
): boolean {
  if (Math.abs(targetPitch - end.pitch) < 0.001) return true
  const snapped = applyConstructionPitch(
    {
      typeId,
      selectedKind: 'straight',
      targetPitch,
      targetBank: end.bank,
      chainLift: false,
    },
    targetPitch,
  )
  const resolved = resolveNextTrackPiece(snapped, end, true)
  return (
    resolved.kind === 'pitchTransition' &&
    Math.abs((resolved.options.targetPitch ?? snapped.targetPitch) - snapped.targetPitch) < 0.001
  )
}

function resolvedAppliesBank(
  typeId: string,
  end: Pick<TrackAnchor, 'pitch' | 'bank'>,
  targetBank: number,
): boolean {
  if (Math.abs(targetBank - end.bank) < 0.001) return true
  const snapped = applyConstructionBank(
    {
      typeId,
      selectedKind: 'straight',
      targetPitch: end.pitch,
      targetBank,
      chainLift: false,
    },
    targetBank,
  )
  const resolved = resolveNextTrackPiece(snapped, end, true)
  return (
    resolved.kind === 'bankTransition' &&
    Math.abs((resolved.options.targetBank ?? snapped.targetBank) - snapped.targetBank) < 0.001
  )
}

export function isTrackPitchChoiceCurrentlyEnabled(
  endPitch: number,
  targetPitch: number,
  typeId = 'classicSteel',
  endBank = 0,
): boolean {
  return (
    isTrackPitchChoiceEnabled(endPitch, targetPitch, typeId) &&
    resolvedAppliesPitch(typeId, { pitch: endPitch, bank: endBank }, targetPitch)
  )
}

export function isTrackBankChoiceCurrentlyEnabled(
  endBank: number,
  targetBank: number,
  typeId = 'classicSteel',
  endPitch = 0,
): boolean {
  return (
    isTrackBankChoiceEnabled(endBank, targetBank, typeId) &&
    resolvedAppliesBank(typeId, { pitch: endPitch, bank: endBank }, targetBank)
  )
}

/** Type-supported slopes. Currently unreachable entries stay listed with `enabled: false`. */
export function listTrackPitchChoices(
  endPitch: number,
  typeId = 'classicSteel',
  endBank = 0,
): TrackPalettePitchEntry[] {
  return TRACK_PITCH_CHOICES.filter((pitch) => isTrackPitchChoiceTypeSupported(typeId, pitch)).map((pitch) => ({
    pitch,
    enabled: isTrackPitchChoiceCurrentlyEnabled(endPitch, pitch, typeId, endBank),
  }))
}

export function listVisibleTrackPitchChoices(
  endPitch: number,
  typeId = 'classicSteel',
  endBank = 0,
): number[] {
  return listTrackPitchChoices(endPitch, typeId, endBank).map((entry) => entry.pitch)
}

/** Type-supported banks. Opposite-bank / illegal combo entries stay listed with `enabled: false`. */
export function listTrackBankChoices(
  endBank: number,
  typeId = 'classicSteel',
  endPitch = 0,
): TrackPaletteBankEntry[] {
  return TRACK_BANK_CHOICES.filter((bank) => isTrackBankChoiceTypeSupported(typeId, bank)).map((bank) => ({
    bank,
    enabled: isTrackBankChoiceCurrentlyEnabled(endBank, bank, typeId, endPitch),
  }))
}

export function listVisibleTrackBankChoices(
  endBank: number,
  typeId = 'classicSteel',
  endPitch = 0,
): number[] {
  return listTrackBankChoices(endBank, typeId, endPitch).map((entry) => entry.bank)
}
