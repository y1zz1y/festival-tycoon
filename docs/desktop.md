# Desktop-App und Steam

Headliner Tycoon gibt es neben Browser und Docker-Image als Desktop-App (Electron) für
Windows, macOS und Linux, jeweils x64 und arm64. Die App startet intern denselben
Spielserver wie das Docker-Image und zeigt das Spiel in einem eigenen Fenster:
Einzelspiel offline, Server-Spielstände und Konten lokal, Mehrspieler-Räume im
Heimnetz. Die CI baut alle Pakete und bereitet die Steam-Depots vor.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Spielserver als Funktion | `server/app.ts` | `startGameServer({ port, host, dist, publicHost })` → `{ port, close() }` |
| Docker / `npm start` | `server/serve.ts` | ruft `startGameServer` mit `PORT`/`HOST` auf |
| Electron-Hauptprozess | `electron/main.mjs` | Port wählen, Server starten, Fenster, externe Links, F11 |
| Server-Bündel für Electron | `scripts/build-desktop.mjs` | `npm run desktop:bundle` (rolldown, `ws` eingebaut) |
| Paketierung | `electron-builder.yml` | Ziele je OS, Symbole, Artefaktnamen |
| CI | `.github/workflows/build.yml` | Jobs `desktop` (Matrix), `release`, `steam` |
| Test | `tests/desktopServer.ts` | Start auf Port, Fallback, Socket, belegter Port, sauberes Ende |

## Regeln

- **Ein Server, zwei Starter.** `server/app.ts` enthält die ganze Server-Logik;
  `serve.ts` (Docker) und der Electron-Hauptprozess starten sie nur. Neue Routen
  gehören in `app.ts`, nie in einen der Starter.
- **Fester Port.** Die App lauscht auf 47880 (Ausweich 47881–47889). Der Port bestimmt
  den Ursprung der Seite und damit alles im Browser-Speicher (Einstellungen, Sprache,
  lokale Spielstände, Fortschritt); ein zufälliger Port würde das bei jedem Start
  verlieren. Ist kein Port frei, meldet die App das und beendet sich.
- **Heimnetz.** Der Server lauscht auf allen Schnittstellen (`0.0.0.0`), damit Gäste
  per Einladungslink im Browser beitreten können; Windows fragt beim ersten Start nach
  der Firewall-Freigabe. `HEADLINER_DESKTOP_HOST=127.0.0.1` schränkt auf den eigenen
  Rechner ein. Das Fenster lädt immer `http://127.0.0.1:<port>`.
- **Daten.** `HEADLINER_DATA_DIR` zeigt auf den Ordner `saves` im Benutzerordner der
  App (Windows `%APPDATA%\Headliner Tycoon`, macOS `~/Library/Application Support/Headliner Tycoon`,
  Linux `~/.config/Headliner Tycoon`). Updates und Neuinstallationen lassen ihn stehen.
- **Eine Instanz.** Ein zweiter Start holt das vorhandene Fenster nach vorn, statt einen
  zweiten Server auf dieselbe Datenbank zu setzen.
- **Sicherheit.** Fenster mit `contextIsolation`, `sandbox`, ohne Node im Renderer.
  Navigation außerhalb des eigenen Ursprungs und neue Fenster öffnen im System-Browser.
- **Schließen beendet alles.** Fenster zu → Server schließt Sockets und Datenbank →
  App endet, auch unter macOS.
- **Keine node_modules in der App.** Web-App (`dist/`) und Server-Bündel sind
  vollständig; `electron-builder.yml` schließt `node_modules` aus.
- **Electron-Version.** Electron 44 bringt Node 24 mit; der Server braucht `node:sqlite`.
  Beim Wechsel der Electron-Hauptversion `npm run desktop` und den Paket-Build prüfen.

## Befehle

| Befehl | Wirkung |
| --- | --- |
| `npm run desktop` | Web-App bauen, Server bündeln, App aus dem Repo starten |
| `npm run desktop:dist` | dasselbe, dann Pakete für das aktuelle OS in den Ordner `release` |
| `npx electron-builder --win nsis zip --x64` | nur Windows x64 (nach `build` und `desktop:bundle`) |

Unter Windows kann ein Virenscanner das Umbenennen des entpackten App-Ordners im Repo
blockieren (`EPERM … win-unpacked.tmp`); dann mit
`--config.directories.output=<Ordner außerhalb des Repos>` bauen. In der CI tritt das
nicht auf.

## CI und Downloads

`desktop` baut auf drei Runnern (Linux, Windows, macOS) je x64 und arm64:

| OS | Dateien |
| --- | --- |
| Windows | Installer `.exe` (NSIS, Pfad wählbar), `.zip` |
| macOS | `.dmg`, `.zip` (unsigniert: erster Start per Rechtsklick → Öffnen) |
| Linux | `.AppImage`, `.tar.gz` |

`release` hängt sie zusammen mit dem Web-Zip an das GitHub-Release `latest`. Das
Docker-Image entsteht unverändert im Job `build`; dort wird der Electron-Download
übersprungen (`ELECTRON_SKIP_BINARY_DOWNLOAD`), ebenso im Dockerfile.

Code-Signatur fehlt noch: Windows zeigt SmartScreen, macOS Gatekeeper. Mit Zertifikat
(Windows) bzw. Apple Developer ID plus Notarisierung (macOS) die Secrets `CSC_LINK` /
`CSC_KEY_PASSWORD` bzw. `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
setzen und `CSC_IDENTITY_AUTO_DISCOVERY` sowie `identity: null` entfernen.

## Steam

Der Job `steam` lädt nach jedem Master-Build die Depots per SteamPipe hoch
(`game-ci/steam-deploy`). Er läuft nur, wenn das Repository konfiguriert ist:

1. In Steamworks die App anlegen und drei Depots in Steams Standard-Nummerierung:
   App-ID + 1 = Windows, + 2 = Linux, + 3 = macOS (jeweils mit passender
   Betriebssystem-Einstellung).
2. Startoptionen je OS: Windows `Headliner Tycoon.exe`, Linux `headliner-tycoon`,
   macOS `Headliner Tycoon.app`.
3. Einen Build-Account (nur Rechte „Edit App Metadata“ und „Publish App Changes to
   Steam“) anlegen, einmal lokal mit `steamcmd` anmelden und die entstandene
   `config/config.vdf` Base64-kodiert als Secret speichern.
4. Im GitHub-Repository: Variable `STEAM_APP_ID`, optional `STEAM_BRANCH`
   (Standard `beta`), Secrets `STEAM_USERNAME` und `STEAM_CONFIG_VDF`.

Die Depots: Windows x64 und Linux x64 aus den entpackten Builds, macOS als Universal-App
(x64 und Apple Silicon in einem Paket). Steam bietet für Windows und Linux kein ARM an;
die ARM-Varianten gibt es nur als Downloads am Release. Die Depot-Inhalte wandern als
tar-Archiv zwischen den Jobs, damit Ausführungsrechte und die Symlinks der
macOS-Frameworks erhalten bleiben. Der Upload geht auf den Steam-Branch aus
`STEAM_BRANCH`, nie direkt auf den öffentlichen Standard-Branch; freigeschaltet wird
in Steamworks.

Noch nicht angebunden: Steamworks-SDK (Erfolge, Overlay, Cloud-Speicher). Die zwölf
Erfolge aus [progress.md](progress.md) ließen sich später über ein Steamworks-Modul im
Hauptprozess an Steam melden; dafür braucht es die App-ID.

## Bei Änderungen dieses Dokuments

Aktualisieren bei neuen Zielen, anderem Port- oder Datenverhalten, neuen CI-Jobs oder
Steam-Schritten.
