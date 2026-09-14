import type { Direction } from './logistics'
import { DIRECTION_OFFSETS, oppositeDirection } from './logistics'

export const ACCESS_SLOTS_PER_HOUR = 6
export const ACCESS_SLOT_MINUTES = 60 / ACCESS_SLOTS_PER_HOUR

export type AccessControlKind = 'trafficLight' | 'pathBarrier'
export type AccessControlMode = 'schedule' | 'sensor' | 'always' | 'locked'
export type AccessSignal = 'open' | 'closed'
export type AccessPolarity = 'open' | 'closed'
export type BarrierPassage = 'oneWay' | 'both'

export type TrafficSensorKind =
  | 'freeParking'
  | 'noFreeParking'
  | 'carsBelow'
  | 'carsAbove'

export type PathSensorKind =
  | 'freeCamping'
  | 'occupiedCamping'
  | 'peopleBelow'
  | 'peopleAbove'

export type AccessAreaCell = { x: number; z: number }

export type AccessControlBase = {
  id: string
  kind: AccessControlKind
  x: number
  z: number
  direction: Direction
  mode: AccessControlMode
  openSlots: boolean[]
  polarity: AccessPolarity
  sensorThreshold: number
  area: AccessAreaCell[]
  signal: AccessSignal
}

export type TrafficLight = AccessControlBase & {
  kind: 'trafficLight'
  sensorKind: TrafficSensorKind
}

export type PathBarrier = AccessControlBase & {
  kind: 'pathBarrier'
  elevation: number
  sensorKind: PathSensorKind
  passage: BarrierPassage
  openInEmergency: boolean
}

export type AccessControl = TrafficLight | PathBarrier

export type AccessControlSnapshot = {
  trafficLights: TrafficLight[]
  pathBarriers: PathBarrier[]
}

export type AccessAreaStats = {
  freeParking: number
  occupiedParking: number
  carsOnRoad: number
  freeCamping: number
  occupiedCamping: number
  people: number
}

export type AccessAreaIndexes = {
  freeParking: ReadonlySet<string>
  occupiedParking: ReadonlySet<string>
  carsOnRoad: ReadonlyMap<string, number>
  freeCamping: ReadonlySet<string>
  occupiedCamping: ReadonlySet<string>
  people: ReadonlyMap<string, number>
  emergency: boolean
}

const TRAFFIC_SENSORS: readonly TrafficSensorKind[] = [
  'freeParking',
  'noFreeParking',
  'carsBelow',
  'carsAbove',
]
const PATH_SENSORS: readonly PathSensorKind[] = [
  'freeCamping',
  'occupiedCamping',
  'peopleBelow',
  'peopleAbove',
]

export function createAccessControlSnapshot(): AccessControlSnapshot {
  return { trafficLights: [], pathBarriers: [] }
}

export function accessCellKey(x: number, z: number): string {
  return `${x}:${z}`
}

export function accessEdgeKey(x: number, z: number, direction: Direction): string {
  return `${x}:${z}:${direction}`
}

export function currentAccessSlot(minute: number): number {
  const minuteOfHour = ((Math.floor(minute) % 60) + 60) % 60
  return Math.min(
    ACCESS_SLOTS_PER_HOUR - 1,
    Math.floor(minuteOfHour / ACCESS_SLOT_MINUTES),
  )
}

export function defaultOpenSlots(): boolean[] {
  return [true, true, true, false, false, false]
}

export function normalizeOpenSlots(value: unknown): boolean[] {
  const source = Array.isArray(value) ? value : []
  return Array.from({ length: ACCESS_SLOTS_PER_HOUR }, (_, index) =>
    Boolean(source[index]),
  )
}

export function minutesUntilScheduleOpen(
  openSlots: readonly boolean[],
  minute: number,
): number {
  const slot = currentAccessSlot(minute)
  const minuteOfHour = ((Math.floor(minute) % 60) + 60) % 60
  const slotStart = slot * ACCESS_SLOT_MINUTES
  const remainingInSlot = ACCESS_SLOT_MINUTES - (minuteOfHour - slotStart)
  if (openSlots[slot]) return 0
  for (let step = 1; step <= ACCESS_SLOTS_PER_HOUR; step += 1) {
    const next = (slot + step) % ACCESS_SLOTS_PER_HOUR
    if (openSlots[next]) {
      return remainingInSlot + (step - 1) * ACCESS_SLOT_MINUTES
    }
  }
  return Number.POSITIVE_INFINITY
}

export function isScheduleOpen(openSlots: readonly boolean[], minute: number): boolean {
  return Boolean(openSlots[currentAccessSlot(minute)])
}

export function conditionHolds(
  kind: TrafficSensorKind | PathSensorKind,
  threshold: number,
  stats: AccessAreaStats,
): boolean {
  switch (kind) {
    case 'freeParking':
      return stats.freeParking > 0
    case 'noFreeParking':
      return stats.freeParking === 0
    case 'carsBelow':
      return stats.carsOnRoad < threshold
    case 'carsAbove':
      return stats.carsOnRoad > threshold
    case 'freeCamping':
      return stats.freeCamping > 0
    case 'occupiedCamping':
      return stats.occupiedCamping > 0
    case 'peopleBelow':
      return stats.people < threshold
    case 'peopleAbove':
      return stats.people > threshold
  }
}

export function signalFromCondition(
  polarity: AccessPolarity,
  condition: boolean,
): AccessSignal {
  if (polarity === 'open') return condition ? 'open' : 'closed'
  return condition ? 'closed' : 'open'
}

export function evaluateAccessSignal(
  control: AccessControl,
  minute: number,
  stats: AccessAreaStats,
  emergency = false,
): AccessSignal {
  if (
    emergency &&
    control.kind === 'pathBarrier' &&
    control.openInEmergency
  ) {
    return 'open'
  }
  if (control.mode === 'always') return 'open'
  if (control.mode === 'locked') return 'closed'
  if (control.mode === 'schedule') {
    return isScheduleOpen(control.openSlots, minute) ? 'open' : 'closed'
  }
  return signalFromCondition(
    control.polarity,
    conditionHolds(control.sensorKind, control.sensorThreshold, stats),
  )
}

export function releasesBarrierForEmergency(
  control: AccessControl,
  emergency: boolean,
): boolean {
  return (
    emergency &&
    control.kind === 'pathBarrier' &&
    control.openInEmergency
  )
}

export function reverseAccessEdgeKey(
  x: number,
  z: number,
  direction: Direction,
): string {
  const offset = DIRECTION_OFFSETS[direction]
  return accessEdgeKey(
    x + offset.x,
    z + offset.z,
    oppositeDirection(direction),
  )
}

/** Edge from the cell before a traffic light into the light, in travel direction. */
export function incomingAccessEdgeKey(
  x: number,
  z: number,
  direction: Direction,
): string {
  const offset = DIRECTION_OFFSETS[direction]
  return accessEdgeKey(x - offset.x, z - offset.z, direction)
}

export function routeUsesClosedEdge(
  startX: number,
  startZ: number,
  route: readonly { x: number; z: number }[],
  closedEdges: ReadonlySet<string>,
): boolean {
  let fromX = startX
  let fromZ = startZ
  for (const step of route) {
    if (stepUsesClosedEdge(fromX, fromZ, step.x, step.z, closedEdges)) return true
    fromX = step.x
    fromZ = step.z
  }
  return false
}

export function remainingClosedMinutes(
  control: AccessControl,
  minute: number,
): number {
  if (control.signal === 'open') return 0
  if (control.mode === 'schedule') {
    return minutesUntilScheduleOpen(control.openSlots, minute)
  }
  return Number.POSITIVE_INFINITY
}

export function statsForArea(
  area: readonly AccessAreaCell[],
  indexes: AccessAreaIndexes,
): AccessAreaStats {
  const stats: AccessAreaStats = {
    freeParking: 0,
    occupiedParking: 0,
    carsOnRoad: 0,
    freeCamping: 0,
    occupiedCamping: 0,
    people: 0,
  }
  const seen = new Set<string>()
  for (const cell of area) {
    const key = accessCellKey(cell.x, cell.z)
    if (seen.has(key)) continue
    seen.add(key)
    if (indexes.freeParking.has(key)) stats.freeParking += 1
    if (indexes.occupiedParking.has(key)) stats.occupiedParking += 1
    stats.carsOnRoad += indexes.carsOnRoad.get(key) ?? 0
    if (indexes.freeCamping.has(key)) stats.freeCamping += 1
    if (indexes.occupiedCamping.has(key)) stats.occupiedCamping += 1
    stats.people += indexes.people.get(key) ?? 0
  }
  return stats
}

export function toggleAreaCells(
  area: readonly AccessAreaCell[],
  from: AccessAreaCell,
  to: AccessAreaCell,
): AccessAreaCell[] {
  const minX = Math.min(from.x, to.x)
  const maxX = Math.max(from.x, to.x)
  const minZ = Math.min(from.z, to.z)
  const maxZ = Math.max(from.z, to.z)
  const next = new Map(area.map((cell) => [accessCellKey(cell.x, cell.z), cell]))
  const rect: AccessAreaCell[] = []
  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      rect.push({ x, z })
    }
  }
  const allSelected = rect.every((cell) => next.has(accessCellKey(cell.x, cell.z)))
  for (const cell of rect) {
    const key = accessCellKey(cell.x, cell.z)
    if (allSelected) next.delete(key)
    else next.set(key, cell)
  }
  return [...next.values()]
}

export function closedAccessEdges(
  controls: readonly AccessControl[],
  longOnly = false,
  minute = 0,
  rerouteMinutes = Number.POSITIVE_INFINITY,
  emergency = false,
): Set<string> {
  const edges = new Set<string>()
  for (const control of controls) {
    const skipClosed =
      longOnly &&
      remainingClosedMinutes(control, minute) <= rerouteMinutes
    const forward = accessEdgeKey(control.x, control.z, control.direction)
    if (control.kind === 'pathBarrier') {
      if (releasesBarrierForEmergency(control, emergency)) continue
      const reverse = reverseAccessEdgeKey(
        control.x,
        control.z,
        control.direction,
      )
      if (control.signal === 'closed' && !skipClosed) {
        edges.add(forward)
        edges.add(reverse)
      } else if (control.passage === 'oneWay') {
        edges.add(reverse)
      }
      continue
    }
    if (control.signal !== 'closed' || skipClosed) continue
    edges.add(forward)
    edges.add(incomingAccessEdgeKey(control.x, control.z, control.direction))
  }
  return edges
}

export function stepUsesClosedEdge(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  closedEdges: ReadonlySet<string>,
): boolean {
  const offsetX = toX - fromX
  const offsetZ = toZ - fromZ
  for (const direction of [0, 1, 2, 3] as const) {
    const offset = DIRECTION_OFFSETS[direction]
    if (offset.x === offsetX && offset.z === offsetZ) {
      return closedEdges.has(accessEdgeKey(fromX, fromZ, direction))
    }
  }
  return false
}

export function previewLabel(
  kind: AccessControlKind,
  sensorKind: TrafficSensorKind | PathSensorKind,
  stats: AccessAreaStats,
): string {
  if (kind === 'trafficLight') {
    if (sensorKind === 'freeParking' || sensorKind === 'noFreeParking') {
      return `${stats.freeParking} freie / ${stats.occupiedParking} belegte Parkplätze`
    }
    return `${stats.carsOnRoad} Autos auf Straßen im Gebiet`
  }
  if (sensorKind === 'freeCamping' || sensorKind === 'occupiedCamping') {
    return `${stats.freeCamping} freie / ${stats.occupiedCamping} belegte Campingflächen`
  }
  return `${stats.people} Personen im Gebiet`
}

export function areaPreviewText(
  kind: AccessControlKind,
  stats: AccessAreaStats,
): string {
  if (kind === 'trafficLight') {
    return `${stats.freeParking} freie / ${stats.occupiedParking} belegte Parkplätze · ${stats.carsOnRoad} Autos auf Straßen im Gebiet`
  }
  return `${stats.freeCamping} freie / ${stats.occupiedCamping} belegte Campingflächen · ${stats.people} Personen im Gebiet`
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asDirection(value: unknown): Direction {
  const direction = Math.round(asNumber(value, 0))
  return ((((direction % 4) + 4) % 4) as Direction)
}

function normalizeArea(value: unknown): AccessAreaCell[] {
  if (!Array.isArray(value)) return []
  const cells = new Map<string, AccessAreaCell>()
  for (const entry of value) {
    const source = asRecord(entry)
    if (!source) continue
    const x = Math.round(asNumber(source.x, Number.NaN))
    const z = Math.round(asNumber(source.z, Number.NaN))
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue
    cells.set(accessCellKey(x, z), { x, z })
  }
  return [...cells.values()]
}

function normalizeBase(
  source: Record<string, unknown>,
  kind: AccessControlKind,
): AccessControlBase | null {
  const id = typeof source.id === 'string' && source.id ? source.id : null
  if (!id) return null
  const polarity = source.polarity === 'closed' ? 'closed' : 'open'
  return {
    id,
    kind,
    x: Math.round(asNumber(source.x, 0)),
    z: Math.round(asNumber(source.z, 0)),
    direction: asDirection(source.direction),
    mode:
      source.mode === 'sensor'
        ? 'sensor'
        : source.mode === 'always'
          ? 'always'
          : source.mode === 'locked'
            ? 'locked'
            : 'schedule',
    openSlots: normalizeOpenSlots(source.openSlots),
    polarity,
    sensorThreshold: Math.max(0, Math.round(asNumber(source.sensorThreshold, 5))),
    area: normalizeArea(source.area),
    signal: source.signal === 'closed' ? 'closed' : 'open',
  }
}

export function normalizeTrafficLight(value: unknown): TrafficLight | null {
  const source = asRecord(value)
  if (!source) return null
  const base = normalizeBase(source, 'trafficLight')
  if (!base) return null
  const sensorKind = TRAFFIC_SENSORS.includes(source.sensorKind as TrafficSensorKind)
    ? (source.sensorKind as TrafficSensorKind)
    : 'freeParking'
  return { ...base, kind: 'trafficLight', sensorKind }
}

export function normalizePathBarrier(value: unknown): PathBarrier | null {
  const source = asRecord(value)
  if (!source) return null
  const base = normalizeBase(source, 'pathBarrier')
  if (!base) return null
  const sensorKind = PATH_SENSORS.includes(source.sensorKind as PathSensorKind)
    ? (source.sensorKind as PathSensorKind)
    : 'peopleAbove'
  return {
    ...base,
    kind: 'pathBarrier',
    elevation: asNumber(source.elevation, 0),
    sensorKind,
    passage: source.passage === 'both' ? 'both' : 'oneWay',
    openInEmergency: source.openInEmergency !== false,
  }
}

export function normalizeAccessControls(value: unknown): AccessControlSnapshot {
  const source = asRecord(value)
  return {
    trafficLights: (Array.isArray(source?.trafficLights) ? source.trafficLights : [])
      .map(normalizeTrafficLight)
      .filter((item): item is TrafficLight => Boolean(item)),
    pathBarriers: (Array.isArray(source?.pathBarriers) ? source.pathBarriers : [])
      .map(normalizePathBarrier)
      .filter((item): item is PathBarrier => Boolean(item)),
  }
}

export function createTrafficLight(
  id: string,
  x: number,
  z: number,
  direction: Direction,
): TrafficLight {
  return {
    id,
    kind: 'trafficLight',
    x,
    z,
    direction,
    mode: 'schedule',
    openSlots: defaultOpenSlots(),
    polarity: 'open',
    sensorKind: 'freeParking',
    sensorThreshold: 5,
    area: [],
    signal: 'open',
  }
}

export function createPathBarrier(
  id: string,
  x: number,
  z: number,
  elevation: number,
  direction: Direction,
): PathBarrier {
  return {
    id,
    kind: 'pathBarrier',
    x,
    z,
    elevation,
    direction,
    mode: 'schedule',
    openSlots: defaultOpenSlots(),
    polarity: 'open',
    sensorKind: 'peopleAbove',
    sensorThreshold: 8,
    area: [],
    signal: 'open',
    passage: 'oneWay',
    openInEmergency: true,
  }
}
