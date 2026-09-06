/** Shared empty-state block — explains what to do next, never reads like an error. */
export default function EmptyState({
  icon = '✨',
  title,
  hint,
}: {
  icon?: string
  title: string
  hint?: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl2 border border-dashed border-ink/15 px-5 py-8 text-center">
      <span className="text-2xl leading-none">{icon}</span>
      <p className="text-sm font-semibold text-ink/60">{title}</p>
      {hint && <p className="max-w-xs text-xs leading-relaxed text-ink/45">{hint}</p>}
    </div>
  )
}
