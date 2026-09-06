import { findItem, itemHasStock } from '../lib/kitchen'
import type { KitchenItem, RecipeIngredient } from './types'

export interface SubOption {
  name: string
  emoji: string
  /** how much to use, e.g. "1:1" or "¾ cup per cup" */
  ratio: string
  /** short extra tip */
  note?: string
  /** catalog id, so we can flag when it's already in the kitchen */
  itemId?: string
}

export interface Guidance {
  substitutes: SubOption[]
  /** what to do if you leave it out entirely */
  skipNote: string
  /** what to do to make a low / partial amount work */
  stretchNote: string
}

const GENERIC: Guidance = {
  substitutes: [],
  skipNote:
    'Leave it out and taste as you go — adjust the seasoning at the end to make up for what is missing.',
  stretchNote:
    'Use what you have, cut it a little smaller so it spreads across every plate, and round the meal out with a simple side.',
}

/** Keyed by catalog itemId first, then by lowercased ingredient name as a fallback. */
const GUIDANCE: Record<string, Partial<Guidance>> = {
  'chicken-breast': {
    substitutes: [
      { name: 'Chicken thighs', emoji: '🍗', ratio: '1:1', note: 'Juicier — give them 2–3 extra minutes.' },
      { name: 'Tofu', emoji: '🧊', ratio: '1:1', note: 'Press and pat dry before searing.', itemId: 'tofu' },
      { name: 'Chickpeas', emoji: '🫘', ratio: '1 can ≈ 1 breast', note: 'Drain well and sear for colour.' },
    ],
    skipNote:
      'Go meatless tonight — double the vegetables and stir in beans or extra cheese so the plate still has substance.',
    stretchNote:
      'Slice the chicken thin and fan it over each plate; bulk the meal with extra potatoes or greens so the gap is invisible.',
  },
  potatoes: {
    substitutes: [
      { name: 'Sweet potato', emoji: '🍠', ratio: '1:1', note: 'Sweeter and cooks a bit faster.' },
      { name: 'Rice', emoji: '🍚', ratio: 'serve over rice', itemId: 'rice' },
      { name: 'Pasta', emoji: '🍝', ratio: 'serve alongside', itemId: 'pasta' },
      { name: 'Carrots', emoji: '🥕', ratio: 'roast in their place', itemId: 'carrots' },
    ],
    skipNote:
      'Serve the mains over rice or with bread instead — you just need some kind of starch on the plate.',
    stretchNote:
      'Cut what you have smaller so every plate gets a few pieces, then add a quick salad or bread to fill things out.',
  },
  parsley: {
    substitutes: [
      { name: 'Cilantro', emoji: '🌿', ratio: '1:1', itemId: 'cilantro' },
      { name: 'Basil', emoji: '🌿', ratio: '1:1', itemId: 'basil' },
      { name: 'Green onion tops', emoji: '🌱', ratio: '1:1', itemId: 'green-onion' },
      { name: 'Dried parsley', emoji: '🧂', ratio: '1 tsp dried per 1 tbsp fresh' },
    ],
    skipNote:
      'It is only a garnish here — leave it off, or finish the dish with a little lemon zest for freshness.',
    stretchNote: 'Use what you have as the final garnish rather than chopping it through the whole dish.',
  },
  'olive-oil': {
    substitutes: [
      { name: 'Butter', emoji: '🧈', ratio: '1:1', itemId: 'butter' },
      { name: 'Any neutral oil', emoji: '🛢️', ratio: '1:1', note: 'Vegetable, canola or sunflower.' },
    ],
    skipNote:
      'You need some fat to cook in — a knob of butter, or a nonstick pan with a splash of water, will get you there.',
    stretchNote: 'Use a nonstick pan and add just a teaspoon where it counts most, like the initial sear.',
  },
  salt: {
    substitutes: [
      { name: 'Soy sauce', emoji: '🍶', ratio: '¼ tsp per pinch of salt', itemId: 'soy-sauce' },
      { name: 'Parmesan', emoji: '🧀', ratio: 'grate in to finish', itemId: 'parmesan' },
    ],
    skipNote: 'Season at the table instead so nothing ends up under-seasoned in the pot.',
    stretchNote: 'Salt in thin layers as you cook rather than all at once — a little lands further that way.',
  },
  rice: {
    substitutes: [
      { name: 'Quinoa', emoji: '🌾', ratio: '1:1', itemId: 'quinoa' },
      { name: 'Orzo', emoji: '🍝', ratio: '1:1', itemId: 'orzo' },
      { name: 'Any cooked grain', emoji: '🌾', ratio: '1:1', note: 'Couscous, barley, farro…' },
    ],
    skipNote: 'Serve it as a lettuce wrap or with bread — or just eat it as a bowl on its own.',
    stretchNote: 'Stretch cooked rice with extra vegetables or a scrambled egg so it still serves everyone.',
  },
  eggs: {
    substitutes: [
      { name: 'Greek yogurt', emoji: '🥣', ratio: '¼ cup per egg', note: 'Baking only.', itemId: 'greek-yogurt' },
      { name: 'Flax egg', emoji: '🌾', ratio: '1 tbsp ground flax + 3 tbsp water', note: 'Rest 5 min.' },
      { name: 'Extra oil + splash of water', emoji: '🛢️', ratio: 'per egg', note: 'For frying / binding.' },
    ],
    skipNote: 'Skip it and lean on soy sauce and extra vegetables for the savoury note — still great.',
    stretchNote: 'Beat one egg with a splash of water or milk so it reads like two in the pan.',
  },
  carrots: {
    substitutes: [
      { name: 'Bell pepper', emoji: '🫑', ratio: '1:1', itemId: 'bell-pepper' },
      { name: 'Zucchini', emoji: '🥒', ratio: '1:1', itemId: 'zucchini' },
      { name: 'Frozen peas', emoji: '🟢', ratio: '1:1', itemId: 'frozen-peas' },
    ],
    skipNote: 'Just leave them out — lean on the onion and corn, or toss in a handful of frozen peas.',
    stretchNote: 'Dice what you have smaller and spread it thin; add peas or corn to make up the volume.',
  },
  corn: {
    substitutes: [
      { name: 'Frozen peas', emoji: '🟢', ratio: '1:1', itemId: 'frozen-peas' },
      { name: 'Diced bell pepper', emoji: '🫑', ratio: '1:1', itemId: 'bell-pepper' },
    ],
    skipNote: 'No problem — it is one of several vegetables here. Add a little more carrot or onion.',
    stretchNote: 'Use what you have plus another chopped vegetable to keep the same total amount.',
  },
  'red-onion': {
    substitutes: [
      { name: 'Yellow or white onion', emoji: '🧅', ratio: '1:1' },
      { name: 'Green onion', emoji: '🌱', ratio: '1:1', itemId: 'green-onion' },
      { name: 'Onion powder', emoji: '🧂', ratio: '¾ tsp per ½ onion' },
    ],
    skipNote: 'Start with a little extra garlic or a pinch of onion powder so the base still has depth.',
    stretchNote: 'Use what is left and top up with green onion or a pinch of onion powder.',
  },
  spinach: {
    substitutes: [
      { name: 'Kale', emoji: '🥬', ratio: '1:1', note: 'Add earlier — it is tougher.' },
      { name: 'Parsley', emoji: '🌿', ratio: 'small handful', itemId: 'parsley' },
      { name: 'Frozen spinach', emoji: '🧊', ratio: '⅓ the volume', note: 'Thaw and squeeze dry.' },
    ],
    skipNote: 'It is optional here — skip it, or stir in any soft green you have right at the end.',
    stretchNote: 'Add what you have at the very end so it wilts but still shows; no need to match the full amount.',
  },
  parmesan: {
    substitutes: [
      { name: 'Cheddar', emoji: '🧀', ratio: '1:1', itemId: 'cheddar' },
      { name: 'Cream cheese', emoji: '🧈', ratio: '2 tbsp for creaminess', itemId: 'cream-cheese' },
      { name: 'Nutritional yeast', emoji: '🌾', ratio: '1 tbsp per ¼ cup' },
    ],
    skipNote: 'Finish with a little butter and extra salt for richness, plus lemon for brightness.',
    stretchNote: 'Grate it fine and stir it in off the heat so a small amount still coats everything.',
  },
  butter: {
    substitutes: [
      { name: 'Olive oil', emoji: '🫒', ratio: '1:1 for cooking', itemId: 'olive-oil' },
      { name: 'Any neutral oil', emoji: '🛢️', ratio: '¾ the amount' },
    ],
    skipNote: 'Cook with olive oil instead — the dish just lands a little lighter.',
    stretchNote: 'Use oil for cooking and save the butter to finish the sauce off the heat.',
  },
  orzo: {
    substitutes: [
      { name: 'Any small pasta', emoji: '🍝', ratio: '1:1', note: 'Ditalini, broken spaghetti…' },
      { name: 'Rice', emoji: '🍚', ratio: '1:1', itemId: 'rice' },
      { name: 'Pearl couscous', emoji: '🌾', ratio: '1:1' },
    ],
    skipNote: 'Serve the sauce over any pasta or rice you do have on hand.',
    stretchNote: 'Cook what you have and add a little more broth and vegetables so it still serves everyone.',
  },
  broth: {
    substitutes: [
      { name: 'Water + bouillon', emoji: '🧊', ratio: '1 cube per 2 cups water' },
      { name: 'Water + soy sauce', emoji: '🍶', ratio: 'splash per cup', itemId: 'soy-sauce' },
    ],
    skipNote: 'Use water and season a little harder — a parmesan rind or bay leaf helps if you have one.',
    stretchNote: 'Top up what you have with water, then taste and add salt to bridge the difference.',
  },
  lemon: {
    substitutes: [
      { name: 'Lime', emoji: '🍈', ratio: '1:1', itemId: 'lime' },
      { name: 'White wine vinegar', emoji: '🍶', ratio: '1 tbsp per lemon' },
    ],
    skipNote: 'Add a splash of vinegar instead — you mainly need the hit of acid to brighten things.',
    stretchNote: 'Zest before juicing and use both; half a lemon of zest carries a lot of flavour.',
  },
  pasta: {
    substitutes: [
      { name: 'Any dry pasta shape', emoji: '🍝', ratio: '1:1' },
      { name: 'Rice', emoji: '🍚', ratio: '1:1', itemId: 'rice' },
      { name: 'Gnocchi', emoji: '🥔', ratio: '1:1' },
    ],
    skipNote: 'Serve the ragù over polenta, mashed potato, or thick toast.',
    stretchNote: 'Cook what you have and add extra sauce and parmesan so the plates still look full.',
  },
  mushrooms: {
    substitutes: [
      { name: 'Zucchini', emoji: '🥒', ratio: '1:1', itemId: 'zucchini' },
      { name: 'Extra onion', emoji: '🧅', ratio: '1:1', itemId: 'red-onion' },
      { name: 'Dried porcini', emoji: '🍄', ratio: '2 tbsp, rehydrated' },
    ],
    skipNote: 'Lean on the onion and a splash of soy sauce for that savoury, roasted note.',
    stretchNote: 'Slice thin and brown them hard — good colour makes a small amount taste like more.',
  },

  // name-keyed fallbacks for ingredients with no catalog item
  'ground beef': {
    substitutes: [
      { name: 'Ground turkey', emoji: '🦃', ratio: '1:1' },
      { name: 'Lentils', emoji: '🫘', ratio: '1 cup dry, cooked, per lb' },
      { name: 'Mushrooms + walnuts', emoji: '🍄', ratio: 'finely chopped, browned' },
    ],
    skipNote: 'Turn it into a marinara — double the vegetables and add a can of beans or lentils for body.',
    stretchNote: 'Brown what you have with finely chopped mushrooms or lentils to roughly double the volume.',
  },
  tomatoes: {
    substitutes: [
      { name: 'Passata or jarred sauce', emoji: '🥫', ratio: '1 cup per can' },
      { name: 'Tomato paste + water', emoji: '🥫', ratio: '2 tbsp paste + 1 cup water per can' },
      { name: 'Fresh tomatoes', emoji: '🍅', ratio: '4–5, chopped, per can', itemId: 'tomato' },
    ],
    skipNote: 'Build the sauce on broth and plenty of aromatics instead — more of a white ragù.',
    stretchNote: 'Stretch what you have with a little tomato paste and water, or a splash of broth.',
  },
  flour: {
    substitutes: [
      { name: 'Cup-for-cup GF blend', emoji: '🌾', ratio: '1:1' },
      { name: 'Cornstarch', emoji: '🌽', ratio: '1 tbsp per 2 tbsp flour', note: 'For thickening only.' },
    ],
    skipNote: 'Only skip where flour is not structural — dusting a pan or lightly thickening a sauce.',
    stretchNote: 'For thickening, cornstarch goes about twice as far — use half as much as the flour called for.',
  },
  sugar: {
    substitutes: [
      { name: 'Honey', emoji: '🍯', ratio: '¾ cup per cup', note: 'Reduce other liquid slightly.', itemId: 'honey' },
      { name: 'Maple syrup', emoji: '🍁', ratio: '¾ cup per cup' },
      { name: 'Brown sugar', emoji: '🍬', ratio: '1:1' },
    ],
    skipNote: 'Cut back rather than omit in baking; for a glaze, a little honey does the job.',
    stretchNote: 'Reduce the sugar by up to a third — most bakes are fine a touch less sweet.',
  },
}

export interface ResolvedSub extends SubOption {
  /** already in the kitchen with stock on hand */
  have: boolean
}

export interface ResolvedGuidance {
  substitutes: ResolvedSub[]
  /** best pick: something you already have, else the closest swap */
  recommended?: ResolvedSub
  skipNote: string
  stretchNote: string
}

export function getGuidance(ing: RecipeIngredient, items: KitchenItem[]): ResolvedGuidance {
  const raw = (ing.itemId && GUIDANCE[ing.itemId]) || GUIDANCE[ing.name.toLowerCase()] || {}
  const merged: Guidance = {
    substitutes: raw.substitutes ?? GENERIC.substitutes,
    skipNote: raw.skipNote ?? GENERIC.skipNote,
    stretchNote: raw.stretchNote ?? GENERIC.stretchNote,
  }

  const substitutes: ResolvedSub[] = merged.substitutes.map((s) => {
    const item = findItem(items, s.itemId)
    return { ...s, have: !!item && itemHasStock(item) }
  })

  const recommended = substitutes.find((s) => s.have) ?? substitutes[0]

  return { substitutes, recommended, skipNote: merged.skipNote, stretchNote: merged.stretchNote }
}
