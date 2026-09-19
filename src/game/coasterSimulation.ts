import { getCoasterType, sampleCoasterTrack, type Coaster, type TrackSample } from './coasters'
import { grantAttractionFun } from './attractionFun'
import { SIMULATION_CONFIG } from './simulationConfig'
import type { PlacedBuilding, Visitor } from './types/entities'
import type { GameSnapshot } from './types/snapshot'

const BOARDING_MINUTES_PER_PERSON =
  SIMULATION_CONFIG.coasters.boardingMinutesPerPerson

export type CoasterSimulationContext = {
  state: GameSnapshot
  getVisitor: (id: string) => Visitor | undefined
  getCoasterQueueCells: (coaster: Coaster) => Array<{ x: number; z: number; elevation: number }>
  getPathAt: (x: number, z: number, elevation?: number) => PlacedBuilding | undefined
  getEntrance: () => { x: number; z: number; elevation: number }
  isOfferCurrentlyActive: (offer: 'rides') => boolean
  chargeVisitor: (
    visitor: Visitor,
    amount: number,
    position: { x: number; y: number; z: number },
  ) => boolean
  queueStandOffset: (
    index: number,
    direction: { x: number; z: number },
    packed: boolean,
  ) => { x: number; z: number }
  samplePedestrianSurfaceY: (
    x: number,
    z: number,
    path: PlacedBuilding | undefined,
    fallback: number,
  ) => number
  prioritizeArrivedQueueVisitors: (queue: string[]) => void
  getAccessPathNeighbors: (
    access: { x: number; y: number; z: number },
  ) => Array<{ x: number; z: number; elevation: number }>
  addRideNausea: (visitor: Visitor) => void
}

export class CoasterSimulation {
  private readonly context: CoasterSimulationContext

  constructor(context: CoasterSimulationContext) {
    this.context = context
  }

  update(minutes: number, physicsSeconds: number): void {
    this.context.state.coasters.forEach((coaster) => {
      this.scrubQueue(coaster)
      const train = coaster.train
      const canRun =
        coaster.closed &&
        (coaster.operationMode === 'test' ||
          (coaster.operationMode === 'open' &&
            Boolean(coaster.entrance) &&
            Boolean(coaster.exit)))
      if (!canRun) {
        if (
          coaster.queue.length > 0 ||
          train.passengerIds.length > 0 ||
          train.state !== 'boarding' ||
          train.distance !== 0
        ) {
          this.recall(coaster)
        }
        this.positionTrain(coaster)
        return
      }
      if (coaster.operationMode === 'test') {
        if (train.state === 'boarding') {
          coaster.telemetry.measuring = false
          train.state = 'running'
          train.photoPieces = []
          train.distance = 0
          train.progress = 0
          train.speed = getCoasterType(coaster.typeId).physics.stationLaunchSpeed
        } else if (train.state === 'unloading') {
          train.state = 'boarding'
        } else {
          this.integratePhysics(coaster, physicsSeconds)
        }
        this.positionTrain(coaster)
        return
      }
      if (!this.context.isOfferCurrentlyActive('rides') && train.state === 'boarding') {
        if (train.passengerIds.length === 0) {
          this.positionTrain(coaster)
          return
        }
        coaster.telemetry.measuring = false
        train.state = 'running'
        train.photoPieces = []
        train.progress = 0
        train.distance = 0
        train.speed = getCoasterType(coaster.typeId).physics.stationLaunchSpeed
      }
      this.positionQueue(coaster, minutes)
      if (train.state === 'boarding') {
        const frontVisitor = this.context.getVisitor(coaster.queue[0] ?? '')
        const frontQueueCell = this.context.getCoasterQueueCells(coaster)[0]
        const frontIsReady =
          frontVisitor?.state === 'queuing' &&
          frontQueueCell?.x === frontVisitor.cellX &&
          frontQueueCell?.z === frontVisitor.cellZ &&
          frontQueueCell?.elevation === frontVisitor.cellElevation
        train.boardingProgress = frontIsReady ? train.boardingProgress + minutes : 0
        while (
          train.boardingProgress >= BOARDING_MINUTES_PER_PERSON &&
          train.passengerIds.length < train.capacity
        ) {
          const visitorId = coaster.queue[0]
          const visitor = visitorId ? this.context.getVisitor(visitorId) : undefined
          if (
            !visitorId ||
            visitor?.state !== 'queuing' ||
            visitor.cellX !== frontQueueCell?.x ||
            visitor.cellZ !== frontQueueCell?.z ||
            visitor.cellElevation !== frontQueueCell?.elevation
          ) {
            break
          }
          coaster.queue.shift()
          train.boardingProgress -= BOARDING_MINUTES_PER_PERSON
          const paymentPosition = coaster.entrance ?? {
            x: coaster.pieces[0]?.start.x ?? 0,
            y: coaster.pieces[0]?.start.elevation ?? 0,
            z: coaster.pieces[0]?.start.z ?? 0,
          }
          const paid = this.context.chargeVisitor(visitor, coaster.ticketPrice, {
            x: paymentPosition.x + 0.5,
            y: paymentPosition.y + 0.85,
            z: paymentPosition.z + 0.5,
          })
          if (!paid) {
            visitor.state = 'exploring'
            visitor.targetId = null
            visitor.avoidedCoasterId = coaster.id
            visitor.avoidanceMinutes = SIMULATION_CONFIG.coasters.paymentAvoidanceMinutes
            visitor.emotion = 'sad'
            visitor.emotionMinutes = 45
            visitor.thought = 'Dafür reicht mein Budget nicht.'
            continue
          }
          train.passengerIds.push(visitor.id)
          train.passengers = train.passengerIds.length
          visitor.state = 'riding'
          visitor.thought = `Ich fahre mit ${coaster.name}!`
        }
        train.waitMinutes = train.passengers > 0 ? train.waitMinutes + minutes : 0
        const full = train.passengers >= train.capacity
        const timed = train.waitMinutes >= coaster.settings.dispatchIntervalMinutes
        const shouldDispatch =
          coaster.settings.dispatchMode === 'full-only'
            ? full
            : coaster.settings.dispatchMode === 'timed'
              ? timed
              : full || timed
        if (shouldDispatch && train.passengers > 0) {
          coaster.telemetry.measuring = false
          train.state = 'running'
          train.photoPieces = []
          train.progress = 0
          train.distance = 0
          train.speed = getCoasterType(coaster.typeId).physics.stationLaunchSpeed
        }
      } else if (train.state === 'unloading') {
        train.boardingProgress += minutes
        while (
          train.boardingProgress >= BOARDING_MINUTES_PER_PERSON &&
          train.passengerIds.length > 0
        ) {
          train.boardingProgress -= BOARDING_MINUTES_PER_PERSON
          const visitorId = train.passengerIds.shift()
          if (!visitorId) continue
          const visitor = this.context.getVisitor(visitorId)
          if (visitor) this.releasePassenger(coaster, visitor, true)
          train.passengers = train.passengerIds.length
        }
        if (train.passengerIds.length === 0) {
          train.state = 'boarding'
          train.waitMinutes = 0
          train.boardingProgress = 0
        }
      } else {
        this.integratePhysics(coaster, physicsSeconds)
      }
      this.positionTrain(coaster)
    })
  }

  recall(coaster: Coaster): void {
    coaster.telemetry.measuring = false
    coaster.queue.forEach((visitorId) => {
      const visitor = this.context.getVisitor(visitorId)
      if (!visitor) return
      visitor.state = 'exploring'
      visitor.targetId = null
      visitor.avoidedCoasterId = coaster.id
      visitor.avoidanceMinutes = SIMULATION_CONFIG.coasters.recallAvoidanceMinutes
      visitor.thought = 'Die Achterbahn ist derzeit nicht verfügbar.'
    })
    coaster.queue = []
    coaster.train.passengerIds.forEach((visitorId) => {
      const visitor = this.context.getVisitor(visitorId)
      if (!visitor) return
      if (coaster.exit) this.releasePassenger(coaster, visitor, false)
      else {
        visitor.state = 'exploring'
        visitor.targetId = null
        visitor.thought = 'Die Fahrt wurde sicher beendet.'
      }
    })
    coaster.train.passengerIds = []
    coaster.train.passengers = 0
    coaster.train.state = 'boarding'
    coaster.train.waitMinutes = 0
    coaster.train.boardingProgress = 0
    coaster.train.progress = 0
    coaster.train.distance = 0
    coaster.train.speed = 0
    this.positionTrain(coaster)
  }

  private positionQueue(coaster: Coaster, minutes: number): void {
    if (!coaster.entrance || coaster.queue.length === 0) return
    const directions = [
      { x: 0, z: 1 },
      { x: 1, z: 0 },
      { x: 0, z: -1 },
      { x: -1, z: 0 },
    ]
    const queueCells = this.context.getCoasterQueueCells(coaster)
    coaster.queue.forEach((visitorId, index) => {
      const visitor = this.context.getVisitor(visitorId)
      if (!visitor || visitor.state !== 'queuing') return
      const desiredCellIndex = Math.min(
        queueCells.length - 1,
        Math.floor(index / SIMULATION_CONFIG.coasters.queueSlotsPerCell),
      )
      const currentCellIndex = queueCells.findIndex(
        (cell) =>
          cell.x === visitor.cellX &&
          cell.z === visitor.cellZ &&
          cell.elevation === visitor.cellElevation,
      )
      const targetCellIndex =
        currentCellIndex > desiredCellIndex ? currentCellIndex - 1 : desiredCellIndex
      const cell = queueCells[targetCellIndex]
      if (!cell) return
      const path = this.context.getPathAt(cell.x, cell.z, cell.elevation)
      const direction = directions[path?.queueDirection ?? 0] ?? directions[0]!
      const stand = this.context.queueStandOffset(
        index,
        direction,
        targetCellIndex === desiredCellIndex,
      )
      const targetX = cell.x + 0.5 + stand.x
      const targetZ = cell.z + 0.5 + stand.z
      const deltaX = targetX - visitor.x
      const deltaZ = targetZ - visitor.z
      const distance = Math.hypot(deltaX, deltaZ)
      const movement = minutes * SIMULATION_CONFIG.coasters.queueMovementPerMinute
      visitor.facing = Math.atan2(deltaX || direction.x, deltaZ || direction.z)
      if (distance <= movement || distance < 0.001) {
        visitor.x = targetX
        visitor.z = targetZ
        visitor.y = this.context.samplePedestrianSurfaceY(
          visitor.x,
          visitor.z,
          path,
          cell.elevation,
        )
        visitor.cellX = cell.x
        visitor.cellZ = cell.z
        visitor.cellElevation = cell.elevation
      } else {
        visitor.x += (deltaX / distance) * movement
        visitor.z += (deltaZ / distance) * movement
        visitor.y = this.context.samplePedestrianSurfaceY(
          visitor.x,
          visitor.z,
          path,
          cell.elevation,
        )
      }
    })
  }

  integratePhysics(coaster: Coaster, elapsedSeconds: number): void {
    const train = coaster.train
    const physics = getCoasterType(coaster.typeId).physics
    const tuning = SIMULATION_CONFIG.coasters.physicsSimulation
    const steps = Math.max(1, Math.ceil(elapsedSeconds / tuning.integrationStepSeconds))
    const deltaSeconds = elapsedSeconds / steps
    for (let step = 0; step < steps && train.state === 'running'; step += 1) {
      const sample = sampleCoasterTrack(coaster, train.distance)
      if (!sample) return
      const carSamples = Array.from({ length: train.cars }, (_, index) =>
        sampleCoasterTrack(coaster, train.distance + index * physics.carSpacing),
      ).filter((carSample) => carSample !== null)
      const averageSlope =
        carSamples.reduce((total, carSample) => total + carSample.tangent.y, 0) /
        Math.max(1, carSamples.length)
      const chainEngaged = carSamples.some(
        (carSample) => carSample.chainLift && carSample.tangent.y > 0,
      )
      const stationDriveEngaged = carSamples.some((carSample) => carSample.stationDrive)
      const mass =
        train.cars * physics.carMassKg + train.passengers * physics.passengerMassKg
      const slopeCosine = Math.sqrt(Math.max(0, 1 - averageSlope ** 2))
      const gravityAcceleration = -tuning.gravity * averageSlope
      const direction = Math.abs(train.speed) < 0.01 ? 1 : Math.sign(train.speed)
      const rollingAcceleration =
        -direction * physics.rollingResistance * tuning.gravity * slopeCosine
      const aerodynamicAcceleration =
        (-direction * 0.5 * tuning.airDensity * physics.dragArea * train.speed ** 2) /
        mass
      let acceleration =
        gravityAcceleration + rollingAcceleration + aerodynamicAcceleration
      if (sample.pieceKind === 'brakes' && Math.abs(train.speed) > 4) {
        acceleration -= Math.sign(train.speed) * 4
      }
      if (sample.pieceKind === 'splash' && Math.abs(train.speed) > 3) {
        acceleration -=
          Math.sign(train.speed) * Math.min(5, train.speed * train.speed * 0.025)
      }
      if (
        sample.pieceKind === 'photo' &&
        !train.photoPieces?.includes(sample.pieceId)
      ) {
        ;(train.photoPieces ??= []).push(sample.pieceId)
        for (const id of train.passengerIds) {
          const visitor = this.context.getVisitor(id)
          if (visitor && this.context.chargeVisitor(visitor, 2, sample.point)) {
            visitor.thought = 'Ein Erinnerungsfoto von der Achterbahn!'
          }
        }
      }
      const remainingMeters =
        (sample.totalLength - train.distance) * physics.worldUnitMeters
      if (chainEngaged) {
        if (train.speed < 0) train.speed = 0
        if (train.speed <= physics.chainSpeed) {
          acceleration = Math.max(
            0,
            (physics.chainSpeed - train.speed) * tuning.chainAccelerationFactor,
          )
        }
      }
      if (stationDriveEngaged) {
        if (train.speed < 0) train.speed = 0
        const approachDistance =
          train.cars * physics.carSpacing * physics.worldUnitMeters +
          tuning.stationApproachBufferMeters
        const brakingDistance =
          train.speed * train.speed / (2 * tuning.stationBrakingDeceleration) +
          tuning.stationBrakingBufferMeters
        const targetSpeed =
          remainingMeters <= Math.max(approachDistance, brakingDistance)
            ? Math.min(
                physics.stationDriveSpeed,
                Math.sqrt(
                  Math.max(0, 2 * tuning.stationBrakingDeceleration * remainingMeters),
                ),
              )
            : physics.stationLaunchSpeed
        acceleration = Math.max(
          -tuning.stationDriveAccelerationLimit,
          Math.min(
            tuning.stationDriveAccelerationLimit,
            (targetSpeed - train.speed) * tuning.stationDriveResponse,
          ),
        )
      } else if (
        remainingMeters < tuning.endBrakeDistanceMeters &&
        train.speed > 0
      ) {
        const safeSpeed = Math.sqrt(
          Math.max(0, 2 * tuning.endBrakeDeceleration * remainingMeters),
        )
        if (train.speed > safeSpeed) acceleration -= tuning.endBrakeDeceleration
      }
      if (!coaster.telemetry.measuring && !stationDriveEngaged) {
        coaster.telemetry.measuring = true
      }
      if (coaster.telemetry.measuring) {
        this.recordTelemetry(coaster, sample, acceleration, deltaSeconds)
      }
      train.speed = Math.max(
        tuning.minimumSpeed,
        Math.min(tuning.maximumSpeed, train.speed + acceleration * deltaSeconds),
      )
      train.distance += (train.speed / physics.worldUnitMeters) * deltaSeconds
      if (
        train.distance >= sample.totalLength &&
        stationDriveEngaged &&
        Math.abs(train.speed) >= tuning.stationStopSpeed
      ) {
        train.distance = sample.totalLength - tuning.stationOvershootDistance
        train.speed *= tuning.stationOvershootDamping
      } else if (
        train.distance >= sample.totalLength ||
        (stationDriveEngaged &&
          remainingMeters < tuning.stationStopDistanceMeters &&
          Math.abs(train.speed) < tuning.stationStopSpeed)
      ) {
        this.finishRide(coaster, true)
      } else if (train.distance < 0) {
        this.finishRide(coaster, false)
      } else {
        train.progress = train.distance / sample.totalLength
      }
    }
  }

  private scrubQueue(coaster: Coaster): void {
    const seen = new Set<string>()
    coaster.queue = coaster.queue.filter((visitorId) => {
      if (seen.has(visitorId)) return false
      const visitor = this.context.getVisitor(visitorId)
      const valid =
        visitor?.targetId === coaster.id &&
        (visitor.state === 'seeking' ||
          visitor.state === 'queuing' ||
          visitor.state === 'security-check')
      if (!valid) return false
      seen.add(visitorId)
      return true
    })
    this.context.prioritizeArrivedQueueVisitors(coaster.queue)
  }

  private recordTelemetry(
    coaster: Coaster,
    sample: TrackSample,
    longitudinalAcceleration: number,
    elapsedSeconds: number,
  ): void {
    const telemetry = coaster.telemetry
    const physics = getCoasterType(coaster.typeId).physics
    const train = coaster.train
    const smoothingDistance = 0.35
    const before = sampleCoasterTrack(coaster, train.distance - smoothingDistance)
    const after = sampleCoasterTrack(coaster, train.distance + smoothingDistance)
    if (!before || !after) return
    const forward = sample.tangent
    const right = sample.right
    const up = sample.up
    const curvatureScale =
      train.speed * train.speed /
      (2 * smoothingDistance * physics.worldUnitMeters)
    const acceleration = {
      x:
        forward.x * longitudinalAcceleration +
        (after.tangent.x - before.tangent.x) * curvatureScale,
      y:
        forward.y * longitudinalAcceleration +
        (after.tangent.y - before.tangent.y) * curvatureScale,
      z:
        forward.z * longitudinalAcceleration +
        (after.tangent.z - before.tangent.z) * curvatureScale,
    }
    const properAcceleration = {
      x: acceleration.x,
      y: acceleration.y + 9.81,
      z: acceleration.z,
    }
    const dot = (
      left: { x: number; y: number; z: number },
      vector: { x: number; y: number; z: number },
    ) => left.x * vector.x + left.y * vector.y + left.z * vector.z
    const clamp = (value: number) => Math.max(-8, Math.min(8, value))
    const verticalG = clamp(dot(properAcceleration, up) / 9.81)
    const lateralG = clamp(dot(properAcceleration, right) / 9.81)
    const longitudinalG = clamp(dot(properAcceleration, forward) / 9.81)
    const speedKmh = Math.abs(train.speed) * 3.6
    telemetry.durationSeconds += elapsedSeconds
    telemetry.cumulativeDistanceMeters += Math.abs(train.speed) * elapsedSeconds
    if (verticalG < 0.2) telemetry.airtimeSeconds += elapsedSeconds
    telemetry.maxSpeedKmh = Math.max(telemetry.maxSpeedKmh, speedKmh)
    telemetry.minVerticalG = Math.min(telemetry.minVerticalG, verticalG)
    telemetry.maxVerticalG = Math.max(telemetry.maxVerticalG, verticalG)
    telemetry.maxAbsLateralG = Math.max(telemetry.maxAbsLateralG, Math.abs(lateralG))
    telemetry.maxAbsLongitudinalG = Math.max(
      telemetry.maxAbsLongitudinalG,
      Math.abs(longitudinalG),
    )
    const distance = train.distance * physics.worldUnitMeters
    const existingSampleIndex = telemetry.samples.findIndex(
      (existing) => Math.abs(existing.distance - distance) < 0.3,
    )
    if (existingSampleIndex >= 0) {
      const existing = telemetry.samples[existingSampleIndex]
      if (existing) {
        telemetry.samples[existingSampleIndex] = {
          distance,
          speedKmh: existing.speedKmh * 0.7 + speedKmh * 0.3,
          verticalG: existing.verticalG * 0.7 + verticalG * 0.3,
          lateralG: existing.lateralG * 0.7 + lateralG * 0.3,
          longitudinalG: existing.longitudinalG * 0.7 + longitudinalG * 0.3,
        }
      }
    } else {
      telemetry.samples.push({
        distance,
        speedKmh,
        verticalG,
        lateralG,
        longitudinalG,
      })
      telemetry.samples.sort((left, right) => left.distance - right.distance)
      if (telemetry.samples.length > 600) {
        telemetry.samples = telemetry.samples.filter((_, index) => index % 2 === 0)
      }
    }
  }

  private finishRide(coaster: Coaster, completed: boolean): void {
    const train = coaster.train
    if (completed) coaster.telemetry.completedRuns += 1
    coaster.telemetry.measuring = false
    train.state = 'unloading'
    train.waitMinutes = 0
    train.boardingProgress = 0
    train.progress = 0
    train.distance = 0
    train.speed = 0
  }

  private releasePassenger(
    coaster: Coaster,
    visitor: Visitor,
    completedRide: boolean,
  ): void {
    const exit = coaster.exit
    if (!exit) return
    const nextPath =
      this.context.getAccessPathNeighbors(exit).find(
        (cell) =>
          this.context.getPathAt(cell.x, cell.z, cell.elevation)?.pathType !== 'queue',
      ) ?? this.context.getEntrance()
    visitor.x = exit.x + 0.5
    visitor.y = exit.y
    visitor.z = exit.z + 0.5
    visitor.cellX = Math.round(exit.x)
    visitor.cellZ = Math.round(exit.z)
    visitor.cellElevation = exit.y
    visitor.route = [nextPath]
    visitor.targetId = null
    visitor.state = 'exiting'
    if (completedRide) {
      grantAttractionFun(visitor, SIMULATION_CONFIG.coasters.funGain)
    }
    visitor.needs.energy = Math.max(
      0,
      visitor.needs.energy - SIMULATION_CONFIG.coasters.rideEnergyCost,
    )
    this.context.addRideNausea(visitor)
    visitor.emotion = 'excited'
    visitor.emotionMinutes = 90
    visitor.thought = `${coaster.name} war großartig!`
  }

  private positionTrain(coaster: Coaster): void {
    const sample = sampleCoasterTrack(coaster, coaster.train.distance)
    if (!sample) return
    coaster.train.x = sample.point.x
    coaster.train.y = sample.point.y
    coaster.train.z = sample.point.z
    coaster.train.progress =
      sample.totalLength === 0 ? 0 : coaster.train.distance / sample.totalLength
  }
}
