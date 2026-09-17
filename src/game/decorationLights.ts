import type { BuildingKind } from './catalog'
import { decorationKindsInCategory } from './decoration'

/** Emitter style for a Deko → Licht piece. Colors match the mesh glow, not the catalog icon. */
export type DecorationLightShape = 'point' | 'spot'

export type DecorationLightSpec = {
  color: number
  /** World Y of the emitter above `building.elevation`, aligned with the mesh. */
  height: number
  distance: number
  decay: number
  dayIntensity: number
  nightBoost: number
  glowRadius: number
  bulbRadius: number
  shape: DecorationLightShape
  /** Prefer this source when assigning the nearby light pool (< 1 is closer). */
  focusWeight?: number
  needsPower?: boolean
  /** Flatten the instanced bulb (daylight balloon). */
  flatBulb?: boolean
  /** Offset the emitter along the building facing (floods). */
  forward?: number
}

const WARM = {
  color: 0xffca82,
  distance: 3.5,
  decay: 1.6,
  dayIntensity: 0.45,
  nightBoost: 2.35,
  glowRadius: 3.2,
  bulbRadius: 0.055,
  shape: 'point' as const,
}

/**
 * Every catalog kind in Deko → Licht. Trees, fences and other props stay dark
 * unless they already have a dedicated glow (shops / tents live in FestivalLightsView).
 */
export const DECORATION_LIGHTS = {
  lighting: {
    ...WARM,
    height: 1.46,
    needsPower: true,
  },
  lightBalloon: {
    color: 0xf4f8ff,
    height: 2.4,
    distance: 9,
    decay: 1.15,
    dayIntensity: 0.85,
    nightBoost: 3.2,
    glowRadius: 8.2,
    bulbRadius: 0.16,
    shape: 'point',
    needsPower: true,
    focusWeight: 0.4,
    flatBulb: true,
  },
  lanternPole: { ...WARM, color: 0xffd58a, height: 1.1 },
  stringLights: { ...WARM, color: 0xffe2a1, height: 1.23 },
  dustLantern: { ...WARM, color: 0xffd58a, height: 0.88, distance: 3.2 },
  foxfireLamp: {
    color: 0x7ec8c4,
    height: 0.86,
    distance: 3.4,
    decay: 1.5,
    dayIntensity: 0.32,
    nightBoost: 2.55,
    glowRadius: 3.0,
    bulbRadius: 0.07,
    shape: 'point',
  },
  discoBall: {
    color: 0xc8d4ee,
    height: 1.18,
    distance: 3.6,
    decay: 1.45,
    dayIntensity: 0.38,
    nightBoost: 2.6,
    glowRadius: 3.4,
    bulbRadius: 0.08,
    shape: 'point',
  },
  workLamp: {
    color: 0xffb347,
    height: 0.52,
    distance: 4.2,
    decay: 1.35,
    dayIntensity: 0.55,
    nightBoost: 2.1,
    glowRadius: 2.1,
    bulbRadius: 0.06,
    shape: 'spot',
    forward: 0.1,
  },
  tikiTorch: {
    color: 0xff6a28,
    height: 1.12,
    distance: 2.8,
    decay: 1.7,
    dayIntensity: 0.4,
    nightBoost: 2.2,
    glowRadius: 2.4,
    bulbRadius: 0.05,
    shape: 'point',
  },
  spiritLantern: {
    color: 0xc8a0e8,
    height: 1.02,
    distance: 3.3,
    decay: 1.55,
    dayIntensity: 0.34,
    nightBoost: 2.45,
    glowRadius: 3.0,
    bulbRadius: 0.06,
    shape: 'point',
  },
  carnivalBulbs: {
    color: 0xff9a4a,
    height: 1.18,
    distance: 3.2,
    decay: 1.6,
    dayIntensity: 0.42,
    nightBoost: 2.3,
    glowRadius: 3.0,
    bulbRadius: 0.05,
    shape: 'point',
  },
  beerLantern: { ...WARM, color: 0xffd58a, height: 0.98 },
  auroraLamp: {
    color: 0x5ee0b0,
    height: 1.16,
    distance: 3.8,
    decay: 1.4,
    dayIntensity: 0.36,
    nightBoost: 2.7,
    glowRadius: 3.5,
    bulbRadius: 0.07,
    shape: 'point',
  },
  gasLamp: { ...WARM, color: 0xffcc70, height: 1.22, distance: 3.4 },
} as const satisfies Record<string, DecorationLightSpec>

export type DecorationLampKind = keyof typeof DECORATION_LIGHTS

export function decorationLampKinds(): BuildingKind[] {
  return decorationKindsInCategory('lights')
}

export function decorationLightOf(kind: string): DecorationLightSpec | undefined {
  return DECORATION_LIGHTS[kind as DecorationLampKind]
}

export function isDecorationLampKind(kind: string): kind is DecorationLampKind {
  return kind in DECORATION_LIGHTS
}
