import type { BuildingKind } from './catalog'

export const SHOP_SERVICE_KINDS = ['food', 'alcohol'] as const
export type ShopServiceKind = (typeof SHOP_SERVICE_KINDS)[number]

export const CARDINAL_OFFSETS = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
] as const

export function isShopServiceKind(kind: BuildingKind | string): kind is ShopServiceKind {
  return kind === 'food' || kind === 'alcohol'
}

export function adjacentCardinalCells(x: number, z: number): Array<{ x: number; z: number }> {
  return CARDINAL_OFFSETS.map(([dx, dz]) => ({ x: x + dx, z: z + dz }))
}
