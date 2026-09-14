import assert from 'node:assert/strict'
import { Color, Mesh, MeshStandardMaterial } from 'three'
import {
  CARRIER_SHIRT,
  carrierCartGeometry,
  carrierKitMaterial,
  carrierLoadGeometry,
  carrierUniformGeometry,
  createCarrierFigure,
  createPorterModel,
} from '../src/view/carrierModels'
import { createPersonGeometry } from '../src/view/pixelPeople'
import { disposeObject3D } from '../src/view/disposeObject3D'

function geometryHasHex(geometry: ReturnType<typeof carrierUniformGeometry>, hex: number): boolean {
  const tint = new Color(hex)
  const colors = geometry.getAttribute('color')
  for (let i = 0; i < colors.count; i++) {
    if (
      Math.abs(colors.getX(i) - tint.r) < 0.03 &&
      Math.abs(colors.getY(i) - tint.g) < 0.03 &&
      Math.abs(colors.getZ(i) - tint.b) < 0.03
    ) return true
  }
  return false
}

function meshesOf(root: { traverse: (fn: (object: object) => void) => void }): Mesh[] {
  const meshes: Mesh[] = []
  root.traverse((object) => { if (object instanceof Mesh) meshes.push(object) })
  return meshes
}

export function testCarrierModels(): void {
  const uniform = carrierUniformGeometry()
  const cart = carrierCartGeometry()
  const load = carrierLoadGeometry()
  assert.equal(carrierUniformGeometry(), uniform, 'hi-vis kit is cached')
  assert.equal(carrierCartGeometry(), cart, 'cart geometry is cached')
  assert.equal(carrierLoadGeometry(), load, 'crate stack is cached')
  for (const [name, geometry] of [['uniform', uniform], ['cart', cart], ['load', load]] as const) {
    assert.equal(geometry.userData.shared, true, `${name} stays shared`)
    assert.equal(geometry.getAttribute('color').count, geometry.getAttribute('position').count)
    assert.ok(geometry.getAttribute('position').count < 900, `${name}: merged, not a mesh per plank (${geometry.getAttribute('position').count})`)
  }
  assert.ok(geometryHasHex(uniform, 0xf2d23c), 'vest keeps hi-vis yellow')
  assert.ok(geometryHasHex(uniform, 0xe4eaf0), 'vest keeps reflective stripes')
  assert.ok(geometryHasHex(cart, 0x37b7a3), 'cart keeps a teal freight cue')

  const a = createPorterModel('carrier-alpha')
  const b = createPorterModel('carrier-beta')
  const aCart = meshesOf(a).find((mesh) => mesh.geometry === cart)
  const bCart = meshesOf(b).find((mesh) => mesh.geometry === cart)
  assert.ok(aCart && bCart)
  assert.equal(aCart.geometry, bCart.geometry, 'porters share the work cart')
  assert.equal(aCart.material, carrierKitMaterial())
  assert.ok(a.getObjectByName('load'), 'cargo toggle still finds a load group')
  assert.ok(a.getObjectByName('driver'), 'stuck-driver slot stays present')

  const figure = createCarrierFigure('carrier-visual')
  const used = new Set(meshesOf(figure).map((mesh) => mesh.geometry))
  assert.ok(used.has(createPersonGeometry('body')) || used.has(createPersonGeometry('femaleBody')), 'porters reuse visitor torsos')
  assert.ok(used.has(createPersonGeometry('head')), 'porters reuse visitor heads')
  assert.ok(used.has(createPersonGeometry('leg')), 'porters reuse visitor legs')
  assert.ok(used.has(createPersonGeometry('arm')), 'porters reuse visitor arms')
  assert.ok(used.has(uniform), 'hi-vis vest sits on the visitor figure')
  const shirt = meshesOf(figure).find((mesh) => mesh.geometry === createPersonGeometry('body') || mesh.geometry === createPersonGeometry('femaleBody'))!
  assert.equal((shirt.material as MeshStandardMaterial).color.getHex(), CARRIER_SHIRT)

  const extras = [uniform, cart, load].reduce((n, geometry) => n + geometry.getAttribute('position').count, 0)
  assert.ok(extras < 2000, `porter extras stay bounded (${extras})`)

  let disposedShared = 0
  for (const geometry of [uniform, cart, load]) geometry.addEventListener('dispose', () => disposedShared++)
  disposeObject3D(a)
  disposeObject3D(b)
  disposeObject3D(figure)
  assert.equal(disposedShared, 0, 'removing one porter must not free the shared kits')
  console.log('PASS carrier models: visitor parts, hi-vis kit, shared cart, bounded extras')
}
