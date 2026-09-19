import { BUILDINGS } from './catalog'
import type { BuildingKind } from './catalog'
import type { GameSnapshot, PlacedBuilding } from './GameState'
import { buildingFootprint } from './stageDesign'
import { isScenery, SCENERY_KINDS } from './scenery'
import { SIMULATION_CONFIG } from './simulationConfig'
import { BANDS } from './festivalManagement'
import type { Booking } from './festivalManagement'

export const BAND_SUPPLY_KINDS = [
  'tourBusParking',
  'bandFridge',
  'backstageCouch2',
  'backstageCouch3',
  'backstageToilet',
] as const satisfies readonly BuildingKind[]
/** Seating the band waits on instead of milling about in front of the stage. */
export const BACKSTAGE_COUCH_KINDS = ['backstageCouch2', 'backstageCouch3'] as const satisfies readonly BuildingKind[]
export function isBackstageCouchKind(kind: string): boolean {
  return (BACKSTAGE_COUCH_KINDS as readonly string[]).includes(kind)
}
export type BandSupplyKind = (typeof BAND_SUPPLY_KINDS)[number]
export type BandArrivalMode = 'tourBus' | 'staffGate'

export type BackstageCell = {
  x: number
  z: number
  elevation: number
}

export type BandSupplyStageInfo = {
  id: string
  name: string
  bandName?: string
}

export type BandSupplyBookingInfo = {
  bandId: string
  bandName: string
  mode: BandArrivalMode
  start: number
  duration: number
  stageId: string
  stageName: string
}

export type BandSupplyStats = {
  componentId: string
  active: boolean
  designatedTiles: number
  activeTiles: number
  stageIds: string[]
  stages: BandSupplyStageInfo[]
  bookings: BandSupplyBookingInfo[]
  usableSlots: number
  busDemand: number
  parkingRatio: number | null
  parkingNeeded: boolean
  parkingSufficient: boolean
  attractiveness: number
  decoScore: number
  parkingTerm: number
  fanPenalty: number
  fansOnActiveTiles: number
  catering: number
  foodCount: number
  drinkCount: number
  dedicatedCatering: number
  satisfaction: number
  showQuality: number
  bareStage: boolean
}

export type BandSupplyComponent = {
  id: string
  active: boolean
  cells: BackstageCell[]
  stageIds: string[]
  tiles: Array<{ x: number; z: number; elevation: number; role: 'backstage' | 'stage' }>
}

export type BandSupplySnapshot = {
  components: BandSupplyStats[]
  showQualityByStageId: Record<string, number>
  activeKeys: string[]
}

const CARDINAL_OFFSETS = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
] as const

const SCENERY_KIND_SET = new Set<string>(SCENERY_KINDS)

export function isBandSupplyKind(kind: string): kind is BandSupplyKind {
  return (BAND_SUPPLY_KINDS as readonly string[]).includes(kind)
}

export function backstageCellKey(cell: { x: number; z: number }): string {
  return `${cell.x}:${cell.z}`
}

export function emptyBandSupplySnapshot(): BandSupplySnapshot {
  return { components: [], showQualityByStageId: {}, activeKeys: [] }
}

export function normalizeBackstageCell(value: unknown): BackstageCell | null {
  if (typeof value !== 'object' || value === null) return null
  const source = value as Record<string, unknown>
  if (!Number.isFinite(source.x) || !Number.isFinite(source.z)) return null
  return {
    x: Number(source.x),
    z: Number(source.z),
    elevation: Number.isFinite(source.elevation) ? Number(source.elevation) : 0,
  }
}

export function designateBackstageAreas(
  existing: readonly BackstageCell[],
  area: ReadonlyArray<{ x: number; z: number }>,
  canPlace: (x: number, z: number) => boolean,
  availableMoney: number,
  enabled = true,
  elevationOf: (x: number, z: number) => number = () => 0,
): { cells: BackstageCell[]; changed: number; cost: number } {
  const costPerCell = SIMULATION_CONFIG.bandSupply.backstageDesignationCost
  if (!enabled) {
    const remove = new Set(area.map((cell) => backstageCellKey(cell)))
    const kept = existing.filter((cell) => !remove.has(backstageCellKey(cell)))
    return {
      cells: kept,
      changed: existing.length - kept.length,
      cost: 0,
    }
  }
  const keys = new Set(existing.map((cell) => backstageCellKey(cell)))
  const candidates = area.filter(
    (cell) => !keys.has(backstageCellKey(cell)) && canPlace(cell.x, cell.z),
  )
  const affordable = Math.min(
    candidates.length,
    Math.floor(availableMoney / Math.max(1, costPerCell)),
  )
  const additions = candidates.slice(0, affordable).map((cell) => ({
    x: cell.x,
    z: cell.z,
    elevation: elevationOf(cell.x, cell.z),
  }))
  return {
    cells: [...existing, ...additions],
    changed: additions.length,
    cost: additions.length * costPerCell,
  }
}

function samePad(a: number, b: number): boolean {
  return Math.abs(a - b) < 1
}

function stageDisplayName(stage: PlacedBuilding): string {
  return stage.stageDesign?.name ?? stage.bandName ?? 'Bühne'
}

export function buildBandSupplyGraph(
  snapshot: Pick<GameSnapshot, 'buildings' | 'backstageCells'>,
): BandSupplyComponent[] {
  const nodes = new Map<
    string,
    { x: number; z: number; elevation: number; role: 'backstage' | 'stage'; stageId?: string }
  >()
  for (const cell of snapshot.backstageCells ?? []) {
    nodes.set(backstageCellKey(cell), {
      x: cell.x,
      z: cell.z,
      elevation: cell.elevation,
      role: 'backstage',
    })
  }
  for (const building of snapshot.buildings) {
    if (building.kind !== 'stage') continue
    for (const cell of buildingFootprint(building)) {
      const key = backstageCellKey(cell)
      const existing = nodes.get(key)
      if (existing) {
        existing.role = existing.role === 'backstage' ? 'backstage' : 'stage'
        existing.stageId = building.id
        continue
      }
      nodes.set(key, {
        x: cell.x,
        z: cell.z,
        elevation: building.elevation,
        role: 'stage',
        stageId: building.id,
      })
    }
  }
  const seen = new Set<string>()
  const components: BandSupplyComponent[] = []
  for (const startKey of nodes.keys()) {
    if (seen.has(startKey)) continue
    const queue = [startKey]
    seen.add(startKey)
    const tiles: BandSupplyComponent['tiles'] = []
    const cells: BackstageCell[] = []
    const stageIds: string[] = []
    while (queue.length > 0) {
      const key = queue.pop()!
      const node = nodes.get(key)!
      tiles.push({
        x: node.x,
        z: node.z,
        elevation: node.elevation,
        role: node.role,
      })
      if (node.role === 'backstage') {
        cells.push({ x: node.x, z: node.z, elevation: node.elevation })
      }
      if (node.stageId && !stageIds.includes(node.stageId)) stageIds.push(node.stageId)
      for (const offset of CARDINAL_OFFSETS) {
        const nextKey = backstageCellKey({
          x: node.x + offset.x,
          z: node.z + offset.z,
        })
        if (seen.has(nextKey)) continue
        const next = nodes.get(nextKey)
        if (!next || !samePad(node.elevation, next.elevation)) continue
        seen.add(nextKey)
        queue.push(nextKey)
      }
    }
    const origin = tiles.reduce(
      (best, tile) =>
        tile.z < best.z || (tile.z === best.z && tile.x < best.x) ? tile : best,
      tiles[0]!,
    )
    components.push({
      id: `backstage:${origin.x}:${origin.z}`,
      active: stageIds.length > 0,
      cells,
      stageIds,
      tiles,
    })
  }
  return components
}

export function componentAt(
  components: readonly BandSupplyComponent[],
  x: number,
  z: number,
): BandSupplyComponent | undefined {
  return components.find((component) =>
    component.tiles.some((tile) => tile.x === x && tile.z === z),
  )
}

export function componentForStage(
  components: readonly BandSupplyComponent[],
  stageId: string,
): BandSupplyComponent | undefined {
  return components.find((component) => component.stageIds.includes(stageId))
}

export function lerpShowQuality(satisfaction: number): number {
  const config = SIMULATION_CONFIG.bandSupply
  const t = Math.min(1, Math.max(0, satisfaction / 100))
  return config.bareShowQuality + (config.maxShowQuality - config.bareShowQuality) * t
}

export function diminishBeauty(raw: number): number {
  if (raw <= 0) return 0
  const saturation = SIMULATION_CONFIG.atmosphere.diminishingSaturation
  return 100 * (1 - Math.exp(-raw / saturation))
}

export function sceneryBeauty(kind: BuildingKind, appealFallback = 0): number {
  const source = SIMULATION_CONFIG.atmosphere.sources[kind as keyof typeof SIMULATION_CONFIG.atmosphere.sources]
  if (source && typeof source === 'object' && 'beauty' in source) {
    return Number(source.beauty) || 0
  }
  return appealFallback
}

export function arrivalModeForBand(
  draw: number,
  reservedSlot: boolean,
): BandArrivalMode {
  if (draw < SIMULATION_CONFIG.bandSupply.visitorArrivalDrawBelow || !reservedSlot) {
    return 'staffGate'
  }
  return 'tourBus'
}

export type BandDemand = {
  bandId: string
  draw: number
  wantsBus: boolean
}

export function todayBandDemand(
  snapshot: { day: number; festival: { bookings: readonly Booking[] } },
  stageIds: readonly string[],
): BandDemand[] {
  const seen = new Set<string>()
  const demand: BandDemand[] = []
  for (const booking of snapshot.festival.bookings) {
    if (booking.day !== snapshot.day || !stageIds.includes(booking.stageId)) continue
    if (seen.has(booking.bandId)) continue
    seen.add(booking.bandId)
    const band = BANDS.find((item) => item.id === booking.bandId)
    const draw = band?.draw ?? 0
    demand.push({
      bandId: booking.bandId,
      draw,
      wantsBus: draw >= SIMULATION_CONFIG.bandSupply.visitorArrivalDrawBelow,
    })
  }
  return demand.sort((left, right) => right.draw - left.draw || left.bandId.localeCompare(right.bandId))
}

export function busDemandCount(demand: readonly BandDemand[]): number {
  return demand.filter((item) => item.wantsBus).length
}

function manhattan(
  a: { x: number; z: number },
  b: { x: number; z: number },
): number {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z)
}

function nearestComponentDistance(
  from: { x: number; z: number },
  tiles: ReadonlyArray<{ x: number; z: number }>,
): number {
  let minimum = Number.POSITIVE_INFINITY
  for (const tile of tiles) {
    const distance = manhattan(from, tile)
    if (distance < minimum) minimum = distance
  }
  return minimum
}

export function countNearbyCatering(
  buildings: readonly PlacedBuilding[],
  tiles: ReadonlyArray<{ x: number; z: number }>,
): { foodCount: number; drinkCount: number } {
  const range = SIMULATION_CONFIG.bandSupply.cateringRange
  let foodCount = 0
  let drinkCount = 0
  for (const building of buildings) {
    if (building.kind !== 'food' && building.kind !== 'alcohol') continue
    if (nearestComponentDistance(building, tiles) > range) continue
    if (building.kind === 'food') foodCount += 1
    else drinkCount += 1
  }
  return { foodCount, drinkCount }
}

export function decoScoreOnActiveTiles(
  buildings: readonly PlacedBuilding[],
  activeKeys: ReadonlySet<string>,
): number {
  let raw = 0
  for (const building of buildings) {
    if (!isScenery(building.kind) && !SCENERY_KIND_SET.has(building.kind)) continue
    if (!activeKeys.has(backstageCellKey(building))) continue
    raw += sceneryBeauty(building.kind, BUILDINGS[building.kind]?.appeal ?? 0)
  }
  return diminishBeauty(raw)
}

export type BandSupplyComputeContext = {
  fansOnActiveTiles: number
  usableSlots: number
}

export function computeBandSupplyStats(
  snapshot: GameSnapshot,
  component: BandSupplyComponent,
  context: BandSupplyComputeContext,
): BandSupplyStats {
  const config = SIMULATION_CONFIG.bandSupply
  const hasActiveBackstage = component.active && component.cells.length > 0
  const activeKeys = new Set(
    hasActiveBackstage ? component.cells.map((cell) => backstageCellKey(cell)) : [],
  )
  const demand = todayBandDemand(snapshot, component.stageIds)
  const busDemand = busDemandCount(demand)
  const usableSlots = hasActiveBackstage ? context.usableSlots : 0
  const parkingRatio =
    busDemand <= 0 ? null : Math.min(1, usableSlots / busDemand)
  const parkingTerm =
    parkingRatio === null ? 0 : parkingRatio * config.parkingFullAttractivenessBonus
  const fansOnActiveTiles = hasActiveBackstage ? context.fansOnActiveTiles : 0
  const fanPenalty = hasActiveBackstage
    ? Math.min(
        config.fanAttractivenessPenaltyCap,
        fansOnActiveTiles * config.fanAttractivenessPenaltyPerFan,
      )
    : 0
  const decoScore = hasActiveBackstage
    ? decoScoreOnActiveTiles(snapshot.buildings, activeKeys)
    : 0
  const attractiveness = hasActiveBackstage
    ? clampScore(decoScore + parkingTerm - fanPenalty)
    : config.bareStageAttractiveness
  const tilesForCatering = hasActiveBackstage
    ? component.tiles
    : component.tiles.filter((tile) => tile.role === 'stage')
  const { foodCount, drinkCount } = countNearbyCatering(
    snapshot.buildings,
    tilesForCatering,
  )
  const dedicatedCatering = 0
  const parkCatering =
    foodCount * config.cateringPerFoodStall +
    drinkCount * config.cateringPerDrinkStall
  const catering = clampScore(
    Math.min(config.cateringCap, parkCatering + dedicatedCatering),
  )
  const satisfaction = clampScore(
    attractiveness * config.satisfactionFromAttractiveness +
      catering * config.satisfactionFromCatering -
      (hasActiveBackstage ? 0 : config.satisfactionBarePenalty),
  )
  const showQuality = lerpShowQuality(satisfaction)
  const stages = component.stageIds
    .map((id) => snapshot.buildings.find((building) => building.id === id))
    .filter((building): building is PlacedBuilding => Boolean(building))
    .map((stage) => ({
      id: stage.id,
      name: stageDisplayName(stage),
      bandName: stage.bandName,
    }))
  const bookings: BandSupplyBookingInfo[] = snapshot.festival.bookings
    .filter(
      (booking) =>
        booking.day === snapshot.day && component.stageIds.includes(booking.stageId),
    )
    .sort((left, right) => left.start - right.start)
    .map((booking) => {
      const band = BANDS.find((item) => item.id === booking.bandId)
      const stage = stages.find((item) => item.id === booking.stageId)
      const reserved = demand
        .filter((item) => item.wantsBus)
        .findIndex((item) => item.bandId === booking.bandId)
      const reservedSlot = reserved >= 0 && reserved < usableSlots
      return {
        bandId: booking.bandId,
        bandName: band?.name ?? booking.bandId,
        mode: arrivalModeForBand(band?.draw ?? 0, reservedSlot),
        start: booking.start,
        duration: booking.duration,
        stageId: booking.stageId,
        stageName: stage?.name ?? 'Bühne',
      }
    })
  return {
    componentId: component.id,
    active: component.active,
    designatedTiles: component.cells.length,
    activeTiles: hasActiveBackstage ? component.cells.length : 0,
    stageIds: [...component.stageIds],
    stages,
    bookings,
    usableSlots,
    busDemand,
    parkingRatio,
    parkingNeeded: busDemand > 0,
    parkingSufficient: busDemand > 0 && usableSlots >= busDemand,
    attractiveness,
    decoScore,
    parkingTerm,
    fanPenalty,
    fansOnActiveTiles,
    catering,
    foodCount,
    drinkCount,
    dedicatedCatering,
    satisfaction,
    showQuality,
    bareStage: !hasActiveBackstage,
  }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value))
}

export function collectBandSupplySnapshot(
  snapshot: GameSnapshot,
  components: readonly BandSupplyComponent[],
  contextFor: (component: BandSupplyComponent) => BandSupplyComputeContext,
): BandSupplySnapshot {
  const stats = components.map((component) =>
    computeBandSupplyStats(snapshot, component, contextFor(component)),
  )
  const showQualityByStageId: Record<string, number> = {}
  const bare = SIMULATION_CONFIG.bandSupply.bareShowQuality
  for (const building of snapshot.buildings) {
    if (building.kind !== 'stage') continue
    const match = stats.find((item) => item.stageIds.includes(building.id))
    showQualityByStageId[building.id] = match?.showQuality ?? bare
  }
  return {
    components: stats,
    showQualityByStageId,
    activeKeys: components.flatMap((component) =>
      component.active ? component.cells.map((cell) => backstageCellKey(cell)) : [],
    ),
  }
}

export function showQualityForStage(
  supply: BandSupplySnapshot | undefined,
  stageId: string,
): number {
  return (
    supply?.showQualityByStageId[stageId] ??
    SIMULATION_CONFIG.bandSupply.bareShowQuality
  )
}

export function bandSupplyForStage(
  supply: BandSupplySnapshot | undefined,
  stageId: string,
): BandSupplyStats | undefined {
  return supply?.components.find((component) => component.stageIds.includes(stageId))
}

export function bandSupplyAt(
  supply: BandSupplySnapshot | undefined,
  components: readonly BandSupplyComponent[],
  x: number,
  z: number,
): BandSupplyStats | undefined {
  const component = componentAt(components, x, z)
  if (!component) return undefined
  return supply?.components.find((item) => item.componentId === component.id)
}

export function clockLabel(minute: number): string {
  const hours = Math.floor(minute / 60) % 24
  const minutes = Math.floor(minute % 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function formatBackstageInspect(stats: BandSupplyStats): {
  status: string
  lines: Array<{ label: string; value: string }>
} {
  const parking =
    !stats.parkingNeeded
      ? 'nicht nötig'
      : `${stats.usableSlots} / ${stats.busDemand}${
          stats.parkingSufficient ? ' · reicht' : ' · nicht max.'
        }`
  return {
    status: stats.active
      ? stats.bareStage
        ? 'Aktiv · nur Bühne (schwach versorgt)'
        : `Aktiv · ${stats.activeTiles} Felder`
      : 'Inaktiv · keine Verbindung zur Bühne',
    lines: [
      {
        label: 'Status',
        value: stats.active
          ? stats.bareStage
            ? 'Nur Bühne'
            : 'Verbunden'
          : 'Getrennt — zählt nicht',
      },
      {
        label: 'Felder',
        value: `${stats.activeTiles} aktiv / ${stats.designatedTiles} ausgewiesen`,
      },
      {
        label: 'Bühnen',
        value:
          stats.stages.length === 0
            ? 'keine'
            : stats.stages
                .map((stage) => stage.bandName ? `${stage.name} · ${stage.bandName}` : stage.name)
                .join(', '),
      },
      {
        label: 'Heute',
        value:
          stats.bookings.length === 0
            ? 'keine Auftritte'
            : stats.bookings
                .map(
                  (booking) =>
                    `${booking.bandName} ${clockLabel(booking.start)}–${clockLabel(booking.start + booking.duration)}`,
                )
                .join(', '),
      },
      {
        label: 'Ankunft',
        value:
          stats.bookings.length === 0
            ? '—'
            : [...new Map(stats.bookings.map((booking) => [booking.bandId, booking])).values()]
                .map(
                  (booking) =>
                    `${booking.bandName}: ${
                      booking.mode === 'tourBus' ? 'Tourbus' : 'Personaleingang'
                    }`,
                )
                .join(', '),
      },
      { label: 'Tourbus-Parkplätze', value: parking },
      { label: 'Attraktivität', value: `${Math.round(stats.attractiveness)} / 100` },
      {
        label: 'Davon Deko / Parkplätze / Fans',
        value: `${Math.round(stats.decoScore)} / ${Math.round(stats.parkingTerm)} / −${Math.round(stats.fanPenalty)}`,
      },
      { label: 'Verpflegung', value: `${Math.round(stats.catering)} / 100` },
      {
        label: 'Imbiss / Getränke / Backstage-Küche',
        value: `${stats.foodCount} / ${stats.drinkCount} / ${stats.dedicatedCatering}`,
      },
      {
        label: 'Bandzufriedenheit / Drauf',
        value: `${Math.round(stats.satisfaction)} / 100`,
      },
      {
        label: 'Nur Bühne',
        value: stats.bareStage ? 'ja — schwächerer Auftritt' : 'nein',
      },
      {
        label: 'Show-Qualität',
        value: `× ${stats.showQuality.toFixed(2)}`,
      },
      { label: 'Fans auf dem Backstage', value: String(stats.fansOnActiveTiles) },
      {
        label: 'Security',
        value: 'Basis-Leck; in v1 keine Reduktion durch Security oder Zäune',
      },
    ],
  }
}

export function formatBackstageHover(stats: BandSupplyStats): string {
  if (!stats.active) return 'Backstage · getrennt von der Bühne'
  return `Backstage · Drauf ${Math.round(stats.satisfaction)} · Show ×${stats.showQuality.toFixed(2)}`
}

export function isFanIntrusionEligible(visitor: {
  state: string
  arrivalMode?: string
}): boolean {
  return (
    visitor.state !== 'leaving' &&
    visitor.state !== 'exiting' &&
    visitor.state !== 'sleeping' &&
    visitor.state !== 'medical' &&
    visitor.state !== 'medical-transport' &&
    visitor.state !== 'injured' &&
    visitor.state !== 'vehicle-arrival' &&
    visitor.state !== 'bus-riding' &&
    visitor.state !== 'bus-waiting'
  )
}

export function lastBookingEnd(
  bookings: readonly Booking[],
  bandId: string,
  day: number,
): number {
  let last = 0
  for (const booking of bookings) {
    if (booking.bandId !== bandId || booking.day !== day) continue
    last = Math.max(last, booking.start + booking.duration)
  }
  return last
}

export function bandLeaveMinute(
  bookings: readonly Booking[],
  bandId: string,
  day: number,
): number {
  const config = SIMULATION_CONFIG.bandSupply
  return Math.min(
    24 * 60,
    Math.max(config.busDepartHour * 60, lastBookingEnd(bookings, bandId, day)),
  )
}

export function bandArriveMinute(): number {
  return SIMULATION_CONFIG.bandSupply.busArriveHour * 60
}

export function isBandOnSiteMinute(
  bookings: readonly Booking[],
  bandId: string,
  day: number,
  minute: number,
): boolean {
  if (!bookings.some((booking) => booking.bandId === bandId && booking.day === day)) {
    return false
  }
  return minute >= bandArriveMinute() && minute < bandLeaveMinute(bookings, bandId, day)
}
