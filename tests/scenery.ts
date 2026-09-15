import assert from 'node:assert/strict'
import { AtmosphereSystem } from '../src/game/atmosphere'
import { GameState } from '../src/game/GameState'
import { BUILDINGS } from '../src/game/catalog'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import { isEdgeScenery, SCENERY_KINDS, scenerySlot, sceneryTransform, sceneryOverlaps } from '../src/game/scenery'
import { enableMultiplayerCommands } from '../src/net/bind'
import { packWorld } from '../src/net/codec'
import type { GameCommand } from '../src/net/protocol'

const NEW_DECO_KINDS = [
  'picketFence', 'ropeFence', 'streamers',
  'trafficCone', 'crateStack', 'oilDrum', 'pinwheel', 'windSock',
  'hangingBasket', 'cactusPot', 'gnome', 'windChimes', 'chalkboard',
  'loungeChair', 'beanBag', 'tikiTorch', 'decoSpeaker', 'boombox', 'photoFrame',
  'discoBall', 'inflatableCactus', 'giantMushroom', 'crystalTotem', 'welcomeArch',
] as const

function atmosphereAt(
  kind: (typeof SCENERY_KINDS)[number],
  x = 0,
  z = 0,
  extra: Array<{ kind: (typeof SCENERY_KINDS)[number]; x: number; z: number }> = [],
) {
  const buildings = [{ id: 'a', kind, x, z, elevation: 0, rotation: 0 }, ...extra.map((item, index) => ({
    id: `b${index}`,
    kind: item.kind,
    x: item.x,
    z: item.z,
    elevation: 0,
    rotation: 0,
  }))]
  return new AtmosphereSystem().calculate(buildings, [], [], [])
}

export function testScenery(fixture: (count?: number) => GameState): void {
  const game = fixture(0), s = game.snapshot
  for (const [slot, kind] of ['flowerbed', 'planter', 'rock', 'statue'].entries()) {
    const result = game.place(kind as any, 10, 0, slot)
    assert.ok(result.ok, result.message)
  }
  const items = s.buildings.filter(b => b.x === 10 && b.z === 0)
  assert.equal(items.length, 4)
  assert.equal(game.canPlace('shrub', 10, 0, 2).ok, false, 'occupied quarter cannot overlap')
  assert.equal(game.canPlace('shrub', 10, 0, 7).ok, false)
  assert.equal(game.canPlace('food', 10, 0).ok, false, 'whole-tile buildings respect every occupied quarter')
  const selected = game.getAt(10, 0, undefined, .75, .75)!
  assert.equal(selected.kind, 'statue')
  assert.ok(game.bulldoze(10, 0, selected.id).ok)
  assert.equal(s.buildings.filter(b => b.x === 10 && b.z === 0).length, 3)
  assert.equal(game.bulldoze(11, 0, items[0]!.id).ok, false, 'targeted removal cannot affect another cell')
  assert.ok(game.canPlace('shrub', 10, 0, 3).ok)

  for (let side = 0; side < 4; side++) assert.ok(game.place('hedge', 3, -20, side).ok)
  assert.equal(game.canPlace('banner', 3, -20, 2).ok, false, 'same edge cannot be reused')
  assert.ok(game.getPathAt(3, -20))
  assert.equal((game as any).isPedestrianSolidAt(3, -20, 0), false, 'edge decorations keep the path walkable')
  assert.equal(game.getAt(3, -20, undefined, .5, .5)!.kind, 'path', 'center selects path, not surrounding hedge')
  assert.ok(game.place('banner', 12, 0, 1).ok)
  assert.ok(game.placePathSegment(12, 0, 0).ok, 'paths can also be built after edge scenery')

  assert.ok(game.place('tree', 14, 0, 0).ok)
  assert.ok(game.place('flowerbed', 14, 0, 1).ok)
  assert.equal(game.canPlace('food', 14, 0).ok, false, 'clearable tree cannot hide a flowerbed collision')
  const tree = s.buildings.find(b => b.kind === 'tree' && b.x === 14)!
  delete tree.decorationSlot
  const restored = GameState.fromJSON(JSON.stringify(s))!
  const legacy = restored.snapshot.buildings.find(b => b.id === tree.id)!
  assert.deepEqual(sceneryTransform(legacy), { x: .5, z: .5, rotation: tree.rotation, sx: 1, sy: 1, sz: 1 })
  assert.equal(restored.snapshot.buildings.filter(b => b.x === 10 && b.z === 0).length, 3)
  assert.deepEqual(restored.snapshot.buildings.filter(b => b.x === 10).map(b => b.decorationSlot), [0, 1, 2])
  assert.ok(game.bulldozeArea([{ x: 10, z: 0 }]).ok)
  assert.equal(s.buildings.filter(b => b.x === 10 && b.z === 0).length, 0, 'area removal includes every quarter')

  for (let rotation = 0; rotation < 4; rotation++) {
    const slot = scenerySlot('banner', .5, .95, rotation)!
    assert.equal(slot, rotation)
    const placed = sceneryTransform({ kind: 'banner', rotation, decorationSlot: slot })
    assert.equal(placed.rotation, rotation)
  }
  assert.equal(scenerySlot('flowerbed', .75, .25), 1)
  assert.equal(sceneryOverlaps({ kind: 'flowerbed', rotation: 0, decorationSlot: 0 }, { kind: 'hedge', rotation: 0, decorationSlot: 0 }), false)
  assert.ok(game.place('totem', 16, 0, 0).ok)
  assert.ok(game.place('prayerFlags', 16, 0, 0).ok, 'quarter totem and edge prayer flags can share a tile')
  assert.equal(game.canPlace('lightBalloon', 16, 0).ok, false, 'full-tile balloon cannot sit on occupied quarters')
  assert.ok(game.place('lightBalloon', 17, 0).ok)
  assert.equal(game.canPlace('flowerbed', 17, 0, 1).ok, false, 'daylight balloon occupies the whole tile')
  assert.equal(scenerySlot('prayerFlags', .5, .95, 0), 0)
  assert.equal(sceneryOverlaps({ kind: 'prayerFlags', rotation: 0, decorationSlot: 0 }, { kind: 'bunting', rotation: 0, decorationSlot: 0 }), true)

  const client = fixture(0), host = fixture(0), sent: GameCommand[] = []
  client.networkMode = 'client'; enableMultiplayerCommands(client)
  client.commandOutbox = command => sent.push(command)
  client.rotateBuild()
  assert.ok(client.place('statue', 10, 0, 3).ok)
  assert.equal(client.snapshot.buildings.at(-1)!.decorationSlot, 3, 'optimistic construction keeps sub-tile placement')
  host.networkMode = 'host'; host.schedulePublicCommand(sent[0]!)
  const built = host.snapshot.buildings.at(-1)!
  assert.equal(built.decorationSlot, 3); assert.equal(built.rotation, 1)
  client.applyNetworkWorld(structuredClone(packWorld(host.snapshot)))
  assert.equal(client.snapshot.buildings.find(b => b.id === built.id)!.decorationSlot, 3)

  const sources = SIMULATION_CONFIG.atmosphere.sources
  const beauties = new Set<number>()
  for (const kind of SCENERY_KINDS) {
    const source = sources[kind as keyof typeof sources]
    assert.ok(source, `${kind} needs an atmosphere source`)
    assert.ok(source.range >= 1, `${kind} needs a reach`)
    beauties.add(source.beauty)
  }
  assert.ok(beauties.size >= 12, 'scenery attractiveness must differ by kind')
  assert.ok(sources.trafficCone.beauty < sources.photoFrame.beauty)
  assert.ok(sources.photoFrame.beauty < sources.welcomeArch.beauty)
  assert.ok(sources.hayBale.beauty < sources.statue.beauty)

  const cheap = atmosphereAt('trafficCone')
  const centerpiece = atmosphereAt('welcomeArch')
  const cheapHere = cheap.attractivenessValues.get('0,0,0') ?? 0
  const archHere = centerpiece.attractivenessValues.get('0,0,0') ?? 0
  const archFar = centerpiece.attractivenessValues.get('3,0,0') ?? 0
  const cheapFar = cheap.attractivenessValues.get('3,0,0') ?? 0
  assert.ok(archHere > cheapHere, 'centerpiece deco must outshine a cheap cone')
  assert.ok(archFar > cheapFar, 'longer range must still be felt three tiles away')
  assert.equal(cheapFar, 0, 'tiny deco stays local')

  const oneStatue = atmosphereAt('statue')
  const stacked = atmosphereAt('statue', 0, 0, [{ kind: 'statue', x: 0, z: 0 }])
  const one = oneStatue.attractivenessValues.get('0,0,0') ?? 0
  const two = stacked.attractivenessValues.get('0,0,0') ?? 0
  assert.ok(two > one, 'stacked deco still adds attractiveness')
  assert.ok(two < one * 2, 'stacked beauty uses diminishing returns')

  const decoGame = fixture(0)
  for (const [index, kind] of NEW_DECO_KINDS.entries()) {
    const x = -8 + (index % 8)
    const z = 6 + Math.floor(index / 8)
    const result = decoGame.place(kind, x, z, isEdgeScenery(kind) ? 0 : index % 4)
    assert.ok(result.ok, `${kind}: ${result.message}`)
    const placed = decoGame.snapshot.buildings.find((building) => building.kind === kind && building.x === x)
    assert.ok(placed)
    assert.equal(placed.decorationSlot !== undefined, true, `${kind} stores a decoration slot`)
    assert.equal(BUILDINGS[kind].appeal > 0, true)
  }
  assert.ok(decoGame.place('picketFence', 16, 2, 1).ok)
  assert.equal(decoGame.canPlace('ropeFence', 16, 2, 1).ok, false, 'deco fences share edge slots')
  assert.ok(decoGame.place('streamers', 16, 2, 0).ok)
  assert.ok(decoGame.place('gnome', 16, 2, 0).ok, 'quarter gnome can sit with unused edges')

  const stale = fixture(0)
  stale.snapshot.buildings.push({
    id: 'ghost-deco',
    kind: 'unknownFutureDeco' as any,
    x: 0,
    z: 4,
    elevation: 0,
    rotation: 0,
    price: 0,
  })
  const reloaded = GameState.fromJSON(JSON.stringify(stale.snapshot))!
  assert.equal(reloaded.snapshot.buildings.some((building) => building.id === 'ghost-deco'), false)
  assert.equal(reloaded.snapshot.buildings.some((building) => (building.kind as string) === 'unknownFutureDeco'), false)

  console.log('PASS quarter/edge scenery, exact picking/removal, walkable paths, legacy saves, deco attractiveness and optimistic multiplayer placement')
}
