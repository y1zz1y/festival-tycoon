# Finanzen

Jeder Geldfluss wird im Ledger gebucht. Eine Spalte entspricht einer
Festival-Ausgabe; Prognosen kombinieren wiederkehrende Einnahmen des letzten
vollen Tages mit den aktuell berechenbaren Fixkosten.

## Wo finden

| Aufgabe | Vollständiger Pfad | Einstieg / Symbol |
| --- | --- | --- |
| Ledger, Kategorien, Prognose | `src/game/finance.ts` | `bookFinance`, `financeEdition`, `financeForecast` |
| Darlehensregeln | `src/game/finance.ts` | `LOAN`, `loanLimit`, `loanInterest`, `canAfford` |
| Szenario-Startgeld / Schulden | `src/game/scenario.ts`, `src/game/snapshotBootstrap.ts`, `src/game/scenarioFile.ts` | `startingMoney`, `startingLoan`; Editor: Ausgaben werden nicht gebucht |
| Zustands-API und laufende Kosten | `src/game/GameState.ts` | `GameState.financeOverview`, `GameState.manageLoan`, `GameState.financeForecast` |
| Aufschlüsselung der Kostenzeilen | `src/game/financeBreakdown.ts` | `financeCostBreakdown` |
| Spalten- und Postennamen (Texte) | `src/game/finance.ts`, `src/game/financeBreakdown.ts` | `FINANCE_CATEGORY_NAMES` (kanonisches Deutsch; `Gelände` als `dc('finance', …)`, die UI zeigt jede Spalte mit `localize(name, 'finance')`), `FINANCE_BREAKDOWN_SECTION_NAMES`, Hinweise und Posten als `de` (Postennamen mit `localizeName`, Bands wörtlich); Übersetzungen in `src/i18n/en/operations.ts` |
| Leerlauf-/Bühnen-/Kurs-Unterhalt | `src/game/upkeep.ts` | `buildingHourlyUpkeep`, `coasterHourlyUpkeep`, `courseHourlyUpkeep`, `festivalIsLive`, `venueUpkeepIdle` |
| Finanzfenster | `src/main.ts`, `src/ui/financePanel.ts` | `updateFinancePanel`, `renderFinanceLedger` |
| Szenario-Finanzziele, Insolvenz | `src/game/scenarioGoals.ts` | `updateScenarioProgress`, `updateInsolvency`, `isInsolvent` (Guthaben unter null, das der freie Kreditrahmen `loanLimit` nicht deckt); Regeln in [scenarios.md](scenarios.md) |
| Regressionen | `tests/finance.ts` | `testFinance` |

## Wichtige Invarianten

- Geldänderungen laufen über `bookFinance`; Darlehensauszahlung und Tilgung
  ändern Bargeld und Schuld, sind aber weder Einnahme noch Ausgabe.
  Im Szenario-Editor (`scenario.authoring`) gilt **Baukosten 0**:
  `canAfford` ist immer wahr, negative `bookFinance`-Buchungen entfallen.
- Buchungen werden auf Cent gerundet und auf acht Festival-Ausgaben begrenzt.
- Zinsen und laufende Kosten werden aus **Kalender**-Simulationszeit berechnet
  (`economyIntervalMinutes` = 60 Spielminuten, `runEconomy` je voller Spielstunde).
  Eine langsamere Uhr (`time.normalDayDurationSeconds`) verlängert den Spieltag
  in Echtzeit, ändert aber nicht den Betrag pro Spieltag oder Spielstunde.
  Ist kein Festival **live** (`festivalIsLive`: gestartet, nicht Planung,
  nicht beendet, Zyklusphase `festival`), sitzen Stände, Fahrgeschäfte,
  Coaster und Kurse auf `economy.pauseUpkeepMultiplier` (**5 %** Leerlauf).
  Festivalbühnen zahlen dann `economy.inactiveFestivalStageMultiplier`
  (**5 %** Gebäudeunterhalt) und **0** Technik. Personal, Träger, Zinsen,
  Müllwagen und sonstige Infra bleiben voll. Maßgeblich ist
  `getFestivalCycleStatus` plus Festivalstatus, nicht `speed === 0`.
- `GameSnapshot.finance` bleibt save- und multiplayer-kompatibel; alte Stände
  ohne gültige Perioden erhalten `createFinanceState()`.
- Die Ledger-Zeilen **Betriebskosten**, **Personal**, **Gagen** und
  **Kreditzinsen** sind unabhängig aufklappbar. Die Teilposten kommen nicht
  aus historischen Buchungszeilen, sondern aus dem aktuellen Park
  (`financeCostBreakdown`): Gebäude-/Bühnen-/Attraktionsunterhalt,
  Müllwagen, Notstrom, Löhne nach Rolle, Träger, offenes Darlehen und
  gebuchte Gagen. Die Tagesbeträge von Betrieb, Personal und Zinsen
  entsprechen der Spalte **Prognose morgen**. Die Simulation bucht weiter
  nur Kategoriesummen.
- Anzeige (`src/ui/financePanel.ts`): Beträge über `formatMoney` mit eigenem
  Vorzeichen (`−1.234 €` / `−€1,234`), Kategorien über
  `localize(name, 'finance')` (Homonym `Gelände`), Abschnitte und Hinweise über
  `localize`, Posten über `localizeName` mit `localize` als Rückfall (die Zeile zum
  offenen Darlehen ist ein Satz mit Zahl).

## Tests

`tests/finance.ts` prüft Kategorien, Ausgabenwechsel, Tagesabschluss,
Prognose, Kreditrahmen, Zinsen, Snapshot-Defaults und die aufklappbare
Aufschlüsselung (gruppierte Stände, Personal, Zinsen, Gagen, Ledger-HTML).
`tests/courseAttractions.ts` und `tests/finance.ts` sichern den
Leerlauf-Unterhalt (aktiv vs. inaktiv, Beträge ≤ 10 % der Volllast)
sowie null Technikunterhalt für nicht live laufende Festivalbühnen.
Gesamtlauf: `npm test`.

## Bei Änderungen dieses Dokuments

Aktualisieren, wenn Kategorien, Ledger-Zuordnung, Prognose, Kreditregeln,
Snapshot-Struktur oder Finanz-UI geändert werden.

## Sponsoren und Schwierigkeit (0.2.11)

Neue Kategorie `sponsors` („Sponsoren“): Vorschüsse beim Unterschreiben, Boni
oder Rückzahlungen am Ende der Ausgabe (vor `finished`, damit sie in der Spalte
dieser Ausgabe landen), siehe [festival.md](festival.md). Die Schwierigkeit
skaliert Betriebskosten und Personal (`difficultyProfile().runningCosts`) in
`GameState.hourlyRunningCosts` und in der Aufschlüsselung gleich.
