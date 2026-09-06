import type { Feasibility, KitchenItem, Recipe, RecipeIngredient } from '../data/types'

export function findItem(items: KitchenItem[], id?: string) {
  if (!id) return undefined
  return items.find((i) => i.id === id)
}

/** Whole-unit part of a divisible item's total quantity, e.g. wholeOf(1.5) === 1. */
export function wholeOf(total: number): number {
  return Math.max(0, Math.floor(total + 1e-9))
}

/**
 * Quarter-step remainder of a divisible item's total quantity, snapped to one
 * of 0/.25/.5/.75 to absorb float drift, e.g. fracPartOf(1.5) === 0.5.
 */
export function fracPartOf(total: number): number {
  const remainder = Math.max(0, total) - wholeOf(total)
  const snapped = Math.round(remainder * 4) / 4
  return snapped >= 1 ? 0 : snapped
}

/** Label for just a quarter-step value (0/¼/½/¾/1) — used for the remainder picker buttons. */
export function quarterGlyph(fraction: number): string {
  if (fraction <= 0) return '0'
  if (fraction <= 0.26) return '¼'
  if (fraction <= 0.51) return '½'
  if (fraction <= 0.76) return '¾'
  return '1'
}

/** Full display label for a divisible item's total quantity, e.g. "1 ½", "2", "Out". */
export function fractionLabel(total: number) {
  if (total <= 0) return 'Out'
  const whole = wholeOf(total)
  const frac = fracPartOf(total)
  if (whole <= 0) return quarterGlyph(frac)
  return frac > 0 ? `${whole} ${quarterGlyph(frac)}` : `${whole}`
}

export function levelLabel(level: string) {
  switch (level) {
    case 'plenty':
      return 'Plenty'
    case 'some':
      return 'Some'
    case 'low':
      return 'Low'
    default:
      return 'Out'
  }
}

export function itemDisplayAmount(item: KitchenItem): string {
  switch (item.stockType) {
    case 'countable':
      return `${item.count ?? 0}`
    case 'divisible':
      return fractionLabel(item.fraction ?? 0)
    case 'container':
      return fillLabel(item.fill ?? 0)
    case 'staple':
      return levelLabel(item.level ?? 'out')
    default:
      return ''
  }
}

export function fillLabel(fill: number) {
  if (fill <= 0.05) return 'Empty'
  if (fill <= 0.35) return 'About ¼'
  if (fill <= 0.6) return 'About ½'
  if (fill <= 0.85) return 'About ¾'
  return 'Full'
}

export function isUseSoon(item: KitchenItem) {
  return (item.daysSincePurchase ?? 0) >= 5 && itemHasStock(item)
}

export function itemHasStock(item: KitchenItem): boolean {
  switch (item.stockType) {
    case 'countable':
      return (item.count ?? 0) > 0
    case 'divisible':
      return (item.fraction ?? 0) > 0
    case 'container':
      return (item.fill ?? 0) > 0
    case 'staple':
      return item.level !== 'out'
    default:
      return false
  }
}

/** Coarse stock level of a single item, independent of any recipe. */
export function stockLevel(item: KitchenItem): 'out' | 'low' | 'ok' {
  switch (item.stockType) {
    case 'countable': {
      const c = item.count ?? 0
      if (c <= 0) return 'out'
      return c <= 1 ? 'low' : 'ok'
    }
    case 'divisible': {
      const f = item.fraction ?? 0
      if (f <= 0) return 'out'
      return f <= 0.25 ? 'low' : 'ok'
    }
    case 'container': {
      const fill = item.fill ?? 0
      if (fill <= 0.05) return 'out'
      return fill < 0.35 ? 'low' : 'ok'
    }
    case 'staple': {
      if (item.level === 'out') return 'out'
      return item.level === 'low' ? 'low' : 'ok'
    }
    default:
      return 'ok'
  }
}

export type IngredientStatus = 'ok' | 'low' | 'missing'

export function ingredientStatus(
  ingredient: RecipeIngredient,
  items: KitchenItem[],
): IngredientStatus {
  const item = findItem(items, ingredient.itemId)
  if (!item) return 'missing'

  const reserved = item.reserved ?? 0

  switch (item.stockType) {
    case 'countable': {
      const count = item.count ?? 0
      if (count <= 0) return 'missing'
      const needed = parseInt(ingredient.quantity, 10)
      if (!Number.isNaN(needed) && count < needed) return 'low'
      return 'ok'
    }
    case 'divisible': {
      const fraction = item.fraction ?? 0
      if (fraction <= 0) return 'missing'
      if (reserved > 0) return 'low'
      return 'ok'
    }
    case 'container': {
      const fill = item.fill ?? 0
      if (fill <= 0) return 'missing'
      if (fill < 0.45 || reserved > 0) return 'low'
      return 'ok'
    }
    case 'staple': {
      if (item.level === 'out') return 'missing'
      if (item.level === 'low' || reserved > 0) return 'low'
      return 'ok'
    }
    default:
      return 'missing'
  }
}

export interface FeasibilityResult {
  status: Feasibility
  missing: RecipeIngredient[]
  low: RecipeIngredient[]
}

export function computeFeasibility(recipe: Recipe, items: KitchenItem[]): FeasibilityResult {
  const missing: RecipeIngredient[] = []
  const low: RecipeIngredient[] = []

  for (const ingredient of recipe.ingredients) {
    const status = ingredientStatus(ingredient, items)
    if (status === 'missing') missing.push(ingredient)
    else if (status === 'low') low.push(ingredient)
  }

  const requiredMissing = missing.filter((m) => !m.optional)
  const optionalMissing = missing.filter((m) => m.optional)

  let status: Feasibility
  if (requiredMissing.length === 0 && optionalMissing.length === 0) {
    status = low.length > 0 ? 'ready-adjusted' : 'ready'
  } else if (requiredMissing.length === 0 && optionalMissing.length > 0) {
    status = 'almost'
  } else if (requiredMissing.length === 1) {
    status = 'one-away'
  } else {
    status = 'needs-shopping'
  }

  return { status, missing, low }
}

export const feasibilityMeta: Record<
  Feasibility,
  { label: string; color: string; dot: string }
> = {
  ready: { label: 'Ready', color: 'text-leaf', dot: '🟢' },
  'ready-adjusted': { label: 'Ready with adjustment', color: 'text-leaf', dot: '🟢' },
  almost: { label: 'Almost', color: 'text-butter', dot: '🟡' },
  'one-away': { label: 'One item away', color: 'text-butter', dot: '🟡' },
  'needs-shopping': { label: 'Needs shopping', color: 'text-clay', dot: '🔴' },
}
