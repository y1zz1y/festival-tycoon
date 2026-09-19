# Finanzen

Jeder Geldfluss wird im Ledger gebucht. Eine Spalte entspricht einer
Festival-Ausgabe; Prognosen kombinieren wiederkehrende Einnahmen des letzten
vollen Tages mit den aktuell berechenbaren Fixkosten.

## Wo finden

| Aufgabe | Vollständiger Pfad | Einstieg / Symbol |
| --- | --- | --- |
| Ledger, Kategorien, Prognose | `src/game/finance.ts` | `bookFinance`, `financeEdition`, `financeForecast` |
| Darlehensregeln | `src/game/finance.ts` | `LOAN`, `loanLimit`, `loanInterest` |
| Zustands-API und laufende Kosten | `src/game/GameState.ts` | `GameState.financeOverview`, `GameState.manageLoan`, `GameState.financeForecast` |
| Pausen-/Bühnen-/Kurs-Unterhalt | `src/game/upkeep.ts` | `buildingHourlyUpkeep`, `coasterHourlyUpkeep`, `courseHourlyUpkeep` |
| Finanzfenster | `src/main.ts` | `updateFinancePanel`, `openFinancePanel` |
| Szenario-Finanzziele | `src/game/scenarioGoals.ts` | `updateScenarioProgress` |
| Regressionen | `tests/finance.ts` | `testFinance` |

## Wichtige Invarianten

- Geldänderungen laufen über `bookFinance`; Darlehensauszahlung und Tilgung
  ändern Bargeld und Schuld, sind aber weder Einnahme noch Ausgabe.
- Buchungen werden auf Cent gerundet und auf acht Festival-Ausgaben begrenzt.
- Zinsen und laufende Kosten werden aus Simulationszeit berechnet.
  Buden und Attraktionen zahlen in der Tagesplan-**Pause** nur
  `economy.pauseUpkeepMultiplier` (15 %). Festivalbühnen ohne laufendes
  Festival senken den Gebäudeunterhalt und setzen Technik auf 0. Coaster-
  und Kursstücke haben eigenen Stückunterhalt, ebenfalls pausenreduziert.
  Maßgeblich ist `getFestivalCycleStatus`, nicht `speed === 0`.
- `GameSnapshot.finance` bleibt save- und multiplayer-kompatibel; alte Stände
  ohne gültige Perioden erhalten `createFinanceState()`.

## Tests

`tests/finance.ts` prüft Kategorien, Ausgabenwechsel, Tagesabschluss,
Prognose, Kreditrahmen, Zinsen und Snapshot-Defaults. Gesamtlauf: `npm test`.

## Bei Änderungen dieses Dokuments

Aktualisieren, wenn Kategorien, Ledger-Zuordnung, Prognose, Kreditregeln,
Snapshot-Struktur oder Finanz-UI geändert werden.
