import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { attachMultiplayer, localJoinHost } from './rooms.ts'
import { storageProblem } from './database.ts'
import { handleSaveRequest } from './saveSlots.ts'
import { handleAccountRequest } from './accounts.ts'

const PORT = Number(process.env.PORT || 8080)
const HOST = process.env.HOST || '0.0.0.0'
const DIST = resolve(fileURLToPath(new URL('../dist', import.meta.url)))

const MIME: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function safeFile(urlPath: string): string | null {
  const decoded = decodeURIComponent((urlPath.split('?')[0] ?? '/') || '/')
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')
  const resolved = resolve(DIST, relative)
  if (resolved !== DIST && !resolved.startsWith(`${DIST}\\`) && !resolved.startsWith(`${DIST}/`)) {
    return null
  }
  return resolved
}

async function existingFile(path: string): Promise<string | null> {
  try {
    const info = await stat(path)
    return info.isDirectory() ? existingFile(join(path, 'index.html')) : path
  } catch {
    return null
  }
}

const server = createServer((request, response) => {
  // A failing request must not take the process with it. It used to: an
  // unwritable data directory threw out of this handler, the rejection went
  // unhandled, and node exited — ending everybody's multiplayer session over a
  // save that could not be written.
  void serve(request, response).catch((error) => {
    console.error(error)
    if (response.headersSent) {
      response.end()
      return
    }
    response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({ error: 'Spielserver-Fehler' }))
  })
})

async function serve(request: Parameters<typeof handleSaveRequest>[0], response: Parameters<typeof handleSaveRequest>[1]): Promise<void> {
  if (await handleAccountRequest(request, response)) return
  if (await handleSaveRequest(request, response)) return
  const requested = safeFile(request.url ?? '/')
  const file = requested ? await existingFile(requested) : null
  const fallback = file ?? (await existingFile(join(DIST, 'index.html')))
  if (!fallback) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
    return
  }
  const hashedAsset = /[.-][A-Za-z0-9_-]{8,}\.(js|css)$/.test(fallback)
  response.writeHead(200, {
    'Content-Type': MIME[extname(fallback)] ?? 'application/octet-stream',
    'Cache-Control': hashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  createReadStream(fallback).pipe(response)
}

const wss = new WebSocketServer({
  noServer: true,
  perMessageDeflate: { threshold: 1024, zlibDeflateOptions: { level: 1 } },
})
attachMultiplayer(wss, () => process.env.PUBLIC_HOST?.trim() || localJoinHost(PORT))

server.on('upgrade', (request, socket, head) => {
  if (request.url?.split('?')[0] !== '/ws') {
    socket.destroy()
    return
  }
  wss.handleUpgrade(request, socket, head, (websocket) => {
    wss.emit('connection', websocket, request)
  })
})

// Said once, at the start, rather than as a failed request an hour later.
const storage = storageProblem()
if (storage) {
  console.error(
    `Konten und Server-Spielstände sind abgeschaltet: ${storage}
` +
    'HEADLINER_DATA_DIR auf ein beschreibbares Verzeichnis setzen — im Container ' +
    'das Volume, also HEADLINER_DATA_DIR=/app/saves. Das Spiel selbst und der ' +
    'Mehrspieler laufen auch ohne.',
  )
}

server.listen(PORT, HOST, () => {
  // PUBLIC_HOST is what the invite falls back to when the host plays on the
  // very machine that serves the game; behind a proxy set it to the public
  // address, e.g. PUBLIC_HOST=https://headliner-tycoon.com
  const reachable = process.env.PUBLIC_HOST?.trim() || `http://${localJoinHost(PORT)}`
  console.log(`Headliner Tycoon: http://${HOST}:${PORT}  ·  öffentlich: ${reachable}`)
})
