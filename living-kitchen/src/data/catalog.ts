import type { KitchenItem, Location, StapleLevel, StockType } from './types'

export interface CatalogEntry {
  id: string
  name: string
  emoji: string
  category: string
  location: Location
  stockType: StockType
  /** optional estimated price, carried through to the kitchen item */
  estPrice?: number
  /** true for entries the user created rather than the built-in catalog */
  custom?: boolean
  /** Supabase `custom_ingredients.id` once this entry has been synced (see kitchen_items' `remoteId`). */
  remoteId?: string
  /**
   * Alternate names/synonyms that should resolve to this same canonical
   * entry (e.g. "scallion" for Green Onion) — never a reason to create a
   * second catalog row. Matched the same way as `name` (case-insensitive,
   * punctuation/plural-tolerant); a search result always displays the
   * canonical `name`, never the alias text.
   */
  aliases?: string[]
}

export const catalogCategories = [
  { key: 'Meat', icon: '🥩' },
  { key: 'Produce', icon: '🥕' },
  { key: 'Dairy', icon: '🥛' },
  { key: 'Pantry', icon: '🥫' },
  { key: 'Frozen', icon: '🧊' },
  { key: 'Herbs', icon: '🌿' },
  { key: 'Seasonings', icon: '🧂' },
]

/** Categories offered when creating a custom ingredient. */
export const CUSTOM_CATEGORIES = catalogCategories.map((c) => c.key)

/** Storage locations offered when creating a custom ingredient. */
export const CUSTOM_LOCATIONS: { key: Location; label: string; icon: string }[] = [
  { key: 'fridge', label: 'Fridge', icon: '🧊' },
  { key: 'freezer', label: 'Freezer', icon: '❄️' },
  { key: 'pantry', label: 'Pantry', icon: '🥫' },
  { key: 'herbs', label: 'Herbs', icon: '🌿' },
]

export const STOCK_TYPE_OPTIONS: { key: StockType; label: string; hint: string }[] = [
  { key: 'countable', label: 'Count', hint: 'eggs, potatoes, apples' },
  { key: 'divisible', label: 'Fraction / portion', hint: 'an onion, a bunch of herbs' },
  { key: 'container', label: 'Container / fill level', hint: 'milk, broth, oil' },
  { key: 'staple', label: 'General level', hint: 'flour, sugar, spices' },
]

/** Fallback icon for a category when an ingredient has no better emoji. */
export function categoryIcon(category: string): string {
  return catalogCategories.find((c) => c.key === category)?.icon ?? '🥫'
}

const CATEGORY_DEFAULT_LOCATION: Record<string, Location> = {
  Meat: 'fridge',
  Produce: 'fridge',
  Dairy: 'fridge',
  Pantry: 'pantry',
  Frozen: 'freezer',
  Herbs: 'herbs',
  Seasonings: 'pantry',
}

const CATEGORY_DEFAULT_STOCK_TYPE: Record<string, StockType> = {
  Meat: 'container',
  Produce: 'countable',
  Dairy: 'container',
  Pantry: 'staple',
  Frozen: 'container',
  Herbs: 'divisible',
  Seasonings: 'staple',
}

export function defaultLocationForCategory(category: string): Location {
  return CATEGORY_DEFAULT_LOCATION[category] ?? 'pantry'
}

export function defaultStockTypeForCategory(category: string): StockType {
  return CATEGORY_DEFAULT_STOCK_TYPE[category] ?? 'staple'
}

/**
 * Best-effort emoji for a free-typed ingredient name. Falls back to the
 * category icon when nothing obvious matches — never the generic cart.
 */
const NAME_EMOJI: [RegExp, string][] = [
  [/lettuce|cabbage|kale|spinach|greens|chard|arugula/, '🥬'],
  [/broccoli|asparagus/, '🥦'],
  [/carrot/, '🥕'],
  [/corn/, '🌽'],
  [/cucumber|pickle/, '🥒'],
  [/eggplant|aubergine/, '🍆'],
  [/potato/, '🥔'],
  [/onion|shallot|leek/, '🧅'],
  [/garlic/, '🧄'],
  [/mushroom/, '🍄'],
  [/bell pepper|capsicum/, '🫑'],
  [/chili|chile|jalapeno|jalapeño|hot pepper/, '🌶️'],
  [/tomato/, '🍅'],
  [/avocado/, '🥑'],
  [/apple/, '🍎'],
  [/banana/, '🍌'],
  [/grape/, '🍇'],
  [/strawberr/, '🍓'],
  [/blueberr|raspberr|blackberr|cranberr/, '🫐'],
  [/lemon/, '🍋'],
  [/lime|honeydew|cantaloupe|melon/, '🍈'],
  [/orange|clementine|mandarin|tangerine/, '🍊'],
  [/peach|nectarine|apricot/, '🍑'],
  [/pear/, '🍐'],
  [/cherry|cherries/, '🍒'],
  [/mango/, '🥭'],
  [/pineapple/, '🍍'],
  [/watermelon/, '🍉'],
  [/kiwi/, '🥝'],
  [/coconut/, '🥥'],
  [/chicken|poultry/, '🍗'],
  [/beef|steak|brisket/, '🥩'],
  [/bacon/, '🥓'],
  [/pork|ham|sausage/, '🥩'],
  [/salmon|tuna|cod|tilapia|halibut|trout|fish/, '🐟'],
  [/shrimp|prawn/, '🍤'],
  [/crab/, '🦀'],
  [/lobster|crayfish/, '🦞'],
  [/squid|calamari|octopus/, '🦑'],
  [/oyster|clam|mussel|scallop/, '🦪'],
  [/turkey/, '🦃'],
  [/egg/, '🥚'],
  [/ice cream|gelato|sorbet/, '🍦'],
  [/cream cheese/, '🧈'],
  [/cheese/, '🧀'],
  [/milk|cream|half.and.half/, '🥛'],
  [/butter|margarine/, '🧈'],
  [/yogurt|yoghurt/, '🥣'],
  [/baguette|french bread/, '🥖'],
  [/croissant/, '🥐'],
  [/bagel/, '🥯'],
  [/bread|toast|bun|roll/, '🍞'],
  [/pretzel/, '🥨'],
  [/pancake/, '🥞'],
  [/waffle/, '🧇'],
  [/rice/, '🍚'],
  [/pasta|spaghetti|noodle|macaroni|penne|linguine/, '🍝'],
  [/ramen/, '🍜'],
  [/salt/, '🧂'],
  [/honey/, '🍯'],
  [/olive|olive oil/, '🫒'],
  [/oil|vinegar/, '🫗'],
  [/sugar/, '🍬'],
  [/flour|wheat|oat|barley|grain|cereal/, '🌾'],
  [/coffee|espresso/, '☕'],
  [/tea/, '🍵'],
  [/wine/, '🍷'],
  [/beer|ale|lager/, '🍺'],
  [/juice/, '🧃'],
  [/soda|cola|pop|sparkling/, '🥤'],
  [/water/, '💧'],
  [/peanut|almond|cashew|walnut|pecan|pistachio|nut\b/, '🥜'],
  [/bean|lentil|chickpea|garbanzo/, '🫘'],
  [/tofu|tempeh/, '🧊'],
  [/salad/, '🥗'],
  [/basil|parsley|cilantro|coriander|mint|thyme|rosemary|oregano|sage|dill|chive|herb/, '🌿'],
  [/ginger/, '🫚'],
  [/pea\b|peas\b|edamame/, '🟢'],
  [/popcorn/, '🍿'],
  [/cookie|biscuit/, '🍪'],
  [/chocolate|cocoa/, '🍫'],
  [/cake/, '🍰'],
  [/pie/, '🥧'],
  [/donut|doughnut/, '🍩'],
  [/candy|sweets/, '🍬'],
  [/jam|jelly|preserve/, '🍓'],
  [/pumpkin|squash|gourd/, '🎃'],
]

export function guessEmoji(name: string, category: string): string {
  const n = name.trim().toLowerCase()
  for (const [re, emoji] of NAME_EMOJI) {
    if (re.test(n)) return emoji
  }
  return categoryIcon(category)
}

const CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/black pepper|white pepper|peppercorn|paprika|cumin|cinnamon|nutmeg|turmeric|curry powder|chili powder|cayenne|oregano|basil leaf|bay leaf|vanilla|spice|seasoning|salt\b/, 'Seasonings'],
  [/basil|parsley|cilantro|coriander|\bmint\b|thyme|rosemary|\bsage\b|\bdill\b|chive|tarragon|scallion/, 'Herbs'],
  [/chicken|poultry|\bbeef\b|steak|brisket|\bpork\b|\bham\b|bacon|sausage|turkey|\blamb\b|ground meat|salmon|tuna|\bcod\b|tilapia|halibut|trout|\bfish\b|shrimp|prawn|\bcrab\b|lobster|scallop|\bmeat\b|tofu/, 'Meat'],
  [/\bmilk\b|\bcream\b|cheese|butter|margarine|yogurt|yoghurt|\beggs?\b/, 'Dairy'],
  [/frozen|ice cream|popsicle/, 'Frozen'],
  [/apple|banana|berry|berries|grape|orange|clementine|mandarin|\blemon\b|\blime\b|melon|peach|nectarine|apricot|\bpear\b|\bplum\b|mango|pineapple|\bkiwi\b|watermelon|lettuce|spinach|\bkale\b|arugula|chard|carrot|onion|shallot|\bleek\b|garlic|potato|tomato|bell pepper|jalapeno|cucumber|zucchini|squash|broccoli|cauliflower|cabbage|celery|mushroom|avocado|asparagus|\bcorn\b|\bpeas?\b|green bean|brussels|radish|beet|\byam\b|eggplant|okra|ginger|herb|fruit|vegetable|produce/, 'Produce'],
  [/flour|sugar|\brice\b|pasta|noodle|spaghetti|bread|\bbun\b|tortilla|\boil\b|olive oil|vinegar|\bsauce\b|ketchup|mustard|mayo|\bbeans?\b|lentil|chickpea|garbanzo|cereal|\boat|granola|broth|stock|\bcanned\b|\bcan of\b|\bjar\b|honey|syrup|jam|jelly|\bnut\b|peanut|almond|cashew|walnut|pecan|coffee|\btea\b|cocoa|chocolate|cracker|chip|baking/, 'Pantry'],
]

/** Best-effort category bucket for a free-typed name — never a generic "Other". */
export function guessCategory(name: string): string {
  const n = name.trim().toLowerCase()
  for (const [re, cat] of CATEGORY_KEYWORDS) {
    if (re.test(n)) return cat
  }
  return 'Pantry'
}

// ---------------------------------------------------------------------------
// Name normalization + alias-aware matching
//
// Shared by `findEntryByName` (single best match — used by the grocery list's
// free-text add) and `searchCatalog` (ranked list — used by Add Food). Both
// compare against an entry's canonical `name` *and* its `aliases`, so a
// synonym like "scallion" or "purple onion" resolves to the one canonical
// entry instead of prompting the user to create a duplicate.
// ---------------------------------------------------------------------------

/** Foods that genuinely end in "s" but aren't plural — never strip these. */
const SINGULARIZE_EXCEPTIONS = new Set(['hummus', 'asparagus', 'citrus', 'couscous', 'molasses'])

/** Lowercase, trim, collapse whitespace, drop basic punctuation. */
function normalizeText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.,!?'"]/g, '')
    .replace(/\s+/g, ' ')
}

/**
 * Conservative singularization — only the handful of safe English plural
 * patterns, never a generic stemmer. Used only to *also* try a singular
 * variant when matching; the original form is always tried too, so this
 * can only add matches, never remove the exact/legitimate ones.
 */
function singularize(s: string): string {
  if (SINGULARIZE_EXCEPTIONS.has(s) || s.length <= 3) return s
  if (s.endsWith('ies')) return s.slice(0, -3) + 'y'
  if (/(ches|shes|xes|sses|oes)$/.test(s)) return s.slice(0, -2)
  if (s.endsWith('s') && !s.endsWith('ss')) return s.slice(0, -1)
  return s
}

/** Every normalized form worth comparing for a given typed/stored name. */
function nameVariants(s: string): string[] {
  const norm = normalizeText(s)
  const singular = singularize(norm)
  return singular === norm ? [norm] : [norm, singular]
}

type MatchRank = 0 | 1 | 2 | 3
// 0 = exact canonical name, 1 = exact alias, 2 = partial name, 3 = partial alias

interface RankedMatch {
  rank: MatchRank
  /** Set only when the match came through an alias, not the canonical name. */
  matchedAlias?: string
}

function rankEntry(rawQuery: string, queryVariants: string[], entry: CatalogEntry): RankedMatch | null {
  // Exact tiers compare whole normalized strings (array membership), so the
  // singularized query variant is safe here regardless of its length — it
  // can only match a name/alias that is itself that exact word.
  const nameVs = nameVariants(entry.name)
  if (queryVariants.some((q) => nameVs.includes(q))) return { rank: 0 }

  for (const alias of entry.aliases ?? []) {
    if (queryVariants.some((q) => nameVariants(alias).includes(q))) {
      return { rank: 1, matchedAlias: alias }
    }
  }

  // Partial tiers use substring containment, which a short singularized
  // fragment (e.g. "eggs" -> "egg") can match *inside* an unrelated word
  // (e.g. "veggies") purely by coincidence. Only the untouched raw query is
  // used here, and only once it's long enough for a substring hit to be
  // meaningful — the exact tiers above already cover short/plural words
  // safely.
  if (rawQuery.length <= 3) return null

  const normName = normalizeText(entry.name)
  if (normName.includes(rawQuery) || rawQuery.includes(normName)) {
    return { rank: 2 }
  }

  for (const alias of entry.aliases ?? []) {
    const normAlias = normalizeText(alias)
    if (normAlias.includes(rawQuery) || rawQuery.includes(normAlias)) {
      return { rank: 3, matchedAlias: alias }
    }
  }

  return null
}

export interface CatalogSearchResult {
  entry: CatalogEntry
  /** Present when the query matched an alias rather than the canonical name — e.g. "also called purple onion". */
  matchedAlias?: string
}

/**
 * Ranked, deduplicated search across the user's custom ingredients and the
 * built-in catalog. An entry appears at most once, at its *best* match rank
 * (exact canonical name > exact alias > partial name > partial alias), so a
 * canonical name always outranks an alias hit on the same or another entry.
 * An empty query returns everything, unranked, matching the prior "browse"
 * behavior when no search text has been typed.
 */
export function searchCatalog(query: string, customCatalog: CatalogEntry[] = []): CatalogSearchResult[] {
  const q = normalizeText(query)
  const pool = [...customCatalog, ...catalog]
  if (!q) return pool.map((entry) => ({ entry }))

  const queryVariants = nameVariants(q)
  const scored: { entry: CatalogEntry; match: RankedMatch }[] = []
  for (const entry of pool) {
    const match = rankEntry(q, queryVariants, entry)
    if (match) scored.push({ entry, match })
  }
  scored.sort((a, b) => a.match.rank - b.match.rank)
  return scored.map(({ entry, match }) => ({ entry, matchedAlias: match.matchedAlias }))
}

/**
 * Single best match against custom entries first (never silently overridden
 * by a same-named built-in ingredient), then the built-in catalog.
 */
export function findEntryByName(
  name: string,
  customCatalog: CatalogEntry[] = [],
): CatalogEntry | undefined {
  const q = normalizeText(name)
  if (!q) return undefined
  const queryVariants = nameVariants(q)

  const bestIn = (pool: CatalogEntry[]): CatalogEntry | undefined => {
    let best: { entry: CatalogEntry; match: RankedMatch } | undefined
    for (const entry of pool) {
      const match = rankEntry(q, queryVariants, entry)
      if (match && (!best || match.rank < best.match.rank)) best = { entry, match }
    }
    return best?.entry
  }

  return bestIn(customCatalog) ?? bestIn(catalog)
}

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface CustomIngredientDraft {
  name: string
  category: string
  location: Location
  stockType: StockType
  emoji?: string
  estPrice?: number
}

/** Build a catalog entry for a user-created ingredient. */
export function makeCustomCatalogEntry(draft: CustomIngredientDraft): CatalogEntry {
  const name = draft.name.trim()
  return {
    id: `custom-${slugify(name) || Date.now().toString(36)}`,
    name,
    emoji: draft.emoji?.trim() || guessEmoji(name, draft.category),
    category: draft.category,
    location: draft.location,
    stockType: draft.stockType,
    estPrice: draft.estPrice,
    custom: true,
  }
}

export const catalog: CatalogEntry[] = [
  // --- Produce -------------------------------------------------------------
  { id: 'russet-potato', name: 'Russet Potato', emoji: '🥔', category: 'Produce', location: 'pantry', stockType: 'countable' },
  { id: 'sweet-potato', name: 'Sweet Potato', emoji: '🍠', category: 'Produce', location: 'pantry', stockType: 'countable' },
  { id: 'yukon-potato', name: 'Yukon Gold Potato', emoji: '🥔', category: 'Produce', location: 'pantry', stockType: 'countable' },
  // Generic "Potatoes" — the id the seed kitchen/recipes already reference.
  { id: 'potatoes', name: 'Potatoes', emoji: '🥔', category: 'Produce', location: 'pantry', stockType: 'countable' },
  { id: 'tomato', name: 'Tomato', emoji: '🍅', category: 'Produce', location: 'fridge', stockType: 'countable', aliases: ['tomatoes'] },
  { id: 'zucchini', name: 'Zucchini', emoji: '🥒', category: 'Produce', location: 'fridge', stockType: 'countable', aliases: ['courgette', 'courgettes'] },
  { id: 'cucumber', name: 'Cucumber', emoji: '🥒', category: 'Produce', location: 'fridge', stockType: 'countable' },
  { id: 'bell-pepper', name: 'Bell Pepper', emoji: '🫑', category: 'Produce', location: 'fridge', stockType: 'countable', aliases: ['capsicum', 'capsicums', 'sweet pepper', 'sweet peppers'] },
  { id: 'garlic', name: 'Garlic', emoji: '🧄', category: 'Produce', location: 'pantry', stockType: 'staple', aliases: ['garlic clove', 'garlic cloves', 'clove of garlic'] },
  { id: 'ginger', name: 'Ginger', emoji: '🫚', category: 'Produce', location: 'fridge', stockType: 'staple', aliases: ['ginger root', 'fresh ginger'] },
  { id: 'yellow-onion', name: 'Yellow Onion', emoji: '🧅', category: 'Produce', location: 'pantry', stockType: 'divisible', aliases: ['white onion', 'white onions', 'yellow onions', 'brown onion', 'brown onions'] },
  // Canonical id/name kept exactly as the seed kitchen/recipes already use.
  { id: 'red-onion', name: 'Red onion', emoji: '🧅', category: 'Produce', location: 'fridge', stockType: 'divisible', aliases: ['purple onion', 'purple onions', 'red onions'] },
  { id: 'green-onion', name: 'Green Onion', emoji: '🌱', category: 'Produce', location: 'fridge', stockType: 'divisible', aliases: ['scallion', 'scallions', 'spring onion', 'spring onions'] },
  { id: 'shallot', name: 'Shallot', emoji: '🧅', category: 'Produce', location: 'pantry', stockType: 'divisible', aliases: ['shallots'] },
  { id: 'avocado', name: 'Avocado', emoji: '🥑', category: 'Produce', location: 'fridge', stockType: 'countable' },
  { id: 'lime', name: 'Lime', emoji: '🍈', category: 'Produce', location: 'fridge', stockType: 'countable' },
  { id: 'lemon', name: 'Lemon', emoji: '🍋', category: 'Produce', location: 'fridge', stockType: 'countable' },
  { id: 'carrots', name: 'Carrots', emoji: '🥕', category: 'Produce', location: 'fridge', stockType: 'countable', aliases: ['carrot'] },
  { id: 'celery', name: 'Celery', emoji: '🥬', category: 'Produce', location: 'fridge', stockType: 'divisible' },
  { id: 'broccoli', name: 'Broccoli', emoji: '🥦', category: 'Produce', location: 'fridge', stockType: 'divisible' },
  { id: 'cauliflower', name: 'Cauliflower', emoji: '🥦', category: 'Produce', location: 'fridge', stockType: 'divisible' },
  { id: 'cabbage', name: 'Cabbage', emoji: '🥬', category: 'Produce', location: 'fridge', stockType: 'divisible' },
  { id: 'lettuce', name: 'Lettuce', emoji: '🥬', category: 'Produce', location: 'fridge', stockType: 'divisible' },
  { id: 'kale', name: 'Kale', emoji: '🥬', category: 'Produce', location: 'fridge', stockType: 'divisible' },
  { id: 'spinach', name: 'Spinach', emoji: '🥬', category: 'Produce', location: 'fridge', stockType: 'divisible' },
  { id: 'mushrooms', name: 'Mushrooms', emoji: '🍄', category: 'Produce', location: 'fridge', stockType: 'divisible', aliases: ['mushroom'] },
  { id: 'corn', name: 'Corn', emoji: '🌽', category: 'Produce', location: 'freezer', stockType: 'countable', aliases: ['corn on the cob'] },
  { id: 'apple', name: 'Apple', emoji: '🍎', category: 'Produce', location: 'fridge', stockType: 'countable', aliases: ['apples'] },
  { id: 'banana', name: 'Banana', emoji: '🍌', category: 'Produce', location: 'pantry', stockType: 'countable', aliases: ['bananas'] },
  { id: 'orange', name: 'Orange', emoji: '🍊', category: 'Produce', location: 'fridge', stockType: 'countable', aliases: ['oranges'] },
  { id: 'grapes', name: 'Grapes', emoji: '🍇', category: 'Produce', location: 'fridge', stockType: 'divisible' },
  { id: 'strawberries', name: 'Strawberries', emoji: '🍓', category: 'Produce', location: 'fridge', stockType: 'divisible', aliases: ['strawberry'] },
  { id: 'blueberries', name: 'Blueberries', emoji: '🫐', category: 'Produce', location: 'fridge', stockType: 'divisible', aliases: ['blueberry'] },

  // --- Meat / protein --------------------------------------------------------
  { id: 'chicken-breast', name: 'Chicken breast', emoji: '🍗', category: 'Meat', location: 'freezer', stockType: 'countable', aliases: ['chicken breasts'] },
  { id: 'chicken-thighs', name: 'Chicken Thighs', emoji: '🍗', category: 'Meat', location: 'freezer', stockType: 'countable', aliases: ['chicken thigh'] },
  { id: 'ground-beef', name: 'Ground Beef', emoji: '🥩', category: 'Meat', location: 'fridge', stockType: 'container', aliases: ['minced beef', 'beef mince', 'hamburger meat'] },
  { id: 'ground-turkey', name: 'Ground Turkey', emoji: '🦃', category: 'Meat', location: 'fridge', stockType: 'container', aliases: ['minced turkey', 'turkey mince'] },
  { id: 'pork-chops', name: 'Pork Chops', emoji: '🥩', category: 'Meat', location: 'freezer', stockType: 'countable', aliases: ['pork chop'] },
  { id: 'bacon', name: 'Bacon', emoji: '🥓', category: 'Meat', location: 'fridge', stockType: 'container' },
  { id: 'sausage', name: 'Sausage', emoji: '🌭', category: 'Meat', location: 'fridge', stockType: 'countable', aliases: ['sausages'] },
  { id: 'deli-ham', name: 'Deli Ham', emoji: '🥓', category: 'Meat', location: 'fridge', stockType: 'staple', aliases: ['sliced ham', 'lunch meat ham'] },
  { id: 'salmon', name: 'Salmon', emoji: '🐟', category: 'Meat', location: 'fridge', stockType: 'countable' },
  { id: 'shrimp', name: 'Shrimp', emoji: '🍤', category: 'Meat', location: 'freezer', stockType: 'container', aliases: ['prawns', 'prawn'] },
  { id: 'tofu', name: 'Tofu', emoji: '🧊', category: 'Meat', location: 'fridge', stockType: 'countable' },

  // --- Dairy -------------------------------------------------------------
  { id: 'milk', name: 'Milk', emoji: '🥛', category: 'Dairy', location: 'fridge', stockType: 'container' },
  { id: 'butter', name: 'Butter', emoji: '🧈', category: 'Dairy', location: 'fridge', stockType: 'staple' },
  { id: 'eggs', name: 'Eggs', emoji: '🥚', category: 'Dairy', location: 'fridge', stockType: 'countable', aliases: ['egg'] },
  { id: 'parmesan', name: 'Parmesan', emoji: '🧀', category: 'Dairy', location: 'fridge', stockType: 'staple', aliases: ['parmesan cheese', 'parmigiano'] },
  { id: 'mozzarella', name: 'Mozzarella', emoji: '🧀', category: 'Dairy', location: 'fridge', stockType: 'staple', aliases: ['mozzarella cheese'] },
  { id: 'greek-yogurt', name: 'Greek Yogurt', emoji: '🥣', category: 'Dairy', location: 'fridge', stockType: 'container', aliases: ['greek yoghurt'] },
  { id: 'yogurt', name: 'Yogurt', emoji: '🥣', category: 'Dairy', location: 'fridge', stockType: 'container', aliases: ['yoghurt', 'plain yogurt'] },
  { id: 'cheddar', name: 'Cheddar Cheese', emoji: '🧀', category: 'Dairy', location: 'fridge', stockType: 'staple', aliases: ['cheddar'] },
  { id: 'cream-cheese', name: 'Cream Cheese', emoji: '🧈', category: 'Dairy', location: 'fridge', stockType: 'staple' },
  { id: 'sour-cream', name: 'Sour Cream', emoji: '🥛', category: 'Dairy', location: 'fridge', stockType: 'container' },
  { id: 'heavy-cream', name: 'Heavy Cream', emoji: '🥛', category: 'Dairy', location: 'fridge', stockType: 'container', aliases: ['heavy whipping cream', 'double cream'] },

  // --- Grains, pasta & bread (existing "Pantry" category) -------------------
  { id: 'rice', name: 'Rice', emoji: '🍚', category: 'Pantry', location: 'pantry', stockType: 'staple', aliases: ['white rice'] },
  { id: 'pasta', name: 'Pasta', emoji: '🍝', category: 'Pantry', location: 'pantry', stockType: 'staple', aliases: ['spaghetti', 'penne', 'macaroni'] },
  { id: 'orzo', name: 'Orzo', emoji: '🍝', category: 'Pantry', location: 'pantry', stockType: 'staple' },
  { id: 'quinoa', name: 'Quinoa', emoji: '🌾', category: 'Pantry', location: 'pantry', stockType: 'staple' },
  { id: 'oats', name: 'Oats', emoji: '🌾', category: 'Pantry', location: 'pantry', stockType: 'staple', aliases: ['rolled oats', 'oatmeal'] },
  { id: 'bread', name: 'Bread', emoji: '🍞', category: 'Pantry', location: 'pantry', stockType: 'countable', aliases: ['loaf of bread'] },
  { id: 'tortillas', name: 'Tortillas', emoji: '🫓', category: 'Pantry', location: 'pantry', stockType: 'countable', aliases: ['tortilla'] },

  // --- Canned goods (existing "Pantry" category) -----------------------------
  { id: 'canned-tomatoes', name: 'Canned Tomatoes', emoji: '🥫', category: 'Pantry', location: 'pantry', stockType: 'countable', aliases: ['crushed tomatoes', 'diced tomatoes'] },
  { id: 'black-beans', name: 'Black Beans', emoji: '🫘', category: 'Pantry', location: 'pantry', stockType: 'countable' },
  { id: 'kidney-beans', name: 'Kidney Beans', emoji: '🫘', category: 'Pantry', location: 'pantry', stockType: 'countable' },
  { id: 'chickpeas', name: 'Chickpeas', emoji: '🫘', category: 'Pantry', location: 'pantry', stockType: 'countable', aliases: ['garbanzo beans', 'garbanzo bean', 'garbanzos'] },
  { id: 'canned-corn', name: 'Canned Corn', emoji: '🌽', category: 'Pantry', location: 'pantry', stockType: 'countable' },
  { id: 'canned-tuna', name: 'Canned Tuna', emoji: '🐟', category: 'Pantry', location: 'pantry', stockType: 'countable', aliases: ['tuna', 'tuna can'] },
  { id: 'broth', name: 'Vegetable broth', emoji: '🥫', category: 'Pantry', location: 'pantry', stockType: 'container', aliases: ['vegetable stock'] },
  { id: 'chicken-broth', name: 'Chicken Broth', emoji: '🥫', category: 'Pantry', location: 'pantry', stockType: 'container', aliases: ['chicken stock'] },

  // --- Baking (existing "Pantry" category) -----------------------------------
  { id: 'flour', name: 'Flour', emoji: '🌾', category: 'Pantry', location: 'pantry', stockType: 'staple', aliases: ['all purpose flour', 'all-purpose flour'] },
  { id: 'sugar', name: 'Sugar', emoji: '🍬', category: 'Pantry', location: 'pantry', stockType: 'staple', aliases: ['white sugar', 'granulated sugar'] },
  { id: 'brown-sugar', name: 'Brown Sugar', emoji: '🍬', category: 'Pantry', location: 'pantry', stockType: 'staple' },
  { id: 'baking-powder', name: 'Baking Powder', emoji: '🥄', category: 'Pantry', location: 'pantry', stockType: 'staple' },
  { id: 'baking-soda', name: 'Baking Soda', emoji: '🥄', category: 'Pantry', location: 'pantry', stockType: 'staple' },
  { id: 'vanilla-extract', name: 'Vanilla Extract', emoji: '🍶', category: 'Pantry', location: 'pantry', stockType: 'container', aliases: ['vanilla'] },
  { id: 'chocolate-chips', name: 'Chocolate Chips', emoji: '🍫', category: 'Pantry', location: 'pantry', stockType: 'staple' },
  { id: 'honey', name: 'Honey', emoji: '🍯', category: 'Pantry', location: 'pantry', stockType: 'container' },

  // --- Pantry staples & condiments ------------------------------------------
  { id: 'olive-oil', name: 'Olive oil', emoji: '🫒', category: 'Pantry', location: 'pantry', stockType: 'staple' },
  { id: 'vegetable-oil', name: 'Vegetable Oil', emoji: '🫗', category: 'Pantry', location: 'pantry', stockType: 'container', aliases: ['cooking oil', 'canola oil'] },
  { id: 'vinegar', name: 'Vinegar', emoji: '🫗', category: 'Pantry', location: 'pantry', stockType: 'container', aliases: ['white vinegar'] },
  { id: 'soy-sauce', name: 'Soy Sauce', emoji: '🍶', category: 'Seasonings', location: 'pantry', stockType: 'container' },
  { id: 'ketchup', name: 'Ketchup', emoji: '🍅', category: 'Pantry', location: 'pantry', stockType: 'container', aliases: ['catsup'] },
  { id: 'mustard', name: 'Mustard', emoji: '🌭', category: 'Pantry', location: 'pantry', stockType: 'container' },
  { id: 'mayonnaise', name: 'Mayonnaise', emoji: '🥪', category: 'Pantry', location: 'pantry', stockType: 'container', aliases: ['mayo'] },
  { id: 'peanut-butter', name: 'Peanut Butter', emoji: '🥜', category: 'Pantry', location: 'pantry', stockType: 'staple' },
  { id: 'jam', name: 'Jam', emoji: '🍓', category: 'Pantry', location: 'pantry', stockType: 'staple', aliases: ['jelly', 'preserves'] },
  { id: 'salt', name: 'Salt', emoji: '🧂', category: 'Pantry', location: 'pantry', stockType: 'staple' },

  // --- Frozen basics ---------------------------------------------------------
  { id: 'frozen-peas', name: 'Frozen Peas', emoji: '🟢', category: 'Frozen', location: 'freezer', stockType: 'container' },
  { id: 'frozen-corn', name: 'Frozen Corn', emoji: '🌽', category: 'Frozen', location: 'freezer', stockType: 'container' },
  { id: 'frozen-mixed-vegetables', name: 'Frozen Mixed Vegetables', emoji: '🥦', category: 'Frozen', location: 'freezer', stockType: 'container', aliases: ['frozen veggies', 'frozen vegetables'] },
  { id: 'frozen-berries', name: 'Frozen Berries', emoji: '🫐', category: 'Frozen', location: 'freezer', stockType: 'container' },
  { id: 'ice-cream', name: 'Ice Cream', emoji: '🍦', category: 'Frozen', location: 'freezer', stockType: 'container' },

  // --- Herbs (fresh) -----------------------------------------------------
  { id: 'basil', name: 'Basil', emoji: '🌿', category: 'Herbs', location: 'herbs', stockType: 'divisible' },
  { id: 'cilantro', name: 'Cilantro', emoji: '🌿', category: 'Herbs', location: 'herbs', stockType: 'divisible', aliases: ['coriander', 'coriander leaves', 'fresh coriander'] },
  { id: 'parsley', name: 'Parsley', emoji: '🌿', category: 'Herbs', location: 'herbs', stockType: 'divisible' },
  { id: 'dill', name: 'Dill', emoji: '🌿', category: 'Herbs', location: 'herbs', stockType: 'divisible' },
  { id: 'mint', name: 'Mint', emoji: '🌿', category: 'Herbs', location: 'herbs', stockType: 'divisible' },
  { id: 'rosemary', name: 'Rosemary', emoji: '🌿', category: 'Herbs', location: 'herbs', stockType: 'divisible' },
  { id: 'thyme', name: 'Thyme', emoji: '🌿', category: 'Herbs', location: 'herbs', stockType: 'divisible' },
  { id: 'chives', name: 'Chives', emoji: '🌿', category: 'Herbs', location: 'herbs', stockType: 'divisible' },

  // --- Seasonings (dried/ground) ----------------------------------------
  { id: 'black-pepper', name: 'Black Pepper', emoji: '🧂', category: 'Seasonings', location: 'pantry', stockType: 'staple' },
  { id: 'paprika', name: 'Paprika', emoji: '🧂', category: 'Seasonings', location: 'pantry', stockType: 'staple' },
  { id: 'cumin', name: 'Cumin', emoji: '🧂', category: 'Seasonings', location: 'pantry', stockType: 'staple' },
  { id: 'cinnamon', name: 'Cinnamon', emoji: '🧂', category: 'Seasonings', location: 'pantry', stockType: 'staple' },
  { id: 'garlic-powder', name: 'Garlic Powder', emoji: '🧂', category: 'Seasonings', location: 'pantry', stockType: 'staple' },
  { id: 'onion-powder', name: 'Onion Powder', emoji: '🧂', category: 'Seasonings', location: 'pantry', stockType: 'staple' },
  { id: 'chili-powder', name: 'Chili Powder', emoji: '🧂', category: 'Seasonings', location: 'pantry', stockType: 'staple' },
  { id: 'dried-oregano', name: 'Dried Oregano', emoji: '🧂', category: 'Seasonings', location: 'pantry', stockType: 'staple', aliases: ['oregano'] },
]

export interface StartingAmount {
  count?: number
  fraction?: number
  fill?: number
  level?: StapleLevel
}

export function toKitchenItem(entry: CatalogEntry, start?: StartingAmount): KitchenItem {
  const base: KitchenItem = {
    id: entry.id,
    name: entry.name,
    emoji: entry.emoji,
    location: entry.location,
    stockType: entry.stockType,
    category: entry.category,
    daysSincePurchase: 0,
  }
  if (entry.stockType === 'countable') base.count = start?.count ?? 1
  if (entry.stockType === 'divisible') base.fraction = start?.fraction ?? 1
  if (entry.stockType === 'container') base.fill = start?.fill ?? 1
  if (entry.stockType === 'staple') base.level = start?.level ?? 'plenty'
  if (entry.estPrice != null) base.estPrice = entry.estPrice
  if (entry.custom) base.custom = true
  return base
}
