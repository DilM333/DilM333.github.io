import type { Feasibility, KitchenItem, Recipe, RecipeIngredient } from '../data/types'
import {
  matchIngredient,
  quantityStatus,
  usableAmount,
  STAPLE_LEVEL_RANK,
  type IngredientMatch,
  type IngredientMatchKind,
  type QuantityStatus,
} from './kitchen'
import { inventoryConfidence } from './inventoryConfidence'

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
  /**
   * Required ingredients that ARE currently satisfied (exact or approved
   * substitute) but whose matched kitchen item has 'low' inventory confidence
   * — Euko hasn't had recent contact with it (see lib/inventoryConfidence).
   *
   * Purely informational. This never changes `isReady`, `matchPercent`,
   * `requiredMissing`, ranking, or any feasibility status — a low-confidence
   * item is still treated as available. It exists so the UI can eventually add
   * a non-destructive hint to an otherwise-ready recipe, e.g.
   * "Looks ready — worth checking milk". Empty when every required ingredient
   * is either missing or recently confirmed.
   */
  lowConfidenceRequired: IngredientMatch[]
}

/** Deterministic, presence/absence match of one recipe against the current kitchen. */
export function matchRecipe(recipe: Recipe, items: KitchenItem[]): RecipeMatch {
  const availableIngredients: RecipeIngredient[] = []
  const missingIngredients: RecipeIngredient[] = []
  const availableOptionalIngredients: RecipeIngredient[] = []
  const missingOptionalIngredients: RecipeIngredient[] = []
  const ingredientMatches: IngredientMatch[] = []
  const lowConfidenceRequired: IngredientMatch[] = []
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
      if (available && match.matchedItem && inventoryConfidence(match.matchedItem) === 'low') {
        lowConfidenceRequired.push(match)
      }
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
    lowConfidenceRequired,
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

/**
 * Joins ingredient names for the "worth checking …" hint:
 *   [a]        -> "a"
 *   [a, b]     -> "a and b"
 *   [a, b, c]  -> "a, b, and 1 more"
 *   [a…e]      -> "a, b, and 3 more"
 * Names past the first two are summarised as a count so the line stays short.
 */
export function formatCheckList(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  const extra = names.length - 2
  return `${names[0]}, ${names[1]}, and ${extra} more`
}

/**
 * A light, non-alarming nudge for an *otherwise-cookable* recipe that leans on
 * required ingredients Euko hasn't had recent contact with
 * (`RecipeMatch.lowConfidenceRequired`). Read-only for now.
 *
 * Returns null unless the recipe reads as 'ready' / 'ready-adjusted' AND there
 * is at least one such ingredient. `feasibilityStatus` is passed in by the
 * caller (from computeFeasibility) so this never re-derives readiness — it only
 * decides whether to *phrase* a hint. Low-confidence never affects whether an
 * ingredient counts as available; this is purely a suggestion to double-check.
 *
 *   "Looks ready — worth checking milk"
 *   "Looks ready — worth checking milk and spinach"
 *   "Looks ready — worth checking milk, spinach, and 1 more"
 */
export function lowConfidenceHint(
  match: RecipeMatch,
  feasibilityStatus: Feasibility,
): string | null {
  if (feasibilityStatus !== 'ready' && feasibilityStatus !== 'ready-adjusted') return null
  const names = Array.from(new Set(match.lowConfidenceRequired.map((m) => m.ingredient.name)))
  if (names.length === 0) return null
  return `Looks ready — worth checking ${formatCheckList(names)}`
}
