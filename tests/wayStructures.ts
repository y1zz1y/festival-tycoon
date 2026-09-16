import assert from 'node:assert/strict'
import { Group, InstancedMesh } from 'three'
import { createWayStructure, indexWayStructures, wayStructurePlan, type WayStructureCell } from '../src/view/wayStructures'
import { batchRetroBuildings } from '../src/view/retroBuildings'

export function testWayStructures(): void {
  for (const road of [false, true]) for (const slope of [-1, -.5, 0, .5, 1]) for (let direction = 0; direction < 4; direction++) {
    const cell: WayStructureCell = { x: 0, z: 0, elevation: 2, slope, direction, road }
    const plan = wayStructurePlan(cell, indexWayStructures([cell]), 0)
    assert.ok(plan.raised)
    assert.equal(plan.supports.length, 4)
    for (const p of plan.supports) {
      assert.ok(p.top <= -slope / 2 + p.z * slope - .06, 'support stays below local deck')
      assert.equal(p.bottom, -2)
    }
    const mesh = createWayStructure(cell, plan)!
    const vertices = mesh.geometry.getAttribute('position')
    for (let n = 0; n < vertices.count; n++) assert.ok(Number.isFinite(vertices.getY(n)))
    assert.equal(createWayStructure(cell, plan)!.geometry, mesh.geometry)
    const lower = { ...cell, elevation: 0, slope: 0, road: !road }
    assert.equal(wayStructurePlan(cell, indexWayStructures([cell, lower]), 0).supports.length, 0, 'lower crossing stays clear')
  }
  const cell: WayStructureCell = { x: 0, z: 0, elevation: 1, slope: 0, direction: 0, road: false }
  const connected = [cell, { ...cell, x: 1 }, { ...cell, z: 1 }]
  assert.deepEqual(wayStructurePlan(cell, indexWayStructures(connected), 0).edges, [2, 3], 'corner connections have no transverse railing')
  assert.equal(wayStructurePlan({ ...cell, elevation: 2 }, indexWayStructures([]), 2).raised, false, 'high terrain is not a bridge')
  const group = new Group(), plan = wayStructurePlan(cell, indexWayStructures([cell]), 0)
  for (let n = 0; n < 200; n++) { const mesh = createWayStructure(cell, plan)!; mesh.position.x = n; group.add(mesh) }
  const batches = batchRetroBuildings(group)
  assert.equal(batches.children.length, 1)
  assert.equal((batches.children[0] as InstancedMesh).count, 200)
}
