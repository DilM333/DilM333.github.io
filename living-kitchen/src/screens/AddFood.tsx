import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AddCustomIngredientSheet from '../components/AddCustomIngredientSheet'
import PageHeader from '../components/PageHeader'
import SyncErrorBanner from '../components/SyncErrorBanner'
import { catalog, catalogCategories, searchCatalog, toKitchenItem, type CatalogEntry } from '../data/catalog'
import { useKitchenStore } from '../store/useKitchenStore'

type Mode = 'search' | 'browse' | 'receipt'

const RECEIPT_RESULTS = [
  { label: 'Eggs', emoji: '🥚', ok: true },
  { label: 'Milk', emoji: '🥛', ok: true },
  { label: 'Chicken breast', emoji: '🍗', ok: true },
  { label: 'Potatoes', emoji: '🥔', ok: true },
  { label: 'Carrots', emoji: '🥕', ok: true },
  { label: 'GRN ON → Green onions?', emoji: '🌱', ok: false },
  { label: 'VEG MX → Mixed vegetables?', emoji: '🥗', ok: false },
]

function AddedToast({ name }: { name: string }) {
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-cream shadow-card">
      Added {name} ✓
    </div>
  )
}

export default function AddFood() {
  const navigate = useNavigate()
  const addKitchenItem = useKitchenStore((s) => s.addKitchenItem)
  const customCatalog = useKitchenStore((s) => s.customCatalog)
  const customIngredientsSyncError = useKitchenStore((s) => s.customIngredientsSyncError)
  const [mode, setMode] = useState<Mode>('search')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [scanned, setScanned] = useState(false)
  const [customSheet, setCustomSheet] = useState(false)

  // Alias/plural/punctuation-tolerant search (see data/catalog.ts) so a
  // synonym like "scallion" or "garbanzo beans" resolves to the one
  // canonical entry instead of coming up empty and prompting a duplicate
  // custom ingredient. Ranked so an exact canonical name always wins over
  // an alias match, which in turn wins over a loose partial match.
  const results = useMemo(() => {
    const scored = searchCatalog(query, customCatalog)
    return category ? scored.filter((r) => r.entry.category === category) : scored
  }, [query, customCatalog, category])

  const trimmedQuery = query.trim()
  // Only fall back to "create a custom ingredient" when nothing — not even
  // an alias or a loose partial match — already covers this ingredient.
  const showCreate = trimmedQuery.length > 0 && results.length === 0

  const handleAdd = (entry: CatalogEntry) => {
    addKitchenItem(toKitchenItem(entry))
    setToast(entry.name)
    window.setTimeout(() => setToast(null), 1400)
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <PageHeader title="Add Food" subtitle="Add to your kitchen" back />

      {customIngredientsSyncError && (
        <SyncErrorBanner
          title="Sync paused"
          message="Custom ingredients you've added on this device are safe. They'll sync once Supabase is reachable again."
          hint={customIngredientsSyncError}
        />
      )}

      <div className="flex gap-2 px-5">
        {(
          [
            ['search', 'Quick Add'],
            ['browse', 'Browse'],
            ['receipt', 'Scan Receipt'],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-bold ${
              mode === m ? 'bg-ink text-cream' : 'bg-white text-ink/60 border border-ink/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'search' && (
        <div className="flex flex-col gap-3 px-5">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search groceries…"
            className="w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-clay"
          />
          <div className="flex flex-col gap-2">
            {results.map(({ entry, matchedAlias }) => (
              <button
                key={entry.id}
                onClick={() => handleAdd(entry)}
                className="flex items-center gap-3 rounded-xl2 border border-ink/10 bg-white px-4 py-2.5 text-left shadow-soft hover:border-clay/40"
              >
                <span className="text-xl">{entry.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{entry.name}</span>
                  {matchedAlias && (
                    <span className="block truncate text-xs text-ink/40">also called {matchedAlias}</span>
                  )}
                </span>
                {entry.custom && <span className="shrink-0 text-xs font-medium text-ink/35">yours</span>}
                <span className="shrink-0 text-lg text-clay">+</span>
              </button>
            ))}

            {results.length === 0 && trimmedQuery.length > 0 && (
              <p className="px-1 py-2 text-sm text-ink/45">No matches for "{trimmedQuery}".</p>
            )}

            {showCreate && (
              <div className="mt-1 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink/35">
                  <span className="h-px flex-1 bg-ink/10" />
                  Not in the list?
                  <span className="h-px flex-1 bg-ink/10" />
                </div>
                <button
                  onClick={() => setCustomSheet(true)}
                  className="flex items-center gap-3 rounded-xl2 border border-dashed border-ink/20 bg-white px-4 py-2.5 text-left hover:border-clay/40"
                >
                  <span className="text-base text-ink/40">+</span>
                  <span className="flex-1 text-sm font-medium text-ink/60">
                    Create “{trimmedQuery}” as a custom ingredient
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'browse' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2 px-5">
            {catalogCategories.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategory(category === c.key ? null : c.key)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  category === c.key
                    ? 'border-clay bg-clay text-white'
                    : 'border-ink/15 bg-white text-ink/70'
                }`}
              >
                {c.icon} {c.key}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 px-5">
            {results.map(({ entry }) => (
              <button
                key={entry.id}
                onClick={() => handleAdd(entry)}
                className="flex flex-col items-center gap-1.5 rounded-xl2 border border-ink/10 bg-white py-4 text-center shadow-soft hover:border-clay/40"
              >
                <span className="text-3xl">{entry.emoji}</span>
                <span className="text-xs font-semibold leading-tight">{entry.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'receipt' && (
        <div className="flex flex-col gap-4 px-5">
          {!scanned ? (
            <button
              onClick={() => setScanned(true)}
              className="flex flex-col items-center gap-3 rounded-xl2 border-2 border-dashed border-ink/20 bg-white py-12 text-ink/50"
            >
              <span className="text-4xl">📷</span>
              <span className="text-sm font-semibold">Take photo of receipt</span>
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-ink/70">I found 14 groceries.</p>
              <div className="flex flex-col gap-2">
                {RECEIPT_RESULTS.map((r) => (
                  <div
                    key={r.label}
                    className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-4 py-2.5"
                  >
                    <span className="text-lg">{r.emoji}</span>
                    <span className="flex-1 text-sm font-medium">{r.label}</span>
                    <span className={r.ok ? 'text-leaf' : 'text-butter'}>{r.ok ? '✓' : '?'}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-ink/50">
                Correcting an item teaches Euko how your store describes products.
              </p>
              <button
                onClick={() => {
                  RECEIPT_RESULTS.filter((r) => r.ok).forEach((r) => {
                    const entry = catalog.find((c) => c.name === r.label)
                    if (entry) addKitchenItem(toKitchenItem(entry))
                  })
                  navigate('/kitchen')
                }}
                className="rounded-xl2 bg-clay py-3 text-center text-sm font-bold text-white shadow-card"
              >
                Confirm all
              </button>
            </div>
          )}
        </div>
      )}

      {toast && <AddedToast name={toast} />}

      {customSheet && (
        <AddCustomIngredientSheet
          initialName={trimmedQuery}
          onClose={() => setCustomSheet(false)}
          onAdded={(name) => {
            setToast(name)
            setQuery('')
            window.setTimeout(() => setToast(null), 1400)
          }}
        />
      )}
    </div>
  )
}
