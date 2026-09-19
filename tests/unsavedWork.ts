import assert from 'node:assert/strict'
import { GameState } from '../src/game/GameState'
import { confirmDiscardingWork, hasUnsavedWork, markWorkSaved, minutesSinceSave, setUnsavedWarnings, trackUnsavedWork, unsavedWarningsEnabled, WARN_AFTER_MS } from '../src/ui/unsavedWork'

export function testUnsavedWork(fixture: (count?: number) => GameState): void {
  const game = fixture(0)
  let now = 0
  let running = false
  trackUnsavedWork({ editRevision: () => game.editRevision, running: () => running, now: () => now })

  assert.equal(hasUnsavedWork(), false, 'the title screen alone has nothing to lose')
  running = true
  assert.equal(hasUnsavedWork(), false, 'a game that was just loaded counts as saved')

  assert.ok(game.place('path', 12, 4).ok)
  assert.equal(hasUnsavedWork(), true, 'building something leaves work to save')
  markWorkSaved()
  assert.equal(hasUnsavedWork(), false, 'saving settles it again')

  assert.ok(game.bulldoze(12, 4).ok)
  assert.equal(hasUnsavedWork(), true, 'tearing something down counts just the same')
  markWorkSaved()

  // The simulation running on its own is not a change the player made, but a session
  // left unsaved for five minutes is still worth asking about before it is discarded.
  const quiet = game.editRevision
  for (let tick = 0; tick < 600; tick++) game.tick(0.1)
  assert.equal(game.editRevision, quiet, 'ticking the world is not an edit')
  now = WARN_AFTER_MS
  assert.equal(hasUnsavedWork(), false, 'exactly five minutes is still inside the grace')
  now = WARN_AFTER_MS + 1
  assert.equal(hasUnsavedWork(), true, 'past it the session is worth a warning')
  assert.equal(minutesSinceSave(), 5)
  markWorkSaved()
  assert.equal(hasUnsavedWork(), false)
  running = false
  now += WARN_AFTER_MS * 4
  assert.equal(hasUnsavedWork(), false, 'back on the title screen nothing is pending')

  // Switched off in the settings, the routes that would ask go straight through —
  // the game still knows there is unsaved work, it just stops bringing it up.
  running = true
  assert.ok(game.place('path', 13, 4).ok)
  assert.equal(hasUnsavedWork(), true)
  assert.equal(unsavedWarningsEnabled(), true)
  setUnsavedWarnings(false)
  assert.equal(unsavedWarningsEnabled(), false)
  assert.equal(confirmDiscardingWork('Weiter?'), true, 'no question is asked while the warning is off')
  assert.equal(hasUnsavedWork(), true, 'and the pending work is still pending')
  setUnsavedWarnings(true)
}
