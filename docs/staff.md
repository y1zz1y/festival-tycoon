# Personal, Zonen, Sanität und Security

Rollen: Reinigung, Sicherheit, Feuerwehr, Sanitäter. Zusätzlich gibt es
automatische Träger im Logistiksystem (keine `StaffRole`). Saugroboter
(`sweeper`) bleiben Logistikfahrzeuge, erscheinen in der Personalverwaltung
aber als Reinigungskraft und teilen dieselben 3×3-Einsatzgebiete. Arbeitsbereiche
begrenzen Abhol-/Einsatzorte; Entsorgungs- und Rettungswege dürfen hinaus.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Rollen, Definitionen, Lohn | `src/game/staff.ts` | `STAFF_ROLES`, `STAFF_DEFINITIONS` |
| Tick-Verhalten | `src/game/staffSimulation.ts` | `StaffSimulation` |
| Einstellen / entlassen / platzieren | `src/game/GameState.ts` | `hireStaff`, `fireStaff`, `placeStaffAt` |
| Arbeitszonen | `src/game/staffZones.ts` | `isInAnyZone`, `zoneCellRange`, `toggleAssignedWorkZones` |
| Saugroboter in der Personal-UI | `src/game/staff.ts`, `src/staffDetailsUI.ts`, `src/main.ts` | `sweeperStaffName`, Reinigungs-Tab |
| Krankenfelder, Betten | `src/game/medical.ts` | `MedicalSystem`, `MEDICAL_BEDS_PER_CELL` |
| Personaleingang | `src/game/supplyChain.ts`, `src/game/accessControl.ts` | `staffGate`, `staffGateWorldPosition`, `gateEdgeWorldPosition` |
| Sicherheitsschleusen | `src/game/security.ts` | `SecuritySystem`, `SecurityGateConfig` |
| Müllziele für Reinigung | `src/game/waste.ts` | nächster Eimer / Ablage |
| Personal-UI | `src/staffDetailsUI.ts` | Infofenster, Bereich zuweisen |
| Darstellung | `src/view/StaffView.ts`, `src/view/MedicalView.ts` | Uniformen, Liegen |
| Depot-Träger (keine Rolle) | `src/view/carrierModels.ts`, `src/view/SupplyChainView.ts` | Gästefigur + Warnweste/Mütze + Handkarren |
| Balancing | `src/game/simulationConfig.ts` | `staff`, `medical`, `security` |

## Wichtige Regeln

- Sanitäter wählen das über die **Wegstrecke** nächstgelegene freie Bett,
  nicht das euklidisch nächste.
- Indizes für Incidents, Betten und Müll einmal pro Pass, nicht per Staff
  die ganze Welt scannen.
- Personaltore: `staffGate` in `supplyChain.ts` / Festival-Actions; Werkzeug
  im Baumenü unter Logistik. Neue Tore nutzen `staffGateDirection` und
  dieselbe Kantenlage wie Personentore (`gateEdgeWorldPosition` in
  `accessControl.ts`); fehlende Richtung in alten Saves bleibt mittig.
  Krankenwagengarage und Krankenbereich liegen dort im Tab **Krankenhaus**.
  Saugroboter nutzen dieselben `staffOnly`-Kacheln wie Personal
  (`findSweeperRoute` mit `allowStaff`); Gäste bleiben ausgesperrt.
- Staff teilt Pixel-Personen-Teile; keine eigenen Meshes pro Figur.
- Automatische Träger nutzen dieselben Körperteile wie Gäste, plus eine
  geteilte Warnwesten-/Mützen-Geometrie und einen gemergten Handkarren.
  Die gelbe Weste und der Karren bleiben das Erkennungsmerkmal in der Menge.
- Neue Rolle: `staff.ts`, Config, `StaffSimulation`, Hire-UI, View, Commands
  und Snapshot.
- Saugroboter nutzen `RoadVehicle.workZones` (fehlend = gesamtes Gelände)
  und dieselben Befehle `toggleStaffZone` / `fireStaffMember` wie Personal.
  Volle Maschinen dürfen weiter zur Müllablage und zum Betriebshof
  außerhalb der Zone fahren.

## Tests

`tests/operations.ts` (Personaltor-Zugang und Kantenlage, Saugroboter durch
Personaleingang, Gäste nicht), `tests/accessControl.ts`
(`gateEdgeWorldPosition`), `tests/festivalAdditions.ts`,
`tests/performanceGuards.ts` (keine nested Scans). Personalwege hängen an
denselben Nav-Invarianten wie `docs/pathfinding.md`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Rollen, Zonenregeln, Bettwahl, Gate-Verhalten,
Träger-als-Personal-Zuweisung oder Saugroboter-Einsatzgebiete ändern.
Müll-/Brand-Ziele zusätzlich in `docs/incidents.md`.
