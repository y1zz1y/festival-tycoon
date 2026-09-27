import {
  CanvasTexture,
  InstancedMesh,
  Matrix4,
  NearestFilter,
  PlaneGeometry,
  SRGBColorSpace,
  ShaderMaterial,
  type Vector3,
} from 'three'

/**
 * The little symbols above people and things, drawn as 16×16 pixel art in code:
 * the same on every system, unlike the emoji fonts they replace (Segoe, Apple and
 * Noto drew them differently, and some Linux setups not at all). One texture per
 * symbol, shared by everything that shows it.
 */
export type IconId =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'excited'
  | 'sleeping'
  | 'talking'
  | 'dancing'
  | 'crushed'
  | 'panic'
  | 'zzz'
  | 'notes'

type Pixel = readonly [number, number]
type Layer = { color: string; pixels: readonly Pixel[]; outline?: boolean }

const INK = '#2a1d12'
const FACE = '#f5c542'
const FACE_SHADE = '#d9a42c'
const GRID = 16

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i)
const row = (y: number, from: number, to: number): Pixel[] => range(from, to).map((x) => [x, y] as const)
const column = (x: number, from: number, to: number): Pixel[] => range(from, to).map((y) => [x, y] as const)

/** A round face with an ink rim, shaded on the lower right. */
function face(fill = FACE, shade = FACE_SHADE): Layer[] {
  const rim: Pixel[] = [], body: Pixel[] = [], dark: Pixel[] = []
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5)
    if (d > 7.3) continue
    if (d > 6.2) rim.push([x, y])
    else if (d > 4.6 && x + y > 17) dark.push([x, y])
    else body.push([x, y])
  }
  return [{ color: INK, pixels: rim }, { color: fill, pixels: body }, { color: shade, pixels: dark }]
}

const dotEyes: Pixel[] = [[5, 6], [5, 7], [10, 6], [10, 7]]
const smile: Pixel[] = [[4, 10], [5, 11], ...row(11, 6, 9), [10, 11], [11, 10]]
const frown: Pixel[] = [[4, 12], [5, 11], ...row(11, 6, 9), [10, 11], [11, 12]]

/** Z drawn from its top-left corner, `size` pixels wide and high. */
function letterZ(x: number, y: number, size: number): Pixel[] {
  const pixels: Pixel[] = [...row(y, x, x + size - 1), ...row(y + size - 1, x, x + size - 1)]
  for (let i = 1; i < size - 1; i++) pixels.push([x + size - 1 - i, y + i])
  return pixels
}

const NOTE: Pixel[] = [...column(10, 2, 11), [11, 2], [12, 3], [12, 4], [11, 5], ...row(10, 7, 9), ...row(11, 7, 9), ...row(12, 8, 9)]

const ICONS: Record<IconId, Layer[]> = {
  neutral: [...face(), { color: INK, pixels: [...dotEyes, ...row(11, 5, 10)] }],
  happy: [...face(), { color: INK, pixels: [...dotEyes, ...smile] }],
  sad: [...face(), { color: INK, pixels: [...dotEyes, ...frown] }, { color: '#5aa8e6', pixels: [[11, 8], [11, 9]] }],
  angry: [...face('#f08a4b', '#d06a33'), { color: INK, pixels: [[4, 4], [5, 5], [11, 4], [10, 5], ...dotEyes, ...frown] }],
  excited: [...face(), { color: INK, pixels: [[4, 7], [5, 6], [6, 7], [9, 7], [10, 6], [11, 7], ...row(12, 6, 9), [5, 10], [5, 11], [10, 10], [10, 11]] }, { color: '#ffffff', pixels: row(10, 6, 9) }, { color: '#c8445a', pixels: row(11, 6, 9) }],
  sleeping: [...face(), { color: INK, pixels: [...row(7, 4, 6), ...row(7, 9, 11), [7, 11], [8, 11]] }],
  talking: [
    { color: INK, pixels: [...row(2, 3, 12), ...row(10, 3, 12), ...column(2, 3, 9), ...column(13, 3, 9), [4, 11], [4, 12], [5, 11]] },
    { color: '#ffffff', pixels: range(3, 9).flatMap((y) => row(y, 3, 12)) },
    { color: INK, pixels: [[5, 6], [8, 6], [11, 6]] },
  ],
  dancing: [{ color: '#7b5bd6', pixels: NOTE, outline: true }],
  crushed: [...face(), { color: INK, pixels: [[4, 5], [5, 6], [4, 7], [11, 5], [10, 6], [11, 7], [5, 11], [6, 10], [7, 11], [8, 10], [9, 11], [10, 10]] }],
  panic: [...face('#cfe3f2', '#a9c6dc'), { color: '#ffffff', pixels: [[4, 5], [5, 5], [4, 6], [5, 6], [10, 5], [11, 5], [10, 6], [11, 6]] }, { color: INK, pixels: [[5, 6], [10, 6], ...row(10, 6, 9), ...row(13, 6, 9), [6, 11], [6, 12], [9, 11], [9, 12]] }],
  zzz: [{ color: '#eef7ff', pixels: [...letterZ(1, 10, 4), ...letterZ(5, 5, 5), ...letterZ(10, 0, 6)], outline: true }],
  notes: [{ color: '#f2d27a', pixels: NOTE, outline: true }],
}

const textures = new Map<IconId, CanvasTexture>()

/** The shared texture of one symbol: 32 px square, crisp at any size. */
export function iconTexture(id: IconId): CanvasTexture {
  const cached = textures.get(id)
  if (cached) return cached
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = GRID * scale
  const context = canvas.getContext('2d')
  if (context) {
    for (const layer of ICONS[id]) {
      if (layer.outline) {
        context.fillStyle = INK
        for (const [x, y] of layer.pixels) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            context.fillRect((x + dx) * scale, (y + dy) * scale, scale, scale)
          }
        }
      }
      context.fillStyle = layer.color
      for (const [x, y] of layer.pixels) context.fillRect(x * scale, y * scale, scale, scale)
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.magFilter = texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = SRGBColorSpace
  textures.set(id, texture)
  return texture
}

/** Every IconId, for tests and previews. */
export const ICON_IDS = Object.keys(ICONS) as IconId[]

const billboardGeometry = new PlaneGeometry(1, 1)
billboardGeometry.userData.shared = true

/**
 * One symbol over many places in a single draw call: an InstancedMesh whose quads
 * turn to the camera in the vertex shader, so nothing has to be rotated per frame.
 * Instances only carry a position. It ignores the raycaster; symbols are not picked.
 */
export class IconBillboards {
  private instances: InstancedMesh
  private readonly material: ShaderMaterial
  private readonly icon: IconId

  constructor(id: IconId, width: number, height = width) {
    this.icon = id
    // The texture is drawn on the first symbol shown, not here: views are built in
    // tests without a DOM, and most of them never show one.
    this.material = new ShaderMaterial({
      uniforms: { map: { value: null }, size: { value: [width, height] } },
      vertexShader: `
        uniform vec2 size;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          center.xy += position.xy * size;
          gl_Position = projectionMatrix * center;
        }`,
      // i18n-ignore: GLSL shader source, not text
      fragmentShader: `
        uniform sampler2D map;
        varying vec2 vUv;
        void main() {
          vec4 texel = texture2D(map, vUv);
          if (texel.a < 0.5) discard;
          gl_FragColor = texel;
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })
    this.instances = this.createMesh(16)
  }

  /** The batch to add to the scene. It is replaced when it has to grow. */
  get mesh(): InstancedMesh {
    return this.instances
  }

  private createMesh(capacity: number): InstancedMesh {
    const mesh = new InstancedMesh(billboardGeometry, this.material, capacity)
    mesh.count = 0
    mesh.frustumCulled = false
    mesh.renderOrder = 100
    mesh.raycast = () => undefined
    mesh.userData.iconBillboard = true
    return mesh
  }

  /** Puts the symbol at these world points; grows in powers of two when needed. */
  setPositions(points: readonly Vector3[]): void {
    if (points.length > 0 && !this.material.uniforms.map!.value) this.material.uniforms.map!.value = iconTexture(this.icon)
    if (points.length > this.instances.instanceMatrix.count) {
      const parent = this.instances.parent
      const grown = this.createMesh(2 ** Math.ceil(Math.log2(points.length)))
      parent?.remove(this.instances)
      this.instances.dispose()
      this.instances = grown
      parent?.add(grown)
    }
    const matrix = new Matrix4()
    points.forEach((point, index) => this.instances.setMatrixAt(index, matrix.makeTranslation(point.x, point.y, point.z)))
    this.instances.count = points.length
    this.instances.instanceMatrix.needsUpdate = true
  }
}
