// Area: core. Sources: src/game/sentinels.ts, src/main.ts (boot caption), src/app/playerSettings.ts and
// src/app/shell.ts (language setting), src/ui/playerSettingsPanel.ts, src/ui/confirmDialog.ts
export const text: Record<string, string> = {
  // Sentinels: canonical text that code compares against (src/game/sentinels.ts).
  'Befehl eingeplant': 'Command queued',
  'Hier gibt es nichts abzureißen': 'Nothing to demolish here',
  'Dieses Objekt ist auf der Fläche nicht erlaubt.': 'This object is not allowed in this area.',
  // Settings: language switch.
  'Automatisch (Browser)': 'Automatic (browser)',
  'Jetzt neu laden': 'Reload now',
  'Gilt ab dem nächsten Start.': 'Takes effect the next time the game starts.',
  'Die Sprache ließ sich auf diesem Gerät nicht speichern.': 'The language could not be saved on this device.',
  'Sprache wechseln?': 'Change language?',
  'Das Spiel lädt dafür neu. Nicht gespeicherte Änderungen gehen dabei verloren.': 'The game reloads to switch. Unsaved changes will be lost.',
  'Neu laden': 'Reload',
  'Abbrechen': 'Cancel',
  // Confirmation dialog defaults.
  'OK': 'OK',
  // Boot caption after the entry chunk (index.html shows “Loading …” before it).
  'Modelle werden vorbereitet …': 'Preparing models …',
}
/** Entity default-name vocabulary: bases for the ordinal rule and name templates. */
export const names: Record<string, string> = {
}
