# Camping

Ausgewiesene Campingzellen, persönliche Parzellen, Zeltphasen und soziale
Treffpunkte. Viele Installationen sind austauschbare Ziele: **eine**
Multi-Goal-Suche, kein A* pro Objekt.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Zellen, Installationen, Gathering | `src/game/camping.ts` | `CampingSystem`, `findRouteToGathering`, `CampInstallation` |
| Ausweisung im Spielzustand | `src/game/GameState.ts` | `designateCampingCell`, `designateCampingArea` |
| Baumenü | `src/game/buildMenu.ts` | Attraktionen → Tab **Camping** (`camping`) |
| Wegschranken-Sensor | `src/game/accessControl.ts` | freie/belegte Campingflächen im Gebiet |
| Verfall verlassener Camps | `src/game/camping.ts` | `decayUnclaimedInstallations`, `abandonVisitorCamp` |
| Balancing | `src/game/simulationConfig.ts` | `camping`, `camping.sleepSchedule` |
| Schlaffenster / Chronotyp | `src/game/visitorSleep.ts` | `sampleFestivalSleepRhythm`, `isMinuteInSleepWindow` |
| Ticket-Kontingente | `src/game/festivalManagement.ts` | `tickets`, Camping-Kapazität |
| Modelle / Batches | `src/view/campingModels.ts`, `src/view/batchCampMeshes.ts` | 14 Camping-Batches |
| Boden / Rand | `src/view/campingGround.ts` | Gras-Instancing, Curb-Flood-Fill |
| Szene | `src/view/CampingView.ts` | Platzierung der Installationen |

## Wichtige Regeln

- `findRouteToGathering` bleibt eine Suche für alle Treffpunkte
  (Regression: 335 Installationen in rtest3). Belegte Sitze ausschließen,
  entfernte Alternativen einbeziehen, wenn nahe Plätze voll oder blockiert sind.
  Heimatparzellen werden stärker gewichtet; Camper essen/reden häufiger am Platz.
- Verlassene Zelte können `appearanceId` / `fabricColor` tragen; das muss
  durch Abreise, Speichern und Multiplayer erhalten bleiben.
- Legacy-Zelte ohne Appearance behalten den braunen Fallback.
- Debug-Müllräumung darf aktive Camp-Objekte und Feuer-Incidents nicht
  zerstören (`GameState.clearWasteForDebug`).
- Camping-Gras teilt eine Textur und instanzierte Kacheln. Den
  Außenkanten-Flood-Fill nur bei Flächenedits neu bauen.
- `CampingView` hält `CampMeshBatcher` dauerhaft: kleine Phasen-/Farb-/Alterungs-
  Änderungen aktualisieren Instanzdaten statt alle GPU-Batches neu zu erzeugen.
  Kapazität wächst in Zweierpotenzen, Instanzpuffer werden beim Ersetzen freigegeben.
  Bollerwagen teilen statische Geometrie/Materialien; Sprites bleiben eigenständig.
- Gleichzeitige Camp-Abreisen teilen das Besucher-Entscheidungsbudget. Ein noch
  abzubauendes Camp wird bei verzögerter Routenplanung auch am Ausgang erhalten.
- Die Camping-Ausweisung selbst bleibt immer begehbarer Boden, auch bei
  Parkschließung und nach Festivalende. Normale Wege sind günstiger, aber ein
  eingeschlossener Besucher darf als Fallback über freie Campingzellen zum
  Weg beziehungsweise Ausgang laufen; feste Installationen bleiben unverändert.
- Geplanter Schlaf schickt Camper mit `findRouteToCampsite` zurück ins eigene
  Zelt (`campingPhase: returning` → `resting`). Das Ziel bleibt das
  bestehende Camp; neu ist nur das Festival-Fenster in
  `camping.sleepSchedule` (späte Nacht / Vormittag, gestaffelte Chronotypen).
  Im Schlaffenster wachen Camper erst auf, wenn die Energie
  `restCompleteEnergy` erreicht **und** ihre persönliche Weckzeit vorbei ist.

## Tests

`tests/performanceGuards.ts` (eine Route für 335 Ziele, belegte Sitze).
`tests/campingModels.ts` (Batches, Vertices, stabile IDs).
Schlafziel Zelt vs. nächtliches Wachbleiben: `tests/visitorSleep.ts`.
Abreise durch umgebende Camping-Ausweisungen: `tests/regression.ts`.
Visuelle Fixture: `tests/camping-preview.html`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Phasen, Installationsarten, Gathering-Suche, Ticketbindung
oder Batch-Grenzen ändern. Neue Camp-Props in Simulation **und**
`campingModels` / `docs/rendering.md` eintragen.
