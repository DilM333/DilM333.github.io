import { useState } from 'react'
import { toKitchenItem, type CatalogEntry, type StartingAmount } from '../data/catalog'
import type { KitchenItem, StapleLevel } from '../data/types'
import { useKitchenStore } from '../store/useKitchenStore'
import StartingAmountPicker from './StartingAmountPicker'

/**
 * The confirm-before-mutating step for Add Food: selecting a catalog result
 * only opens this sheet — nothing in the kitchen changes until the user taps
 * the primary button. For an item already in the kitchen, the picker is
 * pre-filled with its *current* amount and replaces it outright on confirm
 * (divisible/container/staple); count is the one exception and is treated as
 * an amount to add on top of what's already there, since that arithmetic is
 * unambiguous. This is what closes the "tapping Milk silently resets it to
 * Full" gap — see restockKitchenItem in the store.
 */
export default function AddToKitchenSheet({
  entry,
  existingItem,
  onClose,
  onConfirm,
}: {
  entry: CatalogEntry
  existingItem?: KitchenItem
  onClose: () => void
  onConfirm: () => void
}) {
  const addKitchenItem = useKitchenStore((s) => s.addKitchenItem)
  const restockKitchenItem = useKitchenStore((s) => s.restockKitchenItem)

  // For an existing countable item, `count` here is the amount being added,
  // not the total — defaults to 1 rather than the current count. For every
  // other case (new item, or existing divisible/container/staple), the
  // picker represents the actual value that will be saved, seeded from the
  // current amount when there is one.
  const [count, setCount] = useState(1)
  const [fraction, setFraction] = useState(existingItem?.fraction ?? 1)
  const [fill, setFill] = useState(existingItem?.fill ?? 1)
  const [level, setLevel] = useState<StapleLevel>(existingItem?.level ?? 'plenty')

  const currentCount = existingItem?.count ?? 0
  const isExisting = !!existingItem
  const isCountable = entry.stockType === 'countable'

  const confirm = () => {
    if (isExisting) {
      const amount: StartingAmount = {}
      if (entry.stockType === 'countable') amount.count = count
      if (entry.stockType === 'divisible') amount.fraction = fraction
      if (entry.stockType === 'container') amount.fill = fill
      if (entry.stockType === 'staple') amount.level = level
      restockKitchenItem(entry.id, amount)
    } else {
      addKitchenItem(toKitchenItem(entry, { count, fraction, fill, level }))
    }
    onConfirm()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-xl2 bg-cream p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" />

        <div className="flex items-center gap-2">
          <span className="text-2xl">{entry.emoji}</span>
          <h2 className="font-display text-lg font-semibold">{entry.name}</h2>
        </div>
        {isExisting && (
          <p className="mt-1 text-xs font-semibold text-clay">Already in your kitchen</p>
        )}

        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold text-ink/50">
            {isExisting
              ? isCountable
                ? `Currently ${currentCount} — how many are you adding?`
                : 'Update the current amount'
              : 'How much do you have now?'}
          </label>
          <StartingAmountPicker
            stockType={entry.stockType}
            value={{ count, fraction, fill, level }}
            onChange={(patch) => {
              if (patch.count !== undefined) setCount(patch.count)
              if (patch.fraction !== undefined) setFraction(patch.fraction)
              if (patch.fill !== undefined) setFill(patch.fill)
              if (patch.level !== undefined) setLevel(patch.level)
            }}
          />
          {isExisting && isCountable && (
            <p className="mt-2 text-xs text-ink/50">New total: {currentCount + count}</p>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-ink/15 py-2.5 text-sm font-semibold text-ink/70"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            className="flex-1 rounded-xl bg-clay py-2.5 text-sm font-semibold text-white"
          >
            {isExisting ? 'Update kitchen' : 'Add to kitchen'}
          </button>
        </div>
      </div>
    </div>
  )
}
