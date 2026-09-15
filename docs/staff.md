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
| Arbeitszonen | `src/game/staffZones.ts` | `isInAnyZone`, `zoneCellRange`, `setAssignedWorkZones`, `staffZonePaintStroke` |
| Saugroboter in der Personal-UI | `src/game/staff.ts`, `src/staffDetailsUI.ts`, `src/main.ts` | `sweeperStaffName`, Reinigungs-Tab |
| Krankenfelder, Betten | `src/game/medical.ts`, `src/game/GameState.ts` | `MedicalSystem`, `normalizeMedicalCell`, `MEDICAL_BEDS_PER_CELL`; Abriss über `clearDesignatedOccupancyAt` |
| Verletzten-Zuweisung | `src/game/staffSimulation.ts`, `src/game/GameState.ts` | `assignNearestFreeMedics`; Krankenwagen `dispatchIdleAmbulances` |
| Personaleingang | `src/game/supplyChain.ts`, `src/game/accessControl.ts` | `staffGate`, `staffGateWorldPosition`, `gateEdgeWorldPosition` |
| Sicherheitsschleusen | `src/game/security.ts` | `SecuritySystem`, `SecurityGateConfig` |
| Müllziele für Reinigung | `src/game/waste.ts` | nächster Eimer / Ablage |
| Personal-UI | `src/staffDetailsUI.ts` | Infofenster, Bereich zuweisen |
| Darstellung | `src/view/StaffView.ts`, `src/view/MedicalView.ts` | Uniformen, Liegen |
| Depot-Träger (keine Rolle) | `src/view/carrierModels.ts`, `src/view/SupplyChainView.ts` | Gästefigur + Warnweste/Mütze + Handkarren |
| Balancing | `src/game/simulationConfig.ts` | `staff`, `medical`, `security`, `waste.cleanerIdleEmptyFill` |

## Wichtige Regeln

- Ist jemand verletzt (oder bewusstlos / stark übel), bekommt er den
  **nächsten freien** Sanitäter: idle, ohne Patient, nicht tragend.
  Beschäftigte Sanitäter bleiben bei ihrem Fall. Unter den Freien
  entscheidet Manhattan-Nähe, danach **eine** Wegsuche; wer den Patienten
  nicht erreichen kann (Zaun, fehlender Weg), wird übersprungen.
  Dasselbe gilt für den nächsten freien Krankenwagen
  (`dispatchIdleAmbulances` in `GameState.ts`).
  Wer noch in einem Fahrzeug sitzt (`passengerIds`, `vehicle-arrival`,
  `bus-riding`), ist kein Patient auf der Straße.
- Sanitäter wählen das über die **Wegstrecke** nächstgelegene freie Bett,
  nicht das euklidisch nächste.
- Abriss eines Krankenfelds entfernt die Liegen, gibt Bettreservierungen
  frei und macht die Kachel wieder bebaubar. Verwaiste Insassen-IDs aus
  alten Saves werden beim Laden geleert; leere Restfelder dürfen
  abgerissen oder überbaut werden. Navigation wird sofort ungültig.
- Reinigungskräfte leeren Eimer in dieser Reihenfolge: volle Eimer
  (Füllstand ≥ `waste.binCapacity`) vor Bodenmüll, Kotze und verlassenen
  Camps; erst wenn nichts davon anliegt, leeren sie teilweise gefüllte
  Eimer ab `waste.cleanerIdleEmptyFill` (3 von 12, 25 %). Saugroboter
  leeren keine Eimer. Zugewiesene Einsatzgebiete gelten weiter.
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
  und dieselben Befehle `toggleStaffZone` / `setStaffZone` / `fireStaffMember`
  wie Personal. Volle Maschinen dürfen weiter zur Müllablage und zum
  Betriebshof außerhalb der Zone fahren.
- Einsatzgebiete sind das feste 3×3-Raster (`zoneKey`). **Bereiche verwalten**
  malt per Klick oder Ziehen ganze 3×3-Blöcke: der erste Block unter dem
  Druck sperrt den Strich auf Zuweisen oder Entfernen (`setStaffZone`,
  nicht Toggle). Derselbe 3×3-Schlüssel wird nicht erneut gekippt, wenn
  der Zeiger in der Kachel zittert. Zusammenhängend bleibt Pflicht.

## Tests

`tests/staffZones.ts` (Ziehen über zwei 3×3 weist beide zu; Start auf einem
aktiven Block entfernt entlang des Strichs; `setStaffZone` ist idempotent;
Saugroboter dieselbe Farbe), `tests/operations.ts` (Personaltor-Zugang und Kantenlage, Saugroboter durch
Personaleingang, Gäste nicht; Reinigung leert volle Eimer vor halbvollen und
Bodenmüll, idle leert halbvolle Eimer in der Zone, Bodenmüll vor kaum
genutzten Eimern; Krankenfeld-Abriss und Restbelegung; Verletzte an den
nächsten freien Sanitäter bzw. Krankenwagen — näherer Idle vor fernem,
kein Diebstahl eines tragenden Sanitäters, unerreichbarer Näherer wird
übersprungen, Insassen im Auto werden nicht als Verletzte zugewiesen), `tests/accessControl.ts` (`gateEdgeWorldPosition`),
`tests/festivalAdditions.ts`, `tests/performanceGuards.ts` (keine nested
Scans). Personalwege hängen an denselben Nav-Invarianten wie
`docs/pathfinding.md`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Rollen, Zonenregeln, Bettwahl, Verletzten-Zuweisung
(nächster freier Sanitäter / Krankenwagen), Gate-Verhalten,
Träger-als-Personal-Zuweisung, Saugroboter-Einsatzgebiete oder
Eimer-Leer-Priorität der Reinigung ändern.
Müll-/Brand-Ziele zusätzlich in `docs/incidents.md`.
