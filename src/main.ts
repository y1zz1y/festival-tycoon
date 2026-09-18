import { contextDemolitionTarget } from './game/contextDemolition'
import { isDecorationCatalogKind } from './game/decoration'
import { scenerySlot } from './game/scenery'
import { makeDraggable, makeResizable } from './dragPanel'
import { mountStageEditor } from './stageEditor'
import { stageStats } from './game/stageDesign'
import { mountStaffDetails } from './staffDetailsUI'
import { mountLogisticsUI } from './logisticsUI'
import './style.css'
import { mountFestivalUI } from './festivalUI'
import { mountTickerUI } from './tickerUI'
import { SUPPLIES, WEATHER_ICONS, WEATHER_NAMES, formatTemperature, temperatureAt } from './game/festivalManagement'
import type { Supply } from './game/festivalManagement'
import {
  SHIRT_STYLES,
} from './game/shopGoods'
import { snapStockMinimum } from './game/supplyChain'
import { BUILDING_KINDS, BUILDINGS, isCopyTool } from './game/catalog'
import {
  captureBlueprint,
  describeBlueprint,
  type Blueprint,
} from './game/blueprints'
import {
  deleteBlueprintLibraryEntry,
  listBlueprintLibrary,
  saveBlueprintLibraryEntry,
} from './game/blueprintLibrary'
import { FINANCE_CATEGORIES, FINANCE_CATEGORY_NAMES, financeEntriesTotal, financePeriodTotal } from './game/finance'
import { goalName, goalProgressText } from './game/scenarioGoals'
import { refreshAccount } from './accounts'
import type { BuildingKind, Tool } from './game/catalog'
import type { PlacementPreviewResult } from './game/placementPreview'
import {
  buildCategoryById,
  categoryForTool,
  subgroupForTool,
  type BuildCategoryId,
} from './game/buildMenu'
import {
  DEFAULT_DECORATION_THEME,
  decorationThemeOf,
  isDecorationThemeId,
  type DecorationThemeId,
} from './game/decoration'
import {
  TRACK_PIECE_KINDS,
  TRACK_PIECES,
  getCoasterType,
  type CoasterTypeId,
} from './game/coasters'
import {
  applyConstructionBank,
  applyConstructionKind,
  applyConstructionPitch,
  constantPitchPieceKind,
  isTrackBankChoiceCurrentlyEnabled,
  isTrackPalettePieceEnabled,
  isTrackPitchChoiceCurrentlyEnabled,
  resolveNextTrackPiece,
  type CoasterWindowState,
} from './game/coasterConnections'
import type { CoasterOperationMode, DispatchMode, TrackPieceKind } from './game/coasters'
import { GameState } from './game/GameState'
import { applyBusPlannerDrag, type BusPlannerColumn } from './game/busPlanner'
import {
  ACCESS_HOURS_PER_DAY,
  ACCESS_SCHEDULE_TIME_LABELS,
  areaPreviewText,
  currentAccessSlot,
  isAccessScheduleOpen,
  previewLabel,
  resolvedScheduleTime,
  toggleAreaCells,
  type AccessControl,
  type AccessControlMode,
  type AccessScheduleTime,
} from './game/accessControl'
import type { PlacedBuilding } from './game/GameState'
import type { RoadCell } from './game/logistics'
import {
  describeRoadVehicleActivity,
} from './game/logistics'
import {
  wasteDumpId,
} from './game/waste'
import { groupVisitorsByThought } from './game/visitorThoughts'
import { enableMultiplayerCommands } from './net/bind'
import { MultiplayerSession } from './net/session'
import type { MultiplayerStatus } from './net/session'
import { SIMULATION_CONFIG } from './game/simulationConfig'
import { INVENTORY_ITEMS } from './game/inventory'
import { STAFF_DEFINITIONS, STAFF_ROLES, SWEEPER_STAFF_ICON, sweeperStaffName } from './game/staff'
import type { StaffRole, StaffState } from './game/staff'
import {
  DAY_PLAN_OFFERS,
  DAY_PLAN_OFFER_LABELS,
  FESTIVAL_PHASE_LABELS,
  FESTIVAL_PHASES,
  getFestivalCycleStatus,
  isDayVisitorAdmissionOpen,
  isFestivalOfferActive,
} from './game/dayPlan'
import type { DayPlanOffer, FestivalPhase } from './game/dayPlan'
import {
  COMPLAINT_LABELS,
  COMPLAINT_TOPICS,
} from './game/complaints'
import {
  lockShiftElevationOrigin,
  planLockedOriginRamp,
} from './game/wayElevation'
import { WorldView } from './view/WorldView'
import { FestivalAudio } from './view/FestivalAudio'
import type { CellPosition, PathAnchor } from './view/WorldView'
import { isTextEntryTarget } from './uiFocus'
import { mountTitleScreen, type TitleScreenController } from './ui/titleScreen'
import { mountSaveController } from './ui/saveController'
import { createScenarioFormController } from './ui/scenarioScreen'
import { mountMobileUI } from './mobileUI'
import { mountUpdateNotice } from './updateNotice'
import { startGameLoop } from './app/gameLoop'
import { mountAppShell } from './app/shell'
import { applyDirectCellTool } from './input/toolRouter'
import {
  handleCoasterCell,
  handleInspectCell,
  handlePathEditorCell,
} from './input/cellToolHandlers'
import {
  createPathToolController,
  rectangleCells,
  type PathToolController,
} from './input/pathToolController'
import { createBuildCatalog } from './ui/buildCatalog'
import { DifferentialUpdates, listFingerprint } from './ui/differentialUpdates'
import { escapeHtml, formatMoney, formatTime } from './ui/format'
import {
  updateEntityPanel as renderEntityPanel,
  type EntitySelection,
} from './ui/entityPanel'
import { contextHelpText } from './ui/contextHelp'
import { updateCoasterBuilderPanel } from './ui/coasterBuilderPanel'
import { mountVisitorPanel } from './ui/visitorPanel'

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Benötigtes UI-Element fehlt: ${selector}`)
  return element
}

function setPanelOpen(
  panel: HTMLElement,
  button: HTMLButtonElement,
  open: boolean,
  onOpen?: () => void,
): void {
  panel.classList.toggle('visible', open)
  button.setAttribute('aria-expanded', String(open))
  if (open) onOpen?.()
}

function closeBuildSubmenus(): void {
  document
    .querySelectorAll<HTMLElement>('[data-build-category]')
    .forEach((element) => element.classList.remove('open'))
}

const AUDIO_MUTE_KEY = 'festival-audio-muted'
/** The one slot the automatic save writes to, over and over. */
const AUTOSAVE_NAME = 'Autospeichern'

const app = requireElement<HTMLDivElement>('#app')

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
        <button type="button" data-build-category="roads" title="Autostraßen" aria-label="Autostraßen" aria-expanded="false">🛣️</button>
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

mountAppShell(requireElement<HTMLDivElement>('#app'))

// Left stats bar and the icon toolbar can have different bottoms. Panels
// spawn below whichever is lower.
const topbarElement = requireElement<HTMLElement>('.topbar')
const statusOverlay = requireElement<HTMLElement>('#status-overlay')
const toolbarElement = requireElement<HTMLElement>('.rct-toolbar')
const syncTopOffsets = (): void => {
  const topbar = topbarElement.getBoundingClientRect()
  const toolbar = toolbarElement.getBoundingClientRect()
  const bottom = Math.max(topbar.bottom, toolbar.bottom)
  document.documentElement.style.setProperty('--topbar-gap-top', `${Math.round(bottom + 12)}px`)
  document.documentElement.style.setProperty(
    '--toolbar-width',
    `${Math.round(toolbar.width + 18)}px`,
  )
}
new ResizeObserver(syncTopOffsets).observe(topbarElement)
new ResizeObserver(syncTopOffsets).observe(toolbarElement)

const trackPieceSelect = requireElement<HTMLSelectElement>('#track-piece')
const trackDirectionPalette = requireElement<HTMLElement>('#track-direction-palette')
const trackSlopePalette = requireElement<HTMLElement>('#track-slope-palette')
const trackBankPalette = requireElement<HTMLElement>('#track-bank-palette')
const trackSpecialPalette = requireElement<HTMLElement>('#track-special-palette')
const trackSpecialToggle = requireElement<HTMLButtonElement>('#toggle-track-specials')
TRACK_PIECE_KINDS.forEach((kind) => {
  const piece = TRACK_PIECES[kind]
  trackPieceSelect.insertAdjacentHTML(
    'beforeend',
    `<option value="${kind}">${piece.name} · ${formatMoney(piece.cost)}</option>`,
  )
})
const coasterTypeName = requireElement<HTMLElement>('#coaster-type-name')
const coasterTypeHint = requireElement<HTMLElement>('#coaster-type-hint')

const canvas = requireElement<HTMLCanvasElement>('#game-canvas')
const money = requireElement<HTMLElement>('#money')
const guests = requireElement<HTMLElement>('#guests')
const reputation = requireElement<HTMLElement>('#reputation')
const power = requireElement<HTMLElement>('#power')
const waste = requireElement<HTMLElement>('#waste')
const date = requireElement<HTMLElement>('#date')
const weatherStat = requireElement<HTMLElement>('#weather-stat')
const weatherIcon = requireElement<HTMLElement>('#weather-icon')
const weatherName = requireElement<HTMLElement>('#weather')
const temperature = requireElement<HTMLElement>('#temperature')
const toggleParkButton = requireElement<HTMLButtonElement>('#toggle-park')
const logisticsOverlayButton =
  requireElement<HTMLButtonElement>('#toggle-logistics-overlay')
const crowdingOverlayButton =
  requireElement<HTMLButtonElement>('#toggle-crowding-overlay')
const averageCrowding = requireElement<HTMLElement>('#average-crowding')
const averageCrowdingBar = requireElement<HTMLElement>('#average-crowding-bar')
const attractivenessOverlayButton =
  requireElement<HTMLButtonElement>('#toggle-attractiveness-overlay')
const partyOverlayButton =
  requireElement<HTMLButtonElement>('#toggle-party-overlay')
const averageAttractiveness =
  requireElement<HTMLElement>('#average-attractiveness')
const averageAttractivenessBar =
  requireElement<HTMLElement>('#average-attractiveness-bar')
const averageParty = requireElement<HTMLElement>('#average-party')
const averagePartyBar = requireElement<HTMLElement>('#average-party-bar')
const contextHelp = requireElement<HTMLElement>('#context-help')
const toast = requireElement<HTMLElement>('#toast')
const pathConstruction = requireElement<HTMLElement>('#path-construction')
makeDraggable(requireElement<HTMLElement>('.path-construction-header'), pathConstruction)
const constructionStatus = requireElement<HTMLElement>('#construction-status')
const buildPathButton = requireElement<HTMLButtonElement>('#build-path')
const undoPathButton = requireElement<HTMLButtonElement>('#undo-path')
const pathDemolishButton = requireElement<HTMLButtonElement>('#path-demolish')
const pathConstructionTypeSelect =
  requireElement<HTMLSelectElement>('#path-construction-type')
const PATH_WINDOW_TOOLS: Tool[] = ['path', 'pathBarrier', 'staffGate', 'securityGate']
const ROAD_WINDOW_TOOLS: Tool[] = buildCategoryById('roads').groups.flatMap(group => group.items.map(item => item.tool))
const coasterBuilder = requireElement<HTMLElement>('#coaster-builder')
const coasterConstructionTitle = requireElement<HTMLElement>('#coaster-construction-title')
const coasterStatus = requireElement<HTMLElement>('#coaster-status')
const coasterDirection = requireElement<HTMLElement>('#coaster-direction')
const coasterPiecePreview = requireElement<HTMLElement>('#coaster-piece-preview')
const coasterPieceLabel = requireElement<HTMLElement>('#coaster-piece-label')
const coasterRotateButton = requireElement<HTMLButtonElement>('#coaster-rotate')
const coasterBuildButton = requireElement<HTMLButtonElement>('#coaster-build-piece')
const coasterUndoButton = requireElement<HTMLButtonElement>('#coaster-undo')
const coasterEntranceButton = requireElement<HTMLButtonElement>('#place-coaster-entrance')
const coasterExitButton = requireElement<HTMLButtonElement>('#place-coaster-exit')
const demolishCoasterConstructionButton = requireElement<HTMLButtonElement>(
  '#demolish-coaster-construction',
)
const chainLiftInput = requireElement<HTMLInputElement>('#chain-lift')
const trackPreviousButton = requireElement<HTMLButtonElement>('#track-previous')
const trackNextButton = requireElement<HTMLButtonElement>('#track-next')
const trackSelection = requireElement<HTMLElement>('#track-selection')
const deleteTrackButton = requireElement<HTMLButtonElement>('#delete-track-from-here')
const entityPanel = requireElement<HTMLElement>('#entity-panel')
const entityStats = requireElement<HTMLElement>('#entity-stats')
const entityOverview = requireElement<HTMLElement>('#entity-overview')
const entityPriceInput = requireElement<HTMLInputElement>('#entity-price')
const applyPriceToKindButton =
  requireElement<HTMLButtonElement>('#apply-price-to-kind')
const shirtColorPalette = requireElement<HTMLElement>('#shirt-color-palette')
const shirtStyleSelect = requireElement<HTMLSelectElement>('#shirt-style')
const dispatchModeSelect = requireElement<HTMLSelectElement>('#dispatch-mode')
const dispatchIntervalInput = requireElement<HTMLInputElement>('#dispatch-interval')
const dispatchValue = requireElement<HTMLElement>('#dispatch-value')
const operationModeSelect = requireElement<HTMLSelectElement>('#operation-mode')
const accessControlOptions = requireElement<HTMLElement>('#access-control-options')
const accessSchedule = requireElement<HTMLElement>('#access-schedule')
const accessSensor = requireElement<HTMLElement>('#access-sensor')
const accessSlotsWrap = requireElement<HTMLElement>('#access-slots-wrap')
const accessSlots = requireElement<HTMLElement>('#access-slots')
const accessHours = requireElement<HTMLElement>('#access-hours')
const accessHourGrid = requireElement<HTMLElement>('#access-hour-grid')
const accessDayPlan = requireElement<HTMLElement>('#access-day-plan')
const accessScheduleOffer = requireElement<HTMLSelectElement>('#access-schedule-offer')
const accessScheduleHint = requireElement<HTMLElement>('#access-schedule-hint')
const accessSensorKind = requireElement<HTMLSelectElement>('#access-sensor-kind')
const accessThreshold = requireElement<HTMLInputElement>('#access-threshold')
const accessThresholdLabel = requireElement<HTMLElement>('#access-threshold-label')
const accessPreview = requireElement<HTMLElement>('#access-preview')
const accessDrawArea = requireElement<HTMLButtonElement>('#access-draw-area')
const accessPassage = requireElement<HTMLElement>('#access-passage')
const accessEmergency = requireElement<HTMLElement>('#access-emergency')
const accessOpenInEmergency = requireElement<HTMLInputElement>('#access-open-in-emergency')
const accessClearArea = requireElement<HTMLButtonElement>('#access-clear-area')
const securityThoroughness =
  requireElement<HTMLInputElement>('#security-thoroughness')
const securityThoroughnessValue =
  requireElement<HTMLElement>('#security-thoroughness-value')
const securityFlowShare = requireElement<HTMLInputElement>('#security-flow-share')
const securityFlowShareValue =
  requireElement<HTMLElement>('#security-flow-share-value')
const securityProhibitedItems =
  requireElement<HTMLElement>('#security-prohibited-items')
const staffPanel = requireElement<HTMLElement>('#staff-panel')
const staffList = requireElement<HTMLElement>('#staff-list')
const visitorOverviewPanel =
  requireElement<HTMLElement>('#visitor-overview-panel')
const complaintsPanel = requireElement<HTMLElement>('#complaints-panel')
const complaintsSummary = requireElement<HTMLElement>('#complaints-summary')
const complaintsList = requireElement<HTMLElement>('#complaints-list')
const logisticsPanel = requireElement<HTMLElement>('#logistics-panel')
for (const panel of [staffPanel, visitorOverviewPanel, complaintsPanel, logisticsPanel]) {
  makeDraggable(panel.querySelector<HTMLElement>('.panel-header')!, panel)
  makeResizable(panel)
}
const logisticsOverview = requireElement<HTMLElement>('#logistics-overview')
const logisticsSupply = requireElement<HTMLElement>('#logistics-supply')
const logisticsRoutes = requireElement<HTMLElement>('#logistics-routes')
const logisticsBandSupply = requireElement<HTMLElement>('#logistics-band-supply')
const bandSupplyList = requireElement<HTMLElement>('#band-supply-list')
const bandSupplyPreview = requireElement<HTMLElement>('#band-supply-preview')
let backstageEraseMode = false
const supplyDepotSelect = requireElement<HTMLSelectElement>('#supply-depot-select')
const supplyDepotStock = requireElement<HTMLElement>('#supply-depot-stock')
const supplyDepotDistribution = requireElement<HTMLSelectElement>('#supply-depot-distribution')
const supplyWorkers = requireElement<HTMLInputElement>('#supply-workers')
const supplyWorkersValue = requireElement<HTMLElement>('#supply-workers-value')
const supplyStatus = requireElement<HTMLElement>('#supply-status')
const supplyDeliveries = requireElement<HTMLElement>('#supply-deliveries')
const supplyRemoveDepot = requireElement<HTMLButtonElement>('#supply-remove-depot')
const depotOptions = requireElement<HTMLElement>('#depot-options')
const depotDistribution = requireElement<HTMLSelectElement>('#depot-distribution')
const depotWorkers = requireElement<HTMLInputElement>('#depot-workers')
const depotWorkersValue = requireElement<HTMLElement>('#depot-workers-value')
const depotRemove = requireElement<HTMLButtonElement>('#depot-remove')
const busLineDepot = requireElement<HTMLSelectElement>('#bus-line-depot')
const busStopChoices = requireElement<HTMLElement>('#bus-stop-choices')
const busLinePlanned = requireElement<HTMLOListElement>('#bus-line-planned')
const applyBusLineStops = requireElement<HTMLButtonElement>('#apply-bus-line-stops')
const sortBusLine = requireElement<HTMLButtonElement>('#sort-bus-line')
const busPlannerRoot = requireElement<HTMLElement>('.bus-planner')
const busLinesList = requireElement<HTMLElement>('#bus-lines-list')
const plannedBusStopIds: string[] = []
let editingBusLineId: string | null = null
let busPlannerStopsFingerprint = ''
let busPlannerDragging = false
const visitorOverviewList =
  requireElement<HTMLElement>('#visitor-overview-list')
const visitorOverviewSummary =
  requireElement<HTMLElement>('#visitor-overview-summary')
const visitorThoughtFilter =
  requireElement<HTMLInputElement>('#visitor-thought-filter')
const visitorOverviewSort =
  requireElement<HTMLSelectElement>('#visitor-overview-sort')
const visitorSortDirection =
  requireElement<HTMLButtonElement>('#visitor-sort-direction')
const visitorPagePrevious =
  requireElement<HTMLButtonElement>('#visitor-page-previous')
const visitorPageNext =
  requireElement<HTMLButtonElement>('#visitor-page-next')
const visitorPageLabel = requireElement<HTMLElement>('#visitor-page-label')
const multiplayerToggle = requireElement<HTMLButtonElement>('#toggle-multiplayer')
const multiplayerPanel = requireElement<HTMLElement>('#multiplayer-panel')
const multiplayerStatusBadge = requireElement<HTMLElement>('#multiplayer-status-badge')
const multiplayerStatus = requireElement<HTMLElement>('#multiplayer-status')
const multiplayerName = requireElement<HTMLInputElement>('#multiplayer-name')
const multiplayerCode = requireElement<HTMLInputElement>('#multiplayer-code')
const multiplayerHostButton = requireElement<HTMLButtonElement>('#multiplayer-host')
const multiplayerJoinButton = requireElement<HTMLButtonElement>('#multiplayer-join')
const multiplayerLeaveButton = requireElement<HTMLButtonElement>('#multiplayer-leave')
const multiplayerCopyButton = requireElement<HTMLButtonElement>('#multiplayer-copy')
const multiplayerRoom = requireElement<HTMLElement>('#multiplayer-room')
const multiplayerCodeDisplay = requireElement<HTMLElement>('#multiplayer-code-display')
const multiplayerJoinUrl = requireElement<HTMLElement>('#multiplayer-join-url')
const multiplayerPlayers = requireElement<HTMLElement>('#multiplayer-players')
const multiplayerConnectActions = requireElement<HTMLElement>(
  '#multiplayer-connect-actions',
)
const multiplayerCodeField = requireElement<HTMLElement>('#multiplayer-code-field')
const multiplayerJoinActions = requireElement<HTMLElement>('#multiplayer-join-actions')

const MULTIPLAYER_NAME_KEY = 'festival-mp-name'

let game = new GameState()
const festivalUI = mountFestivalUI(() => game, showToast, (pane) => {
  if (pane === 'dayplan') updateDayPlanPanel(true)
})
const dayPlanGrid = requireElement<HTMLElement>('#day-plan-grid')
const dayPlanStatus = requireElement<HTMLElement>('#day-plan-status')
const dayEntryHour = requireElement<HTMLSelectElement>('#day-entry-hour')
const dayExitHour = requireElement<HTMLSelectElement>('#day-exit-hour')
const festivalLeadDays =
  requireElement<HTMLInputElement>('#festival-lead-days')
const festivalActiveDays =
  requireElement<HTMLInputElement>('#festival-active-days')
const festivalBreakDays =
  requireElement<HTMLInputElement>('#festival-break-days')
const festivalCycleStrip =
  requireElement<HTMLElement>('#festival-cycle-strip')
const campingCapacityBuffer =
  requireElement<HTMLInputElement>('#camping-capacity-buffer')
const campingCapacitySummary =
  requireElement<HTMLElement>('#camping-capacity-summary')
const stageEditor = mountStageEditor(() => game, showToast)
const stageEditorButton = document.createElement('button')
stageEditorButton.id = 'open-stage-editor'
stageEditorButton.textContent = '🏗️'
stageEditorButton.title = 'Bühnenwerkstatt'
stageEditorButton.setAttribute('aria-label', 'Bühnenwerkstatt')
stageEditorButton.setAttribute('aria-expanded', 'false')
stageEditorButton.addEventListener('click', () => {
  if (stageEditor.isOpen()) stageEditor.close()
  else stageEditor.open()
})
document.querySelector('#action-group-festival')!.append(stageEditorButton)
const editStageButton = document.createElement('button')
editStageButton.id = 'edit-selected-stage'
editStageButton.textContent='Bühne gestalten';editStageButton.hidden=true
entityOverview.append(editStageButton)
editStageButton.addEventListener('click',()=>{if(selectedEntity?.type==='building')stageEditor.open(selectedEntity.id)})
const multiplayer = new MultiplayerSession(game)
let hoveredCell: CellPosition | null = null
let rideAccessPlacement: {id:string;type:'entrance'|'exit'} | null = null
let activeRideId: string | null = null
let staffPanelFingerprint = ''
let visitorOverviewFingerprint = ''
let dayPlanFingerprint = ''
let complaintsFingerprint = ''
let logisticsFingerprint = ''
let visitorOverviewPage = 0
let visitorOverviewAscending = false

const hourOptions = Array.from(
  { length: 24 },
  (_, hour) =>
    `<option value="${hour}">${String(hour).padStart(2, '0')}:00</option>`,
).join('')
dayEntryHour.innerHTML = hourOptions
dayExitHour.innerHTML = hourOptions
let pathWindowOpen = false
let roadEditorOpen = false
let pathEditorActive = false
let pathDemolishActive = false
let pathAnchor: PathAnchor | null = null
let shiftElevationHeld = false
let shiftElevationOrigin: PathAnchor | null = null
let lastShiftPaintKey = ''
let pathDirection = 0
let pathSlope = 0
let pathConstructionType: 'normal' | 'queue' = 'normal'
let pathHistory: Array<{
  from: PathAnchor
  to: PathAnchor
  previousPath?: PlacedBuilding
  previousRoad?: RoadCell
  roadExisted?: boolean
}> = []
let copyClipboard: Blueprint | null = null
let cameraQuarter = 0
let coasterBuilderActive = false
let activeCoasterId: string | null = null
let coasterStartCandidate: CellPosition | null = null
let coasterEditIndex = -1
let coasterAccessMode: 'entrance' | 'exit' | null = null
let coasterTargetPitch = 0
let coasterTargetBank = 0
let pendingCoasterTypeId: CoasterTypeId = 'classicSteel'
let coasterSelectedKind: TrackPieceKind = 'station'
let lastCoasterConstructionKey: string | null = null
let selectedEntity: EntitySelection | null = null
let logisticsOverlayVisible = false
let accessAreaDrawing = false
let entityTab: 'overview' | 'dynamics' = 'overview'
let unsubscribe: () => void = () => {}
let toastTimer = 0
let crowdingOverlayVisible = false
let attractivenessOverlayVisible = false
let partyOverlayVisible = false
const differentialUpdates = new DifferentialUpdates()
let pathToolController: PathToolController

let view: WorldView
try {
  view = new WorldView(
    canvas,
    (cell) => handleCellClick(cell),
    (cell) => {
      hoveredCell = cell
      refreshPlacementPreview()
      updateRideAccessPreview(cell)
      updateCopyPreview(cell)
      if (shiftElevationApplies()) {
        beginShiftElevationLock(cell)
        previewShiftElevation(cell)
      }
      updateContextHelp()
    },
    (visitorId) => selectVisitor(visitorId),
    (cell) => pathToolController.paint(cell),
    (delta) => {
      if (pathEditorActive) {
        setPathSlope(pathSlope + delta)
      } else {
        game.adjustBuildElevation(delta)
      }
    },
    (cell) => pathToolController.start(cell),
    () => pathToolController.finish(),
    (coasterId, pieceIndex) => {
      if (!coasterBuilderActive) return
      const coaster = game.getCoaster(coasterId)
      if (!coaster) return
      activeCoasterId = coasterId
      coasterStartCandidate = null
      coasterEditIndex = Math.max(0, Math.min(coaster.pieces.length - 1, pieceIndex))
      coasterTargetPitch = coaster.pieces[coasterEditIndex]?.end.pitch ?? 0
      coasterTargetBank = coaster.pieces[coasterEditIndex]?.end.bank ?? 0
      coasterSelectedKind = 'straight'
      trackPieceSelect.value = constantPitchPieceKind(coasterTargetPitch)
      updateCoasterBuilder()
      showToast(`Bauanker auf Element ${coasterEditIndex + 1} gesetzt`)
    },
  )
} catch (error) {
  console.error('WorldView-Initialisierung fehlgeschlagen (WebGL nicht verfügbar?):', error)
  document.body.innerHTML = `
    <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;overflow:auto;padding:24px;box-sizing:border-box;background:#17241f;color:#edf7f1;font:14px/1.6 Tahoma, Verdana, system-ui, sans-serif;">
      <div style="max-width:480px;">
        <h1 style="font-size:20px;margin:0 0 12px;">3D-Grafik nicht verfügbar</h1>
        <p>Headliner Tycoon benötigt WebGL, das dieser Browser oder dieses System gerade nicht bereitstellt.</p>
        <p>Mögliche Ursachen: WebGL ist im Browser deaktiviert (in Firefox unter <code>about:config</code> die Einstellung <code>webgl.disabled</code> prüfen), eine Sicherheits- oder Unternehmensrichtlinie blockiert es, oder die Grafiktreiber sind veraltet bzw. von der Blockliste des Browsers betroffen.</p>
        <p>Bitte aktuelle Grafiktreiber sicherstellen oder einen anderen Browser probieren.</p>
      </div>
    </div>
  `
  throw error
}

const supplyPlanner = mountLogisticsUI(() => game, view, showToast)
pathToolController = createPathToolController({
  getGame: () => game,
  getModes: () => ({
    editorActive: pathEditorActive,
    demolishActive: pathDemolishActive,
    constructionType: pathConstructionType,
    direction: pathDirection,
    backstageEraseMode,
  }),
  getFootType: () => supplyPlanner.getFootType(),
  getRoadType: () => supplyPlanner.getRoadType(),
  applyCopySelection,
  demolish: demolishPathAt,
  showToast,
}, view)
view.setConstructionHandlers((height, cell) => {
  game.setBuildElevation(height)
  if (pathEditorActive && cell) {
    const anchorCell = shiftElevationOrigin ?? cell
    pathAnchor = { x: anchorCell.x, z: anchorCell.z, elevation: game.getTerrainHeight(anchorCell.x, anchorCell.z) + height }
    shiftElevationOrigin = { ...pathAnchor }
    updatePathEditor()
  }
}, (cell, picked) => {
  const tool = game.snapshot.selectedTool
  if (!(isDecorationCatalogKind(tool) || tool === 'path' || tool === 'road')) return false
  if (!cell) return true
  const target = contextDemolitionTarget(game.snapshot, tool, cell, picked?.buildingId)
  if (target?.type === 'road') {
    showToast(game.undoRoadSegment(target.road.x, target.road.z, undefined, target.road.elevation).message)
  } else if (target?.type === 'building') {
    showToast(game.bulldoze(target.building.x, target.building.z, target.building.id).message)
  }
  return true
})
const staffDetails = mountStaffDetails(() => game, view, showToast, () => supplyPlanner.releaseTool())
const visitorPanelController = mountVisitorPanel({
  getGame: () => game,
  getPreviewMode: () => visitorPreviewMode,
  view,
  closeEntityPanel: () => { closeEntityPanel(); staffDetails.close() },
})
const tickerUI = mountTickerUI({
  focusWorld: (x, z) => view.focusWorldPosition(x, z),
})
const walkModeButton = requireElement<HTMLButtonElement>('#toggle-walk-mode')
const walkHud = requireElement<HTMLElement>('#walk-hud')
const walkStick = requireElement<HTMLElement>('#walk-stick')
const walkStickKnob = requireElement<HTMLElement>('.walk-stick-knob')
const controlHint = requireElement<HTMLElement>('#control-hint')
const syncWalkModeUi = (enabled: boolean): void => {
  walkModeButton.setAttribute('aria-pressed', String(enabled))
  // Icon-only, like every other button in the toolbar — the wording lives in the tooltip.
  const walkLabel = enabled ? 'Zurück zur Karte' : 'Gelände betreten'
  walkModeButton.textContent = enabled ? '🗺️' : '🚶'
  walkModeButton.title = walkLabel
  walkModeButton.setAttribute('aria-label', walkLabel)
  walkHud.hidden = !enabled
  document.body.classList.toggle('walk-mode', enabled)
  const coarse = window.matchMedia('(pointer: coarse)').matches
  walkStick.hidden = !enabled || !coarse
  const hint = walkHud.querySelector('p')
  if (hint) {
    hint.textContent = coarse
      ? 'Stick laufen · Ziehen umsehen · Zurück zur Karte oben'
      : 'WASD laufen · Umschalt rennen · Klick und Maus umsehen · Esc zurück zur Karte'
  }
  controlHint.textContent = enabled
    ? (coarse ? 'Stick laufen · Ziehen umsehen' : 'WASD laufen · Umschalt rennen · Maus umsehen · Esc Karte')
    : 'Weg ziehen · Shift+Maus: Bauhöhe · R: Gebäude drehen · Q/E: Kamera'
  contextHelp.textContent = enabled
    ? 'Du läufst über das Festivalgelände.'
    : 'Wähle ein Werkzeug und klicke auf das Gelände.'
}
const setFestivalWalk = (enabled: boolean): void => {
  if (enabled) {
    setMapOverlay(null)
    supplyPlanner.close()
    supplyPlanner.releaseTool()
    game.setTool('inspect')
    hideVisitorPanel()
    staffDetails.close()
    closeEntityPanel()
  }
  view.setWalkMode(enabled)
}
view.setVehicleClickHandler((vehicleId) => {
  const vehicle = game.snapshot.logistics.roadVehicles.find((entry) => entry.id === vehicleId)
  if (vehicle?.kind === 'sweeper') {
    openSweeperStaff(vehicleId)
    return
  }
  openEntityInfoForVehicle(vehicleId)
})
view.setAccessControlClickHandler((accessId) => openEntityInfoForAccess(accessId))
view.setWalkModeListener(syncWalkModeUi)
walkModeButton.addEventListener('click', () => setFestivalWalk(!view.isWalkMode()))
const festivalAudio = new FestivalAudio()
const muteAudioButton = requireElement<HTMLButtonElement>('#toggle-mute')
const muteAudioToggle = requireElement<HTMLInputElement>('#setting-mute-audio')
const readAudioMuted = (): boolean => {
  try {
    return window.localStorage.getItem(AUDIO_MUTE_KEY) === '1'
  } catch {
    return false
  }
}
const syncMuteUi = (muted: boolean): void => {
  festivalAudio.setMuted(muted)
  muteAudioToggle.checked = muted
  muteAudioButton.setAttribute('aria-pressed', String(muted))
  muteAudioButton.textContent = muted ? '🔇' : '🔊'
  const label = muted ? 'Ton einschalten' : 'Ton stumm'
  muteAudioButton.title = label
  muteAudioButton.setAttribute('aria-label', label)
}
const setAudioMuted = (muted: boolean): void => {
  syncMuteUi(muted)
  try {
    window.localStorage.setItem(AUDIO_MUTE_KEY, muted ? '1' : '0')
  } catch {
    /* session-only mute */
  }
}
syncMuteUi(readAudioMuted())
muteAudioButton.addEventListener('click', () => setAudioMuted(!festivalAudio.isMuted()))
muteAudioToggle.addEventListener('change', () => setAudioMuted(muteAudioToggle.checked))
const resumeFestivalAudio = (): void => {
  festivalAudio.resume()
}
window.addEventListener('pointerdown', resumeFestivalAudio, { once: true })
window.addEventListener('keydown', resumeFestivalAudio, { once: true })
toolbarElement.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return
  if (!event.target.closest('button')) return
  festivalAudio.playUiClick(game.snapshot.simTick)
})
{
  let stickPointer: number | null = null
  const applyStick = (event: PointerEvent): void => {
    const rect = walkStick.getBoundingClientRect()
    const radius = rect.width / 2
    const nx = (event.clientX - (rect.left + radius)) / radius
    const ny = (event.clientY - (rect.top + radius)) / radius
    const length = Math.hypot(nx, ny)
    const x = length > 1 ? nx / length : nx
    const y = length > 1 ? ny / length : ny
    walkStickKnob.style.transform = `translate(${x * 22}px, ${y * 22}px)`
    view.setWalkStick(x, -y)
  }
  const endStick = (): void => {
    stickPointer = null
    walkStickKnob.style.transform = ''
    view.setWalkStick(0, 0)
  }
  walkStick.addEventListener('pointerdown', (event) => {
    stickPointer = event.pointerId
    walkStick.setPointerCapture(event.pointerId)
    applyStick(event)
    event.preventDefault()
    event.stopPropagation()
  })
  walkStick.addEventListener('pointermove', (event) => {
    if (stickPointer !== event.pointerId) return
    applyStick(event)
    event.preventDefault()
  })
  walkStick.addEventListener('pointerup', endStick)
  walkStick.addEventListener('pointercancel', endStick)
}
view.mountVisitorPreview(requireElement<HTMLCanvasElement>('#visitor-preview'))
let visitorPreviewMode: 'map' | 'front' = 'map'
const visitorPreviewMapButton = requireElement<HTMLButtonElement>('#visitor-preview-map')
const visitorPreviewFrontButton = requireElement<HTMLButtonElement>('#visitor-preview-front')
const syncVisitorPreviewMode = (): void => {
  view.setVisitorPreviewMode(visitorPreviewMode)
  visitorPreviewMapButton.setAttribute('aria-pressed', String(visitorPreviewMode === 'map'))
  visitorPreviewFrontButton.setAttribute('aria-pressed', String(visitorPreviewMode === 'front'))
}
visitorPreviewMapButton.addEventListener('click', () => {
  visitorPreviewMode = 'map'
  syncVisitorPreviewMode()
})
visitorPreviewFrontButton.addEventListener('click', () => {
  visitorPreviewMode = 'front'
  syncVisitorPreviewMode()
})
requireElement<HTMLButtonElement>('#visitor-preview-zoom-in').addEventListener('click', () => view.zoomVisitorPreview(0.8))
requireElement<HTMLButtonElement>('#visitor-preview-zoom-out').addEventListener('click', () => view.zoomVisitorPreview(1.25))
syncVisitorPreviewMode()

function bindGameState(nextGame: GameState): void {
  unsubscribe()
  closeRideBuilder(false)
  // Whichever way a game arrives — a scenario, a save, a multiplayer join — it is a
  // game now, so the title screen steps out of the way.
  titleScreenController.setOpen(false)
  game = nextGame
  differentialUpdates.invalidate()
  enableMultiplayerCommands(game)
  multiplayer.attach(game)
  view.invalidate()
  tickerUI.reset()
  unsubscribe = game.subscribe((snapshot) => {
    const stageTool = document.querySelector<HTMLElement>('[data-tool="stage"] em')
    const template = snapshot.festival.stageTemplates?.find(t=>t.name===snapshot.festival.selectedStageTemplate)
    const label = `${template ? escapeHtml(template.name) : 'Festivalbühne'}<small>${formatMoney(BUILDINGS.stage.cost+(template?stageStats(template).cost:0))}</small>`
    if(stageTool && stageTool.innerHTML!==label)stageTool.innerHTML=label

    festivalUI.update(snapshot)
    supplyPlanner.update(snapshot)
    staffDetails.update(snapshot)
    tickerUI.update(snapshot)
    money.textContent = formatMoney(snapshot.money)
    guests.textContent = snapshot.guests.toLocaleString('de-DE')
    reputation.textContent = `${snapshot.reputation}%`
    const powerDemand = Math.round(snapshot.power.demand)
    const powerSupply = Math.round(snapshot.power.supply)
    const hasPlant = snapshot.buildings.some(
      (building) =>
        building.kind === 'generator' || building.kind === 'backupGenerator',
    )
    const litterPiles = snapshot.incidents.filter(
      (incident) => incident.kind === 'litter',
    ).length
    const dumpedWaste = (snapshot.wasteDumpCells ?? []).reduce(
      (total, cell) => total + cell.stored,
      0,
    )
    waste.textContent = `${litterPiles}/${dumpedWaste}`
    power.textContent = hasPlant
      ? `${powerDemand}/${powerSupply} kW${snapshot.power.backupActive ? ' +Notstrom' : ''}`
      : `${powerDemand} kW`
    power.parentElement?.classList.toggle(
      'power-short',
      hasPlant && powerDemand > powerSupply,
    )
    const hour = Math.floor(snapshot.minute / 60)
    const dayPhaseIcon =
      hour < 5 || hour >= 22 ? '🌙' : hour < 8 || hour >= 19 ? '🌅' : '☀️'
    const festivalPhase = getFestivalCycleStatus(
      snapshot.dayPlan,
      snapshot.day,
    )
    const festivalPhaseLabel = {
      lead: 'Vorlauf',
      festival: 'Festival',
      break: 'Pause',
    }[festivalPhase.phase]
    date.textContent = snapshot.festival.planning ? 'Planung · Festival noch nicht gestartet' :
      `${dayPhaseIcon} Tag ${snapshot.day} · ${festivalPhaseLabel} ${festivalPhase.phaseDay}/${festivalPhase.phaseLength} · ${formatTime(snapshot.minute)}`
    // The weather runs whether a festival does or not, so the bar always has something
    // to report; how soft the ground is goes into the tooltip, where there is room for it.
    const weather = snapshot.festival.weather
    const celsius = temperatureAt(snapshot.festival, snapshot.day, snapshot.minute / 60, weather)
    weatherIcon.textContent = WEATHER_ICONS[weather]
    weatherName.textContent = WEATHER_NAMES[weather]
    temperature.textContent = formatTemperature(celsius)
    weatherStat.title = `Wetter: ${WEATHER_NAMES[weather]} · ${formatTemperature(celsius)} · Bodennässe ${Math.round(snapshot.festival.wetness)} %`
    toggleParkButton.textContent = snapshot.parkOpen ? '🔓' : '🔒'
    toggleParkButton.disabled = Boolean(snapshot.festival.planning || snapshot.festival.finished)
    toggleParkButton.title = toggleParkButton.disabled
      ? 'Start über das Festivalmenü'
      : snapshot.parkOpen
        ? 'Park schließen'
        : snapshot.festival.planning || snapshot.festival.finished
          ? 'Gelände eröffnen'
          : 'Park öffnen'
    toggleParkButton.setAttribute('aria-label', toggleParkButton.title)
    toggleParkButton.classList.toggle('park-closed', !snapshot.parkOpen)
    const crowdingAverage = Math.round(snapshot.crowding.average)
    averageCrowding.textContent = `${crowdingAverage}%`
    averageCrowdingBar.style.width = `${crowdingAverage}%`
    averageCrowdingBar.dataset.level =
      crowdingAverage >= 70 ? 'critical' : crowdingAverage >= 35 ? 'warning' : 'good'
    const attractivenessAverage = Math.round(snapshot.attractiveness.average)
    averageAttractiveness.textContent = `${attractivenessAverage}%`
    averageAttractivenessBar.style.width = `${Math.max(0, attractivenessAverage)}%`
    averageAttractivenessBar.dataset.level =
      attractivenessAverage < 0
        ? 'critical'
        : attractivenessAverage < 25
          ? 'warning'
          : 'good'
    const partyAverage = Math.round(snapshot.partyMood.average)
    averageParty.textContent = `${partyAverage}%`
    averagePartyBar.style.width = `${Math.max(0, partyAverage)}%`
    averagePartyBar.dataset.level =
      partyAverage >= 55 ? 'good' : partyAverage >= 20 ? 'warning' : 'critical'
    if (rideAccessPlacement && snapshot.selectedTool!=='ride') {
      rideAccessPlacement=null; view.setRideAccessPreview(null)
      requireElement<HTMLElement>('#cancel-ride-access').hidden=true
    }
    if (activeRideId && snapshot.selectedTool!=='ride' && snapshot.selectedTool!=='inspect') closeRideBuilder(false)
    if (pathWindowOpen && !(roadEditorOpen ? ROAD_WINDOW_TOOLS : PATH_WINDOW_TOOLS).includes(snapshot.selectedTool)) closePathEditor()
    else if (pathWindowOpen) updatePathEditor()
    differentialUpdates.run(
      'tool-and-speed-controls',
      listFingerprint([
        snapshot.selectedTool,
        snapshot.speed,
        selectedCoasterTypeId(),
        view.bungeePreviewHeight,
      ]),
      () => {
        document.querySelectorAll<HTMLElement>('[data-tool]').forEach((button) => {
          const typeMatch = !button.dataset.coasterType || button.dataset.coasterType === selectedCoasterTypeId()
          button.classList.toggle(
            'active',
            button.dataset.tool === snapshot.selectedTool &&
              typeMatch &&
              (snapshot.selectedTool !== 'ride' || (button.dataset.bungee === 'true') === (view.bungeePreviewHeight !== null)),
          )
        })
        if (!buildCatalogStatus.hidden) buildCatalog.syncSelection()
        const activeCategory = categoryForTool(
          snapshot.selectedTool,
          snapshot.selectedTool === 'ride' && view.bungeePreviewHeight !== null,
        )
        document.querySelectorAll<HTMLElement>('.rct-toolbar [data-build-category]').forEach((button) => {
          button.classList.toggle('contains-active', button.dataset.buildCategory === activeCategory)
        })
        document.querySelectorAll<HTMLElement>('[data-speed]').forEach((button) => {
          button.classList.toggle('active', Number(button.dataset.speed) === snapshot.speed)
        })
      },
    )
    updateContextHelp()
    updateVisitorPanel()
    updateCoasterBuilder()
    updateRideBuilder()
    updateEntityPanel()
    updateStaffOverview()
    updateVisitorOverview()
    updateDayPlanPanel()
    updateComplaintsPanel()
    updateFinancePanel()
    updateLogisticsPanel()
  })
}

const STAFF_STATE_LABELS: Record<StaffState, string> = {
  patrolling: 'Kontrollgang',
  responding: 'Auf dem Weg zum Einsatz',
  working: 'Arbeitet',
  carrying: 'Transportiert',
  stationed: 'An Sicherheitskontrolle',
}

let currentStaffRole: StaffRole = STAFF_ROLES[0]

function openStaffOverview(role: StaffRole): void {
  currentStaffRole = role
  staffPanelFingerprint = ''
  staffPanel.classList.add('visible')
  updateStaffOverview(true)
}

function openSweeperStaff(vehicleId: string): void {
  closeEntityPanel()
  openStaffOverview('cleaner')
  staffDetails.open(vehicleId)
}

function updateStaffOverview(force = false): void {
  if (!staffPanel.classList.contains('visible')) return
  const role = currentStaffRole
  const definition = STAFF_DEFINITIONS[role]
  const members = game.snapshot.staff.filter((member) => member.role === role)
  const sweepers = role === 'cleaner'
    ? game.snapshot.logistics.roadVehicles.filter((vehicle) => vehicle.kind === 'sweeper')
    : []
  const working = members.filter((member) => member.state !== 'patrolling').length
    + sweepers.filter((vehicle) => vehicle.state !== 'idle').length
  const fingerprint = `${role}:${working}:` + [
    ...members.map((member) => `${member.id}:${member.state}:${(member.workZones ?? []).join(',')}`),
    ...sweepers.map((vehicle) => `${vehicle.id}:${vehicle.state}:${vehicle.cargo}:${(vehicle.workZones ?? []).join(',')}`),
  ].sort().join('|')
  if (!force && fingerprint === staffPanelFingerprint && staffList.childElementCount > 0) return
  staffPanelFingerprint = fingerprint
  requireElement<HTMLElement>('#staff-panel-title').textContent = `Übersicht ${definition.name}`
  document.querySelectorAll<HTMLButtonElement>('.staff-role-tabs [data-staff-role]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.staffRole === role))
  })
  const staffRows = members.map((member) => {
    const hired = member.hiredDay != null && member.hiredMinute != null
      ? `Tag ${member.hiredDay} · ${formatTime(member.hiredMinute)}`
      : '—'
    const zoneCount = member.workZones?.length ?? 0
    return `<tr data-inspect-staff="${member.id}" tabindex="0" role="button" aria-label="${escapeHtml(member.name)} öffnen">
      <td>${escapeHtml(member.name)}</td>
      <td>${hired}</td>
      <td>${STAFF_STATE_LABELS[member.state]}</td>
      <td>${zoneCount ? `${zoneCount} Bereich${zoneCount === 1 ? '' : 'e'}` : 'Kein Bereich'}</td>
      <td><button class="staff-remove" data-fire-member="${member.id}" aria-label="${escapeHtml(member.name)} entlassen">🗑️</button></td>
    </tr>`
  })
  const sweeperRows = sweepers.map((vehicle) => {
    const name = sweeperStaffName(vehicle.id)
    const zoneCount = vehicle.workZones?.length ?? 0
    return `<tr data-inspect-staff="${vehicle.id}" tabindex="0" role="button" aria-label="${escapeHtml(name)} öffnen">
      <td>${SWEEPER_STAFF_ICON} ${escapeHtml(name)}</td>
      <td>Saugroboter</td>
      <td>${escapeHtml(describeRoadVehicleActivity(vehicle))}</td>
      <td>${zoneCount ? `${zoneCount} Bereich${zoneCount === 1 ? '' : 'e'}` : 'Kein Bereich'}</td>
      <td><button class="staff-remove" data-fire-member="${vehicle.id}" aria-label="${escapeHtml(name)} verkaufen">🗑️</button></td>
    </tr>`
  })
  const rows = [...staffRows, ...sweeperRows].join('')
  const listed = members.length + sweepers.length
  const wageText = sweepers.length
    ? `${listed} · ${formatMoney(members.length * definition.hourlyWage)}/h`
    : `${members.length} · ${formatMoney(members.length * definition.hourlyWage)}/h`
  const hint = sweepers.length
    ? `${working} im Einsatz · ${formatMoney(definition.hourlyWage)}/h je Person · Saugroboter ohne Lohn`
    : `${working} im Einsatz · ${formatMoney(definition.hourlyWage)}/h je Person`
  staffList.innerHTML = `
    <div><span>${definition.icon}</span><strong>${definition.name}</strong><b>${wageText}</b></div>
    <small>${hint}</small>
    <div class="staff-actions">
      <button data-hire-staff="${role}">Einstellen · ${formatMoney(definition.hireCost)}</button>
    </div>
    ${listed ? `<hr class="staff-divider"><table class="staff-table"><thead><tr><th>Name</th><th>Wann eingestellt</th><th>Aktuelle Tätigkeit</th><th>Bereich zugewiesen</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : ''}
  `
}

function updateDayPlanPanel(force = false): void {
  const festivalPanel = document.querySelector<HTMLElement>('#festival-management')
  const dayPlanPane = document.querySelector<HTMLElement>('[data-pane="dayplan"]')
  if (festivalPanel?.hidden || dayPlanPane?.hidden) return
  const snapshot = game.snapshot
  const currentHour = Math.floor(snapshot.minute / 60) % 24
  const cycle = getFestivalCycleStatus(snapshot.dayPlan, snapshot.day)
  const fingerprint = [
    snapshot.dayPlan.dayVisitorEntryHour,
    snapshot.dayPlan.dayVisitorExitHour,
    currentHour,
    cycle.cycleDay,
    snapshot.dayPlan.leadDays,
    snapshot.dayPlan.festivalDays,
    snapshot.dayPlan.breakDays,
    snapshot.dayPlan.campingCapacityBufferPercent,
    ...DAY_PLAN_OFFERS.map((offer) =>
      snapshot.dayPlan.offers[offer].map((active) => (active ? '1' : '0')).join(''),
    ),
  ].join('|')
  if (!force && fingerprint === dayPlanFingerprint) return
  dayPlanFingerprint = fingerprint
  dayEntryHour.value = String(snapshot.dayPlan.dayVisitorEntryHour)
  dayExitHour.value = String(snapshot.dayPlan.dayVisitorExitHour)
  if (
    document.activeElement !== festivalLeadDays &&
    document.activeElement !== festivalActiveDays &&
    document.activeElement !== festivalBreakDays
    && document.activeElement !== campingCapacityBuffer
  ) {
    festivalLeadDays.value = String(snapshot.dayPlan.leadDays)
    festivalActiveDays.value = String(snapshot.dayPlan.festivalDays)
    festivalBreakDays.value = String(snapshot.dayPlan.breakDays)
    campingCapacityBuffer.value = String(
      snapshot.dayPlan.campingCapacityBufferPercent,
    )
  }
  const admittedCampers = snapshot.visitors.filter(
    (visitor) => visitor.ticketType === 'camping',
  ).length
  campingCapacitySummary.textContent =
    `${game.getBookableCampingCapacity()} von ${snapshot.campingCells.length} Campingfeldern buchbar · ${admittedCampers} Campinggäste aktuell zugelassen. Aufbauten können trotzdem zu Überbuchungen führen.`
  festivalCycleStrip.innerHTML = Array.from(
    { length: cycle.cycleLength },
    (_, dayIndex) => {
      const phase =
        dayIndex < snapshot.dayPlan.leadDays
          ? 'lead'
          : dayIndex <
              snapshot.dayPlan.leadDays + snapshot.dayPlan.festivalDays
            ? 'festival'
            : 'break'
      const label =
        phase === 'lead'
          ? 'Vorlauftag'
          : phase === 'festival'
            ? 'Festivaltag'
            : 'Pausentag'
      return `<span class="${phase} ${dayIndex === cycle.cycleDay ? 'current' : ''}" title="${label} ${dayIndex + 1}">${dayIndex + 1}</span>`
    },
  ).join('')
  const header = [
    '<span class="day-plan-corner">Angebot / Stunde</span>',
    ...Array.from(
      { length: 24 },
      (_, hour) =>
        `<b class="${hour === currentHour ? 'current' : ''}">${String(hour).padStart(2, '0')}</b>`,
    ),
  ].join('')
  const rows = DAY_PLAN_OFFERS.map((offer) => {
    const label = DAY_PLAN_OFFER_LABELS[offer]
    const hours = snapshot.dayPlan.offers[offer]
      .map(
        (active, hour) =>
          `<button
            data-day-plan-offer="${offer}"
            data-day-plan-hour="${hour}"
            class="${active ? 'active' : ''} ${hour === currentHour ? 'current' : ''}"
            title="${label.name}, ${String(hour).padStart(2, '0')}:00–${String((hour + 1) % 24).padStart(2, '0')}:00"
            aria-pressed="${active}"
          >${active ? '●' : ''}</button>`,
      )
      .join('')
    return `<span class="day-plan-label">${label.icon} ${label.name}</span>${hours}`
  }).join('')
  const dayVisitorHours = Array.from({ length: 24 }, (_, hour) => {
    const active =
      cycle.phase === 'festival' &&
      isDayVisitorAdmissionOpen(snapshot.dayPlan, hour * 60 + 30)
    return `<span
      class="day-visitor-hour ${active ? 'active' : ''} ${hour === currentHour ? 'current' : ''}"
      title="Tagesgäste ${active ? 'zugelassen' : 'nicht zugelassen'} · über die Zeiten oben einstellbar"
    >${active ? '●' : ''}</span>`
  }).join('')
  dayPlanGrid.innerHTML =
    header +
    `<span class="day-plan-label">🎟️ Tagesgäste</span>${dayVisitorHours}` +
    rows
  const admissionOpen = isDayVisitorAdmissionOpen(
    snapshot.dayPlan,
    snapshot.minute,
  ) && cycle.phase === 'festival'
  const activeOffers = DAY_PLAN_OFFERS.filter((offer) =>
    isFestivalOfferActive(
      snapshot.dayPlan,
      offer,
      snapshot.minute,
      snapshot.day,
    ),
  ).length
  const phaseLabel =
    cycle.phase === 'lead'
      ? `Vorlauf ${cycle.phaseDay}/${cycle.phaseLength}`
      : cycle.phase === 'festival'
        ? `Festival ${cycle.phaseDay}/${cycle.phaseLength}`
        : `Pause ${cycle.phaseDay}/${cycle.phaseLength}`
  dayPlanStatus.textContent =
    `${phaseLabel} · ${formatTime(snapshot.minute)} · Tagesgäste ${admissionOpen ? 'dürfen hinein' : 'müssen draußen sein'} · ${activeOffers} von ${DAY_PLAN_OFFERS.length} Angebotsgruppen aktiv`
}

function updateComplaintsPanel(force = false): void {
  if (!complaintsPanel.classList.contains('visible')) return
  const complaints = game.snapshot.complaints
  const fingerprint = [
    complaints.sessionNumber,
    ...COMPLAINT_TOPICS.map(
      (topic) =>
        `${complaints.currentSession[topic]}:${complaints.previousSession[topic]}`,
    ),
  ].join('|')
  if (!force && fingerprint === complaintsFingerprint) return
  complaintsFingerprint = fingerprint
  const currentTotal = COMPLAINT_TOPICS.reduce(
    (total, topic) => total + complaints.currentSession[topic],
    0,
  )
  const previousTotal = COMPLAINT_TOPICS.reduce(
    (total, topic) => total + complaints.previousSession[topic],
    0,
  )
  complaintsSummary.textContent =
    `Festivalsession ${complaints.sessionNumber} · ${currentTotal} aktuelle und ${previousTotal} Beschwerden aus der letzten Session`
  complaintsList.innerHTML = COMPLAINT_TOPICS.map((topic) => {
    const label = COMPLAINT_LABELS[topic]
    return `<div>
      <span>${label.icon} ${label.name}</span>
      <b>${complaints.currentSession[topic]}</b>
      <b>${complaints.previousSession[topic]}</b>
    </div>`
  }).join('')
}

function depotWorkerCount(depotId: string): number {
  return game.snapshot.festival.infrastructure.routes.filter(
    (route) => route.automatic && route.depotId === depotId,
  ).length
}

function selectedSupplyDepotId(): string {
  return supplyDepotSelect.value
}

function syncStockSliders(
  root: ParentNode,
  attr: 'data-supply-min' | 'data-depot-min',
  depot: { stock: Record<Supply, number>; minimum: Record<Supply, number> } | undefined,
): void {
  for (const kind of Object.keys(SUPPLIES) as Supply[]) {
    const input = root.querySelector<HTMLInputElement>(`[${attr}="${kind}"]`)
    const label = root.querySelector<HTMLElement>(`#${attr === 'data-supply-min' ? 'supply' : 'depot'}-min-${kind}-value`)
    if (!input || !label) continue
    const value = snapStockMinimum(depot?.minimum[kind] ?? 0)
    if (document.activeElement !== input) input.value = String(value)
    label.textContent = String(snapStockMinimum(Number(input.value)))
  }
}

function isBusPlannerOpen(): boolean {
  return logisticsPanel.classList.contains('visible') && !logisticsRoutes.hidden
}

function syncPlannedBusStops(logistics = game.snapshot.logistics): void {
  const known = new Set(logistics.busStops.map((stop) => stop.id))
  for (let index = plannedBusStopIds.length - 1; index >= 0; index -= 1) {
    if (!known.has(plannedBusStopIds[index]!)) plannedBusStopIds.splice(index, 1)
  }
}

function addPlannedBusStop(stopId: string, announce = true): boolean {
  const stop = game.snapshot.logistics.busStops.find((candidate) => candidate.id === stopId)
  if (!stop) return false
  if (plannedBusStopIds.includes(stopId)) {
    if (announce) showToast(`${stop.name} ist bereits in der Reihenfolge`)
    return true
  }
  plannedBusStopIds.push(stopId)
  renderBusPlanner()
  if (announce) showToast(`${stop.name} zur Linie hinzugefügt`)
  return true
}

function movePlannedBusStop(index: number, delta: number): void {
  const next = index + delta
  if (next < 0 || next >= plannedBusStopIds.length) return
  const [stopId] = plannedBusStopIds.splice(index, 1)
  plannedBusStopIds.splice(next, 0, stopId!)
  renderBusPlanner()
}

function removePlannedBusStop(index: number): void {
  plannedBusStopIds.splice(index, 1)
  renderBusPlanner()
}

function loadBusLineIntoPlanner(lineId: string): void {
  const line = game.snapshot.logistics.busLines.find((candidate) => candidate.id === lineId)
  if (!line) return
  editingBusLineId = lineId
  plannedBusStopIds.splice(0, plannedBusStopIds.length, ...line.stopIds)
  renderBusPlanner()
  updateLogisticsPanel(true)
  showToast(`${line.name}: Reihenfolge bearbeiten`)
}

function syncBusPlannerOverlay(): void {
  if (!isBusPlannerOpen()) {
    view.setBusPlannerRoute(null)
    return
  }
  const cells =
    plannedBusStopIds.length >= 2 ? game.previewBusLineRoute(plannedBusStopIds) : []
  const markers = game.previewBusLineMarkers(plannedBusStopIds, editingBusLineId ?? undefined)
  view.setBusPlannerRoute(cells, markers)
}

function renderBusPlanner(logistics = game.snapshot.logistics): void {
  syncPlannedBusStops(logistics)
  if (busPlannerDragging) {
    syncBusPlannerOverlay()
    return
  }
  const available = logistics.busStops.filter((stop) => !plannedBusStopIds.includes(stop.id))
  const stopKey = [
    logistics.busStops.map((stop) => `${stop.id}:${stop.name}`).join('|'),
    plannedBusStopIds.join(','),
  ].join('#')
  if (stopKey !== busPlannerStopsFingerprint) {
    busPlannerStopsFingerprint = stopKey
    busStopChoices.innerHTML = logistics.busStops.length === 0
      ? '<p class="scenario-hint">Noch keine Haltestelle. Unter Logistik → Bus eine Haltestelle an den Gehweg neben die Straße setzen.</p>'
      : available.length
        ? available
            .map(
              (stop) =>
                `<button type="button" class="bus-stop-choice" draggable="true" data-add-stop="${stop.id}" data-stop-id="${stop.id}" data-planner-source="available">${escapeHtml(stop.name)}</button>`,
            )
            .join('')
        : '<p class="scenario-hint">Alle Haltestellen sind auf der Linie.</p>'
    busLinePlanned.innerHTML = plannedBusStopIds.length
      ? plannedBusStopIds
          .map((stopId, index) => {
            const stop = logistics.busStops.find((candidate) => candidate.id === stopId)
            const name = stop?.name ?? stopId
            return `<li class="bus-planned-stop" draggable="true" data-stop-id="${stopId}" data-planner-source="active" data-planned-index="${index}"><span>${index + 1}. ${escapeHtml(name)}</span><span class="bus-line-actions"><button type="button" data-move-stop="${index}" data-delta="-1" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move-stop="${index}" data-delta="1" ${index === plannedBusStopIds.length - 1 ? 'disabled' : ''}>↓</button><button type="button" data-remove-stop="${index}">Entfernen</button></span></li>`
          })
          .join('')
      : '<li class="scenario-hint">Haltestellen hierher ziehen.</li>'
  }
  applyBusLineStops.hidden = !editingBusLineId
  applyBusLineStops.textContent = editingBusLineId
    ? 'Reihenfolge speichern'
    : 'Reihenfolge speichern'
  syncBusPlannerOverlay()
}

function updateLogisticsPanel(force = false): void {
  if (!logisticsPanel.classList.contains('visible')) return
  const logistics = game.snapshot.logistics
  const infrastructure = game.snapshot.festival.infrastructure
  const fingerprint = JSON.stringify([
    logistics.roadCells.length,
    logistics.parkingCells.map((cell) => cell.occupiedBy),
    logistics.roadVehicles.map((vehicle) => [
      vehicle.id,
      vehicle.state,
      vehicle.passengerIds.length,
    ]),
    logistics.ambulanceGarages.map((garage) => garage.bays),
    logistics.busDepots.map((depot) => depot.busIds),
    (logistics.wasteDepots ?? []).map((depot) => depot.truckIds),
    (logistics.specialDepots ?? []).map((depot) => depot.vehicleIds),
    logistics.busStops.map((stop) => stop.id),
    logistics.busLines.map((line) => [
      line.id,
      line.name,
      line.busIds,
      line.stopIds,
      line.active,
    ]),
    infrastructure.depots.map((depot) => [
      depot.id,
      depot.role,
      depot.distribution,
      depot.stock,
      depot.minimum,
    ]),
    infrastructure.routes.filter((route) => route.automatic).map((route) => [route.id, route.depotId]),
    infrastructure.status,
    game.snapshot.festival.deliveries.map((delivery) => [delivery.id, delivery.remaining, delivery.kind, delivery.quantity]),
    game.snapshot.backstageCells,
    game.snapshot.bandSupply,
  ])
  if (!force && fingerprint === logisticsFingerprint) return
  logisticsFingerprint = fingerprint
  const occupiedParking = logistics.parkingCells.filter(
    (cell) => cell.occupiedBy,
  ).length
  const waitingCars = logistics.roadVehicles.filter(
    (vehicle) =>
      vehicle.kind === 'visitorCar' && vehicle.state === 'waiting',
  ).length
  logisticsOverview.innerHTML = `
    <div class="logistics-summary-grid">
      <span><small>Straßenfelder</small><b>${logistics.roadCells.length}</b></span>
      <span><small>Parkplätze</small><b>${occupiedParking}/${logistics.parkingCells.length}</b></span>
      <span><small>Autos auf Parkplatzsuche</small><b>${waitingCars}</b></span>
      <span><small>Krankenwagen</small><b>${logistics.roadVehicles.filter((vehicle) => vehicle.kind === 'ambulance').length}</b></span>
      <span><small>Müllfahrzeuge</small><b>${logistics.roadVehicles.filter((vehicle) => vehicle.kind === 'garbageTruck').length}</b></span>
      <span><small>Saugreiniger</small><b>${logistics.roadVehicles.filter((vehicle) => vehicle.kind === 'sweeper').length}</b></span>
      <span><small>Busse</small><b>${logistics.roadVehicles.filter((vehicle) => vehicle.kind === 'bus').length}</b></span>
      <span><small>Aktive Linien</small><b>${logistics.busLines.filter((line) => line.active).length}</b></span>
  </div>
    <div class="vehicle-summary">
      ${logistics.ambulanceGarages
        .map(
          (garage) =>
            `<span>Garage ${garage.id.slice(-4)} · ${garage.bays.filter(Boolean).length}/2 RTW <button data-buy-ambulance="${garage.id}">RTW kaufen</button>${garage.bays.some(Boolean) ? ` <button data-sell-ambulance="${garage.id}">RTW verkaufen</button>` : ''}</span>`,
        )
        .join('')}
      ${logistics.busDepots
        .map(
          (depot) =>
            `<span>Depot ${depot.id.slice(-4)} · ${depot.busIds.length}/3 Busse <button data-buy-bus="${depot.id}">Bus kaufen</button>${depot.busIds.length > 0 ? ` <button data-sell-bus="${depot.id}">Bus verkaufen</button>` : ''}</span>`,
        )
        .join('')}
      ${(logistics.wasteDepots ?? [])
        .map(
          (depot) =>
            `<span>Mülldepot ${depot.id.slice(-4)} · ${depot.truckIds.length}/2 LKW <button data-buy-garbage="${depot.id}">Müllfahrzeug kaufen</button>${depot.truckIds.length > 0 ? ` <button data-sell-garbage="${depot.id}">LKW verkaufen</button>` : ''}</span>`,
        )
        .join('')}
      ${(logistics.specialDepots ?? [])
        .map(
          (depot) =>
            `<span>Betriebshof ${depot.id.slice(-4)} · ${depot.vehicleIds.length}/4 <button data-buy-sweeper="${depot.id}">Saugreiniger kaufen</button>${depot.vehicleIds.length > 0 ? ` <button data-sell-sweeper="${depot.id}">Saugreiniger verkaufen</button>` : ''}</span>`,
        )
        .join('')}
    </div>`
  const previousBusDepot = busLineDepot.value
  busLineDepot.innerHTML = logistics.busDepots
    .map(
      (depot) =>
        `<option value="${depot.id}">Depot ${depot.id.slice(-4)} (${depot.busIds.length}/3)</option>`,
    )
    .join('')
  if ([...busLineDepot.options].some((option) => option.value === previousBusDepot)) {
    busLineDepot.value = previousBusDepot
  }
  busLinesList.innerHTML = logistics.busLines
    .map(
      (line) =>
        `<div class="bus-line-row${editingBusLineId === line.id ? ' selected' : ''}"><span>${escapeHtml(line.name)}</span><span>${line.stopIds.length} Stopps · ${line.busIds.length} Busse · ${line.headway} Min.</span><span class="bus-line-actions"><button type="button" data-edit-line="${line.id}">Reihenfolge</button><button type="button" data-add-bus-line="${line.id}">Bus hinzufügen</button><button type="button" data-delete-line="${line.id}">Löschen</button></span></div>`,
    )
    .join('')
  renderBusPlanner(logistics)
  const previousDepot = supplyDepotSelect.value
  supplyDepotSelect.innerHTML = infrastructure.depots
    .map((depot, index) => {
      const role = depot.role === 'delivery' ? 'Anlieferung' : 'Depot'
      return `<option value="${depot.id}">${role} ${index + 1} · ${depot.x}, ${depot.z}</option>`
    })
    .join('') || '<option value="">Noch kein Depot</option>'
  if ([...supplyDepotSelect.options].some((option) => option.value === previousDepot)) {
    supplyDepotSelect.value = previousDepot
  }
  const depot = infrastructure.depots.find((item) => item.id === supplyDepotSelect.value)
  const workers = depot ? depotWorkerCount(depot.id) : 0
  if (document.activeElement !== supplyWorkers) supplyWorkers.value = String(workers)
  supplyWorkersValue.textContent = supplyWorkers.value
  if (document.activeElement !== supplyDepotDistribution) {
    supplyDepotDistribution.value = depot?.distribution ?? 'shops'
  }
  supplyDepotStock.textContent = depot
    ? Object.entries(SUPPLIES)
        .map(([kind, item]) => `${item.name}: ${Math.floor(depot.stock[kind as Supply])} / Mindestbestand ${depot.minimum[kind as Supply]}`)
        .join(' · ')
    : 'Anlieferungsplatz und Depot im Baumenü unter Logistik setzen.'
  syncStockSliders(logisticsSupply, 'data-supply-min', depot)
  supplyRemoveDepot.disabled = !depot
  supplyStatus.textContent = `${infrastructure.status} · ${infrastructure.trucks.length} Lieferwagen · ${infrastructure.routes.length} Träger`
  supplyDeliveries.innerHTML = game.snapshot.festival.deliveries
    .map((delivery) => {
      const inbound = infrastructure.trucks.some((truck) => truck.deliveryId === delivery.id)
      const waiting = inbound && infrastructure.trucks.some((truck) => truck.deliveryId === delivery.id && truck.z < -game.snapshot.scenario.worldSize / 2)
      return `<p>${delivery.quantity} × ${SUPPLIES[delivery.kind].name} · ${
        waiting ? 'Wartet auf freie Einfahrt' : inbound ? 'Lastwagen auf dem Gelände' : delivery.remaining > 0 ? `Anfahrt: ${Math.ceil(delivery.remaining)} min` : 'Wartet am Kartenrand'
      }</p>`
    })
    .join('')
  const components = game.snapshot.bandSupply?.components ?? []
  const cost = SIMULATION_CONFIG.bandSupply.backstageDesignationCost
  bandSupplyPreview.textContent = backstageEraseMode
    ? 'Modus: Backstage entfernen. Ziehen im Gelände löscht die Auswahl.'
    : `Modus: Backstage ausweisen · ${cost} € je Feld. Muss an eine Bühne anschließen.`
  bandSupplyList.innerHTML =
    components.length === 0
      ? '<p class="scenario-hint">Noch kein Backstage ausgewiesen.</p>'
      : components
          .map((component) => {
            const origin = component.stages[0]
            const parking = !component.parkingNeeded
              ? 'Parkplätze nicht nötig'
              : `${component.usableSlots}/${component.busDemand} Tourbus-Plätze`
            return `<div class="band-supply-row">
              <span>${component.active ? (component.bareStage ? 'Nur Bühne' : 'Aktiv') : 'Getrennt'} · ${component.designatedTiles} Felder · Drauf ${Math.round(component.satisfaction)}</span>
              <span>${parking} · Show ×${component.showQuality.toFixed(2)}</span>
              ${origin ? `<button type="button" data-band-supply-focus="${origin.id}">Hin</button>` : ''}
            </div>`
          })
          .join('')
}

type VisitorOverviewSort =
  | 'thought'
  | 'count'
  | 'energy'
  | 'alcohol'
  | 'motivation'
  | 'fun'
  | 'nausea'
  | 'crowding'
  | 'attractiveness'
  | 'party'
  | 'name'

function updateVisitorOverview(force = false): void {
  if (!visitorOverviewPanel.classList.contains('visible')) return
  const filter = visitorThoughtFilter.value.trim().toLocaleLowerCase('de')
  const sort = visitorOverviewSort.value as VisitorOverviewSort
  const filtered = game.snapshot.visitors.filter(
    (visitor) =>
      !filter ||
      visitor.thought.toLocaleLowerCase('de').includes(filter) ||
      visitor.name.toLocaleLowerCase('de').includes(filter),
  )
  const groups = groupVisitorsByThought(filtered)
  const value = (group: (typeof groups)[number]): string | number => {
    switch (sort) {
      case 'thought': return group.thought
      case 'count': return group.count
      case 'energy': return group.energy
      case 'alcohol': return group.alcohol
      case 'motivation': return group.motivation
      case 'fun': return group.fun
      case 'nausea': return group.nausea
      case 'crowding': return group.crowding
      case 'attractiveness': return group.attractiveness
      case 'party': return group.party
      case 'name': return group.sample.name
    }
  }
  groups.sort((left, right) => {
    const leftValue = value(left)
    const rightValue = value(right)
    const comparison =
      typeof leftValue === 'string' && typeof rightValue === 'string'
        ? leftValue.localeCompare(rightValue, 'de')
        : Number(leftValue) - Number(rightValue)
    return visitorOverviewAscending ? comparison : -comparison
  })
  const pageSize = 40
  const pageCount = Math.max(1, Math.ceil(groups.length / pageSize))
  visitorOverviewPage = Math.min(visitorOverviewPage, pageCount - 1)
  const pageGroups = groups.slice(
    visitorOverviewPage * pageSize,
    (visitorOverviewPage + 1) * pageSize,
  )
  const fingerprint = [
    sort,
    visitorOverviewAscending,
    filter,
    visitorOverviewPage,
    groups.length,
    filtered.length,
    ...pageGroups.map(
      (group) =>
        `${group.thought}:${group.count}:${group.state}:${Math.round(group.energy)}:${Math.round(group.alcohol)}:${Math.round(group.motivation)}`,
    ),
  ].join('|')
  if (!force && fingerprint === visitorOverviewFingerprint) return
  visitorOverviewFingerprint = fingerprint
  visitorOverviewSummary.textContent =
    `${groups.length.toLocaleString('de-DE')} Gedanken · ${filtered.length.toLocaleString('de-DE')} von ${game.snapshot.visitors.length.toLocaleString('de-DE')} Besuchern`
  visitorOverviewList.innerHTML = pageGroups
    .map(
      (group) => `<tr data-visitor-overview-id="${group.sample.id}">
        <td><strong>${group.count.toLocaleString('de-DE')}</strong></td>
        <td title="${escapeHtml(group.thought)}">${escapeHtml(group.thought)}</td>
        <td>${escapeHtml(group.state)}</td>
        <td>${Math.round(group.energy)}%</td>
        <td>${Math.round(group.alcohol)}%</td>
        <td>${Math.round(group.motivation)}%</td>
      </tr>`,
    )
    .join('')
  visitorPageLabel.textContent = `Seite ${visitorOverviewPage + 1} / ${pageCount}`
  visitorPagePrevious.disabled = visitorOverviewPage === 0
  visitorPageNext.disabled = visitorOverviewPage >= pageCount - 1
  visitorSortDirection.textContent = visitorOverviewAscending ? '↑' : '↓'
}

let bungeeBuildMode = false
requireElement<HTMLInputElement>('#bungee-height').addEventListener('input', e => {
  if (bungeeBuildMode) view.bungeePreviewHeight = Math.max(4, Math.min(200, Number((e.target as HTMLInputElement).value) || 20))
})
function handleCellClick(cell: CellPosition): void {
  if (rideAccessPlacement) {
    const {id,type}=rideAccessPlacement
    const result=game.setRideAccess(id,type,cell.x,cell.z)
    if (result.ok) {
      const building=game.snapshot.buildings.find(b=>b.id===id)
      if (type==='entrance' && !building?.rideExit) startRideAccessPlacement(id,'exit')
      else cancelRideAccessPlacement()
      updateEntityPanel()
    }
    showToast(result.message,!result.ok); return
  }
  if (supplyPlanner.handleCell(cell)) return
  if (handleCoasterCell(game, cell, { active: coasterBuilderActive, coasterId: activeCoasterId, accessMode: coasterAccessMode }, {
    setAccessMode: () => { coasterAccessMode = null },
    continueCoaster: (coaster) => { activeCoasterId = coaster.id; coasterStartCandidate = null; coasterEditIndex = coaster.pieces.length - 1 },
    setStart: (target) => { coasterStartCandidate = { ...target } },
    openFinished: openEntityInfoForCoaster, update: updateCoasterBuilder, toast: showToast,
  })) return

  if (pathWindowOpen && pathDemolishActive) {
    demolishPathAt(cell)
    return
  }

  if (shiftElevationApplies() && shiftElevationHeld && shiftElevationOrigin) {
    applyShiftElevationPaint(cell)
    return
  }

  const pathClick = handlePathEditorCell(game, cell, {
    active: pathEditorActive, road: roadEditorOpen, buildElevation: game.snapshot.buildElevation,
    constructionType: pathConstructionType, direction: pathDirection, slope: pathSlope,
    footType: supplyPlanner.getFootType(), roadType: supplyPlanner.getRoadType(),
    shiftHeld: shiftElevationHeld, shiftOrigin: shiftElevationOrigin,
  })
  if (pathClick.handled) {
    if (pathClick.anchor) { pathAnchor = pathClick.anchor; pathHistory = []; shiftElevationOrigin = pathClick.shiftOrigin ?? shiftElevationOrigin; updatePathEditor() }
    if (pathClick.message) showToast(pathClick.message, pathClick.error)
    return
  }

  const tool = game.snapshot.selectedTool
  if (isCopyTool(tool)) {
    if (copyClipboard) {
      const result = game.stampBlueprint(cell.x, cell.z, game.snapshot.buildRotation, copyClipboard.items)
      showToast(result.message, !result.ok)
      updateCopyPreview(cell)
      return
    }
    applyCopySelection(rectangleCells(cell, cell))
    return
  }
  if (isBusPlannerOpen()) {
    const stop =
      game.getBusStopAt(cell.x, cell.z) ??
      (cell.buildingId ? game.getBusStopAt(cell.x, cell.z, cell.buildingId) : undefined)
    if (stop && addPlannedBusStop(stop.id)) return
  }
  if (handleInspectCell(game, cell, {
    openSweeper: openSweeperStaff, openVehicle: openEntityInfoForVehicle,
    openCoasterBuilder, openCoaster: openEntityInfoForCoaster, openAccess: openEntityInfoForAccess,
    openRide: openRideBuilder, openBuilding: openEntityInfoForBuilding, openDepot: openEntityInfoForDepot,
    openWasteDump: openEntityInfoForWasteDump, openBackstage: openEntityInfoForBackstage, toast: showToast,
  })) return

  const routed = applyDirectCellTool(game, cell, {
    pathConstructionType,
    pathDirection,
    footType: supplyPlanner.getFootType(),
    roadType: supplyPlanner.getRoadType(),
    backstageEraseMode,
    bungeeBuildMode,
    bungeeHeight: Number(requireElement<HTMLInputElement>('#bungee-height').value),
  })
  if (!routed.handled || !routed.result) return
  showToast(routed.result.message, !routed.result.ok)
  if (routed.placedAccessId) {
    if (tool === 'trafficLight') game.setTool('inspect')
    openEntityInfoForAccess(routed.placedAccessId)
    if (tool === 'pathBarrier' && !pathWindowOpen) game.setTool('inspect')
  }
  if (routed.placedDepot) {
    const depot = game.getDepotAt(routed.placedDepot.x, routed.placedDepot.z)
    if (depot) {
      game.setTool('inspect')
      openEntityInfoForDepot(depot.id)
    }
  }
  if (routed.placedRide) {
    const building=game.snapshot.buildings.find(b=>b.kind==='ride' && b.x===routed.placedRide!.x && b.z===routed.placedRide!.z && b.elevation===routed.placedRide!.elevation)
    if (building) { openRideBuilder(building.id); startRideAccessPlacement(building.id,'entrance') }
  }
}

function applyCopySelection(cells: ReadonlyArray<{ x: number; z: number }>): void {
  copyClipboard = captureBlueprint(game.snapshot, cells, (x, z) => game.getTerrainHeight(x, z))
  updateCopySelectionSummary()
  if (copyClipboard.items.length === 0) {
    showToast('In diesem Rechteck liegt nichts zum Kopieren', true)
    view.setBlueprintPreview([])
    return
  }
  showToast(`Auswahl: ${describeBlueprint(copyClipboard)}`)
  updateCopyPreview(hoveredCell)
}

function updateCopySelectionSummary(): void {
  const summary = document.querySelector('#copy-selection-summary')
  if (!summary) return
  summary.textContent = copyClipboard ? `Auswahl: ${describeBlueprint(copyClipboard)}` : 'Keine Auswahl'
}

function updateCopyPreview(cell: CellPosition | null): void {
  if (!isCopyTool(game.snapshot.selectedTool) || !copyClipboard || !cell || pathToolController.isDragging()) {
    view.setBlueprintPreview([])
    return
  }
  const preview = game.previewPlacement({
    type: 'blueprint',
    originX: cell.x,
    originZ: cell.z,
    rotation: game.snapshot.buildRotation,
    items: copyClipboard.items,
  })
  view.setBlueprintPreview(
    (preview.placements ?? []).map((entry) => ({
      x: entry.x,
      z: entry.z,
      kind: entry.item.type === 'road' ? 'road' : entry.item.kind,
      rotation: entry.item.type === 'road' ? entry.item.slopeDirection : entry.item.rotation,
      decorationSlot: entry.item.type === 'building' ? entry.item.decorationSlot : undefined,
      elevationOffset: entry.item.elevationOffset,
      valid: entry.valid,
      isRoad: entry.item.type === 'road',
      isPath: entry.item.type === 'building' && entry.item.kind === 'path',
    })),
  )
}

function clearCopyClipboard(): void {
  copyClipboard = null
  view.setBlueprintPreview([])
  updateCopySelectionSummary()
}

async function renderCopyLibrary(): Promise<void> {
  const list = document.querySelector('#copy-library-list')
  if (!list) return
  const entries = await listBlueprintLibrary()
  if (entries.length === 0) {
    list.innerHTML = '<p class="copy-library-empty">Noch keine Vorlagen in der Baubibliothek.</p>'
    return
  }
  list.innerHTML = entries
    .map(
      (entry) =>
        `<div class="copy-library-item" data-blueprint-id="${entry.id}">
          <div>
            <strong>${entry.name}</strong>
            <small>${describeBlueprint(entry.blueprint)}</small>
          </div>
          <div class="copy-library-actions">
            <button type="button" data-blueprint-load="${entry.id}">Laden</button>
            <button type="button" data-blueprint-delete="${entry.id}">Löschen</button>
          </div>
        </div>`,
    )
    .join('')
}

const PATH_DIRECTIONS = [
  { x: 0, z: 1 },
  { x: 1, z: 0 },
  { x: 0, z: -1 },
  { x: -1, z: 0 },
]

function getIsoDirectionIcon(direction: number): string {
  const icons = ['↙', '↘', '↗', '↖']
  return icons[(direction - cameraQuarter + icons.length) % icons.length] ?? '◆'
}

function demolishPathAt(cell: CellPosition, quiet = false): boolean {
  if (roadEditorOpen) {
    const hasRoad = Boolean(game.getRoadCellAt(cell.x, cell.z))
    const hasParking = game.snapshot.logistics.parkingCells.some(
      (parking) => parking.x === cell.x && parking.z === cell.z,
    )
    if (!hasRoad && !hasParking) return false
    const result = game.bulldoze(cell.x, cell.z)
    if (!quiet) showToast(result.message, !result.ok)
    if (result.ok) { pathAnchor = null; clearShiftElevationOrigin(); pathHistory = []; updatePathEditor() }
    return result.ok
  }
  const path =
    game.getPathAt(cell.x, cell.z, game.snapshot.buildElevation) ??
    game.getPathAt(cell.x, cell.z)
  if (!path) {
    if (!quiet) showToast('Hier liegt kein Weg', true)
    return false
  }
  const result = game.bulldoze(path.x, path.z, path.id)
  if (pathAnchor && pathAnchor.x === path.x && pathAnchor.z === path.z) {
    pathAnchor = null
    clearShiftElevationOrigin()
    pathHistory = []
    updatePathEditor()
  }
  if (!quiet) showToast(result.message, !result.ok)
  return result.ok
}

function resumePathPlacement(): void {
  pathDemolishActive = false
  supplyPlanner.releaseTool()
  game.setTool(roadEditorOpen ? 'road' : 'path')
}

function shiftElevationApplies(): boolean {
  return pathEditorActive && !pathDemolishActive
}

function resolveWayElevationAnchor(cell: CellPosition): PathAnchor {
  if (roadEditorOpen) {
    const road = game.getRoadCellAt(cell.x, cell.z)
    return {
      x: cell.x,
      z: cell.z,
      elevation: road?.elevation ?? game.getTerrainHeight(cell.x, cell.z),
    }
  }
  const path =
    game.getPathAt(cell.x, cell.z, game.snapshot.buildElevation) ??
    game.getPathAt(cell.x, cell.z)
  return {
    x: cell.x,
    z: cell.z,
    elevation: path?.elevation ?? game.snapshot.buildElevation,
  }
}

function beginShiftElevationLock(cell?: CellPosition | null): void {
  if (!shiftElevationApplies() || !shiftElevationHeld || shiftElevationOrigin) return
  const candidate = pathAnchor ?? (cell ? resolveWayElevationAnchor(cell) : null)
  shiftElevationOrigin = lockShiftElevationOrigin(shiftElevationOrigin, candidate)
  if (shiftElevationOrigin) pathAnchor = { ...shiftElevationOrigin }
}

function clearShiftElevationOrigin(): void {
  shiftElevationOrigin = null
  lastShiftPaintKey = ''
}

function clearShiftElevationLock(): void {
  shiftElevationHeld = false
  clearShiftElevationOrigin()
}

function ensureShiftElevationOriginWay(): void {
  if (!shiftElevationOrigin) return
  const { x, z, elevation } = shiftElevationOrigin
  if (roadEditorOpen) {
    if (!game.getRoadCellAt(x, z)) {
      game.placeRoadSegment(x, z, elevation, 0, pathDirection, supplyPlanner.getRoadType())
    }
    return
  }
  if (!game.getPathAt(x, z, elevation)) {
    game.placePathSegment(
      x,
      z,
      elevation,
      pathConstructionType,
      pathDirection,
      0,
      supplyPlanner.getFootType(),
    )
  }
}

function previewShiftElevation(cell: CellPosition | null): void {
  if (!shiftElevationApplies() || !shiftElevationOrigin) return
  pathAnchor = { ...shiftElevationOrigin }
  if (cell) {
    const plan = planLockedOriginRamp(shiftElevationOrigin, cell, pathSlope)
    if (plan.direction != null) pathDirection = plan.direction
  }
  updatePathEditor()
}

function applyShiftElevationPaint(cell: CellPosition, quiet = false): void {
  beginShiftElevationLock(cell)
  if (!shiftElevationOrigin) return
  if (cell.x === shiftElevationOrigin.x && cell.z === shiftElevationOrigin.z) {
    pathAnchor = { ...shiftElevationOrigin }
    updatePathEditor()
    return
  }
  const paintKey = `${cell.x},${cell.z},${pathSlope}`
  if (paintKey === lastShiftPaintKey) return
  lastShiftPaintKey = paintKey
  ensureShiftElevationOriginWay()
  const plan = planLockedOriginRamp(shiftElevationOrigin, cell, pathSlope)
  if (plan.direction != null) pathDirection = plan.direction
  let built = 0
  let lastMessage = 'Rampe vom festen Ausgang'
  for (const step of plan.steps) {
    const result = roadEditorOpen
      ? game.placeRoadSegment(
          step.x,
          step.z,
          step.elevation,
          step.slope,
          step.direction,
          supplyPlanner.getRoadType(),
        )
      : game.placePathSegment(
          step.x,
          step.z,
          step.elevation,
          pathConstructionType,
          step.direction,
          step.slope,
          supplyPlanner.getFootType(),
        )
    lastMessage = result.message
    if (!result.ok) {
      if (built === 0) showToast(result.message, true)
      break
    }
    built += 1
  }
  pathAnchor = { ...shiftElevationOrigin }
  updatePathEditor()
  if (built > 0 && !quiet) showToast(lastMessage)
}

function setPathConstructMode(construct: boolean): void {
  pathEditorActive = construct
  pathAnchor = null
  clearShiftElevationOrigin()
  pathHistory = []
  pathDemolishActive = false
  supplyPlanner.releaseTool()
  game.setTool(roadEditorOpen ? 'road' : 'path')
  updatePathEditor()
}

function openPathWindow(construct = false, road = false): void {
  closeRideBuilder(false)
  if (coasterBuilderActive) closeCoasterBuilder()
  pathWindowOpen = true
  closeBuildMenu()
  roadEditorOpen = road
  pathSlope = 0
  supplyPlanner.setEditorRoad(road)
  setPathConstructMode(construct)
  pathConstruction.scrollTop = 0
  setToolbarCategoryOpen(road ? 'roads' : 'paths')
  buildMenuToggle.setAttribute('aria-expanded', 'true')
}

function closePathEditor(): void {
  pathWindowOpen = false
  pathEditorActive = false
  pathDemolishActive = false
  pathAnchor = null
  clearShiftElevationLock()
  pathHistory = []
  pathConstruction.classList.remove('visible', 'path-mode-construct', 'path-mode-paint')
  view.setPathConstructionPreview(false, null, pathDirection, pathSlope)
  view.setPathDragPreview([], 0)
  if (buildMenuPanel.hidden) {
    setToolbarCategoryOpen(null)
    buildMenuToggle.setAttribute('aria-expanded', 'false')
  }
}

function rotatePathDirection(delta: number): void {
  pathDirection = (pathDirection + delta + PATH_DIRECTIONS.length) % PATH_DIRECTIONS.length
  updatePathEditor()
}

function setPathSlope(value: number): void {
  const stepped = Math.round(value * 2) / 2
  pathSlope = Math.max(-0.5, Math.min(0.5, stepped))
  updatePathEditor()
}

function buildNextPathSegment(): void {
  if (!pathAnchor) return
  const direction = PATH_DIRECTIONS[pathDirection]
  if (!direction) return
  const next: PathAnchor = {
    x: pathAnchor.x + direction.x,
    z: pathAnchor.z + direction.z,
    elevation: pathAnchor.elevation + pathSlope,
  }
  if (roadEditorOpen) {
    const previousRoad = game.getRoadCellAt(next.x, next.z, next.elevation)
    const previousRoadSnapshot = previousRoad ? structuredClone(previousRoad) : undefined
    const result = game.placeRoadSegment(
      next.x,
      next.z,
      next.elevation,
      pathSlope,
      pathDirection,
      supplyPlanner.getRoadType(),
    )
    if (result.ok) {
      pathHistory.push({
        from: { ...pathAnchor },
        to: next,
        roadExisted: Boolean(previousRoad),
        previousRoad: previousRoadSnapshot,
      })
      pathAnchor = shiftElevationOrigin ? { ...shiftElevationOrigin } : next
      updatePathEditor()
    }
    showToast(result.message, !result.ok)
    return
  }
  const candidateBase = Math.min(pathAnchor.elevation, next.elevation)
  const candidateTop =
    Math.max(pathAnchor.elevation, next.elevation) + BUILDINGS.path.height
  const previousPath = game.snapshot.buildings.find((building) => {
    if (building.kind !== 'path' || building.x !== next.x || building.z !== next.z) {
      return false
    }
    const existingStart = building.elevation - (building.pathSlope ?? 0)
    const existingBase = Math.min(building.elevation, existingStart)
    const existingTop =
      Math.max(building.elevation, existingStart) + BUILDINGS.path.height
    return existingBase < candidateTop && candidateBase < existingTop
  })
  const previousPathSnapshot = previousPath ? structuredClone(previousPath) : undefined
  const result = game.placePathSegment(
    next.x,
    next.z,
    next.elevation,
    pathConstructionType,
    pathDirection,
    pathSlope,
    supplyPlanner.getFootType(),
  )
  if (!result.ok) {
    showToast(result.message, true)
    return
  }
  pathHistory.push({
    from: { ...pathAnchor },
    to: { ...next },
    previousPath: previousPathSnapshot,
  })
  pathAnchor = shiftElevationOrigin ? { ...shiftElevationOrigin } : next
  updatePathEditor()
  showToast(result.message)
}

function undoLastPathSegment(): void {
  const entry = pathHistory.pop()
  if (!entry) return
  const result = roadEditorOpen
    ? game.undoRoadSegment(entry.to.x, entry.to.z, entry.previousRoad, entry.to.elevation)
    : game.undoPathSegment(
    entry.to.x,
    entry.to.z,
    entry.to.elevation,
    entry.previousPath,
  )
  if (!result.ok) {
    pathHistory.push(entry)
    showToast(result.message, true)
    return
  }
  pathAnchor = shiftElevationOrigin ? { ...shiftElevationOrigin } : entry.from
  updatePathEditor()
  showToast(result.message)
}

function updatePathEditor(): void {
  pathConstruction.classList.toggle('road-editor', roadEditorOpen)
  pathConstruction.querySelector('.panel-header-title')!.textContent = roadEditorOpen ? 'Autostraßen' : 'Fußwege'
  pathConstruction.setAttribute('aria-label', roadEditorOpen ? 'Autostraßen' : 'Fußwege')
  requireElement<HTMLElement>('#road-editor-tools').hidden = !roadEditorOpen
  pathDemolishButton.title = roadEditorOpen ? 'Straßen abreißen' : 'Wege abreißen'
  requireElement<HTMLButtonElement>('#close-path-editor').setAttribute('aria-label', roadEditorOpen ? 'Straßen schließen' : 'Wege schließen')
  pathConstruction.classList.toggle('visible', pathWindowOpen)
  pathConstruction.classList.toggle('path-mode-construct', pathWindowOpen && pathEditorActive)
  pathConstruction.classList.toggle('path-mode-paint', pathWindowOpen && !pathEditorActive)
  const modeToggle = document.querySelector<HTMLButtonElement>('#toggle-path-editor')
  if (modeToggle) {
    modeToggle.setAttribute('aria-pressed', String(pathEditorActive))
    modeToggle.title = pathEditorActive ? 'Frei ziehen (zwei Pfeile)' : 'Stückweise bauen (ein Pfeil)'
    modeToggle.setAttribute(
      'aria-label',
      pathEditorActive ? 'Frei ziehen' : 'Stückweise bauen',
    )
  }
  pathDemolishButton.setAttribute('aria-pressed', String(pathDemolishActive))
  // Which road tool is in hand. The palette keeps no state of its own, so it is read
  // back from the game's selected tool — and nothing is in hand while the wrecking
  // ball is out, however the tool was picked.
  document.querySelectorAll<HTMLButtonElement>('[data-road-editor-tool]').forEach((button) => {
    const active = !pathDemolishActive && button.dataset.roadEditorTool === game.snapshot.selectedTool
    button.classList.toggle('active', active)
    button.setAttribute('aria-pressed', String(active))
  })
  document.querySelectorAll<HTMLButtonElement>('[data-path-access]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.pathAccess === game.snapshot.selectedTool))
  })
  pathConstruction.querySelectorAll<HTMLButtonElement>('.rct-path-advanced button').forEach((button) => {
    if (button.id === 'undo-path') {
      button.disabled = !pathEditorActive || pathHistory.length === 0
      return
    }
    if (button.id === 'build-path') {
      button.disabled = !pathEditorActive || !pathAnchor
      return
    }
    button.disabled = !pathEditorActive
  })
  constructionStatus.textContent = pathDemolishActive
    ? 'Weg anklicken oder ziehen zum Abreißen.'
    : pathEditorActive
      ? pathAnchor
        ? `${shiftElevationOrigin ? 'Ausgang fest' : 'Aktuelles Feld'}: ${pathAnchor.x}, ${pathAnchor.z} · Ebene ${pathAnchor.elevation}` +
          (shiftElevationOrigin ? ' · Shift: Rampe zum Zeiger, Ausgang bleibt' : '') +
          (pathConstructionType === 'queue' ? ' · Schlange zum Eingang' : '')
        : 'Feld anklicken: setzt das erste Stück. Bauen setzt das nächste.'
      : pathConstructionType === 'queue'
        ? 'Schlange: Linie ziehen. Belag gedrückt halten.'
        : 'Belag gedrückt halten, dann eine Linie ziehen.'
  document.querySelectorAll<HTMLButtonElement>('[data-slope]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.slope) === pathSlope)
  })
  document.querySelectorAll<HTMLButtonElement>('[data-path-type]').forEach((button) => {
    button.classList.toggle('active', button.dataset.pathType === pathConstructionType)
  })
  document.querySelectorAll<HTMLButtonElement>('[data-path-direction]').forEach((button) => {
    const direction = Number(button.dataset.pathDirection)
    button.classList.toggle('active', direction === pathDirection)
    const icon = button.querySelector('span')
    if (icon) icon.textContent = getIsoDirectionIcon(direction)
  })
  view.setPathConstructionPreview(pathEditorActive, pathAnchor, pathDirection, pathSlope)
  if (roadEditorOpen && !pathEditorActive) {
    view.setPathDragPreview([], 0)
  }
}

function openCoasterBuilder(coasterId: string | null = null, typeId?: CoasterTypeId): void {
  closeRideBuilder(false)
  buildMenuPanel.hidden = true
  buildMenuToggle.setAttribute('aria-expanded', 'false')
  closeBuildSubmenus()
  supplyPlanner.releaseTool()
  if (pathWindowOpen) closePathEditor()
  if (!coasterId && typeId) pendingCoasterTypeId = getCoasterType(typeId).id
  if (!coasterId) {
    coasterSelectedKind = 'station'
    trackPieceSelect.value = 'station'
    chainLiftInput.checked = false
  } else {
    coasterSelectedKind = 'straight'
  }
  trackSpecialPalette.hidden = true
  trackSpecialToggle.setAttribute('aria-expanded', 'false')
  trackSpecialToggle.textContent = 'Speziell …'
  coasterBuilderActive = true
  activeCoasterId = coasterId
  coasterStartCandidate = null
  coasterEditIndex = coasterId ? (game.getCoaster(coasterId)?.pieces.length ?? 1) - 1 : -1
  const editAnchor = coasterId ? game.getCoaster(coasterId)?.pieces.at(-1)?.end : null
  coasterTargetPitch = editAnchor?.pitch ?? 0
  coasterTargetBank = editAnchor?.bank ?? 0
  if (editAnchor) trackPieceSelect.value = constantPitchPieceKind(coasterTargetPitch)
  coasterAccessMode = null
  game.setTool('coaster')
  updateCoasterBuilder()
}

function closeCoasterBuilder(): void {
  coasterBuilderActive = false
  activeCoasterId = null
  coasterStartCandidate = null
  coasterEditIndex = -1
  coasterAccessMode = null
  lastCoasterConstructionKey = null
  trackSpecialPalette.hidden = true
  trackSpecialToggle.setAttribute('aria-expanded', 'false')
  coasterBuilder.classList.remove('visible')
  view.setCoasterConstructionPreview([])
  view.setCoasterTrackSelection([])
}

function selectedCoasterTypeId(): CoasterTypeId {
  const existing = activeCoasterId ? game.getCoaster(activeCoasterId) : null
  if (existing) return existing.typeId
  return getCoasterType(pendingCoasterTypeId).id
}

function currentCoasterWindow(): CoasterWindowState {
  return {
    typeId: selectedCoasterTypeId(),
    selectedKind: coasterSelectedKind,
    targetPitch: coasterTargetPitch,
    targetBank: coasterTargetBank,
    chainLift: chainLiftInput.checked,
  }
}

function openCoasterEnd(): { pitch: number; bank: number } | null {
  if (!activeCoasterId) return null
  return game.getCoaster(activeCoasterId)?.pieces[coasterEditIndex]?.end ?? null
}

function applyCoasterWindow(next: CoasterWindowState): void {
  pendingCoasterTypeId = getCoasterType(next.typeId).id
  coasterSelectedKind = next.selectedKind
  coasterTargetPitch = next.targetPitch
  coasterTargetBank = next.targetBank
  chainLiftInput.checked = next.chainLift
}

function selectCoasterPitch(targetPitch: number): void {
  const end = openCoasterEnd()
  if (!end) return
  if (!isTrackPitchChoiceCurrentlyEnabled(end.pitch, targetPitch, selectedCoasterTypeId(), end.bank)) return
  applyCoasterWindow(applyConstructionPitch(currentCoasterWindow(), targetPitch))
  updateCoasterBuilder()
}

function selectCoasterBank(targetBank: number): void {
  const end = openCoasterEnd()
  if (!end) return
  if (!isTrackBankChoiceCurrentlyEnabled(end.bank, targetBank, selectedCoasterTypeId(), end.pitch)) return
  applyCoasterWindow(applyConstructionBank(currentCoasterWindow(), targetBank))
  updateCoasterBuilder()
}

function buildCoasterPiece(): void {
  if (!activeCoasterId) {
    if (!coasterStartCandidate) return
    const result = game.startCoaster(
      selectedCoasterTypeId(),
      coasterStartCandidate.x,
      coasterStartCandidate.z,
    )
    if (result.ok && result.id) {
      activeCoasterId = result.id
      coasterStartCandidate = null
      coasterEditIndex = 0
      coasterTargetPitch = 0
      coasterTargetBank = 0
      coasterSelectedKind = 'straight'
      trackPieceSelect.value = 'straight'
    }
    showToast(result.message, !result.ok)
    updateCoasterBuilder()
    return
  }
  const resolved = resolveNextTrackPiece(
    currentCoasterWindow(),
    game.getCoaster(activeCoasterId)?.pieces[coasterEditIndex]?.end ?? null,
    true,
  )
  const insertionIndex = coasterEditIndex + 1
  const result = game.appendCoasterPiece(
    activeCoasterId,
    resolved.kind,
    resolved.chainLift,
    coasterEditIndex,
    resolved.options,
  )
  if (result.ok) {
    coasterEditIndex = insertionIndex
    const end = game.getCoaster(activeCoasterId)?.pieces[coasterEditIndex]?.end
    coasterTargetPitch = end?.pitch ?? resolved.options.targetPitch ?? coasterTargetPitch
    coasterTargetBank = end?.bank ?? resolved.options.targetBank ?? coasterTargetBank
    if (resolved.kind === 'pitchTransition' || resolved.kind === 'bankTransition') {
      if (
        coasterSelectedKind === 'pitchTransition' ||
        coasterSelectedKind === 'bankTransition' ||
        coasterSelectedKind === 'station'
      ) {
        coasterSelectedKind = 'straight'
      }
    } else if (
      resolved.kind === 'straight' ||
      resolved.kind === 'slopeGentleUp' ||
      resolved.kind === 'slopeUp' ||
      resolved.kind === 'slopeGentleDown' ||
      resolved.kind === 'slopeDown'
    ) {
      coasterSelectedKind = 'straight'
    }
    trackPieceSelect.value = resolved.kind
  }
  showToast(result.message, !result.ok)
  updateCoasterBuilder()
}

function undoCoasterPiece(): void {
  if (!activeCoasterId) return
  const result = game.undoCoasterPiece(activeCoasterId)
  if (result.ok) {
    const coaster = game.getCoaster(activeCoasterId)
    coasterEditIndex = (coaster?.pieces.length ?? 1) - 1
    coasterTargetPitch = coaster?.pieces[coasterEditIndex]?.end.pitch ?? 0
    coasterTargetBank = coaster?.pieces[coasterEditIndex]?.end.bank ?? 0
    coasterSelectedKind = 'straight'
    trackPieceSelect.value = constantPitchPieceKind(coasterTargetPitch)
  }
  showToast(result.message, !result.ok)
  updateCoasterBuilder()
}

function moveCoasterTrackCursor(delta: number): void {
  const coaster = activeCoasterId ? game.getCoaster(activeCoasterId) : null
  if (!coaster) return
  coasterEditIndex = Math.max(
    0,
    Math.min(coaster.pieces.length - 1, coasterEditIndex + delta),
  )
  const anchor = coaster.pieces[coasterEditIndex]?.end
  coasterTargetPitch = anchor?.pitch ?? 0
  coasterTargetBank = anchor?.bank ?? 0
  coasterSelectedKind = 'straight'
  trackPieceSelect.value = constantPitchPieceKind(coasterTargetPitch)
  updateCoasterBuilder()
}

function deleteCoasterFromSelection(): void {
  if (!activeCoasterId || coasterEditIndex <= 0) return
  const deletedIndex = coasterEditIndex
  const result = game.deleteCoasterPiece(activeCoasterId, deletedIndex)
  if (result.ok) {
    coasterEditIndex = Math.max(0, deletedIndex - 1)
    const anchor = game.getCoaster(activeCoasterId)?.pieces[coasterEditIndex]?.end
    coasterTargetPitch = anchor?.pitch ?? 0
    coasterTargetBank = anchor?.bank ?? 0
    coasterSelectedKind = 'straight'
    trackPieceSelect.value = constantPitchPieceKind(coasterTargetPitch)
  }
  showToast(result.message, !result.ok)
  updateCoasterBuilder()
}

function updateCoasterBuilder(): void {
  const result = updateCoasterBuilderPanel({
    active: coasterBuilderActive,
    coaster: activeCoasterId ? game.getCoaster(activeCoasterId) ?? null : null,
    editIndex: coasterEditIndex,
    startCandidate: coasterStartCandidate,
    buildRotation: game.snapshot.buildRotation,
    buildElevation: game.snapshot.buildElevation,
    cameraQuarter,
    window: currentCoasterWindow(),
    lastConstructionKey: lastCoasterConstructionKey,
  }, {
    root: coasterBuilder, title: coasterConstructionTitle, status: coasterStatus,
    direction: coasterDirection, piecePreview: coasterPiecePreview, pieceLabel: coasterPieceLabel,
    typeName: coasterTypeName, typeHint: coasterTypeHint, rotate: coasterRotateButton,
    build: coasterBuildButton, undo: coasterUndoButton, entrance: coasterEntranceButton,
    exit: coasterExitButton, demolish: demolishCoasterConstructionButton, chainLift: chainLiftInput,
    pieceSelect: trackPieceSelect, previous: trackPreviousButton, next: trackNextButton,
    selection: trackSelection, deleteTrack: deleteTrackButton, directionPalette: trackDirectionPalette,
    slopePalette: trackSlopePalette, bankPalette: trackBankPalette, specialPalette: trackSpecialPalette,
    specialToggle: trackSpecialToggle,
  }, view)
  lastCoasterConstructionKey = result.key
  coasterEditIndex = result.editIndex
  chainLiftInput.checked = result.chainLift
}

function placementPreviewAt(cell: CellPosition | null): PlacementPreviewResult | null {
  if (!cell) return null
  if (rideAccessPlacement) {
    return game.previewPlacement({
      type: 'rideAccess',
      buildingId: rideAccessPlacement.id,
      accessType: rideAccessPlacement.type,
      x: cell.x,
      z: cell.z,
    })
  }
  const tool = game.snapshot.selectedTool
  if (isCopyTool(tool)) {
    return copyClipboard
      ? game.previewPlacement({
          type: 'blueprint',
          originX: cell.x,
          originZ: cell.z,
          rotation: game.snapshot.buildRotation,
          items: copyClipboard.items,
        })
      : null
  }
  if ((BUILDING_KINDS as readonly string[]).includes(tool)) {
    const kind = tool as BuildingKind
    return game.previewPlacement({
      type: 'building',
      kind,
      x: cell.x,
      z: cell.z,
      decorationSlot: scenerySlot(
        kind,
        cell.localX,
        cell.localZ,
        game.snapshot.buildRotation,
      ),
      bungeeHeight:
        kind === 'ride' && bungeeBuildMode
          ? Number(requireElement<HTMLInputElement>('#bungee-height').value)
          : undefined,
    })
  }
  if (tool === 'inspect') return null
  return game.previewPlacement({
    type: 'tool',
    tool: tool as Exclude<Tool, BuildingKind | 'copy'>,
    x: cell.x,
    z: cell.z,
    enabled: tool === 'backstageArea' ? !backstageEraseMode : undefined,
  })
}

function refreshPlacementPreview(): PlacementPreviewResult | null {
  const result = placementPreviewAt(hoveredCell)
  view.setPlacementPreviewResult(result)
  return result
}

function updateContextHelp(): void {
  const placementPreview = refreshPlacementPreview()
  contextHelp.textContent = contextHelpText({
    game, hoveredCell, placementPreview,
    modes: {
      coaster: { active: coasterBuilderActive, coasterId: activeCoasterId, startCandidate: coasterStartCandidate, accessMode: coasterAccessMode },
      path: { open: pathWindowOpen, constructing: pathEditorActive, demolishing: pathDemolishActive, road: roadEditorOpen, anchor: pathAnchor, constructionType: pathConstructionType },
      rideAccess: rideAccessPlacement, backstageEraseMode, copyClipboard,
    },
  })
}

function hideVisitorPanel(): void { visitorPanelController.hide() }
function selectVisitor(visitorId: string): void { visitorPanelController.select(visitorId) }
function updateVisitorPanel(): void { visitorPanelController.update() }

function closeRideBuilder(resetTool = true): void {
  activeRideId = null
  rideAccessPlacement = null
  view.setRideAccessPreview(null)
  const panel = requireElement<HTMLElement>('#ride-builder')
  panel.hidden = true; panel.classList.remove('visible')
  if (resetTool) game.setTool('inspect')
}

function openRideBuilder(id: string): void {
  const ride = game.snapshot.buildings.find(b=>b.id===id && b.kind==='ride')
  if (!ride) return
  closeRideBuilder(false)
  if (coasterBuilderActive) closeCoasterBuilder()
  if (pathWindowOpen) closePathEditor()
  closeEntityPanel(); closeBuildMenu(); supplyPlanner.releaseTool()
  hideVisitorPanel()
  activeRideId=id; bungeeBuildMode=false; view.bungeePreviewHeight=null
  requireElement<HTMLInputElement>('#ride-target-height').value=String(ride.bungeeHeight ?? 20)
  const panel=requireElement<HTMLElement>('#ride-builder')
  panel.hidden=false; panel.classList.add('visible')
  game.setTool('inspect')
  updateRideBuilder()
}

function updateRideBuilder(): void {
  if (!activeRideId) return
  const ride=game.snapshot.buildings.find(b=>b.id===activeRideId && b.kind==='ride')
  if (!ride) { closeRideBuilder(false); return }
  requireElement('#ride-builder-name').textContent=ride.rideType==='bungee'?'Bungee-Turm bauen':'Karussell bauen'
  requireElement('#ride-builder-status').textContent=game.getRideAccessIssue(ride) ?? 'Ein- und Ausgang angeschlossen. Konstruktion vollständig.'
  for (const type of ['entrance','exit'] as const) {
    const access=ride[type==='entrance'?'rideEntrance':'rideExit']
    const button=requireElement<HTMLButtonElement>(`#ride-${type}`)
    button.setAttribute('aria-pressed',String(rideAccessPlacement?.type===type))
    button.classList.toggle('active',rideAccessPlacement?.type===type)
    requireElement(`#ride-${type}-state`).textContent=access?'Versetzen':`Bauen · ${formatMoney(SIMULATION_CONFIG.economy.coasterAccessCost)}`
  }
  const mode=rideAccessPlacement?.type
  requireElement('#ride-builder').classList.toggle('placing-access',Boolean(mode))
  requireElement('#ride-placement-help').textContent=mode
    ? `${mode==='entrance'?'Eingang':'Ausgang'}: freies Feld direkt neben dem Fahrgeschäft wählen. Danach ${mode==='entrance'?'Warteweg':'normalen Gehweg'} anschließen.`
    : 'Eingang oder Ausgang wählen und auf ein freies Nachbarfeld setzen.'
  requireElement<HTMLElement>('#cancel-ride-access').hidden=!mode
  requireElement('#ride-access-status').textContent=`Eingang: ${ride.rideEntrance ? `${ride.rideEntrance.x}, ${ride.rideEntrance.z}`:'fehlt'} · Ausgang: ${ride.rideExit ? `${ride.rideExit.x}, ${ride.rideExit.z}`:'fehlt'}`
  requireElement('#ride-platform-height').textContent=`Plattform: Ebene ${ride.elevation}. Zugänge werden automatisch auf dieser Höhe gebaut.`
  requireElement<HTMLElement>('#ride-tower-construction').hidden=ride.rideType!=='bungee'
  if (ride.rideType==='bungee') {
    const height=Number(requireElement<HTMLInputElement>('#ride-target-height').value), current=ride.bungeeHeight ?? 20
    const valid=Number.isInteger(height) && height>=4 && height<=200
    const cost=Math.max(0,height-current)*25
    requireElement('#ride-built-height').textContent=`Gebaut: ${current} m · 4–200 m möglich · 25 € pro zusätzlichem Meter`
    const button=requireElement<HTMLButtonElement>('#ride-build-height')
    button.disabled=!valid || height===current || cost>game.snapshot.money
    button.textContent=!valid?'4–200 Meter wählen':height<current?'Turm verkürzen':`Höhe bauen · ${formatMoney(cost)}`
  }
}

function cancelRideAccessPlacement(): void {
  rideAccessPlacement=null; view.setRideAccessPreview(null)
  game.setTool('inspect'); updateRideBuilder()
}
function updateRideAccessPreview(cell: CellPosition | null): void {
  const target=rideAccessPlacement && game.snapshot.buildings.find(b=>b.id===rideAccessPlacement!.id)
  if (!cell || !target || !rideAccessPlacement) {view.setRideAccessPreview(null);return}
  const result=game.canPlaceRideAccess(target.id,rideAccessPlacement.type,cell.x,cell.z)
  view.setRideAccessPreview({x:cell.x,y:target.elevation,z:cell.z,type:rideAccessPlacement.type,theme:target.rideType==='bungee'?'bungee':'carousel',valid:result.ok,rotation:Math.atan2(target.x-cell.x,target.z-cell.z)})
}
function startRideAccessPlacement(id:string,type:'entrance'|'exit'): void {
  if (activeRideId!==id) openRideBuilder(id)
  if (activeRideId!==id) return
  rideAccessPlacement={id,type}
  game.setTool('ride'); updateRideBuilder(); updateRideAccessPreview(hoveredCell)
  showToast(`${type==='entrance'?'Eingang':'Ausgang'}: freies Nachbarfeld wählen`)
}
requireElement('#ride-entrance').addEventListener('click',()=>{if(activeRideId)startRideAccessPlacement(activeRideId,'entrance')})
requireElement('#ride-exit').addEventListener('click',()=>{if(activeRideId)startRideAccessPlacement(activeRideId,'exit')})
requireElement('#cancel-ride-access').addEventListener('click',cancelRideAccessPlacement)
for (const id of ['close-ride-builder','finish-ride-builder']) requireElement(`#${id}`).addEventListener('click',()=>closeRideBuilder())
requireElement('#open-ride-construction').addEventListener('click',()=>{if(selectedEntity?.type==='building')openRideBuilder(selectedEntity.id)})
requireElement('#ride-builder-info').addEventListener('click',()=>{
  const id=activeRideId
  closeRideBuilder()
  if (id) openEntityInfoForBuilding(id)
})
requireElement('#ride-target-height').addEventListener('input',updateRideBuilder)
makeDraggable(requireElement<HTMLElement>('#ride-builder .construction-title'), requireElement<HTMLElement>('#ride-builder'))
for (const [id,delta] of [['ride-height-down',-4],['ride-height-up',4]] as const) requireElement(`#${id}`).addEventListener('click',()=>{
  cancelRideAccessPlacement()
  const input=requireElement<HTMLInputElement>('#ride-target-height')
  input.value=String(Math.max(4,Math.min(200,(Number(input.value)||4)+delta)))
  updateRideBuilder()
})
requireElement('#ride-build-height').addEventListener('click',()=>{
  if (!activeRideId) return
  cancelRideAccessPlacement()
  const result=game.setBungeeHeight(activeRideId,Number(requireElement<HTMLInputElement>('#ride-target-height').value))
  updateRideBuilder(); showToast(result.message,!result.ok)
})
window.addEventListener('keydown',event=>{
  if(event.key!=='Escape' || !activeRideId)return
  if(rideAccessPlacement)cancelRideAccessPlacement();else closeRideBuilder()
})
function openEntityInfoForDepot(depotId: string): void {
  closeRideBuilder(false)
  selectedEntity = { type: 'depot', id: depotId }
  entityTab = 'overview'
  hideVisitorPanel()
  staffDetails.close()
  view.setInspectedVehicle(null)
  entityPanel.hidden = false
  updateEntityPanel()
}

function openEntityInfoForBuilding(buildingId: string): void {
  closeRideBuilder(false)
  selectedEntity = { type: 'building', id: buildingId }
  entityTab = 'overview'
  hideVisitorPanel()
  view.setInspectedVehicle(null)
  entityPanel.hidden = false
  updateEntityPanel()
}

function openEntityInfoForCoaster(coasterId: string): void {
  closeRideBuilder(false)
  selectedEntity = { type: 'coaster', id: coasterId }
  entityTab = 'overview'
  hideVisitorPanel()
  view.setInspectedVehicle(null)
  entityPanel.hidden = false
  updateEntityPanel()
}

function cancelAccessAreaDraw(): void {
  if (!accessAreaDrawing) return
  accessAreaDrawing = false
  view.setGroundAreaTool(null)
}

function selectedAccessControl(): AccessControl | undefined {
  if (selectedEntity?.type !== 'access') return undefined
  return game.getAccessControl(selectedEntity.id)
}

function startAccessAreaDraw(): void {
  const control = selectedAccessControl()
  if (!control) return
  accessAreaDrawing = true
  game.setTool('inspect')
  view.setGroundAreaTool((from, to, preview) => {
    const current = selectedAccessControl()
    if (!current) {
      cancelAccessAreaDraw()
      return
    }
    const next = toggleAreaCells(current.area, from, to)
    view.showAccessArea(next)
    const stats = game.accessAreaStats(next)
    accessPreview.textContent = `Vorschau: ${areaPreviewText(current.kind, stats)}`
    if (preview) return
    const result = game.toggleAccessControlArea(current.id, from, to)
    showToast(result.message, !result.ok)
    updateEntityPanel()
  })
  accessDrawArea.textContent = 'Zeichnen beenden'
  view.showAccessArea(control.area)
}

function openEntityInfoForAccess(accessId: string): void {
  closeRideBuilder(false)
  cancelAccessAreaDraw()
  selectedEntity = { type: 'access', id: accessId }
  entityTab = 'overview'
  hideVisitorPanel()
  staffDetails.close()
  view.setInspectedVehicle(null)
  entityPanel.hidden = false
  updateEntityPanel()
}

function openEntityInfoForVehicle(vehicleId: string): void {
  closeRideBuilder(false)
  selectedEntity = { type: 'vehicle', id: vehicleId }
  entityTab = 'overview'
  hideVisitorPanel()
  staffDetails.close()
  view.setInspectedVehicle(vehicleId)
  entityPanel.hidden = false
  updateEntityPanel()
}

function openEntityInfoForWasteDump(x: number, z: number): void {
  closeRideBuilder(false)
  selectedEntity = { type: 'wasteDump', id: wasteDumpId({ x, z }) }
  entityTab = 'overview'
  hideVisitorPanel()
  staffDetails.close()
  view.setInspectedVehicle(null)
  entityPanel.hidden = false
  updateEntityPanel()
}

function openEntityInfoForBackstage(x: number, z: number): void {
  closeRideBuilder(false)
  selectedEntity = { type: 'backstage', id: `backstage:${x}:${z}` }
  entityTab = 'overview'
  hideVisitorPanel()
  staffDetails.close()
  view.setInspectedVehicle(null)
  entityPanel.hidden = false
  updateEntityPanel()
}

function updateEntityPanel(): void {
  renderEntityPanel({ selection: selectedEntity, tab: entityTab, cameraQuarter }, {
    game, close: closeEntityPanel, depotWorkerCount,
    syncDepotStock: (root, depot) => syncStockSliders(root, 'data-depot-min', depot),
    renderAccessControl: renderAccessControlForm,
    accessStatus: accessStatusText,
    accessMode: accessModeLabel,
  })
}

function closeEntityPanel(): void {
  if (rideAccessPlacement) cancelRideAccessPlacement()
  cancelAccessAreaDraw()
  view.showAccessArea(null)
  selectedEntity = null
  view.setInspectedVehicle(null)
  entityPanel.hidden = true
}

function ensureAccessSlotButtons(): void {
  if (accessSlots.childElementCount === 6) return
  accessSlots.replaceChildren(
    ...Array.from({ length: 6 }, (_, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.accessSlot = String(index)
      const start = index * 10
      button.textContent = `${String(start).padStart(2, '0')}–${String(start + 10).padStart(2, '0')}`
      return button
    }),
  )
}

function ensureAccessHourButtons(): void {
  if (accessHourGrid.childElementCount === ACCESS_HOURS_PER_DAY) return
  accessHourGrid.replaceChildren(
    ...Array.from({ length: ACCESS_HOURS_PER_DAY }, (_, hour) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.accessHour = String(hour)
      button.textContent = `${String(hour).padStart(2, '0')}`
      return button
    }),
  )
}

function fillAccessScheduleOfferOptions(): void {
  if (accessScheduleOffer.childElementCount === DAY_PLAN_OFFERS.length) return
  accessScheduleOffer.replaceChildren(
    ...DAY_PLAN_OFFERS.map((offer) => {
      const option = document.createElement('option')
      option.value = offer
      option.textContent = `${DAY_PLAN_OFFER_LABELS[offer].icon} ${DAY_PLAN_OFFER_LABELS[offer].name}`
      return option
    }),
  )
}

function accessScheduleHintText(control: AccessControl): string {
  const snapshot = game.snapshot
  const cycle = getFestivalCycleStatus(snapshot.dayPlan, snapshot.day)
  const phaseLabel = FESTIVAL_PHASE_LABELS[cycle.phase]
  const open = isAccessScheduleOpen(control, snapshot.minute, {
    day: snapshot.day,
    dayPlan: snapshot.dayPlan,
  })
  const time = resolvedScheduleTime(control)
  const timeLabel =
    time === 'dayPlan'
      ? `folgt ${DAY_PLAN_OFFER_LABELS[control.scheduleOffer].name}`
      : ACCESS_SCHEDULE_TIME_LABELS[time]
  return `Aktuell ${phaseLabel} · ${timeLabel} · ${open ? (control.kind === 'trafficLight' ? 'grün' : 'offen') : control.kind === 'trafficLight' ? 'rot' : 'zu'}`
}

function fillAccessSensorOptions(kind: AccessControl['kind']): void {
  if (accessSensorKind.dataset.accessKind === kind) return
  accessSensorKind.dataset.accessKind = kind
  const options =
    kind === 'trafficLight'
      ? [
          ['freeParking', 'Freier Parkplatz im Gebiet'],
          ['noFreeParking', 'Kein freier Parkplatz im Gebiet'],
          ['carsBelow', 'Weniger als X Autos auf der Straße'],
          ['carsAbove', 'Mehr als X Autos auf der Straße'],
        ]
      : [
          ['freeCamping', 'Freie Campingfläche im Gebiet'],
          ['occupiedCamping', 'Belegte Campingfläche im Gebiet'],
          ['peopleBelow', 'Weniger als X Personen im Gebiet'],
          ['peopleAbove', 'Mehr als X Personen im Gebiet'],
        ]
  accessSensorKind.replaceChildren(
    ...options.map(([value, label]) => {
      const option = document.createElement('option')
      option.value = value
      option.textContent = label
      return option
    }),
  )
}

function accessModeLabel(mode: AccessControlMode): string {
  if (mode === 'always') return 'Immer offen'
  if (mode === 'locked') return 'Immer zu'
  if (mode === 'schedule') return 'Zeitgesteuert'
  return 'Sensor'
}

function accessStatusText(control: AccessControl): string {
  if (
    control.kind === 'pathBarrier' &&
    control.openInEmergency &&
    game.isAccessEmergency()
  ) {
    return 'Notfall – Tor in beide Richtungen offen'
  }
  if (control.kind === 'trafficLight') {
    return control.signal === 'open'
      ? 'Grün – Fahrzeuge dürfen in diese Richtung'
      : 'Rot – Fahrzeuge warten in dieser Richtung'
  }
  if (control.signal === 'closed') {
    return 'Geschlossen – Personen müssen umlaufen'
  }
  return control.passage === 'both'
    ? 'Offen – Personen dürfen in beide Richtungen'
    : 'Offen – nur in die gesetzte Richtung'
}

function renderAccessControlForm(control: AccessControl): void {
  const scheduleTime = resolvedScheduleTime(control)
  accessSchedule.hidden = control.mode !== 'schedule'
  accessSlotsWrap.hidden = scheduleTime !== 'hourlySlots'
  accessHours.hidden = scheduleTime !== 'hours'
  accessDayPlan.hidden = scheduleTime !== 'dayPlan'
  accessSensor.hidden = control.mode !== 'sensor'
  accessPassage.hidden = control.kind !== 'pathBarrier'
  accessEmergency.hidden = control.kind !== 'pathBarrier'
  if (
    control.kind === 'pathBarrier' &&
    document.activeElement !== accessOpenInEmergency
  ) {
    accessOpenInEmergency.checked = control.openInEmergency
  }
  accessControlOptions.querySelectorAll<HTMLButtonElement>('[data-access-mode]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.accessMode === control.mode))
  })
  accessControlOptions.querySelectorAll<HTMLButtonElement>('[data-access-phase]').forEach((button) => {
    button.setAttribute(
      'aria-pressed',
      String(control.schedulePhases.includes(button.dataset.accessPhase as FestivalPhase)),
    )
  })
  accessControlOptions.querySelectorAll<HTMLButtonElement>('[data-access-schedule-time]').forEach((button) => {
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.accessScheduleTime === scheduleTime),
    )
  })
  accessControlOptions.querySelectorAll<HTMLButtonElement>('[data-access-polarity]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.accessPolarity === control.polarity))
  })
  accessPassage.querySelectorAll<HTMLButtonElement>('[data-access-passage]').forEach((button) => {
    button.setAttribute(
      'aria-pressed',
      String(
        control.kind === 'pathBarrier' &&
          button.dataset.accessPassage === control.passage,
      ),
    )
  })
  const slot = currentAccessSlot(game.snapshot.minute)
  const currentHour = Math.floor(((game.snapshot.minute / 60) % 24 + 24) % 24)
  ensureAccessSlotButtons()
  accessSlots.querySelectorAll<HTMLButtonElement>('[data-access-slot]').forEach((button) => {
    const index = Number(button.dataset.accessSlot)
    const open = Boolean(control.openSlots[index])
    button.setAttribute('aria-pressed', String(open))
    button.classList.toggle('current', index === slot)
    const start = index * 10
    const label = `${String(start).padStart(2, '0')}–${String(start + 10).padStart(2, '0')}${
      open ? (control.kind === 'trafficLight' ? ' Grün' : ' Offen') : ''
    }`
    if (button.textContent !== label) button.textContent = label
  })
  ensureAccessHourButtons()
  accessHourGrid.querySelectorAll<HTMLButtonElement>('[data-access-hour]').forEach((button) => {
    const hour = Number(button.dataset.accessHour)
    const open = Boolean(control.scheduleHours[hour])
    button.setAttribute('aria-pressed', String(open))
    button.classList.toggle('current', hour === currentHour)
    const label = `${String(hour).padStart(2, '0')}${
      open ? (control.kind === 'trafficLight' ? ' Grün' : ' Offen') : ''
    }`
    if (button.textContent !== label) button.textContent = label
  })
  fillAccessScheduleOfferOptions()
  if (document.activeElement !== accessScheduleOffer) {
    accessScheduleOffer.value = control.scheduleOffer
  }
  accessScheduleHint.textContent = accessScheduleHintText(control)
  fillAccessSensorOptions(control.kind)
  if (document.activeElement !== accessSensorKind) {
    accessSensorKind.value = control.sensorKind
  }
  const needsThreshold = control.sensorKind.endsWith('Below') || control.sensorKind.endsWith('Above')
  accessThreshold.hidden = !needsThreshold
  accessThresholdLabel.hidden = !needsThreshold
  if (document.activeElement !== accessThreshold) {
    accessThreshold.value = String(control.sensorThreshold)
  }
  const stats = game.accessAreaPreview(control.id)
  accessPreview.textContent = accessAreaDrawing
    ? accessPreview.textContent
    : stats
      ? `Aktuell: ${areaPreviewText(control.kind, stats)} · Regel: ${previewLabel(control.kind, control.sensorKind, stats)}`
      : 'Aktuell: keine Messung'
  accessDrawArea.textContent = accessAreaDrawing ? 'Zeichnen beenden' : 'Gebiet zeichnen'
  if (!accessAreaDrawing) view.showAccessArea(control.area)
}

function showToast(message: string, isError = false): void {
  window.clearTimeout(toastTimer)
  toast.textContent = message
  toast.className = isError ? 'visible error' : 'visible'
  toastTimer = window.setTimeout(() => {
    toast.className = ''
  }, 2200)
}

document.querySelector('#rotate-scenery')?.addEventListener('click', () => {
  game.rotateBuild()
  updateCopyPreview(hoveredCell)
})

const buildMenuToggle = requireElement<HTMLButtonElement>('#open-build-menu')
const buildMenuPanel = requireElement<HTMLElement>('#build-menu')
const buildMenuTitle = requireElement<HTMLElement>('#build-menu-title')
const buildGrid = requireElement<HTMLElement>('#build-grid')
const buildSubtabs = requireElement<HTMLElement>('#build-subtabs')
const buildCatalogStatus = requireElement<HTMLElement>('#build-catalog-status')
const buildCatalogName = requireElement<HTMLElement>('#build-catalog-name')
const buildCatalogDetail = requireElement<HTMLElement>('#build-catalog-detail')
const buildCatalogCost = requireElement<HTMLElement>('#build-catalog-cost')
let lastBuildCategory: BuildCategoryId = 'paths'
let lastBuildGroup = new Map<BuildCategoryId, string>()
let lastDecorationTheme: DecorationThemeId = DEFAULT_DECORATION_THEME
const buildCatalog = createBuildCatalog(
  {
    panel: buildMenuPanel,
    title: buildMenuTitle,
    grid: buildGrid,
    subtabs: buildSubtabs,
    status: buildCatalogStatus,
    statusName: buildCatalogName,
    statusDetail: buildCatalogDetail,
    statusCost: buildCatalogCost,
    decorationThemes: document.querySelector<HTMLElement>('#decoration-themes'),
  },
  () => game.snapshot,
  view,
  formatMoney,
)

function renderDecorationCatalog(): void {
  buildCatalog.renderDecoration(lastDecorationTheme)
}

function renderBuildGrid(categoryId: BuildCategoryId, groupId?: string): void {
  const groupIdUsed = buildCatalog.render(categoryId, groupId)
  lastBuildGroup.set(categoryId, groupIdUsed)
  if (categoryId === 'decoration') {
    renderDecorationCatalog()
  }
}

function setToolbarCategoryOpen(categoryId: BuildCategoryId | null): void {
  document.querySelectorAll<HTMLButtonElement>('.rct-toolbar [data-build-category]').forEach((button) => {
    const open = button.dataset.buildCategory === categoryId
    button.classList.toggle('open', open)
    button.setAttribute('aria-expanded', String(open))
  })
}

function closeBuildMenu(): void {
  buildMenuPanel.hidden = true
  closeBuildSubmenus()
  if (pathWindowOpen) {
    setToolbarCategoryOpen(roadEditorOpen ? 'roads' : 'paths')
    buildMenuToggle.setAttribute('aria-expanded', 'true')
    return
  }
  buildMenuToggle.setAttribute('aria-expanded', 'false')
  setToolbarCategoryOpen(null)
}

function toggleBulldozeTool(): void {
  if (activeRideId) closeRideBuilder()
  const menuWasOpen = !buildMenuPanel.hidden || pathWindowOpen
  if (pathWindowOpen) closePathEditor()
  if (coasterBuilderActive) closeCoasterBuilder()
  cancelAccessAreaDraw()
  const wasActive = game.snapshot.selectedTool === 'bulldoze'
  buildMenuPanel.hidden = true
  closeBuildSubmenus()
  buildMenuToggle.setAttribute('aria-expanded', 'false')
  if (wasActive && !menuWasOpen) {
    game.setTool('inspect')
    setToolbarCategoryOpen(null)
    return
  }
  game.setTool('bulldoze')
  setToolbarCategoryOpen('bulldoze')
}

function openBuildCategory(categoryId: BuildCategoryId, groupId?: string): void {
  if (categoryId === 'bulldoze') {
    toggleBulldozeTool()
    return
  }
  if (categoryId === 'copy') {
    if (activeRideId) closeRideBuilder()
    if (pathWindowOpen) closePathEditor()
    if (coasterBuilderActive) closeCoasterBuilder()
    lastBuildCategory = categoryId
    game.setBuildElevation(0)
    game.setTool('copy')
    renderBuildGrid(categoryId, groupId ?? lastBuildGroup.get(categoryId))
    buildMenuPanel.hidden = false
    buildMenuToggle.setAttribute('aria-expanded', 'true')
    setToolbarCategoryOpen(categoryId)
    void renderCopyLibrary()
    updateCopySelectionSummary()
    return
  }
  if (activeRideId) closeRideBuilder()
  lastBuildCategory = categoryId
  if (categoryId === 'paths' || categoryId === 'roads') {
    if (pathWindowOpen && roadEditorOpen === (categoryId === 'roads')) {
      closePathEditor()
      game.setTool('inspect')
      return
    }
    openPathWindow(false, categoryId === 'roads')
    return
  }
  if (pathWindowOpen) closePathEditor()
  const category = buildCategoryById(categoryId)
  if (categoryId === 'decoration') {
    const toolTheme = decorationThemeOf(game.snapshot.selectedTool)
    if (toolTheme) lastDecorationTheme = toolTheme
  }
  renderBuildGrid(categoryId, groupId ?? lastBuildGroup.get(categoryId))
  buildMenuPanel.hidden = false
  buildMenuPanel.classList.toggle('dock-right', category.dock === 'right')
  if (category.dock !== 'right') {
    buildMenuPanel.style.height = ''
    buildMenuPanel.style.bottom = ''
  }
  buildMenuToggle.setAttribute('aria-expanded', 'true')
  setToolbarCategoryOpen(categoryId)
}

function activateBuildTool(button: HTMLButtonElement): void {
  const tool = button.dataset.tool as Tool
  closeRideBuilder(false)
  bungeeBuildMode = button.dataset.bungee === 'true'
  view.bungeePreviewHeight = bungeeBuildMode
    ? Math.max(4, Math.min(200, Number(requireElement<HTMLInputElement>('#bungee-height').value) || 20))
    : null
  if (tool === 'coaster') {
    lastBuildGroup.set('attractions', 'coasters')
    openCoasterBuilder(null, button.dataset.coasterType as CoasterTypeId | undefined)
    return
  }
  if (pathWindowOpen && tool !== 'path') closePathEditor()
  if (coasterBuilderActive) closeCoasterBuilder()
  cancelAccessAreaDraw()
  if (tool === 'backstageArea') backstageEraseMode = false
  game.setBuildElevation(0)
  game.setTool(tool)
  if (tool === 'road' || (tool === 'path' && !pathEditorActive)) supplyPlanner.activateWay(tool)
}

document.querySelectorAll<HTMLButtonElement>('.rct-toolbar [data-build-category]').forEach((button) => {
  button.addEventListener('click', () => {
    const category = button.dataset.buildCategory as BuildCategoryId
    if (category === 'bulldoze') {
      toggleBulldozeTool()
      return
    }
    if (button.classList.contains('open')) {
      if (category === 'paths' || category === 'roads') {
        closePathEditor()
        game.setTool('inspect')
        return
      }
      closeBuildMenu()
      if (buildMenuPanel.hidden && !pathWindowOpen) game.setTool('inspect')
      return
    }
    openBuildCategory(category)
  })
})
buildSubtabs.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-build-group]')
  if (!button || !lastBuildCategory) return
  openBuildCategory(lastBuildCategory, button.dataset.buildGroup)
})
document.querySelector('#decoration-themes')?.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-decoration-theme]')
  const theme = button?.dataset.decorationTheme
  if (!button || !theme || !isDecorationThemeId(theme)) return
  lastDecorationTheme = theme
  if (lastBuildCategory === 'decoration') renderDecorationCatalog()
})
buildGrid.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-tool]')
  if (button) activateBuildTool(button)
})
buildCatalog.bindStatusEvents()
buildMenuToggle.addEventListener('click', () => {
  if (pathWindowOpen) {
    closePathEditor()
    game.setTool('inspect')
    return
  }
  if (!buildMenuPanel.hidden) {
    closeBuildMenu()
    if (buildMenuPanel.hidden) game.setTool('inspect')
    return
  }
  const match = subgroupForTool(
    game.snapshot.selectedTool,
    game.snapshot.selectedTool === 'ride' && view.bungeePreviewHeight !== null,
  )
  const category = match?.category === 'bulldoze' ? lastBuildCategory : match?.category ?? lastBuildCategory
  openBuildCategory(category, match?.category === 'bulldoze' ? undefined : match?.group)
})
document.querySelector('#copy-save-library')?.addEventListener('click', () => {
  if (!copyClipboard) {
    showToast('Zuerst einen Bereich markieren', true)
    return
  }
  const name = document.querySelector<HTMLInputElement>('#copy-blueprint-name')?.value ?? ''
  void saveBlueprintLibraryEntry(name, copyClipboard).then((entry) => {
    showToast(`„${entry.name}“ in der Baubibliothek gespeichert`)
    void renderCopyLibrary()
  })
})
document.querySelector('#copy-new-selection')?.addEventListener('click', () => {
  clearCopyClipboard()
  showToast('Neue Auswahl: Rechteck aufziehen')
})
document.querySelector('#copy-library-list')?.addEventListener('click', (event) => {
  const target = (event.target as Element).closest<HTMLButtonElement>('[data-blueprint-load], [data-blueprint-delete]')
  if (!target) return
  const loadId = target.dataset.blueprintLoad
  const deleteId = target.dataset.blueprintDelete
  if (loadId) {
    void listBlueprintLibrary().then((entries) => {
      const entry = entries.find((item) => item.id === loadId)
      if (!entry) return
      copyClipboard = entry.blueprint
      game.setTool('copy')
      updateCopySelectionSummary()
      updateCopyPreview(hoveredCell)
      showToast(`Vorlage „${entry.name}“ geladen`)
    })
    return
  }
  if (deleteId) {
    void deleteBlueprintLibraryEntry(deleteId).then(() => {
      showToast('Vorlage gelöscht')
      void renderCopyLibrary()
    })
  }
})

requireElement<HTMLButtonElement>('[data-close-build-menu]').addEventListener('click', () => {
  closeBuildMenu()
  if (buildMenuPanel.hidden) game.setTool('inspect')
})
makeDraggable(requireElement<HTMLElement>('.build-menu-header'), buildMenuPanel)
makeResizable(buildMenuPanel)

document.querySelectorAll<HTMLButtonElement>('[data-way-build], [data-way-icon], .supply-planner [data-tool]').forEach(button => {
  button.addEventListener('click', () => {
    if (pathWindowOpen && !button.closest('#path-construction')) closePathEditor()
    if (coasterBuilderActive) closeCoasterBuilder()
  })
})

document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((button) => {
  button.addEventListener('click', () => game.setSpeed(Number(button.dataset.speed)))
})

const visitorOverviewToggle = requireElement<HTMLButtonElement>('#open-visitors')
const logisticsPanelToggle = requireElement<HTMLButtonElement>('#open-logistics')
const financePanel = requireElement<HTMLElement>('#finance-panel')
const financeToggle = requireElement<HTMLButtonElement>('#toggle-finance')
const financeTable = requireElement<HTMLTableElement>('#finance-table')
const financeTotals = requireElement<HTMLElement>('#finance-totals')
const financeLoanAmount = requireElement<HTMLInputElement>('#finance-loan-amount')
const financeLoanStatus = requireElement<HTMLElement>('#finance-loan-status')
const financeGoals = requireElement<HTMLElement>('#finance-goals')
const financeGoalList = requireElement<HTMLElement>('#finance-goal-list')
makeDraggable(financePanel.querySelector<HTMLElement>('.panel-header')!, financePanel)
const euro = (value: number): string =>
  `${value < 0 ? '−' : ''}${Math.abs(Math.round(value)).toLocaleString('de-DE')} €`
/** Same line the ledger of every tycoon game draws: a signed figure, red when it leaves. */
const ledgerCell = (value: number | undefined, extra = ''): string =>
  value === undefined || Math.round(value) === 0
    ? `<td class="finance-empty ${extra}"></td>`
    : `<td class="${value < 0 ? 'finance-out' : 'finance-in'} ${extra}">${value > 0 ? '+' : '−'}${Math.abs(Math.round(value)).toLocaleString('de-DE')} €</td>`

let financeFingerprint = ''
function updateFinancePanel(force = false): void {
  if (!financePanel.classList.contains('visible')) return
  const overview = game.financeOverview()
  const snapshot = game.snapshot
  const fingerprint = JSON.stringify([overview, snapshot.scenarioProgress, snapshot.scenario.goals])
  if (!force && fingerprint === financeFingerprint) return
  financeFingerprint = fingerprint
  // Columns are festival editions, oldest on the left, like the months in the classics.
  const periods = overview.periods.length ? overview.periods : [{ edition: overview.edition, entries: {} }]
  const forecast = overview.forecast
  financeTable.innerHTML = `
    <thead><tr><th scope="col">Ausgaben / Einnahmen</th>${periods
      .map((period) => `<th scope="col">${period.edition}. Ausgabe</th>`)
      .join('')}<th scope="col" class="finance-forecast">Prognose morgen</th></tr></thead>
    <tbody>${FINANCE_CATEGORIES.map(
      // Every row every time, even the ones standing at zero: what a park could earn and
      // could be spending is part of the picture, the same way it is in the ledger of the
      // games this is modelled on.
      (category) => `<tr><th scope="row">${FINANCE_CATEGORY_NAMES[category]}</th>${periods
        .map((period) => ledgerCell(period.entries[category]))
        .join('')}${ledgerCell(forecast[category], 'finance-forecast')}</tr>`,
    ).join('')}</tbody>
    <tfoot><tr><th scope="row">Saldo</th>${periods
      .map((period) => ledgerCell(financePeriodTotal(period)))
      .join('')}${ledgerCell(financeEntriesTotal(forecast), 'finance-forecast')}</tr></tfoot>`
  financeTotals.innerHTML = [
    ['Guthaben', euro(overview.money)],
    ['Darlehen', euro(-overview.loan)],
    ['Festivalwert', euro(overview.parkValue)],
    ['Firmenwert', euro(overview.companyValue)],
  ]
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join('')
  const headroom = Math.max(0, overview.loanLimit - overview.loan)
  financeLoanStatus.textContent = overview.loan > 0
    ? `${euro(overview.loan)} offen · ${(overview.interestPerDay * 100).toFixed(1)} % Zinsen pro Tag · noch ${euro(headroom)} Kreditrahmen frei`
    : `Kein Darlehen · bis zu ${euro(overview.loanLimit)} möglich · ${(overview.interestPerDay * 100).toFixed(1)} % Zinsen pro Tag`
  const goals = snapshot.scenario.goals
  financeGoals.hidden = goals.length === 0
  financeGoalList.innerHTML = goals
    .map((goal, index) => {
      const status = snapshot.scenarioProgress.status[index] ?? 'open'
      const mark = status === 'done' ? '✔' : status === 'failed' ? '✘' : '○'
      return `<li class="finance-goal finance-goal-${status}"><span>${mark}</span><span>${goalName(goal)} <small>bis zur ${goal.edition}. Ausgabe · ${goalProgressText(goal, snapshot)}</small></span></li>`
    })
    .join('')
}
const openFinancePanel = (open: boolean): void => {
  setPanelOpen(financePanel, financeToggle, open, () => updateFinancePanel(true))
}
financeToggle.addEventListener('click', () => openFinancePanel(!financePanel.classList.contains('visible')))
requireElement<HTMLButtonElement>('#open-finance-money').addEventListener('click', () => openFinancePanel(true))
requireElement<HTMLButtonElement>('#close-finance').addEventListener('click', () => openFinancePanel(false))
const loanStep = (direction: number): void => {
  const step = 1_000
  const value = Math.max(0, Math.round((Number(financeLoanAmount.value) || 0) / step) * step + direction * step)
  financeLoanAmount.value = String(value)
}
requireElement<HTMLButtonElement>('#finance-loan-less').addEventListener('click', () => loanStep(-1))
requireElement<HTMLButtonElement>('#finance-loan-more').addEventListener('click', () => loanStep(1))
const sendLoan = (type: 'borrow' | 'repay'): void => {
  const amount = Math.max(0, Math.round(Number(financeLoanAmount.value) || 0))
  const result = game.manageLoan({ type, amount })
  showToast(result.message, !result.ok)
  updateFinancePanel(true)
}
requireElement<HTMLButtonElement>('#finance-borrow').addEventListener('click', () => sendLoan('borrow'))
requireElement<HTMLButtonElement>('#finance-repay').addEventListener('click', () => sendLoan('repay'))

const complaintsToggle = requireElement<HTMLButtonElement>('#open-complaints')
visitorOverviewToggle.addEventListener('click', () => {
  setPanelOpen(
    visitorOverviewPanel,
    visitorOverviewToggle,
    !visitorOverviewPanel.classList.contains('visible'),
    () => {
      visitorOverviewFingerprint = ''
      updateVisitorOverview(true)
    },
  )
})
logisticsPanelToggle.addEventListener('click', () => {
  const open = !logisticsPanel.classList.contains('visible')
  setPanelOpen(
    logisticsPanel,
    logisticsPanelToggle,
    open,
    () => {
      logisticsFingerprint = ''
      updateLogisticsPanel(true)
    },
  )
  if (open) syncBusPlannerOverlay()
  else view.setBusPlannerRoute(null)
})
requireElement<HTMLButtonElement>('#debug-money').addEventListener('click', () => {
  const result = game.addDebugMoney()
  debugMenuPanel.classList.remove('open')
  debugMenuToggle.setAttribute('aria-expanded', 'false')
  showToast(result.message)
})
const debugMenuToggle =
  requireElement<HTMLButtonElement>('#toggle-debug-menu')
const debugMenuPanel =
  requireElement<HTMLDivElement>('#debug-menu-panel')
const saveMenuToggle =
  requireElement<HTMLButtonElement>('#toggle-save-menu')
const saveMenuPanel =
  requireElement<HTMLDivElement>('#save-menu-panel')
// The button row wraps onto multiple lines depending on available width, so
// the panel can't rely on a static CSS anchor (it would end up far from
// whichever line the button currently sits on). Position it from the
// button's live on-screen rect instead, clamped to stay fully in view.
function positionDropdownPanel(button: HTMLElement, panel: HTMLElement, panelWidth = 250): void {
  const margin = 8
  const width = Math.min(panelWidth, window.innerWidth - margin * 2)
  const rect = button.getBoundingClientRect()
  const left = Math.min(
    Math.max(rect.right - width, margin),
    window.innerWidth - width - margin,
  )
  panel.style.left = `${left}px`
  panel.style.top = `${rect.bottom + margin}px`
}

const staffMenuToggle =
  requireElement<HTMLButtonElement>('#toggle-staff-menu')
const staffMenuPanel =
  requireElement<HTMLDivElement>('#staff-menu-panel')

const closeSaveMenu = (): void => {
  saveMenuPanel.classList.remove('open')
  saveMenuToggle.setAttribute('aria-expanded', 'false')
}
const closeDebugMenu = (): void => {
  debugMenuPanel.classList.remove('open')
  debugMenuToggle.setAttribute('aria-expanded', 'false')
}
const closeStaffMenu = (): void => {
  staffMenuPanel.classList.remove('open')
  staffMenuToggle.setAttribute('aria-expanded', 'false')
}
requireElement<HTMLButtonElement>('#debug-clear-waste').addEventListener('click', () => {
  const result = game.clearWasteForDebug()
  closeDebugMenu()
  showToast(result.message, !result.ok)
})
debugMenuToggle.addEventListener('click', () => {
  closeSaveMenu()
  closeStaffMenu()
  const open = debugMenuPanel.classList.toggle('open')
  debugMenuToggle.setAttribute('aria-expanded', String(open))
  if (open) positionDropdownPanel(debugMenuToggle, debugMenuPanel)
})
saveMenuToggle.addEventListener('click', () => {
  closeDebugMenu()
  closeStaffMenu()
  const open = saveMenuPanel.classList.toggle('open')
  saveMenuToggle.setAttribute('aria-expanded', String(open))
  if (open) positionDropdownPanel(saveMenuToggle, saveMenuPanel)
})
saveMenuPanel.addEventListener('click', (event) => {
  if (!(event.target as HTMLElement).closest('button')) return
  closeSaveMenu()
})
staffMenuToggle.addEventListener('click', () => {
  closeDebugMenu()
  closeSaveMenu()
  const open = !staffPanel.classList.contains('visible')
  staffMenuToggle.setAttribute('aria-expanded', String(open))
  if (open) openStaffOverview(currentStaffRole)
  else staffPanel.classList.remove('visible')
})
document.querySelector('.staff-role-tabs')!.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-staff-role]')
  if (!button) return
  closeStaffMenu()
  openStaffOverview(button.dataset.staffRole as StaffRole)
})
staffMenuPanel.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-staff-role]')
  if (!button) return
  closeStaffMenu()
  openStaffOverview(button.dataset.staffRole as StaffRole)
})
window.addEventListener('resize', () => {
  if (debugMenuPanel.classList.contains('open')) positionDropdownPanel(debugMenuToggle, debugMenuPanel)
  if (saveMenuPanel.classList.contains('open')) positionDropdownPanel(saveMenuToggle, saveMenuPanel)
})
requireElement<HTMLButtonElement>('#debug-remove-cars').addEventListener(
  'click',
  () => {
    const result = game.removeVisitorCarsForDebug()
    debugMenuPanel.classList.remove('open')
    debugMenuToggle.setAttribute('aria-expanded', 'false')
    showToast(result.message)
  },
)

const scenarioToggle = requireElement<HTMLButtonElement>('#toggle-scenario')
const scenarioPanel = requireElement<HTMLElement>('#scenario-panel')
const scenarioCarShare = requireElement<HTMLInputElement>('#scenario-car-share')
const scenarioParty = requireElement<HTMLInputElement>('#scenario-party')
const scenarioBeauty = requireElement<HTMLInputElement>('#scenario-beauty')
const scenarioAggression = requireElement<HTMLInputElement>('#scenario-aggression')
const scenarioMoney = requireElement<HTMLInputElement>('#scenario-money')
const scenarioEnvironment = requireElement<HTMLSelectElement>('#scenario-environment')
const scenarioUnevenness = requireElement<HTMLInputElement>('#scenario-unevenness')
scenarioEnvironment.addEventListener('change', () => updateScenarioLabels())

/** The free-play form on the title screen: a site without a template, without debt and without goals. */
const scenarioForm = createScenarioFormController(() => game)
const readScenarioForm = scenarioForm.read
const fillScenarioForm = scenarioForm.fill
const updateScenarioSummary = scenarioForm.updateSummary
const updateScenarioLabels = scenarioForm.updateLabels

function setScenarioPanelOpen(open: boolean): void {
  scenarioPanel.hidden = !open
  scenarioToggle.setAttribute('aria-expanded', String(open))
  if (open) {
    setMultiplayerPanelOpen(false)
    updateScenarioSummary()
  }
}

function setMultiplayerPanelOpen(open: boolean): void {
  multiplayerPanel.hidden = !open
  multiplayerToggle.setAttribute('aria-expanded', String(open))
  if (open) setScenarioPanelOpen(false)
}

function readMultiplayerName(): string {
  const name = multiplayerName.value.trim() || 'Spieler'
  window.localStorage.setItem(MULTIPLAYER_NAME_KEY, name)
  return name
}

function renderMultiplayerStatus(status: MultiplayerStatus): void {
  const connected = status.connected
  multiplayerStatusBadge.dataset.state = connected ? 'online' : status.message ? 'disconnected' : 'solo'
  multiplayerStatus.textContent = connected
    ? `Online · ${status.mode === 'host' ? 'Host' : 'Verbunden'} · Raum ${status.code}`
    : status.message || 'Singleplayer'
  multiplayerToggle.textContent = '🌐'
  const multiplayerLabel = connected
    ? status.mode === 'host'
      ? `Host ${status.code}`
      : `Online ${status.code}`
    : 'Mehrspieler'
  multiplayerToggle.title = multiplayerLabel
  multiplayerToggle.setAttribute('aria-label', multiplayerLabel)
  multiplayerConnectActions.hidden = connected
  multiplayerCodeField.hidden = connected
  multiplayerJoinActions.hidden = connected
  multiplayerRoom.hidden = !connected
  multiplayerCodeDisplay.textContent = status.code
  multiplayerJoinUrl.textContent = status.joinUrl
  multiplayerPlayers.innerHTML = status.players
    .map(
      (player) =>
        `<li>${player.name}${player.role === 'host' ? ' · Host' : ''}</li>`,
    )
    .join('')
}

multiplayer.onStatus = renderMultiplayerStatus
multiplayer.onToast = (message, isError) => {
  if (message) showToast(message, Boolean(isError))
}
multiplayerName.value =
  window.localStorage.getItem(MULTIPLAYER_NAME_KEY) ??
  `Spieler ${Math.floor(Math.random() * 90 + 10)}`
const joinFromUrl = new URLSearchParams(window.location.search).get('join')
if (joinFromUrl) {
  multiplayerCode.value = joinFromUrl.toUpperCase()
  setMultiplayerPanelOpen(true)
}

multiplayerToggle.addEventListener('click', () => {
  setMultiplayerPanelOpen(multiplayerPanel.hasAttribute('hidden'))
})
requireElement<HTMLButtonElement>('#close-multiplayer').addEventListener('click', () => {
  setMultiplayerPanelOpen(false)
})
makeDraggable(multiplayerPanel.querySelector<HTMLElement>('.panel-header')!, multiplayerPanel)
makeResizable(multiplayerPanel)
multiplayerHostButton.addEventListener('click', () => {
  multiplayer.host(readMultiplayerName())
  showToast('Verbinde als Host…')
})
multiplayerJoinButton.addEventListener('click', () => {
  const code = multiplayerCode.value.trim().toUpperCase()
  if (code.length < 4) {
    showToast('Bitte einen 4-stelligen Code eingeben', true)
    return
  }
  multiplayer.join(code, readMultiplayerName())
  showToast(`Trete ${code} bei…`)
})
multiplayerLeaveButton.addEventListener('click', () => {
  multiplayer.disconnect()
})
multiplayerCopyButton.addEventListener('click', async () => {
  const code = multiplayer.status.code
  if (!code) return
  const text = `${window.location.origin}?join=${code}`
  try {
    await navigator.clipboard.writeText(text)
    showToast('Einladungslink kopiert')
  } catch {
    showToast(code)
  }
})

;[
  scenarioCarShare,
  scenarioParty,
  scenarioBeauty,
  scenarioAggression,
  scenarioMoney,
  scenarioUnevenness,
].forEach((input) => {
  input.addEventListener('input', () => updateScenarioLabels())
})
scenarioToggle.addEventListener('click', () => {
  setScenarioPanelOpen(scenarioPanel.hasAttribute('hidden'))
})
requireElement<HTMLButtonElement>('#close-scenario').addEventListener('click', () => {
  setScenarioPanelOpen(false)
})
makeDraggable(scenarioPanel.querySelector<HTMLElement>('.panel-header')!, scenarioPanel)
makeResizable(scenarioPanel)
/**
 * The title screen: the first thing the game shows, and the way back to a clean start.
 * It reuses what is already there rather than duplicating it — the prepared scenarios,
 * the save management and the settings window are the same ones the running game uses,
 * lifted above the backdrop while it is open so closing them returns here.
 */
fillScenarioForm(game.snapshot.scenario)
requireElement<HTMLButtonElement>('#close-logistics').addEventListener('click', () => {
  setPanelOpen(logisticsPanel, logisticsPanelToggle, false)
  view.setBusPlannerRoute(null)
})
document.querySelectorAll<HTMLButtonElement>('[data-logistics-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    document
      .querySelectorAll<HTMLButtonElement>('[data-logistics-tab]')
      .forEach((candidate) =>
        candidate.classList.toggle('active', candidate === button),
      )
    const tab = button.dataset.logisticsTab
    logisticsOverview.hidden = tab !== 'overview'
    logisticsSupply.hidden = tab !== 'supply'
    logisticsRoutes.hidden = tab !== 'routes'
    logisticsBandSupply.hidden = tab !== 'band-supply'
    if (tab === 'supply' || tab === 'band-supply' || tab === 'routes') updateLogisticsPanel(true)
    if (tab === 'routes') syncBusPlannerOverlay()
    else view.setBusPlannerRoute(null)
  })
})
logisticsBandSupply.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button')
  if (!button) return
  if (button.id === 'band-supply-paint') {
    backstageEraseMode = false
    game.setTool('backstageArea')
    updateLogisticsPanel(true)
    return
  }
  if (button.id === 'band-supply-erase') {
    backstageEraseMode = true
    game.setTool('backstageArea')
    updateLogisticsPanel(true)
    return
  }
  if (button.id === 'band-supply-parking') {
    game.setTool('tourBusParking')
    return
  }
  const stageId = button.dataset.bandSupplyFocus
  if (!stageId) return
  const stage = game.snapshot.buildings.find((building) => building.id === stageId)
  if (stage) view.focusWorldPosition(stage.x + 0.5, stage.z + 0.5)
})
logisticsOverview.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button')
  if (!button) return
  const garageId = button.dataset.buyAmbulance
  const sellAmbulanceId = button.dataset.sellAmbulance
  const depotId = button.dataset.buyBus
  const sellDepotId = button.dataset.sellBus
  const garbageDepotId = button.dataset.buyGarbage
  const sellGarbageId = button.dataset.sellGarbage
  const sweeperDepotId = button.dataset.buySweeper
  const sellSweeperId = button.dataset.sellSweeper
  const result = garageId
    ? game.buyAmbulance(garageId)
    : sellAmbulanceId
      ? game.sellAmbulance(sellAmbulanceId)
    : depotId
      ? game.buyBus(depotId)
      : sellDepotId
        ? game.sellBus(sellDepotId)
      : garbageDepotId
        ? game.buyGarbageTruck(garbageDepotId)
      : sellGarbageId
        ? game.sellGarbageTruck(sellGarbageId)
      : sweeperDepotId
        ? game.buySweeper(sweeperDepotId)
      : sellSweeperId
        ? game.sellSweeper(sellSweeperId)
      : null
  if (result) showToast(result.message, !result.ok)
})

function applyDepotMinimum(depotId: string, kind: Supply, quantity: number): void {
  const result = game.manageFestival({ type: 'minimum', depotId, kind, quantity: snapStockMinimum(quantity) })
  showToast(result.message, !result.ok)
  updateLogisticsPanel(true)
  updateEntityPanel()
}

function applyDepotWorkers(depotId: string, workers: number, distribution: 'relay' | 'shops'): void {
  const result = game.manageFestival({ type: 'depotSettings', depotId, distribution, workers })
  showToast(result.message, !result.ok)
  updateLogisticsPanel(true)
  updateEntityPanel()
}

function bindStockSliders(root: ParentNode, attr: 'data-supply-min' | 'data-depot-min', getDepotId: () => string): void {
  root.querySelectorAll<HTMLInputElement>(`[${attr}]`).forEach((input) => {
    input.addEventListener('input', () => {
      const snapped = snapStockMinimum(Number(input.value))
      input.value = String(snapped)
      const kind = input.getAttribute(attr)
      const label = root.querySelector<HTMLElement>(`#${attr === 'data-supply-min' ? 'supply' : 'depot'}-min-${kind}-value`)
      if (label) label.textContent = String(snapped)
    })
    input.addEventListener('change', () => {
      const depotId = getDepotId()
      const kind = input.getAttribute(attr) as Supply | null
      if (!depotId || !kind) return
      applyDepotMinimum(depotId, kind, Number(input.value))
    })
  })
}

bindStockSliders(logisticsSupply, 'data-supply-min', selectedSupplyDepotId)
bindStockSliders(depotOptions, 'data-depot-min', () => selectedEntity?.type === 'depot' ? selectedEntity.id : '')
supplyDepotSelect.addEventListener('change', () => updateLogisticsPanel(true))
supplyDepotDistribution.addEventListener('change', () => {
  const depotId = selectedSupplyDepotId()
  if (!depotId) return
  applyDepotWorkers(depotId, Number(supplyWorkers.value), supplyDepotDistribution.value as 'relay' | 'shops')
})
supplyWorkers.addEventListener('input', () => {
  supplyWorkersValue.textContent = supplyWorkers.value
})
supplyWorkers.addEventListener('change', () => {
  const depotId = selectedSupplyDepotId()
  if (!depotId) return
  applyDepotWorkers(depotId, Number(supplyWorkers.value), supplyDepotDistribution.value as 'relay' | 'shops')
})
supplyRemoveDepot.addEventListener('click', () => {
  const depotId = selectedSupplyDepotId()
  if (!depotId) return
  const result = game.manageFestival({ type: 'removeDepot', depotId })
  showToast(result.message, !result.ok)
  if (result.ok && selectedEntity?.type === 'depot' && selectedEntity.id === depotId) closeEntityPanel()
  updateLogisticsPanel(true)
})
depotDistribution.addEventListener('change', () => {
  if (selectedEntity?.type !== 'depot') return
  applyDepotWorkers(selectedEntity.id, Number(depotWorkers.value), depotDistribution.value as 'relay' | 'shops')
})
depotWorkers.addEventListener('input', () => {
  depotWorkersValue.textContent = depotWorkers.value
})
depotWorkers.addEventListener('change', () => {
  if (selectedEntity?.type !== 'depot') return
  applyDepotWorkers(selectedEntity.id, Number(depotWorkers.value), depotDistribution.value as 'relay' | 'shops')
})
depotRemove.addEventListener('click', () => {
  if (selectedEntity?.type !== 'depot') return
  const result = game.manageFestival({ type: 'removeDepot', depotId: selectedEntity.id })
  showToast(result.message, !result.ok)
  if (result.ok) closeEntityPanel()
  updateLogisticsPanel(true)
})
requireElement<HTMLButtonElement>('#create-bus-line').addEventListener('click', () => {
  const result = game.createBusLine(
    requireElement<HTMLInputElement>('#bus-line-name').value,
    busLineDepot.value,
    [...plannedBusStopIds],
    Number(requireElement<HTMLInputElement>('#bus-line-count').value),
    Number(requireElement<HTMLInputElement>('#bus-line-headway').value),
  )
  showToast(result.message, !result.ok)
  if (result.ok) editingBusLineId = null
  updateLogisticsPanel(true)
})
applyBusLineStops.addEventListener('click', () => {
  if (!editingBusLineId) return
  const result = game.setBusLineStops(editingBusLineId, [...plannedBusStopIds])
  showToast(result.message, !result.ok)
  updateLogisticsPanel(true)
})
sortBusLine.addEventListener('click', () => {
  if (plannedBusStopIds.length < 2) {
    showToast('Mindestens zwei Haltestellen für die kürzeste Route', true)
    return
  }
  const sorted = game.sortBusLineStops([...plannedBusStopIds], busLineDepot.value || undefined)
  plannedBusStopIds.splice(0, plannedBusStopIds.length, ...sorted)
  renderBusPlanner()
  showToast('Route automatisch sortiert (kürzeste Runde)')
})
busStopChoices.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-add-stop]')
  if (!button?.dataset.addStop) return
  addPlannedBusStop(button.dataset.addStop)
})
busLinePlanned.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button')
  if (!button) return
  if (button.dataset.removeStop != null) {
    removePlannedBusStop(Number(button.dataset.removeStop))
    return
  }
  if (button.dataset.moveStop != null) {
    movePlannedBusStop(Number(button.dataset.moveStop), Number(button.dataset.delta))
  }
})

function busPlannerDropIndex(event: DragEvent): number {
  const item = (event.target as HTMLElement).closest<HTMLElement>('[data-planned-index]')
  if (item && busLinePlanned.contains(item)) return Number(item.dataset.plannedIndex)
  return plannedBusStopIds.length
}

function applyPlannerLists(active: string[]): void {
  plannedBusStopIds.splice(0, plannedBusStopIds.length, ...active)
  renderBusPlanner()
}

busPlannerRoot.addEventListener('dragstart', (event) => {
  const target = event.target as HTMLElement
  if (target.closest('button:not([data-add-stop])')) {
    event.preventDefault()
    return
  }
  const item = target.closest<HTMLElement>('[data-stop-id][data-planner-source]')
  if (!item || !event.dataTransfer) return
  const source = item.dataset.plannerSource as BusPlannerColumn
  const stopId = item.dataset.stopId
  if (!stopId) return
  const payload = JSON.stringify({ source, stopId })
  event.dataTransfer.setData('application/x-bus-stop', payload)
  event.dataTransfer.setData('text/plain', payload)
  event.dataTransfer.effectAllowed = source === 'available' ? 'copyMove' : 'move'
  item.classList.add('dragging')
  busPlannerDragging = true
})
busPlannerRoot.addEventListener('dragend', () => {
  busPlannerDragging = false
  busPlannerRoot.querySelectorAll('.dragging, .drop-target, .drop-before').forEach((node) => {
    node.classList.remove('dragging', 'drop-target', 'drop-before')
  })
})
busPlannerRoot.addEventListener('dragover', (event) => {
  const column = (event.target as HTMLElement).closest<HTMLElement>('[data-planner-column]')
  if (!column) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  busPlannerRoot.querySelectorAll('.drop-target, .drop-before').forEach((node) => {
    node.classList.remove('drop-target', 'drop-before')
  })
  column.classList.add('drop-target')
  const item = (event.target as HTMLElement).closest<HTMLElement>('[data-planned-index]')
  item?.classList.add('drop-before')
})
busPlannerRoot.addEventListener('drop', (event) => {
  const column = (event.target as HTMLElement).closest<HTMLElement>('[data-planner-column]')
  if (!column || !event.dataTransfer) return
  event.preventDefault()
  busPlannerDragging = false
  let payload: { source: BusPlannerColumn; stopId: string } | null = null
  try {
    payload = JSON.parse(
      event.dataTransfer.getData('application/x-bus-stop') ||
        event.dataTransfer.getData('text/plain'),
    ) as {
      source: BusPlannerColumn
      stopId: string
    }
  } catch {
    payload = null
  }
  busPlannerRoot.querySelectorAll('.dragging, .drop-target, .drop-before').forEach((node) => {
    node.classList.remove('dragging', 'drop-target', 'drop-before')
  })
  if (!payload?.stopId) return
  const target = column.dataset.plannerColumn as BusPlannerColumn
  const allIds = game.snapshot.logistics.busStops.map((stop) => stop.id)
  const lists = applyBusPlannerDrag(allIds, plannedBusStopIds, {
    source: payload.source,
    stopId: payload.stopId,
    target,
    at: target === 'active' ? busPlannerDropIndex(event) : undefined,
  })
  applyPlannerLists(lists.active)
})
busLinesList.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button')
  if (!button) return
  if (button.dataset.editLine) {
    loadBusLineIntoPlanner(button.dataset.editLine)
    return
  }
  if (button.dataset.addBusLine) {
    const result = game.addBusToLine(button.dataset.addBusLine)
    showToast(result.message, !result.ok)
    updateLogisticsPanel(true)
    return
  }
  if (!button.dataset.deleteLine) return
  const result = game.deleteBusLine(button.dataset.deleteLine)
  showToast(result.message, !result.ok)
  if (editingBusLineId === button.dataset.deleteLine) editingBusLineId = null
  updateLogisticsPanel(true)
})
complaintsToggle.addEventListener('click', () => {
  setPanelOpen(
    complaintsPanel,
    complaintsToggle,
    !complaintsPanel.classList.contains('visible'),
    () => {
      complaintsFingerprint = ''
      updateComplaintsPanel(true)
    },
  )
})
requireElement<HTMLButtonElement>('#close-complaints').addEventListener('click', () => {
  setPanelOpen(complaintsPanel, complaintsToggle, false)
})
dayPlanGrid.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    '[data-day-plan-offer][data-day-plan-hour]',
  )
  if (!button) return
  const offer = button.dataset.dayPlanOffer as DayPlanOffer
  const hour = Number(button.dataset.dayPlanHour)
  game.setDayPlanHour(offer, hour, !button.classList.contains('active'))
  updateDayPlanPanel(true)
})
function updateDayVisitorWindow(): void {
  const result = game.updateDayVisitorWindow(
    Number(dayEntryHour.value),
    Number(dayExitHour.value),
  )
  showToast(result.message, !result.ok)
  updateDayPlanPanel(true)
}
dayEntryHour.addEventListener('change', updateDayVisitorWindow)
dayExitHour.addEventListener('change', updateDayVisitorWindow)
campingCapacityBuffer.addEventListener('change', () => {
  const result = game.updateCampingCapacityBuffer(
    Number(campingCapacityBuffer.value),
  )
  showToast(result.message, !result.ok)
  updateDayPlanPanel(true)
})
requireElement<HTMLButtonElement>('#apply-festival-cycle').addEventListener(
  'click',
  () => {
    const result = game.updateFestivalCycle(
      Number(festivalLeadDays.value),
      Number(festivalActiveDays.value),
      Number(festivalBreakDays.value),
    )
    showToast(result.message, !result.ok)
    dayPlanFingerprint = ''
    updateDayPlanPanel(true)
  },
)
requireElement<HTMLButtonElement>('#close-visitor-overview').addEventListener('click', () => {
  setPanelOpen(visitorOverviewPanel, visitorOverviewToggle, false)
})
visitorThoughtFilter.addEventListener('input', () => {
  visitorOverviewPage = 0
  updateVisitorOverview(true)
})
visitorOverviewSort.addEventListener('change', () => {
  visitorOverviewPage = 0
  updateVisitorOverview(true)
})
visitorSortDirection.addEventListener('click', () => {
  visitorOverviewAscending = !visitorOverviewAscending
  updateVisitorOverview(true)
})
visitorPagePrevious.addEventListener('click', () => {
  visitorOverviewPage = Math.max(0, visitorOverviewPage - 1)
  updateVisitorOverview(true)
})
visitorPageNext.addEventListener('click', () => {
  visitorOverviewPage += 1
  updateVisitorOverview(true)
})
visitorOverviewList.addEventListener('click', (event) => {
  const row = (event.target as HTMLElement).closest<HTMLElement>(
    '[data-visitor-overview-id]',
  )
  const visitorId = row?.dataset.visitorOverviewId
  if (!visitorId) return
  setPanelOpen(visitorOverviewPanel, visitorOverviewToggle, false)
  selectVisitor(visitorId)
})
requireElement<HTMLButtonElement>('#close-staff').addEventListener('click', () => {
  staffPanel.classList.remove('visible')
  staffMenuToggle.setAttribute('aria-expanded', 'false')
})
staffList.addEventListener('click', (event) => {
  const target = event.target as HTMLElement
  const hire = target.closest<HTMLButtonElement>('[data-hire-staff]')
  if (hire) {
    const result = game.hireStaff(hire.dataset.hireStaff as StaffRole)
    showToast(result.message, !result.ok)
    return
  }
  const fireMember = target.closest<HTMLButtonElement>('[data-fire-member]')
  if (fireMember) {
    const result = game.fireStaffMember(fireMember.dataset.fireMember!)
    showToast(result.message, !result.ok)
    return
  }
  const row = target.closest<HTMLElement>('[data-inspect-staff]')
  if (row) staffDetails.open(row.dataset.inspectStaff!)
})
staffList.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-inspect-staff]')
  if (!row) return
  event.preventDefault()
  staffDetails.open(row.dataset.inspectStaff!)
})

securityThoroughness.addEventListener('input', () => {
  securityThoroughnessValue.textContent = `${securityThoroughness.value}%`
})
securityThoroughness.addEventListener('change', () => {
  if (selectedEntity?.type !== 'building') return
  game.updateSecurityGate(selectedEntity.id, {
    thoroughness: Number(securityThoroughness.value) / 100,
  })
})
securityFlowShare.addEventListener('input', () => {
  securityFlowShareValue.textContent = `${securityFlowShare.value}%`
})
securityFlowShare.addEventListener('change', () => {
  if (selectedEntity?.type !== 'building') return
  game.updateSecurityGate(selectedEntity.id, {
    flowShare: Number(securityFlowShare.value) / 100,
  })
})
securityProhibitedItems.addEventListener('change', () => {
  if (selectedEntity?.type !== 'building') return
  const prohibitedItems = [
    ...securityProhibitedItems.querySelectorAll<HTMLInputElement>(
      '[data-security-item]:checked',
    ),
  ].map((input) => input.dataset.securityItem as keyof typeof INVENTORY_ITEMS)
  game.updateSecurityGate(selectedEntity.id, { prohibitedItems })
})

logisticsOverlayButton.addEventListener('click', () => {
  setMapOverlay(logisticsOverlayVisible ? null : 'logistics')
})

crowdingOverlayButton.addEventListener('click', () => {
  setMapOverlay(crowdingOverlayVisible ? null : 'crowding')
})

attractivenessOverlayButton.addEventListener('click', () => {
  setMapOverlay(attractivenessOverlayVisible ? null : 'attractiveness')
})

partyOverlayButton.addEventListener('click', () => {
  setMapOverlay(partyOverlayVisible ? null : 'party')
})

function setMapOverlay(
  overlay: 'crowding' | 'attractiveness' | 'party' | 'logistics' | null,
): void {
  logisticsOverlayVisible = overlay === 'logistics'
  crowdingOverlayVisible = overlay === 'crowding'
  attractivenessOverlayVisible = overlay === 'attractiveness'
  partyOverlayVisible = overlay === 'party'
  supplyPlanner.setOverlay(logisticsOverlayVisible)
  view.setCrowdingOverlayVisible(crowdingOverlayVisible)
  view.setAttractivenessOverlayVisible(attractivenessOverlayVisible)
  view.setPartyMoodOverlayVisible(partyOverlayVisible)
  ;[
    [logisticsOverlayButton, logisticsOverlayVisible],
    [crowdingOverlayButton, crowdingOverlayVisible],
    [attractivenessOverlayButton, attractivenessOverlayVisible],
    [partyOverlayButton, partyOverlayVisible],
  ].forEach(([button, active]) => {
    ;(button as HTMLButtonElement).classList.toggle('active', Boolean(active))
    ;(button as HTMLButtonElement).setAttribute(
      'aria-pressed',
      String(active),
    )
  })
}

entityPriceInput.addEventListener('change', () => {
  if (!selectedEntity || selectedEntity.type === 'depot' || selectedEntity.type === 'access' || selectedEntity.type === 'vehicle' || selectedEntity.type === 'wasteDump' || selectedEntity.type === 'backstage') return
  if (selectedEntity.type === 'coaster') {
    game.updateCoasterPrice(selectedEntity.id, Number(entityPriceInput.value))
  } else {
    game.updateBuildingPrice(selectedEntity.id, Number(entityPriceInput.value))
  }
})

shirtColorPalette.addEventListener('click', (event) => {
  if (selectedEntity?.type !== 'building') return
  const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-shirt-color]')
  if (!button) return
  game.configureShirtStall(selectedEntity.id, { color: Number(button.dataset.shirtColor) })
})

shirtStyleSelect.addEventListener('change', () => {
  if (selectedEntity?.type !== 'building') return
  game.configureShirtStall(selectedEntity.id, {
    style: shirtStyleSelect.value as (typeof SHIRT_STYLES)[number],
  })
})

applyPriceToKindButton.addEventListener('click', () => {
  if (selectedEntity?.type !== 'building') return
  const building = game.snapshot.buildings.find(
    (item) => item.id === selectedEntity?.id,
  )
  if (!building) return
  const count = game.snapshot.buildings.filter(
    (item) => item.kind === building.kind,
  ).length
  game.updateBuildingPrice(
    building.id,
    Number(entityPriceInput.value),
    true,
  )
  showToast(
    `Preis für ${count} ${BUILDINGS[building.kind].name}-Gebäude übernommen`,
  )
})

document.querySelector<HTMLButtonElement>('#toggle-path-editor')?.addEventListener('click', () => {
  if (!pathWindowOpen) {
    openPathWindow(true)
    return
  }
  setPathConstructMode(!pathEditorActive)
})

document.querySelector<HTMLButtonElement>('#close-path-editor')?.addEventListener('click', () => {
  closePathEditor()
  game.setTool('inspect')
})

document.querySelectorAll<HTMLButtonElement>('[data-path-direction]').forEach((button) => {
  button.addEventListener('click', () => {
    resumePathPlacement()
    pathDirection = Number(button.dataset.pathDirection)
    updatePathEditor()
  })
})

document.querySelectorAll<HTMLButtonElement>('[data-slope]').forEach((button) => {
  button.addEventListener('click', () => {
    resumePathPlacement()
    setPathSlope(Number(button.dataset.slope))
  })
})

document.querySelectorAll<HTMLButtonElement>('[data-path-type]').forEach((button) => {
  button.addEventListener('click', () => {
    resumePathPlacement()
    pathConstructionType = button.dataset.pathType as 'normal' | 'queue'
    pathConstructionTypeSelect.value = pathConstructionType
    updatePathEditor()
  })
})

pathDemolishButton.addEventListener('click', () => {
  pathDemolishActive = !pathDemolishActive
  supplyPlanner.releaseTool()
  if (pathDemolishActive) game.setTool(roadEditorOpen ? 'road' : 'path')
  updatePathEditor()
})

document.querySelectorAll<HTMLButtonElement>('[data-road-editor-tool]').forEach(button => {
  button.addEventListener('click', () => {
    supplyPlanner.releaseTool()
    pathDemolishActive = false
    pathEditorActive = false
    pathAnchor = null
    clearShiftElevationOrigin()
    pathHistory = []
    game.setTool(button.dataset.roadEditorTool as Tool)
    updatePathEditor()
  })
})

document.querySelectorAll<HTMLButtonElement>('[data-path-access]').forEach((button) => {
  button.addEventListener('click', () => {
    const tool = button.dataset.pathAccess as Tool | undefined
    if (!tool) return
    pathDemolishActive = false
    pathEditorActive = false
    game.setTool(tool)
    updatePathEditor()
  })
})

pathConstructionTypeSelect.addEventListener('change', () => {
  pathConstructionType = pathConstructionTypeSelect.value as 'normal' | 'queue'
  updatePathEditor()
})

buildPathButton.addEventListener('click', () => buildNextPathSegment())
undoPathButton.addEventListener('click', () => undoLastPathSegment())

document.querySelector<HTMLButtonElement>('#close-coaster-builder')?.addEventListener('click', () => {
  closeCoasterBuilder()
  game.setTool('inspect')
})

coasterRotateButton.addEventListener('click', () => {
  if (!activeCoasterId) game.rotateBuild()
  updateCoasterBuilder()
})

function selectCoasterPaletteKind(kind: TrackPieceKind, fromSpecials: boolean): void {
  const end = openCoasterEnd()
  if (!isTrackPalettePieceEnabled(kind, end, Boolean(end), selectedCoasterTypeId())) return
  applyCoasterWindow(applyConstructionKind(currentCoasterWindow(), kind, end))
  trackPieceSelect.value = kind
  if (fromSpecials) {
    trackSpecialPalette.hidden = true
    trackSpecialToggle.setAttribute('aria-expanded', 'false')
    trackSpecialToggle.textContent = `Speziell: ${TRACK_PIECES[kind].name}`
  } else {
    trackSpecialToggle.textContent = 'Speziell …'
  }
  updateCoasterBuilder()
}

trackPieceSelect.addEventListener('change', () => {
  applyCoasterWindow(
    applyConstructionKind(currentCoasterWindow(), trackPieceSelect.value as TrackPieceKind, openCoasterEnd()),
  )
  updateCoasterBuilder()
})
trackSpecialToggle.addEventListener('click', () => {
  trackSpecialPalette.hidden = !trackSpecialPalette.hidden
  trackSpecialToggle.setAttribute(
    'aria-expanded',
    String(!trackSpecialPalette.hidden),
  )
})
trackDirectionPalette.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-track-piece]')
  if (!button?.dataset.trackPiece || button.disabled) return
  selectCoasterPaletteKind(button.dataset.trackPiece as TrackPieceKind, false)
})
trackSpecialPalette.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-track-piece]')
  if (!button?.dataset.trackPiece || button.disabled) return
  selectCoasterPaletteKind(button.dataset.trackPiece as TrackPieceKind, true)
})
trackSlopePalette.addEventListener('click', (event) => {
  const chain = (event.target as HTMLElement).closest<HTMLButtonElement>('#toggle-chain-lift')
  if (chain) {
    if (chain.disabled) return
    chainLiftInput.checked = !chainLiftInput.checked
    updateCoasterBuilder()
    return
  }
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-track-pitch]')
  if (!button || button.disabled) return
  trackSpecialToggle.textContent = 'Speziell …'
  selectCoasterPitch(Number(button.dataset.trackPitch))
})
trackBankPalette.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-track-bank]')
  if (!button || button.disabled) return
  trackSpecialToggle.textContent = 'Speziell …'
  selectCoasterBank(Number(button.dataset.trackBank))
})
chainLiftInput.addEventListener('change', () => updateCoasterBuilder())
coasterBuildButton.addEventListener('click', () => buildCoasterPiece())
coasterUndoButton.addEventListener('click', () => undoCoasterPiece())
trackPreviousButton.addEventListener('click', () => moveCoasterTrackCursor(-1))
trackNextButton.addEventListener('click', () => moveCoasterTrackCursor(1))
deleteTrackButton.addEventListener('click', () => deleteCoasterFromSelection())
coasterEntranceButton.addEventListener('click', () => {
  coasterAccessMode = 'entrance'
  updateContextHelp()
})
coasterExitButton.addEventListener('click', () => {
  coasterAccessMode = 'exit'
  updateContextHelp()
})

let titleScreenController: TitleScreenController
const saveController = mountSaveController({
  getGame: () => game,
  getMultiplayerMode: () => multiplayer.status.mode,
  isTitleOpen: () => titleScreenController?.isOpen() ?? false,
  rememberLastSave: (slot) => titleScreenController?.rememberLastSave(slot),
  isPathWindowOpen: () => pathWindowOpen,
  closePathEditor,
  bindGameState,
  fillScenarioForm,
  showToast,
})
const saveSlotsPanel = saveController.panel
const setSaveSlotsPanelOpen = saveController.setPanelOpen
const fetchSaveSlots = saveController.fetchSlots
const findSaveSlot = saveController.findSlot
const readSaveSlot = saveController.readSlot
const bindLoadedGame = saveController.bindLoadedGame
const tryQuickLoad = saveController.tryQuickLoad
const formatSaveTime = saveController.formatSaveTime

titleScreenController = mountTitleScreen({
  getGame: () => game,
  getMultiplayerMode: () => multiplayer.status.mode,
  scenarioPanel,
  saveSlotsPanel,
  setScenarioPanelOpen,
  setSaveSlotsPanelOpen,
  fillScenarioForm,
  readScenarioForm,
  closePathEditor,
  isPathWindowOpen: () => pathWindowOpen,
  hideVisitorPanel,
  bindGameState,
  showToast,
  fetchSaveSlots,
  findSaveSlot,
  isOwnSave: saveController.isOwnSave,
  readSaveSlot,
  bindLoadedGame,
  tryQuickLoad,
  formatSaveTime,
})
toggleParkButton.addEventListener('click', () => {
  const result = game.setParkOpen(!game.snapshot.parkOpen)
  showToast(result.message)
})

document.querySelector<HTMLButtonElement>('#close-entity')?.addEventListener('click', () => {
  closeEntityPanel()
})
entityStats.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    '[data-sell-ambulance-vehicle]',
  )
  if (!button?.dataset.sellAmbulanceVehicle) return
  const result = game.sellAmbulanceVehicle(button.dataset.sellAmbulanceVehicle)
  showToast(result.message, !result.ok)
  if (result.ok) updateEntityPanel()
})

function patchSelectedAccess(
  patch: Parameters<GameState['configureAccessControl']>[1],
): void {
  const control = selectedAccessControl()
  if (!control) return
  const result = game.configureAccessControl(control.id, patch)
  showToast(result.message, !result.ok)
  updateEntityPanel()
}

accessControlOptions.querySelectorAll<HTMLButtonElement>('[data-access-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.accessMode
    if (
      mode === 'schedule' ||
      mode === 'sensor' ||
      mode === 'always' ||
      mode === 'locked'
    ) {
      patchSelectedAccess({ mode })
    }
  })
})
accessOpenInEmergency.addEventListener('change', () => {
  patchSelectedAccess({ openInEmergency: accessOpenInEmergency.checked })
})
accessPassage.querySelectorAll<HTMLButtonElement>('[data-access-passage]').forEach((button) => {
  button.addEventListener('click', () => {
    const passage = button.dataset.accessPassage
    if (passage === 'oneWay' || passage === 'both') patchSelectedAccess({ passage })
  })
})
accessControlOptions.querySelectorAll<HTMLButtonElement>('[data-access-polarity]').forEach((button) => {
  button.addEventListener('click', () => {
    const polarity = button.dataset.accessPolarity
    if (polarity === 'open' || polarity === 'closed') patchSelectedAccess({ polarity })
  })
})
accessSlots.addEventListener('pointerdown', (event) => {
  const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-access-slot]')
  const control = selectedAccessControl()
  if (!button || !control) return
  const index = Number(button.dataset.accessSlot)
  if (!Number.isInteger(index) || index < 0 || index >= control.openSlots.length) return
  const openSlots = control.openSlots.map((open, slot) => (slot === index ? !open : open))
  patchSelectedAccess({ openSlots })
})
accessControlOptions.querySelectorAll<HTMLButtonElement>('[data-access-phase]').forEach((button) => {
  button.addEventListener('click', () => {
    const control = selectedAccessControl()
    const phase = button.dataset.accessPhase as FestivalPhase | undefined
    if (!control || !phase || !FESTIVAL_PHASES.includes(phase)) return
    const schedulePhases = FESTIVAL_PHASES.filter((entry) =>
      entry === phase
        ? !control.schedulePhases.includes(entry)
        : control.schedulePhases.includes(entry),
    )
    patchSelectedAccess({ schedulePhases })
  })
})
accessControlOptions.querySelectorAll<HTMLButtonElement>('[data-access-schedule-time]').forEach((button) => {
  button.addEventListener('click', () => {
    const time = button.dataset.accessScheduleTime as AccessScheduleTime | undefined
    if (time === 'hourlySlots' || time === 'hours' || time === 'dayPlan') {
      patchSelectedAccess({ scheduleTime: time })
    }
  })
})
accessHourGrid.addEventListener('pointerdown', (event) => {
  const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-access-hour]')
  const control = selectedAccessControl()
  if (!button || !control) return
  const hour = Number(button.dataset.accessHour)
  if (!Number.isInteger(hour) || hour < 0 || hour >= control.scheduleHours.length) return
  const scheduleHours = control.scheduleHours.map((open, index) =>
    index === hour ? !open : open,
  )
  patchSelectedAccess({ scheduleHours })
})
accessScheduleOffer.addEventListener('change', () => {
  const control = selectedAccessControl()
  if (!control) return
  const offer = accessScheduleOffer.value as DayPlanOffer
  if (!DAY_PLAN_OFFERS.includes(offer)) return
  patchSelectedAccess({ scheduleOffer: offer })
})
accessSensorKind.addEventListener('change', () => {
  const control = selectedAccessControl()
  if (!control) return
  patchSelectedAccess({
    sensorKind: accessSensorKind.value as typeof control.sensorKind,
  })
})
accessThreshold.addEventListener('change', () => {
  patchSelectedAccess({ sensorThreshold: Number(accessThreshold.value) })
})
accessDrawArea.addEventListener('click', () => {
  if (accessAreaDrawing) {
    cancelAccessAreaDraw()
    updateEntityPanel()
    return
  }
  startAccessAreaDraw()
})
accessClearArea.addEventListener('click', () => {
  const control = selectedAccessControl()
  if (!control) return
  cancelAccessAreaDraw()
  const result = game.clearAccessControlArea(control.id)
  showToast(result.message, !result.ok)
  updateEntityPanel()
})
makeDraggable(entityPanel.querySelector<HTMLElement>('.panel-header')!, entityPanel)
makeResizable(entityPanel)

document.querySelectorAll<HTMLButtonElement>('[data-entity-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    if (selectedEntity?.type !== 'coaster') return
    entityTab = button.dataset.entityTab as 'overview' | 'dynamics'
    updateEntityPanel()
  })
})

dispatchModeSelect.addEventListener('change', () => {
  if (selectedEntity?.type !== 'coaster') return
  game.updateCoasterSettings(
    selectedEntity.id,
    dispatchModeSelect.value as DispatchMode,
    Number(dispatchIntervalInput.value),
  )
})

operationModeSelect.addEventListener('change', () => {
  if (selectedEntity?.type !== 'coaster') return
  const result = game.setCoasterOperationMode(
    selectedEntity.id,
    operationModeSelect.value as CoasterOperationMode,
  )
  if (!result.ok) {
    operationModeSelect.value =
      game.getCoaster(selectedEntity.id)?.operationMode ?? 'closed'
  }
  showToast(result.message, !result.ok)
})

document.querySelector<HTMLButtonElement>('#recall-train')?.addEventListener('click', () => {
  if (selectedEntity?.type !== 'coaster') return
  const result = game.recallCoasterTrain(selectedEntity.id)
  showToast(result.message, !result.ok)
})

document.querySelector<HTMLButtonElement>('#edit-coaster-track')?.addEventListener('click', () => {
  if (selectedEntity?.type !== 'coaster') return
  const coasterId = selectedEntity.id
  closeEntityPanel()
  openCoasterBuilder(coasterId)
})

function demolishCoasterById(coasterId: string): void {
  const result = game.removeCoaster(coasterId)
  showToast(result.message, !result.ok)
  if (!result.ok) return
  if (activeCoasterId === coasterId) closeCoasterBuilder()
  if (selectedEntity?.type === 'coaster' && selectedEntity.id === coasterId) {
    closeEntityPanel()
  }
}

document.querySelector<HTMLButtonElement>('#demolish-coaster')?.addEventListener('click', () => {
  if (selectedEntity?.type !== 'coaster') return
  demolishCoasterById(selectedEntity.id)
})

demolishCoasterConstructionButton.addEventListener('click', () => {
  if (!activeCoasterId) return
  demolishCoasterById(activeCoasterId)
})

dispatchIntervalInput.addEventListener('input', () => {
  dispatchValue.textContent = `${dispatchIntervalInput.value} min`
  if (selectedEntity?.type !== 'coaster') return
  game.updateCoasterSettings(
    selectedEntity.id,
    dispatchModeSelect.value as DispatchMode,
    Number(dispatchIntervalInput.value),
  )
})

window.addEventListener('keydown', (event) => {
  if (isTextEntryTarget(event.target) || isTextEntryTarget(document.activeElement)) return
  // Nothing reaches the world while the start screen is up — not the build shortcuts,
  // not the camera keys, not the speed keys.
  if (titleScreenController.isOpen()) return
  if (event.key === 'Shift') {
    shiftElevationHeld = true
    beginShiftElevationLock(hoveredCell)
    previewShiftElevation(hoveredCell)
    return
  }
  if (event.key === 'Escape' && view.isWalkMode()) {
    event.preventDefault()
    setFestivalWalk(false)
    return
  }
  if (view.isWalkMode() && event.code !== 'Space') return
  if ((event.key >= '1' && event.key <= '9') || event.key === '0') {
    const allTools: Tool[] = [
      'path',
      'food',
      'toilet',
      'ride',
      'alcohol',
      'securityGate',
      'camping',
      'bulldoze',
      'inspect',
    ]
    const tool = event.key === '0' ? 'coaster' : allTools[Number(event.key) - 1]
    if (tool === 'coaster') openCoasterBuilder()
    else if (tool) game.setTool(tool)
  } else if (event.key.toLowerCase() === 'q') {
    view.rotate(-1)
    cameraQuarter = (cameraQuarter + 3) % 4
    updatePathEditor()
    updateCoasterBuilder()
  } else if (event.key.toLowerCase() === 'e') {
    view.rotate(1)
    cameraQuarter = (cameraQuarter + 1) % 4
    updatePathEditor()
    updateCoasterBuilder()
  } else if (event.key.toLowerCase() === 'r') {
    if (pathEditorActive) rotatePathDirection(1)
    else {
      game.rotateBuild()
      updateCopyPreview(hoveredCell)
    }
  } else if (event.key === 'ArrowLeft' && pathEditorActive) {
    rotatePathDirection(-1)
  } else if (event.key === 'ArrowRight' && pathEditorActive) {
    rotatePathDirection(1)
  } else if (event.key === 'Enter' && pathEditorActive) {
    buildNextPathSegment()
  } else if (event.key === 'Backspace' && pathEditorActive) {
    event.preventDefault()
    undoLastPathSegment()
  } else if (event.key === 'PageUp') {
    game.adjustBuildElevation(1)
  } else if (event.key === 'PageDown') {
    game.adjustBuildElevation(-1)
  } else if (event.code === 'Space') {
    event.preventDefault()
    game.setSpeed(game.snapshot.speed === 0 ? 1 : 0)
  }
})

window.addEventListener('keyup', (event) => {
  if (event.key !== 'Shift') return
  clearShiftElevationLock()
  updatePathEditor()
})

window.addEventListener('blur', () => {
  if (!shiftElevationHeld && !shiftElevationOrigin) return
  clearShiftElevationLock()
  updatePathEditor()
})

window.addEventListener('pointermove', (event) => {
  if (!shiftElevationApplies() || !shiftElevationHeld || (event.buttons & 1) === 0) return
  if (!hoveredCell || !shiftElevationOrigin) return
  applyShiftElevationPaint(hoveredCell, true)
})

bindGameState(game)
mountUpdateNotice()

mountMobileUI({
  panMode: enabled => { view.touchPanMode = enabled },
  rotateCamera: direction => {
    view.rotate(direction)
    cameraQuarter = (cameraQuarter + direction + 4) % 4
    updatePathEditor()
    updateCoasterBuilder()
  },
  rotateBuilding: () => {
    if (pathEditorActive) rotatePathDirection(1)
    else {
      game.rotateBuild()
      updateCopyPreview(hoveredCell)
    }
  },
  zoom: factor => view.zoomBy(factor),
  elevation: delta => { if (pathEditorActive) setPathSlope(pathSlope + delta); else game.adjustBuildElevation(delta) },
})

const performanceIndicator = document.createElement('div')
const versionLabel = `v${__APP_VERSION__} · Build ${__BUILD_ID__} UTC`
performanceIndicator.className = 'performance-indicator'
performanceIndicator.textContent = `${versionLabel}\nFPS — · TPS —`
performanceIndicator.title = 'Bilder und lokal ausgeführte Logik-Ticks pro realer Sekunde. In Pause und auf Multiplayer-Clients laufen keine lokalen Logik-Ticks.'
document.body.append(performanceIndicator)
// Bottom-left is a stack: the overview overlay sits on the floor, the debug line rides above it,
// and anything anchored to the bottom edge (the build menu) clears both.
const syncDebugViewGap = (): void => {
  const overview = statusOverlay.getBoundingClientRect().height
  document.documentElement.style.setProperty('--status-overlay-gap', `${Math.round(overview + 18)}px`)
  const height = performanceIndicator.getBoundingClientRect().height
  document.documentElement.style.setProperty(
    '--debug-view-gap',
    `${Math.max(48, Math.round(overview + height + 30))}px`,
  )
}
syncDebugViewGap()
new ResizeObserver(syncDebugViewGap).observe(performanceIndicator)
new ResizeObserver(syncDebugViewGap).observe(statusOverlay)

// Developer readouts: FPS/build line bottom-left and the bug button in the toolbar.
// On by default; only hides after the player turns Debug off in Einstellungen.
// Kept in the browser rather than the save — it is about this machine, not the park.
const DEBUG_TOOLS_KEY = 'festival-debug-tools'
const debugToolsToggle = requireElement<HTMLInputElement>('#setting-debug-tools')
const applyDebugTools = (shown: boolean): void => {
  performanceIndicator.hidden = !shown
  debugMenuToggle.hidden = !shown
  if (!shown) closeDebugMenu()
  syncDebugViewGap()
}
try {
  debugToolsToggle.checked = window.localStorage.getItem(DEBUG_TOOLS_KEY) !== 'off'
} catch { /* private mode or blocked storage: fall back to showing them */ }
applyDebugTools(debugToolsToggle.checked)
debugToolsToggle.addEventListener('change', () => {
  applyDebugTools(debugToolsToggle.checked)
  try {
    window.localStorage.setItem(DEBUG_TOOLS_KEY, debugToolsToggle.checked ? 'on' : 'off')
  } catch { /* the setting simply does not survive a reload then */ }
})
startGameLoop({
  getGame: () => game,
  multiplayer,
  view,
  audio: festivalAudio,
  performanceIndicator,
  versionLabel,
  isTitleOpen: () => document.body.classList.contains('title-open'),
})

// The game opens on its title screen. Last thing in the module, so everything it can
// reach — the scenario form, the save management — has been built by the time it shows.
titleScreenController.setOpen(true)

// Who the session cookie belongs to. Asked once, after everything is wired, and the
// account bar redraws itself when the answer arrives.
void refreshAccount().then(() => titleScreenController.syncAccountBar())
