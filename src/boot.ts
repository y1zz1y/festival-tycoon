/**
 * Entry point (index.html). Fixes the language of this page load before any game module
 * runs: German needs nothing, English loads its catalog as a separate chunk first. Then
 * the game itself (main.ts) is imported. A promise chain rather than top-level await,
 * so the build target does not matter. If the catalog fails to load the game starts in
 * German instead of not at all. The build links main and its stylesheet from index.html
 * (server/bootPreloadPlugin.ts), so they download while this runs.
 */
import { setLocale } from './i18n'
import { detectLocale } from './i18n/locale'

const locale = detectLocale()
document.documentElement.lang = locale === 'en' ? 'en' : 'de'
const ready = locale === 'de'
  ? Promise.resolve()
  : import('./i18n/en').then(({ EN }) => setLocale(locale, EN))
void ready.catch(() => setLocale('de')).then(() => import('./main'))
// The pseudo-locale's leak detector; dev builds only, so production drops the import.
if (import.meta.env.DEV && locale === 'qps') {
  void import('./i18n/devLeaks').then(({ watchTextLeaks }) => watchTextLeaks())
}
