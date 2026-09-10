import { type CatalogEntry } from '../data/catalog'
import type { MealType, Recipe } from '../data/types'

/**
 * Obvious, structural signals Euko can read straight off a user's message —
 * deliberately NOT a natural-language-understanding engine. This exists so
 * candidate recipe selection (see askKitchenContext.ts) can be query-aware
 * for the handful of things Euko already models as real fields (meal type,
 * time), without trying to deterministically parse mood/fuzzy language
 * ("cozy but not heavy") — that stays the model's job entirely.
 */
export interface AskKitchenQuerySignals {
  /** Meal-type words found in the message, deduplicated. Empty means "no meal-type constraint stated". */
  mealTypes: MealType[]
  /** "quick"/"fast"/"quickly" — a soft signal; combined with recipe.tags/time in candidate selection, not a hard filter on its own. */
  wantsQuick: boolean
  /** Parsed from an explicit "15 min"/"20 minutes" style mention, if any. */
  maxTimeMinutes?: number
  /** Catalog ingredient ids whose canonical name or an alias appears in the message. */
  mentionedItemIds: string[]
  /** Recipe ids whose exact name appears in the message. */
  mentionedRecipeIds: string[]
}

const MEAL_TYPE_WORDS: [RegExp, MealType][] = [
  [/\bbreakfast\b/, 'breakfast'],
  [/\blunch\b/, 'lunch'],
  [/\bdinner\b/, 'dinner'],
  [/\bsnacks?\b/, 'snack'],
  // "sweet(s)" is the explicit example from the product ask ("I want
  // something sweet") — treated as a dessert signal, not a mood word,
  // because it maps directly onto the real mealTypes: ['dessert'] field.
  [/\bdesserts?\b|\bsweets?\b/, 'dessert'],
  [/\bsides?\b/, 'side'],
]

const QUICK_WORDS = /\b(quick|quickly|fast)\b/
const MINUTES_PATTERN = /(\d{1,3})\s*-?\s*min(ute)?s?\b/

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function mentionsWord(text: string, word: string): boolean {
  const trimmed = word.trim()
  if (!trimmed) return false
  return new RegExp(`\\b${escapeRegExp(trimmed.toLowerCase())}\\b`).test(text)
}

/**
 * A catalog entry's canonical name and aliases, plus each individual word
 * within them (3+ letters, so "of"/"a" etc. never count) — e.g. "Chicken
 * breast" contributes "chicken breast", "chicken", and "breast". People
 * naturally say "chicken", not "chicken breast" — checking whole multi-word
 * names only would miss the exact case the product ask names ("can I make
 * anything with the chicken I have?"). The minor cost is a generic word like
 * "onion" matching every onion variant — acceptable here since this only
 * ever *broadens* the candidate set (see selectCandidateRecipes), never
 * narrows or asserts anything as fact.
 */
function searchTermsFor(entry: CatalogEntry): string[] {
  const names = [entry.name, ...(entry.aliases ?? [])]
  const terms = new Set<string>()
  for (const name of names) {
    terms.add(name)
    for (const word of name.split(/\s+/)) {
      if (word.length > 2) terms.add(word)
    }
  }
  return [...terms]
}

/**
 * Reads meal-type words, an explicit quick/time preference, and any direct
 * mention of a real catalog ingredient or real recipe name out of `message`.
 * Pure, cheap (message length × ~90 catalog entries + recipe count), and
 * deliberately conservative — anything not an obvious structural match is
 * left for the model to reason about, never guessed at here.
 */
export function detectQuerySignals(
  message: string,
  recipes: Recipe[],
  catalogEntries: CatalogEntry[],
): AskKitchenQuerySignals {
  const text = message.toLowerCase()

  const mealTypes: MealType[] = []
  for (const [pattern, mealType] of MEAL_TYPE_WORDS) {
    if (pattern.test(text) && !mealTypes.includes(mealType)) mealTypes.push(mealType)
  }

  const wantsQuick = QUICK_WORDS.test(text)
  const minutesMatch = text.match(MINUTES_PATTERN)
  const maxTimeMinutes = minutesMatch ? parseInt(minutesMatch[1], 10) : undefined

  const mentionedItemIds: string[] = []
  for (const entry of catalogEntries) {
    if (searchTermsFor(entry).some((term) => mentionsWord(text, term))) mentionedItemIds.push(entry.id)
  }

  const mentionedRecipeIds: string[] = []
  for (const recipe of recipes) {
    if (text.includes(recipe.name.toLowerCase())) mentionedRecipeIds.push(recipe.id)
  }

  return { mealTypes, wantsQuick, maxTimeMinutes, mentionedItemIds, mentionedRecipeIds }
}
