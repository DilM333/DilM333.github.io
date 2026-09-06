import type { KitchenItem, StapleLevel } from '../data/types'
import type { KitchenDeduction } from '../store/useKitchenStore'

const LEVEL_STEPS: StapleLevel[] = ['plenty', 'some', 'low', 'out']

export function suggestDeduction(item: KitchenItem, usedUnits: number): KitchenDeduction {
  switch (item.stockType) {
    case 'countable':
      return { itemId: item.id, newCount: Math.max(0, (item.count ?? 0) - usedUnits) }
    case 'divisible': {
      // One cooking step uses about a quarter of the item, regardless of how
      // many whole units are on hand — e.g. 2 3/4 onions -> 2 1/2 onions.
      const current = item.fraction ?? 0
      const next = Math.max(0, Math.round((current - 0.25) * 4) / 4)
      return { itemId: item.id, newFraction: next }
    }
    case 'container':
      return { itemId: item.id, newFill: Math.max(0, (item.fill ?? 0) - 0.15) }
    case 'staple': {
      const idx = LEVEL_STEPS.indexOf(item.level ?? 'out')
      const nextIdx = Math.min(LEVEL_STEPS.length - 1, idx + 1)
      return { itemId: item.id, newLevel: LEVEL_STEPS[nextIdx] }
    }
    default:
      return { itemId: item.id }
  }
}
