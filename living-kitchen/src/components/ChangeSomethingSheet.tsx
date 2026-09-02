import type { Recipe } from '../data/types'
import { useKitchenStore } from '../store/useKitchenStore'

function parseLeadingNumber(text: string): number {
  const match = text.match(/[\d.]+/)
  return match ? parseFloat(match[0]) : 1
}

export default function ChangeSomethingSheet({
  recipe,
  onClose,
}: {
  recipe: Recipe
  onClose: () => void
}) {
  const cookingSession = useKitchenStore((s) => s.cookingSession)
  const setActualUsage = useKitchenStore((s) => s.setActualUsage)
  const trackable = recipe.ingredients.filter((i) => i.itemId)

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
          {trackable.map((ing) => {
            const expected = parseLeadingNumber(ing.quantity)
            const unit = ing.quantity.replace(/^[\d.]+\s*/, '')
            const actual = cookingSession?.actualUsage[ing.itemId!] ?? expected
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
                    onClick={() => setActualUsage(ing.itemId!, Math.max(0, actual - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/5"
                  >
                    −
                  </button>
                  <span className="w-16 text-center text-xs font-bold tabular-nums">
                    {actual} {unit}
                  </span>
                  <button
                    onClick={() => setActualUsage(ing.itemId!, actual + 1)}
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
