import type { Recipe } from '../types'

/**
 * Recipes whose primary use is lunch. Empty for now — none of the existing
 * 11 seed recipes has lunch as its *primary* use (several carry lunch as a
 * secondary mealTypes entry instead; see breakfast.ts's loaded-omelet and
 * dinner.ts's veg-fried-rice/mushroom-spinach-orzo/veggie-soup). Populated in
 * a later phase. See data/recipes/index.ts.
 */
export const lunchRecipes: Recipe[] = []
