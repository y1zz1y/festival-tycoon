import assert from 'node:assert/strict'
import { GameState } from '../src/game/GameState'
import {
  DEFAULT_WATER_LEVEL,
  TERRAIN_HEIGHT_STEP,
  TERRAIN_SLOPE_MAX,
  isSwimmableHeight,
  isWaterHeight,
  normalizeWaterLevel,
  planTerrainAreaEdit,
  planTerrainEdit,
  applyTerrainChanges,
  getCornerHeight,
  getTerrainHeight,
  tileShowsWater,
  tileVisualCorner,
} from '../src/game/terrain'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import { TerrainShape } from '../src/view/terrainShape'
import { createTerrainBase } from '../src/view/terrainSurface'
import { MeshStandardMaterial } from 'three'
import { TERRAIN_EDIT_TOOLS } from '../src/game/catalog'
import { listedBuildTools } from '../src/game/buildMenu'
import { countSupportPosts, supportGap, tileSupportSolids } from '../src/game/supportOccupancy'

export function testTerrainLand(fixture: (count?: number) => GameState): void {
  assert.equal(DEFAULT_WATER_LEVEL, -0.5)
  assert.equal(SIMULATION_CONFIG.terrain.waterHeight, -0.5)
  assert.equal(TERRAIN_HEIGHT_STEP, 0.5)
  assert.equal(TERRAIN_SLOPE_MAX, 0.5)
  assert.equal(normalizeWaterLevel(undefined), -0.5)
  assert.equal(isWaterHeight(0, -0.5), false)
  assert.equal(isWaterHeight(-1, -0.5), true)
  assert.equal(isSwimmableHeight(0, -0.5), false, 'land at 0 is not a swim tile')
  assert.equal(isSwimmableHeight(-1, -0.5), true, 'a full step below water is deep enough')
  assert.equal(isSwimmableHeight(-0.25, -0.5), false, 'a puddle shallower than minSwimDepth is not a swim tile')
  assert.deepEqual([...TERRAIN_EDIT_TOOLS], ['terrainRaise', 'terrainLower', 'terrainSmooth'])
  const listed = listedBuildTools()
  assert.ok(listed.includes('terrainRaise'))
  assert.ok(listed.includes('terrainLower'))
  assert.ok(listed.includes('terrainSmooth'))
  assert.equal(listed.includes('terrainFlatten'), false)
  assert.equal(listed.includes('terrainRaiseCorner'), false)
  assert.equal(listed.includes('terrainLowerCorner'), false)
  assert.equal(listed.includes('terrainWater'), false)

  const fresh = new GameState()
  assert.equal(fresh.snapshot.waterLevel, -0.5)
  assert.equal(fresh.snapshot.version, 34)
  const loaded = new GameState({
    ...structuredClone(fresh.snapshot),
    waterLevel: undefined as unknown as number,
  })
  assert.equal(loaded.snapshot.waterLevel, -0.5, 'old saves without waterLevel become -0.5')

  const terrain = { heights: {} as Record<string, number> }
  const raise = planTerrainEdit(terrain, 32, 0, 0, 'raise', () => false)
  assert.ok(raise.ok)
  applyTerrainChanges(terrain, raise.changes)
  assert.equal(terrain.heights['0,0'], 0.5, 'first raise is a half step')
  assert.equal(getTerrainHeight(terrain, 1, 0), 0, 'raise does not flood neighbors into a ramp')

  const raiseAgain = planTerrainEdit(terrain, 32, 0, 0, 'raise', () => false)
  assert.ok(raiseAgain.ok)
  applyTerrainChanges(terrain, raiseAgain.changes)
  assert.equal(terrain.heights['0,0'], 1, 'second raise reaches 1')
  assert.equal(getTerrainHeight(terrain, 1, 0), 0)
  assert.equal(getCornerHeight(terrain, 0, 0, () => true), 1)
  assert.equal(tileVisualCorner(terrain, 0, 0, 3, -0.5, () => true), 1, 'high tile stays a plateau')
  assert.equal(tileVisualCorner(terrain, 1, 0, 0, -0.5, () => true), 0.5, 'low neighbor slopes at most 0.5')

  const corner = planTerrainEdit({ heights: {} }, 32, 2, 2, 'raiseCorner', () => false, 2)
  assert.ok(corner.ok)
  const water = planTerrainEdit({ heights: {} }, 32, 3, 3, 'water', () => false)
  assert.ok(water.ok)
  const pond = { heights: {} as Record<string, number> }
  applyTerrainChanges(pond, water.changes)
  assert.ok(isWaterHeight(pond.heights['3,3'] ?? 0, -0.5))

  const shore = { heights: { '1,0': -1 } as Record<string, number> }
  assert.equal(tileVisualCorner(shore, 0, 0, 3, -0.5, () => true), -0.5, 'land drops 0.5 toward water')
  assert.equal(tileShowsWater(shore, 0, 0, -0.5, () => true), true, 'water appears on the downward shore slope')
  assert.equal(isWaterHeight(0, -0.5), false, 'the shore tile itself is not a swim cell')

  const plateau = { heights: { '0,0': 2, '1,0': 2, '0,1': 0, '1,1': 0 } as Record<string, number> }
  const smoothed = planTerrainAreaEdit(
    plateau,
    32,
    [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 0, z: 1 },
      { x: 1, z: 1 },
    ],
    'smooth',
    () => false,
    2,
  )
  assert.ok(smoothed.ok)
  applyTerrainChanges(plateau, smoothed.changes)
  assert.equal(plateau.heights['0,1'], 2)
  assert.equal(plateau.heights['1,1'], 2)

  const game = fixture(1)
  const before = game.worldRevision
  assert.ok(game.editTerrain(6, 2, 'raise').ok, 'land raise/lower still works')
  assert.ok(game.worldRevision > before, 'land edits invalidate navigation immediately')
  assert.equal(game.getTerrainHeight(6, 2), 0.5, 'game raise stores a half step')
  const walk = game as unknown as {
    findPath: (
      start: { x: number; z: number; elevation: number },
      goals: Array<{ x: number; z: number; elevation: number }>,
    ) => Array<{ x: number; z: number; elevation: number }> | null
  }
  const upSlope = walk.findPath(
    { x: 7, z: 2, elevation: 0 },
    [{ x: 6, z: 2, elevation: 0.5 }],
  )
  assert.ok(upSlope && upSlope.length >= 1, 'pedestrians can walk a 0.5 land slope')
  assert.ok(game.editTerrain(10, 2, 'raise').ok)
  assert.ok(game.editTerrain(10, 2, 'raise').ok)
  assert.equal(game.getTerrainHeight(10, 2), 1)
  assert.equal(
    walk.findPath({ x: 11, z: 2, elevation: 0 }, [{ x: 10, z: 2, elevation: 1 }]),
    null,
    'a 1.0 land cliff is not a pedestrian edge',
  )
  const pathOf = (state: GameState) =>
    state as unknown as {
      findPath: (
        start: { x: number; z: number; elevation: number },
        goals: Array<{ x: number; z: number; elevation: number }>,
      ) => unknown
    }
  assert.ok(
    pathOf(game).findPath({ x: 7, z: 2, elevation: 0 }, [{ x: 6, z: 2, elevation: 0.5 }]),
    'land-0 to land-0.5 stays walkable after a raise',
  )
  const cliffNav = fixture(0)
  cliffNav.snapshot.visitors = []
  assert.ok(cliffNav.editTerrain(6, 4, 'raise').ok)
  assert.ok(cliffNav.editTerrain(6, 4, 'raise').ok)
  assert.equal(cliffNav.getTerrainHeight(6, 4), 1)
  assert.equal(
    pathOf(cliffNav).findPath({ x: 7, z: 4, elevation: 0 }, [{ x: 6, z: 4, elevation: 1 }]),
    null,
    'land-0 to land-1 is a cliff, not a walkable edge',
  )
  const area = game.editTerrainArea([{ x: 6, z: 2 }, { x: 6, z: 3 }], 'smooth', 0.5)
  assert.ok(area.ok, area.message)
  assert.equal(game.getTerrainHeight(6, 3), 0.5, 'area smooth uses the start height')

  const lake = game.editTerrain(8, 2, 'water')
  assert.ok(lake.ok)
  assert.equal(game.isWaterTerrain(8, 2), true)
  assert.equal(game.isSwimmableTerrain(8, 2), true)
  assert.equal(game.isSwimmableTerrain(6, 2), false)

  const visitor = game.snapshot.visitors[0]!
  visitor.needs.fun = 20
  visitor.needs.hunger = 100
  visitor.needs.toilet = 100
  visitor.needs.energy = 80
  visitor.state = 'swimming'
  visitor.route = []
  visitor.activityTarget = { x: 8, z: 2, elevation: game.getTerrainHeight(8, 2) }
  visitor.interactionRemaining = 12
  const funBefore = visitor.needs.fun
  for (let i = 0; i < 40; i += 1) game.tick(0.1)
  assert.ok(visitor.needs.fun > funBefore, 'a swimmer on water gains fun')

  const dry = fixture(0)
  dry.snapshot.visitors = []
  assert.equal(dry.isSwimmableTerrain(0, 0), false)

  const cliffWorld = fixture(0).snapshot
  cliffWorld.scenario.worldSize = 32
  cliffWorld.terrain.heights = { '0,0': 1 }
  const cliffShape = new TerrainShape(cliffWorld, new Set())
  assert.equal(cliffShape.sample(0.5, 0.5), 1, 'raised tile stays a flat plateau')
  assert.ok(cliffShape.sample(1.5, 0.5) > 0 && cliffShape.sample(1.5, 0.5) < 0.5 + 1e-9, 'skirt stops at 0.5')
  assert.ok(
    Math.abs(cliffShape.sample(1 - 1e-7, 0.5) - cliffShape.sample(1 + 1e-7, 0.5) - 0.5) < 1e-6,
    'remaining drop after the 0.5 slope is a cliff',
  )
  const stone = new MeshStandardMaterial()
  const halfStep = structuredClone(cliffWorld)
  halfStep.terrain.heights = { '0,0': 0.5 }
  const joined = createTerrainBase(new TerrainShape(halfStep, new Set()), stone)
  const cliffs = createTerrainBase(cliffShape, stone)
  assert.ok(
    cliffs.geometry.index!.count > joined.geometry.index!.count,
    'drops larger than 0.5 add stone cliff faces',
  )
  for (const mesh of [joined, cliffs]) mesh.geometry.dispose()
  stone.dispose()

  const atGrade = countSupportPosts(0, [0, 0, 0, 0])
  assert.equal(atGrade, 0, 'object on flat land-at-grade has no support posts')
  const overHole = countSupportPosts(2, [-1, -1, -1, -1])
  assert.equal(overHole, 4, 'object over a lowered/empty cell has posts')
  assert.equal(supportGap(2, 2), null, 'raising land to the object removes posts')
  const filled = tileSupportSolids(
    [{ id: 'path-1', kind: 'path', x: 0, z: 0, elevation: 2, rotation: 0 }],
    0,
    0,
    'tree-1',
  )
  assert.equal(supportGap(2, -1, filled), null, 'a solid under the object removes posts')

  console.log('PASS land tools 3, step 0.5, area flatten-to-start, cliffs, shore water, swimming, supports, cliff nav')
}
