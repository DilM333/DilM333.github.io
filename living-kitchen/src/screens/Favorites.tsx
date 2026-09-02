import PageHeader from '../components/PageHeader'
import RecipeCard from '../components/RecipeCard'
import { computeFeasibility } from '../lib/kitchen'
import { useKitchenStore } from '../store/useKitchenStore'

const ORDER = ['ready', 'ready-adjusted', 'almost', 'one-away', 'needs-shopping']

export default function Favorites() {
  const recipes = useKitchenStore((s) => s.recipes)
  const favorites = useKitchenStore((s) => s.favorites)
  const items = useKitchenStore((s) => s.items)

  const favRecipes = recipes
    .filter((r) => favorites.includes(r.id))
    .sort(
      (a, b) =>
        ORDER.indexOf(computeFeasibility(a, items).status) -
        ORDER.indexOf(computeFeasibility(b, items).status),
    )

  return (
    <div className="flex flex-col gap-5 pb-6">
      <PageHeader title="Favorites" subtitle="Your saved recipes, live." />
      <div className="flex flex-col gap-3 px-5">
        {favRecipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} items={items} />
        ))}
        {favRecipes.length === 0 && (
          <p className="text-sm text-ink/50">
            Save recipes from "What can I make?" and they'll show up here — always responding to
            your kitchen.
          </p>
        )}
      </div>
    </div>
  )
}
