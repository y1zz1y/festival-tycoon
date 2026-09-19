import { rankByView, type LightView } from './lightSelection'
import { AdditiveBlending, Color, DataTexture, Group, InstancedMesh, LinearFilter, MeshBasicMaterial, PlaneGeometry, SphereGeometry, Matrix4, PointLight, SpotLight, Vector3 } from 'three'
import type { GameSnapshot } from '../game/GameState'
import { isFestivalOfferActive } from '../game/dayPlan'
import { decorationLightOf, type DecorationLightSpec } from '../game/decorationLights'
import { getTerrainHeight } from '../game/terrain'
import { sceneryTransform } from '../game/scenery'

export function nightStrength(minute: number): number {
  const hour = ((minute / 60) % 24 + 24) % 24
  return hour < 5 || hour >= 22 ? 1 : hour < 8 ? (8 - hour) / 3 : hour >= 19 ? (hour - 19) / 3 : 0
}

export const FESTIVAL_LIGHT_BUDGET = 12
export const FESTIVAL_SPOT_LIGHT_BUDGET = 6
export const WARM_LIGHT_COLOR = 0xffca82
export const DAYLIGHT_LIGHT_COLOR = 0xf4f8ff
export const WARM_LIGHT_DISTANCE = 3.5
export const DAYLIGHT_LIGHT_DISTANCE = 9

const WARM_SPEC: DecorationLightSpec = {
  color: WARM_LIGHT_COLOR,
  height: 0,
  distance: WARM_LIGHT_DISTANCE,
  decay: 1.6,
  dayIntensity: 0.45,
  nightBoost: 2.35,
  glowRadius: 3.2,
  bulbRadius: 0.055,
  shape: 'point',
}

type LightSource = {
  position: Vector3
  ground: number
  kind: string
  spec: DecorationLightSpec
  rotation: number
}

function glowTexture(): DataTexture {
  const size = 32, data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1)
    const i = (y * size + x) * 4
    data[i] = data[i + 1] = data[i + 2] = 255
    data[i + 3] = Math.round(Math.max(0, 1 - radius) ** 2 * 255)
  }
  const texture = new DataTexture(data, size, size)
  texture.magFilter = texture.minFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}

function sourceIntensity(source: LightSource, night: number): number {
  return source.spec.dayIntensity + night * source.spec.nightBoost
}

function focusDistance(source: LightSource, focus: Vector3): number {
  const raw = (source.position.x - focus.x) ** 2 + (source.position.z - focus.z) ** 2
  return raw * (source.spec.focusWeight ?? 1)
}

/** Every source keeps a bulb and soft glow instance; a fixed local-light budget
 * illuminates nearby objects without recompiling shaders when sources change. */
export class FestivalLightsView {
  readonly group = new Group()
  private cursor = new PointLight(0xc2d6ef, 0, 7, 1.6)
  private pool: PointLight[] = []
  private spots: SpotLight[] = []
  private bulbs: InstancedMesh | null = null
  private glows: InstancedMesh | null = null
  private glowGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
  private glowMaterial = new MeshBasicMaterial({ color: 0xffffff, map: glowTexture(), transparent: true, blending: AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
  private sources: LightSource[] = []
  private focus = new Vector3()
  private view: LightView | null = null
  private viewApplied = false
  private geometry = new SphereGeometry(1, 6, 4)
  private material = new MeshBasicMaterial({ color: 0xffffff })
  private scratchColor = new Color()
  private night = 0
  constructor() {
    this.group.add(this.cursor); this.cursor.castShadow = false
    // Keep these lights attached even when off. Light count is part of Three's
    // shader cache key; growing/shrinking it can block rendering for seconds.
    for (let i = 0; i < FESTIVAL_LIGHT_BUDGET; i++) {
      const light = new PointLight(WARM_LIGHT_COLOR, 0, WARM_LIGHT_DISTANCE, 1.6)
      light.castShadow = false; this.pool.push(light); this.group.add(light)
    }
    for (let i = 0; i < FESTIVAL_SPOT_LIGHT_BUDGET; i++) {
      const light = new SpotLight(WARM_LIGHT_COLOR, 0, 4.2, 0.62, 0.45, 1.35)
      light.castShadow = false
      this.spots.push(light)
      this.group.add(light)
      this.group.add(light.target)
    }
  }
  get activeSourceCount(): number { return this.sources.length }
  activeSourceColors(): number[] { return this.sources.map(source => source.spec.color) }
  activeSourceKinds(): string[] { return this.sources.map(source => source.kind) }
  update(s: Readonly<GameSnapshot>): void {
    this.night = nightStrength(s.minute)
    const sources: LightSource[] = []
    const powered = new Set(s.power.poweredBuildingIds)
    const lightsActive = isFestivalOfferActive(s.dayPlan, 'lights', s.minute, s.day)
    const push = (position: Vector3, ground: number, kind: string, spec: DecorationLightSpec, rotation = 0): void => {
      sources.push({ position, ground, kind, spec, rotation })
    }
    for (const b of s.buildings) {
      const spec = decorationLightOf(b.kind)
      if (spec) {
        if (!lightsActive) continue
        if (spec.needsPower && !powered.has(b.id)) continue
        const t = sceneryTransform(b)
        const angle = t.rotation * Math.PI / 2
        const forward = spec.forward ?? 0
        push(
          new Vector3(
            b.x + t.x + Math.sin(angle) * forward,
            b.elevation + spec.height,
            b.z + t.z + Math.cos(angle) * forward,
          ),
          b.elevation,
          b.kind,
          spec,
          t.rotation,
        )
        continue
      }
      if (b.kind === 'food' || b.kind === 'alcohol' || b.kind === 'toilet' || b.kind === 'mascot' || b.kind === 'shirt') {
        if (!powered.has(b.id) || !isFestivalOfferActive(s.dayPlan, b.kind === 'toilet' ? 'toilets' : b.kind === 'food' ? 'food' : b.kind === 'alcohol' ? 'drinks' : 'shops', s.minute, s.day)) continue
        const a = b.rotation * Math.PI / 2
        const ground = b.elevation
        const y = b.elevation + (b.kind === 'toilet' ? 1 : .69)
        const radius = y - ground < .5 ? 1.2 : 3.2
        push(
          new Vector3(b.x + .5 + Math.sin(a) * .38, y, b.z + .5 + Math.cos(a) * .38),
          ground,
          b.kind,
          { ...WARM_SPEC, glowRadius: radius },
          b.rotation,
        )
      }
    }
    const sleeping = s.visitors.filter(v => v.campsite && v.campingPhase === 'resting')
    const lanternBlock = Math.floor((s.day * 1440 + s.minute) / 30)
    const litTents = sleeping
      .map(v => {
        let score = lanternBlock * 0x9e3779b9
        for (const character of v.id) {
          score ^= character.charCodeAt(0)
          score = Math.imul(score, 16777619)
        }
        return { v, score: score >>> 0 }
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, Math.min(24, Math.max(1, Math.ceil(sleeping.length * .12))))
    for (const { v } of litTents) {
      if (!v.campsite) continue
      const angle = ((Number(v.id.replace(/\D/g, '').slice(-2)) || 0) % 4) * Math.PI / 2
      const ground = getTerrainHeight(s.terrain, v.campsite.x, v.campsite.z)
      push(
        new Vector3(v.campsite.x + .5 + Math.sin(angle) * .38, ground + .25, v.campsite.z + .5 + Math.cos(angle) * .38),
        ground,
        'tent',
        { ...WARM_SPEC, glowRadius: 1.2 },
      )
    }
    if (!this.bulbs || this.bulbs.instanceMatrix.count < sources.length) {
      if (this.bulbs) { this.group.remove(this.bulbs); this.bulbs.dispose() }
      this.bulbs = new InstancedMesh(this.geometry, this.material, Math.max(16, sources.length)); this.bulbs.frustumCulled = false; this.group.add(this.bulbs)
      if (this.glows) { this.group.remove(this.glows); this.glows.dispose() }
      this.glows = new InstancedMesh(this.glowGeometry, this.glowMaterial, this.bulbs.instanceMatrix.count)
      this.glows.frustumCulled = false; this.group.add(this.glows)
    }
    const matrix = new Matrix4()
    sources.forEach((source, i) => {
      const radius = source.spec.bulbRadius
      const sy = radius * (source.spec.flatBulb ? .75 : .73)
      matrix.makeScale(radius, sy, radius)
      matrix.setPosition(source.position); this.bulbs!.setMatrixAt(i, matrix)
      this.bulbs!.setColorAt(i, this.scratchColor.setHex(source.spec.color))
      const glow = source.spec.glowRadius
      matrix.makeScale(glow, 1, glow); matrix.setPosition(source.position.x, source.ground + .085, source.position.z)
      this.glows!.setMatrixAt(i, matrix)
      this.glows!.setColorAt(i, this.scratchColor.setHex(source.spec.color))
    })
    this.bulbs.count = sources.length; this.bulbs.instanceMatrix.needsUpdate = true
    if (this.bulbs.instanceColor) this.bulbs.instanceColor.needsUpdate = true
    this.glows!.count = sources.length; this.glows!.instanceMatrix.needsUpdate = true
    if (this.glows!.instanceColor) this.glows!.instanceColor.needsUpdate = true
    this.glowMaterial.opacity = .06 + this.night * .22
    this.sources = sources
    this.updateLocalLights()
  }
  /** The camera's view for this frame; the real lights go to the sources inside it. */
  setView(view: LightView): void {
    const moved = this.focus.distanceToSquared(view.focus) >= .25
    this.view = view
    this.focus.copy(view.focus)
    if (moved || !this.viewApplied) this.updateLocalLights()
  }
  private updateLocalLights(): void {
    this.viewApplied = true
    // In view before out of view; inside each, the nearer the middle the sooner.
    const order = rankByView(this.sources.map((source) => source.position), this.view)
    const ranked = order.map((index) => ({ source: this.sources[index]!, index, distance: focusDistance(this.sources[index]!, this.focus) }))
    const assignedSpots = new Set<LightSource>()
    let spotIndex = 0
    for (const entry of ranked) {
      if (spotIndex >= this.spots.length) break
      if (entry.source.spec.shape !== 'spot') continue
      this.applySpot(this.spots[spotIndex]!, entry.source)
      assignedSpots.add(entry.source)
      spotIndex++
    }
    for (; spotIndex < this.spots.length; spotIndex++) {
      const light = this.spots[spotIndex]!
      light.intensity = 0
      light.color.setHex(WARM_LIGHT_COLOR)
    }
    const points = ranked.filter(entry => !assignedSpots.has(entry.source))
    this.pool.forEach((light, i) => {
      const source = points[i]?.source
      if (!source) {
        light.intensity = 0
        light.color.setHex(WARM_LIGHT_COLOR)
        light.distance = WARM_LIGHT_DISTANCE
        light.decay = 1.6
        return
      }
      light.color.setHex(source.spec.color)
      light.distance = source.spec.distance
      light.decay = source.spec.decay
      light.intensity = sourceIntensity(source, this.night)
      light.position.copy(source.position)
      light.position.y += source.spec.flatBulb ? .2 : .15
    })
  }
  private applySpot(light: SpotLight, source: LightSource): void {
    const angle = source.rotation * Math.PI / 2
    light.color.setHex(source.spec.color)
    light.distance = source.spec.distance
    light.decay = source.spec.decay
    light.intensity = sourceIntensity(source, this.night)
    light.position.copy(source.position)
    light.target.position.set(
      source.position.x + Math.sin(angle) * 1.8,
      source.position.y - 0.55,
      source.position.z + Math.cos(angle) * 1.8,
    )
  }
  updateCursor(position: Vector3 | null): void { this.cursor.intensity = position ? 0.35 + this.night * 1.85 : 0; if (position) this.cursor.position.copy(position).add(new Vector3(0, 1.5, 0)) }
}
