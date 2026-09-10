import { describe, expect, it } from 'vitest'
import type { CatalogEntry } from '../data/catalog'
import type { Recipe } from '../data/types'
import { detectQuerySignals } from './askKitchenQuery'

function recipe(overrides: Partial<Recipe> & Pick<Recipe, 'id' | 'name'>): Recipe {
  return {
    emoji: '🍽️',
    time: 20,
    effortLabel: 'Easy',
    effort: 'Normal',
    tags: [],
    mealTypes: ['dinner'],
    servings: 2,
    description: '',
    ingredients: [],
    steps: [],
    ...overrides,
  }
}

function catalogEntry(overrides: Partial<CatalogEntry> & Pick<CatalogEntry, 'id' | 'name'>): CatalogEntry {
  return { emoji: '🥕', category: 'Produce', location: 'fridge', stockType: 'countable', ...overrides }
}

const CATALOG = [
  catalogEntry({ id: 'chicken-breast', name: 'Chicken breast' }),
  catalogEntry({ id: 'yellow-onion', name: 'Yellow Onion', aliases: ['white onion'] }),
]

const RECIPES = [recipe({ id: 'chicken-and-rice', name: 'Chicken and Rice' })]

describe('detectQuerySignals', () => {
  it('reads meal-type words, deduplicated', () => {
    expect(detectQuerySignals('what can I make for dinner', RECIPES, CATALOG).mealTypes).toEqual(['dinner'])
    expect(detectQuerySignals('breakfast or lunch', RECIPES, CATALOG).mealTypes).toEqual(['breakfast', 'lunch'])
  })

  it('treats "sweet"/"sweets" as a dessert signal', () => {
    expect(detectQuerySignals('I want something sweet', RECIPES, CATALOG).mealTypes).toEqual(['dessert'])
  })

  it('finds no meal-type constraint in a message that names none', () => {
    expect(detectQuerySignals("what's quick", RECIPES, CATALOG).mealTypes).toEqual([])
  })

  it('detects quick/fast wording', () => {
    expect(detectQuerySignals('something quick tonight', RECIPES, CATALOG).wantsQuick).toBe(true)
    expect(detectQuerySignals('a slow braise', RECIPES, CATALOG).wantsQuick).toBe(false)
  })

  it('parses an explicit minutes mention', () => {
    expect(detectQuerySignals('something under 20 minutes', RECIPES, CATALOG).maxTimeMinutes).toBe(20)
    expect(detectQuerySignals('a 15-min dinner', RECIPES, CATALOG).maxTimeMinutes).toBe(15)
    expect(detectQuerySignals('anything at all', RECIPES, CATALOG).maxTimeMinutes).toBeUndefined()
  })

  it('detects a mentioned catalog ingredient by canonical name or alias', () => {
    expect(detectQuerySignals('can I make anything with the chicken I have?', RECIPES, CATALOG).mentionedItemIds).toContain(
      'chicken-breast',
    )
    expect(detectQuerySignals('I have some white onion', RECIPES, CATALOG).mentionedItemIds).toContain('yellow-onion')
  })

  it('does not false-positive on a substring that is not a whole word', () => {
    // "chick" should not match "chicken breast" as a word-boundary hit.
    expect(detectQuerySignals('I saw a chick outside', RECIPES, CATALOG).mentionedItemIds).toEqual([])
  })

  it('detects a mentioned recipe by its exact name', () => {
    expect(detectQuerySignals('can I make chicken and rice tonight?', RECIPES, CATALOG).mentionedRecipeIds).toEqual([
      'chicken-and-rice',
    ])
  })

  it('leaves mood/fuzzy language entirely undetected — that is the model\'s job', () => {
    const signals = detectQuerySignals('something cozy but not heavy', RECIPES, CATALOG)
    expect(signals.mealTypes).toEqual([])
    expect(signals.wantsQuick).toBe(false)
    expect(signals.mentionedItemIds).toEqual([])
    expect(signals.mentionedRecipeIds).toEqual([])
  })
})
