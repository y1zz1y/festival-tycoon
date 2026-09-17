# Wegsuche, Navigation und Gedränge

Besucher, Personal und Träger nutzen denselben gewichteten A* und denselben
Fußgänger-Navigationsgraphen. Viele austauschbare Ziele gehören in **eine**
Multi-Goal-Suche, nicht in ein A* pro Zelt / Treffpunkt / Gebäude.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Generischer A* | `src/game/pathfinding.ts` | `findWeightedPath`, `createPathScratch` |
| Fußgänger-Graph, Cache, `findPath` | `src/game/GameState.ts` | `ensurePedestrianNav`, `findPath`, `worldRevision` |
| Hecke / Zaun / Wand im Fußgraphen | `src/game/scenery.ts` | `isPedestrianBarrierKind`, `pedestrianBarrierOccupancy` (`fenceMask` / `NAV_SOLID`) |
| Crowd-Kosten und Belegung | `src/game/crowding.ts` | Crowd-Index, Kosten |
| Gerichtete Wege / Queues | `src/game/pathFlow.ts`, `src/game/queueLanes.ts`, `GameState.recalculateQueueDirections` | `allowsPathFlow`, Queue-Kette, Stand-Spuren |
| Weg-Darstellung | `src/view/PathFlowView.ts` | Bodenmarkierungen |
| Straßen-Graph (Fahrzeuge) | `src/game/logistics.ts` | `createRoadGraph`, `findRoadRoute`; Nachbarn nur bei passender Kantenhöhe / Rampe |
| Rampen / Halbstufen / Klippen | `src/game/wayElevation.ts`, `src/game/terrain.ts` | `canTraverseWayElevation`, `wayEdgeHeights`, `waySurfaceYAt`, `canStepPedestrianHeight`, `terrainWalkEdgeHeights`, `sampleTerrainSurface` |
| Ampeln / Wegschranken | `src/game/accessControl.ts` | `closedAccessEdges`, `accessEdgeKey` |
| Personaleingang-Kante | `src/game/accessControl.ts` | `staffGateBlocksVisitor`, `staffGateDirection` |
| Camping-Multi-Goal | `src/game/camping.ts` | `CampingSystem.findRouteToGathering` |
| Wegtypen und Anforderungen | `src/game/wayTypes.ts` | `WAY_TYPES`, `wayInfo`, `wayIssue` |
| Balancing | `src/game/simulationConfig.ts` | `pathfinding`, `crowding`, `queues` |

## Wichtige Regeln

- Straßen-Ausfahrten ohne Belegungssperren haben einen graphgebundenen Cache in
  `findReachableRoadExit` (Suchkern: `searchReachableRoadExit`). Maximal acht
  Einträge je Straßenlage: vier Start-Fahrtrichtungen × zwei U-Turn-Regeln.
  Vollständig erfolglose Suchen dürfen bis zur nächsten Graphänderung bleiben;
  diese Suche hat kein Abbruchbudget. Dynamische Sperrzellen umgehen den Cache.
  Der Cache ist abgeleitet, wird nicht gespeichert und beeinflusst keine Tick-Zeitplanung.

- Topology- und Zugangsänderungen (`worldRevision`) invalidieren Navigation
  sofort. Neue Weg- oder Straßenrampen gehören dazu (`placePath` / `placeRoad`).
  Ein Fußweg auf einer Autostraße bleibt ein gemeinsames Feld (`NAV_PATH` und
  `NAV_ROAD`, Kosten wie Pflaster); die Straße wird nicht entfernt.
  Parkbuchten (`NAV_PARKING` ohne Weg) sind keine Fußgänger-Kanten:
  Gäste laufen nach dem Aussteigen auf dem Nachbarweg, nicht durch die
  Bucht oder als Abkürzung über den Stellplatz.
  Der Straßengraph speichert Lagen mit `roadLayerKey` (`x:z:Höhe`); zwei
  Straßen auf einer Kachel verbinden sich nur bei passender Kantenhöhe.
- `packCell` kodiert Höhen in Halbstufen (`elevation * 2`), damit 0.5 und 1.0
  nicht kollidieren. Alte volle Stufen (`pathSlope` ±1) bleiben begehbar.
- Fußkanten sind nur begehbar, wenn die **gemeinsame Kante** ohne Klippe
  zusammenpasst (`wayEdgeHeights` / `terrainWalkEdgeHeights`). Rohgelände:
  höchstens **0,5** (sichtbarer Hang); Δ **1,0** ist eine Steinklippe und
  gesperrt. Wege brauchen eine echte Rampe (`canTraverseWayElevation`). Gras
  neben einem 1,0-Weg ohne Rampe ist keine Abkürzung — die Route folgt der
  Weg-Kette. Geländedits erhöhen `worldRevision` und bauen den Fußgraphen
  sofort neu. Bewegung liest Y aus Wegsamples (`waySurfaceYAt`) bzw. dem
  Gelände-Dreieck (`sampleTerrainSurface`), statt an Kachelgrenzen zu springen.
- Crowd-Kosten ändern sich häufiger: gecachte Routen **gestaffelt** nach
  30–59 Ticks verfallen lassen. Nicht den ganzen Cache bei jedem Crowd-Update
  oder bei Cap leeren; bei Cap eine Eintrag entfernen.
- Ein budgetbegrenzter Miss ist **kein** Beweis für Unerreichbarkeit; den
  Reachability-Cache nicht damit vergiften.
- `findPath` erkennt vor A*, wenn alle Zielknoten fehlen oder wegen fester
  Zugangsflags unbetretbar sind (Solid/Medizin/Vorplatz; Legacy-Personaleingang
  ohne Richtung; Wasser nur für Personal). Gerichtete Personaleingänge
  bleiben als Ziel betretbar. Gäste dürfen `NAV_WATER` ohne Weg betreten, zahlen aber
  `terrain.swimPathCostMultiplier`. Start=Ziel bleibt erlaubt. Die
  ursprüngliche Zielliste für Heuristik und Cache-Reihenfolge bleibt
  erhalten; andere Ziele werden normal gewichtet gesucht.
- Hecken, die Kategorie **Zaun** und Wandsegmente (`wall*`, außer `*Door`)
  belegen denselben Fußgraphen. Kantenstücke (`decorationSlot` 0–3, klassischer
  `fence` über `rotation`) sperren nur diese Kante; Legacy ohne Slot oder Slot 4
  sperrt das ganze Feld (`NAV_SOLID`). `*Door` bleibt begehbar und verbindet
  beide Seiten. Personaleingang (`staffGate`) ist kantenbasiert: neue Tore
  speichern `staffGateDirection` (0–3, Ausgangskante / bemalte Richtung) am
  Fußweg mit `staffOnly` und sperren nur diese gerichtete Kante für Gäste.
  Entgegen der Markierung dürfen Gäste das Feld weiter betreten und die
  anderen drei Seiten queren; die Kachel wird nicht `NAV_SOLID`. Personal,
  Band-Akteure über Personaleingang und Saugroboter (`allowStaff`) queren
  die Kante in beide Richtungen. Fehlendes `staffGateDirection` bleibt
  Legacy: Gäste dürfen die ganze Kachel nicht betreten. Sicherheitsschleusen
  bleiben ein eigenes System.
  Fahrzeuge bleiben auf dem Straßengraphen. `place` / Abriss erhöht
  `worldRevision` und baut den Fußgraphen beim nächsten `findPath` neu.
- Camping-Ausweisungen sind keine Wände: Nach dem normalen Weg-Pass darf die
  Wegsuche ausgewiesenen Campingboden als Fallback queren. Wege bleiben durch
  ihre niedrigeren Oberflächenkosten bevorzugt; Gelände-, Gedränge- und
  Zugangskosten gelten weiter. Feste Objekte bleiben blockierend.
- Abreise-, Ausgangs- und Müllentscheidungen benutzen dieselbe faire Budgetqueue
  wie normale Besucherziele, auch aus direkten Callbacks; siehe `simulation.md`.
- Volle Wege-Scans nicht in Besucher-/Camp-/Staff-Schleifen nesten. Indizes
  einmal pro Pass bauen, Reservierungen inkrementell führen.
- Terrain, Crowding, Staff-/Last-Penalties und Alternativrouten müssen
  funktionsfähig bleiben. Benchmarks nicht durch Einfrieren von Besuchern
  oder Abschalten von Effekten schönen.
- `findRouteToGathering` ist regressionskritisch (335 Installationen in rtest3).
- Saugreiniger nutzen denselben Fußgraphen (`allowFestival` und
  `allowStaff`), dürfen aber nur `isSweeperDriveCell` betreten — inklusive
  Bühnenvorplatz ohne Weg und `staffOnly`-Personaleingang. Gerichtete
  Personaleingänge sperren Gäste ohne `allowStaff` nur in der bemalten
  Richtung; Legacy ohne Richtung sperrt weiter die ganze Kachel.
  Aktives Backstage (`NAV_BACKSTAGE`) ist für Personal, Band-Akteure und
  Fans mit Intrusionsflag begehbar; normale Gäste nutzen es nicht als
  Abkürzung. Fan-Einstieg ist eine budgetierte Multi-Goal-Suche.
- Warteschlangen sind eine eindeutige Kette (Bau-Reihenfolge ab dem
  Stand/Eingang). `canTraversePath` erlaubt Vorwärts- und Rückwärtsgehen
  nur entlang dieser Kette, nicht über räumlich benachbarte Serpentinen-
  Segmente. Dies gilt auch für Boden-Links im Fußgraphen, nicht nur für
  explizite Weg-Kanten. Ohne `allowQueue` darf, wer schon auf einer Queue
  steht, nur rückwärts zum Eingang und dort auf den normalen Weg.
- Queue-Zielreservierungen zählen sofort zur Kapazität, werden für die
  physische Aufstellung aber per stabiler O(n)-Partition hinter bereits
  angekommenen Gästen gehalten. Eine weit entfernte Reservierung darf das
  Nachrücken auf freien Queue-Plätzen nicht blockieren.
- Stand-Queues (`food` / `alcohol` / `toilet` / `mascot` / `shirt`) teilen jede Kachel senkrecht
  zur Laufrichtung hälftig: links **Anstehschlange**, rechts
  **Zurückschlange** (Blick mit `queueDirection` zur Theke). Dieselbe
  gebaute Kette, zwei Spuren. `queueSplit` wird in
  `recalculateQueueDirections` gesetzt; alte Saves ohne das Feld werden
  beim Laden so markiert. Bewegungsbelegung zählt die Spuren getrennt,
  damit Gegenverkehr sich nicht gegenseitig staut. Die Zurückschlange
  nutzt volle Gehgeschwindigkeit und keine Belegungsbremse; nach dem
  letzten Queue-Feld folgt sofort die nächste Zielwahl (kein Budget-Stau).
  Attraktions- und Bühnenqueues bleiben eine Spur. Balancing:
  `SIMULATION_CONFIG.queues`.
- Geschlossene Ampeln/Tore sind gerichtete Kanten (`x:z:direction`).
  Rote Ampeln sperren Einfahrt (Zelle davor → Ampel) und Ausfahrt.
  Offene Einweg-Tore sperren nur die Gegenkante. Notfallöffnung
  (`openInEmergency`) entfernt alle Tor-Kanten. Fußwege prüfen
  `closedPathEdges` in Nachbarn und `isPedestrianEdgeBlocked`. Der
  Fuß-Cache-Key enthält `accessSignalRevision`; Cache nur leeren, wenn
  ein Signal kippt.
  Straßenrouten versuchen zuerst, rote Ampelkanten zu meiden
  (`routePreferringOpenLights`); sonst fährt das Fahrzeug hin und wartet
  vor der Ampel. Alle Straßenfahrzeuge teilen `rerouteAwayFromRedLight`
  und `collectVehicleRouteTargets`. Parkbuchten zählen nur Zufahrten
  ohne Trennlinien-Sperre (`getParkingApproachRoads`).

Der Straßengraph prüft Pfeile auch an der Zielkachel: kein Einfahren
entgegen einer Einbahn aus einer ungerichteten Kreuzung. Seitliche Einfahrten
bleiben möglich. Dieselbe Nachbarschaft gilt für Ausweich- und
Rücksetzbewegungen sowie bestehende Fahrzeugrouten.

## Tests

`tests/performanceGuards.ts` (Budget, eine Suche für viele Camp-Ziele,
Crowd-Expiry, Bau-Invalidierung). `tests/supplyChain.ts` (Umwege nach
Cache-Expiry). `tests/regression.ts` (Wegschlüssel inkl. Höhe `0`; Abreise
eines von Camping-Ausweisungen eingeschlossenen Besuchers nach Festivalende).
`tests/wayElevation.ts` (Halbstufen, Fuß- und Straßenrampen, Legacy-Volleinheit,
Fußweg-Kreuzung behält die Autostraße; Klippe 0→1 blockiert, 0,5-Hang und
Weg-Rampe begehbar, Bewegung folgt den Wegkacheln ohne Y-Warp). `tests/operations.ts` (nach dem
Aussteigen laufen Gäste vom Nachbarweg zum Ziel, nicht in die Parkbucht;
Abreise sucht die Gehweg-Türen in einer Multi-Goal-Suche).
`tests/accessControl.ts` (rote Ampel, geschlossene Schranke, Umparken,
Liefer- und Müllwagen-Umweg). `tests/operations.ts` (Queue-Kette ohne
Shortcuts, Rückwärtsgehen, Stand-Spuren, Saugroboter durch `staffOnly`).
`tests/queueLanes.ts` (Geometrie
der hälftigen Stand-Spuren).
Wasser für Gäste, Invalidierung nach Geländedit und Klippen-Nav: `tests/terrainLand.ts`.
`tests/pedestrianBarriers.ts` (Hecke/Wand/Zaun sperren, Wandtür passierbar,
Vollfeld vs. Kante, Nav-Invalidierung bei Setzen/Abriss).
`tests/operations.ts` / `tests/accessControl.ts` (Personaleingang: bemalte
Kante statt Vollfeld, Gäste quer / Staff durch, Legacy-Mitte).

## Bei Änderungen dieses Dokument

Aktualisieren, wenn sich Cache-Politik, Nav-Flags, Multi-Goal-Einstiege,
Crowd-Update-Intervall oder ein neues bewegliches System mit eigener Suche
ändert. Neue Nav-Layer (z. B. ein weiterer `NAV_*`-Typ) hier eintragen.
