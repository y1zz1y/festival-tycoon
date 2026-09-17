import {
  AUDIO_PLACEHOLDER_ASSETS,
  audioWorldFromSnapshot,
  createAudioPlannerState,
  listenerFromCamera,
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
}

/**
 * Camera-listener mixer. Plans come from sim ticks; panners follow the camera
 * each render frame. Placeholder synths are labeled for later WAV replacement.
 */
export class FestivalAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private muted = false
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
  }

  isMuted(): boolean {
    return this.muted
  }

  resume(): void {
    const context = this.ensureContext()
    if (context?.state === 'suspended') void context.resume()
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
      this.planner = { lastTick: world.simTick, lastWorld: world, lastCueTick: this.planner.lastCueTick }
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
    this.stopAll()
    void this.context?.close()
    this.context = null
    this.master = null
    this.oneShots = []
    this.ambients = []
    this.buffers.clear()
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context
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
    this.applyMasterGain()
    this.prepareBuffers(context)
    this.oneShots = Array.from({ length: AUDIO.maxOneShotVoices }, () => this.makeSlot(context))
    this.ambients = Array.from({ length: AUDIO.maxAmbientVoices }, () => this.makeSlot(context))
    return context
  }

  private applyMasterGain(): void {
    if (!this.master || !this.context) return
    this.master.gain.setTargetAtTime(this.muted ? 0 : AUDIO.masterGain, this.context.currentTime, 0.04)
  }

  private makeSlot(context: AudioContext): VoiceSlot {
    const gain = context.createGain()
    const panner = context.createPanner()
    panner.panningModel = 'equalpower'
    panner.distanceModel = 'inverse'
    panner.refDistance = AUDIO.refDistance
    panner.rolloffFactor = AUDIO.rolloff
    panner.maxDistance = AUDIO.maxDistance
    gain.gain.value = 0
    panner.connect(gain)
    gain.connect(this.master ?? context.destination)
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
  }

  private playCue(cue: AudioCue): void {
    const context = this.ensureContext()
    if (!context) return
    const slot = this.claimSlot(this.oneShots, cue.x, cue.z, cue.priority === 'ui' ? 100 : cue.priority === 'important' ? 80 : 50, cue.intensity)
    if (!slot) return
    this.startBuffer(slot, cue.kind, cue.x, cue.z, cue.intensity, false, cue.id)
  }

  private applyAmbients(emitters: AudioEmitter[]): void {
    const context = this.ensureContext()
    if (!context) return
    const next = new Map(emitters.map((emitter) => [emitter.id, emitter]))
    for (const slot of this.ambients) {
      if (slot.playing && !next.has(slot.id)) this.stopSlot(slot, 0.18)
    }
    for (const emitter of emitters) {
      const existing = this.ambients.find((slot) => slot.playing && slot.id === emitter.id)
      if (existing) {
        existing.intensity = emitter.intensity
        this.moveSlot(existing, emitter.x, emitter.z)
        continue
      }
      const slot = this.claimSlot(
        this.ambients,
        emitter.x,
        emitter.z,
        emitter.priority === 'local' ? 50 : 20,
        emitter.intensity,
      )
      if (!slot) continue
      this.startBuffer(slot, emitter.zone, emitter.x, emitter.z, emitter.intensity * 0.45, true, emitter.id)
    }
    this.currentAmbients = next
  }

  private updateAmbientGains(): void {
    for (const slot of this.ambients) {
      if (!slot.playing) continue
      const emitter = this.currentAmbients.get(slot.id)
      if (!emitter || !this.context) continue
      slot.gain.gain.setTargetAtTime(Math.max(0.02, emitter.intensity * 0.45), this.context.currentTime, 0.12)
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
    key: AudioOneShotKind | AudioZone,
    x: number,
    z: number,
    intensity: number,
    loop: boolean,
    id: string,
  ): void {
    const context = this.context
    const buffer = this.buffers.get(key)
    if (!context || !buffer) return
    this.stopSlot(slot, 0)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = loop
    source.connect(slot.panner)
    slot.source = source
    slot.playing = true
    slot.id = id
    slot.intensity = intensity
    slot.priorityWeight = loop ? 20 : 50
    this.moveSlot(slot, x, z)
    slot.gain.gain.cancelScheduledValues(context.currentTime)
    slot.gain.gain.setValueAtTime(0.0001, context.currentTime)
    slot.gain.gain.exponentialRampToValueAtTime(Math.max(0.02, intensity), context.currentTime + 0.03)
    source.onended = () => {
      if (slot.source === source) {
        slot.playing = false
        slot.source = null
        slot.id = ''
      }
    }
    source.start()
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
  }

  private stopAll(): void {
    for (const slot of [...this.oneShots, ...this.ambients]) this.stopSlot(slot, 0.05)
    this.currentAmbients.clear()
  }
}

function setListenerParam(param: AudioParam | undefined, value: number, time: number): void {
  if (!param) return
  param.setTargetAtTime(value, time, 0.03)
}

export { AUDIO_PLACEHOLDER_ASSETS }
