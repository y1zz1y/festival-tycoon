import type { GameSnapshot } from '../game/GameState'
import type { ScenarioSettings } from '../game/scenario'
import { scenarioPreset } from '../game/scenarioPresets'
import {
  goalName,
  goalProgressText,
  scenarioScore,
  scenarioStars,
  scenarioSummary,
  type EditionResult,
  type GoalStatus,
  type ScenarioOutcome,
} from '../game/scenarioGoals'
import { escapeHtml, formatMoney } from './format'

/**
 * The scenario as the player sees it: the goal count in the status bar, the
 * interim overview when an edition falls due, and the end screen once the
 * scenario is decided. All three read the snapshot the host sends, so every
 * player sees the same; only the host's buttons change anything.
 */
export type ScenarioStatusOptions = {
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

function scenarioName(snapshot: Readonly<GameSnapshot>): string {
  return scenarioPreset(snapshot.scenario.preset)?.name ?? 'Freies Spiel'
}

/** One line per goal: its mark, what it asks, where it stands and its deadline. */
export function goalListMarkup(snapshot: Readonly<GameSnapshot>, parkValue: number): string {
  return snapshot.scenario.goals
    .map((goal, index) => {
      const status = snapshot.scenarioProgress.status[index] ?? 'open'
      const progress = goalProgressText(goal, snapshot, { parkValue })
      return `<li class="scenario-goal scenario-goal-${status}"><span aria-hidden="true">${STATUS_MARK[status]}</span><span>${escapeHtml(goalName(goal))} <small>bis zur ${goal.edition}. Ausgabe · ${escapeHtml(progress)}</small></span></li>`
    })
    .join('')
}

/** The editions played so far, one table row each. */
export function editionTableMarkup(editions: readonly EditionResult[]): string {
  if (editions.length === 0) return '<p class="scenario-empty">Noch keine Ausgabe beendet.</p>'
  const rows = editions
    .map((result) => `<tr><th scope="row">${result.edition}.</th><td>${result.admissions.toLocaleString('de-DE')}</td><td>${result.satisfaction} %</td><td>${result.reputation}</td><td>${formatMoney(result.profit)}</td></tr>`)
    .join('')
  return `<table class="scenario-editions"><thead><tr><th scope="col">Ausgabe</th><th scope="col">Anreisen</th><th scope="col">Zufriedenheit</th><th scope="col">Ruf</th><th scope="col">Bilanz</th></tr></thead><tbody>${rows}</tbody></table>`
}

function outcomeCaption(outcome: ScenarioOutcome): string {
  if (outcome.state === 'won') return 'Alle Ziele erreicht. Das Festival läuft weiter, solange ihr wollt.'
  if (outcome.reason === 'insolvent') return 'Das Konto blieb zu lange im Minus, und kein Kredit deckte es mehr.'
  return 'Ein Ziel wurde bis zu seiner Ausgabe nicht erreicht.'
}

function endScreenMarkup(snapshot: Readonly<GameSnapshot>, parkValue: number, client: boolean): string {
  const progress = snapshot.scenarioProgress
  const outcome = progress.outcome
  const won = outcome.state === 'won'
  const score = scenarioScore(progress)
  const editions = progress.editions
  const admissions = editions.reduce((sum, result) => sum + result.admissions, 0)
  const balance = editions.reduce((sum, result) => sum + result.profit, 0)
  const name = escapeHtml(scenarioName(snapshot))
  const actions = client
    ? '<span>Der Host entscheidet, wie es weitergeht.</span><button type="button" data-end="close">Schließen</button>'
    : won
      ? '<button type="button" data-end="resume">Weiterspielen</button><button type="button" data-end="title">Zum Titel</button>'
      : '<button type="button" data-end="restart">Neu starten</button><button type="button" data-end="title">Zum Titel</button><button type="button" data-end="close">Schließen</button>'
  return `<header class="headline-magazine-masthead${won ? '' : ' scenario-end-lost'}">
      <p class="headline-magazine-kicker">Headliner Magazin · Sonderausgabe</p>
      <h1 id="scenario-end-title">HEADLINE</h1>
      <p class="headline-magazine-issue">Das Fazit nach ${editions.length} ${editions.length === 1 ? 'Ausgabe' : 'Ausgaben'}</p>
      <p class="headline-magazine-date">${name} · Tag ${outcome.day ?? snapshot.day}</p>
    </header>
    <section class="headline-magazine-hero">
      <figure class="headline-magazine-cover">
        <span class="headline-magazine-stamp">${won ? 'Geschafft' : 'Gescheitert'}</span>
        <figcaption>${outcomeCaption(outcome)}</figcaption>
      </figure>
      <div class="headline-magazine-scorebox">
        <p class="headline-magazine-stars" aria-label="${scenarioStars(score)} von 5 Sternen">${stars(scenarioStars(score))}</p>
        <p class="headline-magazine-note">${score}<small>Punkte · Gesamtnote</small></p>
        <p class="headline-magazine-lede">${name} ${won ? 'ist geschafft' : 'ist gescheitert'}. ${admissions.toLocaleString('de-DE')} Anreisen, Bilanz aller Ausgaben ${formatMoney(balance)}.</p>
      </div>
    </section>
    <div class="headline-magazine-columns">
      <section class="headline-magazine-col headline-magazine-pro"><h2>Ziele</h2><ul class="scenario-goal-list">${goalListMarkup(snapshot, parkValue)}</ul></section>
      <section class="headline-magazine-col"><h2>Ausgaben</h2>${editionTableMarkup(editions)}</section>
    </div>
    <footer class="headline-magazine-footer">${actions}</footer>`
}

function dueOverviewMarkup(snapshot: Readonly<GameSnapshot>, parkValue: number): string {
  const progress = snapshot.scenarioProgress
  const summary = scenarioSummary(snapshot)
  const facts: [string, string][] = [
    ['Tag', String(snapshot.day)],
    ['Gespielte Ausgaben', String(progress.editions.length)],
    ['Ziele erreicht', `${summary.done} von ${snapshot.scenario.goals.length}`],
    ['Guthaben', formatMoney(snapshot.money)],
  ]
  if (snapshot.finance.loan > 0) facts.push(['Darlehen', formatMoney(snapshot.finance.loan)])
  return `<p class="scenario-hint">Die nächste Ausgabe ist fällig. Die Zeit steht, bis ihr sie startet. Bucht Bands und stellt Tickets ein, dann „Festival starten“.</p>
    <dl class="scenario-due-facts">${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
    <h3 class="scenario-heading">Ziele</h3>
    <ul class="scenario-goal-list">${goalListMarkup(snapshot, parkValue)}</ul>
    <h3 class="scenario-heading">Bisherige Ausgaben</h3>
    ${editionTableMarkup(progress.editions)}
    <div class="scenario-due-actions"><button type="button" data-due="plan">Zur Planung</button></div>`
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
      <h2 id="scenario-due-title" class="panel-header-title">Stichtag erreicht</h2>
      <span class="panel-drag-line" aria-hidden="true"></span>
      <button type="button" class="panel-close-button" data-due="close" aria-label="Übersicht schließen">×</button>
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
    const text = outcome === 'won' ? 'Geschafft' : outcome === 'lost' ? 'Gescheitert' : `${summary.done}/${goals.length}`
    if (goalText.textContent !== text) goalText.textContent = text
    goalStat.dataset.outcome = outcome
    const title = outcome === 'running'
      ? `Ziele: ${summary.done} von ${goals.length} erreicht · im Finanzfenster ansehen`
      : `Szenario ${outcome === 'won' ? 'geschafft' : 'gescheitert'} · Fazit im Finanzfenster`
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
