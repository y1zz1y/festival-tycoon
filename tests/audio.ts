import assert from 'node:assert/strict'
import {
  audioDistance2d,
  audioWorldFromSnapshot,
  collectAmbientEmitters,
  createAudioPlannerState,
  detectAudioCues,
  inAudioRange,
  listenerFromCamera,
  planFestivalAudio,
  selectByVoiceBudget,
  type AudioCue,
  type AudioWorld,
  type AudioWorldVisitor,
} from '../src/game/audio'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'

const AUDIO = SIMULATION_CONFIG.audio

function visitor(
  id: string,
  x: number,
  z: number,
  extra: Partial<AudioWorldVisitor> = {},
): AudioWorldVisitor {
  return { id, x, z, state: 'exploring', emotion: 'neutral', ...extra }
}

function world(partial: Partial<AudioWorld> & { simTick: number }): AudioWorld {
  return {
    buildings: [],
    visitors: [],
    ...partial,
  }
}

export function testFestivalAudio(): void {
  const lookAt = { x: 4, y: 0, z: -2 }
  const camera = { x: lookAt.x + 18, y: 20, z: lookAt.z + 18 }
  const listener = listenerFromCamera(camera, lookAt)
  assert.equal(listener.x, lookAt.x, 'orbit listener sits on the camera look-at, not the eye')
  assert.equal(listener.z, lookAt.z)
  assert.notEqual(listener.x, 99)
  const crowd = Array.from({ length: 40 }, (_, i) => visitor(`v${i}`, 80 + (i % 4), 80 + Math.floor(i / 4)))
  assert.equal(
    crowd.every((guest) => guest.x !== listener.x || guest.z !== listener.z),
    true,
    'listener is not a visitor position',
  )
  const walk = listenerFromCamera({ x: 3, y: 1.6, z: 5 }, { x: 4, y: 1.6, z: 6 }, undefined, 'camera')
  assert.equal(walk.x, 3)
  assert.equal(walk.z, 5)

  const far = { x: listener.x + AUDIO.maxDistance + 8, z: listener.z + 4 }
  assert.equal(inAudioRange(far.x, far.z, listener), false)
  const distantCue: AudioCue = {
    id: 'far-place',
    kind: 'placeBuilding',
    x: far.x,
    z: far.z,
    priority: 'local',
    intensity: 1,
    tick: 1,
  }
  const nearbyCue: AudioCue = {
    id: 'near-place',
    kind: 'placeBuilding',
    x: listener.x + 2,
    z: listener.z + 1,
    priority: 'local',
    intensity: 1,
    tick: 1,
  }
  const ranged = selectByVoiceBudget([distantCue, nearbyCue], listener, AUDIO.maxOneShotVoices)
  assert.deepEqual(ranged.map((cue) => cue.id), ['near-place'])
  assert.ok(audioDistance2d(distantCue.x, distantCue.z, listener.x, listener.z) > AUDIO.maxDistance)

  const cheerers = Array.from({ length: 80 }, (_, i) =>
    visitor(`c${i}`, listener.x + (i % 6) * 0.4, listener.z + Math.floor(i / 6) * 0.3, {
      emotion: 'excited',
      state: 'partying',
      concertId: 'show-1',
    }),
  )
  const prev = world({ simTick: 10, visitors: cheerers })
  const next = world({ simTick: 11, visitors: cheerers })
  const rawCheers = detectAudioCues(prev, next).filter((cue) => cue.kind === 'cheer')
  assert.ok(rawCheers.length > 0, 'clustered cheer emits at least one cue')
  assert.ok(rawCheers.length < cheerers.length, 'cheers are clustered, not per visitor')
  const planned = planFestivalAudio(next, listener, createAudioPlannerState())
  const cheers = planned.plan.oneShots.filter((cue) => cue.kind === 'cheer')
  assert.ok(cheers.length <= AUDIO.maxOneShotVoices)
  assert.ok(planned.plan.oneShots.length <= AUDIO.maxOneShotVoices)
  const again = planFestivalAudio(world({ simTick: 12, visitors: cheerers }), listener, planned.state)
  assert.equal(
    again.plan.oneShots.filter((cue) => cue.kind === 'cheer').length,
    0,
    'cheer cooldown suppresses retrigger on the next tick',
  )

  const burst = Array.from({ length: 40 }, (_, i) => ({
    id: `p${i}`,
    kind: 'placeBuilding' as const,
    x: listener.x + i * 0.2,
    z: listener.z,
    priority: 'local' as const,
    intensity: 1,
    tick: 3,
  }))
  const capped = selectByVoiceBudget(burst, listener, AUDIO.maxOneShotVoices)
  assert.equal(capped.length, AUDIO.maxOneShotVoices)

  const stages = world({
    simTick: 20,
    buildings: [
      { id: 'stage-a', kind: 'stage', x: listener.x, z: listener.z },
      { id: 'woods', kind: 'tree', x: listener.x + 3, z: listener.z + 2 },
      { id: 'far-stage', kind: 'stage', x: listener.x + 80, z: listener.z + 80 },
    ],
    performingStageIds: ['stage-a'],
    visitors: Array.from({ length: 8 }, (_, i) =>
      visitor(`path${i}`, listener.x + 1 + i * 0.2, listener.z + 1, { state: 'seeking' }),
    ),
  })
  const ambients = collectAmbientEmitters(stages, listener)
  assert.ok(ambients.some((emitter) => emitter.zone === 'concert'))
  assert.ok(ambients.some((emitter) => emitter.zone === 'woods'))
  assert.equal(ambients.some((emitter) => emitter.id.startsWith('concert:') && Math.abs(emitter.x - 80) < 2), false)
  const ambientPlan = planFestivalAudio(stages, listener, createAudioPlannerState()).plan
  assert.ok(ambientPlan.ambients.length <= AUDIO.maxAmbientVoices)

  const launched = detectAudioCues(
    world({
      simTick: 30,
      coasters: [{ id: 'c1', train: { state: 'boarding', speed: 0, x: listener.x, z: listener.z, passengers: 8 } }],
    }),
    world({
      simTick: 31,
      coasters: [{ id: 'c1', train: { state: 'running', speed: 18, x: listener.x, z: listener.z, passengers: 8 } }],
    }),
  )
  assert.ok(launched.some((cue) => cue.kind === 'coasterLaunch'))
  assert.ok(launched.some((cue) => cue.kind === 'scream'))
  assert.equal(launched.filter((cue) => cue.kind === 'scream').length, 1)

  const mapped = audioWorldFromSnapshot({
    simTick: 4,
    buildings: [{ id: 's1', kind: 'stage', x: 0, z: 0 }],
    visitors: [visitor('a', 1, 1)],
    logistics: { roadVehicles: [{ id: 'b1', kind: 'bus', state: 'driving', position: { x: 2, z: 3 } }] },
    festival: { enabled: true, finished: false, bookings: [{ day: 0, start: 0, duration: 60, stageId: 's1' }] },
    day: 0,
    minute: 10,
  })
  assert.deepEqual(mapped.performingStageIds, ['s1'])
  assert.equal(mapped.vehicles?.[0]?.kind, 'bus')

  console.log('PASS festival audio: camera listener, range skip, voice cap, clustered cheers')
}
