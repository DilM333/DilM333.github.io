import type { KitchenItem, StapleLevel } from '../data/types'
import type { KitchenDeduction } from '../store/useKitchenStore'

const FRACTION_STEPS = [1, 0.75, 0.5, 0.25, 0]
const LEVEL_STEPS: StapleLevel[] = ['plenty', 'some', 'low', 'out']

export function suggestDeduction(item: KitchenItem, usedUnits: number): KitchenDeduction {
  switch (item.stockType) {
    case 'countable':
      return { itemId: item.id, newCount: Math.max(0, (item.count ?? 0) - usedUnits) }
    case 'divisible': {
      const current = item.fraction ?? 0
      const idx = FRACTION_STEPS.findIndex((f) => f <= current + 0.001)
      const nextIdx = Math.min(FRACTION_STEPS.length - 1, idx + 1)
      return { itemId: item.id, newFraction: FRACTION_STEPS[nextIdx] }
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
