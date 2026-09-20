import {
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Object3D,
} from 'three'
import {
  COURSE_PIECE_KINDS,
  COURSE_SPECS,
  courseTrackPieces,
  isWaterLanding,
  slideLandingCell,
  type CourseAttraction,
  type CoursePieceKind,
} from '../game/courseAttractions'
import type { Visitor } from '../game/types/entities'
import { SIMULATION_CONFIG } from '../game/simulationConfig'
import { ModelKit } from './retroBuildings'
import { disposeObject3D } from './disposeObject3D'

const material = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.78,
  metalness: 0.04,
  flatShading: true,
})
material.userData.shared = true

const geometries = new Map<CoursePieceKind, ReturnType<ModelKit['finish']>>()
const matrix = new Matrix4()
const rotation = new Quaternion()
const position = new Vector3()
const axisY = new Vector3(0, 1, 0)
const scale = new Vector3(1, 1, 1)
const forwardAxis = new Vector3(0, 0, 1)

function areaGeometry(kind: CourseAttraction['kind']) {
  const k = new ModelKit()
  if (kind === 'pool') {
    k.box(0, 0.025, 0, 0.98, 0.05, 0.98, 0xd9d3c5)
    for (const offset of [-0.25, 0.25]) {
      k.box(offset, 0.055, 0, 0.018, 0.012, 0.92, 0xbec4c0)
      k.box(0, 0.055, offset, 0.92, 0.012, 0.018, 0xbec4c0)
    }
    k.box(0, 0.061, -0.43, 0.62, 0.015, 0.035, 0x85989a)
  } else {
    k.box(0, 0.02, 0, 0.98, 0.04, 0.98, 0x587640)
    k.box(-0.23, 0.045, 0.17, 0.38, 0.025, 0.28, 0x68864b)
    k.box(0.25, 0.043, -0.24, 0.3, 0.022, 0.24, 0x4d6738)
    k.box(0.12, 0.047, 0.28, 0.22, 0.018, 0.16, 0x765b38)
  }
  return k.finish()
}

const areaGeometries = {
  pool: areaGeometry('pool'),
  paintball: areaGeometry('paintball'),
}
areaGeometries.pool.userData.shared = true
areaGeometries.paintball.userData.shared = true

function paintballMarkerGeometry(color: number) {
  const k = new ModelKit()
  k.box(0, 0, 0.18, 0.09, 0.1, 0.42, 0x30343a)
  k.box(0, 0.08, 0.06, 0.13, 0.12, 0.16, color)
  k.box(0, -0.11, 0.02, 0.07, 0.2, 0.09, 0x25282c)
  const geometry = k.finish()
  geometry.userData.shared = true
  return geometry
}

function paintballProjectileGeometry(color: number) {
  const k = new ModelKit()
  k.sphere(0, 0, 0, 0.045, color, 6)
  const geometry = k.finish()
  geometry.userData.shared = true
  return geometry
}

const paintballWeaponGeometries = {
  a: paintballMarkerGeometry(0x3f82ea),
  b: paintballMarkerGeometry(0xe9783d),
}
const paintballProjectileGeometries = {
  a: paintballProjectileGeometry(0x55a5ff),
  b: paintballProjectileGeometry(0xff8a4d),
}
const MAX_PAINTBALL_ACTORS = 80

function connectorRotation(start: Vector3, end: Vector3): Quaternion {
  return new Quaternion().setFromUnitVectors(
    forwardAxis,
    end.clone().sub(start).normalize(),
  )
}

function addBridgeOrTreeObstacle(
  kit: ModelKit,
  kind: 'hangingBridge' | 'treeObstacle',
  start: Vector3,
  mid: Vector3,
  end: Vector3,
  length: number,
  q: Quaternion,
): void {
  const planks = Math.max(2, Math.ceil(length * 4))
  for (let index = 0; index <= planks; index += 1) {
    const t = index / planks
    const point = start.clone().lerp(end, t)
    const sag = Math.sin(t * Math.PI) * 0.11
    kit.box(point.x, point.y - sag, point.z, 0.5, 0.055, 0.2, index % 2 ? 0x9b7044 : 0x805a37, q)
    if (kind === 'treeObstacle' && index % 2 === 0) {
      kit.beam(
        [point.x - 0.2, point.y + 0.02, point.z],
        [point.x + 0.2, point.y + 0.35, point.z],
        0.035,
        0x4c3828,
      )
    }
  }
  for (const side of [-1, 1]) {
    const offset = new Vector3(side * 0.29, 0.36, 0).applyQuaternion(q)
    const ropeStart = start.clone().add(offset)
    const ropeMid = mid.clone().add(offset).add(new Vector3(0, -0.12, 0))
    const ropeEnd = end.clone().add(offset)
    kit.beam([ropeStart.x, ropeStart.y, ropeStart.z], [ropeMid.x, ropeMid.y, ropeMid.z], 0.025, 0x433427)
    kit.beam([ropeMid.x, ropeMid.y, ropeMid.z], [ropeEnd.x, ropeEnd.y, ropeEnd.z], 0.025, 0x433427)
  }
}

function addConnectedPiece(
  kit: ModelKit,
  piece: CourseAttraction['pieces'][number],
  courseKind: CourseAttraction['kind'],
): void {
  if (piece.endX === undefined || piece.endZ === undefined) return
  const start = new Vector3(piece.x + 0.5, piece.elevation + 0.12, piece.z + 0.5)
  const end = new Vector3(
    piece.endX + 0.5,
    (piece.endElevation ?? piece.elevation) + 0.12,
    piece.endZ + 0.5,
  )
  const delta = end.clone().sub(start)
  const length = delta.length()
  if (length < 0.05) return
  const mid = start.clone().add(end).multiplyScalar(0.5)
  const q = connectorRotation(start, end)
  const kind = piece.kind
  if (kind === 'treeRing') {
    kit.box(mid.x, mid.y, mid.z, 0.38, 0.055, length, 0x8f6b3d, q)
    const segments = 12
    for (let index = 0; index < segments; index += 1) {
      const angle = index / segments * Math.PI * 2
      const ringX = end.x + Math.cos(angle) * 0.38
      const ringZ = end.z + Math.sin(angle) * 0.38
      const ringRotation = new Quaternion().setFromAxisAngle(axisY, -angle)
      kit.box(ringX, end.y, ringZ, 0.22, 0.06, 0.28, 0x9a7442, ringRotation)
    }
  } else if (kind === 'hangingBridge' || kind === 'treeObstacle') {
    addBridgeOrTreeObstacle(kit, kind, start, mid, end, length, q)
  } else if (kind === 'treeZip' || kind === 'treeSwing') {
    kit.beam(
      [start.x, start.y + 0.48, start.z],
      [end.x, end.y + 0.38, end.z],
      0.028,
      0x34312a,
    )
    kit.box(mid.x, mid.y + 0.37, mid.z, 0.14, 0.09, 0.22, 0xc9a96c, q)
    kit.beam(
      [mid.x, mid.y + 0.35, mid.z],
      [mid.x, mid.y + 0.08, mid.z],
      0.025,
      0x51402f,
    )
  } else if (kind === 'waterSlide' || kind === 'slide') {
    const slideColor = kind === 'waterSlide' ? 0x35a8d4 : 0xd59b35
    const rimColor = kind === 'waterSlide' ? 0x91ddf1 : 0xf2c968
    kit.box(mid.x, mid.y, mid.z, 0.5, 0.1, length, slideColor, q)
    kit.box(mid.x - 0.27, mid.y + 0.11, mid.z, 0.055, 0.24, length, rimColor, q)
    kit.box(mid.x + 0.27, mid.y + 0.11, mid.z, 0.055, 0.24, length, rimColor, q)
    if (kind === 'waterSlide' && Math.max(start.y, end.y) > 0.45) {
      for (const t of [0.2, 0.5, 0.8]) {
        const point = start.clone().lerp(end, t)
        kit.beam([point.x - 0.23, point.y, point.z], [point.x - 0.23, 0.08, point.z], 0.045, 0x829498)
        kit.beam([point.x + 0.23, point.y, point.z], [point.x + 0.23, 0.08, point.z], 0.045, 0x829498)
      }
    }
  } else if (kind === 'ropeSwing') {
    kit.beam([start.x - 0.34, start.y, start.z], [start.x - 0.34, start.y + 1.25, start.z], 0.075, 0x725039)
    kit.beam([end.x + 0.34, end.y, end.z], [end.x + 0.34, end.y + 1.25, end.z], 0.075, 0x725039)
    kit.beam([start.x - 0.34, start.y + 1.22, start.z], [end.x + 0.34, end.y + 1.22, end.z], 0.065, 0x5b412f)
    kit.beam([mid.x, mid.y + 1.2, mid.z], [mid.x, mid.y + 0.25, mid.z], 0.035, 0xc3a46a)
    kit.box(mid.x, mid.y + 0.18, mid.z, 0.18, 0.06, 0.12, 0x4c6d37, q)
  } else if (kind === 'monkeyBars') {
    kit.box(mid.x - 0.25, mid.y + 0.58, mid.z, 0.05, 0.05, length, 0x5a4a38, q)
    kit.box(mid.x + 0.25, mid.y + 0.58, mid.z, 0.05, 0.05, length, 0x5a4a38, q)
    const bars = Math.max(2, Math.ceil(length * 3))
    for (let index = 0; index <= bars; index += 1) {
      const t = index / bars
      const point = start.clone().lerp(end, t)
      kit.box(point.x, point.y + 0.58, point.z, 0.56, 0.035, 0.045, 0x8a7a60, q)
    }
  } else if (kind === 'climbWall') {
    kit.box(mid.x, mid.y + 0.62, mid.z, 0.76, 1.25, 0.14, 0x8a6a3d, q)
    for (const [offset, height, color] of [
      [-0.24, 0.28, 0xe5c477],
      [0.16, 0.46, 0x4d9b75],
      [-0.08, 0.72, 0xc95b49],
      [0.24, 0.92, 0x4e79b8],
    ] as const) {
      kit.box(mid.x + offset, mid.y + height, mid.z, 0.1, 0.07, 0.2, color, q)
    }
  } else if (kind === 'crawlTunnel') {
    kit.box(mid.x - 0.3, mid.y + 0.28, mid.z, 0.07, 0.55, length, 0x6a5340, q)
    kit.box(mid.x + 0.3, mid.y + 0.28, mid.z, 0.07, 0.55, length, 0x6a5340, q)
    kit.box(mid.x, mid.y + 0.55, mid.z, 0.66, 0.07, length, 0x8a6a4a, q)
  } else if (kind === 'waterDitch') {
    kit.box(mid.x, mid.y - 0.04, mid.z, 0.78, 0.08, length, 0x305f86, q)
    kit.box(mid.x - 0.43, mid.y, mid.z, 0.08, 0.12, length, 0x6a5340, q)
    kit.box(mid.x + 0.43, mid.y, mid.z, 0.08, 0.12, length, 0x6a5340, q)
  } else if (kind === 'jump') {
    kit.box(mid.x, mid.y + 0.12, mid.z, 0.72, 0.22, length, 0xc47a3a, q)
  } else if (kind === 'ladder' || kind === 'treeLadder') {
    kit.box(mid.x - 0.2, mid.y, mid.z, 0.06, 0.06, length, 0x8a6438, q)
    kit.box(mid.x + 0.2, mid.y, mid.z, 0.06, 0.06, length, 0x8a6438, q)
    const rungs = Math.max(2, Math.ceil(length * 3))
    for (let index = 0; index <= rungs; index += 1) {
      const point = start.clone().lerp(end, index / rungs)
      kit.box(point.x, point.y, point.z, 0.45, 0.045, 0.06, 0xc49a62, q)
    }
  } else {
    const deckColor =
      courseKind === 'treeToTree' ? 0x8b633f :
      courseKind === 'pool' ? 0xd8d4c9 :
      0x8a6338
    const width = courseKind === 'pool' ? 0.68 : 0.56
    kit.box(mid.x, mid.y, mid.z, width, 0.08, length, deckColor, q)
    if (courseKind === 'mudmasters') {
      kit.box(mid.x - width * 0.48, mid.y + 0.035, mid.z, 0.035, 0.07, length, 0x5b452f, q)
      kit.box(mid.x + width * 0.48, mid.y + 0.035, mid.z, 0.035, 0.07, length, 0x5b452f, q)
    }
  }
}

function addCourseTransitions(kit: ModelKit, course: CourseAttraction): number {
  if (course.kind === 'paintball') return 0
  const joints = new Map<string, { x: number; y: number; z: number }>()
  for (const piece of courseTrackPieces(course)) {
    joints.set(
      `${piece.x}:${piece.elevation}:${piece.z}`,
      { x: piece.x + 0.5, y: piece.elevation + 0.12, z: piece.z + 0.5 },
    )
    if (piece.endX !== undefined && piece.endZ !== undefined) {
      const elevation = piece.endElevation ?? piece.elevation
      joints.set(
        `${piece.endX}:${elevation}:${piece.endZ}`,
        { x: piece.endX + 0.5, y: elevation + 0.12, z: piece.endZ + 0.5 },
      )
    }
  }
  for (const joint of joints.values()) {
    if (course.kind === 'treeToTree') {
      kit.cylinder(joint.x, joint.y, joint.z, 0.39, 0.09, 0x8b633f, 0.39, 10)
      kit.cylinder(joint.x, joint.y + 0.065, joint.z, 0.3, 0.04, 0xb08a55, 0.3, 10)
      for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const x = joint.x + Math.cos(angle) * 0.35
        const z = joint.z + Math.sin(angle) * 0.35
        kit.beam([x, joint.y, z], [x, joint.y + 0.48, z], 0.035, 0x5b422f)
      }
    } else if (course.kind === 'pool') {
      kit.box(joint.x, joint.y, joint.z, 0.72, 0.07, 0.72, 0xd8d4c9)
      for (const offset of [-0.25, 0, 0.25]) {
        kit.box(joint.x + offset, joint.y + 0.04, joint.z, 0.025, 0.025, 0.62, 0xaeb9ba)
      }
    } else {
      kit.cylinder(joint.x, joint.y, joint.z, 0.34, 0.08, 0x765332, 0.32, 10)
      kit.box(joint.x, joint.y + 0.045, joint.z, 0.48, 0.035, 0.48, 0xa77b45)
    }
    if (joint.y > 0.42) {
      for (const [dx, dz] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]] as const) {
        kit.beam(
          [joint.x + dx, 0.05, joint.z + dz],
          [joint.x + dx, joint.y - 0.03, joint.z + dz],
          0.055,
          course.kind === 'pool' ? 0x829498 : 0x65472f,
        )
      }
    }
  }
  return joints.size
}

function addAreaBoundary(kit: ModelKit, course: CourseAttraction): number {
  if (course.kind !== 'pool' && course.kind !== 'paintball') return 0
  const cells = new Set(course.areaCells.map((cell) => `${cell.x}:${cell.z}`))
  let count = 0
  for (const cell of course.areaCells) {
    const accessCell = course.pieces.some(
      (piece) =>
        (piece.kind === 'entrance' || piece.kind === 'exit') &&
        piece.x === cell.x &&
        piece.z === cell.z,
    )
    for (const edge of [
      { dx: 1, dz: 0, ox: 0.49, oz: 0, width: 0.04, depth: 1 },
      { dx: -1, dz: 0, ox: -0.49, oz: 0, width: 0.04, depth: 1 },
      { dx: 0, dz: 1, ox: 0, oz: 0.49, width: 1, depth: 0.04 },
      { dx: 0, dz: -1, ox: 0, oz: -0.49, width: 1, depth: 0.04 },
    ]) {
      if (cells.has(`${cell.x + edge.dx}:${cell.z + edge.dz}`)) continue
      if (accessCell) continue
      const x = cell.x + 0.5 + edge.ox
      const z = cell.z + 0.5 + edge.oz
      if (course.kind === 'paintball') {
        for (const y of [0.28, 0.6, 0.92, 1.18]) {
          kit.box(x, y, z, edge.width, 0.025, edge.depth, 0x354438)
        }
        if (edge.dx !== 0) {
          kit.beam([x, 0.03, z - 0.48], [x, 1.24, z - 0.48], 0.035, 0x29372d)
          kit.beam([x, 0.03, z + 0.48], [x, 1.24, z + 0.48], 0.035, 0x29372d)
        } else {
          kit.beam([x - 0.48, 0.03, z], [x - 0.48, 1.24, z], 0.035, 0x29372d)
          kit.beam([x + 0.48, 0.03, z], [x + 0.48, 1.24, z], 0.035, 0x29372d)
        }
      } else {
        kit.box(x, 0.055, z, edge.width, 0.11, edge.depth, 0xe8ece9)
        kit.box(x, 0.115, z, edge.width * 1.4, 0.025, edge.depth * 1.02, 0x9bb3b5)
      }
      count += 1
    }
  }
  return count
}

function addSlideLandingMarkers(kit: ModelKit, course: CourseAttraction): number {
  if (course.kind !== 'pool' || course.operating) return 0
  const track = courseTrackPieces(course)
  let count = 0
  for (let index = 0; index < track.length; index += 1) {
    const piece = track[index]!
    if (
      piece.kind !== 'waterSlide' ||
      piece.endX === undefined ||
      track[index + 1]?.kind === 'waterSlide'
    ) continue
    const landing = slideLandingCell(piece)
    const color = isWaterLanding(course, landing.x, landing.z) ? 0x48d878 : 0xe34f45
    kit.box(landing.x + 0.5, 0.075, landing.z + 0.5, 0.78, 0.04, 0.1, color)
    kit.box(landing.x + 0.5, 0.076, landing.z + 0.5, 0.1, 0.04, 0.78, color)
    count += 1
  }
  return count
}

function geometryFor(kind: CoursePieceKind) {
  const cached = geometries.get(kind)
  if (cached) return cached
  const built = buildPiece(kind)
  built.userData.shared = true
  geometries.set(kind, built)
  return built
}

function buildPiece(kind: CoursePieceKind) {
  const k = new ModelKit()
  if (kind === 'entrance') {
    k.box(0, 0.04, 0, 0.92, 0.08, 0.92, 0x3a7a4a)
    k.box(-0.32, 0.55, 0, 0.08, 1.02, 0.08, 0x2f4a36)
    k.box(0.32, 0.55, 0, 0.08, 1.02, 0.08, 0x2f4a36)
    k.box(0, 1.08, 0, 0.78, 0.08, 0.1, 0x3dba6b)
    k.box(0, 0.62, 0.02, 0.7, 0.22, 0.04, 0xf2dfb5)
    return k.finish()
  }
  if (kind === 'exit') {
    k.box(0, 0.04, 0, 0.92, 0.08, 0.92, 0x7a3a3a)
    k.box(-0.32, 0.5, 0, 0.08, 0.92, 0.08, 0x4a2a2a)
    k.box(0.32, 0.5, 0, 0.08, 0.92, 0.08, 0x4a2a2a)
    k.box(0, 0.98, 0, 0.78, 0.08, 0.1, 0xd4543a)
    return k.finish()
  }
  if (kind === 'path') {
    k.box(0, 0.03, 0, 0.96, 0.06, 0.96, 0xb08a4a)
    k.box(0.18, 0.06, -0.2, 0.2, 0.03, 0.16, 0x8a6a3d)
    return k.finish()
  }
  if (kind === 'climbWall') {
    k.box(0, 0.95, 0, 0.22, 1.9, 0.86, 0x8a6a3d)
    for (const y of [0.35, 0.75, 1.15, 1.55]) {
      k.box(-0.16, y, -0.22, 0.08, 0.06, 0.1, 0xc4a574)
      k.box(-0.16, y + 0.18, 0.2, 0.08, 0.06, 0.1, 0xc4a574)
    }
    return k.finish()
  }
  if (kind === 'ropeSwing') {
    k.box(-0.32, 0.95, 0, 0.08, 1.9, 0.08, 0x6b4a2a)
    k.box(0.32, 0.95, 0, 0.08, 1.9, 0.08, 0x6b4a2a)
    k.box(0, 1.88, 0, 0.72, 0.06, 0.06, 0x4a3420)
    k.box(0, 1.1, 0, 0.04, 1.2, 0.04, 0x8f6b3d)
    k.box(0, 0.48, 0, 0.16, 0.08, 0.22, 0x6b8f4e)
    return k.finish()
  }
  if (kind === 'waterDitch') {
    k.box(0, 0.08, 0, 0.96, 0.16, 0.96, 0x6a5340)
    k.box(0, 0.1, 0, 0.78, 0.12, 0.78, 0x3a7ca5)
    return k.finish()
  }
  if (kind === 'crawlTunnel') {
    k.box(0, 0.28, 0, 0.92, 0.42, 0.7, 0x6a5340)
    k.box(0, 0.28, 0, 0.72, 0.28, 0.58, 0x3a3028)
    return k.finish()
  }
  if (kind === 'slide') {
    k.box(-0.28, 0.85, 0, 0.1, 1.6, 0.1, 0x8a6a3d)
    k.box(0.1, 0.55, 0, 0.7, 0.1, 0.36, 0xd4b43a)
    k.box(0.28, 0.28, 0, 0.4, 0.08, 0.36, 0xd4b43a)
    return k.finish()
  }
  if (kind === 'ladder') {
    k.box(-0.16, 0.7, 0, 0.06, 1.32, 0.06, 0x9a7a4a)
    k.box(0.16, 0.7, 0, 0.06, 1.32, 0.06, 0x9a7a4a)
    for (const y of [0.28, 0.52, 0.76, 1.0, 1.24]) k.box(0, y, 0, 0.34, 0.04, 0.05, 0xc4a574)
    return k.finish()
  }
  if (kind === 'jump') {
    k.box(-0.28, 0.22, 0, 0.36, 0.36, 0.7, 0xc47a3a)
    k.box(0.28, 0.22, 0, 0.36, 0.36, 0.7, 0xc47a3a)
    return k.finish()
  }
  if (kind === 'monkeyBars') {
    k.box(-0.34, 0.95, 0, 0.08, 1.86, 0.08, 0x7a6a50)
    k.box(0.34, 0.95, 0, 0.08, 1.86, 0.08, 0x7a6a50)
    k.box(0, 1.86, 0, 0.76, 0.06, 0.08, 0x5a4a38)
    for (const x of [-0.18, 0, 0.18]) k.box(x, 1.62, 0, 0.05, 0.42, 0.05, 0x8a7a60)
    return k.finish()
  }
  if (kind === 'poolBasin') {
    k.box(0, 0.07, 0, 0.98, 0.14, 0.98, 0xe4e0d8)
    k.box(0, 0.055, 0, 0.82, 0.1, 0.82, 0x267aa8)
    k.box(0, 0.115, 0, 0.74, 0.018, 0.74, 0x57b8da)
    for (const offset of [-0.45, 0.45]) {
      k.box(offset, 0.11, 0, 0.055, 0.16, 0.94, 0xf0ede6)
      k.box(0, 0.11, offset, 0.94, 0.16, 0.055, 0xf0ede6)
    }
    return k.finish()
  }
  if (kind === 'waterSlide') {
    k.box(0, 1.15, -0.22, 0.42, 2.2, 0.42, 0x4aa3d4)
    k.box(0.08, 1.55, 0.18, 0.28, 0.16, 0.9, 0x7ec8e8)
    k.box(0.16, 0.85, 0.42, 0.22, 0.12, 0.7, 0x7ec8e8)
    k.box(0.2, 0.28, 0.58, 0.2, 0.1, 0.36, 0x7ec8e8)
    return k.finish()
  }
  if (kind === 'tree') {
    k.cylinder(0, 1.2, 0, 0.15, 2.35, 0x654529, 0.1, 7)
    for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
      k.beam(
        [Math.cos(angle) * 0.08, 0.25, Math.sin(angle) * 0.08],
        [Math.cos(angle) * 0.35, 0.02, Math.sin(angle) * 0.35],
        0.08,
        0x654529,
      )
    }
    k.cylinder(0, 1.68, 0, 0.4, 0.1, 0x8e6841, 0.4, 10)
    k.sphere(0, 2.38, 0, 0.48, 0x345f2f, 7)
    k.sphere(-0.28, 2.22, 0.14, 0.3, 0x477b3a, 6)
    k.sphere(0.25, 2.18, -0.12, 0.32, 0x3d7135, 6)
    return k.finish()
  }
  if (kind === 'treeRing') {
    k.box(0, 1.55, 0, 0.86, 0.06, 0.86, 0x8f6b3d)
    k.box(0, 1.55, 0, 0.58, 0.08, 0.58, 0x3d6b32)
    k.box(-0.38, 1.68, 0, 0.08, 0.18, 0.08, 0x6b4a28)
    k.box(0.38, 1.68, 0, 0.08, 0.18, 0.08, 0x6b4a28)
    k.box(0, 1.68, -0.38, 0.08, 0.18, 0.08, 0x6b4a28)
    k.box(0, 1.68, 0.38, 0.08, 0.18, 0.08, 0x6b4a28)
    return k.finish()
  }
  if (kind === 'treeLadder') {
    k.cylinder(0, 0.85, 0, 0.1, 1.6, 0x6b4a28, 0.08, 6)
    for (const y of [0.3, 0.55, 0.8, 1.05, 1.3]) k.box(0.14, y, 0, 0.22, 0.04, 0.05, 0x9a7a4a)
    return k.finish()
  }
  if (kind === 'hangingBridge') {
    k.box(-0.4, 1.55, 0, 0.08, 0.16, 0.08, 0x6b4a28)
    k.box(0.4, 1.55, 0, 0.08, 0.16, 0.08, 0x6b4a28)
    k.box(0, 1.48, 0, 0.88, 0.05, 0.28, 0x8f6b3d)
    k.box(0, 1.62, -0.14, 0.88, 0.04, 0.04, 0x4a3420)
    k.box(0, 1.62, 0.14, 0.88, 0.04, 0.04, 0x4a3420)
    return k.finish()
  }
  if (kind === 'treeObstacle') {
    k.cylinder(0, 1.05, 0, 0.1, 2.0, 0x6b4a28, 0.08, 6)
    k.box(0.18, 1.4, 0, 0.28, 0.08, 0.08, 0x4a7a38)
    k.box(-0.16, 1.7, 0.1, 0.24, 0.08, 0.08, 0x4a7a38)
    k.sphere(0, 2.2, 0, 0.32, 0x3d6b32, 6)
    return k.finish()
  }
  if (kind === 'treeSwing') {
    k.cylinder(0, 1.2, 0, 0.1, 2.3, 0x6b4a28, 0.08, 6)
    k.sphere(0, 2.4, 0, 0.36, 0x3d6b32, 6)
    k.box(0.22, 1.4, 0, 0.04, 1.1, 0.04, 0x8f6b3d)
    k.box(0.28, 0.82, 0, 0.16, 0.06, 0.2, 0x5a8a40)
    return k.finish()
  }
  if (kind === 'treeZip') {
    k.box(-0.4, 1.85, 0, 0.08, 0.16, 0.08, 0x6b4a28)
    k.box(0.4, 1.55, 0, 0.08, 0.16, 0.08, 0x6b4a28)
    k.box(0, 1.7, 0, 0.88, 0.04, 0.04, 0x7a9a48)
    k.box(0, 1.62, 0, 0.16, 0.1, 0.16, 0xc4a574)
    return k.finish()
  }
  if (kind === 'paintballField') {
    k.box(0, 0.03, 0, 0.98, 0.06, 0.98, 0x6b7a4a)
    k.box(0, 0.05, 0, 0.7, 0.02, 0.04, 0xf2dfb5)
    k.box(0, 0.05, 0, 0.04, 0.02, 0.7, 0xf2dfb5)
    return k.finish()
  }
  if (kind === 'cover') {
    k.cylinder(-0.2, 0.28, 0.08, 0.16, 0.54, 0x496d3f, 0.16, 8)
    k.cylinder(0.12, 0.34, -0.04, 0.2, 0.66, 0x596f43, 0.12, 8)
    k.box(0, 0.24, 0.14, 0.78, 0.42, 0.18, 0x6c5738)
    k.box(0, 0.47, 0.14, 0.8, 0.05, 0.2, 0x8b744f)
    for (const x of [-0.27, 0, 0.27]) k.box(x, 0.25, 0.235, 0.045, 0.32, 0.02, 0x3d4938)
    return k.finish()
  }
  if (kind === 'teamStartA') {
    k.box(0, 0.04, 0, 0.9, 0.08, 0.9, 0x315fae)
    k.box(0, 0.42, -0.36, 0.86, 0.76, 0.08, 0x294776)
    k.box(-0.39, 0.38, 0, 0.08, 0.68, 0.72, 0x294776)
    k.box(0, 0.82, 0, 0.9, 0.08, 0.8, 0x3a6ad4)
    k.box(0, 0.88, 0.22, 0.5, 0.08, 0.08, 0xe8edf2)
    return k.finish()
  }
  k.box(0, 0.04, 0, 0.9, 0.08, 0.9, 0xaf4e2f)
  k.box(0, 0.42, -0.36, 0.86, 0.76, 0.08, 0x763b29)
  k.box(0.39, 0.38, 0, 0.08, 0.68, 0.72, 0x763b29)
  k.box(0, 0.82, 0, 0.9, 0.08, 0.8, 0xd46a3a)
  k.box(0, 0.88, 0.22, 0.5, 0.08, 0.08, 0xf3e9df)
  return k.finish()
}

export class CourseView {
  readonly group = new Group()
  private readonly staticGroup = new Group()
  private readonly weaponMeshes = {
    a: new InstancedMesh(paintballWeaponGeometries.a, material, MAX_PAINTBALL_ACTORS),
    b: new InstancedMesh(paintballWeaponGeometries.b, material, MAX_PAINTBALL_ACTORS),
  }
  private readonly projectileMeshes = {
    a: new InstancedMesh(paintballProjectileGeometries.a, material, MAX_PAINTBALL_ACTORS),
    b: new InstancedMesh(paintballProjectileGeometries.b, material, MAX_PAINTBALL_ACTORS),
  }
  private geometrySignature = ''

  constructor() {
    this.group.add(
      this.staticGroup,
      this.weaponMeshes.a,
      this.weaponMeshes.b,
      this.projectileMeshes.a,
      this.projectileMeshes.b,
    )
    for (const mesh of [
      ...Object.values(this.weaponMeshes),
      ...Object.values(this.projectileMeshes),
    ]) {
      mesh.count = 0
      mesh.castShadow = true
    }
  }

  update(
    courses: readonly CourseAttraction[],
    visitors: readonly Visitor[],
    simTick: number,
  ): void {
    this.updatePaintballEffects(courses, visitors, simTick)
    const signature = courses.map((course) =>
      `${course.id}:${course.kind}:${course.operating}:` +
      `${course.areaCells.map((cell) => `${cell.x},${cell.z}`).join(';')}:` +
      course.pieces.map((piece) =>
        `${piece.id},${piece.kind},${piece.x},${piece.z},${piece.elevation},` +
        `${piece.endX ?? ''},${piece.endZ ?? ''},${piece.endElevation ?? ''},${piece.rotation}`,
      ).join(';'),
    ).join('|')
    if (signature === this.geometrySignature) return
    this.geometrySignature = signature
    while (this.staticGroup.children.length) {
      const child = this.staticGroup.children[0]!
      this.staticGroup.remove(child)
      disposeObject3D(child)
    }
    const areaByKind = new Map<'pool' | 'paintball', { x: number; z: number; courseId: string }[]>()
    const trackKit = new ModelKit()
    let connectedPieceCount = 0
    const byKind = new Map<CoursePieceKind, { x: number; y: number; z: number; rotation: number; courseId: string }[]>()
    for (const course of courses) {
      connectedPieceCount += addAreaBoundary(trackKit, course)
      connectedPieceCount += addSlideLandingMarkers(trackKit, course)
      connectedPieceCount += addCourseTransitions(trackKit, course)
      if (course.kind === 'pool' || course.kind === 'paintball') {
        const area = areaByKind.get(course.kind) ?? []
        for (const cell of course.areaCells) {
          area.push({ x: cell.x + 0.5, z: cell.z + 0.5, courseId: course.id })
        }
        areaByKind.set(course.kind, area)
      }
      for (const piece of course.pieces) {
        const span = Math.hypot(
          (piece.endX ?? piece.x) - piece.x,
          (piece.endZ ?? piece.z) - piece.z,
          (piece.endElevation ?? piece.elevation) - piece.elevation,
        )
        if (piece.endX !== undefined && piece.endZ !== undefined && span > 0.05) {
          addConnectedPiece(trackKit, piece, course.kind)
          connectedPieceCount += 1
          if (piece.kind !== 'exit') continue
          const bucket = byKind.get(piece.kind) ?? []
          bucket.push({
            x: piece.endX + 0.5,
            y: piece.endElevation ?? piece.elevation,
            z: piece.endZ + 0.5,
            rotation: piece.rotation * (Math.PI / 2),
            courseId: course.id,
          })
          byKind.set(piece.kind, bucket)
          continue
        }
        const bucket = byKind.get(piece.kind) ?? []
        bucket.push({
          x: piece.x + 0.5,
          y: piece.kind === 'treeRing' ? piece.elevation : 0,
          z: piece.z + 0.5,
          rotation: piece.rotation * (Math.PI / 2),
          courseId: course.id,
        })
        byKind.set(piece.kind, bucket)
      }
    }
    for (const kind of ['pool', 'paintball'] as const) {
      const instances = areaByKind.get(kind)
      if (!instances?.length) continue
      const mesh = new InstancedMesh(areaGeometries[kind], material, instances.length)
      mesh.userData.courseIds = instances.map((entry) => entry.courseId)
      mesh.receiveShadow = true
      instances.forEach((entry, index) => {
        rotation.identity()
        position.set(entry.x, 0, entry.z)
        matrix.compose(position, rotation, scale)
        mesh.setMatrixAt(index, matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      this.staticGroup.add(mesh)
    }
    if (connectedPieceCount > 0) {
      const geometry = trackKit.finish()
      const mesh = new Mesh(geometry, material)
      mesh.castShadow = mesh.receiveShadow = true
      this.staticGroup.add(mesh)
    }
    for (const kind of COURSE_PIECE_KINDS) {
      const instances = byKind.get(kind)
      if (!instances?.length) continue
      const mesh = new InstancedMesh(geometryFor(kind), material, instances.length)
      mesh.userData.courseIds = instances.map((entry) => entry.courseId)
      mesh.castShadow = mesh.receiveShadow = true
      instances.forEach((entry, index) => {
        rotation.setFromAxisAngle(axisY, entry.rotation)
        position.set(entry.x, entry.y, entry.z)
        matrix.compose(position, rotation, scale)
        mesh.setMatrixAt(index, matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      this.staticGroup.add(mesh)
    }
  }

  private updatePaintballEffects(
    courses: readonly CourseAttraction[],
    visitors: readonly Visitor[],
    simTick: number,
  ): void {
    const visitorsById = new Map(visitors.map((visitor) => [visitor.id, visitor]))
    const weaponCounts = { a: 0, b: 0 }
    const projectileCounts = { a: 0, b: 0 }
    for (const course of courses) {
      if (course.kind !== 'paintball') continue
      const teams = {
        a: course.riders.filter((rider) => rider.team === 'a'),
        b: course.riders.filter((rider) => rider.team === 'b'),
      }
      for (const team of ['a', 'b'] as const) {
        const opponents = teams[team === 'a' ? 'b' : 'a']
        teams[team].forEach((rider, riderIndex) => {
          const visitor = visitorsById.get(rider.visitorId)
          if (!visitor) return
          const opponent = opponents[riderIndex % Math.max(1, opponents.length)]
          const targetVisitor = opponent ? visitorsById.get(opponent.visitorId) : undefined
          const direction = targetVisitor
            ? new Vector3(targetVisitor.x - visitor.x, 0, targetVisitor.z - visitor.z)
            : new Vector3(team === 'a' ? 1 : -1, 0, 0)
          if (direction.lengthSq() < 0.001) direction.set(0, 0, 1)
          direction.normalize()
          const weaponIndex = weaponCounts[team]++
          if (weaponIndex < MAX_PAINTBALL_ACTORS) {
            rotation.setFromUnitVectors(forwardAxis, direction)
            position.set(
              visitor.x + direction.x * 0.18,
              visitor.y + 0.67,
              visitor.z + direction.z * 0.18,
            )
            matrix.compose(position, rotation, scale)
            this.weaponMeshes[team].setMatrixAt(weaponIndex, matrix)
          }
          if (!course.match || !targetVisitor) return
          const cycle = SIMULATION_CONFIG.courses.paintballShotCycleTicks
          const phase = ((simTick + riderIndex * 3 + (team === 'b' ? 5 : 0)) % cycle) / cycle
          const projectileIndex = projectileCounts[team]++
          if (projectileIndex >= MAX_PAINTBALL_ACTORS) return
          position.set(
            visitor.x + (targetVisitor.x - visitor.x) * phase,
            visitor.y + 0.62 + Math.sin(phase * Math.PI) * 0.18,
            visitor.z + (targetVisitor.z - visitor.z) * phase,
          )
          rotation.identity()
          matrix.compose(position, rotation, scale)
          this.projectileMeshes[team].setMatrixAt(projectileIndex, matrix)
        })
      }
    }
    for (const team of ['a', 'b'] as const) {
      this.weaponMeshes[team].count = Math.min(weaponCounts[team], MAX_PAINTBALL_ACTORS)
      this.projectileMeshes[team].count = Math.min(projectileCounts[team], MAX_PAINTBALL_ACTORS)
      this.weaponMeshes[team].instanceMatrix.needsUpdate = true
      this.projectileMeshes[team].instanceMatrix.needsUpdate = true
    }
  }

  pickRoot(): Object3D {
    return this.group
  }

  label(course: CourseAttraction): string {
    return `${COURSE_SPECS[course.kind].icon} ${course.name}`
  }
}
