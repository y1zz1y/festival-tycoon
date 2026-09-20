# Gesamtarchitektur

Die Simulation kennt Three.js nicht. `GameState` ist die einzige autoritative
Quelle für Spielregeln, Zeit und Wirtschaft. Die Ansicht interpoliert nur.
Netzwerk-Clients mutieren die Welt nicht lokal dauerhaft; der Host entscheidet.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Spielzustand und Fassade | `src/game/GameState.ts` | `GameState`; behält öffentliche Methoden und re-exportiert Snapshot-Typen kompatibel |
| Besucher-Orchestrierung | `src/game/visitorSimulation.ts` | `VisitorSimulation`, `VisitorSimulationContext`; Tick-Phase und faire Routingqueue |
| Besucher-Detailverhalten | `src/game/visitorBehavior.ts` | `VisitorBehaviorService`, `VisitorBehaviorContext`; Bewegung, Ziele, Interaktionen, Needs und Laufzeit-Caches |
| Besucher-Spawn / Gedränge | `src/game/visitorSpawning.ts`, `src/game/visitorCrowdingSimulation.ts` | Ankunftsgruppen und Admission; Crowd-/Motivations-/Panikpass |
| Platzierungsservice | `src/game/placementService.ts` | Weg-/Straßenvalidierung, Undo und konkrete Abrissmutationen |
| Achterbahn-Tick | `src/game/coasterSimulation.ts` | Dispatch, Queue, Physik, Telemetrie, Recall und Ausstieg |
| Bau-/Abriss-/Schienencommands | `src/game/commands/*.ts` | Callback-Kontexte für Platzierung, Abriss und Coaster-Schienenmutationen |
| Fußgänger-Navigation | `src/game/pedestrianNavigation.ts` | `PedestrianNavigation`; Graph, Cache, A*-Suche hinter Callback-Kontext |
| Logistik-Simulation | `src/game/logisticsSimulation.ts`, `src/game/roadVehicleSimulation.ts` | Tick-Orchestrierung und gemeinsame Tick-Indizes; Straßenfahrzeug-State-Machines, Dispatch, Rückkehr und Leg-Abschluss hinter schmalem Callback-Kontext |
| Entity-Strukturen | `src/game/types/entities.ts` | `Cell`, `PlacedBuilding`, `Visitor`, `CashEffect` |
| Snapshot-Strukturen | `src/game/types/snapshot.ts` | `GameSnapshot`, `SimTurn`, `ActionResult`, `LocalSaveSlot` |
| Neue/blanke Snapshots | `src/game/snapshotBootstrap.ts` | `createBlankSnapshot`, `createInitialSnapshot` |
| Versionierte Lade-Migration | `src/game/snapshotMigration.ts` | `migrateSnapshot` |
| Laufzeit-Reparatur geladener Snapshots | `src/game/snapshotRepair.ts` | Normalisierung von Entities und abgeleiteten Reservierungen/Indizes |
| Bandversorgung / Backstage | `src/game/bandSupply.ts`, `src/game/bandActors.ts`, `src/game/bandLooks.ts` | Graph, Stats, Tourbus / Personaleingang, Bühnen-/Backstage-Kostüm |
| Balancing (Tempo, Kosten, Wahrscheinlichkeiten) | `src/game/simulationConfig.ts` | `SIMULATION_CONFIG` |
| Gebäudetypen, Tools, Anzeigedaten | `src/game/catalog.ts` | `BUILDING_KINDS`, `BUILDINGS`, `Tool` (`copy`) |
| Kopiervorlagen | `src/game/blueprints.ts`, `src/game/blueprintLibrary.ts` | Capture/Stempel; Browser-Bibliothek, kein Snapshot |
| Themen-Deko | `src/game/decoration.ts` | Katalogfilter, keine Snapshot-Felder |
| Spielerbefehl → Methode | `src/net/commands.ts` | `applyGameCommand` |
| Befehls- und Delta-Typen | `src/net/protocol.ts` | `GameCommand`, Snapshots |
| Command-Metadaten | `src/net/commandRegistry.ts` | vollständige Optimistic-Klassifikation |
| UI-Bootstrap / Systemverkabelung | `src/main.ts` | Controller erzeugen, Event-Binding, Tool-Leiste |
| App-Schleife | `src/app/gameLoop.ts` | Renderframes und Hidden-Tab-Hosttick über injizierte Schnittstellen |
| Eingaberouting | `src/input/toolRouter.ts` | Direkte Zellwerkzeuge über die öffentliche `GameState`-Fassade |
| UI-Controller / Differential-Updates | `src/ui/*.ts` | Baukatalog, Spielstandarchiv, Fingerprint-Gates |
| Flächenwerkzeug-Vertrag | `src/ui/areaDesignation.ts` | normalisiertes Rechteck, Preview/Execute |
| HEADLINE Magazin (abgeleitet) | `src/game/headlineMagazine.ts` | `buildHeadlineMagazine` aus Snapshot, kein neues Feld |
| 3D-Szene | `src/view/WorldView.ts` | Kamera, Picking, Instancing |
| Festival-SFX | `src/game/audio.ts`, `src/view/FestivalAudio.ts` | Kamera-Listener, Pools; siehe [audio.md](audio.md) |
| Host-HTTP/WebSocket | `server/serve.ts` | Dev- und Docker-Server |
| Mehrspieler-Räume | `server/rooms.ts` | `attachMultiplayer` |

Fachlogik liegt in eigenen Modulen unter `src/game/` und wird von `GameState`
aufgerufen. Views unter `src/view/` lesen den Snapshot und dürfen ihn nicht
autoritativ ändern.

Der finale Extraktionsstand 0.1.176 reduziert `GameState.ts` von 10.218 auf
8.247 Zeilen (kumulative Ausgangsbasis: 17.252); `main.ts` bleibt
bei etwa 4.497 Zeilen. Die neuen primären Grenzen sind `visitorBehavior.ts`,
`visitorSimulation.ts`,
`visitorSpawning.ts`, `visitorCrowdingSimulation.ts`, `coasterSimulation.ts`,
`placementService.ts`, `snapshotRepair.ts`,
`logisticsSimulation.ts`, `roadVehicleSimulation.ts`, `pedestrianNavigation.ts`, `snapshotBootstrap.ts`,
`snapshotMigration.ts`, `commands/*.ts`, `app/gameLoop.ts`,
`input/toolRouter.ts`, `input/cellToolHandlers.ts`,
`input/pathToolController.ts`, `net/commandRegistry.ts`, `app/shell.ts`,
`ui/titleScreen.ts`, `ui/scenarioScreen.ts`, `ui/saveController.ts`,
`ui/entityPanel.ts`, `ui/coasterBuilderPanel.ts`, `ui/contextHelp.ts`,
`ui/visitorPanel.ts` und die übrigen `ui/*.ts`. Produktion und
Regression-Suite kompilieren gemeinsam; die extrahierten Fachmodule importieren
weder `GameState` noch `main.ts` zurück.

`GameState` bleibt Fassade für bestehende Aufrufer und Tests. Navigation,
Logistik, Besucher-Orchestrierung, Besucher-Detailverhalten und Command-Services importieren keinen
konkreten `GameState`; Entity-/Snapshot-Typen kommen aus `src/game/types`, und
schmale Kontexte liefern nur die benötigten Abfragen und Mutations-Callbacks.
Damit entstehen keine Rückimporte in die Fassade.

`roadVehicleSimulation.ts` besitzt die gemeinsame Straßenbewegung sowie die
typspezifischen Ambulanz-, Linienbus-, Müllwagen-, Lieferwagen- und
Besucherauto-Abläufe. Tourbus-Callbacks bleiben bei der Bandversorgung,
Saugreiniger nutzen weiterhin ausschließlich den Fußgängergraphen. Die
Träger-State-Machine bleibt separat.

`main.ts` bleibt Composition Root und koordiniert übergeordnete Editor-Modi.
Statisches DOM, Titel-/Szenario-/Save-Flows und Panel-Präsentation greifen über
injizierte Kontexte auf die jeweils aktuelle Fassade zu; sie importieren keine
veränderlichen Globals aus `main.ts`.
`app/gameLoop.ts` kennt nur schmale Game-/View-/Audio-Verträge.
`input/toolRouter.ts` bekommt die aktuelle `GameState`-Fassade explizit und
greift auf keinen globalen Singleton zu. `ui/` enthält DOM-nahe Controller und
pure Archiv-/Fingerprint-Helfer; fachliche Simulation bleibt außerhalb.

`visitorBehavior.ts` bündelt die zuvor in der Fassade liegenden Bewegungs-,
Ankunfts-, Zielwahl-, Konzert-, Shop-, Camping-, Schwimm-, Müll-, Interaktions-
und Needs-Körper. Seine Caches sind nicht persistent; Tick-Reihenfolge,
Entscheidungsbudget und Snapshot-Schema bleiben unverändert.

`snapshotMigration.ts` normalisiert die sichere JSON-Hülle.
`snapshotRepair.ts` führt danach die deterministische Laufzeit-Reparatur über
einen schmalen Callback-Kontext aus; es importiert keinen konkreten `GameState`.

## Schichten

```
UI (main.ts, *UI.ts)  →  GameCommand  →  GameState.gate / Host
                                              ↓
                                    festen 100-ms-Tick
                                              ↓
                         game/* Systeme (Pfad, Camp, Staff, …)
                                              ↓
                         GameSnapshot  →  WorldView / Overlays / FestivalAudio
```

Spieleraktionen gehen als `GameCommand` durch `GameState.gate`. Im Host-Modus
werden sie verzögert und in `SimTurn`s committed. Die Darstellung hängt am
Snapshot und interpoliert zwischen Ticks.

## Wichtige Regeln

- Spielzustand nur in der Simulation mutieren, nie aus Render-Frames.
- Neue persistente Felder gehören in `GameSnapshot` und müssen normalisiert,
  gespeichert und über den Host synchronisiert werden.
- Neue Befehle brauchen einen `GameCommand`-Typ, einen Zweig in
  `applyGameCommand` und eine `GameState`-Methode mit `ActionResult`.
- Geometrie, IDs und Texte bleiben in Fachmodulen; Zahlen, die Tempo oder
  Stärke steuern, gehören nach `simulationConfig.ts`.
- Docker-Image enthält nur `server/` + `dist/` (kein `src/`). Keine
  Value-Imports von `server/` nach `src/`; `import type` ist ok. Kanonisch:
  [multiplayer.md](multiplayer.md#docker-laufzeit).

## Tests

`tests/regression.ts` orchestriert die Suite; `tests/snapshotModules.ts` schützt
Bootstrap, Migration und den delegierenden `GameState.fromJSON`-Einstieg.
`scripts/check-docs.mjs` schützt auflösbare Repository-Pfade, die Abdeckung aller
von `tests/regression.ts` importierten Fachsuiten, die Snapshot-Version und die
primären Topic-Zuordnungen der kritischen Extraktionsmodule.
Architektur-Änderungen an Tick,
Commands oder Snapshot treffen fast immer auch `docs/multiplayer.md` und
`docs/saves.md`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn sich Schichten, der Snapshot-Einstieg, der Command-Pfad,
die Rolle von `GameState` / `WorldView` / `main.ts` oder die Docker-/Server-
Importgrenze ändern. Neue Top-Level-Ordner oder ein neues Orchestrierungsmodul
hier eintragen.
