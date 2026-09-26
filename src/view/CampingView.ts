import { CampMeshBatcher } from './batchCampMeshes'
import { AreaEdgeBatch } from './coverOverlay'
import { paintedCoverAt, weatheringRgb } from '../game/groundCoverLook'
import { CAMP_COLORS, campRotation, campSeed, createCampModel } from './campingModels'
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import type { GameSnapshot } from '../game/GameState'
import { getTerrainHeight } from '../game/terrain'
import { disposeChildren, disposeObject3D } from './disposeObject3D'
import { IconBillboards } from './spriteAtlas'

let handcartTemplate: Group | undefined

export function createHandcartModel(): Group {
  if (handcartTemplate) return handcartTemplate.clone(true)
  const cart = new Group()
  const body = new Mesh(
    new BoxGeometry(0.25, 0.13, 0.32),
    new MeshStandardMaterial({ color: 0xb83e35, roughness: 0.8 }),
  )
  body.position.y = 0.12
  const gear = new Mesh(
    new BoxGeometry(0.19, 0.15, 0.23),
    new MeshStandardMaterial({ color: 0x4f7c45, roughness: 0.95 }),
  )
  gear.position.y = 0.23
  cart.add(body, gear)
  ;[-0.14, 0.14].forEach((x) => {
    const wheel = new Mesh(
      new CylinderGeometry(0.055, 0.055, 0.035, 8),
      new MeshStandardMaterial({ color: 0x25282c }),
    )
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(x, 0.065, 0.04)
    cart.add(wheel)
  })
  const handle = new Mesh(
    new BoxGeometry(0.025, 0.025, 0.3),
    new MeshStandardMaterial({ color: 0x34383d }),
  )
  handle.position.set(0, 0.12, -0.3)
  handle.rotation.x = -0.18
  cart.add(handle)
  cart.userData.handcart = true
  cart.traverse(object => {
    if (!(object instanceof Mesh)) return
    object.geometry.userData.shared = true
    ;(object.material as MeshStandardMaterial).userData.shared = true
  })
  handcartTemplate = cart
  return cart.clone(true)
}

const VISIBLE_CAMP_PHASES = new Set([
  'ready',
  'returning',
  'resting',
  'packing',
])

export class CampingView {
  readonly group = new Group()
  private readonly props = new Group()
  private readonly propBatcher = new CampMeshBatcher()
  private readonly batchedProps = new Group()
  private propModels = new Map<string, { stamp: string; model: Group }>()
  private tileFingerprint = ''
  private camperFingerprint = ''
  private installationFingerprint = ''
  private readonly edges = new AreaEdgeBatch()

  /**
   * Sleep and music symbols: one billboard batch each for the whole site, instead of
   * a canvas, a texture and a sprite material per sleeping camper or music box.
   */
  private readonly sleepSymbols = new IconBillboards('zzz', 0.34)
  private readonly musicSymbols = new IconBillboards('notes', 0.3)

  constructor() {
    this.batchedProps.add(this.propBatcher.group)
    this.group.add(this.props, this.batchedProps, this.edges.group, this.sleepSymbols.mesh, this.musicSymbols.mesh)
  }

  invalidate(): void {
    disposeChildren(this.props)
    this.propBatcher.clear()
    this.propModels.clear()
    this.edges.clear()
    this.tileFingerprint = ''
    this.camperFingerprint = ''
    this.installationFingerprint = ''
  }

  update(snapshot: Readonly<GameSnapshot>): void {
    const camperFingerprint = this.createCamperFingerprint(snapshot)
    const installationFingerprint = this.createInstallationFingerprint(snapshot)
    const tileFingerprint = this.createTileFingerprint(snapshot)
    const tilesChanged = tileFingerprint !== this.tileFingerprint
    const propsChanged =
      camperFingerprint !== this.camperFingerprint ||
      installationFingerprint !== this.installationFingerprint
    if (!tilesChanged && !propsChanged) return
    this.tileFingerprint = tileFingerprint
    this.camperFingerprint = camperFingerprint
    this.installationFingerprint = installationFingerprint
    if (tilesChanged) this.updateTiles(snapshot)
    if (propsChanged || tilesChanged) this.rebuildProps(snapshot)
  }

  private createTileFingerprint(snapshot: Readonly<GameSnapshot>): string {
    let fingerprint = `${snapshot.campingCells.length}`
    for (const cell of snapshot.campingCells) {
      fingerprint += `|${cell.x}:${cell.z}:${getTerrainHeight(snapshot.terrain, cell.x, cell.z)}`
    }
    return fingerprint
  }

  private createCamperFingerprint(snapshot: Readonly<GameSnapshot>): string {
    let fingerprint = ''
    for (const visitor of snapshot.visitors) {
      if (!visitor.campsite) continue
      const visible = VISIBLE_CAMP_PHASES.has(visitor.campingPhase)
      const visualPhase = !visible
        ? 'hidden'
        : visitor.campingPhase === 'resting'
          ? 'resting'
          : 'visible'
      fingerprint += `${visitor.id}:${visitor.campsite.x}:${visitor.campsite.z}:${visualPhase}:${visitor.color}:${paintedCoverAt(snapshot, visitor.campsite.x, visitor.campsite.z) ?? ''}|`
    }
    return fingerprint
  }

  private createInstallationFingerprint(snapshot: Readonly<GameSnapshot>): string {
    let fingerprint = ''
    for (const installation of snapshot.campInstallations) {
      fingerprint += `${installation.id}:${installation.cell.x}:${installation.cell.z}:${installation.kind}:${installation.contributorIds.length}:${installation.appearanceId}:${installation.fabricColor}:${Math.round(installation.decay ?? 0)}:${paintedCoverAt(snapshot, installation.cell.x, installation.cell.z) ?? ''}|`
    }
    return fingerprint
  }

  private updateTiles(snapshot: Readonly<GameSnapshot>): void {
    this.edges.update(snapshot.campingCells.map((cell) => ({
      x: cell.x,
      z: cell.z,
      y: getTerrainHeight(snapshot.terrain, cell.x, cell.z),
    })))
  }

  private rebuildProps(snapshot: Readonly<GameSnapshot>): void {
    const active = new Set<string>()
    const sleepers: Vector3[] = []
    const music: Vector3[] = []
    const needsUpdate = (key: string, stamp: string): boolean => {
      active.add(key)
      const existing = this.propModels.get(key)
      if (existing?.stamp === stamp) return false
      if (existing) { this.props.remove(existing.model); disposeObject3D(existing.model) }
      return true
    }
    snapshot.visitors.forEach((visitor) => {
      if (
        !visitor.campsite ||
        !VISIBLE_CAMP_PHASES.has(visitor.campingPhase)
      ) {
        return
      }
      const key = `visitor:${visitor.id}`
      const height = getTerrainHeight(snapshot.terrain, visitor.campsite.x, visitor.campsite.z)
      if (visitor.campingPhase === 'resting') {
        // The same spot the symbol had as a child of the turned campsite: 0.08 along
        // the tent's own x, 0.86 up.
        const turn = campRotation(visitor.id)
        sleepers.push(new Vector3(
          visitor.campsite.x + 0.5 + Math.cos(turn) * 0.08,
          height + 0.02 + 0.86,
          visitor.campsite.z + 0.5 - Math.sin(turn) * 0.08,
        ))
      }
      const stamp = `${visitor.campsite.x}:${visitor.campsite.z}:${height}:${visitor.color}:${paintedCoverAt(snapshot, visitor.campsite.x, visitor.campsite.z) ?? ''}`
      if (!needsUpdate(key, stamp)) return
      const campsite = new Group()
      campsite.position.set(
        visitor.campsite.x + 0.5,
        getTerrainHeight(snapshot.terrain, visitor.campsite.x, visitor.campsite.z) +
          0.02,
        visitor.campsite.z + 0.5,
      )
      campsite.rotation.y = campRotation(visitor.id)
      const tent = createCampModel('tent', visitor.id, visitor.color)
      const parkedCart = createHandcartModel()
      parkedCart.scale.setScalar(0.8)
      parkedCart.position.set(0.34, 0.07, -0.24)
      parkedCart.rotation.y = -0.7
      campsite.add(tent, parkedCart)
      applyCoverWeather(campsite, snapshot, visitor.campsite.x, visitor.campsite.z)
      this.props.add(campsite)
      this.propModels.set(key, { stamp, model: campsite })
    })
    snapshot.campInstallations.forEach((installation) => {
      const appearanceId = installation.appearanceId ?? installation.id
      const color = installation.fabricColor ?? (installation.kind === 'tent' ? 0x8a6a4a : CAMP_COLORS[(campSeed(appearanceId) >>> 4) % CAMP_COLORS.length]!)
      const decay = installation.decay ?? 0
      const key = `installation:${installation.id}`
      if (installation.kind === 'musicBox') {
        music.push(new Vector3(
          installation.cell.x + 0.5,
          getTerrainHeight(snapshot.terrain, installation.cell.x, installation.cell.z) + 0.02 + 0.55,
          installation.cell.z + 0.5,
        ))
      }
      const stamp = `${installation.cell.x}:${installation.cell.z}:${getTerrainHeight(snapshot.terrain, installation.cell.x, installation.cell.z)}:${installation.kind}:${installation.contributorIds.length}:${appearanceId}:${color}:${Math.round(decay)}:${paintedCoverAt(snapshot, installation.cell.x, installation.cell.z) ?? ''}`
      if (!needsUpdate(key, stamp)) return
      const model =
        installation.kind === 'tent'
          ? this.createAbandonedTentModel(color, decay, appearanceId)
          : installation.kind === 'pavilion'
            ? createCampModel('pavilion', appearanceId, color, decay)
            : installation.kind === 'musicBox'
              ? this.createMusicBoxModel()
              : this.createChairModel(installation.contributorIds.length)
      model.position.set(
        installation.cell.x + 0.5,
        getTerrainHeight(
          snapshot.terrain,
          installation.cell.x,
          installation.cell.z,
        ) + 0.02,
        installation.cell.z + 0.5,
      )
      if (installation.kind === 'tent' || installation.kind === 'pavilion') model.rotation.y = campRotation(appearanceId)
      if (decay > 0 && installation.kind !== 'tent' && installation.kind !== 'pavilion') {
        const wear = decay / 100
        model.rotation.z += wear * 0.28
        model.scale.setScalar(1 - wear * 0.18)
      }
      applyCoverWeather(model, snapshot, installation.cell.x, installation.cell.z)
      this.props.add(model)
      this.propModels.set(key, { stamp, model })
    })
    for (const [key, entry] of this.propModels) {
      if (active.has(key)) continue
      this.props.remove(entry.model)
      disposeObject3D(entry.model)
      this.propModels.delete(key)
    }
    this.propBatcher.update(this.props)
    this.sleepSymbols.setPositions(sleepers)
    this.musicSymbols.setPositions(music)
  }

  private createAbandonedTentModel(color: number, decay: number, id: string): Group {
    const group = createCampModel('tent', id, color, decay)
    const wear = Math.max(0, Math.min(1, decay / 100))
    if (wear < 0.7) {
      const parkedCart = createHandcartModel()
      parkedCart.scale.setScalar(0.8)
      parkedCart.position.set(0.34, 0.07, -0.24)
      parkedCart.rotation.y = -0.7
      parkedCart.rotation.z = wear * 0.4
      group.add(parkedCart)
    }
    return group
  }
  private createChairModel(amount: number): Group {
    const group = new Group()
    const material = new MeshStandardMaterial({ color: 0x3b6d87, roughness: 0.8 })
    for (let index = 0; index < Math.min(5, amount); index += 1) {
      const angle = (index / Math.max(2, amount)) * Math.PI * 2
      const chair = new Group()
      const seat = new Mesh(new BoxGeometry(0.22, 0.04, 0.2), material)
      const back = new Mesh(new BoxGeometry(0.22, 0.23, 0.035), material)
      seat.position.y = 0.16
      back.position.set(0, 0.27, -0.085)
      chair.position.set(Math.cos(angle) * 0.22, 0, Math.sin(angle) * 0.22)
      chair.rotation.y = -angle - Math.PI / 2
      chair.add(seat, back)
      group.add(chair)
    }
    return group
  }

  private createMusicBoxModel(): Group {
    const group = new Group()
    const body = new Mesh(
      new BoxGeometry(0.42, 0.28, 0.24),
      new MeshStandardMaterial({ color: 0x323641, roughness: 0.65 }),
    )
    body.position.y = 0.16
    group.add(body)
    ;[-0.12, 0.12].forEach((x) => {
      const speaker = new Mesh(
        new CylinderGeometry(0.075, 0.075, 0.012, 12),
        new MeshStandardMaterial({ color: 0x13151a }),
      )
      speaker.rotation.x = Math.PI / 2
      speaker.position.set(x, 0.16, 0.126)
      group.add(speaker)
    })
    return group
  }
}

function applyCoverWeather(model: Group, snapshot: Readonly<GameSnapshot>, x: number, z: number): void {
  const cover = paintedCoverAt(snapshot, x, z)
  if (cover) model.userData.coverWeather = weatheringRgb(cover)
}
