import type { KitchenItem, Recipe, RecipeIngredient } from '../data/types'
import { itemHasStock } from './kitchen'

/**
 * Finds the kitchen item behind a recipe ingredient. When the ingredient has
 * a stable `itemId` (how most seed recipes are wired), that's the only
 * lookup — matching lib/kitchen.ts's `findItem` exactly, so this never
 * disagrees with the app's existing feasibility display for the common case.
 * Only ingredients with no itemId at all (e.g. "Ground beef" in
 * beef-bolognese, which the existing app already always reports as
 * "missing" regardless of kitchen contents) fall back to a
 * case/whitespace-insensitive name match — the same normalization
 * `deriveIdentity` (kitchenSync.ts) and `findEntryByName` (catalog.ts) use —
 * so custom ingredients and other name-only ingredients can still match.
 */
export function findMatchingKitchenItem(
  ingredient: RecipeIngredient,
  items: KitchenItem[],
): KitchenItem | undefined {
  if (ingredient.itemId) {
    return items.find((i) => i.id === ingredient.itemId)
  }
  const nameLower = ingredient.name.trim().toLowerCase()
  return items.find((i) => i.name.trim().toLowerCase() === nameLower)
}

/** Presence/absence only — no quantity matching in this MVP. */
export function isIngredientAvailable(ingredient: RecipeIngredient, items: KitchenItem[]): boolean {
  const item = findMatchingKitchenItem(ingredient, items)
  return !!item && itemHasStock(item)
}

export interface RecipeMatch {
  recipe: Recipe
  requiredTotal: number
  requiredAvailable: number
  requiredMissing: number
  /** Required ingredients currently in the kitchen. */
  availableIngredients: RecipeIngredient[]
  /** Required ingredients not currently in the kitchen. */
  missingIngredients: RecipeIngredient[]
  /** Optional ingredients currently in the kitchen — don't affect the score. */
  availableOptionalIngredients: RecipeIngredient[]
  /** Optional ingredients not currently in the kitchen — don't affect the score. */
  missingOptionalIngredients: RecipeIngredient[]
  /** available required / total required, 0-100. 100 if the recipe has no required ingredients. */
  matchPercent: number
  /** True when every required ingredient is available. */
  isReady: boolean
}

/** Deterministic, presence/absence match of one recipe against the current kitchen. */
export function matchRecipe(recipe: Recipe, items: KitchenItem[]): RecipeMatch {
  const availableIngredients: RecipeIngredient[] = []
  const missingIngredients: RecipeIngredient[] = []
  const availableOptionalIngredients: RecipeIngredient[] = []
  const missingOptionalIngredients: RecipeIngredient[] = []

  for (const ingredient of recipe.ingredients) {
    const available = isIngredientAvailable(ingredient, items)
    if (ingredient.optional) {
      ;(available ? availableOptionalIngredients : missingOptionalIngredients).push(ingredient)
    } else {
      ;(available ? availableIngredients : missingIngredients).push(ingredient)
    }
  }

  const requiredTotal = availableIngredients.length + missingIngredients.length
  const requiredAvailable = availableIngredients.length
  const requiredMissing = missingIngredients.length
  const matchPercent = requiredTotal === 0 ? 100 : Math.round((requiredAvailable / requiredTotal) * 100)

  return {
    recipe,
    requiredTotal,
    requiredAvailable,
    requiredMissing,
    availableIngredients,
    missingIngredients,
    availableOptionalIngredients,
    missingOptionalIngredients,
    matchPercent,
    isReady: requiredMissing === 0,
  }
}

/**
 * Ranks recipes by fewest missing required ingredients, then highest match
 * percentage, then recipe name as a stable deterministic tie-breaker.
 */
export function rankRecipes(recipes: Recipe[], items: KitchenItem[]): RecipeMatch[] {
  return recipes
    .map((recipe) => matchRecipe(recipe, items))
    .sort((a, b) => {
      if (a.requiredMissing !== b.requiredMissing) return a.requiredMissing - b.requiredMissing
      if (a.matchPercent !== b.matchPercent) return b.matchPercent - a.matchPercent
      return a.recipe.name.localeCompare(b.recipe.name)
    })
}

/** Short status label for card/detail UI: "Ready to make" or "N ingredient(s) missing". */
export function matchStatusLabel(match: RecipeMatch): string {
  if (match.isReady) return 'Ready to make'
  return `${match.requiredMissing} ingredient${match.requiredMissing === 1 ? '' : 's'} missing`
}
