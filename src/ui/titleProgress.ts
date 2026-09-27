import { ACHIEVEMENTS, type ProgressRecords, type ScenarioRecord } from '../game/progress'
import { escapeHtml } from './format'
import { joinParts, localeTag, localize, t } from '../i18n'

/** The mark on a won scenario in the title list: a tick and its best stars. */
export function scenarioBadgeMarkup(record: ScenarioRecord | undefined): string {
  if (!record?.won) return ''
  const stars = Math.max(0, Math.min(5, record.bestStars))
  return `<span class="title-row-badge" title="${joinParts(t('Geschafft'), t`beste Note ${record.bestScore} Punkte`)}">✔ ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</span>`
}

const dateFormats = new Map<string, Intl.DateTimeFormat>()

/** An unlock date in the viewer's convention (`24.12.2025` / `24/12/2025`). */
function formatUnlockDate(value: number): string {
  const tag = localeTag()
  let format = dateFormats.get(tag)
  if (!format) {
    format = new Intl.DateTimeFormat(tag, { day: '2-digit', month: '2-digit', year: 'numeric' })
    dateFormats.set(tag, format)
  }
  return format.format(value)
}

/** Every achievement, unlocked ones first with their date, locked ones greyed. Names are canonical German, shown translated. */
export function achievementRowsMarkup(records: ProgressRecords): string {
  const sorted = [...ACHIEVEMENTS].sort((left, right) => Number(records.achievements[left.id] === undefined) - Number(records.achievements[right.id] === undefined))
  return sorted.map((achievement) => {
    const at = records.achievements[achievement.id]
    const state = at === undefined ? 'locked' : 'unlocked'
    const detail = escapeHtml(localize(achievement.detail))
    const meta = at === undefined ? detail : joinParts(detail, formatUnlockDate(at))
    return `<div class="title-achievement" data-state="${state}"><span class="title-achievement-icon" aria-hidden="true">${at === undefined ? '🔒' : achievement.icon}</span><span class="title-row-text"><span class="title-row-label">${escapeHtml(localize(achievement.name))}</span><span class="title-row-meta">${meta}</span></span></div>`
  }).join('')
}
