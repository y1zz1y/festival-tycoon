# Tests und Prüfkommandos

Vor Abschluss jeder Änderung: `npm run validate`. Das Gesamtskript führt
statische Qualitätsprüfungen, Regressionen, Build und Dokuprüfung aus.
Performance-Arbeit zusätzlich wie in `docs/performance.md`.

## Attraktionsgrundlage

`tests/attractionFoundation.ts` prüft Mittellöschung, getrennte Komponenten,
Wiederverbindung und erneute Start→End-Reihenfolge, Loop-/Shuttle-/
Start-End-/Open-Exit-Validierung, Preview/Command-Parität, Area-Konnektivität,
Referenz-Allowlisten, Wasserlandung und die gemeinsame Builder-Palette.
`tests/snapshotModules.ts` deckt v30→v31 einschließlich Pool-Aufteilung und
gemeldeter Entfernung eines nicht konvertierbaren Kurses sowie v31→v32 mit
Default-Nachfrage-Tuning und v32→v33 mit Legacy-Vorplatztiefe ab.

## Kommandos

| Kommando | Zweck |
| --- | --- |
| `npm run validate` | vollständiger Abschlusscheck: ESLint, Knip, jscpd, Regressionen, Build und Doku |
| `npm run lint` | ESLint für TypeScript; Fehlerregeln plus SonarJS-Komplexitätswarnungen |
| `npm run quality:dead-code` | Knip: verwaiste Dateien, unbenutzte/fehlende Abhängigkeiten und nicht auflösbare Imports |
| `npm run quality:duplicates` | jscpd: Duplikate in `src`, `server` und `scripts`; maximal 15 % |
| `npm test` | gesamte Suite über `scripts/test.mjs` / `tests/regression.ts` |
| `npm run test:docs` | dokumentierte Pfade, Regression-Suite, Snapshot-Version und kritische Modulzuordnung |
| `npm run build` | `tsc` + Vite-Produktion |
| `npm run test:performance -- rtest3 120` | CPU-Ticks, 1×/3×/8× |
| `npm run test:performance -- rtest3 1200` | langer Lauf (Festival kann enden) |
| `npm run test:performance:fixtures` | alle in `tests/fixtures/performance/manifest.json` registrierten Referenz-Saves |
| `npm run test:install` | PWA/Homescreen-Artefakte |
| `$env:PROFILE_METHODS='1'` | inklusive Methodenzeiten (PowerShell) |

## Qualitätsgrenzen

- `eslint.config.js` prüft alle TypeScript-Dateien. SonarJS meldet kognitive
  Komplexität über 50 und identische Funktionen als Warnung; echte
  Korrektheits-/Unused-Verstöße schlagen fehl. Der bestehende Warnungs-Budget
  ist 42 (`--max-warnings 42`): senken ist erwünscht, erhöhen nicht.
- `knip.json` kennt Browser-, Server-, Test- und Script-Einstiege. Der
  Abschlusscheck beschränkt Knip bewusst auf Dateien und Abhängigkeiten;
  öffentliche Fach-Exports werden nicht als Fehler behandelt.
- `.jscpd.json` prüft Produktionscode ab acht Zeilen bzw. 70 Tokens je Klon.
  Die globale Duplikationsquote darf 15 % nicht überschreiten.
- Neue Warnungen nicht blind ausblenden. Grenzwerte nur mit dokumentierter
  Begründung ändern.

## Welche Datei prüft was

| Datei | Inhalt |
| --- | --- |
| `tests/regression.ts` | Orchestrierung, Tick-Partition, Multiplayer-Sockets, Saves, Abreise durch Camping-Ausweisungen nach Festivalende |
| `tests/accounts.ts` | Registrierung, Sessions, Passwort-Hashes und Rate-Limit |
| `tests/saves.ts` | kontoabhängige und öffentliche Server-Spielstände |
| `tests/finance.ts` | Bücher, Kredite, vorbereitete Szenarien und Ziele |
| `tests/courseAttractions.ts` | Kurs-Konstruktion, Validierung, Einlass, Rutschverletzung, Pause-Unterhalt, Ticketnachfrage, Sterne-Bands |
| `tests/snapshotModules.ts` | Deterministischer Snapshot-Bootstrap, sichere Migration, delegierendes `GameState.fromJSON` |
| `tests/ticketDemandTuning.ts` | Nachfrageformeln, Normalisierung, Live-Zustand und host-autoritativer Command |
| `tests/simulationModules.ts` | Extraktionsgrenzen: Logistik/Visitor-Phasen, `RoadVehicleSimulation`, `VisitorBehaviorService`, `VisitorSpawning`, `VisitorCrowdingSimulation`, `CoasterSimulation`, `PlacementService` und `snapshotRepair`; faire Routingqueue und direkte Aufrufe außerhalb des Ticks |
| `tests/uiModules.ts` | Extraktionsgrenzen: Command-Registry/Optimistic-Policy, Flächen-Preview/Execute, Weglinien-/Rechteckbildung, autoritative Kontexthilfe, differentielle Update-Gates, Archiv-Merge/Escaping, gemeinsame Geld-/Zeit-/HTML-Formatierung, Katalog-HTML und Kartenwerkzeuge weiterhin durch Multiplayer-Gate |
| `tests/browserSaves.ts` | Gemeinsame Quota-Erkennung, lokaler Slot- und Schnellspeichern-Roundtrip (Besucher/Gebäude bleiben), Liste ohne `fromJSON`, gemockter Server-Client (HTML/401) |
| `tests/unsavedWork.ts` | Ungespeicherte Arbeit: Bauen/Abreißen markiert sie, Speichern setzt zurück, reines Ticken zählt nicht, Fünf-Minuten-Grenze exakt, abgeschaltete Warnung lässt Abbruchwege durch |
| `tests/performanceGuards.ts` | Budgets, Multi-Goal-Camp, Cache, Batches, endliche Festivalmodell-Bounds/Picking, Lights, Achterbahnwagen, Logistik-Modelle |
| `tests/festival.ts` | Wochenendablauf, Buchung, Lager, Ruf, Live-Show-Festivallust |
| `tests/headlineMagazine.ts` | HEADLINE Magazin nur nach Festivalende, ≥1 Pro/Kontra, deterministisch, nicht mitten im Wochenende |
| `tests/headline-magazine-preview.html` | visuelles HEADLINE-Heft nach einem beendeten Wochenende |
| `tests/visitorSleep.ts` | Festival-Schlafzeiten, Legacy-Remap, zirkadiane Energie, Zelt- und Abreiseziele |
| `tests/festivalAdditions.ts` | spätere Festival-Systeme, Eimer-Karton-Batches, zusammenhängende Müllablage-Füllstände, Müllwagen-Ladungsanzeige, 1-Feld-Steigungen, Wagen-Mesh, gerundete Schienenjoins, Achterbahn-Komplettabriss, SI-Geschwindigkeitsuntergrenzen (`chainSpeed` / Launch / Drag / `maximumSpeed`) |
| `tests/coasterTypes.ts` | Achterbahn-Typkatalog (alle Typen spielbar), Zug-Thumbnail-Spec je Typ, live vs diskrete Anschlussregeln, Helix/LIM/Junior/Maus/Mine/Bobbahn-Filter, fehlender typeId → classicSteel, Palette: Typ-Ausschluss vs aktuell ausgegraut, Hard-Switch inkl. Richtung (erster Klick ändert das Fenster), Ghost unverändert bei gesperrtem Klick, **Palette zweimal listen remountet keine IDs**, **`updateCoasterConstruction` bleibt über spielende Ticks unverändert**, Testbetrieb auf geschlossenem classicSteel-Rechteck während `festival.planning`, SI-Physik-Untergrenzen |
| `tests/bandSupply.ts` | Bare vs versorgt, geteilter Pool, Konzertgäste ohne Supply-Graph-Neuaufbau pro Person, Tourbus-Quote 2/3 vs 3/3, Fans senken Attraktivität, Ankunft 08:00 mit Bus auf dem Parkplatz / Abreise abends, Idle-Akteure auf aktivem Backstage, gleiche `costumeId` Bühne/Backstage, Ausweisen neben der Bühne, Tourbus nur auf Backstage an der Straße (nicht auf Gras), Gebäude/Deko auf dem Overlay, inaktive Fläche bleibt markierbar zählt aber nicht, Junior/ohne Slot → Personaleingang; siehe [`band-supply.md`](band-supply.md) |
| `tests/ticker.ts` | Müllwagen 90, Ablage 180, kein Overflow, Ticker >90 % / Feuer / Panik, keine Verletztenmeldung für Insassen |
| `tests/musicPlanning.ts` | Spielplan, Genres |
| `tests/stageTickets.ts` | Tickets, Bühnenfläche |
| `tests/stageInteraction.ts` | Werkstatt / Interaktion einschließlich frei skalierbarer Vorplatztiefe und Legacy-Default |
| `tests/supplyChain.ts` | Waren, Umwege, Ground, Mindestbestand in 20er-Schritten |
| `tests/busPlanner.ts` | Buslinien-Planer: keine doppelten IDs links+rechts, DnD/Reorder-Helfer, Auto-Sort kürzer oder gleich einer gemischten Reihenfolge, Overlay-Nummern = Fahrreihenfolge |
| `tests/operations.ts` | Betrieb, Personal, Alltag, Saugroboter durch Personaleingang, Einsatzgebiete, Reinigung leert volle Eimer zuerst und idle auch halbvolle, Verletzte an den nächsten freien Sanitäter / Krankenwagen (ohne Insassen im Auto), idle Krankenwagen zurück zur Garage, Verkauf sofort oder nach Rückfahrt, Buslinie behält Stoppfolge, späterer zweiter Bus, Overlay in Stoppfolge, leerer Bus holt lang wartende Gäste während der Standzeit (`busCapacity` 40),
auch aus der nahen Schlange / gegenüber (`busBoardingRadiusTiles` 4, 10 Wartende vor Abfahrt), Müllwagen-Erhalt / Wiedereinfahrt, Queue-Kette / Rückweg / leerer Stand / Stand-Spuren, Nachschub von allen Seiten und Verkauf nur vorne, Parkplatz-Aussteigen auf Nachbarweg (bleiben ausgestiegen, laufen ohne Bucht-Jitter zum Ziel), Abreise nur im eigenen Anreiseauto (3/3 setzt rückwärts aus der Bucht und verlässt die Karte; 5er/6er-Gruppe vollständig; tote/fremde IDs und Verletzte), Insassen erst nach dem Aussteigen verletzbar / belegend, Parkplatz-Abriss, Krankenfeld-Abriss, Dach über Liegen ohne Löschen, abgewiesenes Überbauen inkl. Restbelegung, Debug Autos entfernen löscht Wagen und gibt Belegung frei, Gäste lassen Müll fallen wenn der nächste Eimer voll ist und benutzen leere Eimer weiter |
| `tests/sealedWasteContainer.ts` | Versiegelte Müllcontainer: Kapazität 80, Reinigung bevorzugt näheren Container vor Ablage, volle Container übersprungen, versiegelte Attraktivitätsstrafe schwächer als offene Ablage, Müllwagen vom Depot zielt Straßen-Container (Nachbarstraße; Ablage an Depotzufahrt oder Containerkachel stiehlt nicht) und senkt `stored` nach der Tour, off-road nicht, idle Reinigung schleppt zur Ablage sobald kein Wagen unterwegs ist (`truckReachable` allein reicht nicht), voller Eimer zuerst, Live-Tick off-road → Ablage |
| `tests/staffZones.ts` | 3×3-Einsatzgebiete: Ziehen weist zwei Blöcke zu, Start auf aktivem Block entfernt, `setStaffZone` flackert nicht, Saugroboter dieselbe Farbe |
| `tests/queueLanes.ts` | Hälftige Stand-Queue-Geometrie, Spurwahl, keine Attraktionsänderung |
| `tests/shopGoods.ts` | Allgemeine Waren, Maskottchen-Kauf/Hand-Chance, Shirt-Farbe/Schnitt, Save-Defaults |
| `tests/accessControl.ts` | Ampeln, Tore, Sensoren, Einweg, Notfallöffnung, Halt vor Rot, opportunistisches Parken, Trennlinie, Liefer-/Müllwagen-Umweg, Tageszeit / Festivalphase / Zeitplan |
| `tests/rideAccess.ts` | Tore, Queues, Bungee/Karussell |
| `tests/scenery.ts` | Deko-Slots, Kanten-Fahnen, Tageslichtballon als Vollfeld, neue Arten, Attraktivität je Kind, Stapel/Reichweite, unbekannte Katalog-Arten |
| `tests/pedestrianBarriers.ts` | Hecke/Wand/Zaun blockieren Fußgänger; Wandtür passierbar; Vollfeld vs. Kante; Nav-Invalidierung bei Setzen/Abriss |
| `tests/decoration.ts` | Themenliste 8–12 inkl. Klassik/Arktis/Steampunk, Filter ohne Themen-Leaks, Legacy-Vollfeld, Platzierung über `scenery.ts`, Licht-Deskriptor je Lampenart, N Lampen → N Quellen, Abriss entfernt Licht |
| `tests/picking.ts` | Abriss-Raycast: Instanz-IDs, getroffenes Mesh vs. Nachbar/Kachelmitte, Reittor-Zelle |
| `tests/buildMenu.ts` | Jedes platzierbare Tool außer `inspect` genau einmal im Baumenü; Deko/Attraktionen/Logistik als Katalog; Achterbahn-Kacheln mit Zugstil/`coasterVehiclePreview`; Camping-, Krankenhaus- und Bandversorgung-Tabs (`backstageArea`, `tourBusParking`); Bauhöhe bleibt beim gleichen Tool und fällt bei neuem `setTool` auf 0; Deko-Gruppen kommen aus `decoration.ts` |
| `tests/blueprints.ts` | 2×2 mit zwei Dekos stempeln, Preview ohne Mutation, Bibliothek-Roundtrip ohne `SAVE_KEY` |
| `tests/placementPreview.ts` | Bauhöhe/Bodenkachel; autoritative Preview-Matrix für Gebäude, Slots, Haltestelle, Bandversorgung, Medizin/Dächer, Depots, Blueprint und Ride-Zugang; jede Anfrage bleibt mutationsfrei |
| `tests/terrainSurface.ts` | Gelände-Mesh (zwei Dreiecke je Kachel), Pads, Parkplatz-Asphalt nur auf Parkfeldern |
| `tests/terrainLand.ts` | Drei Geländewerkzeuge, Stufe 0,5, Fläche auf Starthöhe, Klippe nach 0,5, Wasser am Uferhang, Baden, Nav nach Edit, Stützen nur im Freiraum, Fußweg land-0→0,5 ja / land-0→1 nein |
| `tests/environments.ts` | Umgebungen |
| `tests/wayElevation.ts` | Halbstufen-Rampen für Fußweg und Straße, Autodach 1.0, Legacy-Höhe 1 bleibt 1.0, Shift-Ausgang bleibt beim Rampenstreichen, Fußweg auf Autostraße behält die Straße, gestapelte Autostraße / Brücke, ein Straßenfeld übermalen löscht keine Nachbarn, Klippe 0→1 blockiert, 0,5-Hang und Weg-Rampe begehbar, Bewegung ohne Y-Warp |
| `tests/pixelPeople.ts` | Personen-Batches |
| `tests/carrierModels.ts` | Träger: geteilte Gästeteile, Warnweste, Karren |
| `tests/campingModels.ts` | Zelt-/Pavillon-Batches |
| `tests/mobileTouch.ts` | Touch-Kamera / Gesten |
| `tests/audio.ts` | Kamera-Listener (Look-At, nicht Gäste), Range-Skip, One-Shot-Cap, geclusterter Jubel + Cooldown |
| `tests/performance.ts` | synthetische Last |
| `tests/people-preview.html` | visuelle Personen-Fixture |
| `tests/carrier-preview.html` | visuelle Träger neben Gästen |
| `tests/camping-preview.html` | visuelle Camping-Fixture |
| `tests/access-preview.html` | visuelle Tor-Modelle |
| `tests/coaster-car-preview.html` | visuelle Achterbahnwagen |
| `tests/render-performance.html` | Browser-Framezeiten |

## Wichtige Regeln

`testLocalParkingClaims` in `performanceGuards.ts` begrenzt Zufahrtsprüfungen
bei 400 entfernten Buchten auf die unmittelbaren Nachbarn. Der Test prüft
X/Z-Priorität, sofortige Reservierungen, neue/entfernte Buchten und die Abweisung
entfernter Kacheln bei Kollisionen der gepackten Koordinaten.

`performanceGuards.ts` prüft wiederholte erfolgreiche/erfolglose Ausfahrtsuchen,
unabhängige Routenkopien, dynamische Belegung, getrennte Fahrtrichtungs-/U-Turn-
Einträge und sofortige Wiederherstellung nach einer Pfeilkorrektur. Die bestehenden
Abreise-, Überführungs- und Frame-Partition-Tests bleiben dafür ebenfalls verbindlich.

`operations.ts` prüft eine voll besetzte Abreise mit falsch gerichtetem
Straßenpfeil: Insassen bleiben erhalten, die fehlende Ausfahrtroute wird
auch nach Laden angezeigt, bei fehlendem Mitfahrer verschwindet der alte
Hinweis und nach Pfeilkorrektur fährt das Auto automatisch bis aus der Karte.
Reproduktion vom 15.09.2026: Im zugesandten Spielstand blockierte der Pfeil
bei X −28 / Z 19 (Westen statt Süden/+Z) die gemeinsame Parkplatzausfahrt.
Die private korrigierte Kopie ändert ausschließlich diese Richtungsmaske.
Der vertiefte Überführungstest unterscheidet tatsächliche Kartenausfahrten
von Stau-Timeout-Entfernungen: mit Ebenen- und Ausparkfix fahren bei
1×/3×/8× alle 141 Autos durch die Ausfahrt nach 570/493/493 Aufrufen von
`tick(0.1)`, ohne vorzeitige Entfernung. Persönliche Spielstände gehören
nicht in die Test-Fixtures.

`wayElevation.ts` fährt Fahrzeuge durch gestapelte Straßen und Halbstufenrampen:
andere Ebenen blockieren nicht, gleiche Ebenen schon, fremde Richtungspfeile
drehen Autos nicht, Fußgänger unter Brücken blockieren oben nicht. Laden,
Ausweichschritte, Rückwärtsmanöver und die Inspektionslinie behalten die Höhe.
Ein verlorener Abfahrtsweg wird angezeigt und löscht das Fahrzeug nicht.
`operations.ts` prüft belegte Ausparkzufahrten und den Erhalt besetzter Autos
bei längerem Stau.

Zusätzliche Regressionen: `accessControl.ts` prüft Einbahn-Einfahrten an
ungerichteten Kreuzungen und die gemeinsame Kantenlage von Personentor und
Personaleingang; `operations.ts` trennt frontalen Verkauf von
seitlichem/hinterem Nachschub, prüft gedankenunabhängige Ausverkauf-Wartezeit
und die Kantenlage neuer Personaleingänge samt Legacy-Mitte sowie
Saugroboter durch `staffOnly`, während Gäste nur die bemalte Kante
nicht queren.
`festival.ts` begrenzt das Oberteil-Ereignis auf eine Person;
`pixelPeople.ts` prüft Brustgeometrie ohne farbige Brustwarzen.
`festivalAdditions.ts` prüft 400 Vorfälle in einem Müll-Batch, unveränderte
Stückzahlen, Transformationen und Farben, Kapazitätswiederverwendung sowie
höchstens vier Batches für alle Vorfallarten und Ressourcenfreigabe.
`campingModels.ts` prüft persistente GPU-Batches, Farb-/Positionsänderungen,
Wachstum und Freigabe alter Instanzpuffer. `performanceGuards.ts` deckt 100
gleichzeitige Abreisen, faire Bearbeitung, direkte Müll-Callbacks, Müll-Erhaltung,
sofortige Zustandswechsel, ausstehendes Abbauen am Ausgang und Wiederladen ab.
Verbotene Wegziele werden ohne Graphsuche abgelehnt; Personalzugang bleibt erhalten.
`performance.ts` gibt SHA256 des Endzustands aus. `PROFILE_METHODS=1` ergänzt
inklusive Methodenzeiten und die acht langsamsten Ticks mit Spielzeit/Population;
Profiling-Uhren beeinflussen niemals die Simulation.
`stageInteraction.ts` prüft endliche Vertices sämtlicher Bühnenteile in allen
sechs Ausrichtungen sowie alte 2D-Designs ohne Höhen und deren Bounding-Spheres.

- Strukturelle Bounds in Tests halten (Determinismus). Keine FPS-Schwellen
  in CI (Hardware variiert).
- Identische Fixtures vergleichen. CPU-Tick ≠ Browser-FPS.
- 8×-Langläufe können den Park leeren; das ist kein CPU-Gewinn.
- Neue regressionskritische Invariante: Guard in `performanceGuards.ts`
  oder fachliche Suite, dann Zeile in dieser Tabelle.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn ein Testfile, ein npm-Script oder eine Preview-HTML
dazukommt oder der Einstieg `tests/regression.ts` andere Module lädt.

## Deko-Baugrößen und Wände

`tests/decoration.ts`: 23 Vollfeld-Arten inklusive Save-Roundtrip/Kollision,
40 Wandarten mit exakten Geometriehöhen, nahtloser Stapelung, Eckverbindung,
Doppelbelegung derselben Kante vom Nachbarfeld, Fassaden und Host-Platzierung.
`tests/decoration-preview.html`: visuelle Themenauswahl, reale Baugrößen,
vier Wandformen und zweigeschossige Ecke (über Vite öffnen).

## Baukomfort (0.1.126)

`placementPreview.ts`: absolute 48-Pixel-Höhenänderung, Totzone, Rückbewegung
und aufgerundete Objektoberkante. `decoration.ts`: alle Dachtypen, Höhenbounds,
Wandkontakt, Dachkollision/Save sowie Themen-Eimer, Wegkante, Trennung von Bank,
Füllstand-Roundtrip und begehbarer Weg. Vollständige Müll-/Reinigungsregressionen
bleiben aktiv. `construction-preview.html`: echte WorldView-Interaktion und
Stützenfreiheit erhöhter Wände/Dächer; isolierte Welt ohne Save-Zugriff.

`src/game/contextDemolition.ts` wählt Abrissziele nach Baumodus, Building-ID
und Straßenlage. `tests/decoration.ts` prüft Deko-/Wegtrennung und den Erhalt
der unteren Straßenlage beim Entfernen einer oberen.

## Weg- und Brückendetails

`tests/wayStructures.ts` (regression.ts): Rampen in vier Richtungen mit
−1/−0,5/0/0,5/1 Steigung; Stützen unter lokaler Fahrbahn, untere Querungen
frei, verbundene Kanten offen, hohes Gelände ohne unnötige Geländer,
endliche Vertices und Geometrie-/Instanzteilung für 200 gleiche Abschnitte.
`tests/ways-preview.html`: echte WorldView-Ansicht mit Fußweg-/Straßenbrücke,
Rampen, Abzweig und unterer Weglage. Keine persönlichen Spielstände.

## Dachwände

`tests/decoration.ts` prüft die erweiterten WALL_KINDS mit Bounds,
Konturgrenze aller Vertices, Kantenstapelung, Dach-Koexistenz und Save-Roundtrip.
Die Modellübersicht zeigt ein Schrägdach mit beiden Keilen und Stirnabschluss.

## Fassadeneinblick

`tests/facadeReveal.ts` prüft zeitliches Ein-/Ausblenden, Rückkehr zu opaker
Tiefenschreibung, geglättete Positionswechsel und unabhängige Ansichten.
Visuell: in `tests/construction-preview.html` über Dach/Wände fahren und dann
auf freie Fläche; lokale Transparenz und Wiederherstellung kontrollieren.

`tests/facadeReveal.ts` prüft außerdem lokales Durchklicken, solide entfernte
Fassaden und das sofortige Zurücksetzen beim Wechsel in den Deko-Baumodus.

`tests/decoration.ts` prüft die mit **R** gewählte freie Eimerkante und eine
Bank auf einer Straßenkante mit freier Fortsetzung.
