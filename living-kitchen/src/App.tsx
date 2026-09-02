import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import { useKitchenStore } from './store/useKitchenStore'
import Onboarding from './screens/Onboarding'
import Kitchen from './screens/Kitchen'
import AddFood from './screens/AddFood'
import WhatCanIMake from './screens/WhatCanIMake'
import RecipeDetail from './screens/RecipeDetail'
import AdaptRecipe from './screens/AdaptRecipe'
import CookingMode from './screens/CookingMode'
import Finished from './screens/Finished'
import GroceryList from './screens/GroceryList'
import Favorites from './screens/Favorites'

const FOCUS_PREFIXES = ['/recipe']

export default function App() {
  const onboarded = useKitchenStore((s) => s.onboarded)
  const location = useLocation()
  const focusMode = FOCUS_PREFIXES.some((p) => location.pathname.startsWith(p))

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-cream text-ink shadow-card sm:my-4 sm:min-h-[calc(100vh-2rem)] sm:rounded-xl2">
      <div className="flex-1 overflow-y-auto pb-24">
        <Routes>
          <Route
            path="/"
            element={onboarded ? <Navigate to="/kitchen" replace /> : <Onboarding />}
          />
          <Route path="/kitchen" element={<Kitchen />} />
          <Route path="/add" element={<AddFood />} />
          <Route path="/make" element={<WhatCanIMake />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/grocery" element={<GroceryList />} />
          <Route path="/recipe/:id" element={<RecipeDetail />} />
          <Route path="/recipe/:id/adapt" element={<AdaptRecipe />} />
          <Route path="/recipe/:id/cook" element={<CookingMode />} />
          <Route path="/recipe/:id/finished" element={<Finished />} />
          <Route path="*" element={<Navigate to="/kitchen" replace />} />
        </Routes>
      </div>
      {onboarded && !focusMode && <BottomNav />}
    </div>
  )
}
