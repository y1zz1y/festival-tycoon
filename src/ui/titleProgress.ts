import { ACHIEVEMENTS, type ProgressRecords, type ScenarioRecord } from '../game/progress'
import { escapeHtml } from './format'

/** The mark on a won scenario in the title list: a tick and its best stars. */
export function scenarioBadgeMarkup(record: ScenarioRecord | undefined): string {
  if (!record?.won) return ''
  const stars = Math.max(0, Math.min(5, record.bestStars))
  return `<span class="title-row-badge" title="Geschafft · beste Note ${record.bestScore} Punkte">✔ ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</span>`
}

const dateFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** Every achievement, unlocked ones first with their date, locked ones greyed. */
export function achievementRowsMarkup(records: ProgressRecords): string {
  const sorted = [...ACHIEVEMENTS].sort((left, right) => Number(records.achievements[left.id] === undefined) - Number(records.achievements[right.id] === undefined))
  return sorted.map((achievement) => {
    const at = records.achievements[achievement.id]
    const state = at === undefined ? 'locked' : 'unlocked'
    const meta = at === undefined ? escapeHtml(achievement.detail) : `${escapeHtml(achievement.detail)} · ${dateFormat.format(at)}`
    return `<div class="title-achievement" data-state="${state}"><span class="title-achievement-icon" aria-hidden="true">${at === undefined ? '🔒' : achievement.icon}</span><span class="title-row-text"><span class="title-row-label">${escapeHtml(achievement.name)}</span><span class="title-row-meta">${meta}</span></span></div>`
  }).join('')
}
