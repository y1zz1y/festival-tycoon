import { isTruss, screenFacingRotation, SKYWARD_KINDS, UP_ROTATION, type StageDesign, type StagePart, type Axis } from './stageDesign'
/**
 * Every placement is one of two things: docking against a specific neighbouring cell of an
 * existing part (`hit`), or dropping straight onto the ground plane. There is no other case —
 * side, top, end and corner attachments are all just "the adjacent cell in this direction".
 */
export function stagePlacement(d:StageDesign,settings:Pick<StagePart,'kind'|'brand'|'rotation'|'color'>,floorPoint:{x:number;z:number},hit?:{id:string;step:{x:number;y:number;z:number}}):StagePart {
  let x:number,y:number,z:number,attachedTo:string|null,axis:Axis|undefined,rotation=settings.rotation
  if(hit){
    const host=d.parts.find(p=>p.id===hit.id)
    x=(host?.x??0)+hit.step.x;y=(host?.y??0)+hit.step.y;z=(host?.z??0)+hit.step.z;attachedTo=hit.id
    axis=settings.kind==='truss'?(hit.step.x!==0?'x':hit.step.y!==0?'y':'z'):undefined
    // A Pixel-LED-Wand module does not get to choose where its LEDs point: bolted onto a truss
    // face they look out along that face, away from the structure, and grown off another module
    // they simply carry on that module's facing — extending a wall can only mean continuing the
    // same flat surface. Both are forced here rather than merely rejected, so a wall never turns
    // its back on the audience just because the orientation gizmo happened to point elsewhere.
    if(settings.kind==='screen'&&host)rotation=(isTruss(host.kind)?screenFacingRotation(hit.step):host.kind==='screen'?host.rotation:undefined)??rotation
  }else{
    x=Math.floor(floorPoint.x);y=0;z=Math.floor(floorPoint.z);attachedTo=null
    axis=settings.kind==='truss'?'y':undefined
  }
  // Fireworks and spark machines work straight up into the sky and nowhere else, so the
  // orientation cube gets no say over them.
  if(SKYWARD_KINDS.includes(settings.kind))rotation=UP_ROTATION
  let id='placement-preview';while(d.parts.some(p=>p.id===id))id+='-'
  return {...settings,id,x,y,z,rotation,attachedTo,axis}
}
