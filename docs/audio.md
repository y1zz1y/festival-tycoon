# Festival-Audio (Kamera-Listener)

Räumliche Platzhalter-SFX über die Web Audio API. Die Simulation entscheidet
**was** tönen darf; die Kamera ist der Listener. Kein Stapel pro Besucher,
kein Abspielen aus Render-Materialien.

## Best Practices (Spiel-3D-Audio)

- **Listener = Kamera**, genauer: im Orbit der Bodenpunkt unter dem Look-At
  (`cameraTarget`), in der Geh-Ansicht die Kamera selbst. Nicht jeder Gast
  hat Ohren. Distanzdämpfung vom Look-At vermeidet Lautstärkesprünge, weil
  die isometrische Kamera hoch über dem Gelände steht; die Blickrichtung
  kommt weiter von der Kamera.
- **Distanz + Max-Range:** inverse Dämpfung (`refDistance`, `rolloff`,
  `maxDistance`). Quellen jenseits von `maxDistance` werden gar nicht geplant
  und belegen keine Stimme.
- **Voice-Budget / Pool:** feste Pools (12 One-Shots, 6 Ambient). Ist der
  Pool voll, stiehlt die Mixer-Stimme mit dem schlechtesten Score
  (weit / leise / niedrige Priorität). Niemals N Gäste × Klatschen.
- **Eine Quelle pro Cluster:** Jubel, Wegegedränge, Camp, Wald und Wasser
  werden in `clusterSize`-Zellen zusammengefasst. Eine Schleife oder ein
  sparsamer One-Shot pro Cluster.
- **Cooldown / Debounce** je Ereignistyp in Sim-Ticks (100 ms). Jubel und
  Schreie zusätzlich je Cluster. `Date.now()` steuert keine Sim-Entscheidung;
  nur die Wiedergabe darf `AudioContext.currentTime` nutzen.
- **Priorität:** UI / wichtig (Vorfall, naher Launch) > lokale Aktion >
  fernes Ambient.
- **Kein Audio aus Unique-Materials.** Planung aus Snapshot-Diffs und einem
  räumlichen Index naher Gebäude/Zonen auf dem Tick. Listener-Pose nur
  interpolierend jedes Render-Frame.
- Kleiner Web-Audio-Mixer, keine Howler-Abhängigkeit. Stummschaltung in der
  UI (`localStorage`, nicht im Spielstand).

Platzhalter sind synthetische Töne, benannt wie spätere WAVs unter
`AUDIO_PLACEHOLDER_ASSETS` in `src/game/audio.ts`
(`sfx/ambient-concert.wav`, `sfx/oneshot-place.wav`, …). Es liegen keine
Audio-Dateien im Repo.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Planung, Cluster, Budget, Listener-Pose | `src/game/audio.ts` | `planFestivalAudio`, `listenerFromCamera`, `audioWorldFromSnapshot` |
| Balancing | `src/game/simulationConfig.ts` | `audio` |
| Mixer, Pools, Synth-Platzhalter | `src/view/FestivalAudio.ts` | `FestivalAudio` |
| Kamera-Pose | `src/view/WorldView.ts` | `audioListenerPose` |
| Stumm / UI-Klick / Tick-Sync | `src/main.ts` | `#toggle-mute`, `#setting-mute-audio` |

Kein neues `GameSnapshot`-Feld, kein `GameCommand`. Clients hören dieselben
abgeleiteten Cues wie der Host, sobald der Snapshot ankommt.

## Zonen und Ereignisse

Ambient (eine Loop-Stimme je Cluster, budgetiert):

| Zone | Quelle |
| --- | --- |
| `concert` | Bühne / PA / FOH, lauter bei laufender Buchung |
| `coaster` | Fahrgeschäft und Zugposition |
| `crowdPath` | Wege-Gäste in Reichweite |
| `camp` | Campingzellen und schlafende/campende Gäste |
| `water` | nah abgetastetes Wasser + Schwimmer |
| `backstage` | Backstage-Zellen |
| `woods` | Bäume / Hecken |

One-Shots (budgetiert, mit Cooldown außer Platzieren/Abriss je Gebäude):

| Kind | Auslöser |
| --- | --- |
| `placeBuilding` | neue Gebäude-ID im Snapshot |
| `demolish` | entfernte Gebäude-ID |
| `coasterLaunch` | Zug `boarding` → `running` (liest Zugstatus, ändert keine Physik) |
| `scream` | ein Cue je Zug bei `speed >= screamSpeed` und Fahrgästen |
| `cheer` | ein Cue je Gäste-Cluster (excited / partying / Konzert) |
| `medical` | Gast wechselt in Sanität oder Krankenwagen `responding` |
| `busHiss` | Linien- oder Tourbus fährt los |
| `wasteTruck` | Müllwagen fährt los |
| `incident` | neuer Boden-Vorfall |
| `uiClick` | optionaler Toolbar-Klick (Sim-Tick-Cooldown) |

## Limits

`SIMULATION_CONFIG.audio`: `maxOneShotVoices` **12**, `maxAmbientVoices` **6**,
`maxDistance` **28**, `clusterSize` **4**. Steal: niedrigster
`voiceScore` (Priorität, Distanz, Intensität).

## Tests

`tests/audio.ts`: Listener sitzt auf dem Kamera-Look-At (nicht auf Gästen);
Quellen hinter `maxDistance` entfallen; One-Shot-Cap wird nicht überschritten;
Jubel ist geclustert und hat Tick-Cooldown.

## Bei Änderungen dieses Dokument

Aktualisieren bei neuen Zonen/Cues, anderen Pools oder wenn echte WAV-Dateien
die Synth-Platzhalter ersetzen. Snapshot-Felder wären zusätzlich
`docs/multiplayer.md` und `docs/saves.md`.
