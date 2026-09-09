import { describe, expect, it } from 'vitest'
import type { Recipe, RecipeIngredient } from '../data/types'
import { formatKitchenFraction, scaledQuantityLabel, servingsRatio } from './scaleRecipe'

function recipe(overrides: Partial<Recipe> & Pick<Recipe, 'id' | 'ingredients'>): Recipe {
  return {
    name: 'Test',
    emoji: '🍽️',
    time: 10,
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

function ing(overrides: Partial<RecipeIngredient> & Pick<RecipeIngredient, 'id' | 'name'>): RecipeIngredient {
  return { emoji: '🥕', quantity: '1', ...overrides }
}

describe('servingsRatio', () => {
  it('divides target by the recipe base, unchanged at the same servings', () => {
    const r = recipe({ id: 'r', servings: 2, ingredients: [] })
    expect(servingsRatio(r, 2)).toBe(1)
    expect(servingsRatio(r, 4)).toBe(2)
    expect(servingsRatio(r, 1)).toBe(0.5)
  })

  it('never divides by zero for a malformed servings value', () => {
    const r = recipe({ id: 'r', servings: 0, ingredients: [] })
    expect(servingsRatio(r, 4)).toBe(1)
  })
})

describe('formatKitchenFraction', () => {
  it('renders whole+quarter-step glyphs with no space, per the approved examples', () => {
    expect(formatKitchenFraction(0.25)).toBe('¼')
    expect(formatKitchenFraction(0.5)).toBe('½')
    expect(formatKitchenFraction(0.75)).toBe('¾')
    expect(formatKitchenFraction(1)).toBe('1')
    expect(formatKitchenFraction(1.25)).toBe('1¼')
    expect(formatKitchenFraction(1.5)).toBe('1½')
    expect(formatKitchenFraction(1.75)).toBe('1¾')
    expect(formatKitchenFraction(2)).toBe('2')
  })

  it('renders eighths', () => {
    expect(formatKitchenFraction(1 / 8)).toBe('⅛')
    expect(formatKitchenFraction(1 + 1 / 8)).toBe('1⅛')
  })

  it('preserves thirds exactly, rather than snapping to the nearest quarter', () => {
    expect(formatKitchenFraction(1 / 3)).toBe('⅓')
    expect(formatKitchenFraction(2 / 3)).toBe('⅔')
  })

  it('renders mixed-number thirds', () => {
    expect(formatKitchenFraction(1 + 1 / 3)).toBe('1⅓')
    expect(formatKitchenFraction(1 + 2 / 3)).toBe('1⅔')
    expect(formatKitchenFraction(2 + 1 / 3)).toBe('2⅓')
  })

  it('never shows "0" for a truly positive amount — shows the smallest visible fraction instead', () => {
    expect(formatKitchenFraction(0.02)).toBe('⅛')
  })

  it('shows a bare "0" only for a genuinely zero (or negative) amount', () => {
    expect(formatKitchenFraction(0)).toBe('0')
    expect(formatKitchenFraction(-1)).toBe('0')
  })

  it('picks the closest common kitchen fraction for an amount that is not itself a common fraction', () => {
    // 0.3 is closer to ⅓ (diff .033) than to ¼ (diff .05).
    expect(formatKitchenFraction(0.3)).toBe('⅓')
    // 0.6 is closer to ⅔ (diff .067) than to ½ (diff .1) or ¾ (diff .15).
    expect(formatKitchenFraction(0.6)).toBe('⅔')
  })

  it('renders values that arise from real servings scaling', () => {
    // banana-bread's butter, "⅓ cup, melted", unscaled (ratio 1) — must stay
    // ⅓, not round away to ¼ the way the old quarter-only formatter did.
    expect(formatKitchenFraction((1 / 3) * 1)).toBe('⅓')
    // banana-bread's banana (requiredAmount 3) scaled from 8 servings to 12
    // (ratio 1.5): 3 * 1.5 = 4.5.
    expect(formatKitchenFraction(3 * 1.5)).toBe('4½')
  })
})

describe('scaledQuantityLabel', () => {
  it('falls back to the authored quantity string unchanged when nothing is scalable, at any ratio', () => {
    const ingredient = ing({ id: 'i1', name: 'Salt', quantity: 'to taste' })
    expect(scaledQuantityLabel(ingredient, 1)).toBe('to taste')
    expect(scaledQuantityLabel(ingredient, 2)).toBe('to taste')
    expect(scaledQuantityLabel(ingredient, 0.5)).toBe('to taste')
  })

  it('reuses a compatible requiredAmount (count) as the scaling base without a scalable block', () => {
    const ingredient = ing({ id: 'i1', name: 'Potatoes', quantity: '4', requiredAmount: 4, requiredUnit: 'count' })
    expect(scaledQuantityLabel(ingredient, 1)).toBe('4')
    expect(scaledQuantityLabel(ingredient, 2)).toBe('8')
    expect(scaledQuantityLabel(ingredient, 0.5)).toBe('2')
  })

  it('reuses a compatible requiredAmount (fraction) as the scaling base', () => {
    const ingredient = ing({ id: 'i1', name: 'Onion', quantity: '½', requiredAmount: 0.5, requiredUnit: 'fraction' })
    expect(scaledQuantityLabel(ingredient, 2)).toBe('1')
    expect(scaledQuantityLabel(ingredient, 3)).toBe('1½')
  })

  it('never reuses a level requiredAmount as a scaling base', () => {
    // No `scalable` and a `level` requiredUnit -> nothing honest to reuse ->
    // falls back to the authored text, at any ratio.
    const ingredient = ing({ id: 'i1', name: 'Rice', quantity: '1 cup', requiredAmount: 2, requiredUnit: 'level' })
    expect(scaledQuantityLabel(ingredient, 2)).toBe('1 cup')
  })

  it('scales an explicit scalable.amount (no compatible requiredAmount) with its unit and pluralizes "cup"', () => {
    const ingredient = ing({
      id: 'i1',
      name: 'Broth',
      quantity: '2 cups',
      scalable: { amount: 2, unit: 'cup' },
    })
    expect(scaledQuantityLabel(ingredient, 1)).toBe('2 cups')
    expect(scaledQuantityLabel(ingredient, 0.5)).toBe('1 cup')
    expect(scaledQuantityLabel(ingredient, 2)).toBe('4 cups')
  })

  it('never invents a fill-fraction number for the display — the scalable cup amount stays independent of requiredAmount', () => {
    const ingredient = ing({
      id: 'i1',
      name: 'Broth',
      quantity: '2 cups',
      requiredAmount: 0.5,
      requiredUnit: 'fill',
      scalable: { amount: 2, unit: 'cup' },
    })
    expect(scaledQuantityLabel(ingredient, 2)).toBe('4 cups') // scalable.amount * ratio, not requiredAmount * ratio
  })

  it('applies a noun override with correct singular/plural, never repeating the ingredient name', () => {
    const ingredient = ing({
      id: 'i1',
      name: 'Chicken breast',
      quantity: '2 pieces',
      requiredAmount: 2,
      requiredUnit: 'count',
      scalable: { unit: 'count', noun: { singular: 'piece', plural: 'pieces' } },
    })
    expect(scaledQuantityLabel(ingredient, 0.5)).toBe('1 piece')
    expect(scaledQuantityLabel(ingredient, 1)).toBe('2 pieces')
    expect(scaledQuantityLabel(ingredient, 1.5)).toBe('3 pieces')
  })

  it('appends prep text and a fixed, never-scaled suffix', () => {
    const ingredient = ing({
      id: 'i1',
      name: 'Canned tomatoes',
      quantity: '1 can',
      scalable: {
        amount: 1,
        unit: 'count',
        noun: { singular: 'can', plural: 'cans' },
        prep: 'drained',
        fixedSuffix: '(14 oz each)',
      },
    })
    expect(scaledQuantityLabel(ingredient, 2)).toBe('2 cans, drained (14 oz each)')
  })

  it('scales a cookingHint by the exact same ratio as the primary amount', () => {
    const ingredient = ing({
      id: 'i1',
      name: 'Garlic',
      quantity: '2 cloves, minced',
      scalable: {
        amount: 2,
        unit: 'count',
        noun: { singular: 'clove', plural: 'cloves' },
        prep: 'minced',
        cookingHint: { amountPerUnit: 1, unit: 'tsp', prep: 'minced' },
      },
    })
    expect(scaledQuantityLabel(ingredient, 1)).toBe('2 cloves, minced (about 2 tsp minced)')
    expect(scaledQuantityLabel(ingredient, 2)).toBe('4 cloves, minced (about 4 tsp minced)')
  })

  it('renders a fractional count without a noun as a bare kitchen-fraction number plus prep', () => {
    const ingredient = ing({
      id: 'i1',
      name: 'Avocado',
      quantity: '½, sliced',
      scalable: { amount: 0.5, unit: 'count', prep: 'sliced' },
    })
    expect(scaledQuantityLabel(ingredient, 1)).toBe('½, sliced')
    expect(scaledQuantityLabel(ingredient, 2)).toBe('1, sliced')
    expect(scaledQuantityLabel(ingredient, 3)).toBe('1½, sliced')
  })
})
