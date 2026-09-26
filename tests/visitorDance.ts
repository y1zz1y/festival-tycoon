import assert from 'node:assert/strict'
import {
  applyVisitorDancePose,
  visitorDancePhase,
  visitorDancePose,
} from '../src/view/visitorDance'

function sample(seed: number, tickTime = 40): ReturnType<typeof visitorDancePose> {
  return visitorDancePose(visitorDancePhase(tickTime, seed), seed)
}

export function testVisitorDance(): void {
  const a = sample(123456789)
  const again = sample(123456789)
  assert.deepEqual(a, again, 'same seed and sim time replay the same pose')

  const b = sample(987654321)
  assert.notEqual(a.hipYaw, b.hipYaw, 'different guests do not share hip phase')
  assert.notEqual(a.leftArmX, b.leftArmX, 'arm beat is offset per guest')

  const t0 = visitorDancePose(visitorDancePhase(0, 11), 11)
  const t1 = visitorDancePose(visitorDancePhase(4, 11), 11)
  assert.ok(Math.abs(t0.sidestep - t1.sidestep) > 1e-4, 'the two-step advances with sim ticks')

  for (const seed of [1, 1.7, 99, 0x9e3779b1, personish(3), personish(40)]) {
    let minLeft = Infinity
    let maxLeft = -Infinity
    let minRight = Infinity
    let maxRight = -Infinity
    for (let tick = 0; tick < 80; tick += 1) {
      const pose = sample(seed, tick)
      assert.ok(pose.leftLegX >= 0 && pose.leftLegX <= 0.32, 'left knee stays planted, no kick')
      assert.ok(pose.rightLegX >= 0 && pose.rightLegX <= 0.32, 'right knee stays planted, no kick')
      assert.ok(pose.leftArmX < -1.65 && pose.leftArmX > -2.45, 'left hand stays raised above the shoulders')
      assert.ok(pose.rightArmX < -1.65 && pose.rightArmX > -2.45, 'right hand stays raised above the shoulders')
      assert.ok(Math.abs(pose.hipYaw) <= 0.14, 'hip turn stays small')
      assert.ok(Math.abs(pose.torsoRoll) <= 0.08, 'torso roll stays small')
      assert.ok(pose.bounce >= 0 && pose.bounce <= 0.04, 'bounce is a weight shift, not a hop')
      assert.ok(Math.abs(pose.sidestep) <= 0.03, 'sidestep stays inside the tile slot')
      minLeft = Math.min(minLeft, pose.leftArmX)
      maxLeft = Math.max(maxLeft, pose.leftArmX)
      minRight = Math.min(minRight, pose.rightArmX)
      maxRight = Math.max(maxRight, pose.rightArmX)
    }
    assert.ok(maxLeft - minLeft < 0.22, 'left arm bobs on the beat, it does not row')
    assert.ok(maxRight - minRight < 0.22, 'right arm bobs on the beat, it does not row')
  }

  let sawTogether = false
  let sawOpposite = false
  for (let seed = 0; seed < 200 && !(sawTogether && sawOpposite); seed += 1) {
    const span = Math.abs(visitorDancePose(Math.PI / 2, seed).leftArmX - visitorDancePose(Math.PI / 2, seed).rightArmX)
    if (span < 1e-6) sawTogether = true
    if (span > 0.12) sawOpposite = true
  }
  assert.ok(sawTogether, 'together style lifts both arms in sync')
  assert.ok(sawOpposite, 'some guests keep one hand a bit lower')

  const limbs = {
    leftLeg: { rotation: { x: 0, z: 0 } },
    rightLeg: { rotation: { x: 0, z: 0 } },
    leftArm: { rotation: { x: 0, z: 0 } },
    rightArm: { rotation: { x: 0, z: 0 } },
  }
  applyVisitorDancePose(limbs, a)
  assert.equal(limbs.leftLeg.rotation.x, a.leftLegX)
  assert.equal(limbs.rightArm.rotation.z, a.rightArmZ)

  console.log('PASS visitor dance: planted two-step, hands up, per-guest phase')
}

function personish(index: number): number {
  let hash = 2166136261
  const id = `visitor-${index}`
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619)
  return hash >>> 0
}
