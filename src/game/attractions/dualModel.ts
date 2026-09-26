import type { Coaster } from '../coasters'
import type { CourseAttraction } from '../courseAttractions'
import type { PlacedBuilding } from '../types/entities'
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
 * longer stands. Canonical-only records (scripted rides from `startAttraction`)
 * and the camping/party overlays, which are rebuilt wholesale, never count.
 */
export function isOrphanProjectionRecord(
  record: AttractionRecordIdentity,
  owners: LiveOwnerIds,
): boolean {
  if (record.runtime.kind === 'camping' || record.runtime.kind === 'party') return false
  if (
    record.runtime.kind === 'scriptedRide' &&
    record.id.startsWith(CANONICAL_ATTRACTION_ID_PREFIX)
  ) return false
  return !hasLiveOwner(record, owners)
}
