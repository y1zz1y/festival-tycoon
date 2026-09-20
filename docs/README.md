# Entwickler- und Agenten-Doku

Dies ist der verbindliche Aufgaben-Router für Entwickler und Agents. Zuerst die
passende Zeile der Themenkarte öffnen; dort stehen vollständige Dateipfade,
Symbole, Invarianten und Tests. Spieleranleitungen stehen im Root-`README.md`,
harte globale Regeln in `AGENTS.md`, Messwerte in `docs/performance.md`.

## Kanonische Zuständigkeit

- `AGENTS.md` enthält nur globale, harte Invarianten und verweist hierher.
- Jedes Fachthema besitzt genau ein kanonisches Topic-MD; andere Topics verlinken
  dorthin, statt Regeln oder Feature-Historie zu duplizieren.
- Ein Topic pflegt aktuelle Architektur und Verhalten. Nützliche historische
  Begründungen bleiben erhalten, werden in Phase 1 aber nicht massenhaft verschoben.
- Für neue Topics dient [topic-template.md](topic-template.md) als Strukturhilfe.

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
6. **Server-/Shared-Änderung:** prüfen, dass Docker-Laufzeitdateien im Image
   liegen (kein Value-Import `server/` → `src/`); Regel in
   [multiplayer.md](multiplayer.md#docker-laufzeit).
7. **Neuer Test oder anderes Prüfkommando:** `docs/testing.md`.
8. Spieler-sichtbare Steuerung oder Feature: Root-`README.md`.

Vor Abschluss jeder Änderung läuft `npm run validate`; Details und
Qualitätsgrenzen stehen in [testing.md](testing.md).

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
| Finanzen, Buchungen, Darlehen | [finance.md](finance.md) | Ledger, Prognose, Kreditrahmen |
| Konten, Sessions, Authentifizierung | [accounts.md](accounts.md) | Konto-API, Cookies, Rate-Limit |
| Bühnenwerkstatt, Show, Publikum | [stages.md](stages.md) | Designs, Vorlagen, Zuschauerflächen |
| Achterbahn, Karussell, Bungee | [attractions.md](attractions.md) | Queues, Ride-Zugang, Betrieb |
| Kurs-Attraktionen | [course-attractions.md](course-attractions.md) | Mudmasters, Bad, Tree-to-Tree, Paintball |
| Achterbahn-Editor, Schienenstücke | [coaster.md](coaster.md) | Anschluss-State-Machine, Stückkatalog, Bau-UI, Typ-Matrix |
| Atmosphäre, Strom, Tageslicht | [atmosphere.md](atmosphere.md) | Overlays, Power-Netz, Day/Night |
| Festival-SFX, Kamera-Listener | [audio.md](audio.md) | Pools, Distanz, Cluster, Mute |
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
| Snapshot-Typen | `src/game/types/entities.ts` (`Cell`, `PlacedBuilding`, `Visitor`), `src/game/types/snapshot.ts` (`GameSnapshot`, `SimTurn`) |
| Snapshot-Erzeugung, Migration, Reparatur | `src/game/snapshotBootstrap.ts`, `src/game/snapshotMigration.ts`, `src/game/snapshotRepair.ts` |
| Balancing | `src/game/simulationConfig.ts` |
| Gebäudetypen und Tools | `src/game/catalog.ts` |
| Bau-Menü-Kategorien | `src/game/buildMenu.ts` |
| UI-Bootstrap / Orchestrierung | `src/main.ts`, `src/app/gameLoop.ts`, `src/input/toolRouter.ts`, `src/ui/*.ts` |
| 3D-Szene | `src/view/WorldView.ts` |
| Fassaden, Dächer, Themen-Eimer | `src/game/decorationWalls.ts` (`WALL_KINDS`, `wallSpec`, `ROOF_KINDS`, `roofSpec`) |
| Wegmöbel-Ausrichtung | `src/game/pathFurniture.ts` (`pathFurnitureRotation`) |
| Track-Editor-Modus | `src/game/trackEditorMode.ts` (`palette` / `directionArrows`) |
| Brücken- und Wegdetails | `src/view/wayStructures.ts` (`indexWayStructures`, `wayStructurePlan`, `createWayStructure`) |
| Bühnen-Orientierungsgizmo | `src/view/orientationGizmo.ts` (`createOrientationGizmo`, `OrientationGizmo`) |
| Titelbild-Publikum | `src/titleCrowd.ts` (`mountTitleCrowd`, `TitleCrowd`) |
| Festival-SFX | `src/game/audio.ts`, `src/view/FestivalAudio.ts` |
| Netzwerk-Protokoll | `src/net/protocol.ts` |
| Command-Anwendung | `src/net/commands.ts` |
| Host-Server | `server/serve.ts`, `server/rooms.ts` |
| Test-Einstieg | `tests/regression.ts` |

Fachmodule unter `src/game/*.ts` und Views unter `src/view/*.ts` sind in den
Themen-MDs einzeln zugeordnet.
