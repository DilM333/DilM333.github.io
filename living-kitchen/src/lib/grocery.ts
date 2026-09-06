import {
  catalog,
  findEntryByName,
  guessCategory,
  guessEmoji,
  type CatalogEntry,
} from '../data/catalog'
import type { GroceryItem, KitchenItem, RecipeIngredient } from '../data/types'

type NewGroceryItem = Omit<GroceryItem, 'id' | 'checked'>

/** Build a grocery-list entry from a recipe ingredient (category guessed from the catalog). */
export function groceryItemForIngredient(ing: RecipeIngredient, reason: string): NewGroceryItem {
  const category =
    catalog.find((c) => c.id === ing.itemId)?.category ??
    catalog.find((c) => c.name.toLowerCase() === ing.name.toLowerCase())?.category ??
    guessCategory(ing.name)
  return { name: ing.name, emoji: ing.emoji, category, reason }
}

/** Build a grocery-list entry from a kitchen item that's run low. */
export function groceryItemForKitchenItem(item: KitchenItem, reason: string): NewGroceryItem {
  return { name: item.name, emoji: item.emoji, category: item.category, reason }
}

/**
 * Build a grocery-list entry from free-typed text. Matches the built-in catalog
 * and the user's custom ingredients so a manually added item still lands in its
 * real category with a real emoji — never an "Other" pile with a cart.
 */
export function groceryItemForName(
  name: string,
  reason: string,
  customCatalog: CatalogEntry[] = [],
): NewGroceryItem {
  const trimmed = name.trim()
  const match = findEntryByName(trimmed, customCatalog)
  if (match) {
    return { name: match.name, emoji: match.emoji, category: match.category, reason }
  }
  const category = guessCategory(trimmed)
  return { name: trimmed, emoji: guessEmoji(trimmed, category), category, reason }
}
