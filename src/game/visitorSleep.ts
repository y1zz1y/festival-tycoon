import { hashStringSeed } from './rng'

export type SleepScheduleConfig = {
  bedtimeMinimum: number
  bedtimeRandomRange: number
  sleepDurationMinimum: number
  sleepDurationRandomRange: number
  scheduledSleepEnergyBelow: number
  nonCamperDepartureEnergyBelow: number
  familyBedtimeAdvanceMinutes: number
  peakAlertStart: number
  peakAlertEnd: number
  peakEnergyDecayMultiplier: number
  afterBedtimeEnergyDecayMultiplier: number
  legacyCivilianBedtimeFrom: number
  legacyCivilianBedtimeUntil: number
  legacyBedtimeShiftMinutes: number
  legacyWakeShiftMinutes: number
  legacyFamilyHourBedtime: number
}

export type SleepRhythm = {
  bedtime: number
  wakeTime: number
}

export type SleepRhythmVisitor = {
  id: string
  preferredBedtime?: number
  preferredWakeTime?: number
  audience?: string
}

export function wrapMinute(minute: number, minutesPerDay: number): number {
  return ((minute % minutesPerDay) + minutesPerDay) % minutesPerDay
}

export function isMinuteInWrappedWindow(
  minute: number,
  start: number,
  end: number,
): boolean {
  if (start > end) return minute >= start || minute < end
  return minute >= start && minute < end
}

export function isMinuteInSleepWindow(
  minute: number,
  bedtime: number,
  wakeTime: number,
): boolean {
  return isMinuteInWrappedWindow(minute, bedtime, wakeTime)
}

export function sampleFestivalSleepRhythm(
  unitBedtime: number,
  unitDuration: number,
  schedule: SleepScheduleConfig,
  minutesPerDay: number,
): SleepRhythm {
  const bedtime = wrapMinute(
    schedule.bedtimeMinimum + unitBedtime * schedule.bedtimeRandomRange,
    minutesPerDay,
  )
  const duration =
    schedule.sleepDurationMinimum +
    unitDuration * schedule.sleepDurationRandomRange
  return {
    bedtime,
    wakeTime: wrapMinute(bedtime + duration, minutesPerDay),
  }
}

export function sleepRhythmFromVisitorId(
  visitorId: string,
  schedule: SleepScheduleConfig,
  minutesPerDay: number,
): SleepRhythm {
  const seed = hashStringSeed(`${visitorId}:sleep`)
  return sampleFestivalSleepRhythm(
    (seed & 0xffff) / 0x10000,
    ((seed >>> 16) & 0xffff) / 0x10000,
    schedule,
    minutesPerDay,
  )
}

export function applyFamilyFestivalBedtime(
  visitor: { preferredBedtime: number },
  schedule: SleepScheduleConfig,
  minutesPerDay: number,
): void {
  visitor.preferredBedtime = wrapMinute(
    visitor.preferredBedtime - schedule.familyBedtimeAdvanceMinutes,
    minutesPerDay,
  )
}

export function remapLegacySleepRhythm(
  visitor: SleepRhythmVisitor,
  schedule: SleepScheduleConfig,
  minutesPerDay: number,
): SleepRhythm {
  let bedtime = visitor.preferredBedtime ?? 0
  let wakeTime = visitor.preferredWakeTime ?? 0
  if (
    visitor.audience === 'family' &&
    bedtime === schedule.legacyFamilyHourBedtime
  ) {
    bedtime = schedule.legacyFamilyHourBedtime * 60
  }
  if (
    bedtime >= schedule.legacyCivilianBedtimeFrom &&
    bedtime < schedule.legacyCivilianBedtimeUntil
  ) {
    bedtime = wrapMinute(
      bedtime + schedule.legacyBedtimeShiftMinutes,
      minutesPerDay,
    )
    wakeTime = wrapMinute(
      wakeTime + schedule.legacyWakeShiftMinutes,
      minutesPerDay,
    )
  }
  return { bedtime, wakeTime }
}

export function circadianEnergyDecayMultiplier(
  minute: number,
  bedtime: number,
  wakeTime: number,
  schedule: SleepScheduleConfig,
): number {
  if (isMinuteInSleepWindow(minute, bedtime, wakeTime)) {
    return schedule.afterBedtimeEnergyDecayMultiplier
  }
  if (
    isMinuteInWrappedWindow(
      minute,
      schedule.peakAlertStart,
      schedule.peakAlertEnd,
    )
  ) {
    return schedule.peakEnergyDecayMultiplier
  }
  return 1
}
