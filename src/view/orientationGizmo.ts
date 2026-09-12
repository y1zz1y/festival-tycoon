import { Scene, OrthographicCamera, PerspectiveCamera, WebGLRenderer, Group, Mesh, BoxGeometry, ConeGeometry, MeshBasicMaterial, EdgesGeometry, LineSegments, LineBasicMaterial, Vector3, Vector2, Raycaster, Color } from 'three'

/** Rotation 0..3 -> world-space facing, matching the convention used by stageModel/stagePicking (0=+Z, 1=+X, 2=-Z, 3=-X). */
const FACE_DIRECTION = [1, 3, -1, -1, 0, 2] // BoxGeometry material groups: +X,-X,+Y,-Y,+Z,-Z

const NEUTRAL = 0x2a3242, SIDE = 0x3d4759, HOVER = 0x55617a, ACTIVE = 0xe0a83c

export type OrientationGizmo = {
  setDirection(dir: number): void
  setHover(dir: number | null): void
  hitTest(clientX: number, clientY: number, canvasRect: DOMRect): { inside: boolean; dir: number | null }
  update(mainCamera: PerspectiveCamera, target: Vector3): void
  render(renderer: WebGLRenderer): void
}

export function createOrientationGizmo(size = 88, margin = 12): OrientationGizmo {
  const scene = new Scene()
  const camera = new OrthographicCamera(-1.8, 1.8, 1.8, -1.8, 0.1, 20)
  const sideMaterials = [0, 1, 4, 5].map(() => new MeshBasicMaterial({ color: SIDE }))
  const materials = [sideMaterials[0]!, sideMaterials[1]!, new MeshBasicMaterial({ color: NEUTRAL }), new MeshBasicMaterial({ color: NEUTRAL }), sideMaterials[2]!, sideMaterials[3]!]
  const cube = new Mesh(new BoxGeometry(1.5, 1.5, 1.5), materials)
  cube.add(new LineSegments(new EdgesGeometry(cube.geometry), new LineBasicMaterial({ color: 0x0b1018 })))
  const arrow = new Group()
  const shaftMat = new MeshBasicMaterial({ color: 0xf5f0e6 }), headMat = new MeshBasicMaterial({ color: 0xf5f0e6 })
  const shaft = new Mesh(new BoxGeometry(0.12, 0.08, 0.5), shaftMat); shaft.position.z = -0.12
  const head = new Mesh(new ConeGeometry(0.22, 0.4, 12), headMat); head.rotation.x = Math.PI / 2; head.position.z = 0.32
  arrow.add(shaft, head); arrow.position.y = 0.82
  scene.add(cube, arrow)
  const raycaster = new Raycaster()
  let hoverDir: number | null = null, activeDir = 0
  const applyColors = () => {
    FACE_DIRECTION.forEach((dir, i) => {
      if (dir < 0) return
      const mat = materials[i]!
      mat.color.set(dir === activeDir ? ACTIVE : dir === hoverDir ? HOVER : SIDE)
    })
  }
  applyColors()
  return {
    setDirection(dir) { if (dir === activeDir) return; activeDir = dir; arrow.rotation.y = dir * Math.PI / 2; applyColors() },
    setHover(dir) { if (dir === hoverDir) return; hoverDir = dir; applyColors() },
    hitTest(clientX, clientY, canvasRect) {
      const localX = clientX - canvasRect.left, localY = clientY - canvasRect.top
      const left = canvasRect.width - margin - size, top = margin
      if (localX < left || localX > left + size || localY < top || localY > top + size) return { inside: false, dir: null }
      const nx = ((localX - left) / size) * 2 - 1, ny = -(((localY - top) / size) * 2 - 1)
      raycaster.setFromCamera(new Vector2(nx, ny), camera)
      const hit = raycaster.intersectObject(cube, false)[0]
      if (!hit || hit.face == null) return { inside: true, dir: null }
      const dir = FACE_DIRECTION[hit.face.materialIndex] ?? -1
      return { inside: true, dir: dir < 0 ? null : dir }
    },
    update(mainCamera, target) {
      const dir = mainCamera.position.clone().sub(target).normalize()
      camera.position.copy(dir.multiplyScalar(6)); camera.up.copy(mainCamera.up); camera.lookAt(0, 0, 0)
    },
    render(renderer) {
      // setViewport/setScissor take logical (CSS) pixels — three.js applies the pixel ratio itself.
      const logicalSize = renderer.getSize(new Vector2())
      const w = logicalSize.x, h = logicalSize.y
      const x = w - size - margin, y = h - size - margin
      const prevColor = new Color(), prevAlpha = renderer.getClearAlpha(); renderer.getClearColor(prevColor)
      renderer.setScissorTest(true); renderer.setScissor(x, y, size, size); renderer.setViewport(x, y, size, size)
      renderer.setClearColor(0x1a2333, 1); renderer.clear(true, true, false)
      renderer.render(scene, camera)
      renderer.setScissorTest(false); renderer.setClearColor(prevColor, prevAlpha); renderer.setViewport(0, 0, w, h)
    },
  }
}
