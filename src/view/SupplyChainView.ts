import { transportMotionFactor } from './transportMotion'
import { BoxGeometry, Group, Line, BufferGeometry, LineBasicMaterial, Mesh, MeshStandardMaterial, Color, Quaternion, Vector3 } from 'three'
import { TerrainShape } from './terrainShape'
import { createTerrainSurface } from './terrainSurface'
import type { GameSnapshot } from '../game/GameState'
import { groundInfo } from '../game/ground'
import { getTerrainHeight } from '../game/terrain'
import { disposeChildren } from './disposeObject3D'
import { createCarrierDriver, createCarrierFigure, createPorterModel } from './carrierModels'
import { createRoadVehicleModel, createSupplyStructure } from './logisticsModels'
import { staffGateWorldPosition, staffGateYaw } from '../game/supplyChain'
import { buildingSize } from '../game/stageDesign'

export class SupplyChainView {
  group = new Group()
  private ground = new Group()
  private structures = new Group()
  private lines = new Group()
  private actors = new Map<string, Group>()
  private lastAnimationTime: number | null = null
  private groundStamp = ''
  private groundShape: TerrainShape | undefined
  private depotStamp = ''
  private lineStamp = ''
  private gates = new Group()
  private gateStamp = ''
  private stockModels = new Map<string, Group>()
  /** The fill plates, together, so they can be switched off as one. */
  private stock = new Group()
  constructor() { this.group.add(this.ground, this.structures, this.lines, this.gates, this.stock) }
  private box(group: Group, size: [number, number, number], position: [number, number, number], color: number) {
    const mesh = new Mesh(new BoxGeometry(...size), new MeshStandardMaterial({ color, roughness: 1 }))
    mesh.position.set(...position); group.add(mesh)
  }
  getCarrierPosition(id: string): Vector3 | undefined { return this.actors.get(id)?.position }
  getStaffMeshes(): Group[] { return [...this.actors.entries()].filter(([id])=>id.startsWith('carrier-')).map(([,model])=>model) }
  update(s: Readonly<GameSnapshot>, planning: boolean, shape?: TerrainShape) {
    this.ground.visible = planning
    const i = s.festival.infrastructure
    const gatePaths=s.buildings.filter(b=>b.kind==='path'&&b.staffOnly)
    const gateStamp=gatePaths.map(b=>`${b.id}:${b.x}:${b.z}:${b.elevation}:${b.staffGateDirection ?? 'legacy'}:${b.rotation}`).join('|')
    if(gateStamp!==this.gateStamp) {
      this.gateStamp=gateStamp;disposeChildren(this.gates)
      for(const p of gatePaths) {
        const gate=new Group();const pos=staffGateWorldPosition(p);gate.position.set(pos.x,pos.y,pos.z);gate.rotation.y=staffGateYaw(p)
        this.box(gate,[.08,.9,.08],[-.4,.45,0],0xe2c35c);this.box(gate,[.08,.9,.08],[.4,.45,0],0xe2c35c)
        this.box(gate,[.8,.16,.06],[0,.7,0],0x334e5a);this.gates.add(gate)
      }
    }
    const stockIds=new Set<string>()
    const paintBar=(model:Group,index:number,ratio:number,y:number)=>{
      const fill=model.children[index] as Mesh
      fill.scale.x=Math.max(.025,ratio);fill.position.set(-(1-ratio)*.32,y,.01)
      ;(fill.material as MeshStandardMaterial).color.setHex(ratio<=0?0xe86e53:ratio<.25?0xe4b557:0x70c481)
    }
    for(const b of s.buildings) {
      const kind=b.kind==='food'?'food':b.kind==='alcohol'?'drinks':b.kind==='toilet'?'water':b.kind==='mascot'||b.kind==='shirt'?'goods':null
      if(!kind) continue
      stockIds.add(b.id)
      let model=this.stockModels.get(b.id)
      if(!model) {model=new Group();this.box(model,[.68,.09,.05],[0,0,0],0x292d29);this.box(model,[.64,.065,.065],[0,0,.01],0x70c481);this.stock.add(model);this.stockModels.set(b.id,model)}
      // Over the middle of whatever it belongs to, not its front edge: the plate turns
      // with the camera, and a pivot off to one side swings it away from its own stand.
      const footprint=buildingSize(b)
      model.position.set(b.x+footprint.width/2,b.elevation+1.1,b.z+footprint.depth/2)
      paintBar(model,1,Math.min(1,(i.shops[b.id]?.[kind]??0)/40),0)
    }
    const supplies=['food','drinks','water','goods'] as const
    for(const depot of i.depots) {
      stockIds.add(depot.id)
      let model=this.stockModels.get(depot.id)
      if(!model) {
        const created=new Group()
        supplies.forEach((_,index)=>{
          const y=(1-index)*.12
          this.box(created,[.68,.09,.05],[0,y,0],0x292d29)
          this.box(created,[.64,.065,.065],[0,y,.01],0x70c481)
        })
        this.stock.add(created);this.stockModels.set(depot.id,created)
        model=created
      }
      model.position.set(depot.x+.5,getTerrainHeight(s.terrain,depot.x,depot.z)+1.25,depot.z+.5)
      supplies.forEach((kind,index)=>{
        const capacity=Math.max(depot.minimum[kind],200)
        paintBar(model,index*2+1,Math.min(1,depot.stock[kind]/capacity),(1-index)*.12)
      })
    }
    for(const [id,model] of this.stockModels) if(!stockIds.has(id)){disposeChildren(model);this.stock.remove(model);this.stockModels.delete(id)}
    const stamp = `${planning}:${s.scenario.environment}:${s.scenario.worldSize}:${JSON.stringify(i.ground)}:${JSON.stringify(s.terrain.heights)}`
    if (stamp !== this.groundStamp || this.groundShape !== shape) {
      this.groundShape = shape
      this.groundStamp = stamp; disposeChildren(this.ground)
      if (planning) {
      const size = s.scenario.worldSize
      const mesh = createTerrainSurface(s, new MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: .25, roughness: 1, depthWrite: false }), shape)
      const colors = mesh.geometry.getAttribute('color'), tint = new Color()
      let index = 0
      for (let z = -size / 2; z < size / 2; z++) for (let x = -size / 2; x < size / 2; x++) {
        const ground = groundInfo(s, x, z)
        const color = ground.surface === 'paved' ? 0xaebbb7 : ground.surface === 'gravel' ? 0x9e9a85 : ground.compacted ? 0x93835a : ground.drained ? 0x559a98 : ground.type === 'clay' ? 0xb57a59 : ground.type === 'gravel' ? 0xa3a280 : ground.type === 'sand' ? 0xd4bd83 : ground.type === 'grass' ? 0x79a85f : 0x828343
        tint.setHex(color)
        for (let corner = 0; corner < 5; corner++) colors.setXYZ(index++, tint.r, tint.g, tint.b)
      }
      mesh.position.y = .012; this.ground.add(mesh)
      }
    }
    const depots = i.depots.map(d => `${d.id}:${d.role}:${d.x}:${d.z}:${getTerrainHeight(s.terrain, d.x, d.z)}`).join('|')
    if (depots !== this.depotStamp) {
      this.depotStamp = depots; disposeChildren(this.structures)
      for (const d of i.depots) {
        const model = createSupplyStructure(d.role === 'delivery' ? 'delivery' : 'supply')
        model.position.set(d.x + .5, getTerrainHeight(s.terrain, d.x, d.z), d.z + .5)
        this.structures.add(model)
      }
    }
    this.lines.visible = planning
    const lineStamp = planning ? JSON.stringify(i.routes.map(r => [r.id, r.position, r.path])) : ''
    if (planning && lineStamp !== this.lineStamp) {
      this.lineStamp = lineStamp; disposeChildren(this.lines)
      for (const r of i.routes) {
        const points = [r.position, ...r.path].map(p => new Vector3(p.x + .5, p.elevation + .18, p.z + .5))
        if (points.length > 1) this.lines.add(new Line(new BufferGeometry().setFromPoints(points), new LineBasicMaterial({ color: r.kind === 'waste' ? 0xf1a060 : 0x79f6dd, depthTest: false })))
      }
    }
    const active = new Set<string>()
    const actor = (id: string, truck: boolean, x: number, y: number, z: number, loaded: boolean, stuck: boolean) => {
      active.add(id)
      let model = this.actors.get(id)
      if (!model) {
        if (truck) {
          model = new Group()
          model.add(createRoadVehicleModel('deliveryTruck', id))
          const load = new Group(); load.name = 'load'; model.add(load)
          model.add(createCarrierDriver(id))
        } else if (id.startsWith('carrier-')) {
          model = createPorterModel(id)
          model.traverse(object => { object.userData.staffId = id })
        } else {
          model = new Group()
          model.add(createCarrierFigure(id))
          const load = new Group(); load.name = 'load'; model.add(load)
          const driver = new Group(); driver.name = 'driver'; driver.visible = false; model.add(driver)
        }
        model.position.set(x + .5, y, z + .5)
        model.userData.transportTarget = new Vector3(x + .5, y, z + .5)
        model.userData.transportFacing = 0
        this.actors.set(id, model); this.group.add(model)
      }
      const target = model.userData.transportTarget as Vector3
      const dx=x+.5-target.x, dz=z+.5-target.z
      if(Math.abs(dx)+Math.abs(dz)>.001) model.userData.transportFacing=Math.atan2(dx,dz)
      target.set(x+.5,y,z+.5)
      model.getObjectByName('load')!.visible = loaded && !truck
      model.getObjectByName('driver')!.visible = stuck
    }
    const deliveryIds = new Set(
      s.logistics.roadVehicles
        .filter((vehicle) => vehicle.kind === 'deliveryTruck')
        .flatMap((vehicle) => [vehicle.id, vehicle.deliveryId ?? '']),
    )
    for (const t of i.trucks) {
      if (deliveryIds.has(t.id)) continue
      actor(t.id, true, t.x, getTerrainHeight(s.terrain, t.x, t.z), t.z, t.cargo > 0, t.stuck > 0)
    }
    for (const r of i.routes) actor(r.id, false, r.position.x, r.position.elevation, r.position.z, r.cargo > 0, false)
    for (const v of s.logistics.roadVehicles) if ((v.stuckMinutes ?? 0) > 0 && v.cell) {
      actor(`push-${v.id}`, false, v.cell.x, getTerrainHeight(s.terrain, v.cell.x, v.cell.z), v.cell.z, false, true)
    }
    for (const [id, model] of this.actors) if (!active.has(id)) { disposeChildren(model); this.group.remove(model); this.actors.delete(id) }
  }
  /**
   * The fill bars are flat plates: seen from behind they are a dark edge, from the
   * side nothing at all. Turning them with the camera is the whole point of them —
   * a stand's stock has to be readable from wherever the player happens to look.
   * Runs every frame, including while the game is paused, since the camera turns then too.
   */
  faceCamera(orientation: Quaternion): void {
    if (!this.stock.visible) return
    for (const model of this.stockModels.values()) model.quaternion.copy(orientation)
  }

  /** Whether the fill plates are drawn at all; the player decides in the settings. */
  setStockVisible(visible: boolean): void {
    this.stock.visible = visible
  }
  animate(paused: boolean, time = performance.now(), terrainHeight?: (x: number, z: number, y: number) => number): void {
    const seconds = this.lastAnimationTime === null ? 0 : Math.min(.25, Math.max(0, (time-this.lastAnimationTime)/1000))
    this.lastAnimationTime=time
    if(paused) return
    const factor=transportMotionFactor(seconds)
    for(const model of this.actors.values()) {
      const target=model.userData.transportTarget as Vector3
      // Loading a different world or relocating an actor is not a drive across the map.
      if(model.position.distanceToSquared(target)>25) model.position.copy(target)
      else model.position.lerp(target,factor)
      if (terrainHeight) model.position.y = terrainHeight(model.position.x, model.position.z, model.position.y)
      const angle=Number(model.userData.transportFacing??0)-model.rotation.y
      model.rotation.y+=Math.atan2(Math.sin(angle),Math.cos(angle))*factor
      const moving = model.position.distanceToSquared(target) > 4e-4
      const phase = time * 0.009 + Number(model.userData.walkPhase ?? 0)
      model.traverse((object) => {
        if (typeof object.userData.walkLimb === 'number') {
          object.rotation.x = (moving ? Math.sin(phase) : 0) * 0.55 * object.userData.walkLimb
        }
      })
    }
  }

}
