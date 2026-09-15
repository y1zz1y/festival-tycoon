# Tests und Prüfkommandos

Vor Abschluss von Simulations- oder Render-Änderungen: `npm test` und
`npm run build`. Performance-Arbeit zusätzlich wie in `docs/performance.md`.

## Kommandos

| Kommando | Zweck |
| --- | --- |
| `npm test` | gesamte Suite über `scripts/test.mjs` / `tests/regression.ts` |
| `npm run build` | `tsc` + Vite-Produktion |
| `npm run test:performance -- rtest3 120` | CPU-Ticks, 1×/3×/8× |
| `npm run test:performance -- rtest3 1200` | langer Lauf (Festival kann enden) |
| `npm run test:install` | PWA/Homescreen-Artefakte |
| `$env:PROFILE_METHODS='1'` | inklusive Methodenzeiten (PowerShell) |

## Welche Datei prüft was

| Datei | Inhalt |
| --- | --- |
| `tests/regression.ts` | Orchestrierung, Tick-Partition, Multiplayer-Sockets, Saves, Abreise durch Camping-Ausweisungen nach Festivalende |
| `tests/performanceGuards.ts` | Budgets, Multi-Goal-Camp, Cache, Batches, Lights, Achterbahnwagen, Logistik-Modelle |
| `tests/festival.ts` | Wochenendablauf, Buchung, Lager, Ruf |
| `tests/visitorSleep.ts` | Festival-Schlafzeiten, Legacy-Remap, zirkadiane Energie, Zelt- und Abreiseziele |
| `tests/festivalAdditions.ts` | spätere Festival-Systeme, Eimer-Karton-Batches, zusammenhängende Müllablage-Füllstände, Müllwagen-Ladungsanzeige, 1-Feld-Steigungen, Wagen-Mesh, gerundete Schienenjoins, Achterbahn-Komplettabriss |
| `tests/ticker.ts` | Müllwagen 90, Ablage 180, kein Overflow, Ticker >90 % / Feuer / Panik, keine Verletztenmeldung für Insassen |
| `tests/musicPlanning.ts` | Spielplan, Genres |
| `tests/stageTickets.ts` | Tickets, Bühnenfläche |
| `tests/stageInteraction.ts` | Werkstatt / Interaktion |
| `tests/supplyChain.ts` | Waren, Umwege, Ground, Mindestbestand in 20er-Schritten |
| `tests/operations.ts` | Betrieb, Personal, Alltag, Saugroboter durch Personaleingang, Einsatzgebiete, Reinigung leert volle Eimer zuerst und idle auch halbvolle, Verletzte an den nächsten freien Sanitäter / Krankenwagen (ohne Insassen im Auto), Müllwagen-Erhalt / Wiedereinfahrt, Queue-Kette / Rückweg / leerer Stand / Stand-Spuren, Nachschub von allen Seiten und Verkauf nur vorne, Parkplatz-Aussteigen auf Nachbarweg (bleiben ausgestiegen, laufen ohne Bucht-Jitter zum Ziel), Abreise nur im eigenen Anreiseauto (3/3 setzt rückwärts aus der Bucht und verlässt die Karte; 5er/6er-Gruppe vollständig; tote/fremde IDs und Verletzte), Insassen erst nach dem Aussteigen verletzbar / belegend, Parkplatz- und Krankenfeld-Abriss inkl. Restbelegung, Debug Autos entfernen löscht Wagen und gibt Belegung frei, Gäste lassen Müll fallen wenn der nächste Eimer voll ist und benutzen leere Eimer weiter |
| `tests/staffZones.ts` | 3×3-Einsatzgebiete: Ziehen weist zwei Blöcke zu, Start auf aktivem Block entfernt, `setStaffZone` flackert nicht, Saugroboter dieselbe Farbe |
| `tests/queueLanes.ts` | Hälftige Stand-Queue-Geometrie, Spurwahl, keine Attraktionsänderung |
| `tests/shopGoods.ts` | Allgemeine Waren, Maskottchen-Kauf/Hand-Chance, Shirt-Farbe/Schnitt, Save-Defaults |
| `tests/accessControl.ts` | Ampeln, Tore, Sensoren, Einweg, Notfallöffnung, Halt vor Rot, opportunistisches Parken, Trennlinie, Liefer-/Müllwagen-Umweg, Tageszeit / Festivalphase / Zeitplan |
| `tests/rideAccess.ts` | Tore, Queues, Bungee/Karussell |
| `tests/scenery.ts` | Deko-Slots, Kanten-Fahnen, Tageslichtballon als Vollfeld, neue Arten, Attraktivität je Kind, Stapel/Reichweite, unbekannte Katalog-Arten |
| `tests/picking.ts` | Abriss-Raycast: Instanz-IDs, getroffenes Mesh vs. Nachbar/Kachelmitte, Reittor-Zelle |
| `tests/buildMenu.ts` | Jedes platzierbare Tool außer `inspect` genau einmal im Baumenü; Deko/Attraktionen/Logistik als Katalog; Camping- und Krankenhaus-Tabs; Bauhöhe bleibt beim gleichen Tool und fällt bei neuem `setTool` auf 0 |
| `tests/placementPreview.ts` | Bauhöhe rastet auf 0.5; Vorschau meldet die Bodenkachel (`y` = Gelände, nicht Ghost-Höhe) |
| `tests/terrainSurface.ts` | Gelände-Mesh, Pads, Parkplatz-Asphalt nur auf Parkfeldern |
| `tests/environments.ts` | Umgebungen |
| `tests/wayElevation.ts` | Halbstufen-Rampen für Fußweg und Straße, Autodach 1.0, Legacy-Höhe 1 bleibt 1.0, Shift-Ausgang bleibt beim Rampenstreichen, Fußweg auf Autostraße behält die Straße, gestapelte Autostraße / Brücke, ein Straßenfeld übermalen löscht keine Nachbarn |
| `tests/pixelPeople.ts` | Personen-Batches |
| `tests/carrierModels.ts` | Träger: geteilte Gästeteile, Warnweste, Karren |
| `tests/campingModels.ts` | Zelt-/Pavillon-Batches |
| `tests/mobileTouch.ts` | Touch-Kamera / Gesten |
| `tests/performance.ts` | synthetische Last |
| `tests/people-preview.html` | visuelle Personen-Fixture |
| `tests/carrier-preview.html` | visuelle Träger neben Gästen |
| `tests/camping-preview.html` | visuelle Camping-Fixture |
| `tests/access-preview.html` | visuelle Tor-Modelle |
| `tests/coaster-car-preview.html` | visuelle Achterbahnwagen |
| `tests/render-performance.html` | Browser-Framezeiten |

## Wichtige Regeln

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
Saugroboter durch `staffOnly` bei weiter blockierten Gästen.
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
