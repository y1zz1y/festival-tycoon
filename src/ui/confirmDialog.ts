import type { GameState } from '../game/GameState'
import { getLocale, joinList, localize, localizeName, t } from '../i18n'

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

/** One answer of a dialog with more than yes and no. */
export type DialogChoice = {
  id: string
  label: string
  /** `primary` is the suggested way on, `danger` the one that cannot be taken back. */
  tone?: 'primary' | 'danger'
}

export type ChoiceDialogOptions = {
  title: string
  message: string
  choices: DialogChoice[]
  cancelLabel?: string
}

let dialog: HTMLDialogElement | null = null
let pending: ((choice: string | null) => void) | null = null

function finish(choice: string | null): void {
  const resolve = pending
  pending = null
  dialog?.close()
  resolve?.(choice)
}

function ensureDialog(): HTMLDialogElement {
  if (dialog) return dialog
  dialog = document.createElement('dialog')
  dialog.className = 'confirm-dialog'
  dialog.setAttribute('aria-labelledby', 'confirm-dialog-title')
  dialog.innerHTML = '<h2 id="confirm-dialog-title"></h2><p></p><div class="confirm-dialog-actions"></div>'
  // Esc and the browser's own close both mean „Abbrechen“.
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault()
    finish(null)
  })
  dialog.addEventListener('close', () => {
    if (pending) finish(null)
  })
  document.body.append(dialog)
  return dialog
}

function choiceButton(label: string, attribute: string, choice: string | null): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.setAttribute(attribute, '')
  button.addEventListener('click', () => finish(choice))
  return button
}

/**
 * In-game modal with any number of answers plus „Abbrechen“ (also Esc). Resolves
 * with the chosen id, or null when cancelled. Same `<dialog>` pattern as save
 * import/export; the cancel button has the focus, so Enter never picks harm.
 * A display sink: title and message may be canonical German game text or already
 * translated UI text (localize is idempotent).
 */
export function chooseAction(options: ChoiceDialogOptions): Promise<string | null> {
  if (pending) finish(null)
  const el = ensureDialog()
  el.querySelector('#confirm-dialog-title')!.textContent = localize(options.title)
  el.querySelector('p')!.textContent = localize(options.message)
  const cancel = choiceButton(options.cancelLabel ?? t('Abbrechen'), 'data-cancel', null)
  el.querySelector('.confirm-dialog-actions')!.replaceChildren(
    ...options.choices.map((choice) =>
      choiceButton(choice.label, choice.tone === 'primary' ? 'data-primary' : 'data-confirm', choice.id)),
    cancel,
  )
  return new Promise((resolve) => {
    pending = resolve
    el.showModal()
    cancel.focus()
  })
}

/** In-game modal, same `<dialog>` pattern as save import/export. */
export function confirmAction(options: ConfirmDialogOptions): Promise<boolean> {
  return chooseAction({
    title: options.title,
    message: options.message,
    choices: [{ id: 'confirm', label: options.confirmLabel ?? t('OK'), tone: 'danger' }],
    cancelLabel: options.cancelLabel,
  }).then((choice) => choice === 'confirm')
}

/** Typographic quotes in the viewer's language: German „…“, English “…”. */
function quoted(text: string): string {
  return getLocale() === 'de' ? `„${text}“` : `“${text}”`
}

/** Ride names may be canonical defaults (`Holzachterbahn 2`), so they go through localizeName. */
function quotedNames(names: readonly string[]): string {
  return joinList(names.map((name) => quoted(localizeName(name))))
}

function cleanedNames(names: string | readonly string[] | undefined): string[] {
  const list = Array.isArray(names) ? names : names ? [names] : []
  return list.map((name) => name.trim()).filter(Boolean)
}

/** One full sentence per variant, so each language can order it its own way. */
const DEMOLISH_TEXT = {
  coaster: {
    one: () => t('Achterbahn abreißen?'),
    many: (count: number) => t`${count} Achterbahnen abreißen?`,
    unnamed: () => t('diese Achterbahn wirklich vollständig abreißen? Die ganze Bahn inkl. Station, Zugängen und Warteschlange wird entfernt.'),
    named: (names: string) => t`${names} wirklich vollständig abreißen? Die ganze Bahn inkl. Station, Zugängen und Warteschlange wird entfernt.`,
  },
  course: {
    one: () => t('Kurs abreißen?'),
    many: (count: number) => t`${count} Kurse abreißen?`,
    unnamed: () => t('diesen Kurs wirklich vollständig abreißen? Der gesamte Kurs wird entfernt.'),
    named: (names: string) => t`${names} wirklich vollständig abreißen? Der gesamte Kurs wird entfernt.`,
  },
}

/** Copy for full ride demolish. Names are shown when the ride has one. */
export function rideDemolishPrompt(
  kind: 'coaster' | 'course',
  names?: string | readonly string[],
): ConfirmDialogOptions {
  const text = DEMOLISH_TEXT[kind]
  const list = cleanedNames(names)
  return {
    title: list.length > 1 ? text.many(list.length) : text.one(),
    message: list.length === 0 ? text.unnamed() : text.named(quotedNames(list)),
    confirmLabel: t('Abreißen'),
    cancelLabel: t('Abbrechen'),
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
