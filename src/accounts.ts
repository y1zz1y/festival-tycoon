/**
 * Player accounts, held by the game server (see server/accounts.ts).
 *
 * The password leaves the browser once, over the wire, and is never kept here: what
 * comes back is a session cookie the browser stores on its own. This module only
 * remembers who is signed in, so the title screen can ask without waiting.
 */
export type AccountResult = { ok: boolean; message: string; name?: string }

let signedInName: string | null = null

async function post(path: string, body?: unknown): Promise<AccountResult> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const payload = (await response.json().catch(() => null)) as AccountResult | null
    if (!payload) return { ok: false, message: 'Der Spielserver hat nicht geantwortet' }
    return payload
  } catch {
    return { ok: false, message: 'Kein Kontakt zum Spielserver — läuft er?' }
  }
}

export async function registerAccount(name: string, password: string, repeat: string): Promise<AccountResult> {
  if (password !== repeat) return { ok: false, message: 'Die beiden Passwörter stimmen nicht überein' }
  const result = await post('/api/account/register', { name, password })
  if (result.ok) signedInName = result.name ?? null
  return result
}

export async function signIn(name: string, password: string): Promise<AccountResult> {
  const result = await post('/api/account/login', { name, password })
  if (result.ok) signedInName = result.name ?? null
  return result
}

export async function signOut(): Promise<AccountResult> {
  const result = await post('/api/account/logout')
  signedInName = null
  return result
}

/** Asks the server who the session cookie belongs to; run once at startup. */
export async function refreshAccount(): Promise<string | null> {
  try {
    const response = await fetch('/api/account/me', { credentials: 'same-origin' })
    const payload = (await response.json().catch(() => null)) as { name?: string | null } | null
    signedInName = payload?.name ?? null
  } catch {
    signedInName = null
  }
  return signedInName
}

/** Who is signed in, as of the last answer from the server. */
export function currentAccount(): string | null {
  return signedInName
}
