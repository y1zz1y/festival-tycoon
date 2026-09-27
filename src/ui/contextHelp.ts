import { BUILDING_KINDS, BUILDINGS, isCopyTool, isTerrainCoverTool, type BuildingKind } from '../game/catalog'
import { formatBackstageHover } from '../game/bandSupplyText'
import { isWasteBin } from '../game/decorationWalls'
import { GROUND_COVERS, groundCoverFromTool, groundInfo } from '../game/ground'
import type { GameState } from '../game/GameState'
import type { PlacementPreviewResult } from '../game/placementPreview'
import { isEdgeScenery, isLargeScenery, isScenery } from '../game/scenery'
import { SIMULATION_CONFIG } from '../game/simulationConfig'
import { isSwimmableHeight, isWaterHeight, terrainToolMode } from '../game/terrain'
import { connectedWasteDumpStats, isSealedWasteContainer } from '../game/waste'
import { formatWasteDumpAreaHover } from '../game/wasteText'
import type { Blueprint } from '../game/blueprints'
import type { CellPosition, PathAnchor } from '../view/WorldView'
import { COURSE_PIECE_LABELS, COURSE_SPECS, type CourseKind } from '../game/courseAttractions'
import { formatMoney, joinParts, localize, localizeName, plural, t } from '../i18n'
import type { CourseBuilderTool } from './courseBuilderPanel'

export interface ContextHelpModes {
  coaster: {
    active: boolean
    coasterId: string | null
    startCandidate: CellPosition | null
    accessMode: 'entrance' | 'exit' | null
  }
  path: {
    open: boolean
    constructing: boolean
    demolishing: boolean
    road: boolean
    anchor: PathAnchor | null
    constructionType: 'normal' | 'queue'
  }
  rideAccess: { id: string; type: 'entrance' | 'exit' } | null
  course: { active: boolean; kind?: CourseKind; piece?: CourseBuilderTool }
  backstageEraseMode: boolean
  copyClipboard: Blueprint | null
}

export interface ContextHelpRequest {
  game: GameState
  hoveredCell: CellPosition | null
  placementPreview: PlacementPreviewResult | null
  modes: ContextHelpModes
}

/** Soil names for uncovered ground, by ground type. */
function soilLabel(type: ReturnType<typeof groundInfo>['type']): string {
  return {
    field: t('Ackerboden'),
    clay: t('Lehmboden'),
    gravel: t('Kiesboden'),
    sand: t('Sandboden'),
    grass: t('Wiesenboden'),
    urban: t('Stadtboden'),
  }[type]
}

/** Hints for tools whose help does not depend on the hovered cell. */
function fixedToolHelp(tool: string, preview: (fallback: string) => string): string | undefined {
  const opensControls = t('Danach öffnet sich die Steuerung.')
  const fixed: Partial<Record<string, () => string>> = {
    road: () => t('Klicken oder ziehen, um eine ebenerdige Straße zu bauen.'),
    parkingArea: () => t('Rechteckig ziehen, um Parkplätze auszuweisen.'),
    roadDirection: () => t('Straße anklicken: aktuelle Baurichtung als Fahrtrichtung setzen.'),
    roadDirectionClear: () => t('Straße anklicken oder ziehen: Fahrtrichtung entfernen, die Straße ist wieder in beide Richtungen frei.'),
    trafficLight: () => joinParts(preview(t('Ampel prüfen')), opensControls),
    pathBarrier: () => joinParts(preview(t('Personentor prüfen')), opensControls),
    deliveryYard: () => preview(t('Anlieferungsplatz prüfen')),
    supplyDepot: () => preview(t('Depot prüfen')),
    staffGate: () => preview(t('Personaltor prüfen')),
    roadSeparator: () => t('Straße anklicken: Kante in aktueller Baurichtung sperren.'),
    fence: () => t('Bauzaun setzen: die aktuelle Baurichtung wählt die gesperrte Seite. Ziehen setzt eine Linie.'),
    securityGate: () => t('Festival-Einlass auf einen Weg setzen. Die Baurichtung zeigt ins Gelände; im Objektfenster lässt sich der Besucheranteil einstellen.'),
    crosswalk: () => t('Straße anklicken, um einen Zebrastreifen umzuschalten.'),
    roadSpeed10: () => t('Straßenfeld anklicken, um die Geschwindigkeitszone festzulegen.'),
    roadSpeed30: () => t('Straßenfeld anklicken, um die Geschwindigkeitszone festzulegen.'),
    roadSpeed50: () => t('Straßenfeld anklicken, um die Geschwindigkeitszone festzulegen.'),
  }
  return fixed[tool]?.()
}

export function contextHelpText({ game, hoveredCell, placementPreview, modes }: ContextHelpRequest): string {
  const preview = (fallback: string): string => placementPreview ? localize(placementPreview.message) : fallback
  if (modes.course.active && modes.course.kind) {
    const piece = modes.course.piece
    const name = localize(COURSE_SPECS[modes.course.kind].name)
    return piece
      ? piece === 'area'
        ? t`${name}: Anlagenfläche ziehen.`
        : piece === 'areaErase'
          ? t`${name}: Anlagenfläche zum Entfernen aufziehen.`
          : t`${name}: ${localize(COURSE_PIECE_LABELS[piece])} setzen.`
      : t`${name}: erstes Stück auf das Gelände setzen.`
  }
  if (modes.coaster.active) {
    if (!modes.coaster.coasterId) return modes.coaster.startCandidate
      ? t('Startpunkt gesetzt: drehen oder Höhe ändern, dann „Startplattform bauen“.')
      : t('Klicke auf das Gelände, um den Startpunkt festzulegen.')
    return modes.coaster.accessMode
      ? modes.coaster.accessMode === 'entrance' ? t('Klicke neben eine Stationsplattform: Eingang') : t('Klicke neben eine Stationsplattform: Ausgang')
      : t('Wähle im Achterbahn-Editor das nächste Schienenelement.')
  }
  if (modes.path.open && modes.path.demolishing) {
    return modes.path.road
      ? t('Straße anklicken oder ziehen, um sie abzureißen.')
      : t('Weg anklicken oder ziehen, um ihn abzureißen.')
  }
  if (modes.path.open && modes.path.constructing) {
    if (modes.path.road) return modes.path.anchor
      ? t('Richtung wählen, dann Bauen oder Enter. Zurück mit Backspace.')
      : t('Feld anklicken, um das erste Straßenstück zu setzen.')
    return modes.path.anchor
      ? t('Richtung und Neigung wählen, dann „Bauen“ oder das nächste Feld anklicken.')
      : t('Feld anklicken, um das erste Wegstück zu setzen.')
  }
  if (modes.path.open) return modes.path.constructionType === 'queue'
    ? t('Schlange ziehen. Belag oben gedrückt halten.')
    : t('Wegbelag gedrückt halten, dann Felder ziehen.')
  if (modes.rideAccess) return hoveredCell
    ? preview(t('Ein- oder Ausgang auf ein freies Nachbarfeld setzen'))
    : t('Ein- oder Ausgang auf ein freies Nachbarfeld setzen')
  if (!hoveredCell) return t('Bewege den Mauszeiger über das Gelände.')

  const cell = hoveredCell
  const tool = game.snapshot.selectedTool
  const rideAccess = cell.buildingId ? game.getRideAccessAt(cell.x, cell.z) : undefined
  const existing =
    rideAccess && rideAccess.building.id === cell.buildingId
      ? undefined
      : cell.buildingId
        ? game.snapshot.buildings.find((building) => building.id === cell.buildingId)
        : game.getAt(cell.x, cell.z, undefined, cell.localX, cell.localZ)

  if (tool === 'inspect') {
    const height = game.getTerrainHeight(cell.x, cell.z)
    const dump = game.getWasteDumpAt(cell.x, cell.z)
    const dumpArea = dump ? connectedWasteDumpStats(game.snapshot.wasteDumpCells ?? [], dump) : null
    const backstage = game.getBackstageCellAt(cell.x, cell.z)
    const backstageStats = backstage ? game.getBandSupplyAt(cell.x, cell.z) : undefined
    const ground = groundInfo(game.snapshot, cell.x, cell.z)
    const soilName = ground.cover
      ? localize(GROUND_COVERS[ground.cover].name)
      : soilLabel(ground.type)
    const parking = game.snapshot.logistics.parkingCells.some((entry) => entry.x === cell.x && entry.z === cell.z)
    const surfaceName = parking
      ? t('Parkfläche')
      : ground.surface === 'paved' ? t('Gepflastert') : ground.surface === 'gravel' ? t('Geschottert') : ground.compacted ? t('Verdichtet') : t('Unbefestigt')
    const depot = game.getDepotAt(cell.x, cell.z)
    if (rideAccess && rideAccess.building.id === cell.buildingId) return rideAccess.type === 'entrance' ? t('Eingang auswählen') : t('Ausgang auswählen')
    if (existing) return t`${localize(BUILDINGS[existing.kind].name)} auswählen`
    if (depot) return depot.role === 'delivery' ? t('Anlieferungsplatz auswählen') : t('Depot auswählen')
    if (dumpArea) return formatWasteDumpAreaHover(dumpArea)
    if (dump) return joinParts(t('Müllablage'), plural(dump.stored, t`${dump.stored} Sack gelagert`, t`${dump.stored} Säcke gelagert`))
    if (backstageStats) return formatBackstageHover(backstageStats)
    if (backstage) return t('Backstage auswählen')
    if (isWaterHeight(height, game.getWaterLevel())) return isSwimmableHeight(height, game.getWaterLevel()) ? t('Wasser – Gäste können baden') : t('Wasser')
    return joinParts(
      Boolean(game.getCampingCellAt(cell.x, cell.z)) && t('Zeltbereich'),
      parking && t('Parkplatz'),
      soilName,
      surfaceName,
      ground.drained && t('Entwässert'),
      t`Tragfähigkeit ${ground.bearing}/3`,
      height > 0 && t`Ebene ${height}`,
    )
  }
  if (tool === 'terrainRaise') return t('Rechteck ziehen: Fläche um 0,5 anheben. Hänge höchstens 0,5, Rest als Steilklippe.')
  if (tool === 'terrainLower') return t('Rechteck ziehen: Fläche um 0,5 senken. Unter −0,5 liegt Wasser.')
  if (tool === 'terrainSmooth') return t('Rechteck ziehen: alle Felder auf die Höhe unter dem Startpunkt setzen.')
  if (isTerrainCoverTool(tool)) {
    const cover = groundCoverFromTool(tool)
    return cover
      ? t`Rechteck ziehen: ${localize(GROUND_COVERS[cover].name)} auf die Fläche malen.`
      : t('Rechteck ziehen: Untergrund auf die Fläche malen.')
  }
  if (isCopyTool(tool)) return modes.copyClipboard
    ? preview(t('Rechteck aufziehen, um Gebäude, Deko und Wege zu kopieren.'))
    : t('Rechteck aufziehen, um Gebäude, Deko und Wege zu kopieren.')
  if (tool === 'bulldoze') {
    const access = game.getAccessControlAt(cell.x, cell.z)
    const coaster = game.getRemovableCoasterAt(cell.x, cell.z)
    const target = rideAccess && rideAccess.building.id === cell.buildingId
      ? rideAccess.type === 'entrance' ? t('Eingang entfernen') : t('Ausgang entfernen')
      : existing
        ? existing.kind === 'tree' ? t`Baum entfernen (${formatMoney(SIMULATION_CONFIG.economy.treeClearCost)})` : t`${localize(BUILDINGS[existing.kind].name)} abreißen`
        : coaster ? t`${localizeName(coaster.name)} abreißen`
          : access ? t('Kontrolle entfernen')
            : game.getCampingCellAt(cell.x, cell.z) ? t('Zeltbereich aufheben')
              : game.snapshot.logistics.parkingCells.some((entry) => entry.x === cell.x && entry.z === cell.z) ? t('Parkplatz aufheben')
                : game.getMedicalCellAt(cell.x, cell.z) ? t('Krankenbereich aufheben')
                  : game.getWasteDumpAt(cell.x, cell.z) ? t('Müllablage aufheben')
                    : game.getRoadCellAt(cell.x, cell.z) ? t('Straße entfernen') : t('Leeres Feld')
    return joinParts(target, t('Klicken oder rechteckig ziehen'))
  }
  if (tool === 'coaster') return t('Öffne den Achterbahn-Editor, um eine Bahn zu bauen.')
  if (tool === 'camping') return joinParts(preview(t('Zeltbereich prüfen')), t('Klicken oder rechteckig ziehen'))
  if (tool === 'medicalArea') return joinParts(preview(t('Krankenbereich prüfen')), t('Klicken oder ziehen'))
  if (tool === 'wasteDump') return joinParts(preview(t('Müllablage prüfen')), t('extrem unattraktiv'))
  if (isWasteBin(tool)) return t('Mülleimer setzen. Gäste im Umkreis von 7 Feldern werfen gebrauchte Dinge hier hinein.')
  if (isSealedWasteContainer(tool)) return t('Müllcontainer (80 Beutel). Reinigung bringt Müll hierher, wenn er näher als die Ablage ist, von jeder Seite. Richtet sich beim Bauen automatisch zur Straße aus; Müllwagen leeren ihn nur, wenn eine Straße angrenzt.')
  if (tool === 'stageForecourt') return joinParts(preview(t('Bühnenvorplatz prüfen')), t('Klicken oder rechteckig ziehen, 9 Plätze je Feld'))
  if (tool === 'backstageArea') return joinParts(preview(t('Backstage prüfen')), t('Klicken oder ziehen'))
  if (tool === 'powerCable') return game.getPowerCableAt(cell.x, cell.z)
    ? t('Hier liegt ein Kabel. Klick entfernt es, Ziehen verlegt weitere.')
    : t('Klicken oder ziehen, um Stromkabel zu Generatoren und Verbrauchern zu legen.')
  const fixed = fixedToolHelp(tool, preview)
  if (fixed) return fixed
  if (tool === 'path' && game.getRoadCellAt(cell.x, cell.z)) return game.snapshot.buildElevation >= 1
    ? t('Gehweg als Überweg über die Straße. Besucher laufen oben, Autos darunter.')
    : t('Auf der Straße nur als Überweg: Bauhöhe auf Ebene 1 stellen.')
  if (terrainToolMode(tool)) return t('Rechteck ziehen: Fläche anheben, senken oder auf die Starthöhe glätten.')
  if ((BUILDING_KINDS as readonly string[]).includes(tool)) {
    const kind = tool as BuildingKind
    const text = preview(t('Platzierung prüfen'))
    if (!isScenery(kind)) return text
    return isEdgeScenery(kind)
      ? joinParts(text, t('Maus: Feldkante'), t('R: nächste Seite'), t('Shift: Bauhöhe (0,5)'))
      : isLargeScenery(kind) ? joinParts(text, t('Ganzes Feld'), t('R: drehen')) : joinParts(text, t('Maus: Viertelfeld'), t('R: drehen'))
  }
  return ''
}
