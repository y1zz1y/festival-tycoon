import assert from 'node:assert/strict'
import { Group, InstancedMesh, Mesh, Vector3 } from 'three'
import { GameState } from '../src/game/GameState'
import { createRetroBuilding, batchRetroBuildings } from '../src/view/retroBuildings'
import {
  buildingIdFromObject,
  buildingIdFromUserData,
  resolveMeshPick,
  resolvePickedBuilding,
} from '../src/view/picking'

export function testPicking(fixture: (count?: number) => GameState): void {
  const food = createRetroBuilding('food')!
  const statue = createRetroBuilding('statue')!
  food.userData.buildingId = 'food-1'
  statue.userData.buildingId = 'statue-1'
  statue.position.set(1, 0, 0)
  const source = new Group()
  source.add(food, statue)
  const batches = batchRetroBuildings(source)
  const ids = batches.children.flatMap(
    (child) => ((child as InstancedMesh).userData.buildingIds as Array<string | undefined>) ?? [],
  )
  assert.ok(ids.includes('food-1') && ids.includes('statue-1'), 'instanced scenery must carry building IDs')
  const statueBatch = batches.children.find((child) =>
    ((child as InstancedMesh).userData.buildingIds as string[]).includes('statue-1'),
  ) as InstancedMesh
  const statueIndex = (statueBatch.userData.buildingIds as string[]).indexOf('statue-1')
  assert.equal(
    buildingIdFromUserData(statueBatch.userData, statueIndex),
    'statue-1',
    'instance pick uses the hit mesh, not a neighbor in the same batch',
  )
  assert.equal(buildingIdFromObject(statue, undefined), 'statue-1')
  const nested = new Mesh()
  nested.userData = {}
  const parent = new Group()
  parent.userData.buildingId = 'hedge-7'
  parent.add(nested)
  assert.equal(buildingIdFromObject(nested, undefined), 'hedge-7', 'child meshes inherit the placed building id')

  const game = fixture(0)
  assert.ok(game.place('food', 8, 0).ok)
  assert.ok(game.place('statue', 9, 0, 0).ok)
  assert.ok(game.place('flowerbed', 9, 0, 1).ok)
  assert.ok(game.place('planter', 9, 0, 2).ok)
  assert.ok(game.place('rock', 9, 0, 3).ok)
  const stall = game.snapshot.buildings.find((item) => item.kind === 'food' && item.x === 8)!
  const statueBuilding = game.snapshot.buildings.find((item) => item.kind === 'statue' && item.x === 9)!
  const flower = game.snapshot.buildings.find((item) => item.kind === 'flowerbed' && item.x === 9)!
  const quarterPick = game.getAt(9, 0, undefined, 0.75, 0.25)
  assert.equal(quarterPick?.id, flower.id, 'local tile coords pick the flower quarter')

  const hitStatue = resolveMeshPick(game.snapshot.buildings, [
    { buildingIds: ['statue-other', statueBuilding.id], instanceId: 1, x: 9.25, z: 0.25 },
    { buildingId: flower.id, x: 9.75, z: 0.25 },
    { buildingId: stall.id, x: 8.5, z: 0.5 },
  ])
  assert.equal(hitStatue?.buildingId, statueBuilding.id, 'first ray hit is the statue, not the flower or stall')
  assert.equal(hitStatue?.x, 9)
  assert.ok(game.bulldoze(hitStatue!.x, hitStatue!.z, hitStatue!.buildingId).ok)
  assert.equal(game.snapshot.buildings.some((item) => item.id === statueBuilding.id), false)
  assert.ok(game.snapshot.buildings.some((item) => item.id === flower.id), 'other quarters on the same tile stay')
  assert.ok(game.snapshot.buildings.some((item) => item.id === stall.id), 'adjacent stall stays')

  const neighborHit = resolveMeshPick(game.snapshot.buildings, [
    { buildingId: stall.id, x: 8.6, z: 0.4 },
    { buildingId: flower.id, x: 9.7, z: 0.3 },
  ])
  assert.equal(neighborHit?.buildingId, stall.id, 'a stall mesh in front of neighboring deco is the demolish target')

  const groundThenBuilding = resolveMeshPick(game.snapshot.buildings, [
    { x: 10.2, z: 0.4 },
    { buildingId: flower.id, x: 9.75, z: 0.25 },
  ])
  assert.equal(groundThenBuilding?.buildingId, undefined, 'unlabeled ground in front does not delete a building behind it')
  assert.equal(groundThenBuilding?.x, 10)

  const ride = {
    ...stall,
    id: 'ride-pick',
    kind: 'ride' as const,
    x: 12,
    z: 0,
    rideEntrance: { x: 12, y: 0, z: 1 },
  }
  const gate = resolvePickedBuilding([...game.snapshot.buildings, ride], ride.id, 12.4, 1.2)
  assert.equal(gate?.buildingId, ride.id)
  assert.equal(gate?.x, 12)
  assert.equal(gate?.z, 1, 'ride-gate hits keep the gate cell so bulldoze removes the gate')

  const overhang = resolvePickedBuilding(game.snapshot.buildings, stall.id, 7.2, 0.4)
  assert.equal(overhang?.x, stall.x)
  assert.equal(overhang?.z, stall.z, 'a mesh that spills onto a neighbor still demolishes its own building')

  const missing = resolvePickedBuilding(game.snapshot.buildings, 'gone', 8.5, 0.5)
  assert.equal(missing, null)

  console.log('PASS demolish picking prefers the hit mesh over tile-center or neighbors')
}
