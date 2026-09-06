import { describe, expect, it } from 'vitest'
import type { KitchenItem, Recipe, RecipeIngredient } from '../data/types'
import { isIngredientAvailable, matchRecipe, matchStatusLabel, rankRecipes } from './recipeMatch'

function ing(overrides: Partial<RecipeIngredient> & Pick<RecipeIngredient, 'id' | 'name'>): RecipeIngredient {
  return { emoji: '🥕', quantity: '1', ...overrides }
}

function item(overrides: Partial<KitchenItem> & Pick<KitchenItem, 'id' | 'name'>): KitchenItem {
  return {
    emoji: '🥕',
    location: 'pantry',
    stockType: 'countable',
    category: 'Produce',
    count: 1,
    ...overrides,
  }
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

describe('isIngredientAvailable', () => {
  it('matches by itemId when present', () => {
    const items = [item({ id: 'eggs', name: 'Eggs', count: 4 })]
    expect(isIngredientAvailable(ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }), items)).toBe(true)
  })

  it('is false when the item has zero stock, even if the row exists', () => {
    const items = [item({ id: 'eggs', name: 'Eggs', count: 0 })]
    expect(isIngredientAvailable(ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }), items)).toBe(false)
  })

  it('falls back to a case/whitespace-insensitive name match when there is no itemId', () => {
    const items = [item({ id: 'ground-beef', name: 'Ground Beef', category: 'Meat' })]
    expect(isIngredientAvailable(ing({ id: 'i1', name: '  ground beef  ' }), items)).toBe(true)
  })

  it('matches a custom ingredient by name even though its local id is unrelated to the recipe', () => {
    const items = [
      item({ id: 'custom-dragonfruit-nectar', name: 'Dragonfruit Nectar', custom: true, count: 2 }),
    ]
    expect(isIngredientAvailable(ing({ id: 'i1', name: 'Dragonfruit Nectar' }), items)).toBe(true)
  })

  it('is case-insensitive for the name fallback', () => {
    const items = [item({ id: 'bell-pepper', name: 'Bell Pepper' })]
    expect(isIngredientAvailable(ing({ id: 'i1', name: 'BELL PEPPER' }), items)).toBe(true)
  })

  it('is false when nothing in the kitchen matches', () => {
    expect(isIngredientAvailable(ing({ id: 'i1', name: 'Saffron' }), [])).toBe(false)
  })
})

describe('matchRecipe', () => {
  it('reports a fully matched recipe as ready with 100% and zero missing', () => {
    const items = [item({ id: 'eggs', name: 'Eggs' }), item({ id: 'rice', name: 'Rice' })]
    const r = recipe({
      id: 'fully-matched',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Rice', itemId: 'rice' }),
      ],
    })
    const match = matchRecipe(r, items)
    expect(match.requiredTotal).toBe(2)
    expect(match.requiredAvailable).toBe(2)
    expect(match.requiredMissing).toBe(0)
    expect(match.matchPercent).toBe(100)
    expect(match.isReady).toBe(true)
    expect(matchStatusLabel(match)).toBe('Ready to make')
  })

  it('reports a partially matched recipe with the right counts and percentage', () => {
    const items = [item({ id: 'eggs', name: 'Eggs' })]
    const r = recipe({
      id: 'partial',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Rice', itemId: 'rice' }),
        ing({ id: 'i3', name: 'Carrots', itemId: 'carrots' }),
      ],
    })
    const match = matchRecipe(r, items)
    expect(match.requiredTotal).toBe(3)
    expect(match.requiredAvailable).toBe(1)
    expect(match.requiredMissing).toBe(2)
    expect(match.matchPercent).toBe(33)
    expect(match.isReady).toBe(false)
    expect(matchStatusLabel(match)).toBe('2 ingredients missing')
  })

  it('reports a completely unmatched recipe as 0%', () => {
    const r = recipe({
      id: 'unmatched',
      ingredients: [ing({ id: 'i1', name: 'Saffron' }), ing({ id: 'i2', name: 'Truffle' })],
    })
    const match = matchRecipe(r, [])
    expect(match.requiredAvailable).toBe(0)
    expect(match.requiredMissing).toBe(2)
    expect(match.matchPercent).toBe(0)
    expect(match.isReady).toBe(false)
    expect(matchStatusLabel(match)).toBe('2 ingredients missing')
  })

  it('does not let optional ingredients affect the score either way', () => {
    const items = [item({ id: 'eggs', name: 'Eggs' })]
    const r = recipe({
      id: 'with-optional',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Parmesan', itemId: 'parmesan', optional: true }),
      ],
    })
    const match = matchRecipe(r, items)
    expect(match.requiredTotal).toBe(1)
    expect(match.matchPercent).toBe(100)
    expect(match.isReady).toBe(true)
    expect(match.missingOptionalIngredients.map((i) => i.name)).toEqual(['Parmesan'])
  })

  it('treats a recipe with no required ingredients as trivially ready', () => {
    const r = recipe({
      id: 'all-optional',
      ingredients: [ing({ id: 'i1', name: 'Garnish', optional: true })],
    })
    const match = matchRecipe(r, [])
    expect(match.requiredTotal).toBe(0)
    expect(match.matchPercent).toBe(100)
    expect(match.isReady).toBe(true)
  })

  it('handles an empty kitchen as everything missing, not a crash', () => {
    const r = recipe({ id: 'empty-kitchen', ingredients: [ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' })] })
    expect(() => matchRecipe(r, [])).not.toThrow()
    expect(matchRecipe(r, []).requiredMissing).toBe(1)
  })
})

describe('rankRecipes', () => {
  it('sorts by fewest missing, then highest match %, then name', () => {
    const items = [item({ id: 'eggs', name: 'Eggs' }), item({ id: 'rice', name: 'Rice' })]
    const zeroMissingA = recipe({
      id: 'z-recipe',
      name: 'Z Recipe',
      ingredients: [ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' })],
    })
    const zeroMissingB = recipe({
      id: 'a-recipe',
      name: 'A Recipe',
      ingredients: [ing({ id: 'i1', name: 'Rice', itemId: 'rice' })],
    })
    const oneMissing = recipe({
      id: 'one-missing',
      name: 'One Missing',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Salt', itemId: 'salt' }),
      ],
    })
    const ranked = rankRecipes([oneMissing, zeroMissingA, zeroMissingB], items)
    // Both zero-missing recipes tie on missing count (0) and match% (100),
    // so the name tie-break should put "A Recipe" before "Z Recipe".
    expect(ranked.map((m) => m.recipe.id)).toEqual(['a-recipe', 'z-recipe', 'one-missing'])
  })
})
