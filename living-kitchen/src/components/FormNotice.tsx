import type { ReactNode } from 'react'

const TONE_CLASSES: Record<'error' | 'warning' | 'success', string> = {
  error: 'bg-clay/10 text-clay',
  warning: 'bg-butter/10 text-[#8a6113]',
  success: 'bg-leaf/10 text-leaf',
}

/** Shared inline success/warning/error message for forms (auth, invites, …). */
export default function FormNotice({
  tone,
  children,
}: {
  tone: 'error' | 'warning' | 'success'
  children: ReactNode
}) {
  return <p className={`rounded-xl px-4 py-2.5 text-sm font-medium ${TONE_CLASSES[tone]}`}>{children}</p>
}
