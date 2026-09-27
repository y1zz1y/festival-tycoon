import type { ServerSaveSlot } from '../game/serverSaves'
import { joinParts, localize, localizeName, t, tc } from '../i18n'

export type SaveSlotView = ServerSaveSlot & { source: 'server' | 'browser' }
export type SaveArchiveView = {
  own: SaveSlotView[]
  shared: SaveSlotView[]
  account: string | null
  onServer: boolean
  reachable: boolean
  serverError: string
}

export const EMPTY_SAVE_ARCHIVE: SaveArchiveView = {
  own: [],
  shared: [],
  account: null,
  onServer: false,
  reachable: false,
  serverError: '',
}

export function composeSaveArchive(
  local: SaveSlotView[],
  server: { own: ServerSaveSlot[]; shared: ServerSaveSlot[]; account: string | null },
): SaveArchiveView {
  const serverOwn = server.account
    ? server.own.map((slot) => ({ ...slot, source: 'server' as const }))
    : []
  return {
    own: [...serverOwn, ...local].sort((a, b) => b.savedAt - a.savedAt),
    shared: server.shared.map((slot) => ({ ...slot, source: 'server' as const })),
    account: server.account,
    onServer: Boolean(server.account),
    reachable: true,
    serverError: '',
  }
}

export function offlineSaveArchive(local: SaveSlotView[], error: unknown): SaveArchiveView {
  return {
    own: local,
    shared: [],
    account: null,
    onServer: false,
    reachable: false,
    serverError:
      error instanceof Error ? error.message : t('Server-Spielstände sind nicht erreichbar.'),
  }
}

export function findSaveSlot(archive: SaveArchiveView, id: string): SaveSlotView | undefined {
  return archive.own.find((slot) => slot.id === id) ??
    archive.shared.find((slot) => slot.id === id)
}

/**
 * The slot quick-saving, auto-saving and quick-loading share, looked up by name.
 * A park inherited by a multiplayer takeover has one of its own (`takeover`,
 * „Übernommen {Code}“): saving writes there and loading reads there, never the
 * player's own quicksave — not even when the takeover slot does not exist yet.
 * Otherwise it is the first of `ownNames` there is (the quicksave, then an older
 * game's autosave).
 */
export function findQuickSlot(
  own: readonly SaveSlotView[],
  takeover: string | null,
  ownNames: readonly string[],
): SaveSlotView | undefined {
  if (takeover) return own.find((slot) => slot.name === takeover)
  for (const name of ownNames) {
    const slot = own.find((entry) => entry.name === name)
    if (slot) return slot
  }
  return undefined
}

/** A server error arrives as canonical German (serverSaves); it is translated for display only. */
function serverErrorText(archive: SaveArchiveView): string {
  return archive.serverError ? localize(archive.serverError) : ''
}

export function saveStorageNote(archive: SaveArchiveView): string {
  const local = t('Lokale Spielstände liegen in diesem Browser (bis 20), unabhängig vom Server.')
  if (archive.onServer) {
    const account = archive.account ?? ''
    return `${t`Server-Spielstände liegen beim Konto „${account}“ (bis 20).`} ${local}`
  }
  if (archive.reachable) {
    return `${t('Ohne Konto bleiben neue Server-Stände leer. Melde dich im Titelbildschirm an.')} ${local}`
  }
  return `${serverErrorText(archive) || t('Der Spielserver ist nicht erreichbar.')} ${local}`
}

function editionText(edition: number | undefined): string {
  if (edition === undefined) return ''
  return edition > 0 ? t`${edition}. Ausgabe` : t('Vor dem ersten Festival')
}

/**
 * Where the festival stood when the save was written: the edition, the day and the
 * clock. Saves from before this was recorded say nothing rather than guessing.
 */
export function saveProgressText(slot: Pick<ServerSaveSlot, 'edition' | 'day' | 'minute'>): string {
  if (slot.day === undefined || slot.minute === undefined) return ''
  const hours = Math.floor(slot.minute / 60) % 24
  const minutes = Math.floor(slot.minute % 60)
  const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  return joinParts(editionText(slot.edition), t`Tag ${slot.day}`, clock)
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!)

/** The line under a save's name, or nothing for a save that never recorded where it stood. */
const progressLine = (slot: SaveSlotView): string => {
  const text = saveProgressText(slot)
  return text ? `<small class="save-slot-progress">${text}</small>` : ''
}

/** A slot name as shown: user text, or a canonical default such as the quicksave slot. */
const slotName = (slot: SaveSlotView): string => escapeHtml(localizeName(slot.name))

/** Time, visibility and where a save of your own lives. */
const ownSlotMeta = (slot: SaveSlotView, archive: SaveArchiveView, formatTime: (value: number) => string): string =>
  joinParts(
    formatTime(slot.savedAt),
    slot.public && t('öffentlich'),
    slot.source === 'browser' && archive.onServer && t('dieser Browser'),
  )

/** The empty-archive note, with or without the account half. */
export function noNamedSavesText(onServer: boolean): string {
  return onServer
    ? t('Noch keine benannten Spielstände unter deinem Konto oder in diesem Browser.')
    : t('Noch keine benannten Spielstände in diesem Browser.')
}

export function saveArchiveHtml(
  archive: SaveArchiveView,
  formatTime: (value: number) => string,
): string {
  const ownRow = (slot: SaveSlotView): string => {
    const share = slot.source === 'server'
      ? `<button data-share-slot="${slot.id}">${slot.public ? t('Nicht mehr teilen') : t('Teilen')}</button>`
      : ''
    return `<article data-slot="${slot.id}"><div><strong>${slotName(slot)}</strong>${progressLine(slot)}<small>${ownSlotMeta(slot, archive, formatTime)}</small></div><div><button data-load-slot="${slot.id}">${tc('verb', 'Laden')}</button><button data-overwrite-slot="${slot.id}">${t('Überschreiben')}</button>${share}<button data-delete-slot="${slot.id}" aria-label="${t`${slotName(slot)} löschen`}">×</button></div></article>`
  }
  const serverOwn = archive.own.filter((slot) => slot.source === 'server')
  const localOwn = archive.own.filter((slot) => slot.source === 'browser')
  const account = escapeHtml(archive.account ?? '')
  const serverBlock = archive.onServer
    ? `<h3 class="save-slots-heading">${t`Konto „${account}“`}</h3>${
        serverOwn.length
          ? serverOwn.map(ownRow).join('')
          : `<p class="save-slots-empty">${t('Noch keine Server-Spielstände unter diesem Konto.')}</p>`
      }`
    : archive.serverError
      ? `<p class="save-slots-empty">${escapeHtml(serverErrorText(archive))}</p>`
      : ''
  const localBlock = localOwn.length
    ? `${archive.onServer || archive.serverError ? `<h3 class="save-slots-heading">${t('Dieser Browser')}</h3>` : ''}${localOwn.map(ownRow).join('')}`
    : `<p class="save-slots-empty">${t('Noch keine benannten Spielstände in diesem Browser. „Schnell speichern“ bleibt der einzelne Schnellstand.')}</p>`
  const shared = archive.shared.length
    ? `<h3 class="save-slots-heading">${t('Öffentliche Spielstände')}</h3><p class="save-slots-empty">${t('Laden ja, überschreiben nein — gespeichert wird immer unter deinem eigenen Konto.')}</p>${archive.shared.map((slot) =>
        `<article data-slot="${slot.id}"><div><strong>${slotName(slot)}</strong>${progressLine(slot)}<small>${joinParts(t`von ${escapeHtml(slot.owner)}`, formatTime(slot.savedAt))}</small></div><div><button data-load-slot="${slot.id}">${tc('verb', 'Laden')}</button></div></article>`,
      ).join('')}`
    : ''
  return serverBlock + localBlock + shared
}

export function saveAsArchiveHtml(
  archive: SaveArchiveView,
  formatTime: (value: number) => string,
): string {
  if (!archive.own.length) {
    return `<p class="save-slots-empty">${noNamedSavesText(archive.onServer)}</p>`
  }
  return archive.own.map((slot) =>
    `<article data-slot="${slot.id}"><div><strong>${slotName(slot)}</strong>${progressLine(slot)}<small>${ownSlotMeta(slot, archive, formatTime)}</small></div><div><button data-overwrite-slot="${slot.id}">${t('Überschreiben')}</button></div></article>`,
  ).join('')
}
