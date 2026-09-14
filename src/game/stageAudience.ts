import type { GameSnapshot } from './GameState'
import { stageAudienceCells, stageApronCells, occupiesBuildingCell } from './stageDesign'
import { getTerrainHeight, isWaterHeight } from './terrain'
/**
 * Keeps the forecourt in step with the stages standing on the map. Every stage owns two kinds of
 * audience ground — the tiles painted inside its own design, and the standard apron in front of it
 * — and both are rebuilt from scratch here, so they follow the stage when it is moved, rotated,
 * resized or taken down. Cells designated by hand carry no stageId and are left exactly as they
 * are; anything of the apron that would land in water, off the map or under another building is
 * simply dropped, since a crowd cannot stand there anyway.
 */
export function syncStageAudience(s:GameSnapshot):void {
  const cells=s.stageForecourtCells.filter(c=>!c.stageId)
  const taken=new Set(cells.map(c=>`${c.x}:${c.z}`))
  const half=s.scenario.worldSize/2
  for(const stage of s.buildings){
    if(!stage.stageDesign)continue
    const standable=(c:{x:number;z:number})=>
      c.x>=-half&&c.z>=-half&&c.x<half&&c.z<half&&
      !isWaterHeight(getTerrainHeight(s.terrain,c.x,c.z))&&
      !s.buildings.some(b=>occupiesBuildingCell(b,c.x,c.z))
    for(const c of [...stageAudienceCells(stage),...stageApronCells(stage).filter(standable)]){
      const key=`${c.x}:${c.z}`
      if(taken.has(key))continue
      taken.add(key);cells.push({...c,elevation:stage.elevation,stageId:stage.id})
    }
  }
  s.stageForecourtCells=cells
}
