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
    const recipe = seedRecipes.find((r) => r.id === 'mushroom-spinach-orzo')!
    const ingredient = recipe.ingredients.find((i) => i.itemId === 'red-onion')!
    const items: KitchenItem[] = [
      { id: 'red-onion', name: 'Red onion', emoji: '🧅', location: 'fridge', stockType: 'divisible', category: 'Produce', fraction: 1 },
    ]

    const matched = matchIngredient(ingredient, items).matchedItem!
    const control = usageControlFor(ingredient, matched)!
    expect(control).toEqual({ kind: 'divisible', initial: 0.25, step: 0.25 })

    // Simulate one real "+" tap from the sheet's own button handler.
    useKitchenStore.getState().startCooking(recipe.id)
    useKitchenStore.getState().setActualUsage('red-onion', control.initial + control.step)

    const actualUsage = useKitchenStore.getState().cookingSession!.actualUsage
    expect(actualUsage['red-onion']).toBe(0.5)

    const map = buildDeductionMap(recipe, items, actualUsage)
    expect(map['red-onion'].newFraction).toBe(0.5) // 1 - 0.5, not the old fixed 0.25 default
  })

  it('container: a real tap-driven actualUsage value reaches the final deduction correctly', () => {
    const recipe = seedRecipes.find((r) => r.id === 'mushroom-spinach-orzo')!
    const ingredient = recipe.ingredients.find((i) => i.itemId === 'broth')!
    const items: KitchenItem[] = [
      { id: 'broth', name: 'Vegetable broth', emoji: '🥫', location: 'pantry', stockType: 'container', category: 'Pantry', fill: 1 },
    ]

    const matched = matchIngredient(ingredient, items).matchedItem!
    const control = usageControlFor(ingredient, matched)!
    expect(control).toEqual({ kind: 'container', initial: 0.15, step: 0.1 })

    // Two real "+" taps.
    useKitchenStore.getState().startCooking(recipe.id)
    useKitchenStore.getState().setActualUsage('broth', control.initial + control.step * 2)

    const actualUsage = useKitchenStore.getState().cookingSession!.actualUsage
    expect(actualUsage.broth).toBeCloseTo(0.35)

    const map = buildDeductionMap(recipe, items, actualUsage)
    expect(map.broth.newFill).toBeCloseTo(0.65) // 1 - 0.35, not the old fixed 0.15 default
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
