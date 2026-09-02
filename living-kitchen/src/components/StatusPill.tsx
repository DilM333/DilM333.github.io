import type { Feasibility } from '../data/types'
import { feasibilityMeta } from '../lib/kitchen'

const bg: Record<Feasibility, string> = {
  ready: 'bg-leaf/10 text-leaf',
  'ready-adjusted': 'bg-leaf/10 text-leaf',
  almost: 'bg-butter/15 text-[#8a6113]',
  'one-away': 'bg-butter/15 text-[#8a6113]',
  'needs-shopping': 'bg-clay/10 text-clay',
}

export default function StatusPill({ status }: { status: Feasibility }) {
  const meta = feasibilityMeta[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${bg[status]}`}
    >
      <span>{meta.dot}</span>
      {meta.label}
    </span>
  )
}
