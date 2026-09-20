import { isCopyTool, isTerrainEditTool, type BuildingKind } from '../game/catalog'
import type { GameState } from '../game/GameState'
import { isScenery, scenerySlot } from '../game/scenery'
import { terrainToolMode } from '../game/terrain'
import type { CellPosition } from '../view/WorldView'
import type { WayType } from '../game/wayTypes'

export interface PathDragModes {
  editorActive: boolean
  demolishActive: boolean
  constructionType: 'normal' | 'queue'
  direction: number
  backstageEraseMode: boolean
}

export interface PathDragServices {
  getGame(): GameState
  getModes(): PathDragModes
  getFootType(): WayType
  getRoadType(): WayType
  applyCopySelection(cells: ReadonlyArray<CellPosition>): void
  demolish(cell: CellPosition, quiet: boolean): boolean
  showToast(message: string, error?: boolean): void
  coursePaintMode?(): 'area' | 'line' | null
  placeCourseCells?(cells: ReadonlyArray<CellPosition>): void
  /** Return false / a rejected promise to skip area demolish (ride confirm). */
  confirmAreaDemolish?(cells: ReadonlyArray<CellPosition>): boolean | Promise<boolean>
}

export interface PathDragView {
  setPathDragPreview(cells: CellPosition[], elevation: number): void
}

export interface PathToolController {
  start(cell: CellPosition): void
  paint(cell: CellPosition): void
  finish(): void
  isDragging(): boolean
  clear(): void
}

const AREA_TOOLS = new Set([
  'camping', 'medicalArea', 'wasteDump', 'stageForecourt', 'backstageArea',
  'parkingArea', 'powerCable', 'bulldoze',
])
const GROUND_ELEVATION_TOOLS = new Set([
  ...AREA_TOOLS, 'road', 'roadDirection', 'roadSeparator', 'fence', 'crosswalk',
  'roadSpeed10', 'roadSpeed30', 'roadSpeed50',
])
const ROAD_EDIT_TOOLS = new Set([
  'roadDirection', 'roadDirectionClear', 'trafficLight', 'pathBarrier', 'roadSeparator', 'crosswalk',
  'roadSpeed10', 'roadSpeed30', 'roadSpeed50',
])

export function rectangleCells(start: CellPosition, end: CellPosition): CellPosition[] {
  const cells: CellPosition[] = []
  for (let x = Math.min(start.x, end.x); x <= Math.max(start.x, end.x); x += 1) {
    for (let z = Math.min(start.z, end.z); z <= Math.max(start.z, end.z); z += 1) cells.push({ x, z })
  }
  return cells
}

export function connectedPathLine(start: CellPosition, end: CellPosition): CellPosition[] {
  const cells: CellPosition[] = [{ ...start }]
  let x = start.x
  let z = start.z
  const dx = Math.abs(end.x - x)
  const dz = Math.abs(end.z - z)
  const sx = x < end.x ? 1 : -1
  const sz = z < end.z ? 1 : -1
  let error = dx - dz
  while (x !== end.x || z !== end.z) {
    const previousX = x
    const previousZ = z
    const twice = error * 2
    if (twice > -dz) { error -= dz; x += sx }
    if (twice < dx) { error += dx; z += sz }
    if (x !== previousX && z !== previousZ) cells.push({ x, z: previousZ })
    cells.push({ x, z })
  }
  return cells
}

function runBulldozeArea(
  game: GameState,
  cells: ReadonlyArray<CellPosition>,
  services: PathDragServices,
): void {
  const proceed = (): void => {
    const result = game.bulldozeArea(cells)
    services.showToast(result.message, !result.ok)
  }
  const gate = services.confirmAreaDemolish?.(cells)
  if (gate === undefined || gate === true) {
    proceed()
    return
  }
  if (gate === false) return
  void Promise.resolve(gate).then((ok) => {
    if (ok) proceed()
  })
}

export function createPathToolController(services: PathDragServices, view: PathDragView): PathToolController {
  let start: CellPosition | null = null
  let end: CellPosition | null = null
  let elevation = 0
  let terrainOriginHeight = 0
  let sceneryDragSlot: number | null = null
  let sceneryRotation = 0

  const clear = (): void => {
    start = null
    end = null
    view.setPathDragPreview([], 0)
  }
  const areaMode = (tool: string): boolean =>
    AREA_TOOLS.has(tool) ||
    isCopyTool(tool as never) ||
    isTerrainEditTool(tool as never) ||
    (tool === 'course' && services.coursePaintMode?.() === 'area')
  const cells = (tool: string): CellPosition[] =>
    areaMode(tool) ? rectangleCells(start!, end!) : connectedPathLine(start!, end!)

  return {
    isDragging: () => Boolean(start),
    clear,
    start(cell) {
      const game = services.getGame()
      if (game.snapshot.selectedTool === 'course' && !services.coursePaintMode?.()) {
        start = null
        return
      }
      if (services.getModes().editorActive && !services.getModes().demolishActive) {
        start = null
        return
      }
      start = { ...cell }
      end = { ...cell }
      terrainOriginHeight = game.getTerrainHeight(cell.x, cell.z)
      if (isScenery(game.snapshot.selectedTool)) {
        sceneryRotation = game.snapshot.buildRotation
        sceneryDragSlot = scenerySlot(game.snapshot.selectedTool, cell.localX, cell.localZ, sceneryRotation) ?? 0
      } else sceneryDragSlot = null
      const tool = game.snapshot.selectedTool
      elevation = GROUND_ELEVATION_TOOLS.has(tool) || isCopyTool(tool) || isTerrainEditTool(tool)
        ? 0
        : game.snapshot.buildElevation
      view.setPathDragPreview([cell], elevation)
    },
    paint(cell) {
      const game = services.getGame()
      const modes = services.getModes()
      if ((modes.editorActive && !modes.demolishActive) || !start) return
      end = { ...cell }
      view.setPathDragPreview(cells(game.snapshot.selectedTool), elevation)
    },
    finish() {
      const game = services.getGame()
      const modes = services.getModes()
      if (!start || !end || (modes.editorActive && !modes.demolishActive)) {
        clear()
        return
      }
      const tool = game.snapshot.selectedTool
      const selectedCells = cells(tool)
      let changed = 0
      if (isCopyTool(tool)) {
        services.applyCopySelection(selectedCells)
      } else if (isScenery(tool)) {
        const slot = sceneryDragSlot ?? scenerySlot(tool, start.localX, start.localZ, sceneryRotation)!
        const result = game.placeSceneryLine(tool as BuildingKind, selectedCells, slot, sceneryRotation)
        services.showToast(result.message, !result.ok)
      } else if (tool === 'bulldoze') {
        runBulldozeArea(game, selectedCells, services)
      } else if (tool === 'camping') {
        const result = game.designateCampingArea(selectedCells); services.showToast(result.message, !result.ok)
      } else if (tool === 'medicalArea') {
        const result = game.designateMedicalArea(selectedCells); services.showToast(result.message, !result.ok)
      } else if (tool === 'wasteDump') {
        const result = game.designateWasteDump(selectedCells); services.showToast(result.message, !result.ok)
      } else if (tool === 'stageForecourt') {
        const result = game.designateStageForecourt(selectedCells); services.showToast(result.message, !result.ok)
      } else if (tool === 'backstageArea') {
        const result = game.designateBackstageArea(selectedCells, !modes.backstageEraseMode); services.showToast(result.message, !result.ok)
      } else if (tool === 'parkingArea') {
        const result = game.designateParkingArea(selectedCells); services.showToast(result.message, !result.ok)
      } else if (tool === 'powerCable') {
        const result = game.designatePowerCableArea(selectedCells); services.showToast(result.message, !result.ok)
      } else if (tool === 'road') {
        for (const cell of selectedCells) {
          const ok = modes.demolishActive
            ? services.demolish(cell, true)
            : game.manageFestival({ type: 'wayArea', from: cell, to: cell, kind: services.getRoadType() }).ok
          if (ok) changed += 1
        }
        services.showToast(`${changed} Straßenfelder ${modes.demolishActive ? 'entfernt' : 'gebaut'}`, changed === 0)
      } else if (ROAD_EDIT_TOOLS.has(tool)) {
        for (const cell of selectedCells) {
          const direction = game.snapshot.buildRotation as 0 | 1 | 2 | 3
          const result = tool === 'roadDirection' ? game.setRoadDirection(cell.x, cell.z, direction)
            : tool === 'roadDirectionClear' ? game.clearRoadDirection(cell.x, cell.z)
            : tool === 'trafficLight' ? game.placeTrafficLight(cell.x, cell.z, direction)
              : tool === 'pathBarrier' ? game.placePathBarrier(cell.x, cell.z, game.snapshot.buildElevation, direction)
                : tool === 'roadSeparator' ? game.toggleRoadSeparator(cell.x, cell.z, direction)
                  : tool === 'crosswalk' ? game.toggleCrosswalk(cell.x, cell.z)
                    : game.setRoadSpeed(cell.x, cell.z, Number(tool.replace('roadSpeed', '')) as 10 | 30 | 50)
          if (result.ok) changed += 1
        }
        services.showToast(
          tool === 'trafficLight' ? `${changed} Ampel${changed === 1 ? '' : 'n'} gesetzt`
            : tool === 'pathBarrier' ? `${changed} Schranke${changed === 1 ? '' : 'n'} gesetzt`
              : `${changed} Straßenfelder geändert`,
          changed === 0,
        )
      } else if (isTerrainEditTool(tool)) {
        const mode = terrainToolMode(tool)
        if (mode) {
          const result = game.editTerrainArea(selectedCells, mode, terrainOriginHeight)
          services.showToast(result.message, !result.ok)
        }
      } else if (tool === 'course' && services.placeCourseCells) {
        services.placeCourseCells(selectedCells)
      } else if (tool === 'fence') {
        for (const cell of selectedCells) if (game.place('fence', cell.x, cell.z).ok) changed += 1
        services.showToast(changed ? `${changed} Bauzaun${changed === 1 ? '' : 'e'} gesetzt` : 'Hier konnte kein Bauzaun gesetzt werden', changed === 0)
      } else if (modes.demolishActive) {
        for (const cell of selectedCells) if (services.demolish(cell, true)) changed += 1
        services.showToast(changed ? `${changed} Wegfeld${changed === 1 ? '' : 'er'} abgerissen` : 'Hier liegt kein Weg', changed === 0)
      } else {
        for (const cell of selectedCells) {
          if (game.getPathAt(cell.x, cell.z, elevation)) continue
          const result = game.placePathSegment(
            cell.x, cell.z, elevation, modes.constructionType,
            modes.constructionType === 'queue' ? modes.direction : 0, 0, services.getFootType(),
          )
          if (!result.ok) { services.showToast(`${result.message} – Bau an dieser Stelle beendet`, true); break }
          changed += 1
        }
        if (changed) services.showToast(`${changed} zusammenhängende Wegfelder gebaut`)
      }
      clear()
    },
  }
}
