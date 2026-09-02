import { useNavigate } from 'react-router-dom'
import type { KitchenItem, Recipe } from '../data/types'
import { computeFeasibility, isUseSoon } from '../lib/kitchen'
import StatusPill from './StatusPill'

interface Props {
  recipe: Recipe
  items: KitchenItem[]
}

export default function RecipeCard({ recipe, items }: Props) {
  const navigate = useNavigate()
  const { status, missing, low } = computeFeasibility(recipe, items)
  const useSoonIngredients = recipe.ingredients.filter((ing) => {
    const item = items.find((i) => i.id === ing.itemId)
    return item && isUseSoon(item)
  })

  let detail: string | null = null
  if (status === 'ready') {
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
    </button>
  )
}
