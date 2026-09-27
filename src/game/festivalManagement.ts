import { planStorms, stormAt, stormExposure, type StormPlan } from './storm'
import { rollSponsorOffers, settleSponsors, signSponsor, type SponsorContract } from './sponsors'
import { difficultyProfile } from './difficulty'
import { autoLineupDuration, planAutoLineup } from './autoLineup'
import { bookFinance, canAfford, type FinanceCategory } from './finance'
import { GENRES, bandGenre, musicTaste, musicAppeal, evolveMusicAudience, type MusicMix } from './musicTaste'
import { stageDistance, buildingFootprint, stageDesignIssue, stageStats, stagePhase, type StageDesign } from './stageDesign'
import type { WayType } from './wayTypes'
import { groundInfo } from './ground'
import { createInfrastructure, infrastructureAction, orderGoods, consumeLocal } from './supplyChain'
import type { Infrastructure, InfrastructureAction } from './supplyChain'
import type { GameSnapshot, Visitor, ActionResult } from './GameState'
import { hashStringSeed } from './rng'
import { SIMULATION_CONFIG } from './simulationConfig'
import { applyFamilyFestivalBedtime } from './visitorSleep'
import { CONCERT_TOPLESS_CROWD_THOUGHT, CONCERT_TOPLESS_THOUGHT } from './visitorThoughts'
import { createTicketDemandTuning, type TicketDemandTuning } from './demandTuning'
import { moodNeedAverage } from './visitorNeeds'
import type { WeekendGoals } from './scenario'
import { de, eur, keep, nested, num, plural, verbatim } from '../i18n/marker'

export const AUDIENCES = ['music', 'party', 'family', 'comfort', 'camping'] as const
export type Audience = typeof AUDIENCES[number]
export const AUDIENCE_NAMES: Record<Audience, string> = { music: de('Musikfans'), party: de('Partygänger'), family: de('Familien'), comfort: de('Komfortgäste'), camping: de('Campingfans') }
/** Band names and genres are proper nouns (docs/i18n.md): shown as they are in every language. */
export const BANDS = keep([
  { id: 'meadow', name: 'Meadow Letters', genre: 'Indie', audience: 'music', fee: 450, draw: 20, speakers: 0, reputation: 0 },
  { id: 'lantern', name: 'Lantern Parade', genre: 'Indie', audience: 'music', fee: 680, draw: 34, speakers: 1, reputation: 10 },
  { id: 'paper', name: 'Paper Satellites', genre: 'Indie', audience: 'music', fee: 1100, draw: 52, speakers: 2, reputation: 30 },
  { id: 'brass', name: 'Brass Picnic', genre: 'Brass & Pop', audience: 'family', fee: 550, draw: 25, speakers: 0, reputation: 0 },
  { id: 'sugar', name: 'Sugar Signal', genre: 'Pop', audience: 'party', fee: 820, draw: 38, speakers: 1, reputation: 15 },
  { id: 'firefly', name: 'Firefly Formula', genre: 'Pop', audience: 'family', fee: 1250, draw: 58, speakers: 2, reputation: 35 },
  { id: 'campfire', name: 'Campfire Atlas', genre: 'Folk', audience: 'camping', fee: 400, draw: 18, speakers: 0, reputation: 0 },
  { id: 'cedar', name: 'Cedar Choir', genre: 'Folk', audience: 'camping', fee: 720, draw: 32, speakers: 1, reputation: 10 },
  { id: 'harbor', name: 'Harbor & Hearth', genre: 'Folk', audience: 'comfort', fee: 1150, draw: 50, speakers: 2, reputation: 30 },
  { id: 'velvet', name: 'Velvet Sunday', genre: 'Soul', audience: 'comfort', fee: 700, draw: 30, speakers: 1, reputation: 0 },
  { id: 'amber', name: 'Amber Afterglow', genre: 'Soul', audience: 'comfort', fee: 1050, draw: 46, speakers: 1, reputation: 20 },
  { id: 'lowtide', name: 'Low Tide Lounge', genre: 'Soul', audience: 'comfort', fee: 1550, draw: 68, speakers: 2, reputation: 45 },
  { id: 'neon', name: 'Neon Orchard', genre: 'Electro', audience: 'party', fee: 950, draw: 40, speakers: 1, reputation: 0 },
  { id: 'voltage', name: 'Voltage Picnic', genre: 'Electro', audience: 'party', fee: 1350, draw: 62, speakers: 2, reputation: 35 },
  { id: 'synth', name: 'Synth Safari', genre: 'Electro', audience: 'party', fee: 1950, draw: 80, speakers: 3, reputation: 55 },
  { id: 'static', name: 'Static Parade', genre: 'Rock', audience: 'music', fee: 1400, draw: 60, speakers: 2, reputation: 40 },
  { id: 'rivet', name: 'Rivet Radio', genre: 'Rock', audience: 'music', fee: 780, draw: 36, speakers: 1, reputation: 10 },
  { id: 'wildcard', name: 'Wildcard Weekend', genre: 'Rock', audience: 'music', fee: 2100, draw: 84, speakers: 3, reputation: 60 },
  { id: 'orbit', name: 'Midnight Orbit', genre: 'Dance', audience: 'party', fee: 2200, draw: 85, speakers: 2, reputation: 55 },
  { id: 'glitter', name: 'Glitter Transit', genre: 'Dance', audience: 'party', fee: 1250, draw: 54, speakers: 2, reputation: 25 },
  { id: 'discoball', name: 'Disco Ballistics', genre: 'Dance', audience: 'party', fee: 1850, draw: 74, speakers: 3, reputation: 50 },
  { id: 'iron', name: 'Iron Daisies', genre: 'Metal', audience: 'music', fee: 650, draw: 28, speakers: 0, reputation: 0 },
  { id: 'anvil', name: 'Anvil Arcade', genre: 'Metal', audience: 'music', fee: 1080, draw: 48, speakers: 2, reputation: 20 },
  { id: 'thunder', name: 'Thunder Meadow', genre: 'Metal', audience: 'music', fee: 1700, draw: 70, speakers: 3, reputation: 45 },
  { id: 'confetti', name: 'Confetti Club', genre: 'Pop', audience: 'party', fee: 500, draw: 22, speakers: 0, reputation: 0 },
  { id: 'aurora', name: 'Aurora Avenue', genre: 'Indie', audience: 'music', fee: 2800, draw: 100, speakers: 3, reputation: 65 },
  { id: 'meadow2', name: 'Pollen Notes', genre: 'Indie', audience: 'comfort', fee: 380, draw: 16, speakers: 0, reputation: 0 },
  { id: 'lantern2', name: 'Glass Picnic', genre: 'Indie', audience: 'family', fee: 760, draw: 30, speakers: 1, reputation: 15 },
  { id: 'brass2', name: 'Tin Parade', genre: 'Brass & Pop', audience: 'party', fee: 620, draw: 29, speakers: 1, reputation: 5 },
  { id: 'sugar2', name: 'Candy Relay', genre: 'Pop', audience: 'family', fee: 690, draw: 33, speakers: 1, reputation: 10 },
  { id: 'campfire2', name: 'Ember Atlas', genre: 'Folk', audience: 'camping', fee: 470, draw: 23, speakers: 0, reputation: 5 },
  { id: 'cedar2', name: 'Pine Letters', genre: 'Folk', audience: 'comfort', fee: 640, draw: 26, speakers: 1, reputation: 10 },
  { id: 'velvet2', name: 'Velour Weather', genre: 'Soul', audience: 'party', fee: 780, draw: 35, speakers: 1, reputation: 5 },
  { id: 'neon2', name: 'Pixel Harvest', genre: 'Electro', audience: 'party', fee: 1100, draw: 47, speakers: 2, reputation: 15 },
  { id: 'rivet2', name: 'Crowbar Sonnet', genre: 'Rock', audience: 'party', fee: 880, draw: 41, speakers: 1, reputation: 15 },
  { id: 'iron2', name: 'Rust Cathedral', genre: 'Metal', audience: 'music', fee: 560, draw: 23, speakers: 1, reputation: 0 },
  { id: 'paper2', name: 'Orbit Paper', genre: 'Indie', audience: 'music', fee: 1280, draw: 58, speakers: 2, reputation: 35 },
  { id: 'firefly2', name: 'Bubblegum Radar', genre: 'Pop', audience: 'party', fee: 1420, draw: 63, speakers: 2, reputation: 40 },
  { id: 'harbor2', name: 'Driftwood Almanac', genre: 'Folk', audience: 'camping', fee: 960, draw: 42, speakers: 1, reputation: 25 },
  { id: 'amber2', name: 'Marigold Rooms', genre: 'Soul', audience: 'comfort', fee: 1220, draw: 53, speakers: 2, reputation: 30 },
  { id: 'voltage2', name: 'Cathode Garden', genre: 'Electro', audience: 'music', fee: 1140, draw: 54, speakers: 2, reputation: 30 },
  { id: 'glitter2', name: 'Strobe Cartel', genre: 'Dance', audience: 'party', fee: 1460, draw: 61, speakers: 2, reputation: 35 },
  { id: 'anvil2', name: 'Obsidian Tractor', genre: 'Metal', audience: 'music', fee: 1260, draw: 55, speakers: 2, reputation: 30 },
  { id: 'static2', name: 'Asphalt Tulips', genre: 'Rock', audience: 'comfort', fee: 1180, draw: 51, speakers: 2, reputation: 30 },
  { id: 'lowtide2', name: 'Silk Receiver', genre: 'Soul', audience: 'party', fee: 1720, draw: 73, speakers: 3, reputation: 50 },
  { id: 'thunder2', name: 'Granite Howl', genre: 'Metal', audience: 'music', fee: 1920, draw: 77, speakers: 3, reputation: 50 },
  { id: 'discoball2', name: 'Mirror Motion', genre: 'Dance', audience: 'party', fee: 1640, draw: 67, speakers: 2, reputation: 45 },
  { id: 'synth2', name: 'Modular Monsoon', genre: 'Electro', audience: 'music', fee: 1760, draw: 74, speakers: 3, reputation: 50 },
  { id: 'orbit2', name: 'Lunar Dispatch', genre: 'Dance', audience: 'party', fee: 2450, draw: 90, speakers: 3, reputation: 60 },
  { id: 'wildcard2', name: 'Jukebox Mutiny', genre: 'Rock', audience: 'party', fee: 1880, draw: 78, speakers: 3, reputation: 55 },
  { id: 'nova', name: 'Nova Canopy', genre: 'Indie', audience: 'music', fee: 3000, draw: 98, speakers: 3, reputation: 65 },
  { id: 'eclipse', name: 'Eclipse Circuit', genre: 'Electro', audience: 'party', fee: 3100, draw: 99, speakers: 3, reputation: 65 },
  { id: 'hollowoak', name: 'Hollow Oak Revival', genre: 'Folk', audience: 'camping', fee: 2350, draw: 88, speakers: 3, reputation: 60 },
  { id: 'starlight', name: 'Starlight Syndicate', genre: 'Pop', audience: 'party', fee: 2700, draw: 96, speakers: 3, reputation: 62 },
  { id: 'goldenhour', name: 'Golden Hour Revue', genre: 'Soul', audience: 'comfort', fee: 2500, draw: 90, speakers: 3, reputation: 60 },
  { id: 'gravemarch', name: 'Gravemarch Legion', genre: 'Metal', audience: 'music', fee: 2600, draw: 92, speakers: 3, reputation: 62 },
] as const)

export type BandStar = 1 | 2 | 3 | 4 | 5

/** A stage's band label between shows (stored in `bandName`, shown with localizeName). */
export const CHANGEOVER_LABEL = de('Umbau / Pause')

export function bandStarRating(band: { reputation: number }): BandStar {
  if (band.reputation >= 60) return 5
  if (band.reputation >= 45) return 4
  if (band.reputation >= 30) return 3
  if (band.reputation >= 15) return 2
  return 1
}

export function bandVisitorDraw(band: { draw: number }): number {
  return band.draw
}

export function bandPriceWillingness(band: { draw: number; reputation: number }): number {
  return Math.max(0.12, Math.min(1, band.draw / 110 + band.reputation / 220))
}

export function isFiveStarBand(band: { reputation: number }): boolean {
  return bandStarRating(band) === 5
}

/**
 * A headliner is a five-star band: it needs the music reputation and an offer from the
 * headliner pool. The mark is derived from the stars, never written into the genre, so
 * genre checks (DJ acts, costumes) see the plain genre.
 */
export function isHeadlinerBand(band: { reputation: number }): boolean {
  return isFiveStarBand(band)
}

/** Genre as shown on a band card: the genre, plus "Headliner" for five-star bands. */
export function bandGenreLabel(band: { genre: string; reputation: number }): string {
  return isHeadlinerBand(band) ? de`${verbatim(band.genre)} · Headliner` : band.genre
}

export function rollFiveStarOffers(
  musicReputation: number,
  rng: { next(): number },
  alreadyBooked: ReadonlySet<string>,
): string[] {
  if (musicReputation < 55) return []
  const pool = BANDS.filter((band) => isFiveStarBand(band) && !alreadyBooked.has(band.id))
  if (pool.length === 0 || rng.next() > 0.28) return []
  const pick = pool[Math.floor(rng.next() * pool.length)]
  return pick ? [pick.id] : []
}

export type Supply = 'food' | 'drinks' | 'water' | 'goods'
export const SUPPLIES: Record<Supply, { name: string; price: number }> = {
  food: { name: de('Essen'), price: 2 },
  drinks: { name: de('Getränke'), price: 1.5 },
  water: { name: de('Trinkwasser'), price: 0.3 },
  goods: { name: de('Allgemeine Waren'), price: 1.2 },
}
export const UPGRADES = {
  drainage: { name: de('Entwässerung & Wegmatten'), cost: 900, detail: de('Halbiert die Schlammwirkung auf unbefestigten Flächen.') },
  shelter: { name: de('Überdachte Ruheplätze'), cost: 700, detail: de('Schützt bis zu 250 Gäste vor Regen und Hitze.') },
  rigging: { name: de('Sturmsicherung der Bühnen'), cost: 1100, detail: de('Ermöglicht technisch geeignete Auftritte auch bei starkem Wind.') },
  water: { name: de('Trinkwasserstationen'), cost: 450, detail: de('Versorgte WCs geben Trinkwasser im Umkreis von drei Feldern aus. Trägerroute für Wasser nötig.') },
  quiet: { name: de('Ruhecamp mit Schallschutz'), cost: 850, detail: de('Reduziert den Schlafverlust durch nahe Nachtkonzerte.') },
  warehouse: { name: de('Lagererweiterung'), cost: 750, detail: de('Erhöht die Kapazität je Depot von 3.000 auf 5.000 Einheiten.') },
  staffSpeed: { name: de('E-Roller fürs Personal'), cost: 1500, detail: de('Reinigungskräfte, Sicherheit, Sanitäter und Feuerwehr sind doppelt so schnell unterwegs.') },
  truckHydraulics: { name: de('Schnellkipper für Müllautos'), cost: 1000, detail: de('Halbiert die Be- und Entladezeit jedes Müllautos an Container, Müllablage, Mülldepot und Bauhof.') },
} as const
/** How much faster the crew moves once it has wheels. */
export const STAFF_SPEED_UPGRADE_FACTOR = 2
export function staffSpeedFactor(f: FestivalManagement): number {
  return f.upgrades.staffSpeed ? STAFF_SPEED_UPGRADE_FACTOR : 1
}
/** True once the quick-tipper is paid for; saves from before it simply have no flag. */
export function hasTruckHydraulics(f: FestivalManagement): boolean {
  return Boolean(f.upgrades?.truckHydraulics)
}
export type Upgrade = keyof typeof UPGRADES
/**
 * Upgrades bought in steps rather than once. Every step doubles what it improves and
 * is paid on top of the last one, so the ground crew can be built up gradually
 * instead of in one expensive jump.
 */
export const TIERED_UPGRADES = {
  cleanerCarry: {
    name: de('Größere Müllkarren'),
    detail: de('Reinigungskräfte tragen je Gang doppelt so viel Müll. Jede weitere Stufe verdoppelt die Ladung erneut.'),
    /** The result line once a step is paid for (one full sentence per upgrade, docs/i18n.md). */
    stepDone: (level: number, factor: number) => de`Größere Müllkarren · Stufe ${num(level)}: Ladung ×${num(factor)}`,
    steps: [
      { cost: 1000, factor: 2 },
      { cost: 1000, factor: 4 },
      { cost: 5000, factor: 8 },
    ],
  },
} as const
export type TieredUpgrade = keyof typeof TIERED_UPGRADES
/** How many steps of a tiered upgrade are paid for; a save from before them has none. */
export function upgradeLevel(f: FestivalManagement, kind: TieredUpgrade): number {
  return Math.min(TIERED_UPGRADES[kind].steps.length, Math.max(0, Math.floor(f.upgradeLevels?.[kind] ?? 0)))
}
/** What a cleaner can carry, as a multiple of the base load. */
export function cleanerCarryFactor(f: FestivalManagement): number {
  const level = upgradeLevel(f, 'cleanerCarry')
  return level > 0 ? TIERED_UPGRADES.cleanerCarry.steps[level - 1]!.factor : 1
}
export type Booking = { id: string; bandId: string; stageId: string; day: number; start: number; duration: number; fee: number }
export type Weather = 'sun' | 'rain' | 'heat' | 'wind'
export const WEATHER_NAMES: Record<Weather, string> = { sun: de('Heiter'), rain: de('Regen'), heat: de('Hitze'), wind: de('Starker Wind') }
/** The same four kinds of weather at a glance, for the forecast and wherever it is reported. */
export const WEATHER_ICONS: Record<Weather, string> = { sun: '☀️', rain: '🌧️', heat: '🌡️', wind: '💨' }
type Reputation = { music: number; atmosphere: number; comfort: number; organization: number }
export type DayReport = { day: number; balance: number; guests: number; satisfaction: number; concerts: number; stockouts: number; weatherImpact: number; reputation: Reputation }
export type FestivalManagement = {
  musicBase?: MusicMix; previousMusicBase?: MusicMix; playedMusic?: Partial<MusicMix>; musicEvolvedEdition?: number;
  stageTemplates?: StageDesign[]; selectedStageTemplate?: string | null;
  tickets?: { day: number; camping: number; usedDay: Record<string, number>; usedCamping: number };
  infrastructure: Infrastructure; planning?: boolean; enabled: boolean; finished: boolean; edition: number; startDay: number; reportDay: number; openingMoney: number;
  bookings: Booking[]; supplies: Record<Supply, number>; upgrades: Record<Upgrade, boolean>; upgradeLevels?: Partial<Record<TieredUpgrade, number>>;
  deliveries: Array<{ id: string; kind: Supply; quantity: number; due: number; remaining: number; depotId?: string }>;
  reputation: Reputation; reports: DayReport[]; weather: Weather; wetness: number; seed: number; nextId: number;
  metrics: { guests: number; samples: number; satisfaction: number; concertMinutes: number; stockouts: number; weatherImpact: number };
  lastUpdate: number; admissions: number; goals: { guests: number; satisfaction: number; profit: number };
  headlinerPool?: string[];
  demandTuning: TicketDemandTuning;
  /** Storms planned for this edition's festival days (src/game/storm.ts). */
  storms?: StormPlan[];
  /** Shelter ordered by the player for the current or coming storm. */
  shelterOrder?: boolean;
  /** Guests hurt by the current storm, and totals over the game. */
  stormInjuries?: number;
  stormStats?: { weathered: number; calm: number };
  /** Whether a storm was raging at the last festival minute, to see it start and end. */
  stormLive?: boolean;
  /** Sponsor offers for the coming edition and contracts signed for it (src/game/sponsors.ts). */
  sponsorOffers?: SponsorContract[];
  sponsors?: SponsorContract[];
  sponsorsFulfilled?: number;
}
export type FestivalAction = InfrastructureAction
  | { type: 'wayArea'; from: { x: number; z: number }; to: { x: number; z: number }; kind: WayType }
  | { type: 'stageTemplate'; name: string | null }
  | { type: 'sponsor'; id: string }
  | { type: 'shelter' }
  | { type: 'stageDesign'; design: StageDesign; stageId?: string; saveTemplate?: boolean; selectForBuild?: boolean }
  | { type: 'tickets'; day: number; camping: number }
  | { type: 'start' }
  | { type: 'prepare' }
  | { type: 'moveBooking'; id:string; stageId:string; day:number; start:number; duration:number }
  | { type: 'book'; bandId: string; stageId: string; day: number; start: number; duration: number }
  | { type: 'autoLineup'; duration: number; minStars?: number; maxStars?: number }
  | { type: 'cancel'; id: string }
  | { type: 'order'; kind: Supply; quantity: number; delay: number; depotId?: string }
  | { type: 'upgrade'; kind: Upgrade }
  | { type: 'upgradeStep'; kind: TieredUpgrade }
  | { type: 'sandbox' }

const metrics = () => ({ guests: 0, samples: 0, satisfaction: 0, concertMinutes: 0, stockouts: 0, weatherImpact: 0 })
const clamp = (n: number) => Math.max(0, Math.min(100, n))
export const festivalTime = (s: Readonly<GameSnapshot>) => s.day * 1440 + s.minute
export function createFestivalManagement(): FestivalManagement {
  return { infrastructure: createInfrastructure(), enabled: false, finished: false, edition: 0, startDay: 1, reportDay: 1, openingMoney: 0,
    bookings: [], supplies: { food: 0, drinks: 0, water: 0, goods: 0 },
    upgrades: { drainage: false, shelter: false, rigging: false, water: false, quiet: false, warehouse: false, staffSpeed: false, truckHydraulics: false },
    deliveries: [], reputation: { music: 40, atmosphere: 50, comfort: 50, organization: 50 }, reports: [],
    weather: 'sun', wetness: 0, seed: 1, nextId: 1, metrics: metrics(), lastUpdate: 0,
    admissions: 0, goals: { guests: 150, satisfaction: 65, profit: 0 }, headlinerPool: [],
    demandTuning: createTicketDemandTuning() }
}
export function forecast(f: FestivalManagement, day: number, hour: number): Weather {
  const value = hashStringSeed(`${f.seed}:${day}:${Math.floor(hour / 6)}`) % 10
  return value < 4 ? 'sun' : value < 7 ? 'rain' : value < 9 ? 'heat' : 'wind'
}
export function weatherAt(f: FestivalManagement, day: number, hour: number): Weather {
  const outlook = forecast(f, day, hour)
  // Forecasts show the risk for a six-hour window; some hours turn out milder.
  if (hashStringSeed(`${f.seed}:actual:${day}:${Math.floor(hour)}`) % 5 === 0) {
    return outlook === 'wind' ? 'rain' : 'sun'
  }
  return outlook
}
/** How cold and how warm it ever gets on this site, in °C. */
export const TEMPERATURE_RANGE = { min: 15, max: 35 } as const
/**
 * The temperature of one hour. Three things decide it, and all three are seeded, so
 * the same hour always reads the same: how warm the day is as a whole, where the hour
 * sits on the day's curve — coldest before dawn, warmest mid-afternoon — and what the
 * sky is doing, since heat bakes and rain and wind take the edge off.
 */
export function temperatureAt(f: FestivalManagement, day: number, hour: number, weather: Weather): number {
  const dayWarmth = hashStringSeed(`${f.seed}:temp:${day}`) % 100 / 100
  const mean = 20 + dayWarmth * 6
  const daily = 5 * Math.cos((hour - 15) / 24 * Math.PI * 2)
  const sky = { sun: 2, heat: 7, rain: -3, wind: -2 }[weather]
  const value = Math.round(mean + daily + sky)
  return Math.max(TEMPERATURE_RANGE.min, Math.min(TEMPERATURE_RANGE.max, value))
}
/** The temperature as it is written: a whole number with its unit. */
export const formatTemperature = (celsius: number): string => `${celsius} °C`
export function audienceMix(f: FestivalManagement): Record<Audience, number> {
  const weights = { music: 20 + f.reputation.music / 5, party: 20 + f.reputation.atmosphere / 5,
    family: 15 + f.reputation.organization / 5, comfort: 15 + f.reputation.comfort / 5, camping: 25 }
  for (const booking of f.bookings) {
    const band = BANDS.find(b => b.id === booking.bandId)
    if (band) weights[band.audience] += band.draw
  }
  const sum = Object.values(weights).reduce((a, b) => a + b, 0)
  return Object.fromEntries(AUDIENCES.map(key => [key, weights[key] / sum])) as Record<Audience, number>
}
export function assignAudience(visitor: Visitor, f: FestivalManagement): void {
  const mix = audienceMix(f)
  let choice = (hashStringSeed(visitor.id) % 10000) / 10000
  let group: Audience = 'camping'
  for (const key of AUDIENCES) { choice -= mix[key]; if (choice <= 0) { group = key; break } }
  visitor.musicTaste ??= musicTaste(visitor.id,f)
  visitor.audience = group
  visitor.budget *= group === 'comfort' ? 1.35 : group === 'family' ? 1.15 : group === 'camping' ? 0.9 : 1
  visitor.partyPreference = group === 'party' ? 0.95 : group === 'family' || group === 'comfort' ? 0.25 : 0.65
  visitor.beautyPreference = group === 'comfort' || group === 'family' ? 0.9 : 0.45
  if (group === 'family') {
    visitor.alcoholDesire = 0
    applyFamilyFestivalBedtime(
      visitor,
      SIMULATION_CONFIG.camping.sleepSchedule,
      SIMULATION_CONFIG.time.minutesPerDay,
    )
  }
}
export function activeBookings(s: Readonly<GameSnapshot>): Booking[] {
  if (!s.festival.enabled || s.festival.finished) return []
  return s.festival.bookings.filter(b => b.day === s.day && s.minute >= b.start && s.minute < b.start + b.duration)
}
export function watchableBookings(s: Readonly<GameSnapshot>): Booking[] {
  if (!s.festival.enabled || s.festival.finished) return []
  const lead = SIMULATION_CONFIG.atmosphere.concertArriveEarlyMinutes
  return s.festival.bookings.filter(b => b.day === s.day && s.minute >= b.start - lead && s.minute < b.start + b.duration)
}
export function showIssue(s: Readonly<GameSnapshot>, booking: Booking, atMinute = s.minute): string | null {
  const stage = s.buildings.find(b => b.id === booking.stageId && b.kind === 'stage')
  const band = BANDS.find(b => b.id === booking.bandId)
  if (!stage || !band) return de('Bühne fehlt')
  if (band.draw >= 60 && buildingFootprint(stage).some(c=>groundInfo(s,c.x,c.z).bearing<3)) return de('Großauftritt braucht ein entwässertes, gepflastertes Bühnenfundament')
  if (!s.stageForecourtCells.some(c => stageDistance(stage,c) <= 8)) return de('Bühnenvorplatz im Umkreis von 8 Feldern fehlt')
  if (!s.power.poweredBuildingIds.includes(stage.id)) return de('Bühne ohne Strom')
  if (!s.dayPlan.offers.stages[Math.floor(atMinute / 60) % 24]) return de('Bühnen laut Tagesplan geschlossen')
  const speakers = s.buildings.filter(b => ['directionalSpeaker', 'omniSpeaker', 'delayTower'].includes(b.kind) &&
    stageDistance(stage,b) <= 10 && s.power.poweredBuildingIds.includes(b.id)).length
  if (speakers + (stage.stageDesign ? stageStats(stage.stageDesign).speakers : 0) < band.speakers) return plural(band.speakers, de`${num(band.speakers)} aktiver Lautsprecher im Umkreis von 10 Feldern nötig`, de`${num(band.speakers)} aktive Lautsprecher im Umkreis von 10 Feldern nötig`)
  if (s.festival.weather === 'wind' && !s.festival.upgrades.rigging) return de('Starker Wind: Sturmsicherung fehlt')
  // Storms are a now-thing: a show planned for later is not blocked by today's forecast.
  const storm = atMinute === s.minute ? stormAt(s.festival, s.day, s.minute) : { phase: 'none' as const }
  if (storm.phase === 'active') return de('Unwetter: Auftritte unterbrochen')
  if (storm.phase === 'warning' && s.festival.shelterOrder) return de('Schutz angeordnet: Auftritte pausiert')
  return null
}
export function festivalAction(s: GameSnapshot, action: FestivalAction): ActionResult {
  if (['ground', 'groundArea', 'depot', 'minimum', 'route', 'removeRoute', 'removeDepot', 'depotSettings', 'staffArea', 'staffGate'].includes(action.type)) return infrastructureAction(s, action as InfrastructureAction)
  if (action.type === 'order') return orderGoods(s, action.kind, action.quantity, action.delay, action.depotId)
  const f = s.festival, now = festivalTime(s)
  const fail = (message: string): ActionResult => ({ ok: false, message })
  const pay = (amount: number, category: FinanceCategory) => { if (!canAfford(s, amount)) return false; bookFinance(s, category, -amount); return true }
  if (action.type === 'sandbox') { f.planning = false; f.enabled = false; s.parkOpen = true; s.speed = 1; return { ok: true, message: de('Freies Spiel fortgesetzt') } }
  if (action.type === 'stageTemplate') {
    if(action.name!==null&&!f.stageTemplates?.some(t=>t.name===action.name))return fail(de('Vorlage nicht gefunden'))
    f.selectedStageTemplate=action.name
    return {ok:true,message:action.name?de('Bühnenvorlage gewählt'):de('Standardbühne für Neubauten gewählt')}
  }
  if (action.type === 'stageDesign') {
    const issue = stageDesignIssue(action.design); if (issue) return fail(issue)
    const stage = action.stageId ? s.buildings.find(b=>b.id===action.stageId&&b.kind==='stage') : undefined
    if (action.stageId && !stage) return fail(de('Bühne nicht gefunden'))
    if ((action.saveTemplate || action.selectForBuild) && (f.stageTemplates?.length??0)>=30 && !f.stageTemplates?.some(t=>t.name===action.design.name)) return fail(de('Höchstens 30 Vorlagen speichern'))
    if (stage) {
      const price = Math.max(0,stageStats(action.design).cost-(stage.stageDesign?stageStats(stage.stageDesign).cost:0))
      if (!pay(price, 'construction')) return fail(de('Nicht genug Geld für den Bühnenausbau'))
      stage.stageDesign = structuredClone(action.design)
    }
    if (action.saveTemplate || action.selectForBuild) {
      f.stageTemplates ??= []; const index=f.stageTemplates.findIndex(t=>t.name===action.design.name)
      if(index>=0)f.stageTemplates[index]=structuredClone(action.design);else f.stageTemplates.push(structuredClone(action.design))
    }
    if(action.selectForBuild)f.selectedStageTemplate=action.design.name
    return {ok:true,message:stage?de('Bühne umgebaut'):action.selectForBuild?de('Vorlage für den Bühnenbau gewählt'):de('Bühnenvorlage gespeichert')}
  }
  if (action.type === 'tickets') {
    if (f.enabled && !f.finished) return fail(de('Ticketkontingente vor dem Festivalstart festlegen'))
    if (![action.day, action.camping].every(n => Number.isInteger(n) && n >= 0 && n <= 100000)) return fail(de('Gültige Ticketzahlen zwischen 0 und 100.000 wählen'))
    const capacity = Math.floor(s.campingCells.length * (1 - s.dayPlan.campingCapacityBufferPercent / 100))
    if (action.camping > capacity) return fail(plural(capacity, de`Nur ${num(capacity)} Campingplatz buchbar`, de`Nur ${num(capacity)} Campingplätze buchbar`))
    f.tickets = { day: action.day, camping: action.camping, usedDay: {}, usedCamping: 0 }
    return { ok: true, message: de('Ticketkontingente gespeichert') }
  }
  if(action.type==='prepare'){
    if(f.enabled&&!f.finished)return fail(de('Das laufende Festival zuerst abschließen'))
    if(f.planning&&!f.finished)return {ok:true,message:de('Die Festivalplanung ist bereits geöffnet')}
    f.enabled=false;f.finished=false;f.planning=true;f.bookings=[];f.startDay=s.day;s.parkOpen=false;s.speed=0
    f.goals = weekendGoals(f.edition + 1, s.scenario.festivalGoals)
    let offerSeed = hashStringSeed(`headliners:${f.seed}:${f.edition}`)
    const offerRng = { next: () => {
      offerSeed = (Math.imul(offerSeed, 1664525) + 1013904223) >>> 0
      return offerSeed / 0x100000000
    } }
    f.headlinerPool = rollFiveStarOffers(f.reputation.music, offerRng, new Set())
    f.sponsorOffers = rollSponsorOffers(`${f.seed}:${s.rngState}`, f.edition + 1)
    f.sponsors = []
    return {ok:true,message:de('Nächste Ausgabe planen – die Besucherbasis bleibt erhalten')}
  }
  if (action.type === 'start') {
    if (f.enabled && !f.finished) return fail(de('Das Festivalwochenende läuft bereits'))
    if (f.tickets && f.tickets.camping > Math.floor(s.campingCells.length * (1 - s.dayPlan.campingCapacityBufferPercent / 100))) return fail(de('Für die Campingtickets fehlen nutzbare Plätze'))
    if(!f.finished&&f.bookings.some(b=>b.day<f.startDay+s.dayPlan.leadDays||b.day>=f.startDay+s.dayPlan.leadDays+s.dayPlan.festivalDays||!bookingHoursOpen(s,b.start,b.duration)))return fail(de('Spielplan passt nicht zur Tagesplanung. Auftritte zuerst anpassen.'))
    if (f.tickets) { f.tickets.usedDay = {}; f.tickets.usedCamping = 0 }
    const plannedStart=f.startDay
    if(f.finished)f.bookings=[]
    else f.bookings.forEach(b=>b.day+=s.day-plannedStart)
    f.playedMusic={}
    f.planning = false; f.enabled = true; f.finished = false; f.edition++; f.startDay = s.day;
    f.goals = weekendGoals(f.edition, s.scenario.festivalGoals)
    f.reportDay = s.day; f.openingMoney = s.money+f.bookings.reduce((sum,b)=>sum+b.fee,0); f.reports = [];
    f.metrics = metrics(); f.admissions = 0; f.lastUpdate = now; f.seed = s.rngState;
    s.dayPlan.cycleStartDay = s.day;
    // Storms for this edition's festival days, from the seed that was just fixed.
    f.storms = planStorms(f.seed, s.day + s.dayPlan.leadDays, s.dayPlan.festivalDays, difficultyProfile(s.scenario).stormChance)
    f.shelterOrder = false; f.stormInjuries = 0
    f.sponsorOffers = []
    s.parkOpen = true; s.speed = 1;
    return { ok: true, message: de('Festivalzeit gestartet. Vorlauf und Ablauf richten sich nach eurer Tagesplanung.') }
  }
  if (action.type === 'sponsor') return signSponsor(s, action.id)
  if (action.type === 'shelter') {
    const storm = stormAt(f, s.day, s.minute)
    if (storm.phase === 'none') return fail(de('Gerade droht kein Unwetter'))
    if (f.shelterOrder) return fail(de('Schutz ist bereits angeordnet'))
    f.shelterOrder = true
    return { ok: true, message: de('Schutz angeordnet: Auftritte pausieren, Gäste suchen Deckung') }
  }
  if(f.finished)return fail(de('Zuerst die nächste Ausgabe vorbereiten'))
  if (action.type === 'book'||action.type==='moveBooking') {
    const previous=action.type==='moveBooking'?f.bookings.find(b=>b.id===action.id):undefined
    if(action.type==='moveBooking'&&(!previous||previous.day*1440+previous.start<=now))return fail(de('Nur zukünftige Buchungen verschieben'))
    const band = BANDS.find(b => b.id === (action.type==='book'?action.bandId:previous?.bandId))
    if (!band || !s.buildings.some(b => b.id === action.stageId && b.kind === 'stage')) return fail(de('Band und vorhandene Bühne wählen'))
    if (!Number.isInteger(action.day)||!(action.day >= f.startDay + s.dayPlan.leadDays && action.day < f.startDay + s.dayPlan.leadDays + s.dayPlan.festivalDays) || !Number.isInteger(action.start) ||
        action.start < 8 * 60 || ![60, 90, 120].includes(action.duration) || action.start + action.duration > 24 * 60 ||
        action.day * 1440 + action.start <= now) return fail(de('Freie Zeit an einem geplanten Festivaltag wählen (08–24 Uhr)'))
    if(!bookingHoursOpen(s,action.start,action.duration))return fail(de('Bühnen sind in diesem Zeitfenster laut Tagesplanung geschlossen'))
    if (f.reputation.music < band.reputation) return fail(de`Diese Band verlangt mindestens ${num(band.reputation)} Musikruf`)
    if (isFiveStarBand(band) && !(f.headlinerPool ?? []).includes(band.id)) {
      return fail(de('Diese 5-Sterne-Band steht in dieser Planung nicht zur Verfügung'))
    }
    if (f.bookings.some(b => b.id!==previous?.id && b.day === action.day && (b.bandId === band.id || (b.stageId === action.stageId &&
        action.start < b.start + b.duration + 30 && action.start + action.duration + 30 > b.start)))) return fail(de('Band bereits gebucht oder Bühne belegt (30 Minuten Umbauzeit)'))
    if(previous){Object.assign(previous,{stageId:action.stageId,day:action.day,start:action.start,duration:action.duration});return {ok:true,message:de('Auftritt verschoben – keine zusätzliche Gage')}}
    if (!pay(band.fee, 'bands')) return fail(de('Nicht genug Geld für die Gage'))
    f.bookings.push({ id: `booking-${f.nextId++}`, bandId: band.id, stageId: action.stageId, day: action.day,
      start: action.start, duration: action.duration, fee: band.fee })
    return { ok: true, message: de`${verbatim(band.name)} gebucht – Gage bezahlt` }
  }
  if (action.type === 'autoLineup') {
    if (!s.buildings.some(building => building.kind === 'stage')) return fail(de('Zuerst eine Bühne bauen'))
    const duration = autoLineupDuration(action.duration)
    const plan = planAutoLineup(s, duration, {
      minStars: action.minStars,
      maxStars: action.maxStars,
    })
    if (!plan.length) return fail(de('Keine freien Slots, passenden Bands oder genug Budget für eine automatische Füllung'))
    let booked = 0
    let spent = 0
    for (const item of plan) {
      const result = festivalAction(s, { type: 'book', ...item })
      if (!result.ok) break
      booked += 1
      spent += BANDS.find(band => band.id === item.bandId)?.fee ?? 0
    }
    if (!booked) return fail(de('Keine freien Slots, passenden Bands oder genug Budget für eine automatische Füllung'))
    return { ok: true, message: plural(booked, de`${num(booked)} Auftritt automatisch gebucht · ${eur(spent)} Gagen`, de`${num(booked)} Auftritte automatisch gebucht · ${eur(spent)} Gagen`) }
  }
  if (action.type === 'cancel') {
    const b = f.bookings.find(b => b.id === action.id)
    if (!b || b.day * 1440 + b.start <= now) return fail(de('Nur zukünftige Auftritte können storniert werden'))
    bookFinance(s, 'bands', b.fee / 2); f.bookings = f.bookings.filter(item => item.id !== b.id)
    return { ok: true, message: de('Buchung storniert, 50 % der Gage erstattet') }
  }
  if (action.type === 'upgradeStep') {
    const upgrade = TIERED_UPGRADES[action.kind]
    const level = upgrade ? upgradeLevel(f, action.kind) : 0
    const step = upgrade?.steps[level]
    if (!step) return fail(de('Höchste Stufe bereits erreicht'))
    if (!pay(step.cost, 'construction')) return fail(de('Nicht genug Geld für diesen Ausbau'))
    f.upgradeLevels = { ...(f.upgradeLevels ?? {}), [action.kind]: level + 1 }
    return { ok: true, message: upgrade.stepDone(level + 1, step.factor) }
  }
  if (action.type === 'upgrade') {
    const upgrade = UPGRADES[action.kind]
    if (!upgrade || f.upgrades[action.kind]) return fail(de('Ausbau bereits vorhanden oder unbekannt'))
    if (!pay(upgrade.cost, 'construction')) return fail(de('Nicht genug Geld für diesen Ausbau'))
    f.upgrades[action.kind] = true
    return { ok: true, message: de`${nested(upgrade.name)} eingerichtet` }
  }
  return fail(de('Unbekannte Festivalaktion'))
}
/**
 * How content the guests were over the festival days of the current edition: the
 * mean of the day reports from the first festival day on, lead days left out. The
 * HEADLINE Magazin and the scenario goals judge an edition by this same number.
 */
export function editionSatisfaction(s: Readonly<GameSnapshot>): number {
  const f = s.festival
  const firstDay = f.startDay + s.dayPlan.leadDays
  const reports = f.reports.filter((report) => report.day >= firstDay)
  if (reports.length) return reports.reduce((sum, report) => sum + report.satisfaction, 0) / reports.length
  return f.metrics.samples ? f.metrics.satisfaction / f.metrics.samples : 50
}

/** The festival's standing as one number: the mean of its four reputation values. */
export function festivalReputation(f: Readonly<FestivalManagement>): number {
  const r = f.reputation
  return (r.music + r.atmosphere + r.comfort + r.organization) / 4
}

/**
 * The targets of one festival weekend. The first comes from the scenario or the
 * config; every further edition asks for more guests, a little more satisfaction
 * and a larger profit, so the weekend goals keep meaning something after the third.
 */
export function weekendGoals(edition: number, base?: WeekendGoals): WeekendGoals {
  const first = base ?? SIMULATION_CONFIG.scenario.weekendGoals
  const growth = SIMULATION_CONFIG.scenario.weekendGoalGrowth
  const steps = Math.max(0, Math.floor(edition) - 1)
  return {
    guests: Math.round(first.guests * growth.guestsFactor ** steps / 10) * 10,
    satisfaction: Math.min(Math.max(first.satisfaction, growth.satisfactionCap), first.satisfaction + growth.satisfactionStep * steps),
    profit: first.profit + growth.profitStep * steps,
  }
}

export function recordDay(s: GameSnapshot): void {
  const f = s.festival, m = f.metrics
  const satisfaction = m.samples ? m.satisfaction / m.samples : 50
  if (f.reportDay >= f.startDay + s.dayPlan.leadDays) {
    const music = Math.min(100, 40 + m.concertMinutes / Math.max(1, m.samples) * 180)
    const targets = { music, atmosphere: satisfaction, comfort: clamp(satisfaction - m.weatherImpact / Math.max(1, m.samples) * 8), organization: clamp(90 - m.stockouts / Math.max(1, m.guests) * 100) }
    for (const key of Object.keys(targets) as Array<keyof Reputation>) f.reputation[key] = clamp(f.reputation[key] * 0.7 + targets[key] * 0.3)
  }
  f.reports.push({ day: f.reportDay, balance: s.money - f.openingMoney, guests: m.guests,
    satisfaction, concerts: m.concertMinutes, stockouts: m.stockouts, weatherImpact: m.weatherImpact, reputation: { ...f.reputation } })
  f.reportDay = s.day; f.openingMoney = s.money; f.metrics = metrics()
}
/** Runs at most once per simulated minute; no work in sandbox or on network clients. */
export function updateFestival(s: GameSnapshot): void {
  const f = s.festival
  if (!f.enabled) {
    const now = festivalTime(s), previous = f.infrastructure.weatherAt ?? now
    f.infrastructure.weatherAt ??= now
    if (now - previous >= 1) {
      f.weather = weatherAt(f, s.day, s.minute / 60)
      f.wetness = clamp(f.wetness + (now - previous) * (f.weather === 'rain' ? .5 : -.2))
      f.infrastructure.weatherAt = now
    }
    return
  }
  if (f.finished) return
  f.infrastructure.weatherAt = festivalTime(s)
  const now = festivalTime(s), minutes = now - f.lastUpdate
  if (minutes < 1) return
  f.lastUpdate = now
  if (s.day !== f.reportDay) recordDay(s)
  if (s.day >= f.startDay + s.dayPlan.leadDays + s.dayPlan.festivalDays) {
    // Sponsors are paid or repaid before the edition is marked finished, so the money
    // lands in this edition's finance column.
    settleSponsors(s, {
      admissions: f.admissions,
      satisfaction: editionSatisfaction(s),
      banners: s.buildings.filter((building) => building.kind === 'banner').length,
      headliner: f.bookings.some((booking) => { const band = BANDS.find((entry) => entry.id === booking.bandId); return Boolean(band && isHeadlinerBand(band)) }),
    })
    evolveMusicAudience(f); f.finished = true; s.parkOpen = false; return
  }
  f.weather = weatherAt(f, s.day, s.minute / 60)
  const storm = stormAt(f, s.day, s.minute)
  if (storm.phase === 'active') f.weather = 'rain'
  trackStormLifecycle(f, storm.phase)
  f.wetness = clamp(f.wetness + minutes * (f.weather === 'rain' ? 0.5 : -0.2))
  const shows = activeBookings(s).filter(b => !showIssue(s, b)).map(b => {
    const stage=s.buildings.find(x=>x.id===b.stageId)!, design=stage.stageDesign
    const phase=design?stagePhase(design,(s.minute-b.start)/b.duration):null
    return {booking:b,stage,band:BANDS.find(x=>x.id===b.bandId)!,boost:design&&phase?stageStats(design).party/100*(phase.volume+phase.intensity)/200:0,noise:phase?phase.volume/100:1}
  })
  for (const stage of s.buildings) {
    if (stage.kind !== 'stage') continue
    stage.bandName = shows.find(show => show.stage.id === stage.id)?.band.name ?? CHANGEOVER_LABEL
  }
  f.playedMusic??={}
  for(const show of shows){const genre=bandGenre(show.band.id);const played=Math.max(0,Math.min(s.minute,show.booking.start+show.booking.duration)-Math.max(s.minute-minutes,show.booking.start));f.playedMusic[genre]=(f.playedMusic[genre]??0)+played*(.5+show.band.draw/100)}
  const audienceConflicts = new Map(GENRES.map(g=>[g.id,shows.filter(show=>musicAppeal(g.id,show.band.id)>=.7).length]))
  const cover = f.upgrades.shelter ? Math.min(1, 250 / Math.max(1, s.visitors.length)) : 0
  const toplessOnSite = s.visitors.some((visitor) => (visitor.toplessMinutes ?? 0) > 0)
  let happiness = 0
  for (const visitor of s.visitors) {
    if (!visitor.audience) assignAudience(visitor, f)
    visitor.musicTaste??=musicTaste(visitor.id,f)
    let weatherImpact = 0
    const sheltered = visitor.state === 'camping' && visitor.campingPhase === 'resting'
    if (storm.phase === 'active') {
      const exposure = stormExposure(visitor, Boolean(f.shelterOrder)) * (1 - cover)
      visitor.needs.energy = clamp(visitor.needs.energy - minutes * SIMULATION_CONFIG.storm.drainPerMinute * exposure)
      visitor.needs.fun = clamp(visitor.needs.fun - minutes * SIMULATION_CONFIG.storm.drainPerMinute * exposure)
      weatherImpact += minutes * SIMULATION_CONFIG.storm.impactPerMinute * exposure
      if (exposure > 0 && visitor.state !== 'partying') visitor.thought = f.shelterOrder ? de('Unwetter! Wir warten unter dem Vordach.') : de('Unwetter! Ich werde klatschnass.')
    }
    if (!sheltered && storm.phase !== 'active' && (f.weather === 'rain' || f.weather === 'heat')) {
      weatherImpact = minutes * 0.12 * (1 - cover)
      if (f.weather === 'heat' && f.upgrades.water && s.buildings.some(b => b.kind === 'toilet' && Math.hypot(b.x - visitor.x, b.z - visitor.z) <= 3 && consumeLocal(s, b.id, 'water'))) { visitor.needs.thirst = Math.min(100, (visitor.needs.thirst ?? 100) + 20) /* Water is dispensed locally at supplied sanitation points. */ }
      else { visitor.needs.energy = clamp(visitor.needs.energy - weatherImpact); visitor.needs.fun = clamp(visitor.needs.fun - weatherImpact) }
    }
    for (const show of shows) {
      const distance = stageDistance(show.stage,visitor)
      if (distance <= 8 && visitor.concertId===show.booking.id && visitor.state === 'partying' && visitor.route.length === 0) {
        const affinity=musicAppeal(visitor.musicTaste,show.band.id),match=affinity>=.7
        const quality = s.bandSupply?.showQualityByStageId[show.stage.id] ?? SIMULATION_CONFIG.bandSupply.bareShowQuality
        visitor.needs.fun = clamp(visitor.needs.fun + minutes * (1.5*affinity) * (1 + show.boost) * quality)
        bookFinance(s, 'sales', minutes * SIMULATION_CONFIG.bandSupply.tipPerWatcherMinute * quality)
        f.metrics.concertMinutes += minutes
        if ((visitor.toplessMinutes ?? 0) > 0) visitor.thought = CONCERT_TOPLESS_THOUGHT
        else if (!(toplessOnSite && visitor.thought === CONCERT_TOPLESS_CROWD_THOUGHT)) {
          visitor.thought = match ? de`${verbatim(show.band.name)} spielen live – genau mein Geschmack!` : de`${verbatim(show.band.name)} spielen live – gute Stimmung!`
        }
        break
      }
      if (distance < 12 && sheltered && s.minute >= 21 * 60 && !f.upgrades.quiet) {
        visitor.needs.energy = clamp(visitor.needs.energy - minutes * 0.5 * show.noise)
        visitor.needs.fun = clamp(visitor.needs.fun - minutes * 0.4 * show.noise)
        visitor.thought = de('Die Bühne neben meinem Zelt lässt mich nicht schlafen.')
      }
    }
    if (visitor.audience === 'comfort' || visitor.audience === 'family') {
      visitor.needs.fun = clamp(visitor.needs.fun - minutes * Math.max(0, visitor.crowding - 60) / 300)
    }
    if ((audienceConflicts.get(visitor.musicTaste) ?? 0) > 1) {
      visitor.needs.fun = clamp(visitor.needs.fun - minutes * 0.15)
      if (
        visitor.state === 'partying' &&
        (visitor.toplessMinutes ?? 0) <= 0 &&
        visitor.thought !== CONCERT_TOPLESS_CROWD_THOUGHT
      ) {
        visitor.thought = de('Meine Lieblingsbands spielen gleichzeitig – ich verpasse einen Auftritt.')
      }
    }
    happiness += moodNeedAverage(visitor)
    f.metrics.weatherImpact += weatherImpact
  }
  if (s.visitors.length) { f.metrics.satisfaction += happiness * minutes; f.metrics.samples += s.visitors.length * minutes }
}


/**
 * Keeps the storm bookkeeping in step with the plan: a storm that starts resets its
 * injury count; one that ends counts as weathered, as calm if nobody was hurt, and
 * lifts a shelter order.
 */
function trackStormLifecycle(f: FestivalManagement, phase: 'none' | 'warning' | 'active'): void {
  const raging = phase === 'active'
  if (raging && f.stormInjuries === undefined) f.stormInjuries = 0
  const wasRaging = (f.stormLive ?? false)
  if (raging && !wasRaging) f.stormInjuries = 0
  if (!raging && wasRaging) {
    const stats = f.stormStats ?? { weathered: 0, calm: 0 }
    f.stormStats = { weathered: stats.weathered + 1, calm: stats.calm + ((f.stormInjuries ?? 0) === 0 ? 1 : 0) }
    if (phase === 'none') f.shelterOrder = false
  }
  f.stormLive = raging
}

export function bookingHoursOpen(s:Readonly<GameSnapshot>,start:number,duration:number){for(let minute=start;minute<start+duration;minute+=Math.min(60-minute%60,start+duration-minute)){if(!s.dayPlan.offers.stages[Math.floor(minute/60)%24])return false}return true}
