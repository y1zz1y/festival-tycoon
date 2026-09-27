import { rideProfile } from '../game/flatRides'
import { getCoasterType, type Coaster } from '../game/coasters'
import { formatCourseInspect } from '../game/courseAttractionText'
import { BUILDINGS } from '../game/catalog'
import { formatBackstageInspect } from '../game/bandSupplyText'
import { isWasteBin } from '../game/decorationWalls'
import type { GameState } from '../game/GameState'
import { INVENTORY_ITEMS } from '../game/inventory'
import { ROAD_VEHICLE_KIND_LABELS } from '../game/logistics'
import { describeRoadVehicleActivity, describeRoadVehicleDestination, formatRoadVehicleInspectLoad } from '../game/logisticsText'
import { isPricedShopKind, SHIRT_COLORS, shopSupplyKind } from '../game/shopGoods'
import { SIMULATION_CONFIG } from '../game/simulationConfig'
import { stageStats } from '../game/stageDesign'
import { isSealedWasteContainer, connectedWasteDumpStats, parseWasteDumpId, wasteTipCapacity, wasteTipProcessingPerSecond, type WasteTipKind } from '../game/waste'
import { formatSealedContainerInspect, formatWasteDumpAreaInspect } from '../game/wasteText'
import type { AccessControl, AccessControlMode } from '../game/accessControl'
import type { Supply } from '../game/festivalManagement'
import { SUPPLIES } from '../game/festivalManagement'
import { escapeHtml, formatMoney } from './format'
import { formatNumber, joinList, joinParts, localize, localizeName, plural, t, tc } from '../i18n'

/** A depot's stock for one good: a bar half the row wide by default, shrinking only when the
 * label beside it needs the room, with the "current / minimum" count set right into the bar. */
function depotStockBar(label: string, stock: number, minimum: number): string {
  const percent = minimum > 0 ? Math.min(100, Math.round((stock / minimum) * 100)) : stock > 0 ? 100 : 0
  return `<div class="entity-stat-bar"><span class="entity-stat-label">${escapeHtml(label)}</span><span class="stock-bar" title="${Math.floor(stock)} / ${minimum}"><span class="stock-bar-fill" style="width:${percent}%"></span><b>${Math.floor(stock)} / ${minimum}</b></span></div>`
}

/** How full a tip is, as a bar in the same style as a depot's stock. */
function wasteTipBar(stored: number, capacity: number): string {
  const percent = capacity > 0 ? Math.min(100, Math.round((stored / capacity) * 100)) : 0
  return `<div class="entity-stat-bar"><span class="entity-stat-label">${t('Müll im Lager')}</span><span class="stock-bar" title="${Math.floor(stored)} / ${capacity}"><span class="stock-bar-fill" style="width:${percent}%"></span><b>${Math.floor(stored)} / ${capacity}</b></span></div>`
}

/**
 * Fleet and shredder lines for a waste depot or works yard: how many trucks it
 * keeps, what they cost per hour, how full the tip is and how fast it is worked off.
 */
function wasteTipStats(game: GameState, building: { id: string; kind: string }): string {
  const kind: WasteTipKind | null =
    building.kind === 'wasteDepot' ? 'wasteDepot' : building.kind === 'specialDepot' ? 'specialDepot' : null
  if (!kind) return ''
  const tip =
    kind === 'wasteDepot'
      ? game.snapshot.logistics.wasteDepots.find((entry) => entry.id === building.id)
      : game.snapshot.logistics.specialDepots.find((entry) => entry.id === building.id)
  if (!tip) return ''
  const trucks = tip.truckIds?.length ?? 0
  const limit = SIMULATION_CONFIG.logistics.garbageTruckLimitPerDepot
  const perHour = trucks * SIMULATION_CONFIG.logistics.garbageTruckUpkeepPerHour
  return (
    `<span>${t('Müllautos')} <b>${trucks} / ${limit}</b></span>` +
    `<span>${t('Laufende Kosten')} <b>${formatMoney(perHour)}/h</b></span>` +
    `<span>${t('Ladekapazität je Auto')} <b>${t`${SIMULATION_CONFIG.logistics.garbageTruckCapacity} Müll`}</b></span>` +
    wasteTipBar(tip.stored ?? 0, wasteTipCapacity(kind)) +
    `<span>${t('Abbaurate')} <b>${t`${wasteTipProcessingPerSecond(kind)} Müll/s`}</b></span>` +
    `<div class="entity-stat-actions">` +
    `<button type="button" data-buy-garbage="${escapeHtml(tip.id)}" ${trucks >= limit ? 'disabled' : ''}>${joinParts(t('Müllauto kaufen'), formatMoney(SIMULATION_CONFIG.logistics.garbageTruckCost))}</button>` +
    `${trucks > 0 ? `<button type="button" data-sell-garbage="${escapeHtml(tip.id)}">${t('Müllauto verkaufen')}</button>` : ''}` +
    `</div>`
  )
}

export interface EntityDynamicsElements {
  dynamicsSafety: HTMLElement
  dynamicsStats: HTMLElement
  dynamicsInfo: HTMLElement
  telemetryChart: HTMLCanvasElement
}

export function updateCoasterDynamics(coaster: Coaster, elements: EntityDynamicsElements): void {
  const { dynamicsSafety, dynamicsStats, dynamicsInfo, telemetryChart } = elements
  const telemetry = coaster.telemetry
  const hasData = telemetry.samples.length > 1
  const minimumVertical = Number.isFinite(telemetry.minVerticalG)
    ? telemetry.minVerticalG
    : 0
  const maximumVertical = Number.isFinite(telemetry.maxVerticalG)
    ? telemetry.maxVerticalG
    : 0
  const minimumLateral = hasData
    ? Math.min(...telemetry.samples.map((sample) => sample.lateralG))
    : 0
  const maximumLateral = hasData
    ? Math.max(...telemetry.samples.map((sample) => sample.lateralG))
    : 0
  const minimumLongitudinal = hasData
    ? Math.min(...telemetry.samples.map((sample) => sample.longitudinalG))
    : 0
  const maximumLongitudinal = hasData
    ? Math.max(...telemetry.samples.map((sample) => sample.longitudinalG))
    : 0
  const worldUnitMeters = getCoasterType(coaster.typeId).physics.worldUnitMeters
  const trackLengthMeters = coaster.pieces.reduce(
    (total, piece) =>
      total +
      piece.points.slice(1).reduce((pieceLength, point, index) => {
        const previous = piece.points[index]
        return previous
          ? pieceLength +
              Math.hypot(
                point.x - previous.x,
                point.y - previous.y,
                point.z - previous.z,
              ) *
                worldUnitMeters
          : pieceLength
      }, 0),
    0,
  )
  const activeRunCount = telemetry.measuring ? 1 : 0
  const measuredRunCount = Math.max(1, telemetry.completedRuns + activeRunCount)
  const averageSpeedKmh =
    telemetry.durationSeconds > 0
      ? (telemetry.cumulativeDistanceMeters / telemetry.durationSeconds) * 3.6
      : 0
  const averageDurationSeconds = telemetry.durationSeconds / measuredRunCount
  const averageAirtimeSeconds = telemetry.airtimeSeconds / measuredRunCount
  const dangers: string[] = []
  const warnings: string[] = []
  if (minimumVertical < -1.5) dangers.push(t('zu starke negative Vertikalkraft'))
  else if (minimumVertical < -0.8) warnings.push(t('hohe negative Vertikalkraft'))
  if (maximumVertical > 5) dangers.push(t('zu starke positive Vertikalkraft'))
  else if (maximumVertical > 4) warnings.push(t('hohe positive Vertikalkraft'))
  if (telemetry.maxAbsLateralG > 2.5) dangers.push(t('zu starke Seitenkraft'))
  else if (telemetry.maxAbsLateralG > 1.8) warnings.push(t('hohe Seitenkraft'))
  if (telemetry.maxAbsLongitudinalG > 3) dangers.push(t('zu starke Längskraft'))
  else if (telemetry.maxAbsLongitudinalG > 2) warnings.push(t('hohe Längskraft'))

  const safetyLevel = !hasData ? 'unknown' : dangers.length > 0 ? 'danger' : warnings.length > 0 ? 'warning' : 'safe'
  dynamicsSafety.className = `dynamics-safety ${safetyLevel}`
  dynamicsSafety.textContent = !hasData
    ? t('Noch keine vollständige Messfahrt')
    : dangers.length > 0
      ? `⚠ ${t('Potenziell gesundheitsschädlich')}`
      : warnings.length > 0
        ? `△ ${t('Hohe Belastung – Strecke prüfen')}`
        : `✓ ${t('Belastungen im sicheren Bereich')}`

  const forceRange = (from: number, to: number): string => t`${formatNumber(from, 2)} bis ${formatNumber(to, 2)} g`
  dynamicsStats.innerHTML = `
    <span><small>${t('Vertikal-G')}</small><b>${forceRange(minimumVertical, maximumVertical)}</b></span>
    <span><small>${t('Seiten-G')}</small><b>${forceRange(minimumLateral, maximumLateral)}</b></span>
    <span><small>${t('Längs-G')}</small><b>${forceRange(minimumLongitudinal, maximumLongitudinal)}</b></span>
    <span><small>Ø ${t('Hängezeit')}</small><b>${formatNumber(averageAirtimeSeconds, 1)} s</b></span>
    <span><small>${t('Höchsttempo')}</small><b>${t`${formatNumber(telemetry.maxSpeedKmh, 1)} km/h`}</b></span>
    <span><small>Ø ${t('Tempo')}</small><b>${t`${formatNumber(averageSpeedKmh, 1)} km/h`}</b></span>
    <span><small>Ø ${t('Fahrtdauer')}</small><b>${formatNumber(averageDurationSeconds, 1)} s</b></span>
    <span><small>${t('Streckenlänge')}</small><b>${formatNumber(trackLengthMeters, 0)} m</b></span>
  `
  dynamicsInfo.textContent = !hasData
    ? t('Öffne den Testbetrieb oder lasse einen Zug fahren, um Messwerte zu erfassen.')
    : dangers.length > 0
      ? t`Kritische Werte: ${joinList(dangers)}. Grenzwerte: −1,5 bis +5 g vertikal, 2,5 g seitlich und 3 g längs.`
      : warnings.length > 0
        ? t`Hinweise: ${joinList(warnings)}. Kurven und Übergänge sollten weicher gestaltet werden.`
        : joinParts(
          plural(telemetry.completedRuns, t`${telemetry.completedRuns} abgeschlossene Messfahrt`, t`${telemetry.completedRuns} abgeschlossene Messfahrten`),
          t('Hängezeit wird unter 0,2 Vertikal-g gezählt.'),
        )
  drawTelemetryChart(coaster, telemetryChart)
}

function drawTelemetryChart(
  coaster: Coaster,
  telemetryChart: HTMLCanvasElement,
): void {
  const context = telemetryChart.getContext('2d')
  if (!context) return
  const width = telemetryChart.width
  const height = telemetryChart.height
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#172720'
  context.fillRect(0, 0, width, height)

  const samples = coaster.telemetry.samples
  if (samples.length < 2) {
    context.fillStyle = '#8fa69c'
    context.font = '22px sans-serif'
    context.textAlign = 'center'
    context.fillText(t('Messfahrt erforderlich'), width / 2, height / 2)
    return
  }

  const padding = { left: 48, right: 16, top: 16, bottom: 30 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const maximumDistance = Math.max(1, ...samples.map((sample) => sample.distance))
  const forceValues = samples.flatMap((sample) => [
    sample.verticalG,
    sample.lateralG,
    sample.longitudinalG,
  ])
  const minimumForce = Math.max(-8, Math.floor(Math.min(-2, ...forceValues)))
  const maximumForce = Math.min(8, Math.ceil(Math.max(6, ...forceValues)))
  const forceRange = Math.max(1, maximumForce - minimumForce)
  const xFor = (distance: number) =>
    padding.left + (distance / maximumDistance) * plotWidth
  const yFor = (force: number) =>
    padding.top + ((maximumForce - force) / forceRange) * plotHeight

  context.fillStyle = 'rgba(218, 82, 82, 0.1)'
  context.fillRect(
    padding.left,
    padding.top,
    plotWidth,
    Math.max(0, yFor(5) - padding.top),
  )
  context.fillRect(
    padding.left,
    yFor(-1.5),
    plotWidth,
    Math.max(0, padding.top + plotHeight - yFor(-1.5)),
  )

  context.font = '16px sans-serif'
  context.textAlign = 'right'
  context.textBaseline = 'middle'
  for (let force = Math.ceil(minimumForce); force <= maximumForce; force += 1) {
    const y = yFor(force)
    context.strokeStyle = force === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'
    context.beginPath()
    context.moveTo(padding.left, y)
    context.lineTo(width - padding.right, y)
    context.stroke()
    context.fillStyle = '#80978c'
    context.fillText(`${force}g`, padding.left - 7, y)
  }
  context.textAlign = 'center'
  context.textBaseline = 'top'
  context.fillText(t('Streckenposition'), padding.left + plotWidth / 2, height - 22)

  const series = [
    { key: 'verticalG', color: '#72df91' },
    { key: 'lateralG', color: '#ef79bd' },
    { key: 'longitudinalG', color: '#f0c85a' },
  ] as const
  series.forEach(({ key, color }) => {
    context.strokeStyle = color
    context.lineWidth = 3
    context.beginPath()
    samples.forEach((sample, index) => {
      const x = xFor(sample.distance)
      const y = yFor(sample[key])
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.stroke()
  })
}

export type EntitySelection = {
  type: 'building' | 'coaster' | 'course' | 'vehicle' | 'access' | 'depot' | 'wasteDump' | 'backstage'
  id: string
}

export interface EntityPanelState {
  selection: EntitySelection | null
  tab: 'overview' | 'dynamics'
  cameraQuarter: number
}

export interface EntityPanelServices {
  game: GameState
  close(): void
  depotWorkerCount(depotId: string): number
  syncDepotStock(root: ParentNode, depot: NonNullable<ReturnType<GameState['getDepot']>>): void
  renderAccessControl(control: AccessControl): void
  accessStatus(control: AccessControl): string
  accessMode(mode: AccessControlMode): string
}

const element = <T extends Element>(selector: string): T => {
  const found = document.querySelector<T>(selector)
  if (!found) throw new Error(t`Benötigtes UI-Element fehlt: ${selector}`)
  return found
}
/** `3 Felder` / `1 Feld` for tile counts in the inspect lines. */
const fieldCount = (count: number): string => plural(count, t`${count} Feld`, t`${count} Felder`)

/** Extra lines for a stage built from a custom design. */
function stageDesignStats(design: Parameters<typeof stageStats>[0]): string {
  const stats = stageStats(design)
  return `<span>${t('Eigene Bühne')} <b>${escapeHtml(localizeName(design.name))}</b></span>`
    + `<span>${t('Party / Umgebung')} <b>${stats.party} / ${stats.beauty}</b></span>`
    + `<span>${t('Technik zusätzlich')} <b>${joinParts(t`${stats.power} kW`, `${formatMoney(stats.upkeep)}/h`)}</b></span>`
}

const isoDirection = (direction: number, cameraQuarter: number): string =>
  ['↙', '↘', '↗', '↖'][(direction - cameraQuarter + 4) % 4] ?? '◆'

export function updateEntityPanel(
  state: EntityPanelState,
  services: EntityPanelServices,
): void {
  const { game } = services
  const selected = state.selection
  element<HTMLElement>('#open-ride-construction').hidden = true
  const editStage = element<HTMLButtonElement>('#edit-selected-stage')
  editStage.hidden = true
  if (!selected) return
  const icon = element<HTMLElement>('#entity-icon')
  const typeLabel = element<HTMLElement>('#entity-type')
  const name = element<HTMLElement>('#entity-name')
  const status = element<HTMLElement>('#entity-status')
  const stats = element<HTMLElement>('#entity-stats')
  const tabs = element<HTMLElement>('#entity-tabs')
  const overview = element<HTMLElement>('#entity-overview')
  const dynamics = element<HTMLElement>('#entity-dynamics')
  const price = element<HTMLElement>('#price-options')
  const priceInput = element<HTMLInputElement>('#entity-price')
  const applyPrice = element<HTMLButtonElement>('#apply-price-to-kind')
  const shirts = element<HTMLElement>('#shirt-options')
  const coasterOptions = element<HTMLElement>('#coaster-options')
  const courseOptions = element<HTMLElement>('#course-options')
  const security = element<HTMLElement>('#security-options')
  const depotOptions = element<HTMLElement>('#depot-options')
  const accessOptions = element<HTMLElement>('#access-control-options')
  const resetCommon = (): void => {
    tabs.classList.remove('visible'); overview.hidden = false; dynamics.classList.remove('visible')
    price.classList.remove('visible'); shirts.classList.remove('visible'); applyPrice.hidden = true
    security.classList.remove('visible'); coasterOptions.classList.remove('visible')
    courseOptions.classList.remove('visible')
  }
  accessOptions.hidden = selected.type !== 'access'
  accessOptions.classList.toggle('visible', selected.type === 'access')
  depotOptions.classList.toggle('visible', selected.type === 'depot')

  if (selected.type === 'depot') {
    const depot = game.getDepot(selected.id)
    if (!depot) return services.close()
    const delivery = depot.role === 'delivery'
    icon.textContent = delivery ? '📦' : '🏪'
    typeLabel.textContent = delivery ? t('Anlieferungsplatz') : t('Warendepot')
    name.textContent = delivery ? t('Anlieferung') : t('Depot')
    status.textContent = delivery
      ? t('Lastwagen laden hier ab. Träger bringen Ware zu Depots und Ständen.')
      : depot.distribution === 'relay' ? t('Zwischenlager: andere Depots dürfen entnehmen.') : t('Versorgt Stände bis zum Mindestbestand.')
    const workers = services.depotWorkerCount(depot.id)
    stats.innerHTML = `<span>${t('Position')} <b>${depot.x}, ${depot.z}</b></span><span>${t('Träger')} <b>${workers}</b></span>${Object.entries(SUPPLIES).map(([kind, item]) => depotStockBar(localize(item.name), depot.stock[kind as Supply], depot.minimum[kind as Supply])).join('')}`
    element('#depot-role-hint').textContent = delivery ? t('Mindestbestand löst Nachbestellungen aus. Träger holen Ware hier ab.') : t('Mindestbestand und Träger gelten für dieses Depot.')
    const workersInput = element<HTMLInputElement>('#depot-workers')
    if (document.activeElement !== workersInput) workersInput.value = String(workers)
    element('#depot-workers-value').textContent = workersInput.value
    const distribution = element<HTMLSelectElement>('#depot-distribution')
    if (document.activeElement !== distribution) distribution.value = depot.distribution ?? 'shops'
    services.syncDepotStock(depotOptions, depot)
    resetCommon()
    return
  }
  if (selected.type === 'access') {
    const control = game.getAccessControl(selected.id)
    if (!control) return services.close()
    const light = control.kind === 'trafficLight'
    icon.textContent = light ? '🚦' : '🚧'; typeLabel.textContent = light ? t('Ampel') : t('Personentor')
    name.textContent = light ? t('Straßenampel') : t('Personentor')
    status.textContent = services.accessStatus(control)
    element('#access-signal').textContent = status.textContent
    stats.innerHTML = `<span>${t('Modus')} <b>${services.accessMode(control.mode)}</b></span><span>${t('Richtung')} <b>${isoDirection(control.direction, state.cameraQuarter)}</b></span>${control.kind === 'pathBarrier' ? `<span>${t('Durchgang')} <b>${control.passage === 'both' ? t('beide Richtungen') : t('eine Richtung')}</b></span>` : ''}<span>${t('Gebiet')} <b>${fieldCount(control.area.length)}</b></span>`
    resetCommon(); depotOptions.classList.remove('visible'); accessOptions.hidden = false; accessOptions.classList.add('visible')
    services.renderAccessControl(control)
    return
  }
  if (selected.type === 'vehicle') {
    const vehicle = game.snapshot.logistics.roadVehicles.find((entry) => entry.id === selected.id)
    if (!vehicle) return services.close()
    const kind = ROAD_VEHICLE_KIND_LABELS[vehicle.kind]
    const destination = describeRoadVehicleDestination(vehicle)
    const kindName = localize(kind.name)
    icon.textContent = kind.icon; typeLabel.textContent = kindName; name.textContent = kindName
    status.textContent = describeRoadVehicleActivity(vehicle)
    stats.innerHTML = `<span>${t('Status')} <b>${status.textContent}</b></span>${destination ? `<span>${tc('destination', 'Ziel')} <b>${destination}</b></span>` : ''}<span>${t('Route')} <b>${fieldCount(vehicle.route.length)}</b></span>${formatRoadVehicleInspectLoad(vehicle, game.snapshot.logistics.arrivalGroups.find((group) => group.id === vehicle.groupId)?.memberIds.length).map((entry) => `<span>${entry.label} <b>${entry.value}</b></span>`).join('')}${vehicle.waitMinutes > 0 ? `<span>${t('Wartet seit')} <b>${t`${formatNumber(vehicle.waitMinutes, 1)} min`}</b></span>` : ''}${vehicle.kind === 'ambulance' ? `<button type="button" data-sell-ambulance-vehicle="${vehicle.id}">${t('Krankenwagen verkaufen')}</button>` : ''}`
    resetCommon(); depotOptions.classList.remove('visible')
    return
  }
  if (selected.type === 'wasteDump') {
    const origin = parseWasteDumpId(selected.id)
    const area = origin && connectedWasteDumpStats(game.snapshot.wasteDumpCells ?? [], origin)
    if (!area) return services.close()
    const inspect = formatWasteDumpAreaInspect(area)
    icon.textContent = '🗑️'; typeLabel.textContent = t('Müllsammelplatz'); name.textContent = t('Müllablage'); status.textContent = inspect.status
    stats.innerHTML = inspect.lines.map((line) => `<span>${line.label} <b>${line.value}</b></span>`).join('')
    resetCommon(); depotOptions.classList.remove('visible')
    return
  }
  if (selected.type === 'backstage') {
    const match = /^backstage:(-?\d+):(-?\d+)$/.exec(selected.id)
    const supply = match && game.getBandSupplyAt(Number(match[1]), Number(match[2]))
    if (!supply) return services.close()
    const inspect = formatBackstageInspect(supply)
    icon.textContent = '🎤'; typeLabel.textContent = t('Bandversorgung'); name.textContent = t('Backstage'); status.textContent = inspect.status
    stats.innerHTML = inspect.lines.map((line) => `<span>${line.label} <b>${line.value}</b></span>`).join('')
    resetCommon(); depotOptions.classList.remove('visible')
    return
  }
  if (selected.type === 'building') {
    const building = game.snapshot.buildings.find((entry) => entry.id === selected.id)
    if (!building) return services.close()
    editStage.hidden = building.kind !== 'stage'
    const definition = BUILDINGS[building.kind]
    const ride = building.kind === 'ride' ? rideProfile(building) : null
    icon.textContent = ride?.icon ?? definition.icon; typeLabel.textContent = t('Gebäude')
    name.textContent = building.rideType === 'bungee' ? joinParts(t('Bungee-Turm'), `${building.bungeeHeight ?? 20} m`) : ride ? localizeName(ride.name) : localize(definition.name)
    element<HTMLElement>('#open-ride-construction').hidden = building.kind !== 'ride'
    const active = game.isBuildingCurrentlyActive(building)
    const demand = SIMULATION_CONFIG.power.demand[building.kind] ?? 0
    const output = SIMULATION_CONFIG.power.output[building.kind] ?? 0
    const powered = game.isBuildingPowered(building.id)
    const stageBreak = building.kind === 'stage' && game.isOfferCurrentlyActive('stages') && !active
    const accessIssue = game.getRideAccessIssue(building)
    const band = building.bandName ?? t('Band')
    status.textContent = accessIssue ? localize(accessIssue) : (demand > 0 && !powered ? t('Kein Strom – Kabel zum Generator verlegen')
      : stageBreak ? `☕ ${t`${band} macht 30 Minuten Pause`}`
        : !active ? t('Nach Tagesplan derzeit geschlossen')
          : building.kind === 'stage' ? `🎸 ${t`${band} spielt gerade`}`
            : building.kind === 'directionalSpeaker' ? joinParts(t`Schallrichtung ${isoDirection(building.rotation, state.cameraQuarter)}`, t('direkt davor zu laut'))
              : building.kind === 'omniSpeaker' ? t('Beschallt die Umgebung in alle Richtungen')
                : isWasteBin(building.kind) ? joinParts(t`Füllstand ${building.wasteFill ?? 0}/${SIMULATION_CONFIG.waste.binCapacity}`, t('Gäste im Umkreis von 7 Feldern nutzen ihn'))
                  : isSealedWasteContainer(building.kind) ? formatSealedContainerInspect({ stored: building.wasteFill ?? 0, onRoad: Boolean(game.getRoadCellAt(building.x, building.z, building.elevation)), truckReachable: Boolean(game.getRoadCellAt(building.x, building.z, building.elevation)) }).status
                    : joinParts(t`Zugang ${isoDirection(building.rotation, state.cameraQuarter)}`, t`Ebene ${building.elevation}`))
    stats.innerHTML = `<span>${t('Baukosten')} <b>${formatMoney((ride?.cost ?? definition.cost) + (building.stageDesign ? stageStats(building.stageDesign).cost : 0))}</b></span>${building.stageDesign ? stageDesignStats(building.stageDesign) : ''}<span>${t('Unterhalt')} <b>${formatMoney(ride?.upkeep ?? definition.upkeep)}/h</b></span><span>${t('Kapazität')} <b>${building.rideType === 'bungee' ? t('1 Springer') : ride?.capacity ?? definition.capacity}</b></span>${ride && building.rideType !== 'bungee' ? `<span>${t('Fahrt')} <b>${t`${ride.minutes} min`}</b></span>` : ''}${shopSupplyKind(building.kind) ? `<span>${t('Warenbestand')} <b>${t`${Math.floor(game.snapshot.festival.infrastructure.shops[building.id]?.[shopSupplyKind(building.kind)!] ?? 0)} / Ziel 40`}</b></span>` : ''}${isWasteBin(building.kind) ? `<span>${t('Inhalt')} <b>${building.wasteFill ?? 0}/${SIMULATION_CONFIG.waste.binCapacity}</b></span>` : isSealedWasteContainer(building.kind) ? `<span>${t('Inhalt')} <b>${building.wasteFill ?? 0}/${SIMULATION_CONFIG.waste.sealedContainerCapacity}</b></span>` : ''}${output > 0 ? `<span>${t('Leistung')} <b>${t`${output} kW`}</b></span>` : demand > 0 ? `<span>${t('Strom')} <b>${t`${demand} kW`} ${powered ? t('versorgt') : t('ohne Netz')}</b></span>` : ''}${wasteTipStats(game, building)}`
    resetCommon()
    const hasPrice = isPricedShopKind(building.kind)
    const shirt = building.kind === 'shirt'
    price.classList.toggle('visible', hasPrice); shirts.classList.toggle('visible', shirt)
    if (shirt) {
      const palette = element<HTMLElement>('#shirt-color-palette')
      if (palette.dataset.built !== '1') {
        palette.innerHTML = SHIRT_COLORS.map((swatch) => `<button type="button" class="shirt-color-swatch" data-shirt-color="${swatch.color}" title="${escapeHtml(localize(swatch.name))}" style="background:#${swatch.color.toString(16).padStart(6, '0')}"></button>`).join('')
        palette.dataset.built = '1'
      }
      palette.querySelectorAll<HTMLButtonElement>('[data-shirt-color]').forEach((button) => button.classList.toggle('selected', Number(button.dataset.shirtColor) === (building.shirtColor ?? SHIRT_COLORS[0]!.color)))
      const style = element<HTMLSelectElement>('#shirt-style')
      if (document.activeElement !== style) style.value = building.shirtStyle ?? 'basic'
    }
    applyPrice.hidden = !hasPrice
    if (hasPrice) applyPrice.textContent = t`Für alle ${localize(definition.name)}-Gebäude übernehmen`
    if (hasPrice && document.activeElement !== priceInput) priceInput.value = String(building.price)
    const securityGate = building.kind === 'securityGate'
    security.classList.toggle('visible', securityGate)
    if (securityGate) {
      const config = building.securityConfig!
      const assigned = game.snapshot.staff.find((member) => member.role === 'security' && member.assignedBuildingId === building.id)
      element('#security-staffing').textContent = assigned ? t`Besetzt durch ${localizeName(assigned.name)}` : t('Unbesetzt – Kontrollen finden nicht statt')
      const thoroughness = element<HTMLInputElement>('#security-thoroughness')
      const flow = element<HTMLInputElement>('#security-flow-share')
      if (document.activeElement !== thoroughness) thoroughness.value = String(Math.round(config.thoroughness * 100))
      if (document.activeElement !== flow) flow.value = String(Math.round(config.flowShare * 100))
      element('#security-thoroughness-value').textContent = `${Math.round(config.thoroughness * 100)}%`
      element('#security-flow-share-value').textContent = `${Math.round(config.flowShare * 100)}%`
      const prohibited = element<HTMLElement>('#security-prohibited-items')
      const fingerprint = `${building.id}:${[...config.prohibitedItems].sort().join(',')}`
      if (prohibited.dataset.fingerprint !== fingerprint) {
        prohibited.dataset.fingerprint = fingerprint
        prohibited.innerHTML = Object.values(INVENTORY_ITEMS).map((item) => `<label><input type="checkbox" data-security-item="${item.kind}" ${config.prohibitedItems.includes(item.kind) ? 'checked' : ''}> ${item.icon} ${localize(item.name)}</label>`).join('')
      }
    }
    depotOptions.classList.remove('visible')
    return
  }

  if (selected.type === 'course') {
    const course = game.getCourse(selected.id)
    if (!course) return services.close()
    const inspect = formatCourseInspect(course, game.isOfferCurrentlyActive('rides'))
    icon.textContent = inspect.icon
    typeLabel.textContent = inspect.typeLabel
    name.textContent = inspect.name
    status.textContent = inspect.status
    stats.innerHTML = inspect.lines
      .map((line) => `<span>${escapeHtml(line.label)} <b>${escapeHtml(line.value)}</b></span>`)
      .join('')
    resetCommon()
    courseOptions.classList.add('visible')
    price.classList.add('visible')
    applyPrice.hidden = true
    if (document.activeElement !== priceInput) priceInput.value = String(course.price)
    element<HTMLSelectElement>('#course-operation-mode').value = course.operating ? 'open' : 'closed'
    depotOptions.classList.remove('visible')
    return
  }

  const coaster = game.getCoaster(selected.id)
  if (!coaster) return services.close()
  const coasterType = getCoasterType(coaster.typeId)
  const train = coaster.train
  icon.textContent = '🎢'; typeLabel.textContent = localize(coasterType.name); name.textContent = localizeName(coaster.name)
  const speedKmh = formatNumber(Math.abs(train.speed * 3.6), 1)
  status.textContent = !coaster.closed ? t('Die Strecke ist noch nicht geschlossen.')
    : coaster.operationMode === 'open' && (!coaster.entrance || !coaster.exit) ? t('Die Station benötigt einen Eingang und einen Ausgang.')
      : coaster.operationMode === 'closed' ? t('Die Achterbahn ist geschlossen.')
        : coaster.operationMode === 'open' && !game.isOfferCurrentlyActive('rides') ? t('Nach Tagesplan derzeit geschlossen.')
          : train.state === 'running' ? joinParts(t('Zug unterwegs'), `${Math.round(train.progress * 100)}%`, train.speed < 0 ? t`${speedKmh} km/h rückwärts` : t`${speedKmh} km/h`)
            : train.state === 'unloading' ? joinParts(t('Aussteigen'), plural(train.passengers, t`noch ${train.passengers} Gast im Zug`, t`noch ${train.passengers} Gäste im Zug`))
              : joinParts(t('Einsteigen'), t`${train.passengers}/${train.capacity} Gäste`, t`${Math.floor(train.waitMinutes)} min`)
  const operationLabels = { closed: t('Geschlossen'), open: t('Geöffnet'), test: t('Testbetrieb') }
  stats.innerHTML = `<span>${t('Status')} <b>${operationLabels[coaster.operationMode]}</b></span><span>${t('Schienenelemente')} <b>${coaster.pieces.length}</b></span><span>${t('Stationsplattformen/Wagen')} <b>${train.cars}</b></span><span>${t('Warteschlange')} <b>${coaster.queue.length}/${game.getCoasterQueueCapacity(coaster.id)}</b></span><span>${t('Stationskettenantrieb')} <b>${t('Automatisch')}</b></span><span>${t('Kettenzüge')} <b>${coaster.pieces.filter((piece) => piece.chainLift).length}</b></span><span>${t('Geschwindigkeit')} <b>${t`${speedKmh} km/h`}</b></span>`
  coasterOptions.classList.add('visible'); shirts.classList.remove('visible'); security.classList.remove('visible'); depotOptions.classList.remove('visible')
  courseOptions.classList.remove('visible')
  tabs.classList.add('visible'); overview.hidden = state.tab !== 'overview'; dynamics.classList.toggle('visible', state.tab === 'dynamics')
  document.querySelectorAll<HTMLButtonElement>('[data-entity-tab]').forEach((button) => button.classList.toggle('active', button.dataset.entityTab === state.tab))
  price.classList.add('visible'); applyPrice.hidden = true
  if (document.activeElement !== priceInput) priceInput.value = String(coaster.ticketPrice)
  element<HTMLSelectElement>('#operation-mode').value = coaster.operationMode
  element<HTMLSelectElement>('#dispatch-mode').value = coaster.settings.dispatchMode
  element<HTMLInputElement>('#dispatch-interval').value = String(coaster.settings.dispatchIntervalMinutes)
  element('#dispatch-value').textContent = t`${coaster.settings.dispatchIntervalMinutes} min`
  if (state.tab === 'dynamics') updateCoasterDynamics(coaster, {
    dynamicsSafety: element('#dynamics-safety'),
    dynamicsStats: element('#dynamics-stats'),
    dynamicsInfo: element('#dynamics-info'),
    telemetryChart: element('#telemetry-chart'),
  })
}

