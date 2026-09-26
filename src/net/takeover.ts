import { GameState } from '../game/GameState'
import { packWorld } from './codec'
import type { WorldSnapshot } from './protocol'

/** What a guest is told when it tries to build while the room has no host. */
export const HOST_AWAY_BUILD_MESSAGE = 'Host ist weg – Bauen pausiert'

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

/** The line a guest reads while the host's seat is empty. */
export function hostAwayNotice(takeoverAt: number, now: number): string {
  if (takeoverAt <= 0) return 'Der Host ist weg und niemand hat den Spielstand – warte auf Rückkehr.'
  const seconds = Math.ceil((takeoverAt - now) / 1000)
  return seconds > 0 ? `Host ist weg – Übernahme in ${seconds} s` : 'Host ist weg – Übernahme läuft …'
}

/** Commands no host will ever answer, dropped rather than sent again. */
export function droppedActionsNotice(count: number): string {
  return count === 1
    ? '1 unbestätigte Aktion verworfen – bitte prüfen.'
    : `${count} unbestätigte Aktionen verworfen – bitte prüfen.`
}

/** What a guest reads the moment it becomes host of a room. */
export function promotedNotice(code: string, worldAgeMs: number | undefined, dropped: number): string {
  const parts = [`Du bist jetzt Host von Raum ${code}. Die Welt läuft auf deinem Rechner weiter – Tab offen lassen und speichern.`]
  if (worldAgeMs !== undefined && worldAgeMs > 2000) parts.push(`Stand von vor ${Math.round(worldAgeMs / 1000)} s übernommen.`)
  if (dropped > 0) parts.push(droppedActionsNotice(dropped))
  return parts.join(' ')
}

/** The slot a promoted host's autosave and quicksave write to, never the player's own quicksave. */
export function takeoverSaveName(code: string): string {
  return `Übernommen ${code}`.trim()
}

/** The local save a demoted host keeps of the world it ran while it was gone. */
export function demotedBackupName(code: string): string {
  return `Vor Host-Wechsel ${code}`.trim()
}

/** What a host that came back to a taken-over room is told; `failure` says why the backup did not work. */
export function demotedNotice(hostName: string, code: string, failure?: string): string {
  const who = hostName || 'ein Gast'
  const kept = failure === undefined
    ? `Deine Welt wurde als „${demotedBackupName(code)}“ gesichert.`
    : `Die Sicherung deiner Welt ist fehlgeschlagen: ${failure}`
  return `Während du weg warst, hat ${who} übernommen. Du spielst als Gast weiter. ${kept}`
}
