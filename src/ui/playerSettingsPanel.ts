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
import { formatPercent, getLocale, t } from '../i18n'
import { normalizeLanguageSetting, readLanguageSetting, resolveLocale, type LanguageSetting } from '../i18n/locale'
import type { MultiplayerStatus } from '../net/session'
import { confirmAction } from './confirmDialog'
import { setUiScale } from './uiScale'
import { hasUnsavedWork, suppressBeforeUnloadOnce } from './unsavedWork'

type Targets = {
  view: { setGraphics(settings: { shadowMapSize: number; resolutionScale: number; effectShare: number }): void }
  audio: { setVolumes(volume: PlayerSettings['volume']): void }
  /** Re-measures whatever the layout derives from on-screen sizes. */
  onUiScale?: () => void
  /** True while this device sits in a multiplayer room, as host or as guest (isInMultiplayerRoom). */
  inRoom?: () => boolean
  /** Reloads the page for a new language; replaceable for tests. */
  reload?: () => void
}

export type PlayerSettingsController = {
  settings(): PlayerSettings
  /** Re-checks the pending language switch, e.g. after joining or leaving a room. */
  refreshLanguage(): void
}

/** What changing the language does right now. */
export type LanguageChangePlan = 'defer' | 'confirm' | 'reload'

/**
 * The language is fixed for a page load, so a change means a reload. In a multiplayer
 * room it only takes effect at the next start: a host reload would leave the room in
 * host-away mode and a guest reload would leave it silently. With unsaved work the
 * player is asked first — even with unsaved warnings off, because a reload from a
 * select would be a surprise.
 */
export function planLanguageChange(state: { inRoom: boolean; unsavedWork: boolean }): LanguageChangePlan {
  if (state.inRoom) return 'defer'
  return state.unsavedWork ? 'confirm' : 'reload'
}

/**
 * Whether this device sits in a multiplayer room. A dropped socket that is dialling
 * back keeps its mode and only loses `connected`; it is still in the room, and a
 * reload would drop a guest silently or leave the room in host-away mode.
 */
export function isInMultiplayerRoom(status: Pick<MultiplayerStatus, 'mode' | 'connected'>): boolean {
  return status.mode !== 'solo' || status.connected
}

/** Everything the language switch touches, so the flow can be tested without a page. */
export type LanguageSwitchPorts = {
  /** Writes the setting; false when the next page load would not read it back. */
  store(next: LanguageSetting): boolean
  inRoom(): boolean
  unsavedWork(): boolean
  /** Whether a setting loads another locale than the one this page runs in. */
  differsFromPage(setting: LanguageSetting): boolean
  confirm(): Promise<boolean>
  suppressUnloadPrompt(): void
  reload(): void
}

/** `saved`: stored for the next start; `failed`: storage refused it and nothing else happened. */
export type LanguageSwitchOutcome = 'saved' | 'reloading' | 'cancelled' | 'failed'

/**
 * The switch in the order docs/i18n.md fixes: decide, confirm when work would be lost,
 * write, check the write, silence the browser's own leave prompt, reload. A write the
 * storage refused never reloads: the page would come back in the old language and the
 * confirmed loss of work would buy nothing.
 */
export async function switchLanguage(next: LanguageSetting, ports: LanguageSwitchPorts): Promise<LanguageSwitchOutcome> {
  const plan = ports.differsFromPage(next) ? planLanguageChange({ inRoom: ports.inRoom(), unsavedWork: ports.unsavedWork() }) : 'defer'
  if (plan === 'confirm' && !(await ports.confirm())) return 'cancelled'
  if (!ports.store(next)) return 'failed'
  if (plan === 'defer') return 'saved'
  ports.suppressUnloadPrompt()
  ports.reload()
  return 'reloading'
}

function field<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(t`#${id} fehlt`)
  return element as T
}

function browserLanguages(): readonly string[] {
  return typeof navigator === 'undefined' ? [] : navigator.languages ?? []
}

/** The locale a setting would load, compared with the one this page runs in. */
function needsReload(setting: LanguageSetting): boolean {
  return resolveLocale(setting, browserLanguages()) !== getLocale()
}

/**
 * Wires the language, graphics, interface and mixer controls of the settings window.
 * Values are applied as they change and stored per device; the save and the other
 * players never see them.
 */
export function installPlayerSettings(targets: Targets): PlayerSettingsController {
  let settings = readPlayerSettings()
  const shadows = field<HTMLSelectElement>('setting-shadows')
  const resolution = field<HTMLSelectElement>('setting-resolution')
  const effects = field<HTMLSelectElement>('setting-effects')
  const uiScale = field<HTMLSelectElement>('setting-ui-scale')
  const language = field<HTMLSelectElement>('setting-language')
  const languageNote = field<HTMLElement>('setting-language-note')
  const languageReload = field<HTMLButtonElement>('setting-language-reload')
  const inRoom = targets.inRoom ?? (() => false)
  const reload = targets.reload ?? (() => window.location.reload())
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
    language.value = next.language
    shadows.value = next.shadows
    resolution.value = next.resolution
    effects.value = next.effects
    uiScale.value = String(next.uiScale)
    for (const { channel, input, output } of volumes) {
      const percent = Math.round(next.volume[channel] * 100)
      input.value = String(percent)
      output.textContent = formatPercent(percent)
    }
  }
  const change = (patch: Partial<PlayerSettings>): void => {
    const next = normalizePlayerSettings({ ...settings, ...patch })
    apply(next)
    writePlayerSettings(next)
  }

  // A stored language that this page does not show yet: say so, and offer the reload
  // once the device is out of any multiplayer room. A refused write says that instead.
  let storeFailed = false
  const refreshLanguage = (): void => {
    const pending = needsReload(settings.language)
    languageNote.hidden = !pending && !storeFailed
    languageNote.textContent = storeFailed
      ? t('Die Sprache ließ sich auf diesem Gerät nicht speichern.')
      : pending ? t('Gilt ab dem nächsten Start.') : ''
    languageReload.hidden = !pending
    languageReload.disabled = inRoom()
  }
  const ports: LanguageSwitchPorts = {
    store: (next) => {
      change({ language: next })
      const persisted = readLanguageSetting()
      if (persisted === next) return true
      // Keep what the next page load will actually see.
      settings = { ...settings, language: persisted }
      return false
    },
    inRoom,
    unsavedWork: hasUnsavedWork,
    differsFromPage: needsReload,
    confirm: () => confirmAction({
      title: t('Sprache wechseln?'),
      message: t('Das Spiel lädt dafür neu. Nicht gespeicherte Änderungen gehen dabei verloren.'),
      confirmLabel: t('Neu laden'),
      cancelLabel: t('Abbrechen'),
    }),
    suppressUnloadPrompt: suppressBeforeUnloadOnce,
    reload,
  }
  const chooseLanguage = async (next: LanguageSetting): Promise<void> => {
    const outcome = await switchLanguage(next, ports)
    if (outcome === 'reloading') return
    storeFailed = outcome === 'failed'
    language.value = settings.language
    refreshLanguage()
  }

  language.addEventListener('change', () => void chooseLanguage(normalizeLanguageSetting(language.value)))
  languageReload.addEventListener('click', () => void chooseLanguage(settings.language))
  shadows.addEventListener('change', () => change({ shadows: shadows.value as PlayerSettings['shadows'] }))
  resolution.addEventListener('change', () => change({ resolution: resolution.value as PlayerSettings['resolution'] }))
  effects.addEventListener('change', () => change({ effects: effects.value as PlayerSettings['effects'] }))
  uiScale.addEventListener('change', () => change({ uiScale: Number(uiScale.value) }))
  for (const { channel, input } of volumes) {
    input.addEventListener('input', () => change({ volume: { ...settings.volume, [channel]: Number(input.value) / 100 } }))
  }
  apply(settings, true)
  refreshLanguage()
  return { settings: () => settings, refreshLanguage }
}
