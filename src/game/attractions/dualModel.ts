import type { Coaster } from '../coasters'
import type { CourseAttraction } from '../courseAttractions'
import type { PlacedBuilding, Visitor } from '../types/entities'
import type { Attraction } from './types'

/**
 * The attraction dual model (docs/attractions.md, „Doppelmodell"): coasters,
 * courses and `ride` buildings stay the edited and ticked truth, and the
 * canonical `attractions` record with the same id is only a derived projection.
 * Every reader that walks `state.attractions` asks this module whether a record
 * belongs to a live system, so the rule exists exactly once.
 */
type LiveAttractionSources = {
  coasters?: readonly Pick<Coaster, 'id'>[]
  courses?: readonly Pick<CourseAttraction, 'id'>[]
  buildings?: readonly Pick<PlacedBuilding, 'id' | 'kind'>[]
}

type AttractionRecordIdentity = Pick<Attraction, 'id' | 'definitionId' | 'runtime'>

/** Ids `startAttraction` hands out through `nextId('attraction')`: canonical-only records. */
export const CANONICAL_ATTRACTION_ID_PREFIX = 'attraction-'

const SLIDE_MARKER = '-slide-'

/** Definitions whose records only ever exist as the projection of a live system. */
const PROJECTION_DEFINITION_IDS = new Set([
  'waterSlide',
  'paintball',
  'swimArea',
  'camping',
  'partyArea',
])

export type LiveOwnerIds = {
  coasters: ReadonlySet<string>
  courses: ReadonlySet<string>
  rides: ReadonlySet<string>
}

export function liveOwnerIds(state: LiveAttractionSources): LiveOwnerIds {
  const rides = new Set<string>()
  for (const building of state.buildings ?? []) {
    if (building.kind === 'ride') rides.add(building.id)
  }
  return {
    coasters: new Set((state.coasters ?? []).map((coaster) => coaster.id)),
    courses: new Set((state.courses ?? []).map((course) => course.id)),
    rides,
  }
}

/**
 * Ids a dedicated system already drives: coasters (`CoasterSimulation`),
 * courses (`stepCourses`) and `ride` buildings (building pipeline). Pass the
 * set to `isLegacyAttractionId`, which also covers `{poolId}-slide-N`.
 */
export function legacyAttractionIds(state: LiveAttractionSources): Set<string> {
  const ids = new Set<string>()
  for (const coaster of state.coasters ?? []) ids.add(coaster.id)
  for (const course of state.courses ?? []) ids.add(course.id)
  for (const building of state.buildings ?? []) {
    if (building.kind === 'ride') ids.add(building.id)
  }
  return ids
}

export function isLegacyAttractionId(
  id: string,
  legacyIds: ReadonlySet<string> | undefined,
): boolean {
  if (!legacyIds || legacyIds.size === 0) return false
  if (legacyIds.has(id)) return true
  const owner = slideOwnerId(id)
  return owner !== null && legacyIds.has(owner)
}

/** `{poolId}-slide-N` → `poolId`; every other id → `null`. */
export function slideOwnerId(id: string): string | null {
  const index = id.lastIndexOf(SLIDE_MARKER)
  if (index <= 0) return null
  const suffix = id.slice(index + SLIDE_MARKER.length)
  return /^\d+$/.test(suffix) ? id.slice(0, index) : null
}

/**
 * Coaster, course, pool, paintball, water slide, camping and party records are
 * projections by definition. `startAttraction` refuses them: they are built in
 * their own editors or designated as overlays.
 */
export function isProjectionDefinitionId(definitionId: string): boolean {
  return definitionId.startsWith('coaster:') ||
    definitionId.startsWith('course:') ||
    PROJECTION_DEFINITION_IDS.has(definitionId)
}

/**
 * Shape check without a live-array scan: only `startAttraction` ids of a
 * non-projection kind are canonical. Because the refresh drops orphans, every
 * other record is owned by a live system (`isLegacyAttractionId`).
 */
export function isCanonicalAttractionRecord(record: AttractionRecordIdentity): boolean {
  return record.id.startsWith(CANONICAL_ATTRACTION_ID_PREFIX) &&
    !isProjectionDefinitionId(record.definitionId) &&
    record.runtime.kind !== 'coaster' &&
    record.runtime.kind !== 'course'
}

/**
 * Records the canonical attraction commands must never change: everything a
 * live system owns, every projection kind and every ride record the loader
 * migrated from a `ride` building (only `startAttraction` ids are canonical).
 */
export function isDerivedAttractionRecord(
  record: AttractionRecordIdentity,
  legacyIds: ReadonlySet<string>,
): boolean {
  return isLegacyAttractionId(record.id, legacyIds) || !isCanonicalAttractionRecord(record)
}

export function hasLiveOwner(record: AttractionRecordIdentity, owners: LiveOwnerIds): boolean {
  switch (record.runtime.kind) {
    case 'coaster':
      return owners.coasters.has(record.id)
    case 'course': {
      if (owners.courses.has(record.id)) return true
      const pool = slideOwnerId(record.id)
      return pool !== null && owners.courses.has(pool)
    }
    case 'scriptedRide':
      return owners.rides.has(record.id)
    default:
      return false
  }
}

/**
 * A projection whose live owner is gone: a coaster or course record without
 * its coaster/course, or a ride record migrated from a `ride` building that no
 * longer stands. Canonical records (`isCanonicalAttractionRecord`: every
 * `startAttraction` id of a non-projection kind, including kinds with a
 * `runtime.kind` added later) and the camping/party overlays, which are rebuilt
 * wholesale, never count.
 */
export function isOrphanProjectionRecord(
  record: AttractionRecordIdentity,
  owners: LiveOwnerIds,
): boolean {
  if (record.runtime.kind === 'camping' || record.runtime.kind === 'party') return false
  if (isCanonicalAttractionRecord(record)) return false
  return !hasLiveOwner(record, owners)
}

type RiderSources = {
  courses?: readonly Pick<CourseAttraction, 'riders'>[]
  attractions: readonly Pick<Attraction, 'id' | 'runtime'>[]
}

/**
 * Guests that walk or slide through an attraction and stay in the crowd mesh
 * while `riding`: live course riders plus the riders and occupants of records
 * no live system owns. A projection record's `runtime.riders`/`occupantIds`
 * are a stale copy of its course or ride and would keep finished guests
 * visible after they boarded a coaster or a ride (`WorldView`).
 */
export function crowdRiderIds(
  state: RiderSources,
  legacyIds: ReadonlySet<string>,
): Set<string> {
  const riders = new Set<string>()
  for (const course of state.courses ?? []) {
    for (const rider of course.riders) riders.add(rider.visitorId)
  }
  for (const attraction of state.attractions) {
    if (isLegacyAttractionId(attraction.id, legacyIds)) continue
    if (attraction.runtime.kind === 'course') {
      for (const rider of attraction.runtime.riders) riders.add(rider.visitorId)
    } else if (attraction.runtime.kind === 'scriptedRide') {
      for (const occupant of attraction.runtime.occupantIds) riders.add(occupant)
    }
  }
  return riders
}

type LiveIdRows = {
  coasters: Array<Pick<Coaster, 'id' | 'queue' | 'train'>>
  courses: Array<Pick<CourseAttraction, 'id' | 'queue' | 'riders'>>
  attractions: readonly Pick<Attraction, 'id'>[]
  visitors: Array<Pick<Visitor, 'id' | 'targetId'>>
}

/**
 * Coasters, courses and their records share one id namespace. 0.2.11 could
 * hand a course id out twice while paused (start A, start B, remove A, start
 * C → two `course-0-2`), so one record covered two courses and `removeCourse`
 * removed both. The loader renames every later duplicate to the first free
 * `${id}-${n}` (n ≥ 2) and moves the guests in its queue, train or rider list
 * along. Guests merely walking towards the shared id stay with the first row.
 */
export function renameDuplicateLiveIds(state: LiveIdRows): void {
  const seen = new Set<string>()
  const duplicates: Array<{ row: { id: string }; guests: readonly string[] }> = []
  for (const coaster of state.coasters) {
    if (seen.has(coaster.id)) duplicates.push({ row: coaster, guests: [...coaster.queue, ...coaster.train.passengerIds] })
    seen.add(coaster.id)
  }
  for (const course of state.courses) {
    if (seen.has(course.id)) duplicates.push({ row: course, guests: [...course.queue, ...course.riders.map((rider) => rider.visitorId)] })
    seen.add(course.id)
  }
  if (duplicates.length === 0) return
  const taken = new Set([...seen, ...state.attractions.map((record) => record.id)])
  const visitors = new Map(state.visitors.map((visitor) => [visitor.id, visitor]))
  for (const { row, guests } of duplicates) {
    const previous = row.id
    let suffix = 2
    while (taken.has(`${previous}-${suffix}`)) suffix += 1
    row.id = `${previous}-${suffix}`
    taken.add(row.id)
    for (const guestId of guests) {
      const visitor = visitors.get(guestId)
      if (visitor?.targetId === previous) visitor.targetId = row.id
    }
  }
}
