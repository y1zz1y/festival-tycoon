# Festival-Audio (Kamera-Listener)

Räumliche Festival-SFX über die Web Audio API. Die Simulation entscheidet
**was** tönen darf; die Kamera ist der Listener. Kein Stapel pro Besucher,
kein Abspielen aus Render-Materialien.

Die Klänge liegen als Ogg-Dateien unter `public/sfx/`, die Bühnenmusik (eine
Schleife je Genre) und das Titelthema unter `public/music/` (siehe
`AUDIO_ASSETS` in `src/game/audio.ts`). Alle Dateien sind CC0, Quellen unten.
`FestivalAudio` lädt sie per fetch/decode; fehlt eine Datei, bleibt der
Synth-Ersatz. Lautstärken stellt der Spieler im Mischpult ein.

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
| Mixer, Pools, Kanäle, Titelthema, Synth-Ersatz | `src/view/FestivalAudio.ts` | `FestivalAudio`, `setVolumes`, `setTitleMusic` |
| fetch/decode, Pfade | `src/view/audioAssets.ts` | `loadFestivalAudioBuffer`, `fetchAudioArrayBuffer` |
| Dateien bauen | `scripts/build-audio.py` | Schnitt, Schleife, Pegel, Ogg aus den Rohquellen |
| Mischpult-Werte | `src/app/playerSettings.ts`, `src/ui/playerSettingsPanel.ts` | Gesamt, Musik, Effekte, Umgebung ([ui.md](ui.md)) |
| Kamera-Pose | `src/view/WorldView.ts` | `audioListenerPose` |
| Stumm / UI-Klick / Tick-Sync | `src/main.ts` | `#toggle-mute`, `#setting-mute-audio` |
| CC0-Dateien | `public/sfx/`, `public/music/` | Namen aus `AUDIO_ASSETS` |

Kein neues `GameSnapshot`-Feld, kein `GameCommand`. Clients hören dieselben
abgeleiteten Cues wie der Host, sobald der Snapshot ankommt. `bandId` der
laufenden Buchung wird nur gelesen, um die Genre-Schleife zu wählen.

## Zonen und Ereignisse

Ambient (eine Loop-Stimme je Cluster, budgetiert):

| Zone | Quelle |
| --- | --- |
| `music` | spielende Bühne, Schleife im Genre der Band, aus der Mitte der Grundfläche (`buildingSize`), loop solange Quelle + in Reichweite |
| `coaster` | Fahrgeschäft und Zugposition |
| `crowdPath` | Wege-Gäste in Reichweite |
| `camp` | Campingzellen und schlafende/campende Gäste |
| `water` | nah abgetastetes Wasser + Schwimmer |
| `backstage` | Backstage-Zellen |
| `woods` | Bäume / Hecken |

`ambient-concert.ogg` (Applaus) wird **nicht** als Konzertmusik geplant. Musik kommt nur von `collectMusicEmitters`: stabile ID
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
`loadFestivalAudioBuffer` jeden Eintrag aus `AUDIO_ASSETS`,
sobald `fetch` und `decodeAudioData` gelingen. 404, leerer Body, Netzwerk-
oder Decode-Fehler lassen den Synth stehen. Pools, Cluster, Steal und
Kamera-Listener bleiben unverändert. Mute stoppt Stimmen und plant nicht.
Musik-Loops faden länger ein/aus als übriges Ambient.

## Mischpult, Genres und Titelthema

Signalweg: Stimme → Kanal → Master. Kanäle sind `music`, `effects`
(One-Shot-Pool) und `ambient`, je ein `GainNode` unter dem Master;
`setVolumes` setzt sie aus den Spielereinstellungen, der Master ist
`audio.masterGain × Gesamt`. Musik läuft im Ambient-Pool, `startBuffer` hängt
eine Stimme mit `music:`-ID deshalb an den Musikkanal und jede andere an den
Umgebungskanal.

`MusicBed` ist das Genre (`MusicGenre`, acht Stück); `MUSIC_BUFFER_KEYS` führt
jedes auf seine Datei. Wechselt auf einer Bühne die Band und damit das Genre,
startet ihre Stimme mit der neuen Schleife (die Stimme merkt sich ihren
Puffer, `slot.key`). Jede Bühne beginnt an einer aus ihrer ID abgeleiteten
Stelle der Schleife, damit zwei Bühnen mit demselben Genre nicht gleichlaufen.
Bis eine Musikdatei geladen ist, spielen die vier Synth-Skizzen (Folk/Indie/Soul
akustisch, Rock/Metal, Electro/Dance, Pop).

Das Titelthema (`musicTitle`) spielt, solange `#title-screen` sichtbar ist
(MutationObserver in `src/main.ts`, `setTitleMusic`), nicht räumlich auf dem
Musikkanal, und blendet beim Spielstart aus. Ohne Datei bleibt es still.
Ogg Vorbis dekodieren Chromium und Firefox; wo ein Browser es nicht kann,
bleibt es bei den Synth-Ersatztönen.

## Quellen (alle CC0)

Nur CC0, Lizenz auf der Seite jedes Stücks geprüft. Rohdateien liegen nicht im
Repo; `scripts/build-audio.py <rohordner>` schneidet, schleift (Überblendung mit
gleicher Leistung am Schleifenpunkt), pegelt (One-Shots −18 LUFS, Umgebung
−24 LUFS, Musik −18 LUFS, Spitze höchstens −1 dBFS) und kodiert nach
`public/`: Bühnenmusik und Effekte mono, Titel stereo, zusammen rund 4,2 MB.
Die vorherigen WAV-Klänge (0.2.5–0.2.8, ebenfalls CC0, Quellen in der
Git-Historie dieser Datei) und die erzeugten Genre-Beds sind damit ersetzt.

| Datei | Quelle |
| --- | --- |
| `oneshot-place`, `oneshot-demolish` | Kenney, Impact Sounds (kenney.nl/assets/impact-sounds) |
| `oneshot-ui-click` | Kenney, Interface Sounds `click_001` (kenney.nl/assets/interface-sounds) |
| `oneshot-coaster-launch` | Kenney, Sci-fi Sounds `thrusterFire_000` (kenney.nl/assets/sci-fi-sounds) |
| `oneshot-incident`, `ambient-coaster` | rubberduck, 30 CC0 SFX loops (opengameart.org/content/30-cc0-sfx-loops) |
| `oneshot-cheer` | Joseph Sardin, BigSoundBank 0236 „Shouts and Applauses of Teens #1“ |
| `oneshot-scream` | BigSoundBank 1456 „Rollercoaster, OzIris #1“ |
| `oneshot-medical` | BigSoundBank 1464 „2 Ton Siren“ |
| `oneshot-bus-hiss` | BigSoundBank 1490 „Pneumatic Brake Released“ |
| `oneshot-waste-truck` | BigSoundBank 3577 „Garbage truck #1“ |
| `ambient-concert` | BigSoundBank 0021 „Applause: 600 People“ |
| `ambient-crowd` | BigSoundBank 3096 „Outside Talks #6“ |
| `ambient-camp` | BigSoundBank 0110 „Campaign at night #1“ |
| `ambient-water` | BigSoundBank 3132 „Watercourse #1“ |
| `ambient-woods` | BigSoundBank 0100 „Forest“ |
| `ambient-backstage` | BigSoundBank 0125 „Computer 1 (Ventilation)“, tiefer gestimmt |
| `music/rock` | Sebastian Englmaier, „Hot Wings Rock“, Open Music Academy „CC0 Hintergrundmusik“ |
| `music/indie` | Ludwig Orel, „Eclipse (Indie Electro)“, Open Music Academy |
| `music/electro` | Jakob Eglmeier, „No Stopping (Tech House)“, Open Music Academy |
| `music/dance` | Johannes Söllner, „Glitter On The Dancefloor (Disco, Loopable)“, Open Music Academy |
| `music/pop` | Florian Simon, „Summer Breeze (Pop)“, Open Music Academy |
| `music/soul` | „Too Late To Be Sad (Funk, Loopable)“, Open Music Academy |
| `music/title` | Marius Wünsch, „Discoveries (Soundtrack)“, Open Music Academy |
| `music/metal` | Ragnar Random, „Plutonian Thrash“, Rock Music Pack (opengameart.org/content/rock-music-pack) |
| `music/folk` | RandomMind, „Medieval: Market Day“ (Loop), opengameart.org/content/medieval-market-day |

BigSoundBank: bigsoundbank.com, Sound-Seite `…-s<Nummer>.html`, Lizenz
bigsoundbank.com/licenses.html. Open Music Academy:
openmusic.academy/docs/PhjRHKrMCa9wXaMeFwhQrK/cc0-hintergrundmusik. Kenney:
creativecommons.org/publicdomain/zero/1.0/.

## Tests

`tests/audio.ts`: Listener sitzt auf dem Kamera-Look-At (nicht auf Gästen);
Quellen hinter `maxDistance` entfallen; One-Shot-Cap wird nicht überschritten;
Jubel nur bei Konzert-Kandidaten, geclustert, Cooldown plus Chance; Fahrzeuge
nur Start/Halt/Pass-by ohne Dauer-Motor; Musik looped mit stabiler ID solange
Quelle + in Range, still ohne Buchung. `testFestivalAudioAssets` prüft
Ogg-Pfade, vorhandene Dateien in `public/sfx/` und `public/music/` und
Loader-Fallback (404 / Fehler / leerer Body), ohne Binär-Fixtures. Jedes
Genre hat seine eigene Musikdatei; unbekannte Genres spielen als Indie.

## Bei Änderungen dieses Dokument

Aktualisieren bei neuen Zonen/Cues, anderen Pools, neuen oder ersetzten
Dateien (Quellentabelle und `scripts/build-audio.py`) oder geändertem Loader. Snapshot-Felder wären zusätzlich
`docs/multiplayer.md` und `docs/saves.md`.

## Unwetter (0.2.11)

`AudioWorld.stormActive` / `raining` aus `audioWorldFromSnapshot`. Bei Regen und
Gewitter läuft eine Umgebung `rain` am Listener (lauter im Gewitter), im Gewitter
kommt `thunder` als One-Shot (`cooldownTicks.thunder`, `cueChance.thunder`). Beide
Klänge sind nur synthetisch (`prepareBuffers`), ohne Datei in `AUDIO_ASSETS`.
Während des Gewitters (und bei angeordnetem Schutz in der Warnung) schweigen die
Bühnen (`performingStagesFromFestival`).
