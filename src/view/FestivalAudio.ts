import {
  AUDIO_ASSETS,
  audioWorldFromSnapshot,
  createAudioPlannerState,
  listenerFromCamera,
  MUSIC_BUFFER_KEYS,
  planFestivalAudio,
  type AudioCue,
  type AudioEmitter,
  type AudioListenerPose,
  type AudioOneShotKind,
  type AudioPlannerState,
  type AudioWorld,
  type AudioZone,
} from '../game/audio'
import { SIMULATION_CONFIG } from '../game/simulationConfig'
import type { VolumeChannel } from '../app/playerSettings'
import { loadFestivalAudioBuffer } from './audioAssets'

type Bus = Exclude<VolumeChannel, 'master'>

/** Where in a loop a stage starts, so two stages with the same genre do not play in unison. */
function loopOffset(id: string, duration: number): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return ((hash % 1000) / 1000) * duration
}

const AUDIO = SIMULATION_CONFIG.audio

type VoiceSlot = {
  gain: GainNode
  panner: PannerNode
  source: AudioBufferSourceNode | OscillatorNode | null
  playing: boolean
  x: number
  z: number
  priorityWeight: number
  intensity: number
  id: string
  /** Buffer key playing, so a stage whose band changes genre restarts with the new loop. */
  key: string
}

/**
 * Camera-listener mixer. Plans come from sim ticks; panners follow the camera
 * each render frame. CC0 files load via fetch/decode; synths stand in until then.
 * Voices run through three channels under the master (music, effects, ambient)
 * that the player's mixer sets; the title theme plays on the music channel.
 */
export class FestivalAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private buses: Partial<Record<Bus, GainNode>> = {}
  private volume: Record<VolumeChannel, number> = { master: 1, music: 1, effects: 1, ambient: 1 }
  private title: { wanted: boolean; source: AudioBufferSourceNode | null; gain: GainNode | null } = { wanted: false, source: null, gain: null }
  private muted = false
  private disposed = false
  private planner: AudioPlannerState = createAudioPlannerState()
  private listener: AudioListenerPose = listenerFromCamera(
    { x: 0, y: 20, z: 24 },
    { x: 0, y: 0, z: 0 },
  )
  private oneShots: VoiceSlot[] = []
  private ambients: VoiceSlot[] = []
  private buffers = new Map<string, AudioBuffer>()
  private lastPlanTick = -1
  private lastUiTick = -Number.POSITIVE_INFINITY
  private currentAmbients = new Map<string, AudioEmitter>()

  setMuted(muted: boolean): void {
    this.muted = muted
    this.applyMasterGain()
    if (muted) this.stopAll()
    else this.syncTitle()
  }

  /** The player's mixer: each channel 0 to 1, applied with a short glide. */
  setVolumes(volume: Readonly<Record<VolumeChannel, number>>): void {
    this.volume = { ...volume }
    this.applyMasterGain()
    const context = this.context
    if (!context) return
    for (const [channel, bus] of Object.entries(this.buses) as [Bus, GainNode][]) {
      bus.gain.setTargetAtTime(this.volume[channel], context.currentTime, 0.04)
    }
  }

  /** Title theme on or off; remembered until the audio context exists. */
  setTitleMusic(active: boolean): void {
    this.title.wanted = active
    this.syncTitle()
  }

  isMuted(): boolean {
    return this.muted
  }

  resume(): void {
    const context = this.ensureContext()
    if (context?.state === 'suspended') void context.resume()
    this.syncTitle()
  }

  updateListener(pose: AudioListenerPose): void {
    this.listener = pose
    const context = this.context
    if (!context) return
    const listener = context.listener
    const now = context.currentTime
    setListenerParam(listener.positionX, pose.x, now)
    setListenerParam(listener.positionY, pose.y, now)
    setListenerParam(listener.positionZ, pose.z, now)
    setListenerParam(listener.forwardX, pose.forwardX, now)
    setListenerParam(listener.forwardY, pose.forwardY, now)
    setListenerParam(listener.forwardZ, pose.forwardZ, now)
    setListenerParam(listener.upX, pose.upX, now)
    setListenerParam(listener.upY, pose.upY, now)
    setListenerParam(listener.upZ, pose.upZ, now)
    this.repositionVoices(this.oneShots)
    this.repositionVoices(this.ambients)
  }

  syncSnapshot(snapshot: Parameters<typeof audioWorldFromSnapshot>[0]): void {
    this.syncWorld(audioWorldFromSnapshot(snapshot))
  }

  syncWorld(world: AudioWorld): void {
    if (this.muted) {
      this.planner = {
        lastTick: world.simTick,
        lastWorld: world,
        lastCueTick: this.planner.lastCueTick,
        activeMusicIds: this.planner.activeMusicIds,
      }
      this.lastPlanTick = world.simTick
      return
    }
    if (world.simTick === this.lastPlanTick && this.planner.lastWorld) {
      this.updateAmbientGains()
      return
    }
    const { plan, state } = planFestivalAudio(world, this.listener, this.planner)
    this.planner = state
    this.lastPlanTick = world.simTick
    this.applyAmbients(plan.ambients)
    for (const cue of plan.oneShots) this.playCue(cue)
  }

  playUiClick(simTick = this.lastPlanTick): void {
    if (this.muted) return
    if (simTick - this.lastUiTick < AUDIO.cooldownTicks.uiClick) return
    this.lastUiTick = simTick
    this.resume()
    this.playCue({
      id: `ui:${simTick}`,
      kind: 'uiClick',
      x: this.listener.x,
      z: this.listener.z,
      priority: 'ui',
      intensity: 0.45,
      tick: simTick,
    })
  }

  activeOneShotCount(): number {
    return this.oneShots.filter((slot) => slot.playing).length
  }

  activeAmbientCount(): number {
    return this.ambients.filter((slot) => slot.playing).length
  }

  dispose(): void {
    this.disposed = true
    this.stopAll()
    void this.context?.close()
    this.context = null
    this.master = null
    this.buses = {}
    this.title = { wanted: this.title.wanted, source: null, gain: null }
    this.oneShots = []
    this.ambients = []
    this.buffers.clear()
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context
    this.disposed = false
    const Ctor =
      typeof globalThis !== 'undefined'
        ? (globalThis.AudioContext ??
          (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined
    if (!Ctor) return null
    const context = new Ctor()
    this.context = context
    this.master = context.createGain()
    this.master.connect(context.destination)
    for (const channel of ['music', 'effects', 'ambient'] as const) {
      const bus = context.createGain()
      bus.gain.value = this.volume[channel]
      bus.connect(this.master)
      this.buses[channel] = bus
    }
    this.applyMasterGain()
    this.prepareBuffers(context)
    this.loadRealAssets(context)
    this.oneShots = Array.from({ length: AUDIO.maxOneShotVoices }, () => this.makeSlot(context, 'effects'))
    this.ambients = Array.from({ length: AUDIO.maxAmbientVoices }, () => this.makeSlot(context, 'ambient'))
    return context
  }

  private applyMasterGain(): void {
    if (!this.master || !this.context) return
    this.master.gain.setTargetAtTime(this.muted ? 0 : AUDIO.masterGain * this.volume.master, this.context.currentTime, 0.04)
  }

  private makeSlot(context: AudioContext, bus: Bus): VoiceSlot {
    const gain = context.createGain()
    const panner = context.createPanner()
    panner.panningModel = 'equalpower'
    panner.distanceModel = 'inverse'
    panner.refDistance = AUDIO.refDistance
    panner.rolloffFactor = AUDIO.rolloff
    panner.maxDistance = AUDIO.maxDistance
    gain.gain.value = 0
    panner.connect(gain)
    gain.connect(this.buses[bus] ?? this.master ?? context.destination)
    return {
      gain,
      panner,
      source: null,
      playing: false,
      x: 0,
      z: 0,
      priorityWeight: 0,
      intensity: 0,
      id: '',
      key: '',
    }
  }

  private prepareBuffers(context: AudioContext): void {
    const sampleRate = context.sampleRate
    const make = (seconds: number, fill: (index: number, time: number) => number) => {
      const length = Math.max(1, Math.floor(seconds * sampleRate))
      const buffer = context.createBuffer(1, length, sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < length; i++) data[i] = fill(i, i / sampleRate)
      return buffer
    }
    const noise = (time: number, seed: number) => {
      const x = Math.sin((time + seed) * 43758.5453) * 10000
      return x - Math.floor(x) - 0.5
    }
    this.buffers.set(
      'placeBuilding',
      make(0.09, (_i, t) => Math.sin(2 * Math.PI * 820 * t) * Math.exp(-t * 28)),
    )
    this.buffers.set(
      'demolish',
      make(0.16, (_i, t) => (noise(t, 2) * 0.7 + Math.sin(2 * Math.PI * 90 * t) * 0.5) * Math.exp(-t * 14)),
    )
    this.buffers.set(
      'coasterLaunch',
      make(0.42, (_i, t) => Math.sin(2 * Math.PI * (90 + t * 260) * t) * Math.exp(-t * 3.2)),
    )
    this.buffers.set(
      'cheer',
      make(0.28, (_i, t) => (noise(t, 4) * 0.55 + Math.sin(2 * Math.PI * 380 * t) * 0.35) * Math.exp(-t * 7)),
    )
    this.buffers.set(
      'scream',
      make(0.32, (_i, t) => {
        const band = noise(t, 7) * Math.sin(2 * Math.PI * 1400 * t)
        return band * Math.exp(-t * 6)
      }),
    )
    this.buffers.set(
      'medical',
      make(0.55, (_i, t) => {
        const freq = t % 0.28 < 0.14 ? 620 : 820
        return Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 2.4)
      }),
    )
    this.buffers.set(
      'busHiss',
      make(0.4, (_i, t) => noise(t, 11) * Math.exp(-t * 5) * 0.8),
    )
    this.buffers.set(
      'wasteTruck',
      make(0.36, (_i, t) => (Math.sin(2 * Math.PI * 70 * t) + noise(t, 13) * 0.4) * Math.exp(-t * 4)),
    )
    this.buffers.set(
      'incident',
      make(0.4, (_i, t) => (noise(t, 17) + Math.sin(2 * Math.PI * 210 * t) * 0.3) * Math.exp(-t * 5)),
    )
    this.buffers.set(
      'uiClick',
      make(0.04, (_i, t) => Math.sin(2 * Math.PI * 1240 * t) * Math.exp(-t * 60)),
    )
    this.buffers.set(
      'concert',
      make(1.6, (_i, t) => {
        const pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * 2.2 * t)
        return (Math.sin(2 * Math.PI * 110 * t) + Math.sin(2 * Math.PI * 165.4 * t)) * 0.12 * pulse
      }),
    )
    this.buffers.set(
      'coaster',
      make(1.4, (_i, t) => (noise(t, 19) * 0.35 + Math.sin(2 * Math.PI * 48 * t) * 0.2) * (0.55 + 0.45 * Math.sin(2 * Math.PI * 3 * t))),
    )
    this.buffers.set(
      'crowdPath',
      make(1.8, (_i, t) => noise(t, 23) * 0.22 * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.7 * t))),
    )
    this.buffers.set(
      'camp',
      make(2, (_i, t) => (noise(t, 29) * 0.12 + Math.sin(2 * Math.PI * 62 * t) * 0.04) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.35 * t))),
    )
    this.buffers.set(
      'water',
      make(2.2, (_i, t) => noise(t * 1.4, 31) * 0.18 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.45 * t))),
    )
    this.buffers.set(
      'backstage',
      make(1.5, (_i, t) => (Math.sin(2 * Math.PI * 55 * t) + noise(t, 37) * 0.2) * 0.1),
    )
    this.buffers.set(
      'woods',
      make(2.4, (_i, t) => noise(t * 2.1, 41) * 0.1 * (0.4 + 0.6 * Math.sin(2 * Math.PI * 0.2 * t))),
    )
    const pluck = (freq: number, t: number, every: number) => {
      const local = t % every
      return Math.sin(2 * Math.PI * freq * t) * Math.exp(-local * 7) * 0.16
    }
    // Storm sounds are synthesized only: a low rolling rumble with a crack at the front,
    // and a steady hiss of rain.
    this.buffers.set(
      'thunder',
      make(2.6, (_i, t) => (noise(t, 61) * (0.7 * Math.exp(-t * 9) + 0.5 * Math.exp(-t * 1.1)) + Math.sin(2 * Math.PI * 38 * t) * 0.35 * Math.exp(-t * 1.3)) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 1.7 * t))),
    )
    this.buffers.set(
      'rain',
      make(2.4, (_i, t) => noise(t * 3.1, 67) * 0.3 * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.5 * t))),
    )
    const sketches: Record<string, AudioBuffer> = {}
    sketches.acoustic = make(2, (_i, t) => pluck([262, 294, 330, 392][Math.floor(t * 2) % 4] ?? 262, t, 0.5) + Math.sin(2 * Math.PI * 131 * t) * 0.04)
    sketches.rock = make(2, (_i, t) => {
      const fifth = Math.sin(2 * Math.PI * 110 * t) + Math.sin(2 * Math.PI * 165 * t)
      const kick = Math.sin(2 * Math.PI * 70 * t) * Math.exp(-(t % 0.5) * 10)
      return fifth * 0.07 + kick * 0.1
    })
    sketches.electronic = make(2, (_i, t) => {
      const bass = Math.sin(2 * Math.PI * 55 * t) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 2 * t))
      const hat = noise(t, 53) * Math.exp(-(t % 0.25) * 40) * 0.12
      return bass * 0.1 + hat
    })
    sketches.pop = make(2, (_i, t) => {
      const arp = [262, 330, 392, 523][Math.floor(t * 4) % 4] ?? 262
      return Math.sin(2 * Math.PI * arp * t) * 0.1 * Math.exp(-(t % 0.25) * 8) + Math.sin(2 * Math.PI * 98 * t) * 0.05
    })
    const sketchOf: Record<string, string> = { musicFolk: 'acoustic', musicIndie: 'acoustic', musicSoul: 'acoustic', musicRock: 'rock', musicMetal: 'rock', musicElectro: 'electronic', musicDance: 'electronic', musicPop: 'pop' }
    for (const [key, sketch] of Object.entries(sketchOf)) this.buffers.set(key, sketches[sketch]!)
  }

  private loadRealAssets(context: AudioContext): void {
    for (const [key, path] of Object.entries(AUDIO_ASSETS)) {
      void this.replaceBufferFromFile(context, key, path)
    }
  }

  /** Starts or fades the title theme to match `title.wanted`, once its file is there. */
  private syncTitle(): void {
    const context = this.context
    if (!context) return
    const title = this.title
    const active = title.wanted && !this.muted
    if (!title.gain) {
      if (!active) return
      title.gain = context.createGain()
      title.gain.gain.value = 0
      title.gain.connect(this.buses.music ?? this.master ?? context.destination)
    }
    const now = context.currentTime
    title.gain.gain.cancelScheduledValues(now)
    title.gain.gain.setTargetAtTime(active ? 0.9 : 0, now, active ? 0.5 : 0.3)
    if (!active && title.source) {
      title.source.stop(now + 1.5)
      title.source = null
      return
    }
    const buffer = this.buffers.get('musicTitle')
    if (!active || title.source || !buffer) return
    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(title.gain)
    source.start()
    title.source = source
  }

  private async replaceBufferFromFile(
    context: AudioContext,
    key: string,
    path: string,
  ): Promise<void> {
    const buffer = await loadFestivalAudioBuffer(context, path)
    if (!buffer || this.disposed) return
    this.buffers.set(key, buffer)
    if (key === 'musicTitle') this.syncTitle()
  }

  private playCue(cue: AudioCue): void {
    const context = this.ensureContext()
    if (!context) return
    const slot = this.claimSlot(this.oneShots, cue.x, cue.z, cue.priority === 'ui' ? 100 : cue.priority === 'important' ? 80 : 50, cue.intensity)
    if (!slot) return
    this.startBuffer(slot, cue.kind, cue.x, cue.z, cue.intensity, false, cue.id, cue.priority === 'ui' ? 100 : cue.priority === 'important' ? 80 : 50)
  }

  private applyAmbients(emitters: AudioEmitter[]): void {
    const context = this.ensureContext()
    if (!context) return
    const next = new Map(emitters.map((emitter) => [emitter.id, emitter]))
    for (const slot of this.ambients) {
      if (slot.playing && !next.has(slot.id)) this.stopSlot(slot, slot.id.startsWith('music:') ? 0.55 : 0.18)
    }
    for (const emitter of emitters) {
      const key = emitter.zone === 'music' ? MUSIC_BUFFER_KEYS[emitter.bed ?? 'indie'] : emitter.zone
      const existing = this.ambients.find((slot) => slot.playing && slot.id === emitter.id && slot.key === key)
      if (existing) {
        existing.intensity = emitter.intensity
        this.moveSlot(existing, emitter.x, emitter.z)
        continue
      }
      const priorityWeight = emitter.priority === 'local' ? 50 : 20
      // A new band with another genre on the same stage: its slot restarts with the new loop.
      const changed = this.ambients.find((slot) => slot.playing && slot.id === emitter.id)
      const slot = changed ?? this.claimSlot(this.ambients, emitter.x, emitter.z, priorityWeight, emitter.intensity)
      if (!slot) continue
      const gain = emitter.zone === 'music' ? emitter.intensity * 0.68 : emitter.intensity * 0.45
      this.startBuffer(slot, key, emitter.x, emitter.z, gain, true, emitter.id, priorityWeight)
    }
    this.currentAmbients = next
  }

  private updateAmbientGains(): void {
    for (const slot of this.ambients) {
      if (!slot.playing) continue
      const emitter = this.currentAmbients.get(slot.id)
      if (!emitter || !this.context) continue
      const scale = emitter.zone === 'music' ? 0.68 : 0.45
      slot.gain.gain.setTargetAtTime(Math.max(0.02, emitter.intensity * scale), this.context.currentTime, emitter.zone === 'music' ? 0.22 : 0.12)
    }
  }

  private claimSlot(
    pool: VoiceSlot[],
    x: number,
    z: number,
    priorityWeight: number,
    intensity: number,
  ): VoiceSlot | null {
    const idle = pool.find((slot) => !slot.playing)
    if (idle) return idle
    let weakest: VoiceSlot | null = null
    let weakestScore = Number.POSITIVE_INFINITY
    for (const slot of pool) {
      const distance = Math.hypot(slot.x - this.listener.x, slot.z - this.listener.z)
      const score = slot.priorityWeight * 20 - distance + slot.intensity * 8
      if (score < weakestScore) {
        weakestScore = score
        weakest = slot
      }
    }
    const incomingDistance = Math.hypot(x - this.listener.x, z - this.listener.z)
    const incomingScore = priorityWeight * 20 - incomingDistance + intensity * 8
    if (!weakest || incomingScore <= weakestScore) return null
    this.stopSlot(weakest, 0.02)
    return weakest
  }

  private startBuffer(
    slot: VoiceSlot,
    key: AudioOneShotKind | AudioZone | keyof typeof AUDIO_ASSETS,
    x: number,
    z: number,
    intensity: number,
    loop: boolean,
    id: string,
    priorityWeight = loop ? 20 : 50,
  ): void {
    const context = this.context
    const buffer = this.buffers.get(key)
    if (!context || !buffer) return
    this.stopSlot(slot, 0)
    const music = id.startsWith('music:')
    // Ambient slots carry stage music too; route each voice to its mixer channel.
    if (this.ambients.includes(slot)) {
      slot.gain.disconnect()
      slot.gain.connect(this.buses[music ? 'music' : 'ambient'] ?? this.master ?? context.destination)
    }
    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = loop
    source.connect(slot.panner)
    slot.source = source
    slot.playing = true
    slot.id = id
    slot.key = key
    slot.intensity = intensity
    slot.priorityWeight = priorityWeight
    this.moveSlot(slot, x, z)
    slot.gain.gain.cancelScheduledValues(context.currentTime)
    slot.gain.gain.setValueAtTime(0.0001, context.currentTime)
    const attack = loop && id.startsWith('music:') ? 0.4 : 0.03
    slot.gain.gain.exponentialRampToValueAtTime(Math.max(0.02, intensity), context.currentTime + attack)
    source.onended = () => {
      if (slot.source === source) {
        slot.playing = false
        slot.source = null
        slot.id = ''
      }
    }
    source.start(context.currentTime, music ? loopOffset(id, buffer.duration) : 0)
  }

  private moveSlot(slot: VoiceSlot, x: number, z: number): void {
    slot.x = x
    slot.z = z
    const now = this.context?.currentTime ?? 0
    setListenerParam(slot.panner.positionX, x, now)
    setListenerParam(slot.panner.positionY, 0.4, now)
    setListenerParam(slot.panner.positionZ, z, now)
  }

  private repositionVoices(pool: VoiceSlot[]): void {
    for (const slot of pool) {
      if (slot.playing) this.moveSlot(slot, slot.x, slot.z)
    }
  }

  private stopSlot(slot: VoiceSlot, fade: number): void {
    if (!slot.source) {
      slot.playing = false
      return
    }
    const context = this.context
    if (context && fade > 0) {
      slot.gain.gain.cancelScheduledValues(context.currentTime)
      slot.gain.gain.setTargetAtTime(0.0001, context.currentTime, fade)
    } else {
      slot.gain.gain.value = 0
    }
    try {
      slot.source.stop()
    } catch {
      /* already stopped */
    }
    slot.source.disconnect()
    slot.source = null
    slot.playing = false
    slot.id = ''
    slot.key = ''
  }

  private stopAll(): void {
    for (const slot of [...this.oneShots, ...this.ambients]) this.stopSlot(slot, 0.05)
    this.currentAmbients.clear()
    const title = this.title
    if (title.source) {
      title.source.stop()
      title.source.disconnect()
      title.source = null
    }
    if (title.gain) title.gain.gain.value = 0
  }
}

function setListenerParam(param: AudioParam | undefined, value: number, time: number): void {
  if (!param) return
  param.setTargetAtTime(value, time, 0.03)
}

