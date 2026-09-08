import { describe, expect, it } from 'vitest'
import type { GroceryItem, KitchenItem, Recipe, RecipeIngredient } from '../data/types'
import { getKitchenAssistantGreeting, getKitchenAssistantResponse } from './kitchenAssistant'
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
    mealTypes: ['dinner'],
    description: 'A recipe for testing.',
    steps: [],
    ...overrides,
  }
}

describe('getKitchenAssistantResponse', () => {
  it('"without shopping" returns only Ready to Make recipes when any exist', () => {
    const items = [item({ id: 'eggs', name: 'Eggs' }), item({ id: 'rice', name: 'Rice' })]
    const ready = recipe({ id: 'ready', name: 'Fried Rice', ingredients: [ing({ id: 'i1', name: 'Rice', itemId: 'rice' })] })
    const notReady = recipe({
      id: 'not-ready',
      name: 'Beef Stew',
      ingredients: [ing({ id: 'i1', name: 'Beef', itemId: 'beef' })],
    })
    const context = buildKitchenAssistantContext(items, [], [ready, notReady])
    const response = getKitchenAssistantResponse('what can I make without shopping?', context)
    expect(response.recipeIds).toEqual(['ready'])
    expect(response.message).toContain('ready to make right now')
    expect(response.message).toContain('Fried Rice')
  })

  it('"quick" prioritizes quick-tagged recipes over a better-matched non-quick recipe', () => {
    const items = [item({ id: 'eggs', name: 'Eggs' })]
    const quickButPartial = recipe({
      id: 'quick-one',
      name: 'Quick Eggs',
      tags: ['quick'],
      ingredients: [ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }), ing({ id: 'i2', name: 'Toast', itemId: 'toast' })],
    })
    const readyButSlow = recipe({
      id: 'slow-one',
      name: 'Slow Roast',
      tags: [],
      ingredients: [ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' })],
    })
    const context = buildKitchenAssistantContext(items, [], [readyButSlow, quickButPartial])
    const response = getKitchenAssistantResponse('something quick', context)
    expect(response.recipeIds[0]).toBe('quick-one')
  })

  it('"chicken" prioritizes recipes that contain chicken', () => {
    const items = [item({ id: 'eggs', name: 'Eggs' }), item({ id: 'chicken-breast', name: 'Chicken breast' })]
    const chickenRecipe = recipe({
      id: 'chicken-rice',
      name: 'Chicken and Rice',
      ingredients: [
        ing({ id: 'i1', name: 'Chicken breast', itemId: 'chicken-breast' }),
        ing({ id: 'i2', name: 'Rice', itemId: 'rice' }),
      ],
    })
    const eggRecipe = recipe({
      id: 'omelet',
      name: 'Omelet',
      ingredients: [ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' })],
    })
    const context = buildKitchenAssistantContext(items, [], [eggRecipe, chickenRecipe])
    const response = getKitchenAssistantResponse('something with chicken', context)
    expect(response.recipeIds[0]).toBe('chicken-rice')
    expect(response.message).toContain('Chicken and Rice')
    expect(response.message).toContain('chicken')
  })

  it('"no pasta" excludes pasta recipes when an alternative exists', () => {
    const items = [item({ id: 'eggs', name: 'Eggs' })]
    const pasta = recipe({
      id: 'pasta-dish',
      name: 'Simple Pasta',
      tags: [],
      ingredients: [ing({ id: 'i1', name: 'Pasta', itemId: 'pasta' })],
    })
    const alt = recipe({
      id: 'omelet',
      name: 'Omelet',
      ingredients: [ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' })],
    })
    const context = buildKitchenAssistantContext(items, [], [pasta, alt])
    const response = getKitchenAssistantResponse("I don't want pasta tonight", context)
    expect(response.recipeIds).not.toContain('pasta-dish')
    expect(response.recipeIds).toContain('omelet')
  })

  it('grocery-aware missing text distinguishes already-on-list from not-yet-added', () => {
    // A stocked-but-unrelated item keeps the kitchen non-empty so the
    // "empty kitchen" override doesn't short-circuit this scenario.
    const items = [item({ id: 'salt', name: 'Salt' })]
    const groceryList = [grocery({ id: 'g1', name: 'Chicken breast' })]
    const r = recipe({
      id: 'chicken-and-rice',
      name: 'Chicken and Rice',
      ingredients: [
        ing({ id: 'i1', name: 'Chicken breast', itemId: 'chicken-breast' }),
        ing({ id: 'i2', name: 'Vegetable broth', itemId: 'broth' }),
        ing({ id: 'i3', name: 'Carrots', itemId: 'carrots' }),
      ],
    })
    const context = buildKitchenAssistantContext(items, groceryList, [r])
    const response = getKitchenAssistantResponse('something with chicken', context)
    expect(response.message).toContain('Vegetable broth')
    expect(response.message).toContain('Carrots')
    expect(response.message).toContain('already on your grocery list')
    // Never claims Chicken breast is missing-and-not-on-list, and never
    // claims it's in the kitchen either — it's correctly on the grocery list only.
    expect(response.message).not.toMatch(/Chicken breast.*need/)
  })

  it('never claims an out-of-stock ingredient is available', () => {
    const items = [item({ id: 'milk', name: 'Milk', stockType: 'container', fill: 0 })]
    const r = recipe({ id: 'r1', name: 'Milk Toast', ingredients: [ing({ id: 'i1', name: 'Milk', itemId: 'milk' })] })
    const context = buildKitchenAssistantContext(items, [], [r])
    const response = getKitchenAssistantResponse('what can I make?', context)
    // Milk is present in the kitchen but out of stock — must show as missing.
    const summary = context.recipes.otherMatches.concat(context.recipes.nearlyReady).find((s) => s.id === 'r1')
    expect(summary?.requiredMissing).toBe(1)
    expect(response.message).not.toMatch(/have everything for Milk Toast/)
  })

  it('handles an empty kitchen with a sensible, non-crashing response', () => {
    const context = buildKitchenAssistantContext([], [], [])
    const response = getKitchenAssistantResponse('what can I make?', context)
    expect(response.message).toContain('kitchen is empty')
    expect(response.recipeIds).toEqual([])
  })

  it('handles zero ready recipes without crashing, falling back to the closest option', () => {
    const items = [item({ id: 'eggs', name: 'Eggs' })]
    const r = recipe({
      id: 'far',
      name: 'Elaborate Feast',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Truffle', itemId: 'truffle' }),
        ing({ id: 'i3', name: 'Caviar', itemId: 'caviar' }),
      ],
    })
    const context = buildKitchenAssistantContext(items, [], [r])
    expect(context.summary.readyRecipeCount).toBe(0)
    const response = getKitchenAssistantResponse('what can I make without shopping?', context)
    expect(response.message).not.toContain('ready to make right now')
    expect(response.recipeIds).toEqual(['far'])
  })
})

describe('getKitchenAssistantGreeting', () => {
  it('mentions ready count when ready recipes exist', () => {
    const items = [item({ id: 'eggs', name: 'Eggs' })]
    const r = recipe({ id: 'r1', ingredients: [ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' })] })
    const context = buildKitchenAssistantContext(items, [], [r])
    expect(getKitchenAssistantGreeting(context)).toBe('You have 1 meal ready to make.')
  })

  it('mentions an empty kitchen', () => {
    const context = buildKitchenAssistantContext([], [], [])
    expect(getKitchenAssistantGreeting(context)).toContain('kitchen is empty')
  })
})
