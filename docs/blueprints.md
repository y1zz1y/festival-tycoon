# Kopieren und Baubibliothek

RCT-artiges Rechteck-Kopieren: Bereich markieren, Geistervorschau, stempeln
oder in der persönlichen Bibliothek speichern. Die Bibliothek liegt nur im
Browser, nie im Spielstand und nie in Git.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Auswahl, Drehung, Kosten | `src/game/blueprints.ts` | `captureBlueprint`, `transformBlueprintItems`, `blueprintStampCharge`; Item-Typen Gebäude, Straße, Parkplatz |
| Persönliche Bibliothek | `src/game/blueprintLibrary.ts`, `src/game/browserPersistence.ts` | IndexedDB `headliner-tycoon-blueprints` + `BLUEPRINT_LIBRARY_KEY`, gemeinsamer Browser-Adapter |
| Stempeln | `src/game/GameState.ts` | `previewPlacement({ type: 'blueprint' })` delegiert an `previewBlueprint`; `stampBlueprint` |
| Command | `src/net/protocol.ts`, `src/net/commands.ts` | `stampBlueprint` |
| Werkzeug / Menü | `src/game/catalog.ts`, `src/game/buildMenu.ts` | Tool `copy`, Kategorie Kopieren |
| UI, Rechteck, Vorschau | `src/main.ts`, `src/view/WorldView.ts` | `applyCopySelection`, `setBlueprintPreview` |
| Balancing | `src/game/simulationConfig.ts` | `economy.blueprintCopyCostFactor` |

## Was wird kopiert

- Gebäude und Deko, deren Ankerfeld im Rechteck liegt, inkl. `decorationSlot`
- Fehlendes `decorationSlot` bleibt Legacy-Vollfeld; es wird kein Viertel/Kante erfunden
- Zäune, Bänke, Lampen, Stände und andere Katalogobjekte, die `place` kann
- Fußwege (`path`) mit Belag, Schlange, Neigung
- Autostraßenfelder inkl. optionalem Straßenbelag
- Parkplätze (`logistics.parkingCells`) als leere Buchten; Belegung und Autos bleiben zurück
- Geländehöhen werden **mitgespeichert**, beim Stempeln **nicht** angewendet

Nicht kopiert: Besucher, Fahrzeuge, lebende Müllhaufen, Camping-Installationen,
Achterbahnen, Bühnen, Fahrgeschäfte, Depots, Bus-Haltestellen, Ausweisungen
(Camping, Sanität, Müllablage, Backstage), Ampeln/Schranken.

## Stempeln und Kosten

Nach der Auswahl folgt eine Geistervorschau dem Zeiger. `R` dreht um die
Ursprungsecke (min-x/min-z der Auswahl). Klick sendet `stampBlueprint`
(Host-autoritativ, optimistic wie andere Baucommands).

Kollision nutzt `canPlace` / `scenery.ts` bzw. `placePathSegment` /
`placeRoadSegment` bzw. dieselbe Parkplatzprüfung wie `designateParkingArea`.
Die Vorschau mutiert die Welt nicht. Parkfelder kosten
`logistics.parkingDesignationCost` × denselben Kopierfaktor.
Kontexthilfe und `WorldView` konsumieren dasselbe `PlacementPreviewResult`;
die einzelnen Ghost-Einträge bleiben für die spezialisierte
Mehrfachobjekt-Darstellung erhalten.

Kosten: Katalog- bzw. Wegpreis × `blueprintCopyCostFactor` (aktuell **0,8**,
also 20 % Rabatt gegenüber Neubau). Zu wenig Geld bricht den ganzen Stempel ab.

## Bibliothek

Namen, Liste, Laden (Vorschau), Stempeln, Löschen. Persistenz über Sessions
in `localStorage` (`festival-simulator-blueprints-v1`) und IndexedDB
`headliner-tycoon-blueprints`. Kein `SAVE_KEY`, keine Slot-Dateien, keine
Snapshot-Felder. Nur der IndexedDB-/Quota-Unterbau ist mit Spielständen
geteilt; Datenbank, Store, Schlüssel, Normalisierung und Merge-Regeln der
Bibliothek bleiben fachlich separat.

## Tests

`tests/blueprints.ts`: 2×2 mit zwei Dekos stempeln, Preview ohne Mutation,
Parkplätze in Auswahl/Preview/Stempel, Bibliothek-Roundtrip ohne `SAVE_KEY`.
`tests/placementPreview.ts` prüft den zentralen Preview-Vertrag und identische
Meldungen. `tests/buildUndo.ts` nimmt einen Stempel inkl. Parkplatz zurück.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn sich Kopierinhalt, Kostenfaktor, Command oder Speicherort
ändern. Spielersteuerung im Root-`README.md`.
