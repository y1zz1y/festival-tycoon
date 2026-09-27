// Area: server. Sources: server/** (accounts, rooms, saveSlots, scenarios, progress, serve, wsPlugin,
// progressProtocol achievements). The server sends canonical German; client sinks localize it.
export const text: Record<string, string> = {
  // server/accounts.ts
  'Anfrage zu groß': 'Request too large',
  'Name: 3 bis 24 Zeichen, Buchstaben, Ziffern, Leer- und Satzzeichen': 'Name: 3 to 24 characters, letters, digits, spaces and punctuation',
  'Passwort: mindestens 8 Zeichen': 'Password: at least 8 characters',
  'Passwort: höchstens 200 Zeichen': 'Password: at most 200 characters',
  'Abgemeldet': 'Signed out',
  'Diesen Namen gibt es schon': 'That name is already taken',
  // {0} is the account name.
  'Konto angelegt · angemeldet als {0:raw}': 'Account created · signed in as {0}',
  'Zu viele Fehlversuche · bitte später erneut probieren': 'Too many failed attempts · please try again later',
  'Name oder Passwort stimmt nicht': 'Name or password is incorrect',
  'Angemeldet als {0:raw}': 'Signed in as {0}',
  'Methode nicht erlaubt': 'Method not allowed',
  'Anfrage konnte nicht verarbeitet werden': 'The request could not be processed',
  // server/progress.ts, server/saveSlots.ts
  'Dafür musst du angemeldet sein': 'You need to be signed in for that',
  'Fortschritt konnte nicht verarbeitet werden': 'Progress could not be processed',
  // server/progressProtocol.ts: achievement names and details.
  'Die erste Ausgabe': 'The first edition',
  'Eine Festivalausgabe zu Ende gebracht.': 'Saw a festival edition through to the end.',
  'Erster Sieg': 'First win',
  'Ein Szenario gewonnen.': 'Won a scenario.',
  'Tourneeprofi': 'Touring pro',
  'Alle eingebauten Szenarien gewonnen.': 'Won every built-in scenario.',
  'Harter Hund': 'Tough cookie',
  'Ein Szenario auf „Schwer“ gewonnen.': 'Won a scenario on “Hard”.',
  'Große Namen': 'Big names',
  'Einen Headliner auf die Bühne geholt.': 'Brought a headliner to the stage.',
  'Querbeet': 'Mixed bag',
  'Alle acht Genres in einer Ausgabe gebucht.': 'Booked all eight genres in one edition.',
  'Ausverkauft': 'Sold out',
  '1.000 Anreisen in einer Ausgabe.': '1,000 arrivals in one edition.',
  'Wolke sieben': 'Cloud nine',
  'Eine Ausgabe mit mindestens 85 % Zufriedenheit.': 'An edition with at least 85% satisfaction.',
  'Goldgrube': 'Gold mine',
  '25.000 € Gewinn in einer Ausgabe.': '€25,000 profit in one edition.',
  'Rummelplatz': 'Funfair',
  'Fünf verschiedene Fahrgeschäfte auf einem Gelände.': 'Five different rides on the same grounds.',
  'Werbepartner': 'Brand partner',
  'Einen Sponsorvertrag erfüllt.': 'Fulfilled a sponsorship deal.',
  'Sturmfest': 'Weathered the storm',
  'Ein Unwetter ohne Verletzte überstanden.': 'Came through a storm without injuries.',
  // server/rooms.ts (the build pause 'Host ist weg – Bauen pausiert' is in the net area).
  'Host hat gewechselt – Aktion verworfen': 'Host has changed – action discarded',
  'Der Server ist gerade voll. Bitte später noch einmal.': 'The server is full right now. Please try again later.',
  'Kein Spiel mit diesem Code': 'No game with this code',
  'Der Host hat das Spiel beendet': 'The host has ended the game',
  'Host ist nicht verbunden': 'Host is not connected',
  'Ungültige Nachricht': 'Invalid message',
  'Zuerst einem Spiel beitreten': 'Join a game first',
  // server/saveSlots.ts
  'Name und Spielstand sind erforderlich': 'Name and save are required',
  'Spielstand ist zu groß': 'Save is too large',
  'Spielstand ist ungültig': 'Save is invalid',
  'Nicht gefunden': 'Not found',
  'Maximal {0:n} Spielstände je Konto': 'At most {0} saves per account',
  'Sichtbarkeit fehlt': 'Visibility is missing',
  'Spielstand konnte nicht verarbeitet werden': 'The save could not be processed',
  // server/scenarios.ts
  'Nur GET oder POST': 'Only GET or POST',
  'Szenario braucht eine id': 'Scenario needs an id',
  'Szenario konnte nicht gespeichert werden': 'Scenario could not be saved',
  // server/serve.ts, server/wsPlugin.ts
  'Spielserver-Fehler': 'Game server error',
  'Spielserver-Fehler beim Lesen der Spielstände': 'Game server error while reading saves',
}
/** Entity default-name vocabulary: bases for the ordinal rule and name templates. */
export const names: Record<string, string> = {
}
