import type { TrackAnchor } from '../coasters'
import type {
  AttractionPoint,
  TrackEdge,
  TrackGraph,
  TrackNode,
  TrackTopology,
} from './types'

const EPSILON = 0.001

export type TrackGraphIssueCode =
  | 'missing-start'
  | 'missing-terminal'
  | 'disconnected'
  | 'branch'
  | 'dead-end'
  | 'not-closed'
  | 'empty'

export type TrackGraphIssue = {
  code: TrackGraphIssueCode
  message: string
  nodeId?: string
}

export type OrderedTrack = {
  edgeIds: string[]
  nodeIds: string[]
  complete: boolean
}

export function sameTrackAnchor(a: TrackAnchor, b: TrackAnchor): boolean {
  return (
    Math.abs(a.x - b.x) < EPSILON &&
    Math.abs(a.z - b.z) < EPSILON &&
    Math.abs(a.elevation - b.elevation) < EPSILON &&
    normalHeading(a.heading) === normalHeading(b.heading) &&
    Math.abs(a.pitch - b.pitch) < EPSILON &&
    Math.abs(a.bank - b.bank) < EPSILON
  )
}

export function anchorKey(anchor: Pick<TrackAnchor, 'x' | 'z' | 'elevation'>): string {
  return `${round(anchor.x)}:${round(anchor.z)}:${round(anchor.elevation)}`
}

export function emptyTrackGraph(): TrackGraph {
  return { nodes: [], edges: [], startNodeId: null, terminalNodeId: null }
}

export function addTrackEdge(
  graph: TrackGraph,
  edge: TrackEdge,
  from: TrackNode,
  to: TrackNode,
): TrackGraph {
  if (graph.edges.some((candidate) => candidate.id === edge.id)) {
    throw new Error(`Track edge ${edge.id} already exists.`)
  }
  const nodes = [...graph.nodes]
  if (!nodes.some((node) => node.id === from.id)) nodes.push(from)
  if (!nodes.some((node) => node.id === to.id)) nodes.push(to)
  if (edge.fromNodeId !== from.id || edge.toNodeId !== to.id) {
    throw new Error('Track edge endpoints do not match the supplied nodes.')
  }
  return {
    ...graph,
    nodes,
    edges: [...graph.edges, edge],
    startNodeId: graph.startNodeId ?? from.id,
    terminalNodeId: graph.terminalNodeId ?? to.id,
  }
}

export function removeTrackEdge(graph: TrackGraph, edgeId: string): TrackGraph {
  const edges = graph.edges.filter((edge) => edge.id !== edgeId)
  const used = new Set(edges.flatMap((edge) => [edge.fromNodeId, edge.toNodeId]))
  if (graph.startNodeId) used.add(graph.startNodeId)
  if (graph.terminalNodeId) used.add(graph.terminalNodeId)
  return {
    ...graph,
    edges,
    nodes: graph.nodes.filter((node) => used.has(node.id)),
  }
}

export function trackAdjacency(graph: TrackGraph): Map<string, TrackEdge[]> {
  const result = new Map<string, TrackEdge[]>()
  graph.nodes.forEach((node) => result.set(node.id, []))
  graph.edges.forEach((edge) => {
    result.get(edge.fromNodeId)?.push(edge)
    result.get(edge.toNodeId)?.push(edge)
  })
  return result
}

export function directedTrackAdjacency(graph: TrackGraph): {
  outgoing: Map<string, TrackEdge[]>
  incoming: Map<string, TrackEdge[]>
} {
  const outgoing = new Map<string, TrackEdge[]>()
  const incoming = new Map<string, TrackEdge[]>()
  graph.nodes.forEach((node) => {
    outgoing.set(node.id, [])
    incoming.set(node.id, [])
  })
  graph.edges.forEach((edge) => {
    outgoing.get(edge.fromNodeId)?.push(edge)
    incoming.get(edge.toNodeId)?.push(edge)
  })
  return { outgoing, incoming }
}

export function trackComponents(graph: TrackGraph): string[][] {
  const adjacency = trackAdjacency(graph)
  const unseen = new Set(graph.nodes.map((node) => node.id))
  const components: string[][] = []
  while (unseen.size > 0) {
    const seed = unseen.values().next().value as string
    const queue = [seed]
    const component: string[] = []
    unseen.delete(seed)
    while (queue.length > 0) {
      const nodeId = queue.shift()!
      component.push(nodeId)
      for (const edge of adjacency.get(nodeId) ?? []) {
        const other = edge.fromNodeId === nodeId ? edge.toNodeId : edge.fromNodeId
        if (unseen.delete(other)) queue.push(other)
      }
    }
    components.push(component)
  }
  return components
}

export function openTrackNodeIds(graph: TrackGraph): string[] {
  const adjacency = trackAdjacency(graph)
  return graph.nodes
    .filter((node) => (adjacency.get(node.id)?.length ?? 0) < 2)
    .map((node) => node.id)
}

export function orderTrackFromStart(graph: TrackGraph): OrderedTrack {
  if (!graph.startNodeId) return { edgeIds: [], nodeIds: [], complete: false }
  const { outgoing } = directedTrackAdjacency(graph)
  const edgeIds: string[] = []
  const nodeIds = [graph.startNodeId]
  const seenEdges = new Set<string>()
  let nodeId = graph.startNodeId
  while (true) {
    const candidates = (outgoing.get(nodeId) ?? []).filter((edge) => !seenEdges.has(edge.id))
    if (candidates.length !== 1) break
    const edge = candidates[0]
    seenEdges.add(edge.id)
    edgeIds.push(edge.id)
    nodeId = edge.toNodeId
    nodeIds.push(nodeId)
    if (nodeId === graph.startNodeId) break
  }
  return {
    edgeIds,
    nodeIds,
    complete: seenEdges.size === graph.edges.length,
  }
}

export function validateTrackGraph(
  graph: TrackGraph,
  topology: TrackTopology,
): TrackGraphIssue[] {
  const issues: TrackGraphIssue[] = []
  if (graph.edges.length === 0) issues.push({ code: 'empty', message: 'Die Strecke enthält keine Teile.' })
  if (!graph.startNodeId) issues.push({ code: 'missing-start', message: 'Der Strecke fehlt ein Startpunkt.' })
  if (topology !== 'closedLoop' && !graph.terminalNodeId) {
    issues.push({ code: 'missing-terminal', message: 'Der Strecke fehlt ein Endpunkt.' })
  }
  const components = trackComponents(graph)
  if (components.length > 1) {
    issues.push({ code: 'disconnected', message: 'Die Strecke ist nicht vollständig verbunden.' })
  }
  const { outgoing, incoming } = directedTrackAdjacency(graph)
  graph.nodes.forEach((node) => {
    const out = outgoing.get(node.id)?.length ?? 0
    const into = incoming.get(node.id)?.length ?? 0
    if (out > 1 || into > 1) {
      issues.push({ code: 'branch', message: 'Strecken dürfen sich nicht verzweigen.', nodeId: node.id })
    }
  })
  const ordered = orderTrackFromStart(graph)
  if (graph.edges.length > 0 && !ordered.complete) {
    issues.push({ code: 'disconnected', message: 'Die Streckenreihenfolge ist vom Start aus nicht eindeutig.' })
  }
  if (topology === 'closedLoop') {
    const endNode = ordered.nodeIds.at(-1)
    if (!graph.startNodeId || endNode !== graph.startNodeId) {
      issues.push({ code: 'not-closed', message: 'Die Achterbahn muss einen geschlossenen Rundkurs bilden.' })
    }
  } else if (graph.terminalNodeId && ordered.nodeIds.at(-1) !== graph.terminalNodeId) {
    issues.push({ code: 'dead-end', message: 'Die Strecke erreicht ihren Endpunkt nicht.' })
  }
  return dedupeIssues(issues)
}

export function sampleTrackCenterline(graph: TrackGraph): AttractionPoint[] {
  const byId = new Map(graph.edges.map((edge) => [edge.id, edge]))
  const result: AttractionPoint[] = []
  orderTrackFromStart(graph).edgeIds.forEach((edgeId) => {
    const points = byId.get(edgeId)?.points ?? []
    points.forEach((point, index) => {
      if (result.length > 0 && index === 0 && samePoint(result.at(-1)!, point)) return
      result.push(point)
    })
  })
  return result
}

export function occupiedTrackCells(graph: TrackGraph): Set<string> {
  const occupied = new Set<string>()
  graph.edges.forEach((edge) => {
    const points = edge.points
    for (let index = 1; index < points.length; index += 1) {
      rasterSegment(points[index - 1], points[index]).forEach((key) => occupied.add(key))
    }
    if (points.length === 1) occupied.add(pointKey(points[0]))
  })
  return occupied
}

export function sampleTrackPoint(
  graph: TrackGraph,
  progress: number,
): AttractionPoint | null {
  const points = sampleTrackCenterline(graph)
  if (points.length === 0) return null
  if (points.length === 1) return points[0]
  const lengths: number[] = []
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]
    const to = points[index]
    total += Math.hypot(to.x - from.x, to.z - from.z, to.elevation - from.elevation)
    lengths.push(total)
  }
  let target = Math.max(0, Math.min(1, progress)) * total
  for (let index = 0; index < lengths.length; index += 1) {
    const previous = index === 0 ? 0 : lengths[index - 1]
    if (target > lengths[index]) continue
    const span = Math.max(EPSILON, lengths[index] - previous)
    const ratio = (target - previous) / span
    const from = points[index]
    const to = points[index + 1]
    return {
      x: from.x + (to.x - from.x) * ratio,
      z: from.z + (to.z - from.z) * ratio,
      elevation: from.elevation + (to.elevation - from.elevation) * ratio,
      heading: to.heading ?? from.heading,
    }
  }
  return points.at(-1)!
}

function rasterSegment(from: AttractionPoint, to: AttractionPoint): string[] {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(to.x - from.x), Math.abs(to.z - from.z)) * 2))
  return Array.from({ length: steps + 1 }, (_, index) => {
    const ratio = index / steps
    return pointKey({
      x: from.x + (to.x - from.x) * ratio,
      z: from.z + (to.z - from.z) * ratio,
      elevation: from.elevation + (to.elevation - from.elevation) * ratio,
    })
  })
}

function pointKey(point: AttractionPoint): string {
  return `${Math.floor(point.x)}:${Math.floor(point.z)}:${round(point.elevation)}`
}

function samePoint(a: AttractionPoint, b: AttractionPoint): boolean {
  return Math.abs(a.x - b.x) < EPSILON &&
    Math.abs(a.z - b.z) < EPSILON &&
    Math.abs(a.elevation - b.elevation) < EPSILON
}

function normalHeading(heading: number): number {
  const turn = Math.PI * 2
  return round(((heading % turn) + turn) % turn)
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function dedupeIssues(issues: TrackGraphIssue[]): TrackGraphIssue[] {
  const keys = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.nodeId ?? ''}`
    if (keys.has(key)) return false
    keys.add(key)
    return true
  })
}
