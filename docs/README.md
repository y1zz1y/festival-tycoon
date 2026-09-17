# Entwickler- und Agenten-Doku

Diese Dateien beschreiben **wo** Systeme liegen, **welche Invarianten** gelten und
**was bei neuen Funktionen aktualisiert werden muss**. Spieleranleitungen stehen
im Root-`README.md`. Messwerte und Render-/Tick-Architektur: `docs/performance.md`.
Verbindliche Agent-Regeln: Root-`AGENTS.md`.

Beim Arbeiten zuerst diese Index-Tabelle lesen, dann nur die passenden Themen-MDs.

## Pflicht: Doku bei Codeänderungen mitziehen

Neue oder geänderte Funktionen sind erst fertig, wenn die Doku stimmt:

1. **Bestehende Funktion ändern:** das Themen-MD aus der Tabelle unten anpassen
   (Dateien, Einstiege, Invarianten, Tests).
2. **Neue Funktion:** entweder ein vorhandenes Themen-MD ergänzen oder ein neues
   `docs/<thema>.md` anlegen und **hier in der Tabelle** plus in `AGENTS.md`
   eintragen.
3. **Neue zentrale Datei / neuer Export / neuer Command:** den Eintrag
   „Wo finden“ im betroffenen MD ergänzen.
4. **Neuer Balancing-Wert:** in `src/game/simulationConfig.ts` und im
   Themen-MD erwähnen, welches Config-Feld gilt.
5. **Neuer `GameCommand` / Snapshot-Feld:** `docs/multiplayer.md` und
   `docs/saves.md` aktualisieren.
6. **Neuer Test oder anderes Prüfkommando:** `docs/testing.md`.
7. Spieler-sichtbare Steuerung oder Feature: Root-`README.md`.

`AGENTS.md` bleibt kurz (harte Invarianten). Details und Dateikarten leben hier.

## Themenkarte

| Thema | Datei | Typische Aufgaben |
| --- | --- | --- |
| Gesamtarchitektur, Snapshot, Commands | [architecture.md](architecture.md) | Schichten, `GameState`, wo ein Feature andockt |
| Feste Ticks, Zeit, Budgets, RNG | [simulation.md](simulation.md) | Tick-Schleife, Speed, Determinismus |
| Wegsuche, Navigation, Gedränge | [pathfinding.md](pathfinding.md) | A*, Multi-Goal, Cache, Crowd-Kosten |
| Besucher: Bedürfnisse, Entscheidungen | [visitors.md](visitors.md) | Spawn, Needs, Gedanken, Gruppen |
| Camping, Zelte, Treffpunkte | [camping.md](camping.md) | Parzellen, Installationen, Gathering |
| Gebäude, Katalog, Deko, Platzierung | [buildings.md](buildings.md) | `BUILDING_KINDS`, Scenery-Slots, Abriss |
| Kopieren / Baubibliothek | [blueprints.md](blueprints.md) | Rechteck, Vorschau, Stempel, lokale Bibliothek |
| Themen-Deko, Deko-Reiter | [decoration.md](decoration.md) | Festival-Themen, Kategorienfilter, neue Arten |
| Gelände, Boden, Wege, Umgebung | [terrain.md](terrain.md) | Höhen, Ground-Prep, Way-Types |
| Straßen, Fahrzeuge, Waren, Depots | [logistics.md](logistics.md) | Roads, Träger, Lastwagen, Ampeln, Schranken |
| Bandversorgung, Backstage, Tourbus | [band-supply.md](band-supply.md) | Backstage-Flächen, Bandzufriedenheit, Tourbus-Parkplatz, Show-Qualität |
| Personal, Zonen, Sanität, Security | [staff.md](staff.md) | Rollen, Arbeitsbereiche, Tore |
| Müll, Vorfälle, Feuerwerk, Panik | [incidents.md](incidents.md) | Incidents, Waste-Dumps, Ticker, Bubbles |
| Festivalwochenende, Bands, Tickets | [festival.md](festival.md) | Buchungen, Wetter, Ruf, Tagesplan |
| Bühnenwerkstatt, Show, Publikum | [stages.md](stages.md) | Designs, Vorlagen, Zuschauerflächen |
| Achterbahn, Karussell, Bungee | [attractions.md](attractions.md) | Queues, Ride-Zugang, Betrieb |
| Achterbahn-Editor, Schienenstücke | [coaster.md](coaster.md) | Anschluss-State-Machine, Stückkatalog, Bau-UI, Typ-Matrix |
| Atmosphäre, Strom, Tageslicht | [atmosphere.md](atmosphere.md) | Overlays, Power-Netz, Day/Night |
| Darstellung, Batches, Licht | [rendering.md](rendering.md) | `WorldView`, Instancing, Lights |
| UI, Eingaben, Mobile | [ui.md](ui.md) | `main.ts`, Fenster, Touch |
| Mehrspieler, Host, Deltas | [multiplayer.md](multiplayer.md) | Commands, Codec, Server |
| Spielstände, Version, Export | [saves.md](saves.md) | Snapshot-Version, Slots, Base64 |
| Tests und Prüfkommandos | [testing.md](testing.md) | Welche Suite was abdeckt |
| Performance-Messungen | [performance.md](performance.md) | Baseline, rtest3, Render-Freezes |

## Schnellsuche nach Datei

| Bereich | Start |
| --- | --- |
| Spielzustand und Tick | `src/game/GameState.ts` |
| Balancing | `src/game/simulationConfig.ts` |
| Gebäudetypen und Tools | `src/game/catalog.ts` |
| Bau-Menü-Kategorien | `src/game/buildMenu.ts` |
| UI-Orchestrierung | `src/main.ts` |
| 3D-Szene | `src/view/WorldView.ts` |
| Netzwerk-Protokoll | `src/net/protocol.ts` |
| Command-Anwendung | `src/net/commands.ts` |
| Host-Server | `server/serve.ts`, `server/rooms.ts` |
| Test-Einstieg | `tests/regression.ts` |

Fachmodule unter `src/game/*.ts` und Views unter `src/view/*.ts` sind in den
Themen-MDs einzeln zugeordnet.
