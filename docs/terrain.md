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
| Weg- und Straßenrampen | `src/game/wayElevation.ts` | Halbstufen `0.5`, `MAX_PATH_ELEVATION` 6, Autodach `MAX_ROAD_RAISE` 1; `planLockedOriginRamp` / Shift-Ausgang |
| Bauhöhe / Bodenkachel | `src/game/placementPreview.ts`, `src/view/WorldView.ts` | Gebäude/Deko/Achterbahn-Start rasten auf 0.5; gelbe Bodenkachel-Markierung unter dem Zeiger |
| Terrain-Balancing | `src/game/simulationConfig.ts` | `terrain` |
| Sichtbares Mesh / Atlas | `src/view/terrainSurface.ts` | ein Draw-Call für den Boden |
| Hänge, Pads, Kanten | `src/view/terrainShape.ts` | `TerrainShape`, `terrainPads` |
| Belagstexturen | `src/view/wayTextures.ts` | `wayTexture`, `parkingTexture` |

## Wichtige Regeln

- Integer-Terrain- und Navigationshöhen nicht durch Render-Meshes ersetzen.
  Die freie Bauhöhe (Gebäude, Deko, Achterbahn-Start) rastet ebenfalls auf
  **halbe** Stufen (`0.5`, 0–6); Autodach bleibt 1.0. Im Baumodus liegt auf
  der Bodenkachel unter dem Zeiger immer eine Markierung, auch bei angehobenem
  Ghost. Gebaute Wege und Straßen nutzen **halbe** Höhenstufen (`0.5`). Alte
  ganzzahlige Weghöhen bleiben 1.0 Welteinheiten (zwei Halbstufen), nicht 0.5.
  Fußwege dürfen bis Ebene 6; Straßenrampen höchstens eine Stufe über dem
  lokalen Gelände (Autos). Im Stückmodus sperrt gehaltenes Shift die
  Ausgangskachel (`lockShiftElevationOrigin`); weitere Felder bekommen die
  Rampe relativ dazu, die Ausgangskachel ändert weder Ort noch Höhe.
- Actor-/Scenery-Höhen aus denselben Dreiecken in konstanter Zeit lesen;
  keine Raycasts oder Besucher-Scans.
- Mesh nur nach Terrain-, Environment-, Surface-/Compaction-, Parkplatz- oder
  Footprint-Änderungen neu bauen. Regen ändert einen Material-Tint, nicht
  die Geometrie.
- Gebäude, Wege und ausgewiesene Flächen behalten flache Pads.
- Ausgewiesene Parkplätze (`logistics.parkingCells`) nutzen im Atlas die
  Asphalt-Zeile `parking` (grau, Stellplatzmarkierung). Nur diese Felder,
  nicht Straßen, Fußwege oder Wiese. Kanten bleiben scharf wie bei
  vorbereitetem Boden. Belegungsfarben und das P gehören zur
  Autostraßen-Bauansicht, nicht zum Gelände-Mesh. Nach dem Aufheben der
  Bucht darf kein Park-Asphalt und keine Belegung zurückbleiben.
- Eingang und Straßenzufahrt bleiben eingeebnet. Geländeeinstellungen gelten
  beim **neuen** Spiel; Laden erzeugt Terrain nicht neu.
- Belagwechsel kostet den neuen Belag voll; Bodenverbesserungen bleiben
  unabhängig vom Way-Type erhalten.
- Fußweg und Autostraße dürfen dieselbe Kachel teilen (`wayOverlapsRoadGrade`
  in `wayElevation.ts`): der Fußweg wird zum Übergang, die Autostraße bleibt
  stehen (Zebrastreifen). Eine volle Wegplatte verdeckt die Straße nicht.
  Eine Ebene darüber bleibt ein Steg. Warteschlangen liegen nicht auf der
  Fahrbahn. Zwei Autostraßen auf einer Kachel: gleiche Höhe aktualisiert
  die Lage, eine höhere Lage stapelt eine Brücke (`roadLayerKey`).
  `placePath` / `placeRoad` löschen keine Nachbar-Straßen.

## Tests

`tests/terrainSurface.ts` (Geometrie, Pads, Kontakt, Save-Stabilität, keine
Sim-Mutation, Parkplatz-Asphalt nur auf Parkfeldern). `tests/environments.ts`.
`tests/operations.ts` (Parkplatz-Abriss gibt die Kachel frei).
`tests/supplyChain.ts` (Bodenarbeiten).
`tests/wayElevation.ts` (Halbstufen-Rampen, beide Way-Typen, Autodach, Save-Migration,
fester Shift-Ausgang beim Rampenstreichen, Fußweg auf Autostraße behält die
Straße, ein Straßenfeld übermalen löscht keine Nachbarn).
`tests/placementPreview.ts` (Gebäude-Bauhöhe 0.5, Bodenkachel der Vorschau).

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Umgebungen, Höhenregeln, Ground-Works, Way-Types oder
die Terrain-Mesh-Architektur ändern. Neue Beläge in `wayTypes.ts`, Config,
UI und `README.md` (Spieler) ergänzen.

## Bauhöhen-Eingabe (0.1.126)

Shift setzt über bebautem Feld einmalig auf die auf 0,5 aufgerundete Oberkante.
Höhe folgt danach der absoluten vertikalen Mausdistanz (48 px pro Halbstufe).
Weg-/Straßen-Ausgangspunkt bleibt beim Einstellen fest. Neigung wird separat
gewählt. Kurzer Rechtsklick im jeweiligen Baumodus entfernt nur Weg bzw. Straße.

## Überarbeitete Wegoberflächen (0.1.127)

Alle acht Beläge erhalten differenzierte Texturen aus `wayTextures.ts`.
Kacheln schließen lückenlos an. Erhöhte Wege bekommen offene Anschlusskanten,
Geländer und schlanke Stützen aus `wayStructures.ts`; Erhöhung wird relativ
zum Gelände gemessen. Rampenstützen enden an ihrer lokalen Unterseite,
Unterführungen bleiben stützenfrei. Navigation, Kosten und Höhen bleiben gleich.
