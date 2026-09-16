import assert from 'node:assert/strict'
import { GameState } from '../src/game/GameState'
import { decorationKindsInCategory } from '../src/game/decoration'
import { WALL_KINDS, isWallDoor, wallSpec } from '../src/game/decorationWalls'
import {
  isPedestrianBarrierKind,
  pedestrianBarrierOccupancy,
} from '../src/game/scenery'

type WalkGame = {
  findPath: (
    start: { x: number; z: number; elevation: number },
    goals: Array<{ x: number; z: number; elevation: number }>,
    allowQueue?: boolean,
    allowCamping?: boolean,
    allowMedical?: boolean,
    ignoreDirectional?: boolean,
    allowFestival?: boolean,
    maxVisited?: number,
    allowStaff?: boolean,
  ) => Array<{ x: number; z: number; elevation: number }> | null
  isPedestrianSolidAt: (x: number, z: number, elevation: number) => boolean
  isPedestrianEdgeBlocked: (
    from: { x: number; z: number; elevation: number },
    to: { x: number; z: number; elevation: number },
  ) => boolean
  pedestrianPathCache: Map<string, { path: unknown; expires: number }>
}

function walk(
  game: GameState,
  from: { x: number; z: number; elevation: number },
  to: { x: number; z: number; elevation: number },
  allowStaff = false,
) {
  return (game as unknown as WalkGame).findPath(
    from,
    [to],
    false,
    false,
    false,
    false,
    false,
    undefined,
    allowStaff,
  )
}

function encloseTile(game: GameState, kind: 'hedge' | 'picketFence' | 'wallAdobeFull' | 'wallAdobeDoor', x: number, z: number): string[] {
  const ids: string[] = []
  for (let slot = 0; slot < 4; slot++) {
    const result = game.place(kind, x, z, slot)
    assert.ok(result.ok, `${kind} slot ${slot}: ${result.message}`)
    ids.push(game.snapshot.buildings.at(-1)!.id)
  }
  return ids
}

export function testPedestrianBarriers(fixture: (count?: number) => GameState): void {
  assert.equal(pedestrianBarrierOccupancy({ kind: 'fence', rotation: 2 }), 2)
  assert.equal(pedestrianBarrierOccupancy({ kind: 'hedge', rotation: 0, decorationSlot: 1 }), 1)
  assert.equal(pedestrianBarrierOccupancy({ kind: 'hedge', rotation: 0 }), 'solid')
  assert.equal(pedestrianBarrierOccupancy({ kind: 'hedge', rotation: 0, decorationSlot: 4 }), 'solid')
  assert.equal(pedestrianBarrierOccupancy({ kind: 'picketFence', rotation: 0, decorationSlot: 3 }), 3)
  assert.equal(pedestrianBarrierOccupancy({ kind: 'wallAdobeFull', rotation: 0, decorationSlot: 0 }), 0)
  assert.equal(pedestrianBarrierOccupancy({ kind: 'wallAdobeDoor', rotation: 0, decorationSlot: 0 }), undefined)
  assert.equal(pedestrianBarrierOccupancy({ kind: 'banner', rotation: 0, decorationSlot: 0 }), undefined)
  assert.equal(isWallDoor('wallAdobeDoor'), true)
  assert.equal(isWallDoor('wallAdobeFull'), false)
  assert.equal(isPedestrianBarrierKind('hedge'), true)
  assert.equal(isPedestrianBarrierKind('banner'), false)

  for (const kind of decorationKindsInCategory('fence')) {
    assert.ok(isPedestrianBarrierKind(kind), `${kind} in Zaun blocks pedestrians`)
    assert.equal(
      pedestrianBarrierOccupancy({ kind, rotation: 0, decorationSlot: 2 }),
      kind === 'fence' ? 0 : 2,
      `${kind} edge occupancy`,
    )
  }
  for (const kind of WALL_KINDS) {
    const spec = wallSpec(kind)!
    if (spec.shape === 'Door') {
      assert.equal(isPedestrianBarrierKind(kind), false, `${kind} stays passable`)
      assert.equal(pedestrianBarrierOccupancy({ kind, rotation: 0, decorationSlot: 1 }), undefined)
    } else {
      assert.ok(isPedestrianBarrierKind(kind), `${kind} blocks`)
      assert.equal(pedestrianBarrierOccupancy({ kind, rotation: 0, decorationSlot: 1 }), 1)
      assert.equal(pedestrianBarrierOccupancy({ kind, rotation: 0 }), 'solid')
    }
  }

  const nav = fixture(0) as GameState & WalkGame
  const start = { x: 2, z: -20, elevation: 0 }
  const openGoal = { x: 2, z: -18, elevation: 0 }
  const boxed = { x: 2, z: -16, elevation: 0 }
  assert.ok(walk(nav, start, boxed), 'open corridor reaches the boxed cell')

  encloseTile(nav, 'hedge', boxed.x, boxed.z)
  assert.equal(nav.isPedestrianSolidAt(boxed.x, boxed.z, 0), false, 'edge hedges keep the tile interior walkable')
  assert.ok(
    nav.isPedestrianEdgeBlocked(boxed, { x: boxed.x + 1, z: boxed.z, elevation: 0 }),
    'edge hedge blocks crossing that edge',
  )
  assert.equal(walk(nav, start, boxed), null, 'visitors cannot path through a hedge enclosure')
  assert.equal(walk(nav, start, boxed, true), null, 'staff cannot path through a hedge enclosure')
  assert.ok(walk(nav, start, openGoal), 'parallel tiles stay reachable')

  const wallBox = fixture(0)
  const wallGoal = { x: 3, z: -14, elevation: 0 }
  encloseTile(wallBox, 'wallAdobeFull', wallGoal.x, wallGoal.z)
  assert.equal(walk(wallBox, start, wallGoal), null, 'solid wall segments block guests')
  assert.equal((wallBox as unknown as WalkGame).isPedestrianSolidAt(wallGoal.x, wallGoal.z, 0), false)

  const doorBox = fixture(0)
  for (const slot of [0, 1, 2] as const) {
    assert.ok(doorBox.place('wallAdobeFull', 3, -12, slot).ok)
  }
  assert.ok(doorBox.place('wallAdobeDoor', 3, -12, 3).ok, 'door is the passable wall piece')
  const throughDoor = { x: 3, z: -12, elevation: 0 }
  const westOfDoor = { x: 2, z: -12, elevation: 0 }
  assert.ok(walk(doorBox, westOfDoor, throughDoor), 'guests walk through a wall door')
  assert.ok(walk(doorBox, westOfDoor, throughDoor, true), 'staff walk through a wall door')
  assert.equal(
    (doorBox as unknown as WalkGame).isPedestrianEdgeBlocked(westOfDoor, throughDoor),
    false,
    'door edge stays open',
  )

  const fenceGame = fixture(0)
  fenceGame.snapshot.buildRotation = 1
  assert.ok(fenceGame.place('fence', 2, -10).ok)
  assert.ok(
    (fenceGame as unknown as WalkGame).isPedestrianEdgeBlocked(
      { x: 2, z: -10, elevation: 0 },
      { x: 3, z: -10, elevation: 0 },
    ),
    'classic fence still blocks its rotated edge',
  )
  assert.equal((fenceGame as unknown as WalkGame).isPedestrianSolidAt(2, -10, 0), false)

  const themed = fixture(0)
  encloseTile(themed, 'picketFence', 4, -8)
  assert.equal(walk(themed, { x: 2, z: -8, elevation: 0 }, { x: 4, z: -8, elevation: 0 }), null)

  const fullTile = fixture(0)
  assert.ok(fullTile.place('hedge', 4, -6, 0).ok)
  const legacy = fullTile.snapshot.buildings.find((building) => building.kind === 'hedge' && building.x === 4)!
  delete legacy.decorationSlot
  fullTile.worldRevision += 1
  assert.equal((fullTile as unknown as WalkGame).isPedestrianSolidAt(4, -6, 0), true, 'legacy full-tile hedge occupies the whole cell')
  assert.equal(walk(fullTile, { x: 2, z: -6, elevation: 0 }, { x: 4, z: -6, elevation: 0 }), null)

  const banners = fixture(0)
  for (let slot = 0; slot < 4; slot++) assert.ok(banners.place('banner', 3, -4, slot).ok)
  assert.ok(walk(banners, { x: 2, z: -4, elevation: 0 }, { x: 3, z: -4, elevation: 0 }), 'banners are not fences')

  const invalidate = fixture(0)
  const from = { x: 2, z: -2, elevation: 0 }
  const goal = { x: 4, z: -2, elevation: 0 }
  assert.ok(walk(invalidate, from, goal))
  const cached = [...(invalidate as unknown as WalkGame).pedestrianPathCache.values()][0]
  const ids = encloseTile(invalidate, 'hedge', goal.x, goal.z)
  assert.equal(walk(invalidate, from, goal), null, 'placing barriers invalidates routes immediately')
  assert.equal(
    [...(invalidate as unknown as WalkGame).pedestrianPathCache.values()].includes(cached),
    false,
    'fence placement does not keep the stale crowd cache entry',
  )
  for (const id of ids) assert.ok(invalidate.bulldoze(goal.x, goal.z, id).ok)
  assert.ok(walk(invalidate, from, goal), 'removing barriers restores the route')
}
