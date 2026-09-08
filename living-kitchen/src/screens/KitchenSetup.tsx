import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AddToKitchenSheet from '../components/AddToKitchenSheet'
import type { CatalogEntry } from '../data/catalog'
import { STARTER_ENTRIES } from '../data/kitchenSetupStarters'
import { useKitchenStore } from '../store/useKitchenStore'

/**
 * The one-time, entirely optional first-use nudge shown when a real
 * household's kitchen is confirmed empty (see App.tsx's needsKitchenSetup).
 * Tapping an item opens the existing AddToKitchenSheet — the exact same
 * confirm-before-mutating quantity flow Add Food uses, not a second one.
 * Both exits ("Continue to Euko" and "Skip for now") just move on; neither
 * requires having added anything.
 */
export default function KitchenSetup() {
  const navigate = useNavigate()
  const items = useKitchenStore((s) => s.items)
  const markKitchenSetupSeen = useKitchenStore((s) => s.markKitchenSetupSeen)
  const [pendingEntry, setPendingEntry] = useState<CatalogEntry | null>(null)
  const [addedIds, setAddedIds] = useState<string[]>([])

  const finish = () => {
    markKitchenSetupSeen()
    navigate('/kitchen')
  }

  return (
    <div className="flex min-h-full flex-col gap-5 px-5 pb-8 pt-10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-clay">Euko</p>
        <h1 className="font-display text-2xl font-semibold text-ink">Set up your kitchen</h1>
        <p className="mt-2 text-sm text-ink/60">
          Start with a few things you already have. Rough amounts are fine — you can always add
          more later.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {STARTER_ENTRIES.map((entry) => {
          const added = addedIds.includes(entry.id)
          return (
            <button
              key={entry.id}
              onClick={() => setPendingEntry(entry)}
              className={`flex flex-col items-center gap-1.5 rounded-xl2 border py-4 text-center shadow-soft transition ${
                added ? 'border-leaf/40 bg-leaf/5' : 'border-ink/10 bg-white hover:border-clay/40'
              }`}
            >
              <span className="text-3xl">{entry.emoji}</span>
              <span className="text-xs font-semibold leading-tight text-ink">{entry.name}</span>
              {added && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-leaf">Added</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-auto flex flex-col items-stretch gap-2 pt-4">
        <button
          onClick={finish}
          className="rounded-xl2 bg-clay py-3.5 text-center text-base font-bold text-white shadow-card transition hover:brightness-95"
        >
          Continue to Euko →
        </button>
        <button
          onClick={finish}
          className="py-1 text-center text-sm font-semibold text-ink/40 underline underline-offset-2"
        >
          Skip for now
        </button>
      </div>

      {pendingEntry && (
        <AddToKitchenSheet
          entry={pendingEntry}
          existingItem={items.find((i) => i.id === pendingEntry.id)}
          onClose={() => setPendingEntry(null)}
          onConfirm={() => {
            setAddedIds((prev) => (prev.includes(pendingEntry.id) ? prev : [...prev, pendingEntry.id]))
            setPendingEntry(null)
          }}
        />
      )}
    </div>
  )
}
