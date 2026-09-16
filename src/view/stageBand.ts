import { Group, Mesh, BoxGeometry, CylinderGeometry, MeshStandardMaterial, Color, Float32BufferAttribute, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { partOnAudience, type StageDesign } from '../game/stageDesign'
import { bandCostumeId, bandLook, bandRoles, isDjAct } from '../game/bandLooks'
import { createBandMemberModel } from './bandMemberMesh'
import { disposeObject3D } from './disposeObject3D'

export { bandRoles, bandCostumeId }

function hexAccent(bandId: string): string {
  return `#${bandLook(bandId).accent.toString(16).padStart(6, '0')}`
}
/** Stage-deck cells a performer may stand on, in grid coordinates: floored decks that are neither spectator ground nor already taken by equipment. Ordered from the front of the stage backwards. */
function freeDeckCells(d:StageDesign){
  const cells:Array<{x:number;z:number}>=[]
  for(let z=d.depth-1;z>=0;z--)for(let x=0;x<d.width;x++){
    if(partOnAudience(d,{x,z})||!d.parts.some(p=>p.kind==='deck'&&p.attachedTo===null&&p.y===0&&p.x===x&&p.z===z))continue
    if(d.parts.some(p=>p.attachedTo===null&&p.y===0&&p.kind!=='deck'&&p.x===x&&p.z===z))continue
    cells.push({x,z})
  }
  return cells
}
export function bandPositions(d?:StageDesign){
  if(!d)return [{x:0,z:.15},{x:-.29,z:.05},{x:.29,z:.05},{x:0,z:-.16}]
  const cells=freeDeckCells(d).map(c=>({x:c.x-d.width/2+.5,z:c.z-d.depth/2+.5}))
  // Prefer central, forward positions and spread the players across placed stage decks.
  cells.sort((a,b)=>(Math.abs(a.x)*.35-a.z)-(Math.abs(b.x)*.35-b.z))
  const chosen:typeof cells=[]
  for(const cell of cells){if(chosen.every(p=>Math.hypot(p.x-cell.x,p.z-cell.z)>=1.5))chosen.push(cell);if(chosen.length===4)break}
  if(chosen.length<4)for(const cell of cells){if(!chosen.includes(cell))chosen.push(cell);if(chosen.length===4)break}
  return chosen
}
/**
 * Where an electro act's booth goes: the console spans two neighbouring deck cells and the DJ
 * stands centred behind it, so it is placed on the most central, most forward pair that still has
 * deck left behind it to stand on. Falls back to a single cell when no pair is free, and to the
 * fixed little arrangement of bandPositions when the stage has no custom design at all.
 */
export function djPlacement(d?:StageDesign){
  // The DJ stands right up against the back of the console — far enough not to clip through it,
  // close enough to be working it rather than standing about behind it. Scales with the console.
  const behind=(width:number)=>(.48+.16)*(width/2)
  if(!d)return {desk:{x:0,z:.12},dj:{x:0,z:.12-behind(.55)},width:.55}
  const cells=freeDeckCells(d),free=(x:number,z:number)=>cells.some(c=>c.x===x&&c.z===z)
  const middle=d.width/2-1
  const pairs=cells.filter(c=>free(c.x+1,c.z))
  const score=(c:{x:number;z:number},span:number)=>(free(c.x,c.z-1)&&free(c.x+span-1,c.z-1)?0:1000)+Math.abs(c.x-middle)*2-c.z
  const best=pairs.length?pairs.reduce((a,b)=>score(b,2)<score(a,2)?b:a):cells.length?cells.reduce((a,b)=>score(b,1)<score(a,1)?b:a):undefined
  if(!best)return undefined
  const span=pairs.length?2:1
  const desk={x:best.x-d.width/2+span/2,z:best.z-d.depth/2+.5}
  return {desk,dj:{x:desk.x,z:desk.z-behind(span)},width:span}
}
function musician(role: Parameters<typeof createBandMemberModel>[1], index: number, bandId: string) {
  return createBandMemberModel(bandId, role, index)
}
/**
 * The console an electro act plays on, built two deck cells wide and one deep with the crowd at
 * +Z and the DJ at -Z: a cabinet under a wide top carrying a jog-wheel deck either side of a
 * mixer, plus a laptop. Everything the DJ operates is turned to face them — faders at their near
 * edge, knobs beyond, laptop across the far side with its screen looking back at them — while the
 * fascia and its lit strip stay where a front panel belongs, facing the crowd. Its buttons are a
 * second, vertex-coloured mesh so updateStageBand can blink them every frame without touching the
 * console's own geometry.
 */
function djDesk(accent:string){
  const root=new Group(),buckets=new Map<string,BufferGeometry[]>()
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const g=new BoxGeometry(w,h,d);g.translate(x,y,z);const list=buckets.get(color)??[];list.push(g);buckets.set(color,list)}
  const disc=(x:number,y:number,z:number,radius:number,height:number,color:string)=>{const g=new CylinderGeometry(radius,radius,height,12);g.translate(x,y,z);const list=buckets.get(color)??[];list.push(g);buckets.set(color,list)}
  const shell='#232a34',deck='#39434f',dark='#141920',metal='#8f9aa6',cap='#c8ced6'
  for(const side of [-1,1]){
    box(side*.82,.24,0,.28,.48,.8,shell) // side cabinet
    box(side*.82,.02,0,.34,.05,.86,dark) // foot plate
  }
  box(0,.15,-.3,1.42,.07,.09,metal) // rear cross brace tying the cabinets together
  box(0,.5,0,2,.08,.96,deck) // console top
  box(0,.28,.5,1.94,.4,.06,dark) // front fascia facing the crowd
  box(0,.28,.535,1.2,.07,.02,accent) // lit strip in the act's own colour
  for(const side of [-1,1]){
    box(side*.62,.55,.02,.62,.03,.72,dark) // player deck
    disc(side*.62,.585,.08,.2,.05,metal);disc(side*.62,.617,.08,.07,.02,cap) // jog wheel and its centre cap
    box(side*.62,.572,-.2,.06,.015,.22,metal);box(side*.62,.585,-.24,.05,.03,.05,cap) // pitch fader in its slot, on the DJ's edge
  }
  box(0,.55,.02,.52,.03,.72,dark) // mixer panel between the decks
  for(const n of [-1,0,1]){
    box(n*.13,.572,-.18,.05,.015,.24,metal);box(n*.13,.585,-.14,.045,.03,.05,cap) // channel fader, nearest the DJ
    for(const row of [.3,.2])box(n*.13,.585,row,.05,.035,.05,'#5b6672') // rotary knobs beyond it
  }
  // Laptop off to one side rather than the middle, where it would block the DJ from the crowd's view.
  box(.62,.575,.3,.46,.02,.22,metal) // laptop base, across the far side of the console
  box(.62,.7,.4,.46,.26,.025,dark);box(.62,.7,.385,.39,.2,.01,'#2b6a74') // lid, and the screen on the face turned back towards the DJ
  box(0,.1,-.48,.09,.08,.08,dark) // cable stub at the back
  const body:BufferGeometry[]=[]
  for(const [color,geometries] of buckets){const tint=new Color(color);for(const geometry of geometries){const values:number[]=[];for(let n=0;n<geometry.getAttribute('position').count;n++)values.push(tint.r,tint.g,tint.b);geometry.setAttribute('color',new Float32BufferAttribute(values,3));body.push(geometry)}}
  root.add(new Mesh(mergeGeometries(body)!,new MeshStandardMaterial({vertexColors:true,roughness:.85,flatShading:true})));body.forEach(g=>g.dispose())
  // Cue buttons: three across the mixer, two on each deck. Each is its own box, so a whole button
  // can be lit or dimmed by rewriting its own run of vertices.
  const spots=[{x:-.13,z:-.02,color:'#8ef29b'},{x:0,z:-.02,color:'#8ef29b'},{x:.13,z:-.02,color:'#8ef29b'},
    {x:-.71,z:-.26,color:'#d8564f'},{x:-.53,z:-.26,color:'#ffb45c'},{x:.53,z:-.26,color:'#d8564f'},{x:.71,z:-.26,color:'#ffb45c'}]
  const buttons=spots.map(spot=>new BoxGeometry(.055,.022,.055).translate(spot.x,.578,spot.z))
  const lit=mergeGeometries(buttons)!;buttons.forEach(g=>g.dispose())
  lit.setAttribute('color',new Float32BufferAttribute(new Float32Array(lit.getAttribute('position').count*3),3))
  const lights=new Mesh(lit,new MeshStandardMaterial({vertexColors:true,roughness:.6,flatShading:true}))
  root.add(lights)
  root.userData.lights=lights
  root.userData.tints=spots.map(spot=>new Color(spot.color))
  root.userData.phases=spots.map((_,n)=>n*1.7)
  return root
}
/** Rebuilt only when the booking/band changes; no simulation entities or per-frame geometry. */
export function updateStageBand(stage:Group,bandId:string|undefined,time:number,active:boolean,design?:StageDesign){
  let band=stage.userData.band as Group|undefined
  if(!active){if(band)band.visible=false;return}
  const key=bandId??'meadow'
  if(!band||band.userData.bandId!==key){
    if(band){stage.remove(band);disposeObject3D(band)}
    band=new Group();band.userData.bandId=key
    const floor=design?.54:.28,scale=design?.tileWidth? .78:design?.width? .95:.34
    const place=(member:Group,x:number,z:number)=>{member.position.set(x,floor,z);member.scale.setScalar(scale);member.userData.baseY=floor;band!.add(member)}
    // An electro act plays a booth rather than a line-up: one DJ behind a console, no band.
    band.userData.costumeId=bandCostumeId(key)
    const booth=isDjAct(key)?djPlacement(design):undefined
    if(booth){
      const desk=djDesk(hexAccent(key))
      desk.position.set(booth.desk.x,floor,booth.desk.z);desk.scale.setScalar(booth.width/2*(design?1:scale/.34))
      band.add(desk)
      place(musician('dj',0,key),booth.dj.x,booth.dj.z)
    }else if(!isDjAct(key)){
      const positions=bandPositions(design)
      bandRoles(key).forEach((role,i)=>{const pos=positions[i];if(!pos)return;place(musician(role,i,key),pos.x,pos.z)})
    }
    stage.add(band);stage.userData.band=band
  }
  band.visible=true
  for(const member of band.children){
    const tints=member.userData.tints as Color[]|undefined
    if(tints){
      // The console: nothing moves, its cue buttons simply blink, each on its own offset.
      const shade=(member.userData.lights as Mesh).geometry.getAttribute('color') as Float32BufferAttribute
      const phases=member.userData.phases as number[]
      for(let n=0;n<tints.length;n++){
        const glow=Math.sin(time*5+phases[n]!)>.1?1:.22,tint=tints[n]!
        for(let v=n*24;v<n*24+24;v++)shade.setXYZ(v,tint.r*glow,tint.g*glow,tint.b*glow)
      }
      shade.needsUpdate=true
      continue
    }
    const player=member,t=time*4+player.userData.index*.9,role=player.userData.role
    player.position.y=player.userData.baseY+Math.abs(Math.sin(t))*.015;player.rotation.z=Math.sin(t*.5)*.035
    const arms=player.userData.arms as Group[];arms.forEach((arm,i)=>{arm.rotation.x=role==='drums'?-.8+Math.sin(t*2+i*Math.PI)*.6:role==='keys'?-.9+Math.sin(t*1.7+i)*.12:role==='guitar'?-.65+Math.sin(t*2+i)*.2:role==='dj'?-1.25+Math.sin(t*2.2+i*2.1)*.3:role==='brass'?-1.15:-.4+Math.sin(t+i)*.35})
  }
}
