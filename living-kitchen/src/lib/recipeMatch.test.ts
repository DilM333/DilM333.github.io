import { describe, expect, it } from 'vitest'
import type { KitchenItem, Recipe, RecipeIngredient } from '../data/types'
import { computeFeasibility } from './kitchen'
import {
  formatCheckList,
  isIngredientAvailable,
  lowConfidenceHint,
  matchIngredient,
  matchRecipe,
  matchStatusLabel,
  rankRecipes,
  uncertainRequiredItems,
} from './recipeMatch'

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
    mealTypes: ['dinner'],
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

// Uses real seeded catalog relationships (see data/catalog.ts): yellow-onion
// and red-onion are explicit substitutes of each other; green-onion and
// shallot share the "onion" family but are deliberately NOT substitutes;
// chicken-breast/chicken-thighs are a second, independent seeded pair.
describe('matchIngredient', () => {
  it('prefers the exact item over a substitute when both are in stock', () => {
    const items = [
      item({ id: 'red-onion', name: 'Red onion', stockType: 'divisible', fraction: 1 }),
      item({ id: 'yellow-onion', name: 'Yellow Onion', stockType: 'divisible', fraction: 1 }),
    ]
    const result = matchIngredient(ing({ id: 'i1', name: 'Red onion', itemId: 'red-onion' }), items)
    expect(result.kind).toBe('exact')
    expect(result.matchedItem?.id).toBe('red-onion')
    expect(result.substitutedFor).toBeUndefined()
  })

  it('falls back to an explicit substitute when the exact item is absent', () => {
    const items = [item({ id: 'yellow-onion', name: 'Yellow Onion', stockType: 'divisible', fraction: 1 })]
    const result = matchIngredient(ing({ id: 'i1', name: 'Red onion', itemId: 'red-onion' }), items)
    expect(result.kind).toBe('substitute')
    expect(result.matchedItem?.id).toBe('yellow-onion')
    expect(result.substitutedFor).toBe('red-onion')
  })

  it('falls back to a substitute when the exact item exists but has zero stock', () => {
    const items = [
      item({ id: 'red-onion', name: 'Red onion', stockType: 'divisible', fraction: 0 }),
      item({ id: 'yellow-onion', name: 'Yellow Onion', stockType: 'divisible', fraction: 1 }),
    ]
    const result = matchIngredient(ing({ id: 'i1', name: 'Red onion', itemId: 'red-onion' }), items)
    expect(result.kind).toBe('substitute')
    expect(result.matchedItem?.id).toBe('yellow-onion')
  })

  it('does not let an unrelated same-family item count unless it is an explicit substitute', () => {
    const items = [
      item({ id: 'green-onion', name: 'Green Onion', stockType: 'divisible', fraction: 1 }),
      item({ id: 'shallot', name: 'Shallot', stockType: 'divisible', fraction: 1 }),
    ]
    const result = matchIngredient(ing({ id: 'i1', name: 'Red onion', itemId: 'red-onion' }), items)
    expect(result.kind).toBe('missing')
  })

  it('is missing when neither the exact item nor any substitute is stocked', () => {
    const result = matchIngredient(ing({ id: 'i1', name: 'Red onion', itemId: 'red-onion' }), [])
    expect(result.kind).toBe('missing')
    expect(result.matchedItem).toBeUndefined()
  })

  it('works for a second, independent seeded relationship (chicken breast/thighs)', () => {
    const items = [item({ id: 'chicken-thighs', name: 'Chicken Thighs', count: 2 })]
    const result = matchIngredient(ing({ id: 'i1', name: 'Chicken breast', itemId: 'chicken-breast' }), items)
    expect(result.kind).toBe('substitute')
    expect(result.matchedItem?.id).toBe('chicken-thighs')
    expect(result.substitutedFor).toBe('chicken-breast')
  })

  it('an item with no configured substitutes simply falls through to missing', () => {
    const result = matchIngredient(ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }), [])
    expect(result.kind).toBe('missing')
  })

  it('still uses the existing case/whitespace-insensitive name fallback when there is no itemId', () => {
    const items = [item({ id: 'ground-beef', name: 'Ground Beef', category: 'Meat' })]
    const result = matchIngredient(ing({ id: 'i1', name: '  ground beef  ' }), items)
    expect(result.kind).toBe('exact')
    expect(result.matchedItem?.id).toBe('ground-beef')
  })
})

describe('matchRecipe — substitute awareness', () => {
  it('counts a recipe as ready via substitute and reports hasSubstitutions', () => {
    const items = [item({ id: 'yellow-onion', name: 'Yellow Onion', stockType: 'divisible', fraction: 1 })]
    const r = recipe({
      id: 'onion-recipe',
      ingredients: [ing({ id: 'i1', name: 'Red onion', itemId: 'red-onion' })],
    })
    const match = matchRecipe(r, items)
    expect(match.isReady).toBe(true)
    expect(match.requiredMissing).toBe(0)
    expect(match.hasSubstitutions).toBe(true)
    expect(match.ingredientMatches[0].kind).toBe('substitute')
  })

  it('hasSubstitutions is false when everything matches exactly', () => {
    const items = [item({ id: 'red-onion', name: 'Red onion', stockType: 'divisible', fraction: 1 })]
    const r = recipe({
      id: 'exact-onion-recipe',
      ingredients: [ing({ id: 'i1', name: 'Red onion', itemId: 'red-onion' })],
    })
    const match = matchRecipe(r, items)
    expect(match.hasSubstitutions).toBe(false)
    expect(match.isReady).toBe(true)
    expect(match.ingredientMatches[0].kind).toBe('exact')
  })

  it('hasSubstitutions is false when the ingredient is simply missing', () => {
    const r = recipe({
      id: 'missing-onion-recipe',
      ingredients: [ing({ id: 'i1', name: 'Red onion', itemId: 'red-onion' })],
    })
    const match = matchRecipe(r, [])
    expect(match.hasSubstitutions).toBe(false)
    expect(match.isReady).toBe(false)
  })

  it('an unrelated same-family item does not satisfy the recipe or count as a substitution', () => {
    const items = [item({ id: 'shallot', name: 'Shallot', stockType: 'divisible', fraction: 1 })]
    const r = recipe({
      id: 'onion-recipe-2',
      ingredients: [ing({ id: 'i1', name: 'Red onion', itemId: 'red-onion' })],
    })
    const match = matchRecipe(r, items)
    expect(match.isReady).toBe(false)
    expect(match.hasSubstitutions).toBe(false)
  })

  it('existing alias/name-based matching is unaffected by substitute awareness', () => {
    const items = [item({ id: 'custom-dragonfruit-nectar', name: 'Dragonfruit Nectar', custom: true })]
    const r = recipe({
      id: 'name-only-recipe',
      ingredients: [ing({ id: 'i1', name: 'Dragonfruit Nectar' })],
    })
    const match = matchRecipe(r, items)
    expect(match.isReady).toBe(true)
    expect(match.hasSubstitutions).toBe(false)
    expect(match.ingredientMatches[0].kind).toBe('exact')
  })
})

// ---------------------------------------------------------------------------
// Inventory-confidence hint (Phase 2.1). matchRecipe exposes
// `lowConfidenceRequired` — resolved required ingredients whose matched
// kitchen item Euko hasn't confirmed lately. It's a non-destructive hint only:
// isReady / matchPercent / requiredMissing / ranking must be untouched.
// (daysSincePurchase is an absolute day count, so these are time-stable
// without mocking the clock.)
// ---------------------------------------------------------------------------

describe('matchRecipe — lowConfidenceRequired hint', () => {
  it('lists a resolved required ingredient whose stock is stale, without changing readiness', () => {
    const items = [
      item({ id: 'eggs', name: 'Eggs', category: 'Dairy', count: 6 }), // fresh -> high
      item({ id: 'milk', name: 'Milk', category: 'Dairy', stockType: 'container', fill: 1, daysSincePurchase: 90 }),
    ]
    const r = recipe({
      id: 'pancakes',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Milk', itemId: 'milk' }),
      ],
    })

    const match = matchRecipe(r, items)

    expect(match.isReady).toBe(true)
    expect(match.matchPercent).toBe(100)
    expect(match.requiredMissing).toBe(0)
    expect(match.lowConfidenceRequired.map((m) => m.ingredient.name)).toEqual(['Milk'])
  })

  it('is empty when every required ingredient was confirmed recently', () => {
    const items = [
      item({ id: 'eggs', name: 'Eggs', category: 'Dairy', count: 6, daysSincePurchase: 1 }),
      item({ id: 'milk', name: 'Milk', category: 'Dairy', stockType: 'container', fill: 1, daysSincePurchase: 1 }),
    ]
    const r = recipe({
      id: 'pancakes-fresh',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Milk', itemId: 'milk' }),
      ],
    })
    expect(matchRecipe(r, items).lowConfidenceRequired).toEqual([])
  })

  it('never lists an OPTIONAL ingredient, however stale', () => {
    const items = [
      item({ id: 'eggs', name: 'Eggs', category: 'Dairy', count: 6, daysSincePurchase: 1 }),
      item({ id: 'parmesan', name: 'Parmesan', category: 'Dairy', stockType: 'staple', level: 'some', daysSincePurchase: 300 }),
    ]
    const r = recipe({
      id: 'carbonara',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Parmesan', itemId: 'parmesan', optional: true }),
      ],
    })
    expect(matchRecipe(r, items).lowConfidenceRequired).toEqual([])
  })

  it('does not list a missing required ingredient (only resolved ones)', () => {
    const items = [
      item({ id: 'eggs', name: 'Eggs', category: 'Dairy', count: 6, daysSincePurchase: 200 }),
    ]
    const r = recipe({
      id: 'needs-rice',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Rice', itemId: 'rice' }), // missing
      ],
    })
    const match = matchRecipe(r, items)
    expect(match.isReady).toBe(false)
    expect(match.requiredMissing).toBe(1)
    expect(match.lowConfidenceRequired.map((m) => m.ingredient.name)).toEqual(['Eggs'])
  })

  it('low confidence does not change ranking order (still fewest-missing, then match%, then name)', () => {
    const items = [
      item({ id: 'eggs', name: 'Eggs', category: 'Dairy', count: 6, daysSincePurchase: 400 }),
      item({ id: 'rice', name: 'Rice', category: 'Grains', stockType: 'staple', level: 'plenty', daysSincePurchase: 1 }),
    ]
    const staleReady = recipe({
      id: 'stale-ready',
      name: 'Stale Ready',
      ingredients: [ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' })],
    })
    const freshOneAway = recipe({
      id: 'fresh-one-away',
      name: 'Fresh One Away',
      ingredients: [
        ing({ id: 'i1', name: 'Rice', itemId: 'rice' }),
        ing({ id: 'i2', name: 'Beans', itemId: 'beans' }),
      ],
    })
    const ranked = rankRecipes([freshOneAway, staleReady], items)
    // The stale-but-ready recipe still ranks first — confidence is not a tiebreaker.
    expect(ranked[0].recipe.id).toBe('stale-ready')
    expect(ranked[0].lowConfidenceRequired).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// "Worth checking …" hint (Phase 2.2). Read-only, non-alarming nudge for an
// otherwise-cookable recipe that leans on required ingredients Euko hasn't
// seen lately. Never touches readiness — it only decides whether/how to phrase
// a line. daysSincePurchase is an absolute day count so these are clock-stable.
// ---------------------------------------------------------------------------

describe('formatCheckList', () => {
  it('formats 0, 1, 2, 3 and 5 names', () => {
    expect(formatCheckList([])).toBe('')
    expect(formatCheckList(['milk'])).toBe('milk')
    expect(formatCheckList(['milk', 'spinach'])).toBe('milk and spinach')
    expect(formatCheckList(['milk', 'spinach', 'eggs'])).toBe('milk, spinach, and 1 more')
    expect(formatCheckList(['milk', 'spinach', 'eggs', 'butter', 'rice'])).toBe(
      'milk, spinach, and 3 more',
    )
  })
})

describe('lowConfidenceHint', () => {
  /** A recipe whose required ingredients all resolve, `staleNames` of them to low-confidence items. */
  const staleRecipe = (freshNames: string[], staleNames: string[], optionalStale: string[] = []) => {
    const mk = (name: string, stale: boolean, optional = false) => ({
      ing: ing({ id: `ing-${name}`, name, itemId: name, optional }),
      item: item({
        id: name,
        name,
        category: 'Dairy',
        count: 5,
        daysSincePurchase: stale ? 400 : 1,
      }),
    })
    const parts = [
      ...freshNames.map((n) => mk(n, false)),
      ...staleNames.map((n) => mk(n, true)),
      ...optionalStale.map((n) => mk(n, true, true)),
    ]
    return {
      recipe: recipe({ id: 'r', ingredients: parts.map((p) => p.ing) }),
      items: parts.map((p) => p.item),
    }
  }

  it('one stale required ingredient (status ready)', () => {
    const { recipe: r, items } = staleRecipe(['flour'], ['milk'])
    expect(lowConfidenceHint(matchRecipe(r, items), 'ready')).toBe(
      'Looks ready — worth checking milk',
    )
  })

  it('two stale required ingredients', () => {
    const { recipe: r, items } = staleRecipe(['flour'], ['milk', 'spinach'])
    expect(lowConfidenceHint(matchRecipe(r, items), 'ready')).toBe(
      'Looks ready — worth checking milk and spinach',
    )
  })

  it('three or more stale required ingredients summarise the tail', () => {
    const { recipe: r, items } = staleRecipe([], ['milk', 'spinach', 'eggs', 'butter'])
    expect(lowConfidenceHint(matchRecipe(r, items), 'ready')).toBe(
      'Looks ready — worth checking milk, spinach, and 2 more',
    )
  })

  it('shows for ready-adjusted too', () => {
    const { recipe: r, items } = staleRecipe(['flour'], ['milk'])
    expect(lowConfidenceHint(matchRecipe(r, items), 'ready-adjusted')).toBe(
      'Looks ready — worth checking milk',
    )
  })

  it('is hidden for almost / one-away / needs-shopping even with a stale required ingredient', () => {
    const { recipe: r, items } = staleRecipe(['flour'], ['milk'])
    const match = matchRecipe(r, items)
    expect(lowConfidenceHint(match, 'almost')).toBeNull()
    expect(lowConfidenceHint(match, 'one-away')).toBeNull()
    expect(lowConfidenceHint(match, 'needs-shopping')).toBeNull()
  })

  it('is null when every required ingredient was seen recently', () => {
    const { recipe: r, items } = staleRecipe(['flour', 'milk'], [])
    expect(lowConfidenceHint(matchRecipe(r, items), 'ready')).toBeNull()
  })

  it('ignores an OPTIONAL low-confidence ingredient', () => {
    const { recipe: r, items } = staleRecipe(['flour'], [], ['parmesan'])
    expect(lowConfidenceHint(matchRecipe(r, items), 'ready')).toBeNull()
  })

  it('preserves recipe ingredient order in the name list', () => {
    const { recipe: r, items } = staleRecipe([], ['spinach', 'milk'])
    expect(lowConfidenceHint(matchRecipe(r, items), 'ready')).toBe(
      'Looks ready — worth checking spinach and milk',
    )
  })

  it('de-duplicates when two ingredients resolve to the same low-confidence item', () => {
    const items = [item({ id: 'milk', name: 'Milk', category: 'Dairy', count: 5, daysSincePurchase: 400 })]
    const r = recipe({
      id: 'double-milk',
      ingredients: [
        ing({ id: 'a', name: 'Milk', itemId: 'milk' }),
        ing({ id: 'b', name: 'Milk', itemId: 'milk' }),
      ],
    })
    expect(lowConfidenceHint(matchRecipe(r, items), 'ready')).toBe(
      'Looks ready — worth checking Milk',
    )
  })

  it('integrates with the real computeFeasibility status', () => {
    // All required resolve; one is stale -> feasibility 'ready' -> hint shows.
    const ready = staleRecipe(['flour'], ['milk'])
    const readyStatus = computeFeasibility(ready.recipe, ready.items).status
    expect(readyStatus).toBe('ready')
    expect(lowConfidenceHint(matchRecipe(ready.recipe, ready.items), readyStatus)).toBe(
      'Looks ready — worth checking milk',
    )

    // A missing required ingredient -> feasibility 'one-away' -> no hint, even
    // though another required ingredient is stale.
    const r = recipe({
      id: 'missing-plus-stale',
      ingredients: [
        ing({ id: 'i1', name: 'milk', itemId: 'milk' }),
        ing({ id: 'i2', name: 'yeast', itemId: 'yeast' }),
      ],
    })
    const partialItems = [
      item({ id: 'milk', name: 'milk', category: 'Dairy', count: 5, daysSincePurchase: 400 }),
    ]
    const status = computeFeasibility(r, partialItems).status
    expect(status).toBe('one-away')
    expect(lowConfidenceHint(matchRecipe(r, partialItems), status)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// uncertainRequiredItems (Phase 2.3): the queue for the one-tap confirmation
// flow — distinct kitchen items behind required low-confidence ingredients.
// ---------------------------------------------------------------------------

describe('uncertainRequiredItems', () => {
  const stale = (over: Partial<KitchenItem> & Pick<KitchenItem, 'id' | 'name'>) =>
    item({ category: 'Dairy', count: 5, daysSincePurchase: 400, ...over })
  const fresh = (over: Partial<KitchenItem> & Pick<KitchenItem, 'id' | 'name'>) =>
    item({ category: 'Dairy', count: 5, daysSincePurchase: 1, ...over })

  it('returns the distinct low-confidence matched items for required ingredients', () => {
    const items = [stale({ id: 'milk', name: 'Milk' }), fresh({ id: 'eggs', name: 'Eggs' })]
    const r = recipe({
      id: 'r',
      ingredients: [
        ing({ id: 'i1', name: 'Milk', itemId: 'milk' }),
        ing({ id: 'i2', name: 'Eggs', itemId: 'eggs' }),
      ],
    })
    expect(uncertainRequiredItems(r, items).map((it) => it.id)).toEqual(['milk'])
  })

  it('asks about a shared kitchen item only once', () => {
    const items = [stale({ id: 'milk', name: 'Milk' })]
    const r = recipe({
      id: 'double-milk',
      ingredients: [
        ing({ id: 'a', name: 'Milk', itemId: 'milk' }),
        ing({ id: 'b', name: 'Milk', itemId: 'milk' }),
      ],
    })
    expect(uncertainRequiredItems(r, items).map((it) => it.id)).toEqual(['milk'])
  })

  it('returns the substitute that actually stood in, not the requested id', () => {
    const items = [
      stale({ id: 'yellow-onion', name: 'Yellow Onion', category: 'Produce', stockType: 'divisible', fraction: 1 }),
    ]
    const r = recipe({
      id: 'sub',
      ingredients: [ing({ id: 'i1', name: 'Red onion', itemId: 'red-onion' })],
    })
    expect(uncertainRequiredItems(r, items).map((it) => it.id)).toEqual(['yellow-onion'])
  })

  it('ignores an optional low-confidence ingredient', () => {
    const items = [
      fresh({ id: 'eggs', name: 'Eggs' }),
      stale({ id: 'parmesan', name: 'Parmesan', stockType: 'staple', level: 'some' }),
    ]
    const r = recipe({
      id: 'opt',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Parmesan', itemId: 'parmesan', optional: true }),
      ],
    })
    expect(uncertainRequiredItems(r, items)).toEqual([])
  })

  it('ignores a missing required ingredient', () => {
    const items = [stale({ id: 'milk', name: 'Milk' })]
    const r = recipe({
      id: 'missing',
      ingredients: [
        ing({ id: 'i1', name: 'Milk', itemId: 'milk' }),
        ing({ id: 'i2', name: 'Yeast', itemId: 'yeast' }),
      ],
    })
    expect(uncertainRequiredItems(r, items).map((it) => it.id)).toEqual(['milk'])
  })

  it('is empty when every required ingredient was seen recently', () => {
    const items = [fresh({ id: 'milk', name: 'Milk' }), fresh({ id: 'eggs', name: 'Eggs' })]
    const r = recipe({
      id: 'all-fresh',
      ingredients: [
        ing({ id: 'i1', name: 'Milk', itemId: 'milk' }),
        ing({ id: 'i2', name: 'Eggs', itemId: 'eggs' }),
      ],
    })
    expect(uncertainRequiredItems(r, items)).toEqual([])
  })
})
