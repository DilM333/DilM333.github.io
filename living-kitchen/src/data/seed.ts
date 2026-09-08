import type { GroceryItem, KitchenItem, Person } from './types'
import { recipes } from './recipes'

/**
 * Re-exported under the pre-existing name so store/useKitchenStore.ts and
 * every screen/matching module need no change — the recipes themselves now
 * live in data/recipes/ (split by primary meal type; see that directory's
 * index.ts) rather than inline in this file.
 */
export const seedRecipes = recipes

export const seedKitchen: KitchenItem[] = [
  // Use soon
  {
    id: 'spinach',
    name: 'Spinach',
    emoji: '🥬',
    location: 'fridge',
    stockType: 'divisible',
    category: 'Produce',
    fraction: 0.75,
    daysSincePurchase: 6,
  },
  {
    id: 'parsley',
    name: 'Parsley',
    emoji: '🌿',
    location: 'herbs',
    stockType: 'divisible',
    category: 'Herbs',
    fraction: 0.5,
    daysSincePurchase: 8,
  },
  {
    id: 'mushrooms',
    name: 'Mushrooms',
    emoji: '🍄',
    location: 'fridge',
    stockType: 'divisible',
    category: 'Produce',
    fraction: 0.75,
    daysSincePurchase: 5,
  },
  // Fridge
  {
    id: 'milk',
    name: 'Milk',
    emoji: '🥛',
    location: 'fridge',
    stockType: 'container',
    category: 'Dairy',
    fill: 0.5,
  },
  {
    id: 'eggs',
    name: 'Eggs',
    emoji: '🥚',
    location: 'fridge',
    stockType: 'countable',
    category: 'Dairy',
    count: 4,
  },
  {
    id: 'butter',
    name: 'Butter',
    emoji: '🧈',
    location: 'fridge',
    stockType: 'staple',
    category: 'Dairy',
    level: 'low',
    reserved: 0.5,
    reservedFor: 'Cookies tomorrow',
  },
  {
    id: 'parmesan',
    name: 'Parmesan',
    emoji: '🧀',
    location: 'fridge',
    stockType: 'staple',
    category: 'Dairy',
    level: 'plenty',
  },
  {
    id: 'carrots',
    name: 'Carrots',
    emoji: '🥕',
    location: 'fridge',
    stockType: 'countable',
    category: 'Produce',
    count: 3,
  },
  {
    id: 'red-onion',
    name: 'Red onion',
    emoji: '🧅',
    location: 'fridge',
    stockType: 'divisible',
    category: 'Produce',
    fraction: 0.5,
  },
  {
    id: 'lemon',
    name: 'Lemon',
    emoji: '🍋',
    location: 'fridge',
    stockType: 'countable',
    category: 'Produce',
    count: 0,
  },
  // Freezer
  {
    id: 'chicken-breast',
    name: 'Chicken breast',
    emoji: '🍗',
    location: 'freezer',
    stockType: 'countable',
    category: 'Meat',
    count: 3,
  },
  {
    id: 'corn',
    name: 'Corn',
    emoji: '🌽',
    location: 'freezer',
    stockType: 'countable',
    category: 'Produce',
    count: 2,
  },
  // Pantry
  {
    id: 'rice',
    name: 'Rice',
    emoji: '🍚',
    location: 'pantry',
    stockType: 'staple',
    category: 'Grains',
    level: 'plenty',
  },
  {
    id: 'orzo',
    name: 'Orzo',
    emoji: '🍝',
    location: 'pantry',
    stockType: 'staple',
    category: 'Grains',
    level: 'some',
  },
  {
    id: 'pasta',
    name: 'Pasta',
    emoji: '🍝',
    location: 'pantry',
    stockType: 'staple',
    category: 'Grains',
    level: 'some',
  },
  {
    id: 'olive-oil',
    name: 'Olive oil',
    emoji: '🫒',
    location: 'pantry',
    stockType: 'staple',
    category: 'Pantry staple',
    level: 'plenty',
  },
  {
    id: 'salt',
    name: 'Salt',
    emoji: '🧂',
    location: 'pantry',
    stockType: 'staple',
    category: 'Pantry staple',
    level: 'plenty',
  },
  {
    id: 'broth',
    name: 'Vegetable broth',
    emoji: '🥫',
    location: 'pantry',
    stockType: 'container',
    category: 'Pantry',
    fill: 0.35,
  },
  {
    id: 'potatoes',
    name: 'Potatoes',
    emoji: '🥔',
    location: 'pantry',
    stockType: 'countable',
    category: 'Produce',
    count: 5,
  },
]

export const seedPeople: Person[] = [
  {
    id: 'you',
    name: 'You',
    restrictions: [],
    dislikes: [],
    preferences: ['Lighter food', 'Mediterranean'],
  },
]

export const seedGroceryList: GroceryItem[] = [
  { id: 'g1', name: 'Spinach', emoji: '🥬', category: 'Produce', reason: 'For Tuscan Chicken + Orzo', checked: false, estPrice: 2.49 },
  { id: 'g2', name: 'Lemons', emoji: '🍋', category: 'Produce', reason: 'For Lemon Parmesan Orzo', checked: false, estPrice: 0.79 },
  { id: 'g3', name: 'Zucchini', emoji: '🥒', category: 'Produce', reason: 'Added manually', checked: false, estPrice: 1.29 },
  { id: 'g4', name: 'Chicken breast', emoji: '🍗', category: 'Meat', reason: 'Running low', checked: false, estPrice: 7.99 },
  { id: 'g5', name: 'Butter', emoji: '🧈', category: 'Dairy', reason: 'Running low + reserved for cookies', checked: false, estPrice: 4.29 },
  { id: 'g6', name: 'Eggs', emoji: '🥚', category: 'Dairy', reason: 'Running low + Fried Rice', checked: false, estPrice: 3.49 },
]
