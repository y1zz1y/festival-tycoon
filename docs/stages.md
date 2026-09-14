# Bühnen, Werkstatt und Konzertpublikum

Standardbühnen und selbstgebaute Designs teilen `StageDesign`. Die Werkstatt
editiert ein Detailraster unabhängig von der Kartengrundfläche. Auf der Karte
gelten Footprint, Strom, Vorplatz und Buchungen.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Design, Teile, Phasen, Footprint | `src/game/stageDesign.ts` | `StageDesign`, `stageStats`, `buildingFootprint` |
| Platzierung im Raster | `src/game/stagePlacement.ts` | `stagePlacement` |
| Standortprüfung | `src/game/stageSite.ts` | `stageSiteIssue` |
| Vorplatz / Tanzdichte | `src/game/festivalAreas.ts` | Forecourt-Zellen |
| Konzertpublikum sync | `src/game/stageAudience.ts` | `syncStageAudience` |
| Templates / Buchungen | `src/game/festivalManagement.ts` | `stageDesign`, `stageTemplates` |
| Werkstatt-UI | `src/stageEditor.ts` | Platzieren, Undo, Vorschau |
| Modelle, Show, Lichtpool | `src/view/stageModel.ts` | `createStageModel`, `animateStageModel` |
| Picking der Teile | `src/view/stagePicking.ts` | |
| Pixel-Musiker | `src/view/stageBand.ts` | nur visuell, kein Audio |
| Vorplatz-View | `src/view/ForecourtView.ts` | |
| Laser | `src/view/LaserView.ts` | begrenzte dynamische Effekte |

## Wichtige Regeln

- Maximal 30 Vorlagen und 96 Teile je Bühne. Statische Geometrie nach
  Material bündeln; dynamische Effekte auf 32 je Bühne begrenzen.
- Sechs aktive Map-Spots teilen sich Bühnenbeleuchtung
  (`docs/rendering.md`, `FestivalLightsView`).
- Musiker nur auf Podesten (selbstgebaut) bzw. fester Plattform (Standard).
  Keine Audio-Erzeugung durch Band-Visuals.
- Zuschauerflächen brauchen Verbindung zum Bühnenrand und Geländezugang.
- Umbauten berechnen nur positive Ausstattungs-Differenz, keine Erstattung.
- Designs in Snapshot, Base64 und lokalem Vorlagen-Store halten.

## Tests

`tests/stageInteraction.ts`, `tests/stageTickets.ts`, `tests/festival.ts`.
Licht-Stabilität: `tests/performanceGuards.ts`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Teile, Phasenregler, Footprint-Regeln, Template-Limits
oder Show-Effekte ändern. Strombedarf in `docs/atmosphere.md`, Buchungen in
`docs/festival.md`.
