import { useMemo, useState } from 'react'
import { searchCatalog, type CatalogEntry } from '../data/catalog'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import SectionHeader from '../components/SectionHeader'
import SkeletonRows from '../components/SkeletonRows'
import SyncErrorBanner from '../components/SyncErrorBanner'
import { groceryItemForCatalogEntry, groceryItemForName, kitchenStockForEntry } from '../lib/grocery'
import { useKitchenStore } from '../store/useKitchenStore'

const MAX_SUGGESTIONS = 5

export default function GroceryList() {
  const groceryList = useKitchenStore((s) => s.groceryList)
  const groceryLoading = useKitchenStore((s) => s.groceryLoading)
  const groceryListSyncError = useKitchenStore((s) => s.groceryListSyncError)
  const items = useKitchenStore((s) => s.items)
  const customCatalog = useKitchenStore((s) => s.customCatalog)
  const toggleGroceryChecked = useKitchenStore((s) => s.toggleGroceryChecked)
  const removeGroceryItem = useKitchenStore((s) => s.removeGroceryItem)
  const addToGroceryList = useKitchenStore((s) => s.addToGroceryList)
  const [draft, setDraft] = useState('')

  const trimmedDraft = draft.trim()
  // Lightweight — a handful of catalog matches as you type, not a full
  // search screen. The plain text field beneath is still how arbitrary,
  // non-ingredient items ("paper towels") get added; this is purely an
  // optional shortcut for ingredients the catalog already knows.
  const suggestions = useMemo(
    () => (trimmedDraft ? searchCatalog(trimmedDraft, customCatalog).slice(0, MAX_SUGGESTIONS) : []),
    [trimmedDraft, customCatalog],
  )

  const addCatalogEntry = (entry: CatalogEntry) => {
    addToGroceryList(groceryItemForCatalogEntry(entry, 'Added manually'))
    setDraft('')
  }

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
    addToGroceryList(groceryItemForName(draft, 'Added manually', customCatalog))
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <PageHeader
        title="Grocery List"
        subtitle={`Est. ${estimatedTotal > 0 ? `$${estimatedTotal.toFixed(2)}` : 'nothing needed'}`}
      />

      {groceryListSyncError && (
        <SyncErrorBanner
          title="Sync paused"
          message="You're seeing your list saved on this device. It'll sync once Supabase is reachable again."
          hint={groceryListSyncError}
        />
      )}

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

      {suggestions.length > 0 && (
        <div className="-mt-3 flex flex-col gap-1.5 px-5">
          {suggestions.map(({ entry, matchedAlias }) => {
            const stock = kitchenStockForEntry(entry, items)
            return (
              <button
                key={entry.id}
                onClick={() => addCatalogEntry(entry)}
                className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-3 py-2 text-left shadow-soft hover:border-clay/40"
              >
                <span className="text-lg">{entry.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{entry.name}</span>
                  {matchedAlias && (
                    <span className="block truncate text-xs text-ink/40">also called {matchedAlias}</span>
                  )}
                  {stock && (
                    <span className="block truncate text-xs text-ink/45">In kitchen · {stock.display}</span>
                  )}
                </span>
                <span className="shrink-0 text-sm font-bold text-clay">+</span>
              </button>
            )
          })}
        </div>
      )}

      {groceryLoading ? (
        <div className="px-5">
          <SkeletonRows count={3} />
        </div>
      ) : (
        <>
          {grouped.length === 0 && (
            <div className="px-5">
              <EmptyState icon="📝" title="Your list is empty" hint="Nice work — nothing to shop for right now." />
            </div>
          )}

          {grouped.map(([category, list]) => (
            <div key={category} className="flex flex-col gap-2 px-5">
              <SectionHeader>{category}</SectionHeader>
              <div className="flex flex-col gap-1.5">
                {list.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 rounded-xl2 border px-4 py-2.5 shadow-soft transition-colors ${
                      item.checked ? 'border-ink/5 bg-ink/[0.02]' : 'border-ink/10 bg-white'
                    }`}
                  >
                    <button
                      onClick={() => toggleGroceryChecked(item.id)}
                      aria-label={`Mark ${item.name} as ${item.checked ? 'not gotten' : 'gotten'}`}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition ${
                        item.checked ? 'border-leaf bg-leaf text-white' : 'border-ink/20 text-transparent'
                      }`}
                    >
                      ✓
                    </button>
                    <span className={`text-lg ${item.checked ? 'opacity-40' : ''}`}>{item.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-semibold ${item.checked ? 'text-ink/30 line-through' : 'text-ink'}`}
                      >
                        {item.name}
                      </p>
                      {item.reason && (
                        <p className="truncate text-xs text-ink/45">{item.reason}</p>
                      )}
                    </div>
                    {item.estPrice != null && (
                      <span className="text-xs font-semibold text-ink/40">${item.estPrice.toFixed(2)}</span>
                    )}
                    <button
                      onClick={() => removeGroceryItem(item.id)}
                      aria-label={`Remove ${item.name} from list`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg text-ink/30 hover:bg-clay/10 hover:text-clay"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
