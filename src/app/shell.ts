import { DIFFICULTIES, DIFFICULTY_NAMES } from '../game/difficulty'
import { FESTIVAL_PHASE_LABELS, FESTIVAL_PHASES } from '../game/dayPlan'
import { BUILD_CATEGORIES, buildCategoryById } from '../game/buildMenu'
import { ENVIRONMENTS } from '../game/environments'
import { SCENARIO_PRESETS } from '../game/scenarioPresets'
import { SHIRT_STYLE_LABELS, SHIRT_STYLES } from '../game/shopGoods'
import { STAFF_DEFINITIONS, STAFF_ROLES } from '../game/staff'
import { SIMULATION_CONFIG } from '../game/simulationConfig'
import { EFFECT_OPTIONS, LANGUAGE_OPTIONS, RESOLUTION_OPTIONS, SHADOW_OPTIONS, UI_SCALE_OPTIONS, VOLUME_CHANNELS } from './playerSettings'
import {
  codeTag,
  de,
  escapeHtml,
  formatMoney,
  formatPercent,
  joinParts,
  kbd,
  keep,
  localize,
  localizeName,
  plural,
  t,
  tc,
  tip,
} from '../i18n'

const difficultyOptions = (): string =>
  DIFFICULTIES.map((difficulty) => `<option value="${difficulty}"${difficulty === 'normal' ? ' selected' : ''}>${localize(DIFFICULTY_NAMES[difficulty])}</option>`).join('')

const options = (list: readonly { value: string; label: string }[]): string =>
  list.map((option) => `<option value="${option.value}">${option.label}</option>`).join('')

/** What free play can ask of itself. The peak crowd is left out: one full minute would do. */
const freeplayGoalOptions = (): string => [
  ['', t('kein Ziel')],
  ['admissions', t('Anreisen in einer Ausgabe')],
  ['satisfaction', t('Zufriedenheit in einer Ausgabe (%)')],
  ['reputation', t('Ruf am Ende einer Ausgabe')],
  ['profit', t('Gewinn in einer Ausgabe (€)')],
  ['money', t('Guthaben (€)')],
  ['parkValue', t('Festivalwert (€)')],
  ['loanFree', t('Darlehen getilgt')],
].map(([value, label]) => `<option value="${value}">${label}</option>`).join('')


/** How often the game saves by itself. Fifteen minutes unless the player says otherwise. */
export const AUTOSAVE_INTERVALS = [
  { minutes: 5, label: t`Alle ${5} Minuten` },
  { minutes: 10, label: t`Alle ${10} Minuten` },
  { minutes: 15, label: t`Alle ${15} Minuten` },
  { minutes: 30, label: t`Alle ${30} Minuten` },
  { minutes: 60, label: t('Jede Stunde') },
  { minutes: 120, label: t`Alle ${2} Stunden` },
  { minutes: 0, label: t('Aus') },
] as const
export const AUTOSAVE_DEFAULT_MINUTES = 15
export const AUTOSAVE_KEY = 'festival-autosave-minutes'
/** The one slot the automatic save writes to, over and over. */
/**
 * The one slot that quick-saving and auto-saving share. They used to write to
 * different places — a hidden single slot and a named archive entry — so the
 * game had two "latest" saves and the player could not see either of them
 * side by side. One named slot shows up in the archive like any other, with
 * its day and its time on it.
 * Canonical German in every language (it is the slot's stored name); shown with localizeName.
 */
export const QUICKSAVE_NAME = de('Schnellspeichern')

/** What the shared slot was called while only auto-saving wrote to it. */
export const LEGACY_AUTOSAVE_NAME = de('Autospeichern')

/**
 * Name of a new bus line when the player leaves the field empty. Canonical German in
 * every language: the input stays empty and shows the translated default as placeholder.
 */
export const BUS_LINE_DEFAULT_NAME = de('Festival-Shuttle')

/** Where exported scenario files go; a path, the same in every language. */
const SCENARIO_FOLDER = 'public/scenarios/'

export function mountAppShell(app: HTMLDivElement): void {
  app.innerHTML = `
  <main class="game-shell">
    <canvas id="game-canvas" aria-label="${t('Festivalgelände')}"></canvas>
    <header class="topbar panel">
      <div class="brand">
        <span class="brand-mark">H</span>
        <div><strong>${keep('Headliner Tycoon')}</strong><small>${keep('Prototype')} ${__APP_VERSION__}</small></div>
  </div>
    </header>
    <!-- The running numbers sit in their own overlay in the bottom-left corner rather than in the
         top bar, which leaves the top of the screen to the name and the tools. -->
    <aside id="status-overlay" class="status-overlay panel" aria-label="${t('Überblick')}">
      <div class="stats">
        <span><button id="open-finance-money" type="button" class="status-money" title="${t('Finanzen öffnen')}">💰 <strong id="money">${formatMoney(0)}</strong></button></span>
        <span>👥 <strong id="guests">0</strong></span>
        <span>★ <strong id="reputation">0%</strong></span>
        <span>⚡ <strong id="power"></strong></span>
        <span>🗑️ <strong id="waste">0</strong></span>
        <span id="weather-stat"><span id="weather-icon" aria-hidden="true">☀️</span> <strong id="weather">${t('Heiter')}</strong> <strong id="temperature">20 °C</strong></span>
        <span class="status-date">📅 <strong id="date">${joinParts(t`Tag ${1}`, '08:00')}</strong></span>
        <span id="scenario-goals-stat" hidden><button id="open-scenario-goals" type="button" class="status-money" title="${t('Ziele im Finanzfenster ansehen')}">🎯 <strong id="scenario-goals">0/0</strong></button></span>
      </div>
    </aside>
    <nav class="rct-toolbar" aria-label="${t('Werkzeuge')}">
      <div id="action-group-build" class="rct-group" aria-label="${t('Bauen')}">
        ${BUILD_CATEGORIES.filter((category) => !['roads', 'logistics'].includes(category.id)).map((category) => `<button type="button" data-build-category="${category.id}" ${tip(category.label)} aria-expanded="false">${category.icon}</button>`).join('')}
        <span class="rct-split" aria-hidden="true"></span>
        <button type="button" data-build-category="roads" ${tip(t('Straßen'))} aria-expanded="false">🛣️</button>
        <button type="button" data-build-category="logistics" ${tip(t('Logistik'))} aria-expanded="false">🚚</button>
        <button id="open-build-menu" class="rct-hidden-control" aria-expanded="false">${t('Bauen')}</button>
      </div>
      <div class="rct-group" aria-label="${t('Verwalten')}">
        <div id="action-group-festival" class="rct-inject"></div>
        <button id="open-logistics" type="button" title="${escapeHtml(joinParts(t('Logistikverwaltung'), t('Bestellungen & Träger')))}" aria-label="${escapeHtml(joinParts(t('Logistikverwaltung'), t('Bestellungen und Träger')))}" aria-expanded="false">📦</button>
        <button id="open-complaints" type="button" ${tip(t('Beschwerden'))} aria-expanded="false">📣</button>
        <button id="open-visitors" type="button" ${tip(t('Besucher'))} aria-expanded="false">👥</button>
        <button id="toggle-staff-menu" type="button" ${tip(t('Personal'))} aria-expanded="false">🧑‍💼</button>
        <button id="toggle-ticker" type="button" ${tip(t('Meldungen'))} aria-expanded="false">📢</button>
      </div>
      <div class="rct-group" aria-label="${t('Kartenansichten')}">
        <button id="toggle-logistics-overlay" type="button" ${tip(t('Logistik / Untergrund'))} aria-pressed="false">🗺️</button>
        <button id="toggle-crowding-overlay" type="button" ${tip(t('Gedränge'))} aria-pressed="false">👥</button>
        <button id="toggle-attractiveness-overlay" type="button" ${tip(t('Attraktivität'))} aria-pressed="false">🌿</button>
        <button id="toggle-party-overlay" type="button" ${tip(t('Partystimmung'))} aria-pressed="false">🎵</button>
      </div>
      <div id="action-group-session" class="rct-group" aria-label="${t('Sitzung')}">
        <button id="toggle-finance" type="button" ${tip(t('Finanzen'))} aria-expanded="false">💲</button>
        <button id="toggle-walk-mode" type="button" ${tip(t('Gelände betreten'))} aria-pressed="false">🚶</button>
        <button id="toggle-mute" type="button" ${tip(t('Ton'))} aria-pressed="false">🔊</button>
        <button id="toggle-save-menu" type="button" ${tip(t('Spielstand'))} aria-expanded="false" aria-haspopup="true">💾</button>
        <button id="undo-last-build" type="button" ${tip(t('Rückgängig'))}>↶</button>
        <button id="toggle-multiplayer" type="button" ${tip(t('Mehrspieler'))} aria-expanded="false">🌐</button>
        <button id="toggle-debug-menu" type="button" ${tip(keep('Debug'))} aria-expanded="false">🐞</button>
        <button id="toggle-scenario-editor" type="button" ${tip(t('Szenario exportieren'))} aria-expanded="false" hidden>📜</button>
        <button id="toggle-scenario" class="scenario-toggle" type="button" ${tip(t('Einstellungen'))} aria-expanded="false">⚙️</button>
      </div>
    </nav>
    <!-- The three toolbar dropdowns are siblings of the toolbar, not children of it:
         .rct-toolbar carries a z-index and so opens a stacking context, which would
         pin any menu inside it underneath the game windows no matter what z-index the
         menu itself asks for. Out here their own z-index counts. They are positioned
         from their button's live rect in main.ts, so the move costs them nothing. -->
    <div id="staff-menu-panel" class="dropdown-menu-panel panel">
      ${STAFF_ROLES.map((role) => `<button data-staff-role="${role}">${STAFF_DEFINITIONS[role].icon} ${localizeName(STAFF_DEFINITIONS[role].name)}</button>`).join('')}
    </div>
    <div id="debug-menu-panel" class="debug-menu-panel panel">
      <button id="debug-money" title="${t('Debug-Geld hinzufügen')}">💰 +${formatMoney(100000)}</button>
      <button id="debug-clear-waste" title="${t('Müll, Erbrochenes und verlassene Campinggegenstände sofort entfernen')}">🧹 ${t('Müll & alte Gegenstände entfernen')}</button>
      <button id="debug-remove-cars" title="${t('Besucherautos entfernen')}">🚗 ${t('Autos entfernen & Gäste heimschicken')}</button>
      <button id="debug-demand-tuning" title="${t('Zahlungs- und Teilnahmebereitschaft einstellen')}">🎟️ ${t('Nachfrage-Tuning')}</button>
      <label class="scenario-check"><input id="debug-sim-phases" type="checkbox" /><span>${t('Sim-Anteile der Unteraufgaben')}</span></label>
      <label class="scenario-check"><input id="debug-path-graph" type="checkbox" /><span>${t('Weggraph anzeigen')}</span></label>
    </div>
    <div id="save-menu-panel" class="dropdown-menu-panel panel">
      <button id="save">💾 ${t('Schnell speichern')}</button>
      <button id="load" title="${t('Den schnellen Einzelspielstand laden')}">📂 ${t('Schnell laden')}</button>
      <button id="save-as" title="${t('Spielstand benennen oder einen vorhandenen überschreiben')}">💾 ${t('Speichern unter …')}</button>
      <button id="save-slots" title="${t('Gespeicherte Spielstände öffnen und verwalten')}">📂 ${t('Spielstand laden')}</button>
      <button id="copy-save" title="${t('Spielstand als Base64 kopieren')}">⧉ ${t('Als Text kopieren')}</button>
      <button id="paste-save" title="${t('Base64-Spielstand einfügen')}">📋 ${t('Text einfügen')}</button>
      <button id="open-title-screen" title="${t('Die Partie verlassen und zum Startbildschirm gehen')}">🏠 ${t('Zum Startbildschirm zurück')}</button>
    </div>
    <aside id="demand-debug-panel" class="demand-debug-panel panel" hidden>
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">${t('Nachfrage-Tuning')}</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-demand-debug" class="panel-close-button" aria-label="${t('Nachfrage-Tuning schließen')}">×</button>
      </div>
      <p class="scenario-hint">${t('Änderungen werden erst mit „Übernehmen“ host-autoritative gespeichert.')}</p>
      <form id="demand-debug-form">
        <div id="demand-debug-fields" class="demand-debug-fields"></div>
        <section class="demand-debug-preview">
          <h3>${t('Live-Auswertung')}</h3>
          <dl id="demand-debug-results"></dl>
        </section>
        <div class="demand-debug-actions">
          <button type="button" id="reset-demand-debug">${t('Standardwerte')}</button>
          <button type="submit">${t('Übernehmen')}</button>
        </div>
      </form>
    </aside>
    <aside id="scenario-panel" class="scenario-panel panel" hidden>
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">${t('Einstellungen')}</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-scenario" class="panel-close-button" aria-label="${t('Einstellungen schließen')}">×</button>
      </div>
      <h3 class="scenario-heading">${t('Einstellungen')}</h3>
      <label class="scenario-field"><span>${keep('Sprache / Language')}</span><select id="setting-language">${options(LANGUAGE_OPTIONS)}</select></label>
      <p id="setting-language-note" class="scenario-hint" aria-live="polite" hidden></p>
      <button id="setting-language-reload" type="button" hidden>${t('Jetzt neu laden')}</button>
      <label class="scenario-check"><input id="setting-debug-tools" type="checkbox" /><span>${keep('Debug')}</span></label>
      <label class="scenario-check"><input id="setting-stock-bars" type="checkbox" /><span>${t('Füllstände über Ständen')}</span></label>
      <label class="scenario-check"><input id="setting-unsaved-warning" type="checkbox" /><span>${t('Vor ungespeichertem Verlassen warnen')}</span></label>
      <label class="scenario-check" id="setting-keep-awake-field"><input id="setting-keep-awake" type="checkbox" /><span>${t('Im Mehrspieler Bildschirm wachhalten')}</span></label>
      <label class="scenario-field"><span>${t('Autospeichern')}</span><select id="setting-autosave">${AUTOSAVE_INTERVALS.map((option) => `<option value="${option.minutes}">${option.label}</option>`).join('')}</select></label>
      <h3 class="scenario-heading">${t('Grafik')}</h3>
      <label class="scenario-field"><span>${t('Schatten')}</span><select id="setting-shadows">${options(SHADOW_OPTIONS)}</select></label>
      <label class="scenario-field"><span>${t('Auflösung')}</span><select id="setting-resolution">${options(RESOLUTION_OPTIONS)}</select></label>
      <label class="scenario-field"><span>${t('Effekte')}</span><select id="setting-effects">${options(EFFECT_OPTIONS)}</select></label>
      <label class="scenario-field"><span>${t('Oberfläche')}</span><select id="setting-ui-scale">${UI_SCALE_OPTIONS.map((scale) => `<option value="${scale}">${formatPercent(Math.round(scale * 100))}</option>`).join('')}</select></label>
      <h3 class="scenario-heading">${t('Ton')}</h3>
      <label class="scenario-check"><input id="setting-mute-audio" type="checkbox" /><span>${t('Ton stumm')}</span></label>
      ${VOLUME_CHANNELS.map((channel) => `<label class="scenario-field volume-field"><span>${channel.label}<output id="setting-volume-${channel.value}-value"></output></span><input id="setting-volume-${channel.value}" type="range" min="0" max="100" step="5" /></label>`).join('')}
      <h3 class="scenario-heading">${t('Tastenbelegung')}</h3>
      <p class="scenario-hint">${t('Auf eine Taste klicken und die neue drücken. Eine Taste gehört immer nur einer Aktion.')}</p>
      <div id="hotkey-list" class="hotkey-list"></div>
      <button id="reset-hotkeys" type="button">↺ ${t('Standardbelegung')}</button>
      <h3 class="scenario-heading">${t('Dieses Festival')}</h3>
      <p class="scenario-hint">${t('Gelände und Publikum werden beim Start festgelegt und stehen für die ganze Partie fest. Ein neues Festival startest du über den Titelbildschirm.')}</p>
      <dl id="scenario-summary" class="scenario-summary"></dl>
    </aside>
    <aside id="scenario-editor-panel" class="scenario-panel scenario-editor-panel panel" hidden>
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">${t('Szenario-Editor')}</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-scenario-editor" class="panel-close-button" aria-label="${t('Szenario-Editor schließen')}">×</button>
      </div>
      <p class="scenario-hint">${t`Bauen ist hier kostenlos. Export schreibt eine JSON-Datei für den Ordner ${codeTag(SCENARIO_FOLDER)} — danach erscheint sie unter Neues Spiel.`}</p>
      <label class="scenario-field"><span>${t('Name')}</span><input id="editor-name" type="text" maxlength="80" placeholder="${t('z. B. Flutlichtwiese')}" /></label>
      <label class="scenario-field"><span>${t('Beschreibung')}</span><textarea id="editor-detail" rows="3" maxlength="800" placeholder="${t('Was die Spielerin vorfindet und worum es geht.')}"></textarea></label>
      <label class="scenario-field"><span>${t('Startgeld')} <b id="editor-money-value">${formatMoney(10000)}</b></span><input id="editor-money" type="range" min="5000" max="250000" step="5000" value="10000" /></label>
      <label class="scenario-field"><span>${t('Schulden')} <b id="editor-loan-value">${formatMoney(0)}</b></span><input id="editor-loan" type="range" min="0" max="100000" step="1000" value="0" /></label>
      <label class="scenario-field"><span>${t('Autobesucher')} <b id="editor-car-value">78%</b></span><input id="editor-car-share" type="range" min="0" max="100" step="1" value="78" /></label>
      <label class="scenario-field"><span>${t('Party-Affinität')} <b id="editor-party-value">55%</b></span><input id="editor-party" type="range" min="0" max="100" step="1" value="55" /></label>
      <label class="scenario-field"><span>${t('Schönheits-Affinität')} <b id="editor-beauty-value">55%</b></span><input id="editor-beauty" type="range" min="0" max="100" step="1" value="55" /></label>
      <label class="scenario-field"><span>${t('Gewaltbereitschaft')} <b id="editor-aggression-value">28%</b></span><input id="editor-aggression" type="range" min="0" max="100" step="1" value="28" /></label>
      <label class="scenario-field"><span>${t('Tagestickets zum Start')}</span><input id="editor-ticket-day" type="number" min="0" max="20000" step="10" value="150" /></label>
      <label class="scenario-field"><span>${t('Campingtickets zum Start')}</span><input id="editor-ticket-camping" type="number" min="0" max="20000" step="10" value="0" /></label>
      <label class="scenario-field"><span>${joinParts(t('Nachfrage'), t('Tagesgäste'))}</span><input id="editor-demand-day" type="number" min="0" max="100000" step="10" value="${SIMULATION_CONFIG.ticketDemand.attendance.dayBaseGuests}" /></label>
      <label class="scenario-field"><span>${joinParts(t('Nachfrage'), t('Camper'))}</span><input id="editor-demand-camping" type="number" min="0" max="100000" step="10" value="${SIMULATION_CONFIG.ticketDemand.attendance.campingBaseGuests}" /></label>
      <button id="editor-export" type="button">${t('Szenario exportieren')}</button>
    </aside>
    <aside id="multiplayer-panel" class="multiplayer-panel panel" hidden>
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">${t('Mehrspieler')}</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-multiplayer" class="panel-close-button" aria-label="${t('Mehrspieler schließen')}">×</button>
      </div>
      <p class="scenario-hint">
        ${t('Der Host rechnet die Simulation. Andere Spieler bauen im selben Park mit.')}
      </p>
      <div class="multiplayer-status-badge" id="multiplayer-status-badge" data-state="solo">
        <span class="status-dot" aria-hidden="true"></span>
        <span id="multiplayer-status">${t('Singleplayer')}</span>
      </div>
      <label class="scenario-field">
        <span>${t('Name')}</span>
        <input id="multiplayer-name" type="text" maxlength="24" placeholder="${t('Dein Name')}" />
      </label>
      <label class="scenario-check" id="multiplayer-public-field"><input id="multiplayer-public" type="checkbox" /><span>${t('Öffentliche Lobby')}</span></label>
      <div class="multiplayer-chat-setting">
        <label class="scenario-check" id="multiplayer-chat-display-field"><input id="multiplayer-chat-display" type="checkbox" checked /><span>${t('Chat anzeigen')}</span></label>
        <button id="multiplayer-chat-open" type="button" title="${t('Das Chatfenster wieder einblenden')}">${t('Chat öffnen')}</button>
      </div>
      <div class="multiplayer-actions" id="multiplayer-connect-actions">
        <button id="multiplayer-host" type="button">${t('Spiel hosten')}</button>
      </div>
      <label class="scenario-field" id="multiplayer-code-field">
        <span>${t('Raumcode')}</span>
        <input id="multiplayer-code" type="text" maxlength="4" placeholder="${keep('ABCD')}" />
      </label>
      <div class="multiplayer-actions" id="multiplayer-join-actions">
        <button id="multiplayer-join" type="button">${t('Beitreten')}</button>
      </div>
      <div id="multiplayer-room" class="multiplayer-room" hidden>
        <strong id="multiplayer-code-display"></strong>
        <small id="multiplayer-join-url"></small>
        <button id="multiplayer-copy" type="button">${t('Code kopieren')}</button>
        <ul id="multiplayer-players"></ul>
        <button id="multiplayer-leave" type="button">${t('Trennen')}</button>
      </div>
    </aside>
    <aside id="save-as-panel" class="save-as-panel panel" hidden>
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">${t('Spielstand speichern')}</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-save-as" class="panel-close-button" aria-label="${t('Speichern schließen')}">×</button>
      </div>
      <p class="scenario-hint" data-save-as-storage>${t('Spielstände werden geladen …')}</p>
      <form data-save-as class="save-as-form"><label class="scenario-field"><span>${t('Name')}</span><input name="name" type="text" maxlength="40" placeholder="${t('z. B. Samstagabend')}" required></label><button>${t('Speichern')}</button></form>
      <p class="save-slots-message" role="status" data-save-as-message></p>
      <div class="save-slots-list" data-save-as-list></div>
    </aside>
    <aside id="save-slots-panel" class="save-slots-panel panel" hidden>
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">${t('Spielstände')}</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button data-close class="panel-close-button" aria-label="${t('Spielstände schließen')}">×</button>
      </div>
      <p class="scenario-hint" data-save-storage>${t('Spielstände werden geladen …')}</p>
      <form data-save-slot class="save-as-form"><label class="scenario-field"><span>${t('Name')}</span><input name="name" type="text" maxlength="40" placeholder="${t('z. B. Samstagabend')}" required></label><button>${t('Neuen Spielstand speichern')}</button></form>
      <p class="save-slots-message" role="status"></p>
      <div class="save-slots-list"></div>
    </aside>
    <aside id="build-menu" class="build-menu panel" aria-label="${t('Bauwerkzeuge')}" hidden>
      <div class="build-menu-header panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title" id="build-menu-title">${t('Bauen')}</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button data-close-build-menu class="panel-close-button" aria-label="${t('Bauen schließen')}">×</button>
      </div>
      <nav id="build-subtabs" class="build-subtabs" aria-label="${t('Untergruppen')}" hidden></nav>
      <div id="build-extra-paths" class="build-extra" hidden></div>
      <div id="build-extra-roads" class="build-extra" hidden>
        <div class="logistics-road-tools"></div>
      </div>
      <div id="build-extra-terrain" class="build-extra" hidden>
        <div id="terrain-planner-slot"></div>
      </div>
      <div id="build-extra-copy" class="build-extra" hidden>
        <p class="copy-help">${t`Rechteck aufziehen wie beim Gelände. Danach folgt die Vorschau dem Zeiger; Klick stempelt. ${kbd('R')} dreht. Gespeichert wird nur in diesem Browser, nicht im Spielstand.`}</p>
        <p id="copy-selection-summary">${t('Keine Auswahl')}</p>
        <div class="copy-save-row">
          <input id="copy-blueprint-name" type="text" maxlength="40" placeholder="${t('Name für die Bibliothek')}" autocomplete="off" />
          <button id="copy-save-library" type="button">${t('In Bibliothek speichern')}</button>
        </div>
        <button id="copy-new-selection" type="button">${t('Neue Auswahl')}</button>
        <div id="copy-library-list" class="copy-library-list"></div>
      </div>
      <div id="build-extra-decoration" class="build-extra" hidden>
        <div id="decoration-themes" class="decoration-themes" role="listbox" aria-label="${t('Deko-Themen')}"></div>
        <p class="scenery-help">${t('Oben das Thema wählen, darunter die Kategorien. Kleine Deko: bis zu 4 pro Feld. Hecken, Banner, Wimpel, Lichterketten, Gebetsfahnen und thematische Kantenstücke stehen an der Feldkante. Tageslichtballons brauchen ein ganzes Feld. Die Maus bestimmt die Position.')}</p>
        <button id="rotate-scenery" type="button">↻ ${t('Drehen / nächste Seite')} ${kbd('R')}</button>
      </div>
      <div id="build-extra-attractions" class="build-extra" hidden>
        <label class="bungee-height-field">${t('Turmhöhe (m)')} <input id="bungee-height" type="number" min="4" max="200" step="1" value="20" /></label>
      </div>
      <div id="build-extra-logistics" class="build-extra" hidden></div>
      <div id="build-grid" class="build-grid"></div>
      <div id="build-catalog-status" class="build-catalog-status" hidden>
        <div>
          <strong id="build-catalog-name">${t('Objekt wählen')}</strong>
          <p id="build-catalog-detail"></p>
        </div>
        <strong id="build-catalog-cost"></strong>
      </div>
    </aside>
    <aside id="path-construction" class="path-construction panel" aria-label="${t('Fußwege')}">
      <div class="path-construction-header panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">${t('Fußwege')}</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-path-editor" class="panel-close-button" aria-label="${t('Wege schließen')}">×</button>
      </div>
      <div id="path-tools"></div>
      <section id="road-editor-tools" class="rct-editor-section" hidden>
        <label>${t('Straßen & Verkehr')}</label>
        <div class="piece-palette">${buildCategoryById('roads').groups.flatMap(group => group.items).map(item => `<button type="button" data-road-editor-tool="${item.tool}" title="${item.detail}" aria-pressed="false">${item.icon}<small>${item.name}</small></button>`).join('')}</div>
      </section>
      <section class="rct-editor-section rct-path-art">
        <label>${t('Art')}</label>
        <div class="piece-palette path-type-palette">
          <button data-path-type="normal" class="active" title="${t('Normaler Gehweg')}"><span>▦</span><small>${t('Weg')}</small></button>
          <button data-path-type="queue" title="${t('Einbahn-Warteschlange')}"><span>⑂</span><small>${t('Schlange')}</small></button>
        </div>
        <select id="path-construction-type" class="editor-native-select" aria-hidden="true" tabindex="-1">
          <option value="normal">${t('Normaler Weg')}</option>
          <option value="queue">${t('Warteschlange (Einbahn)')}</option>
        </select>
        <div class="path-surface-hold">
          <button id="path-surface-preview" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="path-surface-popup" title="${t('Gedrückt halten für Wegarten')}">
            <span class="way-swatch" data-surface="footDirt" aria-hidden="true"></span>
            <strong data-path-surface-name></strong>
          </button>
          <div id="path-surface-popup" class="path-surface-popup" hidden>
            <div id="path-surface-picker"></div>
          </div>
        </div>
      </section>
      <section class="rct-editor-section rct-path-advanced">
        <label>${t('Richtung')}</label>
        <div class="path-direction-grid">
          <button data-path-direction="3" class="path-dir-tile" title="${t('Richtung wählen')}"><span>↖</span></button>
          <button data-path-direction="2" class="path-dir-tile" title="${t('Richtung wählen')}"><span>↗</span></button>
          <button data-path-direction="0" class="path-dir-tile" title="${t('Richtung wählen')}"><span>↙</span></button>
          <button data-path-direction="1" class="path-dir-tile" title="${t('Richtung wählen')}"><span>↘</span></button>
        </div>
      </section>
      <section class="rct-editor-section rct-path-advanced">
        <label>${t('Neigung')}</label>
        <div class="path-slope-grid">
          <button data-slope="-0.5" class="path-slope-tile" title="${t('Abwärts um eine halbe Stufe')}"><span class="path-ramp path-ramp-down">↘</span><small>${t('Runter')}</small></button>
          <button data-slope="0" class="path-slope-tile active" title="${t('Ebener Weg')}"><span class="path-ramp path-ramp-flat">→</span><small>${t('Flach')}</small></button>
          <button data-slope="0.5" class="path-slope-tile" title="${t('Aufwärts um eine halbe Stufe')}"><span class="path-ramp path-ramp-up">↗</span><small>${tc('slope', 'Hoch')}</small></button>
        </div>
      </section>
      <div class="path-cost-row">
        <button id="path-demolish" type="button" aria-pressed="false" title="${t('Wege abreißen')}">🔨 ${t('Abreißen')}</button>
        <p id="path-art-cost">${t`Kosten: ${formatMoney(10)}`}</p>
      </div>
      <section class="rct-editor-section path-access-links">
        <label>${t('Zugänge')}</label>
        <div class="path-access-grid">
          <button type="button" data-path-access="pathBarrier" title="${t('Personentor auf einen Weg')}">🚧<small>${t('Tor')}</small></button>
          <button type="button" data-path-access="staffGate" title="${t('Personal, Saugroboter und Warenlogistik')}">🛂<small>${t('Personaleingang')}</small></button>
          <button type="button" data-path-access="securityGate" title="${t('Sicherheitsschleuse / Festival-Einlass')}">🎟️<small>${t('Festival-Einlass')}</small></button>
        </div>
      </section>
      <p id="construction-status">${t('Belag wählen, dann eine Linie ziehen.')}</p>
      <div class="construction-actions rct-path-advanced">
        <button id="undo-path" class="demolish" disabled>${t('Zurück')}</button>
        <button id="build-path" class="primary" disabled>${t('Bauen')}</button>
      </div>
      <button id="toggle-path-editor" class="path-mode-toggle" type="button" aria-pressed="false" title="${t('Stückweise bauen')}">
        <svg viewBox="0 0 56 22" aria-hidden="true">
          <rect x="6" y="8" width="44" height="6" rx="1" fill="#c2b396"></rect>
          <polygon class="path-mode-arrow-fwd" points="44,4 54,11 44,18" fill="#f0c84a"></polygon>
          <polygon class="path-mode-arrow-back" points="12,4 2,11 12,18" fill="#f0c84a"></polygon>
        </svg>
      </button>
    </aside>
    <aside id="ride-builder" class="coaster-builder ride-builder panel" aria-label="${t('Fahrgeschäft-Konstruktion')}" hidden>
      <div class="construction-title"><div><small>${t('Konstruktion')}</small><strong id="ride-builder-name">${t('Fahrgeschäft bauen')}</strong></div><button id="close-ride-builder" aria-label="${t('Fahrgeschäft-Editor schließen')}">×</button></div>
      <p id="ride-builder-status" role="status"></p>
      <section class="rct-editor-section">
        <label>${t('Zugänge bauen')}</label>
        <div class="coaster-access-actions">
          <button id="ride-entrance" aria-pressed="false"><span>🚪</span><strong>${t('Eingang')}</strong><small id="ride-entrance-state">${t('Fehlt')}</small></button>
          <button id="ride-exit" aria-pressed="false"><span>🚶</span><strong>${t('Ausgang')}</strong><small id="ride-exit-state">${t('Fehlt')}</small></button>
        </div>
        <p class="ride-placement-help" id="ride-placement-help">${t('Zugang wählen, dann ein freies Nachbarfeld anklicken.')}</p>
        <small id="ride-access-status"></small>
        <button id="cancel-ride-access" hidden>${t('Platzierung abbrechen')}</button>
      </section>
      <section id="ride-tower-construction" class="rct-editor-section" hidden>
        <label for="ride-target-height">${t('Turm erweitern')}</label>
        <div class="ride-height-controls"><button id="ride-height-down" aria-label="${t('Turmplanung um 4 Meter senken')}">− 4 m</button><input id="ride-target-height" type="number" min="4" max="200" step="1" /><button id="ride-height-up" aria-label="${t('Turmplanung um 4 Meter erhöhen')}">+ 4 m</button></div>
        <small id="ride-built-height"></small>
        <button id="ride-build-height" class="primary">${t('Höhe bauen')}</button>
      </section>
      <p id="ride-platform-height"></p>
      <div class="construction-actions"><button id="ride-builder-info">ⓘ ${t('Betriebsinfos')}</button><button id="finish-ride-builder" class="primary">✓ ${t('Fertig')}</button></div>
    </aside>
    <aside id="coaster-builder" class="coaster-builder rct-coaster-construction panel" aria-label="${t('Achterbahn-Konstruktion')}">
      <div class="construction-title">
        <strong id="coaster-construction-title"></strong>
        <button id="close-coaster-builder" aria-label="${t('Editor schließen')}">×</button>
      </div>
      <section class="rct-editor-section track-section">
        <label>${t('Achterbahntyp')}</label>
        <strong id="coaster-type-name"></strong>
        <small id="coaster-type-hint"></small>
      </section>
      <section class="rct-editor-section track-section">
        <label>${t('Richtung')} <b id="coaster-direction">↙</b></label>
        <div id="track-direction-palette" class="piece-palette track-piece-palette"></div>
        <div class="path-direction-grid" id="coaster-direction-grid" hidden>
          <button type="button" data-coaster-direction="3" class="path-dir-tile" title="${t('Richtung bauen')}"><span>↖</span></button>
          <button type="button" data-coaster-direction="2" class="path-dir-tile" title="${t('Richtung bauen')}"><span>↗</span></button>
          <button type="button" data-coaster-direction="0" class="path-dir-tile" title="${t('Richtung bauen')}"><span>↙</span></button>
          <button type="button" data-coaster-direction="1" class="path-dir-tile" title="${t('Richtung bauen')}"><span>↘</span></button>
        </div>
        <button id="toggle-track-specials" class="track-special-toggle" type="button" aria-expanded="false">${t('Speziell …')}</button>
        <div id="track-special-palette" class="piece-palette track-piece-palette" hidden></div>
      </section>
      <section class="rct-editor-section track-section">
        <label>${t('Neigung')}</label>
        <div id="track-slope-palette" class="piece-palette track-slope-palette"></div>
      </section>
      <section class="rct-editor-section track-section">
        <label>${t('Rollen / S. Kippen')}</label>
        <div id="track-bank-palette" class="piece-palette track-bank-palette"></div>
      </section>
      <select id="track-piece" class="editor-native-select" aria-hidden="true" tabindex="-1"></select>
      <input id="chain-lift" class="editor-native-select" type="checkbox" aria-hidden="true" tabindex="-1" />
      <button id="coaster-build-piece" class="next-piece-preview coaster-piece-preview primary" disabled title="${t('Ausgewähltes Stück bauen')}">
        <span id="coaster-piece-preview">▰</span>
        <small>${t('Dies bauen …')}</small>
        <strong id="coaster-piece-label">${t`Kosten: ${formatMoney(0)}`}</strong>
      </button>
      <div class="coaster-build-actions">
        <button id="coaster-undo" class="demolish" disabled ${tip(t('Letztes Stück abreißen'))}><span>↶</span></button>
        <button id="delete-track-from-here" class="demolish" disabled ${tip(t('Markiertes Stück entfernen'))}><span>🚧</span></button>
        <button id="track-previous" disabled ${tip(t('Vorheriges Element'))}>◀</button>
        <button id="track-next" disabled ${tip(t('Nächstes Element'))}>▶</button>
      </div>
      <strong id="track-selection" class="track-selection">–</strong>
      <button id="coaster-rotate" class="coaster-start-rotate" type="button">↻ ${t('Startrichtung drehen')}</button>
      <p id="coaster-status">${t('Klicke auf das Gelände, um die Startplattform zu bauen.')}</p>
      <div class="coaster-access-actions">
        <button id="place-coaster-entrance" disabled>🚪 ${t('Eingang')}</button>
        <button id="place-coaster-exit" disabled>🚶 ${t('Ausgang')}</button>
      </div>
      <button id="demolish-coaster-construction" class="demolish-coaster" type="button" hidden>💣 ${t('Achterbahn abreißen')}</button>
    </aside>
    <aside id="course-builder" class="coaster-builder course-builder panel" aria-label="${t('Kurs-Konstruktion')}">
      <div class="construction-title">
        <div><small>${t('Konstruktion')}</small><strong id="course-builder-name">${t('Kurs bauen')}</strong></div>
        <button id="close-course-builder" aria-label="${t('Kurs-Editor schließen')}">×</button>
      </div>
      <p id="course-builder-status" role="status">${t('Klicke auf das Gelände, um den Eingang zu setzen.')}</p>
      <p id="course-builder-hint" class="ride-placement-help"></p>
      <section class="rct-editor-section">
        <label>${t('Bauteile')}</label>
        <div id="course-piece-palette" class="piece-palette track-piece-palette"></div>
      </section>
      <section class="rct-editor-section" id="course-elevation-section">
        <label>${t('Ebene')} <b id="course-elevation-label">0</b></label>
        <div class="ride-height-controls">
          <button id="course-elevation-down" type="button" aria-label="${t('Ebene senken')}">−</button>
          <button id="course-elevation-up" type="button" aria-label="${t('Ebene anheben')}">+</button>
        </div>
      </section>
      <section class="rct-editor-section" id="course-direction-section">
        <label>${t('Richtung')} <b id="course-direction">↙</b></label>
        <div class="path-direction-grid" id="course-direction-grid" hidden>
          <button type="button" data-course-direction="3" class="path-dir-tile" title="${t('Richtung bauen')}"><span>↖</span></button>
          <button type="button" data-course-direction="2" class="path-dir-tile" title="${t('Richtung bauen')}"><span>↗</span></button>
          <button type="button" data-course-direction="0" class="path-dir-tile" title="${t('Richtung bauen')}"><span>↙</span></button>
          <button type="button" data-course-direction="1" class="path-dir-tile" title="${t('Richtung bauen')}"><span>↘</span></button>
        </div>
        <div class="ride-height-controls" id="course-palette-build">
          <button id="course-rotate" type="button" aria-label="${t('Baurichtung drehen')}">↻</button>
          <button id="course-build-piece" type="button" disabled>⚒ ${t('Am Ende bauen')}</button>
        </div>
      </section>
      <section class="rct-editor-section" id="course-team-section" hidden>
        <label for="course-team-size">${t('Personen pro Team')}</label>
        <input id="course-team-size" type="number" min="1" max="8" value="2" />
      </section>
      <div class="construction-actions">
        <button id="course-undo" type="button" disabled>↶ ${t('Letztes Stück')}</button>
        <button id="demolish-course" class="demolish" type="button">💣 ${t('Abriss')}</button>
        <button id="finish-course-builder" class="primary" type="button">✓ ${t('Fertig')}</button>
      </div>
    </aside>
    <section class="time-controls panel" aria-label="${t('Zeitsteuerung')}">
      <button data-speed="0" title="${t('Pause')}">❚❚</button>
      <button data-speed="1" title="${t('Normal')}">▶</button>
      <button data-speed="2" title="${escapeHtml(joinParts(t('Schnell'), '3×'))}">▶▶</button>
      <button data-speed="3" title="${escapeHtml(joinParts(t('Sehr schnell'), '8×'))}">▶▶▶</button>
    </section>
    <aside class="crowding-panel panel" aria-label="${t('Kartenmittelwerte')}">
      <div data-overlay-meter="crowding"><span>${t('Gedränge')}</span><strong id="average-crowding">0%</strong></div>
      <i data-overlay-meter="crowding"><u id="average-crowding-bar"></u></i>
      <div data-overlay-meter="attractiveness"><span>${t('Attraktivität')}</span><strong id="average-attractiveness">0%</strong></div>
      <i data-overlay-meter="attractiveness"><u id="average-attractiveness-bar"></u></i>
      <div data-overlay-meter="party"><span>${t('Partystimmung')}</span><strong id="average-party">0%</strong></div>
      <i data-overlay-meter="party"><u id="average-party-bar"></u></i>
    </aside>
    <section class="help panel">
      <strong id="context-help">${t('Wähle ein Werkzeug und klicke auf das Gelände.')}</strong>
      <span id="control-hint">${joinParts(t('Weg ziehen'), t('Shift+Maus: Bauhöhe'), t('R: Gebäude drehen'), t('Q/E: Kamera'))}</span>
    </section>
    <div id="walk-hud" class="walk-hud" hidden>
      <p>${joinParts(t('WASD laufen'), t('Umschalt rennen'), t('Klick und Maus umsehen'), t('Esc zurück zur Karte'))}</p>
      <div id="walk-stick" class="walk-stick" hidden>
        <div class="walk-stick-knob"></div>
      </div>
    </div>
    <aside id="visitor-panel" class="visitor-panel panel" aria-label="${t('Besucherinformationen')}">
      <div class="visitor-title">
        <span class="visitor-avatar">👤</span>
        <div><small>${tc('person', 'Besucher')}</small><strong id="visitor-name">–</strong></div>
        <button id="close-visitor" aria-label="${t('Fenster schließen')}">×</button>
      </div>
      <nav class="person-preview-modes" aria-label="${t('Ansicht')}">
        <button type="button" id="visitor-preview-map" aria-pressed="true">${t('Karte')}</button>
        <button type="button" id="visitor-preview-front" aria-pressed="false">${t('Person')}</button>
      </nav>
      <div class="staff-minimap-row">
        <div class="staff-minimap"><canvas id="visitor-preview"></canvas></div>
        <div class="staff-minimap-controls">
          <button type="button" id="visitor-preview-zoom-in" aria-label="${t('Ansicht vergrößern')}">+</button>
          <button type="button" id="visitor-preview-zoom-out" aria-label="${t('Ansicht verkleinern')}">−</button>
        </div>
      </div>
      <button id="follow-visitor" class="visitor-follow" aria-pressed="false">📍 ${t('Besucher verfolgen')}</button>
      <p id="visitor-thought" class="visitor-thought">…</p>
      <div class="visitor-state"><span>${t('Status')}</span><strong id="visitor-state">–</strong></div>
      <div class="visitor-state"><span>${t('Budget')}</span><strong id="visitor-budget">–</strong></div>
      <div class="visitor-state"><span>${t('Alkoholverhalten')}</span><strong id="visitor-alcohol-disposition">–</strong></div>
      <div class="visitor-state"><span>${t('Camping')}</span><strong id="visitor-camping">–</strong></div>
      <div class="visitor-state"><span>${t('Ticket')}</span><strong id="visitor-ticket">–</strong></div>
      <div class="visitor-state"><span>${t('Musikgeschmack')}</span><strong id="visitor-music">–</strong></div><div class="visitor-state"><span>${t('Zielgruppe')}</span><strong id="visitor-audience">–</strong></div>
      <div class="visitor-state"><span>${t('Schlafrhythmus')}</span><strong id="visitor-sleep-rhythm">–</strong></div>
      <div class="visitor-state"><span>${t('Lokales Gedränge')}</span><strong id="visitor-crowding">0%</strong></div>
      <div class="visitor-state"><span>${t('Attraktivität')}</span><strong id="visitor-attractiveness">0%</strong></div>
      <div class="visitor-state"><span>${t('Partystimmung')}</span><strong id="visitor-party">0%</strong></div>
      <div class="visitor-state"><span>${t('Vorlieben')}</span><strong id="visitor-preferences">–</strong></div>
      <section class="visitor-inventory">
        <span>${t('Inventar')}</span>
        <div id="visitor-inventory">${t('Leer')}</div>
      </section>
      <div class="needs">
        <div><label><span>🍔 ${t('Sättigung')}</span><b id="hunger-value">0%</b></label><i><u id="hunger-bar"></u></i></div>
        <div><label><span>🚻 ${t('Toilette')}</span><b id="toilet-value">0%</b></label><i><u id="toilet-bar"></u></i></div>
            <div><label><span>🚰 ${t('Durst gestillt')}</span><b id="thirst-value">0%</b></label><i><u id="thirst-bar"></u></i></div>
            <div id="hygiene-row"><label><span>🚿 ${t('Hygiene')}</span><b id="hygiene-value">0%</b></label><i><u id="hygiene-bar"></u></i></div>
        <div><label><span>🎉 ${t('Spaß')}</span><b id="fun-value">0%</b></label><i><u id="fun-bar"></u></i></div>
        <div><label><span>⚡ ${t('Energie')}</span><b id="energy-value">0%</b></label><i><u id="energy-bar"></u></i></div>
        <div><label><span>🍺 ${t('Alkoholpegel')}</span><b id="alcohol-value">0%</b></label><i><u id="alcohol-bar"></u></i></div>
        <div><label><span>🤢 ${t('Übelkeit')}</span><b id="nausea-value">0%</b></label><i><u id="nausea-bar"></u></i></div>
        <div><label><span>🎪 ${t('Festivallust')}</span><b id="motivation-value">100%</b></label><i><u id="motivation-bar"></u></i></div>
      </div>
    </aside>
    <aside id="entity-panel" class="entity-panel panel" aria-label="${t('Objektinformationen')}" hidden>
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title"><span id="entity-icon">🏗️</span> <span id="entity-name">–</span></h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-entity" class="panel-close-button" aria-label="${t('Fenster schließen')}">×</button>
      </div>
      <p class="scenario-hint" id="entity-type">${t('Objekt')}</p>
      <nav id="entity-tabs" class="entity-tabs">
        <button data-entity-tab="overview" class="active">${t('Übersicht')}</button>
        <button data-entity-tab="dynamics">${t('Fahrdynamik')}</button>
      </nav>
      <section id="entity-overview">
        <p id="entity-status" class="visitor-thought">–</p>
        <div id="entity-stats" class="entity-stats"></div>
        <button id="open-ride-construction" class="visitor-follow" hidden>🏗️ ${joinParts(t('Konstruktion öffnen'), t('Zugänge & Turmhöhe'))}</button>
        <div id="price-options" class="coaster-options">
          <label for="entity-price">${t('Preis pro Besucher')}</label>
          <div class="price-input"><input id="entity-price" type="number" min="0" max="1000000" step="1" /> <b>€</b></div>
          <button id="apply-price-to-kind" type="button">${t('Für alle gleichen Läden übernehmen')}</button>
        </div>
        <div id="shirt-options" class="coaster-options">
          <label>${t('T-Shirt-Farbe')}</label>
          <div id="shirt-color-palette" class="shirt-color-palette"></div>
          <label for="shirt-style">${t('Schnitt')}</label>
          <select id="shirt-style">${SHIRT_STYLES.map((style) => `<option value="${style}">${localize(SHIRT_STYLE_LABELS[style])}</option>`).join('')}</select>
        </div>
        <div id="coaster-options" class="coaster-options">
          <label for="operation-mode">${t('Betriebsmodus')}</label>
          <select id="operation-mode">
            <option value="closed">${t('Geschlossen')}</option>
            <option value="open">${t('Geöffnet')}</option>
            <option value="test">${t('Testbetrieb')}</option>
          </select>
          <div class="entity-action-row">
            <button id="recall-train">↩ ${t('Wagen zurückholen')}</button>
            <button id="edit-coaster-track">🛠 ${t('Strecke bearbeiten')}</button>
          </div>
          <button id="demolish-coaster" class="demolish-coaster" type="button">💣 ${t('Achterbahn abreißen')}</button>
          <label for="dispatch-mode">${t('Abfahrt')}</label>
          <select id="dispatch-mode">
            <option value="full-or-timed">${t('Voll oder nach Wartezeit')}</option>
            <option value="full-only">${t('Nur wenn voll')}</option>
            <option value="timed">${t('Nach fester Wartezeit')}</option>
          </select>
          <label for="dispatch-interval">${t('Maximale Wartezeit')}: <b id="dispatch-value">${t`${30} min`}</b></label>
          <input id="dispatch-interval" type="range" min="5" max="120" step="5" value="30" />
        </div>
        <div id="course-options" class="coaster-options">
          <label for="course-operation-mode">${t('Betrieb')}</label>
          <select id="course-operation-mode">
            <option value="closed">${t('Geschlossen')}</option>
            <option value="open">${t('Geöffnet')}</option>
          </select>
          <div class="entity-action-row">
            <button id="edit-course-construction" type="button">🛠 ${t('Konstruktion öffnen')}</button>
          </div>
          <button id="demolish-course-inspect" class="demolish-coaster" type="button">💣 ${t('Attraktion abreißen')}</button>
        </div>
        <div id="access-control-options" class="coaster-options" hidden>
          <p id="access-signal" class="visitor-thought">–</p>
          <label>${t('Schaltung')}</label>
          <div class="access-mode-row">
            <button type="button" data-access-mode="schedule">${t('Zeitgesteuert')}</button>
            <button type="button" data-access-mode="sensor">${t('Sensor')}</button>
            <button type="button" data-access-mode="always">${t('Immer offen')}</button>
            <button type="button" data-access-mode="locked">${t('Immer zu')}</button>
          </div>
          <div id="access-passage" hidden>
            <label>${t('Durchgang')}</label>
            <div class="access-mode-row">
              <button type="button" data-access-passage="oneWay">${t('Eine Richtung')}</button>
              <button type="button" data-access-passage="both">${t('Beide Richtungen')}</button>
            </div>
          </div>
          <div id="access-schedule">
            <label>${t('Gilt an')}</label>
            <div class="access-mode-row access-phases">
              ${FESTIVAL_PHASES.map((phase) => `<button type="button" data-access-phase="${phase}">${localize(FESTIVAL_PHASE_LABELS[phase])}</button>`).join('')}
            </div>
            <label>${t('Zeit')}</label>
            <div class="access-mode-row access-schedule-time">
              <button type="button" data-access-schedule-time="hourlySlots">${t('Slots je Stunde')}</button>
              <button type="button" data-access-schedule-time="hours">${t('Tageszeit')}</button>
              <button type="button" data-access-schedule-time="dayPlan">${t('Nach Zeitplan')}</button>
            </div>
            <div id="access-slots-wrap">
              <label>${t('Grüne Slots je Stunde')}</label>
              <div id="access-slots" class="access-slots"></div>
            </div>
            <div id="access-hours" hidden>
              <label>${t('Offene Stunden')}</label>
              <div id="access-hour-grid" class="access-hours"></div>
            </div>
            <div id="access-day-plan" hidden>
              <label for="access-schedule-offer">${t('Zeitplan')}</label>
              <select id="access-schedule-offer"></select>
              <p class="scenario-hint">${t('Folgt den Öffnungszeiten aus Festival planen.')}</p>
            </div>
            <p id="access-schedule-hint" class="scenario-hint"></p>
          </div>
          <div id="access-sensor" hidden>
            <label>${t('Signal wenn die Regel zutrifft')}</label>
            <div class="access-mode-row">
              <button type="button" data-access-polarity="open">${t('Grün / offen')}</button>
              <button type="button" data-access-polarity="closed">${t('Rot / zu')}</button>
            </div>
            <label for="access-sensor-kind">${t('Regel')}</label>
            <select id="access-sensor-kind"></select>
            <label id="access-threshold-label" for="access-threshold">${t('Schwelle X')}</label>
            <input id="access-threshold" type="number" min="0" max="200" step="1" value="5" />
          </div>
          <label id="access-emergency" class="access-emergency" hidden>
            <input id="access-open-in-emergency" type="checkbox" checked />
            ${t('Im Notfall offen')}
          </label>
          <p id="access-preview" class="scenario-hint">${t('Gebiet: noch keine Messung')}</p>
          <div class="entity-action-row">
            <button type="button" id="access-draw-area">${t('Gebiet zeichnen')}</button>
            <button type="button" id="access-clear-area">${t('Gebiet leeren')}</button>
          </div>
        </div>
        <div id="depot-options" class="coaster-options">
          <p id="depot-role-hint" class="scenario-hint"></p>
          <label>${t('Verwendung')}
            <select id="depot-distribution">
              <option value="shops">${t('Nur Versorgung von Ständen')}</option>
              <option value="relay">${t('Zwischenlager: andere Depots dürfen entnehmen')}</option>
            </select>
          </label>
          <label>${t('Träger')}: <b id="depot-workers-value">0</b></label>
          <input id="depot-workers" type="range" min="0" max="20" step="1" value="0" />
          <small>${t`${formatMoney(120)} je neuem Träger`}</small>
          <label>${t('Essen Mindestbestand')}: <b id="depot-min-food-value">0</b></label>
          <input id="depot-min-food" data-depot-min="food" type="range" min="0" max="800" step="20" value="0" />
          <label>${t('Getränke Mindestbestand')}: <b id="depot-min-drinks-value">0</b></label>
          <input id="depot-min-drinks" data-depot-min="drinks" type="range" min="0" max="800" step="20" value="0" />
          <label>${t('Wasser Mindestbestand')}: <b id="depot-min-water-value">0</b></label>
          <input id="depot-min-water" data-depot-min="water" type="range" min="0" max="800" step="20" value="0" />
          <label>${t('Allgemeine Waren Mindestbestand')}: <b id="depot-min-goods-value">0</b></label>
          <input id="depot-min-goods" data-depot-min="goods" type="range" min="0" max="800" step="20" value="0" />
          <button id="depot-remove" type="button">${joinParts(t('Leeres Depot abbauen'), `+${formatMoney(200)}`)}</button>
        </div>
        <div id="security-options" class="coaster-options">
          <label for="security-flow-share">${t('Besucherstrom zu diesem Einlass')}: <b id="security-flow-share-value">100%</b></label>
          <input id="security-flow-share" type="range" min="0" max="100" step="5" value="100" />
          <small>${t('Bei mehreren passenden Einlässen werden Gäste nach diesen Anteilen verteilt.')}</small>
          <label for="security-thoroughness">${t('Kontrollgründlichkeit')}: <b id="security-thoroughness-value">50%</b></label>
          <input id="security-thoroughness" type="range" min="0" max="100" step="5" value="50" />
          <label>${t('Verbotene Gegenstände')}</label>
          <div id="security-prohibited-items" class="security-items"></div>
          <p id="security-staffing">${t('Unbesetzt')}</p>
        </div>
      </section>
      <section id="entity-dynamics" class="entity-dynamics">
        <div id="dynamics-safety" class="dynamics-safety">${t('Noch keine Messfahrt')}</div>
        <div id="dynamics-stats" class="dynamics-stats"></div>
        <div class="telemetry-chart">
          <canvas id="telemetry-chart" width="560" height="280"></canvas>
        </div>
        <div class="telemetry-legend">
          <span class="vertical">${t('Vertikal-G')}</span>
          <span class="lateral">${t('Seiten-G')}</span>
          <span class="longitudinal">${t('Längs-G')}</span>
        </div>
        <p id="dynamics-info" class="dynamics-info"></p>
      </section>
    </aside>
    <aside id="finance-panel" class="finance-panel panel" aria-label="${t('Finanzen')}">
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">${t('Finanzen')}</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-finance" class="panel-close-button" aria-label="${t('Finanzen schließen')}">×</button>
      </div>
      <div class="finance-scroll"><table id="finance-table" class="finance-table"></table></div>
      <p class="scenario-hint">${t('Prognose morgen: laufende Kosten (Betrieb, Personal, Zinsen) exakt gerechnet, Besuchereinnahmen und Wareneinkauf aus dem letzten vollen Tag. Bau, Gelände und Gagen sind Entscheidungen und werden nicht vorhergesagt. Klick auf Betriebskosten, Personal, Gagen oder Kreditzinsen klappt die aktuelle Aufschlüsselung auf.')}</p>
      <div class="finance-loan">
        <label for="finance-loan-amount">${t('Darlehen')}</label>
        <div class="finance-loan-controls">
          <button id="finance-loan-less" type="button" title="${t('Betrag verringern')}">−</button>
          <input id="finance-loan-amount" type="number" min="0" step="1000" value="5000" />
          <button id="finance-loan-more" type="button" title="${t('Betrag erhöhen')}">+</button>
          <button id="finance-borrow" type="button">${t('Aufnehmen')}</button>
          <button id="finance-repay" type="button">${t('Tilgen')}</button>
        </div>
        <p id="finance-loan-status" class="scenario-hint"></p>
      </div>
      <dl id="finance-totals" class="finance-totals"></dl>
      <section id="finance-goals" class="finance-goals" hidden>
        <h3 class="scenario-heading">${t('Ziele')}</h3>
        <ul id="finance-goal-list" class="scenario-goal-list"></ul>
        <button type="button" id="finance-scenario-end" hidden>${t('Fazit ansehen')}</button>
      </section>
    </aside>
    <aside id="complaints-panel" class="complaints-panel panel" aria-label="${t('Beschwerdemanagement')}">
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">${t('Beschwerden')}</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-complaints" class="panel-close-button" aria-label="${t('Beschwerden schließen')}">×</button>
      </div>
      <p id="complaints-summary" class="complaints-summary"></p>
      <div class="complaints-head"><span>${t('Thema')}</span><b>${t('Aktuell')}</b><b>${t('Letztes Festival')}</b></div>
      <div id="complaints-list" class="complaints-list"></div>
    </aside>
    <aside id="visitor-overview-panel" class="visitor-overview-panel panel" aria-label="${t('Besucherübersicht')}">
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">${t('Alle Besucher')}</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-visitor-overview" class="panel-close-button" aria-label="${t('Besucherübersicht schließen')}">×</button>
      </div>
      <div class="visitor-overview-controls">
        <input id="visitor-thought-filter" type="search" placeholder="${t('Gedanken durchsuchen …')}" />
        <select id="visitor-overview-sort" aria-label="${t('Besucher sortieren')}">
          <option value="thought">${t('Gedanke')}</option>
          <option value="count">${t('Anzahl')}</option>
          <option value="energy">${t('Energie')}</option>
          <option value="alcohol">${t('Alkohol')}</option>
          <option value="motivation">${t('Festivallust')}</option>
          <option value="fun">${t('Spaß')}</option>
          <option value="nausea">${t('Übelkeit')}</option>
          <option value="crowding">${t('Gedränge')}</option>
          <option value="attractiveness">${t('Attraktivität')}</option>
          <option value="party">${t('Partystimmung')}</option>
          <option value="name">${t('Name')}</option>
        </select>
        <button id="visitor-sort-direction" title="${t('Sortierrichtung')}">↓</button>
      </div>
      <div id="visitor-overview-summary" class="visitor-overview-summary"></div>
      <div class="visitor-overview-table-wrap">
        <table>
          <thead><tr><th>${t('Anzahl')}</th><th>${t('Gedanke')}</th><th>${t('Status')}</th><th>${t('Energie')}</th><th>${t('Alkohol')}</th><th>${t('Lust')}</th></tr></thead>
          <tbody id="visitor-overview-list"></tbody>
        </table>
      </div>
      <div class="visitor-overview-pages">
        <button id="visitor-page-previous">‹</button>
        <span id="visitor-page-label">${t`Seite ${1} / ${1}`}</span>
        <button id="visitor-page-next">›</button>
      </div>
    </aside>
    <aside id="staff-panel" class="staff-panel panel" aria-label="${t('Personalverwaltung')}">
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title" id="staff-panel-title">${t('Personal')}</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-staff" class="panel-close-button" aria-label="${t('Personal schließen')}">×</button>
      </div>
      <nav class="staff-role-tabs" aria-label="${t('Personalrolle')}">
        ${STAFF_ROLES.map((role) => `<button type="button" data-staff-role="${role}">${STAFF_DEFINITIONS[role].icon} ${localizeName(STAFF_DEFINITIONS[role].name)}</button>`).join('')}
      </nav>
      <div id="staff-list" class="staff-list"></div>
    </aside>
    <aside id="logistics-panel" class="day-plan-panel panel logistics-panel" aria-label="${t('Logistikverwaltung')}">
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">${t('Transport & Logistik')}</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-logistics" class="panel-close-button" aria-label="${t('Logistik schließen')}">×</button>
      </div>
      <div class="logistics-management-tabs">
        <button data-logistics-tab="overview" class="active">${t('Übersicht')}</button>
        <button data-logistics-tab="supply">${t('Waren & Träger')}</button>
        <button data-logistics-tab="routes">${t('Buslinien')}</button>
        <button data-logistics-tab="band-supply">${t('Bandversorgung')}</button>
      </div>
      <section id="logistics-overview"></section>
      <section id="logistics-supply" hidden>
        <p class="scenario-hint">${t('Mindestbestände rasten in 20er-Schritten. Träger versorgen Depots und Stände automatisch. Anlieferung und Depot baut ihr im Baumenü unter Logistik.')}</p>
        <label>${t('Lager')} <select id="supply-depot-select"></select></label>
        <p id="supply-depot-stock" class="scenario-hint"></p>
        <label>${t('Verwendung')}
          <select id="supply-depot-distribution">
            <option value="shops">${t('Nur Versorgung von Ständen')}</option>
            <option value="relay">${t('Zwischenlager: andere Depots dürfen entnehmen')}</option>
          </select>
        </label>
        <label>${t('Träger am Depot')}: <b id="supply-workers-value">0</b></label>
        <input id="supply-workers" type="range" min="0" max="20" step="1" value="0" />
        <small>${t`${formatMoney(120)} je neuem Träger`}</small>
        <label>${t('Essen Mindestbestand')}: <b id="supply-min-food-value">0</b></label>
        <input id="supply-min-food" data-supply-min="food" type="range" min="0" max="800" step="20" value="0" />
        <label>${t('Getränke Mindestbestand')}: <b id="supply-min-drinks-value">0</b></label>
        <input id="supply-min-drinks" data-supply-min="drinks" type="range" min="0" max="800" step="20" value="0" />
        <label>${t('Wasser Mindestbestand')}: <b id="supply-min-water-value">0</b></label>
        <input id="supply-min-water" data-supply-min="water" type="range" min="0" max="800" step="20" value="0" />
        <label>${t('Allgemeine Waren Mindestbestand')}: <b id="supply-min-goods-value">0</b></label>
        <input id="supply-min-goods" data-supply-min="goods" type="range" min="0" max="800" step="20" value="0" />
        <button id="supply-remove-depot" type="button">${joinParts(t('Leeres Depot abbauen'), `+${formatMoney(200)}`)}</button>
        <p id="supply-status" class="scenario-hint"></p>
        <div id="supply-deliveries"></div>
      </section>
      <section id="logistics-routes" hidden>
        <p class="scenario-hint">${t('Links ungenutzte Haltestellen, rechts die Fahrreihenfolge. Ziehen zum Einreihen oder Umsortieren; die gelbe Linie zeigt 1, 2, 3 … auf der Karte. Einer bestehenden Linie könnt ihr später weitere Busse hinzufügen.')}</p>
        <div class="line-editor">
          <label>${t('Name')} <input id="bus-line-name" value="" placeholder="${escapeHtml(localizeName(BUS_LINE_DEFAULT_NAME))}" /></label>
          <label>${t('Depot')} <select id="bus-line-depot"></select></label>
          <label>${t('Busse')} <input id="bus-line-count" type="number" min="1" max="3" value="1" /></label>
          <label>${t('Takt')} <input id="bus-line-headway" type="number" min="2" max="120" value="15" /> ${t('Min.')}</label>
          <button id="create-bus-line" class="primary">${t('Linie anlegen')}</button>
          <button id="sort-bus-line" type="button">${t('Automatisch sortieren')}</button>
          <button id="apply-bus-line-stops" type="button" hidden>${t('Reihenfolge speichern')}</button>
        </div>
        <div class="bus-planner">
          <div class="bus-planner-column" data-planner-column="available">
            <h3>${t('Verfügbare Haltestellen')}</h3>
            <div id="bus-stop-choices" class="bus-stop-choices"></div>
          </div>
          <div class="bus-planner-column" data-planner-column="active">
            <h3>${t('Aktive Haltestellen (Fahrreihenfolge)')}</h3>
            <ol id="bus-line-planned" class="bus-line-planned"></ol>
          </div>
        </div>
        <div id="bus-lines-list"></div>
      </section>
      <section id="logistics-band-supply" hidden>
        <p class="scenario-hint">${t('Backstage muss an eine Bühne grenzen oder über weitere Backstage-Felder verbunden sein. Getrennte Felder bleiben ausgewiesen, zählen aber nicht. Mehrere verbundene Bühnen teilen sich einen Pool.')}</p>
        <div class="band-supply-tools">
          <button type="button" id="band-supply-paint">${t('Backstage ausweisen')}</button>
          <button type="button" id="band-supply-erase">${t('Backstage entfernen')}</button>
          <button type="button" id="band-supply-parking">${t('Parkplatz für den Tourbus')}</button>
        </div>
        <p id="band-supply-preview" class="scenario-hint"></p>
        <div id="band-supply-list"></div>
      </section>
    </aside>
    <div id="title-screen" class="title-screen" role="dialog" aria-modal="true" aria-labelledby="title-screen-name">
      <div class="title-grain" aria-hidden="true"></div>
      <div class="title-stage">
        <div class="title-plaque">
          <canvas id="title-crowd" class="title-crowd" aria-hidden="true"></canvas>
          <div class="title-kicker">${t`${keep('BaudEwigLange Studios')} präsentiert`}</div>
          <h1 id="title-screen-name" class="title-name">${keep('Headliner Tycoon')}</h1>
          <div class="title-subtitle">${t('Ein Gelände, ein Wochenende, euer Publikum')}</div>
        </div>
        <nav class="title-menu" aria-label="${t('Hauptmenü')}">
          <button type="button" data-title-menu="resume" disabled><span class="title-menu-label">${t('Fortsetzen')}</span><span id="title-resume-meta" class="title-menu-meta">${t('Noch nicht gespielt')}</span></button>
          <button type="button" data-title-menu="new" aria-haspopup="true"><span class="title-menu-label">${t('Neues Spiel')}</span><span id="title-new-meta" class="title-menu-meta">${scenarioCount(SCENARIO_PRESETS.length + 1)}</span></button>
          <button type="button" data-title-menu="editor"><span class="title-menu-label">${t('Szenario-Editor')}</span><span class="title-menu-meta">${t('Frei bauen und exportieren')}</span></button>
          <button type="button" data-title-menu="load"><span class="title-menu-label">${t('Spielstand laden')}</span><span class="title-menu-meta">${t('Archiv öffnen')}</span></button>
          <button type="button" data-title-menu="achievements"><span class="title-menu-label">${t('Erfolge')}</span><span id="title-achievements-meta" class="title-menu-meta">${t('Noch keine')}</span></button>
          <button type="button" data-title-menu="multiplayer" aria-haspopup="true"><span class="title-menu-label">${t('Mehrspieler beitreten')}</span><span class="title-menu-meta">${t('Offene Lobby oder Code')}</span></button>
          <button type="button" data-title-menu="settings"><span class="title-menu-label">${t('Einstellungen')}</span><span class="title-menu-meta">${joinParts(keep('Debug'), t('Festivaldaten'))}</span></button>
        </nav>
        <div class="title-account">
          <span id="title-account-name" class="title-account-name" hidden></span>
          <button type="button" data-account="login">${t('Anmelden')}</button>
          <button type="button" data-account="register">${t('Registrieren')}</button>
          <button type="button" data-account="logout" hidden>${t('Abmelden')}</button>
        </div>
        <div class="title-footer">
          <span>${keep('Prototype')} ${__APP_VERSION__}</span>
        </div>
      </div>
      <div id="title-account-mask" class="title-submenu" hidden>
        <form id="title-account-form" class="title-submenu-card title-account-card">
          <div class="title-submenu-head">
            <span id="title-account-title" class="title-submenu-title">${t('Anmelden')}</span>
            <span class="title-submenu-kicker">${t('Konto')}</span>
          </div>
          <label class="scenario-field"><span>${t('Name')}</span><input id="account-name" name="username" type="text" autocomplete="username" maxlength="24" required /></label>
          <label class="scenario-field"><span>${t('Passwort')}</span><input id="account-password" name="password" type="password" autocomplete="current-password" maxlength="200" required /></label>
          <label id="account-repeat-field" class="scenario-field" hidden><span>${t('Passwort wiederholen')}</span><input id="account-repeat" name="password-repeat" type="password" autocomplete="new-password" maxlength="200" /></label>
          <p id="account-message" class="scenario-hint" role="status"></p>
          <p class="scenario-hint">${t('Das Konto liegt auf dem Spielserver; gespeichert wird dort nur ein scrypt-Hash des Passworts, nie das Passwort selbst. Die Verbindung läuft unverschlüsselt über HTTP — nimm also kein Passwort, das du anderswo benutzt.')}</p>
          <div class="title-account-actions">
            <button id="account-submit" type="submit">${t('Anmelden')}</button>
            <button id="account-switch" type="button">${t('Noch kein Konto? Registrieren')}</button>
            <button type="button" data-account-close>${t('Zurück')}</button>
          </div>
        </form>
      </div>
      <div id="title-multiplayer-mask" class="title-submenu" hidden>
        <div class="title-submenu-card title-form-card">
          <div class="title-submenu-head">
            <span class="title-submenu-title">${t('Mehrspieler beitreten')}</span>
            <span id="title-lobby-kicker" class="title-submenu-kicker">${t('Offene Lobbys')}</span>
          </div>
          <label class="scenario-field"><span>${t('Dein Name')}</span><input id="title-lobby-name" type="text" maxlength="24" placeholder="${t('Dein Name')}" autocomplete="off" /></label>
          <label class="scenario-field"><span>${t('Code einer privaten Lobby')}</span><input id="title-lobby-code" type="text" maxlength="4" placeholder="${keep('ABCD')}" autocomplete="off" spellcheck="false" /></label>
          <div class="title-lobby-actions">
            <button id="title-lobby-join" type="button">${t('Mit Code beitreten')}</button>
            <button id="title-lobby-refresh" type="button">${t('Liste aktualisieren')}</button>
          </div>
          <div id="title-lobby-rows" class="title-submenu-rows"></div>
          <p id="title-lobby-note" class="scenario-hint"></p>
          <button type="button" data-title-lobby-close>${t('Zurück')}</button>
        </div>
      </div>
      <div id="title-achievements-mask" class="title-submenu" hidden>
        <div class="title-submenu-card">
          <div class="title-submenu-head">
            <span class="title-submenu-title">${t('Erfolge')}</span>
            <span id="title-achievements-kicker" class="title-submenu-kicker">${t('Über alle Partien')}</span>
          </div>
          <div id="title-achievements-rows" class="title-submenu-rows title-achievement-rows"></div>
          <p class="scenario-hint">${t('Erfolge und geschaffte Szenarien bleiben in diesem Browser und, wenn du angemeldet bist, in deinem Konto. Spiele mit Debug-Geld zählen nicht.')}</p>
          <button type="button" data-title-achievements-close>${t('Zurück')}</button>
        </div>
      </div>
      <div id="title-load-mask" class="title-submenu" hidden>
        <div class="title-submenu-card">
          <div class="title-submenu-head">
            <span class="title-submenu-title">${t('Spielstand laden')}</span>
            <span id="title-load-kicker" class="title-submenu-kicker">${t('Archiv')}</span>
          </div>
          <div id="title-load-rows" class="title-submenu-rows"></div>
          <p id="title-load-note" class="scenario-hint"></p>
          <button type="button" data-title-load-close>${t('Zurück')}</button>
        </div>
      </div>
      <div id="title-submenu" class="title-submenu" hidden>
        <div class="title-submenu-card">
          <div class="title-submenu-head">
            <span class="title-submenu-title">${t('Neues Spiel')}</span>
            <span class="title-submenu-kicker">${t('Szenario wählen')}</span>
          </div>
          <div id="title-scenario-rows" class="title-submenu-rows">
            <button type="button" data-title-scenario="" aria-haspopup="true"><span class="title-row-text"><span class="title-row-label">${t('Freies Spiel')}</span><span class="title-row-meta">${t('Gelände, Publikum und Startkapital selbst festlegen — ohne Vorgaben und ohne Ziele.')}</span></span><span class="title-row-value">${t('frei')}</span></button>
          </div>
          <button type="button" data-title-back>${t('Zurück')}</button>
        </div>
      </div>
      <div id="title-briefing-mask" class="title-submenu" hidden>
        <div class="title-submenu-card">
          <div class="title-submenu-head">
            <span id="title-briefing-name" class="title-submenu-title">${t('Szenario')}</span>
            <span class="title-submenu-kicker">${t('Briefing')}</span>
          </div>
          <div id="title-briefing" class="title-freeplay title-briefing"></div>
          <div class="title-freeplay-actions">
            <label class="scenario-field title-briefing-difficulty"><span>${t('Schwierigkeit')}</span><select id="title-briefing-difficulty">${difficultyOptions()}</select></label>
            <button id="title-briefing-start" type="button">▶ ${t('Szenario starten')}</button>
            <button type="button" data-title-briefing-close>${t('Zurück')}</button>
          </div>
        </div>
      </div>
      <div id="title-freeplay-mask" class="title-submenu" hidden>
        <div class="title-submenu-card">
          <div class="title-submenu-head">
            <span class="title-submenu-title">${t('Freies Spiel')}</span>
            <span class="title-submenu-kicker">${escapeHtml(t('Gelände & Publikum'))}</span>
          </div>
          <div id="title-freeplay" class="title-freeplay">
          <p class="scenario-hint">${t('Diese Werte gelten für die ganze Partie und lassen sich später nicht mehr ändern.')}</p>
      <label class="scenario-field"><span>${t('Umgebung')}</span><select id="scenario-environment">${Object.entries(ENVIRONMENTS).map(([id, e]) => `<option value="${id}">${localize(e.name)}</option>`).join('')}</select></label>
      <p id="scenario-ground-details" class="scenario-hint"></p>
      <label class="scenario-field"><span>${t('Geländeunebenheit')} <b id="scenario-unevenness-value">${formatPercent(50)}</b></span><small>${joinParts(t`${formatPercent(0)}: vollständig flach`, t`${formatPercent(100)}: stark hügelig`)}. ${t('Eingang und Zufahrt bleiben eben.')}</small><input id="scenario-unevenness" type="range" min="0" max="100" step="5" value="50" /></label>
      <label class="scenario-field">
        <span>${t('Autobesucher')} <b id="scenario-car-value">78%</b></span>
        <small>${t('Fußgänger')} ← → ${t('Autos')}</small>
        <input id="scenario-car-share" type="range" min="0" max="100" step="1" value="78" />
      </label>
      <label class="scenario-field">
        <span>${t('Party-Affinität')} <b id="scenario-party-value">55%</b></span>
        <small>${t('ruhig')} ← → ${t('partyaffin')}</small>
        <input id="scenario-party" type="range" min="0" max="100" step="1" value="55" />
      </label>
      <label class="scenario-field">
        <span>${t('Schönheits-Affinität')} <b id="scenario-beauty-value">55%</b></span>
        <small>${t('egal')} ← → ${t('schönheitsaffin')}</small>
        <input id="scenario-beauty" type="range" min="0" max="100" step="1" value="55" />
      </label>
      <label class="scenario-field">
        <span>${t('Gewaltbereitschaft')} <b id="scenario-aggression-value">28%</b></span>
        <small>${t('friedlich')} ← → ${t('gewaltbereit')}</small>
        <input id="scenario-aggression" type="range" min="0" max="100" step="1" value="28" />
      </label>
      <label class="scenario-field">
        <span>${t('Startgeld')} <b id="scenario-money-value">${formatMoney(10000)}</b></span>
        <input id="scenario-money" type="range" min="5000" max="250000" step="5000" value="10000" />
      </label>
      <label class="scenario-field">
        <span>${t('Schwierigkeit')}</span>
        <select id="scenario-difficulty">${difficultyOptions()}</select>
        <small>${t('Startgeld, laufende Kosten, Andrang, Gästebudget, Bedürfnisse und Unwetter')}</small>
      </label>
      <label class="scenario-field">
        <span>${t('Kartengröße')}</span>
        <select id="scenario-world-size">
          <option value="32">${t('Klein')} (32×32)</option>
          <option value="48">${t('Normal')} (48×48)</option>
          <option value="64">${t('Groß')} (64×64)</option>
          <option value="80">${t('Sehr groß')} (80×80)</option>
          <option value="265">${t('Riesig')} (265×265)</option>
        </select>
      </label>
      <fieldset class="scenario-goal-editor">
        <legend>${t('Ziele (optional)')}</legend>
        <p class="scenario-hint">${firstEditionHint(SIMULATION_CONFIG.scenario.firstEditionDays)}</p>
        <div class="scenario-goal-head" aria-hidden="true"><span>${t('Ziel')}</span><span>${t('Wert')}</span><span>${t('bis Ausgabe')}</span></div>
        ${[1, 2, 3, 4].map((n) => `<div class="scenario-goal-row" data-goal-row>
          <select data-goal-kind aria-label="${t`Ziel ${n}`}">${freeplayGoalOptions()}</select>
          <input data-goal-target type="number" min="1" step="1" placeholder="${t('Wert')}" aria-label="${t`Zielwert ${n}`}" />
          <input data-goal-edition type="number" min="1" max="20" step="1" value="3" aria-label="${t`Frist von Ziel ${n}: bis zur Ausgabe`}" />
        </div>`).join('')}
      </fieldset>
          </div>
          <div class="title-freeplay-actions">
            <button id="start-scenario" type="button">▶ ${t('Freies Spiel starten')}</button>
            <button type="button" data-title-freeplay-close>${t('Zurück')}</button>
          </div>
        </div>
      </div>
    </div>
    <div id="toast" role="status" aria-live="polite"></div>
  </main>
`
}

function scenarioCount(count: number): string {
  return plural(count, t`${count} Szenario`, t`${count} Szenarien`)
}

/** Free play with goals becomes a scenario; the first edition falls due after this many days. */
function firstEditionHint(days: number): string {
  return plural(
    days,
    t`Mit Zielen wird das freie Spiel zum Szenario: Es kann gewonnen und verloren werden, und die erste Ausgabe ist nach ${days} Tag fällig.`,
    t`Mit Zielen wird das freie Spiel zum Szenario: Es kann gewonnen und verloren werden, und die erste Ausgabe ist nach ${days} Tagen fällig.`,
  )
}
