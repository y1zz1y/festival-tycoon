import { startGameServer } from './app.ts'
import { storageProblem } from './database.ts'
import { localJoinHost } from './rooms.ts'

// Docker and `npm start`: the game server from server/app.ts on PORT/HOST.
const PORT = Number(process.env.PORT || 8080)
const HOST = process.env.HOST || '0.0.0.0'

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

// PUBLIC_HOST is what the invite falls back to when the host plays on the very
// machine that serves the game; behind a proxy set it to the public address,
// e.g. PUBLIC_HOST=https://headliner-tycoon.com
const publicHost = (): string => process.env.PUBLIC_HOST?.trim() || localJoinHost(PORT)
await startGameServer({ port: PORT, host: HOST, publicHost })
const reachable = process.env.PUBLIC_HOST?.trim() || `http://${localJoinHost(PORT)}`
console.log(`Headliner Tycoon: http://${HOST}:${PORT}  ·  öffentlich: ${reachable}`)
