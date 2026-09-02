import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import IngredientRow from '../components/IngredientRow'
import PageHeader from '../components/PageHeader'
import { isUseSoon } from '../lib/kitchen'
import { useKitchenStore } from '../store/useKitchenStore'
import type { Location } from '../data/types'

const SECTIONS: { key: Location; label: string; icon: string }[] = [
  { key: 'herbs', label: 'Herbs', icon: '🌿' },
  { key: 'fridge', label: 'Fridge', icon: '🧊' },
  { key: 'freezer', label: 'Freezer', icon: '❄️' },
  { key: 'pantry', label: 'Pantry', icon: '🥫' },
]

export default function Kitchen() {
  const items = useKitchenStore((s) => s.items)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter((i) => i.name.toLowerCase().includes(q))
  }, [items, query])

  const useSoon = filtered.filter(isUseSoon)

  return (
    <div className="flex flex-col gap-6 pb-6">
      <PageHeader
        title="My Kitchen"
        subtitle="Know what you have."
        right={
          <button
            onClick={() => navigate('/add')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-clay text-lg text-white shadow-soft"
            aria-label="Add food"
          >
            +
          </button>
        }
      />

      <div className="px-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ingredients…"
          className="w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-clay"
        />
      </div>

      {useSoon.length > 0 && !query && (
        <div className="flex flex-col gap-2 px-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-butter">Use Soon</h2>
          <div className="flex flex-col gap-2">
            {useSoon.map((item) => (
              <IngredientRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {SECTIONS.map((section) => {
        const sectionItems = filtered.filter((i) => i.location === section.key)
        if (sectionItems.length === 0) return null
        return (
          <div key={section.key} className="flex flex-col gap-2 px-5">
            <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-ink/50">
              <span>{section.icon}</span>
              {section.label}
            </h2>
            <div className="flex flex-col gap-2">
              {sectionItems.map((item) => (
                <IngredientRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <p className="px-5 text-sm text-ink/50">No ingredients match "{query}".</p>
      )}
    </div>
  )
}
