import type { AssistantRecipeSummary, KitchenAssistantContext } from './kitchenAssistantContext'
import { parseKitchenAssistantIntent, type KitchenAssistantIntent } from './kitchenAssistantIntent'

export interface KitchenAssistantResponse {
  message: string
  recipeIds: string[]
  intent: KitchenAssistantIntent
}

const MAX_RESULTS = 3

function summaryMentionsKeyword(summary: AssistantRecipeSummary, keyword: string): boolean {
  const kw = keyword.toLowerCase()
  if (summary.name.toLowerCase().includes(kw)) return true
  if (summary.tags.some((t) => t.toLowerCase().includes(kw))) return true
  return summary.ingredientNames.some((n) => n.toLowerCase().includes(kw))
}

/** Soft ranking boost for stated preferences. Never invents availability data. */
function scoreBoost(summary: AssistantRecipeSummary, intent: KitchenAssistantIntent): number {
  let boost = 0
  if (intent.wantsQuick && summary.tags.includes('quick')) boost += 3
  if (intent.wantsVegetarian && summary.tags.includes('vegetarian')) boost += 3
  if (intent.wantsCozy && summary.tags.includes('comforting')) boost += 3
  if (intent.wantsLight && summary.tags.includes('light')) boost += 3
  for (const keyword of intent.includeKeywords) {
    if (summaryMentionsKeyword(summary, keyword)) boost += 2
  }
  return boost
}

function joinNames(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

/** Grocery-aware description of a recipe's missing ingredients. */
function describeMissing(summary: AssistantRecipeSummary): string {
  const onList = summary.missingIngredientsOnGroceryList
  const notOnList = summary.missingIngredientsNotOnGroceryList

  if (notOnList.length === 0 && onList.length > 0) {
    return `${joinNames(onList)} — already on your grocery list`
  }
  if (onList.length === 0) {
    return joinNames(notOnList)
  }
  return `${joinNames(notOnList)} (${joinNames(onList)} ${onList.length === 1 ? 'is' : 'are'} already on your grocery list)`
}

function preferenceLabel(intent: KitchenAssistantIntent): string | undefined {
  if (intent.includeKeywords[0]) return intent.includeKeywords[0]
  if (intent.wantsVegetarian) return 'vegetarian'
  if (intent.wantsCozy) return 'cozy'
  if (intent.wantsLight) return 'light'
  if (intent.wantsQuick) return 'quick'
  return undefined
}

function composeMessage(
  intent: KitchenAssistantIntent,
  context: KitchenAssistantContext,
  picked: AssistantRecipeSummary[],
): string {
  if (context.kitchen.itemCount === 0) {
    return "Your kitchen is empty. Add some ingredients and I'll help you figure out what to make."
  }

  if (picked.length === 0) {
    return "I couldn't find a recipe that fits that — try a different request, or add more ingredients to your kitchen."
  }

  const top = picked[0]
  const label = preferenceLabel(intent)

  if (intent.wantsNoShopping) {
    const readyCount = context.summary.readyRecipeCount
    if (readyCount > 0) {
      return `You have ${readyCount} recipe${readyCount === 1 ? '' : 's'} ready to make right now. I'd start with ${top.name}.`
    }
    const nearlyCount = context.summary.nearlyReadyRecipeCount
    if (nearlyCount > 0) {
      return `Nothing is fully stocked right now, but ${nearlyCount} recipe${nearlyCount === 1 ? '' : 's'} ${nearlyCount === 1 ? 'is' : 'are'} only 1-2 ingredients away — ${top.name} needs ${describeMissing(top)}.`
    }
    return `Nothing is close to ready right now. ${top.name} is your best option, but it needs ${describeMissing(top)}.`
  }

  if (top.requiredMissing === 0) {
    return label
      ? `${top.name} is your closest ${label} option, and you already have everything for it — ready to make!`
      : `You have everything for ${top.name} — ready to make!`
  }

  const subject = label ? `${top.name} is your closest ${label} option.` : `${top.name} is your best match right now.`
  return `${subject} You have ${top.requiredAvailable} of ${top.requiredTotal} required ingredients and need ${describeMissing(top)}.`
}

/**
 * Deterministic placeholder for a future AI response. Never invents data —
 * every claim (availability, missing counts, grocery-list presence) comes
 * straight from the structured context, which itself only reuses
 * lib/recipeMatch.ts's matching (see kitchenAssistantContext.ts). A future
 * backend can receive `{ message: userMessage, context }` and this function
 * is the seam where a real AI call would eventually replace or supplement
 * the deterministic logic below, without the UI needing to change.
 */
export function getKitchenAssistantResponse(
  userMessage: string,
  context: KitchenAssistantContext,
): KitchenAssistantResponse {
  const intent = parseKitchenAssistantIntent(userMessage)

  let pool = [...context.recipes.readyToMake, ...context.recipes.nearlyReady, ...context.recipes.otherMatches]

  if (intent.excludeKeywords.length > 0) {
    pool = pool.filter((r) => !intent.excludeKeywords.some((kw) => summaryMentionsKeyword(r, kw)))
  }

  // "Without shopping" restricts to Ready to Make whenever any exist —
  // otherwise fall through to the normal ranked pool so there's still
  // something useful to suggest.
  if (intent.wantsNoShopping && context.recipes.readyToMake.length > 0) {
    pool = pool.filter((r) => r.requiredMissing === 0)
  }

  // Stable sort: recipes tying on preference boost keep the incoming
  // fewest-missing/highest-match%/name order from rankRecipes.
  const picked = [...pool]
    .map((r, index) => ({ r, index, boost: scoreBoost(r, intent) }))
    .sort((a, b) => b.boost - a.boost || a.index - b.index)
    .slice(0, MAX_RESULTS)
    .map(({ r }) => r)

  return {
    message: composeMessage(intent, context, picked),
    recipeIds: picked.map((r) => r.id),
    intent,
  }
}

/** Deterministic greeting shown before the user has asked anything. */
export function getKitchenAssistantGreeting(context: KitchenAssistantContext): string {
  if (context.kitchen.itemCount === 0) {
    return "Your kitchen is empty. Add some ingredients and I'll help you figure out what to make."
  }

  const { readyRecipeCount, nearlyReadyRecipeCount } = context.summary
  if (readyRecipeCount > 0) {
    return `You have ${readyRecipeCount} meal${readyRecipeCount === 1 ? '' : 's'} ready to make.`
  }
  if (nearlyReadyRecipeCount > 0) {
    return `Nothing is fully stocked right now, but ${nearlyReadyRecipeCount} recipe${nearlyReadyRecipeCount === 1 ? '' : 's'} ${nearlyReadyRecipeCount === 1 ? 'is' : 'are'} only 1-2 ingredients away.`
  }
  return "Nothing is close to ready yet — tell me what you're in the mood for and I'll find your best option."
}
