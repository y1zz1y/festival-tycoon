# Darstellung und Batching

`WorldView` interpoliert den letzten Snapshot. Animated Stages, Licht,
Picking und Overlays bleiben außerhalb der statischen Batches. Kein
Draw-Call oder Material pro Detailstück oder Besucher.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Szene, Kamera, Picking | `src/view/WorldView.ts` | Haupt-View; ein `LineSegments`-Baugitter 7×7 auf `buildElevation` (Shift oder Höhe ≠ 0) |
| Pixel-Personen | `src/view/pixelPeople.ts` | 6 Visitor-Batches + Accessoires |
| Souvenir-Props | `src/view/souvenirMeshes.ts` | 1 Maskottchen- + 4 Shirt-Schnitt-Batches, Instanzfarbe |
| Gebäude-Instancing | `src/view/retroBuildings.ts` | |
| Camping-Batches | `src/view/campingModels.ts`, `src/view/batchCampMeshes.ts` | 14 Camping-Batches |
| Terrain-Mesh | `src/view/terrainSurface.ts`, `src/view/terrainShape.ts` | ein Boden-Draw-Call |
| Lichter | `src/view/FestivalLightsView.ts` | fester PointLight-Pool; warm gelb vs. weiße Tageslichtballons über Instanzfarben |
| Auflösungscaps | `src/view/renderResolution.ts` | max. 1440×810 intern |
| Touch-Kamera | `src/view/touchCamera.ts` | Zwei-Finger-Pan/Zoom |
| Dispose | `src/view/disposeObject3D.ts` | GPU-Ressourcen |
| Browser-Messharness | `tests/render-performance.html` | |
| Logistik-Einbahn-Overlay | `src/view/LogisticsView.ts`, `src/view/roadDirectionArrow.ts` | Weiße StVO-Pfeile nach den Fahrzeugen; kompaktes InstancedMesh-Overlay nur bei Werkzeug Fahrtrichtung |
| Logistik-Modelle | `src/view/logisticsModels.ts` | ModelKit-Gebäude und Fahrzeuge; Besucherautos teilen Geometrie je Lackfarbe |
| Depot-Träger | `src/view/carrierModels.ts`, `src/view/SupplyChainView.ts` | dieselbe Personen-Geometrie wie Gäste; eine gemergte Warnwesten-/Mützen-Kit, ein Handkarren, ein Ladungsstapel |
| Ampeln / Wegschranken | `src/view/AccessControlView.ts` | Geteilte Geometrie, Signalfarbe, Picking über `accessId`. Ampeln rechts an der Fahrbahn, Lampe zum Gegenverkehr. Personentor auf der Ausgangskante (`gateEdgeWorldPosition`), Flügel klappen in die erlaubte Richtung auf |
| Personaleingang | `src/view/SupplyChainView.ts` | Goldene Pfosten auf derselben Kante via `staffGateWorldPosition`; fehlendes `staffGateDirection` bleibt Legacy-Mitte |
| Müllablagen / Eimer-Füllstand | `src/view/WasteView.ts` | Instanced Tiles, Ablage-Säcke und Kartons um Eimer; Füllstand nur über Kartonzahl |
| Achterbahnwagen | `src/view/coasterCars.ts` | ein gemergtes Mesh pro Wagen plus Sitzgruppen; Geometrie je Lackfarbe geteilt |
| Achterbahnschienen | `src/view/WorldView.ts` `rebuildCoasters` | zwei Tube-Schienen pro Stück aus `getSmoothedCoasterPiecePoints`; CatmullRom mit Ghost-Tangenten der Nachbarstücke, damit Joins nicht knicken |
| Stand-Queue-Spuren | `src/view/WorldView.ts` `addQueueBarriers` | Mittelschiene und zwei Pfeile am Queue-Mesh; bleibt im Gebäude-Batch |

Weitere Views (`*View.ts`) sind in den Fach-MDs genannt und dürfen den
Snapshot nicht autoritativ schreiben.

## Wichtige Regeln

- Statische Details: shared/merged Geometry, Vertex Colors, Instancing.
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
  Maskottchen und gekaufte Shirts sind solche Accessoire-Batches (kein Mesh
  pro Figur). Darstellung interpoliert nur aus dem Snapshot.
- Weibliche/männliche Varianten: höchstens 32 Instance-Batches insgesamt.
- Die geteilte Brustgeometrie in `pixelPeople.ts` verwendet ausschließlich
  den Hautton, ohne Brustwarzen-Geometrie oder farbige Markierungen.
- Custom-BufferGeometry-Buckets nach **Geometrie-Identität** keyen, nicht nur
  nach Constructor-Parametern.
- Light-Anzahl nie zur Laufzeit ändern (Shader-Recompile / Freezes).
  Neue Lichtarten (z. B. `lightBalloon`) nur Farbe, Distance und Intensität
  der vorhandenen acht Slots umschalten, nie extra PointLights erzeugen.
- Preview-Materials dürfen gebaute Instanzen nicht einfärben oder disposen.
- Depot-Träger teilen die Gäste-Körperteile. Warnweste, Handkarren und
  Ladung sind je eine gemergte, vertex-gefärbte Geometrie — kein Mesh
  pro Latte, Schloss oder Kiste. Picking bleibt `staffId` auf der Figur.

## Tests

`tests/performanceGuards.ts`, `tests/pixelPeople.ts`, `tests/carrierModels.ts`,
`tests/campingModels.ts`, `tests/terrainSurface.ts`. Messungen: `docs/performance.md`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Batch-Grenzen, Light-Architektur, ein neuer permanenter
View-Zweig oder Picking-Ziele ändern. Neue sichtbare Objekte brauchen einen
Batch-Plan, bevor einzelne Meshes entstehen.
