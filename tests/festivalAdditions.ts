import assert from 'node:assert/strict'
import { GameState } from '../src/game/GameState'
import { TRACK_PITCHES, canTransitionTrackPitch, createTrackPiece, computeTrackFrame, sampleCoasterTrack, usesWidePitchTransition, type Coaster, type TrackAnchor } from '../src/game/coasters'
import { createCoasterCar } from '../src/view/coasterCars'
import { campingBoundary } from '../src/view/campingGround'
import { bungeeDrop, createBungeeModel, animateBungee, setBungeeJumper } from '../src/view/bungee'
import { IncidentView, litterGroundOffset } from '../src/view/IncidentView'
import {
  WasteView,
  wasteBinCartonCount,
  wasteBinFillRatio,
} from '../src/view/WasteView'
import { Box3, InstancedMesh, Mesh, Vector3 } from 'three'
import type { PlacedBuilding } from '../src/game/GameState'
import { SIMULATION_CONFIG } from '../src/game/simulationConfig'
import { rollsBungeeNude, visitorLooksFemale } from '../src/game/rng'
import { applyGameCommand } from '../src/net/commands'
import { enableMultiplayerCommands } from '../src/net/bind'
import type { GameCommand } from '../src/net/protocol'

export function testFestivalAdditions(fixture: (n?: number) => GameState): void {
  const a: TrackAnchor = { x: 0, z: 0, elevation: 5, heading: 0, pitch: 0, bank: 0 }
  const tileSpan = (piece: ReturnType<typeof createTrackPiece>) =>
    Math.abs(piece.end.x - piece.start.x) + Math.abs(piece.end.z - piece.start.z)
  const halfGrid = (value: number) =>
    Math.abs(value * 2 - Math.round(value * 2)) < 1e-9
  for (const pitch of Object.values(TRACK_PITCHES)) {
    const p = createTrackPiece('transition', 'pitchTransition', a, true, { targetPitch: pitch })
    assert.ok(halfGrid(p.end.elevation), 'pitch transitions stay on the half-height grid')
    assert.equal(p.points.at(-1)!.y, p.end.elevation)
    assert.equal(tileSpan(p), usesWidePitchTransition(0, pitch) ? 4 : 1)
    const q = createTrackPiece('exit', 'pitchTransition', p.end, false, { targetPitch: 0 })
    assert.ok(halfGrid(q.end.elevation))
    assert.equal(q.end.pitch, 0, 'return-to-flat transitions must end horizontally')
    assert.equal(tileSpan(q), usesWidePitchTransition(p.end.pitch, 0) ? 4 : 1)
  }
  const gentle = createTrackPiece('gentle', 'slopeGentleUp', a, true)
  const steep = createTrackPiece('steep', 'slopeUp', a, true)
  assert.equal(tileSpan(gentle), 1, 'gentle climbs occupy one tile')
  assert.equal(tileSpan(steep), 1, 'steep climbs occupy one tile')
  assert.equal(gentle.end.elevation, 5.5)
  assert.equal(steep.end.elevation, 6)
  assert.equal(canTransitionTrackPitch(0, TRACK_PITCHES.steepUp), true)
  assert.equal(canTransitionTrackPitch(TRACK_PITCHES.gentleDown, TRACK_PITCHES.steepUp), false)
  const up = createTrackPiece('up', 'halfLoopUp', a, false)
  assert.equal(up.end.bank, Math.PI); assert.equal(up.end.elevation, 9)
  const down = createTrackPiece('down', 'halfLoopDown', up.end, false)
  assert.equal(down.end.bank, 0); assert.equal(down.end.elevation, 5)
  const loop = createTrackPiece('loop', 'verticalLoop', a, false)
  assert.equal(loop.end.elevation, a.elevation)
  assert.ok(computeTrackFrame({ x: 0, y: 0, z: -1 }, 0, Math.PI).up.y < -.99)
  const track = { pieces: [loop], closed: false } as Coaster
  assert.equal(sampleCoasterTrack(track, 1)!.pieceKind, 'verticalLoop')
  const length = sampleCoasterTrack(track, 0)!.totalLength
  let previousUp = sampleCoasterTrack(track, 0)!.up
  for (let i = 1; i <= 128; i++) {
    const current = sampleCoasterTrack(track, length * i / 128)!
    assert.ok(previousUp.x * current.up.x + previousUp.y * current.up.y + previousUp.z * current.up.z > .9, 'loop frames must not flip at vertical tangents')
    previousUp = current.up
  }
  track.pieces.push(createTrackPiece('photo', 'photo', loop.end, false))
  assert.ok(sampleCoasterTrack(track, 0)!.totalLength > length)
  assert.equal(sampleCoasterTrack(track, length + 1)!.pieceKind, 'photo')
  const construction = fixture(0)
  construction.addDebugMoney()
  const started = construction.startCoaster('classicSteel', 10, -10)
  assert.ok(started.ok, started.message)
  const stationEnd = construction.getCoaster(started.id!)!.pieces[0]!.end
  const firstClimb = createTrackPiece('first-climb', 'slopeGentleUp', stationEnd, true)
  assert.equal(firstClimb.end.pitch, TRACK_PITCHES.gentleUp)
  assert.ok(
    firstClimb.points.every((point) => point.y >= stationEnd.elevation - 1e-6),
    `first climb must not dive below the station (${firstClimb.points.map((p) => p.y.toFixed(3)).join(',')})`,
  )
  const firstClimbBuild = construction.appendCoasterPiece(started.id!, 'slopeGentleUp', true)
  assert.ok(firstClimbBuild.ok, `first gentle climb: ${firstClimbBuild.message}`)
  assert.ok(
    firstClimbBuild.ok &&
      construction.getCoaster(started.id!)!.pieces[1]!.end.elevation > stationEnd.elevation,
    'first climb rises above the station',
  )
  assert.ok(construction.undoCoasterPiece(started.id!).ok)
  assert.ok(
    construction.appendCoasterPiece(started.id!, 'pitchTransition', true, 0, {
      targetPitch: TRACK_PITCHES.steepUp,
    }).ok,
    'flat to steep may use the wide transition',
  )
  assert.equal(
    construction.appendCoasterPiece(started.id!, 'pitchTransition', false, 1, {
      targetPitch: TRACK_PITCHES.steepDown,
    }).ok,
    false,
    'steep up cannot jump to steep down',
  )
  assert.ok(construction.undoCoasterPiece(started.id!).ok)
  for (const kind of ['verticalLoop', 'photo', 'splash', 'brakes', 'sBendLeft'] as const) {
    const result = construction.appendCoasterPiece(started.id!, kind, false)
    assert.ok(result.ok, `${kind}: ${result.message}`)
  }
  const physicalSpeed = (kind: 'straight' | 'brakes' | 'splash' | 'photo') => {
    const g = fixture(1), result = g.startCoaster('classicSteel', 10, -10), coaster = g.getCoaster(result.id!)!
    const piece = createTrackPiece('effect', kind, a, false)
    const tail = createTrackPiece('tail', 'straight', piece.end, false)
    tail.end.z += 60; tail.points.at(-1)!.z += 60
    coaster.pieces = [piece, tail]; coaster.closed = false
    coaster.train.state = 'running'; coaster.train.distance = .5; coaster.train.speed = 20
    coaster.train.passengerIds = [g.snapshot.visitors[0]!.id]; coaster.train.passengers = 1
    const before = g.snapshot.money
    ;(g as any).integrateTrainPhysics(coaster, .05)
    if (kind === 'photo') {
      assert.equal(g.snapshot.money, before + 2)
      ;(g as any).integrateTrainPhysics(coaster, .05)
      assert.equal(g.snapshot.money, before + 2, 'only one photo charge per passage')
    }
    return coaster.train.speed
  }
  const normalSpeed = physicalSpeed('straight')
  assert.ok(physicalSpeed('brakes') < normalSpeed)
  assert.ok(physicalSpeed('splash') < normalSpeed)
  physicalSpeed('photo')
  assert.ok(SIMULATION_CONFIG.coasters.classicSteel.physics.chainSpeed >= 6)
  assert.ok(SIMULATION_CONFIG.coasters.classicSteel.physics.stationLaunchSpeed >= 12)
  const dropGame = fixture(1)
  const dropStart = dropGame.startCoaster('classicSteel', 10, -10)
  const dropCoaster = dropGame.getCoaster(dropStart.id!)!
  const drop = createTrackPiece('drop', 'slopeDown', a, false)
  const dropTail = createTrackPiece('drop-tail', 'straight', drop.end, false)
  dropTail.end.z += 40
  dropTail.points.at(-1)!.z += 40
  dropCoaster.pieces = [drop, dropTail]
  dropCoaster.closed = false
  dropCoaster.train.state = 'running'
  dropCoaster.train.distance = 0.2
  dropCoaster.train.speed = 5
  ;(dropGame as any).integrateTrainPhysics(dropCoaster, 0.5)
  assert.ok(dropCoaster.train.speed > 7, 'drops should accelerate instead of crawling')
  const car = createCoasterCar(0x2876c7)
  const other = createCoasterCar(0x2876c7)
  const carMeshes: Mesh[] = []
  car.traverse((object) => {
    if (object instanceof Mesh) carMeshes.push(object)
  })
  assert.equal(carMeshes.length, 1, 'car body is one merged mesh')
  assert.equal(carMeshes[0]!.geometry, (other.children[0] as Mesh).geometry, 'cars reuse geometry')
  assert.ok(carMeshes[0]!.geometry.userData.shared)
  assert.equal(campingBoundary([{x:0,z:0},{x:1,z:0}]).length, 6)
  const ring = Array.from({length:9}, (_,i)=>({x:i%3,z:Math.floor(i/3)})).filter(c=>c.x!==1||c.z!==1)
  assert.equal(campingBoundary(ring).length, 12, 'no interior tile or enclosed-hole borders')

  const game = fixture(2), s = game.snapshot
  ;(s as any).money = 100000
  assert.ok(game.placeSceneryLine('bunting', [{x:10,z:0},{x:11,z:0},{x:10,z:0}], 2).ok)
  assert.equal(s.buildings.filter(b=>b.kind==='bunting').length, 2)
  assert.ok(s.buildings.filter(b=>b.kind==='bunting').every(b=>b.decorationSlot===2))
  assert.equal(game.placeSceneryLine('ride', [{x:12,z:0}], 0).ok, false)
  game.manageFestival({type:'ground',x:14,z:0,kind:'drain'})
  game.manageFestival({type:'ground',x:14,z:0,kind:'compact'})
  game.manageFestival({type:'ground',x:14,z:0,kind:'pave'})
  const built = game.placeBungee(14, 0, 32)
  assert.ok(built.ok, built.message)
  const tower = s.buildings.at(-1)!
  assert.equal(tower.rideType, 'bungee')
  assert.ok(game.setRideAccess(tower.id,'entrance',14,-1).ok)
  assert.ok(game.setRideAccess(tower.id,'exit',15,0).ok)
  assert.ok(game.placePathSegment(14,-2,0,'queue').ok)
  assert.ok(game.placePathSegment(16,0,0).ok)
  const money = s.money
  assert.ok(game.setBungeeHeight(tower.id, 40).ok)
  assert.equal(s.money, money - 200)
  assert.equal(game.setBungeeHeight(tower.id, Infinity).ok, false)
  const [v, w] = s.visitors
  v!.targetId = tower.id; w!.targetId = tower.id
  ;(game as any).startFacilityInteraction(v, tower)
  ;(game as any).startFacilityInteraction(w, tower)
  assert.equal(v!.state, 'using'); assert.equal(w!.state, 'queuing')
  assert.equal(game.setBungeeHeight(tower.id, 50).ok, false)
  ;(game as any).finishInteraction(v)
  assert.equal(v!.needs.fun, 100)
  assert.equal(v!.bungeeNude, false)
  ;(game as any).startFacilityInteraction(w, tower)
  assert.equal(w!.state, 'using')
  const restored = GameState.fromJSON(JSON.stringify(s))!
  assert.equal(restored.snapshot.buildings.find(b=>b.id===tower.id)!.bungeeHeight, 40)
  const model = createBungeeModel(40)
  assert.equal(model.children.length, 3, 'bounded tower draw calls')
  setBungeeJumper(model, { id: v!.id, color: v!.color })
  assert.ok(model.userData.bungee.jumper.children.length > 0, 'the rope carries the guest model')
  setBungeeJumper(model, { id: v!.id, color: v!.color, bungeeNude: true })
  assert.ok(model.userData.bungee.jumper.children.length > 0)
  setBungeeJumper(model, null)
  assert.equal(model.userData.bungee.jumper.children.length, 0)
  animateBungee(model, .25); const high = model.userData.bungee.jumper.position.y
  animateBungee(model, .48); assert.ok(model.userData.bungee.jumper.position.y < high - 5)
  animateBungee(model, null); assert.equal(model.userData.bungee.jumper.visible, false)
  assert.ok(bungeeDrop(.48) > bungeeDrop(.6), 'rope rebounds')
  const femaleId = Array.from({ length: 40 }, (_, index) => `guest-${index}`).find(visitorLooksFemale)
  const maleId = Array.from({ length: 40 }, (_, index) => `guest-${index}`).find((id) => !visitorLooksFemale(id))
  assert.equal(rollsBungeeNude(femaleId!, 0.05, 0.1), true)
  assert.equal(rollsBungeeNude(femaleId!, 0.5, 0.1), false)
  assert.equal(rollsBungeeNude(maleId!, 0.05, 0.1), true)
  assert.equal(rollsBungeeNude(maleId!, 0, 1), true)

  s.incidents.push({id:'debug-trash',kind:'litter',x:0,z:0} as any, {id:'debug-fire',kind:'fire',x:1,z:1} as any)
  s.campInstallations.push({id:'old',ownerId:'missing',contributorIds:[],kind:'tent',cell:{x:1,z:1},decay:0} as any)
  v!.pendingWaste = 2
  assert.ok(applyGameCommand(game,{type:'clearWasteForDebug'}).ok)
  assert.equal(s.incidents.some(i=>i.id==='debug-trash'),false)
  assert.equal(s.incidents.some(i=>i.id==='debug-fire'),true)
  assert.equal(s.campInstallations.some(c=>c.id==='old'),false)
  assert.equal(v!.pendingWaste,0)
  const client = fixture(0), sent: GameCommand[] = []
  client.manageFestival({type:'ground',x:14,z:0,kind:'drain'})
  client.manageFestival({type:'ground',x:14,z:0,kind:'compact'})
  client.manageFestival({type:'ground',x:14,z:0,kind:'pave'})
  client.networkMode='client'; enableMultiplayerCommands(client); client.commandOutbox = c=>sent.push(c)
  client.placeBungee(14,0,24)
  assert.equal(sent.length,1); assert.equal(sent[0]!.type,'placeBungee')
  assert.equal(client.snapshot.buildings.at(-1)!.bungeeHeight,24)
  const firstScrap=litterGroundOffset('pile-a',0)
  assert.deepEqual(litterGroundOffset('pile-a',0),firstScrap,'litter offsets stay fixed for the same scrap')
  assert.notDeepEqual(litterGroundOffset('pile-a',3),firstScrap,'later scraps land elsewhere on the tile')
  assert.ok(Math.hypot(firstScrap.x,firstScrap.z)<0.42,'scraps stay on their cell')
  const litterView=new IncidentView()
  const pile={id:'pile-a',kind:'litter' as const,x:2,z:3,elevation:0,severity:1,ageMinutes:0}
  litterView.update([pile])
  let litterMeshes=0
  litterView.group.traverse((object)=>{if(object instanceof Mesh)litterMeshes+=1})
  assert.equal(litterMeshes,1,'one draw call per litter pile')
  const light=new Box3().setFromObject(litterView.group.children[0]!)
  litterView.update([{...pile,severity:8}])
  litterMeshes=0
  litterView.group.traverse((object)=>{if(object instanceof Mesh)litterMeshes+=1})
  assert.equal(litterMeshes,1,'heavy litter still shares one mesh')
  const heavy=new Box3().setFromObject(litterView.group.children[0]!)
  const lightSize=light.getSize(new Vector3())
  const heavySize=heavy.getSize(new Vector3())
  assert.ok(
    heavySize.x>lightSize.x+0.12 || heavySize.z>lightSize.z+0.12,
    'heavy litter spreads across the tile instead of stacking',
  )
  assert.equal(wasteBinFillRatio(0, SIMULATION_CONFIG.waste.binCapacity), 0)
  assert.equal(
    wasteBinFillRatio(
      SIMULATION_CONFIG.waste.binCapacity,
      SIMULATION_CONFIG.waste.binCapacity,
    ),
    1,
  )
  assert.equal(wasteBinCartonCount(0), 0, 'empty bins stay clear')
  assert.equal(wasteBinCartonCount(1), 1, 'any waste shows the first carton')
  assert.equal(wasteBinCartonCount(6), 2, 'half-full bins stay a coarse pile')
  assert.equal(wasteBinCartonCount(12), 4, 'a full bin reaches four cartons')
  assert.ok(
    wasteBinCartonCount(12) > wasteBinCartonCount(6),
    'fuller bins read as more cartons, not a finer count',
  )
  const emptyBin: PlacedBuilding = {
    id: 'bin-empty',
    kind: 'wasteBin',
    x: 1,
    z: 2,
    rotation: 0,
    elevation: 0,
    price: 0,
    wasteFill: 0,
  }
  const halfBin: PlacedBuilding = {
    ...emptyBin,
    id: 'bin-half',
    x: 3,
    wasteFill: 6,
  }
  const fullBin: PlacedBuilding = {
    ...emptyBin,
    id: 'bin-full',
    x: 4,
    wasteFill: SIMULATION_CONFIG.waste.binCapacity,
  }
  const wasteView = new WasteView()
  wasteView.update([], [emptyBin])
  assert.equal(wasteView.group.children.length, 0, 'empty bins add no overlay')
  wasteView.update([], [emptyBin, halfBin, fullBin])
  const cartonBatch = wasteView.group.children[0] as InstancedMesh
  assert.ok(cartonBatch instanceof InstancedMesh, 'cartons share one instance batch')
  assert.equal(
    cartonBatch.count,
    wasteBinCartonCount(6) + wasteBinCartonCount(12),
    'only bins with waste contribute cartons',
  )
  wasteView.group.traverse((object) => {
    assert.ok(!(object instanceof Mesh) || object instanceof InstancedMesh)
  })
  assert.equal(wasteView.group.children.length, 1, 'no fill bar or per-carton meshes')
  console.log('PASS one-tile coaster slopes, flat-to-steep clothoids, car meshes, inversions, camping perimeter, scenery lines, bungee and debug cleanup')
}
