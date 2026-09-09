import { beforeEach, describe, expect, it } from 'vitest'
import { seedRecipes } from '../data/seed'
import { buildDeductionMap } from '../lib/deduction'
import { matchIngredient } from '../lib/recipeMatch'
import { usageControlFor } from '../lib/actualUsageControl'
import { useKitchenStore } from '../store/useKitchenStore'
import type { KitchenItem } from '../data/types'

/**
 * Integration-level regression for the full "I changed something" data flow
 * — ChangeSomethingSheet.tsx itself is not rendered (this project has no DOM
 * rendering test framework, and introducing one — jsdom/@testing-library —
 * just for this task was explicitly out of scope). Instead, this exercises
 * every *other* piece of the real pipeline together, with real seed recipes
 * and the real store: usageControlFor (what the sheet would show/step by) ->
 * useKitchenStore's actual startCooking/setActualUsage actions (what a real
 * button tap calls) -> buildDeductionMap (what Finished.tsx reads). The
 * sheet's own JSX is now a thin, low-risk layer over these — see
 * lib/actualUsageControl.test.ts for the control-selection logic itself.
 */

describe('ChangeSomethingSheet full flow: usageControlFor -> store -> buildDeductionMap', () => {
  beforeEach(() => {
    useKitchenStore.getState().resetDemo()
  })

  it('divisible: a real tap-driven actualUsage value reaches the final deduction correctly', () => {
    // spinach has no requiredAmount (cup-yield too variable to back into a
    // fraction honestly) — deliberately used here so this test still
    // exercises the "no structured requirement -> fixed fallback, then an
    // explicit override" path, unaffected by the servings migration's
    // requiredAmount backfill on other divisible ingredients (e.g. onion).
    const recipe = seedRecipes.find((r) => r.id === 'tuscan-chicken')!
    const ingredient = recipe.ingredients.find((i) => i.itemId === 'spinach')!
    const items: KitchenItem[] = [
      { id: 'spinach', name: 'Spinach', emoji: '🥬', location: 'fridge', stockType: 'divisible', category: 'Produce', fraction: 1 },
    ]

    const matched = matchIngredient(ingredient, items).matchedItem!
    const control = usageControlFor(ingredient, matched)!
    expect(control).toEqual({ kind: 'divisible', initial: 0.25, step: 0.25 })

    // Simulate one real "+" tap from the sheet's own button handler.
    useKitchenStore.getState().startCooking(recipe.id)
    useKitchenStore.getState().setActualUsage('spinach', control.initial + control.step)

    const actualUsage = useKitchenStore.getState().cookingSession!.actualUsage
    expect(actualUsage.spinach).toBe(0.5)

    const map = buildDeductionMap(recipe, items, actualUsage)
    expect(map.spinach.newFraction).toBe(0.5) // 1 - 0.5, not the old fixed 0.25 default
  })

  it('container: a real tap-driven actualUsage value reaches the final deduction correctly', () => {
    // mayonnaise has no requiredAmount (jar sizes vary too much for an
    // honest fill fraction) — kept unstructured by the servings migration,
    // so this still exercises the fixed-fallback path.
    const recipe = seedRecipes.find((r) => r.id === 'egg-salad-sandwich')!
    const ingredient = recipe.ingredients.find((i) => i.itemId === 'mayonnaise')!
    const items: KitchenItem[] = [
      { id: 'mayonnaise', name: 'Mayonnaise', emoji: '🥪', location: 'pantry', stockType: 'container', category: 'Pantry', fill: 1 },
    ]

    const matched = matchIngredient(ingredient, items).matchedItem!
    const control = usageControlFor(ingredient, matched)!
    expect(control).toEqual({ kind: 'container', initial: 0.15, step: 0.1 })

    // Two real "+" taps.
    useKitchenStore.getState().startCooking(recipe.id)
    useKitchenStore.getState().setActualUsage('mayonnaise', control.initial + control.step * 2)

    const actualUsage = useKitchenStore.getState().cookingSession!.actualUsage
    expect(actualUsage.mayonnaise).toBeCloseTo(0.35)

    const map = buildDeductionMap(recipe, items, actualUsage)
    expect(map.mayonnaise.newFill).toBeCloseTo(0.65) // 1 - 0.35, not the old fixed 0.15 default
  })

  it('staple: never enters the trackable/editable set, and the flat one-tier deduction is unaffected by the absence of any actualUsage', () => {
    const recipe = seedRecipes.find((r) => r.id === 'chicken-and-rice')!
    const riceIngredient = recipe.ingredients.find((i) => i.itemId === 'rice')!
    const items: KitchenItem[] = [
      { id: 'chicken-breast', name: 'Chicken breast', emoji: '🍗', location: 'freezer', stockType: 'countable', category: 'Meat', count: 2 },
      { id: 'rice', name: 'Rice', emoji: '🍚', location: 'pantry', stockType: 'staple', category: 'Pantry', level: 'plenty' },
      { id: 'carrots', name: 'Carrots', emoji: '🥕', location: 'fridge', stockType: 'countable', category: 'Produce', count: 1 },
    ]

    const matched = matchIngredient(riceIngredient, items).matchedItem!
    expect(usageControlFor(riceIngredient, matched)).toBeNull()

    useKitchenStore.getState().startCooking(recipe.id)
    // No setActualUsage call for rice is possible via the sheet (no control
    // renders) — confirm the deduction still applies the ordinary flat
    // one-tier-down staple step, unaffected by requiredAmount/level: 2.
    const map = buildDeductionMap(recipe, items, useKitchenStore.getState().cookingSession!.actualUsage)
    expect(map.rice.newLevel).toBe('some')
  })
})
