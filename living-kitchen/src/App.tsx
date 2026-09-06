import { useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import FormNotice from './components/FormNotice'
import { useAuthStore } from './store/useAuthStore'
import { useKitchenStore } from './store/useKitchenStore'
import AuthScreen from './screens/AuthScreen'
import Onboarding from './screens/Onboarding'
import Kitchen from './screens/Kitchen'
import AddFood from './screens/AddFood'
import WhatCanIMake from './screens/WhatCanIMake'
import KitchenAssistant from './screens/KitchenAssistant'
import RecipeDetail from './screens/RecipeDetail'
import AdaptRecipe from './screens/AdaptRecipe'
import CookingMode from './screens/CookingMode'
import Finished from './screens/Finished'
import GroceryList from './screens/GroceryList'
import Favorites from './screens/Favorites'
import Household from './screens/Household'

/** Screens that hide the nav for an immersive, single-task view. */
const FOCUS_PATTERNS = [/^\/recipe\/[^/]+\/cook$/, /^\/$/]

const SHELL_CLASS =
  'mx-auto flex h-screen [height:100dvh] w-full max-w-md flex-col overflow-hidden bg-cream text-ink shadow-card sm:my-4 sm:h-[calc(100vh-2rem)] sm:[height:calc(100dvh-2rem)] sm:rounded-xl2'

function Shell({ children, nav }: { children: ReactNode; nav?: ReactNode }) {
  return (
    <div className={SHELL_CLASS}>
      <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
      {nav}
    </div>
  )
}

function Splash({ label = 'Living Kitchen' }: { label?: string }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6">
      <span className="animate-pulse text-3xl">🍽️</span>
      <p className="font-display text-lg font-semibold text-ink/70">{label}</p>
      <div className="h-1 w-24 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full w-1/3 animate-[loading-bar_1.1s_ease-in-out_infinite] rounded-full bg-clay" />
      </div>
    </div>
  )
}

function InvitePrompt() {
  const invite = useAuthStore((s) => s.pendingInvite)
  const resolving = useAuthStore((s) => s.inviteResolving)
  const inviteError = useAuthStore((s) => s.inviteError)
  const acceptPendingInvite = useAuthStore((s) => s.acceptPendingInvite)
  const declinePendingInvite = useAuthStore((s) => s.declinePendingInvite)

  if (!invite) return null

  return (
    <div className="flex min-h-full flex-col justify-center gap-4 px-6 py-12">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-clay">You&apos;re invited</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
          Join {invite.householdName}
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          {invite.invitedByEmail ?? 'Someone'} invited you to share their kitchen, grocery list,
          favorites, and pantry as a {invite.role}.
        </p>
      </div>

      {inviteError && <FormNotice tone="error">{inviteError}</FormNotice>}

      <button
        onClick={() => void acceptPendingInvite()}
        disabled={resolving}
        className="rounded-xl2 bg-clay py-3.5 text-center text-base font-bold text-white shadow-card transition hover:brightness-95 disabled:opacity-40"
      >
        {resolving ? 'Joining…' : `Join ${invite.householdName}`}
      </button>
      <button
        onClick={() => void declinePendingInvite()}
        disabled={resolving}
        className="rounded-xl2 border border-ink/20 bg-white py-3.5 text-center text-base font-bold text-ink/80 transition hover:border-ink/35 disabled:opacity-40"
      >
        Start my own kitchen instead
      </button>
    </div>
  )
}

function HouseholdSetupError({ hint, onSignOut }: { hint: string; onSignOut: () => void }) {
  return (
    <div className="flex min-h-full flex-col justify-center gap-4 px-6 py-12">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-clay">Setup blocked</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
          Supabase blocked your kitchen setup
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          You&apos;re signed in, but a row-level-security policy is missing so the household
          couldn&apos;t be created. Add the policy below in the Supabase SQL editor, then reload.
        </p>
      </div>
      <pre className="overflow-x-auto rounded-xl bg-ink/5 p-4 text-xs leading-relaxed text-ink/80">
        {hint}
      </pre>
      <button
        onClick={onSignOut}
        className="self-start rounded-xl border border-ink/20 bg-white px-4 py-2 text-sm font-semibold text-ink/70"
      >
        Sign out
      </button>
    </div>
  )
}

export default function App() {
  const location = useLocation()

  const initAuth = useAuthStore((s) => s.init)
  const initializing = useAuthStore((s) => s.initializing)
  const user = useAuthStore((s) => s.user)
  const householdId = useAuthStore((s) => s.householdId)
  const householdLoading = useAuthStore((s) => s.householdLoading)
  const householdError = useAuthStore((s) => s.householdError)
  const pendingInvite = useAuthStore((s) => s.pendingInvite)
  const signOut = useAuthStore((s) => s.signOut)

  const onboarded = useKitchenStore((s) => s.onboarded)
  const kitchenLoading = useKitchenStore((s) => s.kitchenLoading)
  const initKitchenSync = useKitchenStore((s) => s.initKitchenSync)
  const resetKitchenSync = useKitchenStore((s) => s.resetKitchenSync)
  const initGroceryListSync = useKitchenStore((s) => s.initGroceryListSync)
  const resetGroceryListSync = useKitchenStore((s) => s.resetGroceryListSync)
  const initFavoritesSync = useKitchenStore((s) => s.initFavoritesSync)
  const resetFavoritesSync = useKitchenStore((s) => s.resetFavoritesSync)
  const initCustomIngredientsSync = useKitchenStore((s) => s.initCustomIngredientsSync)
  const resetCustomIngredientsSync = useKitchenStore((s) => s.resetCustomIngredientsSync)

  useEffect(() => {
    initAuth()
  }, [initAuth])

  useEffect(() => {
    if (householdId) {
      // Kitchen/grocery sync reconstruct a custom ingredient's id/emoji by
      // matching its name against the custom catalog, so that catalog needs
      // to be loaded first — otherwise a custom kitchen item fetched before
      // its catalog entry arrives would fall back to a generic slug.
      void (async () => {
        await initCustomIngredientsSync(householdId)
        void initKitchenSync(householdId)
        void initGroceryListSync(householdId)
      })()
      void initFavoritesSync(householdId)
    } else {
      resetKitchenSync()
      resetGroceryListSync()
      resetFavoritesSync()
      resetCustomIngredientsSync()
    }
  }, [
    householdId,
    initKitchenSync,
    resetKitchenSync,
    initGroceryListSync,
    resetGroceryListSync,
    initFavoritesSync,
    resetFavoritesSync,
    initCustomIngredientsSync,
    resetCustomIngredientsSync,
  ])

  if (initializing) {
    return (
      <Shell>
        <Splash />
      </Shell>
    )
  }

  if (!user) {
    return (
      <Shell>
        <AuthScreen />
      </Shell>
    )
  }

  if (householdError) {
    return (
      <Shell>
        <HouseholdSetupError hint={householdError} onSignOut={() => void signOut()} />
      </Shell>
    )
  }

  if (pendingInvite) {
    return (
      <Shell>
        <InvitePrompt />
      </Shell>
    )
  }

  if (householdLoading || !householdId || kitchenLoading) {
    return (
      <Shell>
        <Splash label="Setting up your kitchen…" />
      </Shell>
    )
  }

  const focusMode = FOCUS_PATTERNS.some((p) => p.test(location.pathname))
  const showNav = !focusMode && !(location.pathname === '/' && !onboarded)

  return (
    <Shell nav={showNav ? <BottomNav /> : undefined}>
      <Routes>
        <Route path="/" element={onboarded ? <Navigate to="/kitchen" replace /> : <Onboarding />} />
        <Route path="/kitchen" element={<Kitchen />} />
        <Route path="/add" element={<AddFood />} />
        <Route path="/make" element={<WhatCanIMake />} />
        <Route path="/assistant" element={<KitchenAssistant />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/household" element={<Household />} />
        <Route path="/grocery" element={<GroceryList />} />
        <Route path="/recipe/:id" element={<RecipeDetail />} />
        <Route path="/recipe/:id/adapt" element={<AdaptRecipe />} />
        <Route path="/recipe/:id/cook" element={<CookingMode />} />
        <Route path="/recipe/:id/finished" element={<Finished />} />
        <Route path="*" element={<Navigate to="/kitchen" replace />} />
      </Routes>
    </Shell>
  )
}
