import { catalog, type CatalogEntry } from './catalog'

/**
 * A sensible, common starting set drawn from the real canonical catalog —
 * never invented ids. Chosen to span every stockType (countable/divisible/
 * container/staple) and several categories, not to be exhaustive. Used by
 * screens/KitchenSetup.tsx.
 */
export const STARTER_IDS = [
  'eggs',
  'milk',
  'butter',
  'bread',
  'rice',
  'pasta',
  'yellow-onion',
  'garlic',
  'potatoes',
  'chicken-breast',
  'cheddar',
  'flour',
  'olive-oil',
]

export const STARTER_ENTRIES = STARTER_IDS.map((id) => catalog.find((c) => c.id === id)).filter(
  (entry): entry is CatalogEntry => !!entry,
)
