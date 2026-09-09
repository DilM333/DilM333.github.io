import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ConfirmStockPanel from '../components/ConfirmStockPanel'
import PageHeader from '../components/PageHeader'
import SectionHeader from '../components/SectionHeader'
import StatusPill from '../components/StatusPill'
import { groceryItemForIngredient } from '../lib/grocery'
import { computeFeasibility, ingredientStatus } from '../lib/kitchen'
import { lowConfidenceHint, matchRecipe, matchStatusLabel } from '../lib/recipeMatch'
import { scaledQuantityLabel, servingsRatio } from '../lib/scaleRecipe'
import { useKitchenStore } from '../store/useKitchenStore'

const STATUS_ICON: Record<string, string> = { ok: '✓', low: '⚠️', missing: '❌' }
const STATUS_COLOR: Record<string, string> = {
  ok: 'text-leaf',
  low: 'text-butter',
  missing: 'text-clay',
}

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const recipe = useKitchenStore((s) => s.recipes.find((r) => r.id === id))
  const items = useKitchenStore((s) => s.items)
  const favorites = useKitchenStore((s) => s.favorites)
  const toggleFavorite = useKitchenStore((s) => s.toggleFavorite)
  const cookingSession = useKitchenStore((s) => s.cookingSession)
  const startCooking = useKitchenStore((s) => s.startCooking)
  const groceryList = useKitchenStore((s) => s.groceryList)
  const addToGroceryList = useKitchenStore((s) => s.addToGroceryList)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // A local preview, not a session mutation — just viewing/adjusting this
  // page shouldn't imply "I am now cooking this." If a session for this
  // exact recipe already exists (returning here mid-cook), pick up its
  // targetServings instead of resetting to the base count. Only committed
  // into the cooking session at the moment Start Cooking/Adapt is pressed
  // (see handlePrimary) — from then on, cookingSession.targetServings is the
  // single source of truth every other cooking screen reads.
  const [previewServings, setPreviewServings] = useState(() => {
    const existing = cookingSession != null && cookingSession.recipeId === id ? cookingSession.targetServings : undefined
    return existing ?? recipe?.servings ?? 1
  })

  if (!recipe) return null

  const ratio = servingsRatio(recipe, previewServings)
  const { status, missing, low } = computeFeasibility(recipe, items, ratio)
  const match = matchRecipe(recipe, items, ratio)
  const checkHint = lowConfidenceHint(match, status)
  const isFavorite = favorites.includes(recipe.id)
  const needsAdapt = status !== 'ready'

  const onList = (name: string) => groceryList.some((g) => g.name === name)
  const short = [...missing, ...low]
  const shortNotOnList = short.filter((ing) => !onList(ing.name))

  const addIngredient = (ing: (typeof short)[number]) =>
    addToGroceryList(groceryItemForIngredient(ing, `For ${recipe.name}`))

  const adjustServings = (delta: number) => setPreviewServings((s) => Math.max(1, s + delta))

  const handlePrimary = () => {
    startCooking(recipe.id, previewServings)
    navigate(needsAdapt ? `/recipe/${recipe.id}/adapt` : `/recipe/${recipe.id}/cook`)
  }

  return (
    <div className="flex min-h-full flex-col gap-5 pb-4">
      <PageHeader
        title=""
        back
        right={
          <button
            onClick={() => toggleFavorite(recipe.id)}
            aria-label="Toggle favorite"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl hover:bg-ink/5"
          >
            {isFavorite ? '❤️' : '🤍'}
          </button>
        }
      />

      <div className="flex flex-col gap-3 px-5">
        <div className="flex h-32 w-full items-center justify-center rounded-xl2 bg-white text-6xl shadow-soft">
          {recipe.emoji}
        </div>
        <StatusPill status={status} />
        {checkHint && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen((o) => !o)}
              className="self-start text-left text-xs text-ink/50 underline decoration-ink/20 underline-offset-2 hover:text-ink/70"
            >
              {checkHint}
            </button>
            {confirmOpen && (
              <ConfirmStockPanel recipe={recipe} onClose={() => setConfirmOpen(false)} />
            )}
          </div>
        )}
        <h1 className="font-display text-2xl font-semibold text-ink">{recipe.name}</h1>
        <p className="text-sm text-ink/60">{recipe.description}</p>

        <div className="flex items-center justify-between rounded-xl2 border border-ink/10 bg-white px-4 py-2.5">
          <span className="text-sm font-semibold text-ink/70">Serves {previewServings}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => adjustServings(-1)}
              aria-label="Fewer servings"
              disabled={previewServings <= 1}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/5 text-sm font-bold disabled:opacity-30"
            >
              −
            </button>
            <span className="w-6 text-center text-sm font-bold tabular-nums">{previewServings}</span>
            <button
              onClick={() => adjustServings(1)}
              aria-label="More servings"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/5 text-sm font-bold"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold text-ink/50">
          <span>⏱ {recipe.time} min</span>
          <span>•</span>
          <span>{recipe.effortLabel}</span>
          {match.requiredTotal > 0 && (
            <>
              <span>•</span>
              <span className={match.isReady ? 'text-leaf' : undefined}>
                {match.requiredAvailable}/{match.requiredTotal} ingredients — {matchStatusLabel(match)}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 px-5">
        <SectionHeader>Ingredients</SectionHeader>
        <div className="flex flex-col gap-1.5 rounded-xl2 border border-ink/10 bg-white p-2">
          {recipe.ingredients.map((ing) => {
            const st = ingredientStatus(ing, items, ratio)
            return (
              <div key={ing.id} className="flex items-center gap-3 px-2 py-1.5">
                <span className={`w-5 text-center font-bold ${STATUS_COLOR[st]}`}>
                  {STATUS_ICON[st]}
                </span>
                <span className="text-lg">{ing.emoji}</span>
                <span className="flex-1 text-sm font-medium">
                  {ing.name}
                  {ing.optional && <span className="text-ink/40"> (optional)</span>}
                </span>
                {/* The scaled quantity is always visible, regardless of stock
                    status — while cooking, you need to see how much you need
                    whether or not you already have it. The "+List" affordance
                    sits alongside it, not in place of it. */}
                <span className="text-xs text-ink/50">{scaledQuantityLabel(ing, ratio)}</span>
                {st !== 'ok' &&
                  (onList(ing.name) ? (
                    <span className="text-xs font-semibold text-leaf">✓ List</span>
                  ) : (
                    <button
                      onClick={() => addIngredient(ing)}
                      className="rounded-full border border-ink/20 px-2.5 py-1 text-xs font-bold text-ink/70"
                    >
                      + List
                    </button>
                  ))}
              </div>
            )
          })}
        </div>
        {shortNotOnList.length > 1 && (
          <button
            onClick={() => shortNotOnList.forEach(addIngredient)}
            className="self-start rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-cream"
          >
            + Add all {shortNotOnList.length} missing to grocery list
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 px-5">
        <SectionHeader>Instructions</SectionHeader>
        <ol className="flex flex-col gap-2 rounded-xl2 border border-ink/10 bg-white p-2">
          {recipe.steps.map((step, i) => (
            <li key={i} className="flex gap-3 px-2 py-1.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink/5 text-xs font-bold text-ink/60">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-ink/80">
                {step.instruction}
                {step.timerMinutes && (
                  <span className="ml-1.5 text-xs font-semibold text-ink/40">({step.timerMinutes} min)</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="sticky bottom-0 z-10 mt-auto bg-cream/95 p-5 backdrop-blur">
        <button
          onClick={handlePrimary}
          className="w-full rounded-xl2 bg-clay py-3.5 text-center text-base font-bold text-white shadow-card"
        >
          {needsAdapt ? 'Adapt Recipe →' : 'Start Cooking →'}
        </button>
      </div>
    </div>
  )
}
