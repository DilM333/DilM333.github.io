import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  title: string
  subtitle?: string
  back?: boolean
  right?: ReactNode
}

export default function PageHeader({ title, subtitle, back, right }: Props) {
  const navigate = useNavigate()
  return (
    <div className="sticky top-0 z-10 bg-cream/95 px-5 pb-3 pt-6 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {back && (
            <button
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-lg text-ink/60 hover:bg-ink/5"
            >
              ←
            </button>
          )}
          <div>
            {title && <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>}
            {subtitle && <p className="text-sm text-ink/60">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
    </div>
  )
}
