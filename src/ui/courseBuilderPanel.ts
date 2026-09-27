import { formatMoney, joinParts, localize, localizeName, plural, t } from '../i18n'
import {
  COURSE_PIECE_CATALOG,
  COURSE_PIECE_COST,
  COURSE_PIECE_ICONS,
  COURSE_PIECE_LABELS,
  COURSE_SPECS,
  courseNextBuildTarget,
  coursePaintMode,
  courseTeamSize,
  courseTrackEnd,
  courseUsesDirectionArrows,
  isCourseTrackPiece,
  listCourseDirectionChoices,
  validateCourse,
  type CourseAreaCell,
  type CourseAttraction,
  type CourseDirectionChoice,
  type CourseKind,
  type CoursePieceKind,
} from '../game/courseAttractions'
import { courseBuilderHint } from '../game/courseAttractionText'

export type CourseBuilderState = {
  kind: CourseKind
  course: CourseAttraction | null
  selectedKind: CourseBuilderTool
  elevation: number
  buildRotation: number
  cameraQuarter: number
}

export type CourseBuilderTool = CoursePieceKind | 'area' | 'areaErase'

export function orderedCourseLineTargets(
  course: CourseAttraction,
  cells: readonly CourseAreaCell[],
): CourseAreaCell[] | string {
  const end = courseTrackEnd(course)
  if (!end) return t('Setze zuerst den Eingang der Strecke.')
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
    return t`Ziehe die Strecke ab dem Streckenende ${end.x}/${end.z}.`
  }
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]!
    const current = ordered[index]!
    if (Math.abs(current.x - previous.x) + Math.abs(current.z - previous.z) !== 1) {
      return t('Die Strecke muss Feld für Feld ohne Sprünge gebaut werden.')
    }
  }
  return ordered.slice(1)
}

export function defaultCoursePiece(kind: CourseKind): CourseBuilderTool {
  if (kind === 'pool' || kind === 'paintball') return 'area'
  return COURSE_PIECE_CATALOG[kind][0] ?? 'entrance'
}

export function courseBuilderTitle(kind: CourseKind, course: CourseAttraction | null): string {
  return course ? t`${localizeName(course.name)} Konstruktion` : t`${localize(COURSE_SPECS[kind].name)} bauen`
}

export function courseDirectionIcon(rotation: number, cameraQuarter: number): string {
  const icons = ['↙', '↘', '↗', '↖']
  return icons[((rotation - cameraQuarter) % icons.length + icons.length) % icons.length] ?? '◆'
}

export function courseDirectionChoicesForPanel(state: CourseBuilderState): CourseDirectionChoice[] {
  if (!state.course || state.selectedKind === 'area' || state.selectedKind === 'areaErase') return []
  if (!courseUsesDirectionArrows(state.kind)) return []
  return listCourseDirectionChoices(state.course, state.selectedKind, state.elevation)
}

export function syncCourseDirectionGrid(
  root: HTMLElement,
  choices: readonly CourseDirectionChoice[],
  cameraQuarter: number,
): void {
  root.querySelectorAll<HTMLButtonElement>('[data-course-direction]').forEach((button) => {
    const heading = Number(button.dataset.courseDirection)
    const choice = choices.find((entry) => entry.heading === heading)
    const enabled = Boolean(choice?.enabled)
    button.disabled = !enabled
    button.hidden = choices.length === 0
    button.setAttribute('aria-disabled', String(!enabled))
    button.title = enabled
      ? t`Stück nach ${courseDirectionIcon(heading, cameraQuarter)} bauen`
      : choice?.issue ? localize(choice.issue) : t('Diese Richtung ist nicht frei.')
    const icon = button.querySelector('span')
    if (icon) icon.textContent = courseDirectionIcon(heading, cameraQuarter)
  })
}

/** True when the build button can place the selected piece at the open end. */
export function isCourseBuildReady(state: CourseBuilderState): boolean {
  if (!state.course) return false
  if (state.selectedKind === 'area' || state.selectedKind === 'areaErase') return false
  return Boolean(
    courseNextBuildTarget(
      state.course,
      state.selectedKind,
      normalizeCourseRotation(state.buildRotation),
      state.elevation,
    ),
  )
}

export function courseBuilderStatus(state: CourseBuilderState): string {
  if (!state.course) {
    return state.kind === 'paintball'
      ? t('Klicke oder ziehe, um das Spielfeld zu markieren.')
      : state.kind === 'waterSlide'
        ? t('Klicke auf das Gelände, um die erste Leiter zu setzen.')
        : t('Klicke auf das Gelände, um den Eingang zu setzen.')
  }
  const issue = validateCourse(state.course)
  if (issue) return localize(issue)
  const end = courseTrackEnd(state.course)
  const cells = state.course.areaCells.length
  if (!end) return joinParts(plural(cells, t`${cells} Feld`, t`${cells} Felder`), t('bereit zum Öffnen'))
  const arrowHint = courseUsesDirectionArrows(state.kind)
    ? t('Pfeil wählt die nächste freie Richtung')
    : t`Richtung ${courseDirectionIcon(state.buildRotation, state.cameraQuarter)}`
  const pieces = state.course.pieces.length
  return joinParts(
    t`Bauanker: ${end.x}, ${end.z}`,
    t`Höhe ${end.elevation}`,
    arrowHint,
    plural(pieces, t`${pieces} Stück`, t`${pieces} Stücke`),
  )
}

export function normalizeCourseRotation(rotation: number): 0 | 1 | 2 | 3 {
  return (((Math.round(rotation) % 4) + 4) % 4) as 0 | 1 | 2 | 3
}

export function coursePaletteHtml(kind: CourseKind, selected: CourseBuilderTool): string {
  const areaCost = COURSE_PIECE_COST[kind === 'pool' ? 'poolBasin' : 'paintballField']
  const areaButton =
    kind === 'pool' || kind === 'paintball'
      ? `<button type="button" class="tool${selected === 'area' ? ' active' : ''}" data-course-piece="area" title="${t('Fläche ziehen')}">
          <span>${kind === 'pool' ? '🏊' : '🟩'}</span>
          <strong>${t('Anlagenfläche')}</strong>
          <small>${t`${formatMoney(areaCost)}/Feld`}</small>
        </button>
        <button type="button" class="tool${selected === 'areaErase' ? ' active' : ''}" data-course-piece="areaErase" title="${t('Fläche entfernen')}">
          <span>✂️</span>
          <strong>${t('Fläche entfernen')}</strong>
          <small>${t('Fläche ziehen')}</small>
        </button>`
      : ''
  const pieces = COURSE_PIECE_CATALOG[kind].filter(
    (piece) => piece !== 'paintballField',
  )
  return areaButton + pieces
    .map((piece) => {
      const cost = COURSE_PIECE_COST[piece]
      const paint = coursePaintMode(piece)
      const hint = paint === 'area' ? t('Fläche ziehen') : paint === 'line' ? t('Weg ziehen') : t('Klicken')
      return `<button type="button" class="tool${piece === selected ? ' active' : ''}" data-course-piece="${piece}" title="${hint}">
        <span>${COURSE_PIECE_ICONS[piece]}</span>
        <strong>${localize(COURSE_PIECE_LABELS[piece])}</strong>
        <small>${cost ? isCourseTrackPiece(kind, piece) ? t`${formatMoney(cost)}/Feld` : formatMoney(cost) : hint}</small>
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
  const undo = root.querySelector<HTMLButtonElement>('#course-undo')
  const direction = root.querySelector<HTMLElement>('#course-direction')
  const build = root.querySelector<HTMLButtonElement>('#course-build-piece')
  const rotate = root.querySelector<HTMLButtonElement>('#course-rotate')
  const paletteBuild = root.querySelector<HTMLElement>('#course-palette-build')
  const directionGrid = root.querySelector<HTMLElement>('#course-direction-grid')
  const arrows = courseUsesDirectionArrows(state.kind)
  const choices = courseDirectionChoicesForPanel(state)
  root.classList.toggle('course-editor-arrows', arrows)
  root.classList.toggle('course-editor-palette', !arrows)
  if (direction) {
    direction.textContent = courseDirectionIcon(state.buildRotation, state.cameraQuarter)
  }
  if (paletteBuild) paletteBuild.hidden = arrows
  if (rotate) rotate.hidden = arrows
  if (build) {
    build.hidden = arrows
    build.disabled = arrows || !isCourseBuildReady(state)
  }
  if (directionGrid) {
    directionGrid.hidden = !arrows
    syncCourseDirectionGrid(root, choices, state.cameraQuarter)
  }
  if (name) name.textContent = courseBuilderTitle(state.kind, state.course)
  if (status) status.textContent = courseBuilderStatus(state)
  if (hint) hint.textContent = courseBuilderHint(state.kind)
  if (palette) palette.innerHTML = coursePaletteHtml(state.kind, state.selectedKind)
  if (elevation) elevation.textContent = String(state.elevation)
  if (teamSection) teamSection.hidden = state.kind !== 'paintball'
  if (teamInput && state.course) teamInput.value = String(courseTeamSize(state.course))
  if (undo) {
    undo.disabled =
      !state.course ||
      (state.course.pieces.length === 0 && state.course.areaCells.length === 0)
  }
}
