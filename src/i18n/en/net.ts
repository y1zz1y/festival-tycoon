// Area: net. Sources: src/net/** (session status and toasts, takeover notices, command results),
// src/game/serverSaves.ts, src/game/saveText.ts, src/accounts.ts
export const text: Record<string, string> = {
  // src/accounts.ts: client-side account messages (UI text; the server's own are in the server area).
  'Der Spielserver hat nicht geantwortet': 'The game server did not respond',
  'Kein Kontakt zum Spielserver — läuft er?': 'Cannot reach the game server — is it running?',
  'Die beiden Passwörter stimmen nicht überein': 'The two passwords do not match',
  // src/game/saveText.ts
  'Spielstand konnte nicht geschrieben werden': 'The save could not be written',
  'Spielstand ist unvollständig — Gebäude oder Besucher fehlen': 'The save is incomplete — buildings or visitors are missing',
  'Browser-Speicher ist voll. Speichere unter einem Konto auf dem Spielserver oder exportiere den Stand als Text.': 'Browser storage is full. Save to an account on the game server or export the game as text.',
  // src/game/serverSaves.ts
  'Der Spielserver hat keine Spielstandsliste geliefert (keine JSON-Antwort).': 'The game server did not return a list of saves (no JSON response).',
  'Kein Kontakt zum Spielserver — läuft er? Lokale Spielstände bleiben in diesem Browser.': 'Cannot reach the game server — is it running? Local saves stay in this browser.',
  'Bitte im Titelbildschirm anmelden, um Server-Spielstände zu nutzen.': 'Please sign in on the title screen to use server saves.',
  'Dieser Server-Spielstand wurde nicht gefunden.': 'This server save was not found.',
  // {0} is an HTTP status code.
  'Spielserver antwortet nicht ({0:raw})': 'Game server is not responding ({0})',
  // src/net/commands.ts: results of commands that GameState does not answer itself.
  // {0} is the speed step (1, 2, 3).
  'Tempo {0:n}': 'Speed {0}',
  'Achterbahn-Einstellungen gespeichert': 'Coaster settings saved',
  'Preis geändert': 'Price changed',
  'Tagesticketpreis geändert': 'Day ticket price changed',
  'Campingticketpreis geändert': 'Camping ticket price changed',
  'Nachfrage-Tuning geändert': 'Demand tuning changed',
  'Tagesplan geändert': 'Day plan changed',
  'Unbekannter Spielbefehl: {0:raw}': 'Unknown game command: {0}',
  // src/net/session.ts: fallback player names (sent to the room as the name) and status lines.
  'Host': 'Host',
  'Gast': 'Guest',
  'Getrennt': 'Disconnected',
  // {0} is “expected≠actual” simulation hashes.
  'Desync {0:raw} – gleiche Welt neu': 'Desync {0} – resyncing the world',
  'Ungültiger Weltabgleich – fordere neuen Zustand an': 'Invalid world sync – requesting a fresh state',
  'Verbindung beendet': 'Connection closed',
  'Verbindung unterbrochen – neu verbinden …': 'Connection lost – reconnecting …',
  'Mehrspieler-Server nicht erreichbar': 'Multiplayer server unreachable',
  // {0} is the room code.
  'Raum {0:raw} läuft': 'Room {0} is open',
  'Verbunden mit {0:raw}': 'Connected to {0}',
  'Der Host ist zurück – das Spiel läuft weiter.': 'The host is back – the game carries on.',
  'Übernahme fehlgeschlagen – der Spielstand ließ sich nicht aufbauen': 'Takeover failed – the save could not be rebuilt',
  'Übernahme abgebrochen – du spielst als Gast weiter.': 'Takeover cancelled – you carry on as a guest.',
  // {0} is a player name.
  '{0:raw} ist jetzt Host. Das Spiel läuft weiter.': '{0} is now the host. The game carries on.',
  'Raum neu öffnen …': 'Reopening room …',
  // src/net/takeover.ts (the build pause is also sent by server/rooms.ts).
  'Host ist weg – Bauen pausiert': 'Host is away – building paused',
  'Der Host hat das Spiel beendet – du spielst allein weiter.': 'The host has ended the game – you carry on alone.',
  // {0} is a reason for closing the room that this client does not know (a newer server).
  '{0:raw} – du spielst allein weiter.': '{0} – you carry on alone.',
  'Der Host ist weg und niemand hat den Spielstand – warte auf Rückkehr.': 'The host is away and nobody has the save – waiting for them to return.',
  'Host ist weg – Übernahme in {0:n} s': 'Host is away – takeover in {0} s',
  'Host ist weg – Übernahme läuft …': 'Host is away – takeover under way …',
  '{0:n} unbestätigte Aktion verworfen – bitte prüfen.': '{0} unconfirmed action discarded – please check.',
  '{0:n} unbestätigte Aktionen verworfen – bitte prüfen.': '{0} unconfirmed actions discarded – please check.',
  '{0:raw} ist jetzt Host. Das Spiel läuft weiter. {1:n} unbestätigte Aktion verworfen – bitte prüfen.': '{0} is now the host. The game carries on. {1} unconfirmed action discarded – please check.',
  '{0:raw} ist jetzt Host. Das Spiel läuft weiter. {1:n} unbestätigte Aktionen verworfen – bitte prüfen.': '{0} is now the host. The game carries on. {1} unconfirmed actions discarded – please check.',
  'Du bist jetzt Host von Raum {0:raw}. Die Welt läuft auf deinem Rechner weiter – Tab offen lassen und speichern. Stand von vor {1:n} s übernommen. {2:t}': 'You are now the host of room {0}. The world keeps running on your computer – keep the tab open and save. Picked up the state from {1} s ago. {2}',
  'Du bist jetzt Host von Raum {0:raw}. Die Welt läuft auf deinem Rechner weiter – Tab offen lassen und speichern. {1:t}': 'You are now the host of room {0}. The world keeps running on your computer – keep the tab open and save. {1}',
  'Du bist jetzt Host von Raum {0:raw}. Die Welt läuft auf deinem Rechner weiter – Tab offen lassen und speichern. Stand von vor {1:n} s übernommen.': 'You are now the host of room {0}. The world keeps running on your computer – keep the tab open and save. Picked up the state from {1} s ago.',
  'Du bist jetzt Host von Raum {0:raw}. Die Welt läuft auf deinem Rechner weiter – Tab offen lassen und speichern.': 'You are now the host of room {0}. The world keeps running on your computer – keep the tab open and save.',
  'Deine Welt wurde als „{0:name}“ gesichert.': 'Your world was backed up as “{0}”.',
  'Die Sicherung deiner Welt ist fehlgeschlagen: {0:raw}': 'Backing up your world failed: {0}',
  'Während du weg warst, hat {0:raw} übernommen. Du spielst als Gast weiter. {1:t}': 'While you were away, {0} took over. You carry on as a guest. {1}',
  'Während du weg warst, hat ein Gast übernommen. Du spielst als Gast weiter. {0:t}': 'While you were away, a guest took over. You carry on as a guest. {0}',
}
/** Entity default-name vocabulary: bases for the ordinal rule and name templates. */
export const names: Record<string, string> = {
  // Save slot names a host takeover writes (src/net/takeover.ts); {0} is the room code.
  'Übernommen {0:raw}': 'Taken over {0}',
  'Übernommen': 'Taken over',
  'Vor Host-Wechsel {0:raw}': 'Before host change {0}',
  'Vor Host-Wechsel': 'Before host change',
}
