# Thematische Festival-Dekoration

Der Deko-Katalog filtert nach **Thema** (oben) und listet darunter die
bestehenden Kategorien. Themen sind nur UI/Katalog — platzierte Stücke
bleiben normale `BuildingKind`s ohne extra Snapshot-Feld. Größen und Fassaden
sind im Abschnitt „Überarbeitung 0.1.125“ beschrieben.

## Warum welche Themen

Reale Festival-Ästhetiken, plus zwei Spezialwelten. Bewusst 11 statt 40:

| ID | Name | Warum |
| --- | --- | --- |
| `klassik` | Klassik | Woodstock-/Folk-Open-Air: Holz, Fahnen, Wegweiser — neutrales Festivalgelände. |
| `wueste` | Wüste | Burning-Man-/Wüstenfestivals: Playa, Staub, Kakteen und Skulpturen. |
| `wald` | Wald | Wald-Raves (Boom, Ozora): Farne, Pilze, Moos und Waldidole. |
| `neon` | Neon | Rave/UV-Nacht: Leuchtfarben, Diskokugel, LED-Bänder. |
| `industrie` | Industrie | Warehouse-Techno: Paletten, Fässer, Ketten, Baustrahler. |
| `tropen` | Tropen | Strand- und Karibik-Festivals: Palmen, Tiki, Liegestühle. |
| `mystik` | Mystik | Spirituelle/okkulte Open-Airs: Kristalle, Runen, Gebetsfahnen, Feuer. |
| `zirkus` | Zirkus | Jahrmarkt- und Circus-Fields: Wimpel, Mini-Zelt, Popcorn, Lichter. |
| `alpin` | Alpin | Alpen-/Oktoberfest-Ästhetik: Tannen, Biertische, Maibaum, Lattenzaun. |
| `arktis` | Arktis | Spezial: Eis, Polarlicht und Schnee — klar von Holz/Neon getrennt. |
| `steampunk` | Steampunk | Spezial: Messing, Zahnräder, Rohre und Gaslicht. |

Ausgelassen (in andere Themen gefaltet oder zu nah): Flower-Power → Klassik,
Rio/Karneval → Zirkus, Wikinger/pagan → Mystik, Japan-Lampions → Klassik
(`lanternPole`), Nautik, Sci-Fi, Retro-80s.

## Kategorien

Unverändert zum bisherigen Deko-Raster, jetzt als Abschnitte unter dem Thema:

| ID | Label |
| --- | --- |
| `plants` | Pflanzen |
| `furniture` | Möbel |
| `lights` | Licht |
| `festival` | Fest |
| `props` | Kulisse |
| `fence` | Zaun |

Leere Kategorien eines Themas werden ausgeblendet. Wechsel des Themas hält
dieselbe Kategorie-Reihenfolge.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Themen, Filter, neue Arten | `src/game/decoration.ts` | `DECORATION_THEMES`, `filterDecorationKinds`, `THEMED_DECORATION_KINDS` |
| Katalog-Einträge | `src/game/catalog.ts` | `BUILDING_KINDS` / `BUILDINGS` |
| Slots / Kanten | `src/game/scenery.ts` | `SCENERY_KINDS`, `EDGE_SCENERY_KINDS`, `pedestrianBarrierOccupancy` |
| Bau-Menü-Gruppen | `src/game/buildMenu.ts` | Deko-`groups` aus `decorationKindsInCategory` |
| UI: Themenleiste + Abschnitte | `src/main.ts` | `renderDecorationCatalog` |
| Meshes / Instancing | `src/view/retroBuildings.ts` | `buildThemedScenery` (Familien + Vertexfarben) |
| Lampenlicht | `src/game/decorationLights.ts` | `DECORATION_LIGHTS` — Farbe, Höhe, Punkt/Kegel je Licht-Art |
| Attraktivität | `src/game/simulationConfig.ts` | `atmosphere.sources` je Kind |

Neue Stücke (44): Wüste 4, Wald 4, Neon 4, Industrie 4, Tropen 4, Mystik 4,
Zirkus 4, Alpin 4, Arktis 6, Steampunk 6. Bestehende Arten wurden den
passenden Themen zugeordnet, nicht verdoppelt.

Kanten-Slots der neuen Arten: `glowTape`, `chainFence`, `occultBanner`,
`carnivalBulbs`, `iceFence`, `pipeRail`. Vollfeld bleiben `bench`, `fence`,
`lighting`, `lightBalloon` (Klassik).

## Wichtige Regeln

- Kein `GameCommand` und kein Snapshot-Themenfeld. Platzierung, Vorschau,
  Kollision und Multiplayer bleiben `scenery.ts`. Fehlendes `decorationSlot`
  ist Legacy-Vollfeld; alte Saves nicht verkleinern. Hecken, die Kategorie
  **Zaun** und Wandsegmente außer `*Door` sperren den Fußgängergraphen
  (`pedestrianBarrierOccupancy` in `scenery.ts`).
- Statische Details: ein gemergtes Vertex-Color-Mesh je Art, Instancing
  über `batchRetroBuildings`. Kein Material/Draw-Call pro Zahnrad, Eiszapfen,
  Farnblatt oder Glühbirne. Arktis/Steampunk unterscheiden sich über Farben
  und Silhouette; echtes Licht kommt aus dem geteilten Festival-Light-Pool.
- Jede Art in Kategorie **Licht** hat einen Deskriptor in
  `decorationLights.ts` (Farbe, Emitterhöhe, Reichweite, Punkt oder Kegel).
  `lighting` / `lightBalloon` brauchen Strom; die übrigen Themenlampen
  folgen nur dem Tagesplan-Angebot **Beleuchtung**. Bäume und Zäune bleiben
  dunkel. Platzieren, Drehen und Abriss aktualisieren die Quellen.
- Balancing der neuen Stücke: Kosten/Appeal im Katalog, Reichweite in
  `SIMULATION_CONFIG.atmosphere.sources`.

## Tests

`tests/decoration.ts`: Themenliste (8–12, inkl. Klassik/Arktis/Steampunk),
Filter (Klassik zeigt kein Arktis-Stück), leere Kategorie Wüste/Möbel,
alle Katalogarten im Menü, neue Arten über `scenery.ts` mit Slot,
Legacy-Baum ohne Slot bleibt Vollfeld, jede Licht-Art hat eine Farbe,
N platzierte Lampen erzeugen N Quellen, Abriss entfernt das Licht.
`tests/scenery.ts` prüft weiter Slots, Overlaps und Atmosphäre für
**alle** `SCENERY_KINDS`.
`tests/buildMenu.ts` verlangt jedes Kind genau einmal (über alle Themen).
`tests/performanceGuards.ts`: ein Draw-Call je `DETAILED_BUILDINGS`-Art.

## Bei Änderungen dieses Dokument

Themen, Kategorien, neue `BuildingKind`s oder UI-Reihenfolge hier und in
`docs/buildings.md` / `docs/ui.md` nachziehen. Spielertext: Root-`README.md`.

## Überarbeitung 0.1.125: Baugrößen und Fassaden

Alle Nicht-Klassik-Themen erhalten zusätzliche Material-/Umgebungsdetails;
Palmen und Farne haben gegliederte Blätter, Laternen offene Rahmen und Dächer,
Bänke Holz-/Metalllatten, Zahnräder Zähne, Schneemann Hut/Schal und Eis facettierte Spitzen.
Klassik verwendet unverändert die bisherigen Modelle.

`scenery.ts:LARGE_SCENERY_KINDS` wählt 23 große Arten (Bäume, Blickfänge,
Tische/Bänke, Liege, Sonnenschirm und Wagen) für neue Vollfeld-Platzierung.
Slot **4** ist ein explizites Vollfeld; 0–3 bleiben historische Viertel/Kanten.
Fehlende Slots bleiben Legacy-Vollfelder. Gespeicherte Viertel werden nicht vergrößert.
Vorschau, Kollision und Fußgängersolidität berücksichtigen die volle Fläche.

`src/game/decorationWalls.ts` definiert über `WALL_KINDS` und `wallSpec`
40 `wall<Style><Shape>`-Arten: je Thema
Lehm, Waldholz, Neon, Wellblech, Bambus, Runenstein, Zirkus, Fachwerk, Eis,
Kupfer; jeweils Full, Half, Window, Door. Kategorie **Wände** in jedem
Nicht-Klassik-Thema. Breite 1, Höhe 1 oder 0,5; Fenster und Türen sind echte
Geometrieöffnungen. Materialien, Rahmen und Nieten sind gemergte Vertexfarben.
Wände sitzen exakt an der Feldkante und auf der autoritativen Bauhöhe;
keine zusätzliche Terrain-Interpolation. Sie können frei erhöht und nahtlos
gestapelt werden. Doppelte gemeinsame Kanten werden auch vom Nachbarfeld
abgewiesen; unterschiedliche Kanten dürfen Ecken bilden. Fassaden dürfen
Gebäude/Fahrgeschäfte verkleiden. Volle/halbe Wände, Fenster und Dachkeile
sperren die gekreuzte Kante für Fußgänger (fehlendes Slot = Legacy-Vollfeld).
`*Door` bleibt begehbar. Hecken und die Kategorie **Zaun** ebenso.
Kosten in `SIMULATION_CONFIG.economy.decorationWalls`, Atmosphäre je Wand
in `atmosphere.sources`. Kein neues Command/Feld, siehe Saves/Multiplayer.

`tests/decoration.ts` prüft alle 23 Vollfelder, 40 Wand-Bounds, Stapelung,
Doppelbelegung vom Nachbarfeld, Fassaden und Multiplayer-Höhen/Slots.
`tests/pedestrianBarriers.ts` prüft, dass Wände/Zäune/Hecken sperren und Türen offen bleiben.
`tests/decoration-preview.html` zeigt alle Themen in Baugröße mit Wandreihe
und zweigeschossiger Ecke. Bestehende Draw-Call-Guards erfassen auch Wände.

## Dächer und Wegmöbel (0.1.126)

`src/game/decorationWalls.ts` ergänzt `ROOF_KINDS`/`roofSpec`
(Flach-/Schrägdach je Material,
20 Arten) und `THEMED_BIN_KINDS` (zehn funktionsfähige Themen-Mülleimer).
Dächer sind Vollfelder (Slot 4), Kategorie **Dächer**, 0,1/0,5 hoch und mit R
drehbar. Sie dürfen Wände berühren, kollidieren mit anderen Dächern und
Gebäudevolumen. Wände und Dächer bekommen unabhängig von ihrer Höhe **keine
Bodenstützen**; `isFacade` steuert das in `WorldView.createBuildingModel`.

Mülleimer liegen ausschließlich unter **Deko → Möbel**, klassisch und je
Thema. `isWasteBin` wird von Spielstand-Normalisierung, Gästezielen,
Reinigung, Liefer-/Müllträgern, Atmosphäre, Inspektion und Füllstandsrendering
verwendet. Kosten/Kapazität bleiben `economy.buildings.wasteBin` und `waste`.
`src/game/pathFurniture.ts:pathFurnitureRotation` wählt eine freie äußere Wegkante
auf Bauhöhe; Bank und Eimer reservieren verschiedene Kanten. Mülleimer bleiben
auch ohne freie Außenkante platzierbar; dann gilt Baurichtung. Bestehende
Mülleimer erscheinen nun ebenfalls am Rand. Die Vorschau nutzt dieselbe Wahl.

Eingaben siehe UI-Doku. Neue Fixture `tests/construction-preview.html` prüft
isoliert echte WorldView-Eingaben und Stützenfreiheit, ohne Spielstände.

## Passende Dachwände (0.1.128)

Alle zehn Materialien bekommen `SlopeLeft`, `SlopeRight`, `RoofEnd` in
`WALL_SHAPES` (30 weitere Arten unter **Wände**). Die spiegelverkehrten Keile
schließen die Seiten der vorhandenen Schrägdächer, `RoofEnd` die hohe Stirnseite.
`roofWallTop` beschreibt die 0–0,44 hohe Dachunterseitenkontur; die reservierte
Bauhöhe ist 0,5. Seitenteile sind echte extrudierte Dreiecke, Materialleisten
werden auf die Kontur begrenzt. Kein Detail ragt darüber. Giebel über zwei
Felder entstehen aus zwei spiegelverkehrten Keilen. Kanten, R-Drehung,
Bauhöhe, Stützenfreiheit und Dach-Koexistenz nutzen die bestehenden Regeln.
ModelKit.panel erzeugt indexierte Extrusionsgeometrie für die bestehenden Batches.

## Fassadeneinblick (0.1.129)

Alle `isFacade`-Arten, einschließlich Dachkeilen und Dächern, werden im echten
WorldView nahe einem Fassaden-Hovertreffer weich transparent. Andere Dekoration
und Wege bleiben sichtbar. Implementierung: `src/view/facadeReveal.ts`,
Batch-Markierung in `retroBuildings.ts`, Pointer-/Render-Anbindung in WorldView.

Seit 0.1.130: Im Deko-Baumodus bleiben Wände und Dächer vollständig sichtbar.
Außerhalb davon lassen lokal transparent gewordene Fassaden Klicks zu den
Objekten dahinter durch, etwa zu Ständen. Entfernte, undurchsichtige Bauteile
bleiben anklickbar. Der Hover-Test trifft weiterhin die Fassaden, damit der
Einblick beim Durchklicken stabil bleibt.

## Drehbare Eimer und Straßenbänke (0.1.131)

**R** richtet klassische und Themen-Mülleimer an der gewünschten freien
Außenkante aus; falls sie belegt ist, nutzt der Eimer die nächste freie Kante.
Die Vorschau zeigt dieselbe Richtung. Bänke wählen weiterhin automatisch eine
freie Kante und dürfen jetzt auch auf einer gleich hohen Autostraße stehen.
Straßen- und Wegfortsetzungen bleiben für die Kante frei.

## Themenlampen mit echtem Licht (0.1.157)

Jede Art unter **Deko → Licht** speist `FestivalLightsView`: Farbe, Höhe und
Punkt- vs. Kegellicht stehen in `decorationLights.ts` und folgen dem Mesh
(warmes Laternenlicht, UV/Silber der Diskokugel, Irrlicht-Türkis, Polarlicht,
Gasflamme, Natrium-Baustrahler). Glow und Birne sind Instanzfarben, die
echten Lights ein fester Pool (8 Punkte, 4 Spots). Strom nur für Mastleuchte
und Tageslichtballon. Kein neues Command oder Save-Feld.
