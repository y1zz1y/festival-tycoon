import type { CampInstallation, CampingCell } from '../camping'
import type { Coaster, TrackAnchor, TrackPiece } from '../coasters'
import type { CourseAttraction, CoursePiece } from '../courseAttractions'
import type { StageForecourtCell } from '../festivalAreas'
import type { PlacedBuilding } from '../types/entities'
import type {
  AreaCell,
  AreaReference,
  Attraction,
  AttractionPoint,
  LegacyAttractionInput,
  MigratedAttractionResult,
  TrackEdge,
  TrackGraph,
  TrackNode,
} from './types'

export type AttractionMigrationOutput = MigratedAttractionResult & {
  buildings: PlacedBuilding[]
}

export function migrateLegacyAttractions(
  input: LegacyAttractionInput & { buildings?: PlacedBuilding[] },
): AttractionMigrationOutput {
  const attractions: Attraction[] = []
  const removedIds: string[] = []

  for (const coaster of input.coasters ?? []) {
    const converted = migrateCoaster(coaster)
    if (converted) attractions.push(converted)
    else removedIds.push(coaster.id)
  }
  for (const course of input.courses ?? []) {
    const converted = migrateCourse(course)
    if (converted.length > 0) attractions.push(...converted)
    else removedIds.push(course.id)
  }
  migrateCamping(input.campingCells ?? [], input.campInstallations ?? [])
    ?.forEach((attraction) => attractions.push(attraction))
  attractions.push(...migratePartyAreas(input.stageForecourtCells ?? []))

  const buildings: PlacedBuilding[] = []
  for (const building of input.buildings ?? []) {
    if (building.kind !== 'ride') {
      buildings.push(building)
      continue
    }
    attractions.push(migrateScriptedRide(building))
  }
  return { attractions, removedIds, buildings }
}

export function migrateCoaster(coaster: Coaster): Attraction | null {
  const graph = graphFromCoasterPieces(coaster.pieces)
  if (!graph.startNodeId || graph.edges.length === 0) return null
  return {
    id: coaster.id,
    definitionId: `coaster:${coaster.typeId}`,
    name: coaster.name,
    layout: {
      kind: 'track',
      topology: coaster.typeId === 'lsmLaunched' || coaster.typeId === 'limLaunched'
        ? 'shuttle'
        : 'closedLoop',
      agentKind: 'vehicle',
      graph,
      selectedOpenNodeId: graph.terminalNodeId,
    },
    access: {
      mode: 'queuedEntrance',
      entrance: coaster.entrance
        ? point(coaster.entrance.x, coaster.entrance.z, coaster.entrance.y)
        : null,
      exit: coaster.exit ? point(coaster.exit.x, coaster.exit.z, coaster.exit.y) : null,
    },
    operationMode: coaster.operationMode,
    price: coaster.ticketPrice,
    queue: coaster.queue,
    runtime: {
      kind: 'coaster',
      typeId: coaster.typeId,
      settings: coaster.settings,
      train: coaster.train,
      telemetry: coaster.telemetry,
    },
  }
}

export function migrateCourse(course: CourseAttraction): Attraction[] {
  if (course.kind === 'pool') return migratePool(course)
  if (course.kind === 'paintball') {
    const references = course.pieces.map(coursePieceReference)
    return [{
      id: course.id,
      definitionId: 'paintball',
      name: course.name,
      layout: {
        kind: 'area',
        accessMode: 'queuedEntrance',
        cells: course.areaCells.map((cell) => ({ ...cell, elevation: pieceElevation(course, cell.x, cell.z) })),
        references,
        visitorInstallations: [],
      },
      access: courseAccess(course, 'queuedEntrance'),
      operationMode: course.operating ? 'open' : 'closed',
      price: course.price,
      queue: course.queue,
      runtime: {
        kind: 'course',
        courseKind: course.kind,
        riders: course.riders,
        match: course.match,
        teamSize: course.teamSize,
      },
    }]
  }
  const graph = graphFromCoursePieces(course.pieces)
  if (!graph.startNodeId || graph.edges.length === 0) return []
  return [{
    id: course.id,
    definitionId: `course:${course.kind}`,
    name: course.name,
    layout: {
      kind: 'track',
      topology: 'startEnd',
      agentKind: 'pedestrian',
      graph,
      selectedOpenNodeId: graph.terminalNodeId,
    },
    access: courseAccess(course, 'queuedEntrance'),
    operationMode: course.operating ? 'open' : 'closed',
    price: course.price,
    queue: course.queue,
    runtime: {
      kind: 'course',
      courseKind: course.kind,
      riders: course.riders,
    },
  }]
}

export function graphFromCoasterPieces(pieces: readonly TrackPiece[]): TrackGraph {
  const nodes = new Map<string, TrackNode>()
  const edges: TrackEdge[] = []
  pieces.forEach((piece) => {
    const from = nodeForAnchor(nodes, piece.start)
    const to = nodeForAnchor(nodes, piece.end)
    edges.push({
      id: piece.id,
      kind: piece.kind,
      fromNodeId: from.id,
      toNodeId: to.id,
      points: piece.points.map((trackPoint) => ({
        x: trackPoint.x,
        z: trackPoint.z,
        elevation: trackPoint.y,
        heading: trackPoint.frameHeading,
      })),
      cost: 0,
      metadata: {
        chainLift: piece.chainLift,
        transition: piece.transition,
        start: piece.start,
        end: piece.end,
      },
    })
  })
  const first = edges[0]
  return {
    nodes: [...nodes.values()],
    edges,
    startNodeId: first?.fromNodeId ?? null,
    terminalNodeId: first?.fromNodeId ?? null,
  }
}

export function graphFromCoursePieces(pieces: readonly CoursePiece[]): TrackGraph {
  const pathPieces = pieces.filter((piece) => piece.kind !== 'entrance' && piece.kind !== 'exit')
  const nodes = new Map<string, TrackNode>()
  const edges: TrackEdge[] = []
  pathPieces.forEach((piece) => {
    const start = courseAnchor(piece.x, piece.z, piece.elevation, piece.rotation)
    const end = courseAnchor(
      piece.endX ?? piece.x + direction(piece.rotation).x,
      piece.endZ ?? piece.z + direction(piece.rotation).z,
      piece.endElevation ?? piece.elevation,
      piece.rotation,
    )
    const from = nodeForAnchor(nodes, start)
    const to = nodeForAnchor(nodes, end)
    edges.push({
      id: piece.id,
      kind: piece.kind,
      fromNodeId: from.id,
      toNodeId: to.id,
      points: [
        point(start.x, start.z, start.elevation, start.heading),
        point(end.x, end.z, end.elevation, end.heading),
      ],
      cost: 0,
      metadata: { rotation: piece.rotation },
    })
  })
  const starts = new Set(edges.map((edge) => edge.fromNodeId))
  const ends = new Set(edges.map((edge) => edge.toNodeId))
  const startNodeId = edges.find((edge) => !ends.has(edge.fromNodeId))?.fromNodeId ?? edges[0]?.fromNodeId ?? null
  const terminalNodeId = edges.find((edge) => !starts.has(edge.toNodeId))?.toNodeId ?? edges.at(-1)?.toNodeId ?? null
  return { nodes: [...nodes.values()], edges, startNodeId, terminalNodeId }
}

function migratePool(course: CourseAttraction): Attraction[] {
  const result: Attraction[] = []
  const cells: AreaCell[] = course.areaCells.map((cell) => ({
    ...cell,
    elevation: pieceElevation(course, cell.x, cell.z),
  }))
  if (cells.length > 0) {
    result.push({
      id: course.id,
      definitionId: 'swimArea',
      name: course.name,
      layout: {
        kind: 'area',
        accessMode: 'entranceExit',
        cells,
        references: course.pieces
          .filter((piece) => piece.kind !== 'waterSlide')
          .map(coursePieceReference),
        visitorInstallations: [],
      },
      access: courseAccess(course, 'entranceExit'),
      operationMode: course.operating ? 'open' : 'closed',
      price: course.price,
      queue: course.queue,
      runtime: { kind: 'course', courseKind: 'pool', riders: course.riders },
    })
  }
  course.pieces.filter((piece) => piece.kind === 'waterSlide').forEach((slide, index) => {
    const graph = graphFromCoursePieces([slide])
    result.push({
      id: `${course.id}-slide-${index + 1}`,
      definitionId: 'waterSlide',
      name: `${course.name} Rutsche ${index + 1}`,
      layout: {
        kind: 'track',
        topology: 'openExit',
        agentKind: 'slider',
        graph,
        selectedOpenNodeId: graph.terminalNodeId,
      },
      access: {
        mode: 'queuedEntrance',
        entrance: point(slide.x, slide.z, slide.elevation),
        exit: null,
      },
      operationMode: course.operating ? 'open' : 'closed',
      price: 0,
      queue: [],
      runtime: { kind: 'course', courseKind: 'pool', riders: [] },
    })
  })
  return result
}

export function migrateCamping(
  cells: readonly CampingCell[],
  installations: readonly CampInstallation[],
): Attraction[] | null {
  const allCells = [
    ...cells,
    ...installations.map((installation) => installation.cell),
  ].filter((cell, index, all) =>
    all.findIndex((candidate) =>
      candidate.x === cell.x &&
      candidate.z === cell.z &&
      candidate.elevation === cell.elevation
    ) === index
  )
  if (allCells.length === 0) return null
  return [{
    id: 'camping-area',
    definitionId: 'camping',
    name: 'Campingfläche',
    layout: {
      kind: 'area',
      accessMode: 'free',
      cells: allCells,
      references: [],
      visitorInstallations: [...installations],
    },
    access: { mode: 'free', entrance: null, exit: null },
    operationMode: 'open',
    price: 0,
    queue: [],
    runtime: { kind: 'camping' },
  }]
}

export function migratePartyAreas(cells: readonly StageForecourtCell[]): Attraction[] {
  const grouped = new Map<string, StageForecourtCell[]>()
  cells.forEach((cell) => {
    const id = cell.stageId ?? 'free'
    grouped.set(id, [...(grouped.get(id) ?? []), cell])
  })
  return [...grouped].map(([stageId, areaCells]) => ({
    id: `party-area-${stageId}`,
    definitionId: 'partyArea',
    name: 'Partyfläche',
    layout: {
      kind: 'area' as const,
      accessMode: 'free' as const,
      cells: areaCells.map(({ x, z, elevation }) => ({ x, z, elevation })),
      references: stageId === 'free' ? [] : [{
        id: `stage-reference-${stageId}`,
        kind: 'stageReference',
        x: areaCells[0].x,
        z: areaCells[0].z,
        elevation: areaCells[0].elevation,
        rotation: 0 as const,
        metadata: { stageId },
      }],
      visitorInstallations: [],
    },
    access: { mode: 'free' as const, entrance: null, exit: null },
    operationMode: 'open' as const,
    price: 0,
    queue: [],
    runtime: { kind: 'party' as const, stageId: stageId === 'free' ? undefined : stageId },
  }))
}

function migrateScriptedRide(building: PlacedBuilding): Attraction {
  const rideKind = building.rideType === 'bungee' ? 'bungee' : 'carousel'
  return {
    id: building.id,
    definitionId: rideKind,
    name: rideKind === 'bungee' ? 'Bungee-Turm' : 'Karussell',
    layout: {
      kind: 'scripted',
      anchor: point(building.x, building.z, building.elevation),
      rotation: normalizeRotation(building.rotation),
      segments: rideKind === 'bungee'
        ? Array.from({ length: Math.max(1, Math.round((building.bungeeHeight ?? 20) / 4)) }, (_, level) => ({
            id: `${building.id}-tower-${level}`,
            kind: 'towerSegment',
            level,
          }))
        : [{ id: `${building.id}-base`, kind: 'base', level: 0 }],
    },
    access: {
      mode: 'queuedEntrance',
      entrance: building.rideEntrance
        ? point(building.rideEntrance.x, building.rideEntrance.z, building.rideEntrance.y)
        : null,
      exit: building.rideExit
        ? point(building.rideExit.x, building.rideExit.z, building.rideExit.y)
        : null,
    },
    operationMode: 'open',
    price: building.price,
    queue: [],
    runtime: {
      kind: 'scriptedRide',
      rideKind,
      phase: 0,
      remainingMinutes: 0,
      occupantIds: building.bungeeVisitorId ? [building.bungeeVisitorId] : [],
      towerHeight: building.bungeeHeight,
    },
  }
}

function courseAccess(
  course: CourseAttraction,
  mode: 'entranceExit' | 'queuedEntrance',
): Attraction['access'] {
  const entrance = course.pieces.find((piece) => piece.kind === 'entrance')
  const exit = course.pieces.find((piece) => piece.kind === 'exit')
  return {
    mode,
    entrance: entrance ? point(entrance.x, entrance.z, entrance.elevation, entrance.rotation * Math.PI / 2) : null,
    exit: exit ? point(exit.x, exit.z, exit.elevation, exit.rotation * Math.PI / 2) : null,
  }
}

function coursePieceReference(piece: CoursePiece): AreaReference {
  return {
    id: piece.id,
    kind: piece.kind === 'poolBasin' ? 'water' : piece.kind,
    x: piece.x,
    z: piece.z,
    elevation: piece.elevation,
    rotation: piece.rotation,
  }
}

function pieceElevation(course: CourseAttraction, x: number, z: number): number {
  return course.pieces.find((piece) => piece.x === x && piece.z === z)?.elevation ?? 0
}

function nodeForAnchor(nodes: Map<string, TrackNode>, anchor: TrackAnchor): TrackNode {
  const key = [
    round(anchor.x),
    round(anchor.z),
    round(anchor.elevation),
    round(anchor.heading),
    round(anchor.pitch),
    round(anchor.bank),
  ].join(':')
  let node = nodes.get(key)
  if (!node) {
    node = { id: `node-${nodes.size + 1}-${key}`, anchor: { ...anchor } }
    nodes.set(key, node)
  }
  return node
}

function courseAnchor(
  x: number,
  z: number,
  elevation: number,
  rotation: number,
): TrackAnchor {
  return {
    x,
    z,
    elevation,
    heading: rotation * Math.PI / 2,
    pitch: 0,
    bank: 0,
  }
}

function point(x: number, z: number, elevation: number, heading?: number): AttractionPoint {
  return { x, z, elevation, heading }
}

function direction(rotation: number): { x: number; z: number } {
  return [
    { x: 0, z: -1 },
    { x: 1, z: 0 },
    { x: 0, z: 1 },
    { x: -1, z: 0 },
  ][((rotation % 4) + 4) % 4]
}

function normalizeRotation(rotation: number): 0 | 1 | 2 | 3 {
  return (((Math.round(rotation) % 4) + 4) % 4) as 0 | 1 | 2 | 3
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}
