/**
 * Construction chrome for track-led attractions.
 *
 * `palette` is the RCT2 window (piece family + large “Dies bauen”).
 * `directionArrows` is the path-style neighbor menu: only legal, still-empty
 * headings show a clickable arrow that places the next piece.
 */
export const TRACK_EDITOR_MODES = ['palette', 'directionArrows'] as const

export type TrackEditorMode = (typeof TRACK_EDITOR_MODES)[number]

export function resolveTrackEditorMode(mode: TrackEditorMode | undefined): TrackEditorMode {
  return mode ?? 'palette'
}

export function trackEditorUsesDirectionArrows(mode: TrackEditorMode | undefined): boolean {
  return resolveTrackEditorMode(mode) === 'directionArrows'
}
