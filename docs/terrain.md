# Gelände, Boden, Wege und Umgebung

Autoritative Höhen sind ganzzahlig und Teil der Navigation. Die sichtbare
Oberfläche ist ein gemergtes Mesh mit Atlas; sie darf die Simulation nicht
mutieren. Bodenvorbereitung (Entwässern, Verdichten, Schotter, Pflaster) ist
von Wegbelägen getrennt.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Höhen, Wasser, Edits, Generierung | `src/game/terrain.ts` | `generateTerrain`, `planTerrainEdit`, `getTerrainHeight` |
| Szenario, Weltgröße, Eingang | `src/game/scenario.ts` | `ScenarioSettings`, `SCENARIO_WORLD_SIZES` |
| Umgebungen (Acker, Wüste, …) | `src/game/environments.ts` | `ENVIRONMENTS` |
| Bodenzellen und Vorbereitung | `src/game/ground.ts` | `groundInfo`, `prepareGround`, `prepareGroundArea` |
| Fußweg-/Straßenbeläge | `src/game/wayTypes.ts` | `WAY_TYPES`, `wayInfo`, `wayIssue` |
| Terrain-Balancing | `src/game/simulationConfig.ts` | `terrain` |
| Sichtbares Mesh / Atlas | `src/view/terrainSurface.ts` | ein Draw-Call für den Boden |
| Hänge, Pads, Kanten | `src/view/terrainShape.ts` | `TerrainShape`, `terrainPads` |
| Belagstexturen | `src/view/wayTextures.ts` | `wayTexture` |

## Wichtige Regeln

- Integer-Terrain- und Navigationshöhen nicht durch Render-Meshes ersetzen.
- Actor-/Scenery-Höhen aus denselben Dreiecken in konstanter Zeit lesen;
  keine Raycasts oder Besucher-Scans.
- Mesh nur nach Terrain-, Environment-, Surface-/Compaction- oder
  Footprint-Änderungen neu bauen. Regen ändert einen Material-Tint, nicht
  die Geometrie.
- Gebäude, Wege und ausgewiesene Flächen behalten flache Pads.
- Eingang und Straßenzufahrt bleiben eingeebnet. Geländeeinstellungen gelten
  beim **neuen** Spiel; Laden erzeugt Terrain nicht neu.
- Belagwechsel kostet den neuen Belag voll; Bodenverbesserungen bleiben
  unabhängig vom Way-Type erhalten.

## Tests

`tests/terrainSurface.ts` (Geometrie, Pads, Kontakt, Save-Stabilität, keine
Sim-Mutation). `tests/environments.ts`. `tests/supplyChain.ts` (Bodenarbeiten).

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Umgebungen, Höhenregeln, Ground-Works, Way-Types oder
die Terrain-Mesh-Architektur ändern. Neue Beläge in `wayTypes.ts`, Config,
UI und `README.md` (Spieler) ergänzen.
