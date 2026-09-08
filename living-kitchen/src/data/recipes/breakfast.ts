import type { Recipe } from '../types'

/** Recipes whose primary use is breakfast. See data/recipes/index.ts. */
export const breakfastRecipes: Recipe[] = [
  {
    id: 'loaded-omelet',
    name: 'Loaded Omelet',
    emoji: '🍳',
    time: 15,
    effortLabel: 'Easy',
    effort: 'Bare minimum',
    tags: ['quick', 'vegetarian', 'lunch'],
    mealTypes: ['breakfast', 'lunch'],
    description: 'A fluffy skillet omelet filled with whatever is on hand.',
    ingredients: [
      { id: 'i1', name: 'Eggs', emoji: '🥚', quantity: '3', itemId: 'eggs' },
      { id: 'i2', name: 'Butter', emoji: '🧈', quantity: '1 tbsp', itemId: 'butter' },
      { id: 'i3', name: 'Milk', emoji: '🥛', quantity: 'splash', itemId: 'milk' },
      { id: 'i4', name: 'Bell Pepper', emoji: '🫑', quantity: '¼, diced', itemId: 'bell-pepper' },
      { id: 'i5', name: 'Parmesan', emoji: '🧀', quantity: '2 tbsp', itemId: 'parmesan', optional: true },
    ],
    steps: [
      { instruction: 'Whisk eggs with a splash of milk.' },
      { instruction: 'Melt butter in a nonstick pan over medium heat.' },
      { instruction: 'Add bell pepper, cook until just tender.', timerMinutes: 3 },
      { instruction: 'Pour in eggs, cook until mostly set.', timerMinutes: 4 },
      { instruction: 'Sprinkle parmesan if using, fold, and serve.' },
    ],
  },
]
