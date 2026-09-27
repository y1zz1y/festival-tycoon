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

/**
 * A copy of the house material for instanced batches of one kind, with its own
 * finish. Batches with an instance colour and batches without one each need their
 * own material object, and neither may share it with plain meshes: every switch
 * between those would rebuild the shader program. The copies are fixed in number
 * (one per call site, made at module load), never one per object.
 */
export function houseVariant(roughness: number, metalness: number): MeshStandardMaterial {
  const material = shared(HOUSE_MATERIAL.clone())
  material.roughness = roughness
  material.metalness = metalness
  return material
}

const palette = new Map<string, MeshStandardMaterial>()
function cachedStandard(key: string, params: ConstructorParameters<typeof MeshStandardMaterial>[0]): MeshStandardMaterial {
  const cached = palette.get(key)
  if (cached) return cached
  const material = shared(new MeshStandardMaterial(params))
  palette.set(key, material)
  return material
}

/** A translucent marking on the ground (a medical area, a designated field). */
export function overlayMaterial(color: number, opacity: number): MeshStandardMaterial {
  return cachedStandard(`overlay:${color}:${opacity}`, {
    color,
    transparent: true,
    opacity,
    roughness: .9,
    depthWrite: false,
  })
}

/** Stone curb for camping and forecourt area edges (`AreaEdgeBatch`). */
export const AREA_EDGE_MATERIAL = cachedStandard('area-edge', { color: 0xc4bba0, roughness: 1 })
