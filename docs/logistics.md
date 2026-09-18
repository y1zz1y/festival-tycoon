# Logistik: Straßen, Fahrzeuge, Waren

Zwei Netze: **Fußwege** (Besucher, Träger, Personal) und **Straßen**
(Autos, Bus, Müllwagen, Krankenwagen, Lastwagen). Waren laufen über Depots,
Mindestbestände und Träger; Lastwagen liefern an Anlieferungsplätze.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Straßengraph, Fahrzeuge, Ankunft | `src/game/logistics.ts` | `LogisticsSnapshot`, `findRoadRoute`, `RoadVehicle` (`tourBus` + `tourBusParking` target); `RoadCell.elevation` / `roadSlope` |
| Logistik-Tick und Fahrzeug-Indizes | `src/game/logisticsSimulation.ts`, `src/game/roadVehicleSimulation.ts`, `src/game/GameState.ts` | `updateLogisticsSimulation`, `buildLogisticsTickState`; `RoadVehicleSimulation.processLogisticsVehicles`; `GameState` verdrahtet die schmalen Fach-Callbacks |
| Straßenfahrzeug-State-Machines | `src/game/roadVehicleSimulation.ts` | Gemeinsame Bewegung, Blockade/Umplanung sowie Dispatch, Rückkehr und Leg-Abschluss für Besucherautos, Krankenwagen, Busse, Müll- und Lieferwagen |
| Aussteigen am Parkplatz | `src/game/logistics.ts`, `src/game/GameState.ts` | `chooseParkingDisembarkPath`, `finishVehicleParking`, `collectSeatedPassengerIds`, `tryBoardDepartureCar`, `canParkedCarDepart` |
| Debug: Autos entfernen | `src/game/GameState.ts`, `src/main.ts` | `removeVisitorCarsForDebug` — alle `visitorCar`, Belegung, Insassen zu Fuß; nicht Abriss |
| Straßenrampen | `src/game/GameState.ts`, `src/game/wayElevation.ts` | `placeRoadSegment`, Autodach `MAX_ROAD_RAISE` 1, Shift-Ausgang `planLockedOriginRamp` |
| Saugreiniger | `src/game/GameState.ts` | `isSweeperDriveCell`, `findSweeperRoute`, `updateSweeper`, `getSweeperDirtAccesses` |
| Krankenwagen-Einsatz | `src/game/GameState.ts` | `dispatchIdleAmbulances` — nächster freier Wagen zum Verletzten; idle zurück zur Garage |
| Krankenwagen verkaufen | `src/game/GameState.ts` | `sellAmbulance`, `sellAmbulanceVehicle`, `pendingSale` nach Rückfahrt |
| Buslinie planen | `src/game/GameState.ts`, `src/game/busPlanner.ts`, `src/game/logistics.ts`, `src/main.ts` | `createBusLine`, `setBusLineStops`, `addBusToLine`, `previewBusLineRoute`, `previewBusLineMarkers`, `sortBusLineStops` |
| Müllwagen-Erhalt | `src/game/GameState.ts` | `restoreMissingGarbageTrucks`, `reenterGarbageTruck`, `holdGarbageTruckOffMap`, `sellGarbageTruck` |
| Depots, Bestellungen, Lastwagen | `src/game/supplyChain.ts` | `Infrastructure`, `infrastructureAction`, `updateSupplyChain` |
| Automatische Träger | `src/game/depotCarriers.ts` | `updateDepotCarriers` |
| Bude: alle Seiten | `src/game/shopAccess.ts` | `isShopServiceKind`, `CARDINAL_OFFSETS` |
| Müllablagen / Eimer / versiegelte Container | `src/game/waste.ts` | `designateWasteDumps`, `findNearestWasteDump`, `connectedWasteDumpStats`, `wasteDropGoals`, `isSealedWasteContainer` |
| Fahrzeug-Infofenster | `src/game/logistics.ts` | `formatRoadVehicleInspectLoad`, `roadVehicleCarriesPeople` |
| Boden für Straßen/Depots | `src/game/ground.ts` | Tragfähigkeit, Nässe, Tempo-Limits |
| Festival-Bestellungen | `src/game/festivalManagement.ts` | `orderGoods`, Supplies |
| Straßen-UI | `src/logisticsUI.ts` | Geländeplaner, Straßenbelag; Fußweg-Art-Hold in `#path-construction` |
| Straßen-/Depot-Darstellung | `src/view/LogisticsView.ts`, `src/view/SupplyChainView.ts`, `src/view/logisticsModels.ts` | Retro-ModelKit: Haltestellen, Depots, Anlieferung, Lager; Fahrzeuge. Parkplätze: graue Asphaltfläche in der normalen Ansicht; Belegung (grün/orange, P) nur als Bauhelfer |
| Träger-Figuren | `src/view/carrierModels.ts` | Gäste-Personen-Teile, Warnweste, Handkarren, Kistenstapel; Picking über `staffId` |
| StVO-Fahrtrichtungspfeil | `src/view/roadDirectionArrow.ts` | Weiße Markierung (`paint`) auf Straße und in der Vorschau; kompaktes Overlay (`overlay`) |
| Ampeln und Wegschranken | `src/game/accessControl.ts` | Slots, Tageszeit, Festivalphase, Tagesplan, Sensoren, Gebiet, `evaluateAccessSignal` |
| Trennlinie / Kante sperren | `src/game/GameState.ts` | `toggleRoadSeparator`, `road.blockedEdges` |
| Ampel-/Schranken-Darstellung | `src/view/AccessControlView.ts` | eine Richtung, Grün/Rot bzw. offen/zu |
| Fahrzeug-Interpolation | `src/view/transportMotion.ts` | nur Darstellung |
| Balancing | `src/game/simulationConfig.ts` | `logistics` (`visitorCarCapacity` 6 = max. Anreisegruppe, `groupSizeWeights` 1–6, `busCapacity` 40 = Festivalbus-Fahrgäste, `busStopDwellMinutes` 2, `busBoardingRadiusTiles` 4, `busBoardsPerTick` 40), `waste` |

## Wichtige Regeln

- `claimAdjacentFreeParking` fragt über `getAdjacentParkingCells` nur die vier
  Nachbarkacheln ab. `ensureParkingIndex` hält die echten Parkbuchten im räumlichen
  Index; Reservierungen wirken dadurch sofort auf das nächste Fahrzeug.
  Hinzufügen, Entfernen und Laden erneuern den Index. Bei gepackten Koordinaten
  werden die echten X/Z-Werte zusätzlich geprüft. Zufahrten, Höhen, Sperrkanten,
  Ampeln und die bestehende Sortierung nach X/Z werden unverändert geprüft.

- Ausfahrtsuchen ohne dynamische Belegung werden in `GameState.findReachableRoadExit`
  je Straßengraph, Straßenlage, Fahrtrichtung und U-Turn-Regel wiederverwendet.
  Auch unerreichbare Ausfahrten werden gespeichert: wartende Autos dürfen nicht
  jeden Tick dieselbe vollständige Suche ausführen. Straßen-/Pfeiländerungen
  ersetzen den Graphen und verwerfen sofort alle Ergebnisse. Belegungsabhängige
  Umwege suchen weiter mit den aktuellen Sperrzellen; Ausparkreservierungen und
  Bewegungsprüfungen bleiben aktuell. Routen werden als unabhängige Kopien geliefert.

- Trägerwege über `findPath` (Fußgänger), Fahrzeuge über `findRoadRoute`.
  Nicht mischen.   Straßen und Fußwege können Rampen in **halben** Höhenstufen
  bauen (`planLockedOriginRamp` in `wayElevation.ts`). Im Stückmodus bleibt
  bei gehaltenem Shift die Ausgangskachel fest; nur Nachbarn bekommen die
  Rampe. Autos bleiben höchstens eine Höhenstufe über dem lokalen Gelände;
  der Graph verbindet nur Kanten mit passender Höhe. Alte Straßen ohne
  Höhenfeld liegen nach dem Laden auf dem Gelände.
  Ein Fußweg auf einer Autostraße (`placePathSegment`) löscht die Straße
  nicht: gleiche Höhe wird zum Übergang (`RoadCell.crosswalk`), eine
  Ebene darüber zum Steg. Zwei Autostraßen dürfen dieselbe Kachel auf
  **verschiedenen** Höhen teilen (`getRoadCellsAt`, Graph-Schlüssel
  `roadLayerKey`): gleiche Höhe aktualisiert nur diese Lage (Belag,
  Neigung), eine halbe Stufe oder mehr darüber legt eine Brücke; die
  untere Lage bleibt befahrbar. Nachbarn, Parkplätze und Tore bleiben.
  Fahrzeugbelegung, Vorfahrt und Ausweich-/Rückwärtsmanöver verwenden
  ebenfalls `roadLayerKey` über `GameState.roadPositionKey`. Pfeile,
  Geschwindigkeitsregeln, Fußgängerkollisionen und Parkplatzanschlüsse
  gelten nur auf der jeweiligen Ebene. Eine Pfeiländerung richtet nur
  Fahrzeuge auf der geänderten Straßenlage neu aus. `findRoadRoute`
  versteht belegte Ebenenschlüssel; alte zweidimensionale `cellKey`-Sperren
  sperren weiterhin die gesamte Kachel. Routen behalten `elevation` auch
  beim Laden, Ausweichen und Rückwärtssetzen auf Rampen.
  `getRoadCellAt(x, z, elevation?)` ohne Höhe nimmt die unterste Lage. Saugreiniger (`sweeper`) sind die Ausnahme: sie nutzen
  den Fußgängergraphen, fahren aber nur auf normalen Wegen **und**
  Bühnenvorplätzen (`isSweeperDriveCell`). `findSweeperRoute` setzt
  `allowStaff`, damit Personaleingänge (`staffOnly`) passierbar sind;
  Gäste sperrt nur die bemalte Kante (Legacy die ganze Kachel). Lastwagen
  bleiben auf der Straße. Der
  Fahrschritt prüft dieselbe Fläche, nicht `getPathAt` allein — Vorplätze
  haben keinen Weg und würden sonst die Route am Rand verwerfen.
- `updateLogisticsSimulation` hält die historische Phasenfolge fest:
  Zugangssignale, Freight→Fahrzeuge, Flottenreparatur, Tick-Indizes,
  Dispatch/Fahrt/Stopps über den `GameState`-Callback, Entfernungen und danach
  Fahrzeuge→Freight. Belegungs-, Fußgänger-, Buswarte- und Insassen-Indizes
  werden einmal pro Logistik-Tick im Fachmodul gebaut.
- `RoadVehicleSimulation` besitzt den Straßenfahrzeug-Tick und seine
  typspezifischen Callbacks, importiert aber keinen konkreten `GameState`.
  Tourbus-Ankunft/-Abfahrt bleibt an die Bandversorgung angebunden.
  Saugreiniger teilen nur die Logistikphase, fahren weiter auf dem
  Fußgängergraphen; Depot-Träger bleiben eine getrennte State-Machine.
- Imbiss und Getränkestand nehmen Nachschub von **jeder** angrenzenden
  Weg- oder Vorplatzkachel, nicht nur von der gedrehten Vorderseite.
  `shopAccess.ts` (`CARDINAL_OFFSETS`, `isShopServiceKind`) und
  Träger nutzen weiterhin alle vier Seiten (auch Maskottchen- und T-Shirt-Stand).
  `GameState.getFacilityAccessCells` und Warteschlangen berücksichtigen für Gäste
  ausschließlich die gedrehte Vorderseite. `Supply` umfasst `food`, `drinks`,
  `water` und `goods` (Allgemeine Waren für alles außer den drei Grundtypen).
  Fehlendes `goods` in alten Depots/Ständen wird 0.
- Saugreiniger halten vor Besuchern, nicht vor Personal. Volle Maschinen
  entladen an einer Müllablage; sie leeren keine Eimer. Optionales
  `RoadVehicle.workZones` (3×3-Schlüssel wie Personal) begrenzt
  Schmutzsuche und Aufnahme; fehlend oder leer = gesamtes Gelände.
  In der Personalverwaltung erscheinen sie unter Reinigungskraft.
- Träger behalten Ladung, wenn ein Weg fehlt oder die Ablage voll ist.
- `updateDepotCarriers` bekommt eine Multi-Goal-`findPath`-Funktion; keine
  Suche pro einzelnem gleichwertigem Ziel in einer Schleife.
- Neue manuelle Warenrouten gibt die UI nicht mehr vor; vorhandene Routen
  aus alten Spielständen bleiben gültig neben der Automatik.
- Mindestbestände rasten in 20er-Schritten (`snapStockMinimum`, 0–800).
  Anlieferung, Depot und Personaltor liegen im Baumenü unter Logistik
  (Bildkatalog wie Deko/Attraktionen; Tab **Krankenhaus** für
  `ambulanceGarage` und `medicalArea`).
  Einstellungen und Trägerzahl stehen im Reiter **Waren & Träger** der
  Logistikverwaltung und im Infofenster des angeklickten Lagers. Die
  Logistikverwaltung öffnet über das Paket-Icon in der oberen Gruppe
  **Verwalten**; das Lkw-Icon im Baubereich bleibt dem Baukatalog vorbehalten.
- Die Logistikansicht mit Untergrund ist ein Overlay
  (`setLogisticsMode`), unabhängig vom Geländeplaner.
- Parkplätze sind ausgewiesene Felder, kein eigener Wegtyp. Im normalen
  Blick (ohne Autostraßen-Fenster und ohne Logistik-Overlay) liegt grauer
  Asphalt im Terrain-Atlas und als geteilte Overlay-Fläche mit
  Stellplatzlinien. Straßen, Pfade und Wiese bleiben unverändert. Die
  grün/orange Belegung und das P bleiben Hilfen der Autostraßen-Bauansicht.
  Abriss (auch Autostraßen-Abreißen) entfernt die Bucht, räumt
  `occupiedBy` und ungültige Reservierungen und gibt die Kachel frei;
  leere oder verwaiste Restbelegung darf überbaut werden. Nach dem
  Entfernen wird die Navigation sofort ungültig. Der Asphalt im Atlas
  hängt nur an `parkingCells`.
  Nach dem Einparken steigen Gäste auf eine **orthogonal angrenzende**
  normale Fußwegkachel aus (`chooseParkingDisembarkPath`): zuerst ein
  Weg ohne Fahrbahnüberlappung, sonst der Weg gegenüber der Zufahrt,
  sonst irgendein 4er-Nachbar. Ein Zebrastreifen (Fußweg auf der
  Autostraße) zählt als begehbare Lage, wird aber gemieden, wenn ein
  reiner Gehweg anliegt. Ohne Nachbarweg bleibt der bisherige Fallback
  (Zufahrt, sonst Eingang); niemand bleibt in der Bucht stehen.
  Bis dahin zählen Insassen (`passengerIds`) nicht als Fußgänger auf
  der Fahrbahn: sie laufen nicht, belegen die Straße nicht, werden
  nicht verletzt und ziehen keinen Sanitäter/Ticker. Nach dem
  Einparken steigen Anreise-Insassen trotzdem aus (`placeVisitorOnDisembarkCell`
  auf die Fuß-Zelle, dann Zielwahl, dann `keepDisembarkRouteOnFoot`).
  Parkbuchten ohne Weg (`NAV_PARKING` ohne `NAV_PATH`) sind keine
  Fußgänger-Kanten, damit niemand zwischen Stellplatz und Gehweg oszilliert.
  Debug **Autos entfernen** (`removeVisitorCarsForDebug`) löscht zuerst alle
  `visitorCar` und `occupiedBy`, dann setzt Insassen (`vehicle-arrival` /
  `passengerIds`) auf den Ausstiegsweg und schickt sie zu Fuß heim.
  Solange das Auto noch existiert, gilt ein Insasse als im Fahrzeug
  (`isVisitorInDepartureVehicle`) — deshalb darf die Abreise nicht vor dem
  Löschen laufen, sonst bleiben die Wagen stehen. Bus, Krankenwagen,
  Müllwagen und Saugreiniger bleiben. Abriss trifft weiter keine Autos.
  Das Auto fährt nicht sofort wieder ab, nur weil sie noch `vehicle-arrival`
  wären. Wer mit einem Auto kam, fährt **nur mit genau diesem Auto**
  wieder; niemals zu Fuß oder in einem anderen Wagen. Manifest ist
  `arrivalGroups.memberIds` (lebende IDs mit derselben
  `arrivalGroupId`; tote IDs und fremde Claims werden gestrichen).
  Kapazität `visitorCarCapacity` 6 entspricht der größten Anreisegruppe.
  Das Auto fährt erst, wenn jeder noch vorhandene Original-Insasse wieder
  in `passengerIds` sitzt. Verletzte/in Behandlung halten den Wagen;
  nach der Genesung gehen sie zu ihrem Auto. Fehlt die Ausfahrtroute,
  bleiben die Insassen sitzen und die Suche wird wiederholt. Beim
  fehlgeschlagenen Abfahrtsversuch markiert `waitMinutes > 0` am geparkten
  Besucherauto die fehlende Ausfahrtroute; dieselbe Anzeige gilt bei einem
  bereits abfahrenden Auto ohne Route. Infofenster und Fahrzeugliste
  zeigen dann „Keine Ausfahrtroute – Straßenpfeile und Verbindungen prüfen“.
  Fehlen wieder Mitfahrer oder beginnt die Abfahrt, wird dieser Status
  zurückgesetzt. Pfeiländerungen invalidieren den Straßengraphen sofort;
  die nächste Logistik-Aktualisierung startet die nun mögliche Abfahrt.
  Ein falsch gerichteter Pfeil in einer Parkplatzkurve darf nicht durch
  Fahren gegen die Einbahnrichtung umgangen werden. Eine belegte Zufahrt
  lässt das Auto in der Bucht warten und zählt nicht als fehlende Route.
  Die Zufahrt wird während des Rückwärtsmanövers reserviert. Belegte
  Besucherautos verschwinden weder durch den Stau-Timeout noch durch
  eine verlorene Route im Park; reguläre Abreise endet an der Kartenkante.
  Beim
  tatsächlichen Ausparken startet das Auto in der Bucht, setzt rückwärts
  auf die gewählte angrenzende Fahrbahn und dreht erst dort in die
  berechnete Ausfahrtroute ein; ein angezeigtes `3 / 3` genügt damit nicht
  nur für den Zustandswechsel, sondern führt auch aus der Parkbucht heraus.
  Anreise und Abfahrt sind getrennt. Das Infofenster zeigt
  `Insassen` als `sitzen / Manifest`.
- Personaltore sperren die Kachel für Besucher, nicht für Personal,
  Saugroboter oder Waren-Träger. Lastwagen nutzen das Straßennetz und
  fahren nicht durch Personaleingänge.
  Neu gesetzte Tore rasten auf der Ausgangskante der Baurichtung ein
  (`staffGateDirection`, dieselbe Versatzkonstante wie Personentore);
  alte Saves ohne Richtung bleiben optisch mittig, der Zugang ändert sich nicht.
- Laufende Transporte, Ladungen und Bestände gehören in Snapshot und
  Host-Sync.
- Im Stau bleibt die Nase vorwärts. Eine blockierte Abbiegung wird sofort
  neu geplant, wenn die andere Richtung frei ist. Nach
  `vehicleUnstickMinutes` prüft jedes wartende Fahrzeug eine freie,
  regelkonforme Nebenrichtung (Einbahn, Sperrkanten). Fehlt die, setzt nur
  das letzte Auto zurück. Nicht gegen die Fahrtrichtung oder verbotene
  Kanten fahren.
- Lieferwagen (`deliveryTruck`) und Müllwagen nutzen dieselbe
  `findRoadRoute`-Logik wie Autos: keine U-Turns in der Suche, Nase
  vorwärts, blockierte Abbiegung sofort neu, Rückwärts nur wenn die
  Zelle frei ist. Ein gesperrter Rückwärts-Schritt wird verworfen; ist
  beides blockiert, gilt die normale Fahrtrichtung. Nach dem Entladen
  dreht der Lieferwagen in die Ausfahrt.
- Versiegelte Müllcontainer (`sealedWasteContainer`, 80 Beutel) darf
  der Müllwagen anfahren, **nur wenn der Container auf einer
  Straßenkachel steht** und eine Nachbarstraße vom Müllnetz erreichbar
  ist. Er hält auf der **angrenzenden** Straße, nicht auf derselben
  Kachel wie der Container (Ablage-Zufahrten belegen oft genau diese
  Kachel und würden sonst das Ziel stehlen). Zielart
  `RoadVehicleTarget.kind === 'sealedWasteContainer'` (`buildingId`,
  x, z). Ankunft leert den Container und danach offene Ablagen wie
  bisher. Liegt eine gefüllte Straßenkiste an, fährt der Wagen **zuerst
  dorthin** — eine Ablage-Zufahrt am Depot darf ihn nicht dauerhaft
  beim Kippen halten. Off-road oder ohne Zufahrt bleiben sie für den
  Wagen unsichtbar; idle Reinigung schleppt dann zur Ablage. Steht der
  Container an der Straße, der Wagen aber nicht unterwegs, leert idle
  Reinigung ebenfalls.
- Das Infofenster eines Müllfahrzeugs zeigt die **Müllladung**
  (`cargo` / `garbageTruckCapacity` 90, inkl. Prozent), nicht Insassen.
  Insassen nur bei Fahrzeugen, die Personen tragen (`visitorCar`, Bus,
  Krankenwagen). Lieferwagen behalten die Warenladung. Saugroboter
  bleiben im Personal-Infofenster (`Müllladung`).
- Idle-Krankenwagen fahren nicht den ersten Verletzten in der Gästeliste
  an: `dispatchIdleAmbulances` paart jeden Verletzten mit dem nächsten
  freien Wagen (Manhattan, dann **eine** Straßenroute). Ein Wagen auf
  dem Weg oder mit Patient bleibt zugewiesen. Ohne Patient (idle oder
  nach der Übergabe) fährt der Wagen zur Garage und parkt am Anschluss;
  er bleibt nicht auf der Straße. Verkauf in der Logistikübersicht oder
  im Infofenster: idle an der Garage sofort, sonst Abbruch ohne Patient
  bzw. Rückfahrt mit Patient und `pendingSale` bis zur Ankunft.
  Sanitäter: `docs/staff.md`.
- Buslinien: Haltestellenreihenfolge liegt in `BusLine.stopIds`. Die
  Planer-UI hält die Auswahl lokal (kein Multi-Select-Rebuild): links
  der Pool ungenutzter Haltestellen, rechts die aktive Fahrreihenfolge
  ohne Duplikate, Drag-and-Drop plus Pfeile. `sortBusLineStops` in
  `src/game/busPlanner.ts` macht Nearest-Neighbor plus 2-opt auf
  `findRoadRoute`-Längen (deterministisch, Schleife zurück zum ersten
  Stopp / Depotanschluss). `setBusLineStops` ändert die Reihenfolge
  einer bestehenden Linie; `addBusToLine` kauft oder weist einen
  weiteren Bus desselben Depots zu (max. 3, Kosten `busCost`, Start am
  Depotanschluss, gleiche Stoppfolge). Ein Bus nimmt bis zu
  `busCapacity` 40 Fahrgäste auf; freier Platz kommt aus
  `SIMULATION_CONFIG.logistics.busCapacity` minus aktuellen
  `bus-riding`-`passengerIds` (tote oder hängende IDs fallen raus).
  An der Haltestelle steigt er während der ganzen Standzeit
  (`busStopDwellMinutes` 2) ein, nicht nur im ersten Tick: längste
  `busWaitMinutes` zuerst, dann ID. Bereit ist, wer zur Linie gehört und
  in `busBoardingRadiusTiles` 4 (Manhattan, näherer Wert von
  Haltestellenkachel und `roadCell`) wartet: auf dem Halt, in der
  Warteschlange / auf Nachbarwegen, auf der gegenüberliegenden
  Straßenseite, oder noch auf dem Weg dorthin (`targetId` = Halt).
  Wer nur vorbeiläuft (`route` nicht leer und anderes Ziel), bleibt draußen.
  Pro Tick steigen bis zu `busBoardsPerTick` 40 ein (ein leerer Bus
  kann die Schlange in einem Tick füllen). Die Wartenden kommen aus
  einem `bus-waiting`-Zellenindex (ein Aufbau je Logistik-Tick, auch
  wenn die ID noch in `passengerIds` steht), nicht aus einem vollen
  Besucherscan je Bus. Nach der Mindeststandzeit fährt der Bus weiter,
  sobald er voll ist oder niemand mehr im Radius wartet; freie Plätze
  plus Wartende halten ihn. Einsteigen zählt nicht gegen das
  Entscheidungsbudget.
  `sellBus` entfernt den Bus
  weiter von Depot und Linie. Overlay-Daten: `previewBusLineRoute`
  (Stopps in Reihenfolge, dann Schleife) und `previewBusLineMarkers`
  (1-basierte Nummern an den Haltpositionen).
- Gekaufte Flottenfahrzeuge (`garbageTruck`, Bus, Krankenwagen,
  Saugreiniger) dürfen beim Stau-Timeout nicht wie abfahrende
  Besucherautos gelöscht werden. `unstickVehicle` und das Leeren der
  Route entfernen nur `visitorCar` / `deliveryTruck`. Fehlt ein
  Müllwagen in `roadVehicles`, obwohl die Depot-`truckIds` ihn noch
  führen, setzt `restoreMissingGarbageTrucks` ihn am Depotanschluss
  wieder ein. Hinter der Kartenkante wartet er die Entladung ab und
  versucht jede freie, befahrbare Einfahrt (nicht nur die erste freie
  Einstiegskachel). Solange alle Einstiege belegt sind oder kein Weg
  zum Depot existiert, bleibt er off-map und versucht es erneut,
  sobald eine Zufahrt frei ist. Nach
  `truckUnloadMinutes + vehicleUnstickMinutes` setzt
  `returnGarbageTruckToDepot` ihn an den Depotanschluss. Ein leerer
  Wagen, der idle am Ausgang oder sonst nicht am Depot steht, fährt
  von selbst zurück statt dort stehenzubleiben. Verkauf gilt auch
  für verschwundene oder noch off-map stehende Müllwagen; unterwegs
  auf der Karte bleibt der Verkauf gesperrt, solange der Wagen nicht
  idle und leer ist.
- `setRoadDirection` dreht alle Straßenfahrzeuge auf der geänderten Straßenlage
  (Autos, Bus, Liefer- und Müllwagen) und berechnet die Route neu.
  Einbahnen liegen als weiße StVO-Fahrstreifenpfeile über den Fahrzeugen.
  Das Werkzeug Fahrtrichtung zeigt dieselbe weiße Markierung in der
  Vorschau (über Autos und Baufeld) und eine kompakte Laufanimation
  auf gesetzten Einbahnen.
- Gebäude und Fahrzeuge nutzen gemergte ModelKit-Meshes
  (`logisticsModels.ts`): ein Draw-Call pro Instanz, geteilte Geometrie.
- Träger nutzen `carrierModels.ts`: dieselben Personen-Teile wie Gäste,
  plus eine geteilte Warnwesten-Geometrie, einen gemergten Handkarren und
  einen Kistenstapel (`load`). Kein Mesh pro Latte oder Schloss.
  Fahrzeugnasen zeigen lokal nach **+Z** (wie `facing` /
  `atan2(dx, dz)`). Besucherautos wählen die Lackfarbe deterministisch aus
  `VISITOR_CAR_COLORS` über die Fahrzeug-ID.
- Ampeln stehen rechts an der Fahrbahn und leuchten dem Verkehr entgegen.
  Sie stehen nur auf Straßen, Wegschranken nur auf normalen
  Personenwegen, jeweils mit gesetzter Baurichtung. Nach dem Bau öffnet
  sich der Info-Dialog.   Vier Modi: zeitgesteuert, Sensor,
  **Immer offen**, **Immer zu**. Zeitgesteuert kombiniert
  Festivalphasen (`lead` Vorbereitung, `festival`, `break` Pause) mit
  einer Zeitquelle: wiederholende 10-Minuten-Slots je Stunde
  (Standard, fehlende Felder in alten Saves), **Tageszeit**
  (24-Stunden-Raster) oder **Nach Zeitplan** (folgt einem
  `DayPlanOffer` über `isFestivalOfferActive`, also denselben
  Öffnungszeiten wie Fahrgeschäfte, Buden, Bühnen oder Lampen).
  Beide Teile gelten per UND: die gewählten Phasen **und** die
  Zeitquelle müssen offen sein. Feste Slots und die festen
  Zustände brauchen kein Gebiet.
  Wegschranken haben Durchgang **eine Richtung** (Gegenrichtung bleibt
  gesperrt, auch wenn das Tor offen ist) oder **beide Richtungen**.
  `openInEmergency` (Standard an) öffnet das Tor bei Massenpanik oder
  Feuer in **beide** Richtungen. Sensor:
  Ampel nach freien/keinen freien Parkplätzen oder Autos unter/über X
  auf Straßen im Gebiet; Schranke nach freien/belegten Campingflächen
  oder Personen unter/über X. Polarität sagt, ob die Bedingung Grün/offen
  oder Rot/zu auslöst. Das Info-Fenster zeigt immer die aktuellen
  Zähler für das Gebiet und die gewählte Regel. Gebiet: Rechteck ziehen
  fügt Felder hinzu, nochmals über ein vollständig markiertes Rechteck
  entfernt sie.
- Rote Ampeln sperren die Kante **vor** der Ampel (Einfahrt) und die
  Ausgangskante. Fahrzeuge halten auf der Kachel davor, nicht auf dem
  Ampelfeld. Besucherautos reservieren keine Bucht von weitem: sie fahren
  auf die Zufahrten zu und nehmen die erste freie, legal erreichbare
  Nachbarbucht (`claimAdjacentFreeParking`). Gibt es eine Route, die Rot
  meidet (`routePreferringOpenLights`), biegen sie nicht in die rote
  Kante ein; sonst warten sie an der Haltelinie. Dieselbe
  Grundlogik (`rerouteAwayFromRedLight` + `collectVehicleRouteTargets` +
  `routePreferringOpenLights`) gilt für alle Straßenfahrzeuge:
  Besucherautos, Lieferwagen, Müllwagen, Bus und Krankenwagen.
  Ziele liegen immer auf der Straße (Kippen- und Depotanschluss, nicht
  die Fläche selbst). Bleibt die Ampel länger rot als
  `accessRerouteMinutes`, dürfen Liefer- und Müllwagen dafür auch wenden.
  Parken und Ausparken
  nur über `getParkingApproachRoads`. Die **Trennlinie**
  (`road.blockedEdges`) sperrt diese Seite wie eine physische Kante.
  Eine Einbahn gilt nur fürs Weiterfahren auf der Straße, nicht fürs
  seitliche Einparken: steht das Auto neben einer freien, erlaubten
  Bucht, nimmt es sie (`claimAdjacentFreeParking`).
  `getAdjacentRoadPositions` bleibt für Depots/Kippen unverändert.
- Geschlossene Schranken sperren die Fußkante in
  `getPedestrianNeighbors` / `isPedestrianEdgeBlocked`. Der
  Pfadcache hängt an `accessSignalRevision` und wird nur geleert,
  wenn ein Signal kippt. Zähler-Indizes einmal pro Auswertung bauen,
  nicht in Kontroll-Schleifen scannen.
- Kosten: `trafficLightCost` 120 €, `pathBarrierCost` 70 €.

Einbahn-Einfahrten werden auch an der Zielkachel geprüft: kein Einfahren
gegen einen Pfeil aus einer ungerichteten Kreuzung, seitliches Abbiegen bleibt
erlaubt. Fahrbewegung, Ausweichen und Rücksetzen prüfen denselben Graphen.
Alte illegale Routen werden neu geplant; falsch ausgerichtete Fahrzeuge
werden im Tick korrigiert. Ausparken richtet die Nase beim Einfahren aus.

## Tests

`tests/carrierModels.ts` (geteilte Gästeteile, Warnweste, Karren).
`tests/simulationModules.ts` (Logistik-Phasenfolge, Tick-Indizes,
Entfernungsabschluss, zustandslose Fahrzeughelfer und Besitz der
Straßenfahrzeugfamilien durch `RoadVehicleSimulation`).
`tests/supplyChain.ts` (Lieferung, Umwege, Cache-Recovery).
`tests/festival.ts` (Lager, Bestellungen). `tests/operations.ts` (Betrieb,
Saugreiniger auf Wegen, Bühnenvorplatz und durch Personaleingang,
nächster freier Krankenwagen zum Verletzten,
idle Krankenwagen zurück zur Garage, Verkauf sofort oder nach Rückfahrt,
Haltestellen bleiben in der gewählten Reihenfolge, späterer zweiter Bus
folgt derselben Linie, Overlay-Zellen in Stoppfolge,
leerer Bus holt lang wartende Gäste während `busStopDwellMinutes`,
auch aus der Schlange / gegenüber der Straße (`busBoardingRadiusTiles` 4),
10 Wartende steigen vor der Abfahrt in einen leeren 40er-Bus,
Kapazität `busCapacity` 40, `busBoardsPerTick` 40,
Müllwagen bleiben im Stau
und hinter der Karte erhalten, Wiedereinfahrt sobald Einstiege frei
sind, Rückfahrt vom Ausgang, Buden-Nachschub von der Seite/hinten,
Personaleingang auf der Kante, Parkplatz-Abriss inkl. Restbelegung,
Aussteigen auf den angrenzenden Fußweg bzw. Zufahrts-Fallback,
laufen ohne Parkbucht-Jitter zum Ziel, Zebrastreifen neben der Bucht,
Abreise nur im eigenen Anreiseauto (5er/6er-Gruppe steigt vollständig wieder ein, tote/fremde IDs blockieren nicht),
Insassen erst nach dem Aussteigen aktiv / verletzbar,
Debug Autos entfernen löscht Wagen und Belegung).
`tests/accessControl.ts` (Ampel/Schranke, Slots, Tageszeit, Festivalphase, Zeitplan, Sensor, Halt vor Rot,
opportunistisches Parken inkl. Einbahn-Nebenbucht, Trennlinie,
Liefer- und Müllwagen-Umweg bei Dauer-Rot, Gebiet).
`tests/wayElevation.ts` (Straßenrampen, Autodach 1.0, Save ohne Höhenfeld, fester Shift-Ausgang,
Fußweg auf Autostraße, gestapelte Autostraße / Brücke, ein Feld übermalen ohne Nachbarverlust).
`tests/festivalAdditions.ts` (Müllwagen-Ladung statt Insassen,
zusammenhängende Müllablage-Füllstände).
`tests/sealedWasteContainer.ts` (Wagen vom Depotanschluss zielt den
Straßen-Container auch bei Ablage an der Depotzufahrt, hält auf der Nachbarstraße, Füllstand sinkt nach
der Tour; Ablagefeld neben der Kachel stiehlt das Ziel nicht;
off-road bleibt manuell).

Bandversorgung (Backstage, Tourbus-Parkplatz, Baumenü Logistik →
Bandversorgung plus Tab **Bandversorgung** in der Logistikverwaltung):
[`band-supply.md`](band-supply.md). Guest-`parkingCells`
und Shuttle-`bus` bleiben getrennt vom `tourBus` / `tourBusParking`.
Tourbus-Plätze müssen straßenerreichbar sein (`findRoadRoute` / gleiche
Straßensuche wie Depots). Der `tourBus` ist ein eigener dunkler Reisebus
(nicht der gelbe Shuttle), fährt morgens auf die Parkplatz-Kachel und
bleibt dort bis zur Abendabfahrt.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Fahrzeugarten, Depot-Rollen, Bestellregeln, Tore oder
der Trennschnitt Straße/Fußweg ändern. Neue Logistics-Gebäude auch in
`docs/buildings.md` und `catalog.ts`.

## Deko-Eimer und Straßen-Kontextabriss (0.1.126)

Mülleimer sind jetzt unter Deko/Möbel, einschließlich zehn Themenvarianten.
Müllträger und Reinigung nutzen `isWasteBin` und bleiben unverändert funktional.
Im Straßenbaumodus entfernt ein kurzer Rechtsklick nur die betroffene
Straßenlage über `undoRoadSegment`; Fußweg/Gebäude bleiben erhalten.

## Straßenoberflächen und Brücken (0.1.127)

`LogisticsView` nutzt texturierte volle Straßendecks ohne graue Anschlussflicken,
Asphalt-Mittellinien auf Geraden und Geschwindigkeitsfarbe nur als Bauhilfe.
`wayStructures.ts` liefert Leitplanken an unverbundenen Brückenkanten sowie
schlanke Stützen, die unter der lokalen Rampenhöhe enden. Untere Straßen und
Fußwege werden bei den Stützen ausgespart. Geländer bleiben an legalen
Anschlüssen offen. Fahrregeln und Netztopologie ändern sich nicht.

## Bänke an Straßen (0.1.131)

Eine Bank darf als dekoratives Wegmöbel auf einer Autostraßenlage gleicher Höhe
stehen. Ihre Kante muss nach außen zeigen; angrenzende Straßen bleiben frei.
Die Straßenlogik, Fahrzeugwege und Deck-Geometrie ändern sich nicht.
