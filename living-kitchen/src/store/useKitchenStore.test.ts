import { beforeEach, describe, expect, it } from 'vitest'
import type { KitchenItem, Recipe, RecipeIngredient } from '../data/types'
import { catalog, toKitchenItem } from '../data/catalog'
import { computeFeasibility, ingredientStatus, matchIngredient } from '../lib/kitchen'
import { inventoryConfidence } from '../lib/inventoryConfidence'
import { uncertainRequiredItems } from '../lib/recipeMatch'
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

// ---------------------------------------------------------------------------
// Inventory confidence (Phase 2.1): an explicit local write to an item's stock
// must count as a fresh observation immediately — the item's local `updatedAt`
// updates on the spot, so lib/inventoryConfidence reads 'high' without waiting
// for the Supabase round-trip. And a freshly seeded demo kitchen must not look
// distrustworthy just because of hardcoded daysSincePurchase values.
// ---------------------------------------------------------------------------

describe('inventory confidence — explicit local writes are fresh observations', () => {
  beforeEach(() => {
    useKitchenStore.getState().resetDemo()
  })

  const get = (id: string) => useKitchenStore.getState().items.find((i) => i.id === id)!

  /** Force an item to look untouched for a long time (no updatedAt, old purchase). */
  const makeStale = (id: string) => {
    useKitchenStore.setState((s) => ({
      items: s.items.map((i) =>
        i.id === id ? { ...i, updatedAt: undefined, daysSincePurchase: 400 } : i,
      ),
    }))
    expect(inventoryConfidence(get(id))).toBe('low')
  }

  it('a fresh demo kitchen is entirely high-confidence', () => {
    for (const item of useKitchenStore.getState().items) {
      expect(inventoryConfidence(item)).toBe('high')
    }
  })

  it('updateCount restores high confidence and stamps updatedAt', () => {
    makeStale('eggs')
    const t0 = Date.now()
    useKitchenStore.getState().updateCount('eggs', -1)
    const after = get('eggs')
    expect(Date.parse(after.updatedAt!)).toBeGreaterThanOrEqual(t0)
    expect(inventoryConfidence(after)).toBe('high')
  })

  it('updateLevel restores high confidence', () => {
    makeStale('rice')
    useKitchenStore.getState().updateLevel('rice', 'some')
    expect(inventoryConfidence(get('rice'))).toBe('high')
  })

  it('updateFraction restores high confidence', () => {
    makeStale('spinach')
    useKitchenStore.getState().updateFraction('spinach', 0.5)
    expect(inventoryConfidence(get('spinach'))).toBe('high')
  })

  it('setReserved restores high confidence', () => {
    makeStale('butter')
    useKitchenStore.getState().setReserved('butter', 0.25, 'cookies')
    expect(inventoryConfidence(get('butter'))).toBe('high')
  })

  it('restocking via addKitchenItem restores high confidence', () => {
    makeStale('butter')
    useKitchenStore.getState().addKitchenItem(toKitchenItem(catalogEntry('butter')))
    expect(inventoryConfidence(get('butter'))).toBe('high')
  })

  it('confirming the kitchen after cooking (finishCooking) restores high confidence', () => {
    makeStale('eggs')
    useKitchenStore.getState().finishCooking([{ itemId: 'eggs', newCount: 2 }])
    expect(inventoryConfidence(get('eggs'))).toBe('high')
  })
})

// ---------------------------------------------------------------------------
// Phase 2.3: one-tap inventory confirmation from the recipe flow.
// confirmKitchenItem ("Still have it") and setItemStockLevel ("Low" / "Out")
// run through the ordinary kitchen mutations + persistItem (household sync)
// path — no direct Supabase writes, no second stock model.
// ---------------------------------------------------------------------------

function kItem(over: Partial<KitchenItem> & Pick<KitchenItem, 'id' | 'name' | 'stockType'>): KitchenItem {
  return {
    emoji: '🥣',
    location: 'fridge',
    category: 'Dairy',
    daysSincePurchase: 400, // stale by default
    ...over,
  }
}
function ing(over: Partial<RecipeIngredient> & Pick<RecipeIngredient, 'id' | 'name'>): RecipeIngredient {
  return { emoji: '🥣', quantity: '1', ...over }
}
function testRecipe(ingredients: RecipeIngredient[]): Recipe {
  return {
    id: 'r',
    name: 'Test',
    emoji: '🍽️',
    time: 20,
    effortLabel: 'Easy',
    effort: 'Normal',
    tags: [],
    description: '',
    ingredients,
    steps: [],
  }
}

describe('confirmKitchenItem — "still have it"', () => {
  beforeEach(() => useKitchenStore.getState().resetDemo())
  const get = (id: string) => useKitchenStore.getState().items.find((i) => i.id === id)!

  it('bumps observation time and restores high confidence without touching stock or reservation', () => {
    // Seed butter: staple, reserved 0.5 with a reservedFor. Make it stale first.
    useKitchenStore.setState((s) => ({
      items: s.items.map((i) =>
        i.id === 'butter' ? { ...i, updatedAt: undefined, daysSincePurchase: 400 } : i,
      ),
    }))
    const before = get('butter')
    expect(inventoryConfidence(before)).toBe('low')

    const t0 = Date.now()
    useKitchenStore.getState().confirmKitchenItem('butter')

    const after = get('butter')
    expect(after.level).toBe(before.level)
    expect(after.reserved).toBe(before.reserved)
    expect(after.reservedFor).toBe(before.reservedFor)
    expect(after.remoteId).toBe(before.remoteId)
    expect(Date.parse(after.updatedAt!)).toBeGreaterThanOrEqual(t0)
    expect(inventoryConfidence(after)).toBe('high')
  })
})

describe('setItemStockLevel — "low" / "out" per stock type', () => {
  const load = (item: KitchenItem) => useKitchenStore.setState({ items: [item], householdId: null })
  const only = () => useKitchenStore.getState().items[0]

  it('"low" maps to each stock type and refreshes the observation', () => {
    load(kItem({ id: 'x', name: 'X', stockType: 'countable', count: 9 }))
    useKitchenStore.getState().setItemStockLevel('x', 'low')
    expect(only().count).toBe(1)
    expect(inventoryConfidence(only())).toBe('high')

    load(kItem({ id: 'x', name: 'X', stockType: 'divisible', fraction: 3 }))
    useKitchenStore.getState().setItemStockLevel('x', 'low')
    expect(only().fraction).toBe(0.25)

    load(kItem({ id: 'x', name: 'X', stockType: 'container', fill: 0.95 }))
    useKitchenStore.getState().setItemStockLevel('x', 'low')
    expect(only().fill).toBe(0.2)

    load(kItem({ id: 'x', name: 'X', stockType: 'staple', level: 'plenty' }))
    useKitchenStore.getState().setItemStockLevel('x', 'low')
    expect(only().level).toBe('low')
  })

  it('"out" maps to zero / out for each stock type', () => {
    load(kItem({ id: 'x', name: 'X', stockType: 'countable', count: 9 }))
    useKitchenStore.getState().setItemStockLevel('x', 'out')
    expect(only().count).toBe(0)

    load(kItem({ id: 'x', name: 'X', stockType: 'divisible', fraction: 3 }))
    useKitchenStore.getState().setItemStockLevel('x', 'out')
    expect(only().fraction).toBe(0)

    load(kItem({ id: 'x', name: 'X', stockType: 'container', fill: 0.95 }))
    useKitchenStore.getState().setItemStockLevel('x', 'out')
    expect(only().fill).toBe(0)

    load(kItem({ id: 'x', name: 'X', stockType: 'staple', level: 'plenty' }))
    useKitchenStore.getState().setItemStockLevel('x', 'out')
    expect(only().level).toBe('out')
  })

  it('preserves reservation and identity', () => {
    load(
      kItem({
        id: 'x',
        name: 'X',
        stockType: 'divisible',
        fraction: 2,
        reserved: 0.5,
        reservedFor: 'pie',
        remoteId: 'row-1',
        custom: true,
      }),
    )
    useKitchenStore.getState().setItemStockLevel('x', 'low')
    const after = only()
    expect(after.fraction).toBe(0.25)
    expect(after.reserved).toBe(0.5)
    expect(after.reservedFor).toBe('pie')
    expect(after.remoteId).toBe('row-1')
    expect(after.custom).toBe(true)
  })
})

describe('worth-checking flow — queue + readiness re-evaluation', () => {
  const load = (items: KitchenItem[]) => useKitchenStore.setState({ items, householdId: null })
  const live = () => useKitchenStore.getState().items

  it('confirming one uncertain item advances the queue to the next', () => {
    load([
      kItem({ id: 'milk', name: 'Milk', stockType: 'container', fill: 1 }),
      kItem({ id: 'spinach', name: 'Spinach', stockType: 'divisible', fraction: 1, category: 'Produce' }),
    ])
    const r = testRecipe([
      ing({ id: 'a', name: 'Milk', itemId: 'milk' }),
      ing({ id: 'b', name: 'Spinach', itemId: 'spinach' }),
    ])
    expect(uncertainRequiredItems(r, live()).map((i) => i.id)).toEqual(['milk', 'spinach'])

    useKitchenStore.getState().confirmKitchenItem('milk')
    expect(uncertainRequiredItems(r, live()).map((i) => i.id)).toEqual(['spinach'])
  })

  it('an item already refreshed elsewhere is skipped by the queue', () => {
    load([kItem({ id: 'milk', name: 'Milk', stockType: 'container', fill: 1 })])
    const r = testRecipe([ing({ id: 'a', name: 'Milk', itemId: 'milk' })])

    useKitchenStore.getState().confirmKitchenItem('milk') // "elsewhere"
    expect(uncertainRequiredItems(r, live())).toEqual([])
  })

  it('a queued item that vanishes from the store is silently dropped, advancing to the next', () => {
    load([
      kItem({ id: 'milk', name: 'Milk', stockType: 'container', fill: 1 }),
      kItem({ id: 'spinach', name: 'Spinach', stockType: 'divisible', fraction: 1, category: 'Produce' }),
    ])
    const r = testRecipe([
      ing({ id: 'a', name: 'Milk', itemId: 'milk' }),
      ing({ id: 'b', name: 'Spinach', itemId: 'spinach' }),
    ])
    expect(uncertainRequiredItems(r, live()).map((i) => i.id)).toEqual(['milk', 'spinach'])

    // milk removed from the kitchen entirely (e.g. by another device)
    useKitchenStore.getState().removeKitchenItem('milk')
    expect(uncertainRequiredItems(r, live()).map((i) => i.id)).toEqual(['spinach'])

    // and the last one goes too -> empty queue, panel disappears naturally
    useKitchenStore.getState().removeKitchenItem('spinach')
    expect(uncertainRequiredItems(r, live())).toEqual([])
  })

  it('marking an uncertain ingredient Out re-evaluates the recipe via the readiness engine', () => {
    load([
      kItem({ id: 'milk', name: 'Milk', stockType: 'container', fill: 1 }),
      kItem({ id: 'eggs', name: 'Eggs', stockType: 'countable', count: 6, daysSincePurchase: 1 }),
    ])
    const r = testRecipe([
      ing({ id: 'a', name: 'Milk', itemId: 'milk' }),
      ing({ id: 'b', name: 'Eggs', itemId: 'eggs' }),
    ])
    expect(computeFeasibility(r, live()).status).toBe('ready')

    useKitchenStore.getState().setItemStockLevel('milk', 'out')
    expect(computeFeasibility(r, live()).status).toBe('one-away')
  })
})

// ---------------------------------------------------------------------------
// Grocery awareness foundation: GroceryItem.itemId lets addToGroceryList
// recognize "the same canonical ingredient" across different display names
// (e.g. a recipe's "Ground beef" vs a catalog result's "Beef"), while
// preserving the original exact-name dedup for arbitrary, non-catalog items
// and for pre-existing grocery rows that predate itemId.
// ---------------------------------------------------------------------------

describe('addToGroceryList — canonical dedup', () => {
  beforeEach(() => {
    useKitchenStore.getState().resetDemo()
    useKitchenStore.setState({ groceryList: [] })
  })
  const list = () => useKitchenStore.getState().groceryList

  it('does not duplicate the same canonical ingredient added under two different display names', () => {
    useKitchenStore.getState().addToGroceryList({
      name: 'Ground beef',
      emoji: '🥩',
      category: 'Meat',
      reason: 'For Bolognese',
      itemId: 'ground-beef',
    })
    useKitchenStore.getState().addToGroceryList({
      name: 'Beef',
      emoji: '🥩',
      category: 'Meat',
      reason: 'Added manually',
      itemId: 'ground-beef',
    })
    expect(list()).toHaveLength(1)
    expect(list()[0].name).toBe('Ground beef')
  })

  it('still dedupes arbitrary, non-catalog items by exact name (unchanged pre-existing behavior)', () => {
    const paperTowels = { name: 'Paper towels', emoji: '🧻', category: 'Household', reason: 'Added manually' }
    useKitchenStore.getState().addToGroceryList(paperTowels)
    useKitchenStore.getState().addToGroceryList(paperTowels)
    expect(list()).toHaveLength(1)
  })

  it('does not treat two different canonical ingredients as duplicates', () => {
    useKitchenStore.getState().addToGroceryList({ name: 'Milk', emoji: '🥛', category: 'Dairy', reason: 'r', itemId: 'milk' })
    useKitchenStore.getState().addToGroceryList({ name: 'Eggs', emoji: '🥚', category: 'Dairy', reason: 'r', itemId: 'eggs' })
    expect(list()).toHaveLength(2)
  })

  it('backward compatible: an itemId-less legacy row and a new itemId-carrying item still dedupe by shared name', () => {
    useKitchenStore.getState().addToGroceryList({
      name: 'Tomatoes',
      emoji: '🍅',
      category: 'Produce',
      reason: 'legacy row, added before itemId existed',
    })
    useKitchenStore.getState().addToGroceryList({
      name: 'Tomatoes',
      emoji: '🍅',
      category: 'Produce',
      reason: 'from catalog autocomplete',
      itemId: 'tomato',
    })
    expect(list()).toHaveLength(1)
  })
})
