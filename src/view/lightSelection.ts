import { Frustum, Matrix4, Vector3, type Camera } from 'three'

/**
 * Which light sources get one of the few real lights. Three's forward renderer pays
 * for every light on every pixel, and changing the number of lights recompiles the
 * shaders, so each pool holds a fixed handful — and the handful has to go to the
 * sources the player can actually see. A source inside the camera's view always
 * beats one outside it; within a group, the nearer to the middle of the view, the
 * sooner it is served.
 */
export type LightView = {
  frustum: Frustum
  /** The point the camera looks at: ties inside the view are broken by nearness to it. */
  focus: Vector3
  /**
   * The projection this frustum came from. Zooming changes what is on screen without
   * moving the point the camera looks at, so the selection has to watch this too —
   * otherwise a zoomed-out view keeps the lights it picked while zoomed in.
   */
  projection: Matrix4
}

const projection = new Matrix4()

export function emptyLightView(): LightView {
  return { frustum: new Frustum(), focus: new Vector3(), projection: new Matrix4() }
}

/** The view for this frame, from a camera whose matrices are current. */
export function lightViewOf(camera: Camera, focus: Vector3, into: LightView = emptyLightView()): LightView {
  camera.updateMatrixWorld()
  projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  into.frustum.setFromProjectionMatrix(projection)
  into.focus.copy(focus)
  into.projection ??= new Matrix4()
  into.projection.copy(projection)
  return into
}

/** Whether two views would pick different lights: a different vantage point, or a different zoom. */
export function lightViewsDiffer(a: Matrix4, b: Matrix4, epsilon = 1e-4): boolean {
  for (let i = 0; i < 16; i++) {
    if (Math.abs(a.elements[i]! - b.elements[i]!) > epsilon) return true
  }
  return false
}

/**
 * Gathers sources onto a grid coarse enough that the groups fit the budget.
 *
 * Zoomed out there are more lamps on screen than there are real lights to give
 * out, and handing the lights to the ones nearest the middle of the view lit a
 * clump in the centre while the rest of the park stayed dark. Neighbouring
 * lamps are a few pixels apart at that distance, so a group of them reads as
 * one light — and one light per group covers the whole park instead of a patch
 * of it.
 *
 * The grid is in world space and the cell size only ever doubles, so groups do
 * not shift as the camera pans and do not flicker between frames. `keys`
 * separates sources that must not be mixed, such as a white balloon among warm
 * lamps.
 */
export function groupForBudget(
  positions: readonly Vector3[],
  keys: readonly number[],
  budget: number,
  baseCell = 1,
): number[][] {
  if (budget <= 0 || positions.length === 0) return []
  const bucket = (indices: readonly number[], cell: number): number[][] => {
    const buckets = new Map<string, number[]>()
    for (const i of indices) {
      const position = positions[i]!
      const key = `${keys[i]}:${Math.floor(position.x / cell)}:${Math.floor(position.z / cell)}`
      const existing = buckets.get(key)
      if (existing) existing.push(i)
      else buckets.set(key, [i])
    }
    return [...buckets.values()]
  }

  const all = positions.map((_, index) => index)
  // Coarsen until the groups fit. The step guard is only there so a
  // pathological scene cannot spin here.
  let cell = baseCell
  let groups = bucket(all, cell).map(indices => ({ cell, indices }))
  for (let step = 0; step < 24 && groups.length > budget; step++) {
    cell *= 2
    groups = bucket(all, cell).map(indices => ({ cell, indices }))
  }
  if (groups.length > budget) return []

  // Then spend whatever the budget still has on the crowded groups, splitting
  // the biggest one at a time. Leaving lights idle would light the park more
  // coarsely than the hardware allows.
  const settled = new Set<(typeof groups)[number]>()
  for (let step = 0; step < budget * 4 && groups.length < budget; step++) {
    let biggest = -1
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i]!
      if (group.indices.length < 2 || group.cell <= .125 || settled.has(group)) continue
      if (biggest < 0 || group.indices.length > groups[biggest]!.indices.length) biggest = i
    }
    if (biggest < 0) break
    const target = groups[biggest]!
    const finer = target.cell / 2
    const parts = bucket(target.indices, finer)
    if (parts.length < 2) {
      // Sources too close together to come apart at this size: try again finer
      // rather than giving up on them.
      target.cell = finer
      continue
    }
    // A split that does not fit is set aside; a smaller group may still have room.
    if (groups.length - 1 + parts.length > budget) {
      settled.add(target)
      continue
    }
    groups.splice(biggest, 1, ...parts.map(indices => ({ cell: finer, indices })))
  }
  return groups.map(group => group.indices)
}

/**
 * Indices of the candidates in serving order: everything in view first, nearest to the
 * focus first, then the rest by distance. Stable for equal distances, so the same scene
 * yields the same order and lights do not flicker between sources from frame to frame.
 */
export function rankByView(positions: readonly Vector3[], view: LightView | null): number[] {
  const scored = positions.map((position, index) => ({
    index,
    inView: view ? view.frustum.containsPoint(position) : true,
    distance: view ? position.distanceToSquared(view.focus) : 0,
  }))
  scored.sort((a, b) => (a.inView === b.inView ? a.distance - b.distance || a.index - b.index : a.inView ? -1 : 1))
  return scored.map((entry) => entry.index)
}
