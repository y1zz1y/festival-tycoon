# Müll, Vorfälle, Feuerwerk und Panik

Bodenvorfälle (`vomit`, `fire`, `litter`) und Müllablagen sind Simulationszustand.
Feuerwerk existiert als Inventar-Zündung (Besucher) und als Bühneneffekt.
Panik-Schwellen kommen aus Besucherblasen und Crowding, nicht aus der View.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Übelkeit, Incident-Spawn | `src/game/incidents.ts` | `IncidentSystem`, `GroundIncident` |
| Müllablagen, Eimer, versiegelte Container | `src/game/waste.ts` | `WasteDumpCell`, `SealedWasteContainerInfo`, `findNearestWasteBin`, `findNearestWasteBinInRange`, `wasteBinHasRoom`, `connectedWasteDumpStats`, `acceptWasteAtDump`, `acceptWasteAtSealedContainer`, `sealedContainerAllowsManualHaul`, `wasteDropGoals`, `parkWasteDumpFill` |
| Meldungs-Ticker | `src/game/ticker.ts`, `src/tickerUI.ts` | `observeTickerEvents`, `mountTickerUI` |
| Debug-Räumung | `src/game/GameState.ts` | `clearWasteForDebug` |
| Feuerwerk (Sim) | `src/game/fireworks.ts` | `FireworksSystem` |
| Blasen / Panik-Chancen | `src/game/visitorBubbles.ts` | `spontaneousPanicChance`, `panicSpreadChance` |
| Crowding | `src/game/crowding.ts` | Dichte für Panik und Tempo |
| Personal-Reaktion | `src/game/staffSimulation.ts` | Cleaner, Firefighter; Verletzte: nächster freier Sanitäter (`assignNearestFreeMedics`) |
| Krankenwagen bei Verletzung | `src/game/GameState.ts` | `dispatchIdleAmbulances` — nächster freier Wagen, nicht der erste in der Liste |
| Views | `src/view/IncidentView.ts`, `src/view/WasteView.ts`, `src/view/FireworksView.ts`, `src/view/PanicView.ts` | nur Darstellung; Eimer-Füllstand als grobe Kartonzahl um den Eimer |
| Balancing | `src/game/simulationConfig.ts` | `incidents`, `nausea`, `waste` (carry/idle thresholds), `fireworks`; Reinigungs-Tempo in `staff.roles.cleaner.speed`, `staff.cleanerWorkMinutes`, `staff.cleanerLitterWorkMinutes`, `staff.cleanerBinWorkMinutes` |

## Wichtige Regeln

- Incidents nicht über die Karte ausbreiten, sofern nicht ausdrücklich
  implementiert (Feuer bleibt lokal).
- Saugreiniger räumen `litter` und `vomit` auf Wegen und Bühnenvorplätzen;
  sie fahren auf den Vorplatz, statt am Wegrand zu halten, und dürfen
  Personaleingänge wie Personal queren, um Schmutz, Ablage oder Depot zu
  erreichen. Zugewiesene Einsatzgebiete (`workZones`) begrenzen Suche und
  Aufnahme wie bei Reinigungskräften; Entladen an der Ablage bleibt
  außerhalb erlaubt.
  Personal-Cleaner bleiben der Fußweg-Fallback; Geh- und Arbeitszeiten
  stehen unter `staff` (`roles.cleaner.speed` 0.334, +15 % zu 0.29;
  Litter 3.5 / Eimer 5.5 / sonst 9 Minuten). Volle Eimer
  (`stored >= waste.binCapacity`) haben Vorrang vor Litter, Kotze und
  Camp-Resten; ohne solche Arbeit leeren sie Eimer ab
  `waste.cleanerIdleEmptyFill` (3, ein Viertel der 12er-Kapazität), statt
  untätig zu patrouillieren. Unter der Schwelle bleiben Eimer stehen.
  Saugroboter leeren keine Eimer.
- Debug-Cleanup: ein Owner-Index, aktive Camp-Objekte und Feuer erhalten.
- Views speichern keine Simulationsentscheidungen (kein Panik-Flag nur im Mesh).
- `IncidentView` zeichnet alle Müllstücke in einem Instanz-Batch, alle
  Erbrochenen-Flecken in einem weiteren und Feuer in zwei Kegel-Batches.
  Stückzahl, Form, Farbe, Position und Feueranimation bleiben vollständig erhalten.
  Statische Instanzen werden nur bei sichtbaren Änderungen aktualisiert; Geometrie,
  Material und GPU-Kapazität bleiben erhalten. `instanceId` wird über
  `userData.incidentIds` der Vorfall-ID zugeordnet. Wachstum ersetzt nur Instanzpuffer;
  `invalidate()` gibt die eigenen Ressourcen frei.
- Müllwegentscheidungen aus direkten Interaktions-/Abbau-Callbacks teilen das
  Besucherbudget. Bis zur Bearbeitung bleibt `pendingWaste` erhalten; bereits
  laufende Wege zum Eimer werden nicht bei jeder Abreiseprüfung neu gesucht.
  Ist der nächste Eimer in `waste.binRange` voll (`visitorDropIfBinFull`)
  oder ein versiegelter Container im 7×7-Umfeld voll,
  oder gibt es keinen begehbaren Eimer mit Platz, wird der Müll lokal als
  `litter` fallen gelassen; Gäste warten nicht auf einen vollen Eimer und
  suchen keinen weiter entfernten. Eimer mit Platz werden weiter benutzt.
  Die Eimerliste wird einmal pro Tick gebaut, nicht je Besucher über alle
  Gebäude.
- Mülleimer zeigen `wasteFill` nur über grob gestufte Kartons am Boden
  (0 / 1 / 2 / 3 / 4 bei 0, 1–3, 4–6, 7–9, 10–12). Kein Balken.
  `WasteView` batched Tiles, Ablage-Säcke und Kartons.
- Ein Klick auf eine Müllablage öffnet das Infofenster für die
  **zusammenhängende Fläche** (4-Wege-Flood-Fill gleicher Ablagekacheln).
  Anzeige: gelagert / Kapazität (`dumpCapacity` 180 je Feld), frei und
  Auslastung in Prozent. Hover zeigt dieselbe Summe. Simulation bleibt
  per Kachel (`stored`); die UI addiert nur die Komponente.
  Ablagen lassen sich nicht überfüllen: `acceptWasteAtDump` nimmt nur
  den freien Rest an; Reinigung, Saugroboter und Träger behalten den
  Überhang. Alte Saves mit höherem `stored` werden auf die Kappe geklemmt.
  Müllwagen fassen `garbageTruckCapacity` 90.
- Versiegelte Müllcontainer (`sealedWasteContainer`) fassen
  `waste.sealedContainerCapacity` 80 Beutel. Reinigung bringt geladene
  Beutel dorthin, wenn der Container näher und nicht voll ist; sonst zur
  Ablage. Attraktivität: `atmosphere.sources.sealedWasteContainer`
  (beauty −8, party −2, range 3) plus
  `waste.sealedContainerStoredBeautyPerBag` (−0,22 je Beutel) statt
  offener Ablage (`wasteDump` −48 / −1,4 je Beutel). Müllwagen leeren
  den Container nur, wenn er **auf einer Straße** liegt und eine
  Nachbarstraße vom Müllnetz erreichbar ist; der Wagen hält neben der
  Kiste, nicht auf derselben Kachel. Gefüllte Straßenkisten haben Vorrang
  vor offenen Ablagen, damit eine Depot-Kippzufahrt den Wagen nicht
  dauerhaft von den Containern fernhält. Idle Reinigung (niedrigste Priorität nach
  vollen Eimern, Litter/Kotze/Camps und idle Eimer-Leeren) trägt zur
  Ablage, sobald `stored > 0` und kein Müllwagen **unterwegs** ist.
  `truckReachable` allein reicht nicht zum Überspringen: ohne Wagen
  (oder wenn der Wagen die Kiste nicht erreichen kann) muss per Hand
  geleert werden. Platzierung auf der Straße ist optional.
- Neue Verletzte bekommen den nächsten freien Sanitäter oder Krankenwagen
  (Manhattan, dann eine Wegsuche). Details und Tests: `docs/staff.md`.
  Insassen in `passengerIds` (noch nicht ausgestiegen) sind keine
  Verletzten auf der Straße: kein Ticker, kein Sanitäter, kein
  Verkehrs-Blocker. Eine im Fahrzeug gemerkte Verletzung gilt erst auf
  dem Fußweg nach dem Aussteigen.
- Der Ticker (`src/game/ticker.ts`) leitet Meldungen aus dem Snapshot ab
  (kein neues Protokollfeld): Feuer, Panik/Massenpanik, Müllflächen über
  `waste.dumpFullRatio` (90 % der **gesamten** Ablagekapazität) und neue
  Verletzte. Wiederholungen nur beim Schwellenwechsel bzw. nach
  `ticker.dumpFullRepeatMinutes` / `ticker.incidentRepeatMinutes`.
  Die Leiste sitzt unten; bei Position gibt es **Hin**. Verlauf über
  **Meldungen** links neben Mehrspieler. Nur UI-Zustand, keine Sim-Mutation.
- Personentore mit `openInEmergency` (Default an) gehen bei Panik oder
  Feuer auf, auch aus „Immer zu“, und lassen beide Richtungen frei.
  Die Notlage wird im selben Index-Pass wie die Gebietszähler erkannt,
  nicht in einer extra Besucherschleife.
- Neue Incident-Arten brauchen Snapshot, Staff-Reaktion, View-Batch und Tests.

## Tests

`tests/performanceGuards.ts` (Debug-Cleanup). `tests/operations.ts`
(Eimer-Priorität: voll vor halbvoll/Litter, idle leert halbvolle Eimer,
Litter vor kaum gefüllten Eimern; voller Nachbar-Eimer: Gäste lassen
Müll fallen statt stehen zu bleiben, leerer Eimer wird benutzt;
Verletzte an den nächsten freien
Sanitäter bzw. Krankenwagen).
Festival-Zusätze: `tests/festivalAdditions.ts` (Eimer-Kartonzahl und
Batch-Grenze, zusammenhängende Ablage-Füllstände, Müllwagen-Ladung
statt Insassen).
`tests/ticker.ts` (Müllwagen 90, Ablage 180, kein Overflow, Ticker bei
>90 % aller Ablagen, Feuer/Panik mit Sprungziel, keine Meldung für
verletzte Insassen noch im Fahrzeug).
`tests/sealedWasteContainer.ts` (Kapazität 80, nähere Container vor
Ablage, volle Container übersprungen, versiegelte Attraktivitätsstrafe
schwächer als offene Ablage, Müllwagen vom Depot zielt Straßen-Container
auch bei Ablage an der Depotzufahrt und senkt `stored` nach der Tour, off-road nicht, idle Reinigung trägt
Container→Ablage auch wenn die Straße erreichbar ist aber kein Wagen
kommt, voller Eimer bleibt vorrangig, Live-Tick leert off-road und
liefert an die Ablage).

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Incident-Arten, Müllkapazitäten, Ticker-Regeln, Eimer-Darstellung,
Reinigungs-Eimer-Priorität, Reinigungs-Tempo (`staff.roles.cleaner.speed` und
Work-Minutes), Gäste-Müll-bei-vollem-Eimer, Verletzten-Zuweisung, Panikformeln oder Pyro-Trigger ändern.
Bühnen-Pyro zusätzlich in `docs/stages.md`. Sanitäter/Krankenwagen in `docs/staff.md`.

## Themen-Mülleimer (0.1.126)

`decorationWalls.ts:isWasteBin` fasst Klassik und zehn Themen-Eimer zusammen.
Normalisierung, Gästesuche/-entsorgung, Reinigung/Träger und Inspektion nutzen
sämtliche Varianten mit derselben Kapazität und `wasteFill`. Menü: Deko/Möbel.
Die sichtbaren Füllkartons folgen der automatischen Wegkanten-Drehung.

## Versiegelte Müllcontainer

Gebäude-`kind` `sealedWasteContainer` im Logistik-Tab **Müll**. Ein
gemergtes Container-Mesh, kein Draw-Call je Beutel. `wasteFill` wie bei
Eimern, geklemmt auf 80. Infofenster zeigt Füllstand und ob ein Müllwagen
abfahren kann. Kein neues `GameCommand`; bestehendes `place` reicht.
Fahrzeugziel `sealedWasteContainer` (`buildingId`, x, z) in
`docs/multiplayer.md` / `docs/saves.md`. Der Wagen hält auf einer
Nachbarstraße; eine Ablage-Zufahrt auf der Containerkachel stiehlt
das Ziel nicht.
