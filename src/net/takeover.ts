import { GameState } from '../game/GameState'
import { packWorld } from './codec'
import type { WorldSnapshot } from './protocol'
import { de, named, nested, num, plural, verbatim } from '../i18n/marker'

/** What a guest is told when it tries to build while the room has no host. */
export const HOST_AWAY_BUILD_MESSAGE = de('Host ist weg – Bauen pausiert')

/**
 * Builds the game a player carries on with from a world that came over the
 * network: the server's copy when a guest takes a room over, or the guest's own
 * mirror when the room ends (`world` left out).
 *
 * It takes the path a loaded save takes — `GameState.fromJSON`, so migrate,
 * construct and repair — instead of switching the mirror to host in place: a
 * mirror never ran a tick, its RNG is whatever it was before joining, and its
 * id counter, queues, power and access were never built. Height and rotation
 * come from the player's game; the tool falls back to inspecting, as after any
 * load. `code` stamps the room code a new host now holds; without it the world
 * keeps the code this player's own game had.
 */
export function gameFromNetworkWorld(
  world: WorldSnapshot | undefined,
  local: GameState,
  code?: string,
): GameState | null {
  const source = world ?? packWorld(local.snapshot)
  return GameState.fromJSON(JSON.stringify({
    ...source,
    selectedTool: local.snapshot.selectedTool,
    buildElevation: local.snapshot.buildElevation,
    buildRotation: local.snapshot.buildRotation,
    multiplayerCode: code ?? local.snapshot.multiplayerCode,
  }))
}

/** The reason server/rooms.ts gives when it ends a room; compared canonical with canonical. */
export const HOST_ENDED_GAME = de('Der Host hat das Spiel beendet')

/**
 * What a guest reads when its room ends and it keeps the park. The server's one
 * reason gets a whole sentence of its own; any other reason (a newer server) is
 * shown as it came.
 */
export function continueSoloNotice(reason: string): string {
  return reason === HOST_ENDED_GAME
    ? de('Der Host hat das Spiel beendet – du spielst allein weiter.')
    : de`${verbatim(reason)} – du spielst allein weiter.`
}

/** The line a guest reads while the host's seat is empty. */
export function hostAwayNotice(takeoverAt: number, now: number): string {
  if (takeoverAt <= 0) return de('Der Host ist weg und niemand hat den Spielstand – warte auf Rückkehr.')
  const seconds = Math.ceil((takeoverAt - now) / 1000)
  return seconds > 0 ? de`Host ist weg – Übernahme in ${num(seconds)} s` : de('Host ist weg – Übernahme läuft …')
}

/** Commands no host will ever answer, dropped rather than sent again. */
export function droppedActionsNotice(count: number): string {
  return plural(
    count,
    de`${num(count)} unbestätigte Aktion verworfen – bitte prüfen.`,
    de`${num(count)} unbestätigte Aktionen verworfen – bitte prüfen.`,
  )
}

/**
 * What a guest reads when another guest took the room over while commands of its
 * own were still unanswered: one sentence set, so the English client finds it whole.
 */
export function hostChangedDroppedNotice(hostName: string, dropped: number): string {
  return plural(
    dropped,
    de`${verbatim(hostName)} ist jetzt Host. Das Spiel läuft weiter. ${num(dropped)} unbestätigte Aktion verworfen – bitte prüfen.`,
    de`${verbatim(hostName)} ist jetzt Host. Das Spiel läuft weiter. ${num(dropped)} unbestätigte Aktionen verworfen – bitte prüfen.`,
  )
}

/** What a guest reads the moment it becomes host of a room. */
export function promotedNotice(code: string, worldAgeMs: number | undefined, dropped: number): string {
  const aged = worldAgeMs !== undefined && worldAgeMs > 2000
  const seconds = Math.round((worldAgeMs ?? 0) / 1000)
  if (dropped > 0) {
    const notice = droppedActionsNotice(dropped)
    return aged
      ? de`Du bist jetzt Host von Raum ${verbatim(code)}. Die Welt läuft auf deinem Rechner weiter – Tab offen lassen und speichern. Stand von vor ${num(seconds)} s übernommen. ${nested(notice)}`
      : de`Du bist jetzt Host von Raum ${verbatim(code)}. Die Welt läuft auf deinem Rechner weiter – Tab offen lassen und speichern. ${nested(notice)}`
  }
  return aged
    ? de`Du bist jetzt Host von Raum ${verbatim(code)}. Die Welt läuft auf deinem Rechner weiter – Tab offen lassen und speichern. Stand von vor ${num(seconds)} s übernommen.`
    : de`Du bist jetzt Host von Raum ${verbatim(code)}. Die Welt läuft auf deinem Rechner weiter – Tab offen lassen und speichern.`
}

/** The slot a promoted host's autosave and quicksave write to, never the player's own quicksave. */
export function takeoverSaveName(code: string): string {
  return code ? de`Übernommen ${verbatim(code)}` : de('Übernommen')
}

/** The local save a demoted host keeps of the world it ran while it was gone. */
export function demotedBackupName(code: string): string {
  return code ? de`Vor Host-Wechsel ${verbatim(code)}` : de('Vor Host-Wechsel')
}

/** What a host that came back to a taken-over room is told; `failure` says why the backup did not work. */
export function demotedNotice(hostName: string, code: string, failure?: string): string {
  const kept = failure === undefined
    ? de`Deine Welt wurde als „${named(demotedBackupName(code))}“ gesichert.`
    : de`Die Sicherung deiner Welt ist fehlgeschlagen: ${verbatim(failure)}`
  return hostName
    ? de`Während du weg warst, hat ${verbatim(hostName)} übernommen. Du spielst als Gast weiter. ${nested(kept)}`
    : de`Während du weg warst, hat ein Gast übernommen. Du spielst als Gast weiter. ${nested(kept)}`
}
