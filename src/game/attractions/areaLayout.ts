import { getAttractionDefinition } from './definitions'
import type {
  AreaCell,
  AreaLayout,
  AreaReference,
  Attraction,
  AttractionPoint,
} from './types'

export type AreaValidationIssue = {
  code: 'empty' | 'disconnected' | 'access-off-boundary' | 'reference-outside' | 'reference-forbidden'
  message: string
  referenceId?: string
}

export function areaCellKey(cell: Pick<AreaCell, 'x' | 'z' | 'elevation'>): string {
  return `${cell.x}:${cell.z}:${cell.elevation}`
}

export function normalizeAreaCells(cells: readonly AreaCell[]): AreaCell[] {
  const unique = new Map<string, AreaCell>()
  cells.forEach((cell) => {
    if (!Number.isFinite(cell.x) || !Number.isFinite(cell.z) || !Number.isFinite(cell.elevation)) return
    const normalized = {
      x: Math.round(cell.x),
      z: Math.round(cell.z),
      elevation: Math.round(cell.elevation * 2) / 2,
    }
    unique.set(areaCellKey(normalized), normalized)
  })
  return [...unique.values()].sort((a, b) =>
    a.elevation - b.elevation || a.z - b.z || a.x - b.x,
  )
}

export function addAreaCells(layout: AreaLayout, cells: readonly AreaCell[]): AreaLayout {
  return { ...layout, cells: normalizeAreaCells([...layout.cells, ...cells]) }
}

export function removeAreaCells(layout: AreaLayout, cells: readonly AreaCell[]): AreaLayout {
  const removed = new Set(cells.map(areaCellKey))
  const retained = layout.cells.filter((cell) => !removed.has(areaCellKey(cell)))
  const retainedKeys = new Set(retained.map(areaCellKey))
  return {
    ...layout,
    cells: retained,
    references: layout.references.filter((reference) =>
      retainedKeys.has(areaCellKey(reference)),
    ),
    visitorInstallations: layout.visitorInstallations.filter((installation) =>
      retainedKeys.has(areaCellKey(installation.cell)),
    ),
  }
}

export function areaComponents(cells: readonly AreaCell[]): AreaCell[][] {
  const byKey = new Map(cells.map((cell) => [areaCellKey(cell), cell]))
  const unseen = new Set(byKey.keys())
  const components: AreaCell[][] = []
  while (unseen.size > 0) {
    const first = unseen.values().next().value as string
    const queue = [first]
    const component: AreaCell[] = []
    unseen.delete(first)
    while (queue.length > 0) {
      const key = queue.shift()!
      const cell = byKey.get(key)
      if (!cell) continue
      component.push(cell)
      for (const neighbor of orthogonalNeighbors(cell)) {
        const neighborKey = areaCellKey(neighbor)
        if (unseen.delete(neighborKey)) queue.push(neighborKey)
      }
    }
    components.push(component)
  }
  return components
}

export function isAreaBoundaryCell(layout: AreaLayout, point: AttractionPoint): boolean {
  const keys = new Set(layout.cells.map(areaCellKey))
  const cell = layout.cells.find((candidate) =>
    candidate.x === point.x &&
    candidate.z === point.z &&
    candidate.elevation === point.elevation,
  )
  return Boolean(cell && orthogonalNeighbors(cell).some((neighbor) => !keys.has(areaCellKey(neighbor))))
}

export function canPlaceAreaReference(
  attraction: Attraction,
  reference: AreaReference,
): { ok: boolean; message: string } {
  if (attraction.layout.kind !== 'area') {
    return { ok: false, message: 'Diese Attraktion besitzt keine Fläche.' }
  }
  const definition = getAttractionDefinition(attraction.definitionId)
  if (!definition?.allowedReferences?.includes(reference.kind)) {
    return { ok: false, message: 'Dieses Objekt ist auf der Fläche nicht erlaubt.' }
  }
  if (!attraction.layout.cells.some((cell) => areaCellKey(cell) === areaCellKey(reference))) {
    return { ok: false, message: 'Das Objekt muss innerhalb der Attraktionsfläche liegen.' }
  }
  return { ok: true, message: '' }
}

export function placeAreaReference(
  attraction: Attraction,
  reference: AreaReference,
): Attraction {
  const result = canPlaceAreaReference(attraction, reference)
  if (!result.ok || attraction.layout.kind !== 'area') throw new Error(result.message)
  return {
    ...attraction,
    layout: {
      ...attraction.layout,
      references: [
        ...attraction.layout.references.filter((candidate) => candidate.id !== reference.id),
        reference,
      ],
    },
  }
}

export function validateAreaAttraction(attraction: Attraction): AreaValidationIssue[] {
  if (attraction.layout.kind !== 'area') return []
  const definition = getAttractionDefinition(attraction.definitionId)
  const issues: AreaValidationIssue[] = []
  if (attraction.layout.cells.length === 0) {
    issues.push({ code: 'empty', message: 'Die Attraktionsfläche ist leer.' })
  }
  if (definition?.requiresConnectedArea && areaComponents(attraction.layout.cells).length > 1) {
    issues.push({ code: 'disconnected', message: 'Die Attraktionsfläche muss zusammenhängend sein.' })
  }
  if (attraction.layout.accessMode !== 'free') {
    for (const point of [attraction.access.entrance, attraction.access.exit]) {
      if (point && !isAreaBoundaryCell(attraction.layout, point)) {
        issues.push({
          code: 'access-off-boundary',
          message: 'Ein- und Ausgang müssen am Rand der Fläche liegen.',
        })
      }
    }
  }
  attraction.layout.references.forEach((reference) => {
    const result = canPlaceAreaReference(attraction, reference)
    if (result.ok) return
    issues.push({
      code: result.message.includes('nicht erlaubt') ? 'reference-forbidden' : 'reference-outside',
      message: result.message,
      referenceId: reference.id,
    })
  })
  return issues
}

export function connectedWaterCells(
  attractions: readonly Attraction[],
): Set<string> {
  const cells = attractions.flatMap((attraction) =>
    attraction.definitionId === 'swimArea' && attraction.layout.kind === 'area'
      ? attraction.layout.cells
      : [],
  )
  return new Set(cells.map(areaCellKey))
}

function orthogonalNeighbors(cell: AreaCell): AreaCell[] {
  return [
    { ...cell, x: cell.x + 1 },
    { ...cell, x: cell.x - 1 },
    { ...cell, z: cell.z + 1 },
    { ...cell, z: cell.z - 1 },
  ]
}
