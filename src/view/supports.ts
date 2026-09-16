import { CylinderGeometry, Mesh, MeshStandardMaterial, type Group } from 'three'
import type { SupportSpan } from '../game/supportOccupancy'

const geometry = new CylinderGeometry(0.11, 0.13, 1, 6)
geometry.translate(0, 0.5, 0)
const material = new MeshStandardMaterial({ color: 0x59665f, roughness: 0.9 })
material.userData.shared = true
geometry.userData.shared = true

export const DEFAULT_SUPPORT_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-0.34, -0.34],
  [0.34, -0.34],
  [-0.34, 0.34],
  [0.34, 0.34],
]

/** Shared post mesh. Local origin is the object; span is in world Y. */
export function attachSupportPosts(
  group: Group,
  objectY: number,
  gaps: readonly (SupportSpan | null)[],
  offsets: ReadonlyArray<readonly [number, number]> = DEFAULT_SUPPORT_OFFSETS,
): number {
  let added = 0
  gaps.forEach((gap, index) => {
    if (!gap) return
    const offset = offsets[index]
    if (!offset) return
    const height = gap.top - gap.bottom
    if (height < 0.15) return
    const post = new Mesh(geometry, material)
    post.position.set(offset[0], gap.bottom - objectY, offset[1])
    post.scale.set(1, height, 1)
    post.castShadow = true
    post.userData.shared = true
    group.add(post)
    added += 1
  })
  return added
}
