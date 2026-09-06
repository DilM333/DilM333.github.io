import { describe, expect, it } from 'vitest'
import { fracPartOf, fractionLabel, quarterGlyph, wholeOf } from './kitchen'
import { suggestDeduction } from './deduction'
import type { KitchenItem } from '../data/types'

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
  it('steps down by a quarter regardless of how many whole units are on hand', () => {
    expect(suggestDeduction(divisibleItem(1), 1).newFraction).toBe(0.75)
    expect(suggestDeduction(divisibleItem(0.25), 1).newFraction).toBe(0)
    expect(suggestDeduction(divisibleItem(0), 1).newFraction).toBe(0)
    // Regression: before generalizing past the old 0..1 ladder, this jumped
    // straight to 0.75 instead of decrementing by a quarter.
    expect(suggestDeduction(divisibleItem(2.75), 1).newFraction).toBe(2.5)
  })
})
