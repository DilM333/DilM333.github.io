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
