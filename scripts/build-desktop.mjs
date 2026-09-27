// Bundles the game server (server/app.ts and everything it imports, ws included) into
// one ES module for the desktop app: electron/main.mjs imports electron/build/server.mjs.
// Electron's Node runs it directly, without TypeScript stripping. See docs/desktop.md.
import { build } from 'rolldown'
import { rm } from 'node:fs/promises'

await rm('electron/build', { recursive: true, force: true })
await build({
  input: 'server/app.ts',
  platform: 'node',
  // Optional native speed-ups ws tries to load; it falls back to plain JS without them.
  external: ['bufferutil', 'utf-8-validate'],
  output: { file: 'electron/build/server.mjs', format: 'esm' },
})
console.log('Desktop server bundle: electron/build/server.mjs')
