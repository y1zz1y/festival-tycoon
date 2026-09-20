# Bühnen, Werkstatt und Konzertpublikum

Standardbühnen und selbstgebaute Designs teilen `StageDesign`. Die Werkstatt
editiert ein Detailraster unabhängig von der Kartengrundfläche. Auf der Karte
gelten Footprint, Strom, Vorplatz und Buchungen.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Design, Teile, Phasen, Footprint | `src/game/stageDesign.ts` | `StageDesign`, `stageStats`, `buildingFootprint`, `stageFrontRank` |
| Platzierung im Raster | `src/game/stagePlacement.ts` | `stagePlacement` |
| Standortprüfung | `src/game/stageSite.ts` | `stageSiteIssue` |
| Vorplatz / Tanzdichte | `src/game/festivalAreas.ts`, `src/game/GameState.ts` | Forecourt-Zellen, `designateStageForecourt` |
| MP-Command | `src/net/protocol.ts`, `src/net/commands.ts`, `src/net/bind.ts` | `designateStageForecourt` (optimistic); `manageFestival.stageDesign` trägt `forecourtDepth` |
| Konzertpublikum sync | `src/game/stageAudience.ts` | `syncStageAudience` |
| Live-Show / Festivallust | `src/game/visitorBehavior.ts` | `updateConcertAttendance`, `tryVisitConcert`, `tryReserveConcertForecourt` |
| Templates / Buchungen | `src/game/festivalManagement.ts` | `stageDesign`, `stageTemplates` |
| Werkstatt-UI | `src/stageEditor.ts` | Platzieren, Undo, Vorschau |
| Orientierungsanzeige | `src/view/orientationGizmo.ts` | `createOrientationGizmo`, `OrientationGizmo` |
| Modelle, Show, Lichtpool | `src/view/stageModel.ts` | `createStageModel`, `animateStageModel`; gemeinsame Facing-Helfer `orientedBox` / `orientedForwardCylinder` / `tintVertexColors` für Laser, Sparks, Fog, Screen |
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
  `syncStageAudience` schreibt die Bühnen-Aprons nach `stageForecourtCells`;
  manuelle Ausweisungen ohne `stageId` bleiben erhalten. Das Array ist die
  live Quelle: Attraction-Commands dürfen es nicht aus `partyArea`
  überschreiben. Save/MP transportieren die Zellen; der Datensatz wird
  nachgezogen.
- Vorplatz ist keine freie Baufläche: `canPlace` blockiert Gebäude, Wege
  und Deko auf Bodenhöhe. Ausnahmen bleiben Bauzaun (`fence`) und
  Delay-Turm (`delayTower`). Die Werkzeugvorschau (`stageForecourt`)
  nutzt dieselbe Dry-Run-Prüfung wie die Ausweisung.
- Sechs aktive Map-Spots teilen sich Bühnenbeleuchtung
  (`docs/rendering.md`, `FestivalLightsView`).
- Musiker nur auf Podesten (selbstgebaut) bzw. fester Plattform (Standard).
  Keine Audio-Erzeugung durch Band-Visuals. Farben/Accessoires kommen aus
  `bandLooks.ts` (Genre plus Band-Akzent). Dieselbe `costumeId` gilt auf
  der Bühne und auf dem Backstage; `BandActorView` blendet während
  `performing` aus, damit die Bühnenanimation nicht verdoppelt wird.
- Zuschauerflächen brauchen Verbindung zum Bühnenrand und Geländezugang.
  Konzertgäste stehen tendenziell vorne: `stageFrontRank` zählt Apron-Reihen
  ab der gedrehten Bühnenfront (lokal +Z). Vordere Reihen haben Vorrang vor
  seitlichen oder hinteren Vorplatzfeldern; innerhalb einer Reihe verteilt
  die Slot-Belegung. Hintere Reihen nur bei voller oder unerreichbarer Front
  (`concertFrontGoalAttempts`, eine Multi-Goal-Suche je Reihe, kein A* pro
  Feld). Balancing: `atmosphere.concertSpreadGoals`,
  `concertFrontGoalAttempts`, `concertFrontRowPenalty`.
- Konzert-Oberteil-Ereignisse sind selten und auf eine Person gleichzeitig
  begrenzt; Rate und Tick-Verhalten siehe `visitors.md`.
- Wer wirklich einem laufenden Slot zuschaut (`partying`, `concertId`,
  Uhrzeit ≥ Slotstart, Buchung in `availableConcerts` / ohne `showIssue`),
  bekommt Festivallust (`Visitor.motivation`) mit
  `atmosphere.concertMotivationPerMinute`. Warten in der Einlassphase,
  Vorbeigehen und eine dunkle oder pausierende Bühne füllen sie nicht;
  Sandbox-Tanzen ohne Buchung bleibt nur Spaß (`partyFunPerMinute`).
- Umbauten berechnen nur positive Ausstattungs-Differenz, keine Erstattung.
  Gebäudeunterhalt der Bühne sitzt ohne laufendes Festival auf
  `economy.inactiveFestivalStageMultiplier` (5 %); technische Kosten der
  Ausstattung sind dann 0. Berechnung in `src/game/upkeep.ts`.
- Designs in Snapshot, Base64 und lokalem Vorlagen-Store halten.
- Alte 2D-Designs ohne Höhenwerte werden vor dem Regridding auf `y=0` je Teil
  und die Standard-Bauhöhe ergänzt. Dadurch bleiben alte Traversen erhalten und
  erzeugen keine NaN-Vertices/Bounding-Spheres. Der ursprüngliche Save bleibt
  unangetastet; aktuelle Höhen werden nicht geändert.

## Tests

`tests/stageInteraction.ts`, `tests/stageTickets.ts`, `tests/festival.ts`
(verkleinerte/vergrößerte und Legacy-Vorplatztiefe, Vorplatz-Kapazität,
vordere Konzertplätze inkl. Fallback wenn die erste Reihe voll ist,
`stageFrontRank` für Katalog- und gedrehte Werkstattbühnen,
Einlass vor Slotstart, Live-Show-Festivallust,
Oberteil-Ereignis). Licht-Stabilität: `tests/performanceGuards.ts`.
Placement-Sperre, Preview, Save/Load und MP gegen Attraction-Deltas:
`tests/attractionFoundation.ts`.

Bandversorgung skaliert Show-Spaß, Festivallust und Trinkgeld (`sales`)
über `showQuality` der verbundenen Backstage-Komponente; ohne Backstage
bleibt der Auftritt legal, aber schwächer (~0.62 statt bis ~1.18).
[`band-supply.md`](band-supply.md). Vorplatz (`stageForecourtCells`) ist
nicht Backstage.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Teile, Phasenregler, Footprint-Regeln, Template-Limits
oder Show-Effekte ändern. Strombedarf in `docs/atmosphere.md`, Buchungen in
`docs/festival.md`.
