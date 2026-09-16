import { BANDS } from './festivalManagement'
import { bandGenre, type MusicGenre } from './musicTaste'

export type BandRole = 'singer' | 'guitar' | 'drums' | 'keys' | 'brass' | 'dj'

export type BandAccessory =
  | 'hat'
  | 'cap'
  | 'fedora'
  | 'headphones'
  | 'bandana'
  | 'spikes'
  | 'none'

export type BandLook = {
  costumeId: string
  genre: MusicGenre
  shirt: number
  accent: number
  pants: number
  hair: number
  skin: number
  accessory: BandAccessory
  silhouette: 'standard' | 'wide' | 'slim'
}

const GENRE_LOOKS: Record<
  MusicGenre,
  Omit<BandLook, 'costumeId' | 'genre' | 'accent'>
> = {
  folk: {
    shirt: 0xc4a06a,
    pants: 0x3d3428,
    hair: 0x5a3a22,
    skin: 0xe4b38a,
    accessory: 'hat',
    silhouette: 'standard',
  },
  indie: {
    shirt: 0x6a8a54,
    pants: 0x3a4034,
    hair: 0x3a3028,
    skin: 0xe4b38a,
    accessory: 'cap',
    silhouette: 'slim',
  },
  rock: {
    shirt: 0x3a3a48,
    pants: 0x1c1c22,
    hair: 0x1a1410,
    skin: 0xb67b58,
    accessory: 'bandana',
    silhouette: 'wide',
  },
  metal: {
    shirt: 0x1a1a1e,
    pants: 0x111114,
    hair: 0x1a1a1e,
    skin: 0xb67b58,
    accessory: 'spikes',
    silhouette: 'wide',
  },
  electro: {
    shirt: 0x2a1a4a,
    pants: 0x1a1228,
    hair: 0x2a2038,
    skin: 0xe4b38a,
    accessory: 'headphones',
    silhouette: 'slim',
  },
  dance: {
    shirt: 0x5a1a6c,
    pants: 0x221428,
    hair: 0x3a2048,
    skin: 0xe4b38a,
    accessory: 'cap',
    silhouette: 'standard',
  },
  pop: {
    shirt: 0xe080a8,
    pants: 0x3a2840,
    hair: 0x6a3048,
    skin: 0xe4b38a,
    accessory: 'none',
    silhouette: 'slim',
  },
  soul: {
    shirt: 0x8a3048,
    pants: 0x2a1820,
    hair: 0x2a1814,
    skin: 0xb67b58,
    accessory: 'fedora',
    silhouette: 'standard',
  },
}

/** Per-act accent so two bands of the same genre do not share a silhouette colour. */
const BAND_ACCENTS: Record<string, number> = {
  meadow: 0x88aa66,
  lantern: 0xd4a040,
  paper: 0xa0c8d4,
  aurora: 0x70e0d8,
  brass: 0xd6ad47,
  sugar: 0xf090b0,
  firefly: 0xf0c040,
  confetti: 0xff6a8a,
  campfire: 0xb98048,
  cedar: 0x6a8a48,
  harbor: 0x4a7a8a,
  velvet: 0x7a2850,
  amber: 0xd4783a,
  lowtide: 0x3a6a7a,
  neon: 0x39f0d0,
  voltage: 0x80ff40,
  synth: 0xc060ff,
  static: 0x8a8a9a,
  rivet: 0xc45c4a,
  wildcard: 0xe8b020,
  orbit: 0x4060ff,
  glitter: 0xffd0e0,
  discoball: 0x40d0ff,
  iron: 0x6a6a72,
  anvil: 0x8a2a2a,
  thunder: 0x4a4a58,
}

export function bandCostumeId(bandId: string): string {
  return `${bandGenre(bandId)}:${bandId}`
}

export function bandLook(bandId: string): BandLook {
  const genre = bandGenre(bandId)
  const base = GENRE_LOOKS[genre]
  return {
    ...base,
    accent: BAND_ACCENTS[bandId] ?? base.shirt,
    costumeId: bandCostumeId(bandId),
    genre,
  }
}

export function isDjAct(bandId: string): boolean {
  return BANDS.find((band) => band.id === bandId)?.genre === 'Electro'
}

export function bandRoles(bandId: string): BandRole[] {
  if (isDjAct(bandId)) return ['dj']
  if (bandId === 'orbit') return ['keys', 'keys']
  if (bandId === 'brass') return ['singer', 'brass', 'brass', 'drums']
  if (bandId === 'campfire') return ['singer', 'guitar', 'guitar']
  if (bandId === 'velvet') return ['singer', 'keys', 'guitar', 'drums']
  return ['singer', 'guitar', 'guitar', 'drums']
}

export function memberShirtColor(bandId: string, memberIndex: number): number {
  const look = bandLook(bandId)
  return memberIndex % 2 === 0 ? look.shirt : look.accent
}
