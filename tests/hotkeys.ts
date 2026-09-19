import assert from 'node:assert/strict'
import {
  actionForEvent,
  hotkeyCode,
  hotkeyLabel,
  HOTKEYS,
  isBindableCode,
  loadHotkeys,
  normalizeCode,
  resetHotkeys,
  setHotkey,
} from '../src/ui/hotkeys'

export function testHotkeys(): void {
  const store = new Map<string, string>()
  const previous = (globalThis as { window?: unknown }).window
  Object.assign(globalThis, {
    window: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
    },
  })
  try {
    resetHotkeys()
    const press = (code: string) => actionForEvent({ code } as KeyboardEvent)

    // Every action has a key, and no two actions start out on the same one.
    const codes = HOTKEYS.map(key => hotkeyCode(key.action))
    assert.equal(new Set(codes).size, HOTKEYS.length, 'the defaults do not collide')
    assert.equal(press('Digit1'), 'toolPath')
    assert.equal(press('Space'), 'togglePause')
    assert.equal(press('KeyQ'), 'cameraLeft')
    assert.equal(press('F8'), null, 'an unbound key means nothing')

    // The numpad row counts as the digit row, in both directions.
    assert.equal(normalizeCode('Numpad7'), 'Digit7')
    assert.equal(normalizeCode('KeyR'), 'KeyR')
    assert.equal(press('Numpad1'), 'toolPath')
    setHotkey('toolPath', 'Numpad4')
    assert.equal(hotkeyCode('toolPath'), 'Digit4', 'a numpad binding is stored as the digit')

    // A key belongs to one action: whoever held it is left unbound rather than
    // both firing off the same press.
    assert.equal(hotkeyCode('toolRide'), '', 'the previous holder of Digit4 gave it up')
    assert.equal(press('Digit4'), 'toolPath')
    setHotkey('toolRide', 'KeyT')
    assert.equal(press('KeyT'), 'toolRide')
    assert.equal(press('Digit4'), 'toolPath', 'and the other binding is untouched')

    // Keys that mean something everywhere else stay out of reach.
    assert.equal(isBindableCode('KeyT'), true)
    assert.equal(isBindableCode('Escape'), false)
    assert.equal(isBindableCode('Tab'), false)
    assert.equal(isBindableCode('F5'), false)
    assert.equal(isBindableCode(''), false)

    // What the row says, rather than what the browser calls it.
    assert.equal(hotkeyLabel('Space'), 'Leertaste')
    assert.equal(hotkeyLabel('KeyR'), 'R')
    assert.equal(hotkeyLabel('Digit7'), '7')
    assert.equal(hotkeyLabel('PageUp'), 'Bild ↑')

    // Bindings survive a reload, and a broken or foreign entry is ignored
    // instead of leaving the game with no keys at all.
    assert.ok(store.get('festival-hotkeys')?.includes('KeyT'))
    resetHotkeys()
    assert.equal(hotkeyCode('toolRide'), 'Digit4')
    store.set('festival-hotkeys', JSON.stringify({ toolRide: 'KeyT', nonsense: 'KeyZ', toolFood: 7 }))
    loadHotkeys()
    assert.equal(hotkeyCode('toolRide'), 'KeyT', 'a stored binding comes back')
    assert.equal(hotkeyCode('toolFood'), 'Digit2', 'a value that is not a key is left alone')
    assert.equal(press('KeyZ'), null, 'an action the game does not have is skipped')
    store.set('festival-hotkeys', 'not json')
    loadHotkeys()
    assert.equal(hotkeyCode('toolRide'), 'KeyT', 'and unreadable storage changes nothing')
    resetHotkeys()
  } finally {
    if (previous === undefined) delete (globalThis as { window?: unknown }).window
    else Object.assign(globalThis, { window: previous })
  }
}
