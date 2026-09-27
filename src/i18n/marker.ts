/**
 * The markers for canonical German text. They live in server/i18nMarker.ts so the Docker
 * image (server/ + dist/, no src/) can load them at runtime; the client re-exports them
 * from here, the same way src/net/chatProtocol.ts does for the chat helpers.
 * Authoritative code (src/game, src/net) imports from this file and nowhere else in i18n.
 */
export {
  dc,
  de,
  eur,
  hhmm,
  keep,
  listOf,
  named,
  nested,
  num,
  numberedName,
  plural,
  verbatim,
  type Slot,
} from '../../server/i18nMarker'
