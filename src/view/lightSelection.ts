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
}

const projection = new Matrix4()

/** The view for this frame, from a camera whose matrices are current. */
export function lightViewOf(camera: Camera, focus: Vector3, into: LightView = { frustum: new Frustum(), focus: new Vector3() }): LightView {
  camera.updateMatrixWorld()
  projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  into.frustum.setFromProjectionMatrix(projection)
  into.focus.copy(focus)
  return into
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
