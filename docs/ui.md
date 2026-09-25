# Benutzeroberfläche und Eingaben

`main.ts` verdrahtet Tools, Fenster und Commands. Fach-UIs liegen daneben,
nicht in `GameState`. Mobile und schmale Layouts haben eigene CSS/Module.

## Attraktionseditoren: zwei Fenster, ein Bedienmuster

Es gibt **kein** gemeinsames Attraktionspanel. Achterbahnen bedient
`src/ui/coasterBuilderPanel.ts` (`#coaster-builder`), Kurse
`src/ui/courseBuilderPanel.ts` (`#course-builder`). Achterbahnen folgen dem
RCT2-Muster (Palette, großer Bauen-Knopf). Path-led Kurse nutzen dasselbe
Weg-Richtungsmenü wie Fußwege: Pfeile nur in freie Nachbarn, Klick setzt das
Stück. `editorMode` am Katalog schaltet die Chrome.

| Schritt | Achterbahn | Kurs |
| --- | --- | --- |
| Bauanker | offenes Streckenende (`#coaster-status`) | `courseTrackEnd` im Status |
| Richtung | Richtungs-Palette `#track-direction-palette`, Startrichtung `#coaster-rotate`. Bei `editorMode: 'directionArrows'` stattdessen `#coaster-direction-grid` | `COURSE_SPECS.editorMode`: Path-led Kurse nutzen `#course-direction-grid` (nur freie Nachbarn); Paintball behält `#course-rotate` |
| Höhe | Neigung `#track-slope-palette` plus Rollen `#track-bank-palette` | Ebenen-Regler `#course-elevation-*` |
| Ghost | `WorldView.setCoasterConstructionPreview` | `WorldView.setCourseConstructionPreview` |
| Anbauen | `#coaster-build-piece` (verborgen bei `directionArrows`) | Pfeil-Klick oder `#course-build-piece` (`buildCoursePieceAtEnd`) |
| Rückgängig | `#coaster-undo` | `#course-undo` |

`src/main.ts` hält nur den lokalen Editorzustand (Werkzeug, Richtung, Ebene,
aktive Anlage) und schickt jede Änderung als autoritatives `GameState`-Command.
Der Ghost ist eine reine Funktion aus offenem Ende plus Bauzustand
(`courseNextBuildTarget` / `courseGhostSpan`, `resolveNextTrackPiece`) und wird
nur bei geändertem Key neu gebaut. Beide Panels teilen Status- und
Fehleranzeige für Palette, Fläche, Flächenlöscher, Referenzen und
Eingang/Ausgang.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Bootstrap / Verdrahtung | `src/main.ts` | RCT-Iconleiste `.rct-toolbar`, erzeugt Controller und verbindet Callbacks; `#undo-last-build` |
| Bau-Undo-Stack | `src/game/buildUndo.ts`, `src/game/GameState.ts` | `undoLastBuild`, Marker/Diff, max. 40 Einträge, nicht im Snapshot |
| Festival-Preise / Bandplaner | `src/festivalUI.ts`, `src/musicPlanner.ts`, `src/festival.css` | Ticket-Slider + Schätzung; Kaufbereitschaft über `--range-accent` (Thumb/Track); Sterne-Tabs und Auto-Plan-Filter |
| Stabile App-Shell / DOM-Vertrag | `src/app/shell.ts` | `mountAppShell`; vollständiges statisches Markup und Autosave-Konstanten |
| Titel, Szenario und Saves | `src/ui/titleScreen.ts`, `src/ui/scenarioScreen.ts`, `src/ui/saveController.ts` | Controller mit injiziertem `GameState`-/Multiplayer-/Lade-Kontext; Briefing vor Presets (`openTitleBriefing`), Zielzeilen im freien Spiel (`readGoals`/`fillGoals`) |
| Szenario-Oberfläche | `src/ui/scenarioStatus.ts` | Zielanzeige `#scenario-goals-stat` in der Statusleiste, Endbildschirm als HEADLINE-Sonderausgabe, Stichtag-Übersicht; öffnen nur bei Änderung von `outcome.state`/`dueReminderDay`. Regeln: [scenarios.md](scenarios.md) |
| Objekt- und Besucheranzeige | `src/ui/entityPanel.ts`, `src/ui/visitorPanel.ts` | Vollständige Objektpanel-Orchestrierung, Achterbahn-Telemetrie, Kurs-/Paintball-/Pool-Betrieb sowie zustandsbehaftete Besucher-Inspektion |
| UI-Formatierung | `src/ui/format.ts` | HTML-Escaping, Geld-, Uhrzeit- und Speicherzeitformat |
| Finanz-Ledger | `src/ui/financePanel.ts` | `renderFinanceLedger`, aufklappbare Kostenzeilen |
| Render- und Hidden-Tab-Schleife | `src/app/gameLoop.ts` | `startGameLoop`; schmale Game/View/Audio-Schnittstellen |
| Kartenklick-Werkzeugrouting | `src/input/toolRouter.ts`, `src/input/cellToolHandlers.ts` | Direkte Commands sowie typisierte Achterbahn-, Wegeditor- und Inspect-Routen |
| Weg-/Straßen-Ziehcontroller | `src/input/pathToolController.ts` | `createPathToolController`; besitzt Ziehzustand, Linien-/Rechteckbildung und Ausführung |
| Achterbahn-Baufenster | `src/ui/coasterBuilderPanel.ts` | `updateCoasterBuilderPanel`; stabile Palette und Ghost-/Auswahlvorschau |
| Kurs-Baufenster | `src/ui/courseBuilderPanel.ts` | `renderCourseBuilderPanel`; `editorMode` schaltet Palette+**Am Ende bauen** gegen Weg-Richtungspfeile; atomare Werkzeuge **Anlagenfläche** und **Fläche entfernen** für Pool/Paintball, Endpunkt-Palette und Ebene für Mudmasters/Tree-to-Tree/Wasserrutsche, Paintball-Teamgröße. Wasserrutsche beginnt mit Leiter-Klick, Stapel auf derselben Kachel. Betrieb (Öffnen/Schließen) sitzt nicht hier, sondern im Infofenster |
| Kontexthilfe | `src/ui/contextHelp.ts` | `contextHelpText`; verwendet das autoritative `PlacementPreviewResult` |
| Nachfrage-Dialog | `src/ui/confirmDialog.ts` | `confirmAction` (`<dialog>`, wie Spielstand-Text); `rideDemolishPrompt` vor `removeCoaster` / `removeCourse` |
| Baukatalog / stabile Statusanzeige | `src/ui/buildCatalog.ts` | `createBuildCatalog`, `catalogTileHtml` |
| Spielstand-Archivdarstellung | `src/ui/saveArchive.ts` | Zusammenführen Server/Browser, sichere Zeilen, Speicherhinweis |
| Differentielle UI-Updates | `src/ui/differentialUpdates.ts` | `DifferentialUpdates`, `listFingerprint` |
| Rechteck-Flächenvertrag | `src/ui/areaDesignation.ts` | `AreaDesignationSpec`, `normalizeRectangle`, Preview/Execute-Adapter |
| Ton stumm | `src/main.ts`, `src/view/FestivalAudio.ts` | `#toggle-mute`, `#setting-mute-audio`; [audio.md](audio.md) |
| Abriss-/Info-Picking | `src/view/WorldView.ts`, `src/view/picking.ts` | `pickPlacedObject`, `resolvePickedBuilding` |
| Infofenster Müllwagen / Ablage / Container | `src/main.ts`, `src/game/logistics.ts`, `src/game/waste.ts` | `formatRoadVehicleInspectLoad`, `connectedWasteDumpStats`, `formatSealedContainerInspect` |
| Infofenster Backstage | `src/main.ts`, `src/game/bandSupply.ts` | `formatBackstageInspect`, Klick auf Backstage-Kachel |
| Meldungs-Ticker | `src/tickerUI.ts`, `src/game/ticker.ts` | `mountTickerUI`, `observeTickerEvents` |
| Bau-Kategorien und Raster | `src/game/buildMenu.ts` | `BUILD_CATEGORIES` |
| Kopieren / Baubibliothek | `src/main.ts`, `src/game/blueprints.ts`, [blueprints.md](blueprints.md) | Kategorie **Kopieren**, Rechteck wie Gelände, Geistervorschau, `stampBlueprint`, lokale Bibliothek |
| Deko-Themenfilter | `src/game/decoration.ts`, `src/main.ts` | `renderDecorationCatalog`, Themen-Chips in `#decoration-themes` |
| Festival-Verwaltung | `src/festivalUI.ts`, `src/festival.css` | Tickets, Plan, **Park öffnen/schließen** (`setParkOpen`) |
| HEADLINE Magazin | `src/headlineMagazineUI.ts`, `src/headlineMagazine.css`, `src/game/headlineMagazine.ts` | Vollbild-Heft nach `festival.finished`; Weiter/Schließen; erneut unter Abrechnung & Ruf |
| Bandplan | `src/musicPlanner.ts` | |
| Geländeplaner / Wegbelag | `src/logisticsUI.ts`, `src/logistics.css`, `src/game/buildMenu.ts` | Overlay über `WorldView.setLogisticsMode`; Fußweg-Art-Hold. Gelände-Reiter: Feld anheben/senken, Glätten (Fläche) |
| Buslinien-Planer | `src/main.ts`, `src/game/busPlanner.ts`, `src/view/LogisticsView.ts` | Zwei Spalten ohne Duplikate, DnD, `sortBusLineStops`, nummerierte `setBusPlannerRoute`; Klick auf Haltestelle in der Karte |
| Shift-Rampen-Ausgang | `src/main.ts`, `src/game/wayElevation.ts` | `lockShiftElevationOrigin`, `planLockedOriginRamp` |
| Bauvorschau / Bauhöhe / Bodenkachel | `src/game/placementPreview.ts`, `src/game/GameState.ts`, `src/view/WorldView.ts` | `PlacementPreviewRequest/Result` und `previewPlacement` liefern gemeinsame Gültigkeit/Meldung; Halbstufen `snapBuildElevation`; `groundTileMarker`; Werkzeug `stageForecourt` nutzt dieselbe Dry-Run-Prüfung wie die Ausweisung |
| Bühnenwerkstatt | `src/stageEditor.ts`, `src/stageEditor.css` | |
| Werkstatt-Orientierung | `src/view/orientationGizmo.ts` | `createOrientationGizmo`, `OrientationGizmo` |
| Titelbild-Publikum | `src/titleCrowd.ts` | `mountTitleCrowd`, `TitleCrowd.setRunning`, `TitleCrowd.dispose` |
| Personaldetails | `src/staffDetailsUI.ts` | Infofenster, Bereiche; Saugroboter wie Reinigung; 3×3-Zonen per Klick/Ziehen |
| Mobile Leisten | `src/mobileUI.ts`, `src/mobile.css` | Kompaktes Layout bei `max-width: 900px` oder `pointer: coarse`; die Touch-Leiste `.mobile-controls` nur bei Touch. `(max-width: 900px) and (pointer: fine)` blendet sie aus, setzt `--mobile-bottom` und den Statusstreifen tiefer und zeigt `.crowding-panel` oben rechts, weil sonst nur „Ansichten“ der Leiste es öffnet. Der Statusstreifen ist im Schmal-Layout eine seitlich scrollbare Zeile (nicht das Desktop-Raster) und sitzt über der 64 px hohen Touch-Leiste; `--mobile-bottom` reicht bis über ihn |
| Ziehbare Fenster | `src/dragPanel.ts` | |
| Fokus / Texteingabe | `src/uiFocus.ts` | `isTextEntryTarget` |
| Mehrspieler-Chat / Map-Ping | `src/ui/multiplayerChat.ts`, `src/net/chatProtocol.ts` (Sanitize: `server/chatProtocol.ts`) | Eigenes Fenster unten links (ziehbar, größenveränderlich); IRC-Log; Enter öffnet/sendet; Ping-Overlay + Randpfeil; Option „Chat anzeigen“ + Knopf „Chat öffnen“ |
| PWA / Manifest | `public/`, `tests/installableApp.mjs` | kein Leisten-Button; Safari-Anleitung im Root-`README.md` |
| Update-Hinweis | `src/updateNotice.ts` | |
| Globales Styling | `src/style.css` | Shared Checkbox-/Range-Styling; Range-Thumb nutzt `--range-accent` |
| Versionsanzeige | `package.json`, `src/version.d.ts` | unten links inkl. Build-ID |

## Wichtige Regeln

- UI sendet `GameCommand`s bzw. `GameState`-Methoden, berechnet die Welt nicht.
  `main.ts` ist Bootstrap und Modus-Koordinator; Shell, Titelbild, Szenarioformular,
  Save-Archiv, Besucherpanel und Telemetrie-Präsentation besitzen eigene Controller
  mit expliziten Kontextobjekten. Frame-/Hidden-Tab-Takt,
  direkte Werkzeugaktionen, priorisierte Zellrouten, Weg-Ziehzustand,
  Objektpanel, Achterbahn-Baufenster, Katalogaufbau und Archivdarstellung liegen
  in kohäsiven Modulen. Extrahierte Kartenaktionen rufen weiterhin ausschließlich
  die öffentliche `GameState`-Fassade auf und umgehen den Multiplayer-Gate nicht.
  Snapshot-Listener ändern Werkzeug-/Speed-DOM nur bei geändertem Fingerprint.
  Die vorhandenen Panel-Fingerprints bleiben für Personal, Besucher, Tagesplan,
  Beschwerden, Finanzen und Logistik maßgeblich. Im Finanzfenster klappen
  **Betriebskosten**, **Personal**, **Gagen** und **Kreditzinsen** unabhängig
  auf; der Offen-Zustand bleibt beim Tick-Refresh erhalten
  (`src/ui/financePanel.ts`, Aufschlüsselung aus `src/game/financeBreakdown.ts`). Coaster-Palette und
  Busplanerlisten behalten ihre DOM-Knoten bei unverändertem Fach-Fingerprint,
  damit Hover, Fokus und Drag-and-drop nicht abbrechen.
  Kontexthilfe und Ghost-Farbe lesen dasselbe `PlacementPreviewResult`;
  `main.ts` stellt die typisierte Anfrage zusammen und `contextHelp.ts`
  formuliert daraus den Text; `WorldView` berechnet
  keine Platzierungsregeln.
  `describeRoadVehicleActivity` zeigt bei einem geparkten Besucherauto mit
  fehlgeschlagenem Abfahrtsversuch sowie einem abfahrenden Auto ohne Route
  (`waitMinutes > 0`) die fehlende
  Ausfahrtroute samt Hinweis auf Straßenpfeile und Verbindungen. Die Anzeige
  nutzt den bestehenden Snapshot und führt selbst keine Wegsuche aus.
  Infofenster lesen den Snapshot: Müllfahrzeuge zeigen geladenen Müll
  statt Insassen; ein Klick auf eine Müllablage summiert die
  zusammenhängende Fläche (`connectedWasteDumpStats`) zu Gelagert/Frei.
  Der Vorfall-Ticker hängt unten am Bildrand und liest nur den Snapshot
  (Feuer, Massenpanik, volle Müllflächen, Verletzte). Mit Position gibt
  es **Hin** (Kamera wie bei Personal-/Besucherklick). **Meldungen**
  links neben Mehrspieler öffnet die letzten Einträge. Keine
  Sim-Mutation, kein neues Command. Auf Mobile sitzt die Leiste über
  den Touch-Steuerungen.
  Im Mehrspieler ist der Live-Chat ein eigenes Fenster unten links
  (`.mp-chat.panel`): Panel-Header mit ×, `makeDraggable` + `makeResizable`,
  darunter das Log und eine feste Eingabezeile aus Ping-Schalter, Feld und
  **Senden**. Das Fenster existiert nur, solange die Sitzung verbunden **und**
  **Chat anzeigen** eingeschaltet ist; das × merkt sich ein sitzungsweites
  `userClosed`, das eine eingehende Nachricht, **Enter**, der Knopf
  **Chat öffnen** oder das Wiedereinschalten von **Chat anzeigen** aufhebt —
  eine eingehende Nachricht holt das Fenster zurück, ohne den Fokus zu nehmen.
  Das Log liest sich wie ein IRC-Mitschnitt: `[HH:MM] <Name> Text` je Zeile mit
  hängendem Einzug, Nickfarbe deterministisch aus dem Namen; eine reine
  Ping-Nachricht wird zur Aktionszeile. Es folgt dem unteren Rand nur, wenn es
  schon unten stand. **Enter** öffnet das Fenster und fokussiert das Feld,
  **Enter** im Feld sendet (eigener Handler, kein implizites Form-Submit),
  **Esc** gibt den Fokus zurück ans Spiel. Weg-Stückbau behält Enter, solange
  der Pfadeditor aktiv ist. Texteingabe-Fokus blockiert weiterhin Bau-Hotkeys.
  Der Ping-Button markiert den Cursor-Weltpunkt (sonst Kamera-Zentrum) für alle
  Spieler 10 s; außerhalb des sichtbaren Bereichs erscheint ein Randpfeil. 📍 in
  der Nachricht springt die Kamera dorthin. Mehrspieler → **Chat anzeigen** aus
  heißt kein Chatfenster und kein Senden (`localStorage`
  `festival-mp-chat-display`). Details: [multiplayer.md](multiplayer.md).
  Oben rechts sitzt eine RCT-Iconleiste in vier Gruppen: **Bauen** (Abriss,
  Gelände, Kopieren, Deko, Wege, Attraktionen, Autostraßen, Logistik),   **Verwalten**
  (Festival, Bühnenwerkstatt, Logistikverwaltung für Bestellungen/Träger,
  Beschwerden, Besucher, Personal, Meldungen, Mehrspieler),
  **Kartenansichten** (Logistik/Untergrund, Gedränge, Attraktivität,
  Partystimmung) und   **Sitzung** (Finanzen mit aufklappbaren Kostenzeilen, Gelände betreten, Ton stumm, Speichern,
  Rückgängig, Debug-Käfer, Einstellungen). **Rückgängig** (`#undo-last-build`) hängt am
  Host-Bau-Stack (`GameState.undoLastBuild`, Command `undoLastBuild`, nicht im Spielstand);
  das schließt den letzten Bau, Stempel, Parkplatz oder Weg. **Park schließen** sitzt in der
  Festivalverwaltung, nicht mehr in der Leiste. **Ton stumm** (🔊/🔇) und
  Einstellungen → **Ton stumm** teilen `localStorage` (`festival-audio-muted`),
  nicht den Spielstand; siehe [audio.md](audio.md). Die drei Leisten-Dropdowns
  (Personal, Debug, Speichern) stehen im Markup **neben** `.rct-toolbar`, nicht
  darin: die Leiste trägt selbst einen `z-index` und öffnet damit einen
  Stacking-Context, in dem ein Menü unter jedem Fenster landen würde. Als
  Geschwister zählt ihr eigener `z-index: 50` — über allen Spielfenstern,
  unter dem Titelbildschirm (60). Die Spielfenster enden darunter:
  `.staff-details` 45, Festivalfenster (`src/festival.css`) 46,
  Stichtag-Übersicht `.scenario-due` 48. Magazin und Endbildschirm sind
  modale Overlays (90).
  Positioniert werden sie aus dem Live-Rect ihres Knopfes
  (`positionDropdownPanel`), die Verschachtelung ist ihnen also gleichgültig.
  Das Speicher-Dropdown hält
  **Schnell speichern** / **Schnell laden** für den einzelnen
  `SAVE_KEY`-Slot (voller Snapshot inkl. Besucher und Gebäude; IndexedDB
  wenn `localStorage` nicht reicht) neben benannten Ständen, Base64-Export
  und -Import. Das Archiv listet Server-Stände (Konto) und lokale Browser-
  Stände getrennt; fehlt der Server, steht eine deutsche Fehlermeldung
  statt einer leeren Liste. Auf dem Titelbildschirm lädt
  **Schnell laden** denselben Einzelspielstand, ohne das Archiv.
  Debug-Käfer und FPS-/Versionszeile sind standardmäßig sichtbar;
  unter Einstellungen → Debug abschaltbar
  (`localStorage`, nicht im Spielstand). **Autos entfernen** löscht alle
  Besucherautos (nicht Abriss, nicht Flottenfahrzeuge), räumt Parkbelegung
  und setzt Insassen zu Fuß auf den Nachbarweg; die Gäste gehen heim.
  **Nachfrage-Tuning** öffnet ein verschieb-/skalierbares Debugfenster mit
  gruppierten Zahlenfeldern für Zahlungsbereitschaft, faire Preise,
  Akzeptanz, Teilnahme und Anreise. Die Vorschau zeigt aktuelle faire Preise,
  Akzeptanz, Teilnehmer und Erlös. **Standardwerte** füllt nur den Entwurf;
  **Übernehmen** sendet ihn atomar an den Host.
  Die Iconleiste ist etwa ein
  Viertel größer als die alten 32-px-Kacheln. Linke Baupaletten enden
  oberhalb der Debug-/Versionsanzeige unten links.
  **Abriss** öffnet
  kein Fenster, sondern schaltet den Abrissmodus sofort ein oder aus.
  Hover und Klick nutzen denselben Mesh-Raycast wie Info
  (`pickPlacedObject`, Building-IDs auf Instanzen); es fällt das
  getroffene Objekt, nicht die Bodenkachel oder der Nachbar. Vorschau
  folgt Slot/Footprint des Treffers. Rechteckziehen bleibt kachelbasiert.
  Hover nennt Parkplatz und Krankenbereich; Abriss räumt die Kachel
  vollständig (auch verwaiste Belegung). Autostraßen-Abreißen wirkt
  auf Parkbuchten. Touch-Tipp nutzt dieselbe Trefferprüfung.
  Autostraßen teilen das linke Wegeditor-Fenster; die übrigen Bau-Icons
  öffnen Rasterfenster. Linke Paletten füllen die Viewport-Höhe, damit der
  Katalog vollständig sichtbar bleibt. Bauhöhe, Drehen und Ebene sitzen
  nicht mehr im Fensterrand: Shift halten und die Maus hoch/runter
  bewegen setzt `buildElevation` in **halben Stufen (0.5, 0–6)**; ein
  7×7-Baugitter um das Gebäude liegt auf dieser Ebene. Die aktuelle
  Bodenkachel behält immer eine gelbe Umriss-Markierung, auch wenn das
  Geisterobjekt angehoben ist. Shift loslassen behält die Höhe;
  ein neues Werkzeug oder ein neuer Katalogklick setzt sie auf 0.
  Drehen bleibt über `R` bzw. den Deko-Button. **Wege**
  öffnet kein Raster, sondern das RCT-Fußwegfenster (`#path-construction`).
  Oben **Weg** oder **Schlange** (gilt für Ziehen und Stückbau). Stand-Schlangen
  zeigen eine Mittellinie und zwei Pfeile (Anstehen / Zurück); Attraktionen
  eine Spur. Belag
  unter **Art** gedrückt halten. Richtung, Neigung (halbe Stufe) und Bauen
  sind immer sichtbar, im Schnellmodus ausgegraut; Autostraßen nutzen
  dieselbe Neigung (max. eine Stufe über Gelände). Shift halten sperrt die
  Ausgangskachel; Ziehen oder Klick setzt nur die Rampe auf den anderen
  Feldern, der Ausgang bleibt liegen. Shift loslassen oder Werkzeugwechsel
  löst die Sperre.   Die Vorschau zeigt die Rampe vom festen Ausgang zum
  Zeiger. Ein Fußweg über eine Autostraße bleibt gültig und legt einen
  Übergang, ohne die Straße zu löschen. Eine Autostraße eine Stufe über
  einer anderen stapelt eine Brücke statt zu ersetzen. Unten der Streckenbutton mit
  einem Pfeil (Stückbau, Klick überall) bzw. zwei Pfeilen (frei ziehen).
  **Abreißen** entfernt Wege. Statt Laufrichtung: Schnellzugriff auf Tor
  (`pathBarrier`), Personaleingang (`staffGate`, Kante wie das Tor) und Festival-Einlass
  (`securityGate`).   **Dekoration**, **Attraktionen** und **Logistik** sind
  Bildkataloge: feste 96-px-Kacheln im Raster (`auto-fill`, nicht in die
  Breite gestreckt), Standardbreite 440 px. Name, Zusatztext und **Kosten**
  stehen unten und wechseln beim Darüberfahren. Deko: oben Themen-Chips
  (Klassik, Wüste, Wald, Neon, Industrie, Tropen, Mystik, Zirkus, Alpin,
  Arktis, Steampunk), darunter die Kategorien Pflanzen, Möbel, Licht, Fest,
  Kulisse, Zaun nur mit den Stücken des Themas; leere Kategorien entfallen.
  Je Objekt eigene Attraktivität (Overlay Attraktivität). Details:
  [decoration.md](decoration.md).   Attraktionen: Fahrgeschäfte, Achterbahn (Typen als Katalogkacheln),
  Stände (Imbiss, WC, Getränke, Maskottchen, T-Shirt), Camping, Festival
  (Turmhöhe nur unter Fahrgeschäfte). Am T-Shirt-Stand stellt das Infofenster
  Farbe und Schnitt ein.   Logistik:
  Waren, Bus, Müll (`wasteDump`, `sealedWasteContainer`, Depots), Krankenhaus (`ambulanceGarage`, `medicalArea`),
  Tourbus-Parkplatz.
  Der Reiter **Achterbahn** im Attraktionen-Katalog listet jeden Typ
  direkt (Holz, Twister, Junior, Wilde Maus, LIM-Launch, …) wie andere
  Gebäudekacheln. Jede Kachel zeigt eine **generierte Zugvorschau**
  (`coasterTrainThumbnail`, gleicher Wagenstil wie in der Welt), keine
  generischen Achterbahn-Emojis. Ein Klick öffnet das RCT2-artige
  Konstruktionsfenster mit festem Typ (nach der Startplattform
  unveränderlich): Richtung, „Speziell …“, Neigung, Rollen/seitliches
  Kippen, Bauvorschau mit Kosten, Rückbau/Bauen sowie Eingang/Ausgang.
  Stücke, die der Typ **nie** bauen kann (`supportedPieces` / Katalog),
  bleiben ausgeblendet. Stücke, die **aktuell** am offenen Ende nicht
  gehen (falsche Neigung/Bank, Kette, Spezial), bleiben in der Palette
  und sind **ausgegraut** (`disabled`) — das Raster springt nicht.
  Klicks auf graue Buttons ändern die Geisterschiene nicht. Freigegebene
  Neigung/Banking/Richtung switchen fest auf eine legale Kombination
  **beim ersten Klick**; die Geisterschiene nutzt denselben
  `resolveNextTrackPiece`-Helfer wie das Bauen und folgt sofort der
  Fensterwahl. `updateCoasterBuilder` läuft aus dem Snapshot-Listener,
  wendet das Fenster aber nur an, wenn `updateCoasterConstruction`
  eine echte Änderung sieht (offenes Ende, Typ, Wahl, Startpose) —
  nicht bei jedem Besucher-/Fahrzeug-Tick. Zusätzlich hält
  `syncCoasterPalette` stabile Button-IDs und ändert nur `disabled` /
  `active`. Sonst flackert `:hover` und Klicks gehen verloren (wie
  früher die Bus-Haltestellenliste). Die Geisterschiene wird nur neu
  gebaut, wenn sich das Stück wirklich ändert.   Eine fertige Bahn
  öffnet das Infofenster: Betrieb, Preis, **Achterbahn abreißen**
  (nach In-Game-Nachfrage `confirmAction` den Command `removeCoaster`,
  schließt das Fenster). Unfertige Bahnen haben denselben Knopf im
  Konstruktionsfenster; das Abrisswerkzeug fragt ebenfalls nach, wenn
  der Klick bzw. das Rechteck die ganze Bahn treffen würde. Kurse,
  Paintball und Schwimmbad folgen demselben Infofenster: ein Info-Klick
  auf eine gültige Anlage öffnet `#course-options` (Betrieb
  Geschlossen/Geöffnet via `setCourseOperating`, Preis,
  **Konstruktion öffnen**, Abriss). Unfertige Kurse gehen in den
  Builder; **Fertig** prüft und öffnet das Infofenster, ohne den
  Betrieb zu schalten. Kurse mit **Abriss** im Kurseditor oder
  Infofenster nutzen dieselbe Nachfrage. Der Host bekommt
  erst nach Bestätigung das Command — keine serverseitige Extra-Prüfung.
  Untergruppen der übrigen Kategorien stehen in `buildMenu.ts`. Info bleibt
  das Standardwerkzeug.
  Tagesplan und Ticketpreise liegen unter **Festival planen**. Endet das
  Wochenende, liegt automatisch das **HEADLINE Magazin** über der Welt
  (Masthead, Cover, Pro/Kontra, Note) – HTML/CSS, kein 3D-Objekt. Einmal
  pro Ausgabe, außer ihr schlagt es unter Abrechnung & Ruf erneut auf.
  Texte kommen aus `buildHeadlineMagazine` und dem Snapshot, nicht aus der
  UI. Deko-Hilfe und Drehen sitzen in der Deko-Palette.
- Offene Infofenster dürfen die Mittelwertleiste verschieben oder ausblenden;
  aktivierte Karten-Overlays bleiben bestehen. Die Overlay-Schalter sitzen
  in der Iconleiste zwischen Verwalten und Sitzung.
- Logistik-/Untergrund-Overlay blendet Besucher aus und zeigt Bodenmarkierungen;
  der Schalter sitzt in der Gruppe Kartenansichten und öffnet kein Planerfenster.
  Anlieferung, Depot und Personaltor stehen im Baumenü unter Logistik.
  Das Paket-Icon in **Verwalten** öffnet die Logistikverwaltung
  (Übersicht, **Waren & Träger**, Buslinien, **Bandversorgung**).
  Im Reiter **Buslinien** bleiben gewählte Haltestellen erhalten
  (auch nach Kartenklick und Panel-Refresh). Links liegen ungenutzte
  Haltestellen, rechts die Fahrreihenfolge — dieselbe Station steht
  nie in beiden Spalten. Ziehen zwischen den Spalten oder in der
  rechten Liste sortiert; Pfeile bleiben Extra. **Automatisch
  sortieren** (kürzeste Route) ordnet die rechte Liste neu. Solange
  der Reiter offen ist, liegt die aktuelle Route als eine gelbe Linie
  mit Stoppnummern 1, 2, 3 … auf der Karte.
  Einer bestehenden Linie fügt **Bus hinzufügen** einen weiteren Bus
  hinzu (freier Depotbus oder Neukauf). **RTW verkaufen** in der Übersicht
  oder im Infofenster des Krankenwagens: idle an der Garage sofort,
  sonst Rückfahrt und dann Verkauf.
  Mindestbestände (20er-Raster) und Trägerzahl stellt ihr dort im Reiter
  **Waren & Träger** oder im Infofenster ein.
  **Bandversorgung** malt/löscht Backstage, setzt den Tourbus-Parkplatz
  und listet Komponenten; ein Info-Klick auf Backstage füllt das
  Infofenster (`formatBackstageInspect`). Dieselbe Fläche malt ihr auch
  im Baumenü unter Logistik → Bandversorgung (**Backstage ausweisen**).
  Zeit läuft weiter. Einbahnen liegen als StVO-Fahrstreifenpfeile auf der
  Straße und bleiben über den Fahrzeugen sichtbar. Das Werkzeug
  Fahrtrichtung zeigt dieselbe weiße Markierung in der Vorschau.
  Ampel und Wegschranke nutzen dieselbe Richtungspfeil-Vorschau. Nach
  dem Setzen öffnet das Infofenster: vier Modi (Zeit, Sensor, immer
  offen, immer zu), bei zeitgesteuert zusätzlich **Gilt an**
  (Vorbereitung / Festival / Pause) und Zeitquelle (Slots je Stunde,
  Tageszeit-Stundenraster oder Nach Zeitplan aus **Festival planen**),
  bei Toren zusätzlich eine/beide Richtungen und
  **Im Notfall offen**, Gebiet zeichnen
  (Rechteck addiert, nochmaliges Ziehen über die volle Auswahl entfernt)
  und immer aktuelle Zähler für das Gebiet bzw. die gewählte Regel.
  Slot- und Stunden-Buttons bleiben im DOM; nur `aria-pressed` und der
  aktuelle Slot/die aktuelle Stunde
  werden bei Ticks aktualisiert, damit Klicks nicht verloren gehen.
- Touch: ein Finger baut/wählt; zwei Finger Kamera. Flächenwerkzeuge: zweiter
  Finger bricht die Auswahl ab.
- Rechteckwerkzeuge teilen den UI-/World-Vertrag aus `areaDesignation.ts`.
  Er normalisiert Grenzen für Vorschau und Ausführung, bewahrt aber den
  ursprünglichen Startpunkt für fachliche Regeln wie Glätten. Gelände,
  Wege und alle übrigen `WorldView.setGroundAreaTool`-Nutzer behalten ihre
  jeweilige Validierung und Commands.
- Spieler-sichtbare Steuerung und neue Fenster im Root-`README.md` beschreiben.

Autostraßen: Belag per Art-Hold, freies Linienziehen oder Stückbau mit
Richtung, Bauen/Enter und Zurück/Backspace. Bestehende Straßen bleiben beim
Stückbau als Anschluss erhalten und werden durch Zurück nicht entfernt.
Abriss wirkt auf Straßen. Parkplätze, Pfeile, Ampeln, Trennlinien,
Zebrastreifen und Tempolimits bleiben im selben linken Fenster.
Außerhalb dieser Bauansicht (und ohne Logistik-Overlay) bleiben Parkfelder
grauer Asphalt mit Stelllinien; Belegungsfarbe und P sind nur dort Hilfen. Straßen
folgen dem Gelände; die Neigungssteuerung ist deshalb deaktiviert.
Manuell im Browser geprüft: linkes Fenster, Umschalten ohne Werkzeugwechsel
zu Fußwegen, Startpunkt, nächstes Straßenstück und Rückbau.

## Tests

Personal-Einsatzgebiete: **Bereiche verwalten** setzt `WorldView.setStaffZonePaintTool`.
Ziehen bemalt das 3×3-Raster; die Kachel unter dem Zeiger bekommt eine
Hellcyan-Vorschau (`staffZoneHoverOverlay`). Träger-Rechtecke bleiben bei
**Arbeitsbereich ziehen** (`setGroundAreaTool`).

`tests/staffZones.ts` (Zonen-Ziehen). `tests/mobileTouch.ts`. UI-lastige Festival-/Stage-Flows in
`tests/stageInteraction.ts`, `tests/musicPlanning.ts`. Bau-Undo-Stack: `tests/buildUndo.ts`.
Magazin-Modell nach Festivalende:
`tests/headlineMagazine.ts`.
Infotexte für Müllwagen-Ladung und zusammenhängende Ablagen:
`tests/festivalAdditions.ts`. Ticker und Müllkappen: `tests/ticker.ts`.
Debug **Autos entfernen** (Autos weg, Belegung frei, Insassen zu Fuß):
`tests/operations.ts`.
Abriss-Picking (Mesh vor Nachbar/Kachelmitte): `tests/picking.ts`.
Achterbahn-Komplettabriss aus Infofenster/Command: `tests/festivalAdditions.ts`.
Abriss-Nachfrage-Text und Trefferprüfung (Station ohne Gebäude-ID): `tests/uiModules.ts`.
Kurs-Inspect (unfertig → Builder, gültig → Infofenster) für Mudmasters,
Tree-to-Tree, Paintball und Pool: `tests/uiModules.ts`.
Bauhöhe 0.5 und Bodenkachel der Vorschau: `tests/placementPreview.ts`.
Extrahierte Update-Gates, Archivzusammenführung/-Escaping, gemeinsame
Formatierungshelfer, Katalogkacheln und
Werkzeugrouting durch den Multiplayer-Gate, Linien-/Rechteckbildung und
autoritative Kontexthilfe: `tests/uiModules.ts`.
Aufklappbare Finanz-Teilposten und Ledger-HTML: `tests/finance.ts`.

Reiter **Bandversorgung** in `#logistics-panel` plus Backstage-Infofenster:
`tests/bandSupply.ts`, [`band-supply.md`](band-supply.md).

## Bei Änderungen dieses Dokument

Aktualisieren, wenn ein neues Fenster, eine neue Leiste, ein Shortcut oder
ein Mobile-Verhalten dazukommt. Verdrahtung zu Simulation in der jeweiligen
Fach-MD verlinken.

## Deko-Fassaden und Größen (0.1.125)

Jedes Thema außer Klassik hat die Kategorie **Wände**: Vollwand, Halbwand,
Fensterwand und Türbogen. R dreht die Kante, Shift/Bauhöhe ermöglicht Stapeln
in 0,5-Schritten bis Ebene 6. Vollwände sind 1 hoch, Halbwand 0,5.
Die Hover-Hilfe unterscheidet Vollfeld, Viertelfeld und Kante. 23 große
Themenobjekte setzen neue Vollfelder; Vorschau und Abriss markieren ihre Fläche.

## Stabilere Bauhöhe und kontextueller Abriss (0.1.126)

Einmal Shift über einer bebauten Kachel setzt die Bauhöhe auf die höchste
Objektoberkante (auf nächste 0,5-Stufe aufgerundet). Straßen berücksichtigen
1 Höhenstufe Durchfahrt. Ein gehaltener/repetierter Tastendruck löst nicht
neu aus. Mausstart ist die letzte echte Cursorposition; **48 Pixel = 0,5**,
absolute Distanz ab Start statt eventabhängigem Aufsummieren. Kleine Bewegungen
ändern nichts; Dekokachel bleibt beim Höhenziehen fest. Shift+Mausrad setzt
0,5-Schritte und verankert den Mausstart neu. Fokusverlust beendet Ziehen.
Bei Wegen/Straßen bleibt der Ausgang beim Einstellen der Höhe fest; die
separate Neigung wird weiter mit den Neigungsknöpfen gewählt.

Kurzer Rechtsklick: Deko entfernt nur ein getroffenes Dekoobjekt, Wegmodus
nur den Weg, Straßenmodus nur die Straßenlage. Building-ID/Weghöhe schützen
andere Objekte und Lagen. Rechtsziehen bleibt Kamera, andere Modi behalten
ihre bisherigen Aktionen. Bank/Eimer-Vorschauen zeigen die echte automatische
Wegkante. Eimer aus Logistik entfernt, Deko/Möbel enthält alle Varianten.

`src/game/contextDemolition.ts` wählt Abrissziele nach Baumodus, Building-ID
und Straßenlage. `tests/decoration.ts` prüft Deko-/Wegtrennung und den Erhalt
der unteren Straßenlage beim Entfernen einer oberen.

## Schrägdach-Seiten schließen (0.1.128)

Deko → Thema → Wände: **Dachkeil links hoch**, **Dachkeil rechts hoch** und
**Dachabschluss hoch**. Auf die gleiche Bauhöhe wie das Dach setzen; mit R
zur Seiten-/Stirnkante drehen. Zwei gespiegelte Keile bilden einen Giebel
über zwei Felder. Jedes Dachmaterial hat den passenden Wandsatz.

## In Gebäude schauen (0.1.129)

Maus über gebaute Wände oder Dächer halten: Fassaden in der Umgebung werden
weich durchsichtig. Beim Verlassen blenden sie wieder ein. Der Effekt braucht
keine Taste.

Seit 0.1.130: Im Deko-Baumodus bleiben Wände und Dächer vollständig sichtbar.
Außerhalb davon lassen lokal transparent gewordene Fassaden Klicks zu den
Objekten dahinter durch, etwa zu Ständen. Entfernte, undurchsichtige Bauteile
bleiben anklickbar. Der Hover-Test trifft weiterhin die Fassaden, damit der
Einblick beim Durchklicken stabil bleibt.

## RCT-Geländewerkzeuge (0.1.132)

Wasser liegt eine halbe Stufe unter 0. Gäste baden auf gefluteten Feldern.

## Land-Editor drei Flächenwerkzeuge (0.1.134)

Im Reiter **Gelände** nur **Feld anheben**, **Feld senken**, **Glätten**.
Klick oder Ziehen füllt ein Rechteck, keine Linienstriche. Stufe 0,5.
**Glätten** setzt alle getroffenen Felder auf die Höhe unter dem
Startpunkt. Ecke / Einebnen / Wasser-als-Werkzeug sind aus der UI.

## Wegmöbel ausrichten (0.1.131)

Bei Mülleimern dreht **R** die gewünschte freie Kante und die Vorschau folgt
direkt. Bänke werden weiter automatisch am Rand ausgerichtet und können nun
auf Fußwegen sowie auf gleich hohen Straßen platziert werden.
