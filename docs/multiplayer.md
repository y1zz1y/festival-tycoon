# Mehrspieler

Der **Host** simuliert. Clients schicken `GameCommand`s (inkl. Bauhöhe und
Drehung) und empfangen periodische Weltdeltas. Alle Teilnehmer brauchen
dieselbe Spielversion. Fällt der Host weg und kommt nicht innerhalb einer Frist
zurück, übernimmt ein Gast den Raum mit dem letzten Weltstand, den der Server
aufbewahrt (Abschnitt „Host-Übernahme“). Autorität bleibt dabei immer genau ein
Host.

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
- **Szenario-Fortschritt:** Nur der Host rechnet Ziele, Ausgang, Insolvenz und
  Stichtag. `scenarioProgress` (v34: `editions`, `outcome`, `insolventDays`,
  `nextEditionDue`, `dueReminderDay`) ist ein normales Welt-Feld und geht als
  Ganzes im Delta mit, sobald es sich ändert. Kein neuer `GameCommand`: Der
  Stichtag ruft `festivalAction('prepare')` im Host-Tick auf, der Endbildschirm
  nutzt `setSpeed`. Clients öffnen Endbildschirm und Stichtag-Übersicht, wenn
  sich `outcome.state` bzw. `dueReminderDay` ändert, zeigen aber nur „Schließen“.
  Details: [scenarios.md](scenarios.md).
  Der **Szenario-Editor** ist lokales Authoring: kein neues `GameCommand`,
  kein Host-Tick. Ein Client darf ihn nicht starten.
- **Live-Chat und Map-Ping:** Ephemere UI-Ereignisse, kein `GameCommand` und
  kein Snapshot-Feld. Client sendet `{ t: 'chat', text, ping? }`; der Server
  säubert Text (max. 200 Zeichen) und Ping-Koordinaten und broadcastet
  `{ t: 'chat', id, from, name, text, ping? }` an alle Sitze im Raum
  (inkl. Absender). Der Chat ist ein eigenes Fenster unten links
  (`.mp-chat.panel`, Panel-Header mit ×, `makeDraggable` + `makeResizable`).
  Sichtbarkeit: **nur** wenn die Sitzung verbunden **und** **Chat anzeigen**
  eingeschaltet ist; das × setzt ein sitzungsweites `userClosed`, das die
  nächste eingehende Nachricht wieder aufhebt (ohne den Fokus zu stehlen) —
  ebenso **Enter**, der Knopf **Chat öffnen** neben der Einstellung und das
  Wiedereinschalten von **Chat anzeigen**. **Chat anzeigen** aus heißt kein
  Chat, auch kein Senden (`localStorage` `festival-mp-chat-display`).
  Das Log ist eine IRC-Transkription: `[HH:MM] <Name> Text` je Zeile,
  hängender Einzug beim Umbruch, Nickfarbe deterministisch aus dem Namen
  (`.mp-chat-nick-0…7`); eine reine Ping-Nachricht wird zur Aktionszeile
  `* Name markiert …`. Steuerung: **Enter** öffnet/fokussiert das Fenster
  (Weg-Stückbau behält Enter solange der Pfadeditor aktiv ist), **Enter** im
  Feld sendet (explizit, nicht über implizites Form-Submit), **Esc** gibt den
  Fokus zurück ans Spiel. Der Ping-Button aktiviert einen Kartenmarker;
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
  ihre Welt und bekommen `players` mit `hostAway: true` (und `takeoverInMs`,
  wenn eine Übernahme geplant ist). `players` und `joined` nennen den Host auch
  bei leerem Sitz (`hostName`, im Client `MultiplayerStatus.hostName`; die
  Spielerliste zeigt „{Name} · Host ist weg“). Bauen ist für Gäste pausiert: `GameState.gate`
  lehnt jeden Befehl mit „Host ist weg – Bauen pausiert“ ab, statt ihn
  optimistisch zu zeigen (`GameState.networkPause`). Nach der Frist übernimmt
  ein Gast (siehe „Host-Übernahme“).
- **Zurückkommen:** `resume` (`code`, `playerId`, `name`) holt den Host auf
  seinen alten Sitz, sodass Gäste weiter über ihn laufen; der Übernahme-Countdown
  endet. Jeder andere wird wie ein neuer Beitritt behandelt — auch ein alter
  Host, dessen Raum inzwischen übernommen wurde (`joined.demoted`). Der Client
  wählt selbst nach, mit Backoff bis 15 s und ohne Versuchsgrenze. `players`
  trägt `hostAway` **immer**, also auch `false`, sobald der Sitz wieder besetzt
  ist.
- **Aufräumen:** Nur ein Raum, in dem niemand mehr sitzt und dessen Host seit
  30 Minuten weg ist, wird verworfen — samt Countdown und Weltkopie. Das ist ein
  Sicherheitsnetz gegen liegengebliebene Codes, keine Sitzungsdauer.

## Host-Übernahme

Der Server wählt allein und deterministisch; eine zweite Autorität gibt es nie.
Der neue Host ist ein normaler Host auf einem anderen Rechner — weiterhin
host-autoritativ, dieselben Befehle, dieselben Deltas.

- **Weltkopie (`server/worldCache.ts`):** Solange Gäste im Raum sind, merkt sich
  der Server jeden Voll-Sync und wendet jedes Delta darauf an — oberste Felder
  ganz ersetzen, Besucher feldweise mit `mergeVisitorPatches`. Genau diese
  Funktion benutzt auch `GameState.applyNetworkUpdate` (Re-Export in
  `src/net/worldUpdates.ts`), die Reihenfolge der Besucher ist also dieselbe wie
  beim Gast; sie entscheidet über die RNG-Züge des Hosts. Ohne Gäste (ein Host
  allein sendet nichts) gibt es keine Kopie: Sie fällt weg, wenn der letzte Gast
  geht, während der Host da ist, und ebenso, wenn der Host allein in seinen Raum
  zurückkommt (`hostReturned`). Sonst bliebe eine alte Kopie liegen, und ein
  Fremder, der nach dem nächsten Abriss kommt, bekäme diesen alten Park
  übergeben. Gehen die Gäste, während der Host weg ist, bleibt die Kopie — ein
  späterer Gast kann den Raum dann noch weiterführen.
- **Größengrenze:** `MAX_CACHED_WORLD_BYTES` (48 MiB, Umgebungsvariable gleichen
  Namens) gilt für die Kopie als Ganzes, nicht nur je Nachricht. Jedes Delta
  zählt seine Länge auf eine obere Schranke (`bytes + unmeasured`; ein Delta kann
  die Kopie höchstens um seine eigene Länge wachsen lassen). Erst wenn die
  Schranke die Grenze überschreitet, wird die Kopie einmal echt vermessen
  (`JSON.stringify`) und verworfen, falls sie wirklich zu groß ist. Deltas, die
  ständig neue Besucher oder größere Felder anhängen, können sie so nicht mehr
  unbegrenzt wachsen lassen. Ohne Kopie baut der Gewählte auf seinem eigenen
  Spiegel auf.
- **Fremde Eingaben:** Der Server wendet an, was ein beliebiger Host schickt.
  `mergeVisitorPatches` überspringt Patches, die kein Objekt mit String-`id`
  und Objekt-`changes` sind, und ersetzt einen Eintrag, der kein Objekt ist,
  statt hineinzumischen; ein `world`, das kein Objekt ist, wird ignoriert.
  Wirft das Nachführen der Kopie trotzdem, verliert nur dieser Raum seine Kopie
  (`updateCache`), und jede eingehende Nachricht läuft in einem `try/catch`: Eine
  kaputte Nachricht kostet diese Nachricht, nie den Prozess mit allen Räumen.
- **Einmal kodiert weiterreichen:** Was der Host sendet (`state`, `sync`, …),
  geht als derselbe Text an alle Sitze, statt pro Empfänger neu serialisiert zu
  werden.
- **Frist:** `HOST_TAKEOVER_SECONDS` (Standard 20, Umgebungsvariable) ab
  `hostAwaySince`. Der Timer ist `unref`t, läuft nur, wenn jemand weitermachen
  könnte (Kopie vorhanden oder ein Gast hat die Welt), und endet, sobald der Host
  zurück ist (`resume` oder Zurückholen per `host`). Die Frist ist länger als
  die ersten Reconnect-Versuche des Clients (1/2/4/8 s), deckt also einen
  Verbindungsabriss im selben Tab. Ein Neuladen des Tabs deckt sie nur, wenn der
  Spieler in der Zeit den Spielstand lädt und wieder hostet (siehe „Grenzen“).
- **Wahl (`electHost`):** Kandidaten sind Gäste mit offenem Socket, die nicht
  schon an einer Übernahme gescheitert sind — zuerst die auf derselben
  Spielversion wie der Host (`version` im `host`/`join`/`resume`-Hello, aus
  `__APP_VERSION__`; ein veralteter Tab versteht `promoted` womöglich nicht und
  kommt nur dran, wenn sonst niemand kann), dann die mit Welt (`hasWorld`:
  einen Voll-Sync bekommen), dann nach Beitrittsreihenfolge. Nennt der Host
  keine Version, zählt sie nicht. Ohne Serverkopie
  kommen nur Gäste mit Welt in Frage; hat niemand die Welt, wartet der Raum
  („Der Host ist weg und niemand hat den Spielstand – warte auf Rückkehr.“).
  Der Gewählte bekommt `promoted` (`code`, `playerId`, `joinUrl`, `players`,
  `epoch`, `public`, `world?`, `worldAgeMs?`), alle anderen `hostChanged`
  (`hostId`, `hostName`, `players`, `epoch`). `epoch` zählt die Übernahmen des
  Raums. Das Relay-Gate `joined.id === room.hostId` sperrt ab jetzt den alten Sitz.
- **Kandidat fällt aus:** Trennt sich der Gewählte vor seinem ersten Voll-Sync,
  geht der Raum an den alten Host zurück (wie unten beim Scheitern), und sofort
  wird der Nächste gewählt. Kann er die Welt nicht aufbauen
  (`GameState.fromJSON` liefert `null`), schickt er `takeoverFailed`; der Server
  setzt den Raum zurück, markiert ihn und fragt den Nächsten
  (`abandonPromotion`). Schweigt er einfach — ein veralteter Tab, der `promoted`
  ignoriert, ein halboffener Socket —, läuft nach 30 s ein Wächter ab
  (`promotionTimeoutMs`, `watchPromotion`; Aufbau dauert unter einer Sekunde, der
  Rest ist Luft für das Hochladen eines großen Parks). Dann gilt er als
  gescheitert: Der Raum geht zurück an den alten Host (`previousHost`,
  `hostAwaySince` neu), der seinen Sitz per `resume` also weiter zurückbekommt,
  und der Nächste wird gewählt. Der Schweigende bekommt `hostChanged` — bei einer
  Neuwahl mit allen anderen, sonst allein, vor dem `players` mit `hostAway`.
  Ein Client, der sich schon für Host hält, wird dadurch wieder Gast
  (`MultiplayerSession.leavePromotion`: Queue und Markierung weg, `hello` wird
  `join`, Toast „Übernahme abgebrochen – du spielst als Gast weiter.“, der
  nächste Voll-Sync ersetzt seine Welt). Ein Sync, der danach noch von ihm kommt,
  wird verworfen (er ist nicht mehr `hostId`).
- **Gäste ohne Host:** Ein Gast, der in einen Raum ohne Host kommt, und jedes
  `resync` ohne Host werden aus der Serverkopie bedient (höchstens alle 4 s je
  Sitz). Wer so eine Welt bekommt, ist Kandidat; der Countdown läuft weiter ab
  `hostAwaySince`, ein später Beitritt startet ihn nicht neu.
- **Übergeben:** `leave { handOver: true, to? }` vom Host mit Gästen wählt sofort,
  ohne Frist (`to` wird bevorzugt, wenn er die Welt hat oder eine Kopie besteht).
  Vorher schickt `MultiplayerSession.handOver` einen letzten Voll-Sync, damit die
  Kopie exakt ist. Ohne möglichen Erben endet der Raum wie bisher.
- **Befördert (Client):** `MultiplayerSession` verwirft unbestätigte Befehle,
  baut die Welt mit `gameFromNetworkWorld` (`src/net/takeover.ts`) über
  `GameState.fromJSON` — derselbe Weg wie beim Laden: migrieren, Konstruktor,
  Reparatur, RNG aus `rngState`, neuer `idCounter`, Strom/Zugang/Abreisen neu.
  Kein In-place-Umschalten des Spiegels (veraltetes `rng`, nie aufgebauter
  Laufzeitzustand). `onPromoted(next)` bindet sie in `main.ts` hinter dem
  Ladeoverlay (`src/ui/hostTakeover.ts`; ein verborgener Tab bindet sofort);
  `attach` stempelt den Raumcode und schickt den ersten Voll-Sync. Befehle
  anderer Gäste, die währenddessen ankommen, warten in einer Queue und laufen
  nach dem Sync. `hello` wird ein `host`-Hello mit Raumcode, damit ein
  verschwundener Raum (Serverneustart) mit dieser Welt neu öffnet.
- **Die anderen Gäste:** `hostChanged` verwirft ihre unbestätigten Befehle
  (Toast mit Anzahl), der nächste Voll-Sync des neuen Hosts ersetzt die Welt.
- **Unbestätigte Befehle:** Was beim Wegfall des Hosts noch ohne Antwort ist,
  wird nie erneut gesendet (ein Kredit würde doppelt gebucht) und nicht mehr
  nach jedem Voll-Sync erneut abgespielt: `GameState.discardOptimisticCommands`
  beim Übergang zu `hostAway` und bei `hostChanged`, Toast „{n} unbestätigte
  Aktion(en) verworfen – bitte prüfen.“, danach `resync` (vom Server aus der
  Kopie beantwortet). Ein Befehl, der den Server ohne Host erreicht, bekommt ein
  `commandResult` mit `ok: false` statt eines allgemeinen Fehlers. Das behebt
  den früheren Geisterbau, bei dem so ein Befehl nach jedem Sync wieder auftauchte.
- **Epoche an Befehlen:** Jeder `command` eines Gasts trägt `epoch`, die Zahl der
  Übernahmen, die er kennt (aus `joined.epoch`, `promoted.epoch`,
  `hostChanged.epoch`). Weicht sie von `room.epoch` ab, war der Befehl unterwegs,
  bevor der Gast von der Übernahme erfuhr — er hat ihn beim `hostChanged` schon
  als verworfen gemeldet. Der Server leitet ihn dann nicht an den neuen Host
  weiter, sondern antwortet `commandResult` mit `ok: false` („Host hat gewechselt
  – Aktion verworfen“). Sonst liefe z. B. ein Kredit beim neuen Host und ein
  zweites Mal, wenn der Gast ihn erneut auslöst. Ein Befehl ohne `epoch` (älterer
  Client) geht wie bisher durch.
- **Alter Host kommt zurück:** Er hat offline solo weitergerechnet. Per
  `resume` ist er jetzt Gast (`joined.demoted`, `hostName`);
  `onDemoted(backup)` sichert seine Welt vorher als lokalen Spielstand
  „Vor Host-Wechsel {Code}“ (siehe [saves.md](saves.md)), dann ersetzt der
  Voll-Sync des Raums sie. Sein `hello` wird ein `join`.
- **Raum endet (`closed`):** Ein Gast spielt allein weiter, aber mit einer über
  `gameFromNetworkWorld` neu aufgebauten Welt statt des Spiegels in-place
  (`onContinueSolo`); die Welt behält den eigenen Raumcode des Gasts.
- **Anzeige:** Banner oben mit „Host ist weg – Übernahme in {n} s“ (Countdown
  aus `takeoverInMs`), Spielerliste markiert Host und „(du)“, Toasts „{Name} ist
  jetzt Host. Das Spiel läuft weiter.“ bzw. „Du bist jetzt Host von Raum {Code}.
  …“ (mit „Stand von vor {n} s übernommen.“ ab 2 s Alter). **Trennen** fragt einen
  Host mit Gästen: „An {Name} übergeben“ (Standard), „Spiel für alle beenden“,
  „Abbrechen“ (auch Esc; `chooseAction` in `src/ui/confirmDialog.ts`).
- **Fortschritt und Speichern:** Wer einen Park übernommen hat, bekommt für ihn
  keine Szenario-Siege oder Erfolge (`MultiplayerSession.inheritedHost`, siehe
  [progress.md](progress.md)); Schnell- und Autospeichern gehen in den Slot
  „Übernommen {Code}“, nie über das eigene „Schnellspeichern“, und
  Schnellladen liest genau diesen Slot zurück (siehe [saves.md](saves.md)). Die
  Markierung hängt am `GameState`-Objekt (`WeakMap`): Sie bleibt beim erneuten
  Hosten (`host()` löscht sie nicht) und geht per `markInherited` auf einen
  aus dem Übernahme-Slot schnellgeladenen Stand über.
- **Kein neuer `GameCommand`, kein Snapshot-Feld:** Nur Protokoll-Nachrichten
  (`promoted`, `hostChanged`, `takeoverFailed`, `leave.handOver`,
  `players.takeoverInMs`/`hostName`, `joined.hostAway`/`demoted`/`hostName`/
  `epoch`, `command.epoch`, `version` in `host`/`join`/`resume`).
- **Grenzen:** Der neue Host rechnet ab dem Übernahmestand deterministisch
  weiter, aber nicht bitgleich zu dem, was der alte gerechnet hätte — die
  Leitung rundet Besucherwerte, und Laufzeitzustand außerhalb des Snapshots
  (Entscheidungsqueues, Routen-Caches, Spawn-Takt, Undo-Stapel) beginnt neu, wie
  nach dem Laden. Ein stumm toter Host fällt erst nach 25–50 s Keepalive auf,
  dazu kommt die Frist; eine schnellere Erkennung (eigenes Stille-Timeout oder
  kürzerer Ping für Hosts) gibt es bewusst nicht, weil ein Host auf langsamer
  Leitung beim Hochladen eines großen Voll-Syncs zu Recht lange schweigt — ein
  Pong wartet hinter dem Frame — und sonst fälschlich übernommen würde. Ohne
  Serverkopie baut der Gewählte auf seinem Spiegel auf, der eigene unbestätigte
  Bauten noch zeigen kann. Wer den Code hat, kann jetzt auch Host werden — das
  Rechtemodell bleibt der Code.
- **Nur derselbe Tab kommt als Gast zurück:** Gastsitz und Sicherung „Vor
  Host-Wechsel {Code}“ gibt es nur, wenn der alte Host im selben Tab neu
  verbindet (`resume` mit seiner `playerId`, aus dem Speicher der Session). Nach
  Neuladen, Tab-Schließen oder Absturz ist diese Sitzung weg: Wer den
  Spielstand lädt und erneut hostet, schickt `host`; ist der Raum noch ohne Host,
  holt er ihn damit zurück (siehe „Eigenen Raum zurückholen“, nur wenn der
  Spielstand den Code schon trägt), ist er inzwischen übernommen, bekommt er
  einen **neuen** Raum mit neuem Code und sitzt allein darin — ohne Gastsitz und
  ohne Sicherung; sein Stand liegt dann nur dort, wo er ihn selbst gespeichert
  hat. Ein Sitz-Merker in `sessionStorage` (`code`, `playerId`) ist nicht
  umgesetzt: Ein duplizierter Tab kopiert `sessionStorage`, und zwei Tabs mit
  derselben Host-`playerId` würden sich den Sitz per `resume` gegenseitig
  wegnehmen; das ginge nur mit einem rotierenden Sitz-Token am Server.

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

## Sprachen

Jeder Client zeigt seine eigene Sprache ([i18n.md](i18n.md)); der Host bleibt
autoritativ:

- **Keine Änderung an persistierten oder gesendeten Daten.** Kein neuer
  `GameCommand`, kein neues Snapshot-Feld, die Snapshot-Version bleibt. Codec,
  Deltas und Sim-Hash bleiben unverändert; der Sim-Hash enthält keinen Text, und
  es kommt keiner hinzu.
- **Inhalt.** Spielstände, Deltas, `commandResult`, `result`, `error` und `closed`
  tragen kanonisches Deutsch. Command-Payloads tragen kanonische deutsche Defaults
  oder Nutzertext.
- **Übersetzt wird nur beim Betrachter.** Ein deutscher Host und ein englischer Gast
  teilen einen Raum. Optimistische Gast-Commands erzeugen dasselbe Deutsch wie der
  Host, weil autoritativer Code nie übersetzt.
- **Chat, Spielernamen und Lobbynamen** erscheinen wörtlich, nie übersetzt.
- **Versionsschiefe.** Ein Text eines neueren Hosts, den der Katalog des Gastes nicht
  kennt, erscheint auf Deutsch. Das ist akzeptiert.
- **Laden.** Jede Client-Sprache lädt jeden Spielstand. Alte Spielstände können
  Deutsch aus der Zeit vor der Normalisierung enthalten; Legacy-Schlüssel decken
  persistierte Namen und Status ab, alte Gedanken erneuern sich.
- **Geräteeinstellung.** Die Sprache liegt in `festival-player-settings`, einer
  Geräteeinstellung. Sie wird nie gespeichert oder synchronisiert.
- Der Server übersetzt nie; seine Meldungen schreibt er mit `de` aus
  `server/i18nMarker.ts` (keine Imports, Docker-sicher; `src/i18n/marker.ts`
  re-exportiert ihn). Die Client-Senken (`onToast`, `joinErrorSink`,
  Statuszeile, Kontomeldung) übersetzen beim Anzeigen. Das gilt für alle
  Server-Antworten (`rooms.ts`, `accounts.ts`, `saveSlots.ts`, `progress.ts`,
  `scenarios.ts`, `serve.ts`, `wsPlugin.ts`) und für die Texte der Session
  (`src/net/session.ts`: Statuszeilen, Toasts, Rückfallnamen `Host`/`Gast`) und der
  Übernahme (`src/net/takeover.ts`). Katalogbereiche: `src/i18n/en/server.ts` und
  `src/i18n/en/net.ts`.
- Zwei Sätze werden nicht aneinandergehängt, sondern je Variante ganz geschrieben,
  damit ein englischer Client sie wiederfindet: `promotedNotice` (mit/ohne Alter
  der Weltkopie, mit/ohne verworfene Aktionen), `demotedNotice` (mit/ohne Namen),
  `hostChangedDroppedNotice` (neuer Host plus verworfene Aktionen, als Plural) und
  `continueSoloNotice` (Raum beendet, Gast spielt allein weiter). Letztere vergleicht
  den Grund aus `closed` kanonisch mit `HOST_ENDED_GAME` („Der Host hat das Spiel
  beendet“, derselbe Text wie in `server/rooms.ts`); ein unbekannter Grund eines
  neueren Servers erscheint wörtlich vor „– du spielst allein weiter.“
- Übernahme-Spielstände heißen weiter `Übernommen <Code>` und `Vor Host-Wechsel
  <Code>`; beide Namen stehen als Namensmuster im `names`-Export von
  `src/i18n/en/net.ts`, die Anzeige läuft über `localizeName`.
- Wer in einem Raum sitzt und die Sprache wechselt, lädt nicht neu: die Wahl gilt
  ab dem nächsten Start (ein Host-Neuladen ließe den Raum im Host-weg-Zustand).
  „Im Raum“ ist `isInMultiplayerRoom(status)` (`src/ui/playerSettingsPanel.ts`):
  Modus nicht `solo` oder verbunden. Eine abgerissene Verbindung behält beim
  Neuverbinden ihren Modus und verliert nur `connected`; sie zählt weiter als Raum,
  sonst verließe ein Gast den Raum still.
- Ein Queued-Command (`{ ok: true, message: COMMAND_QUEUED }`) wird über die
  Konstante aus `src/game/sentinels.ts` erkannt, nicht über den Text.

## Übers Internet spielen

Der Spielzustand läuft ausschließlich über eine WebSocket auf `/ws`. Der Client
wählt das Schema aus der Seite: HTTPS-Seite → `wss:`, sonst `ws:`. Es gibt
keinen Polling-Fallback, und es soll auch keinen geben.

Der Produktionsserver (`server/serve.ts`, Logik in `server/app.ts`) lauscht auf
`HOST`/`PORT` (Standard `0.0.0.0:8080`). Die Desktop-App startet denselben Server
auf Port 47880 im Heimnetz, siehe [desktop.md](desktop.md). Vor dem Server steht in der Regel ein Reverse Proxy mit
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
- Wer den Code hat, kommt rein, darf bauen und kann bei einer Host-Übernahme
  Host werden. Das ist das ganze Rechtemodell — ein privater Raum ist so privat
  wie sein Code.
- Eine Weltkopie je Raum kostet Server-Speicher (geschätzt einige zehn MB Heap
  bei ~4 MB JSON). `MAX_CACHED_WORLD_BYTES` deckelt sie als Ganzes (auch über
  viele Deltas, siehe „Größengrenze“); Schließen und Aufräumen verwerfen sie.
  `HOST_TAKEOVER_SECONDS` stellt die Übernahmefrist ein (Standard 20). Beide
  sind optionale Umgebungsvariablen, ungültige Werte fallen auf den Standard
  zurück.
- Was ein Host schickt, ist fremde Eingabe: Die Weltkopie übersteht kaputte
  Deltas (siehe „Fremde Eingaben“), und eine Nachricht, an der ein Handler
  scheitert, wird geloggt und verworfen statt den Prozess zu beenden. Die
  Nachrichtengröße begrenzt `ws` selbst (`maxPayload`, Standard 100 MiB); eine
  kleinere Grenze ist nicht gesetzt, weil ein großer Park als Voll-Sync legitim
  mehrere zehn MB haben kann und der Host sonst beim Senden getrennt würde.
- Gemessen auf `festivalmittel` (830 Besucher, Voll-Sync 4,2 MB, Delta-Median
  1,4 MB): Kopie anlegen 1,5 ms, Delta anwenden 0,24 ms (p95 0,6 ms). Dafür
  entfällt das Neuserialisieren je Gast und Delta (Median 3,8 ms, p95 6 ms).
  `promoted` mit Welt: 4,2 MB, 13 ms `JSON.stringify`; der Gewählte baut sie in
  etwa 85 ms auf (`gameFromNetworkWorld`). Die Gesamtgrenze kostet eine
  Nachmessung der Kopie von 12–14 ms etwa alle 31–38 Deltas (bei 5 Deltas/s
  alle 6–7 s, im Mittel rund 2 ms/s je Raum); das Anwenden eines Deltas bleibt
  bei 0,2 ms (p95 0,3 ms; 783 Besucher, 150 Deltas).

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Befehls- und Nachrichtentypen | `src/net/protocol.ts` | `GameCommand`, World/Sim-Snapshots |
| Vollständige Command-Metadaten | `src/net/commandRegistry.ts` | `COMMAND_METADATA`, `isOptimisticCommand` |
| Command → `GameState` | `src/net/commands.ts` | `applyGameCommand` |
| Kompakte Pakete | `src/net/codec.ts` | `packWorld` |
| Deltas, Ankunft/Abreise | `src/net/worldUpdates.ts` | `WorldUpdates`, `applyWorld`, Re-Export `mergeVisitorPatches` |
| Client-Session | `src/net/session.ts` | `MultiplayerSession`; Sendepuffergrenze 512 KiB (`bufferedAmount`) in `tick`/`pushSync`; `epoch` an Befehlen, `leavePromotion`, `markInherited`, `status.hostName` |
| Host-Übernahme: Weltkopie am Server | `server/worldCache.ts` | `cacheFromSync`, `applyDeltaToCache`, `cachedWorld`, `mergeVisitorPatches`, `MAX_CACHED_WORLD_BYTES` |
| Host-Übernahme: Welt aufbauen, Texte | `src/net/takeover.ts` | `gameFromNetworkWorld`, `hostAwayNotice`, `droppedActionsNotice`, `hostChangedDroppedNotice`, `promotedNotice`, `continueSoloNotice`, `HOST_ENDED_GAME`, `takeoverSaveName`, `demotedBackupName`, `demotedNotice` |
| Host-Übernahme: Banner, Binden, Sicherung, Übergabe-Dialog | `src/ui/hostTakeover.ts` | `mountHostTakeoverUi` |
| Lobby-Liste ohne Session | `src/net/lobbies.ts` | `fetchLobbies`, `multiplayerSocketUrl` |
| Beitreten vom Titlescreen | `src/ui/titleScreen.ts` | `openTitleLobbies`, `joinLobby` |
| UI-Bindung | `src/net/bind.ts` | `enableMultiplayerCommands` |
| Live-Chat / Map-Ping | `server/chatProtocol.ts`, `src/net/chatProtocol.ts`, `src/ui/multiplayerChat.ts`, `src/net/session.ts` | Sanitize/Relay in `server/`; Client re-exportiert + UI-Helfer; Fenster unten links, IRC-Log; Enter öffnet/sendet; Ping TTL 10 s |
| Host-Turns, Optimistic | `src/game/GameState.ts` | `gate`, `networkPause`, `discardOptimisticCommands`, `receiveTurn`, `applyNetworkWorld` |
| Server-Räume | `server/rooms.ts` | `attachMultiplayer`; Handler je Nachricht, `electHost`, `scheduleTakeover`, `watchPromotion`/`abandonPromotion` (Wächter 30 s), `updateCache`, Epochen-Prüfung in `forwardCommand`, `HOST_TAKEOVER_SECONDS` |
| WebSocket-Plugin (Dev/Preview) | `server/wsPlugin.ts` | Kompression (`perMessageDeflate`, Level 1) |

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
  Diese kanonischen Commands ändern nur kanonische Datensätze
  (`startAttraction`-IDs). Eine Legacy-ID (Bahn, Kurs, `ride`-Gebäude,
  Camping/Party) und jede Projektionsart (`coaster:*`, `course:*`,
  `waterSlide`, `paintball`, `swimArea`, `camping`, `partyArea`) lehnt der
  Host mit `ok: false` ab; Bahnen und Kurse laufen weiter über ihre eigenen
  Commands. Doppelmodell:
  [attractions.md → Doppelmodell](attractions.md#doppelmodell-offizielle-regel-bewusst-ohne-migration).
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
  Datensätze nur nach. Dasselbe gilt für `courses` und `coasters`:
  ein Attractions-Delta ohne den gerade gesetzten Kurs darf die
  Live-Zeile nicht löschen, sonst flackert die Anlage und die Kachel
  bleibt belegt, ohne dass Inspect eine Entity findet. Ein Delta, das
  `attractions` ohne `coasters`/`courses` trägt, ersetzt oder ändert
  **keine** bestehende Client-Live-Zeile (Objekt und Preis bleiben);
  `adoptMissingLiveRows` projiziert nur IDs, die der Client noch nicht
  hat. Danach leitet `refreshLegacyAttractionRecords` die Datensätze aus
  den Live-Arrays neu ab. `migrateCourse` schreibt auch Eingangs-only-Kurse
  und die erste Wasserrutschen-Leiter. Gäste einer beim Laden verworfenen
  Waise gibt nur der Lader des Hosts frei (`releaseGuestsOfOrphans`); der
  Client bekommt den reparierten Stand im Vollsync und ändert beim Auffrischen
  der Datensätze keine Besucher, sonst liefe der Lockstep-Hash auseinander.
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
  Optische Untergründe: `paintGroundCover` (`x`, `z`, `cover`) und
  `paintGroundCoverArea` (`cells`, `cover`); `cover` ist einer von
  `grass`/`sand`/`stone`/`field`/`snow`/`rock`/`earth`/`salt`/`asphalt`. Optimistic wie
  die übrigen Geländebefehle, host-autoritativ. Snapshot-Feld
  `festival.infrastructure.ground[].cover` kommt mit der Welt; fehlend
  bleibt der umgebungsbasierte Boden.
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
- Der Host sollte geöffnet bleiben. Er überlebt einen Verbindungsabriss (siehe
  „Raumleben“); bleibt er länger als die Frist weg, übernimmt ein Gast (siehe
  „Host-Übernahme“). Ein neuer Client-Zustand nach einer Übernahme entsteht
  immer über `gameFromNetworkWorld`, nie durch Umschalten des Spiegels.
- Server-Nachrichten, die den Host betreffen, tragen `hostAway` immer explizit.

## Tests

`tests/regression.ts` (echte WebSockets, zwei Clients, später Join,
Pause/Resume, Deltas, Host-Abriss mit Wiederaufnahme auf demselben Sitz, Sweep
verwaister Räume, Raumcode am Spielstand inkl. Rückholen des eigenen Raums,
öffentliche Lobbyliste mit Spielerzahl und abwesendem Host, Chat-/Ping-
Roundtrip inkl. leerer Ping-Nachricht). `tests/multiplayerChat.ts`
(Sanitizing, TTL, Edge-Arrow-Math). Ride-Reconciliation: `tests/rideAccess.ts`.
`tests/hostTakeover.ts` (Weltkopie gleich `asWire(host)` und in Gast-Reihenfolge,
Größengrenze je Nachricht und über viele Deltas, kaputte Patches ohne Wurf,
`gameFromNetworkWorld` mit RNG/Code, Bau-Pause, Wahlreihenfolge inkl.
Spielversion, Texte, Sicherungs-Slot, Schnellspeicher-Slot (`findQuickSlot`),
kein Fortschritt für übernommene Parks; echte Sockets: Übernahme durch den
ältesten Gast, alter Host kommt als Gast mit Sicherung zurück, Rückkehr
innerhalb der Frist, niemand ohne Welt wird befördert, sofortige Übergabe mit
verworfenem unbestätigtem Bau, stumm toter Host ohne Geisterbau, ausfallender
bzw. scheiternder Kandidat, Solo-Weiterspiel nach `closed`;
`testTakeoverHardening`: feindliches Host-Delta ohne Absturz, allein
zurückgekehrter Host verwirft die alte Kopie, schweigender Kandidat nach dem
Wächter aufgegeben und alter Host bekommt seinen Sitz zurück, Befehl mit alter
Epoche abgelehnt, übernommener Park bleibt markiert nach Schnellladen und
erneutem Hosten). Die Tests setzen Frist und Wächter lokal über
`roomsForTest.setTakeoverDelay`/`setPromotionTimeout` und stellen sie wieder
her; der bestehende Reconnect-Test läuft mit der Standardfrist.

Im Browser geprüft (0.2.12, Produktions-Build, `HOST_TAKEOVER_SECONDS=8`, drei
Tabs): Banner mit Countdown und „{Name} · Host ist weg“ in der Spielerliste,
Übernahme hinter dem Ladeoverlay ohne Konsolenfehler, Schnellladen ohne
Übernahme-Slot lehnt ab, Schnellspeichern schreibt „Übernommen {Code}“,
Schnellladen liest ihn zurück und der Stand speichert danach weiter dorthin,
Drei-Wege-Dialog beim **Trennen** (Esc = Abbrechen) und sofortige Übergabe an
den genannten Gast.

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

## Flat Rides (0.2.10)

Neuer Befehl `{ type: 'placeRide', rideType, x, z }` (optimistisch), verdrahtet
in `protocol.ts`, `bind.ts`, `commands.ts` und `commandRegistry.ts`. Die
Baurichtung reist wie bei jedem Bau im Befehlskontext mit. Durst und Hygiene
sind Felder von `needs` und gehen mit dessen Rundung (`WIRE_DIGITS_NESTED`).

## Phase 5 (0.2.11)

Keine neuen `GameCommand`s: `sponsor` und `shelter` sind Festival-Aktionen im
bestehenden Befehl `festival` (host-bestätigt). Unwetter und Sponsoren liegen in
`festival` und kommen mit dessen Delta; Gäste sehen Warnung, Regen und Donner aus
demselben Snapshot. Fortschritt und Erfolge trägt nur der Host bzw. Solo-Spieler
ein, nie ein Gast.
