import { listenerFromCamera, type AudioListenerPose } from '../game/audio'
import { FacadeReveal } from './facadeReveal'
import { isDecorationCatalogKind } from '../game/decoration'
import { createWayStructure, indexWayStructures, wayStructurePlan, type WayStructureCell } from './wayStructures'
import { pathFurnitureRotation } from '../game/pathFurniture'
import { isWasteBin } from '../game/decorationWalls'
import { isSealedWasteContainer } from '../game/waste'
import { wallSpec, isFacade } from '../game/decorationWalls'
import { updateStageBand } from './stageBand'
import { isScenery, isEdgeScenery, scenerySlot, sceneryTransform } from '../game/scenery'
import { createRetroBuilding, batchRetroBuildings } from './retroBuildings'
import {
  createLogisticsFacility,
  createSupplyStructure,
  LOGISTICS_FACILITY_KINDS,
  logisticsThumbnailScale,
  type LogisticsFacilityKind,
  type SupplyStructureKind,
} from './logisticsModels'
import {
  accessIdFromObject,
  buildingIdFromObject,
  cellFromWorldPoint,
  resolvePickedBuilding,
} from './picking'
import { createAttractionAccess } from './attractionAccess'
import type { AccessKind, AccessTheme } from './attractionAccess'
import { bindTouchCamera } from './touchCamera'
import { createStageModel, animateStageModel, updateStageLightPool } from './stageModel'
import { stageApronCells, stagePhase, stageSize, occupiesBuildingCell, fohDeskRole, MAX_STAGE_FORECOURT_DEPTH, STAGE_TILE_DETAIL } from '../game/stageDesign'
import { activeBookings, showIssue } from '../game/festivalManagement'
import { createEarthTexture, createTerrainBase, createTerrainMaterial, createTerrainSurface } from './terrainSurface'
import { TerrainShape, terrainPads } from './terrainShape'
import { FestivalLightsView } from './FestivalLightsView'
import { AccessControlView } from './AccessControlView'
import { CourseView } from './CourseView'
import { AttractionView } from './AttractionView'
import { createRoadDirectionArrowGeometry } from './roadDirectionArrow'
import { wayTexture } from './wayTextures'
import type { WayType } from '../game/wayTypes'
import { wayInfo } from '../game/wayTypes'
import { groundRectangle } from '../game/ground'
import { groundInfo } from '../game/ground'
import { SupplyChainView } from './SupplyChainView'
import { scenePixelRatio } from './renderResolution'
import { isTextEntryTarget } from '../uiFocus'
import type { AreaDesignationHandler } from '../ui/areaDesignation'
import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  DynamicDrawUsage,
  GridHelper,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  LineSegments,
  Float32BufferAttribute,
  Matrix4,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  SpotLight,
  Raycaster,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TubeGeometry,
  Vector2,
  Frustum,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { BUILDINGS, WORLD_SIZE, isCopyTool, isRoadBuildTool, isTerrainEditTool } from '../game/catalog'
import type { BlueprintGhost } from '../game/blueprints'
import type { BuildingKind } from '../game/catalog'
import { SIMULATION_CONFIG } from '../game/simulationConfig'
import type { RoadCell } from '../game/logistics'
import { isFestivalOfferActive } from '../game/dayPlan'
import {
  computeTrackFrame,
  getCoasterType,
  getSmoothedCoasterPiecePoints,
  sampleCoasterTrack,
  smoothTrackDisplayPoints,
  type CoasterTrackStyleId,
  type CoasterTypeId,
  type TrackPieceKind,
} from '../game/coasters'
import { createBungeeModel, animateBungee, setBungeeJumper } from './bungee'
import { createNudeAnatomy, createPersonGeometry, PersonDetailsView, personSeed, personStyle } from './pixelPeople'
import { SouvenirPropsView } from './souvenirMeshes'
import { mascotVariant } from '../game/shopGoods'
import { createCoasterSpecial } from './coasterSpecials'
import { createStyledCoasterTrackPiece } from './coasterTrack'
import { coasterConstructionPreviewKey } from '../game/coasterConstructionUI'
import { createCoasterCar, getCoasterCarSeats } from './coasterCars'
import type { Coaster, TrackPoint } from '../game/coasters'
import type { CashEffect, GameSnapshot, PlacedBuilding, Visitor } from '../game/GameState'
import { usesGateEdgePlacement } from '../game/accessControl'
import { queueDirectionVector, stallQueueLaneOffset } from '../game/queueLanes'
import { CampingView } from './CampingView'
import { FireworksView } from './FireworksView'
import { FestivalEquipmentView } from './FestivalEquipmentView'
import { CrowdingView } from './CrowdingView'
import { PanicView } from './PanicView'
import { visitorBubbleKind } from '../game/visitorBubbles'
import { StaffView } from './StaffView'
import { MedicalView } from './MedicalView'
import { IncidentView } from './IncidentView'
import { PathFlowView } from './PathFlowView'
import { AtmosphereView } from './AtmosphereView'
import { ForecourtView } from './ForecourtView'
import {
  disposeChildren,
  disposeObject3D,
} from './disposeObject3D'
import { LogisticsView } from './LogisticsView'
import { zoneCellRange, zoneKey } from '../game/staffZones'
import { WasteView } from './WasteView'
import { BackstageView } from './BackstageView'
import { BandActorView } from './BandActorView'
import { PowerView } from './PowerView'
import { LaserView } from './LaserView'
import {
  getTerrainHeight,
  getWaterLevel,
  terrainFingerprint,
  tileShowsWater,
} from '../game/terrain'
import { supportGap, tileSupportSolids, isSupportlessKind } from '../game/supportOccupancy'
import { lightViewOf, type LightView } from './lightSelection'
import { attachSupportPosts, DEFAULT_SUPPORT_OFFSETS } from './supports'
import { wayOverlapsRoadGrade } from '../game/wayElevation'
import {
  placementGroundCell, draggedBuildElevation, buildElevationAbove,
  showsPlacementGroundMarker,
} from '../game/placementPreview'
import type { PlacementPreviewResult } from '../game/placementPreview'

export type CellPosition = { x: number; z: number; localX?: number; localZ?: number; buildingId?: string }
export type PathAnchor = CellPosition & { elevation: number }

function stageFocusPoint(stage: PlacedBuilding): { x: number; z: number } {
  const size = stageSize(stage.stageDesign, stage.rotation)
  return { x: stage.x + size.width / 2, z: stage.z + size.depth / 2 }
}

function danceFloorFacing(
  cell: { x: number; z: number },
  concertId: string | null,
  floorStageIds: Map<string, string | undefined>,
  stageFocus: Map<string, { x: number; z: number }>,
): number | null {
  const key = `${cell.x},${cell.z}`
  if (!floorStageIds.has(key) && !concertId) return null
  const stageId = floorStageIds.get(key)
  let focus = stageId ? stageFocus.get(stageId) : undefined
  if (!focus) {
    let nearest = Number.POSITIVE_INFINITY
    for (const candidate of stageFocus.values()) {
      const distance = Math.hypot(cell.x + 0.5 - candidate.x, cell.z + 0.5 - candidate.z)
      if (distance >= nearest) continue
      nearest = distance
      focus = candidate
    }
    if (!focus || nearest > 10) return null
  }
  return Math.atan2(focus.x - (cell.x + 0.5), focus.z - (cell.z + 0.5))
}

type CellHandler = (cell: CellPosition) => void
type HoverHandler = (cell: CellPosition | null) => void
type VisitorHandler = (visitorId: string) => void
type ElevationHandler = (delta: number) => void
type DragEndHandler = () => void
type CoasterPieceHandler = (coasterId: string, pieceIndex: number) => void

const CONSTRUCTION_GRID_CELLS = 7
const GROUND_ONLY_TOOLS = new Set([
  'inspect',
  'bulldoze',
  'terrainRaise',
  'terrainLower',
  'terrainFlatten',
  'terrainRaiseCorner',
  'terrainLowerCorner',
  'terrainWater',
  'terrainSmooth',
  'camping',
  'medicalArea',
  'stageForecourt',
  'wasteDump',
  'powerCable',
  'copy',
])

function usesConstructionHeight(tool?: string): boolean {
  return tool != null && !GROUND_ONLY_TOOLS.has(tool)
}

function createConstructionGrid(): LineSegments {
  const cells = CONSTRUCTION_GRID_CELLS
  const half = cells / 2
  const positions = new Float32Array((cells + 1) * 4 * 3)
  let index = 0
  for (let n = 0; n <= cells; n++) {
    const t = n - half
    positions[index++] = -half
    positions[index++] = 0
    positions[index++] = t
    positions[index++] = half
    positions[index++] = 0
    positions[index++] = t
    positions[index++] = t
    positions[index++] = 0
    positions[index++] = -half
    positions[index++] = t
    positions[index++] = 0
    positions[index++] = half
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  const grid = new LineSegments(
    geometry,
    new LineBasicMaterial({
      color: 0xf2e08a,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    }),
  )
  grid.visible = false
  grid.renderOrder = 9
  grid.frustumCulled = false
  return grid
}

function createGroundTileMarker(): Group {
  const group = new Group()
  const half = 0.48
  const outlineGeometry = new BufferGeometry()
  outlineGeometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [
        -half, 0, -half, half, 0, -half,
        half, 0, -half, half, 0, half,
        half, 0, half, -half, 0, half,
        -half, 0, half, -half, 0, -half,
      ],
      3,
    ),
  )
  const outline = new LineSegments(
    outlineGeometry,
    new LineBasicMaterial({
      color: 0xfff2a8,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
    }),
  )
  outline.renderOrder = 11
  outline.frustumCulled = false
  const fill = new Mesh(
    new PlaneGeometry(0.96, 0.96),
    new MeshBasicMaterial({
      color: 0xffe566,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide,
    }),
  )
  fill.rotation.x = -Math.PI / 2
  fill.renderOrder = 10
  fill.frustumCulled = false
  group.add(fill, outline)
  group.visible = false
  group.frustumCulled = false
  return group
}

const WALK_EYE_HEIGHT = 0.68
const WALK_SPEED = 2.8
const WALK_RUN_SPEED = 5.6
const WALK_LOOK_SENSITIVITY = 0.0024
const WALK_BLOCKED_KINDS = new Set<string>([
  'food', 'toilet', 'ride', 'alcohol', 'mascot', 'shirt', 'securityGate', 'tree', 'hedge', 'shrub', 'rock', 'statue',
  'picnicTable', 'parasol', 'fence', 'stage', 'directionalSpeaker', 'omniSpeaker', 'ambulanceGarage',
  'busStop', 'busDepot', 'wasteDepot', 'specialDepot', 'generator', 'backupGenerator', 'foh', 'delayTower',
  'videoWall', 'laserShow', 'fireworkBattery', 'tourBusParking',
])
export type PersonPreviewMode = 'map' | 'front'
/**
 * The little window on one person in the info panels. It is drawn by the game's own
 * renderer — a corner of the main canvas is rendered from the preview camera and
 * copied over — rather than by a renderer of its own: a second WebGL context would
 * have to compile every shader and upload every geometry of the scene again, which
 * on a full site is a stall of seconds the moment someone is clicked.
 */
type PersonPreviewSlot = {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  mapCamera: OrthographicCamera
  frontCamera: PerspectiveCamera
  targetId: string | null
  kind: 'staff' | 'visitor'
  mode: PersonPreviewMode
  mapHeight: number
  frontDistance: number
}

export class WorldView {
  private readonly previewBufferSize = new Vector2()
  /**
   * One model per building, kept between rebuilds. A change to the site only
   * replaces the models it touches — the changed building and whatever stands next
   * to it, since paths, rails, supports and merged desks are shaped by their
   * neighbours — instead of throwing every model on the map away and building it
   * again, which on a full site was a stall of a good fraction of a second.
   */
  private buildingModels = new Map<string, { model: Group; key: string }>()
  /** Set when the ground itself changed: then every model has to be placed afresh. */
  private buildingModelsStale = true
  private shadersWarmed = false
  /** What the scene held when its shaders were last compiled ahead of time. */
  private warmedPopulation = ''
  private rideGates = new Group()
  private rideGatePreview = Object.assign(new Group(), {visible:false})

  setRideAccessPreview(access: {x:number;y:number;z:number;type:AccessKind;theme?:AccessTheme;valid:boolean;rotation:number} | null): void {
    if (!access) { this.rideGatePreview.visible=false; return }
    const theme = access.theme ?? 'carousel'
    const key = `${theme}:${access.type}`
    if (this.rideGatePreview.userData.modelKey !== key) {
      disposeChildren(this.rideGatePreview)
      this.rideGatePreview.add(createAttractionAccess(access.type, theme, true))
      this.rideGatePreview.userData.modelKey = key
    }
    this.rideGatePreview.visible=true
    this.rideGatePreview.position.set(access.x+.5,access.y,access.z+.5)
    this.rideGatePreview.rotation.y=access.rotation
    this.rideGatePreview.traverse(o=>{if(o instanceof Mesh){const m=o.material as MeshStandardMaterial;m.color.setHex(access.valid ? 0xffffff : 0xe05555)}})
  }
  private bungeeRiders = new Set<string>()
  private bungeeOccupants = new Map<string, string>()
  bungeePreviewHeight: number | null = null
  private canvas: HTMLCanvasElement
  private renderer: WebGLRenderer
  private scene = new Scene()
  private festivalLights = new FestivalLightsView()
  private ambientLight = new AmbientLight(0xffffff, 1.25)
  private sunLight = new DirectionalLight(0xfff1cf, 2.4)
  private nightSkyColor = new Color(0x071326)
  private daySkyColor = new Color(0x9ccbe0)
  private twilightSkyColor = new Color(0xd98262)
  private skyColor = new Color()
  private daylightColor = new Color(0xffffff)
  private nightAmbientColor = new Color(0x8ba6d8)
  private noonSunColor = new Color(0xfff1cf)
  private twilightSunColor = new Color(0xff9b68)
  private camera = new OrthographicCamera()
  private walkCamera = new PerspectiveCamera(68, 1, 0.06, 90)
  private walkMode = false
  private walkX = 0
  private walkZ = 0
  private walkYaw = 0
  private walkPitch = -0.12
  private walkKeys = new Set<string>()
  private walkStickX = 0
  private walkStickZ = 0
  private walkLookActive = false
  private walkModeListener: ((enabled: boolean) => void) | null = null
  private raycaster = new Raycaster()
  private pointer = new Vector2()
  private groundPlane = new Plane(new Vector3(0, 1, 0), 0)
  private worldSize = WORLD_SIZE
  private grid: GridHelper | null = null
  private terrainGroup = new Group()
  private terrainFingerprint = ''
  private groundSurfaceFingerprint = ''
  private terrainSurface: Mesh | null = null
  private terrainSurfaceMaterial = createTerrainMaterial()
  private terrainShape: TerrainShape | null = null
  /** The flattened foundations under the site's structures, as of the last terrain build. */
  private terrainPadKeys = new Set<string>()
  private actorTerrainHeight = (x: number, z: number, y: number): number => this.terrainShape?.actorHeight(x, z, y) ?? y
  private buildings = new Group()
  private facadeReveal: FacadeReveal | null = null
  private staticBuildingBatches = new Group()
  private treeTrunkGeometry = new CylinderGeometry(0.1, 0.14, 0.8, 8)
  private treeCrownGeometry = new ConeGeometry(0.52, 1.25, 9)
  private treeTrunkMaterial = new MeshStandardMaterial({ color: 0x795437 })
  private treeCrownMaterial = new MeshStandardMaterial({
    color: 0x438344,
    roughness: 0.95,
  })
  private hedgeMaterial = new MeshStandardMaterial({
    color: 0x3f7b42,
    roughness: 1,
  })
  private landMaterial = new MeshStandardMaterial({
    color: 0x8b8680,
    map: createEarthTexture(),
    side: DoubleSide,
    roughness: 0.95,
  })
  private landMesh: Mesh | null = null
  private waterMesh: InstancedMesh | null = null
  private waterGeometry = new PlaneGeometry(1, 1)
  private waterMaterial = new MeshStandardMaterial({
    color: 0x2f7ca8,
    roughness: 0.18,
    metalness: 0.12,
    transparent: true,
    opacity: 0.72,
  })
  private pathDragGeometry = new BoxGeometry(0.82, 0.1, 0.82)
  private pathDragMaterial = new MeshStandardMaterial({
    color: 0x75e49e,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  })
  private soundWaveGroups: Group[] = []
  private nightLightMaterials: MeshStandardMaterial[] = []
  private nightLightBuildingIds: string[] = []
  private readonly stageLightPool: SpotLight[] = []
  /** Where the camera looks this frame — what decides which sources get the real lights. */
  private readonly lightView: LightView = { frustum: new Frustum(), focus: new Vector3() }
  private powerView = new PowerView()
  private laserView = new LaserView()
  private festivalEquipmentView = new FestivalEquipmentView()
  private campingView = new CampingView()
  private fireworksView = new FireworksView()
  private crowdingView = new CrowdingView()
  private panicView = new PanicView()
  private staffView = new StaffView()
  private medicalView = new MedicalView()
  private wasteView = new WasteView()
  private incidentView = new IncidentView()
  private pathFlowView = new PathFlowView()
  private attractivenessView = new AtmosphereView(0.3, true)
  private partyMoodView = new AtmosphereView(0.82, false)
  private forecourtView = new ForecourtView()
  private backstageView = new BackstageView()
  private bandActorView = new BandActorView()
  private logisticsView = new LogisticsView()
  private courseView = new CourseView()
  private attractionView = new AttractionView()
  private accessControlView = new AccessControlView()
  private supplyChainView = new SupplyChainView()
  private logisticsMode = false
  private previousOverlays = [false, false, false]
  setLogisticsMode(enabled: boolean): void {
    const groups = [this.crowdingView.group, this.attractivenessView.group, this.partyMoodView.group]
    this.panicView.group.visible = !enabled
    if (enabled && !this.logisticsMode) { this.previousOverlays = groups.map(g => g.visible); this.followVisitor(null) }
    if (!enabled && this.logisticsMode) groups.forEach((g, n) => g.visible = this.previousOverlays[n]!)
    this.logisticsMode = enabled
    if (enabled && this.walkMode) this.setWalkMode(false)
  }
  private visitors = new Group()
  private visitorInstanceIds: string[] = []
  private visitorCapacity = 0
  private visitorBodyInstances: InstancedMesh | null = null
  private visitorFemaleBodyInstances: InstancedMesh | null = null
  private personDetails = new PersonDetailsView()
  private souvenirProps = new SouvenirPropsView()
  private visitorHeadInstances: InstancedMesh | null = null
  private visitorLeftLegInstances: InstancedMesh | null = null
  private visitorRightLegInstances: InstancedMesh | null = null
  private visitorLeftArmInstances: InstancedMesh | null = null
  private visitorRightArmInstances: InstancedMesh | null = null
  private visitorBreastInstances: InstancedMesh | null = null
  private visitorBustInstances: InstancedMesh | null = null
  private visitorPenisInstances: InstancedMesh | null = null
  private visitorPickMeshes: InstancedMesh[] = []
  private visitorPose = new Object3D()
  private visitorLimb = new Object3D()
  private visitorMatrix = new Matrix4()
  private visitorHiddenMatrix = new Matrix4().makeScale(0, 0, 0)
  private visitorColor = new Color()
  private visitorSkinColor = new Color(0xf0bd8c)
  private visitorPantsColor = new Color(0x31445b)
  private visitorPanicTint = new Color(0xc62828)
  private emotionInstances = new Map<string, InstancedMesh>()
  private emotionPose = new Object3D()
  private visitorHandcarts: Group[] = []
  private emotionTextures = new Map<string, CanvasTexture>()
  private cashTextures = new Map<number, CanvasTexture>()
  private visitorBodyGeometry = createPersonGeometry('body')
  private visitorFemaleBodyGeometry = createPersonGeometry('femaleBody')
  private visitorHeadGeometry = createPersonGeometry('head')
  private visitorLegGeometry = createPersonGeometry('leg')
  private visitorArmGeometry = createPersonGeometry('arm')
  private visitorBreastGeometry = createNudeAnatomy('breasts')
  private visitorBustGeometry = createNudeAnatomy('bust')
  private visitorPenisGeometry = createNudeAnatomy('penis')
  private visitorSkinMaterial = new MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.9,
  })
  private visitorLegMaterial = new MeshStandardMaterial({
    color: 0x31445b,
    roughness: 0.9,
  })
  private handcartBodyGeometry = new BoxGeometry(0.25, 0.13, 0.32)
  private handcartGearGeometry = new BoxGeometry(0.19, 0.15, 0.23)
  private handcartWheelGeometry = new CylinderGeometry(0.055, 0.055, 0.035, 8)
  private handcartHandleGeometry = new BoxGeometry(0.025, 0.025, 0.3)
  private handcartBodyMaterial = new MeshStandardMaterial({
    color: 0xb83e35,
    roughness: 0.8,
  })
  private handcartGearMaterial = new MeshStandardMaterial({
    color: 0x4f7c45,
    roughness: 0.95,
  })
  private handcartWheelMaterial = new MeshStandardMaterial({ color: 0x25282c })
  private handcartHandleMaterial = new MeshStandardMaterial({ color: 0x34383d })
  private coasterTracks = new Group()
  private coasterTrains = new Group()
  private coasterPreview = new Group()
  private coasterSelection = new Group()
  private coasterPreviewKey = ''
  private coasterSelectionKey = ''
  private trainModels = new Map<string, Group>()
  private trainVisitorsById = new Map<string, Visitor>()
  private trainForward = new Vector3()
  private trainRight = new Vector3()
  private trainUp = new Vector3()
  private trainRotationMatrix = new Matrix4()
  private cashEffects = new Group()
  private cashEffectModels = new Map<string, Sprite>()
  private preview: Mesh
  private previewArrow: Mesh
  private stageForecourtPreview: InstancedMesh
  private stageForecourtPreviewPose = new Object3D()
  private constructionGrid = createConstructionGrid()
  private groundTileMarker = createGroundTileMarker()
  private shiftHeightActive = false
  private shiftHeightY = 0
  private shiftStartElevation = 0
  private shiftLastElevation = 0
  private heightHandler: ((height: number, cell: CellPosition | null) => void) | null = null
  private rightClickHandler: ((cell: CellPosition | null, picked: CellPosition | null) => boolean) | null = null
  setConstructionHandlers(height: (height: number, cell: CellPosition | null) => void, rightClick: (cell: CellPosition | null, picked: CellPosition | null) => boolean): void {
    this.heightHandler = height; this.rightClickHandler = rightClick
  }
  private beginHeightDrag(y: number): void {
    this.shiftHeightActive = true
    this.shiftHeightY = y
    const snapshot = this.currentSnapshot, cell = this.hoveredCell
    let height = snapshot?.buildElevation ?? 0
    if (snapshot && cell) {
      const objects = snapshot.buildings.filter(b => occupiesBuildingCell(b, cell.x, cell.z))
      const roads = snapshot.logistics.roadCells.filter(r => r.x === cell.x && r.z === cell.z)
      const tops = objects.map(b => b.elevation + BUILDINGS[b.kind].height)
      for (const road of roads) tops.push((road.elevation ?? getTerrainHeight(snapshot.terrain, cell.x, cell.z)) + 1)
      if (tops.length) height = buildElevationAbove(Math.max(...tops), getTerrainHeight(snapshot.terrain, cell.x, cell.z))
    }
    this.shiftStartElevation = this.shiftLastElevation = height
    this.heightHandler?.(height, cell)
    this.updateConstructionGrid()
  }
  private sceneryPreview = new Group()
  private sceneryPreviewKind = ''
  private placementResult: PlacementPreviewResult | null = null

  setPlacementPreviewResult(result: PlacementPreviewResult | null): void {
    this.placementResult = result
    this.updatePreview()
  }

  buildingThumbnail(kind: BuildingKind): string {
    const scene = new Scene()
    scene.background = new Color(0x314943)
    const model = this.createBuildingModel(kind, 0)
    if ((LOGISTICS_FACILITY_KINDS as readonly string[]).includes(kind)) {
      model.scale.setScalar(logisticsThumbnailScale(kind as LogisticsFacilityKind))
    }
    scene.add(model, new AmbientLight(0xffffff, 2))
    const light = new DirectionalLight(0xfff0ce, 3)
    light.position.set(-3, 5, 4); scene.add(light)
    const camera = new OrthographicCamera(-.9, .9, .9, -.9, .1, 20)
    camera.position.set(3, 2.8, 4); camera.lookAt(0, .65, 0)
    return this.renderThumbnail(scene, model, camera)
  }

  supplyThumbnail(kind: SupplyStructureKind): string {
    const scene = new Scene()
    scene.background = new Color(0x314943)
    const model = createSupplyStructure(kind)
    scene.add(model, new AmbientLight(0xffffff, 2))
    const light = new DirectionalLight(0xfff0ce, 3)
    light.position.set(-3, 5, 4); scene.add(light)
    const camera = new OrthographicCamera(-.9, .9, .9, -.9, .1, 20)
    camera.position.set(3, 2.8, 4); camera.lookAt(0, .55, 0)
    return this.renderThumbnail(scene, model, camera)
  }

  coasterTrainThumbnail(typeId: CoasterTypeId): string {
    const type = getCoasterType(typeId)
    const scene = new Scene()
    scene.background = new Color(0x314943)
    const model = createCoasterCar(type.carColor, type.trainStyle, type.accentColor)
    scene.add(model, new AmbientLight(0xffffff, 2.1))
    const light = new DirectionalLight(0xfff0ce, 3.1)
    light.position.set(-2.4, 4.2, 3.4)
    scene.add(light)
    const hanging =
      type.trainStyle === 'invertV' || type.trainStyle === 'flying' || type.trainStyle === 'swinging'
    const camera = hanging
      ? new OrthographicCamera(-0.62, 0.62, 0.42, -0.82, 0.1, 20)
      : new OrthographicCamera(-0.55, 0.55, 0.55, -0.55, 0.1, 20)
    camera.position.set(0.86, hanging ? 0.22 : 0.52, 1.08)
    camera.lookAt(0, hanging ? -0.18 : 0.08, 0)
    return this.renderThumbnail(scene, model, camera)
  }

  private renderThumbnail(scene: Scene, model: Group, camera: OrthographicCamera): string {
    const target = new WebGLRenderTarget(96, 96)
    target.texture.colorSpace = this.renderer.outputColorSpace
    const shadowUpdate = this.renderer.shadowMap.needsUpdate
    const previousTarget = this.renderer.getRenderTarget()
    const pixels = new Uint8Array(96 * 96 * 4)
    try {
      this.renderer.setRenderTarget(target)
      this.renderer.render(scene, camera)
      this.renderer.readRenderTargetPixels(target, 0, 0, 96, 96, pixels)
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96
      const context = canvas.getContext('2d')!
      const data = context.createImageData(96, 96)
      for (let y = 0; y < 96; y++) data.data.set(pixels.subarray((95 - y) * 384, (96 - y) * 384), y * 384)
      context.putImageData(data, 0, 0)
      return canvas.toDataURL()
    } finally {
      this.renderer.setRenderTarget(previousTarget)
      this.renderer.shadowMap.needsUpdate = shadowUpdate
      target.dispose(); disposeObject3D(model, false)
    }
  }
  private constructionAnchor: Mesh
  private constructionNext: Mesh
  private constructionSlope: Mesh
  private pathDragPreview = new Group()
  private blueprintPreview = new Group()
  private groundAreaHandler: AreaDesignationHandler<CellPosition> | null = null
  private groundAreaStart: CellPosition | null = null
  private groundAreaEndKey = ''
  private groundAreaCancelled = false
  setGroundAreaTool(handler: AreaDesignationHandler<CellPosition> | null): void {
    this.groundAreaHandler = handler
    this.groundAreaStart = null
    this.groundAreaEndKey = ''
    this.setPathDragPreview([], 0)
  }
  private updateGroundAreaPreview(): void {
    const from = this.groundAreaStart, to = this.hoveredCell
    if (!from || !to || !this.currentSnapshot) return
    const key = `${to.x},${to.z}`
    if (key === this.groundAreaEndKey) return
    this.groundAreaEndKey = key
    this.setPathDragPreview(groundRectangle(this.currentSnapshot, from, to), 0)
    this.groundAreaHandler?.(from, to, true)
  }
  private onCellClick: CellHandler
  private onCellHover: HoverHandler
  private onStaffClick: VisitorHandler = () => {}
  private onVehicleClick: VisitorHandler = () => {}
  private onAccessControlClick: VisitorHandler = () => {}
  private accessAreaOverlay: InstancedMesh | null = null
  private accessAreaStamp = ''
  private followedStaffId: string | null = null
  private staffPreview: PersonPreviewSlot | null = null
  private visitorPreview: PersonPreviewSlot | null = null
  private workAreaOverlay: InstancedMesh | null = null
  private workAreaStamp = ''
  private workZonesOverlay: InstancedMesh | null = null
  private workZonesStamp = ''
  private staffZonePaintHandler: ((cell: CellPosition | null, phase: 'start' | 'move' | 'end') => void) | null = null
  private staffZonePainting = false
  private staffZonePaintKey = ''
  private staffZoneHoverKey = ''
  private staffZoneHoverOverlay: InstancedMesh | null = null
  private staffPlacementHandler: ((cell: CellPosition) => void) | null = null
  private staffPlacementPreview: Mesh | null = null
  private staffPlacementColor = 0x5ad4e5
  private onVisitorClick: VisitorHandler
  private onCellPaint: CellHandler
  private onElevationChange: ElevationHandler
  private onPathPaintStart: CellHandler
  private onPathPaintEnd: DragEndHandler
  private onCoasterPieceRightClick: CoasterPieceHandler
  private currentSnapshot: Readonly<GameSnapshot> | null = null
  private previousShowTime = 0
  private currentShowTime = 0
  private renderAlpha = 1
  private interpolatedTick = -1
  private previousVisitorPositions = new Map<string, { x: number; y: number; z: number }>()
  private currentVisitorPositions = new Map<string, { x: number; y: number; z: number }>()
  private visitorSeedCache = new Map<string, number>()
  private prevTrainDistance = new Map<string, number>()
  private currTrainDistance = new Map<string, number>()
  private buildingFingerprint = ''
  private lastGroundRevision = -1
  private cachedFootwayFingerprint = ''
  private coasterFingerprint = ''
  private wasteBins: PlacedBuilding[] = []
  private lastDayMinute = Number.NEGATIVE_INFINITY
  private lastPowerKey = ''
  private hoveredCell: CellPosition | null = null
  private cameraTarget = new Vector3(0, 0, 0)
  private cameraAngle = Math.PI / 4
  private cameraDistance = 24
  private zoom = 1
  private followedVisitorId: string | null = null
  private dragging = false
  private dragButton = -1
  private lastPointer = new Vector2()
  private pointerDown = new Vector2()
  private leftPointerDown = false
  private painting = false
  private pointerDownCell: CellPosition | null = null
  private sceneryDragLock: { slot: number; rotation: number } | null = null
  private lastPaintCell: CellPosition | null = null
  private constructionActive = false

  constructor(
    canvas: HTMLCanvasElement,
    onCellClick: CellHandler,
    onCellHover: HoverHandler,
    onVisitorClick: VisitorHandler,
    onCellPaint: CellHandler,
    onElevationChange: ElevationHandler,
    onPathPaintStart: CellHandler,
    onPathPaintEnd: DragEndHandler,
    onCoasterPieceRightClick: CoasterPieceHandler,
  ) {
    this.canvas = canvas
    this.onCellClick = onCellClick
    this.onCellHover = onCellHover
    this.onVisitorClick = onVisitorClick
    this.onCellPaint = onCellPaint
    this.onElevationChange = onElevationChange
    this.onPathPaintStart = onPathPaintStart
    this.onPathPaintEnd = onPathPaintEnd
    this.onCoasterPieceRightClick = onCoasterPieceRightClick
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    })
    // A restrained pixel grid at every display density, with a smaller GPU budget.
    this.renderer.setPixelRatio(scenePixelRatio(canvas.clientWidth, canvas.clientHeight))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.sortObjects = false
    this.renderer.debug.checkShaderErrors = false
    this.markSharedResources()
    this.scene.background = this.skyColor.copy(this.daySkyColor)

    const previewMaterial = new MeshStandardMaterial({
      color: 0x55dd88,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: DoubleSide,
    })
    const previewArrowMaterial = new MeshBasicMaterial({
      color: 0xf4f0de,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      depthTest: false,
      side: DoubleSide,
    })
    this.preview = new Mesh(new BoxGeometry(0.94, 0.12, 0.94), previewMaterial)
    this.stageForecourtPreview = new InstancedMesh(
      new BoxGeometry(0.92, 0.04, 0.92),
      new MeshBasicMaterial({
        color: 0x9c72c7,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      }),
      8 * MAX_STAGE_FORECOURT_DEPTH,
    )
    this.stageForecourtPreview.instanceMatrix.setUsage(DynamicDrawUsage)
    this.stageForecourtPreview.count = 0
    this.stageForecourtPreview.visible = false
    this.previewArrow = new Mesh(
      createRoadDirectionArrowGeometry('paint'),
      previewArrowMaterial,
    )
    this.previewArrow.renderOrder = 12
    this.constructionAnchor = new Mesh(
      new BoxGeometry(0.72, 0.18, 0.72),
      new MeshStandardMaterial({ color: 0x38c6ef, transparent: true, opacity: 0.72 }),
    )
    this.constructionNext = new Mesh(
      new BoxGeometry(0.78, 0.2, 0.78),
      new MeshStandardMaterial({ color: 0xffc34a, transparent: true, opacity: 0.72 }),
    )
    this.constructionSlope = new Mesh(
      new BoxGeometry(0.78, 0.1, Math.sqrt(2)),
      new MeshStandardMaterial({
        color: 0xffc34a,
        transparent: true,
        opacity: 0.64,
        depthWrite: false,
      }),
    )
    this.preview.visible = false
    this.previewArrow.visible = false
    this.constructionAnchor.visible = false
    this.constructionNext.visible = false
    this.constructionSlope.visible = false
    this.scene.add(
      this.rideGates,
      this.rideGatePreview,
      this.preview,
      this.stageForecourtPreview,
      this.constructionGrid,
      this.groundTileMarker,
      this.sceneryPreview,
      this.constructionAnchor,
      this.constructionNext,
      this.constructionSlope,
      this.pathDragPreview,
      this.blueprintPreview,
      this.campingView.group,
      this.fireworksView.group,
      this.crowdingView.group,
      this.panicView.group,
      this.medicalView.group,
      this.wasteView.group,
      this.pathFlowView.group,
      this.incidentView.group,
      this.staffView.group,
      this.forecourtView.group,
      this.backstageView.group,
      this.bandActorView.group,
      this.attractivenessView.group,
      this.partyMoodView.group,
      this.logisticsView.group,
      this.courseView.group,
      this.attractionView.group,
      this.accessControlView.group,
      this.supplyChainView.group,
      this.powerView.group,
      this.laserView.group,
      this.festivalEquipmentView.group,
      this.terrainGroup,
      this.festivalLights.group,
      this.buildings,
      this.visitors,
      this.coasterTracks,
      this.coasterTrains,
      this.coasterPreview,
      this.coasterSelection,
      this.cashEffects,
      this.previewArrow,
    )

    this.createWorld()
    this.bindEvents()
    this.resize()
    this.updateCamera()
  }

  private lastVisualSnapshot: Readonly<GameSnapshot> | null = null
  private lastVisualRevision = ''

  update(snapshot: Readonly<GameSnapshot>, renderAlpha = 1, worldRevision?: number): void {
    if (isDecorationCatalogKind(snapshot.selectedTool)) this.facadeReveal?.reset()
    const revision = `${snapshot.simTick}:${worldRevision}:${snapshot.selectedTool}:${this.logisticsMode}:${this.crowdingView.group.visible}:${this.attractivenessView.group.visible}:${this.partyMoodView.group.visible}`
    const dataChanged = worldRevision === undefined || snapshot !== this.lastVisualSnapshot || revision !== this.lastVisualRevision
    this.lastVisualSnapshot = snapshot
    this.lastVisualRevision = revision
    if (dataChanged && (worldRevision === undefined || worldRevision !== this.lastGroundRevision)) {
      this.lastGroundRevision = worldRevision ?? this.lastGroundRevision
      this.cachedFootwayFingerprint = JSON.stringify(Object.entries(snapshot.festival.infrastructure.ground).filter(([, g]) => g.footway).map(([k, g]) => [k, g.footway]))
      this.groundSurfaceFingerprint = JSON.stringify(Object.entries(snapshot.festival.infrastructure.ground).filter(([, g]) => g.compacted || g.surface).map(([k, g]) => [k, g.compacted, g.surface]))
    }
    const fingerprint = dataChanged ? this.buildingFingerprintOf(snapshot.buildings) + this.cachedFootwayFingerprint + JSON.stringify(snapshot.logistics.roadCells.map(r => [r.x,r.z,r.elevation,r.roadSlope,r.roadSlopeDirection])) : this.buildingFingerprint

    this.currentSnapshot = snapshot
    this.syncInterpolation(snapshot, renderAlpha)
    this.syncWorldSize(snapshot.scenario?.worldSize ?? WORLD_SIZE)
    if (dataChanged) this.rebuildTerrainIfNeeded(snapshot)
    if (this.walkMode) {
      this.snapWalkHeight()
      this.applyWalkCamera()
    }
    if (this.grid) {
      this.grid.visible =
        !this.walkMode &&
        snapshot.selectedTool !== 'inspect' &&
        snapshot.selectedTool !== 'bulldoze'
    }
    if (dataChanged) this.festivalLights.update(snapshot)
    lightViewOf(this.walkMode ? this.walkCamera : this.camera, this.walkMode ? this.walkCamera.position : this.cameraTarget, this.lightView)
    this.festivalLights.setView(this.lightView)
    const cursorCell = this.hoveredCell
    this.festivalLights.updateCursor(cursorCell ? new Vector3(cursorCell.x + (cursorCell.localX ?? .5), this.terrainShape?.sample(cursorCell.x + (cursorCell.localX ?? .5), cursorCell.z + (cursorCell.localZ ?? .5)) ?? 0, cursorCell.z + (cursorCell.localZ ?? .5)) : null)
    if (fingerprint !== this.buildingFingerprint) {
      this.buildingFingerprint = fingerprint
      this.rebuildBuildings(snapshot.buildings)
      // Shaders compile the first time something is drawn. Whatever the main camera
      // has never had in view is still uncompiled when a preview camera looks at it,
      // and that compile used to land as a stall on the click that opened the panel.
      // Compiling the scene once, while the site is still loading, moves it to a
      // moment nobody is waiting for; anything built later is drawn by the main
      // camera as it is placed, and compiles then.
      if (!this.shadersWarmed) {
        this.shadersWarmed = true
        this.renderer.compile(this.scene, this.camera)
      }
      this.wasteBins = snapshot.buildings.filter(
        (building) => isWasteBin(building.kind),
      )
      this.lastPowerKey = ''
      this.renderer.shadowMap.needsUpdate = true
    }
    this.updateDayNight(snapshot)
    const stageBookings = new Map(activeBookings(snapshot).map(b=>[b.stageId,b]))
    for (const model of this.buildings.children) {
      if(!model.userData.isStage)continue
      const design = model.userData.stageDesign
      const booking = stageBookings.get(model.userData.buildingId)
      const active = snapshot.power.poweredBuildingIds.includes(model.userData.buildingId) && (snapshot.festival.enabled ? !!booking && !showIssue(snapshot,booking) : this.isShowPerforming(snapshot))
      const progress = booking ? (snapshot.minute-booking.start)/booking.duration : (snapshot.minute%120)/120
      const showTime=this.previousShowTime+(this.currentShowTime-this.previousShowTime)*this.renderAlpha
      if(design)animateStageModel(model as Group,stagePhase(design,progress),showTime,active)
      updateStageBand(model as Group,booking?.bandId,showTime,active,design)
    }
    updateStageLightPool(
      this.buildings.children.filter(m=>m.userData.stageDesign) as Group[],
      this.stageLightPool,
      this.lightView,
    )
    if (dataChanged) this.campingView.update(snapshot)
    if (dataChanged) this.medicalView.update(snapshot)
    if (dataChanged) this.wasteView.update(snapshot.wasteDumpCells ?? [], this.wasteBins)
    if (dataChanged) this.pathFlowView.update(snapshot.buildings)
    this.incidentView.update(snapshot.incidents)
    this.staffView.update(snapshot.staff, this.renderAlpha, snapshot.simTick, this.actorTerrainHeight)
    if (dataChanged) this.forecourtView.update(snapshot.stageForecourtCells)
    if (dataChanged) {
      this.backstageView.update(
        snapshot.backstageCells ?? [],
        new Set(snapshot.bandSupply?.activeKeys ?? []),
      )
    }
    this.bandActorView.update(
      snapshot.bandActors ?? [],
      this.renderAlpha,
      snapshot.simTick,
      this.actorTerrainHeight,
    )
    if (dataChanged) this.attractivenessView.update(snapshot.attractiveness)
    if (dataChanged) this.partyMoodView.update(snapshot.partyMood)
    if (dataChanged) this.logisticsView.setStructurePaths(snapshot.buildings.filter(b => b.kind === 'path').map(b => ({ x:b.x, z:b.z, elevation:b.elevation, slope:b.pathSlope ?? 0, direction:b.pathSlopeDirection ?? 0, road:false })))
    if (dataChanged) this.courseView.update(snapshot.courses ?? [], snapshot.visitors, snapshot.simTick)
    if (dataChanged) {
      this.attractionView.update(
        snapshot.attractions,
        new Set([
          ...snapshot.coasters.map((coaster) => coaster.id),
          ...snapshot.courses.map((course) => course.id),
          ...snapshot.buildings.filter((building) => building.kind === 'ride').map((building) => building.id),
        ]),
      )
    }
    this.logisticsView.update(snapshot.logistics, (x, z) =>
      getTerrainHeight(snapshot.terrain, x, z),
      (x, z) => { const g = groundInfo(snapshot, x, z); if (g.roadway) return wayInfo(snapshot, x, z, 'road').color; return !this.logisticsMode ? 0x50555a : g.surface === 'paved' ? 0x50555a : g.surface === 'gravel' ? 0x8f948b : 0x8b7551 },
      (x, z) => snapshot.festival.infrastructure.ground[`${x},${z}`]?.roadway,
      snapshot.speed === 0,
      undefined,
      this.logisticsMode || isRoadBuildTool(snapshot.selectedTool),
    )
    this.accessControlView.update(
      snapshot.accessControls ?? { trafficLights: [], pathBarriers: [] },
      (x, z) => getTerrainHeight(snapshot.terrain, x, z),
    )
    const showPower =
      snapshot.selectedTool === 'powerCable' ||
      snapshot.selectedTool === 'generator' ||
      snapshot.selectedTool === 'backupGenerator'
    this.powerView.setVisible(showPower)
    if (dataChanged) this.powerView.update(snapshot.power, snapshot.terrain)
    const showPerforming = this.isShowPerforming(snapshot)
    this.laserView.update(snapshot, showPerforming)
    this.festivalEquipmentView.update(snapshot, showPerforming)
    const coasterFingerprint = dataChanged ? snapshot.coasters
      .map(
        (coaster) =>
          `${coaster.id}:${coaster.pieces.map((piece) => piece.id).join(',')}:${coaster.entrance ? `${coaster.entrance.x},${coaster.entrance.y},${coaster.entrance.z}` : '-'}:${coaster.exit ? `${coaster.exit.x},${coaster.exit.y},${coaster.exit.z}` : '-'}`,
      )
      .join('|') : this.coasterFingerprint
    if (coasterFingerprint !== this.coasterFingerprint) {
      this.coasterFingerprint = coasterFingerprint
      this.rebuildCoasters(snapshot.coasters)
    }
    this.updateCoasterTrains(snapshot.coasters, snapshot.visitors)
    if (dataChanged) {
      this.bungeeOccupants.clear()
      for (const b of snapshot.buildings) if (b.rideType === 'bungee' && b.bungeeVisitorId) this.bungeeOccupants.set(b.id, b.bungeeVisitorId)
    }
    this.bungeeRiders.clear()
    for (const model of this.buildings.children) if (model.userData.bungee) {
      const rider = this.trainVisitorsById.get(this.bungeeOccupants.get(model.userData.buildingId) ?? '')
      const active = rider?.state === 'using' && rider.targetId === model.userData.buildingId
      if (active) this.bungeeRiders.add(rider.id)
      setBungeeJumper(model as Group, active ? rider : null)
      animateBungee(model as Group, active && !this.logisticsMode ? 1 - rider.interactionRemaining / SIMULATION_CONFIG.needs.interactionMinutes.ride : null)
    }
    if (dataChanged) this.supplyChainView.update(snapshot, this.logisticsMode, this.terrainShape ?? undefined)
    this.supplyChainView.animate(snapshot.speed === 0, undefined, this.actorTerrainHeight)
    this.supplyChainView.faceCamera(this.camera.quaternion)
    this.visitors.visible = !this.logisticsMode
    this.staffView.group.visible = !this.logisticsMode
    this.coasterTrains.visible = !this.logisticsMode
    this.cashEffects.visible = !this.logisticsMode
    if (!this.logisticsMode) {
      this.updateVisitors(snapshot.visitors)
      if (!this.walkMode) this.updateVisitorFollow(snapshot.visitors)
    }
    if(this.followedStaffId && !this.walkMode) {
      const position=this.resolveStaffPosition(this.followedStaffId,snapshot)
      if(position) {this.cameraTarget.set(position.x,position.y,position.z);this.updateCamera()}
      else this.followedStaffId=null
    }
    // Shaders compile the first time an object is drawn — and only then. Someone who
    // is hired or arrives out of the main camera's view is never drawn by it, so the
    // first thing to draw them is the preview in their info panel, and that click
    // stalls for the compile. Compiling whenever the population has changed — after
    // the crowd and crew views have put the new figures into the scene — moves it to
    // a moment nobody is waiting on; for everything already compiled it is a walk.
    const population = `${snapshot.staff.length}:${snapshot.visitors.length > 0}:${snapshot.logistics.roadVehicles.length}:${snapshot.festival.infrastructure.routes.length}:${snapshot.coasters.length}`
    if (population !== this.warmedPopulation) {
      this.warmedPopulation = population
      this.renderer.compile(this.scene, this.camera)
    }
    this.renderPersonPreview(this.staffPreview, snapshot)
    this.renderPersonPreview(this.visitorPreview, snapshot)
    this.updateCashEffects(snapshot.cashEffects)
    this.updateSoundWaves(
      isFestivalOfferActive(
        snapshot.dayPlan,
        'stages',
        snapshot.minute,
        snapshot.day,
      ),
    )
    this.fireworksView.update(snapshot.fireworkEffects)
    if (dataChanged) this.crowdingView.update(snapshot.crowding)
    this.panicView.update(snapshot.visitors, snapshot.crowding)
    if (this.logisticsMode) {
      this.crowdingView.group.visible = false
      this.attractivenessView.group.visible = false
      this.partyMoodView.group.visible = false
      this.panicView.group.visible = false
    }
    this.updatePreview()
  }

  render(): void {
    this.facadeReveal?.update(performance.now())
    this.renderer.render(this.scene, this.walkMode ? this.walkCamera : this.camera)
  }

  private syncInterpolation(
    snapshot: Readonly<GameSnapshot>,
    renderAlpha: number,
  ): void {
    this.renderAlpha = snapshot.speed === 0 ? 1 : renderAlpha
    if (snapshot.simTick === this.interpolatedTick) return
    const nextShowTime=(snapshot.day*1440+snapshot.minute)*2
    this.previousShowTime=this.currentShowTime&&Math.abs(nextShowTime-this.currentShowTime)<20?this.currentShowTime:nextShowTime
    this.currentShowTime=nextShowTime
    this.previousVisitorPositions = this.currentVisitorPositions
    this.currentVisitorPositions = new Map(snapshot.visitors.map(visitor => [
      visitor.id, { x: visitor.x, y: visitor.y, z: visitor.z },
    ]))
    this.prevTrainDistance = this.currTrainDistance
    this.currTrainDistance = new Map(
      snapshot.coasters.map((coaster) => [coaster.id, coaster.train.distance]),
    )
    this.interpolatedTick = snapshot.simTick
  }

  private interpolatedTrainDistance(coaster: Coaster): number {
    const current = this.currTrainDistance.get(coaster.id) ?? coaster.train.distance
    const previous = this.prevTrainDistance.get(coaster.id)
    if (previous === undefined || Math.abs(current - previous) > 6) {
      return current
    }
    return previous + (current - previous) * this.renderAlpha
  }

  invalidate(): void {
    this.terrainFingerprint = ''
    this.buildingFingerprint = ''
    this.buildingModelsStale = true
    this.coasterFingerprint = ''
    this.lastGroundRevision = -1
    this.cachedFootwayFingerprint = ''
    this.interpolatedTick = -1
    this.previousVisitorPositions.clear()
    this.currentVisitorPositions.clear()
    this.visitorSeedCache.clear()
    this.prevTrainDistance.clear()
    this.currTrainDistance.clear()
    this.lastDayMinute = Number.NEGATIVE_INFINITY
    this.lastPowerKey = ''
    this.wasteBins = []
    this.renderer.shadowMap.needsUpdate = true
    this.campingView.invalidate()
    this.medicalView.invalidate()
    this.wasteView.invalidate()
    this.pathFlowView.invalidate()
    this.incidentView.invalidate()
    this.staffView.invalidate()
    this.forecourtView.invalidate()
    this.backstageView.invalidate()
    this.bandActorView.invalidate()
    this.logisticsView.invalidate()
    this.accessControlView.invalidate()
    this.powerView.invalidate()
    this.laserView.invalidate()
  }

  private markSharedResources(): void {
    const shared = [
      this.treeTrunkGeometry,
      this.treeCrownGeometry,
      this.treeTrunkMaterial,
      this.treeCrownMaterial,
      this.hedgeMaterial,
      this.landMaterial,
      this.waterGeometry,
      this.waterMaterial,
      this.pathDragGeometry,
      this.pathDragMaterial,
      this.visitorBodyGeometry,
      this.visitorFemaleBodyGeometry,
      this.visitorHeadGeometry,
      this.visitorLegGeometry,
      this.visitorArmGeometry,
      this.visitorBreastGeometry,
      this.visitorBustGeometry,
      this.visitorPenisGeometry,
      this.visitorSkinMaterial,
      this.visitorLegMaterial,
      this.handcartBodyGeometry,
      this.handcartGearGeometry,
      this.handcartWheelGeometry,
      this.handcartHandleGeometry,
      this.handcartBodyMaterial,
      this.handcartGearMaterial,
      this.handcartWheelMaterial,
      this.handcartHandleMaterial,
    ]
    shared.forEach((resource) => {
      resource.userData.shared = true
    })
  }

  rotate(direction: number): void {
    if (this.walkMode) {
      this.walkYaw += direction * (Math.PI / 2)
      this.applyWalkCamera()
      return
    }
    this.cameraAngle += direction * (Math.PI / 2)
    this.updateCamera()
  }

  setCrowdingOverlayVisible(visible: boolean): void {
    this.crowdingView.setVisible(visible)
  }

  setAttractivenessOverlayVisible(visible: boolean): void {
    this.attractivenessView.setVisible(visible)
  }

  setPartyMoodOverlayVisible(visible: boolean): void {
    this.partyMoodView.setVisible(visible)
  }

  showStaffArea(area: {minX:number;maxX:number;minZ:number;maxZ:number} | null): void {
    const stamp = JSON.stringify(area)
    if(stamp===this.workAreaStamp) return
    this.workAreaStamp=stamp
    if(this.workAreaOverlay) {this.scene.remove(this.workAreaOverlay);this.workAreaOverlay.geometry.dispose();(this.workAreaOverlay.material as MeshBasicMaterial).dispose();this.workAreaOverlay.dispose();this.workAreaOverlay=null}
    if(!area || !this.currentSnapshot) return
    const count=(area.maxX-area.minX+1)*(area.maxZ-area.minZ+1)
    const mesh=new InstancedMesh(new PlaneGeometry(.94,.94),new MeshBasicMaterial({color:0x5ad4e5,transparent:true,opacity:.25,depthWrite:false}),count)
    const pose=new Object3D();pose.rotation.x=-Math.PI/2
    let index=0
    for(let z=area.minZ;z<=area.maxZ;z++) for(let x=area.minX;x<=area.maxX;x++) {pose.position.set(x+.5,getTerrainHeight(this.currentSnapshot.terrain,x,z)+.17,z+.5);pose.updateMatrix();mesh.setMatrixAt(index++,pose.matrix)}
    mesh.frustumCulled=false;this.scene.add(mesh);this.workAreaOverlay=mesh
  }

  showStaffZones(zones: string[] | null): void {
    const stamp = JSON.stringify(zones)
    if(stamp===this.workZonesStamp) return
    this.workZonesStamp=stamp
    if(this.workZonesOverlay) {this.scene.remove(this.workZonesOverlay);this.workZonesOverlay.geometry.dispose();(this.workZonesOverlay.material as MeshBasicMaterial).dispose();this.workZonesOverlay.dispose();this.workZonesOverlay=null}
    if(!zones?.length || !this.currentSnapshot) return
    const half=this.worldSize/2
    const cells:Array<{x:number;z:number}>=[]
    for(const key of zones) {
      const area=zoneCellRange(key)
      for(let z=Math.max(-half,area.minZ);z<=Math.min(half-1,area.maxZ);z++) for(let x=Math.max(-half,area.minX);x<=Math.min(half-1,area.maxX);x++) cells.push({x,z})
    }
    if(!cells.length) return
    const mesh=new InstancedMesh(new PlaneGeometry(.94,.94),new MeshBasicMaterial({color:0x5ad4e5,transparent:true,opacity:.25,depthWrite:false}),cells.length)
    const pose=new Object3D();pose.rotation.x=-Math.PI/2
    cells.forEach((cell,index)=>{pose.position.set(cell.x+.5,getTerrainHeight(this.currentSnapshot!.terrain,cell.x,cell.z)+.17,cell.z+.5);pose.updateMatrix();mesh.setMatrixAt(index,pose.matrix)})
    mesh.frustumCulled=false;this.scene.add(mesh);this.workZonesOverlay=mesh
  }

  setStaffZonePaintTool(handler: ((cell: CellPosition | null, phase: 'start' | 'move' | 'end') => void) | null): void {
    this.staffZonePaintHandler = handler
    this.staffZonePainting = false
    this.staffZonePaintKey = ''
    this.staffZoneHoverKey = ''
    this.clearStaffZoneHover()
    if (handler) this.updateStaffZoneHover(this.hoveredCell)
  }

  private clearStaffZoneHover(): void {
    if (!this.staffZoneHoverOverlay) return
    this.scene.remove(this.staffZoneHoverOverlay)
    this.staffZoneHoverOverlay.geometry.dispose()
    ;(this.staffZoneHoverOverlay.material as MeshBasicMaterial).dispose()
    this.staffZoneHoverOverlay.dispose()
    this.staffZoneHoverOverlay = null
  }

  private updateStaffZoneHover(cell: CellPosition | null): void {
    if (!this.staffZonePaintHandler || !cell || !this.currentSnapshot) {
      this.staffZoneHoverKey = ''
      this.clearStaffZoneHover()
      return
    }
    const key = zoneKey(cell.x, cell.z)
    if (key === this.staffZoneHoverKey && this.staffZoneHoverOverlay) return
    this.staffZoneHoverKey = key
    this.clearStaffZoneHover()
    const half = this.worldSize / 2
    const area = zoneCellRange(key)
    const cells: Array<{ x: number; z: number }> = []
    for (let z = Math.max(-half, area.minZ); z <= Math.min(half - 1, area.maxZ); z++) {
      for (let x = Math.max(-half, area.minX); x <= Math.min(half - 1, area.maxX); x++) cells.push({ x, z })
    }
    if (!cells.length) return
    const mesh = new InstancedMesh(
      new PlaneGeometry(0.94, 0.94),
      new MeshBasicMaterial({ color: 0x8cf0ff, transparent: true, opacity: 0.42, depthWrite: false }),
      cells.length,
    )
    const pose = new Object3D()
    pose.rotation.x = -Math.PI / 2
    cells.forEach((entry, index) => {
      pose.position.set(entry.x + 0.5, getTerrainHeight(this.currentSnapshot!.terrain, entry.x, entry.z) + 0.19, entry.z + 0.5)
      pose.updateMatrix()
      mesh.setMatrixAt(index, pose.matrix)
    })
    mesh.frustumCulled = false
    this.scene.add(mesh)
    this.staffZoneHoverOverlay = mesh
  }

  private staffZonePaintAt(cell: CellPosition, phase: 'start' | 'move'): void {
    const key = zoneKey(cell.x, cell.z)
    if (phase === 'move' && key === this.staffZonePaintKey) return
    this.staffZonePaintKey = key
    this.staffZonePaintHandler?.(cell, phase)
  }

  private endStaffZonePaint(): void {
    if (!this.staffZonePainting) return
    this.staffZonePainting = false
    this.staffZonePaintKey = ''
    this.staffZonePaintHandler?.(this.hoveredCell, 'end')
  }

  setStaffPlacementTool(handler: ((cell: CellPosition) => void) | null, color = 0x5ad4e5): void {
    this.staffPlacementHandler = handler
    this.staffPlacementColor = color
    if (!handler) this.updateStaffPlacementPreview(null)
  }

  private updateStaffPlacementPreview(cell: CellPosition | null): void {
    if (!cell || !this.currentSnapshot) {
      if (this.staffPlacementPreview) this.staffPlacementPreview.visible = false
      return
    }
    if (!this.staffPlacementPreview) {
      const mesh = new Mesh(
        new BoxGeometry(0.8, 0.2, 0.8),
        new MeshBasicMaterial({ color: this.staffPlacementColor, transparent: true, opacity: 0.55, depthWrite: false }),
      )
      this.scene.add(mesh)
      this.staffPlacementPreview = mesh
    }
    const mesh = this.staffPlacementPreview
    ;(mesh.material as MeshBasicMaterial).color.set(this.staffPlacementColor)
    mesh.visible = true
    mesh.position.set(cell.x + 0.5, getTerrainHeight(this.currentSnapshot.terrain, cell.x, cell.z) + 0.4, cell.z + 0.5)
  }

  setStaffClickHandler(handler: VisitorHandler): void { this.onStaffClick = handler }
  setVehicleClickHandler(handler: VisitorHandler): void { this.onVehicleClick = handler }
  setAccessControlClickHandler(handler: VisitorHandler): void { this.onAccessControlClick = handler }

  showAccessArea(cells: ReadonlyArray<{ x: number; z: number }> | null): void {
    const stamp = JSON.stringify(cells)
    if (stamp === this.accessAreaStamp) return
    this.accessAreaStamp = stamp
    if (this.accessAreaOverlay) {
      this.scene.remove(this.accessAreaOverlay)
      this.accessAreaOverlay.geometry.dispose()
      ;(this.accessAreaOverlay.material as MeshBasicMaterial).dispose()
      this.accessAreaOverlay.dispose()
      this.accessAreaOverlay = null
    }
    if (!cells?.length || !this.currentSnapshot) return
    const mesh = new InstancedMesh(
      new PlaneGeometry(0.94, 0.94),
      new MeshBasicMaterial({ color: 0xf4c15d, transparent: true, opacity: 0.28, depthWrite: false }),
      cells.length,
    )
    const pose = new Object3D()
    pose.rotation.x = -Math.PI / 2
    cells.forEach((cell, index) => {
      pose.position.set(
        cell.x + 0.5,
        getTerrainHeight(this.currentSnapshot!.terrain, cell.x, cell.z) + 0.18,
        cell.z + 0.5,
      )
      pose.updateMatrix()
      mesh.setMatrixAt(index, pose.matrix)
    })
    mesh.frustumCulled = false
    this.scene.add(mesh)
    this.accessAreaOverlay = mesh
  }
  setInspectedVehicle(id: string | null): void {
    this.logisticsView.setInspectedVehicle(id)
  }

  setBusPlannerRoute(
    cells: readonly { x: number; z: number; elevation?: number }[] | null,
    markers?: readonly {
      stopId: string
      index: number
      x: number
      z: number
      elevation?: number
      lineId?: string
    }[] | null,
  ): void {
    this.logisticsView.setPlannerRoute(cells, markers)
  }
  followStaff(id: string | null): void {
    this.followedStaffId = id
    if (id) {
      this.followedVisitorId = null
      if (this.walkMode) this.setWalkMode(false)
    }
  }

  /** Ground look-at (orbit) or walk-camera ears. Used by festival SFX, not visitors. */
  audioListenerPose(): AudioListenerPose {
    if (this.walkMode) {
      const lookX = this.walkX + Math.sin(this.walkYaw) * Math.cos(this.walkPitch)
      const lookY = this.walkCamera.position.y + Math.sin(this.walkPitch)
      const lookZ = this.walkZ + Math.cos(this.walkYaw) * Math.cos(this.walkPitch)
      return listenerFromCamera(
        this.walkCamera.position,
        { x: lookX, y: lookY, z: lookZ },
        this.walkCamera.up,
        'camera',
      )
    }
    return listenerFromCamera(this.camera.position, this.cameraTarget, this.camera.up, 'lookAt')
  }

  /** Jump the orbit camera to a world position (visitor/staff click, ticker). */
  focusWorldPosition(x: number, z: number): void {
    this.followVisitor(null)
    this.followedStaffId = null
    if (this.walkMode) this.setWalkMode(false)
    this.cameraTarget.set(x, 0, z)
    this.updateCamera()
  }

  private resolveStaffPosition(id: string, snapshot: Readonly<GameSnapshot>): { x: number; y: number; z: number } | null {
    const carrier = snapshot.festival.infrastructure.routes.find((r) => r.id === id)
    const sweeper = snapshot.logistics.roadVehicles.find(
      (vehicle) => vehicle.id === id && vehicle.kind === 'sweeper',
    )
    if (sweeper) {
      const x = sweeper.cell?.x ?? sweeper.position.x
      const z = sweeper.cell?.z ?? sweeper.position.z
      return {
        x: x + 0.5,
        y: getTerrainHeight(snapshot.terrain, x, z),
        z: z + 0.5,
      }
    }
    return (
      snapshot.staff.find((p) => p.id === id) ??
      this.supplyChainView.getCarrierPosition(id) ??
      (carrier ? { x: carrier.position.x + 0.5, y: carrier.position.elevation, z: carrier.position.z + 0.5 } : null)
    )
  }

  mountMinimap(canvas: HTMLCanvasElement): void {
    this.disposePersonPreview(this.staffPreview)
    this.staffPreview = this.createPersonPreview(canvas, 'staff')
  }

  mountVisitorPreview(canvas: HTMLCanvasElement): void {
    this.disposePersonPreview(this.visitorPreview)
    this.visitorPreview = this.createPersonPreview(canvas, 'visitor')
  }

  setMinimapTarget(id: string | null): void {
    if (this.staffPreview) this.staffPreview.targetId = id
  }

  setVisitorPreviewTarget(id: string | null): void {
    if (this.visitorPreview) this.visitorPreview.targetId = id
  }

  setStaffPreviewMode(mode: PersonPreviewMode): void {
    if (this.staffPreview) this.staffPreview.mode = mode
  }

  setVisitorPreviewMode(mode: PersonPreviewMode): void {
    if (this.visitorPreview) this.visitorPreview.mode = mode
  }

  zoomMinimap(factor: number): void {
    this.zoomPersonPreview(this.staffPreview, factor)
  }

  zoomVisitorPreview(factor: number): void {
    this.zoomPersonPreview(this.visitorPreview, factor)
  }

  private createPersonPreview(canvas: HTMLCanvasElement, kind: PersonPreviewSlot['kind']): PersonPreviewSlot | null {
    const context = canvas.getContext('2d')
    if (!context) return null
    return {
      canvas,
      context,
      mapCamera: new OrthographicCamera(),
      frontCamera: new PerspectiveCamera(36, 1, 0.08, 48),
      targetId: null,
      kind,
      mode: 'map',
      mapHeight: 7,
      frontDistance: 1.85,
    }
  }

  private disposePersonPreview(slot: PersonPreviewSlot | null): void {
    if (slot) slot.context.clearRect(0, 0, slot.canvas.width, slot.canvas.height)
  }

  private zoomPersonPreview(slot: PersonPreviewSlot | null, factor: number): void {
    if (!slot) return
    if (slot.mode === 'front') {
      slot.frontDistance = MathUtils.clamp(slot.frontDistance * factor, 1.15, 3.4)
      return
    }
    slot.mapHeight = MathUtils.clamp(slot.mapHeight * factor, 2.5, 16)
  }

  private resolveVisitorPreviewPose(
    id: string,
    snapshot: Readonly<GameSnapshot>,
  ): { x: number; y: number; z: number; facing: number } | null {
    const visitor = snapshot.visitors.find((entry) => entry.id === id)
    if (!visitor) return null
    const current = this.currentVisitorPositions.get(id) ?? { x: visitor.x, y: visitor.y, z: visitor.z }
    const previous = this.previousVisitorPositions.get(id)
    const interpolate = previous && Math.hypot(previous.x - current.x, previous.z - current.z) < 5
    const x = interpolate ? previous.x + (current.x - previous.x) * this.renderAlpha : current.x
    const y = interpolate ? previous.y + (current.y - previous.y) * this.renderAlpha : current.y
    const z = interpolate ? previous.z + (current.z - previous.z) * this.renderAlpha : current.z
    const next = visitor.route[0]
    const facing = next
      ? Math.atan2(next.x + visitor.tileOffsetX - visitor.x, next.z + visitor.tileOffsetZ - visitor.z)
      : visitor.facing
    return { x, y: this.actorTerrainHeight(x, z, y), z, facing }
  }

  private resolveStaffPreviewPose(
    id: string,
    snapshot: Readonly<GameSnapshot>,
  ): { x: number; y: number; z: number; facing: number } | null {
    const position = this.resolveStaffPosition(id, snapshot)
    if (!position) return null
    const member = snapshot.staff.find((entry) => entry.id === id)
    const sweeper = snapshot.logistics.roadVehicles.find(
      (vehicle) => vehicle.id === id && vehicle.kind === 'sweeper',
    )
    return { x: position.x, y: position.y, z: position.z, facing: member?.facing ?? sweeper?.facing ?? 0 }
  }

  private renderPersonPreview(slot: PersonPreviewSlot | null, snapshot: Readonly<GameSnapshot>): void {
    const targetId = slot?.targetId
    if (!slot || !targetId) return
    const pose = slot.kind === 'visitor'
      ? this.resolveVisitorPreviewPose(targetId, snapshot)
      : this.resolveStaffPreviewPose(targetId, snapshot)
    if (!pose) return
    const { canvas } = slot
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width === 0 || height === 0) return
    const aspect = width / height
    if (slot.mode === 'front') {
      const camera = slot.frontCamera
      const distance = slot.frontDistance
      const bodyY = pose.y + 0.42
      camera.aspect = aspect
      camera.fov = 36
      camera.near = 0.08
      camera.far = 48
      camera.position.set(
        pose.x + Math.sin(pose.facing) * distance,
        bodyY + 0.1,
        pose.z + Math.cos(pose.facing) * distance,
      )
      camera.lookAt(pose.x, bodyY - 0.04, pose.z)
      camera.updateProjectionMatrix()
      this.blitPreview(slot, camera)
      return
    }
    const camera = slot.mapCamera
    const viewHeight = slot.mapHeight
    camera.left = (-viewHeight * aspect) / 2
    camera.right = (viewHeight * aspect) / 2
    camera.top = viewHeight / 2
    camera.bottom = -viewHeight / 2
    camera.near = 0.1
    camera.far = 100
    const horizontalDistance = 24
    camera.position.set(
      pose.x + Math.sin(this.cameraAngle) * horizontalDistance,
      20,
      pose.z + Math.cos(this.cameraAngle) * horizontalDistance,
    )
    camera.lookAt(pose.x, 0, pose.z)
    camera.updateProjectionMatrix()
    this.blitPreview(slot, camera)
  }

  /**
   * Renders the preview camera into the bottom-left corner of the main canvas and
   * copies that corner into the preview's own canvas. It runs before the frame
   * proper, which then paints over the corner, so nothing of it is ever seen on the
   * map. Shadow maps are not redrawn for it — the frame's own are good enough.
   */
  private blitPreview(slot: PersonPreviewSlot, camera: OrthographicCamera | PerspectiveCamera): void {
    const renderer = this.renderer
    const ratio = renderer.getPixelRatio()
    const buffer = renderer.getDrawingBufferSize(this.previewBufferSize)
    const width = Math.min(Math.round(slot.canvas.clientWidth * ratio), buffer.x)
    const height = Math.min(Math.round(slot.canvas.clientHeight * ratio), buffer.y)
    if (width <= 0 || height <= 0) return
    if (slot.canvas.width !== width || slot.canvas.height !== height) {
      slot.canvas.width = width
      slot.canvas.height = height
    }
    const shadowAutoUpdate = renderer.shadowMap.autoUpdate
    renderer.shadowMap.autoUpdate = false
    renderer.setScissorTest(true)
    renderer.setScissor(0, 0, width / ratio, height / ratio)
    renderer.setViewport(0, 0, width / ratio, height / ratio)
    renderer.render(this.scene, camera)
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, buffer.x / ratio, buffer.y / ratio)
    renderer.shadowMap.autoUpdate = shadowAutoUpdate
    // GL's corner is the bottom-left; the copy reads it in image coordinates.
    slot.context.drawImage(renderer.domElement, 0, buffer.y - height, width, height, 0, 0, width, height)
  }

  followVisitor(visitorId: string | null): void {
    if (visitorId) {
      this.followedStaffId = null
      if (this.walkMode) this.setWalkMode(false)
    }
    this.followedVisitorId = visitorId
    if (!visitorId || !this.currentSnapshot) return
    this.updateVisitorFollow(this.currentSnapshot.visitors, true)
  }

  isWalkMode(): boolean {
    return this.walkMode
  }

  setWalkModeListener(listener: ((enabled: boolean) => void) | null): void {
    this.walkModeListener = listener
  }

  setWalkStick(x: number, z: number): void {
    this.walkStickX = MathUtils.clamp(x, -1, 1)
    this.walkStickZ = MathUtils.clamp(z, -1, 1)
  }

  setWalkMode(enabled: boolean): void {
    if (this.walkMode === enabled) return
    if (enabled) {
      this.followVisitor(null)
      this.followedStaffId = null
      this.walkX = this.cameraTarget.x
      this.walkZ = this.cameraTarget.z
      this.walkYaw = this.cameraAngle + Math.PI
      this.walkPitch = -0.12
      this.walkKeys.clear()
      this.walkStickX = 0
      this.walkStickZ = 0
      this.walkLookActive = false
      this.snapWalkHeight()
      this.applyWalkCamera()
      this.walkMode = true
    } else {
      this.walkMode = false
      this.walkKeys.clear()
      this.walkStickX = 0
      this.walkStickZ = 0
      this.walkLookActive = false
      this.cameraTarget.set(this.walkX, 0, this.walkZ)
      this.updateCamera()
    }
    this.resize()
    this.walkModeListener?.(this.walkMode)
  }

  advanceWalk(deltaSeconds: number): void {
    if (!this.walkMode) return
    const sprint = this.walkKeys.has('ShiftLeft') || this.walkKeys.has('ShiftRight')
    const speed = (sprint ? WALK_RUN_SPEED : WALK_SPEED)
    let inputX = this.walkStickX
    let inputZ = this.walkStickZ
    if (this.walkKeys.has('KeyW') || this.walkKeys.has('ArrowUp')) inputZ += 1
    if (this.walkKeys.has('KeyS') || this.walkKeys.has('ArrowDown')) inputZ -= 1
    if (this.walkKeys.has('KeyA') || this.walkKeys.has('ArrowLeft')) inputX -= 1
    if (this.walkKeys.has('KeyD') || this.walkKeys.has('ArrowRight')) inputX += 1
    const length = Math.hypot(inputX, inputZ)
    if (length > 0) {
      const step = speed * deltaSeconds / length
      const forwardX = Math.sin(this.walkYaw)
      const forwardZ = Math.cos(this.walkYaw)
      // Camera looks down -Z, so view-right is the opposite of the +Y × forward vector.
      const rightX = -Math.cos(this.walkYaw)
      const rightZ = Math.sin(this.walkYaw)
      const nextX = this.walkX + (forwardX * inputZ + rightX * inputX) * step
      const nextZ = this.walkZ + (forwardZ * inputZ + rightZ * inputX) * step
      if (this.canWalkTo(nextX, this.walkZ)) this.walkX = nextX
      if (this.canWalkTo(this.walkX, nextZ)) this.walkZ = nextZ
    }
    this.snapWalkHeight()
    this.applyWalkCamera()
  }

  setPathConstructionPreview(
    active: boolean,
    anchor: PathAnchor | null,
    direction: number,
    slope: number,
  ): void {
    this.constructionActive = active
    this.constructionAnchor.visible = active && Boolean(anchor)
    this.constructionNext.visible = active && Boolean(anchor)
    this.constructionSlope.visible = active && Boolean(anchor) && slope !== 0
    if (!active || !anchor) return

    const directions = [
      { x: 0, z: 1 },
      { x: 1, z: 0 },
      { x: 0, z: -1 },
      { x: -1, z: 0 },
    ]
    const offset = directions[direction] ?? directions[0]
    if (!offset) return
    this.constructionAnchor.position.set(anchor.x + 0.5, anchor.elevation + 0.1, anchor.z + 0.5)
    this.constructionNext.position.set(
      anchor.x + offset.x + 0.5,
      anchor.elevation + slope + 0.1,
      anchor.z + offset.z + 0.5,
    )
    if (slope !== 0) {
      const rampCenter = new Vector3(
        anchor.x + offset.x + 0.5,
        anchor.elevation + slope / 2 + 0.08,
        anchor.z + offset.z + 0.5,
      )
      const rampDirection = new Vector3(offset.x, slope, offset.z)
      this.constructionSlope.position.copy(rampCenter)
      this.constructionSlope.quaternion.setFromUnitVectors(
        new Vector3(0, 0, 1),
        rampDirection.normalize(),
      )
    }
    this.updatePreview()
  }

  setPathDragPreview(cells: readonly CellPosition[], elevation: number): void {
    disposeChildren(this.pathDragPreview)
    const bulldozing = this.currentSnapshot?.selectedTool === 'bulldoze'
    this.pathDragMaterial.color.set(bulldozing ? 0xe85a4f : 0x75e49e)
    this.pathDragMaterial.opacity = bulldozing ? 0.7 : 0.62
    cells.forEach((cell) => {
      const tile = new Mesh(this.pathDragGeometry, this.pathDragMaterial)
      const ground = getTerrainHeight(this.currentSnapshot?.terrain, cell.x, cell.z)
      tile.position.set(cell.x + 0.5, ground + elevation + 0.12, cell.z + 0.5)
      this.pathDragPreview.add(tile)
    })
  }

  setBlueprintPreview(ghosts: readonly BlueprintGhost[]): void {
    disposeChildren(this.blueprintPreview)
    ghosts.forEach((ghost) => {
      const tile = new Mesh(
        this.pathDragGeometry,
        new MeshStandardMaterial({
          color: ghost.valid ? 0x75e49e : 0xf05a65,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
      )
      const ground = getTerrainHeight(this.currentSnapshot?.terrain, ghost.x, ghost.z)
      const slot = ghost.decorationSlot
      const edge = typeof slot === 'number' && slot >= 0 && slot <= 3 && !ghost.isRoad && !ghost.isPath
      tile.scale.set(edge ? 0.55 : 0.92, 1, edge ? 0.28 : 0.92)
      tile.position.set(ghost.x + 0.5, ground + ghost.elevationOffset + 0.16, ghost.z + 0.5)
      tile.rotation.y = ghost.rotation * Math.PI / 2
      this.blueprintPreview.add(tile)
    })
  }

  setCoasterConstructionPreview(
    points: readonly TrackPoint[],
    options?: {
      kind?: TrackPieceKind
      chainLift?: boolean
      styleId?: CoasterTrackStyleId
      railColor?: number
      structureColor?: number
    },
  ): void {
    const previewKey = coasterConstructionPreviewKey(points, options)
    if (previewKey === this.coasterPreviewKey) return
    this.coasterPreviewKey = previewKey
    disposeChildren(this.coasterPreview)
    if (points.length < 2) return
    const preview = smoothTrackDisplayPoints(points)
    const ghostMaterial = new MeshStandardMaterial({
      color: 0x65e6ee,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      roughness: 0.42,
      metalness: 0.18,
      emissive: 0x1a6a72,
      emissiveIntensity: 0.22,
    })
    if (options?.styleId && options.kind) {
      const frames = preview.map((point, index) => {
        const previous = preview[Math.max(0, index - 1)] ?? point
        const next = preview[Math.min(preview.length - 1, index + 1)] ?? point
        return computeTrackFrame(
          {
            x: next.x - previous.x,
            y: next.y - previous.y,
            z: next.z - previous.z,
          },
          point.bank ?? 0,
          point.pitch ?? 0,
          point.frameHeading,
        )
      })
      const track = createStyledCoasterTrackPiece({
        styleId: options.styleId,
        kind: options.kind,
        chainLift: Boolean(options.chainLift),
        display: preview,
        frames,
        centerPoints: preview.map((point) => new Vector3(point.x + 0.5, point.y + 0.24, point.z + 0.5)),
        trackHeightsByCell: new Map(),
        railColor: options.railColor,
        structureColor: options.structureColor,
      })
      track.traverse((object) => {
        if (object instanceof Mesh) {
          object.material = ghostMaterial
          object.castShadow = false
        }
      })
      this.coasterPreview.add(track)
      this.coasterPreview.traverse((object) => {
        object.raycast = () => {}
      })
      return
    }
    ;[-0.15, 0.15].forEach((offset) => {
      const railPoints = preview.map((point, index) => {
        const previous = preview[Math.max(0, index - 1)] ?? point
        const next = preview[Math.min(preview.length - 1, index + 1)] ?? point
        const frame = computeTrackFrame(
          {
            x: next.x - previous.x,
            y: next.y - previous.y,
            z: next.z - previous.z,
          },
          point.bank ?? 0,
          point.pitch ?? 0,
          point.frameHeading,
        )
        return new Vector3(
          point.x + 0.5 + frame.right.x * offset,
          point.y + 0.25 + frame.right.y * offset,
          point.z + 0.5 + frame.right.z * offset,
        )
      })
      this.coasterPreview.add(
        new Mesh(
          new TubeGeometry(
            new CatmullRomCurve3(railPoints),
            Math.max(4, preview.length * 3),
            0.05,
            6,
            false,
          ),
          ghostMaterial,
        ),
      )
    })
    const startMarker = new Mesh(
      new BoxGeometry(0.86, 0.1, 0.86),
      new MeshStandardMaterial({
        color: 0x65e6ee,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    )
    const start = points[0]!
    startMarker.position.set(start.x + 0.5, start.y + 0.08, start.z + 0.5)
    this.coasterPreview.add(startMarker)
    this.coasterPreview.traverse((object) => {
      object.raycast = () => {}
    })
  }

  setCoasterTrackSelection(
    points: readonly { x: number; y: number; z: number }[],
  ): void {
    const selectionKey = coasterConstructionPreviewKey(points)
    if (selectionKey === this.coasterSelectionKey) return
    this.coasterSelectionKey = selectionKey
    disposeChildren(this.coasterSelection)
    if (points.length < 2) return
    const preview = smoothTrackDisplayPoints(points)
    const curve = new CatmullRomCurve3(
      preview.map((point) => new Vector3(point.x + 0.5, point.y + 0.27, point.z + 0.5)),
    )
    const marker = new Mesh(
      new TubeGeometry(curve, Math.max(4, preview.length * 3), 0.105, 7, false),
      new MeshStandardMaterial({
        color: 0xff4fc3,
        emissive: 0x5d123e,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      }),
    )
    this.coasterSelection.add(marker)
  }

  private syncWorldSize(size: number): void {
    if (size === this.worldSize && this.grid) return
    this.rebuildGround(size)
    this.terrainFingerprint = ''
  }

  private rebuildGround(size: number): void {
    if (this.grid) {
      this.scene.remove(this.grid)
      disposeObject3D(this.grid)
      this.grid = null
    }
    this.worldSize = size
    const grid = new GridHelper(size, size, 0x416c38, 0x5c8d4b)
    grid.position.y = 0.012
    grid.visible = false
    this.grid = grid
    this.scene.add(grid)
  }

  private rebuildTerrainIfNeeded(snapshot: Readonly<GameSnapshot>): void {
    // Moisture changes a material uniform, never rebuilds thousands of terrain cells.
    this.terrainSurfaceMaterial.color.setScalar(1 - Math.max(0, Math.min(100, snapshot.festival.wetness)) * .0015)
    const pads = terrainPads(snapshot)
    const fingerprint = `${this.worldSize}:${snapshot.scenario.environment}:${getWaterLevel(snapshot)}:${terrainFingerprint(snapshot.terrain)}:${this.groundSurfaceFingerprint}:${[...pads].sort().join('|')}`
    if (fingerprint === this.terrainFingerprint && this.landMesh) {
      return
    }
    this.terrainFingerprint = fingerprint
    this.terrainShape = new TerrainShape(snapshot, pads)
    this.terrainPadKeys = pads
    // Scenery and supports follow the rebuilt surface. The models read the ground
    // under and around them into their keys, so only those near the change rebuild.
    this.buildingFingerprint = ''
    this.rebuildTerrain(snapshot)
  }

  private rebuildTerrain(snapshot: Readonly<GameSnapshot>): void {
    const size = this.worldSize
    const half = size / 2
    const waterCells: Array<{ x: number; z: number }> = []
    for (let z = -half; z < half; z += 1) {
      for (let x = -half; x < half; x += 1) {
        if (
          tileShowsWater(
            snapshot.terrain,
            x,
            z,
            getWaterLevel(snapshot),
            (cellX, cellZ) => cellX >= -half && cellX < half && cellZ >= -half && cellZ < half,
          )
        ) {
          waterCells.push({ x, z })
        }
      }
    }
    const shape = this.terrainShape!
    if (this.landMesh) { this.terrainGroup.remove(this.landMesh); this.landMesh.geometry.dispose() }
    this.landMaterial.color.setHex(snapshot.scenario.environment === 'desert' ? 0x9a8b70 : snapshot.scenario.environment === 'urban' ? 0x7d7c78 : 0x8b8680)
    this.landMesh = createTerrainBase(shape, this.landMaterial)
    this.terrainGroup.add(this.landMesh)
    this.syncWaterMesh(waterCells)
    if (this.terrainSurface) {
      this.terrainGroup.remove(this.terrainSurface)
      this.terrainSurface.geometry.dispose()
    }
    this.terrainSurface = createTerrainSurface(snapshot, this.terrainSurfaceMaterial, shape)
    this.terrainGroup.add(this.terrainSurface)
  }

  private syncWaterMesh(waterCells: readonly { x: number; z: number }[]): void {
    if (waterCells.length === 0) {
      if (this.waterMesh) this.waterMesh.count = 0
      return
    }
    let water = this.waterMesh
    if (!water || water.instanceMatrix.count < waterCells.length) {
      if (water) this.terrainGroup.remove(water)
      water = new InstancedMesh(
        this.waterGeometry,
        this.waterMaterial,
        Math.max(16, waterCells.length),
      )
      water.frustumCulled = false
      this.waterMesh = water
      this.terrainGroup.add(water)
    }
    const waterMatrix = new Matrix4()
    waterCells.forEach((cell, waterIndex) => {
      waterMatrix.makeRotationX(-Math.PI / 2)
      waterMatrix.setPosition(
        cell.x + 0.5,
        getWaterLevel(this.currentSnapshot) + 0.04,
        cell.z + 0.5,
      )
      water.setMatrixAt(waterIndex, waterMatrix)
    })
    water.count = waterCells.length
    water.instanceMatrix.needsUpdate = true
  }

  private createWorld(): void {
    this.rebuildGround(this.worldSize)

    this.sunLight.position.set(-12, 22, 8)
    this.sunLight.castShadow = true
    this.sunLight.shadow.mapSize.set(1024, 1024)
    this.sunLight.shadow.camera.left = -18
    this.sunLight.shadow.camera.right = 18
    this.sunLight.shadow.camera.top = 18
    this.sunLight.shadow.camera.bottom = -18
    this.scene.add(this.ambientLight, this.sunLight)
    // Ten real lights for the moving heads: enough for every head of a stage in view.
    for(let n=0;n<10;n++){const light=new SpotLight(0xffffff,0,12,.21,.45,1);light.castShadow=false;this.stageLightPool.push(light);this.scene.add(light,light.target)}
  }

  private buildingFingerprintOf(items: readonly PlacedBuilding[]): string {
    let hash = items.length + 1
    for (const item of items) hash = this.hashBuilding(hash, item)
    return `${items.length}:${hash}`
  }

  /** Everything about one building that its model is built from, folded into a hash. */
  private hashBuilding(seed: number, item: PlacedBuilding): number {
    let hash = seed
    {
      hash = Math.imul(hash, 33) + item.x + item.z * 4096
      hash = Math.imul(hash, 33) + Math.round(item.elevation * 8)
      hash = Math.imul(hash, 33) + item.rotation
      hash = Math.imul(hash, 33) + (item.decorationSlot ?? -1)
      hash = Math.imul(hash, 33) + (item.bungeeHeight ?? 0)
      for (const gate of [item.rideEntrance,item.rideExit]) {
        hash=Math.imul(hash,33)+(gate ? 1 : 0)
        if (gate) {hash=Math.imul(hash,33)+gate.x;hash=Math.imul(hash,33)+gate.z;hash=Math.imul(hash,33)+gate.y}
      }
      hash = Math.imul(hash, 33) + Math.round((item.pathSlope ?? 0) * 2) + 4
      hash = Math.imul(hash, 33) + (item.pathSlopeDirection ?? 0)
      hash = Math.imul(hash, 33) + (item.queueDirection ?? 0)
      hash = Math.imul(hash, 33) + (item.queueEntryDirection ?? 0)
      hash = Math.imul(hash, 33) + (item.queueSplit ? 7 : 1)
      hash = Math.imul(hash, 33) + (item.pathType === 'queue' ? 3 : 1)
      hash = Math.imul(hash, 33) + (item.wayType ? [...item.wayType].reduce((n, c) => n + c.charCodeAt(0), 0) : 0)
      if (item.stageDesign) for (const c of JSON.stringify(item.stageDesign)) hash = Math.imul(hash,33) + c.charCodeAt(0)
      hash = Math.imul(hash, 33) + item.kind.length + item.kind.charCodeAt(0)
      hash = Math.imul(hash, 33) + (item.rideType ? item.rideType.length : 0)
    }
    return hash
  }

  /**
   * What a building's model depends on besides the building itself: the neighbours
   * whose presence shapes it, the roads on and beside its tiles, and the ground its
   * tile was given. Any of it changing means the model is built again.
   */
  private buildingContextKey(
    item: PlacedBuilding,
    byTile: ReadonlyMap<string, readonly PlacedBuilding[]>,
    roadsByTile: ReadonlyMap<string, readonly RoadCell[]>,
  ): number {
    const footprint = stageSize(item.stageDesign, item.rotation)
    let hash = 7
    for (let x = item.x - 1; x <= item.x + Math.ceil(footprint.width); x++) {
      for (let z = item.z - 1; z <= item.z + Math.ceil(footprint.depth); z++) {
        const tile = `${x},${z}`
        for (const other of byTile.get(tile) ?? []) {
          if (other.id === item.id) continue
          hash = this.hashBuilding(hash, other)
        }
        for (const road of roadsByTile.get(tile) ?? []) {
          hash = Math.imul(hash, 33) + road.x + road.z * 4096
          hash = Math.imul(hash, 33) + Math.round((road.elevation ?? -1) * 8) + Math.round((road.roadSlope ?? 0) * 8) * 64 + (road.roadSlopeDirection ?? 0)
        }
      }
    }
    // The ground under and around it: heights and flattened foundations decide where
    // supports reach and how scenery sits, and both move when a neighbour is built.
    if (this.currentSnapshot) {
      for (let x = item.x - 1; x <= item.x + Math.ceil(footprint.width); x++) {
        for (let z = item.z - 1; z <= item.z + Math.ceil(footprint.depth); z++) {
          hash = Math.imul(hash, 33) + Math.round(getTerrainHeight(this.currentSnapshot.terrain, x, z) * 8)
          hash = Math.imul(hash, 33) + (this.terrainPadKeys.has(`${x},${z}`) ? 5 : 2)
        }
      }
    }
    const ground = this.currentSnapshot?.festival.infrastructure.ground[`${item.x},${item.z}`]
    if (ground) {
      hash = Math.imul(hash, 33) + (ground.compacted ? 3 : 1)
      for (const c of `${ground.footway ?? ''}|${ground.surface ?? ''}|${ground.roadway ?? ''}`) hash = Math.imul(hash, 33) + c.charCodeAt(0)
    }
    return hash
  }

  /** Zwei direkt benachbarte FOH-Pulte bilden einen grossen FOH-Stand: Sound- und Lichtpult nebeneinander. */
  private fohVariants(items: readonly PlacedBuilding[]): Map<string, 'sound' | 'light'> {
    const desks = items.filter(item => item.kind === 'foh')
    const variants = new Map<string, 'sound' | 'light'>()
    for (const desk of desks) {
      const mate = desks.find(other => other !== desk && Math.abs(other.x - desk.x) + Math.abs(other.z - desk.z) === 1)
      if (!mate) continue
      variants.set(desk.id, fohDeskRole(desk, mate) as 'sound' | 'light')
    }
    return variants
  }

  private rebuildBuildings(items: readonly PlacedBuilding[]): void {
    disposeChildren(this.rideGates)
    for (const item of items) if (item.kind==='ride') for (const type of ['entrance','exit'] as const) {
      const access=item[type==='entrance'?'rideEntrance':'rideExit']
      if (!access) continue
      const gate=this.createCoasterAccess(access,type,item.rideType==='bungee'?'bungee':'carousel')
      gate.rotation.y=Math.atan2(item.x-access.x,item.z-access.z)
      gate.userData.buildingId=item.id
      this.rideGates.add(gate)
    }
    this.rideGates.add(batchRetroBuildings(this.rideGates))
    if (this.buildingModelsStale) {
      disposeChildren(this.buildings)
      this.buildingModels.clear()
      this.buildingModelsStale = false
    } else if (this.staticBuildingBatches) {
      // The instanced batches copy the models' static meshes; they are rebuilt below.
      // Their geometries and material belong to the models, so only the instance
      // buffers go.
      for (const batch of this.staticBuildingBatches.children) if (batch instanceof InstancedMesh) batch.dispose()
      this.buildings.remove(this.staticBuildingBatches)
    }
    const paths = new Map(items.filter(b => b.kind === 'path').map(b => [b.id, { x: b.x, z: b.z, elevation: b.elevation, slope: b.pathSlope ?? 0, direction: b.pathSlopeDirection ?? 0, road: false } satisfies WayStructureCell]))
    const roadCells = this.currentSnapshot?.logistics.roadCells ?? []
    const wayIndex = indexWayStructures([...paths.values(), ...roadCells.map(r => ({ x:r.x, z:r.z, elevation:r.elevation ?? getTerrainHeight(this.currentSnapshot!.terrain,r.x,r.z), slope:r.roadSlope ?? 0, direction:r.roadSlopeDirection ?? 0, road:true }))])
    const fohVariants = this.fohVariants(items)
    const byTile = new Map<string, PlacedBuilding[]>()
    for (const item of items) {
      const footprint = stageSize(item.stageDesign, item.rotation)
      for (let x = item.x; x < item.x + Math.ceil(footprint.width); x++) for (let z = item.z; z < item.z + Math.ceil(footprint.depth); z++) {
        const tile = `${x},${z}`
        const list = byTile.get(tile)
        if (list) list.push(item); else byTile.set(tile, [item])
      }
    }
    const roadsByTile = new Map<string, RoadCell[]>()
    for (const road of roadCells) {
      const tile = `${road.x},${road.z}`
      const list = roadsByTile.get(tile)
      if (list) list.push(road); else roadsByTile.set(tile, [road])
    }
    const seen = new Set<string>()
    items.forEach((item) => {
      if (
        item.kind === 'ambulanceGarage' ||
        item.kind === 'busDepot' ||
        item.kind === 'wasteDepot' ||
        item.kind === 'specialDepot' ||
        item.kind === 'busStop'
      ) {
        return
      }
      seen.add(item.id)
      const key = `${this.hashBuilding(1, item)}:${this.buildingContextKey(item, byTile, roadsByTile)}`
      const existing = this.buildingModels.get(item.id)
      if (existing?.key === key) return
      if (existing) {
        this.buildings.remove(existing.model)
        disposeObject3D(existing.model)
      }
      const model = item.rideType === 'bungee' ? createBungeeModel(item.bungeeHeight ?? 20) : item.stageDesign
        ? createStageModel(item.stageDesign)
        : this.createBuildingModel(
        item.kind,
        item.elevation,
        item.pathType,
        item.pathSlope ?? 0,
        item.kind === 'path' ? wayInfo(this.currentSnapshot!, item.x, item.z, 'foot', item.wayType).color : undefined,
        item.wayType ?? this.currentSnapshot?.festival.infrastructure.ground[`${item.x},${item.z}`]?.footway,
        fohVariants.get(item.id),
        item.kind === 'path' && this.pathSharesRoadGrade(item),
      )
      if (item.stageDesign) { model.scale.set((stageSize(item.stageDesign).width-.04)/item.stageDesign.width, item.stageDesign.tileWidth ? 1/STAGE_TILE_DETAIL : .96/Math.max(item.stageDesign.width,item.stageDesign.depth), (stageSize(item.stageDesign).depth-.04)/item.stageDesign.depth); model.userData.stageDesign = item.stageDesign }
      model.position.set(item.x + stageSize(item.stageDesign,item.rotation).width/2, item.elevation, item.z + stageSize(item.stageDesign,item.rotation).depth/2)
      const modelDirection =
        item.kind === 'path'
          ? item.pathSlope
            ? item.pathSlopeDirection ?? 0
            : 0
          : item.rotation
      model.rotation.y = modelDirection * (Math.PI / 2)
      if (item.decorationSlot !== undefined && isScenery(item.kind)) {
        const placement = sceneryTransform(item)
        model.position.set(item.x + placement.x, item.elevation, item.z + placement.z)
        model.rotation.y = placement.rotation * Math.PI / 2
        model.scale.set(placement.sx, placement.sy, placement.sz)
      }
      if (!isFacade(item.kind) && isScenery(item.kind) && this.terrainShape && this.currentSnapshot) {
        model.position.y += this.terrainShape.sample(model.position.x, model.position.z) - getTerrainHeight(this.currentSnapshot.terrain, item.x, item.z)
      }
      if (item.kind === 'path' && !this.pathSharesRoadGrade(item)) {
        const cell = paths.get(item.id)!
        const ground = getTerrainHeight(this.currentSnapshot!.terrain, item.x, item.z)
        const solids = tileSupportSolids(
          this.currentSnapshot!.buildings,
          item.x,
          item.z,
          item.id,
          this.currentSnapshot!.logistics.roadCells,
        )
        const solidTop = solids.reduce((max, span) => Math.max(max, span.top), Number.NEGATIVE_INFINITY)
        const plan = wayStructurePlan(cell, wayIndex, ground, {
          landAt: (lx, lz) => this.terrainShape?.sample(item.x + 0.5 + lx, item.z + 0.5 + lz) ?? ground,
          solidTop: Number.isFinite(solidTop) ? solidTop : undefined,
        })
        // Queue lanes already have their own rails, but retain the shared slim supports.
        if (item.pathType === 'queue') plan.raised = false
        const structure = createWayStructure(cell, plan)
        if (structure) model.add(structure)
      }
      if (item.kind === 'path' && item.pathType === 'queue') {
        this.addQueueBarriers(model, item, items)
      }
      this.attachOccupancySupports(model, item)
      model.userData.isStage = item.kind === 'stage'
      model.userData.buildingId = item.id
      this.buildingModels.set(item.id, { model, key })
      this.buildings.add(model)
    })
    for (const [id, entry] of this.buildingModels) {
      if (seen.has(id)) continue
      this.buildings.remove(entry.model)
      disposeObject3D(entry.model)
      this.buildingModels.delete(id)
    }
    // The lists the frame reads every tick are drawn from the models that are there
    // now, in the order the site lists them.
    this.soundWaveGroups = []
    this.nightLightMaterials = []
    this.nightLightBuildingIds = []
    for (const item of items) {
      const model = this.buildingModels.get(item.id)?.model
      if (!model) continue
      const soundWaves = model.userData.soundWaves as Group | undefined
      if (soundWaves) this.soundWaveGroups.push(soundWaves)
      const nightLightMaterial = model.userData.nightLightMaterial as MeshStandardMaterial | undefined
      if (nightLightMaterial) {
        this.nightLightMaterials.push(nightLightMaterial)
        this.nightLightBuildingIds.push(item.id)
      }
    }
    this.staticBuildingBatches = batchRetroBuildings(this.buildings)
    this.buildings.add(this.staticBuildingBatches)
    for (const batch of this.staticBuildingBatches.children) {
      if (!(batch instanceof Mesh) || !batch.userData.facade) continue
      this.facadeReveal ??= new FacadeReveal(batch.material as MeshStandardMaterial)
      batch.material = this.facadeReveal.material
    }
    this.facadeReveal?.setTarget(null)
  }

  private pathSharesRoadGrade(item: PlacedBuilding): boolean {
    if (!this.currentSnapshot) return false
    return this.currentSnapshot.logistics.roadCells.some((cell) => {
      if (cell.x !== item.x || cell.z !== item.z) return false
      const roadElevation =
        cell.elevation ?? getTerrainHeight(this.currentSnapshot!.terrain, item.x, item.z)
      return wayOverlapsRoadGrade(item.elevation, item.pathSlope ?? 0, roadElevation)
    })
  }

  private createBuildingModel(
    kind: BuildingKind,
    _elevation: number,
    pathType: 'normal' | 'queue' = 'normal',
    pathSlope = 0,
    surfaceColor?: number,
    wayType?: WayType,
    variant?: string,
    onRoad = false,
  ): Group {
    if ((LOGISTICS_FACILITY_KINDS as readonly string[]).includes(kind)) {
      const facility = createLogisticsFacility(kind as LogisticsFacilityKind)
      return facility
    }
    const detailed = createRetroBuilding(kind, variant)
    if (detailed) {
      if (kind === 'directionalSpeaker' || kind === 'omniSpeaker') {
        const soundWaves = this.createSoundWaves(kind === 'omniSpeaker')
        detailed.add(soundWaves)
        detailed.userData.soundWaves = soundWaves
      }
      return detailed
    }
    const group = new Group()
    const definition = BUILDINGS[kind]
    const material = new MeshStandardMaterial({ color: surfaceColor ?? definition.color, roughness: 0.7 })
    const darkMaterial = new MeshStandardMaterial({
      color: new Color(definition.color).multiplyScalar(0.7),
      roughness: 0.75,
    })

    if (kind === 'path') {
      const pathMaterial =
        pathType === 'queue'
          ? new MeshStandardMaterial({ color: 0x4f8870, roughness: 0.8 })
          : material
      pathMaterial.map = wayTexture(wayType ?? 'footPaved')
      const surface = new Group()
      const crossing = onRoad && pathType !== 'queue'
      const pathLength = Math.hypot(1, pathSlope)
      const path = new Mesh(
        new BoxGeometry(crossing ? 0.42 : 1, crossing ? 0.04 : 0.08, pathLength),
        pathMaterial,
      )
      path.position.y = crossing ? 0.03 : 0.04
      path.receiveShadow = true
      surface.add(path)
      if (pathSlope !== 0) {
        surface.position.set(0, -pathSlope / 2, 0)
        surface.quaternion.setFromUnitVectors(
          new Vector3(0, 0, 1),
          new Vector3(0, pathSlope, 1).normalize(),
        )
      }
      group.add(surface)
      return group
    }

    if (kind === 'tree') {
      const trunk = new Mesh(this.treeTrunkGeometry, this.treeTrunkMaterial)
      const crown = new Mesh(this.treeCrownGeometry, this.treeCrownMaterial)
      trunk.position.y = 0.4
      crown.position.y = 1.22
      group.add(trunk, crown)
    } else if (kind === 'hedge') {
      const hedge = new Mesh(
        new BoxGeometry(0.88, 0.52, 0.32),
        this.hedgeMaterial,
      )
      hedge.position.y = 0.26
      group.add(hedge)
    } else if (kind === 'fence') {
      const fence = new Group()
      const metal = new MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.55 })
      const orange = new MeshStandardMaterial({ color: 0xe67a22, roughness: 0.7 })
      const white = new MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.65 })
      ;[-0.4, 0.4].forEach((x) => {
        const post = new Mesh(new BoxGeometry(0.055, 1.08, 0.055), metal)
        post.position.set(x, 0.54, 0)
        fence.add(post)
      })
      ;[0.18, 0.4, 0.62, 0.84].forEach((y, index) => {
        const slat = new Mesh(
          new BoxGeometry(0.86, 0.16, 0.03),
          index % 2 === 0 ? orange : white,
        )
        slat.position.set(0, y, 0)
        fence.add(slat)
      })
      const foot = new Mesh(new BoxGeometry(0.9, 0.06, 0.08), metal)
      foot.position.y = 0.03
      fence.add(foot)
      fence.position.z = 0.42
      group.add(fence)
    } else if (isWasteBin(kind)) {
      const can = new Mesh(
        new CylinderGeometry(0.11, 0.13, 0.38, 10),
        new MeshStandardMaterial({ color: 0x3f4a3a, roughness: 0.7 }),
      )
      const rim = new Mesh(
        new CylinderGeometry(0.13, 0.13, 0.04, 10),
        new MeshStandardMaterial({ color: 0x2a3226, roughness: 0.6 }),
      )
      can.position.y = 0.22
      rim.position.y = 0.42
      group.add(can, rim)
    } else if (kind === 'bench') {
      const bench = new Group()
      const wood = new MeshStandardMaterial({ color: 0x98643c, roughness: 0.85 })
      const seat = new Mesh(new BoxGeometry(0.62, 0.07, 0.2), wood)
      const back = new Mesh(new BoxGeometry(0.62, 0.26, 0.06), wood)
      const legs = new Mesh(new BoxGeometry(0.5, 0.22, 0.06), darkMaterial)
      seat.position.y = 0.28
      back.position.set(0, 0.42, -0.1)
      legs.position.y = 0.13
      bench.position.z = 0.34
      bench.add(seat, back, legs)
      group.add(bench)
    } else if (kind === 'table') {
      const table = new Group()
      const wood = new MeshStandardMaterial({ color: 0xb07a48, roughness: 0.8 })
      const top = new Mesh(new BoxGeometry(0.7, 0.06, 0.7), wood)
      const pedestal = new Mesh(new BoxGeometry(0.12, 0.38, 0.12), darkMaterial)
      top.position.y = 0.48
      pedestal.position.y = 0.22
      table.add(top, pedestal)
      group.add(table)
    } else if (kind === 'lighting') {
      const pole = new Mesh(new CylinderGeometry(0.035, 0.055, 1.45, 8), darkMaterial)
      const lampMaterial = new MeshStandardMaterial({
        color: 0xffe79a,
        emissive: 0x9a761d,
        emissiveIntensity: 0.2,
      })
      const lamp = new Mesh(
        new SphereGeometry(0.16, 10, 8),
        lampMaterial,
      )
      pole.position.y = 0.72
      lamp.position.y = 1.5
      group.add(pole, lamp)
      group.userData.nightLightMaterial = lampMaterial
    } else if (kind === 'lightBalloon') {
      const ballast = new Mesh(new BoxGeometry(0.3, 0.16, 0.24), darkMaterial)
      ballast.position.y = 0.09
      const crate = new Mesh(
        new BoxGeometry(0.18, 0.12, 0.16),
        new MeshStandardMaterial({ color: 0x3d4a55, roughness: 0.7 }),
      )
      crate.position.set(0.18, 0.07, 0.1)
      const balloonMaterial = new MeshStandardMaterial({
        color: 0xf4f7ff,
        emissive: 0xc8d4ee,
        emissiveIntensity: 0.15,
        roughness: 0.42,
      })
      const balloon = new Mesh(new SphereGeometry(0.54, 14, 10), balloonMaterial)
      balloon.position.y = 2.35
      balloon.scale.set(1, 0.9, 1)
      const ring = new Mesh(new CylinderGeometry(0.15, 0.15, 0.05, 10), darkMaterial)
      ring.position.y = 1.84
      const ropeMaterial = new MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.85 })
      ;[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].forEach((angle) => {
        const rope = new Mesh(new CylinderGeometry(0.012, 0.012, 1.88, 5), ropeMaterial)
        rope.position.set(Math.sin(angle) * 0.2, 0.96, Math.cos(angle) * 0.2)
        rope.rotation.z = Math.sin(angle) * 0.14
        rope.rotation.x = -Math.cos(angle) * 0.14
        group.add(rope)
      })
      group.add(ballast, crate, balloon, ring)
      group.userData.nightLightMaterial = balloonMaterial
    } else if (kind === 'generator' || kind === 'backupGenerator') {
      const body = new Mesh(
        new BoxGeometry(0.72, 0.42, 0.52),
        new MeshStandardMaterial({ color: kind === 'generator' ? 0xd4a017 : 0x8a7020 }),
      )
      const tank = new Mesh(
        new CylinderGeometry(0.16, 0.16, 0.38, 10),
        darkMaterial,
      )
      body.position.y = 0.24
      tank.position.set(0.28, 0.28, 0)
      tank.rotation.z = Math.PI / 2
      group.add(body, tank)
    } else if (kind === 'foh') {
      const desk = new Mesh(new BoxGeometry(0.82, 0.28, 0.48), darkMaterial)
      const canopy = new Mesh(new BoxGeometry(0.9, 0.06, 0.7), material)
      desk.position.y = 0.42
      canopy.position.y = 1.12
      group.add(desk, canopy)
    } else if (kind === 'delayTower') {
      const mast = new Mesh(new CylinderGeometry(0.05, 0.08, 2.1, 8), darkMaterial)
      const stack = new Mesh(new BoxGeometry(0.42, 0.7, 0.28), material)
      mast.position.y = 1.05
      stack.position.set(0, 1.55, 0.08)
      group.add(mast, stack)
    } else if (kind === 'videoWall') {
      const frame = new Mesh(new BoxGeometry(0.92, 1.55, 0.12), darkMaterial)
      const screen = new Mesh(
        new BoxGeometry(0.82, 1.28, 0.04),
        new MeshStandardMaterial({
          color: 0x4aa3ff,
          emissive: 0x1a4d8f,
          emissiveIntensity: 0.7,
        }),
      )
      frame.position.y = 0.9
      screen.position.set(0, 0.9, 0.06)
      group.add(frame, screen)
    } else if (kind === 'laserShow') {
      const base = new Mesh(new CylinderGeometry(0.22, 0.28, 0.22, 10), darkMaterial)
      const head = new Mesh(
        new SphereGeometry(0.16, 10, 8),
        new MeshStandardMaterial({
          color: 0x2ee6a6,
          emissive: 0x0b5c44,
          emissiveIntensity: 0.8,
        }),
      )
      base.position.y = 0.12
      head.position.y = 0.42
      group.add(base, head)
    } else if (kind === 'fireworkBattery') {
      const crate = new Mesh(new BoxGeometry(0.7, 0.28, 0.48), material)
      crate.position.y = 0.16
      group.add(crate)
      ;[-0.16, 0, 0.16].forEach((x) => {
        const tube = new Mesh(new CylinderGeometry(0.05, 0.05, 0.42, 8), darkMaterial)
        tube.position.set(x, 0.45, 0)
        group.add(tube)
      })
    } else if (kind === 'stage') {
      const platform = new Mesh(new BoxGeometry(0.94, 0.28, 0.82), darkMaterial)
      const backdrop = new Mesh(new BoxGeometry(0.94, 1.55, 0.12), material)
      platform.position.y = 0.14
      backdrop.position.set(0, 1.02, -0.35)
      group.add(platform, backdrop)
    } else if (kind === 'directionalSpeaker' || kind === 'omniSpeaker') {
      const stand = new Mesh(
        new CylinderGeometry(0.035, 0.06, 0.72, 7),
        darkMaterial,
      )
      stand.position.y = 0.36
      group.add(stand)
      const angles = kind === 'omniSpeaker' ? [0, Math.PI / 2, Math.PI, -Math.PI / 2] : [0]
      angles.forEach((angle) => {
        const speaker = new Mesh(
          new BoxGeometry(0.28, 0.42, 0.22),
          new MeshStandardMaterial({ color: 0x24262c, roughness: 0.7 }),
        )
        speaker.position.set(Math.sin(angle) * 0.16, 0.9, Math.cos(angle) * 0.16)
        speaker.rotation.y = angle
        group.add(speaker)
      })
      const soundWaves = this.createSoundWaves(kind === 'omniSpeaker')
      group.add(soundWaves)
      group.userData.soundWaves = soundWaves
    } else if (kind === 'securityGate') {
      const postGeometry = new BoxGeometry(0.12, 1.05, 0.12)
      const left = new Mesh(postGeometry, darkMaterial)
      const right = new Mesh(postGeometry, darkMaterial)
      const top = new Mesh(new BoxGeometry(0.88, 0.14, 0.14), material)
      const scanner = new Mesh(
        new BoxGeometry(0.58, 0.08, 0.08),
        new MeshStandardMaterial({ color: 0x63d6e8, emissive: 0x184b58 }),
      )
      left.position.set(-0.38, 0.53, 0)
      right.position.set(0.38, 0.53, 0)
      top.position.y = 1.03
      scanner.position.set(0, 0.62, 0)
      group.add(left, right, top, scanner)
    } else if (kind === 'ride') {
      const base = new Mesh(new CylinderGeometry(0.43, 0.48, 0.16, 16), darkMaterial)
      const roof = new Mesh(new CylinderGeometry(0.06, 0.48, 0.28, 12), material)
      const mast = new Mesh(new CylinderGeometry(0.045, 0.06, 1.1, 8), darkMaterial)
      base.position.y = 0.08
      mast.position.y = 0.65
      roof.position.y = 1.18
      group.add(base, mast, roof)
    } else {
      const body = new Mesh(new BoxGeometry(0.76, 0.72, 0.76), material)
      const roof = new Mesh(new BoxGeometry(0.9, 0.14, 0.9), darkMaterial)
      body.position.y = 0.36
      roof.position.y = 0.79
      group.add(body, roof)

      if (kind === 'food' || kind === 'alcohol' || kind === 'mascot' || kind === 'shirt') {
        const counterMaterial = new MeshStandardMaterial({ color: 0xfff4d6 })
        for (const [x, z, yaw] of [
          [0, 0.43, 0],
          [0, -0.43, 0],
          [0.43, 0, Math.PI / 2],
          [-0.43, 0, Math.PI / 2],
        ] as const) {
          const counter = new Mesh(new BoxGeometry(0.58, 0.22, 0.12), counterMaterial)
          counter.position.set(x, 0.35, z)
          counter.rotation.y = yaw
          group.add(counter)
        }
      }
      if (kind === 'alcohol') {
        const keg = new Mesh(
          new CylinderGeometry(0.16, 0.16, 0.3, 10),
          new MeshStandardMaterial({ color: 0x8a5b32, roughness: 0.85 }),
        )
        const cup = new Mesh(
          new CylinderGeometry(0.055, 0.045, 0.15, 8),
          new MeshStandardMaterial({
            color: 0xf2c14e,
            transparent: true,
            opacity: 0.85,
          }),
        )
        keg.rotation.z = Math.PI / 2
        keg.position.set(-0.18, 0.58, 0.28)
        cup.position.set(0.2, 0.57, 0.34)
        group.add(keg, cup)
      }
    }

    if (['food', 'toilet', 'ride', 'alcohol', 'mascot', 'shirt', 'securityGate'].includes(kind)) {
      const arrow = new Mesh(
        new ConeGeometry(0.13, 0.32, 3),
        new MeshStandardMaterial({ color: 0xffe052, emissive: 0x6b5200 }),
      )
      arrow.position.set(0, 0.32, 0.62)
      arrow.rotation.x = Math.PI / 2
      group.add(arrow)
    }
    group.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
    return group
  }

  private createSoundWaves(omnidirectional: boolean): Group {
    const group = new Group()
    group.position.y = 0.92
    group.userData.omnidirectional = omnidirectional
    const segmentCount = omnidirectional ? 48 : 20
    const startAngle = omnidirectional ? 0 : -Math.PI / 3
    const endAngle = omnidirectional ? Math.PI * 2 : Math.PI / 3
    const points = Array.from({ length: segmentCount + 1 }, (_, index) => {
      const angle =
        startAngle + ((endAngle - startAngle) * index) / segmentCount
      return new Vector3(Math.sin(angle), 0, Math.cos(angle))
    })
    for (let index = 0; index < 3; index += 1) {
      const material = new LineBasicMaterial({
        color: omnidirectional ? 0xbc7cff : 0x6fe4ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
      const wave = new Line(new BufferGeometry().setFromPoints(points), material)
      wave.userData.phaseOffset = index / 3
      wave.renderOrder = 8
      group.add(wave)
    }
    return group
  }

  private updateSoundWaves(active: boolean): void {
    if (!active && this.soundWaveGroups.every((group) => !group.visible)) return
    const time = performance.now() * 0.00055
    this.soundWaveGroups.forEach((group) => {
      group.visible = active
      if (!active) return
      const maximumScale = group.userData.omnidirectional ? 1.8 : 2.25
      group.children.forEach((child) => {
        if (!(child instanceof Line)) return
        const phase = (time + Number(child.userData.phaseOffset ?? 0)) % 1
        const scale = 0.18 + phase * maximumScale
        child.scale.set(scale, scale, scale)
        child.position.y = Math.sin(phase * Math.PI) * 0.045
        ;(child.material as LineBasicMaterial).opacity =
          Math.sin(phase * Math.PI) * 0.58
      })
    })
  }

  private updateDayNight(snapshot: Readonly<GameSnapshot>): void {
    const minute = Math.floor(snapshot.minute)
    const powerKey = `${snapshot.power.poweredBuildingIds.join(',')}:${snapshot.power.supply}`
    if (minute === this.lastDayMinute && powerKey === this.lastPowerKey) return
    this.lastDayMinute = minute
    this.lastPowerKey = powerKey
    const config = SIMULATION_CONFIG.dayNight
    const dayLength = SIMULATION_CONFIG.time.minutesPerDay
    const normalizedMinute = ((minute % dayLength) + dayLength) % dayLength
    const dayDuration = config.sunsetMinute - config.sunriseMinute
    const sunProgress = MathUtils.clamp(
      (normalizedMinute - config.sunriseMinute) / dayDuration,
      0,
      1,
    )
    const sunAngle = sunProgress * Math.PI
    let daylight = 0
    if (
      normalizedMinute >= config.sunriseMinute &&
      normalizedMinute <= config.sunsetMinute
    ) {
      daylight = 0.35 + Math.sin(sunAngle) * 0.65
    } else if (
      normalizedMinute >= config.sunriseMinute - config.twilightMinutes &&
      normalizedMinute < config.sunriseMinute
    ) {
      daylight =
        ((normalizedMinute -
          (config.sunriseMinute - config.twilightMinutes)) /
          config.twilightMinutes) *
        0.35
    } else if (
      normalizedMinute > config.sunsetMinute &&
      normalizedMinute <= config.sunsetMinute + config.twilightMinutes
    ) {
      daylight =
        (1 -
          (normalizedMinute - config.sunsetMinute) /
            config.twilightMinutes) *
        0.35
    }
    const twilightGlow =
      daylight > 0 && daylight < 0.55
        ? 1 - Math.min(1, Math.abs(daylight - 0.28) / 0.28)
        : 0
    this.skyColor
      .copy(this.nightSkyColor)
      .lerp(this.daySkyColor, daylight)
      .lerp(this.twilightSkyColor, twilightGlow * 0.38)
    this.scene.background = this.skyColor
    this.ambientLight.intensity =
      config.minimumAmbientIntensity +
      daylight *
        (config.maximumAmbientIntensity - config.minimumAmbientIntensity)
    this.ambientLight.color
      .copy(this.nightAmbientColor)
      .lerp(this.daylightColor, daylight)
    const sunHeight = Math.max(0, Math.sin(sunAngle))
    this.sunLight.intensity = config.maximumSunIntensity * sunHeight
    this.sunLight.position.set(
      Math.cos(sunAngle) * 24,
      Math.max(0.5, sunHeight * 28),
      10,
    )
    this.sunLight.color
      .copy(this.twilightSunColor)
      .lerp(this.noonSunColor, Math.min(1, daylight * 1.5))
    const powered = new Set(snapshot.power.poweredBuildingIds)
    const lightsActive = isFestivalOfferActive(
      snapshot.dayPlan,
      'lights',
      snapshot.minute,
      snapshot.day,
    )
    this.nightLightMaterials.forEach((material, index) => {
      const hasPower = powered.has(this.nightLightBuildingIds[index] ?? '')
      material.emissiveIntensity =
        lightsActive && hasPower
          ? 0.15 + (1 - daylight) * config.nightLightEmissiveIntensity
          : 0.03
    })
  }

  private isShowPerforming(snapshot: Readonly<GameSnapshot>): boolean {
    if (
      !isFestivalOfferActive(
        snapshot.dayPlan,
        'stages',
        snapshot.minute,
        snapshot.day,
      )
    ) {
      return false
    }
    const performance = SIMULATION_CONFIG.atmosphere.stagePerformanceMinutes
    const cycle =
      performance + SIMULATION_CONFIG.atmosphere.stageBreakMinutes
    return snapshot.minute % cycle < performance
  }

  private attachOccupancySupports(group: Group, item: PlacedBuilding): void {
    if (isSupportlessKind(item.kind) || !this.terrainShape || !this.currentSnapshot) return
    const originX = group.position.x
    const originZ = group.position.z
    const footprint = stageSize(item.stageDesign, item.rotation)
    const offsets =
      footprint.width > 1.05 || footprint.depth > 1.05
        ? ([
            [-footprint.width / 2 + 0.22, -footprint.depth / 2 + 0.22],
            [footprint.width / 2 - 0.22, -footprint.depth / 2 + 0.22],
            [-footprint.width / 2 + 0.22, footprint.depth / 2 - 0.22],
            [footprint.width / 2 - 0.22, footprint.depth / 2 - 0.22],
          ] as const)
        : DEFAULT_SUPPORT_OFFSETS
    const gaps = offsets.map(([dx, dz]) => {
      const worldX = originX + dx
      const worldZ = originZ + dz
      const landY = this.terrainShape!.sample(worldX, worldZ)
      const solids = tileSupportSolids(
        this.currentSnapshot!.buildings,
        Math.floor(worldX),
        Math.floor(worldZ),
        item.id,
        this.currentSnapshot!.logistics.roadCells,
      )
      return supportGap(item.elevation, landY, solids)
    })
    attachSupportPosts(group, item.elevation, gaps, offsets)
  }

  private addQueueBarriers(
    group: Group,
    path: PlacedBuilding,
    items: readonly PlacedBuilding[],
  ): void {
    const material = new MeshStandardMaterial({ color: 0xe8ddbd, roughness: 0.75 })
    const arrowMaterial = new MeshStandardMaterial({
      color: 0xffdc58,
      emissive: 0x4b3a00,
    })

    if (path.pathSlope) {
      const rails = new Group()
      const length = Math.hypot(1, path.pathSlope) - 0.1
      const left = new Mesh(new BoxGeometry(0.055, 0.18, length), material)
      const right = left.clone()
      left.position.set(-0.42, 0.16, 0)
      right.position.set(0.42, 0.16, 0)
      rails.position.set(0, -path.pathSlope / 2, 0)
      rails.quaternion.setFromUnitVectors(
        new Vector3(0, 0, 1),
        new Vector3(0, path.pathSlope, 1).normalize(),
      )
      group.add(rails)
      rails.add(left, right)
      if (path.queueSplit) {
        const divider = new Mesh(new BoxGeometry(0.04, 0.16, length), material)
        divider.position.set(0, 0.16, 0)
        rails.add(divider)
      }
    } else {
      const openings = new Set<number>()
      if (path.queueDirection !== undefined) openings.add(path.queueDirection)
      const incomingQueuePaths = items.filter((candidate) => {
        if (
          candidate.kind !== 'path' ||
          candidate.pathType !== 'queue' ||
          candidate.elevation !== path.elevation ||
          Math.abs(candidate.x - path.x) + Math.abs(candidate.z - path.z) !== 1
        ) {
          return false
        }
        const towardPath = this.getGridDirection(path.x - candidate.x, path.z - candidate.z)
        return candidate.queueDirection === towardPath
      })
      incomingQueuePaths.forEach((candidate) => {
        openings.add(this.getGridDirection(candidate.x - path.x, candidate.z - path.z))
      })
      if (path.queueEntryDirection !== undefined) {
        openings.add((path.queueEntryDirection + 2) % 4)
      }

      for (let direction = 0; direction < 4; direction += 1) {
        if (openings.has(direction)) continue
        const alongX = direction === 0 || direction === 2
        const wall = new Mesh(
          new BoxGeometry(alongX ? 0.88 : 0.055, 0.18, alongX ? 0.055 : 0.88),
          material,
        )
        wall.position.set(
          direction === 1 ? 0.44 : direction === 3 ? -0.44 : 0,
          0.16,
          direction === 0 ? 0.44 : direction === 2 ? -0.44 : 0,
        )
        group.add(wall)
      }
      if (path.queueSplit && path.queueDirection !== undefined) {
        const alongZ = path.queueDirection === 0 || path.queueDirection === 2
        const divider = new Mesh(
          new BoxGeometry(alongZ ? 0.04 : 0.88, 0.16, alongZ ? 0.88 : 0.04),
          material,
        )
        divider.position.set(0, 0.16, 0)
        group.add(divider)
      }
    }

    if (path.queueDirection !== undefined) {
      const headingSteps =
        ((path.queueDirection - (path.pathSlope ? path.pathSlopeDirection ?? 0 : 0) + 4) % 4)
      const heading = headingSteps * (Math.PI / 2)
      const arrowY = path.pathSlope ? -path.pathSlope / 2 + 0.15 : 0.12
      const placeArrow = (lane: 'inbound' | 'outbound') => {
        const arrow = new Mesh(new ConeGeometry(0.09, 0.24, 3), arrowMaterial)
        const shift = path.queueSplit
          ? stallQueueLaneOffset(queueDirectionVector(headingSteps), lane)
          : { x: 0, z: 0 }
        arrow.position.set(shift.x, arrowY, shift.z)
        arrow.rotation.set(
          Math.PI / 2,
          lane === 'outbound' ? heading + Math.PI : heading,
          0,
        )
        group.add(arrow)
      }
      placeArrow('inbound')
      if (path.queueSplit) placeArrow('outbound')
    }
  }

  private getGridDirection(deltaX: number, deltaZ: number): number {
    if (deltaZ > 0) return 0
    if (deltaX > 0) return 1
    if (deltaZ < 0) return 2
    return 3
  }

  private rebuildCoasters(coasters: readonly Coaster[]): void {
    disposeChildren(this.coasterTracks)
    const trackHeightsByCell = new Map<string, number[]>()
    coasters.forEach((coaster) => {
      coaster.pieces.forEach((piece) => {
        piece.points.forEach((point) => {
          const key = `${Math.round(point.x)}:${Math.round(point.z)}`
          const heights = trackHeightsByCell.get(key) ?? []
          heights.push(point.y)
          trackHeightsByCell.set(key, heights)
        })
      })
    })
    coasters.forEach((coaster) => {
      const type = getCoasterType(coaster.typeId)
      const coasterGroup = new Group()
      coasterGroup.userData.coasterId = coaster.id
      const smoothedPieces = getSmoothedCoasterPiecePoints(coaster)
      const wrapJoins = Boolean(coaster.closed)
      coaster.pieces.forEach((piece, pieceIndex) => {
        const special = createCoasterSpecial(piece)
        if (special) { special.userData.coasterId = coaster.id; special.userData.pieceIndex = pieceIndex; coasterGroup.add(special) }
        const display = smoothedPieces[pieceIndex] ?? piece.points
        const prevIndex = pieceIndex > 0 ? pieceIndex - 1 : wrapJoins ? smoothedPieces.length - 1 : -1
        const nextIndex = pieceIndex + 1 < smoothedPieces.length ? pieceIndex + 1 : wrapJoins ? 0 : -1
        const prevPoints = prevIndex >= 0 ? smoothedPieces[prevIndex] : undefined
        const nextPoints = nextIndex >= 0 ? smoothedPieces[nextIndex] : undefined
        const prevGhost = prevPoints && prevPoints.length >= 2 ? prevPoints[prevPoints.length - 2] : undefined
        const nextGhost = nextPoints && nextPoints.length >= 2 ? nextPoints[1] : undefined
        const frames = display.map((point, index) => {
          const previous =
            index === 0 && prevGhost ? prevGhost : display[Math.max(0, index - 1)] ?? point
          const next =
            index === display.length - 1 && nextGhost
              ? nextGhost
              : display[Math.min(display.length - 1, index + 1)] ?? point
          return computeTrackFrame(
            {
              x: next.x - previous.x,
              y: next.y - previous.y,
              z: next.z - previous.z,
            },
            point.bank ?? 0,
            point.pitch ?? 0,
            point.frameHeading,
          )
        })
        const centerPoints = display.map(
          (point) => new Vector3(point.x + 0.5, point.y + 0.24, point.z + 0.5),
        )
        const trackPiece = createStyledCoasterTrackPiece({
          styleId: type.trackStyle,
          kind: piece.kind,
          chainLift: piece.chainLift,
          display,
          frames,
          centerPoints,
          trackHeightsByCell,
          railColor: type.railColor,
          structureColor: type.color,
          landAt: (x, z) => this.terrainShape?.sample(x, z) ?? 0,
          solidTopAt: (x, z) => {
            const solids = tileSupportSolids(
              this.currentSnapshot?.buildings ?? [],
              Math.floor(x),
              Math.floor(z),
              undefined,
              this.currentSnapshot?.logistics.roadCells ?? [],
            )
            return solids.reduce((max, span) => Math.max(max, span.top), 0)
          },
        })
        trackPiece.userData.coasterId = coaster.id
        trackPiece.userData.pieceIndex = pieceIndex
        trackPiece.traverse((object) => {
          object.userData.coasterId = coaster.id
          object.userData.pieceIndex = pieceIndex
        })
        coasterGroup.add(trackPiece)
      })

      for (const kind of ['entrance', 'exit'] as const) {
        const access = coaster[kind]
        if (!access) continue
        const gate = this.createCoasterAccess(access, kind, 'coaster')
        const station = coaster.pieces.find(piece => piece.kind === 'station'
          && Math.abs(piece.start.x - access.x) + Math.abs(piece.start.z - access.z) === 1
          && Math.abs(piece.start.elevation - access.y) < .01)
        if (station) gate.rotation.y = Math.atan2(station.start.x - access.x, station.start.z - access.z)
        gate.userData.coasterId = coaster.id
        coasterGroup.add(gate)
      }
      this.coasterTracks.add(coasterGroup)
    })
  }

  private createCoasterAccess(
    access: { x: number; y: number; z: number },
    kind: AccessKind,
    theme: AccessTheme,
  ): Group {
    const group = createAttractionAccess(kind, theme)
    group.position.set(access.x + 0.5, access.y, access.z + 0.5)
    return group
  }

  private updateCoasterTrains(
    coasters: readonly Coaster[],
    visitors: readonly Visitor[],
  ): void {
    this.trainVisitorsById.clear()
    visitors.forEach((visitor) => {
      this.trainVisitorsById.set(visitor.id, visitor)
    })
    const activeIds = new Set(coasters.map((coaster) => coaster.id))
    this.trainModels.forEach((model, id) => {
      if (!activeIds.has(id)) {
        this.coasterTrains.remove(model)
        disposeObject3D(model)
        this.trainModels.delete(id)
      }
    })

    coasters.forEach((coaster) => {
      let model = this.trainModels.get(coaster.id)
      const activePiece = coaster.train.state === 'running' ? sampleCoasterTrack(coaster, coaster.train.distance)?.pieceId : null
      const trackGroup = this.coasterTracks.children.find(g => g.userData.coasterId === coaster.id)
      for (const piece of trackGroup?.children ?? []) if (piece.userData.effect) piece.userData.effect.visible = piece.userData.pieceId === activePiece && !this.logisticsMode
      if (!model || model.userData.cars !== coaster.train.cars || model.userData.trainStyle !== getCoasterType(coaster.typeId).trainStyle) {
        if (model) {
          this.coasterTrains.remove(model)
          disposeObject3D(model)
        }
        model = this.createTrainModel(coaster)
        this.trainModels.set(coaster.id, model)
        this.coasterTrains.add(model)
      }
      const type = getCoasterType(coaster.typeId)
      const physics = type.physics
      const hang = type.trainStyle === 'invertV' || type.trainStyle === 'flying' || type.trainStyle === 'swinging' ? -0.12 : 0
      const leadDistance =
        this.interpolatedTrainDistance(coaster) +
        Math.max(0, coaster.train.cars - 1) * physics.carSpacing
      model.children.forEach((car, index) => {
        const sample = sampleCoasterTrack(
          coaster,
          leadDistance - index * physics.carSpacing,
        )
        if (!sample) return
        car.position.set(sample.point.x + 0.5, sample.point.y + 0.3 + hang, sample.point.z + 0.5)
        this.trainForward.set(
          sample.tangent.x,
          sample.tangent.y,
          sample.tangent.z,
        )
        this.trainRight.set(sample.right.x, sample.right.y, sample.right.z)
        this.trainUp.set(sample.up.x, sample.up.y, sample.up.z)
        car.quaternion.setFromRotationMatrix(
          this.trainRotationMatrix.makeBasis(
            this.trainRight,
            this.trainUp,
            this.trainForward,
          ),
        )
        car.traverse((object) => {
          if (typeof object.userData.passengerSeat === 'number') {
            const passengerId = coaster.train.passengerIds[object.userData.passengerSeat]
            const visitor = passengerId
              ? this.trainVisitorsById.get(passengerId)
              : undefined
            object.visible = Boolean(visitor)
            if (visitor) {
              object.traverse((part) => {
                if (
                  part instanceof Mesh &&
                  part.userData.isPassengerShirt &&
                  part.material instanceof MeshStandardMaterial
                ) {
                  part.material.color.set(visitor.color)
                }
              })
            }
          }
        })
      })
      model.visible = coaster.pieces.length > 0
    })
  }

  private createTrainModel(coaster: Coaster): Group {
    const group = new Group()
    const type = getCoasterType(coaster.typeId)
    const seats = getCoasterCarSeats(type.trainStyle)
    for (let index = 0; index < coaster.train.cars; index += 1) {
      const carGroup = createCoasterCar(type.carColor, type.trainStyle, type.accentColor)
      for (let seat = 0; seat < type.carCapacity; seat += 1) {
        const passenger = this.createCarPassenger(index * type.carCapacity + seat, seats[seat] ?? seats[0]!)
        carGroup.add(passenger)
      }
      group.add(carGroup)
    }
    group.userData.cars = coaster.train.cars
    group.userData.trainStyle = type.trainStyle
    return group
  }

  private createCarPassenger(
    passengerSeat: number,
    place: { x: number; y: number; z: number },
  ): Group {
    const passenger = new Group()
    const shirtColors = [0xf05a5a, 0x4e9be8, 0xf0c34e, 0x67b878]
    const body = new Mesh(
      new CylinderGeometry(0.045, 0.055, 0.14, 6),
      new MeshStandardMaterial({ color: shirtColors[passengerSeat % shirtColors.length] }),
    )
    body.userData.isPassengerShirt = true
    const head = new Mesh(
      new SphereGeometry(0.045, 7, 5),
      new MeshStandardMaterial({ color: 0xf1bd8e }),
    )
    body.position.y = 0.16
    head.position.y = 0.27
    passenger.position.set(place.x, place.y, place.z)
    passenger.userData.passengerSeat = passengerSeat
    passenger.add(body, head)
    return passenger
  }

  private updateVisitors(visitors: readonly Visitor[]): void {
    if (this.personDetails.group.parent !== this.visitors) this.visitors.add(this.personDetails.group)
    if (this.souvenirProps.group.parent !== this.visitors) this.visitors.add(this.souvenirProps.group)
    this.personDetails.begin(Math.max(1, visitors.length))
    this.souvenirProps.begin(Math.max(1, visitors.length))
    this.ensureVisitorInstances(Math.max(1, visitors.length))
    const meshes = this.visitorPickMeshes
    if (meshes.length === 0) return
    if (this.visitorInstanceIds.length !== visitors.length) {
      this.visitorInstanceIds = visitors.map((visitor) => visitor.id)
      if (this.visitorSeedCache.size > visitors.length * 2 + 32) {
        const activeIds = new Set(this.visitorInstanceIds)
        for (const id of this.visitorSeedCache.keys()) {
          if (!activeIds.has(id)) this.visitorSeedCache.delete(id)
        }
      }
    } else {
      for (let index = 0; index < visitors.length; index += 1) {
        this.visitorInstanceIds[index] = visitors[index]!.id
      }
    }
    let buildingsById: Map<string, PlacedBuilding> | null = null
    const stageFocus = new Map<string, { x: number; z: number }>()
    for (const building of this.currentSnapshot?.buildings ?? []) {
      if (building.kind === 'stage') stageFocus.set(building.id, stageFocusPoint(building))
    }
    const floorStageIds = new Map<string, string | undefined>()
    for (const cell of this.currentSnapshot?.stageForecourtCells ?? []) {
      floorStageIds.set(`${cell.x},${cell.z}`, cell.stageId)
    }
    const now = performance.now()
    const lodRadius = 14 / Math.max(0.65, this.zoom)
    for (const batch of this.emotionInstances.values()) batch.count = 0
    let cartIndex = 0
    const hiddenMatrix = this.visitorHiddenMatrix
    const hiddenPassengers = new Set<string>()
    for (const vehicle of this.currentSnapshot?.logistics.roadVehicles ?? []) {
      for (const passengerId of vehicle.passengerIds) hiddenPassengers.add(passengerId)
    }
    const courseRiders = new Set(
      [
        ...(this.currentSnapshot?.courses ?? []).flatMap((course) =>
          course.riders.map((rider) => rider.visitorId),
        ),
        ...(this.currentSnapshot?.attractions ?? []).flatMap((attraction) =>
          attraction.runtime.kind === 'course'
            ? attraction.runtime.riders.map((rider) => rider.visitorId)
            : attraction.runtime.kind === 'scriptedRide'
              ? attraction.runtime.occupantIds
              : [],
        ),
      ],
    )

    visitors.forEach((visitor, index) => {
      const previous = this.previousVisitorPositions.get(visitor.id)
      const interpolate = previous && Math.hypot(previous.x - visitor.x, previous.z - visitor.z) < 5
      const x = interpolate ? previous.x + (visitor.x - previous.x) * this.renderAlpha : visitor.x
      const y = interpolate ? previous.y + (visitor.y - previous.y) * this.renderAlpha : visitor.y
      const z = interpolate ? previous.z + (visitor.z - previous.z) * this.renderAlpha : visitor.z
      const visible =
        !this.bungeeRiders.has(visitor.id) &&
        (visitor.state !== 'riding' || courseRiders.has(visitor.id)) &&
        visitor.state !== 'vehicle-arrival' &&
        visitor.state !== 'bus-riding' &&
        visitor.state !== 'medical' &&
        !hiddenPassengers.has(visitor.id) &&
        !(visitor.state === 'camping' && visitor.campingPhase === 'resting')
      if (!visible) {
        for (let meshIndex = 0; meshIndex < meshes.length; meshIndex += 1) {
          meshes[meshIndex]!.setMatrixAt(index, hiddenMatrix)
        }
        return
      }
      const streaking = visitor.streakingMinutes > 0
      const topless = !streaking && (visitor.toplessMinutes ?? 0) > 0
      const shirtless = streaking || topless
      const sitting =
        (visitor.state === 'socializing' &&
          visitor.campActivity === 'sitting') ||
        visitor.state === 'bench-resting'
      const swimming =
        visitor.state === 'swimming' && visitor.route.length === 0
      const moving =
        visitor.state !== 'sleeping' &&
        (visitor.route.length > 0 || courseRiders.has(visitor.id))
      const dx = visitor.x - this.cameraTarget.x
      const dz = visitor.z - this.cameraTarget.z
      const distance = Math.hypot(dx, dz)
      const detailed = distance < lodRadius
      const intoxication = Math.max(0, Math.min(1, (visitor.alcoholLevel - 25) / 60))
      let seed = this.visitorSeedCache.get(visitor.id)
      if (seed === undefined) {
        seed = personSeed(visitor.id)
        this.visitorSeedCache.set(visitor.id, seed)
      }
      const appearance = personStyle(seed)
      this.visitorSkinColor.setHex(appearance.skin)
      this.visitorPantsColor.setHex(appearance.trousers)
      const fleeing = visitor.isPanicking || visitor.state === 'panicking'
      const pace = fleeing
        ? 2.2
        : streaking
        ? 2.15
        : visitor.emotion === 'angry'
          ? 1.45
          : visitor.emotion === 'sad'
            ? 0.65
            : visitor.emotion === 'excited'
              ? 1.25
              : 1
      const phase = now * 0.009 * pace + seed
      const stride = detailed
        ? visitor.isDancing
          ? Math.sin(phase * 1.8)
          : moving
            ? Math.sin(phase)
            : 0
        : visitor.isDancing
          ? Math.sin(phase * 1.8)
          : moving
          ? Math.sin(phase * 0.7)
          : 0
      const jump = visitor.isDancing
        ? Math.max(0, Math.sin(phase * 1.15)) * (detailed ? 0.08 : 0.04)
        : detailed
          ? moving && (streaking || visitor.emotion === 'excited')
            ? Math.max(0, Math.sin(phase * 0.65)) * (streaking ? 0.16 : 0.11)
            : 0
        : 0
      const bob = moving && visitor.emotion !== 'sad' ? Math.abs(stride) * 0.018 : 0
      const wobble =
        detailed && moving ? Math.sin(phase * 0.43) * 0.09 * intoxication : 0
      const atSocialTarget =
        visitor.state === 'socializing' &&
        visitor.route.length === 0 &&
        Boolean(visitor.campActivityTarget)
      const socialAngle =
        (visitor.campActivitySlot / Math.max(2, visitor.campActivityCapacity)) *
        Math.PI *
        2
      const socialOffsetX = atSocialTarget ? Math.cos(socialAngle) * 0.2 : 0
      const socialOffsetZ = atSocialTarget ? Math.sin(socialAngle) * 0.2 : 0
      const atActivityTarget =
        (visitor.state === 'partying' ||
          visitor.state === 'bench-resting' ||
          visitor.state === 'relaxing') &&
        visitor.route.length === 0 &&
        Boolean(visitor.activityTarget)
      let activityOffsetX = 0
      let activityOffsetZ = 0
      if (
        atActivityTarget &&
        (visitor.state === 'partying' || visitor.state === 'relaxing')
      ) {
        activityOffsetX = (visitor.activitySlot % 3 - 1) * 0.27
        activityOffsetZ = (Math.floor(visitor.activitySlot / 3) - 1) * 0.27
      } else if (atActivityTarget && visitor.state === 'bench-resting') {
        const directions = [
          { x: 0, z: 1 },
          { x: 1, z: 0 },
          { x: 0, z: -1 },
          { x: -1, z: 0 },
        ]
        if (!buildingsById && this.currentSnapshot) {
          buildingsById = new Map(this.currentSnapshot.buildings.map((building) => [building.id, building]))
        }
        const benchRotation = visitor.targetId
          ? buildingsById?.get(visitor.targetId)?.rotation ?? 0
          : 0
        const direction = directions[benchRotation]!
        activityOffsetX =
          direction.x * 0.34 +
          direction.z * (visitor.activitySlot === 0 ? -0.15 : 0.15)
        activityOffsetZ =
          direction.z * 0.34 -
          direction.x * (visitor.activitySlot === 0 ? -0.15 : 0.15)
      }
      const displayX =
        atSocialTarget && visitor.campActivityTarget
          ? visitor.campActivityTarget.x + 0.5 + socialOffsetX
          : atActivityTarget && visitor.activityTarget
            ? visitor.activityTarget.x + 0.5 + activityOffsetX
            : x + Math.cos(visitor.facing) * wobble
      const displayZ =
        atSocialTarget && visitor.campActivityTarget
          ? visitor.campActivityTarget.z + 0.5 + socialOffsetZ
          : atActivityTarget && visitor.activityTarget
            ? visitor.activityTarget.z + 0.5 + activityOffsetZ
            : z - Math.sin(visitor.facing) * wobble
      const displayY =
        this.actorTerrainHeight(displayX, displayZ, y) +
        (visitor.state === 'sleeping' ? 0.12 : swimming ? -0.28 : sitting ? -0.02 : 0.04 + bob) +
        jump
      const scaleY =
        swimming ? 0.72 : sitting ? 0.84 : visitor.emotion === 'sad' && visitor.state !== 'sleeping' ? 0.92 : 1
      const stageFacing =
        atActivityTarget && visitor.state === 'partying' && visitor.activityTarget
          ? danceFloorFacing(
              visitor.activityTarget,
              visitor.concertId ?? null,
              floorStageIds,
              stageFocus,
            )
          : null
      const targetRotation = atSocialTarget
        ? Math.atan2(-socialOffsetX, -socialOffsetZ)
        : atActivityTarget
          ? visitor.state === 'bench-resting'
            ? visitor.facing
            : stageFacing ?? Math.atan2(-activityOffsetX, -activityOffsetZ)
          : visitor.route[0]
            ? Math.atan2(
                visitor.route[0].x + visitor.tileOffsetX - visitor.x,
                visitor.route[0].z + visitor.tileOffsetZ - visitor.z,
              )
            : visitor.facing
      const tilt =
        visitor.state === 'sleeping' ||
        visitor.state === 'injured' ||
        visitor.state === 'medical-transport'
          ? Math.PI / 2
          : detailed
            ? Math.sin(phase * 0.5) * 0.16 * intoxication
            : 0
      const strength =
        fleeing ? 1.2 : visitor.emotion === 'angry' ? 0.9 : visitor.emotion === 'sad' ? 0.32 : 0.65
      const limbSwing =
        visitor.state === 'sleeping' || visitor.state === 'medical-transport'
          ? 0
          : sitting || swimming
            ? Math.PI * 0.42
            : stride * (visitor.isDancing ? 1.15 : strength)
      const headTilt = visitor.emotion === 'sad' ? 0.35 : 0
      const wornShirt = !shirtless ? visitor.wornShirt : undefined
      const shirtColor = shirtless
        ? this.visitorSkinColor
        : fleeing
          ? this.visitorColor.setHex(wornShirt?.color ?? visitor.color).lerp(this.visitorPanicTint, 0.55)
          : this.visitorColor.setHex(wornShirt?.color ?? visitor.color)
      const legColor = streaking || (appearance.skirt && !shirtless) ? this.visitorSkinColor : this.visitorPantsColor

      this.visitorPose.position.set(displayX, displayY, displayZ)
      this.visitorPose.rotation.set(fleeing ? 0.28 : 0, targetRotation, fleeing ? 0 : tilt)
      this.visitorPose.scale.set(appearance.width, scaleY * appearance.height, appearance.width)
      this.visitorPose.updateMatrix()
      this.setVisitorLimb(index, appearance.female ? this.visitorFemaleBodyInstances : this.visitorBodyInstances, 0, .39, 0, 0, shirtColor)
      ;(appearance.female ? this.visitorBodyInstances : this.visitorFemaleBodyInstances)?.setMatrixAt(index, hiddenMatrix)
      this.setVisitorLimb(index, this.visitorHeadInstances, 0, .605, 0, headTilt * .3, this.visitorSkinColor)
      this.setVisitorLimb(index, this.visitorLeftLegInstances, -.044, .275, 0, sitting ? -1.15 : limbSwing * .65, legColor)
      this.setVisitorLimb(index, this.visitorRightLegInstances, .044, .275, 0, sitting ? -1.15 : -limbSwing * .65, legColor)
      this.setVisitorLimb(index, this.visitorLeftArmInstances, appearance.female ? -.11 : -.128, .485, 0, visitor.isDancing ? -1.7 - stride * .45 : -limbSwing * .65, this.visitorSkinColor)
      this.setVisitorLimb(index, this.visitorRightArmInstances, appearance.female ? .11 : .128, .485, 0, visitor.isDancing ? -1.7 + stride * .45 : limbSwing * .65, this.visitorSkinColor)
      this.personDetails.place(appearance.variant, this.visitorPose.matrix, !shirtless)
      if (wornShirt) {
        this.souvenirProps.placeShirt(wornShirt.style, this.visitorPose.matrix, wornShirt.color)
      }
      if (visitor.heldMascot && !streaking) {
        const shoulder = appearance.female ? 0.11 : 0.128
        const armSwing = visitor.isDancing ? -1.7 + stride * 0.45 : limbSwing * 0.65
        this.visitorLimb.position.set(shoulder, 0.485, 0)
        this.visitorLimb.rotation.set(armSwing, 0, 0)
        this.visitorLimb.scale.set(1, 1, 1)
        this.visitorLimb.updateMatrix()
        this.visitorMatrix.multiplyMatrices(this.visitorPose.matrix, this.visitorLimb.matrix)
        this.visitorLimb.position.set(0, -0.175, 0.03)
        this.visitorLimb.rotation.set(0, 0, 0)
        this.visitorLimb.updateMatrix()
        this.visitorMatrix.multiplyMatrices(this.visitorMatrix, this.visitorLimb.matrix)
        this.souvenirProps.placeMascot(this.visitorMatrix, mascotVariant(seed))
      }
      if (appearance.female) {
        if (shirtless) {
          this.setVisitorLimb(index, this.visitorBreastInstances, 0, .39, 0, 0, this.visitorSkinColor)
          this.visitorBustInstances?.setMatrixAt(index, hiddenMatrix)
        } else {
          this.setVisitorLimb(index, this.visitorBustInstances, 0, .39, 0, 0, shirtColor)
          this.visitorBreastInstances?.setMatrixAt(index, hiddenMatrix)
        }
        this.visitorPenisInstances?.setMatrixAt(index, hiddenMatrix)
      } else if (streaking) {
        this.setVisitorLimb(index, this.visitorPenisInstances, 0, .39, 0, 0, this.visitorSkinColor)
        this.visitorBreastInstances?.setMatrixAt(index, hiddenMatrix)
        this.visitorBustInstances?.setMatrixAt(index, hiddenMatrix)
      } else {
        this.visitorBreastInstances?.setMatrixAt(index, hiddenMatrix)
        this.visitorBustInstances?.setMatrixAt(index, hiddenMatrix)
        this.visitorPenisInstances?.setMatrixAt(index, hiddenMatrix)
      }

      const bubble = visitorBubbleKind(visitor)
      if (bubble) {
        const emotionBatch = this.getEmotionBatch(bubble, visitors.length)
        const size = bubble === 'panic' ? 1.55 : bubble === 'crushed' ? 1.2 : 1
        this.emotionPose.position.set(
          displayX,
          displayY + (bubble === 'panic' ? 1.02 : 0.82),
          displayZ,
        )
        this.emotionPose.scale.setScalar(size)
        this.emotionPose.quaternion.copy(this.camera.quaternion)
        this.emotionPose.updateMatrix()
        emotionBatch.setMatrixAt(emotionBatch.count++, this.emotionPose.matrix)
        this.emotionPose.scale.setScalar(1)
      }
      if (visitor.hasHandcart && !streaking) {
        const cart = this.getVisitorHandcart(cartIndex)
        cartIndex += 1
        cart.visible = true
        cart.position.set(
          displayX + Math.sin(targetRotation) * 0.36,
          displayY - 0.02,
          displayZ + Math.cos(targetRotation) * 0.36,
        )
        cart.position.y = this.actorTerrainHeight(cart.position.x, cart.position.z, y) + .02
        cart.rotation.y = targetRotation
      }
    })

    this.personDetails.finish()
    this.souvenirProps.finish()
    const used = visitors.length
    meshes.forEach((mesh) => {
      mesh.count = used
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    })
    for (const batch of this.emotionInstances.values()) batch.instanceMatrix.needsUpdate = true
    for (let index = cartIndex; index < this.visitorHandcarts.length; index += 1) {
      this.visitorHandcarts[index]!.visible = false
    }
  }

  private setVisitorLimb(
    index: number,
    mesh: InstancedMesh | null,
    x: number,
    y: number,
    z: number,
    swingX: number,
    color: Color,
  ): void {
    if (!mesh) return
    this.visitorLimb.position.set(x, y, z)
    this.visitorLimb.rotation.set(swingX, 0, 0)
    this.visitorLimb.scale.set(1, 1, 1)
    this.visitorLimb.updateMatrix()
    this.visitorMatrix.multiplyMatrices(this.visitorPose.matrix, this.visitorLimb.matrix)
    mesh.setMatrixAt(index, this.visitorMatrix)
    mesh.setColorAt(index, color)
  }

  private ensureVisitorInstances(count: number): void {
    if (this.visitorCapacity >= count && this.visitorBodyInstances) return
    const next = Math.max(32, count, this.visitorCapacity * 2)
    this.visitorPickMeshes.forEach((mesh) => {
      this.visitors.remove(mesh)
      mesh.dispose()
    })
    const create = (
      geometry: BufferGeometry,
      material: MeshStandardMaterial,
    ): InstancedMesh => {
      const instanced = new InstancedMesh(geometry, material, next)
      instanced.instanceMatrix.setUsage(DynamicDrawUsage)
      instanced.instanceColor = new InstancedBufferAttribute(new Float32Array(next * 3), 3)
      instanced.instanceColor.setUsage(DynamicDrawUsage)
      instanced.castShadow = false
      instanced.frustumCulled = false
      this.visitors.add(instanced)
      return instanced
    }
    const shirtMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.8,
    })
    shirtMaterial.userData.shared = true
    const pantMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.9,
    })
    pantMaterial.userData.shared = true
    this.visitorBodyInstances = create(this.visitorBodyGeometry, shirtMaterial)
    this.visitorFemaleBodyInstances = create(this.visitorFemaleBodyGeometry, shirtMaterial)
    this.visitorHeadInstances = create(this.visitorHeadGeometry, this.visitorSkinMaterial)
    this.visitorLeftLegInstances = create(this.visitorLegGeometry, pantMaterial)
    this.visitorRightLegInstances = create(this.visitorLegGeometry, pantMaterial)
    this.visitorLeftArmInstances = create(this.visitorArmGeometry, this.visitorSkinMaterial)
    this.visitorRightArmInstances = create(this.visitorArmGeometry, this.visitorSkinMaterial)
    this.visitorBreastInstances = create(this.visitorBreastGeometry, this.visitorSkinMaterial)
    this.visitorBustInstances = create(this.visitorBustGeometry, shirtMaterial)
    this.visitorPenisInstances = create(this.visitorPenisGeometry, this.visitorSkinMaterial)
    this.visitorPickMeshes = [
      this.visitorBodyInstances,
      this.visitorFemaleBodyInstances,
      this.visitorHeadInstances,
      this.visitorLeftLegInstances,
      this.visitorRightLegInstances,
      this.visitorLeftArmInstances,
      this.visitorRightArmInstances,
      this.visitorBreastInstances,
      this.visitorBustInstances,
      this.visitorPenisInstances,
    ]
    this.visitorCapacity = next
  }

  private getEmotionBatch(emotion: string, capacity: number): InstancedMesh {
    let batch = this.emotionInstances.get(emotion)
    if (!batch || batch.instanceMatrix.count < capacity) {
      const old = batch
      batch = new InstancedMesh(new PlaneGeometry(0.34, 0.34), new MeshBasicMaterial({
        map: this.getEmotionTexture(emotion), transparent: true, depthWrite: false, depthTest: false,
      }), Math.max(16, 2 ** Math.ceil(Math.log2(Math.max(1, capacity)))))
      batch.count = 0
      batch.frustumCulled = false
      batch.renderOrder = 100
      batch.instanceMatrix.setUsage(DynamicDrawUsage)
      if (old) {
        this.visitors.remove(old); old.geometry.dispose(); (old.material as MeshBasicMaterial).dispose(); old.dispose()
      }
      this.visitors.add(batch)
      this.emotionInstances.set(emotion, batch)
    }
    return batch
  }

  private getVisitorHandcart(index: number): Group {
    const existing = this.visitorHandcarts[index]
    if (existing) return existing
    const cart = this.createSharedHandcart()
    cart.visible = false
    this.visitors.add(cart)
    this.visitorHandcarts[index] = cart
    return cart
  }

  private createSharedHandcart(): Group {
    const cart = new Group()
    const body = new Mesh(this.handcartBodyGeometry, this.handcartBodyMaterial)
    body.position.y = 0.12
    const gear = new Mesh(this.handcartGearGeometry, this.handcartGearMaterial)
    gear.position.y = 0.23
    cart.add(body, gear)
    ;[-0.14, 0.14].forEach((x) => {
      const wheel = new Mesh(this.handcartWheelGeometry, this.handcartWheelMaterial)
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(x, 0.065, 0.04)
      cart.add(wheel)
    })
    const handle = new Mesh(this.handcartHandleGeometry, this.handcartHandleMaterial)
    handle.position.set(0, 0.12, -0.3)
    handle.rotation.x = -0.18
    cart.add(handle)
    cart.userData.handcart = true
    return cart
  }

  private getCashTexture(amount: number): CanvasTexture {
    const cached = this.cashTextures.get(amount)
    if (cached) return cached
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 96
    const context = canvas.getContext('2d')
    if (context) {
      context.font = 'bold 42px sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.lineWidth = 9
      context.strokeStyle = 'rgba(17, 48, 29, 0.9)'
      context.strokeText(`+${amount.toLocaleString('de-DE')} €`, 128, 48)
      context.fillStyle = '#75f09a'
      context.fillText(`+${amount.toLocaleString('de-DE')} €`, 128, 48)
    }
    const texture = new CanvasTexture(canvas)
    this.cashTextures.set(amount, texture)
    return texture
  }

  private getEmotionTexture(emotion: string): CanvasTexture {
    const cached = this.emotionTextures.get(emotion)
    if (cached) return cached
    const icons: Record<string, string> = {
      neutral: '😐',
      happy: '🙂',
      sad: '😢',
      angry: '😠',
      excited: '🤩',
      sleeping: '💤',
      talking: '💬',
      dancing: '🎶',
      crushed: '😣',
      panic: '😱',
    }
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (context) {
      context.font = '86px "Segoe UI Emoji", sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(icons[emotion] ?? icons.neutral!, 64, 66)
    }
    const texture = new CanvasTexture(canvas)
    this.emotionTextures.set(emotion, texture)
    return texture
  }

  private updateCashEffects(effects: readonly CashEffect[]): void {
    const activeIds = new Set(effects.map((effect) => effect.id))
    this.cashEffectModels.forEach((sprite, id) => {
      if (activeIds.has(id)) return
      this.cashEffects.remove(sprite)
      sprite.material.dispose()
      this.cashEffectModels.delete(id)
    })

    effects.forEach((effect) => {
      let sprite = this.cashEffectModels.get(effect.id)
      if (!sprite) {
        sprite = new Sprite(
          new SpriteMaterial({
            map: this.getCashTexture(effect.amount),
            transparent: true,
            depthTest: false,
          }),
        )
        sprite.scale.set(1.8, 0.68, 1)
        sprite.renderOrder = 100
        this.cashEffectModels.set(effect.id, sprite)
        this.cashEffects.add(sprite)
      }
      const progress = Math.min(1, effect.age / 1.6)
      sprite.position.set(effect.x, effect.y + progress * 0.8, effect.z)
      sprite.material.opacity = 1 - progress * progress
    })
  }

  private bindEvents(): void {
    bindTouchCamera(this.canvas, {
      pan: (x, y) => { if (!this.walkMode) this.panCamera(x, y) },
      zoom: factor => { if (!this.walkMode) this.zoomBy(factor) },
      panWithOneFinger: () => !this.walkMode && (this.touchPanMode || (this.currentSnapshot?.selectedTool === 'inspect' && !this.groundAreaHandler && !this.staffZonePaintHandler)),
      cancelBuild: () => {
        this.groundAreaStart = null
        this.groundAreaEndKey = ''
        this.endStaffZonePaint()
        this.leftPointerDown = false
        this.painting = false
        this.dragging = false
        this.pointerDownCell = null
        this.lastPaintCell = null
        this.sceneryDragLock = null
        this.setPathDragPreview([], 0)
      },
    })
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault())
    this.canvas.addEventListener('pointerleave', () => {
      this.facadeReveal?.setTarget(null)
      if (!this.pointerDownCell) {
        this.hoveredCell = null
        if (!this.staffZonePainting) this.updateStaffZoneHover(null)
      }
    })
    this.canvas.addEventListener('pointerdown', (event) => {
      if (this.walkMode) {
        this.walkLookActive = true
        this.lastPointer.set(event.clientX, event.clientY)
        // Looking around is dragging, not pointer lock: a locked pointer is a hidden
        // pointer, and the cursor stays visible on foot the same way it does on the map.
        try { this.canvas.setPointerCapture(event.pointerId) } catch { /* already captured */ }
        return
      }
      this.groundAreaCancelled = false
      if (!this.shiftHeightActive || this.currentSnapshot?.selectedTool === 'path' || this.currentSnapshot?.selectedTool === 'road') this.pickCell(event)
      this.dragging = event.button === 1 || event.button === 2
      this.leftPointerDown = event.button === 0
      this.painting = false
      this.pointerDownCell = this.hoveredCell ? { ...this.hoveredCell } : null
      this.lastPaintCell = null
      this.dragButton = event.button
      this.lastPointer.set(event.clientX, event.clientY)
      this.pointerDown.copy(this.lastPointer)
      this.canvas.setPointerCapture(event.pointerId)
      if (event.button === 0 && !(event.pointerType === 'touch' && this.touchPanMode) && this.staffZonePaintHandler && this.hoveredCell) {
        this.staffZonePainting = true
        this.staffZonePaintKey = ''
        this.staffZonePaintAt(this.hoveredCell, 'start')
      } else if (event.button === 0 && !(event.pointerType === 'touch' && this.touchPanMode) && this.groundAreaHandler && this.hoveredCell) {
        this.groundAreaStart = { ...this.hoveredCell }; this.groundAreaEndKey = ''; this.updateGroundAreaPreview()
      }
    })
    this.canvas.addEventListener('pointerup', (event) => {
      if (this.walkMode) {
        this.walkLookActive = false
        return
      }
      if (this.groundAreaCancelled) { this.groundAreaCancelled = false; return }
      if (event.button === 0 && this.staffZonePainting) {
        this.pickCell(event)
        if (this.hoveredCell) this.staffZonePaintAt(this.hoveredCell, 'move')
        this.endStaffZonePaint()
        this.leftPointerDown = false
        this.pointerDownCell = null
        return
      }
      if (event.button === 0 && this.groundAreaStart) {
        this.pickCell(event)
        if (this.hoveredCell) this.groundAreaHandler?.(this.groundAreaStart, this.hoveredCell, false)
        this.groundAreaStart = null; this.groundAreaEndKey = ''; this.leftPointerDown = false
        this.pointerDownCell = null; this.setPathDragPreview([], 0)
        return
      }
      const moved = this.pointerDown.distanceTo(new Vector2(event.clientX, event.clientY))
      if (event.button === 0 && moved < 5 && this.staffPlacementHandler && this.hoveredCell) {
        this.staffPlacementHandler(this.hoveredCell)
        this.leftPointerDown = false; this.pointerDownCell = null
        return
      }
      if (event.button === 0 && moved < 5 && !this.painting && !(event.pointerType === 'touch' && this.touchPanMode)) {
        this.setRayFromPointer(event)
        const inspecting = this.currentSnapshot?.selectedTool === 'inspect'
        const staffHit = inspecting ? this.raycaster.intersectObjects([...(this.staffView.group.visible?this.staffView.group.children:[]),...this.supplyChainView.getStaffMeshes()],true)[0] : undefined
        const staffId = staffHit?.object.userData.staffId
        const visitorId = inspecting ? this.pickVisitor(event) : null
        const vehicleId = inspecting ? this.pickVehicle() : null
        const accessId = inspecting ? this.pickAccessControl() : null
        const placed =
          inspecting || this.currentSnapshot?.selectedTool === 'bulldoze'
            ? this.pickPlacedObject()
            : null
        if (typeof staffId === 'string') this.onStaffClick(staffId)
        else if (visitorId) {
          this.onVisitorClick(visitorId)
        } else if (vehicleId) {
          this.onVehicleClick(vehicleId)
        } else if (accessId) {
          this.onAccessControlClick(accessId)
        } else if (placed) {
          this.onCellClick(placed)
        } else if (this.hoveredCell) {
          this.onCellClick(this.hoveredCell)
        }
      }
      if (event.button === 2 && moved < 5) {
        this.setRayFromPointer(event)
        const handled = this.rightClickHandler?.(this.hoveredCell, this.pickPlacedObject())
        const piece = handled ? null : this.pickCoasterPiece(event)
        if (piece) this.onCoasterPieceRightClick(piece.coasterId, piece.pieceIndex)
      }
      if (this.painting) this.onPathPaintEnd()
      this.dragging = false
      this.dragButton = -1
      this.leftPointerDown = false
      this.painting = false
      this.pointerDownCell = null
      this.lastPaintCell = null
      this.sceneryDragLock = null
    })
    this.canvas.addEventListener('pointercancel', () => {
      this.walkLookActive = false
      this.groundAreaStart = null; this.groundAreaEndKey = ''; this.endStaffZonePaint(); this.leftPointerDown = false
      this.painting = false; this.dragging = false; this.sceneryDragLock = null; this.setPathDragPreview([], 0)
    })
    this.canvas.addEventListener('pointermove', (event) => {
      if (this.facadeReveal && !isDecorationCatalogKind(this.currentSnapshot?.selectedTool ?? '')) {
        this.setRayFromPointer(event)
        const hit = this.raycaster.intersectObjects(this.buildings.children, true).find(hit => {
          let object: Object3D | null = hit.object
          while (object) { if (!object.visible) return false; object = object.parent }
          return true
        })
        this.facadeReveal.setTarget(!this.dragging && hit?.object.userData.facade ? hit.point : null)
      }
      if (this.walkMode) {
        if (this.walkLookActive) {
          this.lookWalk(event.clientX - this.lastPointer.x, event.clientY - this.lastPointer.y)
        }
        this.lastPointer.set(event.clientX, event.clientY)
        return
      }
      if (this.staffZonePainting) {
        this.pickCell(event)
        if (this.hoveredCell) this.staffZonePaintAt(this.hoveredCell, 'move')
        return
      }
      if (this.groundAreaStart) { this.pickCell(event); this.updateGroundAreaPreview(); return }
      if (this.dragging && (this.dragButton === 1 || this.dragButton === 2)) {
        this.panCamera(event.clientX - this.lastPointer.x, event.clientY - this.lastPointer.y)
        this.lastPointer.set(event.clientX, event.clientY)
        return
      }
      this.lastPointer.set(event.clientX, event.clientY)
      if (event.shiftKey && usesConstructionHeight(this.currentSnapshot?.selectedTool)) {
        if (!this.shiftHeightActive) this.beginHeightDrag(event.clientY)
        const height = draggedBuildElevation(this.shiftStartElevation, this.shiftHeightY, event.clientY)
        if (height !== this.shiftLastElevation) {
          this.shiftLastElevation = height
          this.heightHandler?.(height, this.hoveredCell)
        }
        // Keep scenery over its anchor while changing height; ways still extend ramps to the cursor.
        if (this.currentSnapshot?.selectedTool === 'path' || this.currentSnapshot?.selectedTool === 'road') this.pickCell(event)
        return
      }
      if (this.shiftHeightActive) {
        this.shiftHeightActive = false
        this.updateConstructionGrid()
      }
      this.pickCell(event, !this.leftPointerDown)
      const moved = this.pointerDown.distanceTo(new Vector2(event.clientX, event.clientY))
      if (
        this.leftPointerDown &&
        moved >= 5 &&
        (isScenery(this.currentSnapshot?.selectedTool ?? '') || this.currentSnapshot?.selectedTool === 'path' ||
          this.currentSnapshot?.selectedTool === 'camping' ||
          this.currentSnapshot?.selectedTool === 'medicalArea' ||
          this.currentSnapshot?.selectedTool === 'wasteDump' ||
          this.currentSnapshot?.selectedTool === 'stageForecourt' ||
          this.currentSnapshot?.selectedTool === 'backstageArea' ||
          this.currentSnapshot?.selectedTool === 'road' ||
          this.currentSnapshot?.selectedTool === 'parkingArea' ||
          this.currentSnapshot?.selectedTool === 'roadDirection' ||
          this.currentSnapshot?.selectedTool === 'roadSeparator' ||
          this.currentSnapshot?.selectedTool === 'fence' ||
          this.currentSnapshot?.selectedTool === 'crosswalk' ||
          this.currentSnapshot?.selectedTool === 'roadSpeed10' ||
          this.currentSnapshot?.selectedTool === 'roadSpeed30' ||
          this.currentSnapshot?.selectedTool === 'roadSpeed50' ||
          this.currentSnapshot?.selectedTool === 'course' ||
          isTerrainEditTool(this.currentSnapshot?.selectedTool) ||
          this.currentSnapshot?.selectedTool === 'bulldoze' ||
          this.currentSnapshot?.selectedTool === 'powerCable' ||
          isCopyTool(this.currentSnapshot?.selectedTool))
      ) {
        if (!this.painting && this.pointerDownCell) {
          this.onPathPaintStart(this.pointerDownCell)
          const tool = this.currentSnapshot?.selectedTool ?? ''
          if (isScenery(tool)) {
            const rotation = this.currentSnapshot!.buildRotation
            this.sceneryDragLock = {
              rotation,
              slot: scenerySlot(tool, this.pointerDownCell.localX, this.pointerDownCell.localZ, rotation) ?? 0,
            }
          }
        }
        this.painting = true
        if (this.pointerDownCell) this.paintCell(this.pointerDownCell)
        if (this.hoveredCell) this.paintCell(this.hoveredCell)
      }
    })
    this.canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault()
        if (this.walkMode) return
        if (event.shiftKey) {
          if (this.heightHandler) {
            const height = Math.max(0, Math.min(6, (this.currentSnapshot?.buildElevation ?? 0) + (event.deltaY < 0 ? .5 : -.5)))
            this.heightHandler(height, this.hoveredCell)
            this.shiftStartElevation = this.shiftLastElevation = height
            this.shiftHeightY = this.lastPointer.y
          } else this.onElevationChange(event.deltaY < 0 ? 1 : -1)
          return
        }
        this.zoom = MathUtils.clamp(this.zoom * (event.deltaY > 0 ? 0.9 : 1.1), 0.55, 2.4)
        this.resize()
        this.updateCamera()
      },
      { passive: false },
    )
    window.addEventListener('keydown', event => {
      if (isTextEntryTarget(event.target) || isTextEntryTarget(document.activeElement)) return
      if (this.walkMode && this.isWalkControl(event.code)) {
        this.walkKeys.add(event.code)
        event.preventDefault()
        return
      }
      if (event.key === 'Shift' && !event.repeat && !this.shiftHeightActive && this.hoveredCell && usesConstructionHeight(this.currentSnapshot?.selectedTool)) this.beginHeightDrag(this.lastPointer.y)
      if (event.key === 'Escape' && this.staffZonePainting) {
        this.endStaffZonePaint()
        this.leftPointerDown = false
        this.pointerDownCell = null
        return
      }
      if (event.key !== 'Escape' || !this.groundAreaStart) return
      this.setGroundAreaTool(this.groundAreaHandler)
      this.groundAreaCancelled = true; this.leftPointerDown = false; this.pointerDownCell = null
    })
    window.addEventListener('keyup', event => {
      this.walkKeys.delete(event.code)
      if (event.key === 'Shift' && this.shiftHeightActive) {
        this.shiftHeightActive = false
        this.updateConstructionGrid()
      }
    })
    window.addEventListener('blur', () => { this.facadeReveal?.setTarget(null); this.shiftHeightActive = false; this.dragging = false; this.leftPointerDown = false; this.updateConstructionGrid() })
    window.addEventListener('resize', () => this.resize())
  }

  private paintCell(cell: CellPosition): void {
    if (!this.lastPaintCell) {
      this.lastPaintCell = { ...cell }
      this.onCellPaint(cell)
      return
    }
    if (cell.x === this.lastPaintCell.x && cell.z === this.lastPaintCell.z) return

    let x = this.lastPaintCell.x
    let z = this.lastPaintCell.z
    const deltaX = Math.abs(cell.x - x)
    const deltaZ = Math.abs(cell.z - z)
    const stepX = x < cell.x ? 1 : -1
    const stepZ = z < cell.z ? 1 : -1
    let error = deltaX - deltaZ

    while (x !== cell.x || z !== cell.z) {
      const previousX = x
      const previousZ = z
      const doubleError = error * 2
      if (doubleError > -deltaZ) {
        error -= deltaZ
        x += stepX
      }
      if (doubleError < deltaX) {
        error += deltaX
        z += stepZ
      }
      if (x !== previousX && z !== previousZ) {
        this.onCellPaint({ x, z: previousZ })
      }
      this.onCellPaint({ x, z })
    }
    this.lastPaintCell = { ...cell }
  }

  private pickCell(event: PointerEvent, preferMesh = false): void {
    this.setRayFromPointer(event)
    const tool = this.currentSnapshot?.selectedTool
    if (
      preferMesh &&
      (tool === 'inspect' || tool === 'bulldoze') &&
      !this.painting &&
      !this.groundAreaStart &&
      !this.staffZonePaintHandler
    ) {
      const mesh = this.pickPlacedObject()
      if (mesh) {
        this.hoveredCell = mesh
        this.onCellHover(this.hoveredCell)
        this.updatePreview()
        if (this.staffPlacementHandler) this.updateStaffPlacementPreview(this.hoveredCell)
        this.updateStaffZoneHover(this.hoveredCell)
        return
      }
    }
    const point = new Vector3()
    const terrainHit = this.raycaster.intersectObject(this.terrainGroup, true)[0]
    if (terrainHit) {
      point.copy(terrainHit.point)
    } else if (!this.raycaster.ray.intersectPlane(this.groundPlane, point)) {
      this.hoveredCell = null
      this.onCellHover(this.hoveredCell)
      this.updatePreview()
      if (this.staffPlacementHandler) this.updateStaffPlacementPreview(null)
      this.updateStaffZoneHover(null)
      return
    }
    const x = Math.floor(point.x)
    const z = Math.floor(point.z)
    const half = this.worldSize / 2
    this.hoveredCell = x >= -half && x < half && z >= -half && z < half ? { x, z, localX: point.x - x, localZ: point.z - z } : null
    this.onCellHover(this.hoveredCell)
    this.updatePreview()
    if (this.staffPlacementHandler) this.updateStaffPlacementPreview(this.hoveredCell)
    this.updateStaffZoneHover(this.hoveredCell)
  }

  private pickPlacedObject(): CellPosition | null {
    const snapshot = this.currentSnapshot
    if (!snapshot) return null
    const hits = this.raycaster.intersectObjects(
      [
        this.buildings,
        this.rideGates,
        this.accessControlView.getPickRoot(),
        this.logisticsView.getStaticPickRoot(),
        this.courseView.pickRoot(),
        this.attractionView.pickRoot(),
      ],
      true,
    )
    for (const hit of hits) {
      if (hit.object.userData.facade && this.facadeReveal?.isClickThrough(hit.point)) continue
      if (accessIdFromObject(hit.object)) return cellFromWorldPoint(hit.point.x, hit.point.z)
      const buildingId = buildingIdFromObject(hit.object, hit.instanceId)
      if (buildingId) {
        const picked = resolvePickedBuilding(snapshot.buildings, buildingId, hit.point.x, hit.point.z)
        if (picked) return picked
        if (snapshot.attractions.some((attraction) => attraction.id === buildingId)) {
          return { ...cellFromWorldPoint(hit.point.x, hit.point.z), buildingId }
        }
      }
      return cellFromWorldPoint(hit.point.x, hit.point.z)
    }
    return null
  }

  private pickVehicle(): string | null {
    const hit = this.raycaster.intersectObject(
      this.logisticsView.getVehiclePickRoot(),
      true,
    )[0]
    let object: Object3D | null = hit?.object ?? null
    while (object) {
      if (typeof object.userData.vehicleId === 'string') return object.userData.vehicleId
      object = object.parent
    }
    return null
  }

  private pickAccessControl(): string | null {
    const hit = this.raycaster.intersectObject(this.accessControlView.getPickRoot(), true)[0]
    let object: Object3D | null = hit?.object ?? null
    while (object) {
      if (typeof object.userData.accessId === 'string') return object.userData.accessId
      object = object.parent
    }
    return null
  }

  private pickVisitor(event: PointerEvent): string | null {
    if (this.logisticsMode) return null
    this.setRayFromPointer(event)
    const intersection = this.raycaster.intersectObjects(this.visitorPickMeshes, false)[0]
    const instanceId = intersection?.instanceId
    return typeof instanceId === 'number'
      ? this.visitorInstanceIds[instanceId] ?? null
      : null
  }

  private pickCoasterPiece(
    event: PointerEvent,
  ): { coasterId: string; pieceIndex: number } | null {
    this.setRayFromPointer(event)
    const intersection = this.raycaster.intersectObjects(this.coasterTracks.children, true)[0]
    const coasterId = intersection?.object.userData.coasterId
    const pieceIndex = intersection?.object.userData.pieceIndex
    return typeof coasterId === 'string' && typeof pieceIndex === 'number'
      ? { coasterId, pieceIndex }
      : null
  }

  private setRayFromPointer(event: PointerEvent): void {
    const bounds = this.canvas.getBoundingClientRect()
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
  }

  private updateConstructionGrid(): void {
    const snapshot = this.currentSnapshot
    const cell = this.hoveredCell
    const tool = snapshot?.selectedTool
    const show = Boolean(
      snapshot &&
        cell &&
        !this.walkMode &&
        usesConstructionHeight(tool) &&
        (this.shiftHeightActive || snapshot.buildElevation !== 0),
    )
    this.constructionGrid.visible = show
    if (!show || !snapshot || !cell) return
    const stageDesign =
      tool === 'stage'
        ? snapshot.festival.stageTemplates?.find(
            (template) => template.name === snapshot.festival.selectedStageTemplate,
          )
        : undefined
    const footprint = stageSize(stageDesign, snapshot.buildRotation)
    const width = tool === 'stage' ? footprint.width : 1
    const depth = tool === 'stage' ? footprint.depth : 1
    const ground = this.terrainShape
      ? this.terrainShape.sample(cell.x + width / 2, cell.z + depth / 2)
      : getTerrainHeight(snapshot.terrain, cell.x, cell.z)
    this.constructionGrid.position.set(
      cell.x + width / 2,
      ground + snapshot.buildElevation + 0.04,
      cell.z + depth / 2,
    )
  }

  private updateGroundTileMarker(): void {
    const snapshot = this.currentSnapshot
    const cell = this.hoveredCell
    const show =
      Boolean(snapshot && cell) &&
      showsPlacementGroundMarker(snapshot?.selectedTool, this.walkMode)
    this.groundTileMarker.visible = show
    if (!show || !snapshot || !cell) return
    const ground = this.terrainShape
      ? this.terrainShape.sample(cell.x + 0.5, cell.z + 0.5)
      : getTerrainHeight(snapshot.terrain, cell.x, cell.z)
    const marker = placementGroundCell(cell, ground)
    if (!marker) return
    this.groundTileMarker.position.set(marker.x + 0.5, marker.y + 0.035, marker.z + 0.5)
  }

  private updateStageForecourtPreview(tool: string, cell: CellPosition): void {
    const snapshot = this.currentSnapshot
    this.stageForecourtPreview.visible = false
    this.stageForecourtPreview.count = 0
    if (tool !== 'stage' || !snapshot) return
    const design = snapshot.festival.stageTemplates?.find(
      (template) => template.name === snapshot.festival.selectedStageTemplate,
    )
    if (!design) return
    const cells = stageApronCells({
      x: cell.x,
      z: cell.z,
      rotation: snapshot.buildRotation,
      stageDesign: design,
    })
    const baseY =
      getTerrainHeight(snapshot.terrain, cell.x, cell.z) +
      snapshot.buildElevation +
      0.035
    const pose = this.stageForecourtPreviewPose
    pose.rotation.set(0, 0, 0)
    pose.scale.set(1, 1, 1)
    cells.forEach((forecourt, index) => {
      pose.position.set(forecourt.x + 0.5, baseY, forecourt.z + 0.5)
      pose.updateMatrix()
      this.stageForecourtPreview.setMatrixAt(index, pose.matrix)
    })
    const material = this.stageForecourtPreview.material as MeshBasicMaterial
    material.color.setHex(this.placementResult?.ok === false ? 0xe84d4d : 0x9c72c7)
    this.stageForecourtPreview.count = cells.length
    this.stageForecourtPreview.instanceMatrix.needsUpdate = true
    this.stageForecourtPreview.computeBoundingSphere()
    this.stageForecourtPreview.visible = cells.length > 0
  }

  private updatePreview(): void {
    this.updateConstructionGrid()
    this.updateGroundTileMarker()
    this.sceneryPreview.visible = false
    this.stageForecourtPreview.visible = false
    if (this.walkMode) {
      this.preview.visible = false
      this.previewArrow.visible = false
      return
    }
    if (this.constructionActive || this.rideGatePreview.visible) {
      this.preview.visible = false
      this.previewArrow.visible = false
      return
    }
    if (isCopyTool(this.currentSnapshot?.selectedTool) && this.blueprintPreview.children.length > 0) {
      this.preview.visible = false
      this.previewArrow.visible = false
      this.sceneryPreview.visible = false
      return
    }
    if (!this.hoveredCell || !this.currentSnapshot) {
      this.preview.visible = false
      this.previewArrow.visible = false
      return
    }

    const tool = this.currentSnapshot.selectedTool
    this.updateStageForecourtPreview(tool, this.hoveredCell)
    if (tool === 'ride' && this.bungeePreviewHeight !== null) {
      const cell = this.hoveredCell, key = `bungee:${this.bungeePreviewHeight}`
      if (this.sceneryPreviewKind !== key) {
        disposeChildren(this.sceneryPreview); this.sceneryPreviewKind = key
        const model = createBungeeModel(this.bungeePreviewHeight)
        model.traverse(o => { if (o instanceof Mesh) { const m = o.material as MeshStandardMaterial; m.transparent = true; m.opacity = .6; m.depthWrite = false; o.castShadow = false } })
        this.sceneryPreview.add(model)
      }
      this.sceneryPreview.visible = true
      this.sceneryPreview.scale.setScalar(1)
      this.sceneryPreview.position.set(cell.x + .5, this.currentSnapshot.buildElevation + getTerrainHeight(this.currentSnapshot.terrain, cell.x, cell.z), cell.z + .5)
      this.sceneryPreview.rotation.y = this.currentSnapshot.buildRotation * Math.PI / 2
      this.preview.visible = this.previewArrow.visible = false
      return
    }
    if (tool === 'bench' || tool === 'table' || isWasteBin(tool)) {
      const cell = this.hoveredCell
      if (tool !== this.sceneryPreviewKind) {
        disposeChildren(this.sceneryPreview)
        this.sceneryPreviewKind = tool
        const model = createRetroBuilding(tool as BuildingKind)!
        model.traverse(o => { if (o instanceof Mesh) { const m = (o.material as MeshStandardMaterial).clone(); m.userData = {}; m.transparent = true; m.opacity = .72; o.material = m } })
        this.sceneryPreview.add(model)
      }
      const elevation = getTerrainHeight(this.currentSnapshot.terrain, cell.x, cell.z) + this.currentSnapshot.buildElevation
      const rotation = pathFurnitureRotation(
        this.currentSnapshot,
        cell.x,
        cell.z,
        elevation,
        isWasteBin(tool) ? this.currentSnapshot.buildRotation : undefined,
      ) ?? this.currentSnapshot.buildRotation
      const valid = this.placementResult?.ok ?? true
      this.sceneryPreview.visible = true
      this.sceneryPreview.position.set(cell.x + .5, elevation, cell.z + .5)
      this.sceneryPreview.rotation.y = (rotation ?? 0) * Math.PI / 2
      this.sceneryPreview.scale.setScalar(1)
      this.sceneryPreview.traverse(o => { if (o instanceof Mesh) (o.material as MeshStandardMaterial).color.setHex(valid ? 0xffffff : 0xf05a65) })
      this.preview.visible = this.previewArrow.visible = false
      return
    }
    if (isScenery(tool)) {
      const cell = this.hoveredCell
      const rotation = this.sceneryDragLock?.rotation ?? this.currentSnapshot.buildRotation
      const slot = this.sceneryDragLock?.slot ?? scenerySlot(tool, cell.localX, cell.localZ, rotation)!
      const placement = sceneryTransform({ kind: tool as BuildingKind, rotation, decorationSlot: slot })
      if (tool !== this.sceneryPreviewKind) {
        disposeChildren(this.sceneryPreview)
        this.sceneryPreviewKind = tool
        const model = createRetroBuilding(tool as BuildingKind)!
        model.traverse(object => {
          if (!(object instanceof Mesh)) return
          const material = (object.material as MeshStandardMaterial).clone()
          material.userData = {}; material.transparent = true; material.opacity = .72; material.depthWrite = false
          object.material = material; object.castShadow = false
        })
        this.sceneryPreview.add(model)
      }
      const valid = this.placementResult?.ok ?? true
      this.sceneryPreview.visible = true
      this.sceneryPreview.position.set(cell.x + placement.x, getTerrainHeight(this.currentSnapshot.terrain, cell.x, cell.z) + this.currentSnapshot.buildElevation, cell.z + placement.z)
      if (!isFacade(tool) && this.terrainShape) this.sceneryPreview.position.y = this.terrainShape.sample(cell.x + placement.x, cell.z + placement.z) + this.currentSnapshot.buildElevation
      this.sceneryPreview.rotation.y = placement.rotation * Math.PI / 2
      this.sceneryPreview.scale.set(placement.sx, placement.sy, placement.sz)
      this.sceneryPreview.traverse(object => { if (object instanceof Mesh) (object.material as MeshStandardMaterial).color.setHex(valid ? 0xffffff : 0xf05a65) })
      this.preview.visible = true; this.previewArrow.visible = false
      this.preview.position.copy(this.sceneryPreview.position); this.preview.position.y += .07
      const edge = isEdgeScenery(tool)
      this.preview.scale.set(edge ? .98 : slot === 4 ? .98 : .5, .12, edge ? .2 : slot === 4 ? .98 : .5)
      this.preview.rotation.y = placement.rotation * Math.PI / 2
      const marker = this.preview.material as MeshStandardMaterial
      marker.color.setHex(valid ? 0x8fdab0 : 0xf05a65)
      marker.emissive.copy(marker.color); marker.emissiveIntensity = .3
      return
    }
    if (
      this.placementResult?.renderMode === 'model' &&
      this.placementResult.kind === tool &&
      this.placementResult.x === this.hoveredCell.x &&
      this.placementResult.z === this.hoveredCell.z
    ) {
      const cell = this.hoveredCell
      const key = `building:${tool}`
      if (this.sceneryPreviewKind !== key) {
        disposeChildren(this.sceneryPreview)
        this.sceneryPreviewKind = key
        const model = this.createBuildingModel(tool as BuildingKind, 0)
        model.traverse((object) => {
          if (!(object instanceof Mesh)) return
          const source = Array.isArray(object.material) ? object.material[0] : object.material
          const material = (source as MeshStandardMaterial).clone()
          material.userData = {}
          material.transparent = true
          material.opacity = 0.68
          material.depthWrite = false
          object.material = material
          object.castShadow = false
        })
        this.sceneryPreview.add(model)
      }
      const valid = this.placementResult.ok
      const ground = getTerrainHeight(this.currentSnapshot.terrain, cell.x, cell.z)
      this.sceneryPreview.visible = true
      this.sceneryPreview.position.set(
        cell.x + 0.5,
        ground + this.currentSnapshot.buildElevation,
        cell.z + 0.5,
      )
      this.sceneryPreview.rotation.y = this.currentSnapshot.buildRotation * Math.PI / 2
      this.sceneryPreview.scale.setScalar(1)
      this.sceneryPreview.traverse((object) => {
        if (object instanceof Mesh) {
          ;(object.material as MeshStandardMaterial).color.setHex(valid ? 0xffffff : 0xf05a65)
        }
      })
      this.preview.visible = false
      this.previewArrow.visible = false
      return
    }
    if (tool === 'bulldoze' && this.hoveredCell.buildingId) {
      const picked = this.currentSnapshot.buildings.find((item) => item.id === this.hoveredCell!.buildingId)
      if (picked) {
        const material = this.preview.material as MeshStandardMaterial
        material.color.setHex(0xe84d4d)
        material.emissive.copy(material.color)
        material.emissiveIntensity = 0.28
        material.opacity = 0.55
        this.preview.visible = true
        this.previewArrow.visible = false
        if (isScenery(picked.kind)) {
          const placement = sceneryTransform(picked)
          const groundY = this.terrainShape
            ? this.terrainShape.sample(picked.x + placement.x, picked.z + placement.z)
            : getTerrainHeight(this.currentSnapshot.terrain, picked.x, picked.z)
          this.preview.position.set(picked.x + placement.x, picked.elevation + (wallSpec(picked.kind) ? 0 : groundY - getTerrainHeight(this.currentSnapshot.terrain, picked.x, picked.z)) + 0.07, picked.z + placement.z)
          this.preview.rotation.y = placement.rotation * Math.PI / 2
          const edge = isEdgeScenery(picked.kind)
          const full = picked.decorationSlot === undefined || picked.decorationSlot === 4
          this.preview.scale.set(edge ? .98 : full ? .98 : .5, .12, edge ? .2 : full ? .98 : .5)
        } else if (occupiesBuildingCell(picked, this.hoveredCell.x, this.hoveredCell.z)) {
          const footprint = stageSize(picked.stageDesign, picked.rotation)
          this.preview.rotation.y = 0
          this.preview.scale.set(footprint.width, 1, footprint.depth)
          this.preview.position.set(
            picked.x + footprint.width / 2,
            picked.elevation + 0.07,
            picked.z + footprint.depth / 2,
          )
        } else {
          this.preview.rotation.y = 0
          this.preview.scale.set(1, 1, 1)
          this.preview.position.set(
            this.hoveredCell.x + 0.5,
            picked.elevation + 0.07,
            this.hoveredCell.z + 0.5,
          )
        }
        return
      }
    }
    this.preview.rotation.y = 0
    ;(this.preview.material as MeshStandardMaterial).emissiveIntensity = 0
    const objectsAtCell = this.currentSnapshot.buildings
      .filter((item) => occupiesBuildingCell(item,this.hoveredCell!.x,this.hoveredCell!.z))
      .sort((a, b) => b.elevation - a.elevation)
    const existing = objectsAtCell[0]
    const ground = getTerrainHeight(
      this.currentSnapshot.terrain,
      this.hoveredCell.x,
      this.hoveredCell.z,
    )
    const elevation =
      tool === 'bulldoze' ||
      tool === 'inspect' ||
      tool === 'camping' ||
      tool === 'medicalArea' ||
      tool === 'stageForecourt' ||
      isTerrainEditTool(tool)
        ? existing?.elevation ?? ground
        : ground + this.currentSnapshot.buildElevation
    const footprint = this.placementResult?.footprint ?? { width: 1, depth: 1 }
    this.preview.scale.set(footprint.width,1,footprint.depth)
    this.preview.visible = true
    this.preview.position.set(
      this.hoveredCell.x + footprint.width/2,
      elevation + 0.07,
      this.hoveredCell.z + footprint.depth/2,
    )
    const valid = this.placementResult?.ok ?? true
    const buildingDefinition = BUILDINGS[tool as BuildingKind]
    const showDirectionArrow =
      (Boolean(buildingDefinition) && tool !== 'path') ||
      tool === 'roadDirection' ||
      tool === 'roadSeparator' ||
      tool === 'trafficLight' ||
      usesGateEdgePlacement(tool)
    const material = this.preview.material as MeshStandardMaterial
    material.color.set(valid ? 0x55dd88 : 0xe84d4d)

    this.previewArrow.visible = showDirectionArrow
    if (showDirectionArrow) {
      // A waste depot or sealed container's ghost shows the facing it will actually be
      // built with — turned to the road it sits next to — instead of the cursor's own
      // build rotation, so hovering it is what makes the required road connection
      // visible in the first place.
      const facesRoad = tool === 'wasteDepot' || isSealedWasteContainer(tool)
      const facing = facesRoad ? this.placementResult?.rotation ?? this.currentSnapshot.buildRotation : this.currentSnapshot.buildRotation
      const angle = facing * (Math.PI / 2)
      const directing =
        tool === 'roadDirection' ||
        tool === 'trafficLight' ||
        usesGateEdgePlacement(tool)
      const arrowMaterial = this.previewArrow.material as MeshBasicMaterial
      if (directing) {
        material.opacity = 0.22
        this.preview.scale.y = 0.28
        this.previewArrow.scale.setScalar(0.72)
        this.previewArrow.position.set(
          this.hoveredCell.x + 0.5,
          elevation + 0.04,
          this.hoveredCell.z + 0.5,
        )
        arrowMaterial.color.set(0xf4f0de)
        arrowMaterial.opacity = 1
      } else {
        material.opacity = 0.55
        this.preview.scale.y = 1
        this.previewArrow.scale.setScalar(0.72)
        this.previewArrow.position.set(
          this.hoveredCell.x + 0.5 + Math.sin(angle) * 0.22,
          elevation + 0.04,
          this.hoveredCell.z + 0.5 + Math.cos(angle) * 0.22,
        )
        arrowMaterial.color.copy(material.color)
        arrowMaterial.opacity = 0.7
      }
      this.previewArrow.rotation.set(0, angle, 0)
    } else {
      material.opacity = 0.55
      this.preview.scale.y = 1
    }
  }

  touchPanMode = false

  zoomBy(factor: number): void {
    if (this.walkMode) return
    this.zoom = MathUtils.clamp(this.zoom * factor, 0.55, 2.4)
    this.resize()
    this.updateCamera()
  }

  private panCamera(deltaX: number, deltaY: number): void {
    if (this.walkMode) return
    const scale = 0.018 / this.zoom
    const right = new Vector3(Math.cos(this.cameraAngle), 0, -Math.sin(this.cameraAngle))
    const forward = new Vector3(Math.sin(this.cameraAngle), 0, Math.cos(this.cameraAngle))
    this.cameraTarget.addScaledVector(right, -deltaX * scale)
    this.cameraTarget.addScaledVector(forward, -deltaY * scale)
    const limit = this.worldSize / 2
    this.cameraTarget.x = MathUtils.clamp(this.cameraTarget.x, -limit, limit)
    this.cameraTarget.z = MathUtils.clamp(this.cameraTarget.z, -limit, limit)
    this.updateCamera()
  }

  private updateVisitorFollow(
    visitors: readonly Visitor[],
    immediate = false,
  ): void {
    if (!this.followedVisitorId) return
    const visitor = visitors.find((candidate) => candidate.id === this.followedVisitorId)
    if (!visitor) {
      this.followedVisitorId = null
      return
    }
    const target = new Vector3(visitor.x, visitor.y + 0.25, visitor.z)
    if (visitor.state === 'riding' && this.currentSnapshot) {
      const coaster = this.currentSnapshot.coasters.find((candidate) =>
        candidate.train.passengerIds.includes(visitor.id),
      )
      if (coaster) {
        const passengerIndex = coaster.train.passengerIds.indexOf(visitor.id)
        const carIndex = Math.floor(
          passengerIndex / getCoasterType(coaster.typeId).carCapacity,
        )
        const car = this.trainModels.get(coaster.id)?.children[carIndex]
        if (car) target.set(car.position.x, car.position.y, car.position.z)
      }
    }
    if (immediate) this.cameraTarget.copy(target)
    else this.cameraTarget.lerp(target, 0.2)
    this.updateCamera()
  }

  private updateCamera(): void {
    if (this.walkMode) {
      this.applyWalkCamera()
      return
    }
    const horizontalDistance = this.cameraDistance
    this.camera.position.set(
      this.cameraTarget.x + Math.sin(this.cameraAngle) * horizontalDistance,
      20,
      this.cameraTarget.z + Math.cos(this.cameraAngle) * horizontalDistance,
    )
    this.camera.lookAt(this.cameraTarget)
  }

  private isWalkControl(code: string): boolean {
    return code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD'
      || code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight'
      || code === 'ShiftLeft' || code === 'ShiftRight'
  }

  private lookWalk(deltaX: number, deltaY: number): void {
    this.walkYaw -= deltaX * WALK_LOOK_SENSITIVITY
    this.walkPitch = MathUtils.clamp(this.walkPitch - deltaY * WALK_LOOK_SENSITIVITY, -1.2, 1.05)
    this.applyWalkCamera()
  }

  private snapWalkHeight(): void {
    this.cameraTarget.y = this.walkSurfaceHeight(this.walkX, this.walkZ) + WALK_EYE_HEIGHT
  }

  private walkSurfaceHeight(x: number, z: number): number {
    const shape = this.terrainShape
    if (!shape) return 0
    const radius = 0.2
    return Math.max(
      shape.sample(x, z),
      shape.sample(x + radius, z),
      shape.sample(x - radius, z),
      shape.sample(x, z + radius),
      shape.sample(x, z - radius),
    )
  }

  private applyWalkCamera(): void {
    const eyeY = this.walkSurfaceHeight(this.walkX, this.walkZ) + WALK_EYE_HEIGHT
    const lookX = this.walkX + Math.sin(this.walkYaw) * Math.cos(this.walkPitch)
    const lookY = eyeY + Math.sin(this.walkPitch)
    const lookZ = this.walkZ + Math.cos(this.walkYaw) * Math.cos(this.walkPitch)
    this.walkCamera.position.set(this.walkX, eyeY, this.walkZ)
    this.walkCamera.lookAt(lookX, lookY, lookZ)
    this.cameraTarget.set(this.walkX, eyeY, this.walkZ)
  }

  private canWalkTo(x: number, z: number): boolean {
    const limit = this.worldSize / 2 - 0.28
    if (x < -limit || x >= limit || z < -limit || z >= limit) return false
    const snapshot = this.currentSnapshot
    if (!snapshot) return true
    const cellX = Math.floor(x)
    const cellZ = Math.floor(z)
    return !snapshot.buildings.some((building) =>
      WALK_BLOCKED_KINDS.has(building.kind) && occupiesBuildingCell(building, cellX, cellZ),
    )
  }

  private resize(): void {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (width === 0 || height === 0) return

    this.renderer.setPixelRatio(scenePixelRatio(width, height))
    this.renderer.setSize(width, height, false)
    const aspect = width / height
    const viewHeight = 20 / this.zoom
    this.camera.left = (-viewHeight * aspect) / 2
    this.camera.right = (viewHeight * aspect) / 2
    this.camera.top = viewHeight / 2
    this.camera.bottom = -viewHeight / 2
    this.camera.near = 0.1
    this.camera.far = 100
    this.camera.updateProjectionMatrix()
    this.walkCamera.aspect = aspect
    this.walkCamera.near = 0.06
    this.walkCamera.far = Math.max(90, this.worldSize * 2)
    this.walkCamera.updateProjectionMatrix()
  }
}
