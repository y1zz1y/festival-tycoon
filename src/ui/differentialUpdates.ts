export type UpdateFingerprint = string | number | boolean | null

/**
 * Keeps expensive panel builders off unrelated snapshot notifications. Callers
 * own the fingerprint, so each panel can depend on exactly the state it renders.
 */
export class DifferentialUpdates {
  private readonly fingerprints = new Map<string, UpdateFingerprint>()

  run(id: string, fingerprint: UpdateFingerprint, update: () => void): boolean {
    if (this.fingerprints.get(id) === fingerprint) return false
    this.fingerprints.set(id, fingerprint)
    update()
    return true
  }

  invalidate(id?: string): void {
    if (id === undefined) this.fingerprints.clear()
    else this.fingerprints.delete(id)
  }
}

export function listFingerprint(
  values: ReadonlyArray<string | number | boolean | null | undefined>,
): string {
  return values.map((value) => value ?? '').join('\u001f')
}
