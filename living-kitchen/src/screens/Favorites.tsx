import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import RecipeCard from '../components/RecipeCard'
import SkeletonRows from '../components/SkeletonRows'
import SyncErrorBanner from '../components/SyncErrorBanner'
import { computeFeasibility } from '../lib/kitchen'
import { useKitchenStore } from '../store/useKitchenStore'

const ORDER = ['ready', 'ready-adjusted', 'almost', 'one-away', 'needs-shopping']

export default function Favorites() {
  const recipes = useKitchenStore((s) => s.recipes)
  const favorites = useKitchenStore((s) => s.favorites)
  const items = useKitchenStore((s) => s.items)
  const favoritesLoading = useKitchenStore((s) => s.favoritesLoading)
  const favoritesSyncError = useKitchenStore((s) => s.favoritesSyncError)

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
      {favoritesSyncError && (
        <SyncErrorBanner
          title="Sync paused"
          message="You're seeing your favorites saved on this device. They'll sync once Supabase is reachable again."
          hint={favoritesSyncError}
        />
      )}
      <div className="flex flex-col gap-3 px-5">
        {favoritesLoading ? (
          <SkeletonRows count={3} />
        ) : (
          <>
            {favRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} items={items} />
            ))}
            {favRecipes.length === 0 && (
              <EmptyState
                icon="❤️"
                title="No favorites yet"
                hint={'Save recipes from "What can I make?" and they\'ll show up here — always responding to your kitchen.'}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
