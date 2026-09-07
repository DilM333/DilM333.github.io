import type { KitchenItem } from '../data/types'

/**
 * How much Euko can trust that its *stored* stock for an item still matches
 * reality right now. This is confidence in an observation, NOT a statement
 * about the food itself:
 *
 *   - 'low' does NOT mean the item is out, spoiled, or unsafe.
 *   - 'low' only means Euko hasn't had recent contact with the item, so the
 *     stored quantity has had time to drift — things get used, topped up, or
 *     moved without being logged in an approximate kitchen.
 *   - Not having seen an item lately is never proof it's gone. Missing an
 *     update makes Euko less certain, never useless.
 *
 * Freshness / "use soon" / spoilage is a separate concern on a different axis
 * and is deliberately NOT modelled here (lib/kitchen.ts's isUseSoon is that
 * other concept, and stays independent of this one).
 *
 * Derived from existing metadata at read time. Never mutates stored stock,
 * never deletes anything, and nothing in the app schedules work as time passes.
 */
export type InventoryConfidence = 'high' | 'medium' | 'low'

/**
 * How quickly an item's stored quantity tends to drift out of sync with
 * reality between observations — i.e. how fast Euko's *knowledge* goes stale,
 * not how fast the food spoils.
 *
 *   fast     - consumed often in small, easily-unlogged amounts, or bought in
 *              small quantities that run out quickly (milk, eggs, fresh herbs).
 *   moderate - used deliberately, item by item, and you'd usually notice when
 *              one is gone (most produce — including long-keepers like onions,
 *              potatoes, carrots, apples — and packaged meat). Also the
 *              default for anything uncategorised.
 *   slow     - low turnover; the stored level stays about right for a long
 *              time (pantry staples, seasonings, grains, frozen).
 */
export type DriftClass = 'fast' | 'moderate' | 'slow'

const MS_PER_DAY = 86_400_000

/**
 * Days-since-last-observation bounds per drift class: at or below `highMaxDays`
 * confidence is 'high', at or below `mediumMaxDays' it's 'medium', older is
 * 'low'.
 *
 * Deliberately conservative and coarse — a long-keeping vegetable you simply
 * haven't touched in three weeks should still read 'high'. These are the only
 * numbers to tune; keep them here rather than scattering age math around.
 */
export const CONFIDENCE_THRESHOLDS: Record<
  DriftClass,
  { highMaxDays: number; mediumMaxDays: number }
> = {
  fast: { highMaxDays: 10, mediumMaxDays: 30 },
  moderate: { highMaxDays: 21, mediumMaxDays: 60 },
  slow: { highMaxDays: 60, mediumMaxDays: 150 },
}

/**
 * Category -> drift class. Keys match the category strings actually used across
 * data/catalog.ts and data/seed.ts. Anything not listed falls back to
 * 'moderate' (see `driftClassFor`).
 */
const CATEGORY_DRIFT_CLASS: Record<string, DriftClass> = {
  Dairy: 'fast',
  Herbs: 'fast',

  Meat: 'moderate',
  Produce: 'moderate',
  Seafood: 'moderate',

  Pantry: 'slow',
  'Pantry staple': 'slow',
  Seasonings: 'slow',
  Grains: 'slow',
  Frozen: 'slow',
}

/**
 * The drift class Euko uses for an item. A `staple` stock type is always
 * 'slow' — staples are coarse-tracked things you keep on hand, so their stored
 * level going a while without an update says very little. Otherwise the
 * category decides, defaulting to 'moderate' for unknown categories (neither
 * over-trusting nor alarmist).
 */
export function driftClassFor(item: KitchenItem): DriftClass {
  if (item.stockType === 'staple') return 'slow'
  return CATEGORY_DRIFT_CLASS[item.category] ?? 'moderate'
}

/**
 * Whole days since Euko last had real contact with this item, using whichever
 * signal is *more recent*:
 *   - `updatedAt` — stamped immediately on any explicit local stock write
 *     (add, restock, adjust, reserve, post-cook confirm) and refreshed from
 *     Supabase `kitchen_items.updated_at` on sync. The primary "last observed"
 *     signal.
 *   - `daysSincePurchase` — reset to 0 on add/restock, otherwise grows from
 *     the row's `created_at` on sync. A weaker fallback.
 *
 * Neither present (a brand-new local item) -> 0: absence of a timestamp is
 * treated as "just observed", never as stale. Future timestamps (clock skew)
 * clamp to 0.
 */
export function daysSinceObserved(item: KitchenItem, now: number = Date.now()): number {
  const candidates: number[] = []

  if (item.updatedAt) {
    const parsed = Date.parse(item.updatedAt)
    if (!Number.isNaN(parsed)) {
      candidates.push(Math.max(0, Math.floor((now - parsed) / MS_PER_DAY)))
    }
  }

  if (typeof item.daysSincePurchase === 'number' && Number.isFinite(item.daysSincePurchase)) {
    candidates.push(Math.max(0, Math.floor(item.daysSincePurchase)))
  }

  if (candidates.length === 0) return 0
  return Math.min(...candidates)
}

/**
 * Euko's confidence that its stored stock for `item` still matches reality.
 * Pure and side-effect free; call it wherever confidence is needed rather than
 * recomputing ages in components.
 */
export function inventoryConfidence(
  item: KitchenItem,
  now: number = Date.now(),
): InventoryConfidence {
  const age = daysSinceObserved(item, now)
  const { highMaxDays, mediumMaxDays } = CONFIDENCE_THRESHOLDS[driftClassFor(item)]
  if (age <= highMaxDays) return 'high'
  if (age <= mediumMaxDays) return 'medium'
  return 'low'
}
