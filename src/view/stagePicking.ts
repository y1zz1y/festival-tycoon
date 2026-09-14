import { Group, Mesh, BoxGeometry, MeshBasicMaterial } from 'three'
import { TILE_KINDS, STAGE_TILE_DETAIL, type StageDesign } from '../game/stageDesign'
/** Kept outside the rendered scene so picking does not add draw calls. Almost every part is a uniform 1x1x1 cell; the ones built at map-tile size (see TILE_KINDS) get a box as big as the field they fill. */
export function createStagePickTargets(d:StageDesign):Group {
  const root=new Group(),material=new MeshBasicMaterial()
  for(const p of d.parts){
    const span=TILE_KINDS.includes(p.kind)?STAGE_TILE_DETAIL:1
    const mesh=new Mesh(new BoxGeometry(span,span,span),material)
    mesh.position.set(p.x-d.width/2+span/2,p.y+span/2,p.z-d.depth/2+span/2)
    mesh.userData.partId=p.id
    root.add(mesh)
  }
  return root
}
