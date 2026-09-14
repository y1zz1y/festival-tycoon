export const COMPONENTS = {
  deck: {name:'Bühnenpodest',cost:80,party:0,beauty:1,power:0},
  truss: {name:'Traversensystem',cost:110,party:0,beauty:1,power:0},
  fireworks: {name:'Feuerwerk',cost:850,party:12,beauty:6,power:.4},
  sparks: {name:'Funkensprüher',cost:390,party:6,beauty:3,power:.5},
  spot: {name:'Moving Head',cost:180,party:5,beauty:2,power:.4},
  lineArray: {name:'Line Array',cost:230,party:8,beauty:2,power:.7},
  fullRange: {name:'Full-Range-Lautsprecher',cost:260,party:9,beauty:-1,power:1.2},
  subwoofer: {name:'Subwoofer',cost:340,party:11,beauty:-2,power:1.6},
  fog: {name:'Nebelmaschine',cost:160,party:4,beauty:1,power:.8},
  laser: {name:'Laser',cost:340,party:7,beauty:3,power:.6},
  screen: {name:'Pixel-LED-Wand',cost:420,party:5,beauty:5,power:1.5},
  discoBall: {name:'Diskokugel',cost:150,party:4,beauty:5,power:.1},
  star: {name:'Deko-Stern',cost:70,party:1,beauty:4,power:0},
  palm: {name:'Pixel-Palme',cost:120,party:1,beauty:7,power:0},
  foh: {name:'FOH-Pult',cost:900,party:2,beauty:1,power:.6},
  delay: {name:'Delayline',cost:520,party:7,beauty:0,power:1.4},
} as const
export const BRANDS = {
  budget: {name:'Bummringer · Garagenserie',cost:1,quality:.75},
  touring: {name:'Mahrten & Söhne · Touring',cost:1.7,quality:1.2},
  premium: {name:'El-Akustisch · Prestige',cost:2.8,quality:1.7},
} as const
export const TRUSS_BRANDS = {
  budget: {name:'AluTraverse',cost:1,quality:.8},
  touring: {name:'Worldwide Truss',cost:1.6,quality:1.15},
  premium: {name:'Prolight',cost:2.3,quality:1.55},
} as const
export function brandsFor(kind:ComponentKind){return kind==='truss'?TRUSS_BRANDS:BRANDS}
export type ComponentKind = keyof typeof COMPONENTS
/** Kinds that stand directly on the ground and never attach to a truss. */
export const GROUND_ONLY_KINDS:ComponentKind[]=['deck','palm','fireworks','subwoofer','foh','delay']
/** Kinds that may either stand on the ground or dock onto a truss, unlike GROUND_ONLY_KINDS which can only ever do the former. */
export const GROUND_OR_TRUSS_KINDS:ComponentKind[]=['fog','sparks','fullRange']
/** Kinds that only ever work straight upwards: the orientation cube gets no say over them, and they need open sky, since anything in the column above is something they would fire into. */
export const SKYWARD_KINDS:ComponentKind[]=['fireworks','sparks']
/**
 * Kinds that belong out with the crowd rather than on the platform: a FOH stand and a delay
 * position. They are the only parts that may stand on the painted audience tiles and out on the
 * standard audience area in front of the stage, and wherever they do stand, that tile stops being
 * audience ground — exactly the way a delay tower built out on the map clears the field it takes.
 */
export const AUDIENCE_KINDS:ComponentKind[]=['foh','delay']
/** Kinds built at map-tile size rather than build-cell size: they fill their whole field, snap to it and let nothing else share it. */
export const TILE_KINDS:ComponentKind[]=['foh','delay']
/**
 * Which half of a merged front-of-house stand a desk is, given the neighbouring desk it merges
 * with: the lower field (x first, then z) takes the sound console, the other the lighting desk.
 * Shared by the workshop model and the map, so a pair never swaps roles between the two.
 */
export function fohDeskRole(desk:{x:number;z:number},mate?:{x:number;z:number}):'all'|'sound'|'light'{
  return !mate?'all':(desk.x!==mate.x?desk.x<mate.x:desk.z<mate.z)?'sound':'light'
}
/** The map tile a part stands on. */
export function stagePartTile(p:{x:number;z:number}){return {x:Math.floor(p.x/STAGE_TILE_DETAIL),z:Math.floor(p.z/STAGE_TILE_DETAIL)}}
/** Kinds that may additionally dock directly onto another part of their own kind (stacked speakers, a hung line-array chain) instead of only a truss. */
export const STACKABLE_KINDS:ComponentKind[]=['lineArray','fullRange','subwoofer']
export type Axis='x'|'y'|'z'
/** The 6 grid-adjacent cells a part can dock into around a truss (or, for a truss's own end-caps, keep extending a chain). Every attachment — side, top, end, corner — is the same operation: one of these steps. */
export const NEIGHBOR_STEPS:{x:number;y:number;z:number}[]=[
  {x:1,y:0,z:0},{x:-1,y:0,z:0},
  {x:0,y:1,z:0},{x:0,y:-1,z:0},
  {x:0,y:0,z:1},{x:0,y:0,z:-1},
]
export type StagePart = {id:string;kind:ComponentKind;brand:keyof typeof BRANDS;x:number;y:number;z:number;axis?:Axis;rotation:number;attachedTo:string|null;color:string}
/** How the decoration lamps — a star's tubes, a palm's festoon — behave during a phase. Their tempo follows the phase's own speed fader. */
export const DECO_PATTERNS = ['chase','sparkle','pulse','static'] as const
export type DecoPattern = typeof DECO_PATTERNS[number]
export const DECO_PATTERN_NAMES:Record<DecoPattern,string> = {chase:'Lauflicht',sparkle:'Funkeln',pulse:'Puls',static:'Dauerlicht'}
export type ShowPhase = {movement?:number;pyro?:number;deco?:DecoPattern;intensity:number;speed:number;fog:number;volume:number;color:string}
export type StageDesign = {audience?:Array<{x:number;z:number}>;tileWidth?:number;tileDepth?:number;tileHeight?:number;name:string;width:number;depth:number;height:number;parts:StagePart[];linked:boolean;phases:[ShowPhase,ShowPhase,ShowPhase]}
export const PHASE_NAMES = ['Warm-up','Main','Finale'] as const
/** Build cells per map tile, in each axis. Every part fills one cell, so this is also what sets how large the equipment reads against the rest of the world. */
export const STAGE_TILE_DETAIL = 2
/** How much headroom every stage gets to build in, in map tiles — fixed rather than chosen, since empty air above the rig costs nothing and simply leaves room for towers. */
export const STAGE_TILE_HEIGHT = 15
export function stageDetailSize(tileWidth?:number,tileDepth?:number,tileHeight?:number) {
  return {width:(tileWidth??1)*STAGE_TILE_DETAIL,depth:(tileDepth??1)*STAGE_TILE_DETAIL,height:(tileHeight??1)*STAGE_TILE_DETAIL}
}
/** How far the standard audience area reaches in front of the stage, in build cells — the build area AUDIENCE_KINDS get beyond the platform itself (see stageApronCells for the same reach in map tiles). */
export function stageApronDepth(d:{tileWidth?:number}){return (d.tileWidth??1)*2*STAGE_TILE_DETAIL}
export function defaultStageDesign():StageDesign {
  const tileWidth=5,tileDepth=2,tileHeight=STAGE_TILE_HEIGHT
  return {tileWidth,tileDepth,tileHeight,name:'Meine Traumbühne',...stageDetailSize(tileWidth,tileDepth,tileHeight),linked:false,parts:[],phases:[
    {movement:20,pyro:0,deco:'pulse',intensity:40,speed:25,fog:15,volume:50,color:'#ffc369'},
    {movement:55,pyro:35,deco:'chase',intensity:75,speed:55,fog:40,volume:80,color:'#7f8cff'},
    {movement:100,pyro:100,deco:'sparkle',intensity:100,speed:85,fog:65,volume:100,color:'#ef66cd'}]}
}
/**
 * What a design costs and what it is worth on stage. The stage floor itself is free — however
 * large the platform is, the bill is only ever the equipment standing on it — and neither the
 * party nor the beauty it radiates is capped, so a bigger rig keeps counting for more.
 */
export function stageStats(d:StageDesign) {
  let cost=0,party=0,beauty=0,power=0,speakers=0
  for(const p of d.parts){const c=COMPONENTS[p.kind],b=brandsFor(p.kind)[p.brand];cost+=c.cost*b.cost;party+=c.party*b.quality;beauty+=c.beauty*b.quality;power+=c.power;if(['lineArray','fullRange','subwoofer'].includes(p.kind))speakers++}
  return {cost:Math.round(cost),upkeep:Math.round(cost*.008*10)/10,party:Math.round(party),beauty:Math.round(beauty),power:Math.round(power*10)/10,speakers}
}
export function stageDesignIssue(d:StageDesign):string|null {
  if(!d || typeof d.name!=='string'||d.name.length>60||typeof d.linked!=='boolean'||!Array.isArray(d.parts)) return 'Name mit höchstens 60 Zeichen wählen'
  if(![d.tileWidth??1,d.tileDepth??1].every(n=>Number.isInteger(n)&&n>=1&&n<=8))return 'Kartengrundfläche zwischen 1 und 8 Feldern wählen'
  if(!Number.isInteger(d.tileHeight??1)||(d.tileHeight??1)<1||(d.tileHeight??1)>STAGE_TILE_HEIGHT)return `Bühnenhöhe zwischen 1 und ${STAGE_TILE_HEIGHT} Kacheln wählen`
  const grid=stageDetailSize(d.tileWidth,d.tileDepth,d.tileHeight)
  if(d.width!==grid.width||d.depth!==grid.depth||d.height!==grid.height)return 'Bühnenraster muss zur Kartengrundfläche passen'
  const audience=d.audience??[],aw=d.tileWidth??1,ad=d.tileDepth??1
  if(!Array.isArray(audience)||audience.length>=aw*ad||audience.some(c=>!c||![c.x,c.z].every(Number.isInteger)||c.x<0||c.z<0||c.x>=aw||c.z>=ad))return 'Zuschauerfläche muss im Bühnenareal liegen; mindestens ein Technikfeld bleibt frei'
  const audienceKeys=new Set(audience.map(c=>`${c.x},${c.z}`))
  if(audienceKeys.size!==audience.length)return 'Zuschauerfelder dürfen nicht doppelt vorkommen'
  const reachable=new Set<string>(),queue=audience.filter(c=>c.x===0||c.z===0||c.x===aw-1||c.z===ad-1)
  for(let i=0;i<queue.length;i++){const c=queue[i]!,key=`${c.x},${c.z}`;if(reachable.has(key))continue;reachable.add(key);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:c.x+dx!,z:c.z+dz!};if(audienceKeys.has(`${n.x},${n.z}`)&&!reachable.has(`${n.x},${n.z}`))queue.push(n)}}
  if(reachable.size!==audience.length)return 'Jede Zuschauerfläche braucht einen durchgehenden Zugang zum äußeren Rand'
  const ids=new Set<string>()
  for(const p of d.parts){
    if(!p||typeof p.id!=='string'||p.id.length>80||ids.has(p.id)||!Object.hasOwn(COMPONENTS,p.kind)||!Object.hasOwn(brandsFor(p.kind),p.brand)||![p.x,p.y,p.z,p.rotation].every(Number.isInteger)||p.x<0||p.x>=d.width||p.y<0||p.y>=d.height||p.z<0||p.z>=d.depth+(AUDIENCE_KINDS.includes(p.kind)?stageApronDepth(d):0)||p.rotation<0||p.rotation>5||!/^#[0-9a-f]{6}$/i.test(p.color)||(p.axis!==undefined&&!['x','y','z'].includes(p.axis)))return 'Ungültiges Bühnenelement'
    ids.add(p.id)
    if(p.attachedTo===null){
      if(p.kind!=='truss'&&!GROUND_ONLY_KINDS.includes(p.kind)&&!GROUND_OR_TRUSS_KINDS.includes(p.kind))return 'Dieses Bauteil braucht eine Traverse als Träger'
    }else{
      const host=d.parts.find(q=>q?.id===p.attachedTo)
      if(!host)return 'Fehlende Trägertraverse'
      const dx=p.x-host.x,dy=p.y-host.y,dz=p.z-host.z
      if(!NEIGHBOR_STEPS.some(s=>s.x===dx&&s.y===dy&&s.z===dz))return 'Bauteile müssen direkt an ihrer Trägertraverse anliegen'
      if(isTruss(host.kind)){
        if(GROUND_ONLY_KINDS.includes(p.kind))return 'Dieses Bauteil steht auf dem Boden, nicht an einer Traverse'
        // A mirror ball hangs off its motor, so it only ever goes under the truss, never beside it.
        if(p.kind==='discoBall'&&(dx!==0||dz!==0||dy!==-1))return 'Eine Diskokugel hängt nur unter einer Traverse'
      }else if(host.kind==='subwoofer'&&p.kind!=='subwoofer'&&!GROUND_ONLY_KINDS.includes(p.kind)){
        // A subwoofer is a stable platform for anything that doesn't have to stand on the
        // ground itself — but only balanced on top, never hung underneath or bolted to a side.
        if(dx!==0||dz!==0||dy!==1)return 'Dieses Bauteil kann nur oben auf dem Subwoofer stehen'
      }else if(p.kind==='screen'&&host.kind==='screen'){
        // A Pixel-LED-Wand module only ever attaches to a truss directly (any of its six sides,
        // handled above) to anchor the very first module of a wall — every further module grows
        // the wall by docking onto an already-connected module instead, in any of the four
        // directions that stay in the same flat plane (never front/back, which would stack
        // modules into each other instead of tiling them side by side).
        if(p.rotation!==host.rotation)return 'Ein Pixel-LED-Wand-Modul kann nur an ein gleich ausgerichtetes Modul anbauen'
        const facing=partFacing(p)
        if(dx*facing.x+dy*facing.y+dz*facing.z!==0)return 'Pixel-LED-Wand-Module wachsen nur seitlich und übereinander, nicht in die Tiefe'
      }else if(STACKABLE_KINDS.includes(p.kind)&&host.kind===p.kind){
        // Line arrays hang and extend downward, element by element; stacked speakers/subs grow upward instead.
        const downward=p.kind==='lineArray'
        if(dx!==0||dz!==0||dy!==(downward?-1:1))return downward?'Line-Array-Elemente docken nur unten am vorherigen Element an':'Dieses Bauteil kann nur oben auf dem vorherigen Element andocken'
      }else{
        return 'Dieses Bauteil kann nicht an diesem Trägerobjekt andocken'
      }
    }
    // Anything that works straight up has to do so into open sky: a part standing in the same
    // column above it — a truss most of all — is something it would fire into.
    if(SKYWARD_KINDS.includes(p.kind)&&d.parts.some(q=>q!==p&&q.x===p.x&&q.z===p.z&&q.y>p.y))return `${COMPONENTS[p.kind].name} arbeitet nach oben und braucht freien Himmel — darüber darf nichts stehen`
    if(p.attachedTo===null&&p.y===0&&!AUDIENCE_KINDS.includes(p.kind)&&partOnAudience(d,p))return 'Zuschauerflächen bleiben frei von Bodenaufbauten'
    // A FOH stand and a delay tower are as big as the field they stand on, so nothing else shares
    // that field with them — everything else claims only its own build cell.
    if(d.parts.some(q=>q!==p&&q.y===p.y&&(TILE_KINDS.includes(p.kind)||TILE_KINDS.includes(q.kind)
      ?stagePartTile(q).x===stagePartTile(p).x&&stagePartTile(q).z===stagePartTile(p).z
      :q.x===p.x&&q.z===p.z)))return 'Dieser Platz ist bereits belegt'
  }
  if(!Array.isArray(d.phases)||d.phases.length!==3||d.phases.some(p=>!p||![p.intensity,p.speed,p.fog,p.volume,p.movement??0,p.pyro??0].every(n=>Number.isFinite(n)&&n>=0&&n<=100)||!/^#[0-9a-f]{6}$/i.test(p.color)||(p.deco!==undefined&&!DECO_PATTERNS.includes(p.deco))))return 'Ungültige Showregler'
  return null
}
export function stagePhase(d:StageDesign,progress:number):ShowPhase {return d.phases[d.linked?0:progress<.2?0:progress<.8?1:2]}

export function stageSize(d:StageDesign|undefined,rotation=0){
  const width=d?.tileWidth??1,depth=d?.tileDepth??1
  return rotation%2 ? {width:depth,depth:width} : {width,depth}
}
export function occupiesBuildingCell(b:{x:number;z:number;rotation:number;stageDesign?:StageDesign},x:number,z:number){
  const size=stageSize(b.stageDesign,b.rotation)
  return x>=b.x&&x<b.x+size.width&&z>=b.z&&z<b.z+size.depth
}
export function buildingFootprint(b:{x:number;z:number;rotation:number;stageDesign?:StageDesign}){
  const size=stageSize(b.stageDesign,b.rotation),cells:Array<{x:number;z:number}>=[]
  for(let z=b.z;z<b.z+size.depth;z++)for(let x=b.x;x<b.x+size.width;x++)cells.push({x,z})
  return cells
}

export function stageDistance(b:{x:number;z:number;rotation:number;stageDesign?:StageDesign},p:{x:number;z:number}){
  const size=stageSize(b.stageDesign,b.rotation)
  return Math.hypot(Math.max(b.x-p.x,0,p.x-(b.x+size.width-1)),Math.max(b.z-p.z,0,p.z-(b.z+size.depth-1)))
}

export function partOnAudience(d:StageDesign,p:{x:number;z:number}):boolean {
  const x=Math.floor((p.x+.5)*(d.tileWidth??1)/d.width),z=Math.floor((p.z+.5)*(d.tileDepth??1)/d.depth)
  return !!d.audience?.some(c=>c.x===x&&c.z===z)
}
/**
 * Where a tile of the design — its own (x,z) in map tiles, which for the standard audience area
 * runs on past the platform's own depth — ends up on the map once the stage is turned. Tiles in
 * front of the stage simply come out with a local coordinate outside the footprint, which is
 * exactly where they belong.
 */
function stageTileOnMap(rotation:number,x:number,z:number,w:number,h:number){
  return rotation===1?{x:z,z:w-1-x}:rotation===2?{x:w-1-x,z:h-1-z}:rotation===3?{x:h-1-z,z:x}:{x,z}
}
/** Map tiles the crowd gives up because a FOH stand or a delay tower of the design occupies them. */
function stagePartTiles(d:StageDesign){
  return new Set(d.parts.filter(p=>AUDIENCE_KINDS.includes(p.kind)&&p.attachedTo===null)
    .map(p=>{const t=stagePartTile(p);return `${t.x},${t.z}`}))
}
export function stageAudienceCells(b:{x:number;z:number;rotation:number;stageDesign?:StageDesign}){
  const d=b.stageDesign;if(!d)return []
  const w=d.tileWidth??1,h=d.tileDepth??1,taken=stagePartTiles(d)
  return (d.audience??[]).filter(c=>!taken.has(`${c.x},${c.z}`)).map(c=>{
    const local=stageTileOnMap(b.rotation,c.x,c.z,w,h)
    return {x:b.x+local.x,z:b.z+local.z}
  })
}
export function isStageAudienceCell(b:{x:number;z:number;rotation:number;stageDesign?:StageDesign},x:number,z:number){return stageAudienceCells(b).some(c=>c.x===x&&c.z===z)}
/**
 * The audience area every stage comes with: it runs the full width of the stage's frontage and
 * twice that deep, laid directly in front of it — where a crowd actually stands. A stage design's
 * own front is its +Z, so which way "in front" points on the map follows the rotation it was built
 * at, the same way stageAudienceCells maps its painted tiles.
 */
export function stageApronCells(b:{x:number;z:number;rotation:number;stageDesign?:StageDesign}){
  const d=b.stageDesign;if(!d)return []
  const w=d.tileWidth??1,h=d.tileDepth??1,reach=w*2,taken=stagePartTiles(d)
  const cells:Array<{x:number;z:number}>=[]
  for(let row=0;row<reach;row++)for(let col=0;col<w;col++){
    if(taken.has(`${col},${h+row}`))continue // a FOH stand or a delay tower built out here takes the field it stands on
    const local=stageTileOnMap(b.rotation,col,h+row,w,h)
    cells.push({x:b.x+local.x,z:b.z+local.z})
  }
  return cells
}
export function removeStagePart(d:StageDesign,id:string):StageDesign {
  const next=structuredClone(d),removed=new Set([id]);let added=true
  while(added){added=false;for(const p of next.parts)if(!removed.has(p.id)&&p.attachedTo&&removed.has(p.attachedTo)){removed.add(p.id);added=true}}
  next.parts=next.parts.filter(p=>!removed.has(p.id));return next
}

export function isTruss(kind:string){return kind==='truss'}
export function stageMotion(phase:ShowPhase,time:number){return (phase.movement??0)/100*.9*(1+Math.sin(time*(.2+phase.speed/80)))}
/** Direction a mounted effect (spot/laser) points or hangs: away from its host truss, or straight up when free-standing. */
export function mountDirection(part:StagePart,host:StagePart|undefined):{x:number;y:number;z:number}{
  if(!host)return{x:0,y:1,z:0}
  return {x:part.x-host.x,y:part.y-host.y,z:part.z-host.z}
}
/** Unit vector for a part's own facing, as chosen with the orientation cube: 0=+Z,1=+X,2=-Z,3=-X,4=+Y (up),5=-Y (down). */
export const ROTATION_DIRECTIONS:{x:number;y:number;z:number}[] = [
  {x:0,y:0,z:1},{x:1,y:0,z:0},{x:0,y:0,z:-1},{x:-1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:-1,z:0},
]
export function partFacing(part:StagePart):{x:number;y:number;z:number}{return ROTATION_DIRECTIONS[part.rotation] ?? {x:0,y:1,z:0}}
/** The one rotation that aims a part straight up, for parts that only ever point that way. */
export const UP_ROTATION=4
/**
 * The rotation a Pixel-LED-Wand module has to take when it is bolted onto the given face of a
 * truss: its LEDs always point away from the structure carrying them, never back into it — which
 * is also what makes two walls meet cleanly around a corner. Undefined for a module docked below
 * or above a truss, where the choice stays free because LEDs never point straight up or down.
 */
export function screenFacingRotation(step:{x:number;y:number;z:number}):number|undefined{
  const index=ROTATION_DIRECTIONS.findIndex(r=>r.x===step.x&&r.y===step.y&&r.z===step.z)
  return index>=0&&index<4?index:undefined
}
/** How many line-array elements are chained above this one (0 for the element docked straight onto the truss), for the per-element downward curvature. */
export function lineArrayIndex(d:StageDesign,part:StagePart):number{
  let index=0,current=part
  while(current.attachedTo){
    const host=d.parts.find(q=>q.id===current.attachedTo)
    if(!host||host.kind!=='lineArray')break
    index++;current=host
  }
  return index
}
/** Whether this line-array element is the bottom-most one in its hung chain (nothing else docks onto it) — only this element's own cabinets pick up any downward curvature; every element above it hangs perfectly straight. */
export function isLastLineArrayElement(d:StageDesign,part:StagePart):boolean{
  return !d.parts.some(q=>q.attachedTo===part.id&&q.kind==='lineArray')
}
/**
 * Re-grids a design that was saved while a map tile still held a different number of build cells.
 * Positions are scaled into the current grid so the stage stays recognisable instead of failing
 * validation and quietly vanishing from the library. Where the coarser grid puts two parts in the
 * same cell the later one loses — along with anything it was carrying, which has nowhere to hang.
 */
function regridStageDesign(d:StageDesign):StageDesign {
  const detail=d.width/(d.tileWidth??1)
  if(!Number.isInteger(detail)||detail===STAGE_TILE_DETAIL)return d
  const grid=stageDetailSize(d.tileWidth,d.tileDepth,d.tileHeight)
  const fit=(n:number,limit:number)=>Math.max(0,Math.min(limit-1,Math.floor(n*STAGE_TILE_DETAIL/detail)))
  const taken=new Set<string>(),kept=new Set<string>(),parts:StagePart[]=[]
  for(const p of d.parts){
    const x=fit(p.x,grid.width),y=fit(p.y,grid.height),z=fit(p.z,grid.depth),cell=`${x},${y},${z}`
    if(taken.has(cell))continue
    taken.add(cell);kept.add(p.id);parts.push({...p,x,y,z})
  }
  let next:StageDesign={...d,...grid,parts}
  for(const p of d.parts)if(!kept.has(p.id))next=removeStagePart(next,p.id)
  console.warn(`Bühnendesign "${d.name}": Raster von ${detail} auf ${STAGE_TILE_DETAIL} Zellen je Kachel umgerechnet.`)
  return next
}
/** Rewrites StagePart kinds removed from COMPONENTS since a design was saved, so old saves keep loading instead of failing validation. Logs when it actually changes something. */
export function migrateStageDesign(design:StageDesign):StageDesign {
  // Old 2D workshops stored x/z only. Supply ground-level heights before any
  // regridding: undefined y would otherwise produce NaN vertices (or collisions).
  const missingHeight = !Number.isFinite(design.height)
  const missingPartHeight = design.parts.some(part => !Number.isFinite(part.y))
  const normalized = missingHeight || missingPartHeight ? {
    ...design,
    ...(missingHeight ? {
      tileHeight: design.tileHeight ?? STAGE_TILE_HEIGHT,
      height: (design.tileHeight ?? STAGE_TILE_HEIGHT) * STAGE_TILE_DETAIL,
    } : {}),
    parts: design.parts.map(part => Number.isFinite(part.y) ? part : { ...part, y: 0 }),
  } : design
  const d=regridStageDesign(normalized)
  let changed=false,turned=false
  /** The facing a module in a Pixel-LED-Wand must have: out along the truss face its wall is bolted to, resolved through however many modules the wall was grown by. */
  const wallFacing=(part:StagePart):number|undefined=>{
    const host=part.attachedTo?d.parts.find(q=>q?.id===part.attachedTo):undefined
    if(!host)return undefined
    return isTruss(host.kind)?screenFacingRotation(mountDirection(part,host)):host.kind==='screen'?wallFacing(host):undefined
  }
  const parts=d.parts.map(p=>{
    if((p.kind as string)==='speaker'){changed=true;return {...p,kind:'fullRange' as ComponentKind}}
    // Saved before fireworks and spark machines were pinned to the sky (see SKYWARD_KINDS), a
    // design can still hold one aimed sideways, which it can no longer be built as.
    if(SKYWARD_KINDS.includes(p.kind)&&p.rotation!==UP_ROTATION){turned=true;return {...p,rotation:UP_ROTATION}}
    // Designs saved before the LEDs were forced to point away from their truss (see
    // screenFacingRotation) can still hold a wall facing backwards into the structure.
    if(p.kind==='screen'){const facing=wallFacing(p);if(facing!==undefined&&facing!==p.rotation){turned=true;return {...p,rotation:facing}}}
    // A FOH stand or a delay tower fills a whole map field, so it belongs on that field's own
    // corner cell — a design saved while they still sat on any build cell gets pulled onto it.
    if(TILE_KINDS.includes(p.kind)){
      const x=Math.floor(p.x/STAGE_TILE_DETAIL)*STAGE_TILE_DETAIL,z=Math.floor(p.z/STAGE_TILE_DETAIL)*STAGE_TILE_DETAIL
      if(x!==p.x||z!==p.z){turned=true;return {...p,x,z}}
    }
    return p
  })
  // The banner has no successor the way the old speaker had, so it is simply dropped — together
  // with anything a legacy design had docked onto it, which would otherwise be left dangling.
  let next={...d,parts}
  const dropped=parts.filter(p=>(p.kind as string)==='banner')
  for(const p of dropped)next=removeStagePart(next,p.id)
  if(!changed&&!turned&&!dropped.length)return d
  if(changed)console.warn(`Bühnendesign "${d.name}": veraltetes Bauteil "speaker" auf "fullRange" migriert.`)
  if(dropped.length)console.warn(`Bühnendesign "${d.name}": ${dropped.length} entferntes Bauteil "Themenbanner" aus der Bühne genommen.`)
  return next
}
