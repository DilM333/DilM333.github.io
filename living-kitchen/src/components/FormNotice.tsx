import type { ReactNode } from 'react'

/** Shared inline success/error message for forms (auth, invites, …). */
export default function FormNotice({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <p
      className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
        tone === 'error' ? 'bg-clay/10 text-clay' : 'bg-leaf/10 text-leaf'
      }`}
    >
      {children}
    </p>
  )
}
