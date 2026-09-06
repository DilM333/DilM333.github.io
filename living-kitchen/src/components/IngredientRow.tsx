import { useState } from 'react'
import type { KitchenItem, StapleLevel } from '../data/types'
import { fracPartOf, fractionLabel, isUseSoon, levelLabel, quarterGlyph, wholeOf } from '../lib/kitchen'
import { useKitchenStore } from '../store/useKitchenStore'
import ReserveSheet from './ReserveSheet'

const FRACTION_STEPS = [0, 0.25, 0.5, 0.75, 1]
const LEVELS: StapleLevel[] = ['plenty', 'some', 'low', 'out']

export default function IngredientRow({ item }: { item: KitchenItem }) {
  const updateCount = useKitchenStore((s) => s.updateCount)
  const updateFraction = useKitchenStore((s) => s.updateFraction)
  const updateFill = useKitchenStore((s) => s.updateFill)
  const updateLevel = useKitchenStore((s) => s.updateLevel)
  const removeKitchenItem = useKitchenStore((s) => s.removeKitchenItem)
  const [reserveOpen, setReserveOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const canReserve = item.stockType !== 'countable' || (item.count ?? 0) > 0
  const whole = wholeOf(item.fraction ?? 0)
  const setWhole = (nextWhole: number) => updateFraction(item.id, Math.max(0, nextWhole) + fracPartOf(item.fraction ?? 0))

  return (
    <div className="flex items-center gap-3 rounded-xl2 border border-ink/10 bg-white px-4 py-3 shadow-soft">
      <span className="text-2xl leading-none">{item.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <p className="truncate font-semibold text-ink">{item.name}</p>
          {isUseSoon(item) && (
            <span className="shrink-0 rounded-full bg-butter/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#8a6113]">
              Use soon
            </span>
          )}
        </div>
        {item.reserved ? (
          <p className="truncate text-xs text-berry">
            🛡 About {fractionLabel(item.reserved)} reserved{item.reservedFor ? ` for ${item.reservedFor}` : ''}
          </p>
        ) : (
          <p className="text-xs text-ink/50">{item.category}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {item.stockType === 'countable' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateCount(item.id, -1)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/5 text-ink/70 hover:bg-ink/10"
              aria-label={`Decrease ${item.name}`}
            >
              −
            </button>
            <span className="w-4 text-center text-sm font-bold tabular-nums">{item.count ?? 0}</span>
            <button
              onClick={() => updateCount(item.id, 1)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/5 text-ink/70 hover:bg-ink/10"
              aria-label={`Increase ${item.name}`}
            >
              +
            </button>
          </div>
        )}

        {item.stockType === 'divisible' && (
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setWhole(whole - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/5 text-ink/70 hover:bg-ink/10"
                aria-label={`Decrease ${item.name} by one`}
              >
                −
              </button>
              <span className="min-w-[2.5rem] text-center text-sm font-bold tabular-nums">
                {fractionLabel(item.fraction ?? 0)}
              </span>
              <button
                onClick={() => setWhole(whole + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/5 text-ink/70 hover:bg-ink/10"
                aria-label={`Increase ${item.name} by one`}
              >
                +
              </button>
            </div>
            <div className="flex items-center gap-1">
              {FRACTION_STEPS.map((f) => (
                <button
                  key={f}
                  onClick={() => updateFraction(item.id, whole + f)}
                  aria-label={`Set ${item.name} remainder to ${quarterGlyph(f)}`}
                  className={`rounded-md px-1.5 py-1 text-xs font-bold ${
                    fracPartOf(item.fraction ?? 0) === f ? 'bg-leaf text-white' : 'bg-ink/5 text-ink/60'
                  }`}
                >
                  {quarterGlyph(f)}
                </button>
              ))}
            </div>
          </div>
        )}

        {item.stockType === 'container' && (
          <div className="flex w-28 flex-col items-center gap-1">
            <input
              type="range"
              min={0}
              max={100}
              value={(item.fill ?? 0) * 100}
              onChange={(e) => updateFill(item.id, Number(e.target.value) / 100)}
              className="w-full accent-leaf"
            />
          </div>
        )}

        {item.stockType === 'staple' && (
          <div className="flex items-center gap-1">
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                onClick={() => updateLevel(item.id, lvl)}
                className={`rounded-md px-1.5 py-1 text-[10px] font-bold uppercase ${
                  item.level === lvl ? 'bg-leaf text-white' : 'bg-ink/5 text-ink/60'
                }`}
              >
                {levelLabel(lvl)}
              </button>
            ))}
          </div>
        )}

        {canReserve && (
          <button
            onClick={() => setReserveOpen(true)}
            aria-label={`Reserve ${item.name}`}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink/40 hover:bg-ink/5 hover:text-berry"
          >
            🛡
          </button>
        )}

        {confirmRemove ? (
          <div className="flex items-center gap-1.5 whitespace-nowrap text-xs">
            <button onClick={() => removeKitchenItem(item.id)} className="font-bold text-clay">
              Remove
            </button>
            <button
              onClick={() => setConfirmRemove(false)}
              className="font-semibold text-ink/40"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmRemove(true)}
            aria-label={`Remove ${item.name} from kitchen`}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink/30 hover:bg-clay/10 hover:text-clay"
          >
            🗑
          </button>
        )}
      </div>

      {reserveOpen && <ReserveSheet item={item} onClose={() => setReserveOpen(false)} />}
    </div>
  )
}
