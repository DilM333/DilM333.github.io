import type { ReactNode } from 'react'

/** Shared uppercase section label used above lists throughout the app. */
export default function SectionHeader({ children, icon }: { children: ReactNode; icon?: string }) {
  return (
    <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-ink/50">
      {icon && <span className="text-base normal-case">{icon}</span>}
      {children}
    </h2>
  )
}
