import { Group, Mesh, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, BufferGeometry, Float32BufferAttribute, LineSegments, LineBasicMaterial, SpotLight, Vector3, Quaternion, Color, DoubleSide, MeshStandardMaterial, MeshBasicMaterial, AdditiveBlending } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { isTruss, stageMotion, mountDirection, partFacing, type StageDesign, type ShowPhase } from '../game/stageDesign'

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
const EQUIPMENT_REACH:Partial<Record<string,number>> = {speaker:.4,spot:.15,laser:.15,fireworks:.15,sparks:.15,fog:.15,screen:.6,banner:.6,star:.4}
export function createStageModel(d:StageDesign,options:{floor?:boolean;partIds?:Set<string>;effects?:boolean;lightBudget?:number}={}):Group {
  const root=new Group(), buckets=new Map<string,BufferGeometry[]>(), effects:Group[]=[]
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
    if(options.effects===false||effects.length>=32)return
    const rig=new Group();rig.position.set(x,y,z);rig.userData.kind=kind;rig.userData.index=effects.length;rig.userData.dir=dir;rig.userData.base=rig.position.clone();rig.userData.length=kind==='laser'?Math.max(4,d.depth*.8):4
    if(kind==='fireworks'||kind==='sparks'){
      const points:number[]=[]
      for(let n=0;n<40;n++){const angle=n*2.399963, height=(n+.5)/40, radius=Math.sqrt(1-height*height);points.push(radius*Math.cos(angle),height,radius*Math.sin(angle),radius*Math.cos(angle)*.87,height*.87,radius*Math.sin(angle)*.87)}
      const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(points,3));rig.add(new LineSegments(geometry,new LineBasicMaterial({color,transparent:true,blending:AdditiveBlending,depthWrite:false})))
    }else if(kind==='fog'){
      for(let n=0;n<3;n++){
        const cloud=new Mesh(new SphereGeometry(1,10,5),new MeshBasicMaterial({color:'#c9d6dd',transparent:true,opacity:.04,depthWrite:false}))
        cloud.scale.set(Math.max(2,d.width*.42),.28+n*.07,Math.max(2,d.depth*.42));cloud.position.set(-x*.6+(n-1)*.3,.15+n*.18,-z*.6+(n-1)*.3);rig.add(cloud)
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
      const reach=(EQUIPMENT_REACH[p.kind]??.3)+.13
      let ex=x,ey=y,ez=z
      if(host){
        const hc={x:host.x-d.width/2+.5,y:host.y+.5,z:host.z-d.depth/2+.5}
        if(dir.x)ex=hc.x+dir.x*reach
        if(dir.z)ez=hc.z+dir.z*reach
        if(dir.y)ey=hc.y+dir.y*reach-(EQUIPMENT_REACH[p.kind]??.3)
      }
      origin={x:ex,z:ez,rotation:p.rotation}
      if(p.kind==='speaker'){
        box(ex,ey+.4,ez,.65,.8,.5,'#171d28');for(const yy of [.2,.55]){box(ex,ey+yy,ez+.26,.43,.25,.04,'#414859');box(ex,ey+yy,ez+.29,.18,.12,.02,c)}
      }else if(p.kind==='spot'){
        // A real moving head: the base sits flush against the truss (dir), so its two yoke
        // arms always rise away from that same face — dir is therefore also the arms' pan
        // axis, not world-up. The head, cradled between them, tilts to aim the lens — parented
        // to it — exactly at the gizmo-chosen facing (see 'spot' in animateStageModel below).
        const dirVec=new Vector3(dir.x,dir.y,dir.z)
        const baseQuat=new Quaternion().setFromUnitVectors(unitZ,dirVec)
        const facing=partFacing(p),facingVec=new Vector3(facing.x,facing.y,facing.z)
        const headRestQuat=baseQuat.clone().invert().multiply(new Quaternion().setFromUnitVectors(unitZ,facingVec))
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
        const armGroup=new Group();armGroup.position.copy(pivot);armGroup.quaternion.copy(baseQuat)
        armGroup.userData.baseQuat=baseQuat
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

        if(options.effects!==false&&effects.length<32){
          // The beam is a child of the head, built pointing along local +Z (the lens's own
          // forward axis) so it stays perfectly aimed as the head pans and tilts.
          const beamGeo=new ConeGeometry(.85,4,16,1,true);beamGeo.rotateZ(Math.PI);beamGeo.translate(0,2,0);beamGeo.rotateX(Math.PI/2)
          const beamMat=new MeshBasicMaterial({color:c,transparent:true,opacity:.07,depthWrite:false,side:DoubleSide,blending:AdditiveBlending})
          const beam=new Mesh(beamGeo,beamMat);beam.position.set(0,0,.46-headShift);headGroup.add(beam)
          const glowMat=new MeshBasicMaterial({color:c,transparent:true,opacity:.85,depthWrite:false,blending:AdditiveBlending})
          const glow=new Mesh(new SphereGeometry(.07,8,6),glowMat);glow.position.copy(beam.position);headGroup.add(glow)
          let light:SpotLight|undefined
          if(lights<(options.lightBudget??0)){
            light=new SpotLight(c,0,40,Math.atan(.85/4),.45,1);light.castShadow=false;root.add(light,light.target);lights++
          }
          headGroup.userData={kind:'spot',id:p.id,index:effects.length,base:headGroup.position.clone(),armGroup,headRestQuat,beamMat,glowMat,light,length:4}
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
      }else if(p.kind==='fireworks'||p.kind==='sparks'){
        box(ex,ey+.15,ez,.65,.3,.65,'#303847');for(const dx of [-.18,.18])box(ex+dx,ey+.38,ez,.13,.25,.13,c);effect(p.kind,ex,ey+.5,ez,c,{x:0,y:1,z:0})
      }else if(p.kind==='fog'){
        box(ex,ey+.15,ez,.6,.3,.4,'#727789');box(ex,ey+.18,ez+.24,.2,.12,.1,c);effect('fog',ex,ey+.1,ez,'#b9cbd6',{x:0,y:1,z:0})
      }else if(p.kind==='screen'||p.kind==='banner'){
        box(ex,ey+.6,ez,.9,1.2,.1,'#141c29');for(let a=0;a<5;a++)for(let b=0;b<6;b++)box(ex+(a-2)*.16,ey+.15+b*.17,ez+.07,.14,.14,.03,(a+b)%3?c:'#f3dfb0')
      }else if(p.kind==='star'){
        box(ex,ey+.4,ez,.75,.22,.18,c);box(ex,ey+.4,ez,.22,.8,.18,c);box(ex,ey+.4,ez,.44,.44,.2,'#ffdd87')
      }else if(p.kind==='palm'){
        box(ex,ey+.6,ez,.15,1.2,.15,'#9c7353');box(ex,ey+1.2,ez,1,.15,.3,c);box(ex,ey+1.3,ez,.3,.15,1,c)
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
export function animateStageModel(root:Group,phase:ShowPhase,time:number,active:boolean){
  const offset=active?stageMotion(phase,time):0
  for(const part of root.userData.moving??[])part.position.y=part.userData.restY-offset
  for(const rig of (root.userData.effects??[]) as Group[]){
    const pyro=['fireworks','sparks'].includes(rig.userData.kind)
    rig.position.copy(rig.userData.base);if(rig.userData.moving)rig.position.y-=offset
    const fog=rig.userData.kind==='fog',t=time*(.2+phase.speed/45)+rig.userData.index
    rig.userData.intensity=phase.intensity
    rig.visible=active&&(pyro?(phase.pyro??0)>0:fog?phase.fog>0:phase.intensity>0)
    if(pyro){
      const strength=(phase.pyro??0)/100,burst=rig.userData.kind==='fireworks',cycle=((time*(.3+strength*.4)+rig.userData.index*.37)%1+1)%1
      rig.visible=rig.visible&&(!burst||cycle<.72)
      const rays=rig.children[0] as LineSegments,mat=rays.material as LineBasicMaterial
      const spread=burst?.2+cycle*3: .35+strength*.6
      rays.scale.set(spread,burst?spread:1+strength*2,spread);rays.rotation.y=time*.25;rig.position.y+=burst?2+cycle*2:0;mat.color.set(phase.color);mat.opacity=burst?(1-cycle)*strength:strength*(.7+.3*Math.sin(time*17)**2)
    }else if(fog){
      rig.children.forEach((child,n)=>{const mesh=child as Mesh,mat=mesh.material as MeshBasicMaterial;mat.opacity=phase.fog/100*(.065+Math.sin(t*.25+n)*.015);mesh.position.y=.12+n*.18+Math.sin(t*.3+n)*.08;mesh.rotation.y=Math.sin(t*.1+n)*.12})
    }else if(rig.userData.kind==='spot'){
      // Pan spins the arm around its own mount-perpendicular axis (baseQuat's local Z, since
      // the base sits flush against the truss and the arms always rise away from it); tilt
      // nods the head (nested inside the arm) around the arm's local X. The beam is a child
      // of the head, so it always fires straight out of the lens as both animate.
      const armGroup=rig.userData.armGroup as Group,sweep=(phase.movement??0)/100
      const baseQuat=armGroup.userData.baseQuat as Quaternion
      const panWobble=new Quaternion().setFromAxisAngle(unitZ,sweep*.5*Math.sin(t*.9))
      armGroup.quaternion.multiplyQuaternions(baseQuat,panWobble)
      const tiltWobble=new Quaternion().setFromAxisAngle(unitX,sweep*.3*Math.sin(t*1.15+1.3))
      rig.quaternion.multiplyQuaternions(tiltWobble,rig.userData.headRestQuat as Quaternion)
      rig.updateWorldMatrix(true,false)
      const beamMat=rig.userData.beamMat as MeshBasicMaterial,glowMat=rig.userData.glowMat as MeshBasicMaterial
      beamMat.color.set(phase.color);beamMat.opacity=phase.intensity/100*.07
      glowMat.color.set(phase.color);glowMat.opacity=phase.intensity/100*.85
    }else{
      const base=(rig.userData.dir as {x:number;y:number;z:number}|undefined)??{x:0,y:1,z:0}
      const direction=new Vector3(base.x+Math.sin(t)*.15,base.y+Math.cos(t*.83)*.15,base.z+Math.cos(t*.7)*.15).normalize()
      rig.quaternion.setFromUnitVectors(up,direction)
      for(const child of rig.children){const mat=(child as Mesh).material as MeshBasicMaterial;mat.color.set(phase.color);mat.opacity=phase.intensity/100*(rig.userData.kind==='laser'?.8:.035+phase.fog*.001)}
    }
    const light=rig.userData.light as SpotLight|undefined
    if(light){
      if(rig.userData.kind==='spot'){
        const worldPos=new Vector3();rig.getWorldPosition(worldPos)
        light.position.copy(worldPos);light.target.position.copy(rig.localToWorld(new Vector3(0,0,rig.userData.length)));light.color.set(phase.color);light.intensity=rig.visible?phase.intensity*1.8:0
      }else{
        light.position.copy(rig.position);light.target.position.copy(new Vector3(0,rig.userData.length,0).applyQuaternion(rig.quaternion).add(rig.position));light.color.set(phase.color);light.intensity=rig.visible?phase.intensity*1.8:0
      }
    }
  }
}
/** A shared pool illuminates the whole map; beam meshes remain visible for every fixture. */
export function updateStageLightPool(models:Group[],pool:SpotLight[]){
  const candidates:Group[]=[]
  for(const root of models)for(const rig of (root.userData.effects??[]) as Group[]){if(rig.visible&&rig.userData.kind==='spot')candidates.push(rig)}
  pool.forEach((light,index)=>{
    const rig=candidates[Math.floor(index*candidates.length/pool.length)];if(!rig){light.intensity=0;return}
    const material=rig.userData.beamMat as MeshBasicMaterial
    rig.getWorldPosition(light.position);light.target.position.copy(rig.localToWorld(new Vector3(0,0,rig.userData.length)));light.color.copy(material.color);light.intensity=45*rig.userData.intensity/100;light.distance=12
  })
}
export function disposeStageModel(root:Group){root.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments){o.geometry.dispose();const m=Array.isArray(o.material)?o.material:[o.material];m.forEach(a=>a.dispose())}if(o instanceof SpotLight)o.dispose()})}
