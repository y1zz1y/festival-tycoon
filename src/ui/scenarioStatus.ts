import type { GameSnapshot } from '../game/GameState'
import type { ScenarioSettings } from '../game/scenario'
import { goalName, goalProgressText } from '../game/scenarioGoalText'
import {
  scenarioScore,
  scenarioStars,
  scenarioSummary,
  type EditionResult,
  type GoalStatus,
  type ScenarioOutcome,
} from '../game/scenarioGoals'
import { escapeHtml, formatMoney } from './format'
import { formatNumber, formatPercent, joinParts, keep, plural, t, tc } from '../i18n'
import { scenarioDisplayName } from './scenarioScreen'

/**
 * The scenario as the player sees it: the goal count in the status bar, the
 * interim overview when an edition falls due, and the end screen once the
 * scenario is decided. All three read the snapshot the host sends, so every
 * player sees the same; only the host's buttons change anything.
 */
export type ScenarioStatusOptions = {
  /** Called once when the scenario goes from running to won or lost while being watched. */
  onDecided?: (snapshot: Readonly<GameSnapshot>) => void
  parkValue: () => number
  isMagazineOpen: () => boolean
  openFinance: () => void
  openPlanning: () => void
  resume: () => void
  restart: (settings: ScenarioSettings) => void
  toTitle: () => void
  isClient: () => boolean
}

export type ScenarioStatusController = {
  update: (snapshot: Readonly<GameSnapshot>) => void
  reset: () => void
  openEndScreen: () => void
}

const STATUS_MARK: Record<GoalStatus, string> = { done: '✔', failed: '✘', open: '○' }

const stars = (count: number): string => `${'★'.repeat(count)}${'☆'.repeat(Math.max(0, 5 - count))}`

/** One line per goal: its mark, what it asks, where it stands and its deadline. Goal texts come translated from the client-text goal module. */
export function goalListMarkup(snapshot: Readonly<GameSnapshot>, parkValue: number): string {
  return snapshot.scenario.goals
    .map((goal, index) => {
      const status = snapshot.scenarioProgress.status[index] ?? 'open'
      const progress = goalProgressText(goal, snapshot, { parkValue })
      return `<li class="scenario-goal scenario-goal-${status}"><span aria-hidden="true">${STATUS_MARK[status]}</span><span>${escapeHtml(goalName(goal))} <small>${t`bis zur ${goal.edition}. Ausgabe`} · ${escapeHtml(progress)}</small></span></li>`
    })
    .join('')
}

/** The editions played so far, one table row each. */
export function editionTableMarkup(editions: readonly EditionResult[]): string {
  if (editions.length === 0) return `<p class="scenario-empty">${t('Noch keine Ausgabe beendet.')}</p>`
  const rows = editions
    .map((result) => `<tr><th scope="row">${result.edition}.</th><td>${formatNumber(result.admissions)}</td><td>${formatPercent(result.satisfaction)}</td><td>${result.reputation}</td><td>${formatMoney(result.profit)}</td></tr>`)
    .join('')
  return `<table class="scenario-editions"><thead><tr><th scope="col">${tc('edition', 'Ausgabe')}</th><th scope="col">${t('Anreisen')}</th><th scope="col">${t('Zufriedenheit')}</th><th scope="col">${t('Ruf')}</th><th scope="col">${t('Bilanz')}</th></tr></thead><tbody>${rows}</tbody></table>`
}

function outcomeCaption(outcome: ScenarioOutcome): string {
  if (outcome.state === 'won') return t('Alle Ziele erreicht. Das Festival läuft weiter, solange ihr wollt.')
  if (outcome.reason === 'insolvent') return t('Das Konto blieb zu lange im Minus, und kein Kredit deckte es mehr.')
  return t('Ein Ziel wurde bis zu seiner Ausgabe nicht erreicht.')
}

/** The lede under the grade: verdict, then arrivals and the balance of every edition. */
function endLede(name: string, won: boolean, admissions: number, balance: number): string {
  const verdict = won ? t`${name} ist geschafft.` : t`${name} ist gescheitert.`
  const money = formatMoney(balance)
  const tally = plural(
    admissions,
    t`${admissions} Anreise, Bilanz aller Ausgaben ${money}.`,
    t`${admissions} Anreisen, Bilanz aller Ausgaben ${money}.`,
  )
  return `${verdict} ${tally}`
}

function endScreenMarkup(snapshot: Readonly<GameSnapshot>, parkValue: number, client: boolean): string {
  const progress = snapshot.scenarioProgress
  const outcome = progress.outcome
  const won = outcome.state === 'won'
  const score = scenarioScore(progress)
  const editions = progress.editions
  const admissions = editions.reduce((sum, result) => sum + result.admissions, 0)
  const balance = editions.reduce((sum, result) => sum + result.profit, 0)
  const name = escapeHtml(scenarioDisplayName(snapshot.scenario))
  const close = `<button type="button" data-end="close">${t('Schließen')}</button>`
  const toTitle = `<button type="button" data-end="title">${t('Zum Titel')}</button>`
  const verdictAfter = plural(editions.length, t`Das Fazit nach ${editions.length} Ausgabe`, t`Das Fazit nach ${editions.length} Ausgaben`)
  const actions = client
    ? `<span>${t('Der Host entscheidet, wie es weitergeht.')}</span>${close}`
    : won
      ? `<button type="button" data-end="resume">${t('Weiterspielen')}</button>${toTitle}`
      : `<button type="button" data-end="restart">${t('Neu starten')}</button>${toTitle}${close}`
  return `<header class="headline-magazine-masthead${won ? '' : ' scenario-end-lost'}">
      <p class="headline-magazine-kicker">${keep('Headliner Magazin')} · ${t('Sonderausgabe')}</p>
      <h1 id="scenario-end-title">${keep('HEADLINE')}</h1>
      <p class="headline-magazine-issue">${verdictAfter}</p>
      <p class="headline-magazine-date">${name} · ${t`Tag ${outcome.day ?? snapshot.day}`}</p>
    </header>
    <section class="headline-magazine-hero">
      <figure class="headline-magazine-cover">
        <span class="headline-magazine-stamp">${won ? t('Geschafft') : t('Gescheitert')}</span>
        <figcaption>${outcomeCaption(outcome)}</figcaption>
      </figure>
      <div class="headline-magazine-scorebox">
        <p class="headline-magazine-stars" aria-label="${t`${scenarioStars(score)} von 5 Sternen`}">${stars(scenarioStars(score))}</p>
        <p class="headline-magazine-note">${score}<small>${t('Punkte')} · ${t('Gesamtnote')}</small></p>
        <p class="headline-magazine-lede">${endLede(name, won, admissions, balance)}</p>
      </div>
    </section>
    <div class="headline-magazine-columns">
      <section class="headline-magazine-col headline-magazine-pro"><h2>${t('Ziele')}</h2><ul class="scenario-goal-list">${goalListMarkup(snapshot, parkValue)}</ul></section>
      <section class="headline-magazine-col"><h2>${tc('edition', 'Ausgaben')}</h2>${editionTableMarkup(editions)}</section>
    </div>
    <footer class="headline-magazine-footer">${actions}</footer>`
}

function dueOverviewMarkup(snapshot: Readonly<GameSnapshot>, parkValue: number): string {
  const progress = snapshot.scenarioProgress
  const summary = scenarioSummary(snapshot)
  const facts: [string, string][] = [
    [t('Tag'), String(snapshot.day)],
    [t('Gespielte Ausgaben'), String(progress.editions.length)],
    [t('Ziele erreicht'), t`${summary.done} von ${snapshot.scenario.goals.length}`],
    [t('Guthaben'), formatMoney(snapshot.money)],
  ]
  if (snapshot.finance.loan > 0) facts.push([t('Darlehen'), formatMoney(snapshot.finance.loan)])
  return `<p class="scenario-hint">${t('Die nächste Ausgabe ist fällig. Die Zeit steht, bis ihr sie startet. Bucht Bands und stellt Tickets ein, dann „Festival starten“.')}</p>
    <dl class="scenario-due-facts">${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
    <h3 class="scenario-heading">${t('Ziele')}</h3>
    <ul class="scenario-goal-list">${goalListMarkup(snapshot, parkValue)}</ul>
    <h3 class="scenario-heading">${t('Bisherige Ausgaben')}</h3>
    ${editionTableMarkup(progress.editions)}
    <div class="scenario-due-actions"><button type="button" data-due="plan">${t('Zur Planung')}</button></div>`
}

export function mountScenarioStatus(options: ScenarioStatusOptions): ScenarioStatusController {
  const goalStat = document.querySelector<HTMLElement>('#scenario-goals-stat')
  const goalText = document.querySelector<HTMLElement>('#scenario-goals')
  const goalButton = document.querySelector<HTMLButtonElement>('#open-scenario-goals')
  const shell = document.querySelector<HTMLElement>('.game-shell')
  if (!goalStat || !goalText || !goalButton || !shell) {
    return { update: () => undefined, reset: () => undefined, openEndScreen: () => undefined }
  }

  const endScreen = document.createElement('div')
  endScreen.id = 'scenario-end'
  endScreen.className = 'headline-magazine scenario-end'
  endScreen.hidden = true
  endScreen.setAttribute('role', 'dialog')
  endScreen.setAttribute('aria-modal', 'true')
  endScreen.setAttribute('aria-labelledby', 'scenario-end-title')
  const spread = document.createElement('article')
  spread.className = 'headline-magazine-spread'
  endScreen.append(spread)

  const due = document.createElement('aside')
  due.id = 'scenario-due'
  due.className = 'scenario-due panel'
  due.hidden = true
  due.setAttribute('role', 'dialog')
  due.setAttribute('aria-labelledby', 'scenario-due-title')
  due.innerHTML = `<div class="panel-header">
      <span class="panel-drag-line" aria-hidden="true"></span>
      <h2 id="scenario-due-title" class="panel-header-title">${t('Stichtag erreicht')}</h2>
      <span class="panel-drag-line" aria-hidden="true"></span>
      <button type="button" class="panel-close-button" data-due="close" aria-label="${t('Übersicht schließen')}">×</button>
    </div>
    <div class="scenario-due-body"></div>`
  const dueBody = due.querySelector<HTMLElement>('.scenario-due-body')!
  shell.append(endScreen, due)

  let snapshot: Readonly<GameSnapshot> | null = null
  // What the last update saw, so only changes open anything. Null until the first
  // look after loading: a scenario already decided in a save is no news.
  let seen: { outcome: ScenarioOutcome['state']; dueReminderDay: number | null } | null = null
  let endPending = false

  const openEndScreen = (): void => {
    if (!snapshot || snapshot.scenarioProgress.outcome.state === 'running') return
    spread.innerHTML = endScreenMarkup(snapshot, options.parkValue(), options.isClient())
    endScreen.hidden = false
    spread.querySelector<HTMLButtonElement>('[data-end]')?.focus()
  }
  const closeEndScreen = (): void => { endScreen.hidden = true }

  const openDue = (): void => {
    if (!snapshot) return
    dueBody.innerHTML = dueOverviewMarkup(snapshot, options.parkValue())
    due.hidden = false
    dueBody.querySelector<HTMLButtonElement>('[data-due="plan"]')?.focus()
  }
  const closeDue = (): void => { due.hidden = true }

  endScreen.addEventListener('click', (event) => {
    const action = (event.target as Element).closest<HTMLElement>('[data-end]')?.dataset.end
    if (!action || !snapshot) return
    closeEndScreen()
    if (action === 'resume') options.resume()
    else if (action === 'restart') options.restart(snapshot.scenario)
    else if (action === 'title') options.toTitle()
  })
  endScreen.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    closeEndScreen()
  })
  due.addEventListener('click', (event) => {
    if ((event.target as Element).closest('[data-due]')) closeDue()
  })
  due.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    closeDue()
  })
  goalButton.addEventListener('click', () => options.openFinance())

  const renderGoalStat = (current: Readonly<GameSnapshot>): void => {
    const goals = current.scenario.goals
    goalStat.hidden = goals.length === 0
    if (goals.length === 0) return
    const outcome = current.scenarioProgress.outcome.state
    const summary = scenarioSummary(current)
    const text = outcome === 'won' ? t('Geschafft') : outcome === 'lost' ? t('Gescheitert') : `${summary.done}/${goals.length}`
    if (goalText.textContent !== text) goalText.textContent = text
    goalStat.dataset.outcome = outcome
    const title = outcome === 'running'
      ? joinParts(t`Ziele: ${summary.done} von ${goals.length} erreicht`, t('im Finanzfenster ansehen'))
      : joinParts(outcome === 'won' ? t('Szenario geschafft') : t('Szenario gescheitert'), t('Fazit im Finanzfenster'))
    if (goalButton.title !== title) goalButton.title = title
  }

  return {
    update: (current) => {
      snapshot = current
      renderGoalStat(current)
      const progress = current.scenarioProgress
      const now = { outcome: progress.outcome.state, dueReminderDay: progress.dueReminderDay }
      const before = seen
      seen = now
      if (before) {
        if (before.outcome === 'running' && now.outcome !== 'running') {
          endPending = true
          closeDue()
          options.onDecided?.(current)
        }
        if (now.dueReminderDay !== null && now.dueReminderDay !== before.dueReminderDay && now.outcome === 'running') {
          options.openPlanning()
          openDue()
        }
      }
      // The HEADLINE issue of the deciding edition comes first; the verdict after it.
      if (endPending && !options.isMagazineOpen()) {
        endPending = false
        openEndScreen()
      }
    },
    reset: () => {
      seen = null
      endPending = false
      closeEndScreen()
      closeDue()
    },
    openEndScreen,
  }
}
