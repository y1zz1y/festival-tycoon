# Wegsuche, Navigation und Gedränge

Besucher, Personal und Träger nutzen denselben gewichteten A* und denselben
Fußgänger-Navigationsgraphen. Viele austauschbare Ziele gehören in **eine**
Multi-Goal-Suche, nicht in ein A* pro Zelt / Treffpunkt / Gebäude.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Generischer A* | `src/game/pathfinding.ts` | `findWeightedPath`, `createPathScratch` |
| Fußgänger-Graph, Cache, `findPath` | `src/game/GameState.ts` | `ensurePedestrianNav`, `findPath`, `worldRevision` |
| Crowd-Kosten und Belegung | `src/game/crowding.ts` | Crowd-Index, Kosten |
| Gerichtete Wege / Queues | `src/game/pathFlow.ts`, `src/game/queueLanes.ts`, `GameState.recalculateQueueDirections` | `allowsPathFlow`, Queue-Kette, Stand-Spuren |
| Weg-Darstellung | `src/view/PathFlowView.ts` | Bodenmarkierungen |
| Straßen-Graph (Fahrzeuge) | `src/game/logistics.ts` | `createRoadGraph`, `findRoadRoute`; Nachbarn nur bei passender Kantenhöhe / Rampe |
| Rampen / Halbstufen | `src/game/wayElevation.ts` | `canTraverseWayElevation`, `packWayElevation` |
| Ampeln / Wegschranken | `src/game/accessControl.ts` | `closedAccessEdges`, `accessEdgeKey` |
| Camping-Multi-Goal | `src/game/camping.ts` | `CampingSystem.findRouteToGathering` |
| Wegtypen und Anforderungen | `src/game/wayTypes.ts` | `WAY_TYPES`, `wayInfo`, `wayIssue` |
| Balancing | `src/game/simulationConfig.ts` | `pathfinding`, `crowding`, `queues` |

## Wichtige Regeln

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
- Crowd-Kosten ändern sich häufiger: gecachte Routen **gestaffelt** nach
  30–59 Ticks verfallen lassen. Nicht den ganzen Cache bei jedem Crowd-Update
  oder bei Cap leeren; bei Cap eine Eintrag entfernen.
- Ein budgetbegrenzter Miss ist **kein** Beweis für Unerreichbarkeit; den
  Reachability-Cache nicht damit vergiften.
- `findPath` erkennt vor A*, wenn alle Zielknoten fehlen oder wegen fester
  Zugangsflags unbetretbar sind (Solid/Wasser/Camp/Medizin/Vorplatz/Staff).
  Start=Ziel bleibt erlaubt. Die ursprüngliche Zielliste für Heuristik und
  Cache-Reihenfolge bleibt erhalten; andere Ziele werden normal gewichtet gesucht.
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
  Bühnenvorplatz ohne Weg und `staffOnly`-Personaleingang. Gäste ohne
  `allowStaff` betreten diese Kacheln nicht.
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
Cache-Expiry). `tests/regression.ts` (Wegschlüssel inkl. Höhe `0`).
`tests/wayElevation.ts` (Halbstufen, Fuß- und Straßenrampen, Legacy-Volleinheit,
Fußweg-Kreuzung behält die Autostraße). `tests/operations.ts` (nach dem
Aussteigen laufen Gäste vom Nachbarweg zum Ziel, nicht in die Parkbucht;
Abreise sucht die Gehweg-Türen in einer Multi-Goal-Suche).
`tests/accessControl.ts` (rote Ampel, geschlossene Schranke, Umparken,
Liefer- und Müllwagen-Umweg). `tests/operations.ts` (Queue-Kette ohne
Shortcuts, Rückwärtsgehen, Stand-Spuren, Saugroboter durch `staffOnly`).
`tests/queueLanes.ts` (Geometrie
der hälftigen Stand-Spuren).

## Bei Änderungen dieses Dokument

Aktualisieren, wenn sich Cache-Politik, Nav-Flags, Multi-Goal-Einstiege,
Crowd-Update-Intervall oder ein neues bewegliches System mit eigener Suche
ändert. Neue Nav-Layer (z. B. ein weiterer `NAV_*`-Typ) hier eintragen.
