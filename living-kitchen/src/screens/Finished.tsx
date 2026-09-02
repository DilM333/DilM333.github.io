import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { findItem, itemDisplayAmount } from '../lib/kitchen'
import { suggestDeduction } from '../lib/deduction'
import { useKitchenStore, type KitchenDeduction } from '../store/useKitchenStore'
import type { StapleLevel } from '../data/types'

const FRACTION_STEPS = [0, 0.25, 0.5, 0.75, 1]
const LEVEL_STEPS: StapleLevel[] = ['out', 'low', 'some', 'plenty']

export default function Finished() {
  const { id } = useParams()
  const navigate = useNavigate()
  const recipe = useKitchenStore((s) => s.recipes.find((r) => r.id === id))
  const items = useKitchenStore((s) => s.items)
  const cookingSession = useKitchenStore((s) => s.cookingSession)
  const finishCooking = useKitchenStore((s) => s.finishCooking)

  const trackable = useMemo(
    () => (recipe ? recipe.ingredients.filter((i) => i.itemId && findItem(items, i.itemId)) : []),
    [recipe, items],
  )

  const initialDeductions = useMemo(() => {
    const map: Record<string, KitchenDeduction> = {}
    trackable.forEach((ing) => {
      const item = findItem(items, ing.itemId)!
      const used = cookingSession?.actualUsage[ing.itemId!]
      map[item.id] = suggestDeduction(item, used ?? 1)
    })
    return map
  }, [trackable, items, cookingSession])

  const [deductions, setDeductions] = useState(initialDeductions)

  if (!recipe) return null

  const adjust = (itemId: string, patch: Partial<KitchenDeduction>) =>
    setDeductions((d) => ({ ...d, [itemId]: { ...d[itemId], ...patch } }))

  const confirm = () => {
    finishCooking(Object.values(deductions))
    navigate('/kitchen')
  }

  return (
    <div className="flex flex-col gap-5 pb-28">
      <PageHeader title="Finished ✓" subtitle="Update your kitchen?" />

      <div className="flex flex-col gap-2 px-5">
        {trackable.map((ing) => {
          const item = findItem(items, ing.itemId)!
          const deduction = deductions[item.id]
          const before = itemDisplayAmount(item)
          const after = itemDisplayAmount({
            ...item,
            count: deduction.newCount ?? item.count,
            fraction: deduction.newFraction ?? item.fraction,
            fill: deduction.newFill ?? item.fill,
            level: deduction.newLevel ?? item.level,
          })

          return (
            <div
              key={ing.id}
              className="flex items-center gap-3 rounded-xl2 border border-ink/10 bg-white px-4 py-3 shadow-soft"
            >
              <span className="text-xl">{ing.emoji}</span>
              <span className="flex-1 text-sm font-semibold">{ing.name}</span>
              <span className="text-sm text-ink/50">{before}</span>
              <span className="text-ink/30">→</span>
              <span className="text-sm font-bold text-leaf">{after}</span>

              {item.stockType === 'countable' && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      adjust(item.id, { newCount: Math.max(0, (deduction.newCount ?? 0) - 1) })
                    }
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/5 text-xs"
                  >
                    −
                  </button>
                  <button
                    onClick={() => adjust(item.id, { newCount: (deduction.newCount ?? 0) + 1 })}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/5 text-xs"
                  >
                    +
                  </button>
                </div>
              )}
              {item.stockType === 'divisible' && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const idx = FRACTION_STEPS.indexOf(deduction.newFraction ?? 0)
                      adjust(item.id, { newFraction: FRACTION_STEPS[Math.max(0, idx - 1)] })
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/5 text-xs"
                  >
                    −
                  </button>
                  <button
                    onClick={() => {
                      const idx = FRACTION_STEPS.indexOf(deduction.newFraction ?? 0)
                      adjust(item.id, {
                        newFraction: FRACTION_STEPS[Math.min(FRACTION_STEPS.length - 1, idx + 1)],
                      })
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/5 text-xs"
                  >
                    +
                  </button>
                </div>
              )}
              {item.stockType === 'container' && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      adjust(item.id, { newFill: Math.max(0, (deduction.newFill ?? 0) - 0.1) })
                    }
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/5 text-xs"
                  >
                    −
                  </button>
                  <button
                    onClick={() =>
                      adjust(item.id, { newFill: Math.min(1, (deduction.newFill ?? 0) + 0.1) })
                    }
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/5 text-xs"
                  >
                    +
                  </button>
                </div>
              )}
              {item.stockType === 'staple' && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const idx = LEVEL_STEPS.indexOf(deduction.newLevel ?? 'out')
                      adjust(item.id, { newLevel: LEVEL_STEPS[Math.max(0, idx - 1)] })
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/5 text-xs"
                  >
                    −
                  </button>
                  <button
                    onClick={() => {
                      const idx = LEVEL_STEPS.indexOf(deduction.newLevel ?? 'out')
                      adjust(item.id, {
                        newLevel: LEVEL_STEPS[Math.min(LEVEL_STEPS.length - 1, idx + 1)],
                      })
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/5 text-xs"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 bg-cream/95 p-5 backdrop-blur">
        <button
          onClick={confirm}
          className="w-full rounded-xl2 bg-leaf py-3.5 text-center text-base font-bold text-white shadow-card"
        >
          Confirm
        </button>
      </div>
    </div>
  )
}
