import type { KitchenItem, Recipe, RecipeIngredient } from '../data/types'
import {
  matchIngredient,
  quantityStatus,
  usableAmount,
  STAPLE_LEVEL_RANK,
  type IngredientMatch,
  type IngredientMatchKind,
  type QuantityStatus,
} from './kitchen'

// The canonical exact/substitute/missing/quantity resolution engine lives in
// lib/kitchen.ts (it needs `itemHasStock`, which this file already imports
// *from* kitchen.ts — defining it here too would create a circular module
// dependency). Re-exported here so this stays the file everything imports
// recipe-matching concepts from.
export {
  matchIngredient,
  quantityStatus,
  usableAmount,
  STAPLE_LEVEL_RANK,
  type IngredientMatch,
  type IngredientMatchKind,
  type QuantityStatus,
}

/**
 * Finds the kitchen item behind a recipe ingredient. When the ingredient has
 * a stable `itemId` (how every seed recipe ingredient is wired as of Phase
 * 2.0's identity fix — see kitchen.ts's `matchIngredient`), that's the only
 * lookup — matching lib/kitchen.ts's `findItem` exactly, so this never
 * disagrees with the app's existing feasibility display for the common case.
 * Ingredients with no itemId at all (a truly custom/free-text ingredient
 * with no catalog entry) fall back to a case/whitespace-insensitive name
 * match — the same normalization `deriveIdentity` (kitchenSync.ts) uses.
 * Unlike `matchIngredient`'s equivalent fallback, this does not also try
 * `findEntryByExactName`'s canonical/alias resolution — this function is
 * legacy/unused outside its own tests; `matchIngredient` is the maintained
 * path for real ingredient resolution.
 *
 * Deliberately NOT substitute-aware — this stays the exact-identity lookup
 * lib/kitchen.ts's `findItem` also uses. `matchIngredient` is the
 * substitute-aware resolution; use that when a same-family stand-in should
 * count.
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

/**
 * Presence/absence only — no quantity matching in this MVP. An explicit
 * catalog substitute counts as available, same as an exact match; a random
 * same-family item that isn't listed as a substitute does not.
 */
export function isIngredientAvailable(ingredient: RecipeIngredient, items: KitchenItem[]): boolean {
  return matchIngredient(ingredient, items).kind !== 'missing'
}

export interface RecipeMatch {
  recipe: Recipe
  requiredTotal: number
  requiredAvailable: number
  requiredMissing: number
  /** Required ingredients currently in the kitchen (exact or approved substitute). */
  availableIngredients: RecipeIngredient[]
  /** Required ingredients not currently in the kitchen. */
  missingIngredients: RecipeIngredient[]
  /** Optional ingredients currently in the kitchen — don't affect the score. */
  availableOptionalIngredients: RecipeIngredient[]
  /** Optional ingredients not currently in the kitchen — don't affect the score. */
  missingOptionalIngredients: RecipeIngredient[]
  /** available required / total required, 0-100. 100 if the recipe has no required ingredients. */
  matchPercent: number
  /** True when every required ingredient is available (exact or approved substitute). */
  isReady: boolean
  /**
   * True only when at least one *required* ingredient was satisfied via an
   * explicit substitute rather than an exact match — groundwork for a future
   * "Ready with adjustment" UI state. Not yet surfaced anywhere in the UI.
   */
  hasSubstitutions: boolean
  /** Per-ingredient match detail (required + optional), exact/substitute/missing. */
  ingredientMatches: IngredientMatch[]
}

/** Deterministic, presence/absence match of one recipe against the current kitchen. */
export function matchRecipe(recipe: Recipe, items: KitchenItem[]): RecipeMatch {
  const availableIngredients: RecipeIngredient[] = []
  const missingIngredients: RecipeIngredient[] = []
  const availableOptionalIngredients: RecipeIngredient[] = []
  const missingOptionalIngredients: RecipeIngredient[] = []
  const ingredientMatches: IngredientMatch[] = []
  let hasSubstitutions = false

  for (const ingredient of recipe.ingredients) {
    const match = matchIngredient(ingredient, items)
    ingredientMatches.push(match)
    const available = match.kind !== 'missing'
    if (ingredient.optional) {
      ;(available ? availableOptionalIngredients : missingOptionalIngredients).push(ingredient)
    } else {
      ;(available ? availableIngredients : missingIngredients).push(ingredient)
      if (match.kind === 'substitute') hasSubstitutions = true
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
    hasSubstitutions,
    ingredientMatches,
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
