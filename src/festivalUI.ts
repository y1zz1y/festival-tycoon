import { mountMusicPlanner, musicOverview } from './musicPlanner'
import type { GameState, GameSnapshot } from './game/GameState'
import { makeDraggable, makeResizable } from './dragPanel'
import './festival.css'
import { AUDIENCES, AUDIENCE_NAMES, SUPPLIES, TIERED_UPGRADES, UPGRADES, upgradeLevel, WEATHER_ICONS, WEATHER_NAMES, audienceMix, forecast, temperatureAt, festivalTime } from './game/festivalManagement'
import type { FestivalAction, Supply, TieredUpgrade, Upgrade } from './game/festivalManagement'
import { mountHeadlineMagazine } from './headlineMagazineUI'
import { estimateTicketDemand } from './game/ticketDemand'
import { clockText, stormAt, type StormPhase, type StormPlan } from './game/storm'
import { type SponsorContract } from './game/sponsors'
import { SPONSOR_CONDITION_TEXT } from './game/sponsorText'
import { SIMULATION_CONFIG } from './game/simulationConfig'
import { COMMAND_QUEUED } from './game/sentinels'
import { formatMoney, formatNumber, formatRange, formatTemperature, joinParts, keep, localize, plural, t, tc } from './i18n'

type Snapshot = Readonly<GameSnapshot>
type Festival = Snapshot['festival']

const money = (n: number) => formatMoney(Math.round(n))
/** Supply prices below one euro keep their cents. */
const unitPrice = (n: number) => formatMoney(n, Number.isInteger(n) ? 0 : 2)
const clock = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`
const meter = (label: string, n: number) => `<label class="festival-meter">${label}<strong>${Math.round(n)}%</strong><progress max="100" value="${n}"></progress></label>`
const strong = (n: number) => `<strong>${formatNumber(n)}</strong>`

/** One line about the storm that matters now. */
function stormLine(storm: { phase: StormPhase; storm?: StormPlan }, sheltered?: boolean): string {
  if (!storm.storm) return ''
  const window = formatRange(clockText(storm.storm.start), clockText(storm.storm.end))
  const now = storm.phase === 'warning'
    ? t`Unwetterwarnung: Gewitter ${window}`
    : t`Gewitter über dem Gelände bis ${clockText(storm.storm.end)}`
  return joinParts(now, sheltered && t('Schutz angeordnet'))
}

/** Wetter & Vorsorge: the storm now, the order to take shelter, and the edition's storms. */
function stormPaneMarkup(s: Snapshot): string {
  const f = s.festival
  const storm = stormAt(f, s.day, s.minute)
  const planned = (f.enabled && !f.finished ? f.storms ?? [] : []).filter((entry) => entry.day * 1440 + entry.end > s.day * 1440 + s.minute)
  const stats = f.stormStats
  const now = storm.phase === 'none'
    ? `<p>${t('Gerade droht kein Unwetter.')}</p>`
    : `<p class="festival-storm-line">⛈️ ${stormLine(storm, f.shelterOrder)}</p><button type="button" data-shelter ${f.shelterOrder ? 'disabled' : ''}>${f.shelterOrder ? t('Schutz angeordnet') : t('Schutz anordnen')}</button>`
  const warned = planned.filter((entry) => entry.day === s.day || entry.day === s.day + 1)
  const forecastLine = warned.length ? `<p>${t`Vorhersage: ${joinParts(...warned.map((entry) => `${t`Tag ${entry.day}`} ${formatRange(clockText(entry.start), clockText(entry.end))}`))}`}</p>` : ''
  const statsLine = stats ? `<p>${joinParts(t`Überstanden: ${stats.weathered}`, t`ohne Verletzte: ${stats.calm}`)}</p>` : ''
  return `<article><h3>${t('Unwetter')}</h3>${now}<p>${t`Ein Gewitter wird ${SIMULATION_CONFIG.storm.warningMinutes} Minuten vorher angekündigt. Solange es tobt, ruhen alle Auftritte; wer im Freien bleibt, wird nass, müde und kann stürzen. „Schutz anordnen“ pausiert die Auftritte sofort und senkt das Risiko deutlich. Ohne Sturmsicherung kann ein Blitz Bühne, Lichtmasten oder Türme in Brand setzen.`}</p>${forecastLine}${statsLine}</article>`
}

function sponsorState(contract: SponsorContract): string {
  if (contract.status === 'fulfilled') return `✔ ${t('erfüllt, Bonus gezahlt')}`
  if (contract.status === 'failed') return `✘ ${t('verfehlt, Vorschuss zurück')}`
  return contract.status === 'signed' ? t('Unterschrieben') : ''
}

function sponsorCard(contract: SponsorContract, action: string): string {
  const condition = SPONSOR_CONDITION_TEXT[contract.condition](contract.target)
  const state = sponsorState(contract)
  return `<article><h3>${contract.sponsor}</h3><p>${t`Bedingung: ${condition}`}</p><p>${joinParts(t`Vorschuss ${formatMoney(contract.advance)}`, t`Bonus ${formatMoney(contract.bonus)}`)}</p>${state ? `<p><strong>${state}</strong></p>` : ''}${action}</article>`
}

/** Sponsoren: signed contracts and, before the start, the offers for this edition. */
function sponsorPaneMarkup(s: Snapshot): string {
  const f = s.festival
  const canSign = !(f.enabled && !f.finished)
  const signed = (f.sponsors ?? []).map((contract) => sponsorCard(contract, ''))
  const offers = canSign ? (f.sponsorOffers ?? []).map((contract) => sponsorCard(contract, `<button type="button" data-sponsor="${contract.id}">${t('Unterschreiben')}</button>`)) : []
  if (!signed.length && !offers.length) return `<p class="festival-empty">${canSign ? t('Neue Angebote kommen, sobald die nächste Ausgabe geplant wird.') : t('Für diese Ausgabe wurde kein Sponsor verpflichtet.')}</p>`
  return [...signed, ...offers].join('')
}

/** The toolbar button is icon-only; its tooltip carries the festival's state. */
function festivalButtonLabel(s: Snapshot): string {
  const f = s.festival
  if (!f.enabled) return t('Festival planen')
  if (f.finished) return joinParts(t('Festival'), t('Ergebnis'))
  return joinParts(t('Festival'), localize(WEATHER_NAMES[f.weather]), formatTemperature(temperatureAt(f, s.day, s.minute / 60, f.weather)))
}

function festivalPhase(s: Snapshot): string {
  const f = s.festival
  if (f.finished) return t('Abgeschlossen')
  if (s.day < f.startDay + s.dayPlan.leadDays) return t('Vorbereitung')
  return t`Festivaltag ${s.day - f.startDay - s.dayPlan.leadDays + 1}/${s.dayPlan.festivalDays}`
}

function festivalStatus(s: Snapshot): string {
  const f = s.festival
  const heading = f.enabled
    ? joinParts(t`Ausgabe ${f.edition}`, festivalPhase(s))
    : f.planning ? joinParts(t('Planung'), t('Zeit angehalten')) : t('Freies Spiel')
  return `<strong>${heading}</strong><span>${joinParts(t`Tag ${s.day}`, clock(s.minute), t`Budget ${money(s.money)}`)}</span>`
}

function parkToggleLabel(s: Snapshot, locked: boolean): string {
  if (locked) return t('Zugang steuert das Festival')
  return s.parkOpen ? t('Park schließen') : t('Park öffnen')
}

function campingSummary(s: Snapshot, capacity: number, occupied: number): string {
  const f = s.festival
  const cells = s.campingCells.length
  const counts = joinParts(
    plural(cells, t`${cells} Campingfeld`, t`${cells} Campingfelder`),
    t`${capacity} buchbar nach ${s.dayPlan.campingCapacityBufferPercent}% Reserve`,
    t`${occupied} belegt`,
    t`${Math.max(0, capacity - occupied)} frei.`,
  )
  const quota = f.tickets
    ? `${t`Geplant: ${f.tickets.camping}/${capacity} Campingplätze (${capacity ? Math.round(f.tickets.camping / capacity * 100) : 0}%).`} ${joinParts(t`Angereist: ${f.tickets.usedCamping} Camper`, t`${f.tickets.usedDay[s.day] ?? 0}/${f.tickets.day} Tagesgäste heute.`)}`
    : t('Noch kein Kontingent festgelegt: bisheriger Besucherzulauf. Übernehmt eure Ticketzahlen vor dem Start.')
  return `${counts}<br>${quota} ${t('Die Kontingente begrenzen die Anreisen; Einlasszeiten und Nachfrage gelten weiterhin. Bezahlung erfolgt bei Anreise.')}`
}

function lineupAdvice(s: Snapshot): string {
  const bookings = s.festival.bookings.length
  if (!s.buildings.some(b => b.kind === 'stage')) return t('Baut eine Bühne mit Stromversorgung und Bühnenvorplatz.')
  if (!bookings) return t('Noch kein Programm gebucht: Ohne Bands bleibt die Nachfrage gering.')
  return plural(bookings, t`${bookings} Auftritt gebucht. Technische Anforderungen und Tagesplan prüfen.`, t`${bookings} Auftritte gebucht. Technische Anforderungen und Tagesplan prüfen.`)
}

function summaryMarkup(s: Snapshot): string {
  const f = s.festival
  const mix = audienceMix(f)
  const storm = stormAt(f, s.day, s.minute)
  const weatherNow = `<span class="weather-icon" aria-hidden="true">${WEATHER_ICONS[f.weather]}</span>${localize(WEATHER_NAMES[f.weather])}`
  const goals = `<article><h3>${t('Ziele dieses Wochenendes')}</h3><p>${t`${f.admissions} / ${f.goals.guests} Anreisen`}</p><p>${joinParts(t`Zufriedenheit ≥ ${f.goals.satisfaction}%`, t`Gesamtbilanz ≥ ${money(f.goals.profit)}`)}</p><p>${t`Vorbereitung: Tag ${f.startDay}`}<br>${t`Festival: Tag ${f.startDay + s.dayPlan.leadDays} bis ${f.startDay + s.dayPlan.leadDays + s.dayPlan.festivalDays - 1}`}</p></article>`
  const audience = `<article><h3>${t('Erwartetes Publikum')}</h3>${AUDIENCES.map(key => meter(localize(AUDIENCE_NAMES[key]), mix[key] * 100)).join('')}</article>`
  const supplies = f.supplies.food < 100 || f.supplies.drinks < 100 ? t('Vorräte werden knapp – Nachschub bestellen.') : t('Lieferungen frühzeitig vor großen Auftritten einplanen.')
  const watch = `<article><h3>${t('Worauf ihr achten solltet')}</h3><p>${lineupAdvice(s)}</p>${storm.phase !== 'none' ? `<p class="festival-storm-line">⛈️ ${stormLine(storm, f.shelterOrder)}</p>` : ''}<p>${joinParts(t`Aktuell: ${weatherNow}`, formatTemperature(temperatureAt(f, s.day, s.minute / 60, f.weather)), t`Bodennässe ${Math.round(f.wetness)}%`)}</p><p>${supplies}</p></article>`
  return `<div class="festival-grid">${goals}${audience}${watch}</div>`
}

function deliveryStatus(s: Snapshot, d: Festival['deliveries'][number]): string {
  const trucks = s.festival.infrastructure.trucks
  if (festivalTime(s) < d.due) return joinParts(t`Versand ab Tag ${Math.floor(d.due / 1440)}`, clock(d.due % 1440))
  if (trucks.some(truck => truck.deliveryId === d.id && truck.z < -s.scenario.worldSize / 2)) return t('Wartet auf freie Einfahrt am Kartenrand')
  if (trucks.some(truck => truck.deliveryId === d.id)) return t('Lastwagen fährt zum Depot')
  if (d.remaining > 0) {
    const minutes = Math.ceil(d.remaining)
    return joinParts(t('Anfahrt zum Kartenrand'), plural(minutes, t`${minutes} Minute`, t`${minutes} Minuten`))
  }
  return t('Wartet auf freie Zufahrt zum Depot')
}

function deliveriesMarkup(s: Snapshot): string {
  const f = s.festival
  const { depots, trucks, routes } = f.infrastructure
  const fleet = joinParts(
    plural(depots.length, t`${depots.length} Depot`, t`${depots.length} Depots`),
    plural(trucks.length, t('1 Lastwagen'), t`${trucks.length} Lastwagen`),
    plural(routes.length, t('1 Träger.'), t`${routes.length} Träger.`),
  )
  const rows = f.deliveries.map(d => `<article class="festival-booking"><strong>${d.quantity} × ${localize(SUPPLIES[d.kind].name)}</strong><span>${deliveryStatus(s, d)}</span></article>`).join('')
  return `<p>${fleet} ${t('Bestellungen hier gehen an das erste Depot.')}</p>${rows || `<p>${t('Keine Lieferungen unterwegs.')}</p>`}`
}

function forecastMarkup(s: Snapshot): string {
  const f = s.festival
  // Each six-hour slot reads as a row: the hours on the left, the weather on the right
  // with its own sign in front of the name, so a day can be skimmed without reading it.
  return [0, 1, 2].map(offset => `<article><h3>${t`Tag ${s.day + offset}`}</h3>${[0, 6, 12, 18].map(hour => {
    const weather = forecast(f, s.day + offset, hour)
    // The window's middle hour stands for the whole six of them.
    const celsius = temperatureAt(f, s.day + offset, hour + 3, weather)
    return `<p class="festival-forecast-slot"><span>${String(hour).padStart(2, '0')}:00–${hour + 6}:00</span><strong><span class="weather-icon" aria-hidden="true">${WEATHER_ICONS[weather]}</span>${localize(WEATHER_NAMES[weather])}<span class="forecast-degrees">${formatTemperature(celsius)}</span></strong></p>`
  }).join('')}</article>`).join('')
}

function upgradesMarkup(f: Festival): string {
  // The stepped upgrades stand among the one-off ones, each showing the step it is on
  // and what the next one costs.
  const tiered = Object.entries(TIERED_UPGRADES).map(([key, upgrade]) => {
    const level = upgradeLevel(f, key as TieredUpgrade)
    const next = upgrade.steps[level]
    const carried = level > 0 ? upgrade.steps[level - 1]!.factor : 1
    return `<article><h3>${localize(upgrade.name)}</h3><p>${localize(upgrade.detail)}</p><p class="festival-upgrade-level">${joinParts(t`Stufe ${level}/${upgrade.steps.length}`, t`Ladung ×${carried}`)}</p><button data-upgrade-step="${key}" ${next ? '' : 'disabled'}>${next ? joinParts(t`Ausbauen auf ×${next.factor}`, money(next.cost)) : t('Höchste Stufe')}</button></article>`
  }).join('')
  return Object.entries(UPGRADES).map(([key, upgrade]) => `<article><h3>${localize(upgrade.name)}</h3><p>${localize(upgrade.detail)}</p><button data-upgrade="${key}" ${f.upgrades[key as Upgrade] ? 'disabled' : ''}>${f.upgrades[key as Upgrade] ? t('Vorhanden') : joinParts(t('Einrichten'), money(upgrade.cost))}</button></article>`).join('') + tiered
}

function reputationMarkup(f: Festival): string {
  const labels: Record<string, string> = { music: t('Musik'), atmosphere: t('Atmosphäre'), comfort: t('Komfort'), organization: t('Organisation') }
  return Object.entries(f.reputation).map(([key, value]) => `<article>${meter(labels[key]!, value)}</article>`).join('')
}

function reportTips(r: Festival['reports'][number]): string {
  return [
    r.stockouts && t('Mehr Vorräte und frühere Lieferungen helfen gegen Ausverkäufe.'),
    r.weatherImpact > 100 && t('Überdachung und Trinkwasser verbessern den Wetterschutz.'),
    r.satisfaction < 65 ? t('Bedürfnisse, Ruhe und Erreichbarkeit prüfen.') : t('Die Gäste waren überwiegend zufrieden.'),
  ].filter(Boolean).join(' ')
}

function reportMarkup(f: Festival, r: Festival['reports'][number]): string {
  const concerts = Math.round(r.concerts)
  const totals = joinParts(plural(r.guests, t`${r.guests} Anreise`, t`${r.guests} Anreisen`), t`Zufriedenheit ${Math.round(r.satisfaction)}%`, t`Tagesbilanz ${money(r.balance)}`)
  const effects = joinParts(
    plural(concerts, t`${concerts} Besucher-Konzertminute`, t`${concerts} Besucher-Konzertminuten`),
    plural(r.stockouts, t`${r.stockouts} gescheiterter Kauf`, t`${r.stockouts} gescheiterte Käufe`),
    t`Wetterbelastung ${Math.round(r.weatherImpact)}`,
  )
  return `<article class="festival-booking"><div><h3>${joinParts(t`Tag ${r.day}`, r.day === f.startDay && t('Vorbereitung'))}</h3><p>${totals}</p><p>${effects}</p><small>${reportTips(r)}</small></div></article>`
}

function reportsMarkup(s: Snapshot): string {
  const f = s.festival
  const festivalReports = f.reports.filter(r => r.day >= f.startDay + s.dayPlan.leadDays)
  const average = festivalReports.length ? festivalReports.reduce((sum, r) => sum + r.satisfaction, 0) / festivalReports.length : 0
  const balance = f.reports.reduce((sum, r) => sum + r.balance, 0)
  const success = f.admissions >= f.goals.guests && average >= f.goals.satisfaction && balance >= f.goals.profit
  const result = f.finished ? `<article class="festival-result"><h3>${success ? t('Wochenendziele erreicht!') : t('Wochenende abgeschlossen – hier liegt euer nächstes Verbesserungspotenzial')}</h3><p>${joinParts(t`${f.admissions}/${f.goals.guests} Anreisen`, t`Zufriedenheit ${Math.round(average)}/${f.goals.satisfaction}%`, t`Bilanz ${money(balance)}`)}</p><p>${t('Mit dem behaltenen Gelände, den Ausbauten und eurem Ruf könnt ihr die nächste Ausgabe planen.')}</p><p><button type="button" data-magazine-open>${t`${keep('HEADLINE')} Magazin aufschlagen`}</button></p></article>` : ''
  return `${result}${f.reports.map(r => reportMarkup(f, r)).join('') || `<p class="festival-empty">${t('Die erste Abrechnung erscheint nach Mitternacht. Das Festival endet nach den geplanten Festivaltagen.')}</p>`}`
}

function panelMarkup(): string {
  const tabs: [string, string][] = [['overview', t('Übersicht')], ['dayplan', t('Tagesplan')], ['lineup', t('Bands & Spielplan')], ['supply', t('Lager & Lieferungen')], ['prepare', t('Wetter & Vorsorge')], ['sponsors', t('Sponsoren')], ['upgrades', t('Upgrades')], ['reports', t('Abrechnung & Ruf')]]
  return `<div class="festival-chrome"><header class="festival-heading panel-header"><span class="panel-drag-line" aria-hidden="true"></span><h2 id="festival-title" class="panel-header-title">${t('Das Festivalwochenende')}</h2><span class="panel-drag-line" aria-hidden="true"></span><button data-close class="panel-close-button" aria-label="${t('Festivalverwaltung schließen')}">×</button></header>
    <div class="festival-status" aria-live="polite"></div>
    <nav class="festival-tabs" aria-label="${t('Festivalbereiche')}">${tabs.map(([id, label]) => `<button data-tab="${id}" aria-pressed="${id === 'overview'}">${label}</button>`).join('')}</nav></div>
    <section data-pane="overview"><div class="festival-intro"><h3>${t('Ein Gelände. Ein Wochenende. Euer Publikum.')}</h3><p>${t('Vorlauf und Festivaltage legt ihr im Reiter Tagesplan fest. Erst mit dem Start läuft die Festivalzeit. Bucht ein Programm, versorgt eure Gäste und entscheidet, welche Reserven ihr euch leisten könnt. Das vorhandene Gelände und Budget werden übernommen.')}</p><button data-action="start">${t('Festival starten')}</button><button data-action="sandbox">${t('Freies Spiel fortsetzen')}</button></div><div class="festival-park-gate"><h3>${t('Gelände öffnen und schließen')}</h3><p>${t('Im freien Spiel schließt ihr das Gelände für neue Gäste. Wer schon da ist, reist ab. Während der Festivalplanung und nach dem Wochenende steuert das Festival den Zugang selbst.')}</p><button type="button" data-park-toggle>${t('Park schließen')}</button></div><form data-ticket-prices class="festival-form festival-price-sliders"><label>${t('Preis Tagesticket')}<input name="dayTicketPrice" type="range" min="20" max="250" step="5" value="120"><output data-day-price>${formatMoney(120)}</output></label><label>${t('Preis Campingticket')}<input name="campTicketPrice" type="range" min="40" max="500" step="5" value="260"><output data-camp-price>${formatMoney(260)}</output></label><p data-ticket-estimate></p><button>${t('Preise übernehmen')}</button></form><form data-tickets class="festival-form"><label>${t('Tagestickets je Festivaltag')}<input name="dayTickets" type="number" min="0" max="100000" value="150" required></label><label>${t('Campingtickets für die gesamte Ausgabe')}<input name="campTickets" type="number" min="0" max="100000" value="0" required></label><button>${t('Kontingente übernehmen')}</button></form><p data-camping-summary></p><div data-music-overview></div><div data-summary></div></section>
    <section data-pane="dayplan" hidden>
      <p>${t('Vorlauf, Festivaltage und Angebotszeiten gelten für das ganze Gelände. Tagesgäste dürfen nur im eingestellten Fenster bleiben.')}</p>
      <div class="festival-cycle-controls">
        <label>${t('Vorlauf')} <input id="festival-lead-days" type="number" min="0" max="14" /></label>
        <label>${t('Festival')} <input id="festival-active-days" type="number" min="1" max="14" /></label>
        <label>${tc('cycle', 'Pause')} <input id="festival-break-days" type="number" min="1" max="30" /></label>
        <label>${t('Camping-Abschlag')} <input id="camping-capacity-buffer" type="number" min="0" max="50" />%</label>
        <button id="apply-festival-cycle" type="button">${t('Zyklus übernehmen')}</button>
      </div>
      <div id="festival-cycle-strip" class="festival-cycle-strip"></div>
      <small id="camping-capacity-summary" class="camping-capacity-summary"></small>
      <div class="day-visitor-window">
        <label>${t('Tagesgäste ab')} <select id="day-entry-hour"></select></label>
        <label>${t('müssen gehen bis')} <select id="day-exit-hour"></select></label>
        <small>${t('Mindestens eine Stunde täglich bleibt für Tagesgäste geschlossen.')}</small>
      </div>
      <div class="day-plan-scroll">
        <div id="day-plan-grid" class="day-plan-grid"></div>
      </div>
      <p id="day-plan-status" class="day-plan-status"></p>
    </section>
    <section data-pane="lineup" hidden><p>${t('Gagen werden sofort bezahlt. Jede Bühne benötigt Strom und einen erreichbaren Bühnenvorplatz. Zwischen Auftritten liegen 30 Minuten Umbauzeit. Stornierung vor Beginn erstattet 50 %. Leere Slots könnt ihr automatisch füllen lassen; vorhandene Buchungen bleiben erhalten.')}</p>
      <details><summary>${t('Besucherbasis & Genreverteilung vergleichen')}</summary><div data-lineup-mix></div></details><div data-music-planner></div></section>
    <section data-pane="supply" hidden><p>${t`Waren werden am Kartenrand angeliefert und per Lastwagen zur Anlieferung gebracht. Träger versorgen Depots und Stände automatisch. Anlieferung, Depots und Personaltore baut ihr im Baumenü unter Logistik; Mindestbestände und Träger stellt ihr im Infofenster oder im Reiter Waren & Träger ein. Jede Lieferung kostet zusätzlich ${formatMoney(45)}.`}</p><div data-stock class="festival-grid"></div>
      <form data-order class="festival-form"><label>${t('Ware')}<select name="kind">${Object.entries(SUPPLIES).map(([key, item]) => `<option value="${key}">${joinParts(localize(item.name), t`${unitPrice(item.price)}/Einheit`)}</option>`).join('')}</select></label><label>${t('Menge')}<input name="quantity" type="number" min="50" max="2000" step="50" value="200" required></label><label>${t('Versandfenster')}<select name="delay"><option value="0">${t('Jetzt')}</option><option value="360">${t('In 6 Stunden')}</option><option value="720">${t('In 12 Stunden')}</option></select></label><button type="submit">${t('Kostenpflichtig bestellen')}</button></form><div data-deliveries></div></section>
    <section data-pane="prepare" hidden><div data-storm class="festival-storm"></div><div data-forecast class="festival-grid"></div><p>${t('Die Sechs-Stunden-Vorhersage zeigt Wetterrisiken; einzelne Stunden können milder ausfallen. Regen weicht unbefestigte Flächen auf; befestigte Wege bleiben schnell. Ohne Sturmsicherung ruhen Auftritte bei starkem Wind — die Sturmsicherung und die übrigen Schutzmaßnahmen richtet ihr im Reiter Upgrades ein.')}</p></section>
    <section data-pane="sponsors" hidden><p>${t('Sponsoren zahlen beim Unterschreiben einen Vorschuss. Hält die Ausgabe, was der Vertrag verlangt, folgt am Ende der Bonus; sonst geht der Vorschuss zurück. Unterschrieben wird vor dem Festivalstart, höchstens zwei Verträge je Ausgabe.')}</p><div data-sponsors class="festival-grid"></div></section>
    <section data-pane="upgrades" hidden><p>${t('Einmal bezahlt, bleiben Schutzmaßnahmen dem Gelände erhalten: sie gelten festivalweit und auch für alle weiteren Ausgaben. Bezahlt wird sofort aus der Kasse.')}</p><div data-upgrades class="festival-grid"></div></section>
    <section data-pane="reports" hidden><div data-reputation class="festival-grid"></div><p>${t('Musikruf öffnet den Zugang zu größeren Bands. Atmosphäre, Komfort und Organisation beeinflussen die erwarteten Zielgruppen und die Nachfrage. Die Tagesbilanz enthält sämtliche Einnahmen und Ausgaben des Spiels.')}</p><div data-reports></div></section>`
}

export function mountFestivalUI(
  getGame: () => GameState,
  toast: (text: string, error?: boolean) => void,
  onPane?: (pane: string) => void,
) {
  const shell = document.querySelector<HTMLElement>('.game-shell')!
  const open = document.createElement('button')
  open.id = 'open-festival'
  open.textContent = '📅'
  open.title = t('Festival planen')
  open.setAttribute('aria-label', open.title)
  open.setAttribute('aria-expanded', 'false')
  document.querySelector('#action-group-festival')!.prepend(open)
  const weather = document.createElement('div'); weather.className = 'festival-weather'; weather.setAttribute('aria-hidden', 'true'); shell.append(weather)
  const panel = document.createElement('section')
  panel.id = 'festival-management'; panel.className = 'festival-management panel'; panel.hidden = true
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-labelledby', 'festival-title')
  panel.innerHTML = panelMarkup()
  shell.append(panel)
  makeDraggable(panel.querySelector<HTMLElement>('.panel-header')!, panel)
  makeResizable(panel)
  const magazine = mountHeadlineMagazine(shell)
  let lastRender = -1, reportCount = 0
  const execute = (action: FestivalAction) => { const result = getGame().manageFestival(action); if (result.message !== COMMAND_QUEUED) toast(result.message, !result.ok); render(getGame().snapshot, true) }
  const musicPlanner=mountMusicPlanner(panel.querySelector('[data-music-planner]')!,()=>getGame().snapshot,execute,toast)
  const close = () => { panel.hidden = true; open.setAttribute('aria-expanded', 'false'); open.focus() }
  open.addEventListener('click', () => { panel.hidden = !panel.hidden; open.setAttribute('aria-expanded', String(!panel.hidden)); if (!panel.hidden) render(getGame().snapshot, true) })
  panel.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button')
    if (!button) return
    if (button.hasAttribute('data-close')) { close(); return }
    if (button.hasAttribute('data-magazine-open')) { magazine.open(); return }
    if (button.dataset.tab) {
      panel.querySelectorAll<HTMLElement>('[data-pane]').forEach(pane => pane.hidden = pane.dataset.pane !== button.dataset.tab)
      panel.querySelectorAll('[data-tab]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)))
      render(getGame().snapshot, true)
      // A new tab always starts at its top, not at the scroll position of the last one.
      panel.scrollTop = 0
      onPane?.(button.dataset.tab)
    }
    if (button.hasAttribute('data-park-toggle')) {
      const result = getGame().setParkOpen(!getGame().snapshot.parkOpen)
      toast(result.message, !result.ok)
      render(getGame().snapshot, true)
      return
    }
    if (button.dataset.action) execute({ type: button.dataset.action === 'start'&&getGame().snapshot.festival.finished?'prepare':button.dataset.action as 'start' | 'sandbox' })
    if (button.dataset.cancel) execute({ type: 'cancel', id: button.dataset.cancel })
    if (button.dataset.sponsor) execute({ type: 'sponsor', id: button.dataset.sponsor })
    if (button.hasAttribute('data-shelter')) execute({ type: 'shelter' })
    if (button.dataset.upgrade) execute({ type: 'upgrade', kind: button.dataset.upgrade as Upgrade })
    if (button.dataset.upgradeStep) execute({ type: 'upgradeStep', kind: button.dataset.upgradeStep as TieredUpgrade })
  })
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); close() } })
  panel.querySelector<HTMLFormElement>('[data-tickets]')!.addEventListener('submit', event => {
    event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement)
    execute({type:'tickets',day:Number(data.get('dayTickets')),camping:Number(data.get('campTickets'))})
  })
  const priceFormEl = panel.querySelector<HTMLFormElement>('[data-ticket-prices]')!
  const refreshTicketEstimate = () => {
    const day = Number(priceFormEl.querySelector<HTMLInputElement>('[name=dayTicketPrice]')!.value)
    const camping = Number(priceFormEl.querySelector<HTMLInputElement>('[name=campTicketPrice]')!.value)
    const estimate = estimateTicketDemand(getGame().snapshot, { day, camping })
    priceFormEl.querySelector<HTMLElement>('[data-day-price]')!.textContent = formatMoney(day)
    priceFormEl.querySelector<HTMLElement>('[data-camp-price]')!.textContent = formatMoney(camping)
    const dayInput = priceFormEl.querySelector<HTMLInputElement>('[name=dayTicketPrice]')!
    const campInput = priceFormEl.querySelector<HTMLInputElement>('[name=campTicketPrice]')!
    // Custom range styling uses --range-accent (accent-color alone is ignored).
    dayInput.style.setProperty('--range-accent', estimate.dayColor)
    campInput.style.setProperty('--range-accent', estimate.campingColor)
    dayInput.style.accentColor = estimate.dayColor
    campInput.style.accentColor = estimate.campingColor
    panel.querySelector<HTMLElement>('[data-ticket-estimate]')!.innerHTML =
      `${joinParts(t`Erwartet: ${strong(estimate.expectedDayGuests)} Tagesgäste (${money(estimate.expectedDayRevenue)})`, t`${strong(estimate.expectedCampers)} Camper (${money(estimate.expectedCampingRevenue)}).`)} ${t('Farbe = Kaufbereitschaft.')}`
  }
  priceFormEl.addEventListener('input', refreshTicketEstimate)
  priceFormEl.addEventListener('submit', event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget as HTMLFormElement)
    getGame().updateEntryPrice(Number(data.get('dayTicketPrice')))
    getGame().updateCampingTicketPrice(Number(data.get('campTicketPrice')))
    toast(t('Ticketpreise übernommen'))
    render(getGame().snapshot, true)
  })
  panel.querySelector<HTMLFormElement>('[data-order]')!.addEventListener('submit', event => {
    event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement)
    execute({ type: 'order', kind: String(data.get('kind')) as Supply, quantity: Number(data.get('quantity')), delay: Number(data.get('delay')) })
  })
  const put = (selector: string, html: string) => { const el = panel.querySelector<HTMLElement>(selector)!; if (el.innerHTML !== html) el.innerHTML = html }
  function render(s: Snapshot, force = false) {
    const f = s.festival
    magazine.update(s)
    weather.dataset.weather = f.enabled && !f.finished ? f.weather : 'sun'
    const storm = stormAt(f, s.day, s.minute)
    weather.dataset.storm = storm.phase
    if (f.reports.length > reportCount) { reportCount = f.reports.length; toast(t('Neue Festival-Tagesabrechnung verfügbar')) }
    else reportCount = f.reports.length
    // Icon-only, like every other button in the toolbar — the state goes into the tooltip.
    const openLabel = festivalButtonLabel(s)
    open.title = openLabel
    open.setAttribute('aria-label', openLabel)
    if (panel.hidden) return
    if (!force && performance.now() - lastRender < 500) return
    lastRender = performance.now()
    put('.festival-status', festivalStatus(s))
    panel.querySelector<HTMLButtonElement>('[data-action=start]')!.disabled = f.enabled && !f.finished
    panel.querySelector<HTMLButtonElement>('[data-action=start]')!.textContent = f.finished ? t('Nächste Ausgabe vorbereiten') : t('Festival starten')
    panel.querySelector<HTMLButtonElement>('[data-action=sandbox]')!.hidden = !f.enabled
    const parkToggle = panel.querySelector<HTMLButtonElement>('[data-park-toggle]')
    if (parkToggle) {
      const locked = Boolean(f.planning || f.finished)
      parkToggle.disabled = locked
      parkToggle.textContent = parkToggleLabel(s, locked)
      parkToggle.classList.toggle('park-closed', !s.parkOpen)
    }
    const capacity = getGame().getBookableCampingCapacity(), occupied = s.visitors.filter(v => v.ticketType === 'camping').length
    const ticketForm = panel.querySelector<HTMLFormElement>('[data-tickets]')!
    ticketForm.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button').forEach(el => el.disabled = f.enabled && !f.finished)
    if (f.tickets && !ticketForm.contains(document.activeElement)) {
      ticketForm.querySelector<HTMLInputElement>('[name=dayTickets]')!.value = String(f.tickets.day)
      ticketForm.querySelector<HTMLInputElement>('[name=campTickets]')!.value = String(f.tickets.camping)
    }
    const priceForm = panel.querySelector<HTMLFormElement>('[data-ticket-prices]')!
    if (!priceForm.contains(document.activeElement)) {
      priceForm.querySelector<HTMLInputElement>('[name=dayTicketPrice]')!.value = String(s.entryPrice)
      priceForm.querySelector<HTMLInputElement>('[name=campTicketPrice]')!.value = String(s.campingTicketPrice)
    }
    refreshTicketEstimate()
    put('[data-camping-summary]', campingSummary(s, capacity, occupied))
    put('[data-music-overview]',musicOverview(s))
    put('[data-lineup-mix]',musicOverview(s))
    musicPlanner.render(s)
    put('[data-summary]', summaryMarkup(s))
    put('[data-stock]', Object.entries(SUPPLIES).map(([key, item]) => `<article><h3>${localize(item.name)}</h3><strong class="festival-number">${formatNumber(Math.floor(f.infrastructure.depots.reduce((n, d) => n + d.stock[key as Supply], 0)))}</strong><small>${t('Einheiten in Depots')}</small></article>`).join(''))
    put('[data-deliveries]', deliveriesMarkup(s))
    put('[data-storm]', stormPaneMarkup(s))
    put('[data-sponsors]', sponsorPaneMarkup(s))
    put('[data-forecast]', forecastMarkup(s))
    put('[data-upgrades]', upgradesMarkup(f))
    put('[data-reputation]', reputationMarkup(f))
    put('[data-reports]', reportsMarkup(s))
  }
  /** Opens the window on its overview, where the next edition is planned and started. */
  const openPlanning = (): void => {
    panel.hidden = false
    open.setAttribute('aria-expanded', 'true')
    panel.querySelector<HTMLButtonElement>('[data-tab="overview"]')?.click()
  }
  return { update: render, openPlanning, isMagazineOpen: () => magazine.isOpen() }
}
