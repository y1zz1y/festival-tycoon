# Einheitliche Attraktionsgrundlage

Snapshot v31 speichert Attraktionen kanonisch in `attractions`. Die Registry
parametrisiert drei Layouts:

- `track`: Achterbahn-Loop, Shuttle, Mudmasters/Tree-to-Tree Start→Ende und
  eigene offene Wasserrutsche (`waterSlide`, Leitern am Start);
- `area`: Paintball, Schwimm-, Camping- und Partyfläche;
- `scripted`: Karussell und stapelbarer Bungee-Turm.

**Schienen-Editor / RCT2-Anschlussregeln:** [`coaster.md`](coaster.md).
Gameplay, Queues und Fahrgeschäfte bleiben hier; der Track-Editor, die
Stückkataloge und die Anschluss-State-Machine stehen dort.

## Doppelmodell (offizielle Regel, bewusst ohne Migration)

Das Doppelmodell ist eingefroren: keine Migration, kein neues Snapshot-Feld,
Snapshot-Version bleibt 34. Die Invarianten-Tests in
`tests/attractionFoundation.ts` (`assertDualModel`) halten es fest.

**Wahrheit:** `state.coasters` (Achterbahnen) und `state.courses`
(Mudmasters, Tree-to-Tree, Schwimmbad, Paintball, Wasserrutsche) sind die
editierte und getickte Wahrheit (`CoasterSimulation`, `stepCourses`). Ebenso
bleiben `campingCells`, `campInstallations`, `stageForecourtCells` und
`ride`-Gebäude (Karussell, Bungee, Flat Rides) Live-Quellen. Der
`attractions`-Datensatz mit derselben ID ist eine **abgeleitete Projektion**:
Save- und MP-Spiegel, nie Quelle. `migrateCourse` erzeugt auch für einen
nackten Eingang oder die erste Wasserrutschen-Leiter einen Datensatz.
Kursdetails: [`course-attractions.md`](course-attractions.md).

**Eine Legacy-ID-Regel:** `src/game/attractions/dualModel.ts` entscheidet als
einzige Stelle, ob ein Datensatz einem Fachsystem gehört:
`legacyAttractionIds` (Bahnen, Kurse, `ride`-Gebäude) zusammen mit
`isLegacyAttractionId` (deckt auch `{poolId}-slide-N` ab). `stepAttractions`,
`recalculateQueueDirections`, `AttractionView` und die Fahrgast-Sichtbarkeit
in `WorldView` (`crowdRiderIds`, Legacy-Menge pro Datenänderung, nicht pro
Frame) nutzen genau diese Funktionen. Kanonisch sind nur Datensätze aus
`startAttraction` (IDs `attraction-…`, heute Karussell und Bungee als
`scripted`) einer Nicht-Projektionsart; `isCanonicalAttractionRecord` prüft
das an der Form des Datensatzes ohne Gebäude-Scan und ist, weil Waisen
verworfen werden, das Gegenstück der Legacy-ID-Regel (Test:
`assertDualModel`). Die Pro-Besucher- bzw. Pro-Entscheidungs-Pfade
`removeVisitorFromCoasterQueues` und `findReachableAttraction` nutzen diese
Formprüfung und scannen keine Gebäude.

**Schreiben:** Nur `refreshLegacyAttractionRecords` erzeugt oder überschreibt
Projektionsdatensätze, per `Object.assign` alle Felder. Derselbe Lauf entfernt
Waisen (Bahn-/Kurs-Datensatz ohne Live-Zeile, vom Lader migrierter
Ride-Datensatz ohne `ride`-Gebäude) und den Datensatz einer Live-Zeile, die
nicht mehr projiziert (keine Kante, keine Fläche); Camping/Party werden
komplett neu aufgebaut. `dropLegacyAttractionRecords` löscht sofort beim
Abriss (`removeCoaster`, `removeCourse` samt `-slide-`, Undo bis leer, Abriss
eines `ride`-Gebäudes in `placementService.ts`). Verboten:

- ein Feld eines Projektionsdatensatzes schreiben (`name`, `layout`, `access`,
  `operationMode`, `price`, `queue`, `runtime.*`). Es wiche bis zur nächsten
  Auffrischung ab und würde dann still verworfen.
- kanonische Commands auf Legacy-IDs oder Projektionsarten:
  `constructAttraction`, `setAttractionOperation`, `setAttractionPrice`,
  `configureAttraction` und `removeAttraction` lehnen mit `ok: false` und
  deutscher Meldung ab. `startAttraction` baut kein `coaster:*`, `course:*`,
  `waterSlide`, `paintball`, `swimArea`, `camping` oder `partyArea`; die
  entstehen im Achterbahn- bzw. Kurs-Editor oder durch Ausweisen. Eine
  Achterbahn ohne Stücke entsteht so nie.
- die Rückprojektion (`projectCoasters` / `projectCourses`) über eine
  bestehende Live-Zeile. Sie ist verlustbehaftet (Punkt-`pitch`/`bank`,
  Kurs-Ein-/Ausgangs-IDs `{id}-entrance`, veraltete Queue und Rider). Erlaubt
  nur (1) in `migrateSnapshot`, wenn ein Live-Array fehlt oder leer ist
  (v31-Stände), und (2) über `adoptMissingLiveRows` auf dem MP-Client für
  **fehlende** IDs. Eine vorhandene Live-Zeile gewinnt immer.

**Lesen:** Laufzeitfelder eines Projektionsdatensatzes (`queue`,
`runtime.train/riders/match/telemetry/occupantIds`) sind nur der Stand der
letzten Auffrischung; `scrubQueue` und `stepCourses` ersetzen die Arrays jeden
Tick. Niemand liest sie. Strukturfelder (`layout`, `access`, Modus, Preis)
sind nach jeder Editoränderung frisch; Simulation, Besucherziele,
Queue-Richtung und Rendering lesen trotzdem die Live-Arrays.

**Queue-Richtung:** `recalculateQueueDirections` lässt wie vor dem Einfrieren
zuerst die Datensätze in ihrer Reihenfolge (Erstellungsreihenfolge) Queues
beanspruchen, danach Bahnen, Kurse und Gebäude. So behält eine Queue-Kachel
zwischen zwei Eingängen in alten Ständen ihre Richtung (die ältere Anlage
gewinnt). Ein Datensatz mit Live-Besitzer beansprucht dabei am **Live**-Eingang
(`liveQueueEntrances`), denn die Funktion läuft vor `emit`, und der Datensatz
kann noch den alten Eingang tragen.

**Auffrischen:** Host/offline in `emit('mutate')` hinter
`legacyAttractionSignature`: ein 32-Bit-Hash (`Math.imul`, jeder Schritt eine
Bijektion, also ändert jede einzelne Wertänderung das Ergebnis; nie
`Infinity`/`NaN`, egal wie groß der Park ist). Er deckt Anzahl, IDs, Namen,
Typ, Stück-IDs/-arten/-anker, Tor-Koordinaten, Modus als String (`open` ≠
`test`), Preis, Dispatch, Kursstücke und -flächen, Campingzellen und
-installationen sowie Vorplatzzellen samt `stageId` ab. Ein Wege-Flächenbau
(`wayBatch`) prüft erst beim abschließenden `emit`. MP-Client: unbedingt in
`applyNetworkWorld`/`applyNetworkUpdate`. Laden: in `migrateSnapshot` und noch
einmal in `repairSnapshotEntities` nach der Reparatur der Live-Arrays
(`normalizeCourses`, `repairCoaster` mit `queue ??= []`, `rideType`,
Camp-Installationen). Kein Tick frischt auf.

**IDs:** Achterbahnen, Kurse und kanonische Datensätze teilen einen
Namensraum; keine ID wird doppelt vergeben. Achterbahnen und kanonische
Datensätze nutzen `nextAttractionId` in `GameState` (`nextId` plus Überspringen
belegter IDs, denn nach dem Laden setzt `idCounter` neu auf). Kurse nutzen
`nextCourseId`: weiter `course-${simTick}-${n}` aus dem synchronisierten
Zustand, beginnend bei `courses.length + 1`, und bei Belegung das nächste
freie `n`. Das alte Schema ohne Prüfung wiederholte sich bei pausiertem Spiel
(A, B starten, A abreißen, C starten); ein prozesslokaler Zähler würde
dagegen auf Host und optimistischem MP-Client verschiedene IDs liefern, und
die folgenden Kursstück-Commands des Clients fänden den Kurs nicht.
Stände aus 0.2.11, die schon zwei Zeilen mit derselben ID tragen, repariert
der Lader: `renameDuplicateLiveIds` (in `repairSnapshotEntities`, vor dem
Ableiten der Datensätze) gibt jedem späteren Duplikat die erste freie ID
`${id}-${n}` (n ≥ 2). Gäste in Queue, Zug oder Rider-Liste des umbenannten
Duplikats ziehen mit; Gäste, die nur auf dem Weg dorthin sind, bleiben bei
der ersten Zeile.

**Save/MP:** Beide Formen werden gespeichert und übertragen. Laden bevorzugt
die Live-Arrays und leitet die Datensätze neu ab; ein gemischter Stand wird
dabei repariert (Waise weg, fehlender Datensatz neu), nie simuliert. Bis
0.2.11 bediente `stepAttractions` Waisen, ein Stand kann also Gäste enthalten,
die für eine Waise anstehen oder mit ihr fahren. `refreshLegacyAttractionRecords`
liefert die verworfenen Waisen-IDs, und `releaseGuestsOfOrphans` schickt diese
Gäste (`queuing`/`riding`, `targetId` = Waise, keine Live-Zeile mit dieser ID)
wie `removeCoaster` zurück auf `exploring`. Das passiert nur im Lader
(`migrateSnapshot`, `repairSnapshotEntities`): Zur Laufzeit verwirft jeder
Abriss seinen Datensatz sofort, `emit` trifft also nie auf eine Waise, und ein
MP-Client (Lockstep) ändert keine Besucher außerhalb des Ticks. Doppelte
Bahn-/Kurs-IDs aus 0.2.11 benennt `renameDuplicateLiveIds` vor dem Ableiten
um (siehe IDs). Ein Attractions-only-Delta ändert keine bestehende
Client-Live-Zeile. Ride-Datensätze entstehen nur im Lader (v30 oder leeres
`attractions`) aus `ride`-Gebäuden, werden nicht aufgefrischt und
verschwinden mit dem Gebäude.

**Erweitern:** Ein bestehendes Live-System darf wachsen, der neue Fall läuft
über die Projektion mit: ein neuer `rideType` des `ride`-Gebäudes (braucht
nichts in `attractions`), ein neuer `CoasterTypeId` (bekommt automatisch
`coaster:<typ>`) oder eine neue `CourseKind` (Definition `course:<kind>` in
`ATTRACTION_DEFINITIONS`, Zuordnung in `migrateCourse`/`projectCourses`).
**Neue Attraktionsarten** gehören dagegen ausschließlich ins kanonische
Modell: Eintrag in `ATTRACTION_DEFINITIONS`, `createAttraction`,
`resolveAttractionConstruction`, Laufzeit in `stepAttractions`, Darstellung
in `AttractionView`, Commands `startAttraction`/`constructAttraction`/….
Sie bekommen eine **eigene** `runtime.kind` (nicht `coaster`/`course`, sonst
zieht die Projektion sie in die Live-Arrays und die Waisen-Regel entfernt
sie), kein neues Live-Array und keinen Eintrag in der Legacy-ID-Menge. Ihre
Datensätze entstehen über `startAttraction` (ID `attraction-…`) und sind damit
kanonisch: `isOrphanProjectionRecord` lässt jeden kanonischen Datensatz stehen,
egal welche `runtime.kind` er hat (Test `testNewCanonicalKindsAreNoOrphans`).
Waise kann nur ein Datensatz ohne `startAttraction`-ID und ohne Live-Besitzer
sein.

**Warum Achterbahnen und Kurse die Ausnahme bleiben:** Achterbahnen hängen an
der RCT2-Anschluss-State-Machine auf `TrackPiece` (Start-/End-Anker,
Punkt-Pitch/Bank), an `CoasterSimulation` (SI-Physik, Sample-Caches pro Bahn)
und an eigenen MP-Commands. Kurse hängen an zwei Editoren (Palette/Weg-Pfeile),
`stepCourses` (RNG-Verzweigung, Paintball-Match) und der Kachelbelegung. Der
`TrackGraph` bildet das nicht verlustfrei ab. Eine Migration würde Saves,
Mehrspieler und Editorverhalten riskieren; deshalb bleibt das Doppelmodell
offiziell.

**Laufzeitkosten:** `stepAttractions` überspringt Camping/Party und
Legacy-Datensätze und baut den Besucher-Index erst beim ersten Datensatz, der
wirklich läuft; ein Park ohne kanonische Attraktion allokiert dafür pro Tick
nichts. `legacyAttractionIds` läuft einmal pro Tick über die Gebäude. Der
`isWater`-Hook durchsucht die Datensätze nur bei einer Rutschen-Landung, nicht
pro Tick.

**Bekannte Grenzen:** Camping- und Party-Datensätze zeichnet `AttractionView`
weiter als flache Flächenboxen; sie folgen den Live-Arrays erst beim nächsten
`emit('mutate')`, Zelte, die Gäste im Tick aufbauen, also verzögert. Ein
32-Bit-Hash kann theoretisch kollidieren (≈ 1 : 4 Mrd. je Änderung); eine
einzelne Wertänderung ab 1/1000 (Koordinate, Preis, Winkel) erkennt er immer.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Kanonisches Modell / Registry | `src/game/attractions/types.ts`, `src/game/attractions/definitions.ts` | `Attraction`, `ATTRACTION_DEFINITIONS` |
| Graph, Neuverbindung, Sampling | `src/game/attractions/trackGraph.ts` | `removeTrackEdge`, `orderTrackFromStart`, `validateTrackGraph`, `sampleTrackCenterline` |
| Flächen / Referenzen | `src/game/attractions/areaLayout.ts` | `addAreaCells`, `placeAreaReference`, `validateAreaAttraction` |
| Gemeinsamer Resolver / Abschluss | `src/game/attractions/construction.ts` | `resolveAttractionConstruction`, `validateAttractionCompletion` |
| Betriebsstrategien | `src/game/attractions/runtime.ts` | Loop/Shuttle, Fußgänger, Slider, Scripted |
| Spaßgutschrift bei Abschluss | `src/game/attractionFun.ts`, `src/game/simulationConfig.ts` | `grantAttractionFun`, `needs.ride.funGain`, `coasters.funGain`, `courses.funGain` |
| v30→v31 / Projektionen | `src/game/attractions/migration.ts`, `src/game/attractions/projections.ts` | `migrateLegacyAttractions`, `refreshLegacyAttractionRecords`, `releaseGuestsOfOrphans`, `legacyAttractionSignature`, `adoptMissingLiveRows` |
| Doppelmodell: Legacy-IDs, Waisen, Fahrgast-Sichtbarkeit, doppelte IDs | `src/game/attractions/dualModel.ts` | `legacyAttractionIds`, `isLegacyAttractionId`, `isCanonicalAttractionRecord`, `isProjectionDefinitionId`, `isOrphanProjectionRecord`, `crowdRiderIds`, `renameDuplicateLiveIds` |
| Eigene Editoren (kein gemeinsames Panel) | `src/ui/coasterBuilderPanel.ts`, `src/ui/courseBuilderPanel.ts`, `src/main.ts` | Achterbahn: Palette, Pitch/Bank/Chain, offenes Ende; Kurse: Palette oder Weg-Pfeile laut `editorMode`. Betrieb für Kurse/Paintball/Pool im Infofenster `#course-options`, nicht im Builder |
| Editor-Modus | `src/game/trackEditorMode.ts`, `src/game/coasterTypes.ts`, `src/game/courseAttractions.ts` | `editorMode: 'palette' \| 'directionArrows'` am Katalog; Default Achterbahn = Palette |
| Autoritative Commands | `src/game/commands/attractionCommands.ts` | Start, Konstruktion, Betrieb, Preis, Konfiguration, Abriss |
| Texte (Meldungen, Gedanken, Namen) | `src/game/attractions/**`, `src/game/coaster*.ts`, `src/game/flatRides.ts`, `src/i18n/en/attractions.ts` | kanonisch deutsch mit `de`/`named`/`numberedName`; Typ-, Stück- und Fahrgeschäftnamen als Basen im `names`-Export; englische Achterbahntypen und Kursmarken in `keep()` ([i18n.md](i18n.md)) |
| Gemeinsames Rendering / Picking | `src/view/AttractionView.ts`, `src/view/WorldView.ts` | gebatchte Track-/Area-/Scripted-Instanzen |
| Schienen-Editor, Typen, Anschlussregeln | [`coaster.md`](coaster.md), `src/game/coasterTypes.ts`, `src/game/coasterConnections.ts` | Katalog, `describeTrackAppendIssue` |
| Schienen, Physik, Betrieb | `src/game/coasters.ts` | `TRACK_PIECE_KINDS`, Zug, Dispatch, `getSmoothedCoasterPiecePoints` |
| Bauen, Recall, Preis, Abriss | `src/game/GameState.ts` | `startCoaster`, `recallCoasterTrain`, `setRideAccess`, `removeCoaster` |
| Queue-Richtung | `src/game/pathFlow.ts` | `allowsPathFlow` |
| Balancing / SI-Physik | `src/game/simulationConfig.ts` | `coasters`, `classicSteel.physics`, `physicsSimulation`, `trackJoinSmoothing` |
| Spezialstücke visuell | `src/view/coasterSpecials.ts` | Loop, Photo, Splash |
| Wagen | `src/view/coasterCars.ts` | ein gemergtes Mesh je Zugstil + Lackfarbe; geteilte Geometrie |
| Schienenstile | `src/view/coasterTrack.ts` | ein vertex-color Mesh je Stück; Familien für Holz / Box / Inverted / Maus / Bob / … |
| Bungee-Darstellung | `src/view/bungee.ts` | ein Rider, ein Seil |
| Zugangstore | `src/view/attractionAccess.ts` | sechs geteilte Meshes |
| Preview | `tests/access-preview.html` | |
| Baumenü | `src/game/buildMenu.ts`, `src/main.ts`, `src/style.css` | Attraktionen: Fahrgeschäfte, Stände, Camping, Festival; RCT2-artiges sequenzielles Konstruktionsfenster |

## Wichtige Regeln

- Preview und Command rufen denselben puren
  `resolveAttractionConstruction` auf. UI und Rendering mutieren keinen
  Spielzustand.
- Coaster-Stückunterhalt (`economy.coasterUpkeepPerPiece`) und Ride-Gebäude
  sitzen ohne live laufendes Festival auf `economy.pauseUpkeepMultiplier`
  (5 % Leerlauf). Kurse: [`course-attractions.md`](course-attractions.md).
- Mittleres Löschen erhält beide Graphkomponenten. Der Spieler wählt ein
  offenes Ende und verbindet feldweise neu; die Reihenfolge wird immer vom
  Startknoten abgeleitet, nie aus Arraypositionen.
- Abschlussvalidierung prüft Topologie, eindeutige Reihenfolge, Zugänge und
  definitionsspezifische Regeln. Open-Exit-Wasserrutschen müssen in einer
  `swimArea` oder im eigenen `poolBasin`-Auslauf landen.
- Area-Referenzen sind Bestandteil der Attraktion und keine unabhängigen
  `PlacedBuilding`s. Registry-Allowlisten entscheiden, welche Referenz oder
  Besucherinstallation innerhalb einer Fläche stehen darf.
- Alle Zugangsmodi teilen Queue-Richtung, Multi-Goal-Routing und den
  host-autoritativen Einlass.

- Segmentlängen und Frames **pro Bahn cachen**, invalidieren über
  Piece-ID/Chain-Signatur. Nicht alle Sample-Punkte pro Wagen/Substep neu
  scannen.
- Schienenübergänge werden **zur Mesh-/Pfad-Ableitung** geglättet
  (`trackJoinSmoothing` in `simulationConfig`): horizontale Kurven bleiben
  ein Viertelkreis in der Draufsicht (mehr Samples, kein Gaussian auf X/Z,
  kein Fillet in die Kurve). Neigungsstöße glättet ein Bogenlängen-Gaussian
  (`sigma` 0.28 Kacheln) plus ein kurzes Fillet nur bei fast gleicher
  Heading. Snapshot-`points` bleiben unverändert; alte Saves runden sich
  beim Laden. Mesh und `sampleCoasterTrack` teilen denselben Cache.
  Stationen und Loops bleiben ungefillet. Keine neuen Snapshot-Felder.
- Legacy-Fahrgeschäfte ohne Tore bleiben geschlossen, bis Eingang und Ausgang
  gesetzt und verbunden sind.
- Eingangsqueues nutzen dieselbe gerichtete Traversierung wie Coaster.
  Fehlender Ausgang verzögert die Freigabe, ohne erneut abzukassieren.
  Attraktionsqueues bleiben **eine** volle Spur; die hälftige
  Ansteh-/Zurückspur gilt nur für Stand-Queues (`docs/visitors.md`).
- Queue-Kacheln bilden eine **Kette in Bau-Reihenfolge**. Nebeneinander
  liegende Segmente einer Serpentine werden nicht als Abkürzung verbunden.
- Gäste dürfen eine Schlange nur vorwärts (anstehen) oder rückwärts
  (verlassen, nach dem Kauf) entlang dieser Kette begehen. Seitliche
  Sprünge auf Nachbar-Queue-Kacheln sind Navigationstopologie, keine
  bloße Einbahn-Einschränkung.
- Gäste, die den Achterbahneingang bereits erreicht haben, stehen vor noch
  anlaufenden Reservierungen. Freie Plätze lösen deshalb sofortiges,
  kontinuierliches Nachrücken aus und keine gruppenweise Freigabe.
- Gate-Edits invalidieren Spatial-Index und Navigation.
- Vollständiger Abriss (`removeCoaster` / Command `removeCoaster`) entfernt
  Schiene, Station, Zug, Ein-/Ausgang und die angeschlossene
  Eingangsqueue. Fahrgäste und Anstehende werden zuerst wie beim Recall
  ausgeladen bzw. freigegeben. Refund wie bei Gebäuden
  (`demolitionRefundRate`). Queue- und Stationswechsel invalidieren
  Navigation über `emit()` / `worldRevision`. Das Infofenster und der
  Konstruktionseditor bieten **Achterbahn abreißen**; Abriss auf einer
  Stations- oder Zugangs-Kachel ruft dieselbe Methode auf. Vor dem
  Command fragt die UI lokal nach (`src/ui/confirmDialog.ts`, mit
  Bahnname). Das Infofenster schließt danach.
- Photo-Käufe und Brems-/Wasserwiderstand laufen im Tick, nicht im Render.
- Spaß wird additiv und höchstens bis 100 erst beim tatsächlichen Abschluss
  gutgeschrieben: beim Aussteigen nach einer vollständigen Achterbahnrunde,
  nach dem Karussell-/Bungee-Timer oder am Kursende. Anstehen, Einsteigen und
  ein vorzeitig zurückgeholter Achterbahnzug geben keinen Spaß. Gemeinsame
  Runtimes und Legacy-Projektionen verwenden dieselbe Gutschrift.
- Bungee: ein statisches Mesh, ein Rider, ein Seil, ein aktiver Besucher.
  Visuals aus dem autoritativen Interaktions-Timer. Der Baumenüeintrag nutzt
  das eigene Fallschirm-Icon und keine `ride`-Vorschau, da diese das
  Karussellmodell zeigt.
- Loops behalten eine feste Referenz-Heading durch vertikale Tangenten.
- Steigungsstücke (sanft und steil) belegen **ein** Feld und werden direkt aus
  der Station gesetzt. Halbe Höhenstufen (`0.5`) sind für sanfte Stücke zulässig.
  Die Startplattform nutzt dieselbe Bauhöhe (`buildElevation`, Snap 0.5).
- Das Konstruktionsfenster folgt dem RCT2-Ablauf: Richtung/Kurvenradius,
  „Speziell …“, Neigung, Rollen/seitliches Kippen, große Vorschau mit Kosten,
  Rückbau/Bauen und Eingang/Ausgang. Nicht anschließbare Teile sind deaktiviert.
  Richtungs-, Neigungs- und Banking-Wahl erzeugen weiterhin autoritative
  `TrackPiece`s; Kettenliftkosten werden in der Vorschau eingerechnet.
- Sonderstücke stehen nur bei passender waagerechter, ungekippten
  Anschlussgeometrie zur Verfügung. Stationen benötigen ebenfalls einen
  waagerechten und neutralen Anschluss. Kurven müssen zur Banking-Richtung passen.
- Die lange 4-Felder-Rundung (`pitchTransition`) gilt nur für **flach ↔ steil**.
  Jeder Wechsel der Neigung nutzt ein `pitchTransition`: benachbarte Stufen
  (flach↔sanft, sanft↔steil) bleiben ein Feld, insbesondere endet
  sanft↔flach tatsächlich mit Neigung `0`. Erst das danach gebaute Stück ist
  wieder ein konstantes gerades bzw. geneigtes Stück.
- Ketten- und Stationsgeschwindigkeiten stehen in
  `SIMULATION_CONFIG.coasters.classicSteel.physics` bzw. `physicsSimulation`.
  Baseline (SI, Gravitation bleibt `9.81`): `stationLaunchSpeed` 22.4 m/s,
  `stationDriveSpeed` 6.72 m/s, `chainSpeed` 10.4 m/s, `dragArea` 0.53 m²,
  `maximumSpeed` 90 m/s. Typ-Overrides (Giga-Kette, LIM/LSM-Launch, kleinere
  Maus-Stirnfläche) skalieren mit. Stationbremse
  (`stationBrakingDeceleration` 4.2, `endBrakeDeceleration` 5.8,
  `stationDriveAccelerationLimit` 9.6) folgt der höheren Abfahrtsgeschwindigkeit,
  damit Züge nicht früher ausrollen. Gäste werden nicht eingefroren.
- **Testbetrieb** auf einer geschlossenen Strecke setzt den leeren Zug sofort
  in Fahrt (`stationLaunchSpeed`). Das gilt auch in der Festivalplanung,
  solange die Spielgeschwindigkeit nicht 0 ist; Gäste und die Festivaluhr
  bleiben in der Planung stehen.
- Wagen: ein gemergtes Vertex-Color-Mesh, Geometrie pro Wagenfarbe gecacht.
  Fahrgäste bleiben eigene Kinder für Sichtbarkeit und Shirtfarbe.

## Tests

`tests/rideAccess.ts` (beide Ride-Typen, Queues, Saves, Multiplayer).
`tests/attractionFoundation.ts` (Abschlussgutschrift der gemeinsamen Track-,
Area-, Coaster- und Scripted-Runtimes; keine Gutschrift beim Anstehen;
Doppelmodell: `assertDualModel` nach jedem Editorschritt für Bahn und Kurs,
auch mit ≥ 300 Campingzellen, Signatur endlich und empfindlich für jede
Änderungsklasse, eindeutige Kurs-IDs, keine Waisen nach Abriss/Undo/Ride-Abriss,
keine Doppelsimulation, auch auf Tick-Ebene (Bahn- und Kursgast zahlen je
einmal, veraltete Datensatzkopien bleiben unberührt), Fahrgast-Sichtbarkeit
ohne Projektions-Rider, Queue-Richtung vom Live-Eingang und in
Erstellungsreihenfolge, idempotente Save-Runde samt Reparatur eines
gemischten Stands mit freigegebenen Waisen-Gästen, v1-Park mit allen sechs
Live-Familien, Reparatur doppelter IDs beim Laden, MP-Vollsync/Deltas ohne
Änderung bestehender Client-Live-Zeilen, Ablehnung von Legacy-IDs durch die
kanonischen Commands, neue kanonische Arten sind keine Waisen,
festgeschriebene Verluste der Rückprojektion).
`tests/operations.ts` (Serpentinen-Kette, Rückweg, leerer Stand).
`tests/festivalAdditions.ts` (1-Feld-Steigungen, flach↔steil-Übergang, Wagen-Mesh, Schienenjoin-Rundung / Pfadkontinuität, vollständiger Abriss inkl. Queue und Command, Physik-Untergrenzen `chainSpeed` / `stationLaunchSpeed` / `dragArea` / `maximumSpeed`).
`tests/coasterTypes.ts` (Typ-Katalog, alle Typen spielbar, Anschlussregeln, Helix, Palette-Filter, Testfahrt während Planung, SI-Geschwindigkeitsuntergrenzen — Pflicht bei Editor-/Typ-Änderungen, siehe `coaster.md`).
`tests/performanceGuards.ts` (Specials, eine Photo-Abrechnung, Bungee-Exklusivität, Wagen-Batch).

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Dispatch-Modi, Gate-Regeln, Join-Glättung,
Physik-Caches, Testfahrt/Planung, Abriss oder das Doppelmodell (Signatur,
Legacy-ID-Regel, Rückprojektion) ändern. Track-Kinds, Anschlussregeln, Typ-Katalog
und Bau-UI: [`coaster.md`](coaster.md). Neue Attraktionsgebäude auch in
`docs/buildings.md`.

## Flat Rides (0.2.10)

Kettenkarussell (`chainSwing`, 3×3), Freefall-Turm (`freefall`, 2×2),
Riesenrad (`ferrisWheel`, 3×1), Autoscooter (`bumperCars`, 3×2) und
Schiffschaukel (`swingShip`, 3×1) sind `rideType`s des `ride`, wie der
Bungee-Turm. Sie nutzen damit dieselbe Warteschlange, Tore, Tagesplan-Angebot
„Fahrgeschäfte“, Strom, Audio und Speicherung.

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Typen, Namen, Werte je Typ | `src/game/flatRides.ts` | `FLAT_RIDE_TYPES`, `rideProfile` |
| Balancing | `src/game/simulationConfig.ts` | `rides.<typ>`: Kosten, Unterhalt, Kapazität, Fahrtdauer, Spaß, Energie, Übelkeit, Preis |
| Grundfläche | `src/game/stageDesign.ts` | `RIDE_FOOTPRINTS`, `buildingSize` |
| Bauen, Tore | `src/game/GameState.ts` | `placeRide`, `canPlaceRide`, `canPlaceRideAccess` |
| Modelle, Animation | `src/view/flatRideModels.ts` | `createFlatRideModel`, `animateFlatRide` |

- **Bauen:** `placeRide(type, x, z)` prüft jedes Feld der Grundfläche wie ein
  Karussell (entwässert, verdichtet, gepflastert; alle Felder auf gleicher
  Höhe) und bucht die Kosten des Typs statt der des Karussells. Ein Befehl
  `placeRide` im Mehrspieler (optimistisch).
- **Tore** dürfen neben jedem Feld der Grundfläche stehen, nie darauf; sie
  drehen sich zum nächsten Feld.
- **Betrieb:** `rideProfile` liefert Kapazität, Fahrtdauer, Spaß, Energie,
  Übelkeit (für `addRideNausea`), Gedanke, Preis und Unterhalt; Karussell und
  Bungee laufen über denselben Weg. Parkwert und Finanzaufschlüsselung nutzen die
  Typkosten.
- **Darstellung:** statische Basis plus wenige bewegte Teile mit geteilter
  Geometrie und Hausmaterial, nicht gebündelt, weil animiert. Bewegung aus der
  interpolierten Simulationszeit, nur solange jemand fährt; Fahrgäste sind
  dann im Fahrgeschäft und in der Menge ausgeblendet. Pausiert das Spiel, steht
  alles still.
- Unbekannte `rideType`s aus fremden Ständen werden beim Laden zum Karussell.

Test: `tests/flatRides.ts`.
