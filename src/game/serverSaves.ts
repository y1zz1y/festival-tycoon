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

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  })
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Lokaler Server antwortet nicht')
  return payload
}

export const listServerSaves = () => request<ServerSaveArchive>('/api/saves')
export const loadServerSave = (id: string) => request<StoredSaveSlot>(`/api/saves/${encodeURIComponent(id)}`)
export const saveServerSave = (name: string, snapshot: string, id?: string) => request<ServerSaveSlot>(id ? `/api/saves/${encodeURIComponent(id)}` : '/api/saves', {
  method: id ? 'PUT' : 'POST', body: JSON.stringify({ name, snapshot }),
})
/** Publishes a save of your own, or takes it back off the public list. */
export const shareServerSave = (id: string, share: boolean) => request<ServerSaveSlot>(`/api/saves/${encodeURIComponent(id)}`, {
  method: 'PATCH', body: JSON.stringify({ public: share }),
})
export const deleteServerSave = (id: string) => request<{ ok: true }>(`/api/saves/${encodeURIComponent(id)}`, { method: 'DELETE' })
