# Festival-Audio (Kamera-Listener)

Räumliche Festival-SFX über die Web Audio API. Die Simulation entscheidet
**was** tönen darf; die Kamera ist der Listener. Kein Stapel pro Besucher,
kein Abspielen aus Render-Materialien.

Starter-Klänge liegen als kleine Mono-WAVs unter `public/sfx/` (siehe
`AUDIO_PLACEHOLDER_ASSETS` in `src/game/audio.ts`). `FestivalAudio` lädt sie
per fetch/decode; fehlt eine Datei, bleibt der Synth-Platzhalter. Stummschalten
ändert sich nicht.

## Best Practices (Spiel-3D-Audio)

- **Listener = Kamera**, genauer: im Orbit der Bodenpunkt unter dem Look-At
  (`cameraTarget`), in der Geh-Ansicht die Kamera selbst. Nicht jeder Gast
  hat Ohren. Distanzdämpfung vom Look-At vermeidet Lautstärkesprünge, weil
  die isometrische Kamera hoch über dem Gelände steht; die Blickrichtung
  kommt weiter von der Kamera.
- **Distanz + Max-Range:** inverse Dämpfung (`refDistance`, `rolloff`,
  `maxDistance`). Quellen jenseits von `maxDistance` werden gar nicht geplant
  und belegen keine Stimme — außer bereits laufende **Musik**, die bis
  `maxDistance * musicHysteresis` weiterläuft und ausfadet, statt neu
  anzustarten.
- **Voice-Budget / Pool:** feste Pools (12 One-Shots, 6 Ambient). Musik
  reserviert bis `musicVoiceReserve` Ambient-Stimmen. Ist der Pool voll,
  stiehlt die Mixer-Stimme mit dem schlechtesten Score (weit / leise /
  niedrige Priorität). Niemals N Gäste × Klatschen.
- **Eine Quelle pro Cluster:** Jubel, Wegegedränge, Camp, Wald und Wasser
  werden in `clusterSize`-Zellen zusammengefasst. Eine Schleife oder ein
  sparsamer One-Shot pro Cluster. Musik hängt an der Bühnen-ID, nicht am
  Cluster.
- **Cooldown / Chance** je Ereignistyp in Sim-Ticks (100 ms). Jubel und
  Schreie zusätzlich je Cluster. Ein fehlgeschlagener Zufallswurf verbraucht
  trotzdem den Cooldown, damit Cues nur zwischendurch kommen.
  `Date.now()` steuert keine Sim-Entscheidung; nur die Wiedergabe darf
  `AudioContext.currentTime` nutzen.
- **Priorität:** UI / wichtig (Vorfall, naher Launch) > lokale Aktion /
  Musik > fernes Ambient.
- **Kein Audio aus Unique-Materials.** Planung aus Snapshot-Diffs und einem
  räumlichen Index naher Gebäude/Zonen auf dem Tick. Listener-Pose nur
  interpolierend jedes Render-Frame.
- Kleiner Web-Audio-Mixer, keine Howler-Abhängigkeit. Stummschaltung in der
  UI (`localStorage`, nicht im Spielstand).

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Planung, Cluster, Budget, Listener-Pose | `src/game/audio.ts` | `planFestivalAudio`, `listenerFromCamera`, `audioWorldFromSnapshot` |
| Balancing | `src/game/simulationConfig.ts` | `audio` |
| Mixer, Pools, WAV-Loader, Synth-Fallback | `src/view/FestivalAudio.ts` | `FestivalAudio` |
| fetch/decode, Pfade | `src/view/audioAssets.ts` | `loadFestivalAudioBuffer`, `fetchAudioArrayBuffer` |
| Genre-Beds erzeugen | `scripts/generate-music-beds.mjs` | vier loopbare Mono-WAVs |
| Kamera-Pose | `src/view/WorldView.ts` | `audioListenerPose` |
| Stumm / UI-Klick / Tick-Sync | `src/main.ts` | `#toggle-mute`, `#setting-mute-audio` |
| CC0-Dateien | `public/sfx/` | Namen aus `AUDIO_PLACEHOLDER_ASSETS` |

Kein neues `GameSnapshot`-Feld, kein `GameCommand`. Clients hören dieselben
abgeleiteten Cues wie der Host, sobald der Snapshot ankommt. `bandId` der
laufenden Buchung wird nur gelesen, um das Genre-Bed zu wählen.

## Zonen und Ereignisse

Ambient (eine Loop-Stimme je Cluster, budgetiert):

| Zone | Quelle |
| --- | --- |
| `music` | spielende Bühne, Genre-Bed, loop solange Quelle + in Reichweite |
| `coaster` | Fahrgeschäft und Zugposition |
| `crowdPath` | Wege-Gäste in Reichweite |
| `camp` | Campingzellen und schlafende/campende Gäste |
| `water` | nah abgetastetes Wasser + Schwimmer |
| `backstage` | Backstage-Zellen |
| `woods` | Bäume / Hecken |

`ambient-concert.wav` ist ein PA-Rumble ohne Lied und wird **nicht** mehr als
Konzertmusik geplant. Musik kommt nur von `collectMusicEmitters`: stabile ID
`music:<stageId>`, Fade an der Distanzgrenze, kein Retrigger beim Gehen am
Rand. Ohne laufende Buchung bleibt es still. Lautsprecher und FOH erzeugen
keine eigenen Loops.

One-Shots (budgetiert, langer Cooldown, Chance; kein Cue pro Gast):

| Kind | Auslöser |
| --- | --- |
| `placeBuilding` | neue Gebäude-ID im Snapshot |
| `demolish` | entfernte Gebäude-ID |
| `coasterLaunch` | Zug `boarding` → `running` (liest Zugstatus, ändert keine Physik) |
| `scream` | Kandidat: Zug `running`, Fahrgäste, `speed >= screamSpeed`; selten |
| `cheer` | Kandidat: Cluster mit `concertId` **und** excited / partying / socializing |
| `medical` | Gast wechselt in Sanität oder Krankenwagen `responding` |
| `busHiss` | Bus/Tourbus startet, hält oder (selten) fährt vorbei |
| `wasteTruck` | Müllwagen startet, hält oder (selten) fährt vorbei |
| `incident` | neuer Boden-Vorfall |
| `uiClick` | optionaler Toolbar-Klick (Sim-Tick-Cooldown) |

Fahrzeuge haben **keinen** Motor-Dauerloop. Nur Ereignis-Cues (Start, Halt,
Pass-by in `vehiclePassRadius`) plus globaler Art-Cooldown. Pass-by nutzt
`passByChance`.

## Limits

`SIMULATION_CONFIG.audio`: `maxOneShotVoices` **12**, `maxAmbientVoices` **6**,
`maxDistance` **28**, `clusterSize` **4**, `cheerMinCluster` **8**,
`musicHysteresis` **1.35**, `musicVoiceReserve` **2**. Jubel-Cooldown **90**
Ticks, Fahrzeug-Cues **80**, Chance z. B. Jubel **0.32**. Steal: niedrigster
`voiceScore` (Priorität, Distanz, Intensität).

## Loader

`FestivalAudio` füllt zuerst Synth-Puffer, dann ersetzt
`loadFestivalAudioBuffer` jeden Eintrag aus `AUDIO_PLACEHOLDER_ASSETS`,
sobald `fetch` und `decodeAudioData` gelingen. 404, leerer Body, Netzwerk-
oder Decode-Fehler lassen den Synth stehen. Pools, Cluster, Steal und
Kamera-Listener bleiben unverändert. Mute stoppt Stimmen und plant nicht.
Musik-Loops faden länger ein/aus als übriges Ambient.

## Credits (CC0)

Alle eingebauten Dateien sind CC0 / public-domain-equivalent. Herkunft trotzdem
dokumentiert. Die vier `music-*.wav` sind originale, kurze Instrumental-Beds
(kein erkennbares Copyright-Lied), erzeugt mit `scripts/generate-music-beds.mjs`.
Genre-Zuordnung: Folk/Indie/Soul → acoustic, Rock/Metal → rock,
Electro/Dance → electronic, Pop → pop.

| Datei | Quelle | Autor | Lizenz | URL |
| --- | --- | --- | --- | --- |
| `music-acoustic.wav` | Original-Synth-Bed (Folk/Indie/Soul) | Headliner Tycoon | CC0 | `scripts/generate-music-beds.mjs` |
| `music-rock.wav` | Original-Synth-Bed (Rock/Metal) | Headliner Tycoon | CC0 | `scripts/generate-music-beds.mjs` |
| `music-electronic.wav` | Original-Synth-Bed (Electro/Dance) | Headliner Tycoon | CC0 | `scripts/generate-music-beds.mjs` |
| `music-pop.wav` | Original-Synth-Bed (Pop) | Headliner Tycoon | CC0 | `scripts/generate-music-beds.mjs` |
| `ambient-crowd.wav` | BigSoundBank #3515 Crowd of 50-60 People #1 (Schnitt, Mono) | Joseph Sardin | CC0 | https://bigsoundbank.com/crowd-of-50-60-people-1-s3515.html |
| `ambient-concert.wav` | BigSoundBank #3515 (Tiefpass/Tremolo, kein Song) + Kenney Sci-Fi `spaceEngineLow_000` | Joseph Sardin; Kenney | CC0 | https://bigsoundbank.com/crowd-of-50-60-people-1-s3515.html · https://kenney.nl/assets/sci-fi-sounds |
| `ambient-coaster.wav` | BigSoundBank #1457 Rollercoaster, Goudurix #4 (ruhigeres Fenster) | Joseph Sardin | CC0 | https://bigsoundbank.com/rollercoaster-goudurix-4-s1457.html |
| `ambient-camp.wav` | BigSoundBank #3322 Fire, Foley (loopbarer Schnitt) | Joseph Sardin & Axeline T. | CC0 | https://bigsoundbank.com/fire-foley-s3322.html |
| `ambient-water.wav` | BigSoundBank #823 Small Stream | Joseph Sardin | CC0 | https://bigsoundbank.com/small-stream-s0823.html |
| `ambient-woods.wav` | BigSoundBank #2713 Forest and Stream #1 | Pierre Sibanarco | CC0 | https://bigsoundbank.com/forest-and-stream-1-s2713.html |
| `ambient-backstage.wav` | BigSoundBank #3542 Small Restaurant Conversations | Joseph Sardin & Axeline T. | CC0 | https://bigsoundbank.com/small-restaurant-conversations-s3542.html |
| `oneshot-cheer.wav` | BigSoundBank #237 Shouts and Applauses of Teens #2 | Denis Chardonnet | CC0 | https://bigsoundbank.com/shouts-and-applauses-of-teens-2-s0237.html |
| `oneshot-scream.wav` | Ausschnitt aus BigSoundBank #1457 | Joseph Sardin | CC0 | https://bigsoundbank.com/rollercoaster-goudurix-4-s1457.html |
| `oneshot-bus-hiss.wav` | BigSoundBank #227 Hiss of steam train #1 (Luftablass-Textur) | GlaneurDeSons | CC0 | https://bigsoundbank.com/hiss-of-steam-train-1-s0227.html |
| `oneshot-waste-truck.wav` | BigSoundBank #3577 Garbage truck #1 (Vorbeifahrt) | Joseph Sardin | CC0 | https://bigsoundbank.com/garbage-truck-1-s3577.html |
| `oneshot-medical.wav` | BigSoundBank #1593 Piezo alarm #2 (kurz) | Joseph Sardin | CC0 | https://bigsoundbank.com/piezo-alarm-2-s1593.html |
| `oneshot-ui-click.wav` | Kenney Interface Sounds `click_001` | Kenney | CC0 | https://kenney.nl/assets/interface-sounds |
| `oneshot-place.wav` | Kenney Interface Sounds `drop_002` | Kenney | CC0 | https://kenney.nl/assets/interface-sounds |
| `oneshot-demolish.wav` | Kenney Sci-Fi Sounds `explosionCrunch_001` | Kenney | CC0 | https://kenney.nl/assets/sci-fi-sounds |
| `oneshot-coaster-launch.wav` | Kenney Sci-Fi Sounds `thrusterFire_000` (kurz) | Kenney | CC0 | https://kenney.nl/assets/sci-fi-sounds |
| `oneshot-incident.wav` | Kenney Sci-Fi Sounds `explosionCrunch_000` | Kenney | CC0 | https://kenney.nl/assets/sci-fi-sounds |

Kenney-Pakete: Interface Sounds 1.0 und Sci-Fi Sounds 1.0,
https://creativecommons.org/publicdomain/zero/1.0/. BigSoundBank:
https://bigsoundbank.com/licenses.html (CC0 / public-domain equivalent).
Kenney Music Loops 1.1 wäre ebenfalls CC0, wurde aber nicht übernommen
(erkennbare fertige Titel); die Beds sind eigene, kurze Instrumentalschleifen.

## Tests

`tests/audio.ts`: Listener sitzt auf dem Kamera-Look-At (nicht auf Gästen);
Quellen hinter `maxDistance` entfallen; One-Shot-Cap wird nicht überschritten;
Jubel nur bei Konzert-Kandidaten, geclustert, Cooldown plus Chance; Fahrzeuge
nur Start/Halt/Pass-by ohne Dauer-Motor; Musik looped mit stabiler ID solange
Quelle + in Range, still ohne Buchung. `testFestivalAudioAssets` prüft
Asset-Pfade, vorhandene `public/sfx/`-WAVs (inkl. Genre-Beds) und
Loader-Fallback (404 / Fehler / leerer Body), ohne Binär-Fixtures.

## Bei Änderungen dieses Dokument

Aktualisieren bei neuen Zonen/Cues, anderen Pools, neuen WAV-Dateien oder
geändertem Loader. Snapshot-Felder wären zusätzlich
`docs/multiplayer.md` und `docs/saves.md`.
