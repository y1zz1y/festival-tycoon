import type { BuildingKind } from './catalog'
import type { Supply } from './festivalManagement'

export const GENERAL_GOODS_SUPPLY = 'goods' as const satisfies Supply

export const SHIRT_STYLES = ['basic', 'tank', 'hoodie', 'polo'] as const
export type ShirtStyle = (typeof SHIRT_STYLES)[number]

export const SHIRT_STYLE_LABELS: Record<ShirtStyle, string> = {
  basic: 'Klassisch',
  tank: 'Tanktop',
  hoodie: 'Kapuze',
  polo: 'Polo',
}

export const SHIRT_COLORS = [
  { id: 'red', color: 0xe23b3b, name: 'Rot' },
  { id: 'orange', color: 0xe67a22, name: 'Orange' },
  { id: 'yellow', color: 0xe8c547, name: 'Gelb' },
  { id: 'green', color: 0x3d9b5c, name: 'Grün' },
  { id: 'teal', color: 0x2a9d8f, name: 'Petrol' },
  { id: 'blue', color: 0x2f6fdb, name: 'Blau' },
  { id: 'purple', color: 0x7b4db8, name: 'Violett' },
  { id: 'pink', color: 0xd95b8a, name: 'Pink' },
  { id: 'black', color: 0x2a2d33, name: 'Schwarz' },
  { id: 'white', color: 0xf4f1ea, name: 'Weiß' },
] as const

export type WornShirt = {
  color: number
  style: ShirtStyle
}

export const GENERAL_GOODS_SHOP_KINDS = ['mascot', 'shirt'] as const
export type GeneralGoodsShopKind = (typeof GENERAL_GOODS_SHOP_KINDS)[number]

export function isGeneralGoodsShopKind(kind: string): kind is GeneralGoodsShopKind {
  return kind === 'mascot' || kind === 'shirt'
}

export function shopSupplyKind(kind: BuildingKind | string): Supply | null {
  if (kind === 'food') return 'food'
  if (kind === 'alcohol') return 'drinks'
  if (kind === 'toilet' || kind === 'backstageToilet') return 'water'
  if (isGeneralGoodsShopKind(kind)) return 'goods'
  return null
}

export function isQueuedFacilityKind(kind: string): boolean {
  return (
    kind === 'food' ||
    kind === 'toilet' ||
    kind === 'ride' ||
    kind === 'alcohol' ||
    kind === 'mascot' ||
    kind === 'shirt'
  )
}

export function isStallFacilityKind(kind: string): boolean {
  return (
    kind === 'food' ||
    kind === 'toilet' ||
    kind === 'alcohol' ||
    kind === 'mascot' ||
    kind === 'shirt'
  )
}

export function isPricedShopKind(kind: string): boolean {
  return (
    kind === 'food' ||
    kind === 'alcohol' ||
    kind === 'ride' ||
    kind === 'mascot' ||
    kind === 'shirt'
  )
}

export function defaultShirtSettings(): WornShirt {
  return { color: SHIRT_COLORS[0]!.color, style: 'basic' }
}

export function normalizeShirtStyle(value: unknown): ShirtStyle {
  return SHIRT_STYLES.includes(value as ShirtStyle) ? (value as ShirtStyle) : 'basic'
}

export function normalizeShirtColor(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return SHIRT_COLORS[0]!.color
  return Math.max(0, Math.min(0xffffff, Math.floor(n)))
}

export function normalizeWornShirt(value: unknown): WornShirt | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as { color?: unknown; style?: unknown }
  return {
    color: normalizeShirtColor(record.color),
    style: normalizeShirtStyle(record.style),
  }
}

export function mascotVariant(seed: number): number {
  return ((seed >>> 0) % 3) + 1
}

export function mascotTint(variant: number): number {
  return [0xe8a07a, 0x7ec8c4, 0xf2d36b][Math.max(0, variant - 1) % 3]!
}

export function stockoutThought(kind: string, waiting: boolean): string {
  if (kind === 'food') {
    return waiting
      ? 'Hier ist kein Essen mehr. Ich warte noch kurz.'
      : 'Ich schaue kurz, ob noch Essen da ist.'
  }
  if (kind === 'alcohol') {
    return waiting
      ? 'Hier sind keine Getränke mehr. Ich warte noch kurz.'
      : 'Ich schaue kurz, ob noch Getränke da sind.'
  }
  if (kind === 'mascot') {
    return waiting
      ? 'Die Maskottchen sind alle. Ich warte noch kurz.'
      : 'Ich schaue kurz, ob noch Maskottchen da sind.'
  }
  if (kind === 'shirt') {
    return waiting
      ? 'Die T-Shirts sind ausverkauft. Ich warte noch kurz.'
      : 'Ich schaue kurz, ob noch Shirts da sind.'
  }
  return waiting ? 'Ausverkauft! Ich warte noch kurz.' : 'Ich schaue kurz, ob noch etwas da ist.'
}

export function souvenirSeekThought(kind: string): string {
  if (kind === 'mascot') return 'Ich hole mir ein Maskottchen als Andenken.'
  if (kind === 'shirt') return 'Ich kaufe mir ein Festival-Shirt.'
  return 'Ich schaue bei den Ständen vorbei.'
}

export function souvenirPurchaseThought(kind: string, holdingMascot: boolean): string {
  if (kind === 'mascot') {
    return holdingMascot
      ? 'Mein Maskottchen kommt mit auf den Weg.'
      : 'Ich habe ein Maskottchen gekauft.'
  }
  if (kind === 'shirt') return 'Das neue Shirt sitzt. Weiter geht’s.'
  return 'Ich habe ein Andenken gekauft.'
}
