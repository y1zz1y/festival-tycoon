/**
 * Keeps the screen on while a multiplayer session is running.
 *
 * What this is actually for: a host is the one simulating, so the game only
 * runs while their machine does. Screen off usually means the machine suspends
 * shortly after, and a suspended machine drops the connection — the room then
 * waits for a host who is asleep.
 *
 * What it cannot do, and does not pretend to: the browser releases the lock the
 * moment the page is hidden, by design, so this protects the tab that is on
 * screen and nothing else. A backgrounded tab is a different matter, and one
 * that mostly takes care of itself — WebSocket pings are answered by the
 * browser's own network stack rather than by JavaScript, so a throttled tab
 * keeps the connection alive without help.
 */
type Sentinel = { released: boolean; release(): Promise<void>; addEventListener(type: 'release', listener: () => void): void }
type WakeLockApi = { request(type: 'screen'): Promise<Sentinel> }

export type KeepAwake = {
  /** Re-checks whether the lock should be held; call it when the session changes. */
  refresh(): void
  dispose(): void
}

function wakeLockApi(): WakeLockApi | null {
  const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock
  return api && typeof api.request === 'function' ? api : null
}

export function isWakeLockSupported(): boolean {
  return wakeLockApi() !== null
}

/**
 * Holds a screen lock for as long as `wanted()` says so and the page is on
 * screen. Everything here is best-effort: the request is refused on a hidden
 * page, under battery saver, and in browsers without the API, and none of that
 * is worth telling the player about — the game plays the same either way.
 */
export function keepScreenAwake(wanted: () => boolean): KeepAwake {
  let sentinel: Sentinel | null = null
  let requesting = false

  const release = (): void => {
    const held = sentinel
    sentinel = null
    void held?.release().catch(() => { /* already gone */ })
  }

  const acquire = (): void => {
    const api = wakeLockApi()
    if (!api || sentinel || requesting || document.hidden || !wanted()) return
    requesting = true
    api.request('screen').then(
      (next) => {
        requesting = false
        // The session may have ended while the request was in flight.
        if (!wanted() || document.hidden) {
          void next.release().catch(() => {})
          return
        }
        sentinel = next
        // The browser drops it on its own when the page is hidden or the screen
        // is locked; forgetting that would leave us thinking we still hold one.
        next.addEventListener('release', () => {
          if (sentinel === next) sentinel = null
        })
      },
      () => {
        requesting = false
      },
    )
  }

  const refresh = (): void => {
    if (wanted() && !document.hidden) acquire()
    else release()
  }

  const onVisibility = (): void => refresh()
  document.addEventListener('visibilitychange', onVisibility)
  refresh()

  return {
    refresh,
    dispose(): void {
      document.removeEventListener('visibilitychange', onVisibility)
      release()
    },
  }
}
