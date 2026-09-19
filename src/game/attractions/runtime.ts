import { SIMULATION_CONFIG } from '../simulationConfig'
import type { Visitor } from '../types/entities'
import { orderTrackFromStart, sampleTrackPoint } from './trackGraph'
import type { Attraction, AttractionPoint } from './types'

export type AttractionRuntimeHooks = {
  visitors: Visitor[]
  simTick: number
  minutes: number
  charge: (visitor: Visitor, amount: number) => boolean
  injure: (visitor: Visitor, point: AttractionPoint) => void
  isWater: (x: number, z: number, elevation: number) => boolean
}

const PEDESTRIAN_PROGRESS_PER_MINUTE = 0.42
const SLIDER_PROGRESS_PER_MINUTE = 1.25
const SCRIPTED_RIDE_MINUTES = 1.2

export function stepAttractions(
  attractions: Attraction[],
  hooks: AttractionRuntimeHooks,
): void {
  const visitors = new Map(hooks.visitors.map((visitor) => [visitor.id, visitor]))
  attractions.forEach((attraction) => {
    if (attraction.operationMode === 'closed') return
    admitQueuedVisitors(attraction, visitors, hooks)
    if (attraction.layout.kind === 'track') {
      if (attraction.runtime.kind === 'course') {
        stepCourseTrack(attraction, visitors, hooks)
      } else if (attraction.runtime.kind === 'coaster') {
        stepCoasterTrack(attraction, visitors, hooks.minutes)
      }
    } else if (attraction.layout.kind === 'area' && attraction.runtime.kind === 'course') {
      stepAreaCourse(attraction, visitors, hooks.simTick, hooks.minutes)
    } else if (attraction.layout.kind === 'scripted' && attraction.runtime.kind === 'scriptedRide') {
      stepScriptedRide(attraction, visitors, hooks.minutes)
    }
  })
}

function admitQueuedVisitors(
  attraction: Attraction,
  visitors: Map<string, Visitor>,
  hooks: AttractionRuntimeHooks,
): void {
  const capacity = attraction.runtime.kind === 'course'
    ? attraction.runtime.courseKind === 'paintball'
      ? Math.max(2, (attraction.runtime.teamSize ?? 4) * 2)
      : SIMULATION_CONFIG.courses.capacity[attraction.runtime.courseKind]
    : attraction.runtime.kind === 'scriptedRide'
      ? attraction.runtime.rideKind === 'bungee' ? 1 : 8
      : attraction.runtime.kind === 'coaster'
        ? attraction.runtime.train.capacity
        : 0
  const occupants = attraction.runtime.kind === 'course'
    ? attraction.runtime.riders.length
    : attraction.runtime.kind === 'scriptedRide'
      ? attraction.runtime.occupantIds.length
      : attraction.runtime.kind === 'coaster'
        ? attraction.runtime.train.passengerIds.length
        : 0
  let free = Math.max(0, capacity - occupants)
  while (free > 0) {
    const queueIndex = attraction.queue.findIndex((id) => {
      const visitor = visitors.get(id)
      return visitor?.state === 'queuing' && visitor.targetId === attraction.id && visitor.route.length === 0
    })
    if (queueIndex < 0) break
    const visitorId = attraction.queue.splice(queueIndex, 1)[0]
    const visitor = visitors.get(visitorId)
    if (!visitor || !hooks.charge(visitor, attraction.price)) {
      if (visitor) {
        visitor.state = 'exploring'
        visitor.targetId = null
        visitor.thought = 'Das ist mir zu teuer.'
      }
      continue
    }
    visitor.state = 'riding'
    visitor.route = []
    if (attraction.runtime.kind === 'course') {
      const firstEdge = attraction.layout.kind === 'track'
        ? orderTrackFromStart(attraction.layout.graph).edgeIds[0] ?? ''
        : attraction.layout.kind === 'area'
          ? attraction.layout.references[0]?.id ?? ''
          : ''
      attraction.runtime.riders.push({
        visitorId,
        pieceId: firstEdge,
        progress: 0,
        airborne: false,
        team: attraction.runtime.courseKind === 'paintball'
          ? attraction.runtime.riders.length % 2 === 0 ? 'a' : 'b'
          : undefined,
      })
    } else if (attraction.runtime.kind === 'scriptedRide') {
      attraction.runtime.occupantIds.push(visitorId)
    } else if (attraction.runtime.kind === 'coaster') {
      attraction.runtime.train.passengerIds.push(visitorId)
      attraction.runtime.train.passengers = attraction.runtime.train.passengerIds.length
    }
    free -= 1
  }
}

function stepCourseTrack(
  attraction: Attraction,
  visitors: Map<string, Visitor>,
  hooks: AttractionRuntimeHooks,
): void {
  if (attraction.runtime.kind !== 'course' || attraction.layout.kind !== 'track') return
  const layout = attraction.layout
  const runtime = attraction.runtime
  const ordered = orderTrackFromStart(layout.graph)
  const edgeIndexes = new Map(ordered.edgeIds.map((id, index) => [id, index]))
  const speed = layout.agentKind === 'slider'
    ? SLIDER_PROGRESS_PER_MINUTE
    : PEDESTRIAN_PROGRESS_PER_MINUTE
  runtime.riders = runtime.riders.filter((rider) => {
    const visitor = visitors.get(rider.visitorId)
    if (!visitor) return false
    let edgeIndex = edgeIndexes.get(rider.pieceId) ?? 0
    rider.progress += hooks.minutes * speed
    while (rider.progress >= 1) {
      rider.progress -= 1
      edgeIndex += 1
      if (edgeIndex >= ordered.edgeIds.length) {
        finishTrackRider(attraction, visitor, hooks)
        return false
      }
      rider.pieceId = ordered.edgeIds[edgeIndex]
    }
    const overallProgress = ordered.edgeIds.length <= 1
      ? rider.progress
      : (edgeIndex + rider.progress) / ordered.edgeIds.length
    const point = sampleTrackPoint(layout.graph, overallProgress)
    if (point) placeVisitor(visitor, point)
    visitor.thought = thoughtForTrackEdge(layout.graph.edges.find((edge) => edge.id === rider.pieceId)?.kind)
    return true
  })
}

function finishTrackRider(
  attraction: Attraction,
  visitor: Visitor,
  hooks: AttractionRuntimeHooks,
): void {
  if (attraction.layout.kind !== 'track') return
  const layout = attraction.layout
  const endpoint = layout.graph.nodes.find((node) =>
    node.id === layout.graph.terminalNodeId
  )?.anchor
  if (endpoint) placeVisitor(visitor, endpoint)
  if (
    layout.topology === 'openExit' &&
    endpoint &&
    !hooks.isWater(endpoint.x, endpoint.z, endpoint.elevation)
  ) {
    hooks.injure(visitor, endpoint)
    return
  }
  visitor.state = 'exploring'
  visitor.targetId = null
  visitor.thought = layout.agentKind === 'slider'
    ? 'Die Wasserrutsche war großartig!'
    : 'Der Parcours war großartig!'
}

function stepCoasterTrack(
  attraction: Attraction,
  visitors: Map<string, Visitor>,
  minutes: number,
): void {
  if (attraction.runtime.kind !== 'coaster' || attraction.layout.kind !== 'track') return
  const layout = attraction.layout
  const train = attraction.runtime.train
  if (train.state === 'boarding') {
    train.waitMinutes += minutes
    const full = train.passengerIds.length >= train.capacity
    const timed = train.waitMinutes >= attraction.runtime.settings.dispatchIntervalMinutes
    if (
      train.passengerIds.length > 0 &&
      (attraction.runtime.settings.dispatchMode === 'full-only' ? full
        : attraction.runtime.settings.dispatchMode === 'timed' ? timed
          : full || timed)
    ) {
      train.state = 'running'
      train.waitMinutes = 0
      train.progress = 0
      train.distance = 0
    }
  } else if (train.state === 'running') {
    const duration = layout.topology === 'shuttle' ? 2.5 : 1.8
    train.distance += minutes / duration
    if (layout.topology === 'shuttle') {
      train.progress = train.distance <= 0.5
        ? train.distance * 2
        : Math.max(0, 2 - train.distance * 2)
    } else {
      train.progress = train.distance
    }
    if (train.distance >= 1) train.state = 'unloading'
  } else {
    train.passengerIds.splice(0).forEach((id) => {
      const visitor = visitors.get(id)
      if (!visitor) return
      visitor.state = 'exploring'
      visitor.targetId = null
      visitor.thought = layout.topology === 'shuttle'
        ? 'Die Rückwärtsfahrt war aufregend!'
        : 'Die Achterbahn war großartig!'
    })
    train.passengers = 0
    train.progress = 0
    train.distance = 0
    train.state = 'boarding'
  }
  const point = sampleTrackPoint(layout.graph, train.progress)
  if (!point) return
  train.x = point.x
  train.y = point.elevation
  train.z = point.z
  train.passengerIds.forEach((id) => {
    const visitor = visitors.get(id)
    if (visitor) placeVisitor(visitor, point)
  })
}

function stepAreaCourse(
  attraction: Attraction,
  visitors: Map<string, Visitor>,
  simTick: number,
  minutes: number,
): void {
  if (attraction.runtime.kind !== 'course' || attraction.layout.kind !== 'area') return
  if (attraction.layout.cells.length === 0) return
  const layout = attraction.layout
  const runtime = attraction.runtime
  if (runtime.courseKind === 'paintball' && runtime.riders.length >= 2 && !runtime.match) {
    runtime.match = {
      remainingTicks: SIMULATION_CONFIG.courses.paintballMatchTicks,
      scoreA: 0,
      scoreB: 0,
    }
  }
  if (runtime.match) {
    runtime.match.remainingTicks = Math.max(0, runtime.match.remainingTicks - 1)
    if (simTick % SIMULATION_CONFIG.courses.paintballShotCycleTicks === 0) {
      const scoringTeam = Math.floor(simTick / SIMULATION_CONFIG.courses.paintballShotCycleTicks) % 2
      if (scoringTeam === 0) runtime.match.scoreA += 1
      else runtime.match.scoreB += 1
    }
  }
  runtime.riders = runtime.riders.filter((rider, index) => {
    const visitor = visitors.get(rider.visitorId)
    if (!visitor) return false
    rider.progress += runtime.courseKind === 'paintball'
      ? 0
      : minutes / 2
    if (
      (runtime.match && runtime.match.remainingTicks === 0) ||
      (runtime.courseKind !== 'paintball' && rider.progress >= 1)
    ) {
      visitor.state = 'exploring'
      visitor.targetId = null
      visitor.thought = runtime.courseKind === 'paintball'
        ? 'Was für ein Paintballspiel!'
        : 'Das Wasser war herrlich!'
      return false
    }
    const cellIndex = Math.abs(Math.floor(simTick / 20) + index * 7) % layout.cells.length
    const cell = layout.cells[cellIndex]
    placeVisitor(visitor, {
      x: cell.x + 0.5,
      z: cell.z + 0.5,
      elevation: cell.elevation,
    })
    visitor.thought = runtime.courseKind === 'paintball'
      ? 'Deckung! Ich markiere das andere Team!'
      : 'Das Wasser ist herrlich!'
    return true
  })
  if (runtime.match?.remainingTicks === 0) runtime.match = undefined
}

function stepScriptedRide(
  attraction: Attraction,
  visitors: Map<string, Visitor>,
  minutes: number,
): void {
  if (attraction.layout.kind !== 'scripted' || attraction.runtime.kind !== 'scriptedRide') return
  const layout = attraction.layout
  const runtime = attraction.runtime
  if (runtime.occupantIds.length === 0) return
  runtime.remainingMinutes += minutes
  runtime.phase = (runtime.phase + minutes / SCRIPTED_RIDE_MINUTES) % 1
  const height = runtime.rideKind === 'bungee'
    ? Math.sin(runtime.phase * Math.PI) * (runtime.towerHeight ?? 20)
    : 0.5
  runtime.occupantIds.forEach((id) => {
    const visitor = visitors.get(id)
    if (!visitor) return
    placeVisitor(visitor, {
      ...layout.anchor,
      elevation: layout.anchor.elevation + height,
    })
  })
  if (runtime.remainingMinutes < SCRIPTED_RIDE_MINUTES) return
  runtime.remainingMinutes = 0
  runtime.occupantIds.splice(0).forEach((id) => {
    const visitor = visitors.get(id)
    if (!visitor) return
    visitor.state = 'exploring'
    visitor.targetId = null
    visitor.thought = runtime.rideKind === 'bungee'
      ? 'Was für ein Bungeesprung!'
      : 'Das Karussell war großartig!'
  })
}

function placeVisitor(visitor: Visitor, point: AttractionPoint): void {
  visitor.x = point.x
  visitor.z = point.z
  visitor.y = point.elevation
  visitor.cellX = Math.floor(point.x)
  visitor.cellZ = Math.floor(point.z)
  visitor.cellElevation = point.elevation
}

function thoughtForTrackEdge(kind: string | undefined): string {
  switch (kind) {
    case 'ropeSwing':
    case 'treeSwing':
      return 'Ich schwinge am Seil!'
    case 'jump':
      return 'Jetzt springen!'
    case 'climbWall':
    case 'treeObstacle':
      return 'Das ist eine echte Kletterherausforderung!'
    case 'hangingBridge':
      return 'Die Hängebrücke wackelt!'
    case 'treeZip':
      return 'Mit der Seilbahn durch die Bäume!'
    case 'crawlTunnel':
      return 'Durch den Tunnel!'
    default:
      return 'Weiter durch den Parcours!'
  }
}
