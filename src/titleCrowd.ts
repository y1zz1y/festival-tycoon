import {
  AmbientLight,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
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
type Activity =
  | 'walk' | 'dance' | 'cheer' | 'idle'
  | 'wave' | 'jump' | 'clap' | 'stretch' | 'headbang'

/** Everything a figure knows how to do; one is drawn at random whenever they finish. */
const ACTIVITIES: readonly Activity[] = [
  'walk', 'dance', 'cheer', 'idle', 'wave', 'jump', 'clap', 'stretch', 'headbang',
]

type Walker = {
  rig: PersonRig
  /** The rig's own materials, so one figure can fade without touching the others. */
  skins: MeshStandardMaterial[]
  x: number
  direction: 1 | -1
  speed: number
  seed: number
  activity: Activity
  until: number
  /** 0 is gone, 1 is fully there; carries the fade in and out. */
  presence: number
  leaving: boolean
  /** When this one starts to fade out, at no particular rhythm. */
  leaveAt: number
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
  /** Every material the rig owns, which is what a single figure fades on. */
  const skinsOf = (rig: PersonRig): MeshStandardMaterial[] => {
    const found = new Set<MeshStandardMaterial>()
    rig.group.traverse((object) => {
      if (object instanceof Mesh) found.add(object.material as MeshStandardMaterial)
    })
    for (const material of found) material.transparent = true
    return [...found]
  }
  const walkers: Walker[] = Array.from({ length: WALKERS }, (_, index) => {
    const rig = createPersonRig(`title-${index}`, SHIRT_COLORS[(index * 3 + 1) % SHIRT_COLORS.length]!.color)
    stage.add(rig.group)
    const direction: 1 | -1 = index % 2 ? 1 : -1
    return {
      rig,
      skins: skinsOf(rig),
      x: -4 + ((index + .5) / WALKERS) * 8,
      direction,
      speed: .55 + (index % 3) * .18,
      seed: index * 1.7,
      activity: 'walk' as Activity,
      until: 2 + index * .8,
      presence: 1,
      leaving: false,
      // Staggered from the start, and never on a round number, so they never turn
      // over together.
      leaveAt: 9 + index * 5.5 + Math.random() * 9,
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

  /**
   * What someone does next while waiting. Coming off anything else they walk on for a
   * bit, and from walking they pick freely from everything the figures can do, so the
   * strip is never just a row of dancers.
   */
  const pickActivity = (walker: Walker): void => {
    if (walker.activity !== 'walk') {
      walker.activity = 'walk'
      walker.until = clock + 3 + Math.random() * 5
      return
    }
    walker.activity = ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)]!
    walker.until = clock + (walker.activity === 'walk' ? 3 + Math.random() * 4 : 2 + Math.random() * 3.5)
    if (walker.activity === 'walk' && Math.random() < .5) walker.direction = walker.direction === 1 ? -1 : 1
  }

  /**
   * Somebody has drifted off and somebody else turns up: the same rig comes back in
   * new clothes, somewhere the crowd is thin, and fades in where it stands.
   */
  const respawn = (walker: Walker): void => {
    // The body wears the rig's own shirt material, so recolouring it dresses this one
    // figure and nobody else.
    const shirt = SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)]!.color
    ;(walker.rig.body.material as MeshStandardMaterial).color.setHex(shirt)
    // Furthest from everyone still on the strip, so they do not pop in on top of one.
    let best = 0
    let bestGap = -1
    for (let attempt = 0; attempt < 6; attempt++) {
      const candidate = (Math.random() * 2 - 1) * reach
      const gap = Math.min(...walkers.filter((other) => other !== walker && other.presence > .1)
        .map((other) => Math.abs(other.x - candidate)), reach)
      if (gap > bestGap) { bestGap = gap; best = candidate }
    }
    walker.x = best
    walker.seed = Math.random() * 10
    walker.speed = .5 + Math.random() * .45
    walker.direction = Math.random() < .5 ? 1 : -1
    walker.activity = 'walk'
    walker.until = clock + 2 + Math.random() * 4
    walker.leaving = false
    walker.leaveAt = clock + 14 + Math.random() * 26
  }

  const step = (dt: number): void => {
    clock += dt
    for (const walker of walkers) {
      // Coming and going: a figure fades out when its time is up and the same rig
      // fades back in somewhere else, so the strip keeps changing faces.
      if (!walker.leaving && clock >= walker.leaveAt) walker.leaving = true
      walker.presence = Math.max(0, Math.min(1, walker.presence + (walker.leaving ? -dt / .9 : dt / .9)))
      if (walker.leaving && walker.presence <= 0) respawn(walker)
      for (const material of walker.skins) material.opacity = walker.presence
      walker.rig.group.visible = walker.presence > .01

      if (clock >= walker.until) pickActivity(walker)
      const activity = walker.activity
      const moving = activity === 'walk'
      if (moving) {
        walker.x += walker.direction * walker.speed * dt
        if (walker.x > reach) { walker.x = reach; walker.direction = -1 }
        if (walker.x < -reach) { walker.x = -reach; walker.direction = 1 }
      }
      // The same phase-driven gait the crowd on the map uses: legs and arms swing
      // against each other, dancing swings faster and throws the arms up.
      const dancing = activity === 'dance'
      const phase = clock * (dancing ? 7.4 : 4.6) * (moving ? walker.speed / .7 : 1) + walker.seed
      const stride = dancing || moving ? Math.sin(phase) : 0
      const swing = stride * (dancing ? 1.15 : .65)
      const beat = clock * 6 + walker.seed
      const { rig } = walker
      rig.leftLeg.rotation.x = swing * .65
      rig.rightLeg.rotation.x = -swing * .65
      rig.head.rotation.set(0, 0, 0)
      let lift = 0
      if (dancing) {
        rig.leftArm.rotation.x = -1.7 - stride * .45
        rig.rightArm.rotation.x = -1.7 + stride * .45
        lift = Math.max(0, Math.sin(phase * .64)) * .09
      } else if (activity === 'cheer') {
        // One arm up, waving from the elbow-less shoulder the figures have.
        rig.leftArm.rotation.x = -2.2 + Math.sin(clock * 9 + walker.seed) * .35
        rig.rightArm.rotation.x = .2
      } else if (activity === 'wave') {
        // Both hands over the head, swaying the way a field of people does.
        const sway = Math.sin(beat * .55)
        rig.leftArm.rotation.x = -2.5
        rig.rightArm.rotation.x = -2.5
        rig.leftArm.rotation.z = .35 + sway * .4
        rig.rightArm.rotation.z = -.35 + sway * .4
      } else if (activity === 'jump') {
        const hop = Math.max(0, Math.sin(beat * .9))
        rig.leftArm.rotation.x = -2.1 - hop * .5
        rig.rightArm.rotation.x = -2.1 - hop * .5
        rig.leftLeg.rotation.x = -hop * .5
        rig.rightLeg.rotation.x = -hop * .5
        lift = hop * .16
      } else if (activity === 'clap') {
        const clap = Math.sin(beat * 1.4)
        rig.leftArm.rotation.x = -1.15
        rig.rightArm.rotation.x = -1.15
        rig.leftArm.rotation.z = .5 + clap * .22
        rig.rightArm.rotation.z = -.5 - clap * .22
      } else if (activity === 'stretch') {
        // A slow reach upwards and a lean back with it, then down again.
        const reachUp = (Math.sin(clock * .9 + walker.seed) + 1) / 2
        rig.leftArm.rotation.x = -.2 - reachUp * 2.6
        rig.rightArm.rotation.x = -.2 - reachUp * 2.6
        rig.head.rotation.x = -reachUp * .35
      } else if (activity === 'headbang') {
        rig.head.rotation.x = Math.max(0, Math.sin(beat * 1.1)) * .75
        rig.leftArm.rotation.x = -.55
        rig.rightArm.rotation.x = -.55
        lift = Math.max(0, Math.sin(beat * 1.1)) * .03
      } else {
        rig.leftArm.rotation.x = -swing * .65
        rig.rightArm.rotation.x = swing * .65
      }
      if (activity !== 'wave' && activity !== 'clap') {
        rig.leftArm.rotation.z = 0
        rig.rightArm.rotation.z = 0
      }
      const bob = moving ? Math.abs(stride) * .02 : 0
      // The figures are modelled standing on their own y = 0, and that line is the
      // bottom of the strip — the -.38 the factory applies for the bungee rope would
      // lift them off the edge, so it is overwritten here. A figure on its way out
      // sinks a little as it goes, which reads better than a body simply thinning.
      rig.group.position.set(walker.x, lift + bob - (1 - walker.presence) * .12, 0)
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
