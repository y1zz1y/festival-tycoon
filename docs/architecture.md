# Gesamtarchitektur

Die Simulation kennt Three.js nicht. `GameState` ist die einzige autoritative
Quelle für Spielregeln, Zeit und Wirtschaft. Die Ansicht interpoliert nur.
Netzwerk-Clients mutieren die Welt nicht lokal dauerhaft; der Host entscheidet.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Spielzustand, Tick, Platzierung, Besucher-Orchestrierung | `src/game/GameState.ts` | `GameState`, `GameSnapshot` (aktuell `version: 30`) |
| Bandversorgung / Backstage | `src/game/bandSupply.ts`, `src/game/bandActors.ts`, `src/game/bandLooks.ts` | Graph, Stats, Tourbus / Personaleingang, Bühnen-/Backstage-Kostüm |
| Balancing (Tempo, Kosten, Wahrscheinlichkeiten) | `src/game/simulationConfig.ts` | `SIMULATION_CONFIG` |
| Gebäudetypen, Tools, Anzeigedaten | `src/game/catalog.ts` | `BUILDING_KINDS`, `BUILDINGS`, `Tool` |
| Themen-Deko | `src/game/decoration.ts` | Katalogfilter, keine Snapshot-Felder |
| Spielerbefehl → Methode | `src/net/commands.ts` | `applyGameCommand` |
| Befehls- und Delta-Typen | `src/net/protocol.ts` | `GameCommand`, Snapshots |
| UI, Eingaben, Systemverkabelung | `src/main.ts` | Event-Binding, Tool-Leiste |
| HEADLINE Magazin (abgeleitet) | `src/game/headlineMagazine.ts` | `buildHeadlineMagazine` aus Snapshot, kein neues Feld |
| 3D-Szene | `src/view/WorldView.ts` | Kamera, Picking, Instancing |
| Host-HTTP/WebSocket | `server/serve.ts` | Dev- und Docker-Server |
| Mehrspieler-Räume | `server/rooms.ts` | `attachMultiplayer` |

Fachlogik liegt in eigenen Modulen unter `src/game/` und wird von `GameState`
aufgerufen. Views unter `src/view/` lesen den Snapshot und dürfen ihn nicht
autoritativ ändern.

## Schichten

```
UI (main.ts, *UI.ts)  →  GameCommand  →  GameState.gate / Host
                                              ↓
                                    festen 100-ms-Tick
                                              ↓
                         game/* Systeme (Pfad, Camp, Staff, …)
                                              ↓
                         GameSnapshot  →  WorldView / Overlays
```

Spieleraktionen gehen als `GameCommand` durch `GameState.gate`. Im Host-Modus
werden sie verzögert und in `SimTurn`s committed. Die Darstellung hängt am
Snapshot und interpoliert zwischen Ticks.

## Wichtige Regeln

- Spielzustand nur in der Simulation mutieren, nie aus Render-Frames.
- Neue persistente Felder gehören in `GameSnapshot` und müssen normalisiert,
  gespeichert und über den Host synchronisiert werden.
- Neue Befehle brauchen einen `GameCommand`-Typ, einen Zweig in
  `applyGameCommand` und eine `GameState`-Methode mit `ActionResult`.
- Geometrie, IDs und Texte bleiben in Fachmodulen; Zahlen, die Tempo oder
  Stärke steuern, gehören nach `simulationConfig.ts`.

## Tests

`tests/regression.ts` orchestriert die Suite. Architektur-Änderungen an Tick,
Commands oder Snapshot treffen fast immer auch `docs/multiplayer.md` und
`docs/saves.md`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn sich Schichten, der Snapshot-Einstieg, der Command-Pfad
oder die Rolle von `GameState` / `WorldView` / `main.ts` ändern. Neue
Top-Level-Ordner oder ein neues Orchestrierungsmodul hier eintragen.
