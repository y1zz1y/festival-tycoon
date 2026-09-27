// i18n: client-text
import type { GameSnapshot } from './types/snapshot'
import { t } from '../i18n'

/**
 * The first-steps scenario (A9): a small flat site and a checklist that ticks itself
 * off from the snapshot, so it works the same on every client and after a reload and
 * needs no saved state of its own.
 */
export const TUTORIAL_PRESET_ID = 'einstieg'
/** Path fields that have to hang together with the entrance for the first step. */
export const TUTORIAL_PATH_FIELDS = 6

/**
 * Where the next click of an open step goes, as a path through the UI: a build tool
 * (toolbar category → group tab → tool) or the festival window (open → tab → button).
 * The checklist highlights the first part of the path that is not open yet.
 */
export type TutorialTarget =
  | { kind: 'build'; category: string; group: string; tool: string }
  | { kind: 'festival'; tab: string; action?: string }

export type TutorialStep = { id: string; title: string; hint: string; done: boolean; target?: TutorialTarget }

/** Next build action of the stage step: stage, then a generator, then the cable. */
function stageTarget(s: Readonly<GameSnapshot>, kinds: ReadonlySet<string>): TutorialTarget {
  if (!kinds.has('stage')) return { kind: 'build', category: 'attractions', group: 'festival', tool: 'stage' }
  const generator = s.buildings.some((building) => building.kind === 'generator' || building.kind === 'backupGenerator')
  return { kind: 'build', category: 'logistics', group: 'power', tool: generator ? 'powerCable' : 'generator' }
}

/** Path fields reachable from the entrance, walking from path to neighbouring path. */
export function pathFieldsFromEntrance(s: Readonly<GameSnapshot>): number {
  const paths = new Map<string, { x: number; z: number }>()
  for (const building of s.buildings) {
    if (building.kind === 'path' && building.pathType !== 'queue' && !building.staffOnly) paths.set(`${building.x}:${building.z}`, building)
  }
  const entrance = s.buildings.find((building) => building.id === 'entrance-path')
  if (!entrance || !paths.has(`${entrance.x}:${entrance.z}`)) return 0
  const seen = new Set([`${entrance.x}:${entrance.z}`])
  const queue: Array<{ x: number; z: number }> = [entrance]
  while (queue.length > 0) {
    const cell = queue.pop()!
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const key = `${cell.x + dx}:${cell.z + dz}`
      const next = paths.get(key)
      if (!next || seen.has(key)) continue
      seen.add(key)
      queue.push(next)
    }
  }
  return seen.size
}

export function tutorialSteps(s: Readonly<GameSnapshot>): TutorialStep[] {
  const started = s.festival.edition >= 1
  const kinds = new Set(s.buildings.map((building) => building.kind))
  const poweredStage = s.buildings.some((building) => building.kind === 'stage' && s.power.poweredBuildingIds.includes(building.id))
  return [
    {
      id: 'path',
      title: t('Weg vom Eingang ins Gelände'),
      hint: t`Bauen → Wege: vom Eingangstor mit dem roten 🚶-Banner am Kartenrand einen Weg ziehen, mindestens ${TUTORIAL_PATH_FIELDS} Felder.`,
      done: pathFieldsFromEntrance(s) >= TUTORIAL_PATH_FIELDS,
      target: { kind: 'build', category: 'paths', group: 'main', tool: 'path' },
    },
    {
      id: 'stage',
      title: t('Bühne mit Strom'),
      hint: t('Festival → Festivalbühne setzen und einen Bühnenvorplatz ausweisen; unter Logistik → Strom einen Generator bauen und per Kabel mit der Bühne verbinden.'),
      done: poweredStage,
      target: stageTarget(s, kinds),
    },
    {
      id: 'stands',
      title: t('Imbiss und Toilette'),
      hint: t('Attraktionen → Stände: einen Imbiss und eine Toilette an den Weg stellen.'),
      done: kinds.has('food') && kinds.has('toilet'),
      target: { kind: 'build', category: 'attractions', group: 'stalls', tool: kinds.has('food') ? 'toilet' : 'food' },
    },
    {
      id: 'band',
      title: t('Eine Band buchen'),
      hint: t('Festivalfenster → Programm: eine Band auf einen freien Zeitblock der Bühne ziehen.'),
      done: started || s.festival.bookings.length > 0,
      target: { kind: 'festival', tab: 'lineup' },
    },
    {
      id: 'start',
      title: t('Festival starten'),
      hint: t('Festivalfenster: „Festival starten“. Ab jetzt kommen Gäste.'),
      done: started,
      target: { kind: 'festival', tab: 'overview', action: 'start' },
    },
  ]
}
