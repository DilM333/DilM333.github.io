import type { Recipe } from '../types'

/** Recipes whose primary use is lunch. See data/recipes/index.ts. */
export const lunchRecipes: Recipe[] = [
  {
    id: 'egg-salad-sandwich',
    name: 'Egg Salad Sandwich',
    emoji: '🥪',
    time: 15,
    effortLabel: 'Easy',
    effort: 'Normal',
    tags: ['quick'],
    mealTypes: ['lunch'],
    description: 'Classic hard-boiled egg salad on bread, with a little crunch from celery.',
    ingredients: [
      {
        id: 'i1',
        name: 'Eggs',
        emoji: '🥚',
        quantity: '4, hard-boiled',
        itemId: 'eggs',
        requiredAmount: 4,
        requiredUnit: 'count',
      },
      // Bread's stock model tracks whole loaves, not slices — see
      // breakfast.ts's fried-egg-toast for the same reasoning.
      { id: 'i2', name: 'Bread', emoji: '🍞', quantity: '2 slices', itemId: 'bread' },
      // A jar of mayonnaise varies too much in size for "2 tbsp" to
      // honestly map to a fill fraction.
      { id: 'i3', name: 'Mayonnaise', emoji: '🥪', quantity: '2 tbsp', itemId: 'mayonnaise' },
      // A single stalk out of a whole bunch isn't a clean quarter-step
      // fraction of the divisible unit — left unstructured.
      { id: 'i4', name: 'Celery', emoji: '🥬', quantity: '1 stalk, diced', itemId: 'celery', optional: true },
    ],
    steps: [
      { instruction: 'Boil the eggs, then cool and peel.', timerMinutes: 10 },
      { instruction: 'Chop the eggs and mash lightly with a fork.' },
      { instruction: 'Stir in mayonnaise and celery if using.' },
      { instruction: 'Season with salt and pepper, then spread onto bread.' },
    ],
  },
  {
    id: 'chicken-black-bean-burrito-bowl',
    name: 'Chicken & Black Bean Burrito Bowl',
    emoji: '🌯',
    time: 25,
    effortLabel: 'Easy',
    effort: 'Normal',
    tags: ['comforting'],
    mealTypes: ['lunch', 'dinner'],
    description: 'A build-your-own bowl of seared chicken, black beans, and rice.',
    ingredients: [
      {
        id: 'i1',
        name: 'Chicken breast',
        emoji: '🍗',
        quantity: '1 piece, diced',
        itemId: 'chicken-breast',
        requiredAmount: 1,
        requiredUnit: 'count',
      },
      {
        id: 'i2',
        name: 'Rice',
        emoji: '🍚',
        quantity: '1 cup, cooked',
        itemId: 'rice',
        // Same coarse staple-level scale as chicken-and-rice's rice.
        requiredAmount: 2,
        requiredUnit: 'level',
      },
      {
        id: 'i3',
        name: 'Black beans',
        emoji: '🫘',
        quantity: '1 can, drained',
        itemId: 'black-beans',
        requiredAmount: 1,
        requiredUnit: 'count',
      },
      // Half an avocado isn't a whole-unit count — the count field only
      // represents whole avocados, so this stays unstructured.
      { id: 'i4', name: 'Avocado', emoji: '🥑', quantity: '½, sliced', itemId: 'avocado', optional: true },
      { id: 'i5', name: 'Cilantro', emoji: '🌿', quantity: '2 tbsp, chopped', itemId: 'cilantro', optional: true },
      { id: 'i6', name: 'Lime', emoji: '🍈', quantity: '1, wedged', itemId: 'lime', optional: true },
    ],
    steps: [
      { instruction: 'Season and sear the chicken until cooked through, then dice.', timerMinutes: 8 },
      { instruction: 'Warm the rice and black beans.' },
      { instruction: 'Build bowls with rice, beans, and chicken.' },
      { instruction: 'Top with avocado, cilantro, and a squeeze of lime.' },
    ],
  },
  {
    id: 'bean-cheese-quesadilla',
    name: 'Bean & Cheese Quesadilla',
    emoji: '🫓',
    time: 10,
    effortLabel: 'Easy',
    effort: 'Bare minimum',
    tags: ['quick', 'vegetarian', 'cheap'],
    mealTypes: ['lunch', 'snack'],
    description: 'A crisp, cheesy quesadilla you can put together in ten minutes.',
    ingredients: [
      {
        id: 'i1',
        name: 'Tortillas',
        emoji: '🫓',
        quantity: '2',
        itemId: 'tortillas',
        requiredAmount: 2,
        requiredUnit: 'count',
      },
      // Half a can isn't a whole count — left unstructured.
      { id: 'i2', name: 'Black beans', emoji: '🫘', quantity: '½ can, drained', itemId: 'black-beans' },
      { id: 'i3', name: 'Cheddar', emoji: '🧀', quantity: '½ cup, shredded', itemId: 'cheddar' },
    ],
    steps: [
      { instruction: 'Mash the black beans lightly.' },
      { instruction: 'Spread beans and cheese over one tortilla, top with the second.' },
      { instruction: 'Cook in a dry pan until golden and the cheese melts, flipping once.', timerMinutes: 6 },
      { instruction: 'Slice into wedges and serve.' },
    ],
  },
  {
    id: 'chickpea-salad-sandwich',
    name: 'Chickpea Salad Sandwich',
    emoji: '🥪',
    time: 10,
    effortLabel: 'Easy',
    effort: 'Bare minimum',
    tags: ['vegetarian', 'quick'],
    mealTypes: ['lunch'],
    description: 'A meatless take on egg salad, built from mashed chickpeas.',
    ingredients: [
      {
        id: 'i1',
        name: 'Chickpeas',
        emoji: '🫘',
        quantity: '1 can, drained',
        itemId: 'chickpeas',
        requiredAmount: 1,
        requiredUnit: 'count',
      },
      { id: 'i2', name: 'Bread', emoji: '🍞', quantity: '2 slices', itemId: 'bread' },
      { id: 'i3', name: 'Mayonnaise', emoji: '🥪', quantity: '2 tbsp', itemId: 'mayonnaise' },
      { id: 'i4', name: 'Lemon', emoji: '🍋', quantity: 'squeeze of', itemId: 'lemon', optional: true },
    ],
    steps: [
      { instruction: 'Mash the chickpeas with a fork, leaving some texture.' },
      { instruction: 'Stir in mayonnaise and a squeeze of lemon.' },
      { instruction: 'Season with salt and pepper, then spread onto bread.' },
    ],
  },
]
