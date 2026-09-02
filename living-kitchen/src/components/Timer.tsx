import { useEffect, useRef, useState } from 'react'

export default function Timer({ minutes }: { minutes: number }) {
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = window.setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            setRunning(false)
            return 0
          }
          return s - 1
        })
      }, 1000)
    }
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [running])

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl2 bg-cream/10 px-6 py-4">
      <span className="font-display text-3xl font-semibold tabular-nums">
        {mm}:{ss}
      </span>
      <button
        onClick={() => setRunning((r) => !r)}
        className="rounded-full bg-butter px-4 py-1.5 text-xs font-bold text-ink"
      >
        {running ? 'Pause' : secondsLeft === minutes * 60 ? `Start ${mm}:${ss} timer` : 'Resume'}
      </button>
    </div>
  )
}
