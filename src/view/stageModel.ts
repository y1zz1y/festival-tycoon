import { Group, Mesh, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, BufferGeometry, Float32BufferAttribute, LineSegments, LineBasicMaterial, SpotLight, Vector3, Quaternion, Color, DoubleSide, MeshStandardMaterial, MeshBasicMaterial, AdditiveBlending } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { isTruss, stageMotion, mountDirection, partFacing, isLastLineArrayElement, STAGE_TILE_DETAIL, type StageDesign, type StagePart, type ShowPhase } from '../game/stageDesign'

const unitX=new Vector3(1,0,0)
const unitZ=new Vector3(0,0,1)
/** Rotates a Y-axis CylinderGeometry to point along +Z, for lens/rim discs facing the fixture's own forward axis. */
const CYL_TO_FORWARD=new Quaternion().setFromAxisAngle(unitX,Math.PI/2)
/** For a truss's long axis, the two perpendicular unit vectors used to arrange its 3 chords. */
const CROSS_AXES = {
  x: [{x:0,y:1,z:0},{x:0,y:0,z:1}],
  y: [{x:1,y:0,z:0},{x:0,y:0,z:1}],
  z: [{x:1,y:0,z:0},{x:0,y:1,z:0}],
} as const
const ALONG_AXES = {x:{x:1,y:0,z:0},y:{x:0,y:1,z:0},z:{x:0,y:0,z:1}} as const
/** Colors used only by the floor slab/tiles, so its batched meshes can be found and hidden separately (e.g. when viewing from below). */
const FLOOR_COLORS = new Set(['#75886a','#30394c','#485166','#515b70'])
/** Half the height of each fixture's own body (matches its first box() call below), used to press it flush against a truss it is docked onto. */
const EQUIPMENT_REACH:Partial<Record<string,number>> = {lineArray:.48,fullRange:.4,subwoofer:.45,spot:.15,laser:.15,fireworks:.15,sparks:.15,fog:.15,star:.4}
/** Top surface of a floor tile (the .24 base slab plus the .04 detail overlay from the floor loop below) — where a ground-standing fixture's own base belongs, matching stageBand.ts's world-map floor level. */
const GROUND_Y=.28
/** Thickness of a Pixel-LED-Wand module's backing plate — its LEDs sit on the front of it. */
const SCREEN_DEPTH=.08
/** The mortar tubes of a firework rack: where each sits across the case and how far it stands above the deck. Shared by the rack's model and by the rockets that climb out of those same tubes. */
const MORTAR_TUBES=[{x:-.24,height:.42},{x:0,height:.54},{x:.24,height:.42}]
/** Seconds a rocket climbs before it bursts, and how long the star of embers then burns. */
const FIREWORK_RISE=.95,FIREWORK_BURST=1.5
/** Embers thrown by one burst, spread evenly over a sphere. */
const FIREWORK_EMBERS=26
/** How hard a burst's embers sag as they drift, in units per second squared — enough to bend the star into a falling willow without dragging it out of the sky. */
const FIREWORK_SAG=3.4
/** Individual spark streaks in a fountain's plume — enough for a dense core without a per-frame cost that scales with the stage. */
const SPARK_STREAKS=120
/** Seconds a fountain's fastest sparks take to reach the top of their arc, which is what fixes how hard they are thrown: the rest follows from the rated throw. */
const SPARK_APEX_TIME=.75
/** How long a spark's streak is, in seconds of its own travel: the trail is simply where it was this much earlier, so it stretches while the spark is fast and shortens as it slows near the top. */
const SPARK_TRAIL=.045
/** Downward tilt each further line-array cabinet picks up once curving begins (see lineArrayCabinetTilt below). */
const LINE_ARRAY_ANGLE_STEP=6*Math.PI/180
/** How far a line array docked to the *side* of a truss hangs below it, bridged by a rigging arm — real arrays hang off a bridle rather than sitting flush at truss height. */
const LINE_ARRAY_SIDE_DROP=.4
const LINE_ARRAY_CABINET_HEIGHT=.3
const LINE_ARRAY_CABINET_PITCH=.33 // 3 cabinets + the gaps between them span .96, filling one grid cell
/**
 * Tilt (from vertical) of one cabinet (0/1/2 = top/middle/bottom within its own element). Only the
 * bottom-most element of a hung chain (nothing docked below it) curves at all — its 3 cabinets
 * pick up LINE_ARRAY_ANGLE_STEP, 2×that and 3×that respectively; every element above it, however
 * long the chain, hangs perfectly straight. Real arrays are rigged the same way: most of the
 * array stays near-vertical for throw distance, and only the last box or two angles down as
 * near-field "end fill".
 */
function lineArrayCabinetTilt(localIndex:number,isLastElement:boolean):number{return isLastElement?(localIndex+1)*LINE_ARRAY_ANGLE_STEP:0}
/**
 * Recursively resolves a non-truss part's own rendered base (its "ex,ey,ez" — see the per-part
 * loop below). A truss always renders exactly at its own grid-cell centre, so a part docked onto
 * one can use that centre directly. A part docked onto *another part* (a hung line-array chain,
 * stacked speakers, anything sat atop a subwoofer) cannot: that host's own base was itself already
 * pulled away from its grid-cell centre by whatever it is docked to, so reusing the raw grid centre
 * at every link would drift the chain apart. Resolving the host's actual base first keeps every
 * link flush, however deep the chain.
 */
function resolveEquipmentBase(d:StageDesign,part:StagePart,cache:Map<string,{x:number;y:number;z:number}>):{x:number;y:number;z:number}{
  const cached=cache.get(part.id);if(cached)return cached
  const x=part.x-d.width/2+.5,z=part.z-d.depth/2+.5
  const host=part.attachedTo?d.parts.find(t=>t.id===part.attachedTo):undefined
  let pos:{x:number;y:number;z:number}
  if(part.kind==='screen'){
    // A Pixel-LED-Wand module is a plain 1x1 slab of LEDs (see the per-part loop below), and it
    // always comes to rest on the boundary between the cell of whatever it is bolted to and its
    // own. Grown off another module it simply lands one grid step from it, inheriting that
    // module's position, so a whole wall stays one rigid, evenly spaced lattice.
    const dir=host?mountDirection(part,host):undefined
    if(!host||!dir){
      pos={x,y:part.y,z}
    }else if(isTruss(host.kind)){
      const hc={x:host.x-d.width/2+.5,y:host.y+.5,z:host.z-d.depth/2+.5}
      // How the module meets that boundary depends on which truss face it hangs from. Mounted
      // flat onto the truss's front or rear face its own face is parallel to the boundary, so it
      // lies right in it, half a cell out from the truss's centre. Docked below/above or beside
      // the truss the boundary instead cuts across its face, so it butts its own edge against it
      // — filling its own cell. Either way both a wall's plane and its edges land on cell
      // boundaries, which is what lets two walls around a corner meet exactly instead of crossing
      // through one another. What is left between truss and module is spanned by a short rigging
      // arm (see the per-part loop below).
      const depthAxis=part.rotation%2?'x':'z'
      const reach=(dir.x?'x':dir.y?'y':'z')===depthAxis?.5:1
      pos={x:hc.x+dir.x*reach,y:hc.y+dir.y*reach-.5,z:hc.z+dir.z*reach}
    }else{
      const b=resolveEquipmentBase(d,host,cache)
      pos={x:b.x+dir.x,y:b.y+dir.y,z:b.z+dir.z}
    }
  }else if(!host){
    pos={x,y:GROUND_Y,z}
  }else{
    const dir=mountDirection(part,host)
    // hc must be the host's own centre, not its base: a truss already renders centred on its
    // grid cell, but another part's resolved base sits half its own height below that part's
    // centre (see the base/pivot split in the per-part loop below), so it needs converting back.
    const hc=isTruss(host.kind)?{x:host.x-d.width/2+.5,y:host.y+.5,z:host.z-d.depth/2+.5}:(()=>{const b=resolveEquipmentBase(d,host,cache);return {x:b.x,y:b.y+(EQUIPMENT_REACH[host.kind]??.3),z:b.z}})()
    const reach=isTruss(host.kind)?(EQUIPMENT_REACH[part.kind]??.3)+.13:(EQUIPMENT_REACH[host.kind]??.3)+(EQUIPMENT_REACH[part.kind]??.3)
    // A line array docked to the side of a truss (not straight below it) still hangs down off a
    // rigging arm rather than sitting flush at truss height — see the arm drawn in the per-part
    // loop below, which connects the truss to this same dropped position.
    const sideHungArray=part.kind==='lineArray'&&isTruss(host.kind)&&!dir.y&&(dir.x||dir.z)
    pos={
      x:dir.x?hc.x+dir.x*reach:x,
      y:dir.y?hc.y+dir.y*reach-(EQUIPMENT_REACH[part.kind]??.3):sideHungArray?hc.y-LINE_ARRAY_SIDE_DROP-(EQUIPMENT_REACH[part.kind]??.3):hc.y,
      z:dir.z?hc.z+dir.z*reach:z,
    }
  }
  cache.set(part.id,pos)
  return pos
}
/**
 * World position of the top of a line-array element's own run of 3 cabinets — where its rigging
 * rod begins. For a chained element, this is found by walking down through its host's own 3
 * cabinets — but a host always has something docked onto it here (namely `part` itself), so it is
 * by definition never the bottom-most element of the chain, meaning its own 3 cabinets are
 * guaranteed to hang perfectly straight (see lineArrayCabinetTilt) and the walk needs no tilt.
 */
function lineArrayTopAnchor(d:StageDesign,part:StagePart,baseCache:Map<string,{x:number;y:number;z:number}>,topCache:Map<string,Vector3>):Vector3{
  const cached=topCache.get(part.id);if(cached)return cached
  const host=d.parts.find(t=>t.id===part.attachedTo)!
  let top:Vector3
  if(isTruss(host.kind)){
    const base=resolveEquipmentBase(d,part,baseCache)
    top=new Vector3(base.x,base.y+2*(EQUIPMENT_REACH.lineArray??.48),base.z)
  }else{
    const hostTop=lineArrayTopAnchor(d,host,baseCache,topCache)
    const hostFacing=partFacing(host)
    const hostYaw=new Quaternion().setFromUnitVectors(unitZ,new Vector3(hostFacing.x,hostFacing.y,hostFacing.z))
    const straightDown=new Vector3(0,-1,0).applyQuaternion(hostYaw)
    top=hostTop.clone().addScaledVector(straightDown,3*LINE_ARRAY_CABINET_PITCH)
  }
  topCache.set(part.id,top)
  return top
}
type ScreenGroupInfo={row:number;col:number}
/**
 * Groups every 'screen' part into its connected wall — same facing, grid-adjacent to at least one
 * other screen in the group — and assigns each member a (row,col) position within that wall, in
 * panel units. That gives the diagonal glow wave one consistent coordinate system across however
 * many panels are joined together, so it reads as one ripple over the whole wall rather than
 * restarting inside every module.
 */
function computeScreenGroups(d:StageDesign):Map<string,ScreenGroupInfo>{
  const result=new Map<string,ScreenGroupInfo>()
  const screens=d.parts.filter(p=>p.kind==='screen')
  const visited=new Set<string>()
  for(const start of screens){
    if(visited.has(start.id))continue
    const sidewaysAxis:'x'|'z'=start.rotation===0||start.rotation===2?'x':'z'
    const depthAxis:'x'|'z'=sidewaysAxis==='x'?'z':'x'
    const coordOf=new Map<string,{row:number;col:number}>([[start.id,{row:0,col:0}]])
    visited.add(start.id)
    const queue=[start]
    while(queue.length){
      const cur=queue.shift()!,curCoord=coordOf.get(cur.id)!
      for(const cand of screens){
        if(visited.has(cand.id)||cand.rotation!==cur.rotation||cand[depthAxis]!==cur[depthAxis])continue
        const dCol=cand[sidewaysAxis]-cur[sidewaysAxis],dRow=cand.y-cur.y
        if(Math.abs(dCol)+Math.abs(dRow)!==1)continue
        visited.add(cand.id);coordOf.set(cand.id,{row:curCoord.row+dRow,col:curCoord.col+dCol});queue.push(cand)
      }
    }
    for(const [id,coord] of coordOf)result.set(id,coord)
  }
  return result
}
export function createStageModel(d:StageDesign,options:{floor?:boolean;partIds?:Set<string>;effects?:boolean;lightBudget?:number}={}):Group {
  const root=new Group(), buckets=new Map<string,BufferGeometry[]>(), effects:Group[]=[]
  const baseCache=new Map<string,{x:number;y:number;z:number}>()
  const lineArrayTopCache=new Map<string,Vector3>()
  const screenGroups=computeScreenGroups(d)
  let origin: {x:number;z:number;rotation:number}|undefined
  const rotateAround=(x:number,z:number)=>{
    if(!origin)return{x,z}
    const angle=origin.rotation*Math.PI/2,dx=x-origin.x,dz=z-origin.z
    return {x:origin.x+dx*Math.cos(angle)+dz*Math.sin(angle),z:origin.z-dx*Math.sin(angle)+dz*Math.cos(angle)}
  }
  const box=(x:number,y:number,z:number,w:number,h:number,depth:number,color:string)=>{
    const r=rotateAround(x,z);x=r.x;z=r.z
    if(origin&&origin.rotation%2)[w,depth]=[depth,w]
    const g=new BoxGeometry(w,h,depth);g.translate(x,y,z)
    const list=buckets.get(color)??[];list.push(g);buckets.set(color,list)
  }
  /** A forward-facing disc (a low-segment cylinder, chunky rather than perfectly smooth to match the game's pixel-art look) — for a round driver/membrane on an otherwise boxy fixture. */
  const disc=(x:number,y:number,z:number,radius:number,height:number,color:string)=>{
    const r=rotateAround(x,z);x=r.x;z=r.z
    const g=new CylinderGeometry(radius,radius,height,8);g.rotateX(Math.PI/2)
    if(origin)g.rotateY(origin.rotation*Math.PI/2)
    g.translate(x,y,z)
    const list=buckets.get(color)??[];list.push(g);buckets.set(color,list)
  }
  /** A thin box spanning two points; used for the diagonal lattice bracing of 3-point trusses. */
  const strut=(x1:number,y1:number,z1:number,x2:number,y2:number,z2:number,thickness:number,color:string)=>{
    const r1=rotateAround(x1,z1),r2=rotateAround(x2,z2)
    const dx=r2.x-r1.x,dy=y2-y1,dz=r2.z-r1.z,len=Math.hypot(dx,dy,dz)
    if(len<1e-4)return
    const g=new BoxGeometry(len,thickness,thickness)
    g.applyQuaternion(new Quaternion().setFromUnitVectors(unitX,new Vector3(dx,dy,dz).multiplyScalar(1/len)))
    g.translate((r1.x+r2.x)/2,(y1+y2)/2,(r1.z+r2.z)/2)
    const list=buckets.get(color)??[];list.push(g);buckets.set(color,list)
  }
  if(options.floor!==false){
    const w=d.tileWidth??1,h=d.tileDepth??1,cellWidth=d.width/w,cellDepth=d.depth/h
    for(let x=0;x<w;x++)for(let z=0;z<h;z++){
      const audience=d.audience?.some(c=>c.x===x&&c.z===z),cx=(x+.5)*cellWidth-d.width/2,cz=(z+.5)*cellDepth-d.depth/2
      box(cx,audience?.012:.12,cz,cellWidth,audience?.024:.24,cellDepth,audience?'#75886a':'#30394c')
      if(audience)continue
      for(let dx=0;dx<d.width;dx++)for(let dz=0;dz<d.depth;dz++){
        const left=Math.max(x*cellWidth,dx+.03),right=Math.min((x+1)*cellWidth,dx+.97),top=Math.max(z*cellDepth,dz+.03),bottom=Math.min((z+1)*cellDepth,dz+.97)
        if(right>left&&bottom>top)box((left+right)/2-d.width/2,.26,(top+bottom)/2-d.depth/2,right-left,.04,bottom-top,(dx+dz)%2?'#485166':'#515b70')
      }
    }
  }
  let lights=0
  const effect=(kind:string,x:number,y:number,z:number,color:string,dir:{x:number;y:number;z:number})=>{
    if(options.effects===false)return
    const rig=new Group();rig.position.set(x,y,z);rig.userData.kind=kind;rig.userData.index=effects.length;rig.userData.dir=dir;rig.userData.base=rig.position.clone()
    rig.userData.length=kind==='laser'?Math.max(4,d.depth*.8):kind==='fog'||kind==='sparks'?4*STAGE_TILE_DETAIL:4
    if(kind==='fireworks'){
      // One rocket per mortar tube, each on its own firing cycle: it climbs out of its tube,
      // slowing as it goes, and at the top bursts into a star of embers that fly apart and sag.
      // Every rocket owns a run of the buffer — one segment for the climbing rocket's trail, the
      // rest for its embers — and whichever of the two is not currently flying is collapsed to
      // nothing. animateStageModel derives all of it from the show clock, so nothing is kept
      // between frames and the same clock always shows the same sky.
      rig.userData.rockets=MORTAR_TUBES.map((tube,n)=>({
        x:tube.x,y:tube.height,
        apex:6+n*.9,driftX:(n-1)*.5,driftZ:n===1?.55:-.3,radius:2.4+n*.45,
        period:FIREWORK_RISE+FIREWORK_BURST+.6+n*.3,offset:n/MORTAR_TUBES.length,
      }))
      rig.userData.embers=Array.from({length:FIREWORK_EMBERS},(_,k)=>{
        const y=1-2*(k+.5)/FIREWORK_EMBERS,ring=Math.sqrt(1-y*y),angle=k*2.399963
        return {x:Math.cos(angle)*ring,y,z:Math.sin(angle)*ring}
      })
      const segments=MORTAR_TUBES.length*(1+FIREWORK_EMBERS)
      const geometry=new BufferGeometry()
      geometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(segments*6),3))
      geometry.setAttribute('color',new Float32BufferAttribute(new Float32Array(segments*6),3))
      rig.add(new LineSegments(geometry,new LineBasicMaterial({vertexColors:true,transparent:true,blending:AdditiveBlending,depthWrite:false})))
    }else if(kind==='sparks'){
      // Every spark is launched out of the nozzle along the rig's own +Y (see rig.quaternion in
      // animateStageModel) inside a narrow cone, then simply left to fly ballistically: they all
      // start at the same speed range but keep their own launch angle and lifetime, so the plume
      // tapers towards the top and its outermost sparks peel away and drop, the way a real
      // fountain's do. The fastest ones just reach the fixture's rated throw at the top of their
      // arc. Nothing is kept between frames — animateStageModel recomputes each spark's flight
      // from the show clock alone, so the same clock always yields the same plume.
      const reach=rig.userData.length as number
      const launchSpeed=2*reach/SPARK_APEX_TIME,gravity=launchSpeed/SPARK_APEX_TIME
      const scatter=(n:number,salt:number)=>{const v=Math.sin(n*12.9898+salt*78.233)*43758.5453;return v-Math.floor(v)}
      rig.userData.gravity=gravity
      rig.userData.sparks=Array.from({length:SPARK_STREAKS},(_,n)=>{
        const azimuth=n*2.399963,spread=.05+scatter(n,1)*.13,speed=launchSpeed*(.55+scatter(n,2)*.45)
        const aim=Math.hypot(spread,1)
        // life runs a little past the spark's own apex, so it is still lit as it tips over
        return {x:Math.cos(azimuth)*spread/aim,y:1/aim,z:Math.sin(azimuth)*spread/aim,speed,life:1.3*speed/gravity,offset:scatter(n,3)}
      })
      const geometry=new BufferGeometry()
      geometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(SPARK_STREAKS*6),3))
      geometry.setAttribute('color',new Float32BufferAttribute(new Float32Array(SPARK_STREAKS*6),3))
      rig.add(new LineSegments(geometry,new LineBasicMaterial({vertexColors:true,transparent:true,blending:AdditiveBlending,depthWrite:false})))
    }else if(kind==='fog'){
      // A chain of puffs drifting out along the shared outward axis, widening as they
      // disperse, reaching the requested 4-field length.
      const puffs=6,reach=rig.userData.length
      for(let n=0;n<puffs;n++){
        const t=n/(puffs-1),spread=.55+t*1.6
        const cloud=new Mesh(new SphereGeometry(1,10,5),new MeshBasicMaterial({color:'#c9d6dd',transparent:true,opacity:.05,depthWrite:false}))
        cloud.scale.set(spread,spread*.65,spread);cloud.position.set(0,t*reach,0);cloud.userData.travel=t*reach
        rig.add(cloud)
      }
    }else if(kind==='laser'){
      // A flat wedge of beams fanning out from the lens, +Y the shared outward axis (see rig.quaternion below).
      const rays=9,halfAngle=Math.PI*.32,points:number[]=[]
      for(let n=-rays;n<=rays;n++){const angle=n/rays*halfAngle;points.push(0,0,0,Math.sin(angle)*rig.userData.length,Math.cos(angle)*rig.userData.length,0)}
      const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(points,3))
      rig.add(new LineSegments(geometry,new LineBasicMaterial({color,transparent:true,opacity:.75,blending:AdditiveBlending,depthWrite:false})))
      rig.add(new Mesh(new SphereGeometry(.06,8,6),new MeshBasicMaterial({color,transparent:true,opacity:.9,depthWrite:false,blending:AdditiveBlending})))
    }
    root.add(rig);effects.push(rig)
  }
  for(const p of d.parts){
    if(options.partIds&&!options.partIds.has(p.id))continue
    const x=p.x-d.width/2+.5,y=p.y+.5,z=p.z-d.depth/2+.5,c=p.color
    const host=p.attachedTo?d.parts.find(t=>t.id===p.attachedTo):undefined
    if(isTruss(p.kind)){
      origin=undefined
      const axis=p.axis??'y',along=ALONG_AXES[axis],[ca,cb]=CROSS_AXES[axis]
      const pt=(t:number,a:number,b:number)=>({x:x+along.x*t+ca.x*a+cb.x*b,y:y+along.y*t+ca.y*a+cb.y*b,z:z+along.z*t+ca.z*a+cb.z*b})
      const chordColor='#b6c5cf',braceColor='#8a9aab',r=.13,half=.47
      // Chords reach all the way to a linked neighbour's own centre (t=+-1) so the two segments'
      // tubes physically overlap at the joint instead of leaving a gap that needs a filler block.
      const negLinked=d.parts.some(t=>isTruss(t.kind)&&t.x===p.x-along.x&&t.y===p.y-along.y&&t.z===p.z-along.z)
      const posLinked=d.parts.some(t=>isTruss(t.kind)&&t.x===p.x+along.x&&t.y===p.y+along.y&&t.z===p.z+along.z)
      const negT=negLinked?-1:-half,posT=posLinked?1:half
      const corners=[{a:0,b:r},{a:-r*.87,b:-r*.5},{a:r*.87,b:-r*.5}]
      for(const corner of corners){const p1=pt(negT,corner.a,corner.b),p2=pt(posT,corner.a,corner.b);strut(p1.x,p1.y,p1.z,p2.x,p2.y,p2.z,.045,chordColor)}
      const braces=3
      for(let i=0;i<braces;i++){
        const t0=-half+(i/braces)*(half*2),t1=-half+((i+1)/braces)*(half*2)
        const c0=corners[i%3]!,c1=corners[(i+1)%3]!
        const p1=pt(t0,c0.a,c0.b),p2=pt(t1,c1.a,c1.b)
        strut(p1.x,p1.y,p1.z,p2.x,p2.y,p2.z,.035,braceColor)
      }
    }else{
      const dir=mountDirection(p,host)
      // Every fixture below is built with its own base at (ex,ey,ez) and grows outward from
      // there (matching how each box() call above uses only positive offsets). Docked onto a
      // truss, that base is pulled out of the middle of the fixture's own cell and pressed up
      // against the truss's thin body instead, so there is no floating gap between them.
      const base=resolveEquipmentBase(d,p,baseCache)
      const ex=base.x,ey=base.y,ez=base.z
      origin={x:ex,z:ez,rotation:p.rotation}
      if(p.kind==='fullRange'){
        // A classic 2-way cabinet: housing, a small tweeter up top and a larger woofer below it.
        box(ex,ey+.4,ez,.65,.8,.5,'#171d28')
        box(ex,ey+.62,ez+.26,.16,.16,.03,'#414859');box(ex,ey+.62,ez+.29,.09,.09,.02,c)
        box(ex,ey+.32,ez+.26,.4,.4,.04,'#414859');box(ex,ey+.32,ez+.29,.28,.28,.02,c)
      }else if(p.kind==='subwoofer'){
        // A big, plain box dominated by one large round driver membrane on the front.
        box(ex,ey+.45,ez,.8,.9,.6,'#12161c')
        box(ex,ey+.45,ez+.31,.62,.62,.04,'#23282f');disc(ex,ey+.45,ez+.345,.27,.03,c)
      }else if(p.kind==='lineArray'){
        // A line-array element facing local +Z (the gizmo's chosen horizontal aim). Its 3
        // cabinets are simply threaded onto one continuous rigging rod that kinks by
        // LINE_ARRAY_ANGLE_STEP at every cabinet joint — the cabinets don't tilt independently,
        // they are carried along by whichever rod segment they sit on, so walking the rod IS
        // walking the cabinets. That walk starts at lineArrayTopAnchor (this element's own
        // attachment point, continuing on from every element already hung above it) and keeps
        // going seamlessly across element boundaries, so the curve is one unbroken bend down the
        // whole flown array rather than resetting at each element.
        const facing=partFacing(p),facingVec=new Vector3(facing.x,facing.y,facing.z)
        const yawQuat=new Quaternion().setFromUnitVectors(unitZ,facingVec)
        const cab='#20242b',trim='#3a4048',grille='#101318'
        const cabinetHeight=LINE_ARRAY_CABINET_HEIGHT,cabinetPitch=LINE_ARRAY_CABINET_PITCH
        const isLastElement=isLastLineArrayElement(d,p) // only the bottom-most element of the chain curves at all
        const topAnchor=lineArrayTopAnchor(d,p,baseCache,lineArrayTopCache)
        const cursor=topAnchor.clone()
        for(let i=0;i<3;i++){
          const segQuat=yawQuat.clone().multiply(new Quaternion().setFromAxisAngle(unitX,lineArrayCabinetTilt(i,isLastElement)))
          const segDir=new Vector3(0,-1,0).applyQuaternion(segQuat)
          const center=cursor.clone().addScaledVector(segDir,cabinetPitch/2)
          const putCab=(lx:number,ly:number,lz:number,w:number,h:number,depth:number,color:string)=>{
            const g=new BoxGeometry(w,h,depth);g.applyQuaternion(segQuat)
            const wp=new Vector3(lx,ly,lz).applyQuaternion(segQuat).add(center)
            g.translate(wp.x,wp.y,wp.z)
            const list=buckets.get(color)??[];list.push(g);buckets.set(color,list)
          }
          const putCabDisc=(lx:number,lz:number,radius:number,height:number,color:string)=>{
            const g=new CylinderGeometry(radius,radius,height,10)
            g.applyQuaternion(CYL_TO_FORWARD);g.applyQuaternion(segQuat)
            const wp=new Vector3(lx,0,lz).applyQuaternion(segQuat).add(center)
            g.translate(wp.x,wp.y,wp.z)
            const list=buckets.get(color)??[];list.push(g);buckets.set(color,list)
          }
          putCab(0,0,0,.62,cabinetHeight,.34,cab) // cabinet body
          putCab(0,cabinetHeight/2-.03,-.15,.5,.03,.02,trim) // rigging rail, top edge
          putCab(0,-cabinetHeight/2+.03,-.15,.5,.03,.02,trim) // rigging rail, bottom edge
          for(const tx of [-.18,0,.18])putCabDisc(tx,.175,.05,.03,grille) // three tweeters, side by side
          putCab(0,-cabinetHeight/2+.045,.175,.36,.035,.02,c) // brand strip, tinted by the chosen colour
          // The rigging-rod segment spans the *full* pitch (not just the cabinet's own height),
          // so consecutive segments — even the next element's first one — meet exactly at the
          // joint, each kinked LINE_ARRAY_ANGLE_STEP from the last: one continuous bent rod.
          putCab(.29,0,-.14,.045,cabinetPitch,.045,trim)
          cursor.addScaledVector(segDir,cabinetPitch)
        }
        if(host&&isTruss(host.kind)){
          if(!dir.x&&!dir.z){
            // A truss's own body is a sparse 3-chord lattice, not a solid rod, so a fixture's flat
            // top can land in the gap between chords and read as floating even though it is
            // technically flush. A rigging bracket spanning exactly the truss's own cross-section
            // (from the array's flush top up to the truss's own top surface, .13 above and below
            // its centre) — wide enough to cross the lattice regardless of which side the nearest
            // chord sits on — gives every array a visible physical link, without poking out above
            // the truss like a stray block sitting on top of it.
            const g=new BoxGeometry(.3,.26,.3);g.applyQuaternion(yawQuat)
            g.translate(topAnchor.x,topAnchor.y+.13,topAnchor.z)
            const list=buckets.get(trim)??[];list.push(g);buckets.set(trim,list)
          }else{
            // Docked to the *side* of a truss instead of straight below it, the array hangs off a
            // rigging arm rather than sitting flush at truss height (see the matching drop in
            // resolveEquipmentBase) — drawn here as a strut from the truss surface down to the
            // top-centre of the array, the same way the truss's own lattice struts are built.
            const hc={x:host.x-d.width/2+.5,y:host.y+.5,z:host.z-d.depth/2+.5}
            const trussSurface=new Vector3(hc.x+dir.x*.13,hc.y,hc.z+dir.z*.13)
            const armDelta=topAnchor.clone().sub(trussSurface),armLen=armDelta.length()
            if(armLen>1e-4){
              const g=new BoxGeometry(armLen,.07,.07)
              g.applyQuaternion(new Quaternion().setFromUnitVectors(unitX,armDelta.clone().multiplyScalar(1/armLen)))
              const mid=trussSurface.clone().add(topAnchor).multiplyScalar(.5)
              g.translate(mid.x,mid.y,mid.z)
              const list=buckets.get(trim)??[];list.push(g);buckets.set(trim,list)
            }
          }
        }
      }else if(p.kind==='spot'){
        // A real moving head: the base sits flush against the truss (dir), so its two yoke
        // arms always rise away from that same face — dir is therefore also the arms' pan
        // axis, not world-up.
        const dirVec=new Vector3(dir.x,dir.y,dir.z)
        const baseQuat=new Quaternion().setFromUnitVectors(unitZ,dirVec)
        const facing=partFacing(p),facingVec=new Vector3(facing.x,facing.y,facing.z)
        // Real yoke kinematics, and the only way the arms keep holding the head at its *sides*:
        // the gizmo-chosen aim is reached by panning the whole yoke around the base's normal and
        // then tilting the head around the line between the two arms. Twisting the head inside a
        // fixed yoke instead would reach the same aim but swing the arms round to the head's
        // front and back, with the lens staring straight at one of them.
        const aim=facingVec.clone().applyQuaternion(baseQuat.clone().invert())
        let tilt=Math.acos(Math.max(-1,Math.min(1,aim.z))),pan=Math.atan2(aim.x,-aim.y)
        // Panning past a quarter turn reaches the same aim as the opposite pan with the head
        // tilted back through vertical — that one keeps the head upright, so prefer it.
        if(Math.abs(pan)>Math.PI/2){pan-=Math.sign(pan)*Math.PI;tilt=-tilt}
        const armRestQuat=baseQuat.clone().multiply(new Quaternion().setFromAxisAngle(unitZ,pan))
        const headRestQuat=new Quaternion().setFromAxisAngle(unitX,tilt)
        const pivot=new Vector3(ex,ey+.16,ez)
        const putBase=(lx:number,ly:number,lz:number,w:number,h:number,depth:number,color:string)=>{
          const g=new BoxGeometry(w,h,depth);g.applyQuaternion(baseQuat)
          const wp=new Vector3(lx,ly,lz).applyQuaternion(baseQuat).add(pivot)
          g.translate(wp.x,wp.y,wp.z)
          const list=buckets.get(color)??[];list.push(g);buckets.set(color,list)
        }
        putBase(0,-.02,-.12,.12,.09,.08,'#3a4551') // mounting clamp, bridging to the truss
        putBase(0,0,0,.4,.3,.14,'#3a4551') // wide swivel base shell, flat against the truss (thin along dir)
        putBase(0,.06,.08,.1,.05,.02,'#1c2b33') // control-panel screen, on the outward face

        // Each moving part (arm, head) is its own merged, vertex-coloured mesh — one draw call
        // per part regardless of how many little boxes make it up — so that live pan/tilt
        // animation doesn't explode the scene's mesh count the way per-box materials would.
        const tint=(geometry:BufferGeometry,color:string)=>{
          const col=new Color(color),arr=new Float32Array(geometry.getAttribute('position').count*3)
          for(let i=0;i<arr.length;i+=3)col.toArray(arr,i)
          geometry.setAttribute('color',new Float32BufferAttribute(arr,3));geometry.deleteAttribute('uv')
          return geometry
        }
        const merge=(group:Group,parts:BufferGeometry[],vertexColors:boolean,color?:string)=>{
          const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose())
          if(!merged)return
          const mesh=new Mesh(merged,new MeshStandardMaterial(vertexColors?{vertexColors:true,roughness:.85,flatShading:true}:{color,roughness:.85,flatShading:true}))
          mesh.castShadow=mesh.receiveShadow=true;group.add(mesh)
        }

        // Live groups, driven every frame by animateStageModel — not baked into the static buckets.
        const armGroup=new Group();armGroup.position.copy(pivot);armGroup.quaternion.copy(armRestQuat)
        armGroup.userData.armRestQuat=armRestQuat
        root.add(armGroup)
        const armStart=.08,armSide=.24,armReach=.3
        const armBox=(x:number,y:number,z:number,w:number,h:number,depth:number)=>{const g=new BoxGeometry(w,h,depth);g.translate(x,y,z);return g}
        merge(armGroup,[
          ...[-1,1].flatMap(side=>[
            armBox(side*armSide,0,armStart+armReach*.5,.1,.14,armReach), // arm post, rooted on the base's outward face
            armBox(side*armSide,0,armStart+armReach,.16,.16,.08), // pivot boss cradling the head
          ]),
          armBox(0,0,armStart+.04,armSide*2+.14,.07,.08), // crossbar joining both arms, flush against the base
        ],false,'#5b6873')

        // The pivot sits roughly at the head's own midpoint (not its rear), so the arms reach
        // further forward toward the lens instead of cradling only the back of the head.
        const headPivotZ=armStart+armReach,headShift=.12
        const headGroup=new Group();headGroup.position.set(0,0,headPivotZ);headGroup.quaternion.copy(headRestQuat)
        armGroup.add(headGroup)
        const headBox=(x:number,y:number,z:number,w:number,h:number,depth:number,color:string)=>tint(new BoxGeometry(w,h,depth).translate(x,y,z-headShift),color)
        const headDisc=(z:number,radius:number,height:number,color:string)=>tint(new CylinderGeometry(radius,radius,height,12).rotateX(Math.PI/2).translate(0,0,z-headShift),color)
        merge(headGroup,[
          headBox(0,0,.16,.3,.3,.44,'#1a2129'), // elongated barrel, cradled between the arms
          headBox(0,0,-.08,.26,.24,.12,'#1a2129'), // rounded rear counterweight
          ...[.02,.14,.26].map(lz=>headBox(0,.14,lz,.26,.03,.05,'#11161c')), // top cooling ridges
          headBox(0,-.13,.36,.2,.02,.02,'#eef3f2'), // LED accent strip
          headBox(0,0,.4,.26,.26,.06,'#0d1117'), // front bezel
          headDisc(.43,.12,.02,'#0d1117'), // dark lens rim
          headDisc(.445,.095,.014,c), // bright lens
        ],true)

        if(options.effects!==false){
          // The beam is a child of the head, built pointing along local +Z (the lens's own
          // forward axis) so it stays perfectly aimed as the head pans and tilts. It lives in its
          // own group: that is what switches off between shows, leaving the head itself on the
          // truss where it belongs (see animateStageModel).
          const beams=new Group();headGroup.add(beams)
          const beamGeo=new ConeGeometry(.85,4,16,1,true);beamGeo.rotateZ(Math.PI);beamGeo.translate(0,2,0);beamGeo.rotateX(Math.PI/2)
          const beamMat=new MeshBasicMaterial({color:c,transparent:true,opacity:.07,depthWrite:false,side:DoubleSide,blending:AdditiveBlending})
          const beam=new Mesh(beamGeo,beamMat);beam.position.set(0,0,.46-headShift);beams.add(beam)
          const glowMat=new MeshBasicMaterial({color:c,transparent:true,opacity:.85,depthWrite:false,blending:AdditiveBlending})
          const glow=new Mesh(new SphereGeometry(.07,8,6),glowMat);glow.position.copy(beam.position);beams.add(glow)
          let light:SpotLight|undefined
          if(lights<(options.lightBudget??0)){
            light=new SpotLight(c,0,40,Math.atan(.85/4),.45,1);light.castShadow=false;root.add(light,light.target);lights++
          }
          headGroup.userData={kind:'spot',id:p.id,index:effects.length,base:headGroup.position.clone(),armGroup,headRestQuat,beams,beamMat,glowMat,light,length:4}
          effects.push(headGroup)
        }
      }else if(p.kind==='laser'){
        // Built facing local +Z, then rotated as a rigid body onto the cube gizmo's chosen
        // world direction — independent of which side of the truss it is docked against.
        const facing=partFacing(p),facingVec=new Vector3(facing.x,facing.y,facing.z)
        const facingQuat=new Quaternion().setFromUnitVectors(unitZ,facingVec)
        const pivot=new Vector3(ex,ey+.16,ez)
        const put=(lx:number,ly:number,lz:number,w:number,h:number,depth:number,color:string,localQuat?:Quaternion)=>{
          const g=new BoxGeometry(w,h,depth)
          if(localQuat)g.applyQuaternion(localQuat)
          g.applyQuaternion(facingQuat)
          const wp=new Vector3(lx,ly,lz).applyQuaternion(facingQuat).add(pivot)
          g.translate(wp.x,wp.y,wp.z)
          const list=buckets.get(color)??[];list.push(g);buckets.set(color,list)
        }
        const putLens=(lz:number,radius:number,height:number,color:string)=>{
          const g=new CylinderGeometry(radius,radius,height,10)
          g.applyQuaternion(CYL_TO_FORWARD);g.applyQuaternion(facingQuat)
          const wp=new Vector3(0,0,lz).applyQuaternion(facingQuat).add(pivot)
          g.translate(wp.x,wp.y,wp.z)
          const list=buckets.get(color)??[];list.push(g);buckets.set(color,list)
        }
        const housing='#161d26',trim='#232d38',bezel='#0d1117',clampColor='#3a4551'
        put(0,-.03,-.1,.24,.19,.16,clampColor) // mounting foot/clamp, toward the back
        put(0,0,.02,.36,.26,.32,housing) // main housing
        for(const fx of [-.1,0,.1])put(fx,.145,.02,.045,.03,.24,bezel) // heat-sink fins on top
        for(const side of [-1,1])put(side*.18,0,.02,.02,.17,.28,trim) // side trim panels
        put(0,0,.18,.3,.2,.04,bezel) // recessed front bezel
        putLens(.205,.095,.02,bezel) // dark lens rim
        putLens(.216,.075,.014,c) // bright round lens
        put(.1,.085,.06,.028,.028,.028,'#8ef29b') // status LED
        put(0,-.08,-.18,.05,.05,.045,bezel) // DMX/cable stub
        const lens=new Vector3(0,0,.22).applyQuaternion(facingQuat).add(pivot)
        effect('laser',lens.x,lens.y,lens.z,c,facing)
      }else if(p.kind==='fireworks'){
        // A mortar rack on a road case: three tubes of staggered height sitting in a steel cradle,
        // with the firing controller on the front. It only ever points at the sky (see
        // UP_ROTATION in stagePlacement), so unlike the other fixtures it needs no facing maths.
        const shell='#2b3038',trim='#454b55',bezel='#14171c',steel='#6d7580',warn='#d8a33a'
        const tube=(lx:number,ly:number,radius:number,height:number,color:string)=>{
          const g=new CylinderGeometry(radius,radius,height,10);g.translate(ex+lx,ey+ly,ez)
          const list=buckets.get(color)??[];list.push(g);buckets.set(color,list)
        }
        box(ex,ey+.09,ez,.86,.18,.68,shell) // road-case chassis
        box(ex,ey+.2,ez,.9,.05,.72,trim) // deck plate, overhanging the case as a lip
        for(const fx of [-.37,.37])for(const fz of [-.28,.28])box(ex+fx,ey+.03,ez+fz,.1,.06,.1,bezel) // castors
        for(const fx of [-.34,.34])box(ex+fx,ey+.33,ez,.05,.22,.46,steel) // cradle uprights
        for(const fz of [-.19,.19])box(ex,ey+.4,ez+fz,.74,.045,.045,steel) // cradle rails holding the tubes
        MORTAR_TUBES.forEach(({x:lx,height})=>{
          tube(lx,.23+height/2,.1,height,bezel) // mortar tube
          tube(lx,.23+height,.115,.04,trim) // reinforced muzzle ring
          tube(lx,.23+height-.015,.072,.02,c) // charge glowing in the muzzle, tinted by the chosen colour
        })
        box(ex+.28,ey+.31,ez+.3,.24,.17,.09,bezel) // firing controller
        box(ex+.28,ey+.33,ez+.348,.14,.075,.012,'#6aa6b3') // its display
        box(ex+.21,ey+.26,ez+.348,.03,.03,.012,'#8ef29b') // armed lamp
        box(ex+.35,ey+.26,ez+.348,.03,.03,.012,'#d8564f') // fire lamp
        box(ex-.17,ey+.2,ez+.35,.44,.055,.025,warn) // hazard stripe along the front lip
        box(ex-.3,ey+.11,ez-.35,.07,.06,.06,bezel) // firing-cable stub at the back
        effect(p.kind,ex,ey+.23,ez,c,{x:0,y:1,z:0})
      }else if(p.kind==='sparks'){
        // A cold-spark fountain: rigid body built facing local +Z, rotated onto the gizmo's
        // chosen world direction. Stands on the ground or docks onto a truss like a laser or
        // moving head — hung ones fire their plume wherever the gizmo aims them, downwards
        // included.
        const facing=partFacing(p),facingVec=new Vector3(facing.x,facing.y,facing.z)
        const facingQuat=new Quaternion().setFromUnitVectors(unitZ,facingVec)
        const pivot=new Vector3(ex,ey+.15,ez)
        const put=(lx:number,ly:number,lz:number,w:number,h:number,depth:number,color:string)=>{
          const g=new BoxGeometry(w,h,depth);g.applyQuaternion(facingQuat)
          const wp=new Vector3(lx,ly,lz).applyQuaternion(facingQuat).add(pivot)
          g.translate(wp.x,wp.y,wp.z)
          const list=buckets.get(color)??[];list.push(g);buckets.set(color,list)
        }
        const putFunnel=(lz:number,topRadius:number,bottomRadius:number,height:number,color:string)=>{
          const g=new CylinderGeometry(topRadius,bottomRadius,height,10)
          g.applyQuaternion(CYL_TO_FORWARD);g.applyQuaternion(facingQuat)
          const wp=new Vector3(0,0,lz).applyQuaternion(facingQuat).add(pivot)
          g.translate(wp.x,wp.y,wp.z)
          const list=buckets.get(color)??[];list.push(g);buckets.set(color,list)
        }
        const housing='#3a3d42',trim='#55595f',bezel='#1c1e21'
        put(0,0,-.02,.3,.28,.26,housing) // hopper body
        putFunnel(.2,.14,.08,.2,trim) // funnel neck flaring toward the mouth
        putFunnel(.32,.02,.14,.03,bezel) // funnel rim
        putFunnel(.345,.055,.055,.014,c) // charge glowing right at the mouth, tinted by the chosen colour
        put(.14,.02,-.1,.09,.09,.04,bezel) // control box
        put(.14,.02,-.08,.03,.03,.02,c) // indicator LED, tinted by the chosen colour
        put(0,-.09,-.16,.06,.05,.05,bezel) // cable stub
        for(const fx of [-.13,.13])for(const fz of [-.1,.1])put(fx,-.15,fz,.05,.03,.05,bezel) // feet
        const mouth=new Vector3(0,0,.34).applyQuaternion(facingQuat).add(pivot)
        effect('sparks',mouth.x,mouth.y,mouth.z,c,facing)
      }else if(p.kind==='fog'){
        // A hazer: rigid body built facing local +Z, rotated onto the gizmo's chosen world
        // direction. Stands on the ground or docks onto a truss like a laser or moving head.
        const facing=partFacing(p),facingVec=new Vector3(facing.x,facing.y,facing.z)
        const facingQuat=new Quaternion().setFromUnitVectors(unitZ,facingVec)
        const pivot=new Vector3(ex,ey+.14,ez)
        const put=(lx:number,ly:number,lz:number,w:number,h:number,depth:number,color:string)=>{
          const g=new BoxGeometry(w,h,depth);g.applyQuaternion(facingQuat)
          const wp=new Vector3(lx,ly,lz).applyQuaternion(facingQuat).add(pivot)
          g.translate(wp.x,wp.y,wp.z)
          const list=buckets.get(color)??[];list.push(g);buckets.set(color,list)
        }
        const putTopDisc=(ly:number,radius:number,height:number,color:string)=>{
          const g=new CylinderGeometry(radius,radius,height,10);g.applyQuaternion(facingQuat)
          const wp=new Vector3(0,ly,0).applyQuaternion(facingQuat).add(pivot)
          g.translate(wp.x,wp.y,wp.z)
          const list=buckets.get(color)??[];list.push(g);buckets.set(color,list)
        }
        const putSpout=(lz:number,radius:number,height:number,color:string)=>{
          const g=new CylinderGeometry(radius,radius,height,10)
          g.applyQuaternion(CYL_TO_FORWARD);g.applyQuaternion(facingQuat)
          const wp=new Vector3(0,0,lz).applyQuaternion(facingQuat).add(pivot)
          g.translate(wp.x,wp.y,wp.z)
          const list=buckets.get(color)??[];list.push(g);buckets.set(color,list)
        }
        const housing='#5b6470',vent='#40474f',bezel='#23272c',foot='#2b2f33'
        put(0,0,0,.4,.26,.3,housing) // main housing
        for(const fx of [-.11,0,.11])put(fx,.14,-.03,.05,.03,.18,vent) // heating-element vent ridges
        putTopDisc(.14,.06,.03,bezel) // fluid tank cap
        put(0,-.03,.16,.18,.16,.06,bezel) // nozzle collar
        putSpout(.26,.075,.14,c) // spout, tinted by the chosen colour
        put(.13,.08,.14,.022,.022,.022,'#ff8a5c') // heat-ready LED
        put(-.13,.08,.14,.022,.022,.022,'#79e07a') // power LED
        put(0,-.1,-.16,.06,.05,.05,bezel) // cable stub
        for(const fx of [-.16,.16])for(const fz of [-.12,.12])put(fx,-.14,fz,.05,.03,.05,foot) // feet
        const nozzle=new Vector3(0,-.03,.33).applyQuaternion(facingQuat).add(pivot)
        effect('fog',nozzle.x,nozzle.y,nozzle.z,'#c9d6dd',facing)
      }else if(p.kind==='screen'){
        // A borderless LED wall module: a plain 1x1 slab — one cell wide, one cell tall, thin in
        // depth — carrying nothing but LEDs on a backing plate. No bezel, no corner clips,
        // nothing that would interrupt the wall where two modules meet. Its pixels sit on a
        // lattice of exactly a third of a cell, so the gap left between two neighbouring modules'
        // edge pixels is the very same gap as between two pixels inside one module: the whole
        // wall is one uniform lattice, no matter which module was the one on the truss and which
        // were grown outwards from it.
        const pixelsPerSide=3,pitch=1/pixelsPerSide,pixel=pitch*.85,mid=(pixelsPerSide-1)/2
        box(ex,ey+.5,ez,1,1,SCREEN_DEPTH,'#12161c') // backing plate, spanning the full 1x1
        if(host&&isTruss(host.kind)){
          // The module itself stops on the edge of the truss's own cell (see resolveEquipmentBase),
          // so a short arm spans what is left. It starts at the truss's centre — crossing its
          // sparse 3-chord lattice rather than merely touching its outer radius, which reads as
          // floating — and ends on the module's near surface: its thin back when it is mounted
          // flat onto the truss, its own edge when it hangs below/above or beside it.
          const depthAxis=p.rotation%2?'x':'z'
          const armLen=(dir.x?'x':dir.y?'y':'z')===depthAxis?.5-SCREEN_DEPTH/2:.5
          const hc={x:host.x-d.width/2+.5,y:host.y+.5,z:host.z-d.depth/2+.5}
          const g=new BoxGeometry(dir.x?armLen:.09,dir.y?armLen:.09,dir.z?armLen:.09)
          g.translate(hc.x+dir.x*armLen/2,hc.y+dir.y*armLen/2,hc.z+dir.z*armLen/2)
          const list=buckets.get('#2a3038')??[];list.push(g);buckets.set('#2a3038',list)
        }
        // The pixel face is its own live, vertex-coloured mesh (one draw call for every LED) so a
        // diagonal glow wave can sweep across it every frame. Every pixel's wave phase comes from
        // its position in the *whole* connected wall (see computeScreenGroups) rather than just
        // this module's own 3x3, so the wave reads as one continuous ripple across however many
        // modules are joined together instead of restarting inside each one.
        const screenGroup=screenGroups.get(p.id)
        const tintPixel=(geometry:BufferGeometry,color:string)=>{
          const col=new Color(color),arr=new Float32Array(geometry.getAttribute('position').count*3)
          for(let i=0;i<arr.length;i+=3)col.toArray(arr,i)
          geometry.setAttribute('color',new Float32BufferAttribute(arr,3));geometry.deleteAttribute('uv')
          return geometry
        }
        const pixelGeoms:BufferGeometry[]=[],pixelCoords:{row:number;col:number}[]=[]
        for(let a=0;a<pixelsPerSide;a++)for(let b=0;b<pixelsPerSide;b++){
          const r=rotateAround(ex+(a-mid)*pitch,ez+SCREEN_DEPTH/2+.015)
          let w=pixel,depth=.03
          if(origin&&origin.rotation%2)[w,depth]=[depth,w]
          const g=new BoxGeometry(w,pixel,depth);g.translate(r.x,ey+.5+(b-mid)*pitch,r.z)
          pixelGeoms.push(tintPixel(g,(a+b)%3?c:'#f3dfb0'))
          pixelCoords.push({row:(screenGroup?.row??0)*pixelsPerSide+b,col:(screenGroup?.col??0)*pixelsPerSide+a})
        }
        const mergedPixels=mergeGeometries(pixelGeoms);pixelGeoms.forEach(g=>g.dispose())
        if(mergedPixels){
          const mesh=new Mesh(mergedPixels,new MeshStandardMaterial({vertexColors:true,roughness:.8,flatShading:true}))
          mesh.castShadow=mesh.receiveShadow=true
          const rig=new Group();rig.add(mesh);root.add(rig)
          if(options.effects!==false){
            rig.userData={kind:'screen',id:p.id,index:effects.length,base:new Vector3(0,0,0),baseColor:new Color(c),glowColor:new Color('#fff6dd'),pixelCoords}
            effects.push(rig)
          }
        }
      }else if(p.kind==='star'){
        box(ex,ey+.4,ez,.75,.22,.18,c);box(ex,ey+.4,ez,.22,.8,.18,c);box(ex,ey+.4,ez,.44,.44,.2,'#ffdd87')
      }else if(p.kind==='palm'){
        box(ex,ey+.6,ez,.15,1.2,.15,'#9c7353');box(ex,ey+1.2,ez,1,.15,.3,c);box(ex,ey+1.3,ez,.3,.15,1,c)
      }else if(p.kind==='deck'){
        // A real stage riser: an anti-slip top set into an aluminium frame, standing on four
        // telescopic legs with adjustable feet and cross-braced underneath, with coupling plates
        // at the corners where it bolts to its neighbours. The frame stops short of the cell edge,
        // so a built-up stage shows the seams between its decks the way a real one does. Its top
        // surface stays at the height performers are placed at (see stageBand).
        const alu='#8d949c',tube='#5d646d',surface='#1b1f25',foot='#2a2f36'
        for(const fx of [-.36,.36])for(const fz of [-.36,.36]){
          box(ex+fx,ey+.115,ez+fz,.07,.17,.07,tube) // telescopic leg
          box(ex+fx,ey+.015,ez+fz,.12,.03,.12,foot) // adjustable foot under it
        }
        box(ex,ey+.155,ez,.78,.035,.05,tube);box(ex,ey+.155,ez,.05,.035,.78,tube) // cross bracing between the legs
        for(const fz of [-.435,.435])box(ex,ey+.215,ez+fz,.92,.05,.05,alu) // frame rail, front and back
        for(const fx of [-.435,.435])box(ex+fx,ey+.215,ez,.05,.05,.92,alu) // frame rail, left and right
        for(const fz of [-.458,.458])box(ex,ey+.2,ez+fz,.92,.018,.014,c) // safety edging, in the chosen colour
        for(const fx of [-.458,.458])box(ex+fx,ey+.2,ez,.014,.018,.92,c)
        box(ex,ey+.2175,ez,.86,.045,.86,surface) // anti-slip deck surface, set into the frame
        for(const fx of [-.435,.435])for(const fz of [-.435,.435])box(ex+fx,ey+.247,ez+fz,.1,.014,.1,'#c8ced6') // coupling plates, sat on the frame corners where risers bolt together
      }else box(ex,ey+.12,ez,.92,.24,.92,c)
    }
  }
  const floorMeshes:Mesh[]=[]
  for(const [color,geometries] of buckets){const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());if(merged){const mesh=new Mesh(merged,new MeshStandardMaterial({color,roughness:.85,flatShading:true}));mesh.receiveShadow=true;root.add(mesh);if(FLOOR_COLORS.has(color))floorMeshes.push(mesh)}}
  root.userData.effects=effects
  root.userData.floorMeshes=floorMeshes
  return root
}
const up=new Vector3(0,1,0)
/** Scratch values reused every frame by the spark fountains, which would otherwise allocate per fixture per frame. */
const sparkPull=new Vector3(),sparkFrame=new Quaternion()
/** Deterministic 0..1 noise over a pair of whole numbers — picks which of a firework's firing slots actually launch, the same way on every frame and in every client. */
const pyroNoise=(a:number,b:number)=>{const v=Math.sin(a*127.1+b*311.7)*43758.5453;return v-Math.floor(v)}
export function animateStageModel(root:Group,phase:ShowPhase,time:number,active:boolean){
  const offset=active?stageMotion(phase,time):0
  for(const part of root.userData.moving??[])part.position.y=part.userData.restY-offset
  for(const rig of (root.userData.effects??[]) as Group[]){
    const pyro=rig.userData.kind==='fireworks',sparks=rig.userData.kind==='sparks'
    rig.position.copy(rig.userData.base);if(rig.userData.moving)rig.position.y-=offset
    const fog=rig.userData.kind==='fog',t=time*(.2+phase.speed/45)+rig.userData.index
    rig.userData.intensity=phase.intensity
    // A moving head's rig carries the head itself, not only its beam — hiding it with the show
    // would leave a headless yoke hanging on the truss. The fixture therefore stays put whatever
    // the show is doing and only darkens (see the 'spot' branch below); every other rig *is* its
    // effect and disappears with it.
    const lit=active&&(pyro||sparks?(phase.pyro??0)>0:fog?phase.fog>0:phase.intensity>0)
    rig.userData.lit=lit
    rig.visible=rig.userData.kind==='spot'||lit
    if(pyro){
      const strength=(phase.pyro??0)/100,shots=rig.children[0] as LineSegments
      const mat=shots.material as LineBasicMaterial;mat.color.set(phase.color)
      const position=shots.geometry.getAttribute('position') as Float32BufferAttribute
      const shade=shots.geometry.getAttribute('color') as Float32BufferAttribute
      const rockets=rig.userData.rockets as {x:number;y:number;apex:number;driftX:number;driftZ:number;radius:number;period:number;offset:number}[]
      const embers=rig.userData.embers as {x:number;y:number;z:number}[]
      const dark=(vertex:number,x:number,y:number,z:number)=>{position.setXYZ(vertex,x,y,z);shade.setXYZ(vertex,0,0,0)}
      for(let n=0;n<rockets.length;n++){
        const shot=rockets[n]!,slot=n*(1+embers.length)*2
        const age=((time/shot.period+shot.offset)%1+1)%1*shot.period
        // The fader sets how *often* a rack fires, not how visible its rockets are: each tube has
        // a slot every period, and the fader decides what share of those slots actually launch.
        // Skipping whole slots rather than stretching the period keeps every rocket already in
        // the air on its own trajectory while the fader is being dragged.
        if(pyroNoise(n,Math.floor(time/shot.period+shot.offset))>=strength){
          for(let vertex=slot;vertex<slot+(1+embers.length)*2;vertex++)dark(vertex,shot.x,shot.y,0)
          continue
        }
        if(age<FIREWORK_RISE){
          // Climbing: the rocket decelerates on the way up, so its trail shortens as it nears the
          // top — the pause before the burst reads as the fuse running out.
          const climb=age/FIREWORK_RISE,rise=shot.apex*(1-(1-climb)**2),trail=.15+.75*(1-climb)
          const x=shot.x+shot.driftX*climb,z=shot.driftZ*climb,y=shot.y+rise
          position.setXYZ(slot,x,Math.max(shot.y,y-trail),z);shade.setXYZ(slot,.25,.25,.25)
          position.setXYZ(slot+1,x,y,z);shade.setXYZ(slot+1,1,1,1)
          for(let k=0;k<embers.length;k++){const vertex=slot+2+k*2;dark(vertex,x,y,z);dark(vertex+1,x,y,z)}
        }else{
          const burn=(age-FIREWORK_RISE)/FIREWORK_BURST,fuse=age-FIREWORK_RISE
          const spread=shot.radius*(1-(1-burn)**3),sag=FIREWORK_SAG*.5*fuse*fuse
          // A hard flash the instant it goes off, then the embers hold their glow most of the way
          // down and only die back at the end, rather than dimming from the moment they part.
          const glow=burn<.08?1:Math.min(1,2.1*(1-burn))
          const cx=shot.x+shot.driftX,cy=shot.y+shot.apex-sag,cz=shot.driftZ,tail=.12+.45*(1-burn)
          dark(slot,cx,cy,cz);dark(slot+1,cx,cy,cz)
          for(let k=0;k<embers.length;k++){
            const ember=embers[k]!,vertex=slot+2+k*2
            const x=cx+ember.x*spread,y=cy+ember.y*spread,z=cz+ember.z*spread
            position.setXYZ(vertex,x-ember.x*tail,y-ember.y*tail,z-ember.z*tail);shade.setXYZ(vertex,glow*.25,glow*.25,glow*.25)
            position.setXYZ(vertex+1,x,y,z);shade.setXYZ(vertex+1,glow,glow,glow)
          }
        }
      }
      position.needsUpdate=true;shade.needsUpdate=true
    }else if(sparks){
      const base=(rig.userData.dir as {x:number;y:number;z:number}|undefined)??{x:0,y:1,z:0}
      rig.quaternion.setFromUnitVectors(up,new Vector3(base.x,base.y,base.z))
      const strength=(phase.pyro??0)/100,streaks=rig.children[0] as LineSegments
      const mat=streaks.material as LineBasicMaterial;mat.color.set(phase.color)
      // Sparks fly in the rig's own frame, but they fall towards the *world's* floor — so a
      // fountain angled sideways throws a real arc instead of sucking its sparks back down its
      // own barrel. Rotating world-down into the rig is all that takes.
      const pull=sparkPull.set(0,-(rig.userData.gravity as number),0).applyQuaternion(sparkFrame.copy(rig.quaternion).invert())
      const flights=rig.userData.sparks as {x:number;y:number;z:number;speed:number;life:number;offset:number}[]
      const position=streaks.geometry.getAttribute('position') as Float32BufferAttribute
      const shade=streaks.geometry.getAttribute('color') as Float32BufferAttribute
      // The fader sets how hard the fountain runs, never how brightly it burns: at lower settings
      // fewer sparks leave the nozzle and they are thrown less far, while every one that does fly
      // is as bright as at full. The count is cut off the end of the list, whose launch angles run
      // around the cone in golden-angle steps, so any share of them still fans out evenly instead
      // of favouring one side. Throw scales with the square root because a spark's apex goes with
      // the square of its launch speed — this way the plume's height follows the fader directly.
      // Its lifetime is stretched to match, so a spark still burns out around its own apex rather
      // than hanging around to fall back down the barrel.
      const flying=Math.round(flights.length*strength),throwScale=Math.sqrt(strength)
      for(let n=0;n<flights.length;n++){
        const spark=flights[n]!
        if(n>=flying){position.setXYZ(n*2,0,0,0);position.setXYZ(n*2+1,0,0,0);shade.setXYZ(n*2,0,0,0);shade.setXYZ(n*2+1,0,0,0);continue}
        const life=spark.life*throwScale,speed=spark.speed*throwScale
        const age=((time/life+spark.offset)%1+1)%1*life,trail=Math.max(0,age-SPARK_TRAIL*throwScale)
        for(const [vertex,at] of [[n*2,trail],[n*2+1,age]] as const){
          position.setXYZ(vertex,spark.x*speed*at+pull.x*.5*at*at,spark.y*speed*at+pull.y*.5*at*at,spark.z*speed*at+pull.z*.5*at*at)
        }
        // A spark burns at full brightness for most of its flight and only dies back over the
        // last stretch, rather than dimming from the moment it leaves the nozzle — that is what
        // keeps the plume lit all the way up instead of fading out halfway. A fast twinkle rides
        // on top, and the trail end is always the dimmer one, which makes a streak read as a
        // direction rather than a floating dash.
        const burn=Math.min(1,2.4*(1-age/life))*(.7+.3*Math.sin(time*29+n)**2)
        shade.setXYZ(n*2,burn*.3,burn*.3,burn*.3);shade.setXYZ(n*2+1,burn,burn,burn)
      }
      position.needsUpdate=true;shade.needsUpdate=true
    }else if(fog){
      const base=(rig.userData.dir as {x:number;y:number;z:number}|undefined)??{x:0,y:1,z:0}
      rig.quaternion.setFromUnitVectors(up,new Vector3(base.x,base.y,base.z))
      rig.children.forEach((child,n)=>{
        const mesh=child as Mesh,mat=mesh.material as MeshBasicMaterial
        mat.opacity=phase.fog/100*(.05+Math.sin(t*.25+n)*.014)
        mesh.position.y=mesh.userData.travel+Math.sin(t*.3+n)*.15
        mesh.position.x=Math.sin(t*.22+n*1.3)*.5;mesh.position.z=Math.cos(t*.19+n*1.1)*.5
      })
    }else if(rig.userData.kind==='spot'){
      // Pan spins the yoke further around its own mount-perpendicular axis (its local Z, since
      // the base sits flush against the truss and the arms always rise away from it); tilt
      // nods the head (nested inside the yoke) further around the arm's local X. Both simply
      // continue from the rest pose the aim was already resolved into (see 'spot' above). The
      // beam is a child of the head, so it always fires straight out of the lens as both animate.
      const armGroup=rig.userData.armGroup as Group,sweep=(phase.movement??0)/100
      const armRest=armGroup.userData.armRestQuat as Quaternion
      const panWobble=new Quaternion().setFromAxisAngle(unitZ,sweep*.5*Math.sin(t*.9))
      armGroup.quaternion.multiplyQuaternions(armRest,panWobble)
      const tiltWobble=new Quaternion().setFromAxisAngle(unitX,sweep*.3*Math.sin(t*1.15+1.3))
      rig.quaternion.multiplyQuaternions(tiltWobble,rig.userData.headRestQuat as Quaternion)
      rig.updateWorldMatrix(true,false)
      const beams=rig.userData.beams as Group|undefined;if(beams)beams.visible=lit // the beam goes out with the show, the head stays on the truss
      const beamMat=rig.userData.beamMat as MeshBasicMaterial,glowMat=rig.userData.glowMat as MeshBasicMaterial
      beamMat.color.set(phase.color);beamMat.opacity=phase.intensity/100*.07
      glowMat.color.set(phase.color);glowMat.opacity=phase.intensity/100*.85
    }else if(rig.userData.kind==='screen'){
      // A diagonal wave: pixels sharing the same row+col sit on the same anti-diagonal, so
      // stepping that sum's phase forward over time sweeps a bright band across the whole
      // matrix from corner to corner. Using plain `time` (not `t`, which folds in this rig's own
      // index) keeps every panel in a connected wall on the exact same clock, so their shared
      // pixelCoords line up into one continuous ripple instead of each panel waving on its own.
      const wave=time*(.6+phase.speed/60)
      const base=rig.userData.baseColor as Color,glow=rig.userData.glowColor as Color,strength=phase.intensity/100
      const mesh=rig.children[0] as Mesh,colorAttr=mesh.geometry.getAttribute('color') as Float32BufferAttribute
      const coords=rig.userData.pixelCoords as {row:number;col:number}[],tmp=new Color()
      for(let i=0;i<coords.length;i++){
        const glowAmt=Math.max(0,Math.sin((coords[i]!.row+coords[i]!.col)*.35-wave))**2*strength
        tmp.copy(base).lerp(glow,glowAmt)
        for(let v=i*24;v<i*24+24;v++)colorAttr.setXYZ(v,tmp.r,tmp.g,tmp.b)
      }
      colorAttr.needsUpdate=true
    }else{
      const base=(rig.userData.dir as {x:number;y:number;z:number}|undefined)??{x:0,y:1,z:0}
      const direction=new Vector3(base.x+Math.sin(t)*.15,base.y+Math.cos(t*.83)*.15,base.z+Math.cos(t*.7)*.15).normalize()
      rig.quaternion.setFromUnitVectors(up,direction)
      for(const child of rig.children){const mat=(child as Mesh).material as MeshBasicMaterial;mat.color.set(phase.color);mat.opacity=phase.intensity/100*.8}
    }
    const light=rig.userData.light as SpotLight|undefined
    if(light){
      if(rig.userData.kind==='spot'){
        const worldPos=new Vector3();rig.getWorldPosition(worldPos)
        light.position.copy(worldPos);light.target.position.copy(rig.localToWorld(new Vector3(0,0,rig.userData.length)));light.color.set(phase.color);light.intensity=lit?phase.intensity*1.8:0
      }else{
        light.position.copy(rig.position);light.target.position.copy(new Vector3(0,rig.userData.length,0).applyQuaternion(rig.quaternion).add(rig.position));light.color.set(phase.color);light.intensity=lit?phase.intensity*1.8:0
      }
    }
  }
}
/** A shared pool illuminates the whole map; beam meshes remain visible for every fixture. */
export function updateStageLightPool(models:Group[],pool:SpotLight[]){
  const candidates:Group[]=[]
  for(const root of models)for(const rig of (root.userData.effects??[]) as Group[]){if(rig.userData.lit&&rig.userData.kind==='spot')candidates.push(rig)}
  pool.forEach((light,index)=>{
    const rig=candidates[Math.floor(index*candidates.length/pool.length)];if(!rig){light.intensity=0;return}
    const material=rig.userData.beamMat as MeshBasicMaterial
    rig.getWorldPosition(light.position);light.target.position.copy(rig.localToWorld(new Vector3(0,0,rig.userData.length)));light.color.copy(material.color);light.intensity=45*rig.userData.intensity/100;light.distance=12
  })
}
export function disposeStageModel(root:Group){root.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments){o.geometry.dispose();const m=Array.isArray(o.material)?o.material:[o.material];m.forEach(a=>a.dispose())}if(o instanceof SpotLight)o.dispose()})}
