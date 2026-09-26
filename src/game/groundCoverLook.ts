import type { GameSnapshot } from './types/snapshot'
import { GROUND_COVER_IDS, type GroundCover, groundInfo, groundKey, isGroundCover } from './ground'

/** Painted cover, or the environment substrate mapped to a terrain look. */
export type CoverLook = GroundCover | 'clay' | 'gravel' | 'paved'

const SUBSTRATE_LOOK: Record<ReturnType<typeof groundInfo>['type'], CoverLook> = {
  grass: 'grass',
  sand: 'sand',
  field: 'field',
  clay: 'clay',
  gravel: 'gravel',
  urban: 'paved',
}

/** Dust / film mixed into shared instance colors. Grass stays the default object look. */
export const COVER_WEATHERING: Record<GroundCover, { tint: number; mix: number }> = {
  grass: { tint: 0x7d9d59, mix: 0 },
  sand: { tint: 0xd5bc85, mix: 0.22 },
  stone: { tint: 0x9a9a94, mix: 0.12 },
  field: { tint: 0x99915e, mix: 0.16 },
  snow: { tint: 0xe8eef2, mix: 0.32 },
  rock: { tint: 0x6b6358, mix: 0.12 },
  earth: { tint: 0x6b4a2e, mix: 0.18 },
  salt: { tint: 0xe4ddd0, mix: 0.24 },
  asphalt: { tint: 0x4a4e54, mix: 0.1 },
}

export function paintedCoverAt(s: Readonly<GameSnapshot>, x: number, z: number): GroundCover | undefined {
  const stored = s.festival.infrastructure?.ground[groundKey(x, z)]?.cover
  return stored && isGroundCover(stored) ? stored : undefined
}

/** Overlay tiles follow painted cover, otherwise the natural substrate (legacy saves). */
export function overlayCoverAt(s: Readonly<GameSnapshot>, x: number, z: number): CoverLook {
  return paintedCoverAt(s, x, z) ?? SUBSTRATE_LOOK[groundInfo(s, x, z).type]
}

export function majorityPaintedCover(
  s: Readonly<GameSnapshot>,
  cells: ReadonlyArray<{ x: number; z: number }>,
): GroundCover | undefined {
  const counts = new Map<GroundCover, number>()
  for (const cell of cells) {
    const cover = paintedCoverAt(s, cell.x, cell.z)
    if (!cover) continue
    counts.set(cover, (counts.get(cover) ?? 0) + 1)
  }
  let best: GroundCover | undefined
  let n = 0
  for (const id of GROUND_COVER_IDS) {
    const count = counts.get(id) ?? 0
    if (count > n) {
      best = id
      n = count
    }
  }
  return best
}

export function majorityOverlayCover(
  s: Readonly<GameSnapshot>,
  cells: ReadonlyArray<{ x: number; z: number }>,
): CoverLook {
  if (!cells.length) return 'grass'
  const counts = new Map<CoverLook, number>()
  for (const cell of cells) {
    const look = overlayCoverAt(s, cell.x, cell.z)
    counts.set(look, (counts.get(look) ?? 0) + 1)
  }
  let best: CoverLook = overlayCoverAt(s, cells[0]!.x, cells[0]!.z)
  let n = 0
  for (const [look, count] of counts) {
    if (count > n || (count === n && look < best)) {
      best = look
      n = count
    }
  }
  return best
}

/** Instance-color multiplier: white when there is no film. */
export function weatheringRgb(cover: GroundCover): { r: number; g: number; b: number } {
  const spec = COVER_WEATHERING[cover]
  const r = ((spec.tint >> 16) & 255) / 255
  const g = ((spec.tint >> 8) & 255) / 255
  const b = (spec.tint & 255) / 255
  return {
    r: 1 - spec.mix + r * spec.mix,
    g: 1 - spec.mix + g * spec.mix,
    b: 1 - spec.mix + b * spec.mix,
  }
}
