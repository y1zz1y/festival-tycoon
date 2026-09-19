import {
  COURSE_PIECE_CATALOG,
  COURSE_PIECE_COST,
  COURSE_PIECE_ICONS,
  COURSE_PIECE_LABELS,
  COURSE_SPECS,
  courseBuilderHint,
  coursePaintMode,
  courseTeamSize,
  courseTrackEnd,
  isCourseTrackPiece,
  validateCourse,
  type CourseAreaCell,
  type CourseAttraction,
  type CourseKind,
  type CoursePieceKind,
} from '../game/courseAttractions'

export type CourseBuilderState = {
  kind: CourseKind
  course: CourseAttraction | null
  selectedKind: CourseBuilderTool
  elevation: number
}

export type CourseBuilderTool = CoursePieceKind | 'area' | 'areaErase'

export function orderedCourseLineTargets(
  course: CourseAttraction,
  cells: readonly CourseAreaCell[],
): CourseAreaCell[] | string {
  const end = courseTrackEnd(course)
  if (!end) return 'Setze zuerst den Eingang der Strecke.'
  if (cells.length === 0) return []
  const key = (cell: CourseAreaCell): string => `${cell.x}:${cell.z}`
  const endKey = key(end)
  let ordered = cells.map((cell) => ({ x: cell.x, z: cell.z }))
  if (ordered.length === 1 && key(ordered[0]!) !== endKey) {
    ordered.unshift({ x: end.x, z: end.z })
  } else if (key(ordered[0]!) !== endKey && key(ordered.at(-1)!) === endKey) {
    ordered = ordered.reverse()
  }
  if (key(ordered[0]!) !== endKey) {
    return `Ziehe die Strecke ab dem Streckenende ${end.x}/${end.z}.`
  }
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]!
    const current = ordered[index]!
    if (Math.abs(current.x - previous.x) + Math.abs(current.z - previous.z) !== 1) {
      return 'Die Strecke muss Feld für Feld ohne Sprünge gebaut werden.'
    }
  }
  return ordered.slice(1)
}

export function defaultCoursePiece(kind: CourseKind): CourseBuilderTool {
  if (kind === 'pool' || kind === 'paintball') return 'area'
  return COURSE_PIECE_CATALOG[kind][0] ?? 'entrance'
}

export function courseBuilderTitle(kind: CourseKind, course: CourseAttraction | null): string {
  return course ? `${course.name} Konstruktion` : `${COURSE_SPECS[kind].name} bauen`
}

export function courseBuilderStatus(state: CourseBuilderState): string {
  if (!state.course) {
    return state.kind === 'paintball'
      ? 'Klicke oder ziehe, um das Spielfeld zu markieren.'
      : 'Klicke auf das Gelände, um den Eingang zu setzen.'
  }
  const issue = validateCourse(state.course)
  if (issue) return issue
  const end = courseTrackEnd(state.course)
  return end
    ? `${state.course.pieces.length} Stücke · Streckenende ${end.x}/${end.z} auf Ebene ${end.elevation}`
    : `${state.course.areaCells.length} Felder · bereit zum Öffnen`
}

export function coursePaletteHtml(kind: CourseKind, selected: CourseBuilderTool): string {
  const areaButton =
    kind === 'pool' || kind === 'paintball'
      ? `<button type="button" class="tool${selected === 'area' ? ' active' : ''}" data-course-piece="area" title="Fläche ziehen">
          <span>${kind === 'pool' ? '🏊' : '🟩'}</span>
          <strong>Anlagenfläche</strong>
          <small>${COURSE_PIECE_COST[kind === 'pool' ? 'poolBasin' : 'paintballField']} €/Feld</small>
        </button>
        <button type="button" class="tool${selected === 'areaErase' ? ' active' : ''}" data-course-piece="areaErase" title="Fläche entfernen">
          <span>✂️</span>
          <strong>Fläche entfernen</strong>
          <small>Fläche ziehen</small>
        </button>`
      : ''
  const pieces = COURSE_PIECE_CATALOG[kind].filter(
    (piece) => piece !== 'paintballField',
  )
  return areaButton + pieces
    .map((piece) => {
      const cost = COURSE_PIECE_COST[piece]
      const paint = coursePaintMode(piece)
      const hint = paint === 'area' ? 'Fläche ziehen' : paint === 'line' ? 'Weg ziehen' : 'Klicken'
      return `<button type="button" class="tool${piece === selected ? ' active' : ''}" data-course-piece="${piece}" title="${hint}">
        <span>${COURSE_PIECE_ICONS[piece]}</span>
        <strong>${COURSE_PIECE_LABELS[piece]}</strong>
        <small>${cost ? `${cost} €${isCourseTrackPiece(kind, piece) ? '/Feld' : ''}` : hint}</small>
      </button>`
    })
    .join('')
}

export function renderCourseBuilderPanel(
  root: HTMLElement,
  state: CourseBuilderState,
): void {
  root.classList.add('visible')
  const name = root.querySelector('#course-builder-name')
  const status = root.querySelector('#course-builder-status')
  const hint = root.querySelector('#course-builder-hint')
  const palette = root.querySelector('#course-piece-palette')
  const elevation = root.querySelector('#course-elevation-label')
  const teamSection = root.querySelector<HTMLElement>('#course-team-section')
  const teamInput = root.querySelector<HTMLInputElement>('#course-team-size')
  const operating = root.querySelector<HTMLButtonElement>('#course-toggle-operating')
  const undo = root.querySelector<HTMLButtonElement>('#course-undo')
  if (name) name.textContent = courseBuilderTitle(state.kind, state.course)
  if (status) status.textContent = courseBuilderStatus(state)
  if (hint) hint.textContent = courseBuilderHint(state.kind)
  if (palette) palette.innerHTML = coursePaletteHtml(state.kind, state.selectedKind)
  if (elevation) elevation.textContent = String(state.elevation)
  if (teamSection) teamSection.hidden = state.kind !== 'paintball'
  if (teamInput && state.course) teamInput.value = String(courseTeamSize(state.course))
  if (operating) {
    const issue = state.course ? validateCourse(state.course) : 'Noch kein Kurs.'
    operating.disabled = !state.course || Boolean(issue)
    operating.textContent = state.course?.operating ? 'Schließen' : 'Öffnen'
  }
  if (undo) {
    undo.disabled =
      !state.course ||
      (state.course.pieces.length === 0 && state.course.areaCells.length === 0)
  }
}
