import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { findItem, itemDisplayAmount, stockLevel } from '../lib/kitchen'
import { groceryItemForKitchenItem } from '../lib/grocery'
import { suggestDeduction } from '../lib/deduction'
import { useKitchenStore, type KitchenDeduction } from '../store/useKitchenStore'
import type { KitchenItem, StapleLevel } from '../data/types'

const LEVEL_STEPS: StapleLevel[] = ['out', 'low', 'some', 'plenty']

const quarterStep = (value: number, delta: number) =>
  Math.max(0, Math.round((value + delta) * 4) / 4)

export default function Finished() {
  const { id } = useParams()
  const navigate = useNavigate()
  const recipe = useKitchenStore((s) => s.recipes.find((r) => r.id === id))
  const items = useKitchenStore((s) => s.items)
  const cookingSession = useKitchenStore((s) => s.cookingSession)
  const finishCooking = useKitchenStore((s) => s.finishCooking)
  const groceryList = useKitchenStore((s) => s.groceryList)
  const addToGroceryList = useKitchenStore((s) => s.addToGroceryList)

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

  const afterItem = (item: KitchenItem): KitchenItem => {
    const d = deductions[item.id]
    return {
      ...item,
      count: d.newCount ?? item.count,
      fraction: d.newFraction ?? item.fraction,
      fill: d.newFill ?? item.fill,
      level: d.newLevel ?? item.level,
    }
  }

  const onList = (name: string) => groceryList.some((g) => g.name === name)

  const lowAfter = trackable
    .map((ing) => findItem(items, ing.itemId)!)
    .filter((item) => stockLevel(afterItem(item)) !== 'ok')

  const toAdd = lowAfter.filter((item) => !onList(item.name))

  const addItem = (item: KitchenItem) =>
    addToGroceryList(
      groceryItemForKitchenItem(item, `Ran ${stockLevel(afterItem(item))} after ${recipe.name}`),
    )

  const confirm = () => {
    finishCooking(Object.values(deductions))
    navigate('/kitchen')
  }

  return (
    <div className="flex min-h-full flex-col gap-5 pb-4">
      <PageHeader title="Finished ✓" subtitle="Update your kitchen?" back />

      <div className="flex flex-col gap-2 px-5">
        {trackable.map((ing) => {
          const item = findItem(items, ing.itemId)!
          const deduction = deductions[item.id]
          const before = itemDisplayAmount(item)
          const next = afterItem(item)
          const after = itemDisplayAmount(next)
          const level = stockLevel(next)

          return (
            <div
              key={ing.id}
              className="overflow-hidden rounded-xl2 border border-ink/10 bg-white shadow-soft"
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl">{ing.emoji}</span>
                <span className="flex-1 text-sm font-semibold">{ing.name}</span>
                <span className="text-sm text-ink/50">{before}</span>
                <span className="text-ink/30">→</span>
                <span
                  className={`text-sm font-bold ${
                    level === 'out' ? 'text-clay' : level === 'low' ? 'text-[#8a6113]' : 'text-leaf'
                  }`}
                >
                  {after}
                </span>

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
                      onClick={() =>
                        adjust(item.id, { newFraction: quarterStep(deduction.newFraction ?? 0, -0.25) })
                      }
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/5 text-xs"
                    >
                      −
                    </button>
                    <button
                      onClick={() =>
                        adjust(item.id, { newFraction: quarterStep(deduction.newFraction ?? 0, 0.25) })
                      }
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

              {level !== 'ok' && (
                <div
                  className={`flex items-center justify-between gap-2 border-t px-4 py-2 ${
                    level === 'out'
                      ? 'border-clay/15 bg-clay/5'
                      : 'border-butter/20 bg-butter/10'
                  }`}
                >
                  <span
                    className={`text-xs font-bold ${level === 'out' ? 'text-clay' : 'text-[#8a6113]'}`}
                  >
                    {level === 'out' ? '❌ Out now' : '⚠️ Running low'}
                  </span>
                  {onList(item.name) ? (
                    <span className="text-xs font-semibold text-leaf">✓ On grocery list</span>
                  ) : (
                    <button
                      onClick={() => addItem(item)}
                      className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-cream"
                    >
                      + Add to list
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="sticky bottom-0 z-10 mt-auto flex flex-col gap-2 bg-cream/95 p-5 backdrop-blur">
        {toAdd.length > 0 && (
          <button
            onClick={() => toAdd.forEach(addItem)}
            className="w-full rounded-xl2 border border-ink/20 py-3 text-center text-sm font-bold text-ink/80"
          >
            + Add {toAdd.length} low item{toAdd.length === 1 ? '' : 's'} to grocery list
          </button>
        )}
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
