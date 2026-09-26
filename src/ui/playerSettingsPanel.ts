import {
  EFFECT_SHARE,
  RESOLUTION_SCALE,
  SHADOW_MAP_SIZE,
  VOLUME_CHANNELS,
  normalizePlayerSettings,
  readPlayerSettings,
  writePlayerSettings,
  type PlayerSettings,
} from '../app/playerSettings'
import { setUiScale } from './uiScale'

type Targets = {
  view: { setGraphics(settings: { shadowMapSize: number; resolutionScale: number; effectShare: number }): void }
  audio: { setVolumes(volume: PlayerSettings['volume']): void }
  /** Re-measures whatever the layout derives from on-screen sizes. */
  onUiScale?: () => void
}

function field<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`#${id} fehlt`)
  return element as T
}

/**
 * Wires the graphics, interface and mixer controls of the settings window. Values are
 * applied as they change and stored per device; the save and the other players never
 * see them.
 */
export function installPlayerSettings(targets: Targets): PlayerSettings {
  let settings = readPlayerSettings()
  const shadows = field<HTMLSelectElement>('setting-shadows')
  const resolution = field<HTMLSelectElement>('setting-resolution')
  const effects = field<HTMLSelectElement>('setting-effects')
  const uiScale = field<HTMLSelectElement>('setting-ui-scale')
  const volumes = VOLUME_CHANNELS.map((channel) => ({
    channel: channel.value,
    input: field<HTMLInputElement>(`setting-volume-${channel.value}`),
    output: field<HTMLOutputElement>(`setting-volume-${channel.value}-value`),
  }))

  const apply = (next: PlayerSettings, first = false): void => {
    const scaleChanged = first || next.uiScale !== settings.uiScale
    settings = next
    targets.view.setGraphics({
      shadowMapSize: SHADOW_MAP_SIZE[next.shadows],
      resolutionScale: RESOLUTION_SCALE[next.resolution],
      effectShare: EFFECT_SHARE[next.effects],
    })
    targets.audio.setVolumes(next.volume)
    setUiScale(next.uiScale)
    if (scaleChanged) targets.onUiScale?.()
    shadows.value = next.shadows
    resolution.value = next.resolution
    effects.value = next.effects
    uiScale.value = String(next.uiScale)
    for (const { channel, input, output } of volumes) {
      const percent = Math.round(next.volume[channel] * 100)
      input.value = String(percent)
      output.textContent = `${percent} %`
    }
  }
  const change = (patch: Partial<PlayerSettings>): void => {
    const next = normalizePlayerSettings({ ...settings, ...patch })
    apply(next)
    writePlayerSettings(next)
  }

  shadows.addEventListener('change', () => change({ shadows: shadows.value as PlayerSettings['shadows'] }))
  resolution.addEventListener('change', () => change({ resolution: resolution.value as PlayerSettings['resolution'] }))
  effects.addEventListener('change', () => change({ effects: effects.value as PlayerSettings['effects'] }))
  uiScale.addEventListener('change', () => change({ uiScale: Number(uiScale.value) }))
  for (const { channel, input } of volumes) {
    input.addEventListener('input', () => change({ volume: { ...settings.volume, [channel]: Number(input.value) / 100 } }))
  }
  apply(settings, true)
  return settings
}
