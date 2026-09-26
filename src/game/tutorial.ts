import type { GameSnapshot } from './types/snapshot'

/**
 * The first-steps scenario (A9): a small flat site and a checklist that ticks itself
 * off from the snapshot, so it works the same on every client and after a reload and
 * needs no saved state of its own.
 */
export const TUTORIAL_PRESET_ID = 'einstieg'
/** Path fields that have to hang together with the entrance for the first step. */
export const TUTORIAL_PATH_FIELDS = 6

export type TutorialStep = { id: string; title: string; hint: string; done: boolean }

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
      title: 'Weg vom Eingang ins Gelände',
      hint: `Bauen → Wege: vom Eingang am Kartenrand einen Weg ziehen, mindestens ${TUTORIAL_PATH_FIELDS} Felder.`,
      done: pathFieldsFromEntrance(s) >= TUTORIAL_PATH_FIELDS,
    },
    {
      id: 'stage',
      title: 'Bühne mit Strom',
      hint: 'Festival → Festivalbühne setzen und einen Bühnenvorplatz ausweisen; unter Logistik → Strom einen Generator bauen und per Kabel mit der Bühne verbinden.',
      done: poweredStage,
    },
    {
      id: 'stands',
      title: 'Imbiss und Toilette',
      hint: 'Attraktionen → Stände: einen Imbiss und eine Toilette an den Weg stellen.',
      done: kinds.has('food') && kinds.has('toilet'),
    },
    {
      id: 'band',
      title: 'Eine Band buchen',
      hint: 'Festivalfenster → Programm: eine Band auf einen freien Zeitblock der Bühne ziehen.',
      done: started || s.festival.bookings.length > 0,
    },
    {
      id: 'start',
      title: 'Festival starten',
      hint: 'Festivalfenster: „Festival starten“. Ab jetzt kommen Gäste.',
      done: started,
    },
  ]
}
