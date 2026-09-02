import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { catalog, catalogCategories, toKitchenItem, type CatalogEntry } from '../data/catalog'
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
  const [mode, setMode] = useState<Mode>('search')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [scanned, setScanned] = useState(false)

  const results = useMemo(() => {
    let list = catalog
    if (category) list = list.filter((c) => c.category === category)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((c) => c.name.toLowerCase().includes(q))
    }
    return list
  }, [category, query])

  const handleAdd = (entry: CatalogEntry) => {
    addKitchenItem(toKitchenItem(entry))
    setToast(entry.name)
    window.setTimeout(() => setToast(null), 1400)
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <PageHeader title="Add Food" subtitle="Add to your kitchen" back />

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
            {results.map((entry) => (
              <button
                key={entry.id}
                onClick={() => handleAdd(entry)}
                className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-left shadow-soft hover:border-clay/40"
              >
                <span className="text-xl">{entry.emoji}</span>
                <span className="flex-1 text-sm font-semibold">{entry.name}</span>
                <span className="text-lg text-clay">+</span>
              </button>
            ))}
            {query && results.length === 0 && (
              <p className="text-sm text-ink/50">No matches for "{query}".</p>
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
            {results.map((entry) => (
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
                Correcting an item teaches Living Kitchen how your store describes products.
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
    </div>
  )
}
