import type { KitchenItem, Recipe, StapleLevel } from '../data/types'
import type { KitchenDeduction } from '../store/useKitchenStore'
import { matchIngredient } from './recipeMatch'

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

/**
 * Builds the "what to deduct after cooking" map for a recipe: for every recipe
 * ingredient that currently resolves to a real kitchen item (exact or approved
 * substitute), a suggested post-cook stock level.
 *
 * Keyed by the *matched* kitchen item's id (not the recipe ingredient's), so a
 * substitute is deducted from the item that actually stood in. `actualUsage` is
 * keyed by the recipe ingredient's original `itemId`, matching what
 * CookingMode records, and defaults to 1 unit per ingredient.
 *
 * Pure and recipe-scoped: the returned map only ever contains entries for the
 * recipe passed in, so re-running it for a different recipe fully replaces the
 * previous result (see Finished.tsx — this is what prevents a client-side nav
 * between two /finished routes from leaving stale deductions on screen).
 */
export function buildDeductionMap(
  recipe: Recipe,
  items: KitchenItem[],
  actualUsage?: Record<string, number>,
): Record<string, KitchenDeduction> {
  const map: Record<string, KitchenDeduction> = {}
  for (const ingredient of recipe.ingredients) {
    const matched = matchIngredient(ingredient, items).matchedItem
    if (!matched) continue
    const used = ingredient.itemId ? actualUsage?.[ingredient.itemId] : undefined
    map[matched.id] = suggestDeduction(matched, used ?? 1)
  }
  return map
}
