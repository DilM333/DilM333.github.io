import { useState } from 'react'
import {
  CUSTOM_CATEGORIES,
  CUSTOM_LOCATIONS,
  STOCK_TYPE_OPTIONS,
  defaultLocationForCategory,
  defaultStockTypeForCategory,
  guessEmoji,
  makeCustomCatalogEntry,
  toKitchenItem,
  type StartingAmount,
} from '../data/catalog'
import type { Location, StapleLevel, StockType } from '../data/types'
import { fillLabel, fractionLabel, levelLabel } from '../lib/kitchen'
import { useKitchenStore } from '../store/useKitchenStore'

const FRACTIONS = [0, 0.25, 0.5, 0.75, 1]
const LEVELS: StapleLevel[] = ['plenty', 'some', 'low', 'out']

export default function AddCustomIngredientSheet({
  initialName,
  onClose,
  onAdded,
}: {
  initialName: string
  onClose: () => void
  onAdded: (name: string) => void
}) {
  const addCustomCatalogEntry = useKitchenStore((s) => s.addCustomCatalogEntry)
  const addKitchenItem = useKitchenStore((s) => s.addKitchenItem)

  const [name, setName] = useState(initialName.trim())
  const [category, setCategory] = useState('Produce')
  const [location, setLocation] = useState<Location>(defaultLocationForCategory('Produce'))
  const [stockType, setStockType] = useState<StockType>(defaultStockTypeForCategory('Produce'))
  // once the user picks these by hand, changing category stops overriding them
  const [locationTouched, setLocationTouched] = useState(false)
  const [stockTypeTouched, setStockTypeTouched] = useState(false)

  const [count, setCount] = useState(1)
  const [fraction, setFraction] = useState(1)
  const [fill, setFill] = useState(1)
  const [level, setLevel] = useState<StapleLevel>('plenty')
  const [price, setPrice] = useState('')

  const emoji = guessEmoji(name || initialName, category)

  const pickCategory = (c: string) => {
    setCategory(c)
    if (!locationTouched) setLocation(defaultLocationForCategory(c))
    if (!stockTypeTouched) setStockType(defaultStockTypeForCategory(c))
  }

  const startingAmount = (): StartingAmount => {
    switch (stockType) {
      case 'countable':
        return { count: Math.max(0, Math.round(count)) }
      case 'divisible':
        return { fraction }
      case 'container':
        return { fill }
      case 'staple':
        return { level }
      default:
        return {}
    }
  }

  const canSave = name.trim().length > 0

  const save = () => {
    if (!canSave) return
    const parsedPrice = parseFloat(price)
    const entry = makeCustomCatalogEntry({
      name,
      category,
      location,
      stockType,
      estPrice: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined,
    })
    addCustomCatalogEntry(entry)
    addKitchenItem(toKitchenItem(entry, startingAmount()))
    onAdded(entry.name)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-xl2 bg-cream p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" />

        <div className="flex items-center gap-2">
          <span className="text-2xl">{emoji}</span>
          <h2 className="font-display text-lg font-semibold">Add a new ingredient</h2>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label htmlFor="custom-ingredient-name" className="mb-1 block text-xs font-semibold text-ink/50">
              Ingredient name
            </label>
            <input
              id="custom-ingredient-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Asparagus"
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-clay"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink/50">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CUSTOM_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => pickCategory(c)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    category === c
                      ? 'border-clay bg-clay text-white'
                      : 'border-ink/15 bg-white text-ink/70'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink/50">Storage location</label>
            <div className="flex flex-wrap gap-1.5">
              {CUSTOM_LOCATIONS.map((l) => (
                <button
                  key={l.key}
                  onClick={() => {
                    setLocation(l.key)
                    setLocationTouched(true)
                  }}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    location === l.key
                      ? 'border-clay bg-clay text-white'
                      : 'border-ink/15 bg-white text-ink/70'
                  }`}
                >
                  {l.icon} {l.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink/50">
              How do you want to track it?
            </label>
            <div className="flex flex-col gap-1.5">
              {STOCK_TYPE_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => {
                    setStockType(o.key)
                    setStockTypeTouched(true)
                  }}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                    stockType === o.key
                      ? 'border-clay bg-clay/10 text-ink'
                      : 'border-ink/15 bg-white text-ink/70'
                  }`}
                >
                  <span className="font-semibold">{o.label}</span>
                  <span className="text-xs text-ink/45">{o.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink/50">
              How much do you have now?
            </label>

            {stockType === 'countable' && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCount((c) => Math.max(0, c - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/70"
                  aria-label="Decrease"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-bold tabular-nums">{count}</span>
                <button
                  onClick={() => setCount((c) => c + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/70"
                  aria-label="Increase"
                >
                  +
                </button>
              </div>
            )}

            {stockType === 'divisible' && (
              <div className="flex items-center gap-1.5">
                {FRACTIONS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFraction(f)}
                    className={`rounded-md px-2 py-1 text-xs font-bold ${
                      fraction === f ? 'bg-leaf text-white' : 'bg-ink/5 text-ink/60'
                    }`}
                  >
                    {fractionLabel(f)}
                  </button>
                ))}
              </div>
            )}

            {stockType === 'container' && (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={fill * 100}
                  onChange={(e) => setFill(Number(e.target.value) / 100)}
                  className="flex-1 accent-leaf"
                />
                <span className="w-16 text-right text-xs text-ink/50">{fillLabel(fill)}</span>
              </div>
            )}

            {stockType === 'staple' && (
              <div className="flex items-center gap-1.5">
                {LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLevel(lvl)}
                    className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase ${
                      level === lvl ? 'bg-leaf text-white' : 'bg-ink/5 text-ink/60'
                    }`}
                  >
                    {levelLabel(lvl)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="custom-ingredient-price" className="mb-1 block text-xs font-semibold text-ink/50">
              Estimated price (optional)
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-ink/50">$</span>
              <input
                id="custom-ingredient-price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="2.99"
                className="w-24 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-clay"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-ink/15 py-2.5 text-sm font-semibold text-ink/70"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!canSave}
            className="flex-1 rounded-xl bg-clay py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Add to kitchen
          </button>
        </div>
      </div>
    </div>
  )
}
