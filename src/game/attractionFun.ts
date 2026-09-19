import type { Visitor } from './types/entities'

/** Applies a completed attraction's deterministic fun reward exactly once. */
export function grantAttractionFun(visitor: Visitor, amount: number): void {
  visitor.needs.fun = Math.min(100, visitor.needs.fun + amount)
}
