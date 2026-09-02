import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useKitchenStore } from '../store/useKitchenStore'
import ChangeSomethingSheet from '../components/ChangeSomethingSheet'
import Timer from '../components/Timer'

export default function CookingMode() {
  const { id } = useParams()
  const navigate = useNavigate()
  const recipe = useKitchenStore((s) => s.recipes.find((r) => r.id === id))
  const cookingSession = useKitchenStore((s) => s.cookingSession)
  const startCooking = useKitchenStore((s) => s.startCooking)
  const nextStep = useKitchenStore((s) => s.nextStep)
  const prevStep = useKitchenStore((s) => s.prevStep)
  const cancelCooking = useKitchenStore((s) => s.cancelCooking)
  const [changeOpen, setChangeOpen] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (id && !started.current && cookingSession?.recipeId !== id) {
      startCooking(id)
    }
    started.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!recipe || !cookingSession) return null

  const stepIndex = cookingSession.stepIndex
  const step = recipe.steps[stepIndex]
  const isLast = stepIndex === recipe.steps.length - 1

  const close = () => {
    cancelCooking()
    navigate(`/recipe/${recipe.id}`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink text-cream">
      <div className="flex items-center justify-between px-5 pt-6">
        <button onClick={close} aria-label="Close cooking mode" className="text-2xl text-cream/70">
          ×
        </button>
        <p className="text-sm font-semibold text-cream/60">{recipe.name}</p>
        <button
          onClick={() => setChangeOpen(true)}
          className="text-xs font-bold uppercase tracking-wide text-butter"
        >
          Change something
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-cream/40">
          {stepIndex + 1} of {recipe.steps.length}
        </p>
        <p className="font-display text-3xl font-semibold leading-snug">{step.instruction}</p>
        {step.timerMinutes && <Timer minutes={step.timerMinutes} />}
      </div>

      <div className="flex gap-3 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <button
          onClick={prevStep}
          disabled={stepIndex === 0}
          className="flex-1 rounded-xl2 border border-cream/20 py-3.5 text-sm font-bold text-cream/70 disabled:opacity-30"
        >
          ← Back
        </button>
        {isLast ? (
          <button
            onClick={() => navigate(`/recipe/${recipe.id}/finished`)}
            className="flex-1 rounded-xl2 bg-leaf py-3.5 text-sm font-bold text-white"
          >
            Finished ✓
          </button>
        ) : (
          <button
            onClick={nextStep}
            className="flex-1 rounded-xl2 bg-clay py-3.5 text-sm font-bold text-white"
          >
            Next →
          </button>
        )}
      </div>

      {changeOpen && <ChangeSomethingSheet recipe={recipe} onClose={() => setChangeOpen(false)} />}
    </div>
  )
}
