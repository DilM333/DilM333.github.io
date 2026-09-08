import { describe, expect, it } from 'vitest'
import { seedGroceryList, seedKitchen } from '../data/seed'
import { useKitchenStore } from './useKitchenStore'

// ---------------------------------------------------------------------------
// This file exists to observe the store's true bare/just-created state, which
// is only visible before any other test has mutated the module-level
// singleton — Vitest isolates the module registry per test *file*, so this
// runs in its own fresh instance as long as nothing else in this file touches
// the store first. Every other test file that needs seeded data calls
// resetDemo() explicitly; this file is specifically about what a real,
// never-initialized account looks like before that ever happens.
// ---------------------------------------------------------------------------

describe('useKitchenStore — real/production initial state (before resetDemo is ever called)', () => {
  it('starts with an empty kitchen, grocery list, and favorites — not the demo data', () => {
    const state = useKitchenStore.getState()
    expect(state.items).toEqual([])
    expect(state.groceryList).toEqual([])
    expect(state.favorites).toEqual([])
  })

  it('still has the recipe library — recipes are static app content, not user data', () => {
    expect(useKitchenStore.getState().recipes.length).toBeGreaterThan(0)
  })

  it('has never marked any household as having seen the kitchen setup nudge', () => {
    expect(useKitchenStore.getState().kitchenSetupSeenHouseholds).toEqual([])
  })

  it('resetDemo() still restores the full demo kitchen, grocery list, and favorites', () => {
    useKitchenStore.getState().resetDemo()
    const state = useKitchenStore.getState()
    expect(state.items.length).toBe(seedKitchen.length)
    expect(state.items.length).toBeGreaterThan(0)
    expect(state.groceryList.length).toBe(seedGroceryList.length)
    expect(state.groceryList.length).toBeGreaterThan(0)
    expect(state.favorites.length).toBeGreaterThan(0)
  })
})
