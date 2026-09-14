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
  (fehlend = an). Zeitsteuerung: fehlendes `scheduleTime` bleibt
  `hourlySlots`, fehlende `schedulePhases` gelten für alle
  Festivalphasen, fehlendes `scheduleOffer` ist `rides`, fehlende
  `scheduleHours` werden 8–23. Optionales
  `RoadVehicle.parkingSearchCursor` bleibt 0.
  Optionales `RoadVehicle.workZones` gilt für Saugroboter; fehlend
  bedeutet wie bisher das gesamte Gelände.
  Optionales `staffGateDirection` (0–3) liegt am Fußweg mit `staffOnly`;
  fehlend bleibt ein mittig dargestelltes Legacy-Personaltor, der
  Kachelzugang ändert sich nicht.
  `Supply`/`Stock` kann `goods` (Allgemeine Waren) enthalten; fehlend = 0.
  Besucher: optionale `ownedMascot`, `heldMascot`, `wornShirt`.
  T-Shirt-Stand: optionale `shirtColor`/`shirtStyle` (Default klassisch/rot).
  Optionales `queueSplit` an Queue-Wegen ist abgeleitet
  (`recalculateQueueDirections`): Stand-Queues wahr, Attraktionsqueues
  falsch. Alte Saves ohne das Feld brauchen keinen Neuaufbau.
- Legacy-Verhalten bewusst beibehalten (fehlende Ticketkontingente, fehlende
  Scenery-Slots, fehlende Ride-Gates, braune Abandoned-Tents).
  Fehlendes `campingTicketPrice` übernimmt den gespeicherten `entryPrice`.
- Terrain wird beim Laden nicht neu generiert.
- Bei leeren Ladenschlangen speichert `interactionRemaining` die verstrichene
  Wartezeit negativ; kein neues Snapshot-Feld. Alte Mehrfach-Oberteilereignisse
  werden im Besucherpass auf eine Person reduziert. Alte Fahrzeugrouten und
  Gegenrichtung auf Einbahnen werden vor dem Fahren geprüft und korrigiert.
- Debug- und Performance-Fixtures dürfen persönliche Saves nicht anfassen
  (`docs/performance.md`).

## Tests

Die Routing-Auftragsqueue ist Laufzeitzustand und fügt keine Snapshot-Felder hinzu.
Ausstehende Abreisen werden beim Laden aus `state`, `campsite`, `campingPhase` und
`pendingWaste` wieder aufgenommen, auch wenn der Besucher schon am Ausgang steht.

`migrateStageDesign` ergänzt fehlende Höhen alter 2D-Werkstätten vor dem Regridding:
Teile stehen auf `y=0`, fehlende Bühnenhöhe verwendet `STAGE_TILE_HEIGHT`. Vorhandene
Höhen und x/z-Platzierung bleiben erhalten. Die geladene Kopie wird migriert,
persönliche Slot-Dateien werden nicht überschrieben.

`tests/regression.ts` (Save-Text). Roundtrips in `tests/terrainSurface.ts`,
`tests/rideAccess.ts`, `tests/festival.ts`, `tests/scenery.ts`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn `GameSnapshot.version` steigt, ein Feld dazukommt oder
sich Slot-/Export-Wege ändern. Command-Protokoll in `docs/multiplayer.md`.
