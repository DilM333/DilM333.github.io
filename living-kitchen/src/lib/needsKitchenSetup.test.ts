import { describe, expect, it } from 'vitest'
import { needsKitchenSetup } from './needsKitchenSetup'

function state(overrides: Partial<Parameters<typeof needsKitchenSetup>[0]> = {}) {
  return {
    onboarded: true,
    kitchenSyncError: null,
    items: [] as unknown[],
    householdId: 'house-a',
    kitchenSetupSeenHouseholds: [] as string[],
    ...overrides,
  }
}

describe('needsKitchenSetup', () => {
  it('shows for a genuinely new, empty, never-dismissed household', () => {
    expect(needsKitchenSetup(state())).toBe(true)
  })

  it('never shows before basic onboarding is complete', () => {
    expect(needsKitchenSetup(state({ onboarded: false }))).toBe(false)
  })

  it('never shows for a household that already has real items — joining a populated household', () => {
    expect(needsKitchenSetup(state({ items: [{ id: 'eggs' }] }))).toBe(false)
  })

  it('never shows while the last sync attempt failed — items cannot be trusted as truly empty', () => {
    expect(needsKitchenSetup(state({ kitchenSyncError: 'RLS blocked ...' }))).toBe(false)
  })

  it('never shows once this household has been marked seen', () => {
    expect(
      needsKitchenSetup(state({ householdId: 'house-a', kitchenSetupSeenHouseholds: ['house-a'] })),
    ).toBe(false)
  })

  it('never shows with no resolved household yet', () => {
    expect(needsKitchenSetup(state({ householdId: null }))).toBe(false)
  })

  it('shows again for a different, empty, not-yet-dismissed household (join/switch to empty B)', () => {
    expect(
      needsKitchenSetup(state({ householdId: 'house-b', kitchenSetupSeenHouseholds: ['house-a'] })),
    ).toBe(true)
  })

  it('A -> B -> A: dismissing setup in two different households remembers both, so switching back to A does not re-show it', () => {
    // This is exactly the case a single global/scalar dismissal flag gets
    // wrong — it can only remember the most recently dismissed household.
    const seenBoth = ['house-a', 'house-b']
    expect(needsKitchenSetup(state({ householdId: 'house-a', kitchenSetupSeenHouseholds: seenBoth }))).toBe(
      false,
    )
    expect(needsKitchenSetup(state({ householdId: 'house-b', kitchenSetupSeenHouseholds: seenBoth }))).toBe(
      false,
    )
  })
})
