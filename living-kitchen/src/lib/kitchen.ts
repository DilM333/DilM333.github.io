import { catalog, findEntryByExactName } from '../data/catalog'
import type { Feasibility, KitchenItem, Recipe, RecipeIngredient, RequiredUnit, StapleLevel, StockType } from '../data/types'

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

// ---------------------------------------------------------------------------
// Substitute-aware ingredient resolution — the canonical exact/substitute/
// missing engine, conceptually owned by lib/recipeMatch.ts (which re-exports
// everything below). It's implemented here instead because it needs
// `itemHasStock`, and recipeMatch.ts already imports that *from* this file —
// defining it there and importing it back here would create a circular
// module dependency. `ingredientStatus`/`computeFeasibility` below use it
// directly (no import needed, same file) so there is exactly one resolution
// implementation, not two.
// ---------------------------------------------------------------------------

export type IngredientMatchKind = 'exact' | 'substitute' | 'missing'

/**
 * Coarse ordinal scale for a staple's `level` — lets a structured "level"
 * requirement be compared with plain integer arithmetic instead of pretending
 * a fake decimal precision the stock model was never meant to support.
 */
export const STAPLE_LEVEL_RANK: Record<StapleLevel, number> = { out: 0, low: 1, some: 2, plenty: 3 }

/**
 * A kitchen item's usable amount for structured quantity comparison — its
 * raw stock, reduced by whatever proportion is reserved (`KitchenItem.reserved`,
 * unchanged 0..1 meaning: e.g. 6 count with reserved 1/3 -> usable 4).
 * Staple is the one exception: there's no continuous amount to reserve a
 * proportion *of*, so a reservation there conservatively drops the effective
 * level by one tier instead — the same "reservation makes it read as less
 * available" intent as the other stock types, without inventing a fake
 * fractional level.
 */
export function usableAmount(item: KitchenItem): number {
  const reservedFraction = item.reserved ?? 0
  switch (item.stockType) {
    case 'countable':
      return (item.count ?? 0) * (1 - reservedFraction)
    case 'divisible':
      return (item.fraction ?? 0) * (1 - reservedFraction)
    case 'container':
      return (item.fill ?? 0) * (1 - reservedFraction)
    case 'staple': {
      const rank = STAPLE_LEVEL_RANK[item.level ?? 'out']
      return reservedFraction > 0 ? Math.max(0, rank - 1) : rank
    }
    default:
      return 0
  }
}

export type QuantityStatus = 'enough' | 'partial' | 'none' | 'unknown'

const REQUIRED_UNIT_STOCK_TYPE: Record<RequiredUnit, StockType> = {
  count: 'countable',
  fraction: 'divisible',
  fill: 'container',
  level: 'staple',
}

/**
 * Compares a resolved kitchen item's usable amount against a recipe
 * ingredient's structured requirement, if one was seeded. 'unknown' means no
 * `requiredAmount`/`requiredUnit` exists for this ingredient — callers must
 * treat that as "fall back to plain presence/absence," never as insufficient
 * on its own. Also 'unknown' if the requirement's unit doesn't match the
 * resolved item's stock type (e.g. a requirement authored for a countable
 * item resolving to a container substitute) — comparing across incompatible
 * scales would be worse than not comparing at all.
 */
export function quantityStatus(ingredient: RecipeIngredient, item: KitchenItem): QuantityStatus {
  const { requiredAmount, requiredUnit } = ingredient
  if (requiredAmount == null || requiredUnit == null) return 'unknown'
  if (REQUIRED_UNIT_STOCK_TYPE[requiredUnit] !== item.stockType) return 'unknown'

  const usable = usableAmount(item)
  if (usable <= 1e-9) return 'none'
  if (usable + 1e-9 >= requiredAmount) return 'enough'
  return 'partial'
}

export interface IngredientMatch {
  ingredient: RecipeIngredient
  kind: IngredientMatchKind
  /** The kitchen item that satisfied this ingredient, if any. */
  matchedItem?: KitchenItem
  /** Set only when kind === 'substitute': the original itemId it stood in for. */
  substitutedFor?: string
  /** 'unknown' whenever no structured requirement was seeded for this ingredient. */
  quantity: QuantityStatus
}

function stockedItem(id: string, items: KitchenItem[]): KitchenItem | undefined {
  const item = items.find((i) => i.id === id)
  return item && itemHasStock(item) ? item : undefined
}

/**
 * Resolves one recipe ingredient against the current kitchen, in order:
 *
 *   A. the exact itemId, if it's in stock
 *   B. (only when A fails and the ingredient has an itemId) an explicit,
 *      catalog-approved substitute for that itemId, if one is in stock —
 *      never a same-family item that isn't explicitly listed
 *   C. (only when there's no itemId at all) the pre-existing
 *      case/whitespace-insensitive name fallback, unchanged
 *
 * This is the substitute-aware sibling of `findItem`/`findMatchingKitchenItem`
 * — use this wherever a same-family stand-in should be allowed to count.
 */
export function matchIngredient(ingredient: RecipeIngredient, items: KitchenItem[]): IngredientMatch {
  if (ingredient.itemId) {
    // Exact identity always wins over a substitute whenever it has any raw
    // stock at all — quantity never changes *which* item is preferred, only
    // how that resolved item's `quantity` is reported (see quantityStatus).
    const exact = stockedItem(ingredient.itemId, items)
    if (exact) return { ingredient, kind: 'exact', matchedItem: exact, quantity: quantityStatus(ingredient, exact) }

    const entry = catalog.find((c) => c.id === ingredient.itemId)
    for (const substituteId of entry?.substitutes ?? []) {
      const substitute = stockedItem(substituteId, items)
      if (substitute) {
        return {
          ingredient,
          kind: 'substitute',
          matchedItem: substitute,
          substitutedFor: ingredient.itemId,
          quantity: quantityStatus(ingredient, substitute),
        }
      }
    }
    return { ingredient, kind: 'missing', quantity: 'none' }
  }

  const nameLower = ingredient.name.trim().toLowerCase()
  let named = items.find((i) => i.name.trim().toLowerCase() === nameLower)
  if (!named) {
    // The literal ingredient text and a kitchen item's stored name (always a
    // catalog entry's *canonical* name — see toKitchenItem) can refer to the
    // same real ingredient without being the same string, e.g. a recipe
    // written as "Tomatoes" vs the catalog's canonical "Tomato". Resolve
    // through the catalog's own curated alias list (exact tiers only, never
    // a substring guess) before concluding this ingredient is missing.
    const canonicalEntry = findEntryByExactName(ingredient.name)
    if (canonicalEntry) {
      named = items.find((i) => i.name.trim().toLowerCase() === canonicalEntry.name.trim().toLowerCase())
    }
  }
  if (named && itemHasStock(named)) {
    return { ingredient, kind: 'exact', matchedItem: named, quantity: quantityStatus(ingredient, named) }
  }
  return { ingredient, kind: 'missing', quantity: 'none' }
}

export type IngredientStatus = 'ok' | 'low' | 'missing'

/**
 * Fine-grained status for one ingredient — 'ok'/'low' distinguish *how well*
 * something is stocked (quantity, reservations), on top of whatever kitchen
 * item `matchIngredient` resolved to (exact or an approved substitute).
 * Resolution itself is fully delegated to `matchIngredient`, so this is
 * never a second, disagreeing definition of "does this ingredient count as
 * available" — only exact/substitute/missing determines that.
 *
 * When a structured `requiredAmount`/`requiredUnit` was seeded, that real
 * usable-vs-required comparison supersedes the coarser heuristics below
 * entirely (a "partial" match is 'low', "none" — e.g. fully reserved — is
 * 'missing', "enough" is 'ok'). Ingredients with no structured requirement
 * (the vast majority, unchanged in this phase) fall through to exactly the
 * same reservation/parsed-quantity heuristics as before Phase 2.
 */
export function ingredientStatus(
  ingredient: RecipeIngredient,
  items: KitchenItem[],
): IngredientStatus {
  const match = matchIngredient(ingredient, items)
  if (match.kind === 'missing') return 'missing'
  const item = match.matchedItem!

  if (match.quantity !== 'unknown') {
    if (match.quantity === 'none') return 'missing'
    if (match.quantity === 'partial') return 'low'
    return 'ok'
  }

  const reserved = item.reserved ?? 0

  switch (item.stockType) {
    case 'countable': {
      const count = item.count ?? 0
      const needed = parseInt(ingredient.quantity, 10)
      if (!Number.isNaN(needed) && count < needed) return 'low'
      return 'ok'
    }
    case 'divisible': {
      if (reserved > 0) return 'low'
      return 'ok'
    }
    case 'container': {
      const fill = item.fill ?? 0
      if (fill < 0.45 || reserved > 0) return 'low'
      return 'ok'
    }
    case 'staple': {
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

/**
 * Readiness mapping (explicit, no invented percentage thresholds — every
 * branch below is a discrete ingredient count):
 *
 *   ready           - no required-ingredient problems at all: nothing
 *                     missing, nothing quantitatively short, no substitute
 *                     used, no old-style low/reserved flag.
 *   ready-adjusted  - no required-ingredient problems, but at least one
 *                     required ingredient used an approved substitute, or an
 *                     ingredient with no structured requirement tripped the
 *                     pre-existing coarse "low" heuristic (reservation /
 *                     parsed-quantity-vs-count) — this is the exact
 *                     pre-Phase-2 condition, unchanged.
 *   almost          - either an optional ingredient is missing, or exactly
 *                     one *required* ingredient has a structured requirement
 *                     that's quantitatively short (present, just not enough)
 *                     with nothing else wrong — "near-complete", reusing the
 *                     existing 'almost' status rather than inventing a new one.
 *   one-away        - exactly one required-ingredient "problem" overall
 *                     (fully missing, or 100% reserved so nothing usable —
 *                     see usableAmount), and it isn't the almost case above.
 *   needs-shopping  - two or more required-ingredient problems (missing
 *                     and/or quantitatively short combined) — this is the one
 *                     explicit threshold in this function: "problems >= 2".
 */
export function computeFeasibility(recipe: Recipe, items: KitchenItem[]): FeasibilityResult {
  const missing: RecipeIngredient[] = []
  const low: RecipeIngredient[] = []
  // Only a *required* ingredient resolved via an approved substitute should
  // ever push a recipe to 'ready-adjusted' — an optional ingredient's
  // substitute must never be enough on its own (it doesn't even reach this
  // loop's missing/low bookkeeping either way, since optional ingredients
  // don't affect scoring).
  let hasRequiredSubstitution = false
  // Required ingredients with a structured requirement that's short but not
  // zero (quantity === 'partial') — distinct from `low`, which also catches
  // the older, coarser non-structured heuristic and isn't specific enough on
  // its own to tell "almost" and "ready-adjusted" apart.
  const requiredQuantityPartial: RecipeIngredient[] = []

  for (const ingredient of recipe.ingredients) {
    const status = ingredientStatus(ingredient, items)
    if (status === 'missing') missing.push(ingredient)
    else if (status === 'low') low.push(ingredient)

    if (!ingredient.optional && status !== 'missing') {
      const match = matchIngredient(ingredient, items)
      if (match.kind === 'substitute') hasRequiredSubstitution = true
      if (match.quantity === 'partial') requiredQuantityPartial.push(ingredient)
    }
  }

  const requiredMissing = missing.filter((m) => !m.optional)
  const optionalMissing = missing.filter((m) => m.optional)
  // "requiredMissing" already includes a required ingredient whose structured
  // quantity came back 'none' (e.g. fully reserved) — ingredientStatus maps
  // that to 'missing' too, so it's functionally the same "zero usable" case
  // as never having it at all.
  const requiredProblems = requiredMissing.length + requiredQuantityPartial.length

  let status: Feasibility
  if (requiredProblems === 0) {
    if (optionalMissing.length > 0) {
      status = 'almost'
    } else if (low.length > 0 || hasRequiredSubstitution) {
      status = 'ready-adjusted'
    } else {
      status = 'ready'
    }
  } else if (requiredProblems === 1) {
    status = requiredMissing.length === 0 ? 'almost' : 'one-away'
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
