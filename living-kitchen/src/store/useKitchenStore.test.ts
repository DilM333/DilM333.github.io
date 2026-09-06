import { beforeEach, describe, expect, it } from 'vitest'
import { catalog, toKitchenItem } from '../data/catalog'
import { computeFeasibility, ingredientStatus, matchIngredient } from '../lib/kitchen'
import { useKitchenStore } from './useKitchenStore'

function catalogEntry(id: string) {
  const entry = catalog.find((c) => c.id === id)
  if (!entry) throw new Error(`missing catalog fixture: ${id}`)
  return entry
}

// ---------------------------------------------------------------------------
// Regression coverage for the real Add Food -> Make bug: adding a built-in
// catalog ingredient through the actual store action (not just an isolated
// matchIngredient() call) must make an affected seed recipe recognize it
// immediately, with no refresh needed. See kitchen.ts's matchIngredient
// no-itemId fallback and the itemId fixes in data/seed.ts for the root cause.
// ---------------------------------------------------------------------------

describe('Add Food -> Make: addKitchenItem + toKitchenItem against real seed recipes', () => {
  beforeEach(() => {
    useKitchenStore.getState().resetDemo()
  })

  it('adding a completely-absent ingredient (Zucchini) is immediately recognized by the recipe that needs it', () => {
    const recipe = useKitchenStore.getState().recipes.find((r) => r.id === 'roasted-veggies')!
    expect(ingredientStatus(recipe.ingredients.find((i) => i.itemId === 'zucchini')!, useKitchenStore.getState().items)).toBe('missing')

    useKitchenStore.getState().addKitchenItem(toKitchenItem(catalogEntry('zucchini')))

    const items = useKitchenStore.getState().items
    const zucchiniIng = recipe.ingredients.find((i) => i.itemId === 'zucchini')!
    expect(ingredientStatus(zucchiniIng, items)).toBe('ok')
    expect(matchIngredient(zucchiniIng, items).kind).toBe('exact')
  })

  it('regression: adding "Tomato" resolves beef-bolognese\'s "Tomatoes" ingredient (the exact reported bug)', () => {
    const recipe = useKitchenStore.getState().recipes.find((r) => r.id === 'beef-bolognese')!
    const tomatoIng = recipe.ingredients.find((i) => i.name === 'Tomatoes')!
    expect(ingredientStatus(tomatoIng, useKitchenStore.getState().items)).toBe('missing')

    useKitchenStore.getState().addKitchenItem(toKitchenItem(catalogEntry('tomato')))

    const items = useKitchenStore.getState().items
    expect(ingredientStatus(tomatoIng, items)).toBe('ok')
    // Requirement E: the grocery-list UI keys off ingredientStatus directly,
    // so 'ok' here is exactly what makes "+ List" stop appearing.
  })

  it('a required ingredient satisfied only via an approved substitute is recognized through the substitution engine', () => {
    // red-onion is absent from a from-scratch kitchen only if we remove it —
    // use resetDemo's seed kitchen (already has red-onion) but prove the
    // substitute path too: adding yellow-onion when red-onion is depleted.
    useKitchenStore.setState((s) => ({
      items: s.items.map((i) => (i.id === 'red-onion' ? { ...i, fraction: 0 } : i)),
    }))
    const recipe = useKitchenStore.getState().recipes.find((r) => r.id === 'veg-fried-rice')!
    const onionIng = recipe.ingredients.find((i) => i.itemId === 'red-onion')!
    expect(matchIngredient(onionIng, useKitchenStore.getState().items).kind).toBe('missing')

    useKitchenStore.getState().addKitchenItem(toKitchenItem(catalogEntry('yellow-onion')))

    const items = useKitchenStore.getState().items
    const match = matchIngredient(onionIng, items)
    expect(match.kind).toBe('substitute')
    expect(match.matchedItem?.id).toBe('yellow-onion')
  })

  it('adding an ingredient with insufficient structured quantity shows partial, never falsely missing', () => {
    // crispy-herb-chicken requires 4 potatoes (requiredAmount: 4, requiredUnit: 'count').
    // Starting from zero stock and adding one via Add Food's default (count: 1)
    // is short of the requirement — this must read as 'low' (partial), not 'missing'.
    useKitchenStore.setState((s) => ({
      items: s.items.map((i) => (i.id === 'potatoes' ? { ...i, count: 0 } : i)),
    }))
    const recipe = useKitchenStore.getState().recipes.find((r) => r.id === 'crispy-herb-chicken')!
    const potatoIng = recipe.ingredients.find((i) => i.itemId === 'potatoes')!

    useKitchenStore.getState().addKitchenItem(toKitchenItem(catalogEntry('potatoes')))

    const items = useKitchenStore.getState().items
    const match = matchIngredient(potatoIng, items)
    expect(match.kind).toBe('exact')
    expect(match.quantity).toBe('partial')
    expect(ingredientStatus(potatoIng, items)).toBe('low')
    expect(ingredientStatus(potatoIng, items)).not.toBe('missing')
  })

  it('computeFeasibility reflects the newly added ingredient in the same render pass (no stale recipe status)', () => {
    const recipe = useKitchenStore.getState().recipes.find((r) => r.id === 'roasted-veggies')!
    const before = computeFeasibility(recipe, useKitchenStore.getState().items)
    expect(before.status).toBe('needs-shopping')

    useKitchenStore.getState().addKitchenItem(toKitchenItem(catalogEntry('zucchini')))
    useKitchenStore.getState().addKitchenItem(toKitchenItem(catalogEntry('bell-pepper')))

    const after = computeFeasibility(recipe, useKitchenStore.getState().items)
    expect(after.status).not.toBe('needs-shopping')
  })
})

describe('addKitchenItem — restocking an existing item preserves an existing reservation', () => {
  beforeEach(() => {
    useKitchenStore.getState().resetDemo()
  })

  it('does not silently forget the user\'s reservation intent when topping up stock', () => {
    // Seed butter starts at level 'low' with reserved: 0.5 and reservedFor
    // set ("half of what's on hand is reserved for something"). Restocking
    // via Add Food must not erase that reservation — the user still means
    // for that portion to be held back, regardless of how much more they
    // just bought. (Note: `reserved` stays a 0..1 fraction of the *current*
    // total, so what it now represents in absolute terms does shift when the
    // total changes — that's an existing, unchanged property of the
    // reservation model, not something this action should paper over by
    // deleting the reservation outright.)
    const before = useKitchenStore.getState().items.find((i) => i.id === 'butter')!
    expect(before.reserved).toBe(0.5)
    expect(before.reservedFor).toBeDefined()

    useKitchenStore.getState().addKitchenItem(toKitchenItem(catalogEntry('butter')))

    const after = useKitchenStore.getState().items.find((i) => i.id === 'butter')!
    expect(after.level).toBe('plenty')
    expect(after.reserved).toBe(before.reserved)
    expect(after.reservedFor).toBe(before.reservedFor)
  })
})
