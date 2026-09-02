import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { useKitchenStore } from '../store/useKitchenStore'

export default function GroceryList() {
  const groceryList = useKitchenStore((s) => s.groceryList)
  const toggleGroceryChecked = useKitchenStore((s) => s.toggleGroceryChecked)
  const removeGroceryItem = useKitchenStore((s) => s.removeGroceryItem)
  const addToGroceryList = useKitchenStore((s) => s.addToGroceryList)
  const [draft, setDraft] = useState('')

  const grouped = useMemo(() => {
    const map = new Map<string, typeof groceryList>()
    for (const item of groceryList) {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    return Array.from(map.entries())
  }, [groceryList])

  const estimatedTotal = groceryList
    .filter((g) => !g.checked)
    .reduce((sum, g) => sum + (g.estPrice ?? 0), 0)

  const addDraft = () => {
    if (!draft.trim()) return
    addToGroceryList({
      name: draft.trim(),
      emoji: '🛒',
      category: 'Other',
      reason: 'Added manually',
    })
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <PageHeader
        title="Grocery List"
        subtitle={`Est. ${estimatedTotal > 0 ? `$${estimatedTotal.toFixed(2)}` : 'nothing needed'}`}
      />

      <div className="flex gap-2 px-5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addDraft()}
          placeholder="Add an item…"
          className="flex-1 rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-clay"
        />
        <button
          onClick={addDraft}
          className="rounded-xl bg-clay px-4 text-lg font-bold text-white"
          aria-label="Add item"
        >
          +
        </button>
      </div>

      {grouped.length === 0 && (
        <p className="px-5 text-sm text-ink/50">Your list is empty. Nice work.</p>
      )}

      {grouped.map(([category, list]) => (
        <div key={category} className="flex flex-col gap-2 px-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink/40">{category}</h2>
          <div className="flex flex-col gap-1.5">
            {list.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-4 py-2.5 shadow-soft"
              >
                <button
                  onClick={() => toggleGroceryChecked(item.id)}
                  aria-label={`Toggle ${item.name}`}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold ${
                    item.checked ? 'border-leaf bg-leaf text-white' : 'border-ink/20 text-transparent'
                  }`}
                >
                  ✓
                </button>
                <span className="text-lg">{item.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-semibold ${item.checked ? 'text-ink/30 line-through' : 'text-ink'}`}
                  >
                    {item.name}
                  </p>
                  <p className="truncate text-xs text-ink/50">{item.reason}</p>
                </div>
                {item.estPrice != null && (
                  <span className="text-xs font-semibold text-ink/40">${item.estPrice.toFixed(2)}</span>
                )}
                <button
                  onClick={() => removeGroceryItem(item.id)}
                  aria-label={`Remove ${item.name}`}
                  className="text-ink/30 hover:text-clay"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
