import type { GameState, ActionResult } from '../game/GameState'
import type { GameCommand } from './protocol'

export function applyGameCommand(game: GameState, command: GameCommand): ActionResult {
  switch (command.type) {
    case 'startAttraction':
      return game.startAttraction(command.definitionId, command.x, command.z, command.rotation)
    case 'constructAttraction':
      return game.constructAttraction(command.request)
    case 'removeAttraction':
      return game.removeAttraction(command.attractionId)
    case 'setAttractionOperation':
      return game.setAttractionOperation(command.attractionId, command.mode)
    case 'setAttractionPrice':
      return game.setAttractionPrice(command.attractionId, command.price)
    case 'configureAttraction':
      return game.configureAttraction(command.attractionId, command)
    case 'setRideAccess': return game.setRideAccess(command.buildingId, command.accessType, command.x, command.z)
    case 'placeBungee': return game.placeBungee(command.x, command.z, command.height)
    case 'setBungeeHeight': return game.setBungeeHeight(command.id, command.height)
    case 'festival':
      return game.manageFestival(command.action)
    case 'loan':
      return game.manageLoan(command.action)
    case 'place':
      return game.place(command.kind, command.x, command.z, command.decorationSlot)
    case 'stampBlueprint':
      return game.stampBlueprint(command.originX, command.originZ, command.rotation, command.items)
    case 'placePath':
      return game.placePathSegment(
        command.x,
        command.z,
        command.elevation,
        command.pathType,
        command.queueDirection,
        command.slope,
        command.wayType,
      )
    case 'undoPath':
      return game.undoPathSegment(
        command.x,
        command.z,
        command.elevation,
        command.previousPath,
      )
    case 'placeRoad':
      return game.placeRoadSegment(
        command.x,
        command.z,
        command.elevation,
        command.slope,
        command.slopeDirection,
        command.wayType,
      )
    case 'undoRoad':
      return game.undoRoadSegment(command.x, command.z, command.previousRoad, command.elevation)
    case 'bulldoze':
      return game.bulldoze(command.x, command.z, command.buildingId)
    case 'bulldozeArea':
      return game.bulldozeArea(command.cells)
    case 'editTerrain':
      return game.editTerrain(
        command.x,
        command.z,
        command.mode,
        command.corner,
        command.originHeight,
      )
    case 'editTerrainArea':
      return game.editTerrainArea(command.cells, command.mode, command.originHeight)
    case 'designateRoad':
      return game.designateRoad(command.cells)
    case 'designateParking':
      return game.designateParkingArea(command.cells)
    case 'designateCampingCell':
      return game.designateCampingCell(command.x, command.z, command.enabled)
    case 'designateCampingArea':
      return game.designateCampingArea(command.cells)
    case 'designateMedicalArea':
      return game.designateMedicalArea(command.cells)
    case 'designateWasteDump':
      return game.designateWasteDump(command.cells)
    case 'designateStageForecourt':
      return game.designateStageForecourt(command.cells)
    case 'designateBackstageArea':
      return game.designateBackstageArea(command.cells, command.enabled ?? true)
    case 'designatePowerCable':
      return game.designatePowerCable(command.x, command.z, command.enabled)
    case 'designatePowerCableArea':
      return game.designatePowerCableArea(command.cells)
    case 'setRoadDirection':
      return game.setRoadDirection(command.x, command.z, command.direction)
    case 'clearRoadDirection':
      return game.clearRoadDirection(command.x, command.z)
    case 'placeTrafficLight':
      return game.placeTrafficLight(command.x, command.z, command.direction)
    case 'placePathBarrier':
      return game.placePathBarrier(
        command.x,
        command.z,
        command.elevation,
        command.direction,
      )
    case 'configureAccessControl':
      return game.configureAccessControl(command.id, command)
    case 'toggleAccessControlArea':
      return game.toggleAccessControlArea(command.id, command.from, command.to)
    case 'clearAccessControlArea':
      return game.clearAccessControlArea(command.id)
    case 'toggleRoadSeparator':
      return game.toggleRoadSeparator(command.x, command.z, command.direction)
    case 'toggleCrosswalk':
      return game.toggleCrosswalk(command.x, command.z)
    case 'setRoadSpeed':
      return game.setRoadSpeed(command.x, command.z, command.speedLimit)
    case 'setPathFlow':
      return game.setPathFlow(command.x, command.z, command.elevation, command.direction)
    case 'setParkOpen':
      return game.setParkOpen(command.open)
    case 'setSpeed':
      game.setSpeed(command.speed)
      return { ok: true, message: `Tempo ${command.speed}` }
    case 'hireStaff':
      return game.hireStaff(command.role)
    case 'fireStaff':
      return game.fireStaff(command.role)
    case 'fireStaffMember':
      return game.fireStaffMember(command.staffId)
    case 'toggleStaffZone':
      return game.toggleStaffZone(command.staffId, command.key)
    case 'setStaffZone':
      return game.setStaffZone(command.staffId, command.key, command.active)
    case 'buyAmbulance':
      return game.buyAmbulance(command.garageId)
    case 'buyFireTruck':
      return game.buyFireTruck(command.stationId)
    case 'sellAmbulance':
      return game.sellAmbulance(command.garageId)
    case 'sellAmbulanceVehicle':
      return game.sellAmbulanceVehicle(command.vehicleId)
    case 'buyBus':
      return game.buyBus(command.depotId)
    case 'sellBus':
      return game.sellBus(command.depotId)
    case 'buyGarbageTruck':
      return game.buyGarbageTruck(command.depotId)
    case 'sellGarbageTruck':
      return game.sellGarbageTruck(command.depotId)
    case 'buySweeper':
      return game.buySweeper(command.depotId)
    case 'sellSweeper':
      return game.sellSweeper(command.depotId)
    case 'createBusLine':
      return game.createBusLine(
        command.name,
        command.depotId,
        command.stopIds,
        command.busCount,
        command.headway,
      )
    case 'addBusToLine':
      return game.addBusToLine(command.lineId)
    case 'setBusLineStops':
      return game.setBusLineStops(command.lineId, command.stopIds)
    case 'deleteBusLine':
      return game.deleteBusLine(command.lineId)
    case 'startCourse':
      return game.startCourse(command.kind, command.x, command.z)
    case 'startCourseArea':
      return game.startCourseArea(command.kind, command.cells)
    case 'addCourseAreaCell':
      return game.addCourseAreaCell(command.courseId, command.x, command.z)
    case 'addCourseAreaCells':
      return game.addCourseAreaCells(command.courseId, command.cells)
    case 'removeCourseAreaCells':
      return game.removeCourseAreaCells(command.courseId, command.cells)
    case 'addCoursePiece':
      return game.addCoursePiece(
        command.courseId,
        command.kind,
        command.x,
        command.z,
        command.elevation,
      )
    case 'undoCoursePiece':
      return game.undoCoursePiece(command.courseId)
    case 'setCourseOperating':
      return game.setCourseOperating(command.courseId, command.operating)
    case 'setCoursePrice':
      return game.setCoursePrice(command.courseId, command.price)
    case 'setCourseTeamSize':
      return game.setCourseTeamSize(command.courseId, command.teamSize)
    case 'removeCourse':
      return game.removeCourse(command.courseId)
    case 'startCoaster':
      return game.startCoaster(command.typeId, command.x, command.z)
    case 'appendCoasterPiece':
      return game.appendCoasterPiece(
        command.coasterId,
        command.kind,
        command.chainLift,
        command.afterPieceIndex,
        command.options,
      )
    case 'undoCoasterPiece':
      return game.undoCoasterPiece(command.coasterId)
    case 'deleteCoasterPiece':
      return game.deleteCoasterPiece(command.coasterId, command.pieceIndex)
    case 'removeCoaster':
      return game.removeCoaster(command.coasterId)
    case 'setCoasterAccess':
      return game.setCoasterAccess(
        command.coasterId,
        command.accessType,
        command.x,
        command.z,
      )
    case 'updateCoasterSettings':
      game.updateCoasterSettings(
        command.coasterId,
        command.dispatchMode,
        command.intervalMinutes,
      )
      return { ok: true, message: 'Achterbahn-Einstellungen gespeichert' }
    case 'updateCoasterPrice':
      game.updateCoasterPrice(command.coasterId, command.price)
      return { ok: true, message: 'Preis geändert' }
    case 'setCoasterOperationMode':
      return game.setCoasterOperationMode(command.coasterId, command.mode)
    case 'recallCoasterTrain':
      return game.recallCoasterTrain(command.coasterId)
    case 'updateBuildingPrice':
      game.updateBuildingPrice(
        command.buildingId,
        command.price,
        command.allOfKind,
      )
      return { ok: true, message: 'Preis geändert' }
    case 'configureShirtStall':
      return game.configureShirtStall(command.buildingId, {
        color: command.color,
        style: command.style,
      })
    case 'updateEntryPrice':
      game.updateEntryPrice(command.price)
      return { ok: true, message: 'Tagesticketpreis geändert' }
    case 'updateCampingTicketPrice':
      game.updateCampingTicketPrice(command.price)
      return { ok: true, message: 'Campingticketpreis geändert' }
    case 'updateSecurityGate':
      return game.updateSecurityGate(command.id, command.config)
    case 'setDayPlanHour':
      game.setDayPlanHour(command.offer, command.hour, command.active)
      return { ok: true, message: 'Tagesplan geändert' }
    case 'updateDayVisitorWindow':
      return game.updateDayVisitorWindow(command.entryHour, command.exitHour)
    case 'updateCampingCapacityBuffer':
      return game.updateCampingCapacityBuffer(command.percent)
    case 'updateFestivalCycle':
      return game.updateFestivalCycle(
        command.leadDays,
        command.festivalDays,
        command.breakDays,
      )
    case 'addDebugMoney':
      return game.addDebugMoney()
    case 'clearWasteForDebug':
      return game.clearWasteForDebug()
    case 'placeSceneryLine':
      return game.placeSceneryLine(command.kind, command.cells, command.slot, command.rotation)
    case 'removeVisitorCars':
      return game.removeVisitorCarsForDebug()
    default:
      return assertUnhandledCommand(command)
  }
}

function assertUnhandledCommand(command: never): never {
  throw new Error(`Unbekannter Spielbefehl: ${JSON.stringify(command)}`)
}
