import { BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { BuildingKind } from '../game/catalog'
import { SCENERY_KINDS } from '../game/scenery'

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
  finish(): BufferGeometry {
    const result = mergeGeometries(this.parts)!
    for (const part of this.parts) part.dispose()
    result.computeBoundingSphere()
    result.userData.shared = true
    return result
  }
}

const ink = 0x28363b, cream = 0xf2dfb5, timber = 0x936141, steel = 0x92a6a5
const material = new MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: .05 })
material.userData.shared = true
const geometries = new Map<BuildingKind, BufferGeometry>()
export const DETAILED_BUILDINGS: readonly BuildingKind[] = ['food', 'alcohol', 'toilet', 'bench', 'wasteBin', 'generator', 'backupGenerator', 'foh', 'delayTower', 'securityGate', 'ride', ...SCENERY_KINDS]

function build(kind: BuildingKind, variant?: string): BufferGeometry {
  const k = new ModelKit()
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
  } else if (kind === 'food' || kind === 'alcohol') {
    const accent = kind === 'food' ? 0xd95b3e : 0x3c8775
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
    } else {
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
  } else if (kind === 'wasteBin') {
    k.box(0, .22, 0, .3, .4, .3, 0x3d6657)
    for (const x of [-.12, -.04, .04, .12]) k.box(x, .21, .156, .035, .34, .02, 0x2b4b43)
    k.box(0, .43, 0, .35, .045, .34, ink)
    k.box(0, .465, -.02, .19, .025, .13, 0x142828)
    k.box(0, .29, .173, .1, .12, .018, cream)
    k.box(0, .29, .187, .045, .06, .01, 0x3d6657)
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
    batch.userData.buildingIds = meshes.map(mesh => mesh.parent?.userData.buildingId)
    meshes.forEach((mesh, i) => batch.setMatrixAt(i, matrix.multiplyMatrices(inverse, mesh.matrixWorld)))
    batch.castShadow = batch.receiveShadow = true
    batch.computeBoundingSphere()
    group.add(batch)
  }
  return group
}
