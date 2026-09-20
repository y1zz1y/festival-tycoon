import { createCoasterTelemetry, isCoasterCircuitClosed, type Coaster, type TrackPiece } from '../coasters'
import { migrateCamping, migrateCoaster, migrateCourse, migratePartyAreas } from './migration'
import type { CampInstallation } from '../camping'
import type {
  CourseAttraction,
  CoursePiece,
} from '../courseAttractions'
import type { StageForecourtCell } from '../festivalAreas'
import type { Attraction } from './types'
import type { GameSnapshot } from '../types/snapshot'

export function refreshAttractionProjections(state: GameSnapshot): void {
  state.coasters = projectCoasters(state.attractions)
  state.courses = projectCourses(state.attractions)
  // Camping overlays and stage forecourts stay the live designate/sync arrays.
  // Projecting them here discarded player edits whenever any attraction changed.
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
 * Inverse of `refreshAttractionProjections`. Coasters, courses, camping overlays
 * and stage forecourts are edited through their live arrays; the canonical
 * `attractions` records are rebuilt from those so a save and MP stay in step.
 * Settings, train, telemetry and queue stay shared references, so tick mutations
 * land in both shapes. Records without a legacy owner are left alone — only
 * `removeCoaster` / `removeCourse` delete ride records.
 */
export function refreshLegacyAttractionRecords(state: GameSnapshot): void {
  const byId = new Map(state.attractions.map((attraction) => [attraction.id, attraction]))
  for (const coaster of state.coasters ?? []) {
    const record = migrateCoaster(coaster)
    if (!record) continue
    const existing = byId.get(coaster.id)
    if (existing) Object.assign(existing, record)
    else state.attractions.push(record)
  }
  for (const course of state.courses ?? []) {
    // `migrateCourse` splits pool water slides into extra ids; only the record
    // that keeps the course id is canonical, so the sync stays idempotent.
    const record = migrateCourse(course).find((entry) => entry.id === course.id)
    if (!record) continue
    const existing = byId.get(course.id)
    if (existing) Object.assign(existing, record)
    else state.attractions.push(record)
  }
  writeCampingAndPartyRecords(state)
}

function writeCampingAndPartyRecords(state: GameSnapshot): void {
  state.attractions = state.attractions.filter((attraction) =>
    attraction.definitionId !== 'camping' && attraction.definitionId !== 'partyArea',
  )
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
 * Cheap change gate for `refreshLegacyAttractionRecords`. Every editor mutation
 * moves a piece, area, access, price or operation mode, so those are enough and
 * the check allocates nothing on the tick path.
 */
export function legacyAttractionSignature(state: GameSnapshot): number {
  let signature = (state.coasters?.length ?? 0) * 31 + (state.courses?.length ?? 0)
  for (const coaster of state.coasters ?? []) {
    signature = signature * 31 +
      coaster.pieces.length * 7 +
      (coaster.entrance ? 3 : 0) +
      (coaster.exit ? 5 : 0) +
      (coaster.closed ? 11 : 0) +
      coaster.operationMode.length +
      Math.round(coaster.ticketPrice * 100)
  }
  for (const course of state.courses ?? []) {
    signature = signature * 31 +
      course.pieces.length * 7 +
      course.areaCells.length * 3 +
      (course.operating ? 13 : 0) +
      (course.teamSize ?? 0) +
      Math.round(course.price * 100)
  }
  signature = signature * 31 +
    (state.campingCells?.length ?? 0) +
    (state.campInstallations?.length ?? 0) * 5 +
    (state.stageForecourtCells?.length ?? 0) * 11
  for (const cell of state.campingCells ?? []) {
    signature = signature * 31 + cell.x + cell.z * 1024
  }
  for (const cell of state.stageForecourtCells ?? []) {
    signature = signature * 31 + cell.x + cell.z * 1024 + (cell.stageId ? 17 : 0)
  }
  return signature
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
    if (attraction.access.entrance) {
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
