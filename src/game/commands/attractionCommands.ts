import { resolveAttractionConstruction, validateAttractionCompletion } from '../attractions/construction'
import { createAttraction } from '../attractions/factory'
import { refreshAttractionProjections } from '../attractions/projections'
import type { AttractionConstructionRequest } from '../attractions/construction'
import type { AttractionOperationMode } from '../attractions/types'
import type { ActionResult, GameSnapshot } from '../types/snapshot'

export type AttractionCommandContext = {
  state: GameSnapshot
  nextId: (prefix: string) => string
  getPlaceElevation: (x: number, z: number) => number
  recalculateQueues: () => void
  emit: () => void
}

export function startAttractionCommand(
  context: AttractionCommandContext,
  definitionId: string,
  x: number,
  z: number,
  rotation: number,
): ActionResult {
  const id = context.nextId('attraction')
  const attraction = createAttraction(
    id,
    definitionId,
    x,
    z,
    context.getPlaceElevation(x, z),
    normalizeRotation(rotation),
  )
  if (!attraction) return { ok: false, message: 'Unbekannte Attraktionsart.' }
  context.state.attractions.push(attraction)
  refreshAttractionProjections(context.state)
  context.emit()
  return { ok: true, message: 'Attraktion begonnen.', placedId: id }
}

export function constructAttractionCommand(
  context: AttractionCommandContext,
  request: AttractionConstructionRequest,
): ActionResult {
  const index = context.state.attractions.findIndex((attraction) => attraction.id === request.attractionId)
  if (index < 0) return { ok: false, message: 'Attraktion nicht gefunden.' }
  const result = resolveAttractionConstruction(context.state.attractions[index], request)
  if (!result.ok) return { ok: false, message: result.message }
  if (result.cost > context.state.money) return { ok: false, message: 'Nicht genug Geld.' }
  context.state.money -= result.cost
  context.state.attractions[index] = result.attraction
  refreshAttractionProjections(context.state)
  if (request.kind === 'setEntrance' || request.kind === 'setExit') context.recalculateQueues()
  context.emit()
  return { ok: true, message: 'Attraktion geändert.' }
}

export function setAttractionOperationCommand(
  context: AttractionCommandContext,
  attractionId: string,
  mode: AttractionOperationMode,
): ActionResult {
  const attraction = context.state.attractions.find((candidate) => candidate.id === attractionId)
  if (!attraction) return { ok: false, message: 'Attraktion nicht gefunden.' }
  if (mode !== 'closed') {
    const validation = validateAttractionCompletion(attraction, context.state.attractions)
    if (!validation.ok) return { ok: false, message: validation.messages[0] ?? 'Attraktion ist unvollständig.' }
  }
  attraction.operationMode = mode
  refreshAttractionProjections(context.state)
  context.emit()
  return { ok: true, message: mode === 'open' ? 'Attraktion geöffnet.' : mode === 'test' ? 'Testbetrieb gestartet.' : 'Attraktion geschlossen.' }
}

export function setAttractionPriceCommand(
  context: AttractionCommandContext,
  attractionId: string,
  price: number,
): ActionResult {
  const attraction = context.state.attractions.find((candidate) => candidate.id === attractionId)
  if (!attraction) return { ok: false, message: 'Attraktion nicht gefunden.' }
  attraction.price = Math.max(0, Math.min(200, Math.round(price * 2) / 2))
  refreshAttractionProjections(context.state)
  context.emit()
  return { ok: true, message: `Preis auf ${attraction.price.toFixed(2)} € gesetzt.` }
}

export function configureAttractionCommand(
  context: AttractionCommandContext,
  attractionId: string,
  settings: {
    teamSize?: number
    dispatchMode?: 'full-or-timed' | 'full-only' | 'timed'
    dispatchIntervalMinutes?: number
  },
): ActionResult {
  const attraction = context.state.attractions.find((candidate) => candidate.id === attractionId)
  if (!attraction) return { ok: false, message: 'Attraktion nicht gefunden.' }
  if (attraction.runtime.kind === 'course' && settings.teamSize !== undefined) {
    attraction.runtime.teamSize = Math.max(1, Math.min(20, Math.round(settings.teamSize)))
  }
  if (attraction.runtime.kind === 'coaster') {
    if (settings.dispatchMode) attraction.runtime.settings.dispatchMode = settings.dispatchMode
    if (settings.dispatchIntervalMinutes !== undefined) {
      attraction.runtime.settings.dispatchIntervalMinutes = Math.max(
        0.25,
        Math.min(10, settings.dispatchIntervalMinutes),
      )
    }
  }
  refreshAttractionProjections(context.state)
  context.emit()
  return { ok: true, message: 'Betriebseinstellungen gespeichert.' }
}

export function removeAttractionCommand(
  context: AttractionCommandContext,
  attractionId: string,
): ActionResult {
  const index = context.state.attractions.findIndex((candidate) => candidate.id === attractionId)
  if (index < 0) return { ok: false, message: 'Attraktion nicht gefunden.' }
  context.state.attractions.splice(index, 1)
  refreshAttractionProjections(context.state)
  context.state.visitors.forEach((visitor) => {
    if (visitor.targetId !== attractionId) return
    visitor.targetId = null
    visitor.route = []
    visitor.state = 'exploring'
  })
  context.recalculateQueues()
  context.emit()
  return { ok: true, message: 'Attraktion entfernt.' }
}

function normalizeRotation(rotation: number): 0 | 1 | 2 | 3 {
  return (((Math.round(rotation) % 4) + 4) % 4) as 0 | 1 | 2 | 3
}
