# Besucher

Besucher leben im Snapshot (`GameSnapshot.visitors`). Bedürfnisse, Emotionen
und Ziele werden im festen Tick berechnet. Klickbare Infos und Gedankenblasen
sind abgeleitete Darstellung desselben Zustands.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Tick-Phase, Entscheidungsqueue | `src/game/visitorSimulation.ts` | `VisitorSimulation`, `VisitorSimulationContext`, `runTickPhase`, `flushDecisions` |
| Detailverhalten, Bewegung, Ziele | `src/game/visitorBehavior.ts` | `VisitorBehaviorService`, `VisitorBehaviorContext`; Bewegung/Ankunft, Needs, Konzert, Shop, Camping, Baden (auch Schwimmbad-Becken), Müll und Laufzeit-Caches |
| Typen, Spawn, Fassade | `src/game/types/entities.ts`, `src/game/visitorSpawning.ts`, `src/game/GameState.ts` | `Visitor`, `VisitorState`; Admission, Ankunftsgruppen und stabile Kompatibilitäts-Einstiege |
| Stand-Queue-Spuren | `src/game/queueLanes.ts` | `queueStandOffset`, `stallQueueTileOffset` |
| Need-/Alkohol-/Übelkeitswerte | `src/game/simulationConfig.ts` | `visitors`, `needs` (`interactionMinutes.stockout`), `alcohol`, `nausea` |
| Festivallust / Gedränge | `src/game/visitorCrowdingSimulation.ts`, `src/game/simulationConfig.ts` | `Visitor.motivation`, Crowd-/Panikpass, `crowding.motivation*` |
| Festival-Schlafrhythmus | `src/game/visitorSleep.ts`, `src/game/simulationConfig.ts` | `camping.sleepSchedule`, `sampleFestivalSleepRhythm`, `isMinuteInSleepWindow` |
| Inventar (Zelt, Essen, Pyro, …) | `src/game/inventory.ts` | Inventarfelder und Verbrauch |
| Gedanken gruppieren | `src/game/visitorThoughts.ts` | `groupVisitorsByThought` |
| Statusblasen / Panik-Schwellen | `src/game/visitorBubbles.ts` | `visitorBubbleKind`, `spontaneousPanicChance` |
| Musikgeschmack | `src/game/musicTaste.ts` | `GENRES`, `musicAppeal` |
| Beschwerden | `src/game/complaints.ts` | `COMPLAINT_TOPICS`, Zähler |
| Stabile Optik (Geschlecht, Hash) | `src/game/rng.ts` | `visitorLooksFemale`, `hashStringSeed` |
| Pixel-Personen | `src/view/pixelPeople.ts` | geteilte Geometrien, Accessory-Batches |
| Souvenirs | `src/game/shopGoods.ts`, `src/view/souvenirMeshes.ts` | `ownedMascot`/`heldMascot`, `wornShirt`; Instanz-Batches |
| Ankunft per Auto/Fuß | `src/game/logistics.ts`, `src/game/GameState.ts` | `ArrivalGroup`, `collectSeatedPassengerIds`, `chooseParkingDisembarkPath`, `finishVehicleParking`, `placeVisitorOnDisembarkCell`, `keepDisembarkRouteOnFoot` |

## Wichtige Regeln

- Erscheinung aus stabilem Hash der **vollen** Visitor-ID ableiten, nicht aus
  Array-Index, Simulations-RNG oder Frame-Zeit.
- Keine vollständigen Besucher-Scans innerhalb anderer Besucher-Schleifen.
  Räumliche / Belegungsindizes einmal pro Pass bauen.
- Zielwahl und Interaktions-Callbacks zählen gegen das Entscheidungsbudget
  (`docs/pathfinding.md`, `docs/simulation.md`).
- `VisitorSimulation` besitzt FIFO- und Routing-Auftragsqueue sowie den aktiven
  Entscheidungs-Scope. Der schmale Callback-Kontext importiert keinen konkreten
  `GameState`; das gemeinsame Tick-Budget bleibt in der Fassade, weil auch
  Band-Akteure daraus Arbeit entnehmen.
- `VisitorBehaviorService` besitzt die umfangreichen, zusammenhängenden
  Bewegungs-, Ziel-, Interaktions- und Needs-Abläufe samt reinem Laufzeitcache.
  Autoritativer Zustand bleibt im `GameSnapshot`; ein typisierter Callback-Kontext
  liefert Navigation, Camping, Medizin, Security und Fassadenaktionen ohne
  Rückimport von `GameState`. Die Fassade behält die von Regressionen und
  Tick-Orchestrierung verwendeten Einstiegspunkte.
- `VisitorSpawning` besitzt Intervallsteuerung, Gruppen-/Autoankünfte,
  Ticket-/Campingzulassung und Visitor-Erzeugung. `VisitorCrowdingSimulation`
  besitzt den einmaligen räumlichen Crowd-Pass, Motivation und Panik. Beide
  erhalten schmale Kontexte und importieren keinen konkreten `GameState`.
- Gäste erreichen Imbiss und Getränkestand ausschließlich an der gedrehten
  Vorderseite (`getFacilityAccessCells`); auch die Queue muss dort anschließen.
  Warenträger dürfen weiterhin von allen vier Seiten liefern.
- Tages- vs. Campinggäste haben getrennte Tickets, Einlassfenster und
  Abreisewege. Fahrzeug-Abreise hängt an `logistics`.
  Bei der Abreise nach Park- oder Festivalende ist ausgewiesener Campingboden
  ein begehbarer Fallback: Auch ein davon eingeschlossener Gast erreicht den
  normalen Weg und Ausgang, statt ohne Route stehen zu bleiben.
  Beim Aussteigen aus einem geparkten Auto erscheinen Gäste auf einem
  orthogonal angrenzenden normalen Fußweg (Punkt mit `tileOffset` auf
  dieser Kachel, nicht in der Bucht). Mehrere Nachbarwege: zuerst ohne
  Fahrbahn, dann gegenüber der Zufahrt. Ohne Nachbarweg bleibt der
  Zufahrts-/Eingangs-Fallback.
  Solange jemand in `RoadVehicle.passengerIds` steht (Anreiseauto, Bus,
  Krankenwagen) oder `vehicle-arrival` / `bus-riding` ist, ist er kein
  Fußgänger: keine Bewegung, keine Weg-Belegung, keine Verletzung, kein
  Sanitäter, kein Ticker.   Beim Einparken lädt `finishVehicleParking`
  Anreise-Insassen trotzdem aus (erst Platz auf dem Nachbarweg mit
  gültiger Fuß-Zelle/`tileOffset`, dann Zielwahl auf dem Wegnetz).
  Die erste Route darf nicht durch die Parkbucht. Anreise-Insassen
  steigen aus und bleiben draußen. Wer mit dem Auto kam, geht zur
  Abreise nur zu **diesem** Wagen (Nachbarweg/Zufahrt/Bucht), nie zu Fuß
  zum Ausgang und nie in ein anderes Auto. Das Auto wartet, bis jeder
  noch lebende Original-Insasse (`arrivalGroups.memberIds`) wieder sitzt
  — auch 5 oder 6 Personen (`visitorCarCapacity` 6). Verletzte halten
  den Wagen; nach der Behandlung zurück zum eigenen Auto. Tote IDs und
  fremde Claims werden aus dem Manifest gestrichen.
  Zufahrt und Bucht bleiben gültige Türen.
  Eine im Auto gesetzte Verletzung gilt erst auf dem Fußweg.
  Debug **Autos entfernen** löscht die Wagen zuerst, setzt Insassen auf
  den Ausstiegsweg und schickt sie zu Fuß heim — sonst bleibt
  `beginVisitorDeparture` ein No-Op, solange sie noch in `passengerIds`
  stehen.
- Wer eine Schlange verlässt (Abreise, geschlossenes Angebot, Ausverkauf)
  oder am Essen-/Getränkestand bedient wurde, geht die Queue-Kette
  rückwärts zum Eingang. An **Stand-Queues** (Imbiss, Getränke, WC, Souvenirs)
  ist das die rechte **Zurückschlange**; Anstehende bleiben links in der
  **Anstehschlange** (Blick zur Theke). Der Rückweg läuft mit normaler
  Gehgeschwindigkeit, ohne Queue-Gedränge; am Ausgang wählen sie sofort
  das nächste Ziel. Attraktionsqueues bleiben ungeteilt.
- Konstruierte Kursattraktionen werden nur gewählt, wenn ihr Eingang eine
  gerichtete Warteschlangenkette besitzt. Die Zielsuche läuft wie bei
  Achterbahnen zum äußeren Ende dieser Kette und darf Queue-Felder benutzen.
  Die Reservierung trägt den Gast bereits in `course.queue` ein, der Einlass
  darf ihn aber erst mit Zustand `queuing` am Ende seines Hinwegs auf die
  Strecke setzen; `seeking`-Gäste dürfen nicht aus der Ferne teleportiert werden.
  Spaß entsteht erst nach der tatsächlichen Fahrt/Teilnahme und ihrem
  regulären Abschluss; Reservierung, Anstehen oder Vorbeilaufen verändern
  `needs.fun` nicht. Die additiven, bei 100 gedeckelten Werte liegen zentral
  in `simulationConfig.ts`.
  Leere Stände: nur
  `needs.interactionMinutes.stockout` warten, dann denselben Rückweg.
  Die Wartezeit zählt als negativer `interactionRemaining` unabhängig vom
  Gedanken-Text; bei wieder verfügbarem Bestand wird sie zurückgesetzt.
  Die budgetierte Zielwahl lässt leere Läden aus und sucht mit einer
  Multi-Goal-Suche nach erreichbaren Alternativen mit Bestand.
- Festivalbus: `bus-waiting` bleibt stehen (leere Route, Ziel bleibt die
  Haltestelle). Einsteigen passiert in der Logistik, nicht über das
  Entscheidungsbudget: längste `busWaitMinutes` zuerst, auch nach vielen
  Ticks und auch wenn der Bus schon in der Standzeit (`busStopDwellMinutes`)
  ist. Wartende im Radius um Halt und Fahrbahn (`busBoardingRadiusTiles`)
  steigen mit ein, nicht nur die Kachel direkt am Schild.
  `docs/logistics.md`.
- Das Konzert-Oberteil-Ereignis betrifft höchstens eine Person auf dem Gelände.
  `atmosphere.concertToplessChancePerMinute` begrenzt die gesamte Ereignisrate
  (0,002 pro Spielminute), auf die Population verteilt. Die aktive Person wird
  einmal pro Besucherpass ermittelt; alte Mehrfachereignisse werden bereinigt.
- Bereits beim Loslaufen reservieren Gäste Queue-Kapazität. Diese noch
  laufenden Reservierungen dürfen aber keinen physischen Platz blockieren:
  Angekommene Gäste stehen stabil in Ankunftsreihenfolge davor und rücken bei
  jedem Tick kontinuierlich nach. Das gilt für Stände und Achterbahnen.
- Festivallust ist `Visitor.motivation` (0–100), nicht ein extra Need neben
  Hunger/Toilette/Spaß/Energie. Sie sinkt durch Gedränge, leere Bedürfnisse
  und schlechte Atmosphäre (`crowding.motivationLossPerMinute`). Ein
  gebuchter Live-Auftritt füllt sie über `atmosphere.concertMotivationPerMinute`
  mal `showQuality` der Bühnen-Bandversorgung (`docs/band-supply.md`),
  solange der Gast `partying` mit passender `concertId` am laufenden Slot
  steht. Warten vor dem ersten Song, Vorbeigehen und dunkle/pausierende
  Bühnen füllen sie nicht. Balancing und Show-Bedingungen: `docs/stages.md`.
  Alle Konzertgäste eines Ticks verwenden dabei denselben zuvor von
  `syncBandSupply` erzeugten Qualitäts-Snapshot; kein Backstage-/Gebäude-/
  Besucher-Vollscan pro Zuschauer.
  Fans können budgetiert ins aktive Backstage eindringen
  (`backstageIntrusion`); das ist kein zweites Need.
- Baden (`swimming`) ist Freizeit wie `relaxing`: bei niedrigem Spaß und
  erreichbarem Wasser (Tiefe ≥ `terrain.minSwimDepth`, Standard 0.5) eine
  Multi-Goal-Suche gegen `decisionsPerTick`. Wasser ist für Gäste begehbar
  und langsamer (`swimPathCostMultiplier` / `swimMoveMultiplier`), nicht für
  Personal, Träger oder Fahrzeuge. Seichte Felder und Land auf 0 zählen
  nicht. Gedanken: „Ich gehe baden…“ / „Das Wasser ist herrlich…“.
  Darstellung: Figur sitzt tiefer im Wasser (`WorldView`), nicht auf der
  Wasserfläche. See-Index einmal je `worldRevision`, kein Besuchervollscan.
- Neue Need- oder State-Werte müssen in Snapshot, UI, Gedanken und ggf.
  Multiplayer-Deltas landen.
- Maskottchen und T-Shirts sind Andenken (`goods`), kein Hunger-/Durststillen.
  `souvenirs.holdMascotChance` entscheidet nach dem Kauf, ob das Maskottchen
  in der Hand sichtbar bleibt. `wornShirt` überschreibt Körperfarbe und Schnitt
  bis zur Abreise. Fehlende Felder = altes Aussehen.
- Schlafzeiten sind Festival-Chronotypen, kein ziviler Feierabend:
  Bettzeit etwa 03:00–06:00, Schlafdauer 5–9 Stunden (Wachfenster grob
  08:00–15:00). `preferredBedtime` / `preferredWakeTime` bleiben Snapshot-
  Felder; fehlende Werte kommen aus der Visitor-ID, alte zivile 20:00–24:00-
  Bettzeiten werden einmalig verschoben. Familien gehen
  `familyBedtimeAdvanceMinutes` früher schlafen. Camper laufen in ihrem
  Fenster bei Energie unter `scheduledSleepEnergyBelow` zum Zelt
  (`findRouteToCampsite`); Gäste ohne Camp gehen bei
  `nonCamperDepartureEnergyBelow` nach Hause oder ruhen auf Bänken.
  Über Nacht (etwa 16:00–02:00) senkt `peakEnergyDecayMultiplier` den
  Grundverbrauch, nach der persönlichen Bettzeit erhöht
  `afterBedtimeEnergyDecayMultiplier` ihn. Kein neues Quartier für
  Tagesgäste.
- Getragener Müll (`pendingWaste`) geht in den **nächsten** Eimer in
  `waste.binRange`, wenn dort Platz ist. Versiegelte Container zählen im
  **7×7-Umfeld** (Chebyshev ≤ `waste.sealedVisitorChebyshevRange` 3).
  Tische (`table`) sind Wegmöbel wie Bänke, Kapazität 4; Gäste essen/trinken
  dort aus dem Inventar. Camper konsumieren auch am eigenen Platz und
  bevorzugen die Heimatparzelle in `findRouteToGathering`.
  Anreisen skalieren mit `arrivalPriceMultiplier` (Preis × Willingness). Ist dieser Eimer voll, unbenutzbar
  oder fehlt ein begehbarer Eimer mit Platz, lassen die Gäste den Müll
  sofort als `litter` auf der aktuellen (sonst benachbarten begehbaren)
  Kachel fallen und wählen das nächste Bedürfnis. Sie bleiben nicht in
  `seeking`/`exploring` ohne Route stehen und laufen nicht über die Karte
  zu einem weiter entfernten freien Eimer. Balancing:
  `waste.visitorDropIfBinFull`. Eimer-Liste einmal pro Tick, keine
  Gebäude-Vollscans in der Besucherschleife.

## Tests

Abreise-, Müll- und Ausgangsziele teilen `decisionsPerTick`, einschließlich direkter
Callbacks. Dringende Zustandsfreigaben passieren sofort; aufgeschobene Besucher
behalten Camp und Müll, bis die faire Entscheidungsqueue ihren Auftrag verarbeitet.
Bereits begonnene Müllwege werden beim wiederholten Schließzeit-Check beibehalten.

`tests/pixelPeople.ts` (Batches, stabile Optik). `tests/shopGoods.ts` (Kauf,
Hand-Chance, Shirt vom Stand, Save). `tests/regression.ts`
(Spawn, Needs, Speed-Partition, Festivalende-Abreise durch Campingflächen).
Festival-Anreisen und Live-Show-Festivallust: `tests/festival.ts`,
`tests/stageTickets.ts`. Queue-Reihenfolge, kontinuierliches Nachrücken,
Queue-Rückweg, geteilte Stand-Spuren, leere Stände, Aussteigen auf den
Nachbarweg, Insassen steigen nach dem Parken aus und bleiben zu Fuß
(keine Verletzung/Belegung vor dem Aussteigen), Abreise wartet im Auto
nur im eigenen Anreiseauto (5er/6er steigen vollständig wieder ein), voller Nachbar-Eimer
ergibt Bodenmüll statt Stillstand, leerer Eimer wird weiter benutzt:
`tests/operations.ts` (inkl. leerer Bus holt lang wartende Gäste,
`busCapacity` 40),
`tests/queueLanes.ts`.
Der Modul-Seam (Service-Verantwortung, Phasenreihenfolge, verzögerte
Routing-Aufträge und direkter Aufruf außerhalb eines Ticks) liegt in
`tests/simulationModules.ts`.
Festival-Schlafzeiten, Legacy-Remap, zirkadianer Energieverbrauch und
Zelt-/Abreiseziele: `tests/visitorSleep.ts`. Baden und Wassertiefe:
`tests/terrainLand.ts`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn `Visitor` / `VisitorState` / Needs neue Felder bekommen,
Festivallust-Quellen oder -Verluste wechseln, Spawn- oder Abreiselogik wechselt,
Müllfallen bei vollem Eimer ändert oder Gedanken/Bubbles neue Arten erhalten.
Neue UI-Panels für Besucher in `docs/ui.md` mitvermerken.
