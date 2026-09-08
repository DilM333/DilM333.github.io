import type { Recipe } from '../types'

/** Recipes whose primary use is a side dish. See data/recipes/index.ts. */
export const sideRecipes: Recipe[] = [
  {
    id: 'roasted-veggies',
    name: 'Roasted Vegetable Medley',
    emoji: '🥦',
    time: 35,
    effortLabel: 'Easy',
    effort: 'Bare minimum',
    tags: ['light', 'vegetarian', 'cheap', 'dinner'],
    mealTypes: ['side', 'dinner'],
    description: 'A simple sheet-pan side of caramelized roasted vegetables.',
    ingredients: [
      { id: 'i1', name: 'Carrots', emoji: '🥕', quantity: '2, chopped', itemId: 'carrots' },
      {
        id: 'i2',
        name: 'Red onion',
        emoji: '🧅',
        quantity: '1, wedged',
        itemId: 'red-onion',
        // Whole onion, same whole+quarter decimal convention as
        // KitchenItem.fraction.
        requiredAmount: 1,
        requiredUnit: 'fraction',
      },
      { id: 'i3', name: 'Zucchini', emoji: '🥒', quantity: '1, sliced', itemId: 'zucchini' },
      { id: 'i4', name: 'Bell Pepper', emoji: '🫑', quantity: '1, sliced', itemId: 'bell-pepper' },
      { id: 'i5', name: 'Olive oil', emoji: '🫒', quantity: '2 tbsp', itemId: 'olive-oil' },
      { id: 'i6', name: 'Salt', emoji: '🧂', quantity: 'to taste', itemId: 'salt' },
    ],
    steps: [
      { instruction: 'Chop all vegetables into similar-sized pieces.' },
      { instruction: 'Toss with olive oil and salt.' },
      { instruction: 'Roast at 425°F, stirring once, until caramelized.', timerMinutes: 25 },
      { instruction: 'Serve warm.' },
    ],
  },
]
