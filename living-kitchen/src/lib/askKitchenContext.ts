import { catalog } from '../data/catalog'
import type { GroceryItem, KitchenItem, MealType, Recipe } from '../data/types'
import { computeFeasibility, isUseSoon, itemHasStock } from './kitchen'
import { rankRecipes, type RecipeMatch } from './recipeMatch'
import { detectQuerySignals } from './askKitchenQuery'

/** A named reference to a kitchen item — never the raw quantity, never a Supabase row id. */
export interface AskKitchenItemRef {
  itemId: string
  name: string
}

export interface AskKitchenRecipeSummary {
  id: string
  name: string
  mealTypes: MealType[]
  tags: string[]
  time: number
  effortLabel: Recipe['effortLabel']
  servings: number
  /** The one and only readiness value that exists — from computeFeasibility. */
  status: ReturnType<typeof computeFeasibility>['status']
  requiredAvailable: number
  requiredTotal: number
  /** Names only. */
  missingRequired: string[]
  /** Already-resolved, catalog-approved substitutions Euko actually used to get this match. */
  substitutionsUsed: { requested: string; using: string }[]
}

export interface AskKitchenContext {
  version: 1
  kitchen: {
    itemCount: number
    hasAnyStock: boolean
  }
  useSoon: AskKitchenItemRef[]
  /** Required ingredients behind a candidate recipe whose matched item Euko has low confidence in — already phrased as "worth checking", never a raw confidence label. */
  uncertain: AskKitchenItemRef[]
  /** Item name only — never the free-text reservedFor note. */
  reserved: AskKitchenItemRef[]
  /** Deterministically pre-filtered — see selectCandidateRecipes. Never all 31 recipes. */
  candidateRecipes: AskKitchenRecipeSummary[]
  groceryItemNames: string[]
  favoriteRecipeIds: string[]
  session: { cookingRecipeId: string; targetServings?: number } | null
}

const MAX_USE_SOON = 8
const MAX_UNCERTAIN = 8
const MAX_RESERVED = 8
const MAX_GROCERY_NAMES = 15
const DEFAULT_MAX_CANDIDATES = 12
const MIN_CANDIDATES_BEFORE_BROADENING = 4

function toItemRef(item: KitchenItem): AskKitchenItemRef {
  return { itemId: item.id, name: item.name }
}

function matchesMealType(recipe: Recipe, mealTypes: MealType[]): boolean {
  return mealTypes.length === 0 || recipe.mealTypes.some((mt) => mealTypes.includes(mt))
}

function matchesTime(recipe: Recipe, wantsQuick: boolean, maxTimeMinutes?: number): boolean {
  if (maxTimeMinutes != null) return recipe.time <= maxTimeMinutes
  if (wantsQuick) return recipe.tags.includes('quick') || recipe.time <= 20
  return true
}

/**
 * Deterministic, query-aware candidate selection:
 *
 *   1. Recipes matching the message's structural signals (meal type, quick/
 *      time), in Euko's existing rank order (fewest missing, then match %,
 *      then name — see lib/recipeMatch.ts's rankRecipes). This is what keeps
 *      a "something sweet" query from having dessert recipes buried under
 *      higher-ranking dinners that don't even match the meal type asked for.
 *   2. Any recipe explicitly mentioned by name, or that uses an explicitly
 *      mentioned ingredient, is always included — even if step 1's filter or
 *      the global rank would have excluded it. This is what lets "can I make
 *      anything with the chicken I have?" surface chicken recipes regardless
 *      of how they'd otherwise rank.
 *   3. If the query was narrow enough that fewer than
 *      MIN_CANDIDATES_BEFORE_BROADENING recipes were found, broaden by
 *      filling remaining slots from the full, unfiltered rank order — the
 *      model should never receive an empty candidate set just because a
 *      structural filter was too strict for tonight's actual kitchen.
 *
 * Deduplicated, capped at `max`, and order is preserved as priority (most
 * relevant first) since candidateRecipes is what the model reasons over.
 */
export function selectCandidateRecipes(
  recipes: Recipe[],
  items: KitchenItem[],
  signals: { mealTypes: MealType[]; wantsQuick: boolean; maxTimeMinutes?: number; mentionedRecipeIds: string[]; mentionedItemIds: string[] },
  extraAlwaysIncludeRecipeIds: string[] = [],
  max: number = DEFAULT_MAX_CANDIDATES,
): RecipeMatch[] {
  const ranked = rankRecipes(recipes, items)
  const picked: RecipeMatch[] = []
  const seen = new Set<string>()

  const add = (match: RecipeMatch) => {
    if (seen.has(match.recipe.id)) return
    seen.add(match.recipe.id)
    picked.push(match)
  }

  const queryFiltered = ranked.filter(
    (m) => matchesMealType(m.recipe, signals.mealTypes) && matchesTime(m.recipe, signals.wantsQuick, signals.maxTimeMinutes),
  )
  for (const m of queryFiltered) {
    if (picked.length >= max) break
    add(m)
  }

  const alwaysIncludeIds = new Set([...signals.mentionedRecipeIds, ...extraAlwaysIncludeRecipeIds])
  const mentioned = ranked.filter(
    (m) =>
      alwaysIncludeIds.has(m.recipe.id) ||
      m.recipe.ingredients.some((ing) => ing.itemId && signals.mentionedItemIds.includes(ing.itemId)),
  )
  for (const m of mentioned) {
    if (picked.length >= max) break
    add(m)
  }

  if (picked.length < MIN_CANDIDATES_BEFORE_BROADENING) {
    for (const m of ranked) {
      if (picked.length >= max) break
      add(m)
    }
  }

  return picked.slice(0, max)
}

function toRecipeSummary(match: RecipeMatch, items: KitchenItem[]): AskKitchenRecipeSummary {
  const { recipe } = match
  const { status } = computeFeasibility(recipe, items)
  const substitutionsUsed = match.ingredientMatches
    .filter((im) => im.kind === 'substitute' && im.matchedItem)
    .map((im) => ({ requested: im.ingredient.name, using: im.matchedItem!.name }))

  return {
    id: recipe.id,
    name: recipe.name,
    mealTypes: recipe.mealTypes,
    tags: recipe.tags,
    time: recipe.time,
    effortLabel: recipe.effortLabel,
    servings: recipe.servings,
    status,
    requiredAvailable: match.requiredAvailable,
    requiredTotal: match.requiredTotal,
    missingRequired: match.missingIngredients.map((i) => i.name),
    substitutionsUsed,
  }
}

/**
 * Builds the one purpose-built, capped, JSON-serializable snapshot Ask
 * Kitchen sends to the model — never raw KitchenItem/GroceryItem rows, never
 * all 31 recipes, never quantities/reservedFor/household or Supabase ids. See
 * the architecture report for the full rationale.
 *
 * `previousRecommendedRecipeIds` (from the conversation anchor, if any) are
 * always included in `candidateRecipes` alongside whatever the new message's
 * own signals select — so a follow-up like "something quicker" always has
 * fresh, current summaries for the recipes it's plausibly referring back to.
 */
export function buildAskKitchenContext(params: {
  message: string
  items: KitchenItem[]
  recipes: Recipe[]
  groceryList: GroceryItem[]
  favorites: string[]
  cookingSession: { recipeId: string; targetServings?: number } | null
  previousRecommendedRecipeIds?: string[]
  maxCandidates?: number
}): AskKitchenContext {
  const { message, items, recipes, groceryList, favorites, cookingSession, previousRecommendedRecipeIds = [], maxCandidates } = params

  const signals = detectQuerySignals(message, recipes, catalog)
  const candidateMatches = selectCandidateRecipes(
    recipes,
    items,
    signals,
    previousRecommendedRecipeIds,
    maxCandidates,
  )

  const uncertainSeen = new Set<string>()
  const uncertain: AskKitchenItemRef[] = []
  for (const match of candidateMatches) {
    for (const im of match.lowConfidenceRequired) {
      if (!im.matchedItem || uncertainSeen.has(im.matchedItem.id)) continue
      uncertainSeen.add(im.matchedItem.id)
      if (uncertain.length < MAX_UNCERTAIN) uncertain.push(toItemRef(im.matchedItem))
    }
  }

  return {
    version: 1,
    kitchen: {
      itemCount: items.length,
      hasAnyStock: items.some(itemHasStock),
    },
    useSoon: items.filter(isUseSoon).slice(0, MAX_USE_SOON).map(toItemRef),
    uncertain,
    reserved: items
      .filter((i) => (i.reserved ?? 0) > 0)
      .slice(0, MAX_RESERVED)
      .map(toItemRef),
    candidateRecipes: candidateMatches.map((m) => toRecipeSummary(m, items)),
    groceryItemNames: groceryList.slice(0, MAX_GROCERY_NAMES).map((g) => g.name),
    favoriteRecipeIds: favorites,
    session: cookingSession ? { cookingRecipeId: cookingSession.recipeId, targetServings: cookingSession.targetServings } : null,
  }
}
