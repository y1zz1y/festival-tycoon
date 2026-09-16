import type { GameState } from '../game/GameState'
import { applyGameCommand } from './commands'
import type { GameCommand } from './protocol'

function wrap<Args extends unknown[], Result>(
  game: GameState,
  original: (...args: Args) => Result,
  toCommand: (...args: Args) => GameCommand,
): (...args: Args) => Result {
  return (...args: Args) => {
    const command = toCommand(...args)
    command.context = {
      buildElevation: game.snapshot.buildElevation,
      buildRotation: game.snapshot.buildRotation,
    }
    const blocked = game.gate(command)
    if (blocked) return blocked as Result
    return original.apply(game, args)
  }
}

const boundGames = new WeakSet<GameState>()

export function enableMultiplayerCommands(game: GameState): void {
  if (boundGames.has(game)) return
  boundGames.add(game)
  game.setRideAccess = wrap(game, game.setRideAccess, (buildingId, accessType, x, z) => ({type:'setRideAccess',buildingId,accessType,x,z}))
  game.placeBungee = wrap(game, game.placeBungee, (x, z, height) => ({ type: 'placeBungee', x, z, height }))
  game.setBungeeHeight = wrap(game, game.setBungeeHeight, (id, height) => ({ type: 'setBungeeHeight', id, height }))
  game.place = wrap(game, game.place, (kind, x, z, decorationSlot) => ({
    type: 'place',
    kind,
    decorationSlot,
    x,
    z,
  }))
  game.placePathSegment = wrap(
    game,
    game.placePathSegment,
    (x, z, elevation, pathType = 'normal', queueDirection = 0, slope = 0, wayType) => ({
      type: 'placePath',
      x,
      z,
      elevation,
      pathType,
      queueDirection,
      slope,
      wayType,
    }),
  )
  game.undoPathSegment = wrap(
    game,
    game.undoPathSegment,
    (x, z, elevation, previousPath) => ({
      type: 'undoPath',
      x,
      z,
      elevation,
      previousPath,
    }),
  )
  game.placeRoadSegment = wrap(
    game,
    game.placeRoadSegment,
    (x, z, elevation, slope = 0, slopeDirection = 0, wayType) => ({
      type: 'placeRoad',
      x,
      z,
      elevation,
      slope,
      slopeDirection,
      wayType,
    }),
  )
  game.undoRoadSegment = wrap(game, game.undoRoadSegment, (x, z, previousRoad, elevation) => ({
    type: 'undoRoad',
    x,
    z,
    previousRoad,
    elevation,
  }))
  game.bulldoze = wrap(game, game.bulldoze, (x, z, buildingId) => ({ type: 'bulldoze', x, z, buildingId }))
  game.bulldozeArea = wrap(game, game.bulldozeArea, (cells) => ({
    type: 'bulldozeArea',
    cells: [...cells],
  }))
  game.editTerrain = wrap(game, game.editTerrain, (x, z, mode, corner, originHeight) => ({
    type: 'editTerrain',
    x,
    z,
    mode,
    corner,
    originHeight,
  }))
  game.editTerrainArea = wrap(game, game.editTerrainArea, (cells, mode, originHeight) => ({
    type: 'editTerrainArea',
    cells: [...cells],
    mode,
    originHeight,
  }))
  game.designateRoad = wrap(game, game.designateRoad, (cells) => ({
    type: 'designateRoad',
    cells: [...cells],
  }))
  game.designateParkingArea = wrap(game, game.designateParkingArea, (cells) => ({
    type: 'designateParking',
    cells: [...cells],
  }))
  game.designateCampingCell = wrap(
    game,
    game.designateCampingCell,
    (x, z, enabled = true) => ({ type: 'designateCampingCell', x, z, enabled }),
  )
  game.designateCampingArea = wrap(game, game.designateCampingArea, (cells) => ({
    type: 'designateCampingArea',
    cells: [...cells],
  }))
  game.designateMedicalArea = wrap(game, game.designateMedicalArea, (cells) => ({
    type: 'designateMedicalArea',
    cells: [...cells],
  }))
  game.designateWasteDump = wrap(game, game.designateWasteDump, (cells) => ({
    type: 'designateWasteDump',
    cells: [...cells],
  }))
  game.designateStageForecourt = wrap(
    game,
    game.designateStageForecourt,
    (cells) => ({ type: 'designateStageForecourt', cells: [...cells] }),
  )
  game.designateBackstageArea = wrap(
    game,
    game.designateBackstageArea,
    (cells, enabled = true) => ({
      type: 'designateBackstageArea',
      cells: [...cells],
      enabled,
    }),
  )
  game.designatePowerCable = wrap(
    game,
    game.designatePowerCable,
    (x, z, enabled = true) => ({ type: 'designatePowerCable', x, z, enabled }),
  )
  game.designatePowerCableArea = wrap(
    game,
    game.designatePowerCableArea,
    (cells) => ({ type: 'designatePowerCableArea', cells: [...cells] }),
  )
  game.setRoadDirection = wrap(game, game.setRoadDirection, (x, z, direction) => ({
    type: 'setRoadDirection',
    x,
    z,
    direction,
  }))
  game.placeTrafficLight = wrap(game, game.placeTrafficLight, (x, z, direction) => ({
    type: 'placeTrafficLight',
    x,
    z,
    direction,
  }))
  game.placePathBarrier = wrap(
    game,
    game.placePathBarrier,
    (x, z, elevation, direction) => ({
      type: 'placePathBarrier',
      x,
      z,
      elevation,
      direction,
    }),
  )
  game.configureAccessControl = wrap(game, game.configureAccessControl, (id, patch) => ({
    type: 'configureAccessControl',
    id,
    ...patch,
  }))
  game.toggleAccessControlArea = wrap(
    game,
    game.toggleAccessControlArea,
    (id, from, to) => ({ type: 'toggleAccessControlArea', id, from, to }),
  )
  game.clearAccessControlArea = wrap(game, game.clearAccessControlArea, (id) => ({
    type: 'clearAccessControlArea',
    id,
  }))
  game.toggleRoadSeparator = wrap(
    game,
    game.toggleRoadSeparator,
    (x, z, direction) => ({ type: 'toggleRoadSeparator', x, z, direction }),
  )
  game.toggleCrosswalk = wrap(game, game.toggleCrosswalk, (x, z) => ({
    type: 'toggleCrosswalk',
    x,
    z,
  }))
  game.setRoadSpeed = wrap(game, game.setRoadSpeed, (x, z, speedLimit) => ({
    type: 'setRoadSpeed',
    x,
    z,
    speedLimit,
  }))
  game.setPathFlow = wrap(game, game.setPathFlow, (x, z, elevation, direction) => ({
    type: 'setPathFlow',
    x,
    z,
    elevation,
    direction,
  }))
  game.setParkOpen = wrap(game, game.setParkOpen, (open) => ({
    type: 'setParkOpen',
    open,
  }))
  game.setSpeed = wrap(game, game.setSpeed, (speed) => ({ type: 'setSpeed', speed }))
  game.hireStaff = wrap(game, game.hireStaff, (role) => ({ type: 'hireStaff', role }))
  game.fireStaff = wrap(game, game.fireStaff, (role) => ({ type: 'fireStaff', role }))
  game.fireStaffMember = wrap(game, game.fireStaffMember, (staffId) => ({
    type: 'fireStaffMember',
    staffId,
  }))
  game.toggleStaffZone = wrap(game, game.toggleStaffZone, (staffId, key) => ({
    type: 'toggleStaffZone',
    staffId,
    key,
  }))
  game.setStaffZone = wrap(game, game.setStaffZone, (staffId, key, active) => ({
    type: 'setStaffZone',
    staffId,
    key,
    active,
  }))
  game.buyAmbulance = wrap(game, game.buyAmbulance, (garageId) => ({
    type: 'buyAmbulance',
    garageId,
  }))
  game.buyBus = wrap(game, game.buyBus, (depotId) => ({ type: 'buyBus', depotId }))
  game.sellBus = wrap(game, game.sellBus, (depotId) => ({ type: 'sellBus', depotId }))
  game.buyGarbageTruck = wrap(game, game.buyGarbageTruck, (depotId) => ({
    type: 'buyGarbageTruck',
    depotId,
  }))
  game.sellGarbageTruck = wrap(game, game.sellGarbageTruck, (depotId) => ({
    type: 'sellGarbageTruck',
    depotId,
  }))
  game.buySweeper = wrap(game, game.buySweeper, (depotId) => ({
    type: 'buySweeper',
    depotId,
  }))
  game.sellSweeper = wrap(game, game.sellSweeper, (depotId) => ({
    type: 'sellSweeper',
    depotId,
  }))
  game.createBusLine = wrap(
    game,
    game.createBusLine,
    (name, depotId, stopIds, busCount, headway) => ({
      type: 'createBusLine',
      name,
      depotId,
      stopIds,
      busCount,
      headway,
    }),
  )
  game.deleteBusLine = wrap(game, game.deleteBusLine, (lineId) => ({
    type: 'deleteBusLine',
    lineId,
  }))
  game.startCoaster = wrap(game, game.startCoaster, (typeId, x, z) => ({
    type: 'startCoaster',
    typeId,
    x,
    z,
  }))
  game.appendCoasterPiece = wrap(
    game,
    game.appendCoasterPiece,
    (coasterId, kind, chainLift, afterPieceIndex, options = {}) => ({
      type: 'appendCoasterPiece',
      coasterId,
      kind,
      chainLift,
      afterPieceIndex,
      options,
    }),
  )
  game.undoCoasterPiece = wrap(game, game.undoCoasterPiece, (coasterId) => ({
    type: 'undoCoasterPiece',
    coasterId,
  }))
  game.deleteCoasterPiece = wrap(
    game,
    game.deleteCoasterPiece,
    (coasterId, pieceIndex) => ({ type: 'deleteCoasterPiece', coasterId, pieceIndex }),
  )
  game.removeCoaster = wrap(game, game.removeCoaster, (coasterId) => ({
    type: 'removeCoaster',
    coasterId,
  }))
  game.setCoasterAccess = wrap(
    game,
    game.setCoasterAccess,
    (coasterId, accessType, x, z) => ({
      type: 'setCoasterAccess',
      coasterId,
      accessType,
      x,
      z,
    }),
  )
  game.updateCoasterSettings = wrap(
    game,
    game.updateCoasterSettings,
    (coasterId, dispatchMode, intervalMinutes) => ({
      type: 'updateCoasterSettings',
      coasterId,
      dispatchMode,
      intervalMinutes,
    }),
  )
  game.updateCoasterPrice = wrap(game, game.updateCoasterPrice, (coasterId, price) => ({
    type: 'updateCoasterPrice',
    coasterId,
    price,
  }))
  game.setCoasterOperationMode = wrap(
    game,
    game.setCoasterOperationMode,
    (coasterId, mode) => ({ type: 'setCoasterOperationMode', coasterId, mode }),
  )
  game.recallCoasterTrain = wrap(game, game.recallCoasterTrain, (coasterId) => ({
    type: 'recallCoasterTrain',
    coasterId,
  }))
  game.updateBuildingPrice = wrap(
    game,
    game.updateBuildingPrice,
    (buildingId, price, allOfKind) => ({
      type: 'updateBuildingPrice',
      buildingId,
      price,
      allOfKind,
    }),
  )
  game.configureShirtStall = wrap(
    game,
    game.configureShirtStall,
    (buildingId, settings) => ({
      type: 'configureShirtStall',
      buildingId,
      color: settings.color,
      style: settings.style,
    }),
  )
  game.updateEntryPrice = wrap(game, game.updateEntryPrice, (price) => ({
    type: 'updateEntryPrice',
    price,
  }))
  game.updateCampingTicketPrice = wrap(game, game.updateCampingTicketPrice, (price) => ({
    type: 'updateCampingTicketPrice',
    price,
  }))
  game.updateSecurityGate = wrap(game, game.updateSecurityGate, (id, config) => ({
    type: 'updateSecurityGate',
    id,
    config,
  }))
  game.setDayPlanHour = wrap(game, game.setDayPlanHour, (offer, hour, active) => ({
    type: 'setDayPlanHour',
    offer,
    hour,
    active,
  }))
  game.updateDayVisitorWindow = wrap(
    game,
    game.updateDayVisitorWindow,
    (entryHour, exitHour) => ({ type: 'updateDayVisitorWindow', entryHour, exitHour }),
  )
  game.updateCampingCapacityBuffer = wrap(
    game,
    game.updateCampingCapacityBuffer,
    (percent) => ({ type: 'updateCampingCapacityBuffer', percent }),
  )
  game.updateFestivalCycle = wrap(
    game,
    game.updateFestivalCycle,
    (leadDays, festivalDays, breakDays) => ({
      type: 'updateFestivalCycle',
      leadDays,
      festivalDays,
      breakDays,
    }),
  )
  game.addDebugMoney = wrap(game, game.addDebugMoney, () => ({ type: 'addDebugMoney' }))
  game.clearWasteForDebug = wrap(game, game.clearWasteForDebug, () => ({ type: 'clearWasteForDebug' }))
  game.placeSceneryLine = wrap(game, game.placeSceneryLine, (kind, cells, slot, rotation) => ({ type: 'placeSceneryLine', kind, cells, slot, rotation }))
  game.removeVisitorCarsForDebug = wrap(game, game.removeVisitorCarsForDebug, () => ({
    type: 'removeVisitorCars',
  }))
}

export function executeNetworkCommand(game: GameState, command: GameCommand) {
  game.applyingCommand = true
  try {
    return applyGameCommand(game, command)
  } finally {
    game.applyingCommand = false
  }
}
