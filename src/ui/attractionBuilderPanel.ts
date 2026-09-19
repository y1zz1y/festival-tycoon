import { validateAttractionCompletion } from '../game/attractions/construction'
import { getAttractionDefinition } from '../game/attractions/definitions'
import { openTrackNodeIds } from '../game/attractions/trackGraph'
import type {
  Attraction,
  TrackEdge,
  TrackNode,
} from '../game/attractions/types'

export type AttractionBuilderMode =
  | 'track'
  | 'trackDelete'
  | 'areaAdd'
  | 'areaErase'
  | 'reference'
  | 'entrance'
  | 'exit'
  | 'scripted'

export type AttractionBuilderState = {
  attraction: Attraction
  mode: AttractionBuilderMode
  selectedKind: string
  direction: 0 | 1 | 2 | 3
  elevationDelta: -1 | -0.5 | 0 | 0.5 | 1
  banking: -1 | 0 | 1
}

export function attractionBuilderStatus(state: AttractionBuilderState): string {
  const { attraction } = state
  const validation = validateAttractionCompletion(attraction)
  if (attraction.layout.kind === 'track') {
    const open = openTrackNodeIds(attraction.layout.graph).length
    return validation.ok
      ? `${attraction.layout.graph.edges.length} Streckenteile · bereit für Test oder Öffnung`
      : `${attraction.layout.graph.edges.length} Streckenteile · ${open} offene Enden · ${validation.messages[0]}`
  }
  if (attraction.layout.kind === 'area') {
    return validation.ok
      ? `${attraction.layout.cells.length} Felder · ${attraction.layout.references.length} Objekte`
      : `${attraction.layout.cells.length} Felder · ${validation.messages[0]}`
  }
  return `${attraction.layout.segments.length} Bauteile${validation.ok ? ' · bereit' : ` · ${validation.messages[0]}`}`
}

export function attractionPaletteHtml(state: AttractionBuilderState): string {
  const definition = getAttractionDefinition(state.attraction.definitionId)
  if (!definition) return ''
  const buttons: string[] = []
  if (definition.layoutKind === 'area') {
    buttons.push(button('areaAdd', 'Fläche', '▦', state.mode === 'areaAdd'))
    buttons.push(button('areaErase', 'Fläche entfernen', '✂', state.mode === 'areaErase'))
    definition.allowedReferences?.forEach((kind) => {
      buttons.push(button(kind, label(kind), icon(kind), state.mode === 'reference' && state.selectedKind === kind))
    })
  } else {
    definition.pieceKinds.forEach((kind) => {
      buttons.push(button(kind, label(kind), icon(kind), state.selectedKind === kind))
    })
    if (definition.layoutKind === 'track') {
      buttons.push(button('rotateDirection', 'Richtung drehen', '↻', false))
      if (state.attraction.layout.kind === 'track' && state.attraction.layout.agentKind === 'vehicle') {
        buttons.push(button('bankLeft', 'Banking links', '◢', state.banking === -1))
        buttons.push(button('bankFlat', 'Ohne Banking', '━', state.banking === 0))
        buttons.push(button('bankRight', 'Banking rechts', '◣', state.banking === 1))
      }
      buttons.push(button('trackDelete', 'Streckenteil löschen', '✂', state.mode === 'trackDelete'))
    }
  }
  if (definition.accessMode !== 'free') {
    buttons.push(button('entrance', 'Eingang', '🚪', state.mode === 'entrance'))
    if (state.attraction.layout.kind !== 'track' || state.attraction.layout.topology !== 'openExit') {
      buttons.push(button('exit', 'Ausgang', '🚶', state.mode === 'exit'))
    }
  }
  return buttons.join('')
}

export function renderAttractionBuilderPanel(
  root: HTMLElement,
  state: AttractionBuilderState,
): void {
  root.classList.add('visible')
  root.dataset.attractionLayout = state.attraction.layout.kind
  const name = root.querySelector<HTMLElement>('[data-attraction-name], #course-builder-name, #coaster-construction-title')
  const status = root.querySelector<HTMLElement>('[data-attraction-status], #course-builder-status, #coaster-status')
  const palette = root.querySelector<HTMLElement>('[data-attraction-palette], #course-piece-palette, #track-selection')
  if (name) name.textContent = `${state.attraction.name} Konstruktion`
  if (status) status.textContent = attractionBuilderStatus(state)
  if (palette) palette.innerHTML = attractionPaletteHtml(state)
  const completion = validateAttractionCompletion(state.attraction)
  root.querySelectorAll<HTMLButtonElement>('[data-attraction-finish], #finish-course-builder')
    .forEach((element) => { element.disabled = !completion.ok })
}

export function nextTrackEdge(
  state: AttractionBuilderState,
  edgeId: string,
  nodeId: string,
): { edge: TrackEdge; from: TrackNode; to: TrackNode } | string {
  const layout = state.attraction.layout
  if (layout.kind !== 'track') return 'Diese Attraktion besitzt keine Strecke.'
  const from = layout.graph.nodes.find((node) => node.id === layout.selectedOpenNodeId)
  if (!from && layout.graph.edges.length > 0) return 'Wähle zuerst ein offenes Streckenende.'
  const start = from ?? {
    id: `${nodeId}-start`,
    anchor: {
      x: state.attraction.access.entrance?.x ?? 0,
      z: state.attraction.access.entrance?.z ?? 0,
      elevation: state.attraction.access.entrance?.elevation ?? 0,
      heading: state.direction * Math.PI / 2,
      pitch: 0,
      bank: state.banking * Math.PI / 6,
    },
  }
  const vector = directionVector(state.direction)
  const end: TrackNode = {
    id: nodeId,
    anchor: {
      x: start.anchor.x + vector.x,
      z: start.anchor.z + vector.z,
      elevation: start.anchor.elevation + state.elevationDelta,
      heading: state.direction * Math.PI / 2,
      pitch: Math.atan2(state.elevationDelta, 1),
      bank: state.banking * Math.PI / 6,
    },
  }
  return {
    from: start,
    to: end,
    edge: {
      id: edgeId,
      kind: state.selectedKind,
      fromNodeId: start.id,
      toNodeId: end.id,
      points: [
        {
          x: start.anchor.x,
          z: start.anchor.z,
          elevation: start.anchor.elevation,
          heading: start.anchor.heading,
        },
        {
          x: end.anchor.x,
          z: end.anchor.z,
          elevation: end.anchor.elevation,
          heading: end.anchor.heading,
        },
      ],
      cost: 0,
      metadata: {
        banking: state.banking,
        elevationDelta: state.elevationDelta,
      },
    },
  }
}

function button(value: string, text: string, glyph: string, active: boolean): string {
  return `<button type="button" class="tool${active ? ' active' : ''}" data-attraction-piece="${value}">
    <span>${glyph}</span><strong>${text}</strong>
  </button>`
}

function directionVector(direction: number): { x: number; z: number } {
  return [
    { x: 0, z: -1 },
    { x: 1, z: 0 },
    { x: 0, z: 1 },
    { x: -1, z: 0 },
  ][direction]
}

function label(kind: string): string {
  return kind
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase())
}

function icon(kind: string): string {
  if (kind.includes('water') || kind === 'water') return '💧'
  if (kind.includes('tree')) return '🌲'
  if (kind.includes('Start')) return '🚩'
  if (kind === 'cover') return '🧱'
  if (kind === 'station') return '🚉'
  if (kind === 'path' || kind === 'straight') return '━'
  return '◆'
}
