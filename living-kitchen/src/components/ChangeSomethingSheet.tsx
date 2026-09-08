import type { Recipe, RecipeIngredient } from '../data/types'
import { fillLabel, fractionLabel } from '../lib/kitchen'
import { matchIngredient } from '../lib/recipeMatch'
import { usageControlFor, type UsageControl } from '../lib/actualUsageControl'
import { useKitchenStore } from '../store/useKitchenStore'

interface TrackableIngredient {
  ing: RecipeIngredient
  control: UsageControl
}

/** How to display the current "actual" value for one control kind — divisible/container reuse the same fraction/fill vocabulary the rest of the app already shows kitchen stock in, rather than a raw decimal. */
function displayActual(kind: 'countable' | 'divisible' | 'container', actual: number): string {
  switch (kind) {
    case 'divisible':
      return fractionLabel(actual)
    case 'container':
      return fillLabel(actual)
    default:
      return `${actual}`
  }
}

export default function ChangeSomethingSheet({
  recipe,
  onClose,
}: {
  recipe: Recipe
  onClose: () => void
}) {
  const items = useKitchenStore((s) => s.items)
  const cookingSession = useKitchenStore((s) => s.cookingSession)
  const setActualUsage = useKitchenStore((s) => s.setActualUsage)

  // Only ingredients that actually resolve to a real kitchen item (exact
  // match or approved substitute) AND have a numeric usage control at all —
  // usageControlFor returns null for staple items (no continuous quantity to
  // edit) and is only ever given an already-matched item, never derived from
  // the ingredient's originally-requested itemId. An ingredient with no
  // matched item is excluded entirely: there is nothing in the kitchen for
  // an "actual usage" number to apply to, and buildDeductionMap would skip
  // it regardless.
  const trackable = recipe.ingredients
    .map((ing): TrackableIngredient | null => {
      if (!ing.itemId) return null
      const matched = matchIngredient(ing, items).matchedItem
      if (!matched) return null
      const control = usageControlFor(ing, matched)
      if (!control) return null
      return { ing, control }
    })
    .filter((t): t is TrackableIngredient => t != null)

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-xl2 bg-cream p-5 pb-8 text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" />
        <h2 className="font-display text-lg font-semibold">I changed something</h2>
        <p className="mt-1 text-sm text-ink/60">
          Tell us what you actually used and we'll update your kitchen accordingly.
        </p>

        <div className="mt-4 flex max-h-80 flex-col gap-3 overflow-y-auto">
          {trackable.map(({ ing, control }) => {
            const actual = cookingSession?.actualUsage[ing.itemId!] ?? control.initial
            return (
              <div
                key={ing.id}
                className="flex items-center justify-between rounded-xl border border-ink/10 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {ing.emoji} {ing.name}
                  </p>
                  <p className="text-xs text-ink/50">Recipe expected: {ing.quantity}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActualUsage(ing.itemId!, Math.max(0, actual - control.step))}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/5"
                  >
                    −
                  </button>
                  <span className="w-16 text-center text-xs font-bold tabular-nums">
                    {displayActual(control.kind, actual)}
                  </span>
                  <button
                    onClick={() => setActualUsage(ing.itemId!, actual + control.step)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/5"
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl2 bg-clay py-3 text-center text-sm font-bold text-white"
        >
          Done
        </button>
      </div>
    </div>
  )
}
