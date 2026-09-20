import type { GameState } from '../game/GameState'

export type ConfirmDialogOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
}

export type NamedRide = {
  id: string
  name: string
}

type DemolishCell = {
  x: number
  z: number
  buildingId?: string
  localX?: number
  localZ?: number
}

let dialog: HTMLDialogElement | null = null
let pending: ((confirmed: boolean) => void) | null = null

function finish(confirmed: boolean): void {
  const resolve = pending
  pending = null
  dialog?.close()
  resolve?.(confirmed)
}

function ensureDialog(): HTMLDialogElement {
  if (dialog) return dialog
  dialog = document.createElement('dialog')
  dialog.className = 'confirm-dialog'
  dialog.setAttribute('aria-labelledby', 'confirm-dialog-title')
  dialog.innerHTML =
    '<h2 id="confirm-dialog-title"></h2><p></p><div class="confirm-dialog-actions">' +
    '<button type="button" data-confirm></button>' +
    '<button type="button" data-cancel></button></div>'
  dialog.querySelector('[data-confirm]')!.addEventListener('click', () => finish(true))
  dialog.querySelector('[data-cancel]')!.addEventListener('click', () => finish(false))
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault()
    finish(false)
  })
  dialog.addEventListener('close', () => {
    if (pending) finish(false)
  })
  document.body.append(dialog)
  return dialog
}

/** In-game modal, same `<dialog>` pattern as save import/export. */
export function confirmAction(options: ConfirmDialogOptions): Promise<boolean> {
  if (pending) finish(false)
  const el = ensureDialog()
  el.querySelector('#confirm-dialog-title')!.textContent = options.title
  el.querySelector('p')!.textContent = options.message
  el.querySelector<HTMLButtonElement>('[data-confirm]')!.textContent = options.confirmLabel ?? 'OK'
  const cancel = el.querySelector<HTMLButtonElement>('[data-cancel]')!
  cancel.textContent = options.cancelLabel ?? 'Abbrechen'
  return new Promise((resolve) => {
    pending = resolve
    el.showModal()
    cancel.focus()
  })
}

function quotedNames(names: readonly string[]): string {
  return names.map((name) => `„${name}“`).join(', ')
}

function cleanedNames(names: string | readonly string[] | undefined): string[] {
  const list = Array.isArray(names) ? names : names ? [names] : []
  return list.map((name) => name.trim()).filter(Boolean)
}

/** Copy for full ride demolish. Names are shown when the ride has one. */
export function rideDemolishPrompt(
  kind: 'coaster' | 'course',
  names?: string | readonly string[],
): ConfirmDialogOptions {
  const singular = kind === 'coaster' ? 'Achterbahn' : 'Kurs'
  const plural = kind === 'coaster' ? 'Achterbahnen' : 'Kurse'
  const list = cleanedNames(names)
  const title = list.length > 1 ? `${list.length} ${plural} abreißen?` : `${singular} abreißen?`
  const subject = list.length === 0 ? `diese ${singular}` : quotedNames(list)
  const consequence =
    kind === 'coaster'
      ? 'Die ganze Bahn inkl. Station, Zugängen und Warteschlange wird entfernt.'
      : 'Der gesamte Kurs wird entfernt.'
  return {
    title,
    message: `${subject} wirklich vollständig abreißen? ${consequence}`,
    confirmLabel: 'Abreißen',
    cancelLabel: 'Abbrechen',
  }
}

/** True when a demolish-tool click would send `removeCoaster`, not a building or gate. */
export function wouldBulldozeRemoveCoaster(game: GameState, cell: DemolishCell): NamedRide | undefined {
  const buildingId =
    cell.buildingId ?? game.getAt(cell.x, cell.z, undefined, cell.localX, cell.localZ)?.id
  if (buildingId) return undefined
  if (game.getRideAccessAt(cell.x, cell.z)) return undefined
  const coaster = game.getRemovableCoasterAt(cell.x, cell.z)
  return coaster ? { id: coaster.id, name: coaster.name } : undefined
}

export function removableCoastersAtCells(
  game: GameState,
  cells: ReadonlyArray<{ x: number; z: number }>,
): NamedRide[] {
  const found = new Map<string, string>()
  for (const cell of cells) {
    const coaster = game.getRemovableCoasterAt(cell.x, cell.z)
    if (coaster) found.set(coaster.id, coaster.name)
  }
  return [...found].map(([id, name]) => ({ id, name }))
}
