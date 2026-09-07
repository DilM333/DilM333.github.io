import { useState } from 'react'
import type { Recipe } from '../data/types'
import { uncertainRequiredItems } from '../lib/recipeMatch'
import { useKitchenStore } from '../store/useKitchenStore'

/**
 * The interactive half of the "worth checking …" hint on Recipe Detail. Walks
 * the recipe's required low-confidence ingredients one at a time and lets the
 * user make a quick coarse correction. All it owns is which item ids have been
 * answered this session — every stock change goes through the normal kitchen
 * store mutations (and therefore the normal household sync path).
 *
 * The queue is recomputed from live store items on every render, so an item
 * that stops being low-confidence (confirmed here or elsewhere) or leaves the
 * kitchen simply drops out; a substitute is corrected on the item that
 * actually stood in.
 */
export default function ConfirmStockPanel({
  recipe,
  onClose,
}: {
  recipe: Recipe
  onClose: () => void
}) {
  const items = useKitchenStore((s) => s.items)
  const confirmKitchenItem = useKitchenStore((s) => s.confirmKitchenItem)
  const setItemStockLevel = useKitchenStore((s) => s.setItemStockLevel)
  const [answered, setAnswered] = useState<string[]>([])

  const queue = uncertainRequiredItems(recipe, items).filter((it) => !answered.includes(it.id))
  const current = queue[0]

  // The queued item is no longer a live uncertain ingredient — it was answered,
  // removed from the kitchen, or confirmed elsewhere — and nothing uncertain is
  // left. Render nothing: silently skipping/advancing is handled by `queue`
  // being recomputed from live store items above, and the recipe surface's own
  // hint unmounts this panel. Never show "updated / confirmed" copy here.
  if (!current) return null

  const answer = (action: 'have' | 'low' | 'out') => {
    if (action === 'have') confirmKitchenItem(current.id)
    else setItemStockLevel(current.id, action)
    setAnswered((prev) => [...prev, current.id])
  }

  return (
    <div className="rounded-xl2 border border-ink/10 bg-white p-3 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">
          Do you still have {current.name.toLowerCase()}?
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 text-ink/30 hover:text-ink/60"
        >
          ✕
        </button>
      </div>

      {answered.length + queue.length > 1 && (
        <p className="mt-0.5 text-[11px] font-medium text-ink/40">
          {answered.length + 1} of {answered.length + queue.length}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => answer('have')}
          className="flex-1 rounded-lg bg-leaf py-2 text-xs font-bold text-white"
        >
          Still have it
        </button>
        <button
          type="button"
          onClick={() => answer('low')}
          className="flex-1 rounded-lg bg-butter/20 py-2 text-xs font-bold text-[#8a6113]"
        >
          Low
        </button>
        <button
          type="button"
          onClick={() => answer('out')}
          className="flex-1 rounded-lg bg-ink/5 py-2 text-xs font-bold text-ink/70"
        >
          Out
        </button>
      </div>
    </div>
  )
}
