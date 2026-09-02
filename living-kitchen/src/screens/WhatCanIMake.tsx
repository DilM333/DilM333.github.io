import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import RecipeCard from '../components/RecipeCard'
import type { Effort } from '../data/types'
import { computeFeasibility } from '../lib/kitchen'
import { useKitchenStore } from '../store/useKitchenStore'

const MOODS = [
  { key: 'quick', label: 'Quick' },
  { key: 'light', label: 'Healthy' },
  { key: 'comforting', label: 'Comforting' },
  { key: 'light', label: 'Light' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'cheap', label: 'Cheap' },
  { key: 'use-leftovers', label: 'Use leftovers' },
]

const TIME_OPTIONS = [
  { key: 15, label: '<15m' },
  { key: 30, label: '<30m' },
  { key: 45, label: '<45m' },
  { key: null, label: "Doesn't matter" },
]

const EFFORT_OPTIONS: { key: Effort | null; label: string }[] = [
  { key: 'Bare minimum', label: 'Bare minimum' },
  { key: 'Normal', label: 'Normal' },
  { key: 'I want to cook', label: 'I want to cook' },
  { key: null, label: "Doesn't matter" },
]

const FEASIBILITY_ORDER = ['ready', 'ready-adjusted', 'almost', 'one-away', 'needs-shopping']

export default function WhatCanIMake() {
  const items = useKitchenStore((s) => s.items)
  const recipes = useKitchenStore((s) => s.recipes)
  const [moods, setMoods] = useState<string[]>([])
  const [time, setTime] = useState<number | null>(null)
  const [effort, setEffort] = useState<Effort | null>(null)
  const [hideRed, setHideRed] = useState(false)

  const toggleMood = (key: string) =>
    setMoods((m) => (m.includes(key) ? m.filter((x) => x !== key) : [...m, key]))

  const cards = useMemo(() => {
    let list = recipes
    if (moods.length > 0) list = list.filter((r) => moods.every((m) => r.tags.includes(m)))
    if (time) list = list.filter((r) => r.time <= time)
    if (effort) list = list.filter((r) => r.effort === effort)

    const withStatus = list.map((r) => ({ recipe: r, status: computeFeasibility(r, items).status }))
    const filtered = hideRed ? withStatus.filter((c) => c.status !== 'needs-shopping') : withStatus

    return filtered.sort(
      (a, b) => FEASIBILITY_ORDER.indexOf(a.status) - FEASIBILITY_ORDER.indexOf(b.status),
    )
  }, [recipes, items, moods, time, effort, hideRed])

  return (
    <div className="flex flex-col gap-5 pb-6">
      <PageHeader title="What can I make?" subtitle="Tonight I'm feeling…" />

      <div className="flex flex-wrap gap-2 px-5">
        {MOODS.map((m) => (
          <button
            key={m.label}
            onClick={() => toggleMood(m.key)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              moods.includes(m.key)
                ? 'border-leaf bg-leaf text-white'
                : 'border-ink/15 bg-white text-ink/70'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 px-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink/40">Time</p>
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.map((t) => (
            <button
              key={t.label}
              onClick={() => setTime(t.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                time === t.key ? 'border-clay bg-clay text-white' : 'border-ink/15 bg-white text-ink/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 px-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink/40">Effort</p>
        <div className="flex flex-wrap gap-2">
          {EFFORT_OPTIONS.map((e) => (
            <button
              key={e.label}
              onClick={() => setEffort(e.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                effort === e.key ? 'border-clay bg-clay text-white' : 'border-ink/15 bg-white text-ink/60'
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink/40">
          {cards.length} recipe{cards.length === 1 ? '' : 's'}
        </p>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-ink/60">
          <input
            type="checkbox"
            checked={hideRed}
            onChange={(e) => setHideRed(e.target.checked)}
            className="accent-clay"
          />
          Hide what I can't make
        </label>
      </div>

      <div className="flex flex-col gap-3 px-5">
        {cards.map(({ recipe }) => (
          <RecipeCard key={recipe.id} recipe={recipe} items={items} />
        ))}
        {cards.length === 0 && (
          <p className="text-sm text-ink/50">No recipes match these filters yet.</p>
        )}
      </div>
    </div>
  )
}
