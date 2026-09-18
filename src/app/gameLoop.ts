import type { AudioListenerPose } from '../game/audio'
import type { GameSnapshot } from '../game/types/snapshot'

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
  now?: () => number
  requestFrame?: (callback: FrameRequestCallback) => number
}

export type GameLoop = {
  stop(): void
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
  let previousTime = now()
  let running = true

  const resetMeasurements = (): void => {
    measurementStart = now()
    measuredFrames = 0
    measuredTicks = 0
    measuredSimulationMs = 0
    measuredViewMs = 0
    measuredRenderMs = 0
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

    const viewStart = now()
    measuredSimulationMs += viewStart - simulationStart
    dependencies.view.update(game.snapshot, game.renderAlpha, game.worldRevision)
    dependencies.view.advanceWalk(deltaSeconds)
    dependencies.audio.updateListener(dependencies.view.audioListenerPose())
    if (!dependencies.isTitleOpen()) dependencies.audio.syncSnapshot(game.snapshot)

    const renderStart = now()
    measuredViewMs += renderStart - viewStart
    dependencies.view.render()
    measuredRenderMs += now() - renderStart
    measuredFrames += 1

    const elapsed = time - measurementStart
    if (elapsed < 1000) return
    dependencies.performanceIndicator.textContent =
      `${dependencies.versionLabel}\n` +
      `FPS ${(measuredFrames * 1000 / elapsed).toFixed(0)} · ` +
      `TPS ${(measuredTicks * 1000 / elapsed).toFixed(1)}\n` +
      `Sim ${(measuredSimulationMs / measuredFrames).toFixed(1)} · ` +
      `Szene ${(measuredViewMs / measuredFrames).toFixed(1)} · ` +
      `Render ${(measuredRenderMs / measuredFrames).toFixed(1)} ms`
    measurementStart = time
    measuredFrames = 0
    measuredTicks = 0
    measuredSimulationMs = 0
    measuredViewMs = 0
    measuredRenderMs = 0
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
