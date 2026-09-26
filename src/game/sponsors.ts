import { bookFinance } from './finance'
import { hashStringSeed } from './rng'
import { SIMULATION_CONFIG } from './simulationConfig'
import type { GameSnapshot } from './types/snapshot'

/**
 * Sponsors: before an edition starts the planning offers a few contracts. Signing one
 * pays an advance at once; at the end of the edition a fulfilled contract pays its
 * bonus, a broken one takes the advance back. Offers are rolled from the simulation
 * state when the planning opens, so every client sees the same ones. The brands are
 * made up.
 */
export type SponsorCondition = 'admissions' | 'satisfaction' | 'banners' | 'headliner'
export type SponsorStatus = 'offered' | 'signed' | 'fulfilled' | 'failed'
export type SponsorContract = {
  id: string
  sponsor: string
  condition: SponsorCondition
  target: number
  advance: number
  bonus: number
  status: SponsorStatus
}

const CONFIG = SIMULATION_CONFIG.sponsors

const BRANDS: readonly { name: string; condition: SponsorCondition }[] = [
  { name: 'Brausewerk Limonaden', condition: 'admissions' },
  { name: 'Knallhart Energy', condition: 'headliner' },
  { name: 'Omas Bratwurstbude', condition: 'satisfaction' },
  { name: 'Zeltplatz24', condition: 'admissions' },
  { name: 'Funkturm Mobilfunk', condition: 'banners' },
  { name: 'Matschfest Gummistiefel', condition: 'satisfaction' },
  { name: 'Rostfrei Bier', condition: 'banners' },
]

export const SPONSOR_CONDITION_TEXT: Record<SponsorCondition, (target: number) => string> = {
  admissions: (target) => `mindestens ${target.toLocaleString('de-DE')} Anreisen`,
  satisfaction: (target) => `Zufriedenheit mindestens ${target} %`,
  banners: (target) => `${target} Festivalbanner auf dem Gelände`,
  headliner: () => 'ein Headliner (5 Sterne) im Programm',
}

/** Offers for the coming edition, `CONFIG.offers` of them, never the same brand twice. */
export function rollSponsorOffers(seedText: string, edition: number): SponsorContract[] {
  const seed = hashStringSeed(`sponsors:${seedText}:${edition}`)
  const shuffled = [...BRANDS].sort((left, right) => hashStringSeed(`${seed}:${left.name}`) - hashStringSeed(`${seed}:${right.name}`))
  // Different conditions first, so the offers are real alternatives.
  const brands = [
    ...shuffled.filter((brand, index) => shuffled.findIndex((other) => other.condition === brand.condition) === index),
    ...shuffled.filter((brand, index) => shuffled.findIndex((other) => other.condition === brand.condition) !== index),
  ]
  return brands.slice(0, CONFIG.offers).map((brand, index) => {
    const advance = Math.round((CONFIG.advanceBase + CONFIG.advancePerEdition * edition) * (1 + index * 0.15) / 50) * 50
    const target = brand.condition === 'admissions'
      ? Math.round((CONFIG.admissionsBase + CONFIG.admissionsPerEdition * edition) / 50) * 50
      : brand.condition === 'satisfaction'
        ? Math.min(90, CONFIG.satisfactionBase + CONFIG.satisfactionPerEdition * edition)
        : brand.condition === 'banners'
          ? CONFIG.bannersBase + edition
          : 1
    return {
      id: `sponsor-${edition}-${index}`,
      sponsor: brand.name,
      condition: brand.condition,
      target,
      advance,
      bonus: Math.round(advance * CONFIG.bonusFactor / 50) * 50,
      status: 'offered' as const,
    }
  })
}

/** Signs an offer before the edition starts: the advance is booked at once. */
export function signSponsor(s: GameSnapshot, id: string): { ok: boolean; message: string } {
  const f = s.festival
  if (f.enabled && !f.finished) return { ok: false, message: 'Sponsorverträge vor dem Festivalstart unterschreiben' }
  const offer = f.sponsorOffers?.find((entry) => entry.id === id && entry.status === 'offered')
  if (!offer) return { ok: false, message: 'Dieses Angebot gibt es nicht mehr' }
  if ((f.sponsors ?? []).filter((entry) => entry.status === 'signed').length >= CONFIG.maximumSigned) {
    return { ok: false, message: `Höchstens ${CONFIG.maximumSigned} Sponsoren je Ausgabe` }
  }
  offer.status = 'signed'
  f.sponsors = [...(f.sponsors ?? []).filter((entry) => entry.status === 'signed'), { ...offer }]
  f.sponsorOffers = f.sponsorOffers!.filter((entry) => entry.id !== id)
  bookFinance(s, 'sponsors', offer.advance)
  return { ok: true, message: `${offer.sponsor} unterschrieben · ${offer.advance.toLocaleString('de-DE')} € Vorschuss` }
}

/** Whether a signed contract's condition holds, given what the edition achieved. */
export function sponsorConditionMet(
  contract: SponsorContract,
  result: { admissions: number; satisfaction: number; banners: number; headliner: boolean },
): boolean {
  if (contract.condition === 'admissions') return result.admissions >= contract.target
  if (contract.condition === 'satisfaction') return result.satisfaction >= contract.target
  if (contract.condition === 'banners') return result.banners >= contract.target
  return result.headliner
}

/**
 * The edition is over: pays bonuses, takes back advances. Called right before the
 * edition is marked finished, so the money lands in its own finance column.
 */
export function settleSponsors(
  s: GameSnapshot,
  result: { admissions: number; satisfaction: number; banners: number; headliner: boolean },
): { fulfilled: number; failed: number } {
  const f = s.festival
  let fulfilled = 0
  let failed = 0
  for (const contract of f.sponsors ?? []) {
    if (contract.status !== 'signed') continue
    if (sponsorConditionMet(contract, result)) {
      contract.status = 'fulfilled'
      bookFinance(s, 'sponsors', contract.bonus)
      fulfilled += 1
    } else {
      contract.status = 'failed'
      bookFinance(s, 'sponsors', -contract.advance)
      failed += 1
    }
  }
  f.sponsorsFulfilled = (f.sponsorsFulfilled ?? 0) + fulfilled
  return { fulfilled, failed }
}
