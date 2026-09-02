import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import StatusPill from '../components/StatusPill'
import { computeFeasibility, ingredientStatus } from '../lib/kitchen'
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
  const startCooking = useKitchenStore((s) => s.startCooking)

  if (!recipe) return null

  const { status } = computeFeasibility(recipe, items)
  const isFavorite = favorites.includes(recipe.id)
  const needsAdapt = status !== 'ready'

  const handlePrimary = () => {
    if (needsAdapt) {
      navigate(`/recipe/${recipe.id}/adapt`)
    } else {
      startCooking(recipe.id)
      navigate(`/recipe/${recipe.id}/cook`)
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-28">
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
        <h1 className="font-display text-2xl font-semibold text-ink">{recipe.name}</h1>
        <p className="text-sm text-ink/60">{recipe.description}</p>
        <div className="flex items-center gap-3 text-xs font-semibold text-ink/50">
          <span>⏱ {recipe.time} min</span>
          <span>•</span>
          <span>{recipe.effortLabel}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink/40">Ingredients</h2>
        <div className="flex flex-col gap-1.5 rounded-xl2 border border-ink/10 bg-white p-2">
          {recipe.ingredients.map((ing) => {
            const st = ingredientStatus(ing, items)
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
                <span className="text-xs text-ink/50">{ing.quantity}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 bg-cream/95 p-5 backdrop-blur">
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
