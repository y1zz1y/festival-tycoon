# Darstellung und Batching

`WorldView` interpoliert den letzten Snapshot. Animated Stages, Licht,
Picking und Overlays bleiben außerhalb der statischen Batches. Kein
Draw-Call oder Material pro Detailstück oder Besucher.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Szene, Kamera, Picking | `src/view/WorldView.ts`, `src/view/picking.ts` | Haupt-View; `pickPlacedObject` für Info/Abriss (Batches, Tore, Ampeln, Logistik); ein `LineSegments`-Baugitter 7×7 auf `buildElevation` (Shift oder Höhe ≠ 0); Personalzonen: ein InstancedMesh für zugewiesene 3×3 plus Hover-Vorschau (`setStaffZonePaintTool`) |
| Pixel-Personen | `src/view/pixelPeople.ts` | 6 Visitor-Batches + Accessoires |
| Souvenir-Props | `src/view/souvenirMeshes.ts` | 1 Maskottchen- + 4 Shirt-Schnitt-Batches, Instanzfarbe |
| Gebäude-Instancing | `src/view/retroBuildings.ts` | ein gemergtes Vertex-Color-Mesh je `DETAILED_BUILDINGS`-Art inkl. aller `SCENERY_KINDS`; Themen-Deko über `buildThemedScenery` (Familien + Vertexfarben); Instanz-`buildingIds` für Picking |
| Camping-Batches | `src/view/campingModels.ts`, `src/view/batchCampMeshes.ts` | 14 Camping-Batches |
| Terrain-Mesh | `src/view/terrainSurface.ts`, `src/view/terrainShape.ts` | ein Boden-Draw-Call, zwei Dreiecke je Kachel; Parkfelder als Atlas-`parking` |
| Objektstützen | `src/game/supportOccupancy.ts`, `src/view/supports.ts` | geteilter Zylinder; nur bei Luft unter dem Objekt |
| Lichter | `src/view/FestivalLightsView.ts` | fester Pool (8 PointLights, 4 SpotLights); Deko-Lampenfarben aus `decorationLights.ts` |
| Auflösungscaps | `src/view/renderResolution.ts` | max. 1440×810 intern |
| Touch-Kamera | `src/view/touchCamera.ts` | Zwei-Finger-Pan/Zoom |
| Dispose | `src/view/disposeObject3D.ts` | GPU-Ressourcen |
| Browser-Messharness | `tests/render-performance.html` | |
| Logistik-Einbahn-Overlay | `src/view/LogisticsView.ts`, `src/view/roadDirectionArrow.ts` | Weiße StVO-Pfeile nach den Fahrzeugen; kompaktes InstancedMesh-Overlay nur bei Werkzeug Fahrtrichtung. Parkflächen: geteiltes Asphaltmaterial plus `parkingTexture` (Stelllinien in der Textur). Grün/Orange und das P nur in der Autostraßen-Bauansicht oder im Logistik-Overlay (`showParkingHelpers`) |
| Buslinien-Planerroute | `src/view/LogisticsView.ts` `setPlannerRoute` | Eine `Line` / ein Material für die Stoppfolge plus ein Mesh mit geteiltem Zahlenatlas (1, 2, 3 …) an den Halten; weg beim Schließen des Reiters |
| Logistik-Modelle | `src/view/logisticsModels.ts` | ModelKit-Gebäude und Fahrzeuge; Besucherautos teilen Geometrie je Lackfarbe |
| Straßenrampen | `src/view/LogisticsView.ts` | Deck kippt um `roadSlope`; Stützen bei Erhöhung; Fahrzeuge folgen `waySurfaceY` |
| Depot-Träger | `src/view/carrierModels.ts`, `src/view/SupplyChainView.ts` | dieselbe Personen-Geometrie wie Gäste; eine gemergte Warnwesten-/Mützen-Kit, ein Handkarren, ein Ladungsstapel |
| Ampeln / Wegschranken | `src/view/AccessControlView.ts` | Geteilte Geometrie, Signalfarbe, Picking über `accessId`. Ampeln rechts an der Fahrbahn, Lampe zum Gegenverkehr. Personentor auf der Ausgangskante (`gateEdgeWorldPosition`), Flügel klappen in die erlaubte Richtung auf |
| Personaleingang | `src/view/SupplyChainView.ts` | Goldene Pfosten auf derselben Kante via `staffGateWorldPosition`; fehlendes `staffGateDirection` bleibt Legacy-Mitte |
| Müllablagen / Eimer-Füllstand | `src/view/WasteView.ts` | Instanced Tiles, Ablage-Säcke und Kartons um Eimer; Füllstand nur über Kartonzahl |
| Backstage-Overlay | `src/view/BackstageView.ts` | ein `InstancedMesh` (aktiv teal / getrennt amber); außerhalb der Gebäude-Batches |
| Band-Akteure | `src/view/BandActorView.ts`, `src/view/bandMemberMesh.ts` | dieselbe gemergte Musiker-Geometrie wie `stageBand.ts`; geteiltes Vertex-Color-Material; ausgeblendet bei `vehicleId` oder `performing` |
| Achterbahnwagen | `src/view/coasterCars.ts` | ein gemergtes Mesh pro Wagen plus Sitzgruppen; Geometrie je **Zugstil + Lackfarbe** geteilt (`sitDownSteel`, `wooden`, `bmSitdown`, `invertV`, `flying`, `standUp`, `junior`, `mouse`, `bobsled`, `mine`, `swinging`, `launched`, `giga`). Derselbe Wagen wird als 96-px-Katalogkachel gerendert (`WorldView.coasterTrainThumbnail`) |
| Achterbahnschienen | `src/view/coasterTrack.ts` via `WorldView.rebuildCoasters` | ein vertex-color Mesh je Stück. Schienen sind **Segmentboxen entlang der diskreten Sample-Polylinie** (Heading/Pitch/Bank, ein Basisvektor pro Segment, leichter Überlapp, kein jedes-zweite-Sample mit fester 0,14-Länge). Schwellen, Stützen, optional Spine/Trog im selben Mesh. Geteiltes Material. Animierte Züge, Specials (Foto/Splash) und Picking bleiben außerhalb des statischen Batches. Stil-Tabelle: `steelLattice`, `wooden`, `boxSpine`, `invertedBox`, `flyingSpine`, `juniorTubular`, `wildMouse`, `woodenMouse`, `bobsledTrough`, `suspendedSpine`, `gigaLattice`, `launchedSteel` |
| Stand-Queue-Spuren | `src/view/WorldView.ts` `addQueueBarriers` | Mittelschiene und zwei Pfeile am Queue-Mesh; bleibt im Gebäude-Batch |

Weitere Views (`*View.ts`) sind in den Fach-MDs genannt und dürfen den
Snapshot nicht autoritativ schreiben.

## Wichtige Regeln

- Statische Details: shared/merged Geometry, Vertex Colors, Instancing.
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
  Transformationen und separate Schlaf-/Musik-Sprites bleiben erhalten.
  Bollerwagen teilen ihre statische Geometrie und Materialien.
- `disposeObject3D` entsorgt bei `InstancedMesh` auch dessen Instanzattribute;
  Geometrie-/Material-Disposal allein gibt diese GPU-Puffer nicht frei.
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
- Light-Anzahl nie zur Laufzeit ändern (Shader-Recompile / Freezes).
  Acht PointLights, vier SpotLights und das Cursor-Licht bleiben immer
  in der Szene. Neue Deko-Lampen (`auroraLamp`, `gasLamp`, …) nur Farbe,
  Höhe, Distance und Intensität der vorhandenen Slots setzen; Glow/Birne
  sind InstancedMeshes außerhalb der statischen Scenery-Batches. Kein
  Material oder Draw-Call pro Glühbirne.
- Preview-Materials dürfen gebaute Instanzen nicht einfärben oder disposen.
- Depot-Träger teilen die Gäste-Körperteile. Warnweste, Handkarren und
  Ladung sind je eine gemergte, vertex-gefärbte Geometrie — kein Mesh
  pro Latte, Schloss oder Kiste. Picking bleibt `staffId` auf der Figur.

## Tests

`tests/performanceGuards.ts`, `tests/pixelPeople.ts`, `tests/carrierModels.ts`,
`tests/campingModels.ts`, `tests/terrainSurface.ts`, `tests/picking.ts`. Messungen: `docs/performance.md`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Batch-Grenzen, Light-Architektur, ein neuer permanenter
View-Zweig oder Picking-Ziele ändern. Neue sichtbare Objekte brauchen einen
Batch-Plan, bevor einzelne Meshes entstehen.

## Themenmodelle und Fassaden (0.1.125)

`retroBuildings.ts` ergänzt Nicht-Klassik-Modelle durch `embellishTheme` und
überarbeitete Blätter, Laternen, Möbel, Zahnräder und Eisdetails.
40 Fassadenmodelle stammen aus `decorationWalls.ts`; offene Fenster/Türen,
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

`wayStructures.ts` erzeugt gemeinsame gemergte Geometrie für Randsteine,
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
`wayTextures.ts` bäckt differenzierte 64px-Beläge (Bohlen mit Fugen/Nägeln,
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
