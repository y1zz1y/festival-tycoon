# Mehrspieler

Der **Host** simuliert. Clients schicken `GameCommand`s (inkl. Bauhöhe und
Drehung) und empfangen periodische Weltdeltas. Alle Teilnehmer brauchen
dieselbe Spielversion. Es gibt keine automatische Host-Übernahme.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Befehls- und Nachrichtentypen | `src/net/protocol.ts` | `GameCommand`, World/Sim-Snapshots |
| Vollständige Command-Metadaten | `src/net/commandRegistry.ts` | `COMMAND_METADATA`, `isOptimisticCommand` |
| Command → `GameState` | `src/net/commands.ts` | `applyGameCommand` |
| Kompakte Pakete | `src/net/codec.ts` | `packWorld` |
| Deltas, Ankunft/Abreise | `src/net/worldUpdates.ts` | `WorldUpdates`, `applyWorld` |
| Client-Session | `src/net/session.ts` | `MultiplayerSession` |
| UI-Bindung | `src/net/bind.ts` | `enableMultiplayerCommands` |
| Host-Turns, Optimistic | `src/game/GameState.ts` | `gate`, `receiveTurn`, `applyNetworkWorld` |
| Server-Räume | `server/rooms.ts` | `attachMultiplayer` |
| WebSocket-Plugin | `server/wsPlugin.ts` | Kompression, Puffergrenze |

`commandRegistry.ts` klassifiziert jeden `GameCommand` genau einmal als
optimistic oder host-bestätigt; `satisfies Record<GameCommand['type'], ...>`
erzwingt TypeScript-Vollständigkeit. Festival-Unteraktionen behalten ihre
separate optimistic Allowlist. `commands.ts` hat zusätzlich einen
exhaustiven `never`-Zweig, sodass ein neuer Union-Fall ohne Anwendung nicht
baut. Wire-Namen, Payloads und die `GameCommand`-Union bleiben unverändert.

Platzierung, Abriss und Schienenbau delegieren intern aus den bestehenden
`GameState`-Methoden an `src/game/commands/*`. `applyGameCommand`,
`enableMultiplayerCommands`, Command-Namen, Payloads und Optimistic-Einstufung
bleiben unverändert; die Services kennen keinen konkreten `GameState`.

## Wichtige Regeln

- Neue spielerseitige Aktion: `GameCommand` in `protocol.ts`, Zweig in
  `commands.ts`, autoritative Methode in `GameState`, ggf. Optimistic-Flags.
  Gemeinsame Attraktionen verwenden `startAttraction`,
  `constructAttraction` (derselbe Resolver wie die Vorschau),
  `removeAttraction`, `setAttractionOperation`, `setAttractionPrice` und
  `configureAttraction`. `constructAttraction` trägt die diskriminierte
  Änderung für Kante, offenes Ende, Fläche, Referenz, Zugang oder
  Scripted-Segment. Bau/Abriss/Zugang sind optimistic; Betrieb, Preis und
  Einstellungen werden vom Host bestätigt. `commandRegistry.ts`,
  `commands.ts` und `bind.ts` behandeln alle Varianten exhaustiv.
- Neue persistente Weltfelder: Codec / `worldUpdates` und Join-Vollsync.
  Bühnenvorlagen und platzierte Bühnen übertragen ab v33 optional
  `StageDesign.forecourtDepth` (1–24). Der vorhandene
  `manageFestival.stageDesign`-Command transportiert das gesamte Design;
  ältere Designs ohne Wert bleiben bei zwei Bühnenbreiten.
  Fahrzeugpositionen und Routen behalten das bestehende optionale
  `RoadPosition.elevation` auch beim Laden/Normalisieren. Der Host berechnet
  Straßenbelegung und Vorfahrt pro Ebene; keine zusätzlichen Commands oder
  Snapshot-Felder für Überführungen.
  Lieferwagen liegen in `logistics.roadVehicles` (`deliveryTruck` /
  `deliveryId`) und weiter in `festival.infrastructure.trucks`.
  Ampeln/Schranken: `placeTrafficLight`, `placePathBarrier`,
  `configureAccessControl`, `toggleAccessControlArea`,
  `clearAccessControlArea`; Snapshot-Feld `accessControls`.
  `configureAccessControl` darf `scheduleTime`, `scheduleHours`,
  `scheduleOffer` und `schedulePhases` mitsenden.
  Ticketpreise: `entryPrice` (Tag) und `campingTicketPrice` (Camping);
  Commands `updateEntryPrice` und `updateCampingTicketPrice`.
  Nachfrage-Debug: `updateDemandTuning` sendet alle Koeffizienten atomar,
  ist nicht-optimistisch und wird vom Host normalisiert; Snapshot-Feld
  `festival.demandTuning`.
  Feuerwehrwagen: `buyFireTruck` (`stationId`).
  Die älteren Kurs-Projektionspfade nutzen noch `startCourseArea`, `addCourseAreaCells` und
  `removeCourseAreaCells` übertragen eine komplette Flächenauswahl atomar;
  außerdem `startCourse`, das kompatible `addCourseAreaCell`,
  `addCoursePiece` (optional `elevation`), `undoCoursePiece`,
  `setCourseOperating`, `setCoursePrice`,
  `setCourseTeamSize`, `removeCourse`; Snapshot-Feld `courses`.
  Festival-Action `autoLineup` darf `minStars` / `maxStars` mitsenden.
  T-Shirt-Stand: `configureShirtStall` (`color`, `style`). Gäste-Felder
  `ownedMascot`, `heldMascot`, `wornShirt` liegen im PackedVisitor.
  Personalzonen: `toggleStaffZone`, `setStaffZone` (`active` an/aus für
  genau einen 3×3-Schlüssel) und `fireStaffMember` (auch für Saugroboter
  anhand der Fahrzeug-ID). Ziehen sendet idempotente `setStaffZone`-Schritte
  statt Toggle, damit der gesperrte Malmodus nicht flackert. `workZones` liegt
  am Staff-Mitglied bzw. am Saugroboter in `logistics.roadVehicles` und kommt
  über Sim-Pakete.
  `queueSplit` an Queue-Wegen ist kein Command, sondern Host-seitig
  abgeleitet wie `queueDirection` und kommt mit dem Gebäude-Snapshot.
  Der Vorfall-Ticker wird auf jedem Client aus `incidents`, Panik-Gästen
  und `wasteDumpCells` abgeleitet; kein `GameCommand` und kein extra
  Snapshot-Feld. Das HEADLINE Magazin ebenso: jeder Client ruft
  `buildHeadlineMagazine` auf dem Host-Snapshot auf (gleiche Zahlen,
  gleicher Text). Kein Command, kein Recap-Feld.
  Festival-Action `staffGate` darf `direction` (Baurichtung, Kante) mitsenden;
  fehlend gilt 0. Alte Clients ohne Feld bleiben gültig.
  `editTerrain` darf optionales `corner` (0–3) und `originHeight` mitsenden;
  `mode` kann weiter `raiseCorner` / `lowerCorner` / `water` / `smooth` /
  `flatten` sein (UI zeigt nur raise/lower/smooth). Flächen gehen über
  `editTerrainArea` (`cells`, `mode`, optionales `originHeight` für Glätten).
  Snapshot `waterLevel` und optionale `terrain.corners` kommen mit der Welt.
  `placePath.slope` ist eine Zahl (neu ±0.5, Legacy ±1). Neue Commands
  `placeRoad` und `undoRoad` setzen Straßenrampen host-autoritativ.
  `undoRoad` darf optionales `elevation` mitsenden, damit nur eine Lage
  einer gestapelten Autostraße zurückgenommen wird.
  `removeCoaster` (`coasterId`) reißt Schiene, Station, Zug, Tore und die
  angeschlossene Eingangsqueue host-autoritativ ab; optimistic wie die
  übrigen Coaster-Baucommands.
  Backstage: `designateBackstageArea` (`cells`, optionales `enabled` zum
  Löschen) ist optimistic wie Vorplatz/Müllablage. Snapshot:
  `backstageCells`, `bandActors` (`memberIndex`, `role`, `costumeId`),
  `bandSupply` (`components`,
  `showQualityByStageId`, `activeKeys`). `RoadVehicle.kind` kann `tourBus`
  sein (Ziel `tourBusParking` / `reservedParkingId`). `tourBusParking` ist
  ein Gebäude-`kind`. Optionale Besucherfelder `backstageIntrusion` /
  `backstageLingerMinutes`. Alte Clients ohne diese Felder bleiben gültig
  (leere Arrays / Bare-Stage).
  `RoadVehicle.target.kind` kann `sealedWasteContainer` sein (`buildingId`,
  x, z). Gebäude-`kind` `sealedWasteContainer` nutzt bestehendes `place`
  und `wasteFill`. Unbekanntes Ziel wird beim Normalisieren verworfen.
  Krankenwagen: `sellAmbulance` (`garageId`) und `sellAmbulanceVehicle`
  (`vehicleId`). Optionales `RoadVehicle.pendingSale` kommt mit den
  Sim-Paketen; fehlend gilt als nicht zum Verkauf. Buslinien:
  `addBusToLine` (`lineId`) kauft/weist einen Bus zu; `setBusLineStops`
  (`lineId`, `stopIds`) ändert nur die Reihenfolge. `busIds` / `stopIds`
  bleiben bestehende Snapshot-Felder.
  `startCoaster.typeId` ist jeder Katalogtyp (`CoasterTypeId`). Unbekannte
  IDs löst der Host zu `classicSteel` auf. Snapshot-`coaster.typeId` kommt
  mit den Sim-Paketen; kein neues Command.
  `stampBlueprint` (`originX`, `originZ`, `rotation`, `items`) stempelt eine
  lokale Vorlage host-autoritativ (optimistic wie `place`). Die Bibliothek
  liegt nur im Client-Browser, nicht im Snapshot. Unbekannte `kind`-Werte
  in `items` werden verworfen. Alte Clients ohne das Command bleiben gültig.
- Clients dürfen Construction optimistic zeigen, aber der Host bleibt
  maßgeblich (`resolveOptimisticCommand`, Reconciliation).
- Besucher feldweise updaten; unveränderte Bereiche nicht erneut senden.
- Determinismus: gleicher Tick + gleiche Commands → gleicher `hashSim`.
- Host muss geöffnet bleiben.

## Tests

`tests/regression.ts` (echte WebSockets, zwei Clients, später Join,
Pause/Resume, Deltas). Ride-Reconciliation: `tests/rideAccess.ts`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Commands, Snapshot-Teile, Delta-Strategie, Tick-Delay
oder Server-Raumlogik ändern. Save-Felder parallel in `docs/saves.md`.

## Deko-Fassaden (0.1.125)

Bestehende `place`/`placeSceneryLine`-Commands transportieren Vollfeld-Slot 4
für große Themenobjekte und Wandkanten 0–3. Host und optimistischer Client
nutzen dieselben Validierungen; Höhen/Rotationen bleiben im bestehenden
Command-Kontext. Neue Wand-Kinds brauchen dieselbe Spielversion auf allen
Clients. Kein neues Command; Tests prüfen Wandhöhe und Vollfeld auf dem Host.

## Dächer, Eimer und Kontextabriss (0.1.126)

Neue Dach-/Eimer-Kinds nutzen bestehende `place`-Commands. Automatische
Möbelrotation wird auf Host und Client nach derselben `pathFurniture.ts`-Regel
ermittelt. Kontextabriss nutzt vorhandenes `bulldoze` mit konkreter Building-ID
bzw. `undoRoad` mit konkreter Höhe. Keine rein lokale Weltmutation. Shift setzt
Bauhöhe lokal; nächste Baucommands übertragen den bestehenden Höhenkontext.

## Dachabschluss-Kinds (0.1.128)

30 Dachwand-Kinds verwenden bestehende place-/Dekolinien-Commands und
Host-Prüfungen für Kanten, Höhe und Dach-Koexistenz. Keine neuen Commands/Felder.
