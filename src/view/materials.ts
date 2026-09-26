import { MeshStandardMaterial, type Material } from 'three'

/**
 * The shared material palette. A world object draws with one of these instead of a
 * material of its own, so objects that look alike batch together and the scene holds
 * a handful of materials rather than one per placed thing. Everything here is marked
 * shared, which makes disposeObject3D leave it alone when a model goes.
 *
 * Previews, overlays that switch per object and animated effects may still make
 * their own; tests/performanceGuards.ts keeps the count of those from growing.
 */
export function shared<T extends Material>(material: T): T {
  material.userData.shared = true
  return material
}

/** The house style: vertex colours from ModelKit, a matte finish, a hint of metal. */
export const HOUSE_MATERIAL = shared(new MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: .05 }))

const overlays = new Map<string, MeshStandardMaterial>()
/** A translucent marking on the ground (a medical area, a designated field). */
export function overlayMaterial(color: number, opacity: number): MeshStandardMaterial {
  const key = `${color}:${opacity}`
  const cached = overlays.get(key)
  if (cached) return cached
  const material = shared(new MeshStandardMaterial({ color, transparent: true, opacity, roughness: .9, depthWrite: false }))
  overlays.set(key, material)
  return material
}
