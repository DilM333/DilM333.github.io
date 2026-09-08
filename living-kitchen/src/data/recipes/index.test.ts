import { describe, expect, it } from 'vitest'
import { catalog } from '../catalog'
import { REQUIRED_UNIT_STOCK_TYPE } from '../../lib/kitchen'
import { recipes } from './index'

// Structural correctness only — deliberately nothing here judges whether a
// recipe is a *good* recipe (ingredient count, cook time, cuisine variety,
// etc.). That's a manual/editorial call (see the design report). These tests
// exist so a typo or copy-paste mistake fails loudly instead of silently
// degrading matching/readiness for one ingredient or recipe.

describe('recipe ids are unique', () => {
  it('every recipe has a unique id', () => {
    const ids = recipes.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('every referenced itemId exists in the canonical catalog', () => {
  it('has no recipe ingredient pointing at a made-up/typo\'d itemId', () => {
    const catalogIds = new Set(catalog.map((c) => c.id))
    const badRefs: string[] = []
    for (const recipe of recipes) {
      for (const ing of recipe.ingredients) {
        if (ing.itemId && !catalogIds.has(ing.itemId)) {
          badRefs.push(`${recipe.id} -> ${ing.name} (itemId: ${ing.itemId})`)
        }
      }
    }
    expect(badRefs).toEqual([])
  })
})

describe('every recipe declares at least one mealTypes entry', () => {
  it('has no recipe left without meal-type metadata', () => {
    const untagged = recipes.filter((r) => r.mealTypes.length === 0).map((r) => r.id)
    expect(untagged).toEqual([])
  })
})

describe('structured requiredUnit matches the referenced ingredient\'s real stock type', () => {
  it('never seeds a requiredUnit incompatible with its itemId\'s catalog stockType', () => {
    const mismatches: string[] = []
    for (const recipe of recipes) {
      for (const ing of recipe.ingredients) {
        if (ing.requiredUnit == null) continue
        const entry = ing.itemId ? catalog.find((c) => c.id === ing.itemId) : undefined
        if (!entry) continue // covered by the "itemId exists" test above
        if (REQUIRED_UNIT_STOCK_TYPE[ing.requiredUnit] !== entry.stockType) {
          mismatches.push(
            `${recipe.id} -> ${ing.name}: requiredUnit '${ing.requiredUnit}' vs catalog stockType '${entry.stockType}'`,
          )
        }
      }
    }
    expect(mismatches).toEqual([])
  })
})

describe('no accidental duplicate recipes', () => {
  it('has no two distinct recipes built from the exact same set of ingredient itemIds', () => {
    const seen = new Map<string, string>() // itemId-set signature -> first recipe id
    const dupes: string[] = []
    for (const recipe of recipes) {
      const itemIds = recipe.ingredients
        .map((i) => i.itemId)
        .filter((id): id is string => !!id)
        .sort()
      // Skip recipes with too few identified ingredients to make a signature
      // meaningful (e.g. a mostly free-text/seasoning-only ingredient list).
      if (itemIds.length < 2) continue
      const signature = itemIds.join(',')
      const first = seen.get(signature)
      if (first) {
        dupes.push(`${first} and ${recipe.id} share the exact same ingredient set [${signature}]`)
      } else {
        seen.set(signature, recipe.id)
      }
    }
    expect(dupes).toEqual([])
  })
})

describe('no malformed or placeholder recipes', () => {
  it('has non-empty name, description, and emoji on every recipe', () => {
    const bad = recipes
      .filter((r) => !r.name.trim() || !r.description.trim() || !r.emoji.trim())
      .map((r) => r.id)
    expect(bad).toEqual([])
  })

  it('has a positive cook time on every recipe', () => {
    const bad = recipes.filter((r) => !(r.time > 0)).map((r) => r.id)
    expect(bad).toEqual([])
  })

  // Deliberately >= 1, not some larger minimum — a genuinely simple 2 or
  // 3-ingredient recipe (e.g. toast + butter) is a legitimate library entry,
  // not a placeholder. This only catches a recipe with an empty list.
  it('has at least one ingredient on every recipe', () => {
    const bad = recipes.filter((r) => r.ingredients.length === 0).map((r) => r.id)
    expect(bad).toEqual([])
  })

  it('has at least one step, with real instruction text, on every recipe', () => {
    const bad = recipes
      .filter((r) => r.steps.length === 0 || r.steps.some((s) => !s.instruction.trim()))
      .map((r) => r.id)
    expect(bad).toEqual([])
  })

  it('gives every ingredient a non-empty name, emoji, and display quantity', () => {
    const bad: string[] = []
    for (const recipe of recipes) {
      for (const ing of recipe.ingredients) {
        if (!ing.name.trim() || !ing.emoji.trim() || !ing.quantity.trim()) {
          bad.push(`${recipe.id} -> ${ing.id}`)
        }
      }
    }
    expect(bad).toEqual([])
  })
})
