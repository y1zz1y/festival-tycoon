# Einheitliche Attraktionsgrundlage

Snapshot v31 speichert Attraktionen kanonisch in `attractions`. Die Registry
parametrisiert drei Layouts:

- `track`: Achterbahn-Loop, Shuttle, Mudmasters/Tree-to-Tree Start→Ende und
  eigene offene Wasserrutsche (`waterSlide`, Leitern am Start);
- `area`: Paintball, Schwimm-, Camping- und Partyfläche;
- `scripted`: Karussell und stapelbarer Bungee-Turm.

`coasters` und `courses` sind die **editierte** Wahrheit ihrer Fachsysteme.
`refreshAttractionProjections` darf sie auf dem MP-Client nicht
wegwerfen, wenn ein Attractions-Delta den gerade gesetzten Kurs nicht
trägt (Eingangs-only-Graph). `applyNetworkUpdate` merget Live-IDs nach
und `refreshLegacyAttractionRecords` schreibt den kanonischen Datensatz
zurück — Occupancy und Entity bleiben zusammen. Campingflächen und
Bühnenvorplätze bleiben die **live** Ausweisungsarrays (`campingCells`,
`campInstallations`, `stageForecourtCells`). `migrateCourse` erzeugt auch
für einen nackten Eingang oder die erste Wasserrutschen-Leiter einen
Datensatz. Kursdetails: [`course-attractions.md`](course-attractions.md).

**Achterbahnen und Kurse sind Ausnahmen und gehören ihren Fachsystemen.** Sie
werden über `state.coasters` / `state.courses` editiert und getickt
(`CoasterSimulation`, `stepCourses`); ihr kanonischer `attractions`-Datensatz
wird danach über `refreshLegacyAttractionRecords` nachgezogen, damit ein Save
keine Bahn verliert. `stepAttractions` überspringt diese IDs
(`legacyIds`), sonst würden sie doppelt simuliert. `removeCoaster` /
`removeCourse` räumen den Datensatz über `dropLegacyAttractionRecords` ab.
Der Sync hängt an einem billigen `legacyAttractionSignature`-Gate
(inkl. Camping-/Vorplatzzellen) und läuft nicht auf jedem Tick.

**Schienen-Editor / RCT2-Anschlussregeln:** [`coaster.md`](coaster.md).
Gameplay, Queues und Fahrgeschäfte bleiben hier; der Track-Editor, die
Stückkataloge und die Anschluss-State-Machine stehen dort.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Kanonisches Modell / Registry | `src/game/attractions/types.ts`, `src/game/attractions/definitions.ts` | `Attraction`, `ATTRACTION_DEFINITIONS` |
| Graph, Neuverbindung, Sampling | `src/game/attractions/trackGraph.ts` | `removeTrackEdge`, `orderTrackFromStart`, `validateTrackGraph`, `sampleTrackCenterline` |
| Flächen / Referenzen | `src/game/attractions/areaLayout.ts` | `addAreaCells`, `placeAreaReference`, `validateAreaAttraction` |
| Gemeinsamer Resolver / Abschluss | `src/game/attractions/construction.ts` | `resolveAttractionConstruction`, `validateAttractionCompletion` |
| Betriebsstrategien | `src/game/attractions/runtime.ts` | Loop/Shuttle, Fußgänger, Slider, Scripted |
| Spaßgutschrift bei Abschluss | `src/game/attractionFun.ts`, `src/game/simulationConfig.ts` | `grantAttractionFun`, `needs.ride.funGain`, `coasters.funGain`, `courses.funGain` |
| v30→v31 / Projektionen | `src/game/attractions/migration.ts`, `src/game/attractions/projections.ts` | `migrateLegacyAttractions`, `refreshAttractionProjections` |
| Eigene Editoren (kein gemeinsames Panel) | `src/ui/coasterBuilderPanel.ts`, `src/ui/courseBuilderPanel.ts`, `src/main.ts` | Achterbahn: Palette, Pitch/Bank/Chain, offenes Ende; Kurse: Palette oder Weg-Pfeile laut `editorMode`. Betrieb für Kurse/Paintball/Pool im Infofenster `#course-options`, nicht im Builder |
| Editor-Modus | `src/game/trackEditorMode.ts`, `src/game/coasterTypes.ts`, `src/game/courseAttractions.ts` | `editorMode: 'palette' \| 'directionArrows'` am Katalog; Default Achterbahn = Palette |
| Autoritative Commands | `src/game/commands/attractionCommands.ts` | Start, Konstruktion, Betrieb, Preis, Konfiguration, Abriss |
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
Area-, Coaster- und Scripted-Runtimes; keine Gutschrift beim Anstehen).
`tests/operations.ts` (Serpentinen-Kette, Rückweg, leerer Stand).
`tests/festivalAdditions.ts` (1-Feld-Steigungen, flach↔steil-Übergang, Wagen-Mesh, Schienenjoin-Rundung / Pfadkontinuität, vollständiger Abriss inkl. Queue und Command, Physik-Untergrenzen `chainSpeed` / `stationLaunchSpeed` / `dragArea` / `maximumSpeed`).
`tests/coasterTypes.ts` (Typ-Katalog, alle Typen spielbar, Anschlussregeln, Helix, Palette-Filter, Testfahrt während Planung, SI-Geschwindigkeitsuntergrenzen — Pflicht bei Editor-/Typ-Änderungen, siehe `coaster.md`).
`tests/performanceGuards.ts` (Specials, eine Photo-Abrechnung, Bungee-Exklusivität, Wagen-Batch).

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Dispatch-Modi, Gate-Regeln, Join-Glättung,
Physik-Caches, Testfahrt/Planung oder Abriss ändern. Track-Kinds, Anschlussregeln, Typ-Katalog
und Bau-UI: [`coaster.md`](coaster.md). Neue Attraktionsgebäude auch in
`docs/buildings.md`.
