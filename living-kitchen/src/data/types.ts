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

export interface RecipeIngredient {
  id: string
  name: string
  emoji: string
  quantity: string
  itemId?: string
  optional?: boolean
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
