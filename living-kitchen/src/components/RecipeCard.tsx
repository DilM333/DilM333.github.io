import type { KeyboardEvent, MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { KitchenItem, Recipe } from '../data/types'
import { groceryItemForIngredient } from '../lib/grocery'
import { computeFeasibility, isUseSoon } from '../lib/kitchen'
import { lowConfidenceHint, matchRecipe, matchStatusLabel } from '../lib/recipeMatch'
import { useKitchenStore } from '../store/useKitchenStore'
import StatusPill from './StatusPill'

interface Props {
  recipe: Recipe
  items: KitchenItem[]
}

export default function RecipeCard({ recipe, items }: Props) {
  const navigate = useNavigate()
  const groceryList = useKitchenStore((s) => s.groceryList)
  const addToGroceryList = useKitchenStore((s) => s.addToGroceryList)
  const { status, missing, low } = computeFeasibility(recipe, items)
  const match = matchRecipe(recipe, items)
  const useSoonIngredients = recipe.ingredients.filter((ing) => {
    const item = items.find((i) => i.id === ing.itemId)
    return item && isUseSoon(item)
  })

  const shortNotOnList = missing.filter((ing) => !groceryList.some((g) => g.name === ing.name))
  const alreadyAdded = missing.length > 0 && shortNotOnList.length === 0

  const addMissing = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation()
    shortNotOnList.forEach((ing) => addToGroceryList(groceryItemForIngredient(ing, `For ${recipe.name}`)))
  }

  // Read-only nudge for an otherwise-cookable recipe leaning on ingredients
  // Euko hasn't seen lately. Only non-null for ready / ready-adjusted, so it
  // naturally only ever replaces those two detail lines.
  const checkHint = lowConfidenceHint(match, status)

  let detail: string | null = null
  if (checkHint) {
    detail = checkHint
  } else if (status === 'ready') {
    detail = 'You have everything'
  } else if (status === 'ready-adjusted' && low[0]) {
    detail = `Adapt with what you have →`
  } else if (status === 'almost') {
    detail = `Can be adapted without ${missing.map((m) => m.name).join(', ')}`
  } else if (status === 'one-away') {
    detail = `Need: ${missing.map((m) => m.name).join(', ')}`
  } else if (status === 'needs-shopping') {
    detail = `Missing ${missing.length} ingredient${missing.length === 1 ? '' : 's'}`
  }

  return (
    <button
      onClick={() => navigate(`/recipe/${recipe.id}`)}
      className="flex w-full flex-col gap-2 rounded-xl2 border border-ink/10 bg-white p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-2">
        <StatusPill status={status} />
        <span className="text-2xl leading-none">{recipe.emoji}</span>
      </div>
      <h3 className="font-display text-lg font-semibold leading-snug text-ink">{recipe.name}</h3>
      {detail && <p className="text-sm text-ink/70">{detail}</p>}
      <div className="flex items-center gap-3 text-xs font-medium text-ink/50">
        <span>{recipe.time} min</span>
        <span>•</span>
        <span>{recipe.effortLabel}</span>
        {match.requiredTotal > 0 && (
          <>
            <span>•</span>
            <span
              className={match.isReady ? 'font-semibold text-leaf' : undefined}
              title={matchStatusLabel(match)}
            >
              {match.requiredAvailable}/{match.requiredTotal} ingredients
            </span>
          </>
        )}
      </div>
      {useSoonIngredients.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {useSoonIngredients.map((ing) => (
            <span
              key={ing.id}
              className="inline-flex items-center gap-1 rounded-full bg-butter/15 px-2 py-0.5 text-xs text-[#8a6113]"
            >
              Uses soon: {ing.emoji} {ing.name}
            </span>
          ))}
        </div>
      )}
      {missing.length > 0 && (
        <div className="pt-1">
          {alreadyAdded ? (
            <span className="inline-flex items-center rounded-full bg-leaf/10 px-3 py-1 text-xs font-bold text-leaf">
              ✓ Missing items on grocery list
            </span>
          ) : (
            <span
              role="button"
              tabIndex={0}
              onClick={addMissing}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') addMissing(e)
              }}
              className="inline-flex cursor-pointer items-center rounded-full bg-ink px-3 py-1 text-xs font-bold text-cream"
            >
              + Add {shortNotOnList.length} missing to grocery list
            </span>
          )}
        </div>
      )}
    </button>
  )
}
