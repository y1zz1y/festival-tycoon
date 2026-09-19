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
| Live-Show / Festivallust | `src/game/GameState.ts` | `updateConcertAttendance`, `tryVisitConcert` |
| Templates / Buchungen | `src/game/festivalManagement.ts` | `stageDesign`, `stageTemplates` |
| Werkstatt-UI | `src/stageEditor.ts` | Platzieren, Undo, Vorschau |
| Orientierungsanzeige | `src/view/orientationGizmo.ts` | `createOrientationGizmo`, `OrientationGizmo` |
| Modelle, Show, Lichtpool | `src/view/stageModel.ts` | `createStageModel`, `animateStageModel` |
| Picking der Teile | `src/view/stagePicking.ts` | |
| Pixel-Musiker | `src/view/stageBand.ts`, `src/view/bandMemberMesh.ts`, `src/game/bandLooks.ts` | nur visuell, kein Audio; dieselbe Costume-ID und dasselbe Mesh wie Backstage-`bandActors` |
| Vorplatz-View | `src/view/ForecourtView.ts` | |
| Laser | `src/view/LaserView.ts` | begrenzte dynamische Effekte |

## Wichtige Regeln

- Maximal 30 Vorlagen und 96 Teile je Bühne. Statische Geometrie nach
  Material bündeln; dynamische Effekte auf 32 je Bühne begrenzen.
- Die Werkstatt speichert `StageDesign.forecourtDepth` (1–24 Felder).
  `stageForecourtDepth` übernimmt bei älteren Designs weiterhin zwei
  Bühnenbreiten. Werkstatt und Karten-Bauvorschau zeigen dieselbe gewählte
  Fläche; die Kartenansicht nutzt dafür genau einen Instanz-Batch.
- Sechs aktive Map-Spots teilen sich Bühnenbeleuchtung
  (`docs/rendering.md`, `FestivalLightsView`).
- Musiker nur auf Podesten (selbstgebaut) bzw. fester Plattform (Standard).
  Keine Audio-Erzeugung durch Band-Visuals. Farben/Accessoires kommen aus
  `bandLooks.ts` (Genre plus Band-Akzent). Dieselbe `costumeId` gilt auf
  der Bühne und auf dem Backstage; `BandActorView` blendet während
  `performing` aus, damit die Bühnenanimation nicht verdoppelt wird.
- Zuschauerflächen brauchen Verbindung zum Bühnenrand und Geländezugang.
- Konzert-Oberteil-Ereignisse sind selten und auf eine Person gleichzeitig
  begrenzt; Rate und Tick-Verhalten siehe `visitors.md`.
- Wer wirklich einem laufenden Slot zuschaut (`partying`, `concertId`,
  Uhrzeit ≥ Slotstart, Buchung in `availableConcerts` / ohne `showIssue`),
  bekommt Festivallust (`Visitor.motivation`) mit
  `atmosphere.concertMotivationPerMinute`. Warten in der Einlassphase,
  Vorbeigehen und eine dunkle oder pausierende Bühne füllen sie nicht;
  Sandbox-Tanzen ohne Buchung bleibt nur Spaß (`partyFunPerMinute`).
- Umbauten berechnen nur positive Ausstattungs-Differenz, keine Erstattung.
- Designs in Snapshot, Base64 und lokalem Vorlagen-Store halten.
- Alte 2D-Designs ohne Höhenwerte werden vor dem Regridding auf `y=0` je Teil
  und die Standard-Bauhöhe ergänzt. Dadurch bleiben alte Traversen erhalten und
  erzeugen keine NaN-Vertices/Bounding-Spheres. Der ursprüngliche Save bleibt
  unangetastet; aktuelle Höhen werden nicht geändert.

## Tests

`tests/stageInteraction.ts`, `tests/stageTickets.ts`, `tests/festival.ts`
(verkleinerte/vergrößerte und Legacy-Vorplatztiefe, Vorplatz-Kapazität,
Einlass vor Slotstart, Live-Show-Festivallust,
Oberteil-Ereignis). Licht-Stabilität: `tests/performanceGuards.ts`.

Bandversorgung skaliert Show-Spaß, Festivallust und Trinkgeld (`sales`)
über `showQuality` der verbundenen Backstage-Komponente; ohne Backstage
bleibt der Auftritt legal, aber schwächer (~0.62 statt bis ~1.18).
[`band-supply.md`](band-supply.md). Vorplatz (`stageForecourtCells`) ist
nicht Backstage.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Teile, Phasenregler, Footprint-Regeln, Template-Limits
oder Show-Effekte ändern. Strombedarf in `docs/atmosphere.md`, Buchungen in
`docs/festival.md`.
