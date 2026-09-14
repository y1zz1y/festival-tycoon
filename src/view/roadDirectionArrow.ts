import { Shape, ShapeGeometry } from 'three'

export type RoadArrowKind = 'paint' | 'overlay'

/**
 * Flat lane arrow, tip toward +Z after rotateX(-π/2).
 * `paint` is the StVO mark on asphalt. `overlay` is a shorter, even-weight
 * chevron for the tool preview and the moving direction overlay.
 */
export function createRoadDirectionArrowGeometry(
  kind: RoadArrowKind = 'paint',
): ShapeGeometry {
  const shape = new Shape()
  if (kind === 'overlay') {
    shape.moveTo(0, -0.3)
    shape.lineTo(-0.15, -0.02)
    shape.lineTo(-0.075, -0.02)
    shape.lineTo(-0.075, 0.26)
    shape.lineTo(0.075, 0.26)
    shape.lineTo(0.075, -0.02)
    shape.lineTo(0.15, -0.02)
  } else {
    shape.moveTo(0, -0.4)
    shape.lineTo(-0.2, -0.06)
    shape.lineTo(-0.09, -0.06)
    shape.lineTo(-0.09, 0.38)
    shape.lineTo(0.09, 0.38)
    shape.lineTo(0.09, -0.06)
    shape.lineTo(0.2, -0.06)
  }
  shape.closePath()
  const geometry = new ShapeGeometry(shape)
  geometry.rotateX(-Math.PI / 2)
  geometry.computeBoundingBox()
  return geometry
}
