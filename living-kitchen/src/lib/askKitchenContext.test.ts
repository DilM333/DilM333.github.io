import { describe, expect, it } from 'vitest'
import type { GroceryItem, KitchenItem, Recipe, RecipeIngredient } from '../data/types'
import { buildAskKitchenContext, selectCandidateRecipes } from './askKitchenContext'

type Signals = Parameters<typeof selectCandidateRecipes>[2]

function item(overrides: Partial<KitchenItem> & Pick<KitchenItem, 'id' | 'name'>): KitchenItem {
  return { emoji: '🥕', location: 'pantry', stockType: 'countable', category: 'Produce', count: 1, ...overrides }
}

function ing(overrides: Partial<RecipeIngredient> & Pick<RecipeIngredient, 'id' | 'name'>): RecipeIngredient {
  return { emoji: '🥕', quantity: '1', ...overrides }
}

function recipe(overrides: Partial<Recipe> & Pick<Recipe, 'id' | 'name' | 'ingredients'>): Recipe {
  return {
    emoji: '🍽️',
    time: 20,
    effortLabel: 'Easy',
    effort: 'Normal',
    tags: [],
    mealTypes: ['dinner'],
    servings: 2,
    description: '',
    steps: [],
    ...overrides,
  }
}

function grocery(overrides: Partial<GroceryItem> & Pick<GroceryItem, 'id' | 'name'>): GroceryItem {
  return { emoji: '🥕', category: 'Produce', reason: '', checked: false, ...overrides }
}

describe('selectCandidateRecipes', () => {
  it('a meal-type-filtered query keeps a lower-ranked matching recipe over a higher-ranked non-matching one', () => {
    const items = [item({ id: 'chicken-breast', name: 'Chicken breast', count: 2 })]
    const readyDinner = recipe({
      id: 'dinner-1',
      name: 'Ready Dinner',
      mealTypes: ['dinner'],
      ingredients: [ing({ id: 'i1', name: 'Chicken breast', itemId: 'chicken-breast' })],
    })
    const shortDessert = recipe({
      id: 'dessert-1',
      name: 'Short Dessert',
      mealTypes: ['dessert'],
      ingredients: [ing({ id: 'i1', name: 'Flour', itemId: 'flour' })], // not in kitchen -> needs-shopping
    })

    const signals: Signals = { mealTypes: ['dessert'], wantsQuick: false, mentionedRecipeIds: [], mentionedItemIds: [] }
    const picked = selectCandidateRecipes([readyDinner, shortDessert], items, signals, [], 12)

    // The globally-better-ranked dinner must NOT push out the query-matching
    // dessert just because it's less ready — this is the exact bug the
    // revision was meant to fix.
    expect(picked.map((m) => m.recipe.id)).toContain('dessert-1')
  })

  it('an explicitly mentioned recipe/ingredient is included even when it would not otherwise rank or match the query filter', () => {
    const items = [item({ id: 'chicken-breast', name: 'Chicken breast', count: 0 })] // out of stock -> ranks poorly
    const chickenRecipe = recipe({
      id: 'chicken-thing',
      name: 'Chicken Thing',
      mealTypes: ['dinner'],
      ingredients: [ing({ id: 'i1', name: 'Chicken breast', itemId: 'chicken-breast' })],
    })
    const unrelated = recipe({
      id: 'unrelated',
      name: 'Unrelated Snack',
      mealTypes: ['snack'],
      ingredients: [],
    })

    // Query filter is 'snack' (so chickenRecipe's 'dinner' mealType wouldn't
    // normally qualify), but the ingredient was explicitly mentioned.
    const signals: Signals = { mealTypes: ['snack'], wantsQuick: false, mentionedRecipeIds: [], mentionedItemIds: ['chicken-breast'] }
    const picked = selectCandidateRecipes([chickenRecipe, unrelated], items, signals, [], 12)

    expect(picked.map((m) => m.recipe.id)).toContain('chicken-thing')
  })

  it('broadens to the full ranked list when the query filter is too narrow to produce enough candidates', () => {
    const items: KitchenItem[] = []
    const dinners = [
      recipe({ id: 'd1', name: 'D1', mealTypes: ['dinner'], ingredients: [] }),
      recipe({ id: 'd2', name: 'D2', mealTypes: ['dinner'], ingredients: [] }),
    ]
    // No recipe at all matches 'breakfast' -> the query-filtered pool is empty.
    const signals: Signals = { mealTypes: ['breakfast'], wantsQuick: false, mentionedRecipeIds: [], mentionedItemIds: [] }
    const picked = selectCandidateRecipes(dinners, items, signals, [], 12)

    // Broadened rather than returning nothing.
    expect(picked.length).toBe(2)
  })

  it('always includes ids passed as extraAlwaysIncludeRecipeIds (the conversation anchor), regardless of rank', () => {
    const items: KitchenItem[] = []
    const anchored = recipe({ id: 'anchored', name: 'Anchored', mealTypes: ['dessert'], ingredients: [] })
    const other = recipe({ id: 'other', name: 'Other', mealTypes: ['dinner'], ingredients: [] })
    const signals: Signals = { mealTypes: ['dinner'], wantsQuick: false, mentionedRecipeIds: [], mentionedItemIds: [] }

    const picked = selectCandidateRecipes([anchored, other], items, signals, ['anchored'], 12)

    expect(picked.map((m) => m.recipe.id)).toContain('anchored')
  })

  it('never exceeds the requested cap', () => {
    const items: KitchenItem[] = []
    const many = Array.from({ length: 20 }, (_, i) => recipe({ id: `r${i}`, name: `R${i}`, ingredients: [] }))
    const signals: Signals = { mealTypes: [], wantsQuick: false, mentionedRecipeIds: [], mentionedItemIds: [] }
    expect(selectCandidateRecipes(many, items, signals, [], 5).length).toBe(5)
  })

  it('deduplicates a recipe that would otherwise be picked by both the query filter and a mention', () => {
    const items = [item({ id: 'chicken-breast', name: 'Chicken breast', count: 2 })]
    const r = recipe({
      id: 'chicken-and-rice',
      name: 'Chicken and Rice',
      mealTypes: ['dinner'],
      ingredients: [ing({ id: 'i1', name: 'Chicken breast', itemId: 'chicken-breast' })],
    })
    const signals: Signals = { mealTypes: ['dinner'], wantsQuick: false, mentionedRecipeIds: ['chicken-and-rice'], mentionedItemIds: [] }
    const picked = selectCandidateRecipes([r], items, signals, [], 12)
    expect(picked.map((m) => m.recipe.id)).toEqual(['chicken-and-rice'])
  })
})

describe('buildAskKitchenContext', () => {
  it('never sends more than the capped candidate count, raw quantities, or reservedFor free text', () => {
    const items: KitchenItem[] = [
      item({ id: 'chicken-breast', name: 'Chicken breast', count: 2, reserved: 0.5, reservedFor: 'A secret plan' }),
    ]
    const recipes = [recipe({ id: 'r1', name: 'R1', ingredients: [ing({ id: 'i1', name: 'Chicken breast', itemId: 'chicken-breast' })] })]

    const context = buildAskKitchenContext({
      message: 'what can I make',
      items,
      recipes,
      groceryList: [],
      favorites: [],
      cookingSession: null,
      maxCandidates: 12,
    })

    expect(context.candidateRecipes.length).toBeLessThanOrEqual(12)
    expect(context.reserved).toEqual([{ itemId: 'chicken-breast', name: 'Chicken breast' }])
    expect(JSON.stringify(context)).not.toContain('A secret plan')
    // No raw stock fields (count/fraction/fill/level) anywhere in the payload.
    expect(JSON.stringify(context)).not.toMatch(/"count":\s*\d/)
  })

  it('reports an empty kitchen honestly', () => {
    const context = buildAskKitchenContext({
      message: 'what can I make',
      items: [],
      recipes: [recipe({ id: 'r1', name: 'R1', ingredients: [] })],
      groceryList: [],
      favorites: [],
      cookingSession: null,
    })
    expect(context.kitchen.itemCount).toBe(0)
    expect(context.kitchen.hasAnyStock).toBe(false)
  })

  it('always includes the previously-recommended recipe ids for a follow-up, freshly re-resolved', () => {
    const items: KitchenItem[] = []
    const recipes = [
      recipe({ id: 'previous', name: 'Previous', mealTypes: ['dinner'], ingredients: [] }),
      recipe({ id: 'unrelated', name: 'Unrelated', mealTypes: ['snack'], ingredients: [] }),
    ]
    const context = buildAskKitchenContext({
      message: 'something quicker',
      items,
      recipes,
      groceryList: [],
      favorites: [],
      cookingSession: null,
      previousRecommendedRecipeIds: ['previous'],
    })
    expect(context.candidateRecipes.map((r) => r.id)).toContain('previous')
  })

  it('includes the current cooking session, when one exists, and omits it otherwise', () => {
    const withSession = buildAskKitchenContext({
      message: 'hi',
      items: [],
      recipes: [],
      groceryList: [],
      favorites: [],
      cookingSession: { recipeId: 'r1', targetServings: 4 },
    })
    expect(withSession.session).toEqual({ cookingRecipeId: 'r1', targetServings: 4 })

    const without = buildAskKitchenContext({
      message: 'hi',
      items: [],
      recipes: [],
      groceryList: [],
      favorites: [],
      cookingSession: null,
    })
    expect(without.session).toBeNull()
  })

  it('caps grocery item names and sends names only', () => {
    const groceryList = Array.from({ length: 20 }, (_, i) => grocery({ id: `g${i}`, name: `Item ${i}` }))
    const context = buildAskKitchenContext({
      message: 'hi',
      items: [],
      recipes: [],
      groceryList,
      favorites: [],
      cookingSession: null,
    })
    expect(context.groceryItemNames.length).toBeLessThanOrEqual(15)
    expect(context.groceryItemNames[0]).toBe('Item 0')
  })
})
