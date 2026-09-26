import assert from 'node:assert/strict'
import { BoxGeometry, Color, Group, InstancedMesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { GameState } from '../src/game/GameState'
import { overlayCoverAt, paintedCoverAt, weatheringRgb } from '../src/game/groundCoverLook'
import { batchRetroBuildings, createRetroBuilding } from '../src/view/retroBuildings'
import { CampingView } from '../src/view/CampingView'
import { AREA_EDGE_COLOR, AreaEdgeBatch } from '../src/view/coverOverlay'
import { campingBoundary } from '../src/view/campingGround'
import { ForecourtView } from '../src/view/ForecourtView'

function areaEdges(root: Group): InstancedMesh[] {
  const found: InstancedMesh[] = []
  root.traverse((object) => {
    if (object instanceof InstancedMesh && object.userData.areaEdge) found.push(object)
  })
  return found
}

function padPlanes(root: Group): InstancedMesh[] {
  const found: InstancedMesh[] = []
  root.traverse((object) => {
    if (!(object instanceof InstancedMesh)) return
    if (object.userData.iconBillboard) return
    if (object.geometry instanceof PlaneGeometry || object.userData.coverLook) found.push(object)
  })
  return found
}

export function testCoverOverlay(fixture: (count?: number) => GameState): void {
  const game = fixture(0)
  game.snapshot.scenario.environment = 'grassland'
  game.paintGroundCover(0, 0, 'sand')
  game.paintGroundCover(1, 0, 'snow')
  game.snapshot.campingCells = [
    { x: 0, z: 0, elevation: 0 },
    { x: 1, z: 0, elevation: 0 },
  ]
  const camp = new CampingView()
  camp.update(game.snapshot)
  assert.equal(padPlanes(camp.group).length, 0, 'camping interior stays open so terrain cover shows through')
  const campEdges = areaEdges(camp.group)
  assert.equal(campEdges.length, 1, 'camping uses one stone-edge batch, never a mesh per tile')
  assert.equal(campEdges[0]!.count, campingBoundary(game.snapshot.campingCells).length * 2)
  assert.ok(campEdges[0]!.geometry instanceof BoxGeometry)
  assert.equal((campEdges[0]!.material as MeshStandardMaterial).color.getHex(), AREA_EDGE_COLOR)

  game.snapshot.scenario.environment = 'desert'
  game.snapshot.festival.infrastructure.ground = {}
  game.snapshot.campingCells = [{ x: 4, z: 4, elevation: 0 }]
  camp.invalidate()
  camp.update(game.snapshot)
  assert.equal(padPlanes(camp.group).length, 0, 'legacy desert camps still have no grass pad')
  assert.equal(areaEdges(camp.group).length, 1)
  camp.invalidate()

  const plaza = new ForecourtView()
  game.snapshot.scenario.environment = 'grassland'
  game.paintGroundCover(6, 6, 'earth')
  plaza.update(game.snapshot, [{ x: 6, z: 6, elevation: 0 }, { x: 6, z: 6, elevation: 0 }])
  assert.equal(padPlanes(plaza.group).length, 0, 'forecourt interior stays open')
  const plazaEdges = areaEdges(plaza.group)
  assert.equal(plazaEdges.length, 1, 'forecourt never allocates a draw call per cell')
  assert.equal(plazaEdges[0]!.count, campingBoundary([{ x: 6, z: 6 }]).length * 2)
  plaza.invalidate()

  const frame = new AreaEdgeBatch()
  frame.update([
    { x: 0, z: 0, y: 0 },
    { x: 1, z: 0, y: 0 },
    { x: 0, z: 1, y: 0 },
    { x: 1, z: 1, y: 0 },
  ])
  assert.equal(areaEdges(frame.group).length, 1)
  assert.equal(padPlanes(frame.group).length, 0)
  assert.equal(frame.group.children.length, 1, 'area edges stay a single instanced batch')
  assert.equal((frame.group.children[0] as InstancedMesh).count, 16, '2x2 keeps only the outer stone frame')
  frame.clear()
  assert.equal(frame.group.children.length, 0)

  const snow = fixture(0)
  snow.paintGroundCover(0, 0, 'snow')
  snow.paintGroundCover(3, 0, 'sand')
  const a = createRetroBuilding('food')!
  const b = createRetroBuilding('food')!
  a.userData.buildingId = 'food-snow'
  b.userData.buildingId = 'food-sand'
  a.position.set(0.5, 0, 0.5)
  b.position.set(3.5, 0, 0.5)
  const source = new Group()
  source.add(a, b)
  const batched = batchRetroBuildings(source, (_id, x, z) => {
    const cover = paintedCoverAt(snow.snapshot, Math.floor(x), Math.floor(z))
    return cover ? weatheringRgb(cover) : undefined
  })
  assert.equal(batched.children.length, 1, 'weathering uses instance color, not a material per stall')
  const batch = batched.children[0] as InstancedMesh
  const first = new Color(), second = new Color()
  batch.getColorAt(0, first)
  batch.getColorAt(1, second)
  assert.notEqual(first.getHex(), second.getHex())
  assert.ok(first.r > 0.85 && first.b > 0.85, 'snow instance wash stays pale')
  assert.ok(overlayCoverAt(snow.snapshot, 0, 0) === 'snow')

  console.log('PASS cover overlay: camping/forecourt stone frames, open interior, building film')
}
