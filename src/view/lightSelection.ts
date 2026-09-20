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

export type SourceBucket = {
  /** Stable across frames: the same lamps always land under the same name. */
  key: string
  indices: number[]
  centre: Vector3
  /** The grid size this bucket was cut at, so it can be cut finer later. */
  cell: number
}

/**
 * Gathers sources onto a fixed world grid.
 *
 * The grid is in world space and covers every source, not just the ones on
 * screen, so a bucket holds the same lamps however the camera moves. That is
 * what stops the lights from reshuffling during a pan: only which buckets are
 * *chosen* changes, never what a bucket is.
 *
 * `keys` separates sources that must not be mixed, such as a white balloon
 * among warm lamps.
 */
export function bucketSources(
  positions: readonly Vector3[],
  keys: readonly number[],
  cell: number,
): SourceBucket[] {
  const buckets = new Map<string, SourceBucket>()
  for (let i = 0; i < positions.length; i++) {
    const position = positions[i]!
    // The cell size belongs in the name: a coarse cell and a fine one can sit on
    // the same grid coordinates, and sharing a name made them share a light.
    const key = `${cell}:${keys[i]}:${Math.floor(position.x / cell)}:${Math.floor(position.z / cell)}`
    const existing = buckets.get(key)
    if (existing) {
      existing.indices.push(i)
      existing.centre.add(position)
    } else {
      buckets.set(key, { key, indices: [i], centre: position.clone(), cell })
    }
  }
  for (const bucket of buckets.values()) bucket.centre.divideScalar(bucket.indices.length)
  return [...buckets.values()]
}

/**
 * The grid size to gather at: fine enough that each lamp keeps its own light
 * where the budget allows, coarse enough that a zoomed-out view still covers
 * the whole park.
 *
 * It sticks. Recomputing it from whatever happens to be on screen made it flip
 * back and forth on the boundary while panning, and every flip re-cut every
 * bucket. It only doubles once the view is genuinely over budget, and only
 * halves once the finer grid is comfortably under it.
 */
export function stickyCell(
  current: number,
  visibleAt: (cell: number) => number,
  budget: number,
  minimum = .5,
): number {
  let cell = Math.max(minimum, current)
  for (let step = 0; step < 24 && visibleAt(cell) > budget; step++) cell *= 2
  for (let step = 0; step < 24 && cell > minimum && visibleAt(cell / 2) <= budget * .7; step++) cell /= 2
  return cell
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
