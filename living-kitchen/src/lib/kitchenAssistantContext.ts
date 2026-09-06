import type { GroceryItem, KitchenItem, Location, Recipe } from '../data/types'
import { itemHasStock } from './kitchen'
import { rankRecipes, type RecipeMatch } from './recipeMatch'

/**
 * Plain, JSON-serializable snapshot of one kitchen item — enough for a
 * future AI/backend to reason about, without leaking sync-only fields like
 * `remoteId`.
 */
export interface AssistantKitchenItem {
  id: string
  name: string
  category: string
  location: Location
  /** True for ingredients the user created rather than the built-in catalog. */
  custom: boolean
}

export interface AssistantGroceryItem {
  id: string
  name: string
  category: string
  checked: boolean
}

export interface AssistantRecipeSummary {
  id: string
  name: string
  tags: string[]
  /** Names of every ingredient in the recipe (required + optional), for keyword matching. */
  ingredientNames: string[]
  requiredTotal: number
  requiredAvailable: number
  requiredMissing: number
  matchPercent: number
  /** Missing required ingredients that are already on the grocery list. */
  missingIngredientsOnGroceryList: string[]
  /** Missing required ingredients not yet on the grocery list. */
  missingIngredientsNotOnGroceryList: string[]
}

export interface KitchenAssistantContext {
  kitchen: {
    stockedItems: AssistantKitchenItem[]
    outOfStockItems: AssistantKitchenItem[]
    itemCount: number
  }
  grocery: {
    items: AssistantGroceryItem[]
    itemCount: number
  }
  recipes: {
    /** requiredMissing === 0 */
    readyToMake: AssistantRecipeSummary[]
    /** 1-2 missing required ingredients */
    nearlyReady: AssistantRecipeSummary[]
    /** everything else, still in rank order */
    otherMatches: AssistantRecipeSummary[]
  }
  summary: {
    readyRecipeCount: number
    nearlyReadyRecipeCount: number
    stockedIngredientCount: number
    groceryItemCount: number
  }
}

function toAssistantKitchenItem(item: KitchenItem): AssistantKitchenItem {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    location: item.location,
    custom: item.custom ?? false,
  }
}

function toAssistantGroceryItem(item: GroceryItem): AssistantGroceryItem {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    checked: item.checked,
  }
}

/**
 * Same exact-name check used everywhere else grocery-awareness matters
 * (RecipeCard's `shortNotOnList`, RecipeDetail's `onList`) — reused here
 * rather than introducing a second definition of "already on the list".
 */
function isOnGroceryList(name: string, groceryList: GroceryItem[]): boolean {
  return groceryList.some((g) => g.name === name)
}

function toAssistantRecipeSummary(match: RecipeMatch, groceryList: GroceryItem[]): AssistantRecipeSummary {
  const missingOnList: string[] = []
  const missingNotOnList: string[] = []
  for (const ingredient of match.missingIngredients) {
    ;(isOnGroceryList(ingredient.name, groceryList) ? missingOnList : missingNotOnList).push(ingredient.name)
  }

  return {
    id: match.recipe.id,
    name: match.recipe.name,
    tags: match.recipe.tags,
    ingredientNames: match.recipe.ingredients.map((i) => i.name),
    requiredTotal: match.requiredTotal,
    requiredAvailable: match.requiredAvailable,
    requiredMissing: match.requiredMissing,
    matchPercent: match.matchPercent,
    missingIngredientsOnGroceryList: missingOnList,
    missingIngredientsNotOnGroceryList: missingNotOnList,
  }
}

/**
 * Builds a deterministic, JSON-serializable snapshot of the current kitchen,
 * grocery list, and recipe matches — the structured data a future AI layer
 * would reason over instead of guessing. Kitchen stock and the grocery list
 * are each authoritative for their own domain; stock is never inferred from
 * grocery presence. Recipe matching is entirely delegated to
 * `rankRecipes`/`matchRecipe` (lib/recipeMatch.ts) — no second scoring system.
 */
export function buildKitchenAssistantContext(
  items: KitchenItem[],
  groceryList: GroceryItem[],
  recipes: Recipe[],
): KitchenAssistantContext {
  const stockedItems = items.filter(itemHasStock).map(toAssistantKitchenItem)
  const outOfStockItems = items.filter((item) => !itemHasStock(item)).map(toAssistantKitchenItem)
  const groceryItems = groceryList.map(toAssistantGroceryItem)

  const ranked = rankRecipes(recipes, items)
  const summaries = ranked.map((match) => toAssistantRecipeSummary(match, groceryList))

  const readyToMake = summaries.filter((s) => s.requiredMissing === 0)
  const nearlyReady = summaries.filter((s) => s.requiredMissing >= 1 && s.requiredMissing <= 2)
  const otherMatches = summaries.filter((s) => s.requiredMissing > 2)

  return {
    kitchen: {
      stockedItems,
      outOfStockItems,
      itemCount: items.length,
    },
    grocery: {
      items: groceryItems,
      itemCount: groceryList.length,
    },
    recipes: {
      readyToMake,
      nearlyReady,
      otherMatches,
    },
    summary: {
      readyRecipeCount: readyToMake.length,
      nearlyReadyRecipeCount: nearlyReady.length,
      stockedIngredientCount: stockedItems.length,
      groceryItemCount: groceryList.length,
    },
  }
}
