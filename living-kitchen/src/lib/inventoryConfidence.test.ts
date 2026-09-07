import { describe, expect, it } from 'vitest'
import type { KitchenItem } from '../data/types'
import {
  CONFIDENCE_THRESHOLDS,
  daysSinceObserved,
  driftClassFor,
  inventoryConfidence,
} from './inventoryConfidence'

const NOW = Date.parse('2026-09-06T12:00:00Z')
const DAY = 86_400_000
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString()

function item(overrides: Partial<KitchenItem> & Pick<KitchenItem, 'id' | 'name'>): KitchenItem {
  return {
    emoji: '🥕',
    location: 'fridge',
    stockType: 'countable',
    category: 'Produce',
    count: 1,
    ...overrides,
  }
}

/** confidence purely from an integer age, via daysSincePurchase (clock-independent). */
const conf = (category: string, days: number, extra: Partial<KitchenItem> = {}) =>
  inventoryConfidence(item({ id: 'x', name: 'X', category, daysSincePurchase: days, ...extra }), NOW)

describe('driftClassFor — knowledge-drift rate, not spoilage', () => {
  it('high-turnover categories are fast', () => {
    for (const category of ['Dairy', 'Herbs']) {
      expect(driftClassFor(item({ id: 'i', name: 'i', category }))).toBe('fast')
    }
  })

  it('produce and meat are only moderate — long-keepers must not be treated as volatile', () => {
    expect(driftClassFor(item({ id: 'i', name: 'i', category: 'Produce' }))).toBe('moderate')
    expect(driftClassFor(item({ id: 'i', name: 'i', category: 'Meat' }))).toBe('moderate')
  })

  it('unknown categories default to moderate', () => {
    expect(driftClassFor(item({ id: 'i', name: 'i', category: 'Mystery' }))).toBe('moderate')
  })

  it('low-turnover categories are slow', () => {
    for (const category of ['Pantry', 'Pantry staple', 'Seasonings', 'Grains', 'Frozen']) {
      expect(driftClassFor(item({ id: 'i', name: 'i', category }))).toBe('slow')
    }
  })

  it('a staple stock type is always slow, even in a fast category', () => {
    expect(
      driftClassFor(item({ id: 'i', name: 'i', category: 'Dairy', stockType: 'staple' })),
    ).toBe('slow')
  })
})

describe('inventoryConfidence — produce (moderate) is not distrusted after a few days', () => {
  const { highMaxDays, mediumMaxDays } = CONFIDENCE_THRESHOLDS.moderate // 21 / 60

  it('a week-old onion/potato/carrot is still fully trusted', () => {
    expect(conf('Produce', 3)).toBe('high')
    expect(conf('Produce', 7)).toBe('high')
    expect(conf('Produce', 14)).toBe('high')
  })

  it('boundary: exactly highMaxDays is high, one past is medium', () => {
    expect(conf('Produce', highMaxDays)).toBe('high') // 21
    expect(conf('Produce', highMaxDays + 1)).toBe('medium') // 22
  })

  it('boundary: exactly mediumMaxDays is medium, one past is low', () => {
    expect(conf('Produce', mediumMaxDays)).toBe('medium') // 60
    expect(conf('Produce', mediumMaxDays + 1)).toBe('low') // 61
  })
})

describe('inventoryConfidence — high-turnover dairy (fast)', () => {
  const { highMaxDays, mediumMaxDays } = CONFIDENCE_THRESHOLDS.fast // 10 / 30

  it('trusted for about a week and a half', () => {
    expect(conf('Dairy', 0)).toBe('high')
    expect(conf('Dairy', highMaxDays)).toBe('high') // 10
  })

  it('boundaries', () => {
    expect(conf('Dairy', highMaxDays + 1)).toBe('medium') // 11
    expect(conf('Dairy', mediumMaxDays)).toBe('medium') // 30
    expect(conf('Dairy', mediumMaxDays + 1)).toBe('low') // 31
  })
})

describe('inventoryConfidence — pantry staple (slow)', () => {
  const { highMaxDays, mediumMaxDays } = CONFIDENCE_THRESHOLDS.slow // 60 / 150

  it('a couple of months old is still high', () => {
    expect(conf('Pantry staple', 0)).toBe('high')
    expect(conf('Pantry staple', highMaxDays)).toBe('high') // 60
  })

  it('boundaries', () => {
    expect(conf('Pantry staple', highMaxDays + 1)).toBe('medium') // 61
    expect(conf('Pantry staple', mediumMaxDays)).toBe('medium') // 150
    expect(conf('Pantry staple', mediumMaxDays + 1)).toBe('low') // 151
  })

  it('a fast-category item stored as a staple still decays slowly', () => {
    expect(conf('Dairy', 45, { stockType: 'staple', level: 'some' })).toBe('high')
  })

  it('at the same age, a fast item is less certain than a slow one', () => {
    expect(conf('Dairy', 40)).toBe('low')
    expect(conf('Pantry staple', 40)).toBe('high')
  })
})

describe('daysSinceObserved — which signal wins', () => {
  it('uses the MORE RECENT of updatedAt and daysSincePurchase', () => {
    const confirmedRecently = item({
      id: 'milk',
      name: 'Milk',
      category: 'Dairy',
      daysSincePurchase: 400,
      updatedAt: daysAgo(2),
    })
    expect(daysSinceObserved(confirmedRecently, NOW)).toBe(2)
    expect(inventoryConfidence(confirmedRecently, NOW)).toBe('high')

    const restocked = item({
      id: 'eggs',
      name: 'Eggs',
      category: 'Dairy',
      daysSincePurchase: 0,
      updatedAt: daysAgo(100),
    })
    expect(daysSinceObserved(restocked, NOW)).toBe(0)
  })

  it('no timestamps at all -> age 0 (a brand-new local item is presumed observed)', () => {
    const bare = item({ id: 'x', name: 'X', category: 'Produce' })
    delete bare.daysSincePurchase
    expect(daysSinceObserved(bare, NOW)).toBe(0)
    expect(inventoryConfidence(bare, NOW)).toBe('high')
  })

  it('a future updatedAt (clock skew) clamps to 0, never negative', () => {
    const future = item({
      id: 'x',
      name: 'X',
      category: 'Dairy',
      updatedAt: new Date(NOW + 5 * DAY).toISOString(),
    })
    delete future.daysSincePurchase
    expect(daysSinceObserved(future, NOW)).toBe(0)
    expect(inventoryConfidence(future, NOW)).toBe('high')
  })

  it('an unparseable updatedAt is ignored and daysSincePurchase is used', () => {
    const weird = item({
      id: 'x',
      name: 'X',
      category: 'Dairy',
      daysSincePurchase: 40,
      updatedAt: 'not-a-date',
    })
    expect(daysSinceObserved(weird, NOW)).toBe(40)
    expect(inventoryConfidence(weird, NOW)).toBe('low')
  })
})

describe('an explicit fresh observation immediately restores high confidence', () => {
  it('stamping updatedAt to now overrides an old daysSincePurchase', () => {
    const stale = item({
      id: 'butter',
      name: 'Butter',
      category: 'Dairy',
      stockType: 'container',
      fill: 0.4,
      daysSincePurchase: 300,
    })
    expect(inventoryConfidence(stale, NOW)).toBe('low')

    const justConfirmed = { ...stale, updatedAt: new Date(NOW).toISOString() }
    expect(daysSinceObserved(justConfirmed, NOW)).toBe(0)
    expect(inventoryConfidence(justConfirmed, NOW)).toBe('high')
  })
})
