import { isTerrainEditTool, type BuildingKind, type Tool } from '../game/catalog'
import type { CourseKind } from '../game/courseAttractions'
import { terrainCornerIndex, terrainToolMode } from '../game/terrain'
import { scenerySlot } from '../game/scenery'
import type { GameState } from '../game/GameState'
import type { ActionResult } from '../game/types/snapshot'
import type { WayType } from '../game/wayTypes'

export type ClickCell = {
  x: number
  z: number
  localX?: number
  localZ?: number
  buildingId?: string
}

export type DirectToolContext = {
  pathConstructionType: 'normal' | 'queue'
  pathDirection: number
  footType: Parameters<GameState['placePathSegment']>[6]
  roadType: WayType
  backstageEraseMode: boolean
  bungeeBuildMode: boolean
  bungeeHeight: number
  courseKind?: CourseKind
}

export type DirectToolResult = {
  handled: boolean
  result?: ActionResult
  placedAccessId?: string
  placedDepot?: { x: number; z: number }
  placedRide?: { x: number; z: number; elevation: number }
}

const unhandled: DirectToolResult = { handled: false }

/**
 * Routes ordinary map tools to the public GameState facade. Higher-priority
 * editor modes (ride gates, planners, coaster/path construction and inspect)
 * remain with the app coordinator and call this only as their fallback.
 */
export function applyDirectCellTool(
  game: GameState,
  cell: ClickCell,
  context: DirectToolContext,
): DirectToolResult {
  const tool = game.snapshot.selectedTool
  if (isTerrainEditTool(tool)) {
    const mode = terrainToolMode(tool)
    return mode
      ? {
          handled: true,
          result: game.editTerrain(
            cell.x,
            cell.z,
            mode,
            terrainCornerIndex(cell.localX ?? 0.5, cell.localZ ?? 0.5),
          ),
        }
      : { handled: true }
  }

  if (tool === 'road') {
    return {
      handled: true,
      result: game.manageFestival({
        type: 'wayArea',
        from: cell,
        to: cell,
        kind: context.roadType,
      }),
    }
  }
  if (tool === 'parkingArea') {
    return { handled: true, result: game.designateParkingArea([cell]) }
  }
  if (tool === 'roadDirection') {
    return {
      handled: true,
      result: game.setRoadDirection(
        cell.x,
        cell.z,
        game.snapshot.buildRotation as 0 | 1 | 2 | 3,
      ),
    }
  }
  if (tool === 'trafficLight') {
    const result = game.placeTrafficLight(
      cell.x,
      cell.z,
      game.snapshot.buildRotation as 0 | 1 | 2 | 3,
    )
    return { handled: true, result, placedAccessId: result.ok ? result.placedId : undefined }
  }
  if (tool === 'pathBarrier') {
    const result = game.placePathBarrier(
      cell.x,
      cell.z,
      game.snapshot.buildElevation,
      game.snapshot.buildRotation as 0 | 1 | 2 | 3,
    )
    return { handled: true, result, placedAccessId: result.ok ? result.placedId : undefined }
  }
  if (tool === 'roadSeparator') {
    return {
      handled: true,
      result: game.toggleRoadSeparator(
        cell.x,
        cell.z,
        game.snapshot.buildRotation as 0 | 1 | 2 | 3,
      ),
    }
  }
  if (tool === 'deliveryYard' || tool === 'supplyDepot') {
    const result = game.manageFestival({
      type: 'depot',
      x: cell.x,
      z: cell.z,
      role: tool === 'deliveryYard' ? 'delivery' : 'storage',
    })
    return {
      handled: true,
      result,
      placedDepot: result.ok ? { x: cell.x, z: cell.z } : undefined,
    }
  }
  if (tool === 'staffGate') {
    const path = game.snapshot.buildings.find(
      (building) =>
        building.kind === 'path' && building.x === cell.x && building.z === cell.z,
    )
    return {
      handled: true,
      result: game.manageFestival({
        type: 'staffGate',
        ...cell,
        elevation: path?.elevation ?? 0,
        direction: game.snapshot.buildRotation as 0 | 1 | 2 | 3,
      }),
    }
  }
  if (tool === 'crosswalk') {
    return { handled: true, result: game.toggleCrosswalk(cell.x, cell.z) }
  }
  if (tool === 'roadSpeed10' || tool === 'roadSpeed30' || tool === 'roadSpeed50') {
    return {
      handled: true,
      result: game.setRoadSpeed(
        cell.x,
        cell.z,
        Number(tool.replace('roadSpeed', '')) as 10 | 30 | 50,
      ),
    }
  }
  if (tool === 'path') {
    return {
      handled: true,
      result: game.placePathSegment(
        cell.x,
        cell.z,
        game.snapshot.buildElevation,
        context.pathConstructionType,
        context.pathConstructionType === 'queue' ? context.pathDirection : 0,
        0,
        context.footType,
      ),
    }
  }
  if (tool === 'bulldoze') {
    return {
      handled: true,
      result: game.bulldoze(
        cell.x,
        cell.z,
        cell.buildingId ??
          game.getAt(cell.x, cell.z, undefined, cell.localX, cell.localZ)?.id,
      ),
    }
  }
  if (tool === 'inspect' || tool === 'copy' || tool === 'coaster' || tool === 'course') return unhandled

  const result =
    tool === 'camping'
      ? game.designateCampingCell(cell.x, cell.z)
      : tool === 'medicalArea'
        ? game.designateMedicalArea([cell])
        : tool === 'wasteDump'
          ? game.designateWasteDump([cell])
          : tool === 'stageForecourt'
            ? game.designateStageForecourt([cell])
            : tool === 'backstageArea'
              ? game.designateBackstageArea([cell], !context.backstageEraseMode)
              : tool === 'powerCable'
                ? game.designatePowerCable(
                    cell.x,
                    cell.z,
                    !game.getPowerCableAt(cell.x, cell.z),
                  )
                : tool === 'ride' && context.bungeeBuildMode
                  ? game.placeBungee(cell.x, cell.z, context.bungeeHeight)
                  : game.place(
                      tool as BuildingKind,
                      cell.x,
                      cell.z,
                      scenerySlot(
                        tool as Tool,
                        cell.localX ?? 0.5,
                        cell.localZ ?? 0.5,
                        game.snapshot.buildRotation,
                      ),
                    )
  return {
    handled: true,
    result,
    placedRide:
      result.ok && tool === 'ride'
        ? {
            x: cell.x,
            z: cell.z,
            elevation:
              game.snapshot.buildElevation + game.getTerrainHeight(cell.x, cell.z),
          }
        : undefined,
  }
}
