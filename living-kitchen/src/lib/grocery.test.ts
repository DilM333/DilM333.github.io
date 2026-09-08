import { describe, expect, it } from 'vitest'
import { catalog, type CatalogEntry } from '../data/catalog'
import type { KitchenItem } from '../data/types'
import {
  groceryItemForCatalogEntry,
  groceryItemForIngredient,
  groceryItemForKitchenItem,
  groceryItemForName,
  kitchenStockForEntry,
} from './grocery'

function entry(overrides: Partial<CatalogEntry> & Pick<CatalogEntry, 'id' | 'name'>): CatalogEntry {
  return { emoji: '🥕', category: 'Produce', location: 'pantry', stockType: 'countable', ...overrides }
}

function item(overrides: Partial<KitchenItem> & Pick<KitchenItem, 'id' | 'name'>): KitchenItem {
  return { emoji: '🥕', location: 'pantry', stockType: 'countable', category: 'Produce', count: 1, ...overrides }
}

describe('kitchenStockForEntry', () => {
  it('reports a stocked countable item with its display amount', () => {
    const e = entry({ id: 'test-eggs', name: 'Eggs' })
    const items = [item({ id: 'test-eggs', name: 'Eggs', count: 6 })]
    expect(kitchenStockForEntry(e, items)).toEqual({ item: items[0], display: '6' })
  })

  it('reports a low staple item using the existing level label', () => {
    const e = entry({ id: 'test-flour', name: 'Flour', stockType: 'staple' })
    const items = [item({ id: 'test-flour', name: 'Flour', stockType: 'staple', level: 'low' })]
    expect(kitchenStockForEntry(e, items)?.display).toBe('Low')
  })

  it('reports Out for a recorded-but-zero-stock item, distinct from "not recorded"', () => {
    const e = entry({ id: 'test-milk', name: 'Milk', stockType: 'container' })
    const items = [item({ id: 'test-milk', name: 'Milk', stockType: 'container', fill: 0 })]
    expect(kitchenStockForEntry(e, items)).toEqual({ item: items[0], display: 'Out' })
  })

  it('returns null when the ingredient has never been added to the kitchen', () => {
    const e = entry({ id: 'test-saffron', name: 'Saffron' })
    expect(kitchenStockForEntry(e, [])).toBeNull()
  })

  it('never blocks or flags Add — it only returns display info, no boolean gate', () => {
    const e = entry({ id: 'test-eggs', name: 'Eggs' })
    const items = [item({ id: 'test-eggs', name: 'Eggs', count: 6 })]
    // The caller (GroceryList) always renders the same enabled Add affordance
    // regardless of this result — asserting the shape here, not UI, since
    // that policy lives in the screen, not this helper.
    expect(kitchenStockForEntry(e, items)).not.toBeNull()
  })

  it('credits an approved substitute already in the kitchen, via matchIngredient (real catalog relationship)', () => {
    const redOnion = catalog.find((c) => c.id === 'red-onion')
    if (!redOnion) throw new Error('expected red-onion in the real catalog for this test')
    const items = [item({ id: 'yellow-onion', name: 'Yellow Onion', count: 3 })]
    expect(kitchenStockForEntry(redOnion, items)).toEqual({ item: items[0], display: '3' })
  })
})

describe('grocery item builders retain canonical itemId', () => {
  it('groceryItemForIngredient carries the recipe ingredient itemId', () => {
    const g = groceryItemForIngredient(
      { id: 'i1', name: 'Eggs', emoji: '🥚', quantity: '3', itemId: 'eggs' },
      'For Omelet',
    )
    expect(g.itemId).toBe('eggs')
  })

  it('groceryItemForIngredient leaves itemId undefined for a name-only ingredient (no itemId wired)', () => {
    const g = groceryItemForIngredient({ id: 'i1', name: 'Ground beef', emoji: '🥩', quantity: '1 lb' }, 'For Bolognese')
    expect(g.itemId).toBeUndefined()
  })

  it('groceryItemForKitchenItem carries the kitchen item id', () => {
    const g = groceryItemForKitchenItem(item({ id: 'test-milk', name: 'Milk' }), 'Running low')
    expect(g.itemId).toBe('test-milk')
  })

  it('groceryItemForCatalogEntry carries the tapped catalog entry id', () => {
    const g = groceryItemForCatalogEntry(entry({ id: 'test-flour', name: 'Flour' }), 'Added manually')
    expect(g.itemId).toBe('test-flour')
  })

  it('groceryItemForName resolves itemId through a matching custom catalog entry', () => {
    const custom = entry({ id: 'custom-dragonfruit', name: 'Dragonfruit', custom: true })
    const g = groceryItemForName('dragonfruit', 'Added manually', [custom])
    expect(g.itemId).toBe('custom-dragonfruit')
    expect(g.name).toBe('Dragonfruit')
  })

  it('free-text items with no catalog match still work, with itemId left undefined', () => {
    const g = groceryItemForName('paper towels', 'Added manually', [])
    expect(g.itemId).toBeUndefined()
    expect(g.name).toBe('paper towels')
    expect(g.category).toBeTruthy()
  })
})
