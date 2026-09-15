# Mehrspieler

Der **Host** simuliert. Clients schicken `GameCommand`s (inkl. Bauhöhe und
Drehung) und empfangen periodische Weltdeltas. Alle Teilnehmer brauchen
dieselbe Spielversion. Es gibt keine automatische Host-Übernahme.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Befehls- und Nachrichtentypen | `src/net/protocol.ts` | `GameCommand`, World/Sim-Snapshots |
| Command → `GameState` | `src/net/commands.ts` | `applyGameCommand` |
| Kompakte Pakete | `src/net/codec.ts` | `packWorld` |
| Deltas, Ankunft/Abreise | `src/net/worldUpdates.ts` | `WorldUpdates`, `applyWorld` |
| Client-Session | `src/net/session.ts` | `MultiplayerSession` |
| UI-Bindung | `src/net/bind.ts` | `enableMultiplayerCommands` |
| Host-Turns, Optimistic | `src/game/GameState.ts` | `gate`, `receiveTurn`, `applyNetworkWorld` |
| Server-Räume | `server/rooms.ts` | `attachMultiplayer` |
| WebSocket-Plugin | `server/wsPlugin.ts` | Kompression, Puffergrenze |

## Wichtige Regeln

- Neue spielerseitige Aktion: `GameCommand` in `protocol.ts`, Zweig in
  `commands.ts`, autoritative Methode in `GameState`, ggf. Optimistic-Flags.
- Neue persistente Weltfelder: Codec / `worldUpdates` und Join-Vollsync.
  Lieferwagen liegen in `logistics.roadVehicles` (`deliveryTruck` /
  `deliveryId`) und weiter in `festival.infrastructure.trucks`.
  Ampeln/Schranken: `placeTrafficLight`, `placePathBarrier`,
  `configureAccessControl`, `toggleAccessControlArea`,
  `clearAccessControlArea`; Snapshot-Feld `accessControls`.
  `configureAccessControl` darf `scheduleTime`, `scheduleHours`,
  `scheduleOffer` und `schedulePhases` mitsenden.
  Ticketpreise: `entryPrice` (Tag) und `campingTicketPrice` (Camping);
  Commands `updateEntryPrice` und `updateCampingTicketPrice`.
  T-Shirt-Stand: `configureShirtStall` (`color`, `style`). Gäste-Felder
  `ownedMascot`, `heldMascot`, `wornShirt` liegen im PackedVisitor.
  Personalzonen: `toggleStaffZone`, `setStaffZone` (`active` an/aus für
  genau einen 3×3-Schlüssel) und `fireStaffMember` (auch für Saugroboter
  anhand der Fahrzeug-ID). Ziehen sendet idempotente `setStaffZone`-Schritte
  statt Toggle, damit der gesperrte Malmodus nicht flackert. `workZones` liegt
  am Staff-Mitglied bzw. am Saugroboter in `logistics.roadVehicles` und kommt
  über Sim-Pakete.
  `queueSplit` an Queue-Wegen ist kein Command, sondern Host-seitig
  abgeleitet wie `queueDirection` und kommt mit dem Gebäude-Snapshot.
  Der Vorfall-Ticker wird auf jedem Client aus `incidents`, Panik-Gästen
  und `wasteDumpCells` abgeleitet; kein `GameCommand` und kein extra
  Snapshot-Feld.
  Festival-Action `staffGate` darf `direction` (Baurichtung, Kante) mitsenden;
  fehlend gilt 0. Alte Clients ohne Feld bleiben gültig.
  `placePath.slope` ist eine Zahl (neu ±0.5, Legacy ±1). Neue Commands
  `placeRoad` und `undoRoad` setzen Straßenrampen host-autoritativ.
  `undoRoad` darf optionales `elevation` mitsenden, damit nur eine Lage
  einer gestapelten Autostraße zurückgenommen wird.
  `removeCoaster` (`coasterId`) reißt Schiene, Station, Zug, Tore und die
  angeschlossene Eingangsqueue host-autoritativ ab; optimistic wie die
  übrigen Coaster-Baucommands.
- Clients dürfen Construction optimistic zeigen, aber der Host bleibt
  maßgeblich (`resolveOptimisticCommand`, Reconciliation).
- Besucher feldweise updaten; unveränderte Bereiche nicht erneut senden.
- Determinismus: gleicher Tick + gleiche Commands → gleicher `hashSim`.
- Host muss geöffnet bleiben.

## Tests

`tests/regression.ts` (echte WebSockets, zwei Clients, später Join,
Pause/Resume, Deltas). Ride-Reconciliation: `tests/rideAccess.ts`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Commands, Snapshot-Teile, Delta-Strategie, Tick-Delay
oder Server-Raumlogik ändern. Save-Felder parallel in `docs/saves.md`.
