import type { PostgrestError } from '@supabase/supabase-js'
import { catalog, guessEmoji, slugify, type CatalogEntry } from '../data/catalog'
import { seedKitchen } from '../data/seed'
import type { KitchenItem, Location, StapleLevel, StockType } from '../data/types'
import { isRlsError } from './household'
import { supabase } from '../utils/supabase'

/** Row shape of `public.kitchen_items`. */
export interface KitchenItemRow {
  id: string
  household_id: string
  name: string
  category: string
  stock_type: StockType
  count_value: number | null
  fraction_value: number | null
  fill_value: number | null
  level_value: string | null
  location: Location
  reserved: number | null
  created_at: string
  updated_at: string
}

function describe(action: string, error: PostgrestError, hint: string): string {
  if (isRlsError(error)) return `RLS blocked ${action}. Required policy:\n\n${hint}`
  return `Could not ${action}: ${error.message}`
}

const SELECT_HINT = `create policy "kitchen_items_select_own_household" on public.kitchen_items
  for select to authenticated
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()));`

const INSERT_HINT = `create policy "kitchen_items_insert_own_household" on public.kitchen_items
  for insert to authenticated
  with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));`

const UPDATE_HINT = `create policy "kitchen_items_update_own_household" on public.kitchen_items
  for update to authenticated
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));`

const DELETE_HINT = `create policy "kitchen_items_delete_own_household" on public.kitchen_items
  for delete to authenticated
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()));`

/**
 * Recovers the app-level identity (`id`/`emoji`/`custom`) for a row loaded
 * from Supabase. The DB has no id/emoji columns for these, so matching by
 * name reconstructs the same id a fresh local item would have had, which is
 * what keeps recipe ingredient lookups (`RecipeIngredient.itemId`) working
 * after a sync. Catalog and most seed ingredients use `slugify(name)` as
 * their id, but that's not guaranteed — e.g. seed's "Vegetable broth" is
 * `id: 'broth'`, not `vegetable-broth` — so seedKitchen is checked by name
 * too, before falling back to the slugify guess.
 */
function deriveIdentity(
  name: string,
  category: string,
  customCatalog: CatalogEntry[],
): { id: string; emoji: string; custom?: boolean } {
  const n = name.trim().toLowerCase()
  const fromCustom = customCatalog.find((c) => c.name.toLowerCase() === n)
  if (fromCustom) return { id: fromCustom.id, emoji: fromCustom.emoji, custom: true }
  const fromCatalog = catalog.find((c) => c.name.toLowerCase() === n)
  if (fromCatalog) return { id: fromCatalog.id, emoji: fromCatalog.emoji }
  const fromSeed = seedKitchen.find((item) => item.name.toLowerCase() === n)
  if (fromSeed) return { id: fromSeed.id, emoji: fromSeed.emoji }
  return { id: slugify(name) || `item-${Date.now().toString(36)}`, emoji: guessEmoji(name, category) }
}

export function rowToKitchenItem(row: KitchenItemRow, customCatalog: CatalogEntry[]): KitchenItem {
  const { id, emoji, custom } = deriveIdentity(row.name, row.category, customCatalog)
  const daysSincePurchase = row.created_at
    ? Math.max(0, Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86_400_000))
    : 0

  const item: KitchenItem = {
    id,
    remoteId: row.id,
    name: row.name,
    emoji,
    location: row.location,
    stockType: row.stock_type,
    category: row.category,
    daysSincePurchase,
    custom,
  }
  if (row.stock_type === 'countable') item.count = row.count_value ?? 0
  if (row.stock_type === 'divisible') item.fraction = row.fraction_value ?? 0
  if (row.stock_type === 'container') item.fill = row.fill_value ?? 0
  if (row.stock_type === 'staple') item.level = (row.level_value as StapleLevel | null) ?? 'out'
  if (row.reserved != null && row.reserved > 0) item.reserved = row.reserved
  return item
}

function kitchenItemToRow(item: KitchenItem, householdId: string) {
  return {
    household_id: householdId,
    name: item.name,
    category: item.category,
    stock_type: item.stockType,
    count_value: item.stockType === 'countable' ? item.count ?? 0 : null,
    fraction_value: item.stockType === 'divisible' ? item.fraction ?? 0 : null,
    fill_value: item.stockType === 'container' ? item.fill ?? 0 : null,
    level_value: item.stockType === 'staple' ? item.level ?? 'out' : null,
    location: item.location,
    reserved: item.reserved ?? 0,
  }
}

export interface FetchKitchenResult {
  items: KitchenItem[]
  error?: string
}

/** Loads every kitchen item for the given household. Never queries across households. */
export async function fetchKitchenItems(
  householdId: string,
  customCatalog: CatalogEntry[],
): Promise<FetchKitchenResult> {
  const { data, error } = await supabase
    .from('kitchen_items')
    .select('*')
    .eq('household_id', householdId)

  if (error) return { items: [], error: describe('load your kitchen', error, SELECT_HINT) }
  return { items: (data ?? []).map((row) => rowToKitchenItem(row as KitchenItemRow, customCatalog)) }
}

export interface WriteResult {
  remoteId?: string
  error?: string
}

export async function insertKitchenItem(item: KitchenItem, householdId: string): Promise<WriteResult> {
  const { data, error } = await supabase
    .from('kitchen_items')
    .insert(kitchenItemToRow(item, householdId))
    .select('id')
    .single()

  if (error) return { error: describe('save this item', error, INSERT_HINT) }
  return { remoteId: data?.id }
}

export async function updateKitchenItem(item: KitchenItem, householdId: string): Promise<WriteResult> {
  if (!item.remoteId) return {}
  const { error } = await supabase
    .from('kitchen_items')
    .update(kitchenItemToRow(item, householdId))
    .eq('id', item.remoteId)
    .eq('household_id', householdId)

  if (error) return { error: describe('update this item', error, UPDATE_HINT) }
  return {}
}

export async function deleteKitchenItem(remoteId: string, householdId: string): Promise<WriteResult> {
  const { error } = await supabase
    .from('kitchen_items')
    .delete()
    .eq('id', remoteId)
    .eq('household_id', householdId)

  if (error) return { error: describe('delete this item', error, DELETE_HINT) }
  return {}
}

export interface UploadResult {
  items: KitchenItem[]
  error?: string
}

/**
 * One-time upload of the local kitchen into a household that has none yet.
 * Inserts sequentially (rather than one batch insert) so each returned id
 * can be attached to the exact item it belongs to. Stops on the first
 * failure and returns what succeeded plus the untouched remainder, so the
 * caller can keep using it as the local item list without dropping data.
 */
export async function uploadInitialKitchen(
  items: KitchenItem[],
  householdId: string,
): Promise<UploadResult> {
  const results: KitchenItem[] = []
  for (const item of items) {
    const { remoteId, error } = await insertKitchenItem(item, householdId)
    if (error) return { items: [...results, ...items.slice(results.length)], error }
    results.push(remoteId ? { ...item, remoteId } : item)
  }
  return { items: results }
}
