import { BoxGeometry, DynamicDrawUsage, Group, InstancedMesh, MeshBasicMaterial, Object3D } from 'three'
import { effectCount } from './effectDensity'

const DROPS = 700
const RADIUS = 16
const HEIGHT = 9

const dropGeometry = new BoxGeometry(0.012, 0.42, 0.012)
dropGeometry.userData.shared = true
const dropMaterial = new MeshBasicMaterial({ color: 0xbfd6ea, transparent: true, opacity: 0.55, depthWrite: false })
dropMaterial.userData.shared = true

/**
 * Rain streaks around the camera's look-at point: one instanced batch, however heavy
 * the rain. Drops fall on simulated time (`minutes`), so a paused game holds them
 * still; their spread comes from a fixed pattern, not from a random draw per frame.
 * Effect density thins them out.
 */
export class RainView {
  readonly group = new Group()
  private readonly drops = new InstancedMesh(dropGeometry, dropMaterial, DROPS)
  private readonly pose = new Object3D()

  constructor() {
    this.drops.instanceMatrix.setUsage(DynamicDrawUsage)
    this.drops.frustumCulled = false
    this.drops.visible = false
    this.drops.raycast = () => undefined
    this.group.add(this.drops)
  }

  /** `strength` 0 hides the rain; 1 is a downpour. */
  update(center: { x: number; y: number; z: number }, minutes: number, strength: number): void {
    const count = strength > 0 ? effectCount(Math.round(DROPS * strength), 40) : 0
    this.drops.visible = count > 0
    if (count === 0) return
    for (let i = 0; i < count; i++) {
      // A golden-angle spiral spreads the drops evenly around the centre.
      const angle = i * 2.39996
      const radius = Math.sqrt((i + 0.5) / count) * RADIUS
      const fall = ((i * 0.618 + minutes * 7.5) % 1 + 1) % 1
      this.pose.position.set(
        center.x + Math.cos(angle) * radius,
        center.y + HEIGHT * (1 - fall),
        center.z + Math.sin(angle) * radius,
      )
      this.pose.rotation.z = 0.18
      this.pose.updateMatrix()
      this.drops.setMatrixAt(i, this.pose.matrix)
    }
    this.drops.count = count
    this.drops.instanceMatrix.needsUpdate = true
  }
}
