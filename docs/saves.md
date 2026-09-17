# Spielstände und Versionierung

`GameSnapshot.version` ist die Schema-Version (aktuell **30**). Sichtbare
Spielversion kommt aus `package.json`. Feature-/Fix-Batches erhöhen den
Patch (`npm version patch --no-git-tag-version`) und halten das Lockfile synchron.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Snapshot-Form | `src/game/GameState.ts` | `GameSnapshot`, Konstruktor-Normalize |
| Base64-Export | `src/game/saveText.ts` | `encodeSaveText`, `decodeSaveText`, `serializeSnapshot` |
| Browser-API zum Server | `src/game/serverSaves.ts` | `listServerSaves`, `saveServerSave` |
| Browser-Überlauf | `src/game/browserSaves.ts` | IndexedDB, wenn `localStorage` voll ist |
| Katalog-Keys | `src/game/catalog.ts` | `SAVE_KEY`, `SAVE_SLOTS_KEY`, `saveSlotDataKey` |
| Server-Slots | `server/saveSlots.ts` | SQLite `saves`-Tabelle in `data/accounts.db` |
| Szenario-Defaults | `src/game/scenario.ts` | `normalizeScenarioSettings` |
| Bühnen-Migration | `src/game/stageDesign.ts` | `migrateStageDesign` |
| Logistics-Normalize | `src/game/logistics.ts` | `normalizeLogisticsSnapshot` |
| Ampeln / Schranken | `src/game/accessControl.ts` | `normalizeAccessControls`, `accessControls` |

Lokale benannte Slots: Metadaten in `SAVE_SLOTS_KEY`, die Welt je Slot
unter `saveSlotDataKey(id)`. Listing liest nur Namen/Zeiten, nie
`GameState.fromJSON` — sonst leert ein schwerer oder neuer Snapshot das
Archiv. Passt ein Stand nicht in `localStorage` (~5 MB), liegt er in
IndexedDB (`src/game/browserSaves.ts`). Schnellspeichern schreibt denselben
vollen Snapshot, niemals ohne Besucher/Gebäude.

Server-Slots brauchen ein Konto (`/api/saves`, SQLite). `GET /api/saves`
legt zuerst die Account-Tabellen an — sonst scheitert der `users`-Join
für Gäste mit „no such table: users“. Gäste und Fehler (kein Server,
keine JSON-Antwort, 401) zeigen eine deutsche Meldung; lokale Slots
bleiben sichtbar. Persönliche Saves niemals committen oder überschreiben.

**Schnell speichern** / **Schnell laden** (Iconleiste → Spielstand, plus
**Schnell laden** auf dem Titelbildschirm) nutzen den einzelnen
`SAVE_KEY`-Slot (plus IndexedDB-Überlauf). Das ist nicht das
benannte Archiv (`SAVE_SLOTS_KEY` / Server-Konto). Schnellstand und
benannte Slots schreiben immer den vollen Snapshot — keine gekürzte
Variante ohne Personen oder Objekte.

## Wichtige Regeln

- Neue Snapshot-Felder: Default im Blank-Snapshot, Normalize beim Laden,
  Save-Kompatibilität für alte Stände, Multiplayer-Sync.
  `RoadVehicle.kind` kann `deliveryTruck` sein; optionales `deliveryId`
  zeigt auf `festival.infrastructure.trucks`.
  `accessControls` (`trafficLights`, `pathBarriers`) liegt auf dem
  Snapshot, nicht in `logistics`. Alte Stände ohne das Feld werden leer
  normalisiert.   Wegschranken haben `passage` (`oneWay`/`both`, fehlend =
  eine Richtung), Modus `always`/`locked` und `openInEmergency`
  (fehlend = an). Zeitsteuerung: fehlendes `scheduleTime` bleibt
  `hourlySlots`, fehlende `schedulePhases` gelten für alle
  Festivalphasen, fehlendes `scheduleOffer` ist `rides`, fehlende
  `scheduleHours` werden 8–23. Optionales
  `RoadVehicle.parkingSearchCursor` bleibt 0.
  Das Abreise-Manifest eines Besucherautos ist `arrivalGroups.memberIds`
  (keine neues Fahrzeugfeld); beim Tick werden tote IDs und fremde
  `arrivalGroupId`s gestrichen.
  Optionales `RoadVehicle.workZones` gilt für Saugroboter; fehlend
  bedeutet wie bisher das gesamte Gelände.
  Optionale `RoadCell.elevation` / `roadSlope` / `roadSlopeDirection`:
  fehlend heißt Geländehöhe und flach. Alte ganzzahlige Weghöhen und
  `pathSlope` ±1 bleiben 1.0 Welteinheiten, neue Stufen sind 0.5.
  Mehrere `roadCells` dürfen dieselbe `x,z`-Kachel auf verschiedenen
  Höhen belegen (Brücke); alte Stände mit einer Lage bleiben gültig.
  `RoadPosition.elevation` bleibt in Fahrzeug-`cell` / `position`, Routen
  und Zielpositionen beim Normalisieren erhalten (auch 0.5). Fehlende
  Höhen bleiben optional und wählen wie bisher die unterste Straßenlage.
  Kein neues Speicherfeld; vorhandene Höhen dürfen beim Laden nicht
  entfernt werden, sonst wechseln Brückenfahrzeuge auf die Straße darunter.
  `wasteDumpCells[].stored` wird beim Laden auf `waste.dumpCapacity` (180)
  geklemmt; kein neues Snapshot-Feld. Ticker-Verlauf ist nur UI.
  Optionales `staffGateDirection` (0–3) liegt am Fußweg mit `staffOnly`;
  fehlend bleibt ein mittig dargestelltes Legacy-Personaltor, das Gäste
  weiter von der ganzen Kachel fernhält. Mit Richtung sperrt nur die
  bemalte Ausgangskante Gäste, nicht das Feld.
  `Supply`/`Stock` kann `goods` (Allgemeine Waren) enthalten; fehlend = 0.
  Besucher: optionale `ownedMascot`, `heldMascot`, `wornShirt`.
  T-Shirt-Stand: optionale `shirtColor`/`shirtStyle` (Default klassisch/rot).
  Optionales `queueSplit` an Queue-Wegen ist abgeleitet
  (`recalculateQueueDirections`): Stand-Queues wahr, Attraktionsqueues
  falsch. Alte Saves ohne das Feld brauchen keinen Neuaufbau.
- Neue Katalog-Arten (Deko) liegen nur als `building.kind`-String im Snapshot.
  Alte Stände ohne diese Arten bleiben unverändert. Unbekannte `kind`-Werte
  (neuerer Stand in älterem Client) werden beim Laden verworfen, nicht in
  Vollfelder umgeschrieben. Fehlendes `decorationSlot` bleibt Legacy-Vollfeld.
- Legacy-Verhalten bewusst beibehalten (fehlende Ticketkontingente, fehlende
  Scenery-Slots, fehlende Ride-Gates, braune Abandoned-Tents).
  Fehlendes `campingTicketPrice` übernimmt den gespeicherten `entryPrice`.
- Terrain wird beim Laden nicht neu generiert.
  Snapshot `waterLevel` (Default **−0.5**). Fehlt das Feld in alten Ständen,
  wird −0.5 gesetzt: Land auf 0 bleibt trocken, früherer Schlamm (−1) und
  alte Seebecken (−2) werden Wasser. Kachelhöhen rasten auf **0,5**;
  ganzzahlige Altsaves bleiben gültig. Optionale `terrain.corners` sind
  Eckhöhen; fehlend werden sie sichtbar aus den Kachelhöhen abgeleitet
  (`tileVisualCorner`). `editTerrainArea` ist nur ein Command, kein neues
  Snapshot-Feld. Keine stillen Slot-Änderungen an Deko.
- Verwaiste Parkplatz-`occupiedBy` und Krankenfeld-`occupants` ohne
  Fahrzeug bzw. Besucher werden beim Laden geleert. Kein neues
  Snapshot-Feld. Restkacheln bleiben abriss- und überbaubar.
- Bei leeren Ladenschlangen speichert `interactionRemaining` die verstrichene
  Wartezeit negativ; kein neues Snapshot-Feld. Alte Mehrfach-Oberteilereignisse
  werden im Besucherpass auf eine Person reduziert. Alte Fahrzeugrouten und
  Gegenrichtung auf Einbahnen werden vor dem Fahren geprüft und korrigiert.
- Debug- und Performance-Fixtures dürfen persönliche Saves nicht anfassen
  (`docs/performance.md`).
- `removeCoaster` ist nur ein Command; es kommen keine Snapshot-Felder
  hinzu. Nach dem Abriss fehlen die Bahn, ihre Tore und die zugehörige
  Eingangsqueue im nächsten Save.
- `Coaster.typeId` ist einer der Katalog-IDs (`classicSteel`, `wooden`,
  `twister`, …). Fehlender oder unbekannter Wert wird beim Laden zu
  `classicSteel`. Kein neues Snapshot-Feld; alte classicSteel-Saves bleiben gültig.
- `setStaffZone` ist nur ein Command (`staffId`, 3×3-`key`, `active`);
  keine neuen Snapshot-Felder. `workZones` bleibt wie bisher am Personal
  bzw. Saugroboter. `toggleStaffZone` bleibt für ältere Clients gültig.
- Bandversorgung (v29): `backstageCells` (`{ x, z, elevation }[]`),
  `bandActors` (optional `memberIndex`, `role`, `costumeId`; fehlende
  Werte werden aus `bandLooks` ergänzt), abgeleitetes `bandSupply`.
  Fehlende Arrays werden `[]`, fehlendes `bandSupply` leer.
  `tourBusParking` ist ein Gebäude-`kind`; `tourBus` ein
  `RoadVehicle.kind` mit `reservedParkingId`. Optionale Besucherfelder
  `backstageIntrusion` / `backstageLingerMinutes`. Alte Stände ohne
  Backstage spielen als Bare-Stage weiter.
- HEADLINE Magazin wird nicht gespeichert: `buildHeadlineMagazine` leitet
  die Ausgabe aus `festival.finished`, Berichten, Ruf, Anreisen und dem
  übrigen bestehenden Snapshot ab. Kein neues Feld, alte Stände bleiben
  gültig; ein beendetes Wochenende zeigt dasselbe Heft.
- `sealedWasteContainer` ist ein Gebäude-`kind` mit vorhandenem
  `wasteFill` (0–80, `waste.sealedContainerCapacity`). Alte Stände ohne
  das Kind bleiben unverändert. `RoadVehicle.target.kind` kann
  `sealedWasteContainer` (`buildingId`, x, z) sein; fehlend oder
  unbekannt wird `null`. Optionales Personal-Feld
  `wasteFromSealedContainer` (nach Container-Leeren: Ladung nur zur
  Ablage). Fehlend gilt als falsch. Kein neues Snapshot-Top-Level-Feld.
- Optionales `RoadVehicle.pendingSale` (Krankenwagen wartet auf Verkauf
  an der Garage). Fehlend = nicht zum Verkauf. `BusLine.stopIds` /
  `busIds` bleiben die gespeicherte Reihenfolge und Flotte; neue
  Commands `setBusLineStops` und `addBusToLine` ändern nur diese Felder.

## Tests

Die Routing-Auftragsqueue ist Laufzeitzustand und fügt keine Snapshot-Felder hinzu.
Ausstehende Abreisen werden beim Laden aus `state`, `campsite`, `campingPhase` und
`pendingWaste` wieder aufgenommen, auch wenn der Besucher schon am Ausgang steht.

`migrateStageDesign` ergänzt fehlende Höhen alter 2D-Werkstätten vor dem Regridding:
Teile stehen auf `y=0`, fehlende Bühnenhöhe verwendet `STAGE_TILE_HEIGHT`. Vorhandene
Höhen und x/z-Platzierung bleiben erhalten. Die geladene Kopie wird migriert,
persönliche Slot-Dateien werden nicht überschrieben.

`tests/regression.ts` (Save-Text). `tests/browserSaves.ts` (lokaler Slot-
und Schnellspeichern-Roundtrip inkl. Besucher/Gebäude; Liste ohne
`fromJSON`; gemockter Server-Client stürzt bei HTML/401 nicht ab).
`tests/saves.ts` (Konto-API). Roundtrips in `tests/terrainSurface.ts`,
`tests/rideAccess.ts`, `tests/festival.ts`, `tests/scenery.ts`.
`tests/browserSaves.ts`: lokaler Slot und Schnellspeichern mit Besuchern
und Gebäuden; Listing ohne `fromJSON`; Server-Client wirft bei HTML/Netz
statt abzustürzen.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn `GameSnapshot.version` steigt, ein Feld dazukommt oder
sich Slot-/Export-Wege ändern. Command-Protokoll in `docs/multiplayer.md`.

## Deko-Vollfelder und Fassaden (0.1.125)

Kein neues Snapshot-Feld: `decorationSlot: 4` kennzeichnet neue große Deko.
0–3 bleiben Viertel/Kante; undefined bleibt Legacy-Vollfeld. Keine Migration
oder Vergrößerung alter Viertel. Die 40 `wall<Style><Shape>`-Kinds verwenden
`elevation`, `rotation`, `decorationSlot` wie bestehende Deko. Laden bewahrt
Slots und Wandlagen. Regressionen in `tests/decoration.ts`.

## Dächer und Themen-Eimer (0.1.126)

Neue Kinds `roof<Style>Flat/Slope` und `bin<Style>`; keine neuen Felder.
Dächer speichern Vollfeld-Slot 4, Drehung und Höhe. Eimer speichern vorhandenes
`wasteFill`, `rotation`, `elevation`. `isWasteBin` normalisiert alle Varianten.
Wegkanten-Ausrichtung neuer Möbel bleibt als Rotation erhalten; alte Eimer
nutzen beim Rendern ebenfalls den Randversatz. Regressionen in decoration.ts.

## Dachabschluss-Kinds (0.1.128)

`wall<Style>SlopeLeft/SlopeRight/RoofEnd` verwenden vorhandene Rotation,
Kanten-Slots und elevation; kein neues Feld und keine Migration bestehender Teile.
