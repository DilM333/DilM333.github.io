import type { PostgrestError } from '@supabase/supabase-js'
import type { CatalogEntry } from '../data/catalog'
import { slugify } from '../data/catalog'
import type { Location, StockType } from '../data/types'
import { isRlsError } from './household'
import { supabase } from '../utils/supabase'

/** Row shape of `public.custom_ingredients`. */
export interface CustomIngredientRow {
  id: string
  created_at: string
  household_id: string
  name: string
  category: string
  location: Location
  stock_type: StockType
  emoji: string
  estimated_price: number | null
  updated_at: string
}

function describe(action: string, error: PostgrestError, hint: string): string {
  if (isRlsError(error)) return `RLS blocked ${action}. Required policy:\n\n${hint}`
  return `Could not ${action}: ${error.message}`
}

const SELECT_HINT = `create policy "custom_ingredients_select_own_household" on public.custom_ingredients
  for select to authenticated
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()));`

const INSERT_HINT = `create policy "custom_ingredients_insert_own_household" on public.custom_ingredients
  for insert to authenticated
  with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));`

const UPDATE_HINT = `create policy "custom_ingredients_update_own_household" on public.custom_ingredients
  for update to authenticated
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));`

const DELETE_HINT = `create policy "custom_ingredients_delete_own_household" on public.custom_ingredients
  for delete to authenticated
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()));`

/**
 * The app's custom ingredient id is `custom-${slugify(name)}` (see
 * data/catalog.ts `makeCustomCatalogEntry`) — fully deterministic from the
 * name, with no random component. That means the existing schema (which has
 * `name` but no id/slug column) is enough to reconstruct the exact same id
 * on every device; no schema change is needed for identity to survive a
 * cross-device round trip. The `Date.now()`-based fallback `makeCustomCatalogEntry`
 * uses for a name with zero alphanumeric characters is NOT reproduced here —
 * that fallback is only stable within one local session, so on the sync path
 * we fall back to the row's own (stable) uuid instead.
 */
function deriveCustomId(row: CustomIngredientRow): string {
  const slug = slugify(row.name)
  return `custom-${slug || row.id}`
}

export function rowToCatalogEntry(row: CustomIngredientRow): CatalogEntry {
  return {
    id: deriveCustomId(row),
    remoteId: row.id,
    name: row.name,
    emoji: row.emoji,
    category: row.category,
    location: row.location,
    stockType: row.stock_type,
    estPrice: row.estimated_price ?? undefined,
    custom: true,
  }
}

function catalogEntryToRow(entry: CatalogEntry, householdId: string) {
  return {
    household_id: householdId,
    name: entry.name,
    category: entry.category,
    location: entry.location,
    stock_type: entry.stockType,
    emoji: entry.emoji,
    estimated_price: entry.estPrice ?? null,
  }
}

export interface FetchCustomIngredientsResult {
  entries: CatalogEntry[]
  error?: string
}

/** Loads every custom ingredient for the given household. Never queries across households. */
export async function fetchCustomIngredients(householdId: string): Promise<FetchCustomIngredientsResult> {
  const { data, error } = await supabase
    .from('custom_ingredients')
    .select('*')
    .eq('household_id', householdId)

  if (error) return { entries: [], error: describe('load your custom ingredients', error, SELECT_HINT) }
  return { entries: (data ?? []).map((row) => rowToCatalogEntry(row as CustomIngredientRow)) }
}

export interface WriteResult {
  remoteId?: string
  error?: string
}

export async function insertCustomIngredient(
  entry: CatalogEntry,
  householdId: string,
): Promise<WriteResult> {
  const { data, error } = await supabase
    .from('custom_ingredients')
    .insert(catalogEntryToRow(entry, householdId))
    .select('id')
    .single()

  // A duplicate name (if the recommended unique constraint is added) just
  // means this ingredient already exists in the household — not a failure.
  if (error?.code === '23505') return {}
  if (error) return { error: describe('save this custom ingredient', error, INSERT_HINT) }
  return { remoteId: data?.id }
}

export async function updateCustomIngredient(
  entry: CatalogEntry,
  householdId: string,
): Promise<WriteResult> {
  if (!entry.remoteId) return {}
  const { error } = await supabase
    .from('custom_ingredients')
    .update(catalogEntryToRow(entry, householdId))
    .eq('id', entry.remoteId)
    .eq('household_id', householdId)

  if (error) return { error: describe('update this custom ingredient', error, UPDATE_HINT) }
  return {}
}

export async function deleteCustomIngredient(
  remoteId: string,
  householdId: string,
): Promise<WriteResult> {
  const { error } = await supabase
    .from('custom_ingredients')
    .delete()
    .eq('id', remoteId)
    .eq('household_id', householdId)

  if (error) return { error: describe('delete this custom ingredient', error, DELETE_HINT) }
  return {}
}

export interface UploadResult {
  entries: CatalogEntry[]
  error?: string
}

/**
 * One-time upload of the local custom catalog into a household that has none
 * yet. Inserts sequentially (like uploadInitialKitchen) so each returned id
 * attaches to the exact entry it belongs to, and stops on the first failure
 * without dropping any local entries.
 */
export async function uploadInitialCustomIngredients(
  entries: CatalogEntry[],
  householdId: string,
): Promise<UploadResult> {
  const results: CatalogEntry[] = []
  for (const entry of entries) {
    const { remoteId, error } = await insertCustomIngredient(entry, householdId)
    if (error) return { entries: [...results, ...entries.slice(results.length)], error }
    results.push(remoteId ? { ...entry, remoteId } : entry)
  }
  return { entries: results }
}
