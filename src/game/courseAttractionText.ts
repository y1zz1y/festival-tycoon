// i18n: client-text
/**
 * Course display text for the entity panel and the course builder (docs/i18n.md,
 * client-text modules). Built on each client in the viewer's language with `t()`;
 * canonical game text from `courseAttractions.ts` (issues, default names) goes through
 * `localize()` / `localizeName()`. Only UI code and tests import this module.
 */
import {
  formatMoney,
  formatNumber,
  joinParts,
  localize,
  localizeName,
  plural,
  t,
} from '../i18n'
import {
  COURSE_SPECS,
  courseCapacityFor,
  courseHourlyUpkeep,
  courseTeamSize,
  validateCourse,
  type CourseAttraction,
  type CourseKind,
} from './courseAttractions'

export type CourseInspect = {
  icon: string
  typeLabel: string
  name: string
  status: string
  lines: { label: string; value: string }[]
}

function courseStatus(course: CourseAttraction, ridesOfferActive: boolean): string {
  const issue = validateCourse(course)
  if (issue) return localize(issue)
  const typeName = localizeName(COURSE_SPECS[course.kind].name)
  if (!course.operating) return t`${typeName} ist geschlossen.`
  if (!ridesOfferActive) return t('Nach Tagesplan derzeit geschlossen.')
  if (course.kind === 'paintball' && course.match) {
    return joinParts(t('Match läuft'), `${course.match.scoreA}:${course.match.scoreB}`)
  }
  const riders = course.riders.length
  if (riders > 0) return plural(riders, t`${riders} Gast unterwegs`, t`${riders} Gäste unterwegs`)
  return t`${typeName} ist geöffnet.`
}

function hourlyUpkeepText(course: CourseAttraction): string {
  const upkeep = courseHourlyUpkeep(course, false)
  return `${formatMoney(upkeep, Number.isInteger(upkeep) ? 0 : 2)}/h`
}

function courseInspectLines(course: CourseAttraction): CourseInspect['lines'] {
  const lines: CourseInspect['lines'] = [
    { label: t('Betrieb'), value: course.operating ? t('Geöffnet') : t('Geschlossen') },
    { label: t('Stücke'), value: formatNumber(course.pieces.length) },
  ]
  const cells = course.areaCells.length
  if (cells > 0) {
    lines.push({ label: t('Fläche'), value: plural(cells, t`${cells} Feld`, t`${cells} Felder`) })
  }
  lines.push(
    { label: t('Gäste'), value: `${formatNumber(course.riders.length)}/${formatNumber(courseCapacityFor(course))}` },
    { label: t('Warteschlange'), value: formatNumber(course.queue.length) },
    { label: t('Unterhalt'), value: hourlyUpkeepText(course) },
  )
  if (course.kind === 'paintball') {
    lines.push({ label: t('Personen pro Team'), value: formatNumber(courseTeamSize(course)) })
  }
  return lines
}

export function formatCourseInspect(course: CourseAttraction, ridesOfferActive: boolean): CourseInspect {
  const spec = COURSE_SPECS[course.kind]
  return {
    icon: spec.icon,
    typeLabel: localizeName(spec.name),
    name: localizeName(course.name),
    status: courseStatus(course, ridesOfferActive),
    lines: courseInspectLines(course),
  }
}

export function courseBuilderHint(kind: CourseKind): string {
  if (kind === 'mudmasters') {
    return t('Am Streckenende erscheinen Richtungspfeile in noch freie Nachbarfelder. Ein Klick setzt das nächste Stück. Wege lassen sich zusätzlich ziehen; Hindernisse verbinden den bisherigen Endpunkt mit dem neuen. Der Pfad muss am Ausgang enden.')
  }
  if (kind === 'pool') {
    return t('Zuerst die Anlagenfläche ziehen, dann Becken und Zugänge darin setzen. Für Weg und Rutsche zeigen Pfeile die freien Nachbarfelder; der Auslauf muss im Becken landen.')
  }
  if (kind === 'treeToTree') {
    return t('Bäume frei setzen. Am Streckenende zeigen Pfeile freie Nachbarfelder; ein Klick setzt das nächste Stück. Längere Spannweiten weiterhin per Zielbaum. Der Pfad endet am Ausgang.')
  }
  if (kind === 'waterSlide') {
    return t('Die Rutsche beginnt immer mit Leitern. Weitere Leitern auf dieselbe Kachel setzen, um Höhe zu gewinnen. Danach die Rutsche per Richtungspfeil anbauen; das Ende ist der Auslauf mit Wasser, keine Leiter.')
  }
  return t('Zuerst die Spielfläche ziehen. Deckungen und beide Teamstarts kommen hinein; Ein- und Ausgang liegen am Flächenrand.')
}
