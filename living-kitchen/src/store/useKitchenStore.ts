import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CatalogEntry } from '../data/catalog'
import { seedGroceryList, seedKitchen, seedPeople, seedRecipes } from '../data/seed'
import type { GroceryItem, KitchenItem, Person, Recipe, StapleLevel } from '../data/types'
import {
  deleteKitchenItem,
  fetchKitchenItems,
  insertKitchenItem,
  updateKitchenItem,
  uploadInitialKitchen,
} from '../lib/kitchenSync'
import {
  deleteGroceryItem,
  fetchGroceryItems,
  insertGroceryItem,
  updateGroceryItem,
  uploadInitialGroceryList,
} from '../lib/grocerySync'
import { deleteFavorite, fetchFavorites, insertFavorite, uploadInitialFavorites } from '../lib/favoritesSync'
import {
  fetchCustomIngredients,
  insertCustomIngredient,
  updateCustomIngredient,
  uploadInitialCustomIngredients,
} from '../lib/customIngredientsSync'

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
  /** ingredients the user created that aren't in the built-in catalog */
  customCatalog: CatalogEntry[]
  cookingSession: CookingSession | null

  /** Household currently synced to Supabase, set once auth resolves it. */
  householdId: string | null
  /** True until the initial Supabase fetch (and first-migration upload, if any) finishes. */
  kitchenLoading: boolean
  /** Set when a Supabase read/write for kitchen items failed (RLS or otherwise). */
  kitchenSyncError: string | null

  /** True until the initial Supabase fetch (and first-migration upload, if any) finishes. */
  groceryLoading: boolean
  /** Set when a Supabase read/write for the grocery list failed (RLS or otherwise). */
  groceryListSyncError: string | null

  /** True until the initial Supabase fetch (and first-migration upload, if any) finishes. */
  favoritesLoading: boolean
  /** Set when a Supabase read/write for favorites failed (RLS or otherwise). */
  favoritesSyncError: string | null

  /** True until the initial Supabase fetch (and first-migration upload, if any) finishes. */
  customIngredientsLoading: boolean
  /** Set when a Supabase read/write for custom ingredients failed (RLS or otherwise). */
  customIngredientsSyncError: string | null

  completeOnboarding: (people: Person[]) => void
  resetDemo: () => void

  initKitchenSync: (householdId: string) => Promise<void>
  resetKitchenSync: () => void

  initGroceryListSync: (householdId: string) => Promise<void>
  resetGroceryListSync: () => void

  initFavoritesSync: (householdId: string) => Promise<void>
  resetFavoritesSync: () => void

  initCustomIngredientsSync: (householdId: string) => Promise<void>
  resetCustomIngredientsSync: () => void

  updateCount: (id: string, delta: number) => void
  updateFraction: (id: string, fraction: number) => void
  updateFill: (id: string, fill: number) => void
  updateLevel: (id: string, level: StapleLevel) => void
  setReserved: (id: string, reserved: number, reservedFor?: string) => void
  addKitchenItem: (item: KitchenItem) => void
  removeKitchenItem: (id: string) => void
  addCustomCatalogEntry: (entry: CatalogEntry) => void

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

const DEFAULT_FAVORITES = ['crispy-herb-chicken', 'veg-fried-rice', 'tuscan-chicken', 'sugar-cookies']

// Module-level guards so React StrictMode's double-invoke can't kick off the
// initial Supabase fetch (and, worse, the one-time upload) twice.
let kitchenInitPromise: Promise<void> | null = null
let kitchenInitForHousehold: string | null = null
let groceryInitPromise: Promise<void> | null = null
let groceryInitForHousehold: string | null = null
let favoritesInitPromise: Promise<void> | null = null
let favoritesInitForHousehold: string | null = null
let customIngredientsInitPromise: Promise<void> | null = null
let customIngredientsInitForHousehold: string | null = null

const seedState = () => ({
  onboarded: false,
  people: seedPeople,
  items: seedKitchen,
  recipes: seedRecipes,
  favorites: DEFAULT_FAVORITES,
  groceryList: seedGroceryList,
  customCatalog: [] as CatalogEntry[],
  cookingSession: null,
})

export const useKitchenStore = create<KitchenState>()(
  persist(
    (set, get) => {
      // Fire-and-forget sync of one item's current state to Supabase. Local
      // Zustand state (and its localStorage fallback) has already been
      // updated by the time this runs, so a failure here never loses data —
      // it only means the change hasn't reached Supabase yet.
      const persistItem = (item: KitchenItem) => {
        const { householdId } = get()
        if (!householdId) return

        if (item.remoteId) {
          void updateKitchenItem(item, householdId).then(({ error }) => {
            if (error) set({ kitchenSyncError: error })
          })
        } else {
          void insertKitchenItem(item, householdId).then(({ remoteId, error }) => {
            if (error) {
              set({ kitchenSyncError: error })
              return
            }
            if (remoteId) {
              set((state) => ({
                items: state.items.map((i) => (i.id === item.id ? { ...i, remoteId } : i)),
              }))
            }
          })
        }
      }

      // Same fire-and-forget pattern as persistItem, for the grocery list.
      const persistGroceryItem = (item: GroceryItem) => {
        const { householdId } = get()
        if (!householdId) return

        if (item.remoteId) {
          void updateGroceryItem(item, householdId).then(({ error }) => {
            if (error) set({ groceryListSyncError: error })
          })
        } else {
          void insertGroceryItem(item, householdId).then(({ remoteId, error }) => {
            if (error) {
              set({ groceryListSyncError: error })
              return
            }
            if (remoteId) {
              set((state) => ({
                groceryList: state.groceryList.map((g) => (g.id === item.id ? { ...g, remoteId } : g)),
              }))
            }
          })
        }
      }

      // Same fire-and-forget pattern as persistItem/persistGroceryItem, for
      // the custom ingredient catalog.
      const persistCustomEntry = (entry: CatalogEntry) => {
        const { householdId } = get()
        if (!householdId) return

        if (entry.remoteId) {
          void updateCustomIngredient(entry, householdId).then(({ error }) => {
            if (error) set({ customIngredientsSyncError: error })
          })
        } else {
          void insertCustomIngredient(entry, householdId).then(({ remoteId, error }) => {
            if (error) {
              set({ customIngredientsSyncError: error })
              return
            }
            if (remoteId) {
              set((state) => ({
                customCatalog: state.customCatalog.map((e) =>
                  e.id === entry.id ? { ...e, remoteId } : e,
                ),
              }))
            }
          })
        }
      }

      /**
       * kitchen_items has no column linking a row back to its custom
       * ingredient — a kitchen item's local id can only be reconstructed by
       * matching its name against the custom catalog (see kitchenSync.ts
       * deriveIdentity). If a kitchen item is ever loaded before its
       * matching custom_ingredients row exists (e.g. the custom ingredient
       * write failed, or predates this sync feature), it gets a plain
       * unprefixed slug id instead of `custom-<slug>`. Once the real custom
       * ingredient shows up, this reconciles that item's *local* id to match
       * — never touching Supabase — so it's treated as the same item instead
       * of quietly duplicating. Skips when another item already holds the
       * target id, since that means two real rows already exist and merging
       * them silently would be guessing which one is right.
       */
      const reconcileCustomItemIds = (items: KitchenItem[], customCatalog: CatalogEntry[]) => {
        const usedIds = new Set(items.map((i) => i.id))
        return items.map((item) => {
          const match = customCatalog.find((e) => e.name.toLowerCase() === item.name.toLowerCase())
          if (match && match.id !== item.id && !usedIds.has(match.id)) {
            usedIds.delete(item.id)
            usedIds.add(match.id)
            return { ...item, id: match.id }
          }
          return item
        })
      }

      return {
        ...seedState(),
        householdId: null,
        kitchenLoading: true,
        kitchenSyncError: null,
        groceryLoading: true,
        groceryListSyncError: null,
        favoritesLoading: true,
        favoritesSyncError: null,
        customIngredientsLoading: true,
        customIngredientsSyncError: null,

        completeOnboarding: (people) => set({ onboarded: true, people }),
        resetDemo: () => set(seedState()),

        initKitchenSync: async (householdId) => {
          if (kitchenInitForHousehold === householdId && kitchenInitPromise) {
            return kitchenInitPromise
          }
          kitchenInitForHousehold = householdId
          set({ householdId, kitchenLoading: true, kitchenSyncError: null })

          kitchenInitPromise = (async () => {
            const { customCatalog, items: localItems } = get()
            const { items: fetched, error } = await fetchKitchenItems(householdId, customCatalog)

            if (error) {
              // Keep whatever is already in Zustand/localStorage — never erase
              // local data just because Supabase is unreachable or blocked.
              set({ kitchenLoading: false, kitchenSyncError: error })
              return
            }

            if (fetched.length === 0 && localItems.length > 0) {
              const { items: uploaded, error: uploadError } = await uploadInitialKitchen(
                localItems,
                householdId,
              )
              set({ items: uploaded, kitchenLoading: false, kitchenSyncError: uploadError ?? null })
              return
            }

            const reconciled = reconcileCustomItemIds(fetched, get().customCatalog)
            set({ items: reconciled, kitchenLoading: false, kitchenSyncError: null })
          })()

          return kitchenInitPromise
        },

        resetKitchenSync: () => {
          kitchenInitPromise = null
          kitchenInitForHousehold = null
          set({ householdId: null, kitchenLoading: false, kitchenSyncError: null })
        },

        initGroceryListSync: async (householdId) => {
          if (groceryInitForHousehold === householdId && groceryInitPromise) {
            return groceryInitPromise
          }
          groceryInitForHousehold = householdId
          set({ householdId, groceryLoading: true, groceryListSyncError: null })

          groceryInitPromise = (async () => {
            const { customCatalog, groceryList: localItems } = get()
            const { items: fetched, error } = await fetchGroceryItems(householdId, customCatalog)

            if (error) {
              set({ groceryLoading: false, groceryListSyncError: error })
              return
            }

            if (fetched.length === 0 && localItems.length > 0) {
              const { items: uploaded, error: uploadError } = await uploadInitialGroceryList(
                localItems,
                householdId,
              )
              set({
                groceryList: uploaded,
                groceryLoading: false,
                groceryListSyncError: uploadError ?? null,
              })
              return
            }

            set({ groceryList: fetched, groceryLoading: false, groceryListSyncError: null })
          })()

          return groceryInitPromise
        },

        resetGroceryListSync: () => {
          groceryInitPromise = null
          groceryInitForHousehold = null
          set({ groceryLoading: false, groceryListSyncError: null })
        },

        initFavoritesSync: async (householdId) => {
          if (favoritesInitForHousehold === householdId && favoritesInitPromise) {
            return favoritesInitPromise
          }
          favoritesInitForHousehold = householdId
          set({ householdId, favoritesLoading: true, favoritesSyncError: null })

          favoritesInitPromise = (async () => {
            const { favorites: localFavorites } = get()
            const { favorites: fetched, error } = await fetchFavorites(householdId)

            if (error) {
              set({ favoritesLoading: false, favoritesSyncError: error })
              return
            }

            if (fetched.length === 0 && localFavorites.length > 0) {
              const { error: uploadError } = await uploadInitialFavorites(localFavorites, householdId)
              // Local favorites already match what was just uploaded — no need
              // to replace them, unlike kitchen_items/grocery_list_items which
              // need the server-assigned row id attached back.
              set({ favoritesLoading: false, favoritesSyncError: uploadError ?? null })
              return
            }

            set({ favorites: fetched, favoritesLoading: false, favoritesSyncError: null })
          })()

          return favoritesInitPromise
        },

        resetFavoritesSync: () => {
          favoritesInitPromise = null
          favoritesInitForHousehold = null
          set({ favoritesLoading: false, favoritesSyncError: null })
        },

        initCustomIngredientsSync: async (householdId) => {
          if (customIngredientsInitForHousehold === householdId && customIngredientsInitPromise) {
            return customIngredientsInitPromise
          }
          customIngredientsInitForHousehold = householdId
          set({ householdId, customIngredientsLoading: true, customIngredientsSyncError: null })

          customIngredientsInitPromise = (async () => {
            const { customCatalog: localEntries } = get()
            const { entries: fetched, error } = await fetchCustomIngredients(householdId)

            if (error) {
              set({ customIngredientsLoading: false, customIngredientsSyncError: error })
              return
            }

            if (fetched.length === 0 && localEntries.length > 0) {
              const { entries: uploaded, error: uploadError } = await uploadInitialCustomIngredients(
                localEntries,
                householdId,
              )
              set({
                customCatalog: uploaded,
                customIngredientsLoading: false,
                customIngredientsSyncError: uploadError ?? null,
              })
              return
            }

            set({
              customCatalog: fetched,
              customIngredientsLoading: false,
              customIngredientsSyncError: null,
            })
          })()

          return customIngredientsInitPromise
        },

        resetCustomIngredientsSync: () => {
          customIngredientsInitPromise = null
          customIngredientsInitForHousehold = null
          set({ customIngredientsLoading: false, customIngredientsSyncError: null })
        },

        updateCount: (id, delta) => {
          set((state) => ({
            items: state.items.map((i) =>
              i.id === id ? { ...i, count: Math.max(0, (i.count ?? 0) + delta) } : i,
            ),
          }))
          const updated = get().items.find((i) => i.id === id)
          if (updated) persistItem(updated)
        },

        updateFraction: (id, fraction) => {
          set((state) => ({
            items: state.items.map((i) => (i.id === id ? { ...i, fraction } : i)),
          }))
          const updated = get().items.find((i) => i.id === id)
          if (updated) persistItem(updated)
        },

        updateFill: (id, fill) => {
          set((state) => ({
            items: state.items.map((i) => (i.id === id ? { ...i, fill } : i)),
          }))
          const updated = get().items.find((i) => i.id === id)
          if (updated) persistItem(updated)
        },

        updateLevel: (id, level) => {
          set((state) => ({
            items: state.items.map((i) => (i.id === id ? { ...i, level } : i)),
          }))
          const updated = get().items.find((i) => i.id === id)
          if (updated) persistItem(updated)
        },

        setReserved: (id, reserved, reservedFor) => {
          set((state) => ({
            items: state.items.map((i) =>
              i.id === id ? { ...i, reserved, reservedFor: reserved > 0 ? reservedFor : undefined } : i,
            ),
          }))
          const updated = get().items.find((i) => i.id === id)
          if (updated) persistItem(updated)
        },

        addKitchenItem: (item) => {
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
          })
          const updated = get().items.find((i) => i.id === item.id)
          if (updated) persistItem(updated)
        },

        removeKitchenItem: (id) => {
          const existing = get().items.find((i) => i.id === id)
          set((state) => ({ items: state.items.filter((i) => i.id !== id) }))
          const { householdId } = get()
          if (existing?.remoteId && householdId) {
            void deleteKitchenItem(existing.remoteId, householdId).then(({ error }) => {
              if (error) set({ kitchenSyncError: error })
            })
          }
        },

        addCustomCatalogEntry: (entry) => {
          // Adding again with the same (deterministic) id is how the app
          // already treats this as an edit — carry the existing remoteId
          // forward so persistCustomEntry updates that row instead of
          // creating a duplicate.
          const existing = get().customCatalog.find((e) => e.id === entry.id)
          const nextEntry = existing?.remoteId ? { ...entry, remoteId: existing.remoteId } : entry

          set((state) => {
            const customCatalog = existing
              ? state.customCatalog.map((e) => (e.id === entry.id ? nextEntry : e))
              : [...state.customCatalog, nextEntry]
            // A kitchen item may already exist for this name under a stale
            // unprefixed id (see reconcileCustomItemIds) — fix it up so the
            // addKitchenItem call right after this merges into it instead of
            // creating a duplicate kitchen_items row.
            const items = reconcileCustomItemIds(state.items, customCatalog)
            return { customCatalog, items }
          })
          persistCustomEntry(nextEntry)
        },

        toggleFavorite: (recipeId) => {
          const wasFavorite = get().favorites.includes(recipeId)
          set((state) => ({
            favorites: wasFavorite
              ? state.favorites.filter((id) => id !== recipeId)
              : [...state.favorites, recipeId],
          }))

          const { householdId } = get()
          if (!householdId) return
          if (wasFavorite) {
            void deleteFavorite(recipeId, householdId).then(({ error }) => {
              if (error) set({ favoritesSyncError: error })
            })
          } else {
            void insertFavorite(recipeId, householdId).then(({ error }) => {
              if (error) set({ favoritesSyncError: error })
            })
          }
        },

        addToGroceryList: (item) => {
          if (get().groceryList.some((g) => g.name === item.name)) return
          const newItem: GroceryItem = { ...item, id: `g-${Date.now()}-${item.name}`, checked: false }
          set((state) => ({ groceryList: [...state.groceryList, newItem] }))
          persistGroceryItem(newItem)
        },

        toggleGroceryChecked: (id) => {
          set((state) => ({
            groceryList: state.groceryList.map((g) => (g.id === id ? { ...g, checked: !g.checked } : g)),
          }))
          const updated = get().groceryList.find((g) => g.id === id)
          if (updated) persistGroceryItem(updated)
        },

        removeGroceryItem: (id) => {
          const existing = get().groceryList.find((g) => g.id === id)
          set((state) => ({ groceryList: state.groceryList.filter((g) => g.id !== id) }))
          const { householdId } = get()
          if (existing?.remoteId && householdId) {
            void deleteGroceryItem(existing.remoteId, householdId).then(({ error }) => {
              if (error) set({ groceryListSyncError: error })
            })
          }
        },

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

        finishCooking: (deductions) => {
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
          }))
          const items = get().items
          deductions.forEach((d) => {
            const updated = items.find((i) => i.id === d.itemId)
            if (updated) persistItem(updated)
          })
        },

        cancelCooking: () => set({ cookingSession: null }),
      }
    },
    {
      name: 'living-kitchen',
      version: 1,
      // Persist user data only. Recipes stay code-owned; the cooking session is transient.
      partialize: (s) => ({
        onboarded: s.onboarded,
        people: s.people,
        items: s.items,
        favorites: s.favorites,
        groceryList: s.groceryList,
        customCatalog: s.customCatalog,
      }),
    },
  ),
)

export function useRecipeById(id?: string) {
  return useKitchenStore((s) => s.recipes.find((r) => r.id === id))
}
