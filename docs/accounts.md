# Konten und Sessions

Konten gehören zum optionalen Serverbetrieb. Passwörter werden mit scrypt und
individuellem Salt gespeichert; zufällige Session-Tokens liegen nur gehasht in
SQLite. Ohne TLS ist das Protokoll außerhalb eines vertrauenswürdigen Netzes
nicht ausreichend geschützt.

## Wo finden

| Aufgabe | Vollständiger Pfad | Einstieg / Symbol |
| --- | --- | --- |
| Browser-Client | `src/accounts.ts` | `registerAccount`, `signIn`, `signOut`, `refreshAccount`, `currentAccount` |
| Konto-API und Sessions | `server/accounts.ts` | `handleAccountRequest`, `accountOfRequest`, `ensureAccountsSchema` |
| Gemeinsame SQLite-Verbindung | `server/database.ts` | `db`, `closeDatabase` |
| Kontogebundene Saves | `server/saveSlots.ts` | `handleSaveRequest` |
| HTTP-Verkabelung | `server/serve.ts`, `server/wsPlugin.ts` | `handleAccountRequest` |
| Regressionen | `tests/accounts.ts` | `testAccounts` |

## Wichtige Invarianten

- Niemals Klartextpasswörter oder rohe Session-Tokens persistieren.
- Cookies bleiben `HttpOnly`, `SameSite=Lax`, auf `/` begrenzt und laufen ab.
- Anmeldung verrät nicht, ob Name oder Passwort falsch war; Fehlversuche werden
  pro normalisiertem Namen und Ursprung begrenzt.
- Saves dürfen nur vom Besitzer geschrieben werden; öffentliche Saves sind für
  andere ausschließlich lesbar. Details: [saves.md](saves.md).
- `ensureAccountsSchema` läuft vor Save-Abfragen mit `users`-Join.
- Texte ([i18n.md](i18n.md)): Der Server antwortet mit kanonischem Deutsch (`de`
  aus `server/i18nMarker.ts`, Katalog `src/i18n/en/server.ts`); die Kontozeile des
  Titelbildschirms lokalisiert `message`. Die eigenen Meldungen von
  `src/accounts.ts` (keine Antwort, kein Kontakt, Passwörter ungleich) sind UI-Text
  mit `t` (Katalog `src/i18n/en/net.ts`).

## Tests

`tests/accounts.ts` nutzt eine temporäre Datenbank und prüft Registrierung,
Hashing, Sessions, Logout, Eingabevalidierung und Rate-Limit. `tests/saves.ts`
prüft Eigentum und öffentliche Leserechte.

## Bei Änderungen dieses Dokuments

Aktualisieren, wenn Endpunkte, Cookie-/Hashing-Regeln, Schema, Autorisierung
oder die Kopplung an Server-Saves geändert werden.

## Fortschritt im Konto (0.2.11)

`GET /api/progress` und `PUT /api/progress` (`server/progress.ts`) halten je
Konto einen JSON-Datensatz mit geschafften Szenarien und Erfolgen (Tabelle
`progress`, Fremdschlüssel auf `users`, 64 KB Grenze). Nur mit Session; `PUT`
mergt best-of mit dem Gespeicherten. Details: [progress.md](progress.md).
