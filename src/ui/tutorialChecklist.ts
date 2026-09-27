import { TUTORIAL_PRESET_ID, tutorialSteps } from '../game/tutorial'
import type { GameSnapshot } from '../game/types/snapshot'
import { escapeHtml } from './format'
import { t } from '../i18n'

/**
 * The first-steps checklist (A9): a small window top right that shows up only in the
 * „Erste Schritte“ scenario. Every step is read off the snapshot, so it ticks itself off
 * on the host and on guests alike; the next open step shows its hint. It folds down to
 * a button, and nothing about it is saved except what the game itself already saves.
 */
export function mountTutorialChecklist(): { update(snapshot: Readonly<GameSnapshot>): void } {
  const shell = document.querySelector<HTMLElement>('.game-shell')
  if (!shell) return { update: () => undefined }
  const panel = document.createElement('aside')
  panel.className = 'tutorial-checklist panel'
  panel.hidden = true
  panel.setAttribute('aria-labelledby', 'tutorial-checklist-title')
  panel.innerHTML = `<div class="panel-header"><span class="panel-drag-line" aria-hidden="true"></span><h2 id="tutorial-checklist-title" class="panel-header-title">${t('Erste Schritte')}</h2><span class="panel-drag-line" aria-hidden="true"></span><button type="button" class="panel-close-button" data-tutorial-fold aria-label="${t('Checkliste einklappen')}">–</button></div><ol class="tutorial-steps"></ol><p class="tutorial-next scenario-hint"></p>`
  const reopen = document.createElement('button')
  reopen.type = 'button'
  reopen.className = 'tutorial-reopen'
  reopen.hidden = true
  reopen.textContent = `📋 ${t('Erste Schritte')}`
  shell.append(panel, reopen)
  const list = panel.querySelector<HTMLOListElement>('.tutorial-steps')!
  const next = panel.querySelector<HTMLElement>('.tutorial-next')!
  let folded = false
  let active = false
  let markup = ''
  const show = (): void => {
    panel.hidden = !active || folded
    reopen.hidden = !active || !folded
  }
  panel.querySelector('[data-tutorial-fold]')!.addEventListener('click', () => { folded = true; show() })
  reopen.addEventListener('click', () => { folded = false; show() })
  return {
    update(snapshot) {
      active = snapshot.scenario.preset === TUTORIAL_PRESET_ID
      show()
      if (!active) return
      const steps = tutorialSteps(snapshot)
      const open = steps.find((step) => !step.done)
      const html = steps.map((step) => `<li class="scenario-goal scenario-goal-${step.done ? 'done' : 'open'}"><span aria-hidden="true">${step.done ? '✔' : '○'}</span><span>${escapeHtml(step.title)}</span></li>`).join('')
      // Step titles and hints come translated from the client-text module game/tutorial.ts.
      const hint = open ? t`Als Nächstes: ${open.hint}` : t('Geschafft! Euer erstes Festival läuft. Die Checkliste kann jetzt eingeklappt werden.')
      if (html + hint === markup) return
      markup = html + hint
      list.innerHTML = html
      next.textContent = hint
    },
  }
}
