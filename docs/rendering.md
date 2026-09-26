# Darstellung und Batching

`WorldView` interpoliert den letzten Snapshot. Animated Stages, Licht,
Picking und Overlays bleiben außerhalb der statischen Batches. Kein
Draw-Call oder Material pro Detailstück oder Besucher. Festival-SFX hängen
am Kamera-Listener und nicht an Unique-Materials ([audio.md](audio.md)).

## Kanonische Attraktionen (v31)

`src/view/AttractionView.ts` rendert neue kanonische Track-, Area- und
Scripted-Layouts mit je einer instanzierten Familie für Streckenspannen,
Flächenkacheln, Referenzen und Scripted-Segmente. `buildingIds` pro Instanz
halten Picking ohne Material oder Draw-Call pro Teil möglich.
`WorldView.pickPlacedObject` akzeptiert Attraktions-IDs zusätzlich zu
Gebäude-IDs. Während der schrittweisen Fachsystem-Umstellung werden
vorhandene Coaster-/Course-Projektionen weiterhin von ihren detailreichen
Views gezeichnet; `AttractionView` filtert deren IDs, damit nichts doppelt
erscheint. Kanonische Kurs- und Scripted-Fahrgäste bleiben sichtbar.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Szene, Kamera, Picking | `src/view/WorldView.ts`, `src/view/picking.ts` | Haupt-View; `setPlacementPreviewResult` rendert den autoritativen Game-Layer-Vertrag; `pickPlacedObject` für Info/Abriss; ein `LineSegments`-Baugitter 7×7 auf `buildElevation`; Personalzonen als InstancedMesh |
| Frame-Orchestrierung | `src/app/gameLoop.ts` | `startGameLoop`: Tick, Interpolation, Audio-Listener, Render, optionales `afterRender` (Map-Ping-HUD) und Messzeile; Hidden-Tab-Hosttick 100 ms |
| Pixel-Personen | `src/view/pixelPeople.ts` | 6 Visitor-Batches + Accessoires |
| Tanzpose | `src/view/visitorDance.ts` | reine Limb-Zahlen aus `simTick + renderAlpha`; `WorldView` und `src/titleCrowd.ts` teilen dieselbe Pose |
| Souvenir-Props | `src/view/souvenirMeshes.ts` | 1 Maskottchen- + 4 Shirt-Schnitt-Batches, Instanzfarbe |
| Gebäude-Instancing | `src/view/retroBuildings.ts` | ein gemergtes Vertex-Color-Mesh je `DETAILED_BUILDINGS`-Art inkl. aller `SCENERY_KINDS`; Themen-Deko über `buildThemedScenery` (Familien + Vertexfarben); Instanz-`buildingIds` für Picking; optionaler Cover-Film über `instanceColor` (`weatheringRgb`) |
| Festivaltechnik | `src/view/retroBuildings.ts`, `src/view/FestivalEquipmentView.ts` | Bühne, PA, Generatoren, FOH, Delay-Tower, LED-Wand, Laser und Feuerwerk als gemergte statische Modelle; LED-Leuchtflächen in einem dynamischen Instanz-Batch |
| Show-Effekte | `src/view/LaserView.ts`, `src/view/FireworksView.ts` | Laser teilen Geometrie/Material je Farbe; Feuerwerk nutzt geteilte Raketen-/Partikelgeometrie und einen Burst-Instanzbatch je Effekt |
| Camping-Batches | `src/view/campingModels.ts`, `src/view/batchCampMeshes.ts`, `src/view/coverOverlay.ts` | 14 Camping-Batches; Fläche nur Steinrahmen (`AreaEdgeBatch`) |
| Terrain-Mesh | `src/view/terrainSurface.ts`, `src/view/terrainShape.ts` | ein Boden-Draw-Call, zwei Dreiecke je Kachel; Atlaszeilen inkl. `stone`/`rock`/`snow`/`earth`/`salt`/`asphalt`; Parkfelder als Atlas-`parking` |
| Flächenrahmen | `src/view/coverOverlay.ts`, `src/game/groundCoverLook.ts` | Camping und Vorplatz: offener Innenbereich, ein Steinrahmen-Batch; Objektfilm nur Instanzfarbe |
| Objektstützen | `src/game/supportOccupancy.ts`, `src/view/supports.ts` | geteilter Zylinder; nur bei Luft unter dem Objekt |
| Lichter | `src/view/FestivalLightsView.ts` | fester Pool (8 PointLights, 4 SpotLights); Deko-Lampenfarben aus `decorationLights.ts` |
| Auflösungscaps | `src/view/renderResolution.ts` | max. 1440×810 intern bei Stufe Standard; Stufe Niedrig ×0,75, Hoch ×1,5, nie über `devicePixelRatio` |
| Grafikeinstellungen | `src/view/WorldView.ts` `setGraphics`, `src/view/effectDensity.ts` | Schattenkarte 0/1024/2048, Auflösungsstufe, Effektdichte; Werte aus [ui.md](ui.md) |
| Touch-Kamera | `src/view/touchCamera.ts` | Zwei-Finger-Pan/Zoom |
| Dispose | `src/view/disposeObject3D.ts` | GPU-Ressourcen |
| Browser-Messharness | `tests/render-performance.html` | `?fixture=festivalmittel` (Standard) oder `?save=`; berichtet Draw-Calls je Frame, Dreiecke, Geometrien, Texturen, Programme und einen Szenen-Zensus (Meshes, sichtbar, instanziert, Materialien); `?autorun=1` legt das Ergebnis in `window.__renderReport`. Werte: [performance.md](performance.md) |
| Logistik-Einbahn-Overlay | `src/view/LogisticsView.ts`, `src/view/roadDirectionArrow.ts` | Weiße StVO-Pfeile nach den Fahrzeugen; kompaktes InstancedMesh-Overlay nur bei Werkzeug Fahrtrichtung. Parkflächen: geteiltes Asphaltmaterial plus `parkingTexture` (Stelllinien in der Textur); Asphalt und das gemalte P sind statisch und gebündelt. Straßendecks, Zebrastreifen, Sperren und Richtungspfeile teilen Geometrie (`sharedBox`, `sharedPlane`) und Material (`sharedMaterial` je Oberfläche und Farbe) und laufen durch `batchRetroBuildings`; nur die umschaltbaren Bauhilfen (Tempo-Tönung, frei/belegt) bleiben einzelne Meshes. Grün/Orange und das P nur in der Autostraßen-Bauansicht oder im Logistik-Overlay (`showParkingHelpers`) |
| Weggraph-Debug | `src/view/PathGraphView.ts` | Eine `LineSegments`-Gruppe, nicht `retroStatic`; nur bei 🐞 → Weggraph |
| Buslinien-Planerroute | `src/view/LogisticsView.ts` `setPlannerRoute` | Eine `Line` / ein Material für die Stoppfolge plus ein Mesh mit geteiltem Zahlenatlas (1, 2, 3 …) an den Halten; weg beim Schließen des Reiters |
| Logistik-Modelle | `src/view/logisticsModels.ts` | ModelKit-Gebäude und Fahrzeuge; Besucherautos teilen Geometrie je Lackfarbe |
| Straßenrampen | `src/view/LogisticsView.ts` | Deck kippt um `roadSlope`; Stützen bei Erhöhung; Fahrzeuge folgen `waySurfaceY` |
| Depot-Träger | `src/view/carrierModels.ts`, `src/view/SupplyChainView.ts` | dieselbe Personen-Geometrie wie Gäste; eine gemergte Warnwesten-/Mützen-Kit, ein Handkarren, ein Ladungsstapel |
| Ampeln / Wegschranken | `src/view/AccessControlView.ts` | Geteilte Geometrie, Signalfarbe, Picking über `accessId`. Ampeln rechts an der Fahrbahn, Lampe zum Gegenverkehr. Personentor auf der Ausgangskante (`gateEdgeWorldPosition`), Flügel klappen in die erlaubte Richtung auf |
| Personaleingang | `src/view/SupplyChainView.ts` | Goldene Pfosten auf derselben Kante via `staffGateWorldPosition`; fehlendes `staffGateDirection` bleibt Legacy-Mitte |
| Müllablagen / Eimer-Füllstand | `src/view/WasteView.ts` | Instanced Tiles, Ablage-Säcke und Kartons um Eimer; Füllstand nur über Kartonzahl |
| Backstage-Overlay | `src/view/BackstageView.ts` | ein `InstancedMesh` (aktiv teal / getrennt amber); außerhalb der Gebäude-Batches |
| Band-Akteure | `src/view/BandActorView.ts`, `src/view/bandMemberMesh.ts` | dieselbe gemergte Musiker-Geometrie wie `stageBand.ts`; mindestens Publikum-Auflösung; Backstage nicht klobiger als die Bühne |
| Kurs-Attraktionen | `src/view/CourseView.ts`, `src/view/courseBasinMesh.ts` | explizite Flächen instanziert; verbundene Strecken, Hindernisse und Außenränder als ein gecachtes Vertex-Color-Mesh; Punktobjekte je Stückart instanziert; benachbarte `poolBasin`-Kacheln derselben Attraktion teilen greedy Wasserrechtecke (ein InstancedMesh) und nur den Außenrand |
| Achterbahnwagen | `src/view/coasterCars.ts` | ein gemergtes Mesh pro Wagen plus Sitzgruppen; Geometrie je **Zugstil + Lackfarbe** geteilt (`sitDownSteel`, `wooden`, `bmSitdown`, `invertV`, `flying`, `standUp`, `junior`, `mouse`, `bobsled`, `mine`, `swinging`, `launched`, `giga`). Derselbe Wagen wird als 96-px-Katalogkachel gerendert (`WorldView.coasterTrainThumbnail`) |
| Achterbahnschienen | `src/view/coasterTrack.ts` via `WorldView.rebuildCoasters` | ein vertex-color Mesh je Stück. Schienen sind **Segmentboxen entlang der diskreten Sample-Polylinie** (Heading/Pitch/Bank, ein Basisvektor pro Segment, leichter Überlapp, kein jedes-zweite-Sample mit fester 0,14-Länge). Schwellen, Stützen, optional Spine/Trog im selben Mesh. Geteiltes Material. Animierte Züge, Specials (Foto/Splash) und Picking bleiben außerhalb des statischen Batches. Stil-Tabelle: `steelLattice`, `wooden`, `boxSpine`, `invertedBox`, `flyingSpine`, `juniorTubular`, `wildMouse`, `woodenMouse`, `bobsledTrough`, `suspendedSpine`, `gigaLattice`, `launchedSteel` |
| Stand-Queue-Spuren | `src/view/WorldView.ts` `addQueueBarriers` | Geländer, Mittelschiene und Pfeile aus `QUEUE_RAIL_MATERIAL`/`QUEUE_ARROW_MATERIAL` und einer Box je Maß (`queueBox`), statisch markiert und damit im Gebäude-Batch |

Kursgäste besitzen während der Nutzung ebenfalls `state === 'riding'`, dürfen
aber nicht wie Fahrgäste in Achterbahnwagen ausgeblendet werden.
`WorldView.updateVisitorInstances` hält die IDs aus `course.riders` sichtbar
und animiert sie anhand ihrer autoritativen, pro Tick aktualisierten Position
auf Hindernissen, Brücken, Rutschen und Paintballfeldern.
Paintballmarker und fliegende Kugeln sind vier feste, begrenzte
`InstancedMesh`-Batches (Blau/Orange jeweils Marker/Projektil), keine Meshes
oder Materialien pro Spieler und Schuss. Marker folgen der autoritativen
Besucherposition und zielen auf ein Mitglied des gegnerischen Teams;
Projektilpositionen werden deterministisch aus `simTick` interpoliert.
Die Kursgeometrie verschmilzt außerdem deduplizierte Übergangsplattformen,
Geländer, Seile, Rutschenstützen und Hindernisdetails in dasselbe statische
Vertex-Color-Mesh. Varianten hängen von Kurs- und Stückart ab, nicht von einem
Material oder Draw-Call pro Latte, Griff, Brückenplanke oder Zaunsegment.

Weitere Views (`*View.ts`) sind in den Fach-MDs genannt und dürfen den
Snapshot nicht autoritativ schreiben.

## Wichtige Regeln

- Statische Details: shared/merged Geometry, Vertex Colors, Instancing.
- Renderframes mutieren weiterhin keine Fachlogik. `gameLoop.ts` reicht nur
  verstrichene Zeit an den festen Tick weiter und aktualisiert/interpoliert
  anschließend die View. Verdeckte Tabs ticken ausschließlich den Host.
- Die Inspektionsroute in `LogisticsView` berücksichtigt die Straßenlage
  und Rampenhöhe jedes Wegpunkts. Ihr Cache-Schlüssel enthält `elevation`;
  die Linie liegt auch auf Überführungen auf der Fahrbahn. Die
  Busplaner-Route nutzt dieselbe Höhenlogik, aber ein geteiltes
  `LineBasicMaterial` für die gesamte Polylinie, kein Material je Segment.
- Geteilte Stand-Queues bekommen eine Mittelschiene und einen zweiten
  Richtungspfeil am bestehenden Queue-Mesh, nicht extra Draw-Calls pro Gast.
- `IncidentView` verwendet höchstens vier Instanz-Batches für alle Müllstücke,
  Flecken und Feuer, mit unveränderten Details und Animationen. Sichtbare Änderungen
  aktualisieren Instanzdaten; Geometrie und Material werden weiterverwendet.
- `CampMeshBatcher` in `batchCampMeshes.ts` hält GPU-Batches über Campänderungen
  hinweg vor und vergrößert die Kapazität in Zweierpotenzen. Formen, Farben,
  Transformationen bleiben erhalten. Schlaf- und Musiksymbole sind je ein
  `IconBillboards`-Batch für das ganze Gelände (`src/view/spriteAtlas.ts`),
  nicht mehr ein Canvas, eine Textur und ein Sprite-Material pro Camper.
  Bollerwagen teilen ihre statische Geometrie und Materialien.
- `disposeObject3D` entsorgt bei `InstancedMesh` auch dessen Instanzattribute;
  Geometrie-/Material-Disposal allein gibt diese GPU-Puffer nicht frei.
- Tanzende Gäste (`isDancing`) bleiben auf den bestehenden Limb-Instanzen.
  `visitorDancePose` liefert nur Winkel/Offsets; Phase kommt aus Simulationszeit
  plus ID-Seed, nicht aus `performance.now()`. Kein Skelett oder Material pro
  Gast. Die Menge desynchronisiert über Phase und drei Hände-hoch-Armstile.
  `injured`, `sleeping` und `medical-transport` liegen fest (Tilt π/2, keine
  Flucht- oder Tanzpose), bis die Simulation den Zustand wechselt.
- Sechs Visitor-Instance-Batches bleiben die Picking-Ziele. Accessoires in
  zusätzlichen kompakten Batches, unabhängig von der Population.
  Abriss/Info wählen zuerst das nächste Mesh mit `buildingId` /
  `buildingIds[instanceId]` bzw. `accessId`; ein unbeschrifteter Treffer
  (Straße, Parkfeld) beendet die Suche, damit nichts dahinter fällt.
  Maskottchen und gekaufte Shirts sind solche Accessoire-Batches (kein Mesh
  pro Figur). Darstellung interpoliert nur aus dem Snapshot.
- Weibliche/männliche Varianten: höchstens 32 Instance-Batches insgesamt.
- Die geteilte Brustgeometrie in `pixelPeople.ts` verwendet ausschließlich
  den Hautton, ohne Brustwarzen-Geometrie oder farbige Markierungen.
- Custom-BufferGeometry-Buckets nach **Geometrie-Identität** keyen, nicht nur
  nach Constructor-Parametern.
- Shader vorkompilieren nie über die ganze Szene zur Laufzeit: `renderer.compile`
  ruft `getProgram` je Objekt auf, auch für ausgeblendete Batch-Quellen. Wächst
  eine Population (Personal, Fahrzeuge, Routen, Züge), kompiliert `WorldView.update`
  nur deren Gruppe mit `compile(group, camera, scene)`; die ganze Szene nur einmal
  beim Laden.
- Light-Anzahl nie zur Laufzeit ändern (Shader-Recompile / Freezes).
  Acht PointLights, vier SpotLights und das Cursor-Licht bleiben immer
  in der Szene. Neue Deko-Lampen (`auroraLamp`, `gasLamp`, …) nur Farbe,
  Höhe, Distance und Intensität der vorhandenen Slots setzen; Glow/Birne
  sind InstancedMeshes außerhalb der statischen Scenery-Batches. Kein
  Material oder Draw-Call pro Glühbirne. Leuchtet ein ganzer Körper (der
  Tageslichtballon), setzt `DecorationLightSpec.shellRadius` eine additive
  Leuchthülle aus einem gemeinsamen Batch darüber; sie existiert nur für
  Quellen mit Strom und aktiver Lichtzeit und wird mit der Nacht stärker.
  Modelle bringen kein eigenes Nachtlicht-Material mehr mit.
- Preview-Materials dürfen gebaute Instanzen nicht einfärben oder disposen.
- `WorldView` entscheidet keine Platzierungslegalität. Es rendert
  `PlacementPreviewResult` (`model`, `scenery`, `footprint`, `path`,
  `blueprint`, `access`) und behält die spezialisierten Schienen-, Weg-,
  Blueprint- und Zugangsdarstellungen. Katalogobjekte mit Modellvorschau
  verwenden dasselbe Modell transparent als 3D-Ghost.
- Depot-Träger teilen die Gäste-Körperteile. Warnweste, Handkarren und
  Ladung sind je eine gemergte, vertex-gefärbte Geometrie — kein Mesh
  pro Latte, Schloss oder Kiste. Picking bleibt `staffId` auf der Figur.

## Tests

`tests/performanceGuards.ts`, `tests/pixelPeople.ts`, `tests/visitorDance.ts`,
`tests/carrierModels.ts`,
`tests/campingModels.ts`, `tests/coverOverlay.ts`, `tests/terrainSurface.ts`, `tests/picking.ts`. Messungen: `docs/performance.md`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Batch-Grenzen, Light-Architektur, ein neuer permanenter
View-Zweig oder Picking-Ziele ändern. Neue sichtbare Objekte brauchen einen
Batch-Plan, bevor einzelne Meshes entstehen.

## Themenmodelle und Fassaden (0.1.125)

`retroBuildings.ts` ergänzt Nicht-Klassik-Modelle durch `embellishTheme` und
überarbeitete Blätter, Laternen, Möbel, Zahnräder und Eisdetails.
40 Fassadenmodelle stammen aus `src/game/decorationWalls.ts`
(`wallSpec`, `roofSpec`, `isFacade`); offene Fenster/Türen,
Materialstruktur und Rahmen sind je Art ein gemeinsames Vertexfarben-Mesh.
Instancing und Building-IDs bleiben erhalten. Wände verwenden die gespeicherte
Höhe ohne Terrain-Nachkorrektur, damit Lagen nahtlos stapeln. Slot 4 rendert
Vollgröße. Visuelle Fixture: `tests/decoration-preview.html`.

## Stützenfreie Fassaden und Wegmöbel (0.1.126)

`isFacade` verhindert automatische Bodenstützen an Wänden und Dächern.
Flach-/Schrägdächer nutzen je Kind gemergte Streifen, wie Wände instanziert.
Themen-Eimer ebenfalls ein Mesh je Art. Bank/Eimer-Geistermodelle verwenden
`pathFurnitureRotation` statt einer generischen Kachel. Eimer-Füllkartons
folgen dem gedrehten Randversatz. `tests/construction-preview.html` nutzt den
echten WorldView-Renderer für erhöhte Fassaden und interaktive Bauhöhe.

## Wege und Brücken (0.1.127)

`src/view/wayStructures.ts` erzeugt über `wayStructurePlan` und
`createWayStructure` gemeinsame gemergte Geometrie für Randsteine,
Geländer, Brückendeck-Unterbau und schlanke Vierkantstützen. `indexWayStructures`
indiziert die Lagen einmal je Neuaufbau; Anschlussprüfungen lesen nur Nachbarn.
`wayStructurePlan` hält verbundene Kanten frei, einschließlich Kurven/Kreuzungen,
und erkennt Erhöhung relativ zum Gelände. Jede Stütze endet unter der lokalen
Rampenunterseite; bei einer unteren Weg-/Straßenlage entfallen Stützen in dieser
Kachel (freier Brückenspann). Keine Simulationsmutation. Wege und Straßen teilen
die Geometrien nach Form/Höhe/Kanten; `batchRetroBuildings` instanziert diese
Details, einschließlich Picking-IDs bei Wegen. Kein Draw-Call pro Pfosten.
Warteschlangen behalten ihre eigenen Geländer und bekommen nur den Stützenplan.

Weg-/Straßendecks reichen ohne graue Anschlussflicken über die ganze Kachel.
`wayTextures.ts` bäckt differenzierte 64px-Beläge (vergrößert `NearestFilter`,
verkleinert `LinearMipmapLinearFilter` mit Mipmaps wie das Geländeatlas, sonst
flimmern Wege beim Herauszoomen; Parkfläche 32 px) und liefert mit
`wayDeckMaterial`/`wayDeckGeometry` die geteilten Wegdecks. Die Beläge: (Bohlen mit Fugen/Nägeln,
versetztes Pflaster, Kieskörnung, Fahrplatten, Dirt-Spuren und Asphaltkörnung).
Auch Legacy-Beläge ohne WayType bekommen Textur. Asphaltgeraden erhalten
Mittellinien; Geschwindigkeits-Farbtönung erscheint nur mit Straßenbauhilfen.
Gebäude-Fingerprint berücksichtigt Straßenlagen und Rampenrichtung, damit
Unterführungsstützen bei Änderungen neu aufgebaut werden.

Tests: `tests/wayStructures.ts`, visuell `tests/ways-preview.html` im echten
WorldView. Tests umfassen alle Richtungen/Steigungen, Anschlüsse, Terrain-Höhe,
freie untere Lagen und 200 gleiche Konstruktionen in einem Instanz-Batch.

## Facettiertes Gelände und Stützen (0.1.132)

Das Bodenmesh nutzt vier Ecken und zwei Dreiecke je Feld, nicht den
früheren Fächer mit Mittelpunkt. Sichtbare Ecken kommen aus
`tileVisualCorner` (Hang höchstens 0,5, sonst Steinklippe in
`createTerrainBase`). Wasser ist ein InstancedMesh auf `waterLevel` für
geflutete Felder und Uferhänge (`tileShowsWater`). Gebäude-/Deko-Stützen
teilen eine Zylindergeometrie; sie entfallen, wenn Land oder ein Solid die
Lücke füllt. Wege (`wayStructurePlan`) und Achterbahnstützen kürzen auf
dieselbe Landhöhe.

## Dachwand-Konturen (0.1.128)

`roofWallTop` und `ModelKit.panel` erzeugen echte dreieckige Keilwände,
spiegelverkehrt, plus hohe Stirnwand. Extrusion wird indexiert und mit den
Materialdetails in ein Vertexfarben-Mesh gemergt. Details bleiben unter der
Dachkontur. Instancing/Picking und Stützenfreiheit bleiben erhalten.

## Lokaler Fassadeneinblick (0.1.129)

`src/view/facadeReveal.ts` verwaltet ein WorldView-lokales Material mit geteilten
Shader-Uniforms für die Fassaden-Instanzbatches. Sichtbare Raycast-Treffer auf
Wänden/Dächern aktivieren einen weichen Radius: innen 1 Tile, Übergang bis
2,5 Tiles, minimal 10 % Deckkraft. Zentrum und Stärke werden zeitlich geglättet.
Kein Geometrie-Neuaufbau und keine zusätzlichen Batches pro Objekt. Nach dem
Ausblenden des Effekts wird wieder Tiefe geschrieben. Originale Picking-Geometrie
bleibt aktiv; unsichtbare Einzelmodelle werden bei der Hover-Suche übersprungen.
Pointerleave, Fenster-Blur und Neuaufbau setzen den Effekt zurück. Nur Ansicht,
keine Simulation, Commands oder Save-Felder.

Seit 0.1.130: Im Deko-Baumodus bleiben Wände und Dächer vollständig sichtbar.
Außerhalb davon lassen lokal transparent gewordene Fassaden Klicks zu den
Objekten dahinter durch, etwa zu Ständen. Entfernte, undurchsichtige Bauteile
bleiben anklickbar. Der Hover-Test trifft weiterhin die Fassaden, damit der
Einblick beim Durchklicken stabil bleibt.

## Grafikstandard durchgesetzt (0.2.3)

Gemessen mit `tests/render-performance.html` und festivalmittel sind Draw-Calls von
2.305 auf 833 und die Render-Zeit von 21,6 auf rund 12,4 ms gefallen
([performance.md](performance.md)). Die Regeln dahinter:

- **Jede Katalogart hat ein gebündeltes Modell.** `createBuildingModel` kennt nur
  noch Hausstil-Modelle (`createRetroBuilding`), Logistikmodelle und das Wegdeck
  (`createPathModel`). Bauzaun, Tisch, Beleuchtung und Tageslichtballon sind
  Rezepte in `retroBuildings.ts`; der alte Flachfarben-Fallback mit Material pro
  Objekt ist weg. `tests/performanceGuards.ts` prüft, dass keine Art ohne Modell
  bleibt.
- **Bündeln nach Geometrie und Material.** `batchRetroBuildings` fasst alle
  `userData.retroStatic`-Meshes mit gleicher Geometrie und gleichem Material zu
  einem InstancedMesh zusammen. `userData.flatSurface` (Decks, Asphalt) wirft
  keinen Schatten. Die Gebäude-ID für das Anklicken wird über alle Vorfahren
  gesucht (`owningBuildingId`), damit verschachtelte Teile sie behalten.
- **Materialpalette.** `src/view/materials.ts` hält das Hausmaterial
  (`HOUSE_MATERIAL`), geteilte Overlays (`overlayMaterial`) und den
  Flächenrahmen (`AREA_EDGE_MATERIAL`); `shared()` markiert, was
  `disposeObject3D` nicht entsorgen darf. `MATERIAL_CEILINGS` in
  `tests/performanceGuards.ts` begrenzt `new MeshStandardMaterial(` je Datei auf den
  heutigen Stand; eine Obergrenze wird nur gesenkt.
- **Symbole.** `src/view/spriteAtlas.ts` zeichnet Gefühle, Schlaf, Noten und
  Sprechblase als 16×16-Pixelgrafik im Code (`iconTexture`), auf jedem System
  gleich; die Emoji-Schrift ist raus. `IconBillboards` zeichnet ein Symbol an
  beliebig vielen Stellen in einem Draw-Call; die Quads drehen sich im
  Vertex-Shader zur Kamera. Camping und Sanität teilen dasselbe Schlafsymbol.
- **Sanität.** `MedicalView` hält drei InstancedMeshes (Kachel, Liege, Patient)
  und einen Billboard-Batch und schreibt bei Belegungswechseln nur Instanzen um.
- **Farbraum.** Jede Canvas-Textur setzt `SRGBColorSpace` (0.2.0).

Noch nicht gebündelt, nach Messung die nächsten Kandidaten: Personal
(`StaffView`, 335 Einzel-Meshes, 217 Materialien), Träger (`SupplyChainView`,
335), fahrende Fahrzeuge (204), Bühnenvorplätze (`ForecourtView`, 81) und
Zugangsobjekte (`AccessControlView`, 53).

## Grafikeinstellungen (0.2.4)

`WorldView.setGraphics` setzt, was der Spieler unter Einstellungen → Grafik
wählt. **Schatten:** Aus schaltet `sunLight.castShadow` ab (die Lichteinrichtung
ändert sich einmal, die Shader kompilieren beim nächsten Bild neu); Normal ist
die bisherige 1024er-Schattenkarte, Hoch 2048. Eine neue Kartengröße entsorgt
die alte Karte. **Auflösung:** Faktor auf das logische Pixelraster von
`scenePixelRatio` (0,75 / 1 / 1,5), begrenzt durch `devicePixelRatio`.
**Effekte:** `effectDensity.ts` hält einen Anteil (1/3, 1/2, 1). Feuerwerk zeichnet
`effectCount(24, 6)` Funken, gleichmäßig über den ganzen Ausbruch verteilt;
Laser zeichnen `effectCount(4)` der vier Strahlfarben; die Schallwellen-Ringe
über Lautsprechern entfallen unter 1/2. Die Zahl der Lichter ändert sich nie.

## Flat-Ride-Modelle (0.2.10)

`src/view/flatRideModels.ts` baut je Fahrgeschäftstyp eine statische Basis und
wenige bewegte Teile (Rotor, Gondeln, Wagen, Schiff) aus `ModelKit`-Geometrie mit
`HOUSE_MATERIAL`. Die Geometrie je Teil ist einmal pro Typ gebaut und geteilt
(`userData.shared`), die Materialzahl bleibt null neue Konstruktoren. Die Modelle
sind nicht `retroStatic`, weil sie sich bewegen. `WorldView.update` animiert sie
mit der interpolierten Festivalzeit (`showTime / 2`, Minuten) und nur mit
Fahrgästen; die Bauvorschau zeigt das halbtransparente Modell auf der ganzen
Grundfläche. Trinkwasserstelle und Duschen sind statische Hausstil-Rezepte in
`retroBuildings.ts`.

## Unwetter (0.2.11)

`WorldView.applyStormLight` legt jedes Bild auf die Tag-Nacht-Werte
(`updateDayNight` merkt sich die Basis) eine Verdunkelung von Himmel, Umgebungs-
und Sonnenlicht, in der Warnstunde ansteigend. Blitze sind kurze Helligkeitsstöße
nach einem festen Muster der Simulationszeit; die Zahl der Lichter bleibt gleich.
`src/view/RainView.ts` zeichnet Regen als einen InstancedMesh-Batch um den
Blickpunkt, ausgedünnt durch die Effektdichte; Regen fällt mit der Simulationszeit
und steht bei Pause. Das Wetter-Overlay (`festival.css`) hat `data-storm`.
