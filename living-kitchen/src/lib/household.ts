import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../utils/supabase'

const DEFAULT_HOUSEHOLD_NAME = 'My Kitchen'

export interface EnsureHouseholdResult {
  householdId: string | null
  /** Set when Supabase blocked an operation (RLS) or another error occurred. */
  error?: string
}

/** True when a PostgREST error looks like a row-level-security denial. */
export function isRlsError(error: PostgrestError | null): boolean {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  return (
    error.code === '42501' ||
    error.code === 'PGRST301' ||
    msg.includes('row-level security') ||
    msg.includes('violates row-level security policy') ||
    msg.includes('permission denied')
  )
}

function describe(action: string, error: PostgrestError | null, policyHint: string): string {
  if (isRlsError(error)) {
    return `RLS blocked ${action}. Required policy:\n\n${policyHint}`
  }
  return `Could not ${action}: ${error?.message ?? 'unknown error'}`
}

const READ_MEMBERS_HINT = `create policy "hm_select_own" on public.household_members
  for select to authenticated
  using (user_id = auth.uid());`

const INSERT_HOUSEHOLD_HINT = `create policy "households_insert_authenticated" on public.households
  for insert to authenticated
  with check (true);`

const INSERT_MEMBER_HINT = `create policy "hm_insert_self" on public.household_members
  for insert to authenticated
  with check (user_id = auth.uid());`

/**
 * Idempotently guarantees the signed-in user belongs to a household.
 * - If a household_members row already exists for the user, returns that household id.
 * - Otherwise creates a household ("My Kitchen") and an owner membership row.
 *
 * The household id is generated client-side so we never need a SELECT policy on
 * `households` just to read back the freshly inserted row (that row isn't linked
 * to the user until the membership insert below, so a member-scoped SELECT policy
 * would return nothing).
 *
 * Never disables or weakens RLS. If Supabase blocks an operation, the returned
 * `error` string names the missing policy.
 */
export async function ensureHouseholdForUser(userId: string): Promise<EnsureHouseholdResult> {
  // 1. Already a member of a household?
  const { data: existing, error: readError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (readError) {
    return { householdId: null, error: describe('read household_members', readError, READ_MEMBERS_HINT) }
  }
  if (existing?.household_id) {
    return { householdId: existing.household_id as string }
  }

  // 2. Create the household (client-generated id, no read-back needed).
  const householdId = crypto.randomUUID()
  const { error: householdError } = await supabase
    .from('households')
    .insert({ id: householdId, name: DEFAULT_HOUSEHOLD_NAME })

  if (householdError) {
    return { householdId: null, error: describe('create household', householdError, INSERT_HOUSEHOLD_HINT) }
  }

  // 3. Create the owner membership row.
  const { error: memberError } = await supabase
    .from('household_members')
    .insert({ household_id: householdId, user_id: userId, role: 'owner' })

  if (memberError) {
    // A unique-violation means a concurrent client already created the
    // membership — re-read and use that instead of surfacing an error.
    if (memberError.code === '23505') {
      const { data: retry } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()
      if (retry?.household_id) return { householdId: retry.household_id as string }
    }
    return {
      householdId: null,
      error: describe('create household membership', memberError, INSERT_MEMBER_HINT),
    }
  }

  return { householdId }
}
