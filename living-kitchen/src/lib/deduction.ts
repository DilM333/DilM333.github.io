import type { KitchenItem, Recipe, RecipeIngredient, StapleLevel } from '../data/types'
import type { KitchenDeduction } from '../store/useKitchenStore'
import { REQUIRED_UNIT_STOCK_TYPE } from './kitchen'
import { matchIngredient } from './recipeMatch'

const LEVEL_STEPS: StapleLevel[] = ['plenty', 'some', 'low', 'out']

/**
 * The compatible structured amount to deduct for this ingredient, against the
 * kitchen item that actually resolved it (exact match or approved
 * substitute) — or null when none applies, in which case the caller must
 * fall back to the existing fixed per-stock-type approximation.
 *
 * null cases, deliberately never guessed past:
 *   - no `requiredAmount`/`requiredUnit` was seeded at all (the common case)
 *   - `requiredUnit`'s stock type doesn't match the *resolved* item's real
 *     stockType (e.g. a substitute of a different stockType than the
 *     ingredient was originally authored against) — mirrors quantityStatus's
 *     own compatibility guard in lib/kitchen.ts, so deduction and readiness
 *     can never disagree about when a structured requirement applies
 *   - `requiredUnit === 'level'`: a staple's requiredAmount/level is a coarse
 *     *readiness threshold* ("needs to have at least this much on hand"),
 *     never a *quantity consumed* by one cook — e.g. beef-bolognese's pasta
 *     `requiredAmount: 3, requiredUnit: 'level'` means "need a well-stocked
 *     pantry," not "this dish uses 3 whole tiers of pasta." Treating it as a
 *     usage amount would drop a staple by several tiers for one dish, which
 *     is a plausible-but-wrong overcorrection the recipe author never meant
 *     to express. Staples always use the fixed one-tier-per-cook step below,
 *     regardless of any requiredAmount seeded on the ingredient.
 *
 * Exported so lib/actualUsageControl.ts (the "I changed something" sheet's
 * initialization logic) can reuse this exact compatibility/extraction rule
 * instead of a second, potentially-drifting copy of it.
 *
 * `ratio` (default `1`) is `targetServings / recipe.servings` for the cook in
 * progress — `count`/`fraction`/`fill` requirements scale by it, `level`
 * never does (see the null case above). This is the exact same scaling
 * `lib/kitchen.ts`'s `quantityStatus` applies to the same field, so readiness
 * and deduction can never diverge for the same ingredient at the same ratio.
 */
export function structuredUsedAmount(ingredient: RecipeIngredient, item: KitchenItem, ratio: number = 1): number | null {
  const { requiredAmount, requiredUnit } = ingredient
  if (requiredAmount == null || requiredUnit == null) return null
  if (requiredUnit === 'level') return null
  if (REQUIRED_UNIT_STOCK_TYPE[requiredUnit] !== item.stockType) return null
  return Math.max(0, requiredAmount * ratio)
}

/**
 * `usedUnits` is the amount to deduct, already expressed on the *item's own*
 * stock scale (count / whole+quarter fraction / 0..1 fill) — never a
 * recipe-display-quantity number (e.g. "2 cups"); see buildDeductionMap's doc
 * comment for how a caller is expected to arrive at that. Omitted (or
 * `undefined`) means "no explicit or structured amount available" and falls
 * back to the same fixed per-stock-type approximation this always used.
 */
export function suggestDeduction(item: KitchenItem, usedUnits?: number): KitchenDeduction {
  switch (item.stockType) {
    case 'countable':
      return { itemId: item.id, newCount: Math.max(0, (item.count ?? 0) - (usedUnits ?? 1)) }
    case 'divisible': {
      // Default: one cooking step uses about a quarter of the item,
      // regardless of how many whole units are on hand — e.g. 2 3/4 onions ->
      // 2 1/2 onions. An explicit `usedUnits` (a real user-entered amount, or
      // a recipe's own compatible structured requirement) overrides that
      // default amount — but the result is still snapped to the same
      // quarter-step grid either way. Both of those sources are themselves
      // already expressed on that grid (see RecipeIngredient.requiredAmount's
      // doc comment), so this rounding is a no-op for them and, exactly as
      // before, only ever smooths float drift — the quarter-step *rounding
      // behavior* itself is unchanged, only which amount gets rounded.
      const current = item.fraction ?? 0
      const amount = usedUnits ?? 0.25
      const next = Math.max(0, Math.round((current - amount) * 4) / 4)
      return { itemId: item.id, newFraction: next }
    }
    case 'container': {
      const amount = usedUnits ?? 0.15
      return { itemId: item.id, newFill: Math.max(0, (item.fill ?? 0) - amount) }
    }
    case 'staple': {
      // Never reads usedUnits — see structuredUsedAmount's doc comment for
      // why a staple's "amount" has no meaningful continuous quantity to
      // deduct. Always steps down exactly one tier per cook.
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
 * CookingMode records.
 *
 * Priority for how much to deduct, per ingredient:
 *   1. `actualUsage[ingredient.itemId]` — an explicit amount the user entered
 *      (see ChangeSomethingSheet). Always honored when present, for every
 *      stock type (this used to be silently discarded for anything but
 *      countable — see suggestDeduction — since only that branch ever read
 *      its `usedUnits` parameter).
 *   2. `structuredUsedAmount` — the recipe's own `requiredAmount`, when its
 *      unit is compatible with the resolved item's real stock type.
 *   3. `suggestDeduction`'s fixed per-stock-type fallback, unchanged from
 *      before this priority chain existed.
 *
 * NOTE on `actualUsage`'s scale: this function assumes whatever's stored in
 * `actualUsage` is already expressed on the matched item's own stock scale
 * (a count of whole units / a whole+quarter fraction / a 0..1 fill amount) —
 * the same assumption `suggestDeduction` now documents. `ChangeSomethingSheet`
 * (via lib/actualUsageControl.ts) is responsible for only ever writing
 * `actualUsage` values on that same scale — this function doesn't and
 * shouldn't know or attempt any real-world-unit conversion itself.
 *
 * Pure and recipe-scoped: the returned map only ever contains entries for the
 * recipe passed in, so re-running it for a different recipe fully replaces the
 * previous result (see Finished.tsx — this is what prevents a client-side nav
 * between two /finished routes from leaving stale deductions on screen).
 *
 * `ratio` (default `1`) is `targetServings / recipe.servings` — passed
 * through to `structuredUsedAmount` untouched. It never affects the fixed
 * per-stock-type fallback (`suggestDeduction`'s own 1/0.25/0.15 defaults):
 * when there's no honest structured requirement to scale, scaling a made-up
 * constant wouldn't make it more honest, only more falsely precise.
 */
export function buildDeductionMap(
  recipe: Recipe,
  items: KitchenItem[],
  actualUsage?: Record<string, number>,
  ratio: number = 1,
): Record<string, KitchenDeduction> {
  const map: Record<string, KitchenDeduction> = {}
  for (const ingredient of recipe.ingredients) {
    const matched = matchIngredient(ingredient, items).matchedItem
    if (!matched) continue
    const explicit = ingredient.itemId ? actualUsage?.[ingredient.itemId] : undefined
    const used = explicit ?? structuredUsedAmount(ingredient, matched, ratio) ?? undefined
    map[matched.id] = suggestDeduction(matched, used)
  }
  return map
}
