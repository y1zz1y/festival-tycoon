import { bookFinance } from '../finance'
import {
  TRACK_PIECES,
  createCoasterTelemetry,
  createTrackPiece,
  getCoasterType,
} from '../coasters'
import { describeTrackAppendIssue, isTrackChainLiftEligible } from '../coasterConnections'
import { SIMULATION_CONFIG } from '../simulationConfig'
import type {
  Coaster,
  CoasterTypeId,
  TrackBuildOptions,
  TrackPiece,
  TrackPieceKind,
} from '../coasters'
import type { ActionResult, GameSnapshot } from '../types/snapshot'

export type CoasterCommandContext = {
  state: GameSnapshot
  nextId: (prefix: string) => string
  getPlaceElevation: (x: number, z: number) => number
  isInWorld: (x: number, z: number) => boolean
  canBuildTrackPiece: (
    piece: TrackPiece,
    options?: { coasterId: string; attachPieceIndex: number },
  ) => boolean
  recalculateTrackState: (coaster: Coaster) => void
  recallTrain: (coaster: Coaster) => void
  emit: () => void
}

export function startCoasterCommand(
  context: CoasterCommandContext,
  requestedTypeId: CoasterTypeId,
  x: number,
  z: number,
): ActionResult & { id?: string } {
  const type = getCoasterType(requestedTypeId)
  const piece = createTrackPiece(
    context.nextId('track'),
    'station',
    {
      x,
      z,
      elevation: context.getPlaceElevation(x, z),
      heading: context.state.buildRotation,
      pitch: 0,
      bank: 0,
    },
    false,
  )
  if (!context.canBuildTrackPiece(piece)) {
    return { ok: false, message: 'Für die Startplattform ist nicht genug Platz' }
  }
  if (context.state.money < TRACK_PIECES.station.cost) {
    return { ok: false, message: 'Nicht genug Geld' }
  }

  const id = context.nextId('coaster')
  bookFinance(context.state, 'construction', -TRACK_PIECES.station.cost)
  context.state.coasters.push({
    id,
    typeId: type.id,
    name: `${type.name} ${context.state.coasters.length + 1}`,
    pieces: [piece],
    entrance: null,
    exit: null,
    settings: {
      dispatchMode: 'full-or-timed',
      dispatchIntervalMinutes: SIMULATION_CONFIG.coasters.defaultDispatchIntervalMinutes,
    },
    operationMode: 'closed',
    ticketPrice: type.defaultTicketPrice,
    train: {
      state: 'boarding',
      cars: 1,
      passengers: 0,
      passengerIds: [],
      capacity: type.carCapacity,
      waitMinutes: 0,
      boardingProgress: 0,
      progress: 0,
      distance: 0,
      speed: 0,
      x,
      y: context.state.buildElevation,
      z,
    },
    telemetry: createCoasterTelemetry(),
    queue: [],
    closed: false,
  })
  context.emit()
  return { ok: true, message: 'Startplattform gebaut', id }
}

export function appendCoasterPieceCommand(
  context: CoasterCommandContext,
  coaster: Coaster | undefined,
  kind: TrackPieceKind,
  chainLift: boolean,
  afterPieceIndex?: number,
  options: TrackBuildOptions = {},
): ActionResult {
  if (!coaster) return { ok: false, message: 'Achterbahn nicht gefunden' }
  const anchorIndex = Math.max(
    0,
    Math.min(coaster.pieces.length - 1, afterPieceIndex ?? coaster.pieces.length - 1),
  )
  const anchorPiece = coaster.pieces[anchorIndex]
  if (!anchorPiece) return { ok: false, message: 'Startplattform fehlt' }
  const appendIssue = describeTrackAppendIssue(anchorPiece.end, kind, options, coaster.typeId)
  if (appendIssue) return { ok: false, message: appendIssue }
  if (
    chainLift &&
    !isTrackChainLiftEligible(
      kind,
      anchorPiece.end.pitch,
      options.targetPitch ?? anchorPiece.end.pitch,
      coaster.typeId,
    )
  ) {
    chainLift = false
  }
  const piece = createTrackPiece(
    context.nextId('track'),
    kind,
    anchorPiece.end,
    chainLift,
    options,
  )
  if (
    piece.points.some(
      (point) => point.y < 0 || point.y > 10 || !context.isInWorld(point.x, point.z),
    )
  ) {
    return { ok: false, message: 'Das Schienenelement liegt außerhalb des Baubereichs' }
  }
  if (!context.canBuildTrackPiece(piece, { coasterId: coaster.id, attachPieceIndex: anchorIndex })) {
    return { ok: false, message: 'Das Schienenelement kollidiert mit einem Bauwerk' }
  }
  const cost =
    TRACK_PIECES[kind].cost +
    (piece.chainLift ? SIMULATION_CONFIG.economy.chainLiftCost : 0)
  if (context.state.money < cost) return { ok: false, message: 'Nicht genug Geld' }

  bookFinance(context.state, 'construction', -cost)
  coaster.pieces.splice(anchorIndex + 1, 0, piece)
  resetCoasterAfterTrackChange(context, coaster)
  context.emit()
  return {
    ok: true,
    message: coaster.closed
      ? `${TRACK_PIECES[kind].name} gebaut – Strecke geschlossen`
      : piece.chainLift
        ? `${TRACK_PIECES[kind].name} mit Kettenzug gebaut`
        : `${TRACK_PIECES[kind].name} gebaut`,
  }
}

export function undoCoasterPieceCommand(
  context: CoasterCommandContext,
  coaster: Coaster | undefined,
): ActionResult {
  if (!coaster || coaster.pieces.length <= 1) {
    return { ok: false, message: 'Die Startplattform kann nicht entfernt werden' }
  }
  const piece = coaster.pieces.pop()
  if (!piece) return { ok: false, message: 'Kein Element vorhanden' }
  bookFinance(
    context.state,
    'construction',
    TRACK_PIECES[piece.kind].cost +
      (piece.chainLift ? SIMULATION_CONFIG.economy.chainLiftCost : 0),
  )
  resetCoasterAfterTrackChange(context, coaster)
  context.emit()
  return { ok: true, message: 'Letztes Schienenelement entfernt' }
}

export function deleteCoasterPieceCommand(
  context: CoasterCommandContext,
  coaster: Coaster | undefined,
  pieceIndex: number,
): ActionResult {
  if (!coaster) return { ok: false, message: 'Achterbahn nicht gefunden' }
  if (pieceIndex <= 0 || pieceIndex >= coaster.pieces.length) {
    return { ok: false, message: 'Die erste Startplattform kann nicht gelöscht werden' }
  }
  const removed = coaster.pieces.splice(pieceIndex, 1)[0]
  if (!removed) return { ok: false, message: 'Schienenelement nicht gefunden' }
  bookFinance(
    context.state,
    'construction',
    TRACK_PIECES[removed.kind].cost +
      (removed.chainLift ? SIMULATION_CONFIG.economy.chainLiftCost : 0),
  )
  resetCoasterAfterTrackChange(context, coaster)
  context.emit()
  return { ok: true, message: `${TRACK_PIECES[removed.kind].name} entfernt` }
}

function resetCoasterAfterTrackChange(
  context: CoasterCommandContext,
  coaster: Coaster,
): void {
  context.recalculateTrackState(coaster)
  coaster.telemetry = createCoasterTelemetry()
  coaster.operationMode = 'closed'
  const stations = coaster.pieces.filter((piece) => piece.kind === 'station').length
  coaster.train.cars = stations
  coaster.train.capacity = stations * getCoasterType(coaster.typeId).carCapacity
  context.recallTrain(coaster)
}
