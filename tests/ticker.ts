import assert from 'node:assert/strict'
import { GameState } from '../src/game/GameState'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import {
  appendTickerHistory,
  createTickerWatchState,
  observeTickerEvents,
  pickTickerDisplay,
  pruneResolvedTicker,
  type TickerSource,
} from '../src/game/ticker'
import {
  acceptWasteAtDump,
  findNearestWasteDump,
  isParkWasteDumpOverFull,
  normalizeWasteDumpCell,
  parkWasteDumpFill,
  type WasteDumpCell,
} from '../src/game/waste'

function dumpCell(x: number, z: number, stored: number): WasteDumpCell {
  return { x, z, elevation: 0, stored }
}

function source(partial: Partial<TickerSource> = {}): TickerSource {
  return {
    simTick: 10,
    day: 1,
    minute: 12 * 60,
    incidents: [],
    visitors: [],
    wasteDumpCells: [],
    ...partial,
  }
}

export function testTickerAndWasteCaps(): void {
  const dumpCap = SIMULATION_CONFIG.waste.dumpCapacity
  const truckCap = SIMULATION_CONFIG.logistics.garbageTruckCapacity
  assert.equal(dumpCap, 180, 'dump tiles hold 180 units')
  assert.equal(truckCap, 100, 'garbage trucks hold 100 units')
  assert.equal(SIMULATION_CONFIG.waste.dumpFullRatio, 0.9)

  const dump = dumpCell(0, 0, dumpCap - 5)
  assert.equal(acceptWasteAtDump(dump, 20), 5)
  assert.equal(dump.stored, dumpCap)
  assert.equal(acceptWasteAtDump(dump, 8), 0, 'full dumps refuse extra waste')
  assert.equal(dump.stored, dumpCap)

  const loaded = normalizeWasteDumpCell({ x: 2, z: 3, stored: dumpCap + 40 })
  assert.ok(loaded)
  assert.equal(loaded.stored, dumpCap, 'old saves clamp stored to the new cap')

  const park = [dumpCell(0, 0, 162), dumpCell(1, 0, 162)]
  assert.equal(park[0]!.stored / dumpCap, 0.9)
  assert.equal(isParkWasteDumpOverFull(park), false, 'exactly 90% is not over-full')
  park[0]!.stored = 163
  assert.equal(isParkWasteDumpOverFull(park), true)
  const fill = parkWasteDumpFill(park)
  assert.ok(fill)
  assert.equal(fill.capacity, 2 * dumpCap)
  assert.ok(fill.remaining < fill.capacity)

  const full = dumpCell(0, 0, dumpCap)
  const room = dumpCell(4, 0, 10)
  assert.equal(findNearestWasteDump({ x: 0, z: 0 }, [full, room])?.x, 4)
  assert.equal(findNearestWasteDump({ x: 0, z: 0 }, [full]), null)

  const initial = structuredClone(new GameState().snapshot)
  initial.wasteDumpCells = [dumpCell(0, 0, 999)]
  const game = new GameState(initial)
  assert.equal(game.snapshot.wasteDumpCells[0]!.stored, dumpCap)

  const watch = createTickerWatchState()
  const quiet = observeTickerEvents(
    source({
      wasteDumpCells: [dumpCell(0, 0, Math.floor(dumpCap * 0.9))],
    }),
    watch,
  )
  assert.equal(quiet.length, 0, '90% does not warn')

  const crossing = observeTickerEvents(
    source({
      simTick: 11,
      wasteDumpCells: [dumpCell(0, 0, Math.floor(dumpCap * 0.9) + 1)],
    }),
    watch,
  )
  assert.equal(crossing.length, 1)
  assert.equal(crossing[0]!.kind, 'dumpFull')
  assert.ok(crossing[0]!.position)
  assert.equal(crossing[0]!.position!.x, 0.5)
  assert.equal(crossing[0]!.position!.z, 0.5)

  const spam = observeTickerEvents(
    source({
      simTick: 12,
      wasteDumpCells: [dumpCell(0, 0, dumpCap)],
    }),
    watch,
  )
  assert.equal(spam.length, 0, 'dump-full warning is not repeated every tick')

  const later = observeTickerEvents(
    source({
      simTick: 40,
      minute: 12 * 60 + SIMULATION_CONFIG.ticker.dumpFullRepeatMinutes,
      wasteDumpCells: [dumpCell(0, 0, dumpCap)],
    }),
    watch,
  )
  assert.equal(later.length, 1)
  assert.equal(later[0]!.kind, 'dumpFull')

  const fireWatch = createTickerWatchState()
  const fire = observeTickerEvents(
    source({
      incidents: [{ id: 'fire-1', kind: 'fire', x: 3, z: -2 }],
    }),
    fireWatch,
  )
  assert.equal(fire.length, 1)
  assert.equal(fire[0]!.kind, 'fire')
  assert.deepEqual(fire[0]!.position, { x: 3.5, z: -1.5 })
  assert.equal(
    observeTickerEvents(
      source({
        simTick: 11,
        incidents: [{ id: 'fire-1', kind: 'fire', x: 3, z: -2 }],
      }),
      fireWatch,
    ).length,
    0,
    'the same fire does not spam',
  )

  const panicWatch = createTickerWatchState()
  const panic = observeTickerEvents(
    source({
      visitors: [
        { id: 'a', x: 1.2, z: 4.4, isPanicking: true, state: 'panicking' },
        { id: 'b', x: 2, z: 4, isPanicking: true, state: 'walking' },
      ],
    }),
    panicWatch,
  )
  assert.equal(panic.length, 1)
  assert.equal(panic[0]!.kind, 'panic')
  assert.equal(panic[0]!.title, 'Massenpanik')
  assert.ok(panic[0]!.position)
  assert.equal(
    observeTickerEvents(
      source({
        simTick: 11,
        visitors: [
          { id: 'a', x: 1.2, z: 4.4, isPanicking: true, state: 'panicking' },
        ],
      }),
      panicWatch,
    ).length,
    0,
  )

  const seatedWatch = createTickerWatchState()
  const seatedInjured = observeTickerEvents(
    source({
      visitors: [{ id: 'in-car', x: 0.5, z: -17.5, state: 'injured' }],
      logistics: { roadVehicles: [{ passengerIds: ['in-car'] }] },
    }),
    seatedWatch,
  )
  assert.equal(seatedInjured.length, 0, 'injured passengers still in a vehicle stay off the ticker')
  const onFootInjured = observeTickerEvents(
    source({
      visitors: [{ id: 'on-path', x: 2.5, z: -16.5, state: 'injured' }],
      logistics: { roadVehicles: [{ passengerIds: [] }] },
    }),
    seatedWatch,
  )
  assert.equal(onFootInjured.length, 1, 'an injured guest on foot is still reported')
  assert.equal(onFootInjured[0]!.kind, 'medical')

  const history = appendTickerHistory([], [...crossing, ...fire])
  assert.equal(history[0]!.kind, 'dumpFull')
  assert.equal(pickTickerDisplay([...crossing, ...fire])!.kind, 'fire')

  // A message is only worth keeping while its reason is: once the injured are
  // carried off and the crowd has calmed, the entries go rather than filling
  // the panel with problems that were dealt with hours ago.
  const hurt = { id: 'hurt', x: 4.5, z: 2.5, state: 'injured' }
  const scared = { id: 'scared', x: 6.5, z: 1.5, isPanicking: true, state: 'panicking' }
  const blaze = { id: 'fire-9', kind: 'fire', x: 8, z: 3 }
  const trouble = source({ visitors: [hurt, scared], incidents: [blaze] })
  const raised = observeTickerEvents(trouble, createTickerWatchState())
  assert.deepEqual(
    [...raised.map(item => item.kind)].sort(),
    ['fire', 'medical', 'panic'],
    'all three are reported while they are happening',
  )
  assert.deepEqual(raised.find(item => item.kind === 'medical')!.subjects, ['hurt'])
  assert.deepEqual(raised.find(item => item.kind === 'fire')!.subjects, ['fire-9'])
  assert.deepEqual(pruneResolvedTicker(raised, trouble).map(item => item.kind).sort(),
    ['fire', 'medical', 'panic'], 'and nothing is dropped while they still are')

  // Carried off: in a vehicle counts as dealt with, the same as being gone.
  const inAmbulance = source({
    visitors: [hurt, scared],
    incidents: [blaze],
    logistics: { roadVehicles: [{ passengerIds: ['hurt'] }] },
  })
  assert.deepEqual(pruneResolvedTicker(raised, inAmbulance).map(item => item.kind).sort(),
    ['fire', 'panic'], 'the injured message goes once they are in the ambulance')

  const calm = source({ visitors: [{ ...scared, isPanicking: false, state: 'exploring' }], incidents: [blaze] })
  assert.deepEqual(pruneResolvedTicker(raised, calm).map(item => item.kind), ['fire'],
    'panic and injury both go once the crowd has calmed and nobody is hurt')
  assert.deepEqual(pruneResolvedTicker(raised, source()), [], 'and with the fire out, nothing is left')

  // One of two still hurt keeps the message: it is not dealt with yet.
  const both = source({ visitors: [hurt, { id: 'hurt-2', x: 5.5, z: 2.5, state: 'injured' }] })
  const pair = observeTickerEvents(both, createTickerWatchState())
  assert.deepEqual(pair[0]!.subjects, ['hurt', 'hurt-2'])
  assert.equal(pruneResolvedTicker(pair, source({ visitors: [hurt] })).length, 1,
    'while one of them is still down the message stays')

  // Messages from before subjects were recorded fall back to their kind.
  const legacy = { ...pair[0]!, subjects: undefined }
  assert.equal(pruneResolvedTicker([legacy], both).length, 1)
  assert.equal(pruneResolvedTicker([legacy], source()).length, 0)
  console.log('PASS waste caps, no dump overflow, ticker fire/panic/dump-full/seated-injury, settled messages go')
}
