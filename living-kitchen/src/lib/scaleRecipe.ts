import type { Recipe, RecipeIngredient, ScalableAmount } from '../data/types'

/**
 * `targetServings / recipe.servings` — the one ratio every scaling
 * calculation in the app (this file's display formatter, `quantityStatus`,
 * `structuredUsedAmount`) derives from. Centralized here so nothing computes
 * it slightly differently in two places.
 */
export function servingsRatio(recipe: Recipe, targetServings: number): number {
  if (recipe.servings <= 0) return 1
  return targetServings / recipe.servings
}

/**
 * The common culinary fractions a home cook actually measures with —
 * deliberately NOT the same rounding `lib/kitchen.ts`'s `quarterGlyph` uses
 * for Euko's approximate inventory model (quarter-steps only). A recipe
 * measurement like ⅓ cup is a real, common amount, not an approximation of
 * ¼ — collapsing it to the nearest quarter would misrepresent the recipe
 * itself, not just round it. Ordered ascending; `1` is a rollover sentinel
 * (glyph unused), not itself a fraction.
 */
const KITCHEN_FRACTIONS: { value: number; glyph: string }[] = [
  { value: 0, glyph: '' },
  { value: 1 / 8, glyph: '⅛' },
  { value: 1 / 4, glyph: '¼' },
  { value: 1 / 3, glyph: '⅓' },
  { value: 1 / 2, glyph: '½' },
  { value: 2 / 3, glyph: '⅔' },
  { value: 3 / 4, glyph: '¾' },
  { value: 1, glyph: '' },
]

/** The closest entry in KITCHEN_FRACTIONS to a 0..1 remainder — ties favor whichever candidate appears first above (the simpler fraction). */
function closestKitchenFraction(remainder: number): { value: number; glyph: string } {
  let best = KITCHEN_FRACTIONS[0]
  let bestDiff = Math.abs(remainder - best.value)
  for (const candidate of KITCHEN_FRACTIONS.slice(1)) {
    const diff = Math.abs(remainder - candidate.value)
    if (diff < bestDiff) {
      best = candidate
      bestDiff = diff
    }
  }
  return best
}

/**
 * Renders a non-negative amount as a kitchen-friendly whole+common-fraction
 * label with no space — "⅛", "¼", "⅓", "½", "⅔", "¾", "1", "1⅓", "1½", "2¼",
 * etc. — by finding the closest of the common culinary fractions above, not
 * by snapping to quarter-steps. Display-only: never feeds back into
 * readiness or deduction, which always compare the unrounded scaled number
 * (see `scaledQuantityLabel`'s callers in lib/kitchen.ts and lib/deduction.ts,
 * neither of which ever calls this).
 *
 * A true amount that's positive but rounds down to (effectively) zero still
 * shows the smallest visible fraction (⅛) rather than "0" — Euko should
 * never claim you need none of something you actually need a little of.
 */
export function formatKitchenFraction(amount: number): string {
  const safe = Math.max(0, amount)
  if (safe <= 1e-9) return '0'
  const whole = Math.floor(safe + 1e-9)
  const remainder = safe - whole
  const nearest = closestKitchenFraction(remainder)

  if (nearest.value >= 1 - 1e-9) return `${whole + 1}` // remainder rounded up to the next whole
  if (nearest.glyph === '') return whole > 0 ? `${whole}` : '⅛' // rounds to (effectively) zero remainder
  return whole > 0 ? `${whole}${nearest.glyph}` : nearest.glyph
}

/**
 * The compatible, reusable numeric base for this ingredient's human cooking
 * amount, when one exists — `requiredAmount` itself, for `count`/`fraction`
 * requirements only (never `fill`, which isn't itself a human unit; never
 * `level`, which never scales at all — see RecipeIngredient.requiredUnit).
 * This is what lets most structured ingredients skip authoring `scalable`
 * entirely: the number is never duplicated, just reused.
 */
function reusableRequiredAmount(ingredient: RecipeIngredient): number | null {
  const { requiredAmount, requiredUnit } = ingredient
  if (requiredAmount == null || requiredUnit == null) return null
  if (requiredUnit === 'count' || requiredUnit === 'fraction') return requiredAmount
  return null
}

/** cup/tsp/tbsp/oz/lb never pluralize in normal cooking usage except "cup" -> "cups". A tiny, fixed table — not a growing vocabulary. */
function unitLabel(unit: ScalableAmount['unit'], scaledAmount: number): string {
  if (unit === 'cup') return scaledAmount > 1 + 1e-9 ? 'cups' : 'cup'
  return unit // tsp, tbsp, oz, lb — invariant abbreviations
}

function pluralize(scaledAmount: number, noun: { singular: string; plural: string }): string {
  return scaledAmount > 1 + 1e-9 ? noun.plural : noun.singular
}

/**
 * The scaled, human-readable quantity label for one ingredient at `ratio`
 * (see `servingsRatio`) — or `ingredient.quantity` unchanged when there's
 * nothing honest to scale. This is the ONLY place `RecipeIngredient.quantity`
 * gets superseded; it is never mutated, and this function never mutates the
 * recipe or ingredient it's given.
 *
 * Resolution order:
 *   1. No `scalable` and no reusable `requiredAmount` (count/fraction) ->
 *      `ingredient.quantity`, verbatim, at any ratio. This is the correct,
 *      honest answer for "salt to taste", "a drizzle", "1 (14 oz) can" —
 *      absence of structured data is not a gap, it's the deliberate answer.
 *   2. `scalable` present -> its own `amount` (or, if omitted, the reusable
 *      `requiredAmount`) scaled by `ratio`, formatted with its `unit`/`noun`/
 *      `prep`/`fixedSuffix`/`cookingHint`.
 *   3. `scalable` absent but a reusable `requiredAmount` exists -> that
 *      number scaled by `ratio`, formatted as a bare kitchen-fraction number
 *      (no unit word, no noun) — e.g. potatoes "4" -> "6".
 */
export function scaledQuantityLabel(ingredient: RecipeIngredient, ratio: number): string {
  const reusable = reusableRequiredAmount(ingredient)
  const scalable = ingredient.scalable

  if (!scalable) {
    if (reusable == null) return ingredient.quantity
    return formatKitchenFraction(reusable * ratio)
  }

  const baseAmount = scalable.amount ?? reusable
  if (baseAmount == null) return ingredient.quantity // malformed authoring safety net — never crash, never invent a number
  const scaledAmount = Math.max(0, baseAmount * ratio)
  const amountLabel = formatKitchenFraction(scaledAmount)

  const parts: string[] = [amountLabel]
  if (scalable.unit === 'count') {
    if (scalable.noun) parts.push(pluralize(scaledAmount, scalable.noun))
  } else {
    parts.push(unitLabel(scalable.unit, scaledAmount))
  }
  let label = parts.join(' ')
  if (scalable.prep) label += `, ${scalable.prep}`
  if (scalable.fixedSuffix) label += ` ${scalable.fixedSuffix}`
  if (scalable.cookingHint) {
    const hintAmount = Math.max(0, scalable.cookingHint.amountPerUnit * scaledAmount)
    const hintUnit = unitLabel(scalable.cookingHint.unit, hintAmount)
    const hintPrep = scalable.cookingHint.prep ? ` ${scalable.cookingHint.prep}` : ''
    label += ` (about ${formatKitchenFraction(hintAmount)} ${hintUnit}${hintPrep})`
  }
  return label
}
