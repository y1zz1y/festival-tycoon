import { SIMULATION_CONFIG } from './simulationConfig'
import { getTerrainHeight, isWaterHeight, type TerrainSnapshot } from './terrain'

export type AudioZone =
  | 'concert'
  | 'coaster'
  | 'crowdPath'
  | 'camp'
  | 'water'
  | 'backstage'
  | 'woods'

export type AudioOneShotKind =
  | 'placeBuilding'
  | 'demolish'
  | 'coasterLaunch'
  | 'cheer'
  | 'scream'
  | 'medical'
  | 'busHiss'
  | 'wasteTruck'
  | 'incident'
  | 'uiClick'

export type AudioPriority = 'ui' | 'important' | 'local' | 'ambient'

export type AudioListenerPose = {
  x: number
  y: number
  z: number
  forwardX: number
  forwardY: number
  forwardZ: number
  upX: number
  upY: number
  upZ: number
}

export type AudioEmitter = {
  id: string
  zone: AudioZone
  x: number
  z: number
  priority: AudioPriority
  intensity: number
}

export type AudioCue = {
  id: string
  kind: AudioOneShotKind
  x: number
  z: number
  priority: AudioPriority
  intensity: number
  tick: number
}

export type AudioPlan = {
  ambients: AudioEmitter[]
  oneShots: AudioCue[]
}

export type AudioWorldBuilding = {
  id: string
  kind: string
  x: number
  z: number
}

export type AudioWorldVisitor = {
  id: string
  x: number
  z: number
  state: string
  emotion: string
  concertId?: string | null
}

export type AudioWorldVehicle = {
  id: string
  kind: string
  state: string
  x: number
  z: number
}

export type AudioWorldCoaster = {
  id: string
  train: {
    state: string
    speed: number
    x: number
    z: number
    passengers: number
  }
}

export type AudioWorld = {
  simTick: number
  buildings: readonly AudioWorldBuilding[]
  visitors: readonly AudioWorldVisitor[]
  campingCells?: readonly { x: number; z: number }[]
  backstageCells?: readonly { x: number; z: number }[]
  incidents?: readonly { id: string; kind: string; x: number; z: number }[]
  coasters?: readonly AudioWorldCoaster[]
  vehicles?: readonly AudioWorldVehicle[]
  performingStageIds?: readonly string[]
  terrain?: TerrainSnapshot
  waterLevel?: number
  worldSize?: number
}

export type AudioPlannerState = {
  lastTick: number
  lastWorld: AudioWorld | null
  lastCueTick: Record<string, number>
}

/** Placeholder paths so real WAVs can drop in without renaming events. */
export const AUDIO_PLACEHOLDER_ASSETS = {
  concert: 'sfx/ambient-concert.wav',
  coaster: 'sfx/ambient-coaster.wav',
  crowdPath: 'sfx/ambient-crowd.wav',
  camp: 'sfx/ambient-camp.wav',
  water: 'sfx/ambient-water.wav',
  backstage: 'sfx/ambient-backstage.wav',
  woods: 'sfx/ambient-woods.wav',
  placeBuilding: 'sfx/oneshot-place.wav',
  demolish: 'sfx/oneshot-demolish.wav',
  coasterLaunch: 'sfx/oneshot-coaster-launch.wav',
  cheer: 'sfx/oneshot-cheer.wav',
  scream: 'sfx/oneshot-scream.wav',
  medical: 'sfx/oneshot-medical.wav',
  busHiss: 'sfx/oneshot-bus-hiss.wav',
  wasteTruck: 'sfx/oneshot-waste-truck.wav',
  incident: 'sfx/oneshot-incident.wav',
  uiClick: 'sfx/oneshot-ui-click.wav',
} as const

const AUDIO = SIMULATION_CONFIG.audio

const PRIORITY_WEIGHT: Record<AudioPriority, number> = {
  ui: 100,
  important: 80,
  local: 50,
  ambient: 20,
}

const CONCERT_KINDS = new Set([
  'stage',
  'directionalSpeaker',
  'omniSpeaker',
  'foh',
  'delayTower',
  'videoWall',
  'laserShow',
  'decoSpeaker',
  'boombox',
])
const COASTER_KINDS = new Set(['ride'])
const WOODS_KINDS = new Set(['tree', 'hedge', 'shrub', 'desertPalm'])
const CHEER_STATES = new Set(['partying', 'socializing'])
const MEDICAL_STATES = new Set(['medical', 'medical-transport', 'injured'])
const CROWD_STATES = new Set([
  'entering',
  'exploring',
  'seeking',
  'leaving',
  'exiting',
  'queuing',
])

export function createAudioPlannerState(): AudioPlannerState {
  return { lastTick: -1, lastWorld: null, lastCueTick: {} }
}

export function audioDistance2d(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = ax - bx
  const dz = az - bz
  return Math.hypot(dx, dz)
}

export function listenerFromCamera(
  camera: { x: number; y: number; z: number },
  lookAt: { x: number; y: number; z: number },
  up: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0 },
  positionMode: 'camera' | 'lookAt' = 'lookAt',
): AudioListenerPose {
  const fx = lookAt.x - camera.x
  const fy = lookAt.y - camera.y
  const fz = lookAt.z - camera.z
  const length = Math.hypot(fx, fy, fz) || 1
  const origin = positionMode === 'camera' ? camera : lookAt
  return {
    x: origin.x,
    y: origin.y,
    z: origin.z,
    forwardX: fx / length,
    forwardY: fy / length,
    forwardZ: fz / length,
    upX: up.x,
    upY: up.y,
    upZ: up.z,
  }
}

export function inAudioRange(
  x: number,
  z: number,
  listener: Pick<AudioListenerPose, 'x' | 'z'>,
  maxDistance: number = AUDIO.maxDistance,
): boolean {
  return audioDistance2d(x, z, listener.x, listener.z) <= maxDistance
}

export function voiceScore(
  priority: AudioPriority,
  distance: number,
  intensity: number,
): number {
  return PRIORITY_WEIGHT[priority] * 20 - distance + intensity * 8
}

export function selectByVoiceBudget<
  T extends { x: number; z: number; priority: AudioPriority; intensity: number },
>(
  candidates: readonly T[],
  listener: Pick<AudioListenerPose, 'x' | 'z'>,
  budget: number,
  maxDistance: number = AUDIO.maxDistance,
): T[] {
  const scored: { item: T; score: number }[] = []
  for (const item of candidates) {
    const distance = audioDistance2d(item.x, item.z, listener.x, listener.z)
    if (distance > maxDistance) continue
    scored.push({ item, score: voiceScore(item.priority, distance, item.intensity) })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, Math.max(0, budget)).map((entry) => entry.item)
}

function clusterKey(x: number, z: number, size = AUDIO.clusterSize): string {
  return `${Math.floor(x / size)}:${Math.floor(z / size)}`
}

function clusterPoints(
  points: readonly { x: number; z: number }[],
  size = AUDIO.clusterSize,
): { key: string; x: number; z: number; count: number }[] {
  const bins = new Map<string, { x: number; z: number; count: number }>()
  for (const point of points) {
    const key = clusterKey(point.x, point.z, size)
    const bin = bins.get(key)
    if (bin) {
      bin.x += point.x
      bin.z += point.z
      bin.count += 1
    } else {
      bins.set(key, { x: point.x, z: point.z, count: 1 })
    }
  }
  return [...bins.entries()].map(([key, bin]) => ({
    key,
    x: bin.x / bin.count,
    z: bin.z / bin.count,
    count: bin.count,
  }))
}

export function audioZoneForBuilding(kind: string): AudioZone | null {
  if (CONCERT_KINDS.has(kind)) return 'concert'
  if (COASTER_KINDS.has(kind)) return 'coaster'
  if (WOODS_KINDS.has(kind)) return 'woods'
  return null
}

function performingStageSet(world: AudioWorld): Set<string> {
  return new Set(world.performingStageIds ?? [])
}

function nearbyWaterClusters(world: AudioWorld, listener: Pick<AudioListenerPose, 'x' | 'z'>) {
  const terrain = world.terrain
  if (!terrain) return []
  const waterLevel = world.waterLevel ?? SIMULATION_CONFIG.terrain.waterHeight
  const step = AUDIO.waterSampleStep
  const radius = AUDIO.maxDistance
  const half = world.worldSize ? world.worldSize / 2 : 64
  const minX = Math.max(-half, Math.floor(listener.x - radius))
  const maxX = Math.min(half, Math.ceil(listener.x + radius))
  const minZ = Math.max(-half, Math.floor(listener.z - radius))
  const maxZ = Math.min(half, Math.ceil(listener.z + radius))
  const cells: { x: number; z: number }[] = []
  for (let x = minX; x <= maxX; x += step) {
    for (let z = minZ; z <= maxZ; z += step) {
      if (isWaterHeight(getTerrainHeight(terrain, x, z), waterLevel)) {
        cells.push({ x, z })
      }
    }
  }
  for (const visitor of world.visitors) {
    if (visitor.state === 'swimming') cells.push({ x: visitor.x, z: visitor.z })
  }
  return clusterPoints(cells)
}

export function collectAmbientEmitters(
  world: AudioWorld,
  listener: Pick<AudioListenerPose, 'x' | 'z'>,
): AudioEmitter[] {
  const live = performingStageSet(world)
  const emitters: AudioEmitter[] = []
  const zonePoints = new Map<AudioZone, { id: string; x: number; z: number; intensity: number }[]>()

  const push = (
    zone: AudioZone,
    id: string,
    x: number,
    z: number,
    intensity: number,
  ) => {
    const list = zonePoints.get(zone) ?? []
    list.push({ id, x, z, intensity })
    zonePoints.set(zone, list)
  }

  for (const building of world.buildings) {
    const zone = audioZoneForBuilding(building.kind)
    if (!zone) continue
    if (!inAudioRange(building.x, building.z, listener, AUDIO.maxDistance * 1.25)) continue
    const intensity =
      zone === 'concert'
        ? building.kind === 'stage' && live.has(building.id)
          ? 1
          : live.size > 0
            ? 0.55
            : 0.28
        : 0.45
    push(zone, building.id, building.x + 0.5, building.z + 0.5, intensity)
  }

  for (const coaster of world.coasters ?? []) {
    if (!inAudioRange(coaster.train.x, coaster.train.z, listener, AUDIO.maxDistance * 1.25)) continue
    const running = coaster.train.state === 'running'
    push(
      'coaster',
      `coaster:${coaster.id}`,
      coaster.train.x,
      coaster.train.z,
      running ? 0.85 : 0.35,
    )
  }

  const crowd = world.visitors.filter(
    (visitor) =>
      CROWD_STATES.has(visitor.state) &&
      inAudioRange(visitor.x, visitor.z, listener),
  )
  for (const cluster of clusterPoints(crowd)) {
    if (cluster.count < AUDIO.crowdMinCluster) continue
    push('crowdPath', `crowd:${cluster.key}`, cluster.x, cluster.z, Math.min(1, cluster.count / 18))
  }

  const campCells = (world.campingCells ?? []).filter((cell) =>
    inAudioRange(cell.x, cell.z, listener, AUDIO.maxDistance * 1.25),
  )
  const campVisitors = world.visitors.filter(
    (visitor) =>
      (visitor.state === 'camping' || visitor.state === 'sleeping') &&
      inAudioRange(visitor.x, visitor.z, listener),
  )
  for (const cluster of clusterPoints([
    ...campCells.map((cell) => ({ x: cell.x + 0.5, z: cell.z + 0.5 })),
    ...campVisitors.map((visitor) => ({ x: visitor.x, z: visitor.z })),
  ])) {
    if (cluster.count < 2) continue
    push('camp', `camp:${cluster.key}`, cluster.x, cluster.z, Math.min(0.8, 0.25 + cluster.count * 0.06))
  }

  const backstage = (world.backstageCells ?? []).filter((cell) =>
    inAudioRange(cell.x, cell.z, listener, AUDIO.maxDistance * 1.25),
  )
  for (const cluster of clusterPoints(backstage.map((cell) => ({ x: cell.x + 0.5, z: cell.z + 0.5 })))) {
    push('backstage', `backstage:${cluster.key}`, cluster.x, cluster.z, 0.4)
  }

  for (const cluster of nearbyWaterClusters(world, listener)) {
    push('water', `water:${cluster.key}`, cluster.x, cluster.z, 0.5)
  }

  const emittersFromZones: AudioEmitter[] = []
  for (const [zone, points] of zonePoints) {
    for (const cluster of clusterPoints(points, AUDIO.clusterSize)) {
      const intensity = Math.min(
        1,
        points
          .filter((point) => clusterKey(point.x, point.z) === cluster.key)
          .reduce((sum, point) => sum + point.intensity, 0) / Math.max(1, cluster.count),
      )
      emittersFromZones.push({
        id: `${zone}:${cluster.key}`,
        zone,
        x: cluster.x,
        z: cluster.z,
        priority: zone === 'concert' || zone === 'coaster' ? 'local' : 'ambient',
        intensity,
      })
    }
  }
  emitters.push(...emittersFromZones)
  return emitters
}

function cooldownTicks(kind: AudioOneShotKind): number {
  return AUDIO.cooldownTicks[kind]
}

function readyForCue(
  state: AudioPlannerState,
  key: string,
  tick: number,
  kind: AudioOneShotKind,
): boolean {
  const wait = cooldownTicks(kind)
  const last = state.lastCueTick[key]
  if (last === undefined) return true
  return tick - last >= wait
}

function markCue(state: AudioPlannerState, key: string, tick: number): void {
  state.lastCueTick[key] = tick
}

export function detectAudioCues(prev: AudioWorld | null, next: AudioWorld): AudioCue[] {
  const cues: AudioCue[] = []
  const tick = next.simTick
  const prevBuildings = new Map((prev?.buildings ?? []).map((building) => [building.id, building]))
  const nextBuildings = new Map(next.buildings.map((building) => [building.id, building]))
  for (const building of next.buildings) {
    if (prev && !prevBuildings.has(building.id)) {
      cues.push({
        id: `place:${building.id}:${tick}`,
        kind: 'placeBuilding',
        x: building.x + 0.5,
        z: building.z + 0.5,
        priority: 'local',
        intensity: 0.7,
        tick,
      })
    }
  }
  if (prev) {
    for (const building of prev.buildings) {
      if (!nextBuildings.has(building.id)) {
        cues.push({
          id: `demolish:${building.id}:${tick}`,
          kind: 'demolish',
          x: building.x + 0.5,
          z: building.z + 0.5,
          priority: 'local',
          intensity: 0.75,
          tick,
        })
      }
    }
  }

  const prevCoasters = new Map((prev?.coasters ?? []).map((coaster) => [coaster.id, coaster]))
  for (const coaster of next.coasters ?? []) {
    const before = prevCoasters.get(coaster.id)
    if (before && before.train.state === 'boarding' && coaster.train.state === 'running') {
      cues.push({
        id: `launch:${coaster.id}:${tick}`,
        kind: 'coasterLaunch',
        x: coaster.train.x,
        z: coaster.train.z,
        priority: 'important',
        intensity: 1,
        tick,
      })
    }
    if (
      coaster.train.state === 'running' &&
      coaster.train.passengers > 0 &&
      coaster.train.speed >= AUDIO.screamSpeed
    ) {
      cues.push({
        id: `scream:${coaster.id}:${tick}`,
        kind: 'scream',
        x: coaster.train.x,
        z: coaster.train.z,
        priority: 'important',
        intensity: Math.min(1, 0.45 + coaster.train.speed / 40),
        tick,
      })
    }
  }

  const prevIncidents = new Set((prev?.incidents ?? []).map((incident) => incident.id))
  for (const incident of next.incidents ?? []) {
    if (prev && !prevIncidents.has(incident.id)) {
      cues.push({
        id: `incident:${incident.id}:${tick}`,
        kind: 'incident',
        x: incident.x + 0.5,
        z: incident.z + 0.5,
        priority: 'important',
        intensity: incident.kind === 'fire' ? 1 : 0.65,
        tick,
      })
    }
  }

  const prevVisitors = new Map((prev?.visitors ?? []).map((visitor) => [visitor.id, visitor]))
  for (const visitor of next.visitors) {
    const before = prevVisitors.get(visitor.id)
    if (MEDICAL_STATES.has(visitor.state) && (!before || !MEDICAL_STATES.has(before.state))) {
      cues.push({
        id: `medical:${visitor.id}:${tick}`,
        kind: 'medical',
        x: visitor.x,
        z: visitor.z,
        priority: 'important',
        intensity: 0.9,
        tick,
      })
    }
  }

  const prevVehicles = new Map((prev?.vehicles ?? []).map((vehicle) => [vehicle.id, vehicle]))
  for (const vehicle of next.vehicles ?? []) {
    const before = prevVehicles.get(vehicle.id)
    const started =
      before &&
      (before.state === 'idle' || before.state === 'at-stop' || before.state === 'parked') &&
      (vehicle.state === 'driving' || vehicle.state === 'responding')
    if (!started) continue
    if (vehicle.kind === 'bus' || vehicle.kind === 'tourBus') {
      cues.push({
        id: `bus:${vehicle.id}:${tick}`,
        kind: 'busHiss',
        x: vehicle.x,
        z: vehicle.z,
        priority: 'local',
        intensity: 0.7,
        tick,
      })
    }
    if (vehicle.kind === 'garbageTruck') {
      cues.push({
        id: `waste:${vehicle.id}:${tick}`,
        kind: 'wasteTruck',
        x: vehicle.x,
        z: vehicle.z,
        priority: 'local',
        intensity: 0.7,
        tick,
      })
    }
    if (vehicle.kind === 'ambulance' && vehicle.state === 'responding') {
      cues.push({
        id: `ambulance:${vehicle.id}:${tick}`,
        kind: 'medical',
        x: vehicle.x,
        z: vehicle.z,
        priority: 'important',
        intensity: 0.95,
        tick,
      })
    }
  }

  const cheering = next.visitors.filter(
    (visitor) =>
      visitor.emotion === 'excited' ||
      CHEER_STATES.has(visitor.state) ||
      Boolean(visitor.concertId),
  )
  for (const cluster of clusterPoints(cheering)) {
    if (cluster.count < AUDIO.cheerMinCluster) continue
    cues.push({
      id: `cheer:${cluster.key}:${tick}`,
      kind: 'cheer',
      x: cluster.x,
      z: cluster.z,
      priority: 'local',
      intensity: Math.min(1, cluster.count / 20),
      tick,
    })
  }

  return cues
}

export function planFestivalAudio(
  world: AudioWorld,
  listener: AudioListenerPose,
  state: AudioPlannerState,
): { plan: AudioPlan; state: AudioPlannerState } {
  const nextState: AudioPlannerState = {
    lastTick: world.simTick,
    lastWorld: world,
    lastCueTick: { ...state.lastCueTick },
  }
  const ambients = selectByVoiceBudget(
    collectAmbientEmitters(world, listener),
    listener,
    AUDIO.maxAmbientVoices,
  )
  const rawCues =
    state.lastWorld && state.lastTick === world.simTick
      ? []
      : detectAudioCues(state.lastWorld, world)
  const accepted: AudioCue[] = []
  for (const cue of rawCues) {
    const key = cue.kind === 'cheer' || cue.kind === 'scream'
      ? `${cue.kind}:${clusterKey(cue.x, cue.z)}`
      : cue.kind === 'placeBuilding' || cue.kind === 'demolish'
        ? cue.id
        : cue.kind
    if (!readyForCue(nextState, key, world.simTick, cue.kind)) continue
    accepted.push(cue)
    markCue(nextState, key, world.simTick)
  }
  const oneShots = selectByVoiceBudget(accepted, listener, AUDIO.maxOneShotVoices)
  return { plan: { ambients, oneShots }, state: nextState }
}

export function performingStageIdsFromFestival(source: {
  day?: number
  minute?: number
  festival?: {
    enabled?: boolean
    finished?: boolean
    bookings?: readonly { day: number; start: number; duration: number; stageId: string }[]
  }
}): string[] {
  const festival = source.festival
  if (!festival?.enabled || festival.finished) return []
  const day = source.day ?? 0
  const minute = source.minute ?? 0
  return (festival.bookings ?? [])
    .filter((booking) => booking.day === day && minute >= booking.start && minute < booking.start + booking.duration)
    .map((booking) => booking.stageId)
}

export function audioWorldFromSnapshot(snapshot: {
  simTick: number
  waterLevel?: number
  day?: number
  minute?: number
  buildings: readonly AudioWorldBuilding[]
  visitors: readonly AudioWorldVisitor[]
  campingCells?: readonly { x: number; z: number }[]
  backstageCells?: readonly { x: number; z: number }[]
  incidents?: readonly { id: string; kind: string; x: number; z: number }[]
  coasters?: readonly AudioWorldCoaster[]
  logistics?: { roadVehicles?: readonly { id: string; kind: string; state: string; position: { x: number; z: number } }[] }
  festival?: {
    enabled?: boolean
    finished?: boolean
    bookings?: readonly { day: number; start: number; duration: number; stageId: string }[]
  }
  terrain?: TerrainSnapshot
  scenario?: { worldSize?: number }
}): AudioWorld {
  return {
    simTick: snapshot.simTick,
    buildings: snapshot.buildings,
    visitors: snapshot.visitors,
    campingCells: snapshot.campingCells,
    backstageCells: snapshot.backstageCells,
    incidents: snapshot.incidents,
    coasters: snapshot.coasters,
    vehicles: (snapshot.logistics?.roadVehicles ?? []).map((vehicle) => ({
      id: vehicle.id,
      kind: vehicle.kind,
      state: vehicle.state,
      x: vehicle.position.x,
      z: vehicle.position.z,
    })),
    performingStageIds: performingStageIdsFromFestival(snapshot),
    terrain: snapshot.terrain,
    waterLevel: snapshot.waterLevel,
    worldSize: snapshot.scenario?.worldSize,
  }
}
