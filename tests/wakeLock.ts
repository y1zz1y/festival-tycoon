import assert from 'node:assert/strict'
import { isWakeLockSupported, keepScreenAwake } from '../src/ui/wakeLock'

type Listener = () => void

/** A stand-in for the browser's screen lock, down to releasing itself. */
function fakeEnvironment(options: { supported?: boolean; denied?: boolean } = {}) {
  const listeners = new Set<Listener>()
  const granted: Array<{ released: boolean; release(): Promise<void>; addEventListener(type: 'release', listener: Listener): void; fireRelease(): void }> = []
  let pending: Array<() => void> = []
  const document = {
    hidden: false,
    addEventListener: (type: string, listener: Listener) => { if (type === 'visibilitychange') listeners.add(listener) },
    removeEventListener: (type: string, listener: Listener) => { if (type === 'visibilitychange') listeners.delete(listener) },
  }
  const navigator = options.supported === false ? {} : {
    wakeLock: {
      request: (type: 'screen') => {
        assert.equal(type, 'screen')
        if (options.denied) return Promise.reject(new Error('denied'))
        const releaseListeners = new Set<Listener>()
        const sentinel = {
          released: false,
          release: async (): Promise<void> => { sentinel.released = true },
          addEventListener: (_type: 'release', listener: Listener) => { releaseListeners.add(listener) },
          fireRelease: (): void => { sentinel.released = true; releaseListeners.forEach(listener => listener()) },
        }
        granted.push(sentinel)
        // Resolved on demand, so the test can see the in-flight window.
        return new Promise<typeof sentinel>((resolve) => pending.push(() => resolve(sentinel)))
      },
    },
  }
  return {
    granted,
    document,
    // Node has a real navigator with only a getter, so it is redefined rather
    // than assigned.
    install(): void {
      Object.defineProperty(globalThis, 'document', { value: document, configurable: true, writable: true })
      Object.defineProperty(globalThis, 'navigator', { value: navigator, configurable: true, writable: true })
    },
    /** Lets every outstanding request resolve, then drains the microtasks. */
    async settle(): Promise<void> {
      const waiting = pending
      pending = []
      waiting.forEach(resolve => resolve())
      for (let i = 0; i < 5; i++) await Promise.resolve()
    },
    hide(hidden: boolean): void {
      document.hidden = hidden
      listeners.forEach(listener => listener())
    },
    held(): number { return granted.filter(sentinel => !sentinel.released).length },
  }
}

export async function testWakeLock(): Promise<void> {
  const previous = [
    ['document', Object.getOwnPropertyDescriptor(globalThis, 'document')] as const,
    ['navigator', Object.getOwnPropertyDescriptor(globalThis, 'navigator')] as const,
  ]
  try {
    {
      const env = fakeEnvironment()
      env.install()
      assert.equal(isWakeLockSupported(), true)
      let wanted = false
      const keeper = keepScreenAwake(() => wanted)
      await env.settle()
      assert.equal(env.granted.length, 0, 'nothing is locked while no session is running')

      wanted = true
      keeper.refresh()
      await env.settle()
      assert.equal(env.held(), 1, 'a running session holds the screen')

      // Asking again must not stack locks; the second call has nothing to do.
      keeper.refresh()
      await env.settle()
      assert.equal(env.granted.length, 1, 'refreshing an existing lock does not take another')

      // The browser releases it on its own when the page goes away, and takes it
      // back when the page returns.
      env.hide(true)
      await env.settle()
      assert.equal(env.held(), 0, 'a hidden page holds nothing')
      env.hide(false)
      await env.settle()
      assert.equal(env.held(), 1, 'and gets it back on coming into view')

      // A lock the browser dropped by itself is not still counted as held.
      env.granted[env.granted.length - 1]!.fireRelease()
      keeper.refresh()
      await env.settle()
      assert.equal(env.held(), 1, 'a lock dropped by the browser is taken again')

      wanted = false
      keeper.refresh()
      await env.settle()
      assert.equal(env.held(), 0, 'the end of the session gives the screen back')
      keeper.dispose()
    }

    // A session that ends while the request is still in flight must not leave a
    // lock behind that nobody asked for any more.
    {
      const env = fakeEnvironment()
      env.install()
      let wanted = true
      const keeper = keepScreenAwake(() => wanted)
      wanted = false
      await env.settle()
      assert.equal(env.held(), 0, 'a lock granted after the session ended is handed straight back')
      keeper.dispose()
    }

    // Refusal and absence are both ordinary: the game plays the same either way.
    {
      const env = fakeEnvironment({ denied: true })
      env.install()
      const keeper = keepScreenAwake(() => true)
      await env.settle()
      assert.equal(env.held(), 0)
      keeper.dispose()
    }
    {
      const env = fakeEnvironment({ supported: false })
      env.install()
      assert.equal(isWakeLockSupported(), false)
      const keeper = keepScreenAwake(() => true)
      await env.settle()
      keeper.dispose()
    }
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete (globalThis as Record<string, unknown>)[name]
    }
  }
}
