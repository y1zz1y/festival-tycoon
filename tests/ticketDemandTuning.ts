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
