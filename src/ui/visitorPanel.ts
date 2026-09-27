import { AUDIENCE_NAMES } from '../game/festivalManagement'
import { GENRES } from '../game/musicTaste'
import { INVENTORY_ITEMS } from '../game/inventory'
import { SHIRT_STYLE_LABELS } from '../game/shopGoods'
import type { GameState } from '../game/GameState'
import type { WorldView } from '../view/WorldView'
import { formatMoney, formatTime } from './format'
import { isCamper } from '../game/visitorNeeds'
import { getLocale, joinParts, localize, t } from '../i18n'

/** A visitor's thought in the viewer's quotation marks: „…“ in German, “…” in English. */
function quoted(text: string): string {
  return getLocale() === 'de' ? `„${text}“` : `“${text}”`
}

export interface VisitorPanelContext {
  getGame(): GameState
  getPreviewMode(): 'map' | 'front'
  view: WorldView
  closeEntityPanel(): void
}

export interface VisitorPanelController {
  hide(): void
  select(visitorId: string): void
  update(): void
}

export function mountVisitorPanel({ getGame, getPreviewMode, view, closeEntityPanel }: VisitorPanelContext): VisitorPanelController {
  const requireElement = <T extends Element>(selector: string): T => {
    const element = document.querySelector<T>(selector)
    if (!element) throw new Error(t`Benötigtes UI-Element fehlt: ${selector}`)
    return element
  }
  const visitorPanel = requireElement<HTMLElement>('#visitor-panel')
  const visitorName = requireElement<HTMLElement>('#visitor-name')
  const visitorThought = requireElement<HTMLElement>('#visitor-thought')
  const visitorState = requireElement<HTMLElement>('#visitor-state')
  const visitorBudget = requireElement<HTMLElement>('#visitor-budget')
  const visitorAlcoholDisposition = requireElement<HTMLElement>('#visitor-alcohol-disposition')
  const visitorCamping = requireElement<HTMLElement>('#visitor-camping')
  const visitorTicket = requireElement<HTMLElement>('#visitor-ticket')
  const visitorSleepRhythm = requireElement<HTMLElement>('#visitor-sleep-rhythm')
  const visitorInventory = requireElement<HTMLElement>('#visitor-inventory')
  const visitorCrowding = requireElement<HTMLElement>('#visitor-crowding')
  const visitorAttractiveness = requireElement<HTMLElement>('#visitor-attractiveness')
  const visitorParty = requireElement<HTMLElement>('#visitor-party')
  const visitorPreferences = requireElement<HTMLElement>('#visitor-preferences')
  const followVisitorButton = requireElement<HTMLButtonElement>('#follow-visitor')
  let selectedVisitorId: string | null = null
  let followedVisitorId: string | null = null

  function hide(): void {
    selectedVisitorId = null
    followedVisitorId = null
    view.followVisitor(null)
    view.setVisitorPreviewTarget(null)
    visitorPanel.classList.remove('visible')
  }
  
  function select(visitorId: string): void {
    selectedVisitorId = visitorId
    if (followedVisitorId) {
      followedVisitorId = visitorId
      view.followVisitor(visitorId)
    }
    closeEntityPanel()
    view.setVisitorPreviewTarget(visitorId)
    view.setVisitorPreviewMode(getPreviewMode())
    visitorPanel.classList.add('visible')
    update()
  }
  
  function update(): void {
    if (!selectedVisitorId) return
    const visitor = getGame().getVisitor(selectedVisitorId)
    if (!visitor) {
      if (followedVisitorId === selectedVisitorId) {
        followedVisitorId = null
        view.followVisitor(null)
      }
      selectedVisitorId = null
      view.setVisitorPreviewTarget(null)
      visitorPanel.classList.remove('visible')
      return
    }
    const isFollowing = followedVisitorId === visitor.id
    followVisitorButton.classList.toggle('active', isFollowing)
    followVisitorButton.setAttribute('aria-pressed', String(isFollowing))
    followVisitorButton.textContent = isFollowing
      ? `⏹ ${t('Verfolgung beenden')}`
      : `📍 ${t('Besucher verfolgen')}`
  
    const stateLabels = {
      entering: t('Betritt den Park'),
      exploring: t('Erkundet den Park'),
      seeking: t('Auf dem Weg zu einem Ziel'),
      using: t('Benutzt eine Attraktion'),
      queuing: t('Wartet an einer Achterbahn'),
      riding: t('Fährt Achterbahn'),
      sleeping: t('Schläft auf dem Boden'),
      camping: t('Am eigenen Zeltplatz'),
      socializing: t('Chillt auf dem Zeltplatz'),
      vomiting: t('Übergibt sich'),
      'security-check': t('Wird kontrolliert'),
      'medical-transport': t('Wird zum Krankenbereich gebracht'),
      medical: t('Wird medizinisch versorgt'),
      partying: t('Feiert zur Musik'),
      'bench-resting': t('Ruht sich auf einer Bank aus'),
      relaxing: t('Hält sich an einem Lieblingsort auf'),
      swimming: t('Baden im Wasser'),
      'camp-waiting': t('Wartet auf einen Campingplatz'),
      'vehicle-arrival': t('Sitzt im anreisenden Auto'),
      'bus-waiting': t('Wartet auf einen Bus'),
      'bus-riding': t('Fährt mit dem Bus'),
      injured: t('Wartet verletzt auf Hilfe'),
      exiting: t('Verlässt die Attraktion'),
      leaving: t('Verlässt den Park'),
      panicking: t('Flieht aus dem Gedränge'),
    }
    visitorName.textContent = visitor.name
    visitorThought.textContent = quoted(localize(visitor.thought))
    visitorState.textContent =
      visitor.streakingMinutes > 0
        ? t('Flitzt nackt über das Gelände')
        : stateLabels[visitor.state]
    visitorBudget.textContent = formatMoney(visitor.budget)
    requireElement<HTMLElement>('#visitor-music').textContent=GENRES.find(g=>g.id===visitor.musicTaste)?.name??t('Noch offen')
    requireElement<HTMLElement>('#visitor-audience').textContent = visitor.audience ? localize(AUDIENCE_NAMES[visitor.audience]) : t('Freies Spiel')
    visitorAlcoholDisposition.textContent =
      visitor.alcoholDisposition === 'aggressive' ? t('Eher aggressiv') : t('Eher ruhig')
    visitorCamping.textContent =
      visitor.campingPhase === 'none'
        ? t('Kein Zelt')
        : visitor.campingPhase === 'seeking'
          ? t('Auf dem Weg zur Parzelle')
          : visitor.campingPhase === 'building'
            ? t('Baut das Zelt auf')
            : visitor.campingPhase === 'packing'
              ? t('Packt das Zelt ein')
              : visitor.campingPhase === 'resting' || visitor.campingPhase === 'returning'
                ? t('Erholt sich im eigenen Zelt')
                : t('Zelt aufgebaut')
    visitorTicket.textContent =
      visitor.ticketType === 'camping' ? t('Campingpass') : t('Tageskarte')
    visitorSleepRhythm.textContent =
      `${formatTime(visitor.preferredBedtime)}–${formatTime(visitor.preferredWakeTime)}`
    visitorCrowding.textContent = `${Math.round(visitor.crowding)}%`
    visitorAttractiveness.textContent =
      `${Math.round(visitor.localAttractiveness)}%`
    visitorParty.textContent = `${Math.round(visitor.localPartyMood)}%`
    visitorPreferences.textContent =
      joinParts(t`Schönheit ${Math.round(visitor.beautyPreference * 100)}%`, t`Party ${Math.round(visitor.partyPreference * 100)}%`)
    visitorInventory.innerHTML =
      visitor.inventory.length > 0
        ? visitor.inventory
            .map((item) => {
              const definition = INVENTORY_ITEMS[item.kind]
              const deployed =
                item.kind === 'tent' &&
                visitor.campsite &&
                visitor.campingPhase !== 'seeking' &&
                visitor.campingPhase !== 'building'
                  ? t('aufgebaut')
                  : (item.kind === 'chairs' ||
                      item.kind === 'pavilion' ||
                      item.kind === 'musicBox') &&
                      getGame().snapshot.campInstallations.some(
                        (installation) =>
                          installation.kind === item.kind &&
                          installation.contributorIds.includes(visitor.id),
                      )
                    ? t('aufgestellt')
                    : ''
              const name = localize(definition.name)
              return `<span title="${joinParts(name, deployed)}">${definition.icon} ${joinParts(`${name} ×${item.quantity}`, deployed)}</span>`
            })
            .join('')
        : ''
    const souvenirBits: string[] = []
    if (visitor.ownedMascot) {
      souvenirBits.push(
        `<span title="${t('Maskottchen')}">🧸 ${visitor.heldMascot ? joinParts(t('Maskottchen'), t('in der Hand')) : t('Maskottchen')}</span>`,
      )
    }
    if (visitor.wornShirt) {
      souvenirBits.push(
        `<span title="${t('Festival-Shirt')}">👕 ${localize(SHIRT_STYLE_LABELS[visitor.wornShirt.style])}</span>`,
      )
    }
    visitorInventory.innerHTML =
      [visitorInventory.innerHTML, ...souvenirBits].filter(Boolean).join('') ||
      `<small>${t('Keine Gegenstände')}</small>`
  
    // Hygiene only drops for campers, so the row is shown for them alone.
    requireElement<HTMLElement>('#hygiene-row').hidden = !isCamper(visitor)
    const needKeys = ['hunger', 'toilet', 'thirst', 'hygiene', 'fun', 'energy'] as const
    needKeys.forEach((key) => {
      const value = Math.round(visitor.needs[key] ?? 100)
      const bar = requireElement<HTMLElement>(`#${key}-bar`)
      const output = requireElement<HTMLElement>(`#${key}-value`)
      bar.style.width = `${value}%`
      bar.dataset.level = value < 30 ? 'critical' : value < 60 ? 'warning' : 'good'
      output.textContent = `${value}%`
    })
    const alcoholValue = Math.round(visitor.alcoholLevel)
    const alcoholBar = requireElement<HTMLElement>('#alcohol-bar')
    const alcoholOutput = requireElement<HTMLElement>('#alcohol-value')
    alcoholBar.style.width = `${alcoholValue}%`
    alcoholBar.dataset.level =
      alcoholValue >= 70 ? 'critical' : alcoholValue >= 40 ? 'warning' : 'good'
    alcoholOutput.textContent = `${alcoholValue}%`
    const nauseaValue = Math.round(visitor.nausea)
    const nauseaBar = requireElement<HTMLElement>('#nausea-bar')
    const nauseaOutput = requireElement<HTMLElement>('#nausea-value')
    nauseaBar.style.width = `${nauseaValue}%`
    nauseaBar.dataset.level =
      nauseaValue >= 75 ? 'critical' : nauseaValue >= 40 ? 'warning' : 'good'
    nauseaOutput.textContent = `${nauseaValue}%`
    const motivationValue = Math.round(visitor.motivation)
    const motivationBar = requireElement<HTMLElement>('#motivation-bar')
    const motivationOutput = requireElement<HTMLElement>('#motivation-value')
    motivationBar.style.width = `${motivationValue}%`
    motivationBar.dataset.level =
      motivationValue < 25 ? 'critical' : motivationValue < 55 ? 'warning' : 'good'
    motivationOutput.textContent = `${motivationValue}%`
  }
  
  
  followVisitorButton.addEventListener('click', () => {
    if (!selectedVisitorId) return
    followedVisitorId = followedVisitorId === selectedVisitorId ? null : selectedVisitorId
    view.followVisitor(followedVisitorId)
    update()
  })
  document.querySelector<HTMLButtonElement>('#close-visitor')?.addEventListener('click', hide)

  return { hide, select, update }
}
