/**
 * Shared guest dance pose. Instanced visitors and the title-crowd rigs read the
 * same numbers; nothing here allocates a skeleton, mesh or material.
 *
 * Time is simulation time (`simTick + renderAlpha`), never a wall clock. A seed
 * offsets phase and picks a style so a packed floor does not robot in lockstep.
 */

/** ~108 BPM at 1×. One sim tick is 100 ms. */
export const DANCE_BEATS_PER_MINUTE = 108
export const DANCE_PHASE_PER_TICK = (Math.PI * 2 * DANCE_BEATS_PER_MINUTE) / 60 / 10

const LEG_REST = 0.16
const LEG_WEIGHT = 0.1
const LEG_ABDUCT = 0.07
/** Rest hang is 0; ~-2.16 puts hands above the head (festival crowd). */
const ARM_UP = -2.16
/** Beat bob, ~5°. Old rowing was ±26° around -1.7. */
const ARM_WOBBLE = 0.09
const ARM_DROP = 0.28
const ARM_OUT = 0.26
const HIP_YAW = 0.12
const TORSO_ROLL = 0.06
const SIDESTEP = 0.028
const BOUNCE = 0.022

export type VisitorDancePose = {
  bounce: number
  sidestep: number
  hipYaw: number
  torsoRoll: number
  leftLegX: number
  rightLegX: number
  leftLegZ: number
  rightLegZ: number
  leftArmX: number
  rightArmX: number
  leftArmZ: number
  rightArmZ: number
}

export type VisitorDanceLimbs = {
  leftLeg: { rotation: { x: number; z: number } }
  rightLeg: { rotation: { x: number; z: number } }
  leftArm: { rotation: { x: number; z: number } }
  rightArm: { rotation: { x: number; z: number } }
}

function danceBits(seed: number): number {
  return Math.imul((seed * 4096) | 0, 2654435761) >>> 0
}

/** `tickTime` is `simTick + renderAlpha`, or seconds × 10 on the title strip. */
export function visitorDancePhase(tickTime: number, seed: number): number {
  const bits = danceBits(seed)
  const offset = (bits & 1023) / 1024 * Math.PI * 2 + seed * 0.37
  const tempo = 0.9 + ((bits >>> 11) & 7) * 0.025
  return tickTime * DANCE_PHASE_PER_TICK * tempo + offset
}

function danceArms(
  phase: number,
  bits: number,
  style: number,
  lift: number,
): Pick<VisitorDancePose, 'leftArmX' | 'rightArmX' | 'leftArmZ' | 'rightArmZ'> {
  const raise = ((bits >>> 3) & 7) * 0.012
  const wobble = Math.sin(phase)
  const beat = lift * ARM_WOBBLE
  const offset = ((bits >>> 6) & 15) / 15 * 0.45
  const wobbleB = Math.sin(phase + offset)
  if (style === 1) {
    const x = ARM_UP - raise - beat
    return { leftArmX: x, rightArmX: x, leftArmZ: ARM_OUT, rightArmZ: -ARM_OUT }
  }
  if (style === 2) {
    const high = ARM_UP - raise - Math.abs(wobble) * ARM_WOBBLE * 0.6
    const low = ARM_UP - raise + ARM_DROP - wobbleB * ARM_WOBBLE * 0.7
    if ((bits >>> 2) & 1) {
      return { leftArmX: high, rightArmX: low, leftArmZ: ARM_OUT + 0.04, rightArmZ: -ARM_OUT + 0.06 }
    }
    return { leftArmX: low, rightArmX: high, leftArmZ: ARM_OUT - 0.06, rightArmZ: -ARM_OUT - 0.04 }
  }
  return {
    leftArmX: ARM_UP - raise + wobble * ARM_WOBBLE,
    rightArmX: ARM_UP - raise - wobbleB * ARM_WOBBLE,
    leftArmZ: ARM_OUT + wobble * 0.05,
    rightArmZ: -ARM_OUT + wobble * 0.05,
  }
}

/**
 * Weight-shift two-step: planted knees, a short bounce, hands raised above
 * the head with a light beat bob, and a small hip/torso turn. Style 0 both
 * arms up with a slight opposite wippen, 1 both together, 2 one arm a bit lower.
 */
export function visitorDancePose(phase: number, seed: number): VisitorDancePose {
  const bits = danceBits(seed)
  const style = bits % 3
  const weight = Math.sin(phase)
  const lift = (1 - Math.cos(phase * 2)) * 0.5
  const bounceScale = style === 1 ? 1.15 : 1
  const hip = style === 1 ? 0.7 : 1
  const leftWeight = Math.max(0, weight)
  const rightWeight = Math.max(0, -weight)
  const arms = danceArms(phase, bits, style, lift)

  return {
    bounce: lift * BOUNCE * bounceScale,
    sidestep: weight * SIDESTEP,
    hipYaw: weight * HIP_YAW * hip,
    torsoRoll: -weight * TORSO_ROLL * hip,
    leftLegX: LEG_REST + leftWeight * LEG_WEIGHT,
    rightLegX: LEG_REST + rightWeight * LEG_WEIGHT,
    leftLegZ: weight * LEG_ABDUCT,
    rightLegZ: weight * LEG_ABDUCT,
    ...arms,
  }
}

export function applyVisitorDancePose(limbs: VisitorDanceLimbs, pose: VisitorDancePose): void {
  limbs.leftLeg.rotation.x = pose.leftLegX
  limbs.rightLeg.rotation.x = pose.rightLegX
  limbs.leftLeg.rotation.z = pose.leftLegZ
  limbs.rightLeg.rotation.z = pose.rightLegZ
  limbs.leftArm.rotation.x = pose.leftArmX
  limbs.rightArm.rotation.x = pose.rightArmX
  limbs.leftArm.rotation.z = pose.leftArmZ
  limbs.rightArm.rotation.z = pose.rightArmZ
}
