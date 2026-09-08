import type { Recipe } from '../types'

/** Recipes whose primary use is a snack. See data/recipes/index.ts. */
export const snackRecipes: Recipe[] = [
  {
    id: 'peanut-butter-banana-toast',
    name: 'Peanut Butter Banana Toast',
    emoji: '🍌',
    time: 5,
    effortLabel: 'Easy',
    effort: 'Bare minimum',
    tags: ['quick', 'vegetarian', 'cheap'],
    mealTypes: ['snack'],
    description: 'Toast, peanut butter, banana — done in the time it takes the toaster to pop.',
    ingredients: [
      { id: 'i1', name: 'Bread', emoji: '🍞', quantity: '2 slices', itemId: 'bread' },
      { id: 'i2', name: 'Peanut butter', emoji: '🥜', quantity: '2 tbsp', itemId: 'peanut-butter' },
      // Half a banana isn't a whole-unit count — left unstructured.
      { id: 'i3', name: 'Banana', emoji: '🍌', quantity: '1, sliced', itemId: 'banana', requiredAmount: 1, requiredUnit: 'count' },
      { id: 'i4', name: 'Honey', emoji: '🍯', quantity: '1 tsp, drizzled', itemId: 'honey', optional: true },
    ],
    steps: [
      { instruction: 'Toast the bread.' },
      { instruction: 'Spread peanut butter over each slice.' },
      { instruction: 'Top with banana slices.' },
      { instruction: 'Drizzle with honey if using, and serve.' },
    ],
  },
  {
    id: 'no-bake-pb-oat-bites',
    name: 'No-Bake Peanut Butter Oat Bites',
    emoji: '🥜',
    time: 15,
    effortLabel: 'Easy',
    effort: 'Bare minimum',
    tags: ['vegetarian', 'cheap'],
    mealTypes: ['snack', 'dessert'],
    description: 'No oven needed — just stir, roll, and chill.',
    ingredients: [
      { id: 'i1', name: 'Oats', emoji: '🌾', quantity: '1 cup', itemId: 'oats' },
      { id: 'i2', name: 'Peanut butter', emoji: '🥜', quantity: '½ cup', itemId: 'peanut-butter' },
      // Honey jar sizes vary too much to honestly express "¼ cup" as a
      // fill fraction.
      { id: 'i3', name: 'Honey', emoji: '🍯', quantity: '¼ cup', itemId: 'honey' },
      { id: 'i4', name: 'Chocolate chips', emoji: '🍫', quantity: '¼ cup', itemId: 'chocolate-chips', optional: true },
    ],
    steps: [
      { instruction: 'Stir oats, peanut butter, and honey together in a bowl.' },
      { instruction: 'Fold in chocolate chips if using.' },
      { instruction: 'Roll into small balls.' },
      { instruction: 'Chill until firm, at least 20 minutes.' },
    ],
  },
]
