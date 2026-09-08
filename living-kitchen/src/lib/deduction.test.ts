import { describe, expect, it } from 'vitest'
import type { KitchenItem, Recipe, RecipeIngredient } from '../data/types'
import { buildDeductionMap, suggestDeduction } from './deduction'

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

function ing(
  overrides: Partial<RecipeIngredient> & Pick<RecipeIngredient, 'id' | 'name'>,
): RecipeIngredient {
  return { emoji: '🥕', quantity: '1', ...overrides }
}

function recipe(overrides: Partial<Recipe> & Pick<Recipe, 'id' | 'ingredients'>): Recipe {
  return {
    name: 'Test Recipe',
    emoji: '🍽️',
    time: 20,
    effortLabel: 'Easy',
    effort: 'Normal',
    tags: [],
    mealTypes: ['dinner'],
    description: 'A recipe for testing.',
    steps: [],
    ...overrides,
  }
}

describe('buildDeductionMap', () => {
  it('only contains entries for ingredients the current recipe actually resolves', () => {
    const items = [
      item({ id: 'eggs', name: 'Eggs', count: 6 }),
      item({ id: 'flour', name: 'Flour', stockType: 'staple', level: 'plenty' }),
    ]
    const r = recipe({
      id: 'omelette',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Rice', itemId: 'rice' }), // not in the kitchen -> skipped
      ],
    })

    const map = buildDeductionMap(r, items)

    expect(Object.keys(map)).toEqual(['eggs'])
    expect(map.eggs).toEqual(suggestDeduction(items[0], 1))
  })

  it('keys deductions by the MATCHED item, so a substitute is deducted from the stand-in', () => {
    // red-onion <-> yellow-onion are approved substitutes (see catalog).
    const items = [item({ id: 'yellow-onion', name: 'Yellow Onion', stockType: 'divisible', fraction: 1 })]
    const r = recipe({
      id: 'sub',
      ingredients: [ing({ id: 'i1', name: 'Red onion', itemId: 'red-onion' })],
    })

    const map = buildDeductionMap(r, items)

    expect(Object.keys(map)).toEqual(['yellow-onion'])
  })

  it('uses actualUsage (keyed by the recipe ingredient itemId) when provided, else 1', () => {
    const items = [item({ id: 'eggs', name: 'Eggs', count: 6 })]
    const r = recipe({ id: 'r', ingredients: [ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' })] })

    expect(buildDeductionMap(r, items, { eggs: 3 }).eggs.newCount).toBe(3)
    expect(buildDeductionMap(r, items).eggs.newCount).toBe(5)
  })

  it('regression (Finished.tsx stale deductions): switching recipe fully replaces the map', () => {
    // The Finished screen seeds `deductions` from this map. When a client-side
    // nav goes /recipe/A/finished -> /recipe/B/finished without a remount, the
    // map recomputed for B must share no keys with A's — never a stale carry-over.
    const items = [
      item({ id: 'eggs', name: 'Eggs', count: 6 }),
      item({ id: 'butter', name: 'Butter', stockType: 'container', fill: 1 }),
      item({ id: 'sugar', name: 'Sugar', stockType: 'staple', level: 'plenty' }),
    ]
    const recipeA = recipe({
      id: 'A',
      ingredients: [ing({ id: 'a1', name: 'Eggs', itemId: 'eggs' })],
    })
    const recipeB = recipe({
      id: 'B',
      ingredients: [
        ing({ id: 'b1', name: 'Butter', itemId: 'butter' }),
        ing({ id: 'b2', name: 'Sugar', itemId: 'sugar' }),
      ],
    })

    const mapA = buildDeductionMap(recipeA, items)
    const mapB = buildDeductionMap(recipeB, items)

    expect(Object.keys(mapA)).toEqual(['eggs'])
    expect(Object.keys(mapB).sort()).toEqual(['butter', 'sugar'])
    expect(Object.keys(mapB)).not.toContain('eggs')
  })
})

describe('buildDeductionMap: structured requiredAmount used when compatible and no explicit actualUsage', () => {
  it('countable: deducts the recipe\'s required count instead of the fixed default of 1', () => {
    const items = [item({ id: 'potatoes', name: 'Potatoes', count: 6 })]
    const r = recipe({
      id: 'r',
      ingredients: [
        ing({ id: 'i1', name: 'Potatoes', itemId: 'potatoes', requiredAmount: 4, requiredUnit: 'count' }),
      ],
    })
    expect(buildDeductionMap(r, items).potatoes.newCount).toBe(2)
  })

  it('divisible: deducts the recipe\'s required fraction instead of the fixed default of 0.25', () => {
    const items = [item({ id: 'onion', name: 'Onion', stockType: 'divisible', fraction: 1 })]
    const r = recipe({
      id: 'r',
      ingredients: [
        ing({ id: 'i1', name: 'Onion', itemId: 'onion', requiredAmount: 0.5, requiredUnit: 'fraction' }),
      ],
    })
    expect(buildDeductionMap(r, items).onion.newFraction).toBe(0.5)
  })

  it('container: deducts the recipe\'s required fill instead of the fixed default of 0.15', () => {
    const items = [item({ id: 'broth', name: 'Broth', stockType: 'container', fill: 1 })]
    const r = recipe({
      id: 'r',
      ingredients: [
        ing({ id: 'i1', name: 'Broth', itemId: 'broth', requiredAmount: 0.5, requiredUnit: 'fill' }),
      ],
    })
    expect(buildDeductionMap(r, items).broth.newFill).toBe(0.5)
  })

  it('staple/level: never treats requiredAmount as a quantity consumed — always steps down exactly one tier', () => {
    const items = [item({ id: 'pasta', name: 'Pasta', stockType: 'staple', level: 'plenty' })]
    const r = recipe({
      id: 'r',
      // A staple-level "3" here means "needs a well-stocked pantry" (see
      // beef-bolognese in the real seed data), never "uses 3 tiers".
      ingredients: [
        ing({ id: 'i1', name: 'Pasta', itemId: 'pasta', requiredAmount: 3, requiredUnit: 'level' }),
      ],
    })
    expect(buildDeductionMap(r, items).pasta.newLevel).toBe('some')
  })

  it('falls back to the fixed default when requiredUnit is incompatible with the resolved item\'s real stock type', () => {
    // Authored as a countable requirement, but the item that actually
    // resolved this ingredient is a container — never guess a conversion.
    const items = [item({ id: 'broth', name: 'Broth', stockType: 'container', fill: 1 })]
    const r = recipe({
      id: 'r',
      ingredients: [
        ing({ id: 'i1', name: 'Broth', itemId: 'broth', requiredAmount: 4, requiredUnit: 'count' }),
      ],
    })
    // Fixed container fallback (0.15), not a nonsensical count-based amount.
    expect(buildDeductionMap(r, items).broth.newFill).toBe(0.85)
  })

  it('clamps at zero when the required amount exceeds what is on hand', () => {
    const items = [item({ id: 'potatoes', name: 'Potatoes', count: 2 })]
    const r = recipe({
      id: 'r',
      ingredients: [
        ing({ id: 'i1', name: 'Potatoes', itemId: 'potatoes', requiredAmount: 5, requiredUnit: 'count' }),
      ],
    })
    expect(buildDeductionMap(r, items).potatoes.newCount).toBe(0)
  })
})

describe('buildDeductionMap: the actualUsage dead path is fixed for divisible and container', () => {
  it('an explicit actualUsage now changes a divisible deduction (previously silently ignored)', () => {
    const items = [item({ id: 'onion', name: 'Onion', stockType: 'divisible', fraction: 1 })]
    const r = recipe({
      id: 'r',
      ingredients: [ing({ id: 'i1', name: 'Onion', itemId: 'onion' })],
    })
    expect(buildDeductionMap(r, items, { onion: 0.5 }).onion.newFraction).toBe(0.5)
    // No actualUsage at all -> the unchanged fixed fallback.
    expect(buildDeductionMap(r, items).onion.newFraction).toBe(0.75)
  })

  it('an explicit actualUsage now changes a container deduction (previously silently ignored)', () => {
    const items = [item({ id: 'broth', name: 'Broth', stockType: 'container', fill: 1 })]
    const r = recipe({
      id: 'r',
      ingredients: [ing({ id: 'i1', name: 'Broth', itemId: 'broth' })],
    })
    expect(buildDeductionMap(r, items, { broth: 0.4 }).broth.newFill).toBe(0.6)
    expect(buildDeductionMap(r, items).broth.newFill).toBe(0.85)
  })

  it('clamps a divisible/container actualUsage at zero rather than going negative', () => {
    const itemsDiv = [item({ id: 'onion', name: 'Onion', stockType: 'divisible', fraction: 0.25 })]
    const rDiv = recipe({ id: 'r', ingredients: [ing({ id: 'i1', name: 'Onion', itemId: 'onion' })] })
    expect(buildDeductionMap(rDiv, itemsDiv, { onion: 2 }).onion.newFraction).toBe(0)

    const itemsContainer = [item({ id: 'broth', name: 'Broth', stockType: 'container', fill: 0.2 })]
    const rContainer = recipe({ id: 'r', ingredients: [ing({ id: 'i1', name: 'Broth', itemId: 'broth' })] })
    expect(buildDeductionMap(rContainer, itemsContainer, { broth: 2 }).broth.newFill).toBe(0)
  })
})

describe('buildDeductionMap: priority is explicit actualUsage > structured requiredAmount > fixed fallback', () => {
  it('an explicit actualUsage wins even when a compatible requiredAmount is also present', () => {
    const items = [item({ id: 'potatoes', name: 'Potatoes', count: 10 })]
    const r = recipe({
      id: 'r',
      ingredients: [
        ing({ id: 'i1', name: 'Potatoes', itemId: 'potatoes', requiredAmount: 4, requiredUnit: 'count' }),
      ],
    })
    // requiredAmount alone would deduct 4 (-> 6); actualUsage=7 must win (-> 3).
    expect(buildDeductionMap(r, items, { potatoes: 7 }).potatoes.newCount).toBe(3)
  })

  it('a compatible requiredAmount wins over the fixed fallback when no actualUsage is present', () => {
    const items = [item({ id: 'potatoes', name: 'Potatoes', count: 10 })]
    const r = recipe({
      id: 'r',
      ingredients: [
        ing({ id: 'i1', name: 'Potatoes', itemId: 'potatoes', requiredAmount: 4, requiredUnit: 'count' }),
      ],
    })
    // The fixed fallback would deduct 1 (-> 9); requiredAmount=4 must win (-> 6).
    expect(buildDeductionMap(r, items).potatoes.newCount).toBe(6)
  })

  it('the fixed fallback applies only when neither actualUsage nor a compatible requiredAmount exists', () => {
    const items = [item({ id: 'potatoes', name: 'Potatoes', count: 10 })]
    const r = recipe({ id: 'r', ingredients: [ing({ id: 'i1', name: 'Potatoes', itemId: 'potatoes' })] })
    expect(buildDeductionMap(r, items).potatoes.newCount).toBe(9)
  })
})
