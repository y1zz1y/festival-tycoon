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
| Gerichtete Wege / Queues | `src/game/pathFlow.ts`, `GameState.recalculateQueueDirections` | `allowsPathFlow`, Queue-Kette |
| Weg-Darstellung | `src/view/PathFlowView.ts` | Bodenmarkierungen |
| Straßen-Graph (Fahrzeuge) | `src/game/logistics.ts` | `createRoadGraph`, `findRoadRoute` |
| Ampeln / Wegschranken | `src/game/accessControl.ts` | `closedAccessEdges`, `accessEdgeKey` |
| Camping-Multi-Goal | `src/game/camping.ts` | `CampingSystem.findRouteToGathering` |
| Wegtypen und Anforderungen | `src/game/wayTypes.ts` | `WAY_TYPES`, `wayInfo`, `wayIssue` |
| Balancing | `src/game/simulationConfig.ts` | `pathfinding`, `crowding` |

## Wichtige Regeln

- Topology- und Zugangsänderungen (`worldRevision`) invalidieren Navigation
  sofort.
- Crowd-Kosten ändern sich häufiger: gecachte Routen **gestaffelt** nach
  30–59 Ticks verfallen lassen. Nicht den ganzen Cache bei jedem Crowd-Update
  oder bei Cap leeren; bei Cap eine Eintrag entfernen.
- Ein budgetbegrenzter Miss ist **kein** Beweis für Unerreichbarkeit; den
  Reachability-Cache nicht damit vergiften.
- Volle Wege-Scans nicht in Besucher-/Camp-/Staff-Schleifen nesten. Indizes
  einmal pro Pass bauen, Reservierungen inkrementell führen.
- Terrain, Crowding, Staff-/Last-Penalties und Alternativrouten müssen
  funktionsfähig bleiben. Benchmarks nicht durch Einfrieren von Besuchern
  oder Abschalten von Effekten schönen.
- `findRouteToGathering` ist regressionskritisch (335 Installationen in rtest3).
- Saugreiniger nutzen denselben Fußgraphen (`allowFestival`), dürfen aber
  nur `isSweeperDriveCell` betreten — inklusive Bühnenvorplatz ohne Weg.
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

## Tests

`tests/performanceGuards.ts` (Budget, eine Suche für viele Camp-Ziele,
Crowd-Expiry, Bau-Invalidierung). `tests/supplyChain.ts` (Umwege nach
Cache-Expiry). `tests/regression.ts` (Wegschlüssel inkl. Höhe `0`).
`tests/accessControl.ts` (rote Ampel, geschlossene Schranke, Umparken,
Liefer- und Müllwagen-Umweg). `tests/operations.ts` (Queue-Kette ohne
Shortcuts, Rückwärtsgehen).

## Bei Änderungen dieses Dokument

Aktualisieren, wenn sich Cache-Politik, Nav-Flags, Multi-Goal-Einstiege,
Crowd-Update-Intervall oder ein neues bewegliches System mit eigener Suche
ändert. Neue Nav-Layer (z. B. ein weiterer `NAV_*`-Typ) hier eintragen.
