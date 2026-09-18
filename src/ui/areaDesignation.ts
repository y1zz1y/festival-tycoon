export type AreaPoint = { x: number; z: number }

export type NormalizedRectangle = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export type AreaDesignationSelection<Point extends AreaPoint = AreaPoint> = {
  /** Original drag anchor; domain rules may depend on it (for example flatten height). */
  from: Point
  to: Point
  rectangle: NormalizedRectangle
}

export type AreaDesignationSpec<Point extends AreaPoint = AreaPoint> = {
  preview(selection: AreaDesignationSelection<Point>): void
  execute(selection: AreaDesignationSelection<Point>): void
}

/** Existing WorldView callback shape, centralized for all rectangle tools. */
export type AreaDesignationHandler<Point extends AreaPoint = AreaPoint> =
  (from: Point, to: Point, preview: boolean) => void

export function normalizeRectangle(from: AreaPoint, to: AreaPoint): NormalizedRectangle {
  return {
    minX: Math.min(from.x, to.x),
    maxX: Math.max(from.x, to.x),
    minZ: Math.min(from.z, to.z),
    maxZ: Math.max(from.z, to.z),
  }
}

export function areaSelection<Point extends AreaPoint>(
  from: Point,
  to: Point,
): AreaDesignationSelection<Point> {
  return { from, to, rectangle: normalizeRectangle(from, to) }
}

export function createAreaDesignationHandler<Point extends AreaPoint>(
  spec: AreaDesignationSpec<Point>,
): AreaDesignationHandler<Point> {
  return (from, to, preview) => {
    const selection = areaSelection(from, to)
    if (preview) spec.preview(selection)
    else spec.execute(selection)
  }
}
