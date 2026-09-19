import { mountMusicPlanner, musicOverview } from './musicPlanner'
import type { GameState, GameSnapshot } from './game/GameState'
import { makeDraggable, makeResizable } from './dragPanel'
import './festival.css'
import { AUDIENCES, AUDIENCE_NAMES, SUPPLIES, TIERED_UPGRADES, UPGRADES, upgradeLevel, WEATHER_ICONS, WEATHER_NAMES, audienceMix, forecast, formatTemperature, temperatureAt, festivalTime } from './game/festivalManagement'
import type { FestivalAction, Supply, TieredUpgrade, Upgrade } from './game/festivalManagement'
import { mountHeadlineMagazine } from './headlineMagazineUI'

const money = (n: number) => `${Math.round(n).toLocaleString('de-DE')} €`
const clock = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`
const meter = (label: string, n: number) => `<label class="festival-meter">${label}<strong>${Math.round(n)}%</strong><progress max="100" value="${n}"></progress></label>`

export function mountFestivalUI(
  getGame: () => GameState,
  toast: (text: string, error?: boolean) => void,
  onPane?: (pane: string) => void,
) {
  const shell = document.querySelector<HTMLElement>('.game-shell')!
  const open = document.createElement('button')
  open.id = 'open-festival'
  open.textContent = '📅'
  open.title = 'Festival planen'
  open.setAttribute('aria-label', 'Festival planen')
  open.setAttribute('aria-expanded', 'false')
  document.querySelector('#action-group-festival')!.prepend(open)
  const weather = document.createElement('div'); weather.className = 'festival-weather'; weather.setAttribute('aria-hidden', 'true'); shell.append(weather)
  const panel = document.createElement('section')
  panel.id = 'festival-management'; panel.className = 'festival-management panel'; panel.hidden = true
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-labelledby', 'festival-title')
  panel.innerHTML = `<div class="festival-chrome"><header class="festival-heading panel-header"><span class="panel-drag-line" aria-hidden="true"></span><h2 id="festival-title" class="panel-header-title">Das Festivalwochenende</h2><span class="panel-drag-line" aria-hidden="true"></span><button data-close class="panel-close-button" aria-label="Festivalverwaltung schließen">×</button></header>
    <div class="festival-status" aria-live="polite"></div>
    <nav class="festival-tabs" aria-label="Festivalbereiche">${[['overview', 'Übersicht'], ['dayplan', 'Tagesplan'], ['lineup', 'Bands & Spielplan'], ['supply', 'Lager & Lieferungen'], ['prepare', 'Wetter & Vorsorge'], ['upgrades', 'Upgrades'], ['reports', 'Abrechnung & Ruf']].map(([id, label]) => `<button data-tab="${id}" aria-pressed="${id === 'overview'}">${label}</button>`).join('')}</nav></div>
    <section data-pane="overview"><div class="festival-intro"><h3>Ein Gelände. Ein Wochenende. Euer Publikum.</h3><p>Vorlauf und Festivaltage legt ihr im Reiter Tagesplan fest. Erst mit dem Start läuft die Festivalzeit. Bucht ein Programm, versorgt eure Gäste und entscheidet, welche Reserven ihr euch leisten könnt. Das vorhandene Gelände und Budget werden übernommen.</p><button data-action="start">Festival starten</button><button data-action="sandbox">Freies Spiel fortsetzen</button></div><form data-ticket-prices class="festival-form"><label>Preis Tagesticket<input name="dayTicketPrice" type="number" min="0" max="1000000" step="1" value="10" required></label><label>Preis Campingticket<input name="campTicketPrice" type="number" min="0" max="1000000" step="1" value="25" required></label><button>Preise übernehmen</button></form><form data-tickets class="festival-form"><label>Tagestickets je Festivaltag<input name="dayTickets" type="number" min="0" max="100000" value="150" required></label><label>Campingtickets für die gesamte Ausgabe<input name="campTickets" type="number" min="0" max="100000" value="0" required></label><button>Kontingente übernehmen</button></form><p data-camping-summary></p><div data-music-overview></div><div data-summary></div></section>
    <section data-pane="dayplan" hidden>
      <p>Vorlauf, Festivaltage und Angebotszeiten gelten für das ganze Gelände. Tagesgäste dürfen nur im eingestellten Fenster bleiben.</p>
      <div class="festival-cycle-controls">
        <label>Vorlauf <input id="festival-lead-days" type="number" min="0" max="14" /></label>
        <label>Festival <input id="festival-active-days" type="number" min="1" max="14" /></label>
        <label>Pause <input id="festival-break-days" type="number" min="1" max="30" /></label>
        <label>Camping-Abschlag <input id="camping-capacity-buffer" type="number" min="0" max="50" />%</label>
        <button id="apply-festival-cycle" type="button">Zyklus übernehmen</button>
      </div>
      <div id="festival-cycle-strip" class="festival-cycle-strip"></div>
      <small id="camping-capacity-summary" class="camping-capacity-summary"></small>
      <div class="day-visitor-window">
        <label>Tagesgäste ab <select id="day-entry-hour"></select></label>
        <label>müssen gehen bis <select id="day-exit-hour"></select></label>
        <small>Mindestens eine Stunde täglich bleibt für Tagesgäste geschlossen.</small>
      </div>
      <div class="day-plan-scroll">
        <div id="day-plan-grid" class="day-plan-grid"></div>
      </div>
      <p id="day-plan-status" class="day-plan-status"></p>
    </section>
    <section data-pane="lineup" hidden><p>Gagen werden sofort bezahlt. Jede Bühne benötigt Strom und einen erreichbaren Bühnenvorplatz. Zwischen Auftritten liegen 30 Minuten Umbauzeit. Stornierung vor Beginn erstattet 50 %. Leere Slots könnt ihr automatisch füllen lassen; vorhandene Buchungen bleiben erhalten.</p>
      <details><summary>Besucherbasis & Genreverteilung vergleichen</summary><div data-lineup-mix></div></details><div data-music-planner></div></section>
    <section data-pane="supply" hidden><p>Waren werden am Kartenrand angeliefert und per Lastwagen zur Anlieferung gebracht. Träger versorgen Depots und Stände automatisch. Anlieferung, Depots und Personaltore baut ihr im Baumenü unter Logistik; Mindestbestände und Träger stellt ihr im Infofenster oder im Reiter Waren & Träger ein. Jede Lieferung kostet zusätzlich 45 €.</p><div data-stock class="festival-grid"></div>
      <form data-order class="festival-form"><label>Ware<select name="kind">${Object.entries(SUPPLIES).map(([key, item]) => `<option value="${key}">${item.name} · ${item.price.toLocaleString('de-DE')} €/Einheit</option>`).join('')}</select></label><label>Menge<input name="quantity" type="number" min="50" max="2000" step="50" value="200" required></label><label>Versandfenster<select name="delay"><option value="0">Jetzt</option><option value="360">In 6 Stunden</option><option value="720">In 12 Stunden</option></select></label><button type="submit">Kostenpflichtig bestellen</button></form><div data-deliveries></div></section>
    <section data-pane="prepare" hidden><div data-forecast class="festival-grid"></div><p>Die Sechs-Stunden-Vorhersage zeigt Wetterrisiken; einzelne Stunden können milder ausfallen. Regen weicht unbefestigte Flächen auf; befestigte Wege bleiben schnell. Ohne Sturmsicherung ruhen Auftritte bei starkem Wind — die Sturmsicherung und die übrigen Schutzmaßnahmen richtet ihr im Reiter Upgrades ein.</p></section>
    <section data-pane="upgrades" hidden><p>Einmal bezahlt, bleiben Schutzmaßnahmen dem Gelände erhalten: sie gelten festivalweit und auch für alle weiteren Ausgaben. Bezahlt wird sofort aus der Kasse.</p><div data-upgrades class="festival-grid"></div></section>
    <section data-pane="reports" hidden><div data-reputation class="festival-grid"></div><p>Musikruf öffnet den Zugang zu größeren Bands. Atmosphäre, Komfort und Organisation beeinflussen die erwarteten Zielgruppen und die Nachfrage. Die Tagesbilanz enthält sämtliche Einnahmen und Ausgaben des Spiels.</p><div data-reports></div></section>`
  shell.append(panel)
  makeDraggable(panel.querySelector<HTMLElement>('.panel-header')!, panel)
  makeResizable(panel)
  const magazine = mountHeadlineMagazine(shell)
  let lastRender = -1, reportCount = 0
  const execute = (action: FestivalAction) => { const result = getGame().manageFestival(action); if (result.message !== 'Befehl eingeplant') toast(result.message, !result.ok); render(getGame().snapshot, true) }
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
      onPane?.(button.dataset.tab)
    }
    if (button.dataset.action) execute({ type: button.dataset.action === 'start'&&getGame().snapshot.festival.finished?'prepare':button.dataset.action as 'start' | 'sandbox' })
    if (button.dataset.cancel) execute({ type: 'cancel', id: button.dataset.cancel })
    if (button.dataset.upgrade) execute({ type: 'upgrade', kind: button.dataset.upgrade as Upgrade })
    if (button.dataset.upgradeStep) execute({ type: 'upgradeStep', kind: button.dataset.upgradeStep as TieredUpgrade })
  })
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); close() } })
  panel.querySelector<HTMLFormElement>('[data-tickets]')!.addEventListener('submit', event => {
    event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement)
    execute({type:'tickets',day:Number(data.get('dayTickets')),camping:Number(data.get('campTickets'))})
  })
  panel.querySelector<HTMLFormElement>('[data-ticket-prices]')!.addEventListener('submit', event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget as HTMLFormElement)
    getGame().updateEntryPrice(Number(data.get('dayTicketPrice')))
    getGame().updateCampingTicketPrice(Number(data.get('campTicketPrice')))
    toast('Ticketpreise übernommen')
    render(getGame().snapshot, true)
  })
  panel.querySelector<HTMLFormElement>('[data-order]')!.addEventListener('submit', event => {
    event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement)
    execute({ type: 'order', kind: String(data.get('kind')) as Supply, quantity: Number(data.get('quantity')), delay: Number(data.get('delay')) })
  })
  const put = (selector: string, html: string) => { const el = panel.querySelector<HTMLElement>(selector)!; if (el.innerHTML !== html) el.innerHTML = html }
  function render(s: Readonly<GameSnapshot>, force = false) {
    const f = s.festival
    magazine.update(s)
    weather.dataset.weather = f.enabled && !f.finished ? f.weather : 'sun'
    if (f.reports.length > reportCount) { reportCount = f.reports.length; toast('Neue Festival-Tagesabrechnung verfügbar') }
    else reportCount = f.reports.length
    // Icon-only, like every other button in the toolbar — the state goes into the tooltip.
    const openLabel = f.enabled
      ? (f.finished ? 'Festival · Ergebnis' : `Festival · ${WEATHER_NAMES[f.weather]} · ${formatTemperature(temperatureAt(f, s.day, s.minute / 60, f.weather))}`)
      : 'Festival planen'
    open.title = openLabel
    open.setAttribute('aria-label', openLabel)
    if (panel.hidden) return
    if (!force && performance.now() - lastRender < 500) return
    lastRender = performance.now()
    const phase = f.finished ? 'Abgeschlossen' : s.day < f.startDay + s.dayPlan.leadDays ? 'Vorbereitung' : `Festivaltag ${s.day - f.startDay - s.dayPlan.leadDays + 1}/${s.dayPlan.festivalDays}`
    put('.festival-status', `<strong>${f.enabled ? `Ausgabe ${f.edition} · ${phase}` : f.planning ? 'Planung · Zeit angehalten' : 'Freies Spiel'}</strong><span>Tag ${s.day} · ${clock(s.minute)} · Budget ${money(s.money)}</span>`)
    panel.querySelector<HTMLButtonElement>('[data-action=start]')!.disabled = f.enabled && !f.finished
    panel.querySelector<HTMLButtonElement>('[data-action=start]')!.textContent = f.finished ? 'Nächste Ausgabe vorbereiten' : 'Festival starten'
    panel.querySelector<HTMLButtonElement>('[data-action=sandbox]')!.hidden = !f.enabled
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
    put('[data-camping-summary]', `${s.campingCells.length} Campingfelder · ${capacity} buchbar nach ${s.dayPlan.campingCapacityBufferPercent}% Reserve · ${occupied} belegt · ${Math.max(0,capacity-occupied)} frei.<br>${f.tickets ? `Geplant: ${f.tickets.camping}/${capacity} Campingplätze (${capacity ? Math.round(f.tickets.camping/capacity*100) : 0}%). Angereist: ${f.tickets.usedCamping} Camper · ${f.tickets.usedDay[s.day]??0}/${f.tickets.day} Tagesgäste heute.` : 'Noch kein Kontingent festgelegt: bisheriger Besucherzulauf. Übernehmt eure Ticketzahlen vor dem Start.'} Die Kontingente begrenzen die Anreisen; Einlasszeiten und Nachfrage gelten weiterhin. Bezahlung erfolgt bei Anreise.`)
    put('[data-music-overview]',musicOverview(s))
    put('[data-lineup-mix]',musicOverview(s))
    musicPlanner.render(s)
    const mix = audienceMix(f)
    put('[data-summary]', `<div class="festival-grid"><article><h3>Ziele dieses Wochenendes</h3><p>${f.admissions} / ${f.goals.guests} Anreisen</p><p>Zufriedenheit ≥ ${f.goals.satisfaction}% · Gesamtbilanz ≥ ${money(f.goals.profit)}</p><p>Vorbereitung: Tag ${f.startDay}<br>Festival: Tag ${f.startDay + s.dayPlan.leadDays} bis ${f.startDay + s.dayPlan.leadDays + s.dayPlan.festivalDays - 1}</p></article><article><h3>Erwartetes Publikum</h3>${AUDIENCES.map(key => meter(AUDIENCE_NAMES[key], mix[key] * 100)).join('')}</article><article><h3>Worauf ihr achten solltet</h3><p>${!s.buildings.some(b => b.kind === 'stage') ? 'Baut eine Bühne mit Stromversorgung und Bühnenvorplatz.' : !f.bookings.length ? 'Noch kein Programm gebucht: Ohne Bands bleibt die Nachfrage gering.' : `${f.bookings.length} Auftritte gebucht. Technische Anforderungen und Tagesplan prüfen.`}</p><p>Aktuell: <span class="weather-icon" aria-hidden="true">${WEATHER_ICONS[f.weather]}</span>${WEATHER_NAMES[f.weather]} · ${formatTemperature(temperatureAt(f, s.day, s.minute / 60, f.weather))} · Bodennässe ${Math.round(f.wetness)}%</p><p>${f.supplies.food < 100 || f.supplies.drinks < 100 ? 'Vorräte werden knapp – Nachschub bestellen.' : 'Lieferungen frühzeitig vor großen Auftritten einplanen.'}</p></article></div>`)
    put('[data-stock]', Object.entries(SUPPLIES).map(([key, item]) => `<article><h3>${item.name}</h3><strong class="festival-number">${Math.floor(f.infrastructure.depots.reduce((n, d) => n + d.stock[key as Supply], 0))}</strong><small>Einheiten in Depots</small></article>`).join(''))
    put('[data-deliveries]', `<p>${f.infrastructure.depots.length} Depots · ${f.infrastructure.trucks.length} Lastwagen · ${f.infrastructure.routes.length} Träger. Bestellungen hier gehen an das erste Depot.</p>${f.deliveries.map(d => `<article class="festival-booking"><strong>${d.quantity} × ${SUPPLIES[d.kind].name}</strong><span>${festivalTime(s) < d.due ? `Versand ab Tag ${Math.floor(d.due / 1440)} · ${clock(d.due % 1440)}` : f.infrastructure.trucks.some(t => t.deliveryId === d.id && t.z < -s.scenario.worldSize / 2) ? 'Wartet auf freie Einfahrt am Kartenrand' : f.infrastructure.trucks.some(t => t.deliveryId === d.id) ? 'Lastwagen fährt zum Depot' : d.remaining > 0 ? `Anfahrt zum Kartenrand · ${Math.ceil(d.remaining)} Minuten` : 'Wartet auf freie Zufahrt zum Depot'}</span></article>`).join('') || '<p>Keine Lieferungen unterwegs.</p>'}`)
    // Each six-hour slot reads as a row: the hours on the left, the weather on the right
    // with its own sign in front of the name, so a day can be skimmed without reading it.
    put('[data-forecast]', [0, 1, 2].map(offset => `<article><h3>Tag ${s.day + offset}</h3>${[0, 6, 12, 18].map(hour => {
      const weather = forecast(f, s.day + offset, hour)
      // The window's middle hour stands for the whole six of them.
      const celsius = temperatureAt(f, s.day + offset, hour + 3, weather)
      return `<p class="festival-forecast-slot"><span>${String(hour).padStart(2, '0')}:00–${hour + 6}:00</span><strong><span class="weather-icon" aria-hidden="true">${WEATHER_ICONS[weather]}</span>${WEATHER_NAMES[weather]}<span class="forecast-degrees">${formatTemperature(celsius)}</span></strong></p>`
    }).join('')}</article>`).join(''))
    // The stepped upgrades stand among the one-off ones, each showing the step it is on
    // and what the next one costs.
    const tiered = Object.entries(TIERED_UPGRADES).map(([key, upgrade]) => {
      const level = upgradeLevel(f, key as TieredUpgrade)
      const next = upgrade.steps[level]
      const carried = level > 0 ? upgrade.steps[level - 1]!.factor : 1
      return `<article><h3>${upgrade.name}</h3><p>${upgrade.detail}</p><p class="festival-upgrade-level">Stufe ${level}/${upgrade.steps.length} · Ladung ×${carried}</p><button data-upgrade-step="${key}" ${next ? '' : 'disabled'}>${next ? `Ausbauen auf ×${next.factor} · ${money(next.cost)}` : 'Höchste Stufe'}</button></article>`
    }).join('')
    put('[data-upgrades]', Object.entries(UPGRADES).map(([key, upgrade]) => `<article><h3>${upgrade.name}</h3><p>${upgrade.detail}</p><button data-upgrade="${key}" ${f.upgrades[key as Upgrade] ? 'disabled' : ''}>${f.upgrades[key as Upgrade] ? 'Vorhanden' : `Einrichten · ${money(upgrade.cost)}`}</button></article>`).join('') + tiered)
    put('[data-reputation]', Object.entries(f.reputation).map(([key, value]) => `<article>${meter(({ music: 'Musik', atmosphere: 'Atmosphäre', comfort: 'Komfort', organization: 'Organisation' })[key]!, value)}</article>`).join(''))
    const festivalReports = f.reports.filter(r => r.day >= f.startDay + s.dayPlan.leadDays)
    const average = festivalReports.length ? festivalReports.reduce((sum, r) => sum + r.satisfaction, 0) / festivalReports.length : 0
    const balance = f.reports.reduce((sum, r) => sum + r.balance, 0)
    const success = f.admissions >= f.goals.guests && average >= f.goals.satisfaction && balance >= f.goals.profit
    put('[data-reports]', `${f.finished ? `<article class="festival-result"><h3>${success ? 'Wochenendziele erreicht!' : 'Wochenende abgeschlossen – hier liegt euer nächstes Verbesserungspotenzial'}</h3><p>${f.admissions}/${f.goals.guests} Anreisen · Zufriedenheit ${Math.round(average)}/${f.goals.satisfaction}% · Bilanz ${money(balance)}</p><p>Mit dem behaltenen Gelände, den Ausbauten und eurem Ruf könnt ihr die nächste Ausgabe planen.</p><p><button type="button" data-magazine-open>HEADLINE Magazin aufschlagen</button></p></article>` : ''}${f.reports.map(r => `<article class="festival-booking"><div><h3>Tag ${r.day}${r.day === f.startDay ? ' · Vorbereitung' : ''}</h3><p>${r.guests} Anreisen · Zufriedenheit ${Math.round(r.satisfaction)}% · Tagesbilanz ${money(r.balance)}</p><p>${Math.round(r.concerts)} Besucher-Konzertminuten · ${r.stockouts} gescheiterte Käufe · Wetterbelastung ${Math.round(r.weatherImpact)}</p><small>${r.stockouts ? 'Mehr Vorräte und frühere Lieferungen helfen gegen Ausverkäufe. ' : ''}${r.weatherImpact > 100 ? 'Überdachung und Trinkwasser verbessern den Wetterschutz. ' : ''}${r.satisfaction < 65 ? 'Bedürfnisse, Ruhe und Erreichbarkeit prüfen.' : 'Die Gäste waren überwiegend zufrieden.'}</small></div></article>`).join('') || '<p class="festival-empty">Die erste Abrechnung erscheint nach Mitternacht. Das Festival endet nach den geplanten Festivaltagen.</p>'}`)
  }
  return { update: render }
}
