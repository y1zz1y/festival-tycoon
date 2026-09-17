/**
 * The game's side of the save API (see server/saveSlots.ts). Saves belong to the
 * signed-in account; a save can be shared, which lets everyone open it — writing
 * always goes to your own archive, never to someone else's row.
 */
export type ServerSaveSlot = { id: string; name: string; savedAt: number; public: boolean; owner: string }
export type ServerSaveArchive = {
  /** Who the server thinks is calling, or null for a guest. */
  account: string | null
  own: ServerSaveSlot[]
  /** What other people have shared. */
  shared: ServerSaveSlot[]
}
type StoredSaveSlot = ServerSaveSlot & { snapshot: string }

function parseJson<T>(text: string): T {
  try {
    return (text ? JSON.parse(text) : {}) as T
  } catch {
    throw new Error('Der Spielserver hat keine Spielstandsliste geliefert (keine JSON-Antwort).')
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    const headers = new Headers(options?.headers)
    if (options?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    response = await fetch(url, {
      ...options,
      credentials: 'same-origin',
      headers,
    })
  } catch {
    throw new Error('Kein Kontakt zum Spielserver — läuft er? Lokale Spielstände bleiben in diesem Browser.')
  }
  const payload = parseJson<T & { error?: string }>(await response.text())
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Bitte im Titelbildschirm anmelden, um Server-Spielstände zu nutzen.')
    }
    if (response.status === 404) throw new Error('Dieser Server-Spielstand wurde nicht gefunden.')
    throw new Error(payload.error ?? `Spielserver antwortet nicht (${response.status})`)
  }
  return payload
}

export async function listServerSaves(): Promise<ServerSaveArchive> {
  const payload = await request<Partial<ServerSaveArchive>>('/api/saves')
  return {
    account: typeof payload.account === 'string' ? payload.account : null,
    own: Array.isArray(payload.own) ? payload.own : [],
    shared: Array.isArray(payload.shared) ? payload.shared : [],
  }
}
export const loadServerSave = (id: string) => request<StoredSaveSlot>(`/api/saves/${encodeURIComponent(id)}`)
export const saveServerSave = (name: string, snapshot: string, id?: string) => request<ServerSaveSlot>(id ? `/api/saves/${encodeURIComponent(id)}` : '/api/saves', {
  method: id ? 'PUT' : 'POST', body: JSON.stringify({ name, snapshot }),
})
/** Publishes a save of your own, or takes it back off the public list. */
export const shareServerSave = (id: string, share: boolean) => request<ServerSaveSlot>(`/api/saves/${encodeURIComponent(id)}`, {
  method: 'PATCH', body: JSON.stringify({ public: share }),
})
export const deleteServerSave = (id: string) => request<{ ok: true }>(`/api/saves/${encodeURIComponent(id)}`, { method: 'DELETE' })
