/**
 * Consistent sync-status banner for Kitchen/Grocery/Favorites/Add Food.
 *
 * "warning" (default) is for the common case: Supabase is unreachable or
 * blocked, but the screen is still showing a safe local copy — amber, not
 * red, so it reads as noticeable rather than alarming. "error" is reserved
 * for the rarer case where there's no safe local copy to fall back to (e.g.
 * the Household screen failing to load).
 */
export default function SyncErrorBanner({
  title,
  message,
  hint,
  tone = 'warning',
}: {
  title: string
  message: string
  hint?: string
  tone?: 'warning' | 'error'
}) {
  const isError = tone === 'error'
  return (
    <div
      className={`mx-5 rounded-xl2 border px-4 py-3 ${
        isError ? 'border-clay/30 bg-clay/5' : 'border-butter/40 bg-butter/10'
      }`}
    >
      <p className={`text-sm font-semibold ${isError ? 'text-clay' : 'text-[#8a6113]'}`}>{title}</p>
      <p className={`mt-0.5 text-xs ${isError ? 'text-clay/80' : 'text-[#8a6113]/80'}`}>{message}</p>
      {hint && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] font-semibold text-ink/40">
            Technical details
          </summary>
          <pre className="mt-1 whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-ink/60">
            {hint}
          </pre>
        </details>
      )}
    </div>
  )
}
