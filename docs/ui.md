# Benutzeroberfläche und Eingaben

`main.ts` verdrahtet Tools, Fenster und Commands. Fach-UIs liegen daneben,
nicht in `GameState`. Mobile und schmale Layouts haben eigene CSS/Module.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Orchestrierung, Tasten, Tools | `src/main.ts` | RCT-Iconleiste `.rct-toolbar` |
| Abriss-/Info-Picking | `src/view/WorldView.ts`, `src/view/picking.ts` | `pickPlacedObject`, `resolvePickedBuilding` |
| Infofenster Müllwagen / Ablage | `src/main.ts`, `src/game/logistics.ts`, `src/game/waste.ts` | `formatRoadVehicleInspectLoad`, `connectedWasteDumpStats` |
| Meldungs-Ticker | `src/tickerUI.ts`, `src/game/ticker.ts` | `mountTickerUI`, `observeTickerEvents` |
| Bau-Kategorien und Raster | `src/game/buildMenu.ts` | `BUILD_CATEGORIES` |
| Festival-Verwaltung | `src/festivalUI.ts`, `src/festival.css` | |
| Bandplan | `src/musicPlanner.ts` | |
| Geländeplaner / Wegbelag | `src/logisticsUI.ts`, `src/logistics.css` | Overlay über `WorldView.setLogisticsMode`; Fußweg-Art-Hold |
| Shift-Rampen-Ausgang | `src/main.ts`, `src/game/wayElevation.ts` | `lockShiftElevationOrigin`, `planLockedOriginRamp` |
| Bauhöhe / Bodenkachel | `src/game/placementPreview.ts`, `src/view/WorldView.ts` | Halbstufen `snapBuildElevation`; `groundTileMarker` auf der Hover-Kachel |
| Bühnenwerkstatt | `src/stageEditor.ts`, `src/stageEditor.css` | |
| Personaldetails | `src/staffDetailsUI.ts` | Infofenster, Bereiche; Saugroboter wie Reinigung; 3×3-Zonen per Klick/Ziehen |
| Mobile Leisten | `src/mobileUI.ts`, `src/mobile.css` | |
| Ziehbare Fenster | `src/dragPanel.ts` | |
| Fokus / Texteingabe | `src/uiFocus.ts` | `isTextEntryTarget` |
| PWA / Manifest | `src/appInstall.ts`, `public/` | kein Leisten-Button; Safari-Anleitung im Root-`README.md` |
| Update-Hinweis | `src/updateNotice.ts` | |
| Globales Styling | `src/style.css` | |
| Versionsanzeige | `package.json`, `src/version.d.ts` | unten links inkl. Build-ID |

## Wichtige Regeln

- UI sendet `GameCommand`s bzw. `GameState`-Methoden, berechnet die Welt nicht.
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
  Oben rechts sitzt eine RCT-Iconleiste in vier Gruppen: **Bauen** (Abriss,
  Gelände, Deko, Wege, Attraktionen, Autostraßen, Logistik),   **Verwalten**
  (Festival, Bühnenwerkstatt, Logistikverwaltung für Bestellungen/Träger,
  Beschwerden, Besucher, Personal, Meldungen, Mehrspieler),
  **Kartenansichten** (Logistik/Untergrund, Gedränge, Attraktivität,
  Partystimmung) und **Sitzung** (Finanzen, Gelände betreten, Speichern,
  Park, Debug-Käfer, Einstellungen). Das Speicher-Dropdown hält
  **Schnell speichern** / **Schnell laden** für den einzelnen
  `SAVE_KEY`-Slot (`GameState.save` / `GameState.load`) neben benannten
  Ständen, Base64-Export und -Import. Auf dem Titelbildschirm lädt
  **Schnell laden** denselben Einzelspielstand, ohne das Archiv.
  Debug-Käfer und FPS-/Versionszeile sind standardmäßig sichtbar;
  unter Einstellungen → Debug abschaltbar
  (`localStorage`, nicht im Spielstand). **Autos entfernen** löscht alle
  Besucherautos (nicht Abriss, nicht Flottenfahrzeuge), räumt Parkbelegung
  und setzt Insassen zu Fuß auf den Nachbarweg; die Gäste gehen heim.
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
  stehen unten und wechseln beim Darüberfahren. Deko-Gruppen: Pflanzen, Möbel,
  Licht, Fest, Kulisse, Zaun — je Objekt eigene Attraktivität (Overlay
  Attraktivität). Attraktionen: Fahrgeschäfte,
  Stände (Imbiss, WC, Getränke, Maskottchen, T-Shirt), Camping, Festival
  (Turmhöhe nur unter Fahrgeschäfte). Am T-Shirt-Stand stellt das Infofenster
  Farbe und Schnitt ein. Logistik:
  Waren, Bus, Müll, Krankenhaus (`ambulanceGarage`, `medicalArea`).
  Der Achterbahn-Eintrag öffnet ein RCT2-artiges sequenzielles Fenster:
  Richtung, „Speziell …“, Neigung, Rollen/seitliches Kippen, Bauvorschau
  mit Kosten, Rückbau/Bauen sowie Eingang/Ausgang. Eine fertige Bahn
  öffnet das Infofenster: Betrieb, Preis, **Achterbahn abreißen**
  (Command `removeCoaster`, schließt das Fenster). Unfertige Bahnen
  haben denselben Knopf im Konstruktionsfenster.
  Untergruppen der übrigen Kategorien stehen in `buildMenu.ts`. Info bleibt
  das Standardwerkzeug.
  Tagesplan und Ticketpreise liegen unter **Festival planen**. Deko-Hilfe
  und Drehen sitzen in der Deko-Palette.
- Offene Infofenster dürfen die Mittelwertleiste verschieben oder ausblenden;
  aktivierte Karten-Overlays bleiben bestehen. Die Overlay-Schalter sitzen
  in der Iconleiste zwischen Verwalten und Sitzung.
- Logistik-/Untergrund-Overlay blendet Besucher aus und zeigt Bodenmarkierungen;
  der Schalter sitzt in der Gruppe Kartenansichten und öffnet kein Planerfenster.
  Anlieferung, Depot und Personaltor stehen im Baumenü unter Logistik.
  Das Paket-Icon in **Verwalten** öffnet die Logistikverwaltung.
  Mindestbestände (20er-Raster) und Trägerzahl stellt ihr dort im Reiter
  **Waren & Träger** oder im Infofenster ein.
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
`tests/stageInteraction.ts`, `tests/musicPlanning.ts`.
Infotexte für Müllwagen-Ladung und zusammenhängende Ablagen:
`tests/festivalAdditions.ts`. Ticker und Müllkappen: `tests/ticker.ts`.
Debug **Autos entfernen** (Autos weg, Belegung frei, Insassen zu Fuß):
`tests/operations.ts`.
Abriss-Picking (Mesh vor Nachbar/Kachelmitte): `tests/picking.ts`.
Achterbahn-Komplettabriss aus Infofenster/Command: `tests/festivalAdditions.ts`.
Bauhöhe 0.5 und Bodenkachel der Vorschau: `tests/placementPreview.ts`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn ein neues Fenster, eine neue Leiste, ein Shortcut oder
ein Mobile-Verhalten dazukommt. Verdrahtung zu Simulation in der jeweiligen
Fach-MD verlinken.
