# Kurs-Attraktionen

Die Kurse verwenden die gemeinsame Attraktionsgrundlage aus
[`attractions.md`](attractions.md):

- **Strecke:** Mudmasters und Tree-to-Tree speichern echte gerichtete
  Spannweiten mit Start- und Endpunkt sowie Start-/Endhöhe. Gäste bewegen sich
  interpoliert auf dieser Mittellinie.
- **Fläche:** Paintball ist eine `area`-Attraktion mit Referenzen.
  Schwimmbecken sind verbundene `swimArea`-Wasserflächen; Wasserrutschen sind
  eigene Open-Exit-`track`-Attraktionen und müssen im Wasser landen.

Der Spieler baut Stück für Stück — kein Ein-Klick-Fertigpark.
Achterbahnen bleiben in [`coaster.md`](coaster.md) / [`attractions.md`](attractions.md).

## Wo finden

| Aufgabe | Vollständiger Pfad | Einstieg / Symbol |
| --- | --- | --- |
| Gemeinsame Typen / Regeln | `src/game/attractions/types.ts`, `definitions.ts`, `construction.ts` | `Attraction`, Registry, Abschlussvalidierung |
| Strecken / Flächen | `src/game/attractions/trackGraph.ts`, `areaLayout.ts` | Graph-Neuordnung, Area-Referenzen |
| Gemeinsamer Editor | `src/ui/attractionBuilderPanel.ts` | RCT2-Palette, offene Enden, Höhe/Banking |
| Typen, Katalog, Validierung, Tick | `src/game/courseAttractions.ts` | `appendCourseAreaCell`, `appendCoursePiece`, `courseTrackEnd`, `validateCourse`, `stepCourses`, `COURSE_RIDER_THOUGHTS` |
| Platzieren / Betrieb / Preis / Team | `src/game/GameState.ts` | `startCourseArea`, `addCourseAreaCells`, `removeCourseAreaCells`, `startCourse`, `addCoursePiece`, `undoCoursePiece`, `setCourseOperating`, `setCoursePrice`, `setCourseTeamSize`, `removeCourse` |
| Balancing | `src/game/simulationConfig.ts` | `courses` (`paintballTeamSize*`, `slideLaunchSpeed`, `slideGravity`) |
| Abschlussbelohnung | `src/game/attractionFun.ts`, `src/game/attractions/runtime.ts`, `src/game/courseAttractions.ts` | `courses.funGain`, gemeinsame Runtime und Legacy-Projektion |
| Unterhalt | `src/game/upkeep.ts` | `courseHourlyUpkeep` |
| Commands | `src/net/protocol.ts`, `src/net/commands.ts`, `src/net/bind.ts` | atomare `startCourseArea`/`addCourseAreaCells`/`removeCourseAreaCells`; außerdem `startCourse`, `addCoursePiece`, `undoCoursePiece`, Betrieb/Preis/Team/Abriss |
| Bau-UI | `src/ui/courseBuilderPanel.ts`, `src/app/shell.ts` | `#course-builder`, Palette, Ebene, Teamgröße |
| Baumenü | `src/game/buildMenu.ts`, `src/ui/buildCatalog.ts` | Gruppe *Kurse*, Tool `course` |
| Klick / Fläche ziehen | `src/main.ts`, `src/input/pathToolController.ts`, `src/input/toolRouter.ts` | Endpunkte/Hindernisse klicken; Anlagenfläche ziehen |
| Gäste | `src/game/visitorBehavior.ts` | `findReachableCourse`; Becken über `isCourseSwimCell` / `ensureSwimGoals` |
| Darstellung | `src/view/CourseView.ts` | zusammengeführte Spannweiten/Flächenränder, InstancedMesh für Fläche und Gegenstände, Landemarkierung; `addBridgeOrTreeObstacle` |
| Tests | `tests/courseAttractions.ts` | `testCourseAttractions` |

## Konstruktion

`startCourse` legt einen **leeren** Kurs an. Bei Mudmasters/Tree-to-Tree wird
der Eingang zum ersten Streckenpunkt; bei Schwimmbad/Paintball wird das erste
Flächenfeld angelegt. `operating` bleibt aus, bis `validateCourse` durchläuft.
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

Kurseingänge verwenden dieselbe gerichtete Warteschlangenlogik wie
Fahrgeschäft- und Achterbahneingänge: Ein orthogonal angrenzender `queue`-Weg
wird vom Eingang aus beansprucht, die zusammenhängende Kette zeigt zum Kurs,
und Besucher routen zum äußeren Ende der Schlange. Ohne angeschlossene
Warteschlange ist der Kurs kein erreichbares Besucherziel.
Reservierte Gäste bleiben während des Hinwegs `seeking` und werden erst
eingelassen, nachdem sie das äußere Queue-Ende erreicht haben und `queuing`
sind. **Fertig** validiert und öffnet einen vollständigen Kurs; das
Schließen-X beendet nur den Editor.

- **Mudmasters:** linearer Streckeneditor. Nach dem Eingang wird automatisch
  `path` gewählt. Eine Linie beginnt am aktuellen Streckenende (Ziehen in
  Gegenrichtung ist ebenfalls erlaubt) und wird als geordnete Folge einzelner
  Nachbarfelder angelegt. So bleibt die Richtung auch bei direkt
  nebeneinanderliegenden Abschnitten eindeutig. Dynamische Hindernisse
  (Kletterwand, Seilschwung, Wassergraben, Kriechtunnel, Rutsche, Leiter,
  Sprung, Hangelstrecke) werden als verbundene Geometrie über die komplette
  Spanne gebaut. Mehrere Ebenen über den Ebenen-Regler.
- **Schwimmbad:** zuerst zusammenhängende Anlagenfläche, dann Beckenelemente,
  Eingang/Ausgang und Rutschen darin. Nur `poolBasin` ist Schwimmwasser; die
  Fläche selbst ist Beckenumgang. Wasserrutschen sind echte Spannen. Am
  letzten Rutschstück heben Gäste mit `slideLaunchSpeed`/`slideGravity` ab.
  Das Bauoverlay markiert den berechneten Landepunkt grün/rot. Wasser =
  sicher, Boden = `injured`; Sanitäter übernehmen über den normalen
  Verletzten-Workflow.
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

- Snapshot v31 speichert Kurse in `attractions`. `courses` ist eine
  abgeleitete Laufzeitprojektion. v30-Pool/Paintball werden einmalig
  konvertiert; nicht eindeutig konvertierbare Anlagen stehen in
  `migrationReport.removedAttractionIds`.
- Host-autoritative Commands, keine Render-Mutation.
- Verbundene Details werden in ein statisches Vertex-Color-Mesh
  zusammengeführt; Flächen und Punktobjekte bleiben instanziert. Die
  Geometrie wird nur bei einer Bausignaturänderung neu erstellt.
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
- Unterhalt nutzt denselben Pausen-Faktor wie Buden (`pauseUpkeepMultiplier`).
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
Verletzung ohne Wasserlandung sowie Abschluss-Spaß für Mudmasters,
Schwimmbad/Wasserrutsche, Tree-to-Tree und Paintball.

## Bei Änderungen dieses Dokuments

Neue Stückarten, Commands oder Kurs-Typen hier, in `docs/README.md`,
`AGENTS.md`, `docs/multiplayer.md` und `docs/saves.md` nachziehen.
