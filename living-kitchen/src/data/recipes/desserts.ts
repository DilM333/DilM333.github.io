import type { Recipe } from '../types'

/** Recipes whose primary use is dessert. See data/recipes/index.ts. */
export const dessertRecipes: Recipe[] = [
  {
    id: 'sugar-cookies',
    name: 'Sugar Cookies',
    emoji: '🍪',
    time: 40,
    effortLabel: 'Medium',
    effort: 'I want to cook',
    tags: ['comforting'],
    mealTypes: ['dessert'],
    description: 'Classic soft sugar cookies.',
    ingredients: [
      {
        id: 'i1',
        name: 'Butter',
        emoji: '🧈',
        quantity: '1 cup',
        itemId: 'butter',
        // Same coarse staple-level scale as the pasta requirement above.
        requiredAmount: 2,
        requiredUnit: 'level',
      },
      { id: 'i2', name: 'Eggs', emoji: '🥚', quantity: '2', itemId: 'eggs' },
      { id: 'i3', name: 'Flour', emoji: '🌾', quantity: '3 cups', itemId: 'flour' },
      { id: 'i4', name: 'Sugar', emoji: '🍬', quantity: '1 cup', itemId: 'sugar' },
    ],
    steps: [
      { instruction: 'Cream butter and sugar.' },
      { instruction: 'Beat in eggs.' },
      { instruction: 'Fold in flour, chill dough.', timerMinutes: 30 },
      { instruction: 'Bake at 350°F until edges are set.', timerMinutes: 10 },
    ],
  },
]
