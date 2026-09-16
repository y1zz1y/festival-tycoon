import { Group, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { computeTrackFrame, type CoasterTrackStyleId, type TrackPieceKind, type TrackPoint } from '../game/coasters'
import { ModelKit } from './retroBuildings'

export type CoasterTrackStyle = {
  id: CoasterTrackStyleId
  rail: number
  railWidth: number
  railHeight: number
  railGap: number
  tie: number
  tieWidth: number
  tieHeight: number
  tieDepth: number
  spine?: number
  spineWidth?: number
  spineHeight?: number
  support: number
  supportRadius: number
  hang: number
  trough?: boolean
}

export const COASTER_TRACK_STYLES: Record<CoasterTrackStyleId, CoasterTrackStyle> = {
  steelLattice: {
    id: 'steelLattice',
    rail: 0xf2d35c,
    railWidth: 0.046,
    railHeight: 0.04,
    railGap: 0.3,
    tie: 0xd53945,
    tieWidth: 0.4,
    tieHeight: 0.03,
    tieDepth: 0.05,
    support: 0xb8c0c4,
    supportRadius: 0.038,
    hang: 0,
  },
  wooden: {
    id: 'wooden',
    rail: 0xd4a574,
    railWidth: 0.055,
    railHeight: 0.05,
    railGap: 0.34,
    tie: 0x6b4423,
    tieWidth: 0.48,
    tieHeight: 0.055,
    tieDepth: 0.09,
    support: 0x8b5a2b,
    supportRadius: 0.055,
    hang: 0,
  },
  boxSpine: {
    id: 'boxSpine',
    rail: 0xc4b5fd,
    railWidth: 0.04,
    railHeight: 0.038,
    railGap: 0.32,
    tie: 0x4c1d95,
    tieWidth: 0.36,
    tieHeight: 0.028,
    tieDepth: 0.04,
    spine: 0x2e1065,
    spineWidth: 0.11,
    spineHeight: 0.09,
    support: 0x5b21b6,
    supportRadius: 0.045,
    hang: 0,
  },
  invertedBox: {
    id: 'invertedBox',
    rail: 0x94a3b8,
    railWidth: 0.04,
    railHeight: 0.038,
    railGap: 0.28,
    tie: 0x334155,
    tieWidth: 0.34,
    tieHeight: 0.03,
    tieDepth: 0.04,
    spine: 0x1f2937,
    spineWidth: 0.12,
    spineHeight: 0.1,
    support: 0x475569,
    supportRadius: 0.042,
    hang: 0.12,
  },
  flyingSpine: {
    id: 'flyingSpine',
    rail: 0xc7d2fe,
    railWidth: 0.038,
    railHeight: 0.036,
    railGap: 0.3,
    tie: 0x4338ca,
    tieWidth: 0.34,
    tieHeight: 0.026,
    tieDepth: 0.038,
    spine: 0x312e81,
    spineWidth: 0.1,
    spineHeight: 0.08,
    support: 0x4f46e5,
    supportRadius: 0.04,
    hang: 0.08,
  },
  juniorTubular: {
    id: 'juniorTubular',
    rail: 0x86efac,
    railWidth: 0.05,
    railHeight: 0.05,
    railGap: 0.24,
    tie: 0x22c55e,
    tieWidth: 0.32,
    tieHeight: 0.03,
    tieDepth: 0.045,
    support: 0x166534,
    supportRadius: 0.032,
    hang: 0,
  },
  wildMouse: {
    id: 'wildMouse',
    rail: 0xfde68a,
    railWidth: 0.028,
    railHeight: 0.026,
    railGap: 0.18,
    tie: 0xa16207,
    tieWidth: 0.24,
    tieHeight: 0.022,
    tieDepth: 0.03,
    support: 0x78716c,
    supportRadius: 0.024,
    hang: 0,
  },
  woodenMouse: {
    id: 'woodenMouse',
    rail: 0xfbbf24,
    railWidth: 0.03,
    railHeight: 0.028,
    railGap: 0.18,
    tie: 0x78350f,
    tieWidth: 0.26,
    tieHeight: 0.03,
    tieDepth: 0.04,
    support: 0x92400e,
    supportRadius: 0.028,
    hang: 0,
  },
  bobsledTrough: {
    id: 'bobsledTrough',
    rail: 0x93c5fd,
    railWidth: 0.06,
    railHeight: 0.12,
    railGap: 0.36,
    tie: 0x1e3a8a,
    tieWidth: 0.42,
    tieHeight: 0.04,
    tieDepth: 0.08,
    support: 0x1d4ed8,
    supportRadius: 0.04,
    hang: 0,
    trough: true,
  },
  suspendedSpine: {
    id: 'suspendedSpine',
    rail: 0xa3e635,
    railWidth: 0.036,
    railHeight: 0.034,
    railGap: 0.26,
    tie: 0x365314,
    tieWidth: 0.3,
    tieHeight: 0.024,
    tieDepth: 0.036,
    spine: 0x3f6212,
    spineWidth: 0.09,
    spineHeight: 0.08,
    support: 0x4d7c0f,
    supportRadius: 0.038,
    hang: 0.14,
  },
  gigaLattice: {
    id: 'gigaLattice',
    rail: 0xe0f2fe,
    railWidth: 0.048,
    railHeight: 0.042,
    railGap: 0.34,
    tie: 0x0c4a6e,
    tieWidth: 0.42,
    tieHeight: 0.032,
    tieDepth: 0.048,
    spine: 0x0369a1,
    spineWidth: 0.07,
    spineHeight: 0.07,
    support: 0x075985,
    supportRadius: 0.05,
    hang: 0,
  },
  launchedSteel: {
    id: 'launchedSteel',
    rail: 0xfed7aa,
    railWidth: 0.046,
    railHeight: 0.04,
    railGap: 0.3,
    tie: 0x7c2d12,
    tieWidth: 0.38,
    tieHeight: 0.03,
    tieDepth: 0.046,
    support: 0x9a3412,
    supportRadius: 0.04,
    hang: 0,
  },
}

const trackMaterial = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.48,
  metalness: 0.28,
})
trackMaterial.userData.shared = true

type TrackFrame = { right: { x: number; y: number; z: number }; up: { x: number; y: number; z: number } }

const worldCenter = (point: TrackPoint): Vector3 =>
  new Vector3(point.x + 0.5, point.y + 0.24, point.z + 0.5)

function segmentRotation(forward: Vector3, frame: TrackFrame): Quaternion {
  const f = forward.clone().normalize()
  const right = new Vector3(frame.right.x, frame.right.y, frame.right.z)
  const up = new Vector3().crossVectors(f, right)
  if (up.lengthSq() < 1e-10) {
    up.set(frame.up.x, frame.up.y, frame.up.z)
  }
  up.normalize()
  right.crossVectors(up, f).normalize()
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right, up, f))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * One merged vertex-color mesh per piece. Rails are segment boxes that follow
 * the discrete sample polyline (heading / pitch / bank), not skipped every-other
 * tiles with a fixed 0.14 length.
 */
export function createStyledCoasterTrackPiece(options: {
  styleId: CoasterTrackStyleId
  kind: TrackPieceKind
  chainLift: boolean
  display: readonly TrackPoint[]
  frames?: readonly TrackFrame[]
  centerPoints?: readonly Vector3[]
  trackHeightsByCell: ReadonlyMap<string, number[]>
  railColor?: number
  structureColor?: number
  landAt?: (x: number, z: number) => number
  solidTopAt?: (x: number, z: number) => number
}): Group {
  const style = COASTER_TRACK_STYLES[options.styleId]
  const railColor = options.chainLift || options.kind === 'station' ? 0xe8a735 : options.railColor ?? style.rail
  const structure = options.structureColor ?? style.tie
  const kit = new ModelKit()
  const hang = style.hang
  const halfGap = style.railGap / 2
  const display = options.display
  const overlap = 0.03
  if (display.length < 2) {
    const first = display[0]
    if (first) kit.box(first.x + 0.5, first.y + 0.24, first.z + 0.5, style.railGap, style.railHeight, 0.2, railColor)
  }

  let traveled = 0
  let nextTie = 0
  let nextSupport = 0

  for (let index = 0; index < display.length - 1; index += 1) {
    const current = display[index]
    const next = display[index + 1]
    if (!current || !next) continue
    const start = worldCenter(current)
    const end = worldCenter(next)
    const forward = end.clone().sub(start)
    const length = forward.length()
    if (length < 1e-5) continue
    forward.multiplyScalar(1 / length)
    const mid = start.clone().add(end).multiplyScalar(0.5)
    const bank = lerp(current.bank ?? 0, next.bank ?? 0, 0.5)
    const pitch = lerp(current.pitch ?? 0, next.pitch ?? 0, 0.5)
    const frame = computeTrackFrame(
      { x: forward.x, y: forward.y, z: forward.z },
      bank,
      pitch,
      current.frameHeading,
    )
    const rotation = segmentRotation(forward, frame)
    const up = new Vector3(frame.up.x, frame.up.y, frame.up.z)
    const right = new Vector3(frame.right.x, frame.right.y, frame.right.z)
    const hung = mid.clone().add(up.clone().multiplyScalar(hang))
    const railLength = length + overlap

    if (style.trough) {
      kit.box(hung.x, hung.y - 0.04, hung.z, style.railGap + 0.08, 0.05, railLength, railColor, rotation)
      const left = hung.clone().add(right.clone().multiplyScalar(halfGap))
      const rightRail = hung.clone().add(right.clone().multiplyScalar(-halfGap))
      kit.box(left.x, left.y + 0.02, left.z, style.railWidth, style.railHeight, railLength, railColor, rotation)
      kit.box(rightRail.x, rightRail.y + 0.02, rightRail.z, style.railWidth, style.railHeight, railLength, railColor, rotation)
    } else {
      const left = hung.clone().add(right.clone().multiplyScalar(halfGap))
      const rightRail = hung.clone().add(right.clone().multiplyScalar(-halfGap))
      kit.box(left.x, left.y, left.z, style.railWidth, style.railHeight, railLength, railColor, rotation)
      kit.box(rightRail.x, rightRail.y, rightRail.z, style.railWidth, style.railHeight, railLength, railColor, rotation)
    }

    if (traveled + length * 0.5 >= nextTie) {
      kit.box(hung.x, hung.y - 0.02, hung.z, style.tieWidth, style.tieHeight, style.tieDepth, structure, rotation)
      if (style.spineWidth && style.spineHeight && style.spine !== undefined) {
        const spineY = hang > 0 ? style.spineHeight * 0.6 : -0.06
        kit.box(hung.x, hung.y + spineY, hung.z, style.spineWidth, style.spineHeight, Math.min(0.16, railLength), style.spine, rotation)
      }
      nextTie = traveled + 0.22
    }

    traveled += length

    if (traveled >= nextSupport) {
      const height = hung.y - hang
      if (height > 0.3) {
        const cellKey = `${Math.round(current.x)}:${Math.round(current.z)}`
        const landY = options.landAt?.(hung.x, hung.z) ?? 0
        const solidY = options.solidTopAt?.(hung.x, hung.z) ?? landY
        const bottom = Math.max(landY, solidY)
        const lowerTrack = (options.trackHeightsByCell.get(cellKey) ?? []).some(
          (value) => value < current.y - 0.45 && value > bottom + 0.15,
        )
        const post = height - 0.18 - bottom
        if (!lowerTrack && post > 0.15) {
          if (style.id === 'wooden' || style.id === 'woodenMouse') {
            kit.box(hung.x, bottom + post / 2, hung.z, style.supportRadius * 2.2, post, style.supportRadius * 2.2, style.support)
            if (post > 0.8) {
              kit.box(hung.x + 0.12, bottom + post * 0.45, hung.z, 0.035, post * 0.7, 0.035, style.tie)
              kit.box(hung.x - 0.12, bottom + post * 0.45, hung.z, 0.035, post * 0.7, 0.035, style.tie)
            }
          } else if (style.id === 'boxSpine' || style.id === 'gigaLattice') {
            kit.box(hung.x, bottom + post / 2, hung.z, style.supportRadius * 2.4, post, style.supportRadius * 1.6, style.support)
          } else {
            kit.cylinder(hung.x, bottom + post / 2, hung.z, style.supportRadius, post, style.support, style.supportRadius * 1.25, 6)
          }
        }
      }
      nextSupport = traveled + 1
    }
  }

  if (options.kind === 'station') {
    const first = display[0]
    if (first) {
      kit.box(first.x + 0.5, first.y + 0.07, first.z + 0.5, 0.94, 0.14, 0.94, 0x59666c)
    }
  }

  const geometry = kit.finish()
  geometry.userData.shared = false
  const group = new Group()
  const mesh = new Mesh(geometry, trackMaterial)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return group
}
