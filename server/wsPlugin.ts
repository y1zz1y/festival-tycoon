import type { Plugin, ViteDevServer } from 'vite'
import { WebSocketServer } from 'ws'
import { attachMultiplayer, localJoinHost } from './rooms.ts'
import { handleSaveRequest } from './saveSlots.ts'
import { handleAccountRequest } from './accounts.ts'

function bindWebSocket(
  server: ViteDevServer,
  port: number,
): void {
  const httpServer = server.httpServer
  if (!httpServer) return
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: { threshold: 1024, zlibDeflateOptions: { level: 1 } },
  })
  attachMultiplayer(wss, () => process.env.PUBLIC_HOST?.trim() || localJoinHost(port))
  httpServer.on('upgrade', (request, socket, head) => {
    const path = request.url?.split('?')[0]
    if (path !== '/ws') return
    wss.handleUpgrade(request, socket, head, (websocket) => {
      wss.emit('connection', websocket, request)
    })
  })
}

/** The two APIs the game speaks to, in one middleware: accounts first, then saves. */
async function handleApi(request: Parameters<typeof handleSaveRequest>[0], response: Parameters<typeof handleSaveRequest>[1]): Promise<boolean> {
  return (await handleAccountRequest(request, response)) || (await handleSaveRequest(request, response))
}

export function festivalMultiplayer(): Plugin {
  return {
    name: 'festival-multiplayer',
    configureServer(server) {
      bindWebSocket(server, server.config.server.port ?? 5173)
      server.middlewares.use((request, response, next) => {
        void handleApi(request, response).then(
          (handled) => { if (!handled) next() },
          (error) => {
            if (!response.headersSent) {
              response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
              response.end(JSON.stringify({ error: 'Spielserver-Fehler beim Lesen der Spielstände' }))
            }
            console.error(error)
          },
        )
      })
    },
    configurePreviewServer(server) {
      bindWebSocket(
        server as unknown as ViteDevServer,
        server.config.preview.port ?? 4173,
      )
      server.middlewares.use((request, response, next) => {
        void handleApi(request, response).then(
          (handled) => { if (!handled) next() },
          (error) => {
            if (!response.headersSent) {
              response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
              response.end(JSON.stringify({ error: 'Spielserver-Fehler beim Lesen der Spielstände' }))
            }
            console.error(error)
          },
        )
      })
    },
  }
}
