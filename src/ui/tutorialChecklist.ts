import { TUTORIAL_PRESET_ID, tutorialSteps, type TutorialTarget } from '../game/tutorial'
import type { GameSnapshot } from '../game/types/snapshot'
import { escapeHtml } from './format'
import { t } from '../i18n'

/**
 * The first-steps checklist (A9): a small window top right that shows up only in the
 * „Erste Schritte“ scenario. Every step is read off the snapshot, so it ticks itself off
 * on the host and on guests alike; the next open step shows its hint. It folds down to
 * a button, and nothing about it is saved except what the game itself already saves.
 */
const HIGHLIGHT = 'tutorial-target'

function visible(element: HTMLElement | null): element is HTMLElement {
  return Boolean(element && element.isConnected && element.getClientRects().length > 0)
}

/**
 * The next control to press for a target: the first part of its path that is not open
 * yet (toolbar category, group tab, tool; or festival window, tab, button). Null when
 * the player is already on the last part, e.g. holds the right tool.
 */
function nextControl(target: TutorialTarget): HTMLElement | null {
  if (target.kind === 'build') {
    const category = document.querySelector<HTMLElement>(`.rct-toolbar [data-build-category="${target.category}"]`)
    if (!visible(category)) return null
    if (category.getAttribute('aria-expanded') !== 'true') return category
    const group = document.querySelector<HTMLElement>(`[data-build-group="${target.group}"]`)
    if (visible(group) && group.getAttribute('aria-pressed') !== 'true') return group
    const tool = document.querySelector<HTMLElement>(`.tool[data-tool="${target.tool}"]`)
    return visible(tool) && !tool.classList.contains('active') ? tool : null
  }
  const open = document.querySelector<HTMLElement>('#open-festival')
  if (!visible(open)) return null
  if (open.getAttribute('aria-expanded') !== 'true') return open
  const tab = document.querySelector<HTMLElement>(`.festival-tabs [data-tab="${target.tab}"]`)
  if (visible(tab) && tab.getAttribute('aria-pressed') !== 'true') return tab
  if (!target.action) return null
  const action = document.querySelector<HTMLButtonElement>(`[data-action="${target.action}"]`)
  return visible(action) && !action.disabled ? action : null
}

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
  let target: TutorialTarget | null = null
  let highlighted: HTMLElement | null = null
  let pending = 0
  // The glow sits on the next control of the open step and follows the player through
  // the menus; a folded checklist means the player wants no help, so it glows nowhere.
  const highlight = (): void => {
    pending = 0
    const next = active && !folded && target ? nextControl(target) : null
    if (next === highlighted) return
    highlighted?.classList.remove(HIGHLIGHT)
    next?.classList.add(HIGHLIGHT)
    highlighted = next
  }
  // Menus open without a snapshot change (also while paused), so clicks and keys
  // re-check the path one frame later, once the UI has reacted.
  const schedule = (): void => {
    if (!pending) pending = window.requestAnimationFrame(highlight)
  }
  document.addEventListener('click', schedule, true)
  document.addEventListener('keyup', schedule, true)
  const show = (): void => {
    panel.hidden = !active || folded
    reopen.hidden = !active || !folded
    schedule()
  }
  panel.querySelector('[data-tutorial-fold]')!.addEventListener('click', () => { folded = true; show() })
  reopen.addEventListener('click', () => { folded = false; show() })
  return {
    update(snapshot) {
      active = snapshot.scenario.preset === TUTORIAL_PRESET_ID
      show()
      if (!active) {
        target = null
        return
      }
      const steps = tutorialSteps(snapshot)
      const open = steps.find((step) => !step.done)
      target = open?.target ?? null
      schedule()
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
