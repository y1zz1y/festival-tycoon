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

export function findNearestWasteBin(
  from: { x: number; z: number },
  bins: readonly WasteBinInfo[],
  range: number,
  capacity: number,
): WasteBinInfo | null {
  return (
    bins
      .filter(
        (bin) =>
          bin.stored < capacity &&
          Math.abs(bin.x - from.x) + Math.abs(bin.z - from.z) <= range,
      )
      .sort(
        (left, right) =>
          Math.abs(left.x - from.x) +
          Math.abs(left.z - from.z) -
          (Math.abs(right.x - from.x) + Math.abs(right.z - from.z)),
      )[0] ?? null
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

export function isParkWasteDumpOverFull(
  dumps: readonly WasteDumpCell[],
  ratio = SIMULATION_CONFIG.waste.dumpFullRatio,
  capacityPerCell = SIMULATION_CONFIG.waste.dumpCapacity,
): boolean {
  const fill = parkWasteDumpFill(dumps, capacityPerCell)
  if (!fill || fill.capacity <= 0) return false
  return fill.stored / fill.capacity > ratio
}
