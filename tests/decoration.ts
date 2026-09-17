import { contextDemolitionTarget } from '../src/game/contextDemolition'
import assert from 'node:assert/strict'
import { BUILDING_KINDS, BUILDINGS } from '../src/game/catalog'
import {
  DEFAULT_DECORATION_THEME,
  DECORATION_CATEGORY_IDS,
  DECORATION_THEMES,
  DECORATION_THEME_IDS,
  FULL_TILE_DECORATION_KINDS,
  THEMED_DECORATION_KINDS,
  decorationCatalogKinds,
  decorationCategoryOf,
  decorationKindsForTheme,
  decorationThemeOf,
  filterDecorationKinds,
} from '../src/game/decoration'
import { GameState } from '../src/game/GameState'
import { isEdgeScenery, isScenery, scenerySlot, sceneryTransform } from '../src/game/scenery'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import { listedBuildTools } from '../src/game/buildMenu'
import {
  DECORATION_LIGHTS,
  decorationLampKinds,
  decorationLightOf,
} from '../src/game/decorationLights'
import { WALL_KINDS, wallSpec, roofWallTop, ROOF_KINDS, roofSpec, THEMED_BIN_KINDS } from '../src/game/decorationWalls'
import { FestivalLightsView } from '../src/view/FestivalLightsView'
import { Vector3 } from 'three'
import { LARGE_SCENERY_KINDS } from '../src/game/scenery'
import { createRetroBuilding } from '../src/view/retroBuildings'
import { Box3 } from 'three'
import { enableMultiplayerCommands } from '../src/net/bind'
import type { GameCommand } from '../src/net/protocol'

export function testDecorationThemes(): void {
  assert.equal(DECORATION_THEME_IDS.length >= 8, true)
  assert.equal(DECORATION_THEME_IDS.length <= 12, true)
  assert.equal(DEFAULT_DECORATION_THEME, 'klassik')
  assert.ok(DECORATION_THEME_IDS.includes('arktis'))
  assert.ok(DECORATION_THEME_IDS.includes('steampunk'))
  assert.equal(DECORATION_THEMES.length, DECORATION_THEME_IDS.length)
  for (const theme of DECORATION_THEMES) {
    assert.ok(theme.label.length > 0, `${theme.id} needs a German label`)
    assert.ok(theme.rationale.length > 12, `${theme.id} needs a rationale`)
    const kinds = decorationKindsForTheme(theme.id)
    assert.ok(kinds.length >= 4, `${theme.id} needs a readable set`)
    assert.equal(new Set(kinds).size, kinds.length, `${theme.id} has duplicate kinds`)
  }

  const klassik = new Set(decorationKindsForTheme('klassik'))
  const arktis = new Set(decorationKindsForTheme('arktis'))
  const steampunk = new Set(decorationKindsForTheme('steampunk'))
  assert.ok(klassik.has('tree'))
  assert.ok(klassik.has('welcomeArch'))
  assert.equal(klassik.has('iceSculpture'), false)
  assert.equal(klassik.has('pipeTotem'), false)
  assert.ok(arktis.has('iceSculpture'))
  assert.ok(arktis.has('auroraLamp'))
  assert.equal(arktis.has('tree'), false)
  assert.equal(arktis.has('gearStack'), false)
  assert.ok(steampunk.has('pipeTotem'))
  assert.ok(steampunk.has('gearStack'))
  assert.equal(steampunk.has('snowman'), false)

  for (const category of DECORATION_CATEGORY_IDS) {
    const klassikItems = filterDecorationKinds('klassik', category)
    const arktisItems = filterDecorationKinds('arktis', category)
    for (const kind of klassikItems) {
      assert.equal(arktisItems.includes(kind), false, `${kind} must not leak into Arktis`)
    }
    for (const kind of arktisItems) {
      assert.equal(klassikItems.includes(kind), false, `${kind} must not leak into Klassik`)
    }
  }
  assert.deepEqual(filterDecorationKinds('wueste', 'furniture'), ['binAdobe'])
  assert.ok(filterDecorationKinds('klassik', 'plants').length > 0)

  const catalog = decorationCatalogKinds()
  assert.equal(new Set(catalog).size, catalog.length)
  for (const kind of catalog) {
    assert.ok((BUILDING_KINDS as readonly string[]).includes(kind), `${kind} missing from catalog`)
    assert.ok(listedBuildTools().includes(kind), `${kind} missing from build menu`)
    assert.ok(decorationThemeOf(kind))
    assert.ok(decorationCategoryOf(kind))
  }
  for (const kind of FULL_TILE_DECORATION_KINDS) {
    assert.equal(isScenery(kind), false, `${kind} stays a full-tile catalog piece`)
    assert.equal(decorationThemeOf(kind), 'klassik')
  }
  for (const kind of THEMED_DECORATION_KINDS) {
    assert.ok(isScenery(kind), `${kind} goes through scenery.ts`)
    assert.ok(BUILDINGS[kind].appeal > 0)
    const source = SIMULATION_CONFIG.atmosphere.sources[kind]
    assert.ok(source, `${kind} needs an atmosphere source`)
    assert.ok(source.range >= 1)
  }
}

export function testThemedDecorationPlacement(fixture: (count?: number) => GameState): void {
  for (const kind of ROOF_KINDS) {
    const roofs = fixture(0)
    assert.ok(roofs.place('wallChaletFull', 10, 6, 0).ok)
    roofs.setBuildElevation(1)
    assert.ok(roofs.place(kind, 10, 6).ok)
    assert.equal(roofs.canPlace(kind, 10, 6).ok, false)
    assert.ok(roofs.place(kind, 11, 6).ok)
    const bounds = new Box3().setFromObject(createRetroBuilding(kind)!)
    assert.ok(bounds.min.y >= -.001 && bounds.max.y <= roofSpec(kind)!.height + .01)
    const loaded = GameState.fromJSON(JSON.stringify(roofs.snapshot))!
    assert.equal(loaded.snapshot.buildings.at(-1)!.kind, kind)
  }
  for (const kind of THEMED_BIN_KINDS) {
    const bins = fixture(0)
    assert.ok(bins.place('path', 10, 6).ok)
    assert.ok(bins.place('path', 10, 7).ok)
    assert.ok(bins.place('bench', 10, 6).ok)
    bins.rotateBuild(); bins.rotateBuild(); bins.rotateBuild()
    assert.ok(bins.place(kind, 10, 6).ok)
    const bench = bins.snapshot.buildings.find(b => b.kind === 'bench')!
    const bin = bins.snapshot.buildings.at(-1)!
    assert.notEqual(bin.rotation, 0, 'do not obstruct the continued path')
    assert.notEqual(bin.rotation, bench.rotation, 'bench and bin use different edges')
    assert.equal(bin.rotation, 3, 'R lets the selected bin face its requested free edge')
    bin.wasteFill = 5
    const loaded = GameState.fromJSON(JSON.stringify(bins.snapshot))!
    assert.equal(loaded.snapshot.buildings.find(b => b.id === bin.id)!.wasteFill, 5)
    assert.equal((loaded as any).isPedestrianSolidAt(10, 6, 0), false)
  }
  const roadsideBench = fixture(0)
  assert.ok(roadsideBench.placeRoadSegment(14, 6, 0).ok)
  assert.ok(roadsideBench.placeRoadSegment(14, 7, 0).ok)
  assert.ok(roadsideBench.canPlace('bench', 14, 6).ok, 'benches may use a road edge')
  assert.ok(roadsideBench.place('bench', 14, 6).ok)
  assert.notEqual(roadsideBench.snapshot.buildings.at(-1)!.rotation, 0, 'road continuation stays clear')
  for (const kind of LARGE_SCENERY_KINDS) {
    const large = fixture(0)
    assert.equal(scenerySlot(kind, .1, .9), 4)
    assert.ok(large.place(kind, 10, 6).ok)
    const item = large.snapshot.buildings.at(-1)!
    assert.equal(item.decorationSlot, 4)
    assert.equal(sceneryTransform(item).sx, 1)
    assert.equal(large.canPlace('flowerbed', 10, 6, 3).ok, false)
    const restored = GameState.fromJSON(JSON.stringify(large.snapshot))!
    assert.equal(restored.snapshot.buildings.find(b => b.id === item.id)!.decorationSlot, 4)
  }
  for (const kind of WALL_KINDS) {
    const spec = wallSpec(kind)!
    const bounds = new Box3().setFromObject(createRetroBuilding(kind)!)
    assert.ok(Math.abs(bounds.max.y - (roofWallTop(spec.shape, spec.shape === 'SlopeLeft' ? -.5 : .5) ?? spec.height)) < .001, `${kind}: stack height`)
    assert.ok(Math.abs(bounds.min.y) < .001)
    assert.ok(Math.abs(bounds.max.x - bounds.min.x - 1) < .001)
    if (roofWallTop(spec.shape, 0) !== undefined) {
      const model = createRetroBuilding(kind)!
      model.traverse(object => {
        const position = (object as any).geometry?.getAttribute('position')
        if (!position) return
        for (let n = 0; n < position.count; n++) assert.ok(position.getY(n) <= roofWallTop(spec.shape, position.getX(n))! + .0001, `${kind}: no detail protrudes above roof profile`)
      })
      const house = fixture(0)
      assert.ok(house.place(kind, 12, 6, 1).ok)
      const roofKind = ROOF_KINDS.find(r => roofSpec(r)!.style === spec.style && roofSpec(r)!.slope)!
      assert.ok(house.place(roofKind, 12, 6).ok, 'roof and its infill coexist')
      const loaded = GameState.fromJSON(JSON.stringify(house.snapshot))!
      assert.ok(loaded.snapshot.buildings.some(b => b.kind === kind && b.decorationSlot === 1))
    }
    const walls = fixture(0)
    assert.ok(walls.place(kind, 10, 6, 0).ok)
    assert.equal(walls.canPlace(kind, 10, 7, 2).ok, false, 'same boundary from neighboring tile')
    assert.ok(walls.place(kind, 10, 6, 1).ok, 'corners connect')
    walls.setBuildElevation(spec.height)
    assert.ok(walls.place(kind, 10, 6, 0).ok, 'flush stacking')
    walls.setBuildElevation(0)
    assert.equal(walls.canPlace(kind, 10, 6, 0).ok, false)
  }
  const demolition = fixture(0)
  assert.ok(demolition.place('path', 10, 6).ok)
  assert.ok(demolition.place('wallChaletFull', 10, 6, 0).ok)
  const wallId = demolition.snapshot.buildings.at(-1)!.id
  const pathId = demolition.snapshot.buildings.find(b => b.kind === 'path' && b.x === 10 && b.z === 6)!.id
  assert.equal(contextDemolitionTarget(demolition.snapshot, 'wallChaletFull', {x:10,z:6}, pathId), undefined)
  assert.equal(contextDemolitionTarget(demolition.snapshot, 'path', {x:10,z:6}, wallId)?.type, 'building')
  const pathTarget = contextDemolitionTarget(demolition.snapshot, 'path', {x:10,z:6}, wallId)!
  assert.equal(pathTarget.type === 'building' && pathTarget.building.id, pathId)
  const wallTarget = contextDemolitionTarget(demolition.snapshot, 'tree', {x:10,z:6}, wallId)!
  assert.equal(wallTarget.type === 'building' && wallTarget.building.id, wallId)
  assert.equal(contextDemolitionTarget(demolition.snapshot, 'road', {x:10,z:6}, wallId), undefined)
  assert.ok(demolition.placeRoadSegment(12,6,0).ok)
  assert.ok(demolition.placeRoadSegment(12,6,1).ok)
  demolition.setBuildElevation(1)
  const roadTarget = contextDemolitionTarget(demolition.snapshot, 'road', {x:12,z:6})!
  assert.equal(roadTarget.type === 'road' && roadTarget.road.elevation, 1)
  if (roadTarget.type === 'road') assert.ok(demolition.undoRoadSegment(12,6,undefined,roadTarget.road.elevation).ok)
  assert.ok(demolition.getRoadCellAt(12,6,0))
  assert.equal(demolition.snapshot.buildings.some(b=>b.id===pathId),true)
  assert.equal(demolition.snapshot.buildings.some(b=>b.id===wallId),true)
  const facade = fixture(0)
  assert.ok(facade.place('food', 10, 6).ok)
  assert.ok(facade.place('wallChaletWindow', 10, 6, 0).ok, 'facade beside building')
  const client = fixture(0), host = fixture(0), sent: GameCommand[] = []
  client.networkMode = 'client'; enableMultiplayerCommands(client)
  client.commandOutbox = command => sent.push(command)
  client.setBuildElevation(.5)
  assert.ok(client.place('wallBrassHalf', 10, 6, 2).ok)
  assert.ok(client.place('miniBigTop', 12, 6, 4).ok)
  host.networkMode = 'host'
  for (const command of sent) host.schedulePublicCommand(command)
  assert.deepEqual(host.snapshot.buildings.slice(-2).map(b => [b.kind, b.elevation, b.decorationSlot]),
    client.snapshot.buildings.slice(-2).map(b => [b.kind, b.elevation, b.decorationSlot]))
  const game = fixture(0)
  for (const [index, kind] of THEMED_DECORATION_KINDS.entries()) {
    const x = -18 + (index % 12)
    const z = 10 + Math.floor(index / 12)
    const slot = isEdgeScenery(kind) ? 0 : index % 4
    const result = game.place(kind, x, z, slot)
    assert.ok(result.ok, `${kind}: ${result.message}`)
    const placed = game.snapshot.buildings.find((building) => building.kind === kind && building.x === x)
    assert.ok(placed)
    assert.equal(placed.decorationSlot, slot)
    assert.equal(isScenery(kind), true)
    assert.notEqual(scenerySlot(kind, 0.25, 0.25, 0), undefined)
  }

  const legacy = fixture(0)
  assert.ok(legacy.place('tree', 14, 4, 0).ok)
  const tree = legacy.snapshot.buildings.find((building) => building.kind === 'tree')!
  delete tree.decorationSlot
  const restored = GameState.fromJSON(JSON.stringify(legacy.snapshot))!
  const loaded = restored.snapshot.buildings.find((building) => building.id === tree.id)!
  assert.equal(loaded.decorationSlot, undefined)
  assert.deepEqual(sceneryTransform(loaded), { x: .5, z: .5, rotation: tree.rotation, sx: 1, sy: 1, sz: 1 })
  assert.equal(restored.canPlace('flowerbed', 14, 4, 1).ok, false, 'legacy full-tile tree still occupies the cell')

  const slotGame = fixture(0)
  assert.ok(slotGame.place('icePine', 10, 6, 0).ok)
  assert.ok(slotGame.place('snowman', 10, 6, 1).ok)
  assert.equal(slotGame.canPlace('gearBench', 10, 6, 1).ok, false, 'themed quarters still use scenery overlap')
  assert.ok(slotGame.place('pipeRail', 10, 6, 0).ok, 'edge rail can share a tile with unused quarters')
  assert.equal(slotGame.canPlace('iceFence', 10, 6, 0).ok, false, 'themed edge slots share scenery.ts')
}

function enableNightLights(game: GameState): void {
  game.snapshot.minute = 23 * 60
  game.snapshot.dayPlan.offers.lights[23] = true
}

export function testDecorationLampLights(fixture: (count?: number) => GameState): void {
  const catalogLamps = decorationLampKinds()
  assert.ok(catalogLamps.length >= 10, 'every theme should expose a Licht piece')
  const colors = new Set<number>()
  for (const kind of catalogLamps) {
    const spec = decorationLightOf(kind)
    assert.ok(spec, `${kind} in Deko → Licht needs a light descriptor`)
    assert.ok(spec.color > 0, `${kind} needs a model-matching color`)
    assert.ok(spec.height > 0, `${kind} needs an emitter height`)
    colors.add(spec.color)
  }
  assert.equal(catalogLamps.length, Object.keys(DECORATION_LIGHTS).length, 'no leftover lamp specs outside the catalog')
  assert.ok(colors.size >= 6, 'themes must not share one generic lamp color')
  assert.equal(decorationLightOf('tree'), undefined, 'plants do not emit festival lights')
  assert.equal(decorationLightOf('iceFence'), undefined, 'fences stay dark unless they are a Licht kind')

  const game = fixture(0)
  enableNightLights(game)
  const first = game.place('auroraLamp', 8, 6)
  const second = game.place('gasLamp', 10, 6)
  const third = game.place('auroraLamp', 12, 6)
  assert.ok(first.ok && second.ok && third.ok)
  const tree = game.place('tree', 14, 6)
  assert.ok(tree.ok)

  const lights = new FestivalLightsView()
  lights.update(game.snapshot)
  assert.equal(lights.activeSourceCount, 3, 'N lamps create N pooled light sources')
  assert.deepEqual(lights.activeSourceKinds().sort(), ['auroraLamp', 'auroraLamp', 'gasLamp'])
  const aurora = decorationLightOf('auroraLamp')!.color
  const gas = decorationLightOf('gasLamp')!.color
  assert.notEqual(aurora, gas)
  assert.deepEqual([...lights.activeSourceColors()].sort(), [aurora, aurora, gas].sort())

  lights.setFocus(new Vector3(8.5, 0, 6.5))
  const pool = (lights as any).pool as { color: { getHex(): number }; intensity: number }[]
  const spots = (lights as any).spots as { intensity: number; parent: unknown }[]
  assert.ok(pool.some(light => light.color.getHex() === aurora && light.intensity > 0), 'aurora uses its ice-green point light')
  assert.ok(pool.some(light => light.color.getHex() === gas && light.intensity > 0), 'gas lamp uses brass light')
  assert.equal(spots.length, 4)
  assert.ok(spots.every(light => light.parent === lights.group), 'floods stay attached even when unused')

  const auroraBuilding = game.snapshot.buildings.find(building => building.kind === 'auroraLamp')!
  assert.ok(game.bulldoze(auroraBuilding.x, auroraBuilding.z, auroraBuilding.id).ok)
  lights.update(game.snapshot)
  assert.equal(lights.activeSourceCount, 2, 'removing a lamp removes its light')
  assert.deepEqual([...lights.activeSourceColors()].sort(), [aurora, gas].sort())

  const flood = fixture(0)
  enableNightLights(flood)
  flood.rotateBuild()
  assert.ok(flood.place('workLamp', 6, 8).ok)
  const floodLights = new FestivalLightsView()
  floodLights.update(flood.snapshot)
  floodLights.setFocus(new Vector3(6.5, 0, 8.5))
  const floodSpots = (floodLights as any).spots as { color: { getHex(): number }; intensity: number; target: { position: { x: number; z: number } }; position: { x: number; z: number } }[]
  const sodium = decorationLightOf('workLamp')!.color
  assert.ok(floodSpots.some(light => light.color.getHex() === sodium && light.intensity > 0), 'Baustrahler uses a sodium flood')
  const aimed = floodSpots.find(light => light.intensity > 0)!
  assert.ok(aimed.target.position.x > aimed.position.x, 'rotating a flood aims the cone')

  flood.snapshot.minute = 12 * 60
  flood.snapshot.dayPlan.offers.lights[12] = false
  floodLights.update(flood.snapshot)
  assert.equal(floodLights.activeSourceCount, 0, 'daylight follows the existing lights schedule')
}
