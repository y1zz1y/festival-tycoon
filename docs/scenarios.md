# Szenarien, Ziele und Spielausgang

Ein Szenario ist eine Partie mit Zielen. Es beginnt mit einem Briefing, misst
Ziele an der Parkentwicklung und an beendeten Festival-Ausgaben, erinnert am
Stichtag an die nächste Ausgabe und endet gewonnen oder verloren. Ohne Ziele
ist die Partie freies Spiel: kein Stichtag, kein Ende, Insolvenz nur als
Warnung. Wochenendziele einer einzelnen Ausgabe gehören zum Festival
([festival.md](festival.md)); Guthaben, Darlehen und Kreditrahmen zu den
Finanzen ([finance.md](finance.md)).

## Wo finden

| Aufgabe | Vollständiger Pfad | Einstieg / Symbol |
| --- | --- | --- |
| Szenario-Einstellungen, Zielarten | `src/game/scenario.ts` | `ScenarioSettings`, `ScenarioGoal`, `PARK_GOAL_KINDS`, `EDITION_GOAL_KINDS`, `normalizeScenarioSettings` |
| Vorbereitete Szenarien | `src/game/scenarioPresets.ts` | `SCENARIO_PRESETS`, `scenarioPreset` |
| Fortschritt, Ausgang, Insolvenz, Stichtag | `src/game/scenarioGoals.ts` | `ScenarioProgress`, `updateScenarioProgress`, `recordEditionResult`, `updateInsolvency`, `isEditionOverdue`, `normalizeScenarioProgress`, `scenarioScore` |
| Anbindung an den Tick | `src/game/GameState.ts` | `updateScenarioDay` (Tageswechsel), `recordFinishedEdition` (Ausgabeende nach `updateFestival`) |
| Mitwachsende Wochenendziele | `src/game/festivalManagement.ts` | `weekendGoals`, gesetzt in `prepare` und `start`; `editionSatisfaction`, `festivalReputation` |
| Ticker-Meldungen | `src/game/ticker.ts` | `goalDone`, `goalFailed`, `goalDeadline`, `insolvency`, `editionDue` |
| Zielanzeige, Endbildschirm, Stichtag-Übersicht | `src/ui/scenarioStatus.ts` | `mountScenarioStatus`, `goalListMarkup`, `editionTableMarkup` |
| Briefing, Szenariostart | `src/ui/titleScreen.ts` | `briefingMarkup`, `openTitleBriefing`, `startScenario`, `leaveToTitle` |
| Ziele im freien Spiel, Zusammenfassung | `src/ui/scenarioScreen.ts` | `readGoals`, `fillGoals`, `updateSummary` |
| Balancing | `src/game/simulationConfig.ts` | `scenario.firstEditionDays`, `scenario.insolvencyGraceDays`, `scenario.weekendGoals`, `scenario.weekendGoalGrowth` |
| Tests | `tests/scenarioOutcome.ts` | `testScenarioOutcome` |

## Datenfluss und Zuständigkeit

**Zielarten.** Parkziele (`guests`, `money`, `parkValue`, `loanFree`) sehen den
Park, wie er steht, und werden jeden Tag geprüft. Ausgabeziele (`admissions`,
`satisfaction`, `reputation`, `profit`) werden an beendeten Ausgaben gemessen;
`streak` verlangt so viele Ausgaben hintereinander, alle bis zur Frist.
`guests` ist die Spitzenzahl gleichzeitiger Gäste und bleibt nur für alte
Spielstände: Eine einzige volle Minute erfüllte es. Presets fragen deshalb
`admissions` ab, das freie Spiel bietet `guests` nicht an. Jede Art hat genau
ein Mitglied in der Union `ScenarioGoal`, damit `goal.kind` sauber verengt.

**Frist.** Ein Ziel mit `edition: N` ist verpasst, sobald die Finanzausgabe
(`financeEdition`) größer als N ist, also direkt nach dem Ende der Ausgabe N.
Erreicht bleibt erreicht.

**Ausgabeende.** `GameState` merkt sich vor `updateFestival`, ob die Ausgabe
schon beendet war; springt `festival.finished` auf `true`, ruft
`recordFinishedEdition` `recordEditionResult` mit Anreisen, Zufriedenheit der
Festivaltage (`editionSatisfaction`), Ruf (`festivalReputation`) und der
Finanzspalte der Ausgabe auf. Die Ausgabeziele werden sofort gewertet, damit
die entscheidende Ausgabe das Szenario im selben Moment beendet.

**Tageswechsel.** `updateScenarioDay` ruft `updateScenarioProgress`
(Spitzenwert, Parkziele, Fristen) und `updateInsolvency` auf. Insolvent ist
ein Park mit negativem Guthaben, das der freie Kreditrahmen (`loanLimit`)
nicht deckt. Jeder solche Tag zählt `insolventDays` hoch, ein gedeckter Tag
setzt ihn zurück. Nach `insolvencyGraceDays` verliert ein Szenario mit Zielen.

**Ausgang.** `resolveScenarioOutcome`: alle Ziele erreicht ergibt `won`, ein
verpasstes Ziel `lost` (Grund `deadline`), Insolvenz `lost` (Grund
`insolvent`). Der Ausgang ist endgültig. Die Simulation setzt dann
`speed = 0`; nach einem Sieg läuft die Partie mit „Weiterspielen“ als freies
Spiel weiter.

**Stichtag.** Szenarien mit Zielen haben `nextEditionDue`: beim Start
`1 + firstEditionDays`, nach jeder Ausgabe deren Endtag plus die Pausentage
des Tagesplans. Ist er erreicht, läuft keine Ausgabe und wird keine geplant
(`isEditionOverdue`), ruft `updateScenarioDay` `festivalAction('prepare')` auf:
Die Planung öffnet und hält die Uhr an. `dueReminderDay` merkt den Tag; jeder
Client öffnet beim Wechsel dieses Werts Festivalfenster und Stichtag-Übersicht.
Wer mit „Freies Spiel fortsetzen“ ausweicht, wird am nächsten Tageswechsel
wieder erinnert. Ein neues Szenario startet ohnehin in der Planung, der Stichtag
greift also nur, wenn die Uhr ohne Ausgabe läuft.

**Oberfläche.** Das Briefing liest nur das Preset. Die Zielanzeige
`#scenario-goals-stat` steht in der Statusleiste und öffnet das Finanzfenster.
Der Endbildschirm ist eine Sonderausgabe des HEADLINE Magazins
(`src/headlineMagazine.css`) und wartet, bis das Magazin der entscheidenden
Ausgabe geschlossen ist. „Neu starten“ und „Zum Titel“ fragen nach
ungespeicherter Arbeit. Auf Clients zeigt er nur „Schließen“; der Host
entscheidet. Die Stichtag-Übersicht liegt mit z-index 48 über dem
Festivalfenster (46) und unter den Leisten-Dropdowns (50).

## Wichtige Invarianten

- Nur der Host rechnet Fortschritt, Ausgang, Insolvenz und Stichtag. Clients
  bekommen `scenarioProgress` über das normale Welt-Delta
  ([multiplayer.md](multiplayer.md)); Ticker und Oberfläche leiten alles aus
  dem Snapshot ab und sind auf allen Clients gleich.
- Keine Wanduhrzeit: Tage, Ausgaben und `simTick` bestimmen alles.
- `normalizeScenarioProgress` ist idempotent und läuft bei Migration und
  Reparatur. Alte Stände behalten ihre Zielmarken; ein fehlender Stichtag wird
  vom Ladetag aus gezählt, damit niemand sofort angehalten wird.
- Optionale Einstellungen (`firstEditionDays`, `festivalGoals`, `streak`)
  fehlen im JSON, statt `undefined` zu sein, damit das freie Spiel über das
  Netz unverändert ankommt.
- Ticker und Oberfläche nehmen beim ersten Blick nach dem Laden nur Notiz; ein
  schon entschiedenes Szenario oder erreichtes Ziel ist keine Meldung.

## Tests

`tests/scenarioOutcome.ts`: Normalisierung und neue Zielarten, Presets ohne
Preis und ohne `guests`, idempotente Fortschritts-Migration, Ausgabeziele mit
Serien, Sieg und Niederlage (endgültig), Insolvenz mit Frist und im freien
Spiel, Stichtag mit Pause und Planung, mitwachsende Wochenendziele, ein
Durchlauf über echte Ticks bis zum Ausgabeende, Ticker-Meldungen und
Gesamtnote. `tests/snapshotModules.ts` prüft die Migration v33 → v34,
`tests/finance.ts` Presets und die Tagesprüfung.

## Bei Änderungen dieses Dokuments

Aktualisieren, wenn Zielarten, Fristregeln, Ausgangsgründe, Stichtag,
Balancingwerte, die Felder von `ScenarioProgress` oder die Szenario-Oberfläche
sich ändern. Neue Felder zusätzlich in [saves.md](saves.md) und
[multiplayer.md](multiplayer.md), Spielerregeln im Root-`README.md`.
