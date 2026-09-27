/**
 * HTML helpers for translated markup. Catalog keys hold plain text only, so markup
 * inside a sentence becomes a placeholder: t`… ${kbd('R')} dreht …`. The caller still
 * escapes user content that goes into HTML; catalog values never add `<`, `>`, `&` or `"`.
 */

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!,
  )
}

export function kbd(key: string): string {
  return `<kbd>${escapeHtml(key)}</kbd>`
}

/** Named codeTag, not code: dozens of local bindings are already called `code`. */
export function codeTag(text: string): string {
  return `<code>${escapeHtml(text)}</code>`
}

/** Identical `title` and `aria-label`, escaped: `<button ${tip(t('Schließen'))}>`. */
export function tip(text: string): string {
  const escaped = escapeHtml(text)
  return `title="${escaped}" aria-label="${escaped}"`
}
