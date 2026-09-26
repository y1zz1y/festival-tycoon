/**
 * Legal terrain import: OpenStreetMap + optional public DEM.
 * Does not download Google Maps / Earth satellite tiles.
 *
 *   npm run import-terrain -- --sketch burning-man
 *   npm run import-terrain -- --sketch rock-am-ring
 *   npm run import-terrain -- --preset rock-am-ring --elevation
 */
import { build } from 'rolldown'
import { mkdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, '.import-terrain-output')

await mkdir(outDir, { recursive: true })
try {
  await build({
    input: path.join(root, 'scripts/import-terrain-entry.ts'),
    platform: 'node',
    output: { file: path.join(outDir, 'cli.mjs'), format: 'esm' },
  })
  const result = spawnSync(process.execPath, [path.join(outDir, 'cli.mjs'), ...process.argv.slice(2)], {
    stdio: 'inherit',
  })
  process.exitCode = result.status ?? 1
} finally {
  await rm(outDir, { recursive: true, force: true })
}
