import { makeDraggable, makeResizable } from '../dragPanel'
import { deleteNamedSlotJson, readNamedSlotJson, readQuicksaveJson, writeNamedSlotJson } from '../game/browserSaves'
import { GameState } from '../game/GameState'
import { decodeSaveText, encodeSaveText, serializeSnapshot, storageErrorMessage } from '../game/saveText'
import { deleteServerSave, listServerSaves, loadServerSave, saveServerSave, shareServerSave } from '../game/serverSaves'
import { AUTOSAVE_DEFAULT_MINUTES, AUTOSAVE_INTERVALS, AUTOSAVE_KEY, LEGACY_AUTOSAVE_NAME, QUICKSAVE_NAME } from '../app/shell'
import { EMPTY_SAVE_ARCHIVE, composeSaveArchive, findQuickSlot, findSaveSlot as findArchiveSlot, offlineSaveArchive, saveArchiveHtml, saveAsArchiveHtml, saveStorageNote, type SaveArchiveView, type SaveSlotView } from './saveArchive'
import { formatSaveTime } from './format'
import { loadWithOverlay } from './loadingOverlay'
import { confirmDiscardingWork, markWorkSaved } from './unsavedWork'
import type { GameSnapshot } from '../game/types/snapshot'
import { localize, localizeName, t } from '../i18n'

export interface SaveControllerContext {
  getGame(): GameState
  getMultiplayerMode(): 'solo' | 'host' | 'client'
  isTitleOpen(): boolean
  rememberLastSave(slot: { id: string; source: 'server' | 'browser'; name: string }): void
  isPathWindowOpen(): boolean
  closePathEditor(): void
  bindGameState(game: GameState): void
  fillScenarioForm(settings: GameState['snapshot']['scenario']): void
  showToast(message: string, isError?: boolean): void
  /**
   * A slot quick- and autosaving write to instead of the player's own quicksave,
   * or null for that one. Set while the running park was inherited by a
   * multiplayer takeover: somebody else's world must not overwrite your game.
   */
  takeoverSlotName?(): string | null
  /**
   * Called with a game quick-loaded from that takeover slot, before it is bound:
   * a save of the inherited park is still somebody else's park.
   */
  keepTakeover?(game: GameState): void
}

export interface SaveController {
  panel: HTMLElement
  setPanelOpen(open: boolean): void
  fetchSlots(): Promise<SaveArchiveView>
  findSlot(id: string): SaveSlotView | undefined
  isOwnSave(id: string): boolean
  readSlot(slot: SaveSlotView): Promise<GameState | null>
  bindLoadedGame(game: GameState, message: string): void
  tryQuickLoad(): Promise<boolean>
  formatSaveTime(value: number): string
  /** Keeps any snapshot as a local browser save under `name`, replacing one of that name. */
  backupLocally(name: string, snapshot: Readonly<GameSnapshot>): Promise<string>
}

export function mountSaveController(context: SaveControllerContext): SaveController {
  const { getGame, getMultiplayerMode, isTitleOpen, rememberLastSave, isPathWindowOpen, closePathEditor, bindGameState, fillScenarioForm, showToast } = context
  const requireElement = <T extends Element>(selector: string): T => {
    const element = document.querySelector<T>(selector)
    // i18n-ignore: a broken page layout, for developers only; never shown to players.
    if (!element) throw new Error(`Benötigtes UI-Element fehlt: ${selector}`)
    return element
  }

  document.querySelector<HTMLButtonElement>('#save')?.addEventListener('click', () => {
    void persistQuicksave()
  })
  document.querySelector<HTMLButtonElement>('#load')?.addEventListener('click', () => {
    void tryQuickLoad()
  })
  
  const saveSlotsPanel = requireElement<HTMLElement>('#save-slots-panel')
  const saveSlotsList = saveSlotsPanel.querySelector<HTMLElement>('.save-slots-list')!
  const saveSlotsMessage = saveSlotsPanel.querySelector<HTMLElement>('.save-slots-message')!
  const saveStorageInfo = saveSlotsPanel.querySelector<HTMLElement>('[data-save-storage]')!
  const saveSlotName = saveSlotsPanel.querySelector<HTMLInputElement>('[name=name]')!
  makeDraggable(saveSlotsPanel.querySelector<HTMLElement>('.panel-header')!, saveSlotsPanel)
  makeResizable(saveSlotsPanel)
  let saveSlotsPausedSpeed = 0
  function setSaveSlotsPanelOpen(open: boolean): void {
    saveSlotsPanel.hidden = !open
    if (open) {
      saveSlotsPausedSpeed = getGame().snapshot.speed
      if (saveSlotsPausedSpeed !== 0) getGame().setSpeed(0)
    } else if (saveSlotsPausedSpeed !== 0) {
      getGame().setSpeed(saveSlotsPausedSpeed)
    }
  }
  /**
   * Where the game's saves come from. With an account they live on the server, under
   * that account; without one - no login, or no server at all - they stay in this
   * browser. Public saves other people shared are read along either way, and every
   * slot carries where it came from, so loading one asks the right archive.
   */
  let saveArchive: SaveArchiveView = EMPTY_SAVE_ARCHIVE
  const browserSlots = (): SaveSlotView[] =>
    GameState.listSaveSlots().map((slot) => ({ ...slot, public: false, owner: '', source: 'browser' as const }))
  const findSaveSlot = (id: string): SaveSlotView | undefined =>
    findArchiveSlot(saveArchive, id)
  function bindLoadedGame(loaded: GameState, message: string): void {
    if (!confirmDiscardingWork(t('Einen anderen Spielstand laden?'))) return
    loadWithOverlay(t('Spielstand wird geladen …'), () => {
      if (isPathWindowOpen()) closePathEditor()
      bindGameState(loaded)
      fillScenarioForm(loaded.snapshot.scenario)
      // What was just read off the disk is by definition saved.
      markWorkSaved()
      showToast(message)
    })
  }
  /** „Übernommen {Code}“ while the running park was inherited by a takeover, else null. */
  const takeoverSlot = (): string | null => context.takeoverSlotName?.() ?? null
  /**
   * The slot quick-saving, auto-saving and quick-loading share, as it stands in
   * the archive (`findQuickSlot`). Looked up by name rather than remembered, so
   * it still lines up after a reload, a sign-in, or the same game being played
   * in another browser. An older game's autosave becomes the quicksave rather
   * than being left beside it: writing into that id renames it, so the newest
   * save stays the newest.
   */
  async function quicksaveSlot(takeover: string | null): Promise<SaveSlotView | undefined> {
    const archive = await fetchSaveSlots()
    return findQuickSlot(archive.own, takeover, [QUICKSAVE_NAME, LEGACY_AUTOSAVE_NAME])
  }

  /**
   * Where quick- and autosaving write: the player's own quicksave slot, or — for
   * a park inherited by a multiplayer takeover — a slot of its own. Quick-loading
   * reads the same one.
   */
  async function persistQuickTarget(): Promise<string> {
    const takeover = takeoverSlot()
    const existing = await quicksaveSlot(takeover)
    return persistNamedSave(
      takeover ?? QUICKSAVE_NAME,
      existing?.id,
      existing?.source ?? (saveArchive.onServer ? 'server' : 'browser'),
    )
  }

  async function persistQuicksave(): Promise<void> {
    try {
      showToast(await persistQuickTarget())
    } catch (error) {
      showToast(storageErrorMessage(error, t('Schnellspeichern ist fehlgeschlagen')), true)
    }
  }
  /** Loads the single quick-save slot (`SAVE_KEY` / overflow store), not a named archive entry. */
  async function tryQuickLoad(): Promise<boolean> {
    if (getMultiplayerMode() === 'client') {
      showToast(t('Nur der Host kann einen Spielstand laden'), true)
      return false
    }
    // An inherited park loads its own takeover slot back. Without one, nothing
    // is loaded: the player's own quicksave would swap the room's world for an
    // unrelated park.
    const takeover = takeoverSlot()
    const slot = await quicksaveSlot(takeover)
    if (takeover && !slot) {
      showToast(t`Noch kein Stand „${localizeName(takeover)}“ gespeichert`, true)
      return false
    }
    // Saves written before the two were merged still live in the old single
    // slot; they are read as a fallback so nobody's last game disappears.
    const loaded = slot
      ? await readSaveSlot(slot)
      : await (async () => {
        const raw = await readQuicksaveJson()
        return raw ? GameState.fromJSON(raw) : GameState.load()
      })()
    if (!loaded) {
      showToast(t('Kein gültiger Spielstand gefunden'), true)
      return false
    }
    if (takeover) context.keepTakeover?.(loaded)
    const loadedName = localizeName(slot?.name ?? QUICKSAVE_NAME)
    bindLoadedGame(loaded, t`„${loadedName}“ geladen`)
    return true
  }
  function showSaveSlots(archive: SaveArchiveView): void {
    saveSlotsList.innerHTML = saveArchiveHtml(archive, formatSaveTime)
  }
  async function fetchSaveSlots(): Promise<SaveArchiveView> {
    const local = browserSlots()
    try {
      const archive = await listServerSaves()
      saveArchive = composeSaveArchive(local, archive)
    } catch (error) {
      saveArchive = offlineSaveArchive(local, error)
    }
    return saveArchive
  }
  async function renderSaveSlots(): Promise<void> {
    const archive = await fetchSaveSlots()
    saveStorageInfo.textContent = saveStorageNote(archive)
    showSaveSlots(archive)
  }
  async function openSaveSlots(): Promise<void> {
    if (getMultiplayerMode() === 'client') { showToast(t('Nur der Host kann Spielstände verwalten'), true); return }
    saveSlotsMessage.textContent = ''
    saveSlotName.value = ''
    setSaveSlotsPanelOpen(true)
    await renderSaveSlots()
    saveSlotName.focus()
  }
  saveSlotsPanel.querySelector('[data-close]')!.addEventListener('click', () => setSaveSlotsPanelOpen(false))
  saveSlotsPanel.querySelector<HTMLFormElement>('[data-save-slot]')!.addEventListener('submit', async event => {
    event.preventDefault()
    try {
      saveSlotsMessage.textContent = await persistNamedSave(saveSlotName.value)
      saveSlotName.value = ''
      await renderSaveSlots()
    } catch (error) { saveSlotsMessage.textContent = error instanceof Error ? localize(error.message) : t('Spielstand konnte nicht gespeichert werden') }
  })
  /** Reads one slot back, from wherever it came from, and makes it the one to resume. */
  async function readSaveSlot(slot: SaveSlotView): Promise<GameState | null> {
    try {
      if (slot.source === 'server') {
        const loaded = GameState.fromJSON((await loadServerSave(slot.id)).snapshot)
        if (loaded) rememberLastSave(slot)
        return loaded
      }
      const raw = await readNamedSlotJson(slot.id)
      const loaded = raw ? GameState.fromJSON(raw) : GameState.loadSlot(slot.id)
      if (loaded) rememberLastSave(slot)
      return loaded
    } catch {
      return null
    }
  }
  
  /**
   * Writes a snapshot into a browser slot: localStorage when it fits, the
   * IndexedDB overflow store otherwise. `overflow` says which one took it.
   */
  async function writeLocalSlot(name: string, id: string | undefined, snapshot: Readonly<GameSnapshot>): Promise<{ message: string; slotId?: string; overflow: boolean }> {
    const json = serializeSnapshot(snapshot)
    const result = GameState.saveSnapshotSlot(snapshot, name, id)
    // The game answers in canonical German; the message is shown, so it is translated here.
    if (result.ok) return { message: localize(result.message), slotId: result.slotId, overflow: false }
    if (!result.slotId) throw new Error(result.message)
    await writeNamedSlotJson(result.slotId, json)
    const shownName = localizeName(name.trim().replace(/\s+/g, ' '))
    return {
      message: t`Spielstand „${shownName}“ im erweiterten Browser-Speicher gespeichert`,
      slotId: result.slotId,
      overflow: true,
    }
  }

  async function persistLocalNamedSave(name: string, id?: string): Promise<string> {
    const written = await writeLocalSlot(name, id, getGame().snapshot)
    if (!written.overflow) rememberBrowserSave(name)
    else if (written.slotId) rememberLastSave({ id: written.slotId, source: 'browser', name: name.trim().replace(/\s+/g, ' ') })
    return written.message
  }

  /**
   * A backup kept in this browser only, whatever the archive is — the world a
   * host ran offline before a takeover. It replaces an older backup of the same
   * name and does not become the save „Fortsetzen“ offers.
   */
  async function backupLocally(name: string, snapshot: Readonly<GameSnapshot>): Promise<string> {
    const existing = browserSlots().find((slot) => slot.name === name.trim().replace(/\s+/g, ' '))
    return (await writeLocalSlot(name, existing?.id, snapshot)).message
  }
  
  async function persistNamedSave(name: string, id?: string, source: 'server' | 'browser' = saveArchive.onServer ? 'server' : 'browser'): Promise<string> {
    const json = serializeSnapshot(getGame().snapshot)
    // The snapshot is taken now, so this is the state that ends up on disk whichever
    // archive takes it — a later change during the write still counts as unsaved.
    markWorkSaved()
    if (source === 'server') {
      try {
        const saved = await saveServerSave(name, json, id)
        rememberLastSave({ ...saved, source: 'server' })
        const savedName = localizeName(saved.name)
        return t`Spielstand „${savedName}“ unter deinem Konto gespeichert`
      } catch (error) {
        const local = await persistLocalNamedSave(name, undefined)
        const reason = error instanceof Error ? localize(error.message) : t('Server-Speichern fehlgeschlagen')
        return t`${reason} Stattdessen lokal: ${local}`
      }
    }
    return persistLocalNamedSave(name, id)
  }
  /** A browser slot has no id until it exists, so it is looked up after the write. */
  function rememberBrowserSave(name: string): void {
    const slot = browserSlots().find((entry) => entry.name === name.trim().replace(/\s+/g, ' '))
    if (slot) rememberLastSave(slot)
  }
  
  /**
   * The automatic save. It always writes to one slot of its own — never over a save
   * the player named — and that slot is what „Fortsetzen“ then offers. The clock is
   * real time, not festival time, and it only runs while a game is actually being
   * played: not behind the title screen, and not as a multiplayer guest, whose host
   * owns the world anyway.
   */
  let autosaveTimer: ReturnType<typeof setInterval> | undefined
  let autosaveRunning = false
  async function runAutosave(): Promise<void> {
    if (autosaveRunning || isTitleOpen() || getMultiplayerMode() === 'client') return
    autosaveRunning = true
    try {
      // The same slot quick-saving writes: one latest save, not two competing ones.
      await persistQuickTarget()
      const takeover = takeoverSlot()
      showToast(takeover ? t`Automatisch gespeichert als „${localizeName(takeover)}“` : t('Automatisch gespeichert'))
    } catch (error) {
      showToast(error instanceof Error ? localize(error.message) : t('Automatisches Speichern fehlgeschlagen'), true)
    } finally {
      autosaveRunning = false
    }
  }
  const autosaveSelect = requireElement<HTMLSelectElement>('#setting-autosave')
  function applyAutosaveInterval(minutes: number): void {
    if (autosaveTimer) clearInterval(autosaveTimer)
    autosaveTimer = minutes > 0 ? setInterval(() => void runAutosave(), minutes * 60_000) : undefined
  }
  function readAutosaveSetting(): number {
    try {
      // A nothing-stored-yet localStorage read comes back as null, and Number(null) is
      // 0 — which also happens to be the "Aus" option's own value, so it used to read
      // as a saved choice to turn autosaving off instead of as no choice at all.
      const raw = window.localStorage.getItem(AUTOSAVE_KEY)
      if (raw === null) return AUTOSAVE_DEFAULT_MINUTES
      const stored = Number(raw)
      return AUTOSAVE_INTERVALS.some((option) => option.minutes === stored) ? stored : AUTOSAVE_DEFAULT_MINUTES
    } catch { return AUTOSAVE_DEFAULT_MINUTES }
  }
  autosaveSelect.value = String(readAutosaveSetting())
  applyAutosaveInterval(Number(autosaveSelect.value))
  autosaveSelect.addEventListener('change', () => {
    const minutes = Number(autosaveSelect.value)
    applyAutosaveInterval(minutes)
    try { window.localStorage.setItem(AUTOSAVE_KEY, String(minutes)) } catch { /* then it lasts for this session */ }
    const interval = AUTOSAVE_INTERVALS.find((option) => option.minutes === minutes)?.label.toLowerCase() ?? ''
    showToast(minutes > 0 ? t`Autospeichern: ${interval}` : t('Autospeichern aus'))
  })
  saveSlotsPanel.addEventListener('click', async event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-load-slot],[data-overwrite-slot],[data-share-slot],[data-delete-slot]')
    if (!button) return
    const id = button.dataset.loadSlot ?? button.dataset.overwriteSlot ?? button.dataset.shareSlot ?? button.dataset.deleteSlot!
    if (button.dataset.loadSlot) {
      const slot = findSaveSlot(id)
      const loaded = slot ? await readSaveSlot(slot) : null
      if (!slot || !loaded) { saveSlotsMessage.textContent = t('Dieser Spielstand ist ungültig oder nicht mehr vorhanden.'); renderSaveSlots(); return }
      const foreign = !saveArchive.own.some((own) => own.id === id)
      bindLoadedGame(loaded, foreign ? t`Öffentlicher Spielstand von ${slot.owner} geladen` : t('Spielstand geladen'))
      setSaveSlotsPanelOpen(false)
      return
    }
    // Overwriting, sharing and deleting are offered on your own rows only, so an id
    // from anywhere else is simply not there.
    const slot = saveArchive.own.find((item) => item.id === id)
    if (!slot) { renderSaveSlots(); return }
    if (button.dataset.overwriteSlot) {
      try {
        saveSlotsMessage.textContent = await persistNamedSave(slot.name, id, slot.source)
        await renderSaveSlots()
      } catch (error) { saveSlotsMessage.textContent = error instanceof Error ? localize(error.message) : t('Spielstand konnte nicht überschrieben werden') }
      return
    }
    if (button.dataset.shareSlot) {
      try {
        const updated = await shareServerSave(id, !slot.public)
        const sharedName = localizeName(slot.name)
        saveSlotsMessage.textContent = updated.public
          ? t`Spielstand „${sharedName}“ ist jetzt öffentlich — andere können ihn laden, aber nicht überschreiben.`
          : t`Spielstand „${sharedName}“ ist wieder privat`
        await renderSaveSlots()
      } catch (error) { saveSlotsMessage.textContent = error instanceof Error ? localize(error.message) : t('Sichtbarkeit konnte nicht geändert werden') }
      return
    }
    if (!window.confirm(t`Spielstand „${localizeName(slot.name)}“ wirklich löschen?`)) return
    try {
      if (slot.source === 'server') await deleteServerSave(id)
      else {
        const result = GameState.deleteSaveSlot(id)
        if (!result.ok) throw new Error(result.message)
        await deleteNamedSlotJson(id)
      }
      saveSlotsMessage.textContent = t('Spielstand gelöscht')
      await renderSaveSlots()
    } catch (error) { saveSlotsMessage.textContent = error instanceof Error ? localize(error.message) : t('Spielstand konnte nicht gelöscht werden') }
  })
  document.querySelector<HTMLButtonElement>('#save-slots')?.addEventListener('click', openSaveSlots)
  
  const saveAsPanel = requireElement<HTMLElement>('#save-as-panel')
  const saveAsList = saveAsPanel.querySelector<HTMLElement>('[data-save-as-list]')!
  const saveAsMessage = saveAsPanel.querySelector<HTMLElement>('[data-save-as-message]')!
  const saveAsStorageInfo = saveAsPanel.querySelector<HTMLElement>('[data-save-as-storage]')!
  const saveAsName = saveAsPanel.querySelector<HTMLInputElement>('[name=name]')!
  let saveAsPausedSpeed = 0
  function setSaveAsPanelOpen(open: boolean): void {
    saveAsPanel.hidden = !open
    if (open) {
      saveAsPausedSpeed = getGame().snapshot.speed
      if (saveAsPausedSpeed !== 0) getGame().setSpeed(0)
    } else if (saveAsPausedSpeed !== 0) {
      getGame().setSpeed(saveAsPausedSpeed)
    }
  }
  /**
   * Only your own saves are listed here: this window overwrites, and that is the one
   * thing a public save of someone else's never allows.
   */
  async function renderSaveAsSlots(): Promise<void> {
    const archive = await fetchSaveSlots()
    saveAsStorageInfo.textContent = saveStorageNote(archive)
    saveAsList.innerHTML = saveAsArchiveHtml(archive, formatSaveTime)
  }
  async function openSaveAs(): Promise<void> {
    if (getMultiplayerMode() === 'client') { showToast(t('Nur der Host kann Spielstände verwalten'), true); return }
    saveAsMessage.textContent = ''
    saveAsName.value = ''
    setSaveAsPanelOpen(true)
    await renderSaveAsSlots()
    saveAsName.focus()
  }
  requireElement<HTMLButtonElement>('#close-save-as').addEventListener('click', () => setSaveAsPanelOpen(false))
  makeDraggable(saveAsPanel.querySelector<HTMLElement>('.panel-header')!, saveAsPanel)
  makeResizable(saveAsPanel)
  saveAsPanel.querySelector<HTMLFormElement>('[data-save-as]')!.addEventListener('submit', async event => {
    event.preventDefault()
    try {
      saveAsMessage.textContent = await persistNamedSave(saveAsName.value)
      saveAsName.value = ''
      await renderSaveAsSlots()
    } catch (error) { saveAsMessage.textContent = error instanceof Error ? localize(error.message) : t('Spielstand konnte nicht gespeichert werden') }
  })
  saveAsPanel.addEventListener('click', async event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-overwrite-slot]'); if (!button) return
    const id = button.dataset.overwriteSlot!
    const slot = saveArchive.own.find((item) => item.id === id)
    if (!slot) { renderSaveAsSlots(); return }
    try {
      saveAsMessage.textContent = await persistNamedSave(slot.name, id, slot.source)
      await renderSaveAsSlots()
    } catch (error) { saveAsMessage.textContent = error instanceof Error ? localize(error.message) : t('Spielstand konnte nicht überschrieben werden') }
  })
  document.querySelector<HTMLButtonElement>('#save-as')?.addEventListener('click', openSaveAs)
  
  const saveTextDialog = document.createElement('dialog')
  saveTextDialog.className = 'save-text-dialog'
  saveTextDialog.innerHTML = `<h2>${t('Spielstand als Text')}</h2><p>${t('Base64-Text kopieren oder einen erhaltenen Spielstand einfügen.')}</p><textarea aria-label="${t('Base64-Spielstand')}" spellcheck="false"></textarea><p class="save-text-error" role="alert"></p><div><button data-import>${t('Spielstand laden')}</button><button data-close>${t('Schließen')}</button></div>`
  document.body.append(saveTextDialog)
  const saveTextArea = saveTextDialog.querySelector('textarea')!
  const saveTextError = saveTextDialog.querySelector('.save-text-error')!
  const saveTextImport = saveTextDialog.querySelector<HTMLButtonElement>('[data-import]')!
  function openSaveText(text: string, importing: boolean): void {
    saveTextArea.value = text
    saveTextArea.readOnly = !importing
    saveTextImport.hidden = !importing
    saveTextError.textContent = ''
    saveTextDialog.showModal()
    saveTextArea.focus()
    if (!importing) saveTextArea.select()
  }
  saveTextDialog.querySelector('[data-close]')!.addEventListener('click', () => saveTextDialog.close())
  document.querySelector('#copy-save')!.addEventListener('click', async () => {
    const text = encodeSaveText(serializeSnapshot(getGame().snapshot))
    try {
      await navigator.clipboard.writeText(text)
      showToast(t('Base64-Spielstand in die Zwischenablage kopiert'))
    } catch {
      openSaveText(text, false)
      showToast(t('Text mit Strg+C kopieren'))
    }
  })
  document.querySelector('#paste-save')!.addEventListener('click', () => {
    if (getMultiplayerMode() === 'client') { showToast(t('Nur der Host kann einen Spielstand laden'), true); return }
    openSaveText('', true)
    // Manual paste works without clipboard permissions in every browser.
  })
  saveTextImport.addEventListener('click', () => {
    if (getMultiplayerMode() === 'client') { saveTextError.textContent = t('Nur der Host kann einen Spielstand laden'); return }
    try {
      const loaded = GameState.fromJSON(decodeSaveText(saveTextArea.value))
      if (!loaded) throw new Error('invalid save')
      saveTextDialog.close()
      bindLoadedGame(loaded, t('Spielstand aus Base64 geladen'))
    } catch {
      saveTextError.textContent = t('Ungültiger oder unvollständiger Base64-Spielstand.')
    }
  })
  
  
  return {
    panel: saveSlotsPanel,
    setPanelOpen: setSaveSlotsPanelOpen,
    fetchSlots: fetchSaveSlots,
    findSlot: findSaveSlot,
    isOwnSave: (id) => saveArchive.own.some((slot) => slot.id === id),
    readSlot: readSaveSlot,
    bindLoadedGame,
    tryQuickLoad,
    formatSaveTime,
    backupLocally,
  }
}
