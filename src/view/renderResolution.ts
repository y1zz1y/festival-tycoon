/**
 * Keep the same logical pixel canvas at Full HD, 4K and high-DPI browser zoom.
 * `scale` is the player's resolution level: 0.75 draws coarser pixels, 1.5 finer ones,
 * never more than the display has.
 */
export function scenePixelRatio(width: number, height: number, scale = 1, devicePixelRatio = Number.POSITIVE_INFINITY): number {
  if (width <= 0 || height <= 0) return Math.min(0.75 * scale, devicePixelRatio)
  return Math.min(0.75 * scale, (1440 * scale) / width, (810 * scale) / height, devicePixelRatio)
}
