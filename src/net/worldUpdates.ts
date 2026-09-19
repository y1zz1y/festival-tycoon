import { quotedKey as quoted, roundForWire, stringifyRounded, WIRE_DIGITS, WIRE_DIGITS_NESTED } from './codec'
import type { WorldSnapshot } from './protocol'

/** Reliable, ordered WebSocket updates; unchanged world sections stay on the client. */
export class WorldUpdates {
  private previous = new Map<string, string>()
  private visitors = new Map<string, Map<string, unknown>>()

  reset(): void { this.previous.clear(); this.visitors.clear() }

  encode(world: WorldSnapshot, full = false): string {
    const fields: string[] = []
    const patches: string[] = []
    const present = new Set(world.visitors.map(visitor => visitor.id))
    const removed = full ? [] : [...this.visitors.keys()].filter(id => !present.has(id))
    for (const id of removed) this.visitors.delete(id)
    if (full) this.visitors.clear()
    for (const visitor of world.visitors) {
      const previous = this.visitors.get(visitor.id) ?? new Map<string, unknown>()
      let changes = ''
      // The hot loop of the whole protocol: a full park runs this for every
      // visitor five times a second. It used to encode all ~85 fields of each
      // one just to find out which had moved — a quarter of a million
      // JSON.stringify calls per update. Plain values are now compared as they
      // are and encoded only once they differ.
      for (const key in visitor) {
        const value = (visitor as Record<string, unknown>)[key]
        if (value === undefined) continue
        // Work out what the field is worth before spending anything on writing
        // it: for an object that means encoding it, but a number or a string is
        // compared as it stands and only turned into text once it has moved.
        const digits = WIRE_DIGITS.get(key)
        const object = value !== null && typeof value === 'object'
        const token = digits !== undefined && typeof value === 'number'
          ? roundForWire(value, digits)
          : object
            ? stringifyRounded(value, WIRE_DIGITS_NESTED.get(key) ?? -1)
            : value
        if (previous.get(key) === token) continue
        previous.set(key, token)
        changes += (changes ? ',' : '') + quoted(key) +
          ':' + (object ? token as string : JSON.stringify(token))
      }
      this.visitors.set(visitor.id, previous)
      if (!changes) continue
      // A full sync carries every field anyway, so the same pass writes the
      // whole visitor and the wire stays rounded the same way a delta is.
      patches.push(full ? `{${changes}}` : `{"id":${JSON.stringify(visitor.id)},"changes":{${changes}}}`)
    }
    for (const [key, value] of Object.entries(world)) {
      if (key === 'visitors') continue
      const encoded = JSON.stringify(value)
      if (full || this.previous.get(key) !== encoded) {
        fields.push(quoted(key) + ':' + encoded)
        this.previous.set(key, encoded)
      }
    }
    if (full) fields.push(`"visitors":[${patches.join(',')}]`)
    return full
      ? `{"t":"sync","world":{${fields.join(',')}}}`
      : `{"t":"state","world":{${fields.join(',')}},"visitors":[${patches.join(',')}],"removed":${JSON.stringify(removed)}}`
  }
}
