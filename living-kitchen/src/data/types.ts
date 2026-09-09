export type StockType = 'countable' | 'divisible' | 'container' | 'staple'

export type Location = 'fridge' | 'freezer' | 'pantry' | 'herbs'

export type StapleLevel = 'plenty' | 'some' | 'low' | 'out'

export interface KitchenItem {
  id: string
  name: string
  emoji: string
  location: Location
  stockType: StockType
  category: string
  /** countable: whole units, e.g. 4 eggs */
  count?: number
  /**
   * divisible produce: total quantity as a whole number plus an optional
   * quarter/half/three-quarter remainder, e.g. 1.5 = "1 1/2", 2.75 = "2 3/4".
   * Stored as a single decimal — see wholeOf/fracPartOf in lib/kitchen.ts.
   */
  fraction?: number
  /** container: 0..1 fill level, e.g. milk carton */
  fill?: number
  /** staple: coarse level */
  level?: StapleLevel
  /** 0..1 portion of the item that is reserved / held back */
  reserved?: number
  reservedFor?: string
  daysSincePurchase?: number
  /**
   * ISO timestamp of the last explicit observation of this item's stock —
   * stamped immediately on any local stock write (add, restock, adjust,
   * reserve, post-cook confirm) and refreshed from `kitchen_items.updated_at`
   * on sync. Read by lib/inventoryConfidence as the "last observed" signal;
   * never used to mutate stock. Absent on never-written items and older
   * persisted state.
   */
  updatedAt?: string
  /** optional estimated price the user entered when adding a custom ingredient */
  estPrice?: number
  /** true for ingredients the user created that aren't in the built-in catalog */
  custom?: boolean
  /**
   * Supabase `kitchen_items.id` once this item has been synced. The app-level
   * `id` above stays a stable slug (recipes reference ingredients by it), so
   * this is kept separately as the sync layer's key for update/delete calls.
   */
  remoteId?: string
}

/**
 * Which KitchenItem quantity field a structured recipe requirement is
 * expressed in — mirrors StockType so `requiredAmount` is always compared
 * against the matching kitchen field, never across stock types.
 */
export type RequiredUnit = 'count' | 'fraction' | 'fill' | 'level'

/**
 * The small, closed set of human cooking units Euko understands for display
 * scaling — deliberately NOT a general unit-conversion system: nothing here
 * ever converts between these units (a tbsp is never turned into a cup), and
 * this list is not meant to grow casually. 'count' covers any bare number or
 * "N of some named thing" (a piece, a clove, a can, a slice, a head) via the
 * optional `noun` below — it is NOT the same concept as KitchenItem's
 * `count` field, which is inventory's own whole-units-on-hand tracking.
 */
export type CookingUnit = 'count' | 'tsp' | 'tbsp' | 'cup' | 'oz' | 'lb'

/**
 * The structured, scalable human cooking quantity for one ingredient —
 * separate from `requiredAmount`/`requiredUnit` below (inventory's
 * abstraction) by design; see RecipeIngredient.quantity and .scalable.
 */
export interface ScalableAmount {
  /**
   * The amount at Recipe.servings, on the human cooking scale (not
   * inventory's). Optional: when this ingredient already has a compatible
   * `requiredAmount`/`requiredUnit` ('count' or 'fraction'), omit this and
   * the scaling helper reuses that number directly — never author the same
   * amount twice where one honest number already exists. Required whenever
   * no such reusable amount exists (e.g. a `cup`/`tbsp` measure, which has no
   * inventory equivalent) or when the cooking unit isn't the same as the
   * inventory unit (e.g. broth's cups vs. its fill-fraction requirement).
   */
  amount?: number
  unit: CookingUnit
  /**
   * The word following the number, when the recipe author phrased it that
   * way — "piece"/"pieces", "clove"/"cloves", "can"/"cans", "slice"/"slices",
   * "head"/"heads", "box"/"boxes". Never the ingredient's own name (that's
   * already shown separately wherever this renders) and never derived by a
   * generic pluralizer — omit for a bare number ("4", "1, sliced").
   */
  noun?: { singular: string; plural: string }
  /** Freeform, never-scaled prep text appended after the amount — "diced", "minced", "drained", "melted". */
  prep?: string
  /** A fixed package descriptor that must never scale even though the count in front of it does, e.g. "(14 oz each)" on a can. */
  fixedSuffix?: string
  /**
   * An optional, curated cooking-context hint scaled by the exact same
   * ratio as `amount`/`requiredAmount` — e.g. for a garlic clove, "about
   * this many tsp when minced." Authored once, by a human, for exactly this
   * ingredient — never a general conversion table.
   */
  cookingHint?: { amountPerUnit: number; unit: 'tsp' | 'tbsp' | 'cup'; prep?: string }
}

export interface RecipeIngredient {
  id: string
  name: string
  emoji: string
  /**
   * Human-readable display text at Recipe.servings, e.g. "2, diced" — the
   * authored fallback, always shown as-is whenever `scalable` is absent AND
   * no compatible `requiredAmount`/`requiredUnit` exists to reuse. This is
   * the deliberate, honest behavior for anything that can't or shouldn't
   * scale — "salt to taste", "a drizzle", "1 (14 oz) can" — never derived
   * from the fields below, and never itself mutated by scaling.
   */
  quantity: string
  itemId?: string
  optional?: boolean
  /**
   * The structured, scalable human cooking quantity for this ingredient —
   * see ScalableAmount. Distinct from `requiredAmount`/`requiredUnit` below:
   * this is what a person cooks with (cloves, cups, tbsp), that is what
   * Euko's approximate inventory tracks (count/fraction/fill/level). They
   * are related — both scale by the same servings ratio — but are never the
   * same number by construction, except when this is deliberately omitted
   * and the amount is reused directly from a compatible `requiredAmount`
   * (see ScalableAmount.amount).
   */
  scalable?: ScalableAmount
  /**
   * Machine-readable amount this recipe needs, alongside the display
   * `quantity`/`scalable` above. Deliberately unset for most ingredients —
   * absence means "no structured requirement," which callers must treat as
   * plain presence/absence (the pre-existing behavior), never as "needs
   * zero." Only seeded where a real comparison is possible and honest:
   *   - count:    whole units for countable items, e.g. 3 eggs -> 3
   *   - fraction: same whole+quarter decimal convention as KitchenItem.fraction
   *               for divisible items, e.g. "½ onion" -> 0.5
   *   - fill:     approximate portion (0..1) of a full container item —
   *               only when a reasonable approximation genuinely exists
   *   - level:    coarse ordinal requirement for staple items, on the same
   *               0(out)..3(plenty) scale as STAPLE_LEVEL_RANK (lib/kitchen.ts)
   *               — never a fake precise number for something like "salt to taste"
   *
   * `count` and `fraction` scale with servings (see lib/scaleRecipe.ts);
   * `fill` scales too (a doubled recipe needs double the broth); `level`
   * NEVER scales — it's a coarse readiness threshold, not a consumed
   * quantity, at any serving count.
   */
  requiredAmount?: number
  requiredUnit?: RequiredUnit
}

export interface RecipeStep {
  instruction: string
  timerMinutes?: number
}

export type Effort = 'Bare minimum' | 'Normal' | 'I want to cook'

/**
 * When during the day/menu a recipe fits. Deliberately a list, not a single
 * value — a recipe like an omelet is genuinely both breakfast and lunch, and
 * forcing one exclusive bucket would make the "What can I make?" categories
 * undercount recipes that legitimately belong in more than one. Distinct from
 * `tags` (mood/attribute filtering — "quick", "vegetarian", "cheap") — this
 * answers "when would I cook this", not "what kind of dish is it".
 */
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert' | 'side'

export interface Recipe {
  id: string
  name: string
  emoji: string
  time: number
  effortLabel: 'Easy' | 'Medium' | 'Involved'
  effort: Effort
  tags: string[]
  /** At least one entry — see MealType. Order has no meaning beyond authoring convenience. */
  mealTypes: MealType[]
  description: string
  /**
   * The base/canonical serving count every ingredient's `quantity`,
   * `scalable`, and `requiredAmount` is authored for. A cooking session's
   * `targetServings` divided by this is the scaling ratio — see
   * lib/scaleRecipe.ts. Never mutated; scaling always computes a *new*
   * value from this fixed base, it never rewrites it.
   */
  servings: number
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
}

export type Feasibility =
  | 'ready'
  | 'ready-adjusted'
  | 'almost'
  | 'one-away'
  | 'needs-shopping'

export interface Person {
  id: string
  name: string
  restrictions: string[]
  dislikes: string[]
  preferences: string[]
}

export interface GroceryItem {
  id: string
  name: string
  emoji: string
  category: string
  reason: string
  checked: boolean
  estPrice?: number
  /** Supabase `grocery_list_items.id` once this item has been synced (see kitchen_items' `remoteId`). */
  remoteId?: string
  /**
   * Canonical catalog/kitchen ingredient id, when this grocery item was added
   * from a recipe ingredient, a kitchen item, or a catalog search result —
   * lets it be recognized as "the same ingredient" regardless of display-name
   * wording (e.g. a recipe's "Tomatoes" vs the catalog's canonical "Tomato").
   * Undefined for arbitrary free-text items (e.g. "paper towels") that have
   * no catalog entry — the grocery list is not restricted to ingredients.
   * Local-only for now: `grocery_list_items` has no matching column, so this
   * does not round-trip through Supabase (see lib/grocerySync.ts).
   */
  itemId?: string
}
