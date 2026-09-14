# Müll, Vorfälle, Feuerwerk und Panik

Bodenvorfälle (`vomit`, `fire`, `litter`) und Müllablagen sind Simulationszustand.
Feuerwerk existiert als Inventar-Zündung (Besucher) und als Bühneneffekt.
Panik-Schwellen kommen aus Besucherblasen und Crowding, nicht aus der View.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Übelkeit, Incident-Spawn | `src/game/incidents.ts` | `IncidentSystem`, `GroundIncident` |
| Müllablagen, Eimer | `src/game/waste.ts` | `WasteDumpCell`, `findNearestWasteBin` |
| Debug-Räumung | `src/game/GameState.ts` | `clearWasteForDebug` |
| Feuerwerk (Sim) | `src/game/fireworks.ts` | `FireworksSystem` |
| Blasen / Panik-Chancen | `src/game/visitorBubbles.ts` | `spontaneousPanicChance`, `panicSpreadChance` |
| Crowding | `src/game/crowding.ts` | Dichte für Panik und Tempo |
| Personal-Reaktion | `src/game/staffSimulation.ts` | Cleaner, Firefighter |
| Views | `src/view/IncidentView.ts`, `src/view/WasteView.ts`, `src/view/FireworksView.ts`, `src/view/PanicView.ts` | nur Darstellung; Eimer-Füllstand als grobe Kartonzahl um den Eimer |
| Balancing | `src/game/simulationConfig.ts` | `incidents`, `nausea`, `waste`, `fireworks` |

## Wichtige Regeln

- Incidents nicht über die Karte ausbreiten, sofern nicht ausdrücklich
  implementiert (Feuer bleibt lokal).
- Saugreiniger räumen `litter` und `vomit` auf Wegen und Bühnenvorplätzen;
  sie fahren auf den Vorplatz, statt am Wegrand zu halten, und dürfen
  Personaleingänge wie Personal queren, um Schmutz, Ablage oder Depot zu
  erreichen. Zugewiesene Einsatzgebiete (`workZones`) begrenzen Suche und
  Aufnahme wie bei Reinigungskräften; Entladen an der Ablage bleibt
  außerhalb erlaubt.
  Personal-Cleaner bleiben der Fußweg-Fallback.
- Debug-Cleanup: ein Owner-Index, aktive Camp-Objekte und Feuer erhalten.
- Views speichern keine Simulationsentscheidungen (kein Panik-Flag nur im Mesh).
- `IncidentView` zeichnet alle Müllstücke in einem Instanz-Batch, alle
  Erbrochenen-Flecken in einem weiteren und Feuer in zwei Kegel-Batches.
  Stückzahl, Form, Farbe, Position und Feueranimation bleiben vollständig erhalten.
  Statische Instanzen werden nur bei sichtbaren Änderungen aktualisiert; Geometrie,
  Material und GPU-Kapazität bleiben erhalten. `instanceId` wird über
  `userData.incidentIds` der Vorfall-ID zugeordnet. Wachstum ersetzt nur Instanzpuffer;
  `invalidate()` gibt die eigenen Ressourcen frei.
- Müllwegentscheidungen aus direkten Interaktions-/Abbau-Callbacks teilen das
  Besucherbudget. Bis zur Bearbeitung bleibt `pendingWaste` erhalten; bereits
  laufende Wege zum Eimer werden nicht bei jeder Abreiseprüfung neu gesucht.
- Mülleimer zeigen `wasteFill` nur über grob gestufte Kartons am Boden
  (0 / 1 / 2 / 3 / 4 bei 0, 1–3, 4–6, 7–9, 10–12). Kein Balken.
  `WasteView` batched Tiles, Ablage-Säcke und Kartons.
- Personentore mit `openInEmergency` (Default an) gehen bei Panik oder
  Feuer auf, auch aus „Immer zu“, und lassen beide Richtungen frei.
  Die Notlage wird im selben Index-Pass wie die Gebietszähler erkannt,
  nicht in einer extra Besucherschleife.
- Neue Incident-Arten brauchen Snapshot, Staff-Reaktion, View-Batch und Tests.

## Tests

`tests/performanceGuards.ts` (Debug-Cleanup). `tests/operations.ts`.
Festival-Zusätze: `tests/festivalAdditions.ts` (Eimer-Kartonzahl und Batch-Grenze).

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Incident-Arten, Müllkapazitäten, Eimer-Darstellung,
Panikformeln oder Pyro-Trigger ändern. Bühnen-Pyro zusätzlich in
`docs/stages.md`.
