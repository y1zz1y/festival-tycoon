import { BufferGeometry, Float32BufferAttribute } from 'three'
/**
 * The flat arrow used wherever a direction has to be shown on the ground: one-way road markings
 * and logistics flow markers in LogisticsView, and the build preview's heading in WorldView.
 *
 * It lies in the XZ plane pointing along +Z, so callers only ever spin it about Y by the angle of
 * the direction they mean (see DIRECTION_ANGLE), and it is built to fill roughly one cell at scale
 * 1 — road markings shrink it, the road-direction tool blows it up a little. Being flat, it is
 * drawn a hair above whatever it marks rather than sunk into it.
 */
export function createRoadDirectionArrowGeometry(): BufferGeometry {
  const positions = [
    -0.075, 0, -0.34, // shaft, back left
    0.075, 0, -0.34, // shaft, back right
    0.075, 0, 0.08, // shaft, front right
    -0.075, 0, 0.08, // shaft, front left
    -0.21, 0, 0.08, // head, left barb
    0.21, 0, 0.08, // head, right barb
    0, 0, 0.38, // head, tip
  ]
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute(
    'normal',
    new Float32BufferAttribute(Array.from({ length: positions.length / 3 }, () => [0, 1, 0]).flat(), 3),
  )
  geometry.setIndex([0, 2, 1, 0, 3, 2, 4, 6, 5]) // wound so the faces look up
  return geometry
}
