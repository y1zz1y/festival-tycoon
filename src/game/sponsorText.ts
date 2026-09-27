// i18n: client-text
/**
 * How a sponsor condition reads on the contract card (docs/festival.md). Only UI code
 * imports this module, so it translates with `t`; the brands themselves stay as they are.
 */
import { t } from '../i18n'
import type { SponsorCondition } from './sponsors'

export const SPONSOR_CONDITION_TEXT: Record<SponsorCondition, (target: number) => string> = {
  admissions: (target) => t`mindestens ${target} Anreisen`,
  satisfaction: (target) => t`Zufriedenheit mindestens ${target} %`,
  banners: (target) => t`${target} Festivalbanner auf dem Gelände`,
  headliner: () => t('ein Headliner (5 Sterne) im Programm'),
}
