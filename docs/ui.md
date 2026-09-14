# Benutzeroberfläche und Eingaben

`main.ts` verdrahtet Tools, Fenster und Commands. Fach-UIs liegen daneben,
nicht in `GameState`. Mobile und schmale Layouts haben eigene CSS/Module.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Orchestrierung, Tasten, Tools | `src/main.ts` | RCT-Iconleiste `.rct-toolbar` |
| Bau-Kategorien und Raster | `src/game/buildMenu.ts` | `BUILD_CATEGORIES` |
| Festival-Verwaltung | `src/festivalUI.ts`, `src/festival.css` | |
| Bandplan | `src/musicPlanner.ts` | |
| Geländeplaner / Wegbelag | `src/logisticsUI.ts`, `src/logistics.css` | Overlay über `WorldView.setLogisticsMode`; Fußweg-Art-Hold |
| Bühnenwerkstatt | `src/stageEditor.ts`, `src/stageEditor.css` | |
| Personaldetails | `src/staffDetailsUI.ts` | Infofenster, Bereiche; Saugroboter wie Reinigung |
| Mobile Leisten | `src/mobileUI.ts`, `src/mobile.css` | |
| Ziehbare Fenster | `src/dragPanel.ts` | |
| Fokus / Texteingabe | `src/uiFocus.ts` | `isTextEntryTarget` |
| PWA / Manifest | `src/appInstall.ts`, `public/` | kein Leisten-Button; Safari-Anleitung im Root-`README.md` |
| Update-Hinweis | `src/updateNotice.ts` | |
| Globales Styling | `src/style.css` | |
| Versionsanzeige | `package.json`, `src/version.d.ts` | unten links inkl. Build-ID |

## Wichtige Regeln

- UI sendet `GameCommand`s bzw. `GameState`-Methoden, berechnet die Welt nicht.
  Oben rechts sitzt eine RCT-Iconleiste in vier Gruppen: **Bauen** (Abriss,
  Gelände, Deko, Wege, Attraktionen, Autostraßen, Logistik), **Verwalten**
  (Festival, Bühnenwerkstatt, Logistikverwaltung für Bestellungen/Träger,
  Beschwerden, Besucher, Personal, Mehrspieler),
  **Kartenansichten** (Logistik/Untergrund, Gedränge, Attraktivität,
  Partystimmung) und **Sitzung** (Finanzen, Gelände betreten, Speichern,
  Park, Debug-Käfer, Einstellungen). Debug-Käfer und FPS-/Versionszeile
  sind standardmäßig sichtbar; unter Einstellungen → Debug abschaltbar
  (`localStorage`, nicht im Spielstand). Die Iconleiste ist etwa ein
  Viertel größer als die alten 32-px-Kacheln. Linke Baupaletten enden
  oberhalb der Debug-/Versionsanzeige unten links.
  **Abriss** öffnet
  kein Fenster, sondern schaltet den Abrissmodus sofort ein oder aus.
  Autostraßen teilen das linke Wegeditor-Fenster; die übrigen Bau-Icons
  öffnen Rasterfenster. Linke Paletten füllen die Viewport-Höhe, damit der
  Katalog vollständig sichtbar bleibt. Bauhöhe, Drehen und Ebene sitzen
  nicht mehr im Fensterrand: Shift halten und die Maus hoch/runter
  bewegen setzt `buildElevation` (0–6); ein 7×7-Baugitter um das
  Gebäude liegt auf dieser Ebene. Shift loslassen behält die Höhe;
  ein neues Werkzeug oder ein neuer Katalogklick setzt sie auf 0.
  Drehen bleibt über `R` bzw. den Deko-Button. **Wege**
  öffnet kein Raster, sondern das RCT-Fußwegfenster (`#path-construction`).
  Oben **Weg** oder **Schlange** (gilt für Ziehen und Stückbau). Stand-Schlangen
  zeigen eine Mittellinie und zwei Pfeile (Anstehen / Zurück); Attraktionen
  eine Spur. Belag
  unter **Art** gedrückt halten. Richtung, Neigung und Bauen sind immer
  sichtbar, im Schnellmodus ausgegraut. Unten der Streckenbutton mit
  einem Pfeil (Stückbau, Klick überall) bzw. zwei Pfeilen (frei ziehen).
  **Abreißen** entfernt Wege. Statt Laufrichtung: Schnellzugriff auf Tor
  (`pathBarrier`), Personaleingang (`staffGate`, Kante wie das Tor) und Festival-Einlass
  (`securityGate`). **Dekoration**, **Attraktionen** und **Logistik** sind
  Bildkataloge: feste 96-px-Kacheln im Raster (`auto-fill`, nicht in die
  Breite gestreckt), Standardbreite 440 px. Name, Zusatztext und **Kosten**
  stehen unten und wechseln beim Darüberfahren. Attraktionen: Fahrgeschäfte,
  Stände (Imbiss, WC, Getränke, Maskottchen, T-Shirt), Camping, Festival
  (Turmhöhe nur unter Fahrgeschäfte). Am T-Shirt-Stand stellt das Infofenster
  Farbe und Schnitt ein. Logistik:
  Waren, Bus, Müll, Krankenhaus (`ambulanceGarage`, `medicalArea`).
  Der Achterbahn-Eintrag öffnet ein RCT2-artiges sequenzielles Fenster:
  Richtung, „Speziell …“, Neigung, Rollen/seitliches Kippen, Bauvorschau
  mit Kosten, Rückbau/Bauen sowie Eingang/Ausgang.
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
Zebrastreifen und Tempolimits bleiben im selben linken Fenster. Straßen
folgen dem Gelände; die Neigungssteuerung ist deshalb deaktiviert.
Manuell im Browser geprüft: linkes Fenster, Umschalten ohne Werkzeugwechsel
zu Fußwegen, Startpunkt, nächstes Straßenstück und Rückbau.

## Tests

`tests/mobileTouch.ts`. UI-lastige Festival-/Stage-Flows in
`tests/stageInteraction.ts`, `tests/musicPlanning.ts`.

## Bei Änderungen dieses Dokument

Aktualisieren, wenn ein neues Fenster, eine neue Leiste, ein Shortcut oder
ein Mobile-Verhalten dazukommt. Verdrahtung zu Simulation in der jeweiligen
Fach-MD verlinken.
