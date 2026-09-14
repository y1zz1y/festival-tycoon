# Simulation, Zeit und Determinismus

Die Simulation läuft in festen **100-ms-Ticks** (`SIMULATION_CONFIG.time.tickSeconds`).
Geschwindigkeitsindizes 1 / 2 / 3 bedeuten **1× / 3× / 8×**. Die Darstellung
interpoliert nur. Entscheidungen und Zustandsänderungen dürfen nicht an FPS,
`Date.now()` oder `performance.now()` hängen.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Tick-Orchestrierung | `src/game/GameState.ts` | `advanceOne`, `stepFixed`, `simulateFixedStep` |
| Tick-/Speed-Werte | `src/game/simulationConfig.ts` | `time`, `pathfinding.decisionsPerTick` |
| Deterministischer Zufall | `src/game/rng.ts` | `DeterministicRng`, `hashStringSeed` |
| Tagesplan durchsetzen | `src/game/dayPlan.ts` | Angebote, Öffnungszeiten |
| Festival-Tick | `src/game/festivalManagement.ts` | `updateFestival` |
| Waren-Tick | `src/game/supplyChain.ts` | `updateSupplyChain` |
| Host-Turns / Hash | `src/game/GameState.ts` | `hashSim`, `receiveTurn`, `onTurnCommit` |

`simulateFixedStep` bewegt Besucher, zählt Spielminuten, spawned Gäste, aktualisiert
Festival, Logistik, Personal und Needs. `decisionBudget` wird **pro Tick** aus
`SIMULATION_CONFIG.pathfinding.decisionsPerTick` gesetzt.

## Wichtige Regeln

- Speed skaliert Spielminuten und Bewegung, nicht die Tick-Länge.
- Destination-Entscheidungen (inkl. direkte Ankunfts-/Interaktions-Callbacks)
  zählen gegen `decisionsPerTick`. Aufgeschobene Requests müssen fair leeren.
- Dringende Zustandswechsel, Bewegung und Needs laufen **jeden** Tick weiter.
- Deterministische Budgets zählen Arbeit / `simTick`, niemals Wanduhren.
- Profiling-Uhren (`PROFILE_METHODS`) sind nur Diagnose.
- `festival.planning` und `speed === 0` halten `stepFixed` an; eingeplante
  Commands können in Pause trotzdem über `advanceOne(false)` laufen.

## Tests

Frame-Partition und alle Tempostufen: `tests/regression.ts`.
Entscheidungsbudget und Queue-Drainage: `tests/performanceGuards.ts`.
Last: `npm run test:performance -- rtest3 120` — siehe `docs/performance.md`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Tick-Länge, Speed-Indizes, die Reihenfolge in
`simulateFixedStep`, das Entscheidungsbudget oder die Pause-/Planungslogik
ändern. Neue pro-Tick-Systeme in die Tabelle „Wo finden“ aufnehmen.
