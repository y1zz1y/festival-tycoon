import type { AudioListenerPose } from '../game/audio'
import type { PedestrianGraphEdge } from '../game/pedestrianNavigation'
import type { SimulationPhaseTimings } from '../game/simulationProfiler'
import type { GameSnapshot } from '../game/types/snapshot'
import { formatPerformanceHud } from './performanceHud'

export interface LoopGame {
  readonly snapshot: GameSnapshot
  readonly renderAlpha: number
  readonly worldRevision: number
  readonly executedLogicTicks: number
  tick(deltaSeconds: number): void
}

export interface LoopMultiplayer {
  readonly status: { readonly mode: string }
  tick(deltaSeconds: number): void
}

export interface LoopView {
  update(snapshot: GameSnapshot, renderAlpha: number, worldRevision: number): void
  advanceWalk(deltaSeconds: number): void
  audioListenerPose(): AudioListenerPose
  render(): void
  setPathGraphOverlay?(
    overlay: { edges: readonly PedestrianGraphEdge[]; revision: string } | null,
  ): void
}

export interface LoopAudio {
  updateListener(pose: AudioListenerPose): void
  syncSnapshot(snapshot: GameSnapshot): void
}

export type GameLoopDependencies = {
  getGame: () => LoopGame
  multiplayer: LoopMultiplayer
  view: LoopView
  audio: LoopAudio
  performanceIndicator: HTMLElement
  versionLabel: string
  isTitleOpen: () => boolean
  /** Optional HUD work after the frame is drawn (map-ping overlays, etc.). */
  afterRender?: () => void
  readPhaseTimings?: () => SimulationPhaseTimings | null
  getPathGraph?: () => { edges: readonly PedestrianGraphEdge[]; revision: string } | null
  now?: () => number
  requestFrame?: (callback: FrameRequestCallback) => number
}

export type GameLoop = {
  stop(): void
}

function addPhaseTotals(
  totals: Map<string, number>,
  sample: Readonly<Record<string, number>>,
): void {
  for (const [id, ms] of Object.entries(sample)) {
    totals.set(id, (totals.get(id) ?? 0) + ms)
  }
}

/**
 * Owns render-frame interpolation and the hidden-tab host heartbeat. Simulation
 * remains fixed-step inside GameState; this layer only supplies elapsed real time.
 */
export function startGameLoop(dependencies: GameLoopDependencies): GameLoop {
  const now = dependencies.now ?? (() => performance.now())
  const requestFrame = dependencies.requestFrame ?? requestAnimationFrame
  let measurementStart = now()
  let measuredFrames = 0
  let measuredTicks = 0
  let measuredSimulationMs = 0
  let measuredViewMs = 0
  let measuredRenderMs = 0
  let measuredExclusive = new Map<string, number>()
  let measuredInclusive = new Map<string, number>()
  let previousTime = now()
  let running = true

  const resetMeasurements = (): void => {
    measurementStart = now()
    measuredFrames = 0
    measuredTicks = 0
    measuredSimulationMs = 0
    measuredViewMs = 0
    measuredRenderMs = 0
    measuredExclusive = new Map()
    measuredInclusive = new Map()
    previousTime = measurementStart
  }
  document.addEventListener('visibilitychange', resetMeasurements)

  // Hidden tabs stop animation frames; keep an authoritative host responsive.
  const hiddenTabTimer = window.setInterval(() => {
    if (!document.hidden || dependencies.multiplayer.status.mode !== 'host') return
    dependencies.getGame().tick(0.1)
    dependencies.multiplayer.tick(0.1)
  }, 100)

  const animate = (time: number): void => {
    if (!running) return
    // Schedule first: one transient view error must not permanently stop the loop.
    requestFrame(animate)
    const deltaSeconds = Math.min(Math.max(0, time - previousTime) / 1000, 0.1)
    previousTime = time
    const game = dependencies.getGame()
    const simulationStart = now()
    const ticksBefore = game.executedLogicTicks
    game.tick(deltaSeconds)
    measuredTicks += game.executedLogicTicks - ticksBefore
    dependencies.multiplayer.tick(deltaSeconds)
    const phaseSample = dependencies.readPhaseTimings?.()
    if (phaseSample) {
      addPhaseTotals(measuredExclusive, phaseSample.exclusive)
      addPhaseTotals(measuredInclusive, phaseSample.inclusive)
    }

    const viewStart = now()
    measuredSimulationMs += viewStart - simulationStart
    dependencies.view.update(game.snapshot, game.renderAlpha, game.worldRevision)
    const pathGraph = dependencies.getPathGraph?.() ?? null
    dependencies.view.setPathGraphOverlay?.(pathGraph)
    dependencies.view.advanceWalk(deltaSeconds)
    dependencies.audio.updateListener(dependencies.view.audioListenerPose())
    if (!dependencies.isTitleOpen()) dependencies.audio.syncSnapshot(game.snapshot)

    const renderStart = now()
    measuredViewMs += renderStart - viewStart
    dependencies.view.render()
    measuredRenderMs += now() - renderStart
    dependencies.afterRender?.()
    measuredFrames += 1

    const elapsed = time - measurementStart
    if (elapsed < 1000) return
    const frames = Math.max(1, measuredFrames)
    const phases = measuredExclusive.size + measuredInclusive.size > 0
      ? {
          exclusive: Object.fromEntries(
            [...measuredExclusive].map(([id, ms]) => [id, ms / frames]),
          ),
          inclusive: Object.fromEntries(
            [...measuredInclusive].map(([id, ms]) => [id, ms / frames]),
          ),
        }
      : null
    dependencies.performanceIndicator.textContent = formatPerformanceHud({
      versionLabel: dependencies.versionLabel,
      fps: measuredFrames * 1000 / elapsed,
      tps: measuredTicks * 1000 / elapsed,
      simMs: measuredSimulationMs / frames,
      viewMs: measuredViewMs / frames,
      renderMs: measuredRenderMs / frames,
      phases,
    })
    measurementStart = time
    measuredFrames = 0
    measuredTicks = 0
    measuredSimulationMs = 0
    measuredViewMs = 0
    measuredRenderMs = 0
    measuredExclusive = new Map()
    measuredInclusive = new Map()
  }
  requestFrame(animate)

  return {
    stop(): void {
      running = false
      window.clearInterval(hiddenTabTimer)
      document.removeEventListener('visibilitychange', resetMeasurements)
    },
  }
}
