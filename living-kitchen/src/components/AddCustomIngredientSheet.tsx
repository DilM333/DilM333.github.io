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
import { useKitchenStore } from '../store/useKitchenStore'
import StartingAmountPicker from './StartingAmountPicker'

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
            <StartingAmountPicker
              stockType={stockType}
              value={{ count, fraction, fill, level }}
              onChange={(patch) => {
                if (patch.count !== undefined) setCount(patch.count)
                if (patch.fraction !== undefined) setFraction(patch.fraction)
                if (patch.fill !== undefined) setFill(patch.fill)
                if (patch.level !== undefined) setLevel(patch.level)
              }}
            />
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
