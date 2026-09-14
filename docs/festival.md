# Festivalwochenende, Musik und Tickets

Der Festivalmodus hängt am Snapshot-Feld `festival` (`FestivalManagement`).
Standard ist aus; ältere Saves bleiben ohne Wochenende lauffähig. Planung
hält die Simulationsuhr an, bis **Festival starten**.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Zustand, Aktionen, Wetter, Ruf | `src/game/festivalManagement.ts` | `FestivalManagement`, `FestivalAction`, `updateFestival`, `BANDS` |
| Command-Einstieg | `src/game/GameState.ts` | `manageFestival` |
| Tages-/Campingzyklus | `src/game/dayPlan.ts` | `getFestivalCycleStatus`, Angebote |
| Musikgeschmack, Basis-Evolution | `src/game/musicTaste.ts` | `evolveMusicAudience`, `GENRES` |
| Automatischer Spielplan | `src/game/autoLineup.ts` | `planAutoLineup` |
| Waren im Festivalkontext | `src/game/supplyChain.ts` | über `infrastructureAction` |
| Spielplan-UI | `src/musicPlanner.ts` | Band ziehen, Raster |
| Festival-Fenster | `src/festivalUI.ts` | Tickets, Preise, Tagesplan, Auswertung, Ausbauten |
| Balancing | `src/game/simulationConfig.ts` | `visitors.festivalArrivals`, `economy.defaultEntryPrice`, `economy.defaultCampingTicketPrice` |

## Wichtige Regeln

- `FestivalAction` ist die einzige Mutations-API für Planung, Buchung,
  Tickets, Templates und Infrastructure-Aktionen.
- Buchungen vor Start sind verbindlich; Gagen zählen zur Bilanz.
- Ticketkontingente nach Start sperren. Anreisen verbrauchen Tickets dauerhaft.
  `entryPrice` ist der Tagesticketpreis, `campingTicketPrice` der
  Campingpreis (fehlende Saves übernehmen den bisherigen Eintritt).
  Tagesplan, Zyklus und Preise stellt ihr im Fenster **Festival planen**.
- Wetter und `wetness` sind deterministisch (`festival.seed`) und müssen
  gespeichert werden. Nässe kann Navigation invalidieren (`groundWetBucket`).
- Musikbasis entwickelt sich einmalig nach der Ausgabe; ausgefallene Slots
  zählen nicht.
- Neue Bands: `BANDS` plus Geschmack in `musicTaste.ts`. Keine geschützten
  RCT-/Echtband-Inhalte.

## Tests

`tests/festival.ts` (Ablauf, Buchung, Lager, Ruf). `tests/musicPlanning.ts`.
`tests/stageTickets.ts`. `tests/festivalAdditions.ts`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Aktionen, Ticketregeln, Wetter, Rufachsen, Bands oder
der Planungs-/Start-Zyklus ändern. Bühnenwerkstatt bleibt in `docs/stages.md`.
Spielerregeln auch im Root-`README.md`.
