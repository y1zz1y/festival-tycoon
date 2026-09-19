import { SIMULATION_CONFIG } from './simulationConfig'

export type WasteDumpCell = {
  x: number
  z: number
  elevation: number
  stored: number
}

export function wasteDumpId(cell: { x: number; z: number }): string {
  return `dump:${cell.x}:${cell.z}`
}

export function parseWasteDumpId(
  id: string,
): { x: number; z: number } | null {
  const match = /^dump:(-?\d+):(-?\d+)$/.exec(id)
  if (!match) return null
  return { x: Number(match[1]), z: Number(match[2]) }
}

export function designateWasteDumps(
  existing: readonly WasteDumpCell[],
  area: ReadonlyArray<{ x: number; z: number }>,
  canPlace: (x: number, z: number) => boolean,
  availableMoney: number,
): { cells: WasteDumpCell[]; placed: number; cost: number } {
  const keys = new Set(existing.map((cell) => `${cell.x}:${cell.z}`))
  const candidates = area.filter(
    (cell) => !keys.has(`${cell.x}:${cell.z}`) && canPlace(cell.x, cell.z),
  )
  const costPerCell = SIMULATION_CONFIG.waste.dumpDesignationCost
  const affordable = Math.min(
    candidates.length,
    Math.floor(availableMoney / costPerCell),
  )
  const additions = candidates.slice(0, affordable).map((cell) => ({
    ...cell,
    elevation: 0,
    stored: 0,
  }))
  return {
    cells: [...existing, ...additions],
    placed: additions.length,
    cost: additions.length * costPerCell,
  }
}

export function wasteDumpRemaining(
  dump: WasteDumpCell,
  capacity = SIMULATION_CONFIG.waste.dumpCapacity,
): number {
  return Math.max(0, capacity - Math.max(0, dump.stored))
}

/** Deposit without exceeding the per-tile cap. Returns the accepted amount. */
export function acceptWasteAtDump(
  dump: WasteDumpCell,
  amount: number,
  capacity = SIMULATION_CONFIG.waste.dumpCapacity,
): number {
  if (amount <= 0) return 0
  const added = Math.min(amount, wasteDumpRemaining(dump, capacity))
  dump.stored += added
  return added
}

export function clampWasteDumpStored(
  dump: WasteDumpCell,
  capacity = SIMULATION_CONFIG.waste.dumpCapacity,
): WasteDumpCell {
  dump.stored = Math.min(capacity, Math.max(0, Number(dump.stored) || 0))
  return dump
}

export function findNearestWasteDump(
  from: { x: number; z: number },
  dumps: readonly WasteDumpCell[],
  capacity = SIMULATION_CONFIG.waste.dumpCapacity,
): WasteDumpCell | null {
  return (
    dumps
      .filter((dump) => wasteDumpRemaining(dump, capacity) > 0)
      .slice()
      .sort(
        (left, right) =>
          Math.abs(left.x - from.x) +
          Math.abs(left.z - from.z) -
          (Math.abs(right.x - from.x) + Math.abs(right.z - from.z)),
      )[0] ?? null
  )
}

export type WasteBinInfo = {
  id: string
  x: number
  z: number
  elevation: number
  stored: number
}

export function wasteBinManhattan(
  from: { x: number; z: number },
  bin: { x: number; z: number },
): number {
  return Math.abs(bin.x - from.x) + Math.abs(bin.z - from.z)
}

export function wasteBinChebyshev(
  from: { x: number; z: number },
  bin: { x: number; z: number },
): number {
  return Math.max(Math.abs(bin.x - from.x), Math.abs(bin.z - from.z))
}

export type VisitorWasteKind = 'bin' | 'sealed'

export type VisitorWasteTarget = WasteBinInfo & {
  kind: VisitorWasteKind
  capacity: number
}

export function visitorWasteInRange(
  from: { x: number; z: number },
  target: Pick<VisitorWasteTarget, 'x' | 'z' | 'kind'>,
  binRange = SIMULATION_CONFIG.waste.binRange,
  sealedRange = SIMULATION_CONFIG.waste.sealedVisitorChebyshevRange,
): boolean {
  return target.kind === 'sealed'
    ? wasteBinChebyshev(from, target) <= sealedRange
    : wasteBinManhattan(from, target) <= binRange
}

export function findNearestVisitorWasteTarget(
  from: { x: number; z: number },
  targets: readonly VisitorWasteTarget[],
  requireRoom = true,
): VisitorWasteTarget | null {
  return (
    targets
      .filter(
        (target) =>
          visitorWasteInRange(from, target) &&
          (!requireRoom || wasteBinHasRoom(target, target.capacity)),
      )
      .sort(
        (left, right) =>
          wasteBinManhattan(from, left) - wasteBinManhattan(from, right),
      )[0] ?? null
  )
}

export function wasteBinHasRoom(
  bin: Pick<WasteBinInfo, 'stored'>,
  capacity: number,
): boolean {
  return bin.stored < capacity
}

export function findNearestWasteBinInRange(
  from: { x: number; z: number },
  bins: readonly WasteBinInfo[],
  range: number,
): WasteBinInfo | null {
  return (
    bins
      .filter((bin) => wasteBinManhattan(from, bin) <= range)
      .sort(
        (left, right) =>
          wasteBinManhattan(from, left) - wasteBinManhattan(from, right),
      )[0] ?? null
  )
}

export function findNearestWasteBin(
  from: { x: number; z: number },
  bins: readonly WasteBinInfo[],
  range: number,
  capacity: number,
): WasteBinInfo | null {
  return findNearestWasteBinInRange(
    from,
    bins.filter((bin) => wasteBinHasRoom(bin, capacity)),
    range,
  )
}

export function normalizeWasteDumpCell(value: unknown): WasteDumpCell | null {
  if (typeof value !== 'object' || value === null) return null
  const source = value as Record<string, unknown>
  if (!Number.isFinite(source.x) || !Number.isFinite(source.z)) return null
  return {
    x: Number(source.x),
    z: Number(source.z),
    elevation: Number.isFinite(source.elevation) ? Number(source.elevation) : 0,
    stored: Math.min(
      SIMULATION_CONFIG.waste.dumpCapacity,
      Math.max(0, Number(source.stored) || 0),
    ),
  }
}

const CARDINAL_OFFSETS = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
] as const

export type WasteDumpAreaStats = {
  cells: number
  stored: number
  capacity: number
  remaining: number
  percent: number
}

/** 4-way flood fill of dump tiles; fill stays per-tile in sim, display sums the component. */
export function connectedWasteDumpStats(
  dumps: readonly WasteDumpCell[],
  origin: { x: number; z: number },
  capacityPerCell = SIMULATION_CONFIG.waste.dumpCapacity,
): WasteDumpAreaStats | null {
  const index = new Map<string, WasteDumpCell>()
  dumps.forEach((cell) => {
    index.set(`${cell.x}:${cell.z}`, cell)
  })
  const start = index.get(`${origin.x}:${origin.z}`)
  if (!start) return null
  const seen = new Set<string>([`${start.x}:${start.z}`])
  const queue = [start]
  let stored = 0
  while (queue.length > 0) {
    const cell = queue.pop()!
    stored += Math.max(0, cell.stored)
    CARDINAL_OFFSETS.forEach((offset) => {
      const key = `${cell.x + offset.x}:${cell.z + offset.z}`
      if (seen.has(key)) return
      const next = index.get(key)
      if (!next) return
      seen.add(key)
      queue.push(next)
    })
  }
  const cells = seen.size
  const capacity = cells * capacityPerCell
  const remaining = Math.max(0, capacity - stored)
  const percent =
    capacity <= 0 ? 0 : Math.min(100, Math.round((stored / capacity) * 100))
  return { cells, stored, capacity, remaining, percent }
}

export function formatWasteDumpAreaInspect(stats: WasteDumpAreaStats): {
  status: string
  lines: Array<{ label: string; value: string }>
} {
  return {
    status:
      stats.cells === 1
        ? 'Zusammenhängende Fläche · 1 Feld'
        : `Zusammenhängende Fläche · ${stats.cells} Felder`,
    lines: [
      { label: 'Gelagert', value: `${stats.stored} / ${stats.capacity}` },
      { label: 'Frei', value: String(stats.remaining) },
      { label: 'Auslastung', value: `${stats.percent} %` },
    ],
  }
}

export function formatWasteDumpAreaHover(stats: WasteDumpAreaStats): string {
  return `Müllablage · ${stats.stored}/${stats.capacity} gelagert · ${stats.remaining} frei`
}

/** Park-wide dump fill (every designated tile). Missing dumps yield null. */
export function parkWasteDumpFill(
  dumps: readonly WasteDumpCell[],
  capacityPerCell = SIMULATION_CONFIG.waste.dumpCapacity,
): WasteDumpAreaStats | null {
  if (dumps.length === 0) return null
  const stored = dumps.reduce((sum, cell) => sum + Math.max(0, cell.stored), 0)
  const cells = dumps.length
  const capacity = cells * capacityPerCell
  const remaining = Math.max(0, capacity - stored)
  const percent =
    capacity <= 0 ? 0 : Math.min(100, Math.round((stored / capacity) * 100))
  return { cells, stored, capacity, remaining, percent }
}

export const SEALED_WASTE_CONTAINER_KIND = 'sealedWasteContainer' as const

export type SealedWasteContainerInfo = {
  id: string
  x: number
  z: number
  elevation: number
  stored: number
  onRoad: boolean
  truckReachable: boolean
  /** True while a garbage truck is actually assigned / en route to this box. */
  truckEnRoute?: boolean
}

/** Idle cleaners haul when stored > 0 unless a reachable truck is already coming. */
export function sealedContainerAllowsManualHaul(
  container: Pick<
    SealedWasteContainerInfo,
    'stored' | 'onRoad' | 'truckReachable' | 'truckEnRoute'
  >,
): boolean {
  if (container.stored <= 0) return false
  // Topological truckReachable alone must not starve the haul: a roadside box
  // with no wagon coming still has to be emptied by hand. Skip only when a
  // truck that can actually empty this container is already on the way.
  if (container.truckEnRoute && container.onRoad && container.truckReachable) {
    return false
  }
  return true
}

export function isSealedWasteContainer(kind: string | undefined): boolean {
  return kind === SEALED_WASTE_CONTAINER_KIND
}

export function sealedContainerId(id: string): string {
  return `sealed:${id}`
}

export function parseSealedContainerId(id: string): string | null {
  if (!id.startsWith('sealed:')) return null
  const value = id.slice('sealed:'.length)
  return value || null
}

export function depositSealedContainerId(id: string): string {
  return `deposit-sealed:${id}`
}

export function parseDepositSealedContainerId(id: string): string | null {
  if (!id.startsWith('deposit-sealed:')) return null
  const value = id.slice('deposit-sealed:'.length)
  return value || null
}

export function sealedContainerCapacity(
  capacity = SIMULATION_CONFIG.waste.sealedContainerCapacity,
): number {
  return capacity
}

export function sealedContainerRemaining(
  container: Pick<SealedWasteContainerInfo, 'stored'>,
  capacity = SIMULATION_CONFIG.waste.sealedContainerCapacity,
): number {
  return Math.max(0, capacity - Math.max(0, container.stored))
}

export function sealedContainerHasRoom(
  container: Pick<SealedWasteContainerInfo, 'stored'>,
  capacity = SIMULATION_CONFIG.waste.sealedContainerCapacity,
): boolean {
  return sealedContainerRemaining(container, capacity) > 0
}

export function acceptWasteAtSealedContainer(
  container: { wasteFill?: number },
  amount: number,
  capacity = SIMULATION_CONFIG.waste.sealedContainerCapacity,
): number {
  if (amount <= 0) return 0
  const stored = container.wasteFill ?? 0
  const added = Math.min(amount, Math.max(0, capacity - stored))
  container.wasteFill = stored + added
  return added
}

export function emptySealedContainerStored(
  container: { wasteFill?: number },
  amount: number,
): number {
  if (amount <= 0) return 0
  const stored = container.wasteFill ?? 0
  const taken = Math.min(stored, amount)
  container.wasteFill = stored - taken
  return taken
}

export function clampSealedContainerStored(
  stored: number,
  capacity = SIMULATION_CONFIG.waste.sealedContainerCapacity,
): number {
  return Math.min(capacity, Math.max(0, Number(stored) || 0))
}

export function formatSealedContainerInspect(container: {
  stored: number
  capacity?: number
  onRoad: boolean
  truckReachable: boolean
}): {
  status: string
  lines: Array<{ label: string; value: string }>
} {
  const capacity = container.capacity ?? SIMULATION_CONFIG.waste.sealedContainerCapacity
  const remaining = Math.max(0, capacity - container.stored)
  const percent =
    capacity <= 0 ? 0 : Math.min(100, Math.round((container.stored / capacity) * 100))
  const truck =
    container.onRoad && container.truckReachable
      ? 'Müllwagen kann entleeren · sonst trägt die Reinigung'
      : container.onRoad
        ? 'Straße ohne Zufahrt · Reinigung trägt zur Ablage'
        : 'Nicht an der Straße · Reinigung trägt zur Ablage'
  return {
    status: truck,
    lines: [
      { label: 'Gelagert', value: `${container.stored} / ${capacity}` },
      { label: 'Frei', value: String(remaining) },
      { label: 'Auslastung', value: `${percent} %` },
      { label: 'Abfuhr', value: truck },
    ],
  }
}

/** Destination cells for one multi-goal haul: dumps and sealed containers with room. */
export function wasteDropGoals(
  dumps: readonly WasteDumpCell[],
  containers: readonly SealedWasteContainerInfo[],
  dumpCapacity = SIMULATION_CONFIG.waste.dumpCapacity,
  containerCapacity = SIMULATION_CONFIG.waste.sealedContainerCapacity,
): Array<{ kind: 'dump' | 'sealed'; x: number; z: number; elevation: number; id: string }> {
  const goals: Array<{
    kind: 'dump' | 'sealed'
    x: number
    z: number
    elevation: number
    id: string
  }> = []
  dumps.forEach((dump) => {
    if (wasteDumpRemaining(dump, dumpCapacity) <= 0) return
    goals.push({
      kind: 'dump',
      x: dump.x,
      z: dump.z,
      elevation: dump.elevation,
      id: wasteDumpId(dump),
    })
  })
  containers.forEach((container) => {
    if (!sealedContainerHasRoom(container, containerCapacity)) return
    goals.push({
      kind: 'sealed',
      x: container.x,
      z: container.z,
      elevation: container.elevation,
      id: depositSealedContainerId(container.id),
    })
  })
  return goals
}

export function isParkWasteDumpOverFull(
  dumps: readonly WasteDumpCell[],
  ratio = SIMULATION_CONFIG.waste.dumpFullRatio,
  capacityPerCell = SIMULATION_CONFIG.waste.dumpCapacity,
): boolean {
  const fill = parkWasteDumpFill(dumps, capacityPerCell)
  if (!fill || fill.capacity <= 0) return false
  return fill.stored / fill.capacity > ratio
}

/**
 * Game minutes in one real second at normal speed — the scale the waste yard's
 * "per second" figures are quoted in, so what the player is told matches what
 * they watch happen on the clock.
 */
export const GAME_MINUTES_PER_REAL_SECOND =
  SIMULATION_CONFIG.time.minutesPerDay / SIMULATION_CONFIG.time.normalDayDurationSeconds

/** Where a truck can tip its load: the waste depot, or the works yard. */
export type WasteTipKind = 'wasteDepot' | 'specialDepot'

export function wasteTipCapacity(kind: WasteTipKind): number {
  return kind === 'wasteDepot'
    ? SIMULATION_CONFIG.waste.depotCapacity
    : SIMULATION_CONFIG.waste.yardCapacity
}

/** Bags shredded per real second, as quoted to the player. */
export function wasteTipProcessingPerSecond(kind: WasteTipKind): number {
  return kind === 'wasteDepot'
    ? SIMULATION_CONFIG.waste.depotProcessingPerSecond
    : SIMULATION_CONFIG.waste.yardProcessingPerSecond
}

export function wasteTipProcessingPerMinute(kind: WasteTipKind): number {
  return wasteTipProcessingPerSecond(kind) / GAME_MINUTES_PER_REAL_SECOND
}

/** Room left before a tip has to turn trucks away. */
export function wasteTipRemaining(
  tip: { stored?: number },
  kind: WasteTipKind,
): number {
  return Math.max(0, wasteTipCapacity(kind) - Math.max(0, tip.stored ?? 0))
}

/** Loading at a container and tipping at a depot, in game minutes. */
export function garbageTruckHandlingMinutes(
  seconds: number,
  halved: boolean,
): number {
  return seconds * GAME_MINUTES_PER_REAL_SECOND * (halved ? 0.5 : 1)
}
