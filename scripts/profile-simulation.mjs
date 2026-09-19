import { build } from 'rolldown'
import { readFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

await mkdir('.performance-output', { recursive: true })
try {
  await build({ input: 'tests/performance.ts', platform: 'node', output: { file: '.performance-output/profile.mjs', format: 'esm' } })
  const requested = process.argv.slice(2)
  let runs = [requested]
  if (requested[0] === '--fixtures') {
    const manifestPath = 'tests/fixtures/performance/manifest.json'
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const overrideTicks = requested[1]
    runs = manifest.fixtures.map(fixture => [
      fixture.id,
      overrideTicks ?? String(fixture.ticks ?? 120),
    ])
    if (runs.length === 0) {
      console.log(`No performance fixtures registered in ${manifestPath}.`)
    }
  }
  for (const args of runs) {
    const result = spawnSync(
      process.execPath,
      ['.performance-output/profile.mjs', ...args],
      { stdio: 'inherit' },
    )
    if ((result.status ?? 1) !== 0) {
      process.exitCode = result.status ?? 1
      break
    }
  }
} finally {
  await rm('.performance-output', { recursive: true, force: true })
}
