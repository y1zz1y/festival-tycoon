import { BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, Shape, ExtrudeGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { BuildingKind } from '../game/catalog'
import { SCENERY_KINDS } from '../game/scenery'
import { isFacade, wallSpec, roofWallTop, roofSpec, isWasteBin, binSpec, THEMED_BIN_KINDS, WALL_STYLES } from '../game/decorationWalls'
import { decorationThemeOf, decorationCategoryOf } from '../game/decoration'

// Small, strongly silhouetted pieces, baked into vertex colors: detail adds
// triangles, never a draw call per bolt, plank, bottle or awning stripe.
export class ModelKit {
  private parts: BufferGeometry[] = []
  private add(geometry: BufferGeometry, color: number, x: number, y: number, z: number, rotation = new Quaternion()): void {
    geometry.applyMatrix4(new Matrix4().compose(new Vector3(x, y, z), rotation, new Vector3(1, 1, 1)))
    const tint = new Color(color)
    const colors = new Float32Array(geometry.getAttribute('position').count * 3)
    for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i)
    geometry.setAttribute('color', new BufferAttribute(colors, 3))
    geometry.deleteAttribute('uv')
    this.parts.push(geometry)
  }
  /** `rotation` is for the rare piece that does not sit square to the world, such as the tilted cabinets of a hung speaker array. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: number, rotation?: Quaternion): void {
    this.add(new BoxGeometry(w, h, d), color, x, y, z, rotation)
  }
  cylinder(x: number, y: number, z: number, radius: number, height: number, color: number, top = radius, sides = 8): void {
    this.add(new CylinderGeometry(top, radius, height, sides), color, x, y, z)
  }
  sphere(x: number, y: number, z: number, radius: number, color: number, segments = 8): void {
    this.add(new SphereGeometry(radius, segments, Math.max(4, segments - 2)), color, x, y, z)
  }
  beam(a: [number, number, number], b: [number, number, number], width: number, color: number): void {
    const start = new Vector3(...a), end = new Vector3(...b), direction = end.clone().sub(start)
    const center = start.add(end).multiplyScalar(.5)
    this.add(new BoxGeometry(width, direction.length(), width), color, center.x, center.y, center.z,
      new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()))
  }
  panel(points: [number, number][], depth: number, color: number): void {
    const shape = new Shape()
    points.forEach(([x,y],i) => i ? shape.lineTo(x,y) : shape.moveTo(x,y))
    shape.closePath()
    const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 })
    geometry.setIndex(Array.from({ length: geometry.getAttribute('position').count }, (_, index) => index))
    this.add(geometry, color, 0, 0, -depth / 2)
  }
  finish(): BufferGeometry {
    const result = mergeGeometries(this.parts)!
    for (const part of this.parts) part.dispose()
    result.computeBoundingSphere()
    result.userData.shared = true
    return result
  }
}

const ink = 0x28363b, cream = 0xf2dfb5, timber = 0x936141, steel = 0x92a6a5
const sand = 0xc4a46a, rust = 0xb86b3a
const moss = 0x3d6b3a, bark = 0x5a4634
const neonM = 0xff2d95, neonC = 0x2ee6ff
const brass = 0xc4a15a, copper = 0xb87333, iron = 0x3a3530
const ice = 0xc8e8f4, aurora = 0x5ee0b0, auroraP = 0x7b6cff
const material = new MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: .05 })
material.userData.shared = true
const geometries = new Map<BuildingKind, BufferGeometry>()
export const DETAILED_BUILDINGS: readonly BuildingKind[] = [
  'food', 'alcohol', 'mascot', 'shirt', 'toilet', 'bench', 'wasteBin',
  'sealedWasteContainer', ...THEMED_BIN_KINDS, 'stage', 'directionalSpeaker',
  'omniSpeaker', 'generator', 'backupGenerator', 'foh', 'delayTower',
  'videoWall', 'laserShow', 'fireworkBattery', 'securityGate', 'ride',
  ...SCENERY_KINDS,
]

/** Shared families: same primitives, theme via vertex colors. One merged mesh per kind. */
function pine(k: ModelKit, trunk: number, layers: number[], cap?: number): void {
  k.cylinder(0, .42, 0, .06, .82, trunk, .04, 6)
  layers.forEach((color, i) => {
    const y = .58 + i * .28, r = .36 - i * .08
    k.cylinder(0, y, 0, r, .3, color, .05, 7)
  })
  if (cap) k.cylinder(0, 1.42, 0, .08, .08, cap, .02, 6)
}

function planterPot(k: ModelKit, pot: number, leaf: number, bloom: number): void {
  k.cylinder(0, .14, 0, .16, .26, pot, .14, 7)
  k.box(0, .28, 0, .3, .04, .3, cream)
  k.cylinder(0, .48, 0, .08, .32, leaf, .06, 6)
  k.box(0, .66, 0, .05, .04, .05, bloom)
}

function stool(k: ModelKit, seat: number, leg: number, ring?: number): void {
  k.cylinder(0, .28, 0, .16, .06, seat, .16, 8)
  for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
    const x = Math.cos(a) * .1, z = Math.sin(a) * .1
    k.box(x, .14, z, .035, .26, .035, leg)
  }
  if (ring) k.cylinder(0, .12, 0, .12, .02, ring, .12, 8)
}

function edgePosts(k: ModelKit, post: number, rail: number, drip?: number): void {
  for (const x of [-.4, .4]) {
    k.box(x, .36, 0, .045, .72, .045, post)
    k.box(x, .03, 0, .1, .06, .1, ink)
  }
  for (const y of [.28, .5]) k.box(0, y, 0, .82, .04, .03, rail)
  if (drip) for (const x of [-.22, 0, .22]) k.box(x, .16, 0, .03, .16, .03, drip)
}

function embellishTheme(kind: BuildingKind, k: ModelKit): void {
  const theme = decorationThemeOf(kind)
  if (!theme || theme === 'klassik') return
  const palette = Object.values(WALL_STYLES).find(style => style.theme === theme)!
  const category = decorationCategoryOf(kind)
  if (category === 'plants' || category === 'festival') {
    // Broken-up ground clusters anchor the sculptures and vegetation in their setting.
    for (let i = 0; i < 7; i++) {
      const a = i * 2.399, r = .2 + (i % 3) * .065
      const x = Math.cos(a) * r, z = Math.sin(a) * r
      if (theme === 'wald' || theme === 'tropen' || theme === 'alpin') {
        for (let j = 0; j < 3; j++) k.beam([x, .02, z], [x + (j - 1) * .055, .1 + j * .025, z + .025], .018, j % 2 ? moss : 0x729456)
      } else k.cylinder(x, .025, z, .055, .05, i % 2 ? palette.color : palette.trim, .035, 5)
    }
  }
  if (category === 'furniture') {
    for (const x of [-.12, .12]) k.box(x, .015, 0, .065, .03, .24, palette.trim)
  }
  if (category === 'lights') {
    k.cylinder(0, .035, 0, .115, .07, palette.color, .095, 10)
    k.cylinder(0, .078, 0, .085, .016, palette.trim, .085, 10)
  }
  if (category === 'props') {
    for (const x of [-.12, .12]) k.box(x, .025, -.09, .045, .05, .08, palette.trim)
  }
  if (category === 'fence') {
    for (const x of [-.4, .4]) k.cylinder(x, .745, 0, .045, .055, palette.trim, .008, 6)
  }
}

function buildThemedScenery(kind: BuildingKind, k: ModelKit): boolean {
  if (kind === 'desertPalm' || kind === 'palmTree') {
    const trunk = kind === 'desertPalm' ? sand : 0x8a6a3a
    const leaf = kind === 'desertPalm' ? 0x6a8f3a : 0x3f7b42
    k.cylinder(0, .55, 0, .05, 1.05, trunk, .035, 6)
    k.box(0, .03, 0, .18, .06, .18, kind === 'desertPalm' ? sand : 0x4d8b46)
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3
      const tip: [number, number, number] = [Math.cos(a) * .42, 1.03, Math.sin(a) * .42]
      const mid: [number, number, number] = [Math.cos(a) * .22, 1.19, Math.sin(a) * .22]
      k.beam([0, 1.1, 0], mid, .075, leaf)
      k.beam(mid, tip, .055, leaf)
      for (let n = 1; n < 4; n++) {
        const r = n * .09
        for (const side of [-1, 1]) k.beam([Math.cos(a) * r, 1.15, Math.sin(a) * r],
          [Math.cos(a) * (r + .06) - Math.sin(a) * .09 * side, 1.08, Math.sin(a) * (r + .06) + Math.cos(a) * .09 * side], .025, leaf)
      }
    }
    k.sphere(0, 1.14, 0, .08, leaf, 6)
    return true
  }
  if (kind === 'alpineFir') { pine(k, timber, [0x345c40, 0x407b49, 0x589451]); return true }
  if (kind === 'icePine') { pine(k, ice, [0xa8d4e4, 0xc8e8f4, 0xe8f4fa], cream); return true }
  if (kind === 'forestFern') {
    k.box(0, .04, 0, .2, .06, .2, bark)
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI / 2.6 - .4
      k.beam([0, .04, 0], [Math.cos(a) * .34, .25, Math.sin(a) * .34], .02, moss)
      for (let n = 1; n < 5; n++) for (const side of [-1, 1]) {
        const r = n * .065
        k.beam([Math.cos(a) * r, .05 + r * .6, Math.sin(a) * r],
          [Math.cos(a) * r - Math.sin(a) * .07 * side, .08 + r * .6, Math.sin(a) * r + Math.cos(a) * .07 * side], .03, n % 2 ? moss : 0x649852)
      }
    }
    return true
  }
  if (kind === 'neonPlant') { planterPot(k, ink, neonM, neonC); k.box(.06, .52, .04, .04, .12, .04, neonC); return true }
  if (kind === 'scrapPlanter') { planterPot(k, 0x6a6e72, 0x4d8b46, rust); k.box(.14, .2, 0, .04, .16, .08, steel); return true }
  if (kind === 'copperPlanter') { planterPot(k, copper, moss, brass); k.cylinder(0, .28, 0, .17, .03, brass, .17, 8); return true }
  if (kind === 'dustLantern') {
    k.box(0, .03, 0, .16, .06, .16, ink)
    k.cylinder(0, .42, 0, .02, .78, timber)
    for (const x of [-.18 / 2, .18 / 2]) for (const z of [-.18 / 2, .18 / 2]) k.box(x, .88, z, .018, .2, .018, sand)
    k.cylinder(0, .88 + .2 / 2 + .035, 0, .18 * .8, .07, sand, .025, 4)
    k.box(0, .88 - .2 / 2, 0, .18 * 1.15, .035, .18 * 1.15, sand)
    k.box(0, .88, 0, .12, .14, .12, 0xffd58a)
    return true
  }
  if (kind === 'foxfireLamp') {
    k.box(0, .03, 0, .16, .06, .16, bark)
    k.cylinder(0, .4, 0, .018, .72, timber)
    k.sphere(0, .86, 0, .1, 0x7ec8c4, 7)
    k.sphere(0, .92, .06, .05, cream, 5)
    return true
  }
  if (kind === 'workLamp') {
    k.box(0, .06, 0, .22, .1, .18, ink)
    k.box(0, .28, -.02, .06, .36, .06, steel)
    k.box(0, .52, .08, .22, .14, .16, 0xe4b754)
    k.box(0, .52, .14, .16, .1, .04, cream)
    return true
  }
  if (kind === 'spiritLantern') {
    k.box(0, .03, 0, .16, .06, .16, ink)
    k.cylinder(0, .5, 0, .02, .92, 0x4a3558)
    for (const x of [-.2 / 2, .2 / 2]) for (const z of [-.2 / 2, .2 / 2]) k.box(x, 1.02, z, .018, .24, .018, 0x6b3d8a)
    k.cylinder(0, 1.02 + .24 / 2 + .035, 0, .2 * .8, .07, 0x6b3d8a, .025, 4)
    k.box(0, 1.02 - .24 / 2, 0, .2 * 1.15, .035, .2 * 1.15, 0x6b3d8a)
    k.box(0, 1.02, 0, .14, .16, .14, 0xc8a0e8)
    k.cylinder(0, 1.18, 0, .06, .05, brass)
    return true
  }
  if (kind === 'carnivalBulbs') {
    for (const x of [-.44, .44]) { k.box(x, .68, 0, .04, 1.36, .06, timber); k.box(x, .03, 0, .12, .06, .22, ink) }
    k.beam([-.44, 1.28, 0], [.44, 1.28, 0], .016, ink)
    for (let n = 0; n < 6; n++) k.sphere(-.3 + n * .12, 1.18 - (n % 2) * .06, 0, .035, [0xc43d55, 0xe4b754, 0x3d7cc7][n % 3]!, 5)
    return true
  }
  if (kind === 'beerLantern') {
    k.box(0, .03, 0, .16, .06, .16, ink)
    k.cylinder(0, .48, 0, .02, .88, timber)
    for (const x of [-.2 / 2, .2 / 2]) for (const z of [-.2 / 2, .2 / 2]) k.box(x, .98, z, .018, .22, .018, 0xe4b754)
    k.cylinder(0, .98 + .22 / 2 + .035, 0, .2 * .8, .07, 0xe4b754, .025, 4)
    k.box(0, .98 - .22 / 2, 0, .2 * 1.15, .035, .2 * 1.15, 0xe4b754)
    k.box(0, .98, 0, .14, .14, .14, 0xffd58a)
    k.box(0, .86, 0, .16, .03, .16, rust)
    return true
  }
  if (kind === 'auroraLamp') {
    k.box(0, .04, 0, .2, .08, .2, ice)
    k.cylinder(0, .55, 0, .025, 1, ice, .02, 6)
    k.box(0, 1.12, 0, .08, .36, .08, aurora)
    k.box(.1, 1.2, 0, .06, .28, .06, auroraP)
    k.box(-.08, 1.16, .04, .05, .22, .05, cream)
    return true
  }
  if (kind === 'gasLamp') {
    k.box(0, .04, 0, .2, .08, .2, iron)
    k.cylinder(0, .6, 0, .03, 1.12, brass, .025, 6)
    for (const x of [-.18 / 2, .18 / 2]) for (const z of [-.18 / 2, .18 / 2]) k.box(x, 1.22, z, .018, .22, .018, brass)
    k.cylinder(0, 1.22 + .22 / 2 + .035, 0, .18 * .8, .07, brass, .025, 4)
    k.box(0, 1.22 - .22 / 2, 0, .18 * 1.15, .035, .18 * 1.15, brass)
    k.box(0, 1.22, 0, .12, .16, .12, 0xffd58a)
    k.cylinder(0, 1.38, 0, .08, .06, copper)
    return true
  }
  if (kind === 'playaTotem') {
    k.box(0, .06, 0, .4, .1, .4, sand)
    k.box(0, .36, 0, .22, .5, .18, rust)
    k.box(0, .72, 0, .28, .22, .22, sand)
    k.box(-.06, .74, .12, .05, .04, .02, ink)
    k.box(.06, .74, .12, .05, .04, .02, ink)
    k.box(0, 1.02, 0, .16, .36, .14, 0xe4b754)
    return true
  }
  if (kind === 'woodlandIdol') {
    k.cylinder(0, .2, 0, .16, .36, bark, .14, 6)
    k.box(0, .5, 0, .28, .28, .22, 0x6a5340)
    k.box(-.06, .52, .12, .05, .04, .02, cream)
    k.box(.06, .52, .12, .05, .04, .02, cream)
    k.cylinder(0, .82, 0, .1, .28, moss, .08, 6)
    k.box(0, 1.04, 0, .18, .12, .12, 0x4d8b46)
    return true
  }
  if (kind === 'neonArch') {
    for (const x of [-.34, .34]) k.box(x, .7, 0, .08, 1.36, .08, ink)
    k.box(0, 1.4, 0, .76, .08, .08, neonC)
    k.box(0, 1.28, .05, .6, .16, .03, neonM)
    for (const x of [-.34, .34]) k.box(x, .03, 0, .14, .06, .14, ink)
    return true
  }
  if (kind === 'tikiMask') {
    k.box(0, .06, 0, .22, .1, .16, timber)
    k.box(0, .55, 0, .32, .78, .12, 0xd97a3a)
    k.box(-.08, .7, .07, .07, .06, .02, ink)
    k.box(.08, .7, .07, .07, .06, .02, ink)
    k.box(0, .48, .07, .1, .12, .02, 0x6a5340)
    k.box(0, .98, 0, .2, .12, .1, rust)
    return true
  }
  if (kind === 'runeStone') {
    k.box(0, .4, 0, .28, .78, .16, 0x657774)
    k.box(0, .42, .09, .08, .28, .02, 0x6b3d8a)
    k.box(0, .7, .09, .12, .04, .02, brass)
    k.box(0, .06, 0, .34, .1, .22, 0x4a5554)
    return true
  }
  if (kind === 'miniBigTop') {
    k.cylinder(0, .22, 0, .32, .4, cream, .32, 8)
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4
      k.box(Math.cos(a) * .28, .22, Math.sin(a) * .28, .08, .4, .04, i % 2 ? 0xc43d55 : cream)
    }
    k.cylinder(0, .55, 0, .34, .18, 0xc43d55, .02, 8)
    k.cylinder(0, .7, 0, .02, .16, timber)
    k.box(0, .8, 0, .08, .04, .08, 0xe4b754)
    return true
  }
  if (kind === 'maypole') {
    k.cylinder(0, .85, 0, .03, 1.65, timber)
    k.box(0, .03, 0, .2, .06, .2, ink)
    k.cylinder(0, 1.62, 0, .16, .05, 0x4d8b46, .16, 8)
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2
      k.beam([0, 1.58, 0], [Math.cos(a) * .28, .7, Math.sin(a) * .28], .015, [0xc43d55, 0xe4b754, 0x3d7cc7, 0x4d8b46][i]!)
    }
    return true
  }
  if (kind === 'iceSculpture') {
    for (const [x,z,h] of [[-.2,0,.7],[.2,-.1,.9],[.12,.2,.5]]) k.cylinder(x!, h! / 2, z!, .095, h!, ice, .008, 5)
    k.box(0, .08, 0, .36, .12, .36, ice)
    k.box(0, .4, 0, .18, .5, .16, 0xa8d4e4)
    k.box(-.1, .7, 0, .1, .28, .1, cream)
    k.box(.08, .78, .04, .08, .22, .08, aurora)
    k.box(0, 1.02, 0, .06, .18, .06, auroraP)
    return true
  }
  if (kind === 'pipeTotem') {
    for (const y of [.2, .5, .85]) { k.cylinder(0, y, 0, .115, .045, brass); for (let n=0;n<6;n++) { const a=n*Math.PI/3; k.sphere(Math.cos(a)*.11,y,Math.sin(a)*.11,.018,iron,5) } }
    k.beam([-.18,.08,0],[-.18,.7,0],.05,copper)
    k.beam([-.18,.7,0],[0,.7,0],.05,copper)
    k.box(0, .06, 0, .36, .1, .36, iron)
    k.cylinder(0, .4, 0, .1, .56, copper, .1, 8)
    k.cylinder(0, .72, 0, .12, .04, brass, .12, 8)
    k.box(.16, .55, 0, .18, .06, .06, brass)
    k.cylinder(0, .98, 0, .08, .4, iron, .08, 8)
    k.cylinder(0, 1.22, 0, .12, .08, brass, .04, 8)
    return true
  }
  if (kind === 'tumbleweed') {
    k.sphere(0, .2, 0, .18, sand, 6)
    k.sphere(.08, .22, .06, .12, 0xd4b87a, 5)
    k.box(0, .04, 0, .16, .04, .16, rust)
    return true
  }
  if (kind === 'uvSpeaker') {
    k.box(0, .32, 0, .3, .56, .22, ink)
    k.cylinder(0, .36, .12, .09, .04, neonC, .09, 8)
    k.box(0, .54, .12, .16, .04, .02, neonM)
    k.box(0, .04, 0, .26, .08, .18, ink)
    return true
  }
  if (kind === 'coconutPile') {
    k.sphere(-.08, .14, .02, .12, 0x6e5530, 6)
    k.sphere(.1, .12, -.04, .1, 0x8a6a3a, 6)
    k.sphere(.02, .26, .04, .09, 0x5a4634, 6)
    k.box(0, .04, 0, .28, .04, .24, 0x4d8b46)
    return true
  }
  if (kind === 'popcornCart') {
    k.box(0, .28, 0, .42, .36, .28, 0xe4b754)
    k.box(0, .5, 0, .38, .12, .24, cream)
    k.box(0, .62, 0, .2, .16, .16, 0xc43d55)
    for (const x of [-.16, .16]) k.cylinder(x, .08, .1, .06, .04, ink, .06, 8)
    k.box(.2, .4, 0, .04, .2, .04, timber)
    return true
  }
  if (kind === 'snowman') {
    k.cylinder(0, .72, 0, .12, .025, ink)
    k.cylinder(0, .78, 0, .075, .12, ink)
    k.cylinder(0, .738, 0, .078, .025, 0xb9474c)
    k.box(0, .5, 0, .23, .045, .18, 0xb9474c)
    k.box(.055, .42, .12, .055, .18, .025, 0xb9474c)
    for (const side of [-1, 1]) k.beam([side * .1, .4, 0], [side * .27, .5, .02], .025, bark)
    for (const y of [.17, .25, .37]) k.sphere(0, y, .155, .015, ink, 5)
    k.sphere(0, .18, 0, .16, cream, 7)
    k.sphere(0, .42, 0, .12, 0xf4f7ff, 7)
    k.sphere(0, .6, 0, .09, cream, 6)
    k.box(0, .6, .1, .08, .02, .06, rust)
    k.box(-.03, .64, .08, .015, .015, .015, ink)
    k.box(.03, .64, .08, .015, .015, .015, ink)
    return true
  }
  if (kind === 'gearStack') {
    for (const [x, y, z, radius] of [[0, .12, 0, .18], [.08, .28, -.04, .14], [-.04, .42, .06, .1]]) {
      for (let n = 0; n < 12; n++) { const a = n * Math.PI / 6; k.box(x! + Math.cos(a) * radius!, y!, z! + Math.sin(a) * radius!, .048, .055, .048, brass) }
      k.cylinder(x!, y! + .038, z!, .035, .025, iron)
    }
    k.cylinder(0, .12, 0, .18, .06, brass, .18, 8)
    k.cylinder(.08, .28, -.04, .14, .06, copper, .14, 8)
    k.cylinder(-.04, .42, .06, .1, .05, brass, .1, 8)
    k.box(0, .04, 0, .28, .04, .28, iron)
    return true
  }
  if (kind === 'mossLog') {
    k.cylinder(0, .14, 0, .12, .22, bark, .12, 8)
    k.box(0, .14, 0, .7, .18, .22, 0x6a5340)
    k.box(-.1, .26, .04, .16, .04, .1, moss)
    k.box(.16, .24, -.02, .12, .04, .08, 0x4d8b46)
    return true
  }
  if (kind === 'palletBench') {
    for (let n = 0; n < 5; n++) k.box(0, .22, -.12 + n * .06, .7, .08, .052, n % 2 ? timber : 0xb28053)
    for (const x of [-.26, .26]) k.box(x, .1, 0, .08, .16, .26, timber)
    k.box(0, .28, -.1, .7, .16, .06, 0x9a6c42)
    return true
  }
  if (kind === 'tikiStool') { stool(k, timber, bark, rust); return true }
  if (kind === 'circusStool') { stool(k, 0xc43d55, cream, 0xe4b754); return true }
  if (kind === 'altarTable') {
    k.box(0, .32, 0, .7, .06, .36, bark)
    for (const x of [-.26, .26]) k.box(x, .16, 0, .08, .28, .3, timber)
    k.box(0, .4, 0, .16, .08, .12, 0x6b3d8a)
    k.cylinder(0, .5, 0, .03, .12, 0xd4652a, .01, 5)
    return true
  }
  if (kind === 'beerGardenTable') {
    for (let n = 0; n < 5; n++) k.box(0, .48, -.14 + n * .07, .86, .05, .06, n % 2 ? timber : 0xad7c50)
    for (const x of [-.22, .15]) { k.cylinder(x, .55, .02, .032, .1, cream); k.cylinder(x, .602, .02, .028, .012, 0xf9eabc) }
    for (const z of [-.32, .32]) k.box(0, .28, z, .86, .04, .14, 0xb28053)
    for (const x of [-.3, .3]) k.box(x, .22, 0, .06, .4, .34, bark)
    return true
  }
  if (kind === 'iceBench') {
    k.box(0, .22, 0, .64, .08, .22, ice)
    k.box(0, .34, -.08, .64, .18, .06, 0xa8d4e4)
    for (const x of [-.24, .24]) k.box(x, .1, 0, .08, .16, .2, cream)
    return true
  }
  if (kind === 'gearBench') {
    for (let n = 0; n < 4; n++) k.box(0, .24, -.09 + n * .06, .64, .07, .048, n % 2 ? copper : brass)
    for (const x of [-.27, .27]) { k.beam([x, .12, -.09], [x, .46, -.09], .035, iron); k.beam([x, .32, -.09], [x, .32, .1], .03, brass) }
    k.box(0, .36, -.08, .64, .16, .06, copper)
    for (const x of [-.22, .22]) k.cylinder(x, .1, 0, .08, .06, iron, .08, 8)
    return true
  }
  if (kind === 'glowTape') { edgePosts(k, ink, neonC, neonM); return true }
  if (kind === 'chainFence') {
    for (const x of [-.4, .4]) { k.box(x, .36, 0, .04, .72, .04, steel); k.box(x, .03, 0, .1, .06, .1, ink) }
    for (const y of [.3, .5]) {
      for (let n = 0; n < 5; n++) k.box(-.32 + n * .16, y, 0, .08, .04, .03, steel)
    }
    return true
  }
  if (kind === 'occultBanner') {
    for (const x of [-.4, .4]) { k.box(x, .64, 0, .04, 1.24, .06, 0x4a3558); k.box(x, .03, 0, .12, .06, .2, ink) }
    k.box(0, 1.18, 0, .82, .04, .06, timber)
    k.box(0, .88, 0, .7, .42, .04, 0x6b3d8a)
    k.box(0, .9, .03, .16, .16, .02, brass)
    return true
  }
  if (kind === 'iceFence') { edgePosts(k, ice, cream, aurora); return true }
  if (kind === 'pipeRail') {
    for (const x of [-.4, .4]) { k.cylinder(x, .36, 0, .035, .7, iron, .035, 6); k.box(x, .03, 0, .1, .06, .1, ink) }
    for (const y of [.28, .52]) k.box(0, y, 0, .82, .05, .05, brass)
    return true
  }
  return false
}

function build(kind: BuildingKind, variant?: string): BufferGeometry {
  const k = new ModelKit()
  const roof = roofSpec(kind)
  if (roof) {
    // Thin strips follow the roof slope and meet adjacent tiles without posts.
    for (let n = 0; n < 10; n++) {
      const z = -.45 + n * .1
      const y = roof.slope ? .05 + (n / 9) * .4 : .05
      const tilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), roof.slope ? -Math.atan(.4) : 0)
      k.box(0, y, z, 1, .06, .108, n % 2 ? roof.color : roof.trim, tilt)
    }
    return k.finish()
  }
  if (isWasteBin(kind)) {
    const spec = binSpec(kind)
    const tint = spec?.color ?? 0x3d6657, trim = spec?.trim ?? ink
    k.box(0, .22, .32, .26, .4, .26, tint)
    for (const x of [-.1, -.033, .033, .1]) for (const z of [.182, .458]) k.box(x, .21, z, .025, .33, .016, trim)
    k.box(0, .43, .32, .3, .045, .3, trim)
    k.box(0, .456, .32, .15, .012, .09, ink)
    k.box(0, .29, .168, .085, .1, .016, cream)
    return k.finish()
  }
  const wall = wallSpec(kind)
  if (wall) {
    const profile = roofWallTop(wall.shape, 0)
    if (profile !== undefined) {
      const left = roofWallTop(wall.shape, -.5)!, right = roofWallTop(wall.shape, .5)!
      const polygon: [number,number][] = [[-.5,0],[.5,0]]
      if (right > 0) polygon.push([.5,right])
      if (left > 0) polygon.push([-.5,left])
      k.panel(polygon, .065, wall.color)
      // Inset posts and seams are clipped to the roof profile, never rectangular above it.
      for (let n=0;n<10;n++) {
        const x=-.45+n*.1, h=Math.min(roofWallTop(wall.shape,x-.015)!,roofWallTop(wall.shape,x+.015)!)
        if(h>.015) for(const z of [-.038,.038]) k.box(x,h/2,z,.014,h,.01,wall.trim)
      }
      return k.finish()
    }
    const h = wall.height
    const opening = wall.shape === 'Window' || wall.shape === 'Door'
    // Segmented panels leave real openings, including a walk-through door silhouette.
    for (let row = 0; row < h * 10; row++) {
      const y = row * .1 + .05
      for (let col = 0; col < 10; col++) {
        const x = -.45 + col * .1
        if (opening && Math.abs(x) < .3 && y < .8 && (wall.shape === 'Door' || y > .3)) continue
        const ribbed = wall.style === 'industrial' || wall.style === 'bamboo'
        const striped = wall.style === 'circus' && col % 2 === 0
        const planks = wall.style === 'woodland' || wall.style === 'bamboo'
        const masonry = wall.style === 'adobe' || wall.style === 'arcane' || wall.style === 'ice'
        k.box(x, y, 0, planks ? .093 : .1, masonry ? .094 : .1, ribbed && col % 2 ? .08 : .065,
          new Color(striped ? wall.trim : wall.color).multiplyScalar(1 - ((planks ? col : row * 3 + col) % 4) * .045).getHex())
      }
    }
    for (const x of [-.475, .475]) k.box(x, h / 2, 0, .05, h, .095, wall.trim)
    for (const y of [.025, h - .025]) k.box(0, y, 0, 1, .05, .095, wall.trim)
    if (opening) {
      const bottom = wall.shape === 'Door' ? 0 : .3
      for (const x of [-.3, .3]) k.box(x, (bottom + .8) / 2, 0, .04, .8 - bottom, .105, wall.trim)
      k.box(0, .8, 0, .64, .04, .105, wall.trim)
      if (wall.shape === 'Window') {
        k.box(0, .3, 0, .68, .05, .14, wall.trim)
        k.box(0, .55, 0, .025, .5, .07, wall.trim)
      }
    }
    if (wall.style === 'chalet' && !opening) {
      k.beam([-.43, .07, .045], [.43, h - .07, .045], .045, wall.trim)
      k.beam([.43, .07, .045], [-.43, h - .07, .045], .045, wall.trim)
    }
    if (wall.style === 'brass' || wall.style === 'industrial') for (const x of [-.45, .45]) {
      for (const y of [.1, h - .1]) for (const z of [-.055, .055]) k.sphere(x, y, z, .018, wall.trim, 5)
    }
    if (wall.style === 'arcane' || wall.style === 'neon') {
      for (const x of [-.39, .39]) for (const z of [-.055, .055]) {
        k.box(x, h / 2, z, .018, h * .5, .018, wall.trim)
        if (wall.style === 'arcane') {
          k.beam([x, h * .5, z], [x + .045, h * .6, z], .016, wall.trim)
          k.beam([x, h * .4, z], [x - .045, h * .5, z], .016, wall.trim)
        }
      }
    }
    return k.finish()
  }
  embellishTheme(kind, k)
  if (buildThemedScenery(kind, k)) return k.finish()
  if (kind === 'bunting' || kind === 'stringLights') {
    for (const x of [-.44, .44]) { k.box(x, .68, 0, .045, 1.36, .07, timber); k.box(x, .03, 0, .13, .06, .27, ink) }
    for (let n = 0; n < 8; n++) {
      const x = -.44 + n * .11, y = 1.32 - Math.sin(n / 8 * Math.PI) * .16
      k.beam([x, y, 0], [x + .11, 1.32 - Math.sin((n + 1) / 8 * Math.PI) * .16, 0], .015, ink)
      if (kind === 'bunting') { k.box(x + .04, y - .055, 0, .085, .09, .015, [0xe4b754, 0xce5677, 0x5da397][n % 3]!); k.box(x + .04, y - .115, 0, .045, .04, .015, [0xe4b754, 0xce5677, 0x5da397][n % 3]!) }
      else k.cylinder(x + .04, y - .06, 0, .028, .06, 0xffe2a1, .02, 6)
    }
  } else if (kind === 'hayBale') {
    k.box(0, .22, 0, .85, .44, .65, 0xcaa658)
    for (let i = 0; i < 7; i++) k.box(0, .055 + i * .058, .331, .83, .013, .012, 0xe0bf70)
    for (const x of [-.25, .25]) { k.box(x, .22, .34, .025, .43, .015, timber); k.box(x, .445, 0, .025, .015, .66, timber) }
  } else if (kind === 'parasol') {
    k.box(0, .04, 0, .3, .08, .3, ink); k.cylinder(0, .55, 0, .025, 1.05, cream)
    k.cylinder(0, 1.03, 0, .48, .23, 0xd75b79, .02, 8)
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; k.beam([0, 1.15, 0], [Math.cos(a) * .47, .92, Math.sin(a) * .47], .018, cream) }
  } else if (kind === 'picnicTable') {
    for (let i = 0; i < 5; i++) k.box(0, .55, -.2 + i * .1, .88, .045, .085, i % 2 ? 0xb58051 : timber)
    for (const z of [-.38, .38]) { k.box(0, .32, z, .92, .05, .17, 0xb58051); for (const x of [-.28, .28]) k.beam([x, .03, z], [x, .54, 0], .065, timber) }
  } else if (kind === 'festivalSign') {
    k.box(0, .58, 0, .065, 1.16, .065, timber)
    for (let i = 0; i < 3; i++) { const sign = i % 2 ? -1 : 1, y = 1.08 - i * .2; k.box(0, y, 0, .64, .14, .05, i % 2 ? 0xc95778 : 0x559f91); k.box(sign * .34, y, 0, .08, .085, .05, i % 2 ? 0xc95778 : 0x559f91); k.box(0, y, .032, .35, .018, .012, cream) }
  } else if (kind === 'totem') {
    k.box(0, .05, 0, .46, .1, .46, 0x5a4634)
    k.cylinder(0, .28, 0, .16, .36, 0xd97a3a, .14, 6)
    k.box(0, .56, 0, .4, .28, .34, 0xe4b754)
    k.box(-.09, .58, .18, .07, .05, .02, ink)
    k.box(.09, .58, .18, .07, .05, .02, ink)
    k.box(0, .88, 0, .34, .34, .3, 0xce5677)
    k.box(0, .88, .16, .12, .08, .02, cream)
    k.box(0, 1.18, 0, .28, .28, .26, 0x5da397)
    k.box(0, 1.38, 0, .2, .14, .2, 0xe4b754)
    k.cylinder(0, 1.5, 0, .04, .18, cream)
  } else if (kind === 'flagPole') {
    k.box(0, .04, 0, .24, .08, .24, ink)
    k.cylinder(0, .88, 0, .028, 1.7, steel)
    k.box(.24, 1.48, 0, .46, .28, .025, 0xc43d55)
    k.box(.24, 1.5, .016, .22, .05, .012, cream)
    k.box(.24, 1.4, .016, .4, .035, .012, 0xe4b754)
    k.cylinder(0, 1.76, 0, .05, .06, 0xe4b754, .01)
  } else if (kind === 'lanternPole') {
    k.box(0, .03, 0, .2, .06, .2, ink)
    k.cylinder(0, .52, 0, .02, 1, timber)
    k.box(0, 1.08, 0, .22, .24, .22, 0xf2b35a)
    k.box(0, 1.08, 0, .16, .18, .16, 0xffd58a)
    k.box(0, .96, 0, .18, .03, .18, 0xd97a3a)
    k.cylinder(0, 1.22, 0, .07, .05, 0xd97a3a)
  } else if (kind === 'kegStack') {
    k.cylinder(-.14, .2, .05, .16, .38, 0x8a6a3a, .16, 8)
    k.cylinder(.16, .16, -.04, .14, .3, 0x6e5530, .14, 8)
    k.cylinder(.02, .5, .04, .13, .26, steel)
    for (const [x, y, z] of [[-.14, .2, .05], [.16, .16, -.04], [.02, .5, .04]] as const) {
      k.cylinder(x, y + .08, z, .165, .02, cream, .165, 8)
      k.cylinder(x, y - .08, z, .165, .02, cream, .165, 8)
    }
    k.box(-.14, .4, .05, .04, .04, .04, ink)
  } else if (kind === 'inflatable') {
    k.sphere(0, .28, .02, .24, 0xe86a8a, 8)
    k.sphere(0, .18, .16, .16, 0xf08aa3, 7)
    k.beam([0, .42, .04], [0, .98, .02], .09, 0xf08aa3)
    k.sphere(0, 1.08, .04, .13, 0xe86a8a, 7)
    k.box(0, 1.06, .16, .055, .04, .12, 0xf2b35a)
    k.box(-.2, .22, .04, .07, .2, .05, 0xe86a8a)
    k.box(.2, .22, .04, .07, .2, .05, 0xe86a8a)
    k.box(-.08, .04, .2, .045, .08, .16, 0xe4b754)
    k.box(.08, .04, .2, .045, .08, .16, 0xe4b754)
  } else if (kind === 'prayerFlags') {
    const flags = [0x3d7cc7, 0xf4f0e6, 0xc43d55, 0x4f9a62, 0xe4b754]
    for (const x of [-.44, .44]) { k.box(x, .68, 0, .04, 1.36, .06, timber); k.box(x, .03, 0, .12, .06, .24, ink) }
    k.beam([-.44, 1.3, 0], [.44, 1.3, 0], .018, ink)
    for (let n = 0; n < 5; n++) {
      const x = -.32 + n * .16, y = 1.12 - (n % 2) * .06
      k.box(x, y, 0, .13, .22, .015, flags[n]!)
      k.box(x, y - .08, 0, .04, .08, .012, flags[n]!)
    }
  } else if (kind === 'fireBowl') {
    k.cylinder(0, .06, 0, .2, .08, ink, .2, 8)
    k.cylinder(0, .16, 0, .22, .14, 0x6a5340, .16, 8)
    for (const [x, z] of [[-.06, .04], [.07, -.03], [0, .08]] as const) k.box(x, .24, z, .05, .04, .14, timber)
    k.cylinder(0, .34, 0, .07, .16, 0xd4652a, .02, 5)
    k.cylinder(0, .4, 0, .045, .14, 0xf2b35a, .01, 5)
    k.cylinder(0, .44, 0, .02, .1, cream, .01, 5)
  } else if (kind === 'picketFence') {
    for (const x of [-.4, -.13, .13, .4]) {
      k.box(x, .36, 0, .05, .72, .04, cream)
      k.box(x, .74, 0, .04, .08, .035, 0xe8d8b0)
    }
    for (const y of [.22, .48]) k.box(0, y, 0, .86, .045, .03, timber)
    for (const x of [-.4, .4]) k.box(x, .03, 0, .1, .06, .1, ink)
  } else if (kind === 'ropeFence') {
    for (const x of [-.4, .4]) {
      k.box(x, .36, 0, .045, .72, .045, timber)
      k.box(x, .03, 0, .12, .06, .12, ink)
      k.cylinder(x, .74, 0, .04, .04, 0xc9a15b)
    }
    for (const y of [.28, .5]) k.beam([-.4, y, 0], [.4, y, 0], .028, 0xc9a15b)
    k.box(0, .4, 0, .06, .08, .03, 0xe4b754)
  } else if (kind === 'streamers') {
    for (const x of [-.42, .42]) { k.box(x, .62, 0, .04, 1.24, .05, timber); k.box(x, .03, 0, .1, .06, .2, ink) }
    k.beam([-.42, 1.22, 0], [.42, 1.22, 0], .018, ink)
    const stream = [0xe86a8a, 0x5da397, 0xe4b754, 0x3d7cc7, 0xce5677]
    for (let n = 0; n < 5; n++) {
      const x = -.32 + n * .16
      k.box(x, .95, 0, .04, .52, .015, stream[n]!)
      k.box(x + .03, .78, 0, .03, .28, .012, stream[n]!)
    }
  } else if (kind === 'trafficCone') {
    k.cylinder(0, .04, 0, .16, .06, ink, .16, 8)
    k.cylinder(0, .2, 0, .12, .28, 0xe67a22, .04, 8)
    k.cylinder(0, .22, 0, .11, .05, cream, .09, 8)
    k.cylinder(0, .36, 0, .035, .04, 0xe67a22, .02, 6)
  } else if (kind === 'crateStack') {
    k.box(0, .16, 0, .42, .32, .38, 0xb28053)
    k.box(.08, .42, -.04, .36, .28, .34, 0x9a6c42)
    for (const y of [.16, .42]) {
      k.box(0, y, .2, .4, .02, .02, timber)
      k.box(.18, y, 0, .02, .26, .34, timber)
    }
    k.box(.08, .56, -.04, .12, .03, .12, 0xe4b754)
  } else if (kind === 'oilDrum') {
    k.cylinder(0, .28, 0, .18, .52, 0x4a6a72, .18, 8)
    k.cylinder(0, .52, 0, .185, .04, steel, .185, 8)
    k.cylinder(0, .06, 0, .185, .04, steel, .185, 8)
    k.cylinder(0, .28, 0, .19, .03, 0xe67a22, .19, 8)
    k.box(.14, .4, 0, .04, .08, .04, ink)
    k.box(0, .55, 0, .08, .03, .08, ink)
  } else if (kind === 'pinwheel') {
    k.box(0, .03, 0, .16, .06, .16, ink)
    k.cylinder(0, .4, 0, .018, .74, timber)
    k.sphere(0, .78, 0, .04, 0xe4b754, 6)
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2
      k.box(Math.cos(a) * .12, .78 + Math.sin(a) * .04, Math.sin(a) * .12, .16, .03, .08, [0xce5677, 0x5da397, 0xe4b754, 0x3d7cc7][i]!)
    }
  } else if (kind === 'windSock') {
    k.box(0, .04, 0, .2, .08, .2, ink)
    k.cylinder(0, .58, 0, .02, 1.08, steel)
    k.cylinder(.16, 1.05, 0, .09, .22, 0xe4b754, .05, 6)
    k.cylinder(.3, 1.05, 0, .05, .18, 0xc43d55, .03, 6)
    k.box(.16, 1.05, 0, .04, .24, .04, cream)
    k.cylinder(0, 1.14, 0, .035, .04, 0xe4b754)
  } else if (kind === 'hangingBasket') {
    k.box(0, .03, 0, .18, .06, .18, ink)
    k.cylinder(0, .42, 0, .018, .78, timber)
    k.beam([0, .82, 0], [0, .62, .12], .015, steel)
    k.cylinder(0, .52, .12, .12, .1, 0xbb7956, .1, 7)
    k.cylinder(0, .58, .12, .1, .08, 0x48784a, .08, 6)
    for (const [x, z] of [[-.05, .1], [.05, .14], [0, .08]] as const) {
      k.box(x, .64, z, .05, .04, .05, [0xd981a0, 0xe9be59, 0xcf6c93][(x > 0 ? 1 : 0)]!)
    }
  } else if (kind === 'cactusPot') {
    k.cylinder(0, .12, 0, .16, .22, 0xbb7956, .14, 7)
    k.box(0, .24, 0, .28, .04, .28, cream)
    k.cylinder(0, .46, 0, .08, .36, 0x4f9a62, .07, 6)
    k.cylinder(-.1, .42, .02, .045, .16, 0x3f7b42, .04, 5)
    k.cylinder(.09, .4, -.03, .04, .14, 0x3f7b42, .035, 5)
    k.box(0, .66, 0, .03, .04, .03, 0xce5677)
  } else if (kind === 'gnome') {
    k.cylinder(0, .08, 0, .14, .12, 0x4d8b46, .14, 7)
    k.cylinder(0, .22, 0, .1, .18, 0xc43d55, .1, 7)
    k.sphere(0, .38, 0, .09, 0xf2dfb5, 7)
    k.cylinder(0, .5, 0, .1, .16, 0xc43d55, .01, 7)
    k.box(0, .3, .1, .08, .04, .04, cream)
    k.box(-.03, .4, .08, .02, .015, .015, ink)
    k.box(.03, .4, .08, .02, .015, .015, ink)
    k.box(-.1, .22, .02, .04, .12, .04, 0xc43d55)
    k.box(.1, .22, .02, .04, .12, .04, 0xc43d55)
  } else if (kind === 'windChimes') {
    k.box(0, .03, 0, .16, .06, .16, ink)
    k.cylinder(0, .5, 0, .016, .9, timber)
    k.box(0, .96, 0, .28, .04, .28, 0xc0a468)
    for (const [x, z, h] of [[-.08, -.06, .28], [.08, -.04, .34], [-.04, .08, .22], [.06, .08, .3]] as const) {
      k.cylinder(x, .96 - h / 2 - .04, z, .018, h, steel, .018, 6)
    }
  } else if (kind === 'chalkboard') {
    k.box(0, .5, 0, .06, 1, .06, timber)
    k.box(0, .03, 0, .16, .06, .16, ink)
    k.box(0, .78, .04, .52, .36, .03, 0x3d4a3a)
    k.box(0, .78, .04, .56, .4, .02, timber)
    k.box(-.08, .8, .06, .18, .02, .012, cream)
    k.box(.1, .74, .06, .12, .02, .012, 0xe4b754)
  } else if (kind === 'loungeChair') {
    k.box(0, .16, .08, .42, .04, .7, 0xd75b79)
    k.box(0, .28, -.22, .42, .04, .28, 0xe86a8a)
    for (const x of [-.18, .18]) {
      k.beam([x, .03, .36], [x, .16, .08], .04, timber)
      k.beam([x, .03, -.28], [x, .28, -.22], .04, timber)
    }
    k.box(0, .34, -.3, .36, .03, .08, cream)
  } else if (kind === 'beanBag') {
    k.sphere(0, .16, 0, .22, 0x5da397, 8)
    k.sphere(0, .2, .06, .16, 0x4f8a82, 7)
    k.box(0, .28, 0, .18, .04, .18, 0x3d7cc7)
  } else if (kind === 'tikiTorch') {
    k.box(0, .03, 0, .16, .06, .16, ink)
    k.cylinder(0, .5, 0, .03, .92, timber)
    k.cylinder(0, .98, 0, .08, .1, 0x6a5340, .06, 7)
    k.cylinder(0, 1.1, 0, .05, .16, 0xd4652a, .02, 5)
    k.cylinder(0, 1.16, 0, .03, .12, 0xf2b35a, .01, 5)
    k.cylinder(0, 1.2, 0, .015, .08, cream, .01, 5)
  } else if (kind === 'decoSpeaker') {
    k.box(0, .04, 0, .28, .08, .22, ink)
    k.box(0, .36, 0, .32, .56, .24, 0x292b32)
    k.cylinder(0, .42, .13, .1, .04, 0x4c6063, .1, 8)
    k.cylinder(0, .22, .13, .06, .03, 0x4c6063, .06, 7)
    k.box(0, .62, .13, .18, .04, .02, cream)
    k.box(.14, .5, 0, .03, .12, .08, steel)
  } else if (kind === 'boombox') {
    k.box(0, .16, 0, .52, .28, .22, 0x383a43)
    for (const x of [-.16, .16]) k.cylinder(x, .16, .12, .08, .04, 0x4c6063, .08, 8)
    k.box(0, .22, .12, .12, .08, .02, 0x6aa6b3)
    k.box(0, .1, .12, .1, .03, .02, cream)
    for (const x of [-.24, .24]) k.box(x, .3, 0, .04, .08, .08, ink)
  } else if (kind === 'photoFrame') {
    k.box(-.32, .7, 0, .08, 1.4, .08, timber)
    k.box(.32, .7, 0, .08, 1.4, .08, timber)
    k.box(0, 1.36, 0, .72, .08, .08, timber)
    k.box(0, .08, 0, .72, .08, .12, timber)
    k.box(0, 1.36, .05, .4, .22, .03, 0xe4b754)
    k.box(0, 1.36, .07, .28, .08, .02, 0xc43d55)
    for (const x of [-.32, .32]) k.box(x, .03, 0, .14, .06, .16, ink)
  } else if (kind === 'discoBall') {
    k.box(0, .03, 0, .2, .06, .2, ink)
    k.cylinder(0, .55, 0, .02, 1.02, steel)
    k.sphere(0, 1.18, 0, .16, 0xc8d4ee, 8)
    k.box(-.08, 1.2, .12, .05, .05, .02, cream)
    k.box(.08, 1.16, .12, .05, .05, .02, 0x7ec8c4)
    k.box(0, 1.08, .12, .05, .05, .02, 0xe4b754)
    k.box(0, 1.34, 0, .04, .04, .04, steel)
  } else if (kind === 'inflatableCactus') {
    k.cylinder(0, .08, 0, .16, .12, 0xbb7956, .16, 7)
    k.cylinder(0, .5, 0, .12, .72, 0x4f9a62, .1, 7)
    k.cylinder(-.16, .42, 0, .07, .28, 0x3f7b42, .06, 6)
    k.cylinder(.16, .5, 0, .07, .24, 0x3f7b42, .06, 6)
    k.box(0, .88, 0, .04, .04, .04, 0xce5677)
    k.box(-.16, .58, 0, .03, .03, .03, 0xe4b754)
    k.sphere(0, .12, 0, .08, 0xe86a8a, 6)
  } else if (kind === 'giantMushroom') {
    k.cylinder(0, .28, 0, .1, .5, cream, .12, 7)
    k.cylinder(0, .62, 0, .32, .18, 0xce5677, .08, 8)
    k.sphere(0, .7, 0, .22, 0xd981a0, 7)
    for (const [x, z] of [[-.12, .08], [.1, -.06], [.04, .12]] as const) {
      k.sphere(x, .68, z, .05, cream, 5)
    }
    k.box(0, .04, 0, .22, .06, .22, 0x4d8b46)
  } else if (kind === 'crystalTotem') {
    k.box(0, .06, 0, .4, .1, .4, 0x657774)
    k.cylinder(0, .32, 0, .12, .4, 0x7ec8c4, .08, 6)
    k.box(0, .62, 0, .18, .28, .16, 0x5da397)
    k.box(-.08, .88, 0, .1, .24, .1, 0xc8d4ee)
    k.box(.06, .82, .04, .08, .2, .08, 0x7ec8c4)
    k.box(0, 1.08, 0, .06, .16, .06, cream)
    k.box(0, .24, .16, .12, .04, .02, 0xe4b754)
  } else if (kind === 'welcomeArch') {
    for (const x of [-.36, .36]) {
      k.box(x, .7, 0, .1, 1.4, .1, timber)
      k.box(x, .03, 0, .16, .06, .16, ink)
    }
    k.box(0, 1.42, 0, .82, .12, .12, timber)
    k.box(0, 1.28, .06, .7, .22, .04, 0xc95670)
    k.box(0, 1.28, .08, .4, .06, .02, cream)
    for (let i = 0; i < 3; i++) k.box(-.22 + i * .22, 1.56, 0, .08, .12, .04, [0xe4b754, 0x5da397, 0xce5677][i]!)
    k.box(0, 1.68, 0, .2, .08, .08, 0xe4b754)
  } else if (kind === 'shrub' || kind === 'flowerbed' || kind === 'planter') {
    const base = kind === 'planter' ? .35 : .06
    k.box(0, base / 2, 0, .8, base, .8, kind === 'planter' ? 0xb37751 : 0x88754f)
    k.box(0, base, 0, .7, .025, .7, 0x4f5135)
    if (kind === 'planter') for (const x of [-.37, .37]) k.box(x, .34, 0, .08, .07, .87, cream)
    for (let i = 0; i < 9; i++) {
      const x = (i % 3 - 1) * .23, z = (Math.floor(i / 3) - 1) * .23
      const height = kind === 'shrub' ? .21 + i % 3 * .06 : .1
      k.cylinder(x, base + height / 2, z, .14, height, i % 2 ? 0x699a50 : 0x48784a, .11, 5)
      k.box(x, base + height, z, .115, .035, .115, [0xe9be59, 0xcf6c93, 0xeee6bb][i % 3]!)
      k.box(x, base + height + .024, z, .034, .015, .034, 0xf6dc8e)
    }
  } else if (kind === 'rock') {
    k.cylinder(-.13, .18, .06, .36, .36, 0x798783, .24, 5)
    k.cylinder(.24, .11, -.18, .24, .22, 0xa0aaa0, .16, 5)
    k.box(-.2, .05, .27, .31, .065, .17, 0x739055)
  } else if (kind === 'statue') {
    k.box(0, .06, 0, .7, .12, .7, 0x657774)
    k.box(0, .23, 0, .48, .23, .48, 0xb0b8a6)
    k.box(0, .24, .25, .27, .075, .018, 0xb59a5c)
    k.cylinder(-.12, .46, 0, .16, .13, 0xbd9b51, .14)
    k.beam([0, .45, 0], [0, 1.12, 0], .07, 0xd4b66b)
    k.beam([0, 1.1, 0], [.27, .98, 0], .08, 0xd4b66b)
    k.beam([.27, .98, 0], [.27, .82, 0], .07, 0xbd9b51)
  } else if (kind === 'banner') {
    for (const x of [-.4, .4]) {
      k.box(x, .64, 0, .045, 1.28, .08, timber)
      k.box(x, .025, 0, .14, .05, .3, ink)
      k.cylinder(x, 1.32, 0, .05, .08, 0xd7b968, .01)
    }
    k.box(0, 1.2, 0, .86, .045, .08, timber)
    k.box(0, .93, 0, .74, .47, .055, 0xb74967)
    k.box(0, .72, .033, .74, .035, .02, cream)
    for (const side of [-1, 1]) {
      k.box(0, .98, side * .036, .37, .035, .014, cream)
      k.box(-.07, .89, side * .036, .23, .035, .014, cream)
      k.box(.12, 1.04, side * .036, .035, .16, .014, cream)
    }
  } else if (kind === 'food' || kind === 'alcohol' || kind === 'mascot' || kind === 'shirt') {
    const accent = kind === 'food' ? 0xd95b3e : kind === 'alcohol' ? 0x3c8775 : kind === 'mascot' ? 0xe8a07a : 0x2f6fdb
    k.box(0, .045, 0, .88, .09, .86, ink)
    k.box(0, .29, -.05, .76, .48, .66, timber)
    // Board siding, serving recess, rear shelf and raised fascia.
    for (let i = 0; i < 9; i++) k.box(-.34 + i * .085, .3, .288, .072, .43, .025, i % 2 ? 0xb27c51 : 0xa16c47)
    k.box(0, .63, -.315, .76, .3, .045, accent)
    for (const x of [-.36, .36]) k.box(x, .57, 0, .055, .53, .67, accent)
    k.box(0, .51, .32, .83, .055, .25, cream)
    k.box(0, .51, -.32, .83, .055, .25, cream)
    k.box(.38, .51, 0, .25, .055, .7, cream)
    k.box(-.38, .51, 0, .25, .055, .7, cream)
    k.box(0, .75, .12, .86, .07, .93, cream)
    for (let i = 0; i < 9; i++) {
      const color = i % 2 ? cream : accent
      k.box(-.4 + i * .1, .8, .15, .1, .05, .88, color)
      k.box(-.4 + i * .1, .73, .565, .1, .1, .035, color)
    }
    k.box(0, .96, -.12, .43, .25, .065, ink)
    k.box(0, .96, -.078, .38, .2, .02, cream)
    k.box(-.26, .6, .33, .105, .12, .09, ink) // till
    k.box(-.26, .65, .38, .07, .025, .01, 0x84c1aa)
    k.box(.26, .615, -.285, .13, .16, .02, ink) // menu
    for (let i = 0; i < 4; i++) k.box(.26, .67 - i * .032, -.27, .095, .009, .006, cream)
    if (kind === 'food') {
      // Burger sign, trays, sauce bottles and extractor stack.
      k.box(0, 1.01, -.055, .23, .045, .025, 0xe5a047)
      k.box(0, .958, -.055, .25, .025, .025, 0x76a151)
      k.box(0, .93, -.055, .21, .032, .025, 0x754733)
      k.box(0, .902, -.055, .23, .025, .025, 0xe5a047)
      for (const x of [-.09, .07]) {
        k.box(x, .547, .32, .12, .018, .13, steel)
        k.box(x, .564, .32, .08, .02, .07, 0xe5a047)
      }
      k.cylinder(.24, .58, .3, .025, .085, 0xd74132)
      k.cylinder(.31, .58, .3, .025, .085, 0xecc44e)
      k.box(-.27, .94, -.26, .09, .22, .1, steel)
      k.box(-.27, 1.06, -.26, .14, .035, .14, ink)
    } else if (kind === 'alcohol') {
      k.box(-.02, .97, -.05, .12, .12, .03, 0xe9b64b)
      k.box(-.02, 1.04, -.05, .14, .03, .035, 0xfff7de)
      k.box(.065, .965, -.05, .035, .07, .03, 0xe9b64b)
      for (let i = 0; i < 5; i++) {
        k.cylinder(-.23 + i * .09, .6, -.23, .026, .12, i % 2 ? 0x4a8058 : 0xa57c38)
        k.cylinder(-.23 + i * .09, .68, -.23, .013, .04, cream)
      }
      for (const x of [0, .13, .26]) {
        k.cylinder(x, .55, .34, .027, .055, cream)
        k.beam([x, .54, .1], [x, .67, .1], .018, steel)
        k.box(x, .68, .13, .025, .045, .075, ink)
      }
    } else if (kind === 'mascot') {
      k.box(0, 1.02, -.04, .1, .09, .08, 0xe8a07a)
      for (const x of [-.028, .028]) k.box(x, 1.07, -.05, .028, .024, .024, 0xe8a07a)
      k.box(-.018, 1.01, -.005, .012, .01, .008, ink)
      k.box(.018, 1.01, -.005, .012, .01, .008, ink)
      k.box(0, .545, .3, .16, .07, .12, 0xf2d36b)
      k.box(.18, .58, .3, .05, .05, .05, 0x7ec8c4)
      k.box(-.16, .575, .3, .044, .044, .044, 0xe8a07a)
    } else {
      k.box(0, .99, -.05, .2, .08, .03, 0x2f6fdb)
      k.box(0, 1.04, -.05, .12, .03, .03, 0x2f6fdb)
      for (const x of [-.2, 0, .2]) {
        k.box(x, .56, .3, .12, .07, .09, [0xe23b3b, 0x2f6fdb, 0x3d9b5c][(x + 2) % 3]!)
        k.box(x, .6, .3, .05, .02, .04, cream)
      }
    }
  } else if (kind === 'toilet') {
    // A single moulded portable cabin: broad door, ribbed plastic shell and white roof cap.
    const plastic = 0x378caa, ridge = 0x59a6bc, door = 0x468fa9, roof = 0xe8ece1
    k.box(0, .045, 0, .74, .09, .78, 0x34454b)
    for (const x of [-.25, .25]) k.box(x, .02, 0, .1, .04, .8, ink) // pallet runners
    k.box(0, .575, 0, .66, .99, .68, plastic)
    k.box(0, .13, 0, .7, .1, .72, 0x2a718c)
    for (const x of [-.315, .315]) {
      k.box(x, .595, .335, .055, .97, .045, ridge)
      k.box(x, .595, -.335, .055, .97, .045, ridge)
    }
    // Recessed door and raised mouldings, with a non-animated vacant indicator.
    k.box(0, .575, .35, .535, .91, .026, 0x245b72)
    k.box(0, .575, .369, .48, .85, .018, door)
    k.box(0, .53, .383, .37, .57, .016, plastic)
    for (const x of [-.17, 0, .17]) k.box(x, .51, .395, .018, .47, .014, ridge)
    k.box(0, .92, .386, .22, .13, .018, roof)
    // Pixel WC lettering is geometry, so it stays crisp in the world and menu thumbnail.
    for (const x of [-.074, -.039, -.004]) k.box(x, .924, .399, .015, .066, .009, 0x235b72)
    k.box(-.039, .897, .399, .085, .015, .009, 0x235b72)
    k.box(.044, .924, .399, .015, .066, .009, 0x235b72)
    for (const y of [.896, .95]) k.box(.065, y, .399, .05, .015, .009, 0x235b72)
    k.box(.199, .66, .393, .054, .105, .02, ink)
    k.box(.199, .69, .408, .028, .027, .014, 0xcbd5c7)
    k.box(.199, .638, .418, .018, .053, .028, 0xc4ceca)
    for (const y of [.32, .81]) k.box(-.249, y, .389, .029, .085, .027, 0x6c8990)
    k.box(0, .097, .383, .53, .04, .12, 0x778788)
    // Moulded ribs and upper ventilation louvers make side/back views recognisable too.
    for (const side of [-1, 1]) {
      for (const z of [-.22, -.075, .075, .22]) k.box(side * .338, .555, z, .025, .7, .027, ridge)
      for (let j = 0; j < 3; j++) k.box(side * .342, .965 + j * .028, 0, .019, .014, .43, 0x2a657a)
    }
    for (const x of [-.21, 0, .21]) k.box(x, .57, -.351, .032, .76, .026, ridge)
    // Stepped, lightly domed white cap rather than a house-shaped roof.
    k.box(0, 1.074, 0, .75, .064, .79, 0xcbd6d2)
    k.box(0, 1.116, 0, .72, .052, .76, roof)
    k.box(0, 1.152, 0, .62, .026, .65, 0xf4f3e8)
    for (const x of [-.2, 0, .2]) k.box(x, 1.17, 0, .025, .013, .51, 0xd8e2dc)
    k.cylinder(.255, .79, -.365, .027, .9, 0x40565e, .027, 6)
    k.cylinder(.255, 1.25, -.365, .044, .04, 0x34454b, .044, 6)
  } else if (kind === 'tree') {
    k.cylinder(0, .49, 0, .1, .96, timber, .058, 6)
    for (const sign of [-1, 1]) k.beam([0, .55, 0], [sign * .23, 1.04, .08], .065, 0x74543b)
    // Stepped, faceted foliage keeps the isometric silhouette legible.
    for (let i = 0; i < 4; i++) {
      const y = .8 + i * .25, r = .49 - i * .09
      k.cylinder(0, y, 0, r, .47, [0x345c40, 0x407b49, 0x589451, 0x78a85c][i]!, r * .22, 7)
    }
    k.box(-.11, .03, .03, .23, .06, .16, 0x6c7d48)
  } else if (kind === 'hedge') {
    k.box(0, .08, 0, .87, .16, .35, 0x716148)
    for (let i = 0; i < 7; i++) {
      k.box(-.36 + i * .12, .31 + i % 2 * .025, 0, .17, .42, .35, i % 2 ? 0x54884e : 0x3c6e46)
      k.box(-.36 + i * .12, .535 + i % 2 * .025, 0, .15, .035, .3, 0x79a35c)
    }
  } else if (kind === 'bench') {
    for (let i = 0; i < 4; i++) k.box(0, .28, .25 + i * .065, .69, .035, .048, i % 2 ? 0xb6814e : timber)
    for (let i = 0; i < 3; i++) k.box(0, .37 + i * .066, .215, .69, .043, .035, 0xb6814e)
    for (const x of [-.26, .26]) {
      k.box(x, .15, .33, .04, .28, .22, ink)
      k.box(x, .4, .22, .04, .26, .045, ink)
      k.box(x, .37, .335, .04, .035, .27, ink)
      for (const y of [.37, .5]) k.box(x, y, .238, .018, .018, .01, steel)
    }
  } else if (kind === 'sealedWasteContainer') {
    // One merged dumpster: lid, body, rails. No mesh per bag.
    k.box(0, .08, 0, .86, .12, .62, ink)
    k.box(0, .48, 0, .8, .68, .56, 0x3f4c3a)
    k.box(0, .84, 0, .84, .08, .6, 0x2b3428)
    k.box(0, .9, .02, .72, .05, .46, 0x1c241c)
    for (const x of [-.28, .28]) {
      k.box(x, .5, .3, .08, .42, .04, steel)
      k.box(x, .18, 0, .1, .14, .58, ink)
    }
    k.box(0, .56, .29, .22, .1, .03, cream)
    k.box(.32, .86, 0, .08, .04, .18, 0x142018)
  } else if (kind === 'wasteBin') {
    k.box(0, .22, 0, .3, .4, .3, 0x3d6657)
    for (const x of [-.12, -.04, .04, .12]) k.box(x, .21, .156, .035, .34, .02, 0x2b4b43)
    k.box(0, .43, 0, .35, .045, .34, ink)
    k.box(0, .465, -.02, .19, .025, .13, 0x142828)
    k.box(0, .29, .173, .1, .12, .018, cream)
    k.box(0, .29, .187, .045, .06, .01, 0x3d6657)
  } else if (kind === 'stage') {
    // Compact festival stage: raised deck, four-point truss, roof skin and flown PA.
    k.box(0, .1, 0, .94, .2, .84, 0x20282d)
    k.box(0, .22, .04, .9, .06, .76, 0x657278)
    for (const x of [-.36, -.12, .12, .36]) k.box(x, .25, .43, .18, .08, .14, 0x404a4f)
    const posts: ReadonlyArray<readonly [number, number]> = [[-.4, -.31], [.4, -.31], [.4, .31], [-.4, .31]]
    for (const [x, z] of posts) {
      k.box(x, 1.02, z, .045, 1.58, .045, steel)
      k.box(x, .09, z, .16, .08, .16, 0x252b2e)
    }
    for (const y of [.48, .82, 1.16, 1.5]) {
      k.beam([-.4, y, -.31], [.4, y, -.31], .025, steel)
      k.beam([-.4, y, .31], [.4, y, .31], .025, steel)
      if (y < 1.5) {
        k.beam([-.4, y, -.31], [.4, y + .34, -.31], .018, steel)
        k.beam([.4, y, .31], [-.4, y + .34, .31], .018, steel)
      }
    }
    k.box(0, 1.66, 0, .96, .08, .8, 0x33434b)
    k.box(0, 1.7, .03, .88, .035, .72, 0x7b365d)
    k.box(0, 1.24, -.326, .72, .68, .035, 0x171d22)
    for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
      k.box(-.28 + col * .14, 1.02 + row * .2, -.35, .115, .15, .014,
        [0x6f2f72, 0x225c75, 0xb84b67][(row + col) % 3]!)
    }
    for (const x of [-.48, .48]) for (let cabinet = 0; cabinet < 3; cabinet++) {
      const y = 1.37 - cabinet * .17
      k.box(x, y, .28, .16, .14, .22, 0x171b1e)
      k.box(x, y, .397, .12, .09, .014, 0x4b5559)
    }
  } else if (kind === 'directionalSpeaker' || kind === 'omniSpeaker') {
    const omni = kind === 'omniSpeaker'
    k.box(0, .045, 0, .58, .09, .58, 0x252b2e)
    for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
      k.beam([0, .16, 0], [Math.sin(angle) * .31, .03, Math.cos(angle) * .31], .035, steel)
    }
    k.cylinder(0, .55, 0, .035, .9, steel, .05, 7)
    const angles = omni ? [0, Math.PI / 2, Math.PI, -Math.PI / 2] : [0]
    for (const angle of angles) {
      const turn = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle)
      const x = Math.sin(angle) * (omni ? .13 : 0), z = Math.cos(angle) * (omni ? .13 : 0)
      k.box(x, .98, z, omni ? .26 : .4, .5, .24, 0x171b1e, turn)
      k.box(x + Math.sin(angle) * .126, 1.04, z + Math.cos(angle) * .126,
        omni ? .2 : .33, .31, .018, 0x4b5559, turn)
      k.box(x + Math.sin(angle) * .138, 1.14, z + Math.cos(angle) * .138,
        omni ? .08 : .12, .08, .012, ink, turn)
      k.box(x + Math.sin(angle) * .138, .92, z + Math.cos(angle) * .138,
        omni ? .14 : .21, .14, .012, 0x252c30, turn)
    }
    if (!omni) {
      k.box(-.23, .99, -.04, .035, .38, .16, steel)
      k.box(.23, .99, -.04, .035, .38, .16, steel)
      k.box(0, .73, 0, .15, .05, .15, ink)
    }
  } else if (kind === 'generator' || kind === 'backupGenerator') {
    const tint = kind === 'generator' ? 0xe2ab39 : 0x74958a
    k.box(0, .07, 0, .83, .1, .65, ink)
    k.box(0, .33, 0, .76, .44, .52, tint)
    k.box(0, .57, 0, .8, .05, .57, cream)
    for (let i = 0; i < 7; i++) k.box(-.25 + i * .066, .35, .266, .029, .25, .02, ink)
    k.box(.39, .39, .08, .02, .22, .21, ink)
    k.box(.404, .43, .1, .008, .07, .11, 0x77b9a3)
    k.box(.407, .35, .09, .01, .035, .035, 0xde5a43)
    k.cylinder(-.22, .69, -.16, .035, .24, ink)
    k.box(-.22, .82, -.16, .1, .025, .08, steel)
    for (const x of [-.3, .3]) k.box(x, .1, 0, .11, .14, .68, ink)
    k.box(.1, .46, -.266, .19, .11, .015, cream)
    k.box(.1, .46, -.277, .04, .075, .01, ink)
  } else if (kind === 'foh') {
    k.box(0, .06, 0, .92, .12, .8, ink)
    k.box(0, .39, .05, .74, .27, .42, 0x42555c)
    k.box(0, .54, .05, .76, .03, .43, ink)
    // Standing on its own it is the all-round desk it always was. Put two of them side by side and
    // they share the work the way a real front-of-house does: one becomes the sound console, the
    // other the lighting desk, and their canopies line up into one stand.
    if (variant === 'sound') {
      for (let strip = 0; strip < 12; strip++) {
        const x = -.33 + strip * .06
        k.box(x, .564, .13, .008, .008, .19, steel) // channel fader slot
        k.box(x, .576, .07 + (strip % 4) * .04, .03, .016, .02, strip % 4 ? cream : 0xdf7349) // its cap
        for (const row of [-.04, -.1]) k.box(x, .576, row, .028, .022, .028, strip % 3 ? 0x6f7d84 : 0x8fb3c4) // rotary above it
      }
      for (const x of [-.21, .21]) { k.box(x, .69, -.13, .25, .21, .045, ink); k.box(x, .7, -.102, .21, .15, .014, 0x6aa6b3) } // meter screens
      k.box(0, .3, -.3, .3, .46, .14, ink) // outboard rack tucked under the desk
      for (let unit = 0; unit < 4; unit++) k.box(0, .14 + unit * .1, -.232, .24, .07, .015, 0x4c6063)
    } else if (variant === 'light') {
      for (let row = 0; row < 3; row++) for (let key = 0; key < 8; key++) {
        k.box(-.27 + key * .078, .574, .16 - row * .07, .05, .014, .05, (row + key) % 3 ? 0x7f8b92 : [0xdf7349, 0x6aa6b3, 0x9dcc9a][row]!) // playback keys
      }
      for (const x of [-.31, -.23]) { k.box(x, .564, -.07, .008, .008, .14, steel); k.box(x, .576, -.04, .032, .016, .02, cream) } // grand master and chase speed
      k.box(.13, .58, -.08, .07, .04, .07, 0x2b3a40) // trackball for the moving lights
      k.box(0, .72, -.13, .52, .25, .045, ink); k.box(0, .73, -.102, .46, .19, .014, 0x6aa6b3) // one wide plot screen
    } else {
      for (let i = 0; i < 9; i++) {
        k.box(-.3 + i * .075, .564, .12, .008, .008, .16, steel)
        k.box(-.3 + i * .075, .575, .075 + i % 3 * .045, .035, .015, .02, i % 3 ? cream : 0xdf7349)
      }
      for (const x of [-.19, .19]) {
        k.box(x, .68, -.11, .23, .19, .045, ink)
        k.box(x, .69, -.083, .19, .13, .014, 0x6aa6b3)
      }
    }
    for (const x of [-.42, .42]) for (const z of [-.32, .32]) k.box(x, .62, z, .035, 1.18, .035, steel)
    k.box(0, 1.21, 0, .94, .085, .83, 0x355c66)
    k.box(0, 1.16, .42, .94, .09, .03, cream)
  } else if (kind === 'delayTower') {
    // A ballasted tower of four vertical trusses with a line array hung off its front, the way
    // delay positions are actually rigged out in the field.
    const posts: ReadonlyArray<readonly [number, number]> = [[-.16, -.16], [.16, -.16], [.16, .16], [-.16, .16]]
    k.box(0, .05, 0, .74, .1, .74, ink) // ballast plate
    for (const [x, z] of posts) {
      k.box(x * 1.6, .13, z * 1.6, .18, .16, .18, 0x1d2427) // ballast weight over each foot
      k.box(x, 1.22, z, .05, 2.18, .05, steel) // tower leg
    }
    for (let level = 0; level < 6; level++) {
      const y = .35 + level * .36
      for (let n = 0; n < 4; n++) {
        const a = posts[n]!, b = posts[(n + 1) % 4]!
        k.beam([a[0], y, a[1]], [b[0], y, b[1]], .028, steel) // rung
        if (n % 2 === 0 && level < 5) k.beam([a[0], y, a[1]], [b[0], y + .36, b[1]], .022, steel) // diagonal, on two opposite faces, never past the top rung
      }
    }
    k.box(0, 2.36, 0, .44, .06, .44, steel) // head frame the array flies from
    k.box(0, 2.3, .22, .12, .05, .36, steel) // pickup arm reaching out from the head frame
    k.box(0, 2.26, .38, .46, .07, .14, steel) // bumper bar the array flies from
    // The hang, rigged exactly like the stage's own line arrays: the cabinets are threaded onto
    // one continuous rod, the top two dead straight to throw far down the field, and from the
    // third one every further cabinet picks up another 6 degrees of down-tilt for the rows
    // standing right at the tower.
    const pitch = .19, cursor = new Vector3(0, 2.2, .38) // clear of the tower's own front legs
    for (let cabinet = 0; cabinet < 5; cabinet++) {
      const turn = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.max(0, cabinet - 1) * Math.PI / 30)
      const dir = new Vector3(0, -1, 0).applyQuaternion(turn)
      const centre = cursor.clone().addScaledVector(dir, pitch / 2)
      const put = (lx: number, ly: number, lz: number, w: number, h: number, depth: number, color: number) => {
        const wp = new Vector3(lx, ly, lz).applyQuaternion(turn).add(centre)
        k.box(wp.x, wp.y, wp.z, w, h, depth, color, turn)
      }
      put(0, 0, 0, .5, .15, .3, ink) // cabinet
      put(0, -.01, .15, .4, .1, .02, 0x4c6063) // its grille
      put(.21, .02, .15, .02, .02, .015, cream) // rigging pin
      put(.23, 0, -.12, .035, pitch, .035, steel) // rod segment, spanning the full pitch so the joints meet exactly
      cursor.addScaledVector(dir, pitch)
    }
  } else if (kind === 'videoWall') {
    // Touring LED wall on a ballasted rear truss. The bright front remains part of
    // the shared vertex-color batch; WorldView adds one shared emissive overlay.
    for (const x of [-.43, .43]) {
      k.box(x, .12, -.08, .2, .18, .28, 0x22292d)
      k.box(x, 1.08, -.08, .045, 1.82, .045, steel)
    }
    for (const y of [.38, .72, 1.06, 1.4, 1.74]) {
      k.beam([-.43, y, -.08], [.43, y, -.08], .026, steel)
      if (y < 1.7) k.beam([-.43, y, -.08], [.43, y + .34, -.08], .018, steel)
    }
    k.box(0, 1.08, .02, .84, 1.48, .1, 0x151b20)
    for (let row = 0; row < 6; row++) for (let col = 0; col < 4; col++) {
      const palette = [0x256f9f, 0x4d3d9c, 0x9e3f83, 0x1b8f87]
      k.box(-.3 + col * .2, .48 + row * .24, .079, .18, .215, .018,
        palette[(row + col * 2) % palette.length]!)
    }
    for (const x of [-.41, .41]) k.box(x, 1.08, .085, .025, 1.48, .025, 0x56656b)
    for (const y of [.34, 1.82]) k.box(0, y, .085, .84, .025, .025, 0x56656b)
    k.box(.32, .23, -.19, .2, .16, .22, 0x283238)
    k.box(.32, .23, -.305, .14, .08, .014, 0x62a4a1)
  } else if (kind === 'laserShow') {
    // Weatherproof scanner in a touring flight case with yoke, aperture and fan.
    k.box(0, .08, 0, .72, .16, .58, 0x22292d)
    for (const x of [-.31, .31]) for (const z of [-.24, .24]) {
      k.cylinder(x, .04, z, .045, .08, ink, .045, 6)
    }
    k.box(0, .27, 0, .64, .3, .5, 0x3a464c)
    for (const x of [-.29, .29]) k.box(x, .27, 0, .035, .28, .48, steel)
    for (let slot = 0; slot < 5; slot++) k.box(-.2 + slot * .1, .28, -.257, .055, .13, .014, 0x171d20)
    for (const x of [-.22, .22]) k.box(x, .55, 0, .055, .48, .31, steel)
    k.box(0, .67, 0, .42, .32, .34, 0x171b1e)
    k.box(0, .68, .177, .2, .18, .018, 0x2ee6a6)
    k.box(0, .68, .189, .095, .085, .01, 0xb7fff0)
    k.box(.15, .42, .258, .13, .06, .014, 0xe6c44d)
    k.box(.15, .42, .27, .055, .025, .01, ink)
  } else if (kind === 'fireworkBattery') {
    // A secured mortar rack rather than three loose tubes.
    k.box(0, .06, 0, .86, .12, .68, 0x20272b)
    for (const x of [-.36, .36]) for (const z of [-.27, .27]) {
      k.box(x, .11, z, .14, .16, .14, 0x3a4245)
    }
    k.box(0, .25, 0, .78, .3, .58, 0x6f3f35)
    for (const z of [-.24, .24]) k.box(0, .28, z, .82, .045, .045, steel)
    for (const x of [-.28, -.14, 0, .14, .28]) {
      const lean = x * .45
      const direction = new Vector3(lean, 1, 0).normalize()
      const turn = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction)
      k.box(x, .48, 0, .105, .48, .105, 0x171b1e, turn)
      k.box(x + lean * .12, .72, 0, .13, .055, .13, 0x424b4f, turn)
    }
    for (let stripe = 0; stripe < 6; stripe++) {
      k.box(-.31 + stripe * .125, .27, .298, .065, .12, .014,
        stripe % 2 ? 0x1e2427 : 0xe0b33e)
    }
    k.box(.28, .26, -.31, .18, .14, .055, 0x29343a)
    k.box(.28, .28, -.341, .1, .045, .014, 0xd9534f)
  } else if (kind === 'securityGate') {
    for (const x of [-.38, .38]) {
      k.box(x, .53, 0, .12, 1.06, .21, 0x497e8b)
      k.box(x, .035, 0, .2, .07, .31, ink)
      k.box(x, .71, .112, .06, .13, .015, 0x9dcc9a)
    }
    k.box(0, 1.065, 0, .92, .17, .24, 0xf3cc68)
    k.box(0, 1.065, .126, .46, .08, .014, 0x344e72)
    for (let i = 0; i < 7; i++) {
      const color = [0xe85c70, 0xf3cc68, 0x65b9a5][i % 3]!
      k.box(-.36 + i * .12, 1.22 - (i % 2) * .035, .02, .075, .1, .025, color)
    }
    for (const x of [-.24, 0, .24]) {
      k.box(x, 1.39, 0, .035, .5, .035, cream)
      k.box(x, 1.56, 0, .16, .12, .045, x === 0 ? 0xf3cc68 : 0xe85c70)
    }
    k.box(0, .51, 0, .62, .035, .045, steel)
  } else if (kind === 'ride') {
    k.cylinder(0, .08, 0, .48, .16, 0xa44463, .48, 12)
    k.cylinder(0, .18, 0, .44, .04, cream, .44, 12)
    k.cylinder(0, .7, 0, .045, 1.06, 0xe1b75e)
    k.cylinder(0, 1.2, 0, .49, .29, 0xd96c82, .035, 12)
    k.cylinder(0, 1.04, 0, .48, .09, cream, .48, 12)
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, x = Math.cos(a) * .31, z = Math.sin(a) * .31
      k.cylinder(x, .62, z, .014, .84, 0xd9b958)
      k.box(x, .47, z, .13, .09, .07, i % 2 ? 0x62a899 : 0xf1cf87)
      k.box(x + .05, .54, z, .04, .12, .06, cream)
      k.box(x, .405, z, .08, .04, .11, ink)
    }
    k.cylinder(0, 1.41, 0, .038, .15, 0xe1b75e, .004)
  }
  return k.finish()
}

/** `variant` picks a different build of the same kind — the sound and lighting halves of a shared front-of-house stand — and is cached separately. */
export function createRetroBuilding(kind: BuildingKind, variant?: string): Group | null {
  if (!DETAILED_BUILDINGS.includes(kind)) return null
  const key = variant ? `${kind}:${variant}` as BuildingKind : kind
  let geometry = geometries.get(key)
  if (!geometry) { geometry = build(kind, variant); geometries.set(key, geometry) }
  const group = new Group(), mesh = new Mesh(geometry, material)
  mesh.castShadow = mesh.receiveShadow = true
  mesh.userData.retroStatic = true
  mesh.userData.facade = isFacade(kind)
  group.add(mesh)
  return group
}

/** Shared geometry lets hundreds of identical assets draw once per kind. */
export function batchRetroBuildings(source: Group): Group {
  source.updateWorldMatrix(true, true)
  const inverse = source.matrixWorld.clone().invert()
  const buckets = new Map<BufferGeometry, Mesh[]>()
  source.traverse(object => {
    if (!(object instanceof Mesh) || !object.userData.retroStatic) return
    const bucket = buckets.get(object.geometry) ?? []
    bucket.push(object); buckets.set(object.geometry, bucket)
    object.visible = false
  })
  const group = new Group(), matrix = new Matrix4()
  for (const [geometry, meshes] of buckets) {
    const batch = new InstancedMesh(geometry, material, meshes.length)
    batch.userData.facade = meshes[0]!.userData.facade === true
    batch.userData.buildingIds = meshes.map(mesh => mesh.parent?.userData.buildingId)
    meshes.forEach((mesh, i) => batch.setMatrixAt(i, matrix.multiplyMatrices(inverse, mesh.matrixWorld)))
    batch.castShadow = batch.receiveShadow = true
    batch.computeBoundingSphere()
    group.add(batch)
  }
  return group
}
