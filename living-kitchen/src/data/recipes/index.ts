import type { Recipe } from '../types'
import { breakfastRecipes } from './breakfast'
import { lunchRecipes } from './lunch'
import { dinnerRecipes } from './dinner'
import { snackRecipes } from './snacks'
import { dessertRecipes } from './desserts'
import { sideRecipes } from './sides'

/**
 * The full recipe library, flattened. This is the one thing consumers should
 * import — data/seed.ts re-exports it as `seedRecipes` so
 * store/useKitchenStore.ts and every screen/matching module needs no change.
 * Per-file grouping above is an authoring/organization convenience only (by
 * each recipe's *primary* mealTypes entry); a recipe's actual categorization
 * for "What can I make?" etc. is its own `mealTypes` array, not which file it
 * lives in.
 */
export const recipes: Recipe[] = [
  ...breakfastRecipes,
  ...lunchRecipes,
  ...dinnerRecipes,
  ...snackRecipes,
  ...dessertRecipes,
  ...sideRecipes,
]
