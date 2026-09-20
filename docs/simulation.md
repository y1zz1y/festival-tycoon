# Simulation, Zeit und Determinismus

Die Simulation läuft in festen **100-ms-Ticks** (`SIMULATION_CONFIG.time.tickSeconds`).
Geschwindigkeitsindizes 1 / 2 / 3 bedeuten **1× / 3× / 8×** (mehr Inhalt pro
Tick bzw. mehr Ticks pro Render, nicht eine eigene Kalenderuhr). Die Darstellung
interpoliert nur. Entscheidungen und Zustandsänderungen dürfen nicht an FPS,
`Date.now()` oder `performance.now()` hängen.

Eine **Spielminute** hängt an `SIMULATION_CONFIG.time.normalDayDurationSeconds`
(**20 min** Echtzeit je Spieltag bei 1×, zuvor 10 min). Das sind **8⅓ Ticks**
je Spielminute (`tickSeconds * minutesPerDay / normalDayDurationSeconds` =
0,12 min/Tick). Bewegung, Queues, Fahrzeuge und Ride-Animation nutzen getrennt
`movementDayDurationSeconds` (**10 min**, historisch) über
`movementMinutesPerRealSecond`, damit Tiles pro Tick unverändert bleiben.
Needs, Festivalplan, Einlass und Wirtschaft (`economyIntervalMinutes`) bleiben
an der Kalender-Spielminute.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Tick-Orchestrierung | `src/game/GameState.ts`, `src/game/visitorSimulation.ts`, `src/game/visitorBehavior.ts` | `advanceOne`, `stepFixed`, `simulateFixedStep`; geordnete Phase in `VisitorSimulation`, Details in `VisitorBehaviorService` |
| Besucher-Spawn / Crowd-Pass | `src/game/visitorSpawning.ts`, `src/game/visitorCrowdingSimulation.ts` | Intervall-Ankünfte; Gedränge, Motivation und Panik |
| Achterbahn-Tick | `src/game/coasterSimulation.ts` | Queue, Dispatch, feste Physik-Substeps und Telemetrie |
| Browser-Zeitgeber | `src/app/gameLoop.ts` | `startGameLoop`; RAF-Delta und 100-ms-Hidden-Tab-Hostheartbeat |
| Fußgänger-Navigation | `src/game/pedestrianNavigation.ts` | `PedestrianNavigation` (Graph, Cache, A*) |
| Logistik-Phase | `src/game/logisticsSimulation.ts`, `src/game/roadVehicleSimulation.ts` | `updateLogisticsSimulation`; feste Fahrzeugphase in `RoadVehicleSimulation.processLogisticsVehicles` |
| Tick-/Speed-Werte | `src/game/simulationConfig.ts` | `time` (`normalDayDurationSeconds`, `movementDayDurationSeconds`, `calendarMinutesPerRealSecond`, `movementMinutesPerRealSecond`), `pathfinding.decisionsPerTick` |
| Deterministischer Zufall | `src/game/rng.ts` | `DeterministicRng`, `hashStringSeed` |
| Tagesplan durchsetzen | `src/game/dayPlan.ts` | Angebote, Öffnungszeiten |
| Festival-Tick | `src/game/festivalManagement.ts` | `updateFestival` |
| Waren-Tick | `src/game/supplyChain.ts` | `updateSupplyChain` |
| Host-Turns / Hash | `src/game/GameState.ts` | `hashSim`, `receiveTurn`, `onTurnCommit` |

`simulateFixedStep` bewegt Besucher mit Bewegungsminuten, zählt Kalender-Spielminuten,
spawned Gäste, aktualisiert Festival und Logistik. Die unveränderte Folge Besucher →
Fan-Intrusion → Band-Akteure → Einrichtungen → Besucherfeuerwerk → Achterbahnen
liegt in `VisitorSimulation.runTickPhase` (Kalender- vs. Bewegungsminuten getrennt).
`decisionBudget` wird **pro Tick** aus
`SIMULATION_CONFIG.pathfinding.decisionsPerTick` gesetzt.
Spawn- und Crowd-Akkumulatoren bleiben laufzeitlokal in ihren Services; beide
werden an denselben Stellen der festen Phase aufgerufen. `CoasterSimulation`
erhält Bewegungsminuten (Queues/Boarding) und bewegungsskalierte Physiksekunden
pro Tick; die Festivaluhr läuft getrennt über Kalender-Spielminuten.
Der Browser-Zeitgeber ist aus `main.ts` nach `app/gameLoop.ts` verschoben.
Er reicht weiterhin höchstens 100 ms Frame-Delta an `GameState.tick`; feste
Ticks, Reihenfolge und Multiplayer-Autorität bleiben vollständig in `GameState`.

Die Extraktion der Fußgängernavigation und Logistik ändert diese Reihenfolge
nicht. `GameState` bleibt Tick-Fassade; Fachmodule erhalten ausschließlich
deterministische Snapshot-Daten und Callback-Kontexte.
Auch `VisitorBehaviorService` wird nur aus dieser festen Phase aufgerufen.
Bewegung, Zielwahl und Needs verwenden weiterhin `simTick`, denselben RNG und
das gemeinsame Entscheidungsbudget; seine Caches sind reiner Laufzeitzustand.

Abreise-, Ausgangs- und Müllrouten aus direkten Callbacks teilen ebenfalls dieses
Budget. Die Laufzeitqueues in `VisitorSimulation` ergänzen die FIFO-Besucherqueue um den Auftragstyp;
eine Abreise hat innerhalb desselben Besucherauftrags Vorrang. Verschachtelte
Suchschritte derselben Entscheidung zählen als ein Auftrag. Aktivitäts-/Medizin-
Freigaben und der Abreisestatus werden sofort gesetzt, nur das Ziel wird verzögert
ermittelt. Bewegung, Needs, Zulassungen und Spielzeit laufen unverändert weiter.
Ein Besucher mit noch abzubauendem Camp oder ausstehendem Müll verlässt den Park
erst nach Bearbeitung. Aufträge enthalten nur IDs, keine Snapshot-Referenzen;
Abreisen werden nach Laden aus Besucherzustand, Camp und Müll rekonstruiert.

## Wichtige Regeln

- Speed skaliert Kalender- und Bewegungsminuten gleich, nicht die Tick-Länge.
  Die Kalenderlänge eines Tages setzt nur `normalDayDurationSeconds`.
- Destination-Entscheidungen (inkl. direkte Ankunfts-/Interaktions-Callbacks)
  zählen gegen `decisionsPerTick`. Aufgeschobene Requests müssen fair leeren.
- Dringende Zustandswechsel, Bewegung und Needs laufen **jeden** Tick weiter.
- Deterministische Budgets zählen Arbeit / `simTick`, niemals Wanduhren.
- Profiling-Uhren (`PROFILE_METHODS`) sind nur Diagnose.
- `speed === 0` hält `stepFixed` an. `festival.planning` hält Gäste, Wirtschaft
  und die Festivaluhr an, ruft aber weiter `updateCoastersForCurrentTick` auf,
  damit **Testfahrt** während der Planung (Startzustand neuer Szenarien) den
  Zug bewegt. Eingeplante Commands können in Pause trotzdem über
  `advanceOne(false)` laufen.

## Tests

Frame-Partition und alle Tempostufen: `tests/regression.ts`.
Kalender vs. Bewegung (2× Ticks je Spielminute, unveränderte Wegstrecke
pro Tick, Festivalphasen in Spielstunden): `tests/simulationTime.ts`.
Entscheidungsbudget und Queue-Drainage: `tests/performanceGuards.ts`.
Last: `npm run test:performance -- rtest3 120` — siehe `docs/performance.md`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Tick-Länge, Speed-Indizes, das Mapping Ticks→Spielminute
(`normalDayDurationSeconds` / `movementDayDurationSeconds`), die Reihenfolge in
`simulateFixedStep`, das Entscheidungsbudget oder die Pause-/Planungslogik
ändern. Neue pro-Tick-Systeme in die Tabelle „Wo finden“ aufnehmen.

Auch `setParkOpen(false)` aus UI-/Netzwerk-Commands stellt Abreiseaufträge in
 dieselbe Queue, statt außerhalb eines Simulationsticks für die ganze Menge Wege
zu suchen. In Pause werden die Zustände sofort aktualisiert und die Routen erst
nach Fortsetzen unter dem normalen Budget geplant.
