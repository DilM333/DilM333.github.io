import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKitchenStore } from '../store/useKitchenStore'
import type { Person } from '../data/types'

const RESTRICTIONS = ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Nut allergy']
const PREFERENCES = ['Lighter food', 'Mediterranean', 'Comfort food', 'Not very spicy', 'Quick meals']

function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? 'border-clay bg-clay text-white'
          : 'border-ink/15 bg-white text-ink/70 hover:border-ink/30'
      }`}
    >
      {label}
    </button>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const completeOnboarding = useKitchenStore((s) => s.completeOnboarding)
  const [name, setName] = useState('You')
  const [restrictions, setRestrictions] = useState<string[]>([])
  const [preferences, setPreferences] = useState<string[]>(['Lighter food', 'Mediterranean'])
  const [people, setPeople] = useState<Person[]>([])

  const toggle = (list: string[], set: (v: string[]) => void, value: string) => {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  const addPerson = () => {
    if (!name.trim()) return
    setPeople((p) => [
      ...p,
      { id: `${name}-${p.length}`, name: name.trim(), restrictions, dislikes: [], preferences },
    ])
    setName('')
    setRestrictions([])
    setPreferences([])
  }

  const finish = () => {
    const finalPeople = people.length > 0 ? people : [{ id: 'you', name: 'You', restrictions, dislikes: [], preferences }]
    completeOnboarding(finalPeople)
    navigate('/kitchen')
  }

  return (
    <div className="flex flex-col gap-6 px-5 pb-10 pt-10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-clay">Living Kitchen</p>
        <h1 className="font-display text-3xl font-semibold text-ink">Who are we feeding?</h1>
        <p className="mt-2 text-ink/60">
          Know what you have. Know what you can make. Know what you need.
        </p>
      </div>

      {people.length > 0 && (
        <div className="flex flex-col gap-2">
          {people.map((p) => (
            <div key={p.id} className="rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm">
              <span className="font-semibold">{p.name}</span>
              {p.restrictions.length > 0 && (
                <span className="text-ink/60"> · {p.restrictions.join(', ')}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-xl2 border border-ink/10 bg-white p-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink/70">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add person"
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-clay"
          />
        </div>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink/70">Dietary restrictions</p>
          <div className="flex flex-wrap gap-2">
            {RESTRICTIONS.map((r) => (
              <Chip
                key={r}
                label={r}
                active={restrictions.includes(r)}
                onClick={() => toggle(restrictions, setRestrictions, r)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink/70">Preferences</p>
          <div className="flex flex-wrap gap-2">
            {PREFERENCES.map((r) => (
              <Chip
                key={r}
                label={r}
                active={preferences.includes(r)}
                onClick={() => toggle(preferences, setPreferences, r)}
              />
            ))}
          </div>
        </div>

        <button
          onClick={addPerson}
          className="self-start rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-semibold text-ink/70 hover:border-ink/30"
        >
          + Add person
        </button>
      </div>

      <button
        onClick={finish}
        className="mt-2 rounded-xl2 bg-clay py-3.5 text-center text-base font-bold text-white shadow-card transition hover:brightness-95"
      >
        Open my kitchen →
      </button>
    </div>
  )
}
