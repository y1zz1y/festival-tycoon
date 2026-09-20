# Festivalwochenende, Musik und Tickets

Der Festivalmodus hängt am Snapshot-Feld `festival` (`FestivalManagement`).
Standard ist aus; ältere Saves bleiben ohne Wochenende lauffähig. Planung
hält die Simulationsuhr an, bis **Festival starten**.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Zustand, Aktionen, Wetter, Ruf | `src/game/festivalManagement.ts` | `FestivalManagement`, `FestivalAction`, `updateFestival`, `BANDS` |
| Command-Einstieg | `src/game/GameState.ts` | `manageFestival` |
| Tages-/Campingzyklus | `src/game/dayPlan.ts` | `getFestivalCycleStatus`, `FestivalPhase` (`lead` Vorbereitung, `festival`, `break` Pause), Angebote |
| Musikgeschmack, Basis-Evolution | `src/game/musicTaste.ts` | `evolveMusicAudience`, `GENRES` |
| Automatischer Spielplan | `src/game/autoLineup.ts` | `planAutoLineup` (min/max Sterne, bestehende Slots bleiben) |
| Ticketnachfrage | `src/game/ticketDemand.ts` | `estimateTicketDemand`, `arrivalPriceMultiplier` |
| Nachfrage-Tuning | `src/game/demandTuning.ts`, `src/game/simulationConfig.ts` | `TicketDemandTuning`, Normalisierung und Standardwerte |
| Waren im Festivalkontext | `src/game/supplyChain.ts`, `src/game/festivalManagement.ts` | `Supply` inkl. `goods` (Allgemeine Waren) |
| Spielplan-UI | `src/musicPlanner.ts` | Band ziehen, Raster |
| Festival-Fenster | `src/festivalUI.ts` | Tickets, Preise, Tagesplan, Auswertung, Ausbauten |
| HEADLINE Magazin | `src/game/headlineMagazine.ts`, `src/headlineMagazineUI.ts` | `buildHeadlineMagazine`, Overlay nach Festivalende |
| Balancing | `src/game/simulationConfig.ts` | `visitors.festivalArrivals`, `economy.defaultEntryPrice`, `economy.defaultCampingTicketPrice` |

## Wichtige Regeln

- `FestivalAction` ist die einzige Mutations-API für Planung, Buchung,
  Tickets, Templates und Infrastructure-Aktionen.
- Buchungen vor Start sind verbindlich; Gagen zählen zur Bilanz.
- Ticketkontingente nach Start sperren. Anreisen verbrauchen Tickets dauerhaft.
  `entryPrice` ist der Tagesticketpreis, `campingTicketPrice` der
  Campingpreis (fehlende Saves übernehmen den bisherigen Eintritt).
  Standard **120 € / 260 €**, damit 600 Camper plus 600 Tagestickets je
  Festivaltag über fünf Tage ein Wochenende von 400–500 k€ Kosten mit
  kleinem Plus tragen (600×260 + 5×600×120 = 516 k€). Slider 20–250 /
  40–500. Gäste bekommen `visitors.budget` plus Camper
  `campingTicketReserve`, damit der Eintritt zahlbar bleibt.
  Tagesplan, Zyklus und Preise stellt ihr im Fenster **Festival planen**.
  Ampeln und Personentore können dieselben Angebote (`DayPlanOffer`, inkl.
  `shops` für Souvenirläden) sowie die Zyklusphasen als Zeitsteuerung nutzen.
  Fehlendes `shops` im Tagesplan nutzt den Default 8–23 Uhr.
- Wetter und `wetness` sind deterministisch (`festival.seed`) und müssen
  gespeichert werden. Nässe kann Navigation invalidieren (`groundWetBucket`).
- Musikbasis entwickelt sich einmalig nach der Ausgabe; ausgefallene Slots
  zählen nicht.
- Neue Bands: `BANDS` plus Geschmack in `musicTaste.ts`. Keine geschützten
  RCT-/Echtband-Inhalte. Sterne aus Reputation (`bandStarRating`); 5-Sterne
  nur aus `festival.headlinerPool` (Sim-RNG beim Vorbereiten). Planner-Tabs
  und Auto-Plan filtern nach Sternen und überschreiben keine bestehenden Slots.
  Ticket-Slider färben die erwartete Kaufbereitschaft (grün/gelb/rot über
  CSS-Variable `--range-accent` am Range-Thumb und -Track; natives
  `accent-color` greift nach dem custom Slider-Styling nicht mehr);
  Spawn skaliert mit `arrivalPriceMultiplier`. Gästebudget ist
  `visitors.budget` (80), nicht 1e6.
- Zahlungsbereitschaft, faire Preise, Preisakzeptanz, Teilnahme und Anreise
  lesen ausschließlich `festival.demandTuning` mit normalisiertem Fallback auf
  `SIMULATION_CONFIG.ticketDemand`. Das Debugfenster wertet Entwürfe live aus;
  erst **Übernehmen** sendet die vollständige Konfiguration an den Host.
- Nach dem letzten Festivaltag (`festival.finished`) öffnet einmal pro Ausgabe
  das **HEADLINE Magazin** (`buildHeadlineMagazine`). Es rechnet nur aus
  vorhandenen Snapshot-Feldern (Tagesberichte, Ruf, Anreisen, Bilanz,
  Buchungen, Festivallust, Müll/Vorfälle, Strom, Backstage/`showQuality`,
  Sanität/Security, Beschwerden, Atmosphäre). Kein zweites Wirtschaftssystem,
  kein neues Snapshot-Feld, kein `Math.random()`/`Date.now()`. 3–6 Pro- und
  3–6 Kontra-Zeilen aus Schwellen; fehlende Kontras werden mit einer dünnen
  „könnte schärfer“-Seite gefüllt. Host und Clients zeigen denselben Text zum
  gleichen Snapshot. Erneut öffnen: Abrechnung & Ruf → **HEADLINE Magazin
  aufschlagen**. Mitternacht vor dem Endtag zählt nicht als Ausgabeende.

## Tests

`tests/festival.ts` (Ablauf, Buchung, Lager, Ruf). `tests/musicPlanning.ts`.
`tests/stageTickets.ts`. `tests/festivalAdditions.ts`.
`tests/headlineMagazine.ts` (Magazin nur nach `finished`, mindestens ein
Pro/Kontra, deterministisch, nicht mitten im Wochenende).

Bandversorgung / Backstage / Tourbus-Ankunft (Morgen ~08:00 / Abend ~23:00
an der Festivaluhr, `BANDS.draw` ≥ 30 will einen Bus, sonst Personaleingang):
[`band-supply.md`](band-supply.md). `BANDS` und `Booking` bleiben die
Buchungsquelle. `bandActors` sind keine Gäste; sie tragen `costumeId` /
`role` aus `bandLooks.ts` und sehen auf Bühne und Backstage gleich aus.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Aktionen, Ticketregeln, Wetter, Rufachsen, Bands, der
Planungs-/Start-Zyklus oder die Endauswertung (HEADLINE Magazin) ändern.
Bühnenwerkstatt bleibt in `docs/stages.md`. Spielerregeln auch im Root-`README.md`.

Der Festivalbereich kombiniert die Ticketpreis-Regler samt Nachfrageschätzung mit dem separaten Reiter **Upgrades** für die Infrastruktur-Ausbaustufen.
