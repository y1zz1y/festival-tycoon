# Atmosphäre, Strom und Tageslicht

Attraktivität und Partystimmung sind zwei `AtmosphereSnapshot`s im Spielzustand.
Strom ist ein eigenes Netz aus Generatoren, Kabeln und priorisierten Verbrauchern.
Tageslicht und Öffnungszeiten kommen aus `dayPlan` / `dayNight`, nicht aus der GPU.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Schönheit / Party-Felder | `src/game/atmosphere.ts` | `AtmosphereSystem` |
| Overlay-Darstellung | `src/view/AtmosphereView.ts` | |
| Crowding-Overlay | `src/view/CrowdingView.ts` | `src/game/crowding.ts` |
| Stromnetz | `src/game/power.ts` | `PowerSnapshot`, Demand-Priorität |
| Kabel setzen | `src/game/GameState.ts` | `designatePowerCable`, `isBuildingPowered` |
| Strom-View | `src/view/PowerView.ts` | |
| Tagesplan / Angebote | `src/game/dayPlan.ts` | Öffnung, Lampen, Stände |
| Feste Lichter | `src/view/FestivalLightsView.ts` | fester Pool: acht PointLights, vier SpotLights |
| Deko-Lampen | `src/game/decorationLights.ts` | Farbe/Höhe/Kegel je `Deko → Licht`-Art |
| Balancing | `src/game/simulationConfig.ts` | `atmosphere`, `power`, `dayNight`; Live-Show-Festivallust: `atmosphere.concertMotivationPerMinute` (`docs/visitors.md`, `docs/stages.md`) |

## Wichtige Quellen (Atmosphäre)

Feste Gebäude (Bäume, Bühnen, Lautsprecher, Lampen, **Deko je Art**) und mobile
Quellen (Tänzer, Musikboxen, Gespräche). Addition flacht ab
(`diminishingSaturation`); Feuer, Kotze und Schlafende wirken lokal negativ.
Details der Gewichte stehen in `SIMULATION_CONFIG.atmosphere.sources`
(  `beauty`, `party`, `range`). Beitrag fällt linear mit der Distanz
  (`1 - distance / range`). Mehrere Quellen auf derselben Zelle addieren roh
  und werden erst danach saturiert — zwei Statuen sind stärker als eine, aber
  nicht doppelt so stark. Kleine Deko (Leitkegel `beauty` 2, `range` 1) bleibt
  lokal; Blickfänge (Willkommensbogen 18 / 4, Kristallstele 16 / 4) färben
  mehrere Felder. Offene Müllablagen: `wasteDump` beauty −48 plus
  `waste.dumpStoredBeautyPerBag` (−1,4). Versiegelte Container:
  `sealedWasteContainer` beauty −8 plus
  `waste.sealedContainerStoredBeautyPerBag` (−0,22). Gäste lesen
  `localAttractiveness` aus diesem Feld.

## Wichtige Regeln

- Hörbare Atmosphäre (Bühne, Gedränge, Camp, Wald) ist kein Overlay-Feld,
  sondern kamera-orientiertes SFX mit Voice-Budget — siehe [audio.md](audio.md).
- Overlay-Berechnung im Tick / auf gedrosselten UI-Intervallen, nicht pro Frame
  für die ganze Karte neu erfinden. Logistik/Untergrund ist ein eigenes
  Karten-Overlay (`WorldView.setLogisticsMode`), kein Atmosphäre-Feld.
  Backstage-**Attraktivität** ist ein getrennter 0–100-Pool
  (`docs/band-supply.md`), nicht dieses Overlay.
- Strom: Verbraucher priorisieren (`CONSUMER_PRIORITY` in `power.ts`).
  Bühnen ohne Strom spielen nicht.
- Lichtanzahl nie zur Laufzeit ändern (Shader-Recompile). Acht PointLights,
  vier SpotLights (Baustrahler) und das Cursor-Licht bleiben permanent
  attached, auch bei Intensität 0. Viele Quellen teilen den Pool nach
  Kameranähe; jede Quelle behält eine instanzierte Glow-/Birnenfarbe.
  Siehe `docs/rendering.md` und `docs/performance.md`.
- Jede `Deko → Licht`-Art (Klassik-Mastleuchte, Lampion, Staublaterne,
  Irrlicht, Lichterkette, Diskokugel, Baustrahler, Fackel, Geisterlaterne,
  Jahrmarktlichter, Biergartenlaterne, Polarlicht, Gaslaterne,
  Tageslichtballon) hat eine Modellfarbe in `decorationLights.ts`.
  `lighting` / `lightBalloon` brauchen Strom; die übrigen folgen nur dem
  Tagesplan **Beleuchtung**. Intensität folgt `nightStrength` — mittags
  nicht aufblenden.
- `lighting`, Lichterketten und Lampions: warmes gelbes Licht, Reichweite 3–4.
  `lightBalloon` (Demand 3, Priorität 42): weißes Licht, Atmosphäre `range` 8,
  PointLight-Distance 9 statt 3.5. Derselbe Pool, Instanzfarben für Glow/Birne.
- Render-Entscheidungen nicht im `GameSnapshot` speichern.

## Tests

`tests/performanceGuards.ts` (Licht-Pool, 0/1/514 Quellen).
`tests/decoration.ts` (Deskriptor je Licht-Art, N Lampen → N Quellen, Abriss).
`tests/festival.ts` (Strom für Shows). `tests/operations.ts`.
`tests/scenery.ts` (Deko-`beauty` unterscheidet sich je Art, Stapel und Reichweite).
`tests/sealedWasteContainer.ts` (versiegelte Strafe schwächer als offene Ablage).

## Bei Änderungen dieses Dokument

Aktualisieren, wenn Overlay-Quellen, Power-Verbraucher, Kabelregeln oder
Day/Night-Parameter ändern. Neue Lichtarten zwingend gegen den festen
Light-Pool prüfen. Neue hörbare Zonen gehören nach [audio.md](audio.md),
nicht in dieses Overlay.
