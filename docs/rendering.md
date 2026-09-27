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
| Logistik-Modelle | `src/view/logisticsModels.ts` | ModelKit-Gebäude und Fahrzeuge; `createRoadVehicleModel` (Einzelmodell, Besucherautos je Lackfarbe) für Vorschau/Tests/Lieferwagen; `roadVehicleParts` liefert für die Batches je Art eine Geometrie, Besucherautos als weiße Lackhülle (Instanzfarbe) plus gemeinsame Details |
| Fahrbahnmarkierungen | `src/view/roadMarkings.ts`, `src/view/wayStructures.ts`, `src/view/LogisticsView.ts` | Aus `classifyRoadLanes` (`src/game/roadLanes.ts`) beim statischen Neuaufbau; Mittel-/Randlinien, Eckbögen, Einfahrt und Grünkeil in der gecachten Wegstruktur-Geometrie, Spurpfeile als Bauhilfe-Batch |
| Straßenfahrzeuge | `src/view/LogisticsView.ts` | ein `InstancedMesh` je Fahrzeuggeometrie (höchstens 10), Instanzfarbe, `userData.vehicleIds`, Posen je ID; `getVehiclePickRoot()` enthält nur die Batches |
| Instanz-Batches | `src/view/instanceBatch.ts` | `InstanceBatch` (begin/add/finish, Zweierpotenz-Kapazität, `DynamicDrawUsage`, nur benutzter Bereich hochgeladen, `boundingSphere = null` nach jedem Füllen, ID-Array je Instanz), `placementMatrix` |
| Personal und Träger | `src/view/crewInstances.ts`, `src/view/StaffView.ts`, `src/view/SupplyChainView.ts` | `CrewInstances`: ein fester Satz Batches (Torso m/w, Büste, Kopf, Beine, Arme, 16 Haarvarianten, zwei Mützen, Besen, Müllsack, Warnweste, Karren, Ladung), jedes Bild neu gefüllt; `staffIds` für Picking |
| Ankunftstor | `src/view/ArrivalGateView.ts` | Tor mit Banner, Fußgänger-Piktogramm, Fahne und Bodenpfeilen über dem Feld `entrance-path`; ein gemergtes Mesh im `HOUSE_MATERIAL` (ein Draw-Call), `userData.buildingId` für das Picking, zeigt vom nächsten Kartenrand ins Gelände |
| Bühnenvorplätze | `src/view/ForecourtView.ts`, `src/view/coverOverlay.ts` | Steinrahmen als ein `AreaEdgeBatch` (InstancedMesh), Innenbereich offen; Signatur `x:z:elevation` |
| Straßenrampen | `src/view/LogisticsView.ts` | Deck kippt um `roadSlope`; Stützen bei Erhöhung; Fahrzeuge folgen `waySurfaceY` |
| Depot-Träger | `src/view/carrierModels.ts`, `src/view/SupplyChainView.ts` | dieselbe Personen-Geometrie wie Gäste; eine gemergte Warnwesten-/Mützen-Kit, ein Handkarren, ein Ladungsstapel; im Spiel Instanzen im Crew-Pool, Einzelmodelle nur für Vorschau und Tests |
| Ampeln / Wegschranken | `src/view/AccessControlView.ts` | Sechs Instanz-Batches (Ampelkörper, Torrahmen, Torflügel, Lampe grün, Lampe rot, Einbahnpfeil), Picking über `accessIds[instanceId]`. Ampeln rechts an der Fahrbahn, Lampe zum Gegenverkehr. Personentor auf der Ausgangskante (`gateEdgeWorldPosition`), Flügel klappen in die erlaubte Richtung auf |
| Personaleingang | `src/view/SupplyChainView.ts` | Goldene Pfosten auf derselben Kante via `staffGateWorldPosition`, alle Tore ein Instanz-Batch; fehlendes `staffGateDirection` bleibt Legacy-Mitte |
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
  zusätzlichen kompakten Batches, unabhängig von der Population. Nach jedem
  Schreiben setzt `updateVisitors` `boundingSphere = null`: `InstancedMesh`
  rechnet die Kugel beim Raycast nur einmal aus, und Gäste außerhalb der
  Kugel vom ersten Klick wären sonst nicht mehr anklickbar.
  `ensureVisitorInstances` verwendet beim Wachsen dieselben zwei Materialien
  weiter (früher zwei neue je Wachstum). Die Crew-Batches von Personal und
  Trägern sind keine Visitor-Picking-Ziele; sie haben `CrewInstances.pick`.
  Abriss/Info wählen zuerst das nächste Mesh mit `buildingId` /
  `buildingIds[instanceId]` bzw. `accessIds[instanceId]` (Einzelmodelle:
  `accessId` an einem Vorfahren), aufgelöst über
  `accessIdFromObject(object, hit.instanceId)`; ein unbeschrifteter Treffer
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
  pro Latte, Schloss oder Kiste. Picking bleibt die Träger-ID (`staffIds`
  je Instanz im Crew-Pool; Einzelmodelle tragen weiter `staffId`).

## Tests

`tests/performanceGuards.ts`, `tests/pixelPeople.ts`, `tests/visitorDance.ts`,
`tests/carrierModels.ts`, `tests/renderBatching.ts` (Crew-Pool, Fahrzeuge,
Ampeln/Tore, festivalmittel-Zensus),
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
Auch Legacy-Beläge ohne WayType bekommen Textur. Mittellinien kommen seit 0.3.3
aus den Fahrspuren (siehe Fahrbahnmarkierungen); einspurige Geraden bleiben
ohne. Geschwindigkeits-Farbtönung erscheint nur mit Straßenbauhilfen.
Gebäude-Fingerprint berücksichtigt Straßenlagen und Rampenrichtung, damit
Unterführungsstützen bei Änderungen neu aufgebaut werden.

Tests: `tests/wayStructures.ts`, visuell `tests/ways-preview.html` im echten
WorldView. Tests umfassen alle Richtungen/Steigungen, Anschlüsse, Terrain-Höhe,
freie untere Lagen und 200 gleiche Konstruktionen in einem Instanz-Batch.

## Fahrbahnmarkierungen (0.3.3)

Markierungen folgen den abgeleiteten Fahrspuren (`src/game/roadLanes.ts`,
Regeln in [`logistics.md`](logistics.md)). `LogisticsView.rebuildStatic`
klassifiziert die Straßenkacheln des Snapshots einmal je Neuaufbau (nur bei
Strukturänderung, nie pro Bild; die Weltgröße kommt über `setWorldSize`),
`roadWayMarks` (`src/view/roadMarkings.ts`) liefert je Kachel reine Daten in
kachellokalen Koordinaten, und `wayStructurePlan` / `createWayStructure`
mergen sie in die gecachte Wegstruktur-Geometrie der Kachel (Vertexfarben,
ein geteiltes Material, Cache-Schlüssel = Plan, gebündelt über
`batchRetroBuildings`). Kein neuer Materialkonstruktor; `roadMarkings.ts`
hat keinen.

- Spuren: Mittellinie auf der gemeinsamen Kante, gezeichnet nur von der
  +Z-/+X-Spur des Paars; gestrichelt auf Geraden, durchgezogen auf der letzten
  Kachel vor einem Knoten, Platz, Einfahrt oder einer einspurigen Straße;
  dünne Randlinie außen. Nur auf Asphalt (`wayPaintFor`): Fahrplatten zeigen
  statt Farbe eine hellere Fuge als Trenner, Schotter und Erde nichts.
- Knoten: keine Linien. Eckblock (2×2-Knoten mit zwei senkrechten Ausfahrten):
  Mittellinie als Viertelkreis (Radius 1 um die Innenecke) auf der Innenkachel,
  äußerer Bordstein als Viertelkreis (Radius 2) mit Grünkeil in der Außenecke;
  die geraden Bordsteine dieser Außenkanten entfallen (`hideKerbs`). Innenecke
  bleibt fast spitz. Auf Rampen keine Bögen.
- Einfahrt: doppelte durchgezogene Linie zwischen x −1 und x 0, gestrichelte
  Trenner zwischen Spuren gleicher Richtung. Keine Linien, wenn der Stummel
  `open` ist oder auf einer der beiden Kacheln an der Linie gesetzte Einbahnen
  liegen (dort wird frei gewechselt).
- Einspurige Straßen und Plätze: keine Linien (die früheren Striche auf
  isolierten Geraden sind entfallen).
- Zebrastreifen: Streifen längs der Fahrtrichtung (`roadTrafficAxis`), also
  quer über die Spuren; auf Rampen mit gedrehter Kachel entsprechend getauscht.
- Ampel (`AccessControlView`): Modell rechts vom Fahrer der geregelten
  Richtung; die Haltelinie ist Teil der Ampelkörper-Geometrie (kein weiterer
  Batch, weiter höchstens sechs Batches) und liegt quer über der Spur an der
  Kante, über die der Verkehr ins Ampelfeld einfährt — dort, wo Autos bei Rot
  halten.
- Spurpfeile (abgeleitete Fahrtrichtung, nur ohne gesetzte Einbahn) liegen als
  eigener gebündelter Pfeil-Batch in `laneArrowGroup` und sind nur mit den
  Straßenbauhilfen sichtbar (`showParkingHelpers`); gesetzte Einbahnen behalten
  ihre dauerhaften Pfeile.
- `ModelKit.ground` (flaches Polygon) liefert den Grünkeil.

Zebrastreifen-Kacheln tragen keine Mittel- oder Randlinie.

Tests: `tests/roadLanes.ts` (Markierungsdaten, gleiche Eckstücke auf
verschiedenen Kacheln teilen die Geometrie, ein Strukturmaterial, keine losen
Meshes, Zebra-Achse für Straßen entlang X und Z, keine Stummellinie bei `open`
oder Einbahnen, Ampelseite und Haltelinienlage) und
`tests/performanceGuards.ts` (Materialdecken unverändert). Visuell:
`tests/lanes-preview.html` im echten WorldView (Einfahrt, Kreuzung mit Ampeln,
Eckblock, einspurige Einmündung, Platz, Zebrastreifen, Fahrplatten).

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

Die damals noch einzeln gezeichneten Objekte (Personal 335 Meshes mit 217
Materialien, Träger 335, Fahrzeuge 204, Bühnenvorplätze 81, Zugangsobjekte
53) sind seit Phase 6 (B8) gebündelt, siehe „Personal, Träger, Fahrzeuge
und Zugänge gebündelt“. Noch einzeln: Band-Akteure (`BandActorView`, eine
Gruppe je Musiker), Besucher-Bollerwagen (eine geteilte Gruppe je Wagen) und
die Titelmenge.

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

## Personal, Träger, Fahrzeuge und Zugänge gebündelt (0.2.12, Phase 6, B8)

Die letzten Objekte mit Mesh (und oft Material) pro Figur, Fahrzeug oder Feld
zeichnen jetzt feste Instanz-Batches. Headless-Zensus auf festivalmittel
(sichtbare Meshes plus InstancedMeshes mit Instanzen, kameraunabhängig):
1.008 → 45 Objekte (Personal 335 und Warenkette 335 → Crew-Pool 28 plus
4 für Balken, Tore und Depots; Fahrzeuge 204 → 6, Vorplatz 81 → 1,
Ampeln/Tore 53 → 6). Im Browser (1280×720) fallen die Draw-Calls in der
Standardkamera von 844 auf 342, bei Zoom 0,55 von 1.288 auf 476 und in der
Parkplatzansicht von 375 auf 204. Die Szene hat danach 1.334 statt 1.745
Materialien. Details stehen in [performance.md](performance.md).

**Dynamische Batches** (`src/view/instanceBatch.ts`, `InstanceBatch`):

- `begin` setzt den Zähler auf null, `add` hängt eine Instanz an (Matrix,
  optional ID und Farbe), `finish` setzt `count`, lädt nur den benutzten
  Bereich hoch (`addUpdateRange`) und setzt `boundingSphere = null`, damit
  Frustum-Culling und Raycasts die Kugel für die neuen Positionen neu rechnen.
- Kapazität in Zweierpotenzen ab 16, `DynamicDrawUsage`; beim Wachsen wandern
  die schon geschriebenen Instanzen mit, das alte Mesh wird mit `dispose()`
  freigegeben (Geometrie und Material bleiben geteilt).
- Ein leerer Batch kostet keinen Draw-Call: `finish` blendet ihn aus
  (`visible = count > 0`), sodass three ihn nicht einmal vorbereitet. Der
  Shader-Compile beim Laden läuft auch über ausgeblendete Objekte; Views legen
  ihre Batches deshalb im Konstruktor an, zur Laufzeit wird nie die ganze Szene
  kompiliert.
- Picking-IDs je Instanz in `userData.staffIds` / `vehicleIds` / `accessIds`
  (Index = `instanceId`), gelesen über `instanceOwnerId` bzw.
  `accessIdFromObject(object, instanceId)` in `src/view/picking.ts`.

**Materialien:** Ein Material bedient entweder nur Instanz-Batches mit
Instanzfarbe oder nur solche ohne, und nie zusätzlich ein normales Mesh —
jeder Wechsel baut sonst das Shaderprogramm neu. `houseVariant(roughness,
metalness)` in `materials.ts` liefert dafür feste Kopien des Hausmaterials
(Klone zählen nicht in `MATERIAL_CEILINGS`, sind aber pro Aufrufstelle genau
eine). Die Obergrenzen sinken: `StaffView.ts` 8 → 0, `ForecourtView.ts`
1 → 0, `AccessControlView.ts` 7 → 2, `SupplyChainView.ts` 2 → 1.

**Crew-Pool** (`src/view/crewInstances.ts`, `CrewInstances`): Personal und
Träger teilen einen festen Satz von 29 Batches: Torso männlich/weiblich,
Büste, Kopf, Beine (zwei Instanzen je Person), Arme (zwei), 16 Haar-/
Detailvarianten, zwei Mützen (Zylinder, Kegel für die Feuerwehr), Besen,
Müllsack, Warnweste, Handkarren und Ladung. Uniform, Haut, Hose und Mütze
kommen aus der Instanzfarbe (weiße Vertexfarben mal Instanzfarbe), Haare,
Besen und Sack aus ihren Vertexfarben, Weste/Karren/Ladung aus einer Kopie
des Träger-Kit-Materials. `WorldView` ruft `crew.begin()` vor
`StaffView.update` und `crew.finish()` nach `SupplyChainView.animate`, vor den
Personen-Vorschauen. Ohne übergebenen Pool legt eine View ihren eigenen an
(Tests). Die Glieder setzt `composeLimb` (`pixelPeople.ts`), dieselbe
Pose × Gelenk-Rechnung wie bei den Gästen. Zustand zwischen Frames liegt in
schlichten Datensätzen je ID (Interpolation, Blickrichtung, Glättung,
`getCarrierPosition`), nicht in Object3D-Bäumen.

**Fahrzeuge:** siehe [logistics.md](logistics.md); höchstens zehn Batches
(sieben Arten, zwei Lackhüllen, eine Autodetail-Geometrie), eigene Kopie des
Fahrzeugmaterials mit Instanzfarbe, Schatten wie zuvor. Geplant waren
höchstens neun Batches mit einem angenäherten grauen Dach für alle Autos.
Das silberne Auto hat stattdessen eine eigene Hülle. So bleibt das dunklere
Dach exakt, und die Dächer aller anderen Farben bleiben ebenfalls exakt.
Das kostet einen Batch mehr.

**Warenkette:** Füllstandsbalken sind ein Batch aus einem weißen
Einheitswürfel (Rahmen und Füllung je eine Instanz), neu geschrieben nur bei
Datenänderung oder gedrehter Kamera; Personaltore ein Batch; Depotgebäude
über `batchRetroBuildings`.

**Vorplatz und Zugänge:** `ForecourtView` ist ein Overlay-Batch mit
`overlayMaterial` (schreibt wie Sanität und Backstage keine Tiefe mehr).
`AccessControlView` trennt Layout (ID, Lage, Richtung, Durchgang und
Bodenhöhe) von den Signalen: ein Signalwechsel verschiebt nur Lampen
zwischen dem grünen und roten Batch und dreht die Torflügel, Batches und
Layout bleiben.

**Kleine sichtbare Abweichungen:** Mützen, Besen und Säcke sind jetzt so matt
wie die Figuren (Rauheit 0,9 statt 0,7 bzw. 1), das Trägerhemd 0,9 statt
0,85, Ampel- und Torkörper nutzen die Hausstil-Rauheit 0,85 statt 0,55–0,78.
Formen, Farben, Maße, Animationen und Picking sind unverändert; ein
Headless-Vergleich der alten Einzelmodelle mit den Instanzen (Personal aller
Rollen, Ampeln, offene/geschlossene Tore) ergab höchstens 1e-6 Abweichung in
den Vertex-Bounds.
