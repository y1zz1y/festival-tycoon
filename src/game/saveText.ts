export function encodeSaveText(json: string): string {
  const bytes = new TextEncoder().encode(json)
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += 8192) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)))
  return btoa(chunks.join(''))
}

export function decodeSaveText(text: string): string {
  const binary = atob(text.replace(/\s/g, ''))
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, character => character.charCodeAt(0)))
}

/** Full snapshot JSON. Never drop visitors, buildings or other world arrays to save space. */
export function serializeSnapshot(state: unknown): string {
  const json = JSON.stringify(state)
  if (typeof json !== 'string' || json === '' || json === 'undefined') {
    throw new Error('Spielstand konnte nicht geschrieben werden')
  }
  const parsed = JSON.parse(json) as { buildings?: unknown; visitors?: unknown }
  if (!Array.isArray(parsed.buildings) || !Array.isArray(parsed.visitors)) {
    throw new Error('Spielstand ist unvollständig — Gebäude oder Besucher fehlen')
  }
  return json
}

export function isQuotaError(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'QuotaExceededError' || error.code === 22
  }
  return error instanceof Error && /quota/i.test(error.name + error.message)
}

export function storageErrorMessage(error: unknown, fallback: string): string {
  if (isQuotaError(error)) {
    return 'Browser-Speicher ist voll. Speichere unter einem Konto auf dem Spielserver oder exportiere den Stand als Text.'
  }
  return error instanceof Error && error.message ? error.message : fallback
}
