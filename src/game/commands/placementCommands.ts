import { BUILDING_GHOST_MODES, BUILDINGS } from '../catalog'
import type { BuildingKind } from '../catalog'
import { bookFinance } from '../finance'
import { isLargeScenery, isEdgeScenery, isScenery } from '../scenery'
import { defaultShirtSettings, isQueuedFacilityKind } from '../shopGoods'
import { isSealedWasteContainer } from '../waste'
import { isWasteBin } from '../decorationWalls'
import { DEFAULT_SECURITY_CONFIG } from '../security'
import { stageSize, stageStats, type StageDesign } from '../stageDesign'
import type {
  GhostRenderMode,
  PlacementPreviewRequest,
  PlacementPreviewResult,
} from '../placementPreview'
import type { ActionResult, GameSnapshot } from '../types/snapshot'

export type PlacementPreviewContext = {
  state: GameSnapshot
  previewBlueprint: (
    originX: number,
    originZ: number,
    rotation: number,
    items: Extract<PlacementPreviewRequest, { type: 'blueprint' }>['items'],
  ) => ActionResult
  canPlaceRideAccess: (
    buildingId: string,
    accessType: 'entrance' | 'exit',
    x: number,
    z: number,
  ) => ActionResult
  canPlaceBungee: (x: number, z: number, height: number) => ActionResult
  canPlace: (
    kind: BuildingKind,
    x: number,
    z: number,
    decorationSlot?: number,
    preserveLegacySlot?: boolean,
  ) => ActionResult
  /** Which side of a square footprint touches a road, for buildings whose model turns to face it. */
  facingRoadDirection: (x: number, z: number, size: number, preferred: number) => number | null
  previewTool: (
    tool: Exclude<Extract<PlacementPreviewRequest, { type: 'tool' }>['tool'], BuildingKind | 'copy'>,
    x: number,
    z: number,
    enabled?: boolean,
  ) => PlacementPreviewResult
}

export function previewPlacementCommand(
  context: PlacementPreviewContext,
  request: PlacementPreviewRequest,
): PlacementPreviewResult {
  if (request.type === 'blueprint') {
    const result = context.previewBlueprint(
      request.originX,
      request.originZ,
      request.rotation,
      request.items,
    )
    return { ...result, renderMode: 'blueprint' }
  }
  if (request.type === 'rideAccess') {
    return {
      ...context.canPlaceRideAccess(
        request.buildingId,
        request.accessType,
        request.x,
        request.z,
      ),
      renderMode: 'access',
      x: request.x,
      z: request.z,
      rotation: context.state.buildRotation,
    }
  }
  if (request.type === 'building') {
    const result =
      request.kind === 'ride' && request.bungeeHeight !== undefined
        ? context.canPlaceBungee(request.x, request.z, request.bungeeHeight)
        : context.canPlace(
            request.kind,
            request.x,
            request.z,
            request.decorationSlot,
            request.preserveLegacySlot,
          )
    const footprint = placementFootprint(context.state, request.kind)
    const renderMode: GhostRenderMode = isScenery(request.kind)
      ? 'scenery'
      : BUILDING_GHOST_MODES[request.kind]
    // A waste depot or sealed container always turns to face the road it will be built
    // next to, so its ghost shows the facing it will actually be placed with rather than
    // whatever direction the build cursor happens to be pointing.
    const facingSize = request.kind === 'wasteDepot' ? 2 : isSealedWasteContainer(request.kind) ? 1 : null
    const rotation =
      facingSize !== null
        ? context.facingRoadDirection(request.x, request.z, facingSize, context.state.buildRotation) ?? context.state.buildRotation
        : context.state.buildRotation
    return {
      ...result,
      renderMode,
      kind: request.kind,
      x: request.x,
      z: request.z,
      rotation,
      decorationSlot: request.decorationSlot,
      footprint,
    }
  }
  return context.previewTool(request.tool, request.x, request.z, request.enabled)
}

export type PlaceBuildingContext = {
  state: GameSnapshot
  canPlace: PlacementPreviewContext['canPlace']
  placeSpecial: (kind: BuildingKind, x: number, z: number) => ActionResult | null
  clearDesignatedOccupancy: (x: number, z: number) => void
  getPlaceElevation: (x: number, z: number) => number
  clearTrees: (x: number, z: number, elevation: number, height: number) => void
  nextId: (prefix: string) => string
  findFurnitureRotation: (x: number, z: number, preferred?: number) => number | null
  /** Which side of a square footprint touches a road, for furniture whose model turns to face it. */
  facingRoadDirection: (x: number, z: number, size: number, preferred: number) => number | null
  nextBandName: () => string
  syncStageAudience: () => void
  recalculateQueueDirections: () => void
  recalculatePark: () => void
  refreshPower: () => void
  emit: () => void
}

export function placeBuildingCommand(
  context: PlaceBuildingContext,
  kind: BuildingKind,
  x: number,
  z: number,
  decorationSlot?: number,
  preserveLegacySlot = false,
): ActionResult {
  if (isScenery(kind) && !(preserveLegacySlot && decorationSlot === undefined)) {
    decorationSlot ??= isLargeScenery(kind)
      ? 4
      : isEdgeScenery(kind)
        ? context.state.buildRotation
        : 0
  }
  const special = context.placeSpecial(kind, x, z)
  if (special) return special
  const result = context.canPlace(kind, x, z, decorationSlot, preserveLegacySlot)
  if (!result.ok) return result
  context.clearDesignatedOccupancy(x, z)

  const elevation = context.getPlaceElevation(x, z)
  if (!isScenery(kind)) context.clearTrees(x, z, elevation, BUILDINGS[kind].height)
  const design: StageDesign | undefined =
    kind === 'stage'
      ? context.state.festival.stageTemplates?.find(
          (template) => template.name === context.state.festival.selectedStageTemplate,
        )
      : undefined
  bookFinance(
    context.state,
    'construction',
    -(BUILDINGS[kind].cost + (design ? stageStats(design).cost : 0)),
  )
  const rotation =
    kind === 'bench' || kind === 'table'
      ? (context.findFurnitureRotation(x, z) ?? context.state.buildRotation)
      : isWasteBin(kind)
        ? (context.findFurnitureRotation(x, z, context.state.buildRotation) ??
          context.state.buildRotation)
        // A sealed container turns the opposite way from a bench or a bin: towards the
        // road it is emptied from, not away from it into open walking space.
        : isSealedWasteContainer(kind)
          ? (context.facingRoadDirection(x, z, 1, context.state.buildRotation) ??
            context.state.buildRotation)
          : context.state.buildRotation
  context.state.buildings.push({
    stageDesign: design ? structuredClone(design) : undefined,
    decorationSlot,
    id: context.nextId('building'),
    kind,
    x,
    z,
    rotation,
    elevation,
    pathType: kind === 'path' ? 'normal' : undefined,
    pathSlope: kind === 'path' ? 0 : undefined,
    pathSlopeDirection: kind === 'path' ? context.state.buildRotation : undefined,
    price: BUILDINGS[kind].defaultPrice,
    securityConfig:
      kind === 'securityGate' ? structuredClone(DEFAULT_SECURITY_CONFIG) : undefined,
    bandName: kind === 'stage' ? context.nextBandName() : undefined,
    wasteFill: isWasteBin(kind) || isSealedWasteContainer(kind) ? 0 : undefined,
    ...(kind === 'shirt'
      ? {
          shirtColor: defaultShirtSettings().color,
          shirtStyle: defaultShirtSettings().style,
        }
      : {}),
  })
  if (kind === 'delayTower') {
    context.state.stageForecourtCells = context.state.stageForecourtCells.filter(
      (cell) => cell.x !== x || cell.z !== z,
    )
  }
  if (design) context.syncStageAudience()
  if (isQueuedFacilityKind(kind) || kind === 'stage') context.recalculateQueueDirections()
  context.recalculatePark()
  context.refreshPower()
  context.emit()
  return { ok: true, message: `${BUILDINGS[kind].name} gebaut` }
}

function placementFootprint(
  state: GameSnapshot,
  kind: BuildingKind,
): { width: number; depth: number } {
  if (kind === 'ambulanceGarage' || kind === 'wasteDepot') return { width: 2, depth: 2 }
  if (kind === 'busDepot' || kind === 'specialDepot') return { width: 3, depth: 3 }
  if (kind === 'stage') {
    const design = state.festival.stageTemplates?.find(
      (template) => template.name === state.festival.selectedStageTemplate,
    )
    return stageSize(design, state.buildRotation)
  }
  return { width: 1, depth: 1 }
}
