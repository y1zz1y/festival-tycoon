import type { GameState } from '../game/GameState'
import type { GameSnapshot } from '../game/types/snapshot'
import type { MultiplayerSession, MultiplayerStatus } from '../net/session'
import { demotedBackupName, demotedNotice, hostAwayNotice } from '../net/takeover'
import { chooseAction } from './confirmDialog'
import { loadWithOverlay } from './loadingOverlay'
import { localize, t } from '../i18n'

export type HostTakeoverUi = {
  /** Redraws the banner for a new session status. */
  render(status: MultiplayerStatus): void
  /** „Trennen“: a host with guests is asked whether to hand the room over first. */
  leave(): Promise<void>
}

/**
 * The player's side of a host takeover (docs/multiplayer.md): the banner a guest
 * sees while the host is away, binding a world the session rebuilt (promoted, or
 * carrying on alone after the room ended), the backup a demoted host keeps, and
 * the host's choice between handing the room over and ending it for everyone.
 */
export function mountHostTakeoverUi(options: {
  session: MultiplayerSession
  bindGameState(game: GameState): void
  backupLocally(name: string, snapshot: Readonly<GameSnapshot>): Promise<string>
  showToast(message: string, isError?: boolean): void
}): HostTakeoverUi {
  const { session } = options
  const banner = document.createElement('div')
  banner.className = 'mp-host-banner'
  banner.setAttribute('role', 'status')
  banner.setAttribute('aria-live', 'polite')
  banner.hidden = true
  ;(document.querySelector('.game-shell') ?? document.body).append(banner)
  let status: MultiplayerStatus | null = null
  let countdown = 0

  const draw = (): void => {
    const away = status !== null && status.mode === 'client' && status.connected && status.hostAway
    // The notice is canonical German from the net layer; it is translated for display only.
    const text = away ? localize(hostAwayNotice(status!.takeoverAt, Date.now())) : ''
    banner.hidden = !text
    if (banner.textContent !== text) banner.textContent = text
    const ticking = away && status!.takeoverAt > Date.now()
    if (ticking && !countdown) countdown = window.setInterval(draw, 500)
    if (!ticking && countdown) {
      window.clearInterval(countdown)
      countdown = 0
    }
  }

  /**
   * Binds a world behind the loading overlay. A hidden tab paints nothing, so
   * the overlay's frames would never come — and a room waiting for its new host
   * must not wait for the tab to be looked at again.
   */
  const swapIn = (next: GameState, caption: string): void => {
    let done = false
    const bind = (): void => {
      if (done) return
      done = true
      options.bindGameState(next)
    }
    if (document.hidden) {
      bind()
      return
    }
    loadWithOverlay(caption, bind)
    window.setTimeout(bind, 1500)
  }

  session.onPromoted = (next) => swapIn(next, t`Du übernimmst Raum ${session.status.code} …`)
  session.onContinueSolo = (next) => swapIn(next, t('Der Park wird für dich allein aufgebaut …'))
  session.onDemoted = (backup, info) => {
    options.backupLocally(demotedBackupName(info.code), backup)
      .then(() => options.showToast(demotedNotice(info.hostName, info.code)))
      .catch((error: unknown) => options.showToast(
        demotedNotice(info.hostName, info.code, error instanceof Error ? error.message : String(error)),
        true,
      ))
  }

  return {
    render: (next) => {
      status = next
      draw()
    },
    leave: async () => {
      const heir = session.status.connected ? session.takeoverCandidate() : undefined
      if (!heir) {
        session.disconnect()
        return
      }
      const choice = await chooseAction({
        title: t('Raum verlassen?'),
        message: t('Mitspieler sind noch im Raum. Übergibst du, läuft die Welt auf dem Rechner des neuen Hosts weiter und du spielst allein mit deiner Kopie weiter.'),
        choices: [
          { id: 'handOver', label: t`An ${heir.name} übergeben`, tone: 'primary' },
          { id: 'end', label: t('Spiel für alle beenden'), tone: 'danger' },
        ],
        cancelLabel: t('Abbrechen'),
      })
      // The room may have changed while the dialog was open.
      if (choice === 'handOver' && session.status.mode === 'host') {
        session.handOver(heir.id)
        options.showToast(t`Raum an ${heir.name} übergeben`)
      } else if (choice === 'end' || (choice === 'handOver' && session.status.mode !== 'host')) {
        session.disconnect()
      }
    },
  }
}
