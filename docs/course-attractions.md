# Kurs-Attraktionen

Die Kurse verwenden die gemeinsame Attraktionsgrundlage aus
[`attractions.md`](attractions.md):

- **Strecke:** Mudmasters und Tree-to-Tree speichern echte gerichtete
  Spannweiten mit Start- und Endpunkt sowie Start-/Endhöhe. Gäste bewegen sich
  interpoliert auf dieser Mittellinie.
- **Fläche:** Paintball ist eine `area`-Attraktion mit Referenzen.
  Schwimmbecken sind verbundene `swimArea`-Wasserflächen. Benachbarte
  `poolBasin`-Kacheln derselben Attraktion bilden eine zusammenhängende
  Wasserfläche ohne Zwischenwände.
- **Wasserrutsche:** eigene path-led `track`-Attraktion (`COURSE_KINDS.waterSlide`,
  `editorMode: directionArrows`). Sie startet immer mit stapelbaren Leitern,
  die Rutsche kommt danach, das Ende ist Auslauf/`poolBasin` — keine Leiter.

Der Spieler baut Stück für Stück — kein Ein-Klick-Fertigpark.
Achterbahnen bleiben in [`coaster.md`](coaster.md) / [`attractions.md`](attractions.md).

## Wo finden

| Aufgabe | Vollständiger Pfad | Einstieg / Symbol |
| --- | --- | --- |
| Gemeinsame Typen / Regeln | `src/game/attractions/types.ts`, `definitions.ts`, `construction.ts` | `Attraction`, Registry, Abschlussvalidierung |
| Strecken / Flächen | `src/game/attractions/trackGraph.ts`, `areaLayout.ts` | Graph-Neuordnung, Area-Referenzen |
| Eigener Kurseditor | `src/ui/courseBuilderPanel.ts` | Palette, Ebene, `editorMode`, `courseDirectionIcon`, `courseDirectionChoicesForPanel`, `isCourseBuildReady`, `normalizeCourseRotation` |
| Bauanker / Ghost / Pfeile | `src/game/courseAttractions.ts` | `courseTrackEnd`, `courseNextBuildTarget`, `courseGhostSpan`, `COURSE_HEADINGS`, `listCourseDirectionChoices`, `describeCourseAppendIssue`, `COURSE_SPECS.editorMode` |
| Editor-Modus | `src/game/trackEditorMode.ts` | `editorMode: 'palette' \| 'directionArrows'` |
| Typen, Katalog, Validierung, Tick | `src/game/courseAttractions.ts` | `appendCourseAreaCell`, `appendCoursePiece`, `courseTrackEnd`, `validateCourse`, `isCourseReadyToOperate`, `formatCourseInspect`, `stepCourses`, `COURSE_RIDER_THOUGHTS` |
| Platzieren / Betrieb / Preis / Team | `src/game/GameState.ts` | `startCourseArea`, `addCourseAreaCells`, `removeCourseAreaCells`, `startCourse`, `addCoursePiece`, `undoCoursePiece`, `setCourseOperating`, `setCoursePrice`, `setCourseTeamSize`, `removeCourse` |
| Balancing | `src/game/simulationConfig.ts` | `courses` (`paintballTeamSize*`, `slideLaunchSpeed`, `slideGravity`, `capacity.waterSlide`); Leerlauf `economy.pauseUpkeepMultiplier` |
| Abschlussbelohnung | `src/game/attractionFun.ts`, `src/game/attractions/runtime.ts`, `src/game/courseAttractions.ts` | `courses.funGain`, gemeinsame Runtime und Legacy-Projektion |
| Unterhalt | `src/game/upkeep.ts` | `courseHourlyUpkeep` |
| Commands | `src/net/protocol.ts`, `src/net/commands.ts`, `src/net/bind.ts` | atomare `startCourseArea`/`addCourseAreaCells`/`removeCourseAreaCells`; außerdem `startCourse`, `addCoursePiece`, `undoCoursePiece`, Betrieb/Preis/Team/Abriss |
| Bau-UI | `src/ui/courseBuilderPanel.ts`, `src/app/shell.ts` | `#course-builder`, Palette, Ebene, Teamgröße |
| Infofenster | `src/ui/entityPanel.ts`, `src/app/shell.ts`, `src/main.ts` | `#entity-panel` / `#course-options`; Betrieb, Preis, Konstruktion, Abriss |
| Inspect-Routing | `src/input/cellToolHandlers.ts` | `handleInspectCell`: gültiger Kurs → Infofenster, unfertig → Builder |
| Komplettabriss-Nachfrage | `src/ui/confirmDialog.ts` | `#demolish-course` und `#demolish-course-inspect` fragen lokal nach (`rideDemolishPrompt('course')`), dann `removeCourse` |
| Baumenü | `src/game/buildMenu.ts`, `src/ui/buildCatalog.ts` | Gruppe *Kurse*, Tool `course` |
| Klick / Fläche ziehen | `src/main.ts`, `src/input/pathToolController.ts`, `src/input/toolRouter.ts` | Endpunkte/Hindernisse klicken; Anlagenfläche ziehen |
| Gäste | `src/game/visitorBehavior.ts` | `findReachableCourse`; Becken über `isCourseSwimCell` / `ensureSwimGoals` |
| Darstellung | `src/view/CourseView.ts`, `src/view/courseBasinMesh.ts` | zusammengeführte Spannweiten/Flächenränder, InstancedMesh für Fläche und Gegenstände, Becken-Nachbar-Maske und greedy Wasserrechtecke, Landemarkierung; `addBridgeOrTreeObstacle` |
| Tests | `tests/courseAttractions.ts` | `testCourseAttractions` |

## Konstruktion

`startCourse` legt einen **leeren** Kurs an. Bei Mudmasters/Tree-to-Tree wird
der Eingang zum ersten Streckenpunkt; bei Schwimmbad/Paintball wird das erste
Flächenfeld angelegt. `operating` bleibt aus, bis der Spieler die gültige Anlage im Infofenster öffnet (`setCourseOperating`).
Eine gezogene Fläche wird atomar über `startCourseArea` beziehungsweise
`addCourseAreaCells` angelegt: Kosten- und Kollisionsfehler hinterlassen
keine halbe Rechteckauswahl. `removeCourseAreaCells` ist das
Flächen-Löschwerkzeug; belegte Felder und eine Trennung der Restfläche werden
abgewiesen. Gegenstände und Streckenspannen kommen über `addCoursePiece`.
`WorldView` muss das Werkzeug `course` ausdrücklich in die
Pointer-Drag-Werkzeugliste aufnehmen; andernfalls erreicht weder die
Linien- noch die Rechteckauswahl den `pathToolController`. Ein einfacher
Klick auf ein Linien-/Flächenwerkzeug wird zusätzlich als Ein-Zellen-Auswahl
ausgeführt und darf nicht still verschwinden.

### Bedienmuster: wie der Achterbahneditor

Die Kurseditoren folgen dem Track-Editor ([`coaster.md`](coaster.md)) und nicht
umgekehrt. Gleiches Muster, eigene Regeln:

1. **Bauanker** ist das offene Streckenende (`courseTrackEnd`); der Status
   zeigt Feld, Höhe, Richtung und Stückzahl.
2. **Baurichtung** kommt aus `game.snapshot.buildRotation`. Im
   `directionArrows`-Modus setzt ein Pfeil sie direkt (`setBuildRotation`);
   im Palette-Modus dreht `#course-rotate`. `COURSE_HEADINGS` teilt die
   Reihenfolge mit Achterbahn und Wegwerkzeug.
3. **Ghost** vor dem Klick: `courseGhostSpan` liefert die Spanne vom Anker zum
   Zielfeld plus `valid`. `WorldView.setCourseConstructionPreview` zeichnet ihn
   grün/rot und baut nur bei geändertem Key neu. `valid` prüft nur, was ohne
   Welt entscheidbar ist (Flächenkurse dürfen die Spanne nicht verlassen);
   `appendCoursePiece` bleibt die autoritative Prüfung.
4. **Nächstes Stück**: `COURSE_SPECS[kind].editorMode` entscheidet die Chrome.
  Path-led Kurse (`mudmasters`, `treeToTree`, `pool`, `waterSlide`) nutzen
  `directionArrows`: am Anker erscheint dasselbe 4er-Richtungsraster wie bei
  Wegen (`#course-direction-grid`). Nur legale, noch nicht bebaute
  Nachbarn sind aktiv; ein Klick setzt `buildRotation` und ruft
  `addCoursePiece` auf. Der große Knopf **Am Ende bauen** bleibt in diesem
  Modus verborgen. Paintball bleibt `palette` (Fläche, kein Nachbar-Menü).
   Achterbahnen bleiben `palette` über `COASTER_CATALOG.editorMode`.
   Kartenklicks und Linienzüge bleiben zusätzlich erlaubt.
5. **Rückgängig** entfernt genau das letzte Stück (`undoCoursePiece`); ohne
   Stücke fällt es auf das letzte Flächenfeld zurück.
6. **Abriss** (`#demolish-course`) fragt wie die Achterbahn nach, ob der
   ganze Kurs weg soll (Name in der Nachfrage), und sendet erst danach
   `removeCourse`.

Kurseingänge verwenden dieselbe gerichtete Warteschlangenlogik wie
Fahrgeschäft- und Achterbahneingänge: Ein orthogonal angrenzender `queue`-Weg
wird vom Eingang aus beansprucht, die zusammenhängende Kette zeigt zum Kurs,
und Besucher routen zum äußeren Ende der Schlange. Ohne angeschlossene
Warteschlange ist der Kurs kein erreichbares Besucherziel.
Reservierte Gäste bleiben während des Hinwegs `seeking` und werden erst
eingelassen, nachdem sie das äußere Queue-Ende erreicht haben und `queuing`
sind. **Fertig** prüft `validateCourse` und schließt den Editor; bei Erfolg
öffnet das Infofenster (`#entity-panel`, `#course-options`). Das Schließen-X
beendet nur den Editor. Öffnen und Schließen sitzen **nicht** im Baumenü,
sondern im Infofenster (`setCourseOperating`, host-autoritativ, bereits
MP-gebunden). Ein Info-Klick auf einen gültigen Kurs (Mudmasters,
Tree-to-Tree, Paintball, Schwimmbad, Wasserrutsche) öffnet dasselbe Fenster; unfertige
Anlagen gehen weiter in den Konstruktionseditor. **Konstruktion öffnen**
im Infofenster kehrt zum Builder zurück.

- **Mudmasters:** linearer Streckeneditor. Nach dem Eingang wird automatisch
  `path` gewählt. Eine Linie beginnt am aktuellen Streckenende (Ziehen in
  Gegenrichtung ist ebenfalls erlaubt) und wird als geordnete Folge einzelner
  Nachbarfelder angelegt. So bleibt die Richtung auch bei direkt
  nebeneinanderliegenden Abschnitten eindeutig. Dynamische Hindernisse
  (Kletterwand, Seilschwung, Wassergraben, Kriechtunnel, Rutsche, Leiter,
  Sprung, Hangelstrecke) werden als verbundene Geometrie über die komplette
  Spanne gebaut. Mehrere Ebenen über den Ebenen-Regler.
- **Schwimmbad:** zuerst zusammenhängende Anlagenfläche, dann Beckenelemente,
  Eingang/Ausgang darin. Nur `poolBasin` ist Schwimmwasser; die Fläche selbst
  ist Beckenumgang. Orthogonal benachbarte Becken derselben Attraktion und
  derselben Höhe teilen sich eine Wasserfläche (greedy Rechtecke, ein
  InstancedMesh) und verlieren die Innenwände; der Außenrand bleibt der
  Beckenrand. Dasselbe gilt für Wasserrutschen-Auslaufbecken.
- **Wasserrutsche:** eigener Katalogeintrag und Editor. `startCourse` setzt
  immer die erste Leiter. Weitere Leitern kommen **auf dieselbe Kachel**
  (stapelbar, Höhe +1), nicht als Nachbar und nicht nach dem ersten
  Rutschstück. Danach `waterSlide`-Spannen per Richtungspfeil; das Ende ist
  `poolBasin`/Ausgang mit Wasser. Am letzten Rutschstück heben Gäste mit
  `slideLaunchSpeed`/`slideGravity` ab, wenn kein verbundenes Becken folgt.
  Wasser = sicher, Boden = `injured`; Sanitäter übernehmen über den normalen
  Verletzten-Workflow. Alte Pool-Saves mit `waterSlide`-Stücken werden in
  `normalizeCourses` auf eigene Kurse (`id-slide-N`) aufgeteilt.
- **Tree-to-Tree:** Bäume sind frei platzierte Knoten. Leiter, Umrundung,
  Hängebrücke, Kletterhindernis, Seilschwung und Seilbahn enden auf einem
  Zielbaum und werden zwischen den Bäumen gespannt. Der verbindende Weg folgt
  derselben feldweisen, richtungsfesten Linienführung wie Mudmasters.
  `treeRing` rendert einen umlaufenden Kronensteg; Gäste laufen ihn sichtbar ab.
- **Paintball:** zuerst zusammenhängende Spielfläche, dann Deckungen und je
  einen Start für beide Teams innerhalb der Fläche. Ein-/Ausgang müssen auf
  dem Rand liegen. `teamSize` ist 1–8; nach der deterministischen Tick-Runde
  verlassen beide Teams das Feld am Ausgang.
  Bis beide Teams voll sind, bleiben bereits eingelassene Gäste sichtbar an
  ihren Teamstarts; erst dann beginnt die Matchbewegung über Feld und Deckungen.
  `paintballMatchTicks` hält eine Runde bewusst deutlich länger,
  `paintballMoveIntervalTicks` begrenzt Positionswechsel und
  `paintballShotCycleTicks` steuert die sichtbaren Projektilsalven. Diese
  Balancingwerte liegen ausschließlich in `simulationConfig.ts`.

`createSeededCourse` / `DEFAULT_LAYOUTS` bleiben Beispiel-Grundrisse für Tests,
nicht der Spieler-Baupfad.

## Wichtige Invarianten

- Snapshot v31 speichert Kurse in `attractions`. `courses` ist die editierte
  und getickte Form; der kanonische Datensatz wird danach über
  `refreshLegacyAttractionRecords` nachgezogen, `removeCourse` räumt ihn über
  `dropLegacyAttractionRecords` ab (inklusive abgeleiteter
  `-slide-`-Rutschen). `migrateCourse` schreibt auch Eingangs-only-Kurse
  (leerer Graph, Access vom Eingang), sonst wirft ein Attractions-Delta den
  Live-Kurs weg: Kachel bleibt beim Host belegt, der Client findet keine
  Entity. `applyNetworkUpdate` behandelt `courses`/`coasters` wie Camping —
  Live-Array gewinnt, eine Projektion merget fehlende IDs nach.
  `stepAttractions` überspringt Kurs-IDs, sonst laufen Kurse doppelt.
  v30-Pool/Paintball werden einmalig konvertiert; nicht eindeutig
  konvertierbare Anlagen stehen in `migrationReport.removedAttractionIds`.
- Host-autoritative Commands, keine Render-Mutation.
- Verbundene Details werden in ein statisches Vertex-Color-Mesh
  zusammengeführt; Flächen und Punktobjekte bleiben instanziert. Die
  Geometrie wird nur bei einer Bausignaturänderung neu erstellt.
  Für `poolBasin`-Ränder nutzt `courseBasinMesh` eine Kantenmaske: nur Kanten
  ohne Nachbarbecken derselben Attraktion und Höhe werden gezeichnet. Wasser
  wird je Attraktion in Rechtecke zusammengefasst, nicht Kachel für Kachel.
- Jede gerichtete Strecke erzeugt deduplizierte Übergangsknoten an Start- und
  Endpunkten. Mudmasters nutzt Erd-/Holzpodeste, Tree-to-Tree runde
  Kronenplattformen mit Geländerpfosten und Schwimmbad rutschfeste
  Ablaufroste. Erhöhte Knoten erhalten Stützen bis zum Boden. Dadurch bleiben
  beliebige Folgen verschiedener Bauteile optisch verbunden, ohne doppelte
  Plattformen am gemeinsamen Endpunkt.
- Die vier Modellfamilien bleiben stilistisch getrennt: Mudmasters verwendet
  Holz, Erde, farbige Griffe und echte Hindernisrahmen; Tree-to-Tree besitzt
  Wurzelbäume, Kronenplattformen, einzelne Brückenplanken, durchhängende Seile
  und Seilbahnrollen; Schwimmbad nutzt verfugte Deckflächen, Beckenränder,
  Wasseroberflächen, Rutschenwangen und Metallstützen; Paintball nutzt
  unregelmäßigen Rasen, Netzgrenzen, Bunker, Fässer und Teamunterstände.
- Unterhalt nutzt denselben Leerlauf-Faktor wie Buden
  (`economy.pauseUpkeepMultiplier`, 5 %), sobald `festivalIsLive` falsch ist
  (Planung, Vorbereitung, Pause, beendet, Sandbox).
- Queue/Einlass teilen das Ride-Angebot (`isOfferCurrentlyActive('rides')`).
- `needs.fun` steigt um `SIMULATION_CONFIG.courses.funGain` erst nach einem
  erfolgreich beendeten Lauf, einer beendeten Schwimmbadnutzung oder einer
  abgeschlossenen Paintballrunde. Reservierung, Anstehen und Einlass allein
  geben keinen Spaß; die Gutschrift ist bei 100 gedeckelt.
- Streckenkosten skalieren mit der Spannweitenlänge; Undo erstattet dieselbe
  Länge. Flächen kosten pro Feld.
- Flächenrechtecke sind ein einzelner host-autoritärer Befehl, nicht ein
  Netzwerkcommand pro Zelle. Hinzufügen und Entfernen bleibt vollständig
  atomar.
- Pool-/Paintball-Gegenstände dürfen die eigene Fläche belegen, aber nicht
  außerhalb liegen. Fremde Anlagen und Weltobjekte blockieren weiterhin.
- `courseSpanCells` rastert die gesamte gerade Spannweite. `GameState`
  verweigert den Bau, sobald eine dieser Zellen ein Weltobjekt oder eine
  fremde Anlage durchqueren würde; nur den Zielpunkt zu prüfen reicht nicht.

## Tests

`tests/courseAttractions.ts`: Legacy-Beispielgraph gültig, echte Mudmaster-
und Tree-Spannweiten, Besucherbewegung zwischen Endpunkten, Flächenzwang,
Betrieb erst nach Validierung, Paintball-Teamgröße, Becken als Schwimmzelle,
Becken-Nachbar-Maske und greedy Wasserflächen, Verletzung ohne Wasserlandung,
Abschluss-Spaß sowie **Editor-Modus**
(`mudmasters`/`treeToTree`/`pool`/`waterSlide` = `directionArrows`,
Paintball = `palette`) und Pfeile nur in freien Nachbarrichtungen.
Wasserrutsche: Startleiter, Stapel, keine Leiter nach der Rutsche,
Auslauf-Wasser, Infofenster. MP-Command-Roundtrip `startCourse` /
`startCoaster` über `applyGameCommand` + `WorldUpdates`/`applyNetworkWorld`
hält Occupancy und Entity nach Host-Ack und nach einem stale
Attractions-Delta zusammen. Zusätzlich Infotext (`formatCourseInspect`) und
`isCourseReadyToOperate` für alle Kursarten.
`tests/uiModules.ts` prüft die Panel-Auswahl der Pfeile und das
Inspect-Routing (unfertig → Builder, gültig → Infofenster, inkl. Wasserrutsche).
`tests/coasterTypes.ts` hält alle Achterbahnen auf `palette`.

## Bei Änderungen dieses Dokuments

Neue Stückarten, Commands oder Kurs-Typen hier, in `docs/README.md`,
`AGENTS.md`, `docs/multiplayer.md` und `docs/saves.md` nachziehen.
