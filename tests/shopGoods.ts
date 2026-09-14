import assert from 'node:assert/strict'
import { GameState, type GameSnapshot } from '../src/game/GameState'
import { applyGameCommand } from '../src/net/commands'
import { emptyStock, normalizeStock } from '../src/game/supplyChain'
import { SUPPLIES } from '../src/game/festivalManagement'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import {
  SHIRT_STYLES,
  defaultShirtSettings,
  isGeneralGoodsShopKind,
  mascotVariant,
  shopSupplyKind,
} from '../src/game/shopGoods'
import { createMascotGeometry, createShirtStyleGeometry, SouvenirPropsView } from '../src/view/souvenirMeshes'
import { Matrix4 } from 'three'
import { DeterministicRng } from '../src/game/rng'

export function testShopGoods(fixture: (count?: number) => GameState): void {
  assert.equal(shopSupplyKind('food'), 'food')
  assert.equal(shopSupplyKind('alcohol'), 'drinks')
  assert.equal(shopSupplyKind('toilet'), 'water')
  assert.equal(shopSupplyKind('mascot'), 'goods')
  assert.equal(shopSupplyKind('shirt'), 'goods')
  assert.equal(shopSupplyKind('ride'), null)
  assert.ok(isGeneralGoodsShopKind('mascot'))
  assert.ok(isGeneralGoodsShopKind('shirt'))
  assert.equal(isGeneralGoodsShopKind('food'), false)
  assert.ok(SUPPLIES.goods, 'Allgemeine Waren sitzen neben Essen, Getränken und Wasser')
  assert.deepEqual(emptyStock(), { food: 0, drinks: 0, water: 0, goods: 0 })
  assert.equal(normalizeStock({ food: 12 }).goods, 0, 'alte Bestände ohne goods bleiben leer')
  assert.equal(normalizeStock({ food: 12 }).food, 12)

  const game = fixture(2)
  const state = game.snapshot as GameSnapshot
  state.minute = 12 * 60
  state.dayPlan.offers.shops.fill(true)
  game.addDebugMoney()
  assert.ok(game.place('mascot', 6, -20).ok)
  assert.ok(game.place('shirt', 7, -20).ok)
  const mascot = state.buildings.find((building) => building.kind === 'mascot')!
  const shirt = state.buildings.find((building) => building.kind === 'shirt')!
  state.festival.infrastructure.shops[mascot.id] = {
    food: 0,
    drinks: 0,
    water: 0,
    goods: 4,
  }
  state.festival.infrastructure.shops[shirt.id] = {
    food: 0,
    drinks: 0,
    water: 0,
    goods: 4,
  }
  assert.ok(game.placePathSegment(6, -19, 0).ok)
  assert.ok(game.placePathSegment(7, -19, 0).ok)

  const buyer = state.visitors[0]!
  const hunger = buyer.needs.hunger
  buyer.budget = 100
  buyer.targetId = mascot.id
  buyer.state = 'using'
  buyer.cellX = 6
  buyer.cellZ = -19
  buyer.cellElevation = 0
  buyer.x = 6.5
  buyer.z = -18.5
  const holdRng = new DeterministicRng(7)
  ;(game as any).rng = holdRng
  ;(game as any).finishInteraction(buyer)
  assert.equal(buyer.ownedMascot, true)
  assert.equal(buyer.needs.hunger, hunger, 'Maskottchen stillen keinen Hunger')
  assert.ok(buyer.needs.fun > 0)
  assert.equal(state.festival.infrastructure.shops[mascot.id]!.goods, 3)
  const held = buyer.heldMascot
  assert.equal(typeof held, 'boolean')

  let heldCount = 0
  for (let n = 0; n < 40; n++) {
    const guest = state.visitors[1]!
    guest.ownedMascot = false
    guest.heldMascot = false
    guest.budget = 100
    guest.needs.fun = 40
    guest.targetId = mascot.id
    guest.state = 'using'
    guest.cellX = 6
    guest.cellZ = -19
    guest.cellElevation = 0
    ;(game as any).finishInteraction(guest)
    if (guest.heldMascot) heldCount++
    state.festival.infrastructure.shops[mascot.id]!.goods = 8
  }
  assert.ok(heldCount > 0 && heldCount < 40, `nur ein Teil hält das Maskottchen (${heldCount}/40)`)

  assert.equal(game.configureShirtStall(shirt.id, { color: 0x2f6fdb, style: 'hoodie' }).ok, true)
  assert.equal(shirt.shirtColor, 0x2f6fdb)
  assert.equal(shirt.shirtStyle, 'hoodie')
  const wearer = state.visitors[0]!
  wearer.budget = 100
  wearer.targetId = shirt.id
  wearer.state = 'using'
  wearer.cellX = 7
  wearer.cellZ = -19
  wearer.cellElevation = 0
  wearer.wornShirt = undefined
  const funBefore = wearer.needs.fun
  ;(game as any).finishInteraction(wearer)
  assert.deepEqual(wearer.wornShirt, { color: 0x2f6fdb, style: 'hoodie' })
  assert.ok(wearer.needs.fun >= funBefore)

  const other = fixture(1)
  other.addDebugMoney()
  other.snapshot.dayPlan.offers.shops.fill(true)
  assert.ok(other.place('shirt', 5, -20).ok)
  assert.ok(other.placePathSegment(5, -19, 0).ok)
  const second = other.snapshot.buildings.find((building) => building.kind === 'shirt')!
  assert.equal(applyGameCommand(other, { type: 'configureShirtStall', buildingId: second.id, color: 0xe23b3b, style: 'polo' }).ok, true)
  assert.equal(second.shirtColor, 0xe23b3b)
  assert.equal(second.shirtStyle, 'polo')
  other.snapshot.festival.infrastructure.shops[second.id] = {
    food: 0,
    drinks: 0,
    water: 0,
    goods: 2,
  }
  const guest = other.snapshot.visitors[0]!
  guest.budget = 80
  guest.targetId = second.id
  guest.state = 'using'
  guest.cellX = 5
  guest.cellZ = -19
  guest.cellElevation = 0
  guest.x = 5.5
  guest.z = -18.5
  ;(other as any).finishInteraction(guest)
  assert.deepEqual(guest.wornShirt, { color: 0xe23b3b, style: 'polo' })

  const saved = structuredClone(game.snapshot) as GameSnapshot
  delete (saved.visitors[0] as { wornShirt?: unknown }).wornShirt
  delete (saved.visitors[0] as { ownedMascot?: unknown }).ownedMascot
  delete (saved.festival.supplies as { goods?: number }).goods
  const loaded = new GameState(saved)
  assert.equal(loaded.snapshot.festival.supplies.goods, 0)
  assert.equal(loaded.snapshot.visitors[0]!.ownedMascot, false)
  assert.equal(loaded.snapshot.visitors[0]!.wornShirt, undefined)
  const restoredShirt = loaded.snapshot.buildings.find((building) => building.kind === 'shirt')
  assert.ok(restoredShirt)
  assert.equal(restoredShirt!.shirtStyle, 'hoodie')

  const defaults = defaultShirtSettings()
  assert.equal(defaults.style, 'basic')
  for (const style of SHIRT_STYLES) {
    const geometry = createShirtStyleGeometry(style)
    assert.equal(createShirtStyleGeometry(style), geometry)
    assert.ok(geometry.getAttribute('position').count < 160, `${style}: overlay stays compact`)
  }
  const mascotMesh = createMascotGeometry()
  assert.equal(createMascotGeometry(), mascotMesh)
  assert.ok(mascotMesh.getAttribute('position').count < 280, 'shared mascot mesh stays compact')
  const props = new SouvenirPropsView()
  const matrix = new Matrix4()
  props.begin(8)
  props.placeMascot(matrix, mascotVariant(1))
  props.placeShirt('hoodie', matrix, 0x2f6fdb)
  props.finish()
  assert.equal(props.batchCount, 5, 'one mascot batch plus four shirt cuts')

  console.log('PASS shop goods: category, mascot hold chance, shirt appearance, save defaults')
}
