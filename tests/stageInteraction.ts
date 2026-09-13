import { bandPositions, bandRoles, updateStageBand } from '../src/view/stageBand'
import assert from 'node:assert/strict'
import { Vector3, LineSegments, SpotLight, Box3, Quaternion } from 'three'
import { GameState, type GameSnapshot } from '../src/game/GameState'
import { stagePlacement } from '../src/game/stagePlacement'
import { defaultStageDesign, stageDesignIssue, removeStagePart, stageAudienceCells, lineArrayIndex, migrateStageDesign, NEIGHBOR_STEPS, ROTATION_DIRECTIONS, STAGE_TILE_DETAIL, type StagePart } from '../src/game/stageDesign'
import { createStageModel, animateStageModel, disposeStageModel } from '../src/view/stageModel'
import { showIssue } from '../src/game/festivalManagement'
export function testStageInteraction(fixture:(count?:number)=>GameState){
  const performerDesign=defaultStageDesign()
  assert.equal(bandPositions(performerDesign).length,0,'bare stage floor is not a performer podium')
  for(let x=1;x<=4;x++)performerDesign.parts.push({id:`deck-${x}`,kind:'deck',x,y:0,z:4,rotation:0,attachedTo:null,brand:'budget',color:'#ffffff'})
  assert.equal(bandPositions(performerDesign).length,4)
  for(const pos of bandPositions(performerDesign))assert.ok(performerDesign.parts.some(p=>p.x===pos.x+performerDesign.width/2-.5&&p.z===pos.z+performerDesign.depth/2-.5))
  const performanceStage=createStageModel(performerDesign)
  updateStageBand(performanceStage,'meadow',0,false);assert.equal(performanceStage.userData.band,undefined)
  updateStageBand(performanceStage,'meadow',0,true,performerDesign);const performers=performanceStage.userData.band;assert.equal(performers.children.length,4)
  assert.ok(performers.children.every((p:any)=>p.position.y>=.54),'musicians stand on top of podiums')
  const arm=performers.children[1].userData.arms[0],angle=arm.rotation.x
  updateStageBand(performanceStage,'meadow',.4,true,performerDesign);assert.equal(performanceStage.userData.band,performers);assert.notEqual(arm.rotation.x,angle)
  updateStageBand(performanceStage,'meadow',.4,false);assert.equal(performers.visible,false)
  updateStageBand(performanceStage,'neon',1,true,performerDesign);assert.equal(performanceStage.userData.band.children.length,2);assert.equal(performers.parent,null)
  assert.ok(bandRoles('brass').includes('brass'));assert.ok(bandRoles('campfire').includes('guitar'))
  const occupied=defaultStageDesign();occupied.tileWidth=2;occupied.tileDepth=2;occupied.audience=[{x:0,z:1}];occupied.parts=[{id:'motor',kind:'truss',axis:'x',x:5,y:0,z:4,rotation:0,attachedTo:null,brand:'budget',color:'#ffffff'}]
  for(const pos of bandPositions(occupied)){const x=pos.x+occupied.width/2-.5,z=pos.z+occupied.depth/2-.5;assert.ok(!(x<4&&z>=3));assert.ok(!(z===4&&Math.abs(x-5)<=1))}
  occupied.parts=[];for(let x=0;x<occupied.width;x++)for(let z=0;z<occupied.depth;z++)occupied.parts.push({id:`${x}-${z}`,kind:'fullRange',x,y:0,z,rotation:0,attachedTo:null,brand:'budget',color:'#ffffff'})
  assert.equal(bandPositions(occupied).length,0);disposeStageModel(performanceStage)

  // Every attachment — hanging, sitting on top, side-by-side — is the same operation now: dock onto one of a truss's six neighbouring cells.
  const d=defaultStageDesign(),settings={kind:'fullRange' as const,brand:'touring' as const,rotation:0,color:'#ff88cc'}
  const post:StagePart={id:'post',kind:'truss',brand:'budget',x:2,y:1,z:2,axis:'y',rotation:0,attachedTo:null,color:'#ffffff'};d.parts.push(post)
  let n=0
  for(const step of NEIGHBOR_STEPS){const box=stagePlacement(d,settings,{x:0,z:0},{id:'post',step});box.id=`box${++n}`;d.parts.push(box);assert.equal(stageDesignIssue(d),null,'a full-range speaker can dock onto any of the six sides of a truss')}
  const dupSide=stagePlacement(d,settings,{x:0,z:0},{id:'post',step:NEIGHBOR_STEPS[0]!})
  assert.ok(stageDesignIssue({...d,parts:[...d.parts,{...dupSide,id:'dupSide'}]}),'the same side cannot hold two full-range speakers')
  assert.equal(removeStagePart(d,'post').parts.length,0,'removing the host removes everything docked onto it')

  // Effects: beam direction follows the part's own facing (rotation, as chosen with the
  // orientation cube), independent of which side of the host truss it happens to dock onto.
  const rig=defaultStageDesign();rig.parts.push({id:'truss',kind:'truss',axis:'x',brand:'budget',x:3,y:1,z:2,rotation:0,attachedTo:null,color:'#ffffff'})
  const hanging=stagePlacement(rig,{...settings,kind:'spot',rotation:5},{x:0,z:0},{id:'truss',step:{x:0,y:-1,z:0}});hanging.id='hanging';rig.parts.push(hanging)
  assert.equal(hanging.attachedTo,'truss');assert.equal(stageDesignIssue(rig),null)
  const above=stagePlacement(rig,{...settings,kind:'spot',rotation:4},{x:0,z:0},{id:'truss',step:{x:0,y:1,z:0}});above.id='above';rig.parts.push(above)
  const laser=stagePlacement(rig,{...settings,kind:'laser'},{x:0,z:0},{id:'truss',step:{x:1,y:0,z:0}});laser.id='laser';rig.parts.push(laser)
  const fog=stagePlacement(rig,{kind:'fog',brand:'touring',rotation:0,color:'#ff88cc'},{x:1,z:4});fog.id='fog';rig.parts.push(fog)
  assert.equal(stageDesignIssue(rig),null,'a ground-placed fog machine rests on the floor while everything else hangs off the truss')
  const foggy=stagePlacement(rig,{kind:'fog',brand:'budget',rotation:2,color:'#88ccff'},{x:0,z:0},{id:'truss',step:{x:0,y:0,z:1}});foggy.id='foggy';rig.parts.push(foggy)
  assert.equal(foggy.attachedTo,'truss');assert.equal(stageDesignIssue(rig),null,'a fog machine can also dock onto a truss like a spot or laser')
  const trussSparks=stagePlacement(rig,{kind:'sparks',brand:'budget',rotation:4,color:'#ffd9a0'},{x:0,z:0},{id:'truss',step:{x:0,y:0,z:-1}});trussSparks.id='trussSparks';rig.parts.push(trussSparks)
  assert.equal(trussSparks.attachedTo,'truss');assert.equal(stageDesignIssue(rig),null,'a spark fountain hangs off a truss the same way')
  const groundSparks=stagePlacement(rig,{kind:'sparks',brand:'budget',rotation:4,color:'#ffd9a0'},{x:2,z:5});groundSparks.id='groundSparks';rig.parts.push(groundSparks)
  assert.equal(stageDesignIssue(rig),null,'and still stands on the floor on its own, like the fog machine')
  assert.equal(removeStagePart(rig,'truss').parts.some(p=>p.id==='hanging'),false)
  const model=createStageModel(rig,{lightBudget:6}),phase={intensity:100,speed:60,fog:80,volume:100,color:'#ff55cc'}
  animateStageModel(model,phase,1,true)
  const spots=model.userData.effects.filter((p:any)=>p.userData.kind==='spot')
  assert.equal(spots.length,2)
  const beamDirection=(spot:any)=>{const origin=new Vector3();spot.getWorldPosition(origin);return spot.localToWorld(new Vector3(0,0,1)).sub(origin)}
  const downSpot=spots.find((s:any)=>s.userData.id==='hanging'),upSpot=spots.find((s:any)=>s.userData.id==='above')
  assert.ok(beamDirection(downSpot).y<0,'a spot rotated to face down points down regardless of mount side')
  assert.ok(beamDirection(upSpot).y>0,'a spot rotated to face up points up regardless of mount side')
  for(const spot of spots){assert.ok(spot.userData.light instanceof SpotLight);assert.ok(spot.userData.light.intensity>0)}
  // A moving head's two arms cradle the head at its *sides*, so they must stand square to the
  // lens for every mount side and every aim. Reaching an aim by twisting the head inside a fixed
  // yoke would hit the same aim but swing the arms round to the head's front and back, leaving
  // the lens staring into one of them — so the aim has to be split into a yoke pan and a tilt.
  for(const step of NEIGHBOR_STEPS)for(let rotation=0;rotation<ROTATION_DIRECTIONS.length;rotation++){
    const yokeDesign=defaultStageDesign()
    yokeDesign.parts.push({id:'yokeBeam',kind:'truss',axis:'x',brand:'budget',x:2,y:2,z:2,rotation:0,attachedTo:null,color:'#ffffff'})
    const head=stagePlacement(yokeDesign,{kind:'spot',brand:'budget',rotation,color:'#ffffff'},{x:0,z:0},{id:'yokeBeam',step});head.id='head';yokeDesign.parts.push(head)
    const yokeModel=createStageModel(yokeDesign);yokeModel.updateMatrixWorld(true)
    const headRig=yokeModel.userData.effects.find((r:any)=>r.userData.kind==='spot')
    const armAxis=new Vector3(1,0,0).applyQuaternion((headRig.userData.armGroup as any).getWorldQuaternion(new Quaternion()))
    const lensAxis=new Vector3(0,0,1).applyQuaternion(headRig.getWorldQuaternion(new Quaternion()))
    const where=`mounted ${JSON.stringify(step)}, aimed ${rotation}`
    assert.ok(Math.abs(armAxis.dot(lensAxis))<1e-6,`the yoke arms stand square to the lens (${where})`)
    assert.ok(lensAxis.distanceTo(new Vector3().copy(ROTATION_DIRECTIONS[rotation]! as any))<1e-6,`and the head still aims exactly where the orientation cube points (${where})`)
    disposeStageModel(yokeModel)
  }
  // A spark fountain throws its plume along the direction the part was aimed, as far as its rated
  // four tiles. The sparks fly ballistically and are recomputed from the show clock alone, so the
  // plume is sampled across a whole run of frames to find how far the fastest of them get.
  const fountainDesign=defaultStageDesign()
  fountainDesign.parts.push({id:'fountain',kind:'sparks',brand:'budget',x:1,y:0,z:1,rotation:4,attachedTo:null,color:'#ffd9a0'})
  fountainDesign.parts.push({id:'sideways',kind:'sparks',brand:'budget',x:4,y:0,z:1,rotation:0,attachedTo:null,color:'#ffd9a0'})
  const fountainModel=createStageModel(fountainDesign),pyroPhase={intensity:100,speed:60,movement:0,pyro:100,fog:0,volume:0,color:'#ffcf8a'}
  const plumeUp=fountainModel.userData.effects.find((r:any)=>r.userData.kind==='sparks'&&r.userData.dir.y===1)
  const plumeSide=fountainModel.userData.effects.find((r:any)=>r.userData.kind==='sparks'&&r.userData.dir.z===1)
  const throwRange=4*STAGE_TILE_DETAIL
  let highest=0
  for(let frame=0;frame<160;frame++){
    animateStageModel(fountainModel,pyroPhase,frame*.02,true)
    const points=(plumeUp.children[0] as any).geometry.getAttribute('position')
    for(let v=0;v<points.count;v++)highest=Math.max(highest,points.getY(v))
  }
  assert.ok(highest>throwRange*.75&&highest<=throwRange,`a fountain's sparks reach about its rated four tiles and never overshoot them (${highest.toFixed(2)} of ${throwRange})`)
  assert.ok(new Vector3(0,1,0).applyQuaternion(plumeSide.quaternion).distanceTo(new Vector3(0,0,1))<1e-6,'and one aimed sideways sprays sideways rather than up')
  animateStageModel(fountainModel,{...pyroPhase,pyro:0},1,true)
  assert.equal(plumeUp.visible,false,'with the pyro fader down the fountain stops emitting altogether')
  disposeStageModel(fountainModel)
  // Fireworks fire straight up into open sky: the orientation cube gets no say over where they
  // point, and nothing may stand in the column above them.
  const skyDesign=defaultStageDesign()
  const rack=stagePlacement(skyDesign,{kind:'fireworks',brand:'budget',rotation:1,color:'#ffb45c'},{x:2,z:2});rack.id='rack';skyDesign.parts.push(rack)
  assert.equal(rack.rotation,4,'a firework rack is always aimed upwards, whichever way the orientation cube points')
  assert.equal(stageDesignIssue(skyDesign),null,'and stands happily under open sky')
  const overheadTruss:StagePart={id:'overheadTruss',kind:'truss',brand:'budget',axis:'x',x:2,y:2,z:2,rotation:0,attachedTo:null,color:'#ffffff'}
  assert.ok(stageDesignIssue({...skyDesign,parts:[...skyDesign.parts,overheadTruss]}),'but not with a truss hanging over it, however far above')
  assert.equal(stageDesignIssue({...skyDesign,parts:[...skyDesign.parts,{...overheadTruss,x:3}]}),null,'while a truss in the next column along is no obstacle')
  // Its rockets climb well clear of the rack before bursting, rather than the whole effect simply
  // flashing in place the way the old one did.
  const skyModel=createStageModel(skyDesign)
  const rocketRig=skyModel.userData.effects.find((r:any)=>r.userData.kind==='fireworks')
  let peak=0
  for(let frame=0;frame<200;frame++){
    animateStageModel(skyModel,{intensity:100,speed:60,movement:0,pyro:100,fog:0,volume:0,color:'#ffcf8a'},frame*.03,true)
    const points=(rocketRig.children[0] as any).geometry.getAttribute('position')
    for(let v=0;v<points.count;v++)peak=Math.max(peak,points.getY(v))
  }
  assert.ok(peak>5,`its rockets burst high above the rack rather than at deck level (${peak.toFixed(1)})`)
  disposeStageModel(skyModel)
  const laserRig=model.userData.effects.find((p:any)=>p.userData.kind==='laser');assert.ok(laserRig.children[0] instanceof LineSegments)
  const fogRig=model.userData.effects.find((p:any)=>p.userData.kind==='fog');assert.equal(fogRig.children.length,6)
  assert.ok(fogRig.children[fogRig.children.length-1].scale.x>fogRig.children[0].scale.x,'fog puffs widen as they drift outward')
  const mountedFog=model.userData.effects.find((p:any)=>p.userData.kind==='fog'&&p!==fogRig)
  assert.ok(mountedFog,'the truss-mounted fog machine also gets its own drifting cloud')
  animateStageModel(model,phase,1,false);assert.ok(spots.every((p:any)=>p.userData.light.intensity===0));disposeStageModel(model)

  // A tower is just trusses stacked straight up; branches, chains and corners all reuse the exact same step mechanism.
  const tower=defaultStageDesign(),trussSettings={kind:'truss' as const,brand:'budget' as const,rotation:0,color:'#ffffff'}
  const base=stagePlacement(tower,trussSettings,{x:2,z:2});base.id='base';tower.parts.push(base)
  assert.equal(base.axis,'y','a truss dropped on bare ground starts as a vertical post');assert.equal(base.attachedTo,null);assert.equal(base.y,0)
  const mid=stagePlacement(tower,trussSettings,{x:0,z:0},{id:'base',step:{x:0,y:1,z:0}});mid.id='mid';tower.parts.push(mid)
  assert.equal(mid.attachedTo,'base');assert.equal(mid.y,base.y+1,'stacking upward is just the neighbouring cell one grid step up')
  const top=stagePlacement(tower,trussSettings,{x:0,z:0},{id:'mid',step:{x:0,y:1,z:0}});top.id='top';tower.parts.push(top)
  assert.equal(top.attachedTo,'mid');assert.equal(stageDesignIssue(tower),null)
  const branch=stagePlacement(tower,trussSettings,{x:0,z:0},{id:'mid',step:{x:1,y:0,z:0}});branch.id='branch';tower.parts.push(branch)
  assert.equal(branch.attachedTo,'mid','a truss can branch sideways off a *middle* segment of a tower, not just the base or top')
  assert.equal(branch.axis,'x');assert.deepEqual({x:branch.x,y:branch.y,z:branch.z},{x:mid.x+1,y:mid.y,z:mid.z});assert.equal(stageDesignIssue(tower),null)
  const chained=stagePlacement(tower,trussSettings,{x:0,z:0},{id:'branch',step:{x:1,y:0,z:0}});chained.id='chained';tower.parts.push(chained)
  assert.equal(chained.attachedTo,'branch','the branch itself accepts a further link, extending the chain through the air');assert.equal(stageDesignIssue(tower),null)
  const corner=stagePlacement(tower,trussSettings,{x:0,z:0},{id:'top',step:{x:0,y:0,z:1}});corner.id='corner';tower.parts.push(corner)
  assert.equal(corner.axis,'z','a segment off the tower top on a different axis forms a corner');assert.equal(stageDesignIssue(tower),null)
  const light=stagePlacement(tower,{kind:'spot',brand:'touring',rotation:0,color:'#ff88cc'},{x:0,z:0},{id:'branch',step:{x:0,y:1,z:0}});light.id='light';tower.parts.push(light)
  assert.equal(stageDesignIssue(tower),null,'equipment docks onto a mid-air branch exactly like onto a grounded truss')
  const dupCell=stagePlacement(tower,trussSettings,{x:0,z:0},{id:'mid',step:{x:1,y:0,z:0}})
  assert.ok(stageDesignIssue({...tower,parts:[...tower.parts,{...dupCell,id:'dupCell'}]}),'the same neighbouring cell cannot be claimed twice')
  const floating:StagePart={id:'floating',kind:'truss',brand:'budget',x:5,y:5,z:5,axis:'y',rotation:0,attachedTo:null,color:'#ffffff'}
  assert.equal(stageDesignIssue({...tower,parts:[...tower.parts,floating]}),null,'a truss may stand free in the grid with no connection back to the ground')
  const towerModel=createStageModel(tower,{lightBudget:2});disposeStageModel(towerModel)
  assert.equal(stageDesignIssue(JSON.parse(JSON.stringify(tower))),null)
  assert.equal(removeStagePart(tower,'base').parts.length,0,'removing the base cascades through the whole tower, every branch and everything docked onto it')

  // Ground-only kinds stand on the floor without a truss; everything else needs one.
  const deckOnGround=stagePlacement(tower,{kind:'deck',brand:'budget',rotation:0,color:'#ffffff'},{x:0,z:0})
  assert.equal(deckOnGround.attachedTo,null);assert.equal(stageDesignIssue({...defaultStageDesign(),parts:[deckOnGround]}),null,'ground-only components stand on the floor without a truss')
  const deckOnTruss=stagePlacement(tower,{kind:'deck',brand:'budget',rotation:0,color:'#ffffff'},{x:0,z:0},{id:'base',step:{x:0,y:0,z:1}})
  assert.ok(stageDesignIssue({...tower,parts:[...tower.parts,{...deckOnTruss,id:'deckOnTruss'}]}),'ground-only components cannot hang from a truss')
  const spotOnGround:StagePart={id:'spotOnGround',kind:'spot',brand:'budget',x:0,y:0,z:0,rotation:0,attachedTo:null,color:'#ffffff'}
  assert.ok(stageDesignIssue({...defaultStageDesign(),parts:[spotOnGround]}),'equipment other than ground-only kinds and trusses needs a truss host')

  // The configured grid height is the only limit on how tall a tower can grow.
  const tallDesign=defaultStageDesign()
  let cursor=stagePlacement(tallDesign,trussSettings,{x:2,z:2});cursor.id='t0';tallDesign.parts.push(cursor);let chainId='t0'
  for(let lvl=1;lvl<tallDesign.height;lvl++){const seg=stagePlacement(tallDesign,trussSettings,{x:0,z:0},{id:chainId,step:{x:0,y:1,z:0}});seg.id=`t${lvl}`;tallDesign.parts.push(seg);chainId=seg.id}
  assert.equal(stageDesignIssue(tallDesign),null,'a tower can fill the entire configured height')
  const tooTall=stagePlacement(tallDesign,trussSettings,{x:0,z:0},{id:chainId,step:{x:0,y:1,z:0}})
  assert.ok(stageDesignIssue({...tallDesign,parts:[...tallDesign.parts,{...tooTall,id:'tooTall'}]}),'the grid height is a hard limit')
  const taller={...defaultStageDesign(),tileHeight:4,height:12}
  assert.equal(stageDesignIssue(taller),null,'a taller "Höhe" setting raises that limit')

  const audience=defaultStageDesign();audience.tileWidth=3;audience.tileDepth=3;audience.width=9;audience.depth=9;audience.audience=[{x:0,z:1},{x:1,z:1}]
  assert.equal(stageDesignIssue(audience),null)
  assert.ok(stageDesignIssue({...audience,audience:[{x:1,z:1}]}),'sealed audience courtyards need an entrance')
  assert.ok(stageDesignIssue({...audience,parts:[{id:'blocked',kind:'deck',brand:'budget',x:3,y:0,z:3,rotation:0,attachedTo:null,color:'#ffffff'}]}),'floor equipment cannot obstruct spectator tiles')
  assert.deepEqual(stageAudienceCells({x:6,z:-20,rotation:1,stageDesign:audience}),[{x:7,z:-18},{x:7,z:-19}])
  const game=fixture(0),s=game.snapshot as GameSnapshot;game.addDebugMoney()
  for(let x=6;x<9;x++)for(let z=-20;z<-17;z++){game.manageFestival({type:'ground',x,z,kind:'drain'});game.manageFestival({type:'ground',x,z,kind:'compact'})}
  assert.ok(game.placePathSegment(5,-19,0).ok)
  assert.ok(game.manageFestival({type:'stageDesign',design:audience,selectForBuild:true}).ok)
  assert.ok(game.place('stage',6,-20).ok)
  const stage=s.buildings.find(b=>b.kind==='stage')!
  assert.equal(s.stageForecourtCells.filter(c=>c.stageId===stage.id).length,2)
  assert.equal((game as any).isPedestrianSolidAt(7,-19,0),false)
  assert.equal((game as any).isPedestrianSolidAt(7,-20,0),true)
  const route=(game as any).findPath({x:4,z:-19,elevation:0},[{x:7,z:-19,elevation:0}],false,false,false,false,true)
  assert.ok(route?.length,'guests can walk from a normal path through the audience entrance into the courtyard')
  assert.ok(route.some((p:any)=>p.x===6&&p.z===-19))
  assert.equal(game.canPlace('food',7,-19).ok,false,'audience area remains reserved for this stage')
  s.dayPlan.offers.stages=Array(24).fill(true)
  assert.equal(showIssue(s,{id:'show',stageId:stage.id,bandId:'meadow',day:s.day,start:600,duration:120,fee:450}),null,'integrated audience areas satisfy concert forecourt requirements')
  const loaded=GameState.fromJSON(JSON.stringify(s))!
  assert.equal(loaded.snapshot.stageForecourtCells.filter(c=>c.stageId===stage.id).length,2,'load does not duplicate integrated audience cells')
  assert.ok(loaded.bulldoze(7,-19).ok);assert.equal(loaded.snapshot.stageForecourtCells.filter(c=>c.stageId===stage.id).length,0)

  // Line arrays: the first cabinet docks onto a truss like any other equipment; every further
  // cabinet chains onto the one above it (never sideways, never upward), and each step down the
  // chain adds one more increment of curvature.
  const pa=defaultStageDesign();pa.parts.push({id:'rig',kind:'truss',brand:'budget',x:2,y:3,z:2,axis:'x',rotation:0,attachedTo:null,color:'#ffffff'})
  const paTop=stagePlacement(pa,{kind:'lineArray',brand:'touring',rotation:0,color:'#dfe3e6'},{x:0,z:0},{id:'rig',step:{x:0,y:-1,z:0}});paTop.id='paTop';pa.parts.push(paTop)
  assert.equal(lineArrayIndex(pa,paTop),0);assert.equal(stageDesignIssue(pa),null)
  const paMid=stagePlacement(pa,{kind:'lineArray',brand:'touring',rotation:0,color:'#dfe3e6'},{x:0,z:0},{id:'paTop',step:{x:0,y:-1,z:0}});paMid.id='paMid';pa.parts.push(paMid)
  assert.equal(lineArrayIndex(pa,paMid),1,'the second cabinet is one link below the truss-mounted one');assert.equal(stageDesignIssue(pa),null)
  const paBottom=stagePlacement(pa,{kind:'lineArray',brand:'touring',rotation:0,color:'#dfe3e6'},{x:0,z:0},{id:'paMid',step:{x:0,y:-1,z:0}});paBottom.id='paBottom';pa.parts.push(paBottom)
  assert.equal(lineArrayIndex(pa,paBottom),2,'curvature keeps increasing further down the chain');assert.equal(stageDesignIssue(pa),null)
  const sideways=stagePlacement(pa,{kind:'lineArray',brand:'touring',rotation:0,color:'#dfe3e6'},{x:0,z:0},{id:'paTop',step:{x:1,y:0,z:0}});sideways.id='sideways'
  assert.ok(stageDesignIssue({...pa,parts:[...pa.parts,sideways]}),'a line-array cabinet cannot dock onto the side of another one')
  const upward=stagePlacement(pa,{kind:'lineArray',brand:'touring',rotation:0,color:'#dfe3e6'},{x:0,z:0},{id:'paTop',step:{x:0,y:1,z:0}});upward.id='upward'
  assert.ok(stageDesignIssue({...pa,parts:[...pa.parts,upward]}),'a line-array cabinet cannot extend the chain upward')
  assert.equal(removeStagePart(pa,'paTop').parts.some(p=>p.id==='paBottom'),false,'removing the truss-mounted cabinet takes the whole hung chain with it')
  const paModel=createStageModel(pa,{effects:false});assert.ok(paModel.children.length>0);disposeStageModel(paModel)
  // Each hung element's cabinets are threaded onto one continuous rigging rod that bends at every
  // cabinet joint, so a chained element's own top must be found by walking down through its
  // host's actual (already-tilted) cabinets — not a grid-cell-centre approximation — otherwise a
  // gap opens between elements, and it would only get worse further down the chain. Edges (not an
  // exact offset) are compared since curvature tilts each cabinet a little further, which skews
  // the axis-aligned bounding box; a real gap would still show up as daylight between them.
  const paMidBox=new Box3().setFromObject(createStageModel(pa,{floor:false,effects:false,partIds:new Set(['paMid'])}))
  const paBottomBox=new Box3().setFromObject(createStageModel(pa,{floor:false,effects:false,partIds:new Set(['paBottom'])}))
  assert.ok(paMidBox.min.y-paBottomBox.max.y<.1,'a chained line-array element hangs flush under the one above it, all the way down the chain')
  // A truss is a sparse 3-chord lattice, not a solid rod, so a fixture merely tangent to its
  // outer radius can still read as floating with daylight visible through the gap. The
  // truss-mounted cabinet's own rigging bracket must physically overlap the truss above it.
  const paTopBox=new Box3().setFromObject(createStageModel(pa,{floor:false,effects:false,partIds:new Set(['paTop'])}))
  const trussBox=new Box3().setFromObject(createStageModel(pa,{floor:false,effects:false,partIds:new Set(['rig'])}))
  assert.ok(paTopBox.max.y>trussBox.min.y,"the truss-mounted cabinet's rigging bracket overlaps the truss instead of merely touching its outer radius")

  // Full-range speakers and subwoofers can stack straight up on top of each other (but never
  // sideways), and — unlike a full-range speaker — a subwoofer can never dock onto a truss.
  const stack=defaultStageDesign()
  const woofer=stagePlacement(stack,{kind:'subwoofer',brand:'budget',rotation:0,color:'#334455'},{x:2,z:2});woofer.id='woofer';stack.parts.push(woofer)
  assert.equal(stageDesignIssue(stack),null,'a subwoofer stands on the ground on its own')
  const onTop=stagePlacement(stack,{kind:'subwoofer',brand:'budget',rotation:0,color:'#334455'},{x:0,z:0},{id:'woofer',step:{x:0,y:1,z:0}});onTop.id='onTop';stack.parts.push(onTop)
  assert.equal(stageDesignIssue(stack),null,'a second subwoofer can stack directly on top of the first')
  const beside=stagePlacement(stack,{kind:'subwoofer',brand:'budget',rotation:0,color:'#334455'},{x:0,z:0},{id:'woofer',step:{x:1,y:0,z:0}});beside.id='beside'
  assert.ok(stageDesignIssue({...stack,parts:[...stack.parts,beside]}),'subwoofers cannot dock onto each other sideways')
  const rigged=defaultStageDesign();rigged.parts.push({id:'truss',kind:'truss',brand:'budget',x:2,y:1,z:2,axis:'x',rotation:0,attachedTo:null,color:'#ffffff'})
  const hungSub=stagePlacement(rigged,{kind:'subwoofer',brand:'budget',rotation:0,color:'#334455'},{x:0,z:0},{id:'truss',step:{x:0,y:-1,z:0}});hungSub.id='hungSub'
  assert.ok(stageDesignIssue({...rigged,parts:[...rigged.parts,hungSub]}),'a subwoofer can never dock onto a truss')
  const hungFullRange=stagePlacement(rigged,{kind:'fullRange',brand:'budget',rotation:0,color:'#334455'},{x:0,z:0},{id:'truss',step:{x:0,y:-1,z:0}});hungFullRange.id='hungFullRange'
  assert.equal(stageDesignIssue({...rigged,parts:[...rigged.parts,hungFullRange]}),null,'unlike a subwoofer, a full-range speaker can still dock onto a truss')
  const wooferCenter=new Box3().setFromObject(createStageModel(stack,{floor:false,effects:false,partIds:new Set(['woofer'])})).getCenter(new Vector3())
  const onTopCenter=new Box3().setFromObject(createStageModel(stack,{floor:false,effects:false,partIds:new Set(['onTop'])})).getCenter(new Vector3())
  assert.ok(Math.abs(onTopCenter.y-wooferCenter.y-.9)<.01,'a stacked subwoofer sits flush on the ground-standing one below it (2×.45 half-heights)')

  // A subwoofer is also a stable platform: other equipment (full-range speakers, fog, lasers,
  // moving heads, ...) can stand on top of one, but only on top — never hung underneath/beside.
  const podium=defaultStageDesign()
  const platform=stagePlacement(podium,{kind:'subwoofer',brand:'budget',rotation:0,color:'#334455'},{x:2,z:2});platform.id='platform';podium.parts.push(platform)
  const perchedFullRange=stagePlacement(podium,{kind:'fullRange',brand:'budget',rotation:0,color:'#334455'},{x:0,z:0},{id:'platform',step:{x:0,y:1,z:0}});perchedFullRange.id='perchedFullRange';podium.parts.push(perchedFullRange)
  assert.equal(stageDesignIssue(podium),null,'a full-range speaker can stand on top of a subwoofer')
  const platformCenter=new Box3().setFromObject(createStageModel(podium,{floor:false,effects:false,partIds:new Set(['platform'])})).getCenter(new Vector3())
  const perchedCenter=new Box3().setFromObject(createStageModel(podium,{floor:false,effects:false,partIds:new Set(['perchedFullRange'])})).getCenter(new Vector3())
  assert.ok(Math.abs(perchedCenter.y-platformCenter.y-.85)<.01,'the perched speaker sits flush on the subwoofer (its own .45 plus the speaker\'s own .4 half-heights)')
  const perchedFog=stagePlacement(podium,{kind:'fog',brand:'budget',rotation:0,color:'#334455'},{x:0,z:0},{id:'platform',step:{x:0,y:1,z:0}})
  assert.equal(stageDesignIssue({...podium,parts:[podium.parts[0]!,perchedFog]}),null,'a fog machine, laser or moving head can likewise stand on a subwoofer')
  const besidePlatform=stagePlacement(podium,{kind:'fullRange',brand:'budget',rotation:0,color:'#334455'},{x:0,z:0},{id:'platform',step:{x:1,y:0,z:0}})
  assert.ok(stageDesignIssue({...podium,parts:[podium.parts[0]!,besidePlatform]}),'nothing can dock onto the side of a subwoofer, only its top')

  // Pixel-LED-Wand screens: truss-only, and two docked side by side on the same run merge into
  // one wider pixel matrix with a shared, synchronised diagonal glow wave.
  const wall=defaultStageDesign();wall.parts.push({id:'beam',kind:'truss',brand:'budget',x:2,y:2,z:2,axis:'x',rotation:0,attachedTo:null,color:'#ffffff'})
  const screenA=stagePlacement(wall,{kind:'screen',brand:'budget',rotation:0,color:'#3388ff'},{x:0,z:0},{id:'beam',step:{x:0,y:-1,z:0}});screenA.id='screenA';wall.parts.push(screenA)
  assert.equal(stageDesignIssue(wall),null,'a screen can dock onto a truss')
  const groundScreen=stagePlacement(wall,{kind:'screen',brand:'budget',rotation:0,color:'#3388ff'},{x:1,z:1})
  assert.ok(stageDesignIssue({...wall,parts:[...wall.parts,groundScreen]}),'a screen cannot stand on the ground — it can only be mounted on a truss')
  const soloModel=createStageModel(wall)
  const soloRig=soloModel.userData.effects.find((r:any)=>r.userData.kind==='screen')
  assert.equal((soloRig.children[0] as any).geometry.getAttribute('color').count,3*3*24,'a lone screen renders a plain 3x3 pixel grid')
  // A module always comes to rest on the boundary between the truss's cell and its own. Docked
  // below the truss that boundary cuts across its face, so it butts its top edge against it and
  // fills its own cell exactly; a short rigging arm spans the rest of the way up into the truss.
  const cellCentre={x:screenA.x-wall.width/2+.5,y:screenA.y+.5,z:screenA.z-wall.depth/2+.5}
  const soloBox=new Box3().setFromObject(createStageModel(wall,{floor:false,effects:false,partIds:new Set(['screenA'])}))
  const soloPixels=new Box3().setFromObject(soloRig.children[0]).getCenter(new Vector3())
  assert.ok(Math.abs(soloPixels.x-cellCentre.x)<1e-6&&Math.abs(soloPixels.y-cellCentre.y)<1e-6,'a module docked below a truss fills its own cell, its top edge on the cell boundary')
  assert.ok(Math.abs(soloBox.max.x-soloBox.min.x-1)<1e-6,'and is exactly one cell wide, so two modules meet with no border between them')
  const beamBox=new Box3().setFromObject(createStageModel(wall,{floor:false,effects:false,partIds:new Set(['beam'])}))
  assert.ok(soloBox.max.y>beamBox.min.y,'its rigging arm reaches into the truss instead of stopping short of it')
  disposeStageModel(soloModel)
  // Bolted to the *side* of a truss the module behaves the same way, rather than riding half a
  // cell high on the truss's centre line the way small clamped-on fixtures do.
  const mastDesign=defaultStageDesign()
  mastDesign.parts.push({id:'mast',kind:'truss',brand:'budget',x:2,y:2,z:2,axis:'y',rotation:0,attachedTo:null,color:'#ffffff'})
  const sideScreen=stagePlacement(mastDesign,{kind:'screen',brand:'budget',rotation:0,color:'#3388ff'},{x:0,z:0},{id:'mast',step:{x:1,y:0,z:0}});sideScreen.id='sideScreen';mastDesign.parts.push(sideScreen)
  assert.equal(stageDesignIssue(mastDesign),null,'a module can be bolted to the side of a truss, not just under it')
  const sideBox=new Box3().setFromObject(createStageModel(mastDesign,{floor:false,effects:false,partIds:new Set(['sideScreen'])}))
  const mastBox=new Box3().setFromObject(createStageModel(mastDesign,{floor:false,effects:false,partIds:new Set(['mast'])}))
  assert.ok(Math.abs(sideBox.min.y-sideScreen.y)<1e-6&&Math.abs(sideBox.max.y-(sideScreen.y+1))<1e-6,'a side-mounted module fills the full height of its own cell')
  assert.ok(sideBox.min.x<mastBox.max.x,'and its arm reaches back into the truss rather than leaving it floating beside it')
  // Two walls bolted to two different faces of the same truss. Because a module mounted flat onto
  // a truss face lies *in* the boundary of that truss's cell while a wall's side edges land on
  // cell boundaries too, the front wall's edge and the side wall's face meet on the very same
  // cell corner — the corner closes instead of the two walls crossing through each other.
  // Both are placed with the orientation gizmo deliberately pointing the wrong way, because a
  // module bolted onto a truss face never gets to choose: its LEDs look out along that face.
  const cornerDesign=defaultStageDesign()
  cornerDesign.parts.push({id:'cornerPost',kind:'truss',brand:'budget',x:2,y:2,z:2,axis:'y',rotation:0,attachedTo:null,color:'#ffffff'})
  const frontPanel=stagePlacement(cornerDesign,{kind:'screen',brand:'budget',rotation:2,color:'#3388ff'},{x:0,z:0},{id:'cornerPost',step:{x:0,y:0,z:1}});frontPanel.id='frontPanel';cornerDesign.parts.push(frontPanel)
  const cornerPanel=stagePlacement(cornerDesign,{kind:'screen',brand:'budget',rotation:3,color:'#3388ff'},{x:0,z:0},{id:'cornerPost',step:{x:1,y:0,z:0}});cornerPanel.id='cornerPanel';cornerDesign.parts.push(cornerPanel)
  assert.equal(frontPanel.rotation,0,'a module bolted to a truss face turns its LEDs away from the truss rather than into it')
  assert.equal(cornerPanel.rotation,1,'whichever face it is bolted to')
  assert.equal(stageDesignIssue(cornerDesign),null,'two walls can be bolted to two different faces of the same truss')
  const cornerModel=createStageModel(cornerDesign)
  const frontFace=new Box3().setFromObject(cornerModel.userData.effects.find((r:any)=>r.userData.id==='frontPanel').children[0])
  const sideFace=new Box3().setFromObject(cornerModel.userData.effects.find((r:any)=>r.userData.id==='cornerPanel').children[0])
  assert.ok(sideFace.min.x>frontFace.max.x&&sideFace.min.x-frontFace.max.x<.1,'the side wall begins exactly where the front wall ends, closing the corner')
  assert.ok(frontFace.min.z>sideFace.max.z&&frontFace.min.z-sideFace.max.z<.1,'and the front wall begins exactly where the side wall ends')
  disposeStageModel(cornerModel)
  // A second truss segment chained beside the first, hosting its own screen directly below it —
  // the two screens land in grid-adjacent cells, exactly like two panels bolted side by side.
  const beam2=stagePlacement(wall,{kind:'truss',brand:'budget',rotation:0,color:'#ffffff'},{x:0,z:0},{id:'beam',step:{x:1,y:0,z:0}});beam2.id='beam2';wall.parts.push(beam2)
  const screenB=stagePlacement(wall,{kind:'screen',brand:'budget',rotation:0,color:'#3388ff'},{x:0,z:0},{id:'beam2',step:{x:0,y:-1,z:0}});screenB.id='screenB';wall.parts.push(screenB)
  assert.equal(stageDesignIssue(wall),null,'a second screen can dock beside the first, on the same truss run')
  const wallModel=createStageModel(wall)
  const rigA=wallModel.userData.effects.find((r:any)=>r.userData.id==='screenA'),rigB=wallModel.userData.effects.find((r:any)=>r.userData.id==='screenB')
  assert.equal((rigA.children[0] as any).geometry.getAttribute('color').count,3*3*24,'neither panel needs extra seam pixels — every module stays a plain 3x3')
  assert.equal((rigB.children[0] as any).geometry.getAttribute('color').count,3*3*24,'neither panel needs extra seam pixels — every module stays a plain 3x3')
  assert.deepEqual(rigB.userData.pixelCoords[0],{row:0,col:3},'the second panel continues the first one\'s global pixel columns rather than restarting at 0')
  // The whole point of sizing a module to exactly one cell with a 1/3-cell pixel lattice: the
  // seam between two modules disappears into the lattice, because it is the same width as the
  // gap between two pixels inside a single module.
  const pixelsA=new Box3().setFromObject(rigA.children[0]),pixelsB=new Box3().setFromObject(rigB.children[0])
  const pixelSize=pixelsA.max.x-pixelsA.min.x-2/3 // a module's pixel run spans two 1/3 pitches plus one whole pixel
  assert.ok(Math.abs(pixelsB.min.x-pixelsA.max.x-(1/3-pixelSize))<1e-6,'the gap between two neighbouring modules is exactly the gap between two pixels inside one module')
  animateStageModel(wallModel,{intensity:100,speed:60,fog:0,volume:0,color:'#ffffff'},0,true)
  const colorA=(rigA.children[0] as any).geometry.getAttribute('color').clone()
  animateStageModel(wallModel,{intensity:100,speed:60,fog:0,volume:0,color:'#ffffff'},1.4,true)
  const movedA=(rigA.children[0] as any).geometry.getAttribute('color')
  assert.notDeepEqual(Array.from(colorA.array),Array.from(movedA.array),'the diagonal glow wave animates over time')
  disposeStageModel(wallModel)

  // A wall can also grow by docking a new module directly onto an already-connected one, in any
  // of the four in-plane directions (never front/back), and it stays evenly spaced — a full grid
  // step away — exactly as if it had its own truss, so a mixed wall never looks unevenly gappy.
  // (Straight above screenA is where its own host truss sits, so "below" exercises the same
  // screen-onto-screen mechanism on an otherwise-free cell.)
  const screenBelow=stagePlacement(wall,{kind:'screen',brand:'budget',rotation:0,color:'#3388ff'},{x:0,z:0},{id:'screenA',step:{x:0,y:-1,z:0}});screenBelow.id='screenBelow'
  assert.equal(stageDesignIssue({...wall,parts:[...wall.parts,screenBelow]}),null,'a screen can dock directly onto another screen, growing the wall downward')
  const screenBehind=stagePlacement(wall,{kind:'screen',brand:'budget',rotation:0,color:'#3388ff'},{x:0,z:0},{id:'screenA',step:{x:0,y:0,z:1}});screenBehind.id='screenBehind'
  assert.ok(stageDesignIssue({...wall,parts:[...wall.parts,screenBehind]}),'a screen cannot dock onto the front/back of another screen, only in-plane')
  const screenRotated=stagePlacement(wall,{kind:'screen',brand:'budget',rotation:1,color:'#3388ff'},{x:0,z:0},{id:'screenA',step:{x:0,y:-1,z:0}})
  assert.equal(screenRotated.rotation,screenA.rotation,'a module extending a wall takes on its facing instead of being placed at odds with it')
  assert.ok(stageDesignIssue({...wall,parts:[...wall.parts,{...screenRotated,id:'screenRotated',rotation:1}]}),'and a wall whose modules face different ways is rejected outright')
  const withScreenBelow={...wall,parts:[...wall.parts,screenBelow]}
  // Measured on the LED faces themselves rather than the parts' full bounding boxes, because the
  // truss-mounted module also carries a rigging arm reaching up to its truss, which would skew
  // its box upwards while saying nothing about where the wall's pixel lattice actually sits.
  const chainModel=createStageModel(withScreenBelow)
  const chainTop=new Box3().setFromObject(chainModel.userData.effects.find((r:any)=>r.userData.id==='screenA').children[0]).getCenter(new Vector3())
  const chainBottom=new Box3().setFromObject(chainModel.userData.effects.find((r:any)=>r.userData.id==='screenBelow').children[0]).getCenter(new Vector3())
  assert.ok(Math.abs(chainTop.y-chainBottom.y-1)<1e-6,'a screen chained onto another sits a full grid step away, so a wall keeps one even lattice however it was assembled')
  disposeStageModel(chainModel)

  // Old saves that still carry the removed generic "speaker" kind keep loading: it silently
  // becomes a full-range speaker instead of failing validation.
  const legacyDesign=defaultStageDesign();legacyDesign.parts.push({id:'legacy',kind:'speaker' as any,brand:'budget',x:1,y:0,z:1,rotation:0,attachedTo:null,color:'#abcdef'})
  assert.ok(stageDesignIssue(legacyDesign),'the removed speaker kind is rejected before migration')
  const migrated=migrateStageDesign(legacyDesign)
  assert.equal(migrated.parts[0]!.kind,'fullRange');assert.equal(stageDesignIssue(migrated),null,'a migrated legacy design validates again')
  assert.equal(migrateStageDesign(migrated),migrated,'migration is a no-op once nothing needs rewriting')
  // The Themenbanner was dropped from the catalogue without a successor, so an old save simply
  // loses it — the rest of the stage keeps loading rather than failing validation as a whole.
  const bannerDesign=defaultStageDesign()
  bannerDesign.parts.push({id:'bannerTruss',kind:'truss',axis:'y',brand:'budget',x:1,y:0,z:1,rotation:0,attachedTo:null,color:'#ffffff'})
  bannerDesign.parts.push({id:'bannerPart',kind:'banner' as any,brand:'budget',x:1,y:1,z:1,rotation:0,attachedTo:'bannerTruss',color:'#abcdef'})
  assert.ok(stageDesignIssue(bannerDesign),'the removed banner kind is rejected before migration')
  const withoutBanner=migrateStageDesign(bannerDesign)
  assert.deepEqual(withoutBanner.parts.map(p=>p.id),['bannerTruss'],'migration takes the banner out and leaves the rest of the stage standing')
  assert.equal(stageDesignIssue(withoutBanner),null,'so a design saved with a banner still loads')
  // Likewise for saves made before a wall's LEDs were forced to face away from their truss: the
  // whole wall is turned round on load, chained modules included, not just the module bolted on.
  const backwardsDesign=defaultStageDesign()
  backwardsDesign.parts.push({id:'backPost',kind:'truss',brand:'budget',x:2,y:2,z:2,axis:'y',rotation:0,attachedTo:null,color:'#ffffff'})
  backwardsDesign.parts.push({id:'backPanel',kind:'screen',brand:'budget',x:3,y:2,z:2,rotation:3,attachedTo:'backPost',color:'#3388ff'})
  backwardsDesign.parts.push({id:'backPanelDown',kind:'screen',brand:'budget',x:3,y:1,z:2,rotation:3,attachedTo:'backPanel',color:'#3388ff'})
  const turnedDesign=migrateStageDesign(backwardsDesign)
  assert.deepEqual(turnedDesign.parts.filter(p=>p.kind==='screen').map(p=>p.rotation),[1,1],'a wall saved facing into its truss is turned outwards, every module of it')
  assert.equal(stageDesignIssue(turnedDesign),null,'and the turned wall still validates as one evenly facing wall')

  console.log('PASS six-directional truss docking, mid-tower branching, air chains, corners, free-floating structures, height limits, reachable stage audience courtyards, line-array curvature chains, speaker/sub stacking and legacy speaker migration')
}
