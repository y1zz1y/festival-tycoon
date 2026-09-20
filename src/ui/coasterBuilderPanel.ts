import {
  TRACK_BANK_ANGLE,
  TRACK_PIECES,
  TRACK_PITCHES,
  createTrackPiece,
  getCoasterType,
  type Coaster,
  type CoasterTrackStyleId,
  type CoasterTypeId,
  type TrackPieceKind,
} from '../game/coasters'
import {
  TRACK_DIRECTION_KINDS,
  TRACK_SPECIAL_KINDS,
  isTrackChainLiftEligible,
  isTrackChainLiftVisible,
  listCoasterDirectionChoices,
  listTrackBankChoices,
  listTrackPalettePieces,
  listTrackPitchChoices,
  resolveNextTrackPiece,
  type CoasterWindowState,
} from '../game/coasterConnections'
import { resolveCoasterEditorMode } from '../game/coasterTypes'
import { trackEditorUsesDirectionArrows } from '../game/trackEditorMode'
import {
  TRACK_CHAIN_PALETTE_ID,
  describeCoasterConstructionChrome,
  syncCoasterPaletteElement,
  trackBankPaletteId,
  trackPiecePaletteId,
  trackPitchPaletteId,
  updateCoasterConstruction,
  type CoasterPaletteButtonSpec,
} from '../game/coasterConstructionUI'
import { SIMULATION_CONFIG } from '../game/simulationConfig'
import { formatMoney } from './format'
import type { CellPosition } from '../view/WorldView'

const PIECE_ICONS: Record<TrackPieceKind, string> = {
  station: '▰', straight: '↑', slopeGentleUp: '⤴', slopeUp: '↗',
  slopeGentleDown: '⤵', slopeDown: '↘', pitchTransition: '⌁',
  bankTransition: '⤨', curveLeft1: '↰¹', curveRight1: '↱¹',
  curveLeft2: '↰²', curveRight2: '↱²', curveLeft3: '↰³',
  curveRight3: '↱³', curveLeft4: '↰⁴', curveRight4: '↱⁴',
  sBendLeft: '⤴', sBendRight: '⤵', verticalLoop: '◯',
  halfLoopUp: '∩', halfLoopDown: '∪', photo: '📷', splash: '💦',
  brakes: '▥', helixLeft: '↺', helixRight: '↻',
}
const PITCH_BUTTONS = [
  { pitch: TRACK_PITCHES.steepDown, icon: '⇘', title: 'Steil abwärts', label: 'Steil ab' },
  { pitch: TRACK_PITCHES.gentleDown, icon: '↘', title: 'Sanft abwärts', label: 'Sanft ab' },
  { pitch: 0, icon: '→', title: 'Flach', label: 'Flach' },
  { pitch: TRACK_PITCHES.gentleUp, icon: '↗', title: 'Sanft aufwärts', label: 'Sanft auf' },
  { pitch: TRACK_PITCHES.steepUp, icon: '⇗', title: 'Steil aufwärts', label: 'Steil auf' },
] as const
const BANK_BUTTONS = [
  { bank: -TRACK_BANK_ANGLE, icon: '◢', title: 'Neigung links einleiten', label: 'Links' },
  { bank: 0, icon: '━', title: 'Seitliche Neigung ausleiten', label: 'Neutral' },
  { bank: TRACK_BANK_ANGLE, icon: '◣', title: 'Neigung rechts einleiten', label: 'Rechts' },
] as const

export interface CoasterBuilderState {
  active: boolean
  coaster: Coaster | null
  editIndex: number
  startCandidate: CellPosition | null
  buildRotation: number
  buildElevation: number
  cameraQuarter: number
  window: CoasterWindowState
  lastConstructionKey: string | null
}

export interface CoasterBuilderElements {
  root: HTMLElement
  title: HTMLElement
  status: HTMLElement
  direction: HTMLElement
  piecePreview: HTMLElement
  pieceLabel: HTMLElement
  typeName: HTMLElement
  typeHint: HTMLElement
  rotate: HTMLButtonElement
  build: HTMLButtonElement
  undo: HTMLButtonElement
  entrance: HTMLButtonElement
  exit: HTMLButtonElement
  demolish: HTMLButtonElement
  chainLift: HTMLInputElement
  pieceSelect: HTMLSelectElement
  previous: HTMLButtonElement
  next: HTMLButtonElement
  selection: HTMLElement
  deleteTrack: HTMLButtonElement
  directionPalette: HTMLElement
  slopePalette: HTMLElement
  bankPalette: HTMLElement
  specialPalette: HTMLElement
  specialToggle: HTMLButtonElement
  directionGrid?: HTMLElement
}

export interface CoasterBuilderView {
  setCoasterTrackSelection(points: ReadonlyArray<{ x: number; y: number; z: number }>): void
  setCoasterConstructionPreview(
    points: ReadonlyArray<{ x: number; y: number; z: number }>,
    options?: { kind?: TrackPieceKind; chainLift?: boolean; styleId?: CoasterTrackStyleId; railColor?: number; structureColor?: number },
  ): void
}

export interface CoasterBuilderUpdate {
  key: string | null
  editIndex: number
  chainLift: boolean
  resolvedKind?: TrackPieceKind
}

function directionIcon(direction: number, cameraQuarter: number): string {
  return ['↙', '↘', '↗', '↖'][(direction - cameraQuarter + 4) % 4] ?? '◆'
}

function typeHint(typeId: CoasterTypeId): string {
  const type = getCoasterType(typeId)
  if (type.liftStyle === 'none') return 'Kein Kettenlift — nur Launch.'
  if (type.liftStyle === 'cable') return 'Seillift. Kettenlift-Flag ist nicht verfügbar.'
  if (type.liftStyle === 'powered') return 'Powered Launch. Kettenlift ist kein Standard.'
  if (type.liftStyle === 'curved') return 'Nur sanfte Steigung, gebogener Lift.'
  if (type.trainStyle === 'mouse') return 'Einzelwagen, keine Seitenneigung, enge 1-Feld-Kurven.'
  if (type.id === 'wooden') return 'Holzachterbahn: Looping und Wassersplash, keine 1-Feld-Kurven.'
  if (type.trackStyle === 'bobsledTrough') return 'Nur sanfte Steigung. Rinnenbahn ohne große Kurven.'
  return type.name
}

function pieceSpecs(entries: readonly { kind: TrackPieceKind; enabled: boolean }[], active: TrackPieceKind): CoasterPaletteButtonSpec[] {
  return entries.map(({ kind, enabled }) => {
    const piece = TRACK_PIECES[kind]
    return {
      id: trackPiecePaletteId(kind), enabled, active: kind === active,
      title: `${piece.name} · ${formatMoney(piece.cost)}`, icon: PIECE_ICONS[kind],
      label: piece.station ? 'Station' : piece.radius ? `${piece.radius}×${piece.radius}` : piece.name,
      attrs: { 'data-track-piece': kind },
    }
  })
}

export function updateCoasterBuilderPanel(
  state: CoasterBuilderState,
  elements: CoasterBuilderElements,
  view: CoasterBuilderView,
): CoasterBuilderUpdate {
  elements.root.classList.toggle('visible', state.active)
  if (!state.active) return { key: null, editIndex: state.editIndex, chainLift: elements.chainLift.checked }
  const coaster = state.coaster
  const editIndex = coaster
    ? Math.max(0, Math.min(coaster.pieces.length - 1, state.editIndex))
    : state.editIndex
  const chrome = describeCoasterConstructionChrome({
    window: state.window, ride: coaster, editIndex, startCandidate: state.startCandidate,
    buildRotation: state.buildRotation, buildElevation: state.buildElevation,
    cameraQuarter: state.cameraQuarter,
  })
  const construction = updateCoasterConstruction(state.lastConstructionKey, chrome)
  const type = getCoasterType(state.window.typeId)
  const arrows = trackEditorUsesDirectionArrows(resolveCoasterEditorMode(type.id))
  elements.root.classList.toggle('editor-mode-arrows', arrows)
  elements.root.classList.toggle('editor-mode-palette', !arrows)
  if (!construction.changed) return { key: state.lastConstructionKey, editIndex, chainLift: elements.chainLift.checked }
  const directionChoices = listCoasterDirectionChoices(
    coaster?.pieces[editIndex]?.end ?? null,
    type.id,
    Boolean(coaster),
  )
  if (elements.directionGrid) elements.directionGrid.hidden = !arrows
  elements.directionGrid?.querySelectorAll<HTMLButtonElement>('[data-coaster-direction]').forEach((button) => {
    const heading = Number(button.dataset.coasterDirection)
    const choice = directionChoices.find((entry) => entry.heading === heading)
    button.disabled = arrows ? !choice?.enabled : true
    button.hidden = !arrows
    const icon = button.querySelector('span')
    if (icon) icon.textContent = directionIcon(heading, state.cameraQuarter)
    button.title = choice?.enabled
      ? `Stück nach ${directionIcon(heading, state.cameraQuarter)} bauen`
      : 'Diese Richtung ist nicht frei.'
  })
  elements.typeName.textContent = type.name
  elements.typeHint.textContent = typeHint(type.id)
  elements.title.textContent = `${coaster?.name ?? type.name} Konstruktion`
  const anchor = coaster?.pieces[editIndex]
  elements.direction.textContent = directionIcon(anchor?.end.heading ?? state.buildRotation, state.cameraQuarter)
  elements.build.disabled = !coaster && !state.startCandidate
  elements.build.title = coaster ? 'Ausgewähltes Schienenstück bauen' : 'Startplattform bauen'
  elements.build.setAttribute('aria-label', elements.build.title)
  elements.rotate.disabled = Boolean(coaster)
  elements.undo.disabled = !coaster || coaster.pieces.length <= 1
  elements.entrance.disabled = !coaster
  elements.exit.disabled = !coaster
  elements.demolish.hidden = !coaster
  elements.pieceSelect.disabled = !coaster
  const resolved = resolveNextTrackPiece(state.window, anchor?.end ?? null, Boolean(coaster))
  elements.pieceSelect.value = resolved.kind
  const selectedPiece = TRACK_PIECES[resolved.kind]
  const directionEntries = listTrackPalettePieces(TRACK_DIRECTION_KINDS, anchor?.end ?? null, Boolean(coaster), type.id)
  const specialEntries = listTrackPalettePieces(TRACK_SPECIAL_KINDS, anchor?.end ?? null, Boolean(coaster), type.id)
  syncCoasterPaletteElement(elements.directionPalette, pieceSpecs(directionEntries, state.window.selectedKind))
  elements.directionPalette.style.gridTemplateColumns = `repeat(${Math.max(1, directionEntries.length)}, minmax(0, 1fr))`
  syncCoasterPaletteElement(elements.specialPalette, pieceSpecs(specialEntries, state.window.selectedKind))
  elements.specialToggle.hidden = specialEntries.length === 0
  if (!specialEntries.length) {
    elements.specialPalette.hidden = true
    elements.specialToggle.setAttribute('aria-expanded', 'false')
  }
  const pitchEntries = listTrackPitchChoices(anchor?.end.pitch ?? 0, type.id, anchor?.end.bank ?? 0)
    .map((entry) => ({ ...entry, enabled: Boolean(coaster) && entry.enabled }))
  const chainVisible = isTrackChainLiftVisible(type.id)
  const chainEnabled = Boolean(coaster && isTrackChainLiftEligible(
    selectedPiece.kind, anchor?.end.pitch ?? 0,
    resolved.options.targetPitch ?? state.window.targetPitch, type.id,
  ))
  if (!chainVisible || !chainEnabled) elements.chainLift.checked = false
  const slopeSpecs: CoasterPaletteButtonSpec[] = PITCH_BUTTONS
    .filter((button) => pitchEntries.some((choice) => Math.abs(choice.pitch - button.pitch) < 0.001))
    .map((button) => {
      const enabled = pitchEntries.find((choice) => Math.abs(choice.pitch - button.pitch) < 0.001)?.enabled ?? false
      return { id: trackPitchPaletteId(button.pitch), enabled, active: enabled && Math.abs(button.pitch - state.window.targetPitch) < 0.001, title: button.title, icon: button.icon, label: button.label, attrs: { 'data-track-pitch': String(button.pitch) } }
    })
  if (chainVisible) slopeSpecs.push({ id: TRACK_CHAIN_PALETTE_ID, enabled: chainEnabled, active: chainEnabled && elements.chainLift.checked, title: 'Kettenlift für das nächste geeignete Stück', icon: '⛓', label: 'Kette' })
  syncCoasterPaletteElement(elements.slopePalette, slopeSpecs)
  elements.slopePalette.style.gridTemplateColumns = `repeat(${Math.max(1, pitchEntries.length + (chainVisible ? 1 : 0))}, minmax(0, 1fr))`
  const bankEntries = listTrackBankChoices(anchor?.end.bank ?? 0, type.id, anchor?.end.pitch ?? 0)
    .map((entry) => ({ ...entry, enabled: Boolean(coaster) && entry.enabled }))
  syncCoasterPaletteElement(elements.bankPalette, BANK_BUTTONS
    .filter((button) => bankEntries.some((choice) => Math.abs(choice.bank - button.bank) < 0.001))
    .map((button) => {
      const enabled = bankEntries.find((choice) => Math.abs(choice.bank - button.bank) < 0.001)?.enabled ?? false
      return { id: trackBankPaletteId(button.bank), enabled, active: enabled && Math.abs(button.bank - state.window.targetBank) < 0.001, title: button.title, icon: button.icon, label: button.label, attrs: { 'data-track-bank': String(button.bank) } }
    }))
  elements.bankPalette.style.gridTemplateColumns = `repeat(${Math.max(1, bankEntries.length)}, minmax(0, 1fr))`
  const displayed = coaster ? selectedPiece : TRACK_PIECES.station
  elements.piecePreview.textContent = `${PIECE_ICONS[displayed.kind]} ${directionIcon(anchor?.end.heading ?? state.buildRotation, state.cameraQuarter)}`
  elements.chainLift.disabled = !chainVisible || !chainEnabled
  elements.pieceLabel.textContent = `${displayed.name} · Kosten: ${formatMoney(displayed.cost + (elements.chainLift.checked ? SIMULATION_CONFIG.economy.chainLiftCost : 0))}`

  if (!coaster || !anchor) {
    elements.previous.disabled = true; elements.next.disabled = true; elements.deleteTrack.disabled = true
    elements.selection.textContent = '–'; view.setCoasterTrackSelection([])
    if (state.startCandidate) {
      const preview = createTrackPiece('station-preview', 'station', {
        x: state.startCandidate.x, z: state.startCandidate.z, elevation: state.buildElevation,
        heading: state.buildRotation, pitch: 0, bank: 0,
      }, false)
      view.setCoasterConstructionPreview(preview.points, { kind: 'station', chainLift: false, styleId: type.trackStyle, railColor: type.railColor, structureColor: type.color })
      elements.status.textContent = `Startpunkt: ${state.startCandidate.x}, ${state.startCandidate.z} · Ebene ${state.buildElevation} · Richtung ${directionIcon(state.buildRotation, state.cameraQuarter)}. Zum Bestätigen „Startplattform bauen“ drücken.`
    } else {
      elements.status.textContent = 'Klicke auf das Gelände, um den Startpunkt als Vorschau zu setzen.'
      view.setCoasterConstructionPreview([])
    }
    return { key: construction.key, editIndex, chainLift: elements.chainLift.checked, resolvedKind: resolved.kind }
  }
  const selected = coaster.pieces[editIndex]
  elements.previous.disabled = editIndex <= 0
  elements.next.disabled = editIndex >= coaster.pieces.length - 1
  elements.deleteTrack.disabled = editIndex <= 0
  elements.selection.textContent = selected ? `${editIndex + 1}/${coaster.pieces.length} · ${TRACK_PIECES[selected.kind].name}` : '–'
  view.setCoasterTrackSelection(selected?.points ?? [])
  const preview = createTrackPiece('preview', resolved.kind, anchor.end, resolved.chainLift, resolved.options)
  view.setCoasterConstructionPreview(preview.points, { kind: resolved.kind, chainLift: resolved.chainLift, styleId: type.trackStyle, railColor: type.railColor, structureColor: type.color })
  const access = `${coaster.entrance ? '✓ Eingang' : '○ Eingang'} · ${coaster.exit ? '✓ Ausgang' : '○ Ausgang'}`
  elements.status.textContent = `Bauanker: ${anchor.end.x}, ${anchor.end.z} · Höhe ${anchor.end.elevation.toFixed(2)} · Neigung ${(anchor.end.pitch * 180 / Math.PI).toFixed(1)}° · Banking ${(anchor.end.bank * 180 / Math.PI).toFixed(0)}°. ${coaster.closed ? '✓ Strecke geschlossen' : 'Strecke noch offen'} · ${access}`
  return { key: construction.key, editIndex, chainLift: elements.chainLift.checked, resolvedKind: resolved.kind }
}
