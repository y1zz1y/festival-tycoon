import {
  createCoasterTelemetry,
  isCoasterCircuitClosed,
  type Coaster,
  type TrackAnchor,
  type TrackPiece,
} from '../coasters'
import { hasLiveOwner, isOrphanProjectionRecord, liveOwnerIds } from './dualModel'
import { migrateCamping, migrateCoaster, migrateCourse, migratePartyAreas } from './migration'
import type { CampInstallation, CampingCell } from '../camping'
import type {
  CourseAttraction,
  CoursePiece,
} from '../courseAttractions'
import type { StageForecourtCell } from '../festivalAreas'
import type { Attraction } from './types'
import type { GameSnapshot } from '../types/snapshot'

/**
 * Reverse projection, records → live rows, only for ids the live arrays lack.
 * `projectCoasters` / `projectCourses` are lossy (point pitch/bank, course
 * entrance/exit piece ids, stale queue and riders), so an existing live row is
 * never replaced or edited. The reverse direction is allowed in exactly two
 * places: `migrateSnapshot` when a saved live array is missing or empty (v31
 * saves) and here, on the MP client, for ids an attractions delta carries
 * without their live row. `kinds` limits it to live keys the delta lacked.
 */
export function adoptMissingLiveRows(
  state: GameSnapshot,
  kinds: { coasters: boolean; courses: boolean } = { coasters: true, courses: true },
): void {
  if (!kinds.coasters && !kinds.courses) return
  const owners = liveOwnerIds(state)
  const missing = state.attractions.filter((record) =>
    (record.runtime.kind === 'coaster' || record.runtime.kind === 'course') &&
    !hasLiveOwner(record, owners),
  )
  if (missing.length === 0) return
  const coasters = kinds.coasters ? projectCoasters(missing) : []
  if (coasters.length > 0) state.coasters = [...(state.coasters ?? []), ...coasters]
  const courses = kinds.courses ? projectCourses(missing) : []
  if (courses.length > 0) state.courses = [...(state.courses ?? []), ...courses]
}

export function projectCoasters(attractions: readonly Attraction[]): Coaster[] {
  return attractions.flatMap((attraction) => {
    if (
      attraction.runtime.kind !== 'coaster' ||
      attraction.layout.kind !== 'track'
    ) return []
    const pieces: TrackPiece[] = attraction.layout.graph.edges.map((edge) => {
      const from = attraction.layout.kind === 'track'
        ? attraction.layout.graph.nodes.find((node) => node.id === edge.fromNodeId)
        : undefined
      const to = attraction.layout.kind === 'track'
        ? attraction.layout.graph.nodes.find((node) => node.id === edge.toNodeId)
        : undefined
      return {
        id: edge.id,
        kind: edge.kind as TrackPiece['kind'],
        start: from?.anchor ?? {
          x: edge.points[0]?.x ?? 0,
          z: edge.points[0]?.z ?? 0,
          elevation: edge.points[0]?.elevation ?? 0,
          heading: edge.points[0]?.heading ?? 0,
          pitch: 0,
          bank: 0,
        },
        end: to?.anchor ?? {
          x: edge.points.at(-1)?.x ?? 0,
          z: edge.points.at(-1)?.z ?? 0,
          elevation: edge.points.at(-1)?.elevation ?? 0,
          heading: edge.points.at(-1)?.heading ?? 0,
          pitch: 0,
          bank: 0,
        },
        points: edge.points.map((point) => ({
          x: point.x,
          y: point.elevation,
          z: point.z,
          frameHeading: point.heading,
        })),
        chainLift: edge.metadata?.chainLift === true,
        transition:
          edge.metadata?.transition === 'pitch' || edge.metadata?.transition === 'bank'
            ? edge.metadata.transition
            : undefined,
      }
    })
    const projected: Coaster = {
      id: attraction.id,
      typeId: attraction.runtime.typeId,
      name: attraction.name,
      pieces,
      entrance: attraction.access.entrance
        ? {
            x: attraction.access.entrance.x,
            y: attraction.access.entrance.elevation,
            z: attraction.access.entrance.z,
          }
        : null,
      exit: attraction.access.exit
        ? {
            x: attraction.access.exit.x,
            y: attraction.access.exit.elevation,
            z: attraction.access.exit.z,
          }
        : null,
      settings: attraction.runtime.settings,
      operationMode: attraction.operationMode,
      ticketPrice: attraction.price,
      train: attraction.runtime.train,
      telemetry: attraction.runtime.telemetry ?? createCoasterTelemetry(),
      queue: attraction.queue,
      closed: false,
    }
    // The graph keeps its first node as both start and terminal, so a closed
    // circuit has to be decided on the pieces the same way the editor does.
    projected.closed = isCoasterCircuitClosed(projected)
    return [projected]
  })
}

/**
 * Derives the projection records from the live truth (docs/attractions.md,
 * section "Doppelmodell"). Coasters, courses, camping overlays and stage
 * forecourts are edited through their live arrays; their `attractions` records
 * are rebuilt from those so a save and MP carry the same rides. Every field of
 * such a record is overwritten (`Object.assign`). `queue` and `runtime.*` are
 * only the state of this refresh, because `scrubQueue` / `stepCourses` replace
 * the live arrays every tick, so nothing may read them. A live row that no
 * longer projects (no edges, no cells) loses its record, orphaned coaster/course
 * records and ride records whose `ride` building is gone are dropped, and
 * camping/party records are rebuilt wholesale. Canonical-only records stay.
 */
export function refreshLegacyAttractionRecords(state: GameSnapshot): void {
  const owners = liveOwnerIds(state)
  const records = state.attractions.filter((record) =>
    record.definitionId !== 'camping' &&
    record.definitionId !== 'partyArea' &&
    !isOrphanProjectionRecord(record, owners),
  )
  const byId = new Map(records.map((record) => [record.id, record]))
  const unprojectable = new Set<string>()
  const upsert = (id: string, record: Attraction | null | undefined): void => {
    const existing = byId.get(id)
    if (!record) {
      if (existing) unprojectable.add(id)
      return
    }
    if (existing) {
      Object.assign(existing, record)
      return
    }
    records.push(record)
    byId.set(id, record)
  }
  for (const coaster of state.coasters ?? []) upsert(coaster.id, migrateCoaster(coaster))
  for (const course of state.courses ?? []) {
    // `migrateCourse` splits pool water slides into extra ids; only the record
    // that keeps the course id is canonical, so the sync stays idempotent.
    upsert(course.id, migrateCourse(course).find((entry) => entry.id === course.id))
  }
  state.attractions = unprojectable.size === 0
    ? records
    : records.filter((record) => !unprojectable.has(record.id))
  const camping = migrateCamping(state.campingCells ?? [], state.campInstallations ?? [])
  if (camping) state.attractions.push(...camping)
  state.attractions.push(...migratePartyAreas(state.stageForecourtCells ?? []))
}

export function dropLegacyAttractionRecords(state: GameSnapshot, ownerId: string): void {
  state.attractions = state.attractions.filter((attraction) =>
    attraction.id !== ownerId && !attraction.id.startsWith(`${ownerId}-slide-`),
  )
}

/**
 * Change gate for `refreshLegacyAttractionRecords`, evaluated on every
 * `emit('mutate')` (never per tick). A 32-bit hash over everything a projection
 * record copies: counts, ids, names, types, piece ids/kinds/anchors, gate
 * coordinates, operation mode, price, dispatch settings, course areas, camping
 * cells and installations, forecourt cells with their stage. Each mixing step
 * is a bijection on the running state, so changing a single value always
 * changes the result, and the integer arithmetic can never saturate to
 * Infinity or NaN however large the park grows. It allocates nothing.
 */
export function legacyAttractionSignature(state: GameSnapshot): number {
  let hash = SIGNATURE_SEED
  const coasters = state.coasters ?? []
  hash = mix(hash, coasters.length)
  for (const coaster of coasters) hash = mixCoaster(hash, coaster)
  const courses = state.courses ?? []
  hash = mix(hash, courses.length)
  for (const course of courses) hash = mixCourse(hash, course)
  hash = mixCamping(hash, state.campingCells ?? [], state.campInstallations ?? [])
  hash = mixForecourt(hash, state.stageForecourtCells ?? [])
  return hash >>> 0
}

const SIGNATURE_SEED = 0x811c9dc5
const MISSING_VALUE = 0x7fffffff

function mix(hash: number, word: number): number {
  const mixed = Math.imul(hash ^ word, 0x5bd1e995)
  return mixed ^ (mixed >>> 15)
}

/** Millimetre / milliradian resolution; `NaN` and `Infinity` fold to 0. */
function mixNumber(hash: number, value: number | undefined): number {
  return mix(hash, value === undefined ? MISSING_VALUE : Math.round(value * 1000))
}

function mixString(hash: number, value: string | undefined): number {
  if (value === undefined) return mix(hash, MISSING_VALUE)
  let next = mix(hash, value.length)
  for (let index = 0; index < value.length; index += 1) next = mix(next, value.charCodeAt(index))
  return next
}

function mixPoint(hash: number, point: { x: number; y: number; z: number } | null): number {
  if (!point) return mix(hash, MISSING_VALUE)
  return mixNumber(mixNumber(mixNumber(hash, point.x), point.y), point.z)
}

function mixAnchor(hash: number, anchor: TrackAnchor): number {
  let next = mixNumber(hash, anchor.x)
  next = mixNumber(next, anchor.z)
  next = mixNumber(next, anchor.elevation)
  next = mixNumber(next, anchor.heading)
  next = mixNumber(next, anchor.pitch)
  return mixNumber(next, anchor.bank)
}

function mixCoaster(hash: number, coaster: Coaster): number {
  let next = mixString(hash, coaster.id)
  next = mixString(next, coaster.typeId)
  next = mixString(next, coaster.name)
  next = mixString(next, coaster.operationMode)
  next = mixNumber(next, coaster.ticketPrice)
  next = mix(next, coaster.closed ? 1 : 0)
  next = mixString(next, coaster.settings?.dispatchMode)
  next = mixNumber(next, coaster.settings?.dispatchIntervalMinutes)
  next = mixPoint(next, coaster.entrance)
  next = mixPoint(next, coaster.exit)
  next = mix(next, coaster.pieces.length)
  for (const piece of coaster.pieces) {
    next = mixString(next, piece.id)
    next = mixString(next, piece.kind)
    next = mix(next, piece.chainLift ? 1 : 0)
    next = mixString(next, piece.transition)
    next = mixAnchor(next, piece.start)
    next = mixAnchor(next, piece.end)
    next = mix(next, piece.points.length)
  }
  return next
}

function mixCourse(hash: number, course: CourseAttraction): number {
  let next = mixString(hash, course.id)
  next = mixString(next, course.kind)
  next = mixString(next, course.name)
  next = mix(next, course.operating ? 1 : 0)
  next = mixNumber(next, course.price)
  next = mixNumber(next, course.teamSize)
  next = mix(next, course.pieces.length)
  for (const piece of course.pieces) {
    next = mixString(next, piece.id)
    next = mixString(next, piece.kind)
    next = mixNumber(next, piece.x)
    next = mixNumber(next, piece.z)
    next = mixNumber(next, piece.elevation)
    next = mix(next, piece.rotation)
    next = mixNumber(next, piece.endX)
    next = mixNumber(next, piece.endZ)
    next = mixNumber(next, piece.endElevation)
  }
  next = mix(next, course.areaCells.length)
  for (const cell of course.areaCells) next = mixNumber(mixNumber(next, cell.x), cell.z)
  return next
}

function mixCamping(
  hash: number,
  cells: readonly CampingCell[],
  installations: readonly CampInstallation[],
): number {
  let next = mix(hash, cells.length)
  for (const cell of cells) next = mixCell(next, cell)
  next = mix(next, installations.length)
  for (const installation of installations) {
    next = mixString(next, installation.id)
    next = mixString(next, installation.kind)
    next = mixCell(next, installation.cell)
  }
  return next
}

function mixForecourt(hash: number, cells: readonly StageForecourtCell[]): number {
  let next = mix(hash, cells.length)
  let stageId: string | undefined
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index]
    next = mixCell(next, cell)
    // Neighbouring cells usually share a stage; hash each run of ids once.
    if (index > 0 && cell.stageId === stageId) {
      next = mix(next, 0)
      continue
    }
    stageId = cell.stageId
    next = mixString(mix(next, 1), stageId)
  }
  return next
}

function mixCell(hash: number, cell: { x: number; z: number; elevation: number }): number {
  return mixNumber(mixNumber(mixNumber(hash, cell.x), cell.z), cell.elevation)
}

export function projectCourses(attractions: readonly Attraction[]): CourseAttraction[] {
  return attractions.flatMap((attraction) => {
    if (attraction.runtime.kind !== 'course') return []
    const pieces: CoursePiece[] = []
    if (attraction.layout.kind === 'track') {
      attraction.layout.graph.edges.forEach((edge) => {
        const from = attraction.layout.kind === 'track'
          ? attraction.layout.graph.nodes.find((node) => node.id === edge.fromNodeId)
          : undefined
        const to = attraction.layout.kind === 'track'
          ? attraction.layout.graph.nodes.find((node) => node.id === edge.toNodeId)
          : undefined
        if (!from || !to) return
        pieces.push({
          id: edge.id,
          kind: edge.kind as CoursePiece['kind'],
          x: from.anchor.x,
          z: from.anchor.z,
          elevation: from.anchor.elevation,
          rotation: headingRotation(from.anchor.heading),
          endX: to.anchor.x,
          endZ: to.anchor.z,
          endElevation: to.anchor.elevation,
        })
      })
    } else if (attraction.layout.kind === 'area') {
      attraction.layout.references.forEach((reference) => {
        pieces.push({
          id: reference.id,
          kind: (reference.kind === 'water' ? 'poolBasin' : reference.kind) as CoursePiece['kind'],
          x: reference.x,
          z: reference.z,
          elevation: reference.elevation,
          rotation: reference.rotation,
        })
      })
    }
    if (attraction.access.entrance && attraction.runtime.courseKind !== 'waterSlide') {
      pieces.push({
        id: `${attraction.id}-entrance`,
        kind: 'entrance',
        x: attraction.access.entrance.x,
        z: attraction.access.entrance.z,
        elevation: attraction.access.entrance.elevation,
        rotation: headingRotation(attraction.access.entrance.heading ?? 0),
      })
    }
    if (attraction.access.exit) {
      pieces.push({
        id: `${attraction.id}-exit`,
        kind: 'exit',
        x: attraction.access.exit.x,
        z: attraction.access.exit.z,
        elevation: attraction.access.exit.elevation,
        rotation: headingRotation(attraction.access.exit.heading ?? 0),
      })
    }
    const projected: CourseAttraction = {
      id: attraction.id,
      kind: attraction.runtime.courseKind,
      name: attraction.name,
      operating: attraction.operationMode === 'open',
      price: attraction.price,
      pieces,
      riders: attraction.runtime.riders,
      queue: attraction.queue,
      areaCells: attraction.layout.kind === 'area'
        ? attraction.layout.cells.map(({ x, z }) => ({ x, z }))
        : [],
      teamSize: attraction.runtime.teamSize,
    }
    Object.defineProperty(projected, 'match', {
      enumerable: true,
      configurable: true,
      get: () => attraction.runtime.kind === 'course' ? attraction.runtime.match : undefined,
      set: (value) => {
        if (attraction.runtime.kind === 'course') attraction.runtime.match = value
      },
    })
    return [projected]
  })
}

export function projectCamping(attractions: readonly Attraction[]): {
  cells: Array<{ x: number; z: number; elevation: number }>
  installations: CampInstallation[]
} {
  const camping = attractions.filter((attraction) =>
    attraction.definitionId === 'camping' && attraction.layout.kind === 'area'
  )
  return {
    cells: camping.flatMap((attraction) =>
      attraction.layout.kind === 'area' ? attraction.layout.cells : [],
    ),
    installations: camping.flatMap((attraction) =>
      attraction.layout.kind === 'area' ? attraction.layout.visitorInstallations : [],
    ),
  }
}

export function projectPartyAreas(attractions: readonly Attraction[]): StageForecourtCell[] {
  return attractions.flatMap((attraction) => {
    if (attraction.definitionId !== 'partyArea' || attraction.layout.kind !== 'area') return []
    const stageId = attraction.runtime.kind === 'party' ? attraction.runtime.stageId : undefined
    return attraction.layout.cells.map((cell) => ({ ...cell, stageId }))
  })
}

function headingRotation(heading: number): 0 | 1 | 2 | 3 {
  return (((Math.round(heading / (Math.PI / 2)) % 4) + 4) % 4) as 0 | 1 | 2 | 3
}
