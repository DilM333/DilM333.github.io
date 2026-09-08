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
  {
    id: 'fried-egg-toast',
    name: 'Fried Egg on Toast',
    emoji: '🍳',
    time: 8,
    effortLabel: 'Easy',
    effort: 'Bare minimum',
    tags: ['quick', 'vegetarian', 'cheap'],
    mealTypes: ['breakfast'],
    description: 'The simplest breakfast there is — a crispy fried egg over buttered toast.',
    ingredients: [
      { id: 'i1', name: 'Eggs', emoji: '🥚', quantity: '2', itemId: 'eggs', requiredAmount: 2, requiredUnit: 'count' },
      // Bread's stock model tracks whole loaves, not slices — "2 slices"
      // can't be honestly expressed as a structured count against that
      // scale, so this stays unstructured (presence/absence only).
      { id: 'i2', name: 'Bread', emoji: '🍞', quantity: '2 slices', itemId: 'bread' },
      { id: 'i3', name: 'Butter', emoji: '🧈', quantity: '1 tbsp', itemId: 'butter' },
    ],
    steps: [
      { instruction: 'Toast the bread slices until golden.' },
      { instruction: 'Melt butter in a pan over medium heat.' },
      { instruction: 'Fry the eggs to your liking.', timerMinutes: 3 },
      { instruction: 'Season with salt and pepper, then serve over the toast.' },
    ],
  },
  {
    id: 'greek-yogurt-berry-bowl',
    name: 'Greek Yogurt Berry Bowl',
    emoji: '🫐',
    time: 5,
    effortLabel: 'Easy',
    effort: 'Bare minimum',
    tags: ['quick', 'vegetarian', 'light'],
    mealTypes: ['breakfast', 'snack'],
    description: 'A five-minute bowl that turns yogurt and berries into a real breakfast.',
    ingredients: [
      // Yogurt tubs vary too widely (single-serve cup vs. family tub) to
      // honestly approximate "1 cup" as a fixed fill fraction — left
      // unstructured rather than guessed.
      { id: 'i1', name: 'Greek yogurt', emoji: '🥣', quantity: '1 cup', itemId: 'greek-yogurt' },
      { id: 'i2', name: 'Blueberries', emoji: '🫐', quantity: '½ cup', itemId: 'blueberries' },
      { id: 'i3', name: 'Honey', emoji: '🍯', quantity: '1 tbsp, drizzled', itemId: 'honey', optional: true },
    ],
    steps: [
      { instruction: 'Spoon the yogurt into a bowl.' },
      { instruction: 'Top with blueberries.' },
      { instruction: 'Drizzle with honey if using, and serve.' },
    ],
  },
  {
    id: 'overnight-oats',
    name: 'Overnight Oats',
    emoji: '🥣',
    time: 5,
    effortLabel: 'Easy',
    effort: 'Bare minimum',
    tags: ['vegetarian', 'cheap'],
    mealTypes: ['breakfast'],
    description: 'Stir it together tonight, wake up to breakfast that is already done.',
    ingredients: [
      { id: 'i1', name: 'Oats', emoji: '🌾', quantity: '½ cup', itemId: 'oats' },
      // A "½ cup" splash of milk is too small a fraction of any real carton
      // size to honestly express as a fill amount.
      { id: 'i2', name: 'Milk', emoji: '🥛', quantity: '½ cup', itemId: 'milk' },
      { id: 'i3', name: 'Honey', emoji: '🍯', quantity: '1 tsp', itemId: 'honey', optional: true },
      { id: 'i4', name: 'Blueberries', emoji: '🫐', quantity: '¼ cup', itemId: 'blueberries', optional: true },
    ],
    steps: [
      { instruction: 'Stir the oats and milk together in a jar or bowl.' },
      { instruction: 'Stir in honey and blueberries if using.' },
      { instruction: 'Cover and refrigerate overnight, at least 4 hours.' },
      { instruction: 'Stir again before eating, loosening with a splash more milk if needed.' },
    ],
  },
  {
    id: 'banana-pancakes',
    name: 'Banana Pancakes',
    emoji: '🥞',
    time: 20,
    effortLabel: 'Easy',
    effort: 'Normal',
    tags: ['comforting'],
    mealTypes: ['breakfast'],
    description: 'Fluffy pancakes with mashed banana folded right into the batter.',
    ingredients: [
      { id: 'i1', name: 'Flour', emoji: '🌾', quantity: '1 cup', itemId: 'flour' },
      { id: 'i2', name: 'Eggs', emoji: '🥚', quantity: '1', itemId: 'eggs', requiredAmount: 1, requiredUnit: 'count' },
      { id: 'i3', name: 'Milk', emoji: '🥛', quantity: '¾ cup', itemId: 'milk' },
      {
        id: 'i4',
        name: 'Banana',
        emoji: '🍌',
        quantity: '1, mashed',
        itemId: 'banana',
        requiredAmount: 1,
        requiredUnit: 'count',
      },
      { id: 'i5', name: 'Butter', emoji: '🧈', quantity: '1 tbsp, for the pan', itemId: 'butter', optional: true },
    ],
    steps: [
      { instruction: 'Mash the banana in a large bowl.' },
      { instruction: 'Whisk in the egg and milk.' },
      { instruction: 'Stir in the flour just until combined — a few lumps are fine.' },
      { instruction: 'Melt butter in a pan over medium heat.' },
      { instruction: 'Pour batter into rounds, cook until bubbles form, then flip.', timerMinutes: 6 },
      { instruction: 'Serve warm.' },
    ],
  },
]
