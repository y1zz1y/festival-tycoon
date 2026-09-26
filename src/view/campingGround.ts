/** Exterior of the complete area, excluding internal tile seams and enclosed holes. */
export function campingBoundary(cells: readonly { x: number; z: number }[]): Array<{ x: number; z: number; direction: number }> {
  if (!cells.length) return []
  const unique: Array<{ x: number; z: number }> = []
  const occupied = new Set<string>()
  for (const cell of cells) {
    const key = `${cell.x},${cell.z}`
    if (occupied.has(key)) continue
    occupied.add(key)
    unique.push(cell)
  }
  const minX = Math.min(...unique.map(c => c.x)) - 1, maxX = Math.max(...unique.map(c => c.x)) + 1
  const minZ = Math.min(...unique.map(c => c.z)) - 1, maxZ = Math.max(...unique.map(c => c.z)) + 1
  const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const
  const outside = new Set([`${minX},${minZ}`]), queue = [{ x: minX, z: minZ }]
  for (let head = 0; head < queue.length; head++) for (const [dx, dz] of directions) {
    const x = queue[head]!.x + dx, z = queue[head]!.z + dz, key = `${x},${z}`
    if (x < minX || x > maxX || z < minZ || z > maxZ || occupied.has(key) || outside.has(key)) continue
    outside.add(key); queue.push({ x, z })
  }
  return unique.flatMap(cell => directions.flatMap(([dx, dz], direction) => outside.has(`${cell.x + dx},${cell.z + dz}`) ? [{ ...cell, direction }] : []))
}
