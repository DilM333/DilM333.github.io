import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import IngredientRow from '../components/IngredientRow'
import PageHeader from '../components/PageHeader'
import SectionHeader from '../components/SectionHeader'
import SyncErrorBanner from '../components/SyncErrorBanner'
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
  const kitchenSyncError = useKitchenStore((s) => s.kitchenSyncError)
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/household')}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/10 bg-white text-base text-ink/60 shadow-soft hover:border-clay/30 hover:text-clay"
              aria-label="Household settings"
            >
              ⚙️
            </button>
            <button
              onClick={() => navigate('/add')}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-clay text-lg text-white shadow-soft"
              aria-label="Add food"
            >
              +
            </button>
          </div>
        }
      />

      {kitchenSyncError && (
        <SyncErrorBanner
          title="Sync paused"
          message="You're seeing your kitchen saved on this device. It'll sync once Supabase is reachable again."
          hint={kitchenSyncError}
        />
      )}

      <div className="px-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ingredients…"
          className="w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-clay"
        />
      </div>

      {items.length === 0 ? (
        <div className="px-5">
          <EmptyState
            icon="🍽️"
            title="Your kitchen is empty"
            hint="Tap + to add the first thing you've got on hand."
          />
        </div>
      ) : (
        <>
          {useSoon.length > 0 && !query && (
            <div className="flex flex-col gap-2 px-5">
              <SectionHeader icon="⏳">
                <span className="text-butter">Use Soon</span>
              </SectionHeader>
              {/* A glanceable preview, not a duplicate of the full row below —
                  tapping jumps straight to it via search instead of repeating
                  every control twice. */}
              <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
                {useSoon.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setQuery(item.name)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-butter/40 bg-butter/10 px-3 py-1.5 text-xs font-semibold text-[#8a6113]"
                  >
                    <span className="text-sm">{item.emoji}</span>
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {SECTIONS.map((section) => {
            const sectionItems = filtered.filter((i) => i.location === section.key)
            if (sectionItems.length === 0) return null
            return (
              <div key={section.key} className="flex flex-col gap-2 px-5">
                <SectionHeader icon={section.icon}>{section.label}</SectionHeader>
                <div className="flex flex-col gap-2">
                  {sectionItems.map((item) => (
                    <IngredientRow key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="px-5">
              <EmptyState icon="🔎" title={`No ingredients match "${query}"`} hint="Check the spelling, or add it from Add Food." />
            </div>
          )}
        </>
      )}
    </div>
  )
}
