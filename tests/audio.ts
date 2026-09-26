import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AUDIO_ASSETS,
  MUSIC_BUFFER_KEYS,
  audioCueKey,
  audioCueRoll,
  audioDistance2d,
  audioWorldFromSnapshot,
  collectAmbientEmitters,
  createAudioPlannerState,
  detectAudioCues,
  inAudioRange,
  isCheerCandidate,
  listenerFromCamera,
  musicBedForGenre,
  musicEmitterId,
  planFestivalAudio,
  selectByVoiceBudget,
  type AudioCue,
  type AudioWorld,
  type AudioWorldVisitor,
} from '../src/game/audio'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import {
  audioAssetPublicPath,
  audioAssetUrl,
  fetchAudioArrayBuffer,
} from '../src/view/audioAssets'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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
    visitor(`c${i}`, listener.x + (i % 8) * 0.05, listener.z + Math.floor(i / 8) * 0.05, {
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
  const walkers = Array.from({ length: 20 }, (_, i) =>
    visitor(`w${i}`, listener.x + i * 0.2, listener.z, { emotion: 'excited', state: 'exploring' }),
  )
  assert.equal(walkers.every((guest) => !isCheerCandidate(guest)), true)
  assert.equal(
    detectAudioCues(world({ simTick: 10, visitors: walkers }), world({ simTick: 11, visitors: walkers }))
      .filter((cue) => cue.kind === 'cheer').length,
    0,
    'excited walkers without a concert are not cheer candidates',
  )
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
  const cheerKey = audioCueKey(rawCheers[0]!)
  let cheerHitTick = -1
  let cheerMissTick = -1
  for (let tick = 200; tick < 20000 && (cheerHitTick < 0 || cheerMissTick < 0); tick += AUDIO.cooldownTicks.cheer) {
    if (audioCueRoll('cheer', cheerKey, tick)) cheerHitTick = tick
    else cheerMissTick = tick
  }
  assert.ok(cheerHitTick >= 0 && cheerMissTick >= 0, 'cheer chance has both hit and miss windows')
  assert.ok(
    planFestivalAudio(world({ simTick: cheerHitTick, visitors: cheerers }), listener, createAudioPlannerState())
      .plan.oneShots.some((cue) => cue.kind === 'cheer'),
    'a ready cheer window with candidates can fire',
  )
  assert.equal(
    planFestivalAudio(world({ simTick: cheerMissTick, visitors: cheerers }), listener, createAudioPlannerState())
      .plan.oneShots.filter((cue) => cue.kind === 'cheer').length,
    0,
    'a failed cheer roll stays silent even when candidates exist',
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
    performingStages: [{ id: 'stage-a', bed: 'rock' }],
    visitors: Array.from({ length: 8 }, (_, i) =>
      visitor(`path${i}`, listener.x + 1 + i * 0.2, listener.z + 1, { state: 'seeking' }),
    ),
  })
  const ambients = collectAmbientEmitters(stages, listener)
  const musicId = musicEmitterId('stage-a')
  assert.ok(ambients.some((emitter) => emitter.zone === 'music' && emitter.id === musicId && emitter.bed === 'rock'))
  assert.ok(ambients.some((emitter) => emitter.zone === 'woods'))
  assert.equal(ambients.some((emitter) => emitter.zone === 'concert'), false)
  assert.equal(ambients.some((emitter) => emitter.id === musicEmitterId('far-stage')), false)
  const firstMusic = planFestivalAudio(stages, listener, createAudioPlannerState())
  assert.ok(firstMusic.plan.ambients.some((emitter) => emitter.id === musicId))
  assert.ok(firstMusic.plan.ambients.length <= AUDIO.maxAmbientVoices)
  const stillPlaying = planFestivalAudio(world({ ...stages, simTick: 21 }), listener, firstMusic.state)
  assert.ok(stillPlaying.plan.ambients.some((emitter) => emitter.id === musicId), 'music keeps the same loop id while the source stays live')
  const silent = planFestivalAudio(
    world({ ...stages, simTick: 22, performingStageIds: [], performingStages: [] }),
    listener,
    stillPlaying.state,
  )
  assert.equal(silent.plan.ambients.some((emitter) => emitter.zone === 'music'), false, 'no music without a performing source')
  const farListener = listenerFromCamera({ x: 120, y: 20, z: 120 }, { x: 110, y: 0, z: 110 })
  const farPlan = planFestivalAudio(stages, farListener, createAudioPlannerState())
  assert.equal(farPlan.plan.ambients.some((emitter) => emitter.zone === 'music'), false, 'music stays silent out of range')
  const edge = listenerFromCamera(
    { x: listener.x + AUDIO.maxDistance + 2, y: 20, z: listener.z },
    { x: listener.x + AUDIO.maxDistance - 1, y: 0, z: listener.z },
  )
  const keepEdge = planFestivalAudio(
    world({ ...stages, simTick: 23 }),
    { ...edge, x: listener.x + AUDIO.maxDistance + 3, z: listener.z },
    stillPlaying.state,
  )
  assert.ok(
    keepEdge.plan.ambients.some((emitter) => emitter.id === musicId),
    'already-playing music fades past maxDistance instead of restarting',
  )

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

  const idleBus = world({
    simTick: 40,
    vehicles: [{ id: 'bus-1', kind: 'bus', state: 'idle', x: listener.x + 2, z: listener.z }],
  })
  const drivingBus = world({
    simTick: 41,
    vehicles: [{ id: 'bus-1', kind: 'bus', state: 'driving', x: listener.x + 2, z: listener.z }],
  })
  const stillDriving = world({
    simTick: 42,
    vehicles: [{ id: 'bus-1', kind: 'bus', state: 'driving', x: listener.x + 2.4, z: listener.z }],
  })
  const haltedBus = world({
    simTick: 43,
    vehicles: [{ id: 'bus-1', kind: 'bus', state: 'at-stop', x: listener.x + 2.4, z: listener.z }],
  })
  assert.ok(detectAudioCues(idleBus, drivingBus, listener).some((cue) => cue.kind === 'busHiss' && cue.id.startsWith('start:')))
  assert.equal(
    detectAudioCues(drivingBus, stillDriving, listener).filter((cue) => cue.kind === 'busHiss').length,
    0,
    'a driving bus does not emit a continuous motor cue',
  )
  assert.ok(detectAudioCues(stillDriving, haltedBus, listener).some((cue) => cue.kind === 'busHiss' && cue.id.startsWith('halt:')))
  const approaching = detectAudioCues(
    world({
      simTick: 50,
      vehicles: [{ id: 'bus-2', kind: 'bus', state: 'driving', x: listener.x + AUDIO.vehiclePassRadius + 4, z: listener.z }],
    }),
    world({
      simTick: 51,
      vehicles: [{ id: 'bus-2', kind: 'bus', state: 'driving', x: listener.x + AUDIO.vehiclePassRadius - 1, z: listener.z }],
    }),
    listener,
  )
  assert.ok(approaching.some((cue) => cue.id.startsWith('pass:') && cue.kind === 'busHiss'))
  const beforeStart = planFestivalAudio(idleBus, listener, createAudioPlannerState())
  const started = planFestivalAudio(drivingBus, listener, beforeStart.state)
  assert.ok(started.plan.oneShots.some((cue) => cue.kind === 'busHiss'))
  const otherIdle = planFestivalAudio(world({
    simTick: 42,
    vehicles: [
      { id: 'bus-1', kind: 'bus', state: 'driving', x: listener.x + 2, z: listener.z },
      { id: 'bus-3', kind: 'bus', state: 'idle', x: listener.x + 1, z: listener.z },
    ],
  }), listener, started.state)
  const otherStart = planFestivalAudio(world({
    simTick: 43,
    vehicles: [
      { id: 'bus-1', kind: 'bus', state: 'driving', x: listener.x + 2, z: listener.z },
      { id: 'bus-3', kind: 'bus', state: 'driving', x: listener.x + 1, z: listener.z },
    ],
  }), listener, otherIdle.state)
  assert.equal(
    otherStart.plan.oneShots.filter((cue) => cue.kind === 'busHiss').length,
    0,
    'vehicle one-shots share a long kind cooldown',
  )
  // Every genre has its own loop and file; unknown genres play as indie.
  assert.equal(musicBedForGenre('metal'), 'metal')
  assert.equal(musicBedForGenre('dance'), 'dance')
  assert.equal(musicBedForGenre('schlager'), 'indie')
  for (const key of Object.values(MUSIC_BUFFER_KEYS)) assert.ok(AUDIO_ASSETS[key].startsWith('music/'), `${key} has a music file`)

  const mapped = audioWorldFromSnapshot({
    simTick: 4,
    buildings: [{ id: 's1', kind: 'stage', x: 0, z: 0 }],
    visitors: [visitor('a', 1, 1)],
    logistics: { roadVehicles: [{ id: 'b1', kind: 'bus', state: 'driving', position: { x: 2, z: 3 } }] },
    festival: {
      enabled: true,
      finished: false,
      bookings: [{ day: 0, start: 0, duration: 60, stageId: 's1', bandId: 'iron' }],
    },
    day: 0,
    minute: 10,
  })
  assert.deepEqual(mapped.performingStageIds, ['s1'])
  assert.deepEqual(mapped.performingStages, [{ id: 's1', bed: 'metal' }])
  assert.equal(mapped.vehicles?.[0]?.kind, 'bus')

  console.log('PASS festival audio: camera listener, sparse cues, looping music')
}

export async function testFestivalAudioAssets(): Promise<void> {
  assert.equal(AUDIO_ASSETS.crowdPath, 'sfx/ambient-crowd.ogg')
  assert.equal(AUDIO_ASSETS.concert, 'sfx/ambient-concert.ogg')
  assert.equal(AUDIO_ASSETS.musicRock, 'music/rock.ogg')
  assert.equal(AUDIO_ASSETS.musicTitle, 'music/title.ogg')
  assert.equal(AUDIO_ASSETS.uiClick, 'sfx/oneshot-ui-click.ogg')
  assert.equal(audioAssetPublicPath('cheer'), 'sfx/oneshot-cheer.ogg')
  assert.equal(audioAssetUrl('sfx/oneshot-place.wav'), '/sfx/oneshot-place.wav')
  assert.equal(audioAssetUrl('/sfx/oneshot-place.wav'), '/sfx/oneshot-place.wav')
  for (const [key, rel] of Object.entries(AUDIO_ASSETS)) {
    assert.match(rel, /^(sfx|music)\/[\w-]+\.ogg$/, `${key} must keep its public Ogg path`)
    assert.equal(existsSync(resolve(REPO_ROOT, 'public', rel)), true, `missing public/${rel}`)
  }

  const missing = await fetchAudioArrayBuffer('sfx/missing.wav', async () => new Response(null, { status: 404 }))
  assert.equal(missing, null, '404 keeps the synth fallback')
  const thrown = await fetchAudioArrayBuffer('sfx/oneshot-ui-click.wav', async () => {
    throw new Error('offline')
  })
  assert.equal(thrown, null, 'fetch errors keep the synth fallback')
  const empty = await fetchAudioArrayBuffer('sfx/oneshot-ui-click.wav', async () => new Response(new Uint8Array(), { status: 200 }))
  assert.equal(empty, null, 'empty bodies keep the synth fallback')
  const ok = await fetchAudioArrayBuffer('sfx/oneshot-ui-click.wav', async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
  assert.ok(ok)
  assert.equal(ok.byteLength, 3)

  console.log('PASS festival audio assets: paths, shipped CC0 files, loader fallback')
}
