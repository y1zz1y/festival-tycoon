import assert from 'node:assert/strict'
import { GameState } from '../src/game/GameState'
import {
  createTicketDemandTuning,
  normalizeTicketDemandTuning,
} from '../src/game/demandTuning'
import {
  estimateTicketDemand,
  fairTicketPrices,
  purchaseWillingness,
  willingnessColor,
} from '../src/game/ticketDemand'
import { applyGameCommand } from '../src/net/commands'

export function testTicketDemandTuning(): void {
  const game = new GameState()
  const baseline = purchaseWillingness(game.snapshot)
  const tuning = createTicketDemandTuning()
  tuning.willingness.day.base += 0.35
  tuning.fairPrice.dayWillingnessFactor += 0.8
  tuning.attendance.dayAcceptanceShare += 0.4

  const result = applyGameCommand(game, { type: 'updateDemandTuning', tuning })
  assert.equal(result.ok, true)
  assert.equal(game.snapshot.festival.demandTuning.willingness.day.base, tuning.willingness.day.base)
  const adjusted = purchaseWillingness(game.snapshot)
  assert.ok(adjusted.day > baseline.day, 'debug tuning changes live willingness')

  const fair = fairTicketPrices(adjusted, tuning)
  assert.ok(fair.day > fairTicketPrices(adjusted).day)
  const estimate = estimateTicketDemand(game.snapshot)
  assert.ok(Number.isFinite(estimate.expectedDayRevenue))
  assert.ok(estimate.expectedDayGuests >= 0)

  // Slider accents (festivalUI --range-accent) come from these thresholds.
  assert.equal(willingnessColor(0.7), '#3dba6b')
  assert.equal(willingnessColor(0.5), '#d4b43a')
  assert.equal(willingnessColor(0.2), '#d4543a')
  assert.match(estimate.dayColor, /^#[0-9a-f]{6}$/i)
  assert.match(estimate.campingColor, /^#[0-9a-f]{6}$/i)

  const cheap = estimateTicketDemand(game.snapshot, { day: 20, camping: 40 })
  const expensive = estimateTicketDemand(game.snapshot, { day: 250, camping: 500 })
  // Higher price must not look more appealing than a bargain on the same lineup.
  const rank = (color: string) =>
    color === '#3dba6b' ? 2 : color === '#d4b43a' ? 1 : 0
  assert.ok(rank(cheap.dayColor) >= rank(expensive.dayColor))
  assert.ok(rank(cheap.campingColor) >= rank(expensive.campingColor))

  const normalized = normalizeTicketDemandTuning({
    ...tuning,
    priceAcceptance: {
      fullUntilRatio: 4,
      floorFromRatio: 2,
      minimum: Number.NaN,
    },
    arrivals: { minimum: 2, base: 1, acceptanceFactor: 1, maximum: 1 },
  })
  assert.ok(normalized.priceAcceptance.floorFromRatio > normalized.priceAcceptance.fullUntilRatio)
  assert.equal(normalized.arrivals.maximum, 2)
  assert.ok(Number.isFinite(normalized.priceAcceptance.minimum))
}
