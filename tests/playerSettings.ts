import assert from 'node:assert/strict'
import {
  DEFAULT_PLAYER_SETTINGS,
  PLAYER_SETTINGS_KEY,
  normalizePlayerSettings,
  readPlayerSettings,
  writePlayerSettings,
} from '../src/app/playerSettings'
import { effectCount, setEffectShare } from '../src/view/effectDensity'
import { scenePixelRatio } from '../src/view/renderResolution'

/** Device settings (C6): stored values are repaired, levels scale the render budget. */
export function testPlayerSettings(): void {
  // Anything stored comes back complete and in range; unknown values fall back.
  assert.deepEqual(normalizePlayerSettings(null), DEFAULT_PLAYER_SETTINGS)
  assert.equal(DEFAULT_PLAYER_SETTINGS.language, 'auto', 'the language follows the browser until the player picks one')
  assert.equal(normalizePlayerSettings({ language: 'en' }).language, 'en')
  assert.equal(normalizePlayerSettings({ language: 'fr' }).language, 'auto')
  const repaired = normalizePlayerSettings({ shadows: 'ultra', resolution: 'high', effects: 'low', uiScale: 1.27, volume: { master: 3, music: -1, effects: 'loud' } })
  assert.equal(repaired.shadows, DEFAULT_PLAYER_SETTINGS.shadows)
  assert.equal(repaired.resolution, 'high')
  assert.equal(repaired.effects, 'low')
  assert.equal(repaired.uiScale, 1.3, 'the interface size snaps to an offered step')
  assert.deepEqual(repaired.volume, { master: 1, music: 0, effects: DEFAULT_PLAYER_SETTINGS.volume.effects, ambient: DEFAULT_PLAYER_SETTINGS.volume.ambient })

  const stored = new Map<string, string>()
  const storage = { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => void stored.set(key, value) }
  writePlayerSettings({ ...DEFAULT_PLAYER_SETTINGS, shadows: 'off', uiScale: 1.2 }, storage)
  assert.equal(readPlayerSettings(storage).shadows, 'off')
  assert.equal(readPlayerSettings(storage).uiScale, 1.2)
  stored.set(PLAYER_SETTINGS_KEY, '{broken')
  assert.deepEqual(readPlayerSettings(storage), DEFAULT_PLAYER_SETTINGS, 'a broken entry reads as the defaults')

  // The resolution level scales the logical pixel canvas and never exceeds the display.
  assert.equal(scenePixelRatio(1920, 1080, 1), 0.75)
  assert.equal(scenePixelRatio(1920, 1080, 0.75), 0.5625)
  assert.equal(scenePixelRatio(1920, 1080, 1.5), 1.125)
  assert.equal(scenePixelRatio(1920, 1080, 1.5, 1), 1, 'no more pixels than the display has')

  // A lower density keeps at least the minimum of every effect.
  setEffectShare(1 / 3)
  assert.equal(effectCount(24, 6), 8)
  assert.equal(effectCount(4), 1)
  setEffectShare(1)
  assert.equal(effectCount(24, 6), 24)
  console.log('PASS player settings: repaired storage, resolution levels, effect density')
}
