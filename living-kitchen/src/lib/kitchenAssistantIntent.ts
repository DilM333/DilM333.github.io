/**
 * Deterministic, keyword-based intent recognition — NOT natural-language
 * understanding. This exists so the assistant shell behaves usefully before
 * a real AI is wired in (see lib/kitchenAssistant.ts). Every signal here is
 * a plain regex/substring check against the lowercased message; there is no
 * hidden inference.
 */
export interface KitchenAssistantIntent {
  wantsQuick: boolean
  wantsVegetarian: boolean
  wantsCozy: boolean
  wantsLight: boolean
  /** "without shopping" / "ready right now" / "use what I have", etc. */
  wantsNoShopping: boolean
  /** Ingredient/dish keywords mentioned positively, e.g. "something with chicken". */
  includeKeywords: string[]
  /** Ingredient/dish keywords mentioned negatively, e.g. "I don't want pasta". */
  excludeKeywords: string[]
  /** The original message, unmodified. */
  raw: string
}

const NO_SHOPPING_PATTERN =
  /\b(without shopping|no shopping|without going to the store|no store|don'?t want to shop|ready to make|ready right now|right now|use what i (already )?have)\b/

const QUICK_PATTERN = /\b(quick|fast|15\s?min|fifteen minutes|30\s?min)\b/
const VEGETARIAN_PATTERN = /\b(vegetarian|veggie)\b/
const COZY_PATTERN = /\b(cozy|comfort(ing)?)\b/
const LIGHT_PATTERN = /\b(light|healthy)\b/

/** Ingredient/dish keywords the response engine can match against recipe name/tags/ingredients. */
const KEYWORDS = ['chicken', 'beef', 'vegetable', 'pasta', 'soup', 'rice', 'egg', 'cheese', 'potato']

const NEGATION_WORDS = new Set(["don't", 'dont', 'no', 'not', 'avoid', 'skip', 'without', 'never'])

/** True when a negation word appears shortly before the keyword's first mention. */
function isNegatedMention(words: string[], keyword: string): boolean {
  const idx = words.findIndex((w) => w.includes(keyword))
  if (idx === -1) return false
  const windowStart = Math.max(0, idx - 3)
  return words.slice(windowStart, idx).some((w) => NEGATION_WORDS.has(w.replace(/[^\w']/g, '')))
}

export function parseKitchenAssistantIntent(message: string): KitchenAssistantIntent {
  const text = message.toLowerCase()
  const words = text.split(/\s+/)

  const includeKeywords: string[] = []
  const excludeKeywords: string[] = []
  for (const keyword of KEYWORDS) {
    if (!text.includes(keyword)) continue
    ;(isNegatedMention(words, keyword) ? excludeKeywords : includeKeywords).push(keyword)
  }

  return {
    wantsQuick: QUICK_PATTERN.test(text),
    wantsVegetarian: VEGETARIAN_PATTERN.test(text),
    wantsCozy: COZY_PATTERN.test(text),
    wantsLight: LIGHT_PATTERN.test(text),
    wantsNoShopping: NO_SHOPPING_PATTERN.test(text),
    includeKeywords,
    excludeKeywords,
    raw: message,
  }
}
