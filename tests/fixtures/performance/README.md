# Versionierte Performance-Spielstände

Hier liegen bewusst ausgewählte, anonymisierte Referenz-Spielstände. Persönliche
Dateien aus `saves/` bleiben ignoriert und dürfen nicht kopiert oder überschrieben
werden.

## Fixture hinzufügen

1. Den gebauten Spielstand als vollständiges JSON exportieren.
2. Personen-/Kontonamen und andere persönliche Daten entfernen.
3. Die Datei mit stabiler, beschreibender ID hier ablegen, etwa
   `crowded-five-day.json`.
4. In `manifest.json` registrieren:

```json
{
  "id": "crowded-five-day",
  "file": "tests/fixtures/performance/crowded-five-day.json",
  "ticks": 120
}
```

Die ID bleibt stabil, auch wenn der Snapshot später kontrolliert aktualisiert
wird. Im Commit beschreiben, welche Last der Stand abbildet und Besucher-,
Fahrzeug- sowie Gebäudezahl festhalten.

## Registrierte Fixtures

- `festivalmittel`: v32-Mittelklasse-Festival mit 832 Besuchern,
  2.376 Gebäuden und 34 Mitarbeitenden; Standardlauf 120 Ticks.

## Ausführen

- Ein Fixture: `npm run test:performance -- festivalmittel 120`
- Alle registrierten Fixtures: `npm run test:performance:fixtures`
- Alle mit gleicher Tickzahl: `npm run test:performance:fixtures -- 1200`

Die Suite verändert nur Arbeitsspeicher und schreibt den Snapshot nicht zurück.
Vorher-/Nachher-Vergleiche müssen dasselbe Fixture, dieselbe Tickzahl und dieselbe
Spielversion verwenden.
