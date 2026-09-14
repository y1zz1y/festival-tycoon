# Darstellung und Batching

`WorldView` interpoliert den letzten Snapshot. Animated Stages, Licht,
Picking und Overlays bleiben außerhalb der statischen Batches. Kein
Draw-Call oder Material pro Detailstück oder Besucher.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Szene, Kamera, Picking | `src/view/WorldView.ts` | Haupt-View; ein `LineSegments`-Baugitter 7×7 auf `buildElevation` (Shift oder Höhe ≠ 0) |
| Pixel-Personen | `src/view/pixelPeople.ts` | 6 Visitor-Batches + Accessoires |
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
| Ampeln / Wegschranken | `src/view/AccessControlView.ts` | Geteilte Geometrie, Signalfarbe, Picking über `accessId`. Ampeln rechts an der Fahrbahn, Lampe zum Gegenverkehr. Personentor auf der Ausgangskante, Flügel klappen in die erlaubte Richtung auf |
| Müllablagen / Eimer-Füllstand | `src/view/WasteView.ts` | Instanced Tiles, Ablage-Säcke und Kartons um Eimer; Füllstand nur über Kartonzahl |
| Achterbahnwagen | `src/view/coasterCars.ts` | ein gemergtes Mesh pro Wagen plus Sitzgruppen; Geometrie je Lackfarbe geteilt |

Weitere Views (`*View.ts`) sind in den Fach-MDs genannt und dürfen den
Snapshot nicht autoritativ schreiben.

## Wichtige Regeln

- Statische Details: shared/merged Geometry, Vertex Colors, Instancing.
- Sechs Visitor-Instance-Batches bleiben die Picking-Ziele. Accessoires in
  zusätzlichen kompakten Batches, unabhängig von der Population.
- Weibliche/männliche Varianten: höchstens 32 Instance-Batches insgesamt.
- Custom-BufferGeometry-Buckets nach **Geometrie-Identität** keyen, nicht nur
  nach Constructor-Parametern.
- Light-Anzahl nie zur Laufzeit ändern (Shader-Recompile / Freezes).
  Neue Lichtarten (z. B. `lightBalloon`) nur Farbe, Distance und Intensität
  der vorhandenen acht Slots umschalten, nie extra PointLights erzeugen.
- Preview-Materials dürfen gebaute Instanzen nicht einfärben oder disposen.

## Tests

`tests/performanceGuards.ts`, `tests/pixelPeople.ts`, `tests/campingModels.ts`,
`tests/terrainSurface.ts`. Messungen: `docs/performance.md`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Batch-Grenzen, Light-Architektur, ein neuer permanenter
View-Zweig oder Picking-Ziele ändern. Neue sichtbare Objekte brauchen einen
Batch-Plan, bevor einzelne Meshes entstehen.
