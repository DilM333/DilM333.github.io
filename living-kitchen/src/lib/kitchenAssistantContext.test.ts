import { describe, expect, it } from 'vitest'
import type { GroceryItem, KitchenItem, Recipe, RecipeIngredient } from '../data/types'
import { buildKitchenAssistantContext } from './kitchenAssistantContext'

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

function grocery(overrides: Partial<GroceryItem> & Pick<GroceryItem, 'id' | 'name'>): GroceryItem {
  return { emoji: '🥕', category: 'Produce', reason: 'test', checked: false, ...overrides }
}

function ing(overrides: Partial<RecipeIngredient> & Pick<RecipeIngredient, 'id' | 'name'>): RecipeIngredient {
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

describe('buildKitchenAssistantContext', () => {
  it('separates stocked vs out-of-stock kitchen items', () => {
    const items = [
      item({ id: 'eggs', name: 'Eggs', count: 4 }),
      item({ id: 'milk', name: 'Milk', stockType: 'container', fill: 0 }),
    ]
    const ctx = buildKitchenAssistantContext(items, [], [])
    expect(ctx.kitchen.stockedItems.map((i) => i.id)).toEqual(['eggs'])
    expect(ctx.kitchen.outOfStockItems.map((i) => i.id)).toEqual(['milk'])
    expect(ctx.kitchen.itemCount).toBe(2)
  })

  it('never treats a grocery-list item as stocked in the kitchen', () => {
    const items: KitchenItem[] = []
    const groceryList = [grocery({ id: 'g1', name: 'Eggs' })]
    const ctx = buildKitchenAssistantContext(items, groceryList, [])
    expect(ctx.kitchen.stockedItems).toHaveLength(0)
    expect(ctx.kitchen.itemCount).toBe(0)
    expect(ctx.grocery.itemCount).toBe(1)
    expect(ctx.grocery.items[0].name).toBe('Eggs')
  })

  it('groups a fully matched recipe under readyToMake', () => {
    const items = [item({ id: 'eggs', name: 'Eggs' })]
    const r = recipe({ id: 'ready', ingredients: [ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' })] })
    const ctx = buildKitchenAssistantContext(items, [], [r])
    expect(ctx.recipes.readyToMake.map((s) => s.id)).toEqual(['ready'])
    expect(ctx.recipes.nearlyReady).toHaveLength(0)
    expect(ctx.recipes.otherMatches).toHaveLength(0)
    expect(ctx.summary.readyRecipeCount).toBe(1)
  })

  it('groups a recipe missing 1-2 required ingredients under nearlyReady', () => {
    const items = [item({ id: 'eggs', name: 'Eggs' })]
    const r = recipe({
      id: 'nearly',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Rice', itemId: 'rice' }),
      ],
    })
    const ctx = buildKitchenAssistantContext(items, [], [r])
    expect(ctx.recipes.nearlyReady.map((s) => s.id)).toEqual(['nearly'])
    expect(ctx.summary.nearlyReadyRecipeCount).toBe(1)
  })

  it('groups a recipe missing 3+ required ingredients under otherMatches', () => {
    const r = recipe({
      id: 'far',
      ingredients: [
        ing({ id: 'i1', name: 'A', itemId: 'a' }),
        ing({ id: 'i2', name: 'B', itemId: 'b' }),
        ing({ id: 'i3', name: 'C', itemId: 'c' }),
      ],
    })
    const ctx = buildKitchenAssistantContext([], [], [r])
    expect(ctx.recipes.otherMatches.map((s) => s.id)).toEqual(['far'])
  })

  it('represents custom ingredients correctly in the kitchen snapshot', () => {
    const items = [item({ id: 'custom-dragonfruit-nectar', name: 'Dragonfruit Nectar', custom: true })]
    const ctx = buildKitchenAssistantContext(items, [], [])
    expect(ctx.kitchen.stockedItems[0]).toMatchObject({
      id: 'custom-dragonfruit-nectar',
      name: 'Dragonfruit Nectar',
      custom: true,
    })
  })

  it('a custom ingredient still resolves as an available recipe ingredient', () => {
    const items = [item({ id: 'custom-dragonfruit-nectar', name: 'Dragonfruit Nectar', custom: true })]
    const r = recipe({
      id: 'custom-recipe',
      ingredients: [ing({ id: 'i1', name: 'Dragonfruit Nectar' })],
    })
    const ctx = buildKitchenAssistantContext(items, [], [r])
    expect(ctx.recipes.readyToMake.map((s) => s.id)).toEqual(['custom-recipe'])
  })

  it('missing ingredient counts match matchRecipe exactly', () => {
    const items = [item({ id: 'eggs', name: 'Eggs' })]
    const r = recipe({
      id: 'partial',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Rice', itemId: 'rice' }),
        ing({ id: 'i3', name: 'Salt', itemId: 'salt' }),
      ],
    })
    const ctx = buildKitchenAssistantContext(items, [], [r])
    const summary = ctx.recipes.nearlyReady[0]
    expect(summary.requiredTotal).toBe(3)
    expect(summary.requiredAvailable).toBe(1)
    expect(summary.requiredMissing).toBe(2)
    expect(summary.matchPercent).toBe(33)
  })

  it('splits missing ingredients into on-grocery-list vs not, using the exact-name convention', () => {
    const items: KitchenItem[] = []
    const groceryList = [grocery({ id: 'g1', name: 'Chicken breast' })]
    const r = recipe({
      id: 'grocery-aware',
      ingredients: [
        ing({ id: 'i1', name: 'Chicken breast', itemId: 'chicken-breast' }),
        ing({ id: 'i2', name: 'Carrots', itemId: 'carrots' }),
      ],
    })
    const ctx = buildKitchenAssistantContext(items, groceryList, [r])
    const summary = ctx.recipes.nearlyReady[0]
    expect(summary.missingIngredientsOnGroceryList).toEqual(['Chicken breast'])
    expect(summary.missingIngredientsNotOnGroceryList).toEqual(['Carrots'])
  })
})
