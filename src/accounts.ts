/**
 * Local player accounts.
 *
 * There is no account server behind this: an account is created and checked in the
 * browser it was made in, and that is what the mask says out loud. The password is
 * never stored — only a PBKDF2 hash with its own random salt — so a look into the
 * browser's storage does not hand anyone the password they typed.
 */
export type AccountResult = { ok: boolean; message: string; name?: string }

type StoredAccount = { name: string; salt: string; hash: string; createdAt: number }

const ACCOUNTS_KEY = 'headliner-accounts'
const SESSION_KEY = 'headliner-session'
const ITERATIONS = 150_000
const NAME_PATTERN = /^[\p{L}\p{N} _.-]{3,24}$/u

const toHex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')

function readAccounts(): StoredAccount[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(ACCOUNTS_KEY) ?? '[]') as StoredAccount[]
    return Array.isArray(raw)
      ? raw.filter((entry) => entry && typeof entry.name === 'string' && typeof entry.salt === 'string' && typeof entry.hash === 'string')
      : []
  } catch {
    return []
  }
}

function writeAccounts(accounts: StoredAccount[]): boolean {
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
    return true
  } catch {
    return false
  }
}

/** Names are compared without case or surrounding space, so "Ada" and "ada " are the same player. */
const normalizeName = (name: string): string => name.trim().replace(/\s+/g, ' ')
const nameKey = (name: string): string => normalizeName(name).toLocaleLowerCase()

async function derive(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: ITERATIONS },
    key,
    256,
  )
  return toHex(bits)
}

function validate(name: string, password: string): string | null {
  if (!NAME_PATTERN.test(normalizeName(name))) return 'Name: 3 bis 24 Zeichen, Buchstaben, Ziffern, Leer- und Satzzeichen'
  if (password.length < 8) return 'Passwort: mindestens 8 Zeichen'
  if (password.length > 200) return 'Passwort: höchstens 200 Zeichen'
  return null
}

export async function registerAccount(name: string, password: string, repeat: string): Promise<AccountResult> {
  const problem = validate(name, password)
  if (problem) return { ok: false, message: problem }
  if (password !== repeat) return { ok: false, message: 'Die beiden Passwörter stimmen nicht überein' }
  const accounts = readAccounts()
  if (accounts.some((entry) => nameKey(entry.name) === nameKey(name))) {
    return { ok: false, message: 'Diesen Namen gibt es hier schon' }
  }
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer)
  const account: StoredAccount = {
    name: normalizeName(name),
    salt,
    hash: await derive(password, salt),
    createdAt: Date.now(),
  }
  if (!writeAccounts([...accounts, account])) {
    return { ok: false, message: 'Der Browser speichert nichts — Konto konnte nicht angelegt werden' }
  }
  setSession(account.name)
  return { ok: true, message: `Konto angelegt · angemeldet als ${account.name}`, name: account.name }
}

export async function signIn(name: string, password: string): Promise<AccountResult> {
  const account = readAccounts().find((entry) => nameKey(entry.name) === nameKey(name))
  // The same answer whether the name or the password was wrong: which of the two it
  // was is nobody's business, not even here.
  const wrong: AccountResult = { ok: false, message: 'Name oder Passwort stimmt nicht' }
  if (!account || !password) return wrong
  if ((await derive(password, account.salt)) !== account.hash) return wrong
  setSession(account.name)
  return { ok: true, message: `Angemeldet als ${account.name}`, name: account.name }
}

function setSession(name: string): void {
  try {
    window.localStorage.setItem(SESSION_KEY, name)
  } catch { /* the session simply does not survive a reload then */ }
}

export function signOut(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch { /* nothing to clear */ }
}

export function currentAccount(): string | null {
  try {
    const name = window.localStorage.getItem(SESSION_KEY)
    return name && readAccounts().some((entry) => entry.name === name) ? name : null
  } catch {
    return null
  }
}

export function accountCount(): number {
  return readAccounts().length
}
