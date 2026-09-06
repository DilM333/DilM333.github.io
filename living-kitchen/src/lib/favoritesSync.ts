import type { PostgrestError } from '@supabase/supabase-js'
import { isRlsError } from './household'
import { supabase } from '../utils/supabase'

/** Row shape of `public.favorites`. Existence of the row is the whole model — no mutable fields. */
export interface FavoriteRow {
  id: string
  created_at: string
  household_id: string
  recipe_id: string
}

function describe(action: string, error: PostgrestError, hint: string): string {
  if (isRlsError(error)) return `RLS blocked ${action}. Required policy:\n\n${hint}`
  return `Could not ${action}: ${error.message}`
}

const SELECT_HINT = `create policy "favorites_select_own_household" on public.favorites
  for select to authenticated
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()));`

const INSERT_HINT = `create policy "favorites_insert_own_household" on public.favorites
  for insert to authenticated
  with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));`

const DELETE_HINT = `create policy "favorites_delete_own_household" on public.favorites
  for delete to authenticated
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()));`

export interface FetchFavoritesResult {
  favorites: string[]
  error?: string
}

/** Loads every favorited recipe id for the given household. Never queries across households. */
export async function fetchFavorites(householdId: string): Promise<FetchFavoritesResult> {
  const { data, error } = await supabase
    .from('favorites')
    .select('recipe_id')
    .eq('household_id', householdId)

  if (error) return { favorites: [], error: describe('load your favorites', error, SELECT_HINT) }
  return { favorites: (data ?? []).map((row) => row.recipe_id as string) }
}

export interface WriteResult {
  error?: string
}

export async function insertFavorite(recipeId: string, householdId: string): Promise<WriteResult> {
  const { error } = await supabase
    .from('favorites')
    .insert({ household_id: householdId, recipe_id: recipeId })

  // A duplicate (e.g. two devices favoriting the same recipe at once) just
  // means the row we wanted already exists — not a failure. Only meaningful
  // if the recommended unique(household_id, recipe_id) constraint is in place.
  if (error && error.code === '23505') return {}
  if (error) return { error: describe('save this favorite', error, INSERT_HINT) }
  return {}
}

export async function deleteFavorite(recipeId: string, householdId: string): Promise<WriteResult> {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('household_id', householdId)
    .eq('recipe_id', recipeId)

  if (error) return { error: describe('remove this favorite', error, DELETE_HINT) }
  return {}
}

/**
 * One-time upload of the local favorites into a household that has none yet.
 * Unlike kitchen_items/grocery_list_items, favorites carry no other local
 * state to correlate back (the recipe id itself is the whole record), so a
 * single batch insert is enough — no need to insert one at a time.
 */
export async function uploadInitialFavorites(
  recipeIds: string[],
  householdId: string,
): Promise<WriteResult> {
  if (recipeIds.length === 0) return {}
  const rows = recipeIds.map((recipeId) => ({ household_id: householdId, recipe_id: recipeId }))
  const { error } = await supabase.from('favorites').insert(rows)
  // Only reachable if another device raced this same first-migration upload
  // at the same moment — the rows exist either way, so this isn't a failure.
  if (error && error.code === '23505') return {}
  if (error) return { error: describe('upload your favorites', error, INSERT_HINT) }
  return {}
}
