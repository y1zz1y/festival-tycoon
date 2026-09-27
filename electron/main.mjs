// Desktop app (docs/desktop.md): starts the bundled game server (server/app.ts, built
// by scripts/build-desktop.mjs into electron/build/server.mjs) inside Electron and
// shows the game in a window. Saves, accounts and hosted multiplayer rooms work
// offline; the data lives in the app's user folder.
import { app, BrowserWindow, dialog, Menu, shell } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// A fixed port keeps the page origin stable, and with it everything the game keeps
// in browser storage (settings, local saves, progress). The next ports are fallbacks.
const PORTS = Array.from({ length: 10 }, (_, index) => 47880 + index)
// Reachable from the home network, so friends can join a hosted room by invite link.
const HOST = process.env.HEADLINER_DESKTOP_HOST || '0.0.0.0'

let gameServer = null
let mainWindow = null

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
  app.whenReady().then(start).catch((error) => {
    dialog.showErrorBox('Headliner Tycoon', String(error?.stack ?? error))
    app.quit()
  })
}

async function startServer() {
  process.env.HEADLINER_DATA_DIR ??= path.join(app.getPath('userData'), 'saves')
  const bundle = pathToFileURL(path.join(import.meta.dirname, 'build', 'server.mjs')).href
  const { startGameServer } = await import(bundle)
  const dist = path.join(app.getAppPath(), 'dist')
  for (const port of PORTS) {
    try {
      return await startGameServer({ port, host: HOST, dist })
    } catch (error) {
      if (error?.code !== 'EADDRINUSE') throw error
    }
  }
  throw new Error(`No free port in ${PORTS[0]}–${PORTS.at(-1)} / Kein freier Port in ${PORTS[0]}–${PORTS.at(-1)}`)
}

function isGameUrl(url, origin) {
  try {
    return new URL(url).origin === origin
  } catch {
    return false
  }
}

function openOutside(url) {
  if (/^https?:\/\//.test(url)) void shell.openExternal(url)
}

function createWindow(port) {
  const origin = `http://127.0.0.1:${port}`
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#1d2a24',
    title: 'Headliner Tycoon',
    icon: path.join(app.getAppPath(), 'dist', 'app-icons', 'icon-512.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  // Links out of the game (updates, docs, invites) open in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isGameUrl(url, origin)) return
    event.preventDefault()
    openOutside(url)
  })
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen())
      event.preventDefault()
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  void mainWindow.loadURL(origin)
}

async function start() {
  // Windows and Linux get no menu bar; macOS keeps its standard app menu (Cmd+Q etc.).
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null)
  gameServer = await startServer()
  createWindow(gameServer.port)
  app.on('activate', () => {
    if (!mainWindow && gameServer) createWindow(gameServer.port)
  })
}

// The game is the only window: closing it ends the app on every platform.
app.on('window-all-closed', () => app.quit())
app.on('will-quit', (event) => {
  if (!gameServer) return
  event.preventDefault()
  const closing = gameServer
  gameServer = null
  void closing.close().finally(() => app.quit())
})
