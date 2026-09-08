import { describe, expect, it } from 'vitest'
import {
  computeFeasibility,
  fracPartOf,
  fractionLabel,
  ingredientStatus,
  matchIngredient,
  quantityStatus,
  quarterGlyph,
  stockLevel,
  stockPatchForLevel,
  usableAmount,
  wholeOf,
} from './kitchen'
import { suggestDeduction } from './deduction'
import { matchRecipe } from './recipeMatch'
import type { KitchenItem, Recipe, RecipeIngredient } from '../data/types'

function divisibleItem(fraction: number): KitchenItem {
  return {
    id: 'onion',
    name: 'Onion',
    emoji: '🧅',
    location: 'pantry',
    stockType: 'divisible',
    category: 'Produce',
    fraction,
  }
}

describe('wholeOf / fracPartOf', () => {
  it('decomposes totals into whole units plus a quarter remainder', () => {
    expect(wholeOf(0)).toBe(0)
    expect(fracPartOf(0)).toBe(0)

    expect(wholeOf(1.5)).toBe(1)
    expect(fracPartOf(1.5)).toBe(0.5)

    expect(wholeOf(2)).toBe(2)
    expect(fracPartOf(2)).toBe(0)

    expect(wholeOf(2.75)).toBe(2)
    expect(fracPartOf(2.75)).toBe(0.75)

    expect(wholeOf(4.25)).toBe(4)
    expect(fracPartOf(4.25)).toBe(0.25)
  })
})

describe('fractionLabel', () => {
  it('matches the mixed-number display examples from the spec', () => {
    expect(fractionLabel(0)).toBe('Out')
    expect(fractionLabel(0.25)).toBe('¼')
    expect(fractionLabel(1)).toBe('1')
    expect(fractionLabel(1.5)).toBe('1 ½')
    expect(fractionLabel(2)).toBe('2')
    expect(fractionLabel(2.75)).toBe('2 ¾')
    expect(fractionLabel(4.25)).toBe('4 ¼')
  })
})

describe('quarterGlyph', () => {
  it('labels a bare quarter-step value without the whole-item "Out" wording', () => {
    expect(quarterGlyph(0)).toBe('0')
    expect(quarterGlyph(0.25)).toBe('¼')
    expect(quarterGlyph(0.5)).toBe('½')
    expect(quarterGlyph(0.75)).toBe('¾')
    expect(quarterGlyph(1)).toBe('1')
  })
})

describe('suggestDeduction for divisible items', () => {
  it('with no explicit/structured amount, steps down by a quarter regardless of how many whole units are on hand', () => {
    // No second argument -> the fixed fallback amount, unchanged from before
    // requiredAmount/actualUsage-aware deduction existed.
    expect(suggestDeduction(divisibleItem(1)).newFraction).toBe(0.75)
    expect(suggestDeduction(divisibleItem(0.25)).newFraction).toBe(0)
    expect(suggestDeduction(divisibleItem(0)).newFraction).toBe(0)
    // Regression: before generalizing past the old 0..1 ladder, this jumped
    // straight to 0.75 instead of decrementing by a quarter.
    expect(suggestDeduction(divisibleItem(2.75)).newFraction).toBe(2.5)
  })

  it('an explicit amount overrides the fallback and is still snapped to the quarter-step grid', () => {
    expect(suggestDeduction(divisibleItem(1), 0.5).newFraction).toBe(0.5)
    expect(suggestDeduction(divisibleItem(1), 1).newFraction).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Phase 1.5: computeFeasibility/ingredientStatus must never disagree with
// recipeMatch.ts's exact/substitute/missing resolution for the same recipe
// and kitchen. Uses real seeded catalog relationships (data/catalog.ts):
// yellow-onion <-> red-onion are explicit substitutes; green-onion/shallot
// share the "onion" family but are deliberately NOT substitutes.
// ---------------------------------------------------------------------------

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

describe('computeFeasibility — consistency with recipeMatch', () => {
  it('an exact-only recipe is ready in both systems', () => {
    const items = [item({ id: 'red-onion', name: 'Red onion', stockType: 'divisible', fraction: 1 })]
    const r = recipe({ id: 'exact', ingredients: [ing({ id: 'i1', name: 'Red onion', itemId: 'red-onion' })] })

    const feasibility = computeFeasibility(r, items)
    const match = matchRecipe(r, items)

    expect(feasibility.status).toBe('ready')
    expect(match.isReady).toBe(true)
    expect(match.hasSubstitutions).toBe(false)
  })

  it('a required ingredient satisfied only via an approved substitute is ready-adjusted, consistently', () => {
    const items = [item({ id: 'yellow-onion', name: 'Yellow Onion', stockType: 'divisible', fraction: 1 })]
    const r = recipe({ id: 'sub', ingredients: [ing({ id: 'i1', name: 'Red onion', itemId: 'red-onion' })] })

    const feasibility = computeFeasibility(r, items)
    const match = matchRecipe(r, items)

    // Both systems agree: available, but via substitution rather than exact.
    expect(feasibility.status).toBe('ready-adjusted')
    expect(feasibility.missing).toHaveLength(0)
    expect(match.isReady).toBe(true)
    expect(match.requiredMissing).toBe(0)
    expect(match.hasSubstitutions).toBe(true)
  })

  it('a substitute-satisfied ingredient is never presented as an unresolved problem in adaptation logic', () => {
    // This is exactly the condition AdaptRecipe.tsx's `problems` list filters
    // on (`status !== 'ok'`) — asserting 'ok' here is what keeps a stocked
    // substitute out of the "you're short on N things" screen entirely.
    const items = [item({ id: 'yellow-onion', name: 'Yellow Onion', stockType: 'divisible', fraction: 1 })]
    const status = ingredientStatus(ing({ id: 'i1', name: 'Red onion', itemId: 'red-onion' }), items)
    expect(status).toBe('ok')
  })

  it('a genuinely missing ingredient still produces one-away, unchanged from prior behavior', () => {
    const r = recipe({
      id: 'missing-one',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Red onion', itemId: 'red-onion' }),
      ],
    })
    const items = [item({ id: 'eggs', name: 'Eggs' })]

    const feasibility = computeFeasibility(r, items)
    const match = matchRecipe(r, items)

    expect(feasibility.status).toBe('one-away')
    expect(match.isReady).toBe(false)
    expect(match.hasSubstitutions).toBe(false)
  })

  it('an optional ingredient satisfied only via substitute does not create ready-adjusted on its own', () => {
    const items = [
      item({ id: 'eggs', name: 'Eggs' }),
      item({ id: 'yellow-onion', name: 'Yellow Onion', stockType: 'divisible', fraction: 1 }),
    ]
    const r = recipe({
      id: 'optional-sub',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Red onion', itemId: 'red-onion', optional: true }),
      ],
    })

    const feasibility = computeFeasibility(r, items)
    const match = matchRecipe(r, items)

    expect(feasibility.status).toBe('ready')
    expect(match.hasSubstitutions).toBe(false)
  })

  it('an unrelated same-family ingredient still does not satisfy the recipe in either system', () => {
    const items = [item({ id: 'shallot', name: 'Shallot', stockType: 'divisible', fraction: 1 })]
    const r = recipe({ id: 'family-not-sub', ingredients: [ing({ id: 'i1', name: 'Red onion', itemId: 'red-onion' })] })

    const feasibility = computeFeasibility(r, items)
    const match = matchRecipe(r, items)

    expect(feasibility.status).not.toBe('ready')
    expect(feasibility.status).not.toBe('ready-adjusted')
    expect(match.isReady).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Phase 2: quantity-aware matching. `requiredAmount`/`requiredUnit` on a
// RecipeIngredient are compared against `usableAmount` (raw stock, reduced by
// `reserved`) — see the doc comments on usableAmount/quantityStatus/
// computeFeasibility in kitchen.ts for the exact formula and readiness rules.
// ---------------------------------------------------------------------------

describe('usableAmount', () => {
  it('reduces countable stock by the reserved fraction (6 eggs, 1/3 reserved -> 4 usable)', () => {
    const eggs = item({ id: 'eggs', name: 'Eggs', count: 6, reserved: 1 / 3 })
    expect(usableAmount(eggs)).toBeCloseTo(4)
  })

  it('reduces divisible stock by the reserved fraction (1 onion, half reserved -> 0.5 usable)', () => {
    const onion = item({ id: 'onion', name: 'Onion', stockType: 'divisible', fraction: 1, reserved: 0.5 })
    expect(usableAmount(onion)).toBeCloseTo(0.5)
  })

  it('reduces container fill by the reserved fraction (0.75 broth, 1/4 reserved -> 0.5625 usable)', () => {
    const broth = item({ id: 'broth', name: 'Broth', stockType: 'container', fill: 0.75, reserved: 0.25 })
    expect(usableAmount(broth)).toBeCloseTo(0.5625)
  })

  it('drops a staple by one ordinal tier when any of it is reserved, never a fractional level', () => {
    const flour = item({ id: 'flour', name: 'Flour', stockType: 'staple', level: 'plenty', reserved: 0.1 })
    expect(usableAmount(flour)).toBe(2) // plenty (3) - 1 tier
  })

  it('leaves an unreserved staple at its full ordinal rank', () => {
    const flour = item({ id: 'flour', name: 'Flour', stockType: 'staple', level: 'some' })
    expect(usableAmount(flour)).toBe(2) // some === rank 2
  })
})

describe('quantityStatus', () => {
  it('is "unknown" when the ingredient has no structured requirement (old presence/absence behavior preserved)', () => {
    const eggs = item({ id: 'eggs', name: 'Eggs', count: 1 })
    expect(quantityStatus(ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }), eggs)).toBe('unknown')
  })

  it('is "enough" for sufficient countable stock, "partial" for insufficient', () => {
    const requirement = ing({ id: 'i1', name: 'Eggs', itemId: 'eggs', requiredAmount: 3, requiredUnit: 'count' })
    expect(quantityStatus(requirement, item({ id: 'eggs', name: 'Eggs', count: 3 }))).toBe('enough')
    expect(quantityStatus(requirement, item({ id: 'eggs', name: 'Eggs', count: 4 }))).toBe('enough')
    expect(quantityStatus(requirement, item({ id: 'eggs', name: 'Eggs', count: 2 }))).toBe('partial')
  })

  it('is "enough" for sufficient divisible stock, "partial" for insufficient', () => {
    const requirement = ing({
      id: 'i1',
      name: 'Onion',
      itemId: 'onion',
      requiredAmount: 0.5,
      requiredUnit: 'fraction',
    })
    const enough = item({ id: 'onion', name: 'Onion', stockType: 'divisible', fraction: 1 })
    const partial = item({ id: 'onion', name: 'Onion', stockType: 'divisible', fraction: 0.25 })
    expect(quantityStatus(requirement, enough)).toBe('enough')
    expect(quantityStatus(requirement, partial)).toBe('partial')
  })

  it('a reservation can push otherwise-sufficient stock below the requirement', () => {
    const requirement = ing({ id: 'i1', name: 'Eggs', itemId: 'eggs', requiredAmount: 4, requiredUnit: 'count' })
    // 6 on hand comfortably covers 4 needed...
    expect(quantityStatus(requirement, item({ id: 'eggs', name: 'Eggs', count: 6 }))).toBe('enough')
    // ...but with 1/3 reserved, usable drops to 4 exactly still enough...
    expect(
      quantityStatus(requirement, item({ id: 'eggs', name: 'Eggs', count: 6, reserved: 1 / 3 })),
    ).toBe('enough')
    // ...and with half reserved, usable (3) is now short of the 4 required.
    expect(
      quantityStatus(requirement, item({ id: 'eggs', name: 'Eggs', count: 6, reserved: 0.5 })),
    ).toBe('partial')
  })

  it('is "none" when a structured requirement exists but usable stock is zero', () => {
    const requirement = ing({ id: 'i1', name: 'Eggs', itemId: 'eggs', requiredAmount: 1, requiredUnit: 'count' })
    expect(quantityStatus(requirement, item({ id: 'eggs', name: 'Eggs', count: 0 }))).toBe('none')
    // Fully reserved reads the same as having none usable.
    expect(
      quantityStatus(requirement, item({ id: 'eggs', name: 'Eggs', count: 3, reserved: 1 })),
    ).toBe('none')
  })
})

describe('matchIngredient — quantity awareness with substitutes', () => {
  it('reports "enough" when the resolved substitute has sufficient stock', () => {
    const requirement = ing({
      id: 'i1',
      name: 'Red onion',
      itemId: 'red-onion',
      requiredAmount: 1,
      requiredUnit: 'fraction',
    })
    const items = [item({ id: 'yellow-onion', name: 'Yellow Onion', stockType: 'divisible', fraction: 1 })]
    const result = matchIngredient(requirement, items)
    expect(result.kind).toBe('substitute')
    expect(result.quantity).toBe('enough')
  })

  it('reports "partial" when the resolved substitute is short — deduction/UI must key off the substitute, not the missing exact item', () => {
    const requirement = ing({
      id: 'i1',
      name: 'Red onion',
      itemId: 'red-onion',
      requiredAmount: 1,
      requiredUnit: 'fraction',
    })
    const items = [item({ id: 'yellow-onion', name: 'Yellow Onion', stockType: 'divisible', fraction: 0.25 })]
    const result = matchIngredient(requirement, items)
    expect(result.kind).toBe('substitute')
    expect(result.matchedItem?.id).toBe('yellow-onion')
    expect(result.quantity).toBe('partial')
  })

  it('still prefers the exact item over a fully-stocked substitute even when the exact item is quantity-short', () => {
    const requirement = ing({
      id: 'i1',
      name: 'Red onion',
      itemId: 'red-onion',
      requiredAmount: 1,
      requiredUnit: 'fraction',
    })
    const items = [
      item({ id: 'red-onion', name: 'Red onion', stockType: 'divisible', fraction: 0.25 }),
      item({ id: 'yellow-onion', name: 'Yellow Onion', stockType: 'divisible', fraction: 1 }),
    ]
    const result = matchIngredient(requirement, items)
    expect(result.kind).toBe('exact')
    expect(result.matchedItem?.id).toBe('red-onion')
    expect(result.quantity).toBe('partial')
  })
})

describe('computeFeasibility — quantity-aware readiness', () => {
  it('a recipe with no structured requirements is unaffected (old presence/absence behavior)', () => {
    const items = [item({ id: 'eggs', name: 'Eggs', count: 1 })]
    const r = recipe({ id: 'no-structure', ingredients: [ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' })] })
    expect(computeFeasibility(r, items).status).toBe('ready')
  })

  it('a single required ingredient that is present but quantity-short is "almost", not "one-away"', () => {
    const items = [item({ id: 'eggs', name: 'Eggs', count: 1 })]
    const r = recipe({
      id: 'almost-case',
      ingredients: [ing({ id: 'i1', name: 'Eggs', itemId: 'eggs', requiredAmount: 3, requiredUnit: 'count' })],
    })
    const feasibility = computeFeasibility(r, items)
    expect(feasibility.status).toBe('almost')
    expect(feasibility.missing).toHaveLength(0)
  })

  it('a required ingredient reserved down to zero usable is treated the same as fully missing ("one-away")', () => {
    const items = [item({ id: 'eggs', name: 'Eggs', count: 3, reserved: 1 })]
    const r = recipe({
      id: 'reserved-to-zero',
      ingredients: [ing({ id: 'i1', name: 'Eggs', itemId: 'eggs', requiredAmount: 1, requiredUnit: 'count' })],
    })
    const feasibility = computeFeasibility(r, items)
    expect(feasibility.status).toBe('one-away')
    expect(feasibility.missing.map((m) => m.id)).toEqual(['i1'])
  })

  it('an optional ingredient being quantity-short does not reduce readiness at all', () => {
    // An optional ingredient that is present but short (or reserved, or low)
    // must leave the recipe exactly as ready as its required ingredients make
    // it — here every required ingredient is fully satisfied, so the recipe is
    // plain 'ready', NOT 'ready-adjusted' and never 'almost'/'one-away'/
    // 'needs-shopping' (those are for *required*-ingredient problems only).
    const items = [
      item({ id: 'eggs', name: 'Eggs', count: 3 }),
      item({ id: 'parmesan', name: 'Parmesan', stockType: 'staple', level: 'low' }),
    ]
    const r = recipe({
      id: 'optional-short',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs', requiredAmount: 3, requiredUnit: 'count' }),
        ing({
          id: 'i2',
          name: 'Parmesan',
          itemId: 'parmesan',
          optional: true,
          requiredAmount: 3,
          requiredUnit: 'level',
        }),
      ],
    })
    const feasibility = computeFeasibility(r, items)
    expect(feasibility.status).toBe('ready')
    expect(feasibility.missing).toHaveLength(0)
  })

  it('two combined required problems (one missing, one quantity-short) is "needs-shopping"', () => {
    const items = [item({ id: 'eggs', name: 'Eggs', count: 1 })]
    const r = recipe({
      id: 'needs-shopping-case',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs', requiredAmount: 3, requiredUnit: 'count' }),
        ing({ id: 'i2', name: 'Rice', itemId: 'rice' }),
      ],
    })
    expect(computeFeasibility(r, items).status).toBe('needs-shopping')
  })

  it('stays consistent with recipeMatch/matchIngredient for a substitute that is itself quantity-short', () => {
    const items = [item({ id: 'yellow-onion', name: 'Yellow Onion', stockType: 'divisible', fraction: 0.25 })]
    const r = recipe({
      id: 'sub-short',
      ingredients: [
        ing({ id: 'i1', name: 'Red onion', itemId: 'red-onion', requiredAmount: 1, requiredUnit: 'fraction' }),
      ],
    })
    const feasibility = computeFeasibility(r, items)
    const match = matchRecipe(r, items)

    // Both systems agree the ingredient itself resolved (via substitute) but
    // is short — recipeMatch's presence/absence view still calls it
    // "available" (missingIngredients stays empty), while computeFeasibility's
    // quantity-aware view surfaces the shortfall as 'almost', not 'ready'.
    expect(match.missingIngredients).toHaveLength(0)
    expect(match.hasSubstitutions).toBe(true)
    expect(feasibility.status).toBe('almost')
  })
})

// ---------------------------------------------------------------------------
// Optional-ingredient readiness audit: an optional ingredient must NEVER make
// a recipe less ready — not by being missing, not by being short/low/reserved,
// not by resolving via a substitute. Required-ingredient behaviour is
// unchanged. Optional ingredients are still visible per-row via
// ingredientStatus and still listed in computeFeasibility's missing/low arrays
// for the grocery-list helpers — they just don't move `status`.
// ---------------------------------------------------------------------------

describe('computeFeasibility — optional ingredients never reduce readiness', () => {
  const eggsItem = () => item({ id: 'eggs', name: 'Eggs', count: 6 })

  it('a missing optional ingredient leaves an otherwise-ready recipe "ready"', () => {
    const r = recipe({
      id: 'opt-missing',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Parmesan', itemId: 'parmesan', optional: true }),
      ],
    })
    expect(computeFeasibility(r, [eggsItem()]).status).toBe('ready')
  })

  it('two missing optional ingredients still leave it "ready" (never needs-shopping)', () => {
    const r = recipe({
      id: 'opt-missing-two',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Parmesan', itemId: 'parmesan', optional: true }),
        ing({ id: 'i3', name: 'Chives', itemId: 'chives', optional: true }),
      ],
    })
    expect(computeFeasibility(r, [eggsItem()]).status).toBe('ready')
  })

  it('a reserved / low optional ingredient does not drop it to "ready-adjusted"', () => {
    const items = [
      eggsItem(),
      item({ id: 'butter', name: 'Butter', stockType: 'container', fill: 0.2, reserved: 0.5 }),
    ]
    const r = recipe({
      id: 'opt-reserved',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Butter', itemId: 'butter', optional: true }),
      ],
    })
    expect(computeFeasibility(r, items).status).toBe('ready')
  })

  it('an optional ingredient satisfied only via a substitute does not create "ready-adjusted"', () => {
    const items = [
      eggsItem(),
      item({ id: 'yellow-onion', name: 'Yellow Onion', stockType: 'divisible', fraction: 1 }),
    ]
    const r = recipe({
      id: 'opt-substitute',
      ingredients: [
        ing({ id: 'i1', name: 'Eggs', itemId: 'eggs' }),
        ing({ id: 'i2', name: 'Red onion', itemId: 'red-onion', optional: true }),
      ],
    })
    expect(computeFeasibility(r, items).status).toBe('ready')
  })

  it('control: the SAME shortfalls on a REQUIRED ingredient still change status as before', () => {
    // Missing required -> one-away (unchanged).
    const missingReq = recipe({
      id: 'req-missing',
      ingredients: [ing({ id: 'i1', name: 'Parmesan', itemId: 'parmesan' })],
    })
    expect(computeFeasibility(missingReq, [eggsItem()]).status).toBe('one-away')

    // Present-but-reserved required -> ready-adjusted (unchanged).
    const reservedReq = recipe({
      id: 'req-reserved',
      ingredients: [ing({ id: 'i1', name: 'Butter', itemId: 'butter' })],
    })
    const reservedItems = [
      item({ id: 'butter', name: 'Butter', stockType: 'container', fill: 0.2, reserved: 0.5 }),
    ]
    expect(computeFeasibility(reservedReq, reservedItems).status).toBe('ready-adjusted')
  })
})

// ---------------------------------------------------------------------------
// Add Food -> Make bug fix: a recipe ingredient with no itemId used to
// resolve via a raw case-insensitive string comparison against kitchen item
// names. That silently failed whenever the ingredient's free-text name and
// the kitchen item's stored name (always a catalog entry's *canonical* name)
// were the same real ingredient under different text, e.g. a recipe written
// as "Tomatoes" against a kitchen item stored as "Tomato". matchIngredient
// now also resolves through the catalog's own canonical-name/alias mapping
// (findEntryByExactName) before giving up. See data/seed.ts for the parallel
// fix of actually wiring itemId onto every seeded ingredient that has one.
// ---------------------------------------------------------------------------

describe('matchIngredient — no-itemId ingredients resolve via canonical/alias identity, not just literal text', () => {
  it('a plural recipe name resolves to a kitchen item stored under the catalog singular canonical name', () => {
    const items = [item({ id: 'tomato', name: 'Tomato', count: 2 })]
    const result = matchIngredient(ing({ id: 'i1', name: 'Tomatoes' }), items)
    expect(result.kind).toBe('exact')
    expect(result.matchedItem?.id).toBe('tomato')
  })

  it('a recipe name written as a declared alias resolves to the canonical kitchen item', () => {
    const items = [item({ id: 'red-onion', name: 'Red onion', stockType: 'divisible', fraction: 1 })]
    const result = matchIngredient(ing({ id: 'i1', name: 'purple onion' }), items)
    expect(result.kind).toBe('exact')
    expect(result.matchedItem?.id).toBe('red-onion')
  })

  it('still falls through to missing when no literal or canonical/alias match exists', () => {
    const result = matchIngredient(ing({ id: 'i1', name: 'Saffron' }), [])
    expect(result.kind).toBe('missing')
  })

  it('does not use substring/partial guessing even through the canonical-name fallback', () => {
    // "onion" alone has no exact canonical/alias entry (see catalog.test.ts),
    // so this must not coincidentally resolve to any of the several onion
    // varieties in the kitchen.
    const items = [
      item({ id: 'red-onion', name: 'Red onion', stockType: 'divisible', fraction: 1 }),
      item({ id: 'yellow-onion', name: 'Yellow Onion', stockType: 'divisible', fraction: 1 }),
    ]
    const result = matchIngredient(ing({ id: 'i1', name: 'onion' }), items)
    expect(result.kind).toBe('missing')
  })
})

// ---------------------------------------------------------------------------
// stockPatchForLevel (Phase 2.3): maps a coarse "low" / "out" intent onto the
// item's own stock type. It's the inverse of stockLevel — a patch it produces
// must actually read back as that level.
// ---------------------------------------------------------------------------

describe('stockPatchForLevel', () => {
  const countable = item({ id: 'eggs', name: 'Eggs', stockType: 'countable', count: 8 })
  const divisible = item({ id: 'onion', name: 'Onion', stockType: 'divisible', fraction: 2.5 })
  const container = item({ id: 'milk', name: 'Milk', stockType: 'container', fill: 0.9 })
  const staple = item({ id: 'flour', name: 'Flour', stockType: 'staple', level: 'plenty' })

  it('maps "low" to the low end of each stock type', () => {
    expect(stockPatchForLevel(countable, 'low')).toEqual({ count: 1 })
    expect(stockPatchForLevel(divisible, 'low')).toEqual({ fraction: 0.25 })
    expect(stockPatchForLevel(container, 'low')).toEqual({ fill: 0.2 })
    expect(stockPatchForLevel(staple, 'low')).toEqual({ level: 'low' })
  })

  it('maps "out" to zero / out for each stock type', () => {
    expect(stockPatchForLevel(countable, 'out')).toEqual({ count: 0 })
    expect(stockPatchForLevel(divisible, 'out')).toEqual({ fraction: 0 })
    expect(stockPatchForLevel(container, 'out')).toEqual({ fill: 0 })
    expect(stockPatchForLevel(staple, 'out')).toEqual({ level: 'out' })
  })

  it('a patched item reads back as exactly that stockLevel', () => {
    for (const base of [countable, divisible, container, staple]) {
      expect(stockLevel({ ...base, ...stockPatchForLevel(base, 'low') })).toBe('low')
      expect(stockLevel({ ...base, ...stockPatchForLevel(base, 'out') })).toBe('out')
    }
  })
})
