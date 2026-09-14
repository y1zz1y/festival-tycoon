# Spielstände und Versionierung

`GameSnapshot.version` ist die Schema-Version (aktuell **27**). Sichtbare
Spielversion kommt aus `package.json`. Feature-/Fix-Batches erhöhen den
Patch (`npm version patch --no-git-tag-version`) und halten das Lockfile synchron.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Snapshot-Form | `src/game/GameState.ts` | `GameSnapshot`, Konstruktor-Normalize |
| Base64-Export | `src/game/saveText.ts` | `encodeSaveText`, `decodeSaveText` |
| Browser-API zum Server | `src/game/serverSaves.ts` | `listServerSaves`, `saveServerSave` |
| Katalog-Keys | `src/game/catalog.ts` | `SAVE_KEY`, `SAVE_SLOTS_KEY` |
| Server-Slots | `server/saveSlots.ts` | JSON unter `saves/` |
| Szenario-Defaults | `src/game/scenario.ts` | `normalizeScenarioSettings` |
| Bühnen-Migration | `src/game/stageDesign.ts` | `migrateStageDesign` |
| Logistics-Normalize | `src/game/logistics.ts` | `normalizeLogisticsSnapshot` |
| Ampeln / Schranken | `src/game/accessControl.ts` | `normalizeAccessControls`, `accessControls` |

Lokal im Dev-Server: bis zu 20 benannte Slots als JSON in `saves/`
(gitignored). Ohne Server: gleichwertiger Browser-Speicher. Persönliche
Saves niemals committen oder überschreiben.

## Wichtige Regeln

- Neue Snapshot-Felder: Default im Blank-Snapshot, Normalize beim Laden,
  Save-Kompatibilität für alte Stände, Multiplayer-Sync.
  `RoadVehicle.kind` kann `deliveryTruck` sein; optionales `deliveryId`
  zeigt auf `festival.infrastructure.trucks`.
  `accessControls` (`trafficLights`, `pathBarriers`) liegt auf dem
  Snapshot, nicht in `logistics`. Alte Stände ohne das Feld werden leer
  normalisiert.   Wegschranken haben `passage` (`oneWay`/`both`, fehlend =
  eine Richtung), Modus `always`/`locked` und `openInEmergency`
  (fehlend = an). Optionales
  `RoadVehicle.parkingSearchCursor` bleibt 0.
- Legacy-Verhalten bewusst beibehalten (fehlende Ticketkontingente, fehlende
  Scenery-Slots, fehlende Ride-Gates, braune Abandoned-Tents).
  Fehlendes `campingTicketPrice` übernimmt den gespeicherten `entryPrice`.
- Terrain wird beim Laden nicht neu generiert.
- Debug- und Performance-Fixtures dürfen persönliche Saves nicht anfassen
  (`docs/performance.md`).

## Tests

`tests/regression.ts` (Save-Text). Roundtrips in `tests/terrainSurface.ts`,
`tests/rideAccess.ts`, `tests/festival.ts`, `tests/scenery.ts`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn `GameSnapshot.version` steigt, ein Feld dazukommt oder
sich Slot-/Export-Wege ändern. Command-Protokoll in `docs/multiplayer.md`.
