import { getTerrainHeight } from './terrain'
import { bookFinance, CARRIER_WAGE_PER_MINUTE } from './finance'
import type { GameSnapshot } from './GameState'
import type { Point, CarryRoute, Depot } from './supplyChain'
import { emptyStock } from './supplyChain'
import type { Supply } from './festivalManagement'
import { CARDINAL_OFFSETS } from './shopAccess'
import { wayInfo, type WayType } from './wayTypes'

export function updateDepotCarriers(s: GameSnapshot, dt: number, findPath: (from: Point, goals: Point[]) => Point[] | null, canStep: (from:Point,to:Point)=>boolean): void {
  const i = s.festival.infrastructure
  if (!i.routes.some(r=>r.automatic)) return
  const paths = s.buildings.filter(b => b.kind === 'path')
  const key = (p:Point) => `${p.x},${p.z},${p.elevation}`
  const byCell = new Map<string, Point & { wayType?: WayType }>(
    paths.map(p => [key(p), p]),
  )
  for (const cell of s.stageForecourtCells) {
    const walk = { x: cell.x, z: cell.z, elevation: cell.elevation }
    const walkKey = key(walk)
    if (!byCell.has(walkKey)) byCell.set(walkKey, walk)
  }
  const byXZ = new Map<string, Point[]>()
  for (const walk of byCell.values()) {
    const xz = `${walk.x},${walk.z}`
    const list = byXZ.get(xz)
    if (list) list.push(walk)
    else byXZ.set(xz, [walk])
  }
  const access = (p:{x:number;z:number}) => {
    const goals: Point[] = []
    for (const [dx, dz] of CARDINAL_OFFSETS) {
      const x = p.x + dx
      const z = p.z + dz
      const elevation = getTerrainHeight(s.terrain, x, z)
      const exact = byCell.get(key({ x, z, elevation }))
      if (exact) {
        goals.push(exact)
        continue
      }
      const nearby = byXZ.get(`${x},${z}`)
      if (nearby?.[0]) goals.push(nearby[0]!)
    }
    return goals
  }
  const occupancy = new Map<string,number>()
  for (const v of s.visitors) {
    if (['riding','bus-riding','vehicle-arrival'].includes(v.state)) continue
    const k=key({x:v.cellX,z:v.cellZ,elevation:v.cellElevation}); occupancy.set(k,(occupancy.get(k)??0)+1)
  }
  for (const r of i.routes) { const k=key(r.position); occupancy.set(k,(occupancy.get(k)??0)+(r.cargo ? 3:2)) }
  const reserved = (id:string,kind:Supply,source=false,except?:CarryRoute) => i.routes.reduce((sum,r) => sum + (r!==except && r.automatic && r.kind===kind && r.job && r.job.phase !== 'home' && (source ? r.job.phase==='pickup' && r.job.sourceId===id : r.job.destinationId===id) ? (r.job.phase==='pickup' ? r.job.quantity:r.cargo) : 0),0)
  const go = (r:CarryRoute, goals:Point[]) => { const path=findPath(r.position,goals); if(path===null) return false; r.path=path; return true }
  for (const r of i.routes) {
    if (!r.automatic) continue
    bookFinance(s, 'staff', -dt * CARRIER_WAGE_PER_MINUTE)
    const area=r.workArea
    const inside=(p:{x:number;z:number})=>!area||p.x>=area.minX&&p.x<=area.maxX&&p.z>=area.minZ&&p.z<=area.maxZ
    const home=i.depots.find(d=>d.id===r.depotId)
    if (!home) continue
    if (!r.job && r.phase === 'idle' && !byCell.has(key(r.position))) r.position=access(home)[0] ?? r.position
    if (r.path.length) {
      const next=r.path[0]!, path=byCell.get(key(next))
      if (!path || !canStep(r.position,next)) { r.path=[]; r.status='Verbindung unterbrochen; warte auf erreichbaren Weg'; continue }
      const way=wayInfo(s,next.x,next.z,'foot',path.wayType)
      const weight=r.cargo ? 3:2
      const density=((occupancy.get(key(next))??0) - (key(next)===key(r.position)?weight:0)+weight-1)/way.capacity
      r.progress += dt*way.speed*Math.max(.02,1/(1+12*Math.pow(Math.max(0,density-.5)*2,2)))
      if(r.progress>=1) {
        const old=key(r.position), dest=key(next)
        occupancy.set(old,Math.max(0,(occupancy.get(old)??0)-weight)); occupancy.set(dest,(occupancy.get(dest)??0)+weight)
        r.position=r.path.shift()!;r.progress=0
      }
      r.status=density>=.75?'Mit Ladung durch Gedränge':r.job?.phase==='pickup'?'Hole Waren ab':'Liefere Waren'
      continue
    }
    if (r.job) {
      const job=r.job, kind=r.kind as Supply
      const destination = job.phase==='pickup' ? i.depots.find(d=>d.id===job.sourceId) : job.phase==='home' ? home : job.destinationKind==='depot' ? i.depots.find(d=>d.id===job.destinationId) : s.buildings.find(b=>b.id===job.destinationId)
      if (!destination) { job.phase='home'; r.status='Ziel fehlt; bringe Ladung zurück'; continue }
      const goals=access(destination)
      if(!goals.some(p=>key(p)===key(r.position))) { if(!go(r,goals)) r.status='Warte auf Wegverbindung'; continue }
      if(job.phase==='pickup') {
        const source=destination as Depot
        const quantity=Math.min(job.quantity,Math.max(0,source.stock[kind]))
        source.stock[kind]-=quantity;r.cargo=quantity
        job.phase=quantity?'deliver':'home';r.phase='return'
      } else if(job.phase==='deliver') {
        if(job.destinationKind==='depot') (destination as Depot).stock[kind]+=r.cargo
        else { const stock=i.shops[destination.id]??=emptyStock();stock[kind]+=r.cargo }
        r.cargo=0;job.phase='home'
      } else {
        home.stock[kind]+=r.cargo;r.cargo=0;delete r.job;r.phase='idle';r.targetId='';r.status='Warte auf Transportbedarf'
      }
      continue
    }
    if ((r.assignmentDelay ?? 0) > 0) { r.assignmentDelay = Math.max(0,r.assignmentDelay! - dt); continue }
    r.assignmentDelay = 3
    const assign=(source:Depot,destination:{id:string;x:number;z:number},destinationKind:'depot'|'shop',kind:Supply,need:number) => {
      const available=source.stock[kind]-reserved(source.id,kind,true,r)
      const quantity=Math.min(40,need,available)
      if(quantity<=0) return false
      const sourceAccess=access(source), targetAccess=access(destination)
      const route=findPath(r.position,sourceAccess)
      if(route===null || !targetAccess.length || findPath(route.at(-1)??r.position,targetAccess)===null) return false
      r.kind=kind;r.targetId=destination.id;r.path=route;r.phase='outbound';r.job={sourceId:source.id,destinationId:destination.id,destinationKind,quantity,phase:'pickup'};r.status='Hole Waren ab'
      return true
    }
    const nearer=(a:{x:number;z:number},b:{x:number;z:number})=>Math.abs(a.x-home.x)+Math.abs(a.z-home.z)-Math.abs(b.x-home.x)-Math.abs(b.z-home.z)
    const supplyShops=()=>{
      const shops=s.buildings.filter(b=>['food','alcohol','toilet'].includes(b.kind)&&inside(b)).sort(nearer)
      for(const shop of shops) {
        const kind:Supply=shop.kind==='food'?'food':shop.kind==='alcohol'?'drinks':'water'
        const need=40-(i.shops[shop.id]?.[kind]??0)-reserved(shop.id,kind)
        if(assign(home,shop,'shop',kind,need)) return true
      }
      return false
    }
    if (home.role === 'delivery') {
      if (!supplyShops()) {
        const storages=i.depots.filter(d=>d.id!==home.id && d.role!=='delivery' && inside(d)).sort(nearer)
        outer: for (const kind of ['food','drinks','water'] as Supply[]) {
          if(home.stock[kind]-reserved(home.id,kind,true,r)<=0) continue
          for(const storage of storages) {
            const need=storage.minimum[kind]-storage.stock[kind]-reserved(storage.id,kind)
            if(need>0 && assign(home,storage,'depot',kind,need)) break outer
          }
        }
      }
      continue
    }
    let assigned=false
    for(const kind of ['food','drinks','water'] as Supply[]) {
      const need=home.minimum[kind]-home.stock[kind]-reserved(home.id,kind)
      if(need<=0) continue
      const sources=i.depots.filter(d=>d.id!==home.id && inside(d) && (d.role==='delivery'||d.distribution==='relay')).sort(nearer)
      for(const source of sources) if(assign(source,home,'depot',kind,need)) {assigned=true;break}
      if(assigned) break
    }
    if(!assigned) supplyShops()
  }
}
