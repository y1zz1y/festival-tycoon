# Spielstände und Versionierung

`GameSnapshot.version` in `src/game/types/snapshot.ts` ist die kanonische
Schema-Version. Aktuelle Snapshot-Version: **34**. `npm run test:docs` gleicht
diesen dokumentierten Wert mit Typ, Bootstrap und Migration ab. Die sichtbare
Spielversion kommt aus `package.json`. Feature-/Fix-Batches erhöhen den
Patch (`npm version patch --no-git-tag-version`) und halten das Lockfile synchron.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Snapshot-Form | `src/game/types/snapshot.ts`, `src/game/types/entities.ts` | `GameSnapshot`, Entity-Strukturen |
| Blank-/Neuspiel-Erzeugung | `src/game/snapshotBootstrap.ts` | `createBlankSnapshot`, `createInitialSnapshot` |
| JSON-Migration | `src/game/snapshotMigration.ts` | `migrateSnapshot` |
| Konstruktor-Reparaturen | `src/game/GameState.ts` | `GameState.constructor`, private Welt-/Index-Normalisierung |
| Base64-Export | `src/game/saveText.ts` | `encodeSaveText`, `decodeSaveText`, `serializeSnapshot` |
| Browser-API zum Server | `src/game/serverSaves.ts` | `listServerSaves`, `saveServerSave` |
| Browser-Überlauf | `src/game/browserSaves.ts` | IndexedDB, wenn `localStorage` voll ist |
| Gemeinsamer Browser-Speicher | `src/game/browserPersistence.ts` | IndexedDB-Adapter, `isQuotaError` |
| Archiv-Viewmodell / HTML | `src/ui/saveArchive.ts` | Server- und Browser-Slots zusammenführen, Quelle erhalten, Texte escapen |
| Katalog-Keys | `src/game/catalog.ts` | `SAVE_KEY`, `SAVE_SLOTS_KEY`, `saveSlotDataKey` |
| Server-Slots | `server/saveSlots.ts` | SQLite `saves`-Tabelle in `data/accounts.db` |
| Szenario-Defaults | `src/game/scenario.ts` | `normalizeScenarioSettings` |
| Szenario-Fortschritt | `src/game/scenarioGoals.ts` | `normalizeScenarioProgress` (Migration und Reparatur, idempotent) |
| Bühnen-Migration | `src/game/stageDesign.ts` | `migrateStageDesign` |
| Logistics-Normalize | `src/game/logistics.ts` | `normalizeLogisticsSnapshot` |
| Ampeln / Schranken | `src/game/accessControl.ts` | `normalizeAccessControls`, `accessControls` |

Wo `accounts.db` liegt, bestimmt `HEADLINER_DATA_DIR`; ohne die Variable
`data/` neben dem Server. **Im Container muss sie gesetzt sein** — das Image
legt genau ein beschreibbares Verzeichnis an, das Volume `/app/saves`, und
`/app` selbst gehört root. Der Standardpfad `/app/data` ließ sich deshalb nicht
anlegen: Die erste Speicher- oder Konto-Anfrage warf `EACCES`, die Ausnahme
fiel aus dem Request-Handler, und Node beendete sich — ein Crash-Loop, der mit
jedem Neustart auch alle laufenden Mehrspieler-Sitzungen mitnahm.

Beides ist jetzt abgefangen: `serve.ts` fängt jeden Request-Fehler ab und
antwortet mit 500, statt den Prozess mitzunehmen, und `storageProblem()` sagt
beim Start einmal deutlich, wenn das Verzeichnis nicht nutzbar ist. Spiel und
Mehrspieler laufen dann weiter, nur Konten und Server-Spielstände nicht.

Lokale benannte Slots: Metadaten in `SAVE_SLOTS_KEY`, die Welt je Slot
unter `saveSlotDataKey(id)`. Listing liest nur Namen/Zeiten, nie
`GameState.fromJSON` — sonst leert ein schwerer oder neuer Snapshot das
Archiv. Passt ein Stand nicht in `localStorage` (~5 MB), liegt er in
IndexedDB (`src/game/browserSaves.ts`). Schnellspeichern schreibt denselben
vollen Snapshot, niemals ohne Besucher/Gebäude.

Spielstände und Baubibliothek verwenden denselben kleinen IndexedDB-Adapter
und dieselbe Quota-Erkennung aus `browserPersistence.ts`. Datenbanken,
Object-Stores, localStorage-Schlüssel und die bisherige Überlauf-/Fallback-
Reihenfolge bleiben getrennt und unverändert; es gibt keine Datenmigration.

Server-Slots brauchen ein Konto (`/api/saves`, SQLite). `GET /api/saves`
legt zuerst die Account-Tabellen an — sonst scheitert der `users`-Join
für Gäste mit „no such table: users“. Gäste und Fehler (kein Server,
keine JSON-Antwort, 401) zeigen eine Meldung (kanonisch deutsch, beim
Betrachter übersetzt); lokale Slots bleiben sichtbar. Persönliche Saves niemals committen oder überschreiben.
Die UI-Zusammenführung in `ui/saveArchive.ts` verändert keine Snapshots:
Server- und Browser-Slots behalten ihre Quelle, werden nur für Listen sortiert,
und fremde Namen werden vor dem Einsetzen in HTML escaped.

**Schnell speichern**, **Schnell laden** (Iconleiste → Spielstand) und das
**Autospeichern** teilen sich einen einzigen benannten Slot: `QUICKSAVE_NAME`
(„Schnellspeichern"). Vorher schrieben sie an zwei verschiedene Stellen — das
Schnellspeichern in den versteckten `SAVE_KEY`-Slot, das Autospeichern in einen
Archiveintrag —, sodass es zwei „letzte" Stände gab und man keinen davon neben
dem anderen sah. Jetzt steht er im Archiv wie jeder andere, mit Tag, Uhrzeit und
Speicherzeitpunkt, und wird von dort geladen; der Knopf **Schnell laden** auf
dem Titelbildschirm ist deshalb weg, **Fortsetzen** greift ohnehin auf denselben
Stand.

Der Slot wird über seinen Namen gesucht, nicht gemerkt — so trifft er auch nach
einem Neuladen, einer Anmeldung oder in einem anderen Browser denselben
Eintrag. Ein älteres Spiel mit einem Slot namens `LEGACY_AUTOSAVE_NAME`
(„Autospeichern") wird übernommen und dabei umbenannt, statt daneben liegen zu
bleiben; wer noch einen Stand im alten `SAVE_KEY` hat, kann ihn über **Schnell
laden** weiterhin öffnen, solange es den neuen Slot noch nicht gibt.

Schnellstand und benannte Slots schreiben immer den vollen Snapshot — keine
gekürzte Variante ohne Personen oder Objekte.

**Host-Übernahme im Mehrspieler** ([multiplayer.md](multiplayer.md)): Ein Gast,
der einen Raum übernommen hat, spielt den Park eines anderen. Solange dieser
Park läuft (`MultiplayerSession.inheritedHost`), schreiben **Schnell speichern**
und **Autospeichern** in den eigenen Slot „Übernommen {Code}“
(`takeoverSaveName`, Kontext-Hook `takeoverSlotName` in
`src/ui/saveController.ts`), gesucht über den Namen wie der Schnellstand — nie
über das eigene „Schnellspeichern“. **Schnell laden** liest dann genau diesen
Slot zurück (`findQuickSlot` in `src/ui/saveArchive.ts` wählt für Speichern und
Laden denselben); gibt es ihn noch nicht, lädt es nichts („Noch kein Stand
„Übernommen {Code}“ gespeichert“), statt den eigenen Schnellstand in den Raum
zu laden. Der so geladene Stand bleibt übernommen (Kontext-Hook `keepTakeover`
→ `MultiplayerSession.markInherited`), speichert also weiter in seinen Slot.
Benannte Slots („Speichern unter“) bleiben frei wählbar; ein aus der Liste
geladener „Übernommen“-Stand zählt wie jeder geladene Stand. Der
übernommene Park wird wie ein geladener Spielstand aufgebaut
(`GameState.fromJSON`); das Werkzeug fällt wie nach jedem Laden auf „Ansehen“
zurück. Ein Host, dessen Raum übernommen wurde, während er weg war, bekommt beim
Zurückkommen seine offline weitergespielte Welt als **lokalen** Browser-Slot
„Vor Host-Wechsel {Code}“ (`SaveController.backupLocally` über
`GameState.saveSnapshotSlot`, bei Platzmangel IndexedDB wie jeder Slot); ein
zweiter Wechsel ersetzt diese Sicherung, und sie wird nicht zum
„Fortsetzen“-Stand. Kein neues Snapshot-Feld, keine Versionsänderung.

## Wichtige Regeln

Die Extraktion von Besucher-Orchestrierung und Bau-/Abriss-/Coaster-Services
ändert keine Snapshot-Felder oder Schema-Version. Die faire Routingqueue bleibt
reiner Laufzeitzustand und wird nach dem Laden weiterhin aus Besucherzustand,
Camp und Müll rekonstruiert.

- Neue Snapshot-Felder: Default im Blank-Snapshot, Normalize beim Laden,
  Save-Kompatibilität für alte Stände, Multiplayer-Sync.
  `multiplayerCode` hält den Raumcode, unter dem diese Welt hostet — er gehört
  zum Spielstand, nicht zur Sitzung, damit derselbe Stand immer denselben Code
  bekommt und eine verteilte Einladung weiter gilt. Ältere Stände haben ihn
  nicht und bekommen beim ersten Hosten einen. Als einziges Feld geht er
  bewusst **nicht** über die Leitung (`packWorld` nimmt ihn heraus wie
  `selectedTool`): Ein Gast behält seinen eigenen, sonst würde er später mit dem
  Code eines fremden Raums hosten wollen. Ausnahme Host-Übernahme: Der neue Host
  baut die Welt mit dem Raumcode (`gameFromNetworkWorld(world, local, code)`),
  und `attach` stempelt ihn zusätzlich (`rememberMultiplayerCode`). Alter und
  neuer Stand tragen dann denselben Code; wer zuerst hostet, bekommt ihn
  (`codeFor`), der andere einen neuen. Ein Gast, der nach dem Ende eines Raums
  allein weiterspielt, behält seinen eigenen Code.
  Optionale `scenario.title` / `scenario.detail` halten Name und
  Beschreibung eines Drop-in-Szenarios; fehlend bleibt die Anzeige beim
  Preset bzw. „Freies Spiel“. Optionales `scenario.authoring` markiert den
  Szenario-Editor (Baukosten 0); fehlend oder falsch ist ein normales Spiel.
  Alte Stände ohne diese Schlüssel bleiben gültig, kein Versionsbump.
  Dateiformat und Ordner: [scenarios.md](scenarios.md).
  v34 erweitert `scenarioProgress` um `editions` (Ergebnis jeder beendeten
  Ausgabe), `outcome` (`running`/`won`/`lost` mit Grund und Tag),
  `insolventDays`, `nextEditionDue` und `dueReminderDay`; `scenario` bekommt die
  optionalen `firstEditionDays` und `festivalGoals`, `ScenarioGoal` die Arten
  `admissions`, `satisfaction`, `reputation`, `profit`, `parkValue` und das
  optionale `streak`. v33-Stände behalten ihre Zielmarken, der Ausgang ist
  `running`, und ein fehlender Stichtag wird vom Ladetag aus gezählt
  ([scenarios.md](scenarios.md)).
  v33 ergänzt optional `StageDesign.forecourtDepth` (1–24 Felder).
  v32 und ältere Bühnen ohne Wert behalten über `stageForecourtDepth`
  den bisherigen Vorplatz von zwei Bühnenbreiten.
  v32 ergänzt `festival.demandTuning` für alle Koeffizienten der Ticket-
  Zahlungs- und Teilnahmebereitschaft. v31 und ältere Stände erhalten die
  Werte aus `SIMULATION_CONFIG.ticketDemand`; ungültige Zahlen und
  widersprüchliche Schwellen werden beim Laden normalisiert.
  v31 führt `attractions: Attraction[]` und optional
  `migrationReport.removedAttractionIds` ein. `track`, `area` und `scripted`
  sind die kanonischen Layouts. Der v30→v31-Lader (auch ein Stand mit leerem
  `attractions`) konvertiert Achterbahnen, Kurse, Camping-/Partyflächen und
  `ride`-Gebäude einmalig in Datensätze. Pool wird in `swimArea` plus
  eigenständige Wasserrutschen aufgeteilt. `removedAttractionIds` **meldet**
  Anlagen, die sich nicht in einen Datensatz konvertieren lassen (z. B. ein
  Kurs ohne Stücke); entfernt wird nichts, die Live-Zeile bleibt unverändert in
  `coasters`/`courses` und hat nur keinen Datensatz.
  **Doppelmodell** (offizielle Regel:
  [attractions.md → Doppelmodell](attractions.md#doppelmodell-offizielle-regel-bewusst-ohne-migration)):
  `coasters` und `courses` sind die gespeicherte Wahrheit. Nur wenn eines
  dieser Arrays im Stand fehlt oder leer ist (v31-Stände), wird es beim Laden
  aus `attractions` projiziert; sonst gewinnen die gespeicherten Live-Zeilen.
  `campingCells`, `campInstallations` und `stageForecourtCells` bleiben die
  gespeicherten Live-Arrays, wenn sie im Stand stehen; nur fehlende Arrays
  fallen auf die `camping`-/`partyArea`-Projektion zurück.
  `refreshLegacyAttractionRecords` leitet die Datensätze in `migrateSnapshot`
  und noch einmal in `repairSnapshotEntities` nach der Reparatur der
  Live-Arrays ab. Dabei wird ein gemischter Stand repariert: ein Bahn- oder
  Kurs-Datensatz ohne Live-Zeile und ein Ride-Datensatz ohne `ride`-Gebäude
  werden verworfen, eine Live-Zeile ohne Datensatz bekommt einen. Kanonische
  Datensätze aus `startAttraction` (`attraction-…`) bleiben unverändert, auch
  bei einer künftigen eigenen `runtime.kind`. Gäste, die laut Stand für eine
  verworfene Waise anstehen oder mit ihr fahren (bis 0.2.11 bediente
  `stepAttractions` Waisen), setzt `releaseGuestsOfOrphans` auf `exploring`
  zurück (`targetId = null`, leere Route); das geschieht nur beim Laden.
  Vorher benennt `renameDuplicateLiveIds` doppelte Bahn-/Kurs-IDs um, die
  0.2.11 bei Pause vergeben konnte (zweite Zeile → `${id}-2` usw.; Gäste in
  deren Queue, Zug oder Rider-Liste ziehen mit). Kein neues Snapshot-Feld.
  `syncStageAudience` baut bühnenzugehörige Vorplätze neu. Aktuelle
  Snapshot-Version ist 34; das Einfrieren des Doppelmodells ändert kein
  Snapshot-Feld.
  `courses` (Kurs-Attraktionen): fehlend = `[]` via `normalizeCourses`.
  Neues Kind `waterSlide` (eigene Strecke, startet mit Leitern).
  `normalizeCourses` teilt Legacy-`waterSlide`-Stücke auf Pool-Kursen in
  eigene Kurse (`{poolId}-slide-N`) auf. `CourseAttraction.areaCells`
  speichert die explizite Schwimmbad-/Paintball-Fläche; fehlt sie, werden
  alte `poolBasin`-/`paintballField`-Kacheln übernommen. Neue
  Streckenstücke speichern optional `endX`/`endZ`/`endElevation`; fehlen
  diese Werte, bleibt das alte kachelbasierte Routing aktiv. Laden
  bevorzugt gespeicherte `courses`/`coasters`, falls vorhanden, statt
  eine unvollständige Attraction-Projektion über die Live-Arrays zu
  legen.
  Optionales `teamSize` nur bei Paintball (Default aus Config).
  `festival.headlinerPool` (5-Sterne-Angebot der Planung): fehlend = `[]`.
  `logistics.fireStations` und `RoadVehicle.kind === 'fireTruck'`; optionales
  `RoadVehicle.housed` / `headOnReplanTick`. Alte Stände ohne Felder bleiben gültig.
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
  Snapshot-Feld. Optionales `festival.infrastructure.ground[].cover`
  (`grass`/`sand`/`stone`/`field`/`snow`/`rock`/`earth`/`salt`/`asphalt`) speichert gemalte
  Untergründe; fehlend bleibt der umgebungsbasierte `substrate`. Unbekannte
  Werte werden beim Laden entfernt (`normalizeGroundCells`). Keine
  Snapshot-Versionserhöhung. `paintGroundCover` / `paintGroundCoverArea`
  sind nur Commands. Keine stillen Slot-Änderungen an Deko.
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
- Die persönliche Baubibliothek (`BLUEPRINT_LIBRARY_KEY` /
  IndexedDB `headliner-tycoon-blueprints`) ist kein Snapshot-Feld und
  überschreibt keine Spielstände. Details: [blueprints.md](blueprints.md).
- Der Bau-Undo-Stack (`undoLastBuild`) ist Host-Laufzeitzustand, kein
  Snapshot-Feld. Nach dem Laden ist er leer. Parkplätze in Blueprints
  sind Bibliothek-/Command-Payload, nicht Weltfelder.
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

## Sprachen

Die Textschicht ([i18n.md](i18n.md)) ändert nichts an gespeicherten oder
gesendeten Daten:

- **Keine Änderung an persistierten oder gesendeten Daten.** Kein neuer
  `GameCommand`, kein neues Snapshot-Feld, die Snapshot-Version bleibt. Codec,
  Deltas und Sim-Hash bleiben unverändert; der Sim-Hash enthält keinen Text, und
  es kommt keiner hinzu.
- **Inhalt.** Spielstände, Deltas, `commandResult`, `result`, `error` und `closed`
  tragen kanonisches Deutsch. Command-Payloads tragen kanonische deutsche Defaults
  oder Nutzertext.
- **Übersetzt wird nur beim Betrachter.** Ein deutscher Host und ein englischer Gast
  teilen einen Raum. Optimistische Gast-Commands erzeugen dasselbe Deutsch wie der
  Host, weil autoritativer Code nie übersetzt.
- **Chat, Spielernamen und Lobbynamen** erscheinen wörtlich, nie übersetzt.
- **Versionsschiefe.** Ein Text eines neueren Hosts, den der Katalog des Gastes nicht
  kennt, erscheint auf Deutsch. Das ist akzeptiert.
- **Laden.** Jede Client-Sprache lädt jeden Spielstand. Alte Spielstände können
  Deutsch aus der Zeit vor der Normalisierung enthalten; Legacy-Schlüssel
  (`src/i18n/en/legacy.ts`) decken persistierte Namen und Status ab, alte Gedanken
  erneuern sich.
- **Geräteeinstellung.** Die Sprache liegt in `festival-player-settings`, einer
  Geräteeinstellung. Sie wird nie gespeichert oder synchronisiert.
- Kanonische Defaults wie der Schnellspeicher-Slot `Schnellspeichern`, die
  Bühnenvorlage `Meine Traumbühne` oder die Buslinie `Festival-Shuttle` bleiben
  deutsche Schlüssel; nur ihre Anzeige wird übersetzt. Dasselbe gilt für die
  Übernahme-Slots `Übernommen <Code>` und `Vor Host-Wechsel <Code>`.
- Fehlermeldungen von `src/game/saveText.ts` und `src/game/serverSaves.ts` sind
  `new Error(de(…))`; die Save-API des Servers (`server/saveSlots.ts`) antwortet
  in `error` ebenfalls kanonisch. Die Senken in `src/ui/saveController.ts`
  lokalisieren `error.message` (Katalog `src/i18n/en/net.ts` bzw. `server.ts`).

## Tests

Die Routing-Auftragsqueue ist Laufzeitzustand und fügt keine Snapshot-Felder hinzu.
Ausstehende Abreisen werden beim Laden aus `state`, `campsite`, `campingPhase` und
`pendingWaste` wieder aufgenommen, auch wenn der Besucher schon am Ausgang steht.

`migrateStageDesign` ergänzt fehlende Höhen alter 2D-Werkstätten vor dem Regridding:
Teile stehen auf `y=0`, fehlende Bühnenhöhe verwendet `STAGE_TILE_HEIGHT`. Vorhandene
Höhen und x/z-Platzierung bleiben erhalten. Die geladene Kopie wird migriert,
persönliche Slot-Dateien werden nicht überschrieben.

`tests/regression.ts` (Save-Text). `tests/snapshotModules.ts` (Blank-/Neuspiel,
Migration und delegierender `GameState.fromJSON`-Einstieg).
`tests/browserSaves.ts` (lokaler Slot- und Schnellspeichern-Roundtrip inkl.
Besucher/Gebäude; Liste ohne `fromJSON`; gemockter Server-Client stürzt bei
HTML/401 nicht ab).
`tests/saves.ts` (Konto-API). Roundtrips in `tests/terrainSurface.ts`,
`tests/rideAccess.ts`, `tests/festival.ts`, `tests/scenery.ts`.
`tests/hostTakeover.ts` (Sicherungs-Slot „Vor Host-Wechsel“ über
`GameState.saveSnapshotSlot` inkl. Ersetzen, übernommene Welt über
`GameState.fromJSON` mit Raumcode und RNG, Sicherung des zurückgestuften Hosts,
Schnellspeicher-Slot über `findQuickSlot` — übernommener Park nie im eigenen
Schnellstand —, Markierung bleibt nach `markInherited` und erneutem Hosten).

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

## Durst, Hygiene und Fahrgeschäfts-Typen (0.2.10)

Kein Versionsbump (34). Optionale Felder mit Standard:
`visitor.needs.thirst` fehlend = 80, `visitor.needs.hygiene` fehlend = 100
(`ensureThirstAndHygiene` in `snapshotRepair`). `building.rideType` kennt
zusätzlich `chainSwing`, `freefall`, `ferrisWheel`, `bumperCars`, `swingShip`;
ein unbekannter Wert wird gelöscht (Karussell), ein fehlender Preis kommt aus
`rideProfile`.

## Phase 5 (0.2.11)

Kein Versionsbump (34); alles optional mit Standard:
- `scenario.difficulty` (`easy` | `hard`, fehlt bei Normal),
- `festival.storms`, `shelterOrder`, `stormLive`, `stormInjuries`, `stormStats`
  (fehlend = keine Unwetter / nichts gezählt),
- `festival.sponsorOffers`, `sponsors`, `sponsorsFulfilled` (fehlend = keine),
- `debugAssisted` (Debug-Geld genutzt; fehlend = nein).
Fortschritt und Erfolge liegen nicht im Spielstand ([progress.md](progress.md)).
