# Fortschritt und Erfolge

Fortschritt über Partien (A8) und Erfolge (E1): welches Szenario mit welcher
Note geschafft wurde und welche Auszeichnungen freigeschaltet sind. Beides
liegt außerhalb jedes Spielstands, im Browser und für angemeldete Spieler im
Konto.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Datentyp, Normalisieren, Best-of-Merge, Erfolgsliste | `server/progressProtocol.ts` | `ProgressRecords`, `normalizeProgress`, `mergeProgress`, `ACHIEVEMENTS` |
| Konto-Endpunkt `/api/progress` | `server/progress.ts` | `handleProgressRequest` (GET, PUT) |
| Browser-Speicher, Eintragen, Abgleich | `src/game/progress.ts` | `readLocalProgress`, `recordScenarioResult`, `unlockAchievements`, `syncProgress` |
| Erfolge aus dem Snapshot ablesen | `src/game/achievements.ts` | `earnedAchievements` |
| Anbindung ans Spiel | `src/ui/progressTracker.ts` | `mountProgressTracker` (`recordDecided`, `checkAchievements`, `sync`) |
| Titelbildschirm: Häkchen, Erfolge | `src/ui/titleProgress.ts`, `src/ui/titleScreen.ts` | `scenarioBadgeMarkup`, `achievementRowsMarkup`, `refreshProgress` |
| Tests | `tests/progress.ts`, `tests/festivalExtras.ts`, `tests/hostTakeover.ts` | `testProgress`, `testAchievements`, `testTakeoverNotices` (kein Eintrag für übernommene Parks) |

## Regeln

- **Speicher:** `localStorage` unter `festival-progress`, nie im Spielstand.
  Kaputte oder fremde Einträge werden beim Lesen normalisiert (unbekannte Ids,
  Werte außerhalb 0–100 bzw. 0–5 fallen weg oder werden begrenzt).
- **Best-of:** Gewonnen bleibt gewonnen, die höhere Note zählt, das früheste
  Datum bleibt. Server und Browser mergen gleich, darum ist die Reihenfolge des
  Abgleichs egal. `PUT /api/progress` antwortet mit dem gemergten Stand.
- **Wer zählt:** nur der Host oder ein Solo-Spiel, nie ein Gast im fremden Raum,
  nie der Szenario-Editor und nie ein Spiel mit Debug-Geld
  (`snapshot.debugAssisted`, gesetzt von `addDebugMoney`). Auch nie ein Park,
  den ein Gast per Host-Übernahme geerbt hat: Solange genau diese Welt läuft
  (`MultiplayerSession.inheritedHost`, an das `GameState`-Objekt gebunden, auch
  nach dem Verlassen des Raums), liefert `isInheritedWorld` in
  `mountProgressTracker` true. Lädt der Spieler danach einen anderen Stand oder
  startet neu, zählt es wieder. Kein Snapshot-Feld — ein gespeicherter und
  später geladener „Übernommen“-Stand zählt wie jeder geladene Stand.
- **Szenario-Ergebnis:** beim Übergang laufend → gewonnen/verloren
  (`scenarioStatus` ruft `onDecided`), unter `scenario.preset`, mit
  `scenarioScore`/`scenarioStars` wie im Endbildschirm. Freies Spiel ohne
  Preset wird nicht eingetragen.
- **Erfolge:** `earnedAchievements` liest nur den Snapshot und die Datensätze;
  der Tracker prüft etwa alle 100 Ticks und meldet Neues per Toast. Die
  Schwellen stehen in `ACHIEVEMENTS` und in `earnedAchievements`.
- **Abgleich:** beim Start nach `refreshAccount`, nach Anmelden/Registrieren und
  nach jedem neuen Eintrag. Ohne Konto oder Server bleiben die lokalen Daten.
- Der Titelbildschirm zeigt bei geschafften Szenarien „✔“ und die besten Sterne,
  unter „Neues Spiel“ die Zahl der geschafften und im Menü „Erfolge“ alle
  Erfolge mit Datum. Alle Szenarien bleiben spielbar (keine Sperren).

## Bei Änderungen dieses Dokuments

Aktualisieren bei neuen Erfolgen, anderen Schwellen, anderem Speicher oder
Endpunkt. Neue Erfolge brauchen einen Eintrag in `ACHIEVEMENTS` und eine Regel in
`earnedAchievements`; der Server lässt unbekannte Ids fallen.
