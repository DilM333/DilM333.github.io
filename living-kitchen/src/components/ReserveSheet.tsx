import { useState } from 'react'
import type { KitchenItem } from '../data/types'
import { itemDisplayAmount } from '../lib/kitchen'
import { useKitchenStore } from '../store/useKitchenStore'

export default function ReserveSheet({ item, onClose }: { item: KitchenItem; onClose: () => void }) {
  const setReserved = useKitchenStore((s) => s.setReserved)
  const [reserved, setReservedLocal] = useState(item.reserved ?? 0)
  const [reservedFor, setReservedFor] = useState(item.reservedFor ?? '')

  const save = () => {
    setReserved(item.id, reserved, reservedFor.trim() || undefined)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-xl2 bg-cream p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" />
        <div className="flex items-center gap-2">
          <span className="text-2xl">{item.emoji}</span>
          <div>
            <h2 className="font-display text-lg font-semibold">{item.name}</h2>
            <p className="text-xs text-ink/50">Amount: {itemDisplayAmount(item)}</p>
          </div>
        </div>

        <p className="mt-4 text-sm font-semibold text-ink/70">Save some for later?</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-xs text-ink/50">None</span>
          <input
            type="range"
            min={0}
            max={100}
            value={reserved * 100}
            onChange={(e) => setReservedLocal(Number(e.target.value) / 100)}
            className="flex-1 accent-berry"
          />
          <span className="text-xs text-ink/50">All</span>
        </div>

        {reserved > 0 && (
          <p className="mt-2 text-sm text-berry">
            🛡 About {Math.round(reserved * 100)}% of your remaining {item.name.toLowerCase()} is
            reserved.
          </p>
        )}

        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold text-ink/50">Reserve for (optional)</label>
          <input
            value={reservedFor}
            onChange={(e) => setReservedFor(e.target.value)}
            placeholder="Cookies tomorrow"
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-berry"
          />
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-ink/15 py-2.5 text-sm font-semibold text-ink/70"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="flex-1 rounded-xl bg-berry py-2.5 text-sm font-semibold text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
