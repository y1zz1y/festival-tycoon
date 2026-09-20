# Mehrspieler

Der **Host** simuliert. Clients schicken `GameCommand`s (inkl. Bauhöhe und
Drehung) und empfangen periodische Weltdeltas. Alle Teilnehmer brauchen
dieselbe Spielversion. Es gibt keine automatische Host-Übernahme.

## Raumleben

Hosten hat kein Zeitlimit. Ein Raum lebt, bis der Host ihn beendet — das heißt:
bis eine `leave`-Nachricht kommt. Ein geschlossener Socket ist kein Ende,
sondern ein Aussetzer.

- **Der Code gehört dem Spielstand.** `multiplayerCode` liegt im Snapshot; beim
  Hosten schickt der Client ihn mit (`host.code`) und der Server nimmt ihn, wenn
  er frei ist. Belegt oder unbrauchbar → neuer Code, und der Client stempelt
  zurück, was er bekommen hat. Ein Spielstand, der in einen laufenden Raum
  geladen wird, übernimmt dessen Code, nicht umgekehrt — mitten in der Sitzung
  lässt sich der Code nicht wechseln.
- **Eigenen Raum zurückholen:** Steht unter dem gewünschten Code noch ein Raum
  *ohne* Host, übernimmt der Hostende ihn samt wartender Gäste, statt einen
  neuen Code zu bekommen. Ohne das schlagen sich die beiden Zusagen: Der Raum
  überlebt den Abriss, also fände derselbe Spielstand beim erneuten Hosten
  seinen eigenen Code belegt. Ein Raum mit anwesendem Host wird nie übernommen.
- **Öffentlich oder privat:** Beim Hosten entscheidet eine Checkbox, ob der Raum
  auf die Liste kommt (`host.public`, gemerkt unter `festival-mp-public`). Nur
  öffentliche Räume stehen in der Antwort auf `lobbies` — mit Hostname,
  Spielerzahl und ob der Host gerade weg ist. Ein privater Raum ist
  ausschließlich über seinen Code erreichbar. Beim Zurückholen des eigenen Raums
  gilt die Checkbox erneut, der Host kann die Sichtbarkeit also ändern.
- **Liste lesen ohne Beitritt:** `lobbies` beantwortet der Server auch einem
  Socket, der noch in keinem Raum ist — der Titlescreen braucht die Liste, bevor
  es eine Session gibt. `src/net/lobbies.ts` öffnet dafür eine eigene kurze
  Verbindung und gibt bei Fehlern eine leere Liste zurück, damit das Codefeld
  weiter nutzbar bleibt.
- **Wachbleiben:** Solange eine Sitzung steht, hält der sichtbare Tab einen
  Screen Wake Lock (`src/ui/wakeLock.ts`, Einstellung „Im Mehrspieler
  Bildschirm wachhalten"). Grund ist der Host: Sein Rechner rechnet die Welt,
  Bildschirm aus heißt meist kurz darauf Suspend, und ein schlafender Host ist
  ein Raum, der auf jemanden wartet. Der Browser gibt den Lock beim Verbergen
  der Seite selbst wieder frei — das schützt also den Tab, der auf dem Schirm
  ist, und sonst nichts. Ein verborgener Tab braucht es auch kaum: Ping und
  Pong beantwortet der Netzwerk-Stack des Browsers, nicht JavaScript, eine
  gedrosselte Seite hält die Verbindung also von allein. Fehlt die API
  (Firefox) oder wird sie verweigert, passiert nichts weiter.
- **Live-Chat und Map-Ping:** Ephemere UI-Ereignisse, kein `GameCommand` und
  kein Snapshot-Feld. Client sendet `{ t: 'chat', text, ping? }`; der Server
  säubert Text (max. 200 Zeichen) und Ping-Koordinaten und broadcastet
  `{ t: 'chat', id, from, name, text, ping? }` an alle Sitze im Raum
  (inkl. Absender). Steuerung: **Enter** öffnet/fokussiert die Eingabe
  (Weg-Stückbau behält Enter solange der Pfadeditor aktiv ist); **Esc**
  schließt die Eingabe. Das Log liegt unten links, transparent und
  scrollbar. Unter Mehrspieler → **Chat anzeigen** (`localStorage`
  `festival-mp-chat-display`) blendet nur HUD/Log aus — Senden bleibt
  möglich. Bei offener Eingabe aktiviert der Ping-Button einen Kartenmarker;
  Absenden (auch leere Nachricht) schickt den Ping mit. Position: Cursor-
  Weltpunkt auf dem Terrain, sonst Kamera-Look-at / Walk-Position. Marker
  und Randpfeil (außerhalb des sichtbaren Bereichs) leben 10 Sekunden auf
  allen Clients; im Log springt das 📍-Icon die Kamera zum Punkt
  (`WorldView.focusWorldPosition`).
- **Rückkehr zum Tab:** `MultiplayerSession.retryNow` wählt beim Sichtbarwerden
  sofort nach, statt den Backoff von bis zu 15 s abzuwarten.
- **Keepalive:** Der Server pingt alle 25 s und trennt Sockets, die die vorige
  Runde nicht beantwortet haben. Browser antworten selbst, der Client braucht
  dafür nichts. Ohne das schlief eine Verbindung ein, sobald ein Host allein im
  Raum wartete und gar nichts sendete — Router und Proxys warfen sie als untätig
  weg, und der Raum starb mit ihr.
- **Host weg:** Der Raum bleibt, `hostAwaySince` wird gesetzt, Gäste behalten
  ihre Welt und bekommen `players` mit `hostAway: true`. Bauen geht erst wieder,
  wenn der Host zurück ist.
- **Zurückkommen:** `resume` (`code`, `playerId`, `name`) holt den Host auf
  seinen alten Sitz, sodass Gäste weiter über ihn laufen. Jeder andere wird wie
  ein neuer Beitritt behandelt. Der Client wählt selbst nach, mit Backoff bis
  15 s und ohne Versuchsgrenze.
- **Aufräumen:** Nur ein Raum, in dem niemand mehr sitzt und dessen Host seit
  30 Minuten weg ist, wird verworfen. Das ist ein Sicherheitsnetz gegen
  liegengebliebene Codes, keine Sitzungsdauer.

## Docker-Laufzeit

Das Produktions-Image (`Dockerfile`, final stage) kopiert nur `server/` und
`dist/` — **kein** `src/`. Node startet mit
`--experimental-strip-types server/serve.ts`.

Bei jeder Server- oder Shared-Änderung prüfen:

1. Jede Datei, die der Server zur **Laufzeit** lädt, muss im Image landen
   (`server/` oder bereits in `dist/`).
2. **Keine Value-Imports** von `server/` → `src/…` (Modul fehlt im Container).
3. `import type` aus `src/` ist ok (wird weggestrippt).
4. Shared Laufzeit-Logik (Sanitize, Konstanten): unter `server/` halten;
   Client re-exportiert bei Bedarf (Beispiel: `server/chatProtocol.ts` →
   `src/net/chatProtocol.ts`).

Lokal mit Vite kann ein `server/`→`src/`-Import unbemerkt laufen; im Image
bricht er erst beim Start oder ersten Request.

## Übers Internet spielen

Der Spielzustand läuft ausschließlich über eine WebSocket auf `/ws`. Der Client
wählt das Schema aus der Seite: HTTPS-Seite → `wss:`, sonst `ws:`. Es gibt
keinen Polling-Fallback, und es soll auch keinen geben.

Der Produktionsserver (`server/serve.ts`) lauscht auf `HOST`/`PORT`
(Standard `0.0.0.0:8080`). Vor dem Server steht in der Regel ein Reverse Proxy mit
TLS — und genau dort scheitert es, wenn der Upgrade nicht durchgereicht wird:

```nginx
location /ws {
  proxy_pass http://127.0.0.1:8080;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_read_timeout 120s;   # der Server pingt alle 25 s, das reicht darunter
}
```

Unter IIS braucht es das Feature „WebSocket Protocol“ **und** in der ARR-Regel
`<webSocket enabled="true" />`; ohne beides bricht der Upgrade mit 400 ab.

`PUBLIC_HOST` setzen, z. B. `PUBLIC_HOST=https://headliner-tycoon.com`. Der
Wert ist nur der Rückfall für den Einladungslink, wenn der Host auf derselben
Maschine spielt, die das Spiel ausliefert — sonst nimmt der Client die Adresse,
über die sein eigener Browser den Server erreicht hat (`inviteLink` in
`src/net/lobbies.ts`). Die kennt der Server hinter einem Proxy nicht.

Was auf einem offen erreichbaren Server sonst noch gilt:

- Spielernamen sind fremder Text in fremden Fenstern. Der Server kürzt sie auf
  24 Zeichen und wirft Steuerzeichen raus; die Anzeige escaped sie.
- `MAX_ROOMS` (Standard 200) deckelt die Räume. Ist es voll, wird erst
  aufgeräumt und dann abgelehnt.
- Wer den Code hat, kommt rein und darf bauen. Das ist das ganze Rechtemodell —
  ein privater Raum ist so privat wie sein Code.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Befehls- und Nachrichtentypen | `src/net/protocol.ts` | `GameCommand`, World/Sim-Snapshots |
| Vollständige Command-Metadaten | `src/net/commandRegistry.ts` | `COMMAND_METADATA`, `isOptimisticCommand` |
| Command → `GameState` | `src/net/commands.ts` | `applyGameCommand` |
| Kompakte Pakete | `src/net/codec.ts` | `packWorld` |
| Deltas, Ankunft/Abreise | `src/net/worldUpdates.ts` | `WorldUpdates`, `applyWorld` |
| Client-Session | `src/net/session.ts` | `MultiplayerSession` |
| Lobby-Liste ohne Session | `src/net/lobbies.ts` | `fetchLobbies`, `multiplayerSocketUrl` |
| Beitreten vom Titlescreen | `src/ui/titleScreen.ts` | `openTitleLobbies`, `joinLobby` |
| UI-Bindung | `src/net/bind.ts` | `enableMultiplayerCommands` |
| Live-Chat / Map-Ping | `server/chatProtocol.ts`, `src/net/chatProtocol.ts`, `src/ui/multiplayerChat.ts`, `src/net/session.ts` | Sanitize/Relay in `server/`; Client re-exportiert + UI-Helfer; Enter öffnet Eingabe; Ping TTL 10 s |
| Host-Turns, Optimistic | `src/game/GameState.ts` | `gate`, `receiveTurn`, `applyNetworkWorld` |
| Server-Räume | `server/rooms.ts` | `attachMultiplayer` |
| WebSocket-Plugin | `server/wsPlugin.ts` | Kompression, Puffergrenze |

`commandRegistry.ts` klassifiziert jeden `GameCommand` genau einmal als
optimistic oder host-bestätigt; `satisfies Record<GameCommand['type'], ...>`
erzwingt TypeScript-Vollständigkeit. Festival-Unteraktionen behalten ihre
separate optimistic Allowlist. `commands.ts` hat zusätzlich einen
exhaustiven `never`-Zweig, sodass ein neuer Union-Fall ohne Anwendung nicht
baut. Wire-Namen, Payloads und die `GameCommand`-Union bleiben unverändert.

Platzierung, Abriss und Schienenbau delegieren intern aus den bestehenden
`GameState`-Methoden an `src/game/commands/*`. `applyGameCommand`,
`enableMultiplayerCommands`, Command-Namen, Payloads und Optimistic-Einstufung
bleiben unverändert; die Services kennen keinen konkreten `GameState`.

## Wichtige Regeln

- Docker: Server-Laufzeitdateien nur unter `server/` (oder in `dist/`); keine
  Value-Imports `server/` → `src/`. Details: Abschnitt „Docker-Laufzeit“.
- Neue spielerseitige Aktion: `GameCommand` in `protocol.ts`, Zweig in
  `commands.ts`, autoritative Methode in `GameState`, ggf. Optimistic-Flags.
  Gemeinsame Attraktionen verwenden `startAttraction`,
  `constructAttraction` (derselbe Resolver wie die Vorschau),
  `removeAttraction`, `setAttractionOperation`, `setAttractionPrice` und
  `configureAttraction`. `constructAttraction` trägt die diskriminierte
  Änderung für Kante, offenes Ende, Fläche, Referenz, Zugang oder
  Scripted-Segment. Bau/Abriss/Zugang sind optimistic; Betrieb, Preis und
  Einstellungen werden vom Host bestätigt. `commandRegistry.ts`,
  `commands.ts` und `bind.ts` behandeln alle Varianten exhaustiv.
- Neue persistente Weltfelder: Codec / `worldUpdates` und Join-Vollsync.
  Bühnenvorlagen und platzierte Bühnen übertragen ab v33 optional
  `StageDesign.forecourtDepth` (1–24). Der vorhandene
  `manageFestival.stageDesign`-Command transportiert das gesamte Design;
  ältere Designs ohne Wert bleiben bei zwei Bühnenbreiten.
  Camping- und Vorplatzänderungen laufen über
  `designateCampingCell` / `designateCampingArea` /
  `designateStageForecourt` (optimistic) und die Snapshot-Felder
  `campingCells`, `campInstallations`, `stageForecourtCells`. Ein
  Attraction-Delta darf diese Overlay-Arrays auf dem Client nicht
  verwerfen; Host und Client ziehen die `camping`-/`partyArea`-
  Datensätze nur nach.
  Fahrzeugpositionen und Routen behalten das bestehende optionale
  `RoadPosition.elevation` auch beim Laden/Normalisieren. Der Host berechnet
  Straßenbelegung und Vorfahrt pro Ebene; keine zusätzlichen Commands oder
  Snapshot-Felder für Überführungen.
  Lieferwagen liegen in `logistics.roadVehicles` (`deliveryTruck` /
  `deliveryId`) und weiter in `festival.infrastructure.trucks`.
  Ampeln/Schranken: `placeTrafficLight`, `placePathBarrier`,
  `configureAccessControl`, `toggleAccessControlArea`,
  `clearAccessControlArea`; Snapshot-Feld `accessControls`.
  `configureAccessControl` darf `scheduleTime`, `scheduleHours`,
  `scheduleOffer` und `schedulePhases` mitsenden.
  Ticketpreise: `entryPrice` (Tag) und `campingTicketPrice` (Camping);
  Commands `updateEntryPrice` und `updateCampingTicketPrice`.
  Nachfrage-Debug: `updateDemandTuning` sendet alle Koeffizienten atomar,
  ist nicht-optimistisch und wird vom Host normalisiert; Snapshot-Feld
  `festival.demandTuning`.
  Feuerwehrwagen: `buyFireTruck` (`stationId`).
  Die älteren Kurs-Projektionspfade nutzen noch `startCourseArea`, `addCourseAreaCells` und
  `removeCourseAreaCells` übertragen eine komplette Flächenauswahl atomar;
  außerdem `startCourse`, das kompatible `addCourseAreaCell`,
  `addCoursePiece` (optional `elevation`), `undoCoursePiece`,
  `setCourseOperating`, `setCoursePrice`,
  `setCourseTeamSize`, `removeCourse`; Snapshot-Feld `courses`.
  Festival-Action `autoLineup` darf `minStars` / `maxStars` mitsenden.
  T-Shirt-Stand: `configureShirtStall` (`color`, `style`). Gäste-Felder
  `ownedMascot`, `heldMascot`, `wornShirt` liegen im PackedVisitor.
  Personalzonen: `toggleStaffZone`, `setStaffZone` (`active` an/aus für
  genau einen 3×3-Schlüssel) und `fireStaffMember` (auch für Saugroboter
  anhand der Fahrzeug-ID). Ziehen sendet idempotente `setStaffZone`-Schritte
  statt Toggle, damit der gesperrte Malmodus nicht flackert. `workZones` liegt
  am Staff-Mitglied bzw. am Saugroboter in `logistics.roadVehicles` und kommt
  über Sim-Pakete.
  `queueSplit` an Queue-Wegen ist kein Command, sondern Host-seitig
  abgeleitet wie `queueDirection` und kommt mit dem Gebäude-Snapshot.
  Der Vorfall-Ticker wird auf jedem Client aus `incidents`, Panik-Gästen
  und `wasteDumpCells` abgeleitet; kein `GameCommand` und kein extra
  Snapshot-Feld. Das HEADLINE Magazin ebenso: jeder Client ruft
  `buildHeadlineMagazine` auf dem Host-Snapshot auf (gleiche Zahlen,
  gleicher Text). Kein Command, kein Recap-Feld.
  Festival-Action `staffGate` darf `direction` (Baurichtung, Kante) mitsenden;
  fehlend gilt 0. Alte Clients ohne Feld bleiben gültig.
  `editTerrain` darf optionales `corner` (0–3) und `originHeight` mitsenden;
  `mode` kann weiter `raiseCorner` / `lowerCorner` / `water` / `smooth` /
  `flatten` sein (UI zeigt nur raise/lower/smooth). Flächen gehen über
  `editTerrainArea` (`cells`, `mode`, optionales `originHeight` für Glätten).
  Snapshot `waterLevel` und optionale `terrain.corners` kommen mit der Welt.
  `placePath.slope` ist eine Zahl (neu ±0.5, Legacy ±1). Neue Commands
  `placeRoad` und `undoRoad` setzen Straßenrampen host-autoritativ.
  `undoRoad` darf optionales `elevation` mitsenden, damit nur eine Lage
  einer gestapelten Autostraße zurückgenommen wird.
  `removeCoaster` (`coasterId`) reißt Schiene, Station, Zug, Tore und die
  angeschlossene Eingangsqueue host-autoritativ ab; optimistic wie die
  übrigen Coaster-Baucommands. Die Nachfrage „wirklich abreißen?“ läuft
  nur lokal in der UI (`src/ui/confirmDialog.ts`) und ändert Command,
  Payload oder Host-Prüfung nicht. Dasselbe gilt für `removeCourse`.
  Backstage: `designateBackstageArea` (`cells`, optionales `enabled` zum
  Löschen) ist optimistic wie Vorplatz/Müllablage. Snapshot:
  `backstageCells`, `bandActors` (`memberIndex`, `role`, `costumeId`),
  `bandSupply` (`components`,
  `showQualityByStageId`, `activeKeys`). `RoadVehicle.kind` kann `tourBus`
  sein (Ziel `tourBusParking` / `reservedParkingId`). `tourBusParking` ist
  ein Gebäude-`kind`. Optionale Besucherfelder `backstageIntrusion` /
  `backstageLingerMinutes`. Alte Clients ohne diese Felder bleiben gültig
  (leere Arrays / Bare-Stage).
  `RoadVehicle.target.kind` kann `sealedWasteContainer` sein (`buildingId`,
  x, z). Gebäude-`kind` `sealedWasteContainer` nutzt bestehendes `place`
  und `wasteFill`. Unbekanntes Ziel wird beim Normalisieren verworfen.
  Krankenwagen: `sellAmbulance` (`garageId`) und `sellAmbulanceVehicle`
  (`vehicleId`). Optionales `RoadVehicle.pendingSale` kommt mit den
  Sim-Paketen; fehlend gilt als nicht zum Verkauf. Buslinien:
  `addBusToLine` (`lineId`) kauft/weist einen Bus zu; `setBusLineStops`
  (`lineId`, `stopIds`) ändert nur die Reihenfolge. `busIds` / `stopIds`
  bleiben bestehende Snapshot-Felder.
  `startCoaster.typeId` ist jeder Katalogtyp (`CoasterTypeId`). Unbekannte
  IDs löst der Host zu `classicSteel` auf. Snapshot-`coaster.typeId` kommt
  mit den Sim-Paketen; kein neues Command.
  `stampBlueprint` (`originX`, `originZ`, `rotation`, `items`) stempelt eine
  lokale Vorlage host-autoritativ (optimistic wie `place`). `items` dürfen
  Gebäude, Straßen und Parkplätze (`type: 'parking'`) enthalten; unbekannte
  `kind`-Werte werden verworfen. Die Bibliothek liegt nur im Client-Browser,
  nicht im Snapshot. Alte Clients ohne das Command bleiben gültig.
  `undoLastBuild` nimmt den letzten Bau auf dem Host-Stack zurück (nicht
  optimistic, nicht im Spielstand). Derselbe Stack zeichnet `place`,
  `placePath`/`placeRoad`, `designateParking`, `stampBlueprint`,
  `placeSceneryLine` und Flächen-Wege auf. Spezielle Stück-Undos
  (`undoPath`, `undoRoad`, `undoCoasterPiece`, `undoCoursePiece`) bleiben.
- Clients dürfen Construction optimistic zeigen, aber der Host bleibt
  maßgeblich (`resolveOptimisticCommand`, Reconciliation).
- Besucher feldweise updaten; unveränderte Bereiche nicht erneut senden.
  Fließkommafelder gehen gerundet über die Leitung (`WIRE_DIGITS` und
  `WIRE_DIGITS_NESTED` in `codec.ts`): Position auf drei, weiche Werte wie
  `needs` und `alcoholDesire` auf zwei Stellen. Ungerundet wackelte jeder Wert
  in der letzten Stelle, sodass jeder Besucher in jedem Update als geändert
  galt — `needs` und `alcoholDesire` allein waren 95 % eines Deltas. Nur der
  Host simuliert, Clients zeigen diese Werte bloß an, und der Desync-Hash hängt
  an den ganzzahligen Zellkoordinaten. Ein neues Fließkommafeld gehört in die
  Tabelle, sonst fällt es auf volle Genauigkeit zurück.
- Determinismus: gleicher Tick + gleiche Commands → gleicher `hashSim`.
- Host muss geöffnet bleiben, überlebt aber einen Verbindungsabriss (siehe
  „Raumleben").

## Tests

`tests/regression.ts` (echte WebSockets, zwei Clients, später Join,
Pause/Resume, Deltas, Host-Abriss mit Wiederaufnahme auf demselben Sitz, Sweep
verwaister Räume, Raumcode am Spielstand inkl. Rückholen des eigenen Raums,
öffentliche Lobbyliste mit Spielerzahl und abwesendem Host, Chat-/Ping-
Roundtrip inkl. leerer Ping-Nachricht). `tests/multiplayerChat.ts`
(Sanitizing, TTL, Edge-Arrow-Math). Ride-Reconciliation: `tests/rideAccess.ts`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Commands, Snapshot-Teile, Delta-Strategie, Tick-Delay,
Server-Raumlogik oder Docker-/Server-Importgrenzen ändern. Save-Felder
parallel in `docs/saves.md`.

## Deko-Fassaden (0.1.125)

Bestehende `place`/`placeSceneryLine`-Commands transportieren Vollfeld-Slot 4
für große Themenobjekte und Wandkanten 0–3. Host und optimistischer Client
nutzen dieselben Validierungen; Höhen/Rotationen bleiben im bestehenden
Command-Kontext. Neue Wand-Kinds brauchen dieselbe Spielversion auf allen
Clients. Kein neues Command; Tests prüfen Wandhöhe und Vollfeld auf dem Host.

## Dächer, Eimer und Kontextabriss (0.1.126)

Neue Dach-/Eimer-Kinds nutzen bestehende `place`-Commands. Automatische
Möbelrotation wird auf Host und Client nach derselben `pathFurniture.ts`-Regel
ermittelt. Kontextabriss nutzt vorhandenes `bulldoze` mit konkreter Building-ID
bzw. `undoRoad` mit konkreter Höhe. Keine rein lokale Weltmutation. Shift setzt
Bauhöhe lokal; nächste Baucommands übertragen den bestehenden Höhenkontext.

## Dachabschluss-Kinds (0.1.128)

30 Dachwand-Kinds verwenden bestehende place-/Dekolinien-Commands und
Host-Prüfungen für Kanten, Höhe und Dach-Koexistenz. Keine neuen Commands/Felder.
