import {
  classifyTrackBank,
  classifyTrackPitch,
  type CoasterWindowState,
} from './coasterConnections'
import type { TrackAnchor, TrackPieceKind } from './coasters'

export const TRACK_CHAIN_PALETTE_ID = 'toggle-chain-lift'

export type CoasterPaletteButtonSpec = {
  id: string
  enabled: boolean
  active: boolean
  title: string
  icon: string
  label: string
  attrs?: Record<string, string>
}

export type CoasterPaletteButtonNode = {
  id: string
  disabled: boolean
  title: string
  className?: string
  setAttribute(name: string, value: string): void
  classList: {
    toggle(token: string, force?: boolean): void
  }
}

export type CoasterPaletteHost = {
  children: ArrayLike<{ id: string }>
  replaceChildren: (...nodes: CoasterPaletteButtonNode[]) => void
}

export function trackPiecePaletteId(kind: TrackPieceKind): string {
  return `coaster-piece-${kind}`
}

export function trackPitchPaletteId(pitch: number): string {
  const level = classifyTrackPitch(pitch)
  return level ? `coaster-pitch-${level}` : `coaster-pitch-${pitch}`
}

export function trackBankPaletteId(bank: number): string {
  const level = classifyTrackBank(bank)
  return level ? `coaster-bank-${level}` : `coaster-bank-${bank}`
}

export function readPaletteButtonIds(host: { children: ArrayLike<{ id: string }> }): string[] {
  return Array.from(host.children, (child) => child.id)
}

export function paletteNeedsRemount(
  existingIds: readonly string[],
  nextIds: readonly string[],
): boolean {
  return existingIds.length !== nextIds.length || existingIds.some((id, index) => id !== nextIds[index])
}

export function applyCoasterPaletteButtonState(
  button: CoasterPaletteButtonNode,
  spec: CoasterPaletteButtonSpec,
): void {
  button.disabled = !spec.enabled
  button.title = spec.title
  button.setAttribute('aria-disabled', spec.enabled ? 'false' : 'true')
  button.classList.toggle('active', Boolean(spec.active && spec.enabled))
  if (spec.id === TRACK_CHAIN_PALETTE_ID) {
    button.setAttribute('aria-pressed', String(Boolean(spec.active && spec.enabled)))
  }
}

export function createCoasterPaletteButton(spec: CoasterPaletteButtonSpec): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.id = spec.id
  for (const [name, value] of Object.entries(spec.attrs ?? {})) {
    button.setAttribute(name, value)
  }
  const icon = document.createElement('span')
  icon.textContent = spec.icon
  const label = document.createElement('small')
  label.textContent = spec.label
  button.append(icon, label)
  applyCoasterPaletteButtonState(button, spec)
  return button
}

/** Keep type-supported buttons mounted. Only remount when the id list changes. */
export function syncCoasterPalette(
  host: CoasterPaletteHost,
  specs: readonly CoasterPaletteButtonSpec[],
  createButton: (spec: CoasterPaletteButtonSpec) => CoasterPaletteButtonNode = createCoasterPaletteButton,
): { remounted: boolean; ids: string[] } {
  const ids = specs.map((spec) => spec.id)
  const existing = Array.from(host.children) as CoasterPaletteButtonNode[]
  if (paletteNeedsRemount(existing.map((child) => child.id), ids)) {
    host.replaceChildren(
      ...specs.map((spec) => {
        const button = createButton(spec)
        applyCoasterPaletteButtonState(button, spec)
        return button
      }),
    )
    return { remounted: true, ids }
  }
  specs.forEach((spec, index) => {
    applyCoasterPaletteButtonState(existing[index]!, spec)
  })
  return { remounted: false, ids }
}

export function syncCoasterPaletteElement(
  host: HTMLElement,
  specs: readonly CoasterPaletteButtonSpec[],
): { remounted: boolean; ids: string[] } {
  return syncCoasterPalette(host as unknown as CoasterPaletteHost, specs)
}

export type CoasterConstructionChrome = {
  typeId: string
  selectedKind: TrackPieceKind
  targetPitch: number
  targetBank: number
  chainLift: boolean
  hasRide: boolean
  editIndex: number
  pieceCount: number
  pieceId: string
  rideName: string
  endX: number
  endZ: number
  endElevation: number
  endHeading: number
  endPitch: number
  endBank: number
  startX: number | null
  startZ: number | null
  buildRotation: number
  buildElevation: number
  circuitClosed: boolean
  hasEntrance: boolean
  hasExit: boolean
  cameraQuarter: number
}

export type CoasterConstructionRide = {
  name?: string
  pieces: readonly { id: string; end: TrackAnchor }[]
  closed: boolean
  entrance?: { x: number; z: number } | null
  exit?: { x: number; z: number } | null
}

export function describeCoasterConstructionChrome(input: {
  window: CoasterWindowState
  ride: CoasterConstructionRide | null
  editIndex: number
  startCandidate: { x: number; z: number } | null
  buildRotation: number
  buildElevation: number
  cameraQuarter?: number
}): CoasterConstructionChrome {
  const piece = input.ride?.pieces[input.editIndex]
  const end = piece?.end
  return {
    typeId: input.window.typeId,
    selectedKind: input.window.selectedKind,
    targetPitch: input.window.targetPitch,
    targetBank: input.window.targetBank,
    chainLift: input.window.chainLift,
    hasRide: Boolean(input.ride),
    editIndex: input.editIndex,
    pieceCount: input.ride?.pieces.length ?? 0,
    pieceId: piece?.id ?? '',
    rideName: input.ride?.name ?? '',
    endX: end?.x ?? 0,
    endZ: end?.z ?? 0,
    endElevation: end?.elevation ?? 0,
    endHeading: end?.heading ?? input.buildRotation,
    endPitch: end?.pitch ?? 0,
    endBank: end?.bank ?? 0,
    startX: input.startCandidate?.x ?? null,
    startZ: input.startCandidate?.z ?? null,
    buildRotation: input.buildRotation,
    buildElevation: input.buildElevation,
    circuitClosed: Boolean(input.ride?.closed),
    hasEntrance: Boolean(input.ride?.entrance),
    hasExit: Boolean(input.ride?.exit),
    cameraQuarter: input.cameraQuarter ?? 0,
  }
}

function quantizeConstructionValue(value: number): number {
  return Math.round(value * 1000)
}

export function coasterConstructionViewKey(chrome: CoasterConstructionChrome): string {
  return [
    chrome.typeId,
    chrome.selectedKind,
    quantizeConstructionValue(chrome.targetPitch),
    quantizeConstructionValue(chrome.targetBank),
    chrome.chainLift ? 1 : 0,
    chrome.hasRide ? 1 : 0,
    chrome.editIndex,
    chrome.pieceCount,
    chrome.pieceId,
    chrome.rideName,
    quantizeConstructionValue(chrome.endX),
    quantizeConstructionValue(chrome.endZ),
    quantizeConstructionValue(chrome.endElevation),
    chrome.endHeading,
    quantizeConstructionValue(chrome.endPitch),
    quantizeConstructionValue(chrome.endBank),
    chrome.startX ?? '',
    chrome.startZ ?? '',
    chrome.buildRotation,
    quantizeConstructionValue(chrome.buildElevation),
    chrome.circuitClosed ? 1 : 0,
    chrome.hasEntrance ? 1 : 0,
    chrome.hasExit ? 1 : 0,
    chrome.cameraQuarter,
  ].join('|')
}

/** Skip construction-window DOM work unless open end / type / selection actually changed. */
export function updateCoasterConstruction(
  previousKey: string | null,
  chrome: CoasterConstructionChrome,
): { key: string; changed: boolean } {
  const key = coasterConstructionViewKey(chrome)
  return { key, changed: key !== previousKey }
}

export function coasterConstructionPreviewKey(
  points: readonly { x: number; y: number; z: number; pitch?: number; bank?: number }[],
  options?: {
    kind?: string
    chainLift?: boolean
    styleId?: string
    railColor?: number
    structureColor?: number
  },
): string {
  if (points.length < 2) return ''
  const start = points[0]!
  const mid = points[Math.floor(points.length / 2)]!
  const end = points[points.length - 1]!
  return [
    options?.kind ?? '',
    options?.chainLift ? '1' : '0',
    options?.styleId ?? '',
    options?.railColor ?? '',
    options?.structureColor ?? '',
    points.length,
    start.x,
    start.y,
    start.z,
    start.pitch ?? 0,
    start.bank ?? 0,
    mid.x,
    mid.y,
    mid.z,
    end.x,
    end.y,
    end.z,
    end.pitch ?? 0,
    end.bank ?? 0,
  ].join('|')
}
