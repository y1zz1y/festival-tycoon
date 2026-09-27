// i18n: client-text
/**
 * Display text for copied selections and library entries (docs/blueprints.md). Only UI
 * code imports this module, so it translates directly with `t` (docs/i18n.md).
 */
import { formatMoney, joinParts, plural, t } from '../i18n'
import { blueprintStampCharge, type Blueprint } from './blueprints'

export function describeBlueprint(blueprint: Blueprint): string {
  const buildings = blueprint.items.filter((item) => item.type === 'building').length
  const roads = blueprint.items.filter((item) => item.type === 'road').length
  const parking = blueprint.items.filter((item) => item.type === 'parking').length
  return joinParts(
    `${blueprint.width}×${blueprint.depth}`,
    plural(buildings, t`${buildings} Objekt`, t`${buildings} Objekte`),
    roads > 0 && plural(roads, t`${roads} Straßenfeld`, t`${roads} Straßenfelder`),
    parking > 0 && plural(parking, t`${parking} Parkplatz`, t`${parking} Parkplatzfelder`),
    formatMoney(blueprintStampCharge(blueprint.items)),
  )
}
