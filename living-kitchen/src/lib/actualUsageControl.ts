import type { KitchenItem, RecipeIngredient } from '../data/types'
import { structuredUsedAmount } from './deduction'

export type UsageControlKind = 'countable' | 'divisible' | 'container'

export interface UsageControl {
  kind: UsageControlKind
  /**
   * Seed value for the "I changed something" picker, before any explicit
   * actualUsage override — already expressed on the *matched* item's own
   * stock scale (a count of whole units / a whole+quarter fraction / a 0..1
   * fill amount), the same scale suggestDeduction/buildDeductionMap expect.
   * Never a recipe-display-quantity number (e.g. "2 cups") for divisible or
   * container — see usageControlFor's doc comment.
   */
  initial: number
  /** +/- increment for the picker, same scale as `initial`. */
  step: number
}

/** Fixed fallback initial value when no compatible structured requirement exists — identical to lib/deduction.ts's own suggestDeduction fallback, so the picker's starting point never disagrees with what would be deducted anyway if the user never touches it. */
const FALLBACK_INITIAL: Record<'divisible' | 'container', number> = {
  divisible: 0.25,
  container: 0.15,
}

/** +/- step per stock type. Divisible matches the app-wide quarter-step convention (StartingAmountPicker, Finished.tsx's own divisible adjuster); container matches Finished.tsx's own existing container adjuster step — neither is a new invention. */
const STEP: Record<UsageControlKind, number> = {
  countable: 1,
  divisible: 0.25,
  container: 0.1,
}

/**
 * Countable-only, scale-safe fallback: parses a leading number out of the
 * recipe's human-readable display quantity (e.g. "2 pieces" -> 2). Safe only
 * for countable because a countable ingredient's display-quantity number and
 * its stock `count` are the same scale by construction (a recipe asking for
 * "2 pieces" of a countable item means "2" on the same count scale the
 * kitchen tracks) — this is NOT extended to divisible/container, whose
 * display quantities are typically expressed in real-world units (cups,
 * tbsp, wedges) that don't correspond to the 0..1 fraction/fill stock scale
 * without an actual unit conversion, which this deliberately never attempts.
 * Falls back to 1 when no leading number can be parsed at all — matching
 * suggestDeduction's own countable fallback.
 */
function parseLeadingNumber(text: string): number {
  const match = text.match(/[\d.]+/)
  return match ? parseFloat(match[0]) : 1
}

/**
 * What the "I changed something" sheet should show/step by for one recipe
 * ingredient, driven entirely by the *matched* kitchen item (exact match or
 * approved substitute — never the recipe's originally-requested catalog
 * item), or `null` when there is nothing honest to edit:
 *
 *   - no matched item at all (the ingredient isn't in the kitchen) — the
 *     caller is expected to have already excluded these before calling this
 *   - stockType 'staple' — a staple's amount is a coarse readiness level,
 *     not a continuous quantity there's a meaningful "used this much" number
 *     for (see lib/deduction.ts's structuredUsedAmount doc comment); no
 *     numeric control should exist for it, matching the deduction engine's
 *     own refusal to interpret a staple's requiredAmount as usage
 *
 * Priority for `initial`, per stock type:
 *   1. A compatible structured `requiredAmount` (via the shared
 *      `structuredUsedAmount`, reused verbatim from lib/deduction.ts so this
 *      can never disagree with what would actually be deducted).
 *   2. countable only: parse the display `quantity` string.
 *   3. The same fixed fallback lib/deduction.ts's suggestDeduction would use
 *      if the picker is never touched.
 *
 * Deliberately no real-world-unit conversion anywhere in this function —
 * "2 cups" is never turned into a fill fraction, "½" is never guessed at for
 * a container. Divisible/container never consult `ingredient.quantity` at
 * all, by construction (that branch simply never calls the parser).
 */
export function usageControlFor(
  ingredient: RecipeIngredient,
  matched: KitchenItem,
): UsageControl | null {
  switch (matched.stockType) {
    case 'countable': {
      const structured = structuredUsedAmount(ingredient, matched)
      const initial = structured ?? parseLeadingNumber(ingredient.quantity)
      return { kind: 'countable', initial, step: STEP.countable }
    }
    case 'divisible': {
      const initial = structuredUsedAmount(ingredient, matched) ?? FALLBACK_INITIAL.divisible
      return { kind: 'divisible', initial, step: STEP.divisible }
    }
    case 'container': {
      const initial = structuredUsedAmount(ingredient, matched) ?? FALLBACK_INITIAL.container
      return { kind: 'container', initial, step: STEP.container }
    }
    case 'staple':
    default:
      return null
  }
}
