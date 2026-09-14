# Besucher

Besucher leben im Snapshot (`GameSnapshot.visitors`). Bedürfnisse, Emotionen
und Ziele werden im festen Tick berechnet. Klickbare Infos und Gedankenblasen
sind abgeleitete Darstellung desselben Zustands.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Typen, Spawn, Bewegung, Ziele | `src/game/GameState.ts` | `Visitor`, `VisitorState`, `trySpawnVisitor`, `walkVisitors` |
| Need-/Alkohol-/Übelkeitswerte | `src/game/simulationConfig.ts` | `visitors`, `needs` (`interactionMinutes.stockout`), `alcohol`, `nausea` |
| Inventar (Zelt, Essen, Pyro, …) | `src/game/inventory.ts` | Inventarfelder und Verbrauch |
| Gedanken gruppieren | `src/game/visitorThoughts.ts` | `groupVisitorsByThought` |
| Statusblasen / Panik-Schwellen | `src/game/visitorBubbles.ts` | `visitorBubbleKind`, `spontaneousPanicChance` |
| Musikgeschmack | `src/game/musicTaste.ts` | `GENRES`, `musicAppeal` |
| Beschwerden | `src/game/complaints.ts` | `COMPLAINT_TOPICS`, Zähler |
| Stabile Optik (Geschlecht, Hash) | `src/game/rng.ts` | `visitorLooksFemale`, `hashStringSeed` |
| Pixel-Personen | `src/view/pixelPeople.ts` | geteilte Geometrien, Accessory-Batches |
| Ankunft per Auto/Fuß | `src/game/logistics.ts` | `ArrivalGroup` |

## Wichtige Regeln

- Erscheinung aus stabilem Hash der **vollen** Visitor-ID ableiten, nicht aus
  Array-Index, Simulations-RNG oder Frame-Zeit.
- Keine vollständigen Besucher-Scans innerhalb anderer Besucher-Schleifen.
  Räumliche / Belegungsindizes einmal pro Pass bauen.
- Zielwahl und Interaktions-Callbacks zählen gegen das Entscheidungsbudget
  (`docs/pathfinding.md`, `docs/simulation.md`).
- Imbiss und Getränkestand sind von jedem angrenzenden Weg oder
  Bühnenvorplatz erreichbar (`getFacilityAccessCells`), nicht nur von der
  gedrehten Theke. Warteschlangen dürfen an jeder dieser Seiten ansetzen.
  Toiletten und Fahrgeschäfte behalten den frontalen Zugang.
- Tages- vs. Campinggäste haben getrennte Tickets, Einlassfenster und
  Abreisewege. Fahrzeug-Abreise hängt an `logistics`.
- Wer eine Schlange verlässt (Abreise, geschlossenes Angebot, Ausverkauf)
  oder am Essen-/Getränkestand bedient wurde, geht die Queue-Kette
  rückwärts zum Eingang. Leere Stände: nur
  `needs.interactionMinutes.stockout` warten, dann denselben Rückweg.
- Bereits beim Loslaufen reservieren Gäste Queue-Kapazität. Diese noch
  laufenden Reservierungen dürfen aber keinen physischen Platz blockieren:
  Angekommene Gäste stehen stabil in Ankunftsreihenfolge davor und rücken bei
  jedem Tick kontinuierlich nach. Das gilt für Stände und Achterbahnen.
- Neue Need- oder State-Werte müssen in Snapshot, UI, Gedanken und ggf.
  Multiplayer-Deltas landen.

## Tests

`tests/pixelPeople.ts` (Batches, stabile Optik). `tests/regression.ts`
(Spawn, Needs, Speed-Partition). Festival-Anreisen: `tests/festival.ts`,
`tests/stageTickets.ts`. Queue-Reihenfolge, kontinuierliches Nachrücken,
Queue-Rückweg und leere Stände: `tests/operations.ts`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn `Visitor` / `VisitorState` / Needs neue Felder bekommen,
Spawn- oder Abreiselogik wechselt oder Gedanken/Bubbles neue Arten erhalten.
Neue UI-Panels für Besucher in `docs/ui.md` mitvermerken.
