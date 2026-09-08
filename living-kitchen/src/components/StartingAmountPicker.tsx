import type { StapleLevel, StockType } from '../data/types'
import { fillLabel, fractionLabel, levelLabel } from '../lib/kitchen'

const FRACTIONS = [0, 0.25, 0.5, 0.75, 1]
const LEVELS: StapleLevel[] = ['plenty', 'some', 'low', 'out']

export interface StartingAmountValue {
  count: number
  fraction: number
  fill: number
  level: StapleLevel
}

/**
 * The one shared "how much" control set for the app's four stock types —
 * originally inline in AddCustomIngredientSheet, now reused there and by
 * AddFood's amount picker so there is exactly one set of controls for
 * countable/divisible/container/staple amounts, not two. Renders only the
 * control matching `stockType`; the caller owns the actual state (starting
 * amount for a new item, current amount for an existing one) and supplies it
 * back through `onChange`.
 */
export default function StartingAmountPicker({
  stockType,
  value,
  onChange,
}: {
  stockType: StockType
  value: StartingAmountValue
  onChange: (patch: Partial<StartingAmountValue>) => void
}) {
  if (stockType === 'countable') {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange({ count: Math.max(0, value.count - 1) })}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/70"
          aria-label="Decrease"
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-bold tabular-nums">{value.count}</span>
        <button
          onClick={() => onChange({ count: value.count + 1 })}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/70"
          aria-label="Increase"
        >
          +
        </button>
      </div>
    )
  }

  if (stockType === 'divisible') {
    return (
      <div className="flex items-center gap-1.5">
        {FRACTIONS.map((f) => (
          <button
            key={f}
            onClick={() => onChange({ fraction: f })}
            className={`rounded-md px-2 py-1 text-xs font-bold ${
              value.fraction === f ? 'bg-leaf text-white' : 'bg-ink/5 text-ink/60'
            }`}
          >
            {fractionLabel(f)}
          </button>
        ))}
      </div>
    )
  }

  if (stockType === 'container') {
    return (
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={value.fill * 100}
          onChange={(e) => onChange({ fill: Number(e.target.value) / 100 })}
          className="flex-1 accent-leaf"
        />
        <span className="w-16 text-right text-xs text-ink/50">{fillLabel(value.fill)}</span>
      </div>
    )
  }

  if (stockType === 'staple') {
    return (
      <div className="flex items-center gap-1.5">
        {LEVELS.map((lvl) => (
          <button
            key={lvl}
            onClick={() => onChange({ level: lvl })}
            className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase ${
              value.level === lvl ? 'bg-leaf text-white' : 'bg-ink/5 text-ink/60'
            }`}
          >
            {levelLabel(lvl)}
          </button>
        ))}
      </div>
    )
  }

  return null
}
