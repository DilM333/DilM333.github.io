/**
 * Whether the one-time, dismissible "Set up your kitchen" nudge should show
 * instead of going straight to /kitchen. A pure function so it's unit
 * testable without a rendering harness — this project has no React Testing
 * Library, only logic-level tests. See store/useKitchenStore.ts's
 * kitchenSetupSeenHouseholds for why dismissal is keyed per household rather
 * than a single global flag.
 */
export function needsKitchenSetup(state: {
  onboarded: boolean
  kitchenSyncError: string | null
  items: unknown[]
  householdId: string | null
  kitchenSetupSeenHouseholds: string[]
}): boolean {
  return (
    state.onboarded &&
    !state.kitchenSyncError &&
    state.items.length === 0 &&
    state.householdId != null &&
    !state.kitchenSetupSeenHouseholds.includes(state.householdId)
  )
}
