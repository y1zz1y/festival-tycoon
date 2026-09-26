import { BANDS, isHeadlinerBand } from './festivalManagement'
import { FLAT_RIDE_TYPES } from './flatRides'
import { bandGenre, GENRES } from './musicTaste'
import type { ProgressRecords } from './progress'
import { SCENARIO_PRESETS } from './scenarioPresets'
import type { GameSnapshot } from './types/snapshot'

/**
 * Which achievements this game has earned, read straight off the snapshot and the
 * cross-game records. Pure: the tracker (src/ui/progressTracker.ts) calls it now and
 * then on the host and unlocks whatever is new. Thresholds are the ones named in
 * server/progressProtocol.ts.
 */
export function earnedAchievements(s: Readonly<GameSnapshot>, records: ProgressRecords): string[] {
  const earned: string[] = []
  const editions = s.scenarioProgress.editions
  const minute = s.day * 1440 + s.minute
  if (editions.length > 0) earned.push('firstEdition')
  if (Object.values(records.scenarios).some((record) => record.won) || s.scenarioProgress.outcome.state === 'won') earned.push('firstWin')
  // Only scenarios that can be won count; the first-steps scenario has no goals.
  if (SCENARIO_PRESETS.filter((preset) => preset.settings.goals.length > 0).every((preset) => records.scenarios[preset.id]?.won)) earned.push('allPresets')
  if (s.scenarioProgress.outcome.state === 'won' && s.scenario.difficulty === 'hard') earned.push('hardWin')
  const started = s.festival.bookings.filter((booking) => booking.day * 1440 + booking.start <= minute)
  if (started.some((booking) => { const band = BANDS.find((entry) => entry.id === booking.bandId); return band && isHeadlinerBand(band) })) earned.push('headliner')
  const genres = new Set(s.festival.bookings.map((booking) => bandGenre(booking.bandId)))
  if (GENRES.every((genre) => genres.has(genre.id))) earned.push('allGenres')
  if (editions.some((edition) => edition.admissions >= 1000)) earned.push('crowd1000')
  if (editions.some((edition) => edition.satisfaction >= 85)) earned.push('happyCrowd')
  if (editions.some((edition) => edition.profit >= 25_000)) earned.push('bigProfit')
  const rideTypes = new Set(s.buildings.filter((building) => building.kind === 'ride').map((building) => building.rideType ?? 'carousel'))
  if (rideTypes.size >= 5 && [...rideTypes].every((type) => type === 'carousel' || type === 'bungee' || (FLAT_RIDE_TYPES as readonly string[]).includes(type))) earned.push('rides')
  if ((s.festival.sponsorsFulfilled ?? 0) > 0) earned.push('sponsor')
  if ((s.festival.stormStats?.calm ?? 0) > 0) earned.push('storm')
  return earned
}
