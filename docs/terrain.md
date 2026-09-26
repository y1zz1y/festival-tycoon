# Gelände, Boden, Wege und Umgebung

Autoritative Höhen rasten auf **0,5** und sind Teil der Navigation. Die
sichtbare Oberfläche ist ein gemergtes Mesh mit Atlas; sie darf die Simulation
nicht mutieren. Bodenvorbereitung (Entwässern, Verdichten, Schotter, Pflaster)
ist von Wegbelägen getrennt.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Höhen, Ecken, Wasser, Edits | `src/game/terrain.ts` | `generateTerrain`, `planTerrainEdit`, `planTerrainAreaEdit`, `tileVisualCorner`, `terrainWalkEdgeHeights`, `sampleTerrainSurface`, `tileShowsWater`, `getTerrainHeight`, `getWaterLevel` |
| Gelände-Cache | `src/game/GameState.ts` | `rebuildTerrainCache` speichert Halbstufen als `height * 2` |
| Stützen nur im Freiraum | `src/game/supportOccupancy.ts` | `supportGap`, `tileSupportSolids` |
| Szenario, Weltgröße, Eingang | `src/game/scenario.ts` | `ScenarioSettings`, `SCENARIO_WORLD_SIZES` |
| Umgebungen (Acker, Wüste, …) | `src/game/environments.ts` | `ENVIRONMENTS` |
| Bodenzellen und Vorbereitung | `src/game/ground.ts` | `groundInfo`, `prepareGround`, `prepareGroundArea`, `GROUND_COVERS`, `paintGroundCover`, `paintGroundCoverArea`, `normalizeGroundCells` |
| OSM/DEM-Import, Skizzen | `src/game/terrainImport.ts`, `scripts/import-terrain.mjs`, `scripts/import-terrain-entry.ts` | `classifyOsmTags`, `sketchBurningMan`, `sketchRockAmRing`, `draftToScenarioFile`; CLI `npm run import-terrain` |
| Fußweg-/Straßenbeläge | `src/game/wayTypes.ts` | `WAY_TYPES`, `wayInfo`, `wayIssue` |
| Weg- und Straßenrampen | `src/game/wayElevation.ts` | Halbstufen `0.5`, `MAX_PATH_ELEVATION` 6, Autodach `MAX_ROAD_RAISE` 1; `planLockedOriginRamp` / Shift-Ausgang; Fußkanten `wayEdgeHeights` / `canStepPedestrianHeight` |
| Bauhöhe / Bodenkachel | `src/game/placementPreview.ts`, `src/view/WorldView.ts` | Gebäude/Deko/Achterbahn-Start rasten auf 0.5; gelbe Bodenkachel-Markierung unter dem Zeiger |
| Terrain-Balancing | `src/game/simulationConfig.ts` | `terrain` (`waterHeight` −0.5, `minSwimDepth`, Schwimmkosten) |
| Sichtbares Mesh / Atlas | `src/view/terrainSurface.ts` | ein Draw-Call für den Boden |
| Hänge, Pads, Kanten | `src/view/terrainShape.ts` | `TerrainShape`, `terrainPads` |
| Belagstexturen | `src/view/wayTextures.ts` | `wayTexture`, `parkingTexture`, geteilte Wegdecks `wayDeckMaterial`/`wayDeckGeometry` |

## Wichtige Regeln

- Kachelhöhen rasten auf **0,5** und bleiben autoritativ für Navigation.
  Sichtbare Hänge sind **zwei Dreiecke je Feld**. Angehobenes Land bleibt
  ein Plateau; Nachbarn steigen höchstens **0,5** an, das Ufer fällt
  höchstens **0,5** zum Wasserspiegel. Größerer Rest wird zur **Steinklippe**
  in `createTerrainBase`, nicht zur langen Rampe. Optionale `terrain.corners`
  bleiben Legacy-Overrides und werden auf ±0,5 um die Kachelhöhe geklemmt.
  Editor: nur **Feld anheben**, **Feld senken**, **Glätten** als Flächen
  (Klick oder Rechteck). Anheben/Senken ändert nur die gewählten Felder
  um 0,5 — kein Nachbar-Flood. Glätten setzt die Fläche auf die Höhe unter
  dem Startpunkt. Neue Karten haben `waterLevel: -0.5`; Wasser liegt auf
  gefluteten Feldern und auf Uferhängen mit Ecke `<= waterLevel`. Alte
  Saves ohne Feld bekommen −0.5 (früherer Schlamm −1 wird badbar).
  Geländedits erhöhen `worldRevision` sofort. Fußgänger verbinden Nachbarfelder
  nur, wenn die gemeinsamen visuellen Kanten zusammenpassen: Δ **0,5** ist ein
  Hang, Δ **1,0** eine Steinklippe — außer ein Weg mit Rampe trägt die Höhe
  (`waySurfaceYAt`). Bewegung folgt dieser Oberfläche, nicht einem Y-Sprung
  an der Feldgrenze.
- Autoritative Terrain- und Navigationshöhen nicht durch Render-Meshes ersetzen.
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
- Mesh nur nach Terrain-, Environment-, Surface-/Compaction-, Cover-, Parkplatz- oder
  Footprint-Änderungen neu bauen. Regen ändert einen Material-Tint, nicht
  die Geometrie.
-   Optische Untergründe (`GroundCell.cover`: Rasen, Sand, Stein, Acker, Schnee,
  Felsen, braune Erde, Salzpfanne, Asphalt) werden im Gelände-Reiter als Palette gestrichen
  (Klick oder Rechteck, wie Anheben/Senken). Sie leben auf derselben
  Ground-Zelle wie Wege und Bodenarbeiten, nicht in einem zweiten System.
  Alte Saves ohne `cover` behalten den umgebungsbasierten `substrate`.
  Unbekannte Cover-Werte fallen beim Laden weg. Anheben/Senken/Glätten
  löscht Drain/Verdichten/Belag, behält aber den gemalten Cover.
  Rendering: Cover gewinnt gegen natürlichen Boden und Verdichten, nicht
  gegen Wasser/Schlamm oder Park-Asphalt; ein Atlas, ein Draw-Call.
  Navigation: nur Cover mit bestehendem Substrat ändern Tempo/Nässe
  (Rasen→`grass`, Sand→`sand`, Acker→`field`, braune Erde→`clay`,
  Salzpfanne→`sand`). Stein, Schnee, Felsen und Asphalt sind rein optisch.
  Kein neuer Balancing-Schlüssel.
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

`tests/terrainSurface.ts` (facettierte Zwei-Dreieck-Kacheln, Pads, Kontakt,
Save-Stabilität, keine Sim-Mutation, Parkplatz-Asphalt nur auf Parkfeldern,
gemalter Cover überschreibt die natürliche Atlaszeile).
`tests/terrainLand.ts` (drei Werkzeuge, Schritt 0,5, Fläche auf Starthöhe,
Klippe nach 0,5 Hang, Wasser am Uferhang, Schwimmen, Nav-Invalidierung,
Stützen nur im Freiraum, Fußweg 0→0,5 ja / 0→1 Klippe nein). `tests/environments.ts`.
`tests/groundCover.ts` (Palette, Paint, Fläche, Save-Roundtrip, Migration
unbekannter Cover, Höhenedit behält Cover, Command `paintGroundCover`).
`tests/terrainImport.ts` (OSM-Tag-Mapping, Burning-Man- und Nürburgring-Skizzen,
Drop-in-Dateien `public/scenarios/burning-man.json` und
`public/scenarios/rock-am-ring-strecke.json`).
`tests/operations.ts` (Parkplatz-Abriss gibt die Kachel frei).
`tests/supplyChain.ts` (Bodenarbeiten).
`tests/wayElevation.ts` (Halbstufen-Rampen, beide Way-Typen, Autodach, Save-Migration,
fester Shift-Ausgang beim Rampenstreichen, Fußweg auf Autostraße behält die
Straße, ein Straßenfeld übermalen löscht keine Nachbarn, Klippe 0→1 blockiert).
`tests/placementPreview.ts` (Gebäude-Bauhöhe 0.5, Bodenkachel der Vorschau).

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Umgebungen, Höhenregeln, Ground-Works, Cover-Typen,
Way-Types oder die Terrain-Mesh-Architektur ändern. Neue Beläge in
`wayTypes.ts`, neue Looks in `GROUND_COVERS` plus Atlaszeile, Config,
UI und `README.md` (Spieler) ergänzen.

## Bauhöhen-Eingabe (0.1.126)

Shift setzt über bebautem Feld einmalig auf die auf 0,5 aufgerundete Oberkante.
Höhe folgt danach der absoluten vertikalen Mausdistanz (48 px pro Halbstufe).
Weg-/Straßen-Ausgangspunkt bleibt beim Einstellen fest. Neigung wird separat
gewählt. Kurzer Rechtsklick im jeweiligen Baumodus entfernt nur Weg bzw. Straße.

## RCT-Gelände, Wasser −0.5 und Stützen (0.1.132)

Hügel sind Stufenplateaus, Kartenrand bleibt als Klippe in
`createTerrainBase`. Stützen (`supportOccupancy.ts`, geteilte
Zylinder in `view/supports.ts`) nur wenn zwischen Objekt und Land/Solid
Luft ist — nicht durch angehobenes Gelände, Wege oder Gebäude. Wasser zählt
nicht als Boden; Stützen gehen auf den Seegrund, entfallen aber wenn das
Land das Objekt erreicht. Wege/Achterbahn nutzen dieselbe Lücke.

## Land-Editor Flächen, 0,5-Stufen und Uferwasser (0.1.134)

Nur **Feld anheben**, **Feld senken**, **Glätten**. Ziehen füllt ein
Rechteck (`editTerrainArea`). Stufe `terrain.heightStep` 0,5, sichtbarer
Hang `terrain.maxSlope` 0,5, Rest Stein. Glätten nutzt `originHeight` vom
Gestenstart. Wasser-Mesh auch auf Uferfeldern (`tileShowsWater`).
Versteckte Commands `flatten` / `raiseCorner` / `water` bleiben gültig.

## Überarbeitete Wegoberflächen (0.1.127)

Alle acht Beläge erhalten differenzierte Texturen aus `wayTextures.ts`.
Kacheln schließen lückenlos an. Erhöhte Wege bekommen offene Anschlusskanten,
Geländer und schlanke Stützen aus `wayStructures.ts`; Erhöhung wird relativ
zum Gelände gemessen. Rampenstützen enden an ihrer lokalen Unterseite,
Unterführungen bleiben stützenfrei. Navigation, Kosten und Höhen bleiben gleich.

## Optische Untergründe (0.2.7)

Palette im Reiter **Gelände** unter **Untergrund**: Rasen, Sand, Stein, Acker,
Schnee, Felsen, braune Erde. Speicherung als optionales `cover` an
`festival.infrastructure.ground`. Commands `paintGroundCover` /
`paintGroundCoverArea`. Atlaszeilen `stone`, `rock`, `snow`, `earth` im
bestehenden Boden-Mesh.

## Gelände-Import und Festival-Skizzen (0.2.8)

Kein Google-Maps-/Earth-Download. Legal: OpenStreetMap (Wege, Wasser, landuse),
öffentliche DEMs (SRTM über Open-Topo-Data), Nutzer-Upload, oder Offline-Skizze.
CLI: `npm run import-terrain` (`scripts/import-terrain.mjs`). Agent-Skill:
`.cursor/skills/festival-terrain-import/SKILL.md`. Neue Cover `salt` (Playa,
Sand-Tempo) und `asphalt` (Rennstrecke, optisch). Testdaten: Burning Man
(Hufeisen + Playastrecke) und Rock am Ring (Nordschleifen-Andeutung + GP-Oval).
Szenario-Export legt Ground unter `world.festival.infrastructure.ground` ab.
