import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Enough of an HTTP request and response for the server's JSON handlers, which read
 * a body stream, a few headers and write one status with one payload.
 */
export type Reply = { status: number; body: any; cookie: string | null }

export function request(method: string, url: string, body?: unknown, cookie?: string): IncomingMessage {
  const stream = Readable.from(body === undefined ? [] : [JSON.stringify(body)]) as unknown as IncomingMessage
  stream.method = method
  stream.url = url
  stream.headers = cookie ? { cookie } : {}
  Object.defineProperty(stream, 'socket', { value: { remoteAddress: '127.0.0.1' }, configurable: true })
  return stream
}

export function reply(): { response: ServerResponse; read(): Reply } {
  let status = 0
  let cookie: string | null = null
  let payload = ''
  const response = {
    writeHead(code: number, headers: Record<string, string>) {
      status = code
      cookie = (headers['Set-Cookie'] as string | undefined) ?? null
      return response
    },
    end(chunk?: string) {
      payload = chunk ?? ''
      return response
    },
  } as unknown as ServerResponse
  return { response, read: () => ({ status, cookie, body: JSON.parse(payload || '{}') }) }
}
