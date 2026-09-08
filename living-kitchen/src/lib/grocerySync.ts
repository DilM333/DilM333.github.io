import type { PostgrestError } from '@supabase/supabase-js'
import { catalog, guessCategory, guessEmoji, type CatalogEntry } from '../data/catalog'
import type { GroceryItem } from '../data/types'
import { isRlsError } from './household'
import { supabase } from '../utils/supabase'

/** Row shape of `public.grocery_list_items`. No emoji/category/price columns exist. */
export interface GroceryItemRow {
  id: string
  created_at: string
  household_id: string
  name: string
  quantity: number | null
  unit: string | null
  checked: boolean
  reason: string | null
  updated_at: string
}

function describe(action: string, error: PostgrestError, hint: string): string {
  if (isRlsError(error)) return `RLS blocked ${action}. Required policy:\n\n${hint}`
  return `Could not ${action}: ${error.message}`
}

const SELECT_HINT = `create policy "grocery_items_select_own_household" on public.grocery_list_items
  for select to authenticated
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()));`

const INSERT_HINT = `create policy "grocery_items_insert_own_household" on public.grocery_list_items
  for insert to authenticated
  with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));`

const UPDATE_HINT = `create policy "grocery_items_update_own_household" on public.grocery_list_items
  for update to authenticated
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));`

const DELETE_HINT = `create policy "grocery_items_delete_own_household" on public.grocery_list_items
  for delete to authenticated
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()));`

/**
 * `grocery_list_items` has no emoji/category/canonical-id columns, so all
 * three are recovered the same way kitchen_items' identity is: match the
 * name against the catalog/custom catalog first, falling back to the
 * free-typed guessers already used when adding an item by hand (see
 * data/catalog.ts). `itemId` is intentionally best-effort and local-only —
 * there is no column to persist it in yet (see GroceryItem.itemId), so it's
 * reconstructed fresh on every fetch from whatever name is stored. An
 * arbitrary item with no catalog match (e.g. "paper towels") simply gets no
 * itemId, same as it would have client-side.
 */
function deriveCategoryAndEmoji(
  name: string,
  customCatalog: CatalogEntry[],
): { category: string; emoji: string; itemId?: string } {
  const n = name.trim().toLowerCase()
  const fromCustom = customCatalog.find((c) => c.name.toLowerCase() === n)
  if (fromCustom) return { category: fromCustom.category, emoji: fromCustom.emoji, itemId: fromCustom.id }
  const fromCatalog = catalog.find((c) => c.name.toLowerCase() === n)
  if (fromCatalog) return { category: fromCatalog.category, emoji: fromCatalog.emoji, itemId: fromCatalog.id }
  const category = guessCategory(name)
  return { category, emoji: guessEmoji(name, category) }
}

export function rowToGroceryItem(row: GroceryItemRow, customCatalog: CatalogEntry[]): GroceryItem {
  const { category, emoji, itemId } = deriveCategoryAndEmoji(row.name, customCatalog)
  return {
    id: row.id,
    remoteId: row.id,
    name: row.name,
    emoji,
    category,
    reason: row.reason ?? '',
    checked: row.checked,
    itemId,
  }
}

/**
 * `quantity`/`unit` exist on the table but nothing in the app model or UI
 * uses them yet, so writes never touch them — they're left for a future
 * feature rather than guessed at here.
 */
function groceryItemToRow(item: GroceryItem, householdId: string) {
  return {
    household_id: householdId,
    name: item.name,
    checked: item.checked,
    reason: item.reason || null,
  }
}

export interface FetchGroceryResult {
  items: GroceryItem[]
  error?: string
}

/** Loads every grocery item for the given household. Never queries across households. */
export async function fetchGroceryItems(
  householdId: string,
  customCatalog: CatalogEntry[],
): Promise<FetchGroceryResult> {
  const { data, error } = await supabase
    .from('grocery_list_items')
    .select('*')
    .eq('household_id', householdId)

  if (error) return { items: [], error: describe('load your grocery list', error, SELECT_HINT) }
  return { items: (data ?? []).map((row) => rowToGroceryItem(row as GroceryItemRow, customCatalog)) }
}

export interface WriteResult {
  remoteId?: string
  error?: string
}

export async function insertGroceryItem(item: GroceryItem, householdId: string): Promise<WriteResult> {
  const { data, error } = await supabase
    .from('grocery_list_items')
    .insert(groceryItemToRow(item, householdId))
    .select('id')
    .single()

  if (error) return { error: describe('save this grocery item', error, INSERT_HINT) }
  return { remoteId: data?.id }
}

export async function updateGroceryItem(item: GroceryItem, householdId: string): Promise<WriteResult> {
  if (!item.remoteId) return {}
  const { error } = await supabase
    .from('grocery_list_items')
    .update(groceryItemToRow(item, householdId))
    .eq('id', item.remoteId)
    .eq('household_id', householdId)

  if (error) return { error: describe('update this grocery item', error, UPDATE_HINT) }
  return {}
}

export async function deleteGroceryItem(remoteId: string, householdId: string): Promise<WriteResult> {
  const { error } = await supabase
    .from('grocery_list_items')
    .delete()
    .eq('id', remoteId)
    .eq('household_id', householdId)

  if (error) return { error: describe('delete this grocery item', error, DELETE_HINT) }
  return {}
}

export interface UploadResult {
  items: GroceryItem[]
  error?: string
}

/**
 * One-time upload of the local grocery list into a household that has none
 * yet. Inserts sequentially so each returned id attaches to the exact item
 * it belongs to, and stops on the first failure without dropping any local
 * items (see uploadInitialKitchen for the same reasoning).
 */
export async function uploadInitialGroceryList(
  items: GroceryItem[],
  householdId: string,
): Promise<UploadResult> {
  const results: GroceryItem[] = []
  for (const item of items) {
    const { remoteId, error } = await insertGroceryItem(item, householdId)
    if (error) return { items: [...results, ...items.slice(results.length)], error }
    results.push(remoteId ? { ...item, remoteId } : item)
  }
  return { items: results }
}
