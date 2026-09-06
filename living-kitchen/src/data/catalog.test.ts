import { describe, expect, it } from 'vitest'
import {
  catalog,
  findEntryByName,
  makeCustomCatalogEntry,
  searchCatalog,
  type CatalogEntry,
} from './catalog'

function nameOf(result: { entry: CatalogEntry }[]): string[] {
  return result.map((r) => r.entry.name)
}

describe('catalog has no accidental duplicate ids', () => {
  it('every built-in entry has a unique id', () => {
    const ids = catalog.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('findEntryByName — canonical and alias matching', () => {
  it('matches the canonical name exactly, case-insensitively', () => {
    expect(findEntryByName('red onion')?.id).toBe('red-onion')
    expect(findEntryByName('Red Onion')?.id).toBe('red-onion')
    expect(findEntryByName('RED ONION')?.id).toBe('red-onion')
  })

  it('purple onion / red onions resolve to the Red onion canonical entry', () => {
    expect(findEntryByName('purple onion')?.name).toBe('Red onion')
    expect(findEntryByName('Purple Onion')?.name).toBe('Red onion')
    expect(findEntryByName('purple onions')?.name).toBe('Red onion')
    expect(findEntryByName('red onions')?.name).toBe('Red onion')
  })

  it('scallion/scallions resolve to Green Onion', () => {
    expect(findEntryByName('scallion')?.name).toBe('Green Onion')
    expect(findEntryByName('scallions')?.name).toBe('Green Onion')
    expect(findEntryByName('Scallions')?.name).toBe('Green Onion')
  })

  it('garbanzo beans resolves to Chickpeas', () => {
    expect(findEntryByName('garbanzo beans')?.name).toBe('Chickpeas')
    expect(findEntryByName('garbanzo bean')?.name).toBe('Chickpeas')
    expect(findEntryByName('Garbanzo Beans')?.name).toBe('Chickpeas')
  })

  it('bell peppers / capsicum resolve to Bell Pepper', () => {
    expect(findEntryByName('bell peppers')?.name).toBe('Bell Pepper')
    expect(findEntryByName('capsicum')?.name).toBe('Bell Pepper')
    expect(findEntryByName('capsicums')?.name).toBe('Bell Pepper')
  })

  it('coriander leaves resolves to Cilantro', () => {
    expect(findEntryByName('coriander leaves')?.name).toBe('Cilantro')
    expect(findEntryByName('coriander')?.name).toBe('Cilantro')
  })

  it('is tolerant of surrounding whitespace and basic punctuation', () => {
    expect(findEntryByName('  red onion  ')?.id).toBe('red-onion')
    expect(findEntryByName("red onion.")?.id).toBe('red-onion')
  })

  it('handles simple plurals safely without a stemmer', () => {
    expect(findEntryByName('tomatoes')?.id).toBe('tomato')
    expect(findEntryByName('carrots')?.id).toBe('carrots') // already the canonical plural form
    expect(findEntryByName('strawberry')?.id).toBe('strawberries')
  })

  it('does not confuse genuinely different foods', () => {
    // "onion" alone is ambiguous by design — it should not silently resolve
    // to one specific variety.
    expect(findEntryByName('garlic')?.id).toBe('garlic')
    expect(findEntryByName('ginger')?.id).toBe('ginger')
    expect(findEntryByName('cilantro')?.id).not.toBe(findEntryByName('parsley')?.id)
  })

  it('returns undefined for something with no reasonable match', () => {
    expect(findEntryByName('quantum flapdoodle')).toBeUndefined()
    expect(findEntryByName('')).toBeUndefined()
  })

  it("a user's own custom ingredient is preferred over a same-named built-in entry", () => {
    const custom = makeCustomCatalogEntry({
      name: 'Purple Onion',
      category: 'Produce',
      location: 'fridge',
      stockType: 'divisible',
    })
    const match = findEntryByName('purple onion', [custom])
    expect(match?.id).toBe(custom.id)
    expect(match?.custom).toBe(true)
  })
})

describe('searchCatalog — ranked, deduplicated results', () => {
  it('returns the canonical entry only once for an alias query, never the alias text as the display name', () => {
    const results = searchCatalog('purple onion')
    const redOnionHits = results.filter((r) => r.entry.id === 'red-onion')
    expect(redOnionHits).toHaveLength(1)
    expect(redOnionHits[0].entry.name).toBe('Red onion')
    expect(redOnionHits[0].matchedAlias).toBe('purple onion')
  })

  it('prefers an exact canonical name match over an alias match on another/same entry', () => {
    const results = searchCatalog('red onion')
    expect(results[0].entry.name).toBe('Red onion')
    expect(results[0].matchedAlias).toBeUndefined()
  })

  it('scallions ranks Green Onion first via alias, not as a separate "scallion" entry', () => {
    const results = searchCatalog('scallions')
    expect(results[0].entry.name).toBe('Green Onion')
    expect(results.some((r) => r.entry.name.toLowerCase() === 'scallions')).toBe(false)
  })

  it('garbanzo beans ranks Chickpeas first', () => {
    const results = searchCatalog('garbanzo beans')
    expect(results[0].entry.name).toBe('Chickpeas')
  })

  it('bell peppers ranks Bell Pepper first', () => {
    const results = searchCatalog('bell peppers')
    expect(results[0].entry.name).toBe('Bell Pepper')
  })

  it('a generic ambiguous term surfaces multiple distinct real onions rather than guessing one', () => {
    const names = nameOf(searchCatalog('onion'))
    expect(names).toContain('Red onion')
    expect(names).toContain('Green Onion')
    expect(names).toContain('Yellow Onion')
  })

  it('a short singularized fragment does not falsely match inside an unrelated longer word', () => {
    // Regression: singularizing "eggs" -> "egg" must not then substring-match
    // "veggies" (Frozen Mixed Vegetables' alias "frozen veggies").
    const names = nameOf(searchCatalog('eggs'))
    expect(names).toContain('Eggs')
    expect(names).not.toContain('Frozen Mixed Vegetables')
  })

  it('an empty query returns the full combined catalog unranked', () => {
    const results = searchCatalog('', [])
    expect(results.length).toBe(catalog.length)
  })

  it("does not hide a user's custom ingredient behind a built-in alias match", () => {
    const custom = makeCustomCatalogEntry({
      name: 'Purple Onion',
      category: 'Produce',
      location: 'fridge',
      stockType: 'divisible',
    })
    const results = searchCatalog('purple onion', [custom])
    // Both are surfaced — the user's own entry (exact name match, ranked
    // first) and the canonical suggestion — nothing is silently replaced.
    expect(results[0].entry.id).toBe(custom.id)
    expect(results.some((r) => r.entry.id === 'red-onion')).toBe(true)
  })
})

describe('seed/recipe id compatibility', () => {
  it('canonical ids referenced by seed kitchen data and recipes exist with matching identity', () => {
    const expected: [string, string][] = [
      ['red-onion', 'Red onion'],
      ['eggs', 'Eggs'],
      ['milk', 'Milk'],
      ['butter', 'Butter'],
      ['carrots', 'Carrots'],
      ['spinach', 'Spinach'],
      ['parsley', 'Parsley'],
      ['mushrooms', 'Mushrooms'],
      ['chicken-breast', 'Chicken breast'],
      ['rice', 'Rice'],
      ['pasta', 'Pasta'],
      ['orzo', 'Orzo'],
      ['broth', 'Vegetable broth'],
      ['lemon', 'Lemon'],
      ['corn', 'Corn'],
      ['salt', 'Salt'],
      ['olive-oil', 'Olive oil'],
      ['parmesan', 'Parmesan'],
      ['potatoes', 'Potatoes'],
    ]
    for (const [id, name] of expected) {
      const entry = catalog.find((c) => c.id === id)
      expect(entry, `expected catalog entry with id "${id}"`).toBeDefined()
      expect(entry?.name).toBe(name)
    }
  })
})
