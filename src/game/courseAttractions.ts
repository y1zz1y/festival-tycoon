import { SIMULATION_CONFIG } from './simulationConfig'
import { grantAttractionFun } from './attractionFun'
import {
  resolveTrackEditorMode,
  trackEditorUsesDirectionArrows,
  type TrackEditorMode,
} from './trackEditorMode'
import type { Visitor } from './types/entities'
import type { GameSnapshot } from './types/snapshot'

export type { TrackEditorMode } from './trackEditorMode'

export const COURSE_KINDS = ['mudmasters', 'pool', 'treeToTree', 'paintball', 'waterSlide'] as const
export type CourseKind = (typeof COURSE_KINDS)[number]

export const COURSE_PIECE_KINDS = [
  'entrance',
  'exit',
  'path',
  'climbWall',
  'ropeSwing',
  'waterDitch',
  'crawlTunnel',
  'slide',
  'ladder',
  'jump',
  'monkeyBars',
  'poolBasin',
  'waterSlide',
  'tree',
  'treeRing',
  'treeLadder',
  'hangingBridge',
  'treeObstacle',
  'treeSwing',
  'treeZip',
  'paintballField',
  'cover',
  'teamStartA',
  'teamStartB',
] as const
export type CoursePieceKind = (typeof COURSE_PIECE_KINDS)[number]

export const COURSE_SPECS: Record<
  CourseKind,
  {
    name: string
    icon: string
    startCost: number
    price: number
    upkeep: number
    /** Path-led courses use neighbor arrows; area-only paintball keeps palette chrome. */
    editorMode: TrackEditorMode
  }
> = {
  mudmasters: {
    name: 'Mudmasters',
    icon: '🏃',
    startCost: 4200,
    price: 12,
    upkeep: 90,
    editorMode: 'directionArrows',
  },
  pool: {
    name: 'Schwimmbad',
    icon: '🏊',
    startCost: 5600,
    price: 10,
    upkeep: 110,
    editorMode: 'directionArrows',
  },
  treeToTree: {
    name: 'Tree-to-Tree',
    icon: '🌲',
    startCost: 4800,
    price: 14,
    upkeep: 95,
    editorMode: 'directionArrows',
  },
  paintball: {
    name: 'Paintball',
    icon: '🎯',
    startCost: 3800,
    price: 16,
    upkeep: 80,
    editorMode: 'palette',
  },
  waterSlide: {
    name: 'Wasserrutsche',
    icon: '🌊',
    startCost: 3600,
    price: 11,
    upkeep: 85,
    editorMode: 'directionArrows',
  },
}

export function courseEditorMode(kind: CourseKind): TrackEditorMode {
  return resolveTrackEditorMode(COURSE_SPECS[kind].editorMode)
}

export function courseUsesDirectionArrows(kind: CourseKind): boolean {
  return trackEditorUsesDirectionArrows(courseEditorMode(kind))
}

export const COURSE_PIECE_CATALOG: Record<CourseKind, readonly CoursePieceKind[]> = {
  mudmasters: [
    'entrance',
    'path',
    'climbWall',
    'ropeSwing',
    'waterDitch',
    'crawlTunnel',
    'slide',
    'ladder',
    'jump',
    'monkeyBars',
    'exit',
  ],
  pool: ['entrance', 'path', 'poolBasin', 'ladder', 'exit'],
  waterSlide: ['ladder', 'waterSlide', 'poolBasin', 'exit'],
  treeToTree: [
    'entrance',
    'path',
    'tree',
    'treeRing',
    'treeLadder',
    'hangingBridge',
    'treeObstacle',
    'treeSwing',
    'treeZip',
    'exit',
  ],
  paintball: ['entrance', 'paintballField', 'cover', 'teamStartA', 'teamStartB', 'exit'],
}

export const COURSE_PIECE_LABELS: Record<CoursePieceKind, string> = {
  entrance: 'Eingang',
  exit: 'Ausgang',
  path: 'Weg',
  climbWall: 'Kletterwand',
  ropeSwing: 'Seilschwung',
  waterDitch: 'Wassergraben',
  crawlTunnel: 'Kriechtunnel',
  slide: 'Rutsche',
  ladder: 'Leiter',
  jump: 'Sprung',
  monkeyBars: 'Hangelstrecke',
  poolBasin: 'Becken',
  waterSlide: 'Wasserrutsche',
  tree: 'Kletterbaum',
  treeRing: 'Baumumrundung',
  treeLadder: 'Baumleiter',
  hangingBridge: 'Hängebrücke',
  treeObstacle: 'Kletterhindernis',
  treeSwing: 'Seilschwung',
  treeZip: 'Seilbahn',
  paintballField: 'Spielfeld',
  cover: 'Deckung',
  teamStartA: 'Start Blau',
  teamStartB: 'Start Orange',
}

export const COURSE_PIECE_ICONS: Record<CoursePieceKind, string> = {
  entrance: '🚪',
  exit: '🚶',
  path: '🟫',
  climbWall: '🧗',
  ropeSwing: '🪢',
  waterDitch: '💧',
  crawlTunnel: '🕳️',
  slide: '🛝',
  ladder: '🪜',
  jump: '⬆️',
  monkeyBars: '🐒',
  poolBasin: '🏊',
  waterSlide: '🌊',
  tree: '🌲',
  treeRing: '⭕',
  treeLadder: '🪜',
  hangingBridge: '🌉',
  treeObstacle: '🪵',
  treeSwing: '🪢',
  treeZip: '➡️',
  paintballField: '🟩',
  cover: '🛡️',
  teamStartA: '🔵',
  teamStartB: '🟠',
}

export const COURSE_PIECE_COST: Record<CoursePieceKind, number> = {
  entrance: 0,
  exit: 80,
  path: 40,
  climbWall: 180,
  ropeSwing: 160,
  waterDitch: 140,
  crawlTunnel: 120,
  slide: 200,
  ladder: 90,
  jump: 110,
  monkeyBars: 170,
  poolBasin: 320,
  waterSlide: 380,
  tree: 150,
  treeRing: 70,
  treeLadder: 100,
  hangingBridge: 220,
  treeObstacle: 160,
  treeSwing: 180,
  treeZip: 260,
  paintballField: 90,
  cover: 70,
  teamStartA: 60,
  teamStartB: 60,
}

export const COURSE_PIECE_ELEVATION: Record<CoursePieceKind, number> = {
  entrance: 0,
  exit: 0,
  path: 0,
  climbWall: 1,
  ropeSwing: 1,
  waterDitch: 0,
  crawlTunnel: 0,
  slide: 1,
  ladder: 1,
  jump: 1,
  monkeyBars: 1,
  poolBasin: 0,
  waterSlide: 2,
  tree: 2,
  treeRing: 2,
  treeLadder: 1,
  hangingBridge: 2,
  treeObstacle: 2,
  treeSwing: 2,
  treeZip: 2,
  paintballField: 0,
  cover: 0,
  teamStartA: 0,
  teamStartB: 0,
}

const PARKOUR_OBSTACLES = new Set<CoursePieceKind>([
  'climbWall',
  'ropeSwing',
  'waterDitch',
  'crawlTunnel',
  'slide',
  'ladder',
  'jump',
  'monkeyBars',
])
const TREE_LINKS = new Set<CoursePieceKind>(['hangingBridge', 'treeZip', 'treeSwing', 'treeObstacle'])
const FIELD_OVERLAYS = new Set<CoursePieceKind>(['cover', 'teamStartA', 'teamStartB', 'entrance', 'exit'])
const LAUNCH_KINDS = new Set<CoursePieceKind>(['waterSlide', 'slide', 'jump'])
const TREE_RANGE = 10

export type CoursePiece = {
  id: string
  kind: CoursePieceKind
  x: number
  z: number
  elevation: number
  rotation: 0 | 1 | 2 | 3
  /** Track pieces run from x/z/elevation to this endpoint. Missing means a legacy point piece. */
  endX?: number
  endZ?: number
  endElevation?: number
}

export type CourseAreaCell = { x: number; z: number }

export type CourseRider = {
  visitorId: string
  pieceId: string
  progress: number
  airborne: boolean
  team?: 'a' | 'b'
  airX?: number
  airZ?: number
  airY?: number
  vx?: number
  vz?: number
  vy?: number
}

export type PaintballMatch = {
  remainingTicks: number
  scoreA: number
  scoreB: number
}

export type CourseAttraction = {
  id: string
  kind: CourseKind
  name: string
  operating: boolean
  price: number
  pieces: CoursePiece[]
  riders: CourseRider[]
  queue: string[]
  /** Explicit facility footprint for pool and paintball. Items are placed inside it. */
  areaCells: CourseAreaCell[]
  match?: PaintballMatch
  teamSize?: number
}

export function isCourseKind(value: string): value is CourseKind {
  return (COURSE_KINDS as readonly string[]).includes(value)
}

export function isCoursePieceKind(value: string): value is CoursePieceKind {
  return (COURSE_PIECE_KINDS as readonly string[]).includes(value)
}

export function courseCapacity(kind: CourseKind): number {
  return SIMULATION_CONFIG.courses.capacity[kind]
}

export function courseTeamSize(course: Pick<CourseAttraction, 'kind' | 'teamSize'>): number {
  if (course.kind !== 'paintball') return 0
  const raw = course.teamSize ?? SIMULATION_CONFIG.courses.paintballTeamSize
  return Math.max(
    SIMULATION_CONFIG.courses.paintballTeamSizeMin,
    Math.min(SIMULATION_CONFIG.courses.paintballTeamSizeMax, Math.round(raw)),
  )
}

export function courseCapacityFor(course: Pick<CourseAttraction, 'kind' | 'teamSize'>): number {
  if (course.kind === 'paintball') {
    return Math.max(courseCapacity('paintball'), courseTeamSize(course) * 2)
  }
  return courseCapacity(course.kind)
}

export function courseHourlyUpkeep(course: Pick<CourseAttraction, 'kind' | 'pieces'>, idle: boolean): number {
  const base = COURSE_SPECS[course.kind].upkeep + course.pieces.length * SIMULATION_CONFIG.courses.pieceUpkeep
  return idle ? base * SIMULATION_CONFIG.economy.pauseUpkeepMultiplier : base
}

export function courseEntrance(course: CourseAttraction): CoursePiece | undefined {
  const entrance = course.pieces.find((piece) => piece.kind === 'entrance')
  if (entrance) return entrance
  if (course.kind === 'waterSlide') {
    return course.pieces.find((piece) => piece.kind === 'ladder')
  }
  return undefined
}

export function courseExit(course: CourseAttraction): CoursePiece | undefined {
  const exit = course.pieces.find((piece) => piece.kind === 'exit')
  if (exit) return exit
  if (course.kind === 'waterSlide') {
    return [...course.pieces].reverse().find((piece) => piece.kind === 'poolBasin')
  }
  return undefined
}

function manhattan(left: Pick<CoursePiece, 'x' | 'z'>, right: Pick<CoursePiece, 'x' | 'z'>): number {
  return Math.abs(left.x - right.x) + Math.abs(left.z - right.z)
}

export function piecesAreAdjacent(left: Pick<CoursePiece, 'x' | 'z'>, right: Pick<CoursePiece, 'x' | 'z'>): boolean {
  return manhattan(left, right) === 1
}

export function piecesAreLinked(left: CoursePiece, right: CoursePiece): boolean {
  if (left.id === right.id) return false
  if (left.x === right.x && left.z === right.z) return true
  return piecesAreAdjacent(left, right)
}

export function courseOccupiesCell(course: CourseAttraction, x: number, z: number): boolean {
  return (
    course.areaCells.some((cell) => cell.x === x && cell.z === z) ||
    courseTrackOccupiesCell(course, x, z)
  )
}

export function courseTrackOccupiesCell(course: CourseAttraction, x: number, z: number): boolean {
  return course.pieces.some(
    (piece) =>
      (piece.x === x && piece.z === z) ||
      (piece.endX === x && piece.endZ === z) ||
      pieceCrossesCell(piece, x, z),
  )
}

/** True when a piece already spans these two cells in either direction. */
export function courseHasSpan(
  course: CourseAttraction,
  from: Pick<CourseAreaCell, 'x' | 'z'>,
  to: Pick<CourseAreaCell, 'x' | 'z'>,
): boolean {
  return course.pieces.some((piece) => {
    const endX = piece.endX ?? piece.x
    const endZ = piece.endZ ?? piece.z
    return (
      (piece.x === from.x && piece.z === from.z && endX === to.x && endZ === to.z) ||
      (piece.x === to.x && piece.z === to.z && endX === from.x && endZ === from.z)
    )
  })
}

function pieceCrossesCell(piece: CoursePiece, x: number, z: number): boolean {
  if (piece.endX === undefined || piece.endZ === undefined) return false
  const ax = piece.x + 0.5
  const az = piece.z + 0.5
  const bx = piece.endX + 0.5
  const bz = piece.endZ + 0.5
  const px = x + 0.5
  const pz = z + 0.5
  const dx = bx - ax
  const dz = bz - az
  const lengthSq = dx * dx + dz * dz
  const t = lengthSq <= 0.0001
    ? 0
    : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lengthSq))
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t)) <= 0.45
}

export function occupantsAt(course: CourseAttraction, x: number, z: number): CoursePiece[] {
  return course.pieces.filter((piece) => piece.x === x && piece.z === z)
}

export function canStackCoursePiece(base: CoursePieceKind, incoming: CoursePieceKind): boolean {
  if (base === 'ladder' && incoming === 'ladder') return true
  if (base === 'paintballField' && FIELD_OVERLAYS.has(incoming)) return true
  if (base === 'tree' && (incoming === 'treeRing' || incoming === 'treeLadder')) return true
  return false
}

export function defaultFirstCoursePiece(kind: CourseKind): CoursePieceKind {
  if (kind === 'paintball') return 'teamStartA'
  if (kind === 'waterSlide') return 'ladder'
  return 'entrance'
}

export function coursePaintMode(kind: CoursePieceKind): 'area' | 'line' | 'single' {
  if (kind === 'path') return 'line'
  return 'single'
}

export function courseUsesArea(kind: CourseKind): boolean {
  return kind === 'pool' || kind === 'paintball'
}

export function courseAreaContains(course: CourseAttraction, x: number, z: number): boolean {
  return course.areaCells.some((cell) => cell.x === x && cell.z === z)
}

export function courseAreaBoundaryContains(course: CourseAttraction, x: number, z: number): boolean {
  if (!courseAreaContains(course, x, z)) return false
  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dz]) => !courseAreaContains(course, x + dx!, z + dz!))
}

export function appendCourseAreaCell(
  course: CourseAttraction,
  x: number,
  z: number,
): CourseAreaCell | string {
  if (!courseUsesArea(course.kind)) return 'Nur Schwimmbad und Paintball besitzen eine Fläche.'
  if (courseAreaContains(course, x, z)) return 'Dieses Feld gehört bereits zur Anlage.'
  const cell = { x, z }
  course.areaCells.push(cell)
  return cell
}

export function courseAreaCellsAreConnected(cells: readonly CourseAreaCell[]): boolean {
  const first = cells[0]
  if (!first) return false
  const keys = new Set(cells.map((cell) => `${cell.x}:${cell.z}`))
  const seen = new Set<string>()
  const stack = [first]
  while (stack.length > 0) {
    const cell = stack.pop()!
    const key = `${cell.x}:${cell.z}`
    if (seen.has(key)) continue
    seen.add(key)
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next = { x: cell.x + dx, z: cell.z + dz }
      if (keys.has(`${next.x}:${next.z}`)) stack.push(next)
    }
  }
  return seen.size === keys.size
}

export function appendCourseAreaCells(
  course: CourseAttraction,
  cells: readonly CourseAreaCell[],
): number | string {
  if (!courseUsesArea(course.kind)) return 'Nur Schwimmbad und Paintball besitzen eine Fläche.'
  const existing = new Set(course.areaCells.map((cell) => `${cell.x}:${cell.z}`))
  const additions: CourseAreaCell[] = []
  for (const cell of cells) {
    const key = `${cell.x}:${cell.z}`
    if (existing.has(key)) continue
    existing.add(key)
    additions.push({ x: cell.x, z: cell.z })
  }
  const combined = [...course.areaCells, ...additions]
  if (combined.length > 0 && !courseAreaCellsAreConnected(combined)) {
    return 'Die Anlagenfläche muss zusammenhängen.'
  }
  course.areaCells.push(...additions)
  return additions.length
}

export function removeCourseAreaCells(
  course: CourseAttraction,
  cells: readonly CourseAreaCell[],
): number | string {
  if (!courseUsesArea(course.kind)) return 'Nur Schwimmbad und Paintball besitzen eine Fläche.'
  const removal = new Set(cells.map((cell) => `${cell.x}:${cell.z}`))
  const occupied = course.pieces.some((piece) =>
    courseSpanCells(
      { x: piece.x, z: piece.z },
      { x: piece.endX ?? piece.x, z: piece.endZ ?? piece.z },
    ).some((cell) => removal.has(`${cell.x}:${cell.z}`)),
  )
  if (occupied) return 'Entferne zuerst die Gegenstände und Strecken auf diesen Feldern.'
  const remaining = course.areaCells.filter((cell) => !removal.has(`${cell.x}:${cell.z}`))
  if (remaining.length > 0 && !courseAreaCellsAreConnected(remaining)) {
    return 'Die verbleibende Anlagenfläche muss zusammenhängen.'
  }
  const removed = course.areaCells.length - remaining.length
  course.areaCells = remaining
  return removed
}

export function isCourseTrackPiece(courseKind: CourseKind, pieceKind: CoursePieceKind): boolean {
  if (courseKind === 'mudmasters') return true
  if (courseKind === 'treeToTree') return pieceKind !== 'tree'
  if (courseKind === 'waterSlide') {
    return pieceKind === 'ladder' || pieceKind === 'waterSlide' ||
      pieceKind === 'poolBasin' || pieceKind === 'exit'
  }
  if (courseKind === 'pool') {
    return pieceKind === 'entrance' || pieceKind === 'exit' || pieceKind === 'path' ||
      pieceKind === 'ladder'
  }
  return false
}

export function courseTrackPieces(course: CourseAttraction): CoursePiece[] {
  return course.pieces.filter((piece) => isCourseTrackPiece(course.kind, piece.kind))
}

export function courseTrackEnd(course: CourseAttraction): {
  x: number
  z: number
  elevation: number
} | null {
  const piece = courseTrackPieces(course).at(-1)
  if (!piece) return null
  return {
    x: piece.endX ?? piece.x,
    z: piece.endZ ?? piece.z,
    elevation: piece.endElevation ?? piece.elevation,
  }
}

/** Grid cells crossed by a straight course span, including both endpoints. */
export function courseSpanCells(
  from: Pick<CourseAreaCell, 'x' | 'z'>,
  to: Pick<CourseAreaCell, 'x' | 'z'>,
): CourseAreaCell[] {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const steps = Math.max(Math.abs(dx), Math.abs(dz))
  if (steps === 0) return [{ x: from.x, z: from.z }]
  const cells: CourseAreaCell[] = []
  const seen = new Set<string>()
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps
    const cell = {
      x: Math.round(from.x + dx * t),
      z: Math.round(from.z + dz * t),
    }
    const key = `${cell.x}:${cell.z}`
    if (seen.has(key)) continue
    seen.add(key)
    cells.push(cell)
  }
  return cells
}

/** Heading order shared with the coaster editor and the path tool. */
export const COURSE_HEADINGS: readonly { x: number; z: number }[] = [
  { x: 0, z: 1 },
  { x: 1, z: 0 },
  { x: 0, z: -1 },
  { x: -1, z: 0 },
]

export type CourseGhostSpan = {
  cells: CourseAreaCell[]
  elevation: number
  valid: boolean
}

/**
 * Next piece target for the course editors: one field ahead of the open end in
 * the current build direction. The coaster editor resolves its next track piece
 * the same way, from the open end plus the construction window.
 */
export function courseNextBuildTarget(
  course: CourseAttraction,
  kind: CoursePieceKind,
  rotation: 0 | 1 | 2 | 3,
  elevation: number,
): { x: number; z: number; elevation: number } | null {
  if (!isCourseTrackPiece(course.kind, kind)) return null
  const end = courseTrackEnd(course)
  if (!end) return null
  const step = COURSE_HEADINGS[rotation] ?? COURSE_HEADINGS[0]!
  return { x: end.x + step.x, z: end.z + step.z, elevation }
}

/**
 * Ghost for the course build preview. `valid` only covers what the preview can
 * decide without the world: area courses must keep the span inside their own
 * area. `appendCoursePiece` stays the authoritative gate.
 */
export function courseGhostSpan(
  course: CourseAttraction,
  kind: CoursePieceKind,
  rotation: 0 | 1 | 2 | 3,
  elevation: number,
): CourseGhostSpan | null {
  const end = courseTrackEnd(course)
  const target = courseNextBuildTarget(course, kind, rotation, elevation)
  if (!end || !target) return null
  const cells = courseSpanCells(end, target)
  return {
    cells,
    elevation,
    valid:
      !courseUsesArea(course.kind) ||
      cells.every((cell) => courseAreaContains(course, cell.x, cell.z)),
  }
}

export function isCourseSwimPiece(piece: Pick<CoursePiece, 'kind'>): boolean {
  return piece.kind === 'poolBasin'
}

export function isCourseSwimCell(courses: readonly CourseAttraction[] | undefined, x: number, z: number): boolean {
  if (!courses) return false
  for (const course of courses) {
    for (const piece of course.pieces) {
      if (!isCourseSwimPiece(piece)) continue
      if (piece.x === x && piece.z === z) return true
      if (piece.endX === x && piece.endZ === z) return true
    }
  }
  return false
}

export function headingOffset(rotation: 0 | 1 | 2 | 3): { x: number; z: number } {
  if (rotation === 0) return { x: 0, z: 1 }
  if (rotation === 1) return { x: 1, z: 0 }
  if (rotation === 2) return { x: 0, z: -1 }
  return { x: -1, z: 0 }
}

export function slideLandingCell(piece: CoursePiece): { x: number; z: number } {
  const dx = piece.endX === undefined ? 0 : piece.endX - piece.x
  const dz = piece.endZ === undefined ? 0 : piece.endZ - piece.z
  const magnitude = Math.hypot(dx, dz)
  const dir =
    magnitude > 0.01
      ? { x: dx / magnitude, z: dz / magnitude }
      : headingOffset(piece.rotation)
  const launchElevation = piece.endElevation ?? piece.elevation
  const launchHeight = launchElevation + 0.2
  const horizontalSpeed = SIMULATION_CONFIG.courses.slideLaunchSpeed + launchElevation * 0.2
  const verticalSpeed = 0.1 + launchElevation * 0.04
  const gravity = SIMULATION_CONFIG.courses.slideGravity
  const flightTime =
    (verticalSpeed + Math.sqrt(verticalSpeed * verticalSpeed + 2 * gravity * launchHeight)) /
    gravity
  const flight = Math.max(1, horizontalSpeed * flightTime)
  return {
    x: Math.floor((piece.endX ?? piece.x) + dir.x * flight),
    z: Math.floor((piece.endZ ?? piece.z) + dir.z * flight),
  }
}

function placementAdjacency(course: CourseAttraction, kind: CoursePieceKind, x: number, z: number): string | null {
  const point = { x, z }
  if (kind === 'tree') {
    return course.pieces.some((piece) => manhattan(piece, point) <= TREE_RANGE)
      ? null
      : 'Bäume müssen in der Nähe des Kurses stehen.'
  }
  if (kind === 'treeRing') return 'Umrundungen gehören auf einen Kletterbaum.'
  if (TREE_LINKS.has(kind)) {
    const touchingTree = course.pieces.some(
      (piece) => (piece.kind === 'tree' || piece.kind === 'treeRing') && manhattan(piece, point) === 1,
    )
    return touchingTree ? null : 'Verbindungen müssen von einem Baum zum nächsten gehen.'
  }
  if (kind === 'treeLadder') {
    return course.pieces.some((piece) => piece.kind === 'tree' && manhattan(piece, point) <= 1)
      ? null
      : 'Leitern müssen an einem Baum stehen.'
  }
  if (course.pieces.some((piece) => manhattan(piece, point) === 1)) return null
  return 'Stücke müssen an den bestehenden Kurs anschließen.'
}

export function isCourseReadyToOperate(course: CourseAttraction): boolean {
  return validateCourse(course) === null
}

export function formatCourseInspect(
  course: CourseAttraction,
  ridesOfferActive: boolean,
): {
  icon: string
  typeLabel: string
  name: string
  status: string
  lines: { label: string; value: string }[]
} {
  const spec = COURSE_SPECS[course.kind]
  const issue = validateCourse(course)
  const status = issue
    ? issue
    : !course.operating
      ? `${spec.name} ist geschlossen.`
      : !ridesOfferActive
        ? 'Nach Tagesplan derzeit geschlossen.'
        : course.kind === 'paintball' && course.match
          ? `Match läuft · ${course.match.scoreA}:${course.match.scoreB}`
          : course.riders.length > 0
            ? `${course.riders.length} Gäste unterwegs`
            : `${spec.name} ist geöffnet.`
  const lines: { label: string; value: string }[] = [
    { label: 'Betrieb', value: course.operating ? 'Geöffnet' : 'Geschlossen' },
    { label: 'Stücke', value: String(course.pieces.length) },
  ]
  if (course.areaCells.length > 0) {
    lines.push({ label: 'Fläche', value: `${course.areaCells.length} Felder` })
  }
  lines.push(
    { label: 'Gäste', value: `${course.riders.length}/${courseCapacityFor(course)}` },
    { label: 'Warteschlange', value: String(course.queue.length) },
    { label: 'Unterhalt', value: `${courseHourlyUpkeep(course, false)} €/h` },
  )
  if (course.kind === 'paintball') {
    lines.push({ label: 'Personen pro Team', value: String(courseTeamSize(course)) })
  }
  return { icon: spec.icon, typeLabel: spec.name, name: course.name, status, lines }
}

function validateWaterSlide(course: CourseAttraction): string | null {
  const track = courseTrackPieces(course)
  if (track[0]?.kind !== 'ladder') return 'Die Wasserrutsche beginnt immer mit Leitern.'
  if (!track.some((piece) => piece.kind === 'waterSlide')) {
    return 'Die Wasserrutsche braucht mindestens ein Rutschstück.'
  }
  if (track.at(-1)?.kind === 'ladder') {
    return 'Leitern gehören nur an den Start, nicht an den Auslauf.'
  }
  const firstSlide = track.findIndex((piece) => piece.kind === 'waterSlide')
  if (track.slice(firstSlide).some((piece) => piece.kind === 'ladder')) {
    return 'Leitern gehören nur an den Start, nicht an den Auslauf.'
  }
  if (!course.pieces.some((piece) => piece.kind === 'poolBasin')) {
    return 'Die Wasserrutsche braucht einen Auslauf mit Wasser.'
  }
  return null
}

function slideLandsInBasin(course: CourseAttraction, slide: CoursePiece): boolean {
  if (nextCoursePieces(course, slide.id).some((piece) => piece.kind === 'poolBasin')) return true
  const landing = slideLandingCell(slide)
  return course.pieces.some(
    (piece) => piece.kind === 'poolBasin' && piece.x === landing.x && piece.z === landing.z,
  )
}

function validateSlideLanding(course: CourseAttraction): string | null {
  const terminalSlides = course.pieces.filter(
    (piece) =>
      piece.kind === 'waterSlide' &&
      piece.endX !== undefined &&
      !nextCoursePieces(course, piece.id).some((next) => next.kind === 'waterSlide'),
  )
  for (const slide of terminalSlides) {
    if (!slideLandsInBasin(course, slide)) {
      return 'Der Wasserrutschen-Auslauf muss auf ein Becken zielen.'
    }
  }
  return null
}

export function validateCourse(course: CourseAttraction): string | null {
  const catalog = COURSE_PIECE_CATALOG[course.kind]
  if (course.pieces.some((piece) => !catalog.includes(piece.kind))) {
    return 'Dieses Stück gehört nicht zu diesem Kurs.'
  }
  const entrance = courseEntrance(course)
  const exit = courseExit(course)
  if (courseUsesArea(course.kind) && course.areaCells.length < 4) {
    return 'Markiere zuerst eine zusammenhängende Anlagenfläche.'
  }
  if (courseUsesArea(course.kind) && !courseAreaCellsAreConnected(course.areaCells)) {
    return 'Die Anlagenfläche muss zusammenhängen.'
  }
  if (!entrance) return 'Der Kurs braucht einen Eingang.'
  if (!exit) return 'Der Kurs muss am Ausgang enden.'
  if (course.kind === 'mudmasters' && !course.pieces.some((piece) => PARKOUR_OBSTACLES.has(piece.kind))) {
    return 'Der Parcours braucht mindestens ein Hindernis.'
  }
  if (course.kind === 'pool' && !course.pieces.some((piece) => piece.kind === 'poolBasin')) {
    return 'Lege mindestens ein Schwimmbecken an.'
  }
  if (course.kind === 'waterSlide') {
    const waterIssue = validateWaterSlide(course)
    if (waterIssue) return waterIssue
  }
  if (course.kind === 'pool' || course.kind === 'waterSlide') {
    const landingIssue = validateSlideLanding(course)
    if (landingIssue) return landingIssue
  }
  if (course.kind === 'treeToTree' && !course.pieces.some((piece) => piece.kind === 'tree')) {
    return 'Platziere mindestens einen Kletterbaum.'
  }
  if (course.kind === 'paintball') {
    if (!course.pieces.some((piece) => piece.kind === 'teamStartA')) return 'Paintball braucht Start Blau.'
    if (!course.pieces.some((piece) => piece.kind === 'teamStartB')) return 'Paintball braucht Start Orange.'
    if (
      !courseAreaBoundaryContains(course, entrance.x, entrance.z) ||
      !courseAreaBoundaryContains(course, exit.x, exit.z)
    ) {
      return 'Ein- und Ausgang gehören an das Spielfeld.'
    }
    return null
  }
  const track = courseTrackPieces(course)
  if (track.every((piece) => piece.endX === undefined)) {
    const legacyPieces = course.pieces
    const seen = new Set<string>()
    const stack = [entrance.id]
    while (stack.length > 0) {
      const id = stack.pop()!
      if (seen.has(id)) continue
      seen.add(id)
      const current = legacyPieces.find((piece) => piece.id === id)
      if (!current) continue
      for (const other of legacyPieces) {
        if (!seen.has(other.id) && piecesAreLinked(current, other)) stack.push(other.id)
      }
    }
    return seen.has(exit.id) ? null : 'Der Pfad muss am Ausgang enden.'
  }
  if (track.at(-1)?.id !== exit.id) return 'Der Pfad muss am Ausgang enden.'
  return trackContinuityIssue(track)
}

function trackPiecesJoin(previous: CoursePiece, current: CoursePiece): boolean {
  if (
    previous.kind === 'ladder' &&
    current.x === previous.x &&
    current.z === previous.z &&
    (current.kind === 'ladder' || previous.endX === undefined)
  ) {
    return true
  }
  return (
    (previous.endX ?? previous.x) === current.x &&
    (previous.endZ ?? previous.z) === current.z &&
    Math.abs((previous.endElevation ?? previous.elevation) - current.elevation) <= 0.01
  )
}

function trackContinuityIssue(track: readonly CoursePiece[]): string | null {
  for (let index = 1; index < track.length; index += 1) {
    if (!trackPiecesJoin(track[index - 1]!, track[index]!)) {
      return 'Die Strecke besitzt eine Unterbrechung.'
    }
  }
  return null
}

export function nextCoursePieces(course: CourseAttraction, pieceId: string): CoursePiece[] {
  const track = courseTrackPieces(course)
  if (track.every((piece) => piece.endX === undefined)) {
    const current = course.pieces.find((piece) => piece.id === pieceId)
    return current
      ? course.pieces.filter((piece) => piece.kind !== 'entrance' && piecesAreLinked(current, piece))
      : []
  }
  const index = track.findIndex((piece) => piece.id === pieceId)
  return index >= 0 && track[index + 1] ? [track[index + 1]!] : []
}

export type CourseLayoutCell = { kind: CoursePieceKind; dx: number; dz: number }

export function rotateCourseOffset(
  dx: number,
  dz: number,
  rotation: 0 | 1 | 2 | 3,
): { x: number; z: number } {
  if (rotation === 1) return { x: -dz, z: dx }
  if (rotation === 2) return { x: -dx, z: -dz }
  if (rotation === 3) return { x: dz, z: -dx }
  return { x: dx, z: dz }
}

/** Complete example footprints for tests and previews — the player builds these by hand. */
export const DEFAULT_LAYOUTS: Record<CourseKind, readonly CourseLayoutCell[]> = {
  mudmasters: [
    { kind: 'entrance', dx: 0, dz: 0 },
    { kind: 'path', dx: 1, dz: 0 },
    { kind: 'climbWall', dx: 2, dz: 0 },
    { kind: 'jump', dx: 3, dz: 0 },
    { kind: 'ropeSwing', dx: 4, dz: 0 },
    { kind: 'path', dx: 0, dz: 1 },
    { kind: 'waterDitch', dx: 1, dz: 1 },
    { kind: 'crawlTunnel', dx: 2, dz: 1 },
    { kind: 'slide', dx: 3, dz: 1 },
    { kind: 'ladder', dx: 4, dz: 1 },
    { kind: 'monkeyBars', dx: 1, dz: 2 },
    { kind: 'path', dx: 2, dz: 2 },
    { kind: 'path', dx: 3, dz: 2 },
    { kind: 'exit', dx: 4, dz: 2 },
  ],
  pool: [
    { kind: 'entrance', dx: 0, dz: 0 },
    { kind: 'path', dx: 1, dz: 0 },
    { kind: 'path', dx: 2, dz: 0 },
    { kind: 'path', dx: 0, dz: 1 },
    { kind: 'poolBasin', dx: 1, dz: 1 },
    { kind: 'poolBasin', dx: 2, dz: 1 },
    { kind: 'poolBasin', dx: 3, dz: 1 },
    { kind: 'path', dx: 0, dz: 2 },
    { kind: 'poolBasin', dx: 1, dz: 2 },
    { kind: 'poolBasin', dx: 2, dz: 2 },
    { kind: 'exit', dx: 3, dz: 2 },
  ],
  waterSlide: [
    { kind: 'ladder', dx: 0, dz: 0 },
    { kind: 'waterSlide', dx: 1, dz: 0 },
    { kind: 'waterSlide', dx: 2, dz: 0 },
    { kind: 'poolBasin', dx: 3, dz: 0 },
    { kind: 'exit', dx: 4, dz: 0 },
  ],
  treeToTree: [
    { kind: 'entrance', dx: 0, dz: 0 },
    { kind: 'treeLadder', dx: 1, dz: 0 },
    { kind: 'tree', dx: 1, dz: 1 },
    { kind: 'treeRing', dx: 1, dz: 1 },
    { kind: 'hangingBridge', dx: 2, dz: 1 },
    { kind: 'tree', dx: 3, dz: 1 },
    { kind: 'treeObstacle', dx: 3, dz: 0 },
    { kind: 'treeSwing', dx: 3, dz: 2 },
    { kind: 'treeZip', dx: 4, dz: 1 },
    { kind: 'tree', dx: 5, dz: 1 },
    { kind: 'treeLadder', dx: 5, dz: 2 },
    { kind: 'exit', dx: 6, dz: 2 },
  ],
  paintball: [
    { kind: 'entrance', dx: 0, dz: 1 },
    { kind: 'exit', dx: 0, dz: 2 },
    { kind: 'teamStartA', dx: 1, dz: 0 },
    { kind: 'paintballField', dx: 1, dz: 1 },
    { kind: 'paintballField', dx: 1, dz: 2 },
    { kind: 'cover', dx: 2, dz: 0 },
    { kind: 'paintballField', dx: 2, dz: 1 },
    { kind: 'cover', dx: 2, dz: 2 },
    { kind: 'paintballField', dx: 3, dz: 0 },
    { kind: 'paintballField', dx: 3, dz: 1 },
    { kind: 'paintballField', dx: 3, dz: 2 },
    { kind: 'teamStartB', dx: 4, dz: 0 },
    { kind: 'paintballField', dx: 4, dz: 1 },
    { kind: 'cover', dx: 4, dz: 2 },
  ],
}

export function createEmptyCourse(id: string, kind: CourseKind): CourseAttraction {
  const spec = COURSE_SPECS[kind]
  return {
    id,
    kind,
    name: spec.name,
    operating: false,
    price: spec.price,
    pieces: [],
    riders: [],
    queue: [],
    areaCells: [],
    teamSize: kind === 'paintball' ? SIMULATION_CONFIG.courses.paintballTeamSize : undefined,
  }
}

export function createSeededCourse(
  id: string,
  kind: CourseKind,
  x: number,
  z: number,
  rotation: 0 | 1 | 2 | 3 = 0,
): CourseAttraction {
  const course = createEmptyCourse(id, kind)
  const layout = DEFAULT_LAYOUTS[kind]
  course.operating = true
  course.areaCells = layout
    .filter((cell) =>
      kind === 'pool'
        ? cell.kind === 'poolBasin'
        : kind === 'paintball' &&
          (cell.kind === 'paintballField' || cell.kind === 'entrance' || cell.kind === 'exit'),
    )
    .map((cell) => {
      const offset = rotateCourseOffset(cell.dx, cell.dz, rotation)
      return { x: x + offset.x, z: z + offset.z }
    })
  course.pieces = layout.map((cell, index) => {
    const offset = rotateCourseOffset(cell.dx, cell.dz, rotation)
    return {
      id: `${id}-p${index}`,
      kind: cell.kind,
      x: x + offset.x,
      z: z + offset.z,
      elevation: COURSE_PIECE_ELEVATION[cell.kind],
      rotation,
    }
  })
  return course
}

export function courseStartCost(kind: CourseKind): number {
  return COURSE_SPECS[kind].startCost
}

function isTreeCourseDestination(kind: CoursePieceKind): boolean {
  return TREE_LINKS.has(kind) || kind === 'treeLadder' || kind === 'treeRing'
}

export function describeCourseAppendIssue(
  course: CourseAttraction,
  kind: CoursePieceKind,
  x: number,
  z: number,
  elevation = COURSE_PIECE_ELEVATION[kind],
): string | null {
  if (!COURSE_PIECE_CATALOG[course.kind].includes(kind)) {
    return 'Dieses Stück gehört nicht zu diesem Kurs.'
  }
  if (course.kind === 'waterSlide' && kind === 'ladder') {
    const ladderIssue = describeWaterSlideLadderIssue(course, x, z)
    if (ladderIssue) return ladderIssue
  }
  if (courseUsesArea(course.kind)) {
    if (!courseAreaContains(course, x, z)) return 'Das Objekt muss innerhalb der Anlagenfläche stehen.'
    if (
      (kind === 'entrance' || kind === 'exit') &&
      !courseAreaBoundaryContains(course, x, z)
    ) {
      return 'Ein- und Ausgang müssen auf dem Rand der Anlagenfläche liegen.'
    }
  }
  const occupants = occupantsAt(course, x, z)
  const treeDestination =
    course.kind === 'treeToTree' &&
    isTreeCourseDestination(kind) &&
    occupants.some((piece) => piece.kind === 'tree')
  const areaTrackDestination =
    courseUsesArea(course.kind) && isCourseTrackPiece(course.kind, kind)
  if (occupants.length > 0 && !treeDestination && !areaTrackDestination) {
    if (!occupants.every((piece) => canStackCoursePiece(piece.kind, kind))) {
      return 'Dieses Feld ist schon belegt.'
    }
  } else if (
    course.pieces.length > 0 &&
    !courseUsesArea(course.kind) &&
    !isCourseTrackPiece(course.kind, kind)
  ) {
    const issue = placementAdjacency(course, kind, x, z)
    if (issue) return issue
  }
  if (kind === 'entrance' && course.pieces.some((piece) => piece.kind === 'entrance')) {
    return 'Es gibt schon einen Eingang.'
  }
  if (kind === 'exit' && course.pieces.some((piece) => piece.kind === 'exit')) {
    return 'Es gibt schon einen Ausgang.'
  }
  if (kind === 'teamStartA' && course.pieces.some((piece) => piece.kind === 'teamStartA')) {
    return 'Start Blau ist schon gesetzt.'
  }
  if (kind === 'teamStartB' && course.pieces.some((piece) => piece.kind === 'teamStartB')) {
    return 'Start Orange ist schon gesetzt.'
  }
  const trackEnd = courseTrackEnd(course)
  const isTrack = isCourseTrackPiece(course.kind, kind)
  if (isTrack && kind !== defaultFirstCoursePiece(course.kind) && !trackEnd) {
    return course.kind === 'waterSlide'
      ? 'Setze zuerst die Leiter am Start der Rutsche.'
      : 'Setze zuerst den Eingang der Strecke.'
  }
  if (course.kind === 'treeToTree' && isTreeCourseDestination(kind) && !treeDestination) {
    return 'Dieses Streckenelement muss an einem Kletterbaum enden.'
  }
  if (
    isTrack &&
    trackEnd &&
    trackEnd.x === x &&
    trackEnd.z === z &&
    Math.abs(trackEnd.elevation - elevation) < 0.01 &&
    !(course.kind === 'waterSlide' && kind === 'ladder')
  ) {
    return 'Das Streckenelement braucht einen anderen Endpunkt.'
  }
  return null
}

export type CourseDirectionChoice = {
  heading: 0 | 1 | 2 | 3
  x: number
  z: number
  elevation: number
  enabled: boolean
  issue: string | null
}

/**
 * Neighbor headings from the open end. Occupied or illegal directions stay listed
 * with `enabled: false` so the path-style arrow menu can grey them.
 */
export function listCourseDirectionChoices(
  course: CourseAttraction,
  kind: CoursePieceKind,
  elevation = COURSE_PIECE_ELEVATION[kind],
): CourseDirectionChoice[] {
  const end = courseTrackEnd(course)
  if (!end || !isCourseTrackPiece(course.kind, kind)) return []
  return ([0, 1, 2, 3] as const).map((heading) => {
    const step = COURSE_HEADINGS[heading] ?? COURSE_HEADINGS[0]!
    const target = { x: end.x + step.x, z: end.z + step.z, elevation }
    const alreadyBuilt = courseHasSpan(course, end, target)
    const occupied =
      !courseUsesArea(course.kind) &&
      courseTrackOccupiesCell(course, target.x, target.z) &&
      !(
        course.kind === 'treeToTree' &&
        isTreeCourseDestination(kind) &&
        occupantsAt(course, target.x, target.z).some((piece) => piece.kind === 'tree')
      )
    const issue = alreadyBuilt
      ? 'In dieser Richtung liegt schon ein Stück.'
      : occupied
        ? 'Dieses Feld ist schon belegt.'
        : describeCourseAppendIssue(course, kind, target.x, target.z, elevation)
    return { heading, ...target, enabled: issue === null, issue }
  })
}

function describeWaterSlideLadderIssue(course: CourseAttraction, x: number, z: number): string | null {
  if (course.pieces.some((piece) =>
    piece.kind === 'waterSlide' || piece.kind === 'poolBasin' || piece.kind === 'exit'
  )) {
    return 'Leitern gehören nur an den Start der Rutsche, nicht an den Auslauf.'
  }
  if (course.pieces.length === 0) return null
  const top = courseTrackEnd(course)
  if (top && top.x === x && top.z === z) return null
  return 'Setze die nächste Leiter auf die bestehende, um höher zu kommen.'
}

function nextLadderStackElevation(course: CourseAttraction, x: number, z: number): number {
  const ladders = occupantsAt(course, x, z).filter((piece) => piece.kind === 'ladder')
  if (ladders.length === 0) return COURSE_PIECE_ELEVATION.ladder
  return Math.max(...ladders.map((piece) => piece.endElevation ?? piece.elevation)) + 1
}

export function appendCoursePiece(
  course: CourseAttraction,
  kind: CoursePieceKind,
  x: number,
  z: number,
  rotation: 0 | 1 | 2 | 3,
  elevation = COURSE_PIECE_ELEVATION[kind],
): CoursePiece | string {
  const issue = describeCourseAppendIssue(course, kind, x, z, elevation)
  if (issue) return issue
  if (course.kind === 'waterSlide' && kind === 'ladder') {
    const stacked = occupantsAt(course, x, z).some((piece) => piece.kind === 'ladder')
    const piece: CoursePiece = {
      id: `${course.id}-p${course.pieces.length}-${x}-${z}-${kind}`,
      kind,
      x,
      z,
      elevation: stacked ? nextLadderStackElevation(course, x, z) : elevation,
      rotation,
    }
    course.pieces.push(piece)
    return piece
  }
  const trackEnd = courseTrackEnd(course)
  const isTrack = isCourseTrackPiece(course.kind, kind)
  const start = isTrack && trackEnd ? trackEnd : { x, z, elevation }
  const piece: CoursePiece = {
    id: `${course.id}-p${course.pieces.length}-${x}-${z}-${kind}`,
    kind,
    x: start.x,
    z: start.z,
    elevation: start.elevation,
    rotation,
    endX: isTrack ? x : undefined,
    endZ: isTrack ? z : undefined,
    endElevation: isTrack ? elevation : undefined,
  }
  course.pieces.push(piece)
  return piece
}

export function removeLastCoursePiece(course: CourseAttraction): CoursePiece | string {
  if (course.riders.length > 0 || course.queue.length > 0) {
    return 'Während Gäste auf dem Kurs sind, geht das nicht.'
  }
  const piece = course.pieces.pop()
  return piece ?? 'Nichts zum Entfernen.'
}

export function normalizeCourses(raw: unknown): CourseAttraction[] {
  if (!Array.isArray(raw)) return []
  const normalized = raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const data = entry as Partial<CourseAttraction>
    if (typeof data.id !== 'string' || !isCourseKind(String(data.kind))) return []
    const kind = data.kind as CourseKind
    const pieces = Array.isArray(data.pieces)
      ? data.pieces.filter((piece): piece is CoursePiece => {
          return (
            Boolean(piece) &&
            typeof piece.id === 'string' &&
            isCoursePieceKind(piece.kind) &&
            Number.isFinite(piece.x) &&
            Number.isFinite(piece.z)
          )
        })
      : []
    return [
      {
        id: data.id,
        kind,
        name: typeof data.name === 'string' ? data.name : COURSE_SPECS[kind].name,
        operating: data.operating !== false,
        price: Math.max(0, Number(data.price) || COURSE_SPECS[kind].price),
        pieces,
        riders: Array.isArray(data.riders) ? data.riders : [],
        queue: Array.isArray(data.queue) ? data.queue : [],
        areaCells: Array.isArray(data.areaCells)
          ? data.areaCells.filter(
              (cell): cell is CourseAreaCell =>
                Boolean(cell) && Number.isFinite(cell.x) && Number.isFinite(cell.z),
            )
          : pieces
              .filter((piece) =>
                kind === 'pool'
                  ? piece.kind === 'poolBasin'
                  : kind === 'paintball' && piece.kind === 'paintballField',
              )
              .map((piece) => ({ x: piece.x, z: piece.z })),
        match: data.match,
        teamSize:
          kind === 'paintball'
            ? Math.max(
                SIMULATION_CONFIG.courses.paintballTeamSizeMin,
                Math.min(
                  SIMULATION_CONFIG.courses.paintballTeamSizeMax,
                  Math.round(Number(data.teamSize) || SIMULATION_CONFIG.courses.paintballTeamSize),
                ),
              )
            : undefined,
      },
    ]
  })
  return splitLegacyPoolSlides(normalized)
}

function splitLegacyPoolSlides(courses: readonly CourseAttraction[]): CourseAttraction[] {
  const result: CourseAttraction[] = []
  for (const course of courses) {
    if (course.kind !== 'pool') {
      result.push(course)
      continue
    }
    const slides = course.pieces.filter((piece) => piece.kind === 'waterSlide')
    if (slides.length === 0) {
      result.push(course)
      continue
    }
    result.push({
      ...course,
      pieces: course.pieces.filter((piece) => piece.kind !== 'waterSlide'),
    })
    slides.forEach((slide, index) => {
      const id = `${course.id}-slide-${index + 1}`
      const pieces: CoursePiece[] = []
      if (slide.kind === 'waterSlide') {
        pieces.push({
          id: `${id}-ladder`,
          kind: 'ladder',
          x: slide.x,
          z: slide.z,
          elevation: slide.elevation,
          rotation: slide.rotation,
        })
        pieces.push(slide)
      }
      result.push({
        id,
        kind: 'waterSlide',
        name: `${course.name} Rutsche ${index + 1}`,
        operating: course.operating,
        price: course.price,
        pieces,
        riders: [],
        queue: [],
        areaCells: [],
      })
    })
  }
  return result
}

export type CourseInjury = { visitorId: string; x: number; z: number; elevation: number }

export function isWaterLanding(
  course: CourseAttraction,
  x: number,
  z: number,
  isWater?: (x: number, z: number) => boolean,
): boolean {
  if (isWater?.(x, z)) return true
  return course.pieces.some(
    (piece) => piece.x === x && piece.z === z && (piece.kind === 'poolBasin' || piece.kind === 'waterDitch'),
  )
}

export function stepCourses(
  state: Pick<GameSnapshot, 'courses' | 'visitors' | 'simTick'>,
  rng: { next(): number },
  options: {
    minutes: number
    charge: (visitor: Visitor, price: number) => boolean
    injure: (injury: CourseInjury) => void
    isWater?: (x: number, z: number) => boolean
  },
): void {
  const courses = state.courses ?? []
  for (const course of courses) {
    if (!course.operating || validateCourse(course)) continue
    admitCourseQueue(course, state.visitors, options.charge)
    if (course.kind === 'paintball') {
      stepPaintball(course, state.visitors, rng)
    }
    advanceCourseRiders(course, state.visitors, rng, options)
  }
}

function admitCourseQueue(
  course: CourseAttraction,
  visitors: Visitor[],
  charge: (visitor: Visitor, price: number) => boolean,
): void {
  const entrance = courseEntrance(course)
  if (!entrance) return
  const capacity = courseCapacityFor(course)
  while (course.riders.length < capacity && course.queue.length > 0) {
    const readyIndex = course.queue.findIndex((visitorId) => {
      const visitor = visitors.find((entry) => entry.id === visitorId)
      return visitor?.state === 'queuing' && visitor.targetId === course.id
    })
    if (readyIndex < 0) break
    const visitorId = course.queue[readyIndex]!
    const visitor = visitors.find((entry) => entry.id === visitorId)
    if (!visitor) {
      course.queue.splice(readyIndex, 1)
      continue
    }
    if (visitor.budget < course.price) {
      course.queue.splice(readyIndex, 1)
      visitor.state = 'exploring'
      visitor.targetId = null
      visitor.thought = 'Das ist mir zu teuer.'
      continue
    }
    if (!charge(visitor, course.price)) {
      course.queue.splice(readyIndex, 1)
      continue
    }
    course.queue.splice(readyIndex, 1)
    visitor.state = 'riding'
    visitor.targetId = course.id
    visitor.route = []
    visitor.thought = `Los geht's: ${course.name}!`
    visitor.x = entrance.x + 0.5
    visitor.z = entrance.z + 0.5
    visitor.cellX = entrance.x
    visitor.cellZ = entrance.z
    const team =
      course.kind === 'paintball'
        ? course.riders.filter((rider) => rider.team === 'a').length <=
          course.riders.filter((rider) => rider.team === 'b').length
          ? 'a'
          : 'b'
        : undefined
    course.riders.push({
      visitorId: visitor.id,
      pieceId: entrance.id,
      progress: 0,
      airborne: false,
      team,
    })
  }
}

function stepPaintball(
  course: CourseAttraction,
  visitors: Visitor[],
  rng: { next(): number },
): void {
  const teamSize = courseTeamSize(course)
  const ready = course.riders.filter((rider) => rider.team)
  if (!course.match) {
    const teamA = ready.filter((rider) => rider.team === 'a').length
    const teamB = ready.filter((rider) => rider.team === 'b').length
    if (teamA >= teamSize && teamB >= teamSize) {
      course.match = {
        remainingTicks: SIMULATION_CONFIG.courses.paintballMatchTicks,
        scoreA: 0,
        scoreB: 0,
      }
      for (const rider of course.riders) {
        const visitor = visitors.find((entry) => entry.id === rider.visitorId)
        if (visitor) visitor.thought = 'Paintball — die Runde läuft!'
      }
    }
    return
  }
  course.match.remainingTicks -= 1
  if (rng.next() < 0.18) course.match.scoreA += 1
  if (rng.next() < 0.18) course.match.scoreB += 1
  if (course.match.remainingTicks > 0) return
  const winner = course.match.scoreA === course.match.scoreB ? null : course.match.scoreA > course.match.scoreB ? 'a' : 'b'
  const exit = courseExit(course)
  for (const rider of course.riders) {
    const visitor = visitors.find((entry) => entry.id === rider.visitorId)
    if (!visitor) continue
    visitor.thought =
      winner === rider.team ? 'Wir haben das Paintball-Match gewonnen!' : 'Das Paintball-Match ist vorbei.'
    visitor.state = 'exploring'
    visitor.targetId = null
    grantAttractionFun(visitor, SIMULATION_CONFIG.courses.funGain)
    if (exit) {
      visitor.x = exit.x + 0.5
      visitor.z = exit.z + 0.5
      visitor.cellX = exit.x
      visitor.cellZ = exit.z
      visitor.y = 0
    }
  }
  course.riders = []
  course.match = undefined
}

function pieceHeight(piece: CoursePiece): number {
  if (piece.kind === 'poolBasin' || piece.kind === 'waterDitch') return 0.12
  if (piece.kind === 'waterSlide' || piece.kind === 'treeZip') return piece.elevation * 0.95 + 0.35
  if (piece.kind === 'tree' || piece.kind === 'treeRing' || piece.kind === 'hangingBridge' || piece.kind === 'treeObstacle') {
    return piece.elevation * 0.9 + 0.2
  }
  return piece.elevation * 0.85
}

const COURSE_RIDER_THOUGHTS: Partial<Record<CoursePieceKind, string>> = {
  poolBasin: 'Ich schwimme im Becken.',
  waterDitch: 'Durch den Wassergraben!',
  treeRing: 'Einmal um den Baum.',
  climbWall: 'Hoch über die Kletterwand!',
  ropeSwing: 'Festhalten und schwingen!',
  treeSwing: 'Festhalten und schwingen!',
  crawlTunnel: 'Durch den Kriechtunnel.',
  ladder: 'Die Leiter hinauf!',
  treeLadder: 'Die Leiter hinauf!',
  jump: 'Absprung!',
  monkeyBars: 'Weiterhangeln!',
  treeObstacle: 'Weiterhangeln!',
  hangingBridge: 'Die Brücke schwankt!',
  treeZip: 'Mit der Seilbahn zum nächsten Baum!',
}

function coursePiecePosition(
  piece: CoursePiece,
  progress: number,
): { x: number; y: number; z: number } {
  const endX = piece.endX ?? piece.x
  const endZ = piece.endZ ?? piece.z
  const endElevation = piece.endElevation ?? piece.elevation
  if (piece.kind === 'treeRing' && progress > 0.4) {
    const circleProgress = (progress - 0.4) / 0.6
    const angle = -Math.PI / 2 + circleProgress * Math.PI * 2
    return {
      x: endX + 0.5 + Math.cos(angle) * 0.34,
      y: endElevation + 0.2,
      z: endZ + 0.5 + Math.sin(angle) * 0.34,
    }
  }
  const lineProgress = piece.kind === 'treeRing' ? Math.min(1, progress / 0.4) : progress
  return {
    x: piece.x + 0.5 + (endX - piece.x) * lineProgress,
    y: pieceHeight(piece) + (endElevation - piece.elevation) * lineProgress,
    z: piece.z + 0.5 + (endZ - piece.z) * lineProgress,
  }
}

function placePaintballFighter(course: CourseAttraction, rider: CourseRider, visitor: Visitor): void {
  const props = course.pieces.filter(
    (piece) =>
      (course.match && piece.kind === 'cover') ||
      (rider.team === 'a' && piece.kind === 'teamStartA') ||
      (rider.team === 'b' && piece.kind === 'teamStartB'),
  )
  const pads: Array<{ x: number; z: number }> = course.match
    ? [...course.areaCells, ...props]
    : props
  const movementStep = course.match
    ? Math.floor(
        (SIMULATION_CONFIG.courses.paintballMatchTicks - course.match.remainingTicks) /
          SIMULATION_CONFIG.courses.paintballMoveIntervalTicks,
      )
    : 0
  const pad =
    pads[((visitor.pathSeed ?? 0) + movementStep) % Math.max(1, pads.length)] ??
    course.pieces[0]
  if (!pad) return
  const side = rider.team === 'b' ? 0.28 : -0.22
  visitor.x = pad.x + 0.5 + side
  visitor.z = pad.z + 0.5
  visitor.cellX = pad.x
  visitor.cellZ = pad.z
  visitor.y = 0.05
  visitor.thought = course.match
    ? rider.team === 'a' ? 'Team Blau, Deckung!' : 'Team Orange, vor!'
    : 'Ich warte am Teamstart auf die nächste Runde.'
}

function launchRider(piece: CoursePiece, rider: CourseRider): void {
  const dx = piece.endX === undefined ? 0 : piece.endX - piece.x
  const dz = piece.endZ === undefined ? 0 : piece.endZ - piece.z
  const magnitude = Math.hypot(dx, dz)
  const dir =
    magnitude > 0.01
      ? { x: dx / magnitude, z: dz / magnitude }
      : headingOffset(piece.rotation)
  const launchElevation = piece.endElevation ?? piece.elevation
  const speed = SIMULATION_CONFIG.courses.slideLaunchSpeed + launchElevation * 0.2
  rider.airborne = true
  rider.airX = (piece.endX ?? piece.x) + 0.5
  rider.airZ = (piece.endZ ?? piece.z) + 0.5
  rider.airY = (piece.endElevation ?? piece.elevation) + 0.2
  rider.vx = dir.x * speed
  rider.vz = dir.z * speed
  rider.vy = 0.1 + launchElevation * 0.04
}

function resolveLanding(
  course: CourseAttraction,
  rider: CourseRider,
  visitor: Visitor,
  options: { injure: (injury: CourseInjury) => void; isWater?: (x: number, z: number) => boolean },
): 'injured' | 'safe' {
  const launchPiece = course.pieces.find((piece) => piece.id === rider.pieceId)
  const land = slideLandingCell(launchPiece ?? {
    id: rider.pieceId,
    kind: 'waterSlide',
    x: Math.floor(rider.airX ?? visitor.x),
    z: Math.floor(rider.airZ ?? visitor.z),
    elevation: 2,
    rotation: 0,
  })
  const x = Math.floor(rider.airX ?? land.x)
  const z = Math.floor(rider.airZ ?? land.z)
  visitor.x = x + 0.5
  visitor.z = z + 0.5
  visitor.cellX = x
  visitor.cellZ = z
  visitor.y = 0.08
  rider.airborne = false
  if (isWaterLanding(course, x, z, options.isWater)) {
    const basin = course.pieces.find(
      (piece) =>
        piece.x === x && piece.z === z &&
        (piece.kind === 'poolBasin' || piece.kind === 'waterDitch'),
    )
    const continuation = launchPiece
      ? nextCoursePieces(course, launchPiece.id).find((piece) => piece.kind !== 'waterSlide')
      : undefined
    if (continuation) rider.pieceId = continuation.id
    else if (basin) rider.pieceId = basin.id
    visitor.thought = 'Sauber im Wasser gelandet!'
    return 'safe'
  }
  options.injure({
    visitorId: visitor.id,
    x,
    z,
    elevation: 0,
  })
  visitor.state = 'injured'
  visitor.targetId = null
  visitor.thought = 'Ich bin neben dem Becken aufgeschlagen!'
  return 'injured'
}

function advanceAirborne(
  course: CourseAttraction,
  rider: CourseRider,
  visitor: Visitor,
  minutes: number,
  options: { injure: (injury: CourseInjury) => void; isWater?: (x: number, z: number) => boolean },
): 'flying' | 'injured' | 'safe' {
  const steps = Math.max(1, Math.round(minutes * 4))
  const dt = minutes / steps
  for (let i = 0; i < steps; i += 1) {
    rider.airX = (rider.airX ?? visitor.x) + (rider.vx ?? 0) * dt
    rider.airZ = (rider.airZ ?? visitor.z) + (rider.vz ?? 0) * dt
    rider.airY = (rider.airY ?? visitor.y) + (rider.vy ?? 0) * dt
    rider.vy = (rider.vy ?? 0) - SIMULATION_CONFIG.courses.slideGravity * dt
    visitor.x = rider.airX
    visitor.z = rider.airZ
    visitor.y = Math.max(0, rider.airY)
    visitor.cellX = Math.floor(visitor.x)
    visitor.cellZ = Math.floor(visitor.z)
    if ((rider.airY ?? 0) <= 0.08) return resolveLanding(course, rider, visitor, options)
  }
  visitor.thought = 'Ich fliege von der Rutsche!'
  return 'flying'
}

function advanceCourseRiders(
  course: CourseAttraction,
  visitors: Visitor[],
  rng: { next(): number },
  options: {
    minutes: number
    injure: (injury: CourseInjury) => void
    isWater?: (x: number, z: number) => boolean
  },
): void {
  const exit = courseExit(course)
  const speed = SIMULATION_CONFIG.courses.progressPerMinute * options.minutes
  const remaining: CourseRider[] = []
  for (const rider of course.riders) {
    const visitor = visitors.find((entry) => entry.id === rider.visitorId)
    if (!visitor || visitor.state !== 'riding') continue
    if (course.kind === 'paintball') {
      placePaintballFighter(course, rider, visitor)
      remaining.push(rider)
      continue
    }
    if (rider.airborne) {
      const flight = advanceAirborne(course, rider, visitor, options.minutes, options)
      if (flight === 'injured') continue
      if (flight === 'flying') {
        remaining.push(rider)
        continue
      }
      rider.progress = 0
    }
    const piece = course.pieces.find((entry) => entry.id === rider.pieceId)
    if (!piece) continue
    const pieceLength = Math.max(
      1,
      Math.hypot(
        (piece.endX ?? piece.x) - piece.x,
        (piece.endZ ?? piece.z) - piece.z,
        (piece.endElevation ?? piece.elevation) - piece.elevation,
      ),
    )
    rider.progress += speed / pieceLength
    if (!rider.airborne) {
      const progress = Math.min(1, rider.progress)
      const pose = coursePiecePosition(piece, progress)
      visitor.x = pose.x
      visitor.z = pose.z
      visitor.cellX = Math.floor(visitor.x)
      visitor.cellZ = Math.floor(visitor.z)
      visitor.y = pose.y
    }
    const riderThought = COURSE_RIDER_THOUGHTS[piece.kind]
    if (riderThought) visitor.thought = riderThought
    if (rider.progress < 1) {
      remaining.push(rider)
      continue
    }
    if (LAUNCH_KINDS.has(piece.kind)) {
      const nextSlide = nextCoursePieces(course, piece.id).find((entry) => entry.kind === piece.kind)
      if (!nextSlide) {
        launchRider(piece, rider)
        remaining.push(rider)
        continue
      }
    }
    if (exit && piece.id === exit.id) {
      visitor.state = 'exploring'
      visitor.targetId = null
      grantAttractionFun(visitor, SIMULATION_CONFIG.courses.funGain)
      visitor.thought = `${course.name} war großartig!`
      continue
    }
    const next = pickNextPiece(course, piece, rng)
    if (!next) {
      remaining.push({ ...rider, progress: 0.8 })
      continue
    }
    remaining.push({
      ...rider,
      pieceId: next.id,
      progress: 0,
      airborne: false,
    })
  }
  course.riders = remaining
}

function pickNextPiece(
  course: CourseAttraction,
  current: CoursePiece,
  rng: { next(): number },
): CoursePiece | undefined {
  const options = nextCoursePieces(course, current.id)
  if (options.length === 0) return undefined
  const exit = courseExit(course)
  if (exit && options.some((piece) => piece.id === exit.id) && rng.next() < 0.35) {
    return exit
  }
  return options[Math.floor(rng.next() * options.length)]
}

export function releaseCourseVisitor(course: CourseAttraction, visitorId: string): void {
  course.queue = course.queue.filter((id) => id !== visitorId)
  course.riders = course.riders.filter((rider) => rider.visitorId !== visitorId)
}

export function courseBuilderHint(kind: CourseKind): string {
  if (kind === 'mudmasters') {
    return 'Am Streckenende erscheinen Richtungspfeile in noch freie Nachbarfelder. Ein Klick setzt das nächste Stück. Wege lassen sich zusätzlich ziehen; Hindernisse verbinden den bisherigen Endpunkt mit dem neuen. Der Pfad muss am Ausgang enden.'
  }
  if (kind === 'pool') {
    return 'Zuerst die Anlagenfläche ziehen, dann Becken und Zugänge darin setzen. Für Weg und Rutsche zeigen Pfeile die freien Nachbarfelder; der Auslauf muss im Becken landen.'
  }
  if (kind === 'treeToTree') {
    return 'Bäume frei setzen. Am Streckenende zeigen Pfeile freie Nachbarfelder; ein Klick setzt das nächste Stück. Längere Spannweiten weiterhin per Zielbaum. Der Pfad endet am Ausgang.'
  }
  if (kind === 'waterSlide') {
    return 'Die Rutsche beginnt immer mit Leitern. Weitere Leitern auf dieselbe Kachel setzen, um Höhe zu gewinnen. Danach die Rutsche per Richtungspfeil anbauen; das Ende ist der Auslauf mit Wasser, keine Leiter.'
  }
  return 'Zuerst die Spielfläche ziehen. Deckungen und beide Teamstarts kommen hinein; Ein- und Ausgang liegen am Flächenrand.'
}
