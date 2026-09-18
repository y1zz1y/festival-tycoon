import { BUILDING_KINDS, BUILDINGS, isCopyTool, type BuildingKind } from '../game/catalog'
import { formatBackstageHover } from '../game/bandSupply'
import { isWasteBin } from '../game/decorationWalls'
import { groundInfo } from '../game/ground'
import type { GameState } from '../game/GameState'
import type { PlacementPreviewResult } from '../game/placementPreview'
import { isEdgeScenery, isLargeScenery, isScenery } from '../game/scenery'
import { SIMULATION_CONFIG } from '../game/simulationConfig'
import { isSwimmableHeight, isWaterHeight, terrainToolMode } from '../game/terrain'
import { connectedWasteDumpStats, formatWasteDumpAreaHover, isSealedWasteContainer } from '../game/waste'
import type { Blueprint } from '../game/blueprints'
import type { CellPosition, PathAnchor } from '../view/WorldView'

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
  backstageEraseMode: boolean
  copyClipboard: Blueprint | null
}

export interface ContextHelpRequest {
  game: GameState
  hoveredCell: CellPosition | null
  placementPreview: PlacementPreviewResult | null
  modes: ContextHelpModes
}

export function contextHelpText({ game, hoveredCell, placementPreview, modes }: ContextHelpRequest): string {
  if (modes.coaster.active) {
    if (!modes.coaster.coasterId) return modes.coaster.startCandidate
      ? 'Startpunkt gesetzt: drehen oder Höhe ändern, dann „Startplattform bauen“.'
      : 'Klicke auf das Gelände, um den Startpunkt festzulegen.'
    return modes.coaster.accessMode
      ? `Klicke neben eine Stationsplattform: ${modes.coaster.accessMode === 'entrance' ? 'Eingang' : 'Ausgang'}`
      : 'Wähle im Achterbahn-Editor das nächste Schienenelement.'
  }
  if (modes.path.open && modes.path.demolishing) {
    return modes.path.road
      ? 'Straße anklicken oder ziehen, um sie abzureißen.'
      : 'Weg anklicken oder ziehen, um ihn abzureißen.'
  }
  if (modes.path.open && modes.path.constructing) {
    if (modes.path.road) return modes.path.anchor
      ? 'Richtung wählen, dann Bauen oder Enter. Zurück mit Backspace.'
      : 'Feld anklicken, um das erste Straßenstück zu setzen.'
    return modes.path.anchor
      ? 'Richtung und Neigung wählen, dann „Bauen“ oder das nächste Feld anklicken.'
      : 'Feld anklicken, um das erste Wegstück zu setzen.'
  }
  if (modes.path.open) return modes.path.constructionType === 'queue'
    ? 'Schlange ziehen. Belag oben gedrückt halten.'
    : 'Wegbelag gedrückt halten, dann Felder ziehen.'
  if (modes.rideAccess) return hoveredCell
    ? placementPreview?.message ?? 'Ein- oder Ausgang auf ein freies Nachbarfeld setzen'
    : 'Ein- oder Ausgang auf ein freies Nachbarfeld setzen'
  if (!hoveredCell) return 'Bewege den Mauszeiger über das Gelände.'

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
    const soilName = { field: 'Ackerboden', clay: 'Lehmboden', gravel: 'Kiesboden', sand: 'Sandboden', grass: 'Wiesenboden', urban: 'Stadtboden' }[ground.type]
    const parking = game.snapshot.logistics.parkingCells.some((entry) => entry.x === cell.x && entry.z === cell.z)
    const surfaceName = parking
      ? 'Parkfläche'
      : ground.surface === 'paved' ? 'Gepflastert' : ground.surface === 'gravel' ? 'Geschottert' : ground.compacted ? 'Verdichtet' : 'Unbefestigt'
    const depot = game.getDepotAt(cell.x, cell.z)
    if (rideAccess && rideAccess.building.id === cell.buildingId) return `${rideAccess.type === 'entrance' ? 'Eingang' : 'Ausgang'} auswählen`
    if (existing) return `${BUILDINGS[existing.kind].name} auswählen`
    if (depot) return `${depot.role === 'delivery' ? 'Anlieferungsplatz' : 'Depot'} auswählen`
    if (dumpArea) return formatWasteDumpAreaHover(dumpArea)
    if (dump) return `Müllablage · ${dump.stored} Säcke gelagert`
    if (backstageStats) return formatBackstageHover(backstageStats)
    if (backstage) return 'Backstage auswählen'
    if (isWaterHeight(height, game.getWaterLevel())) return isSwimmableHeight(height, game.getWaterLevel()) ? 'Wasser – Gäste können baden' : 'Wasser'
    return `${game.getCampingCellAt(cell.x, cell.z) ? 'Zeltbereich · ' : ''}${parking ? 'Parkplatz · ' : ''}${soilName} · ${surfaceName}${ground.drained ? ' · Entwässert' : ''} · Tragfähigkeit ${ground.bearing}/3${height > 0 ? ` · Ebene ${height}` : ''}`
  }
  if (tool === 'terrainRaise') return 'Rechteck ziehen: Fläche um 0,5 anheben. Hänge höchstens 0,5, Rest als Steilklippe.'
  if (tool === 'terrainLower') return 'Rechteck ziehen: Fläche um 0,5 senken. Unter −0,5 liegt Wasser.'
  if (tool === 'terrainSmooth') return 'Rechteck ziehen: alle Felder auf die Höhe unter dem Startpunkt setzen.'
  if (isCopyTool(tool)) return modes.copyClipboard
    ? placementPreview?.message ?? 'Rechteck aufziehen, um Gebäude, Deko und Wege zu kopieren.'
    : 'Rechteck aufziehen, um Gebäude, Deko und Wege zu kopieren.'
  if (tool === 'bulldoze') {
    const access = game.getAccessControlAt(cell.x, cell.z)
    const coaster = game.getRemovableCoasterAt(cell.x, cell.z)
    const target = rideAccess && rideAccess.building.id === cell.buildingId
      ? `${rideAccess.type === 'entrance' ? 'Eingang' : 'Ausgang'} entfernen`
      : existing
        ? existing.kind === 'tree' ? `Baum entfernen (${SIMULATION_CONFIG.economy.treeClearCost} €)` : `${BUILDINGS[existing.kind].name} abreißen`
        : coaster ? `${coaster.name} abreißen`
          : access ? 'Kontrolle entfernen'
            : game.getCampingCellAt(cell.x, cell.z) ? 'Zeltbereich aufheben'
              : game.snapshot.logistics.parkingCells.some((entry) => entry.x === cell.x && entry.z === cell.z) ? 'Parkplatz aufheben'
                : game.getMedicalCellAt(cell.x, cell.z) ? 'Krankenbereich aufheben'
                  : game.getWasteDumpAt(cell.x, cell.z) ? 'Müllablage aufheben'
                    : game.getRoadCellAt(cell.x, cell.z) ? 'Straße entfernen' : 'Leeres Feld'
    return `${target} · Klicken oder rechteckig ziehen`
  }
  if (tool === 'coaster') return 'Öffne den Achterbahn-Editor, um eine Bahn zu bauen.'
  if (tool === 'camping') return `${placementPreview?.message ?? 'Zeltbereich prüfen'} · Klicken oder rechteckig ziehen`
  if (tool === 'medicalArea') return `${placementPreview?.message ?? 'Krankenbereich prüfen'} · Klicken oder ziehen`
  if (tool === 'wasteDump') return `${placementPreview?.message ?? 'Müllablage prüfen'} · extrem unattraktiv`
  if (isWasteBin(tool)) return 'Mülleimer setzen. Gäste im Umkreis von 7 Feldern werfen gebrauchte Dinge hier hinein.'
  if (isSealedWasteContainer(tool)) return 'Versiegelter Müllcontainer (80 Beutel). Reinigung bringt Müll hierher, wenn er näher als die Ablage ist. Müllwagen leeren ihn nur, wenn er auf einer Straße steht.'
  if (tool === 'stageForecourt') return 'Klicken oder rechteckig ziehen, um einen Bühnenvorplatz mit 9 Plätzen je Feld auszuweisen.'
  if (tool === 'backstageArea') return `${placementPreview?.message ?? 'Backstage prüfen'} · Klicken oder ziehen`
  if (tool === 'powerCable') return game.getPowerCableAt(cell.x, cell.z)
    ? 'Hier liegt ein Kabel. Klick entfernt es, Ziehen verlegt weitere.'
    : 'Klicken oder ziehen, um Stromkabel zu Generatoren und Verbrauchern zu legen.'
  const fixed: Partial<Record<string, string>> = {
    road: 'Klicken oder ziehen, um eine ebenerdige Straße zu bauen.',
    parkingArea: 'Rechteckig ziehen, um Parkplätze auszuweisen.',
    roadDirection: 'Straße anklicken: aktuelle Baurichtung als Fahrtrichtung setzen.',
    roadDirectionClear: 'Straße anklicken oder ziehen: Fahrtrichtung entfernen, die Straße ist wieder in beide Richtungen frei.',
    trafficLight: `${placementPreview?.message ?? 'Ampel prüfen'} · Danach öffnet sich die Steuerung.`,
    pathBarrier: `${placementPreview?.message ?? 'Personentor prüfen'} · Danach öffnet sich die Steuerung.`,
    deliveryYard: placementPreview?.message ?? 'Anlieferungsplatz prüfen',
    supplyDepot: placementPreview?.message ?? 'Depot prüfen',
    staffGate: placementPreview?.message ?? 'Personaltor prüfen',
    roadSeparator: 'Straße anklicken: Kante in aktueller Baurichtung sperren.',
    fence: 'Bauzaun setzen: die aktuelle Baurichtung wählt die gesperrte Seite. Ziehen setzt eine Linie.',
    securityGate: 'Festival-Einlass auf einen Weg setzen. Die Baurichtung zeigt ins Gelände; im Objektfenster lässt sich der Besucheranteil einstellen.',
    crosswalk: 'Straße anklicken, um einen Zebrastreifen umzuschalten.',
    roadSpeed10: 'Straßenfeld anklicken, um die Geschwindigkeitszone festzulegen.',
    roadSpeed30: 'Straßenfeld anklicken, um die Geschwindigkeitszone festzulegen.',
    roadSpeed50: 'Straßenfeld anklicken, um die Geschwindigkeitszone festzulegen.',
  }
  if (fixed[tool]) return fixed[tool]!
  if (tool === 'path' && game.getRoadCellAt(cell.x, cell.z)) return game.snapshot.buildElevation >= 1
    ? 'Gehweg als Überweg über die Straße. Besucher laufen oben, Autos darunter.'
    : 'Auf der Straße nur als Überweg: Bauhöhe auf Ebene 1 stellen.'
  if (terrainToolMode(tool)) return 'Rechteck ziehen: Fläche anheben, senken oder auf die Starthöhe glätten.'
  if ((BUILDING_KINDS as readonly string[]).includes(tool)) {
    const kind = tool as BuildingKind
    let text = placementPreview?.message ?? 'Platzierung prüfen'
    if (isScenery(kind)) text += isEdgeScenery(kind)
      ? ' · Maus: Feldkante · R: nächste Seite · Shift: Bauhöhe (0,5)'
      : isLargeScenery(kind) ? ' · Ganzes Feld · R: drehen' : ' · Maus: Viertelfeld · R: drehen'
    return text
  }
  return ''
}
