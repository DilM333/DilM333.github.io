import { describe, expect, it } from 'vitest'
import { catalog } from './catalog'
import { STARTER_ENTRIES, STARTER_IDS } from './kitchenSetupStarters'

describe('kitchen setup starter ids', () => {
  it('every curated id resolves to a real canonical catalog entry — none invented, none silently dropped', () => {
    for (const id of STARTER_IDS) {
      expect(catalog.find((c) => c.id === id), `missing catalog entry: ${id}`).toBeDefined()
    }
    expect(STARTER_ENTRIES.length).toBe(STARTER_IDS.length)
  })

  it('is a short, non-empty, deduplicated list — a lightweight starter set, not a full inventory form', () => {
    expect(STARTER_IDS.length).toBeGreaterThan(0)
    expect(new Set(STARTER_IDS).size).toBe(STARTER_IDS.length)
  })
})
