# Personal, Zonen, Sanität und Security

Rollen: Reinigung, Sicherheit, Feuerwehr, Sanitäter. Zusätzlich gibt es
automatische Träger im Logistiksystem (keine `StaffRole`). Arbeitsbereiche
begrenzen Abhol-/Einsatzorte; Entsorgungs- und Rettungswege dürfen hinaus.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Rollen, Definitionen, Lohn | `src/game/staff.ts` | `STAFF_ROLES`, `STAFF_DEFINITIONS` |
| Tick-Verhalten | `src/game/staffSimulation.ts` | `StaffSimulation` |
| Einstellen / entlassen / platzieren | `src/game/GameState.ts` | `hireStaff`, `fireStaff`, `placeStaffAt` |
| Arbeitszonen | `src/game/staffZones.ts` | `isInAnyZone`, `zoneCellRange` |
| Krankenfelder, Betten | `src/game/medical.ts` | `MedicalSystem`, `MEDICAL_BEDS_PER_CELL` |
| Sicherheitsschleusen | `src/game/security.ts` | `SecuritySystem`, `SecurityGateConfig` |
| Müllziele für Reinigung | `src/game/waste.ts` | nächster Eimer / Ablage |
| Personal-UI | `src/staffDetailsUI.ts` | Infofenster, Bereich zuweisen |
| Darstellung | `src/view/StaffView.ts`, `src/view/MedicalView.ts` | Uniformen, Liegen |
| Balancing | `src/game/simulationConfig.ts` | `staff`, `medical`, `security` |

## Wichtige Regeln

- Sanitäter wählen das über die **Wegstrecke** nächstgelegene freie Bett,
  nicht das euklidisch nächste.
- Indizes für Incidents, Betten und Müll einmal pro Pass, nicht per Staff
  die ganze Welt scannen.
- Personaltore: `staffGate` in `supplyChain.ts` / Festival-Actions; Werkzeug
  im Baumenü unter Logistik. Krankenwagengarage und Krankenbereich liegen
  dort im Tab **Krankenhaus**.
- Staff teilt Pixel-Personen-Teile; keine eigenen Meshes pro Figur.
- Neue Rolle: `staff.ts`, Config, `StaffSimulation`, Hire-UI, View, Commands
  und Snapshot.

## Tests

`tests/operations.ts`, `tests/festivalAdditions.ts`,
`tests/performanceGuards.ts` (keine nested Scans). Personalwege hängen an
denselben Nav-Invarianten wie `docs/pathfinding.md`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Rollen, Zonenregeln, Bettwahl, Gate-Verhalten oder
Träger-als-Personal-Zuweisung ändern. Müll-/Brand-Ziele zusätzlich in
`docs/incidents.md`.
