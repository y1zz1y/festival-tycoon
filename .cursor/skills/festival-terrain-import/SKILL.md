---
name: festival-terrain-import
description: >-
  Derives Headliner Tycoon terrain and drop-in scenarios from legal map sources
  (OpenStreetMap, public DEMs, user-supplied images/heightmaps). Use when the user
  asks for terrain import, Gelände-Import, Google Maps references, satellite
  layouts, Burning Man / Black Rock City, Rock am Ring / Nürburgring, OSM, SRTM,
  or public/scenarios/*.json from a real festival site.
---

# Festival-Gelände aus Referenzkarten

Google-Maps- oder Google-Earth-Satellitenkacheln **nicht** herunterladen oder
scrapen. Die ToS erlauben das nicht für Spiele. Stattdessen: OpenStreetMap,
öffentliche DEMs, oder ein Bild/Heightmap das der Nutzer selbst bereitstellt.

## Erlaubte Quellen

| Quelle | Wofür | Wie |
| --- | --- | --- |
| OpenStreetMap Overpass | Wege, Wasser, landuse | `scripts/import-terrain.mjs --bbox` / `--preset` |
| SRTM / Open-Topo-Data / Mapzen | Höhen | `--elevation` (nur öffentliche APIs) |
| Nutzer-Upload | Screenshot, selbst exportierte Heightmap | visuell ableiten, nicht fremde Tiles ziehen |
| Skizze | Wiedererkennbare Form ohne Netz | `--sketch burning-man` / `--sketch rock-am-ring` |

Verboten: Google Maps/Earth tiles, unlizenzierte Satelliten-Caches, Screenshot-Scraping-Scripts.

## Script zuerst

```bash
npm run import-terrain -- --sketch burning-man
npm run import-terrain -- --sketch rock-am-ring
npm run import-terrain -- --preset rock-am-ring --elevation
npm run import-terrain -- --bbox 50.323,6.916,50.359,6.980 --name "Nürburgring" --size 64
```

Schreibt `public/scenarios/<id>.json` (`kind: headliner-scenario`, `format: 1`).
Kern: `src/game/terrainImport.ts`. OSM-Tags → Cover/Wasser: `classifyOsmTags`.

Vollständiger OSM-Import der Nordschleife oder von Black Rock City kann zu grob
oder leer sein (BRC ist ephemer). Dann **Skizze** nutzen, die die Form trägt.

## Cover-Mapping

Bestehende Palette plus Import-Looks:

| Cover | Bedeutung | OSM / Bild |
| --- | --- | --- |
| `grass` | Wiese | landuse=grass/meadow, Park |
| `sand` | Düne / Strand | natural=sand/beach/desert |
| `salt` | Playa / Salzpfanne | salt_pond, helles Playa-Weiß |
| `asphalt` | Rennstrecke / Straße | highway=raceway, motorway, surface=asphalt |
| `stone` | Platte / Stadt | residential/industrial, Pflaster |
| `rock` | Fels | bare_rock, scree |
| `field` | Acker | farmland, orchard |
| `earth` | Braune Erde | dirt, construction, Fußweg |
| `snow` | Schnee | glacier |
| Wasser | Höhe −1 | natural=water, riverbank |

`salt` nutzt Sand-Tempo. `asphalt` ist optisch (kein neuer Balancing-Schlüssel).
Höhen rasten auf 0,5; nur Abweichungen speichern. Ground nur für gemalte Zellen.

## Burning Man (Black Rock City)

1. Quelle: OSM-Playa (oft ohne Straßen) **oder** Skizze. Satelliten nur als
   Nutzer-Referenzbild, nicht laden.
2. Form: Hufeisen, Tor nach **Süden** (Karteneingang, −Z). Stadt 240° von
   4:00–8:00 den langen Weg über Norden. Innere Playastrecke um The Man.
3. Cover: fast alles `salt`; Straßen + innerer Ring `asphalt`; Trash Fence `stone`.
4. Deko: `playaTotem` (Man + Tempel), `dustLantern` am Tor. Thema **Wüste**.
5. Umgebung `desert`, Unebenheit 0, Welt 64.
6. Export: `public/scenarios/burning-man.json`.

## Rock am Ring (Nürburgring)

1. OSM-BBox um GP + Nordschleife: `50.323,6.916,50.359,6.980`.
2. Form: langes nördliches Band (Nordschleife) + südliches GP-Oval + Infield-Wiese.
3. Cover: Strecke `asphalt`, Gelände `grass`, Hügel optional `rock`.
4. Deko: `trackCurb` (rot-weiß, Thema **Industrie** / Zaun), `trafficCone`.
5. Umgebung `grassland`, leichte Hügel, Welt 64. Höhen aus SRTM, auf 0–3 skalieren.
6. Export: `public/scenarios/rock-am-ring-strecke.json` (nicht die Preset-ID
   `rock-am-ring` überschreiben).

## Export-Vertrag

Datei wie `docs/scenarios.md`: `settings` + `world.terrain`, `world.buildings`
(inkl. `entrance-path` bei `x:3,z:-worldSize/2`), `world.festival.infrastructure.ground`.
`createSnapshotFromScenarioFile` merged nur den Ground-Slice, nicht das ganze Festival.
Editor-Export schreibt Ground mit (`captureScenarioWorld`).

Kein Ingame-Import-Command, kein Google-Downloader.

## Deko-Kategorien (nur Wiedererkennbarkeit)

Zentrale Umgebungen echter Festivals, die im Spiel noch fehlen oder dünn sind —
nicht 50 Kleinteile. Siehe [reference.md](reference.md).

Für BRC/RaR **bereits umgesetzt**: Salzpfanne, Asphalt-Oval, Streckenbegrenzung.
Weitere (Staumauer, Hafen, Reisfeld, Sakura, Arena-Oval) nur vorschlagen, nicht
ohne Auftrag bauen.
