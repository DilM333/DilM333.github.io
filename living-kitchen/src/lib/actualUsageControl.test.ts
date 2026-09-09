import { describe, expect, it } from 'vitest'
import type { KitchenItem, RecipeIngredient } from '../data/types'
import { usageControlFor } from './actualUsageControl'

function item(overrides: Partial<KitchenItem> & Pick<KitchenItem, 'id' | 'name'>): KitchenItem {
  return {
    emoji: '🥕',
    location: 'pantry',
    stockType: 'countable',
    category: 'Produce',
    count: 5,
    ...overrides,
  }
}

function ing(overrides: Partial<RecipeIngredient> & Pick<RecipeIngredient, 'id' | 'name'>): RecipeIngredient {
  return { emoji: '🥕', quantity: '1', ...overrides }
}

describe('usageControlFor', () => {
  it('1. countable, no requiredAmount: initializes from the display quantity string', () => {
    const matched = item({ id: 'chicken-breast', name: 'Chicken breast', count: 6 })
    const ingredient = ing({ id: 'i1', name: 'Chicken breast', itemId: 'chicken-breast', quantity: '2 pieces' })
    expect(usageControlFor(ingredient, matched)).toEqual({ kind: 'countable', initial: 2, step: 1 })
  })

  it('2. countable, requiredAmount present: wins over the display quantity string', () => {
    const matched = item({ id: 'potatoes', name: 'Potatoes', count: 6 })
    const ingredient = ing({
      id: 'i1',
      name: 'Potatoes',
      itemId: 'potatoes',
      quantity: '1', // deliberately a different number than requiredAmount
      requiredAmount: 4,
      requiredUnit: 'count',
    })
    expect(usageControlFor(ingredient, matched)).toEqual({ kind: 'countable', initial: 4, step: 1 })
  })

  it('3. divisible, requiredAmount present: used as the initial value', () => {
    const matched = item({ id: 'onion', name: 'Onion', stockType: 'divisible', fraction: 1 })
    const ingredient = ing({
      id: 'i1',
      name: 'Onion',
      itemId: 'onion',
      quantity: '½',
      requiredAmount: 0.5,
      requiredUnit: 'fraction',
    })
    expect(usageControlFor(ingredient, matched)).toEqual({ kind: 'divisible', initial: 0.5, step: 0.25 })
  })

  it('4. divisible, no requiredAmount, unparseable glyph quantity: never consults the string, uses the fixed fallback', () => {
    const matched = item({ id: 'onion', name: 'Onion', stockType: 'divisible', fraction: 1 })
    // "½" has no ASCII digit — this is exactly the old bug's failure case.
    // The correct result must be the divisible fallback (0.25), never the
    // string-parsing fallback (1) a countable-style parse would produce.
    const ingredient = ing({ id: 'i1', name: 'Onion', itemId: 'onion', quantity: '½' })
    expect(usageControlFor(ingredient, matched)).toEqual({ kind: 'divisible', initial: 0.25, step: 0.25 })
  })

  it('5. container, requiredAmount present: used as the initial value', () => {
    const matched = item({ id: 'broth', name: 'Vegetable broth', stockType: 'container', fill: 1 })
    const ingredient = ing({
      id: 'i1',
      name: 'Vegetable broth',
      itemId: 'broth',
      quantity: '2 cups',
      requiredAmount: 0.5,
      requiredUnit: 'fill',
    })
    expect(usageControlFor(ingredient, matched)).toEqual({ kind: 'container', initial: 0.5, step: 0.1 })
  })

  it('6. container, no requiredAmount: never parses "2 cups", uses the fixed fallback', () => {
    const matched = item({ id: 'broth', name: 'Vegetable broth', stockType: 'container', fill: 1 })
    const ingredient = ing({ id: 'i1', name: 'Vegetable broth', itemId: 'broth', quantity: '2 cups' })
    expect(usageControlFor(ingredient, matched)).toEqual({ kind: 'container', initial: 0.15, step: 0.1 })
  })

  it('7. staple: no control at all, regardless of any seeded requiredAmount/level', () => {
    const matched = item({ id: 'pasta', name: 'Pasta', stockType: 'staple', level: 'plenty' })
    const ingredient = ing({
      id: 'i1',
      name: 'Pasta',
      itemId: 'pasta',
      quantity: '1 box',
      requiredAmount: 3,
      requiredUnit: 'level',
    })
    expect(usageControlFor(ingredient, matched)).toBeNull()
  })

  it('8. incompatible requiredUnit: falls back to the type default rather than misapplying the mismatched number', () => {
    // Authored as a countable requirement, but the ingredient's own matched
    // item is divisible — never trust requiredAmount across a mismatched unit.
    const matched = item({ id: 'onion', name: 'Onion', stockType: 'divisible', fraction: 1 })
    const ingredient = ing({
      id: 'i1',
      name: 'Onion',
      itemId: 'onion',
      quantity: '1',
      requiredAmount: 4,
      requiredUnit: 'count',
    })
    expect(usageControlFor(ingredient, matched)).toEqual({ kind: 'divisible', initial: 0.25, step: 0.25 })
  })

  it('9. substitute-awareness: behavior comes from the matched item, not the originally-requested itemId', () => {
    // The ingredient asks for red-onion; the kitchen only has yellow-onion,
    // an approved substitute (see data/catalog.ts). matchIngredient resolves
    // this upstream — usageControlFor is given the already-matched item
    // directly and must derive everything from it.
    const matchedSubstitute = item({
      id: 'yellow-onion',
      name: 'Yellow Onion',
      stockType: 'divisible',
      fraction: 2,
    })
    const ingredient = ing({
      id: 'i1',
      name: 'Red onion',
      itemId: 'red-onion',
      quantity: '½',
      requiredAmount: 0.5,
      requiredUnit: 'fraction',
    })
    expect(usageControlFor(ingredient, matchedSubstitute)).toEqual({
      kind: 'divisible',
      initial: 0.5,
      step: 0.25,
    })
  })

  it('10. unmatched ingredients are the caller\'s responsibility, not this function\'s — documented contract only', () => {
    // usageControlFor takes an already-resolved KitchenItem; there is no
    // "unmatched" input to this function by construction — the caller
    // (ChangeSomethingSheet) is responsible for excluding ingredients with
    // no matched item before ever calling this. This test documents that
    // contract by confirming the function still behaves correctly given any
    // real matched item, with nothing implicitly assuming a match exists
    // beyond what's passed in.
    const matched = item({ id: 'eggs', name: 'Eggs', count: 3 })
    const ingredient = ing({ id: 'i1', name: 'Eggs', itemId: 'eggs', quantity: '3' })
    expect(usageControlFor(ingredient, matched)).toEqual({ kind: 'countable', initial: 3, step: 1 })
  })

  it('11. servings ratio: a compatible requiredAmount-based initial value scales with the current cook\'s ratio', () => {
    const matched = item({ id: 'potatoes', name: 'Potatoes', count: 10 })
    const ingredient = ing({
      id: 'i1',
      name: 'Potatoes',
      itemId: 'potatoes',
      requiredAmount: 4,
      requiredUnit: 'count',
    })
    expect(usageControlFor(ingredient, matched, 1)).toEqual({ kind: 'countable', initial: 4, step: 1 })
    expect(usageControlFor(ingredient, matched, 2)).toEqual({ kind: 'countable', initial: 8, step: 1 })
  })
})
