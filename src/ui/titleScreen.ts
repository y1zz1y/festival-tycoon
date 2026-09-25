import { currentAccount, registerAccount, signIn, signOut } from '../accounts'
import { confirmDiscardingWork, markWorkSaved } from './unsavedWork'
import { GameState } from '../game/GameState'
import { normalizeScenarioSettings } from '../game/scenario'
import type { ScenarioSettings } from '../game/scenario'
import { scenarioPreset, type ScenarioPreset } from '../game/scenarioPresets'
import { ENVIRONMENTS } from '../game/environments'
import { goalName } from '../game/scenarioGoals'
import { SIMULATION_CONFIG } from '../game/simulationConfig'
import { mountTitleCrowd } from '../titleCrowd'
import { isTextEntryTarget } from '../uiFocus'
import { fetchLobbies } from '../net/lobbies'
import type { NetLobby } from '../net/protocol'
import { escapeHtml, formatMoney } from './format'
import { saveProgressText, saveStorageNote, type SaveArchiveView, type SaveSlotView } from './saveArchive'

export interface TitleScreenContext {
  getGame(): GameState
  getMultiplayerMode(): 'solo' | 'host' | 'client'
  scenarioPanel: HTMLElement
  saveSlotsPanel: HTMLElement
  setScenarioPanelOpen(open: boolean): void
  setSaveSlotsPanelOpen(open: boolean): void
  fillScenarioForm(settings: ScenarioSettings): void
  readScenarioForm(): ScenarioSettings
  closePathEditor(): void
  isPathWindowOpen(): boolean
  hideVisitorPanel(): void
  bindGameState(game: GameState): void
  showToast(message: string, isError?: boolean): void
  fetchSaveSlots(): Promise<SaveArchiveView>
  findSaveSlot(id: string): SaveSlotView | undefined
  isOwnSave(id: string): boolean
  readSaveSlot(slot: SaveSlotView): Promise<GameState | null>
  bindLoadedGame(game: GameState, message: string): void
  /**
   * Joins a room by code; the running game becomes the guest's view of it.
   * `onError` carries the server's refusal back, because the toast that would
   * otherwise say it sits behind the title screen.
   */
  joinMultiplayer(code: string, name: string, onError: (message: string) => void): void
  readMultiplayerName(): string
  setMultiplayerName(name: string): void
  formatSaveTime(value: number): string
}

export interface TitleScreenController {
  isOpen(): boolean
  setOpen(open: boolean): void
  syncAccountBar(): void
  rememberLastSave(slot: {
    id: string
    source: 'server' | 'browser'
    name: string
  }): void
  /** Starts a new game on these settings, as picking it on the title screen does. */
  startScenario(settings: ScenarioSettings, message: string): void
  /** Back to the title screen, after asking about unsaved work. */
  leaveToTitle(): void
}

/**
 * The briefing a prepared scenario shows before it starts: its story, what it hands
 * you and what it wants. Everything here comes from the preset, so it can be read
 * before a single tile exists.
 */
function briefingMarkup(preset: ScenarioPreset): string {
  const settings = preset.settings
  const rows: [string, string][] = [
    ['Umgebung', ENVIRONMENTS[settings.environment].name],
    ['Kartengröße', `${settings.worldSize} × ${settings.worldSize}`],
    ['Startkapital', formatMoney(settings.startingMoney)],
  ]
  if (settings.startingLoan > 0) rows.push(['Startdarlehen', formatMoney(settings.startingLoan)])
  if (settings.goals.length > 0) {
    rows.push(['Erste Ausgabe', `bis Tag ${1 + (settings.firstEditionDays ?? SIMULATION_CONFIG.scenario.firstEditionDays)}`])
  }
  const goals = settings.goals
    .map((goal) => `<li class="scenario-goal scenario-goal-open"><span aria-hidden="true">○</span><span>${escapeHtml(goalName(goal))} <small>bis zur ${goal.edition}. Ausgabe</small></span></li>`)
    .join('')
  return `<p>${escapeHtml(preset.detail)}</p>
    <dl class="scenario-summary">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
    <h3 class="scenario-heading">Ziele</h3>
    <ul class="scenario-goal-list">${goals}</ul>
    <p class="scenario-hint">Geschafft, wenn alle Ziele erreicht sind. Gescheitert, wenn ein Ziel bis zu seiner Ausgabe fehlt oder das Konto zu lange ungedeckt im Minus bleibt.</p>`
}

export function mountTitleScreen(context: TitleScreenContext): TitleScreenController {
  const { getGame, getMultiplayerMode, scenarioPanel, saveSlotsPanel, setScenarioPanelOpen, setSaveSlotsPanelOpen, fillScenarioForm, readScenarioForm, closePathEditor, isPathWindowOpen, hideVisitorPanel, bindGameState, showToast, fetchSaveSlots, findSaveSlot, isOwnSave, readSaveSlot, bindLoadedGame, joinMultiplayer, readMultiplayerName, setMultiplayerName, formatSaveTime } = context
  const requireElement = <T extends Element>(selector: string): T => {
    const element = document.querySelector<T>(selector)
    if (!element) throw new Error(`Ben?tigtes UI-Element fehlt: ${selector}`)
    return element
  }

  const titleScreen = requireElement<HTMLElement>('#title-screen')
  const titleCrowd = mountTitleCrowd(requireElement<HTMLCanvasElement>('#title-crowd'))
  const titleScreenOpen = (): boolean => titleScreen.classList.contains('visible')
  function setTitleScreenOpen(open: boolean): void {
    titleScreen.classList.toggle('visible', open)
    // The crowd on the heading only walks while anyone can see it.
    titleCrowd.setRunning(open)
    if (open) {
      openTitleFreeplay(false)
      openTitleSubmenu(false)
      closeTitleLoad()
      openTitleLobbies(false)
      setAccountMaskOpen(false)
      // The running game's own windows belong to the running game: whatever was left
      // open behind the start screen is closed, so nothing of it still holds the keys.
      setScenarioPanelOpen(false)
      setSaveSlotsPanelOpen(false)
      syncAccountBar()
      void refreshResumeEntry()
    }
    // The start screen is the whole screen: every readout, toolbar and hint of the running
    // game is hidden behind it (see the body.title-open rules), and the keyboard shortcuts
    // that would otherwise reach the world are switched off.
    document.body.classList.toggle('title-open', open)
    if (!open) scenarioPanel.classList.remove('above-title')
  }
  /** Opens one of the existing windows on top of the title screen instead of behind it. */
  function openAboveTitle(panel: HTMLElement, open: () => void): void {
    if (titleScreenOpen()) panel.classList.add('above-title')
    open()
  }
  const titleFreeplayMask = requireElement<HTMLElement>('#title-freeplay-mask')
  const titleBriefingMask = requireElement<HTMLElement>('#title-briefing-mask')
  const titleBriefing = requireElement<HTMLElement>('#title-briefing')
  const titleBriefingName = requireElement<HTMLElement>('#title-briefing-name')
  let briefingPreset: ScenarioPreset | null = null
  const titleSubmenu = requireElement<HTMLElement>('#title-submenu')
  const titleLoadMask = requireElement<HTMLElement>('#title-load-mask')
  const titleLoadRows = requireElement<HTMLElement>('#title-load-rows')
  const titleLoadKicker = requireElement<HTMLElement>('#title-load-kicker')
  const titleLoadNote = requireElement<HTMLElement>('#title-load-note')
  const titleLobbyMask = requireElement<HTMLElement>('#title-multiplayer-mask')
  const titleLobbyRows = requireElement<HTMLElement>('#title-lobby-rows')
  const titleLobbyKicker = requireElement<HTMLElement>('#title-lobby-kicker')
  const titleLobbyNote = requireElement<HTMLElement>('#title-lobby-note')
  const titleLobbyName = requireElement<HTMLInputElement>('#title-lobby-name')
  const titleLobbyCode = requireElement<HTMLInputElement>('#title-lobby-code')
  const accountMask = requireElement<HTMLElement>('#title-account-mask')
  const accountForm = requireElement<HTMLFormElement>('#title-account-form')
  const accountTitle = requireElement<HTMLElement>('#title-account-title')
  const accountNameInput = requireElement<HTMLInputElement>('#account-name')
  const accountPasswordInput = requireElement<HTMLInputElement>('#account-password')
  const accountRepeatField = requireElement<HTMLElement>('#account-repeat-field')
  const accountRepeatInput = requireElement<HTMLInputElement>('#account-repeat')
  const accountMessage = requireElement<HTMLElement>('#account-message')
  const accountSubmit = requireElement<HTMLButtonElement>('#account-submit')
  const accountSwitch = requireElement<HTMLButtonElement>('#account-switch')
  const accountNameLabel = requireElement<HTMLElement>('#title-account-name')
  
  /** Which of the two the mask is showing; the fields and the buttons follow from it. */
  let accountMode: 'login' | 'register' = 'login'
  function setAccountMode(mode: 'login' | 'register'): void {
    accountMode = mode
    const register = mode === 'register'
    accountTitle.textContent = register ? 'Registrieren' : 'Anmelden'
    accountSubmit.textContent = register ? 'Konto anlegen' : 'Anmelden'
    accountSwitch.textContent = register ? 'Konto vorhanden? Anmelden' : 'Noch kein Konto? Registrieren'
    accountRepeatField.hidden = !register
    accountRepeatInput.required = register
    accountPasswordInput.autocomplete = register ? 'new-password' : 'current-password'
    accountMessage.textContent = ''
  }
  function setAccountMaskOpen(open: boolean, mode: 'login' | 'register' = accountMode): void {
    accountMask.hidden = !open
    if (!open) return
    setAccountMode(mode)
    accountForm.reset()
    accountMessage.textContent = ''
    accountNameInput.focus()
  }
  /** The bar under the menu: either the two ways in, or who is signed in and the way out. */
  function syncAccountBar(): void {
    const name = currentAccount()
    accountNameLabel.hidden = !name
    accountNameLabel.textContent = name ? `Angemeldet als ${name}` : ''
    titleScreen.querySelectorAll<HTMLButtonElement>('[data-account="login"], [data-account="register"]').forEach((button) => {
      button.hidden = !!name
    })
    titleScreen.querySelector<HTMLButtonElement>('[data-account="logout"]')!.hidden = !name
  }
  accountSwitch.addEventListener('click', () => setAccountMode(accountMode === 'login' ? 'register' : 'login'))
  accountForm.addEventListener('submit', (event) => {
    event.preventDefault()
    const name = accountNameInput.value
    const password = accountPasswordInput.value
    accountSubmit.disabled = true
    accountMessage.textContent = 'Einen Moment …'
    const done = (result: { ok: boolean; message: string }): void => {
      accountSubmit.disabled = false
      accountMessage.textContent = result.message
      if (!result.ok) return
      syncAccountBar()
      setAccountMaskOpen(false)
      showToast(result.message)
    }
    void (accountMode === 'register'
      ? registerAccount(name, password, accountRepeatInput.value)
      : signIn(name, password)
    ).then(done, () => done({ ok: false, message: 'Konto konnte nicht geprüft werden' }))
  })
  
  const titleMenuButtons = [...titleScreen.querySelectorAll<HTMLButtonElement>('[data-title-menu]')]
  const titleResumeButton = requireElement<HTMLButtonElement>('[data-title-menu="resume"]')
  const titleResumeMeta = requireElement<HTMLElement>('#title-resume-meta')
  
  /**
   * Picking the game back up. The last save that was written or opened is remembered
   * here — by id, not by content — and the title screen offers exactly that one. If it
   * is gone, or nothing has been played yet, the plate stays greyed out.
   */
  const LAST_SAVE_KEY = 'festival-last-save'
  type LastSave = { id: string; source: 'server' | 'browser'; name: string }
  let resumeSlot: SaveSlotView | null = null
  function rememberLastSave(slot: { id: string; source: 'server' | 'browser'; name: string }): void {
    try {
      window.localStorage.setItem(LAST_SAVE_KEY, JSON.stringify({ id: slot.id, source: slot.source, name: slot.name } satisfies LastSave))
    } catch { /* without storage the button simply falls back to the newest save */ }
  }
  function readLastSave(): LastSave | null {
    try {
      const stored = JSON.parse(window.localStorage.getItem(LAST_SAVE_KEY) ?? 'null') as LastSave | null
      return stored && typeof stored.id === 'string' ? stored : null
    } catch { return null }
  }
  async function refreshResumeEntry(): Promise<void> {
    const archive = await fetchSaveSlots()
    const pointer = readLastSave()
    // The remembered one if it is still there, otherwise the newest of your own —
    // clearing the browser's storage should not hide an archive full of festivals.
    resumeSlot = (pointer ? findSaveSlot(pointer.id) : undefined) ?? archive.own[0] ?? null
    titleResumeButton.disabled = !resumeSlot
    titleResumeMeta.textContent = resumeSlot
      ? [resumeSlot.name, saveProgressText(resumeSlot), formatSaveTime(resumeSlot.savedAt)].filter(Boolean).join(' · ')
      : 'Noch nicht gespielt'
    if (titleResumeButton.disabled && titleResumeButton.classList.contains('selected')) markTitleSelection(0)
  }
  async function resumeLastGame(): Promise<void> {
    if (!resumeSlot) return
    const loaded = await readSaveSlot(resumeSlot)
    if (!loaded) {
      // It was there when the screen opened and is not any more: say so and re-read.
      showToast('Dieser Spielstand ist nicht mehr vorhanden', true)
      void refreshResumeEntry()
      return
    }
    bindLoadedGame(loaded, `„${resumeSlot.name}“ fortgesetzt`)
    setTitleScreenOpen(false)
  }
  const titleRowButtons = [...titleScreen.querySelectorAll<HTMLButtonElement>('[data-title-scenario]')]
  
  /**
   * The menu is keyboard-first, the way the design draws it: one entry is always the
   * current one, the arrow keys move between them and Enter opens. Which list the keys
   * walk depends on whether the scenario submenu is open.
   */
  let titleSelection = 0
  function titleEntries(): HTMLButtonElement[] {
    if (!titleFreeplayMask.hidden) return [...titleFreeplayMask.querySelectorAll<HTMLButtonElement>('.title-freeplay-actions button')]
    if (!titleBriefingMask.hidden) return [...titleBriefingMask.querySelectorAll<HTMLButtonElement>('.title-freeplay-actions button')]
    if (!titleLoadMask.hidden) return [...titleLoadRows.querySelectorAll<HTMLButtonElement>('[data-title-load-slot]')]
    if (!titleLobbyMask.hidden) return [...titleLobbyMask.querySelectorAll<HTMLButtonElement>('#title-lobby-join, #title-lobby-refresh, [data-title-lobby]')]
    return (titleSubmenu.hidden ? titleMenuButtons : titleRowButtons).filter((entry) => !entry.disabled)
  }
  
  /**
   * The title screen's own archive: your saves first, then everything other people
   * have made public, each with the name behind it. It only offers the one thing that
   * belongs here — picking one up. Naming, sharing and deleting stay in the running
   * game, and a public festival you take from here is never written back to: saving it
   * puts a copy in your own archive.
   */
  function titleSlotRow(slot: SaveSlotView, withOwner: boolean): string {
    const meta = [withOwner ? `von ${escapeHtml(slot.owner)}` : '', saveProgressText(slot), formatSaveTime(slot.savedAt)].filter(Boolean).join(' · ')
    return `<button type="button" data-title-load-slot="${slot.id}"><span class="title-row-text"><span class="title-row-label">${escapeHtml(slot.name)}</span><span class="title-row-meta">${meta}</span></span><span class="title-row-value">Laden</span></button>`
  }
  async function openTitleLoad(): Promise<void> {
    titleLoadMask.hidden = false
    titleLoadRows.innerHTML = '<p class="title-load-empty">Spielstände werden gelesen …</p>'
    titleLoadNote.textContent = ''
    markTitleSelection(0)
    const archive = await fetchSaveSlots()
    const total = archive.own.length + archive.shared.length
    titleLoadKicker.textContent = total
      ? `${archive.own.length} eigene · ${archive.shared.length} öffentlich`
      : 'Archiv leer'
    const own = archive.own.length
      ? `<h3 class="title-submenu-heading">${archive.onServer ? `Deine Spielstände · ${escapeHtml(archive.account ?? '')}` : 'Spielstände in diesem Browser'}</h3>${archive.own.map((slot) => titleSlotRow(slot, false)).join('')}`
      : ''
    const shared = archive.shared.length
      ? `<h3 class="title-submenu-heading">Öffentliche Spielstände</h3>${archive.shared.map((slot) => titleSlotRow(slot, true)).join('')}`
      : ''
    titleLoadRows.innerHTML = own + shared ||
      `<p class="title-load-empty">${archive.serverError ? `${escapeHtml(archive.serverError)} ` : ''}Noch keine benannten Spielstände ${archive.onServer ? 'unter deinem Konto oder' : ''} in diesem Browser. Im laufenden Spiel legst du sie über „Spielstand“ an.</p>`
    titleLoadNote.textContent = saveStorageNote(archive)
    markTitleSelection(0)
  }
  function closeTitleLoad(): void {
    titleLoadMask.hidden = true
    markTitleSelection(0)
  }
  async function loadTitleSlot(id: string): Promise<void> {
    const slot = findSaveSlot(id)
    const loaded = slot ? await readSaveSlot(slot) : null
    if (!slot || !loaded) {
      titleLoadNote.textContent = 'Dieser Spielstand ist ungültig oder nicht mehr vorhanden.'
      void openTitleLoad()
      return
    }
    const foreign = !isOwnSave(id)
    bindLoadedGame(loaded, foreign ? `Öffentlicher Spielstand von ${slot.owner} geladen` : 'Spielstand geladen')
    closeTitleLoad()
    setTitleScreenOpen(false)
  }
  /**
   * Joining from the title screen. Two ways in, because rooms come in two kinds:
   * a public one picks itself off the list, a private one is only reachable by
   * the code its host passed around. The screen stays up until the room actually
   * answers, so a wrong code leaves the player where they can try again.
   */
  function lobbyRow(lobby: NetLobby): string {
    const meta = [
      `${lobby.players} ${lobby.players === 1 ? 'Spieler' : 'Spieler'}`,
      lobby.hostAway ? 'Host ist gerade weg' : '',
    ].filter(Boolean).join(' · ')
    return `<button type="button" data-title-lobby="${escapeHtml(lobby.code)}"><span class="title-row-text"><span class="title-row-label">${escapeHtml(lobby.host)}</span><span class="title-row-meta">${meta}</span></span><span class="title-row-value">${escapeHtml(lobby.code)}</span></button>`
  }
  async function refreshLobbies(): Promise<void> {
    titleLobbyRows.innerHTML = '<p class="title-load-empty">Offene Lobbys werden gesucht …</p>'
    titleLobbyKicker.textContent = 'Wird gesucht …'
    markTitleSelection(0)
    const lobbies = await fetchLobbies()
    if (titleLobbyMask.hidden) return
    titleLobbyKicker.textContent = lobbies.length
      ? `${lobbies.length} offen`
      : 'Keine offenen Lobbys'
    titleLobbyRows.innerHTML = lobbies.length
      ? lobbies.map(lobbyRow).join('')
      : '<p class="title-load-empty">Gerade ist keine öffentliche Lobby offen. Mit einem Code kommst du trotzdem in eine private.</p>'
    markTitleSelection(0)
  }
  function openTitleLobbies(open: boolean): void {
    titleLobbyMask.hidden = !open
    if (open) {
      titleLobbyName.value = readMultiplayerName()
      titleLobbyNote.textContent = ''
      void refreshLobbies()
    }
    markTitleSelection(0)
  }
  function joinLobby(code: string): void {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 4) {
      titleLobbyNote.textContent = 'Ein Raumcode hat vier Zeichen.'
      return
    }
    const name = titleLobbyName.value.trim() || readMultiplayerName()
    setMultiplayerName(name)
    titleLobbyNote.textContent = `Trete ${trimmed} bei …`
    joinMultiplayer(trimmed, name, (message) => {
      if (titleLobbyMask.hidden) return
      titleLobbyNote.textContent = message
      void refreshLobbies()
    })
  }
  // The menu's own Enter skips text fields, and a code field without Enter is a
  // field you have to leave to use.
  titleLobbyCode.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    joinLobby(titleLobbyCode.value)
  })
  titleLobbyName.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    titleLobbyCode.focus()
  })

  function markTitleSelection(index: number): void {
    const entries = titleEntries()
    if (!entries.length) return
    titleSelection = (index + entries.length) % entries.length
    entries.forEach((entry, position) => entry.classList.toggle('selected', position === titleSelection))
    entries[titleSelection]?.scrollIntoView({ block: 'nearest' })
  }
  function openTitleSubmenu(open: boolean): void {
    titleSubmenu.hidden = !open
    if (!open) {
      titleFreeplayMask.hidden = true
      titleBriefingMask.hidden = true
    }
    markTitleSelection(0)
  }
  /**
   * A prepared scenario briefs you first, on its own plate like free play: the list
   * steps aside and comes back when you leave.
   */
  function openTitleBriefing(preset: ScenarioPreset | null): void {
    briefingPreset = preset
    titleBriefingMask.hidden = !preset
    titleSubmenu.hidden = Boolean(preset)
    if (preset) {
      titleBriefingName.textContent = preset.name
      titleBriefing.innerHTML = briefingMarkup(preset)
    }
    markTitleSelection(0)
  }
  /**
   * Free play asks its questions on a plate of its own, one step further in: the scenario
   * list steps aside for it and comes back when this one is left, so the screen always
   * shows one thing at a time rather than growing a form under the list.
   */
  function openTitleFreeplay(open: boolean): void {
    titleFreeplayMask.hidden = !open
    titleSubmenu.hidden = open
    if (open) 
  fillScenarioForm(getGame().snapshot.scenario)
    markTitleSelection(0)
  }
  // Only a pointer that actually moves takes the selection over. `pointerover` alone
  // would also fire when the list shifts under a resting cursor — opening the submenu
  // or scrolling a row into view would then snap the selection back under the mouse.
  let titlePointer = { x: -1, y: -1 }
  titleScreen.addEventListener('pointermove', (event) => {
    if (event.clientX === titlePointer.x && event.clientY === titlePointer.y) return
    titlePointer = { x: event.clientX, y: event.clientY }
    const entry = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-title-menu], [data-title-scenario], [data-title-load-slot], [data-title-lobby]')
    const index = entry ? titleEntries().indexOf(entry) : -1
    if (index >= 0) markTitleSelection(index)
  })
  titleScreen.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-account-close]')) { setAccountMaskOpen(false); return }
    const account = target.closest<HTMLButtonElement>('[data-account]')
    if (account) {
      const mode = account.dataset.account
      if (mode === 'logout') {
        void signOut().then((result) => {
          syncAccountBar()
          showToast(result.message, !result.ok)
        })
      } else setAccountMaskOpen(true, mode === 'register' ? 'register' : 'login')
      return
    }
    if (target.closest('[data-title-freeplay-close]')) { openTitleFreeplay(false); return }
    if (target.closest('[data-title-briefing-close]')) { openTitleBriefing(null); return }
    if (target.closest('#title-briefing-start')) {
      if (!briefingPreset) return
      if (getMultiplayerMode() === 'client') {
        showToast('Nur der Host kann ein neues Szenario starten', true)
        return
      }
      startFestival(normalizeScenarioSettings({ ...briefingPreset.settings, preset: briefingPreset.id }), `${briefingPreset.name} gestartet`)
      return
    }
    if (target.closest('[data-title-back]')) { openTitleSubmenu(false); return }
    if (target.closest('[data-title-load-close]')) { closeTitleLoad(); return }
    if (target.closest('[data-title-lobby-close]')) { openTitleLobbies(false); return }
    if (target.closest('#title-lobby-refresh')) { void refreshLobbies(); return }
    if (target.closest('#title-lobby-join')) { joinLobby(titleLobbyCode.value); return }
    const lobby = target.closest<HTMLButtonElement>('[data-title-lobby]')
    if (lobby) { joinLobby(lobby.dataset.titleLobby!); return }
    const slot = target.closest<HTMLButtonElement>('[data-title-load-slot]')
    if (slot) { void loadTitleSlot(slot.dataset.titleLoadSlot!); return }
    const menu = target.closest<HTMLButtonElement>('[data-title-menu]')
    if (menu) {
      if (menu.dataset.titleMenu === 'resume') void resumeLastGame()
      else if (menu.dataset.titleMenu === 'new') openTitleSubmenu(true)
      else if (menu.dataset.titleMenu === 'load') void openTitleLoad()
      else if (menu.dataset.titleMenu === 'multiplayer') openTitleLobbies(true)
      else openAboveTitle(scenarioPanel, () => setScenarioPanelOpen(true))
      return
    }
    const scenario = target.closest<HTMLButtonElement>('[data-title-scenario]')
    if (!scenario) return
    if (getMultiplayerMode() === 'client') {
      showToast('Nur der Host kann ein neues Szenario starten', true)
      return
    }
    // A scenario that carries a price is not part of the base game: it is shown, it can
    // be read, and that is all — nothing here charges anyone or collects anything.
    if (scenario.dataset.titleLocked) {
      showToast(`Dieses Szenario gehört nicht zum Grundspiel · ${scenario.dataset.titleLocked}`, true)
      return
    }
    const preset = scenarioPreset(scenario.dataset.titleScenario || undefined)
    // A prepared scenario brings its own site and starts straight away; free play first
    // asks what the site should look like, because afterwards none of it can be changed.
    if (!preset) {
      openTitleFreeplay(true)
      return
    }
    openTitleBriefing(preset)
  })
  window.addEventListener('keydown', (event) => {
    if (!titleScreenOpen() || !scenarioPanel.hidden || !saveSlotsPanel.hidden) return
    if (!accountMask.hidden) {
      if (event.key === 'Escape') setAccountMaskOpen(false)
      return
    }
    if (isTextEntryTarget(event.target) || isTextEntryTarget(document.activeElement)) return
    if (event.key === 'Escape' || event.key === 'Backspace') {
      if (!titleBriefingMask.hidden) { event.preventDefault(); openTitleBriefing(null) }
      else if (!titleFreeplayMask.hidden) { event.preventDefault(); openTitleFreeplay(false) }
      else if (!titleLoadMask.hidden) { event.preventDefault(); closeTitleLoad() }
      else if (!titleLobbyMask.hidden) { event.preventDefault(); openTitleLobbies(false) }
      else if (!titleSubmenu.hidden) { event.preventDefault(); openTitleSubmenu(false) }
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); markTitleSelection(titleSelection + 1) }
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); markTitleSelection(titleSelection - 1) }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); titleEntries()[titleSelection]?.click() }
  })
  function startFestival(settings: ScenarioSettings, message: string): void {
    if (isPathWindowOpen()) closePathEditor()
    hideVisitorPanel()
    bindGameState(GameState.startNew(settings))
    markWorkSaved()
    setScenarioPanelOpen(false)
    setSaveSlotsPanelOpen(false)
    setTitleScreenOpen(false)
    showToast(message)
  }
  function leaveToTitle(): void {
    if (!confirmDiscardingWork('Zum Titelbildschirm zurückkehren?')) return
    setScenarioPanelOpen(false)
    setTitleScreenOpen(true)
  }
  requireElement<HTMLButtonElement>('#open-title-screen').addEventListener('click', leaveToTitle)
  
  requireElement<HTMLButtonElement>('#start-scenario').addEventListener('click', () => {
    if (getMultiplayerMode() === 'client') {
      showToast('Nur der Host kann ein neues Szenario starten', true)
      return
    }
    startFestival(readScenarioForm(), 'Freies Spiel gestartet')
  })
  

  return {
    isOpen: titleScreenOpen,
    setOpen: setTitleScreenOpen,
    syncAccountBar,
    rememberLastSave,
    startScenario: startFestival,
    leaveToTitle,
  }
}
