import { bandPositions, bandRoles, updateStageBand } from '../src/view/stageBand'
import assert from 'node:assert/strict'
import { Vector3, LineSegments, SpotLight, Box3 } from 'three'
import { GameState, type GameSnapshot } from '../src/game/GameState'
import { stagePlacement } from '../src/game/stagePlacement'
import { defaultStageDesign, stageDesignIssue, removeStagePart, stageAudienceCells, lineArrayIndex, migrateStageDesign, NEIGHBOR_STEPS, type StagePart } from '../src/game/stageDesign'
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

  // Old saves that still carry the removed generic "speaker" kind keep loading: it silently
  // becomes a full-range speaker instead of failing validation.
  const legacyDesign=defaultStageDesign();legacyDesign.parts.push({id:'legacy',kind:'speaker' as any,brand:'budget',x:1,y:0,z:1,rotation:0,attachedTo:null,color:'#abcdef'})
  assert.ok(stageDesignIssue(legacyDesign),'the removed speaker kind is rejected before migration')
  const migrated=migrateStageDesign(legacyDesign)
  assert.equal(migrated.parts[0]!.kind,'fullRange');assert.equal(stageDesignIssue(migrated),null,'a migrated legacy design validates again')
  assert.equal(migrateStageDesign(migrated),migrated,'migration is a no-op once nothing needs rewriting')

  console.log('PASS six-directional truss docking, mid-tower branching, air chains, corners, free-floating structures, height limits, reachable stage audience courtyards, line-array curvature chains, speaker/sub stacking and legacy speaker migration')
}
