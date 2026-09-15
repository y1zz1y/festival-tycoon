# Gebäude, Katalog und Dekoration

Platzierbare Typen leben im Katalog. `GameState.place` / `canPlace` prüfen
Kollision, Höhe, Boden und Spezialregeln. Deko nutzt optionale
`decorationSlot`s (Viertel oder Kanten).

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Arten, Tools, Anzeige | `src/game/catalog.ts` | `BUILDING_KINDS`, `BUILDINGS`, `Tool` (`trafficLight`, `pathBarrier`, `deliveryYard`, `supplyDepot`, `staffGate`) |
| Bau-Menü / Kategorien | `src/game/buildMenu.ts` | `BUILD_CATEGORIES` (keine stillen Fallbacks). Abriss bleibt als Kategorie für die Toolbar, öffnet aber kein Raster. Wege öffnen `#path-construction` mit Schnellzugriff auf `pathBarrier`, `staffGate`, `securityGate`. `isCatalogBuildCategory`: Deko, Attraktionen und Logistik als Bildraster mit Hover-Fußzeile. Camping unter Attraktionen; Krankenhaus (`ambulanceGarage`, `medicalArea`) unter Logistik. |
| Bauhöhe | `src/game/GameState.ts`, `src/game/placementPreview.ts` | `adjustBuildElevation`, `setBuildElevation` (0–6, **Halbstufen 0.5**, wie Wege). `snapBuildElevation` / `stepBuildElevation`. |
| Kosten / Upkeep / Appeal | `src/game/simulationConfig.ts` | `economy.buildings` |
| Platzieren, prüfen, abräumen | `src/game/GameState.ts`, `src/view/picking.ts` | `canPlace`, `place`, `bulldoze`, `getAt`, `resolvePickedBuilding`; Abriss räumt auch Parkplätze und Krankenfelder inkl. Restbelegung (`clearDesignatedOccupancyAt`) |
| Deko-Slots, Overlap, Transforms | `src/game/scenery.ts` | `scenerySlot`, `sceneryOverlaps`, `SCENERY_KINDS` (Viertel plus Kante: Hecke, Banner, Wimpel, Lichterkette, Gebetsfahnen, Lattenzaun, Absperrseil, Luftschlangen) |
| Bühnen-Grundfläche | `src/game/stageDesign.ts` | `buildingFootprint`, `occupiesBuildingCell` |
| Bühnenstandort | `src/game/stageSite.ts` | `stageSiteIssue` |
| Ride-Eingang/Ausgang | `src/game/GameState.ts` | `setRideAccess`, `canPlaceRideAccess` |
| Retro-Gebäude-Batches | `src/view/retroBuildings.ts` | `batchRetroBuildings` |
| Logistik-Gebäude / Fahrzeuge | `src/view/logisticsModels.ts` | `createLogisticsFacility`, `createSupplyStructure`, `createRoadVehicleModel` (Besucherautos: `VISITOR_CAR_COLORS` über Fahrzeug-ID) |
| Bude: alle Seiten | `src/game/shopAccess.ts` | `isShopServiceKind` (Imbiss, Getränke, Maskottchen, Shirt) |
| Warenart je Stand | `src/game/shopGoods.ts` | `shopSupplyKind`, `mascot`/`shirt` → `goods` |
| Shirt-Angebot | `src/game/shopGoods.ts` | `SHIRT_STYLES`, `SHIRT_COLORS`, `configureShirtStall` |
| Stand-Queue-Spuren | `src/game/queueLanes.ts` | Imbiss/Getränke/WC/Souvenir: hälftig Ansteh- und Zurückschlange |
| Zugangstore visuell | `src/view/attractionAccess.ts` | sechs geteilte Meshes |

## Wichtige Regeln

- Neuer Gebäude- oder Werkzeugtyp braucht Einträge in `catalog.ts`,
  `SIMULATION_CONFIG.economy.buildings` (falls kostenpflichtig), `canPlace` /
  `place`, `buildMenu.ts`, Rendering und oft einen `GameCommand`.
- Scenery: fehlendes `decorationSlot` ist ein **Legacy-Vollfeld**. Alte Saves
  nicht still verkleinern. Placement, Preview, Kollision und Multiplayer
  müssen `scenery.ts` teilen. Instanzierte Deko trägt Building-IDs für Picking.
  Abriss löst über `src/view/picking.ts` die getroffene Instanz auf
  (`buildingId` im bestehenden `bulldoze`-Command), nicht `getAt` der
  Kachelmitte. Legacy-Vollfelder bleiben voll.
- Personaleingang (`staffGate`) sitzt wie das Personentor auf der
  Ausgangskante der Baurichtung (`staffGateDirection`, Vorschau mit
  Richtungspfeil). Fehlt das Feld, bleibt ein altes mittiges Tor gültig.
- Imbiss, Getränkestand, Maskottchen- und T-Shirt-Stand sind Inselbuden:
  Gäste kaufen an der gedrehten Vorderseite, Nachschub gilt von allen vier
  Nachbarfeldern (Weg oder Bühnenvorplatz). Die Drehung bleibt für Modell
  und Thekenpfeil. Toiletten nutzen weiter nur die Tür.
  Eine angeschlossene Warteschlange bleibt **ein** Bauobjekt, wird aber
  senkrecht zur Laufrichtung hälftig geteilt (Anstehspur links, Rückweg
  rechts zur Theke). Attraktionsqueues sind ungeteilt.
- Gebäude und Wege dürfen übereinander liegen, wenn Höhenvolumen frei bleiben.
  Die Bauhöhe rastet in **halben Stufen (0.5)** von 0–6; Shift/Mausrad/Bild
  hoch-runter ändert eine Halbstufe. Nach dem Loslassen von Shift bleibt sie;
  ein neues Werkzeug startet wieder auf Ebene 0.
- Große Bühnen nutzen `buildingFootprint` / `occupiesBuildingCell`, nicht nur
  das Ankerfeld.
- Statische Modelldetails: geteilte/merged Geometrie und Instancing. Kein
  Material oder Draw-Call pro Brett, Flasche oder Schraube.
- Festival-Deko (Viertel): Totem, Fahnenmast, Lampion, Bierfässer, Luftfigur,
  Feuerschale plus Kulisse (Leitkegel, Kisten, Ölfass, Windrad, Windsack,
  Blumenampel, Kaktus, Zwerg, Windspiel, Kreidetafel, Liegestuhl, Sitzsack,
  Fackel, Deko-Box, Boombox, Selfie-Rahmen, Diskokugel, Luftkaktus, Riesenpilz,
  Kristallstele, Willkommensbogen). `prayerFlags`, `picketFence`, `ropeFence`
  und `streamers` teilen die Kanten-Slots mit Banner/Wimpel/Hecke.
  `lightBalloon` ist ein Vollfeld wie `lighting` (Wege bleiben begehbar),
  braucht Strom und das Tagesplan-Angebot Lampen. Deko-Fackel und Diskokugel
  sind nur Mesh plus Atmosphäre, keine extra PointLights.
- Attraktivität je Art: `SIMULATION_CONFIG.atmosphere.sources` (`beauty`,
  `party`, `range`). Kleine billige Stücke (Leitkegel 2) bleiben lokal;
  Mittelstücke (Selfie-Rahmen 11) und Blickfänge (Willkommensbogen 18,
  Kristallstele 16) strahlen weiter. Katalog-`appeal` zählt für leeren Park;
  Overlay und Gäste-`localAttractiveness` nutzen die Atmosphärenquelle.

## Tests

`tests/scenery.ts` (Slots, Overlaps, Legacy, neue Arten, Attraktivität je Kind,
Stapel/Reichweite, unbekannte Katalog-Arten). `tests/picking.ts` (Mesh-Treffer vs. Nachbar/Kachel). `tests/rideAccess.ts` (Tore).
`tests/operations.ts` (Buden von der Seite und von hinten; Personaleingang-Kante; Stand-Queue-Spuren; Parkplatz- und Krankenfeld-Abriss inkl. Restbelegung).
`tests/shopGoods.ts` (Allgemeine Waren, Maskottchen, Shirt-Farbe/Schnitt).
`tests/stageTickets.ts` / `tests/stageInteraction.ts` (Bühnenfläche).
`tests/operations.ts` (Imbiss von der Seite/hinten). `tests/buildMenu.ts`
(Katalog und Bauhöhe-Reset). `tests/placementPreview.ts` (Halbstufen-Snap 0.5,
Bodenkachel der Vorschau). Draw-Call-Grenzen: `tests/performanceGuards.ts`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn ein `BuildingKind` / `Tool` / Scenery-Typ dazukommt oder
sich Platzierungsregeln, Footprints oder Slot-Semantik ändern. UI-Menüpunkte
zusätzlich in `docs/ui.md` und Spielertext in `README.md`.
