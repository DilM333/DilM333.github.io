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

export interface RecipeIngredient {
  id: string
  name: string
  emoji: string
  /** Human-readable display text, e.g. "2, diced" — always shown as-is, never derived from the fields below. */
  quantity: string
  itemId?: string
  optional?: boolean
  /**
   * Machine-readable amount this recipe needs, alongside the display
   * `quantity` string above. Deliberately unset for most ingredients —
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
   */
  requiredAmount?: number
  requiredUnit?: RequiredUnit
}

export interface RecipeStep {
  instruction: string
  timerMinutes?: number
}

export type Effort = 'Bare minimum' | 'Normal' | 'I want to cook'

export interface Recipe {
  id: string
  name: string
  emoji: string
  time: number
  effortLabel: 'Easy' | 'Medium' | 'Involved'
  effort: Effort
  tags: string[]
  description: string
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
}
