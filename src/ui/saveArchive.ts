import type { ServerSaveSlot } from '../game/serverSaves'

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
      error instanceof Error ? error.message : 'Server-Spielstände sind nicht erreichbar.',
  }
}

export function findSaveSlot(archive: SaveArchiveView, id: string): SaveSlotView | undefined {
  return archive.own.find((slot) => slot.id === id) ??
    archive.shared.find((slot) => slot.id === id)
}

export function saveStorageNote(archive: SaveArchiveView): string {
  const local = 'Lokale Spielstände liegen in diesem Browser (bis 20), unabhängig vom Server.'
  if (archive.onServer) {
    return `Server-Spielstände liegen beim Konto „${archive.account}“ (bis 20). ${local}`
  }
  if (archive.reachable) {
    return `Ohne Konto bleiben neue Server-Stände leer. Melde dich im Titelbildschirm an. ${local}`
  }
  return `${archive.serverError || 'Der Spielserver ist nicht erreichbar.'} ${local}`
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!)

export function saveArchiveHtml(
  archive: SaveArchiveView,
  formatTime: (value: number) => string,
): string {
  const ownRow = (slot: SaveSlotView): string => {
    const share = slot.source === 'server'
      ? `<button data-share-slot="${slot.id}">${slot.public ? 'Nicht mehr teilen' : 'Teilen'}</button>`
      : ''
    return `<article data-slot="${slot.id}"><div><strong>${escapeHtml(slot.name)}</strong><small>${formatTime(slot.savedAt)}${slot.public ? ' · öffentlich' : ''}${slot.source === 'browser' && archive.onServer ? ' · dieser Browser' : ''}</small></div><div><button data-load-slot="${slot.id}">Laden</button><button data-overwrite-slot="${slot.id}">Überschreiben</button>${share}<button data-delete-slot="${slot.id}" aria-label="${escapeHtml(slot.name)} löschen">×</button></div></article>`
  }
  const serverOwn = archive.own.filter((slot) => slot.source === 'server')
  const localOwn = archive.own.filter((slot) => slot.source === 'browser')
  const serverBlock = archive.onServer
    ? `<h3 class="save-slots-heading">Konto „${escapeHtml(archive.account ?? '')}“</h3>${
        serverOwn.length
          ? serverOwn.map(ownRow).join('')
          : '<p class="save-slots-empty">Noch keine Server-Spielstände unter diesem Konto.</p>'
      }`
    : archive.serverError
      ? `<p class="save-slots-empty">${escapeHtml(archive.serverError)}</p>`
      : ''
  const localBlock = localOwn.length
    ? `${archive.onServer || archive.serverError ? '<h3 class="save-slots-heading">Dieser Browser</h3>' : ''}${localOwn.map(ownRow).join('')}`
    : '<p class="save-slots-empty">Noch keine benannten Spielstände in diesem Browser. „Schnell speichern“ bleibt der einzelne Schnellstand.</p>'
  const shared = archive.shared.length
    ? `<h3 class="save-slots-heading">Öffentliche Spielstände</h3><p class="save-slots-empty">Laden ja, überschreiben nein — gespeichert wird immer unter deinem eigenen Konto.</p>${archive.shared.map((slot) =>
        `<article data-slot="${slot.id}"><div><strong>${escapeHtml(slot.name)}</strong><small>von ${escapeHtml(slot.owner)} · ${formatTime(slot.savedAt)}</small></div><div><button data-load-slot="${slot.id}">Laden</button></div></article>`,
      ).join('')}`
    : ''
  return serverBlock + localBlock + shared
}

export function saveAsArchiveHtml(
  archive: SaveArchiveView,
  formatTime: (value: number) => string,
): string {
  if (!archive.own.length) {
    return `<p class="save-slots-empty">Noch keine benannten Spielstände ${archive.onServer ? 'unter deinem Konto oder' : ''} in diesem Browser.</p>`
  }
  return archive.own.map((slot) =>
    `<article data-slot="${slot.id}"><div><strong>${escapeHtml(slot.name)}</strong><small>${formatTime(slot.savedAt)}${slot.public ? ' · öffentlich' : ''}${slot.source === 'browser' && archive.onServer ? ' · dieser Browser' : ''}</small></div><div><button data-overwrite-slot="${slot.id}">Überschreiben</button></div></article>`,
  ).join('')
}
