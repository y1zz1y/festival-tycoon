import { bandPositions, bandRoles, updateStageBand } from '../src/view/stageBand'
import assert from 'node:assert/strict'
import { Vector3, LineSegments, SpotLight, Box3, Quaternion, Mesh, OrthographicCamera, type Group } from 'three'
import { GameState, type GameSnapshot } from '../src/game/GameState'
import { stagePlacement } from '../src/game/stagePlacement'
import { defaultStageDesign, stageDesignIssue, removeStagePart, stageAudienceCells, stageApronCells, stageApronDepth, fohDeskRole, lineArrayIndex, migrateStageDesign, stageStats, stageDetailSize, COMPONENTS, NEIGHBOR_STEPS, ROTATION_DIRECTIONS, STAGE_TILE_DETAIL, type StagePart } from '../src/game/stageDesign'
import { createStageModel, animateStageModel, disposeStageModel, updateStageLightPool } from '../src/view/stageModel'
import { lightViewOf } from '../src/view/lightSelection'
import { showIssue } from '../src/game/festivalManagement'
export function testStageInteraction(fixture:(count?:number)=>GameState){
  /** A stage with room to build on: the largest footprint the workshop offers, so the fixtures below can set parts a few cells apart whatever the default stage happens to measure. */
  const roomy=()=>{const d=defaultStageDesign();Object.assign(d,{tileWidth:8,tileDepth:8},stageDetailSize(8,8,d.tileHeight));return d}
  const legacy2d = defaultStageDesign()
  delete (legacy2d as any).height
  delete legacy2d.tileHeight
  legacy2d.parts = Array.from({length:4},(_,i)=>({id:`old-truss-${i}`,kind:'truss',brand:'touring',x:i,z:1,rotation:0,color:'#e69759'} as StagePart))
  const upgraded2d = migrateStageDesign(legacy2d)
  assert.ok(Number.isFinite(upgraded2d.height))
  assert.equal(upgraded2d.parts.length,4,'migration retains every old 2D truss')
  assert.ok(upgraded2d.parts.every(part=>part.y===0))
  assert.equal((legacy2d.parts[0] as any).y,undefined,'migration does not overwrite the original save object')
  const legacyModel = createStageModel(upgraded2d)
  legacyModel.traverse(object=>{
    if (!(object instanceof Mesh)) return
    for(const value of object.geometry.getAttribute('position').array) assert.ok(Number.isFinite(value),'legacy stage geometry stays finite')
    object.geometry.computeBoundingSphere()
    assert.ok(Number.isFinite(object.geometry.boundingSphere!.radius))
  })
  disposeStageModel(legacyModel)
  for (const kind of Object.keys(COMPONENTS) as StagePart['kind'][]) for (const rotation of [0,1,2,3,4,5]) {
    const design = defaultStageDesign()
    design.parts = [
      { id:'finite-host', kind:'truss', x:0, y:2, z:0, rotation:0, attachedTo:null, brand:'budget', color:'#ffffff' },
      { id:`finite-${kind}`, kind, x:0, y:1, z:0, rotation, attachedTo:'finite-host', brand:'budget', color:'#ffffff' },
    ]
    const model = createStageModel(design, { floor:false })
    model.traverse(object => {
      if (!(object instanceof Mesh || object instanceof LineSegments)) return
      for (const value of object.geometry.getAttribute('position').array) {
        assert.ok(Number.isFinite(value), `${kind} rotation ${rotation}: every model vertex must be finite`)
      }
    })
    disposeStageModel(model)
  }
  const performerDesign=defaultStageDesign()
  assert.equal(bandPositions(performerDesign).length,0,'bare stage floor is not a performer podium')
  for(let x=0;x<performerDesign.width;x++)performerDesign.parts.push({id:`deck-${x}`,kind:'deck',x,y:0,z:performerDesign.depth-1,rotation:0,attachedTo:null,brand:'budget',color:'#ffffff'})
  assert.equal(bandPositions(performerDesign).length,4)
  for(const pos of bandPositions(performerDesign))assert.ok(performerDesign.parts.some(p=>p.x===pos.x+performerDesign.width/2-.5&&p.z===pos.z+performerDesign.depth/2-.5))
  const performanceStage=createStageModel(performerDesign)
  updateStageBand(performanceStage,'meadow',0,false);assert.equal(performanceStage.userData.band,undefined)
  updateStageBand(performanceStage,'meadow',0,true,performerDesign);const performers=performanceStage.userData.band;assert.equal(performers.children.length,4)
  assert.ok(performers.children.every((p:any)=>p.position.y>=.54),'musicians stand on top of podiums')
  const arm=performers.children[1].userData.arms[0],angle=arm.rotation.x
  updateStageBand(performanceStage,'meadow',.4,true,performerDesign);assert.equal(performanceStage.userData.band,performers);assert.notEqual(arm.rotation.x,angle)
  updateStageBand(performanceStage,'meadow',.4,false);assert.equal(performers.visible,false)
  // An electro act ('neon') brings a DJ booth instead of a line-up: one console, one DJ centred
  // behind it, and cue buttons that blink on their own without the console itself moving.
  updateStageBand(performanceStage,'neon',1,true,performerDesign);assert.equal(performers.parent,null)
  const booth=performanceStage.userData.band
  const console_=booth.children.find((c:any)=>c.userData.lights),dj=booth.children.find((c:any)=>c.userData.role==='dj')
  assert.ok(console_&&dj,'an electro act plays a console with a DJ behind it')
  assert.equal(booth.children.length,2,'and brings no band along with it')
  assert.ok(Math.abs(console_.position.x-dj.position.x)<1e-6,'the DJ stands centred on the console')
  assert.ok(dj.position.z<console_.position.z,'and behind it, with the console between them and the crowd')
  const buttons=(console_.userData.lights as any).geometry.getAttribute('color')
  const beforeBlink=Array.from(buttons.array as Float32Array)
  updateStageBand(performanceStage,'neon',1.4,true,performerDesign)
  assert.notDeepEqual(Array.from(buttons.array as Float32Array),beforeBlink,'its buttons blink over time')
  assert.ok(bandRoles('brass').includes('brass'));assert.ok(bandRoles('campfire').includes('guitar'))
  // A deck floor with one spectator tile (its cells: the left half, back half) and one cell taken
  // by a truss — musicians may use neither.
  const occupied=defaultStageDesign();occupied.audience=[{x:0,z:1}]
  const audienceCell=(x:number,z:number)=>x<occupied.width/2&&z>=occupied.depth/2
  for(let x=0;x<occupied.width;x++)for(let z=0;z<occupied.depth;z++){
    if(audienceCell(x,z)||(x===occupied.width-1&&z===occupied.depth-1))continue
    occupied.parts.push({id:`deck-${x}-${z}`,kind:'deck',x,y:0,z,rotation:0,attachedTo:null,brand:'budget',color:'#ffffff'})
  }
  occupied.parts.push({id:'motor',kind:'truss',axis:'x',x:occupied.width-1,y:0,z:occupied.depth-1,rotation:0,attachedTo:null,brand:'budget',color:'#ffffff'})
  assert.equal(stageDesignIssue(occupied),null)
  for(const pos of bandPositions(occupied)){const x=pos.x+occupied.width/2-.5,z=pos.z+occupied.depth/2-.5;assert.ok(!audienceCell(x,z),'musicians keep off the spectator tile');assert.ok(!(x===occupied.width-1&&z===occupied.depth-1),'and off cells other equipment stands on')}
  occupied.parts=[];for(let x=0;x<occupied.width;x++)for(let z=0;z<occupied.depth;z++)occupied.parts.push({id:`${x}-${z}`,kind:'fullRange',x,y:0,z,rotation:0,attachedTo:null,brand:'budget',color:'#ffffff'})
  assert.equal(bandPositions(occupied).length,0);disposeStageModel(performanceStage)

  // Every attachment — hanging, sitting on top, side-by-side — is the same operation now: dock onto one of a truss's six neighbouring cells.
  const d=roomy(),settings={kind:'fullRange' as const,brand:'touring' as const,rotation:0,color:'#ff88cc'}
  const post:StagePart={id:'post',kind:'truss',brand:'budget',x:2,y:1,z:2,axis:'y',rotation:0,attachedTo:null,color:'#ffffff'};d.parts.push(post)
  let n=0
  for(const step of NEIGHBOR_STEPS){const box=stagePlacement(d,settings,{x:0,z:0},{id:'post',step});box.id=`box${++n}`;d.parts.push(box);assert.equal(stageDesignIssue(d),null,'a full-range speaker can dock onto any of the six sides of a truss')}
  const dupSide=stagePlacement(d,settings,{x:0,z:0},{id:'post',step:NEIGHBOR_STEPS[0]!})
  assert.ok(stageDesignIssue({...d,parts:[...d.parts,{...dupSide,id:'dupSide'}]}),'the same side cannot hold two full-range speakers')
  assert.equal(removeStagePart(d,'post').parts.length,0,'removing the host removes everything docked onto it')

  // Effects: beam direction follows the part's own facing (rotation, as chosen with the
  // orientation cube), independent of which side of the host truss it happens to dock onto.
  const rig=roomy();rig.parts.push({id:'truss',kind:'truss',axis:'x',brand:'budget',x:2,y:1,z:2,rotation:0,attachedTo:null,color:'#ffffff'})
  const hanging=stagePlacement(rig,{...settings,kind:'spot',rotation:5},{x:0,z:0},{id:'truss',step:{x:0,y:-1,z:0}});hanging.id='hanging';rig.parts.push(hanging)
  assert.equal(hanging.attachedTo,'truss');assert.equal(stageDesignIssue(rig),null)
  const above=stagePlacement(rig,{...settings,kind:'spot',rotation:4},{x:0,z:0},{id:'truss',step:{x:0,y:1,z:0}});above.id='above';rig.parts.push(above)
  const laser=stagePlacement(rig,{...settings,kind:'laser'},{x:0,z:0},{id:'truss',step:{x:1,y:0,z:0}});laser.id='laser';rig.parts.push(laser)
  const fog=stagePlacement(rig,{kind:'fog',brand:'touring',rotation:0,color:'#ff88cc'},{x:0,z:0});fog.id='fog';rig.parts.push(fog)
  assert.equal(stageDesignIssue(rig),null,'a ground-placed fog machine rests on the floor while everything else hangs off the truss')
  const foggy=stagePlacement(rig,{kind:'fog',brand:'budget',rotation:2,color:'#88ccff'},{x:0,z:0},{id:'truss',step:{x:0,y:0,z:1}});foggy.id='foggy';rig.parts.push(foggy)
  assert.equal(foggy.attachedTo,'truss');assert.equal(stageDesignIssue(rig),null,'a fog machine can also dock onto a truss like a spot or laser')
  const trussSparks=stagePlacement(rig,{kind:'sparks',brand:'budget',rotation:4,color:'#ffd9a0'},{x:0,z:0},{id:'truss',step:{x:0,y:0,z:-1}});trussSparks.id='trussSparks';rig.parts.push(trussSparks)
  assert.equal(trussSparks.attachedTo,'truss');assert.equal(stageDesignIssue(rig),null,'a spark fountain hangs off a truss the same way')
  const groundSparks=stagePlacement(rig,{kind:'sparks',brand:'budget',rotation:4,color:'#ffd9a0'},{x:1,z:0});groundSparks.id='groundSparks';rig.parts.push(groundSparks)
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
  // The pool's real lights go to the stage the camera looks at, not to whichever stage
  // comes first: two copies of the rig, one under the camera and one far away, and every
  // pooled light lands on the one in view.
  {
    const near=createStageModel(rig,{lightBudget:0}),far=createStageModel(rig,{lightBudget:0})
    far.position.set(80,0,0);near.updateMatrixWorld(true);far.updateMatrixWorld(true)
    for(const m of [near,far])animateStageModel(m,phase,1,true)
    const pool=Array.from({length:2},()=>new SpotLight(0xffffff,0,12,.21,.45,1))
    const camera=new OrthographicCamera(-6,6,6,-6,.1,100);camera.position.set(0,20,0);camera.lookAt(0,0,0);camera.updateMatrixWorld()
    updateStageLightPool([far,near],pool,lightViewOf(camera,new Vector3(0,0,0)))
    assert.ok(pool.every(light=>light.intensity>0&&Math.abs(light.position.x)<10),'both real lights serve heads on the stage in view, though the far stage is listed first')
  }
  // A beam has to carry across the crowd, so it throws four map tiles — the same distance
  // over the ground however many build cells a tile is divided into. The cone the player
  // sees, the throw the mirror balls are tested against and the spot light's own angle
  // all come from the same pair of numbers and must not drift apart.
  const reach=4*STAGE_TILE_DETAIL
  for(const spot of spots){
    assert.equal(spot.userData.length,reach,'a moving head throws four tiles')
    const cone=(spot.userData.beams as any).children[0]
    assert.equal(cone.geometry.parameters.height,reach,'and its visible cone is exactly that long')
    assert.ok(Math.abs(spot.userData.light.angle-Math.atan(cone.geometry.parameters.radius/reach))<1e-9,'the light matches the cone it draws')
  }
  // A moving head's two arms cradle the head at its *sides*, so they must stand square to the
  // lens for every mount side and every aim. Reaching an aim by twisting the head inside a fixed
  // yoke would hit the same aim but swing the arms round to the head's front and back, leaving
  // the lens staring into one of them — so the aim has to be split into a yoke pan and a tilt.
  for(const step of NEIGHBOR_STEPS)for(let rotation=0;rotation<ROTATION_DIRECTIONS.length;rotation++){
    const yokeDesign=roomy()
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
  // A mirror ball hangs under a truss and nowhere else, and its facets — like a star's tubes and a
  // palm's festoon — run whichever pattern the show desk's Deko-Licht setting is on.
  const discoDesign=roomy()
  discoDesign.parts.push({id:'discoBeam',kind:'truss',brand:'budget',axis:'x',x:2,y:2,z:2,rotation:0,attachedTo:null,color:'#ffffff'})
  const ball=stagePlacement(discoDesign,{kind:'discoBall',brand:'budget',rotation:0,color:'#ff5aa8'},{x:0,z:0},{id:'discoBeam',step:{x:0,y:-1,z:0}});ball.id='ball';discoDesign.parts.push(ball)
  assert.equal(stageDesignIssue(discoDesign),null,'a mirror ball hangs under a truss')
  const besideBeam=stagePlacement(discoDesign,{kind:'discoBall',brand:'budget',rotation:0,color:'#ff5aa8'},{x:0,z:0},{id:'discoBeam',step:{x:1,y:0,z:0}})
  assert.ok(stageDesignIssue({...discoDesign,parts:[...discoDesign.parts,{...besideBeam,id:'besideBeam'}]}),'but never beside one — it hangs off its motor')
  const discoModel=createStageModel(discoDesign)
  const facets=discoModel.userData.effects.find((r:any)=>r.userData.kind==='deco')
  assert.ok(facets,'its facets are their own animated rig')
  const litLevels=(pattern:string,time:number)=>{
    animateStageModel(discoModel,{intensity:80,speed:60,movement:0,pyro:0,deco:pattern as any,fog:0,volume:0,color:'#ffffff'},time,true)
    const shade=(facets.children[0] as any).geometry.getAttribute('color')
    return (facets.userData.spans as any[]).map(s=>Number(shade.getX(s.start).toFixed(3)))
  }
  const total=(levels:number[])=>levels.reduce((sum,level)=>sum+level,0)
  const evenly=litLevels('static',1),chasing=litLevels('chase',1),later=litLevels('chase',1.7)
  assert.ok(new Set(chasing).size>2,'a chase lights its facets to different degrees at any one moment')
  assert.notDeepEqual(chasing,later,'and moves on over time')
  assert.notDeepEqual(litLevels('sparkle',1),chasing,'the patterns differ from one another')
  assert.ok(total(evenly)>total(chasing)&&total(evenly)>total(litLevels('pulse',1)),'and none of them is as bright as leaving the lamps on')
  animateStageModel(discoModel,{intensity:80,speed:60,movement:0,pyro:0,deco:'chase',fog:0,volume:0,color:'#ffffff'},1,false)
  assert.ok(facets.visible,'with the show off the lamps hold a resting glow rather than vanishing')
  disposeStageModel(discoModel)
  // And the point of a mirror ball: a moving head aimed at it comes back off it as light.
  const mirrorDesign=roomy()
  mirrorDesign.parts.push({id:'mirrorBeam',kind:'truss',brand:'budget',axis:'x',x:2,y:2,z:2,rotation:0,attachedTo:null,color:'#ffffff'})
  for(let x=3;x<=5;x++)mirrorDesign.parts.push({id:`mirrorBeam${x}`,kind:'truss',brand:'budget',axis:'x',x,y:2,z:2,rotation:0,attachedTo:x===3?'mirrorBeam':`mirrorBeam${x-1}`,color:'#ffffff'})
  mirrorDesign.parts.push({id:'aimed',kind:'spot',brand:'touring',x:2,y:1,z:2,rotation:1,attachedTo:'mirrorBeam',color:'#ffd27f'}) // rotation 1 points it along +X, at the ball
  mirrorDesign.parts.push({id:'mirror',kind:'discoBall',brand:'budget',x:5,y:1,z:2,rotation:0,attachedTo:'mirrorBeam5',color:'#dfe7ef'})
  assert.equal(stageDesignIssue(mirrorDesign),null)
  const mirrorModel=createStageModel(mirrorDesign,{lightBudget:2})
  const mirror=mirrorModel.userData.effects.find((r:any)=>r.userData.rays)
  const showPhase={intensity:100,speed:40,movement:0,pyro:0,deco:'chase' as const,fog:0,volume:0,color:'#ffd27f'}
  animateStageModel(mirrorModel,showPhase,1.2,true)
  assert.ok(mirror.userData.hit>0&&mirror.userData.rays.visible,`a head aimed at the ball makes it throw light back (${mirror.userData.hit})`)
  const aimedAway=mirrorModel.userData.effects.find((r:any)=>r.userData.kind==='spot')
  aimedAway.userData.headRestQuat=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI) // swing the head round to face away
  animateStageModel(mirrorModel,showPhase,1.2,true)
  assert.ok(mirror.userData.hit===0&&!mirror.userData.rays.visible,'turn the head away and the reflection stops')
  disposeStageModel(mirrorModel)

  // A spark fountain works straight up into open sky, and the Feuerwerk/Funken fader drives how
  // hard it runs — how many sparks fly and how far they are thrown — never how brightly they burn.
  // The sparks fly ballistically and are recomputed from the show clock alone, so each setting is
  // sampled across a run of frames to catch the plume at its fullest.
  const fountainDesign=defaultStageDesign()
  const fountain=stagePlacement(fountainDesign,{kind:'sparks',brand:'budget',rotation:0,color:'#ffd9a0'},{x:1,z:1});fountain.id='fountain';fountainDesign.parts.push(fountain)
  assert.equal(fountain.rotation,4,'a fountain is always aimed upwards, whichever way the orientation cube points')
  assert.equal(stageDesignIssue(fountainDesign),null,'and stands happily under open sky')
  const overFountain:StagePart={id:'overFountain',kind:'truss',brand:'budget',axis:'x',x:1,y:2,z:1,rotation:0,attachedTo:null,color:'#ffffff'}
  assert.ok(stageDesignIssue({...fountainDesign,parts:[...fountainDesign.parts,overFountain]}),'but not with a truss standing over it')
  const fountainModel=createStageModel(fountainDesign),pyroPhase={intensity:100,speed:60,movement:0,pyro:100,fog:0,volume:0,color:'#ffcf8a'}
  const plumeUp=fountainModel.userData.effects.find((r:any)=>r.userData.kind==='sparks')
  const throwRange=4*STAGE_TILE_DETAIL
  const plume=(pyro:number)=>{
    let lit=0,peak=0,highest=0
    for(let frame=0;frame<160;frame++){
      animateStageModel(fountainModel,{...pyroPhase,pyro},frame*.02,true)
      const shade=(plumeUp.children[0] as any).geometry.getAttribute('color'),points=(plumeUp.children[0] as any).geometry.getAttribute('position')
      lit=0
      for(let v=1;v<shade.count;v+=2){const value=shade.getX(v);if(value>.001)lit++;peak=Math.max(peak,value)}
      for(let v=0;v<points.count;v++)highest=Math.max(highest,points.getY(v))
    }
    return {lit,peak,highest}
  }
  const wideOpen=plume(100),turnedDown=plume(40)
  assert.ok(wideOpen.highest>throwRange*.75&&wideOpen.highest<=throwRange,`wide open its sparks reach about the rated four tiles and never overshoot them (${wideOpen.highest.toFixed(2)} of ${throwRange})`)
  assert.ok(turnedDown.lit>0&&turnedDown.lit<wideOpen.lit*.6,`turned down the plume thins out (${turnedDown.lit} of ${wideOpen.lit} streaks)`)
  assert.ok(turnedDown.highest<wideOpen.highest*.55&&turnedDown.highest>wideOpen.highest*.25,`and is thrown lower with it (${turnedDown.highest.toFixed(2)} against ${wideOpen.highest.toFixed(2)})`)
  assert.ok(turnedDown.peak>.9&&wideOpen.peak>.9,'while the sparks that do fly burn just as bright either way')
  assert.equal(plume(0).lit,0,'and nothing is emitted at all at zero')
  animateStageModel(fountainModel,{...pyroPhase,pyro:0},1,true)
  assert.equal(plumeUp.visible,false,'with the fader right down the fountain stops altogether')
  disposeStageModel(fountainModel)
  // Fireworks fire straight up into open sky: the orientation cube gets no say over where they
  // point, and nothing may stand in the column above them.
  const skyDesign=roomy()
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
  const tower=roomy(),trussSettings={kind:'truss' as const,brand:'budget' as const,rotation:0,color:'#ffffff'}
  const base=stagePlacement(tower,trussSettings,{x:1,z:2});base.id='base';tower.parts.push(base)
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
  const floating:StagePart={id:'floating',kind:'truss',brand:'budget',x:3,y:5,z:3,axis:'y',rotation:0,attachedTo:null,color:'#ffffff'}
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

  // The FOH desk and the delay position are components of the workshop like any other, standing on
  // the floor rather than coming with every stage the way the audience area does.
  for(const kind of ['foh','delay'] as const){
    // Both are sold in one version only, so 'budget' is the make they have.
    const onGround=stagePlacement(tower,{kind,brand:'budget',rotation:0,color:'#ffaa33'},{x:0,z:0})
    assert.equal(onGround.attachedTo,null)
    assert.equal(stageDesignIssue({...defaultStageDesign(),parts:[onGround]}),null,`${kind} stands on the floor`)
    const onTruss=stagePlacement(tower,{kind,brand:'budget',rotation:0,color:'#ffaa33'},{x:0,z:0},{id:'base',step:{x:0,y:0,z:1}})
    assert.ok(stageDesignIssue({...tower,parts:[...tower.parts,{...onTruss,id:`${kind}OnTruss`}]}),`${kind} cannot hang from a truss`)
    const built=createStageModel({...defaultStageDesign(),parts:[onGround]},{lightBudget:2})
    assert.ok(built.children.length,`${kind} builds geometry`)
    disposeStageModel(built)
  }

  // The configured grid height is the only limit on how tall a tower can grow.
  const tallDesign=roomy()
  let cursor=stagePlacement(tallDesign,trussSettings,{x:2,z:2});cursor.id='t0';tallDesign.parts.push(cursor);let chainId='t0'
  for(let lvl=1;lvl<tallDesign.height;lvl++){const seg=stagePlacement(tallDesign,trussSettings,{x:0,z:0},{id:chainId,step:{x:0,y:1,z:0}});seg.id=`t${lvl}`;tallDesign.parts.push(seg);chainId=seg.id}
  assert.equal(stageDesignIssue(tallDesign),null,'a tower can fill the entire configured height')
  const tooTall=stagePlacement(tallDesign,trussSettings,{x:0,z:0},{id:chainId,step:{x:0,y:1,z:0}})
  assert.ok(stageDesignIssue({...tallDesign,parts:[...tallDesign.parts,{...tooTall,id:'tooTall'}]}),'the grid height is a hard limit')
  const shorter={...defaultStageDesign(),tileHeight:4}
  Object.assign(shorter,stageDetailSize(shorter.tileWidth,shorter.tileDepth,4))
  assert.equal(stageDesignIssue(shorter),null,'a shorter stage simply has a lower ceiling')

  const audience=defaultStageDesign();Object.assign(audience,{tileWidth:3,tileDepth:3},stageDetailSize(3,3,audience.tileHeight));audience.audience=[{x:0,z:1},{x:1,z:1}]
  assert.equal(stageDesignIssue(audience),null)
  assert.ok(stageDesignIssue({...audience,audience:[{x:1,z:1}]}),'sealed audience courtyards need an entrance')
  assert.ok(stageDesignIssue({...audience,parts:[{id:'blocked',kind:'deck',brand:'budget',x:1,y:0,z:1,rotation:0,attachedTo:null,color:'#ffffff'}]}),'floor equipment cannot obstruct spectator tiles')
  assert.deepEqual(stageAudienceCells({x:6,z:-20,rotation:1,stageDesign:audience}),[{x:7,z:-18},{x:7,z:-19}])

  // A FOH stand and a delay position are the exception: they belong with the crowd, so they may
  // stand on a painted audience tile and out on the standard audience area in front of the stage,
  // and wherever they do stand, that field stops being audience ground.
  const deskOnAudience:StagePart={id:'foh',kind:'foh',brand:'budget',x:0,y:0,z:1,rotation:0,attachedTo:null,color:'#ffffff'}
  const withDesk={...audience,parts:[deskOnAudience]}
  assert.equal(stageDesignIssue(withDesk),null,'a FOH stand may stand on a painted audience tile')
  assert.deepEqual(stageAudienceCells({x:6,z:-20,rotation:1,stageDesign:withDesk}),[{x:7,z:-19}],'and takes that tile out of the crowd')
  const towerOnApron:StagePart={id:'delay',kind:'delay',brand:'budget',x:2,y:0,z:audience.depth,rotation:0,attachedTo:null,color:'#ffffff'}
  assert.equal(stageDesignIssue({...audience,parts:[towerOnApron]}),null,'a delay tower may stand out on the standard audience area')
  assert.ok(stageDesignIssue({...audience,parts:[{...towerOnApron,kind:'deck'}]}),'while everything else stops at the platform edge')
  assert.ok(stageDesignIssue({...audience,parts:[{...towerOnApron,z:audience.depth+stageApronDepth(audience)}]}),'and the audience area is where even their build area ends')
  // Both are built at the size of the field they stand on, so they snap to it and fill it alone.
  /** A point well inside the given field of the grid, rather than on its corner. */
  const inside=(field:number)=>field*STAGE_TILE_DETAIL+STAGE_TILE_DETAIL*.7
  const snapped=stagePlacement(audience,{kind:'delay',brand:'budget',rotation:0,color:'#ffffff'},{x:inside(1),z:audience.depth+inside(0)})
  assert.deepEqual({x:snapped.x,z:snapped.z},{x:STAGE_TILE_DETAIL,z:audience.depth},'a delay tower snaps to its whole field, not to a build cell inside it')
  assert.ok(stageDesignIssue({...audience,parts:[towerOnApron,{...towerOnApron,id:'squeezed',kind:'foh'}]}),'and nothing else squeezes onto that field beside it')
  // Two desks on neighbouring fields are one big front-of-house stand: the lower field takes the
  // sound console, the other the lighting desk, the same way round in the workshop and on the map.
  assert.equal(fohDeskRole({x:4,z:6}),'all','a desk standing on its own is the all-round one')
  assert.equal(fohDeskRole({x:4,z:6},{x:6,z:6}),'sound')
  assert.equal(fohDeskRole({x:6,z:6},{x:4,z:6}),'light')
  assert.equal(fohDeskRole({x:4,z:6},{x:4,z:8}),'sound')
  assert.equal(fohDeskRole({x:4,z:8},{x:4,z:6}),'light')
  const pair={...audience,parts:[{...deskOnAudience,id:'left',x:0,z:audience.depth},{...deskOnAudience,id:'right',x:1,z:audience.depth}]}
  assert.equal(stageDesignIssue(pair),null,'two desks may stand side by side on neighbouring fields')
  const merged=createStageModel(pair,{floor:false,effects:false}),single=createStageModel({...audience,parts:[{...deskOnAudience,id:'left',x:0,z:audience.depth}]},{floor:false,effects:false})
  const vertices=(g:Group)=>{let n=0;g.traverse(o=>{if(o instanceof Mesh)n+=o.geometry.getAttribute('position').count});return n}
  assert.notEqual(vertices(merged),vertices(single)*2,'and are then built as two different desks rather than twice the same one')
  disposeStageModel(merged);disposeStageModel(single)
  const crowd=stageApronCells({x:6,z:-20,rotation:1,stageDesign:audience})
  const gapped=stageApronCells({x:6,z:-20,rotation:1,stageDesign:{...audience,parts:[towerOnApron]}})
  assert.equal(gapped.length,crowd.length-1,'a delay tower out in the crowd clears the field it stands on')
  const game=fixture(0),s=game.snapshot as GameSnapshot;game.addDebugMoney()
  for(let x=6;x<9;x++)for(let z=-20;z<-17;z++){game.manageFestival({type:'ground',x,z,kind:'drain'});game.manageFestival({type:'ground',x,z,kind:'compact'})}
  assert.ok(game.placePathSegment(5,-19,0).ok)
  assert.ok(game.manageFestival({type:'stageDesign',design:audience,selectForBuild:true}).ok)
  assert.ok(game.place('stage',6,-20).ok)
  const stage=s.buildings.find(b=>b.kind==='stage')!
  const owned=()=>s.stageForecourtCells.filter(c=>c.stageId===stage.id)
  for(const c of stageAudienceCells(stage))assert.ok(owned().some(o=>o.x===c.x&&o.z===c.z),'painted audience tiles become forecourt ground')
  // Plus the standard apron: the full width of the stage's frontage, twice that deep, starting at
  // the cell in front of it. The stage is 3 tiles wide, so 3 across and 6 deep.
  const ownedCount=owned().length
  assert.equal(ownedCount,stageAudienceCells(stage).length+3*6,'and a standard audience area in front of it')
  assert.ok(owned().some(c=>c.x===7&&c.z===-17),'which starts directly in front of the stage')
  assert.ok(owned().some(c=>c.x===7&&c.z===-12),'and reaches two stage widths out')
  assert.ok(!owned().some(c=>c.z<=-13&&c.z>=-16&&c.x===9),'staying within the stage\'s own frontage, not spilling sideways')
  assert.ok(!owned().some(c=>c.z===-11),'and no further')
  const shielded=game.bulldoze(7,-17)
  assert.equal(shielded.ok,false,'the standard audience area cannot be bulldozed away')
  assert.match(shielded.message,/Zuschauerfläche/,'and says so')
  assert.equal(owned().length,ownedCount,'so it is still all there')
  assert.equal((game as any).isPedestrianSolidAt(7,-19,0),false)
  assert.equal((game as any).isPedestrianSolidAt(7,-20,0),true)
  const route=(game as any).findPath({x:4,z:-19,elevation:0},[{x:7,z:-19,elevation:0}],false,false,false,false,true)
  assert.ok(route?.length,'guests can walk from a normal path through the audience entrance into the courtyard')
  assert.ok(route.some((p:any)=>p.x===6&&p.z===-19))
  assert.equal(game.canPlace('food',7,-19).ok,false,'audience area remains reserved for this stage')
  s.dayPlan.offers.stages=Array(24).fill(true)
  assert.equal(showIssue(s,{id:'show',stageId:stage.id,bandId:'meadow',day:s.day,start:600,duration:120,fee:450}),null,'integrated audience areas satisfy concert forecourt requirements')
  const loaded=GameState.fromJSON(JSON.stringify(s))!
  assert.equal(loaded.snapshot.stageForecourtCells.filter(c=>c.stageId===stage.id).length,ownedCount,'load does not duplicate integrated audience cells')
  assert.ok(loaded.bulldoze(7,-19).ok);assert.equal(loaded.snapshot.stageForecourtCells.filter(c=>c.stageId===stage.id).length,0)

  // Line arrays: the first cabinet docks onto a truss like any other equipment; every further
  // cabinet chains onto the one above it (never sideways, never upward), and each step down the
  // chain adds one more increment of curvature.
  const pa=roomy();pa.parts.push({id:'rig',kind:'truss',brand:'budget',x:2,y:3,z:2,axis:'x',rotation:0,attachedTo:null,color:'#ffffff'})
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
  const stack=roomy()
  const woofer=stagePlacement(stack,{kind:'subwoofer',brand:'budget',rotation:0,color:'#334455'},{x:2,z:2});woofer.id='woofer';stack.parts.push(woofer)
  assert.equal(stageDesignIssue(stack),null,'a subwoofer stands on the ground on its own')
  const onTop=stagePlacement(stack,{kind:'subwoofer',brand:'budget',rotation:0,color:'#334455'},{x:0,z:0},{id:'woofer',step:{x:0,y:1,z:0}});onTop.id='onTop';stack.parts.push(onTop)
  assert.equal(stageDesignIssue(stack),null,'a second subwoofer can stack directly on top of the first')
  const beside=stagePlacement(stack,{kind:'subwoofer',brand:'budget',rotation:0,color:'#334455'},{x:0,z:0},{id:'woofer',step:{x:1,y:0,z:0}});beside.id='beside'
  assert.ok(stageDesignIssue({...stack,parts:[...stack.parts,beside]}),'subwoofers cannot dock onto each other sideways')
  const rigged=roomy();rigged.parts.push({id:'truss',kind:'truss',brand:'budget',x:2,y:1,z:2,axis:'x',rotation:0,attachedTo:null,color:'#ffffff'})
  const hungSub=stagePlacement(rigged,{kind:'subwoofer',brand:'budget',rotation:0,color:'#334455'},{x:0,z:0},{id:'truss',step:{x:0,y:-1,z:0}});hungSub.id='hungSub'
  assert.ok(stageDesignIssue({...rigged,parts:[...rigged.parts,hungSub]}),'a subwoofer can never dock onto a truss')
  const hungFullRange=stagePlacement(rigged,{kind:'fullRange',brand:'budget',rotation:0,color:'#334455'},{x:0,z:0},{id:'truss',step:{x:0,y:-1,z:0}});hungFullRange.id='hungFullRange'
  assert.equal(stageDesignIssue({...rigged,parts:[...rigged.parts,hungFullRange]}),null,'unlike a subwoofer, a full-range speaker can still dock onto a truss')
  const wooferCenter=new Box3().setFromObject(createStageModel(stack,{floor:false,effects:false,partIds:new Set(['woofer'])})).getCenter(new Vector3())
  const onTopCenter=new Box3().setFromObject(createStageModel(stack,{floor:false,effects:false,partIds:new Set(['onTop'])})).getCenter(new Vector3())
  assert.ok(Math.abs(onTopCenter.y-wooferCenter.y-.9)<.01,'a stacked subwoofer sits flush on the ground-standing one below it (2×.45 half-heights)')

  // A subwoofer is also a stable platform: other equipment (full-range speakers, fog, lasers,
  // moving heads, ...) can stand on top of one, but only on top — never hung underneath/beside.
  const podium=roomy()
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

  // The floor is free: a design is billed for the equipment standing on it and nothing else, so
  // the platform can be as large as it likes. Party and beauty are no longer capped either — a
  // rig big enough to earn more than 100 of either keeps the credit for it.
  const billing=defaultStageDesign()
  assert.equal(stageStats(billing).cost,0,'an empty stage costs nothing to build')
  Object.assign(billing,{tileWidth:8,tileDepth:8},stageDetailSize(8,8,billing.tileHeight))
  assert.equal(stageStats(billing).cost,0,'however large its floor is')
  billing.parts.push({id:'beam',kind:'truss',brand:'budget',axis:'y',x:0,y:0,z:billing.depth-1,rotation:0,attachedTo:null,color:'#ffffff'})
  assert.equal(stageStats(billing).cost,COMPONENTS.truss.cost,'and one budget truss costs exactly its own price, with no floor surcharge on top')
  for(let n=0;n<24;n++)billing.parts.push({id:`palm-${n}`,kind:'palm',brand:'budget',x:n%billing.width,y:0,z:Math.floor(n/billing.width),rotation:0,attachedTo:null,color:'#ffffff'})
  for(let n=0;n<6;n++)billing.parts.push({id:`sub-${n}`,kind:'subwoofer',brand:'premium',x:n%billing.width,y:0,z:billing.depth-2,rotation:0,attachedTo:null,color:'#ffffff'})
  assert.equal(stageDesignIssue(billing),null,'a floor packed with kit is still a valid design')
  const packed=stageStats(billing)
  assert.ok(packed.party>100&&packed.beauty>100,`party and beauty count past 100 instead of being clamped to it (${packed.party}/${packed.beauty})`)

  // Pixel-LED-Wand screens: truss-only, and two docked side by side on the same run merge into
  // one wider pixel matrix with a shared, synchronised diagonal glow wave.
  const wall=roomy();wall.parts.push({id:'beam',kind:'truss',brand:'budget',x:2,y:2,z:2,axis:'x',rotation:0,attachedTo:null,color:'#ffffff'})
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
  const mastDesign=roomy()
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
  const cornerDesign=roomy()
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
  const skyward=migrateStageDesign({...defaultStageDesign(),parts:[{id:'oldFountain',kind:'sparks',brand:'budget',x:1,y:0,z:1,rotation:2,attachedTo:null,color:'#ffd9a0'}]})
  assert.equal(skyward.parts[0]!.rotation,4,'a fountain saved aimed sideways is turned upright on load, since it can no longer be built that way')

  // A design saved while a map tile still held a different number of build cells is re-gridded on
  // load, rather than failing validation and quietly dropping out of the library.
  const legacyGrid:StagePart[]=[{id:'oldPost',kind:'truss',brand:'budget',axis:'y',x:4,y:0,z:4,rotation:0,attachedTo:null,color:'#ffffff'},
    {id:'oldLamp',kind:'spot',brand:'budget',x:5,y:0,z:4,rotation:0,attachedTo:'oldPost',color:'#ffffff'}]
  const coarse={...defaultStageDesign(),tileWidth:2,tileDepth:2,tileHeight:2,width:6,depth:6,height:6,parts:legacyGrid}
  assert.ok(stageDesignIssue(coarse),'a design on the old grid does not validate as it stands')
  const regridded=migrateStageDesign(coarse)
  assert.deepEqual({width:regridded.width,depth:regridded.depth,height:regridded.height},stageDetailSize(2,2,2),'migration restates its size in current build cells')
  const oldPost=regridded.parts.find(p=>p.id==='oldPost')!
  assert.deepEqual({x:oldPost.x,z:oldPost.z},{x:1,z:1},'and scales its parts into the new grid')
  assert.deepEqual(regridded.parts.map(p=>p.id),['oldPost'],'where the new grid has no cell left for a neighbour, it is dropped rather than stacked')
  assert.equal(stageDesignIssue(regridded),null,'so the stage keeps loading instead of vanishing from the library')

  // Likewise for saves made before a wall's LEDs were forced to face away from their truss: the
  // whole wall is turned round on load, chained modules included, not just the module bolted on.
  const backwardsDesign=roomy()
  backwardsDesign.parts.push({id:'backPost',kind:'truss',brand:'budget',x:2,y:2,z:2,axis:'y',rotation:0,attachedTo:null,color:'#ffffff'})
  backwardsDesign.parts.push({id:'backPanel',kind:'screen',brand:'budget',x:3,y:2,z:2,rotation:3,attachedTo:'backPost',color:'#3388ff'})
  backwardsDesign.parts.push({id:'backPanelDown',kind:'screen',brand:'budget',x:3,y:1,z:2,rotation:3,attachedTo:'backPanel',color:'#3388ff'})
  const turnedDesign=migrateStageDesign(backwardsDesign)
  assert.deepEqual(turnedDesign.parts.filter(p=>p.kind==='screen').map(p=>p.rotation),[1,1],'a wall saved facing into its truss is turned outwards, every module of it')
  assert.equal(stageDesignIssue(turnedDesign),null,'and the turned wall still validates as one evenly facing wall')

  console.log('PASS six-directional truss docking, mid-tower branching, air chains, corners, free-floating structures, height limits, reachable stage audience courtyards, line-array curvature chains, speaker/sub stacking and legacy speaker migration')
}
