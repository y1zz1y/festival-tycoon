import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { de } from './i18nMarker.ts'

const REPO_PUBLIC = resolve(fileURLToPath(new URL('../public/scenarios', import.meta.url)))

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    request.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

export function scenarioDirectory(distDir?: string): string {
  if (process.env.HEADLINER_SCENARIOS_DIR?.trim()) return resolve(process.env.HEADLINER_SCENARIOS_DIR.trim())
  return distDir ? resolve(distDir, 'scenarios') : REPO_PUBLIC
}

function safeScenarioId(value: string): string | null {
  const id = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)
  return id || null
}

export async function listScenarioJson(dir: string): Promise<unknown[]> {
  try {
    const names = await readdir(dir)
    const files: unknown[] = []
    for (const name of names) {
      if (extname(name).toLowerCase() !== '.json' || name === 'index.json') continue
      try {
        files.push(JSON.parse(await readFile(join(dir, name), 'utf8')))
      } catch {
        // A broken drop-in must not hide the rest of the list.
      }
    }
    return files
  } catch {
    return []
  }
}

export async function handleScenarioRequest(
  request: IncomingMessage,
  response: ServerResponse,
  distDir?: string,
): Promise<boolean> {
  const path = (request.url ?? '').split('?')[0]
  if (path !== '/api/scenarios') return false
  const dir = scenarioDirectory(distDir)
  if (request.method === 'GET' || request.method === 'HEAD') {
    json(response, 200, { scenarios: await listScenarioJson(dir) })
    return true
  }
  if (request.method !== 'POST') {
    json(response, 405, { error: de('Nur GET oder POST') })
    return true
  }
  try {
    const raw = JSON.parse(await readBody(request)) as { id?: string }
    const id = typeof raw.id === 'string' ? safeScenarioId(raw.id) : null
    if (!id) {
      json(response, 400, { error: de('Szenario braucht eine id') })
      return true
    }
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, `${id}.json`), `${JSON.stringify(raw, null, 2)}\n`, 'utf8')
    json(response, 200, { ok: true, id, path: `${id}.json` })
  } catch {
    json(response, 400, { error: de('Szenario konnte nicht gespeichert werden') })
  }
  return true
}
