import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { getGuidance, type ResolvedGuidance } from '../data/substitutions'
import type { RecipeIngredient } from '../data/types'
import { groceryItemForIngredient } from '../lib/grocery'
import { findItem, ingredientStatus, itemDisplayAmount, type IngredientStatus } from '../lib/kitchen'
import { type AdaptChoice, useKitchenStore } from '../store/useKitchenStore'

type Kind = 'reserved' | 'missing' | 'low'

function kindFor(item: ReturnType<typeof findItem>, status: IngredientStatus): Kind {
  if (item && (item.reserved ?? 0) > 0 && status === 'low') return 'reserved'
  if (status === 'missing') return 'missing'
  return 'low'
}

const CHOICES: Record<Kind, { choice: AdaptChoice; label: string }[]> = {
  reserved: [
    { choice: 'keep-reserved', label: 'Keep reserved' },
    { choice: 'use-anyway', label: 'Use anyway' },
  ],
  missing: [
    { choice: 'substitute', label: 'Substitute' },
    { choice: 'skip', label: 'Skip' },
    { choice: 'add-to-list', label: 'Add to list' },
  ],
  low: [{ choice: 'use-what-i-have', label: 'Use what I have' }],
}

function GuidancePanel({
  choice,
  guidance,
  reservedFor,
}: {
  choice: AdaptChoice
  guidance: ResolvedGuidance
  reservedFor?: string
}) {
  const panel = 'mt-3 rounded-xl border border-ink/10 bg-cream p-3'
  const heading = 'text-[11px] font-bold uppercase tracking-wide text-ink/45'
  const body = 'mt-1 text-xs leading-relaxed text-ink/70'

  if (choice === 'substitute') {
    if (guidance.substitutes.length === 0) {
      return (
        <div className={panel}>
          <p className={heading}>No direct swap</p>
          <p className={body}>{guidance.skipNote}</p>
        </div>
      )
    }
    return (
      <div className={panel}>
        <p className={heading}>Recommended swaps</p>
        <ul className="mt-2 flex flex-col gap-2">
          {guidance.substitutes.map((s) => (
            <li key={s.name} className="flex items-start gap-2">
              <span className="text-base leading-none">{s.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-ink">
                  {s.name}
                  {s.have && (
                    <span className="ml-1.5 rounded-full bg-leaf/15 px-1.5 py-0.5 text-[10px] font-bold text-leaf">
                      In your kitchen
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-ink/50">
                  {s.ratio}
                  {s.note ? ` · ${s.note}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (choice === 'use-what-i-have') {
    return (
      <div className={panel}>
        <p className={heading}>Making a smaller amount work</p>
        <p className={body}>{guidance.stretchNote}</p>
      </div>
    )
  }

  if (choice === 'use-anyway') {
    return (
      <div className={panel}>
        <p className={heading}>Using what's reserved</p>
        <p className={body}>
          {reservedFor
            ? `You'll dip into what's set aside for ${reservedFor}. Add it back to your grocery list so that plan isn't short.`
            : guidance.stretchNote}
        </p>
      </div>
    )
  }

  if (choice === 'add-to-list') {
    return (
      <div className={panel}>
        <p className={heading}>On your list for next time</p>
        <p className={body}>You still need to cook tonight — {guidance.skipNote}</p>
      </div>
    )
  }

  // 'skip' and 'keep-reserved'
  return (
    <div className={panel}>
      <p className={heading}>If you leave it out</p>
      <p className={body}>{guidance.skipNote}</p>
    </div>
  )
}

export default function AdaptRecipe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const recipe = useKitchenStore((s) => s.recipes.find((r) => r.id === id))
  const items = useKitchenStore((s) => s.items)
  const cookingSession = useKitchenStore((s) => s.cookingSession)
  const startCooking = useKitchenStore((s) => s.startCooking)
  const setAdaptation = useKitchenStore((s) => s.setAdaptation)
  const addToGroceryList = useKitchenStore((s) => s.addToGroceryList)

  useEffect(() => {
    if (id && cookingSession?.recipeId !== id) startCooking(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const problems = useMemo(() => {
    if (!recipe) return []
    return recipe.ingredients
      .map((ing) => ({ ing, item: findItem(items, ing.itemId), status: ingredientStatus(ing, items) }))
      .filter((p) => p.status !== 'ok')
  }, [recipe, items])

  if (!recipe) return null

  const adaptations = cookingSession?.adaptations ?? {}
  const allChosen = problems.every((p) => adaptations[p.ing.id])

  const choose = (ing: RecipeIngredient, choice: AdaptChoice) => {
    setAdaptation(ing.id, choice)
    if (choice === 'add-to-list') {
      addToGroceryList(groceryItemForIngredient(ing, `For ${recipe.name}`))
    }
  }

  const goCook = () => navigate(`/recipe/${recipe.id}/cook`)

  return (
    <div className="flex min-h-full flex-col gap-5 pb-4">
      <PageHeader title={recipe.name} subtitle="Adapt this recipe for your kitchen" back />

      {problems.length === 0 ? (
        <p className="px-5 text-sm text-ink/60">Everything checks out — you're ready to cook.</p>
      ) : (
        <p className="px-5 text-sm text-ink/60">
          You're short on {problems.length} thing{problems.length === 1 ? '' : 's'}. Pick what to do and
          we'll show you how to make it work.
        </p>
      )}

      <div className="flex flex-col gap-3 px-5">
        {problems.map(({ ing, item, status }) => {
          const kind = kindFor(item, status)
          const selected = adaptations[ing.id]
          const guidance = getGuidance(ing, items)
          const desc =
            kind === 'reserved'
              ? 'Some is reserved.'
              : status === 'missing'
                ? "You're out."
                : item
                  ? `You have ${itemDisplayAmount(item)}${item.stockType === 'container' ? ' left' : ''}.`
                  : ''

          return (
            <div key={ing.id} className="rounded-xl2 border border-ink/10 bg-white p-4 shadow-soft">
              <div className="flex items-center gap-2">
                <span className="text-xl">{ing.emoji}</span>
                <span className="font-semibold">{ing.name}</span>
              </div>
              <p className="mt-1 text-sm text-ink/60">{desc}</p>

              {kind === 'missing' && guidance.recommended && (
                <p className="mt-1 text-xs font-semibold text-leaf">
                  💡{' '}
                  {guidance.recommended.have
                    ? `You have ${guidance.recommended.name.toLowerCase()}`
                    : `Try ${guidance.recommended.name.toLowerCase()}`}{' '}
                  <span className="font-normal text-leaf/80">({guidance.recommended.ratio})</span>
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {CHOICES[kind].map((c) => (
                  <button
                    key={c.choice}
                    onClick={() => choose(ing, c.choice)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      selected === c.choice
                        ? 'border-leaf bg-leaf text-white'
                        : 'border-ink/15 bg-cream text-ink/70'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {selected && (
                <GuidancePanel choice={selected} guidance={guidance} reservedFor={item?.reservedFor} />
              )}
            </div>
          )
        })}
      </div>

      {allChosen && problems.length > 0 && (
        <div className="mx-5 rounded-xl2 bg-leaf/10 p-4 text-center">
          <p className="text-sm font-bold text-leaf">✓ Adapted for your kitchen</p>
        </div>
      )}

      <div className="sticky bottom-0 z-10 mt-auto bg-cream/95 p-5 backdrop-blur">
        <button
          onClick={goCook}
          disabled={!allChosen}
          className="w-full rounded-xl2 bg-clay py-3.5 text-center text-base font-bold text-white shadow-card disabled:opacity-40"
        >
          Start Cooking →
        </button>
      </div>
    </div>
  )
}
