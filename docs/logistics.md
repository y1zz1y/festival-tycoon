# Logistik: Straßen, Fahrzeuge, Waren

Zwei Netze: **Fußwege** (Besucher, Träger, Personal) und **Straßen**
(Autos, Bus, Müllwagen, Krankenwagen, Lastwagen). Waren laufen über Depots,
Mindestbestände und Träger; Lastwagen liefern an Anlieferungsplätze.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Straßengraph, Fahrzeuge, Ankunft | `src/game/logistics.ts` | `LogisticsSnapshot`, `findRoadRoute`, `RoadVehicle`; `RoadCell.elevation` / `roadSlope` |
| Aussteigen am Parkplatz | `src/game/logistics.ts`, `src/game/GameState.ts` | `chooseParkingDisembarkPath`, `finishVehicleParking`, `collectSeatedPassengerIds` |
| Straßenrampen | `src/game/GameState.ts`, `src/game/wayElevation.ts` | `placeRoadSegment`, Autodach `MAX_ROAD_RAISE` 1, Shift-Ausgang `planLockedOriginRamp` |
| Saugreiniger | `src/game/GameState.ts` | `isSweeperDriveCell`, `findSweeperRoute`, `updateSweeper`, `getSweeperDirtAccesses` |
| Krankenwagen-Einsatz | `src/game/GameState.ts` | `dispatchIdleAmbulances` — nächster freier Wagen zum Verletzten |
| Müllwagen-Erhalt | `src/game/GameState.ts` | `restoreMissingGarbageTrucks`, `reenterGarbageTruck`, `holdGarbageTruckOffMap`, `sellGarbageTruck` |
| Depots, Bestellungen, Lastwagen | `src/game/supplyChain.ts` | `Infrastructure`, `infrastructureAction`, `updateSupplyChain` |
| Automatische Träger | `src/game/depotCarriers.ts` | `updateDepotCarriers` |
| Bude: alle Seiten | `src/game/shopAccess.ts` | `isShopServiceKind`, `CARDINAL_OFFSETS` |
| Müllablagen / Eimer-Suche | `src/game/waste.ts` | `designateWasteDumps`, `findNearestWasteDump`, `connectedWasteDumpStats` |
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
| Balancing | `src/game/simulationConfig.ts` | `logistics`, `waste` |

## Wichtige Regeln

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
  `getRoadCellAt(x, z, elevation?)` ohne Höhe nimmt die unterste Lage. Saugreiniger (`sweeper`) sind die Ausnahme: sie nutzen
  den Fußgängergraphen, fahren aber nur auf normalen Wegen **und**
  Bühnenvorplätzen (`isSweeperDriveCell`). `findSweeperRoute` setzt
  `allowStaff`, damit Personaleingänge (`staffOnly`) passierbar sind;
  Gäste bleiben blockiert, Lastwagen bleiben auf der Straße. Der
  Fahrschritt prüft dieselbe Fläche, nicht `getPathAt` allein — Vorplätze
  haben keinen Weg und würden sonst die Route am Rand verwerfen.
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
  Einparken steigen Anreise-Insassen trotzdem aus; das Auto fährt
  nicht sofort wieder ab, nur weil sie noch `vehicle-arrival` wären.
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
- Das Infofenster eines Müllfahrzeugs zeigt die **Müllladung**
  (`cargo` / `garbageTruckCapacity` 90, inkl. Prozent), nicht Insassen.
  Insassen nur bei Fahrzeugen, die Personen tragen (`visitorCar`, Bus,
  Krankenwagen). Lieferwagen behalten die Warenladung. Saugroboter
  bleiben im Personal-Infofenster (`Müllladung`).
- Idle-Krankenwagen fahren nicht den ersten Verletzten in der Gästeliste
  an: `dispatchIdleAmbulances` paart jeden Verletzten mit dem nächsten
  freien Wagen (Manhattan, dann **eine** Straßenroute). Ein Wagen auf
  dem Weg oder mit Patient bleibt zugewiesen. Sanitäter: `docs/staff.md`.
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
- `setRoadDirection` dreht alle Straßenfahrzeuge auf der Kachel
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
`tests/supplyChain.ts` (Lieferung, Umwege, Cache-Recovery).
`tests/festival.ts` (Lager, Bestellungen). `tests/operations.ts` (Betrieb,
Saugreiniger auf Wegen, Bühnenvorplatz und durch Personaleingang,
nächster freier Krankenwagen zum Verletzten,
Müllwagen bleiben im Stau
und hinter der Karte erhalten, Wiedereinfahrt sobald Einstiege frei
sind, Rückfahrt vom Ausgang, Buden-Nachschub von der Seite/hinten,
Personaleingang auf der Kante, Parkplatz-Abriss inkl. Restbelegung,
Aussteigen auf den angrenzenden Fußweg bzw. Zufahrts-Fallback,
Insassen erst nach dem Aussteigen aktiv / verletzbar).
`tests/accessControl.ts` (Ampel/Schranke, Slots, Tageszeit, Festivalphase, Zeitplan, Sensor, Halt vor Rot,
opportunistisches Parken inkl. Einbahn-Nebenbucht, Trennlinie,
Liefer- und Müllwagen-Umweg bei Dauer-Rot, Gebiet).
`tests/wayElevation.ts` (Straßenrampen, Autodach 1.0, Save ohne Höhenfeld, fester Shift-Ausgang,
Fußweg auf Autostraße, gestapelte Autostraße / Brücke, ein Feld übermalen ohne Nachbarverlust).
`tests/festivalAdditions.ts` (Müllwagen-Ladung statt Insassen,
zusammenhängende Müllablage-Füllstände).

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Fahrzeugarten, Depot-Rollen, Bestellregeln, Tore oder
der Trennschnitt Straße/Fußweg ändern. Neue Logistics-Gebäude auch in
`docs/buildings.md` und `catalog.ts`.
