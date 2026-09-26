/**
 * What the player sets for this device: graphics, interface size and volume. Kept in
 * localStorage next to the other device settings, never in the save and never sent to
 * other players; none of it may change what the simulation decides.
 */
export type ShadowQuality = 'off' | 'normal' | 'high'
export type ResolutionLevel = 'low' | 'standard' | 'high'
export type EffectDensity = 'low' | 'medium' | 'high'
export type VolumeChannel = 'master' | 'music' | 'effects' | 'ambient'

export type PlayerSettings = {
  shadows: ShadowQuality
  resolution: ResolutionLevel
  effects: EffectDensity
  /** Interface size as a factor, 0.9 to 1.3. */
  uiScale: number
  /** 0 to 1 per mixer channel. */
  volume: Record<VolumeChannel, number>
}

export const PLAYER_SETTINGS_KEY = 'festival-player-settings'

export const SHADOW_OPTIONS: readonly { value: ShadowQuality; label: string }[] = [
  { value: 'off', label: 'Aus' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Hoch' },
]
export const RESOLUTION_OPTIONS: readonly { value: ResolutionLevel; label: string }[] = [
  { value: 'low', label: 'Niedrig' },
  { value: 'standard', label: 'Standard' },
  { value: 'high', label: 'Hoch' },
]
export const EFFECT_OPTIONS: readonly { value: EffectDensity; label: string }[] = [
  { value: 'low', label: 'Niedrig' },
  { value: 'medium', label: 'Mittel' },
  { value: 'high', label: 'Hoch' },
]
export const UI_SCALE_OPTIONS = [0.9, 1, 1.1, 1.2, 1.3] as const
export const VOLUME_CHANNELS: readonly { value: VolumeChannel; label: string }[] = [
  { value: 'master', label: 'Gesamt' },
  { value: 'music', label: 'Musik' },
  { value: 'effects', label: 'Effekte' },
  { value: 'ambient', label: 'Umgebung' },
]

/** Shadow map edge in texels per quality; 0 means the sun casts none. */
export const SHADOW_MAP_SIZE: Record<ShadowQuality, number> = { off: 0, normal: 1024, high: 2048 }
/** Scales the logical pixel canvas of `scenePixelRatio`. */
export const RESOLUTION_SCALE: Record<ResolutionLevel, number> = { low: 0.75, standard: 1, high: 1.5 }
/** Share of particles, beams and rings drawn per effect. */
export const EFFECT_SHARE: Record<EffectDensity, number> = { low: 1 / 3, medium: 0.5, high: 1 }

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  shadows: 'normal',
  resolution: 'standard',
  effects: 'high',
  uiScale: 1,
  volume: { master: 0.8, music: 0.7, effects: 0.8, ambient: 0.6 },
}

function pick<T extends string>(value: unknown, options: readonly { value: T }[], fallback: T): T {
  return options.some((option) => option.value === value) ? value as T : fallback
}

function unit(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback
}

/** Whatever was stored, a complete and valid settings object comes back. */
export function normalizePlayerSettings(raw: unknown): PlayerSettings {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof PlayerSettings, unknown>>
  const volume = (source.volume && typeof source.volume === 'object' ? source.volume : {}) as Partial<Record<VolumeChannel, unknown>>
  const defaults = DEFAULT_PLAYER_SETTINGS
  const scale = typeof source.uiScale === 'number' ? source.uiScale : defaults.uiScale
  return {
    shadows: pick(source.shadows, SHADOW_OPTIONS, defaults.shadows),
    resolution: pick(source.resolution, RESOLUTION_OPTIONS, defaults.resolution),
    effects: pick(source.effects, EFFECT_OPTIONS, defaults.effects),
    uiScale: UI_SCALE_OPTIONS.reduce((best, option) => Math.abs(option - scale) < Math.abs(best - scale) ? option : best, 1),
    volume: {
      master: unit(volume.master, defaults.volume.master),
      music: unit(volume.music, defaults.volume.music),
      effects: unit(volume.effects, defaults.volume.effects),
      ambient: unit(volume.ambient, defaults.volume.ambient),
    },
  }
}

export function readPlayerSettings(storage: Pick<Storage, 'getItem'> | null = globalThis.localStorage ?? null): PlayerSettings {
  try {
    const stored = storage?.getItem(PLAYER_SETTINGS_KEY)
    return normalizePlayerSettings(stored ? JSON.parse(stored) : null)
  } catch {
    return normalizePlayerSettings(null)
  }
}

export function writePlayerSettings(settings: PlayerSettings, storage: Pick<Storage, 'setItem'> | null = globalThis.localStorage ?? null): void {
  try {
    storage?.setItem(PLAYER_SETTINGS_KEY, JSON.stringify(settings))
  } catch { /* private mode: the settings last until the page closes */ }
}
