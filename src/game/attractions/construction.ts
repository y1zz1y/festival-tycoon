import { getAttractionDefinition } from './definitions'
import {
  addAreaCells,
  canPlaceAreaReference,
  placeAreaReference,
  removeAreaCells,
  validateAreaAttraction,
} from './areaLayout'
import {
  addTrackEdge,
  occupiedTrackCells,
  openTrackNodeIds,
  removeTrackEdge,
  validateTrackGraph,
} from './trackGraph'
import type {
  AreaCell,
  AreaReference,
  Attraction,
  AttractionPoint,
  TrackEdge,
  TrackNode,
} from './types'

export type AttractionConstructionRequest =
  | { kind: 'addTrackEdge'; attractionId: string; edge: TrackEdge; from: TrackNode; to: TrackNode }
  | { kind: 'removeTrackEdge'; attractionId: string; edgeId: string }
  | { kind: 'selectOpenNode'; attractionId: string; nodeId: string }
  | { kind: 'addAreaCells'; attractionId: string; cells: AreaCell[] }
  | { kind: 'removeAreaCells'; attractionId: string; cells: AreaCell[] }
  | { kind: 'placeReference'; attractionId: string; reference: AreaReference }
  | { kind: 'removeReference'; attractionId: string; referenceId: string }
  | { kind: 'setEntrance'; attractionId: string; point: AttractionPoint | null }
  | { kind: 'setExit'; attractionId: string; point: AttractionPoint | null }
  | { kind: 'addScriptedSegment'; attractionId: string; segmentKind: string }
  | { kind: 'removeScriptedSegment'; attractionId: string; segmentId: string }

export type AttractionConstructionResult = {
  ok: boolean
  message: string
  attraction: Attraction
  cost: number
}

export type AttractionCompletionResult = {
  ok: boolean
  messages: string[]
}

/**
 * Pure resolver used by both previews and authoritative commands. Callers
 * replace the attraction only when ok=true.
 */
export function resolveAttractionConstruction(
  attraction: Attraction,
  request: AttractionConstructionRequest,
): AttractionConstructionResult {
  if (request.attractionId !== attraction.id) return failure(attraction, 'Falsche Attraktion.')
  const definition = getAttractionDefinition(attraction.definitionId)
  if (!definition) return failure(attraction, 'Die Attraktionsdefinition fehlt.')

  switch (request.kind) {
    case 'addTrackEdge': {
      if (attraction.layout.kind !== 'track') return failure(attraction, 'Diese Attraktion besitzt keine Strecke.')
      if (!definition.pieceKinds.includes(request.edge.kind)) {
        return failure(attraction, 'Dieses Streckenteil ist für die Attraktion nicht erlaubt.')
      }
      const openNodes = openTrackNodeIds(attraction.layout.graph)
      if (attraction.layout.graph.edges.length > 0 && !openNodes.includes(request.from.id)) {
        return failure(attraction, 'Neue Streckenteile müssen an einem offenen Ende beginnen.')
      }
      if (
        attraction.layout.selectedOpenNodeId &&
        request.from.id !== attraction.layout.selectedOpenNodeId
      ) {
        return failure(attraction, 'Das Streckenteil beginnt nicht am ausgewählten offenen Ende.')
      }
      const occupied = occupiedTrackCells(attraction.layout.graph)
      const collides = request.edge.points.slice(1).some((point) =>
        occupied.has(`${Math.floor(point.x)}:${Math.floor(point.z)}:${round(point.elevation)}`),
      )
      const closesAtStart = attraction.layout.topology === 'closedLoop' &&
        request.to.id === attraction.layout.graph.startNodeId
      if (collides && !closesAtStart) return failure(attraction, 'Das Streckenteil kollidiert mit der Strecke.')
      try {
        const graph = addTrackEdge(attraction.layout.graph, request.edge, request.from, request.to)
        return success({
          ...attraction,
          layout: {
            ...attraction.layout,
            graph,
            selectedOpenNodeId: request.to.id,
          },
        }, request.edge.cost)
      } catch (error) {
        return failure(attraction, error instanceof Error ? error.message : 'Das Streckenteil konnte nicht gebaut werden.')
      }
    }
    case 'removeTrackEdge': {
      if (attraction.layout.kind !== 'track') return failure(attraction, 'Diese Attraktion besitzt keine Strecke.')
      if (!attraction.layout.graph.edges.some((edge) => edge.id === request.edgeId)) {
        return failure(attraction, 'Das Streckenteil existiert nicht.')
      }
      const graph = removeTrackEdge(attraction.layout.graph, request.edgeId)
      const selected = attraction.layout.selectedOpenNodeId
      return success({
        ...attraction,
        operationMode: 'closed',
        layout: {
          ...attraction.layout,
          graph,
          selectedOpenNodeId:
            selected && graph.nodes.some((node) => node.id === selected)
              ? selected
              : openTrackNodeIds(graph)[0] ?? null,
        },
      })
    }
    case 'selectOpenNode': {
      if (attraction.layout.kind !== 'track') return failure(attraction, 'Diese Attraktion besitzt keine Strecke.')
      if (!openTrackNodeIds(attraction.layout.graph).includes(request.nodeId)) {
        return failure(attraction, 'Dieser Punkt ist kein offenes Streckenende.')
      }
      return success({
        ...attraction,
        layout: { ...attraction.layout, selectedOpenNodeId: request.nodeId },
      })
    }
    case 'addAreaCells': {
      if (attraction.layout.kind !== 'area') return failure(attraction, 'Diese Attraktion besitzt keine Fläche.')
      return success({ ...attraction, layout: addAreaCells(attraction.layout, request.cells) })
    }
    case 'removeAreaCells': {
      if (attraction.layout.kind !== 'area') return failure(attraction, 'Diese Attraktion besitzt keine Fläche.')
      return success({
        ...attraction,
        operationMode: 'closed',
        layout: removeAreaCells(attraction.layout, request.cells),
      })
    }
    case 'placeReference': {
      const placement = canPlaceAreaReference(attraction, request.reference)
      if (!placement.ok) return failure(attraction, placement.message)
      return success(placeAreaReference(attraction, request.reference))
    }
    case 'removeReference': {
      if (attraction.layout.kind !== 'area') return failure(attraction, 'Diese Attraktion besitzt keine Fläche.')
      return success({
        ...attraction,
        layout: {
          ...attraction.layout,
          references: attraction.layout.references.filter((reference) => reference.id !== request.referenceId),
        },
      })
    }
    case 'setEntrance':
      return success({ ...attraction, access: { ...attraction.access, entrance: request.point } })
    case 'setExit':
      return success({ ...attraction, access: { ...attraction.access, exit: request.point } })
    case 'addScriptedSegment': {
      if (attraction.layout.kind !== 'scripted') return failure(attraction, 'Diese Attraktion ist nicht stapelbar.')
      if (!definition.pieceKinds.includes(request.segmentKind)) {
        return failure(attraction, 'Dieses Bauteil ist für die Attraktion nicht erlaubt.')
      }
      const level = attraction.layout.segments.length
      return success({
        ...attraction,
        layout: {
          ...attraction.layout,
          segments: [...attraction.layout.segments, {
            id: `${attraction.id}-segment-${level}`,
            kind: request.segmentKind,
            level,
          }],
        },
      })
    }
    case 'removeScriptedSegment': {
      if (attraction.layout.kind !== 'scripted') return failure(attraction, 'Diese Attraktion ist nicht stapelbar.')
      const index = attraction.layout.segments.findIndex((segment) => segment.id === request.segmentId)
      if (index < 0) return failure(attraction, 'Das Bauteil existiert nicht.')
      return success({
        ...attraction,
        operationMode: 'closed',
        layout: {
          ...attraction.layout,
          segments: attraction.layout.segments.slice(0, index),
        },
      })
    }
  }
}

export function validateAttractionCompletion(
  attraction: Attraction,
  allAttractions: readonly Attraction[] = [],
): AttractionCompletionResult {
  const definition = getAttractionDefinition(attraction.definitionId)
  if (!definition) return { ok: false, messages: ['Die Attraktionsdefinition fehlt.'] }
  const messages: string[] = []
  if (attraction.access.mode !== 'free' && !attraction.access.entrance) {
    messages.push('Der Eingang fehlt.')
  }
  if (
    attraction.access.mode === 'entranceExit' ||
    (attraction.layout.kind === 'track' && attraction.layout.topology !== 'openExit')
  ) {
    if (!attraction.access.exit) messages.push('Der Ausgang fehlt.')
  }
  if (attraction.layout.kind === 'track') {
    const layout = attraction.layout
    messages.push(...validateTrackGraph(layout.graph, layout.topology).map((issue) => issue.message))
    if (layout.topology === 'openExit' && layout.agentKind === 'slider') {
      const end = layout.graph.nodes.find((node) =>
        node.id === layout.graph.terminalNodeId
      )
      const landsInWater = end && (
        allAttractions.some((candidate) =>
          candidate.definitionId === 'swimArea' &&
          candidate.layout.kind === 'area' &&
          candidate.layout.cells.some((cell) =>
            cell.x === Math.floor(end.anchor.x) &&
            cell.z === Math.floor(end.anchor.z) &&
            Math.abs(cell.elevation - end.anchor.elevation) <= 2
          )
        ) ||
        layout.graph.edges.some((edge) =>
          edge.kind === 'poolBasin' && edge.toNodeId === end.id
        )
      )
      if (!landsInWater) messages.push('Der Auslauf der Wasserrutsche landet nicht in einer Wasserfläche.')
    }
  } else if (attraction.layout.kind === 'area') {
    messages.push(...validateAreaAttraction(attraction).map((issue) => issue.message))
  } else if (attraction.layout.segments.length === 0) {
    messages.push('Die Attraktion enthält keine Bauteile.')
  }
  return { ok: messages.length === 0, messages: [...new Set(messages)] }
}

function success(attraction: Attraction, cost = 0): AttractionConstructionResult {
  return { ok: true, message: '', attraction, cost }
}

function failure(attraction: Attraction, message: string): AttractionConstructionResult {
  return { ok: false, message, attraction, cost: 0 }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}
