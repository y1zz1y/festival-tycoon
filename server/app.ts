import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { attachMultiplayer, localJoinHost } from './rooms.ts'
import { handleSaveRequest } from './saveSlots.ts'
import { handleProgressRequest } from './progress.ts'
import { handleAccountRequest } from './accounts.ts'
import { handleScenarioRequest } from './scenarios.ts'
import { de } from './i18nMarker.ts'

/**
 * The game server as a function: static files from `dist`, the account, save,
 * progress and scenario routes, and multiplayer on `/ws`. `server/serve.ts` starts it
 * for Docker and `npm start`; the desktop app (`electron/main.mjs`) starts the bundled
 * copy inside Electron (docs/desktop.md).
 */
export type GameServerOptions = {
  port: number
  host: string
  /** Built web app; defaults to `../dist` next to this file. */
  dist?: string
  /** Address put into invites when the host plays on this machine. */
  publicHost?: () => string
}

export type RunningGameServer = {
  port: number
  close(): Promise<void>
}

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
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function safeFile(dist: string, urlPath: string): string | null {
  const decoded = decodeURIComponent((urlPath.split('?')[0] ?? '/') || '/')
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')
  const resolved = resolve(dist, relative)
  if (resolved !== dist && !resolved.startsWith(`${dist}\\`) && !resolved.startsWith(`${dist}/`)) {
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

async function serve(dist: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (await handleAccountRequest(request, response)) return
  if (await handleSaveRequest(request, response)) return
  if (await handleProgressRequest(request, response)) return
  if (await handleScenarioRequest(request, response, dist)) return
  const requested = safeFile(dist, request.url ?? '/')
  const file = requested ? await existingFile(requested) : null
  const fallback = file ?? (await existingFile(join(dist, 'index.html')))
  if (!fallback) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found') // i18n-ignore: plain HTTP body for a missing file, never shown in the game
    return
  }
  const hashedAsset = /[.-][A-Za-z0-9_-]{8,}\.(js|css)$/.test(fallback)
  response.writeHead(200, {
    'Content-Type': MIME[extname(fallback)] ?? 'application/octet-stream',
    'Cache-Control': hashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  createReadStream(fallback).pipe(response)
}

/** Starts listening; rejects with the listen error (e.g. EADDRINUSE) instead of exiting. */
export function startGameServer(options: GameServerOptions): Promise<RunningGameServer> {
  const dist = resolve(options.dist ?? fileURLToPath(new URL('../dist', import.meta.url)))
  const server = createServer((request, response) => {
    // A failing request must not take the process with it: an unwritable data
    // directory once threw out of this handler and ended every multiplayer session.
    void serve(dist, request, response).catch((error) => {
      console.error(error)
      if (response.headersSent) {
        response.end()
        return
      }
      response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ error: de('Spielserver-Fehler') }))
    })
  })
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: { threshold: 1024, zlibDeflateOptions: { level: 1 } },
  })
  server.on('upgrade', (request, socket, head) => {
    if (request.url?.split('?')[0] !== '/ws') {
      socket.destroy()
      return
    }
    wss.handleUpgrade(request, socket, head, (websocket) => {
      wss.emit('connection', websocket, request)
    })
  })
  return new Promise((resolveStart, rejectStart) => {
    server.once('error', rejectStart)
    server.listen(options.port, options.host, () => {
      server.off('error', rejectStart)
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : options.port
      attachMultiplayer(wss, options.publicHost ?? (() => localJoinHost(port)))
      resolveStart({
        port,
        close: () => new Promise((resolveClose) => {
          for (const client of wss.clients) client.terminate()
          wss.close()
          server.close(() => resolveClose())
          server.closeAllConnections()
        }),
      })
    })
  })
}
