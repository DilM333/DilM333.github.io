import { describe, expect, it } from 'vitest'
import type { CatalogEntry } from '../data/catalog'
import { rowToGroceryItem, type GroceryItemRow } from './grocerySync'

function row(overrides: Partial<GroceryItemRow> & Pick<GroceryItemRow, 'name'>): GroceryItemRow {
  return {
    id: 'row-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    household_id: 'household-1',
    quantity: null,
    unit: null,
    checked: false,
    reason: null,
    ...overrides,
  }
}

function entry(overrides: Partial<CatalogEntry> & Pick<CatalogEntry, 'id' | 'name'>): CatalogEntry {
  return { emoji: '🥕', category: 'Produce', location: 'pantry', stockType: 'countable', ...overrides }
}

describe('rowToGroceryItem', () => {
  it('reconstructs a local, best-effort itemId when the name matches a custom catalog entry', () => {
    const custom = entry({ id: 'custom-dragonfruit', name: 'Dragonfruit', custom: true })
    const item = rowToGroceryItem(row({ name: 'Dragonfruit' }), [custom])
    expect(item.itemId).toBe('custom-dragonfruit')
  })

  it('reconstructs itemId from the built-in catalog when there is no custom match', () => {
    const item = rowToGroceryItem(row({ name: 'Tomato' }), [])
    expect(item.itemId).toBe('tomato')
  })

  it('leaves itemId undefined for an arbitrary row with no catalog match — old rows still load fine', () => {
    const item = rowToGroceryItem(row({ name: 'Paper towels' }), [])
    expect(item.itemId).toBeUndefined()
    expect(item.name).toBe('Paper towels')
    expect(item.category).toBeTruthy()
  })
})
