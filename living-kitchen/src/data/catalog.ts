import type { KitchenItem, Location, StockType } from './types'

export interface CatalogEntry {
  id: string
  name: string
  emoji: string
  category: string
  location: Location
  stockType: StockType
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

export const catalog: CatalogEntry[] = [
  { id: 'russet-potato', name: 'Russet Potato', emoji: '🥔', category: 'Produce', location: 'pantry', stockType: 'countable' },
  { id: 'sweet-potato', name: 'Sweet Potato', emoji: '🍠', category: 'Produce', location: 'pantry', stockType: 'countable' },
  { id: 'yukon-potato', name: 'Yukon Gold Potato', emoji: '🥔', category: 'Produce', location: 'pantry', stockType: 'countable' },
  { id: 'tomato', name: 'Tomato', emoji: '🍅', category: 'Produce', location: 'fridge', stockType: 'countable' },
  { id: 'zucchini', name: 'Zucchini', emoji: '🥒', category: 'Produce', location: 'fridge', stockType: 'countable' },
  { id: 'bell-pepper', name: 'Bell Pepper', emoji: '🫑', category: 'Produce', location: 'fridge', stockType: 'countable' },
  { id: 'garlic', name: 'Garlic', emoji: '🧄', category: 'Produce', location: 'pantry', stockType: 'staple' },
  { id: 'green-onion', name: 'Green Onion', emoji: '🌱', category: 'Produce', location: 'fridge', stockType: 'divisible' },
  { id: 'avocado', name: 'Avocado', emoji: '🥑', category: 'Produce', location: 'fridge', stockType: 'countable' },
  { id: 'lime', name: 'Lime', emoji: '🍈', category: 'Produce', location: 'fridge', stockType: 'countable' },

  { id: 'ground-beef', name: 'Ground Beef', emoji: '🥩', category: 'Meat', location: 'fridge', stockType: 'container' },
  { id: 'bacon', name: 'Bacon', emoji: '🥓', category: 'Meat', location: 'fridge', stockType: 'container' },
  { id: 'salmon', name: 'Salmon', emoji: '🐟', category: 'Meat', location: 'fridge', stockType: 'countable' },
  { id: 'shrimp', name: 'Shrimp', emoji: '🍤', category: 'Meat', location: 'freezer', stockType: 'container' },
  { id: 'tofu', name: 'Tofu', emoji: '🧊', category: 'Meat', location: 'fridge', stockType: 'countable' },

  { id: 'greek-yogurt', name: 'Greek Yogurt', emoji: '🥣', category: 'Dairy', location: 'fridge', stockType: 'container' },
  { id: 'cheddar', name: 'Cheddar Cheese', emoji: '🧀', category: 'Dairy', location: 'fridge', stockType: 'staple' },
  { id: 'cream-cheese', name: 'Cream Cheese', emoji: '🧈', category: 'Dairy', location: 'fridge', stockType: 'staple' },
  { id: 'sour-cream', name: 'Sour Cream', emoji: '🥛', category: 'Dairy', location: 'fridge', stockType: 'container' },

  { id: 'flour', name: 'Flour', emoji: '🌾', category: 'Pantry', location: 'pantry', stockType: 'staple' },
  { id: 'sugar', name: 'Sugar', emoji: '🍬', category: 'Pantry', location: 'pantry', stockType: 'staple' },
  { id: 'canned-tomatoes', name: 'Canned Tomatoes', emoji: '🥫', category: 'Pantry', location: 'pantry', stockType: 'countable' },
  { id: 'black-beans', name: 'Black Beans', emoji: '🫘', category: 'Pantry', location: 'pantry', stockType: 'countable' },
  { id: 'quinoa', name: 'Quinoa', emoji: '🌾', category: 'Pantry', location: 'pantry', stockType: 'staple' },
  { id: 'soy-sauce', name: 'Soy Sauce', emoji: '🍶', category: 'Seasonings', location: 'pantry', stockType: 'container' },
  { id: 'honey', name: 'Honey', emoji: '🍯', category: 'Pantry', location: 'pantry', stockType: 'container' },

  { id: 'frozen-peas', name: 'Frozen Peas', emoji: '🟢', category: 'Frozen', location: 'freezer', stockType: 'container' },
  { id: 'frozen-berries', name: 'Frozen Berries', emoji: '🫐', category: 'Frozen', location: 'freezer', stockType: 'container' },
  { id: 'ice-cream', name: 'Ice Cream', emoji: '🍦', category: 'Frozen', location: 'freezer', stockType: 'container' },

  { id: 'basil', name: 'Basil', emoji: '🌿', category: 'Herbs', location: 'herbs', stockType: 'divisible' },
  { id: 'cilantro', name: 'Cilantro', emoji: '🌿', category: 'Herbs', location: 'herbs', stockType: 'divisible' },
  { id: 'dill', name: 'Dill', emoji: '🌿', category: 'Herbs', location: 'herbs', stockType: 'divisible' },

  { id: 'black-pepper', name: 'Black Pepper', emoji: '🧂', category: 'Seasonings', location: 'pantry', stockType: 'staple' },
  { id: 'paprika', name: 'Paprika', emoji: '🧂', category: 'Seasonings', location: 'pantry', stockType: 'staple' },
  { id: 'cumin', name: 'Cumin', emoji: '🧂', category: 'Seasonings', location: 'pantry', stockType: 'staple' },
]

export function toKitchenItem(entry: CatalogEntry): KitchenItem {
  const base: KitchenItem = {
    id: entry.id,
    name: entry.name,
    emoji: entry.emoji,
    location: entry.location,
    stockType: entry.stockType,
    category: entry.category,
    daysSincePurchase: 0,
  }
  if (entry.stockType === 'countable') base.count = 1
  if (entry.stockType === 'divisible') base.fraction = 1
  if (entry.stockType === 'container') base.fill = 1
  if (entry.stockType === 'staple') base.level = 'plenty'
  return base
}
