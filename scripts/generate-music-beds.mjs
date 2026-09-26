import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SR = 22050
const SECONDS = 8
const N = SR * SECONDS
const TWO_PI = Math.PI * 2

function midi(note) {
  return 440 * 2 ** ((note - 69) / 12)
}

function frac(value) {
  return value - Math.floor(value)
}

function sine(freq, time) {
  return Math.sin(TWO_PI * freq * time)
}

function saw(freq, time) {
  return frac(freq * time) * 2 - 1
}

function square(freq, time) {
  return sine(freq, time) >= 0 ? 1 : -1
}

function noise(time, seed) {
  const x = Math.sin((time + seed) * 43758.5453) * 10000
  return x - Math.floor(x) - 0.5
}

function env(time, attack, decay, sustain, release, duration) {
  if (time < 0 || time > duration) return 0
  if (time < attack) return time / Math.max(0.0001, attack)
  if (time < attack + decay) return 1 - (1 - sustain) * ((time - attack) / Math.max(0.0001, decay))
  if (time < duration - release) return sustain
  return sustain * Math.max(0, (duration - time) / Math.max(0.0001, release))
}

function kick(time) {
  if (time < 0 || time > 0.2) return 0
  return sine(90 * Math.exp(-time * 16), time) * Math.exp(-time * 12)
}

function hat(time) {
  if (time < 0 || time > 0.08) return 0
  return noise(time, 3) * Math.exp(-time * 48)
}

function clap(time) {
  if (time < 0 || time > 0.12) return 0
  return (noise(time, 7) + noise(time * 1.7, 11) * 0.4) * Math.exp(-time * 28)
}

function pluck(freq, time, duration) {
  return sine(freq, time) * env(time, 0.006, 0.08, 0.22, 0.18, duration) * 0.55
    + sine(freq * 2, time) * env(time, 0.004, 0.05, 0.08, 0.12, duration) * 0.18
}

function writeWav(path, samples) {
  const bytes = Buffer.alloc(44 + samples.length * 2)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(36 + samples.length * 2, 4)
  bytes.write('WAVE', 8)
  bytes.write('fmt ', 12)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(SR, 24)
  bytes.writeUInt32LE(SR * 2, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(samples.length * 2, 40)
  for (let i = 0; i < samples.length; i++) {
    const clipped = Math.max(-1, Math.min(1, samples[i] ?? 0))
    bytes.writeInt16LE((clipped * 32767) | 0, 44 + i * 2)
  }
  writeFileSync(path, bytes)
}

function crossfadeLoop(samples, fade = 360) {
  for (let i = 0; i < fade; i++) {
    const mix = i / fade
    const start = samples[i] ?? 0
    const end = samples[samples.length - fade + i] ?? 0
    const blended = start * mix + end * (1 - mix)
    samples[i] = blended
    samples[samples.length - fade + i] = blended
  }
  return samples
}

function render(fill) {
  const samples = new Float64Array(N)
  for (let i = 0; i < N; i++) samples[i] = fill(i / SR, i)
  let peak = 0.0001
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
  const scale = 0.72 / peak
  for (let i = 0; i < N; i++) samples[i] *= scale
  return crossfadeLoop(samples)
}

function acoustic(time) {
  const beat = time % 2
  const notes = [60, 64, 67, 72, 67, 64, 62, 67]
  const step = Math.floor((time * 2) % notes.length)
  const local = (time * 2) % 1
  const pad = sine(midi(48), time) * 0.11 + sine(midi(55), time) * 0.08 + sine(midi(60) + 0.4, time) * 0.04
  const melody = pluck(midi(notes[step] ?? 60), local / 2, 0.48)
  const bass = sine(midi([36, 36, 43, 41][Math.floor(time / 2) % 4] ?? 36), time) * (0.08 + 0.04 * Math.sin(TWO_PI * 0.5 * time))
  return pad + melody + bass + hat(beat % 0.5) * 0.04
}

function rock(time) {
  const bar = Math.floor(time / 2) % 4
  const roots = [45, 48, 43, 45]
  const root = midi(roots[bar] ?? 45)
  const grit = (square(root, time) + saw(root * 1.5, time) * 0.7) * 0.09
  const palm = sine(root / 2, time) * 0.1
  const localBeat = time % 0.5
  const beat = kick(localBeat) * (Math.floor(time * 2) % 2 === 0 ? 1 : 0.55)
  const snare = clap((time % 1) - 0.5) * 0.35
  return grit + palm + beat * 0.55 + snare
}

function electronic(time) {
  const kickHit = kick(time % 0.5) * 0.7
  const bass = sine(midi(36), time) * Math.max(0, 1 - (time % 0.5) * 2.4) * 0.22
  const stab = saw(midi([60, 63, 67, 70][Math.floor(time * 2) % 4] ?? 60), time)
    * env(time % 0.5, 0.01, 0.08, 0.15, 0.12, 0.48)
    * 0.08
  const hats = hat(time % 0.25) * (Math.floor(time * 4) % 2 === 0 ? 0.08 : 0.16)
  const pad = sine(midi(72), time) * 0.03 * (0.5 + 0.5 * Math.sin(TWO_PI * 0.25 * time))
  return kickHit + bass + stab + hats + pad
}

function pop(time) {
  const prog = [48, 43, 45, 41][Math.floor(time / 2) % 4] ?? 48
  const arpNotes = [0, 4, 7, 12]
  const step = Math.floor(time * 4) % 4
  const local = (time * 4) % 1
  const arp = sine(midi(prog + 12 + (arpNotes[step] ?? 0)), time) * env(local / 4, 0.01, 0.06, 0.2, 0.08, 0.24) * 0.2
  const bass = sine(midi(prog - 12), time) * 0.1
  const backbeat = clap((time % 1) - 0.5) * 0.28
  const sparkle = sine(midi(prog + 24), time) * 0.03 * Math.sin(TWO_PI * 2 * time)
  return arp + bass + backbeat + sparkle + kick(time % 0.5) * 0.22
}

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sfx')
writeWav(resolve(outDir, 'music-acoustic.wav'), render(acoustic))
writeWav(resolve(outDir, 'music-rock.wav'), render(rock))
writeWav(resolve(outDir, 'music-electronic.wav'), render(electronic))
writeWav(resolve(outDir, 'music-pop.wav'), render(pop))
console.log('wrote 4 CC0 festival music beds to public/sfx/')
