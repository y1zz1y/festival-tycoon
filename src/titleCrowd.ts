import {
  AmbientLight,
  DirectionalLight,
  Group,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from 'three'
import { createPersonRig, type PersonRig } from './view/pixelPeople'
import { SHIRT_COLORS } from './game/shopGoods'
import { disposeObject3D } from './view/disposeObject3D'

/**
 * The little crowd that walks along the top of the title. They are the same figures
 * the map is full of — same geometry, same joints, same gait — just on a strip of
 * their own: a handful of them pacing the length of the heading, stopping now and
 * then to dance, cheer or simply look around, the way people do while they wait for
 * the gates to open.
 */
type Activity = 'walk' | 'dance' | 'cheer' | 'idle'

type Walker = {
  rig: PersonRig
  x: number
  direction: 1 | -1
  speed: number
  seed: number
  activity: Activity
  until: number
}

/**
 * The strip is sized from the figures, not from the pixels: this many world units of
 * headroom above the ground line, so a whole person always fits however wide or flat
 * the heading gets. How far they can walk follows from that and the canvas's aspect.
 *
 * The ground line itself is the bottom edge of the canvas, which sits exactly on the
 * plaque's top border — that is what puts their feet on the edge rather than above it.
 */
const HEADROOM = 1.04
const WALKERS = 6

export type TitleCrowd = { setRunning(running: boolean): void; dispose(): void }

export function mountTitleCrowd(canvas: HTMLCanvasElement): TitleCrowd {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.setClearAlpha(0)
  const scene = new Scene()
  // Lit like the plaque it stands on: one soft fill, one lamp from the front left.
  scene.add(new AmbientLight(0xffffff, 1.5))
  const sun = new DirectionalLight(0xfff1d6, 1.9)
  sun.position.set(-3, 6, 5)
  scene.add(sun)
  const camera = new OrthographicCamera(-4, 4, HEADROOM / 2, -HEADROOM / 2, .1, 40)
  camera.position.set(0, HEADROOM / 2, 10)
  camera.lookAt(0, HEADROOM / 2, 0)
  /** Half the walkable width in world units; set from the canvas's aspect on every resize. */
  let reach = 4

  const stage = new Group()
  scene.add(stage)
  const walkers: Walker[] = Array.from({ length: WALKERS }, (_, index) => {
    const rig = createPersonRig(`title-${index}`, SHIRT_COLORS[(index * 3 + 1) % SHIRT_COLORS.length]!.color)
    stage.add(rig.group)
    const direction: 1 | -1 = index % 2 ? 1 : -1
    return {
      rig,
      x: -4 + ((index + .5) / WALKERS) * 8,
      direction,
      speed: .55 + (index % 3) * .18,
      seed: index * 1.7,
      activity: 'walk',
      until: 2 + index * .8,
    }
  })

  let clock = 0
  let frame = 0
  let running = false
  let width = 0
  let height = 0

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect()
    const nextWidth = Math.max(1, Math.round(rect.width))
    const nextHeight = Math.max(1, Math.round(rect.height))
    if (nextWidth === width && nextHeight === height) return
    width = nextWidth
    height = nextHeight
    renderer.setSize(width, height, false)
    // A person stays a person: the height in world units is fixed and the width
    // follows the aspect, so nothing stretches when the heading changes size.
    const halfWidth = (HEADROOM / 2) * (width / height)
    camera.left = -halfWidth
    camera.right = halfWidth
    camera.updateProjectionMatrix()
    reach = Math.max(1, halfWidth - .35)
  }

  /** What someone does next while waiting: mostly walk on, now and then something else. */
  const pickActivity = (walker: Walker): void => {
    const roll = Math.random()
    if (walker.activity !== 'walk') {
      walker.activity = 'walk'
      walker.until = clock + 3 + Math.random() * 5
      return
    }
    walker.activity = roll < .38 ? 'dance' : roll < .62 ? 'cheer' : roll < .78 ? 'idle' : 'walk'
    walker.until = clock + (walker.activity === 'walk' ? 3 + Math.random() * 4 : 2 + Math.random() * 3)
    if (walker.activity === 'walk' && Math.random() < .5) walker.direction = walker.direction === 1 ? -1 : 1
  }

  const step = (dt: number): void => {
    clock += dt
    for (const walker of walkers) {
      if (clock >= walker.until) pickActivity(walker)
      const moving = walker.activity === 'walk'
      if (moving) {
        walker.x += walker.direction * walker.speed * dt
        if (walker.x > reach) { walker.x = reach; walker.direction = -1 }
        if (walker.x < -reach) { walker.x = -reach; walker.direction = 1 }
      }
      // The same phase-driven gait the crowd on the map uses: legs and arms swing
      // against each other, dancing swings faster and throws the arms up.
      const dancing = walker.activity === 'dance'
      const phase = clock * (dancing ? 7.4 : 4.6) * (moving ? walker.speed / .7 : 1) + walker.seed
      const stride = dancing ? Math.sin(phase) : moving ? Math.sin(phase) : 0
      const swing = stride * (dancing ? 1.15 : .65)
      const { rig } = walker
      rig.leftLeg.rotation.x = swing * .65
      rig.rightLeg.rotation.x = -swing * .65
      if (dancing) {
        rig.leftArm.rotation.x = -1.7 - stride * .45
        rig.rightArm.rotation.x = -1.7 + stride * .45
      } else if (walker.activity === 'cheer') {
        // One arm up, waving from the elbow-less shoulder the figures have.
        rig.leftArm.rotation.x = -2.2 + Math.sin(clock * 9 + walker.seed) * .35
        rig.rightArm.rotation.x = .2
      } else {
        rig.leftArm.rotation.x = -swing * .65
        rig.rightArm.rotation.x = swing * .65
      }
      const jump = dancing ? Math.max(0, Math.sin(phase * .64)) * .09 : 0
      const bob = moving ? Math.abs(stride) * .02 : 0
      // The figures are modelled standing on their own y = 0, and that line is the
      // bottom of the strip — the -.38 the factory applies for the bungee rope would
      // lift them off the edge, so it is overwritten here.
      rig.group.position.set(walker.x, jump + bob, 0)
      // Walkers face the way they are going; the others turn towards the viewer and
      // look about a little.
      rig.group.rotation.y = moving
        ? walker.direction === 1 ? Math.PI / 2 : -Math.PI / 2
        : Math.sin(clock * .8 + walker.seed) * .5
    }
  }

  let last = performance.now()
  const loop = (now: number): void => {
    frame = requestAnimationFrame(loop)
    const dt = Math.min(.1, (now - last) / 1000)
    last = now
    resize()
    step(dt)
    renderer.render(scene, camera)
  }

  return {
    setRunning(next: boolean): void {
      if (next === running) return
      running = next
      if (next) {
        last = performance.now()
        frame = requestAnimationFrame(loop)
      } else {
        cancelAnimationFrame(frame)
      }
    },
    dispose(): void {
      cancelAnimationFrame(frame)
      disposeObject3D(stage)
      renderer.dispose()
    },
  }
}
