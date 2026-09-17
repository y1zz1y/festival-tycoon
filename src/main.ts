import { contextDemolitionTarget } from './game/contextDemolition'
import { isDecorationCatalogKind } from './game/decoration'
import { isWasteBin } from './game/decorationWalls'
import { isSealedWasteContainer } from './game/waste'
import { GENRES } from './game/musicTaste'
import { isScenery, isLargeScenery, scenerySlot, isEdgeScenery } from './game/scenery'
import { makeDraggable, makeResizable } from './dragPanel'
import { mountStageEditor } from './stageEditor'
import { stageStats } from './game/stageDesign'
import { mountStaffDetails } from './staffDetailsUI'
import { encodeSaveText, decodeSaveText } from './game/saveText'
import { deleteServerSave, listServerSaves, loadServerSave, saveServerSave, shareServerSave, type ServerSaveSlot } from './game/serverSaves'
import { ENVIRONMENTS } from './game/environments'
import { groundInfo } from './game/ground'
import type { Environment } from './game/environments'
import { mountLogisticsUI } from './logisticsUI'
import './style.css'
import { mountFestivalUI } from './festivalUI'
import { mountTickerUI } from './tickerUI'
import { AUDIENCE_NAMES, SUPPLIES } from './game/festivalManagement'
import type { Supply } from './game/festivalManagement'
import {
  SHIRT_COLORS,
  SHIRT_STYLE_LABELS,
  SHIRT_STYLES,
  isPricedShopKind,
  shopSupplyKind,
} from './game/shopGoods'
import { snapStockMinimum } from './game/supplyChain'
import { BUILDING_KINDS, BUILDINGS, isTerrainEditTool } from './game/catalog'
import { isSwimmableHeight, isWaterHeight, terrainCornerIndex, terrainToolMode } from './game/terrain'
import { FINANCE_CATEGORIES, FINANCE_CATEGORY_NAMES, financeEntriesTotal, financePeriodTotal } from './game/finance'
import { goalName, goalProgressText } from './game/scenarioGoals'
import { SCENARIO_PRESETS, scenarioPreset } from './game/scenarioPresets'
import { currentAccount, refreshAccount, registerAccount, signIn, signOut } from './accounts'
import { mountTitleCrowd } from './titleCrowd'
import type { BuildingKind, Tool } from './game/catalog'
import {
  BUILD_CATEGORIES,
  buildCategoryById,
  categoryForTool,
  isCatalogBuildCategory,
  subgroupForTool,
  type BuildCategoryId,
  type BuildMenuItem,
} from './game/buildMenu'
import {
  DEFAULT_DECORATION_THEME,
  DECORATION_CATEGORY_IDS,
  DECORATION_CATEGORY_LABELS,
  DECORATION_THEMES,
  decorationThemeOf,
  filterDecorationKinds,
  isDecorationThemeId,
  type DecorationThemeId,
} from './game/decoration'
import {
  TRACK_BANK_ANGLE,
  TRACK_PIECE_KINDS,
  TRACK_PIECES,
  TRACK_PITCHES,
  createTrackPiece,
  getCoasterType,
  type CoasterTypeId,
} from './game/coasters'
import {
  applyConstructionBank,
  applyConstructionKind,
  applyConstructionPitch,
  constantPitchPieceKind,
  isTrackBankChoiceCurrentlyEnabled,
  isTrackChainLiftEligible,
  isTrackChainLiftVisible,
  isTrackPalettePieceEnabled,
  isTrackPitchChoiceCurrentlyEnabled,
  listTrackBankChoices,
  listTrackPalettePieces,
  listTrackPitchChoices,
  resolveNextTrackPiece,
  TRACK_DIRECTION_KINDS,
  TRACK_SPECIAL_KINDS,
  type CoasterWindowState,
} from './game/coasterConnections'
import type {
  Coaster,
  CoasterOperationMode,
  DispatchMode,
  TrackPieceKind,
} from './game/coasters'
import { GameState } from './game/GameState'
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
  describeRoadVehicleDestination,
  formatRoadVehicleInspectLoad,
  ROAD_VEHICLE_KIND_LABELS,
} from './game/logistics'
import {
  connectedWasteDumpStats,
  formatSealedContainerInspect,
  formatWasteDumpAreaHover,
  formatWasteDumpAreaInspect,
  parseWasteDumpId,
  wasteDumpId,
} from './game/waste'
import {
  formatBackstageHover,
  formatBackstageInspect,
} from './game/bandSupply'
import { groupVisitorsByThought } from './game/visitorThoughts'
import { enableMultiplayerCommands } from './net/bind'
import { MultiplayerSession } from './net/session'
import type { MultiplayerStatus } from './net/session'
import { SIMULATION_CONFIG } from './game/simulationConfig'
import {
  SCENARIO_WORLD_SIZES,
  normalizeScenarioSettings,
} from './game/scenario'
import type { ScenarioSettings } from './game/scenario'
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
import type { CellPosition, PathAnchor } from './view/WorldView'
import { isTextEntryTarget } from './uiFocus'
import { mountMobileUI } from './mobileUI'
import { mountUpdateNotice } from './updateNotice'

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
const AUTOSAVE_INTERVALS = [
  { minutes: 5, label: 'Alle 5 Minuten' },
  { minutes: 10, label: 'Alle 10 Minuten' },
  { minutes: 15, label: 'Alle 15 Minuten' },
  { minutes: 30, label: 'Alle 30 Minuten' },
  { minutes: 60, label: 'Jede Stunde' },
  { minutes: 120, label: 'Alle 2 Stunden' },
  { minutes: 0, label: 'Aus' },
] as const
const AUTOSAVE_DEFAULT_MINUTES = 15
const AUTOSAVE_KEY = 'festival-autosave-minutes'
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
        <h2 class="panel-header-title">Lokale Spielstände</h2>
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
        <div class="piece-palette">${buildCategoryById('roads').groups.flatMap(group => group.items).map(item => `<button type="button" data-road-editor-tool="${item.tool}" title="${item.detail}">${item.icon}<small>${item.name}</small></button>`).join('')}</div>
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
        <div class="line-editor">
          <label>Name <input id="bus-line-name" value="Festival-Shuttle" /></label>
          <label>Depot <select id="bus-line-depot"></select></label>
          <label>Busse <input id="bus-line-count" type="number" min="1" max="3" value="1" /></label>
          <label>Takt <input id="bus-line-headway" type="number" min="2" max="120" value="15" /> Min.</label>
          <label>Haltestellen <select id="bus-line-stops" multiple size="5"></select></label>
          <button id="create-bus-line" class="primary">Linie anlegen</button>
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
            <button type="button" data-title-scenario=""><span class="title-row-text"><span class="title-row-label">Freies Spiel</span><span class="title-row-meta">Gelände, Publikum und Startkapital selbst festlegen — ohne Vorgaben und ohne Ziele.</span></span><span class="title-row-value">frei</span></button>
            ${SCENARIO_PRESETS.map((entry) => `<button type="button" data-title-scenario="${entry.id}"${entry.price ? ` data-title-locked="${entry.price}" aria-disabled="true"` : ''}><span class="title-row-text"><span class="title-row-label">${entry.name}</span><span class="title-row-meta">${entry.detail}</span></span><span class="title-row-value">${entry.price ? `<span class="title-row-lock" aria-hidden="true">🔒</span>${entry.price}` : `${entry.settings.worldSize} × ${entry.settings.worldSize}`}</span></button>`).join('')}
          </div>
        <div id="title-freeplay" class="title-freeplay" hidden>
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
      <button id="start-scenario" type="button">▶ Freies Spiel starten</button>
        </div>
          <button type="button" data-title-back>Zurück</button>
        </div>
      </div>
    </div>
    <div id="toast" role="status" aria-live="polite"></div>
  </main>
`

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
const TRACK_PIECE_ICONS: Record<TrackPieceKind, string> = {
  station: '▰',
  straight: '↑',
  slopeGentleUp: '⤴',
  slopeUp: '↗',
  slopeGentleDown: '⤵',
  slopeDown: '↘',
  pitchTransition: '⌁',
  bankTransition: '⤨',
  curveLeft1: '↰¹',
  curveRight1: '↱¹',
  curveLeft2: '↰²',
  curveRight2: '↱²',
  curveLeft3: '↰³',
  curveRight3: '↱³',
  curveLeft4: '↰⁴',
  curveRight4: '↱⁴',
  sBendLeft: '⤴',
  sBendRight: '⤵',
  verticalLoop: '◯',
  halfLoopUp: '∩',
  halfLoopDown: '∪',
  photo: '📷',
  splash: '💦',
  brakes: '▥',
  helixLeft: '↺',
  helixRight: '↻',
}
TRACK_PIECE_KINDS.forEach((kind) => {
  const piece = TRACK_PIECES[kind]
  trackPieceSelect.insertAdjacentHTML(
    'beforeend',
    `<option value="${kind}">${piece.name} · ${formatMoney(piece.cost)}</option>`,
  )
})
const coasterTypeName = requireElement<HTMLElement>('#coaster-type-name')
const coasterTypeHint = requireElement<HTMLElement>('#coaster-type-hint')

const TRACK_PITCH_BUTTONS: readonly { pitch: number; icon: string; title: string; label: string }[] = [
  { pitch: TRACK_PITCHES.steepDown, icon: '⇘', title: 'Steil abwärts', label: 'Steil ab' },
  { pitch: TRACK_PITCHES.gentleDown, icon: '↘', title: 'Sanft abwärts', label: 'Sanft ab' },
  { pitch: 0, icon: '→', title: 'Flach', label: 'Flach' },
  { pitch: TRACK_PITCHES.gentleUp, icon: '↗', title: 'Sanft aufwärts', label: 'Sanft auf' },
  { pitch: TRACK_PITCHES.steepUp, icon: '⇗', title: 'Steil aufwärts', label: 'Steil auf' },
]
const TRACK_BANK_BUTTONS: readonly { bank: number; icon: string; title: string; label: string }[] = [
  { bank: -TRACK_BANK_ANGLE, icon: '◢', title: 'Neigung links einleiten', label: 'Links' },
  { bank: 0, icon: '━', title: 'Seitliche Neigung ausleiten', label: 'Neutral' },
  { bank: TRACK_BANK_ANGLE, icon: '◣', title: 'Neigung rechts einleiten', label: 'Rechts' },
]

function trackPieceButtonHtml(kind: TrackPieceKind, active: boolean, enabled = true): string {
  const piece = TRACK_PIECES[kind]
  const disabledAttrs = enabled ? '' : ' disabled aria-disabled="true"'
  return `<button type="button" data-track-piece="${kind}" class="${active && enabled ? 'active' : ''}"${disabledAttrs} title="${piece.name} · ${formatMoney(piece.cost)}">
      <span>${TRACK_PIECE_ICONS[kind]}</span><small>${piece.station ? 'Station' : piece.radius ? `${piece.radius}×${piece.radius}` : piece.name}</small>
    </button>`
}

function renderTrackPalette(
  palette: HTMLElement,
  entries: readonly { kind: TrackPieceKind; enabled: boolean }[],
  activeKind: TrackPieceKind,
): void {
  palette.replaceChildren()
  if (entries.length === 0) return
  palette.insertAdjacentHTML(
    'beforeend',
    entries.map((entry) => trackPieceButtonHtml(entry.kind, entry.kind === activeKind, entry.enabled)).join(''),
  )
}

const canvas = requireElement<HTMLCanvasElement>('#game-canvas')
const money = requireElement<HTMLElement>('#money')
const guests = requireElement<HTMLElement>('#guests')
const reputation = requireElement<HTMLElement>('#reputation')
const power = requireElement<HTMLElement>('#power')
const waste = requireElement<HTMLElement>('#waste')
const date = requireElement<HTMLElement>('#date')
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
const visitorPanel = requireElement<HTMLElement>('#visitor-panel')
const visitorName = requireElement<HTMLElement>('#visitor-name')
const visitorThought = requireElement<HTMLElement>('#visitor-thought')
const visitorState = requireElement<HTMLElement>('#visitor-state')
const visitorBudget = requireElement<HTMLElement>('#visitor-budget')
const visitorAlcoholDisposition = requireElement<HTMLElement>('#visitor-alcohol-disposition')
const visitorCamping = requireElement<HTMLElement>('#visitor-camping')
const visitorTicket = requireElement<HTMLElement>('#visitor-ticket')
const visitorSleepRhythm =
  requireElement<HTMLElement>('#visitor-sleep-rhythm')
const visitorInventory = requireElement<HTMLElement>('#visitor-inventory')
const visitorCrowding = requireElement<HTMLElement>('#visitor-crowding')
const visitorAttractiveness =
  requireElement<HTMLElement>('#visitor-attractiveness')
const visitorParty = requireElement<HTMLElement>('#visitor-party')
const visitorPreferences = requireElement<HTMLElement>('#visitor-preferences')
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
const entityIcon = requireElement<HTMLElement>('#entity-icon')
const entityType = requireElement<HTMLElement>('#entity-type')
const entityName = requireElement<HTMLElement>('#entity-name')
const entityStatus = requireElement<HTMLElement>('#entity-status')
const entityStats = requireElement<HTMLElement>('#entity-stats')
const entityTabs = requireElement<HTMLElement>('#entity-tabs')
const entityOverview = requireElement<HTMLElement>('#entity-overview')
const entityDynamics = requireElement<HTMLElement>('#entity-dynamics')
const dynamicsSafety = requireElement<HTMLElement>('#dynamics-safety')
const dynamicsStats = requireElement<HTMLElement>('#dynamics-stats')
const dynamicsInfo = requireElement<HTMLElement>('#dynamics-info')
const telemetryChart = requireElement<HTMLCanvasElement>('#telemetry-chart')
const priceOptions = requireElement<HTMLElement>('#price-options')
const entityPriceInput = requireElement<HTMLInputElement>('#entity-price')
const applyPriceToKindButton =
  requireElement<HTMLButtonElement>('#apply-price-to-kind')
const shirtOptions = requireElement<HTMLElement>('#shirt-options')
const shirtColorPalette = requireElement<HTMLElement>('#shirt-color-palette')
const shirtStyleSelect = requireElement<HTMLSelectElement>('#shirt-style')
const coasterOptions = requireElement<HTMLElement>('#coaster-options')
const dispatchModeSelect = requireElement<HTMLSelectElement>('#dispatch-mode')
const dispatchIntervalInput = requireElement<HTMLInputElement>('#dispatch-interval')
const dispatchValue = requireElement<HTMLElement>('#dispatch-value')
const operationModeSelect = requireElement<HTMLSelectElement>('#operation-mode')
const accessControlOptions = requireElement<HTMLElement>('#access-control-options')
const accessSignal = requireElement<HTMLElement>('#access-signal')
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
const securityOptions = requireElement<HTMLElement>('#security-options')
const securityThoroughness =
  requireElement<HTMLInputElement>('#security-thoroughness')
const securityThoroughnessValue =
  requireElement<HTMLElement>('#security-thoroughness-value')
const securityFlowShare = requireElement<HTMLInputElement>('#security-flow-share')
const securityFlowShareValue =
  requireElement<HTMLElement>('#security-flow-share-value')
const securityProhibitedItems =
  requireElement<HTMLElement>('#security-prohibited-items')
const securityStaffing = requireElement<HTMLElement>('#security-staffing')
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
const depotRoleHint = requireElement<HTMLElement>('#depot-role-hint')
const depotDistribution = requireElement<HTMLSelectElement>('#depot-distribution')
const depotWorkers = requireElement<HTMLInputElement>('#depot-workers')
const depotWorkersValue = requireElement<HTMLElement>('#depot-workers-value')
const depotRemove = requireElement<HTMLButtonElement>('#depot-remove')
const busLineDepot = requireElement<HTMLSelectElement>('#bus-line-depot')
const busLineStops = requireElement<HTMLSelectElement>('#bus-line-stops')
const busLinesList = requireElement<HTMLElement>('#bus-lines-list')
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
const followVisitorButton = requireElement<HTMLButtonElement>('#follow-visitor')
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
editStageButton.textContent='Bühne gestalten';editStageButton.hidden=true
entityOverview.append(editStageButton)
editStageButton.addEventListener('click',()=>{if(selectedEntity?.type==='building')stageEditor.open(selectedEntity.id)})
const multiplayer = new MultiplayerSession(game)
let hoveredCell: CellPosition | null = null
let rideAccessPlacement: {id:string;type:'entrance'|'exit'} | null = null
let activeRideId: string | null = null
let selectedVisitorId: string | null = null
let followedVisitorId: string | null = null
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
let securityItemsFingerprint = ''
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
let dragPathStart: CellPosition | null = null
let dragPathEnd: CellPosition | null = null
let dragPathElevation = 0
let terrainDragOriginHeight = 0
let sceneryDragSlot: number | null = null
let sceneryDragRotation = 0
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
let selectedEntity: { type: 'building' | 'coaster' | 'vehicle' | 'access' | 'depot' | 'wasteDump' | 'backstage'; id: string } | null = null
let logisticsOverlayVisible = false
let accessAreaDrawing = false
let entityTab: 'overview' | 'dynamics' = 'overview'
let unsubscribe: () => void = () => {}
let toastTimer = 0
let crowdingOverlayVisible = false
let attractivenessOverlayVisible = false
let partyOverlayVisible = false

let view: WorldView
try {
  view = new WorldView(
    canvas,
    (cell) => handleCellClick(cell),
    (cell) => {
      hoveredCell = cell
      updateRideAccessPreview(cell)
      if (shiftElevationApplies()) {
        beginShiftElevationLock(cell)
        previewShiftElevation(cell)
      }
      updateContextHelp()
    },
    (visitorId) => selectVisitor(visitorId),
    (cell) => paintPath(cell),
    (delta) => {
      if (pathEditorActive) {
        setPathSlope(pathSlope + delta)
      } else {
        game.adjustBuildElevation(delta)
      }
    },
    (cell) => startPathDrag(cell),
    () => finishPathDrag(),
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
view.setPlacementValidator((kind, x, z, slot) => game.canPlace(kind, x, z, slot).ok)
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
  setTitleScreenOpen(false)
  game = nextGame
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
    document.querySelectorAll<HTMLElement>('[data-tool]').forEach((button) => {
      const typeMatch = !button.dataset.coasterType || button.dataset.coasterType === selectedCoasterTypeId()
      button.classList.toggle(
        'active',
        button.dataset.tool === snapshot.selectedTool &&
          typeMatch &&
          (snapshot.selectedTool !== 'ride' || (button.dataset.bungee === 'true') === (view.bungeePreviewHeight !== null)),
      )
    })
    if (!buildCatalogStatus.hidden && !catalogHoverActive) showSelectedCatalogStatus()
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
      line.busIds.length,
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
            `<span>Garage ${garage.id.slice(-4)} · ${garage.bays.filter(Boolean).length}/2 RTW <button data-buy-ambulance="${garage.id}">RTW kaufen</button></span>`,
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
  busLineDepot.innerHTML = logistics.busDepots
    .map(
      (depot) =>
        `<option value="${depot.id}">Depot ${depot.id.slice(-4)} (${depot.busIds.length}/3)</option>`,
    )
    .join('')
  busLineStops.innerHTML = logistics.busStops
    .map((stop) => `<option value="${stop.id}">${stop.name}</option>`)
    .join('')
  busLinesList.innerHTML = logistics.busLines
    .map(
      (line) =>
        `<div class="bus-line-row"><span>${line.name}</span><span>${line.stopIds.length} Stopps · ${line.busIds.length} Busse · ${line.headway} Min.</span><button data-delete-line="${line.id}">Löschen</button></div>`,
    )
    .join('')
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

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!,
  )
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
  if (coasterBuilderActive) {
    if (coasterAccessMode && activeCoasterId) {
      const result = game.setCoasterAccess(
        activeCoasterId,
        coasterAccessMode,
        cell.x,
        cell.z,
      )
      if (result.ok) coasterAccessMode = null
      showToast(result.message, !result.ok)
      updateCoasterBuilder()
      return
    }
    const clickedCoaster = game.getCoasterAt(cell.x, cell.z)
    if (
      clickedCoaster &&
      !clickedCoaster.closed
    ) {
      activeCoasterId = clickedCoaster.id
      coasterStartCandidate = null
      coasterEditIndex = clickedCoaster.pieces.length - 1
      showToast(`${clickedCoaster.name} wird weitergebaut`)
      updateCoasterBuilder()
      return
    }
    if (
      clickedCoaster &&
      clickedCoaster.closed
    ) {
      openEntityInfoForCoaster(clickedCoaster.id)
      return
    }
    if (!activeCoasterId) {
      coasterStartCandidate = { ...cell }
      showToast('Startpunkt gesetzt – ausrichten und im Menü bauen')
      updateCoasterBuilder()
      return
    }
    showToast('Wähle im Achterbahn-Editor das nächste Element')
    return
  }

  if (pathWindowOpen && pathDemolishActive) {
    demolishPathAt(cell)
    return
  }

  if (shiftElevationApplies() && shiftElevationHeld && shiftElevationOrigin) {
    applyShiftElevationPaint(cell)
    return
  }

  if (pathEditorActive) {
    if (roadEditorOpen) {
      const existing = game.getRoadCellAt(cell.x, cell.z)
      const result = existing ? { ok: true, message: 'Startpunkt gewählt' } : buildRoadCell(cell)
      if (result.ok) {
        pathAnchor = {
          x: cell.x,
          z: cell.z,
          elevation: existing?.elevation ?? game.getTerrainHeight(cell.x, cell.z),
        }
        pathHistory = []
        if (shiftElevationHeld) {
          shiftElevationOrigin = lockShiftElevationOrigin(shiftElevationOrigin, pathAnchor)
        }
        updatePathEditor()
      }
      showToast(result.message, !result.ok)
      return
    }
    const path =
      game.getPathAt(cell.x, cell.z, game.snapshot.buildElevation) ??
      game.getPathAt(cell.x, cell.z)
    if (path) {
      pathAnchor = { x: path.x, z: path.z, elevation: path.elevation }
      pathHistory = []
      if (shiftElevationHeld) {
        shiftElevationOrigin = lockShiftElevationOrigin(shiftElevationOrigin, pathAnchor)
      }
      updatePathEditor()
      showToast('Startpunkt gewählt')
      return
    }
    const elevation = game.snapshot.buildElevation
    let result = game.placePathSegment(
      cell.x,
      cell.z,
      elevation,
      pathConstructionType,
      pathDirection,
      pathSlope,
      supplyPlanner.getFootType(),
    )
    if (!result.ok && pathSlope !== 0) {
      result = game.placePathSegment(
        cell.x,
        cell.z,
        elevation,
        pathConstructionType,
        pathDirection,
        0,
        supplyPlanner.getFootType(),
      )
    }
    if (!result.ok) {
      showToast(result.message, true)
      return
    }
    pathAnchor = { x: cell.x, z: cell.z, elevation }
    pathHistory = []
    if (shiftElevationHeld) {
      shiftElevationOrigin = lockShiftElevationOrigin(shiftElevationOrigin, pathAnchor)
    }
    updatePathEditor()
    showToast(result.message)
    return
  }

  const tool = game.snapshot.selectedTool
  if (tool === 'inspect') {
    const vehicle = game.getVehicleAt(cell.x, cell.z)
    if (vehicle) {
      if (vehicle.kind === 'sweeper') {
        openSweeperStaff(vehicle.id)
        return
      }
      openEntityInfoForVehicle(vehicle.id)
      return
    }
    const coaster = game.getCoasterAt(cell.x, cell.z)
    if (coaster) {
      if (!coaster.closed) {
        openCoasterBuilder(coaster.id)
        showToast(`${coaster.name} wird am letzten Element fortgesetzt`)
      } else {
        openEntityInfoForCoaster(coaster.id)
      }
      return
    }
    const access = game.getAccessControlAt(cell.x, cell.z)
    if (access) {
      openEntityInfoForAccess(access.id)
      return
    }
    const building = cell.buildingId ? game.snapshot.buildings.find(b => b.id === cell.buildingId) : game.getAt(cell.x, cell.z, undefined, cell.localX, cell.localZ)
    const depot = game.getDepotAt(cell.x, cell.z)
    if (building?.kind === 'ride') openRideBuilder(building.id)
    else if (building) openEntityInfoForBuilding(building.id)
    else if (depot) openEntityInfoForDepot(depot.id)
    else if (game.getCampingCellAt(cell.x, cell.z)) showToast('Ausgewiesener Zeltbereich')
    else if (game.getWasteDumpAt(cell.x, cell.z)) openEntityInfoForWasteDump(cell.x, cell.z)
    else if (game.getBackstageCellAt(cell.x, cell.z)) openEntityInfoForBackstage(cell.x, cell.z)
    else {
      const height = game.getTerrainHeight(cell.x, cell.z)
      const label =
        isWaterHeight(height, game.getWaterLevel())
          ? isSwimmableHeight(height, game.getWaterLevel())
            ? 'Wasser zum Baden'
            : 'Wasser'
          : height > 0
            ? `Hügel Ebene ${height}`
            : 'Unbebautes Grundstück'
      showToast(label)
    }
    return
  }

  if (
    isTerrainEditTool(tool)
  ) {
    const mode = terrainToolMode(tool)
    if (!mode) return
    const result = game.editTerrain(
      cell.x,
      cell.z,
      mode,
      terrainCornerIndex(cell.localX, cell.localZ),
    )
    showToast(result.message, !result.ok)
    return
  }

  if (tool === 'road') {
    const result = buildRoadCell(cell)
    showToast(result.message, !result.ok)
    return
  }
  if (tool === 'parkingArea') {
    const result = game.designateParkingArea([cell])
    showToast(result.message, !result.ok)
    return
  }
  if (tool === 'roadDirection') {
    const result = game.setRoadDirection(
      cell.x,
      cell.z,
      game.snapshot.buildRotation as 0 | 1 | 2 | 3,
    )
    showToast(result.message, !result.ok)
    return
  }
  if (tool === 'trafficLight') {
    const result = game.placeTrafficLight(
      cell.x,
      cell.z,
      game.snapshot.buildRotation as 0 | 1 | 2 | 3,
    )
    showToast(result.message, !result.ok)
    if (result.ok && result.placedId) {
      game.setTool('inspect')
      openEntityInfoForAccess(result.placedId)
    }
    return
  }
  if (tool === 'pathBarrier') {
    const result = game.placePathBarrier(
      cell.x,
      cell.z,
      game.snapshot.buildElevation,
      game.snapshot.buildRotation as 0 | 1 | 2 | 3,
    )
    showToast(result.message, !result.ok)
    if (result.ok && result.placedId) {
      openEntityInfoForAccess(result.placedId)
      if (!pathWindowOpen) game.setTool('inspect')
    }
    return
  }
  if (tool === 'roadSeparator') {
    const result = game.toggleRoadSeparator(
      cell.x,
      cell.z,
      game.snapshot.buildRotation as 0 | 1 | 2 | 3,
    )
    showToast(result.message, !result.ok)
    return
  }
  if (tool === 'deliveryYard' || tool === 'supplyDepot') {
    const result = game.manageFestival({
      type: 'depot',
      x: cell.x,
      z: cell.z,
      role: tool === 'deliveryYard' ? 'delivery' : 'storage',
    })
    showToast(result.message, !result.ok)
    if (result.ok) {
      const depot = game.getDepotAt(cell.x, cell.z)
      if (depot) {
        game.setTool('inspect')
        openEntityInfoForDepot(depot.id)
      }
    }
    return
  }
  if (tool === 'staffGate') {
    const path = game.snapshot.buildings.find(
      (building) => building.kind === 'path' && building.x === cell.x && building.z === cell.z,
    )
    const result = game.manageFestival({
      type: 'staffGate',
      ...cell,
      elevation: path?.elevation ?? 0,
      direction: game.snapshot.buildRotation as 0 | 1 | 2 | 3,
    })
    showToast(result.message, !result.ok)
    return
  }
  if (tool === 'crosswalk') {
    const result = game.toggleCrosswalk(cell.x, cell.z)
    showToast(result.message, !result.ok)
    return
  }
  if (
    tool === 'roadSpeed10' ||
    tool === 'roadSpeed30' ||
    tool === 'roadSpeed50'
  ) {
    const speed = Number(tool.replace('roadSpeed', '')) as 10 | 30 | 50
    const result = game.setRoadSpeed(cell.x, cell.z, speed)
    showToast(result.message, !result.ok)
    return
  }

  if (tool === 'path') {
    const result = game.placePathSegment(
      cell.x,
      cell.z,
      game.snapshot.buildElevation,
      pathConstructionType,
      pathConstructionType === 'queue' ? pathDirection : 0,
      0,
      supplyPlanner.getFootType(),
    )
    showToast(result.message, !result.ok)
    return
  }

  if (tool === 'bulldoze') {
    const result = game.bulldoze(
      cell.x,
      cell.z,
      cell.buildingId ?? game.getAt(cell.x, cell.z, undefined, cell.localX, cell.localZ)?.id,
    )
    showToast(result.message, !result.ok)
    return
  }

  const result =
    tool === 'camping'
        ? game.designateCampingCell(cell.x, cell.z)
        : tool === 'medicalArea'
          ? game.designateMedicalArea([cell])
          : tool === 'wasteDump'
            ? game.designateWasteDump([cell])
          : tool === 'stageForecourt'
            ? game.designateStageForecourt([cell])
          : tool === 'backstageArea'
            ? game.designateBackstageArea([cell], !backstageEraseMode)
        : tool === 'powerCable'
          ? game.designatePowerCable(
              cell.x,
              cell.z,
              !game.getPowerCableAt(cell.x, cell.z),
            )
      : tool === 'ride' && bungeeBuildMode ? game.placeBungee(cell.x, cell.z, Number(requireElement<HTMLInputElement>('#bungee-height').value))
      : game.place(tool as BuildingKind, cell.x, cell.z, scenerySlot(tool, cell.localX, cell.localZ, game.snapshot.buildRotation))
  showToast(result.message, !result.ok)
  if (result.ok && tool==='ride') {
    const building=game.snapshot.buildings.find(b=>b.kind==='ride' && b.x===cell.x && b.z===cell.z && b.elevation===game.snapshot.buildElevation+game.getTerrainHeight(cell.x,cell.z))
    if (building) { openRideBuilder(building.id); startRideAccessPlacement(building.id,'entrance') }
  }
}

function paintPath(cell: CellPosition): void {
  if ((pathEditorActive && !pathDemolishActive) || !dragPathStart) return
  dragPathEnd = { ...cell }
  view.setPathDragPreview(
    game.snapshot.selectedTool === 'camping' ||
    game.snapshot.selectedTool === 'medicalArea' ||
    game.snapshot.selectedTool === 'wasteDump' ||
    game.snapshot.selectedTool === 'stageForecourt' ||
    game.snapshot.selectedTool === 'backstageArea' ||
    game.snapshot.selectedTool === 'parkingArea' ||
    game.snapshot.selectedTool === 'powerCable' ||
    game.snapshot.selectedTool === 'bulldoze' ||
    isTerrainEditTool(game.snapshot.selectedTool)
      ? createCampingArea(dragPathStart, dragPathEnd)
      : createConnectedPathLine(dragPathStart, dragPathEnd),
    dragPathElevation,
  )
}

function startPathDrag(cell: CellPosition): void {
  if (pathEditorActive && !pathDemolishActive) {
    dragPathStart = null
    return
  }
  dragPathStart = { ...cell }
  dragPathEnd = { ...cell }
  terrainDragOriginHeight = game.getTerrainHeight(cell.x, cell.z)
  if (isScenery(game.snapshot.selectedTool)) {
    sceneryDragRotation = game.snapshot.buildRotation
    sceneryDragSlot = scenerySlot(
      game.snapshot.selectedTool,
      cell.localX,
      cell.localZ,
      sceneryDragRotation,
    ) ?? 0
  } else {
    sceneryDragSlot = null
  }
  dragPathElevation =
    game.snapshot.selectedTool === 'camping' ||
    game.snapshot.selectedTool === 'medicalArea' ||
    game.snapshot.selectedTool === 'wasteDump' ||
    game.snapshot.selectedTool === 'stageForecourt' ||
    game.snapshot.selectedTool === 'backstageArea' ||
    game.snapshot.selectedTool === 'parkingArea' ||
    game.snapshot.selectedTool === 'powerCable' ||
    game.snapshot.selectedTool === 'road' ||
    game.snapshot.selectedTool === 'roadDirection' ||
    game.snapshot.selectedTool === 'roadSeparator' ||
    game.snapshot.selectedTool === 'fence' ||
    game.snapshot.selectedTool === 'crosswalk' ||
    game.snapshot.selectedTool === 'roadSpeed10' ||
    game.snapshot.selectedTool === 'roadSpeed30' ||
    game.snapshot.selectedTool === 'roadSpeed50' ||
    isTerrainEditTool(game.snapshot.selectedTool) ||
    game.snapshot.selectedTool === 'bulldoze'
      ? 0
      : game.snapshot.buildElevation
  view.setPathDragPreview([cell], dragPathElevation)
}

function finishPathDrag(): void {
  if (!dragPathStart || !dragPathEnd || (pathEditorActive && !pathDemolishActive)) {
    dragPathStart = null
    dragPathEnd = null
    view.setPathDragPreview([], 0)
    return
  }

  const cells =
    game.snapshot.selectedTool === 'camping' ||
    game.snapshot.selectedTool === 'medicalArea' ||
    game.snapshot.selectedTool === 'wasteDump' ||
    game.snapshot.selectedTool === 'stageForecourt' ||
    game.snapshot.selectedTool === 'backstageArea' ||
    game.snapshot.selectedTool === 'parkingArea' ||
    game.snapshot.selectedTool === 'powerCable' ||
    game.snapshot.selectedTool === 'bulldoze' ||
    isTerrainEditTool(game.snapshot.selectedTool)
      ? createCampingArea(dragPathStart, dragPathEnd)
      : createConnectedPathLine(dragPathStart, dragPathEnd)
  let built = 0
  if (isScenery(game.snapshot.selectedTool)) {
    const tool = game.snapshot.selectedTool as BuildingKind
    const slot =
      sceneryDragSlot ??
      scenerySlot(tool, dragPathStart.localX, dragPathStart.localZ, sceneryDragRotation)!
    const result = game.placeSceneryLine(tool, cells, slot, sceneryDragRotation)
    showToast(result.message, !result.ok)
    dragPathStart = null; dragPathEnd = null; view.setPathDragPreview([], 0)
    return
  }
  if (game.snapshot.selectedTool === 'bulldoze') {
    const result = game.bulldozeArea(cells)
    showToast(result.message, !result.ok)
    dragPathStart = null
    dragPathEnd = null
    view.setPathDragPreview([], 0)
    return
  }
  if (game.snapshot.selectedTool === 'camping') {
    const result = game.designateCampingArea(cells)
    showToast(result.message, !result.ok)
    dragPathStart = null
    dragPathEnd = null
    view.setPathDragPreview([], 0)
    return
  }
  if (game.snapshot.selectedTool === 'medicalArea') {
    const result = game.designateMedicalArea(cells)
    showToast(result.message, !result.ok)
    dragPathStart = null
    dragPathEnd = null
    view.setPathDragPreview([], 0)
    return
  }
  if (game.snapshot.selectedTool === 'wasteDump') {
    const result = game.designateWasteDump(cells)
    showToast(result.message, !result.ok)
    dragPathStart = null
    dragPathEnd = null
    view.setPathDragPreview([], 0)
    return
  }
  if (game.snapshot.selectedTool === 'stageForecourt') {
    const result = game.designateStageForecourt(cells)
    showToast(result.message, !result.ok)
    dragPathStart = null
    dragPathEnd = null
    view.setPathDragPreview([], 0)
    return
  }
  if (game.snapshot.selectedTool === 'backstageArea') {
    const result = game.designateBackstageArea(cells, !backstageEraseMode)
    showToast(result.message, !result.ok)
    dragPathStart = null
    dragPathEnd = null
    view.setPathDragPreview([], 0)
    return
  }
  if (game.snapshot.selectedTool === 'parkingArea') {
    const result = game.designateParkingArea(cells)
    showToast(result.message, !result.ok)
    dragPathStart = null
    dragPathEnd = null
    view.setPathDragPreview([], 0)
    return
  }
  if (game.snapshot.selectedTool === 'powerCable') {
    const result = game.designatePowerCableArea(cells)
    showToast(result.message, !result.ok)
    dragPathStart = null
    dragPathEnd = null
    view.setPathDragPreview([], 0)
    return
  }
  if (game.snapshot.selectedTool === 'road') {
    if (pathDemolishActive) {
      for (const cell of cells) if (demolishPathAt(cell, true)) built++
    } else {
      for (const cell of cells) if (buildRoadCell(cell).ok) built++
    }
    showToast(`${built} Straßenfelder ${pathDemolishActive ? 'entfernt' : 'gebaut'}`, built === 0)
    dragPathStart = null
    dragPathEnd = null
    view.setPathDragPreview([], 0)
    return
  }
  if (
    game.snapshot.selectedTool === 'roadDirection' ||
    game.snapshot.selectedTool === 'trafficLight' ||
    game.snapshot.selectedTool === 'pathBarrier' ||
    game.snapshot.selectedTool === 'roadSeparator' ||
    game.snapshot.selectedTool === 'crosswalk' ||
    game.snapshot.selectedTool === 'roadSpeed10' ||
    game.snapshot.selectedTool === 'roadSpeed30' ||
    game.snapshot.selectedTool === 'roadSpeed50'
  ) {
    let changed = 0
    cells.forEach((cell) => {
      const tool = game.snapshot.selectedTool
      const direction = game.snapshot.buildRotation as 0 | 1 | 2 | 3
      const result =
        tool === 'roadDirection'
          ? game.setRoadDirection(cell.x, cell.z, direction)
          : tool === 'trafficLight'
            ? game.placeTrafficLight(cell.x, cell.z, direction)
            : tool === 'pathBarrier'
              ? game.placePathBarrier(cell.x, cell.z, game.snapshot.buildElevation, direction)
              : tool === 'roadSeparator'
                ? game.toggleRoadSeparator(cell.x, cell.z, direction)
                : tool === 'crosswalk'
                  ? game.toggleCrosswalk(cell.x, cell.z)
                  : game.setRoadSpeed(
                      cell.x,
                      cell.z,
                      Number(tool.replace('roadSpeed', '')) as 10 | 30 | 50,
                    )
      if (result.ok) changed += 1
    })
    showToast(
      game.snapshot.selectedTool === 'trafficLight'
        ? `${changed} Ampel${changed === 1 ? '' : 'n'} gesetzt`
        : game.snapshot.selectedTool === 'pathBarrier'
          ? `${changed} Schranke${changed === 1 ? '' : 'n'} gesetzt`
          : `${changed} Straßenfelder geändert`,
      changed === 0,
    )
    dragPathStart = null
    dragPathEnd = null
    view.setPathDragPreview([], 0)
    return
  }
  if (isTerrainEditTool(game.snapshot.selectedTool)) {
    const mode = terrainToolMode(game.snapshot.selectedTool)
    if (!mode) return
    const result = game.editTerrainArea(cells, mode, terrainDragOriginHeight)
    showToast(result.message, !result.ok)
    dragPathStart = null
    dragPathEnd = null
    view.setPathDragPreview([], 0)
    return
  }
  if (game.snapshot.selectedTool === 'fence') {
    let placed = 0
    cells.forEach((cell) => {
      const result = game.place('fence', cell.x, cell.z)
      if (result.ok) placed += 1
    })
    showToast(
      placed > 0
        ? `${placed} Bauzaun${placed === 1 ? '' : 'e'} gesetzt`
        : 'Hier konnte kein Bauzaun gesetzt werden',
      placed === 0,
    )
    dragPathStart = null
    dragPathEnd = null
    view.setPathDragPreview([], 0)
    return
  }
  if (pathDemolishActive) {
    let removed = 0
    for (const cell of cells) {
      if (demolishPathAt(cell, true)) removed += 1
    }
    showToast(
      removed > 0 ? `${removed} Wegfeld${removed === 1 ? '' : 'er'} abgerissen` : 'Hier liegt kein Weg',
      removed === 0,
    )
    dragPathStart = null
    dragPathEnd = null
    view.setPathDragPreview([], 0)
    return
  }
  for (const cell of cells) {
    if (game.getPathAt(cell.x, cell.z, dragPathElevation)) continue
    const result = game.placePathSegment(
      cell.x,
      cell.z,
      dragPathElevation,
      pathConstructionType,
      pathConstructionType === 'queue' ? pathDirection : 0,
      0,
      supplyPlanner.getFootType(),
    )
    if (!result.ok) {
      showToast(`${result.message} – Bau an dieser Stelle beendet`, true)
      break
    }
    built += 1
  }
  if (built > 0) showToast(`${built} zusammenhängende Wegfelder gebaut`)
  dragPathStart = null
  dragPathEnd = null
  view.setPathDragPreview([], 0)
}

function createCampingArea(start: CellPosition, end: CellPosition): CellPosition[] {
  const cells: CellPosition[] = []
  const minX = Math.min(start.x, end.x)
  const maxX = Math.max(start.x, end.x)
  const minZ = Math.min(start.z, end.z)
  const maxZ = Math.max(start.z, end.z)
  for (let x = minX; x <= maxX; x += 1) {
    for (let z = minZ; z <= maxZ; z += 1) cells.push({ x, z })
  }
  return cells
}

function createConnectedPathLine(start: CellPosition, end: CellPosition): CellPosition[] {
  const cells: CellPosition[] = [{ ...start }]
  let x = start.x
  let z = start.z
  const deltaX = Math.abs(end.x - x)
  const deltaZ = Math.abs(end.z - z)
  const stepX = x < end.x ? 1 : -1
  const stepZ = z < end.z ? 1 : -1
  let error = deltaX - deltaZ

  while (x !== end.x || z !== end.z) {
    const previousX = x
    const previousZ = z
    const doubleError = error * 2
    if (doubleError > -deltaZ) {
      error -= deltaZ
      x += stepX
    }
    if (doubleError < deltaX) {
      error += deltaX
      z += stepZ
    }
    if (x !== previousX && z !== previousZ) cells.push({ x, z: previousZ })
    cells.push({ x, z })
  }
  return cells
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

function buildRoadCell(cell: { x: number; z: number }) {
  return game.manageFestival({ type: 'wayArea', from: cell, to: cell, kind: supplyPlanner.getRoadType() })
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

function coasterTypeHintText(typeId: CoasterTypeId): string {
  const type = getCoasterType(typeId)
  if (type.liftStyle === 'none') return 'Kein Kettenlift — nur Launch.'
  if (type.liftStyle === 'cable') return 'Seillift. Kettenlift-Flag ist nicht verfügbar.'
  if (type.liftStyle === 'powered') return 'Powered Launch. Kettenlift ist kein Standard.'
  if (type.liftStyle === 'curved') return 'Nur sanfte Steigung, gebogener Lift.'
  if (type.trainStyle === 'mouse') return 'Einzelwagen, keine Seitenneigung, enge 1-Feld-Kurven.'
  if (type.id === 'wooden') return 'Holzachterbahn: Looping und Wassersplash, keine 1-Feld-Kurven.'
  if (type.trackStyle === 'bobsledTrough') return 'Nur sanfte Steigung. Rinnenbahn ohne große Kurven.'
  return type.name
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
  coasterBuilder.classList.toggle('visible', coasterBuilderActive)
  if (!coasterBuilderActive) return

  const coaster = activeCoasterId ? game.getCoaster(activeCoasterId) : null
  const typeId = selectedCoasterTypeId()
  const type = getCoasterType(typeId)
  pendingCoasterTypeId = typeId
  coasterTypeName.textContent = type.name
  coasterTypeHint.textContent = coasterTypeHintText(typeId)
  coasterConstructionTitle.textContent = `${coaster?.name ?? type.name} Konstruktion`
  if (coaster) {
    coasterEditIndex = Math.max(0, Math.min(coaster.pieces.length - 1, coasterEditIndex))
  }
  const anchorPiece = coaster?.pieces[coasterEditIndex]
  coasterDirection.textContent = getIsoDirectionIcon(
    anchorPiece?.end.heading ?? game.snapshot.buildRotation,
  )
  coasterBuildButton.disabled = !coaster && !coasterStartCandidate
  coasterBuildButton.title = coaster
    ? 'Ausgewähltes Schienenstück bauen'
    : 'Startplattform bauen'
  coasterBuildButton.setAttribute('aria-label', coasterBuildButton.title)
  coasterRotateButton.disabled = Boolean(coaster)
  coasterUndoButton.disabled = !coaster || coaster.pieces.length <= 1
  coasterEntranceButton.disabled = !coaster
  coasterExitButton.disabled = !coaster
  demolishCoasterConstructionButton.hidden = !coaster
  trackPieceSelect.disabled = !coaster
  const resolved = resolveNextTrackPiece(
    currentCoasterWindow(),
    anchorPiece?.end ?? null,
    Boolean(coaster),
  )
  trackPieceSelect.value = resolved.kind
  const selectedPiece = TRACK_PIECES[resolved.kind]
  const directionEntries = listTrackPalettePieces(
    TRACK_DIRECTION_KINDS,
    anchorPiece?.end ?? null,
    Boolean(coaster),
    typeId,
  )
  const specialEntries = listTrackPalettePieces(
    TRACK_SPECIAL_KINDS,
    anchorPiece?.end ?? null,
    Boolean(coaster),
    typeId,
  )
  renderTrackPalette(trackDirectionPalette, directionEntries, coasterSelectedKind)
  trackDirectionPalette.style.gridTemplateColumns = `repeat(${Math.max(1, directionEntries.length)}, minmax(0, 1fr))`
  renderTrackPalette(trackSpecialPalette, specialEntries, coasterSelectedKind)
  trackSpecialToggle.hidden = specialEntries.length === 0
  if (specialEntries.length === 0) {
    trackSpecialPalette.hidden = true
    trackSpecialToggle.setAttribute('aria-expanded', 'false')
  }
  const pitchEntries = listTrackPitchChoices(
    anchorPiece?.end.pitch ?? 0,
    typeId,
    anchorPiece?.end.bank ?? 0,
  ).map((entry) => ({ ...entry, enabled: Boolean(coaster) && entry.enabled }))
  trackSlopePalette.replaceChildren()
  if (pitchEntries.length > 0) {
    trackSlopePalette.insertAdjacentHTML(
      'beforeend',
      TRACK_PITCH_BUTTONS.filter((entry) =>
        pitchEntries.some((choice) => Math.abs(choice.pitch - entry.pitch) < 0.001),
      )
        .map((entry) => {
          const choice = pitchEntries.find((item) => Math.abs(item.pitch - entry.pitch) < 0.001)
          const enabled = choice?.enabled ?? false
          const active = enabled && Math.abs(entry.pitch - coasterTargetPitch) < 0.001
          const disabledAttrs = enabled ? '' : ' disabled aria-disabled="true"'
          return `<button type="button" data-track-pitch="${entry.pitch}" class="${active ? 'active' : ''}"${disabledAttrs} title="${entry.title}"><span>${entry.icon}</span><small>${entry.label}</small></button>`
        })
        .join(''),
    )
  }
  const chainVisible = isTrackChainLiftVisible(typeId)
  const chainEnabled = Boolean(
    coaster &&
      isTrackChainLiftEligible(
        selectedPiece.kind,
        anchorPiece?.end.pitch ?? 0,
        resolved.options.targetPitch ?? coasterTargetPitch,
        typeId,
      ),
  )
  if (!chainVisible || !chainEnabled) chainLiftInput.checked = false
  if (chainVisible) {
    const chainDisabledAttrs = chainEnabled ? '' : ' disabled aria-disabled="true"'
    trackSlopePalette.insertAdjacentHTML(
      'beforeend',
      `<button id="toggle-chain-lift" type="button" class="${chainEnabled && chainLiftInput.checked ? 'active' : ''}"${chainDisabledAttrs} title="Kettenlift für das nächste geeignete Stück" aria-pressed="${String(chainEnabled && chainLiftInput.checked)}"><span>⛓</span><small>Kette</small></button>`,
    )
  }
  const slopeCount = pitchEntries.length + (chainVisible ? 1 : 0)
  trackSlopePalette.style.gridTemplateColumns = `repeat(${Math.max(1, slopeCount)}, minmax(0, 1fr))`
  const bankEntries = listTrackBankChoices(
    anchorPiece?.end.bank ?? 0,
    typeId,
    anchorPiece?.end.pitch ?? 0,
  ).map((entry) => ({ ...entry, enabled: Boolean(coaster) && entry.enabled }))
  trackBankPalette.replaceChildren()
  if (bankEntries.length > 0) {
    trackBankPalette.insertAdjacentHTML(
      'beforeend',
      TRACK_BANK_BUTTONS.filter((entry) =>
        bankEntries.some((choice) => Math.abs(choice.bank - entry.bank) < 0.001),
      )
        .map((entry) => {
          const choice = bankEntries.find((item) => Math.abs(item.bank - entry.bank) < 0.001)
          const enabled = choice?.enabled ?? false
          const active = enabled && Math.abs(entry.bank - coasterTargetBank) < 0.001
          const disabledAttrs = enabled ? '' : ' disabled aria-disabled="true"'
          return `<button type="button" data-track-bank="${entry.bank}" class="${active ? 'active' : ''}"${disabledAttrs} title="${entry.title}"><span>${entry.icon}</span><small>${entry.label}</small></button>`
        })
        .join(''),
    )
  }
  trackBankPalette.style.gridTemplateColumns = `repeat(${Math.max(1, bankEntries.length)}, minmax(0, 1fr))`
  const displayedPiece = coaster ? selectedPiece : TRACK_PIECES.station
  coasterPiecePreview.textContent = `${TRACK_PIECE_ICONS[displayedPiece.kind]} ${getIsoDirectionIcon(
    anchorPiece?.end.heading ?? game.snapshot.buildRotation,
  )}`
  chainLiftInput.disabled = !chainVisible || !chainEnabled
  const displayedCost =
    displayedPiece.cost +
    (chainLiftInput.checked ? SIMULATION_CONFIG.economy.chainLiftCost : 0)
  coasterPieceLabel.textContent =
    `${displayedPiece.name} · Kosten: ${formatMoney(displayedCost)}`

  if (!coaster || !anchorPiece) {
    trackPreviousButton.disabled = true
    trackNextButton.disabled = true
    deleteTrackButton.disabled = true
    trackSelection.textContent = '–'
    view.setCoasterTrackSelection([])
    if (coasterStartCandidate) {
      const stationPreview = createTrackPiece(
        'station-preview',
        'station',
        {
          x: coasterStartCandidate.x,
          z: coasterStartCandidate.z,
          elevation: game.snapshot.buildElevation,
          heading: game.snapshot.buildRotation,
          pitch: 0,
          bank: 0,
        },
        false,
      )
      view.setCoasterConstructionPreview(stationPreview.points, {
        kind: 'station',
        chainLift: false,
        styleId: type.trackStyle,
        railColor: type.railColor,
        structureColor: type.color,
      })
      coasterStatus.textContent =
        `Startpunkt: ${coasterStartCandidate.x}, ${coasterStartCandidate.z} · ` +
        `Ebene ${game.snapshot.buildElevation} · Richtung ${getIsoDirectionIcon(game.snapshot.buildRotation)}. ` +
        'Zum Bestätigen „Startplattform bauen“ drücken.'
    } else {
      coasterStatus.textContent =
        'Klicke auf das Gelände, um den Startpunkt als Vorschau zu setzen.'
      view.setCoasterConstructionPreview([])
    }
    return
  }
  const selectedTrackPiece = coaster.pieces[coasterEditIndex]
  trackPreviousButton.disabled = coasterEditIndex <= 0
  trackNextButton.disabled = coasterEditIndex >= coaster.pieces.length - 1
  deleteTrackButton.disabled = coasterEditIndex <= 0
  trackSelection.textContent = selectedTrackPiece
    ? `${coasterEditIndex + 1}/${coaster.pieces.length} · ${TRACK_PIECES[selectedTrackPiece.kind].name}`
    : '–'
  view.setCoasterTrackSelection(selectedTrackPiece?.points ?? [])
  const previewPiece = createTrackPiece(
    'preview',
    resolved.kind,
    anchorPiece.end,
    resolved.chainLift,
    resolved.options,
  )
  view.setCoasterConstructionPreview(previewPiece.points, {
    kind: resolved.kind,
    chainLift: resolved.chainLift,
    styleId: type.trackStyle,
    railColor: type.railColor,
    structureColor: type.color,
  })
  const accessState = `${coaster.entrance ? '✓ Eingang' : '○ Eingang'} · ${coaster.exit ? '✓ Ausgang' : '○ Ausgang'}`
  coasterStatus.textContent =
    `Bauanker: ${anchorPiece.end.x}, ${anchorPiece.end.z} · Höhe ${anchorPiece.end.elevation.toFixed(2)} · ` +
    `Neigung ${(anchorPiece.end.pitch * 180 / Math.PI).toFixed(1)}° · Banking ${(anchorPiece.end.bank * 180 / Math.PI).toFixed(0)}°. ` +
    `${coaster.closed ? '✓ Strecke geschlossen' : 'Strecke noch offen'} · ${accessState}`
}

function updateContextHelp(): void {
  if (coasterBuilderActive) {
    contextHelp.textContent = !activeCoasterId
      ? coasterStartCandidate
        ? 'Startpunkt gesetzt: drehen oder Höhe ändern, dann „Startplattform bauen“.'
        : 'Klicke auf das Gelände, um den Startpunkt festzulegen.'
      : coasterAccessMode
        ? `Klicke neben eine Stationsplattform: ${coasterAccessMode === 'entrance' ? 'Eingang' : 'Ausgang'}`
        : 'Wähle im Achterbahn-Editor das nächste Schienenelement.'
    return
  }
  if (pathWindowOpen && pathDemolishActive) {
    contextHelp.textContent = roadEditorOpen ? 'Straße anklicken oder ziehen, um sie abzureißen.' : 'Weg anklicken oder ziehen, um ihn abzureißen.'
    return
  }
  if (pathWindowOpen && pathEditorActive) {
    if (roadEditorOpen) {
      contextHelp.textContent = pathAnchor ? 'Richtung wählen, dann Bauen oder Enter. Zurück mit Backspace.' : 'Feld anklicken, um das erste Straßenstück zu setzen.'
      return
    }
    contextHelp.textContent = pathAnchor
      ? 'Richtung und Neigung wählen, dann „Bauen“ oder das nächste Feld anklicken.'
      : 'Feld anklicken, um das erste Wegstück zu setzen.'
    return
  }
  if (pathWindowOpen && !pathEditorActive) {
    contextHelp.textContent =
      pathConstructionType === 'queue'
        ? 'Schlange ziehen. Belag oben gedrückt halten.'
        : 'Wegbelag gedrückt halten, dann Felder ziehen.'
    return
  }
  const tool = game.snapshot.selectedTool
  if (rideAccessPlacement) {
    contextHelp.textContent=hoveredCell
      ? game.canPlaceRideAccess(rideAccessPlacement.id,rideAccessPlacement.type,hoveredCell.x,hoveredCell.z).message
      : 'Ein- oder Ausgang auf ein freies Nachbarfeld setzen'
    return
  }
  if (!hoveredCell) {
    contextHelp.textContent = 'Bewege den Mauszeiger über das Gelände.'
    return
  }
  const cell = hoveredCell

  const rideAccess = cell.buildingId
    ? game.getRideAccessAt(cell.x, cell.z)
    : undefined
  const existing =
    rideAccess && rideAccess.building.id === cell.buildingId
      ? undefined
      : cell.buildingId
        ? game.snapshot.buildings.find((building) => building.id === cell.buildingId)
        : game.getAt(cell.x, cell.z, undefined, cell.localX, cell.localZ)
  if (tool === 'inspect') {
    const height = game.getTerrainHeight(hoveredCell.x, hoveredCell.z)
    const dump = game.getWasteDumpAt(hoveredCell.x, hoveredCell.z)
    const dumpArea = dump
      ? connectedWasteDumpStats(game.snapshot.wasteDumpCells ?? [], dump)
      : null
    const backstage = game.getBackstageCellAt(hoveredCell.x, hoveredCell.z)
    const backstageStats = backstage
      ? game.getBandSupplyAt(hoveredCell.x, hoveredCell.z)
      : undefined
    const ground = groundInfo(game.snapshot, hoveredCell.x, hoveredCell.z)
    const soilName = { field: 'Ackerboden', clay: 'Lehmboden', gravel: 'Kiesboden', sand: 'Sandboden', grass: 'Wiesenboden', urban: 'Stadtboden' }[ground.type]
    const cellX = hoveredCell.x
    const cellZ = hoveredCell.z
    const parking = game.snapshot.logistics.parkingCells.some(
      (cell) => cell.x === cellX && cell.z === cellZ,
    )
    const surfaceName = parking
      ? 'Parkfläche'
      : ground.surface === 'paved' ? 'Gepflastert' : ground.surface === 'gravel' ? 'Geschottert' : ground.compacted ? 'Verdichtet' : 'Unbefestigt'
    const depot = game.getDepotAt(hoveredCell.x, hoveredCell.z)
    contextHelp.textContent =
      rideAccess && rideAccess.building.id === hoveredCell.buildingId
      ? `${rideAccess.type === 'entrance' ? 'Eingang' : 'Ausgang'} auswählen`
      : existing
      ? `${BUILDINGS[existing.kind].name} auswählen`
      : depot
        ? `${depot.role === 'delivery' ? 'Anlieferungsplatz' : 'Depot'} auswählen`
      : dumpArea
        ? formatWasteDumpAreaHover(dumpArea)
      : dump
        ? `Müllablage · ${dump.stored} Säcke gelagert`
      : backstageStats
        ? formatBackstageHover(backstageStats)
      : backstage
        ? 'Backstage auswählen'
      : isWaterHeight(height, game.getWaterLevel())
        ? isSwimmableHeight(height, game.getWaterLevel())
          ? 'Wasser – Gäste können baden'
          : 'Wasser'
        : `${game.getCampingCellAt(hoveredCell.x, hoveredCell.z) ? 'Zeltbereich · ' : ''}${parking ? 'Parkplatz · ' : ''}${soilName} · ${surfaceName}${ground.drained ? ' · Entwässert' : ''} · Tragfähigkeit ${ground.bearing}/3${height > 0 ? ` · Ebene ${height}` : ''}`
  } else if (tool === 'terrainRaise') {
    contextHelp.textContent =
      'Rechteck ziehen: Fläche um 0,5 anheben. Hänge höchstens 0,5, Rest als Steilklippe.'
  } else if (tool === 'terrainLower') {
    contextHelp.textContent =
      'Rechteck ziehen: Fläche um 0,5 senken. Unter −0,5 liegt Wasser.'
  } else if (tool === 'terrainSmooth') {
    contextHelp.textContent =
      'Rechteck ziehen: alle Felder auf die Höhe unter dem Startpunkt setzen.'
  } else if (tool === 'bulldoze') {
    const access = game.getAccessControlAt(hoveredCell.x, hoveredCell.z)
    const removableCoaster = game.getRemovableCoasterAt(hoveredCell.x, hoveredCell.z)
    contextHelp.textContent =
      rideAccess && rideAccess.building.id === hoveredCell.buildingId
        ? `${rideAccess.type === 'entrance' ? 'Eingang' : 'Ausgang'} entfernen`
        : existing
          ? existing.kind === 'tree'
            ? `Baum entfernen (${SIMULATION_CONFIG.economy.treeClearCost} €)`
            : `${BUILDINGS[existing.kind].name} abreißen`
          : removableCoaster
            ? `${removableCoaster.name} abreißen`
          : access
            ? 'Kontrolle entfernen'
          : game.getCampingCellAt(hoveredCell.x, hoveredCell.z)
            ? 'Zeltbereich aufheben'
            : game.snapshot.logistics.parkingCells.some(
                (parking) => parking.x === cell.x && parking.z === cell.z,
              )
              ? 'Parkplatz aufheben'
            : game.getMedicalCellAt(hoveredCell.x, hoveredCell.z)
              ? 'Krankenbereich aufheben'
            : game.getWasteDumpAt(hoveredCell.x, hoveredCell.z)
              ? 'Müllablage aufheben'
            : game.getRoadCellAt(hoveredCell.x, hoveredCell.z)
              ? 'Straße entfernen'
            : 'Leeres Feld'
    contextHelp.textContent += ' · Klicken oder rechteckig ziehen'
  } else if (tool === 'coaster') {
    contextHelp.textContent = 'Öffne den Achterbahn-Editor, um eine Bahn zu bauen.'
  } else if (tool === 'camping') {
    contextHelp.textContent = game.getCampingCellAt(hoveredCell.x, hoveredCell.z)
      ? 'Dieses Feld gehört bereits zum Zeltbereich.'
      : 'Klicken oder rechteckig ziehen, um freie Flächen als Zeltbereich auszuweisen.'
  } else if (tool === 'medicalArea') {
    contextHelp.textContent = 'Klicken oder ziehen, um einen Krankenbereich auszuweisen.'
  } else if (tool === 'wasteDump') {
    contextHelp.textContent =
      game.getWasteDumpAt(hoveredCell.x, hoveredCell.z)
        ? 'Diese Müllablage senkt die Attraktivität stark. Reinigungskräfte bringen hierher Müll.'
        : 'Klicken oder ziehen, um eine Müllablage auszuweisen. Sie ist extrem unattraktiv; Müllfahrzeuge brauchen eine Straße daneben.'
  } else if (isWasteBin(tool)) {
    contextHelp.textContent =
      'Mülleimer setzen. Gäste im Umkreis von 7 Feldern werfen gebrauchte Dinge hier hinein.'
  } else if (isSealedWasteContainer(tool)) {
    contextHelp.textContent =
      'Versiegelter Müllcontainer (80 Beutel). Reinigung bringt Müll hierher, wenn er näher als die Ablage ist. Müllwagen leeren ihn nur, wenn er auf einer Straße steht.'
  } else if (tool === 'stageForecourt') {
    contextHelp.textContent =
      'Klicken oder rechteckig ziehen, um einen Bühnenvorplatz mit 9 Plätzen je Feld auszuweisen.'
  } else if (tool === 'backstageArea') {
    const cost = SIMULATION_CONFIG.bandSupply.backstageDesignationCost
    contextHelp.textContent = backstageEraseMode
      ? 'Klicken oder ziehen, um Backstage zu entfernen. Getrennte Reste bleiben ausgewiesen, zählen aber nicht.'
      : `Klicken oder ziehen, um Backstage auszuweisen (${cost} € je Feld). Muss an eine Bühne anschließen.`
  } else if (tool === 'powerCable') {
    contextHelp.textContent = game.getPowerCableAt(hoveredCell.x, hoveredCell.z)
      ? 'Hier liegt ein Kabel. Klick entfernt es, Ziehen verlegt weitere.'
      : 'Klicken oder ziehen, um Stromkabel zu Generatoren und Verbrauchern zu legen.'
  } else if (tool === 'road') {
    contextHelp.textContent = 'Klicken oder ziehen, um eine ebenerdige Straße zu bauen.'
  } else if (tool === 'parkingArea') {
    contextHelp.textContent = 'Rechteckig ziehen, um Parkplätze auszuweisen.'
  } else if (tool === 'roadDirection') {
    contextHelp.textContent = 'Straße anklicken: aktuelle Baurichtung als Fahrtrichtung setzen.'
  } else if (tool === 'trafficLight') {
    contextHelp.textContent = 'Straße anklicken: Ampel in aktueller Baurichtung setzen. Danach öffnet sich die Steuerung.'
  } else if (tool === 'pathBarrier') {
    contextHelp.textContent = 'Personenweg anklicken: Tor in aktueller Baurichtung setzen. Danach öffnet sich die Steuerung.'
  } else if (tool === 'deliveryYard') {
    contextHelp.textContent = 'Anlieferungsplatz neben einer Straße auf verdichtetem Boden setzen (400 €).'
  } else if (tool === 'supplyDepot') {
    contextHelp.textContent = 'Depot an einem Fußweg auf verdichtetem Boden setzen (400 €).'
  } else if (tool === 'staffGate') {
    contextHelp.textContent = 'Fußweg anklicken: Personaleingang an die Kante in der aktuellen Baurichtung setzen (80 €). Nochmaliger Klick entfernt es.'
  } else if (tool === 'roadSeparator') {
    contextHelp.textContent = 'Straße anklicken: Kante in aktueller Baurichtung sperren.'
  } else if (tool === 'fence') {
    contextHelp.textContent =
      'Bauzaun setzen: die aktuelle Baurichtung wählt die gesperrte Seite. Ziehen setzt eine Linie.'
  } else if (tool === 'securityGate') {
    contextHelp.textContent =
      'Festival-Einlass auf einen Weg setzen. Die Baurichtung zeigt ins Gelände; im Objektfenster lässt sich der Besucheranteil einstellen.'
  } else if (tool === 'crosswalk') {
    contextHelp.textContent = 'Straße anklicken, um einen Zebrastreifen umzuschalten.'
  } else if (
    tool === 'roadSpeed10' ||
    tool === 'roadSpeed30' ||
    tool === 'roadSpeed50'
  ) {
    contextHelp.textContent = 'Straßenfeld anklicken, um die Geschwindigkeitszone festzulegen.'
  } else if (
    tool === 'path' &&
    game.getRoadCellAt(hoveredCell.x, hoveredCell.z)
  ) {
    contextHelp.textContent =
      game.snapshot.buildElevation >= 1
        ? 'Gehweg als Überweg über die Straße. Besucher laufen oben, Autos darunter.'
        : 'Auf der Straße nur als Überweg: Bauhöhe auf Ebene 1 stellen.'
  } else if (terrainToolMode(tool)) {
    contextHelp.textContent =
      'Rechteck ziehen: Fläche anheben, senken oder auf die Starthöhe glätten.'
  } else if ((BUILDING_KINDS as readonly string[]).includes(tool)) {
    const kind = tool as BuildingKind
    contextHelp.textContent = game.canPlace(kind, hoveredCell.x, hoveredCell.z, scenerySlot(kind, hoveredCell.localX, hoveredCell.localZ, game.snapshot.buildRotation)).message
    if (isScenery(kind)) contextHelp.textContent += isEdgeScenery(kind) ? ' · Maus: Feldkante · R: nächste Seite · Shift: Bauhöhe (0,5)' : isLargeScenery(kind) ? ' · Ganzes Feld · R: drehen' : ' · Maus: Viertelfeld · R: drehen'
  }
}

function hideVisitorPanel(): void {
  selectedVisitorId = null
  followedVisitorId = null
  view.followVisitor(null)
  view.setVisitorPreviewTarget(null)
  visitorPanel.classList.remove('visible')
}

function selectVisitor(visitorId: string): void {
  selectedVisitorId = visitorId
  if (followedVisitorId) {
    followedVisitorId = visitorId
    view.followVisitor(visitorId)
  }
  selectedEntity = null
  entityPanel.hidden = true
  view.setInspectedVehicle(null)
  staffDetails.close()
  view.setVisitorPreviewTarget(visitorId)
  view.setVisitorPreviewMode(visitorPreviewMode)
  visitorPanel.classList.add('visible')
  updateVisitorPanel()
}

function updateVisitorPanel(): void {
  if (!selectedVisitorId) return
  const visitor = game.getVisitor(selectedVisitorId)
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
    ? '⏹ Verfolgung beenden'
    : '📍 Besucher verfolgen'

  const stateLabels = {
    entering: 'Betritt den Park',
    exploring: 'Erkundet den Park',
    seeking: 'Auf dem Weg zu einem Ziel',
    using: 'Benutzt eine Attraktion',
    queuing: 'Wartet an einer Achterbahn',
    riding: 'Fährt Achterbahn',
    sleeping: 'Schläft auf dem Boden',
    camping: 'Am eigenen Zeltplatz',
    socializing: 'Chillt auf dem Zeltplatz',
    vomiting: 'Übergibt sich',
    'security-check': 'Wird kontrolliert',
    'medical-transport': 'Wird zum Krankenbereich gebracht',
    medical: 'Wird medizinisch versorgt',
    partying: 'Feiert zur Musik',
    'bench-resting': 'Ruht sich auf einer Bank aus',
    relaxing: 'Hält sich an einem Lieblingsort auf',
    swimming: 'Baden im Wasser',
    'camp-waiting': 'Wartet auf einen Campingplatz',
    'vehicle-arrival': 'Sitzt im anreisenden Auto',
    'bus-waiting': 'Wartet auf einen Bus',
    'bus-riding': 'Fährt mit dem Bus',
    injured: 'Wartet verletzt auf Hilfe',
    exiting: 'Verlässt die Attraktion',
    leaving: 'Verlässt den Park',
    panicking: 'Flieht aus dem Gedränge',
  }
  visitorName.textContent = visitor.name
  visitorThought.textContent = `„${visitor.thought}“`
  visitorState.textContent =
    visitor.streakingMinutes > 0
      ? 'Flitzt nackt über das Gelände'
      : stateLabels[visitor.state]
  visitorBudget.textContent = formatMoney(visitor.budget)
  requireElement<HTMLElement>('#visitor-music').textContent=GENRES.find(g=>g.id===visitor.musicTaste)?.name??'Noch offen'
  requireElement<HTMLElement>('#visitor-audience').textContent = visitor.audience ? AUDIENCE_NAMES[visitor.audience] : 'Freies Spiel'
  visitorAlcoholDisposition.textContent =
    visitor.alcoholDisposition === 'aggressive' ? 'Eher aggressiv' : 'Eher ruhig'
  visitorCamping.textContent =
    visitor.campingPhase === 'none'
      ? 'Kein Zelt'
      : visitor.campingPhase === 'seeking'
        ? 'Auf dem Weg zur Parzelle'
        : visitor.campingPhase === 'building'
          ? 'Baut das Zelt auf'
          : visitor.campingPhase === 'packing'
            ? 'Packt das Zelt ein'
            : visitor.campingPhase === 'resting' || visitor.campingPhase === 'returning'
              ? 'Erholt sich im eigenen Zelt'
              : 'Zelt aufgebaut'
  visitorTicket.textContent =
    visitor.ticketType === 'camping' ? 'Campingpass' : 'Tageskarte'
  visitorSleepRhythm.textContent =
    `${formatTime(visitor.preferredBedtime)}–${formatTime(visitor.preferredWakeTime)}`
  visitorCrowding.textContent = `${Math.round(visitor.crowding)}%`
  visitorAttractiveness.textContent =
    `${Math.round(visitor.localAttractiveness)}%`
  visitorParty.textContent = `${Math.round(visitor.localPartyMood)}%`
  visitorPreferences.textContent =
    `Schönheit ${Math.round(visitor.beautyPreference * 100)}% · Party ${Math.round(visitor.partyPreference * 100)}%`
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
                ? ' · aufgebaut'
                : (item.kind === 'chairs' ||
                    item.kind === 'pavilion' ||
                    item.kind === 'musicBox') &&
                    game.snapshot.campInstallations.some(
                      (installation) =>
                        installation.kind === item.kind &&
                        installation.contributorIds.includes(visitor.id),
                    )
                  ? ' · aufgestellt'
                  : ''
            return `<span title="${definition.name}${deployed}">${definition.icon} ${definition.name} ×${item.quantity}${deployed}</span>`
          })
          .join('')
      : ''
  const souvenirBits: string[] = []
  if (visitor.ownedMascot) {
    souvenirBits.push(
      `<span title="Maskottchen">${visitor.heldMascot ? '🧸 Maskottchen · in der Hand' : '🧸 Maskottchen'}</span>`,
    )
  }
  if (visitor.wornShirt) {
    souvenirBits.push(
      `<span title="Festival-Shirt">👕 ${SHIRT_STYLE_LABELS[visitor.wornShirt.style]}</span>`,
    )
  }
  visitorInventory.innerHTML =
    [visitorInventory.innerHTML, ...souvenirBits].filter(Boolean).join('') ||
    '<small>Keine Gegenstände</small>'

  const needKeys = ['hunger', 'toilet', 'fun', 'energy'] as const
  needKeys.forEach((key) => {
    const value = Math.round(visitor.needs[key])
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
  requireElement<HTMLElement>('#open-ride-construction').hidden=true
  editStageButton.hidden = true
  if (!selectedEntity) return
  accessControlOptions.hidden = selectedEntity.type !== 'access'
  accessControlOptions.classList.toggle('visible', selectedEntity.type === 'access')
  depotOptions.classList.toggle('visible', selectedEntity.type === 'depot')
  if (selectedEntity.type === 'depot') {
    const depot = game.getDepot(selectedEntity.id)
    if (!depot) {
      closeEntityPanel()
      return
    }
    const delivery = depot.role === 'delivery'
    entityIcon.textContent = delivery ? '📦' : '🏪'
    entityType.textContent = delivery ? 'Anlieferungsplatz' : 'Warendepot'
    entityName.textContent = delivery ? 'Anlieferung' : 'Depot'
    entityStatus.textContent = delivery
      ? 'Lastwagen laden hier ab. Träger bringen Ware zu Depots und Ständen.'
      : depot.distribution === 'relay'
        ? 'Zwischenlager: andere Depots dürfen entnehmen.'
        : 'Versorgt Stände bis zum Mindestbestand.'
    const workers = depotWorkerCount(depot.id)
    entityStats.innerHTML = `
      <span>Position <b>${depot.x}, ${depot.z}</b></span>
      <span>Träger <b>${workers}</b></span>
      ${Object.entries(SUPPLIES)
        .map(
          ([kind, item]) =>
            `<span>${item.name} <b>${Math.floor(depot.stock[kind as Supply])} / ${depot.minimum[kind as Supply]}</b></span>`,
        )
        .join('')}
    `
    depotRoleHint.textContent = delivery
      ? 'Mindestbestand löst Nachbestellungen aus. Träger holen Ware hier ab.'
      : 'Mindestbestand und Träger gelten für dieses Depot.'
    if (document.activeElement !== depotWorkers) depotWorkers.value = String(workers)
    depotWorkersValue.textContent = depotWorkers.value
    if (document.activeElement !== depotDistribution) {
      depotDistribution.value = depot.distribution ?? 'shops'
    }
    syncStockSliders(depotOptions, 'data-depot-min', depot)
    entityTabs.classList.remove('visible')
    entityOverview.hidden = false
    entityDynamics.classList.remove('visible')
    priceOptions.classList.remove('visible')
    shirtOptions.classList.remove('visible')
    applyPriceToKindButton.hidden = true
    securityOptions.classList.remove('visible')
    coasterOptions.classList.remove('visible')
    return
  }
  if (selectedEntity.type === 'access') {
    const control = game.getAccessControl(selectedEntity.id)
    if (!control) {
      closeEntityPanel()
      return
    }
    const isLight = control.kind === 'trafficLight'
    entityIcon.textContent = isLight ? '🚦' : '🚧'
    entityType.textContent = isLight ? 'Ampel' : 'Personentor'
    entityName.textContent = isLight ? 'Straßenampel' : 'Personentor'
    entityStatus.textContent = accessStatusText(control)
    accessSignal.textContent = entityStatus.textContent
    entityStats.innerHTML = `
      <span>Modus <b>${accessModeLabel(control.mode)}</b></span>
      <span>Richtung <b>${getIsoDirectionIcon(control.direction)}</b></span>
      ${
        control.kind === 'pathBarrier'
          ? `<span>Durchgang <b>${control.passage === 'both' ? 'beide Richtungen' : 'eine Richtung'}</b></span>`
          : ''
      }
      <span>Gebiet <b>${control.area.length} Felder</b></span>
    `
    entityTabs.classList.remove('visible')
    entityOverview.hidden = false
    entityDynamics.classList.remove('visible')
    priceOptions.classList.remove('visible')
    shirtOptions.classList.remove('visible')
    applyPriceToKindButton.hidden = true
    securityOptions.classList.remove('visible')
    coasterOptions.classList.remove('visible')
    depotOptions.classList.remove('visible')
    accessControlOptions.hidden = false
    accessControlOptions.classList.add('visible')
    renderAccessControlForm(control)
    return
  }
  if (selectedEntity.type === 'vehicle') {
    const vehicle = game.snapshot.logistics.roadVehicles.find(
      (item) => item.id === selectedEntity?.id,
    )
    if (!vehicle) {
      closeEntityPanel()
      return
    }
    const kind = ROAD_VEHICLE_KIND_LABELS[vehicle.kind]
    const destination = describeRoadVehicleDestination(vehicle)
    entityIcon.textContent = kind.icon
    entityType.textContent = kind.name
    entityName.textContent = kind.name
    entityStatus.textContent = describeRoadVehicleActivity(vehicle)
    entityStats.innerHTML = `
      <span>Status <b>${describeRoadVehicleActivity(vehicle)}</b></span>
      ${destination ? `<span>Ziel <b>${destination}</b></span>` : ''}
      <span>Route <b>${vehicle.route.length} Felder</b></span>
      ${formatRoadVehicleInspectLoad(
        vehicle,
        game.snapshot.logistics.arrivalGroups.find(
          (group) => group.id === vehicle.groupId,
        )?.memberIds.length,
      )
        .map((stat) => `<span>${stat.label} <b>${stat.value}</b></span>`)
        .join('')}
      ${
        vehicle.waitMinutes > 0
          ? `<span>Wartet seit <b>${vehicle.waitMinutes.toFixed(1)} min</b></span>`
          : ''
      }
    `
    entityTabs.classList.remove('visible')
    entityOverview.hidden = false
    entityDynamics.classList.remove('visible')
    priceOptions.classList.remove('visible')
    shirtOptions.classList.remove('visible')
    applyPriceToKindButton.hidden = true
    securityOptions.classList.remove('visible')
    coasterOptions.classList.remove('visible')
    depotOptions.classList.remove('visible')
    return
  }
  if (selectedEntity.type === 'wasteDump') {
    const origin = parseWasteDumpId(selectedEntity.id)
    const stats =
      origin &&
      connectedWasteDumpStats(game.snapshot.wasteDumpCells ?? [], origin)
    if (!stats) {
      closeEntityPanel()
      return
    }
    const inspect = formatWasteDumpAreaInspect(stats)
    entityIcon.textContent = '🗑️'
    entityType.textContent = 'Müllsammelplatz'
    entityName.textContent = 'Müllablage'
    entityStatus.textContent = inspect.status
    entityStats.innerHTML = inspect.lines
      .map((line) => `<span>${line.label} <b>${line.value}</b></span>`)
      .join('')
    entityTabs.classList.remove('visible')
    entityOverview.hidden = false
    entityDynamics.classList.remove('visible')
    priceOptions.classList.remove('visible')
    shirtOptions.classList.remove('visible')
    applyPriceToKindButton.hidden = true
    securityOptions.classList.remove('visible')
    coasterOptions.classList.remove('visible')
    depotOptions.classList.remove('visible')
    return
  }
  if (selectedEntity.type === 'backstage') {
    const match = /^backstage:(-?\d+):(-?\d+)$/.exec(selectedEntity.id)
    const stats =
      match && game.getBandSupplyAt(Number(match[1]), Number(match[2]))
    if (!stats) {
      closeEntityPanel()
      return
    }
    const inspect = formatBackstageInspect(stats)
    entityIcon.textContent = '🎤'
    entityType.textContent = 'Bandversorgung'
    entityName.textContent = 'Backstage'
    entityStatus.textContent = inspect.status
    entityStats.innerHTML = inspect.lines
      .map((line) => `<span>${line.label} <b>${line.value}</b></span>`)
      .join('')
    entityTabs.classList.remove('visible')
    entityOverview.hidden = false
    entityDynamics.classList.remove('visible')
    priceOptions.classList.remove('visible')
    shirtOptions.classList.remove('visible')
    applyPriceToKindButton.hidden = true
    securityOptions.classList.remove('visible')
    coasterOptions.classList.remove('visible')
    depotOptions.classList.remove('visible')
    return
  }
  if (selectedEntity.type === 'building') {
    const building = game.snapshot.buildings.find((item) => item.id === selectedEntity?.id)
    if (!building) {
      closeEntityPanel()
      return
    }
    editStageButton.hidden = building.kind !== 'stage'
    const definition = BUILDINGS[building.kind]
    entityIcon.textContent = definition.icon
    entityType.textContent = 'Gebäude'
    entityName.textContent = building.rideType === 'bungee' ? `Bungee-Turm · ${building.bungeeHeight ?? 20} m` : definition.name
    requireElement<HTMLElement>('#open-ride-construction').hidden=building.kind!=='ride'
    const scheduledActive = game.isBuildingCurrentlyActive(building)
    const needsPower = (SIMULATION_CONFIG.power.demand[building.kind] ?? 0) > 0
    const hasPower = game.isBuildingPowered(building.id)
    const stageDayPlanActive =
      building.kind === 'stage' &&
      game.isOfferCurrentlyActive('stages')
    entityStatus.textContent =
      game.getRideAccessIssue(building) ?? (needsPower && !hasPower
        ? 'Kein Strom – Kabel zum Generator verlegen'
      : stageDayPlanActive && !scheduledActive
        ? `☕ ${building.bandName ?? 'Band'} macht 30 Minuten Pause`
      : !scheduledActive
        ? 'Nach Tagesplan derzeit geschlossen'
        : building.kind === 'stage'
        ? `🎸 ${building.bandName ?? 'Band'} spielt gerade`
        : building.kind === 'directionalSpeaker'
          ? `Schallrichtung ${getIsoDirectionIcon(building.rotation)} · direkt davor zu laut`
          : building.kind === 'omniSpeaker'
            ? 'Beschallt die Umgebung in alle Richtungen'
            : isWasteBin(building.kind)
              ? `Füllstand ${building.wasteFill ?? 0}/${SIMULATION_CONFIG.waste.binCapacity} · Gäste im Umkreis von 7 Feldern nutzen ihn`
            : isSealedWasteContainer(building.kind)
              ? formatSealedContainerInspect({
                  stored: building.wasteFill ?? 0,
                  onRoad: Boolean(
                    game.getRoadCellAt(building.x, building.z, building.elevation),
                  ),
                  truckReachable: Boolean(
                    game.getRoadCellAt(building.x, building.z, building.elevation),
                  ),
                }).status
            : `Zugang ${getIsoDirectionIcon(building.rotation)} · Ebene ${building.elevation}`)
    const demand = SIMULATION_CONFIG.power.demand[building.kind] ?? 0
    const output = SIMULATION_CONFIG.power.output[building.kind] ?? 0
    entityStats.innerHTML = `
      <span>Baukosten <b>${formatMoney(definition.cost + (building.stageDesign ? stageStats(building.stageDesign).cost : 0))}</b></span>
      ${building.stageDesign ? `<span>Eigene Bühne <b>${escapeHtml(building.stageDesign.name)}</b></span><span>Party / Umgebung <b>${stageStats(building.stageDesign).party} / ${stageStats(building.stageDesign).beauty}</b></span><span>Technik zusätzlich <b>${stageStats(building.stageDesign).power} kW · ${stageStats(building.stageDesign).upkeep} €/h</b></span>` : ''}
      <span>Unterhalt <b>${formatMoney(definition.upkeep)}/h</b></span>
      <span>Kapazität <b>${building.rideType === 'bungee' ? '1 Springer' : definition.capacity}</b></span>
      ${shopSupplyKind(building.kind) ? `<span>Warenbestand <b>${Math.floor(game.snapshot.festival.infrastructure.shops[building.id]?.[shopSupplyKind(building.kind)!]??0)} / Ziel 40</b></span>` : ''}
      ${
        isWasteBin(building.kind)
          ? `<span>Inhalt <b>${building.wasteFill ?? 0}/${SIMULATION_CONFIG.waste.binCapacity}</b></span>`
          : isSealedWasteContainer(building.kind)
            ? `<span>Inhalt <b>${building.wasteFill ?? 0}/${SIMULATION_CONFIG.waste.sealedContainerCapacity}</b></span>`
          : ''
      }
      ${
        output > 0
          ? `<span>Leistung <b>${output} kW</b></span>`
          : demand > 0
            ? `<span>Strom <b>${demand} kW ${hasPower ? 'versorgt' : 'ohne Netz'}</b></span>`
            : ''
      }
    `
    entityTabs.classList.remove('visible')
    entityOverview.hidden = false
    entityDynamics.classList.remove('visible')
    const hasPrice = isPricedShopKind(building.kind)
    const isShirtStall = building.kind === 'shirt'
    priceOptions.classList.toggle('visible', hasPrice)
    shirtOptions.classList.toggle('visible', isShirtStall)
    if (isShirtStall) {
      const selectedColor = building.shirtColor ?? SHIRT_COLORS[0]!.color
      if (shirtColorPalette.dataset.built !== '1') {
        shirtColorPalette.innerHTML = SHIRT_COLORS.map(
          (swatch) =>
            `<button type="button" class="shirt-color-swatch" data-shirt-color="${swatch.color}" title="${swatch.name}" style="background:#${swatch.color.toString(16).padStart(6, '0')}"></button>`,
        ).join('')
        shirtColorPalette.dataset.built = '1'
      }
      shirtColorPalette.querySelectorAll<HTMLButtonElement>('[data-shirt-color]').forEach((button) => {
        button.classList.toggle('selected', Number(button.dataset.shirtColor) === selectedColor)
      })
      if (document.activeElement !== shirtStyleSelect) {
        shirtStyleSelect.value = building.shirtStyle ?? 'basic'
      }
    }
    applyPriceToKindButton.hidden = !hasPrice
    if (hasPrice) {
      applyPriceToKindButton.textContent =
        `Für alle ${BUILDINGS[building.kind].name}-Gebäude übernehmen`
    }
    if (hasPrice && document.activeElement !== entityPriceInput) {
      entityPriceInput.value = String(building.price)
    }
    depotOptions.classList.remove('visible')
    const isSecurityGate = building.kind === 'securityGate'
    securityOptions.classList.toggle('visible', isSecurityGate)
    if (isSecurityGate) {
      const config = building.securityConfig!
      const assigned = game.snapshot.staff.find(
        (member) =>
          member.role === 'security' && member.assignedBuildingId === building.id,
      )
      securityStaffing.textContent = assigned
        ? `Besetzt durch ${assigned.name}`
        : 'Unbesetzt – Kontrollen finden nicht statt'
      if (document.activeElement !== securityThoroughness) {
        securityThoroughness.value = String(Math.round(config.thoroughness * 100))
      }
      securityThoroughnessValue.textContent = `${Math.round(config.thoroughness * 100)}%`
      if (document.activeElement !== securityFlowShare) {
        securityFlowShare.value = String(Math.round(config.flowShare * 100))
      }
      securityFlowShareValue.textContent = `${Math.round(config.flowShare * 100)}%`
      const itemsFingerprint = `${building.id}:${[...config.prohibitedItems].sort().join(',')}`
      if (itemsFingerprint !== securityItemsFingerprint) {
        securityItemsFingerprint = itemsFingerprint
        securityProhibitedItems.innerHTML = Object.values(INVENTORY_ITEMS)
          .map(
            (item) =>
              `<label><input type="checkbox" data-security-item="${item.kind}" ${config.prohibitedItems.includes(item.kind) ? 'checked' : ''}> ${item.icon} ${item.name}</label>`,
          )
          .join('')
      }
    }
    coasterOptions.classList.remove('visible')
    return
  }

  const coaster = game.getCoaster(selectedEntity.id)
  if (!coaster) {
    closeEntityPanel()
    return
  }
  const type = getCoasterType(coaster.typeId)
  const train = coaster.train
  const operationLabels = {
    closed: 'Geschlossen',
    open: 'Geöffnet',
    test: 'Testbetrieb',
  }
  entityIcon.textContent = '🎢'
  entityType.textContent = type.name
  entityName.textContent = coaster.name
  entityStatus.textContent = !coaster.closed
    ? 'Die Strecke ist noch nicht geschlossen.'
    : coaster.operationMode === 'open' && (!coaster.entrance || !coaster.exit)
      ? 'Die Station benötigt einen Eingang und einen Ausgang.'
      : coaster.operationMode === 'closed'
        ? 'Die Achterbahn ist geschlossen.'
        : coaster.operationMode === 'open' &&
            !game.isOfferCurrentlyActive('rides')
          ? 'Nach Tagesplan derzeit geschlossen.'
      : train.state === 'running'
        ? `Zug unterwegs · ${Math.round(train.progress * 100)}% · ${Math.abs(train.speed * 3.6).toFixed(1)} km/h${train.speed < 0 ? ' rückwärts' : ''}`
        : train.state === 'unloading'
          ? `Aussteigen · noch ${train.passengers} Gäste im Zug`
          : `Einsteigen · ${train.passengers}/${train.capacity} Gäste · ${Math.floor(train.waitMinutes)} min`
  entityStats.innerHTML = `
    <span>Status <b>${operationLabels[coaster.operationMode]}</b></span>
    <span>Schienenelemente <b>${coaster.pieces.length}</b></span>
    <span>Stationsplattformen/Wagen <b>${train.cars}</b></span>
    <span>Warteschlange <b>${coaster.queue.length}/${game.getCoasterQueueCapacity(coaster.id)}</b></span>
    <span>Stationskettenantrieb <b>Automatisch</b></span>
    <span>Kettenzüge <b>${coaster.pieces.filter((piece) => piece.chainLift).length}</b></span>
    <span>Geschwindigkeit <b>${Math.abs(train.speed * 3.6).toFixed(1)} km/h</b></span>
  `
  coasterOptions.classList.add('visible')
  shirtOptions.classList.remove('visible')
  securityOptions.classList.remove('visible')
  depotOptions.classList.remove('visible')
  entityTabs.classList.add('visible')
  entityOverview.hidden = entityTab !== 'overview'
  entityDynamics.classList.toggle('visible', entityTab === 'dynamics')
  document.querySelectorAll<HTMLButtonElement>('[data-entity-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.entityTab === entityTab)
  })
  priceOptions.classList.add('visible')
  applyPriceToKindButton.hidden = true
  if (document.activeElement !== entityPriceInput) {
    entityPriceInput.value = String(coaster.ticketPrice)
  }
  operationModeSelect.value = coaster.operationMode
  dispatchModeSelect.value = coaster.settings.dispatchMode
  dispatchIntervalInput.value = String(coaster.settings.dispatchIntervalMinutes)
  dispatchValue.textContent = `${coaster.settings.dispatchIntervalMinutes} min`
  if (entityTab === 'dynamics') updateCoasterDynamics(coaster)
}

function updateCoasterDynamics(coaster: Coaster): void {
  const telemetry = coaster.telemetry
  const hasData = telemetry.samples.length > 1
  const minimumVertical = Number.isFinite(telemetry.minVerticalG)
    ? telemetry.minVerticalG
    : 0
  const maximumVertical = Number.isFinite(telemetry.maxVerticalG)
    ? telemetry.maxVerticalG
    : 0
  const minimumLateral = hasData
    ? Math.min(...telemetry.samples.map((sample) => sample.lateralG))
    : 0
  const maximumLateral = hasData
    ? Math.max(...telemetry.samples.map((sample) => sample.lateralG))
    : 0
  const minimumLongitudinal = hasData
    ? Math.min(...telemetry.samples.map((sample) => sample.longitudinalG))
    : 0
  const maximumLongitudinal = hasData
    ? Math.max(...telemetry.samples.map((sample) => sample.longitudinalG))
    : 0
  const worldUnitMeters = getCoasterType(coaster.typeId).physics.worldUnitMeters
  const trackLengthMeters = coaster.pieces.reduce(
    (total, piece) =>
      total +
      piece.points.slice(1).reduce((pieceLength, point, index) => {
        const previous = piece.points[index]
        return previous
          ? pieceLength +
              Math.hypot(
                point.x - previous.x,
                point.y - previous.y,
                point.z - previous.z,
              ) *
                worldUnitMeters
          : pieceLength
      }, 0),
    0,
  )
  const activeRunCount = telemetry.measuring ? 1 : 0
  const measuredRunCount = Math.max(1, telemetry.completedRuns + activeRunCount)
  const averageSpeedKmh =
    telemetry.durationSeconds > 0
      ? (telemetry.cumulativeDistanceMeters / telemetry.durationSeconds) * 3.6
      : 0
  const averageDurationSeconds = telemetry.durationSeconds / measuredRunCount
  const averageAirtimeSeconds = telemetry.airtimeSeconds / measuredRunCount
  const dangers: string[] = []
  const warnings: string[] = []
  if (minimumVertical < -1.5) dangers.push('zu starke negative Vertikalkraft')
  else if (minimumVertical < -0.8) warnings.push('hohe negative Vertikalkraft')
  if (maximumVertical > 5) dangers.push('zu starke positive Vertikalkraft')
  else if (maximumVertical > 4) warnings.push('hohe positive Vertikalkraft')
  if (telemetry.maxAbsLateralG > 2.5) dangers.push('zu starke Seitenkraft')
  else if (telemetry.maxAbsLateralG > 1.8) warnings.push('hohe Seitenkraft')
  if (telemetry.maxAbsLongitudinalG > 3) dangers.push('zu starke Längskraft')
  else if (telemetry.maxAbsLongitudinalG > 2) warnings.push('hohe Längskraft')

  const safetyLevel = !hasData ? 'unknown' : dangers.length > 0 ? 'danger' : warnings.length > 0 ? 'warning' : 'safe'
  dynamicsSafety.className = `dynamics-safety ${safetyLevel}`
  dynamicsSafety.textContent = !hasData
    ? 'Noch keine vollständige Messfahrt'
    : dangers.length > 0
      ? '⚠ Potenziell gesundheitsschädlich'
      : warnings.length > 0
        ? '△ Hohe Belastung – Strecke prüfen'
        : '✓ Belastungen im sicheren Bereich'

  dynamicsStats.innerHTML = `
    <span><small>Vertikal-G</small><b>${minimumVertical.toFixed(2)} bis ${maximumVertical.toFixed(2)} g</b></span>
    <span><small>Seiten-G</small><b>${minimumLateral.toFixed(2)} bis ${maximumLateral.toFixed(2)} g</b></span>
    <span><small>Längs-G</small><b>${minimumLongitudinal.toFixed(2)} bis ${maximumLongitudinal.toFixed(2)} g</b></span>
    <span><small>Ø Hängezeit</small><b>${averageAirtimeSeconds.toFixed(1)} s</b></span>
    <span><small>Höchsttempo</small><b>${telemetry.maxSpeedKmh.toFixed(1)} km/h</b></span>
    <span><small>Ø Tempo</small><b>${averageSpeedKmh.toFixed(1)} km/h</b></span>
    <span><small>Ø Fahrtdauer</small><b>${averageDurationSeconds.toFixed(1)} s</b></span>
    <span><small>Streckenlänge</small><b>${trackLengthMeters.toFixed(0)} m</b></span>
  `
  dynamicsInfo.textContent = !hasData
    ? 'Öffne den Testbetrieb oder lasse einen Zug fahren, um Messwerte zu erfassen.'
    : dangers.length > 0
      ? `Kritische Werte: ${dangers.join(', ')}. Grenzwerte: −1,5 bis +5 g vertikal, 2,5 g seitlich und 3 g längs.`
      : warnings.length > 0
        ? `Hinweise: ${warnings.join(', ')}. Kurven und Übergänge sollten weicher gestaltet werden.`
        : `${telemetry.completedRuns} abgeschlossene Messfahrt${telemetry.completedRuns === 1 ? '' : 'en'} · Hängezeit wird unter 0,2 Vertikal-g gezählt.`
  drawTelemetryChart(coaster)
}

function drawTelemetryChart(coaster: Coaster): void {
  const context = telemetryChart.getContext('2d')
  if (!context) return
  const width = telemetryChart.width
  const height = telemetryChart.height
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#172720'
  context.fillRect(0, 0, width, height)

  const samples = coaster.telemetry.samples
  if (samples.length < 2) {
    context.fillStyle = '#8fa69c'
    context.font = '22px sans-serif'
    context.textAlign = 'center'
    context.fillText('Messfahrt erforderlich', width / 2, height / 2)
    return
  }

  const padding = { left: 48, right: 16, top: 16, bottom: 30 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const maximumDistance = Math.max(1, ...samples.map((sample) => sample.distance))
  const forceValues = samples.flatMap((sample) => [
    sample.verticalG,
    sample.lateralG,
    sample.longitudinalG,
  ])
  const minimumForce = Math.max(-8, Math.floor(Math.min(-2, ...forceValues)))
  const maximumForce = Math.min(8, Math.ceil(Math.max(6, ...forceValues)))
  const forceRange = Math.max(1, maximumForce - minimumForce)
  const xFor = (distance: number) =>
    padding.left + (distance / maximumDistance) * plotWidth
  const yFor = (force: number) =>
    padding.top + ((maximumForce - force) / forceRange) * plotHeight

  context.fillStyle = 'rgba(218, 82, 82, 0.1)'
  context.fillRect(
    padding.left,
    padding.top,
    plotWidth,
    Math.max(0, yFor(5) - padding.top),
  )
  context.fillRect(
    padding.left,
    yFor(-1.5),
    plotWidth,
    Math.max(0, padding.top + plotHeight - yFor(-1.5)),
  )

  context.font = '16px sans-serif'
  context.textAlign = 'right'
  context.textBaseline = 'middle'
  for (let force = Math.ceil(minimumForce); force <= maximumForce; force += 1) {
    const y = yFor(force)
    context.strokeStyle = force === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'
    context.beginPath()
    context.moveTo(padding.left, y)
    context.lineTo(width - padding.right, y)
    context.stroke()
    context.fillStyle = '#80978c'
    context.fillText(`${force}g`, padding.left - 7, y)
  }
  context.textAlign = 'center'
  context.textBaseline = 'top'
  context.fillText('Streckenposition', padding.left + plotWidth / 2, height - 22)

  const series = [
    { key: 'verticalG', color: '#72df91' },
    { key: 'lateralG', color: '#ef79bd' },
    { key: 'longitudinalG', color: '#f0c85a' },
  ] as const
  series.forEach(({ key, color }) => {
    context.strokeStyle = color
    context.lineWidth = 3
    context.beginPath()
    samples.forEach((sample, index) => {
      const x = xFor(sample.distance)
      const y = yFor(sample[key])
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.stroke()
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

document.querySelector('#rotate-scenery')?.addEventListener('click', () => game.rotateBuild())

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
let catalogHoverActive = false

function fillBuildThumbnails(): void {
  buildGrid.querySelectorAll<HTMLElement>('[data-preview-kind]').forEach((element) => {
    const kind = element.dataset.previewKind as BuildingKind
    const image = document.createElement('img')
    image.src = view.buildingThumbnail(kind)
    image.alt = ''
    image.setAttribute('aria-hidden', 'true')
    element.replaceChildren(image)
    delete element.dataset.previewKind
  })
  buildGrid.querySelectorAll<HTMLElement>('[data-preview-supply]').forEach((element) => {
    const kind = element.dataset.previewSupply as 'delivery' | 'supply'
    const image = document.createElement('img')
    image.src = view.supplyThumbnail(kind)
    image.alt = ''
    image.setAttribute('aria-hidden', 'true')
    element.replaceChildren(image)
    delete element.dataset.previewSupply
  })
  buildGrid.querySelectorAll<HTMLElement>('[data-preview-coaster]').forEach((element) => {
    const typeId = element.dataset.previewCoaster as CoasterTypeId
    const image = document.createElement('img')
    image.src = view.coasterTrainThumbnail(typeId)
    image.alt = ''
    image.setAttribute('aria-hidden', 'true')
    element.replaceChildren(image)
    delete element.dataset.previewCoaster
  })
}

function showCatalogStatus(button: HTMLButtonElement | null): void {
  if (buildCatalogStatus.hidden) return
  if (!button) {
    buildCatalogName.textContent = 'Objekt wählen'
    buildCatalogDetail.textContent = ''
    buildCatalogDetail.hidden = true
    buildCatalogCost.textContent = ''
    return
  }
  const name = button.dataset.catalogName ?? button.textContent?.trim() ?? 'Objekt wählen'
  const detail = button.dataset.catalogDetail ?? ''
  const cost = button.dataset.catalogCost ?? ''
  buildCatalogName.textContent = name
  buildCatalogDetail.textContent = detail
  buildCatalogDetail.hidden = detail.length === 0
  buildCatalogCost.textContent = cost ? `Kosten: ${cost}` : ''
}

function showSelectedCatalogStatus(): void {
  const active = buildGrid.querySelector<HTMLButtonElement>('.tool.active')
  showCatalogStatus(active ?? buildGrid.querySelector<HTMLButtonElement>('.tool'))
}

function catalogTileHtml(item: BuildMenuItem, catalog: boolean): string {
  const stageTemplate =
    item.tool === 'stage'
      ? game.snapshot.festival.stageTemplates?.find(
          (template) => template.name === game.snapshot.festival.selectedStageTemplate,
        )
      : undefined
  const name = escapeHtml(stageTemplate ? stageTemplate.name : item.name)
  const buildingCost =
    item.tool === 'stage'
      ? formatMoney(BUILDINGS.stage.cost + (stageTemplate ? stageStats(stageTemplate).cost : 0))
      : item.previewKind && !item.bungee
        ? formatMoney(BUILDINGS[item.previewKind].cost)
        : ''
  const cost = buildingCost || (/€/.test(item.detail) ? item.detail : '')
  const extraDetail = item.detail !== cost && item.detail !== buildingCost ? item.detail : ''
  const preview = item.previewKind
    ? `<span class="building-preview" data-preview-kind="${item.previewKind}">${item.icon}</span>`
    : item.previewSupply
      ? `<span class="building-preview" data-preview-supply="${item.previewSupply}">${item.icon}</span>`
      : item.coasterTypeId
        ? `<span class="building-preview" data-preview-coaster="${item.coasterTypeId}">${item.icon}</span>`
        : `<span>${item.icon}</span>`
  const speedClass =
    item.tool === 'roadSpeed10'
      ? ' speed-10'
      : item.tool === 'roadSpeed30'
        ? ' speed-30'
        : item.tool === 'roadSpeed50'
          ? ' speed-50'
          : ''
  const label = [name, extraDetail, cost].filter(Boolean).join(', ')
  const catalogAttrs = catalog
    ? ` data-catalog-name="${name}" data-catalog-detail="${escapeHtml(extraDetail)}" data-catalog-cost="${escapeHtml(cost)}" aria-label="${escapeHtml(label)}"`
    : ''
  const caption = catalog ? '' : `<em>${name}<small>${item.tool === 'stage' ? cost : item.detail}</small></em>`
  return `<button class="tool${speedClass}" data-tool="${item.tool}"${item.bungee ? ' data-bungee="true"' : ''}${item.coasterTypeId ? ` data-coaster-type="${item.coasterTypeId}"` : ''}${catalogAttrs} type="button">${preview}${caption}</button>`
}

function decorationItem(kind: BuildingKind): BuildMenuItem {
  const building = BUILDINGS[kind]
  return {
    tool: kind,
    name: building.name,
    icon: building.icon,
    detail: `${Math.floor(building.cost).toLocaleString('de-DE')} €`,
    previewKind: kind,
  }
}

function renderDecorationThemes(): void {
  const host = document.querySelector<HTMLElement>('#decoration-themes')
  if (!host) return
  host.innerHTML = DECORATION_THEMES.map(
    (theme) =>
      `<button type="button" data-decoration-theme="${theme.id}" aria-pressed="${theme.id === lastDecorationTheme}" title="${escapeHtml(theme.rationale)}">${theme.icon}<small>${escapeHtml(theme.label)}</small></button>`,
  ).join('')
}

function renderDecorationCatalog(): void {
  renderDecorationThemes()
  buildSubtabs.hidden = true
  buildSubtabs.replaceChildren()
  const sections = DECORATION_CATEGORY_IDS.flatMap((category) => {
    const kinds = filterDecorationKinds(lastDecorationTheme, category)
    if (kinds.length === 0) return []
    const tiles = kinds.map((kind) => catalogTileHtml(decorationItem(kind), true)).join('')
    return [
      `<section class="decoration-category" data-decoration-category="${category}"><h3>${DECORATION_CATEGORY_LABELS[category]}</h3><div class="decoration-category-grid">${tiles}</div></section>`,
    ]
  })
  buildGrid.innerHTML = sections.length
    ? sections.join('')
    : '<p class="decoration-empty">Keine Deko in diesem Thema.</p>'
  fillBuildThumbnails()
  showSelectedCatalogStatus()
}

function renderBuildGrid(categoryId: BuildCategoryId, groupId?: string): void {
  const category = buildCategoryById(categoryId)
  const group =
    category.groups.find((entry) => entry.id === groupId) ?? category.groups[0]!
  const catalog = isCatalogBuildCategory(categoryId)
  lastBuildGroup.set(categoryId, group.id)
  catalogHoverActive = false
  buildMenuTitle.textContent = category.label
  buildMenuPanel.classList.toggle('build-menu-catalog', catalog)
  buildMenuPanel.classList.toggle('build-menu-decoration', categoryId === 'decoration')
  buildCatalogStatus.hidden = !catalog
  document.querySelectorAll<HTMLElement>('.build-extra').forEach((extra) => {
    extra.hidden = extra.id !== `build-extra-${category.extra ?? ''}`
  })
  if (categoryId === 'decoration') {
    renderDecorationCatalog()
    return
  }
  if (category.groups.length > 1) {
    buildSubtabs.hidden = false
    buildSubtabs.innerHTML = category.groups
      .map(
        (entry) =>
          `<button type="button" data-build-group="${entry.id}" aria-pressed="${entry.id === group.id}">${entry.label}</button>`,
      )
      .join('')
  } else {
    buildSubtabs.hidden = true
    buildSubtabs.replaceChildren()
  }
  const attractionsExtra = document.querySelector<HTMLElement>('#build-extra-attractions')
  if (attractionsExtra && categoryId === 'attractions') {
    attractionsExtra.hidden = group.id !== 'rides'
  }
  buildGrid.innerHTML = group.items.map((item) => catalogTileHtml(item, catalog)).join('')
  fillBuildThumbnails()
  if (catalog) showSelectedCatalogStatus()
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
buildGrid.addEventListener('pointerover', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-tool]')
  if (!button || !buildGrid.contains(button) || buildCatalogStatus.hidden) return
  catalogHoverActive = true
  showCatalogStatus(button)
})
buildGrid.addEventListener('pointerleave', () => {
  catalogHoverActive = false
  showSelectedCatalogStatus()
})
buildGrid.addEventListener('focusin', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-tool]')
  if (button && !buildCatalogStatus.hidden) showCatalogStatus(button)
})
buildGrid.addEventListener('focusout', (event) => {
  if (buildCatalogStatus.hidden || buildGrid.contains(event.relatedTarget as Node | null)) return
  if (!catalogHoverActive) showSelectedCatalogStatus()
})
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
  setPanelOpen(
    logisticsPanel,
    logisticsPanelToggle,
    !logisticsPanel.classList.contains('visible'),
    () => {
      logisticsFingerprint = ''
      updateLogisticsPanel(true)
    },
  )
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
const scenarioGroundDetails = requireElement<HTMLElement>('#scenario-ground-details')
const scenarioUnevennessValue = requireElement<HTMLElement>('#scenario-unevenness-value')
const scenarioWorldSize = requireElement<HTMLSelectElement>('#scenario-world-size')
const scenarioSummary = requireElement<HTMLElement>('#scenario-summary')
scenarioEnvironment.addEventListener('change', () => updateScenarioLabels())
const scenarioCarValue = requireElement<HTMLElement>('#scenario-car-value')
const scenarioPartyValue = requireElement<HTMLElement>('#scenario-party-value')
const scenarioBeautyValue = requireElement<HTMLElement>('#scenario-beauty-value')
const scenarioAggressionValue = requireElement<HTMLElement>('#scenario-aggression-value')
const scenarioMoneyValue = requireElement<HTMLElement>('#scenario-money-value')

/** The free-play form on the title screen: a site without a template, without debt and without goals. */
function readScenarioForm(): ScenarioSettings {
  const worldSize = Number(scenarioWorldSize.value)
  return normalizeScenarioSettings({
    environment: scenarioEnvironment.value as Environment,
    unevenness: Number(scenarioUnevenness.value) / 100,
    carArrivalShare: Number(scenarioCarShare.value) / 100,
    partyAffinity: Number(scenarioParty.value) / 100,
    beautyAffinity: Number(scenarioBeauty.value) / 100,
    aggressiveShare: Number(scenarioAggression.value) / 100,
    startingMoney: Number(scenarioMoney.value),
    worldSize: SCENARIO_WORLD_SIZES.includes(
      worldSize as (typeof SCENARIO_WORLD_SIZES)[number],
    )
      ? (worldSize as (typeof SCENARIO_WORLD_SIZES)[number])
      : 48,
  })
}

function fillScenarioForm(settings: ScenarioSettings): void {
  scenarioEnvironment.value = settings.environment
  scenarioUnevenness.value = String(Math.round(settings.unevenness * 100))
  scenarioCarShare.value = String(Math.round(settings.carArrivalShare * 100))
  scenarioParty.value = String(Math.round(settings.partyAffinity * 100))
  scenarioBeauty.value = String(Math.round(settings.beautyAffinity * 100))
  scenarioAggression.value = String(Math.round(settings.aggressiveShare * 100))
  scenarioMoney.value = String(settings.startingMoney)
  scenarioWorldSize.value = String(settings.worldSize)
  updateScenarioLabels()
}

/**
 * What the running festival was started on. Read-only by design: the ground, the crowd
 * and the starting capital are decided once, at the start, and the park is played with
 * what it was given — so the settings window reports them instead of offering them.
 */
function updateScenarioSummary(): void {
  const settings = game.snapshot.scenario
  const preset = scenarioPreset(settings.preset)
  const goals = settings.goals
  const rows: [string, string][] = [
    ['Szenario', preset?.name ?? 'Freies Spiel'],
    ['Umgebung', ENVIRONMENTS[settings.environment].name],
    ['Kartengröße', `${settings.worldSize}×${settings.worldSize}`],
    ['Unebenheit', `${Math.round(settings.unevenness * 100)} %`],
    ['Autobesucher', `${Math.round(settings.carArrivalShare * 100)} %`],
    ['Party-Affinität', `${Math.round(settings.partyAffinity * 100)} %`],
    ['Schönheits-Affinität', `${Math.round(settings.beautyAffinity * 100)} %`],
    ['Gewaltbereitschaft', `${Math.round(settings.aggressiveShare * 100)} %`],
    ['Startkapital', `${settings.startingMoney.toLocaleString('de-DE')} €`],
  ]
  if (settings.startingLoan > 0) rows.push(['Startdarlehen', `${settings.startingLoan.toLocaleString('de-DE')} €`])
  if (goals.length) rows.push(['Ziele', goals.map((goal) => `${goalName(goal)} bis zur ${goal.edition}. Ausgabe`).join(' · ')])
  scenarioSummary.innerHTML = rows
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join('')
}

function updateScenarioLabels(): void {
  scenarioGroundDetails.textContent = ENVIRONMENTS[scenarioEnvironment.value as Environment].detail
  scenarioUnevennessValue.textContent = `${scenarioUnevenness.value} % · ${Number(scenarioUnevenness.value) === 0 ? 'Flach' : Number(scenarioUnevenness.value) <= 30 ? 'Sanft gewellt' : Number(scenarioUnevenness.value) <= 65 ? 'Hügelig' : 'Stark hügelig'}`
  scenarioCarValue.textContent = `${scenarioCarShare.value}%`
  scenarioPartyValue.textContent = `${scenarioParty.value}%`
  scenarioBeautyValue.textContent = `${scenarioBeauty.value}%`
  scenarioAggressionValue.textContent = `${scenarioAggression.value}%`
  scenarioMoneyValue.textContent = `${Number(scenarioMoney.value).toLocaleString('de-DE')} €`
}

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
const titleScreen = requireElement<HTMLElement>('#title-screen')
const titleCrowd = mountTitleCrowd(requireElement<HTMLCanvasElement>('#title-crowd'))
const titleScreenOpen = (): boolean => titleScreen.classList.contains('visible')
function setTitleScreenOpen(open: boolean): void {
  titleScreen.classList.toggle('visible', open)
  // The crowd on the heading only walks while anyone can see it.
  titleCrowd.setRunning(open)
  if (open) {
    titleScreen.querySelector('[data-title-scenario=""]')?.setAttribute('aria-expanded', 'false')
    openTitleSubmenu(false)
    closeTitleLoad()
    setAccountMaskOpen(false)
    // The running game's own windows belong to the running game: whatever was left
    // open behind the start screen is closed, so nothing of it still holds the keys.
    setScenarioPanelOpen(false)
    setSaveSlotsPanelOpen(false)
    syncAccountBar()
    void refreshResumeEntry()
  }
  // The start screen is the whole screen: every readout, toolbar and hint of the running
  // game is hidden behind it (see the body.title-open rules), and the keyboard shortcuts
  // that would otherwise reach the world are switched off.
  document.body.classList.toggle('title-open', open)
  if (!open) scenarioPanel.classList.remove('above-title')
}
/** Opens one of the existing windows on top of the title screen instead of behind it. */
function openAboveTitle(panel: HTMLElement, open: () => void): void {
  if (titleScreenOpen()) panel.classList.add('above-title')
  open()
}
const titleFreeplay = requireElement<HTMLElement>('#title-freeplay')
const titleSubmenu = requireElement<HTMLElement>('#title-submenu')
const titleLoadMask = requireElement<HTMLElement>('#title-load-mask')
const titleLoadRows = requireElement<HTMLElement>('#title-load-rows')
const titleLoadKicker = requireElement<HTMLElement>('#title-load-kicker')
const titleLoadNote = requireElement<HTMLElement>('#title-load-note')
const accountMask = requireElement<HTMLElement>('#title-account-mask')
const accountForm = requireElement<HTMLFormElement>('#title-account-form')
const accountTitle = requireElement<HTMLElement>('#title-account-title')
const accountNameInput = requireElement<HTMLInputElement>('#account-name')
const accountPasswordInput = requireElement<HTMLInputElement>('#account-password')
const accountRepeatField = requireElement<HTMLElement>('#account-repeat-field')
const accountRepeatInput = requireElement<HTMLInputElement>('#account-repeat')
const accountMessage = requireElement<HTMLElement>('#account-message')
const accountSubmit = requireElement<HTMLButtonElement>('#account-submit')
const accountSwitch = requireElement<HTMLButtonElement>('#account-switch')
const accountNameLabel = requireElement<HTMLElement>('#title-account-name')

/** Which of the two the mask is showing; the fields and the buttons follow from it. */
let accountMode: 'login' | 'register' = 'login'
function setAccountMode(mode: 'login' | 'register'): void {
  accountMode = mode
  const register = mode === 'register'
  accountTitle.textContent = register ? 'Registrieren' : 'Anmelden'
  accountSubmit.textContent = register ? 'Konto anlegen' : 'Anmelden'
  accountSwitch.textContent = register ? 'Konto vorhanden? Anmelden' : 'Noch kein Konto? Registrieren'
  accountRepeatField.hidden = !register
  accountRepeatInput.required = register
  accountPasswordInput.autocomplete = register ? 'new-password' : 'current-password'
  accountMessage.textContent = ''
}
function setAccountMaskOpen(open: boolean, mode: 'login' | 'register' = accountMode): void {
  accountMask.hidden = !open
  if (!open) return
  setAccountMode(mode)
  accountForm.reset()
  accountMessage.textContent = ''
  accountNameInput.focus()
}
/** The bar under the menu: either the two ways in, or who is signed in and the way out. */
function syncAccountBar(): void {
  const name = currentAccount()
  accountNameLabel.hidden = !name
  accountNameLabel.textContent = name ? `Angemeldet als ${name}` : ''
  titleScreen.querySelectorAll<HTMLButtonElement>('[data-account="login"], [data-account="register"]').forEach((button) => {
    button.hidden = !!name
  })
  titleScreen.querySelector<HTMLButtonElement>('[data-account="logout"]')!.hidden = !name
}
accountSwitch.addEventListener('click', () => setAccountMode(accountMode === 'login' ? 'register' : 'login'))
accountForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const name = accountNameInput.value
  const password = accountPasswordInput.value
  accountSubmit.disabled = true
  accountMessage.textContent = 'Einen Moment …'
  const done = (result: { ok: boolean; message: string }): void => {
    accountSubmit.disabled = false
    accountMessage.textContent = result.message
    if (!result.ok) return
    syncAccountBar()
    setAccountMaskOpen(false)
    showToast(result.message)
  }
  void (accountMode === 'register'
    ? registerAccount(name, password, accountRepeatInput.value)
    : signIn(name, password)
  ).then(done, () => done({ ok: false, message: 'Konto konnte nicht geprüft werden' }))
})

const titleMenuButtons = [...titleScreen.querySelectorAll<HTMLButtonElement>('[data-title-menu]')]
const titleResumeButton = requireElement<HTMLButtonElement>('[data-title-menu="resume"]')
const titleResumeMeta = requireElement<HTMLElement>('#title-resume-meta')

/**
 * Picking the game back up. The last save that was written or opened is remembered
 * here — by id, not by content — and the title screen offers exactly that one. If it
 * is gone, or nothing has been played yet, the plate stays greyed out.
 */
const LAST_SAVE_KEY = 'festival-last-save'
type LastSave = { id: string; source: 'server' | 'browser'; name: string }
let resumeSlot: SaveSlotView | null = null
function rememberLastSave(slot: { id: string; source: 'server' | 'browser'; name: string }): void {
  try {
    window.localStorage.setItem(LAST_SAVE_KEY, JSON.stringify({ id: slot.id, source: slot.source, name: slot.name } satisfies LastSave))
  } catch { /* without storage the button simply falls back to the newest save */ }
}
function readLastSave(): LastSave | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(LAST_SAVE_KEY) ?? 'null') as LastSave | null
    return stored && typeof stored.id === 'string' ? stored : null
  } catch { return null }
}
async function refreshResumeEntry(): Promise<void> {
  const archive = await fetchSaveSlots()
  const pointer = readLastSave()
  // The remembered one if it is still there, otherwise the newest of your own —
  // clearing the browser's storage should not hide an archive full of festivals.
  resumeSlot = (pointer ? findSaveSlot(pointer.id) : undefined) ?? archive.own[0] ?? null
  titleResumeButton.disabled = !resumeSlot
  titleResumeMeta.textContent = resumeSlot
    ? `${resumeSlot.name} · ${formatSaveTime(resumeSlot.savedAt)}`
    : 'Noch nicht gespielt'
  if (titleResumeButton.disabled && titleResumeButton.classList.contains('selected')) markTitleSelection(0)
}
async function resumeLastGame(): Promise<void> {
  if (!resumeSlot) return
  const loaded = await readSaveSlot(resumeSlot)
  if (!loaded) {
    // It was there when the screen opened and is not any more: say so and re-read.
    showToast('Dieser Spielstand ist nicht mehr vorhanden', true)
    void refreshResumeEntry()
    return
  }
  bindLoadedGame(loaded, `„${resumeSlot.name}“ fortgesetzt`)
  setTitleScreenOpen(false)
}
const titleRowButtons = [...titleScreen.querySelectorAll<HTMLButtonElement>('[data-title-scenario]')]

/**
 * The menu is keyboard-first, the way the design draws it: one entry is always the
 * current one, the arrow keys move between them and Enter opens. Which list the keys
 * walk depends on whether the scenario submenu is open.
 */
let titleSelection = 0
function titleEntries(): HTMLButtonElement[] {
  if (!titleLoadMask.hidden) return [...titleLoadRows.querySelectorAll<HTMLButtonElement>('[data-title-load-slot]')]
  return (titleSubmenu.hidden ? titleMenuButtons : titleRowButtons).filter((entry) => !entry.disabled)
}

/**
 * The title screen's own archive: your saves first, then everything other people
 * have made public, each with the name behind it. It only offers the one thing that
 * belongs here — picking one up. Naming, sharing and deleting stay in the running
 * game, and a public festival you take from here is never written back to: saving it
 * puts a copy in your own archive.
 */
function titleSlotRow(slot: SaveSlotView, withOwner: boolean): string {
  const meta = withOwner ? `von ${escapeHtml(slot.owner)} · ${formatSaveTime(slot.savedAt)}` : formatSaveTime(slot.savedAt)
  return `<button type="button" data-title-load-slot="${slot.id}"><span class="title-row-text"><span class="title-row-label">${escapeHtml(slot.name)}</span><span class="title-row-meta">${meta}</span></span><span class="title-row-value">Laden</span></button>`
}
async function openTitleLoad(): Promise<void> {
  titleLoadMask.hidden = false
  titleLoadRows.innerHTML = '<p class="title-load-empty">Spielstände werden gelesen …</p>'
  titleLoadNote.textContent = ''
  markTitleSelection(0)
  const archive = await fetchSaveSlots()
  const total = archive.own.length + archive.shared.length
  titleLoadKicker.textContent = total
    ? `${archive.own.length} eigene · ${archive.shared.length} öffentlich`
    : 'Archiv leer'
  const own = archive.own.length
    ? `<h3 class="title-submenu-heading">${archive.onServer ? `Deine Spielstände · ${escapeHtml(archive.account ?? '')}` : 'Spielstände in diesem Browser'}</h3>${archive.own.map((slot) => titleSlotRow(slot, false)).join('')}`
    : ''
  const shared = archive.shared.length
    ? `<h3 class="title-submenu-heading">Öffentliche Spielstände</h3>${archive.shared.map((slot) => titleSlotRow(slot, true)).join('')}`
    : ''
  titleLoadRows.innerHTML = own + shared ||
    `<p class="title-load-empty">Noch keine benannten Spielstände ${archive.onServer ? 'unter deinem Konto' : 'in diesem Browser'}. Im laufenden Spiel legst du sie über „Spielstand“ an.</p>`
  titleLoadNote.textContent = saveStorageNote(archive)
  markTitleSelection(0)
}
function closeTitleLoad(): void {
  titleLoadMask.hidden = true
  markTitleSelection(0)
}
async function loadTitleSlot(id: string): Promise<void> {
  const slot = findSaveSlot(id)
  const loaded = slot ? await readSaveSlot(slot) : null
  if (!slot || !loaded) {
    titleLoadNote.textContent = 'Dieser Spielstand ist ungültig oder nicht mehr vorhanden.'
    void openTitleLoad()
    return
  }
  const foreign = !saveArchive.own.some((own) => own.id === id)
  bindLoadedGame(loaded, foreign ? `Öffentlicher Spielstand von ${slot.owner} geladen` : 'Spielstand geladen')
  closeTitleLoad()
  setTitleScreenOpen(false)
}
function markTitleSelection(index: number): void {
  const entries = titleEntries()
  if (!entries.length) return
  titleSelection = (index + entries.length) % entries.length
  entries.forEach((entry, position) => entry.classList.toggle('selected', position === titleSelection))
  entries[titleSelection]?.scrollIntoView({ block: 'nearest' })
}
function openTitleSubmenu(open: boolean): void {
  titleSubmenu.hidden = !open
  if (!open) titleFreeplay.hidden = true
  markTitleSelection(0)
}
// Only a pointer that actually moves takes the selection over. `pointerover` alone
// would also fire when the list shifts under a resting cursor — opening the submenu
// or scrolling a row into view would then snap the selection back under the mouse.
let titlePointer = { x: -1, y: -1 }
titleScreen.addEventListener('pointermove', (event) => {
  if (event.clientX === titlePointer.x && event.clientY === titlePointer.y) return
  titlePointer = { x: event.clientX, y: event.clientY }
  const entry = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-title-menu], [data-title-scenario]')
  const index = entry ? titleEntries().indexOf(entry) : -1
  if (index >= 0) markTitleSelection(index)
})
titleScreen.addEventListener('click', (event) => {
  const target = event.target as HTMLElement
  if (target.closest('[data-account-close]')) { setAccountMaskOpen(false); return }
  const account = target.closest<HTMLButtonElement>('[data-account]')
  if (account) {
    const mode = account.dataset.account
    if (mode === 'logout') {
      void signOut().then((result) => {
        syncAccountBar()
        showToast(result.message, !result.ok)
      })
    } else setAccountMaskOpen(true, mode === 'register' ? 'register' : 'login')
    return
  }
  if (target.closest('[data-title-back]')) { openTitleSubmenu(false); return }
  if (target.closest('[data-title-load-close]')) { closeTitleLoad(); return }
  const slot = target.closest<HTMLButtonElement>('[data-title-load-slot]')
  if (slot) { void loadTitleSlot(slot.dataset.titleLoadSlot!); return }
  const menu = target.closest<HTMLButtonElement>('[data-title-menu]')
  if (menu) {
    if (menu.dataset.titleMenu === 'resume') void resumeLastGame()
    else if (menu.dataset.titleMenu === 'new') openTitleSubmenu(true)
    else if (menu.dataset.titleMenu === 'quickload') {
      if (tryQuickLoad()) setTitleScreenOpen(false)
    }
    else if (menu.dataset.titleMenu === 'load') void openTitleLoad()
    else openAboveTitle(scenarioPanel, () => setScenarioPanelOpen(true))
    return
  }
  const scenario = target.closest<HTMLButtonElement>('[data-title-scenario]')
  if (!scenario) return
  if (multiplayer.status.mode === 'client') {
    showToast('Nur der Host kann ein neues Szenario starten', true)
    return
  }
  // A scenario that carries a price is not part of the base game: it is shown, it can
  // be read, and that is all — nothing here charges anyone or collects anything.
  if (scenario.dataset.titleLocked) {
    showToast(`Dieses Szenario gehört nicht zum Grundspiel · ${scenario.dataset.titleLocked}`, true)
    return
  }
  const preset = scenarioPreset(scenario.dataset.titleScenario || undefined)
  // A prepared scenario brings its own site and starts straight away; free play first
  // asks what the site should look like, because afterwards none of it can be changed.
  if (!preset) {
    const show = titleFreeplay.hidden
    titleFreeplay.hidden = !show
    scenario.setAttribute('aria-expanded', String(show))
    if (show) {
      fillScenarioForm(game.snapshot.scenario)
      titleFreeplay.scrollIntoView({ block: 'nearest' })
    }
    return
  }
  startFestival(normalizeScenarioSettings({ ...preset.settings, preset: preset.id }), `${preset.name} gestartet`)
})
window.addEventListener('keydown', (event) => {
  if (!titleScreenOpen() || !scenarioPanel.hidden || !saveSlotsPanel.hidden) return
  if (!accountMask.hidden) {
    if (event.key === 'Escape') setAccountMaskOpen(false)
    return
  }
  if (isTextEntryTarget(event.target) || isTextEntryTarget(document.activeElement)) return
  if (event.key === 'Escape' || event.key === 'Backspace') {
    if (!titleLoadMask.hidden) { event.preventDefault(); closeTitleLoad() }
    else if (!titleSubmenu.hidden) { event.preventDefault(); openTitleSubmenu(false) }
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); markTitleSelection(titleSelection + 1) }
  else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); markTitleSelection(titleSelection - 1) }
  else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); titleEntries()[titleSelection]?.click() }
})
function startFestival(settings: ScenarioSettings, message: string): void {
  if (pathWindowOpen) closePathEditor()
  hideVisitorPanel()
  bindGameState(GameState.startNew(settings))
  setScenarioPanelOpen(false)
  setSaveSlotsPanelOpen(false)
  setTitleScreenOpen(false)
  showToast(message)
}
requireElement<HTMLButtonElement>('#open-title-screen').addEventListener('click', () => {
  setScenarioPanelOpen(false)
  setTitleScreenOpen(true)
})

requireElement<HTMLButtonElement>('#start-scenario').addEventListener('click', () => {
  if (multiplayer.status.mode === 'client') {
    showToast('Nur der Host kann ein neues Szenario starten', true)
    return
  }
  startFestival(readScenarioForm(), 'Freies Spiel gestartet')
})
fillScenarioForm(game.snapshot.scenario)
requireElement<HTMLButtonElement>('#close-logistics').addEventListener('click', () => {
  setPanelOpen(logisticsPanel, logisticsPanelToggle, false)
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
    if (tab === 'supply' || tab === 'band-supply') updateLogisticsPanel(true)
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
  const depotId = button.dataset.buyBus
  const sellDepotId = button.dataset.sellBus
  const garbageDepotId = button.dataset.buyGarbage
  const sellGarbageId = button.dataset.sellGarbage
  const sweeperDepotId = button.dataset.buySweeper
  const sellSweeperId = button.dataset.sellSweeper
  const result = garageId
    ? game.buyAmbulance(garageId)
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
  const selectedStops = [...busLineStops.selectedOptions].map(
    (option) => option.value,
  )
  const result = game.createBusLine(
    requireElement<HTMLInputElement>('#bus-line-name').value,
    busLineDepot.value,
    selectedStops,
    Number(requireElement<HTMLInputElement>('#bus-line-count').value),
    Number(requireElement<HTMLInputElement>('#bus-line-headway').value),
  )
  showToast(result.message, !result.ok)
  updateLogisticsPanel(true)
})
busLinesList.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    '[data-delete-line]',
  )
  if (!button?.dataset.deleteLine) return
  const result = game.deleteBusLine(button.dataset.deleteLine)
  showToast(result.message, !result.ok)
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

document.querySelector<HTMLButtonElement>('#save')?.addEventListener('click', () => {
  showToast(game.save().message)
})
document.querySelector<HTMLButtonElement>('#load')?.addEventListener('click', () => {
  tryQuickLoad()
})

const saveSlotsPanel = requireElement<HTMLElement>('#save-slots-panel')
const saveSlotsList = saveSlotsPanel.querySelector<HTMLElement>('.save-slots-list')!
const saveSlotsMessage = saveSlotsPanel.querySelector<HTMLElement>('.save-slots-message')!
const saveStorageInfo = saveSlotsPanel.querySelector<HTMLElement>('[data-save-storage]')!
const saveSlotName = saveSlotsPanel.querySelector<HTMLInputElement>('[name=name]')!
makeDraggable(saveSlotsPanel.querySelector<HTMLElement>('.panel-header')!, saveSlotsPanel)
makeResizable(saveSlotsPanel)
let saveSlotsPausedSpeed = 0
function setSaveSlotsPanelOpen(open: boolean): void {
  saveSlotsPanel.hidden = !open
  if (open) {
    saveSlotsPausedSpeed = game.snapshot.speed
    if (saveSlotsPausedSpeed !== 0) game.setSpeed(0)
  } else if (saveSlotsPausedSpeed !== 0) {
    game.setSpeed(saveSlotsPausedSpeed)
  }
}
const formatSaveTime = (value: number) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(value)

/**
 * Where the game's saves come from. With an account they live on the server, under
 * that account; without one - no login, or no server at all - they stay in this
 * browser. Public saves other people shared are read along either way, and every
 * slot carries where it came from, so loading one asks the right archive.
 */
type SaveSlotView = ServerSaveSlot & { source: 'server' | 'browser' }
type SaveArchiveView = {
  own: SaveSlotView[]
  shared: SaveSlotView[]
  account: string | null
  /** True when writing goes to the server: it answers and someone is signed in. */
  onServer: boolean
  reachable: boolean
}
let saveArchive: SaveArchiveView = { own: [], shared: [], account: null, onServer: false, reachable: false }
const browserSlots = (): SaveSlotView[] =>
  GameState.listSaveSlots().map((slot) => ({ ...slot, public: false, owner: '', source: 'browser' as const }))
const findSaveSlot = (id: string): SaveSlotView | undefined =>
  saveArchive.own.find((slot) => slot.id === id) ?? saveArchive.shared.find((slot) => slot.id === id)
function saveStorageNote(archive: SaveArchiveView): string {
  if (archive.onServer) return `Deine Spielstände liegen beim Konto „${archive.account}“ auf dem Spielserver — bis zu 20 Stück.`
  if (archive.reachable) return 'Ohne Konto bleiben Spielstände nur in diesem Browser. Melde dich im Titelbildschirm an, damit sie unter deinem Namen auf dem Spielserver liegen.'
  return 'Der Spielserver ist nicht erreichbar. Bis zu 20 Spielstände werden stattdessen in diesem Browser gespeichert.'
}
function bindLoadedGame(loaded: GameState, message: string): void {
  if (pathWindowOpen) closePathEditor()
  bindGameState(loaded)
  fillScenarioForm(loaded.snapshot.scenario)
  showToast(message)
}
/** Loads the single quick-save slot (`SAVE_KEY` / `GameState.load`), not a named archive entry. */
function tryQuickLoad(): boolean {
  if (multiplayer.status.mode === 'client') {
    showToast('Nur der Host kann einen Spielstand laden', true)
    return false
  }
  const loaded = GameState.load()
  if (!loaded) {
    showToast('Kein gültiger Spielstand gefunden', true)
    return false
  }
  bindLoadedGame(loaded, 'Spielstand geladen')
  return true
}
/** One row of the public list: someone else's festival, with the name behind it. */
const sharedSlotRow = (slot: SaveSlotView): string =>
  `<article data-slot="${slot.id}"><div><strong>${escapeHtml(slot.name)}</strong><small>von ${escapeHtml(slot.owner)} · ${formatSaveTime(slot.savedAt)}</small></div><div><button data-load-slot="${slot.id}">Laden</button></div></article>`

function showSaveSlots(archive: SaveArchiveView): void {
  const own = archive.own.length
    ? archive.own.map((slot) => `<article data-slot="${slot.id}"><div><strong>${escapeHtml(slot.name)}</strong><small>${formatSaveTime(slot.savedAt)}${slot.public ? ' · öffentlich' : ''}</small></div><div><button data-load-slot="${slot.id}">Laden</button><button data-overwrite-slot="${slot.id}">Überschreiben</button>${archive.onServer ? `<button data-share-slot="${slot.id}">${slot.public ? 'Nicht mehr teilen' : 'Teilen'}</button>` : ''}<button data-delete-slot="${slot.id}" aria-label="${escapeHtml(slot.name)} löschen">×</button></div></article>`).join('')
    : `<p class="save-slots-empty">Noch keine benannten Spielstände ${archive.onServer ? 'unter deinem Konto' : 'in diesem Browser'}. Der Button „Speichern“ bleibt der schnelle Einzelspielstand.</p>`
  // The shared ones are a section of their own, and they offer nothing but loading:
  // what you save afterwards lands in your archive, the original stays as it is.
  const shared = archive.shared.length
    ? `<h3 class="save-slots-heading">Öffentliche Spielstände</h3><p class="save-slots-empty">Laden ja, überschreiben nein — gespeichert wird immer unter deinem eigenen Konto.</p>${archive.shared.map(sharedSlotRow).join('')}`
    : ''
  saveSlotsList.innerHTML = own + shared
}
async function fetchSaveSlots(): Promise<SaveArchiveView> {
  try {
    const archive = await listServerSaves()
    const shared = archive.shared.map((slot) => ({ ...slot, source: 'server' as const }))
    saveArchive = archive.account
      ? { own: archive.own.map((slot) => ({ ...slot, source: 'server' as const })), shared, account: archive.account, onServer: true, reachable: true }
      : { own: browserSlots(), shared, account: null, onServer: false, reachable: true }
  } catch {
    saveArchive = { own: browserSlots(), shared: [], account: null, onServer: false, reachable: false }
  }
  return saveArchive
}
async function renderSaveSlots(): Promise<void> {
  const archive = await fetchSaveSlots()
  saveStorageInfo.textContent = saveStorageNote(archive)
  showSaveSlots(archive)
}
async function openSaveSlots(): Promise<void> {
  if (multiplayer.status.mode === 'client') { showToast('Nur der Host kann Spielstände verwalten', true); return }
  saveSlotsMessage.textContent = ''
  saveSlotName.value = ''
  setSaveSlotsPanelOpen(true)
  await renderSaveSlots()
  saveSlotName.focus()
}
saveSlotsPanel.querySelector('[data-close]')!.addEventListener('click', () => setSaveSlotsPanelOpen(false))
saveSlotsPanel.querySelector<HTMLFormElement>('[data-save-slot]')!.addEventListener('submit', async event => {
  event.preventDefault()
  try {
    if (saveArchive.onServer) {
      const saved = await saveServerSave(saveSlotName.value, JSON.stringify(game.snapshot))
      rememberLastSave({ ...saved, source: 'server' })
      saveSlotsMessage.textContent = `Spielstand „${saved.name}“ unter deinem Konto gespeichert`
    } else {
      const result = game.saveSlot(saveSlotName.value)
      saveSlotsMessage.textContent = result.message
      if (!result.ok) return
      rememberBrowserSave(saveSlotName.value)
    }
    saveSlotName.value = ''
    await renderSaveSlots()
  } catch (error) { saveSlotsMessage.textContent = error instanceof Error ? error.message : 'Spielstand konnte nicht gespeichert werden' }
})
/** Reads one slot back, from wherever it came from, and makes it the one to resume. */
async function readSaveSlot(slot: SaveSlotView): Promise<GameState | null> {
  try {
    const loaded = slot.source === 'server' ? GameState.fromJSON((await loadServerSave(slot.id)).snapshot) : GameState.loadSlot(slot.id)
    if (loaded) rememberLastSave(slot)
    return loaded
  } catch {
    return null
  }
}
/** A browser slot has no id until it exists, so it is looked up after the write. */
function rememberBrowserSave(name: string): void {
  const slot = browserSlots().find((entry) => entry.name === name.trim().replace(/\s+/g, ' '))
  if (slot) rememberLastSave(slot)
}

/**
 * The automatic save. It always writes to one slot of its own — never over a save
 * the player named — and that slot is what „Fortsetzen“ then offers. The clock is
 * real time, not festival time, and it only runs while a game is actually being
 * played: not behind the title screen, and not as a multiplayer guest, whose host
 * owns the world anyway.
 */
let autosaveTimer: ReturnType<typeof setInterval> | undefined
let autosaveRunning = false
async function runAutosave(): Promise<void> {
  if (autosaveRunning || titleScreenOpen() || multiplayer.status.mode === 'client') return
  autosaveRunning = true
  try {
    const archive = await fetchSaveSlots()
    const existing = archive.own.find((slot) => slot.name === AUTOSAVE_NAME)
    if (archive.onServer) {
      const saved = await saveServerSave(AUTOSAVE_NAME, JSON.stringify(game.snapshot), existing?.id)
      rememberLastSave({ ...saved, source: 'server' })
    } else {
      const result = game.saveSlot(AUTOSAVE_NAME, existing?.id)
      if (!result.ok) throw new Error(result.message)
      rememberBrowserSave(AUTOSAVE_NAME)
    }
    showToast('Automatisch gespeichert')
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Automatisches Speichern fehlgeschlagen', true)
  } finally {
    autosaveRunning = false
  }
}
const autosaveSelect = requireElement<HTMLSelectElement>('#setting-autosave')
function applyAutosaveInterval(minutes: number): void {
  if (autosaveTimer) clearInterval(autosaveTimer)
  autosaveTimer = minutes > 0 ? setInterval(() => void runAutosave(), minutes * 60_000) : undefined
}
function readAutosaveSetting(): number {
  try {
    const stored = Number(window.localStorage.getItem(AUTOSAVE_KEY))
    return AUTOSAVE_INTERVALS.some((option) => option.minutes === stored) ? stored : AUTOSAVE_DEFAULT_MINUTES
  } catch { return AUTOSAVE_DEFAULT_MINUTES }
}
autosaveSelect.value = String(readAutosaveSetting())
applyAutosaveInterval(Number(autosaveSelect.value))
autosaveSelect.addEventListener('change', () => {
  const minutes = Number(autosaveSelect.value)
  applyAutosaveInterval(minutes)
  try { window.localStorage.setItem(AUTOSAVE_KEY, String(minutes)) } catch { /* then it lasts for this session */ }
  showToast(minutes > 0 ? `Autospeichern: ${AUTOSAVE_INTERVALS.find((option) => option.minutes === minutes)?.label.toLowerCase()}` : 'Autospeichern aus')
})
saveSlotsPanel.addEventListener('click', async event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-load-slot],[data-overwrite-slot],[data-share-slot],[data-delete-slot]')
  if (!button) return
  const id = button.dataset.loadSlot ?? button.dataset.overwriteSlot ?? button.dataset.shareSlot ?? button.dataset.deleteSlot!
  if (button.dataset.loadSlot) {
    const slot = findSaveSlot(id)
    const loaded = slot ? await readSaveSlot(slot) : null
    if (!slot || !loaded) { saveSlotsMessage.textContent = 'Dieser Spielstand ist ungültig oder nicht mehr vorhanden.'; renderSaveSlots(); return }
    const foreign = !saveArchive.own.some((own) => own.id === id)
    bindLoadedGame(loaded, foreign ? `Öffentlicher Spielstand von ${slot.owner} geladen` : 'Spielstand geladen')
    setSaveSlotsPanelOpen(false)
    return
  }
  // Overwriting, sharing and deleting are offered on your own rows only, so an id
  // from anywhere else is simply not there.
  const slot = saveArchive.own.find((item) => item.id === id)
  if (!slot) { renderSaveSlots(); return }
  if (button.dataset.overwriteSlot) {
    try {
      if (slot.source === 'server') await saveServerSave(slot.name, JSON.stringify(game.snapshot), id)
      else { const result = game.saveSlot(slot.name, id); if (!result.ok) throw new Error(result.message) }
      rememberLastSave(slot)
      saveSlotsMessage.textContent = `Spielstand „${slot.name}“ überschrieben`
      await renderSaveSlots()
    } catch (error) { saveSlotsMessage.textContent = error instanceof Error ? error.message : 'Spielstand konnte nicht überschrieben werden' }
    return
  }
  if (button.dataset.shareSlot) {
    try {
      const updated = await shareServerSave(id, !slot.public)
      saveSlotsMessage.textContent = updated.public
        ? `Spielstand „${slot.name}“ ist jetzt öffentlich — andere können ihn laden, aber nicht überschreiben.`
        : `Spielstand „${slot.name}“ ist wieder privat`
      await renderSaveSlots()
    } catch (error) { saveSlotsMessage.textContent = error instanceof Error ? error.message : 'Sichtbarkeit konnte nicht geändert werden' }
    return
  }
  if (!window.confirm(`Spielstand „${slot.name}“ wirklich löschen?`)) return
  try {
    if (slot.source === 'server') await deleteServerSave(id)
    else { const result = GameState.deleteSaveSlot(id); if (!result.ok) throw new Error(result.message) }
    saveSlotsMessage.textContent = 'Spielstand gelöscht'
    await renderSaveSlots()
  } catch (error) { saveSlotsMessage.textContent = error instanceof Error ? error.message : 'Spielstand konnte nicht gelöscht werden' }
})
document.querySelector<HTMLButtonElement>('#save-slots')?.addEventListener('click', openSaveSlots)

const saveAsPanel = requireElement<HTMLElement>('#save-as-panel')
const saveAsList = saveAsPanel.querySelector<HTMLElement>('[data-save-as-list]')!
const saveAsMessage = saveAsPanel.querySelector<HTMLElement>('[data-save-as-message]')!
const saveAsStorageInfo = saveAsPanel.querySelector<HTMLElement>('[data-save-as-storage]')!
const saveAsName = saveAsPanel.querySelector<HTMLInputElement>('[name=name]')!
let saveAsPausedSpeed = 0
function setSaveAsPanelOpen(open: boolean): void {
  saveAsPanel.hidden = !open
  if (open) {
    saveAsPausedSpeed = game.snapshot.speed
    if (saveAsPausedSpeed !== 0) game.setSpeed(0)
  } else if (saveAsPausedSpeed !== 0) {
    game.setSpeed(saveAsPausedSpeed)
  }
}
/**
 * Only your own saves are listed here: this window overwrites, and that is the one
 * thing a public save of someone else's never allows.
 */
async function renderSaveAsSlots(): Promise<void> {
  const archive = await fetchSaveSlots()
  saveAsStorageInfo.textContent = saveStorageNote(archive)
  saveAsList.innerHTML = archive.own.length
    ? archive.own.map((slot) => `<article data-slot="${slot.id}"><div><strong>${escapeHtml(slot.name)}</strong><small>${formatSaveTime(slot.savedAt)}${slot.public ? ' · öffentlich' : ''}</small></div><div><button data-overwrite-slot="${slot.id}">Überschreiben</button></div></article>`).join('')
    : `<p class="save-slots-empty">Noch keine benannten Spielstände ${archive.onServer ? 'unter deinem Konto' : 'in diesem Browser'}.</p>`
}
async function openSaveAs(): Promise<void> {
  if (multiplayer.status.mode === 'client') { showToast('Nur der Host kann Spielstände verwalten', true); return }
  saveAsMessage.textContent = ''
  saveAsName.value = ''
  setSaveAsPanelOpen(true)
  await renderSaveAsSlots()
  saveAsName.focus()
}
requireElement<HTMLButtonElement>('#close-save-as').addEventListener('click', () => setSaveAsPanelOpen(false))
makeDraggable(saveAsPanel.querySelector<HTMLElement>('.panel-header')!, saveAsPanel)
makeResizable(saveAsPanel)
saveAsPanel.querySelector<HTMLFormElement>('[data-save-as]')!.addEventListener('submit', async event => {
  event.preventDefault()
  try {
    if (saveArchive.onServer) {
      const saved = await saveServerSave(saveAsName.value, JSON.stringify(game.snapshot))
      rememberLastSave({ ...saved, source: 'server' })
      saveAsMessage.textContent = `Spielstand „${saved.name}“ unter deinem Konto gespeichert`
    } else {
      const result = game.saveSlot(saveAsName.value)
      saveAsMessage.textContent = result.message
      if (!result.ok) return
      rememberBrowserSave(saveAsName.value)
    }
    saveAsName.value = ''
    await renderSaveAsSlots()
  } catch (error) { saveAsMessage.textContent = error instanceof Error ? error.message : 'Spielstand konnte nicht gespeichert werden' }
})
saveAsPanel.addEventListener('click', async event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-overwrite-slot]'); if (!button) return
  const id = button.dataset.overwriteSlot!
  const slot = saveArchive.own.find((item) => item.id === id)
  if (!slot) { renderSaveAsSlots(); return }
  try {
    if (slot.source === 'server') await saveServerSave(slot.name, JSON.stringify(game.snapshot), id)
    else { const result = game.saveSlot(slot.name, id); if (!result.ok) throw new Error(result.message) }
    rememberLastSave(slot)
    saveAsMessage.textContent = `Spielstand „${slot.name}“ überschrieben`
    await renderSaveAsSlots()
  } catch (error) { saveAsMessage.textContent = error instanceof Error ? error.message : 'Spielstand konnte nicht überschrieben werden' }
})
document.querySelector<HTMLButtonElement>('#save-as')?.addEventListener('click', openSaveAs)

const saveTextDialog = document.createElement('dialog')
saveTextDialog.className = 'save-text-dialog'
saveTextDialog.innerHTML = `<h2>Spielstand als Text</h2><p>Base64-Text kopieren oder einen erhaltenen Spielstand einfügen.</p><textarea aria-label="Base64-Spielstand" spellcheck="false"></textarea><p class="save-text-error" role="alert"></p><div><button data-import>Spielstand laden</button><button data-close>Schließen</button></div>`
document.body.append(saveTextDialog)
const saveTextArea = saveTextDialog.querySelector('textarea')!
const saveTextError = saveTextDialog.querySelector('.save-text-error')!
const saveTextImport = saveTextDialog.querySelector<HTMLButtonElement>('[data-import]')!
function openSaveText(text: string, importing: boolean): void {
  saveTextArea.value = text
  saveTextArea.readOnly = !importing
  saveTextImport.hidden = !importing
  saveTextError.textContent = ''
  saveTextDialog.showModal()
  saveTextArea.focus()
  if (!importing) saveTextArea.select()
}
saveTextDialog.querySelector('[data-close]')!.addEventListener('click', () => saveTextDialog.close())
document.querySelector('#copy-save')!.addEventListener('click', async () => {
  const text = encodeSaveText(JSON.stringify(game.snapshot))
  try {
    await navigator.clipboard.writeText(text)
    showToast('Base64-Spielstand in die Zwischenablage kopiert')
  } catch {
    openSaveText(text, false)
    showToast('Text mit Strg+C kopieren')
  }
})
document.querySelector('#paste-save')!.addEventListener('click', () => {
  if (multiplayer.status.mode === 'client') { showToast('Nur der Host kann einen Spielstand laden', true); return }
  openSaveText('', true)
  // Manual paste works without clipboard permissions in every browser.
})
saveTextImport.addEventListener('click', () => {
  if (multiplayer.status.mode === 'client') { saveTextError.textContent = 'Nur der Host kann einen Spielstand laden'; return }
  try {
    const loaded = GameState.fromJSON(decodeSaveText(saveTextArea.value))
    if (!loaded) throw new Error('invalid save')
    if (pathWindowOpen) closePathEditor()
    bindGameState(loaded)
    fillScenarioForm(loaded.snapshot.scenario)
    saveTextDialog.close()
    showToast('Spielstand aus Base64 geladen')
  } catch {
    saveTextError.textContent = 'Ungültiger oder unvollständiger Base64-Spielstand.'
  }
})

toggleParkButton.addEventListener('click', () => {
  const result = game.setParkOpen(!game.snapshot.parkOpen)
  showToast(result.message)
})

document.querySelector<HTMLButtonElement>('#close-visitor')?.addEventListener('click', () => {
  hideVisitorPanel()
})

followVisitorButton.addEventListener('click', () => {
  if (!selectedVisitorId) return
  followedVisitorId =
    followedVisitorId === selectedVisitorId ? null : selectedVisitorId
  view.followVisitor(followedVisitorId)
  updateVisitorPanel()
})

document.querySelector<HTMLButtonElement>('#close-entity')?.addEventListener('click', () => {
  closeEntityPanel()
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
  if (titleScreenOpen()) return
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
    else game.rotateBuild()
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
  rotateBuilding: () => { if (pathEditorActive) rotatePathDirection(1); else game.rotateBuild() },
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
let measurementStart = performance.now()
let measuredFrames = 0
let measuredTicks = 0
let measuredSimulationMs = 0
let measuredViewMs = 0
let measuredRenderMs = 0
document.addEventListener('visibilitychange', () => {
  measurementStart = performance.now()
  measuredFrames = 0
  measuredTicks = 0
  measuredSimulationMs = measuredViewMs = measuredRenderMs = 0
})
let previousTime = performance.now()
// Hidden tabs stop animation frames; keep the authoritative host responsive.
window.setInterval(() => {
  if (!document.hidden || multiplayer.status.mode !== 'host') return
  game.tick(0.1)
  multiplayer.tick(0.1)
}, 100)
function animate(time: number): void {
  // A transient rendering error must not permanently stop simulation/network updates.
  requestAnimationFrame(animate)
  const deltaSeconds = Math.min((time - previousTime) / 1000, 0.1)
  previousTime = time
  const simulationStart = performance.now()
  const ticksBefore = game.executedLogicTicks
  game.tick(deltaSeconds)
  measuredTicks += game.executedLogicTicks - ticksBefore
  multiplayer.tick(deltaSeconds)
  const viewStart = performance.now()
  measuredSimulationMs += viewStart - simulationStart
  view.update(game.snapshot, game.renderAlpha, game.worldRevision)
  view.advanceWalk(deltaSeconds)
  const renderStart = performance.now()
  measuredViewMs += renderStart - viewStart
  view.render()
  measuredRenderMs += performance.now() - renderStart
  measuredFrames += 1
  const elapsed = time - measurementStart
  if (elapsed >= 1000) {
    performanceIndicator.textContent = `${versionLabel}\nFPS ${(measuredFrames * 1000 / elapsed).toFixed(0)} · TPS ${(measuredTicks * 1000 / elapsed).toFixed(1)}`
    performanceIndicator.textContent += `
Sim ${(measuredSimulationMs / measuredFrames).toFixed(1)} · Szene ${(measuredViewMs / measuredFrames).toFixed(1)} · Render ${(measuredRenderMs / measuredFrames).toFixed(1)} ms`
    measuredSimulationMs = measuredViewMs = measuredRenderMs = 0
    measuredFrames = 0
    measuredTicks = 0
    measurementStart = time
  }
}
requestAnimationFrame(animate)

function formatMoney(value: number): string {
  return `${Math.floor(value).toLocaleString('de-DE')} €`
}

function formatTime(minute: number): string {
  const hours = Math.floor(minute / 60)
  const minutes = Math.floor(minute % 60)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

// The game opens on its title screen. Last thing in the module, so everything it can
// reach — the scenario form, the save management — has been built by the time it shows.
setTitleScreenOpen(true)

// Who the session cookie belongs to. Asked once, after everything is wired, and the
// account bar redraws itself when the answer arrives.
void refreshAccount().then(() => syncAccountBar())
