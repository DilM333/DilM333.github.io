import {
  catalog,
  findEntryByName,
  guessCategory,
  guessEmoji,
  type CatalogEntry,
} from '../data/catalog'
import type { GroceryItem, KitchenItem, RecipeIngredient } from '../data/types'
import { itemDisplayAmount, matchIngredient } from './kitchen'

type NewGroceryItem = Omit<GroceryItem, 'id' | 'checked'>

/** Build a grocery-list entry from a recipe ingredient (category guessed from the catalog). */
export function groceryItemForIngredient(ing: RecipeIngredient, reason: string): NewGroceryItem {
  const category =
    catalog.find((c) => c.id === ing.itemId)?.category ??
    catalog.find((c) => c.name.toLowerCase() === ing.name.toLowerCase())?.category ??
    guessCategory(ing.name)
  return { name: ing.name, emoji: ing.emoji, category, reason, itemId: ing.itemId }
}

/** Build a grocery-list entry from a kitchen item that's run low. */
export function groceryItemForKitchenItem(item: KitchenItem, reason: string): NewGroceryItem {
  return { name: item.name, emoji: item.emoji, category: item.category, reason, itemId: item.id }
}

/** Build a grocery-list entry from a specific catalog search result the user tapped. */
export function groceryItemForCatalogEntry(entry: CatalogEntry, reason: string): NewGroceryItem {
  return { name: entry.name, emoji: entry.emoji, category: entry.category, reason, itemId: entry.id }
}

/**
 * Build a grocery-list entry from free-typed text. Matches the built-in catalog
 * and the user's custom ingredients so a manually added item still lands in its
 * real category with a real emoji — never an "Other" pile with a cart. Leaves
 * `itemId` undefined when nothing matches — Euko's grocery list also holds
 * plain arbitrary items ("paper towels", "dish soap") with no ingredient
 * identity at all, and that's expected, not a gap.
 */
export function groceryItemForName(
  name: string,
  reason: string,
  customCatalog: CatalogEntry[] = [],
): NewGroceryItem {
  const trimmed = name.trim()
  const match = findEntryByName(trimmed, customCatalog)
  if (match) {
    return { name: match.name, emoji: match.emoji, category: match.category, reason, itemId: match.id }
  }
  const category = guessCategory(trimmed)
  return { name: trimmed, emoji: guessEmoji(trimmed, category), category, reason }
}

export interface KitchenStockInfo {
  /** The resolved kitchen item — exact match, or an approved substitute. */
  item: KitchenItem
  /** e.g. "6", "About ¼", "Low", "Out" — ready to show as "In kitchen · {display}". */
  display: string
}

/**
 * Kitchen-awareness for a catalog entry being considered for the grocery
 * list — purely informational, never used to block adding (someone with 2
 * eggs may well want a dozen more).
 *
 * Reuses `matchIngredient` (the one canonical exact/substitute/missing
 * resolution engine — see lib/kitchen.ts) rather than a second lookup, so an
 * approved substitute already in the kitchen is correctly credited as
 * "in kitchen" here too. `matchIngredient` deliberately treats a zero-stock
 * item exactly like "never added" (both resolve to kind: 'missing') — since
 * this feature specifically needs to tell "recorded but Out" apart from
 * "not recorded at all", the canonical kitchen item (by id, no substitute
 * guessing) is checked directly for that one case, without touching
 * `matchIngredient` itself.
 */
export function kitchenStockForEntry(entry: CatalogEntry, items: KitchenItem[]): KitchenStockInfo | null {
  const pseudoIngredient: RecipeIngredient = {
    id: entry.id,
    name: entry.name,
    emoji: entry.emoji,
    quantity: '',
    itemId: entry.id,
  }
  const match = matchIngredient(pseudoIngredient, items)
  if (match.matchedItem) {
    return { item: match.matchedItem, display: itemDisplayAmount(match.matchedItem) }
  }

  const canonical = items.find((i) => i.id === entry.id)
  if (canonical) {
    // matchIngredient already ruled out any stock on this exact item (and on
    // any approved substitute) above, so this is genuinely recorded-but-Out.
    return { item: canonical, display: 'Out' }
  }
  return null
}
