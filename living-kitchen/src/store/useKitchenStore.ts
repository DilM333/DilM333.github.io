import { create } from 'zustand'
import { seedGroceryList, seedKitchen, seedPeople, seedRecipes } from '../data/seed'
import type { GroceryItem, KitchenItem, Person, Recipe, StapleLevel } from '../data/types'

export type AdaptChoice =
  | 'use-what-i-have'
  | 'skip'
  | 'substitute'
  | 'add-to-list'
  | 'keep-reserved'
  | 'use-anyway'

interface CookingSession {
  recipeId: string
  adaptations: Record<string, AdaptChoice>
  stepIndex: number
  actualUsage: Record<string, number>
}

interface KitchenState {
  onboarded: boolean
  people: Person[]
  items: KitchenItem[]
  recipes: Recipe[]
  favorites: string[]
  groceryList: GroceryItem[]
  cookingSession: CookingSession | null

  completeOnboarding: (people: Person[]) => void

  updateCount: (id: string, delta: number) => void
  updateFraction: (id: string, fraction: number) => void
  updateFill: (id: string, fill: number) => void
  updateLevel: (id: string, level: StapleLevel) => void
  setReserved: (id: string, reserved: number, reservedFor?: string) => void
  addKitchenItem: (item: KitchenItem) => void

  toggleFavorite: (recipeId: string) => void

  addToGroceryList: (item: Omit<GroceryItem, 'id' | 'checked'>) => void
  toggleGroceryChecked: (id: string) => void
  removeGroceryItem: (id: string) => void

  startCooking: (recipeId: string) => void
  setAdaptation: (ingredientId: string, choice: AdaptChoice) => void
  nextStep: () => void
  prevStep: () => void
  setActualUsage: (itemId: string, amount: number) => void
  finishCooking: (deductions: KitchenDeduction[]) => void
  cancelCooking: () => void
}

export interface KitchenDeduction {
  itemId: string
  newCount?: number
  newFraction?: number
  newFill?: number
  newLevel?: StapleLevel
}

export const useKitchenStore = create<KitchenState>((set) => ({
  onboarded: false,
  people: seedPeople,
  items: seedKitchen,
  recipes: seedRecipes,
  favorites: ['crispy-herb-chicken', 'veg-fried-rice', 'tuscan-chicken', 'sugar-cookies'],
  groceryList: seedGroceryList,
  cookingSession: null,

  completeOnboarding: (people) => set({ onboarded: true, people }),

  updateCount: (id, delta) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, count: Math.max(0, (i.count ?? 0) + delta) } : i,
      ),
    })),

  updateFraction: (id, fraction) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, fraction } : i)),
    })),

  updateFill: (id, fill) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, fill } : i)),
    })),

  updateLevel: (id, level) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, level } : i)),
    })),

  setReserved: (id, reserved, reservedFor) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, reserved, reservedFor: reserved > 0 ? reservedFor : undefined } : i,
      ),
    })),

  addKitchenItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.id === item.id)
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  count: (i.count ?? 0) + (item.count ?? 1),
                  fraction: item.fraction ?? i.fraction,
                  fill: item.fill ?? i.fill,
                  level: item.level ?? i.level,
                  daysSincePurchase: 0,
                }
              : i,
          ),
        }
      }
      return { items: [...state.items, { ...item, daysSincePurchase: 0 }] }
    }),

  toggleFavorite: (recipeId) =>
    set((state) => ({
      favorites: state.favorites.includes(recipeId)
        ? state.favorites.filter((id) => id !== recipeId)
        : [...state.favorites, recipeId],
    })),

  addToGroceryList: (item) =>
    set((state) => {
      if (state.groceryList.some((g) => g.name === item.name)) return state
      return {
        groceryList: [
          ...state.groceryList,
          { ...item, id: `g-${Date.now()}-${item.name}`, checked: false },
        ],
      }
    }),

  toggleGroceryChecked: (id) =>
    set((state) => ({
      groceryList: state.groceryList.map((g) => (g.id === id ? { ...g, checked: !g.checked } : g)),
    })),

  removeGroceryItem: (id) =>
    set((state) => ({ groceryList: state.groceryList.filter((g) => g.id !== id) })),

  startCooking: (recipeId) =>
    set({ cookingSession: { recipeId, adaptations: {}, stepIndex: 0, actualUsage: {} } }),

  setAdaptation: (ingredientId, choice) =>
    set((state) => {
      if (!state.cookingSession) return state
      return {
        cookingSession: {
          ...state.cookingSession,
          adaptations: { ...state.cookingSession.adaptations, [ingredientId]: choice },
        },
      }
    }),

  nextStep: () =>
    set((state) => {
      if (!state.cookingSession) return state
      const recipe = state.recipes.find((r) => r.id === state.cookingSession!.recipeId)
      const max = recipe ? recipe.steps.length - 1 : 0
      return {
        cookingSession: {
          ...state.cookingSession,
          stepIndex: Math.min(state.cookingSession.stepIndex + 1, max),
        },
      }
    }),

  prevStep: () =>
    set((state) => {
      if (!state.cookingSession) return state
      return {
        cookingSession: {
          ...state.cookingSession,
          stepIndex: Math.max(state.cookingSession.stepIndex - 1, 0),
        },
      }
    }),

  setActualUsage: (itemId, amount) =>
    set((state) => {
      if (!state.cookingSession) return state
      return {
        cookingSession: {
          ...state.cookingSession,
          actualUsage: { ...state.cookingSession.actualUsage, [itemId]: amount },
        },
      }
    }),

  finishCooking: (deductions) =>
    set((state) => ({
      items: state.items.map((item) => {
        const deduction = deductions.find((d) => d.itemId === item.id)
        if (!deduction) return item
        return {
          ...item,
          count: deduction.newCount ?? item.count,
          fraction: deduction.newFraction ?? item.fraction,
          fill: deduction.newFill ?? item.fill,
          level: deduction.newLevel ?? item.level,
        }
      }),
      cookingSession: null,
    })),

  cancelCooking: () => set({ cookingSession: null }),
}))

export function useRecipeById(id?: string) {
  return useKitchenStore((s) => s.recipes.find((r) => r.id === id))
}
