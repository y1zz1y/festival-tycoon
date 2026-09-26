import { resolveAttractionConstruction, validateAttractionCompletion } from '../attractions/construction'
import {
  isDerivedAttractionRecord,
  isLegacyAttractionId,
  isProjectionDefinitionId,
  legacyAttractionIds,
} from '../attractions/dualModel'
import { createAttraction } from '../attractions/factory'
import type { AttractionConstructionRequest } from '../attractions/construction'
import type { Attraction, AttractionOperationMode } from '../attractions/types'
import { canAfford } from '../finance'
import type { ActionResult, GameSnapshot } from '../types/snapshot'

/**
 * Canonical attraction commands. They only ever write canonical-only records
 * (today: scripted rides from `startAttraction`). Coasters, courses, `ride`
 * buildings and the camping/party overlays belong to their own editors; their
 * `attractions` records are derived projections (docs/attractions.md,
 * „Doppelmodell"), so these commands refuse them and never project records back
 * over a live row.
 */
export type AttractionCommandContext = {
  state: GameSnapshot
  /** Unique across coasters, courses and attractions (`nextAttractionId`). */
  nextId: (prefix: string) => string
  getPlaceElevation: (x: number, z: number) => number
  recalculateQueues: () => void
  emit: () => void
}

type EditableAttraction = { attraction: Attraction; index: number }

const OWN_EDITOR_MESSAGE =
  'Diese Anlage gehört zu ihrem eigenen Editor (Achterbahn, Kurs, Fahrgeschäft oder Fläche) und lässt sich hier nicht ändern.'

function projectionStartMessage(definitionId: string): string {
  if (definitionId.startsWith('coaster:')) {
    return 'Achterbahnen werden im Achterbahn-Editor gebaut.'
  }
  if (definitionId === 'camping' || definitionId === 'partyArea') {
    return 'Camping- und Partyflächen werden ausgewiesen, nicht als Attraktion gebaut.'
  }
  return 'Kurse, Schwimmbäder, Paintball und Wasserrutschen werden im Kurs-Editor gebaut.'
}

/**
 * Finds a record the canonical commands may change. Legacy ids (a coaster,
 * course or `ride` building owns them) and projection records are refused, so a
 * command can never overwrite or delete the live truth through its projection.
 */
function editableAttraction(
  context: AttractionCommandContext,
  attractionId: string,
): EditableAttraction | ActionResult {
  const legacyIds = legacyAttractionIds(context.state)
  if (isLegacyAttractionId(attractionId, legacyIds)) return { ok: false, message: OWN_EDITOR_MESSAGE }
  const index = context.state.attractions.findIndex((candidate) => candidate.id === attractionId)
  if (index < 0) return { ok: false, message: 'Attraktion nicht gefunden.' }
  const attraction = context.state.attractions[index]
  if (isDerivedAttractionRecord(attraction, legacyIds)) return { ok: false, message: OWN_EDITOR_MESSAGE }
  return { attraction, index }
}

function isRefusal(found: EditableAttraction | ActionResult): found is ActionResult {
  return !('attraction' in found)
}

export function startAttractionCommand(
  context: AttractionCommandContext,
  definitionId: string,
  x: number,
  z: number,
  rotation: number,
): ActionResult {
  if (isProjectionDefinitionId(definitionId)) {
    return { ok: false, message: projectionStartMessage(definitionId) }
  }
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
  context.emit()
  return { ok: true, message: 'Attraktion begonnen.', placedId: id }
}

export function constructAttractionCommand(
  context: AttractionCommandContext,
  request: AttractionConstructionRequest,
): ActionResult {
  const found = editableAttraction(context, request.attractionId)
  if (isRefusal(found)) return found
  const result = resolveAttractionConstruction(found.attraction, request)
  if (!result.ok) return { ok: false, message: result.message }
  if (!canAfford(context.state, result.cost)) return { ok: false, message: 'Nicht genug Geld.' }
  if (!context.state.scenario.authoring) context.state.money -= result.cost
  context.state.attractions[found.index] = result.attraction
  if (request.kind === 'setEntrance' || request.kind === 'setExit') context.recalculateQueues()
  context.emit()
  return { ok: true, message: 'Attraktion geändert.' }
}

export function setAttractionOperationCommand(
  context: AttractionCommandContext,
  attractionId: string,
  mode: AttractionOperationMode,
): ActionResult {
  const found = editableAttraction(context, attractionId)
  if (isRefusal(found)) return found
  const { attraction } = found
  if (mode !== 'closed') {
    const validation = validateAttractionCompletion(attraction, context.state.attractions)
    if (!validation.ok) return { ok: false, message: validation.messages[0] ?? 'Attraktion ist unvollständig.' }
  }
  attraction.operationMode = mode
  context.emit()
  return { ok: true, message: mode === 'open' ? 'Attraktion geöffnet.' : mode === 'test' ? 'Testbetrieb gestartet.' : 'Attraktion geschlossen.' }
}

export function setAttractionPriceCommand(
  context: AttractionCommandContext,
  attractionId: string,
  price: number,
): ActionResult {
  const found = editableAttraction(context, attractionId)
  if (isRefusal(found)) return found
  const { attraction } = found
  attraction.price = Math.max(0, Math.min(200, Math.round(price * 2) / 2))
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
  const found = editableAttraction(context, attractionId)
  if (isRefusal(found)) return found
  const { attraction } = found
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
  context.emit()
  return { ok: true, message: 'Betriebseinstellungen gespeichert.' }
}

export function removeAttractionCommand(
  context: AttractionCommandContext,
  attractionId: string,
): ActionResult {
  const found = editableAttraction(context, attractionId)
  if (isRefusal(found)) return found
  context.state.attractions.splice(found.index, 1)
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
