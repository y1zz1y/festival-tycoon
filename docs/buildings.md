# Gebäude, Katalog und Dekoration

Platzierbare Typen leben im Katalog. `GameState.place` / `canPlace` prüfen
Kollision, Höhe, Boden und Spezialregeln. Deko nutzt optionale
`decorationSlot`s (Viertel oder Kanten).

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Arten, Tools, Anzeige | `src/game/catalog.ts` | `BUILDING_KINDS`, `BUILDINGS`, `Tool` (`trafficLight`, `pathBarrier`, `deliveryYard`, `supplyDepot`, `staffGate`) |
| Bau-Menü / Kategorien | `src/game/buildMenu.ts` | `BUILD_CATEGORIES` (keine stillen Fallbacks). Abriss bleibt als Kategorie für die Toolbar, öffnet aber kein Raster. Wege öffnen `#path-construction` mit Schnellzugriff auf `pathBarrier`, `staffGate`, `securityGate`. `isCatalogBuildCategory`: Deko, Attraktionen und Logistik als Bildraster mit Hover-Fußzeile. Camping unter Attraktionen; Krankenhaus (`ambulanceGarage`, `medicalArea`) unter Logistik. |
| Bauhöhe | `src/game/GameState.ts` | `adjustBuildElevation`, `setBuildElevation` (0–6). `setTool` auf ein anderes Werkzeug setzt die Höhe auf 0. |
| Kosten / Upkeep / Appeal | `src/game/simulationConfig.ts` | `economy.buildings` |
| Platzieren, prüfen, abräumen | `src/game/GameState.ts` | `canPlace`, `place`, `bulldoze`, `getAt` |
| Deko-Slots, Overlap, Transforms | `src/game/scenery.ts` | `scenerySlot`, `sceneryOverlaps`, `SCENERY_KINDS` (Viertel plus Kante: Hecke, Banner, Wimpel, Lichterkette, Gebetsfahnen) |
| Bühnen-Grundfläche | `src/game/stageDesign.ts` | `buildingFootprint`, `occupiesBuildingCell` |
| Bühnenstandort | `src/game/stageSite.ts` | `stageSiteIssue` |
| Ride-Eingang/Ausgang | `src/game/GameState.ts` | `setRideAccess`, `canPlaceRideAccess` |
| Retro-Gebäude-Batches | `src/view/retroBuildings.ts` | `batchRetroBuildings` |
| Logistik-Gebäude / Fahrzeuge | `src/view/logisticsModels.ts` | `createLogisticsFacility`, `createSupplyStructure`, `createRoadVehicleModel` (Besucherautos: `VISITOR_CAR_COLORS` über Fahrzeug-ID) |
| Bude: alle Seiten | `src/game/shopAccess.ts` | `isShopServiceKind`, `CARDINAL_OFFSETS` |
| Zugangstore visuell | `src/view/attractionAccess.ts` | sechs geteilte Meshes |

## Wichtige Regeln

- Neuer Gebäude- oder Werkzeugtyp braucht Einträge in `catalog.ts`,
  `SIMULATION_CONFIG.economy.buildings` (falls kostenpflichtig), `canPlace` /
  `place`, `buildMenu.ts`, Rendering und oft einen `GameCommand`.
- Scenery: fehlendes `decorationSlot` ist ein **Legacy-Vollfeld**. Alte Saves
  nicht still verkleinern. Placement, Preview, Kollision und Multiplayer
  müssen `scenery.ts` teilen. Instanzierte Deko trägt Building-IDs für Picking.
- Imbiss und Getränkestand sind Inselbuden: Verkauf und Nachschub gelten
  von allen vier Nachbarfeldern (Weg oder Bühnenvorplatz). Die Drehung
  bleibt für Modell und Thekenpfeil. Toiletten nutzen weiter nur die Tür.
- Gebäude und Wege dürfen übereinander liegen, wenn Höhenvolumen frei bleiben.
  Die Bauhöhe bleibt nach dem Loslassen von Shift; ein neues Werkzeug
  startet wieder auf Ebene 0.
- Große Bühnen nutzen `buildingFootprint` / `occupiesBuildingCell`, nicht nur
  das Ankerfeld.
- Statische Modelldetails: geteilte/merged Geometrie und Instancing. Kein
  Material oder Draw-Call pro Brett, Flasche oder Schraube.
- Festival-Deko (Viertel): Totem, Fahnenmast, Lampion, Bierfässer, Luftfigur,
  Feuerschale. `prayerFlags` teilt die Kanten-Slots mit Banner/Wimpel.
  `lightBalloon` ist ein Vollfeld wie `lighting` (Wege bleiben begehbar),
  braucht Strom und das Tagesplan-Angebot Lampen.

## Tests

`tests/scenery.ts` (Slots, Overlaps, Legacy). `tests/rideAccess.ts` (Tore).
`tests/operations.ts` (Buden von der Seite und von hinten).
`tests/stageTickets.ts` / `tests/stageInteraction.ts` (Bühnenfläche).
`tests/operations.ts` (Imbiss von der Seite/hinten). `tests/buildMenu.ts`
(Katalog und Bauhöhe-Reset). Draw-Call-Grenzen: `tests/performanceGuards.ts`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn ein `BuildingKind` / `Tool` / Scenery-Typ dazukommt oder
sich Platzierungsregeln, Footprints oder Slot-Semantik ändern. UI-Menüpunkte
zusätzlich in `docs/ui.md` und Spielertext in `README.md`.
