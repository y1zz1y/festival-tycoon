# Attraktionen: Achterbahn, Karussell, Bungee

Achterbahnen sind eigene Snapshot-Objekte (`coasters`). Karussell (`ride`) und
Bungee sind Gebäude mit optionalem `rideEntrance` / `rideExit`. Warteschlangen
sind gerichtete Wege (`pathType: 'queue'`).

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Schienen, Physik, Betrieb | `src/game/coasters.ts` | `TRACK_PIECE_KINDS`, Zug, Dispatch, `getSmoothedCoasterPiecePoints` |
| Bauen, Recall, Preis, Abriss | `src/game/GameState.ts` | `startCoaster`, `recallCoasterTrain`, `setRideAccess`, `removeCoaster` |
| Queue-Richtung | `src/game/pathFlow.ts` | `allowsPathFlow` |
| Balancing / SI-Physik | `src/game/simulationConfig.ts` | `coasters`, `classicSteel.physics`, `physicsSimulation`, `trackJoinSmoothing` |
| Spezialstücke visuell | `src/view/coasterSpecials.ts` | Loop, Photo, Splash |
| Wagen | `src/view/coasterCars.ts` | ein gemergtes Mesh, geteilte Geometrie |
| Bungee-Darstellung | `src/view/bungee.ts` | ein Rider, ein Seil |
| Zugangstore | `src/view/attractionAccess.ts` | sechs geteilte Meshes |
| Preview | `tests/access-preview.html` | |
| Baumenü | `src/game/buildMenu.ts`, `src/main.ts`, `src/style.css` | Attraktionen: Fahrgeschäfte, Stände, Camping, Festival; RCT2-artiges sequenzielles Konstruktionsfenster |

## Wichtige Regeln

- Segmentlängen und Frames **pro Bahn cachen**, invalidieren über
  Piece-ID/Chain-Signatur. Nicht alle Sample-Punkte pro Wagen/Substep neu
  scannen.
- Schienenübergänge werden **zur Mesh-/Pfad-Ableitung** geglättet
  (`trackJoinSmoothing` in `simulationConfig`): horizontale Kurven bleiben
  ein Viertelkreis in der Draufsicht (mehr Samples, kein Gaussian auf X/Z,
  kein Fillet in die Kurve). Neigungsstöße glättet ein Bogenlängen-Gaussian
  (`sigma` 0.28 Kacheln) plus ein kurzes Fillet nur bei fast gleicher
  Heading. Snapshot-`points` bleiben unverändert; alte Saves runden sich
  beim Laden. Mesh und `sampleCoasterTrack` teilen denselben Cache.
  Stationen und Loops bleiben ungefillet. Keine neuen Snapshot-Felder.
- Legacy-Fahrgeschäfte ohne Tore bleiben geschlossen, bis Eingang und Ausgang
  gesetzt und verbunden sind.
- Eingangsqueues nutzen dieselbe gerichtete Traversierung wie Coaster.
  Fehlender Ausgang verzögert die Freigabe, ohne erneut abzukassieren.
  Attraktionsqueues bleiben **eine** volle Spur; die hälftige
  Ansteh-/Zurückspur gilt nur für Stand-Queues (`docs/visitors.md`).
- Queue-Kacheln bilden eine **Kette in Bau-Reihenfolge**. Nebeneinander
  liegende Segmente einer Serpentine werden nicht als Abkürzung verbunden.
- Gäste dürfen eine Schlange nur vorwärts (anstehen) oder rückwärts
  (verlassen, nach dem Kauf) entlang dieser Kette begehen. Seitliche
  Sprünge auf Nachbar-Queue-Kacheln sind Navigationstopologie, keine
  bloße Einbahn-Einschränkung.
- Gäste, die den Achterbahneingang bereits erreicht haben, stehen vor noch
  anlaufenden Reservierungen. Freie Plätze lösen deshalb sofortiges,
  kontinuierliches Nachrücken aus und keine gruppenweise Freigabe.
- Gate-Edits invalidieren Spatial-Index und Navigation.
- Vollständiger Abriss (`removeCoaster` / Command `removeCoaster`) entfernt
  Schiene, Station, Zug, Ein-/Ausgang und die angeschlossene
  Eingangsqueue. Fahrgäste und Anstehende werden zuerst wie beim Recall
  ausgeladen bzw. freigegeben. Refund wie bei Gebäuden
  (`demolitionRefundRate`). Queue- und Stationswechsel invalidieren
  Navigation über `emit()` / `worldRevision`. Das Infofenster und der
  Konstruktionseditor bieten **Achterbahn abreißen**; Abriss auf einer
  Stations- oder Zugangs-Kachel ruft dieselbe Methode auf. Das Infofenster
  schließt danach.
- Photo-Käufe und Brems-/Wasserwiderstand laufen im Tick, nicht im Render.
- Bungee: ein statisches Mesh, ein Rider, ein Seil, ein aktiver Besucher.
  Visuals aus dem autoritativen Interaktions-Timer.
- Loops behalten eine feste Referenz-Heading durch vertikale Tangenten.
- Steigungsstücke (sanft und steil) belegen **ein** Feld und werden direkt aus
  der Station gesetzt. Halbe Höhenstufen (`0.5`) sind für sanfte Stücke zulässig.
  Die Startplattform nutzt dieselbe Bauhöhe (`buildElevation`, Snap 0.5).
- Das Konstruktionsfenster folgt dem RCT2-Ablauf: Richtung/Kurvenradius,
  „Speziell …“, Neigung, Rollen/seitliches Kippen, große Vorschau mit Kosten,
  Rückbau/Bauen und Eingang/Ausgang. Nicht anschließbare Teile sind deaktiviert.
  Richtungs-, Neigungs- und Banking-Wahl erzeugen weiterhin autoritative
  `TrackPiece`s; Kettenliftkosten werden in der Vorschau eingerechnet.
- Sonderstücke stehen nur bei passender waagerechter, ungekippten
  Anschlussgeometrie zur Verfügung. Stationen benötigen ebenfalls einen
  waagerechten und neutralen Anschluss. Kurven müssen zur Banking-Richtung passen.
- Die lange 4-Felder-Rundung (`pitchTransition`) gilt nur für **flach ↔ steil**.
  Jeder Wechsel der Neigung nutzt ein `pitchTransition`: benachbarte Stufen
  (flach↔sanft, sanft↔steil) bleiben ein Feld, insbesondere endet
  sanft↔flach tatsächlich mit Neigung `0`. Erst das danach gebaute Stück ist
  wieder ein konstantes gerades bzw. geneigtes Stück.
- Ketten- und Stationsgeschwindigkeiten stehen in
  `SIMULATION_CONFIG.coasters.classicSteel.physics` bzw. `physicsSimulation`.
- Wagen: ein gemergtes Vertex-Color-Mesh, Geometrie pro Wagenfarbe gecacht.
  Fahrgäste bleiben eigene Kinder für Sichtbarkeit und Shirtfarbe.

## Tests

`tests/rideAccess.ts` (beide Ride-Typen, Queues, Saves, Multiplayer).
`tests/operations.ts` (Serpentinen-Kette, Rückweg, leerer Stand).
`tests/festivalAdditions.ts` (1-Feld-Steigungen, flach↔steil-Übergang, Wagen-Mesh, Schienenjoin-Rundung / Pfadkontinuität, vollständiger Abriss inkl. Queue und Command).
`tests/performanceGuards.ts` (Specials, eine Photo-Abrechnung, Bungee-Exklusivität, Wagen-Batch).

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Track-Kinds, Dispatch-Modi, Gate-Regeln, Join-Glättung,
Physik-Caches oder Abriss ändern. Neue Attraktionsgebäude auch in
`docs/buildings.md`.
