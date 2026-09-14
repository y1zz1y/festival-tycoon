import assert from 'node:assert/strict'
import { Color, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial } from 'three'
import { CAMP_COLORS, campGeometry, campRotation, campSeed, createCampModel } from '../src/view/campingModels'
import { batchCampMeshes, CampMeshBatcher } from '../src/view/batchCampMeshes'
import { disposeChildren } from '../src/view/disposeObject3D'
import { abandonVisitorCamp } from '../src/game/camping'
import { GameState } from '../src/game/GameState'

export function testCampingModels(): void {
  const source=new Group(), expectedGeometry=new Set<string>()
  for(const kind of ['tent','pavilion'] as const) for(let variant=0;variant<(kind==='tent'?4:3);variant++) {
    const parts=campGeometry(kind,variant)
    assert.equal(campGeometry(kind,variant),parts,'shared geometry is cached')
    let vertices=0
    for(const part of [parts.fabric,parts.details]) {
      part.computeBoundingBox()
      assert.ok(part.boundingBox!.min.x >= -.46 && part.boundingBox!.max.x <= .46,'prop stays within its tile')
      assert.ok(part.boundingBox!.min.z >= -.46 && part.boundingBox!.max.z <= .46)
      assert.equal(part.getAttribute('color').count,part.getAttribute('position').count)
      vertices+=part.getAttribute('position').count
      expectedGeometry.add(part.uuid)
    }
    assert.ok(vertices<1800,`${kind} ${variant}: bounded detail (${vertices})`)
    const id=Array.from({length:100},(_,i)=>`camp-${i}`).find(id=>campSeed(id)%(kind==='tent'?4:3)===variant)!
    assert.ok(id)
    for(let i=0;i<32;i++) source.add(createCampModel(kind,id,CAMP_COLORS[i%8]!))
  }
  assert.equal(expectedGeometry.size,14,'all seven shapes have distinct fabric and detail geometry')
  const batched=batchCampMeshes(source)
  assert.equal(batched.children.length,14,'draw calls depend on variants, never number of tents')
  assert.equal(batched.children.reduce((n,b)=>n+(b as InstancedMesh).count,0),448,'every fabric/detail instance survives batching')
  assert.ok(batched.children.every(b=>(b as Mesh).geometry.userData.shared===false),'batch copies can be disposed without freeing cached geometry')
  let disposedCachedGeometry=0
  for(const kind of ['tent','pavilion'] as const) for(let variant=0;variant<(kind==='tent'?4:3);variant++) {
    const parts=campGeometry(kind,variant)
    for(const part of [parts.fabric,parts.details]) {
      assert.equal(part.userData.shared,true,'cloning must not change ownership of cached source geometry')
      part.addEventListener('dispose',()=>disposedCachedGeometry++)
    }
  }
  disposeChildren(batched);disposeChildren(source)
  assert.equal(disposedCachedGeometry,0,'scene rebuilds preserve all shared camp geometries')
  const persistentSource = new Group(), persistent = new CampMeshBatcher()
  const tent = createCampModel('tent', 'retained-tent', 0x559c87)
  persistentSource.add(tent)
  persistent.update(persistentSource)
  const retained = persistent.group.children[0] as InstancedMesh
  const geometry = retained.geometry, material = retained.material
  let disposedInstances = 0
  retained.addEventListener('dispose', () => disposedInstances++)
  tent.position.set(2, 3, -4)
  ;((tent.children[0] as Mesh).material as MeshStandardMaterial).color.setHex(0xff0000)
  persistent.update(persistentSource)
  assert.equal(persistent.group.children[0], retained, 'camp changes retain GPU buffers')
  const transform = new Matrix4(), tint = new Color()
  retained.getMatrixAt(0, transform); retained.getColorAt(0, tint)
  assert.deepEqual(transform.elements.slice(12,15), [2,3,-4])
  assert.equal(tint.getHex(), 0xff0000)
  for (let i=0;i<20;i++) persistentSource.add(createCampModel('tent', 'retained-tent', 0x559c87))
  persistent.update(persistentSource)
  assert.equal(disposedInstances, 1, 'growing a batch frees its previous instance attributes')
  assert.notEqual((persistent.group.children[0] as Mesh).geometry, geometry)
  assert.notEqual((persistent.group.children[0] as Mesh).material, material)
  assert.equal(persistent.group.children.reduce((n,b)=>n+(b as InstancedMesh).count,0),42)
  persistent.clear(); disposeChildren(persistentSource)

  const visitor={id:'guest-143',color:0x559c87,campsite:{x:1,z:2,elevation:0},campingPhase:'ready' as const}
  const abandoned=abandonVisitorCamp(visitor,[],()=> 'abandoned-1')[0]!
  assert.equal(abandoned.appearanceId,visitor.id);assert.equal(abandoned.fabricColor,visitor.color)
  const state=new GameState();state.snapshot.campInstallations=[abandoned]
  const saved=GameState.fromJSON(JSON.stringify(state.snapshot))!.snapshot.campInstallations[0]!
  assert.equal(saved.appearanceId,visitor.id);assert.equal(saved.fabricColor,visitor.color)
  const original=createCampModel('tent',visitor.id,visitor.color)
  const restored=createCampModel('tent',saved.appearanceId!,saved.fabricColor!,0)
  assert.equal(original.userData.campVariant,restored.userData.campVariant)
  assert.equal(campRotation(saved.appearanceId!),campRotation(visitor.id))
  assert.deepEqual(((original.children[0] as Mesh).material as MeshStandardMaterial).color,((restored.children[0] as Mesh).material as MeshStandardMaterial).color)
  console.log('PASS camping models: seven shared shapes, tile bounds, bounded batching, stable abandoned tent appearance and save round trips')
}
