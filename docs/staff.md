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
| Krankenfelder, Betten | `src/game/medical.ts`, `src/game/GameState.ts` | `MedicalSystem`, `normalizeMedicalCell`, `allowsMedicalOverlay`, `MEDICAL_BEDS_PER_CELL`; Abriss über `clearDesignatedOccupancyAt` |
| Verletzten-Zuweisung | `src/game/staffSimulation.ts`, `src/game/GameState.ts` | `assignNearestFreeMedics`; Krankenwagen `dispatchIdleAmbulances` |
| Krankenwagen-Rückfahrt / Verkauf | `src/game/GameState.ts` | `returnIdleAmbulancesToGarage`, `sellAmbulance`, `sellAmbulanceVehicle`; `RoadVehicle.pendingSale` |
| Personaleingang | `src/game/supplyChain.ts`, `src/game/accessControl.ts` | `staffGate`, `staffGateWorldPosition`, `gateEdgeWorldPosition`, `staffGateBlocksVisitor` |
| Sicherheitsschleusen | `src/game/security.ts` | `SecuritySystem`, `SecurityGateConfig` |
| Müllziele für Reinigung | `src/game/waste.ts` | nächster Eimer / versiegelter Container / Ablage; `wasteDropGoals` |
| Personal-UI | `src/staffDetailsUI.ts` | Infofenster, Bereich zuweisen |
| Darstellung | `src/view/StaffView.ts`, `src/view/MedicalView.ts` | Uniformen, Liegen |
| Depot-Träger (keine Rolle) | `src/view/carrierModels.ts`, `src/view/SupplyChainView.ts` | Gästefigur + Warnweste/Mütze + Handkarren |
| Balancing | `src/game/simulationConfig.ts` | `staff` (`roles.cleaner.speed`, `cleanerWorkMinutes`, `cleanerLitterWorkMinutes`, `cleanerBinWorkMinutes`), `medical`, `security`, `waste.cleanerIdleEmptyFill`, `waste.cleanerCarrySpeedMultiplier` |

## Wichtige Regeln

- Junior-Bands und Bands ohne Tourbus-Platz kommen über den Personaleingang
  (`staffGate` / `allowStaff`); siehe [`band-supply.md`](band-supply.md).
  Security reduziert das Fan-Leck auf dem Backstage in v1 nicht.
- Personalpatrouillen bleiben auf dem Fußwegenetz. Nur Personal, das auf
  offenem Boden startet und keinen Wegnachbarn erreicht, darf über Boden
  zum Netz zurückfinden; ein Wegende öffnet keinen Abstecher ins Gras.
- Ist jemand verletzt (oder bewusstlos / stark übel), bekommt er den
  **nächsten freien** Sanitäter: idle, ohne Patient, nicht tragend.
  Beschäftigte Sanitäter bleiben bei ihrem Fall. Unter den Freien
  entscheidet Manhattan-Nähe, danach **eine** Wegsuche; wer den Patienten
  nicht erreichen kann (Zaun, fehlender Weg), wird übersprungen.
  Dasselbe gilt für den nächsten freien Krankenwagen
  (`dispatchIdleAmbulances` in `GameState.ts`).
  Ein idle Krankenwagen ohne Patient fährt über `findRoadRoute` /
  `routePreferringOpenLights` zur Garage (`returnIdleAmbulancesToGarage`)
  und bleibt nicht auf der Straße stehen. Verkauf (`sellAmbulance` /
  `sellAmbulanceVehicle`) löscht ihn sofort, wenn er idle an der Garage
  steht; unterwegs oder im Einsatz wird der aktuelle Auftrag abgebrochen
  (ohne Patient) bzw. zu Ende gefahren (mit Patient), dann gilt
  `pendingSale` bis zur Ankunft. Kein unsterbliches Fahrzeug auf der Straße.
  Wer noch in einem Fahrzeug sitzt (`passengerIds`, `vehicle-arrival`,
  `bus-riding`), ist kein Patient auf der Straße.
- Sanitäter wählen das über die **Wegstrecke** nächstgelegene freie Bett,
  nicht das euklidisch nächste.
- Abriss eines Krankenfelds entfernt die Liegen, gibt Bettreservierungen
  frei und macht die Kachel wieder bebaubar. Verwaiste Insassen-IDs aus
  alten Saves werden beim Laden geleert; leere Restfelder bleiben liegen
  und dürfen nur per Abriss entfernt werden, nicht durch Überbauen.
  Dächer, Wände und Bauzäune stapeln auf derselben Kachel
  (`allowsMedicalOverlay`) und löschen das Krankenfeld nicht. Solide
  Gebäude und Wege auf der Kachel lehnt `canPlace` ab. Navigation wird
  beim Abriss sofort ungültig.
- Reinigungskräfte gehen mit `staff.roles.cleaner.speed` 0.334
  (15 % schneller als 0.29). Geladene Wege bleiben
  `waste.cleanerCarrySpeedMultiplier` 0.62 auf dieser Basis, also
  ebenfalls 15 % schneller. Arbeit etwas kürzer: `cleanerWorkMinutes` 9
  (Kotze/verlassene Camps, vorher 10), `cleanerLitterWorkMinutes` 3.5
  (Bodenmüll, vorher 4), `cleanerBinWorkMinutes` 5.5 (Eimer und
  versiegelte Container, vorher 6).
- Priorität bleibt, aber ein höherer Job jenseits
  `staff.cleanerLocalWorkTiles` weicht lokaler Arbeit im nahen Umfeld.
  Feuerwehrwagen fahren große Brände an; Fuß-Feuerwehr löscht vor Ort.
- Reinigungskräfte leeren Eimer in dieser Reihenfolge: volle Eimer
  (Füllstand ≥ `waste.binCapacity`) vor Bodenmüll, Kotze und verlassenen
  Camps; erst wenn nichts davon anliegt, leeren sie teilweise gefüllte
  Eimer ab `waste.cleanerIdleEmptyFill` (3 von 12, 25 %). Danach, nur
  wenn sonst keine Arbeit da ist, tragen sie versiegelte Container zur
  Ablage, sofern `stored > 0` und kein erreichbarer Müllwagen bereits
  unterwegs ist (`truckEnRoute` plus Straße). `truckReachable` allein
  darf die manuelle Leerung nicht aussetzen. Das stiehlt keine eilige
  Arbeit. Nach dem Entleeren eines Containers geht die Ladung nur zur
  Ablage, nicht in einen anderen Container.
  Geladene Beutel (nach Eimer-Leeren) gehen per einer Multi-Goal-Suche
  zum näheren Ziel unter Containern mit Platz und Ablagen mit Platz.
  Saugroboter leeren keine Eimer und keine Container. Zugewiesene
  Einsatzgebiete gelten weiter.
- Indizes für Incidents, Betten und Müll einmal pro Pass, nicht per Staff
  die ganze Welt scannen.
- Personaltore: `staffGate` in `supplyChain.ts` / Festival-Actions; Werkzeug
  im Baumenü unter Logistik. Neue Tore nutzen `staffGateDirection` (0–3,
  Ausgangskante der Baurichtung) und dieselbe Kantenlage wie Personentore
  (`gateEdgeWorldPosition` in `accessControl.ts`). Die Kachel bleibt
  begehbar: Gäste dürfen sie und die anderen Kanten nutzen, nicht aber die
  bemalte Richtung (`staffGateBlocksVisitor`). Personal, Bands über
  Personaleingang und Saugroboter (`allowStaff`) gehen in beide Richtungen
  durch. `place` / Entfernen erhöht `worldRevision`. Fehlende Richtung in
  alten Saves bleibt mittig und sperrt Gäste weiter von der ganzen Kachel.
  Krankenwagengarage und Krankenbereich liegen dort im Tab **Krankenhaus**.
  Saugroboter nutzen dieselben `staffOnly`-Kacheln wie Personal
  (`findSweeperRoute` mit `allowStaff`).
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
Saugroboter dieselbe Farbe), `tests/operations.ts` (Personaltor-Kante statt Vollfeld, bemalte Richtung für
Gäste gesperrt, Staff und Saugroboter durch, Legacy-Mitte; Reinigung leert volle Eimer vor halbvollen und
Bodenmüll, idle leert halbvolle Eimer in der Zone, Bodenmüll vor kaum
genutzten Eimern; Krankenfeld-Abriss, Dach über Liegen, abgewiesenes
Überbauen und Restbelegung; Verletzte an den
nächsten freien Sanitäter bzw. Krankenwagen — näherer Idle vor fernem,
kein Diebstahl eines tragenden Sanitäters, unerreichbarer Näherer wird
übersprungen, Insassen im Auto werden nicht als Verletzte zugewiesen,
idle Krankenwagen fährt zur Garage, Verkauf löscht am Depot sofort und
nach Rückfahrt), `tests/sealedWasteContainer.ts` (nähere Container vor Ablage, volle übersprungen, idle Container→Ablage auch ohne Wagen, voller Eimer zuerst, Müllwagen vom Depot leert Straßen-Container), `tests/accessControl.ts` (`gateEdgeWorldPosition`, `staffGateBlocksVisitor`),
`tests/festivalAdditions.ts`, `tests/performanceGuards.ts` (keine nested
Scans). Personalwege hängen an denselben Nav-Invarianten wie
`docs/pathfinding.md`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Rollen, Zonenregeln, Bettwahl, Verletzten-Zuweisung
(nächster freier Sanitäter / Krankenwagen), Krankenwagen-Rückfahrt oder
Verkauf, Gate-Verhalten, Krankenfeld-Platzierung (Dach-Overlay vs. Abriss),
Träger-als-Personal-Zuweisung, Saugroboter-Einsatzgebiete,
Reinigungs-Tempo (`roles.cleaner.speed`, Work-Minutes, Carry-Multiplier)
oder Eimer-Leer-Priorität der Reinigung oder Container-Schlepp-Priorität
ändern. Müll-/Brand-Ziele zusätzlich in `docs/incidents.md`.
