/**
 * Canonical German texts that code compares against. Comparing a result with a literal
 * breaks as soon as either side is translated, so the producer and every consumer use
 * these constants and compare canonical with canonical — before anything is localized
 * (docs/i18n.md, I18N-E4).
 */
import { de } from '../i18n/marker'

/** A client's command went to the host; the real result arrives later. */
export const COMMAND_QUEUED = de('Befehl eingeplant')

/** Bulldozing an empty cell; area demolition skips it instead of reporting it. */
export const NOTHING_TO_DEMOLISH = de('Hier gibt es nichts abzureißen')

/** An area attraction does not allow this kind of object (issue code `reference-forbidden`). */
export const AREA_REFERENCE_FORBIDDEN = de('Dieses Objekt ist auf der Fläche nicht erlaubt.')
