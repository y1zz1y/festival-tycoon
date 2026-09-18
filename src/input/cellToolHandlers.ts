import type { GameState } from '../game/GameState'
import { isSwimmableHeight, isWaterHeight } from '../game/terrain'
import { lockShiftElevationOrigin } from '../game/wayElevation'
import type { Coaster } from '../game/coasters'
import type { CellPosition, PathAnchor } from '../view/WorldView'

export interface CoasterCellState {
  active: boolean
  coasterId: string | null
  accessMode: 'entrance' | 'exit' | null
}

export interface CoasterCellActions {
  setAccessMode(mode: null): void
  continueCoaster(coaster: Coaster): void
  setStart(cell: CellPosition): void
  openFinished(coasterId: string): void
  update(): void
  toast(message: string, error?: boolean): void
}

export function handleCoasterCell(
  game: GameState,
  cell: CellPosition,
  state: CoasterCellState,
  actions: CoasterCellActions,
): boolean {
  if (!state.active) return false
  if (state.accessMode && state.coasterId) {
    const result = game.setCoasterAccess(state.coasterId, state.accessMode, cell.x, cell.z)
    if (result.ok) actions.setAccessMode(null)
    actions.toast(result.message, !result.ok)
    actions.update()
    return true
  }
  const coaster = game.getCoasterAt(cell.x, cell.z)
  if (coaster && !coaster.closed) {
    actions.continueCoaster(coaster)
    actions.toast(`${coaster.name} wird weitergebaut`)
  } else if (coaster) {
    actions.openFinished(coaster.id)
  } else if (!state.coasterId) {
    actions.setStart(cell)
    actions.toast('Startpunkt gesetzt – ausrichten und im Menü bauen')
  } else {
    actions.toast('Wähle im Achterbahn-Editor das nächste Element')
  }
  actions.update()
  return true
}

export interface PathEditorCellState {
  active: boolean
  road: boolean
  buildElevation: number
  constructionType: 'normal' | 'queue'
  direction: number
  slope: number
  footType: NonNullable<Parameters<GameState['placePathSegment']>[6]>
  roadType: NonNullable<Parameters<GameState['placeRoadSegment']>[5]>
  shiftHeld: boolean
  shiftOrigin: PathAnchor | null
}

export interface PathEditorCellResult {
  handled: boolean
  anchor?: PathAnchor
  shiftOrigin?: PathAnchor | null
  message?: string
  error?: boolean
}

export function handlePathEditorCell(
  game: GameState,
  cell: CellPosition,
  state: PathEditorCellState,
): PathEditorCellResult {
  if (!state.active) return { handled: false }
  if (state.road) {
    const existing = game.getRoadCellAt(cell.x, cell.z)
    const result = existing
      ? { ok: true, message: 'Startpunkt gewählt' }
      : game.manageFestival({ type: 'wayArea', from: cell, to: cell, kind: state.roadType })
    if (!result.ok) return { handled: true, message: result.message, error: true }
    const anchor = { x: cell.x, z: cell.z, elevation: existing?.elevation ?? game.getTerrainHeight(cell.x, cell.z) }
    return {
      handled: true, anchor, message: result.message,
      shiftOrigin: state.shiftHeld ? lockShiftElevationOrigin(state.shiftOrigin, anchor) : state.shiftOrigin,
    }
  }
  const existing = game.getPathAt(cell.x, cell.z, state.buildElevation) ?? game.getPathAt(cell.x, cell.z)
  if (existing) {
    const anchor = { x: existing.x, z: existing.z, elevation: existing.elevation }
    return {
      handled: true, anchor, message: 'Startpunkt gewählt',
      shiftOrigin: state.shiftHeld ? lockShiftElevationOrigin(state.shiftOrigin, anchor) : state.shiftOrigin,
    }
  }
  let result = game.placePathSegment(
    cell.x, cell.z, state.buildElevation, state.constructionType,
    state.direction, state.slope, state.footType,
  )
  if (!result.ok && state.slope !== 0) {
    result = game.placePathSegment(
      cell.x, cell.z, state.buildElevation, state.constructionType,
      state.direction, 0, state.footType,
    )
  }
  if (!result.ok) return { handled: true, message: result.message, error: true }
  const anchor = { x: cell.x, z: cell.z, elevation: state.buildElevation }
  return {
    handled: true, anchor, message: result.message,
    shiftOrigin: state.shiftHeld ? lockShiftElevationOrigin(state.shiftOrigin, anchor) : state.shiftOrigin,
  }
}

export interface InspectCellActions {
  openSweeper(id: string): void
  openVehicle(id: string): void
  openCoasterBuilder(id: string): void
  openCoaster(id: string): void
  openAccess(id: string): void
  openRide(id: string): void
  openBuilding(id: string): void
  openDepot(id: string): void
  openWasteDump(x: number, z: number): void
  openBackstage(x: number, z: number): void
  toast(message: string): void
}

export function handleInspectCell(game: GameState, cell: CellPosition, actions: InspectCellActions): boolean {
  if (game.snapshot.selectedTool !== 'inspect') return false
  const vehicle = game.getVehicleAt(cell.x, cell.z)
  if (vehicle) {
    if (vehicle.kind === 'sweeper') actions.openSweeper(vehicle.id)
    else actions.openVehicle(vehicle.id)
    return true
  }
  const coaster = game.getCoasterAt(cell.x, cell.z)
  if (coaster) {
    if (coaster.closed) actions.openCoaster(coaster.id)
    else {
      actions.openCoasterBuilder(coaster.id)
      actions.toast(`${coaster.name} wird am letzten Element fortgesetzt`)
    }
    return true
  }
  const access = game.getAccessControlAt(cell.x, cell.z)
  if (access) { actions.openAccess(access.id); return true }
  const building = cell.buildingId
    ? game.snapshot.buildings.find((entry) => entry.id === cell.buildingId)
    : game.getAt(cell.x, cell.z, undefined, cell.localX, cell.localZ)
  const depot = game.getDepotAt(cell.x, cell.z)
  if (building?.kind === 'ride') actions.openRide(building.id)
  else if (building) actions.openBuilding(building.id)
  else if (depot) actions.openDepot(depot.id)
  else if (game.getCampingCellAt(cell.x, cell.z)) actions.toast('Ausgewiesener Zeltbereich')
  else if (game.getWasteDumpAt(cell.x, cell.z)) actions.openWasteDump(cell.x, cell.z)
  else if (game.getBackstageCellAt(cell.x, cell.z)) actions.openBackstage(cell.x, cell.z)
  else {
    const height = game.getTerrainHeight(cell.x, cell.z)
    actions.toast(isWaterHeight(height, game.getWaterLevel())
      ? isSwimmableHeight(height, game.getWaterLevel()) ? 'Wasser zum Baden' : 'Wasser'
      : height > 0 ? `Hügel Ebene ${height}` : 'Unbebautes Grundstück')
  }
  return true
}
