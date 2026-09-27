/**
 * UI formatting helpers. They delegate to the text layer (src/i18n), so money, clocks and
 * save dates follow the viewer's language; German output is unchanged.
 */
export { escapeHtml } from '../i18n/html'
export { formatMoney, formatSaveTime, formatTime } from '../i18n/format'
