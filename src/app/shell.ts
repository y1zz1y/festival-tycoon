import { BUILD_CATEGORIES, buildCategoryById } from '../game/buildMenu'
import { ENVIRONMENTS } from '../game/environments'
import { SCENARIO_PRESETS } from '../game/scenarioPresets'
import { SHIRT_STYLE_LABELS, SHIRT_STYLES } from '../game/shopGoods'
import { STAFF_DEFINITIONS, STAFF_ROLES } from '../game/staff'

/**
 * The publisher's line carries a correction, the way a poster gets one once it is
 * already printed: „Watch“ struck out with a painted cross and „Code“ brushed in
 * underneath. Both are drawn, not typed — stroked paths pushed around by a little
 * noise, so the edges come out ragged the way a loaded brush leaves them.
 */
const PUBLISHER_MARK = `<svg class="kicker-brush" viewBox="0 0 136 74" aria-hidden="true" focusable="false">
  <defs>
    <filter id="kicker-bristles" x="-25%" y="-25%" width="150%" height="150%">
      <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="7" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <filter id="kicker-bristles-word" x="-25%" y="-25%" width="150%" height="150%">
      <feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves="2" seed="19" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.1" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>
  <g fill="none" stroke="var(--ts-red)" stroke-linecap="round" stroke-linejoin="round">
    <g filter="url(#kicker-bristles)">
      <path d="M18 6 C 46 16, 82 27, 118 36" stroke-width="5" />
      <path d="M118 5 C 91 15, 54 26, 19 35" stroke-width="4.4" />
      <path d="M24 9 C 50 18, 84 28, 114 35" stroke-width="1.8" opacity=".7" />
      <path d="M112 10 C 86 18, 52 28, 24 34" stroke-width="1.6" opacity=".65" />
      <path d="M122 38 l 5 3" stroke-width="1.4" opacity=".55" />
      <path d="M15 3 l -4 -3" stroke-width="1.2" opacity=".5" />
    </g>
    <g filter="url(#kicker-bristles-word)" transform="translate(68 58) scale(1.12) translate(-68 -58) rotate(-2.5 68 58)">
      <g stroke-width="5.2">
        <path d="M47 46 C 35 39, 24 46, 24 56 C 24 67, 35 73, 48 67" />
        <path d="M63 44 C 52 45, 47 57, 52 66 C 59 74, 71 70, 71 58 C 71 47, 67 44, 60 45" />
        <path d="M79 44 C 78 53, 77 62, 78 71" />
        <path d="M79 45 C 91 43, 98 51, 97 58 C 96 67, 87 72, 78 70" />
        <path d="M117 45 C 110 43, 104 43, 102 47 C 100 53, 100 63, 102 69 C 106 72, 113 71, 117 68" />
        <path d="M103 57 C 106 56, 110 56, 113 57" />
      </g>
      <g stroke-width="2.4" opacity=".55">
        <path d="M46 48 C 36 42, 26 48, 26 56" />
        <path d="M70 52 C 71 60, 67 68, 60 68" />
        <path d="M80 47 C 79 56, 79 64, 79 69" />
        <path d="M81 46 C 91 45, 96 52, 95 58" />
        <path d="M116 46 C 110 45, 105 45, 103 48" />
      </g>
      <g stroke-width="1.2" opacity=".45">
        <path d="M118 70 l 5 2" />
        <path d="M22 60 l -4 2" />
      </g>
    </g>
  </g>
</svg>`

/** How often the game saves by itself. Fifteen minutes unless the player says otherwise. */
export const AUTOSAVE_INTERVALS = [
  { minutes: 5, label: 'Alle 5 Minuten' },
  { minutes: 10, label: 'Alle 10 Minuten' },
  { minutes: 15, label: 'Alle 15 Minuten' },
  { minutes: 30, label: 'Alle 30 Minuten' },
  { minutes: 60, label: 'Jede Stunde' },
  { minutes: 120, label: 'Alle 2 Stunden' },
  { minutes: 0, label: 'Aus' },
] as const
export const AUTOSAVE_DEFAULT_MINUTES = 15
export const AUTOSAVE_KEY = 'festival-autosave-minutes'
/** The one slot the automatic save writes to, over and over. */
export const AUTOSAVE_NAME = 'Autospeichern'

export function mountAppShell(app: HTMLDivElement): void {
  app.innerHTML = `
  <main class="game-shell">
    <canvas id="game-canvas" aria-label="Festivalgelände"></canvas>
    <header class="topbar panel">
      <div class="brand">
        <span class="brand-mark">H</span>
        <div><strong>Headliner Tycoon</strong><small>Prototype ${__APP_VERSION__}</small></div>
  </div>
    </header>
    <!-- The running numbers sit in their own overlay in the bottom-left corner rather than in the
         top bar, which leaves the top of the screen to the name and the tools. -->
    <aside id="status-overlay" class="status-overlay panel" aria-label="Überblick">
      <div class="stats">
        <span><button id="open-finance-money" type="button" class="status-money" title="Finanzen öffnen">💰 <strong id="money">0 €</strong></button></span>
        <span>👥 <strong id="guests">0</strong></span>
        <span>★ <strong id="reputation">0%</strong></span>
        <span>⚡ <strong id="power">0/0 kW</strong></span>
        <span>🗑️ <strong id="waste">0</strong></span>
        <span id="weather-stat"><span id="weather-icon" aria-hidden="true">☀️</span> <strong id="weather">Heiter</strong> <strong id="temperature">20 °C</strong></span>
        <span>📅 <strong id="date">Tag 1 · 08:00</strong></span>
      </div>
    </aside>
    <nav class="rct-toolbar" aria-label="Werkzeuge">
      <div id="action-group-build" class="rct-group" aria-label="Bauen">
        ${BUILD_CATEGORIES.filter((category) => !['roads', 'logistics'].includes(category.id)).map((category) => `<button type="button" data-build-category="${category.id}" title="${category.label}" aria-label="${category.label}" aria-expanded="false">${category.icon}</button>`).join('')}
        <span class="rct-split" aria-hidden="true"></span>
        <button type="button" data-build-category="roads" title="Straßen" aria-label="Straßen" aria-expanded="false">🛣️</button>
        <button type="button" data-build-category="logistics" title="Logistik" aria-label="Logistik" aria-expanded="false">🚚</button>
        <button id="open-build-menu" class="rct-hidden-control" aria-expanded="false">Bauen</button>
      </div>
      <div class="rct-group" aria-label="Verwalten">
        <div id="action-group-festival" class="rct-inject"></div>
        <button id="open-logistics" type="button" title="Logistikverwaltung · Bestellungen &amp; Träger" aria-label="Logistikverwaltung · Bestellungen und Träger" aria-expanded="false">📦</button>
        <button id="open-complaints" type="button" title="Beschwerden" aria-label="Beschwerden" aria-expanded="false">📣</button>
        <button id="open-visitors" type="button" title="Besucher" aria-label="Besucher" aria-expanded="false">👥</button>
        <button id="toggle-staff-menu" type="button" title="Personal" aria-label="Personal" aria-expanded="false">🧑‍💼</button>
        <button id="toggle-ticker" type="button" title="Meldungen" aria-label="Meldungen" aria-expanded="false">📢</button>
      </div>
      <div class="rct-group" aria-label="Kartenansichten">
        <button id="toggle-logistics-overlay" type="button" title="Logistik / Untergrund" aria-label="Logistik / Untergrund" aria-pressed="false">🗺️</button>
        <button id="toggle-crowding-overlay" type="button" title="Gedränge" aria-label="Gedränge" aria-pressed="false">👥</button>
        <button id="toggle-attractiveness-overlay" type="button" title="Attraktivität" aria-label="Attraktivität" aria-pressed="false">🌿</button>
        <button id="toggle-party-overlay" type="button" title="Partystimmung" aria-label="Partystimmung" aria-pressed="false">🎵</button>
      </div>
      <div id="action-group-session" class="rct-group" aria-label="Sitzung">
        <button id="toggle-finance" type="button" title="Finanzen" aria-label="Finanzen" aria-expanded="false">💲</button>
        <button id="toggle-walk-mode" type="button" title="Gelände betreten" aria-label="Gelände betreten" aria-pressed="false">🚶</button>
        <button id="toggle-mute" type="button" title="Ton" aria-label="Ton" aria-pressed="false">🔊</button>
        <button id="toggle-save-menu" type="button" title="Spielstand" aria-label="Spielstand" aria-expanded="false" aria-haspopup="true">💾</button>
        <button id="toggle-park" type="button" title="Park schließen" aria-label="Park schließen">🔓</button>
        <button id="toggle-multiplayer" type="button" title="Mehrspieler" aria-label="Mehrspieler" aria-expanded="false">🌐</button>
        <button id="toggle-debug-menu" type="button" title="Debug" aria-label="Debug" aria-expanded="false">🐞</button>
        <button id="toggle-scenario" class="scenario-toggle" type="button" title="Einstellungen" aria-label="Einstellungen" aria-expanded="false">⚙️</button>
      </div>
      <div id="staff-menu-panel" class="dropdown-menu-panel panel">
        ${STAFF_ROLES.map((role) => `<button data-staff-role="${role}">${STAFF_DEFINITIONS[role].icon} ${STAFF_DEFINITIONS[role].name}</button>`).join('')}
      </div>
      <div id="debug-menu-panel" class="debug-menu-panel panel">
        <button id="debug-money" title="Debug-Geld hinzufügen">💰 +100.000 €</button>
        <button id="debug-clear-waste" title="Müll, Erbrochenes und verlassene Campinggegenstände sofort entfernen">🧹 Müll & alte Gegenstände entfernen</button>
        <button id="debug-remove-cars" title="Besucherautos entfernen">🚗 Autos entfernen & Gäste heimschicken</button>
      </div>
      <div id="save-menu-panel" class="dropdown-menu-panel panel">
        <button id="save">💾 Schnell speichern</button>
        <button id="load" title="Den schnellen Einzelspielstand laden">📂 Schnell laden</button>
        <button id="save-as" title="Spielstand benennen oder einen vorhandenen überschreiben">💾 Speichern unter …</button>
        <button id="save-slots" title="Gespeicherte Spielstände öffnen und verwalten">📂 Spielstand laden</button>
        <button id="copy-save" title="Spielstand als Base64 kopieren">⧉ Als Text kopieren</button>
        <button id="paste-save" title="Base64-Spielstand einfügen">📋 Text einfügen</button>
      </div>
    </nav>
    <aside id="scenario-panel" class="scenario-panel panel" hidden>
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">Einstellungen</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-scenario" class="panel-close-button" aria-label="Einstellungen schließen">×</button>
      </div>
      <h3 class="scenario-heading">Einstellungen</h3>
      <label class="scenario-check"><input id="setting-debug-tools" type="checkbox" /><span>Debug</span></label>
      <label class="scenario-check"><input id="setting-mute-audio" type="checkbox" /><span>Ton stumm</span></label>
      <label class="scenario-field"><span>Autospeichern</span><select id="setting-autosave">${AUTOSAVE_INTERVALS.map((option) => `<option value="${option.minutes}">${option.label}</option>`).join('')}</select></label>
      <button id="open-title-screen" type="button">🏠 Titelbildschirm</button>
      <h3 class="scenario-heading">Dieses Festival</h3>
      <p class="scenario-hint">Gelände und Publikum werden beim Start festgelegt und stehen für die ganze Partie fest. Ein neues Festival startest du über den Titelbildschirm.</p>
      <dl id="scenario-summary" class="scenario-summary"></dl>
    </aside>
    <aside id="multiplayer-panel" class="multiplayer-panel panel" hidden>
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">Mehrspieler</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-multiplayer" class="panel-close-button" aria-label="Mehrspieler schließen">×</button>
      </div>
      <p class="scenario-hint">
        Der Host rechnet die Simulation. Andere Spieler bauen im selben Park mit.
      </p>
      <div class="multiplayer-status-badge" id="multiplayer-status-badge" data-state="solo">
        <span class="status-dot" aria-hidden="true"></span>
        <span id="multiplayer-status">Singleplayer</span>
      </div>
      <label class="scenario-field">
        <span>Name</span>
        <input id="multiplayer-name" type="text" maxlength="24" placeholder="Dein Name" />
      </label>
      <div class="multiplayer-actions" id="multiplayer-connect-actions">
        <button id="multiplayer-host" type="button">Spiel hosten</button>
      </div>
      <label class="scenario-field" id="multiplayer-code-field">
        <span>Raumcode</span>
        <input id="multiplayer-code" type="text" maxlength="4" placeholder="ABCD" />
      </label>
      <div class="multiplayer-actions" id="multiplayer-join-actions">
        <button id="multiplayer-join" type="button">Beitreten</button>
      </div>
      <div id="multiplayer-room" class="multiplayer-room" hidden>
        <strong id="multiplayer-code-display"></strong>
        <small id="multiplayer-join-url"></small>
        <button id="multiplayer-copy" type="button">Code kopieren</button>
        <ul id="multiplayer-players"></ul>
        <button id="multiplayer-leave" type="button">Trennen</button>
      </div>
    </aside>
    <aside id="save-as-panel" class="save-as-panel panel" hidden>
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">Spielstand speichern</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-save-as" class="panel-close-button" aria-label="Speichern schließen">×</button>
      </div>
      <p class="scenario-hint" data-save-as-storage>Spielstände werden geladen …</p>
      <form data-save-as class="save-as-form"><label class="scenario-field"><span>Name</span><input name="name" type="text" maxlength="40" placeholder="z. B. Samstagabend" required></label><button>Speichern</button></form>
      <p class="save-slots-message" role="status" data-save-as-message></p>
      <div class="save-slots-list" data-save-as-list></div>
    </aside>
    <aside id="save-slots-panel" class="save-slots-panel panel" hidden>
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">Spielstände</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button data-close class="panel-close-button" aria-label="Spielstände schließen">×</button>
      </div>
      <p class="scenario-hint" data-save-storage>Spielstände werden geladen …</p>
      <form data-save-slot class="save-as-form"><label class="scenario-field"><span>Name</span><input name="name" type="text" maxlength="40" placeholder="z. B. Samstagabend" required></label><button>Neuen Spielstand speichern</button></form>
      <p class="save-slots-message" role="status"></p>
      <div class="save-slots-list"></div>
    </aside>
    <aside id="build-menu" class="build-menu panel" aria-label="Bauwerkzeuge" hidden>
      <div class="build-menu-header panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title" id="build-menu-title">Bauen</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button data-close-build-menu class="panel-close-button" aria-label="Bauen schließen">×</button>
      </div>
      <nav id="build-subtabs" class="build-subtabs" aria-label="Untergruppen" hidden></nav>
      <div id="build-extra-paths" class="build-extra" hidden></div>
      <div id="build-extra-roads" class="build-extra" hidden>
        <div class="logistics-road-tools"></div>
      </div>
      <div id="build-extra-terrain" class="build-extra" hidden>
        <div id="terrain-planner-slot"></div>
      </div>
      <div id="build-extra-copy" class="build-extra" hidden>
        <p class="copy-help">Rechteck aufziehen wie beim Gelände. Danach folgt die Vorschau dem Zeiger; Klick stempelt. <kbd>R</kbd> dreht. Gespeichert wird nur in diesem Browser, nicht im Spielstand.</p>
        <p id="copy-selection-summary">Keine Auswahl</p>
        <div class="copy-save-row">
          <input id="copy-blueprint-name" type="text" maxlength="40" placeholder="Name für die Bibliothek" autocomplete="off" />
          <button id="copy-save-library" type="button">In Bibliothek speichern</button>
        </div>
        <button id="copy-new-selection" type="button">Neue Auswahl</button>
        <div id="copy-library-list" class="copy-library-list"></div>
      </div>
      <div id="build-extra-decoration" class="build-extra" hidden>
        <div id="decoration-themes" class="decoration-themes" role="listbox" aria-label="Deko-Themen"></div>
        <p class="scenery-help">Oben das Thema wählen, darunter die Kategorien. Kleine Deko: bis zu 4 pro Feld. Hecken, Banner, Wimpel, Lichterketten, Gebetsfahnen und thematische Kantenstücke stehen an der Feldkante. Tageslichtballons brauchen ein ganzes Feld. Die Maus bestimmt die Position.</p>
        <button id="rotate-scenery" type="button">↻ Drehen / nächste Seite <kbd>R</kbd></button>
      </div>
      <div id="build-extra-attractions" class="build-extra" hidden>
        <label class="bungee-height-field">Turmhöhe (m) <input id="bungee-height" type="number" min="4" max="200" step="1" value="20" /></label>
      </div>
      <div id="build-extra-logistics" class="build-extra" hidden></div>
      <div id="build-grid" class="build-grid"></div>
      <div id="build-catalog-status" class="build-catalog-status" hidden>
        <div>
          <strong id="build-catalog-name">Objekt wählen</strong>
          <p id="build-catalog-detail"></p>
        </div>
        <strong id="build-catalog-cost"></strong>
      </div>
    </aside>
    <aside id="path-construction" class="path-construction panel" aria-label="Fußwege">
      <div class="path-construction-header panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">Fußwege</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-path-editor" class="panel-close-button" aria-label="Wege schließen">×</button>
      </div>
      <div id="path-tools"></div>
      <section id="road-editor-tools" class="rct-editor-section" hidden>
        <label>Straßen & Verkehr</label>
        <div class="piece-palette">${buildCategoryById('roads').groups.flatMap(group => group.items).map(item => `<button type="button" data-road-editor-tool="${item.tool}" title="${item.detail}" aria-pressed="false">${item.icon}<small>${item.name}</small></button>`).join('')}</div>
      </section>
      <section class="rct-editor-section rct-path-art">
        <label>Art</label>
        <div class="piece-palette path-type-palette">
          <button data-path-type="normal" class="active" title="Normaler Gehweg"><span>▦</span><small>Weg</small></button>
          <button data-path-type="queue" title="Einbahn-Warteschlange"><span>⑂</span><small>Schlange</small></button>
        </div>
        <select id="path-construction-type" class="editor-native-select" aria-hidden="true" tabindex="-1">
          <option value="normal">Normaler Weg</option>
          <option value="queue">Warteschlange (Einbahn)</option>
        </select>
        <div class="path-surface-hold">
          <button id="path-surface-preview" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="path-surface-popup" title="Gedrückt halten für Wegarten">
            <span class="way-swatch" data-surface="footDirt" aria-hidden="true"></span>
            <strong data-path-surface-name>Trampelpfad</strong>
          </button>
          <div id="path-surface-popup" class="path-surface-popup" hidden>
            <div id="path-surface-picker"></div>
          </div>
        </div>
      </section>
      <section class="rct-editor-section rct-path-advanced">
        <label>Richtung</label>
        <div class="path-direction-grid">
          <button data-path-direction="3" class="path-dir-tile" title="Richtung wählen"><span>↖</span></button>
          <button data-path-direction="2" class="path-dir-tile" title="Richtung wählen"><span>↗</span></button>
          <button data-path-direction="0" class="path-dir-tile" title="Richtung wählen"><span>↙</span></button>
          <button data-path-direction="1" class="path-dir-tile" title="Richtung wählen"><span>↘</span></button>
        </div>
      </section>
      <section class="rct-editor-section rct-path-advanced">
        <label>Neigung</label>
        <div class="path-slope-grid">
          <button data-slope="-0.5" class="path-slope-tile" title="Abwärts um eine halbe Stufe"><span class="path-ramp path-ramp-down">↘</span><small>Runter</small></button>
          <button data-slope="0" class="path-slope-tile active" title="Ebener Weg"><span class="path-ramp path-ramp-flat">→</span><small>Flach</small></button>
          <button data-slope="0.5" class="path-slope-tile" title="Aufwärts um eine halbe Stufe"><span class="path-ramp path-ramp-up">↗</span><small>Hoch</small></button>
        </div>
      </section>
      <div class="path-cost-row">
        <button id="path-demolish" type="button" aria-pressed="false" title="Wege abreißen">🔨 Abreißen</button>
        <p id="path-art-cost">Kosten: €10</p>
      </div>
      <section class="rct-editor-section path-access-links">
        <label>Zugänge</label>
        <div class="path-access-grid">
          <button type="button" data-path-access="pathBarrier" title="Personentor auf einen Weg">🚧<small>Tor</small></button>
          <button type="button" data-path-access="staffGate" title="Personal, Saugroboter und Warenlogistik">🛂<small>Personaleingang</small></button>
          <button type="button" data-path-access="securityGate" title="Sicherheitsschleuse / Festival-Einlass">🎟️<small>Festival-Einlass</small></button>
        </div>
      </section>
      <p id="construction-status">Belag wählen, dann eine Linie ziehen.</p>
      <div class="construction-actions rct-path-advanced">
        <button id="undo-path" class="demolish" disabled>Zurück</button>
        <button id="build-path" class="primary" disabled>Bauen</button>
      </div>
      <button id="toggle-path-editor" class="path-mode-toggle" type="button" aria-pressed="false" title="Stückweise bauen">
        <svg viewBox="0 0 56 22" aria-hidden="true">
          <rect x="6" y="8" width="44" height="6" rx="1" fill="#c2b396"></rect>
          <polygon class="path-mode-arrow-fwd" points="44,4 54,11 44,18" fill="#f0c84a"></polygon>
          <polygon class="path-mode-arrow-back" points="12,4 2,11 12,18" fill="#f0c84a"></polygon>
        </svg>
      </button>
    </aside>
    <aside id="ride-builder" class="coaster-builder ride-builder panel" aria-label="Fahrgeschäft-Konstruktion" hidden>
      <div class="construction-title"><div><small>Konstruktion</small><strong id="ride-builder-name">Fahrgeschäft bauen</strong></div><button id="close-ride-builder" aria-label="Fahrgeschäft-Editor schließen">×</button></div>
      <p id="ride-builder-status" role="status"></p>
      <section class="rct-editor-section">
        <label>Zugänge bauen</label>
        <div class="coaster-access-actions">
          <button id="ride-entrance" aria-pressed="false"><span>🚪</span><strong>Eingang</strong><small id="ride-entrance-state">Fehlt</small></button>
          <button id="ride-exit" aria-pressed="false"><span>🚶</span><strong>Ausgang</strong><small id="ride-exit-state">Fehlt</small></button>
        </div>
        <p class="ride-placement-help" id="ride-placement-help">Zugang wählen, dann ein freies Nachbarfeld anklicken.</p>
        <small id="ride-access-status"></small>
        <button id="cancel-ride-access" hidden>Platzierung abbrechen</button>
      </section>
      <section id="ride-tower-construction" class="rct-editor-section" hidden>
        <label for="ride-target-height">Turm erweitern</label>
        <div class="ride-height-controls"><button id="ride-height-down" aria-label="Turmplanung um 4 Meter senken">− 4 m</button><input id="ride-target-height" type="number" min="4" max="200" step="1" /><button id="ride-height-up" aria-label="Turmplanung um 4 Meter erhöhen">+ 4 m</button></div>
        <small id="ride-built-height"></small>
        <button id="ride-build-height" class="primary">Höhe bauen</button>
      </section>
      <p id="ride-platform-height"></p>
      <div class="construction-actions"><button id="ride-builder-info">ⓘ Betriebsinfos</button><button id="finish-ride-builder" class="primary">✓ Fertig</button></div>
    </aside>
    <aside id="coaster-builder" class="coaster-builder rct-coaster-construction panel" aria-label="Achterbahn-Konstruktion">
      <div class="construction-title">
        <strong id="coaster-construction-title">Achterbahn 1 Konstruktion</strong>
        <button id="close-coaster-builder" aria-label="Editor schließen">×</button>
      </div>
      <section class="rct-editor-section track-section">
        <label>Achterbahntyp</label>
        <strong id="coaster-type-name">Klassische Stahlachterbahn</strong>
        <small id="coaster-type-hint"></small>
      </section>
      <section class="rct-editor-section track-section">
        <label>Richtung <b id="coaster-direction">↙</b></label>
        <div id="track-direction-palette" class="piece-palette track-piece-palette"></div>
        <button id="toggle-track-specials" class="track-special-toggle" type="button" aria-expanded="false">Speziell …</button>
        <div id="track-special-palette" class="piece-palette track-piece-palette" hidden></div>
      </section>
      <section class="rct-editor-section track-section">
        <label>Neigung</label>
        <div id="track-slope-palette" class="piece-palette track-slope-palette"></div>
      </section>
      <section class="rct-editor-section track-section">
        <label>Rollen / S. Kippen</label>
        <div id="track-bank-palette" class="piece-palette track-bank-palette"></div>
      </section>
      <select id="track-piece" class="editor-native-select" aria-hidden="true" tabindex="-1"></select>
      <input id="chain-lift" class="editor-native-select" type="checkbox" aria-hidden="true" tabindex="-1" />
      <button id="coaster-build-piece" class="next-piece-preview coaster-piece-preview primary" disabled title="Ausgewähltes Stück bauen">
        <span id="coaster-piece-preview">▰</span>
        <small>Dies bauen …</small>
        <strong id="coaster-piece-label">Kosten: 0 €</strong>
      </button>
      <div class="coaster-build-actions">
        <button id="coaster-undo" class="demolish" disabled title="Letztes Stück abreißen" aria-label="Letztes Stück abreißen"><span>↶</span></button>
        <button id="delete-track-from-here" class="demolish" disabled title="Markiertes Stück entfernen" aria-label="Markiertes Stück entfernen"><span>🚧</span></button>
        <button id="track-previous" disabled title="Vorheriges Element" aria-label="Vorheriges Element">◀</button>
        <button id="track-next" disabled title="Nächstes Element" aria-label="Nächstes Element">▶</button>
      </div>
      <strong id="track-selection" class="track-selection">–</strong>
      <button id="coaster-rotate" class="coaster-start-rotate" type="button">↻ Startrichtung drehen</button>
      <p id="coaster-status">Klicke auf das Gelände, um die Startplattform zu bauen.</p>
      <div class="coaster-access-actions">
        <button id="place-coaster-entrance" disabled>🚪 Eingang</button>
        <button id="place-coaster-exit" disabled>🚶 Ausgang</button>
      </div>
      <button id="demolish-coaster-construction" class="demolish-coaster" type="button" hidden>💣 Achterbahn abreißen</button>
    </aside>
    <section class="time-controls panel" aria-label="Zeitsteuerung">
      <button data-speed="0" title="Pause">❚❚</button>
      <button data-speed="1" title="Normal">▶</button>
      <button data-speed="2" title="Schnell · 3×">▶▶</button>
      <button data-speed="3" title="Sehr schnell · 8×">▶▶▶</button>
    </section>
    <aside class="crowding-panel panel" aria-label="Kartenmittelwerte">
      <div data-overlay-meter="crowding"><span>Gedränge</span><strong id="average-crowding">0%</strong></div>
      <i data-overlay-meter="crowding"><u id="average-crowding-bar"></u></i>
      <div data-overlay-meter="attractiveness"><span>Attraktivität</span><strong id="average-attractiveness">0%</strong></div>
      <i data-overlay-meter="attractiveness"><u id="average-attractiveness-bar"></u></i>
      <div data-overlay-meter="party"><span>Partystimmung</span><strong id="average-party">0%</strong></div>
      <i data-overlay-meter="party"><u id="average-party-bar"></u></i>
    </aside>
    <section class="help panel">
      <strong id="context-help">Wähle ein Werkzeug und klicke auf das Gelände.</strong>
      <span id="control-hint">Weg ziehen · Shift+Maus: Bauhöhe · R: Gebäude drehen · Q/E: Kamera</span>
    </section>
    <div id="walk-hud" class="walk-hud" hidden>
      <p>WASD laufen · Umschalt rennen · Klick und Maus umsehen · Esc zurück zur Karte</p>
      <div id="walk-stick" class="walk-stick" hidden>
        <div class="walk-stick-knob"></div>
      </div>
    </div>
    <aside id="visitor-panel" class="visitor-panel panel" aria-label="Besucherinformationen">
      <div class="visitor-title">
        <span class="visitor-avatar">👤</span>
        <div><small>Besucher</small><strong id="visitor-name">–</strong></div>
        <button id="close-visitor" aria-label="Fenster schließen">×</button>
      </div>
      <nav class="person-preview-modes" aria-label="Ansicht">
        <button type="button" id="visitor-preview-map" aria-pressed="true">Karte</button>
        <button type="button" id="visitor-preview-front" aria-pressed="false">Person</button>
      </nav>
      <div class="staff-minimap-row">
        <div class="staff-minimap"><canvas id="visitor-preview"></canvas></div>
        <div class="staff-minimap-controls">
          <button type="button" id="visitor-preview-zoom-in" aria-label="Ansicht vergrößern">+</button>
          <button type="button" id="visitor-preview-zoom-out" aria-label="Ansicht verkleinern">−</button>
        </div>
      </div>
      <button id="follow-visitor" class="visitor-follow" aria-pressed="false">📍 Besucher verfolgen</button>
      <p id="visitor-thought" class="visitor-thought">„…“</p>
      <div class="visitor-state"><span>Status</span><strong id="visitor-state">–</strong></div>
      <div class="visitor-state"><span>Budget</span><strong id="visitor-budget">–</strong></div>
      <div class="visitor-state"><span>Alkoholverhalten</span><strong id="visitor-alcohol-disposition">–</strong></div>
      <div class="visitor-state"><span>Camping</span><strong id="visitor-camping">–</strong></div>
      <div class="visitor-state"><span>Ticket</span><strong id="visitor-ticket">–</strong></div>
      <div class="visitor-state"><span>Musikgeschmack</span><strong id="visitor-music">–</strong></div><div class="visitor-state"><span>Zielgruppe</span><strong id="visitor-audience">–</strong></div>
      <div class="visitor-state"><span>Schlafrhythmus</span><strong id="visitor-sleep-rhythm">–</strong></div>
      <div class="visitor-state"><span>Lokales Gedränge</span><strong id="visitor-crowding">0%</strong></div>
      <div class="visitor-state"><span>Attraktivität</span><strong id="visitor-attractiveness">0%</strong></div>
      <div class="visitor-state"><span>Partystimmung</span><strong id="visitor-party">0%</strong></div>
      <div class="visitor-state"><span>Vorlieben</span><strong id="visitor-preferences">–</strong></div>
      <section class="visitor-inventory">
        <span>Inventar</span>
        <div id="visitor-inventory">Leer</div>
      </section>
      <div class="needs">
        <div><label><span>🍔 Sättigung</span><b id="hunger-value">0%</b></label><i><u id="hunger-bar"></u></i></div>
        <div><label><span>🚻 Toilette</span><b id="toilet-value">0%</b></label><i><u id="toilet-bar"></u></i></div>
        <div><label><span>🎉 Spaß</span><b id="fun-value">0%</b></label><i><u id="fun-bar"></u></i></div>
        <div><label><span>⚡ Energie</span><b id="energy-value">0%</b></label><i><u id="energy-bar"></u></i></div>
        <div><label><span>🍺 Alkoholpegel</span><b id="alcohol-value">0%</b></label><i><u id="alcohol-bar"></u></i></div>
        <div><label><span>🤢 Übelkeit</span><b id="nausea-value">0%</b></label><i><u id="nausea-bar"></u></i></div>
        <div><label><span>🎪 Festivallust</span><b id="motivation-value">100%</b></label><i><u id="motivation-bar"></u></i></div>
      </div>
    </aside>
    <aside id="entity-panel" class="entity-panel panel" aria-label="Objektinformationen" hidden>
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title"><span id="entity-icon">🏗️</span> <span id="entity-name">–</span></h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-entity" class="panel-close-button" aria-label="Fenster schließen">×</button>
      </div>
      <p class="scenario-hint" id="entity-type">Objekt</p>
      <nav id="entity-tabs" class="entity-tabs">
        <button data-entity-tab="overview" class="active">Übersicht</button>
        <button data-entity-tab="dynamics">Fahrdynamik</button>
      </nav>
      <section id="entity-overview">
        <p id="entity-status" class="visitor-thought">–</p>
        <div id="entity-stats" class="entity-stats"></div>
        <button id="open-ride-construction" class="visitor-follow" hidden>🏗️ Konstruktion öffnen · Zugänge & Turmhöhe</button>
        <div id="price-options" class="coaster-options">
          <label for="entity-price">Preis pro Besucher</label>
          <div class="price-input"><input id="entity-price" type="number" min="0" max="1000000" step="1" /> <b>€</b></div>
          <button id="apply-price-to-kind" type="button">Für alle gleichen Läden übernehmen</button>
        </div>
        <div id="shirt-options" class="coaster-options">
          <label>T-Shirt-Farbe</label>
          <div id="shirt-color-palette" class="shirt-color-palette"></div>
          <label for="shirt-style">Schnitt</label>
          <select id="shirt-style">${SHIRT_STYLES.map((style) => `<option value="${style}">${SHIRT_STYLE_LABELS[style]}</option>`).join('')}</select>
        </div>
        <div id="coaster-options" class="coaster-options">
          <label for="operation-mode">Betriebsmodus</label>
          <select id="operation-mode">
            <option value="closed">Geschlossen</option>
            <option value="open">Geöffnet</option>
            <option value="test">Testbetrieb</option>
          </select>
          <div class="entity-action-row">
            <button id="recall-train">↩ Wagen zurückholen</button>
            <button id="edit-coaster-track">🛠 Strecke bearbeiten</button>
          </div>
          <button id="demolish-coaster" class="demolish-coaster" type="button">💣 Achterbahn abreißen</button>
          <label for="dispatch-mode">Abfahrt</label>
          <select id="dispatch-mode">
            <option value="full-or-timed">Voll oder nach Wartezeit</option>
            <option value="full-only">Nur wenn voll</option>
            <option value="timed">Nach fester Wartezeit</option>
          </select>
          <label for="dispatch-interval">Maximale Wartezeit: <b id="dispatch-value">30 min</b></label>
          <input id="dispatch-interval" type="range" min="5" max="120" step="5" value="30" />
        </div>
        <div id="access-control-options" class="coaster-options" hidden>
          <p id="access-signal" class="visitor-thought">–</p>
          <label>Schaltung</label>
          <div class="access-mode-row">
            <button type="button" data-access-mode="schedule">Zeitgesteuert</button>
            <button type="button" data-access-mode="sensor">Sensor</button>
            <button type="button" data-access-mode="always">Immer offen</button>
            <button type="button" data-access-mode="locked">Immer zu</button>
          </div>
          <div id="access-passage" hidden>
            <label>Durchgang</label>
            <div class="access-mode-row">
              <button type="button" data-access-passage="oneWay">Eine Richtung</button>
              <button type="button" data-access-passage="both">Beide Richtungen</button>
            </div>
          </div>
          <div id="access-schedule">
            <label>Gilt an</label>
            <div class="access-mode-row access-phases">
              <button type="button" data-access-phase="lead">Vorbereitung</button>
              <button type="button" data-access-phase="festival">Festival</button>
              <button type="button" data-access-phase="break">Pause</button>
            </div>
            <label>Zeit</label>
            <div class="access-mode-row access-schedule-time">
              <button type="button" data-access-schedule-time="hourlySlots">Slots je Stunde</button>
              <button type="button" data-access-schedule-time="hours">Tageszeit</button>
              <button type="button" data-access-schedule-time="dayPlan">Nach Zeitplan</button>
            </div>
            <div id="access-slots-wrap">
              <label>Grüne Slots je Stunde</label>
              <div id="access-slots" class="access-slots"></div>
            </div>
            <div id="access-hours" hidden>
              <label>Offene Stunden</label>
              <div id="access-hour-grid" class="access-hours"></div>
            </div>
            <div id="access-day-plan" hidden>
              <label for="access-schedule-offer">Zeitplan</label>
              <select id="access-schedule-offer"></select>
              <p class="scenario-hint">Folgt den Öffnungszeiten aus Festival planen.</p>
            </div>
            <p id="access-schedule-hint" class="scenario-hint"></p>
          </div>
          <div id="access-sensor" hidden>
            <label>Signal wenn die Regel zutrifft</label>
            <div class="access-mode-row">
              <button type="button" data-access-polarity="open">Grün / offen</button>
              <button type="button" data-access-polarity="closed">Rot / zu</button>
            </div>
            <label for="access-sensor-kind">Regel</label>
            <select id="access-sensor-kind"></select>
            <label id="access-threshold-label" for="access-threshold">Schwelle X</label>
            <input id="access-threshold" type="number" min="0" max="200" step="1" value="5" />
          </div>
          <label id="access-emergency" class="access-emergency" hidden>
            <input id="access-open-in-emergency" type="checkbox" checked />
            Im Notfall offen
          </label>
          <p id="access-preview" class="scenario-hint">Gebiet: noch keine Messung</p>
          <div class="entity-action-row">
            <button type="button" id="access-draw-area">Gebiet zeichnen</button>
            <button type="button" id="access-clear-area">Gebiet leeren</button>
          </div>
        </div>
        <div id="depot-options" class="coaster-options">
          <p id="depot-role-hint" class="scenario-hint"></p>
          <label>Verwendung
            <select id="depot-distribution">
              <option value="shops">Nur Versorgung von Ständen</option>
              <option value="relay">Zwischenlager: andere Depots dürfen entnehmen</option>
            </select>
          </label>
          <label>Träger: <b id="depot-workers-value">0</b></label>
          <input id="depot-workers" type="range" min="0" max="20" step="1" value="0" />
          <small>120 € je neuem Träger</small>
          <label>Essen Mindestbestand: <b id="depot-min-food-value">0</b></label>
          <input id="depot-min-food" data-depot-min="food" type="range" min="0" max="800" step="20" value="0" />
          <label>Getränke Mindestbestand: <b id="depot-min-drinks-value">0</b></label>
          <input id="depot-min-drinks" data-depot-min="drinks" type="range" min="0" max="800" step="20" value="0" />
          <label>Wasser Mindestbestand: <b id="depot-min-water-value">0</b></label>
          <input id="depot-min-water" data-depot-min="water" type="range" min="0" max="800" step="20" value="0" />
          <label>Allgemeine Waren Mindestbestand: <b id="depot-min-goods-value">0</b></label>
          <input id="depot-min-goods" data-depot-min="goods" type="range" min="0" max="800" step="20" value="0" />
          <button id="depot-remove" type="button">Leeres Depot abbauen · +200 €</button>
        </div>
        <div id="security-options" class="coaster-options">
          <label for="security-flow-share">Besucherstrom zu diesem Einlass: <b id="security-flow-share-value">100%</b></label>
          <input id="security-flow-share" type="range" min="0" max="100" step="5" value="100" />
          <small>Bei mehreren passenden Einlässen werden Gäste nach diesen Anteilen verteilt.</small>
          <label for="security-thoroughness">Kontrollgründlichkeit: <b id="security-thoroughness-value">50%</b></label>
          <input id="security-thoroughness" type="range" min="0" max="100" step="5" value="50" />
          <label>Verbotene Gegenstände</label>
          <div id="security-prohibited-items" class="security-items"></div>
          <p id="security-staffing">Unbesetzt</p>
        </div>
      </section>
      <section id="entity-dynamics" class="entity-dynamics">
        <div id="dynamics-safety" class="dynamics-safety">Noch keine Messfahrt</div>
        <div id="dynamics-stats" class="dynamics-stats"></div>
        <div class="telemetry-chart">
          <canvas id="telemetry-chart" width="560" height="280"></canvas>
        </div>
        <div class="telemetry-legend">
          <span class="vertical">Vertikal-G</span>
          <span class="lateral">Seiten-G</span>
          <span class="longitudinal">Längs-G</span>
        </div>
        <p id="dynamics-info" class="dynamics-info"></p>
      </section>
    </aside>
    <aside id="finance-panel" class="finance-panel panel" aria-label="Finanzen">
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">Finanzen</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-finance" class="panel-close-button" aria-label="Finanzen schließen">×</button>
      </div>
      <div class="finance-scroll"><table id="finance-table" class="finance-table"></table></div>
      <p class="scenario-hint">Prognose morgen: laufende Kosten (Betrieb, Personal, Zinsen) exakt gerechnet, Besuchereinnahmen und Wareneinkauf aus dem letzten vollen Tag. Bau, Gelände und Gagen sind Entscheidungen und werden nicht vorhergesagt.</p>
      <div class="finance-loan">
        <label for="finance-loan-amount">Darlehen</label>
        <div class="finance-loan-controls">
          <button id="finance-loan-less" type="button" title="Betrag verringern">−</button>
          <input id="finance-loan-amount" type="number" min="0" step="1000" value="5000" />
          <button id="finance-loan-more" type="button" title="Betrag erhöhen">+</button>
          <button id="finance-borrow" type="button">Aufnehmen</button>
          <button id="finance-repay" type="button">Tilgen</button>
        </div>
        <p id="finance-loan-status" class="scenario-hint"></p>
      </div>
      <dl id="finance-totals" class="finance-totals"></dl>
      <section id="finance-goals" class="finance-goals" hidden>
        <h3 class="scenario-heading">Ziele</h3>
        <ul id="finance-goal-list" class="finance-goal-list"></ul>
      </section>
    </aside>
    <aside id="complaints-panel" class="complaints-panel panel" aria-label="Beschwerdemanagement">
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">Beschwerden</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-complaints" class="panel-close-button" aria-label="Beschwerden schließen">×</button>
      </div>
      <p id="complaints-summary" class="complaints-summary"></p>
      <div class="complaints-head"><span>Thema</span><b>Aktuell</b><b>Letztes Festival</b></div>
      <div id="complaints-list" class="complaints-list"></div>
    </aside>
    <aside id="visitor-overview-panel" class="visitor-overview-panel panel" aria-label="Besucherübersicht">
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">Alle Besucher</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-visitor-overview" class="panel-close-button" aria-label="Besucherübersicht schließen">×</button>
      </div>
      <div class="visitor-overview-controls">
        <input id="visitor-thought-filter" type="search" placeholder="Gedanken durchsuchen …" />
        <select id="visitor-overview-sort" aria-label="Besucher sortieren">
          <option value="thought">Gedanke</option>
          <option value="count">Anzahl</option>
          <option value="energy">Energie</option>
          <option value="alcohol">Alkohol</option>
          <option value="motivation">Festivallust</option>
          <option value="fun">Spaß</option>
          <option value="nausea">Übelkeit</option>
          <option value="crowding">Gedränge</option>
          <option value="attractiveness">Attraktivität</option>
          <option value="party">Partystimmung</option>
          <option value="name">Name</option>
        </select>
        <button id="visitor-sort-direction" title="Sortierrichtung">↓</button>
      </div>
      <div id="visitor-overview-summary" class="visitor-overview-summary"></div>
      <div class="visitor-overview-table-wrap">
        <table>
          <thead><tr><th>Anzahl</th><th>Gedanke</th><th>Status</th><th>Energie</th><th>Alkohol</th><th>Lust</th></tr></thead>
          <tbody id="visitor-overview-list"></tbody>
        </table>
      </div>
      <div class="visitor-overview-pages">
        <button id="visitor-page-previous">‹</button>
        <span id="visitor-page-label">Seite 1 / 1</span>
        <button id="visitor-page-next">›</button>
      </div>
    </aside>
    <aside id="staff-panel" class="staff-panel panel" aria-label="Personalverwaltung">
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title" id="staff-panel-title">Personal</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-staff" class="panel-close-button" aria-label="Personal schließen">×</button>
      </div>
      <nav class="staff-role-tabs" aria-label="Personalrolle">
        ${STAFF_ROLES.map((role) => `<button type="button" data-staff-role="${role}">${STAFF_DEFINITIONS[role].icon} ${STAFF_DEFINITIONS[role].name}</button>`).join('')}
      </nav>
      <div id="staff-list" class="staff-list"></div>
    </aside>
    <aside id="logistics-panel" class="day-plan-panel panel logistics-panel" aria-label="Logistikverwaltung">
      <div class="panel-header">
        <span class="panel-drag-line" aria-hidden="true"></span>
        <h2 class="panel-header-title">Transport & Logistik</h2>
        <span class="panel-drag-line" aria-hidden="true"></span>
        <button id="close-logistics" class="panel-close-button" aria-label="Logistik schließen">×</button>
      </div>
      <div class="logistics-management-tabs">
        <button data-logistics-tab="overview" class="active">Übersicht</button>
        <button data-logistics-tab="supply">Waren & Träger</button>
        <button data-logistics-tab="routes">Buslinien</button>
        <button data-logistics-tab="band-supply">Bandversorgung</button>
      </div>
      <section id="logistics-overview"></section>
      <section id="logistics-supply" hidden>
        <p class="scenario-hint">Mindestbestände rasten in 20er-Schritten. Träger versorgen Depots und Stände automatisch. Anlieferung und Depot baut ihr im Baumenü unter Logistik.</p>
        <label>Lager <select id="supply-depot-select"></select></label>
        <p id="supply-depot-stock" class="scenario-hint"></p>
        <label>Verwendung
          <select id="supply-depot-distribution">
            <option value="shops">Nur Versorgung von Ständen</option>
            <option value="relay">Zwischenlager: andere Depots dürfen entnehmen</option>
          </select>
        </label>
        <label>Träger am Depot: <b id="supply-workers-value">0</b></label>
        <input id="supply-workers" type="range" min="0" max="20" step="1" value="0" />
        <small>120 € je neuem Träger</small>
        <label>Essen Mindestbestand: <b id="supply-min-food-value">0</b></label>
        <input id="supply-min-food" data-supply-min="food" type="range" min="0" max="800" step="20" value="0" />
        <label>Getränke Mindestbestand: <b id="supply-min-drinks-value">0</b></label>
        <input id="supply-min-drinks" data-supply-min="drinks" type="range" min="0" max="800" step="20" value="0" />
        <label>Wasser Mindestbestand: <b id="supply-min-water-value">0</b></label>
        <input id="supply-min-water" data-supply-min="water" type="range" min="0" max="800" step="20" value="0" />
        <label>Allgemeine Waren Mindestbestand: <b id="supply-min-goods-value">0</b></label>
        <input id="supply-min-goods" data-supply-min="goods" type="range" min="0" max="800" step="20" value="0" />
        <button id="supply-remove-depot" type="button">Leeres Depot abbauen · +200 €</button>
        <p id="supply-status" class="scenario-hint"></p>
        <div id="supply-deliveries"></div>
      </section>
      <section id="logistics-routes" hidden>
        <p class="scenario-hint">Links ungenutzte Haltestellen, rechts die Fahrreihenfolge. Ziehen zum Einreihen oder Umsortieren; die gelbe Linie zeigt 1, 2, 3 … auf der Karte. Einer bestehenden Linie könnt ihr später weitere Busse hinzufügen.</p>
        <div class="line-editor">
          <label>Name <input id="bus-line-name" value="Festival-Shuttle" /></label>
          <label>Depot <select id="bus-line-depot"></select></label>
          <label>Busse <input id="bus-line-count" type="number" min="1" max="3" value="1" /></label>
          <label>Takt <input id="bus-line-headway" type="number" min="2" max="120" value="15" /> Min.</label>
          <button id="create-bus-line" class="primary">Linie anlegen</button>
          <button id="sort-bus-line" type="button">Automatisch sortieren</button>
          <button id="apply-bus-line-stops" type="button" hidden>Reihenfolge speichern</button>
        </div>
        <div class="bus-planner">
          <div class="bus-planner-column" data-planner-column="available">
            <h3>Verfügbare Haltestellen</h3>
            <div id="bus-stop-choices" class="bus-stop-choices"></div>
          </div>
          <div class="bus-planner-column" data-planner-column="active">
            <h3>Aktive Haltestellen (Fahrreihenfolge)</h3>
            <ol id="bus-line-planned" class="bus-line-planned"></ol>
          </div>
        </div>
        <div id="bus-lines-list"></div>
      </section>
      <section id="logistics-band-supply" hidden>
        <p class="scenario-hint">Backstage muss an eine Bühne grenzen oder über weitere Backstage-Felder verbunden sein. Getrennte Felder bleiben ausgewiesen, zählen aber nicht. Mehrere verbundene Bühnen teilen sich einen Pool.</p>
        <div class="band-supply-tools">
          <button type="button" id="band-supply-paint">Backstage ausweisen</button>
          <button type="button" id="band-supply-erase">Backstage entfernen</button>
          <button type="button" id="band-supply-parking">Parkplatz für den Tourbus</button>
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
          <div class="title-kicker" aria-label="AIGamesCode Studios präsentiert">AIGames<span class="kicker-swap">Watch${PUBLISHER_MARK}</span> Studios präsentiert</div>
          <h1 id="title-screen-name" class="title-name">Headliner Tycoon</h1>
          <div class="title-subtitle">Ein Gelände, ein Wochenende, euer Publikum</div>
        </div>
        <nav class="title-menu" aria-label="Hauptmenü">
          <button type="button" data-title-menu="resume" disabled><span class="title-menu-label">Fortsetzen</span><span id="title-resume-meta" class="title-menu-meta">Noch nicht gespielt</span></button>
          <button type="button" data-title-menu="new" aria-haspopup="true"><span class="title-menu-label">Neues Spiel</span><span class="title-menu-meta">${SCENARIO_PRESETS.length + 1} Szenarien</span></button>
          <button type="button" data-title-menu="quickload"><span class="title-menu-label">Schnell laden</span><span class="title-menu-meta">Letzter Einzelspielstand</span></button>
          <button type="button" data-title-menu="load"><span class="title-menu-label">Spielstand laden</span><span class="title-menu-meta">Archiv öffnen</span></button>
          <button type="button" data-title-menu="settings"><span class="title-menu-label">Einstellungen</span><span class="title-menu-meta">Debug · Festivaldaten</span></button>
        </nav>
        <div class="title-account">
          <span id="title-account-name" class="title-account-name" hidden></span>
          <button type="button" data-account="login">Anmelden</button>
          <button type="button" data-account="register">Registrieren</button>
          <button type="button" data-account="logout" hidden>Abmelden</button>
        </div>
        <div class="title-footer">
          <span>Prototype ${__APP_VERSION__}</span>
        </div>
      </div>
      <div id="title-account-mask" class="title-submenu" hidden>
        <form id="title-account-form" class="title-submenu-card title-account-card">
          <div class="title-submenu-head">
            <span id="title-account-title" class="title-submenu-title">Anmelden</span>
            <span class="title-submenu-kicker">Konto</span>
          </div>
          <label class="scenario-field"><span>Name</span><input id="account-name" name="username" type="text" autocomplete="username" maxlength="24" required /></label>
          <label class="scenario-field"><span>Passwort</span><input id="account-password" name="password" type="password" autocomplete="current-password" maxlength="200" required /></label>
          <label id="account-repeat-field" class="scenario-field" hidden><span>Passwort wiederholen</span><input id="account-repeat" name="password-repeat" type="password" autocomplete="new-password" maxlength="200" /></label>
          <p id="account-message" class="scenario-hint" role="status"></p>
          <p class="scenario-hint">Das Konto liegt auf dem Spielserver; gespeichert wird dort nur ein scrypt-Hash des Passworts, nie das Passwort selbst. Die Verbindung läuft unverschlüsselt über HTTP — nimm also kein Passwort, das du anderswo benutzt.</p>
          <div class="title-account-actions">
            <button id="account-submit" type="submit">Anmelden</button>
            <button id="account-switch" type="button">Noch kein Konto? Registrieren</button>
            <button type="button" data-account-close>Zurück</button>
          </div>
        </form>
      </div>
      <div id="title-load-mask" class="title-submenu" hidden>
        <div class="title-submenu-card">
          <div class="title-submenu-head">
            <span class="title-submenu-title">Spielstand laden</span>
            <span id="title-load-kicker" class="title-submenu-kicker">Archiv</span>
          </div>
          <div id="title-load-rows" class="title-submenu-rows"></div>
          <p id="title-load-note" class="scenario-hint"></p>
          <button type="button" data-title-load-close>Zurück</button>
        </div>
      </div>
      <div id="title-submenu" class="title-submenu" hidden>
        <div class="title-submenu-card">
          <div class="title-submenu-head">
            <span class="title-submenu-title">Neues Spiel</span>
            <span class="title-submenu-kicker">Szenario wählen</span>
          </div>
          <div class="title-submenu-rows">
            <button type="button" data-title-scenario="" aria-haspopup="true"><span class="title-row-text"><span class="title-row-label">Freies Spiel</span><span class="title-row-meta">Gelände, Publikum und Startkapital selbst festlegen — ohne Vorgaben und ohne Ziele.</span></span><span class="title-row-value">frei</span></button>
            ${SCENARIO_PRESETS.map((entry) => `<button type="button" data-title-scenario="${entry.id}"${entry.price ? ` data-title-locked="${entry.price}" aria-disabled="true"` : ''}><span class="title-row-text"><span class="title-row-label">${entry.name}</span><span class="title-row-meta">${entry.detail}</span></span><span class="title-row-value">${entry.price ? `<span class="title-row-lock" aria-hidden="true">🔒</span>${entry.price}` : `${entry.settings.worldSize} × ${entry.settings.worldSize}`}</span></button>`).join('')}
          </div>
          <button type="button" data-title-back>Zurück</button>
        </div>
      </div>
      <div id="title-freeplay-mask" class="title-submenu" hidden>
        <div class="title-submenu-card">
          <div class="title-submenu-head">
            <span class="title-submenu-title">Freies Spiel</span>
            <span class="title-submenu-kicker">Gelände &amp; Publikum</span>
          </div>
          <div id="title-freeplay" class="title-freeplay">
          <p class="scenario-hint">Diese Werte gelten für die ganze Partie und lassen sich später nicht mehr ändern.</p>
      <label class="scenario-field"><span>Umgebung</span><select id="scenario-environment">${Object.entries(ENVIRONMENTS).map(([id, e]) => `<option value="${id}">${e.name}</option>`).join('')}</select></label>
      <p id="scenario-ground-details" class="scenario-hint"></p>
      <label class="scenario-field"><span>Geländeunebenheit <b id="scenario-unevenness-value">50 %</b></span><small>0 %: vollständig flach · 100 %: stark hügelig. Eingang und Zufahrt bleiben eben.</small><input id="scenario-unevenness" type="range" min="0" max="100" step="5" value="50" /></label>
      <label class="scenario-field">
        <span>Autobesucher <b id="scenario-car-value">78%</b></span>
        <small>Fußgänger ← → Autos</small>
        <input id="scenario-car-share" type="range" min="0" max="100" step="1" value="78" />
      </label>
      <label class="scenario-field">
        <span>Party-Affinität <b id="scenario-party-value">55%</b></span>
        <small>ruhig ← → partyaffin</small>
        <input id="scenario-party" type="range" min="0" max="100" step="1" value="55" />
      </label>
      <label class="scenario-field">
        <span>Schönheits-Affinität <b id="scenario-beauty-value">55%</b></span>
        <small>egal ← → schönheitsaffin</small>
        <input id="scenario-beauty" type="range" min="0" max="100" step="1" value="55" />
      </label>
      <label class="scenario-field">
        <span>Gewaltbereitschaft <b id="scenario-aggression-value">28%</b></span>
        <small>friedlich ← → gewaltbereit</small>
        <input id="scenario-aggression" type="range" min="0" max="100" step="1" value="28" />
      </label>
      <label class="scenario-field">
        <span>Startgeld <b id="scenario-money-value">10.000 €</b></span>
        <input id="scenario-money" type="range" min="5000" max="250000" step="5000" value="10000" />
      </label>
      <label class="scenario-field">
        <span>Kartengröße</span>
        <select id="scenario-world-size">
          <option value="32">Klein (32×32)</option>
          <option value="48">Normal (48×48)</option>
          <option value="64">Groß (64×64)</option>
          <option value="80">Sehr groß (80×80)</option>
          <option value="265">Riesig (265×265)</option>
        </select>
      </label>
          </div>
          <div class="title-freeplay-actions">
            <button id="start-scenario" type="button">▶ Freies Spiel starten</button>
            <button type="button" data-title-freeplay-close>Zurück</button>
          </div>
        </div>
      </div>
    </div>
    <div id="toast" role="status" aria-live="polite"></div>
  </main>
`
}
