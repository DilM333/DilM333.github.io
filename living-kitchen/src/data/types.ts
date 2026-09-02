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
  /** divisible produce: 0..1 (quarter/half/three-quarter/whole) */
  fraction?: number
  /** container: 0..1 fill level, e.g. milk carton */
  fill?: number
  /** staple: coarse level */
  level?: StapleLevel
  /** 0..1 portion of the item that is reserved / held back */
  reserved?: number
  reservedFor?: string
  daysSincePurchase?: number
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
}
