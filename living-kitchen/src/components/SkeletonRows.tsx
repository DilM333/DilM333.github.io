/**
 * Lightweight placeholder rows shown while a slice of data (favorites,
 * grocery list, household members, …) is still loading from Supabase —
 * stands in for the real list instead of flashing an empty state or stale
 * local/seed data first.
 */
export default function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-3 rounded-xl2 border border-ink/10 bg-white px-4 py-3"
        >
          <div className="h-8 w-8 shrink-0 rounded-full bg-ink/10" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="h-3 w-2/5 rounded-full bg-ink/10" />
            <div className="h-2.5 w-1/4 rounded-full bg-ink/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
