import type { GameSnapshot } from './GameState'
import { isDecorationCatalogKind } from './decoration'
import { getTerrainHeight } from './terrain'

/** Select only the current build category, with explicit identity/layer for network commands. */
export function contextDemolitionTarget(snapshot: Readonly<GameSnapshot>, tool: string,
  cell: { x: number; z: number }, pickedId?: string) {
  const elevation = getTerrainHeight(snapshot.terrain, cell.x, cell.z) + snapshot.buildElevation
  if (tool === 'road') {
    const roads = snapshot.logistics.roadCells.filter(r => r.x === cell.x && r.z === cell.z)
    const road = roads.find(r => Math.abs((r.elevation ?? getTerrainHeight(snapshot.terrain, r.x, r.z)) - elevation) < .01)
      ?? roads.sort((a, b) => (b.elevation ?? 0) - (a.elevation ?? 0))[0]
    return road ? { type: 'road' as const, road } : undefined
  }
  if (tool !== 'path' && !isDecorationCatalogKind(tool)) return undefined
  const hit = pickedId ? snapshot.buildings.find(b => b.id === pickedId) : undefined
  const building = hit && (tool === 'path' ? hit.kind === 'path' : isDecorationCatalogKind(hit.kind)) ? hit :
    tool === 'path' ? snapshot.buildings.find(b => b.kind === 'path' && b.x === cell.x && b.z === cell.z && Math.abs(b.elevation - elevation) < .01) : undefined
  return building ? { type: 'building' as const, building } : undefined
}
